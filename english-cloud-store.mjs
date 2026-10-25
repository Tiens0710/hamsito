import { createHash, randomBytes } from "node:crypto";

function envValue(name) {
  if (process.env[name]) return process.env[name];
  const suffix = `_${name}`;
  const match = Object.keys(process.env).find(key => key.endsWith(suffix));
  return match ? process.env[match] : "";
}

export function getEnglishCloudConfig() {
  const url = String(envValue("SUPABASE_URL") || "").replace(/\/+$/, "");
  const key = envValue("SUPABASE_SECRET_KEY") || envValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
  } catch { return null; }
  return { url, key };
}

export function isEnglishCloudConfigured() {
  return Boolean(getEnglishCloudConfig());
}

async function request(table, query, init = {}) {
  const credentials = getEnglishCloudConfig();
  if (!credentials) throw new Error("Supabase chưa được cấu hình.");
  const suffix = query ? `?${query}` : "";
  const response = await fetch(`${credentials.url}/rest/v1/${table}${suffix}`, {
    ...init,
    headers: {
      apikey: credentials.key,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

export async function loadEnglishCoachProfile(learnerId) {
  const rows = await request(
    "english_coach_profiles",
    new URLSearchParams({ select: "payload", learner_id: `eq.${learnerId}` }).toString(),
  );
  return rows?.[0]?.payload || null;
}

export async function saveEnglishCoachProfile(learnerId, payload) {
  await request("english_coach_profiles", "on_conflict=learner_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ learner_id: learnerId, payload, updated_at: new Date().toISOString() }]),
  });
}

export async function createSharedPairingCode(learnerId) {
  await request("english_coach_pairing_codes", new URLSearchParams({ expires_at: `lte.${new Date().toISOString()}` }).toString(), {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  const code = randomBytes(4).toString("hex").toUpperCase();
  const codeHash = createHash("sha256").update(code).digest("hex");
  await request("english_coach_pairing_codes", "", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([{ code_hash: codeHash, learner_id: learnerId, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }]),
  });
  return code;
}

export async function consumeSharedPairingCode(input) {
  const code = String(input || "").trim().toUpperCase();
  if (!/^[A-F0-9]{8}$/.test(code)) return null;
  const codeHash = createHash("sha256").update(code).digest("hex");
  const rows = await request(
    "english_coach_pairing_codes",
    new URLSearchParams({ select: "learner_id", code_hash: `eq.${codeHash}`, expires_at: `gt.${new Date().toISOString()}` }).toString(),
    { method: "DELETE", headers: { Prefer: "return=representation" } },
  );
  return rows?.[0]?.learner_id || null;
}
