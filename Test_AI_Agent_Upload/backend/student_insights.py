from collections import defaultdict
from datetime import date
import re
ONLINE=('حصة','حصص','اونلاين','أونلاين','درس إلكتروني','online lesson')
ASSIGN=('واجب','واجبات','تكليف','تسليم','homework','assignment')
SUMMARY=('ملخص','معلومات عن','عطني معلومات','اعطني معلومات','وش وضع','وش مستواه','كيف مستواه','أداء','overview','overall')
def has(q,words): return any(w.casefold() in q.casefold() for w in words)
def insights(s):
 groups=defaultdict(list); pct=[]
 for g in s.get('grades') or []:
  a,b=g.get('score'),g.get('outOf')
  if isinstance(a,(int,float)) and isinstance(b,(int,float)) and b>0:
   row={'subject':g.get('subject'),'assessment':g.get('assessment'),'date':g.get('date'),'percentage':round(a/b*100,1)}
   groups[str(row['subject'])].append(row); pct.append(row)
 averages={k:round(sum(x['percentage'] for x in v)/len(v),1) for k,v in groups.items() if len(v)>=2}
 trends=[]
 for subject,rows in groups.items():
  dates=[]
  for r in rows:
   x=r['date']
   try: key=date.fromisoformat(x[:10]).toordinal()
   except (ValueError,TypeError):
    m=re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{4})',str(x))
    if not m: continue
    key=int(m[3])*372+int(m[2])*31+int(m[1])
   dates.append((key,r['percentage']))
  if len(dates)>=3:
   dates.sort(); delta=round(dates[-1][1]-dates[0][1],1)
   trends.append({'subject':subject,'direction':'improving' if delta>0 else 'declining' if delta<0 else 'stable','change_percentage_points':delta,'assessment_count':len(dates)})
 skills=defaultdict(list)
 for g in s.get('grades') or []:
  k=g.get('skill') or g.get('objective') or g.get('learningObjective'); a,b=g.get('score'),g.get('outOf')
  if k and isinstance(a,(int,float)) and isinstance(b,(int,float)) and b>0 and a/b<.7: skills[k].append(round(a/b*100,1))
 comparisons=[]
 subjects=sorted(averages)
 for i,subject in enumerate(subjects):
  for other in subjects[i+1:]:
   comparisons.append({'subjects':[subject,other],'averages':[averages[subject],averages[other]],'difference':round(averages[subject]-averages[other],1),'assessment_count':[len(groups[subject]),len(groups[other])]})
 support=[{'subject':k,'average_percentage':v,'assessment_count':len(groups[k])} for k,v in averages.items() if v<70]
 return {'assessment_percentages':pct,'subject_averages':averages,'subject_comparisons':comparisons,'trends':trends,'repeated_low_scoring_skills':[{'skill':k,'percentages':v} for k,v in skills.items() if len(v)>=2],'strengths':[{'subject':k,'average_percentage':v,'assessment_count':len(groups[k])} for k,v in averages.items() if v>=85],'areas_for_support':support,'recommendations':[{'basis':x,'suggestion':'راجعوا الدروس اللي تحتاج دعم وتدربوا على مسائل قصيرة ثم تابعوا التقييم الجاي.'} for x in support],'limits':'Subject averages require two assessments; trends require three dated assessments. A missing score is not zero.'}
def _missing(service,sid,cat):
 p=service.get_student_profile(sid); par=service.get_student_parent(sid) or {}; n=par.get('shortName') or par.get('preferredName') or par.get('name'); rel=str(par.get('relation') or '').casefold()
 who=('يا أبو '+n) if n and rel in ('father','الأب') else ('يا أم '+n) if n and rel in ('mother','الأم') else ''
 detail={'online_attendance':'تفاصيل الحصة','assignments':'سجل الواجب','grades':'الدرجة المطلوبة','exams':'موعد الاختبار','announcements':'الإعلان المطلوب'}.get(cat,'هالتفصيل')
 school='تقدر تتأكد من '+p['school'] if p.get('school') else 'تقدر تتواصل مع المدرسة'
 return f"كان ودي أساعدك {who}، لكن {detail} مو مسجل عندي حاليًا، وهذا ما يثبت إنه ما صار. {school} أو تراجع نظام نور بنفسك؛ ما عندي اتصال مباشر بنور."
def fmt(rows,cat):
 if not rows: return 'ما عندي سجل حاليًا؛ عدم وجود سجل ما يثبت الغياب أو عدم التسليم.'
 demo=any(x.get('demo') or x.get('source')=='synthetic_demo' for x in rows)
 if cat=='online_attendance':
  labels={'present':'حضر','absent':'مسجل غياب','late':'تأخر','excused':'غياب بعذر','left_early':'غادر قبل نهاية الحصة'}
  text='؛ '.join(f"{x.get('subject')} بتاريخ {x.get('date')}: {labels.get(x.get('status'),'حالة غير مسجلة')}"+(f" ({x['durationMinutes']} من {x['scheduledDurationMinutes']} دقيقة)" if x.get('durationMinutes') is not None else '') for x in rows)
  counts={k:sum(x.get('status')==k for x in rows) for k in labels}
  summary=f" الإجمالي المسجل: {counts['present']} حضور، {counts['absent']} غياب، {counts['late']} تأخر، {counts['excused']} بعذر، و{counts['left_early']} خروج مبكر."
  head='سجل الحصص: '
 else:
  labels={'missing':'مسجل كمفقود','in_progress':'قيد العمل','not_started':'ما بدأ','submitted':'تم التسليم','submitted_late':'تم التسليم متأخر','graded':'تم تصحيحه','late':'متأخر'}
  text='؛ '.join(f"{x.get('title')} ({x.get('subject')}، موعده {x.get('dueDate')}): {labels.get(x.get('status'),'الحالة غير مسجلة')}" for x in rows)
  summary=''
  head='الواجبات المسجلة: '
 return ('تنبيه: هذي سجلات تجريبية وليست ملاحظات فعلية. ' if demo else '')+head+text+'.'+summary

def _partial_fields(cat,rows):
 required={'grades':('subject','score','outOf'),'exams':('subject','date'),'announcements':('title','date','body'),'online_attendance':('subject','date','status'),'assignments':('title','subject','dueDate','status')}
 missing=[]
 if cat=='attendance' and isinstance(rows,dict):
  missing=[f for f in ('schoolDays','present','absent','late') if rows.get(f) is None]
 elif cat in required and isinstance(rows,list):
  for i,row in enumerate(rows):
   for key in required[cat]:
    if row.get(key) is None: missing.append(f'[{i}].{key}')
 return missing

def enrich(service,data,sid,q):
 if data.get('category')=='other_student': data['status']='invalid_request'; return data
 s=service.get_student(sid); cat=data.get('category','profile')
 if has(q,ONLINE): cat='online_attendance'; rows=s.get('onlineLessons'); data.update(category=cat,categories=[cat],records=rows,found=bool(rows))
 elif has(q,ASSIGN): cat='assignments'; rows=s.get('assignments'); data.update(category=cat,categories=[cat],records=rows,found=bool(rows))
 elif has(q,SUMMARY):
  cat='overview'; rows=service.get_student_summary(sid); rows.update(onlineLessons=s.get('onlineLessons'),assignments=s.get('assignments'),insights=insights(s)); data.update(category=cat,categories=list(rows),records=rows,found=True)
 rows=data.get('records'); miss=rows is None or rows==[]
 if cat=='overview' and isinstance(rows,dict):
  missing=[k for k in ('attendance','grades','exams','announcements','onlineLessons','assignments') if rows.get(k) is None or rows.get(k)==[]]
  status='partial' if missing else 'found'; data['missing_categories']=missing; data['partial_fields']=missing
 else:
  status='not_found' if miss else 'found'
  partial_fields=_partial_fields(cat,rows) if not miss else []
  if partial_fields: status='partial'
  data['partial_fields']=partial_fields
 p=service.get_student_profile(sid); par=service.get_student_parent(sid) or {}
 data.update(status=status,source='supabase' if getattr(service,'live',False) else 'madrasati-dataset.json',school=p.get('school'),parent_context={'name':par.get('shortName') or par.get('preferredName') or par.get('name'),'relation':par.get('relation')})
 data['answer_override']=_missing(service,sid,cat) if status=='not_found' else fmt(rows,cat) if cat in ('online_attendance','assignments') else None
 return data
