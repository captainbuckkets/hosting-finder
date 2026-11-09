// GET /api/stats — dataset coverage (no rate limit, public).
const { loadProviders, getUsage } = require('./_lib');

module.exports = (req, res) => {
  const list = loadProviders();
  const countries = new Set();
  list.forEach(p => (p.countries || []).forEach(c => countries.add(c)));
  const withPrice = list.filter(p => p.starting_price).length;
  const withCrypto = list.filter(p => /yes|bitcoin|btc|crypto|usdt|monero|xmr/i.test(p.crypto || '')).length;
  const withAffiliate = list.filter(p => p.affiliate_url).length;
  return res.status(200).json({
    total_providers: list.length,
    hq_countries: countries.size,
    with_starting_price: withPrice,
    accepts_crypto: withCrypto,
    with_affiliate_link: withAffiliate,
    updated: new Date().toISOString().slice(0, 10),
    // Usage is in-memory per serverless instance (resets on cold start), so
    // these are a lower bound / rough signal, not exact totals. Aggregate
    // counts only — no IPs, API keys, or raw user data.
    usage: getUsage(),
  });
};
