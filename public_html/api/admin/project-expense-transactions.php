<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

/**
 * "Today" is the current date in Europe/Istanbul (UTC+3, permanent since 2016).
 * Realized profitability: expense_date <= today.
 * Planned profitability: all transactions.
 */

const EXPENSE_CURRENCIES  = ['TRY', 'USD', 'EUR', 'XAU_GRAM'];
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

    if ($method === 'POST') {
        $input   = read_admin_json_body();
        $payload = pet_payload($input);
        $id      = uuid_v4();
        $payload['id'] = $id;
        $cols = array_keys($payload);
        db()->prepare(
            'INSERT INTO ak_project_expense_transactions (`' . implode('`, `', $cols) . '`) VALUES (:' . implode(', :', $cols) . ')'
        )->execute($payload);
        json_success(['transaction' => pet_fetch_one($id)], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id    = require_non_empty($input, 'id', 'Gider kaydı bulunamadı.');
        if (!pet_fetch_one($id)) json_error('Gider kaydı bulunamadı.', 404);
        $payload = pet_payload($input);
        $sets    = array_map(static fn($f) => "`{$f}` = :{$f}", array_keys($payload));
        $payload['id'] = $id;
        db()->prepare(
            'UPDATE ak_project_expense_transactions SET ' . implode(', ', $sets) . ' WHERE id = :id'
        )->execute($payload);
        json_success(['transaction' => pet_fetch_one($id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Gider kaydı bulunamadı.');
        }
        if (!pet_fetch_one($id)) json_error('Gider kaydı bulunamadı.', 404);
        db()->prepare('DELETE FROM ak_project_expense_transactions WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
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

function pet_payload(array $input): array
{
    $projectId     = require_non_empty($input, 'project_id', 'Proje seçimi zorunludur.');
    // expense_item_id is required at create/edit time (spec: "required when created").
    // It is only ever NULL at the DB level via FK ON DELETE SET NULL when the item is deleted.
    $expenseItemId = require_non_empty($input, 'expense_item_id', 'Gider kalemi seçimi zorunludur.');
    $snapshot      = require_non_empty($input, 'expense_item_name_snapshot', 'Gider kalemi adı zorunludur.');
    $amount        = require_positive_amount($input);
    $currency      = require_allowed_value($input, 'currency', EXPENSE_CURRENCIES, 'Geçerli bir para birimi seçilmelidir (TRY, USD, EUR, XAU_GRAM).');
    $date          = require_iso_date($input, 'expense_date', 'Geçerli bir gider tarihi zorunludur.');

    $rateRaw   = $input['exchange_rate_snapshot'] ?? null;
    $rate      = ($rateRaw !== null && $rateRaw !== '') ? (float) $rateRaw : null;
    if ($rate !== null && $rate <= 0) {
        json_error('Kur değeri 0\'dan büyük olmalıdır.');
    }
    $overridden = normalize_bool($input['exchange_rate_overridden'] ?? false);

    return [
        'project_id'                 => $projectId,
        'expense_item_id'            => $expenseItemId,
        'expense_item_name_snapshot' => $snapshot,
        'amount'                     => $amount,
        'currency'                   => $currency,
        'exchange_rate_snapshot'     => $rate,
        'exchange_rate_overridden'   => $overridden,
        'expense_date'               => $date,
    ];
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
