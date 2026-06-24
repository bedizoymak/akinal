<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    ensure_account_type_columns();

    if ($method === 'GET') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id !== '') {
            $customer = fetch_customer($id);
            json_success([
                'customer' => $customer,
                'links' => fetch_all('SELECT project_id FROM ak_customer_projects WHERE customer_id = :id', ['id' => $id]),
                'projects' => fetch_all('SELECT id, title, slug FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
                'payment_plans' => fetch_all('SELECT * FROM ak_payment_plans WHERE customer_id = :id ORDER BY due_date ASC', ['id' => $id]),
                'payments' => fetch_all('SELECT * FROM ak_payments WHERE customer_id = :id ORDER BY payment_date DESC', ['id' => $id]),
                'financial_entries' => fetch_all('SELECT * FROM ak_financial_entries WHERE customer_id = :id ORDER BY entry_date DESC, created_at DESC', ['id' => $id]),
                'notes' => fetch_all('SELECT * FROM ak_customer_notes WHERE customer_id = :id ORDER BY created_at DESC', ['id' => $id]),
                'documents' => fetch_all('SELECT * FROM ak_documents WHERE customer_id = :id ORDER BY created_at DESC', ['id' => $id]),
            ]);
        }

        json_success([
            'customers' => fetch_all('SELECT * FROM ak_customers ORDER BY created_at DESC'),
            'payment_plans' => fetch_all('SELECT id, customer_id, amount, paid_amount, account_type, due_date, status FROM ak_payment_plans'),
            'payments' => fetch_all('SELECT customer_id, payment_plan_id, amount, account_type FROM ak_payments'),
            'financial_entries' => fetch_all("SELECT id, customer_id, amount, currency_tag, group_tag, direction, status, entry_date, due_date FROM ak_financial_entries WHERE customer_id IS NOT NULL AND direction = 'Gelir' AND status <> 'İptal'"),
            'customer_projects' => fetch_all('SELECT customer_id, project_id FROM ak_customer_projects'),
            'projects' => fetch_all('SELECT id, title FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        if (($input['action'] ?? '') === 'note') {
            $noteId = uuid_v4();
            db()->prepare('INSERT INTO ak_customer_notes (id, customer_id, note) VALUES (:id, :customer_id, :note)')->execute([
                'id' => $noteId,
                'customer_id' => require_non_empty($input, 'customer_id', 'Müşteri bulunamadı.'),
                'note' => require_non_empty($input, 'note', 'Not boş olamaz.'),
            ]);
            json_success(['note' => fetch_note($noteId)], 201);
        }

        $id = uuid_v4();
        $payload = customer_payload($input);
        $projectIds = require_customer_project_ids($input['project_ids'] ?? []);
        $payload['id'] = $id;
        db()->beginTransaction();
        insert_row('ak_customers', $payload);
        replace_customer_projects($id, $projectIds);
        db()->commit();
        json_success(['customer' => fetch_customer($id)], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Müşteri bulunamadı.');
        if (!fetch_customer($id)) {
            json_error('Müşteri bulunamadı.', 404);
        }
        $payload = customer_payload($input);
        $projectIds = require_customer_project_ids($input['project_ids'] ?? []);
        db()->beginTransaction();
        update_row('ak_customers', $payload, $id);
        replace_customer_projects($id, $projectIds);
        db()->commit();
        json_success(['customer' => fetch_customer($id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        $noteId = trim((string) ($_GET['note_id'] ?? ''));
        if ($noteId !== '') {
            db()->prepare('DELETE FROM ak_customer_notes WHERE id = :id')->execute(['id' => $noteId]);
            json_success(['deleted' => true]);
        }
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Müşteri bulunamadı.');
        }
        db()->prepare('DELETE FROM ak_customers WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    if (db()->inTransaction()) {
        db()->rollBack();
    }
    json_error('Müşteri işlemi tamamlanamadı.', 500);
}

function ensure_account_type_columns(): void
{
    ensure_account_type_column('ak_payment_plans', 'amount');
    ensure_account_type_column('ak_payments', 'amount');
    ensure_paid_amount_column();
    ensure_payment_method_columns();
}

function ensure_paid_amount_column(): void
{
    $statement = db()->query("SHOW COLUMNS FROM ak_payment_plans LIKE 'paid_amount'");
    if ($statement && $statement->fetch()) {
        return;
    }

    db()->exec("ALTER TABLE ak_payment_plans ADD COLUMN paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER amount");
}

function ensure_payment_method_columns(): void
{
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
}

function ensure_account_type_column(string $table, string $afterColumn): void
{
    $statement = db()->query("SHOW COLUMNS FROM {$table} LIKE 'account_type'");
    if ($statement && $statement->fetch()) {
        return;
    }

    db()->exec("ALTER TABLE {$table} ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT 'resmi' AFTER {$afterColumn}");
    db()->exec("ALTER TABLE {$table} ADD INDEX idx_{$table}_account_type (account_type)");
}

function customer_payload(array $input): array
{
    $customerType = nullable_string($input, 'customer_type') ?? 'Bireysel';
    if ($customerType === 'Firma') {
        $customerType = 'Kurumsal';
    }
    if (!in_array($customerType, ['Bireysel', 'Kurumsal'], true)) {
        json_error('Müşteri türü Bireysel veya Kurumsal olmalıdır.');
    }

    $isCorporate = $customerType === 'Kurumsal';
    $fullName = nullable_string($input, 'full_name');
    $companyName = nullable_string($input, 'company_name');
    if ($isCorporate && $companyName === null) {
        json_error('Firma Resmi Ünvanı zorunludur.');
    }
    if (!$isCorporate && $fullName === null) {
        json_error('Ad Soyad zorunludur.');
    }

    $phone = normalize_customer_phone(require_non_empty($input, 'phone', 'Telefon zorunludur.'));
    $whatsappInput = nullable_string($input, 'whatsapp');
    $whatsapp = $whatsappInput === null ? null : normalize_customer_whatsapp($whatsappInput);
    $email = nullable_string($input, 'email');
    if ($email !== null && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        json_error('Geçerli bir e-posta adresi girin.');
    }

    $taxNumber = nullable_string($input, 'tax_or_identity_number');
    if ($taxNumber !== null && !preg_match('/^\d{10,11}$/', $taxNumber)) {
        json_error('T.C. Kimlik / Vergi No yalnızca 10 veya 11 rakam olmalıdır.');
    }
    if ($isCorporate && $taxNumber === null) {
        json_error('Vergi No zorunludur.');
    }
    $address = nullable_string($input, 'address');
    if ($isCorporate && $address === null) {
        json_error('Adres zorunludur.');
    }

    return [
        'customer_type' => $customerType,
        'full_name' => $isCorporate ? null : $fullName,
        'company_name' => $isCorporate ? $companyName : null,
        'phone' => $phone,
        'whatsapp' => $whatsapp,
        'email' => $email,
        'tax_or_identity_number' => $taxNumber,
        'address' => $address,
        'city' => nullable_string($input, 'city'),
        'district' => nullable_string($input, 'district'),
        'status' => nullable_string($input, 'status') ?? 'Aktif',
        'notes' => nullable_string($input, 'notes'),
    ];
}

function require_customer_project_ids($projectIds): array
{
    $ids = is_array($projectIds) ? array_values(array_unique(array_filter(array_map('strval', $projectIds)))) : [];
    if ($ids === []) {
        json_error('En az bir ilgili proje seçmelisiniz.');
    }
    return $ids;
}

function replace_customer_projects(string $customerId, array $ids): void
{
    $pdo = db();
    $pdo->prepare('DELETE FROM ak_customer_projects WHERE customer_id = :id')->execute(['id' => $customerId]);
    if ($ids === []) return;
    $stmt = $pdo->prepare('INSERT INTO ak_customer_projects (id, customer_id, project_id) VALUES (:id, :customer_id, :project_id)');
    foreach ($ids as $projectId) {
        $stmt->execute(['id' => uuid_v4(), 'customer_id' => $customerId, 'project_id' => $projectId]);
    }
}

function normalize_customer_phone(string $value): string
{
    $digits = preg_replace('/\D+/', '', $value) ?? '';
    if (strlen($digits) === 12 && str_starts_with($digits, '90')) {
        $digits = '0' . substr($digits, 2);
    } elseif (strlen($digits) === 10 && str_starts_with($digits, '5')) {
        $digits = '0' . $digits;
    }
    if (!preg_match('/^05\d{9}$/', $digits)) {
        json_error('Telefon 05XXXXXXXXX biçiminde 11 haneli olmalıdır.');
    }
    return $digits;
}

function normalize_customer_whatsapp(string $value): string
{
    $phone = normalize_customer_phone($value);
    return '90' . substr($phone, 1);
}

function fetch_customer(string $id): ?array
{
    $rows = fetch_all('SELECT * FROM ak_customers WHERE id = :id LIMIT 1', ['id' => $id]);
    return $rows[0] ?? null;
}

function fetch_note(string $id): ?array
{
    $rows = fetch_all('SELECT * FROM ak_customer_notes WHERE id = :id LIMIT 1', ['id' => $id]);
    return $rows[0] ?? null;
}

function fetch_all(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function insert_row(string $table, array $payload): void
{
    $columns = array_keys($payload);
    db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload);
}

function update_row(string $table, array $payload, string $id): void
{
    $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload));
    $payload['id'] = $id;
    db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload);
}
