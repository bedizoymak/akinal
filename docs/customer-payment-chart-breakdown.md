# Customer Payment Chart Breakdown

# Change
- Updated the customer detail payment chart to show a combined official and unofficial finance breakdown.
- Chart segments now use separate Turkish labels:
  - Resmi ödenen
  - Gayri resmi ödenen
  - Resmi kalan
  - Gayri resmi kalan
  - Geciken ödeme
- Percentages are calculated against `total paid + total remaining`.
- Overdue balance is shown as a separate red segment and is not double-counted in remaining segments.
- Added callout labels with leader lines showing amount and percentage.

# Validation
- `npm run build`
- `php -l public_html/api/admin/customers.php`

# Risk
- Low. The change is limited to customer detail chart presentation and uses already-loaded customer finance data.
