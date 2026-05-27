WITH brand_terms AS (
  SELECT
    U&'Ak\0131nal \0130n\015Faat' AS wrong_full,
    U&'Ak\0131nal' AS wrong_short,
    U&'AK\0130NAL \0130N\015EAAT' AS wrong_upper_full,
    U&'AK\0130NAL' AS wrong_upper_short
)
UPDATE public.site_settings
SET
  company_name = replace(replace(replace(company_name, brand_terms.wrong_upper_full, 'Akinal İnşaat'), brand_terms.wrong_full, 'Akinal İnşaat'), brand_terms.wrong_short, 'Akinal'),
  hero_title = replace(replace(replace(hero_title, brand_terms.wrong_upper_full, 'Akinal İnşaat'), brand_terms.wrong_full, 'Akinal İnşaat'), brand_terms.wrong_short, 'Akinal'),
  hero_subtitle = replace(replace(replace(hero_subtitle, brand_terms.wrong_upper_full, 'Akinal İnşaat'), brand_terms.wrong_full, 'Akinal İnşaat'), brand_terms.wrong_short, 'Akinal'),
  seo_title = replace(replace(replace(seo_title, brand_terms.wrong_upper_full, 'Akinal İnşaat'), brand_terms.wrong_full, 'Akinal İnşaat'), brand_terms.wrong_short, 'Akinal'),
  seo_description = replace(replace(replace(seo_description, brand_terms.wrong_upper_full, 'Akinal İnşaat'), brand_terms.wrong_full, 'Akinal İnşaat'), brand_terms.wrong_short, 'Akinal'),
  footer_description = replace(replace(replace(footer_description, brand_terms.wrong_upper_full, 'Akinal İnşaat'), brand_terms.wrong_full, 'Akinal İnşaat'), brand_terms.wrong_short, 'Akinal')
FROM brand_terms
WHERE
  company_name LIKE '%' || brand_terms.wrong_short || '%'
  OR company_name LIKE '%' || brand_terms.wrong_upper_short || '%'
  OR hero_title LIKE '%' || brand_terms.wrong_short || '%'
  OR hero_title LIKE '%' || brand_terms.wrong_upper_short || '%'
  OR hero_subtitle LIKE '%' || brand_terms.wrong_short || '%'
  OR hero_subtitle LIKE '%' || brand_terms.wrong_upper_short || '%'
  OR seo_title LIKE '%' || brand_terms.wrong_short || '%'
  OR seo_title LIKE '%' || brand_terms.wrong_upper_short || '%'
  OR seo_description LIKE '%' || brand_terms.wrong_short || '%'
  OR seo_description LIKE '%' || brand_terms.wrong_upper_short || '%'
  OR footer_description LIKE '%' || brand_terms.wrong_short || '%'
  OR footer_description LIKE '%' || brand_terms.wrong_upper_short || '%';
