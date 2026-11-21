/*
 * PrizeRunners landing page split test.
 * Loaded by every page in the test. The page says which version it is with
 * <html data-lp-variant="lp_a"> (control) or "lp_g" (BMW variation). This script:
 *   1. copies the ad's tags onto every link to prizerunners.com and puts the version in
 *      utm_term, so each registration in pr_db2 shows which page it came from (the ad set
 *      ID is still in adset_id);
 *   2. counts one visit per browser and one sign-up click per browser, per version.
 * Visits with ?lp=a or ?lp=g in the URL are QA checks and are not counted.
 */
(function () {
  var v = document.documentElement.getAttribute('data-lp-variant');
  if (!/^lp_[a-z]$/.test(v || '')) return;

  var REG = 'https://prizerunners.com/web/register';
  var SEL = 'a[href^="' + REG + '"]';
  // Every link to the main site (winners, T&Cs, privacy...) carries the ad tags too: the main
  // site saves them on any page for 3 days, so a visitor who goes winners -> sign-up keeps them.
  var SITE = 'a[href^="https://prizerunners.com/"], a[href^="https://www.prizerunners.com/"]';
  var params = new URLSearchParams(location.search);
  var qa = params.has('lp');
  var DAY = 60 * 60 * 24;

  function getCookie(name) {
    var m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
    return m ? m[1] : null;
  }
  function setCookie(name, value) {
    document.cookie = name + '=' + value + '; Path=/; Max-Age=' + 30 * DAY + '; SameSite=Lax' +
      (location.protocol === 'https:' ? '; Secure' : '');
  }
  function count(type) {
    if (qa) return;
    var body = JSON.stringify({ v: v, t: type });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/hit', new Blob([body], { type: 'text/plain' }))) return;
    } catch (e) { /* fall through to fetch */ }
    try { fetch('/api/hit', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (e) { /* ignore */ }
  }
  function tagLink(a) {
    try {
      var url = new URL(a.href);
      params.forEach(function (value, key) { if (key !== 'lp') url.searchParams.set(key, value); });
      url.searchParams.delete('lp');
      url.searchParams.set('utm_term', v);
      a.href = url.toString();
    } catch (e) { /* leave the link as it is */ }
  }
  function tagAll() { document.querySelectorAll(SITE).forEach(tagLink); }

  // Tag after the page's own scripts have run, and again at click time to be safe.
  if (document.readyState === 'complete') tagAll();
  else document.addEventListener('DOMContentLoaded', tagAll);
  window.addEventListener('load', tagAll);

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest(SITE) : null;
    if (!a) return;
    tagLink(a);
    if (!a.matches(SEL)) return; // only sign-up clicks are counted
    if (getCookie('pr_ab_clk') !== v) { if (!qa) setCookie('pr_ab_clk', v); count('click'); }
  }, true);

  if (getCookie('pr_ab_seen') !== v) { if (!qa) setCookie('pr_ab_seen', v); count('visit'); }
})();
