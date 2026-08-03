// Weekly-trial + emergency-order behaviour suite (frozen clocks, Toronto TZ).
// Runs in CI after render-check; locally:
//   CHROME_PATH=/path/to/chrome node tests/weekly-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const KEY = { sysco: 'sysco-inventory-v1', champion: 'nk-champion-tracker-v1' };
const fail = [];
const ck = (c, m) => { if (!c) fail.push(m); else console.log('  ok:', m); };

async function open(browser, base, app, seed, when) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Toronto' });
  if (when) await ctx.clock.install({ time: new Date(when) });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  // seed only on first load - reloads keep what the app saved
  await ctx.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY[app], JSON.stringify({
    stocks: {}, stockAt: {}, counts: [], receipts: [], caps: {}, reord: {}, orderOv: {}, packcfg: {}, orders: [], cycle: 2, ...seed,
  })]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await page.goto(base + '/' + app + '/', { waitUntil: 'commit' });
  await page.waitForSelector('text=shelf count', { timeout: 20000 });
  return { ctx, page, errs };
}

const win = (page, cyc) => page.evaluate((c) => {
  const w = deliveryWindows(null, c === 1 ? WEEKLY_DAYS : DELIVERY_DAYS);
  return { next: w.next.toDateString(), following: w.following.toDateString(), fullDays: w.full.wd + w.full.we, weekly: w.weekly };
}, cyc);

const tab = async (page, label, marker) => {
  await page.locator('span', { hasText: label }).last().evaluate((el) => el.closest('button').click());
  await page.waitForFunction((m) => new RegExp(m, 'i').test(document.body.innerText), marker, { timeout: 10000 });
  await page.waitForTimeout(250);
};
const body = (page) => page.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('textarea')].map((t) => t.value).join('\n'));
const napkinCs = (t) => { const m = t.match(/Dinner napkin[\s\S]{0,300}?(\d+)\s*cs/); return m ? +m[1] : null; };

(async () => {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/javascript' });
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const launchOpts = { args: ['--no-sandbox'] };
  if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launchOpts);

  // ---------- A. windows ----------
  console.log('A. weekly window cutoff');
  {
    const { ctx, page } = await open(browser, base, 'champion', { cycle: 1 }, '2026-08-02T20:00:00');
    const w = await win(page, 1);
    ck(w.weekly === true && w.next === 'Tue Aug 04 2026', 'Sun evening: next truck Tue Aug 4');
    ck(w.fullDays === 9, 'Sun evening build = 9 demand days (got ' + w.fullDays + ')');
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, base, 'champion', { cycle: 1 }, '2026-08-03T10:00:00');
    ck((await win(page, 1)).fullDays === 8, 'Monday build = 8 demand days');
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, base, 'champion', { cycle: 2 }, '2026-08-04T10:00:00');
    const w = await win(page, 2);
    ck(w.weekly === false && w.fullDays === 8, 'Tue+Fri mode unchanged (8 days incl today)');
    await ctx.close();
  }

  // ---------- B. weekly inclusion + full-shelf advisory ----------
  console.log('B. inclusion + advisory');
  {
    const seed = { cycle: 1, stocks: { napkin: 26, clx200: 60 }, caps: { napkin: 60 }, reord: { napkin: 2 } };
    const { ctx, page, errs } = await open(browser, base, 'champion', seed, '2026-08-02T20:00:00');
    await tab(page, 'Order', 'to order|Nothing at reorder');
    const t = await body(page);
    ck(/Dinner napkin/.test(t), 'item with ~4 days of stock IS on the weekly order');
    ck(/won.t last to next Tue.s truck/.test(t), 'weekly reason line present');
    ck(errs.length === 0, 'no page errors (inclusion)');
    await ctx.close();
    const { ctx: c2, page: p2 } = await open(browser, base, 'champion', { ...seed, cycle: 2 }, '2026-08-02T20:00:00');
    await tab(p2, 'Order', 'to order|Nothing at reorder');
    ck(!/Dinner napkin/.test(await body(p2)), 'same item off the Tue+Fri list (unchanged)');
    await c2.close();
  }
  {
    // full shelf that still cannot last the week -> advisory, not silence
    const { ctx, page } = await open(browser, base, 'champion',
      { cycle: 1, stocks: { napkin: 26 }, caps: { napkin: 26 } }, '2026-08-02T20:00:00');
    await tab(page, 'Order', 'to order|Nothing at reorder');
    const t = await body(page);
    ck(/Full shelf, but won.t last the week/.test(t) && /Dinner napkin \(needs \d+, Max 26\)/.test(t),
      'full-shelf advisory names the item with needs/Max numbers');
    await ctx.close();
  }

  // ---------- C. toggle + Sysco lockout ----------
  console.log('C. toggle');
  {
    const { ctx, page } = await open(browser, base, 'champion', { cycle: 2 }, '2026-08-02T20:00:00');
    page.on('dialog', (d) => d.accept());
    await tab(page, 'Order', 'to order|Nothing at reorder');
    let t = await body(page);
    ck(/Tue & Fri/.test(t) && /Tue only/.test(t) && /Emergency order/.test(t), 'toggle + emergency button visible in Champion');
    await page.locator('button', { hasText: 'Tue only' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
    t = await body(page);
    ck(/Weekly trial/.test(t) && /covers through Tue/.test(t), 'weekly header with coverage date');
    await page.clock.runFor(5000);
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'commit' });
    await page.waitForSelector('text=shelf count', { timeout: 20000 });
    await tab(page, 'Order', 'to order|Nothing at reorder');
    ck(/Weekly trial/.test(await body(page)), 'weekly mode survives a reload');
    await ctx.close();
  }
  {
    const em = { date: '2026-08-01T18:00:00.000Z', text: 'X', items: { oil: 2 }, kind: 'emergency', expect: '2026-08-03', reason: 'x' };
    const { ctx, page } = await open(browser, base, 'sysco', { cycle: 1, stocks: { oil: 0 }, orders: [em] }, '2026-08-02T20:00:00');
    await tab(page, 'Order', 'to order|Nothing at reorder');
    const t = await body(page);
    ck(!/Tue only/.test(t) && !/Emergency order/.test(t), 'Sysco: no toggle, no emergency button');
    ck(!/Emergency order pending/.test(t) && !/arriving/.test(t), 'Sysco: seeded emergency data shows no banner/chips');
    const oil = t.match(/\bOil\b[\s\S]{0,260}?(\d+)\s*cs/);
    const { ctx: c2, page: p2 } = await open(browser, base, 'sysco', { cycle: 1, stocks: { oil: 0 } }, '2026-08-02T20:00:00');
    await tab(p2, 'Order', 'to order|Nothing at reorder');
    const oil2 = (await body(p2)).match(/\bOil\b[\s\S]{0,260}?(\d+)\s*cs/);
    ck(oil && oil2 && oil[1] === oil2[1], 'Sysco: emergency-shaped data does not change order math (' + (oil && oil[1]) + ' cs both ways)');
    ck(/Deliveries Tue & Fri/.test(t), 'Sysco header stays Tue & Fri with seeded cycle:1');
    await ctx.close(); await c2.close();
  }

  // ---------- D. horizon ----------
  {
    const { ctx, page } = await open(browser, base, 'champion', {}, '2026-08-02T20:00:00');
    const h = await page.evaluate(() => [maxGapOf(WEEKLY_DAYS) + 1, maxGapOf(DELIVERY_DAYS) + 1]);
    ck(h[0] === 8 && h[1] === 5, 'horizon weekly=8 vs Tue+Fri=5');
    await ctx.close();
  }

  // ---------- E. holidays ----------
  console.log('E. holidays');
  for (const app of ['champion', 'sysco']) {
    const { ctx, page } = await open(browser, base, app, {}, '2025-06-29T20:00:00');
    const r = await page.evaluate(() => {
      const a = deliveryWindows(new Date('2025-06-29T20:00:00'), [2]);
      const b = deliveryWindows(new Date('2028-12-20T10:00:00'), [2]);
      return { next: a.next.toDateString(), following: a.following.toDateString(), fullDays: a.full.wd + a.full.we, boxing: b.next.toDateString() };
    });
    ck(r.next === 'Mon Jun 30 2025' && r.following === 'Tue Jul 08 2025' && r.fullDays === 9,
      app + ': Canada-Day-Tue pulls truck to Mon, window 9 days');
    ck(r.boxing === 'Fri Dec 22 2028', app + ': Boxing-Tue 2028 walks past the weekend to Fri Dec 22');
    await ctx.close();
  }

  // ---------- F. emergency lifecycle ----------
  console.log('F. emergency lifecycle');
  {
    // place on a Thursday; gloves out
    const { ctx, page, errs } = await open(browser, base, 'champion', { cycle: 1, stocks: { gloves: 0, napkin: 60 } }, '2026-08-06T14:00:00');
    page.on('dialog', (d) => d.accept());
    await tab(page, 'Order', 'to order|Nothing at reorder');
    await page.locator('button', { hasText: 'Emergency order' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
    const dateVal = await page.locator('input[type=date]').inputValue();
    ck(dateVal === '2026-08-07', 'expected date defaults to tomorrow (got ' + dateVal + ')');
    const minMax = await page.locator('input[type=date]').evaluate((el) => [el.min, el.max]);
    ck(minMax[0] === '2026-08-06' && minMax[1] === '2026-08-11', 'date picker constrained today..next truck (got ' + minMax + ')');
    await page.locator('input[placeholder*="Reason"]').fill('gloves out');
    await page.locator('button', { hasText: 'Mark as ordered' }).last().evaluate((el) => el.click());
    await page.waitForTimeout(500);
    let t = await body(page);
    ck(/Emergency order pending/.test(t), 'pending banner after placing');
    const ord = await page.evaluate(() => JSON.parse(localStorage.getItem('nk-champion-tracker-v1')).data.orders.slice(-1)[0]);
    ck(ord.kind === 'emergency' && ord.expect === '2026-08-07' && /EMERGENCY CHAMPION ORDER/.test(ord.text), 'logged with kind/expect + EMERGENCY text');
    // second emergency blocked while one pending
    await page.locator('button', { hasText: 'Emergency order' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
    t = await body(page);
    ck(/already pending/.test(t), 'second emergency blocked while one is pending');
    ck(errs.length === 0, 'no page errors (place)');
    await ctx.close();
  }
  {
    // unit label: an item whose purchase unit is not cs must not say cs
    const { ctx, page } = await open(browser, base, 'champion', { cycle: 1 }, '2026-08-06T14:00:00');
    const alt = await page.evaluate(() => {
      const it = ITEMS.find((i) => !i.bk && packUnitOf(i) !== 'cs');
      return it ? { id: it.id, ou: packUnitOf(it) } : null;
    });
    if (alt) {
      await ctx.close();
      const { ctx: c2, page: p2 } = await open(browser, base, 'champion', { cycle: 1, stocks: { [alt.id]: 0 } }, '2026-08-06T14:00:00');
      p2.on('dialog', (d) => d.accept());
      await tab(p2, 'Order', 'to order|Nothing at reorder');
      await p2.locator('button', { hasText: 'Emergency order' }).first().evaluate((el) => el.click());
      await p2.waitForTimeout(400);
      await p2.locator('button', { hasText: 'Mark as ordered' }).last().evaluate((el) => el.click());
      await p2.waitForTimeout(500);
      const o = await p2.evaluate(() => JSON.parse(localStorage.getItem('nk-champion-tracker-v1')).data.orders.slice(-1)[0]);
      ck(o && new RegExp('\\u00a0' + alt.ou).test(o.text), 'emergency text uses "' + alt.ou + '" for a non-case item');
      await c2.close();
    } else { await ctx.close(); console.log('  (no non-cs item; unit-label case skipped)'); }
  }
  {
    // pending dedup honours quantities AND the expected date
    const mk = async (orders) => {
      const { ctx, page } = await open(browser, base, 'champion',
        { cycle: 1, stocks: { napkin: 10 }, caps: { napkin: 80 }, orders }, '2026-08-02T20:00:00');
      await tab(page, 'Order', 'to order|Nothing at reorder');
      const t = await body(page);
      await ctx.close();
      return { cs: napkinCs(t), t };
    };
    const emOk = { date: '2026-08-01T18:00:00.000Z', text: 'X', items: { napkin: 20 }, kind: 'emergency', expect: '2026-08-03', reason: 'x' };
    const emLate = { ...emOk, expect: '2026-08-08' };
    const none = await mk([]);
    const okd = await mk([emOk]);
    const late = await mk([emLate]);
    ck(none.cs != null && none.cs - okd.cs === 1, 'pending 20 packs (in time) reduces the order by exactly 1 cs (' + none.cs + '->' + okd.cs + ')');
    ck(late.cs === none.cs, 'an emergency expected AFTER the truck does NOT reduce the order (' + late.cs + ')');
    ck(/Emergency order pending/.test(late.t), 'late emergency still shows its pending banner');
  }
  {
    // partial receipt decrements; unrelated receipt does not touch; undo reopens
    const em = { date: '2026-08-01T18:00:00.000Z', text: 'X', items: { napkin: 20 }, kind: 'emergency', expect: '2026-08-02', reason: 'x' };
    const { ctx, page } = await open(browser, base, 'champion', { cycle: 1, stocks: { napkin: 0, gloves: 1 }, orders: [em] }, '2026-08-02T10:00:00');
    page.on('dialog', (d) => d.accept());
    await tab(page, 'Receive', 'Check in a delivery');
    // unrelated: receive gloves only
    const g = page.locator('div.rounded-xl', { hasText: 'gloves' }).first();
    await g.locator('input').first().fill('5');
    await g.locator('input').first().blur();
    await page.locator('button', { hasText: 'Log delivery' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
    let o = await page.evaluate(() => JSON.parse(localStorage.getItem('nk-champion-tracker-v1')).data.orders.slice(-1)[0]);
    ck(!o.closed && o.items.napkin === 20, 'unrelated delivery leaves the pending order untouched');
    // partial: 8 of 20 napkins
    const n = page.locator('div.rounded-xl', { hasText: 'Dinner napkin' }).first();
    await n.locator('input').first().fill('8');
    await n.locator('input').first().blur();
    await page.locator('button', { hasText: 'Log delivery' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
    o = await page.evaluate(() => JSON.parse(localStorage.getItem('nk-champion-tracker-v1')).data.orders.slice(-1)[0]);
    ck(!o.closed && o.items.napkin === 12, 'partial receipt decrements pending 20 -> 12, still open');
    ck(/Emergency order pending/.test(await body(page)), 'banner survives a partial receipt');
    // rest: 12 more closes it
    await n.locator('input').first().fill('12');
    await n.locator('input').first().blur();
    await page.locator('button', { hasText: 'Log delivery' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
    o = await page.evaluate(() => JSON.parse(localStorage.getItem('nk-champion-tracker-v1')).data.orders.slice(-1)[0]);
    ck(o.closed === true, 'receiving the remainder closes the pending order');
    // undo the closing receipt -> reopens with 12 ("✕ undo" in Recent deliveries)
    await page.locator('button', { hasText: '✕ undo' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
    o = await page.evaluate(() => JSON.parse(localStorage.getItem('nk-champion-tracker-v1')).data.orders.slice(-1)[0]);
    ck(o.closed !== true && o.items.napkin === 12, 'undoing that receipt reopens the pending order at 12');
    await ctx.close();
  }
  {
    // cancel + 30s undo
    const em = { date: '2026-08-01T18:00:00.000Z', text: 'X', items: { gloves: 10 }, kind: 'emergency', expect: '2026-08-02', reason: 'x' };
    const { ctx, page } = await open(browser, base, 'champion', { cycle: 1, orders: [em] }, '2026-08-02T10:00:00');
    page.on('dialog', (d) => d.accept());
    await tab(page, 'Order', 'to order|Nothing at reorder');
    await page.locator('button', { hasText: 'Cancel' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
    let t = await body(page);
    ck(!/Emergency order pending/.test(t) && /Emergency order cancelled/.test(t), 'cancel clears pending, undo toast shows');
    await page.locator('button', { hasText: 'Undo' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
    ck(/Emergency order pending/.test(await body(page)), 'undo restores the pending order');
    await ctx.close();
  }
  {
    // merge: closed is terminal
    const { ctx, page } = await open(browser, base, 'champion', {}, '2026-08-02T10:00:00');
    const merged = await page.evaluate(() => {
      const mk = (closed) => ({ orders: [{ date: 'D1', kind: 'emergency', items: { a: 1 }, ...closed ? { closed: true } : {} }] });
      const out = mergeData(mk(false), mk(false), mk(true));
      return out.orders[0].closed === true;
    });
    ck(merged, 'mergeData: remote CLOSED beats stale local OPEN for the same order');
    await ctx.close();
  }
  {
    // date change re-seeds untouched suggestions downward (later delivery = less bridge)
    const { ctx, page } = await open(browser, base, 'champion', { cycle: 1, stocks: { napkin: 0 } }, '2026-08-06T14:00:00'); // Thu
    page.on('dialog', (d) => d.accept());
    await tab(page, 'Order', 'to order|Nothing at reorder');
    await page.locator('button', { hasText: 'Emergency order' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(400);
    // sheet row inputs: [0]=checkbox, [1]=on-hand, [2]=send quantity
    const q1 = await page.locator('div.rounded-xl', { hasText: 'Dinner napkin' }).last().locator('input').nth(2).inputValue();
    await page.locator('input[type=date]').fill('2026-08-10'); // Monday instead of Friday
    await page.waitForTimeout(300);
    const q2 = await page.locator('div.rounded-xl', { hasText: 'Dinner napkin' }).last().locator('input').nth(2).inputValue();
    ck(+q1 > +q2 && +q2 > 0, 'later delivery date shrinks the suggested bridge (' + q1 + ' -> ' + q2 + ')');
    await ctx.close();
  }

  // ---------- H. backup items sink to the bottom of Count ----------
  console.log('H. backups at the bottom');
  {
    // sysco: hardcoded bk items (vinyl gloves etc.)
    const { ctx, page } = await open(browser, base, 'sysco', {}, '2026-08-02T20:00:00');
    const t = await body(page);
    const iBackupHdr = t.indexOf('Backup — ordered from');
    const iVinyl = t.indexOf('Vinyl gloves');
    const iPrinter = t.indexOf('Printer paper');
    ck(iBackupHdr > -1, 'sysco walk: Backup group header present');
    ck(iVinyl > iBackupHdr, 'sysco walk: backup item sits under the Backup header');
    ck(iPrinter > -1 && iPrinter < iBackupHdr, 'sysco walk: last real station renders before the Backup group');
    await ctx.close();
  }
  {
    // champion: backup set via the Levels toggle (packcfg override path)
    const { ctx, page } = await open(browser, base, 'champion',
      { packcfg: { gloves: { bk: true } } }, '2026-08-02T20:00:00');
    let t = await body(page);
    const iHdr = t.indexOf('Backup — ordered from');
    ck(iHdr > -1 && t.indexOf('Nitrile gloves') > iHdr || /gloves/i.test(t.slice(iHdr)),
      'champion walk: toggled-backup item moved into the Backup group');
    // frequent mode: backups last
    await page.locator('button', { hasText: 'Frequent' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(300);
    t = await body(page);
    const cards = t.match(/BACKUP/g) || [];
    const lastBackupIdx = t.lastIndexOf('BACKUP');
    const lastOnShelfIdx = t.lastIndexOf('on shelf');
    ck(cards.length > 0 && lastBackupIdx > 0, 'champion frequent: backup badge present');
    ck(t.indexOf('BACKUP') > t.indexOf('on shelf'), 'champion frequent: first backup card comes after regular cards begin');
    await ctx.close();
  }

  // ---------- G. round-trip ----------
  {
    const { ctx, page } = await open(browser, base, 'champion', { cycle: 2 }, '2026-08-02T20:00:00');
    page.on('dialog', (d) => d.accept());
    const before = await win(page, 2);
    await tab(page, 'Order', 'to order|Nothing at reorder');
    await page.locator('button', { hasText: 'Tue only' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Tue & Fri' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(300);
    ck(JSON.stringify(before) === JSON.stringify(await win(page, 2)), 'weekly->back leaves Tue+Fri windows identical');
    await ctx.close();
  }

  await browser.close();
  srv.close();
  if (fail.length) { console.error('\nWEEKLY-CHECK FAIL (' + fail.length + '):\n - ' + fail.join('\n - ')); process.exit(1); }
  console.log('\nWEEKLY-CHECK PASS');
})().catch((e) => { console.error('WEEKLY-CHECK CRASH:', e.message); process.exit(1); });
