// Numbers for the /split-stats page: visits and clicks from the counter database,
// registrations, FTDs and deposits from the registrations sheet (pr_db2), per page version per day.
// Needs STATS_KEY (the stats page password) and SHEET_CSV_URL (CSV export link of pr_db2).
// Optional: TEST_START (YYYY-MM-DD, first day of the test).
import { redis, ukDay, dayKey, json, TEST, VARIANTS } from './_lib.mjs';

const FIELDS = ['visit', 'click', 'reg', 'ftd', 'dep'];

export async function GET(request) {
  const key = new URL(request.url).searchParams.get('key') || '';
  const expected = process.env.STATS_KEY;
  if (!expected) return json({ error: 'The stats password (STATS_KEY) is not set in Vercel yet.' }, 503);
  if (key !== expected) return json({ error: 'Wrong password.' }, 401);

  const today = ukDay();
  const errors = {};
  const byDay = new Map();
  const row = (day) => {
    if (!byDay.has(day)) {
      const r = { day };
      for (const f of FIELDS) for (const v of ['a', 'g']) r[`${f}_${v}`] = 0;
      byDay.set(day, r);
    }
    return byDay.get(day);
  };

  // Registrations and deposits from the sheet.
  let sheetLatest = null;
  const sheetUrl = process.env.SHEET_CSV_URL;
  if (!sheetUrl) errors.sheet = 'The registrations sheet link (SHEET_CSV_URL) is not set in Vercel yet.';
  else {
    try {
      const res = await fetch(sheetUrl, { redirect: 'follow' });
      if (!res.ok) throw new Error(`Sheet returned ${res.status}`);
      const rows = parseCsv(await res.text());
      const head = rows.shift().map((h) => h.trim());
      const col = (name) => head.indexOf(name);
      const iDate = col('d_create_date'), iTerm = col('utm_term'), iPaid = col('i_count_paid'), iAmt = col('n_amount_paid');
      if (iDate < 0 || iTerm < 0 || iPaid < 0) throw new Error('Sheet columns have changed');
      for (const r of rows) {
        const date = (r[iDate] || '').trim();
        if (date && (!sheetLatest || date > sheetLatest)) sheetLatest = date;
        const v = VARIANTS[(r[iTerm] || '').trim()];
        if (!v || !date) continue;
        const d = row(date.slice(0, 10));
        d[`reg_${v}`] += 1;
        if (Number(r[iPaid]) > 0) d[`ftd_${v}`] += 1;
        const amt = parseFloat(String(r[iAmt] || '').replace(/[^0-9.]/g, ''));
        if (amt > 0) d[`dep_${v}`] += amt;
      }
    } catch (e) {
      errors.sheet = `Could not read the registrations sheet: ${e.message || e}`;
    }
  }

  // Work out the day range.
  let start = /^\d{4}-\d{2}-\d{2}$/.test(process.env.TEST_START || '') ? process.env.TEST_START : null;
  if (!start) start = [...byDay.keys()].sort()[0] || today;
  const days = [];
  for (let d = new Date(start + 'T12:00:00Z'); days.length < 400; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    if (day > today) break;
    days.push(day);
  }

  // Visits and clicks from the counter database.
  try {
    const hashes = await redis(days.map((day) => ['HGETALL', dayKey(day)]));
    hashes.forEach((h, i) => {
      if (!h || !h.length) return;
      const d = row(days[i]);
      for (let k = 0; k < h.length; k += 2) if (h[k] in d) d[h[k]] = Number(h[k + 1]) || 0;
    });
  } catch (e) {
    errors.counter = e.message || String(e);
  }

  return json({
    test: TEST,
    start,
    today,
    generated: new Date().toISOString(),
    sheetLatest,
    days: days.map((day) => row(day)),
    errors,
  });
}

// Small CSV parser (handles quoted fields, commas and newlines inside quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0]);
}
