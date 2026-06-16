<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/canonical-read-flags.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $plans = fetch_all('SELECT * FROM ak_payment_plans ORDER BY due_date ASC');
        $payments = fetch_all('SELECT customer_id, payment_plan_id, amount, account_type, payment_date FROM ak_payments');
        json_success([
            'payment_plans' => canonical_read_select('payment_plans.payment_plans', $plans, array_map(static function (array $plan): array {
                $plan['status'] = canonical_read_legacy_status_from_paid(
                    canonical_read_money($plan['amount'] ?? 0),
                    (string) ($plan['due_date'] ?? ''),
                    canonical_read_money($plan['paid_amount'] ?? 0)
                );
                return $plan;
            }, canonical_read_plan_states($plans, $payments))),
            'customers' => fetch_all('SELECT * FROM ak_customers ORDER BY created_at DESC'),
            'projects' => fetch_all('SELECT id, title FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
            'payments' => $payments,
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
        $linkedPayment = fetch_one('SELECT id FROM ak_payments WHERE payment_plan_id = :id', ['id' => $id]);
        if ($linkedPayment) {
            json_error('Bu ödeme planına bağlı tahsilat kayıtları bulunduğu için plan silinemez. Önce bağlı tahsilatları kontrol edin.', 409);
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
    $payments = fetch_all(
        'SELECT payment_plan_id, amount FROM ak_payments WHERE customer_id = :customer_id AND account_type = :account_type',
        ['customer_id' => $customerId, 'account_type' => $accountType]
    );
    $linkedCollections = [];
    $remainingCollection = 0.0;
    foreach ($payments as $payment) {
        $planId = trim((string) ($payment['payment_plan_id'] ?? ''));
        $amount = max(0.0, (float) ($payment['amount'] ?? 0));
        if ($planId === '') {
            $remainingCollection += $amount;
            continue;
        }
        $linkedCollections[$planId] = ($linkedCollections[$planId] ?? 0.0) + $amount;
    }
    $statement = db()->prepare('UPDATE ak_payment_plans SET status = :status WHERE id = :id');
    foreach ($plans as $plan) {
        if (($plan['status'] ?? null) === 'İptal' || ($plan['status'] ?? null) === 'Ödendi') {
            continue;
        }
        $amount = (float) $plan['amount'];
        $linkedPaid = min($amount, max(0.0, (float) ($linkedCollections[$plan['id']] ?? 0)));
        $unlinkedPaid = min(max(0.0, $amount - $linkedPaid), max(0.0, $remainingCollection));
        $remainingCollection -= $unlinkedPaid;
        $allocatedPaid = $linkedPaid + $unlinkedPaid;
        $paid = max((float) ($plan['paid_amount'] ?? 0), $allocatedPaid);
        $status = canonical_read_legacy_status_from_paid($amount, (string) $plan['due_date'], $paid);
        $statement->execute(['id' => $plan['id'], 'status' => $status]);
    }
}
