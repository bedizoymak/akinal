# Change

- Switched `public_html/api/admin/market-rates.php` from `kur.doviz.com` HTML parsing to server-side GenelPara JSON API calls.
- USD/TRY and EUR/TRY source: `https://api.genelpara.com/json/?list=doviz&sembol=USD,EUR`
- Gram Altın source: `https://api.genelpara.com/json/?list=altin&sembol=GA`
- Kept the existing frontend response contract: `rates`, `source`, `stale`, and `fetched_at`.
- Kept the existing 5-second backend cache and stale/fallback behavior.
- No frontend scraping and no UI redesign were added.

# Validation

- `npm run build` passed.
- `php -l public_html/api/admin/market-rates.php` passed.
- `git status` checked before commit.

# Risk

- GenelPara has documented rate limits, so the backend cache remains important.
- `satis` is used as the displayed ticker value; this should be revisited only if the business wants buying prices instead.
- Third-party API availability or response fields may change.
