CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_status TEXT NOT NULL CHECK (consent_status IN ('accepted', 'rejected', 'managed')),
  necessary BOOLEAN NOT NULL DEFAULT true,
  analytics BOOLEAN NOT NULL DEFAULT false,
  marketing BOOLEAN NOT NULL DEFAULT false,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone inserts cookie consent" ON public.cookie_consents;
CREATE POLICY "Anyone inserts cookie consent"
  ON public.cookie_consents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (necessary = true);
