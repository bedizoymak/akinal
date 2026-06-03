# Fix

- Added adaptive AdminMarketTicker polling: 5 seconds while visible, 30 seconds while hidden.
- Added immediate refresh when the document becomes visible again.
- Added cache-busting timestamp to `/api/admin/market-rates.php` requests.
- Added `Cache-Control: no-store` headers to `market-rates.php`.
- Reduced backend cache TTL to 5 seconds.
- Kept existing stale/fallback behavior and did not add WebSocket support.

# Validation

- `npm run build` passed.
- `php -l public_html/api/admin/market-rates.php` passed.
- `git status` checked before commit.

# Risk

- Visible admin sessions now generate more frequent backend requests.
- Backend still depends on `kur.doviz.com` HTML parsing; stale/fallback remains the safety net.
