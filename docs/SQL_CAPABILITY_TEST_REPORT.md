# SQL Capability Test Report

## Scope

- Execution environment: hosting server
- Connection source: `public_html/api/config.php` through `public_html/api/db.php`
- Expected database: `akinalin_wp282`
- Isolated table: `ak_capability_test_20260615_194854`
- Test data: one synthetic row only
- Existing application tables touched: none

## Results

| Capability | Verification | Result |
| --- | --- | --- |
| SELECT | `SELECT DATABASE()` returned `akinalin_wp282`; inserted and updated row reads matched expected synthetic values | PASS |
| CREATE | Test table appeared in `information_schema.tables` | PASS |
| INSERT | One synthetic row was inserted and received a valid ID | PASS |
| UPDATE | One synthetic row was updated and the new value was read back | PASS |
| DELETE | One synthetic row was deleted and `COUNT(*)` returned `0` | PASS |
| DROP | Test table was dropped and no longer appeared in `information_schema.tables` | PASS |

## Step Verification

1. `SELECT DATABASE()`: PASS
2. `CREATE TABLE`: PASS
3. `INSERT` fake row: PASS
4. `SELECT` inserted row: PASS
5. `UPDATE` fake row: PASS
6. `SELECT` updated row: PASS
7. `DELETE` fake row: PASS
8. Confirm `COUNT(*) = 0`: PASS
9. `DROP TABLE`: PASS
10. Confirm table no longer exists: PASS

## Cleanup

- Isolated test table removed: confirmed
- Temporary hosting endpoint removed: confirmed
- Secrets printed: none
- Migrations run: none
