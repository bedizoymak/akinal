# Phase A Admin Migration Report

Date: 2026-05-30

## Scope

Implemented Phase A only:

- Admin Settings migration
- Admin Projects migration
- Admin Media migration

CRM, Finance, and Reports were not migrated.

## Result

The public website content that depends on site settings, projects, and project images is now manageable from the admin panel through PHP + MySQL instead of Supabase.

## Migrated Modules

### Admin Settings

- Frontend: `src/pages/admin/AdminSettings.tsx`
- Previous source: Supabase `site_settings`
- New source: PHP API + MySQL `ak_site_settings`
- New API client functions:
  - `getAdminSiteSettings`
  - `updateAdminSiteSettings`
- New endpoint:
  - `GET/PATCH /api/admin/site-settings.php`

### Admin Projects

- Frontend:
  - `src/pages/admin/AdminProjects.tsx`
  - `src/pages/admin/AdminProjectEdit.tsx`
  - `src/features/admin/projects/projectImportExport.ts`
- Previous source:
  - Supabase `projects`
  - Supabase `project_images`
  - Supabase Storage `project-images`
- New source:
  - MySQL `ak_projects`
  - MySQL `ak_project_images`
  - Local PHP upload path `/uploads/project-images`
- New API client functions:
  - `getAdminProjects`
  - `getAdminProject`
  - `createAdminProject`
  - `updateAdminProject`
  - `deleteAdminProject`
  - `getAdminProjectImages`
  - `createAdminProjectImage`
  - `updateAdminProjectImage`
  - `deleteAdminProjectImage`
  - `uploadAdminProjectImage`
- New endpoints:
  - `GET/POST/PATCH/DELETE /api/admin/projects.php`
  - `GET/POST/PATCH/DELETE /api/admin/project-images.php`
  - `POST /api/admin/upload-project-image.php`

### Admin Media

- Frontend: `src/pages/admin/AdminMedia.tsx`
- Previous source: Supabase `project_images` joined with `projects`
- New source: PHP API + MySQL `ak_project_images` joined with `ak_projects`
- New API client functions:
  - `getAdminMedia`
  - `deleteAdminMediaImage`
- New endpoint:
  - `GET/DELETE /api/admin/media.php`

## Supabase Removal In Phase A Modules

No Supabase imports remain in these Phase A modules:

- `src/pages/admin/AdminSettings.tsx`
- `src/pages/admin/AdminProjects.tsx`
- `src/pages/admin/AdminProjectEdit.tsx`
- `src/pages/admin/AdminMedia.tsx`
- `src/features/admin/projects/projectImportExport.ts`

Supabase remains elsewhere in the application for non-Phase-A areas such as CRM, Finance, Reports, notifications, and the sales chatbot.

## Security And Runtime Notes

- New admin PHP endpoints call `require_admin()` and rely on the existing PHP session authentication flow.
- Uploads accept JPG, PNG, WEBP, and GIF files.
- Uploaded project images are stored under `public_html/uploads/project-images`.
- Existing image URL handling is preserved. Existing Supabase-hosted image URLs can continue to render as stored URLs while new uploads use local `/uploads/project-images/...` URLs.

## Verification

- Ran `npm run build`.
- Build completed successfully.

## Remaining Work Outside Phase A

- CRM pages still depend on Supabase.
- Finance pages still depend on Supabase.
- Reports still depend on Supabase.
- Notifications still depend on Supabase.
- Payment and expense document uploads still depend on Supabase Storage.
- Public sales chatbot still depends on a Supabase Edge Function.
