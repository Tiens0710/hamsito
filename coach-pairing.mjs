import fs from "node:fs";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";

const hash = text => createHash("sha256").update(text).digest("hex");
const defaultFile = () => process.env.ENGLISH_PAIRING_FILE || "./data/english-web-pairing.json";
function read(file, now) {
  let entries = [];
  try { entries = JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  return (Array.isArray(entries) ? entries : []).filter(item => item.expiresAt > now);
}
function write(file, entries) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(entries), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}
export function createWebPairingCode(learnerId, file = defaultFile(), now = Date.now()) {
  const code = randomBytes(4).toString("hex").toUpperCase();
  const entries = read(file, now).filter(item => item.learnerId !== learnerId);
  entries.push({ hash: hash(code), learnerId, expiresAt: now + 10 * 60_000 });
  write(file, entries);
  return code;
}
export function consumeWebPairingCode(input, file = defaultFile(), now = Date.now()) {
  const code = String(input || "").trim().toUpperCase();
  if (!/^[A-F0-9]{8}$/.test(code)) return null;
  const entries = read(file, now);
  const match = entries.find(item => item.hash === hash(code));
  if (!match) return null;
  write(file, entries.filter(item => item !== match));
  return match.learnerId;
}
