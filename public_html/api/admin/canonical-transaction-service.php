<?php
declare(strict_types=1);

require_once __DIR__ . '/canonical-finance-service.php';

function canonicalSettlementEnabled(): bool
{
    return defined('CANONICAL_SETTLEMENT_ENABLED') && CANONICAL_SETTLEMENT_ENABLED === true;
}

function canonicalRequireSettlementEnabled(): void
{
    if (!canonicalSettlementEnabled()) {
        throw new LogicException('Canonical settlement service is disabled.');
    }
}

function createCanonicalEntry(PDO $pdo, array $command): array
{
    canonicalRequireSettlementEnabled();
    return canonicalRunTransaction($pdo, static function () use ($pdo, $command): array {
        $payload = canonicalBuildEntryPayload($command);
        canonicalThrowValidationErrors(canonical_validate_ledger_payload($payload));
        $existing = canonicalFindEntryByBusinessIdentity($pdo, $payload['business_transaction_id']);
        if ($existing !== null) {
            canonicalAssertIdempotentEntry($existing, $payload);
            return $existing;
        }
        canonicalInsertEntry($pdo, $payload);
        return canonicalLockEntry($pdo, $payload['id']);
    });
}

function createLegacyBackedEntry(PDO $pdo, string $sourceType, string $sourceId, array $command): array
{
    canonicalRequireSettlementEnabled();
    $sourceType = trim($sourceType);
    $sourceId = trim($sourceId);
    if ($sourceType === '' || $sourceId === '') {
        throw new InvalidArgumentException('Legacy source type and ID are required.');
    }
    return canonicalRunTransaction($pdo, static function () use ($pdo, $sourceType, $sourceId, $command): array {
        $payload = canonicalBuildEntryPayload(array_merge($command, ['source_type' => $sourceType, 'source_id' => $sourceId]));
        canonicalThrowValidationErrors(canonical_validate_ledger_payload($payload));
        $existing = canonicalFindEntryBySourceIdentity($pdo, $sourceType, $sourceId);
        if ($existing !== null) {
            canonicalAssertIdempotentEntry($existing, $payload);
            return $existing;
        }
        canonicalInsertEntry($pdo, $payload);
        return canonicalLockEntry($pdo, $payload['id']);
    });
}

function settlePlan(PDO $pdo, array $command): array
{
    canonicalRequireSettlementEnabled();
    return canonicalRunTransaction($pdo, static function () use ($pdo, $command): array {
        $planId = canonicalRequiredId($command, 'payment_plan_id');
        $entryId = canonicalRequiredId($command, 'financial_entry_id');
        $settlementId = canonicalRequiredId($command, 'id');
        $plan = canonicalLockPlan($pdo, $planId);
        $entry = canonicalLockEntry($pdo, $entryId);
        canonicalAssertPlanEligible($plan);
        canonicalAssertEntryEligibleForSettlement($entry);

        $payload = [
            'id' => $settlementId,
            'payment_plan_id' => $planId,
            'financial_entry_id' => $entryId,
            'allocated_amount' => canonicalMoney($command['allocated_amount'] ?? null),
            'currency' => $command['currency'] ?? canonical_record_currency($entry),
            'account_type' => $command['account_type'] ?? canonical_record_account_type($entry),
            'created_by' => canonical_nullable_id($command['created_by'] ?? null),
            'approved_project_exception' => !empty($command['approved_project_exception']),
        ];
        canonicalThrowValidationErrors(canonical_validate_settlement_payload($payload, $plan, $entry));

        $existing = canonicalFindActiveSettlementPair($pdo, $planId, $entryId);
        if ($existing !== null) {
            canonicalAssertIdempotentSettlement($existing, $payload);
            return ['settlement' => $existing, 'plan_state' => derivePlanState($pdo, $planId, $command['as_of'] ?? null, true)];
        }

        canonical_assert_no_over_allocation(
            $payload['allocated_amount'],
            canonicalMoney($plan['amount']),
            canonicalGetLockedSettlementTotal($pdo, 'payment_plan_id', $planId),
            canonicalMoney($entry['amount']),
            canonicalGetLockedSettlementTotal($pdo, 'financial_entry_id', $entryId)
        );
        $statement = $pdo->prepare(
            'INSERT INTO ak_payment_plan_settlements '
            . '(id, payment_plan_id, financial_entry_id, allocated_amount, currency, account_type, created_by) '
            . 'VALUES (:id, :payment_plan_id, :financial_entry_id, :allocated_amount, :currency, :account_type, :created_by)'
        );
        $statement->execute(array_diff_key($payload, ['approved_project_exception' => true]));
        return ['settlement' => canonicalLockSettlement($pdo, $settlementId), 'plan_state' => derivePlanState($pdo, $planId, $command['as_of'] ?? null, true)];
    });
}

function reverseCanonicalEntry(PDO $pdo, string $entryId, array $command): array
{
    canonicalRequireSettlementEnabled();
    return canonicalRunTransaction($pdo, static function () use ($pdo, $entryId, $command): array {
        $original = canonicalLockEntry($pdo, $entryId);
        if (($original['status'] ?? null) !== 'posted' || !empty($original['reversal_entry_id'])) {
            throw new DomainException('Only unreversed posted entries can be reversed.');
        }
        $reason = trim((string) ($command['reason'] ?? ''));
        if ($reason === '') {
            throw new InvalidArgumentException('Reversal reason is required.');
        }
        $date = (string) ($command['transaction_date'] ?? gmdate('Y-m-d'));
        $reversal = canonicalBuildEntryPayload(array_merge($original, $command, [
            'id' => canonicalRequiredId($command, 'id'),
            'business_transaction_id' => canonicalRequiredId($command, 'business_transaction_id'),
            'event_type' => 'reversal',
            'parent_entry_id' => $entryId,
            'direction' => canonicalOppositeDirection((string) $original['direction']),
            'status' => 'posted',
            'transaction_date' => $date,
            'entry_date' => $date,
            'cancellation_reason' => $reason,
            'source_type' => $command['source_type'] ?? 'canonical_reversal',
            'source_id' => $command['source_id'] ?? $entryId,
            'title' => $command['title'] ?? ('Reversal: ' . ($original['title'] ?? $entryId)),
            'description' => $command['description'] ?? $reason,
        ]));
        canonicalThrowValidationErrors(canonical_validate_ledger_payload($reversal));

        $settlements = canonicalLockEntrySettlements($pdo, $entryId);
        $actor = canonical_nullable_id($command['reversed_by'] ?? null);
        foreach ($settlements as $settlement) {
            $statement = $pdo->prepare(
                'UPDATE ak_payment_plan_settlements SET reversed_at = CURRENT_TIMESTAMP, '
                . 'reversed_by = :reversed_by, reversal_reason = :reason WHERE id = :id AND reversed_at IS NULL'
            );
            $statement->execute(['reversed_by' => $actor, 'reason' => $reason, 'id' => $settlement['id']]);
        }
        canonicalInsertEntry($pdo, $reversal);
        $statement = $pdo->prepare(
            "UPDATE ak_financial_entries SET status = 'reversed', reversal_entry_id = :reversal_id, "
            . 'canceled_at = CURRENT_TIMESTAMP, canceled_by = :canceled_by, cancellation_reason = :reason '
            . "WHERE id = :id AND status = 'posted' AND reversal_entry_id IS NULL"
        );
        $statement->execute(['reversal_id' => $reversal['id'], 'canceled_by' => $actor, 'reason' => $reason, 'id' => $entryId]);
        if ($statement->rowCount() !== 1) {
            throw new RuntimeException('Posted entry reversal state could not be persisted.');
        }
        return ['original' => canonicalLockEntry($pdo, $entryId), 'reversal' => canonicalLockEntry($pdo, $reversal['id']), 'reversed_settlement_count' => count($settlements)];
    });
}

function derivePlanState(PDO $pdo, string $planId, DateTimeImmutable|string|null $asOf = null, bool $alreadyLocked = false): array
{
    canonicalRequireSettlementEnabled();
    $plan = canonicalFetchPlan($pdo, $planId, !$alreadyLocked);
    $settled = canonicalGetLockedSettlementTotal($pdo, 'payment_plan_id', $planId);
    $date = is_string($asOf) ? canonical_parse_date($asOf) : $asOf;
    if (is_string($asOf) && $date === null) {
        throw new InvalidArgumentException('as_of must be a valid ISO date.');
    }
    $canceled = !empty($plan['canceled_at']) || !empty($plan['archived_at']) || ($plan['status'] ?? null) === 'İptal';
    return array_merge(canonical_derive_plan_status_from_settlements(canonicalMoney($plan['amount']), $settled, (string) $plan['due_date'], $date, $canceled), ['settled_amount' => $settled, 'payment_plan_id' => $planId]);
}

function canonicalRunTransaction(PDO $pdo, callable $operation): mixed
{
    if ($pdo->inTransaction()) {
        return $operation();
    }
    $pdo->beginTransaction();
    try {
        $result = $operation();
        $pdo->commit();
        return $result;
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

function canonicalBuildEntryPayload(array $command): array
{
    $currency = (string) ($command['currency'] ?? $command['currency_tag'] ?? '');
    $accountType = (string) ($command['account_type'] ?? canonical_record_account_type($command) ?? '');
    $date = (string) ($command['transaction_date'] ?? $command['entry_date'] ?? '');
    return array_merge($command, [
        'id' => canonicalRequiredId($command, 'id'), 'business_transaction_id' => canonicalRequiredId($command, 'business_transaction_id'),
        'entry_date' => $date, 'transaction_date' => $date, 'amount' => canonicalMoney($command['amount'] ?? null),
        'base_amount' => canonicalMoney($command['base_amount'] ?? null), 'currency' => $currency, 'currency_tag' => $currency,
        'account_type' => $accountType, 'group_tag' => $accountType === 'gayri_resmi' ? 'Gayri Resmi' : 'Resmi',
        'card_type' => $command['card_type'] ?? canonicalCompatibilityCardType((string) ($command['counterparty_type'] ?? '')),
        'title' => trim((string) ($command['title'] ?? 'Canonical entry')), 'description' => $command['description'] ?? null,
        'customer_id' => canonical_nullable_id($command['customer_id'] ?? null), 'employee_id' => canonical_nullable_id($command['employee_id'] ?? null),
        'expense_card_id' => canonical_nullable_id($command['expense_card_id'] ?? null),
    ]);
}

function canonicalInsertEntry(PDO $pdo, array $payload): void
{
    $allowed = ['id','project_id','entry_date','business_transaction_id','event_type','source_type','source_id','source_version','payment_plan_id','parent_entry_id','counterparty_type','counterparty_id','account_type','allocation_scope','allocation_note','transaction_date','due_date','exchange_rate','base_amount','category_code','subcategory_code','document_id','migration_confidence','reconciliation_status','card_type','customer_id','employee_id','expense_card_id','title','description','amount','currency_tag','group_tag','direction','status','document_url','cancellation_reason'];
    $row = array_intersect_key($payload, array_flip($allowed));
    $columns = array_keys($row);
    $pdo->prepare('INSERT INTO ak_financial_entries (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($row);
}

function canonicalFindEntryByBusinessIdentity(PDO $pdo, string $id): ?array
{
    $statement = $pdo->prepare('SELECT * FROM ak_financial_entries WHERE business_transaction_id = :id ORDER BY created_at ASC LIMIT 1 FOR UPDATE');
    $statement->execute(['id' => $id]);
    return canonicalFetchOptional($statement);
}

function canonicalFindEntryBySourceIdentity(PDO $pdo, string $type, string $id): ?array
{
    $statement = $pdo->prepare('SELECT * FROM ak_financial_entries WHERE source_type = :type AND source_id = :id ORDER BY created_at ASC LIMIT 1 FOR UPDATE');
    $statement->execute(['type' => $type, 'id' => $id]);
    return canonicalFetchOptional($statement);
}

function canonicalLockPlan(PDO $pdo, string $id): array { return canonicalFetchPlan($pdo, $id, true); }
function canonicalFetchPlan(PDO $pdo, string $id, bool $lock): array { $s=$pdo->prepare('SELECT * FROM ak_payment_plans WHERE id = :id' . ($lock ? ' FOR UPDATE' : '')); $s->execute(['id'=>$id]); return canonicalFetchRequired($s,'Payment plan was not found.'); }
function canonicalLockEntry(PDO $pdo, string $id): array { $s=$pdo->prepare('SELECT * FROM ak_financial_entries WHERE id = :id FOR UPDATE'); $s->execute(['id'=>$id]); return canonicalFetchRequired($s,'Financial entry was not found.'); }
function canonicalLockSettlement(PDO $pdo, string $id): array { $s=$pdo->prepare('SELECT * FROM ak_payment_plan_settlements WHERE id = :id FOR UPDATE'); $s->execute(['id'=>$id]); return canonicalFetchRequired($s,'Settlement was not found.'); }

function canonicalFindActiveSettlementPair(PDO $pdo, string $planId, string $entryId): ?array
{
    $s=$pdo->prepare('SELECT * FROM ak_payment_plan_settlements WHERE payment_plan_id = :plan AND financial_entry_id = :entry AND reversed_at IS NULL LIMIT 1 FOR UPDATE');
    $s->execute(['plan'=>$planId,'entry'=>$entryId]); return canonicalFetchOptional($s);
}

function canonicalGetLockedSettlementTotal(PDO $pdo, string $column, string $id): float
{
    if (!in_array($column, ['payment_plan_id','financial_entry_id'], true)) throw new InvalidArgumentException('Unsupported settlement total column.');
    $s=$pdo->prepare("SELECT allocated_amount FROM ak_payment_plan_settlements WHERE {$column} = :id AND reversed_at IS NULL FOR UPDATE");
    $s->execute(['id'=>$id]); $total=0.0; while (($row=$s->fetch(PDO::FETCH_ASSOC)) !== false) $total += canonicalMoney($row['allocated_amount'] ?? 0); return $total;
}

function canonicalLockEntrySettlements(PDO $pdo, string $entryId): array { $s=$pdo->prepare('SELECT * FROM ak_payment_plan_settlements WHERE financial_entry_id = :id AND reversed_at IS NULL FOR UPDATE'); $s->execute(['id'=>$entryId]); return $s->fetchAll(PDO::FETCH_ASSOC); }
function canonicalAssertPlanEligible(array $plan): void { if (!empty($plan['archived_at']) || !empty($plan['canceled_at']) || ($plan['status'] ?? null)==='İptal') throw new DomainException('Canceled or archived plans cannot be settled.'); canonicalThrowValidationErrors(canonical_validate_payment_plan_fields($plan)); }
function canonicalAssertEntryEligibleForSettlement(array $entry): void
{
    if (($entry['status'] ?? null)!=='posted' || !empty($entry['reversal_entry_id']) || !empty($entry['canceled_at'])) {
        throw new DomainException('Only active posted entries can be settled.');
    }
    canonicalThrowValidationErrors(canonical_validate_ledger_payload(canonicalNormalizeLedgerRow($entry)));
}

function canonicalAssertIdempotentEntry(array $existing, array $payload): void
{
    $existing['currency'] = canonical_record_currency($existing);
    $existing['account_type'] = canonical_record_account_type($existing);
    foreach (['business_transaction_id','source_type','source_id','event_type','direction','amount','currency','account_type','transaction_date','counterparty_type','counterparty_id','project_id','allocation_scope'] as $field) if (canonical_scalar($existing[$field] ?? null)!==canonical_scalar($payload[$field] ?? null)) throw new DomainException('Idempotency identity already exists with different canonical data.');
}
function canonicalAssertIdempotentSettlement(array $existing, array $payload): void { foreach (['id','payment_plan_id','financial_entry_id','allocated_amount','currency','account_type'] as $field) if (canonical_scalar($existing[$field] ?? null)!==canonical_scalar($payload[$field] ?? null)) throw new DomainException('Active settlement pair already exists with different data.'); }
function canonicalThrowValidationErrors(array $errors): void { if ($errors!==[]) throw new DomainException(implode(' ', $errors)); }
function canonicalFetchOptional(PDOStatement $s): ?array { $row=$s->fetch(PDO::FETCH_ASSOC); return is_array($row)?$row:null; }
function canonicalFetchRequired(PDOStatement $s,string $message): array { $row=canonicalFetchOptional($s); if ($row===null) throw new DomainException($message); return $row; }
function canonicalRequiredId(array $payload,string $field): string { $value=canonical_nullable_id($payload[$field]??null); if ($value===null) throw new InvalidArgumentException("{$field} is required."); return $value; }
function canonicalMoney(mixed $value): float { if (!is_numeric($value)) throw new InvalidArgumentException('Canonical amount must be numeric.'); return round((float)$value,2); }
function canonicalCompatibilityCardType(string $type): string { return match($type){'customer'=>'customer','employee'=>'employee',default=>'expense'}; }
function canonicalOppositeDirection(string $direction): string { return match($direction){'income'=>'expense','expense'=>'income','transfer'=>'transfer',default=>throw new DomainException('Original entry has an invalid canonical direction.')}; }
function canonicalNormalizeLedgerRow(array $entry): array
{
    $entry['currency'] = canonical_record_currency($entry);
    $entry['account_type'] = canonical_record_account_type($entry);
    return $entry;
}
