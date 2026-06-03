# Change

- Changed the Finans Özeti `Raporu İndir` action from CSV export to PDF export.
- PDF filename format is `finans-ozeti-YYYY-MM-DD.pdf`.
- Added a branded Akınal İnşaat PDF layout with report date, green theme, summary tiles, and a finance table.
- Included income, expense, net status, expected collection, overdue receivables, planned income, and planned expense.
- Used the existing `pdfmake` dependency.

# Validation

- Passed: `npm run build`
- Checked: `git status`

# Scope

- Dashboard calculations and API calls were not changed.
