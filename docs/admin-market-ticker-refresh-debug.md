# Fix

- Verified `AdminMarketTicker` schedules visible polling at 5 seconds and hidden polling at 30 seconds.
- Verified market-rates requests include a cache-busting `t=${Date.now()}` timestamp.
- Added `cache: "no-store"` to the frontend market-rates fetch request.
- Verified `market-rates.php` sends `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.
- Added `Expires: 0` to the backend response headers.
- Added a compact visible last-updated timestamp so refreshes are visible even when market values do not change.

# Validation

- `npm run build` passed.
- `php -l public_html/api/admin/market-rates.php` passed.
- `git status` checked after changes.

# Risk

- The timestamp confirms frontend refreshes, but identical market values can still appear unchanged if the upstream HTML snapshot has not changed.
- The data source remains `kur.doviz.com` HTML scraping; no WebSocket source was added.
