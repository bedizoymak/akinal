-- Akinal İnşaat recovered public content seed
-- Source: supabase/migrations/20260504085635_578d0353-7e11-4999-bfb8-de917018f9e2.sql
-- Scope: only Akinal İnşaat-related public site settings found in the old migrations.
--
-- No project/project_images/content/storage.objects seed rows were present in the
-- provided migration files, so this file intentionally does not invent project data.
-- No auth users, old hardcoded admin emails, policies, drops, truncates, or secrets.

WITH existing_settings AS (
  SELECT id
  FROM public.site_settings
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
),
target_settings AS (
  SELECT COALESCE(
    (SELECT id FROM existing_settings),
    '00000000-0000-0000-0000-000000000001'::uuid
  ) AS id
)
INSERT INTO public.site_settings (
  id,
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
  seo_description,
  updated_at
)
SELECT
  id,
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
  'Akinal İnşaat; kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme alanlarında güvenilir çözümler sunar.',
  now()
FROM target_settings
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  phone = EXCLUDED.phone,
  whatsapp_number = EXCLUDED.whatsapp_number,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  footer_description = EXCLUDED.footer_description,
  hero_title = EXCLUDED.hero_title,
  hero_subtitle = EXCLUDED.hero_subtitle,
  whatsapp_message = EXCLUDED.whatsapp_message,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description,
  updated_at = now();
