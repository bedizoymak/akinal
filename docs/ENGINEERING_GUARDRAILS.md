STRICT RULE — AKINAL INSAAT DATABASE ACCESS

- If the SQL Editor works, database connectivity is considered verified.
- Local PDO + localhost tests are NOT definitive proof of database accessibility.
- The hosting server's localhost and a developer PC's localhost are different environments.
- Database-dependent audit, classifier, and reconciliation tools should be executed server-side whenever possible.
- For remote MySQL access, host authorization must be verified before debugging credentials or application code.
- public_html/api/config.php is the source of truth for database configuration.
- Temporary environment-variable overrides must be treated as suspect until verified against the active SQL Editor configuration.
- Before introducing staging environments, new connection strings, or alternative database access methods, first validate against the existing SQL Editor connection path.
- When a database connection fails, always determine where the code is running before investigating credentials.
- A successful server-side SQL Editor query outweighs a failed local localhost connection test.

PROJECT LESSON LEARNED

The root cause was not SQL, PHP, PDO, credentials, or network connectivity.

The root cause was:
Local localhost ≠ Hosting localhost

The database credentials were valid.
The database was reachable.
The SQL Editor was already using the correct connection.

Future investigations must start from the known-working SQL Editor connection path.