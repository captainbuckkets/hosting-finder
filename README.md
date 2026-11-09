# Hosting Finder

Find the right server hosting provider — VPS, dedicated, bare metal, cloud, shared, or colocation — from a verified dataset of **813 providers across 149 countries**.

## Install the skill

For Claude Code, Cursor, Codex, Copilot, and 18+ agents via Skills.sh:

```text
npx skills add captainbuckkets/hosting-finder
```

## Use the API

Free tier: no key needed, 10 results per query, 20 requests/day per IP. Paid tier (API key): 100 results, all fields, 200/day.

```text
GET https://hosting-finder-eta.vercel.app/api/search?type=vps&country=Germany&max_price=10&limit=10
GET https://hosting-finder-eta.vercel.app/api/provider?id=H0001
GET https://hosting-finder-eta.vercel.app/api/stats
```

## Affiliate disclosure

This service is affiliate-supported: when you buy through a provider link here, we may earn a commission at no extra cost to you. Recommendations are ranked by fit (price, country, type), not by payout.

## Data

Providers are verified against their own websites. The offline sample in `providers-sample.json` contains 100 providers; the live API serves the full dataset.
