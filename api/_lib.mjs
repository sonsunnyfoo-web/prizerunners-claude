// Shared helpers for the split-test functions. Files starting with "_" are not deployed as endpoints.

// Preview deployments count into their own bucket so test visits never mix with live numbers.
export const TEST = (process.env.TEST_NAME || 'bmw1') + (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production' ? '-preview' : '');
export const VARIANTS = { lp_a: 'a', lp_g: 'g' };

// Upstash Redis over its REST API, so no packages are needed.
// Vercel's Upstash integration sets KV_REST_API_*; a direct Upstash connection sets UPSTASH_REDIS_REST_*.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export async function redis(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('The counter database is not connected yet (Upstash).');
  const res = await fetch(REDIS_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Counter database error ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

// Calendar day in UK time, as YYYY-MM-DD.
export function ukDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function dayKey(day) {
  return `ab:${TEST}:${day}`;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
