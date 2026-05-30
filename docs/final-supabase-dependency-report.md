# Final Supabase Dependency Report

Date: 2026-05-30

## Scan Scope

Repository-wide scans were run for:

- `supabase`
- `createClient`
- `supabase.auth`
- `supabase.storage`
- `supabase.functions`
- `from(`
- `storage.from(`

The results include live source code, scripts, Supabase migration/function archives, migration tooling, and historical documentation.

## Executive Summary

Supabase has not been fully removed from the repository.

Most public/admin CRUD modules now use PHP/MySQL, but two live runtime areas still require Supabase:

1. Public sales chatbot:
   - `src/components/site/SalesChatbot.tsx`
   - Uses `supabase.functions.invoke("sales-chatbot")`.
2. Shared finance statement pages:
   - `src/components/admin/finance/FinancialStatementPage.tsx`
   - Uses `financeSupabase.from(...)` for entity lookups and `financial_entries` CRUD.

Because these live routes still import the Supabase client, `@supabase/supabase-js` remains a required runtime dependency today.

## Remaining Supabase Files

### Required

| File | Why it remains required |
| --- | --- |
| `src/integrations/supabase/client.ts` | Creates the Supabase client used by live runtime features. |
| `src/integrations/supabase/types.ts` | Provides generated types used by the Supabase client and `financialTypes.ts`. |
| `src/lib/financialTypes.ts` | Exports `financeSupabase`, used by `FinancialStatementPage`. |
| `src/components/site/SalesChatbot.tsx` | Public chatbot invokes a Supabase Edge Function. |
| `src/components/admin/finance/FinancialStatementPage.tsx` | Finance statement detail pages still read/write through Supabase. |
| `package.json` / `package-lock.json` | Supabase packages are still needed while required runtime files exist. |

### Required By Route

| Route wrapper | Route | Dependency path |
| --- | --- | --- |
| `src/pages/admin/AdminProjectFinance.tsx` | `/admin/projeler/:id/finans` | Renders `FinancialStatementPage`. |
| `src/pages/admin/AdminCustomerFinance.tsx` | `/admin/musteriler/:id/finans` | Renders `FinancialStatementPage`. |
| `src/pages/admin/AdminEmployeeFinance.tsx` | `/admin/personeller/:id/finans` | Renders `FinancialStatementPage`. |
| `src/pages/admin/AdminExpenseCardFinance.tsx` | `/admin/gider-kartlari/:id/finans` | Renders `FinancialStatementPage`. |

### Optional / Migration Tooling

| File or folder | Classification | Notes |
| --- | --- | --- |
| `scripts/seed-smoke-test.mjs` | Optional | Supabase seed/smoke utility. Not used by runtime app. |
| `scripts/cleanup-smoke-test.mjs` | Optional | Supabase cleanup utility. Not used by runtime app. |
| `scripts/seed-demo-bulk.mjs` | Optional | Supabase demo seed utility. Not used by runtime app. |
| `scripts/cleanup-demo-bulk.mjs` | Optional | Supabase demo cleanup utility. Not used by runtime app. |
| `migration-tools/` | Optional | Supabase export conversion tooling and docs. Useful only for data migration/archive work. |
| `supabase/` | Optional / archive | Supabase migrations, manual schema, and Edge Functions. Not served by the PHP/MySQL app, but kept as source archive. |
| `components.json` | Optional | Contains a shadcn registry alias named `@supabase`; not runtime Supabase API usage. |

### Dead Code Candidates

| File or folder | Reason |
| --- | --- |
| `supabase/functions/submit-contact-request/index.ts` | Contact form now posts to PHP `/api/contact-request.php`; this Edge Function is superseded. |
| `supabase/functions/sales-chatbot/index.ts` | Still paired with live `SalesChatbot`; becomes dead only after chatbot is migrated to PHP or removed. |
| Historical docs under `docs/` | Mention Supabase migration state from earlier phases; not runtime code. Keep for history or prune later. |

## Remaining Supabase Imports

### Required

| File | Import |
| --- | --- |
| `src/integrations/supabase/client.ts` | `import { createClient } from '@supabase/supabase-js';` |
| `src/lib/financialTypes.ts` | `import type { SupabaseClient } from "@supabase/supabase-js";` |
| `src/lib/financialTypes.ts` | `import { supabase } from "@/integrations/supabase/client";` |
| `src/lib/financialTypes.ts` | `import type { Database } from "@/integrations/supabase/types";` |
| `src/components/site/SalesChatbot.tsx` | `import { supabase } from "@/integrations/supabase/client";` |
| `src/components/admin/finance/FinancialStatementPage.tsx` | Imports `financeSupabase` from `financialTypes.ts`. |

### Optional / Script Imports

| File | Import |
| --- | --- |
| `scripts/seed-smoke-test.mjs` | `import { createClient } from "@supabase/supabase-js";` |
| `scripts/cleanup-smoke-test.mjs` | `import { createClient } from "@supabase/supabase-js";` |
| `scripts/seed-demo-bulk.mjs` | `import { createClient } from "@supabase/supabase-js";` |
| `scripts/cleanup-demo-bulk.mjs` | `import { createClient } from "@supabase/supabase-js";` |

## Remaining Supabase API Calls

### Edge Functions

| File | Call | Classification |
| --- | --- | --- |
| `src/components/site/SalesChatbot.tsx` | `supabase.functions.invoke("sales-chatbot", ...)` | Required |

### Database Calls

| File | Calls | Classification |
| --- | --- | --- |
| `src/components/admin/finance/FinancialStatementPage.tsx` | `financeSupabase.from("projects")...` | Required |
| `src/components/admin/finance/FinancialStatementPage.tsx` | `financeSupabase.from("customers")...` | Required |
| `src/components/admin/finance/FinancialStatementPage.tsx` | `financeSupabase.from("employees")...` | Required |
| `src/components/admin/finance/FinancialStatementPage.tsx` | `financeSupabase.from("expense_cards")...` | Required |
| `src/components/admin/finance/FinancialStatementPage.tsx` | `financeSupabase.from("financial_entries")...` select/insert/update/delete | Required |
| `scripts/seed-*.mjs`, `scripts/cleanup-*.mjs` | Multiple `supabase.from(...)` calls | Optional |

### Auth Calls

| File | Calls | Classification |
| --- | --- | --- |
| `scripts/seed-smoke-test.mjs` | `supabase.auth.signInWithPassword(...)`, `supabase.auth.signOut()` | Optional |
| `scripts/cleanup-smoke-test.mjs` | `supabase.auth.signInWithPassword(...)`, `supabase.auth.signOut()` | Optional |
| `scripts/seed-demo-bulk.mjs` | `supabase.auth.signInWithPassword(...)`, `supabase.auth.signOut()` | Optional |
| `scripts/cleanup-demo-bulk.mjs` | `supabase.auth.signInWithPassword(...)`, `supabase.auth.signOut()` | Optional |

No live React admin/public auth flow uses `supabase.auth`; admin auth is PHP session based.

## Remaining Storage Dependencies

### Runtime Code

No live runtime matches were found for:

- `supabase.storage`
- `supabase.storage.from(...)`
- `storage.from(...)`

Project, payment, and expense uploads now use PHP upload endpoints.

### Documentation / Migration Archive

Historical docs still mention Supabase Storage migration and old storage buckets. These are not runtime dependencies.

## Remaining Auth Dependencies

### Runtime Code

No live runtime `supabase.auth` dependency remains.

### Optional Scripts

The seed/cleanup scripts still use Supabase Auth for old Supabase-based test/demo data workflows:

- `scripts/seed-smoke-test.mjs`
- `scripts/cleanup-smoke-test.mjs`
- `scripts/seed-demo-bulk.mjs`
- `scripts/cleanup-demo-bulk.mjs`

These are optional migration/development utilities and can be deleted or rewritten after the final MySQL seed workflow is established.

## `from(` Scan Notes

The raw `from(` scan includes many false positives, such as:

- `Array.from(...)`
- `Object.fromEntries(...)`
- JSX/component code unrelated to Supabase
- Documentation snippets

True Supabase database calls are the `supabase.from(...)` and `financeSupabase.from(...)` matches listed above.

## Classification Summary

### Required

- `SalesChatbot` and `sales-chatbot` Edge Function invocation.
- `FinancialStatementPage` and the admin finance detail routes that render it.
- Supabase client/types and package dependencies needed by those runtime features.

### Optional

- Supabase seed/cleanup scripts.
- Migration tooling and export conversion docs.
- Supabase migration/manual schema archive.

### Dead Code

- `supabase/functions/submit-contact-request/index.ts` is superseded by PHP contact submission.
- Historical docs describe old migration state and can be archived or pruned.

## Recommended Removal Order

1. Migrate `FinancialStatementPage` to PHP/MySQL endpoints for statement entity lookup and `ak_financial_entries` CRUD.
2. Migrate `SalesChatbot` from Supabase Edge Function to a PHP endpoint or remove the chatbot feature.
3. Remove or rewrite Supabase seed/cleanup scripts.
4. Remove `src/integrations/supabase/*`, `src/lib/financialTypes.ts` Supabase client wiring, and Supabase package dependencies.
5. Archive or delete the `supabase/` folder after confirming no rollback/data export use remains.
