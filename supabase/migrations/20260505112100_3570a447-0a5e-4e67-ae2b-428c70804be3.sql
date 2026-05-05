
-- Recreate admin policies restricted to authenticated role to avoid anon evaluating private.has_role
DROP POLICY IF EXISTS "Admins manage projects" ON public.projects;
DROP POLICY IF EXISTS "Admins view all projects" ON public.projects;
CREATE POLICY "Admins manage projects" ON public.projects AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all projects" ON public.projects AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage images" ON public.project_images;
DROP POLICY IF EXISTS "Admins view all images" ON public.project_images;
CREATE POLICY "Admins manage images" ON public.project_images AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all images" ON public.project_images AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view contacts" ON public.contact_requests;
DROP POLICY IF EXISTS "Admins manage contacts" ON public.contact_requests;
DROP POLICY IF EXISTS "Admins delete contacts" ON public.contact_requests;
CREATE POLICY "Admins view contacts" ON public.contact_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage contacts" ON public.contact_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete contacts" ON public.contact_requests AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage media" ON public.media_library;
CREATE POLICY "Admins manage media" ON public.media_library AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins insert settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins update settings" ON public.site_settings;
CREATE POLICY "Admins insert settings" ON public.site_settings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update settings" ON public.site_settings AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
