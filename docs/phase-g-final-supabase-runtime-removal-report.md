# Phase G Final Supabase Runtime Removal Report

## Summary

Phase G removed the remaining live Supabase runtime dependencies from the React/Vite application.

The two active runtime paths were:

- `FinancialStatementPage`, which read and wrote finance statement data through Supabase table calls.
- `SalesChatbot`, which invoked the Supabase Edge Function `sales-chatbot` from the browser.

Both paths now use PHP endpoints under `/api`.

## Files Changed

- `src/components/admin/finance/FinancialStatementPage.tsx`
- `src/components/site/SalesChatbot.tsx`
- `src/lib/apiClient.ts`
- `src/lib/apiTypes.ts`
- `src/lib/financialEntries.ts`
- `public_html/api/admin/financial-statement.php`
- `public_html/api/sales-chatbot.php`
- Removed `src/lib/financialTypes.ts`
- Removed `src/integrations/supabase/client.ts`
- Removed `src/integrations/supabase/types.ts`

## Financial Statement Migration

### New Endpoint

- `GET /api/admin/financial-statement.php?kind={project|customer|employee|expense}&id={id}`
- `POST /api/admin/financial-statement.php`
- `PATCH /api/admin/financial-statement.php`
- `DELETE /api/admin/financial-statement.php?id={id}`

### Tables Used

- `ak_financial_entries`
- `ak_projects`
- `ak_customers`
- `ak_employees`
- `ak_expense_cards`

### Behavior

- Entity lookup is selected by `kind`.
- Statement entries are filtered by the matching entity column:
  - `project` -> `project_id`
  - `customer` -> `customer_id`
  - `employee` -> `employee_id`
  - `expense` -> `expense_card_id`
- Lookup lists for projects, customers, employees, and expense cards are returned with the statement response.
- CRUD operations use PHP session admin auth and prepared statements.
- Empty result sets return empty arrays instead of errors.

## Sales Chatbot Migration

### New Endpoint

- `POST /api/sales-chatbot.php`

### Current Backend Behavior

The endpoint validates the incoming message and returns:

- `reply: null`
- `fallback: true`

No backend AI provider key is currently configured in the repository. The existing frontend local fallback responses remain active, so the public UI behavior is preserved without Supabase Edge Functions.

## Supabase Runtime Removal

Removed live runtime imports and clients:

- `@/integrations/supabase/client`
- `@supabase/supabase-js` usage from runtime source
- `financeSupabase`
- `supabase.functions.invoke("sales-chatbot", ...)`
- Direct `financeSupabase.from(...)` CRUD calls

The top-level `supabase/` folder and migration tooling were not deleted.

## Validation

### Build

Command:

```bash
npm run build
```

Result: Passed.

### Runtime Supabase Scan

Command:

```bash
rg -n "supabase|createClient|supabase\.auth|supabase\.storage|supabase\.functions|financeSupabase|@supabase" src
```

Result: No matches.

### Runtime `.from(` Scan

Command:

```bash
rg -n "\.from\(" src
```

Remaining matches are non-Supabase JavaScript calls only:

- `Array.from(...)` in dashboard/loading helpers.
- `Array.from(files)` in project image upload handling.
- `Array.from(totals.entries())` in financial statement chart aggregation.

### PHP Lint

Command attempted:

```bash
php -l public_html/api/admin/financial-statement.php
php -l public_html/api/sales-chatbot.php
```

Result: Not run locally because `php` is not installed in this shell.

## Known Limitations

- `sales-chatbot.php` does not call an AI provider yet. It intentionally delegates to the existing deterministic frontend fallback until a backend provider key and provider implementation are added.
- Supabase dependencies may still exist in package metadata or migration scripts for retained tooling, but no live runtime `src/` dependency remains.
- Historical audit documents may still mention previous Supabase runtime usage; this Phase G report reflects the current implementation after the migration.

## Manual Test Checklist

- Log in to admin.
- Open project finance statement and verify entries load from MySQL.
- Create a financial entry.
- Edit the financial entry.
- Delete the financial entry.
- Repeat read checks for customer, employee, and expense card statement pages.
- Open the public chatbot.
- Send a project or contact related message and verify a fallback response appears.
