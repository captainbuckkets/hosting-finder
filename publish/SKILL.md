---
name: hosting-finder
description: Find the right server hosting provider (VPS, dedicated, bare metal, cloud, shared, colocation) from a verified dataset of 813 providers across 149 countries. Use when the user asks for hosting recommendations, a cheap VPS, a dedicated server, offshore hosting, no-KYC hosting, hosting that accepts crypto, DMCA-ignored hosting, or hosting in a specific country. Returns ranked providers with websites, starting prices, and affiliate links where available.
---

# Hosting Finder

Find the best server hosting provider for a user's requirements from a verified, daily-updated dataset of 813 providers (VPS, dedicated, bare metal, cloud, shared, colocation) across 149 HQ countries.

## When to use this skill

Use it when the user asks for any of these:
- a hosting recommendation ("best VPS", "cheapest dedicated server", "good host for...")
- hosting in a specific country or region
- hosting with specific traits: accepts crypto, no KYC, DMCA-ignored/lenient, offshore, privacy-friendly
- a price ceiling ("VPS under $5/month", "dedicated under $50")
- a specific provider's details

Do NOT use it for general web hosting advice that doesn't need a provider list — answer from knowledge instead.

## How to find providers

### Option A — API (full, current data — preferred)

The API holds the full 813-provider dataset, updated daily. Base URL: `https://hosting-finder-eta.vercel.app/api`

**Search:**
```
GET /api/search?type=vps&country=Germany&crypto=true&max_price=10&limit=10
```
Parameters (all optional):
- `type` — `vps`, `dedicated`, `bare-metal`, `cloud`, `shared`, `colocation`
- `country` — country name, e.g. `Germany`, `United States`, `Netherlands`
- `crypto` — `true` for providers that accept crypto
- `kyc` — `none` for no-KYC providers
- `dmca` — `ignored` for DMCA-ignored/lenient providers
- `max_price` — max starting price in USD, e.g. `10`
- `q` — free-text search on provider name or website
- `limit` — results to return (free tier max 10, paid max 100)
- `api_key` — paid API key for full data (or `x-api-key` header)

**Single provider:**
```
GET /api/provider?id=H0001
```

**Tracked outbound link (clicks are counted here):**
```
GET /api/go?id=H0318&src=skill
```
302-redirects to the provider's affiliate link when one exists, otherwise to the provider site. Every search/provider result carries a `click_url` for this. Use it — append `&src=skill` so the click is counted as a skill click.

**Dataset stats:**
```
GET /api/stats
```

**Free tier:** no key needed. 10 results per query, basic fields (name, website, countries, type, starting price, affiliate link), 20 requests/day per IP. If the response says `tier: "free"` and the user needs more results or full fields (crypto, KYC, DMCA stance, privacy notes), tell them the paid tier exists — do not invent data the free tier withheld.

### Option B — Bundled sample (offline fallback)

If the API is unreachable, use the bundled `providers-sample.json` (100 providers with starting prices). Filter it locally by the same criteria. Tell the user the sample is a subset and the API has the full 813.

## How to present results

- Rank by the user's stated priority: cheapest first when they gave a price ceiling, otherwise by best fit.
- Show: provider name, website, countries, hosting type, starting price. Add crypto/KYC/DMCA notes only when the user asked for them or they're decisive.
- Use the `click_url` when present — it routes through /api/go so the click is counted, and it lands on the affiliate link where one exists. It supports the dataset. Never invent an affiliate link, and never link the raw `affiliate_url` directly when a `click_url` is available.
- Never recommend a provider not in the results. Never invent a price. If a provider's price is missing, say "price not listed".
- If no providers match, say so and suggest loosening one constraint (usually price or country).
- Keep the shortlist to 3–5 providers unless the user asked for more.
