<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $summary_sql = "
            SELECT
                ec.id,
                ec.name,
                COALESCE(SUM(e.amount_try), 0)                          AS planned_total,
                COALESCE(SUM(e.paid_amount_try), 0)                     AS paid_total,
                COALESCE(SUM(e.amount_try) - SUM(e.paid_amount_try), 0) AS remaining_total,
                COUNT(e.id)                                              AS entry_count
            FROM ak_expense_cards ec
            LEFT JOIN ak_expense_card_financial_entries e ON e.expense_card_id = ec.id
        ";
        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') {
            json_success([
                'expense_items' => ec_fetch_all(
                    $summary_sql . ' WHERE ec.name LIKE :like GROUP BY ec.id, ec.name ORDER BY ec.name ASC LIMIT 50',
                    ['like' => '%' . $q . '%']
                ),
            ]);
        }
        json_success([
            'expense_items' => ec_fetch_all($summary_sql . ' GROUP BY ec.id, ec.name ORDER BY ec.name ASC'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $name  = require_non_empty($input, 'name', 'Gider kalemi adı zorunludur.');
        $id    = uuid_v4();
        db()->prepare('INSERT INTO ak_expense_cards (id, name) VALUES (:id, :name)')->execute(['id' => $id, 'name' => $name]);
        json_success(['expense_item' => ec_fetch_one($id)], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id    = require_non_empty($input, 'id', 'Gider kalemi bulunamadı.');
        if (!ec_fetch_one($id)) {
            json_error('Gider kalemi bulunamadı.', 404);
        }
        $name = require_non_empty($input, 'name', 'Gider kalemi adı zorunludur.');
        db()->prepare('UPDATE ak_expense_cards SET name = :name WHERE id = :id')->execute(['name' => $name, 'id' => $id]);
        json_success(['expense_item' => ec_fetch_one($id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Gider kalemi bulunamadı.');
        }
        if (!ec_fetch_one($id)) {
            json_error('Gider kalemi bulunamadı.', 404);
        }

        // Guard: never delete a card with linked financial entries. The confirm() dialog on the
        // frontend promises linked records are preserved — the backend used to silently do the
        // opposite (cascade-delete them). Preserve financial history: block the delete instead
        // (see audit P0 item B). Archive/passive behavior can be added later if needed.
        $countStmt = db()->prepare('SELECT COUNT(*) FROM ak_expense_card_financial_entries WHERE expense_card_id = :id');
        $countStmt->execute(['id' => $id]);
        $entryCount = (int) $countStmt->fetchColumn();
        if ($entryCount > 0) {
            json_error(
                "Bu masraf kartı silinemez, bağlı {$entryCount} finansal hareket var. "
                . 'Silme işlemi yalnızca bağlı kaydı olmayan masraf kartlarında yapılabilir.',
                409
            );
        }

        db()->prepare('DELETE FROM ak_expense_cards WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Gider kalemi işlemi tamamlanamadı.', 500);
}

function ec_fetch_all(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function ec_fetch_one(string $id): ?array
{
    $rows = ec_fetch_all(
        'SELECT ec.id, ec.name,
         COALESCE(SUM(e.amount_try), 0)                          AS planned_total,
         COALESCE(SUM(e.paid_amount_try), 0)                     AS paid_total,
         COALESCE(SUM(e.amount_try) - SUM(e.paid_amount_try), 0) AS remaining_total,
         COUNT(e.id)                                              AS entry_count
         FROM ak_expense_cards ec
         LEFT JOIN ak_expense_card_financial_entries e ON e.expense_card_id = ec.id
         WHERE ec.id = :id
         GROUP BY ec.id, ec.name
         LIMIT 1',
        ['id' => $id]
    );
    return $rows[0] ?? null;
}
