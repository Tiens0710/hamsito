import { CONVERSATION_SETS } from './english-conversation-content.mjs';
import { addListeningDrills } from './english-listening-content.mjs';
import { FOUNDATION_SETS } from './english-foundation-content.mjs';
import { TOEIC_SETS } from './english-toeic-content.mjs';
import { EXTRA_VOCABULARY_SETS, expandExistingVocabulary } from './english-vocabulary-expansion.mjs';
// Original teaching material for Nói. Each reading reuses the set's exact terms.
const word = (term, meaning, ipa, type, example, translation, synonyms = []) => ({ id: term.replace(/\s+/g, '-'), term, meaning, ipa, type, example, translation, synonyms });
export const VOCABULARY_SETS = [
  { id: 'cafe', topic: 'cafe', title: 'Ở quán cà phê', level: 'A1–A2', description: 'Gọi món, chọn đồ uống và thanh toán.', words: [
    word('order','gọi món','/ˈɔːrdər/','động từ','Could I order a coffee, please?','Cho tôi gọi một ly cà phê nhé?'),
    word('iced','có đá','/aɪst/','tính từ','I would like an iced latte.','Tôi muốn một ly latte đá.'),
    word('size','kích cỡ','/saɪz/','danh từ','What size would you like?','Bạn muốn cỡ nào?'),
    word('takeaway','đồ mang đi','/ˈteɪkəweɪ/','danh từ','Is this coffee for takeaway?','Ly cà phê này mang đi phải không?'),
    word('receipt','hóa đơn','/rɪˈsiːt/','danh từ','Could I have a receipt, please?','Cho tôi xin hóa đơn nhé?'),
    word('recommend','gợi ý, đề xuất','/ˌrekəˈmend/','động từ','What drink do you recommend?','Bạn gợi ý đồ uống nào?'),
    word('sweet','ngọt','/swiːt/','tính từ','This drink is a little too sweet.','Đồ uống này hơi ngọt quá.'),
    word('change','tiền thừa','/tʃeɪndʒ/','danh từ','Here is your change.','Đây là tiền thừa của bạn.'),
  ], readings: [
    { title:'A coffee before work', level:'A1–A2', sentences:[
      ['On Monday morning, I stop at a small café to [[order]] a coffee before work.','Sáng thứ Hai, tôi ghé một quán nhỏ gọi cà phê trước khi đi làm.'],
      ['The weather is warm, so I choose an [[iced]] latte instead of a hot drink.','Trời ấm nên tôi chọn latte đá thay vì đồ uống nóng.'],
      ['The barista asks what [[size]] I want, and I choose a small cup.','Nhân viên hỏi cỡ ly và tôi chọn ly nhỏ.'],
      ['I do not have time to sit down, so I ask for [[takeaway]].','Tôi không có thời gian ngồi lại nên mua mang đi.'],
      ['I also ask the barista to [[recommend]] a snack that is not too [[sweet]].','Tôi nhờ nhân viên gợi ý một món ăn nhẹ không quá ngọt.'],
      ['I pay with cash, collect my [[change]], and put the [[receipt]] in my bag before leaving.','Tôi trả tiền mặt, nhận tiền thừa và cất hóa đơn vào túi trước khi rời đi.'],
    ], questions:[{prompt:'Why does the customer choose takeaway?',options:['The café is closed.','The customer is in a hurry.','There are no cups.','The drink is too hot.'],answer:1,explanation:'Người mua không có thời gian ngồi lại trước khi đi làm.'},{prompt:'How does the customer pay?',options:['With cash.','By bank transfer.','With a gift card.','A friend pays.'],answer:0,explanation:'Câu cuối nói “I pay with cash”.'}]},
    { title:'Choosing something new', level:'A2–B1', sentences:[
      ['My friend and I visit a café after lunch, but we cannot decide what to [[order]].','Tôi và bạn ghé quán sau bữa trưa nhưng chưa biết gọi gì.'],
      ['We ask the barista to [[recommend]] a drink with less sugar because we dislike very [[sweet]] coffee.','Chúng tôi nhờ gợi ý đồ uống ít đường vì không thích cà phê quá ngọt.'],
      ['She suggests an [[iced]] coffee and explains that the medium [[size]] is enough for most customers.','Cô ấy gợi ý cà phê đá và nói cỡ vừa là đủ với đa số khách.'],
      ['We sit by the window instead of choosing [[takeaway]], and talk about our plans for the weekend.','Chúng tôi ngồi bên cửa sổ thay vì mang đi và nói về cuối tuần.'],
      ['When we finish, my friend pays in cash, checks the [[receipt]], and leaves some of the [[change]] as a tip.','Khi xong, bạn tôi trả tiền mặt, kiểm tra hóa đơn và để lại một ít tiền thừa làm tiền tip.'],
    ], questions:[{prompt:'What kind of drink do the friends want?',options:['A drink with extra sugar.','A large hot chocolate.','A drink with less sugar.','A sweet milkshake.'],answer:2,explanation:'Họ yêu cầu “a drink with less sugar”.'},{prompt:'Where do they have their drinks?',options:['At work.','On a bus.','At home.','By the café window.'],answer:3,explanation:'Họ ngồi bên cửa sổ, không chọn mang đi.'}]},
  ]},
  { id:'travel',topic:'travel',title:'Nhận phòng khách sạn',level:'A2',description:'Đặt phòng, hỏi dịch vụ và nhờ hỗ trợ.',words:[
    word('reservation','đặt chỗ, đặt phòng','/ˌrezərˈveɪʃən/','danh từ','I have a reservation for two nights.','Tôi đã đặt phòng hai đêm.',['booking']),
    word('check in','làm thủ tục nhận phòng','/tʃek ɪn/','cụm động từ','Can I check in now?','Tôi có thể nhận phòng bây giờ không?'),
    word('passport','hộ chiếu','/ˈpæspɔːrt/','danh từ','Here is my passport.','Đây là hộ chiếu của tôi.'),
    word('luggage','hành lý','/ˈlʌɡɪdʒ/','danh từ','Can I leave my luggage here?','Tôi có thể để hành lý ở đây không?',['baggage']),
    word('included','được bao gồm','/ɪnˈkluːdɪd/','tính từ','Is breakfast included?','Giá đã bao gồm bữa sáng chưa?'),
    word('available','còn trống, có sẵn','/əˈveɪləbəl/','tính từ','Is a quiet room available?','Có phòng yên tĩnh nào còn trống không?'),
    word('reception','quầy lễ tân','/rɪˈsepʃən/','danh từ','Please call reception if you need help.','Hãy gọi lễ tân nếu bạn cần giúp.'),
    word('checkout','việc trả phòng','/ˈtʃekaʊt/','danh từ','What time is checkout?','Mấy giờ trả phòng?'),
  ],readings:[{title:'An early arrival',level:'A2',sentences:[
    ['I arrive at the hotel before noon and walk to [[reception]] with my [[luggage]].','Tôi đến khách sạn trước trưa và mang hành lý đến quầy lễ tân.'],
    ['I have a [[reservation]] for two nights, but I am not sure if I can [[check-in]] so early.','Tôi đặt phòng hai đêm nhưng không chắc có thể nhận phòng sớm không.'],
    ['The receptionist checks my [[passport]] and says that a room is already [[available]].','Lễ tân kiểm tra hộ chiếu và nói đã có phòng trống.'],
    ['She tells me that breakfast is [[included]] and that [[checkout]] is at eleven in the morning.','Cô ấy nói đã bao gồm bữa sáng và giờ trả phòng là 11 giờ sáng.'],
    ['I thank her, take my key, and go upstairs to rest before exploring the city.','Tôi cảm ơn, nhận chìa khóa và lên phòng nghỉ trước khi khám phá thành phố.'],
  ],questions:[{prompt:'When does the guest arrive?',options:['After midnight.','Before noon.','In the evening.','After checkout.'],answer:1,explanation:'Câu đầu cho biết khách đến trước buổi trưa.'},{prompt:'Does the guest need to pay extra for breakfast?',options:['Yes, every day.','Only on Sunday.','No, it is included.','The text does not mention breakfast.'],answer:2,explanation:'Lễ tân nói “breakfast is included”.'}]},
  {title:'One more day in the city',level:'A2–B1',sentences:[
    ['On my last morning, I ask [[reception]] whether a room is [[available]] for one more night.','Vào buổi sáng cuối cùng, tôi hỏi lễ tân có phòng thêm một đêm không.'],
    ['The hotel is full, so I make a new [[reservation]] at a nearby hotel where breakfast is [[included]].','Khách sạn đã kín nên tôi đặt phòng nơi gần đó có bao gồm bữa sáng.'],
    ['After [[checkout]], I collect my [[luggage]] and walk to the new hotel.','Sau khi trả phòng, tôi lấy hành lý và đi bộ đến khách sạn mới.'],
    ['I show my [[passport]] and ask if I can [[check-in]] before lunch.','Tôi đưa hộ chiếu và hỏi có thể nhận phòng trước bữa trưa không.'],
    ['The receptionist welcomes me and gives me a map of the neighbourhood.','Lễ tân chào đón và đưa tôi bản đồ khu vực.'],
  ],questions:[{prompt:'Why does the traveller change hotels?',options:['The first hotel is full.','Breakfast is too early.','The traveller lost a key.','The room is too large.'],answer:0,explanation:'Khách sạn đầu tiên không còn phòng cho đêm tiếp theo.'},{prompt:'What does the new receptionist give the traveller?',options:['A passport.','A train ticket.','A suitcase.','A local map.'],answer:3,explanation:'Câu cuối nói lễ tân đưa bản đồ khu vực.'}]}]},
  {id:'smalltalk',topic:'smalltalk',title:'Làm quen & sở thích',level:'A1–A2',description:'Giới thiệu bản thân và giữ câu chuyện tiếp tục.',words:[
    word('neighbour','hàng xóm','/ˈneɪbər/','danh từ','My neighbour is very friendly.','Hàng xóm của tôi rất thân thiện.',['neighbor']),
    word('hobby','sở thích','/ˈhɑːbi/','danh từ','Photography is my favourite hobby.','Chụp ảnh là sở thích tôi yêu nhất.'),
    word('usually','thường, thường xuyên','/ˈjuːʒuəli/','trạng từ','I usually walk after dinner.','Tôi thường đi bộ sau bữa tối.'),
    word('nearby','ở gần, gần đó','/ˌnɪrˈbaɪ/','trạng từ','There is a nice park nearby.','Có một công viên đẹp gần đây.'),
    word('weekend','cuối tuần','/ˈwiːkend/','danh từ','Do you have plans for the weekend?','Bạn có kế hoạch gì cho cuối tuần không?'),
    word('invite','mời','/ɪnˈvaɪt/','động từ','Can I invite a friend?','Tôi có thể mời một người bạn không?'),
    word('relax','thư giãn','/rɪˈlæks/','động từ','I read books to relax.','Tôi đọc sách để thư giãn.'),
    word('together','cùng nhau','/təˈɡeðər/','trạng từ','We could have lunch together.','Chúng ta có thể ăn trưa cùng nhau.'),
  ],readings:[{title:'A new face in the building',level:'A1–A2',sentences:[
    ['On Saturday, I meet my new [[neighbour]] in the lift and ask about her [[weekend]].','Thứ Bảy, tôi gặp hàng xóm mới trong thang máy và hỏi về cuối tuần.'],
    ['She says that her favourite [[hobby]] is photography and that she [[usually]] takes photos in a park [[nearby]].','Cô ấy thích chụp ảnh và thường chụp tại công viên gần đó.'],
    ['I tell her that I like to walk outside and [[relax]] after a busy week.','Tôi nói mình thích đi bộ và thư giãn sau một tuần bận rộn.'],
    ['I decide to [[invite]] her for a walk, and we agree to visit the park [[together]] on Sunday.','Tôi mời cô ấy đi bộ và chúng tôi đồng ý đến công viên cùng nhau vào Chủ nhật.'],
  ],questions:[{prompt:'What does the neighbour enjoy doing?',options:['Cooking.','Swimming.','Taking photographs.','Playing tennis.'],answer:2,explanation:'Sở thích của cô ấy là photography — chụp ảnh.'},{prompt:'What do they plan to do on Sunday?',options:['Visit the park together.','Go to work.','Move to another building.','Buy a camera.'],answer:0,explanation:'Họ đồng ý đến công viên cùng nhau vào Chủ nhật.'}]},
  {title:'A small weekend plan',level:'A2–B1',sentences:[
    ['I [[usually]] spend the [[weekend]] at home, but this time my [[neighbour]] has a different idea.','Tôi thường ở nhà cuối tuần nhưng lần này hàng xóm có ý tưởng khác.'],
    ['She wants to [[invite]] a few people to a picnic in a garden [[nearby]].','Cô ấy muốn mời vài người đi dã ngoại tại khu vườn gần nhà.'],
    ['Everyone can bring something related to a [[hobby]], such as a book, a camera, or a musical instrument.','Mỗi người có thể mang thứ liên quan đến sở thích như sách, máy ảnh hoặc nhạc cụ.'],
    ['We can share stories, eat [[together]], and [[relax]] without looking at our phones.','Chúng tôi có thể kể chuyện, ăn cùng nhau và thư giãn không dùng điện thoại.'],
  ],questions:[{prompt:'What is different about this weekend?',options:['The writer will work.','The writer plans to join a picnic.','The garden is closed.','The neighbour is moving.'],answer:1,explanation:'Lần này họ dự định đi dã ngoại thay vì ở nhà.'},{prompt:'What can people bring?',options:['Only food.','Only their phones.','Nothing at all.','Something connected to a hobby.'],answer:3,explanation:'Mỗi người có thể mang vật liên quan đến sở thích của mình.'}]}]},
  {id:'interview',topic:'interview',title:'Ứng tuyển & công việc',level:'A2–B1',description:'Nói về kinh nghiệm và chuẩn bị phỏng vấn.',words:[
    word('apply','nộp đơn, ứng tuyển','/əˈplaɪ/','động từ','I want to apply for this position.','Tôi muốn ứng tuyển vị trí này.'),
    word('experience','kinh nghiệm','/ɪkˈspɪriəns/','danh từ','I have experience in customer service.','Tôi có kinh nghiệm chăm sóc khách hàng.'),
    word('candidate','ứng viên','/ˈkændɪdət/','danh từ','Each candidate has a short interview.','Mỗi ứng viên có một buổi phỏng vấn ngắn.',['applicant']),
    word('interview','buổi phỏng vấn','/ˈɪntərvjuː/','danh từ','My interview is on Thursday.','Buổi phỏng vấn của tôi vào thứ Năm.'),
    word('skills','các kỹ năng','/skɪlz/','danh từ số nhiều','I want to improve my communication skills.','Tôi muốn cải thiện kỹ năng giao tiếp.'),
    word('position','vị trí công việc','/pəˈzɪʃən/','danh từ','Is this position still open?','Vị trí này còn tuyển không?'),
    word('deadline','hạn chót','/ˈdedlaɪn/','danh từ','What is the application deadline?','Hạn chót nộp hồ sơ là khi nào?'),
    word('confident','tự tin','/ˈkɑːnfɪdənt/','tính từ','I feel more confident after practising.','Tôi tự tin hơn sau khi luyện tập.'),
  ],readings:[{title:'Getting ready for an interview',level:'A2',sentences:[
    ['Linh wants to [[apply]] for a sales [[position]] at a local shop before the [[deadline]] on Friday.','Linh muốn ứng tuyển vị trí bán hàng ở cửa hàng gần nhà trước hạn thứ Sáu.'],
    ['She has some [[experience]] helping customers and wants to develop her communication [[skills]].','Cô có kinh nghiệm hỗ trợ khách hàng và muốn phát triển kỹ năng giao tiếp.'],
    ['The manager invites each [[candidate]] to an [[interview]] next week.','Quản lý mời mỗi ứng viên phỏng vấn vào tuần sau.'],
    ['Linh prepares two examples of her work and practises with a friend so that she feels more [[confident]].','Linh chuẩn bị hai ví dụ công việc và luyện với bạn để tự tin hơn.'],
  ],questions:[{prompt:'When is the application deadline?',options:['Next Monday.','On Friday.','In two months.','After the interview.'],answer:1,explanation:'Hạn chót được nêu ở câu đầu: on Friday.'},{prompt:'How does Linh prepare?',options:['She cancels the interview.','She buys a new shop.','She practises and prepares work examples.','She calls every candidate.'],answer:2,explanation:'Câu cuối nói cô chuẩn bị ví dụ công việc và luyện cùng bạn.'}]},
  {title:'A conversation with the manager',level:'B1',sentences:[
    ['After reading about an open [[position]], Nam decides to [[apply]] before the [[deadline]].','Sau khi đọc vị trí đang tuyển, Nam quyết định nộp đơn trước hạn.'],
    ['At the [[interview]], the manager asks him to describe his [[experience]] working with a team.','Trong buổi phỏng vấn, quản lý hỏi kinh nghiệm làm việc nhóm.'],
    ['Instead of listing every task, he explains how he used his communication [[skills]] to help a new colleague.','Thay vì liệt kê mọi nhiệm vụ, anh giải thích cách dùng kỹ năng giao tiếp hỗ trợ đồng nghiệp mới.'],
    ['The manager says that a good [[candidate]] can explain both strengths and areas for improvement.','Quản lý nói một ứng viên tốt giải thích được cả điểm mạnh và điều cần cải thiện.'],
    ['Nam leaves feeling [[confident]], even though he does not yet know the result.','Nam rời đi với sự tự tin dù chưa biết kết quả.'],
  ],questions:[{prompt:'What example does Nam give?',options:['Helping a new colleague.','Building a new shop.','Missing a deadline.','Working alone for years.'],answer:0,explanation:'Anh kể về việc dùng kỹ năng giao tiếp giúp đồng nghiệp mới.'},{prompt:'Does Nam know the result when he leaves?',options:['Yes, he got the job.','Yes, he was rejected.','The manager cancelled it.','No, he is still waiting.'],answer:3,explanation:'Câu cuối nói anh vẫn chưa biết kết quả.'}]}]},
];

VOCABULARY_SETS.push(...TOEIC_SETS, ...FOUNDATION_SETS, ...CONVERSATION_SETS);
expandExistingVocabulary(VOCABULARY_SETS);
VOCABULARY_SETS.push(...EXTRA_VOCABULARY_SETS);
addListeningDrills(VOCABULARY_SETS);

const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const DAY = 86400000;
export function vocabularyState(state) {
  state.learning ||= {};
  const value = state.learning.vocabulary;
  if (!value || typeof value !== 'object' || Array.isArray(value)) state.learning.vocabulary = {};
  const v=state.learning.vocabulary;
  for (const key of ['words','results','drafts','readings']) if (!v[key] || typeof v[key] !== 'object' || Array.isArray(v[key])) v[key]={};
  return v;
}
export function vocabularySnapshot(state, now=Date.now()) {
  const v=vocabularyState(state);
  return { sets:VOCABULARY_SETS.map(set=>({id:set.id,topic:set.topic,title:set.title,level:set.level,description:set.description,track:set.track,stage:set.stage,lesson:set.lesson,words:set.words,readings:[...set.readings,...(v.readings[set.id]||[])].map((r,index)=>({index,title:r.title,level:r.level,listening:!!r.listening,sentences:r.sentences,questions:r.questions.map(({answer,explanation,...q})=>q)}))})),progress:v.words,results:v.results,drafts:v.drafts,selectedSet:v.selectedSet || 'cafe',activeSet:v.activeSet || null,dueCount:Object.values(v.words).filter(w=>w.reviews>0&&w.dueAt<=now).length };
}
function updateWord(v,set,id,correct,now) {
  const key=`${set.id}:${id}`, old=v.words[key] || {};
  const stage=correct?Math.min(5,(old.stage||0)+1):0;
  v.words[key]={...old,stage,status:stage>=3?'mastered':'learning',reviews:(old.reviews||0)+1,correct:(old.correct||0)+(correct?1:0),dueAt:now+(correct?[1,1,3,7,14,30][stage]*DAY:600000),updatedAt:now};
}
export function vocabularyAction(state, body, now=Date.now()) {
  const set=VOCABULARY_SETS.find(s=>s.id===body.setId);
  if (!set) throw new Error('Bộ từ không tồn tại.');
  const v=vocabularyState(state); v.selectedSet=set.id;
  const w=set.words.find(w=>w.id===body.wordId);
  if (body.action==='select') return {selected:true};
  if (body.action==='use') {v.activeSet=set.id; return {topic:set.topic};}
  if (body.action==='star') {
    if(!w||typeof body.starred!=='boolean') throw new Error('Từ hoặc trạng thái đánh dấu không hợp lệ.');
    const key=`${set.id}:${w.id}`; v.words[key]={...(v.words[key]||{}),starred:body.starred}; return {starred:body.starred};
  }
  if (body.action==='review') {
    if(!w||!['again','good'].includes(body.rating)) throw new Error('Chọn từ và mức độ nhớ.');
    updateWord(v,set,w.id,body.rating==='good',now);return {saved:true};
  }
  if (body.action==='answer') {
    if(!w||!['learn','dictation'].includes(body.mode)||typeof body.answer!=='string'||body.answer.length>600) throw new Error('Câu trả lời không hợp lệ.');
    const target=body.mode==='dictation'&&body.example===true?w.example:w.term;
    const accepted=body.mode==='learn'&&body.synonyms===true?[w.term,...w.synonyms]:[target];
    const correct=accepted.some(a=>normalize(a)===normalize(body.answer));
    updateWord(v,set,w.id,correct,now);
    const result={correct,answer:target,meaning:w.meaning,explanation:w.translation,given:body.answer};
    const key=`${set.id}:${body.mode}`;v.results[key]={...result,wordId:w.id,at:now};return result;
  }
  if(body.action==='draft') {
    if(!['reading','learn','dictation'].includes(body.mode))throw new Error('Chế độ không hợp lệ.');
    const key=`${set.id}:${body.mode}`;
    if (body.draft===null) {delete v.drafts[key];return {saved:true};}
    if(!body.draft||JSON.stringify(body.draft).length>6000)throw new Error('Bài đang làm quá dài.');
    v.drafts[key]={...body.draft,updatedAt:now};return {saved:true};
  }
  if(body.action==='reading') {
    const reading=[...set.readings,...(v.readings[set.id]||[])][body.index];
    if(!reading||!Number.isInteger(body.index)||!Array.isArray(body.answers)||!Array.isArray(body.choices))throw new Error('Bài đọc không hợp lệ.');
    const ids=reading.sentences.flatMap(([sentence])=>[...sentence.matchAll(/\[\[([^\]]+)\]\]/g)].map(m=>m[1]));
    if(body.answers.length!==ids.length||body.choices.length!==reading.questions.length||body.answers.some(a=>typeof a!=='string'||!a.trim()||a.length>120)||body.choices.some(a=>!Number.isInteger(a)||a<0||a>3))throw new Error('Điền đủ các ô và chọn đáp án đọc hiểu trước khi kiểm tra.');
    const blanks=ids.map((id,index)=>{const word=set.words.find(w=>w.id===id);const correct=normalize(body.answers[index])===normalize(word.term);updateWord(v,set,id,correct,now);return {id,correct,given:body.answers[index],answer:word.term,meaning:word.meaning};});
    const questions=reading.questions.map((q,index)=>({correct:body.choices[index]===q.answer,answer:q.answer,explanation:q.explanation}));
    const score=blanks.filter(b=>b.correct).length+questions.filter(q=>q.correct).length;
    const key=`${set.id}:reading:${body.index}`;const old=v.results[key];
    const result={index:body.index,blanks,questions,score,total:blanks.length+questions.length,at:now,attempts:(old?.attempts||0)+1,best:Math.max(old?.best||0,score)};
    v.results[key]=result;delete v.drafts[`${set.id}:reading`];return result;
  }
  throw new Error('Thao tác từ vựng không hợp lệ.');
}

export function vocabularyContext(state) {
  const v=vocabularyState(state),set=VOCABULARY_SETS.find(s=>s.id===v.activeSet);
  if(!set || state.topic!==set.topic)return '';
  const words=set.words.map(w=>({term:w.term,meaning:w.meaning,needsPractice:v.words[`${set.id}:${w.id}`]?.stage===0}));
  return `\nBỘ TỪ ĐANG ÁP DỤNG: ${JSON.stringify({title:set.title,words,speakingTask:set.lesson?.speaking})}. Trong vai người đối diện, tạo cơ hội tự nhiên để người học dùng 2–3 từ của bộ này, ưu tiên từ còn yếu. Không nhồi toàn bộ từ vào một câu hoặc làm hộ câu trả lời.`;
}

export function vocabularyReadingPrompt(state, setId, level) {
  const set=VOCABULARY_SETS.find(s=>s.id===setId);
  if(!set||!['A1','A2','B1','B2','C1'].includes(level))throw new Error('Chọn bộ từ và mức đọc hợp lệ.');
  const saved=vocabularyState(state).readings[setId]||[];
  if(saved.length>=10)throw new Error('Bộ từ này đã có 10 bài AI. Bạn có thể ôn các bài đã lưu.');
  return `Write an original, coherent English reading passage for a Vietnamese adult learning everyday conversation. Topic: ${set.title}. CEFR level ${level}. Use ALL these exact vocabulary tokens once each as inline gaps: ${JSON.stringify(set.words.map(w=>({id:w.id,term:w.term,meaning:w.meaning})))}. Insert [[id]] in place of each vocabulary term; keep the surrounding grammar correct without changing the term. 5–7 sentences, 100–150 English words in total, connected as a small story. Give a natural Vietnamese translation for each COMPLETE sentence including the missing word. Add 2 reading comprehension questions in English with four choices, one correct index 0–3 and a short Vietnamese explanation grounded in the passage. Avoid these previous titles: ${JSON.stringify([...set.readings,...saved].map(r=>r.title))}. Return ONLY JSON: {"title":"...","sentences":[["English with [[id]]","Vietnamese translation"]],"questions":[{"prompt":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}.`;
}
export function appendVocabularyReading(state,setId,level,raw) {
  const set=VOCABULARY_SETS.find(s=>s.id===setId),v=vocabularyState(state);
  let r;try{r=JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{}
  const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
  if(!set||!r||!text(r.title,100)||!Array.isArray(r.sentences)||r.sentences.length<4||r.sentences.length>8||r.sentences.some(s=>!Array.isArray(s)||s.length!==2||!text(s[0],600)||!text(s[1],650))||!Array.isArray(r.questions)||r.questions.length!==2||r.questions.some(q=>!text(q.prompt,300)||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>!text(o,200))||new Set(q.options).size!==4||!Number.isInteger(q.answer)||q.answer<0||q.answer>3||!text(q.explanation,400)))throw new Error('AI chưa tạo được bài đọc đúng định dạng. Bạn thử lại nhé.');
  const ids=r.sentences.flatMap(([s])=>[...s.matchAll(/\[\[([^\]]+)\]\]/g)].map(m=>m[1]));
  if(ids.length!==set.words.length||new Set(ids).size!==set.words.length||ids.some(id=>!set.words.some(w=>w.id===id)))throw new Error('Bài mới chưa dùng đủ các từ của bộ. Hãy thử tạo lại.');
  const saved=v.readings[setId]||[];if(saved.length>=10)throw new Error('Bộ từ đã có 10 bài AI được lưu.');
  const reading={title:r.title.trim(),level,sentences:r.sentences,questions:r.questions,createdAt:Date.now()};
  v.readings[setId]=[...saved,reading];
  return {index:set.readings.length+saved.length};
}
