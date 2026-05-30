# Public Frontend API Migration Report

## Summary

Phase 3 migrates only public read-only frontend data from Supabase to the same-domain PHP API. The admin panel, public write flows, Supabase packages, Supabase client files, routes, and visual design were intentionally left unchanged.

## Files Changed

- `src/lib/apiClient.ts`
- `src/lib/apiTypes.ts`
- `src/hooks/useSiteSettings.ts`
- `src/pages/site/Home.tsx`
- `src/pages/site/Projects.tsx`
- `src/pages/site/ProjectDetail.tsx`
- `docs/public-frontend-api-migration-report.md`

## Supabase Public Reads Replaced

- `site_settings` read in `useSiteSettings.ts`
- Published `projects` read in `Home.tsx`
- Published `projects` read in `Projects.tsx`
- Published project by `slug` read in `ProjectDetail.tsx`
- `project_images` read in `ProjectDetail.tsx`
- Published project sibling list read in `ProjectDetail.tsx`

## PHP Endpoints Now Used

- `GET /api/site-settings.php`
- `GET /api/projects.php`
- `GET /api/project-detail.php?slug=`

## What Was Intentionally Not Changed

- No admin panel files were migrated.
- No admin authentication was implemented.
- `src/pages/site/Contact.tsx` was not changed.
- `src/components/site/CookieConsent.tsx` was not changed.
- `src/components/site/SalesChatbot.tsx` was not changed.
- Supabase packages were not removed.
- Supabase client files were not removed.
- Supabase folder and scripts were not touched.
- Routes, visual design, layout, and styling were not changed.
- No real credentials were added.

## Known Limitations

- Public write flows still use Supabase or Supabase Edge Functions.
- Admin pages still use Supabase.
- The frontend now depends on the deployed PHP API being available at the same domain.
- Empty project data is expected until `ak_projects` and `ak_project_images` are populated.
- Project detail pages will show the existing not-found state when the PHP API returns 404.

## Manual Test Checklist

- Home page loads without Supabase public project reads.
- Projects page loads with an empty project list.
- Project detail page shows not found for a missing slug.
- Site settings render from `/api/site-settings.php`.

## Next Recommended Phase

1. Migrate public writes:
   - `POST /api/contact-request.php`
   - `POST /api/cookie-consent.php`
2. Implement admin auth:
   - `POST /api/admin/login.php`
   - `POST /api/admin/logout.php`
   - `GET /api/admin/me.php`
3. Begin admin CRUD migration after session protection exists.
