<?php
declare(strict_types=1);

/**
 * Table 8 migration — ak_payment_plans redesign.
 *
 * Converts ak_payment_plans from a polymorphic payment-scheduling table
 * into a simple customer-only collection ledger.
 *
 * Changes:
 *   - Renames  due_date → date
 *   - Adds     type VARCHAR(80) DEFAULT 'Diğer'
 *   - Adds     currency VARCHAR(10) DEFAULT 'TRY'
 *   - Drops    17 legacy/migration columns
 *   - Backfills status values to new strings
 *   - Updates  indexes
 *
 * Run once on existing installations. Safe to re-run (idempotent column checks).
 * Delete this file from the server immediately after a successful run.
 */

const ENABLE_MIGRATION = false;

if (!ENABLE_MIGRATION) {
    http_response_code(403);
    echo "<pre>Migration is disabled.\nSet ENABLE_MIGRATION = true to run.\nDelete this file from the server immediately after a successful run.</pre>";
    exit;
}

if (($_GET['confirm'] ?? '') !== 'RUN_TABLE8_MIGRATION') {
    echo "<pre>Migration locked.\nOpen migrate-table8.php?confirm=RUN_TABLE8_MIGRATION to proceed.</pre>";
    exit;
}

$host     = 'localhost';
$database = 'akinalin_wp282';
$username = 'MYSQL_USERNAME_HERE';
$password = 'MYSQL_PASSWORD_HERE';
$charset  = 'utf8mb4';

try {
    $pdo = new PDO(
        "mysql:host={$host};dbname={$database};charset={$charset}",
        $username,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo "<pre>Database connection failed.</pre>";
    exit;
}

$log = [];

function col_exists(PDO $pdo, string $col): bool
{
    return (bool) $pdo->query("SHOW COLUMNS FROM ak_payment_plans LIKE '{$col}'")->fetch();
}

function idx_exists(PDO $pdo, string $idx): bool
{
    return (bool) $pdo->query("SHOW INDEX FROM ak_payment_plans WHERE Key_name = '{$idx}'")->fetch();
}

function run(PDO $pdo, string $sql, array &$log): void
{
    try {
        $pdo->exec($sql);
        $log[] = "OK: " . substr(trim($sql), 0, 120);
    } catch (PDOException $e) {
        $log[] = "SKIP (already done or N/A): " . substr(trim($sql), 0, 120);
    }
}

// ── Step 1: Add new columns ───────────────────────────────────────────────────

if (!col_exists($pdo, 'type')) {
    run($pdo, "ALTER TABLE ak_payment_plans ADD COLUMN `type` VARCHAR(80) NOT NULL DEFAULT 'Diğer' AFTER description", $log);
}
if (!col_exists($pdo, 'currency')) {
    run($pdo, "ALTER TABLE ak_payment_plans ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'TRY' AFTER paid_amount", $log);
}

// ── Step 2: Rename due_date → date ───────────────────────────────────────────

if (col_exists($pdo, 'due_date') && !col_exists($pdo, 'date')) {
    run($pdo, "ALTER TABLE ak_payment_plans CHANGE COLUMN due_date `date` DATE NOT NULL", $log);
    $log[] = "Renamed due_date → date";
}

// ── Step 3: Backfill status values ───────────────────────────────────────────

run($pdo, "UPDATE ak_payment_plans SET status = 'Planlanan'           WHERE status IN ('Bekliyor')", $log);
run($pdo, "UPDATE ak_payment_plans SET status = 'Gecikmiş'            WHERE status IN ('Vadesi Geçti')", $log);
run($pdo, "UPDATE ak_payment_plans SET status = 'Kısmi Ödendi'        WHERE status IN ('Kısmi Ödendi')", $log);
run($pdo, "UPDATE ak_payment_plans SET status = 'Planlanan'           WHERE status NOT IN ('Ödendi','Fazla Ödendi','Planlanan','Gecikmiş','Kısmi Ödendi','Kısmi Ödendi + Gecikmiş')", $log);
run($pdo, "UPDATE ak_payment_plans SET status = 'Planlanan' WHERE status IS NULL OR status = ''", $log);

// ── Step 4: Drop removed columns (idempotent) ────────────────────────────────

$dropCols = [
    'employee_id', 'expense_card_id', 'business_transaction_id',
    'counterparty_type', 'counterparty_id', 'direction',
    'allocation_scope', 'allocation_note', 'category_code',
    'subcategory_code', 'migration_confidence', 'reconciliation_status',
    'archived_at', 'archived_by', 'canceled_at', 'canceled_by', 'cancellation_reason',
];
foreach ($dropCols as $col) {
    if (col_exists($pdo, $col)) {
        run($pdo, "ALTER TABLE ak_payment_plans DROP COLUMN `{$col}`", $log);
    }
}

// ── Step 5: Update indexes ────────────────────────────────────────────────────

$dropIndexes = [
    'idx_payment_plans_employee_id',
    'idx_payment_plans_expense_card_id',
    'idx_payment_plans_due_date',
    'idx_payment_plans_counterparty',
    'idx_payment_plans_business_transaction',
    'idx_payment_plans_reconciliation',
];
foreach ($dropIndexes as $idx) {
    if (idx_exists($pdo, $idx)) {
        run($pdo, "ALTER TABLE ak_payment_plans DROP INDEX `{$idx}`", $log);
    }
}

if (!idx_exists($pdo, 'idx_payment_plans_date')) {
    run($pdo, "ALTER TABLE ak_payment_plans ADD KEY idx_payment_plans_date (`date`)", $log);
}
if (!idx_exists($pdo, 'idx_payment_plans_status')) {
    run($pdo, "ALTER TABLE ak_payment_plans ADD KEY idx_payment_plans_status (status)", $log);
}

// ── Step 6: Enforce NOT NULL on customer_id and project_id ───────────────────
//
// The new schema requires both columns NOT NULL. Before enforcing this,
// detect orphan rows and halt — never silently delete production data.

$orphanStmt = $pdo->query(
    "SELECT p.id, p.customer_id, p.project_id, p.title
       FROM ak_payment_plans p
      WHERE p.customer_id IS NULL OR p.project_id IS NULL"
);
$orphans = $orphanStmt->fetchAll();

if (count($orphans) > 0) {
    echo "<pre>MIGRATION HALTED — orphan rows detected.\n\n";
    echo "These rows have NULL customer_id or project_id and cannot be migrated automatically.\n";
    echo "Resolve them manually, then re-run the migration.\n\n";
    echo str_pad('id', 38) . str_pad('customer_id', 38) . str_pad('project_id', 38) . "title\n";
    echo str_repeat('-', 140) . "\n";
    foreach ($orphans as $row) {
        echo str_pad((string) ($row['id'] ?? 'NULL'), 38)
           . str_pad((string) ($row['customer_id'] ?? 'NULL'), 38)
           . str_pad((string) ($row['project_id'] ?? 'NULL'), 38)
           . htmlspecialchars((string) ($row['title'] ?? ''))
           . "\n";
    }
    echo "\nLog up to this point:\n";
    foreach ($log as $line) { echo htmlspecialchars($line) . "\n"; }
    echo "</pre>";
    exit;
}

run($pdo, "ALTER TABLE ak_payment_plans MODIFY COLUMN customer_id CHAR(36) NOT NULL", $log);
run($pdo, "ALTER TABLE ak_payment_plans MODIFY COLUMN project_id  CHAR(36) NOT NULL", $log);

// ── Step 7: Update FK constraints (SET NULL → RESTRICT) ──────────────────────
//
// ON DELETE SET NULL conflicts with NOT NULL columns. Replace with RESTRICT.

function fk_exists(PDO $pdo, string $fk): bool
{
    $stmt = $pdo->prepare("SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ak_payment_plans' AND CONSTRAINT_NAME = :fk LIMIT 1");
    $stmt->execute(['fk' => $fk]);
    return (bool) $stmt->fetch();
}

if (fk_exists($pdo, 'fk_payment_plans_customer')) {
    run($pdo, "ALTER TABLE ak_payment_plans DROP FOREIGN KEY fk_payment_plans_customer", $log);
}
run($pdo, "ALTER TABLE ak_payment_plans ADD CONSTRAINT fk_payment_plans_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE RESTRICT", $log);

if (fk_exists($pdo, 'fk_payment_plans_project')) {
    run($pdo, "ALTER TABLE ak_payment_plans DROP FOREIGN KEY fk_payment_plans_project", $log);
}
run($pdo, "ALTER TABLE ak_payment_plans ADD CONSTRAINT fk_payment_plans_project FOREIGN KEY (project_id) REFERENCES ak_projects(id) ON DELETE RESTRICT", $log);

// ── Done ──────────────────────────────────────────────────────────────────────

echo "<pre>Table 8 migration complete.\n\n";
foreach ($log as $line) {
    echo htmlspecialchars($line) . "\n";
}
echo "\nDelete this file from the server immediately.</pre>";
