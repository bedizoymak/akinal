# Current Problem

- Frontend refresh is working, but `kur.doviz.com` HTML scraping often returns the same static page values.
- The current backend source is not the live socket feed, so the ticker can refresh without rate values changing.
- The endpoint contract should stay as `rates`, `source`, `stale`, and `fetched_at`.

# Source Options

- `GenelPara API`: JSON endpoint, no frontend scraping, supports `USD`, `EUR`, and `GA` Gram Altın. Test calls returned current JSON with `alis`, `satis`, `degisim`, `oran`, and remaining quota.
- `Altın API`: Turkey-focused real-time REST/WebSocket product, supports USD/TRY, EUR/TRY, and gold symbols, but requires account/API key and likely paid production usage.
- `TCMB EVDS`: official source for USD/TRY and EUR/TRY, but it is not live market data and does not directly solve live gram altın ticker needs.
- `fxapi.app` plus a metals API: reliable JSON for USD/TRY and EUR/TRY, but gram altın would need a second provider or a derived calculation from XAU/USD and USD/TRY.
- `GoldAPI.io`/Metals APIs: good JSON for gold, but usually global spot prices, API-key based, and not a Turkish gram altın market quote by itself.

# Recommended Source

- Recommended first replacement: `GenelPara API` server-side from `market-rates.php`.
- Use `https://api.genelpara.com/json/?list=doviz&sembol=USD,EUR` for DOLAR/EURO.
- Use `https://api.genelpara.com/json/?list=altin&sembol=GA` for GRAM ALTIN.
- Map `satis` or `alis` consistently into the existing `value`; prefer `satis` for ticker display unless business wants buying price.
- Map `degisim` or `oran` into `change_percent` after confirming which field is percent; current docs label both as response fields.
- Keep the existing server-side cache, stale fallback, and frontend endpoint contract unchanged.

# Risk

- GenelPara has rate limits: documented daily request limit is 1,000 per IP and high-volume IP ban risk above 10,000/day.
- With 5-second polling, backend caching must prevent one upstream request per admin browser.
- Third-party free API terms and availability may change.
- Altın API may be better for production-grade live updates, but introduces account/key management and cost.
