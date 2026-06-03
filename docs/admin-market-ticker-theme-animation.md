# Change

- Updated admin market ticker colors to better match the admin theme.
- Replaced saturated blue styling with charcoal/navy sidebar tones, Akınal green accent, and softer light text.
- Added a subtle value-only flash when a ticker value changes.
- Green flash indicates an increase; red flash indicates a decrease.
- Kept compact header layout, ticker order, API, polling, cache, and data source unchanged.

# Validation

- `npm run build` passed.
- `git status` checked before commit.

# Risk

- Flash animation only triggers when the numeric `value` changes between successful API responses.
- If upstream values remain identical, the ticker will refresh without animation.
