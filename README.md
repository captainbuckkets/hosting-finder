# Hosting Finder — skill + API

Find the right server hosting provider (VPS, dedicated, bare metal, cloud,
shared, colocation) from a verified dataset of **710 providers across 139 HQ
countries**, updated daily by the hosting watch.

## What this is

- `skill/SKILL.md` — the agent skill (SKILL.md format, works with Claude Code,
  Cursor, Codex, Copilot, and 18+ agents via Skills.sh). Ships with a free
  100-provider sample (`skill/providers-sample.json`) for offline use.
- `api/` — Vercel serverless functions serving the full dataset:
  - `GET /api/search?type=vps&country=Germany&crypto=true&max_price=10&limit=10`
  - `GET /api/provider?id=H0001`
  - `GET /api/go?id=H0318&src=skill` — tracked outbound link (302 to the affiliate link, or the provider site)
  - `GET /api/stats`
- `data/providers.json` — the full dataset, generated from
  `~/workspace/goals/server-hosting-provider-watch/files/server-hosting-providers.csv`.

## Free tier

- No key needed: **10 results per query, basic fields only** (name, website,
  countries, type, starting price, affiliate link), **20 requests/day per IP**.
- Paid (API key in `PAID_API_KEYS` env, comma-separated): **100 results per
  query, all fields** (crypto, KYC, DMCA stance, privacy notes), **200
  requests/day per IP**.
- Rate limiting is in-memory in `_lib.js` (best-effort on serverless).
  Production enforcement should use Vercel KV / Upstash Redis.

## Affiliate links and click tracking

- Every API result carries `affiliate_url` (raw link, when one exists) and
  `click_url` (`/api/go?id=Hxxxx`). Agents and the web page must link through
  `click_url`, never the raw affiliate link — `/api/go` counts the click
  (in-memory counters in `/api/stats`, plus a structured `api_click` log line
  in Vercel runtime logs, the durable record), then 302-redirects to the
  affiliate link, or to the provider site when there is no affiliate link.
  Append `&src=skill` (skill), `&src=web` (web page), or `&src=api` so the
  source is counted. 10 of 813 providers have a live affiliate link as of
  Nov 13, 2026.
- Payments are NOT tracked by the API: conversions and payouts live in each
  affiliate network's dashboard (CJ, FirstPromoter, etc.) and are reconciled
  against these click counts. A click proves interest, not a sale.
- Optional persistent counts: set `UPSTASH_REDIS_REST_URL` +
  `UPSTASH_REDIS_REST_TOKEN` (Upstash free tier, $0) in Vercel env and
  `recordClick()` also increments Redis keys (`hf:clicks:*`). Without them,
  counts are in-memory + logs only, and reset on cold start. Never a paid tier.

## Test locally

```
node test-api.js
```

## Live API

Deployed on Vercel (project `hosting-finder`): **https://hosting-finder-eta.vercel.app**

- `GET /api/search?type=vps&country=Germany&crypto=true&max_price=10&limit=10`
- `GET /api/provider?id=H0001`
- `GET /api/go?id=H0318&src=skill`
- `GET /api/stats`

Redeploy after regenerating the data with `python3 deploy.py` (uploads the
data chunks, then creates a new production deployment).

## Keeping the data fresh

Regenerate `data/providers.json` from the master CSV after each hosting watch
run (the watch adds ~50 providers/day). The CSV is the source of truth; this
project is a derived copy.
