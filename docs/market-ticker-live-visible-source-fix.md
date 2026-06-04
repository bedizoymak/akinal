# Root Cause

- The endpoint could return a short-lived cache before attempting to read GenelPara's visible website ticker.
- Fallback sources could appear fresh even when the visible GenelPara scrape was unavailable.
- Source requests did not include a cache-busting query/header, so upstream or intermediary caches could repeat a stale DOLAR value.

# Changes Made

- GenelPara's visible website values are now fetched before any local cache is used.
- The visible source request includes cache-busting query parameters plus no-cache request headers.
- Cached data is used only after visible scrape failure and is explicitly returned with `stale: true`.
- Doviz/GenelPara API fallback responses are also marked stale when the visible source cannot be read.
- `?debug=1` now reports `source_used`, `fetched_at`, `cache_hit`, raw visible values, and final returned values for each ticker item.

# Validation

- `php -l public_html/api/admin/market-rates.php`
- `npm run build`
