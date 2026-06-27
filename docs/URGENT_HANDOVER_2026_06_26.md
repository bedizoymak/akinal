# Urgent Handover — 2026-06-26

## Session Status

| Task | Status |
|------|--------|
| DB schema pushed (all 5 new card tables exist in production) | YES |
| Idempotent seed completed (16 finance entries, 2 suppliers, 2 employees, 5 expense cards) | YES |
| Browser/API 500 fixes deployed (`customers.php`, `notifications.php`, canonical files) | YES |
| Table dependency audit created | YES — `docs/TABLE_DEPENDENCY_AND_DELETION_AUDIT.md` |

---

## Protected Tables — Never Delete Without Owner Approval

These tables hold authentication and access control data. Dropping them locks everyone out.

- `ak_admin_users` — login credentials and session auth; every API request depends on it
- `ak_profiles` — currently schema-only (Supabase artifact), but FK-linked to `ak_admin_users`; verify empty before any action
- `ak_user_roles` — currently schema-only (Supabase artifact), but FK-linked to `ak_admin_users`; verify empty before any action

---

## Legacy Finance Tables — Do Not Delete Yet

These tables still have live code paths reading or writing them. Deletion would break visible UI pages.

- `ak_financial_entries` — still the write target of `financial-statement.php`, which backs `AdminProjectFinance`, `AdminCustomerFinance`, `AdminEmployeeFinance`, and `AdminExpenseCardFinance`
- `ak_payment_plans` — still queried by `notifications.php` (notification generation), `customers.php`, `financial-statement.php`, and `reports.php`
- `ak_payments` — still has active CRUD via `payments.php`; still augments customer/project statements in `financial-statement.php`
- `ak_expenses` — still has active CRUD via `expenses.php`; still augments customer/project statements in `financial-statement.php`

---

## Next Step After Context Resets

Do these in order before any cleanup or deletion:

1. Open `src/App.tsx` and list every active route under `/admin` — confirm which finance pages (`AdminProjectFinance`, `AdminCustomerFinance`, `AdminEmployeeFinance`, `AdminExpenseCardFinance`) still have live routes vs. redirects
2. Open `public_html/api/admin/financial-statement.php` and confirm which pages still call it (search `getAdminFinancialStatement` in `src/lib/apiClient.ts` and trace to pages)
3. Only after confirming the above: decide whether to migrate those pages to the card-specific endpoints, and only then schedule legacy table cleanup

---

## Changed Files — `git status --short`

### Modified (previously tracked)
```
M public_html/api/admin/backend-canonical-read-model.php
M public_html/api/admin/canonical-read-flags.php
M public_html/api/admin/customers.php
M public_html/api/admin/dashboard.php
M public_html/api/admin/notifications.php
M public_html/install-schema.php
M scripts/deploy_ftp.py
M src/App.tsx
M src/components/admin/AdminLayout.tsx
M src/lib/apiClient.ts
M src/lib/apiTypes.ts
M src/pages/admin/AdminCustomerDetail.tsx
M src/pages/admin/AdminEmployeeDetail.tsx
M src/pages/admin/AdminExpenseCardFinance.tsx
```

### New (untracked)
```
docs/PHASE_FINANCE_CARD_ARCHITECTURE_PACKAGE.md
docs/TABLE_DEPENDENCY_AND_DELETION_AUDIT.md        ← this audit
public_html/api/admin/customer-financial-entries.php
public_html/api/admin/employee-financial-entries.php
public_html/api/admin/expense-card-financial-entries.php
public_html/api/admin/finance-entry-helpers.php
public_html/api/admin/gelenler.php
public_html/api/admin/gidenler.php
public_html/api/admin/project-statement.php
public_html/api/admin/supplier-financial-entries.php
public_html/api/admin/suppliers.php
scripts/seed-demo-card-finance.mjs
src/components/admin/finance/CardEntryForm.tsx
src/components/admin/finance/CardStatementTable.tsx
src/components/admin/finance/CurrencyAmount.tsx
src/components/admin/finance/EntryStatusBadge.tsx
src/pages/admin/AdminGelenler.tsx
src/pages/admin/AdminGidenler.tsx
src/pages/admin/AdminSupplierDetail.tsx
src/pages/admin/AdminSupplierEdit.tsx
src/pages/admin/AdminSuppliers.tsx
src/test/card-finance-architecture.test.ts
```
