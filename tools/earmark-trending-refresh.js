#!/usr/bin/env node
'use strict';

// Build Earmark's small, metadata-only technical-AI feed from curated public
// RSS/Atom sources. Node 20 built-ins only; run from any working directory.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONFIG = path.join(REPO_ROOT, 'earmark', 'trending-sources.json');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'earmark', 'trending.json');
const USER_AGENT = 'EarmarkTrending/1.0 (+https://sudipbha.github.io/naan-kabob-apps/earmark/)';
const TRACKING_PARAM = /^(utm_[a-z]+|fbclid|gclid|dclid|mc_cid|mc_eid|ref|source|campaign|trk)$/i;

const AI_SIGNALS = [
  /\bartificial intelligence\b/i,
  /\b(?:generative|agentic) ai\b/i,
  /\bai (?:model|system|agent|assistant|research|safety|engineering)\b/i,
  /\b(?:large language model|language model|vision.language model|foundation model)s?\b/i,
  /\b(?:llm|vlm)s?\b/i,
  /\bmachine learning\b/i,
  /\bdeep learning\b/i,
  /\bneural (?:network|model|architecture)s?\b/i,
  /\btransformer(?:s| model| architecture)?\b/i,
  /\b(?:diffusion|multimodal) model(?:s)?\b/i,
  /\b(?:claude|chatgpt|gpt-[0-9a-z.-]+|gemini|llama|mistral|qwen|deepseek)\b/i
];

const TECH_SIGNALS = [
  { key: 'research', topic: 'Research', level: 2, re: /\b(?:research|paper|study|finding|technical report|preprint|arxiv)\b/i },
  { key: 'evaluation', topic: 'Evaluations', level: 2, re: /\b(?:benchmark|evaluation|evals?|metric|accuracy|ablation|leaderboard)\b/i },
  { key: 'training', topic: 'Training', level: 2, re: /\b(?:pretrain|post.train|training|fine.tun|distill|reinforcement learning|rlhf|optimization)\b/i },
  { key: 'inference', topic: 'Inference', level: 2, re: /\b(?:inference|serving|latency|throughput|quantiz|compression|compute.efficient)\b/i },
  { key: 'architecture', topic: 'Models', level: 2, re: /\b(?:architecture|parameter|mixture.of.experts|attention|transformer|diffusion|tokeniz|context window)\b/i },
  { key: 'agents', topic: 'Agents', level: 1, re: /\b(?:ai agent|agentic|tool use|function call|computer use|multi.agent|workflow orchestration)\b/i },
  { key: 'safety', topic: 'Safety', level: 2, re: /\b(?:alignment|model safety|ai safety|red.team|jailbreak|system card|interpretability|robustness|guardrail)\b/i },
  { key: 'data', topic: 'Data', level: 2, re: /\b(?:dataset|synthetic data|data curation|data quality|retrieval.augmented|\brag\b|embedding)\b/i },
  { key: 'engineering', topic: 'Engineering', level: 1, re: /\b(?:open.source|source code|github|developer|api|sdk|framework|implementation|production system)\b/i },
  { key: 'robotics', topic: 'Robotics', level: 2, re: /\b(?:robotics?|robot learning|vision.language.action|autonomous system)\b/i },
  { key: 'security', topic: 'Security', level: 2, re: /\b(?:cybersecurity|security research|threat model|vulnerabilit|prompt injection|model extraction)\b/i },
  { key: 'reasoning', topic: 'Reasoning', level: 2, re: /\b(?:reasoning|chain.of.thought|test.time compute|planning|theorem proving)\b/i },
  { key: 'multimodal', topic: 'Multimodal', level: 2, re: /\b(?:multimodal|vision.language|speech model|audio model|video generation)\b/i }
];

const BUSINESS_GOSSIP = /\b(?:funding round|series [a-h] funding|raises? \$|valuation|market cap|stock price|shares (?:rose|fell|jumped)|quarterly earnings|revenue forecast|acquisition|acquires|merger|layoffs?|executive shuffle|appoints? (?:a |new )?(?:ceo|cfo|president)|rumou?r|gossip|celebrity|office drama)\b/i;
const PURE_PROMOTION = /\b(?:register (?:now|today)|join our webinar|buy tickets?|limited.time offer|free trial|customer stor(?:y|ies)|customer spotlight|customer journeys?|case study|sponsored content|partner spotlight|apply now|we are hiring|event recap|conference agenda|enterprise adoption|enterprises? (?:are )?(?:adopting|deploying|put)|frontier firms|with chatgpt work)\b/i;
const PROMO_TITLE = /^(?:introducing|announcing|launching|now available|meet)\b/i;

function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number(dec)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function safeCodePoint(number) {
  try { return String.fromCodePoint(number); } catch (_) { return ''; }
}

function stripMarkup(value) {
  return decodeEntities(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstTag(block, names) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const paired = new RegExp('<' + escaped + '\\b[^>]*>([\\s\\S]*?)<\\/' + escaped + '>', 'i').exec(block);
    if (paired && paired[1].trim()) return paired[1].trim();
  }
  return '';
}

function attr(tag, name) {
  const escaped = escapeRegExp(name);
  const match = new RegExp('\\b' + escaped + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i').exec(tag || '');
  return decodeEntities(match ? (match[1] === undefined ? match[2] : match[1]) : '').trim();
}

function firstElement(block, names) {
  for (const name of names) {
    const match = new RegExp('<' + escapeRegExp(name) + '\\b[^>]*>', 'i').exec(block);
    if (match) return match[0];
  }
  return '';
}

function itemLink(block) {
  const links = block.match(/<link\b[^>]*>/gi) || [];
  for (const link of links) {
    const href = attr(link, 'href');
    const rel = attr(link, 'rel').toLowerCase();
    if (href && (!rel || rel === 'alternate')) return href;
  }
  return stripMarkup(firstTag(block, ['link', 'guid', 'id']));
}

function itemImage(block) {
  const candidates = [
    ...block.match(/<media:thumbnail\b[^>]*>/gi) || [],
    ...block.match(/<media:content\b[^>]*>/gi) || [],
    ...block.match(/<enclosure\b[^>]*>/gi) || []
  ];
  for (const element of candidates) {
    const url = attr(element, 'url');
    const type = attr(element, 'type').toLowerCase();
    const medium = attr(element, 'medium').toLowerCase();
    if (url && (!type || type.startsWith('image/')) && (!medium || medium === 'image')) {
      return safeHttpUrl(url);
    }
  }
  return null;
}

function safeHttpUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch (_) {
    return null;
  }
}

function canonicalizeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    }
    const sorted = [...url.searchParams.entries()].sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
    url.search = '';
    for (const [key, val] of sorted) url.searchParams.append(key, val);
    return url.href;
  } catch (_) {
    return '';
  }
}

function cleanExcerpt(value) {
  return stripMarkup(value)
    .replace(/\bThe post .{0,160}? appeared first on .+$/i, '')
    .replace(/\b(?:Subscribe|Sign up) (?:to|for) .+$/i, '')
    .trim()
    .slice(0, 320);
}

function parseFeed(xml, source) {
  const blocks = String(xml || '').match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || [];
  const items = [];
  for (const block of blocks.slice(0, 40)) {
    const title = stripMarkup(firstTag(block, ['title'])).slice(0, 240);
    const url = canonicalizeUrl(itemLink(block));
    const publishedRaw = stripMarkup(firstTag(block, ['pubDate', 'published', 'updated', 'dc:date', 'date']));
    const timestamp = Date.parse(publishedRaw);
    const summary = firstTag(block, ['description', 'summary', 'content:encoded', 'content']);
    const authorBlock = firstTag(block, ['author']);
    const author = stripMarkup(firstTag(block, ['dc:creator', 'creator']) || firstTag(authorBlock, ['name']) || authorBlock).slice(0, 160);
    if (!title || !url || !Number.isFinite(timestamp)) continue;
    items.push({
      title,
      url,
      source: source.name,
      sourceId: source.id,
      sourceWeight: source.weight,
      dedicatedAI: source.dedicatedAI !== false,
      minTechnicalSignals: source.minTechnicalSignals || 2,
      author,
      publishedAt: new Date(timestamp).toISOString(),
      excerpt: cleanExcerpt(summary),
      imageUrl: itemImage(block)
    });
  }
  return items;
}

function signalMatches(text, signals) {
  return signals.filter((signal) => signal instanceof RegExp ? signal.test(text) : signal.re.test(text));
}

function normalizeTitle(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function selectItem(raw, now, config) {
  const text = raw.title + ' ' + raw.excerpt;
  if (raw.excerpt.length < 40) return null;
  if (BUSINESS_GOSSIP.test(text) || PURE_PROMOTION.test(text)) return null;

  const aiMatches = signalMatches(text, AI_SIGNALS);
  const techMatches = signalMatches(text, TECH_SIGNALS);
  const requiredTechnical = Math.max(config.minTechnicalSignals, raw.minTechnicalSignals);
  const relevant = aiMatches.length > 0 || (raw.dedicatedAI && techMatches.length >= requiredTechnical + 1);
  if (!relevant || techMatches.length < requiredTechnical) return null;
  if (PROMO_TITLE.test(raw.title) && techMatches.length < requiredTechnical + 2) return null;

  const ageDays = (now.getTime() - Date.parse(raw.publishedAt)) / 86400000;
  if (!Number.isFinite(ageDays) || ageDays < -2 || ageDays > config.maxAgeDays) return null;

  const topicSet = new Set(techMatches.map((match) => match.topic));
  const topics = [...topicSet].slice(0, 4);
  const levelPoints = techMatches.reduce((sum, match) => sum + match.level, 0);
  const technicalLevel = levelPoints >= 7 || techMatches.length >= 5 ? 'advanced' : 'intermediate';
  const recencyScore = Math.max(0, Math.round(36 - Math.max(0, ageDays) * 1.5));
  const score = Math.round(raw.sourceWeight + recencyScore + Math.min(12, aiMatches.length * 3) + Math.min(28, techMatches.length * 4));
  const evidence = techMatches.slice(0, 2).map((match) => match.key).join(' and ');

  return {
    id: crypto.createHash('sha256').update(raw.url).digest('hex').slice(0, 16),
    title: raw.title,
    url: raw.url,
    source: raw.source,
    author: raw.author,
    publishedAt: raw.publishedAt,
    excerpt: raw.excerpt,
    topics,
    technicalLevel,
    whySelected: `Recent technical AI coverage with ${evidence} signals from a curated high-signal source.`,
    score,
    imageUrl: raw.imageUrl
  };
}

function buildDocument(parts, config, now) {
  const selected = [];
  for (const part of parts) {
    for (const raw of part.items) {
      const item = selectItem(raw, now, config);
      if (item) selected.push({ ...item, sourceId: part.source.id });
    }
  }

  selected.sort((a, b) => b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.url.localeCompare(b.url));
  const byUrl = new Set();
  const byTitle = new Set();
  const deduped = [];
  for (const item of selected) {
    const titleKey = normalizeTitle(item.title);
    if (byUrl.has(item.url) || byTitle.has(titleKey)) continue;
    byUrl.add(item.url);
    byTitle.add(titleKey);
    deduped.push(item);
    if (deduped.length >= config.maxItems) break;
  }

  const items = deduped.map(({ sourceId: _, ...item }) => item);
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    sourceCount: new Set(items.map((item) => item.source)).size,
    items
  };
}

function validateConfig(config) {
  if (!config || config.schemaVersion !== 1 || !Array.isArray(config.sources)) throw new Error('invalid source config schema');
  for (const key of ['minItems', 'maxItems', 'minSuccessfulSources', 'minTechnicalSignals', 'maxAgeDays']) {
    if (!Number.isInteger(config[key]) || config[key] < 1) throw new Error(`invalid config ${key}`);
  }
  if (config.maxItems < config.minItems) throw new Error('maxItems must be >= minItems');
  const ids = new Set();
  for (const source of config.sources) {
    if (!source || !source.id || !source.name || !safeHttpUrl(source.url) || !Number.isInteger(source.weight)) throw new Error('invalid source entry');
    if (!String(source.url).startsWith('https://')) throw new Error(`source must use HTTPS: ${source.id}`);
    if (ids.has(source.id)) throw new Error(`duplicate source id: ${source.id}`);
    ids.add(source.id);
  }
  return config;
}

function validateDocument(document, config) {
  if (!document || document.schemaVersion !== 1 || !Number.isFinite(Date.parse(document.generatedAt))) throw new Error('invalid trending document header');
  if (!Number.isInteger(document.sourceCount) || !Array.isArray(document.items)) throw new Error('invalid trending document collections');
  if (document.items.length < config.minItems || document.items.length > config.maxItems) throw new Error(`item count ${document.items.length} outside ${config.minItems}-${config.maxItems}`);
  const ids = new Set();
  const urls = new Set();
  const sources = new Set();
  for (const item of document.items) {
    const allowedFields = new Set(['id', 'title', 'url', 'source', 'author', 'publishedAt', 'excerpt', 'topics', 'technicalLevel', 'whySelected', 'score', 'imageUrl']);
    if (Object.keys(item).some((key) => !allowedFields.has(key))) throw new Error(`unexpected item field: ${item.title || 'untitled'}`);
    const requiredStrings = ['id', 'title', 'url', 'source', 'author', 'publishedAt', 'excerpt', 'technicalLevel', 'whySelected'];
    if (requiredStrings.some((key) => typeof item[key] !== 'string')) throw new Error('item is missing a required string field');
    if (!/^[a-f0-9]{16}$/.test(item.id) || !item.title || item.excerpt.length < 40 || item.excerpt.length > 320) throw new Error(`invalid item text/id: ${item.title}`);
    if (!safeHttpUrl(item.url) || !Number.isFinite(Date.parse(item.publishedAt))) throw new Error(`invalid item URL/date: ${item.title}`);
    if (!Array.isArray(item.topics) || !item.topics.length || item.topics.some((topic) => typeof topic !== 'string') || !Number.isInteger(item.score)) throw new Error(`invalid item classification: ${item.title}`);
    if (item.imageUrl !== null && !safeHttpUrl(item.imageUrl)) throw new Error(`invalid image URL: ${item.title}`);
    if (ids.has(item.id) || urls.has(item.url)) throw new Error(`duplicate item: ${item.title}`);
    ids.add(item.id);
    urls.add(item.url);
    sources.add(item.source);
  }
  if (document.sourceCount !== sources.size) throw new Error('sourceCount does not match represented sources');
  return document;
}

async function responseTextLimited(response, maxBytes) {
  if (!response.body) return '';
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`response exceeds ${maxBytes} bytes`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error(`response exceeds ${maxBytes} bytes`);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchSource(source, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9', 'user-agent': USER_AGENT }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await responseTextLimited(response, 4_000_000);
    const items = parseFeed(xml, source);
    if (!items.length) throw new Error('no valid dated entries');
    console.log(`OK ${String(items.length).padStart(2)} ${source.id}`);
    return { source, items, ok: true };
  } catch (error) {
    const message = error && error.name === 'AbortError' ? 'timeout' : String(error && error.message || error);
    console.warn(`FAIL ${source.id} ${message}`);
    return { source, items: [], ok: false };
  } finally {
    clearTimeout(timer);
  }
}

function atomicWriteJson(destination, document) {
  const temporary = `${destination}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(document, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, destination);
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch (_) { /* best effort */ }
    throw error;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function selfTest() {
  const now = new Date('2026-08-24T12:00:00.000Z');
  const sourceA = { id: 'lab', name: 'Lab Research', url: 'https://example.com/feed', weight: 22, dedicatedAI: true, minTechnicalSignals: 2 };
  const sourceB = { id: 'engineering', name: 'AI Engineering', url: 'https://example.org/atom', weight: 20, dedicatedAI: true, minTechnicalSignals: 2 };
  const rss = `<?xml version="1.0"?><rss><channel>
    <item><title>Evaluating language model reasoning at inference time</title><link>https://example.com/research?id=7&amp;utm_source=rss</link><pubDate>Sun, 23 Aug 2026 12:00:00 GMT</pubDate><dc:creator>A. Researcher</dc:creator><description><![CDATA[A technical report with benchmarks, ablations, inference latency, and model evaluation details.]]></description><media:thumbnail url="https://example.com/image.jpg" /></item>
    <item><title>AI startup raises $200 million at new valuation</title><link>https://example.com/funding</link><pubDate>Sun, 23 Aug 2026 10:00:00 GMT</pubDate><description>Funding round and investor details for a machine learning company.</description></item>
  </channel></rss>`;
  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry><title>Evaluating language model reasoning at inference time</title><link rel="alternate" href="https://example.com/research?utm_medium=atom&amp;id=7"/><published>2026-08-23T12:00:00Z</published><author><name>B. Author</name></author><summary>Research benchmarks and architecture ablations for inference and model evaluation.</summary></entry>
    <entry><title>Open source multimodal model training recipe</title><link href="https://example.org/posts/multimodal"/><updated>2026-08-22T09:00:00Z</updated><summary>Developer implementation, dataset curation, training architecture, and evaluation benchmarks for a multimodal model.</summary></entry>
  </feed>`;
  const config = { schemaVersion: 1, minItems: 2, maxItems: 5, minSuccessfulSources: 2, minTechnicalSignals: 2, maxAgeDays: 30, sources: [sourceA, sourceB] };
  validateConfig(config);
  const parts = [{ source: sourceA, items: parseFeed(rss, sourceA) }, { source: sourceB, items: parseFeed(atom, sourceB) }];
  const document = buildDocument(parts, config, now);
  validateDocument(document, config);
  if (document.items.length !== 2) throw new Error(`self-test expected 2 selected items, got ${document.items.length}`);
  if (document.items.some((item) => /funding/i.test(item.title))) throw new Error('self-test business rejection failed');
  if (document.items[0].url.includes('utm_')) throw new Error('self-test canonicalization failed');
  if (new Set(document.items.map((item) => item.id)).size !== 2) throw new Error('self-test dedupe failed');
  console.log('SELF-TEST PASS: RSS/Atom parsing, canonicalization, strict filtering, scoring, and dedupe');
}

async function refresh(configPath, outputPath) {
  const config = validateConfig(readJson(configPath));
  const now = new Date();
  const parts = await Promise.all(config.sources.map((source) => fetchSource(source, config.timeoutMs || 15000)));
  const successful = parts.filter((part) => part.ok).length;
  if (successful < config.minSuccessfulSources) {
    throw new Error(`quality gate failed: only ${successful}/${config.sources.length} feeds succeeded; need ${config.minSuccessfulSources}`);
  }
  const document = buildDocument(parts, config, now);
  if (document.items.length < config.minItems) {
    throw new Error(`quality gate failed: only ${document.items.length} technical items selected; need ${config.minItems}`);
  }
  validateDocument(document, config);
  atomicWriteJson(outputPath, document);
  console.log(`WROTE ${document.items.length} items from ${document.sourceCount} represented sources -> ${outputPath}`);
}

async function main(argv) {
  const args = new Set(argv);
  if (args.has('--self-test')) {
    selfTest();
    return;
  }
  const configIndex = argv.indexOf('--config');
  const configPath = configIndex >= 0 ? path.resolve(argv[configIndex + 1]) : DEFAULT_CONFIG;
  const config = validateConfig(readJson(configPath));
  const validateIndex = argv.indexOf('--validate');
  if (validateIndex >= 0) {
    const candidate = argv[validateIndex + 1] && !argv[validateIndex + 1].startsWith('--') ? path.resolve(argv[validateIndex + 1]) : DEFAULT_OUTPUT;
    validateDocument(readJson(candidate), config);
    console.log(`VALID ${candidate}`);
    return;
  }
  const outputIndex = argv.indexOf('--output');
  const outputPath = outputIndex >= 0 ? path.resolve(argv[outputIndex + 1]) : DEFAULT_OUTPUT;
  await refresh(configPath, outputPath);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`ERROR ${error && error.message || error}`);
    console.error('Last-good earmark/trending.json was not overwritten.');
    process.exitCode = 1;
  });
}

module.exports = { buildDocument, canonicalizeUrl, firstTag, itemLink, parseFeed, selectItem, stripMarkup, validateDocument };
