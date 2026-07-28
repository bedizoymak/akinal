<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/inflation-helper.php';

/*
 * ─── Cron endpoint ───────────────────────────────────────────────────────────
 * No browser session required for cron calls (?cron=1).
 * Recommended cPanel cron entries:
 *
 * Monthly main cron — runs on day 1 of each month at 06:00 server time:
 *   0 6 1 * * curl -fsS "https://akinalinsaat.com/api/admin/inflation-indices.php?cron=1"
 *
 * Retry cron — runs days 1-7 at 06:00; backend skips if outside first 5 business days:
 *   0 6 1-7 * * curl -fsS "https://akinalinsaat.com/api/admin/inflation-indices.php?cron=1&retry=1"
 *
 * Only writes ak_inflation_indices. No customer/payment/finance tables are touched.
 */
if (($_GET['cron'] ?? '') === '1') {
    handle_cron_request();
    // handle_cron_request() always calls json_success/json_error which call exit
}

require_admin();

const SEED_ROWS = [
    ['year' => 2026, 'month' => 1,  'value' => '3683.8300', 'monthly' => '4.8400',  'annual' => '30.6500'],
    ['year' => 2026, 'month' => 2,  'value' => '3793.0500', 'monthly' => '2.9600',  'annual' => '31.5300'],
    ['year' => 2026, 'month' => 3,  'value' => '3866.7400', 'monthly' => '1.9400',  'annual' => '30.8700'],
    ['year' => 2026, 'month' => 4,  'value' => '4028.4700', 'monthly' => '4.1800',  'annual' => '32.3700'],
    ['year' => 2026, 'month' => 5,  'value' => '4097.5500', 'monthly' => '1.7100',  'annual' => '32.6100'],
    ['year' => 2026, 'month' => 6,  'value' => '4137.9300', 'monthly' => '0.9900',  'annual' => '32.1100'],
];

const TCMB_TUFE_URL = 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Enflasyon+Verileri/Tuketici+Fiyatlari';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        // Auto-sync TCMB chain data on page load when missing or stale.
        // Returns existing data plus a sync_warning if the attempt fails.
        $syncWarning       = null;
        $lastSyncedPeriod  = null;
        $activeIndexType   = 'TUFE';

        try {
            $latestTcmb = tcmb_latest_period_in_db();
            $needsSync  = tcmb_needs_sync($latestTcmb);

            if ($needsSync) {
                try {
                    $syncResult      = run_tcmb_sync(autoMode: true);
                    $lastSyncedPeriod = $syncResult['latest_period'];
                    $activeIndexType  = 'TCMB_YEARLY_BASE_100';
                } catch (Throwable $syncErr) {
                    // Sync failed — use existing DB data and surface a warning
                    $syncWarning = 'TCMB senkronizasyonu başarısız: ' . $syncErr->getMessage()
                        . ' — Mevcut endeks verileri gösteriliyor.';
                }
            } else {
                // Already up-to-date — just report the period
                if ($latestTcmb !== null) {
                    $lastSyncedPeriod = sprintf('%04d-%02d', $latestTcmb['year'], $latestTcmb['month']);
                }
            }

            // Determine active index type from DB (TCMB preferred if rows exist)
            $chk = db()->prepare('SELECT 1 FROM ak_inflation_indices WHERE index_type = :t LIMIT 1');
            $chk->execute(['t' => 'TCMB_YEARLY_BASE_100']);
            if ($chk->fetchColumn() !== false) {
                $activeIndexType = 'TCMB_YEARLY_BASE_100';
            }
        } catch (Throwable $autoErr) {
            $syncWarning = 'Endeks durumu kontrol edilemedi: ' . $autoErr->getMessage();
        }

        // Fetch the active index data (newest first)
        $sql = 'SELECT id, index_type, period_year, period_month,
                       index_value, monthly_change_percent, annual_change_percent,
                       source, created_at
                FROM ak_inflation_indices
                WHERE index_type = :index_type
                ORDER BY period_year DESC, period_month DESC';

        $stmt = db()->prepare($sql);
        $stmt->execute(['index_type' => $activeIndexType]);
        $rows = $stmt->fetchAll() ?: [];

        // Fallback: if active type returned nothing, try TUFE
        if (empty($rows) && $activeIndexType !== 'TUFE') {
            $stmt->execute(['index_type' => 'TUFE']);
            $rows            = $stmt->fetchAll() ?: [];
            $activeIndexType = 'TUFE';
            if (!empty($rows)) {
                $syncWarning = ($syncWarning ? $syncWarning . ' ' : '')
                    . 'TCMB verisi bulunamadı; TÜFE verisi gösteriliyor.';
            }
        }

        foreach ($rows as &$row) {
            $row['period_year']            = (int)   $row['period_year'];
            $row['period_month']           = (int)   $row['period_month'];
            $row['index_value']            = $row['index_value']            !== null ? (float) $row['index_value']            : null;
            $row['monthly_change_percent'] = $row['monthly_change_percent'] !== null ? (float) $row['monthly_change_percent'] : null;
            $row['annual_change_percent']  = $row['annual_change_percent']  !== null ? (float) $row['annual_change_percent']  : null;
        }
        unset($row);

        if (empty($rows) && $syncWarning === null) {
            $syncWarning = 'Henüz endeks verisi yok. TCMB sayfası JavaScript ile yükleniyorsa otomatik senkronizasyon çalışmaz.';
        }

        json_success([
            'indices'           => $rows,
            'sync_warning'      => $syncWarning,
            'last_synced_period' => $lastSyncedPeriod,
            'active_index_type' => $activeIndexType,
        ]);
    }

    if ($method === 'POST') {
        $input  = read_admin_json_body();
        $action = nullable_string($input, 'action') ?? 'calculate';

        if ($action === 'seed')        handle_seed();
        if ($action === 'calculate')   handle_calculate($input);
        if ($action === 'import_csv')  handle_import_csv($input);
        if ($action === 'sync_tcmb')   handle_sync_tcmb();

        json_error('Geçersiz işlem: ' . htmlspecialchars($action, ENT_QUOTES, 'UTF-8'), 400);
    }

    header('Allow: GET, POST');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Enflasyon endeksi işlemi tamamlanamadı: ' . $exception->getMessage(), 500);
}

// ── Calculate ─────────────────────────────────────────────────────────────────

/**
 * Compound monthly inflation calculator.
 *
 * For every month strictly after (base_year, base_month) through (target_year, target_month):
 *   factor *= (1 + monthly_change_percent / 100)
 *
 * 12-month self-check: base=2025-06 → target=2026-06 → factor≈1.3211 → rate≈32.11%
 * which matches TCMB official annual_change_percent for 2026-06 (32.11%).
 */
function handle_calculate(array $input): never
{
    $amountTry   = (float) ($input['amount_try'] ?? 0);
    $baseYear    = isset($input['base_year'])    ? (int) $input['base_year']    : 0;
    $baseMonth   = isset($input['base_month'])   ? (int) $input['base_month']   : 0;
    $targetYear  = isset($input['target_year'])  ? (int) $input['target_year']  : 0;
    $targetMonth = isset($input['target_month']) ? (int) $input['target_month'] : 0;
    $indexType   = nullable_string($input, 'index_type') ?? 'TCMB_YEARLY_BASE_100';

    if ($amountTry <= 0)                          json_error('Tutar 0\'dan büyük olmalıdır.', 422);
    if ($baseMonth  < 1 || $baseMonth  > 12)      json_error('Baz ay 1-12 arasında olmalıdır.', 422);
    if ($targetMonth < 1 || $targetMonth > 12)    json_error('Hedef ay 1-12 arasında olmalıdır.', 422);
    if ($baseYear   < 2000 || $baseYear   > 2100) json_error('Geçersiz baz yıl.', 422);
    if ($targetYear < 2000 || $targetYear > 2100) json_error('Geçersiz hedef yıl.', 422);

    $baseSerial   = $baseYear * 12 + $baseMonth;
    $targetSerial = $targetYear * 12 + $targetMonth;

    if ($targetSerial <= $baseSerial) {
        json_error('Hedef dönem baz dönemden sonra olmalıdır.', 422);
    }

    $chain = inflation_monthly_chain_with_forecast($indexType, $baseYear, $baseMonth, $targetYear, $targetMonth);
    if (isset($chain['error'])) {
        json_error($chain['error'], 422);
    }

    $factor      = (float) $chain['factor'];
    $ratePercent = round(($factor - 1.0) * 100.0, 4);
    $adjusted    = round($amountTry * $factor, 2);
    $difference  = round($adjusted - $amountTry, 2);

    $officialFactor = (float) ($chain['official_factor'] ?? $factor);
    $forecastFactor = (float) ($chain['forecast_factor'] ?? 1.0);
    $usedForecast   = (bool)  (count($chain['forecast_months'] ?? []) > 0);

    json_success([
        'amount_try'                     => $amountTry,
        'factor'                         => $factor,
        'rate_percent'                   => $ratePercent,
        'adjusted_amount'                => $adjusted,
        'difference'                     => $difference,
        'months_used'                    => $chain['months_used'] ?? [],
        'base_period'                    => sprintf('%04d-%02d', $baseYear, $baseMonth),
        'target_period'                  => sprintf('%04d-%02d', $targetYear, $targetMonth),
        'used_forecast'                  => $usedForecast,
        'official_months_count'          => count($chain['official_months'] ?? []),
        'forecast_months_count'          => count($chain['forecast_months'] ?? []),
        'official_compound_rate_percent' => round(($officialFactor - 1.0) * 100.0, 4),
        'forecast_compound_rate_percent' => round(($forecastFactor - 1.0) * 100.0, 4),
        'total_compound_rate_percent'    => $ratePercent,
        'forecast_method'                => $usedForecast ? 'Son 5 yılın aynı ay ortalaması' : null,
    ]);
}

// ── Seed (2026 TUFE) ──────────────────────────────────────────────────────────

function handle_seed(): never
{
    $stmt = db()->prepare(
        'INSERT INTO ak_inflation_indices
            (id, index_type, period_year, period_month, index_value, monthly_change_percent, annual_change_percent, source)
         VALUES
            (:id, :index_type, :period_year, :period_month, :index_value, :monthly_change_percent, :annual_change_percent, :source)
         ON DUPLICATE KEY UPDATE
            index_value            = VALUES(index_value),
            monthly_change_percent = VALUES(monthly_change_percent),
            annual_change_percent  = VALUES(annual_change_percent),
            source                 = VALUES(source)'
    );
    $count = 0;
    foreach (SEED_ROWS as $row) {
        $stmt->execute([
            'id'                     => uuid_v4(),
            'index_type'             => 'TUFE',
            'period_year'            => $row['year'],
            'period_month'           => $row['month'],
            'index_value'            => $row['value'],
            'monthly_change_percent' => $row['monthly'],
            'annual_change_percent'  => $row['annual'],
            'source'                 => 'TUIK',
        ]);
        $count++;
    }
    json_success(['seeded' => $count, 'index_type' => 'TUFE']);
}

// ── CSV import ────────────────────────────────────────────────────────────────

/**
 * Accepts CSV in the request body: action=import_csv, csv_data=...
 * Columns: period_year, period_month, index_value[, monthly_change_percent, annual_change_percent, source]
 * Uses ON DUPLICATE KEY UPDATE so re-import is safe.
 */
function handle_import_csv(array $input): never
{
    $rawCsv = trim((string) ($input['csv_data'] ?? ''));
    if ($rawCsv === '') json_error('csv_data alanı boş olamaz.', 422);

    $rawCsv = str_replace(["\r\n", "\r"], "\n", $rawCsv);
    $lines  = array_filter(array_map('trim', explode("\n", $rawCsv)));

    if (empty($lines)) json_error('CSV içinde geçerli satır bulunamadı.', 422);

    // Skip header row if first column is non-numeric
    $firstParts = str_getcsv(reset($lines));
    if (!is_numeric(trim($firstParts[0] ?? ''))) {
        array_shift($lines);
    }
    if (empty($lines)) json_error('Başlık satırından sonra veri satırı bulunamadı.', 422);

    $stmt = db()->prepare(
        'INSERT INTO ak_inflation_indices
            (id, index_type, period_year, period_month, index_value, monthly_change_percent, annual_change_percent, source)
         VALUES
            (:id, :index_type, :period_year, :period_month, :index_value, :monthly_change_percent, :annual_change_percent, :source)
         ON DUPLICATE KEY UPDATE
            index_value            = VALUES(index_value),
            monthly_change_percent = VALUES(monthly_change_percent),
            annual_change_percent  = VALUES(annual_change_percent),
            source                 = VALUES(source)'
    );

    $imported  = 0;
    $rowErrors = [];
    $lineNum   = 1;

    foreach ($lines as $line) {
        $lineNum++;
        $parts = str_getcsv($line);
        if (count($parts) < 3) {
            $rowErrors[] = "Satır {$lineNum}: En az 3 sütun gerekli, " . count($parts) . " bulundu.";
            continue;
        }

        $year   = (int)   trim($parts[0]);
        $month  = (int)   trim($parts[1]);
        $rawVal =         trim($parts[2]);
        $monthly = isset($parts[3]) && trim($parts[3]) !== '' ? trim($parts[3]) : null;
        $annual  = isset($parts[4]) && trim($parts[4]) !== '' ? trim($parts[4]) : null;
        $source  = isset($parts[5]) && trim($parts[5]) !== '' ? trim($parts[5]) : 'TUIK';

        if ($year < 2000 || $year > 2100) {
            $rowErrors[] = "Satır {$lineNum}: Geçersiz yıl ({$year}).";
            continue;
        }
        if ($month < 1 || $month > 12) {
            $rowErrors[] = "Satır {$lineNum}: Geçersiz ay ({$month}).";
            continue;
        }
        if (!is_numeric($rawVal) || (float) $rawVal <= 0) {
            $rowErrors[] = "Satır {$lineNum}: Geçersiz endeks değeri ({$rawVal}).";
            continue;
        }

        $stmt->execute([
            'id'                     => uuid_v4(),
            'index_type'             => 'TUFE',
            'period_year'            => $year,
            'period_month'           => $month,
            'index_value'            => (float) $rawVal,
            'monthly_change_percent' => $monthly !== null ? (float) $monthly : null,
            'annual_change_percent'  => $annual  !== null ? (float) $annual  : null,
            'source'                 => $source,
        ]);
        $imported++;
    }

    json_success(['imported' => $imported, 'skipped' => count($rowErrors), 'errors' => $rowErrors]);
}

// ── TCMB sync ─────────────────────────────────────────────────────────────────

// ── TCMB sync helpers ─────────────────────────────────────────────────────────

/**
 * Returns ['year' => int, 'month' => int] for the newest TCMB_YEARLY_BASE_100
 * row in the DB, or null if none exist.
 */
function tcmb_latest_period_in_db(): ?array
{
    try {
        $stmt = db()->prepare(
            'SELECT period_year, period_month FROM ak_inflation_indices
              WHERE index_type = :t
              ORDER BY period_year DESC, period_month DESC LIMIT 1'
        );
        $stmt->execute(['t' => 'TCMB_YEARLY_BASE_100']);
        $row = $stmt->fetch();
        if (!$row) return null;
        return ['year' => (int) $row['period_year'], 'month' => (int) $row['period_month']];
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * Returns true if a sync is needed.
 * Syncs when: no TCMB data exists, OR the latest stored period is before last month.
 */
function tcmb_needs_sync(?array $latestPeriod): bool
{
    if ($latestPeriod === null) return true;

    $now       = new DateTimeImmutable('now', new DateTimeZone('Europe/Istanbul'));
    $prevMonth = $now->modify('first day of last month');
    $storedSerial  = $latestPeriod['year'] * 12 + $latestPeriod['month'];
    $requiredSerial = (int) $prevMonth->format('Y') * 12 + (int) $prevMonth->format('n');

    return $storedSerial < $requiredSerial;
}

/**
 * Core sync logic — fetches TCMB page, parses, builds chain index, upserts.
 * Throws RuntimeException on failure so callers can decide how to surface the error.
 * $autoMode = true uses a shorter HTTP timeout to avoid blocking page loads.
 *
 * @return array{total_rows_found: int, inserted_or_updated: int, latest_period: string|null,
 *               latest_monthly_change_percent: float|null, latest_annual_change_percent: float|null}
 */
function run_tcmb_sync(bool $autoMode = false): array
{
    $timeout = $autoMode ? 5 : 20;
    $html    = tcmb_fetch_html(TCMB_TUFE_URL, $timeout);
    $rows    = parse_tcmb_html($html);

    if (empty($rows)) {
        throw new RuntimeException(
            'TCMB sayfasından TÜFE satırı ayrıştırılamadı. '
            . 'Sayfa JavaScript ile yükleniyorsa otomatik senkronizasyon çalışmaz.'
        );
    }

    // Sort oldest first so the yearly-base index_value can be computed in order.
    usort($rows, static fn($a, $b) =>
        ($a['year'] * 12 + $a['month']) <=> ($b['year'] * 12 + $b['month'])
    );

    // Compute index_value as a yearly-base chain (Jan=100 each year) for backward
    // compatibility with customer receivables and finance integrations that may read it.
    // The calculator itself does NOT use index_value — it compounds monthly_change_percent.
    $currentYear = null;
    $indexValue  = 100.0;

    $stmt = db()->prepare(
        'INSERT INTO ak_inflation_indices
            (id, index_type, period_year, period_month,
             index_value, monthly_change_percent, annual_change_percent, source)
         VALUES
            (:id, :index_type, :period_year, :period_month,
             :index_value, :monthly_change_percent, :annual_change_percent, :source)
         ON DUPLICATE KEY UPDATE
            index_value            = VALUES(index_value),
            monthly_change_percent = VALUES(monthly_change_percent),
            annual_change_percent  = VALUES(annual_change_percent),
            source                 = VALUES(source)'
    );

    $count = 0;
    $last  = null;

    foreach ($rows as $row) {
        if ($row['year'] !== $currentYear) {
            $currentYear = $row['year'];
            $indexValue  = 100.0;
        } else {
            $indexValue = round($indexValue * (1.0 + $row['monthly'] / 100.0), 6);
        }

        $stmt->execute([
            'id'                     => uuid_v4(),
            'index_type'             => 'TCMB_YEARLY_BASE_100',
            'period_year'            => $row['year'],
            'period_month'           => $row['month'],
            'index_value'            => $indexValue,
            'monthly_change_percent' => $row['monthly'],
            'annual_change_percent'  => $row['annual'],
            'source'                 => 'TCMB',
        ]);
        $count++;
        $last = $row;
    }

    // Idempotent migrations: drop obsolete derived columns from prior deploys.
    // index_value is intentionally kept.
    foreach (['legal_rent_increase_percent', 'twelve_month_average_percent'] as $col) {
        try {
            db()->exec("ALTER TABLE ak_inflation_indices DROP COLUMN {$col}");
        } catch (PDOException $e) {
            // 1091 = unknown column (already dropped) — harmless
        }
    }

    return [
        'total_rows_found'              => count($rows),
        'inserted_or_updated'           => $count,
        'latest_period'                 => $last !== null
            ? sprintf('%04d-%02d', $last['year'], $last['month'])
            : null,
        'latest_monthly_change_percent' => $last['monthly'] ?? null,
        'latest_annual_change_percent'  => $last['annual']  ?? null,
    ];
}

// ── Cron handler ─────────────────────────────────────────────────────────────

function handle_cron_request(): never
{
    $isRetry = (($_GET['retry'] ?? '') === '1');

    // retry=1: only proceed on first 5 business days of the month
    if ($isRetry && !is_within_first_n_business_days(5)) {
        json_success([
            'status'        => 'skipped',
            'latest_period' => tcmb_latest_period_label(),
            'indices_count' => tcmb_total_indices_count(),
            'sync_warning'  => null,
        ]);
    }

    // If previous month data already exists, nothing to do
    if (tcmb_previous_month_exists()) {
        json_success([
            'status'        => 'up_to_date',
            'latest_period' => tcmb_latest_period_label(),
            'indices_count' => tcmb_total_indices_count(),
            'sync_warning'  => null,
        ]);
    }

    // Attempt sync
    $syncWarning = null;
    $status      = 'warning';
    try {
        $result = run_tcmb_sync(autoMode: true);
        $status = $result['inserted_or_updated'] > 0 ? 'updated' : 'up_to_date';
    } catch (Throwable $e) {
        $syncWarning = $e->getMessage();
    }

    json_success([
        'status'        => $status,
        'latest_period' => tcmb_latest_period_label(),
        'indices_count' => tcmb_total_indices_count(),
        'sync_warning'  => $syncWarning,
    ]);
}

function tcmb_previous_month_exists(): bool
{
    try {
        $tz        = new DateTimeZone('Europe/Istanbul');
        $prevMonth = new DateTimeImmutable('first day of last month', $tz);
        $year      = (int) $prevMonth->format('Y');
        $month     = (int) $prevMonth->format('n');
        $stmt = db()->prepare(
            'SELECT 1 FROM ak_inflation_indices
              WHERE index_type = :t AND period_year = :y AND period_month = :m LIMIT 1'
        );
        $stmt->execute(['t' => 'TCMB_YEARLY_BASE_100', 'y' => $year, 'm' => $month]);
        return $stmt->fetchColumn() !== false;
    } catch (Throwable $e) {
        return false;
    }
}

function tcmb_total_indices_count(): int
{
    try {
        $stmt = db()->prepare('SELECT COUNT(*) FROM ak_inflation_indices WHERE index_type = :t');
        $stmt->execute(['t' => 'TCMB_YEARLY_BASE_100']);
        return (int) $stmt->fetchColumn();
    } catch (Throwable $e) {
        return 0;
    }
}

function tcmb_latest_period_label(): ?string
{
    $latest = tcmb_latest_period_in_db();
    return $latest !== null ? sprintf('%04d-%02d', $latest['year'], $latest['month']) : null;
}

/**
 * Returns true if today falls within the first $n business days (Mon–Fri)
 * of the current month, using Istanbul time.
 */
function is_within_first_n_business_days(int $n = 5): bool
{
    $tz       = new DateTimeZone('Europe/Istanbul');
    $now      = new DateTimeImmutable('now', $tz);
    $today    = (int) $now->format('j');
    $yearMonth = $now->format('Y-m');

    $businessCount = 0;
    for ($d = 1; $d <= $today; $d++) {
        $date = new DateTimeImmutable("{$yearMonth}-{$d}", $tz);
        $dow  = (int) $date->format('N'); // 1=Mon … 7=Sun
        if ($dow <= 5) {
            $businessCount++;
        }
    }
    return $businessCount <= $n;
}

function handle_sync_tcmb(): never
{
    try {
        $result = run_tcmb_sync(autoMode: false);
        json_success($result);
    } catch (RuntimeException $e) {
        json_error($e->getMessage(), 502);
    }
}

function tcmb_fetch_html(string $url, int $timeout = 20): string
{
    $connectTimeout = min($timeout, 5);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 5,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => $connectTimeout,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            CURLOPT_HTTPHEADER     => [
                'Accept-Language: tr-TR,tr;q=0.9,en;q=0.8',
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            ],
            CURLOPT_SSL_VERIFYPEER => false, // shared hosting may lack an up-to-date CA bundle
            CURLOPT_ENCODING       => 'gzip, deflate',
        ]);
        $html     = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($html === false || $curlErr !== '') {
            throw new RuntimeException('cURL hatası: ' . $curlErr);
        }
        if ($httpCode < 200 || $httpCode >= 300) {
            throw new RuntimeException("HTTP {$httpCode} yanıtı alındı.");
        }
        return (string) $html;
    }

    // Fallback: file_get_contents
    $context = stream_context_create([
        'http' => [
            'timeout'    => $timeout,
            'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'header'     => "Accept-Language: tr-TR,tr;q=0.9\r\nAccept: text/html\r\n",
        ],
        'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    $result = @file_get_contents($url, false, $context);
    if ($result === false) {
        throw new RuntimeException('Sayfa getirilemedi (cURL devre dışı, file_get_contents başarısız).');
    }
    return $result;
}

/**
 * Parses the TCMB consumer prices HTML page and returns an array of:
 *   ['year' => int, 'month' => int, 'monthly' => float, 'annual' => float]
 *
 * Uses three strategies in priority order:
 *  1. MM-YYYY plain-text regex — handles "06-2026 32.11 0.99" rows.
 *  2. DOMDocument table scan — for pages that render HTML tables.
 *  3. Turkish month-name regex scan — legacy fallback.
 *
 * Returns an empty array if no strategy finds data.
 */
function parse_tcmb_html(string $html): array
{
    $monthMap = [
        'ocak'    => 1,  'şubat'   => 2,  'mart'    => 3,  'nisan'   => 4,
        'mayıs'   => 5,  'haziran' => 6,  'temmuz'  => 7,  'ağustos' => 8,
        'eylül'   => 9,  'ekim'    => 10, 'kasım'   => 11, 'aralık'  => 12,
    ];

    // Normalize encoding to UTF-8
    if (!mb_detect_encoding($html, 'UTF-8', true)) {
        foreach (['ISO-8859-9', 'Windows-1254', 'ISO-8859-1'] as $enc) {
            if (mb_detect_encoding($html, $enc, true)) {
                $html = mb_convert_encoding($html, 'UTF-8', $enc);
                break;
            }
        }
    }

    $rows = [];

    // ── Strategy 1: MM-YYYY plain-text regex ────────────────────────────────
    // Handles rows like: 06-2026 32.11 0.99  (MM-YYYY annual monthly)
    $plainText = html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8');
    if (preg_match_all(
        '/\b(0[1-9]|1[0-2])-(20\d{2}|19\d{2})\s+(-?\d+(?:[.,]\d+)?)\s+(-?\d+(?:[.,]\d+)?)\b/',
        $plainText,
        $ms,
        PREG_SET_ORDER
    )) {
        foreach ($ms as $m) {
            $month  = (int) $m[1];
            $year   = (int) $m[2];
            $annual  = tcmb_parse_num($m[3]);
            $monthly = tcmb_parse_num($m[4]);
            if ($year >= 2005 && $year <= 2100
                && $monthly !== null && abs($monthly) <= 100
                && $annual  !== null && abs($annual)  <= 500
            ) {
                $rows[$year * 12 + $month] = [
                    'year' => $year, 'month' => $month,
                    'monthly' => $monthly, 'annual' => $annual,
                ];
            }
        }
    }

    if (!empty($rows)) {
        return array_values($rows);
    }

    // ── Strategy 2: DOMDocument table scan ──────────────────────────────────
    $doc = new DOMDocument('1.0', 'UTF-8');
    libxml_use_internal_errors(true);
    $doc->loadHTML('<?xml encoding="UTF-8">' . $html);
    libxml_clear_errors();
    $xpath = new DOMXPath($doc);

    $tables = $xpath->query('//table');
    if ($tables !== false && $tables->length > 0) {
        foreach ($tables as $table) {
            foreach ($xpath->query('.//tr', $table) as $tr) {
                $cells = [];
                foreach ($xpath->query('.//td|.//th', $tr) as $cell) {
                    $text = preg_replace('/\s+/', ' ', $cell->textContent ?? '');
                    $cells[] = trim($text ?? '');
                }
                if (count($cells) < 3) continue;

                $parsed = tcmb_try_parse_row($cells, $monthMap);
                if ($parsed !== null) {
                    $rows[$parsed['year'] * 12 + $parsed['month']] = $parsed;
                }
            }
        }
    }

    if (!empty($rows)) {
        return array_values($rows);
    }

    // ── Strategy 2: Regex scan on stripped text ──────────────────────────────
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8');
    $text = preg_replace('/\s+/', ' ', $text) ?? '';

    // Number pattern: optional minus, digits, optional comma/period decimal
    $numPat = '-?\d{1,3}[,\.]\d{1,4}';

    foreach ($monthMap as $name => $num) {
        // Try both "YYYY Ay ±N,NN ±N,NN" and "Ay YYYY ±N,NN ±N,NN"
        $nameEsc   = preg_quote(ucfirst($name), '/');
        $lowerEsc  = preg_quote($name, '/');
        $patterns  = [
            '/(\d{4})\s+(?:' . $nameEsc . '|' . $lowerEsc . ')\s+(' . $numPat . ')\s+(' . $numPat . ')/u',
            '/(?:' . $nameEsc . '|' . $lowerEsc . ')\s+(\d{4})\s+(' . $numPat . ')\s+(' . $numPat . ')/u',
        ];

        foreach ($patterns as $idx => $pattern) {
            if (preg_match_all($pattern, $text, $ms, PREG_SET_ORDER)) {
                foreach ($ms as $m) {
                    if ($idx === 0) {
                        $year    = (int) $m[1];
                        $monthly = tcmb_parse_num($m[2]);
                        $annual  = tcmb_parse_num($m[3]);
                    } else {
                        $year    = (int) $m[1];
                        $monthly = tcmb_parse_num($m[2]);
                        $annual  = tcmb_parse_num($m[3]);
                    }
                    if ($year >= 2005 && $year <= 2100
                        && $monthly !== null && abs($monthly) <= 100
                        && $annual  !== null && abs($annual)  <= 500
                    ) {
                        $rows[$year * 12 + $num] = [
                            'year' => $year, 'month' => $num,
                            'monthly' => $monthly, 'annual' => $annual,
                        ];
                    }
                }
            }
        }
    }

    return array_values($rows);
}

function tcmb_try_parse_row(array $cells, array $monthMap): ?array
{
    foreach ($cells as $i => $cell) {
        $year  = null;
        $month = null;

        // "YYYY Ay" pattern
        if (preg_match('/(\d{4})\s+(\S+)/u', $cell, $m)) {
            $y  = (int) $m[1];
            $mn = mb_strtolower(trim($m[2]), 'UTF-8');
            if ($y >= 2005 && $y <= 2100 && isset($monthMap[$mn])) {
                $year = $y; $month = $monthMap[$mn];
            }
        }

        // "Ay YYYY" pattern
        if ($year === null && preg_match('/^(\S+)\s+(\d{4})$/u', trim($cell), $m)) {
            $mn = mb_strtolower(trim($m[1]), 'UTF-8');
            $y  = (int) $m[2];
            if ($y >= 2005 && $y <= 2100 && isset($monthMap[$mn])) {
                $year = $y; $month = $monthMap[$mn];
            }
        }

        if ($year === null || $month === null) continue;

        // Extract numerics from all other cells
        $nums = [];
        foreach ($cells as $j => $other) {
            if ($j === $i) continue;
            $n = tcmb_parse_num($other);
            if ($n !== null) $nums[] = $n;
        }

        // Expect at least two: monthly % and annual %
        if (count($nums) >= 2 && abs($nums[0]) <= 100 && abs($nums[1]) <= 500) {
            return ['year' => $year, 'month' => $month, 'monthly' => $nums[0], 'annual' => $nums[1]];
        }
    }
    return null;
}

function tcmb_parse_num(string $s): ?float
{
    // Strip everything except digits, minus, comma, period
    $s = preg_replace('/[^\d,.\-]/', '', trim($s)) ?? '';
    // Turkish decimal comma → period  (e.g. "1,82" → "1.82")
    // But watch out for thousands separator: "1.234,56" → "1234.56"
    // For our small percentage values (<100) there's no thousands separator
    $s = str_replace(',', '.', $s);
    $s = trim($s, '.');
    if ($s === '' || !is_numeric($s)) return null;
    return (float) $s;
}

// ── Shared fetch helper ───────────────────────────────────────────────────────

function fetch_index(string $indexType, int $year, int $month): ?array
{
    $stmt = db()->prepare(
        'SELECT id, index_type, period_year, period_month, index_value,
                monthly_change_percent, annual_change_percent, source
         FROM ak_inflation_indices
         WHERE index_type = :index_type
           AND period_year  = :year
           AND period_month = :month
         LIMIT 1'
    );
    $stmt->execute(['index_type' => $indexType, 'year' => $year, 'month' => $month]);
    $row = $stmt->fetch();
    return $row ?: null;
}
