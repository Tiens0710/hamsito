/* TOEIC L&R: separate from the conversation curriculum. Answers graded server-side. */
(() => {
  const root=$('#toeicRoot');let data,pending=false,screen='overview',lessonId=null,result=null,answers=[],draftId=null;
  let shownTranscript=false;
  const makeButton=(text,fn,style='button secondary')=>{
    const b=node('button',style,text);b.type='button';b.disabled=pending;b.addEventListener('click',fn);return b;
  };
  const course=()=>data.learning.toeicCourse;
  function jump(){root.scrollIntoView({block:'start'});root.querySelector('h1,h2')?.focus({preventScroll:true});}
  function title(text){const h=node('h1','',text);h.id='toeicTitle';h.tabIndex=-1;return h;}
  function stopAudio(){if(speechSynthesisSupported())speechSynthesis.cancel();}
  function switchScreen(value){stopAudio();screen=value;render();jump();}
  async function request(body){
    if(pending)return null;pending=true;root.setAttribute('aria-busy','true');root.querySelectorAll('button,select').forEach(el=>el.disabled=true);
    try{snapshot=await api('toeic',body);data=snapshot;renderAll();return snapshot.toeicResult||{};}
    catch(error){toast(error.message,true);return null;}
    finally{pending=false;root.removeAttribute('aria-busy');render();}
  }
  async function start(kind,id){
    if(pending)return;
    const active=course().active;
    if(active){
      if(active.kind===kind&&(kind!=='lesson'||active.lessonId===id)){screen='attempt';render();jump();return;}
      if(!confirm('Bạn đang có một bài TOEIC chưa nộp. Bắt đầu bài mới và bỏ bài đang làm?'))return;
    }
    const response=await request({action:'start',kind,lessonId:id,replace:!!active});
    if(response){result=null;shownTranscript=false;screen='attempt';render();jump();}
  }
  function link(text,url){const a=node('a','',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
  function vocab(set){showView('vocabulary');window.noiVocabulary?.openSet(set);}
  function nav(){const bar=node('div','toeic-tabs');[['overview','Lộ trình'],['parts','Luyện từng Part'],['history','Kết quả & câu sai']].forEach(([id,label])=>{const b=makeButton(label,()=>switchScreen(id),'toeic-tab');b.setAttribute('aria-pressed',String(screen===id));bar.append(b);});root.append(bar);}
  function overview(){
    const c=course();const head=node('div','toeic-heading');const copy=node('div');copy.append(node('small','','TOEIC LISTENING & READING'),title('Học theo kỹ năng. Luyện có hướng.'));head.append(copy,lessonArt('listening','toeic-heading-art'));root.append(head);
    const controls=node('div','toeic-target');const label=node('label','','Mục tiêu điểm');label.htmlFor='toeicTarget';const select=node('select');select.id='toeicTarget';
    [450,650,800].forEach(value=>{const op=node('option','',`${value}+`);op.value=value;select.append(op);});select.value=c.target;
    select.addEventListener('change',()=>request({action:'target',target:Number(select.value)}));
    controls.append(label,select,node('p','',c.target===450?'Ưu tiên câu ngắn, từ loại và thông tin trực tiếp trước khi mở rộng.':c.target===650?'Củng cố nền tảng, tăng nghe theo ngữ cảnh và nối ý trong đoạn văn.':'Rà lỗ hổng trước, ưu tiên suy luận, paraphrase và đối chiếu nhiều văn bản.'));root.append(controls);
    nav();
    if(c.active){const resume=node('div','toeic-resume');resume.append(node('span','','Bạn có một bài chưa nộp.'),makeButton('Tiếp tục bài đang làm',()=>switchScreen('attempt'),'button primary'));root.append(resume);}
    const first=node('section','toeic-entry');first.append(node('h2','',c.diagnostic?'Kết quả khảo sát ban đầu':'Bắt đầu bằng khảo sát kỹ năng'),node('p','',c.diagnostic?`Đúng ${c.diagnostic.correct}/${c.diagnostic.total} câu trong lần khảo sát gần nhất. Xem kết quả từng Part bên dưới để chọn bài cần củng cố.`:'22 câu rút gọn qua 7 Part. Dùng để nhận diện điểm cần luyện, không dự báo điểm TOEIC.'));
    first.append(makeButton(c.diagnostic?'Làm lại khảo sát':'Làm khảo sát 22 câu',()=>start('diagnostic'),'button primary'),node('small','','Khảo sát dùng câu trong thư viện này; chưa được chuẩn hóa. Làm lại có thể chịu ảnh hưởng của việc nhớ đáp án.'));root.append(first);
    const next=c.lessons.find(l=>l.id===c.next);const recommendation=node('div','toeic-next');recommendation.append(node('div','',c.diagnostic?'Gợi ý dựa trên kết quả luyện gần nhất':'Bạn có thể học ngay trong khi chưa khảo sát'),node('strong','',`Part ${next.part} · ${next.title}`),makeButton('Mở bài gợi ý →',()=>{lessonId=next.id;switchScreen('lesson');},'text-button'));root.append(recommendation);
    root.append(node('h2','toeic-section-title','Lộ trình 3 chặng'));
    const stages=[{name:'01 · Nền tảng câu ngắn',parts:[1,2,5],goal:'Nhận diện hành động, nghe câu hỏi và xác định cấu trúc câu.'},{name:'02 · Hiểu trong ngữ cảnh',parts:[3,4,6],goal:'Theo dõi ý chính, thông tin chi tiết và liên kết giữa các câu.'},{name:'03 · Nối thông tin & củng cố',parts:[7],goal:'Đối chiếu tài liệu; quay lại câu sai của cả Listening và Reading.'}];
    const path=node('div','toeic-roadmap');for(const stage of stages){
      const panel=node('section','toeic-stage');panel.append(node('h3','',stage.name),node('p','',stage.goal));
      const lessons=c.lessons.filter(l=>stage.parts.includes(l.part));
      panel.append(node('small','',`${lessons.filter(l=>l.passed).length}/${lessons.length} bài đạt ít nhất 80% ở lượt gần nhất`));
      for(const lesson of lessons){const b=makeButton('',()=>{lessonId=lesson.id;switchScreen('lesson');},'toeic-lesson-row');b.append(node('span','',lesson.passed?'✓':`P${lesson.part}`),node('strong','',lesson.title),node('small','',lesson.last?`${lesson.last.correct}/${lesson.last.total}`:`${lesson.minutes} phút dự kiến`));panel.append(b);}path.append(panel);
    }root.append(path,node('p','toeic-note','Mục tiêu điểm dùng để sắp thứ tự gợi ý, không phải cam kết đầu ra. Mốc 80% chỉ là tiêu chí ôn nội bộ cho các bài ngắn; không chứng minh đã thành thạo một Part.'));
    const plan=node('section','toeic-study-plan');plan.append(node('h2','','Một buổi học nên đi thế nào?'));['5 phút: ôn từ và xem một lỗi cũ.','8–15 phút: đọc kiến thức rồi làm một bài theo Part.','5 phút: đọc giải thích, tìm bằng chứng, nghe lại đoạn chưa hiểu.','Buổi sau: làm lại câu sai rồi chuyển sang bài kế tiếp.'].forEach(text=>plan.append(node('p','',text)));root.append(plan);format();
  }
  function partList(){root.append(title('Luyện từng Part'));nav();const list=node('div','toeic-parts');for(const p of course().parts){const card=node('article','toeic-part');card.append(node('small','',`${p.section} · Part ${p.part}`),node('h2','',p.title),node('p','',p.skill),node('span','toeic-part-score',p.latest?`Lượt gần nhất: ${p.latest.correct}/${p.latest.total} câu đúng`:'Chưa có kết quả luyện'));for(const lesson of course().lessons.filter(l=>l.part===p.part)){card.append(makeButton(lesson.title,()=>{lessonId=lesson.id;switchScreen('lesson');},'text-button'));}list.append(card);}root.append(list);}
  function lesson(){
    const l=course().lessons.find(l=>l.id===lessonId);if(!l){screen='overview';overview();return;}
    const p=course().parts.find(p=>p.part===l.part);
    root.append(makeButton('← Về lộ trình',()=>switchScreen('overview'),'text-button'),title(`Part ${p.part} · ${l.title}`),node('p','toeic-note',`${p.skill} · ${l.total} câu tự biên soạn · khoảng ${l.minutes} phút gồm học và chữa bài`));
    const article=node('article','toeic-teaching');article.append(node('h2','','Sau bài này, bạn cần làm được gì?'),node('p','',l.objective),node('h3','','Kiến thức trọng tâm'),node('p','',l.explain),node('blockquote','',l.worked),node('h3','','Cách làm từng bước'));const steps=node('ol');p.steps.forEach(t=>steps.append(node('li','',t)));article.append(steps,node('h3','','Bẫy cần tránh'),node('p','',p.trap));root.append(article);
    const actions=node('div','toeic-actions');actions.append(makeButton('Bắt đầu bài luyện →',()=>start('lesson',l.id),'button primary'),makeButton('Ôn từ vựng liên quan',()=>vocab(p.set)));root.append(actions);
    if(l.last)root.append(node('p','toeic-note',`Lượt gần nhất: ${l.last.correct}/${l.last.total}. Bấm luyện lại để kiểm tra khả năng nhớ và giải thích, không chỉ nhớ chữ cái đáp án.`));
  }
  function readDraft(attempt){if(draftId===attempt.id)return;draftId=attempt.id;try{const draft=JSON.parse(sessionStorage.getItem(`noi-toeic:${attempt.id}`));answers=Array.isArray(draft)?draft:[];}catch{answers=[];}answers=attempt.groups.flatMap(g=>g.questions).map((q,i)=>Number.isInteger(answers[i])&&answers[i]>=0&&answers[i]<q.options.length?answers[i]:null);}
  function groupAudio(g,q){return g.part===1?q.options.map((o,i)=>`${String.fromCharCode(65+i)}. ${o}`).join(' '):g.part===2?`${q.audio} ${q.options.map((o,i)=>`${String.fromCharCode(65+i)}. ${o}`).join(' ')}`:g.script;}
  function renderGroups(groups,review=false){let index=0;for(const g of groups){
    const group=node('section','toeic-question-group');group.append(node('h2','',`Part ${g.part} · ${g.title}`));
    if(g.image){const img=node('img','toeic-photo');img.src=g.image;img.alt='Hình minh họa cho bài làm quen Part 1';group.append(img,node('small','toeic-note','Hình hoạt hình dùng để làm quen kỹ năng quan sát; không thay thế ảnh thật trong đề thi.'));}
    if(g.text)group.append(node('div','toeic-passage',g.text));
    if(g.script){group.append(makeButton('Nghe đoạn này',()=>speak(g.script)),makeButton('Dừng âm thanh',stopAudio,'text-button'));}
    if(g.script&&!review){const transcript=node('details','toeic-transcript');transcript.append(node('summary','','Xem transcript hỗ trợ'),node('p','',g.script));transcript.addEventListener('toggle',()=>{if(transcript.open)shownTranscript=true;});group.append(transcript);}
    if(g.script&&review)group.append(node('p','toeic-transcript-text',g.script));
    for(const q of g.questions){const i=index++;const field=node('fieldset','toeic-question');field.id=`toeic-q-${i}`;const legend=node('legend','',`${i+1}. ${q.prompt}`);field.append(legend);
      if([1,2].includes(g.part)){field.append(makeButton('Nghe câu hỏi & lựa chọn',()=>speak(groupAudio(g,q)),'text-button'));if(review&&q.audio)field.append(node('p','',q.audio));}
      for(let option=0;option<q.options.length;option++){
        const label=node('label',`toeic-choice${review&&option===q.answer?' correct':''}${review&&option===q.selected&&option!==q.answer?' incorrect':''}`);const input=node('input');input.type='radio';input.name=`toeic-answer-${i}`;input.value=option;input.checked=review?q.selected===option:answers[i]===option;input.disabled=review||pending;
        input.addEventListener('change',()=>{answers[i]=option;try{sessionStorage.setItem(`noi-toeic:${draftId}`,JSON.stringify(answers));}catch{}$('#toeicAnswered').textContent=`${answers.filter(a=>a!==null).length}/${answers.length} câu đã chọn`;});
        label.append(input,node('span','',`${String.fromCharCode(65+option)}${review||g.part>2?'. '+q.options[option]:''}`));field.append(label);
      }
      if(review){const feedback=node('div','toeic-explanation');feedback.append(node('strong','',q.selected===q.answer?'Đúng':q.selected===null?'Chưa trả lời':`Chưa đúng · đáp án ${String.fromCharCode(65+q.answer)}`),node('p','',q.explanation));field.append(feedback);}group.append(field);
    }root.append(group);
  }}
  function attempt(){const a=course().active;if(!a){screen='overview';overview();return;}readDraft(a);root.append(makeButton('← Về lộ trình (giữ bài đang làm)',()=>switchScreen('overview'),'text-button'),title(a.kind==='diagnostic'?'Khảo sát kỹ năng TOEIC':a.kind==='mistakes'?'Làm lại câu sai':'Bài luyện theo Part'),node('p','toeic-note','Nghe bằng giọng tổng hợp của trình duyệt, chưa mô phỏng giọng đọc đa dạng và nhịp phát của bài thi thật. Có thể nghe lại khi luyện.'));
    const status=node('div','toeic-attempt-status');const answered=node('strong','',`${answers.filter(v=>v!==null).length}/${answers.length} câu đã chọn`);answered.id='toeicAnswered';answered.setAttribute('role','status');status.append(answered,node('span','','Lựa chọn tạm lưu trong tab này; kết quả đã nộp lưu vào hồ sơ.'));root.append(status);renderGroups(a.groups);
    const submit=makeButton('Nộp bài & xem giải thích',async()=>{
      if(answers.some(v=>v===null)&&!confirm('Bạn còn câu chưa trả lời. Vẫn nộp bài?'))return;stopAudio();
      const response=await request({action:'submit',attemptId:a.id,answers,assisted:shownTranscript});if(response?.result){result=response.result;try{sessionStorage.removeItem(`noi-toeic:${draftId}`);}catch{}draftId=null;screen='result';render();jump();}
    },'button primary');root.append(submit);
  }
  function resultView(){if(!result){screen='history';historyView();return;}root.append(title('Hiểu lỗi rồi mới chuyển bài'),node('p','toeic-result-score',`${result.correct}/${result.total} câu đúng`),node('p','toeic-note',`${result.assisted?'Có mở transcript hỗ trợ. ':''}Đây là kết quả bài tự biên soạn, không quy đổi sang thang 10–990.`));
    const split=node('div','toeic-skill-results');for(const [name,filter] of [['Listening',p=>p.part<=4],['Reading',p=>p.part>=5]]){const parts=result.parts.filter(filter);if(!parts.length)continue;const row=node('div');row.append(node('strong','',name),node('span','',`${parts.reduce((n,p)=>n+p.correct,0)}/${parts.reduce((n,p)=>n+p.total,0)} câu đúng`));split.append(row);}root.append(split);
    const actions=node('div','toeic-actions');actions.append(makeButton('Về lộ trình',()=>switchScreen('overview'),'button primary'),makeButton('Luyện lại câu còn sai',()=>start('mistakes')));root.append(actions);renderGroups(result.groups,true);}
  function historyView(){const c=course();root.append(title('Kết quả & câu cần củng cố'));nav();root.append(node('p','',`${c.mistakeCount} câu có lượt làm gần nhất chưa đúng. Làm lại để kiểm tra cách hiểu, thay vì chỉ nhớ đáp án.`));const retry=makeButton('Làm lại câu sai',()=>start('mistakes'),'button primary');retry.disabled=pending||!c.mistakeCount;root.append(retry);
    const scores=node('div','toeic-skill-results');for(const p of c.parts){const line=node('div');line.append(node('strong','',`Part ${p.part} · ${p.title}`),node('span','',p.latest?`${p.latest.correct}/${p.latest.total}`:'Chưa làm'));scores.append(line);}root.append(scores,node('h2','toeic-section-title','12 lượt nộp gần nhất'));
    if(!c.history.length)root.append(node('p','toeic-note','Chưa có bài nộp. Làm khảo sát hoặc chọn một bài theo Part để bắt đầu.'));
    for(const a of c.history){const row=node('div','toeic-history-row');row.append(node('span','',`${a.kind==='diagnostic'?'Khảo sát':a.kind==='mistakes'?'Ôn câu sai':c.lessons.find(l=>l.id===a.lessonId)?.title||'Bài luyện'} · ${new Date(a.at).toLocaleString('vi-VN')}`),node('strong','',`${a.correct}/${a.total}`),makeButton('Xem chữa bài',async()=>{const response=await request({action:'result',attemptId:a.id});if(response?.result){result=response.result;screen='result';render();jump();}},'text-button'));root.append(row);}
  }
  function format(){const box=node('details','toeic-format');box.append(node('summary','','Cấu trúc thi thật và giới hạn của thư viện này'));const text=node('p','','TOEIC Listening & Reading: 200 câu. Listening 100 câu / khoảng 45 phút; Reading 100 câu / 75 phút. Thư viện hiện có 14 bài học ngắn, '+course().questionCount+' câu gốc để làm quen; chưa có đề mô phỏng đủ 200 câu hoặc bài nghe giọng người thật.');box.append(text);const list=node('ul');course().parts.forEach(p=>list.append(node('li','',`Part ${p.part} · ${p.title}: ${p.count} câu trong đề thật`)));box.append(list,link('Cấu trúc chính thức từ IIG Việt Nam','https://iigvietnam.com/bai-thi-toeic/'));root.append(box);}
  function render(){if(!data?.learning?.toeicCourse)return;root.replaceChildren();({overview,parts:partList,lesson,attempt,result:resultView,history:historyView}[screen]||overview)();root.querySelectorAll('h1').forEach(h=>h.tabIndex=-1);}
  const entry=node('div','toeic-home-entry');entry.append(node('div','','Bạn đang luyện để thi? Học theo Part và theo dõi Listening / Reading riêng.'),makeButton('Mở lộ trình TOEIC →',()=>showView('toeic'),'button primary'));$('#view-plan > .page-heading').after(entry);
  window.noiToeic={update(value){data=value;if(activeView==='toeic')render();},open(){render();},leave:stopAudio};
  if(typeof snapshot!=='undefined'&&snapshot){data=snapshot;if(activeView==='toeic')render();}
})();
