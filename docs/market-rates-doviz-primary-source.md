# Change

- Updated `market-rates.php` source priority.
- Primary source is now server-side `kur.doviz.com` scrape.
- Secondary source is GenelPara JSON API.
- Existing stale cache and null fallback remain the final fallback.
- Frontend contract, 5-second backend cache, and no-frontend-scraping behavior were kept.
- No UI changes were made.

# Validation

- `npm run build` passed.
- `php -l public_html/api/admin/market-rates.php` passed.
- `git status` checked before commit.

# Risk

- `kur.doviz.com` HTML structure may change and break primary parsing.
- GenelPara remains available as fallback, but it has request limits.
- Cached stale data may still appear if both upstream sources fail.
