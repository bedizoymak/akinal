# Admin Web Push JWT Fix Report

## Root Cause

FCM returned `permission denied: invalid JWT provided` because the VAPID JWT signature was being converted from OpenSSL DER format to raw ES256 format with an incorrect ASN.1 offset.

OpenSSL returns ECDSA signatures as a DER sequence:

- `SEQUENCE`
- `INTEGER r`
- `INTEGER s`

The previous parser started reading the `r` length at the wrong byte, which could produce an invalid raw `r || s` signature. FCM then rejected the VAPID authorization JWT even when the subscription and configured keys were otherwise valid.

## Files Changed

- `public_html/api/admin/push-utils.php`
- `public_html/api/admin/push-debug.php`
- `docs/admin-web-push-jwt-fix-report.md`

## Changes Made

- Replaced the DER-to-raw ES256 signature conversion with a proper DER sequence parser.
- Added padding/trimming for `r` and `s` signature parts to exactly 32 bytes each.
- Centralized VAPID audience generation from the push endpoint origin.
- Added full provider response body and response headers to failed push diagnostics.
- Added debug output for:
  - `audience`
  - `endpoint_host`
  - `vapid_public_fingerprint`
- Added the same `audience` value to each stored subscription diagnostic entry.

## VAPID Verification Points

- `audience` is derived from the push endpoint origin only, for example:
  - Endpoint: `https://fcm.googleapis.com/fcm/send/...`
  - Audience: `https://fcm.googleapis.com`
- `VAPID_SUBJECT` remains a valid `mailto:` subject.
- `vapid.public_private_key_match` confirms that `VAPID_PUBLIC_KEY` matches the configured private key.
- `vapid_public_fingerprint` allows production checks without exposing the real public or private key.

## Validation Steps

1. Deploy the updated PHP files.
2. Open `/api/admin/push-debug.php` while logged in as admin.
3. Confirm:
   - `vapid_config_present` is `true`.
   - `vapid.private_key_valid` is `true`.
   - `vapid.public_private_key_match` is `true`.
   - `endpoint_host` is `fcm.googleapis.com` for Chrome/Edge subscriptions.
   - `audience` is `https://fcm.googleapis.com`.
4. In `/admin/ayarlar`, click `Test Bildirimi`.
5. Confirm the test notification succeeds.
6. If it still fails, inspect:
   - API response `errors[0].response`
   - API response `errors[0].response_headers`
   - `/api/admin/push-debug.php` `last_push_error`
7. If keys were changed after subscription, unsubscribe and re-enable notifications on the device.

## Result

The VAPID JWT signing path now produces a valid ES256 raw signature for FCM, and the debug endpoint exposes the exact audience, endpoint host, key fingerprint, and provider response needed for any remaining production diagnosis.
