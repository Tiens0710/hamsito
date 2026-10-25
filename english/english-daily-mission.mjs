const PHRASES = {
  smalltalk: [['Nice to meet you.','Rất vui được gặp bạn.'],['What do you do?','Bạn làm công việc gì?'],['What do you like to do in your free time?','Bạn thích làm gì lúc rảnh?']],
  cafe: [['Could I have a coffee, please?','Cho tôi một ly cà phê nhé.'],['Could I have it without sugar?','Cho tôi không đường nhé.'],['Can I pay by card?','Tôi thanh toán bằng thẻ được không?']],
  travel: [['I have a booking under Nguyen.','Tôi đặt phòng dưới tên Nguyen.'],['What time is check-out?','Mấy giờ trả phòng?'],['Could you help me with my luggage?','Bạn giúp tôi mang hành lý được không?']],
  work: [["I’m working on the report.",'Tôi đang làm báo cáo.'],['Could we move the meeting to Friday?','Mình dời cuộc họp sang thứ Sáu được không?'],['When do you need it?','Bạn cần khi nào?']],
  'daily-routine': [['I usually get up at seven.','Tôi thường dậy lúc bảy giờ.'],['I go for a walk after work.','Tôi đi dạo sau giờ làm.'],['Would you like to join me?','Bạn muốn đi cùng không?']],
  shopping: [['Do you have this in a larger size?','Bạn có cỡ lớn hơn không?'],['How much is it?','Cái này bao nhiêu tiền?'],['Could I try it on?','Tôi thử được không?']],
  directions: [['How do I get to the station?','Tôi đến nhà ga bằng cách nào?'],['So I turn left here?','Vậy tôi rẽ trái ở đây đúng không?'],['Is it within walking distance?','Tôi đi bộ đến đó được không?']],
  meeting: [['I think we could try another approach.','Tôi nghĩ mình có thể thử cách khác.'],["That’s a good point.",'Đó là một ý hay.'],['What do you think?','Bạn nghĩ sao?']],
  interview: [['In my previous role, I helped customers.','Ở công việc trước, tôi hỗ trợ khách hàng.'],['One example is a project I led last year.','Một ví dụ là dự án tôi phụ trách năm ngoái.'],['I would like to develop my communication skills.','Tôi muốn phát triển kỹ năng giao tiếp.']],
  opinions: [['From my point of view, it is useful.','Theo tôi, điều đó hữu ích.'],['What makes you think that?','Điều gì khiến bạn nghĩ vậy?'],['I agree, but I have a different idea.','Tôi đồng ý, nhưng có một ý khác.']],
};
const dateKey = now => new Date(now).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
export function dailyMission(state, recommended, now=Date.now()) {
  const saved=state.learning?.dailyMission;
  const current=saved?.day===dateKey(now)?saved:null;
  const topic=current?.topic||recommended.topic;
  const turns=current?.stage>=2?Math.max(0,Number(state.topics?.[topic]||0)-current.baseline):0;
  return {day:dateKey(now),topic,stage:current?.stage||0,turns,target:3,phrases:PHRASES[topic]||PHRASES.smalltalk,completed:!!current?.completed};
}
export function updateDailyMission(state,recommended,action,index,now=Date.now()) {
  let mission=dailyMission(state,recommended,now);
  let saved=state.learning.dailyMission;
  if(!saved||saved.day!==mission.day) saved={day:mission.day,topic:mission.topic,stage:0,learned:[],baseline:0,completed:false};
  if(action==='learn') {
    if(!Number.isInteger(index)||index<0||index>=3) throw new Error('Câu học không hợp lệ.');
    saved.learned=[...new Set([...saved.learned,index])];
    if(saved.learned.length===3) saved.stage=Math.max(saved.stage,1);
  } else if(action==='practice') {
    if(saved.stage<1) throw new Error('Hãy làm quen cả 3 câu trước nhé.');
    if(saved.stage<2){saved.baseline=Number(state.topics?.[saved.topic]||0);saved.stage=2;}
  } else if(action==='finish') {
    if(mission.turns<mission.target) throw new Error('Hãy trao đổi đủ 3 lượt trong tình huống này trước nhé.');
    saved.completed=true;saved.stage=3;
  } else throw new Error('Thao tác không hợp lệ.');
  state.learning.dailyMission=saved;
}
