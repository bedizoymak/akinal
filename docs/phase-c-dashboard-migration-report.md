# Phase C Dashboard Migration Report

Date: 2026-05-30

## Scope

Migrated the admin dashboard and notification unread summary to PHP/MySQL.

Not touched:

- Admin projects/settings/media
- Public contact form
- Public site UI
- CRM screens
- Finance screens
- Reports

## Previous State

`src/pages/admin/AdminDashboard.tsx` queried Supabase directly for:

- `projects`
- `customers`
- `payment_plans`
- `payments`
- `expenses`
- `financial_entries`
- `contact_requests`

When Supabase was paused, the dashboard showed `Veriler alınamadı`.

The admin header notification bell also used the Supabase-backed notification hook for its unread count.

## New PHP Endpoint

Added:

- `GET /api/admin/dashboard.php`

The endpoint is guarded by the existing PHP admin session helper and reads MySQL tables:

- `ak_projects`
- `ak_contact_requests`
- `ak_notifications`
- `ak_customers`
- `ak_payments`
- `ak_expenses`

It returns zero values for empty tables.

Returned summary fields:

- `total_projects`
- `active_projects`
- `published_projects`
- `draft_projects`
- `total_contact_requests`
- `new_contact_requests`
- `unread_notifications`
- `total_customers`
- `total_payments`
- `total_expenses`
- `basic_net_balance`

It also returns a small `active_projects_list` for the existing active project section.

## Frontend Changes

Updated:

- `src/pages/admin/AdminDashboard.tsx`
- `src/components/admin/NotificationBell.tsx`
- `src/lib/apiClient.ts`
- `src/lib/apiTypes.ts`

The dashboard no longer imports Supabase or Supabase generated types.

The notification bell now reads the unread notification count from the MySQL dashboard summary endpoint instead of the Supabase notification hook. The full notification management page remains outside this phase.

## Notes

- Basic net balance is calculated as `SUM(ak_payments.amount) - SUM(ak_expenses.amount)`.
- Detailed finance-ledger metrics remain outside Phase C because finance and reports were explicitly out of scope.
- Existing dashboard visual structure was preserved, but sections that previously depended on unmigrated finance tables now show empty-state content until their later migration phase.

## Verification

- `npm run build` completed successfully.

## Remaining Work

- Migrate full notifications page/actions.
- Migrate CRM.
- Migrate finance/payment-plan/ledger/report screens.
