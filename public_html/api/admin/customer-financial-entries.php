<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/finance-entry-helpers.php';
require_once __DIR__ . '/inflation-helper.php';

require_admin();

/**
 * Post-process enriched customer entries with TÜFE inflation adjustment.
 * Only applied to unpaid/partial entries — does not mutate stored amounts.
 */
function cfe_add_inflation(array $entries): array
{
    $plannedStatuses = ['Planlanan', 'Gecikmiş', 'Kısmi Ödendi'];
    $indexType = preferred_inflation_index_type();
    foreach ($entries as &$entry) {
        $inflationFields = inflation_null_fields();
        $amountTry  = (float) ($entry['amount_try'] ?? 0);
        $status     = (string) ($entry['status'] ?? '');
        $createdAt  = (string) ($entry['created_at'] ?? '');
        $entryDate  = (string) ($entry['entry_date'] ?? '');
        if (in_array($status, $plannedStatuses, true) && $amountTry > 0 && $createdAt !== '' && $entryDate !== '') {
            $adj = calculate_inflation_adjustment($amountTry, $createdAt, $entryDate, $indexType);
            // Fall back to TUFE if preferred type lacks data for these periods
            if ($adj === null && $indexType !== 'TUFE') {
                $adj = calculate_inflation_adjustment($amountTry, $createdAt, $entryDate, 'TUFE');
            }
            if ($adj !== null) {
                $inflationFields = $adj;
            }
        }
        $entry = array_merge($entry, $inflationFields);
    }
    unset($entry);
    return $entries;
}

const CFE_TABLE = 'ak_customer_financial_entries';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $id         = trim((string) ($_GET['id']          ?? ''));
        $customerId = trim((string) ($_GET['customer_id'] ?? ''));
        $projectId  = trim((string) ($_GET['project_id']  ?? ''));

        if ($id !== '') {
            $entry = fe_fetch_one_by_id(CFE_TABLE, $id);
            if (!$entry) json_error('Müşteri finansal kaydı bulunamadı.', 404);
            $entry = cfe_add_inflation([$entry])[0];
            json_success(['entry' => $entry]);
        }

        if ($customerId !== '') {
            // Temporary migration safety filter: exclude Hakediş entries until cleanup migration is confirmed
            $entries = fe_fetch_all(
                "SELECT cfe.*, c.company_name, c.full_name, p.title AS project_title
                   FROM ak_customer_financial_entries cfe
                   LEFT JOIN ak_customers c ON c.id = cfe.customer_id
                   LEFT JOIN ak_projects  p ON p.id = cfe.project_id
                  WHERE cfe.customer_id = :cid
                    AND cfe.title NOT LIKE '%Hakediş%'
                  ORDER BY cfe.entry_date DESC, cfe.created_at DESC",
                ['cid' => $customerId]
            );
            json_success(['entries' => cfe_add_inflation($entries)]);
        }

        if ($projectId !== '') {
            $entries = fe_fetch_all(
                'SELECT cfe.*, COALESCE(c.company_name, c.full_name) AS owner_name, p.title AS project_title
                   FROM ak_customer_financial_entries cfe
                   LEFT JOIN ak_customers c ON c.id = cfe.customer_id
                   LEFT JOIN ak_projects  p ON p.id = cfe.project_id
                  WHERE cfe.project_id = :pid
                  ORDER BY cfe.entry_date DESC, cfe.created_at DESC',
                ['pid' => $projectId]
            );
            json_success(['entries' => cfe_add_inflation($entries)]);
        }

        // Global list
        $entries = fe_fetch_all(
            'SELECT cfe.*, COALESCE(c.company_name, c.full_name) AS owner_name, p.title AS project_title
               FROM ak_customer_financial_entries cfe
               LEFT JOIN ak_customers c ON c.id = cfe.customer_id
               LEFT JOIN ak_projects  p ON p.id = cfe.project_id
              ORDER BY cfe.entry_date DESC, cfe.created_at DESC
              LIMIT 500'
        );
        json_success(['entries' => cfe_add_inflation($entries)]);
    }

    if ($method === 'POST') {
        $input      = read_admin_json_body();
        $customerId = require_non_empty($input, 'customer_id', 'Müşteri seçimi zorunludur.');
        $payload    = fe_payload($input, 'customer_id', $customerId);
        $id         = uuid_v4();
        $payload['id'] = $id;
        $cols = array_keys($payload);
        db()->prepare(
            'INSERT INTO `' . CFE_TABLE . '` (`' . implode('`, `', $cols) . '`) VALUES (:' . implode(', :', $cols) . ')'
        )->execute($payload);
        json_success(['entry' => fe_fetch_one_by_id(CFE_TABLE, $id)], 201);
    }

    if ($method === 'PATCH') {
        $input    = read_admin_json_body();
        $id       = require_non_empty($input, 'id', 'Kayıt bulunamadı.');
        $existing = fe_fetch_one_by_id(CFE_TABLE, $id);
        if (!$existing) json_error('Müşteri finansal kaydı bulunamadı.', 404);
        $customerId      = require_non_empty($input, 'customer_id', 'Müşteri seçimi zorunludur.');
        $preserveSnapshot = fe_should_preserve_snapshot($input, $existing);
        $payload          = fe_payload($input, 'customer_id', $customerId, $preserveSnapshot);
        $sets       = array_map(static fn($f) => "`{$f}` = :{$f}", array_keys($payload));
        $payload['id'] = $id;
        db()->prepare(
            'UPDATE `' . CFE_TABLE . '` SET ' . implode(', ', $sets) . ' WHERE id = :id'
        )->execute($payload);
        json_success(['entry' => fe_fetch_one_by_id(CFE_TABLE, $id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Kayıt bulunamadı.');
        }
        if (!fe_fetch_one_by_id(CFE_TABLE, $id)) json_error('Müşteri finansal kaydı bulunamadı.', 404);
        db()->prepare('DELETE FROM `' . CFE_TABLE . '` WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Müşteri finansal kaydı işlemi tamamlanamadı.', 500);
}
