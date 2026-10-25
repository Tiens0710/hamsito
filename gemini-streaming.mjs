import { AsyncLocalStorage } from 'node:async_hooks';
export const coachStreamContext=new AsyncLocalStorage();
function visibleReply(raw){
 const match=/"reply"\s*:\s*"/.exec(raw);
 if(!match)return /^[\s`]*\{/.test(raw)||raw.trimStart().startsWith('```')?'':raw;
 const start=match.index+match[0].length;let escaped=false,end=start;
 for(;end<raw.length;end++){const c=raw[end];if(!escaped&&c==='"')break;if(!escaped&&c==='\\')escaped=true;else escaped=false;}
 let part=raw.slice(start,end);
 for(let i=0;i<7;i++){try{return JSON.parse('"'+part+'"');}catch{part=part.slice(0,-1);}}return '';
}
export async function readGeminiStream(response,onText){
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',raw='',visible='',finishReason='';
 const consume=event=>{const payload=event.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n').trim();if(!payload||payload==='[DONE]')return;const data=JSON.parse(payload);if(data.error)throw new Error('AI stream failed');const choice=data.choices?.[0];raw+=choice?.delta?.content||'';finishReason=choice?.finish_reason||finishReason;const next=visibleReply(raw);if(next&&next!==visible){visible=next;onText?.(next);}};
 try{while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});let match;while((match=/\r?\n\r?\n/.exec(buffer))){consume(buffer.slice(0,match.index));buffer=buffer.slice(match.index+match[0].length);}if(done)break;if(buffer.length>2_000_000||raw.length>100_000)throw new Error('AI stream too large');}if(buffer.trim())consume(buffer);if(!raw)throw new Error('Empty AI stream');return {choices:[{message:{content:raw},finish_reason:finishReason}]};}finally{reader.releaseLock();}
}
