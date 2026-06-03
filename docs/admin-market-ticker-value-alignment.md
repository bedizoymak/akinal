# Change

- Updated each market ticker item to use a compact two-column layout.
- Left column contains the label.
- Right column stacks the value and percentage badge so the change aligns under its own number.
- Switched the ticker shell to an Akınal green dominant background with a slightly darker gradient.
- Kept current animations, API, polling, data source, ordering, and badge color behavior unchanged.

# Validation

- Passed: `npm run build`
- Checked: `git status`

# Risk

- Slight header height and spacing changes were made to improve readability while preserving compact placement.
