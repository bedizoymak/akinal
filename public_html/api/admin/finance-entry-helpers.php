<?php
declare(strict_types=1);

/**
 * Shared helpers for the four new financial entry tables.
 * Included by customer/employee/supplier/expense-card financial entry endpoints.
 */

require_once __DIR__ . '/inflation-helper.php';

const FE_CURRENCIES     = ['TRY', 'USD', 'EUR', 'XAU_GRAM'];
const FE_ACCOUNT_TYPES  = ['resmi', 'gayri_resmi'];
const FE_PAYMENT_METHODS = ['Nakit', 'Banka Havalesi/EFT', 'Kredi Kartı', 'Çek', 'Senet', 'Diğer'];
const FE_RATE_SOURCES   = ['api', 'manual', 'default'];

/**
 * Calculate auto-status based on paid_amount, amount, entry_date.
 *
 * Planlanan   — not yet paid, date in the future or today
 * Gecikmiş    — not yet paid, date in the past
 * Kısmi Ödendi — partially paid
 * Gerçekleşti  — fully paid
 * Fazla Ödendi — overpaid
 */
function fe_auto_status(float $amount, float $paid, string $entryDate): string
{
    $today = date('Y-m-d');
    if ($paid <= 0) {
        return ($entryDate < $today) ? 'Gecikmiş' : 'Planlanan';
    }
    if ($paid >= $amount && $amount > 0) {
        return ($paid > $amount) ? 'Fazla Ödendi' : 'Gerçekleşti';
    }
    return 'Kısmi Ödendi';
}

/**
 * Returns 1 if the entry is overdue (past due date, not fully paid), else 0.
 */
function fe_is_overdue(float $amount, float $paid, string $entryDate): int
{
    $today = date('Y-m-d');
    return ($entryDate < $today && $paid < $amount) ? 1 : 0;
}

/**
 * Build and validate a financial entry payload from raw request input.
 * $ownerField: e.g. 'customer_id', 'employee_id', 'supplier_id', 'expense_card_id'
 * $ownerValue: the validated UUID of the owner card.
 */
function fe_payload(array $input, string $ownerField, string $ownerValue, ?string $preserveSnapshotAt = null): array
{
    $projectId  = nullable_string($input, 'project_id');
    $title      = require_non_empty($input, 'title', 'Başlık zorunludur.');
    $entryDate  = require_iso_date($input, 'entry_date', 'Geçerli bir tarih zorunludur.');
    $amount     = max(0.0, (float) ($input['amount'] ?? 0));
    $paid       = max(0.0, (float) ($input['paid_amount'] ?? 0));
    $currency   = require_allowed_value($input, 'currency', FE_CURRENCIES, 'Geçerli bir para birimi seçilmelidir.');
    $accountType  = require_allowed_value($input, 'account_type', FE_ACCOUNT_TYPES, 'Hesap türü resmi veya gayri_resmi olmalıdır.');
    $payMethod    = require_allowed_value($input, 'payment_method', FE_PAYMENT_METHODS, 'Geçerli bir ödeme yöntemi seçilmelidir.');
    $notes        = nullable_string($input, 'notes');

    // Exchange rate handling
    $rateSource = nullable_string($input, 'exchange_rate_source') ?? 'default';
    if (!in_array($rateSource, FE_RATE_SOURCES, true)) $rateSource = 'default';

    $isManual = isset($input['is_exchange_rate_manual']) ? (int)(bool)$input['is_exchange_rate_manual'] : 0;

    // If the user manually entered the rate, ensure source reflects that regardless of what the client sent.
    if ($isManual === 1 && $rateSource === 'default') {
        $rateSource = 'manual';
    }

    if ($currency === 'TRY') {
        $rate        = 1.0;
        $rateSource  = 'default';
        $isManual    = 0;
        $snapshotAt  = null;
    } else {
        $rate = (float) ($input['exchange_rate_to_try'] ?? 1.0);
        if ($rate <= 0) $rate = 1.0;
        // On PATCH, caller may pass the existing snapshot to preserve it when rate/currency unchanged.
        $snapshotAt = $preserveSnapshotAt ?? gmdate('Y-m-d H:i:s');
    }

    $amountTry     = round($amount * $rate, 2);
    $paidAmountTry = round($paid   * $rate, 2);

    $status    = fe_auto_status($amount, $paid, $entryDate);
    $isOverdue = fe_is_overdue($amount, $paid, $entryDate);

    return [
        $ownerField              => $ownerValue,
        'project_id'             => $projectId,
        'title'                  => $title,
        'notes'                  => $notes,
        'entry_date'             => $entryDate,
        'amount'                 => $amount,
        'paid_amount'            => $paid,
        'currency'               => $currency,
        'exchange_rate_to_try'   => $rate,
        'exchange_rate_source'   => $rateSource,
        'exchange_rate_snapshot_at' => $snapshotAt,
        'is_exchange_rate_manual' => $isManual,
        'amount_try'             => $amountTry,
        'paid_amount_try'        => $paidAmountTry,
        'account_type'           => $accountType,
        'payment_method'         => $payMethod,
        'status'                 => $status,
        'is_overdue'             => $isOverdue,
    ];
}

/**
 * Enrich a raw DB row with computed fields before returning to the client.
 */
function fe_enrich(array $row): array
{
    $amount     = (float) ($row['amount']     ?? 0);
    $paid       = (float) ($row['paid_amount'] ?? 0);
    $rate       = (float) ($row['exchange_rate_to_try'] ?? 1);
    $amountTry  = (float) ($row['amount_try']     ?? 0);
    $paidTry    = (float) ($row['paid_amount_try'] ?? 0);
    $entryDate  = (string) ($row['entry_date'] ?? '');

    $row['remaining_amount']     = max(0.0, $amount - $paid);
    $row['remaining_amount_try'] = max(0.0, $amountTry - $paidTry);
    $row['status']               = fe_auto_status($amount, $paid, $entryDate);
    $row['is_overdue']           = fe_is_overdue($amount, $paid, $entryDate);
    // Cast numeric fields
    $row['amount']              = $amount;
    $row['paid_amount']         = $paid;
    $row['exchange_rate_to_try'] = $rate;
    $row['amount_try']          = $amountTry;
    $row['paid_amount_try']     = $paidTry;
    $row['is_exchange_rate_manual'] = (int) ($row['is_exchange_rate_manual'] ?? 0);

    return $row;
}

/**
 * Returns the existing exchange_rate_snapshot_at if currency and rate are unchanged, null otherwise.
 * Used by PATCH handlers so edits to title/amounts/dates don't silently refresh the FX timestamp.
 */
function fe_should_preserve_snapshot(array $input, array $existing): ?string
{
    $newCurrency = trim((string) ($input['currency'] ?? ''));
    $newRate     = (float) ($input['exchange_rate_to_try'] ?? 1.0);
    $oldCurrency = (string) ($existing['currency'] ?? '');
    $oldRate     = (float) ($existing['exchange_rate_to_try'] ?? 1.0);

    if ($newCurrency === $oldCurrency && abs($newRate - $oldRate) < 0.000001) {
        return $existing['exchange_rate_snapshot_at'] ?? null;
    }
    return null;
}

function fe_fetch_all(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll() ?: [];
    return array_map('fe_enrich', $rows);
}

function fe_fetch_one_by_id(string $table, string $id): ?array
{
    $rows = fe_fetch_all("SELECT * FROM `{$table}` WHERE id = :id LIMIT 1", ['id' => $id]);
    return $rows[0] ?? null;
}
