-- Canonical cashflow classifier query library.
-- Every labeled statement is read-only and returns source data for offline classification.

-- name: payments
SELECT *
FROM ak_payments
ORDER BY payment_date, id;

-- name: expenses
SELECT *
FROM ak_expenses
ORDER BY expense_date, id;

-- name: plans
SELECT *
FROM ak_payment_plans
ORDER BY due_date, id;

-- name: entries
SELECT *
FROM ak_financial_entries
ORDER BY entry_date, id;

-- name: settlements
SELECT *
FROM ak_payment_plan_settlements
ORDER BY created_at, id;

-- name: customers
SELECT id
FROM ak_customers
ORDER BY id;

-- name: employees
SELECT id
FROM ak_employees
ORDER BY id;

-- name: expense_cards
SELECT id
FROM ak_expense_cards
ORDER BY id;

-- name: projects
SELECT id
FROM ak_projects
ORDER BY id;
