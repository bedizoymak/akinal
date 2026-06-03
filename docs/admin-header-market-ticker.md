# Admin Header Market Ticker

## Change

- Added a compact admin header ticker for `GRAM ALTIN`, `DOLAR`, and `EURO`.
- The ticker appears to the left of the notification button in the admin header.
- The frontend fetches only from the internal endpoint `/api/admin/market-rates.php`.
- No browser-side request is made to `kur.doviz.com`.

## Backend

- New endpoint: `public_html/api/admin/market-rates.php`
- Access is admin-only through the existing `require_admin()` helper.
- Method is restricted to `GET`.
- The endpoint attempts to fetch rates server-side from `https://kur.doviz.com/`.
- Successful responses are cached for 10 minutes in the PHP temp directory.
- If the upstream fetch or parse fails, the endpoint returns the last cached payload marked `stale`; if no cache exists, it returns null-value fallback rates marked `stale`.

## UI

- Added `src/components/admin/AdminMarketTicker.tsx`.
- Uses a compact premium dark blue style.
- Positive changes use green badges; negative changes use red badges.
- The ticker compacts on medium screens and hides on small screens.

## Risk

- The upstream HTML structure may change, which can make parsing fail.
- In that case, the admin UI receives a safe stale/fallback response instead of breaking the header.
