/* Guided daily mission. Server profile is the source of progress. */
(() => {
  let data, working=false;
  const root=node('section','daily-mission');root.id='dailyMission';root.tabIndex=-1;root.setAttribute('aria-label','Nhiệm vụ hôm nay');
  $('#view-home > .page-heading').after(root);
  const compact=node('section','mission-compact');compact.setAttribute('aria-label','Tiến độ nhiệm vụ hôm nay');
  $('#view-practice > .page-heading').after(compact);
  function button(text,callback,className='button secondary') {
    const b=node('button',className,text);b.type='button';b.disabled=working;b.addEventListener('click',callback);return b;
  }
  function open(){showView('home');root.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});root.focus({preventScroll:true});}
  async function action(name,index) {
    if(working||busy)return;
    working=true;render();
    try {snapshot=await api('mission',{action:name,index});data=snapshot;renderAll();return true;}
    catch(error){toast(error.message,true);return false;}
    finally {working=false;render();}
  }
  async function practice() {
    if(working||busy)return;
    const mission=data.learning.mission;
    if(data.session.active && data.session.topic===mission.topic && mission.stage>=2){showView('practice');$('#messageInput').focus();return;}
    // Session creation retains the app's confirmation when replacing a live chat.
    await startSession(mission.topic);
    data=snapshot;
    if(data.session.active && data.session.topic===mission.topic) await action('practice');
  }
  function render() {
    if(!data?.learning?.mission)return;
    const m=data.learning.mission;
    const unit=data.learning.plan.find(item=>item.topic===m.topic);
    const ready=m.turns>=m.target;
    root.replaceChildren();compact.replaceChildren();
    const heading=node('div','mission-heading');
    const copy=node('div');copy.append(node('small','','NHIỆM VỤ HÔM NAY'),node('h2','',unit.title),node('p','',unit.task));
    heading.append(copy,lessonArt(m.topic,'mission-art'));root.append(heading);
    const steps=node('ol','mission-steps');
    ['Làm quen 3 câu','Thử nói 3 lượt','Nhìn lại buổi học'].forEach((label,index)=>{
      const done=index===0?m.stage>=1:index===1?ready:m.completed;
      const li=node('li',done?'done':'',`${done?'✓':index+1}  ${label}`);if(!done && index===(m.stage===0?0:ready?2:1))li.setAttribute('aria-current','step');steps.append(li);
    });root.append(steps);
    if(m.stage===0) {
      root.append(node('p','mission-instruction','Nghe câu mẫu, thử nói thành tiếng rồi đánh dấu từng câu. Không cần nói hoàn hảo.'));
      const list=node('div','mission-phrases');
      m.phrases.forEach(([english,vietnamese],index)=>{
        const known=data.learning.dailyMission?.day===m.day && data.learning.dailyMission.learned.includes(index);
        const card=node('article',`mission-phrase${known?' is-done':''}`);
        card.append(node('span','mission-phrase-number',`0${index+1}`),node('h3','',english));
        const translation=node('details');translation.append(node('summary','','Xem nghĩa'),node('p','',vietnamese));
        const controls=node('div','mission-phrase-actions');
        controls.append(button('Nghe câu này',()=>speak(english),'text-button'),button(known?'Đã thử nói ✓':'Mình đã thử nói',()=>action('learn',index),'mission-check'));
        if(known)controls.lastChild.disabled=true;
        card.append(translation,controls);list.append(card);
      });root.append(list,node('small','mission-note','Giọng đọc của trình duyệt. Đánh dấu là tự xác nhận, không phải chấm phát âm.'));
    } else if(m.completed) {
      const result=node('div','mission-result');
      result.append(node('h3','','Bạn đã dành thời gian cho tiếng Anh hôm nay.'),node('p','',`Đã làm quen 3 câu và trao đổi ${m.turns} lượt trong tình huống “${unit.title}”.`));
      const phrases=node('ul');m.phrases.forEach(([english])=>phrases.append(node('li','',english)));result.append(phrases);
      result.append(button('Ôn những câu đã lưu →',()=>showView('notebook'),'button primary'),button('Học thêm từ vựng',()=>showView('vocabulary')));root.append(result);
    } else if(ready) {
      const review=node('div','mission-result');
      review.append(node('h3','','Đã đủ 3 lượt. Cùng nhìn lại nhé.'),node('p','',`Bạn đã thực hành ${m.turns} lượt. Kết quả này ghi nhận việc luyện tập, chưa phải đánh giá trình độ.`),button('Hoàn thành nhiệm vụ ✓',()=>action('finish'),'button primary'));root.append(review);
    } else {
      const prompt=node('div','mission-ready');
      prompt.append(node('h3','',m.stage===1?'Mang 3 câu vừa học vào cuộc trò chuyện.':`${Math.min(m.turns,m.target)}/${m.target} lượt trao đổi`),node('p','',`Bạn sẽ đóng vai ${data.topics.find(t=>t.key===m.topic)?.learner||'người học'}. Trả lời theo ý của bạn; có thể dùng gợi ý khi cần.`));
      const meter=node('progress');meter.max=m.target;meter.value=Math.min(m.turns,m.target);meter.setAttribute('aria-label',`${m.turns} trên ${m.target} lượt thực hành`);
      prompt.append(meter,button(m.stage===1?'Vào tình huống →':'Tiếp tục thực hành →',practice,'button primary'));root.append(prompt);
    }
    const compactText=node('div');compactText.append(node('small','','NHIỆM VỤ HÔM NAY'),node('strong','',unit.title),node('span','',m.completed?'Đã hoàn thành ✓':m.stage===0?'Làm quen 3 câu trước khi nói':ready?'Đủ lượt thực hành — xem lại thành quả':`${Math.min(m.turns,m.target)}/${m.target} lượt thực hành`));
    compact.append(lessonArt(m.topic,'mission-compact-art'),compactText,button(m.completed?'Xem thành quả':ready?'Nhìn lại buổi học':'Mở nhiệm vụ',open,'button secondary'));
  }
  window.noiMission={update(value){data=value;render();},open};
  if(typeof snapshot!=='undefined'&&snapshot)window.noiMission.update(snapshot);
})();
