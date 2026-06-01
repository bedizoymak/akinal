# Admin QA Phase 4 Project Location UX Fix Report

Date: 2026-06-01

QA source: `C:\Users\Ebru\Downloads\Admin syfs.pdf`

## Problem Summary

Phase 4 focused only on the New/Edit Project form location UX:

- Province (`İl`) was a free-text input.
- District (`İlçe`) was a free-text input.
- Invalid province/district combinations could be saved.
- Province and district selection was not searchable.

Finance, exports, charts, personnel, customer creation, API contracts, and the project data model were not changed.

## Files Changed

- `src/pages/admin/AdminProjectEdit.tsx`
- `src/lib/turkeyLocations.ts`

## Fixes Implemented

### Province Selection

- Replaced the free-text province input with a searchable combobox.
- Province options use the existing `city` field, so the API payload remains unchanged.
- Existing projects with a custom/legacy city value keep that value as an extra selectable option.

### District Selection

- Replaced district free text with a searchable combobox for provinces with known district lists.
- District options are filtered by the selected province.
- Changing province clears a district that does not belong to the new province.
- For provinces without a bundled district list, the form keeps a district text input so existing workflows are not blocked.

### Invalid Combination Prevention

- Save now validates known province/district pairs.
- If a selected district is not valid for the selected province, save is blocked with a clear admin error.
- Existing projects continue working because custom legacy values are preserved in the UI.

### Selection Flow

- If `Konum` is empty or was previously auto-generated, province/district selection fills it as:
  - `İlçe, İl`
- If the admin manually edits `Konum`, the form preserves that manual value.

## Data Model / API Impact

- No API endpoint was changed.
- No database fields were changed.
- Existing fields are still used:
  - `city`
  - `district`
  - `location`

## Validation

- `npm run build` passed.
- Existing custom project city values are kept in the province options.
- Known district lists prevent invalid province/district pair saves.

## Known Limitations

- The bundled district dataset currently covers the primary active project regions: İstanbul, Ankara, İzmir, Kocaeli, Bursa, and Antalya.
- Other provinces remain selectable and allow district text entry until a complete district dataset is added.

## Result

Phase 4 location UX fixes are complete. The project form now has searchable province/district selection, protects known province/district combinations, preserves existing project data, and keeps the current API/data model intact.
