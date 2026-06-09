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
        json_success(['payment_plan' => fetch_one('SELECT * FROM ak_payment_plans WHERE id = :id', ['id' => $id])], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Ödeme planı bulunamadı.');
        if (!fetch_one('SELECT id FROM ak_payment_plans WHERE id = :id', ['id' => $id])) {
            json_error('Ödeme planı bulunamadı.', 404);
        }
        $payload = plan_payload($input);
        update_row('ak_payment_plans', $payload, $id);
        json_success(['payment_plan' => fetch_one('SELECT * FROM ak_payment_plans WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Ödeme planı bulunamadı.');
        }
        $previous = fetch_one('SELECT customer_id, account_type FROM ak_payment_plans WHERE id = :id', ['id' => $id]);
        if (!$previous) {
            json_error('Ödeme planı bulunamadı.', 404);
        }
        db()->prepare('DELETE FROM ak_payment_plans WHERE id = :id')->execute(['id' => $id]);
        sync_customer_account_plan_statuses((string) $previous['customer_id'], account_type($previous));
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Ödeme planı işlemi tamamlanamadı.', 500);
}

function plan_payload(array $input): array
{
    $customerId = nullable_string($input, 'customer_id');
    $employeeId = nullable_string($input, 'employee_id');
    $expenseCardId = nullable_string($input, 'expense_card_id');
    $ownerIds = array_filter([$customerId, $employeeId, $expenseCardId], static fn($value) => $value !== null);
    if (count($ownerIds) !== 1) {
        json_error('Tek bir müşteri, personel veya tedarikçi kartı seçilmelidir.');
    }

    $amount = require_positive_amount($input);
    $method = payment_method($input);
    $dueDate = require_iso_date($input, 'due_date', 'Geçerli bir vade tarihi zorunludur.');

    return [
        'customer_id' => $customerId,
        'employee_id' => $employeeId,
        'expense_card_id' => $expenseCardId,
        'project_id' => nullable_string($input, 'project_id'),
        'title' => require_non_empty($input, 'title', 'Başlık zorunludur.'),
        'description' => nullable_string($input, 'description'),
        'amount' => $amount,
        'paid_amount' => normalized_paid_amount($input, $amount),
        'payment_method' => $method,
        'transaction_reference' => nullable_string($input, 'transaction_reference'),
        'card_note' => nullable_string($input, 'card_note'),
        'cheque_maturity_date' => $method === 'Çek' ? require_iso_date($input, 'cheque_maturity_date', 'Geçerli bir çek vade tarihi zorunludur.') : null,
        'cheque_no' => $method === 'Çek' ? nullable_string($input, 'cheque_no') : null,
        'bank_name' => $method === 'Çek' ? nullable_string($input, 'bank_name') : null,
        'promissory_maturity_date' => $method === 'Senet' ? require_iso_date($input, 'promissory_maturity_date', 'Geçerli bir senet vade tarihi zorunludur.') : null,
        'account_type' => account_type($input),
        'due_date' => $dueDate,
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
    return in_array($value, ['Ödendi', 'Bekliyor', 'Vadesi Geçti', 'Kısmi Ödendi'], true) ? $value : 'Bekliyor';
}

function payment_method(array $input): string
{
    $value = nullable_string($input, 'payment_method') ?? 'Nakit';
    return in_array($value, ['Nakit', 'Banka Havalesi / EFT', 'Kredi Kartı', 'Çek', 'Senet'], true) ? $value : 'Nakit';
}

function normalized_paid_amount(array $input, float $amount): float
{
    $status = payment_plan_status($input);
    $paidAmount = (float) ($input['paid_amount'] ?? 0);
    if ($status === 'Ödendi') {
        return $amount;
    }
    if ($status === 'Kısmi Ödendi') {
        if ($paidAmount <= 0 || $paidAmount >= $amount) {
            json_error('Kısmi ödeme tutarı 0 değerinden büyük ve toplam tutardan küçük olmalıdır.');
        }
        return $paidAmount;
    }
    return 0;
}

function ensure_account_type_column(): void
{
    $statement = db()->query("SHOW COLUMNS FROM ak_payment_plans LIKE 'account_type'");
    if (!$statement || !$statement->fetch()) {
        db()->exec("ALTER TABLE ak_payment_plans ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT 'resmi' AFTER amount");
        db()->exec("ALTER TABLE ak_payment_plans ADD INDEX idx_payment_plans_account_type (account_type)");
    }

    $statement = db()->query("SHOW COLUMNS FROM ak_payment_plans LIKE 'paid_amount'");
    if (!$statement || !$statement->fetch()) {
        db()->exec("ALTER TABLE ak_payment_plans ADD COLUMN paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER amount");
    }

    $columns = [
        'payment_method' => "ALTER TABLE ak_payment_plans ADD COLUMN payment_method VARCHAR(40) NOT NULL DEFAULT 'Nakit' AFTER paid_amount",
        'transaction_reference' => "ALTER TABLE ak_payment_plans ADD COLUMN transaction_reference VARCHAR(120) NULL AFTER payment_method",
        'card_note' => "ALTER TABLE ak_payment_plans ADD COLUMN card_note VARCHAR(255) NULL AFTER transaction_reference",
        'cheque_maturity_date' => "ALTER TABLE ak_payment_plans ADD COLUMN cheque_maturity_date DATE NULL AFTER card_note",
        'cheque_no' => "ALTER TABLE ak_payment_plans ADD COLUMN cheque_no VARCHAR(80) NULL AFTER cheque_maturity_date",
        'bank_name' => "ALTER TABLE ak_payment_plans ADD COLUMN bank_name VARCHAR(120) NULL AFTER cheque_no",
        'promissory_maturity_date' => "ALTER TABLE ak_payment_plans ADD COLUMN promissory_maturity_date DATE NULL AFTER bank_name",
    ];
    foreach ($columns as $column => $sql) {
        $statement = db()->query("SHOW COLUMNS FROM ak_payment_plans LIKE '{$column}'");
        if (!$statement || !$statement->fetch()) {
            db()->exec($sql);
        }
    }

    $statement = db()->query("SHOW COLUMNS FROM ak_payment_plans LIKE 'employee_id'");
    if (!$statement || !$statement->fetch()) {
        db()->exec("ALTER TABLE ak_payment_plans ADD COLUMN employee_id CHAR(36) NULL AFTER customer_id");
        db()->exec("ALTER TABLE ak_payment_plans ADD INDEX idx_payment_plans_employee_id (employee_id)");
    }

    $statement = db()->query("SHOW COLUMNS FROM ak_payment_plans LIKE 'expense_card_id'");
    if (!$statement || !$statement->fetch()) {
        db()->exec("ALTER TABLE ak_payment_plans ADD COLUMN expense_card_id CHAR(36) NULL AFTER employee_id");
        db()->exec("ALTER TABLE ak_payment_plans ADD INDEX idx_payment_plans_expense_card_id (expense_card_id)");
    }
}

function fetch_all(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one(string $sql, array $params = []): ?array { $rows = fetch_all($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function insert_row(string $table, array $payload): void { $columns = array_keys($payload); db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload); }
function update_row(string $table, array $payload, string $id): void { $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload)); $payload['id'] = $id; db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload); }

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
