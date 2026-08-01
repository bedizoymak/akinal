# Claude Prompt — Full Sidebar System Audit / Deep UI-UX + Backend + Database Review

Copy this entire prompt into Claude / Claude Code.

---

You are acting as a **principal software architect, senior full-stack engineer, senior QA engineer, database auditor, security reviewer, UX reviewer, and construction/finance domain analyst** at the same time.

Your task is to perform a **forensic, exhaustive, read-only audit** of this admin system. The target is the application represented by the sidebar modules below. You must inspect **every page, every route, every component, every button, every nested action, every modal, every form, every table, every API call, every database connection, every calculation, every validation rule, every permission gate, every edge case, and every integration point**.

This must not be a quick review. Treat this as a **production-grade system audit**. If it takes hours, take hours. Do not rush. Do not summarize superficially. Do not say “looks good” unless you can prove it with exact file/function/table references.

## Critical hard rules

1. **Do not modify application code.**
2. **Do not refactor anything.**
3. **Do not delete data.**
4. **Do not run migrations.**
5. **Do not deploy.**
6. **Do not change database schema.**
7. **Do not change `.env`, config, credentials, package lock files, build output, source files, or migrations.**
8. **Only create one final Markdown report file.**
9. The only allowed write is the final report file:
   - `FULL_SIDEBAR_SYSTEM_AUDIT_REPORT.md`
10. If any command could mutate source code, database, generated files, dependencies, caches, or production state, do not run it.
11. If a test command is known to create output files, skip it unless you can guarantee no persistent source changes.
12. Use read-only inspection by default: file reading, grep/ripgrep, route tracing, type tracing, SQL/schema inspection, static reasoning.
13. If you need to inspect a database connection, do it by reading code/config only unless a safe local read-only database is clearly available. Never write to DB.
14. At the end, verify with `git status` that the only changed/new file is `FULL_SIDEBAR_SYSTEM_AUDIT_REPORT.md`.
15. Do not create multiple audit files, temporary reports, TODO files, patch files, or separate checklists.

## Report language and style

- The final report must be written in **Turkish**.
- Keep code identifiers, file names, function names, route names, table names, endpoint names, enum values, and field names exactly as they appear in the codebase.
- Be precise, engineering-focused, and evidence-based.
- Every claim about implementation must include exact references:
  - file path
  - component/function/hook/service name if available
  - route/endpoint/table name if available
  - line numbers if your environment can provide them
- If you cannot prove something, write:
  - `Kanıtlanamadı`
  - where you searched
  - what evidence was missing
  - what risk remains
- Do not use generic filler such as:
  - “needs improvement”
  - “check this later”
  - “probably”
  - “maybe”
  - “seems fine”
  unless backed by a specific technical explanation.

## Product context

This is an admin/management panel for a Turkish construction/business finance context. It appears to include project management, customer receivables, government progress payments, expenses, suppliers, personnel, inflation/vade farkı calculations, media, notifications, and site/admin settings.

The sidebar modules to audit are exactly:

### GENEL
1. `Genel Bakış` — Kısa şirket özeti
2. `Gelenler` — Müşteri tahsilat kalemleri
3. `Gidenler` — Tüm gider kalemleri
4. `Enflasyon Hesaplama` — TÜFE endeksi ile tutar güncelleme

### PROJE YÖNETİMİ
5. `Projeler` — Şantiye ve proje kayıtları
6. `Medya` — Proje görselleri

### CARİ VE TAHSİLAT
7. `Müşteriler` — Cari kayıtları
8. `Devlet Hakedişleri` — Hakediş ve teşvik ödemeleri

### TEDARİK VE GİDERLER
9. `Tedarikçiler` — Tedarikçi ve alt yüklenici kartları
10. `Masraf Kartları` — Proje masraf kartları

### PERSONEL
11. `Personeller` — Usta ve çalışanlar

### OPERASYON
12. `İletişim Talepleri` — Web form talepleri
13. `Bildirimler` — Hatırlatmalar

### SİSTEM
14. `Ayarlar` — Site ayarları

You must audit all 14 modules. None may be skipped.

---

# Mission

Produce a single, extremely detailed audit file named:

```text
FULL_SIDEBAR_SYSTEM_AUDIT_REPORT.md
```

The report must answer:

1. What exists in each sidebar page?
2. What does each page do?
3. Which files/components implement it?
4. Which routes render it?
5. Which APIs does it call?
6. Which backend files handle those APIs?
7. Which DB tables/columns are read or written?
8. Which buttons/actions exist, including nested buttons inside modals/drawers/dropdowns?
9. What happens when each button is clicked?
10. What validations exist?
11. What validations are missing?
12. What loading/empty/error states exist?
13. What states are missing?
14. What calculations exist?
15. Are calculations correct and consistent across pages?
16. Are accounting/finance flows correct?
17. Are database relations safe?
18. Are there orphan/duplicate/double-count risks?
19. Are authorization and security controls correct?
20. Are UI/UX flows logical for a Turkish construction finance admin panel?
21. Are there performance risks?
22. Are there maintainability/code-quality risks?
23. What must be fixed first?
24. What should not be changed?
25. What tests should exist?
26. What exact manual QA checklist should be followed before production deployment?

---

# Required working method

## Phase 0 — Read-only preflight

Before deep analysis:

1. Identify repository root.
2. Identify framework stack:
   - frontend framework
   - router
   - state management
   - API client structure
   - backend language/framework
   - database type
   - migration/schema mechanism
   - auth/session mechanism
   - build/deploy scripts
3. Capture current branch and status:
   - `git branch --show-current`
   - `git status --short`
4. Do not change anything at this stage.
5. Record preflight findings in the final report.

## Phase 1 — Full project inventory

Create an internal inventory before writing the report:

1. Locate sidebar/menu definition.
2. Locate route definitions.
3. Locate page components.
4. Locate shared layout components.
5. Locate API client(s).
6. Locate TypeScript/API types.
7. Locate backend endpoint files/controllers/services.
8. Locate database/migration/schema files.
9. Locate auth/permission middleware.
10. Locate file upload/media handling.
11. Locate calculation helpers, especially finance/inflation/vade farkı.
12. Locate tests, if any.
13. Locate docs/spec files, if any.

The report must include a **Project Inventory** section with exact paths.

## Phase 2 — Sidebar-to-route-to-code mapping

For each sidebar item, create a mapping table:

| Sidebar Item | Route | Page Component | Child Components | API Calls | Backend Endpoint(s) | DB Tables | Status |
|---|---|---|---|---|---|---|---|

Rules:

- If the sidebar item exists but route is missing, mark as P0/P1 depending on impact.
- If route exists but page is placeholder, mark it.
- If page exists but API is not wired, mark it.
- If API exists but DB connection is incomplete, mark it.
- If DB table exists but UI does not expose required data, mark it.
- If a page is only partially implemented, describe exactly what works and what is missing.

## Phase 3 — Page-by-page forensic audit

For each of the 14 modules, produce a dedicated section with the following exact structure.

### Required section template for every page

```md
## [Module Number]. [Sidebar Page Name]

### 1. Purpose / İş amacı
- What this page is supposed to achieve in business terms.
- Whether the current implementation matches that purpose.

### 2. Route and file mapping
| Layer | Evidence |
|---|---|
| Sidebar config | ... |
| Route | ... |
| Page component | ... |
| Child components | ... |
| Hooks/helpers | ... |
| API client calls | ... |
| Backend endpoint(s) | ... |
| DB table(s) | ... |

### 3. UI structure
- Layout structure
- Cards/KPIs
- Tables
- Forms
- Modals/drawers
- Dropdowns
- Tabs
- Filters
- Search
- Pagination
- Empty states
- Loading states
- Error states
- Responsive behavior

### 4. Button and action inventory
| UI Location | Button/Action Label | Component/File | Handler Function | Opens Modal? | API Call? | DB Effect? | Validation? | Loading/Disabled State? | Risk |
|---|---|---|---|---|---|---|---|---|---|

Include every visible and nested action:
- page-level buttons
- table row action buttons
- icon buttons
- dropdown menu actions
- modal buttons
- confirmation dialog buttons
- form submit/cancel/reset buttons
- upload/remove buttons
- filter clear buttons
- pagination buttons
- inline edit buttons
- status change buttons
- notification action buttons
- any action hidden behind conditions

### 5. Data flow / Veri akışı
| UI Field | Frontend State/Type | API Request Field | API Response Field | Backend Variable | DB Table.Column | Validation | Notes |
|---|---|---|---|---|---|---|---|

### 6. CRUD behavior
- Create behavior
- Read/list behavior
- Detail behavior if present
- Update behavior
- Delete/archive/passive behavior
- Bulk actions if present
- Duplicate prevention
- Optimistic update behavior if present
- Refresh/revalidation behavior

### 7. Business logic and calculations
- All formulas
- Money calculations
- Date calculations
- Status calculations
- Dashboard aggregation effects
- Finance/accounting side effects
- Inflation/vade farkı effects if applicable

### 8. Database and integrity review
- Tables used
- Primary keys
- Foreign keys
- Nullable fields
- Enum/status fields
- Index needs
- Cascade behavior
- Orphan risks
- Duplicate risks
- Transaction needs
- Historical record preservation

### 9. API/backend review
- Endpoints used
- Methods
- Request validation
- Response shape
- Error handling
- Auth/permission checks
- SQL safety
- Type consistency
- Missing backend rules

### 10. UX review
- Is the workflow obvious?
- Are labels correct in Turkish?
- Are financial/accounting terms correct?
- Are primary actions visually prioritized?
- Are destructive actions protected?
- Are user mistakes recoverable?
- Are totals/explanations clear?
- Does layout break with long Turkish names, long project names, long addresses, large amounts?

### 11. Security and permission review
- Route guard
- Sidebar visibility
- Direct URL access
- Backend permission enforcement
- Sensitive data exposure
- XSS risk
- CSRF/session risk
- File upload risk if applicable

### 12. Performance review
- API call count
- N+1 query risks
- Pagination/filtering location
- Large dataset behavior
- Re-render risks
- Media/image loading issues

### 13. Edge cases
List all relevant edge cases, including but not limited to:
- no records
- one record
- thousands of records
- missing customer/project/supplier/personnel
- deleted linked entity
- duplicate name
- very large money amount
- negative amount
- zero amount
- invalid date
- future date
- past due date
- timezone/day boundary
- network failure
- backend validation failure
- double-click submit
- browser refresh during form submit
- stale cache
- mobile viewport

### 14. Issues found
| Severity | Category | Issue | Evidence | Impact | Recommended Fix |
|---|---|---|---|---|---|

Severity definitions:
- P0: Data corruption, security breach, financial double counting, broken critical workflow, destructive behavior, production blocker.
- P1: Major business logic bug, missing critical validation, inconsistent totals, broken important UX, high-risk maintainability issue.
- P2: Medium issue, inefficient flow, missing helpful validation, UI inconsistency, performance concern.
- P3: Cosmetic improvement, wording cleanup, low-risk refactor suggestion.

### 15. Test scenarios
| Test ID | Scenario | Steps | Expected Result | Priority |
|---|---|---|---|---|
```

Do this for all 14 modules.

---

# Special deep-audit requirements by module

## 1. Genel Bakış

Audit dashboard logic extremely carefully:

- KPI cards
- company summary
- total incoming
- total outgoing
- net balance
- project counts
- customer counts
- overdue items
- upcoming due dates
- notifications/reminders
- recent activity if present
- charts if present
- financial aggregation queries
- whether numbers match source pages
- whether totals double-count government progress payments and customer receivables
- whether filters/date ranges affect dashboard consistently
- empty dashboard state
- stale data/cache risk

Required consistency checks:

- Dashboard total incoming must reconcile with `Gelenler`.
- Dashboard total outgoing must reconcile with `Gidenler`.
- Dashboard customer balances must reconcile with `Müşteriler`.
- Dashboard project financials must reconcile with `Projeler`.
- Dashboard government receivables must reconcile with `Devlet Hakedişleri`.

## 2. Gelenler

Audit incoming/customer collection logic:

- customer relation
- project relation
- collection date
- due date if present
- amount
- status
- payment method if present
- notes
- inflation/vade farkı preview if present
- whether this is actual cash received or receivable record
- duplicate collection risk
- relationship with customer balance
- relationship with project profitability
- relationship with dashboard totals
- edit/delete behavior after financial totals are affected

Critical accounting questions:

- Is `Gelenler` actual cash inflow or planned receivable?
- Is the system mixing planned and realized records?
- Is payment date separate from due date?
- Is customer balance calculated correctly?
- Can the same amount be counted twice through another module?

## 3. Gidenler

Audit expense/outgoing logic:

- supplier relation
- project relation
- expense card/category relation
- personnel relation if applicable
- expense date
- payment date
- due date if present
- amount
- status
- invoice/receipt fields if present
- cash paid vs payable distinction
- general expense vs project expense distinction
- dashboard/project profitability effect
- supplier balance effect
- masraf kartı relation

Critical accounting questions:

- Is every outgoing assigned to a correct cost category?
- Can general expenses be incorrectly assigned to projects?
- Are unpaid expenses included in cash flow incorrectly?
- Are paid expenses included in profitability correctly?

## 4. Enflasyon Hesaplama

Audit inflation calculation with maximum precision:

- official data source handling
- monthly index table
- annual change display
- monthly change display
- index_value display
- forecast fields if present
- forecast warnings
- calculation base period
- target period
- compound monthly calculation
- whether base month is excluded and target month included
- future target period handling
- duplicate-safe same-month historical forecast logic
- rounding behavior
- date boundary behavior
- consistency with vade farkı calculations in customer receivables
- consistency between frontend calculation and backend calculation
- whether UI labels clearly separate official data and estimated forecast

Must explicitly verify these expected rules if the code contains this module:

- Calculator math must use only `monthly_change_percent` compound chain between `base + 1` and `target`.
- Historical periods must use official data only.
- Future periods must use forecast only when official data is unavailable.
- Forecast must be visibly marked as estimated.
- Forecast for same month must use last 5 distinct years, not duplicate rows.
- `index_value` must be a display index, not the source of calculator math unless code explicitly requires it.

## 5. Projeler

Audit project management:

- project list/card/table
- project detail navigation
- create/edit/delete/project status
- customer relation
- government progress payment relation
- incoming/outgoing relation
- media relation
- personnel relation if any
- suppliers/expenses relation
- profitability calculation
- progress/status logic
- date fields
- location/address fields
- project empty/detail states
- duplicate project names
- deleting project with linked records
- archiving/passive status vs hard delete

Critical domain questions:

- Does a project behave like the financial root entity?
- Are all financial records safely connected to project where necessary?
- Can a project be deleted while financial history exists?
- Are project totals computed from canonical records or copied stale fields?

## 6. Medya

Audit project media:

- upload UI
- file input
- drag/drop if present
- image preview
- project association
- gallery layout
- cover image logic
- image delete
- image replace
- ordering/sorting
- alt text/title/caption
- file type validation
- file size validation
- MIME validation
- backend storage path
- public URL construction
- broken image behavior
- orphan physical file risk
- orphan DB row risk
- security risks from upload
- cache/CDN risks if present

## 7. Müşteriler

Audit customer/cari logic:

- customer card/list/detail
- create/edit/delete
- customer code/name/title
- phone/email/address/tax fields if present
- duplicate prevention
- project relation
- incoming relation
- government progress payment relation if any
- balance calculation
- total receivable
- total collected
- overdue receivables
- inflation/vade farkı preview if present
- customer statement table if present
- filtering/sorting/search
- passive/archive vs hard delete

Critical accounting questions:

- Is customer balance calculated from source transactions?
- Are deleted/edited transactions reflected immediately?
- Is `Devlet Hakedişleri` part of customer receivable or separate government receivable?
- Are due dates and payment dates shown clearly?

## 8. Devlet Hakedişleri

Audit government progress payments / incentives:

- project relation
- customer relation if any
- amount
- due date
- payment date
- status logic
- automatic status based on due/payment date
- paid/unpaid/overdue distinctions
- progress payment number/description if present
- government agency/source if present
- edit/delete behavior
- dashboard effect
- project effect
- customer balance effect if applicable
- inflation/vade farkı calculation if applicable
- future due date warnings
- expected collectible amount if forecast is used

Critical accounting questions:

- Is this module separate from customer collections?
- Can one government progress payment be counted as both customer receivable and incoming cash?
- When paid, does it become a `Gelenler` record automatically or is it separate?
- If separate, are dashboard totals consistent?
- If linked, is there duplicate prevention?

## 9. Tedarikçiler

Audit supplier/subcontractor cards:

- supplier list/detail
- create/edit/delete
- supplier contact fields
- tax/contact/address fields if present
- relation to outgoing expenses
- supplier balance
- payables
- payments
- duplicate prevention
- supplier as subcontractor distinction
- supplier archive/passive state
- deletion with linked expenses

Critical accounting questions:

- Does supplier balance reconcile with `Gidenler`?
- Are paid/unpaid supplier expenses separated?
- Can a supplier be deleted while expenses exist?

## 10. Masraf Kartları

Audit expense cards/categories:

- category list
- project expense cards
- create/edit/delete
- category hierarchy if present
- default categories
- relation to outgoing expenses
- project-specific vs global category behavior
- reporting usability
- delete behavior when expenses exist
- whether old expenses preserve category name/history
- duplicate category prevention
- naming consistency

Critical questions:

- Are expense cards true master data or transactional records?
- Can editing a card change historical reports incorrectly?
- Are categories enough for construction accounting?

## 11. Personeller

Audit personnel/employee records:

- personnel list/card/detail
- create/edit/delete/passive
- role/title/job fields
- phone/address/payment fields if present
- salary/wage/advance fields if present
- relation to expenses
- relation to projects
- active/passive status
- privacy/KVKK risk
- personnel deletion with financial history
- payroll/advance/payment logic if present

Critical questions:

- Should personnel be deleted or passivated?
- Are personnel-related costs included in `Gidenler`?
- Does personnel data expose unnecessary personal information?

## 12. İletişim Talepleri

Audit contact/web form requests:

- listing
- detail view
- read/unread status
- replied/archived status
- delete/archive
- conversion to customer/project if present
- spam risk
- validation/sanitization
- XSS risk from message body
- notification creation
- email integration if present
- empty/loading/error states

## 13. Bildirimler

Audit notification/reminder system:

- notification list
- read/unread
- mark all read
- delete/archive
- source events
- due date reminders
- finance reminders
- government progress payment reminders
- customer receivable reminders
- supplier payable reminders
- sidebar badge count if present
- stale badge risk
- duplicate notification risk
- notification generation location
- scheduled/background mechanism if any

Critical questions:

- Are notifications generated dynamically or persisted?
- Are read states user-specific?
- Can the same event create duplicate notifications?
- Are overdue financial items detected reliably?

## 14. Ayarlar

Audit system/site settings:

- settings form
- site identity
- logo/media settings
- contact info
- theme/display settings
- financial parameters if present
- inflation/forecast settings if present
- notification settings if present
- user/role settings if present
- validation
- caching
- persistence
- permissions
- dangerous settings protection
- file upload validation if logo is uploaded

Critical questions:

- Can unauthorized users change settings?
- Are settings cached and invalidated correctly?
- Are settings used consistently across public/admin pages?

---

# Global audit dimensions

In addition to page-by-page sections, the final report must include these global sections.

## A. Architecture audit

Review:

- frontend folder structure
- backend folder structure
- route organization
- component reuse
- API client architecture
- type definitions
- database access layer
- auth/session architecture
- error-handling architecture
- naming conventions
- separation of concerns
- code duplication
- dead code
- placeholder code
- inconsistent patterns

## B. Database audit

Create a full database relationship map from available schema/migrations/install files.

Include:

| Table | Purpose | Primary Key | Important Columns | Foreign Keys | Used By Pages | Risks |
|---|---|---|---|---|---|---|

Audit specifically:

- missing foreign keys
- missing indexes
- unsafe cascade delete
- missing uniqueness constraints
- nullable fields that should not be nullable
- status fields without constraints
- money fields with wrong types
- date fields with timezone risk
- inconsistent naming
- orphan records
- stale denormalized totals
- transaction requirements
- audit log needs

## C. API contract audit

Create a full API map:

| Endpoint | Method | Frontend Caller | Backend File | Request Fields | Response Fields | DB Tables | Auth | Risk |
|---|---|---|---|---|---|---|---|---|

Audit:

- frontend/backend type mismatch
- missing fields
- unused fields
- inconsistent response wrappers
- inconsistent error format
- missing validation
- missing auth
- unsafe SQL construction
- incorrect HTTP status code
- missing pagination
- missing filtering/sorting
- missing transaction
- duplicate create risk

## D. Finance and accounting audit

This is one of the most important sections.

Analyze the entire financial model:

- incoming records
- outgoing records
- customer receivables
- supplier payables
- government progress payments
- project profitability
- cash flow
- due dates
- paid/unpaid distinction
- planned vs actual distinction
- inflation/vade farkı effect
- dashboard totals
- project totals
- customer balances
- supplier balances
- category totals

Required reconciliation table:

| Financial Metric | Source Records | Formula Found in Code | Where Displayed | Risk of Double Count | Notes |
|---|---|---|---|---|---|

Required questions:

1. What is the canonical source of truth for income?
2. What is the canonical source of truth for expenses?
3. What is the canonical source of truth for customer balance?
4. What is the canonical source of truth for project profitability?
5. What is the canonical source of truth for government receivables?
6. Are totals computed live or stored redundantly?
7. If stored redundantly, how are they synchronized?
8. Where can double counting occur?
9. Where can deleted/edited records leave stale totals?
10. Are future due receivables mixed with collected cash?

## E. UI/UX consistency audit

Audit globally:

- sidebar grouping
- page headings
- Turkish labels
- button wording
- form field ordering
- table column ordering
- money format
- date format
- percent format
- status chips
- icons
- colors
- spacing
- responsive behavior
- empty/loading/error states
- destructive action patterns
- confirmation dialogs
- disabled states
- duplicate-submit prevention
- long text overflow
- mobile/tablet usability
- accessibility basics:
  - keyboard navigation
  - focus states
  - labels
  - contrast
  - aria labels if applicable

## F. Security audit

Audit globally:

- route guards
- backend auth checks
- permission checks
- direct URL access
- hidden buttons vs real backend enforcement
- SQL injection
- XSS
- CSRF/session handling
- file upload validation
- public file access
- sensitive data exposure
- error message leakage
- secrets in repository
- admin settings protection
- destructive action protection

## G. Performance audit

Audit:

- dashboard API call count
- page API call count
- repeated fetches
- N+1 queries
- missing pagination
- frontend-only filtering on large datasets
- unindexed database filters
- image loading/optimization
- unnecessary re-renders
- large bundle risks
- repeated calculation on render
- caching/revalidation behavior

## H. Test coverage audit

Find all existing tests.

Report:

| Test Area | Existing Coverage | Missing Critical Tests | Priority |
|---|---|---|---|

Must propose tests for:

- route rendering
- API contracts
- CRUD operations
- form validation
- duplicate submit prevention
- financial calculations
- dashboard reconciliation
- inflation calculation
- government progress payment status
- customer balance
- supplier balance
- project profitability
- delete/archive behavior
- permission enforcement
- file upload validation

## I. Deployment safety audit

Without deploying, inspect deployment scripts and risks:

- deploy scripts
- build scripts
- environment assumptions
- production API paths
- database migration expectations
- asset paths
- cache issues
- rollback possibility
- files that should not be deployed
- whether deployment could overwrite uploads/config

Do not run deployment.

---

# Mandatory issue format

Every issue must use this format:

```md
### [P0/P1/P2/P3] [Short issue title]

**Category:** UI / UX / Backend / Database / Security / Finance / Performance / Test / Architecture

**Evidence:**
- `path/to/file.ext` — component/function/endpoint/table reference
- exact route/API/table/field if applicable

**What happens now:**
Clear explanation.

**Why it matters:**
Business/technical/accounting/security impact.

**Recommended fix:**
Specific engineering action. Do not write full patch unless necessary. Do not modify files.

**Regression tests:**
Tests that should be added or manually executed.
```

---

# Required final report structure

The final `FULL_SIDEBAR_SYSTEM_AUDIT_REPORT.md` must follow this structure exactly:

```md
# Full Sidebar System Audit Report

## 0. Executive Summary
- Overall system maturity
- Biggest risks
- P0/P1 count
- Whether system is production-safe
- What must be fixed first

## 1. Read-Only Preflight
- branch/status
- stack detected
- audit scope
- commands used
- write-safety confirmation

## 2. Project Inventory
- frontend files
- backend files
- route files
- sidebar files
- API client files
- database/schema files
- auth/permission files
- calculation files
- test files

## 3. Sidebar Coverage Matrix
| # | Sidebar Page | Route Found | UI Found | API Found | DB Found | Audit Status | Highest Severity |
|---|---|---|---|---|---|---|---|

## 4. Global Architecture Audit
...

## 5. Database Audit
...

## 6. API Contract Audit
...

## 7. Finance and Accounting Audit
...

## 8. UI/UX Consistency Audit
...

## 9. Security Audit
...

## 10. Performance Audit
...

## 11. Test Coverage Audit
...

## 12. Deployment Safety Audit
...

## 13. Page-by-Page Audit
### 13.1 Genel Bakış
...
### 13.2 Gelenler
...
### 13.3 Gidenler
...
### 13.4 Enflasyon Hesaplama
...
### 13.5 Projeler
...
### 13.6 Medya
...
### 13.7 Müşteriler
...
### 13.8 Devlet Hakedişleri
...
### 13.9 Tedarikçiler
...
### 13.10 Masraf Kartları
...
### 13.11 Personeller
...
### 13.12 İletişim Talepleri
...
### 13.13 Bildirimler
...
### 13.14 Ayarlar
...

## 14. Full Button/Action Inventory
| Page | Location | Button/Action | File | Handler | API | DB Effect | Risk |
|---|---|---|---|---|---|---|---|

## 15. Full Data Lineage Matrix
| Page | UI Field | Frontend State | API Field | Backend Variable | DB Column | Validation | Risk |
|---|---|---|---|---|---|---|---|

## 16. Full Issue Register
| Severity | Page | Category | Issue | Evidence | Impact | Recommendation |
|---|---|---|---|---|---|---|

## 17. Prioritized Action Plan
### P0 — Production blockers
### P1 — Must fix before serious usage
### P2 — Should fix
### P3 — Nice to have

## 18. Manual QA Checklist
- Page-by-page checklist
- Button-by-button checklist
- Finance reconciliation checklist
- Security checklist
- Mobile/responsive checklist

## 19. Suggested Automated Tests
- Unit tests
- Integration tests
- API contract tests
- E2E tests
- Database integrity tests

## 20. Open Questions / Kanıtlanamayanlar
For every unknown:
- what was searched
- why it could not be proven
- what risk remains

## 21. Final Verification
- confirm no source code changed
- confirm only this report file was created
- include final `git status --short` result
```

---

# Minimum completeness requirements

The final report is incomplete and unacceptable unless all of the following are true:

1. All 14 sidebar pages are audited.
2. Every page has route/file/API/DB mapping or explicit `Kanıtlanamadı` with search evidence.
3. Every page has a button/action inventory.
4. Every page has data flow analysis.
5. Every page has database integrity analysis.
6. Every page has API/backend analysis.
7. Every page has UI/UX analysis.
8. Every page has security/permission analysis.
9. Every page has edge cases.
10. Every page has test scenarios.
11. The report contains a global database table map.
12. The report contains a global API map.
13. The report contains finance/accounting reconciliation analysis.
14. The report identifies double-count risks explicitly.
15. The report identifies duplicate-submit risks explicitly.
16. The report identifies delete/archive/passive behavior risks explicitly.
17. The report identifies missing loading/error/empty states explicitly.
18. The report identifies route guard/backend permission mismatches explicitly.
19. Every issue has severity P0/P1/P2/P3.
20. Every recommendation is actionable and references exact files/tables/endpoints where possible.
21. The final output is one Markdown file only.
22. Source code remains unchanged.

---

# Suggested safe read-only commands

Use only if appropriate for the actual repository and environment. Do not run destructive commands.

```bash
pwd
git branch --show-current
git status --short
find . -maxdepth 3 -type f | sort
rg -n "sidebar|menu|nav|navigation|routes|Route|createBrowserRouter|BrowserRouter|Link|NavLink" .
rg -n "fetch\(|axios|apiClient|request|GET|POST|PUT|PATCH|DELETE" .
rg -n "inflation|enflasyon|vade|forecast|tufe|tüfe|monthly_change|annual_change|index_value" .
rg -n "customer|müşteri|musteri|supplier|tedarik|project|proje|hakediş|hakedis|expense|gider|gelir|tahsilat|personel" .
rg -n "auth|permission|role|guard|middleware|session|token|admin" .
rg -n "upload|media|image|file|mime|size" .
rg -n "CREATE TABLE|ALTER TABLE|FOREIGN KEY|INDEX|UNIQUE|PRIMARY KEY" .
```

If line numbers are needed, use commands that preserve line references. Do not write helper scripts that modify the repo.

---

# Important reasoning rules

1. Trace implementation from UI to backend to DB, not just from file names.
2. Do not assume a page works because a component exists.
3. Do not assume an API works because a frontend call exists.
4. Do not assume database integrity because IDs are present.
5. Do not assume totals are correct; reconcile formulas.
6. Do not assume permissions are secure because buttons are hidden.
7. Do not assume delete is safe; inspect linked records.
8. Do not assume forecast/inflation math is correct; trace formula and periods.
9. Do not assume Turkish labels are correct; check business meaning.
10. Do not assume responsive design works; inspect class/layout patterns.
11. Do not assume empty/loading/error states exist; find them.
12. Do not assume tests cover behavior; inspect test assertions.
13. Do not provide vague recommendations. Give exact next engineering action.

---

# Final instruction

Now perform the audit. Work systematically. Do not skip modules. Do not modify source code. Create exactly one final file:

```text
FULL_SIDEBAR_SYSTEM_AUDIT_REPORT.md
```

After creating the file, provide only a short completion message with:

1. the report file path
2. total P0/P1/P2/P3 counts
3. confirmation that no source files were changed
4. final `git status --short`

Do not paste the whole report in chat unless explicitly asked.
