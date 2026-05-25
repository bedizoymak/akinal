CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Aktif',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Aktif',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT current_date,
  card_type TEXT NOT NULL CHECK (card_type IN ('customer', 'employee', 'expense')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  expense_card_id UUID REFERENCES public.expense_cards(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency_tag TEXT NOT NULL DEFAULT 'TRY' CHECK (currency_tag IN ('TRY', 'USD', 'EUR')),
  group_tag TEXT NOT NULL DEFAULT 'Resmi' CHECK (group_tag IN ('Resmi', 'Gayri Resmi')),
  direction TEXT NOT NULL CHECK (direction IN ('Gelir', 'Gider')),
  status TEXT NOT NULL DEFAULT 'Gerçekleşti' CHECK (status IN ('Planlandı', 'Gerçekleşti', 'İptal')),
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT financial_entries_positive_amount CHECK (amount > 0)
);

CREATE OR REPLACE FUNCTION public.validate_financial_entry_card_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  should_validate BOOLEAN := false;
BEGIN
  -- Validate newly authored movements, while preserving ON DELETE SET NULL history.
  IF TG_OP = 'INSERT' THEN
    should_validate := true;
  ELSIF TG_OP = 'UPDATE' THEN
    should_validate := NEW.card_type IS DISTINCT FROM OLD.card_type;
  END IF;

  IF should_validate THEN
    IF NEW.card_type = 'customer' AND NEW.customer_id IS NULL THEN
      RAISE EXCEPTION 'Müşteri kartı seçimi zorunludur.';
    END IF;

    IF NEW.card_type = 'employee' AND NEW.employee_id IS NULL THEN
      RAISE EXCEPTION 'Personel kartı seçimi zorunludur.';
    END IF;

    IF NEW.card_type = 'expense' AND NEW.expense_card_id IS NULL THEN
      RAISE EXCEPTION 'Gider kartı seçimi zorunludur.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS financial_entries_validate_card_reference ON public.financial_entries;
CREATE TRIGGER financial_entries_validate_card_reference
  BEFORE INSERT OR UPDATE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_financial_entry_card_reference();

CREATE INDEX IF NOT EXISTS idx_financial_entries_project_date ON public.financial_entries(project_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_financial_entries_card_type ON public.financial_entries(card_type);
CREATE INDEX IF NOT EXISTS idx_financial_entries_customer_id ON public.financial_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_employee_id ON public.financial_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_expense_card_id ON public.financial_entries(expense_card_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_direction ON public.financial_entries(direction);
CREATE INDEX IF NOT EXISTS idx_financial_entries_status ON public.financial_entries(status);
CREATE INDEX IF NOT EXISTS idx_financial_entries_group_tag ON public.financial_entries(group_tag);
CREATE INDEX IF NOT EXISTS idx_financial_entries_currency_tag ON public.financial_entries(currency_tag);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage employees" ON public.employees;
CREATE POLICY "Admins manage employees" ON public.employees AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage expense cards" ON public.expense_cards;
CREATE POLICY "Admins manage expense cards" ON public.expense_cards AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage financial entries" ON public.financial_entries;
CREATE POLICY "Admins manage financial entries" ON public.financial_entries AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS employees_updated_at ON public.employees;
CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS expense_cards_updated_at ON public.expense_cards;
CREATE TRIGGER expense_cards_updated_at
  BEFORE UPDATE ON public.expense_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS financial_entries_updated_at ON public.financial_entries;
CREATE TRIGGER financial_entries_updated_at
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
