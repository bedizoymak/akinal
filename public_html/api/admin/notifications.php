<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/canonical-read-flags.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        if ((string) ($_GET['generate'] ?? '') === '1') {
            ensure_payment_notifications();
        }
        $limit = max(1, min(200, (int) ($_GET['limit'] ?? 200)));
        json_success([
            'notifications' => fetch_all_notifications("SELECT * FROM ak_notifications ORDER BY created_at DESC LIMIT {$limit}"),
            'unread_count' => notification_count('SELECT COUNT(*) FROM ak_notifications WHERE is_read = 0'),
            'total_count' => notification_count('SELECT COUNT(*) FROM ak_notifications'),
        ]);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        if (($input['all'] ?? false) === true) {
            db()->prepare('UPDATE ak_notifications SET is_read = 1 WHERE is_read = 0')->execute();
            json_success(['updated' => true]);
        }
        $id = require_non_empty($input, 'id', 'Bildirim bulunamadı.');
        db()->prepare('UPDATE ak_notifications SET is_read = :is_read WHERE id = :id')->execute([
            'id' => $id,
            'is_read' => normalize_bool($input['is_read'] ?? true),
        ]);
        json_success(['notification' => fetch_one_notification('SELECT * FROM ak_notifications WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $all = ((string) ($_GET['all'] ?? '')) === '1';
        $id = trim((string) ($_GET['id'] ?? ''));
        if (!$all && $id === '') {
            $input = read_admin_json_body();
            $all = ($input['all'] ?? false) === true;
            if (!$all) {
                $id = require_non_empty($input, 'id', 'Bildirim bulunamadı.');
            }
        }
        if ($all) {
            db()->prepare('DELETE FROM ak_notifications')->execute();
            json_success(['deleted' => true, 'deleted_all' => true]);
        }
        db()->prepare('DELETE FROM ak_notifications WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Bildirim işlemi tamamlanamadı.', 500);
}

function ensure_payment_notifications(): void
{
    $today = date('Y-m-d');
    $in7 = date('Y-m-d', strtotime('+7 days'));
    $rawPlans = fetch_all_notifications(
        "SELECT id, title, amount, paid_amount, due_date, status, customer_id, project_id, account_type
         FROM ak_payment_plans
         WHERE customer_id IS NOT NULL
         ORDER BY customer_id ASC, account_type ASC, due_date ASC"
    );
    $payments = fetch_all_notifications('SELECT customer_id, payment_plan_id, amount, account_type FROM ak_payments WHERE customer_id IS NOT NULL');
    $plans = canonical_read_select(
        'notifications.plan_states',
        canonical_read_legacy_notification_plan_states($rawPlans, $payments),
        canonical_read_notification_plan_states($rawPlans, $payments)
    );
    $plans = array_values(array_filter($plans, static function (array $plan) use ($in7): bool {
        $due = (string) ($plan['due_date'] ?? '');
        return (float) ($plan['remaining_amount'] ?? 0) > 0 && $due !== '' && $due <= $in7;
    }));
    remove_obsolete_payment_notifications(array_column($plans, 'id'));
    if ($plans === []) return;

    $existing = fetch_all_notifications(
        "SELECT related_payment_plan_id, type, DATE(created_at) AS created_date FROM ak_notifications WHERE type IN ('Yaklaşan Ödeme', 'Bugünkü Tahsilat', 'Geciken Ödeme')"
    );
    $existingKeys = [];
    foreach ($existing as $row) {
        $existingKeys[(string) ($row['related_payment_plan_id'] ?? '') . '|' . (string) ($row['type'] ?? '') . '|' . (string) ($row['created_date'] ?? '')] = true;
    }

    $stmt = db()->prepare(
        'INSERT INTO ak_notifications (id, title, message, type, priority, related_customer_id, related_project_id, related_payment_plan_id) VALUES (:id, :title, :message, :type, :priority, :customer_id, :project_id, :plan_id)'
    );
    foreach ($plans as $plan) {
        $due = (string) ($plan['due_date'] ?? '');
        $type = '';
        $title = '';
        $message = '';
        $priority = 'Orta';
        if ($due < $today) {
            $type = 'Geciken Ödeme';
            $title = 'Geciken Ödeme';
            $message = (string) ($plan['title'] ?? 'Ödeme') . ' için vadesi geçen tahsilat bulunmaktadır.';
            $priority = 'Kritik';
        } elseif ($due === $today) {
            $type = 'Bugünkü Tahsilat';
            $title = 'Bugünkü Tahsilat';
            $message = (string) ($plan['title'] ?? 'Ödeme') . ' için bugün tahsilat vadesi bulunmaktadır.';
            $priority = 'Yüksek';
        } elseif ($due <= $in7) {
            $type = 'Yaklaşan Ödeme';
            $title = 'Yaklaşan Ödeme';
            $days = max(0, (int) floor((strtotime($due) - strtotime($today)) / 86400));
            $message = (string) ($plan['title'] ?? 'Ödeme') . " için {$days} gün içinde ödeme vadesi bulunuyor.";
            $priority = 'Yüksek';
        } else {
            continue;
        }

        $key = (string) $plan['id'] . '|' . $type . '|' . $today;
        if (isset($existingKeys[$key])) continue;
        $stmt->execute([
            'id' => uuid_v4(),
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'priority' => $priority,
            'customer_id' => $plan['customer_id'] ?? null,
            'project_id' => $plan['project_id'] ?? null,
            'plan_id' => $plan['id'],
        ]);
    }
}

function fetch_all_notifications(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one_notification(string $sql, array $params = []): ?array { $rows = fetch_all_notifications($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function notification_count(string $sql): int { $stmt = db()->query($sql); return (int) ($stmt ? $stmt->fetchColumn() : 0); }

function remove_obsolete_payment_notifications(array $eligiblePlanIds): void
{
    $eligible = array_fill_keys(array_map('strval', $eligiblePlanIds), true);
    $rows = fetch_all_notifications(
        "SELECT id, related_payment_plan_id
         FROM ak_notifications
         WHERE type IN ('Yaklaşan Ödeme', 'Bugünkü Tahsilat', 'Geciken Ödeme')"
    );
    $delete = db()->prepare('DELETE FROM ak_notifications WHERE id = :id');
    foreach ($rows as $row) {
        $planId = (string) ($row['related_payment_plan_id'] ?? '');
        if ($planId === '' || !isset($eligible[$planId])) {
            $delete->execute(['id' => $row['id']]);
        }
    }
}
