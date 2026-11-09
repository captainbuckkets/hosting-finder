// GET /api/provider?id=H0001
// Single provider detail. Free tier returns basic fields; paid returns all.
const { loadProviders, isPaid, checkRateLimit, project, recordProviderLookup } = require('./_lib');

module.exports = (req, res) => {
  const paid = isPaid(req);
  const rl = checkRateLimit(req, paid);
  res.setHeader('X-RateLimit-Limit', rl.cap);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, rl.cap - rl.used));
  if (!rl.allowed) {
    return res.status(429).json({ error: 'rate_limited', message: `Free tier allows ${rl.cap} requests/day.`, tier: paid ? 'paid' : 'free' });
  }
  const id = (req.query.id || '').toUpperCase();
  const p = loadProviders().find(x => x.id === id);
  if (!p) return res.status(404).json({ error: 'not_found', message: `No provider with id ${id}.` });
  recordProviderLookup({ paid, provider: p });
  return res.status(200).json({ tier: paid ? 'paid' : 'free', provider: project(p, paid) });
};
