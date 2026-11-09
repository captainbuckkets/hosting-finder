// Shared helpers for the hosting-finder API.
// Data: 813 verified server hosting providers (VPS, dedicated, bare metal,
// cloud, shared, colocation) across 149 HQ countries. Updated daily.
//
// Usage tracking (lightweight, in-memory): recordSearch(), recordProviderLookup()
// and getUsage() below keep per-instance counters (searches, tier split,
// affiliate-result hits, top queries/filters). LIMITATION: counters live in
// serverless memory and reset on cold start, and each instance counts
// separately, so /api/stats usage numbers are a LOWER BOUND / rough signal,
// not exact totals. The structured console.log line emitted per search
// (api/search.js) is the durable record — Vercel keeps runtime logs. Exact
// persistent counts would need Vercel KV / Upstash Redis (not added here).
// Aggregate counts only — no IPs, API keys, or raw user data are stored.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
let providers = null;

function loadProviders() {
  if (!providers) {
    // Data is split into data/providers-*.json chunks (each small enough to
    // deploy individually); load and concatenate them in order.
    providers = [];
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => /^providers-\d+\.json$/.test(f))
      .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    for (const f of files) {
      providers = providers.concat(JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')));
    }
  }
  return providers;
}

// --- Free tier ---
// No API key: max 10 results per query, basic fields only, 20 requests/day/IP.
// With a paid API key (in PAID_API_KEYS env, comma-separated): up to 100
// results, all fields, 200 requests/day/IP.
// Rate limiting here is in-memory (best-effort on serverless; production
// enforcement should use Vercel KV / Upstash Redis).
const FREE_LIMIT = 10;
const FREE_DAILY = 20;
const PAID_LIMIT = 100;
const PAID_DAILY = 200;

const hits = new Map(); // key: ip + day -> count

function isPaid(req) {
  const key = (req.query && req.query.api_key) || req.headers['x-api-key'] || '';
  const allowed = (process.env.PAID_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
  return key && allowed.includes(key);
}

function checkRateLimit(req, paid) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  const k = ip + '|' + day;
  const n = (hits.get(k) || 0) + 1;
  hits.set(k, n);
  const cap = paid ? PAID_DAILY : FREE_DAILY;
  return { allowed: n <= cap, used: n, cap, ip };
}

const BASIC_FIELDS = ['id', 'provider', 'website', 'countries', 'hosting_type', 'starting_price', 'affiliate_url'];

// --- Usage tracking (in-memory, per instance; see header note) ---
const instanceStartedAt = new Date().toISOString();
const usage = {
  total_searches: 0,
  searches_today: 0,
  _today: new Date().toISOString().slice(0, 10), // internal; stripped in getUsage()
  free_searches: 0,
  paid_searches: 0,
  rate_limited: 0,
  searches_with_affiliate_results: 0,
  searches_with_results: 0,
  searches_no_results: 0,
  provider_lookups: 0,
  provider_lookups_with_affiliate: 0,
  _topQueries: new Map(), // lowercased q -> count
  _topFilters: new Map(), // "param=value" -> count
};

function _bump(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
  // Bound memory: if the map grows past 200 distinct keys, drop the
  // lowest-count entries back down to 100.
  if (map.size > 200) {
    const sorted = [...map.entries()].sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < sorted.length - 100; i++) map.delete(sorted[i][0]);
  }
}

function _topEntries(map, n) {
  const out = {};
  for (const [k, v] of [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)) out[k] = v;
  return out;
}

// Record one search attempt. Cheap and never throws — a tracking bug must
// never break a search response. opts: { paid, query, total, returned,
// results, rate_limited }. Rate-limited attempts count as attempts (and in
// rate_limited) but not in the result-based metrics.
function recordSearch(opts) {
  try {
    const o = opts || {};
    const today = new Date().toISOString().slice(0, 10);
    if (usage._today !== today) { usage._today = today; usage.searches_today = 0; }
    usage.total_searches += 1;
    usage.searches_today += 1;
    if (o.paid) usage.paid_searches += 1; else usage.free_searches += 1;
    if (o.rate_limited) { usage.rate_limited += 1; return; }
    const total = typeof o.total === 'number' ? o.total : 0;
    if (total > 0) usage.searches_with_results += 1;
    else usage.searches_no_results += 1;
    const results = Array.isArray(o.results) ? o.results : [];
    if (results.some(r => r && r.affiliate_url)) usage.searches_with_affiliate_results += 1;
    const q = o.query && typeof o.query.q === 'string' ? o.query.q.trim().toLowerCase() : '';
    if (q) _bump(usage._topQueries, q);
    const FILTER_KEYS = ['type', 'country', 'state', 'city', 'service', 'crypto', 'kyc', 'dmca', 'max_price', 'affiliate'];
    for (const k of FILTER_KEYS) {
      const v = o.query && o.query[k];
      if (v !== undefined && v !== null && String(v) !== '') {
        _bump(usage._topFilters, k + '=' + String(v).toLowerCase().trim());
      }
    }
  } catch (e) { /* tracking must never throw */ }
}

// Record one successful single-provider lookup. opts: { paid, provider }.
function recordProviderLookup(opts) {
  try {
    const o = opts || {};
    usage.provider_lookups += 1;
    if (o.provider && o.provider.affiliate_url) usage.provider_lookups_with_affiliate += 1;
  } catch (e) { /* tracking must never throw */ }
}

function getUsage() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    instance_started_at: instanceStartedAt,
    total_searches: usage.total_searches,
    searches_today: usage._today === today ? usage.searches_today : 0,
    free_searches: usage.free_searches,
    paid_searches: usage.paid_searches,
    rate_limited: usage.rate_limited,
    searches_with_affiliate_results: usage.searches_with_affiliate_results,
    searches_with_results: usage.searches_with_results,
    searches_no_results: usage.searches_no_results,
    provider_lookups: usage.provider_lookups,
    provider_lookups_with_affiliate: usage.provider_lookups_with_affiliate,
    top_queries: _topEntries(usage._topQueries, 20),
    top_filters: _topEntries(usage._topFilters, 20),
  };
}

function project(p, paid) {
  if (paid) return p;
  const out = {};
  for (const f of BASIC_FIELDS) out[f] = p[f];
  return out;
}

// --- Filtering ---
function matchType(p, type) {
  if (!type) return true;
  const t = type.toLowerCase();
  // Strip "planned / not yet launched" clauses — a planned product is not an offering
  const ht = (p.hosting_type || '').toLowerCase()
    .replace(/\([^)]*(planned|not yet launched|coming soon)[^)]*\)/g, '')
    .replace(/(vps|dedicated|bare metal|cloud|shared|colocation)[^|,;]*(planned|not yet launched|coming soon)[^|,;]*/g, '$1');
  if (t === 'vps') return ht.includes('vps') || ht.includes('vds') || ht.includes('virtual') || ht.includes('vserver');
  if (t === 'dedicated' || t === 'bare-metal' || t === 'baremetal') return ht.includes('dedicated') || ht.includes('bare metal');
  if (t === 'cloud') return ht.includes('cloud');
  if (t === 'shared') return ht.includes('shared');
  if (t === 'colocation' || t === 'colo') return ht.includes('colocation') || ht.includes('colo');
  return ht.includes(t);
}

function priceValue(p) {
  // starting_price is free text like "$3.50/mo" or "€2.99/mo" — extract first number
  const m = String(p.starting_price || '').match(/[\d]+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}

function filterProviders(params) {
  let list = loadProviders();
  const q = (params.q || '').toLowerCase();
  if (q) {
    list = list.filter(p =>
      p.provider.toLowerCase().includes(q) ||
      p.website.toLowerCase().includes(q) ||
      (p.countries || []).join(' ').toLowerCase().includes(q));
  }
  if (params.type) list = list.filter(p => matchType(p, params.type));
  if (params.country) {
    const c = params.country.toLowerCase();
    list = list.filter(p => (p.countries || []).some(x => x.toLowerCase().includes(c)));
  }
  if (params.crypto === 'true' || params.crypto === 'yes') {
    list = list.filter(p => /yes|bitcoin|btc|crypto|usdt|monero|xmr/i.test(p.crypto || ''));
  }
  if (params.kyc === 'none' || params.kyc === 'no') {
    list = list.filter(p => /no|none|not required/i.test(p.kyc || ''));
  }
  if (params.dmca === 'ignored' || params.dmca === 'lenient') {
    list = list.filter(p => /ignor|lenient|offshore|dmca-free/i.test(p.dmca_stance || ''));
  }
  if (params.max_price) {
    const max = parseFloat(params.max_price);
    if (!isNaN(max)) {
      list = list.filter(p => { const v = priceValue(p); return v !== null && v <= max; });
    }
  }
  // Sort: cheapest first when a price filter is used, otherwise alphabetical
  if (params.max_price) {
    list = [...list].sort((a, b) => (priceValue(a) ?? 1e9) - (priceValue(b) ?? 1e9));
  } else {
    list = [...list].sort((a, b) => a.provider.localeCompare(b.provider));
  }
  return list;
}

module.exports = { loadProviders, isPaid, checkRateLimit, project, filterProviders, FREE_LIMIT, PAID_LIMIT, recordSearch, recordProviderLookup, getUsage };
