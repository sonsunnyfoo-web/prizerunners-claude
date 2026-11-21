// Counts a visit or a sign-up click for one page version. Called by /ab/track.js.
import { redis, ukDay, dayKey, VARIANTS } from './_lib.mjs';

const TYPES = ['visit', 'click'];

export async function POST(request) {
  let data;
  try {
    data = JSON.parse(await request.text());
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const v = VARIANTS[data && data.v];
  const t = data && data.t;
  if (!v || !TYPES.includes(t)) return new Response('Bad request', { status: 400 });

  const key = dayKey(ukDay());
  try {
    await redis([
      ['HINCRBY', key, `${t}_${v}`, 1],
      ['EXPIRE', key, 60 * 60 * 24 * 400],
    ]);
  } catch (e) {
    return new Response(String(e.message || e), { status: 503 });
  }
  return new Response(null, { status: 204 });
}
