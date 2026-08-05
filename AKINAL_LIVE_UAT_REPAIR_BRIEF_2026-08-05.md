# Akınal İnşaat — Live UAT Repair Execution Brief

**Prepared:** 2026-08-05  
**Live UAT continuation:** 2026-08-05 — browser recovery and remaining control coverage  
**Target:** Production admin panel and public website at `akinalinsaat.com`  
**Audience:** Claude Code working in `C:\Users\Bediz\Documents\akinalinsaat.com`  
**Purpose:** Repair the defects proven during a live, end-to-end owner/operator acceptance test. Execute the work in phases, avoid duplicate investigation, and do not widen the scope.

---

## 1. Operating Order

Work only in:

```text
C:\Users\Bediz\Documents\akinalinsaat.com
```

Treat this document as the complete repair order. Do not invent extra product work, redesign unrelated screens, or repeat an issue in multiple phases.

### Non-negotiable rules

1. Inspect the actual frontend, PHP API, database schema, migrations, and existing tests before changing behavior. Do not guess field names, endpoints, or root causes.
2. Preserve all real production records. Never edit, delete, reassign, or normalize a non-QA record while testing a fix.
3. Do not perform broad SQL cleanup. Any production data correction must be narrowly scoped, idempotent, backed up first, and supported by a before/after reconciliation query.
4. Do not weaken validation, authentication, CSRF protection, upload validation, backup verification, or audit logging to make a test pass.
5. Do not expose secrets, database credentials, Drive credentials, `BACKUP_ENCRYPTION_KEY`, session data, or backup contents in logs, commits, test fixtures, or reports.
6. Use existing project conventions and the normal DIFF deployment process. Do not deploy `uploads/` and do not overwrite user-uploaded media.
7. Keep unrelated local changes out of every commit. The working tree already contains unrelated edits.
8. Complete phases in order. Once an issue is fixed and its acceptance tests pass, do not reopen or reimplement it in a later phase unless a regression proves it necessary.
9. After each phase: run the relevant automated checks, PHP syntax checks, frontend build/tests, and focused live smoke test; then report evidence before continuing.
10. If the observed UI and the code disagree, trust reproducible evidence and trace the exact request, response, persistence layer, and aggregation query.

### Protected real records — do not modify

- Project: `DEDEPAŞA SOKAK KENTSEL DÖNÜŞÜM PROJESİ`
- Customer: `Salih Elüstü`
- Supplier: `eclipse mühendislik`
- Personnel: `Bediz`
- Existing government-progress cards for Salih, Burak, and Naciye

### QA records used during the live test

| Entity | Name / ID |
|---|---|
| Project | `QA UAT 20260805 - Güneş Apartmanı` — `a75bd005-088e-4b04-8c1f-b699773f0e1b` |
| Public slug | `qa-uat-20260805-gunes-apartmani` |
| Customer | `QA Test Müşteri` — `afdff20f-b26c-4864-8f8c-18499574bb54` |
| Supplier | `QA TEST - Atlas Yapı Malzemeleri` — `0fd634bd-d2c8-4fd2-9610-a2cfd0834962` |
| Personnel | `QA UAT 20260805 - Ahmet Usta` — `56622f9a-548f-4c9b-9059-2b4a08e15f8d` |
| Expense card | `QA UAT 20260805 - Malzeme ve Şantiye Giderleri` — `0bcf4b7a-8996-4121-832d-dfe6a89c0ccb` |
| Media album | `QA UAT 20260805` |

Do not delete these QA records until all regression tests are complete. They form a connected test graph.

---

## 2. Proven Financial Test Data

Use these values as reconciliation fixtures. Do not silently substitute rounded or planned amounts for realized amounts.

### Customer income

| Record | Classification | Planned | Realized | Expected remaining |
|---|---:|---:|---:|---:|
| `QA UAT Resmî Sözleşme Tahsilatı` | Official, TRY | ₺185,000.00 | ₺55,000.00 | ₺130,000.00 |
| `QA UAT Gayri Resmî Euro Tahsilatı` | Unofficial, EUR; manual rate 54.95 | €10,000 / ₺549,500.00 | €3,500 / ₺192,325.00 | ₺357,175.00 |
| `QA UAT Devlet Kentsel Dönüşüm Hakedişi` | Government progress payment | ₺425,000.00 | ₺127,500.00 | ₺297,500.00 |

### Outgoing expense

| Record | Classification | Planned | Realized | Expected remaining |
|---|---:|---:|---:|---:|
| `QA UAT C30 Beton ve Donatı Malzemesi` | Supplier, official | ₺480,000.00 | ₺180,000.00 | ₺300,000.00 |
| `QA UAT Şantiye Elektrik ve İskele Gideri` | Expense card, unofficial | ₺95,000.00 | ₺95,000.00 | ₺0.00 |

### Canonical expected QA project totals after the stage payment

| Metric | Expected |
|---|---:|
| Planned income | ₺1,159,500.00 |
| Realized income | ₺374,825.00 |
| Remaining receivable | ₺784,675.00 |
| Planned expense | ₺575,000.00 |
| Realized expense | ₺275,000.00 |
| Realized profit | ₺99,825.00 |

The project-finance page and the canonical `Gelenler` / `Net Durum` ledgers currently produce these values correctly.

---

## 3. Confirmed Working — Preserve These Behaviors

These workflows passed live UAT. Do not refactor them merely because adjacent code is being repaired.

1. A project with a valid image can be created, published, and viewed on its public project URL.
2. New project/media uploads now receive exactly one MIME-derived extension. The QA upload is a valid single-extension `.jpg`.
3. Media album creation, moving the QA image into the album, favorite toggle, and copy-URL actions work.
4. Project list search, project-type filter, publication filter, and CSV export work.
5. Project duplication creates an unpublished draft and does not duplicate finance records.
6. The global government-progress collection path works: selecting `Su Basmanı` creates the full ₺127,500 stage collection, updates the card to 30%, marks stage 1/16 complete, and records the movement.
7. `Gelenler`, `Gidenler`, `Net Durum`, and the QA project-finance page correctly include official, unofficial, supplier, expense-card, and government-stage amounts.
8. The inflation calculator works with 259 TCMB records through 2026-07. The live check produced ₺164,687.75 from ₺125,000 for July 2025 to July 2026, a 31.7502% increase.
9. Site-settings dirty-state and reset behavior works: editing enables Save/Reset, and Reset restores the persisted value without saving.
10. Backup Center can list verified Drive packages and recent automated runs.
11. Notification-page search, type, priority, and unread-only filters work in the zero-record state; the header notification tray also opens and shows the same empty state.
12. Customer search/type/project/balance filters work. `Gelenler` and `Gidenler` search, status, project, source/account-type, date-range, sort, and reset controls work and recalculate their summaries correctly.
13. Customer, supplier, personnel, supplier-payment, and expense-card edit dialogs open with the QA values and cancel without changing persisted data.
14. Project import opens a single-file chooser; cancelling without selecting a file inserts no record. The QA project can be unpublished and republished, with counters and success feedback updating correctly.
15. Project, customer, supplier, personnel, and expense-card QA records remain present; the temporary duplicated QA project was deleted and the original QA project was restored to published state.

---

## 4. Severity Summary

| ID | Severity | Area | Proven problem |
|---|---|---|---|
| P0-1 | Critical | Public/admin contact | Security verification is required but no CAPTCHA/security widget renders; the admin contact loader also fails and disguises the API failure as a normal empty state. |
| P0-2 | Critical | Financial dashboard | Dashboard totals use a different/incorrect aggregation: they omit the new government collection and include an unexplained extra ₺55,000. |
| P0-3 | Critical | Payment persistence | Manually entered payment dates and CPI base dates do not persist correctly. |
| P0-4 | Critical | Government progress creation | Initial create/edit form reports success while discarding stage, paid amount, and date fields. |
| P1-1 | High | Personnel operations | Project/personnel selectors, roles, cost periods, and project assignments fail to load; a QA cost-period create also fails. |
| P1-2 | High | Project expenses | Project list links to a deprecated expense screen that fails to load records. |
| P1-3 | High | Account classification | Adding from the unofficial customer tab defaults the dialog to Official. |
| P1-4 | High | Map settings | The stored map value includes iframe attributes, producing a malformed encoded iframe URL while the UI reports the map as active. |
| P1-5 | High | Media integrity | A legacy double-extension image remains marked in use even though the physical file is absent. |
| P2-1 | Medium | Project authoring | Draft save requires a main image without a required marker; draft preview opens a public 404-like state. |
| P2-2 | Medium | Dashboard activity | Recent-movement rows mislabel party/type/currency and display planned instead of realized amounts. |
| P2-3 | Medium | Notifications | Dashboard reports four upcoming collections, while admin notifications contain zero items. |
| P2-4 | Medium | Backup dates | One backup is displayed as three inconsistent times across history, package UTC name, and audit records. |
| P2-5 | High | Government-progress filtering | Filters reduce the visible cards but the summary KPIs remain global, producing a misleading filtered financial view. |
| P3-1 | Low/Medium | UX/accessibility | Duplicate unlabeled icon buttons, duplicate personnel detail links, indistinguishable maintenance buttons, and generic card headings. |
| P3-2 | Low/Medium | Feedback | Some successful creates keep dialogs open briefly or provide no success toast. |

---

# Phase 0 — Evidence Baseline and Safety Harness

## Goal

Create a reproducible baseline before changing production behavior. This phase does not fix features.

## Required work

1. Map every affected UI action to its frontend component, PHP endpoint, table(s), and aggregation query.
2. Record the current response payloads and database rows for the QA records only.
3. Add focused automated fixtures for the QA amounts in Section 2. Tests must calculate planned, paid, remaining, account classification, currency conversion, and government-stage totals independently.
4. Create one reconciliation test that asserts the same realized-income total across:
   - Dashboard
   - `Gelenler`
   - `Net Durum`
   - Project finance
5. Create a safe database diagnostic query for duplicate/orphan customer-payment rows associated with the QA customer/project. It must identify the unexplained ₺55,000 without deleting anything.
6. Document the exact timezone convention used by:
   - PHP/server timestamps
   - Database timestamps
   - GitHub Actions UTC schedule
   - Package names ending in `Z`
   - Browser display in Türkiye time

## Acceptance gate

- The baseline tests fail for the currently proven defects and pass for the confirmed-working flows.
- No production row changes in this phase.
- Report the exact root cause for each P0 item before implementing Phase 1.

---

# Phase 1 — Critical Submission and Financial Integrity

Complete the four P0 items in this phase only.

## P0-1: Restore public contact-form security verification

### Observed evidence

- Public `/iletisim` form accepts name, phone, email, service, and message.
- Submission is blocked with: `Güvenlik doğrulaması gerekli — Lütfen formu göndermeden önce güvenlik doğrulamasını tamamlayın.`
- The page contains one iframe and it is the map.
- There is no Turnstile/reCAPTCHA/security iframe or widget node in the rendered DOM.
- No contact request reaches the admin requests page.
- Admin `/admin/talepler` logs `ApiError: İletişim talepleri işlenemedi.` while the UI renders `Talep bulunamadı` as if the request succeeded and returned zero rows.
- Because both submission and admin retrieval are broken, repairing only the public widget is insufficient.

### Required fix

1. Determine which security provider/configuration the backend actually validates.
2. Render the matching widget on the public form and fail gracefully when its public configuration is absent.
3. Keep server-side token verification mandatory. Do not bypass the check or accept a missing token.
4. Add accessible loading, failure, expired-token, and retry states.
5. Never log the token or secret key.
6. Trace and repair the admin contact-list endpoint independently from the public submission endpoint.
7. Distinguish a successful zero-row response from an API failure; never render a failed request as a normal empty state.

### Acceptance tests

- With the widget configured, a valid verification allows exactly one request to be created.
- Missing, expired, reused, or invalid tokens are rejected server-side.
- A visitor can see and operate the security control.
- A network/configuration failure produces a professional actionable message, not an impossible form.
- Duplicate clicking does not create duplicate requests.
- The created QA request appears exactly once in `/admin/talepler` and can be found with search/status filters.
- A forced admin API failure produces a visible retryable error, while a successful zero-row response produces the normal empty state.

## P0-2: Unify dashboard financial aggregation

### Observed evidence after the ₺127,500 government-stage collection

| Screen | Realized income | Realized expense | Net |
|---|---:|---:|---:|
| Canonical `Net Durum` | ₺8,374,825.00 | ₺1,275,000.00 | ₺7,099,825.00 |
| Dashboard | ₺8,302,325.00 | ₺1,275,000.00 | ₺7,027,325.00 |

Before that stage collection, the dashboard was ₺55,000 above the canonical ledger. After it, the dashboard is ₺72,500 below it. This proves that the dashboard omits the ₺127,500 government collection while still including an unexplained extra ₺55,000.

### Required fix

1. Trace all dashboard income sources. Remove parallel/legacy aggregation logic and reuse one canonical financial service/query.
2. Include realized customer payments and realized government-stage collections exactly once.
3. Exclude planned-only values from realized totals.
4. Identify the extra ₺55,000 row/query path with evidence. If it is an orphan/duplicate created by the earlier failed UI attempt, prepare a narrowly targeted, idempotent correction after a backup and report the exact row identity before applying it.
5. Make dashboard, charts, monthly summary, cards, and recent activity use the same normalized data contract.

### Acceptance tests

- Dashboard, `Gelenler`, `Net Durum`, and project finance return equal realized totals for identical filters/cutoff dates.
- The QA project realized income is ₺374,825.00 and realized profit is ₺99,825.00.
- Government-stage collection appears exactly once.
- No planned receivable is counted as collected.
- Existing real records reconcile before and after the change.

## P0-3: Persist payment and CPI dates exactly

### Observed evidence

- Official payment date was manually set to `2026-07-20`; the saved record displayed `2026-08-05`.
- CPI base date was set to `2026-01-01`; save returned success, but reopening showed it empty.
- CPI preview then complained that the base date was after or equal to the calculation date.

### Required fix

1. Trace the date value from input state to request payload, PHP parsing, SQL binding, response serialization, and edit-form hydration.
2. Use a single date-only representation (`YYYY-MM-DD`) without UTC conversion for business dates.
3. Distinguish business dates from timestamp/audit fields.
4. Do not substitute `today` when a valid explicit date exists.
5. A success response is allowed only after the persisted row is re-readable with the submitted values.

### Acceptance tests

- Create and edit official/unofficial payment dates across month/year boundaries and reopen them unchanged.
- Persist CPI base date, reopen it, and calculate successfully.
- Türkiye timezone does not move a date forward or backward.
- Invalid ordering is rejected before save with a field-level message.

## P0-4: Make initial government-progress form truthful and atomic

### Observed evidence

The initial create/edit form visibly contained:

- Stage: `Su Basmanı (%30)`
- Planned amount: ₺425,000
- Paid amount: ₺125,000
- Due date: `2026-09-30`
- Payment date: `2026-08-05`

Create and edit both returned success, but the card initially persisted no paid amount and no dates; the customer view also showed an unspecified stage. The separate global stage-collection dialog later worked correctly and created a full ₺127,500 stage movement.

### Required fix

Choose and implement one coherent model after inspecting the intended schema:

- **Preferred:** the card form creates the plan/card only, and all realized money is created through stage-collection movements. Remove paid/payment-date fields from card creation so the UI cannot promise unsupported behavior; or
- If the product intentionally supports an initial partial payment, persist it atomically as a real collection movement with the selected stage, date, amount, and audit trail.

Do not keep a form that accepts values and silently discards them. Align create, edit, customer detail, global progress page, project finance, and audit history.

### Acceptance tests

- Every visible editable field either persists and reopens or is removed from the form.
- Success is emitted only after the card and any collection movement commit atomically.
- Rollback occurs if either part fails.
- Stage totals cannot exceed card total or stage allocation.
- The working global full-stage collection behavior remains intact.

## Phase 1 gate

- All P0 tests pass.
- Cross-screen financial totals reconcile.
- Contact submission succeeds with a real rendered security widget and remains secure.
- Deploy only Phase 1 files through DIFF; then commit/push only those files and report the commit hash.

---

# Phase 2 — Relationships and Core Operational Workflows

## P1-1: Repair project/personnel allocation in both directions

### Observed evidence

- Personnel allocation page displays `Tahsisat verileri yüklenemedi.`
- `Tahsisat Ekle` on the personnel page has zero project options.
- `Personel Tahsisatı Ekle` on project edit has zero personnel options.
- The project edit page sometimes displays `Personel maliyet verileri yüklenemedi.`
- QA personnel detail displays `Roller yüklenemedi`, `Maliyet dönemleri yüklenemedi`, and `Proje atamaları yüklenemedi`; each failed request is then misleadingly rendered as `Henüz ... yok`.
- `Rol Ekle` and `Proje Ataması Ekle` open, but their listboxes contain zero options.
- Submitting a QA cost period with salary, SGK, meal, transport, bonus, and other-cost values returns `Maliyet dönemi oluşturulamadı / Maliyet dönemi işlemi tamamlanamadı`; no row is created.
- The attempted cost-period start date `2026-08-01` returns to `2026-08-05` after the failed submission.
- The generic personnel financial-movement dialog can load both projects, which isolates the failure to personnel-domain roles/cost-period/allocation endpoints rather than the canonical project list.
- Because no allocation can be created, labor days/costs cannot be linked to the QA project.

### Required fix

1. Trace the personnel roles, cost periods, project assignments, and both allocation selectors through their frontend calls, PHP endpoints, authorization checks, and schema.
2. Use one allocation service and one consistent relation schema from both entry points.
3. Populate active projects/personnel and configured roles, excluding only genuinely ineligible records.
4. Persist allocation dates, role, rate/cost, workday data, and cost-period components according to the existing product model.
5. Prevent duplicate overlapping allocations and cost periods with clear validation messages.
6. Preserve date-only values exactly and do not reset a submitted business date to today.
7. Render API failures as retryable errors, never as `Henüz ... yok` empty states.

### Acceptance tests

- Assign `QA UAT 20260805 - Ahmet Usta` to the QA project from the personnel page.
- Confirm the same allocation appears on project edit.
- Edit it from the project side and confirm the personnel side updates.
- Create/reopen one QA role assignment and one QA cost period with independently checked component totals.
- Add a valid labor-day/cost entry and confirm project finance reflects it exactly once.
- Remove only the test allocation and verify both views update.

## P1-2: Replace the deprecated project-expense route

### Observed evidence

- Project-list `Giderler` links to `/admin/projeler/<id>/giderler`.
- The destination is headed `Proje Giderleri (Kullanım Dışı)`.
- It displays `Gider kayıtları alınamadı.`
- The modern supplier and expense-card ledgers already feed project finance correctly.

### Required fix

1. Do not revive a second expense ledger.
2. Replace the deprecated route/button with a filtered view of the canonical outgoing ledger or project-finance expense section.
3. Preserve the project context and provide links to the original supplier/expense-card records.
4. Remove user-facing `Kullanım Dışı` dead-end language from active navigation.

### Acceptance tests

- Clicking `Giderler` on the QA project shows the ₺180,000 realized supplier payment and ₺95,000 expense-card payment.
- Totals equal project finance.
- Editing a source record updates this view without duplication.

## P1-3: Respect official/unofficial entry context

### Observed evidence

Opening `Ekle` from the customer's unofficial tab defaults the account type to `Resmi`.

### Required fix

- The add dialog must inherit the active tab's classification.
- Keep the classification visible and editable if the product permits it.
- Warn before moving an existing entry between official/unofficial ledgers if that affects reporting.

### Acceptance tests

- Add from Official defaults to Official.
- Add from Unofficial defaults to Unofficial.
- Saving preserves the chosen classification across customer detail, `Gelenler`, project finance, and `Net Durum`.

## P1-4: Normalize Google Maps settings input

### Observed evidence

The stored settings value starts with a valid Maps embed URL but also contains copied iframe attributes such as:

```text
" width="600" height="450" style="border:0;" ...
```

The preview encodes those attributes into the iframe `src` as `%22%20width=...`, while the settings status says the map is active.

### Required fix

1. Accept either a clean Google Maps embed URL or a pasted iframe snippet.
2. If an iframe snippet is pasted, parse and store only its `src` URL.
3. Validate protocol/domain and reject script/event attributes.
4. Revalidate the persisted value before marking the integration active.
5. Provide a one-time safe normalization for the current value without altering unrelated settings.

### Acceptance tests

- Clean URL and copied iframe snippet both produce the same stored clean URL.
- Preview iframe `src` contains no encoded HTML attributes.
- Invalid/non-Google/script-bearing values are rejected.

## Phase 2 gate

- The complete project ↔ personnel ↔ labor-cost relationship works in both directions.
- Project expenses use one canonical source.
- Account context and map settings pass regression tests.

---

# Phase 3 — Media, Project Authoring, and Data Hygiene

## P1-5: Detect and handle missing/orphan media

### Observed evidence

- New QA media upload is healthy and single-extension.
- A legacy DEDEPAŞA media row still references a double-extension `...png.jpg` URL.
- The media UI marks it `Kullanımda`, but the physical file is absent; the URL falls through to the SPA HTML rather than returning an image.
- The original image is not locally available and must not be fabricated.

### Required fix

1. Add server-side media health validation using MIME/content checks, not HTTP 200 alone.
2. Distinguish missing file, non-image fallback HTML, and valid image.
3. Show a professional `Missing file` state and prevent broken thumbnails from appearing healthy.
4. Provide a safe admin repair action: replace/re-upload the original or unlink the orphan after explicit confirmation.
5. Do not synthesize or guess a replacement image.

### Acceptance tests

- Valid QA image remains healthy.
- SPA HTML fallback is detected as invalid media.
- Re-upload replaces the reference safely and preserves project association.

## P2-1: Make draft image requirements and preview behavior honest

### Observed evidence

- Saving a new draft without an image returns `Ana görsel yüklenmelidir.` although the image control has no required marker.
- Draft `Önizle` opens the public URL and shows `Proje bulunamadı`.

### Required fix

1. Decide whether an image is required for a draft or only for publication.
2. Preferred owner-friendly behavior: allow an image-less draft, require a valid image before publish, and show clear field-level status.
3. Implement authenticated draft preview that does not publish the project and does not expose it to public visitors.
4. Never label a public 404 as preview.

### Acceptance tests

- Draft validation and required markers agree.
- Publish is blocked with a precise message if required media is missing.
- Authenticated admin preview renders draft content; anonymous public access remains unavailable.

## Project duplicate/delete regression

Preserve the confirmed behavior that duplicate creates an unpublished project and no finance records. Improve only the interaction quality:

- Give duplicate, publish/unpublish, reorder, edit, and delete controls unique accessible names containing the project name.
- Replace blocking native `window.confirm` with the application's accessible confirmation dialog.
- The dialog must name the exact project and distinguish QA/test data from real data only by the actual title, not by hidden assumptions.
- Deleting a duplicated QA project must not delete the source project's media or finance records.

## Phase 3 gate

- Media health is truthful.
- Draft authoring/preview is coherent.
- Project destructive controls are accessible, scoped, and safe.

---

# Phase 4 — Dashboard Activity, Notifications, Backup Time, and UX Consistency

## P2-2: Normalize recent activity rows

### Observed evidence

Dashboard `Son Hareketler` labels all rows `Müşteri` and `Resmi`, including supplier expense, expense-card expense, and unofficial EUR income. It also displays planned rather than realized amounts:

- Supplier row shows `-₺480,000` although paid is ₺180,000.
- Official income shows `+₺185,000` although collected is ₺55,000.
- Unofficial EUR shows `+€549,500`, which is actually the converted planned TL amount mislabeled as EUR; correct values are €10,000 planned and €3,500 realized / ₺192,325 realized.

### Required fix

Use the normalized ledger event from Phase 1. Every activity row must carry:

- source type (`Customer`, `Government progress`, `Supplier`, `Expense card`, etc.),
- account classification (`Official` / `Unofficial`) when applicable,
- original currency and amount,
- TL-equivalent amount,
- realized movement amount,
- movement/business date,
- related project and party.

The primary displayed amount for a realized-movement list must be the realized amount.

### Acceptance tests

- All five QA finance records display correct source, classification, sign, currency, and realized amount.
- Planned-only future receivables are not presented as recent cash movement.

## P2-3: Reconcile upcoming collections with notifications

### Observed evidence

- Dashboard reports four upcoming collections.
- Admin notification page and notification tray show zero items.

### Required work

First determine whether notifications are intended to be generated records or merely a separate system. If reminders are intended:

1. Generate idempotent notifications from the same due-date query used by the dashboard.
2. Support read/unread state and links to the exact receivable.
3. Prevent duplicate reminders across daily runs.

If notifications are not intended for upcoming collections, change the dashboard copy/navigation so it does not imply an active reminder workflow. Do not implement speculative push infrastructure.

## P2-4: Make backup timestamps consistent

### Observed evidence

One successful backup is shown as:

- Drive/history display: `05.08.2026 02:06`
- Package UTC name: `akinal-recovery-2026-08-04T23-05-43Z`
- Audit display: `05.08.2026 05:06`

The package name is explicitly UTC (`Z`). The same event must not receive two different Türkiye-time conversions.

### Required fix

1. Store event timestamps in UTC once.
2. Convert to `Europe/Istanbul` exactly once in the UI.
3. Label UTC when showing raw package timestamps.
4. Keep the intended GitHub Actions schedule at `0 22 * * *`, which represents 01:00 Türkiye time.
5. Do not assume GitHub starts exactly on the minute; show scheduled time separately from actual start time if needed.

### Acceptance tests

- One run has one canonical UTC timestamp and one consistent Türkiye display.
- History, latest-backup card, and audit table agree.
- Day-boundary conversion is covered by tests.

## P2-5: Make government-progress summary KPIs honor active filters

### Observed evidence

- Search plus project/stage/status filters correctly reduce the visible list to the single QA government-progress card.
- With `QA UAT 20260805 - Güneş Apartmanı`, `Su Basmanı — %30`, and `Kısmi Ödendi` selected, the visible card is ₺425,000 planned and ₺127,500 collected.
- The summary still displays the unfiltered global totals: ₺5,675,000 planned and ₺127,500 collected.
- `Gelenler` and `Gidenler` already recalculate their summaries from active filters, so the government-progress screen is inconsistent with the rest of the finance UI.

### Required fix

1. Apply the same normalized filtered dataset to both the card list and summary KPIs.
2. Keep global totals only in a separately labelled, intentionally unfiltered view; do not silently mix scopes.
3. Cover combined search/project/stage/status filters, including zero-result states.

### Acceptance tests

- Filtering to the QA project shows ₺425,000 planned, ₺127,500 collected, and ₺297,500 remaining in both cards and summary.
- Clearing filters restores ₺5,675,000 planned without a reload.
- Combined filters never leave stale global KPI values above a filtered list.

## User-facing backup wording

The following technical warning must never be sent or shown as a user-facing success note:

```text
Bu çalıştırmanın veritabanı dışa aktarımı bazı uyarılarla tamamlandı (TAM yedek garantisi yok) — paket yine de Drive'a yüklendi ve doğrulandı.
```

Keep detailed diagnostics internally. For a successfully uploaded and verified package, use concise professional success text. If the backup is not safely restorable, the run must not be represented as fully successful; use a professional failure/degraded state without leaking implementation noise.

## P3 UX/accessibility cleanup

Make these targeted fixes only:

1. Income and outgoing supplier/expense-card row edit/delete icon buttons need accessible names and titles.
2. Personnel rows expose duplicate `Detay` links to the same URL; keep one clear action.
3. Maintenance Console has two buttons both named only `Çalıştır`; each accessible name must include the migration title. Do not change migration behavior.
4. Expense-card finance page heading is generic `Masraf Kartı`; show the actual card name and project.
5. Expense-card creation needs a clear success toast.
6. Successful modal submissions should close deterministically after confirmed persistence, not linger while showing success.
7. Settings inputs should have stable `name` attributes and label associations for accessibility and testing.
8. Settings integration status must not say `Active` when the stored map URL is malformed.
9. `Gelenler` renders government-progress rows with record type `—`, while the `Tüm Kayıt Türleri` filter offers only Official/Unofficial. Add a truthful government-progress type and make it independently filterable.

## Phase 4 gate

- Dashboard activity is financially truthful.
- Notification behavior matches product intent.
- Government-progress cards and summary KPIs use the same active filter scope.
- Backup timestamps and wording are professional and consistent.
- Focused accessibility checks pass without redesigning the admin panel.

---

# Phase 5 — Full Regression, Deployment, and Handoff

## Automated validation

Run all relevant existing tests plus new focused coverage. At minimum:

```text
PHP syntax checks for every changed PHP file
Frontend typecheck/build
Existing verification scripts
New payment-date/CPI persistence tests
New government-card/collection atomicity tests
New cross-screen finance reconciliation tests
New public-submission and admin-contact retrieval/error-state tests
New personnel allocation tests
New personnel role/cost-period error-state and persistence tests
New media health tests
New timezone conversion tests
New government-progress filtered-summary tests
```

Do not mark a phase complete if tests were skipped. Report unavailable tooling explicitly.

## Live regression scenario

Using only the named QA records:

1. Reopen project, customer, supplier, personnel, expense card, and media.
2. Verify the QA project remains public and its valid image loads as an image.
3. Create/edit/reopen an official dated payment and an unofficial EUR dated payment.
4. Persist and reopen a CPI base date.
5. Create a government-progress plan, then create a stage collection through the supported path.
6. Assign QA personnel to the QA project, create/reopen a role and cost period, record labor cost/day data, and verify project finance.
7. Verify outgoing supplier and expense-card payments.
8. Compare dashboard, `Gelenler`, `Gidenler`, `Net Durum`, and project finance totals.
9. Submit one public QA contact request through the rendered security control and confirm it appears once in admin requests.
10. Verify settings map preview with a clean URL.
11. Verify backup history/audit timestamps without starting unnecessary extra backups.
12. Verify all search/filter/export controls, including filtered KPI scope and the government-progress record type; cancel import without inserting duplicates.

## Production safety checks

- Confirm protected real record counts and key values are unchanged.
- Confirm no QA change is attached to a real customer/project/supplier/personnel record.
- Confirm `uploads/` was not deployed or deleted.
- Confirm secrets are absent from diff and commit.
- Run the normal DIFF dry run; review the exact upload set; then run DIFF deploy.

## Git discipline

Use separate, focused commits per completed phase. Do not include unrelated working-tree changes. Push the final approved commits to the intended branch and verify the remote workflow/configuration where applicable.

## Final report format

Report only:

1. Root cause and fix for each issue ID.
2. Exact files changed per phase.
3. Database migration/data correction details, including before/after reconciliation if any.
4. Tests and commands run with results.
5. DIFF deploy result.
6. Commit hashes and push results.
7. Final live totals from all four financial screens.
8. Any remaining blocker that cannot be fixed without owner input.

Do not pad the report with generic summaries. Do not claim success without live evidence.

---

## 6. Out-of-Scope Actions

Do not do any of the following under this brief:

- Rewrite the application architecture.
- Replace the design system.
- Add new accounting modules unrelated to the proven defects.
- Change the 01:00 Türkiye backup schedule.
- Lower CAPTCHA/security requirements.
- Accept legal agreements or browser permissions on behalf of the owner.
- Run production migrations merely to test whether their buttons work.
- Fabricate the missing legacy project image.
- Delete real financial history.
- Rework confirmed-working upload encryption, Drive retention, media album, inflation calculator, or canonical ledger logic without a failing regression test.

---

## 7. Definition of Done

This repair order is complete only when:

- A legitimate visitor can submit the public contact form securely.
- Every visible payment/date field persists exactly or is removed from the UI.
- Government-progress create/edit and collection behavior is coherent and atomic.
- Personnel can be assigned to projects from both entry points.
- Project expenses have no deprecated dead end.
- Official/unofficial context is preserved.
- Dashboard, `Gelenler`, `Net Durum`, and project finance reconcile exactly.
- Recent activity shows realized amounts with correct source/classification/currency.
- Valid and missing media are distinguished truthfully.
- Draft validation and preview behave honestly.
- Map settings store and render a clean URL.
- Backup times and user-facing messages are consistent and professional.
- All focused automated and live QA checks pass without changing protected real data.
