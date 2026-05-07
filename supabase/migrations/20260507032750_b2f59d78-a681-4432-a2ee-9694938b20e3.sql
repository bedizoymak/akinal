CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Genel',
  priority TEXT NOT NULL DEFAULT 'Orta',
  related_customer_id UUID,
  related_project_id UUID,
  related_payment_plan_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notifications"
ON public.notifications
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- Trigger functions
CREATE OR REPLACE FUNCTION public.notify_new_contact()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (title, message, type, priority)
  VALUES ('Yeni İletişim Talebi',
    'Web sitesi üzerinden ' || COALESCE(NEW.full_name, 'bir ziyaretçi') || ' tarafından yeni bir iletişim talebi alındı.',
    'Yeni İletişim Talebi', 'Yüksek');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_new_contact
AFTER INSERT ON public.contact_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_new_contact();

CREATE OR REPLACE FUNCTION public.notify_new_customer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (title, message, type, priority, related_customer_id)
  VALUES ('Yeni Müşteri',
    COALESCE(NEW.company_name, NEW.full_name, 'Yeni müşteri') || ' sisteme eklendi.',
    'Yeni Müşteri', 'Düşük', NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_new_customer
AFTER INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.notify_new_customer();

CREATE OR REPLACE FUNCTION public.notify_new_project()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (title, message, type, priority, related_project_id)
  VALUES ('Yeni Proje',
    NEW.title || ' projesi sisteme eklendi.',
    'Yeni Proje', 'Düşük', NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_new_project
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.notify_new_project();

CREATE OR REPLACE FUNCTION public.notify_new_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (title, message, type, priority, related_project_id)
  VALUES ('Gider Kaydı',
    NEW.title || ' başlıklı yeni bir gider kaydı oluşturuldu.',
    'Gider Kaydı', 'Düşük', NEW.project_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_new_expense
AFTER INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.notify_new_expense();