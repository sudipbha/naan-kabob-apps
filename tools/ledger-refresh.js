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
      html: htmlSrc.slice(0, 12000),
      full: strip(rawFull).length > 500,
      sample: false,
      feedId: feed.id
    });
  }
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
  const items = [...map.values()].sort((a, b) => b.date - a.date).slice(0, 80);
  const out = { updated: Date.now(), items };
  const dest = path.join(__dirname, '..', 'ledger', 'headlines.json');
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log('wrote ' + items.length + ' stories -> ' + dest);
  if (!items.length) process.exit(1);
})();
