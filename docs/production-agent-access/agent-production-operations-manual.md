# Agent Production Operations Manual

**Project:** akinalinsaat.com  
**Version:** 1.0  
**Companion Documents:**

* [docs/agent-production-access-handover.md](agent-production-access-handover.md)
* [docs/agent-production-capability-regression-test.md](agent-production-capability-regression-test.md)

---

# Purpose

This document defines the operational rules for any future Claude Code session that has production access.

Read in this order:

1. agent-production-access-handover.md
2. agent-production-capability-regression-test.md
3. agent-production-operations-manual.md

If all regression tests pass, follow this manual.

---

# Operational Modes

## Mode 1 — Read Only

Allowed activities:

* SELECT
* SHOW TABLES
* SHOW CREATE TABLE
* DESCRIBE
* EXPLAIN
* INFORMATION_SCHEMA queries
* Dependency discovery
* Schema inventory
* Data validation
* Audit work

Examples:

```sql
SELECT * FROM ak_customers LIMIT 10;
```

```sql
SHOW TABLES;
```

```sql
DESCRIBE ak_customers;
```

No production data changes occur.

---

## Mode 2 — Safe Write

Allowed only after:

1. Read-only investigation completed
2. Target rows identified
3. Preview SELECT executed
4. Owner approved

Examples:

### INSERT

```sql
INSERT INTO table (...)
VALUES (...);
```

### UPDATE

```sql
UPDATE table
SET ...
WHERE id = ...;
```

### DELETE

```sql
DELETE FROM table
WHERE id = ...;
```

Required workflow:

```txt
Preview SELECT
↓
Review result
↓
Execute write
↓
Verification SELECT
↓
Document result
```

---

## Mode 3 — Dangerous Operations

Includes:

```sql
ALTER TABLE
DROP TABLE
TRUNCATE TABLE
RENAME TABLE
DROP COLUMN
DROP INDEX
```

Never execute immediately.

Required workflow:

```txt
Audit
↓
Dependency review
↓
Business decision
↓
SQL generation
↓
Owner approval
↓
Execution
↓
Verification
```

---

# Rollback Procedures

## Accidental DELETE

Immediately:

```sql
SELECT *
FROM affected_table;
```

Determine:

* What rows were removed
* Whether backup exists
* Whether source data can be reconstructed

Create restoration SQL.

Never continue with additional writes until impact is understood.

---

## Accidental UPDATE

Immediately capture:

```sql
SELECT *
FROM affected_table
WHERE ...
```

Determine:

* Changed columns
* Original values
* Restoration SQL

Restore before further work.

---

## Broken config.php

Symptoms:

* 500 errors
* Database connection failures
* Endpoint unavailable

Recovery:

1. FTP download production config.php
2. Compare against local reference
3. Restore known-good version
4. Re-test endpoint

---

## Broken agent-sql.php

Symptoms:

* Endpoint returns 404
* Endpoint returns PHP fatal error
* Endpoint rejects valid requests

Recovery:

1. Upload fresh copy
2. Run SELECT 1
3. Run SHOW TABLES
4. Confirm endpoint restored

---

# AKINALINSAAT Table Audit Workflow

For every table:

## Step 1 — Understand Purpose

Questions:

* Why does this table exist?
* What business process owns it?
* Is it still used?

Document findings.

---

## Step 2 — KEEP or REMOVE

Possible outcomes:

### KEEP

Business purpose still exists.

### REMOVE

Business purpose no longer exists.

### UNKNOWN

More investigation required.

---

## Step 3 — Dependency Discovery

Find:

### PHP

```txt
public_html/api/**/*.php
```

### React

```txt
src/**/*.tsx
src/**/*.ts
```

### SQL

```txt
migrations
install-schema
reports
```

Document every dependency.

---

## Step 4 — Runtime Cleanup

If table is being removed:

Remove:

* Reads
* Writes
* APIs
* UI
* Types
* Reports

Do not drop table yet.

---

## Step 5 — Drop Preparation

Create:

```sql
DROP TABLE table_name;
```

Store in:

```txt
docs/sql/
```

Never execute automatically.

---

## Step 6 — Final Review

Verify:

* No runtime dependencies remain
* Business owner approved removal
* Rollback plan exists

Only then consider execution.

---

# AKINALINSAAT Business Rules

## Rule 1 — Audit First

Always:

```txt
Audit
↓
Understand
↓
Decide
↓
Change
```

Never reverse the order.

---

## Rule 2 — No Assumptions

Never assume:

* Table is unused
* Data is obsolete
* Feature is dead

Verify first.

---

## Rule 3 — Customer Cleanup Precedent

Established procedure:

```txt
Preview SELECT
↓
Delete child relations
↓
Delete parent records
↓
Verification SELECT
↓
Document outcome
```

This procedure should be reused for future cleanup tasks.

---

## Rule 4 — Financial Data Is Special

Tables involving:

* payments
* expenses
* financial_entries
* payment_plans

Require extra review.

Reason:

Financial inconsistencies already exist in the system.

Canonical-source decisions must be documented before refactoring.

---

## Rule 5 — Schema Changes Need Review

Before:

```sql
ALTER
DROP
TRUNCATE
RENAME
```

Require:

* Dependency audit
* Business decision
* SQL review

---

# Session Start Checklist

Before doing anything:

```txt
[ ] Read handover document
[ ] Run regression tests
[ ] Confirm endpoint access
[ ] Confirm FTP access
[ ] Confirm token validity
[ ] Confirm current objective
```

---

# Session End Checklist

```txt
[ ] Verification completed
[ ] Results documented
[ ] SQL saved if needed
[ ] Audit notes updated
[ ] Rollback path documented
```

---

# Golden Rule

For akinalinsaat.com:

```txt
Understand first.
Audit second.
Change third.
Verify fourth.
Document fifth.
```

Never skip a step.
