# Production Access — Document Index

**Project:** akinalinsaat.com

---

## Read in this order

| # | Document | When to use |
|---|---|---|
| 1 | [agent-production-access-handover.md](agent-production-access-handover.md) | Start here. Architecture, exact files, credentials map, permissions, curl templates, session recovery steps. |
| 2 | [agent-production-capability-regression-test.md](agent-production-capability-regression-test.md) | Before every maintenance session. Run all tests to prove access works before issuing any write SQL. |
| 3 | [agent-production-operations-manual.md](agent-production-operations-manual.md) | During the session. Operational modes, rollback procedures, table audit workflow, business rules, session checklists. |

---

## Emergency Recovery Path

Something broke. Use this order:

1. **Can't connect via FTP** → handover doc § 4 (credential inventory) + regression test doc § 4 (recovery matrix row: FTP failed)
2. **Endpoint returns 403 / 404 / 401** → regression test doc § 4 (recovery matrix) — each error code has an exact fix
3. **Accidental DELETE or UPDATE** → operations manual § Rollback Procedures — stop all writes immediately
4. **Broken config.php** → operations manual § Broken config.php — FTP download, compare, restore
5. **Claude has no context** → show it this file and say: *"Follow the method in docs/README_PRODUCTION_ACCESS.md"*

---

## One-line summary of each document

**Handover** — how to gain access.  
**Regression test** — how to prove access works.  
**Operations manual** — how to use access safely.
