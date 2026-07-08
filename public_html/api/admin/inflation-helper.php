<?php
declare(strict_types=1);

/**
 * Reusable inflation adjustment helper.
 * Included by finance-entry-helpers.php which is included by all card-entry endpoints
 * and project-statement.php.
 */

function inflation_table_exists(): bool
{
    static $checked = null;
    if ($checked !== null) return $checked;
    try {
        $stmt = db()->prepare(
            'SELECT 1 FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
        );
        $stmt->execute(['t' => 'ak_inflation_indices']);
        $checked = (bool) $stmt->fetchColumn();
    } catch (Throwable $e) {
        $checked = false;
    }
    return $checked;
}

/**
 * Compounds monthly_change_percent for every month strictly after (baseYear, baseMonth)
 * through (targetYear, targetMonth) inclusive.
 *
 * Returns ['factor' => float, 'months_used' => int] on success.
 * Returns ['error' => string] when data is missing or the range is invalid.
 */
function inflation_monthly_chain_factor(
    string $indexType,
    int    $baseYear,
    int    $baseMonth,
    int    $targetYear,
    int    $targetMonth
): array {
    $baseSerial   = $baseYear * 12 + $baseMonth;
    $targetSerial = $targetYear * 12 + $targetMonth;

    if ($targetSerial <= $baseSerial) {
        return ['error' => 'Hedef dönem baz dönemden önce veya aynı dönem olamaz.'];
    }

    $expectedCount = $targetSerial - $baseSerial;

    try {
        $stmt = db()->prepare(
            'SELECT period_year, period_month, monthly_change_percent
               FROM ak_inflation_indices
              WHERE index_type = :t
                AND (period_year * 12 + period_month) > :base
                AND (period_year * 12 + period_month) <= :target
              ORDER BY period_year ASC, period_month ASC'
        );
        $stmt->execute(['t' => $indexType, 'base' => $baseSerial, 'target' => $targetSerial]);
        $rows = $stmt->fetchAll();
    } catch (Throwable $e) {
        return ['error' => 'Enflasyon verisi sorgulanamadı.'];
    }

    if (count($rows) < $expectedCount) {
        return ['error' => 'Seçilen dönem aralığı için eksik TÜFE aylık değişim verisi var.'];
    }

    foreach ($rows as $row) {
        if ($row['monthly_change_percent'] === null) {
            return ['error' => 'Seçilen dönem aralığı için eksik TÜFE aylık değişim verisi var.'];
        }
    }

    $factor = 1.0;
    foreach ($rows as $row) {
        $factor *= 1.0 + (float) $row['monthly_change_percent'] / 100.0;
    }

    return ['factor' => round($factor, 6), 'months_used' => count($rows)];
}

/**
 * Computes the inflation-adjusted value of $amountTry between two date periods
 * using a monthly-chain compound calculation.
 * Returns null when data is missing, the table does not exist, or inputs are invalid.
 */
function calculate_inflation_adjustment(
    float  $amountTry,
    string $baseDate,
    string $targetDate,
    string $indexType = 'TUFE'
): ?array {
    if (!inflation_table_exists() || $amountTry <= 0) return null;
    if ($baseDate === '' || $targetDate === '') return null;

    $baseParts   = explode('-', substr($baseDate,   0, 10));
    $targetParts = explode('-', substr($targetDate, 0, 10));
    if (count($baseParts) < 2 || count($targetParts) < 2) return null;

    $baseYear    = (int) $baseParts[0];
    $baseMonth   = (int) $baseParts[1];
    $targetYear  = (int) $targetParts[0];
    $targetMonth = (int) $targetParts[1];

    if ($baseYear < 2000 || $targetYear < 2000) return null;

    // Same period — no adjustment needed
    if ($baseYear === $targetYear && $baseMonth === $targetMonth) {
        return [
            'inflation_adjusted_amount_try' => $amountTry,
            'inflation_difference'          => 0.0,
            'inflation_ratio'               => 1.0,
            'inflation_base_period'         => sprintf('%04d-%02d', $baseYear, $baseMonth),
            'inflation_target_period'       => sprintf('%04d-%02d', $targetYear, $targetMonth),
        ];
    }

    $chain = inflation_monthly_chain_factor($indexType, $baseYear, $baseMonth, $targetYear, $targetMonth);
    if (isset($chain['error'])) return null;

    $factor     = (float) $chain['factor'];
    $adjusted   = round($amountTry * $factor, 2);
    $difference = round($adjusted - $amountTry, 2);

    return [
        'inflation_adjusted_amount_try' => $adjusted,
        'inflation_difference'          => $difference,
        'inflation_ratio'               => $factor,
        'inflation_base_period'         => sprintf('%04d-%02d', $baseYear, $baseMonth),
        'inflation_target_period'       => sprintf('%04d-%02d', $targetYear, $targetMonth),
    ];
}

/**
 * Returns the best available index_type.
 * Prefers TCMB_YEARLY_BASE_100 when the table has been synced; falls back to TUFE.
 * Result is cached per request via static.
 */
function preferred_inflation_index_type(): string
{
    static $result = null;
    if ($result !== null) return $result;
    try {
        if (!inflation_table_exists()) {
            $result = 'TUFE';
            return $result;
        }
        $stmt = db()->prepare(
            'SELECT 1 FROM ak_inflation_indices WHERE index_type = :t LIMIT 1'
        );
        $stmt->execute(['t' => 'TCMB_YEARLY_BASE_100']);
        $result = ($stmt->fetchColumn() !== false) ? 'TCMB_YEARLY_BASE_100' : 'TUFE';
    } catch (Throwable $e) {
        $result = 'TUFE';
    }
    return $result;
}

/**
 * Returns a null-filled inflation struct — used to ensure all rows have consistent keys.
 */
function inflation_null_fields(): array
{
    return [
        'inflation_adjusted_amount_try' => null,
        'inflation_difference'          => null,
        'inflation_ratio'               => null,
        'inflation_base_period'         => null,
        'inflation_target_period'       => null,
    ];
}
