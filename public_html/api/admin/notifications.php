<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/canonical-read-flags.php';

require_admin();

// Must be declared before the dispatch block below runs — unlike function definitions, a
// top-level `const` is a runtime statement evaluated in file order, not hoisted, so declaring
// it further down (after the GET handler that references it) throws "Undefined constant" the
// moment GET actually executes.
const NOTIFICATIONS_PAYMENT_REMINDER_TYPES = ['Yaklaşan Ödeme', 'Bugünkü Tahsilat', 'Geciken Ödeme'];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        // Read-only (P2-3 redesign): GET must never INSERT/UPDATE/DELETE.
        // Upcoming/overdue/due-today collection reminders are computed
        // on-the-fly from the same canonical source and criteria as the
        // dashboard (see notifications_derive_receivable_alerts()) and
        // merged with persisted ak_notifications rows using stable
        // synthetic IDs — nothing is written here. Both the notification
        // page and the header bell call this same endpoint, so they always
        // see the same merged result.
        $limit = max(1, min(200, (int) ($_GET['limit'] ?? 200)));

        $persisted = fetch_all_notifications('SELECT * FROM ak_notifications ORDER BY created_at DESC');
        $derived   = notifications_derive_receivable_alerts();

        // A persisted payment-reminder row (type Yaklaşan Ödeme/Bugünkü Tahsilat/Geciken Ödeme,
        // written by the opt-in notifications_sync_payment_notifications() sync) becomes an
        // orphan the moment its source receivable is paid off, cancelled, or the record itself
        // is deleted — nothing currently purges it automatically (that write only happens via
        // an explicit POST no cron/UI calls yet). Filtering it out here, at read time, is not a
        // write (GET must never INSERT/UPDATE/DELETE, per the comment above) — it just makes a
        // stale persisted reminder behave like a derived one: it stops being shown/counted the
        // moment its source stops qualifying, without needing any destructive cleanup migration
        // to run first (QA-B/C BUG-07).
        $persisted = filter_out_orphan_payment_notifications($persisted);

        // Deterministic dedup: if a persisted row already represents the same
        // receivable+type+day (e.g. a prior explicit sync — see
        // notifications_sync_payment_notifications()), suppress the
        // corresponding derived synthetic alert so the same event is never
        // shown/counted twice.
        $persistedKeys = [];
        foreach ($persisted as $p) {
            $persistedKeys[(string) ($p['related_payment_plan_id'] ?? '') . '|' . (string) ($p['type'] ?? '') . '|' . substr((string) $p['created_at'], 0, 10)] = true;
        }
        $derived = array_values(array_filter($derived, static function (array $d) use ($persistedKeys): bool {
            $entryId = explode(':', (string) $d['id'])[1] ?? '';
            $key = $entryId . '|' . $d['type'] . '|' . substr((string) $d['created_at'], 0, 10);
            return !isset($persistedKeys[$key]);
        }));

        $merged = array_merge($derived, $persisted);
        usort($merged, static fn(array $a, array $b): int => strcmp((string) $b['created_at'], (string) $a['created_at']));
        $merged = array_slice($merged, 0, $limit);

        $unread = 0;
        foreach (array_merge($derived, $persisted) as $n) {
            if ((int) ($n['is_read'] ?? 0) === 0) $unread++;
        }

        json_success([
            'notifications' => $merged,
            'unread_count' => $unread,
            'total_count' => count($derived) + count($persisted),
        ]);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        if (($input['all'] ?? false) === true) {
            db()->prepare('UPDATE ak_notifications SET is_read = 1 WHERE is_read = 0')->execute();
            json_success(['updated' => true]);
        }
        $id = require_non_empty($input, 'id', 'Bildirim bulunamadı.');
        // Synthetic (derived, non-persisted) notifications cannot be marked
        // read server-side — they are recomputed fresh on every GET, not
        // stored. The frontend hides the read toggle for these; a request
        // for one here is a no-op success rather than a 404/500, since it's
        // not an error, just nothing to persist.
        if (str_starts_with($id, 'synthetic:')) {
            json_success(['notification' => null, 'synthetic' => true]);
        }
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
        if (str_starts_with($id, 'synthetic:')) {
            json_success(['deleted' => true, 'synthetic' => true]);
        }
        db()->prepare('DELETE FROM ak_notifications WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    if ($method === 'POST') {
        // Explicit, deliberate sync — NEVER triggered by GET. Persists the
        // currently-derived payment-reminder alerts into ak_notifications so
        // they can be marked read/deleted like any other notification. Not
        // wired to any cron or frontend call yet; intended to be invoked
        // manually or from a scheduled job once approved. See P2-3.
        $input = read_admin_json_body();
        if (($input['action'] ?? '') !== 'sync_payment_notifications') {
            json_error('Bilinmeyen işlem.');
        }
        $inserted = notifications_sync_payment_notifications();
        json_success(['synced' => true, 'inserted' => $inserted]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Bildirim işlemi tamamlanamadı.', 500);
}

// ── Canonical receivable-alert source ───────────────────────────────────────
//
// Single source of truth for "which open customer receivables are
// overdue/due-today/due-soon" — used by both the read-only derive path (GET)
// and the explicit persist path (POST action=sync_payment_notifications).
// Matches dashboard.php's compute_finance_summary() exactly: same table
// (ak_customer_financial_entries), same open-balance statuses, same
// remaining-amount formula. entry_date stands in for a due date — this
// table has no separate due_date column (same convention used elsewhere in
// this codebase, e.g. is_overdue derivation).

function notifications_fetch_open_receivables(): array
{
    return fetch_all_notifications(
        "SELECT cfe.id, cfe.title, cfe.entry_date AS due_date,
                GREATEST(cfe.amount_try - cfe.paid_amount_try, 0) AS remaining_amount,
                cfe.customer_id, cfe.project_id
         FROM ak_customer_financial_entries cfe
         WHERE cfe.status IN ('Planlanan', 'Gecikmiş', 'Kısmi Ödendi')"
    );
}

/**
 * Pure classification: given a due date, a remaining balance, and "today",
 * returns the alert shape (type/title/message/priority) or null if the row
 * is not currently alert-eligible (settled, cancelled-equivalent, or due
 * further out than the 7-day window). No I/O — safe to unit-test directly.
 */
function notifications_classify_receivable(string $title, string $dueDate, float $remainingAmount, string $today, string $windowEnd): ?array
{
    if ($remainingAmount <= 0 || $dueDate === '') {
        return null;
    }
    if ($dueDate > $windowEnd) {
        return null;
    }

    $safeTitle = $title !== '' ? $title : 'Ödeme';

    if ($dueDate < $today) {
        return [
            'type' => 'Geciken Ödeme',
            'title' => 'Geciken Ödeme',
            'message' => "{$safeTitle} için vadesi geçen tahsilat bulunmaktadır.",
            'priority' => 'Kritik',
        ];
    }
    if ($dueDate === $today) {
        return [
            'type' => 'Bugünkü Tahsilat',
            'title' => 'Bugünkü Tahsilat',
            'message' => "{$safeTitle} için bugün tahsilat vadesi bulunmaktadır.",
            'priority' => 'Yüksek',
        ];
    }
    $days = max(0, (int) floor((strtotime($dueDate) - strtotime($today)) / 86400));
    return [
        'type' => 'Yaklaşan Ödeme',
        'title' => 'Yaklaşan Ödeme',
        'message' => "{$safeTitle} için {$days} gün içinde ödeme vadesi bulunuyor.",
        'priority' => 'Yüksek',
    ];
}

/**
 * Read-only: computes the current set of receivable alerts and returns them
 * shaped like ak_notifications rows, but with a stable synthetic id
 * ("synthetic:{entry_id}:{type}:{date}") and is_read=0 — never written to
 * the database. Safe to call on every GET.
 */
function notifications_derive_receivable_alerts(): array
{
    $today = date('Y-m-d');
    $windowEnd = date('Y-m-d', strtotime('+7 days'));
    $rows = notifications_fetch_open_receivables();

    $alerts = [];
    foreach ($rows as $row) {
        $classified = notifications_classify_receivable(
            (string) ($row['title'] ?? ''),
            (string) ($row['due_date'] ?? ''),
            (float) ($row['remaining_amount'] ?? 0),
            $today,
            $windowEnd
        );
        if ($classified === null) continue;

        $alerts[] = [
            'id' => 'synthetic:' . $row['id'] . ':' . $classified['type'] . ':' . $today,
            'title' => $classified['title'],
            'message' => $classified['message'],
            'type' => $classified['type'],
            'priority' => $classified['priority'],
            'is_read' => 0,
            'related_customer_id' => $row['customer_id'] ?? null,
            'related_project_id' => $row['project_id'] ?? null,
            'related_payment_plan_id' => null,
            'created_at' => $today . ' 00:00:00',
            'synthetic' => true,
        ];
    }
    return $alerts;
}

/**
 * Read-time filter (no writes) — removes persisted payment-reminder rows whose source
 * receivable no longer exists or is no longer eligible (paid, cancelled, out of the alert
 * window). Uses the exact same eligibility set notifications_derive_receivable_alerts() /
 * notifications_sync_payment_notifications() compute, so a row is never shown here that
 * wouldn't also be (re-)derived fresh right now. Non-reminder-type notifications (e.g. contact
 * request alerts) are left untouched — this only applies to the three receivable-reminder types.
 */
function filter_out_orphan_payment_notifications(array $persisted): array
{
    $hasReminderRow = false;
    foreach ($persisted as $row) {
        if (in_array((string) ($row['type'] ?? ''), NOTIFICATIONS_PAYMENT_REMINDER_TYPES, true)) {
            $hasReminderRow = true;
            break;
        }
    }
    if (!$hasReminderRow) {
        return $persisted;
    }

    $today = date('Y-m-d');
    $windowEnd = date('Y-m-d', strtotime('+7 days'));
    $eligibleIds = [];
    foreach (notifications_fetch_open_receivables() as $row) {
        $classified = notifications_classify_receivable(
            (string) ($row['title'] ?? ''),
            (string) ($row['due_date'] ?? ''),
            (float) ($row['remaining_amount'] ?? 0),
            $today,
            $windowEnd
        );
        if ($classified !== null) {
            $eligibleIds[(string) $row['id']] = true;
        }
    }

    return array_values(array_filter($persisted, static function (array $row) use ($eligibleIds): bool {
        if (!in_array((string) ($row['type'] ?? ''), NOTIFICATIONS_PAYMENT_REMINDER_TYPES, true)) {
            return true;
        }
        $planId = (string) ($row['related_payment_plan_id'] ?? '');
        return $planId !== '' && isset($eligibleIds[$planId]);
    }));
}

/**
 * Explicit write path — only ever invoked from POST action=sync_payment_notifications,
 * never from GET. Persists currently-eligible alerts into ak_notifications,
 * deduplicated by entry_id|type|today, and removes previously-persisted
 * reminder rows that are no longer eligible (paid/cancelled/out of window).
 */
function notifications_sync_payment_notifications(): int
{
    $today = date('Y-m-d');
    $windowEnd = date('Y-m-d', strtotime('+7 days'));
    $rows = notifications_fetch_open_receivables();

    $eligible = [];
    foreach ($rows as $row) {
        $classified = notifications_classify_receivable(
            (string) ($row['title'] ?? ''),
            (string) ($row['due_date'] ?? ''),
            (float) ($row['remaining_amount'] ?? 0),
            $today,
            $windowEnd
        );
        if ($classified === null) continue;
        $eligible[] = ['row' => $row, 'classified' => $classified];
    }

    remove_obsolete_payment_notifications(array_column(array_column($eligible, 'row'), 'id'));
    if ($eligible === []) return 0;

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
    $inserted = 0;
    foreach ($eligible as $item) {
        $row = $item['row'];
        $classified = $item['classified'];
        $key = (string) $row['id'] . '|' . $classified['type'] . '|' . $today;
        if (isset($existingKeys[$key])) continue;
        $stmt->execute([
            'id' => uuid_v4(),
            'title' => $classified['title'],
            'message' => $classified['message'],
            'type' => $classified['type'],
            'priority' => $classified['priority'],
            'customer_id' => $row['customer_id'] ?? null,
            'project_id' => $row['project_id'] ?? null,
            'plan_id' => $row['id'],
        ]);
        $inserted++;
    }
    return $inserted;
}

function fetch_all_notifications(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one_notification(string $sql, array $params = []): ?array { $rows = fetch_all_notifications($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function notification_count(string $sql): int { $stmt = db()->query($sql); return (int) ($stmt ? $stmt->fetchColumn() : 0); }

function remove_obsolete_payment_notifications(array $eligibleIds): void
{
    $eligible = array_fill_keys(array_map('strval', $eligibleIds), true);
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
