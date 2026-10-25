import { createHash, randomBytes } from 'node:crypto';
import {
  PROFILE_REVISION,
  ProfileConflictError,
  mergeProfileChanges,
  withRevision,
} from './profile-merge.mjs';
function envValue(name) {
  if (process.env[name]) return process.env[name];
  const suffix = `_${name}`;
  const match = Object.keys(process.env).find((key) => key.endsWith(suffix));
  return match ? process.env[match] : '';
}
export function getEnglishCloudConfig() {
  const url = String(envValue('SUPABASE_URL') || '').replace(/\/+$/, '');
  const key = envValue('SUPABASE_SECRET_KEY') || envValue('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return {
    url,
    key,
  };
}
export function isEnglishCloudConfigured() {
  return Boolean(getEnglishCloudConfig());
}
async function request(table, query, init = {}) {
  const credentials = getEnglishCloudConfig();
  if (!credentials) throw new Error('Supabase chưa được cấu hình.');
  const suffix = query ? `?${query}` : '';
  const response = await fetch(`${credentials.url}/rest/v1/${table}${suffix}`, {
    ...init,
    headers: {
      apikey: credentials.key,
      'Content-Type': 'application/json',
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
    'english_coach_profiles',
    new URLSearchParams({
      select: 'payload,updated_at',
      learner_id: `eq.${learnerId}`,
    }).toString(),
  );
  const row = rows?.[0];
  return row ? withRevision(row.payload, row.updated_at) : null;
}
export async function saveEnglishCoachProfile(learnerId, payload, previous) {
  if (!previous) throw new Error('Profile updates require the previously loaded profile.');
  let current = previous;
  let candidate = structuredClone(payload);
  for (let attempt = 0; attempt < 4; attempt++) {
    const revision = current[PROFILE_REVISION];
    const updatedAt = new Date(Math.max(Date.now(), (Date.parse(revision) || 0) + 1)).toISOString();
    const rows = revision
      ? await request(
          'english_coach_profiles',
          new URLSearchParams({
            learner_id: `eq.${learnerId}`,
            updated_at: `eq.${revision}`,
            select: 'payload,updated_at',
          }).toString(),
          {
            method: 'PATCH',
            headers: {
              Prefer: 'return=representation',
            },
            body: JSON.stringify({
              payload: candidate,
              updated_at: updatedAt,
            }),
          },
        )
      : await request(
          'english_coach_profiles',
          'on_conflict=learner_id&select=payload,updated_at',
          {
            method: 'POST',
            headers: {
              Prefer: 'resolution=ignore-duplicates,return=representation',
            },
            body: JSON.stringify([
              {
                learner_id: learnerId,
                payload: candidate,
                updated_at: updatedAt,
              },
            ]),
          },
        );
    if (rows?.length) return withRevision(rows[0].payload, rows[0].updated_at);
    current = await loadEnglishCoachProfile(learnerId);
    if (!current) throw new ProfileConflictError();
    candidate = mergeProfileChanges(previous, payload, current);
  }
  throw new ProfileConflictError();
}
export async function createSharedPairingCode(learnerId) {
  await request(
    'english_coach_pairing_codes',
    new URLSearchParams({
      expires_at: `lte.${new Date().toISOString()}`,
    }).toString(),
    {
      method: 'DELETE',
      headers: {
        Prefer: 'return=minimal',
      },
    },
  );
  const code = randomBytes(4).toString('hex').toUpperCase();
  const codeHash = createHash('sha256').update(code).digest('hex');
  await request('english_coach_pairing_codes', '', {
    method: 'POST',
    headers: {
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([
      {
        code_hash: codeHash,
        learner_id: learnerId,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
    ]),
  });
  return code;
}
export async function consumeSharedPairingCode(input) {
  const code = String(input || '')
    .trim()
    .toUpperCase();
  if (!/^[A-F0-9]{8}$/.test(code)) return null;
  const codeHash = createHash('sha256').update(code).digest('hex');
  const rows = await request(
    'english_coach_pairing_codes',
    new URLSearchParams({
      select: 'learner_id',
      code_hash: `eq.${codeHash}`,
      expires_at: `gt.${new Date().toISOString()}`,
    }).toString(),
    {
      method: 'DELETE',
      headers: {
        Prefer: 'return=representation',
      },
    },
  );
  return rows?.[0]?.learner_id || null;
}
