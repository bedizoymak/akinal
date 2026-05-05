CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM public;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

ALTER POLICY "Admins delete contacts" ON public.contact_requests
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage contacts" ON public.contact_requests
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins view contacts" ON public.contact_requests
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage media" ON public.media_library
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins view all profiles" ON public.profiles
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage images" ON public.project_images
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins view all images" ON public.project_images
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage projects" ON public.projects
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins view all projects" ON public.projects
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins insert settings" ON public.site_settings
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins update settings" ON public.site_settings
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage roles" ON public.user_roles
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins view all roles" ON public.user_roles
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public;