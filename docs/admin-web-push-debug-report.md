# Admin Web Push Debug Report

## Result

Admin web push diagnostics were added so a failed test notification no longer only reports `0 successful, 1 failed`. The send path now records and returns the exact push failure details, including provider HTTP status, response body, endpoint host, endpoint hash, and exception messages.

## Files Changed

- `public_html/api/admin/push-utils.php`
- `public_html/api/admin/send-push-test.php`
- `public_html/api/admin/push-debug.php`
- `src/lib/apiClient.ts`
- `src/components/admin/AdminPushNotificationsPanel.tsx`
- `docs/admin-web-push-debug-report.md`

## Root Cause

The immediate root cause was insufficient diagnostics in the Web Push sender. Failed push requests were counted, but the provider response and local exception message were not returned to the API caller or saved anywhere useful.

The new diagnostics will identify the delivery-level root cause on the production server. The most likely production causes for an existing subscription with `0 successful, 1 failed` are:

- The subscription was created with a different `VAPID_PUBLIC_KEY` than the current server config.
- `VAPID_PRIVATE_KEY` does not match `VAPID_PUBLIC_KEY`.
- The service worker file is not deployed at `/admin-push-sw.js`.
- The browser push service rejected the encrypted payload or authorization header.
- The stored subscription is stale or revoked by the browser.

## Endpoint Added

- `GET /api/admin/push-debug.php`
  - Requires authenticated admin session.
  - Returns:
    - `subscription_count`
    - `service_worker_detected`
    - `vapid_config_present`
    - `vapid`
    - `subscriptions`
    - `last_push_error`

Sensitive subscription secrets are not returned. Diagnostics expose only presence, lengths, endpoint host, endpoint hash, timestamps, and user agent.

## API Response Changes

- `POST /api/admin/send-push-test.php`
  - Now returns `errors` for failed subscriptions.
  - Records the last push failure in a temporary server file.
  - Logs failures through PHP `error_log`.

Example failure payload:

```json
{
  "sent": 0,
  "failed": 1,
  "skipped": false,
  "errors": [
    {
      "endpoint_host": "fcm.googleapis.com",
      "status": 401,
      "error": null,
      "response": "UnauthorizedRegistration"
    }
  ]
}
```

## Validation Steps

1. Open `/admin/ayarlar` as an authenticated admin.
2. Click `Test Bildirimi`.
3. If delivery fails, confirm the toast shows the returned provider error.
4. Open `/api/admin/push-debug.php` in the same authenticated browser session.
5. Confirm:
   - `subscription_count` is greater than 0.
   - `service_worker_detected` is `true`.
   - `vapid_config_present` is `true`.
   - `vapid.public_private_key_match` is `true`.
   - `subscriptions[0].has_p256dh` and `subscriptions[0].has_auth` are `true`.
   - `last_push_error.error.response` or `last_push_error.error.message` contains the exact failure reason.
6. If `public_private_key_match` is `false`, replace the VAPID pair in `config.php`.
7. If the VAPID pair was changed after subscribing, click `Bildirimleri Kapat`, then `Bu cihazda bildirimleri aç` to recreate the subscription.

## Result

The system now has actionable diagnostics for admin Web Push delivery failures. The production server can report whether the problem is VAPID configuration, service worker deployment, stale subscription data, or provider rejection.
