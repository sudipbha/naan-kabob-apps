// CI gate: syntax-check + full browser render of every tab, both apps.
// Fails (exit 1) on any syntax error, missing tab marker, or page error.
// Local run: CHROME_PATH=/path/to/chrome node tests/render-check.js
const { execFileSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const APPS = [
  { dir: 'sysco', key: 'sysco-inventory-v1' },
  { dir: 'champion', key: 'nk-champion-tracker-v1' },
];
const TABS = [
  ['Count', 'shelf count'],
  ['Receive', 'Check in a delivery'],
  ['Variance', 'variance'],
  ['Usage', 'Daily usage'],
  ['Order', 'to order|Nothing at reorder point'],
];

function syntaxCheck(app) {
  const html = fs.readFileSync(path.join(ROOT, app.dir, 'index.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((b) => b.includes('ChampionTracker'));
  if (blocks.length !== 1) throw new Error(app.dir + ': expected 1 app script, found ' + blocks.length);
  const tmp = path.join(os.tmpdir(), 'nk-check-' + app.dir + '.js');
  fs.writeFileSync(tmp, blocks[0]);
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' });
  console.log('syntax OK:', app.dir);
}

async function renderCheck(browser, base, app) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const seed = { stocks: {}, stockAt: {}, counts: [], receipts: [], caps: {}, reord: {}, orderOv: {}, packcfg: {}, orders: [], cycle: 2 };
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [app.key, JSON.stringify(seed)]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await page.goto(base + '/' + app.dir + '/', { waitUntil: 'commit' });
  await page.waitForSelector('text=shelf count', { timeout: 20000 });
  for (const [label, marker] of TABS) {
    await page.locator('span', { hasText: label }).last().evaluate((el) => el.closest('button').click());
    const re = new RegExp(marker, 'i');
    await page.waitForFunction((src) => new RegExp(src, 'i').test(document.body.innerText), marker, { timeout: 10000 })
      .catch(() => { throw new Error(app.dir + ': tab "' + label + '" never showed ' + re); });
    await page.waitForTimeout(150);
  }
  if (errs.length) throw new Error(app.dir + ' page errors: ' + errs.join(' | '));
  await ctx.close();
  console.log('render OK:', app.dir, '(all 5 tabs, no page errors)');
}

(async () => {
  for (const app of APPS) syntaxCheck(app);

  const { chromium } = require('playwright');
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
  try {
    for (const app of APPS) await renderCheck(browser, base, app);
  } finally {
    await browser.close();
    srv.close();
  }
  console.log('RENDER-CHECK PASS');
})().catch((e) => { console.error('RENDER-CHECK FAIL:', e.message); process.exit(1); });
