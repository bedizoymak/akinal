<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    ensure_account_type_column();

    if ($method === 'GET') {
        json_success([
            'payment_plans' => fetch_all('SELECT * FROM ak_payment_plans ORDER BY due_date ASC'),
            'customers' => fetch_all('SELECT * FROM ak_customers ORDER BY created_at DESC'),
            'projects' => fetch_all('SELECT id, title FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
            'payments' => fetch_all('SELECT customer_id, payment_plan_id, amount, account_type, payment_date FROM ak_payments'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $id = uuid_v4();
        $payload = plan_payload($input);
        $payload['id'] = $id;
        insert_row('ak_payment_plans', $payload);
        sync_customer_account_plan_statuses($payload['customer_id'], $payload['account_type']);
        json_success(['payment_plan' => fetch_one('SELECT * FROM ak_payment_plans WHERE id = :id', ['id' => $id])], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Ödeme planı bulunamadı.');
        $previous = fetch_one('SELECT customer_id, account_type FROM ak_payment_plans WHERE id = :id', ['id' => $id]);
        $payload = plan_payload($input);
        update_row('ak_payment_plans', $payload, $id);
        sync_customer_account_plan_statuses($payload['customer_id'], $payload['account_type']);
        if ($previous && ((string) $previous['customer_id'] !== $payload['customer_id'] || account_type($previous) !== $payload['account_type'])) {
            sync_customer_account_plan_statuses((string) $previous['customer_id'], account_type($previous));
        }
        json_success(['payment_plan' => fetch_one('SELECT * FROM ak_payment_plans WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Ödeme planı bulunamadı.');
        }
        $previous = fetch_one('SELECT customer_id, account_type FROM ak_payment_plans WHERE id = :id', ['id' => $id]);
        db()->prepare('DELETE FROM ak_payment_plans WHERE id = :id')->execute(['id' => $id]);
        if ($previous) {
            sync_customer_account_plan_statuses((string) $previous['customer_id'], account_type($previous));
        }
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('Method not allowed.', 405);
} catch (Throwable $exception) {
    json_error('Ödeme planı işlemi tamamlanamadı.', 500);
}

function plan_payload(array $input): array
{
    return [
        'customer_id' => require_non_empty($input, 'customer_id', 'Müşteri zorunludur.'),
        'project_id' => nullable_string($input, 'project_id'),
        'title' => require_non_empty($input, 'title', 'Başlık zorunludur.'),
        'description' => nullable_string($input, 'description'),
        'amount' => (float) ($input['amount'] ?? 0),
        'account_type' => account_type($input),
        'due_date' => require_non_empty($input, 'due_date', 'Vade tarihi zorunludur.'),
        'status' => payment_plan_status($input),
        'notes' => nullable_string($input, 'notes'),
    ];
}

function account_type(array $input): string
{
    $value = (string) ($input['account_type'] ?? 'resmi');
    return in_array($value, ['resmi', 'gayri_resmi'], true) ? $value : 'resmi';
}

function payment_plan_status(array $input): string
{
    $value = nullable_string($input, 'status') ?? 'Bekliyor';
    return in_array($value, ['Ödendi', 'Bekliyor', 'Vadesi Geçti', 'Kısmi Ödendi', 'İptal'], true) ? $value : 'Bekliyor';
}

function ensure_account_type_column(): void
{
    $statement = db()->query("SHOW COLUMNS FROM ak_payment_plans LIKE 'account_type'");
    if ($statement && $statement->fetch()) {
        return;
    }

    db()->exec("ALTER TABLE ak_payment_plans ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT 'resmi' AFTER amount");
    db()->exec("ALTER TABLE ak_payment_plans ADD INDEX idx_payment_plans_account_type (account_type)");
}

function fetch_all(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one(string $sql, array $params = []): ?array { $rows = fetch_all($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function insert_row(string $table, array $payload): void { $columns = array_keys($payload); db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload); }
function update_row(string $table, array $payload, string $id): void { $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload)); $payload['id'] = $id; db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload); }

function sync_customer_account_plan_statuses(string $customerId, string $accountType): void
{
    if ($customerId === '') return;
    $plans = fetch_all(
        'SELECT id, amount, due_date, status FROM ak_payment_plans WHERE customer_id = :customer_id AND account_type = :account_type ORDER BY due_date ASC',
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
        $paid = min($amount, max(0, $remainingCollection));
        $remainingCollection -= $paid;
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
