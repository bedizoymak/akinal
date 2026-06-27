<?php
declare(strict_types=1);

/**
 * One-shot additive migration: adds contract_total_try to ak_projects.
 * Idempotent: checks column existence before ALTER.
 * DELETE THIS FILE from the server immediately after a successful run.
 *
 * Usage:
 *   https://akinalinsaat.com/migrate-add-contract-total.php?confirm=ADD_CONTRACT_TOTAL
 */

require_once __DIR__ . '/api/db.php';

if (($_GET['confirm'] ?? '') !== 'ADD_CONTRACT_TOTAL') {
    http_response_code(403);
    echo "<pre>Locked.\nRun: migrate-add-contract-total.php?confirm=ADD_CONTRACT_TOTAL\nDelete this file immediately after use.</pre>";
    exit;
}

try {
    $pdo = db();

    $check = $pdo->prepare(
        "SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name    = 'ak_projects'
           AND column_name   = 'contract_total_try'"
    );
    $check->execute();

    if ((int) $check->fetchColumn() > 0) {
        echo "<pre>Column ak_projects.contract_total_try already exists — nothing to do.\nDelete this file now.</pre>";
        exit;
    }

    $pdo->exec("ALTER TABLE ak_projects ADD COLUMN contract_total_try DECIMAL(14,2) NULL");

    echo "<pre>Migration complete: ak_projects.contract_total_try DECIMAL(14,2) NULL added.\nDelete this file now.</pre>";
} catch (Throwable $e) {
    http_response_code(500);
    echo "<pre>Migration failed: " . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . "</pre>";
}
