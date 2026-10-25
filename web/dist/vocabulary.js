/* Vocabulary is one set, practised in several contexts, with server-saved progress. */
(() => {
  const root=document.querySelector('#vocabularyRoot');
  const openOptions={};
  let turning=false, lastScreen='', deckFinished=false, libraryCategory='all';
  const reduceMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function turnCard(){
    if(turning||pending)return;
    const card=root.querySelector('.v-flashcard');
    if(!card)return;
    if(reduceMotion()||!card.animate){flipped=!flipped;render();return;}
    turning=true;
    const focused=document.activeElement?.classList.contains('v-turn-trigger')?'.v-turn-trigger':'.v-flip';
    const restoreFocus=card.contains(document.activeElement);
    card.classList.add('is-turning');
    try{
      await card.animate([{transform:'perspective(1200px) rotateY(0deg)'},{transform:'perspective(1200px) rotateY(90deg)'}],{duration:140,easing:'ease-in',fill:'forwards'}).finished;
      if(!card.isConnected)return;
      flipped=!flipped;render();
      const next=root.querySelector('.v-flashcard');
      next.classList.add('is-turning');
      if(restoreFocus)next.querySelector(focused)?.focus({preventScroll:true});
      await next.animate([{transform:'perspective(1200px) rotateY(-90deg)'},{transform:'perspective(1200px) rotateY(0deg)'}],{duration:180,easing:'ease-out'}).finished;
      next.classList.remove('is-turning');
    }finally{turning=false;}
  }
  let data, setId=null, mode='cards', index=0, flipped=false, filter='all', sort='original', words=[], queue=[], round=[], feedback=null, readingIndex=0, readingResult=null, pending=false, timer, pendingDraft, draftQueue=Promise.resolve();
  let showDefinitions=true, learnKind='write', acceptSynonyms=false, exampleMode=false, speed=.9, voice='', query='', readingDraft={answers:[],choices:[]}, initialized=false, readingLevel='A2';
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const button=(text,fn,cls='button secondary')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  const findSet=()=>data?.sets.find(s=>s.id===setId);
  function updateUrl(){const url=new URL(location.href);if(setId){url.searchParams.set('set',setId);url.searchParams.set('mode',mode);}else{url.searchParams.delete('set');url.searchParams.delete('mode');}history.replaceState(null,'',url.pathname+url.search+url.hash);}
  const progress=w=>data.progress[`${setId}:${w.id}`]||{};
  const status=w=>progress(w).status==='mastered'?'Đã nhớ':progress(w).reviews?'Đang học':'Chưa học';
  const shuffled=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const select=(label,items,value,change)=>{const wrap=el('label','v-select');wrap.append(el('span','',label));const s=el('select');s.setAttribute('aria-label',label);for(const [val,text]of items){const o=el('option','',text);o.value=val;s.append(o);}s.value=value;s.addEventListener('change',()=>change(s.value));wrap.append(s);return wrap;};
  const toggle=(label,checked,change)=>{const l=el('label','v-toggle'),i=el('input');i.type='checkbox';i.checked=checked;i.addEventListener('change',()=>change(i.checked));l.append(i,document.createTextNode(label));return l;};
  const plainSentence=(set,text)=>text.replace(/\[\[([^\]]+)\]\]/g,(_,id)=>set.words.find(w=>w.id===id)?.term||'');
  const note=text=>el('p','subtle',text);
  function currentWords(){
    const set=findSet();if(!set)return [];
    let list=set.words.filter(w=>filter==='all'||filter==='starred'&&progress(w).starred||filter==='weak'&&progress(w).status!=='mastered'||filter==='due'&&progress(w).reviews&&progress(w).dueAt<=Date.now());
    if(sort==='shuffle')list=shuffled(list);
    if(sort==='starred')list.sort((a,b)=>Number(!!progress(b).starred)-Number(!!progress(a).starred));
    if(sort==='new')list.sort((a,b)=>(progress(a).reviews||0)-(progress(b).reviews||0));
    return list;
  }
  async function mutate(body){
    const res=await api('vocabulary',{setId,...body});
    snapshot=res;data=res.learning.vocabulary;
    return res.result;
  }
  async function action(body,after){
    if(pending)return;flushDraft();pending=true;root.setAttribute('aria-busy','true');root.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);
    if(body.action==='generate')document.querySelector('#vModePanel')?.prepend(el('p','notice','Đang viết bài mới từ bộ từ của bạn… Có thể mất khoảng một phút.'));
    try{await draftQueue;const result=await mutate(body);after?.(result);}
    catch(error){toast(error.message,true);}
    finally{pending=false;root.setAttribute('aria-busy','false');render();}
  }
  function saveDraft(){
    clearTimeout(timer);const sid=setId, which=mode;
    const draft=mode==='reading'?{index:readingIndex,...readingDraft}:mode==='learn'||mode==='dictation'?{queue:queue.map(w=>w.id),index,round,kind:learnKind,example:exampleMode}:null;
    if(!draft)return;
    pendingDraft={setId:sid,action:'draft',mode:which,draft:JSON.parse(JSON.stringify(draft))};
    timer=setTimeout(flushDraft,1200);
  }
  function flushDraft(){
    if(!pendingDraft)return;clearTimeout(timer);timer=null;
    const payload=pendingDraft;pendingDraft=null;
    draftQueue=draftQueue.catch(()=>{}).then(async()=>{try{const r=await api('vocabulary',payload);data=r.learning.vocabulary;snapshot.learning.vocabulary=data;}catch{toast('Chưa lưu được bài đang làm. Giữ trang mở và thử lại nhé.',true);}});
  }
  function chooseSet(id){flushDraft();deckFinished=false;setId=id;mode='cards';filter='all';sort='original';index=0;flipped=false;words=currentWords();updateUrl();render();window.scrollTo({top:0});draftQueue=draftQueue.catch(()=>{}).then(()=>api('vocabulary',{setId:id,action:'select'})).catch(e=>toast(e.message,true));}
  function switchMode(value){
    if(pending)return;flushDraft();deckFinished=false;mode=value;index=0;flipped=false;feedback=null;readingResult=null;
    if(speechSynthesisSupported())window.speechSynthesis.cancel();
    const draft=data.drafts[`${setId}:${mode}`];
    if(mode==='reading'){readingIndex=draft?.index??0;readingDraft={answers:[...(draft?.answers||[])],choices:[...(draft?.choices||[])]};}
    if(mode==='cards')words=currentWords();
    if(mode==='learn'||mode==='dictation'){
      queue=currentWords();round=[];
      if(draft?.queue?.length){queue=draft.queue.map(id=>findSet().words.find(w=>w.id===id)).filter(Boolean);index=Math.min(draft.index||0,queue.length);round=Array.isArray(draft.round)?draft.round:[];learnKind=draft.kind||'write';exampleMode=!!draft.example;}
    }
    updateUrl();render();window.scrollTo({top:0});
  }
  function renderLibrary(){
    lastScreen='';delete root.dataset.wordKey;root.dataset.mode='library';delete root.dataset.topic;
    const coverFor=s=>({ 'keep-talking':'story','clarify-meaning':'listening','ask-directions':'city',directions:'city',shopping:'shopping','return-item':'shopping','shopping-choices':'shopping','purchasing':'shopping','food-market':'food','restaurant-requests':'food','business-travel':'airport','future-plans':'airport','make-plans':'calendar',meetings:'calendar','weather-plans':'calendar','tell-a-story':'story','weekend-story':'story','job-story':'story','email-requests':'story'}[s.id]||({directions:'city',shopping:'shopping',meeting:'calendar','daily-routine':'calendar',opinions:'story'}[s.topic])||s.topic);
    const cover=s=>{const img=lessonArt(s.topic,'v-cover-art');const scene=coverFor(s);const art=({city:'travel-cartoon',airport:'travel-cartoon',shopping:'work-cartoon',calendar:'study-cartoon',food:'conversation-cartoon',story:'conversation-cartoon',listening:'study-cartoon'})[scene];if(art)img.src='/art/'+art+'.webp';img.style.backgroundColor=({city:'#e8f0eb',shopping:'#f7eddf',airport:'#e8f0f7',calendar:'#ececf5',food:'#f6efdf',story:'#f2e9e6',smalltalk:'#f5eedb',cafe:'#e8efdc',travel:'#e5eef5',interview:'#e9e8f0',listening:'#e5eff3'})[scene]||'#f0f4e8';img.loading='lazy';return img;};
    const total=data.sets.reduce((n,s)=>n+s.words.length,0),mastered=Object.values(data.progress).filter(w=>w.status==='mastered').length;
    const heading=el('header','v-library-heading'),title=el(activeView==='vocabulary'?'h1':'h2','','Học để dùng được.');title.id='vocabularyTitle';title.dataset.screenTitle='';const headingCopy=el('div','v-heading-copy');headingCopy.append(el('span','v-library-eyebrow','TỪ VỰNG & MẪU CÂU'),title,note('Gặp một từ mới. Nghe cách nói. Mang vào câu chuyện của bạn.'));const memory=el('div','v-memory-count');memory.append(el('strong','',String(mastered)),el('span','',`/ ${total} từ & mẫu câu đã nhớ`));heading.append(headingCopy,memory);root.append(heading);
    const recent=data.sets.find(s=>s.id===data.selectedSet)||data.sets.find(s=>s.track==='speaking')||data.sets[0];
    const resume=el('section','v-resume v-featured-deck');const resumeText=el('div','v-featured-copy');const recentReviewed=recent.words.filter(w=>(data.progress[recent.id+':'+w.id]?.reviews||0)>0).length;resumeText.append(el('span','v-resume-label','BỘ TỪ ĐANG CHỌN'),el('h2','',recent.title),el('p','v-featured-description',recent.description),el('span','v-featured-meta',`${recent.level} · ${recent.words.length} ${recent.track==='speaking'?'mẫu câu':'từ vựng'} · ${recentReviewed} đã ôn`),button(recentReviewed?'Tiếp tục học':'Bắt đầu bộ này',()=>chooseSet(recent.id),'button primary'));resume.append(resumeText,cover(recent));root.append(resume);
    const controls=el('div','v-browse-controls'),categories=el('div','v-library-categories');categories.setAttribute('aria-label','Nhóm bài học');
    for(const[key,label]of [['all','Tất cả'],['speaking','Giao tiếp'],['listening','Luyện nghe'],['foundation','Nền tảng'],['toeic','TOEIC']]){const b=button(label,()=>{libraryCategory=key;render();},'v-category');b.setAttribute('aria-pressed',String(libraryCategory===key));categories.append(b);}
    const search=el('input','v-search');search.type='search';search.placeholder='Tìm bài học…';search.setAttribute('aria-label','Tìm bài học hoặc mẫu câu');search.value=query;controls.append(categories,search);root.append(controls);
    const resultsHeading=el('div','v-results-heading'),resultsTitle=el('h2','','Khám phá bộ từ'),resultsCount=el('span','v-results-count');resultsCount.setAttribute('role','status');resultsHeading.append(resultsTitle,resultsCount);root.append(resultsHeading);const list=el('div','v-set-list'),more=button('Xem thêm bài học',()=>{limit+=8;draw();},'button secondary v-more');let limit=8;
    const draw=()=>{list.replaceChildren();const entries=[];const sets=[...data.sets].sort((a,b)=>Number(b.track==='speaking')-Number(a.track==='speaking'));
      for(const s of sets){const category=s.track==='speaking'?'speaking':s.lesson?(s.title.startsWith('TOEIC')?'toeic':'foundation'):'speaking';if(libraryCategory!=='all'&&libraryCategory!=='listening'&&category!==libraryCategory)continue;
        if(libraryCategory==='listening')s.readings.forEach((r,i)=>{if(r.listening)entries.push({set:s,reading:r,index:i,title:r.title});});else entries.push({set:s,title:s.title});}
      const filtered=entries.filter(e=>(e.title+' '+e.set.description+' '+e.set.words.map(w=>w.term+' '+w.meaning).join(' ')).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
      resultsCount.textContent=`${filtered.length} ${libraryCategory==='listening'?'bài nghe':'bộ học'}`;
      if(!filtered.length)list.append(note('Chưa có bài phù hợp. Thử từ khóa khác nhé.'));
      for(const entry of filtered.slice(0,limit)){const s=entry.set;const item=button('',()=>{chooseSet(s.id);if(entry.reading){switchMode('reading');readingIndex=entry.index;readingResult=null;readingDraft={answers:[],choices:[]};render();}},'v-set-row');item.dataset.topic=s.id;const img=cover(s);if(entry.reading){img.src='/art/study-cartoon.webp';img.style.backgroundColor='#e5eff3';}item.append(img);const info=el('div','v-set-info');info.append(el('span','v-set-level',s.level+' · '+(entry.reading?'Nghe hiểu':s.track==='speaking'?s.words.length+' mẫu câu':s.words.length+' từ vựng')),el('h2','',entry.title),el('p','v-deck-description',entry.reading?'Nghe trong ngữ cảnh, trả lời câu hỏi và xem lại nội dung.':s.description));const meta=el('div','v-set-meta');const count=s.words.filter(w=>(data.progress[s.id+':'+w.id]?.reviews||0)>0).length;meta.append(el('span','',entry.reading?entry.reading.questions.length+' câu hỏi':count+'/'+s.words.length+' đã ôn'),el('span','v-set-start','Học ngay ↗'));if(!entry.reading){const track=el('div','v-deck-progress');track.setAttribute('aria-hidden','true');const fill=el('span');fill.style.width=(count/s.words.length*100)+'%';track.append(fill);info.append(track);}info.append(meta);item.append(info);list.append(item);}
      more.hidden=filtered.length<=limit;};
    search.addEventListener('input',()=>{query=search.value;limit=8;draw();});root.append(list,more);draw();
    if(libraryCategory==='listening'){const sources=el('details','v-listening-sources');sources.append(el('summary','','Nguồn nghe & thông tin audio'),note('Bài luyện trong web dùng giọng tổng hợp của trình duyệt.'));const link=el('a','','Đề mẫu và audio chính thức ETS Global →');link.href='https://www.etsglobal.org/gp/en/test-type-family/toeic-listening-and-reading-test';link.target='_blank';link.rel='noopener noreferrer';sources.append(link);root.append(sources);}
  }
  function practiceSet(set){
    if(snapshot.session.active&&snapshot.session.turns>0&&!confirm('Bắt đầu tình huống mới với bộ từ này? Buổi hiện tại sẽ được lưu.'))return;
    setId=set.id;action({action:'use'},()=>startSession(set.topic,true));
  }
  function render(){
    if(!data)return;root.replaceChildren();if(!setId)return renderLibrary();const set=findSet();if(!set){setId=null;return renderLibrary();}
    root.dataset.mode=mode;root.dataset.topic=set.id;
    const back=button('← Tất cả bộ từ',()=>{flushDraft();setId=null;updateUrl();render();},'text-button');root.append(back);
    const header=el('div','page-heading v-heading'),title=el(activeView==='vocabulary'?'h1':'h2','',set.title);title.id='vocabularyTitle';title.dataset.screenTitle='';header.append(lessonArt(set.topic,'v-title-art'),title,button('Thử nói cùng AI',()=>practiceSet(set),'button secondary'));root.append(header);
    if(set.lesson){const lesson=el('details','v-lesson');lesson.open=!!openOptions['lesson:'+setId];lesson.addEventListener('toggle',()=>openOptions['lesson:'+setId]=lesson.open);lesson.append(el('summary','', 'Bài giảng · '+set.lesson.title));const body=el('div','v-lesson-body');body.append(note(set.lesson.explain),el('blockquote','',set.lesson.pattern),el('p','v-lesson-tip',set.lesson.trap));if(set.lesson.checks?.length){const practice=el('div','v-lesson-check');practice.append(el('h3','','Thử ngay'));for(const q of set.lesson.checks){const field=el('fieldset');field.append(el('legend','',q.prompt));const choices=el('div','v-lesson-choices');const result=el('p','v-check-result');result.setAttribute('role','status');q.options.forEach((label,n)=>{const b=button(label,()=>{choices.querySelectorAll('button').forEach((choice,i)=>{choice.disabled=true;choice.classList.toggle('correct',i===q.answer);choice.classList.toggle('incorrect',i===n&&n!==q.answer);});result.textContent=(n===q.answer?'Đúng rồi! ':'Mình xem lại nhé. ')+q.explanation;},'v-lesson-choice');choices.append(b);});field.append(choices,result);practice.append(field);}body.append(practice);}if(set.lesson.speaking){const task=el('div','v-speaking-task');task.append(el('h3','','Đến lượt bạn nói'),note(set.lesson.speaking.task));const steps=el('div','v-speaking-actions');steps.append(button('1. Ôn mẫu câu',()=>switchMode('cards'),'button secondary'),button('2. Nghe hội thoại',()=>{switchMode('reading');readingIndex=0;readingResult=null;readingDraft={answers:[],choices:[]};render();},'button secondary'),button('3. Thử nói cùng AI',()=>practiceSet(set),'button primary'));task.append(steps,note('Tự kiểm tra: mình đã truyền đạt đủ ý, thêm chi tiết thật và hỏi lại chưa? Micro chuyển giọng nói thành chữ; chưa chấm phát âm.'));body.append(task);}lesson.append(body);root.append(lesson);}const counts=set.words.filter(w=>progress(w).status==='mastered').length;
    const setSummary=note(`${set.words.length} ${set.track==='speaking'?'mẫu câu':'từ vựng'} · ${set.level} · ${counts} đã nhớ`);setSummary.classList.add('v-set-summary');root.append(setSummary);
    const tabs=el('div','v-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Cách học bộ từ');
    for(const[key,label]of [['cards','Thẻ từ'],['learn','Luyện nhớ'],['reading','Đọc điền khuyết'],['dictation','Nghe chép']]){const b=button(label,()=>switchMode(key),'v-tab');b.setAttribute('role','tab');b.setAttribute('aria-selected',String(mode===key));b.setAttribute('aria-controls','vModePanel');b.id=`vTab-${key}`;b.tabIndex=mode===key?0:-1;tabs.append(b);}
    tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const modes=['cards','learn','reading','dictation'];const n=event.key==='Home'?0:event.key==='End'?3:(modes.indexOf(mode)+(event.key==='ArrowRight'?1:3))%4;switchMode(modes[n]);document.querySelector(`#vTab-${mode}`).focus();});root.append(tabs);
    const panel=el('div','v-mode');const screen=`${setId}:${mode}`;if(lastScreen!==screen)panel.classList.add('v-mode-enter');lastScreen=screen;panel.id='vModePanel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',`vTab-${mode}`);root.append(panel);
    if(mode==='reading')renderReading(panel);else if(mode==='cards')renderCards(panel);else renderRecall(panel);
  }
  function filters(parent){const row=el('div','v-filters');row.append(select('Lọc từ',[['all','Tất cả'],['starred','Đánh dấu sao'],['weak','Chưa nhớ'],['due','Đến hạn ôn']],filter,v=>{filter=v;words=currentWords();queue=[...words];index=0;round=[];feedback=null;render();}),select('Thứ tự',[['original','Theo bộ từ'],['shuffle','Xáo trộn'],['starred','Có sao trước'],['new','Chưa học trước']],sort,v=>{sort=v;words=currentWords();queue=[...words];index=0;round=[];feedback=null;render();}));parent.append(row);}
  function empty(parent){parent.append(el('div','empty-state','Chưa có từ phù hợp bộ lọc này. Chọn “Tất cả” để tiếp tục.'));}
  function renderCards(panel){
    if(deckFinished){
      const finish=el('section','v-deck-finish');finish.setAttribute('role','status');const set=findSet(),count=set.words.filter(word=>progress(word).status==='mastered').length;
      finish.append(lessonArt('companion','v-finish-art'),el('span','v-finish-label','Đến cuối bộ thẻ rồi!'),el('h2','','Thêm một chút tự tin.'),note(`Bạn đã nhớ ${count}/${set.words.length} từ trong bộ này. Thử dùng chúng trong một câu chuyện nhé.`));
      const actions=el('div','v-finish-actions');actions.append(button('Đọc & áp dụng →',()=>switchMode('reading'),'button primary'),button('Xem lại bộ thẻ',()=>{deckFinished=false;index=0;flipped=false;render();}));finish.append(actions);panel.append(finish);return;
    }
    if(!words.length)words=currentWords();if(!words.length){filters(panel);return empty(panel);}index=Math.min(index,words.length-1);const w=words[index],p=progress(w);
    const tools=el('div','v-deck-tools'),trail=el('div','v-deck-trail');trail.setAttribute('aria-label',`Vị trí thẻ ${index+1} trong ${words.length}`);for(let i=0;i<words.length;i++){const dot=el('span',`v-deck-dot${i===index?' current':i<index?' passed':''}`);dot.setAttribute('aria-hidden','true');trail.append(dot);}trail.append(el('span','v-deck-count',`${index+1} / ${words.length}`));
    const options=el('details','v-deck-options');options.append(el('summary','','Tùy chọn thẻ'));filters(options);options.open=!!openOptions.cards;options.addEventListener('toggle',()=>openOptions.cards=options.open);tools.append(trail,options);panel.append(tools);
    const layout=el('div','v-card-layout'),card=el('article','v-flashcard');card.classList.toggle('is-flipped',flipped);card.setAttribute('aria-label',`Thẻ từ ${index+1} trong ${words.length}`);
    const wordKey=`${setId}:${w.id}`;if(root.dataset.wordKey!==wordKey)card.classList.add('v-word-enter');root.dataset.wordKey=wordKey;
    const top=el('div','v-card-top');top.append(el('span','v-word-status',status(w)));const star=button('',()=>action({action:'star',wordId:w.id,starred:!p.starred}),'v-star');star.append(icon('star'));star.setAttribute('aria-label',p.starred?'Bỏ đánh dấu sao':'Đánh dấu sao');star.setAttribute('aria-pressed',String(!!p.starred));top.append(star);card.append(top);
    if(!flipped)card.append(lessonArt(findSet().topic,'v-deck-art'));
    else card.append(el('span','v-meaning-label',w.term));
    const flip=button('',turnCard,'v-flip');flip.setAttribute('aria-label',flipped?'Xem mặt từ tiếng Anh':'Lật thẻ xem nghĩa');flip.append(el('h2','',flipped?w.meaning:w.term),el('span','subtle',flipped?w.type:`${w.ipa} · ${w.type}`));card.append(flip);
    const audio=button('Nghe phát âm',()=>speak(w.term),'listen-button v-pronounce');audio.prepend(icon('sound'));card.append(audio);
    if(flipped){const example=el('div','v-example-box');example.append(el('span','v-example-label','Trong một câu chuyện'),el('p','v-example',w.example),note(w.translation));card.append(example);if(w.synonyms.length)card.append(el('p','v-synonyms',`Cũng có thể nói: ${w.synonyms.join(', ')}`));
      const rate=rating=>action({action:'review',wordId:w.id,rating},()=>{if(index===words.length-1)deckFinished=true;else move(1);});
      const ratings=el('div','v-rating');ratings.append(button('Cần ôn lại',()=>rate('again')),button('Đã nhớ ✓',()=>rate('good'),'button primary'));card.append(ratings,button('↶ Xem lại từ',turnCard,'text-button v-turn-trigger'));
    }else{card.append(el('p','v-flip-hint','Bạn nhớ từ này có nghĩa gì không?'),button('Lật thẻ xem nghĩa',turnCard,'button primary v-turn-trigger'));}
    const deck=el('div','v-deck');deck.append(card);const nav=el('div','v-card-nav');const prev=button('← Trước',()=>move(-1),'text-button');prev.disabled=index===0;const next=button('Tiếp →',()=>move(1),'text-button');next.disabled=index===words.length-1;nav.append(prev,el('span','v-nav-hint','Theo nhịp của bạn'),next);deck.append(nav);layout.append(deck);
    const aside=el('aside','v-next v-context-note');aside.append(el('span','v-context-eyebrow','HỌC TRONG NGỮ CẢNH'),el('h2','','Từ này dùng thế nào?'));const context=el('details','v-context-example');context.append(el('summary','','Mở câu ví dụ'),el('p','v-context-english',w.example),note(w.translation),button('Nghe cả câu',()=>speak(w.example),'listen-button'));aside.append(context);const nextSteps=el('div','v-next-steps');nextSteps.append(el('h3','','Khi bạn đã sẵn sàng'),button('Đọc & điền từ →',()=>switchMode('reading'),'text-button'),button('Nghe và viết lại →',()=>switchMode('dictation'),'text-button'));aside.append(nextSteps,note('Chọn “Đã nhớ” sau khi tự nhớ lại nghĩa. Những từ cần luyện thêm sẽ trở lại để ôn.'));layout.append(aside);panel.append(layout);
    const list=el('div','v-word-list');list.append(el('h2','','Từ trong bộ này'));for(const word of words){const row=el('details','v-word-row');const summary=el('summary');summary.append(el('strong','',word.term),el('span','',word.meaning),el('small','',status(word)));const content=el('div');content.append(note(`${word.type} · ${word.ipa}`),el('p','',word.example),note(word.translation),button('Nghe ví dụ',()=>speak(word.example),'listen-button'));row.append(summary,content);list.append(row);}panel.append(list);
  }
  function move(delta){index=Math.max(0,Math.min(words.length-1,index+delta));flipped=false;render();}
  function recallFeedback(parent,w){
    if(!feedback)return;const box=el('div',`v-feedback ${feedback.correct?'correct':'incorrect'}`);box.setAttribute('role','status');box.append(el('strong','',feedback.correct?'Chính xác.':'Mình ôn lại câu này nhé.'),el('p','',feedback.answer),note(feedback.explanation));parent.append(box);
    parent.append(button(index===queue.length-1?'Xem kết quả':'Câu tiếp theo →',()=>{round.push({id:w.id,correct:feedback.correct});index++;feedback=null;saveDraft();render();},'button primary'));
  }
  function renderRecall(panel){
    filters(panel);const settings=el('details','v-options');settings.append(el('summary','','Tuỳ chọn bài học'));
    if(mode==='learn')settings.append(select('Dạng câu hỏi',[['write','Tự gõ từ tiếng Anh'],['choice','Trắc nghiệm 4 đáp án']],learnKind,v=>{learnKind=v;feedback=null;render();}),toggle('Chấp nhận từ gần nghĩa đã có trong bộ',acceptSynonyms,v=>acceptSynonyms=v));
    else {settings.append(toggle('Nghe chép cả câu ví dụ',exampleMode,v=>{exampleMode=v;feedback=null;render();}),select('Tốc độ đọc',[['0.65','Chậm · 0.65×'],['0.9','Vừa · 0.9×'],['1','Bình thường · 1×']],String(speed),v=>speed=Number(v)));const voices=speechSynthesisSupported()?window.speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang)):[];if(voices.length)settings.append(select('Giọng đọc',[['','Giọng tiếng Anh mặc định'],...voices.map(v=>[v.name,`${v.name} · ${v.lang}`])],voice,v=>voice=v));}
    settings.open=!!openOptions[mode];settings.addEventListener('toggle',()=>openOptions[mode]=settings.open);panel.append(settings);
    if(!queue.length)return empty(panel);
    if(index>=queue.length){const correct=round.filter(a=>a.correct).length;const finish=el('article','v-recall-card');finish.append(el('h2','','Đã hoàn thành lượt học'),el('p','v-score',`${correct} / ${round.length} câu đúng`),note('Từ chưa đúng đã được đưa vào lịch ôn sớm hơn.'));
      const wrong=queue.filter(w=>round.some(r=>r.id===w.id&&!r.correct));if(wrong.length)finish.append(button(`Ôn lại ${wrong.length} từ chưa đúng`,()=>{queue=wrong;round=[];index=0;feedback=null;saveDraft();render();},'button primary'));
      finish.append(button('Học lại toàn bộ',()=>{queue=currentWords();round=[];index=0;feedback=null;saveDraft();render();},'button secondary'),button('Áp dụng trong bài đọc →',()=>switchMode('reading'),'text-button'));panel.append(finish);return;}
    const w=queue[index],card=el('article','v-recall-card');card.append(lessonArt(mode==='dictation'?'listening':'companion','v-recall-art'),note(`${mode==='learn'?'Luyện nhớ':'Nghe chép'} · ${index+1}/${queue.length}`));
    if(mode==='learn'){card.append(el('h2','',w.meaning),note('Từ hoặc cụm từ tiếng Anh nào diễn đạt ý này?'));}
    else {card.append(el('h2','',exampleMode?'Nghe rồi viết lại câu':'Nghe rồi viết lại từ'));const audio=button('Phát âm thanh',()=>dictate(w),'button secondary');audio.prepend(icon('sound'));card.append(audio,note('Nhấn nghe để bắt đầu. Ctrl hoặc ⌘ + Enter để nghe lại.'));}
    if(!feedback){const submit=answer=>action({action:'answer',mode,wordId:w.id,answer,example:exampleMode,synonyms:acceptSynonyms},result=>{feedback=result;saveDraft();});
      if(mode==='learn'&&learnKind==='choice'){const options=shuffled([w,...shuffled(findSet().words.filter(o=>o.id!==w.id)).slice(0,3)]);const choices=el('div','v-choices');for(const option of options)choices.append(button(option.term,()=>submit(option.term),'v-choice'));card.append(choices);}
      else {const form=el('form','v-answer-form');const input=el(mode==='dictation'&&exampleMode?'textarea':'input');input.setAttribute('aria-label',mode==='learn'?'Từ tiếng Anh':'Nội dung bạn nghe được');input.autocomplete='off';input.spellcheck=false;input.maxLength=600;if(input.tagName==='INPUT')input.type='text';input.placeholder=mode==='learn'?'Nhập từ tiếng Anh…':'Nhập nội dung bạn nghe được…';const check=el('button','button primary','Kiểm tra');check.type='submit';check.disabled=true;input.addEventListener('input',()=>check.disabled=!input.value.trim());form.addEventListener('submit',e=>{e.preventDefault();if(input.value.trim())submit(input.value.trim());});form.append(input,check);card.append(form);}
      card.append(button('Mình chưa nhớ',()=>submit(''),'text-button'));
    }
    recallFeedback(card,w);panel.append(card);
  }
  function dictate(w){if(!speechSynthesisSupported())return toast('Trình duyệt chưa hỗ trợ giọng đọc. Hãy dùng Chrome hoặc Edge.',true);window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(exampleMode?w.example:w.term);u.lang='en-US';u.rate=speed;const selected=window.speechSynthesis.getVoices().find(v=>voice?v.name===voice:/^en[-_]US/i.test(v.lang));if(selected)u.voice=selected;u.onerror=()=>toast('Chưa phát được âm thanh. Thử lại nhé.',true);window.speechSynthesis.speak(u);}
  function readingComplete(){const count=findSet().readings[readingIndex].sentences.flatMap(([s])=>[...s.matchAll(/\[\[/g)]).length;return Array.from({length:count},(_,i)=>readingDraft.answers[i]?.trim()).every(Boolean)&&findSet().readings[readingIndex].questions.every((_,i)=>Number.isInteger(readingDraft.choices[i]));}
  const readingBankOrders=new Map();
  function readingWordBank(set,reading){
    const scope=JSON.stringify([set.id,readingIndex,reading.title]);
    const tokens=reading.sentences.flatMap(([sentence])=>[...sentence.matchAll(/\[\[([^\]]+)\]\]/g)].map(match=>set.words.find(word=>word.id===match[1])?.term||match[1]));
    if(!tokens.length)return null;
    if(!readingBankOrders.has(scope)){readingBankOrders.set(scope,shuffled(tokens.map((_,i)=>i)));if(readingBankOrders.size>80)readingBankOrders.delete(readingBankOrders.keys().next().value);}
    const clean=text=>String(text||'').trim().toLowerCase().replace(/[’‘]/g,"'");
    const used=new Set(),placements=tokens.map(()=>null);
    readingDraft.answers.forEach((answer,i)=>{if(i>=tokens.length)return;const token=tokens.findIndex((text,n)=>!used.has(n)&&clean(text)===clean(answer));if(token>=0){placements[i]=token;used.add(token);}});
    let selected=null,dragging=null;
    const slots=[],chips=[];
    const bank=el('aside','v-drag-bank');bank.setAttribute('aria-label','Ngân hàng từ kéo thả');
    const heading=el('div','v-bank-heading'),counter=el('span','v-bank-counter');heading.append(el('h2','','Ngân hàng từ'),counter);
    const instruction=note('Kéo từ vào ô trống. Hoặc chọn từ rồi chạm vào ô cần điền.');instruction.classList.add('v-bank-instruction');
    const list=el('div','v-bank-tokens');list.setAttribute('role','group');list.setAttribute('aria-label','Các từ để điền');
    const status=el('p','v-bank-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const clear=button('Trả tất cả từ về',()=>{if(pending||readingResult)return;readingDraft.answers=[];placements.fill(null);selected=null;sync();saveDraft();status.textContent='Đã trả các từ về ngân hàng. Các đáp án đọc hiểu được giữ lại.';},'text-button v-bank-reset');
    bank.append(heading,instruction,list,status,clear);
    function updateCheck(){const check=document.querySelector('#vCheckReading');if(check)check.disabled=pending||!readingComplete();}
    function sync(){
      const count=tokens.reduce((n,_,i)=>n+Number(!!readingDraft.answers[i]?.trim()),0);counter.textContent=`${count}/${tokens.length} đã điền`;
      for(const [token,chip]of chips){const at=placements.indexOf(token);chip.disabled=!!readingResult||pending||at>=0;chip.draggable=!chip.disabled;chip.classList.toggle('is-used',at>=0);chip.classList.toggle('is-selected',selected===token);chip.setAttribute('aria-pressed',String(selected===token));chip.setAttribute('aria-label',at>=0?`${tokens[token]}, đã đặt ở ô ${at+1}`:`Chọn từ ${tokens[token]}`);}
      slots.forEach((slot,i)=>{const answer=readingDraft.answers[i]||'';slot.textContent=answer||`(${i+1}) Chọn từ`;slot.classList.toggle('is-filled',!!answer);slot.classList.toggle('is-ready',selected!==null&&!readingResult);slot.draggable=!pending&&!readingResult&&placements[i]!==null;slot.disabled=!!readingResult||pending;slot.setAttribute('aria-label',`Ô ${i+1}${answer?`: ${answer}. Chọn để trả từ về.`:'. Chọn để đặt từ đang chọn.'}`);});
      clear.disabled=!!readingResult||pending||count===0;bank.classList.toggle('is-complete',count===tokens.length);
      status.textContent=readingResult?'Đã chấm bài. Xem đáp án trong đoạn đọc.':selected!==null?`Đã chọn “${tokens[selected]}”. Chọn ô muốn điền.`:count===tokens.length?'Đã điền đủ từ. Chọn các đáp án đọc hiểu rồi kiểm tra.':'Có thể kéo từ giữa các ô. Chạm ô đã điền để trả từ về.';
      updateCheck();
    }
    function place(token,index){
      if(pending||readingResult||!Number.isInteger(token)||token<0||token>=tokens.length)return;
      const source=placements.indexOf(token);
      if(source>=0&&source!==index){placements[source]=null;readingDraft.answers[source]='';}
      placements[index]=token;readingDraft.answers[index]=tokens[token];selected=null;sync();saveDraft();
      status.textContent=`Đã đặt “${tokens[token]}” vào ô ${index+1}.`;
    }
    function remove(index){if(pending||readingResult)return;const word=readingDraft.answers[index];placements[index]=null;readingDraft.answers[index]='';selected=null;sync();saveDraft();status.textContent=`Đã trả “${word}” về ngân hàng từ.`;}
    function startDrag(event,token){if(pending||readingResult||token===null){event.preventDefault();return;}dragging=token;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-noi-reading',JSON.stringify({scope,token}));bank.classList.add('is-dragging');slots.forEach(slot=>slot.classList.add('is-ready'));}
    function endDrag(){dragging=null;bank.classList.remove('is-dragging');slots.forEach(slot=>slot.classList.remove('is-over','is-ready'));sync();}
    function readDrag(event){try{const value=JSON.parse(event.dataTransfer.getData('application/x-noi-reading'));return value.scope===scope&&Number.isInteger(value.token)?value.token:null;}catch{return null;}}
    for(const token of readingBankOrders.get(scope)){
      const chip=button(tokens[token],()=>{if(pending||readingResult||placements.includes(token))return;selected=selected===token?null:token;sync();},'v-word-token');
      chip.addEventListener('dragstart',event=>startDrag(event,token));chip.addEventListener('dragend',endDrag);chips.push([token,chip]);list.append(chip);
    }
    bank.addEventListener('dragover',event=>{if(dragging===null||pending||readingResult)return;event.preventDefault();event.dataTransfer.dropEffect='move';bank.classList.add('is-over');});
    bank.addEventListener('dragleave',event=>{if(!bank.contains(event.relatedTarget))bank.classList.remove('is-over');});
    bank.addEventListener('drop',event=>{if(pending||readingResult)return;const token=readDrag(event);if(token===null)return;event.preventDefault();const source=placements.indexOf(token);if(source>=0)remove(source);bank.classList.remove('is-over');endDrag();});
    bank.addEventListener('keydown',event=>{if(event.key==='Escape'){selected=null;sync();}});
    return {element:bank,sync,slot(index){
      const slot=button('',()=>{if(selected!==null)place(selected,index);else if(readingDraft.answers[index])remove(index);},'v-drop-slot');slot.id=`vDrop-${index}`;
      slot.addEventListener('dragstart',event=>startDrag(event,placements[index]));slot.addEventListener('dragend',endDrag);
      slot.addEventListener('dragover',event=>{if(dragging===null||pending||readingResult)return;event.preventDefault();event.dataTransfer.dropEffect='move';slot.classList.add('is-over');});
      slot.addEventListener('dragleave',()=>slot.classList.remove('is-over'));
      slot.addEventListener('drop',event=>{if(pending||readingResult)return;const token=readDrag(event);if(token===null)return;event.preventDefault();event.stopPropagation();place(token,index);endDrag();});
      slot.addEventListener('keydown',event=>{if(event.key==='Escape'){selected=null;sync();}if((event.key==='Delete'||event.key==='Backspace')&&readingDraft.answers[index]){event.preventDefault();remove(index);}});
      slots[index]=slot;return slot;
    }};
  }
  function renderReading(panel){
    const set=findSet(),reading=set.readings[readingIndex];const toolbar=el('div','v-reading-toolbar');toolbar.append(select('Bài đọc',set.readings.map((r,i)=>[String(i),`${i+1}. ${r.title} · ${r.level}`]),String(readingIndex),v=>{flushDraft();readingIndex=Number(v);readingResult=null;readingDraft={answers:[],choices:[]};render();saveDraft();}));
    const options=el('details','v-options');options.append(el('summary','','Tuỳ chọn'),toggle('Hiện gợi nghĩa dưới ô trống',showDefinitions,v=>{showDefinitions=v;render();}),select('Mức bài mới',[['A1','A1 · Mới bắt đầu'],['A2','A2 · Dễ'],['B1','B1 · Vừa'],['B2','B2 · Nâng cao'],['C1','C1 · Khó']],readingLevel,v=>readingLevel=v));
    const generate=button('Tạo bài mới bằng AI',()=>action({action:'generate',level:readingLevel},result=>{readingIndex=result.index;readingDraft={answers:[],choices:[]};readingResult=null;openOptions.reading=false;saveDraft();}),'button secondary');generate.disabled=!snapshot.configured||!snapshot.enabled||set.readings.length>=12;options.append(generate,note(`Bài mới dùng lại đủ ${set.words.length} từ trong bộ và được lưu để học tiếp.`));options.open=!!openOptions.reading;options.addEventListener('toggle',()=>openOptions.reading=options.open);toolbar.append(options);panel.append(toolbar);
    const wordBank=readingWordBank(set,reading);
    const article=el('article','v-reading');article.append(el('h2','',reading.title));const listen=button('Nghe cả bài',()=>{const text=reading.sentences.map(([s])=>plainSentence(set,s)).join(' ');if(!reading.listening)return speak(text);if(!speechSynthesisSupported())return toast('Trình duyệt chưa hỗ trợ giọng đọc. Hãy mở nguồn ETS bên dưới.',true);window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=speed;u.onerror=()=>toast('Chưa phát được bài nghe. Bạn thử lại nhé.',true);window.speechSynthesis.speak(u);},'listen-button');listen.prepend(icon('sound'));article.append(listen);
    let blank=0;
    for(const [sentence,translation]of reading.sentences){const section=el('div','v-sentence'),p=el('p','v-reading-text');p.lang='en';let last=0;const matches=[...sentence.matchAll(/\[\[([^\]]+)\]\]/g)];for(const match of matches){p.append(document.createTextNode(sentence.slice(last,match.index)));const n=blank++,w=set.words.find(w=>w.id===match[1]);const wrap=el('span','v-blank');const input=wordBank.slot(n);input.setAttribute('aria-describedby',`vBlank-${n}`);input.classList.toggle('correct',!!readingResult?.blanks[n]?.correct);input.classList.toggle('incorrect',!!readingResult&&!readingResult.blanks[n]?.correct);const hint=el('small','',showDefinitions?w.meaning:`Ô ${n+1}`);hint.id=`vBlank-${n}`;wrap.append(input,hint);if(readingResult&&!readingResult.blanks[n].correct)wrap.append(el('small','v-correction',readingResult.blanks[n].answer));p.append(wrap);last=match.index+match[0].length;}p.append(document.createTextNode(sentence.slice(last)));section.append(p);
      const helpers=el('div','v-sentence-tools'),translate=el('details');translate.append(el('summary','','Dịch câu'),note(translation));helpers.append(translate,button('Nghe câu',()=>speak(plainSentence(set,sentence)),'listen-button'));section.append(helpers);article.append(section);}
    if(reading.listening){article.prepend(note('Luyện nghe tự biên soạn · giọng đọc tổng hợp của trình duyệt. Nghe trước, trả lời rồi mở lời thoại.'));const controls=el('div','v-audio-options');controls.append(select('Tốc độ nghe',[['0.65','Chậm · 0.65×'],['0.9','Vừa · 0.9×'],['1','Bình thường · 1×']],String(speed),v=>speed=Number(v)),button('Dừng nghe',()=>{if(speechSynthesisSupported())window.speechSynthesis.cancel();},'text-button'));article.append(controls);const transcript=el('details','v-listening-transcript');transcript.append(el('summary','','Xem lời thoại & bản dịch'));for(const sentence of [...article.querySelectorAll('.v-sentence')])transcript.append(sentence);article.append(transcript);}if(wordBank){const workbench=el('div','v-reading-workbench');workbench.append(wordBank.element,article);panel.append(workbench);}else panel.append(article);
    const questions=el('div','v-reading-questions');questions.append(el('h2','','Hiểu nội dung'));reading.questions.forEach((q,i)=>{const field=el('fieldset');field.append(el('legend','',`${i+1}. ${q.prompt}`));const options=el('div','v-choices');q.options.forEach((text,n)=>{const label=el('label','v-radio-choice');const radio=el('input');radio.type='radio';radio.name=`vQuestion-${i}`;radio.value=String(n);radio.checked=readingDraft.choices[i]===n;radio.disabled=!!readingResult;radio.addEventListener('change',()=>{readingDraft.choices[i]=n;const check=document.querySelector('#vCheckReading');if(check)check.disabled=!readingComplete();saveDraft();});label.append(radio,el('span','',text));options.append(label);});field.append(options);if(readingResult){const r=readingResult.questions[i];field.append(el('p',r.correct?'v-correct-text':'v-error-text',`${r.correct?'Đúng.':'Đáp án: '+q.options[r.answer]+'.'} ${r.explanation}`));}questions.append(field);});panel.append(questions);
    const footer=el('div','v-reading-footer');if(!readingResult){const check=button('Kiểm tra bài làm',()=>action({action:'reading',index:readingIndex,answers:readingDraft.answers,choices:readingDraft.choices},r=>{clearTimeout(timer);timer=null;readingResult=r;}),'button primary');check.id='vCheckReading';check.disabled=!readingComplete();footer.append(check,note('Kéo hoặc chọn từ để điền đủ các ô, rồi trả lời câu hỏi đọc hiểu.'));}
    else {const result=el('div','v-feedback correct');result.setAttribute('role','status');result.append(el('strong','',`${readingResult.score}/${readingResult.total} câu đúng`),note('Đáp án và giải thích đã hiện ngay trong bài. Các từ cần ôn được lưu lại.'));footer.append(result,button('Làm lại bài này',()=>{readingResult=null;readingDraft={answers:[],choices:[]};render();saveDraft();},'button secondary'),button('Bài tiếp theo →',()=>{readingIndex=(readingIndex+1)%set.readings.length;readingResult=null;readingDraft={answers:[],choices:[]};render();saveDraft();},'button primary'));}
    panel.append(footer);wordBank?.sync();
    const history=el('details','v-history');history.append(el('summary','','Lịch sử bài đọc'));for(const [key,r]of Object.entries(data.results).filter(([key])=>key.startsWith(`${setId}:reading:`))){history.append(note(`${set.readings[r.index]?.title} · ${r.score}/${r.total} lần gần nhất · tốt nhất ${r.best}/${r.total} · ${r.attempts} lượt · ${new Date(r.at).toLocaleDateString('vi-VN')}`));}if(history.children.length===1)history.append(note('Chưa có bài đã nộp.'));panel.append(history);
  }
  root.addEventListener('keydown',event=>{if(mode==='dictation'&&(event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();const w=queue[index];if(w)dictate(w);}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushDraft();});
  document.addEventListener('keydown',event=>{if(event.defaultPrevented||activeView!=='vocabulary'||mode!=='cards'||!setId||pending||/INPUT|TEXTAREA|SELECT|SUMMARY/.test(event.target.tagName))return;if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}if(event.key==='ArrowRight'){event.preventDefault();move(1);}if(event.code==='Space'&&event.target.tagName!=='BUTTON'){event.preventDefault();flipped=!flipped;render();}});
  window.noiVocabulary={openSet(id){if(data?.sets.some(s=>s.id===id))chooseSet(id);},update(s){data=s.learning.vocabulary;if(!data||activeView!=='vocabulary')return;if(!initialized){initialized=true;const params=new URLSearchParams(location.search),selected=params.get('set');if(data.sets.some(s=>s.id===selected)){setId=selected;words=currentWords();const requested=params.get('mode');if(['cards','learn','reading','dictation'].includes(requested)){switchMode(requested);return;}}}if(!pending)render();},open(){if(data)window.noiVocabulary.update(snapshot);},leave(){flushDraft();if(speechSynthesisSupported())window.speechSynthesis.cancel();}};
  if(typeof snapshot!=='undefined'&&snapshot)window.noiVocabulary.update(snapshot);
})();
