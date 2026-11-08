import copy
import httpx
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
import backend.app as backend
from backend.supabase_students import assemble, TABLES
from backend.supabase_students import load_dataset
from backend.call_context import context_instructions


def tables():
    t = {name: [] for name in TABLES}
    for key, name in [('reem', 'ريم عبدالرحمن الشهري'), ('nawaf', 'نواف عبدالرحمن الشهري')]:
        t['students'].append({'id': key, 'demo_key': key, 'full_name': name, 'first_name': name.split()[0], 'grade_label': 'صف', 'school_name': 'مدرسة'})
        t['attendance_terms'].append({'student_id': key, 'term_label': 'الفصل', 'school_days': 2, 'present': 2, 'absent': 0, 'late': 0, 'excused': 0})
        t['assistant_preferences'].append({'student_id': key, 'attendance_timing': 'immediate', 'exams_timing': 'day-before', 'grades_timing': 'immediate'})
    return t


class LiveTests(unittest.TestCase):
    def test_local_parent_entry_is_used_without_old_password_and_keeps_parent_rls(self):
        seen = []
        client_type = httpx.Client
        fixture = tables()
        def respond(request):
            seen.append(request)
            if request.url.path == '/api/demo/parent-session':
                return httpx.Response(200, json={'access_token': 'parent-only-token'})
            if request.url.path == '/auth/v1/user':
                return httpx.Response(200, json={'app_metadata': {}})
            return httpx.Response(200, json=fixture[request.url.path.rsplit('/', 1)[-1]])
        client = client_type(transport=httpx.MockTransport(respond))
        with patch('backend.supabase_students.configuration', return_value=('https://example.supabase.co', 'publishable', '', '')), patch('backend.supabase_students.httpx.Client', return_value=client):
            result = load_dataset()
        self.assertEqual([s['id'] for s in result['students']], ['reem', 'nawaf'])
        self.assertEqual(seen[0].url.host, '127.0.0.1')
        self.assertEqual(seen[0].headers['origin'], 'http://127.0.0.1:3000')
        for request in seen[1:]:
            self.assertEqual(request.headers['authorization'], 'Bearer parent-only-token')

    def test_local_entry_cannot_supply_an_operator_session(self):
        client_type = httpx.Client
        def respond(request):
            if request.url.path == '/api/demo/parent-session':
                return httpx.Response(200, json={'access_token': 'wrong-role-token'})
            return httpx.Response(200, json={'app_metadata': {'tammeni_role': 'demo_operator'}})
        client = client_type(transport=httpx.MockTransport(respond))
        with patch('backend.supabase_students.configuration', return_value=('https://example.supabase.co', 'publishable', '', '')), patch('backend.supabase_students.httpx.Client', return_value=client):
            with self.assertRaises(HTTPException) as caught:
                load_dataset()
        self.assertEqual(caught.exception.status_code, 503)

    def test_attendance_overlay_and_archived_records(self):
        t = tables()
        t['attendance_records'] = [
            {'student_id': 'reem', 'day': '2026-10-29', 'status': 'present', 'origin': 'import'},
            {'student_id': 'reem', 'day': '2026-10-29', 'status': 'absent', 'origin': 'demo'},
            {'student_id': 'reem', 'day': '2026-10-30', 'status': 'late', 'origin': 'demo', 'archived_at': 'now'}]
        a = assemble(t)['students'][0]['attendance']
        self.assertEqual((a['schoolDays'], a['present'], a['absent']), (2, 1, 1))
        self.assertEqual(a['latestRecord']['status'], 'absent')
        self.assertEqual(len(a['week']), 1)

    def test_latest_grades_and_disabled_topic(self):
        t = tables()
        t['grades'] = [{'student_id': 'reem', 'subject': 'Math', 'assessment': 'test', 'score': score, 'out_of': 10, 'published_on': day} for score, day in [(4, '2026-10-20'), (9, '2026-10-29')]]
        self.assertEqual(assemble(t)['students'][0]['grades'][0]['score'], 9)
        self.assertEqual(assemble(t)['students'][1]['grades'], [])
        t['assistant_preferences'][0]['grades_timing'] = 'off'
        self.assertEqual(assemble(t)['students'][0]['grades'], [])

    def test_new_question_reads_current_records(self):
        old = assemble(tables())
        changed = tables()
        changed['attendance_records'] = [{'student_id': 'reem', 'day': '2026-10-29', 'status': 'absent', 'origin': 'demo'}]
        new = assemble(changed)
        client = TestClient(backend.app)
        with patch.object(backend, 'service', backend.StudentDataService()), patch.object(backend, 'OPENAI_API_KEY', ''), patch.object(backend, 'load_dataset', side_effect=[old, old, new, new]) as loader:
            session = client.post('/api/conversations', json={'student_id': 'reem'}).json()['conversation_id']
            body = {'student_id': 'reem', 'conversation_id': session, 'message': 'كم غيابها؟'}
            self.assertIn('0 غياب', client.post('/api/student/chat', json=body).json()['answer'])
            self.assertIn('1 غياب', client.post('/api/student/chat', json=body).json()['answer'])
            self.assertEqual(client.post('/api/student/chat', json={**body, 'student_id': 'nawaf'}).status_code, 409)
            self.assertEqual(loader.call_count, 4)

    def test_outage_has_no_fixture_fallback(self):
        with patch.object(backend, 'service', backend.StudentDataService()), patch.object(backend, 'load_dataset', side_effect=HTTPException(503, 'unavailable')):
            self.assertEqual(TestClient(backend.app).get('/api/students').status_code, 503)

    def test_only_visible_students_are_available(self):
        with patch.object(backend, 'service', backend.StudentDataService()), patch.object(backend, 'load_dataset', return_value=assemble(tables())):
            self.assertEqual(TestClient(backend.app).post('/api/conversations', json={'student_id': 'faisal'}).status_code, 404)

    def test_call_uses_current_event_and_exact_profile_not_old_grades(self):
        from test_notify import CTX
        ctx = copy.deepcopy(CTX)
        ctx['student']['key'] = 'reem'
        prompt = context_instructions(ctx)
        self.assertIn(ctx['facts'][0], prompt)
        self.assertIn('رياض النخبة', prompt)
        self.assertNotIn('نواف', prompt)
        self.assertNotIn('9.5', prompt)
        ctx['student']['key'] = 'nawaf'
        self.assertNotIn('الواحة', context_instructions(ctx))
