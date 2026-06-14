-- Phase 3A read-only reconciliation inventory
-- Target: current Akinal Insaat MySQL schema before canonical migration.
-- Run each numbered result set separately if the client does not support multiple results.
-- All monetary totals remain in stored currency. Legacy payments and expenses are implicitly TRY.

-- A01. Core finance row counts.
SELECT 'ak_payment_plans' AS record_set, COUNT(*) AS row_count
FROM ak_payment_plans
UNION ALL
SELECT 'ak_payments', COUNT(*)
FROM ak_payments
UNION ALL
SELECT 'ak_expenses', COUNT(*)
FROM ak_expenses
UNION ALL
SELECT 'ak_financial_entries', COUNT(*)
FROM ak_financial_entries
ORDER BY record_set;

-- A02. Payment plans by inferred owner type.
SELECT
  CASE
    WHEN customer_id IS NOT NULL AND employee_id IS NULL AND expense_card_id IS NULL THEN 'customer'
    WHEN customer_id IS NULL AND employee_id IS NOT NULL AND expense_card_id IS NULL THEN 'employee'
    WHEN customer_id IS NULL AND employee_id IS NULL AND expense_card_id IS NOT NULL THEN 'expense_card'
    WHEN customer_id IS NULL AND employee_id IS NULL AND expense_card_id IS NULL THEN 'missing_owner'
    ELSE 'multiple_owners'
  END AS owner_type,
  COUNT(*) AS row_count,
  SUM(amount) AS amount_total,
  SUM(paid_amount) AS manual_paid_total
FROM ak_payment_plans
GROUP BY owner_type
ORDER BY owner_type;

-- A03. Payment plans by current status.
SELECT status, COUNT(*) AS row_count, SUM(amount) AS amount_total, SUM(paid_amount) AS manual_paid_total
FROM ak_payment_plans
GROUP BY status
ORDER BY status;

-- A04. Ledger entries by direction, status, account group, and currency.
SELECT direction, status, group_tag, currency_tag, COUNT(*) AS row_count, SUM(amount) AS amount_total
FROM ak_financial_entries
GROUP BY direction, status, group_tag, currency_tag
ORDER BY direction, status, group_tag, currency_tag;

-- A05. Finance records by project linkage.
SELECT 'payment_plan' AS record_type,
       CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END AS project_linkage,
       COUNT(*) AS row_count,
       SUM(amount) AS amount_total
FROM ak_payment_plans
GROUP BY project_linkage
UNION ALL
SELECT 'payment',
       CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END,
       COUNT(*),
       SUM(amount)
FROM ak_payments
GROUP BY CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END
UNION ALL
SELECT 'expense',
       CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END,
       COUNT(*),
       SUM(amount)
FROM ak_expenses
GROUP BY CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END
UNION ALL
SELECT 'financial_entry',
       CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END,
       COUNT(*),
       SUM(amount)
FROM ak_financial_entries
GROUP BY CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END
ORDER BY record_type, project_linkage;

-- B01. Probable duplicate customer collections between legacy payments and realized ledger income.
-- A row is only a candidate because the current schema has no shared source identity.
SELECT
  p.id AS payment_id,
  fe.id AS financial_entry_id,
  p.customer_id,
  p.project_id AS payment_project_id,
  fe.project_id AS entry_project_id,
  p.amount,
  p.payment_date,
  fe.entry_date,
  p.account_type,
  fe.group_tag,
  fe.title,
  fe.description
FROM ak_payments p
JOIN ak_financial_entries fe
  ON fe.customer_id = p.customer_id
 AND fe.card_type = 'customer'
 AND fe.direction = 'Gelir'
 AND fe.status = 'Gerçekleşti'
 AND fe.currency_tag = 'TRY'
 AND fe.amount = p.amount
 AND ABS(DATEDIFF(fe.entry_date, p.payment_date)) <= 1
 AND COALESCE(fe.project_id, '') = COALESCE(p.project_id, '')
 AND fe.group_tag = CASE
   WHEN p.account_type = 'gayri_resmi' THEN 'Gayri Resmi'
   ELSE 'Resmi'
 END
ORDER BY p.payment_date, p.id, fe.id;

-- B02. Legacy payments having more than one probable ledger match.
SELECT
  p.id AS payment_id,
  COUNT(fe.id) AS probable_match_count,
  p.customer_id,
  p.project_id,
  p.amount,
  p.payment_date,
  p.account_type
FROM ak_payments p
JOIN ak_financial_entries fe
  ON fe.customer_id = p.customer_id
 AND fe.card_type = 'customer'
 AND fe.direction = 'Gelir'
 AND fe.status = 'Gerçekleşti'
 AND fe.currency_tag = 'TRY'
 AND fe.amount = p.amount
 AND ABS(DATEDIFF(fe.entry_date, p.payment_date)) <= 1
 AND COALESCE(fe.project_id, '') = COALESCE(p.project_id, '')
 AND fe.group_tag = CASE
   WHEN p.account_type = 'gayri_resmi' THEN 'Gayri Resmi'
   ELSE 'Resmi'
 END
GROUP BY p.id, p.customer_id, p.project_id, p.amount, p.payment_date, p.account_type
HAVING COUNT(fe.id) > 1
ORDER BY probable_match_count DESC, p.payment_date, p.id;

-- B03. Probable duplicate general expenses between legacy expenses and realized ledger expense.
SELECT
  e.id AS expense_id,
  fe.id AS financial_entry_id,
  e.project_id AS expense_project_id,
  fe.project_id AS entry_project_id,
  e.customer_id AS expense_customer_id,
  fe.customer_id AS entry_customer_id,
  e.amount,
  e.expense_date,
  fe.entry_date,
  e.title AS expense_title,
  fe.title AS entry_title
FROM ak_expenses e
JOIN ak_financial_entries fe
  ON fe.direction = 'Gider'
 AND fe.status = 'Gerçekleşti'
 AND fe.currency_tag = 'TRY'
 AND fe.group_tag = 'Resmi'
 AND fe.amount = e.amount
 AND ABS(DATEDIFF(fe.entry_date, e.expense_date)) <= 1
 AND COALESCE(fe.project_id, '') = COALESCE(e.project_id, '')
 AND LOWER(TRIM(fe.title)) = LOWER(TRIM(e.title))
ORDER BY e.expense_date, e.id, fe.id;

-- B04. Legacy expenses having more than one probable ledger match.
SELECT
  e.id AS expense_id,
  COUNT(fe.id) AS probable_match_count,
  e.project_id,
  e.customer_id,
  e.amount,
  e.expense_date,
  e.title
FROM ak_expenses e
JOIN ak_financial_entries fe
  ON fe.direction = 'Gider'
 AND fe.status = 'Gerçekleşti'
 AND fe.currency_tag = 'TRY'
 AND fe.group_tag = 'Resmi'
 AND fe.amount = e.amount
 AND ABS(DATEDIFF(fe.entry_date, e.expense_date)) <= 1
 AND COALESCE(fe.project_id, '') = COALESCE(e.project_id, '')
 AND LOWER(TRIM(fe.title)) = LOWER(TRIM(e.title))
GROUP BY e.id, e.project_id, e.customer_id, e.amount, e.expense_date, e.title
HAVING COUNT(fe.id) > 1
ORDER BY probable_match_count DESC, e.expense_date, e.id;

-- B05. Probable duplicate planned obligations between plans and planned ledger entries.
SELECT
  pp.id AS payment_plan_id,
  fe.id AS financial_entry_id,
  CASE
    WHEN pp.customer_id IS NOT NULL THEN 'customer'
    WHEN pp.employee_id IS NOT NULL THEN 'employee'
    WHEN pp.expense_card_id IS NOT NULL THEN 'expense_card'
    ELSE 'unknown'
  END AS owner_type,
  pp.amount,
  pp.due_date,
  fe.entry_date,
  pp.project_id AS plan_project_id,
  fe.project_id AS entry_project_id,
  pp.account_type,
  fe.group_tag,
  pp.title AS plan_title,
  fe.title AS entry_title
FROM ak_payment_plans pp
JOIN ak_financial_entries fe
  ON fe.status = 'Planlandı'
 AND fe.amount = pp.amount
 AND fe.entry_date = pp.due_date
 AND COALESCE(fe.project_id, '') = COALESCE(pp.project_id, '')
 AND fe.group_tag = CASE
   WHEN pp.account_type = 'gayri_resmi' THEN 'Gayri Resmi'
   ELSE 'Resmi'
 END
 AND (
      (pp.customer_id IS NOT NULL AND fe.card_type = 'customer' AND fe.customer_id = pp.customer_id AND fe.direction = 'Gelir')
   OR (pp.employee_id IS NOT NULL AND fe.card_type = 'employee' AND fe.employee_id = pp.employee_id AND fe.direction = 'Gider')
   OR (pp.expense_card_id IS NOT NULL AND fe.card_type = 'expense' AND fe.expense_card_id = pp.expense_card_id AND fe.direction = 'Gider')
 )
ORDER BY pp.due_date, pp.id, fe.id;

-- C01. Active payment plans without project linkage.
SELECT id, customer_id, employee_id, expense_card_id, title, amount, paid_amount, due_date, status, account_type
FROM ak_payment_plans
WHERE project_id IS NULL
  AND status <> 'İptal'
ORDER BY due_date, id;

-- C02. Payments without project linkage.
SELECT id, customer_id, payment_plan_id, amount, payment_date, account_type, payment_method
FROM ak_payments
WHERE project_id IS NULL
ORDER BY payment_date, id;

-- C03. Expenses without project linkage.
SELECT id, customer_id, title, category, amount, expense_date
FROM ak_expenses
WHERE project_id IS NULL
ORDER BY expense_date, id;

-- C04. Ledger entries without project linkage.
SELECT id, card_type, customer_id, employee_id, expense_card_id, title, amount, currency_tag,
       group_tag, direction, status, entry_date
FROM ak_financial_entries
WHERE project_id IS NULL
ORDER BY entry_date, id;

-- C05. Payments whose explicitly linked plan has a different project.
SELECT
  p.id AS payment_id,
  p.payment_plan_id,
  p.customer_id,
  pp.customer_id AS plan_customer_id,
  p.project_id AS payment_project_id,
  pp.project_id AS plan_project_id,
  p.account_type AS payment_account_type,
  pp.account_type AS plan_account_type,
  p.amount,
  p.payment_date
FROM ak_payments p
JOIN ak_payment_plans pp ON pp.id = p.payment_plan_id
WHERE COALESCE(p.project_id, '') <> COALESCE(pp.project_id, '')
ORDER BY p.payment_date, p.id;

-- C06. Customer-owned ledger entries missing project where the customer has project relationships.
SELECT
  fe.id AS financial_entry_id,
  fe.customer_id,
  COUNT(DISTINCT cp.project_id) AS customer_project_count,
  fe.title,
  fe.amount,
  fe.currency_tag,
  fe.direction,
  fe.status,
  fe.entry_date
FROM ak_financial_entries fe
JOIN ak_customer_projects cp ON cp.customer_id = fe.customer_id
WHERE fe.card_type = 'customer'
  AND fe.project_id IS NULL
GROUP BY fe.id, fe.customer_id, fe.title, fe.amount, fe.currency_tag, fe.direction, fe.status, fe.entry_date
ORDER BY customer_project_count, fe.entry_date, fe.id;

-- C07. Customer payments missing project where the customer has project relationships.
SELECT
  p.id AS payment_id,
  p.customer_id,
  COUNT(DISTINCT cp.project_id) AS customer_project_count,
  p.payment_plan_id,
  p.amount,
  p.payment_date,
  p.account_type
FROM ak_payments p
JOIN ak_customer_projects cp ON cp.customer_id = p.customer_id
WHERE p.project_id IS NULL
GROUP BY p.id, p.customer_id, p.payment_plan_id, p.amount, p.payment_date, p.account_type
ORDER BY customer_project_count, p.payment_date, p.id;

-- D01. Payment plans without exactly one owner.
SELECT
  id,
  customer_id,
  employee_id,
  expense_card_id,
  project_id,
  title,
  amount,
  due_date,
  status,
  (customer_id IS NOT NULL) + (employee_id IS NOT NULL) + (expense_card_id IS NOT NULL) AS owner_count
FROM ak_payment_plans
WHERE (customer_id IS NOT NULL) + (employee_id IS NOT NULL) + (expense_card_id IS NOT NULL) <> 1
ORDER BY id;

-- D02. Ledger entries whose card type does not have exactly the expected owner.
SELECT
  id,
  card_type,
  customer_id,
  employee_id,
  expense_card_id,
  project_id,
  title,
  amount,
  direction,
  status,
  entry_date
FROM ak_financial_entries
WHERE card_type NOT IN ('customer', 'employee', 'expense')
   OR (card_type = 'customer' AND NOT (
        customer_id IS NOT NULL AND employee_id IS NULL AND expense_card_id IS NULL
      ))
   OR (card_type = 'employee' AND NOT (
        customer_id IS NULL AND employee_id IS NOT NULL AND expense_card_id IS NULL
      ))
   OR (card_type = 'expense' AND NOT (
        customer_id IS NULL AND employee_id IS NULL AND expense_card_id IS NOT NULL
      ))
ORDER BY entry_date, id;

-- D03. Orphan references across current finance tables.
SELECT 'payment_plan_customer' AS anomaly_type, pp.id AS record_id, pp.customer_id AS missing_reference
FROM ak_payment_plans pp
LEFT JOIN ak_customers c ON c.id = pp.customer_id
WHERE pp.customer_id IS NOT NULL AND c.id IS NULL
UNION ALL
SELECT 'payment_plan_employee', pp.id, pp.employee_id
FROM ak_payment_plans pp
LEFT JOIN ak_employees em ON em.id = pp.employee_id
WHERE pp.employee_id IS NOT NULL AND em.id IS NULL
UNION ALL
SELECT 'payment_plan_expense_card', pp.id, pp.expense_card_id
FROM ak_payment_plans pp
LEFT JOIN ak_expense_cards ec ON ec.id = pp.expense_card_id
WHERE pp.expense_card_id IS NOT NULL AND ec.id IS NULL
UNION ALL
SELECT 'payment_plan_project', pp.id, pp.project_id
FROM ak_payment_plans pp
LEFT JOIN ak_projects pr ON pr.id = pp.project_id
WHERE pp.project_id IS NOT NULL AND pr.id IS NULL
UNION ALL
SELECT 'payment_customer', p.id, p.customer_id
FROM ak_payments p
LEFT JOIN ak_customers c ON c.id = p.customer_id
WHERE p.customer_id IS NOT NULL AND c.id IS NULL
UNION ALL
SELECT 'payment_plan_reference', p.id, p.payment_plan_id
FROM ak_payments p
LEFT JOIN ak_payment_plans pp ON pp.id = p.payment_plan_id
WHERE p.payment_plan_id IS NOT NULL AND pp.id IS NULL
UNION ALL
SELECT 'payment_project', p.id, p.project_id
FROM ak_payments p
LEFT JOIN ak_projects pr ON pr.id = p.project_id
WHERE p.project_id IS NOT NULL AND pr.id IS NULL
UNION ALL
SELECT 'expense_customer', e.id, e.customer_id
FROM ak_expenses e
LEFT JOIN ak_customers c ON c.id = e.customer_id
WHERE e.customer_id IS NOT NULL AND c.id IS NULL
UNION ALL
SELECT 'expense_project', e.id, e.project_id
FROM ak_expenses e
LEFT JOIN ak_projects pr ON pr.id = e.project_id
WHERE e.project_id IS NOT NULL AND pr.id IS NULL
UNION ALL
SELECT 'entry_customer', fe.id, fe.customer_id
FROM ak_financial_entries fe
LEFT JOIN ak_customers c ON c.id = fe.customer_id
WHERE fe.customer_id IS NOT NULL AND c.id IS NULL
UNION ALL
SELECT 'entry_employee', fe.id, fe.employee_id
FROM ak_financial_entries fe
LEFT JOIN ak_employees em ON em.id = fe.employee_id
WHERE fe.employee_id IS NOT NULL AND em.id IS NULL
UNION ALL
SELECT 'entry_expense_card', fe.id, fe.expense_card_id
FROM ak_financial_entries fe
LEFT JOIN ak_expense_cards ec ON ec.id = fe.expense_card_id
WHERE fe.expense_card_id IS NOT NULL AND ec.id IS NULL
UNION ALL
SELECT 'entry_project', fe.id, fe.project_id
FROM ak_financial_entries fe
LEFT JOIN ak_projects pr ON pr.id = fe.project_id
WHERE fe.project_id IS NOT NULL AND pr.id IS NULL
ORDER BY anomaly_type, record_id;

-- E01. Invalid account type on plans and payments, or invalid ledger account group.
SELECT 'payment_plan' AS record_type, id AS record_id, account_type AS stored_value
FROM ak_payment_plans
WHERE account_type IS NULL OR account_type NOT IN ('resmi', 'gayri_resmi')
UNION ALL
SELECT 'payment', id, account_type
FROM ak_payments
WHERE account_type IS NULL OR account_type NOT IN ('resmi', 'gayri_resmi')
UNION ALL
SELECT 'financial_entry', id, group_tag
FROM ak_financial_entries
WHERE group_tag IS NULL OR group_tag NOT IN ('Resmi', 'Gayri Resmi')
ORDER BY record_type, record_id;

-- E02. Legacy expense rows subject to the current forced Resmi assumption.
SELECT
  COUNT(*) AS legacy_expense_count,
  SUM(amount) AS assumed_resmi_try_amount,
  SUM(CASE WHEN project_id IS NULL THEN 1 ELSE 0 END) AS unlinked_project_count,
  SUM(CASE WHEN customer_id IS NULL THEN 1 ELSE 0 END) AS unlinked_customer_count
FROM ak_expenses;

-- E03. Explicit payment-to-plan account mismatch.
SELECT
  p.id AS payment_id,
  p.payment_plan_id,
  p.account_type AS payment_account_type,
  pp.account_type AS plan_account_type,
  p.amount,
  p.payment_date
FROM ak_payments p
JOIN ak_payment_plans pp ON pp.id = p.payment_plan_id
WHERE COALESCE(p.account_type, '') <> COALESCE(pp.account_type, '')
ORDER BY p.payment_date, p.id;

-- F01. Null or unsupported ledger currency.
SELECT id, card_type, project_id, title, amount, currency_tag, direction, status, entry_date
FROM ak_financial_entries
WHERE currency_tag IS NULL OR currency_tag NOT IN ('TRY', 'USD', 'EUR')
ORDER BY entry_date, id;

-- F02. Projects containing more than one ledger currency.
SELECT
  project_id,
  COUNT(DISTINCT currency_tag) AS currency_count,
  GROUP_CONCAT(DISTINCT currency_tag ORDER BY currency_tag SEPARATOR ', ') AS currencies,
  COUNT(*) AS row_count
FROM ak_financial_entries
WHERE project_id IS NOT NULL
  AND currency_tag IS NOT NULL
GROUP BY project_id
HAVING COUNT(DISTINCT currency_tag) > 1
ORDER BY currency_count DESC, project_id;

-- F03. Owners containing more than one ledger currency.
SELECT
  card_type,
  CASE
    WHEN card_type = 'customer' THEN customer_id
    WHEN card_type = 'employee' THEN employee_id
    WHEN card_type = 'expense' THEN expense_card_id
    ELSE NULL
  END AS owner_id,
  COUNT(DISTINCT currency_tag) AS currency_count,
  GROUP_CONCAT(DISTINCT currency_tag ORDER BY currency_tag SEPARATOR ', ') AS currencies,
  COUNT(*) AS row_count
FROM ak_financial_entries
WHERE currency_tag IS NOT NULL
GROUP BY card_type, owner_id
HAVING owner_id IS NOT NULL AND COUNT(DISTINCT currency_tag) > 1
ORDER BY currency_count DESC, card_type, owner_id;

-- G01. Plans containing manual paid amount.
SELECT id, customer_id, employee_id, expense_card_id, project_id, title, amount, paid_amount,
       due_date, status, account_type, payment_method
FROM ak_payment_plans
WHERE paid_amount > 0
ORDER BY due_date, id;

-- G02. Plans marked paid with no explicitly linked legacy customer payment.
-- Employee and expense-card plans always appear because no settlement link exists in the current schema.
SELECT
  pp.id,
  pp.customer_id,
  pp.employee_id,
  pp.expense_card_id,
  pp.project_id,
  pp.title,
  pp.amount,
  pp.paid_amount,
  pp.due_date,
  pp.status,
  COUNT(p.id) AS explicitly_linked_payment_count,
  COALESCE(SUM(p.amount), 0) AS explicitly_linked_payment_total
FROM ak_payment_plans pp
LEFT JOIN ak_payments p ON p.payment_plan_id = pp.id
WHERE pp.status = 'Ödendi'
GROUP BY pp.id, pp.customer_id, pp.employee_id, pp.expense_card_id, pp.project_id,
         pp.title, pp.amount, pp.paid_amount, pp.due_date, pp.status
HAVING COUNT(p.id) = 0
ORDER BY pp.due_date, pp.id;

-- G03. Past-due partial plans with remaining manual amount.
SELECT id, customer_id, employee_id, expense_card_id, project_id, title, amount, paid_amount,
       amount - LEAST(amount, GREATEST(0, paid_amount)) AS manual_remaining_amount,
       due_date, status, account_type
FROM ak_payment_plans
WHERE due_date < CURDATE()
  AND status = 'Kısmi Ödendi'
  AND amount - LEAST(amount, GREATEST(0, paid_amount)) > 0
ORDER BY due_date, id;

-- G04. Manually paid personnel/supplier plans with no probable realized ledger payment.
SELECT
  pp.id AS payment_plan_id,
  CASE WHEN pp.employee_id IS NOT NULL THEN 'employee' ELSE 'expense_card' END AS owner_type,
  COALESCE(pp.employee_id, pp.expense_card_id) AS owner_id,
  pp.project_id,
  pp.title,
  pp.amount,
  pp.paid_amount,
  pp.due_date,
  pp.status,
  COUNT(fe.id) AS probable_realized_entry_count
FROM ak_payment_plans pp
LEFT JOIN ak_financial_entries fe
  ON fe.status = 'Gerçekleşti'
 AND fe.direction = 'Gider'
 AND fe.amount = pp.amount
 AND fe.entry_date <= pp.due_date
 AND fe.entry_date >= DATE_SUB(pp.due_date, INTERVAL 30 DAY)
 AND COALESCE(fe.project_id, '') = COALESCE(pp.project_id, '')
 AND fe.group_tag = CASE
   WHEN pp.account_type = 'gayri_resmi' THEN 'Gayri Resmi'
   ELSE 'Resmi'
 END
 AND (
      (pp.employee_id IS NOT NULL AND fe.card_type = 'employee' AND fe.employee_id = pp.employee_id)
   OR (pp.expense_card_id IS NOT NULL AND fe.card_type = 'expense' AND fe.expense_card_id = pp.expense_card_id)
 )
WHERE (pp.employee_id IS NOT NULL OR pp.expense_card_id IS NOT NULL)
  AND (pp.status = 'Ödendi' OR pp.paid_amount > 0)
GROUP BY pp.id, pp.employee_id, pp.expense_card_id, pp.project_id, pp.title,
         pp.amount, pp.paid_amount, pp.due_date, pp.status
HAVING COUNT(fe.id) = 0
ORDER BY pp.due_date, pp.id;

-- H01. Cheque and promissory-note maturity inventory by maturity state.
SELECT
  payment_method,
  CASE
    WHEN payment_method = 'Çek' AND cheque_maturity_date IS NULL THEN 'missing_maturity'
    WHEN payment_method = 'Senet' AND promissory_maturity_date IS NULL THEN 'missing_maturity'
    WHEN payment_method = 'Çek' AND cheque_maturity_date > CURDATE() THEN 'not_matured'
    WHEN payment_method = 'Senet' AND promissory_maturity_date > CURDATE() THEN 'not_matured'
    WHEN status = 'Ödendi' OR paid_amount >= amount THEN 'matured_marked_paid'
    ELSE 'matured_not_settled'
  END AS maturity_state,
  COUNT(*) AS row_count,
  SUM(amount) AS amount_total,
  SUM(paid_amount) AS manual_paid_total
FROM ak_payment_plans
WHERE payment_method IN ('Çek', 'Senet')
GROUP BY payment_method, maturity_state
ORDER BY payment_method, maturity_state;

-- H02. Cheque/senet records with payment-method and maturity-field mismatch.
SELECT id, payment_method, cheque_maturity_date, cheque_no, bank_name,
       promissory_maturity_date, amount, paid_amount, due_date, status
FROM ak_payment_plans
WHERE (payment_method = 'Çek' AND cheque_maturity_date IS NULL)
   OR (payment_method = 'Senet' AND promissory_maturity_date IS NULL)
   OR (payment_method <> 'Çek' AND (
        cheque_maturity_date IS NOT NULL OR cheque_no IS NOT NULL OR bank_name IS NOT NULL
      ))
   OR (payment_method <> 'Senet' AND promissory_maturity_date IS NOT NULL)
ORDER BY due_date, id;

-- H03. Matured cheque/senet plans manually marked paid without explicit customer payment.
SELECT
  pp.id,
  pp.customer_id,
  pp.employee_id,
  pp.expense_card_id,
  pp.project_id,
  pp.payment_method,
  pp.amount,
  pp.paid_amount,
  pp.status,
  pp.cheque_maturity_date,
  pp.promissory_maturity_date,
  COUNT(p.id) AS explicitly_linked_payment_count
FROM ak_payment_plans pp
LEFT JOIN ak_payments p ON p.payment_plan_id = pp.id
WHERE pp.payment_method IN ('Çek', 'Senet')
  AND (
       (pp.payment_method = 'Çek' AND pp.cheque_maturity_date <= CURDATE())
    OR (pp.payment_method = 'Senet' AND pp.promissory_maturity_date <= CURDATE())
  )
  AND (pp.status = 'Ödendi' OR pp.paid_amount > 0)
GROUP BY pp.id, pp.customer_id, pp.employee_id, pp.expense_card_id, pp.project_id,
         pp.payment_method, pp.amount, pp.paid_amount, pp.status,
         pp.cheque_maturity_date, pp.promissory_maturity_date
HAVING COUNT(p.id) = 0
ORDER BY pp.due_date, pp.id;

-- I01. Project-linked and unlinked realized cash candidates by source and direction.
SELECT 'legacy_payment' AS source_type, 'income' AS cash_direction,
       CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END AS project_linkage,
       'TRY' AS currency, COUNT(*) AS row_count, SUM(amount) AS amount_total
FROM ak_payments
GROUP BY project_linkage
UNION ALL
SELECT 'legacy_expense', 'expense',
       CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END,
       'TRY', COUNT(*), SUM(amount)
FROM ak_expenses
GROUP BY CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END
UNION ALL
SELECT 'financial_entry',
       CASE WHEN direction = 'Gelir' THEN 'income' ELSE 'expense' END,
       CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END,
       currency_tag, COUNT(*), SUM(amount)
FROM ak_financial_entries
WHERE status = 'Gerçekleşti'
  AND direction IN ('Gelir', 'Gider')
GROUP BY direction, CASE WHEN project_id IS NULL THEN 'unlinked' ELSE 'linked' END, currency_tag
ORDER BY source_type, cash_direction, project_linkage, currency;

-- I02. Per-project realized inventory without cross-source deduplication.
SELECT
  project_id,
  source_type,
  cash_direction,
  currency,
  COUNT(*) AS row_count,
  SUM(amount) AS amount_total
FROM (
  SELECT project_id, 'legacy_payment' AS source_type, 'income' AS cash_direction,
         'TRY' AS currency, amount
  FROM ak_payments
  WHERE project_id IS NOT NULL
  UNION ALL
  SELECT project_id, 'legacy_expense', 'expense', 'TRY', amount
  FROM ak_expenses
  WHERE project_id IS NOT NULL
  UNION ALL
  SELECT project_id, 'financial_entry',
         CASE WHEN direction = 'Gelir' THEN 'income' ELSE 'expense' END,
         currency_tag, amount
  FROM ak_financial_entries
  WHERE project_id IS NOT NULL
    AND status = 'Gerçekleşti'
    AND direction IN ('Gelir', 'Gider')
) inventory
GROUP BY project_id, source_type, cash_direction, currency
ORDER BY project_id, source_type, cash_direction, currency;

-- I03. Customer project plans with no realized payment carrying the same project.
SELECT
  pp.id AS payment_plan_id,
  pp.customer_id,
  pp.project_id,
  pp.title,
  pp.amount,
  pp.paid_amount,
  pp.due_date,
  pp.status,
  COUNT(p.id) AS same_project_payment_count,
  COALESCE(SUM(p.amount), 0) AS same_project_payment_total
FROM ak_payment_plans pp
LEFT JOIN ak_payments p
  ON p.customer_id = pp.customer_id
 AND p.project_id = pp.project_id
 AND p.account_type = pp.account_type
WHERE pp.customer_id IS NOT NULL
  AND pp.project_id IS NOT NULL
GROUP BY pp.id, pp.customer_id, pp.project_id, pp.title, pp.amount,
         pp.paid_amount, pp.due_date, pp.status
HAVING COUNT(p.id) = 0
ORDER BY pp.due_date, pp.id;

-- I04. Legacy expense rows that are company-overhead candidates because no project is linked.
SELECT id, customer_id, title, category, amount, expense_date, description
FROM ak_expenses
WHERE project_id IS NULL
ORDER BY expense_date, id;

-- I05. Ledger expense rows that are company-overhead candidates because no project is linked.
SELECT id, card_type, customer_id, employee_id, expense_card_id, title, amount,
       currency_tag, group_tag, status, entry_date, description
FROM ak_financial_entries
WHERE project_id IS NULL
  AND direction = 'Gider'
ORDER BY entry_date, id;

-- J01. Finance records already detached from owner or project context.
SELECT 'payment_plan' AS record_type, id AS record_id,
       customer_id, employee_id, expense_card_id, project_id, amount,
       due_date AS record_date
FROM ak_payment_plans
WHERE customer_id IS NULL
  AND employee_id IS NULL
  AND expense_card_id IS NULL
UNION ALL
SELECT 'payment', id, customer_id, NULL, NULL, project_id, amount, payment_date
FROM ak_payments
WHERE customer_id IS NULL OR project_id IS NULL
UNION ALL
SELECT 'expense', id, customer_id, NULL, NULL, project_id, amount, expense_date
FROM ak_expenses
WHERE customer_id IS NULL OR project_id IS NULL
UNION ALL
SELECT 'financial_entry', id, customer_id, employee_id, expense_card_id, project_id, amount, entry_date
FROM ak_financial_entries
WHERE project_id IS NULL
   OR (customer_id IS NULL AND employee_id IS NULL AND expense_card_id IS NULL)
ORDER BY record_type, record_date, record_id;

-- J02. Customer masters with finance history that require archive protection.
SELECT
  c.id,
  c.full_name,
  c.company_name,
  c.status,
  COUNT(DISTINCT pp.id) AS plan_count,
  COUNT(DISTINCT p.id) AS payment_count,
  COUNT(DISTINCT e.id) AS expense_count,
  COUNT(DISTINCT fe.id) AS ledger_entry_count
FROM ak_customers c
LEFT JOIN ak_payment_plans pp ON pp.customer_id = c.id
LEFT JOIN ak_payments p ON p.customer_id = c.id
LEFT JOIN ak_expenses e ON e.customer_id = c.id
LEFT JOIN ak_financial_entries fe ON fe.customer_id = c.id
GROUP BY c.id, c.full_name, c.company_name, c.status
HAVING COUNT(DISTINCT pp.id) > 0
    OR COUNT(DISTINCT p.id) > 0
    OR COUNT(DISTINCT e.id) > 0
    OR COUNT(DISTINCT fe.id) > 0
ORDER BY c.id;

-- J03. Employee masters with finance history that require archive protection.
SELECT
  em.id,
  em.full_name,
  em.status,
  COUNT(DISTINCT pp.id) AS plan_count,
  COUNT(DISTINCT fe.id) AS ledger_entry_count
FROM ak_employees em
LEFT JOIN ak_payment_plans pp ON pp.employee_id = em.id
LEFT JOIN ak_financial_entries fe ON fe.employee_id = em.id
GROUP BY em.id, em.full_name, em.status
HAVING COUNT(DISTINCT pp.id) > 0 OR COUNT(DISTINCT fe.id) > 0
ORDER BY em.id;

-- J04. Expense-card masters with finance history that require archive protection.
SELECT
  ec.id,
  ec.name,
  ec.category,
  ec.status,
  COUNT(DISTINCT pp.id) AS plan_count,
  COUNT(DISTINCT fe.id) AS ledger_entry_count
FROM ak_expense_cards ec
LEFT JOIN ak_payment_plans pp ON pp.expense_card_id = ec.id
LEFT JOIN ak_financial_entries fe ON fe.expense_card_id = ec.id
GROUP BY ec.id, ec.name, ec.category, ec.status
HAVING COUNT(DISTINCT pp.id) > 0 OR COUNT(DISTINCT fe.id) > 0
ORDER BY ec.id;

-- J05. Project masters with finance history that require archive protection.
SELECT
  pr.id,
  pr.title,
  pr.project_status,
  COUNT(DISTINCT pp.id) AS plan_count,
  COUNT(DISTINCT p.id) AS payment_count,
  COUNT(DISTINCT e.id) AS expense_count,
  COUNT(DISTINCT fe.id) AS ledger_entry_count
FROM ak_projects pr
LEFT JOIN ak_payment_plans pp ON pp.project_id = pr.id
LEFT JOIN ak_payments p ON p.project_id = pr.id
LEFT JOIN ak_expenses e ON e.project_id = pr.id
LEFT JOIN ak_financial_entries fe ON fe.project_id = pr.id
GROUP BY pr.id, pr.title, pr.project_status
HAVING COUNT(DISTINCT pp.id) > 0
    OR COUNT(DISTINCT p.id) > 0
    OR COUNT(DISTINCT e.id) > 0
    OR COUNT(DISTINCT fe.id) > 0
ORDER BY pr.id;
