# Admin Notification Center Fix Report

Date: 2026-05-31

## Problem Summary

- The admin header bell showed an unread count but did not render recent notification rows.
- Opening or clicking notifications could show stale data because the dropdown and `/admin/bildirimler` page loaded different sources and did not refresh each other.
- The notifications page allowed single delete and mark-all-read, but did not provide a delete-all action.

## Root Causes

- `NotificationBell` only called the dashboard summary endpoint, so it knew the unread count but never fetched notification content.
- Notification state was local to each component with no shared refresh signal after read/delete actions.
- `GET /api/admin/notifications.php` generated payment reminder notifications while reading, which could make delete-all appear to fail by immediately recreating notification rows.
- The PHP API supported single delete only.

## Files Changed

- `src/components/admin/NotificationBell.tsx`
- `src/pages/admin/AdminNotifications.tsx`
- `src/hooks/useNotifications.ts`
- `src/lib/apiClient.ts`
- `src/lib/apiTypes.ts`
- `public_html/api/admin/notifications.php`
- `docs/admin-notification-center-fix-report.md`

## Components Changed

- `NotificationBell`
  - Fetches the latest 5 notifications from `/api/admin/notifications.php?limit=5`.
  - Renders title, message, created date, and unread state.
  - Shows `Henüz bildirim bulunmuyor` when empty.
  - Refreshes when opened and when notification mutations happen elsewhere.

- `AdminNotifications`
  - Keeps all notification details visible.
  - Adds `Tüm Bildirimleri Sil` at the top of the page.
  - Adds a confirmation dialog with `Tüm bildirimleri silmek istediğinize emin misiniz?`.
  - Refreshes list state and empty state immediately after delete-all.

- `useNotifications`
  - Normalizes read/unread state.
  - Adds a shared browser event for immediate refresh across the page and dropdown.
  - Adds `removeAll()`.

## API And Endpoints

Modified `GET /api/admin/notifications.php`:

- Supports `limit`.
- Returns:
  - `notifications`
  - `unread_count`
  - `total_count`

Modified `DELETE /api/admin/notifications.php`:

- Existing single-delete behavior remains.
- Added delete-all support with `?all=1` or `{ "all": true }`.

Changed reminder generation:

- Payment reminder generation is now explicit with `?generate=1` instead of running on every list read.
- This prevents delete-all from being immediately repopulated by a read request.

## Validation Steps

- Ran `npm run build` successfully.
- Verified notification client methods and components reference the updated API flow.
- Verified the dropdown and page both listen for the shared notification refresh event.
- Attempted PHP lint for `public_html/api/admin/notifications.php`; PHP CLI is not installed in this environment.

## Known Limitations

- Browser console and authenticated API behavior must be validated on the deployed/admin environment because this shell does not have an authenticated admin browser session.
- Automatic payment reminder generation is no longer triggered by passive reads; call the endpoint with `?generate=1` if reminder generation is needed as an explicit job/action.

## Result

The notification dropdown now displays recent notifications instead of only an unread count, read/delete mutations synchronize between the dropdown and page, and admins can delete all notifications after confirmation.
