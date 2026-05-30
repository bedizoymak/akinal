<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$allowedStatuses = ['Yeni', 'Arandı', 'Teklif Verildi', 'Tamamlandı'];

try {
    if ($method === 'GET') {
        $status = trim((string) ($_GET['status'] ?? ''));
        $query = trim((string) ($_GET['q'] ?? ''));
        $where = [];
        $params = [];

        if ($status !== '' && $status !== 'all') {
            $where[] = 'status = :status';
            $params['status'] = $status;
        }

        if ($query !== '') {
            $where[] = '(full_name LIKE :query OR phone LIKE :query OR email LIKE :query OR service_type LIKE :query OR message LIKE :query)';
            $params['query'] = '%' . $query . '%';
        }

        $sql = 'SELECT id, full_name, phone, email, service_type, message, status, created_at FROM ak_contact_requests';
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY created_at DESC';

        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        json_success(['requests' => $stmt->fetchAll()]);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Talep bulunamadı.');
        $status = require_non_empty($input, 'status', 'Durum zorunludur.');

        if (!in_array($status, $allowedStatuses, true)) {
            json_error('Geçersiz durum.');
        }

        $stmt = db()->prepare('UPDATE ak_contact_requests SET status = :status WHERE id = :id');
        $stmt->execute(['id' => $id, 'status' => $status]);

        $select = db()->prepare('SELECT id, full_name, phone, email, service_type, message, status, created_at FROM ak_contact_requests WHERE id = :id LIMIT 1');
        $select->execute(['id' => $id]);
        $request = $select->fetch();

        if (!$request) {
            json_error('Talep bulunamadı.', 404);
        }

        json_success(['request' => $request]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Talep bulunamadı.');
        }

        $stmt = db()->prepare('DELETE FROM ak_contact_requests WHERE id = :id');
        $stmt->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, PATCH, DELETE');
    json_error('Method not allowed.', 405);
} catch (Throwable $exception) {
    json_error('İletişim talepleri işlenemedi.', 500);
}
