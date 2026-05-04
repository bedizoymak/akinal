
-- Restrict has_role execute (used only inside RLS / security-definer context)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Replace storage SELECT policy: only allow direct fetch (not bucket-wide listing)
DROP POLICY IF EXISTS "Public read project images" ON storage.objects;
CREATE POLICY "Public read individual project images"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images' AND name IS NOT NULL);
