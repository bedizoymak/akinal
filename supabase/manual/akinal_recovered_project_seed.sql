-- Akinal Insaat recovered public/demo content seed
-- Source inspected: supabase/migrations/*.sql
--
-- Safe scope:
-- - public.site_settings content recovered from migration defaults
-- - excludes identity, role, permission, and storage-rule data
-- - excludes destructive SQL
--
-- Note:
-- No INSERT rows for public.projects or public.project_images were found in the local
-- migration SQL files. Those tables are therefore intentionally not seeded here.

insert into public.site_settings (
  id,
  company_name,
  phone,
  whatsapp_number,
  email,
  address,
  map_embed_url,
  instagram_url,
  facebook_url,
  linkedin_url,
  footer_description,
  hero_title,
  hero_subtitle,
  whatsapp_message,
  seo_title,
  seo_description
)
values (
  coalesce(
    (select id from public.site_settings order by updated_at desc nulls last limit 1),
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  'Akınal İnşaat',
  '+90 000 000 00 00',
  '+90 000 000 00 00',
  'info@akinalinsaat.com',
  'İstanbul, Türkiye',
  null,
  null,
  null,
  null,
  'Akınal İnşaat; kentsel dönüşüm ve inşaat projelerinde güvenilir, planlı ve teknik çözümler sunar.',
  'Güvenli Yapılar, Değerli Yaşam Alanları',
  'Akınal İnşaat olarak kentsel dönüşüm, kat karşılığı inşaat ve anahtar teslim projelerde; planlama, ruhsat, uygulama ve teslim süreçlerini profesyonel şekilde yönetiyoruz.',
  'Merhaba, kentsel dönüşüm / inşaat hizmetleriniz hakkında bilgi almak istiyorum.',
  'Akınal İnşaat | Kentsel Dönüşüm ve İnşaat Hizmetleri',
  'Akınal İnşaat; kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme alanlarında güvenilir çözümler sunar.'
)
on conflict (id) do update set
  company_name = excluded.company_name,
  phone = excluded.phone,
  whatsapp_number = excluded.whatsapp_number,
  email = excluded.email,
  address = excluded.address,
  map_embed_url = excluded.map_embed_url,
  instagram_url = excluded.instagram_url,
  facebook_url = excluded.facebook_url,
  linkedin_url = excluded.linkedin_url,
  footer_description = excluded.footer_description,
  hero_title = excluded.hero_title,
  hero_subtitle = excluded.hero_subtitle,
  whatsapp_message = excluded.whatsapp_message,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description;

-- Verification:
-- select title, slug, is_published, is_featured, sort_order
-- from public.projects
-- order by sort_order;
