# Admin Web Push Notifications Report

## Result

Admin-only browser push notification support has been added. Logged-in admin users can opt in from Admin Settings, store the device subscription in MySQL, send a test notification, unsubscribe the current device, and receive a browser/Windows notification when a new public contact request is submitted.

The feature is never shown on public pages.

## Files Changed

- `public/admin-push-sw.js`
- `src/components/admin/AdminPushNotificationsPanel.tsx`
- `src/pages/admin/AdminSettings.tsx`
- `src/lib/apiClient.ts`
- `public_html/api/config.example.php`
- `public_html/api/contact-request.php`
- `public_html/api/admin/push-utils.php`
- `public_html/api/admin/push-subscribe.php`
- `public_html/api/admin/push-unsubscribe.php`
- `public_html/api/admin/send-push-test.php`
- `docs/admin-web-push-notifications-report.md`

## Endpoints Added

- `POST /api/admin/push-subscribe.php`
  - Requires an authenticated admin session.
  - With `{ "action": "config" }`, returns the configured VAPID public key status.
  - With a browser push subscription, stores or updates the device subscription.

- `POST /api/admin/push-unsubscribe.php`
  - Requires an authenticated admin session.
  - Removes the current device subscription by endpoint hash.

- `POST /api/admin/send-push-test.php`
  - Requires an authenticated admin session.
  - Sends a test notification to stored devices for the current admin.

## DB Tables/Fields Added

- `ak_push_subscriptions`
  - `id`
  - `admin_id`
  - `endpoint`
  - `endpoint_hash`
  - `p256dh`
  - `auth`
  - `user_agent`
  - `created_at`
  - `updated_at`
  - `last_used_at`

The table is created automatically by the admin push endpoints when needed.

## Browser Permission Flow

1. Admin opens `/admin/ayarlar`.
2. Admin clicks `Bu cihazda bildirimleri aç`.
3. Browser permission prompt appears.
4. If permission is granted, `/admin-push-sw.js` is registered.
5. Browser `PushManager` creates a device subscription.
6. Subscription is saved through `/api/admin/push-subscribe.php`.
7. The admin can send `Test Bildirimi` from the same panel.

If permission is blocked, the panel shows that browser notification permission must be changed in browser/site settings.

## VAPID Configuration

`public_html/api/config.php` must define real values copied from `config.example.php`:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

The current server implementation expects `VAPID_PRIVATE_KEY` as a PEM encoded prime256v1 EC private key.

## Validation Steps

1. Configure VAPID values in production `public_html/api/config.php`.
2. Open `/admin/ayarlar` while logged in as admin.
3. Click `Bu cihazda bildirimleri aç`.
4. Approve the browser permission prompt.
5. Confirm the panel shows `Bu cihazda açık`.
6. Click `Test Bildirimi`.
7. Confirm a browser/Windows notification appears.
8. Submit the public contact form.
9. Confirm the contact request is saved and an admin push notification is delivered.
10. Click `Bildirimleri Kapat` and confirm the device no longer receives test notifications.

## Known Limitations

- Web Push requires HTTPS in production. Localhost is the only browser exception.
- Browser or operating system notification settings can block delivery even when the subscription exists.
- If VAPID keys are missing, the admin panel disables opt-in and the contact form continues to work without push delivery.
- Push delivery depends on third-party browser push services and can fail for expired subscriptions; expired subscriptions are removed when the push service returns 404 or 410.
- The PHP sender is intentionally dependency-free and expects a PEM private key; teams using URL-safe VAPID private keys should convert them to PEM before configuring production.

## Result

Admin users can now enable browser push notifications per device, send a test notification from Admin Settings, and receive contact request alerts without exposing notification controls to public visitors.
