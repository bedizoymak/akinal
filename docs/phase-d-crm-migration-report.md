# Phase D CRM Migration Report

Date: 2026-05-30

## Summary

Phase D migrated the CRM admin modules for Customers, Payments/Tahsilatlar, and Payment Plans/Odeme Planlari from direct Supabase access to the PHP/MySQL API layer.

The migrated admin screens now use PHP sessions/admin auth, prepared-statement PHP endpoints, and MySQL tables. The existing UI/design was preserved.

## Files Changed

- `src/lib/apiClient.ts`
- `src/lib/apiTypes.ts`
- `src/pages/admin/AdminCustomers.tsx`
- `src/pages/admin/AdminCustomerEdit.tsx`
- `src/pages/admin/AdminCustomerDetail.tsx`
- `src/pages/admin/AdminCollections.tsx`
- `src/pages/admin/AdminPaymentPlans.tsx`
- `public_html/api/admin/customers.php`
- `public_html/api/admin/payments.php`
- `public_html/api/admin/payment-plans.php`
- `public_html/api/admin/upload-payment-document.php`
- `docs/phase-d-crm-migration-report.md`

## Endpoints Added

- `GET /api/admin/customers.php`
  - Lists customers, customer/project links, projects, payment plans, and payments for the customer list screen.
- `GET /api/admin/customers.php?id={id}`
  - Loads one customer with project links, projects, payment plans, payments, expenses, notes, and documents for the detail/edit screens.
- `POST /api/admin/customers.php`
  - Creates a customer and writes selected project links to `ak_customer_projects`.
- `PATCH /api/admin/customers.php`
  - Updates a customer and replaces selected project links.
- `DELETE /api/admin/customers.php?id={id}`
  - Deletes a customer.
- `POST /api/admin/customers.php` with `action: "note"`
  - Creates a customer note in `ak_customer_notes`.
- `DELETE /api/admin/customers.php?note_id={id}`
  - Deletes a customer note.
- `GET /api/admin/payments.php`
  - Lists payments with customers, projects, and payment plans.
- `POST /api/admin/payments.php`
  - Creates a payment in `ak_payments` and recalculates the linked payment plan status.
- `PATCH /api/admin/payments.php`
  - Updates a payment and recalculates the current/previous linked payment plan status.
- `DELETE /api/admin/payments.php?id={id}`
  - Deletes a payment and recalculates the linked payment plan status.
- `GET /api/admin/payment-plans.php`
  - Lists payment plans with customers, projects, and payment totals.
- `POST /api/admin/payment-plans.php`
  - Creates a payment plan in `ak_payment_plans`.
- `PATCH /api/admin/payment-plans.php`
  - Updates a payment plan.
- `DELETE /api/admin/payment-plans.php?id={id}`
  - Deletes a payment plan.
- `POST /api/admin/upload-payment-document.php`
  - Uploads payment receipts/documents to `/uploads/payment-documents`.

## Supabase Usage Removed

Removed direct Supabase imports and calls from:

- `src/pages/admin/AdminCustomers.tsx`
- `src/pages/admin/AdminCustomerEdit.tsx`
- `src/pages/admin/AdminCustomerDetail.tsx`
- `src/pages/admin/AdminCollections.tsx`
- `src/pages/admin/AdminPaymentPlans.tsx`

Removed Supabase table access for:

- `customers`
- `customer_projects`
- `payment_plans`
- `payments`
- `projects`
- `expenses` reads in customer detail
- `customer_notes`
- `documents`

Removed Supabase Storage usage for payment documents from `AdminCollections.tsx`.

## Tables Used

- `ak_customers`
- `ak_customer_projects`
- `ak_payment_plans`
- `ak_payments`
- `ak_customer_notes`
- `ak_projects`
- `ak_expenses`
- `ak_documents`

## Frontend Behavior Preserved

- Customer list search, type/status/project/balance filters, CSV export, and delete action.
- Customer create/edit validation and project checkbox linking.
- Customer detail tabs for general info, payment plans, payments, expenses, notes, and documents.
- Payment plan list filters, CSV export, create/edit/delete dialog flow, and computed status display.
- Payment list customer/project/date filters, CSV export, create/edit/delete dialog flow, and document upload field.
- Empty MySQL result sets continue to show existing empty states instead of hard errors.

## Manual Test Checklist

- Log in to admin and open `/admin/musteriler`.
- Confirm the customer list loads with empty state or rows from `ak_customers`.
- Create a new individual customer with at least one linked project.
- Edit the customer and change linked projects.
- Open the customer detail page and add/delete a note.
- Delete a test customer after confirming related data behavior is acceptable.
- Open `/admin/odeme-planlari`.
- Create, edit, filter, and delete a payment plan.
- Open `/admin/tahsilatlar`.
- Create, edit, filter, and delete a payment.
- Upload a JPG/PNG/WEBP/PDF payment document and verify the generated `/uploads/payment-documents/...` URL opens.
- Verify linked payment plan status updates after payment create/update/delete.

## Validation

- `npm run build`: passed.
- Supabase scan over migrated CRM modules/endpoints: no matches.
- PHP lint: not run because `php` CLI is not available in the local environment.

## Known Limitations

- Payment document uploads now use local PHP filesystem storage under `/uploads/payment-documents`; production hosting must allow PHP to create/write that directory.
- Customer deletion depends on the live MySQL foreign key configuration. If production constraints are stricter than the migration schema, deletion may fail until related rows are handled explicitly.
- CRM Finance, Reports, Expenses, Employees, and Expense Cards are outside Phase D scope and may still use Supabase.
