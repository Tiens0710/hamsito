"use strict";
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
const icon = name => { const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const use = document.createElementNS("http://www.w3.org/2000/svg", "use"); use.setAttribute("href", `#i-${name}`); svg.append(use); svg.setAttribute("aria-hidden", "true"); return svg; };
function lessonArt(topic, className = 'lesson-art') {
  const name = ({cafe:'cafe',travel:'travel',directions:'city',smalltalk:'smalltalk',work:'interview',interview:'interview',meeting:'interview',shopping:'shopping','daily-routine':'calendar',opinions:'story',listening:'listening',companion:'companion'})[topic] || 'smalltalk';
  const art = ({smalltalk:'conversation-cartoon',cafe:'conversation-cartoon',companion:'study-cartoon',listening:'study-cartoon',travel:'travel-cartoon',city:'travel-cartoon',interview:'work-cartoon',calendar:'study-cartoon',story:'conversation-cartoon',shopping:'work-cartoon'})[name];
  const picture=node('img',className);picture.src=art?`/art/${art}.webp`:`/art/${name}.svg`;picture.alt='';picture.width=380;picture.height=320;picture.decoding='async';return picture;
}
let snapshot, busy = false, busyPhase = "reply", chat = [], activeView = "home", toastTimer, reviewCard, recognition;
const labels = { home: "Hôm nay", practice: "Luyện giao tiếp", vocabulary: "Từ vựng", plan: "Lộ trình của bạn", notebook: "Sổ tay & ôn tập", settings: "Thiết lập" };
labels.toeic='Lộ trình TOEIC';labels.plan='Lộ trình giao tiếp';

function toast(message, error = false) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.toggle("error", error);
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, error ? 7000 : 4000);
}
async function api(endpoint, body) {
  let response;
  try {
    response = await fetch(`/api/${endpoint}`, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(65_000) });
  } catch (error) {
    throw new Error(error.name === "TimeoutError" ? "Phản hồi mất quá lâu. Bạn thử gửi lại nhé." : "Chưa kết nối được với máy chủ. Kiểm tra mạng và thử lại nhé.");
  }
  let data;
  try { data = await response.json(); } catch { throw new Error("Máy chủ chưa phản hồi đúng. Thử tải lại trang nhé."); }
  if (!response.ok) { const error = new Error(data.error || "Chưa thực hiện được. Thử lại nhé."); error.status = response.status; throw error; }
  return data;
}
let coachSocket=null,coachSocketOpened=0,coachCooldownUntil=0;
function openCoachSocket(){
 if(coachSocket?.readyState===WebSocket.OPEN&&Date.now()-coachSocketOpened<20000)return Promise.resolve(coachSocket);
 coachSocket?.close();
 return new Promise((resolve,reject)=>{
  const socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/api/ws');let settled=false;
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);socket.close();reject(new Error('Chưa mở được WebSocket. Hãy kiểm tra mạng và thử lại.'));};
  const timer=setTimeout(fail,30000);
  socket.addEventListener('open',()=>{if(settled)return;settled=true;clearTimeout(timer);coachSocket=socket;coachSocketOpened=Date.now();resolve(socket);},{once:true});
  socket.addEventListener('error',fail,{once:true});
  socket.addEventListener('close',()=>{if(coachSocket===socket)coachSocket=null;fail();},{once:true});
 });
}
async function streamCommand(text,onText){
 const status=$('#chatTransport'),started=performance.now();let chunks=0;
 const show=value=>{if(status){status.textContent=value;status.hidden=false;}};
 if(Date.now()<coachCooldownUntil)throw new Error('Chờ '+Math.ceil((coachCooldownUntil-Date.now())/1000)+' giây trước khi gửi tiếp nhé.');
 show(coachSocket?.readyState===1?'WebSocket · dùng lại kết nối':'Đang kết nối WebSocket…');
 let socket;try{socket=await openCoachSocket();}catch(error){show('WebSocket · chưa kết nối');throw error;}
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);socket.removeEventListener('message',message);socket.removeEventListener('error',failed);socket.removeEventListener('close',closed);if(error){socket.close();show('WebSocket · phản hồi chưa hoàn tất');reject(error);}else{show(chunks?'WebSocket · đã nhận '+chunks+' phần phản hồi':'WebSocket · đã hoàn tất');resolve(result);}};
  const message=event=>{try{const data=JSON.parse(event.data);if(data.type==='text'){chunks++;show('WebSocket · đang nhận phản hồi'+(chunks===1?' ('+((performance.now()-started)/1000).toFixed(1)+' giây)':''));onText?.(data.text);}else if(data.type==='status'&&data.phase==='retrying')show('AI đang bận · thử lại một lần sau '+Math.ceil(data.delayMs/1000)+' giây');else if(data.type==='done')finish(null,data.result);else if(data.type==='error'){if(data.code==='rate_limit')coachCooldownUntil=Date.now()+60000;finish(new Error(data.message));}}catch{finish(new Error('Phản hồi WebSocket chưa đúng định dạng.'));}};
  const failed=()=>finish(new Error('Kết nối WebSocket gặp lỗi. Không tự gửi lại tin nhắn.'));
  const closed=()=>finish(new Error('Kết nối bị ngắt. Tải lại hội thoại trước khi gửi lại nhé.'));
  const timer=setTimeout(()=>finish(new Error('Phản hồi quá lâu. Tải lại hội thoại trước khi gửi lại.')),70000);
  socket.addEventListener('message',message);socket.addEventListener('error',failed);socket.addEventListener('close',closed);
  show('WebSocket đã kết nối · đang chờ AI');socket.send(JSON.stringify({text}));
 });
}
function streamingBubble(){
 const log=$('#chatLog'),bubble=node('div','chat-message coach streaming'),body=node('div','');
 bubble.append(node('span','message-who','Nói đang trả lời…'),body);
 let frame=0,latest='';
 return {update(text){latest=text;if(!bubble.isConnected)log.append(bubble);if(!frame)frame=requestAnimationFrame(()=>{frame=0;body.textContent=latest;log.scrollTop=log.scrollHeight;});},close(){if(frame)cancelAnimationFrame(frame);bubble.remove();}};
}

function setBusy(value, phase) {
  busy = value;
  if (phase) busyPhase = phase;
  if (!value) busyPhase = "reply";
  $$("[data-start], [data-support], #startToday, #startTopic, #sendButton, #stopSession, #reviewGood, #reviewAgain").forEach(button => { button.disabled = value; });
  $("#messageInput").disabled = value;
  $("#sendButton").classList.toggle("busy", value);
  $("#inputHint").textContent = value ? (busyPhase === "start" ? "Đang mở buổi luyện…" : "Nói đang trả lời…") : snapshot?.session.active ? "Enter để gửi · Shift + Enter xuống dòng" : "Chọn tình huống để bắt đầu";
  $("#startTopic").firstChild.textContent = value && busyPhase === "start" ? "Đang mở… " : "Bắt đầu ";
  $("#chatLog").setAttribute("aria-busy", String(value));
  $(".support-row").hidden = !snapshot?.session.active;
  $("#stopSession").hidden = !snapshot?.session.active;
  if (!value && snapshot) {
    const canReply = snapshot.configured && snapshot.enabled && snapshot.session.active;
    $("#sendButton").disabled = !canReply;
    $("#messageInput").disabled = !canReply;
    $("#messageInput").placeholder = snapshot.session.active ? "Bạn sẽ trả lời thế nào? Thử bằng tiếng Anh nhé…" : "Chọn một tình huống để bắt đầu trò chuyện nhé.";
    $$('[data-support]').forEach(button => { button.disabled = !snapshot.configured || !snapshot.session.active; });
    $("#stopSession").disabled = !snapshot.session.active;
  }
  $("#micButton").disabled = value || !SpeechRecognition || !snapshot?.session.active || !snapshot?.configured || !snapshot?.enabled;
}
function showView(name) {
  if (!labels[name]) name = "home";
  if (activeView === 'vocabulary' && name !== 'vocabulary') window.noiVocabulary?.leave();
  if (activeView === 'toeic' && name !== 'toeic') window.noiToeic?.leave();
  activeView = name;
  $$(".view").forEach(view => { view.hidden = view.id !== `view-${name}`; });
  $$(".nav-item").forEach(button => { button.classList.toggle("active", button.dataset.view === name); if (button.dataset.view === name) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current"); });
  $("#pageLabel").textContent = labels[name];
  if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
  if (name === "practice") { renderChat(); $("#chatLog").scrollTop = $("#chatLog").scrollHeight; }
  if (name === "vocabulary") window.noiVocabulary?.open();
  if (name === 'toeic') window.noiToeic?.open();
  $$('.view h1, .view [data-screen-title]').forEach(heading => {
    const tag = heading.closest('.view').id === `view-${name}` ? 'h1' : 'h2';
    if (heading.tagName.toLowerCase() !== tag) {
      const replacement = document.createElement(tag);
      for (const attr of heading.attributes) replacement.setAttribute(attr.name, attr.value);
      replacement.textContent = heading.textContent;
      replacement.dataset.screenTitle = '';
      heading.replaceWith(replacement);
    } else heading.dataset.screenTitle = '';
  });
  if (name !== "practice") { recognition?.abort(); speechSynthesisSupported() && window.speechSynthesis.cancel(); }
  window.scrollTo({ top: 0 });
}
function speechSynthesisSupported() { return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window; }
function speak(text) {
  if (!speechSynthesisSupported()) return toast("Trình duyệt chưa hỗ trợ giọng đọc. Thử mở bằng Chrome hoặc Edge.", true);
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = .9;
  const voice = window.speechSynthesis.getVoices().find(item => /^en[-_]US/i.test(item.lang)) || window.speechSynthesis.getVoices().find(item => /^en/i.test(item.lang));
  if (voice) utterance.voice = voice;
  utterance.onerror = () => toast("Chưa phát được giọng đọc. Kiểm tra âm thanh và thử lại nhé.", true);
  window.speechSynthesis.speak(utterance);
}
function renderChat() {
  const log = $("#chatLog");
  log.replaceChildren();
  if (!chat.length) {
    const empty = node("div", "chat-empty"); empty.append(lessonArt('companion','chat-welcome-art'),node("h2", "", "Một câu chuyện bắt đầu từ bạn."), node("p", "", "Ghé quán cà phê, gặp một người bạn mới… Chọn một tình huống, mình sẽ mở lời trước."));
    const choices = node("div", "quick-starts");
    for (const [key, label] of [["smalltalk", "Chào hỏi làm quen"], ["cafe", "Gọi món ở quán cà phê"], ["travel", "Nhận phòng khách sạn"], ["work", "Trò chuyện công việc"]]) {
      const button = node("button", "button secondary", label); button.type = "button"; button.dataset.start = key; button.disabled = busy;
      button.prepend(lessonArt(key,'quick-topic-art')); button.append(icon("arrow")); button.addEventListener("click", () => startSession(key)); choices.append(button);
    }
    empty.append(choices); log.append(empty);
  }
  for (const message of chat) {
    const bubble = node("div", `chat-message ${message.role === "learner" ? "learner" : "coach"}`);
    bubble.append(node("span", "message-who", message.role === "learner" ? "Bạn" : "Nói"), node("div", "", message.text));
    const first = String(message.text).split(/\n\n/)[0];
    if (message.role !== "learner" && /[A-Za-z]{3}/.test(first) && !/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(first)) {
      const listen = node("button", "listen-button", "Nghe câu này"); listen.prepend(icon("sound")); listen.type = "button"; listen.addEventListener("click", () => speak(first)); bubble.append(listen);
    }
    log.append(bubble);
  }
  log.scrollTop = log.scrollHeight;
}
function renderActivity() {
  const root = $("#weekActivity"); root.replaceChildren();
  const dates = new Set((snapshot.activity || []).filter(item => item.turns > 0).map(item => new Date(item.startedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })));
  for (let index = 6; index >= 0; index--) {
    const date = new Date(); date.setDate(date.getDate() - index);
    const stamp = date.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    const item = node("div", "week-day");
    const dot = node("span", `day-dot${dates.has(stamp) ? " done" : ""}${index === 0 ? " today" : ""}`, dates.has(stamp) ? "" : "·");
    if (dates.has(stamp)) dot.append(icon("check"));
    dot.title = `${date.toLocaleDateString("vi-VN")}: ${dates.has(stamp) ? "đã luyện" : "chưa có lượt luyện"}`;
    item.append(node("span", "", ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getDay()]), dot); root.append(item);
  }
}
function renderHome() {
  const learning = snapshot.learning;
  const recommended = learning.recommended;
  const topic = snapshot.topics.find(item => item.key === recommended.topic);
  $('#homeArt').replaceChildren(lessonArt(recommended.topic));
  $("#recommendedTitle").textContent = recommended.title;
  $("#recommendedTask").textContent = recommended.task;
  $("#recommendedOpener").textContent = topic?.opener || "Hi, nice to meet you! What's your name?";
  $("#homeDuration").textContent = `${learning.minutesPerDay} phút`;
  $("#statTurns").textContent = learning.totalTurns;
  $("#statCards").textContent = learning.dueCount;
  $("#statUnits").textContent = `${learning.practicedUnits} / ${learning.plan.length}`;
  $("#streakText").textContent = `${learning.streak} ngày liên tiếp`;
  $("#homeGoal").textContent = learning.goal;
  const grid = $("#scenarioGrid"); grid.replaceChildren();
  for (const key of ["cafe", "work", "travel", "smalltalk"]) {
    const unit = learning.plan.find(item => item.topic === key);
    const card = node("button", "scenario-card"); card.type = "button"; card.dataset.start = key;
    const text = node("div"); text.append(node("strong", "", unit.title), node("p", "", unit.task));
    card.append(lessonArt(key,'scenario-art'),text, icon("arrow"));
    card.addEventListener("click", () => startSession(key)); grid.append(card);
  }
  const last = learning.corrections.at(-1);
  $("#latestCorrection").hidden = !last;
  $("#latestCorrection").textContent = last ? `${last.original} → ${last.corrected}` : "";
  $("#memorySummary").textContent = learning.corrections.length || learning.cards.length ? `${learning.corrections.length} điểm cần luyện và ${learning.cards.length} mẫu câu được giữ lại để ôn.` : "Câu cần sửa và mẫu câu sẽ được lưu sau buổi trò chuyện đầu tiên.";
  renderActivity();
  renderStudyWidget();
}
const streakButton = node('button', 'streak-button', 'Streak —');
streakButton.type = 'button';
streakButton.setAttribute('aria-expanded', 'false');
streakButton.setAttribute('aria-controls', 'studyWidget');
$('.sidebar-bottom').prepend(streakButton);
const studyWidget = node('section', 'study-widget');
studyWidget.id = 'studyWidget';
studyWidget.hidden = true;
studyWidget.setAttribute('aria-label', 'Nhịp học của bạn');
document.body.append(studyWidget);
function toggleStudyWidget(open) {
  studyWidget.hidden = !open;
  streakButton.setAttribute('aria-expanded', String(open));
}
streakButton.addEventListener('click', () => toggleStudyWidget(studyWidget.hidden));
document.addEventListener('click', event => {
  if (!studyWidget.contains(event.target) && !streakButton.contains(event.target)) toggleStudyWidget(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !studyWidget.hidden) { toggleStudyWidget(false); streakButton.focus(); }
});
function renderStudyWidget() {
  const learning = snapshot.learning;
  streakButton.textContent = `${learning.streak} ngày`;
  streakButton.prepend(icon('spark'));
  streakButton.setAttribute('aria-label', `Streak ${learning.streak} ngày. Mở widget học tập`);
  studyWidget.replaceChildren();
  const heading = node('div', 'widget-heading');
  const close = node('button', 'text-button', 'Đóng'); close.type = 'button';
  close.addEventListener('click', () => { toggleStudyWidget(false); streakButton.focus(); });
  heading.append(node('h2', '', 'Nhịp học của bạn'), close);
  const streak = node('div', 'widget-streak');
  streak.append(node('strong', '', String(learning.streak)), node('span', '', 'ngày liên tiếp'));
  const status = node('p', 'widget-status', learning.studiedToday ? 'Hôm nay bạn đã học. Giữ nhịp này nhé!' : 'Học một lượt hôm nay để nối dài streak.');
  const weekLabel = node('h3', '', 'Trò chuyện trong 7 ngày qua');
  const week = $('#weekActivity').cloneNode(true); week.removeAttribute('id');
  const facts = node('div', 'widget-facts');
  facts.append(node('span', '', `Kỷ lục: ${learning.bestStreak} ngày`), node('span', '', `Mục tiêu: ${learning.minutesPerDay} phút/ngày`));
  const next = node('button', 'widget-next'); next.type = 'button';
  next.append(node('small', '', 'Bài gợi ý tiếp theo'), node('strong', '', learning.recommended.title), node('span', '', 'Mở lộ trình →'));
  next.addEventListener('click', () => { toggleStudyWidget(false); showView('plan'); });
  const review = node('button', 'text-button', `${learning.dueCount} câu đến hạn ôn →`); review.type = 'button';
  review.addEventListener('click', () => { toggleStudyWidget(false); showView('notebook'); });
  studyWidget.append(heading, streak, status, weekLabel, week, facts, next, review);
  renderWidgetShelf();
}
function renderWidgetShelf() {
  let shelf = $('#practiceWidgets');
  if (!shelf) {
    shelf = node('div', 'learning-widgets'); shelf.id = 'practiceWidgets';
    shelf.setAttribute('aria-label', 'Tiện ích học hôm nay');
    $('#view-practice > .page-heading').after(shelf);
  }
  shelf.replaceChildren();
  const learning = snapshot.learning;
  const rhythm = node('article', 'learning-widget rhythm-widget');
  const rhythmCopy = node('div', 'widget-copy');
  rhythmCopy.append(node('small', '', 'NHỊP HỌC CỦA BẠN'), node('h2', '', `${learning.streak} ngày liên tiếp`), node('p', '', learning.studiedToday ? 'Đã học hôm nay. Tiếp tục thôi!' : 'Một lượt học nhỏ, thêm một ngày tiến bộ.'));
  const calendar = $('#weekActivity').cloneNode(true); calendar.removeAttribute('id');
  const details = node('button', 'text-button', 'Xem streak →'); details.type = 'button';
  details.addEventListener('click', () => { toggleStudyWidget(true); studyWidget.querySelector('button').focus(); });
  rhythm.append(rhythmCopy, calendar, details);
  const phrase = node('article', 'learning-widget phrase-widget');
  const phraseText = learning.recommended.phrases[0];
  const phraseCopy = node('div', 'widget-copy');
  phraseCopy.append(node('small', '', 'MỘT CÂU ĐỂ THỬ NÓI'), node('h2', '', phraseText), node('p', '', learning.recommended.title));
  const listen = node('button', 'widget-listen', 'Nghe và nói theo'); listen.type = 'button'; listen.prepend(icon('sound'));
  listen.addEventListener('click', () => speak(phraseText));
  phrase.append(lessonArt(learning.recommended.topic, 'widget-art'), phraseCopy, listen);
  const recall = node('article', 'learning-widget recall-widget');
  const recallCopy = node('div', 'widget-copy');
  recallCopy.append(node('small', '', 'GÓC ÔN TẬP'), node('h2', '', learning.dueCount ? `${learning.dueCount} câu chờ bạn ôn` : 'Gom từng câu hay'), node('p', '', learning.dueCount ? 'Nhớ lại trước khi xem đáp án.' : 'Mẫu câu từ buổi luyện sẽ nằm trong sổ tay.'));
  const open = node('button', 'text-button', learning.dueCount ? 'Ôn ngay →' : 'Mở sổ tay →'); open.type = 'button'; open.addEventListener('click', () => showView('notebook'));
  recall.append(lessonArt('companion', 'widget-art'), recallCopy, open);
  shelf.append(rhythm, phrase, recall);
}
function renderPlan() {
  const learning = snapshot.learning;
  $("#planGoal").textContent = `${learning.goal}. Mỗi ngày khoảng ${learning.minutesPerDay} phút, đi từng tình huống nhỏ.`;
  $("#planProgress").textContent = `${learning.practicedUnits}/${learning.plan.length} tình huống đã luyện`;
  $("#planBar").style.width = `${learning.practicedUnits / learning.plan.length * 100}%`;
  const grid = $("#planGrid"); grid.replaceChildren();
  for (const unit of learning.plan) {
    const card = node("article", `plan-card${unit.topic === learning.recommended.topic ? " current" : ""}`);
    const top = node("div", "plan-card-top"); top.append(node("span", "plan-number", `Buổi ${unit.number}`), node("span", "plan-status", unit.practiced ? "Đã luyện" : unit.topic === learning.recommended.topic ? "Gợi ý tiếp theo" : `${unit.turns} lượt đã luyện`));
    const chips = node("div", "phrase-chips"); unit.phrases.forEach(phrase => chips.append(node("span", "", phrase)));
    const button = node("button", "text-button", unit.practiced ? "Luyện thêm một lần" : "Luyện tình huống này"); button.dataset.start = unit.topic; button.append(icon("arrow")); button.addEventListener("click", () => startSession(unit.topic));
    card.append(lessonArt(unit.topic,"plan-scene"),top, node("h2", "", unit.title), node("p", "", unit.task), chips, button); grid.append(card);
  }
}
function renderNotebook() {
  const learning = snapshot.learning;
  $("#navDue").textContent = learning.dueCount;
  $("#notebookCount").textContent = `${learning.cards.length} mẫu câu`;
  reviewCard = [...learning.cards].filter(card => card.dueAt <= Date.now()).sort((a, b) => a.dueAt - b.dueAt)[0];
  $("#reviewCounter").textContent = `${learning.dueCount} câu đến hạn`;
  $("#reviewPrompt").textContent = reviewCard ? `Bạn sẽ nói ý này thế nào? “${reviewCard.vietnamese}”` : learning.cards.length ? "Bạn đã ôn hết câu đến hạn. Những câu còn lại sẽ quay lại khi tới lịch ôn." : "Sổ tay bắt đầu từ lời bạn nói. Luyện một buổi để giữ lại những câu bạn thực sự dùng được.";
  $("#reviewAnswer").textContent = reviewCard?.english || "";
  $("#reviewAnswer").hidden = true; $("#reviewActions").hidden = true; $("#revealCard").hidden = !reviewCard;
  const list = $("#cardList"); list.replaceChildren();
  if (!learning.cards.length) list.append(node("div", "empty-state", "Chưa có mẫu câu nào được lưu. Mở một tình huống và bắt đầu nói theo cách của bạn nhé."));
  for (const card of [...learning.cards].reverse()) {
    // The current recall answer should not be visible in the library below it.
    const inReview = card.id === reviewCard?.id;
    const item = node("article", "saved-card"); const text = node("div"); text.append(node("strong", "", inReview ? "Câu đang luyện nhớ lại ở phía trên" : card.english), node("p", "", card.vietnamese));
    const status = node("span", "card-status", card.dueAt <= Date.now() ? "Đến hạn ôn" : `Ôn lại ${new Date(card.dueAt).toLocaleDateString("vi-VN")}`);
    if (!inReview) {
      const listen = node("button", "listen-button", "Nghe"); listen.prepend(icon("sound")); listen.addEventListener("click", () => speak(card.english)); text.append(listen);
    }
    item.append(text, status); list.append(item);
  }
  const errors = $("#errorList"); errors.replaceChildren();
  if (!learning.corrections.length) errors.append(node("div", "empty-state", "Chưa có lỗi được ghi nhận từ buổi luyện. Mình chỉ lưu điểm cần sửa khi có dẫn chứng từ câu bạn gửi."));
  for (const correction of [...learning.corrections].reverse()) {
    const item = node("article", "error-card"); item.append(node("div", "old-phrase", correction.original), node("h3", "", correction.corrected), node("p", "", correction.reason), node("small", "", `${correction.count} lần được ghi nhận · ${new Date(correction.lastSeenAt).toLocaleDateString("vi-VN")}`)); errors.append(item);
  }
}
function renderScene() {
  const topic = snapshot.topics.find(item => item.key === (snapshot.session.active ? snapshot.session.topic : $("#topicSelect").value));
  $("#sceneTitle").textContent = topic?.label || "Mục tiêu của buổi luyện";
  $("#sceneGoal").textContent = topic?.goal || "Chọn một tình huống để bắt đầu.";
  $("#sceneRoles").textContent = topic ? `Bạn: ${topic.learner}.\nBạn luyện: ${topic.role}.` : "";
  const unit=snapshot.learning.plan.find(item=>item.topic===topic?.key);
  $('#conversationArt').replaceChildren(lessonArt(topic?.key||'smalltalk'));
  $('#conversationTitle').textContent=unit?.title||'Một cuộc trò chuyện mới';
  $('#conversationTask').textContent=topic?.goal||unit?.task||'Chọn tình huống và bắt đầu khi bạn sẵn sàng.';
  const phraseRoot=$('#conversationPhrases');phraseRoot.replaceChildren();
  if(unit?.phrases?.length){phraseRoot.append(node('h3','','Mang theo một câu'));for(const phrase of unit.phrases.slice(0,2)){const b=node('button','context-phrase',phrase);b.type='button';b.prepend(icon('sound'));b.addEventListener('click',()=>speak(phrase));phraseRoot.append(b);}}
  const vocabulary = snapshot.learning.vocabulary;
  const activeSet = vocabulary?.sets.find(set => set.id === vocabulary.activeSet && set.topic === topic?.key);
  if (activeSet) $("#sceneRoles").textContent += `\n\nTừ đang áp dụng: ${activeSet.words.map(word => word.term).join(', ')}.`;
  $("#chatStatus").textContent = snapshot.session.active ? `${topic?.label || "Đang luyện"} · ${snapshot.session.turns} lượt trao đổi` : "Chọn tình huống, mình sẽ mở lời trước.";
}
function renderAll() {
  if (!snapshot) return;
  $("#sideLevel").textContent = `${snapshot.learning.level} · ${snapshot.learning.minutesPerDay} phút mỗi ngày`;
  $("#practiceLevel").textContent = `${snapshot.learning.level} · mức tự chọn`;
  $("#connectionBadge").lastChild.textContent = snapshot.paired ? "Cùng hồ sơ Zalo" : "Hồ sơ cá nhân";
  $("#configNotice").hidden = snapshot.configured && snapshot.enabled;
  $("#configNoticeText").textContent = snapshot.enabled ? "Trợ lý chưa có khóa Gemini trên máy chủ. Bạn vẫn xem được giao diện và thiết lập; luyện AI cần thêm GEMINI_API_KEY vào .env rồi khởi động lại." : "English Coach đang tắt. Bật ENGLISH_COACH_ENABLED trong cấu hình máy chủ để luyện.";
  $("#goalInput").value = snapshot.learning.goal;
  $("#levelInput").value = snapshot.learning.level;
  $("#minutesInput").value = snapshot.learning.minutesPerDay;
  $("#pairForm").hidden = snapshot.paired;
  $("#pairedState").hidden = !snapshot.paired;
  $("#engineBadge").textContent = snapshot.configured && snapshot.enabled ? "Sẵn sàng" : "Chưa sẵn sàng";
  $("#engineBadge").classList.toggle("ready", snapshot.configured);
  $("#engineDescription").textContent = snapshot.configured && snapshot.enabled ? "Nói tạo phản hồi theo câu bạn nói và mục tiêu học đã chọn." : "Trợ lý đang chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ người quản lý ứng dụng.";
  const select = $("#topicSelect"); const selected = select.value || snapshot.session.topic;
  select.replaceChildren(...snapshot.topics.map(topic => { const option = node("option", "", `${topic.label} · ${topic.level}`); option.value = topic.key; return option; })); select.value = snapshot.topics.some(topic => topic.key === selected) ? selected : snapshot.learning.recommended.topic;
  renderHome(); renderPlan(); renderNotebook(); renderScene(); setBusy(busy);
  window.noiMission?.update(snapshot);
  window.noiToeic?.update(snapshot);
  window.noiVocabulary?.update(snapshot);
}
async function startSession(topic, confirmed = false) {
  if (busy) return;
  if (!confirmed && snapshot.session.active && snapshot.session.turns > 0 && !window.confirm("Bắt đầu tình huống mới? Buổi hiện tại sẽ được lưu vào lịch sử.")) return;
  topic = snapshot.topics.some(item => item.key === topic) ? topic : snapshot.learning.recommended.topic;
  showView("practice"); setBusy(true, "start");
  try {
    const result = await streamCommand(`/english lesson ${topic}`);
    if (!result.session?.active || !result.messages?.length) throw new Error("Chưa mở được buổi luyện. Bạn bấm tình huống để thử lại nhé.");
    snapshot = result;
    const onboarding = sessionStorage.getItem('noi-onboarding');
    if(onboarding){const preferences=JSON.parse(onboarding);snapshot=await api('settings',preferences);sessionStorage.removeItem('noi-onboarding');}
    try{localStorage.setItem('noi-returning','1');}catch{}
    chat = snapshot.messages || []; $("#topicSelect").value = topic;
    renderAll(); renderChat();
    if (!snapshot.configured) toast("Thêm Gemini API key trên máy chủ để tiếp tục buổi luyện với AI.");
  } catch (error) { toast(error.message, true); } finally { setBusy(false); }
}
async function sendText(text, support = false) {
  if(Date.now()<coachCooldownUntil)return toast("AI đang giới hạn yêu cầu. Chờ một chút trước khi gửi tiếp nhé.",true);
  if (busy || !text.trim()) return;
  if (!snapshot.session.active) return toast("Chọn một tình huống và bấm Bắt đầu buổi luyện nhé.", true);
  if (!snapshot.configured) return toast("Máy chủ chưa có Gemini API key. Xem phần Thiết lập để cấu hình.", true);
  setBusy(true, "reply");
  chat.push({ role: "learner", text: support ? { hint: "Gợi ý cho mình nhé.", explain: "Mình chưa hiểu câu vừa rồi.", example: "Cho mình một câu mẫu nhé.", repeat: "Nói lại bằng câu dễ hơn nhé." }[text] : text });
  renderChat();
  const partial=streamingBubble();
  try {
    const result = await streamCommand(support ? `/english ${text}` : text,value=>partial.update(value));
    partial.close();
    snapshot = result;
    if (!(result.notifications || []).length) throw new Error("Bạn vừa gửi hơi nhanh. Chờ vài giây rồi thử lại nhé.");
    for (const reply of result.notifications) chat.push({ role: "coach", text: reply });
    renderAll(); renderChat();
  } catch (error) { chat.push({ role: "coach", text: error.message }); renderChat(); toast(error.message, true); }
  finally { partial.close();setBusy(false); if (!support) $("#messageInput").focus(); }
}

$$('[data-view]').forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
$(".brand").addEventListener("click", event => { event.preventDefault(); showView("home"); });
window.addEventListener("hashchange", () => { if (labels[location.hash.slice(1)]) showView(location.hash.slice(1)); });
$("#startToday").addEventListener("click", () => window.noiMission?.open());
$("#startTopic").addEventListener("click", () => startSession($("#topicSelect").value));
$("#topicSelect").addEventListener("change", renderScene);
$("#chatForm").addEventListener("submit", event => { event.preventDefault(); const text = $("#messageInput").value.trim(); if (busy || !text) return; if (!snapshot.configured || !snapshot.session.active) return sendText(text); $("#messageInput").value = ""; sendText(text); });
$("#messageInput").addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); $("#chatForm").requestSubmit(); } });
$$('[data-support]').forEach(button => button.addEventListener("click", () => sendText(button.dataset.support, true)));
$("#stopSession").addEventListener("click", async () => {
  if (busy) return; setBusy(true);
  try { snapshot = await api("command", { text: "/english stop" }); chat.push(...snapshot.notifications.map(text => ({ role: "coach", text }))); renderAll(); renderChat(); } catch (error) { toast(error.message, true); } finally { setBusy(false); }
});
$("#revealCard").addEventListener("click", () => { $("#reviewAnswer").hidden = false; $("#reviewActions").hidden = false; $("#revealCard").hidden = true; });
async function rateCard(rating) {
  if (busy || !reviewCard) return; setBusy(true);
  try { snapshot = await api("review", { cardId: reviewCard.id, rating }); renderAll(); toast(rating === "good" ? "Đã nhớ. Câu này sẽ trở lại theo lịch ôn." : "Mình sẽ cho ôn lại sau khoảng 10 phút."); } catch (error) { toast(error.message, true); } finally { setBusy(false); }
}
$("#reviewAgain").addEventListener("click", () => rateCard("again"));
$("#reviewGood").addEventListener("click", () => rateCard("good"));
function notebookTab(errors) { $("#cardsPane").hidden = errors; $("#errorsPane").hidden = !errors; $("#tabCards").classList.toggle("selected", !errors); $("#tabErrors").classList.toggle("selected", errors); $("#tabCards").setAttribute("aria-selected", String(!errors)); $("#tabErrors").setAttribute("aria-selected", String(errors)); $("#tabCards").tabIndex = errors ? -1 : 0; $("#tabErrors").tabIndex = errors ? 0 : -1; }
$("#tabCards").addEventListener("click", () => notebookTab(false)); $("#tabErrors").addEventListener("click", () => notebookTab(true));
$(".notebook-tabs").addEventListener("keydown", event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const errors = event.key === "End" || (event.key !== "Home" && $("#tabCards").getAttribute("aria-selected") === "true"); notebookTab(errors); $(errors ? "#tabErrors" : "#tabCards").focus(); });
document.addEventListener("click", event => { const details = $(".scene-details"); if (details.open && !details.contains(event.target)) details.open = false; });
document.addEventListener("keydown", event => { if (event.key === "Escape") $(".scene-details").open = false; });
$$('[data-goal]').forEach(button => button.addEventListener("click", () => { $("#goalInput").value = button.dataset.goal; }));
$("#settingsForm").addEventListener("submit", async event => {
  event.preventDefault(); if (busy) return; const button = event.submitter; button.disabled = true; setBusy(true);
  try { snapshot = await api("settings", { goal: $("#goalInput").value.trim(), level: $("#levelInput").value, minutesPerDay: Number($("#minutesInput").value) }); renderAll(); toast("Đã lưu mục tiêu. Lộ trình và buổi gợi ý đã được cập nhật."); } catch (error) { toast(error.message, true); } finally { button.disabled = false; setBusy(false); }
});
$("#pairForm").addEventListener("submit", async event => {
  event.preventDefault(); if (busy) return; const button = event.submitter; button.disabled = true; setBusy(true);
  try { snapshot = await api("pair", { code: $("#pairCode").value.trim() }); chat = snapshot.messages; $("#pairCode").value = ""; renderAll(); toast("Đã mở cùng hồ sơ học với bot Zalo."); } catch (error) { toast(error.message, true); } finally { button.disabled = false; setBusy(false); }
});
$("#unpairButton").addEventListener("click", async () => {
  if (busy) return; setBusy(true);
  try { snapshot = await api("unpair", {}); chat = snapshot.messages; renderAll(); toast("Đã quay về hồ sơ web riêng."); } catch (error) { toast(error.message, true); } finally { setBusy(false); }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition(); recognition.lang = "en-US"; recognition.interimResults = false; recognition.continuous = false;
  recognition.onstart = () => { $("#micButton").setAttribute("aria-pressed", "true"); $("#inputHint").textContent = "Đang nghe… Nói câu tiếng Anh của bạn."; };
  recognition.onend = () => { $("#micButton").setAttribute("aria-pressed", "false"); $("#inputHint").textContent = "Xem lại câu nhận diện trước khi gửi nhé."; };
  recognition.onresult = event => { const transcript = event.results[0][0].transcript; $("#messageInput").value = `${$("#messageInput").value.trim()} ${transcript}`.trim(); $("#messageInput").focus(); };
  recognition.onerror = event => toast(event.error === "not-allowed" ? "Bạn cần cho phép micro trong trình duyệt để nhập bằng giọng nói." : "Chưa nhận diện được. Bạn thử lại hoặc gõ câu trả lời nhé.", true);
  $("#micButton").addEventListener("click", () => { if (busy) return; if ($("#micButton").getAttribute("aria-pressed") === "true") recognition.stop(); else try { recognition.start(); } catch { toast("Micro đang bận. Thử lại sau nhé.", true); } });
} else {
  $("#micButton").disabled = true; $("#micButton").title = "Trình duyệt chưa hỗ trợ nhận diện giọng nói"; $("#speechNote").textContent = "Trình duyệt này chưa hỗ trợ micro chuyển thành chữ. Bạn vẫn có thể luyện bằng cách nhập câu trả lời.";
}
$("#todayDate").textContent = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Ho_Chi_Minh" });
async function initializeApp() {
  $("#loading").hidden = false;
  try {
    snapshot = await api("state");
    const onboarding = sessionStorage.getItem('noi-onboarding');
    if(onboarding){const preferences=JSON.parse(onboarding);snapshot=await api('settings',preferences);sessionStorage.removeItem('noi-onboarding');}
    try{localStorage.setItem('noi-returning','1');}catch{}
    chat = snapshot.messages || [];
    renderAll();
    $("#loading").hidden = true;
    $("#appContent").hidden = false;
    $("#loginGate").hidden = true;
    showView(location.hash.slice(1) || "home");
  } catch (error) {
    if (error.status === 401) {
      $("#loading").hidden = true;
      $("#loginGate").hidden = false;
      $("#accessPassword").focus();
      return;
    }
    $("#loading").textContent = `${error.message} Tải lại trang để thử lại.`;
    toast(error.message, true);
  }
}
$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  const password = $("#accessPassword").value;
  button.disabled = true;
  $("#loginError").textContent = "";
  try {
    await api("login", { password });
    $("#accessPassword").value = "";
    await initializeApp();
  } catch (error) { $("#loginError").textContent = error.message; }
  finally { button.disabled = false; }
});
function welcomeVisible(){let returning=false;try{returning=localStorage.getItem('noi-returning')==='1';}catch{}return location.hash.startsWith('#welcome')||(!returning&&!location.hash&&!new URLSearchParams(location.search).has('set'));}
function openWelcome(){document.body.classList.add('is-welcome');$('#welcomePage').hidden=false;$('#loginGate').hidden=true;}
function enterLearning(){document.body.classList.remove('is-welcome');$('#welcomePage').hidden=true;initializeApp();}
$('#welcomeContinue').addEventListener('click',()=>{history.replaceState(null,'','/#home');enterLearning();});
$('#welcomeForm').addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.currentTarget),goal=form.get('goal'),level=form.get('level');const goals={conversation:'Tự tin giao tiếp tiếng Anh trong đời sống',toeic:'Học tiếng Anh công sở và nền tảng TOEIC',foundation:'Xây lại nền tảng tiếng Anh'};try{sessionStorage.setItem('noi-onboarding',JSON.stringify({goal:goals[goal],level,minutesPerDay:Number(form.get('minutes'))}));}catch{$('#welcomeError').textContent='Trình duyệt chưa cho phép lưu lựa chọn. Hãy dùng nút Vào học phía trên.';return;}const set=goal==='foundation'||level==='A1'?'daily-routine':goal==='toeic'?'office':level==='B1'||level==='B2'?'career-progress':'smalltalk';history.replaceState(null,'',`/?set=${set}&mode=cards#vocabulary`);location.reload();});
if(welcomeVisible())openWelcome();else initializeApp();
window.addEventListener('hashchange',()=>{if(location.hash==='#welcome')openWelcome();});

// A focused conversation view, with an explicit way back.
function setChatExpanded(expanded){document.body.classList.toggle('chat-expanded',expanded);const button=$('#expandChat');button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',expanded?'Thu gọn khung chat':'Phóng rộng khung chat');button.textContent=expanded?'Thu gọn ↙':'Phóng rộng ↗';}
$('#expandChat').addEventListener('click',()=>setChatExpanded(!document.body.classList.contains('chat-expanded')));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('chat-expanded')){setChatExpanded(false);$('#expandChat').focus();}});
window.addEventListener('hashchange',()=>{if(location.hash!=='#practice')setChatExpanded(false);});
$('#messageInput').addEventListener('input',event=>{event.target.style.height='auto';event.target.style.height=Math.min(event.target.scrollHeight,140)+'px';event.target.style.overflowY=event.target.scrollHeight>140?'auto':'hidden';});
