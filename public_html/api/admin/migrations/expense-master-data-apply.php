<?php

declare(strict_types=1);

require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../auth.php';

require_admin();

try {
    $pdo = db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS ak_expense_categories (
        id CHAR(36) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_expense_categories_name (name),
        KEY idx_expense_categories_active (is_active),
        KEY idx_expense_categories_sort_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS ak_expense_items (
        id CHAR(36) NOT NULL PRIMARY KEY,
        category_id CHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        default_unit VARCHAR(100) NULL,
        default_vat_rate DECIMAL(5,2) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_expense_items_category_name (category_id, name),
        KEY idx_expense_items_category (category_id),
        KEY idx_expense_items_active (is_active),
        CONSTRAINT fk_expense_items_category FOREIGN KEY (category_id) REFERENCES ak_expense_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    ensure_column_exists($pdo, 'ak_expenses', 'category_id', "ALTER TABLE ak_expenses ADD COLUMN category_id CHAR(36) NULL AFTER category");
    ensure_column_exists($pdo, 'ak_expenses', 'expense_item_id', "ALTER TABLE ak_expenses ADD COLUMN expense_item_id CHAR(36) NULL AFTER category_id");
    ensure_index_exists($pdo, 'ak_expenses', 'idx_expenses_category_id', "ALTER TABLE ak_expenses ADD INDEX idx_expenses_category_id (category_id)");
    ensure_index_exists($pdo, 'ak_expenses', 'idx_expenses_expense_item_id', "ALTER TABLE ak_expenses ADD INDEX idx_expenses_expense_item_id (expense_item_id)");
    ensure_constraint_exists($pdo, 'ak_expenses', 'fk_expenses_category', "ALTER TABLE ak_expenses ADD CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES ak_expense_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE");
    ensure_constraint_exists($pdo, 'ak_expenses', 'fk_expenses_expense_item', "ALTER TABLE ak_expenses ADD CONSTRAINT fk_expenses_expense_item FOREIGN KEY (expense_item_id) REFERENCES ak_expense_items(id) ON DELETE RESTRICT ON UPDATE CASCADE");

    $pdo->exec("CREATE TABLE IF NOT EXISTS ak_expense_item_category_seed (
        id CHAR(36) NOT NULL PRIMARY KEY,
        category_name VARCHAR(255) NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_seed_category_item (category_name, item_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    json_success([
        'tables_created' => [
            'ak_expense_categories' => true,
            'ak_expense_items' => true,
        ],
        'columns_added' => true,
        'indexes_verified' => true,
        'constraints_verified' => true,
    ]);
} catch (Throwable $exception) {
    json_error('Masraf master veri migration’ı başarısız oldu.', 500);
}

function ensure_column_exists(PDO $pdo, string $table, string $column, string $ddl): void
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column');
    $stmt->execute(['table' => $table, 'column' => $column]);
    if ((int) $stmt->fetchColumn() === 0) {
        $pdo->exec($ddl);
    }
}

function ensure_index_exists(PDO $pdo, string $table, string $indexName, string $ddl): void
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :index_name');
    $stmt->execute(['table' => $table, 'index_name' => $indexName]);
    if ((int) $stmt->fetchColumn() === 0) {
        $pdo->exec($ddl);
    }
}

function ensure_constraint_exists(PDO $pdo, string $table, string $constraintName, string $ddl): void
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND CONSTRAINT_NAME = :constraint_name');
    $stmt->execute(['table' => $table, 'constraint_name' => $constraintName]);
    if ((int) $stmt->fetchColumn() === 0) {
        $pdo->exec($ddl);
    }
}
