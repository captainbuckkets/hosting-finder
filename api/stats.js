// GET /api/stats — dataset coverage (no rate limit, public).
const { loadProviders, getUsage } = require('./_lib');

module.exports = (req, res) => {
  const list = loadProviders();
  const countries = new Set();
  list.forEach(p => (p.countries || []).forEach(c => countries.add(c)));
  const withPrice = list.filter(p => p.starting_price).length;
  const withCrypto = list.filter(p => /yes|bitcoin|btc|crypto|usdt|monero|xmr/i.test(p.crypto || '')).length;
  const withAffiliate = list.filter(p => p.affiliate_url).length;
  const usage = getUsage();
  return res.status(200).json({
    total_providers: list.length,
    hq_countries: countries.size,
    with_starting_price: withPrice,
    accepts_crypto: withCrypto,
    with_affiliate_link: withAffiliate,
    updated: new Date().toISOString().slice(0, 10),
    // Clicks via /api/go — the affiliate-link tracker. In-memory per
    // serverless instance (resets on cold start), so these are a lower bound;
    // the durable record is the api_click log lines in Vercel runtime logs.
    // Payments are NOT tracked here: conversions and payouts live in each
    // affiliate network's dashboard (CJ, FirstPromoter, etc.) and are
    // reconciled against these click counts.
    clicks: {
      total: usage.total_clicks,
      today: usage.clicks_today,
      affiliate_clicks: usage.affiliate_clicks,
      website_clicks: usage.website_clicks,
      top_clicked_providers: usage.top_clicked_providers,
      by_source: usage.clicks_by_source,
    },
    // Usage is in-memory per serverless instance (resets on cold start), so
    // these are a lower bound / rough signal, not exact totals. Aggregate
    // counts only — no IPs, API keys, or raw user data.
    usage,
  });
};
