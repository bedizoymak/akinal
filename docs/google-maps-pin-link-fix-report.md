# Google Maps Pin Link Fix Report

## Overview
This report documents the fix applied to the Google Maps linking utility, ensuring that dynamically generated addresses correctly route users to a Google Maps pin.

## Details

- **Files inspected:**
  - `src/hooks/useSiteSettings.ts`
  - `docs/full-project-audit-gemini-real.md` (for CSP references)

- **Files modified:**
  - `src/hooks/useSiteSettings.ts`

- **Exact changes made:**
  - Added the `getMapsLink` utility function to properly encode addresses and utilize the official Google Maps Search API endpoint for pinning locations.
  - Replaced hardcoded map embed logic with dynamic query construction based on the `address` field from site settings.

- **Old URLs:**
  - `https://www.google.com/maps?hl=tr&q=${encodeURIComponent(CONTACT_ADDRESS)}&z=17&output=embed`

- **New URLs:**
  - `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`

- **Build result:**
  - The project builds successfully with no TypeScript errors. The new map link generation is pure function-based and safe against `null` or `undefined` inputs.

- **Commit hash:**
  - `eeb2665afd8ad10990407983f4bd4812b7976bf7` (and subsequent refinements up to `dc664a7663426ffae6621ac61f993c1e373c22ce`)
