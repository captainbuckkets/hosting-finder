// GET /api/go?id=H0318&src=skill
// Tracked outbound link for the hosting-finder skill and web page.
// Logs the click (in-memory counters + one structured JSON log line, the
// durable record in Vercel's runtime logs), then 302-redirects to the
// provider's affiliate_url when one exists, otherwise to the provider site.
//
// Only redirects to a URL from the dataset — the id is looked up, never a
// caller-supplied URL, so this cannot be used as an open redirect.
// src is free text from the caller (skill | api | web) and is counted only
// in aggregate; no IPs, API keys, or raw user data are stored.
// ?debug=1 returns the target as JSON instead of redirecting (for testing).
// Tracking never blocks the redirect: if anything in recordClick fails,
// the redirect still happens.
const { loadProviders, recordClick, targetUrl } = require('./_lib');

function logClick(id, providerName, kind, src, target) {
  try {
    console.log(JSON.stringify({
      event: 'api_click',
      ts: new Date().toISOString(),
      id,
      provider: providerName || null,
      kind, // 'affiliate' (earning click) or 'website' (no affiliate link)
      src: src || 'unknown',
      target_host: (() => { try { return new URL(target).hostname; } catch (e) { return null; } })(),
    }));
  } catch (e) { /* logging must never break a redirect */ }
}

module.exports = (req, res) => {
  const id = ((req.query && req.query.id) || '').toUpperCase();
  const src = (req.query && req.query.src) ? String(req.query.src).trim().toLowerCase().slice(0, 32) : 'unknown';
  if (!id) return res.status(400).json({ error: 'missing_id', message: 'Pass ?id=H0001, e.g. /api/go?id=H0318' });

  const p = loadProviders().find(x => x.id === id);
  if (!p) return res.status(404).json({ error: 'not_found', message: `No provider with id ${id}.` });

  const { url, kind } = targetUrl(p);
  if (!url) return res.status(404).json({ error: 'no_target', message: `Provider ${id} has no website or affiliate link.` });

  recordClick({ provider: p, kind, src });
  logClick(id, p.provider, kind, src, url);

  if (req.query && req.query.debug === '1') {
    return res.status(200).json({ id, provider: p.provider, kind, src, target: url });
  }

  // 302 (not 301): the target can change when an affiliate link is added.
  if (typeof res.redirect === 'function') return res.redirect(302, url);
  res.writeHead(302, { Location: url });
  return res.end();
};
