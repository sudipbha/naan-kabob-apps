// Earmark regression gate: rich URL imports, premium summaries and Trending.
// CI installs Playwright before running this file. The browser is isolated from
// real Supabase, OpenAI, feed and media endpoints; every response is a fixture.
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures', 'earmark');
const htmlPath = path.join(ROOT, 'earmark', 'index.html');
const swPath = path.join(ROOT, 'earmark', 'sw.js');
const trendingPath = path.join(ROOT, 'earmark', 'trending.json');
const fail = [];

function ck(condition, message) {
  if (condition) console.log('  ok:', message);
  else fail.push(message);
}

function fixture(name) {
  return fs.readFileSync(path.join(FIX, name), 'utf8');
}

function has(re, source, message) {
  ck(re.test(source), message);
}

function syntaxAndStaticContracts() {
  console.log('A. Earmark syntax and feature contracts');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const sw = fs.readFileSync(swPath, 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  ck(blocks.length === 1, 'one inline application script');
  for (let i = 0; i < blocks.length; i++) {
    try { new vm.Script(blocks[i], { filename: 'earmark-inline-' + i + '.js' }); }
    catch (e) { fail.push('inline script syntax: ' + e.message); }
  }

  has(/loading=["']lazy["']/i, html, 'remote article media is lazy-loaded');
  has(/referrerpolicy=["']no-referrer["']/i, html, 'remote article media suppresses referrers');
  has(/https?:[\\/]{2}/i, html, 'URL handling remains explicit');
  has(/\/v1\/responses\b/i, html, 'summaries use the OpenAI Responses API');
  for (const model of ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']) {
    ck(html.includes(model), 'model selector includes ' + model);
  }
  has(/output_text/i, html, 'Responses output text is parsed explicitly');
  has(/provenance|promptVersion|prompt_version|generatedAt|generated_at/i, html,
    'generated modes retain provenance');
  has(/regenerat/i, html, 'generated summaries can be regenerated');
  has(/trending\.json/i, html, 'Trending loads the packaged metadata feed');
  has(/>\s*Trending(?: AI)?\s*</i, html, 'Trending has a visible navigation control');
  has(/add.{0,24}(queue|article)|queue.{0,24}add/is, html,
    'Trending exposes an add-to-queue path');

  has(/CACHE_PREFIX\s*\+\s*["']v2["']/, sw, 'service-worker cache version was bumped');
  has(/trendingNetworkFirst/, sw, 'Trending has a network-first cache path');
  has(/trending\.json/, sw, 'service worker recognizes trending.json');
}

function validateTrending(data, label, minimumItems) {
  console.log('B. ' + label + ' metadata contract');
  ck(data && typeof data === 'object' && !Array.isArray(data), label + ' is an object');
  if (!data || typeof data !== 'object') return;
  ck(typeof (data.updated || data.generatedAt || data.generated_at) === 'string' ||
    typeof (data.updated || data.generatedAt || data.generated_at) === 'number',
  label + ' has a generation timestamp');
  ck(Array.isArray(data.items), label + ' has an items array');
  if (!Array.isArray(data.items)) return;
  const minimum = minimumItems === undefined ? 1 : minimumItems;
  ck(data.items.length >= minimum && data.items.length <= 100,
    label + ' contains ' + minimum + ' to 100 items');

  const forbidden = new Set(['html', 'text', 'content', 'body', 'article', 'fulltext',
    'full_text', 'markdown', 'raw', 'transcript']);
  const urls = new Set();
  const errors = [];
  const aiRe = /\b(ai|artificial intelligence|machine learning|llm|model|agent|inference|training|multimodal|openai|anthropic|deepmind|nvidia)\b/i;
  const technicalRe = /\b(model|agent|inference|training|benchmark|evaluation|eval|token|context|architecture|api|sdk|research|paper|dataset|open source|weights|reasoning|multimodal|compute|safety|alignment|tool|memory|protocol)\b/i;

  function visit(value, itemNo, key) {
    if (key && forbidden.has(String(key).toLowerCase())) {
      errors.push('item ' + itemNo + ' contains full-content field "' + key + '"');
    }
    if (typeof value === 'string' && key !== 'url') {
      if (value.length > 1200) errors.push('item ' + itemNo + ' has oversized "' + key + '"');
    } else if (Array.isArray(value)) {
      for (const part of value) visit(part, itemNo, key);
    } else if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) visit(childValue, itemNo, childKey);
    }
  }

  data.items.forEach((item, index) => {
    const n = index + 1;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push('item ' + n + ' is not an object');
      return;
    }
    if (typeof item.id !== 'string' || !item.id) errors.push('item ' + n + ' has no id');
    if (typeof item.title !== 'string' || !item.title || item.title.length > 300) errors.push('item ' + n + ' has an invalid title');
    if (typeof item.source !== 'string' || !item.source) errors.push('item ' + n + ' has no source');
    if (typeof item.url !== 'string' || !/^https?:\/\//i.test(item.url)) errors.push('item ' + n + ' has an unsafe URL');
    if (urls.has(item.url)) errors.push('item ' + n + ' repeats a URL');
    urls.add(item.url);
    const metadata = JSON.stringify(item);
    if (metadata.length > 6000) errors.push('item ' + n + ' is larger than metadata');
    if (!aiRe.test(metadata)) errors.push('item ' + n + ' is not explicitly AI-related');
    if (!technicalRe.test(metadata)) errors.push('item ' + n + ' lacks technical substance');
    visit(item, n, 'item');
  });
  if (errors.length) fail.push(label + ': ' + errors.join('; '));
  else console.log('  ok:', label + ' items are safe, unique, AI-specific technical metadata');
}

function serve() {
  const trendingFixture = fixture('trending.json');
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch (e) { res.writeHead(400); res.end(); return; }
    if (pathname === '/earmark/trending.json') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(trendingFixture);
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const relative = path.normalize(pathname.replace(/^[/\\]+/, ''));
    const file = path.join(ROOT, relative);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    const ext = path.extname(file).toLowerCase();
    const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
      '.webmanifest':'application/manifest+json', '.png':'image/png' };
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
}

async function browserContracts() {
  console.log('C. isolated browser flows');
  const { chromium } = require('playwright');
  const server = serve();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const launch = { args: ['--no-sandbox'] };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const requests = [];
  const pageErrors = [];
  let responseNo = 0;
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\//, async (route) => {
      const request = route.request();
      const url = request.url();
      if (url.startsWith(base)) { await route.continue(); return; }
      if (url.startsWith('https://r.jina.ai/')) {
        const body = url.includes('research.example') ? fixture('jina-trending.md') : fixture('jina-rich.md');
        await route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body });
        return;
      }
      if (url.startsWith('https://api.allorigins.win/')) {
        await route.fulfill({ status: 502, contentType: 'text/plain', body: 'fixture fallback not expected' });
        return;
      }
      if (url.startsWith('https://api.fxtwitter.com/2/search')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: fixture('fxtwitter-search.json') });
        return;
      }
      if (url === 'https://api.fxtwitter.com/2/status/2090000000000000777') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: fixture('fxtwitter-status.json') });
        return;
      }
      if (url === 'https://media.example.test/memory-architecture.png') {
        await route.fulfill({ status: 200, contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#ddd"/></svg>' });
        return;
      }
      if (url === 'https://media.example.test/x-visual-reasoning.png') {
        await route.fulfill({ status: 200, contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#c9c1ff"/></svg>' });
        return;
      }
      if (url === 'https://api.openai.com/v1/responses') {
        requests.push(JSON.parse(request.postData() || '{}'));
        const payload = JSON.parse(fixture('openai-response.json'));
        responseNo++;
        if (responseNo > 1) {
          payload.id = 'resp_earmark_fixture_regenerated';
          payload.output[0].content[0].text = 'Regenerated fixture summary: provenance and failure evaluations keep agent memory reliable.';
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
        return;
      }
      if (url.includes('.supabase.co/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }
      await route.abort();
    });

    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(base + '/earmark/', { waitUntil: 'domcontentloaded' });
    await page.locator('#inp').fill('https://article.example/rich');
    await page.locator('#addBtn').click();
    const richCard = page.locator('.card', { hasText: 'A technical tour of reliable agent memory' });
    await richCard.waitFor({ timeout: 10000 });
    await richCard.locator('[data-act="play"]').click();

    const image = page.locator('#readerView img[src="https://media.example.test/memory-architecture.png"]');
    await image.waitFor({ timeout: 5000 });
    ck(await page.locator('#readerView img').count() === 1, 'unsafe media URLs are discarded');
    ck(await image.evaluate((el) => el.loading) === 'lazy', 'rendered media remains lazy-loaded');
    ck(await image.evaluate((el) => el.referrerPolicy) === 'no-referrer', 'rendered media uses no-referrer');

    await page.waitForTimeout(750);
    const saved = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    ck(JSON.stringify(saved).includes('https://media.example.test/memory-architecture.png'),
      'media sidecar survives device persistence');
    await page.reload({ waitUntil: 'domcontentloaded' });
    const restoredCard = page.locator('.card', { hasText: 'A technical tour of reliable agent memory' });
    await restoredCard.waitFor({ timeout: 5000 });
    await restoredCard.locator('[data-act="play"]').click();
    await image.waitFor({ timeout: 5000 });
    ck(true, 'media renders after reload');

    await page.locator('#backBtn').click();
    await page.locator('#inp').fill('https://x.com/i/article/2090000000000000123');
    await page.locator('#addBtn').click();
    const xCard = page.locator('.card', { hasText: 'Visual reasoning systems from first principles' });
    await xCard.waitFor({ timeout: 10000 });
    await xCard.locator('[data-act="play"]').click();
    await page.locator('#readerView img[src="https://media.example.test/x-visual-reasoning.png"]').waitFor({ timeout: 5000 });
    ck(true, 'direct X Article resolves its full body and cover visual');
    await page.locator('#backBtn').click();
    await restoredCard.locator('[data-act="play"]').click();

    await page.evaluate(() => {
      state.aiKey = 'sk-fixture-not-a-real-key';
      persistNow();
    });
    const selected = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const select of selects) {
        const option = Array.from(select.options).find((o) => /gpt-5\.6-sol|\bsol\b/i.test(o.value + ' ' + o.textContent));
        if (!option) continue;
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return option.value;
      }
      return null;
    });
    ck(!!selected, 'Sol can be selected for premium summaries');
    await page.getByRole('button', { name: 'Quick summary' }).click();
    await page.getByText('Fixture summary:', { exact: false }).waitFor({ timeout: 10000 });
    ck(requests.length === 1, 'summary makes one Responses request');
    ck(requests[0] && requests[0].model === 'gpt-5.6-sol', 'selected Sol model reaches the API request');
    const mode = await page.evaluate(() => {
      const article = state.articles.find((a) => a.title === 'A technical tour of reliable agent memory');
      return article && article.modes && article.modes.summary;
    });
    const modeJson = JSON.stringify(mode || {});
    ck(modeJson.includes('gpt-5.6-sol'), 'summary provenance records the model');
    ck(/prompt|generated|created|provenance|version/i.test(modeJson), 'summary provenance records generation context');

    const regenerate = page.getByRole('button', { name: /regenerat/i }).first();
    await regenerate.waitFor({ timeout: 5000 });
    await regenerate.click();
    await page.getByText('Regenerated fixture summary:', { exact: false }).waitFor({ timeout: 10000 });
    ck(requests.length === 2, 'regenerate makes exactly one new Responses request');

    await page.locator('#backBtn').click();
    const trending = page.locator('#trendingTab');
    await trending.waitFor({ timeout: 5000 });
    await trending.click();
    await page.getByText('Evaluating tool-using AI agents under failure', { exact: true }).waitFor({ timeout: 5000 });
    const add = page.getByRole('button', { name: /add.*queue|queue.*add/i }).first();
    await add.waitFor({ timeout: 5000 });
    await add.click();
    await page.waitForFunction(() => state.articles.some((a) => a.title === 'Evaluating tool-using AI agents under failure'), null,
      { timeout: 10000 });
    ck(true, 'Trending item can be added to the listening queue');
    ck(pageErrors.length === 0, 'no page errors in Earmark flows' + (pageErrors.length ? ': ' + pageErrors.join(' | ') : ''));
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
}

(async () => {
  syntaxAndStaticContracts();
  validateTrending(JSON.parse(fixture('trending.json')), 'fixture trending feed', 1);
  if (fs.existsSync(trendingPath)) {
    const packaged = JSON.parse(fs.readFileSync(trendingPath, 'utf8'));
    validateTrending(packaged, 'packaged trending feed', 5);
    try {
      const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'earmark', 'trending-sources.json'), 'utf8'));
      require(path.join(ROOT, 'tools', 'earmark-trending-refresh.js')).validateDocument(packaged, policy);
      console.log('  ok: packaged trending feed passes the generator policy');
    } catch (e) {
      fail.push('packaged trending feed policy: ' + e.message);
    }
  } else fail.push('packaged trending feed exists at earmark/trending.json');
  if (process.env.EARMARK_STATIC_ONLY !== '1') await browserContracts();
  if (fail.length) {
    console.error('\nEARMARK-CHECK FAIL (' + fail.length + '):\n - ' + fail.join('\n - '));
    process.exit(1);
  }
  console.log('\nEARMARK-CHECK PASS');
})().catch((e) => {
  console.error('EARMARK-CHECK CRASH:', e && e.stack ? e.stack : e);
  process.exit(1);
});
