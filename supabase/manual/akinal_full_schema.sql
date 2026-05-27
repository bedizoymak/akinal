-- Akinal İnşaat manual Supabase schema
-- Purpose: safe setup for a new empty Supabase project.
-- Safe to rerun: uses IF NOT EXISTS checks and does not drop or truncate data.
-- After running this file, create/authenticate an admin user and add admin email as noted below.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional configurable admin allowlist.
-- To bootstrap a known admin, run this separately with your real email:
-- INSERT INTO public.admin_users (email, role, is_active)
-- VALUES ('your-admin@example.com', 'admin', true)
-- ON CONFLICT (email) DO UPDATE SET role = 'admin', is_active = true;
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email_lower
  ON public.admin_users (lower(email));

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT NOT NULL DEFAULT '',
  detailed_description TEXT DEFAULT '',
  project_type TEXT NOT NULL,
  project_status TEXT NOT NULL,
  location TEXT NOT NULL,
  city TEXT,
  district TEXT,
  start_year TEXT,
  delivery_year TEXT,
  land_area TEXT,
  construction_area TEXT,
  apartment_count TEXT,
  floor_count TEXT,
  block_count TEXT,
  cover_image_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  alt_text TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name TEXT,
  title TEXT,
  alt_text TEXT,
  related_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Akinal İnşaat',
  phone TEXT DEFAULT '+90 000 000 00 00',
  whatsapp_number TEXT DEFAULT '+90 000 000 00 00',
  email TEXT DEFAULT 'info@akinalinsaat.com',
  address TEXT DEFAULT 'Molla Gürani Mah. Sarı Musa Sk. NO:49/A 34349 Fatih/İstanbul/Türkiye',
  map_embed_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  linkedin_url TEXT,
  footer_description TEXT DEFAULT 'Akinal İnşaat; kentsel dönüşüm ve inşaat projelerinde güvenilir, planlı ve teknik çözümler sunar.',
  hero_title TEXT DEFAULT 'Güvenli Yapılar, Değerli Yaşam Alanları',
  hero_subtitle TEXT DEFAULT 'Akinal İnşaat olarak kentsel dönüşüm, kat karşılığı inşaat ve anahtar teslim projelerde; planlama, ruhsat, uygulama ve teslim süreçlerini profesyonel şekilde yönetiyoruz.',
  whatsapp_message TEXT DEFAULT 'Merhaba, kentsel dönüşüm / inşaat hizmetleriniz hakkında bilgi almak istiyorum.',
  seo_title TEXT DEFAULT 'Akinal İnşaat | Kentsel Dönüşüm ve İnşaat Hizmetleri',
  seo_description TEXT DEFAULT 'Akinal İnşaat; kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme alanlarında güvenilir çözümler sunar.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  service_type TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Yeni',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
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

CREATE TABLE IF NOT EXISTS public.customer_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, project_id)
);

CREATE TABLE IF NOT EXISTS public.payment_plans (
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

CREATE TABLE IF NOT EXISTS public.payments (
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

CREATE TABLE IF NOT EXISTS public.expenses (
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

CREATE TABLE IF NOT EXISTS public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'Diğer',
  file_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Genel',
  priority TEXT NOT NULL DEFAULT 'Orta',
  related_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  related_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  related_payment_plan_id UUID REFERENCES public.payment_plans(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
  OR (
    _role = 'admin'::public.app_role
    AND EXISTS (
      SELECT 1
      FROM public.admin_users au
      JOIN auth.users u ON lower(u.email) = lower(au.email)
      WHERE u.id = _user_id
        AND au.is_active = true
        AND au.role = 'admin'
    )
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.has_role(_user_id, _role)
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_count INT;
  should_be_admin BOOLEAN;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);

  SELECT COUNT(*) INTO user_count FROM auth.users;
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE lower(email) = lower(NEW.email)
      AND role = 'admin'
      AND is_active = true
  ) INTO should_be_admin;

  IF user_count = 1 OR should_be_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    EXECUTE $trg$
      CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
    $trg$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_published ON public.projects(is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);
CREATE INDEX IF NOT EXISTS idx_project_images_project ON public.project_images(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_payment_plans_customer ON public.payment_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_project ON public.payment_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_due_date ON public.payment_plans(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_project ON public.payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_plan ON public.payments(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON public.expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_customer ON public.expenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_customer_projects_customer ON public.customer_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_projects_project ON public.customer_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_plan ON public.notifications(related_payment_plan_id);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admin_users',
    'profiles',
    'user_roles',
    'projects',
    'project_images',
    'media_library',
    'site_settings',
    'contact_requests',
    'customers',
    'customer_projects',
    'payment_plans',
    'payments',
    'expenses',
    'customer_notes',
    'documents',
    'notifications'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_users' AND policyname = 'Authenticated users read own admin status') THEN
    EXECUTE $pol$
      CREATE POLICY "Authenticated users read own admin status"
      ON public.admin_users FOR SELECT TO authenticated
      USING (is_active = true AND lower(email) = lower(COALESCE(auth.jwt()->>'email', '')))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_users' AND policyname = 'Admins manage admin users') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins manage admin users"
      ON public.admin_users FOR ALL TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users view own profile') THEN
    EXECUTE $pol$
      CREATE POLICY "Users view own profile"
      ON public.profiles FOR SELECT TO authenticated
      USING (auth.uid() = user_id)
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admins view all profiles') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins view all profiles"
      ON public.profiles FOR SELECT TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Users view own roles') THEN
    EXECUTE $pol$
      CREATE POLICY "Users view own roles"
      ON public.user_roles FOR SELECT TO authenticated
      USING (auth.uid() = user_id)
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Admins view all roles') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins view all roles"
      ON public.user_roles FOR SELECT TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Admins manage roles') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins manage roles"
      ON public.user_roles FOR ALL TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Anyone views published projects') THEN
    EXECUTE $pol$
      CREATE POLICY "Anyone views published projects"
      ON public.projects FOR SELECT TO anon, authenticated
      USING (is_published = true)
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Admins manage projects') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins manage projects"
      ON public.projects FOR ALL TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Admins view all projects') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins view all projects"
      ON public.projects FOR SELECT TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_images' AND policyname = 'Anyone views images of published projects') THEN
    EXECUTE $pol$
      CREATE POLICY "Anyone views images of published projects"
      ON public.project_images FOR SELECT TO anon, authenticated
      USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_published = true))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_images' AND policyname = 'Admins manage images') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins manage images"
      ON public.project_images FOR ALL TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_images' AND policyname = 'Admins view all images') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins view all images"
      ON public.project_images FOR SELECT TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'media_library' AND policyname = 'Admins manage media') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins manage media"
      ON public.media_library FOR ALL TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_settings' AND policyname = 'Anyone reads settings') THEN
    EXECUTE $pol$
      CREATE POLICY "Anyone reads settings"
      ON public.site_settings FOR SELECT TO anon, authenticated
      USING (true)
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_settings' AND policyname = 'Admins insert settings') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins insert settings"
      ON public.site_settings FOR INSERT TO authenticated
      WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_settings' AND policyname = 'Admins update settings') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins update settings"
      ON public.site_settings FOR UPDATE TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_requests' AND policyname = 'Admins manage contacts') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins manage contacts"
      ON public.contact_requests FOR ALL TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_requests' AND policyname = 'Admins view contacts') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins view contacts"
      ON public.contact_requests FOR SELECT TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;
END $$;

DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customers',
    'customer_projects',
    'payment_plans',
    'payments',
    'expenses',
    'customer_notes',
    'documents',
    'notifications'
  ] LOOP
    policy_name := 'Admins manage ' || table_name;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (private.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (private.has_role(auth.uid(), ''admin''::public.app_role))',
        policy_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'projects_updated_at' AND tgrelid = 'public.projects'::regclass) THEN
    EXECUTE 'CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'site_settings_updated_at' AND tgrelid = 'public.site_settings'::regclass) THEN
    EXECUTE 'CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customers_updated' AND tgrelid = 'public.customers'::regclass) THEN
    EXECUTE 'CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'payment_plans_updated' AND tgrelid = 'public.payment_plans'::regclass) THEN
    EXECUTE 'CREATE TRIGGER payment_plans_updated BEFORE UPDATE ON public.payment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'payments_updated' AND tgrelid = 'public.payments'::regclass) THEN
    EXECUTE 'CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'expenses_updated' AND tgrelid = 'public.expenses'::regclass) THEN
    EXECUTE 'CREATE TRIGGER expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

INSERT INTO public.site_settings (
  company_name,
  phone,
  whatsapp_number,
  email,
  address,
  footer_description,
  hero_title,
  hero_subtitle,
  whatsapp_message,
  seo_title,
  seo_description
)
SELECT
  'Akinal İnşaat',
  '+90 000 000 00 00',
  '+90 000 000 00 00',
  'info@akinalinsaat.com',
  'Molla Gürani Mah. Sarı Musa Sk. NO:49/A 34349 Fatih/İstanbul/Türkiye',
  'Akinal İnşaat; kentsel dönüşüm ve inşaat projelerinde güvenilir, planlı ve teknik çözümler sunar.',
  'Güvenli Yapılar, Değerli Yaşam Alanları',
  'Akinal İnşaat olarak kentsel dönüşüm, kat karşılığı inşaat ve anahtar teslim projelerde; planlama, ruhsat, uygulama ve teslim süreçlerini profesyonel şekilde yönetiyoruz.',
  'Merhaba, kentsel dönüşüm / inşaat hizmetleriniz hakkında bilgi almak istiyorum.',
  'Akinal İnşaat | Kentsel Dönüşüm ve İnşaat Hizmetleri',
  'Akinal İnşaat; kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme alanlarında güvenilir çözümler sunar.'
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings);

CREATE OR REPLACE FUNCTION public.notify_new_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (title, message, type, priority)
  VALUES (
    'Yeni İletişim Talebi',
    'Web sitesi üzerinden ' || COALESCE(NEW.full_name, 'bir ziyaretçi') || ' tarafından yeni bir iletişim talebi alındı.',
    'Yeni İletişim Talebi',
    'Yüksek'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (title, message, type, priority, related_customer_id)
  VALUES (
    'Yeni Müşteri',
    COALESCE(NEW.company_name, NEW.full_name, 'Yeni müşteri') || ' sisteme eklendi.',
    'Yeni Müşteri',
    'Düşük',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (title, message, type, priority, related_project_id)
  VALUES (
    'Yeni Proje',
    NEW.title || ' projesi sisteme eklendi.',
    'Yeni Proje',
    'Düşük',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (title, message, type, priority, related_project_id)
  VALUES (
    'Gider Kaydı',
    NEW.title || ' başlıklı yeni bir gider kaydı oluşturuldu.',
    'Gider Kaydı',
    'Düşük',
    NEW.project_id
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_new_contact' AND tgrelid = 'public.contact_requests'::regclass) THEN
    EXECUTE 'CREATE TRIGGER trg_notify_new_contact AFTER INSERT ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.notify_new_contact()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_new_customer' AND tgrelid = 'public.customers'::regclass) THEN
    EXECUTE 'CREATE TRIGGER trg_notify_new_customer AFTER INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION public.notify_new_customer()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_new_project' AND tgrelid = 'public.projects'::regclass) THEN
    EXECUTE 'CREATE TRIGGER trg_notify_new_project AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.notify_new_project()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_new_expense' AND tgrelid = 'public.expenses'::regclass) THEN
    EXECUTE 'CREATE TRIGGER trg_notify_new_expense AFTER INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.notify_new_expense()';
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('project-images', 'project-images', true),
  ('customer-documents', 'customer-documents', false),
  ('payment-documents', 'payment-documents', false),
  ('expense-documents', 'expense-documents', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read project images') THEN
    EXECUTE $pol$
      CREATE POLICY "Public read project images"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'project-images' AND name IS NOT NULL)
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read individual project images') THEN
    EXECUTE $pol$
      CREATE POLICY "Public read individual project images"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'project-images' AND name IS NOT NULL)
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins upload project images') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins upload project images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'project-images' AND private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins update project images') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins update project images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'project-images' AND private.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (bucket_id = 'project-images' AND private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins delete project images') THEN
    EXECUTE $pol$
      CREATE POLICY "Admins delete project images"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'project-images' AND private.has_role(auth.uid(), 'admin'::public.app_role))
    $pol$;
  END IF;
END $$;

DO $$
DECLARE
  bucket_name TEXT;
BEGIN
  FOREACH bucket_name IN ARRAY ARRAY['customer-documents', 'payment-documents', 'expense-documents'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins read ' || bucket_name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L AND private.has_role(auth.uid(), ''admin''::public.app_role))',
        'Admins read ' || bucket_name,
        bucket_name
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins upload ' || bucket_name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L AND private.has_role(auth.uid(), ''admin''::public.app_role))',
        'Admins upload ' || bucket_name,
        bucket_name
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins update ' || bucket_name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L AND private.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (bucket_id = %L AND private.has_role(auth.uid(), ''admin''::public.app_role))',
        'Admins update ' || bucket_name,
        bucket_name,
        bucket_name
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins delete ' || bucket_name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L AND private.has_role(auth.uid(), ''admin''::public.app_role))',
        'Admins delete ' || bucket_name,
        bucket_name
      );
    END IF;
  END LOOP;
END $$;

-- Existing auth users can be synced after inserting allowlisted admin emails:
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT u.id, 'admin'::public.app_role
-- FROM auth.users u
-- JOIN public.admin_users au ON lower(au.email) = lower(u.email)
-- WHERE au.role = 'admin' AND au.is_active = true
-- ON CONFLICT (user_id, role) DO NOTHING;
