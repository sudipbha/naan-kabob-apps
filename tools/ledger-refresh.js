#!/usr/bin/env node
// Fetches public finance RSS/Atom feeds and writes ledger/headlines.json.
// Run from the repo root: node tools/ledger-refresh.js
'use strict';

const fs = require('fs');
const path = require('path');

const FEEDS = [
  { id:'cnbc-top', name:'CNBC', url:'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', section:'Markets' },
  { id:'cnbc-econ', name:'CNBC', url:'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258', section:'Economics' },
  { id:'cnbc-pf', name:'CNBC', url:'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=21324812', section:'Personal Finance' },
  { id:'bbc-biz', name:'BBC Business', url:'https://feeds.bbci.co.uk/news/business/rss.xml', section:'Companies' },
  { id:'npr-biz', name:'NPR Business', url:'https://feeds.npr.org/1006/rss.xml', section:'Companies' },
  { id:'fed', name:'Federal Reserve', url:'https://www.federalreserve.gov/feeds/press_all.xml', section:'Central Banks' },
  { id:'fred', name:'FRED Blog', url:'https://fredblog.stlouisfed.org/feed/', section:'Economics' },
  { id:'ecb', name:'ECB Blog', url:'https://www.ecb.europa.eu/rss/blog.html', section:'Central Banks' },
  { id:'boe', name:'Bank of England', url:'https://www.bankofengland.co.uk/rss/news', section:'Central Banks' },
  { id:'bis', name:'BIS', url:'https://www.bis.org/doclist/all_pressrels.rss', section:'Central Banks' },
  { id:'sec', name:'SEC', url:'https://www.sec.gov/news/pressreleases.rss', section:'Companies' },
  { id:'conv-biz', name:'The Conversation', url:'https://theconversation.com/us/business/articles.atom', section:'Companies' },
  { id:'cr', name:'Calculated Risk', url:'https://www.calculatedriskblog.com/feeds/posts/default?alt=rss', section:'Economics' },
  { id:'mr', name:'Marginal Revolution', url:'https://marginalrevolution.com/feed', section:'Opinion' },
  { id:'noah', name:'Noahpinion', url:'https://www.noahpinion.blog/feed', section:'Opinion' },
  { id:'apricitas', name:'Apricitas Economics', url:'https://www.apricitas.io/feed', section:'Economics' },
  { id:'klement', name:'Klement on Investing', url:'https://klementoninvesting.substack.com/feed', section:'Opinion' },
  { id:'awocs', name:'A Wealth of Common Sense', url:'https://awealthofcommonsense.com/feed/', section:'Personal Finance' },
  { id:'bigpic', name:'The Big Picture', url:'https://ritholtz.com/feed/', section:'Opinion' }
];

function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function strip(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function tag(block, names) {
  for (const name of names) {
    const re = new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)</' + name + '>', 'i');
    const m = block.match(re);
    if (m) return decodeEntities(m[1]).trim();
  }
  return '';
}
function atomLink(block) {
  const m = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (m) return m[1].trim();
  return tag(block, ['link', 'id', 'guid']);
}
function hashStr(s) {
  let h = 5381;
  s = String(s || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}
function classify(title, feed) {
  const t = (title || '').toLowerCase();
  if (/fed|ecb|bank of england|boe |fomc|central bank|rate decision|lagarde|powell|bailey|bis /.test(t)) return 'Central Banks';
  if (/401k|isa|retire|mortgage|budget|saving|etf guide|credit card|personal finance/.test(t)) return 'Personal Finance';
  if (/ai |chip|semiconductor|fintech|crypto|bitcoin|payments|cloud |software/.test(t)) return 'Tech & Finance';
  if (/opinion|comment:|i think|why i/.test(t)) return 'Opinion';
  if (/gdp|inflation|jobs report|unemployment|cpi |ppi |recession|yield curve/.test(t)) return 'Economics';
  if (/stock|market|bond|treasury|oil |fx |forex|nasdaq|s&p|dow /.test(t)) return 'Markets';
  return feed.section || 'Companies';
}
function parseXml(xml, feed) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || [];
  const out = [];
  for (const block of blocks.slice(0, 18)) {
    const title = strip(tag(block, ['title']));
    const url = atomLink(block);
    if (!title || !/^https?:/i.test(url)) continue;
    const rawFull = tag(block, ['content:encoded', 'content']);
    const rawSum = tag(block, ['summary', 'description']);
    const htmlSrc = (rawFull && rawFull.length > (rawSum || '').length) ? rawFull : (rawFull || rawSum || '');
    const stand = strip(rawSum || rawFull || '').slice(0, 280);
    const author = strip(tag(block, ['dc:creator', 'creator', 'author', 'name']));
    const ds = tag(block, ['pubDate', 'published', 'updated', 'date', 'dc:date']);
    let ts = Date.parse(ds);
    if (isNaN(ts)) ts = Date.now();
    out.push({
      id: hashStr(url),
      title,
      standfirst: stand,
      source: feed.name,
      author,
      date: ts,
      url,
      section: classify(title, feed),
      html: htmlSrc.slice(0, 40000),
      full: strip(rawFull).length > 700,
      sample: false,
      feedId: feed.id
    });
  }
  return out;
}

const ALLOW = [
  'bbc.co.uk', 'bbc.com', 'npr.org', 'cnbc.com',
  'federalreserve.gov', 'stlouisfed.org', 'ecb.europa.eu',
  'bankofengland.co.uk', 'bis.org', 'sec.gov',
  'theconversation.com', 'calculatedriskblog.com', 'marginalrevolution.com',
  'noahpinion.blog', 'apricitas.io', 'substack.com',
  'awealthofcommonsense.com', 'ritholtz.com'
];
const BLOCK = [
  'ft.com', 'wsj.com', 'bloomberg.com', 'economist.com',
  'nytimes.com', 'washingtonpost.com', 'theathletic.com'
];

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch (e) { return ''; }
}
function hostOk(url) {
  const h = hostOf(url);
  if (!h) return false;
  if (BLOCK.some((d) => h === d || h.endsWith('.' + d))) return false;
  return ALLOW.some((d) => h === d || h.endsWith('.' + d));
}
function looksPaywalled(text) {
  const t = String(text || '').toLowerCase();
  return /subscribe to (continue|read|unlock)|already a subscriber|for subscribers only|create (a free )?account to (continue|read)|this article is for subscribers|metered[_ -]?paywall|piano-paywall|paywall-container|become a subscriber/.test(t);
}
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function jinaToHtml(text) {
  let body = String(text || '').replace(/^[\s\S]*?Markdown Content:\s*/i, '');
  body = body.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  body = body.split(/\n(?:More top stories|Related topics|Share this|Read more from|Sign up for|Subscribe to our)\b/i)[0];
  const chunks = body.split(/\n{2,}/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
  const out = [];
  for (const raw of chunks) {
    let p = raw.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^[-*]\s+/, '');
    if (/^#{1,3}\s/.test(p)) {
      out.push('<h2>' + escapeHtml(p.replace(/^#+\s+/, '')) + '</h2>');
      continue;
    }
    if (/^>/.test(p)) {
      out.push('<blockquote>' + escapeHtml(p.replace(/^>\s*/, '')) + '</blockquote>');
      continue;
    }
    if (p.length < 40 && out.length) continue;
    if (p.length < 25) continue;
    out.push('<p>' + escapeHtml(p) + '</p>');
  }
  return out.join('');
}
async function fetchText(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'TheLedger/1.0 (public RSS reader; +https://sudipbha.github.io/naan-kabob-apps/ledger/)' }
    });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
async function expandItem(it) {
  if (it.full || strip(it.html).length > 700) {
    it.full = strip(it.html).length > 700;
    return it;
  }
  if (!hostOk(it.url)) return it;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await fetchText('https://r.jina.ai/' + it.url, 14000);
      if (looksPaywalled(raw)) {
        console.log('PAYWALL  ' + hostOf(it.url) + '  ' + it.title.slice(0, 50));
        return it;
      }
      const html = jinaToHtml(raw);
      const n = strip(html).length;
      if (n > 700) {
        it.html = html.slice(0, 40000);
        it.full = true;
        if (!it.standfirst) it.standfirst = strip(html).slice(0, 280);
        console.log('FULL ' + n + '  ' + it.source + '  ' + it.title.slice(0, 40));
      }
      return it;
    } catch (e) {
      const msg = String(e.message || e);
      if (/429/.test(msg) && attempt < 2) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      console.log('SKIP  ' + it.source + '  ' + msg);
      return it;
    }
  }
  return it;
}
async function mapLimit(list, n, fn) {
  const out = new Array(list.length);
  let i = 0, active = 0;
  await new Promise((resolve) => {
    const kick = () => {
      if (i >= list.length && active === 0) { resolve(); return; }
      while (active < n && i < list.length) {
        const idx = i++;
        active++;
        Promise.resolve(fn(list[idx])).then((v) => { out[idx] = v; }, () => { out[idx] = list[idx]; })
          .then(() => { active--; kick(); });
      }
    };
    kick();
  });
  return out;
}

async function grab(feed) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'TheLedger/1.0 (public RSS reader; +https://sudipbha.github.io/naan-kabob-apps/ledger/)' }
    });
    if (!res.ok) throw new Error('http ' + res.status);
    const xml = await res.text();
    const items = parseXml(xml, feed);
    console.log((items.length ? 'OK ' : 'EMPTY ') + items.length + '  ' + feed.id);
    return items;
  } catch (e) {
    console.log('FAIL ' + feed.id + '  ' + (e.message || e));
    return [];
  } finally {
    clearTimeout(t);
  }
}

(async () => {
  const parts = await Promise.all(FEEDS.map(grab));
  const map = new Map();
  for (const list of parts) {
    for (const it of list) {
      const key = (it.url || '').split('?')[0].toLowerCase();
      const prev = map.get(key);
      if (!prev || prev.date < it.date) map.set(key, it);
    }
  }
  let items = [...map.values()].sort((a, b) => b.date - a.date).slice(0, 80);
  const need = items.filter((it) => !it.full && strip(it.html).length <= 700 && hostOk(it.url)).length;
  console.log('expanding ' + need + ' teaser stories into full free text…');
  items = await mapLimit(items, 2, expandItem);
  const leftover = items.filter((it) => !it.full && hostOk(it.url) && strip(it.html).length <= 700);
  if (leftover.length) {
    console.log('second pass for ' + leftover.length + ' remaining teasers…');
    await sleep(4000);
    await mapLimit(leftover, 1, expandItem);
  }
  const full = items.filter((it) => it.full).length;
  const out = { updated: Date.now(), items };
  const dest = path.join(__dirname, '..', 'ledger', 'headlines.json');
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log('wrote ' + items.length + ' stories (' + full + ' full) -> ' + dest);
  if (!items.length) process.exit(1);
})();
