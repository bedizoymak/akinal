# Fix

- Reordered admin market ticker data/display to `EURO`, `DOLAR`, `GRAM ALTIN`.
- Added frontend refresh every 15 seconds.
- Reduced backend cache duration from 10 minutes to 15 seconds.
- Kept existing stale/fallback behavior unchanged.
- No layout changes were made beyond the requested ordering/refresh behavior.

# Validation

- `npm run build` passed.
- `php -l public_html/api/admin/market-rates.php` passed.
- `git status` checked before commit.

# Risk

- More frequent refreshes increase backend requests while admins keep the panel open.
- Upstream fetch/parse failures still return stale cache or safe fallback data.
