ALTER TABLE public.site_settings
  ALTER COLUMN address SET DEFAULT 'Molla Gürani Mah. Sarı Musa Sk. NO:49/A 34349 Fatih/İstanbul/Türkiye';

UPDATE public.site_settings
SET address = 'Molla Gürani Mah. Sarı Musa Sk. NO:49/A 34349 Fatih/İstanbul/Türkiye'
WHERE address IS NULL
  OR btrim(address) = ''
  OR address = 'İstanbul, Türkiye';
