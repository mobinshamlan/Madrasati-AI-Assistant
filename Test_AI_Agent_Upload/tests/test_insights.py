import unittest
from unittest.mock import patch
from tempfile import TemporaryDirectory
from pathlib import Path
import json

import backend.app as backend
from backend.student_insights import enrich, insights


class InsightTests(unittest.TestCase):
    def setUp(self):
        fixture = patch.object(backend, "service", backend.StudentDataService(backend.DATA_PATH))
        fixture.start()
        self.addCleanup(fixture.stop)

    def test_reem_demo_online_lesson_records_are_scoped_and_labeled(self):
        data = backend.service.retrieve_relevant_student_data('sama', 'online lesson attendance')
        result = enrich(backend.service, data, 'sama', 'online lesson attendance')
        self.assertEqual(result['status'], 'found')
        self.assertEqual(result['category'], 'online_attendance')
        self.assertEqual(len(result['records']), 3)
        self.assertTrue(all(x['studentId'] == 'sama' and x['demo'] for x in result['records']))
        self.assertIn('تجريبية', result['answer_override'])
        self.assertIn('1 حضور', result['answer_override'])

    def test_reem_assignment_statuses_and_dates(self):
        result = enrich(backend.service, backend.service.retrieve_relevant_student_data('sama', 'homework assignments'), 'sama', 'homework assignments')
        self.assertEqual(result['status'], 'found')
        self.assertEqual(len(result['records']), 2)
        self.assertEqual({x['status'] for x in result['records']}, {'in_progress', 'missing'})
        self.assertIn('2026-10-29', result['answer_override'])
        self.assertIn('تجريبية', result['answer_override'])

    def test_insights_normalize_scores_and_require_evidence_for_averages_and_trends(self):
        student = {'grades': [
            {'subject': 'Math', 'score': 8, 'outOf': 10, 'date': '2026-10-01'},
            {'subject': 'Math', 'score': 15, 'outOf': 20, 'date': '2026-10-02'},
            {'subject': 'Math', 'score': 9, 'outOf': 10, 'date': '2026-10-03'},
            {'subject': 'Science', 'score': 4, 'outOf': 10, 'date': '2026-10-02'},
            {'subject': 'Science', 'score': 5, 'outOf': 10, 'date': '2026-10-03'},
        ]}
        result = insights(student)
        self.assertEqual(result['subject_averages']['Math'], 81.7)
        self.assertEqual(result['trends'][0]['direction'], 'improving')
        self.assertEqual(len(result['assessment_percentages']), 5)
        self.assertEqual(result['subject_averages']['Science'], 45.0)
        self.assertEqual(len(result['subject_comparisons']), 1)
        self.assertTrue(result['areas_for_support'])
        self.assertTrue(result['recommendations'])

    def test_overview_contains_selected_student_categories_and_insights(self):
        data = backend.service.retrieve_relevant_student_data('sama', 'overview')
        result = enrich(backend.service, data, 'sama', 'overview')
        self.assertEqual(result['category'], 'overview')
        self.assertEqual(result['status'], 'found')
        self.assertEqual(result['records']['profile']['id'], 'sama')
        self.assertEqual(result['school'], result['records']['profile']['school'])
        self.assertTrue(result['parent_context']['name'])
        self.assertEqual(len(result['records']['grades']), 5)
        self.assertIn('onlineLessons', result['records'])
        self.assertIn('assignments', result['records'])
        self.assertIn('assessment_percentages', result['records']['insights'])

    def test_missing_assignment_is_not_described_as_not_submitted(self):
        with TemporaryDirectory() as tmp:
            path=Path(tmp)/'data.json'
            path.write_text(json.dumps({'students':[{'id':'s1','name':'Student','school':'Demo School'}]}), encoding='utf-8')
            service=backend.StudentDataService(path)
            result=enrich(service, service.retrieve_relevant_student_data('s1','homework'), 's1','homework')
            self.assertEqual(result['status'],'not_found')
            self.assertIn('Demo School',result['answer_override'])
            self.assertIn('نظام نور',result['answer_override'])
            self.assertNotIn('ما تسلّم',result['answer_override'])

    def test_missing_online_lesson_is_not_called_an_absence(self):
        with TemporaryDirectory() as tmp:
            path=Path(tmp)/'data.json'
            path.write_text(json.dumps({'students':[{'id':'s1','name':'Student'}]}),encoding='utf-8')
            service=backend.StudentDataService(path)
            result=enrich(service,service.retrieve_relevant_student_data('s1','online lesson'),'s1','online lesson')
            self.assertEqual(result['status'],'not_found')
            self.assertIn('ما يثبت إنه ما صار',result['answer_override'])
            self.assertIn('تتواصل مع المدرسة',result['answer_override'])
            self.assertNotIn('يا أبو',result['answer_override'])

    def test_other_student_request_stays_blocked(self):
        result=enrich(backend.service, backend.service.retrieve_relevant_student_data('sama','grades for faisal'),'sama','grades for faisal')
        self.assertEqual(result['status'],'invalid_request')
        self.assertNotIn('records',result)

    def test_existing_live_integration_keeps_gpt_live_and_missing_data_rules(self):
        class Response:
            status_code=200
            is_error=False
            def json(self): return {'session':{'id':'live-rules'},'transport':{'sdp':'answer'}}
        class FakeClient:
            async def __aenter__(self): return self
            async def __aexit__(self,*args): return False
            async def post(self,url,*,headers,json): self.payload=json; return Response()
        fake=FakeClient()
        from unittest.mock import patch
        with patch.object(backend,'OPENAI_API_KEY','test'), patch.object(backend.httpx,'AsyncClient',return_value=fake):
            response=TestClient(backend.app).post('/api/live/session',json={'student_id':'sama','sdp':'offer','greet':False})
        self.assertEqual(response.status_code,200)
        self.assertEqual(fake.payload['session']['model'],'gpt-live-1')
        self.assertIn('Noor access',fake.payload['session']['instructions'])
        self.assertIn('demo/synthetic_demo',fake.payload['session']['instructions'])


if __name__ == '__main__':
    unittest.main()
from fastapi.testclient import TestClient
