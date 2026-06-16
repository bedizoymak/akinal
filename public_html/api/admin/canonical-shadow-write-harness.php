<?php
declare(strict_types=1);

require_once __DIR__ . '/canonical-transaction-service.php';

const SHADOW_MISMATCH_AMOUNT = 'amount mismatch';
const SHADOW_MISMATCH_CURRENCY = 'currency mismatch';
const SHADOW_MISMATCH_ACCOUNT_TYPE = 'account type mismatch';
const SHADOW_MISMATCH_OWNER_PROJECT = 'owner/project mismatch';
const SHADOW_MISMATCH_STATUS = 'status mismatch';
const SHADOW_MISMATCH_DUPLICATE = 'duplicate/double-count risk';

function shadowCreateCanonicalEntry(PDO $pdo, array $legacyEvent, array $canonicalCommand): array
{
    canonicalRequireSettlementEnabled();
    $entry = createLegacyBackedEntry(
        $pdo,
        (string) ($legacyEvent['source_type'] ?? 'shadow_legacy'),
        (string) ($legacyEvent['source_id'] ?? $legacyEvent['id'] ?? ''),
        $canonicalCommand
    );

    return shadowCompareSnapshots(
        shadowLegacySnapshot($legacyEvent),
        shadowCanonicalEntrySnapshot($entry),
        !empty($legacyEvent['legacy_already_counted'])
    ) + ['canonical_entry' => $entry];
}

function shadowSettlePlan(PDO $pdo, array $legacyPlanState, array $settlementCommand): array
{
    canonicalRequireSettlementEnabled();
    $result = settlePlan($pdo, $settlementCommand);

    return shadowCompareSnapshots(
        shadowLegacySnapshot($legacyPlanState),
        shadowCanonicalPlanStateSnapshot($result['plan_state'], $legacyPlanState)
    ) + ['canonical_settlement' => $result['settlement'], 'canonical_plan_state' => $result['plan_state']];
}

function shadowBuildParityReport(array $comparisons): array
{
    $summary = [
        SHADOW_MISMATCH_AMOUNT => 0,
        SHADOW_MISMATCH_CURRENCY => 0,
        SHADOW_MISMATCH_ACCOUNT_TYPE => 0,
        SHADOW_MISMATCH_OWNER_PROJECT => 0,
        SHADOW_MISMATCH_STATUS => 0,
        SHADOW_MISMATCH_DUPLICATE => 0,
    ];
    foreach ($comparisons as $comparison) {
        foreach ($comparison['mismatches'] ?? [] as $mismatch) {
            $summary[$mismatch] = ($summary[$mismatch] ?? 0) + 1;
        }
    }

    return [
        'status' => array_sum($summary) === 0 ? 'PASS' : 'FAIL',
        'summary' => $summary,
        'comparisons' => $comparisons,
    ];
}

function shadowCompareSnapshots(array $legacy, array $canonical, bool $duplicateRisk = false): array
{
    $mismatches = [];
    if (shadowMoney($legacy['amount'] ?? null) !== shadowMoney($canonical['amount'] ?? null)) {
        $mismatches[] = SHADOW_MISMATCH_AMOUNT;
    }
    if (($legacy['currency'] ?? null) !== ($canonical['currency'] ?? null)) {
        $mismatches[] = SHADOW_MISMATCH_CURRENCY;
    }
    if (($legacy['account_type'] ?? null) !== ($canonical['account_type'] ?? null)) {
        $mismatches[] = SHADOW_MISMATCH_ACCOUNT_TYPE;
    }
    foreach (['owner_type', 'owner_id', 'project_id'] as $field) {
        if (($legacy[$field] ?? null) !== ($canonical[$field] ?? null)) {
            $mismatches[] = SHADOW_MISMATCH_OWNER_PROJECT;
            break;
        }
    }
    if (($legacy['status'] ?? null) !== ($canonical['status'] ?? null)) {
        $mismatches[] = SHADOW_MISMATCH_STATUS;
    }
    if ($duplicateRisk) {
        $mismatches[] = SHADOW_MISMATCH_DUPLICATE;
    }

    return [
        'status' => $mismatches === [] ? 'PASS' : 'FAIL',
        'mismatches' => array_values(array_unique($mismatches)),
        'legacy' => $legacy,
        'canonical' => $canonical,
    ];
}

function shadowLegacySnapshot(array $row): array
{
    return [
        'amount' => shadowMoney($row['amount'] ?? $row['remaining_amount'] ?? null),
        'currency' => $row['currency'] ?? $row['currency_tag'] ?? 'TRY',
        'account_type' => $row['account_type'] ?? (($row['group_tag'] ?? null) === 'Gayri Resmi' ? 'gayri_resmi' : 'resmi'),
        'owner_type' => $row['owner_type'] ?? shadowOwnerType($row),
        'owner_id' => $row['owner_id'] ?? $row['counterparty_id'] ?? $row['customer_id'] ?? $row['employee_id'] ?? $row['expense_card_id'] ?? null,
        'project_id' => $row['project_id'] ?? null,
        'status' => shadowNormalizeStatus((string) ($row['status'] ?? 'posted')),
    ];
}

function shadowCanonicalEntrySnapshot(array $entry): array
{
    return [
        'amount' => shadowMoney($entry['amount'] ?? null),
        'currency' => canonical_record_currency($entry),
        'account_type' => canonical_record_account_type($entry),
        'owner_type' => $entry['counterparty_type'] ?? shadowOwnerType($entry),
        'owner_id' => $entry['counterparty_id'] ?? $entry['customer_id'] ?? $entry['employee_id'] ?? $entry['expense_card_id'] ?? null,
        'project_id' => $entry['project_id'] ?? null,
        'status' => shadowNormalizeStatus((string) ($entry['status'] ?? '')),
    ];
}

function shadowCanonicalPlanStateSnapshot(array $state, array $legacyPlanState): array
{
    return [
        'amount' => shadowMoney($state['remaining_amount'] ?? null),
        'currency' => $legacyPlanState['currency'] ?? 'TRY',
        'account_type' => $legacyPlanState['account_type'] ?? 'resmi',
        'owner_type' => $legacyPlanState['owner_type'] ?? shadowOwnerType($legacyPlanState),
        'owner_id' => $legacyPlanState['owner_id'] ?? $legacyPlanState['counterparty_id'] ?? $legacyPlanState['customer_id'] ?? $legacyPlanState['employee_id'] ?? $legacyPlanState['expense_card_id'] ?? null,
        'project_id' => $legacyPlanState['project_id'] ?? null,
        'status' => shadowNormalizeStatus((string) ($state['status'] ?? '')),
    ];
}

function shadowNormalizeStatus(string $status): string
{
    return match ($status) {
        'Gerçekleşti', 'posted' => 'posted',
        'Planlandı', 'forecast' => 'forecast',
        'Ödendi', 'paid' => 'paid',
        'Kısmi Ödendi', 'partial' => 'partial',
        'Bekliyor', 'pending' => 'pending',
        'Vadesi Geçti', 'overdue' => 'overdue',
        'İptal', 'canceled' => 'canceled',
        'reversed' => 'reversed',
        default => $status,
    };
}

function shadowOwnerType(array $row): ?string
{
    if (!empty($row['customer_id'])) {
        return 'customer';
    }
    if (!empty($row['employee_id'])) {
        return 'employee';
    }
    if (!empty($row['expense_card_id'])) {
        return 'supplier';
    }
    return $row['counterparty_type'] ?? null;
}

function shadowMoney(mixed $value): float
{
    return round((float) ($value ?? 0), 2);
}
