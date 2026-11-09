// GET /api/search?type=vps&country=Germany&crypto=true&max_price=10&limit=10&q=hetzner
// Free tier (no api_key): max 10 results, basic fields, 20 req/day/IP.
// Paid tier (api_key or x-api-key header): max 100 results, all fields, 200 req/day/IP.
//
// Usage tracking: every search attempt (including rate-limited ones) is
// recorded in-memory via recordSearch() and logged as one structured JSON
// line (event: "api_search") — the durable record in Vercel's runtime logs.
// No IPs or API keys are logged.
const { isPaid, checkRateLimit, project, filterProviders, FREE_LIMIT, PAID_LIMIT, recordSearch } = require('./_lib');

const LOG_FILTER_KEYS = ['type', 'country', 'state', 'city', 'service', 'crypto', 'kyc', 'dmca', 'max_price', 'affiliate'];

function logSearch(req, paid, total, returned, hasAffiliate, rateLimited) {
  try {
    const filters = {};
    for (const k of LOG_FILTER_KEYS) {
      if (req.query && req.query[k] !== undefined && req.query[k] !== null && String(req.query[k]) !== '') {
        filters[k] = String(req.query[k]);
      }
    }
    console.log(JSON.stringify({
      event: 'api_search',
      ts: new Date().toISOString(),
      tier: paid ? 'paid' : 'free',
      q: (req.query && typeof req.query.q === 'string' && req.query.q.trim()) ? req.query.q.trim() : null,
      filters,
      total,
      returned,
      has_affiliate_result: !!hasAffiliate,
      rate_limited: !!rateLimited,
    }));
  } catch (e) { /* logging must never break a response */ }
}

module.exports = (req, res) => {
  const paid = isPaid(req);
  const rl = checkRateLimit(req, paid);
  res.setHeader('X-RateLimit-Limit', rl.cap);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, rl.cap - rl.used));
  if (!rl.allowed) {
    recordSearch({ paid, query: req.query, rate_limited: true });
    logSearch(req, paid, 0, 0, false, true);
    return res.status(429).json({
      error: 'rate_limited',
      message: `Free tier allows ${rl.cap} requests/day. Upgrade for more.`,
      tier: paid ? 'paid' : 'free',
    });
  }

  const limit = Math.min(
    parseInt(req.query.limit || '', 10) || (paid ? PAID_LIMIT : FREE_LIMIT),
    paid ? PAID_LIMIT : FREE_LIMIT
  );

  const list = filterProviders(req.query);
  const total = list.length;
  const results = list.slice(0, limit).map(p => project(p, paid));
  const hasAffiliate = results.some(r => r && r.affiliate_url);
  recordSearch({ paid, query: req.query, total, returned: results.length, results });
  logSearch(req, paid, total, results.length, hasAffiliate, false);

  return res.status(200).json({
    tier: paid ? 'paid' : 'free',
    total,
    returned: results.length,
    limit,
    results,
    upgrade: paid ? null : 'Full data (813 providers, all fields, 200 req/day) is available on the paid tier.',
  });
};
