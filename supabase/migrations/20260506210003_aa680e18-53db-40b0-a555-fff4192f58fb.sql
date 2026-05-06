
-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_type TEXT NOT NULL DEFAULT 'Bireysel',
  full_name TEXT,
  company_name TEXT,
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT,
  email TEXT,
  tax_or_identity_number TEXT,
  address TEXT,
  city TEXT,
  district TEXT,
  status TEXT NOT NULL DEFAULT 'Aktif',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer ↔ Project link
CREATE TABLE public.customer_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, project_id)
);

-- Payment plans (planned receivables)
CREATE TABLE public.payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Bekliyor',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments (actual collections)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  payment_plan_id UUID REFERENCES public.payment_plans(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'Nakit',
  description TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Diğer',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer notes
CREATE TABLE public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'Diğer',
  file_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for all tables
CREATE POLICY "Admins manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage customer_projects" ON public.customer_projects
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage payment_plans" ON public.payment_plans
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage customer_notes" ON public.customer_notes
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage documents" ON public.documents
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- updated_at triggers
CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER payment_plans_updated BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_payment_plans_customer ON public.payment_plans(customer_id);
CREATE INDEX idx_payment_plans_project ON public.payment_plans(project_id);
CREATE INDEX idx_payment_plans_due_date ON public.payment_plans(due_date);
CREATE INDEX idx_payments_customer ON public.payments(customer_id);
CREATE INDEX idx_payments_project ON public.payments(project_id);
CREATE INDEX idx_payments_plan ON public.payments(payment_plan_id);
CREATE INDEX idx_expenses_project ON public.expenses(project_id);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX idx_customer_projects_customer ON public.customer_projects(customer_id);
CREATE INDEX idx_customer_projects_project ON public.customer_projects(project_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('customer-documents','customer-documents', false),
  ('payment-documents','payment-documents', false),
  ('expense-documents','expense-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (admin-only access)
CREATE POLICY "Admins read customer-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'customer-documents' AND private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins upload customer-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'customer-documents' AND private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update customer-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'customer-documents' AND private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete customer-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'customer-documents' AND private.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins read payment-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-documents' AND private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins upload payment-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-documents' AND private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update payment-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-documents' AND private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete payment-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-documents' AND private.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins read expense-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-documents' AND private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins upload expense-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-documents' AND private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update expense-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-documents' AND private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete expense-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'expense-documents' AND private.has_role(auth.uid(),'admin'::app_role));
