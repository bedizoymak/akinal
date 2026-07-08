<?php
declare(strict_types=1);

/**
 * DISABLED — this endpoint has been replaced by the migrations/ folder.
 *
 * This stub is intentionally kept so that any bookmarked or cached call to
 * this URL receives a clear error instead of a 404. It performs no DB writes,
 * no CREATE TABLE, no ALTER TABLE, and no migration logic.
 */

require_once __DIR__ . '/helpers.php';

require_admin();

http_response_code(410);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'success' => false,
    'message' => 'Bu eski migration endpoint\'i devre dışı bırakıldı. Yeni akış için aşağıdaki endpoint\'leri kullanın.',
    'new_endpoints' => [
        'preview' => '/api/admin/migrations/government-progress-payments-preview.php',
        'apply'   => '/api/admin/migrations/government-progress-payments-apply.php',
        'verify'  => '/api/admin/migrations/government-progress-payments-verify.php',
        'cleanup' => '/api/admin/migrations/government-progress-payments-cleanup.php',
    ],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
exit;
