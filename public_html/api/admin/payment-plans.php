<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

const PLAN_TYPES      = ['Kapora', 'Taksit', 'Hakediş', 'Diğer'];
const PLAN_CURRENCIES = ['TRY', 'USD', 'EUR', 'XAU_GRAM'];
const PLAN_METHODS    = ['Nakit', 'Banka Havalesi / EFT', 'Kredi Kartı', 'Çek', 'Senet'];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id !== '') {
            $plan = pp_fetch_one($id);
            if (!$plan) json_error('Tahsilat kalemi bulunamadı.', 404);
            json_success(['payment_plan' => $plan]);
        }

        $plans    = pp_fetch_all('SELECT * FROM ak_payment_plans WHERE customer_id IS NOT NULL ORDER BY `date` ASC');
        $customers = pp_fetch_all('SELECT * FROM ak_customers ORDER BY created_at DESC');
        $projects  = pp_fetch_all('SELECT id, title FROM ak_projects ORDER BY sort_order ASC, created_at DESC');

        json_success([
            'payment_plans' => array_map('pp_with_auto_status', $plans),
            'customers'     => $customers,
            'projects'      => $projects,
        ]);
    }

    if ($method === 'POST') {
        $input   = read_admin_json_body();
        $payload = pp_payload($input);
        $id      = uuid_v4();
        $payload['id'] = $id;
        $cols = array_keys($payload);
        db()->prepare(
            'INSERT INTO ak_payment_plans (`' . implode('`, `', $cols) . '`) VALUES (:' . implode(', :', $cols) . ')'
        )->execute($payload);
        json_success(['payment_plan' => pp_fetch_one($id)], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id    = require_non_empty($input, 'id', 'Tahsilat kalemi bulunamadı.');
        if (!pp_fetch_one($id)) json_error('Tahsilat kalemi bulunamadı.', 404);
        $payload = pp_payload($input);
        $sets    = array_map(static fn($f) => "`{$f}` = :{$f}", array_keys($payload));
        $payload['id'] = $id;
        db()->prepare(
            'UPDATE ak_payment_plans SET ' . implode(', ', $sets) . ' WHERE id = :id'
        )->execute($payload);
        json_success(['payment_plan' => pp_fetch_one($id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Tahsilat kalemi bulunamadı.');
        }
        if (!pp_fetch_one($id)) json_error('Tahsilat kalemi bulunamadı.', 404);
        db()->prepare('DELETE FROM ak_payment_plans WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Tahsilat kalemi işlemi tamamlanamadı.', 500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pp_fetch_all(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function pp_fetch_one(string $id): ?array
{
    $rows = pp_fetch_all('SELECT * FROM ak_payment_plans WHERE id = :id LIMIT 1', ['id' => $id]);
    $plan = $rows[0] ?? null;
    return $plan ? pp_with_auto_status($plan) : null;
}

function pp_with_auto_status(array $plan): array
{
    $plan['status'] = pp_auto_status(
        (float) ($plan['amount'] ?? 0),
        (float) ($plan['paid_amount'] ?? 0),
        (string) ($plan['date'] ?? '')
    );
    // expose both date and due_date for backward-compat with frontend consumers
    $plan['due_date'] = $plan['date'] ?? null;
    return $plan;
}

function pp_auto_status(float $amount, float $paid, string $date): string
{
    $today    = date('Y-m-d');
    $isOverdue = $date !== '' && $date < $today;

    if ($paid <= 0) {
        return $isOverdue ? 'Gecikmiş' : 'Planlanan';
    }
    if ($paid >= $amount && $amount > 0) {
        return $paid > $amount ? 'Fazla Ödendi' : 'Ödendi';
    }
    return $isOverdue ? 'Kısmi Ödendi + Gecikmiş' : 'Kısmi Ödendi';
}

function pp_payload(array $input): array
{
    $customerId = require_non_empty($input, 'customer_id', 'Müşteri seçimi zorunludur.');
    $projectId  = require_non_empty($input, 'project_id', 'Proje seçimi zorunludur.');
    $title      = require_non_empty($input, 'title', 'Başlık zorunludur.');
    $amount     = require_positive_amount($input);
    $paidAmount = max(0.0, (float) ($input['paid_amount'] ?? 0));
    $date       = require_iso_date($input, 'date', 'Geçerli bir tarih zorunludur.');

    $type     = require_allowed_value($input, 'type', PLAN_TYPES, 'Geçerli bir tür seçilmelidir.');
    $currency = require_allowed_value($input, 'currency', PLAN_CURRENCIES, 'Geçerli bir para birimi seçilmelidir.');

    $rawMethod = nullable_string($input, 'payment_method') ?? 'Nakit';
    $payMethod = in_array($rawMethod, PLAN_METHODS, true) ? $rawMethod : 'Nakit';

    $status = pp_auto_status($amount, $paidAmount, $date);

    $accountType = nullable_string($input, 'account_type') ?? 'resmi';
    $accountType = in_array($accountType, ['resmi', 'gayri_resmi'], true) ? $accountType : 'resmi';

    return [
        'customer_id'             => $customerId,
        'project_id'              => $projectId,
        'title'                   => $title,
        'description'             => nullable_string($input, 'description'),
        'type'                    => $type,
        'amount'                  => $amount,
        'paid_amount'             => $paidAmount,
        'currency'                => $currency,
        'payment_method'          => $payMethod,
        'transaction_reference'   => nullable_string($input, 'transaction_reference'),
        'card_note'               => nullable_string($input, 'card_note'),
        'cheque_maturity_date'    => $payMethod === 'Çek' ? require_iso_date($input, 'cheque_maturity_date', 'Çek vade tarihi zorunludur.') : null,
        'cheque_no'               => $payMethod === 'Çek' ? nullable_string($input, 'cheque_no') : null,
        'bank_name'               => $payMethod === 'Çek' ? nullable_string($input, 'bank_name') : null,
        'promissory_maturity_date'=> $payMethod === 'Senet' ? require_iso_date($input, 'promissory_maturity_date', 'Senet vade tarihi zorunludur.') : null,
        'account_type'            => $accountType,
        'date'                    => $date,
        'status'                  => $status,
        'notes'                   => nullable_string($input, 'notes'),
    ];
}
