<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    ensure_account_type_column();

    if ($method === 'GET') {
        json_success([
            'payments' => fetch_all('SELECT * FROM ak_payments ORDER BY payment_date DESC'),
            'customers' => fetch_all('SELECT * FROM ak_customers ORDER BY created_at DESC'),
            'projects' => fetch_all('SELECT id, title FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
            'payment_plans' => fetch_all('SELECT id, title, customer_id, project_id, amount, due_date, status FROM ak_payment_plans ORDER BY due_date ASC'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $id = uuid_v4();
        $payload = payment_payload($input);
        $payload['id'] = $id;
        insert_row('ak_payments', $payload);
        sync_customer_account_plan_statuses($payload['customer_id'], $payload['account_type']);
        json_success(['payment' => fetch_one('SELECT * FROM ak_payments WHERE id = :id', ['id' => $id])], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Tahsilat bulunamadı.');
        $previous = fetch_one('SELECT customer_id, account_type FROM ak_payments WHERE id = :id', ['id' => $id]);
        if (!$previous) {
            json_error('Tahsilat bulunamadı.', 404);
        }
        $payload = payment_payload($input);
        update_row('ak_payments', $payload, $id);
        sync_customer_account_plan_statuses($payload['customer_id'], $payload['account_type']);
        if ($previous && ((string) $previous['customer_id'] !== $payload['customer_id'] || account_type($previous) !== $payload['account_type'])) {
            sync_customer_account_plan_statuses((string) $previous['customer_id'], account_type($previous));
        }
        json_success(['payment' => fetch_one('SELECT * FROM ak_payments WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Tahsilat bulunamadı.');
        }
        $previous = fetch_one('SELECT customer_id, account_type FROM ak_payments WHERE id = :id', ['id' => $id]);
        if (!$previous) {
            json_error('Tahsilat bulunamadı.', 404);
        }
        db()->prepare('DELETE FROM ak_payments WHERE id = :id')->execute(['id' => $id]);
        sync_customer_account_plan_statuses((string) $previous['customer_id'], account_type($previous));
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Tahsilat işlemi tamamlanamadı.', 500);
}

function payment_payload(array $input): array
{
    $customerId = require_non_empty($input, 'customer_id', 'Müşteri zorunludur.');
    $accountType = account_type($input);
    $planId = nullable_string($input, 'payment_plan_id');
    if ($planId !== null) {
        $plan = fetch_one('SELECT customer_id, account_type FROM ak_payment_plans WHERE id = :id', ['id' => $planId]);
        if (!$plan) {
            json_error('Bağlı ödeme planı bulunamadı.', 404);
        }
        if ((string) ($plan['customer_id'] ?? '') !== $customerId || account_type($plan) !== $accountType) {
            json_error('Tahsilat ile ödeme planının müşteri veya hesap türü eşleşmiyor.');
        }
    }

    return [
        'customer_id' => $customerId,
        'project_id' => nullable_string($input, 'project_id'),
        'payment_plan_id' => $planId,
        'amount' => require_positive_amount($input),
        'account_type' => $accountType,
        'payment_date' => require_iso_date($input, 'payment_date', 'Geçerli bir tahsilat tarihi zorunludur.'),
        'payment_method' => require_allowed_value(
            $input,
            'payment_method',
            ['Nakit', 'Havale / EFT', 'Banka Havalesi / EFT', 'Kredi Kartı', 'Çek', 'Senet', 'Diğer'],
            'Geçerli bir ödeme yöntemi seçilmelidir.'
        ),
        'description' => nullable_string($input, 'description'),
        'document_url' => nullable_string($input, 'document_url'),
    ];
}

function account_type(array $input): string
{
    $value = (string) ($input['account_type'] ?? 'resmi');
    return in_array($value, ['resmi', 'gayri_resmi'], true) ? $value : 'resmi';
}

function ensure_account_type_column(): void
{
    $statement = db()->query("SHOW COLUMNS FROM ak_payments LIKE 'account_type'");
    if ($statement && $statement->fetch()) {
        return;
    }

    db()->exec("ALTER TABLE ak_payments ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT 'resmi' AFTER amount");
    db()->exec("ALTER TABLE ak_payments ADD INDEX idx_payments_account_type (account_type)");
}

function sync_plan_status(?string $planId): void
{
    if (!$planId) return;
    $plan = fetch_one('SELECT id, customer_id, account_type FROM ak_payment_plans WHERE id = :id', ['id' => $planId]);
    if (!$plan) return;
    sync_customer_account_plan_statuses((string) $plan['customer_id'], account_type($plan));
}

function sync_customer_account_plan_statuses(string $customerId, string $accountType): void
{
    if ($customerId === '') return;
    $plans = fetch_all(
        'SELECT id, amount, paid_amount, due_date, status FROM ak_payment_plans WHERE customer_id = :customer_id AND account_type = :account_type ORDER BY due_date ASC',
        ['customer_id' => $customerId, 'account_type' => $accountType]
    );
    $remainingCollection = (float) (fetch_one(
        'SELECT COALESCE(SUM(amount),0) AS paid FROM ak_payments WHERE customer_id = :customer_id AND account_type = :account_type',
        ['customer_id' => $customerId, 'account_type' => $accountType]
    )['paid'] ?? 0);
    $statement = db()->prepare('UPDATE ak_payment_plans SET status = :status WHERE id = :id');
    foreach ($plans as $plan) {
        if (($plan['status'] ?? null) === 'İptal' || ($plan['status'] ?? null) === 'Ödendi') {
            continue;
        }
        $amount = (float) $plan['amount'];
        $allocatedPaid = min($amount, max(0, $remainingCollection));
        $remainingCollection -= $allocatedPaid;
        $paid = max((float) ($plan['paid_amount'] ?? 0), $allocatedPaid);
        $status = derive_plan_status($amount, (string) $plan['due_date'], $paid);
        $statement->execute(['id' => $plan['id'], 'status' => $status]);
    }
}

function derive_plan_status(float $amount, string $dueDate, float $paid): string
{
    if ($paid <= 0) {
        return $dueDate < date('Y-m-d') ? 'Vadesi Geçti' : 'Bekliyor';
    }
    return $paid >= $amount ? 'Ödendi' : 'Kısmi Ödendi';
}

function fetch_all(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one(string $sql, array $params = []): ?array { $rows = fetch_all($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function insert_row(string $table, array $payload): void { $columns = array_keys($payload); db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload); }
function update_row(string $table, array $payload, string $id): void { $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload)); $payload['id'] = $id; db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload); }
