# Root Cause

- The ticker could use JSON/API fields or the Doviz fallback path whose values do not always match GenelPara's public website display.
- GenelPara's visible ticker renders prices in `fiyat` spans and percentage changes in `degisim` spans on `https://www.genelpara.com/`.
- Turkish formatted visible prices such as `6.599,73` required locale-aware normalization before returning the existing numeric API contract.

# Changes Made

- Market rates now try GenelPara's visible website ticker first for EURO, DOLAR, and GRAM ALTIN.
- Price values are read from the visible `fiyat` text.
- Percentage changes are read from the visible `degisim` text and are not manually calculated.
- Existing Doviz/GenelPara JSON fallback behavior remains available if the visible website parse fails.
- `?debug=1` now returns per-item source, raw price, raw percent, normalized price, and normalized percent details.

# Validation

- `php -l public_html/api/admin/market-rates.php`
- `npm run build`
- `git status`
