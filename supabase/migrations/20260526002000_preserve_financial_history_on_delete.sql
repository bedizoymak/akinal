-- Preserve financial history when master records are removed.
ALTER TABLE public.payment_plans
  ALTER COLUMN customer_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS payment_plans_customer_id_fkey,
  ADD CONSTRAINT payment_plans_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ALTER COLUMN customer_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS payments_customer_id_fkey,
  ADD CONSTRAINT payments_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.financial_entries
  ALTER COLUMN project_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS financial_entries_project_id_fkey,
  ADD CONSTRAINT financial_entries_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
