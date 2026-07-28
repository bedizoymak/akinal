<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

/**
 * "Today" is the current date in Europe/Istanbul (UTC+3, permanent since 2016).
 * Realized profitability: expense_date <= today.
 * Planned profitability: all transactions.
 */

const ISTANBUL_TZ_EXPR    = "DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00'))";

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $projectId = trim((string) ($_GET['project_id'] ?? ''));
        $singleId  = trim((string) ($_GET['id'] ?? ''));

        if ($singleId !== '') {
            $tx = pet_fetch_one($singleId);
            if (!$tx) json_error('Gider kaydı bulunamadı.', 404);
            json_success(['transaction' => $tx]);
        }

        if ($projectId === '') json_error('project_id zorunludur.', 400);

        $transactions = pet_fetch_all(
            'SELECT * FROM ak_project_expense_transactions
              WHERE project_id = :pid
              ORDER BY expense_date DESC, created_at DESC',
            ['pid' => $projectId]
        );

        $project = pet_fetch_all(
            'SELECT id, title FROM ak_projects WHERE id = :id LIMIT 1',
            ['id' => $projectId]
        )[0] ?? null;

        json_success([
            'transactions'  => $transactions,
            'profitability' => pet_profitability($projectId),
            'project'       => $project,
        ]);
    }

    // ak_project_expense_transactions is a deprecated write path: entries made here are never
    // read by project-statement.php, Genel Bakış, Gidenler, or any other current report (see
    // audit P0 item E). Writes are disabled to stop new data from disappearing into this table;
    // existing rows are left in place (read via GET above) and must not be deleted.
    if ($method === 'POST' || $method === 'PATCH' || $method === 'DELETE') {
        json_error(
            'Bu modül artık kullanım dışıdır (deprecated). Yeni giderler Gidenler veya Masraf Kartları '
            . 'üzerinden kart tabanlı finansal hareket olarak girilmelidir.',
            409
        );
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Gider işlemi tamamlanamadı.', 500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pet_fetch_all(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function pet_fetch_one(string $id): ?array
{
    $rows = pet_fetch_all(
        'SELECT * FROM ak_project_expense_transactions WHERE id = :id LIMIT 1',
        ['id' => $id]
    );
    return $rows[0] ?? null;
}

function pet_profitability(string $projectId): array
{
    $todayExpr = ISTANBUL_TZ_EXPR;
    $rows = pet_fetch_all(
        "SELECT
           currency,
           SUM(amount)                                                         AS planned_total,
           SUM(CASE WHEN expense_date <= {$todayExpr} THEN amount ELSE 0 END) AS realized_total
         FROM ak_project_expense_transactions
         WHERE project_id = :pid
         GROUP BY currency",
        ['pid' => $projectId]
    );

    $realized = [];
    $planned  = [];
    foreach ($rows as $row) {
        $c            = $row['currency'];
        $realized[$c] = (string) $row['realized_total'];
        $planned[$c]  = (string) $row['planned_total'];
    }

    $todayRow = db()->query("SELECT {$todayExpr} AS today")->fetch();
    $today    = $todayRow['today'] ?? date('Y-m-d');

    return compact('realized', 'planned', 'today');
}
