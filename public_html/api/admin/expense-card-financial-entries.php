<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/finance-entry-helpers.php';

require_admin();

const ECFE_TABLE = 'ak_expense_card_financial_entries';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $id            = trim((string) ($_GET['id']              ?? ''));
        $expenseCardId = trim((string) ($_GET['expense_card_id'] ?? ''));
        $projectId     = trim((string) ($_GET['project_id']      ?? ''));

        if ($id !== '') {
            $entry = fe_fetch_one_by_id(ECFE_TABLE, $id);
            if (!$entry) json_error('Masraf finansal kaydı bulunamadı.', 404);
            json_success(['entry' => $entry]);
        }

        if ($expenseCardId !== '') {
            $entries = fe_fetch_all(
                'SELECT ecfe.*, ec.name AS owner_name, p.title AS project_title
                   FROM ak_expense_card_financial_entries ecfe
                   LEFT JOIN ak_expense_cards ec ON ec.id = ecfe.expense_card_id
                   LEFT JOIN ak_projects      p  ON p.id  = ecfe.project_id
                  WHERE ecfe.expense_card_id = :eid
                  ORDER BY ecfe.entry_date DESC, ecfe.created_at DESC',
                ['eid' => $expenseCardId]
            );
            json_success(['entries' => $entries]);
        }

        if ($projectId !== '') {
            $entries = fe_fetch_all(
                'SELECT ecfe.*, ec.name AS owner_name, p.title AS project_title
                   FROM ak_expense_card_financial_entries ecfe
                   LEFT JOIN ak_expense_cards ec ON ec.id = ecfe.expense_card_id
                   LEFT JOIN ak_projects      p  ON p.id  = ecfe.project_id
                  WHERE ecfe.project_id = :pid
                  ORDER BY ecfe.entry_date DESC, ecfe.created_at DESC',
                ['pid' => $projectId]
            );
            json_success(['entries' => $entries]);
        }

        $entries = fe_fetch_all(
            'SELECT ecfe.*, ec.name AS owner_name, p.title AS project_title
               FROM ak_expense_card_financial_entries ecfe
               LEFT JOIN ak_expense_cards ec ON ec.id = ecfe.expense_card_id
               LEFT JOIN ak_projects      p  ON p.id  = ecfe.project_id
              ORDER BY ecfe.entry_date DESC, ecfe.created_at DESC
              LIMIT 500'
        );
        json_success(['entries' => $entries]);
    }

    if ($method === 'POST') {
        $input         = read_admin_json_body();
        $expenseCardId = require_non_empty($input, 'expense_card_id', 'Masraf kartı seçimi zorunludur.');
        $payload       = fe_payload($input, 'expense_card_id', $expenseCardId);
        $id            = uuid_v4();
        $payload['id'] = $id;
        $cols = array_keys($payload);
        db()->prepare(
            'INSERT INTO `' . ECFE_TABLE . '` (`' . implode('`, `', $cols) . '`) VALUES (:' . implode(', :', $cols) . ')'
        )->execute($payload);
        json_success(['entry' => fe_fetch_one_by_id(ECFE_TABLE, $id)], 201);
    }

    if ($method === 'PATCH') {
        $input    = read_admin_json_body();
        $id       = require_non_empty($input, 'id', 'Kayıt bulunamadı.');
        $existing = fe_fetch_one_by_id(ECFE_TABLE, $id);
        if (!$existing) json_error('Masraf finansal kaydı bulunamadı.', 404);
        $expenseCardId    = require_non_empty($input, 'expense_card_id', 'Masraf kartı seçimi zorunludur.');
        $preserveSnapshot = fe_should_preserve_snapshot($input, $existing);
        $payload          = fe_payload($input, 'expense_card_id', $expenseCardId, $preserveSnapshot);
        $sets          = array_map(static fn($f) => "`{$f}` = :{$f}", array_keys($payload));
        $payload['id'] = $id;
        db()->prepare(
            'UPDATE `' . ECFE_TABLE . '` SET ' . implode(', ', $sets) . ' WHERE id = :id'
        )->execute($payload);
        json_success(['entry' => fe_fetch_one_by_id(ECFE_TABLE, $id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Kayıt bulunamadı.');
        }
        if (!fe_fetch_one_by_id(ECFE_TABLE, $id)) json_error('Masraf finansal kaydı bulunamadı.', 404);
        db()->prepare('DELETE FROM `' . ECFE_TABLE . '` WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Masraf finansal kaydı işlemi tamamlanamadı.', 500);
}
