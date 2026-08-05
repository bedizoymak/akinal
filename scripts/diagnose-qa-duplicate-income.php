<?php
declare(strict_types=1);

/**
 * Phase 0 safety harness (read-only): finds duplicate/orphan customer-payment
 * rows for the QA project/customer that could explain the ₺55,000 discrepancy
 * described in P0-2. Performs SELECT queries only — no INSERT/UPDATE/DELETE.
 *
 * Run with: php scripts/diagnose-qa-duplicate-income.php
 */

$root = dirname(__DIR__);
require_once $root . '/public_html/api/db.php';

const QA_PROJECT_ID = 'a75bd005-088e-4b04-8c1f-b699773f0e1b';
const QA_CUSTOMER_ID = 'afdff20f-b26c-4864-8f8c-18499574bb54';

$pdo = db();

echo "== All ak_customer_financial_entries rows for the QA project ==\n";
$stmt = $pdo->prepare(
    'SELECT id, title, currency, amount_try, paid_amount_try, entry_date, created_at, updated_at
     FROM ak_customer_financial_entries
     WHERE project_id = :p OR customer_id = :c
     ORDER BY created_at ASC'
);
$stmt->execute(['p' => QA_PROJECT_ID, 'c' => QA_CUSTOMER_ID]);
$rows = $stmt->fetchAll();
foreach ($rows as $row) {
    printf(
        "  id=%s title=%-45s currency=%-4s amount_try=%12s paid_amount_try=%12s entry_date=%s created_at=%s\n",
        $row['id'],
        $row['title'],
        $row['currency'],
        $row['amount_try'],
        $row['paid_amount_try'],
        $row['entry_date'],
        $row['created_at']
    );
}

echo "\n== Possible duplicate rows: same title/amount created close together ==\n";
$dupStmt = $pdo->prepare(
    "SELECT title, paid_amount_try, COUNT(*) AS cnt, GROUP_CONCAT(id) AS ids
     FROM ak_customer_financial_entries
     WHERE project_id = :p OR customer_id = :c
     GROUP BY title, paid_amount_try
     HAVING COUNT(*) > 1"
);
$dupStmt->execute(['p' => QA_PROJECT_ID, 'c' => QA_CUSTOMER_ID]);
$dups = $dupStmt->fetchAll();
if ($dups === []) {
    echo "  none found by exact (title, paid_amount_try) match\n";
} else {
    foreach ($dups as $d) {
        printf("  title=%s paid_amount_try=%s count=%d ids=%s\n", $d['title'], $d['paid_amount_try'], $d['cnt'], $d['ids']);
    }
}

echo "\n== Any row with paid_amount_try = 55000.00 (the unexplained extra) ==\n";
$fiftyFive = $pdo->prepare(
    'SELECT id, title, project_id, customer_id, paid_amount_try, entry_date, created_at
     FROM ak_customer_financial_entries
     WHERE paid_amount_try = 55000.00
     ORDER BY created_at ASC'
);
$fiftyFive->execute();
$candidates = $fiftyFive->fetchAll();
if ($candidates === []) {
    echo "  none found\n";
} else {
    foreach ($candidates as $c) {
        printf(
            "  id=%s title=%-45s project_id=%s customer_id=%s entry_date=%s created_at=%s\n",
            $c['id'],
            $c['title'],
            $c['project_id'],
            $c['customer_id'],
            $c['entry_date'],
            $c['created_at']
        );
    }
}

echo "\n== Orphan rows: project_id/customer_id referencing deleted parents ==\n";
$orphan = $pdo->query(
    "SELECT cfe.id, cfe.title, cfe.project_id, cfe.customer_id
     FROM ak_customer_financial_entries cfe
     LEFT JOIN ak_projects p ON p.id = cfe.project_id
     LEFT JOIN ak_customers c ON c.id = cfe.customer_id
     WHERE p.id IS NULL OR c.id IS NULL"
)->fetchAll();
if ($orphan === []) {
    echo "  none found\n";
} else {
    foreach ($orphan as $o) {
        printf("  id=%s title=%s project_id=%s customer_id=%s\n", $o['id'], $o['title'], $o['project_id'], $o['customer_id']);
    }
}

echo "\nDone. This script performed SELECT statements only; no rows were modified.\n";
