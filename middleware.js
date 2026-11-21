// PrizeRunners landing page split test (Vercel Routing Middleware).
// Visitors to "/" are split at random between:
//   lp_a  Control    -> index.html      (served as normal)
//   lp_g  Variation  -> index-bmw.html  (served at the same "/" URL, the address does not change)
// Every visitor is treated the same way, bots and Meta's reviewer included: the split is purely random.
// The choice is kept in a cookie for 30 days so returning visitors see the same page.
// QA: add ?lp=a or ?lp=g to the URL to force a version. Those visits are not counted in the stats.
// To stop the test: set SPLIT_G to 0 (everyone sees the control) or 1 (everyone sees the variation),
// or delete this file.

export const config = { matcher: ['/', '/index.html'] };

const SPLIT_G = 0.5;
const COOKIE = 'pr_lp';
const VARIATION_PATH = '/index-bmw.html';
const MAX_AGE = 60 * 60 * 24 * 30;

export default function middleware(request) {
  const url = new URL(request.url);
  const forced = url.searchParams.get('lp');
  const saved = (request.headers.get('cookie') || '').match(/(?:^|;\s*)pr_lp=(a|g)(?:;|$)/);

  let variant;
  if (forced === 'a' || forced === 'g') variant = forced;
  else if (saved) variant = saved[1];
  else variant = Math.random() < SPLIT_G ? 'g' : 'a';

  const headers = new Headers();
  if (!saved || saved[1] !== variant) {
    headers.append('set-cookie', `${COOKIE}=${variant}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`);
  }

  if (variant === 'g') {
    // Same as rewrite() from @vercel/functions: serve the variation, keep the visitor's URL and query.
    headers.set('x-middleware-rewrite', new URL(VARIATION_PATH + url.search, url).toString());
  } else {
    // Same as next() from @vercel/functions: carry on to index.html as normal.
    headers.set('x-middleware-next', '1');
  }
  return new Response(null, { headers });
}
