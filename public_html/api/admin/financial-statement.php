<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $kind = trim((string) ($_GET['kind'] ?? ''));
        $entityId = trim((string) ($_GET['id'] ?? ''));

        if (!in_array($kind, ['project', 'customer', 'employee', 'expense'], true)) {
            json_error('Geçersiz ekstre türü.');
        }

        if ($entityId === '') {
            json_error('Ekstre kaydı bulunamadı.');
        }

        json_success([
            'entity' => fetch_statement_entity($kind, $entityId),
            'entries' => fetch_statement_entries($kind, $entityId),
            'projects' => fetch_all_statement_rows('SELECT id, title, location, project_status FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
            'customers' => fetch_all_statement_rows('SELECT id, customer_type, full_name, company_name, phone, email, tax_or_identity_number, status FROM ak_customers ORDER BY created_at DESC'),
            'employees' => fetch_all_statement_rows('SELECT * FROM ak_employees ORDER BY full_name ASC'),
            'expense_cards' => fetch_all_statement_rows('SELECT * FROM ak_expense_cards ORDER BY name ASC'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $id = uuid_v4();
        $payload = financial_entry_payload($input);
        $payload['id'] = $id;
        insert_statement_row('ak_financial_entries', $payload);
        json_success(['entry' => fetch_one_statement_row('SELECT * FROM ak_financial_entries WHERE id = :id', ['id' => $id])], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Finansal hareket bulunamadı.');
        update_statement_row('ak_financial_entries', financial_entry_payload($input), $id);
        json_success(['entry' => fetch_one_statement_row('SELECT * FROM ak_financial_entries WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Finansal hareket bulunamadı.');
        }

        db()->prepare('DELETE FROM ak_financial_entries WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('Method not allowed.', 405);
} catch (Throwable $exception) {
    json_error('Ekstre işlemi tamamlanamadı.', 500);
}

function statement_fixed_column(string $kind): string
{
    if ($kind === 'project') {
        return 'project_id';
    }
    if ($kind === 'customer') {
        return 'customer_id';
    }
    if ($kind === 'employee') {
        return 'employee_id';
    }
    return 'expense_card_id';
}

function fetch_statement_entity(string $kind, string $id): ?array
{
    if ($kind === 'project') {
        return fetch_one_statement_row('SELECT id, title, location, project_status FROM ak_projects WHERE id = :id', ['id' => $id]);
    }
    if ($kind === 'customer') {
        return fetch_one_statement_row('SELECT id, customer_type, full_name, company_name, phone, email, tax_or_identity_number, status FROM ak_customers WHERE id = :id', ['id' => $id]);
    }
    if ($kind === 'employee') {
        return fetch_one_statement_row('SELECT * FROM ak_employees WHERE id = :id', ['id' => $id]);
    }
    return fetch_one_statement_row('SELECT * FROM ak_expense_cards WHERE id = :id', ['id' => $id]);
}

function fetch_statement_entries(string $kind, string $id): array
{
    $column = statement_fixed_column($kind);
    $stmt = db()->prepare("SELECT * FROM ak_financial_entries WHERE `{$column}` = :id ORDER BY entry_date DESC, created_at DESC");
    $stmt->execute(['id' => $id]);
    return $stmt->fetchAll() ?: [];
}

function financial_entry_payload(array $input): array
{
    $cardType = require_non_empty($input, 'card_type', 'Hareket türü zorunludur.');
    if (!in_array($cardType, ['customer', 'employee', 'expense'], true)) {
        json_error('Geçersiz hareket türü.');
    }

    $amount = (float) ($input['amount'] ?? 0);
    if ($amount <= 0) {
        json_error('Tutar 0dan buyuk olmalidir.');
    }

    return [
        'project_id' => nullable_string($input, 'project_id'),
        'entry_date' => require_non_empty($input, 'entry_date', 'Tarih zorunludur.'),
        'card_type' => $cardType,
        'customer_id' => $cardType === 'customer' ? nullable_string($input, 'customer_id') : null,
        'employee_id' => $cardType === 'employee' ? nullable_string($input, 'employee_id') : null,
        'expense_card_id' => $cardType === 'expense' ? nullable_string($input, 'expense_card_id') : null,
        'title' => require_non_empty($input, 'title', 'Başlık zorunludur.'),
        'description' => nullable_string($input, 'description'),
        'amount' => $amount,
        'currency_tag' => require_non_empty($input, 'currency_tag', 'Para birimi zorunludur.'),
        'group_tag' => require_non_empty($input, 'group_tag', 'Kayıt grubu zorunludur.'),
        'direction' => require_non_empty($input, 'direction', 'Hareket tipi zorunludur.'),
        'status' => require_non_empty($input, 'status', 'Durum zorunludur.'),
        'document_url' => nullable_string($input, 'document_url'),
    ];
}

function fetch_all_statement_rows(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function fetch_one_statement_row(string $sql, array $params = []): ?array
{
    $rows = fetch_all_statement_rows($sql . ' LIMIT 1', $params);
    return $rows[0] ?? null;
}

function insert_statement_row(string $table, array $payload): void
{
    $columns = array_keys($payload);
    db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload);
}

function update_statement_row(string $table, array $payload, string $id): void
{
    $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload));
    $payload['id'] = $id;
    db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload);
}
