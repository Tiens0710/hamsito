import { randomUUID } from 'node:crypto';
import { TOEIC_PARTS, TOEIC_GROUPS, TOEIC_LESSONS } from './english-toeic-course.mjs';
function courseState(state) {
  state.learning ||= {};
  const saved=state.learning.toeic||{};
  state.learning.toeic={target:[450,650,800].includes(saved.target)?saved.target:650,attempts:Array.isArray(saved.attempts)?saved.attempts.slice(-80):[],active:saved.active||null};
  return state.learning.toeic;
}
const getGroups=attempt=>attempt.groups.map(id=>TOEIC_GROUPS.find(g=>g.id===id)).filter(Boolean).map(g=>({...g,questions:g.questions.map((q,index)=>({...q,id:`${g.id}:${index}`})).filter(q=>!attempt.only||attempt.only.includes(q.id))})).filter(g=>g.questions.length);
function publicAttempt(attempt) {
  if(!attempt)return null;
  return {id:attempt.id,kind:attempt.kind,lessonId:attempt.lessonId,startedAt:attempt.startedAt,groups:getGroups(attempt).map(g=>({...g,questions:g.questions.map(({answer,explanation,...q})=>q)}))};
}
export function toeicSnapshot(state) {
  const saved=courseState(state);
  const attempts=saved.attempts;
  const parts=TOEIC_PARTS.map(part=>{
    const latest=[...attempts].reverse().find(a=>a.parts.some(p=>p.part===part.part));
    const score=latest?.parts.find(p=>p.part===part.part)||null;
    return {...part,latest:score};
  });
  const lessons=TOEIC_LESSONS.map(lesson=>{
    const last=[...attempts].reverse().find(a=>a.lessonId===lesson.id);
    return {...lesson,total:TOEIC_GROUPS.find(g=>g.id===lesson.groupId).questions.length,last:last?{correct:last.correct,total:last.total,at:last.at}:null,passed:!!last&&last.correct/last.total>=.8};
  });
  const diagnostic=[...attempts].reverse().find(a=>a.kind==='diagnostic');
  const weak=[...parts].filter(p=>p.latest&&p.latest.correct/p.latest.total<.8).sort((a,b)=>a.latest.correct/a.latest.total-b.latest.correct/b.latest.total);
  const order=saved.target===450?[1,2,5,3,4,6,7]:saved.target===800?[7,3,4,6,5,2,1]:[2,5,3,4,6,7,1];
  const priority=[...new Set([...weak.map(p=>p.part),...order])];
  const next=priority.flatMap(part=>lessons.filter(l=>l.part===part&&!l.passed))[0]||lessons[0];
  const latestAnswers=new Map();
  for(const attempt of attempts)for(const item of attempt.responses)latestAnswers.set(item.id,item);
  const mistakes=[...latestAnswers.values()].filter(item=>!item.correct);
  return {target:saved.target,parts,lessons,next:next.id,diagnostic:diagnostic?{correct:diagnostic.correct,total:diagnostic.total,at:diagnostic.at}:null,weakParts:weak.map(p=>p.part),mistakeCount:mistakes.length,active:publicAttempt(saved.active),history:attempts.slice(-12).reverse().map(({responses,...a})=>a),questionCount:TOEIC_GROUPS.reduce((n,g)=>n+g.questions.length,0)};
}
export function toeicAction(state,body,now=Date.now()) {
  const saved=courseState(state);
  if(body.action==='target') {
    if(![450,650,800].includes(body.target))throw new Error('Chọn mục tiêu 450, 650 hoặc 800.');
    saved.target=body.target;return null;
  }
  if(body.action==='result') {
    const result=saved.attempts.find(a=>a.id===body.attemptId);
    if(!result)throw new Error('Không tìm thấy kết quả này trong lịch sử gần đây.');
    const groups=[...new Set(result.responses.map(r=>r.id.split(':')[0]))];
    return {result:{...result,groups:getGroups({groups,only:result.responses.map(r=>r.id)}).map(g=>({...g,questions:g.questions.map(q=>({...q,selected:result.responses.find(r=>r.id===q.id).selected}))}))}};
  }
  if(body.action==='start') {
    if(saved.active&&!body.replace)return {attempt:publicAttempt(saved.active)};
    let groups,only,kind=body.kind,lessonId=null;
    if(kind==='diagnostic') groups=TOEIC_GROUPS.filter(g=>g.id.endsWith('-a')).map(g=>g.id);
    else if(kind==='lesson') {
      const lesson=TOEIC_LESSONS.find(l=>l.id===body.lessonId);if(!lesson)throw new Error('Không tìm thấy bài luyện.');
      groups=[lesson.groupId];lessonId=lesson.id;
    } else if(kind==='mistakes') {
      const answers=new Map();for(const attempt of saved.attempts)for(const item of attempt.responses)answers.set(item.id,item);
      only=[...answers.values()].filter(q=>!q.correct).map(q=>q.id);
      if(!only.length)throw new Error('Chưa có câu cần làm lại.');
      groups=[...new Set(only.map(id=>id.split(':')[0]))];
    } else throw new Error('Chọn loại bài hợp lệ.');
    saved.active={id:randomUUID(),kind,lessonId,groups,only,startedAt:now};
    return {attempt:publicAttempt(saved.active)};
  }
  if(body.action==='submit') {
    const active=saved.active;
    if(!active||body.attemptId!==active.id)throw new Error('Bài này đã được nộp hoặc không còn hiệu lực.');
    const groups=getGroups(active),questions=groups.flatMap(g=>g.questions.map(q=>({...q,part:g.part})));
    if(!Array.isArray(body.answers)||body.answers.length!==questions.length)throw new Error('Danh sách câu trả lời chưa hợp lệ.');
    const responses=questions.map((q,index)=>{
      const selected=body.answers[index];
      if(selected!==null&&(!Number.isInteger(selected)||selected<0||selected>=q.options.length))throw new Error('Lựa chọn đáp án không hợp lệ.');
      return {id:q.id,part:q.part,selected,correct:selected===q.answer};
    });
    const parts=TOEIC_PARTS.map(p=>({part:p.part,total:responses.filter(q=>q.part===p.part).length,correct:responses.filter(q=>q.part===p.part&&q.correct).length})).filter(p=>p.total);
    const result={id:active.id,kind:active.kind,lessonId:active.lessonId,at:now,seconds:Math.max(0,Math.round((now-active.startedAt)/1000)),correct:responses.filter(q=>q.correct).length,total:responses.length,parts,responses,assisted:body.assisted===true};
    saved.attempts.push(result);saved.attempts=saved.attempts.slice(-80);saved.active=null;
    return {result:{...result,groups:groups.map(g=>({...g,questions:g.questions.map(q=>({...q,selected:responses.find(r=>r.id===q.id).selected}))}))}};
  }
  if(body.action==='cancel'){saved.active=null;return null;}
  throw new Error('Thao tác TOEIC không hợp lệ.');
}
