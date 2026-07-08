<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id !== '') {
            $customer = fetch_customer($id);
            json_success([
                'customer' => $customer,
                'links' => fetch_all('SELECT project_id FROM ak_customer_projects WHERE customer_id = :id', ['id' => $id]),
                'projects' => fetch_project_lookup(true),
                'payment_plans' => fetch_all('SELECT * FROM ak_payment_plans WHERE customer_id = :id ORDER BY due_date ASC', ['id' => $id]),
                'payments' => fetch_all('SELECT * FROM ak_payments WHERE customer_id = :id ORDER BY payment_date DESC', ['id' => $id]),
                'financial_entries' => fetch_customer_financial_entries($id),
                'government_progress_payments' => fetch_government_progress_payments($id),
            ]);
        }

        $customers = fetch_all('SELECT * FROM ak_customers ORDER BY created_at DESC');
        if ($customers === []) {
            json_success([
                'customers' => [],
                'payment_plans' => [],
                'payments' => [],
                'financial_entries' => [],
                'customer_projects' => [],
                'projects' => fetch_project_lookup(false),
            ]);
        }

        $projects = fetch_project_lookup(false);
        json_success([
            'customers' => $customers,
            'payment_plans' => fetch_all('SELECT id, customer_id, amount, paid_amount, payment_method, account_type, due_date, status FROM ak_payment_plans WHERE customer_id IS NOT NULL'),
            'payments' => fetch_all('SELECT customer_id, payment_plan_id, amount, account_type FROM ak_payments'),
            'financial_entries' => fetch_customer_financial_entry_summary(),
            'customer_projects' => fetch_all('SELECT customer_id, project_id FROM ak_customer_projects'),
            'projects' => $projects,
        ]);
    }

    if ($method === 'POST') {
        ensure_account_type_columns();
        $input = read_admin_json_body();
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
        ensure_account_type_columns();
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
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Müşteri bulunamadı.');
        }
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $counts = [];

            // Check if ak_payment_plan_settlements exists (late-added table; may be absent on older installs)
            $settlementsExist = (bool) $pdo->query(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ak_payment_plan_settlements'"
            )->fetchColumn();

            if ($settlementsExist) {
                // 1a. Settlements linked to this customer's payment plans (RESTRICT on payment_plan_id)
                $s = $pdo->prepare(
                    'DELETE FROM ak_payment_plan_settlements WHERE payment_plan_id IN (SELECT id FROM ak_payment_plans WHERE customer_id = :id)'
                );
                $s->execute(['id' => $id]); $counts['payment_plan_settlements_via_plans'] = $s->rowCount();

                // 1b. Settlements linked to this customer's legacy financial entries (RESTRICT on financial_entry_id)
                $s = $pdo->prepare(
                    'DELETE FROM ak_payment_plan_settlements WHERE financial_entry_id IN (SELECT id FROM ak_financial_entries WHERE customer_id = :id)'
                );
                $s->execute(['id' => $id]); $counts['payment_plan_settlements_via_entries'] = $s->rowCount();
            }

            // 2. Canonical customer financial entries (RESTRICT on customer_id)
            $s = $pdo->prepare('DELETE FROM ak_customer_financial_entries WHERE customer_id = :id');
            $s->execute(['id' => $id]); $counts['customer_financial_entries'] = $s->rowCount();

            // 3. Legacy financial entries (SET NULL FK; delete for clean removal)
            $s = $pdo->prepare('DELETE FROM ak_financial_entries WHERE customer_id = :id');
            $s->execute(['id' => $id]); $counts['financial_entries'] = $s->rowCount();

            // 4. Notifications (SET NULL FK; delete stale records)
            $s = $pdo->prepare('DELETE FROM ak_notifications WHERE related_customer_id = :id');
            $s->execute(['id' => $id]); $counts['notifications'] = $s->rowCount();

            // 5. Payment plans (RESTRICT; settlements already removed above)
            $s = $pdo->prepare('DELETE FROM ak_payment_plans WHERE customer_id = :id');
            $s->execute(['id' => $id]); $counts['payment_plans'] = $s->rowCount();

            // 6. Legacy payments (SET NULL FK; delete for clean removal)
            $s = $pdo->prepare('DELETE FROM ak_payments WHERE customer_id = :id');
            $s->execute(['id' => $id]); $counts['payments'] = $s->rowCount();

            // 7. Legacy expenses (SET NULL FK; delete for clean removal)
            $s = $pdo->prepare('DELETE FROM ak_expenses WHERE customer_id = :id');
            $s->execute(['id' => $id]); $counts['expenses'] = $s->rowCount();

            // 8. Notes and project links (CASCADE FKs; explicit for safety)
            $s = $pdo->prepare('DELETE FROM ak_customer_notes WHERE customer_id = :id');
            $s->execute(['id' => $id]); $counts['customer_notes'] = $s->rowCount();
            $s = $pdo->prepare('DELETE FROM ak_customer_projects WHERE customer_id = :id');
            $s->execute(['id' => $id]); $counts['customer_projects'] = $s->rowCount();

            // 9. Parent
            $pdo->prepare('DELETE FROM ak_customers WHERE id = :id')->execute(['id' => $id]);
            $pdo->commit();
            json_success(['deleted' => true, 'counts' => $counts]);
        } catch (Throwable $txEx) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $txEx;
        }
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    log_customer_api_exception($exception, $method);
    try {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
    } catch (Throwable $rollbackException) {
        log_customer_api_exception($rollbackException, $method . ':rollback');
    }
    $safeReason = ($exception instanceof PDOException)
        ? 'Veritabanı hatası: ' . $exception->getCode()
        : get_class($exception);
    json_error('Müşteri işlemi tamamlanamadı. (' . $safeReason . ')', 500);
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
    $fullName = $isCorporate ? null : nullable_string($input, 'full_name');
    $companyName = $isCorporate ? nullable_string($input, 'company_name') : null;
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
    if ($taxNumber !== null && !preg_match($isCorporate ? '/^\d{10,11}$/' : '/^\d{11}$/', $taxNumber)) {
        json_error($isCorporate ? 'Vergi No 10 veya 11 rakam olmalıdır.' : 'T.C. Kimlik No 11 rakam olmalıdır.');
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
    $nationalNumber = normalize_customer_mobile_national_number($value);
    if ($nationalNumber === null) {
        json_error('Telefon 05XXXXXXXXX biçiminde 11 haneli olmalıdır.');
    }
    return '0' . $nationalNumber;
}

function normalize_customer_whatsapp(string $value): string
{
    $nationalNumber = normalize_customer_mobile_national_number($value);
    if ($nationalNumber === null) {
        json_error('WhatsApp numarası geçerli bir Türkiye cep telefonu olmalıdır.');
    }
    return '90' . $nationalNumber;
}

function normalize_customer_mobile_national_number(string $value): ?string
{
    $digits = preg_replace('/\D+/', '', $value) ?? '';
    if (strlen($digits) === 12 && substr($digits, 0, 2) === '90') {
        $digits = substr($digits, 2);
    } elseif (strlen($digits) === 11 && substr($digits, 0, 1) === '0') {
        $digits = substr($digits, 1);
    }
    return preg_match('/^5\d{9}$/', $digits) ? $digits : null;
}

function fetch_customer(string $id): ?array
{
    $rows = fetch_all('SELECT * FROM ak_customers WHERE id = :id LIMIT 1', ['id' => $id]);
    return $rows[0] ?? null;
}

function fetch_all(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function fetch_project_lookup(bool $includeSlug): array
{
    try {
        if (!table_exists('ak_projects')) {
            return [];
        }

        $columns = table_columns('ak_projects');
        if (!in_array('id', $columns, true) || !in_array('title', $columns, true)) {
            return [];
        }

        $select = ['id', 'title'];
        if ($includeSlug) {
            $select[] = optional_column_expression($columns, 'slug', 'NULL');
        }

        $order = [];
        if (in_array('sort_order', $columns, true)) {
            $order[] = 'sort_order ASC';
        }
        if (in_array('created_at', $columns, true)) {
            $order[] = 'created_at DESC';
        }
        $orderBy = $order === [] ? '' : ' ORDER BY ' . implode(', ', $order);

        return fetch_all('SELECT ' . implode(', ', $select) . ' FROM ak_projects' . $orderBy);
    } catch (Throwable $exception) {
        log_customer_api_exception($exception, 'project_lookup');
        return [];
    }
}

function fetch_customer_financial_entries(string $customerId): array
{
    if (!table_exists('ak_customer_financial_entries')) {
        return [];
    }
    // Temporary migration safety filter: exclude Hakediş entries until cleanup migration is confirmed
    $rows = fetch_all(
        "SELECT id, customer_id, amount_try, paid_amount_try, account_type, entry_date
         FROM ak_customer_financial_entries
         WHERE customer_id = :id AND status <> 'İptal' AND title NOT LIKE '%Hakediş%'
         ORDER BY entry_date DESC",
        ['id' => $customerId]
    );
    return map_cfe_entries_to_legacy($rows);
}

function fetch_customer_financial_entry_summary(): array
{
    if (!table_exists('ak_customer_financial_entries')) {
        return [];
    }
    // Temporary migration safety filter: exclude Hakediş entries until cleanup migration is confirmed
    $rows = fetch_all(
        "SELECT id, customer_id, amount_try, paid_amount_try, account_type, entry_date
         FROM ak_customer_financial_entries
         WHERE status <> 'İptal' AND title NOT LIKE '%Hakediş%'"
    );
    return map_cfe_entries_to_legacy($rows);
}

function fetch_government_progress_payments(string $customerId): array
{
    if (!table_exists('ak_government_progress_payments')) {
        return [];
    }
    $stmt = db()->prepare(
        'SELECT gpp.*, p.title AS project_title
           FROM ak_government_progress_payments gpp
           LEFT JOIN ak_projects p ON p.id = gpp.project_id
          WHERE gpp.customer_id = :cid
          ORDER BY gpp.due_date ASC, gpp.created_at ASC'
    );
    $stmt->execute(['cid' => $customerId]);
    return $stmt->fetchAll() ?: [];
}

/**
 * Maps ak_customer_financial_entries rows to the shape expected by summarizeCustomerLedgerEntries.
 * Two synthetic rows per entry:
 *   "Planlandı" row  → amount_try   → accumulates into ledgerSummary.planned (Planlanan Alacak)
 *   "Gerçekleşti" row → paid_amount_try → accumulates into ledgerSummary.paid (Tahsil Edilen)
 * So: remaining = planned - paid = amount_try - paid_amount_try (Kalan Bakiye)
 */
function map_cfe_entries_to_legacy(array $rows): array
{
    $result = [];
    foreach ($rows as $row) {
        $groupTag = ($row['account_type'] ?? 'resmi') === 'resmi' ? 'Resmi' : 'Gayri Resmi';
        $amtTry   = (float) ($row['amount_try'] ?? 0);
        $paidTry  = (float) ($row['paid_amount_try'] ?? 0);
        $date     = $row['entry_date'] ?? null;
        $result[] = [
            'id'           => $row['id'] . ':p',
            'customer_id'  => $row['customer_id'],
            'amount'       => $amtTry,
            'direction'    => 'Gelir',
            'status'       => 'Planlandı',
            'currency_tag' => 'TRY',
            'group_tag'    => $groupTag,
            'entry_date'   => $date,
            'due_date'     => $date,
        ];
        if ($paidTry > 0.0) {
            $result[] = [
                'id'           => $row['id'] . ':r',
                'customer_id'  => $row['customer_id'],
                'amount'       => $paidTry,
                'direction'    => 'Gelir',
                'status'       => 'Gerçekleşti',
                'currency_tag' => 'TRY',
                'group_tag'    => $groupTag,
                'entry_date'   => $date,
                'due_date'     => $date,
            ];
        }
    }
    return $result;
}

function optional_column_expression(array $columns, string $column, string $fallback): string
{
    return in_array($column, $columns, true)
        ? "`{$column}`"
        : "{$fallback} AS `{$column}`";
}

function table_exists(string $table): bool
{
    $statement = db()->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1'
    );
    $statement->execute(['table' => $table]);
    return (bool) $statement->fetchColumn();
}

function table_columns(string $table): array
{
    $statement = db()->query("SHOW COLUMNS FROM `{$table}`");
    return array_map(static fn(array $row): string => (string) $row['Field'], $statement->fetchAll() ?: []);
}

function log_customer_api_exception(Throwable $exception, string $context): void
{
    error_log(sprintf(
        '[customers.php] context=%s type=%s code=%s message=%s file=%s line=%d',
        $context,
        get_class($exception),
        (string) $exception->getCode(),
        $exception->getMessage(),
        basename($exception->getFile()),
        $exception->getLine()
    ));
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
