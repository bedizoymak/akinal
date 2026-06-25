<?php
declare(strict_types=1);

/**
 * Table 7 migration: ak_expense_cards narrowing + ak_project_expense_transactions creation.
 *
 * Safe to re-run: CREATE TABLE IF NOT EXISTS; ALTER TABLE only adds if missing.
 * Run once on an existing installation; delete this file immediately afterward.
 */

$host     = 'localhost';
$database = 'akinalin_wp282';
$username = 'MYSQL_USERNAME_HERE';
$password = 'MYSQL_PASSWORD_HERE';
$charset  = 'utf8mb4';

const ENABLE_MIGRATION = false;

if (!ENABLE_MIGRATION) {
    http_response_code(403);
    echo "<pre>Migration is disabled.\nSet ENABLE_MIGRATION = true, run once, then delete this file.</pre>";
    exit;
}

if (($_GET['confirm'] ?? '') !== 'RUN_TABLE7_MIGRATION') {
    echo "<pre>Open migrate-table7.php?confirm=RUN_TABLE7_MIGRATION to run.</pre>";
    exit;
}

$dsn = "mysql:host={$host};dbname={$database};charset={$charset}";

try {
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    echo "<pre>\nConnected to {$database}.\n\n";

    // 1. Create ak_project_expense_transactions
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS ak_project_expense_transactions (
  id                        CHAR(36)       NOT NULL PRIMARY KEY,
  project_id                CHAR(36)       NOT NULL,
  expense_item_id           CHAR(36)           NULL,
  expense_item_name_snapshot VARCHAR(255)   NOT NULL,
  amount                    DECIMAL(14,4)  NOT NULL,
  currency                  VARCHAR(10)    NOT NULL DEFAULT 'TRY',
  exchange_rate_snapshot    DECIMAL(18,8)      NULL,
  exchange_rate_overridden  TINYINT(1)     NOT NULL DEFAULT 0,
  expense_date              DATE           NOT NULL,
  created_at                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_pet_project        (project_id),
  KEY idx_pet_expense_item   (expense_item_id),
  KEY idx_pet_date           (expense_date),
  KEY idx_pet_project_date   (project_id, expense_date),
  KEY idx_pet_currency       (currency),
  CONSTRAINT fk_pet_project      FOREIGN KEY (project_id)      REFERENCES ak_projects(id)      ON DELETE RESTRICT,
  CONSTRAINT fk_pet_expense_item FOREIGN KEY (expense_item_id) REFERENCES ak_expense_cards(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
    echo "Created (or already existed): ak_project_expense_transactions\n";

    // 2. Remove legacy columns from ak_expense_cards if they exist
    $legacyCols = ['category', 'description', 'status', 'created_at', 'updated_at'];
    $existingCols = $pdo->query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ak_expense_cards'"
    )->fetchAll(PDO::FETCH_COLUMN);
    $existingCols = array_map('strtolower', $existingCols);

    foreach ($legacyCols as $col) {
        if (in_array(strtolower($col), $existingCols, true)) {
            $pdo->exec("ALTER TABLE ak_expense_cards DROP COLUMN `{$col}`");
            echo "Dropped column: ak_expense_cards.{$col}\n";
        } else {
            echo "Column already absent: ak_expense_cards.{$col}\n";
        }
    }

    // 3. Add name index if missing
    $indexes = $pdo->query(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ak_expense_cards' AND INDEX_NAME = 'idx_expense_cards_name'"
    )->fetchAll(PDO::FETCH_COLUMN);
    if (empty($indexes)) {
        $pdo->exec("ALTER TABLE ak_expense_cards ADD KEY idx_expense_cards_name (name)");
        echo "Added index: ak_expense_cards.idx_expense_cards_name\n";
    } else {
        echo "Index already exists: ak_expense_cards.idx_expense_cards_name\n";
    }

    echo "\nTable 7 migration complete. Delete this file now.\n</pre>";
} catch (Throwable $e) {
    http_response_code(500);
    echo "<pre>Migration failed:\n" . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . "</pre>";
}
