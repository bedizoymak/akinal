<?php
declare(strict_types=1);

/**
 * Additive canonical finance domain contract.
 *
 * This file is intentionally not included by live endpoints in Phase 3C.
 * Database helpers are read-only and require an explicit PDO instance.
 */

const CANONICAL_EVENT_TYPES = [
    'customer_receipt',
    'customer_refund',
    'personnel_payment',
    'supplier_payment',
    'general_expense',
    'expense_refund',
    'forecast_income',
    'forecast_expense',
    'adjustment',
    'reversal',
    'transfer',
    'opening_balance',
    'currency_difference',
];
const CANONICAL_DIRECTIONS = ['income', 'expense', 'transfer'];
const CANONICAL_STATUSES = ['draft', 'forecast', 'posted', 'canceled', 'reversed', 'archived'];
const CANONICAL_ACCOUNT_TYPES = ['resmi', 'gayri_resmi'];
const CANONICAL_ALLOCATION_SCOPES = ['project', 'company_overhead', 'unallocated'];
const CANONICAL_COUNTERPARTY_TYPES = ['customer', 'employee', 'supplier', 'government', 'internal', 'other', 'none'];
const CANONICAL_CURRENCIES = ['TRY', 'USD', 'EUR'];
const CANONICAL_RECONCILIATION_STATUSES = ['pending', 'matched', 'ambiguous', 'excluded', 'approved'];
const CANONICAL_MIGRATION_CONFIDENCES = ['exact', 'probable', 'ambiguous', 'manual'];

function canonical_enum_values(string $enum): array
{
    $values = [
        'event_type' => CANONICAL_EVENT_TYPES,
        'direction' => CANONICAL_DIRECTIONS,
        'status' => CANONICAL_STATUSES,
        'account_type' => CANONICAL_ACCOUNT_TYPES,
        'allocation_scope' => CANONICAL_ALLOCATION_SCOPES,
        'counterparty_type' => CANONICAL_COUNTERPARTY_TYPES,
        'currency' => CANONICAL_CURRENCIES,
        'reconciliation_status' => CANONICAL_RECONCILIATION_STATUSES,
        'migration_confidence' => CANONICAL_MIGRATION_CONFIDENCES,
    ];

    if (!isset($values[$enum])) {
        throw new InvalidArgumentException("Unknown canonical enum: {$enum}");
    }

    return $values[$enum];
}

function canonical_validate_ledger_payload(array $payload, ?DateTimeImmutable $asOf = null): array
{
    $errors = [];
    canonical_validate_enum_field($errors, $payload, 'event_type', CANONICAL_EVENT_TYPES);
    canonical_validate_enum_field($errors, $payload, 'direction', CANONICAL_DIRECTIONS);
    canonical_validate_enum_field($errors, $payload, 'status', CANONICAL_STATUSES);
    canonical_validate_enum_field($errors, $payload, 'account_type', CANONICAL_ACCOUNT_TYPES);
    canonical_validate_enum_field($errors, $payload, 'allocation_scope', CANONICAL_ALLOCATION_SCOPES);
    canonical_validate_enum_field($errors, $payload, 'counterparty_type', CANONICAL_COUNTERPARTY_TYPES);
    canonical_validate_enum_field($errors, $payload, 'currency', CANONICAL_CURRENCIES);
    canonical_validate_optional_enum_field($errors, $payload, 'reconciliation_status', CANONICAL_RECONCILIATION_STATUSES);
    canonical_validate_optional_enum_field($errors, $payload, 'migration_confidence', CANONICAL_MIGRATION_CONFIDENCES);

    canonical_require_positive_amount($errors, $payload, 'amount');
    canonical_require_non_empty($errors, $payload, 'business_transaction_id');
    canonical_require_iso_date($errors, $payload, 'transaction_date');
    $errors = array_merge($errors, canonical_validate_counterparty_consistency($payload));
    $errors = array_merge($errors, canonical_validate_project_scope($payload));
    $errors = array_merge($errors, canonical_validate_reversal_adjustment_requirements($payload));
    $errors = array_merge($errors, canonical_validate_cheque_senet_maturity_policy($payload, $asOf));

    if (($payload['status'] ?? null) === 'posted' && empty($payload['base_amount'])) {
        $errors[] = 'Posted entries require base_amount.';
    }
    if (($payload['currency'] ?? null) !== 'TRY' && ($payload['status'] ?? null) === 'posted') {
        if (!isset($payload['exchange_rate']) || (float) $payload['exchange_rate'] <= 0) {
            $errors[] = 'Posted foreign-currency entries require a positive exchange_rate.';
        }
    }

    return array_values(array_unique($errors));
}

function canonical_validate_payment_plan_fields(array $payload): array
{
    $errors = [];
    canonical_validate_enum_field($errors, $payload, 'direction', ['income', 'expense']);
    canonical_validate_enum_field($errors, $payload, 'account_type', CANONICAL_ACCOUNT_TYPES);
    canonical_validate_enum_field($errors, $payload, 'allocation_scope', CANONICAL_ALLOCATION_SCOPES);
    canonical_validate_enum_field($errors, $payload, 'counterparty_type', CANONICAL_COUNTERPARTY_TYPES);
    canonical_validate_enum_field($errors, $payload, 'currency', CANONICAL_CURRENCIES);
    canonical_validate_optional_enum_field($errors, $payload, 'reconciliation_status', CANONICAL_RECONCILIATION_STATUSES);
    canonical_validate_optional_enum_field($errors, $payload, 'migration_confidence', CANONICAL_MIGRATION_CONFIDENCES);
    canonical_require_positive_amount($errors, $payload, 'amount');
    canonical_require_non_empty($errors, $payload, 'business_transaction_id');
    canonical_require_iso_date($errors, $payload, 'due_date');
    $errors = array_merge($errors, canonical_validate_counterparty_consistency($payload));
    $errors = array_merge($errors, canonical_validate_project_scope($payload));
    $errors = array_merge($errors, canonical_validate_cheque_senet_maturity_policy($payload));

    return array_values(array_unique($errors));
}

function canonical_validate_settlement_payload(array $payload, array $plan, array $entry): array
{
    $errors = [];
    canonical_require_non_empty($errors, $payload, 'payment_plan_id');
    canonical_require_non_empty($errors, $payload, 'financial_entry_id');
    canonical_require_positive_amount($errors, $payload, 'allocated_amount');
    canonical_validate_enum_field($errors, $payload, 'account_type', CANONICAL_ACCOUNT_TYPES);
    canonical_validate_enum_field($errors, $payload, 'currency', CANONICAL_CURRENCIES);

    foreach ([
        'canonical_assert_same_account_type',
        'canonical_assert_same_currency',
        'canonical_assert_same_counterparty',
        'canonical_assert_same_project',
    ] as $assertion) {
        try {
            $assertion($plan, $entry, $payload);
        } catch (DomainException $exception) {
            $errors[] = $exception->getMessage();
        }
    }

    return array_values(array_unique($errors));
}

function canonical_validate_counterparty_consistency(array $record): array
{
    $type = trim((string) ($record['counterparty_type'] ?? ''));
    $id = canonical_nullable_id($record['counterparty_id'] ?? null);
    $errors = [];

    if (in_array($type, ['customer', 'employee', 'supplier'], true) && $id === null) {
        $errors[] = 'The selected counterparty type requires counterparty_id.';
    }
    if (in_array($type, ['internal', 'none'], true) && $id !== null) {
        $errors[] = 'Internal or none counterparty must not have counterparty_id.';
    }

    $compatibility = [
        'customer' => 'customer_id',
        'employee' => 'employee_id',
        'supplier' => 'expense_card_id',
    ];
    if (isset($compatibility[$type])) {
        $legacyId = canonical_nullable_id($record[$compatibility[$type]] ?? null);
        if ($legacyId !== null && $id !== null && $legacyId !== $id) {
            $errors[] = 'Canonical and compatibility counterparty IDs do not match.';
        }
    }

    return $errors;
}

function canonical_validate_project_scope(array $record): array
{
    $scope = $record['allocation_scope'] ?? null;
    $projectId = canonical_nullable_id($record['project_id'] ?? null);
    $note = trim((string) ($record['allocation_note'] ?? ''));
    $errors = [];

    if ($scope === 'project' && $projectId === null) {
        $errors[] = 'Project scope requires project_id.';
    }
    if ($scope === 'company_overhead' && $projectId !== null) {
        $errors[] = 'Company overhead must not carry project_id.';
    }
    if (in_array($scope, ['company_overhead', 'unallocated'], true) && $note === '') {
        $errors[] = 'Company overhead or unallocated scope requires allocation_note.';
    }

    return $errors;
}

function canonical_validate_account_type_consistency(array $left, array $right): array
{
    return canonical_record_account_type($left) === canonical_record_account_type($right)
        ? []
        : ['Account types do not match.'];
}

function canonical_validate_currency_consistency(array $left, array $right): array
{
    return canonical_record_currency($left) === canonical_record_currency($right)
        ? []
        : ['Currencies do not match.'];
}

function canonical_validate_cheque_senet_maturity_policy(array $record, ?DateTimeImmutable $asOf = null): array
{
    $method = trim((string) ($record['payment_method'] ?? ''));
    if (!in_array($method, ['Çek', 'Senet'], true)) {
        return [];
    }

    $maturityField = $method === 'Çek' ? 'cheque_maturity_date' : 'promissory_maturity_date';
    $maturity = canonical_parse_date($record[$maturityField] ?? null);
    $errors = [];
    if ($maturity === null) {
        return ["{$method} requires a valid maturity date."];
    }

    $status = $record['status'] ?? null;
    $eventType = $record['event_type'] ?? null;
    $clearingStatus = $record['instrument_status'] ?? null;
    $isRealized = $status === 'posted' || in_array($eventType, [
        'customer_receipt',
        'personnel_payment',
        'supplier_payment',
        'general_expense',
    ], true);
    $today = ($asOf ?? new DateTimeImmutable('today'))->setTime(0, 0);

    if ($isRealized && ($maturity > $today || !in_array($clearingStatus, ['cleared', 'paid'], true))) {
        $errors[] = 'Cheque/senet is realized only when cleared or paid at maturity.';
    }
    if (in_array($clearingStatus, ['protested', 'returned'], true) && $status === 'posted') {
        $errors[] = 'Protested or returned instrument requires reversal and must not remain posted cash.';
    }

    return $errors;
}

function canonical_validate_immutable_posted_entry(array $existing, array $proposed): array
{
    if (($existing['status'] ?? null) !== 'posted') {
        return [];
    }

    $immutable = [
        'business_transaction_id',
        'event_type',
        'direction',
        'amount',
        'currency',
        'account_type',
        'transaction_date',
        'counterparty_type',
        'counterparty_id',
        'project_id',
        'allocation_scope',
    ];
    foreach ($immutable as $field) {
        if (array_key_exists($field, $proposed)
            && canonical_scalar($existing[$field] ?? null) !== canonical_scalar($proposed[$field])) {
            return ["Posted entry field {$field} is immutable."];
        }
    }

    return [];
}

function canonical_validate_reversal_adjustment_requirements(array $record): array
{
    $eventType = $record['event_type'] ?? null;
    if (!in_array($eventType, ['reversal', 'adjustment'], true)) {
        return [];
    }

    $errors = [];
    if (canonical_nullable_id($record['parent_entry_id'] ?? null) === null) {
        $errors[] = 'Reversal or adjustment requires parent_entry_id.';
    }
    $reason = trim((string) ($record['cancellation_reason'] ?? $record['adjustment_reason'] ?? ''));
    if ($reason === '') {
        $errors[] = 'Reversal or adjustment requires a reason.';
    }

    return $errors;
}

function canonical_get_plan_settlement_total(PDO $pdo, string $planId): float
{
    return canonical_settlement_sum(
        $pdo,
        'SELECT COALESCE(SUM(allocated_amount), 0) FROM ak_payment_plan_settlements WHERE payment_plan_id = :id AND reversed_at IS NULL',
        $planId
    );
}

function canonical_get_entry_settlement_total(PDO $pdo, string $entryId): float
{
    return canonical_settlement_sum(
        $pdo,
        'SELECT COALESCE(SUM(allocated_amount), 0) FROM ak_payment_plan_settlements WHERE financial_entry_id = :id AND reversed_at IS NULL',
        $entryId
    );
}

function canonical_calculate_remaining_plan_amount(float $planAmount, float $settledAmount): float
{
    return max(0.0, $planAmount - $settledAmount);
}

function canonical_calculate_available_entry_amount(float $entryAmount, float $settledAmount): float
{
    return max(0.0, $entryAmount - $settledAmount);
}

function canonical_assert_no_over_allocation(
    float $allocation,
    float $planAmount,
    float $planSettled,
    float $entryAmount,
    float $entrySettled
): void {
    if ($allocation <= 0) {
        throw new DomainException('Settlement allocation must be positive.');
    }
    if ($allocation > canonical_calculate_remaining_plan_amount($planAmount, $planSettled)) {
        throw new DomainException('Settlement exceeds remaining plan amount.');
    }
    if ($allocation > canonical_calculate_available_entry_amount($entryAmount, $entrySettled)) {
        throw new DomainException('Settlement exceeds available entry amount.');
    }
}

function canonical_assert_same_account_type(array $plan, array $entry, array $settlement = []): void
{
    $values = array_filter([
        canonical_record_account_type($plan),
        canonical_record_account_type($entry),
        canonical_record_account_type($settlement),
    ], static fn(?string $value): bool => $value !== null);
    if (count(array_unique($values)) > 1) {
        throw new DomainException('Resmi/Gayri Resmi settlement must never cross.');
    }
}

function canonical_assert_same_currency(array $plan, array $entry, array $settlement = []): void
{
    $values = array_filter([
        canonical_record_currency($plan),
        canonical_record_currency($entry),
        canonical_record_currency($settlement),
    ], static fn(?string $value): bool => $value !== null);
    if (count(array_unique($values)) > 1) {
        throw new DomainException('Plan, entry, and settlement currency must match.');
    }
}

function canonical_assert_same_counterparty(array $plan, array $entry, array $settlement = []): void
{
    $planKey = canonical_counterparty_key($plan);
    $entryKey = canonical_counterparty_key($entry);
    if ($planKey === null || $entryKey === null || $planKey !== $entryKey) {
        throw new DomainException('Plan and entry counterparty must match.');
    }
}

function canonical_assert_same_project(array $plan, array $entry, array $settlement = []): void
{
    if (!empty($settlement['approved_project_exception'])) {
        return;
    }
    $planProject = canonical_nullable_id($plan['project_id'] ?? null);
    $entryProject = canonical_nullable_id($entry['project_id'] ?? null);
    $planScope = $plan['allocation_scope'] ?? null;
    $entryScope = $entry['allocation_scope'] ?? null;
    if ($planProject !== $entryProject || $planScope !== $entryScope) {
        throw new DomainException('Plan and entry project scope must match.');
    }
}

function canonical_derive_plan_status_from_settlements(
    float $amount,
    float $settledAmount,
    string $dueDate,
    ?DateTimeImmutable $asOf = null,
    bool $canceled = false
): array {
    if ($canceled) {
        return ['status' => 'canceled', 'remaining_amount' => max(0.0, $amount - $settledAmount), 'is_overdue' => false];
    }

    $paid = min(max(0.0, $settledAmount), max(0.0, $amount));
    $remaining = max(0.0, $amount - $paid);
    $due = canonical_parse_date($dueDate);
    $today = ($asOf ?? new DateTimeImmutable('today'))->setTime(0, 0);
    $overdue = $remaining > 0 && $due !== null && $due < $today;

    if ($remaining <= 0) {
        $status = 'paid';
    } elseif ($paid > 0) {
        $status = 'partial';
    } elseif ($overdue) {
        $status = 'overdue';
    } else {
        $status = 'pending';
    }

    return ['status' => $status, 'remaining_amount' => $remaining, 'is_overdue' => $overdue];
}

function canonical_validate_enum_field(array &$errors, array $payload, string $field, array $allowed): void
{
    if (!array_key_exists($field, $payload) || !in_array($payload[$field], $allowed, true)) {
        $errors[] = "{$field} is required and must be canonical.";
    }
}

function canonical_validate_optional_enum_field(array &$errors, array $payload, string $field, array $allowed): void
{
    if (array_key_exists($field, $payload) && $payload[$field] !== null && !in_array($payload[$field], $allowed, true)) {
        $errors[] = "{$field} must be canonical when provided.";
    }
}

function canonical_require_positive_amount(array &$errors, array $payload, string $field): void
{
    if (!isset($payload[$field]) || !is_numeric($payload[$field]) || (float) $payload[$field] <= 0) {
        $errors[] = "{$field} must be a positive number.";
    }
}

function canonical_require_non_empty(array &$errors, array $payload, string $field): void
{
    if (trim((string) ($payload[$field] ?? '')) === '') {
        $errors[] = "{$field} is required.";
    }
}

function canonical_require_iso_date(array &$errors, array $payload, string $field): void
{
    if (canonical_parse_date($payload[$field] ?? null) === null) {
        $errors[] = "{$field} must be a valid ISO date.";
    }
}

function canonical_parse_date(mixed $value): ?DateTimeImmutable
{
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return null;
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    return $date && $date->format('Y-m-d') === $value ? $date : null;
}

function canonical_nullable_id(mixed $value): ?string
{
    $id = trim((string) ($value ?? ''));
    return $id === '' ? null : $id;
}

function canonical_record_account_type(array $record): ?string
{
    $value = $record['account_type'] ?? null;
    if ($value === null && isset($record['group_tag'])) {
        $value = $record['group_tag'] === 'Gayri Resmi' ? 'gayri_resmi' : 'resmi';
    }
    return in_array($value, CANONICAL_ACCOUNT_TYPES, true) ? $value : null;
}

function canonical_record_currency(array $record): ?string
{
    $value = $record['currency'] ?? $record['currency_tag'] ?? null;
    return in_array($value, CANONICAL_CURRENCIES, true) ? $value : null;
}

function canonical_counterparty_key(array $record): ?string
{
    $type = $record['counterparty_type'] ?? null;
    $id = canonical_nullable_id($record['counterparty_id'] ?? null);
    if ($type !== null && $id !== null) {
        return "{$type}:{$id}";
    }
    foreach (['customer_id' => 'customer', 'employee_id' => 'employee', 'expense_card_id' => 'supplier'] as $field => $legacyType) {
        $legacyId = canonical_nullable_id($record[$field] ?? null);
        if ($legacyId !== null) {
            return "{$legacyType}:{$legacyId}";
        }
    }
    return null;
}

function canonical_scalar(mixed $value): string
{
    if (is_float($value) || is_int($value) || is_numeric($value)) {
        return number_format((float) $value, 8, '.', '');
    }
    return trim((string) ($value ?? ''));
}

function canonical_settlement_sum(PDO $pdo, string $sql, string $id): float
{
    $statement = $pdo->prepare($sql);
    $statement->execute(['id' => $id]);
    return (float) $statement->fetchColumn();
}
