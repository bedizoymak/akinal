# Admin QA Final Project Location Gap Fix Report

Date: 2026-06-01

## Problem

The new/edit project form still exposed two competing location inputs:

- `Konum`
- `İl` / `İlçe`

This made the location source of truth unclear and allowed `location`, `city`, and `district` to drift apart.

## Decision Applied

- Keep `İl` and `İlçe` as the user-editable inputs.
- Make `Konum` auto-generated and read-only from `İlçe + İl`.
- Preserve existing API fields:
  - `city`
  - `district`
  - `location`
- Preserve legacy `location` values for existing projects that do not yet have city/district data.

## Files Changed

- `src/pages/admin/AdminProjectEdit.tsx`
- `docs/admin-qa-final-project-location-gap-fix-report.md`

## Implementation

### Generated Location

Added a single generation path:

- If `district` and `city` exist: `location = "{district}, {city}"`
- If only `city` exists: `location = "{city}"`
- If neither exists but an old `location` value exists: keep the legacy `location`

### UI Change

The `Konum` input is now read-only and shown as a generated preview.

Admins can no longer manually type a different `Konum` while also selecting `İl` and `İlçe`.

### Save Behavior

Before saving, the form computes the final `location` from the selected `city` and `district`, falling back to legacy `location` only when no city/district-derived value exists.

The API payload still includes all existing fields, so backend contracts remain unchanged.

## Legacy Compatibility

Existing projects are safe:

- Projects with existing `location` but no `city`/`district` still display and save with the legacy location.
- Once an admin selects or changes `İl`/`İlçe`, the generated location becomes the source of truth.

## Validation

- Inspected `AdminProjectEdit.tsx` location state flow.
- Confirmed invalid known province/district combinations still use existing validation.
- Confirmed no API or database schema changes were introduced.
- Ran `npm run build` successfully.

## Result

The project form now has a clear location source of truth: admins choose `İl` and `İlçe`, and `Konum` is generated automatically for the existing `location` field.
