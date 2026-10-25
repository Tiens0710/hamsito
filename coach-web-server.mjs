import http from "node:http";
import { WebSocketServer } from 'ws';
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { consumeWebPairingCode } from "./coach-pairing.mjs";
import { consumeSharedPairingCode, isEnglishCloudConfigured, loadEnglishCoachProfile, saveEnglishCoachProfile } from "./english-cloud-store.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const assets = { "/": ["index.html", "text/html; charset=utf-8"], "/index.html": ["index.html", "text/html; charset=utf-8"], "/app.js": ["app.js", "text/javascript; charset=utf-8"], "/vocabulary.js": ["vocabulary.js", "text/javascript; charset=utf-8"], "/vocabulary.css": ["vocabulary.css", "text/css; charset=utf-8"], "/style.css": ["style.css", "text/css; charset=utf-8"] };
for (const weight of [400, 500, 600]) assets[`/fonts/instrument-sans-${weight}.ttf`] = [`fonts/instrument-sans-${weight}.ttf`, "font/ttf"];
for (const weight of [500, 600]) assets[`/fonts/jetbrains-mono-${weight}.woff2`] = [`fonts/jetbrains-mono-${weight}.woff2`, "font/woff2"];
for (const weight of [400, 500, 600]) assets[`/fonts/be-vietnam-pro-${weight}.ttf`] = [`fonts/be-vietnam-pro-${weight}.ttf`, "font/ttf"];
for (const weight of [400, 500, 600]) assets[`/fonts/be-vietnam-pro-v1-${weight}.woff2`] = [`fonts/be-vietnam-pro-v1-${weight}.woff2`, "font/woff2"];
assets['/fonts/BeVietnamPro-OFL.txt']=['fonts/BeVietnamPro-OFL.txt','text/plain; charset=utf-8'];
assets['/fonts/JetBrainsMono-OFL.txt']=['fonts/JetBrainsMono-OFL.txt','text/plain; charset=utf-8'];
assets['/learning-theme.css']=['learning-theme.css','text/css; charset=utf-8'];
assets['/learning-space.css']=['learning-space.css','text/css; charset=utf-8'];
assets['/daily-mission.js']=['daily-mission.js','text/javascript; charset=utf-8'];
assets['/toeic.js']=['toeic.js','text/javascript; charset=utf-8'];
assets['/toeic.css']=['toeic.css','text/css; charset=utf-8'];
assets['/palette.css']=['palette.css','text/css; charset=utf-8'];
assets['/vocabulary-library.css']=['vocabulary-library.css','text/css; charset=utf-8'];
for(const name of ['conversation-cartoon','study-cartoon','travel-cartoon','work-cartoon']) assets[`/art/${name}.webp`]=[`art/${name}.webp`,'image/webp'];
for(const name of ['cafe','travel','smalltalk','interview','companion','listening']) assets[`/art/${name}.svg`]=[`art/${name}.svg`,'image/svg+xml'];
for(const name of ['city','shopping','airport','calendar','food','story']) assets[`/art/${name}.svg`]=[`art/${name}.svg`,'image/svg+xml'];

export function createCoachWebServer(runtime, options = {}) {
  const dataDir = options.dataDir || path.join(root, "data", "coach-web");
  let secret;
  if (options.sessionSecret) secret = Buffer.from(options.sessionSecret, "utf8");
  else {
    fs.mkdirSync(dataDir, { recursive: true });
    const secretFile = path.join(dataDir, "session-secret");
    if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, randomBytes(32), { mode: 0o600, flag: "wx" });
    secret = fs.readFileSync(secretFile);
  }
  if (secret.length < 32) throw new Error("Web session secret phải có ít nhất 32 byte.");
  const sign = value => createHmac("sha256", secret).update(value).digest("base64url");
  const encode = id => { const payload = Buffer.from(id).toString("base64url"); return `${payload}.${sign(payload)}`; };
  const decode = value => {
    if (typeof value !== "string" || value.length > 300) return null;
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra) return null;
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const id = Buffer.from(payload, "base64url").toString("utf8");
    return /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : null;
  };
  const limits = new Map();
  const rateLimit = (key, max) => {
    const now = Date.now();
    for (const [id, entry] of limits) if (entry.until <= now) limits.delete(id);
    const entry = limits.get(key) || { count: 0, until: now + 60_000 };
    entry.count += 1;
    limits.set(key, entry);
    return entry.count > max;
  };
  const cookie = (name, id) => `${name}=${encode(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${options.secureCookies ? "; Secure" : ""}`;
  const json = (res, status, data) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
  const snapshot = id => ({ ...runtime.snapshot(id), configured: runtime.configured, enabled: runtime.enabled, paired: !id.startsWith("web-") });
  const sameOrigin = (req, host) => {
    const protocol = options.allowRemote ? String(req.headers["x-forwarded-proto"] || "https") : "http";
    return (!options.allowRemote || protocol === "https") && req.headers.origin === `${protocol || "http"}://${host}`;
  };
  const parseBody = async (req, res) => {
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) {
      json(res, 403, { error: "Yêu cầu phải gửi JSON từ ứng dụng này." });
      return null;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 20_000) { json(res, 413, { error: "Nội dung quá dài." }); req.resume(); return null; }
      chunks.push(chunk);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { json(res, 400, { error: "Nội dung JSON không hợp lệ." }); return null; }
    if (!body || typeof body !== "object" || Array.isArray(body)) { json(res, 400, { error: "Nội dung không hợp lệ." }); return null; }
    return body;
  };
  const hydrate = async id => {
    if (!options.loadLearner || !runtime.importLearnerData) return;
    const data = await options.loadLearner(id);
    if (data) runtime.importLearnerData(id, data);
  };
  const persist = async id => {
    if (!options.saveLearner || !runtime.exportLearnerData) return;
    await options.saveLearner(id, runtime.exportLearnerData(id));
  };

  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host = req.headers.host || "";
      if (options.allowRemote ? !/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(host) : !/^(?:127\.0\.0\.1|localhost):\d+$/.test(host)) return json(res, 403, { error: "Địa chỉ truy cập không hợp lệ." });
      const protocol = options.allowRemote ? String(req.headers["x-forwarded-proto"] || "https") : "http";
      if (options.allowRemote && protocol !== "https") return json(res, 403, { error: "Ứng dụng chỉ chấp nhận kết nối HTTPS." });
      const url = new URL(req.url, `${protocol}://${host}`);
      if (!url.pathname.startsWith("/api/")) {
        const asset = assets[url.pathname];
        if (req.method !== "GET" || !asset) return json(res, 404, { error: "Không tìm thấy trang." });
        const content = fs.readFileSync(path.join(options.staticDir || path.join(root, "web", "dist"), asset[0]));
        res.writeHead(200, { "Content-Type": asset[1], "Cache-Control": /^\/fonts\/be-vietnam-pro-v1-\d+\.woff2$/.test(url.pathname) ? "public, max-age=31536000, immutable" : "no-cache" });
        return res.end(content);
      }
      const cookies = Object.fromEntries(String(req.headers.cookie || "").split(";").map(item => item.trim().split("=")).filter(item => item.length === 2));
      if (url.pathname === "/api/login") {
        if (!options.requireAuth || req.method !== "POST") return json(res, 404, { error: "Không tìm thấy chức năng." });
        if (!sameOrigin(req, host)) return json(res, 403, { error: "Yêu cầu phải đến từ ứng dụng này." });
        if (rateLimit(`login:${req.socket.remoteAddress}`, 8)) return json(res, 429, { error: "Bạn thử đăng nhập nhiều lần. Đợi một phút rồi thử lại nhé." });
        const body = await parseBody(req, res);
        if (!body) return;
        const expected = createHmac("sha256", secret).update(String(options.accessPassword || "")).digest();
        const given = createHmac("sha256", secret).update(typeof body.password === "string" ? body.password : "").digest();
        if (!options.accessPassword || !timingSafeEqual(expected, given)) return json(res, 401, { error: "Mật khẩu chưa đúng." });
        res.setHeader("Set-Cookie", cookie("coach_access", "access"));
        return json(res, 200, { authenticated: true });
      }
      if (options.requireAuth && decode(cookies.coach_access) !== "access") return json(res, 401, { error: "Nhập mật khẩu để mở không gian học." });
      const localId = decode(cookies.coach_local) || `web-${randomBytes(16).toString("hex")}`;
      const learnerId = decode(cookies.coach_session) || localId;
      const setCookies = [];
      if (!decode(cookies.coach_local)) setCookies.push(cookie("coach_local", localId));
      if (!decode(cookies.coach_session)) setCookies.push(cookie("coach_session", learnerId));
      if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
      if (req.method === "GET" && url.pathname === "/api/state") {
        await hydrate(learnerId);
        return json(res, 200, snapshot(learnerId));
      }
      if (req.method !== "POST") return json(res, 405, { error: "Phương thức không hỗ trợ." });
      if (!sameOrigin(req, host)) return json(res, 403, { error: "Yêu cầu phải đến từ ứng dụng này." });
      const vocabularyRequest = url.pathname === '/api/vocabulary';
      if (rateLimit(`${vocabularyRequest ? 'vocabulary' : 'command'}:${learnerId}`, vocabularyRequest ? 120 : 40)) return json(res, 429, { error: "Bạn gửi hơi nhanh. Thử lại sau một phút nhé." });
      const body = await parseBody(req, res);
      if (!body) return;
      if (url.pathname === "/api/command") {
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text || text.length > 4000) return json(res, 400, { error: "Hãy nhập từ 1 đến 4000 ký tự." });
        if (text.startsWith("/") && !/^\/(?:english|eng|tienganh)(?:\s|$)/i.test(text)) return json(res, 400, { error: "Bản web chỉ hỗ trợ lệnh học tiếng Anh." });
        if (!runtime.enabled) return json(res, 503, { error: "English Coach đang tắt trong cấu hình máy chủ." });
        if (!runtime.configured && (!text.startsWith("/") || /^\/english\s+(?:hint|explain|example|repeat|review|vocab|daily)/i.test(text))) return json(res, 503, { error: "Thêm GEMINI_API_KEY hợp lệ vào .env và khởi động lại ứng dụng để luyện với AI." });
        await hydrate(learnerId);
        const result = await runtime.command(learnerId, text);
        await persist(learnerId);
        return json(res, 200, { ...result, configured: runtime.configured, enabled: runtime.enabled, paired: !learnerId.startsWith("web-") });
      }
      if (url.pathname === "/api/settings") {
        const goal = typeof body.goal === "string" ? body.goal.trim() : "";
        if (!goal || goal.length > 240 || /[\r\n]/.test(goal) || !["A1", "A2", "B1", "B2", "C1"].includes(body.level) || ![10, 15, 20, 30].includes(body.minutesPerDay)) return json(res, 400, { error: "Kiểm tra mục tiêu, trình độ và thời lượng học." });
        await hydrate(learnerId);
        await runtime.command(learnerId, `/english goal ${goal}`);
        await runtime.command(learnerId, `/english level ${body.level}`);
        await runtime.command(learnerId, `/english time ${body.minutesPerDay}`);
        await persist(learnerId);
        return json(res, 200, snapshot(learnerId));
      }
      if (url.pathname === '/api/toeic') {
        await hydrate(learnerId);
        let result;
        try {result=await runtime.toeic(learnerId,body);}
        catch(error){return json(res,400,{error:error.message});}
        await persist(learnerId);
        return json(res,200,{...snapshot(learnerId),toeicResult:result});
      }
      if (url.pathname === '/api/mission') {
        if(!['learn','practice','finish'].includes(body.action)) return json(res,400,{error:'Thao tác không hợp lệ.'});
        await hydrate(learnerId);
        try { await runtime.mission(learnerId,body.action,body.index); }
        catch(error) { return json(res,400,{error:error.message}); }
        await persist(learnerId);
        return json(res,200,snapshot(learnerId));
      }
      if (url.pathname === "/api/review") {
        if (typeof body.cardId !== "string" || !["again", "good"].includes(body.rating)) return json(res, 400, { error: "Chọn thẻ và mức độ nhớ hợp lệ." });
        await hydrate(learnerId);
        try { await runtime.reviewCard(learnerId, body.cardId, body.rating); }
        catch { return json(res, 400, { error: "Không tìm thấy thẻ ôn tập." }); }
        await persist(learnerId);
        return json(res, 200, snapshot(learnerId));
      }
      if (url.pathname === '/api/vocabulary') {
        if(body.action==='generate' && rateLimit(`vocabulary-generation:${learnerId}`,3))return json(res,429,{error:'Bạn vừa tạo nhiều bài đọc. Đợi một phút rồi tạo tiếp nhé.'});
        await hydrate(learnerId);
        let result;
        try { result=await runtime.vocabulary(learnerId,body); }
        catch(error) { return json(res,400,{error:error.message}); }
        await persist(learnerId);
        return json(res,200,{...result,configured:runtime.configured,enabled:runtime.enabled,paired:!learnerId.startsWith('web-')});
      }
      if (url.pathname === "/api/pair") {
        if (rateLimit(`pair:${req.socket.remoteAddress}`, 8)) return json(res, 429, { error: "Đã thử nhiều mã. Đợi một phút trước khi thử lại." });
        const id = options.consumePairingCode
          ? await options.consumePairingCode(body.code)
          : consumeWebPairingCode(body.code, options.pairingFile);
        if (!id) return json(res, 400, { error: "Mã không đúng, đã hết hạn hoặc đã được dùng. Lấy mã mới bằng /english web trong Zalo." });
        await hydrate(id);
        res.setHeader("Set-Cookie", [...setCookies.filter(item => !item.startsWith("coach_session=")), cookie("coach_session", id)]);
        return json(res, 200, snapshot(id));
      }
      if (url.pathname === "/api/unpair") {
        await hydrate(localId);
        res.setHeader("Set-Cookie", cookie("coach_session", localId));
        return json(res, 200, snapshot(localId));
      }
      return json(res, 404, { error: "Không tìm thấy chức năng." });
    } catch (error) {
      console.error("[Coach web]", error.name, error.message);
      if (!res.headersSent) json(res, 500, { error: "Ứng dụng gặp lỗi. Hãy thử lại." });
      else res.end();
    }
  });
  const sockets=new WebSocketServer({noServer:true,maxPayload:8192});
  server.on('upgrade',(req,socket,head)=>{
    const host=req.headers.host||'';
    const cookies=Object.fromEntries(String(req.headers.cookie||'').split(';').map(s=>s.trim().split('=')).filter(p=>p.length===2));
    const learnerId=decode(cookies.coach_session);
    if(req.url?.split('?')[0]!=='/api/ws'||!sameOrigin(req,host)||(options.requireAuth&&decode(cookies.coach_access)!=='access')||!learnerId||rateLimit('ws:'+learnerId,30)){
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
    }
    sockets.handleUpgrade(req,socket,head,ws=>{sockets.emit('connection',ws,learnerId);});
  });
  sockets.on('connection',(ws,learnerId)=>{
    let busy=false,controller,idle;const connectedAt=Date.now();
    const send=data=>{if(ws.readyState===1)ws.send(JSON.stringify(data));};
    const resetIdle=()=>{clearTimeout(idle);idle=setTimeout(()=>ws.close(1000,'Idle'),20000);};resetIdle();
    ws.on('close',()=>{clearTimeout(idle);controller?.abort();});
    ws.on('error',()=>controller?.abort());
    ws.on('message',async raw=>{
      if(busy)return;busy=true;clearTimeout(idle);controller=new AbortController();
      try{
        const body=JSON.parse(String(raw)),text=typeof body.text==='string'?body.text.trim():'';
        if(!text||text.length>4000||(text.startsWith('/')&&!/^\/(?:english|eng|tienganh)(?:\s|$)/i.test(text)))throw new Error('Nội dung học không hợp lệ.');
        if(!runtime.enabled||!runtime.configured)throw new Error('Trợ lý AI chưa sẵn sàng.');
        if(rateLimit('command:'+learnerId,40)){const error=new Error('Too many requests');error.status=429;throw error;}
        send({type:'status',phase:'loading'});await hydrate(learnerId);
        const started=Date.now();let first=true;
        const result=await runtime.command(learnerId,text,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(50000)]),onStatus:value=>send({type:'status',...value}),onText:value=>{if(first){first=false;send({type:'timing',firstTokenMs:Date.now()-started});}send({type:'text',text:value});}});
        await persist(learnerId);
        send({type:'done',result:{...result,configured:runtime.configured,enabled:runtime.enabled,paired:!learnerId.startsWith('web-')}});
      }catch(error){send({type:'error',code:error.status===429?'rate_limit':error.status===503?'unavailable':'incomplete',message:error.status===429?'Đã chạm giới hạn yêu cầu. Chờ một phút trước khi gửi tiếp nhé.':error.status===503?'Model đang có nhu cầu cao. Mình đã thử lại một lần nhưng chưa được. Bạn thử sau nhé.':'Chưa hoàn tất phản hồi. Tải lại hội thoại trước khi gửi lại nhé.'});}
      finally{busy=false;if(Date.now()-connectedAt>20000)ws.close(1000,'Rotate');else resetIdle();}
    });
  });
  return server;
}

export async function startCoachWebServer(runtime) {
  const port = Number(process.env.ENGLISH_WEB_PORT || 3210);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("ENGLISH_WEB_PORT phải từ 1 đến 65535.");
  const cloudOptions = isEnglishCloudConfigured() ? {
    loadLearner: loadEnglishCoachProfile,
    saveLearner: saveEnglishCoachProfile,
    consumePairingCode: consumeSharedPairingCode,
  } : {};
  const server = createCoachWebServer(runtime, cloudOptions);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  console.log(`English Coach web: http://127.0.0.1:${port}`);
  return server;
}
