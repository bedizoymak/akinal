<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if ($method === 'GET') {
        $id         = trim((string) ($_GET['id']          ?? ''));
        $customerId = trim((string) ($_GET['customer_id'] ?? ''));
        $projectId  = trim((string) ($_GET['project_id']  ?? ''));

        if ($id !== '') {
            $row = gpp_fetch_one($id);
            if (!$row) json_error('Hakediş kaydı bulunamadı.', 404);
            json_success(['payment' => $row]);
        }

        if ($customerId !== '') {
            json_success(['payments' => gpp_fetch_list(
                'WHERE gpp.customer_id = :v ORDER BY gpp.due_date ASC, gpp.created_at ASC',
                ['v' => $customerId]
            )]);
        }

        if ($projectId !== '') {
            json_success(['payments' => gpp_fetch_list(
                'WHERE gpp.project_id = :v ORDER BY gpp.due_date ASC, gpp.created_at ASC',
                ['v' => $projectId]
            )]);
        }

        json_success(['payments' => gpp_fetch_list('ORDER BY gpp.due_date ASC, gpp.created_at ASC LIMIT 500')]);
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if ($method === 'POST') {
        $input  = read_admin_json_body();
        $action = trim((string) ($input['action'] ?? ''));

        if ($action === 'create_collection') {
            if (!gpp_collections_table_exists()) json_error('Tahsilat tablosu henüz oluşturulmamış.', 409);

            $gppId       = require_non_empty($input, 'government_progress_payment_id', 'Hakediş ID zorunludur.');
            $gpp         = gpp_fetch_one($gppId);
            if (!$gpp) json_error('Hakediş kaydı bulunamadı.', 404);

            // Breakdown is required — no "general" collections allowed.
            $breakdownId = nullable_string($input, 'breakdown_id');
            if ($breakdownId === null || $breakdownId === '') {
                json_error('Tahsilat için aşama seçilmelidir.', 422);
            }

            // Verify breakdown belongs to this GPP.
            $bdRow = gpp_fetch_breakdown($breakdownId);
            if (!$bdRow || $bdRow['government_progress_payment_id'] !== $gppId) {
                json_error('Seçilen aşama bu hakedişe ait değil.', 422);
            }

            // Enforce sequential order: all previous stages must be fully paid.
            $prevCheck = db()->prepare(
                'SELECT COUNT(*) FROM ak_government_progress_payment_breakdowns
                  WHERE government_progress_payment_id = :gid
                    AND sort_order < :ord
                    AND paid_amount_try < planned_amount_try'
            );
            $prevCheck->execute(['gid' => $gppId, 'ord' => (int) $bdRow['sort_order']]);
            if ((int) $prevCheck->fetchColumn() > 0) {
                json_error('Önceki hakediş aşamaları tamamlanmadan bu aşama tahsil edilemez.', 422);
            }

            // Compute remaining server-side — ignore client amount.
            $alreadyCollected = gpp_breakdown_collected($breakdownId);
            $remaining        = (float) $bdRow['planned_amount_try'] - $alreadyCollected;
            if ($remaining <= 0.005) {
                json_error('Bu aşama zaten tamamen tahsil edilmiş.', 422);
            }
            $amount = round($remaining, 2);

            $title = require_non_empty($input, 'title', 'Başlık zorunludur.');
            $date  = require_non_empty($input, 'collection_date', 'Tahsilat tarihi zorunludur.');
            $notes = nullable_string($input, 'notes');

            // Parent overpayment guard (breakdown guard already satisfied since amount = remaining).
            gpp_check_collection_limits($gppId, $breakdownId, $amount);

            $cid = uuid_v4();
            db()->beginTransaction();
            db()->prepare(
                'INSERT INTO ak_government_progress_payment_collections
                   (id, government_progress_payment_id, breakdown_id, project_id, customer_id, title, collection_date, amount_try, notes)
                 VALUES (:id, :gpp_id, :bd_id, :proj_id, :cust_id, :title, :date, :amount, :notes)'
            )->execute([
                'id'      => $cid,
                'gpp_id'  => $gppId,
                'bd_id'   => $breakdownId,
                'proj_id' => $gpp['project_id'],
                'cust_id' => $gpp['customer_id'],
                'title'   => $title,
                'date'    => $date,
                'amount'  => $amount,
                'notes'   => $notes,
            ]);
            gpp_sync_from_collections($gppId);
            db()->commit();

            json_success(['payment' => gpp_fetch_one($gppId)], 201);
        }

        // Default: create parent GPP
        $payload = gpp_payload($input);
        $id      = uuid_v4();
        $payload['id'] = $id;
        $cols = array_keys($payload);

        db()->beginTransaction();
        db()->prepare(
            'INSERT INTO ak_government_progress_payments (`' . implode('`, `', $cols) . '`) VALUES (:' . implode(', :', $cols) . ')'
        )->execute($payload);

        if (gpp_breakdowns_table_exists()) {
            gpp_seed_breakdowns($id, (float) $payload['planned_amount_try']);
        }
        db()->commit();

        json_success(['payment' => gpp_fetch_one($id)], 201);
    }

    // ── PATCH ────────────────────────────────────────────────────────────────
    if ($method === 'PATCH') {
        $input  = read_admin_json_body();
        $action = trim((string) ($input['action'] ?? ''));

        // Collection update — only title, date, notes are editable; amount and breakdown are immutable.
        if ($action === 'update_collection') {
            if (!gpp_collections_table_exists()) json_error('Tahsilat tablosu henüz oluşturulmamış.', 409);

            $cid  = require_non_empty($input, 'collection_id', 'Tahsilat ID zorunludur.');
            $crow = gpp_fetch_collection($cid);
            if (!$crow) json_error('Tahsilat kaydı bulunamadı.', 404);

            $gppId = $crow['government_progress_payment_id'];
            $title = array_key_exists('title', $input) ? require_non_empty($input, 'title', 'Başlık zorunludur.') : $crow['title'];
            $date  = array_key_exists('collection_date', $input) ? require_non_empty($input, 'collection_date', 'Tarih zorunludur.') : $crow['collection_date'];
            $notes = array_key_exists('notes', $input) ? nullable_string($input, 'notes') : $crow['notes'];

            db()->beginTransaction();
            db()->prepare(
                'UPDATE ak_government_progress_payment_collections
                    SET title = :title, collection_date = :date, notes = :notes
                  WHERE id = :id'
            )->execute([
                'title' => $title,
                'date'  => $date,
                'notes' => $notes,
                'id'    => $cid,
            ]);
            gpp_sync_from_collections($gppId);
            db()->commit();

            json_success(['payment' => gpp_fetch_one($gppId)]);
        }

        // Breakdown update
        if (array_key_exists('breakdown_id', $input) && $action === '') {
            if (!gpp_breakdowns_table_exists()) json_error('Aşama tablosu henüz oluşturulmamış.', 409);
            $bid  = require_non_empty($input, 'breakdown_id', 'Aşama ID zorunludur.');
            $brow = gpp_fetch_breakdown($bid);
            if (!$brow) json_error('Aşama kaydı bulunamadı.', 404);

            $planned = array_key_exists('planned_amount_try', $input)
                ? max(0.0, (float) $input['planned_amount_try'])
                : (float) $brow['planned_amount_try'];

            $paid = array_key_exists('paid_amount_try', $input)
                ? max(0.0, (float) $input['paid_amount_try'])
                : (float) $brow['paid_amount_try'];

            if ($paid > $planned) json_error('Ödenen tutar planlanan tutarı aşamaz.', 422);

            $status = nullable_string($input, 'status') ?? '';
            $validS = ['planned', 'partial', 'paid', 'cancelled'];
            if ($status === 'cancelled') {
                // keep
            } elseif (!in_array($status, $validS, true)) {
                if ($paid <= 0)                            $status = 'planned';
                elseif ($planned > 0 && $paid >= $planned) $status = 'paid';
                else                                       $status = 'partial';
            }

            $bPayload = [
                'planned_amount_try' => $planned,
                'paid_amount_try'    => $paid,
                'status'             => $status,
                'due_date'           => array_key_exists('due_date', $input)  ? nullable_string($input, 'due_date')  : $brow['due_date'],
                'paid_date'          => array_key_exists('paid_date', $input) ? nullable_string($input, 'paid_date') : $brow['paid_date'],
                'notes'              => array_key_exists('notes', $input)     ? nullable_string($input, 'notes')     : $brow['notes'],
            ];

            db()->beginTransaction();
            $sets = array_map(static fn($f) => "`{$f}` = :{$f}", array_keys($bPayload));
            $bPayload['bid'] = $bid;
            db()->prepare('UPDATE ak_government_progress_payment_breakdowns SET ' . implode(', ', $sets) . ' WHERE id = :bid')
                ->execute($bPayload);

            $gppId = $brow['government_progress_payment_id'];
            gpp_sync_parent_from_breakdowns($gppId);
            db()->commit();

            json_success(['payment' => gpp_fetch_one($gppId)]);
        }

        // Parent update
        $id       = require_non_empty($input, 'id', 'Hakediş ID zorunludur.');
        $existing = gpp_fetch_one($id);
        if (!$existing) json_error('Hakediş kaydı bulunamadı.', 404);

        $payload = gpp_payload($input, (float) $existing['paid_amount_try']);

        if (gpp_breakdowns_table_exists()) {
            $newPlanned  = (float) $payload['planned_amount_try'];
            $prevPlanned = (float) $existing['planned_amount_try'];
            if (abs($newPlanned - $prevPlanned) > 0.001) {
                $chk = db()->prepare(
                    'SELECT COUNT(*) FROM ak_government_progress_payment_breakdowns WHERE government_progress_payment_id = :id'
                );
                $chk->execute(['id' => $id]);
                if ((int) $chk->fetchColumn() > 0) {
                    json_error('Alt aşamalar oluşturulduktan sonra ana hakediş tutarı doğrudan değiştirilemez.', 422);
                }
            }
        }

        $sets = array_map(static fn($f) => "`{$f}` = :{$f}", array_keys($payload));
        $payload['id'] = $id;
        db()->prepare('UPDATE ak_government_progress_payments SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($payload);
        json_success(['payment' => gpp_fetch_one($id)]);
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if ($method === 'DELETE') {
        $qid    = trim((string) ($_GET['id'] ?? ''));
        $input  = $qid === '' ? read_admin_json_body() : [];
        $action = trim((string) ($input['action'] ?? ''));

        // Collection delete
        if ($action === 'delete_collection') {
            if (!gpp_collections_table_exists()) json_error('Tahsilat tablosu henüz oluşturulmamış.', 409);

            $cid  = require_non_empty($input, 'collection_id', 'Tahsilat ID zorunludur.');
            $crow = gpp_fetch_collection($cid);
            if (!$crow) json_error('Tahsilat kaydı bulunamadı.', 404);

            $gppId = $crow['government_progress_payment_id'];

            // Block if any later breakdown is already paid — deleting this would corrupt order.
            if ($crow['breakdown_id'] !== null && gpp_breakdowns_table_exists()) {
                $bdRow = gpp_fetch_breakdown($crow['breakdown_id']);
                if ($bdRow) {
                    $laterPaid = db()->prepare(
                        'SELECT COUNT(*) FROM ak_government_progress_payment_breakdowns
                          WHERE government_progress_payment_id = :gid
                            AND sort_order > :ord
                            AND paid_amount_try > 0'
                    );
                    $laterPaid->execute(['gid' => $gppId, 'ord' => (int) $bdRow['sort_order']]);
                    if ((int) $laterPaid->fetchColumn() > 0) {
                        json_error('Sonraki hakediş aşamaları tahsil edilmişken bu tahsilat silinemez.', 422);
                    }
                }
            }

            db()->beginTransaction();
            db()->prepare('DELETE FROM ak_government_progress_payment_collections WHERE id = :id')->execute(['id' => $cid]);
            gpp_sync_from_collections($gppId);
            db()->commit();

            json_success(['payment' => gpp_fetch_one($gppId)]);
        }

        // Parent delete
        $id = $qid !== '' ? $qid : require_non_empty($input, 'id', 'Hakediş ID zorunludur.');
        if (!gpp_fetch_one($id)) json_error('Hakediş kaydı bulunamadı.', 404);
        db()->prepare('DELETE FROM ak_government_progress_payments WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);

} catch (Throwable $e) {
    error_log('[government-progress-payments.php] ' . get_class($e) . ': ' . $e->getMessage());
    if (db()->inTransaction()) db()->rollBack();
    json_error('Hakediş işlemi tamamlanamadı.', 500);
}

// ---------------------------------------------------------------------------
// Table existence guards
// ---------------------------------------------------------------------------

function gpp_breakdowns_table_exists(): bool
{
    static $cache = null;
    if ($cache === null) {
        $s = db()->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
        $s->execute(['t' => 'ak_government_progress_payment_breakdowns']);
        $cache = (bool) $s->fetchColumn();
    }
    return $cache;
}

function gpp_collections_table_exists(): bool
{
    static $cache = null;
    if ($cache === null) {
        $s = db()->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
        $s->execute(['t' => 'ak_government_progress_payment_collections']);
        $cache = (bool) $s->fetchColumn();
    }
    return $cache;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

function gpp_fetch_one(string $id): ?array
{
    $stmt = db()->prepare(
        'SELECT gpp.*, COALESCE(c.company_name, c.full_name) AS customer_name, p.title AS project_title
           FROM ak_government_progress_payments gpp
           LEFT JOIN ak_customers c ON c.id = gpp.customer_id
           LEFT JOIN ak_projects  p ON p.id = gpp.project_id
          WHERE gpp.id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $row = gpp_cast_row($row);
    $row['breakdowns']  = gpp_breakdowns_table_exists()  ? gpp_fetch_breakdowns($id)  : [];
    $row['collections'] = gpp_collections_table_exists() ? gpp_fetch_collections($id) : [];
    return $row;
}

function gpp_fetch_list(string $whereOrderLimit, array $params = []): array
{
    $stmt = db()->prepare(
        'SELECT gpp.*, COALESCE(c.company_name, c.full_name) AS customer_name, p.title AS project_title
           FROM ak_government_progress_payments gpp
           LEFT JOIN ak_customers c ON c.id = gpp.customer_id
           LEFT JOIN ak_projects  p ON p.id = gpp.project_id
          ' . $whereOrderLimit
    );
    $stmt->execute($params);
    $rows  = $stmt->fetchAll() ?: [];
    $hasBT = gpp_breakdowns_table_exists();
    $hasCT = gpp_collections_table_exists();
    return array_map(static function (array $row) use ($hasBT, $hasCT): array {
        $row = gpp_cast_row($row);
        $row['breakdowns']  = $hasBT ? gpp_fetch_breakdowns($row['id'])  : [];
        $row['collections'] = $hasCT ? gpp_fetch_collections($row['id']) : [];
        return $row;
    }, $rows);
}

function gpp_fetch_breakdowns(string $gppId): array
{
    $stmt = db()->prepare(
        'SELECT * FROM ak_government_progress_payment_breakdowns
          WHERE government_progress_payment_id = :id
          ORDER BY sort_order ASC, created_at ASC'
    );
    $stmt->execute(['id' => $gppId]);
    return array_map(static function (array $row): array {
        $row['planned_amount_try'] = (float) $row['planned_amount_try'];
        $row['paid_amount_try']    = (float) $row['paid_amount_try'];
        $row['stage_percentage']   = (float) $row['stage_percentage'];
        $row['sort_order']         = (int)   $row['sort_order'];
        return $row;
    }, $stmt->fetchAll() ?: []);
}

function gpp_fetch_collections(string $gppId): array
{
    $stmt = db()->prepare(
        'SELECT c.*, b.stage AS breakdown_stage
           FROM ak_government_progress_payment_collections c
           LEFT JOIN ak_government_progress_payment_breakdowns b ON b.id = c.breakdown_id
          WHERE c.government_progress_payment_id = :id
          ORDER BY c.collection_date DESC, c.created_at DESC'
    );
    $stmt->execute(['id' => $gppId]);
    return array_map(static function (array $row): array {
        $row['amount_try'] = (float) $row['amount_try'];
        return $row;
    }, $stmt->fetchAll() ?: []);
}

function gpp_breakdown_collected(string $breakdownId): float
{
    $stmt = db()->prepare(
        'SELECT COALESCE(SUM(amount_try), 0) FROM ak_government_progress_payment_collections WHERE breakdown_id = :id'
    );
    $stmt->execute(['id' => $breakdownId]);
    return (float) $stmt->fetchColumn();
}

function gpp_fetch_breakdown(string $bid): ?array
{
    $stmt = db()->prepare('SELECT * FROM ak_government_progress_payment_breakdowns WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $bid]);
    return $stmt->fetch() ?: null;
}

function gpp_fetch_collection(string $cid): ?array
{
    $stmt = db()->prepare('SELECT * FROM ak_government_progress_payment_collections WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $cid]);
    return $stmt->fetch() ?: null;
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

function gpp_sync_from_collections(string $gppId): void
{
    // Recompute each breakdown's paid from its collections
    if (gpp_breakdowns_table_exists()) {
        $bdsStmt = db()->prepare(
            'SELECT id, planned_amount_try FROM ak_government_progress_payment_breakdowns WHERE government_progress_payment_id = :id'
        );
        $bdsStmt->execute(['id' => $gppId]);
        $breakdowns = $bdsStmt->fetchAll() ?: [];

        $bdSumStmt = db()->prepare(
            'SELECT COALESCE(SUM(amount_try), 0) FROM ak_government_progress_payment_collections WHERE breakdown_id = :bid'
        );
        $bdUpdStmt = db()->prepare(
            'UPDATE ak_government_progress_payment_breakdowns SET paid_amount_try = :paid, status = :status WHERE id = :id'
        );

        foreach ($breakdowns as $bd) {
            $bdSumStmt->execute(['bid' => $bd['id']]);
            $bdPaid    = (float) $bdSumStmt->fetchColumn();
            $bdPlanned = (float) $bd['planned_amount_try'];
            if ($bdPaid <= 0)                                $bdStatus = 'planned';
            elseif ($bdPlanned > 0 && $bdPaid >= $bdPlanned) $bdStatus = 'paid';
            else                                             $bdStatus = 'partial';
            $bdUpdStmt->execute(['paid' => $bdPaid, 'status' => $bdStatus, 'id' => $bd['id']]);
        }
    }

    // Recompute parent paid from all its collections
    $sumStmt = db()->prepare(
        'SELECT COALESCE(SUM(amount_try), 0) FROM ak_government_progress_payment_collections WHERE government_progress_payment_id = :id'
    );
    $sumStmt->execute(['id' => $gppId]);
    $paidTotal = (float) $sumStmt->fetchColumn();

    $planStmt = db()->prepare('SELECT planned_amount_try FROM ak_government_progress_payments WHERE id = :id LIMIT 1');
    $planStmt->execute(['id' => $gppId]);
    $planned = (float) $planStmt->fetchColumn();

    if ($paidTotal <= 0)                              $status = 'planned';
    elseif ($planned > 0 && $paidTotal >= $planned)   $status = 'paid';
    else                                              $status = 'partial';

    db()->prepare('UPDATE ak_government_progress_payments SET paid_amount_try = :paid, status = :status WHERE id = :id')
        ->execute(['paid' => $paidTotal, 'status' => $status, 'id' => $gppId]);
}

function gpp_sync_parent_from_breakdowns(string $gppId): void
{
    $sumStmt = db()->prepare(
        'SELECT COALESCE(SUM(paid_amount_try), 0) FROM ak_government_progress_payment_breakdowns WHERE government_progress_payment_id = :id'
    );
    $sumStmt->execute(['id' => $gppId]);
    $paidTotal = (float) $sumStmt->fetchColumn();

    $planStmt = db()->prepare('SELECT planned_amount_try FROM ak_government_progress_payments WHERE id = :id LIMIT 1');
    $planStmt->execute(['id' => $gppId]);
    $planned = (float) $planStmt->fetchColumn();

    if ($paidTotal <= 0)                              $status = 'planned';
    elseif ($planned > 0 && $paidTotal >= $planned)   $status = 'paid';
    else                                              $status = 'partial';

    db()->prepare('UPDATE ak_government_progress_payments SET paid_amount_try = :paid, status = :status WHERE id = :id')
        ->execute(['paid' => $paidTotal, 'status' => $status, 'id' => $gppId]);
}

function gpp_check_collection_limits(string $gppId, ?string $breakdownId, float $newAmount, ?string $excludeId = null): void
{
    // Parent limit check
    $sql    = 'SELECT COALESCE(SUM(amount_try), 0) FROM ak_government_progress_payment_collections WHERE government_progress_payment_id = :gid';
    $params = ['gid' => $gppId];
    if ($excludeId !== null) { $sql .= ' AND id != :eid'; $params['eid'] = $excludeId; }
    $s = db()->prepare($sql);
    $s->execute($params);
    $existingParent = (float) $s->fetchColumn();

    $planStmt = db()->prepare('SELECT planned_amount_try FROM ak_government_progress_payments WHERE id = :id LIMIT 1');
    $planStmt->execute(['id' => $gppId]);
    $parentPlanned = (float) $planStmt->fetchColumn();

    if (($existingParent + $newAmount) > $parentPlanned + 0.005) {
        json_error('Toplam tahsilat hakediş planlanan tutarını aşıyor.', 422);
    }

    // Breakdown limit check
    if ($breakdownId !== null && gpp_breakdowns_table_exists()) {
        $sql2    = 'SELECT COALESCE(SUM(amount_try), 0) FROM ak_government_progress_payment_collections WHERE breakdown_id = :bid';
        $params2 = ['bid' => $breakdownId];
        if ($excludeId !== null) { $sql2 .= ' AND id != :eid'; $params2['eid'] = $excludeId; }
        $s2 = db()->prepare($sql2);
        $s2->execute($params2);
        $existingBd = (float) $s2->fetchColumn();

        $bdPlanStmt = db()->prepare('SELECT planned_amount_try FROM ak_government_progress_payment_breakdowns WHERE id = :id LIMIT 1');
        $bdPlanStmt->execute(['id' => $breakdownId]);
        $bdPlanned = (float) $bdPlanStmt->fetchColumn();

        if (($existingBd + $newAmount) > $bdPlanned + 0.005) {
            json_error('Tahsilat bu aşamanın planlanan tutarını aşıyor.', 422);
        }
    }
}

// ---------------------------------------------------------------------------
// Seed + cast
// ---------------------------------------------------------------------------

function gpp_seed_breakdowns(string $gppId, float $planned): void
{
    $stages = [
        ['Su Basmanı',  30.0, 1],
        ['Kaba İnşaat', 30.0, 2],
        ['İnce İnşaat', 30.0, 3],
        ['İskan',       10.0, 4],
    ];
    $stmt = db()->prepare(
        "INSERT INTO ak_government_progress_payment_breakdowns
           (id, government_progress_payment_id, stage, stage_percentage, planned_amount_try, paid_amount_try, status, sort_order)
         VALUES (:id, :gpp_id, :stage, :pct, :planned, 0, 'planned', :sort)"
    );
    foreach ($stages as [$stage, $pct, $sort]) {
        $stmt->execute([
            'id'     => uuid_v4(),
            'gpp_id' => $gppId,
            'stage'  => $stage,
            'pct'    => $pct,
            'planned'=> round($planned * $pct / 100, 2),
            'sort'   => $sort,
        ]);
    }
}

function gpp_cast_row(array $row): array
{
    $row['planned_amount_try'] = (float) $row['planned_amount_try'];
    $row['paid_amount_try']    = (float) $row['paid_amount_try'];
    $row['stage_percentage']   = (float) $row['stage_percentage'];
    return $row;
}

function gpp_payload(array $input, float $existingPaid = 0.0): array
{
    $planned = max(0.0, (float) ($input['planned_amount_try'] ?? 0));

    // paid_amount_try comes from collections/breakdowns — never from the client.
    $paid = $existingPaid;

    // Derive status from amounts; never trust client.
    if ($paid <= 0)                            $status = 'planned';
    elseif ($planned > 0 && $paid >= $planned) $status = 'paid';
    else                                       $status = 'partial';

    return [
        'project_id'         => nullable_string($input, 'project_id'),
        'customer_id'        => nullable_string($input, 'customer_id'),
        'title'              => require_non_empty($input, 'title', 'Başlık zorunludur.'),
        'stage'              => 'Belirtilmemiş',
        'stage_percentage'   => 0.0,
        'planned_amount_try' => $planned,
        'paid_amount_try'    => $paid,
        'due_date'           => nullable_string($input, 'due_date'),
        'paid_date'          => null,
        'status'             => $status,
        'notes'              => nullable_string($input, 'notes'),
    ];
}
