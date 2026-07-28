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

    $factor     = 1.0;
    $monthsList = [];
    foreach ($rows as $row) {
        $factor     *= 1.0 + (float) $row['monthly_change_percent'] / 100.0;
        $monthsList[] = sprintf('%04d-%02d', (int) $row['period_year'], (int) $row['period_month']);
    }

    return ['factor' => round($factor, 6), 'months_used' => $monthsList];
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
 * Returns the latest period (year + month) that has a non-null monthly_change_percent
 * for the given index_type. Returns null when the table is empty or missing.
 */
function latest_tcmb_period(string $indexType = 'TCMB_YEARLY_BASE_100'): ?array
{
    if (!inflation_table_exists()) return null;
    try {
        $stmt = db()->prepare(
            'SELECT period_year, period_month
               FROM ak_inflation_indices
              WHERE index_type = :t
                AND monthly_change_percent IS NOT NULL
              ORDER BY (period_year * 12 + period_month) DESC
              LIMIT 1'
        );
        $stmt->execute(['t' => $indexType]);
        $row = $stmt->fetch();
        if (!$row) return null;
        return ['year' => (int) $row['period_year'], 'month' => (int) $row['period_month']];
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * Returns the forecast monthly inflation rate for a given calendar month.
 * Uses the arithmetic average of the same calendar month from the last $lookback
 * DISTINCT years before $beforeYear. Deduplicates by period_year to avoid
 * distortion from duplicate rows in ak_inflation_indices.
 * Returns 0.0 if no historical data exists.
 */
function forecast_monthly_for_period(
    string $indexType,
    int    $month,
    int    $beforeYear,
    int    $lookback = 5
): float {
    try {
        $stmt = db()->prepare(
            "SELECT monthly_change_percent
               FROM (
                   SELECT period_year, period_month, MAX(monthly_change_percent) AS monthly_change_percent
                     FROM ak_inflation_indices
                    WHERE index_type  = :t
                      AND period_month = :m
                      AND period_year  < :y
                      AND monthly_change_percent IS NOT NULL
                    GROUP BY period_year, period_month
                    ORDER BY period_year DESC
                    LIMIT {$lookback}
               ) x"
        );
        $stmt->execute(['t' => $indexType, 'm' => $month, 'y' => $beforeYear]);
        $rows = $stmt->fetchAll();
    } catch (Throwable $e) {
        return 0.0;
    }
    if (empty($rows)) return 0.0;
    $sum = array_sum(array_column($rows, 'monthly_change_percent'));
    return round((float) $sum / count($rows), 6);
}

/**
 * Extends inflation_monthly_chain_factor() with forecast support.
 * For months in the range that have no official TCMB row, a same-month-last-5-years
 * average is used as an estimate. Official rows always win over forecast.
 *
 * Returns on success:
 *   [
 *     'factor'          => float,
 *     'official_factor' => float,
 *     'forecast_factor' => float,
 *     'months_used'     => string[],
 *     'official_months' => string[],
 *     'forecast_months' => string[],
 *   ]
 * Returns ['error' => string] when the range is invalid or data cannot be queried.
 */
function inflation_monthly_chain_with_forecast(
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

    // Fetch all available official rows in the range
    try {
        $stmt = db()->prepare(
            'SELECT period_year, period_month, monthly_change_percent
               FROM ak_inflation_indices
              WHERE index_type = :t
                AND (period_year * 12 + period_month) > :base
                AND (period_year * 12 + period_month) <= :target
                AND monthly_change_percent IS NOT NULL
              ORDER BY period_year ASC, period_month ASC'
        );
        $stmt->execute(['t' => $indexType, 'base' => $baseSerial, 'target' => $targetSerial]);
        $officialRows = $stmt->fetchAll();
    } catch (Throwable $e) {
        return ['error' => 'Enflasyon verisi sorgulanamadı.'];
    }

    // Index official rows by serial for O(1) lookup
    $officialMap = [];
    foreach ($officialRows as $row) {
        $serial = (int) $row['period_year'] * 12 + (int) $row['period_month'];
        $officialMap[$serial] = (float) $row['monthly_change_percent'];
    }

    $officialFactor = 1.0;
    $forecastFactor = 1.0;
    $allMonths      = [];
    $officialMonths = [];
    $forecastMonths = [];

    for ($s = $baseSerial + 1; $s <= $targetSerial; $s++) {
        $m = $s % 12;
        if ($m === 0) $m = 12;
        $y      = intdiv($s - $m, 12);
        $period = sprintf('%04d-%02d', $y, $m);
        $allMonths[] = $period;

        if (isset($officialMap[$s])) {
            $officialFactor *= 1.0 + $officialMap[$s] / 100.0;
            $officialMonths[] = $period;
        } else {
            $rate = forecast_monthly_for_period($indexType, $m, $y);
            $forecastFactor *= 1.0 + $rate / 100.0;
            $forecastMonths[] = $period;
        }
    }

    return [
        'factor'          => round($officialFactor * $forecastFactor, 6),
        'official_factor' => round($officialFactor, 6),
        'forecast_factor' => round($forecastFactor, 6),
        'months_used'     => $allMonths,
        'official_months' => $officialMonths,
        'forecast_months' => $forecastMonths,
    ];
}

/**
 * Builds the full inflation_preview object for a customer financial entry.
 * target_date: the receivable due date (entry_date). Months beyond the latest
 * official TCMB period are filled with same-month-last-5-years forecast.
 * base_date: YYYY-MM-DD string (inflation_start_date or entry_date).
 */
function cfe_inflation_preview(
    float  $amountTry,
    string $baseDate,
    string $targetDate,
    string $indexType
): array {
    $disabled = ['enabled' => false];

    if (!inflation_table_exists() || $amountTry <= 0 || $baseDate === '') return $disabled;

    $baseParts = explode('-', substr($baseDate, 0, 10));
    if (count($baseParts) < 2) return $disabled;
    $baseYear  = (int) $baseParts[0];
    $baseMonth = (int) $baseParts[1];
    if ($baseYear < 2000 || $baseMonth < 1 || $baseMonth > 12) return $disabled;

    // Determine target: use the provided due date, falling back to latest TCMB period
    $targetYear  = 0;
    $targetMonth = 0;
    if ($targetDate !== '') {
        $tParts = explode('-', substr($targetDate, 0, 10));
        if (count($tParts) >= 2) {
            $targetYear  = (int) $tParts[0];
            $targetMonth = (int) $tParts[1];
        }
    }
    if ($targetYear < 2000 || $targetMonth < 1 || $targetMonth > 12) {
        $latest = latest_tcmb_period($indexType);
        if ($latest === null && $indexType !== 'TUFE') {
            $indexType = 'TUFE';
            $latest    = latest_tcmb_period($indexType);
        }
        if ($latest === null) return $disabled;
        $targetYear  = $latest['year'];
        $targetMonth = $latest['month'];
    }

    $basePeriod   = sprintf('%04d-%02d', $baseYear, $baseMonth);
    $targetPeriod = sprintf('%04d-%02d', $targetYear, $targetMonth);
    $baseSerial   = $baseYear * 12 + $baseMonth;
    $targetSerial = $targetYear * 12 + $targetMonth;

    if ($targetSerial <= $baseSerial) {
        return [
            'enabled'                        => true,
            'base_period'                    => $basePeriod,
            'target_period'                  => $targetPeriod,
            'months_used'                    => [],
            'official_months_count'          => 0,
            'forecast_months_count'          => 0,
            'official_compound_rate_percent' => 0.0,
            'forecast_compound_rate_percent' => 0.0,
            'total_compound_rate_percent'    => 0.0,
            'factor'                         => 1.0,
            'rate_percent'                   => 0.0,
            'principal_amount'               => $amountTry,
            'adjusted_amount'                => $amountTry,
            'current_collectible_amount'     => $amountTry,
            'inflation_difference'           => 0.0,
            'used_forecast'                  => false,
            'forecast_method'                => null,
            'forecast_note'                  => null,
            'warning'                        => 'Baz dönem hedef dönemden sonra veya aynı dönem.',
        ];
    }

    $chain = inflation_monthly_chain_with_forecast(
        $indexType, $baseYear, $baseMonth, $targetYear, $targetMonth
    );

    if (isset($chain['error'])) {
        return [
            'enabled'                        => true,
            'base_period'                    => $basePeriod,
            'target_period'                  => $targetPeriod,
            'months_used'                    => [],
            'official_months_count'          => 0,
            'forecast_months_count'          => 0,
            'official_compound_rate_percent' => 0.0,
            'forecast_compound_rate_percent' => 0.0,
            'total_compound_rate_percent'    => 0.0,
            'factor'                         => 1.0,
            'rate_percent'                   => 0.0,
            'principal_amount'               => $amountTry,
            'adjusted_amount'                => $amountTry,
            'current_collectible_amount'     => $amountTry,
            'inflation_difference'           => 0.0,
            'used_forecast'                  => false,
            'forecast_method'                => null,
            'forecast_note'                  => null,
            'warning'                        => $chain['error'],
        ];
    }

    $factor         = (float) $chain['factor'];
    $officialFactor = (float) $chain['official_factor'];
    $forecastFactor = (float) $chain['forecast_factor'];
    $forecastMonths = $chain['forecast_months'];
    $usedForecast   = count($forecastMonths) > 0;

    $adjusted    = round($amountTry * $factor, 2);
    $difference  = round($adjusted - $amountTry, 2);
    $totalRate   = round(($factor - 1.0) * 100.0, 4);
    $officialRate = round(($officialFactor - 1.0) * 100.0, 4);
    $forecastRate = round(($forecastFactor - 1.0) * 100.0, 4);

    return [
        'enabled'                        => true,
        'base_period'                    => $basePeriod,
        'target_period'                  => $targetPeriod,
        'months_used'                    => $chain['months_used'],
        'official_months_count'          => count($chain['official_months']),
        'forecast_months_count'          => count($forecastMonths),
        'official_compound_rate_percent' => $officialRate,
        'forecast_compound_rate_percent' => $forecastRate,
        'total_compound_rate_percent'    => $totalRate,
        'factor'                         => $factor,
        'rate_percent'                   => $totalRate,
        'principal_amount'               => $amountTry,
        'adjusted_amount'                => $adjusted,
        'current_collectible_amount'     => $adjusted,
        'inflation_difference'           => $difference,
        'used_forecast'                  => $usedForecast,
        'forecast_method'                => $usedForecast ? 'Son 5 yıl aynı ay ortalaması' : null,
        'forecast_note'                  => $usedForecast
            ? 'Bu hesapta ileri tarihli dönemler için tahmini TÜFE kullanılmıştır. Tahmini değerler bilgi amaçlıdır; resmi TCMB verileri açıklandığında bu tutarlar otomatik olarak güncellenecektir.'
            : null,
        'warning'                        => null,
    ];
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
