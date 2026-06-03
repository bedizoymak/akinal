# Finding

- `AdminMarketTicker` currently calls `getAdminMarketRates()` once on mount, then repeats with `window.setInterval(loadRates, 15000)`.
- The frontend does update state when a new API response arrives, but it has no WebSocket/SSE live feed.
- `market-rates.php` uses a server temp-file cache named `akinal_market_rates_cache.json`.
- The backend cache TTL is currently 15 seconds.

# Current Data Source

- Frontend source: internal `/api/admin/market-rates.php` only.
- Backend source: server-side HTML fetch from `https://kur.doviz.com/`.
- Parsed backend symbols are `EURO`, `DOLAR`, and `GRAM ALTIN`.
- Fallback behavior returns cached data marked `stale`, or null-value fallback rates marked `stale`.

# Why It Does Not Update Live

- The app is polling a scraped HTML snapshot, not subscribing to the live Doviz feed.
- A browser refresh feels newer because it restarts the fetch cycle and may bypass perceived stale UI state.
- With 15-second frontend polling plus 15-second backend cache, users can still see up to roughly one polling/cache window of latency.
- If `kur.doviz.com` HTML values are themselves not changing as fast as the socket values, repeated polling can return identical numbers.

# Doviz.com Live Mechanism

- `kur.doviz.com` includes `wss://socket.doviz.com` in page source.
- Its script uses a custom `DovizWebSocket` with subprotocol `nokta-chat-json`.
- The room format appears to be `info@EUR,USD,gram-altin`.
- The page uses `data-socket-key` values such as `EUR`, `USD`, and `gram-altin`.
- A quick server-side Node probe could open/wait, but did not receive a sample market message within 20 seconds, so feasibility is not fully confirmed yet.

# Recommended Fix

- Preferred: implement a backend-only WebSocket bridge/proxy after validating the Doviz socket message protocol and terms; keep the browser connected only to our own backend.
- Do not connect the admin frontend directly to `socket.doviz.com`; that exposes third-party dependency/protocol details and may create CORS, policy, or reliability risk.
- If WebSocket is not reliable, use adaptive polling: 5 seconds while tab is visible, 15-30 seconds when hidden, with request cache-busting.
- Add `Cache-Control: no-store` or a timestamp query to `/api/admin/market-rates.php` requests if browser/proxy caching is suspected.
- Keep stale/fallback handling for all strategies.

# Risk

- Doviz socket protocol is undocumented and may change without notice.
- Direct frontend WebSocket use could violate source expectations or leak implementation details.
- Very short polling increases upstream load and can still miss true tick-level changes.
- Backend socket proxy is safest but needs a long-running process; plain PHP request handlers are not ideal for persistent WebSocket connections.
