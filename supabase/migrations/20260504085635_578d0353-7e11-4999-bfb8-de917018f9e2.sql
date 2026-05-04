
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- updated_at trigger
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

-- Auto-create profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- profiles policies
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- user_roles policies
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============ PROJECTS ============
CREATE TABLE public.projects (
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
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_projects_published ON public.projects(is_published, sort_order);
CREATE INDEX idx_projects_slug ON public.projects(slug);

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone views published projects" ON public.projects FOR SELECT USING (is_published = true);
CREATE POLICY "Admins view all projects" ON public.projects FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage projects" ON public.projects FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PROJECT IMAGES ============
CREATE TABLE public.project_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  alt_text TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_project_images_project ON public.project_images(project_id, sort_order);

CREATE POLICY "Anyone views images of published projects" ON public.project_images FOR SELECT
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_published = true));
CREATE POLICY "Admins view all images" ON public.project_images FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage images" ON public.project_images FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ MEDIA LIBRARY ============
CREATE TABLE public.media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name TEXT,
  title TEXT,
  alt_text TEXT,
  related_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage media" ON public.media_library FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SITE SETTINGS ============
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Akınal İnşaat',
  phone TEXT DEFAULT '+90 000 000 00 00',
  whatsapp_number TEXT DEFAULT '+90 000 000 00 00',
  email TEXT DEFAULT 'info@akinalinsaat.com',
  address TEXT DEFAULT 'İstanbul, Türkiye',
  map_embed_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  linkedin_url TEXT,
  footer_description TEXT DEFAULT 'Akınal İnşaat; kentsel dönüşüm ve inşaat projelerinde güvenilir, planlı ve teknik çözümler sunar.',
  hero_title TEXT DEFAULT 'Güvenli Yapılar, Değerli Yaşam Alanları',
  hero_subtitle TEXT DEFAULT 'Akınal İnşaat olarak kentsel dönüşüm, kat karşılığı inşaat ve anahtar teslim projelerde; planlama, ruhsat, uygulama ve teslim süreçlerini profesyonel şekilde yönetiyoruz.',
  whatsapp_message TEXT DEFAULT 'Merhaba, kentsel dönüşüm / inşaat hizmetleriniz hakkında bilgi almak istiyorum.',
  seo_title TEXT DEFAULT 'Akınal İnşaat | Kentsel Dönüşüm ve İnşaat Hizmetleri',
  seo_description TEXT DEFAULT 'Akınal İnşaat; kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme alanlarında güvenilir çözümler sunar.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone reads settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins update settings" ON public.site_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert settings" ON public.site_settings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_settings (id) VALUES (gen_random_uuid());

-- ============ CONTACT REQUESTS ============
CREATE TABLE public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  service_type TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Yeni',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone submits contact" ON public.contact_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins view contacts" ON public.contact_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage contacts" ON public.contact_requests FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete contacts" ON public.contact_requests FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('project-images', 'project-images', true);

CREATE POLICY "Public read project images" ON storage.objects FOR SELECT USING (bucket_id = 'project-images');
CREATE POLICY "Admins upload project images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'project-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update project images" ON storage.objects FOR UPDATE USING (bucket_id = 'project-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete project images" ON storage.objects FOR DELETE USING (bucket_id = 'project-images' AND public.has_role(auth.uid(), 'admin'));
