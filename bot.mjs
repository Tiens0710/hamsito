import { Zalo, ThreadType } from "zca-js";
import fs from "fs";
import path from "path";
import http from "http";
import dotenv from "dotenv";

dotenv.config();

// ── Config ────────────────────────────────────────────────────────────────────
const MIMO_API_KEY = process.env.MIMO_API_KEY || "";
const MIMO_BASE_URL = (process.env.MIMO_BASE_URL || "https://token-plan-sgp.xiaomimimo.com/v1").replace(/\/$/, "");
const MIMO_MODEL = process.env.MIMO_MODEL || "mimo-v2-pro";
const MIMO_VISION_MODEL = process.env.MIMO_VISION_MODEL || "mimo-v2.5";

const GROUP_PREFIX = process.env.GROUP_PREFIX || "@bot ";
function normalizeText(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
const BOT_MENTION_ALIASES = (process.env.BOT_MENTION_ALIASES || "hamster,commit,bot,ai")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || "Bạn là chú hamster tên Ham Si Tơ. Nói chuyện tự nhiên như người bạn thân, vui tính, đôi khi hài hước. Xưng 'em' hoặc 'tao', gọi người dùng là 'sen' hoặc 'bạn'. CHỈ dùng từ 'kít kít' hoặc 'gặm gặm' KHI THẬT SỰ phù hợp (tối đa 1 lần/nhắn), KHÔNG lặp lại câu cửa miệng. Trả lời ngắn gọn 1-2 câu, đúng trọng tâm. Không thêm emoji quá nhiều, tối đa 1 emoji/nhắn. Nói chuyện bình thường, tự nhiên như bạn bè chat.";

let BOT_UID = "";
const SESSION_FILE = process.env.SESSION_FILE || "./data/session.json";
const QR_FILE = process.env.QR_FILE || "./data/qr.png";
const QR_PORT = parseInt(process.env.QR_PORT) || 3000;
const HISTORY_DIR = process.env.HISTORY_DIR || "./data/history";
const TZ = process.env.TZ || "Asia/Ho_Chi_Minh";

// ── Message deduplication ─────────────────────────────────────────────────────
const processedMsgIds = new Map();
const MSG_DEDUP_TTL = 10_000;

function isDuplicateMessage(message) {
  const msgId = message.data?.msgId || message.data?.cliMsgId || message.data?.localMsgId || null;
  if (!msgId) return false;
  const key = String(msgId);
  const now = Date.now();
  for (const [k, t] of processedMsgIds) {
    if (now - t > MSG_DEDUP_TTL) processedMsgIds.delete(k);
  }
  if (processedMsgIds.has(key)) {
    console.warn(`  [Dedup] Bỏ qua tin nhắn trùng lặp: msgId=${key}`);
    return true;
  }
  processedMsgIds.set(key, now);
  return false;
}

// ── Per-thread processing lock ────────────────────────────────────────────────
const threadLocks = new Map();

function withThreadLock(tid, fn) {
  const prev = threadLocks.get(tid) ?? Promise.resolve();
  const next = prev.then(() => fn()).catch(e => {
    console.error(`[ThreadLock] tid=${tid} lỗi:`, e.message);
  });
  threadLocks.set(tid, next);
  next.then(() => {
    if (threadLocks.get(tid) === next) threadLocks.delete(tid);
  });
  return next;
}

// ── Group buffer ──────────────────────────────────────────────────────────────
const groupBuffer = new Map();
const MAX_BUFFER = 50;

// ── Chat history ──────────────────────────────────────────────────────────────
const MAX_HISTORY = 10;
const chatHistoryCache = new Map();

function historyFile(tid) {
  return path.join(HISTORY_DIR, String(tid).replace(/[^a-zA-Z0-9_-]/g, "_") + ".json");
}
function loadHistory(tid) {
  try {
    const f = historyFile(tid);
    if (fs.existsSync(f)) { const d = JSON.parse(fs.readFileSync(f, "utf-8")); if (Array.isArray(d)) return d; }
  } catch { }
  return [];
}
function saveHistory(tid, history) {
  try {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    const f = historyFile(tid);
    fs.writeFileSync(f + ".tmp", JSON.stringify(history), "utf-8");
    fs.renameSync(f + ".tmp", f);
  } catch (e) { console.error("History save:", e.message); }
}
function getHistory(tid) {
  if (!chatHistoryCache.has(tid)) chatHistoryCache.set(tid, loadHistory(tid));
  return chatHistoryCache.get(tid);
}

function sanitizeHistory(history) {
  if (!history || history.length === 0) return history;
  const merged = [];
  for (const turn of history) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === turn.role) {
      prev.parts.push(...(turn.parts || []));
    } else {
      merged.push({ role: turn.role, parts: [...(turn.parts || [])] });
    }
  }
  while (merged.length > 0 && merged[0].role !== "user") merged.shift();
  return merged;
}

function trimAndSave(tid) {
  const h = getHistory(tid);
  let trimmed = h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
  trimmed = sanitizeHistory(trimmed);
  chatHistoryCache.set(tid, trimmed);
  saveHistory(tid, trimmed);
}

// ── Fetch image from URL → base64 ────────────────────────────────────────────
async function fetchImageAsBase64(url, timeoutMs = 15000) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null; // too small, not a real image
    const ct = res.headers.get("content-type") || "";
    let mime = "image/jpeg";
    if (ct.includes("png")) mime = "image/png";
    else if (ct.includes("webp")) mime = "image/webp";
    else if (ct.includes("gif")) mime = "image/gif";
    console.log(`  [IMG] Fetched: ${Math.round(buf.length / 1024)}KB mime=${mime}`);
    return { base64: buf.toString("base64"), mime };
  } catch (e) {
    console.error(`  [IMG] Fetch failed: ${e.message}`);
    return null;
  }
}

// ── MiMo API (OpenAI-compatible, multimodal) ─────────────────────────────────
async function askMiMo(tid, question, senderName = "User", imageBase64 = null, imageMime = "image/jpeg") {
  const history = getHistory(tid);

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  // Add chat history
  for (const turn of history) {
    if (turn.role === "user") {
      const text = (turn.parts || []).map(p => p.text || "").join(" ").trim();
      if (text) messages.push({ role: "user", content: text });
    } else if (turn.role === "model") {
      const text = (turn.parts || []).map(p => p.text || "").join(" ").trim();
      if (text) messages.push({ role: "assistant", content: text });
    }
  }

  // Add current question (with optional image)
  const userMessage = senderName ? `${senderName}: ${question}` : question;
  if (imageBase64) {
    // OpenAI-compatible multimodal format
    messages.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
        { type: "text", text: userMessage || "Mô tả ảnh này đi" }
      ]
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const t0 = Date.now();
  try {
    const response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MIMO_API_KEY}`,
      },
      body: JSON.stringify({
        model: imageBase64 ? MIMO_VISION_MODEL : MIMO_MODEL,
        messages: messages,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[MiMo] HTTP ${response.status}: ${errText.slice(0, 200)}`);
      return "Đã xảy ra lỗi khi gọi AI. Vui lòng thử lại sau.";
    }

    const data = await response.json();
    const elapsed = Date.now() - t0;
    const reply = data.choices?.[0]?.message?.content || "Không trả lời được";
    const reasoningTokens = data.usage?.completion_tokens_details?.reasoning_tokens || 0;
    const totalTokens = data.usage?.total_tokens || 0;
    console.log(`  [MiMo] ⏱️ ${elapsed}ms | Tokens: ${totalTokens} (reasoning: ${reasoningTokens}) | Model: ${data.model || MIMO_MODEL}`);

    // Save to history
    history.push({ role: "user", parts: [{ text: userMessage + (imageBase64 ? " [đã gửi ảnh]" : "") }] });
    history.push({ role: "model", parts: [{ text: reply }] });
    trimAndSave(tid);

    return reply;
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(`[MiMo] API error sau ${elapsed}ms:`, err.message);
    return "Đã xảy ra lỗi khi gọi AI. Vui lòng thử lại sau.";
  }
}

// ── Help text ─────────────────────────────────────────────────────────────────
const HELP_TEXT = `=== Ham Si Tơ Bot - Hướng dẫn sử dụng ===

GỌI BOT:
@bot [câu hỏi]     - Hỏi bất kỳ
@hamster [câu hỏi]  - Alias gọi bot
help hoặc ?        - Xem hướng dẫn

MEDIA:
Gửi ảnh + @bot    - Bot phân tích ảnh và trả lời
Gửi ảnh trong DM   - Bot tự nhận diện và mô tả ảnh

VÍ DỤ:
@bot hello
@bot hôm nay thời tiết thế nào
Gửi ảnh + @bot đây là gì?
`;

// ── QR Server ─────────────────────────────────────────────────────────────────
let qrServer = null;
function startQrServer() {
  if (qrServer) return;
  qrServer = http.createServer((req, res) => {
    if (req.url === "/" && fs.existsSync(QR_FILE)) {
      res.writeHead(200, { "Content-Type": "image/png" }); res.end(fs.readFileSync(QR_FILE));
    } else { res.writeHead(404); res.end("QR not ready"); }
  });
  qrServer.listen(QR_PORT, () => console.log(`QR Server: http://localhost:${QR_PORT}`));
}
function stopQrServer() { if (qrServer) { qrServer.close(); qrServer = null; } }

// ── Login & Session ───────────────────────────────────────────────────────────
function loadSession() {
  try { if (fs.existsSync(SESSION_FILE)) return JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8")); } catch { }
  return null;
}
function saveSession(creds) {
  try { fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true }); fs.writeFileSync(SESSION_FILE, JSON.stringify(creds, null, 2)); } catch { }
}
async function getApi() {
  const saved = loadSession();
  if (saved) {
    try { return await new Zalo(saved).login(saved); }
    catch { try { fs.unlinkSync(SESSION_FILE); } catch { } }
  }
  const api = await new Zalo().loginQR({}, async (event) => {
    switch (event.type) {
      case 0: fs.mkdirSync(path.dirname(QR_FILE), { recursive: true }); await event.actions.saveToFile(QR_FILE); startQrServer(); console.log("\nQR saved to", QR_FILE, "— open http://localhost:" + QR_PORT + " to scan"); break;
      case 1: case 3: event.actions.retry(); break;
      case 4: saveSession(event.data); try { if (fs.existsSync(QR_FILE)) fs.unlinkSync(QR_FILE); } catch { } stopQrServer(); console.log("Login OK!"); break;
    }
  });
  return api;
}

// ── Message Handler ───────────────────────────────────────────────────────────
async function handleMessage(api, message) {
  if (message.isSelf) return;
  const msgStartTime = Date.now();
  const tid = message.threadId;
  const sender = message.data?.dName || message.data?.uidFrom || "Ẩn danh";
  const senderUid = String(message.data?.uidFrom || message.data?.fromUid || sender || "").trim();

  // Extract text and image content
  let rawText = "";
  let imageBase64 = null;
  let imageMime = "image/jpeg";
  let cd = message.data?.content;

  if (typeof cd === "string") {
    rawText = cd.trim();
  } else if (cd && typeof cd === "object") {
    // Try to extract image from content object
    const imageUrl = cd.hdUrl || cd.normalUrl || cd.largeUrl || cd.url || cd.href || null;
    if (imageUrl) {
      const img = await fetchImageAsBase64(imageUrl);
      if (img) { imageBase64 = img.base64; imageMime = img.mime; }
    }
    // Check attachments for images
    if (!imageBase64 && message.data?.attachments?.length) {
      for (const att of message.data.attachments) {
        const attUrl = att.hdUrl || att.normalUrl || att.largeUrl || att.url || att.href || null;
        const img = await fetchImageAsBase64(attUrl);
        if (img) { imageBase64 = img.base64; imageMime = img.mime; break; }
      }
    }
    // Extract text from content if it was a string nested in object
    if (typeof cd === "string") rawText = cd;
  }

  // Skip if no text AND no image
  if (!rawText && !imageBase64) return;

  console.log(`\n━━━ [${message.type === ThreadType.Group ? "GROUP" : "DM"}] tid=${tid} from="${sender}" ━━━`);
  console.log(`  rawText: "${rawText.slice(0, 80)}${rawText.length > 80 ? "…" : ""}" | image: ${!!imageBase64}`);

  // ── GROUP ─────────────────────────────────────────────────────────────────
  if (message.type === ThreadType.Group) {
    const rawNorm = normalizeText(rawText);
    const prefixNorm = normalizeText(GROUP_PREFIX || "@bot");
    const tagIdx = rawNorm.indexOf(prefixNorm);
    let aliasTag = null;
    for (const a of BOT_MENTION_ALIASES) {
      const aNorm = normalizeText(a);
      const re = new RegExp(`(^|\\s)@${aNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "i");
      const m = rawNorm.match(re);
      if (m) { aliasTag = rawText.slice(rawNorm.indexOf(m[0]), rawNorm.indexOf(m[0]) + m[0].length).trim(); break; }
    }
    const isTagged = tagIdx !== -1 || !!aliasTag;
    console.log(`  [GROUP] isTagged=${isTagged} prefixNorm="${prefixNorm}" rawNorm="${rawNorm.slice(0, 60)}"`);

    if (!isTagged) {
      if (!groupBuffer.has(tid)) groupBuffer.set(tid, []);
      const gBuf = groupBuffer.get(tid);
      gBuf.push(`${sender}: ${rawText}`);
      if (gBuf.length > MAX_BUFFER) gBuf.shift();
      return;
    }

    // Strip bot trigger
    let question = "";
    if (tagIdx !== -1) {
      const prefixLen = rawNorm.indexOf(prefixNorm) + prefixNorm.length;
      question = (rawText.slice(0, rawNorm.indexOf(prefixNorm)) + rawText.slice(prefixLen)).trim();
    } else if (aliasTag) {
      const idx = rawText.toLowerCase().indexOf(aliasTag.toLowerCase());
      if (idx !== -1) {
        question = (rawText.slice(0, idx) + rawText.slice(idx + aliasTag.length)).trim();
      }
    }

    const qLower = question.toLowerCase();
    if (qLower === "help" || qLower === "?" || qLower === "hướng dẫn") {
      await api.sendMessage({ msg: HELP_TEXT, quote: message.data }, tid, message.type);
      return;
    }

    // If tagged with image but no text question, ask about image
    if (!question && !imageBase64) return;
    if (!question && imageBase64) question = "Mô tả ảnh này đi";

    console.log(`  [BOT] Question: "${question}" | image: ${!!imageBase64}`);

    const reply = await askMiMo(tid, question, sender, imageBase64, imageMime);
    const e2eMs = Date.now() - msgStartTime;
    console.log(`  [BOT] Reply: "${reply.slice(0, 100)}"`);
    console.log(`  [BOT] ⏱️ E2E: ${e2eMs}ms`);

    // Tag sender in reply
    const tagText = `${sender} `;
    const fullReply = tagText + reply;
    const mentions = [{ uid: senderUid, pos: 0, len: sender.length }];
    await api.sendMessage({ msg: fullReply, mentions, quote: message.data }, tid, message.type);
    return;
  }

  // ── DM ────────────────────────────────────────────────────────────────────
  if (message.type === ThreadType.User) {
    const rawLower = rawText.toLowerCase().trim();

    if (rawLower === "help" || rawLower === "?" || rawLower === "hướng dẫn") {
      await api.sendMessage({ msg: HELP_TEXT, quote: message.data }, tid, message.type);
      return;
    }

    // If only image with no text
    const question = rawText || (imageBase64 ? "Mô tả ảnh này đi" : "");

    console.log(`  [BOT] DM: "${question}" | image: ${!!imageBase64}`);
    const reply = await askMiMo(tid, question, sender, imageBase64, imageMime);
    const e2eMs = Date.now() - msgStartTime;
    console.log(`  [BOT] Reply: "${reply.slice(0, 100)}"`);
    console.log(`  [BOT] ⏱️ E2E: ${e2eMs}ms`);

    await api.sendMessage({ msg: reply, quote: message.data }, tid, message.type);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });

  if (!MIMO_API_KEY) {
    console.error("❌ MIMO_API_KEY not set in .env file!");
    process.exit(1);
  }

  console.log("Bot started");
  console.log(`  MiMo Model: ${MIMO_MODEL}`);
  console.log(`  MiMo Base URL: ${MIMO_BASE_URL}`);
  console.log(`  Group Prefix: ${GROUP_PREFIX}`);
  console.log(`  Aliases: ${BOT_MENTION_ALIASES.join(", ")}`);
  console.log(`  History: ${HISTORY_DIR}`);
  console.log(`  TZ: ${TZ}`);
  console.log(`  📷 Image support: ENABLED`);

  const api = await getApi();
  try {
    BOT_UID = String(api.getOwnId?.() || "").trim();
    if (BOT_UID) console.log(`[Bot] own_uid=${BOT_UID}`);
  } catch { }

  console.log("Logged in successfully!");

  api.listener.on("message", msg => {
    if (msg.isSelf) return;
    if (isDuplicateMessage(msg)) return;
    const tid = msg.threadId;
    withThreadLock(tid, () => handleMessage(api, msg)).catch(console.error);
  });

  api.listener.on("closed", () => {
    console.error("Listener closed");
    process.exit(1);
  });

  api.listener.start();
  console.log("Bot is listening for messages...");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });