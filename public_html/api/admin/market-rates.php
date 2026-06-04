<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();
require_method('GET');

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

const MARKET_RATES_CACHE_TTL = 5;
const MARKET_RATES_DOVIZ_SOURCE_URL = 'https://kur.doviz.com/';
const MARKET_RATES_GENELPARA_SOURCE_URL = 'https://api.genelpara.com/json/';
const MARKET_RATES_GENELPARA_DOVIZ_URL = MARKET_RATES_GENELPARA_SOURCE_URL . '?list=doviz&sembol=USD,EUR';
const MARKET_RATES_GENELPARA_ALTIN_URL = MARKET_RATES_GENELPARA_SOURCE_URL . '?list=altin&sembol=GA';

$cacheFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'akinal_market_rates_cache.json';
$cached = read_market_rates_cache($cacheFile);
$debug = (string) ($_GET['debug'] ?? '') === '1';

if (!$debug && $cached !== null && (time() - (int) ($cached['cached_at'] ?? 0)) < MARKET_RATES_CACHE_TTL) {
    json_success($cached['payload']);
}

$fresh = fetch_market_rates($debug);
if ($fresh !== null) {
    if (!$debug) {
        write_market_rates_cache($cacheFile, $fresh);
    }
    json_success($fresh);
}

if ($cached !== null) {
    $payload = $cached['payload'];
    $payload['stale'] = true;
    json_success($payload);
}

json_success(fallback_market_rates());

function fetch_market_rates(bool $debug = false): ?array
{
    return fetch_market_rates_from_doviz($debug) ?? fetch_market_rates_from_genelpara($debug);
}

function fetch_market_rates_from_doviz(bool $debug = false): ?array
{
    $html = fetch_market_rates_body(MARKET_RATES_DOVIZ_SOURCE_URL, 'text/html,application/xhtml+xml');
    if ($html === null || trim($html) === '') {
        return null;
    }

    $rates = [
        parse_doviz_rate($html, 'EURO', 'eur', 'EUR'),
        parse_doviz_rate($html, 'DOLAR', 'usd', 'USD'),
        parse_doviz_rate($html, 'GRAM ALTIN', 'gold', 'gram-altin'),
    ];

    foreach ($rates as $rate) {
        if ($rate['value'] === null) {
            return null;
        }
    }

    $percentDebug = [];
    $rates = apply_genelpara_percent_changes($rates, $percentDebug);

    $payload = [
        'rates' => $rates,
        'source' => MARKET_RATES_DOVIZ_SOURCE_URL,
        'stale' => false,
        'fetched_at' => gmdate('c'),
    ];

    if ($debug) {
        $payload['debug'] = [
            'price_source' => MARKET_RATES_DOVIZ_SOURCE_URL,
            'percent_source' => MARKET_RATES_GENELPARA_SOURCE_URL,
            'raw_percent_fields' => $percentDebug,
        ];
    }

    return $payload;
}

function fetch_market_rates_from_genelpara(bool $debug = false): ?array
{
    $currency = fetch_market_rates_json(MARKET_RATES_GENELPARA_DOVIZ_URL);
    $gold = fetch_market_rates_json(MARKET_RATES_GENELPARA_ALTIN_URL);

    if ($currency === null || $gold === null) {
        return null;
    }

    $percentDebug = [];
    $rates = [
        parse_genelpara_rate($currency, 'EUR', 'EURO', 'eur', $percentDebug),
        parse_genelpara_rate($currency, 'USD', 'DOLAR', 'usd', $percentDebug),
        parse_genelpara_rate($gold, 'GA', 'GRAM ALTIN', 'gold', $percentDebug),
    ];

    foreach ($rates as $rate) {
        if ($rate['value'] === null) {
            return null;
        }
    }

    $payload = [
        'rates' => $rates,
        'source' => MARKET_RATES_GENELPARA_SOURCE_URL,
        'stale' => false,
        'fetched_at' => gmdate('c'),
    ];

    if ($debug) {
        $payload['debug'] = [
            'price_source' => MARKET_RATES_GENELPARA_SOURCE_URL,
            'percent_source' => MARKET_RATES_GENELPARA_SOURCE_URL,
            'raw_percent_fields' => $percentDebug,
        ];
    }

    return $payload;
}

function fetch_market_rates_json(string $url): ?array
{
    $body = fetch_market_rates_body($url, 'application/json');

    if (!is_string($body) || trim($body) === '') {
        return null;
    }

    $data = json_decode($body, true);
    return is_array($data) && ($data['success'] ?? false) === true ? $data : null;
}

function fetch_market_rates_body(string $url, string $accept): ?string
{
    $body = null;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_USERAGENT => 'AkinalInsaatAdminTicker/1.0',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => ['Accept: ' . $accept],
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!is_string($body) || $status < 200 || $status >= 300) {
            $body = null;
        }
    }

    if ($body === null) {
        $context = stream_context_create([
            'http' => [
                'timeout' => 8,
                'header' => "User-Agent: AkinalInsaatAdminTicker/1.0\r\nAccept: " . $accept . "\r\n",
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
    }

    return is_string($body) ? $body : null;
}

function parse_doviz_rate(string $html, string $label, string $code, string $socketKey): array
{
    $value = null;
    $change = null;

    if (preg_match('/data-socket-key="' . preg_quote($socketKey, '/') . '"\s+data-socket-attr="s"[^>]*>\s*([^<]+)\s*</u', $html, $valueMatch)) {
        $value = parse_market_number($valueMatch[1]);
    }

    if (preg_match('/data-socket-key="' . preg_quote($socketKey, '/') . '"\s+data-socket-attr="c"[^>]*>\s*([^<]+)\s*</u', $html, $changeMatch)) {
        $change = parse_market_number($changeMatch[1]);
    }

    return [
        'code' => $code,
        'label' => $label,
        'value' => $value,
        'change_percent' => $change,
    ];
}

function parse_genelpara_rate(array $payload, string $symbol, string $label, string $code, array &$percentDebug = []): array
{
    $item = $payload['data'][$symbol] ?? null;
    $value = is_array($item) ? parse_market_number((string) ($item['satis'] ?? $item['alis'] ?? '')) : null;
    $change = is_array($item) ? parse_market_number((string) ($item['oran'] ?? '')) : null;

    if (is_array($item)) {
        $percentDebug[$code] = [
            'symbol' => $symbol,
            'label' => $label,
            'used_field' => 'oran',
            'used_raw_value' => (string) ($item['oran'] ?? ''),
            'parsed_value' => $change,
            'available_fields' => [
                'degisim' => (string) ($item['degisim'] ?? ''),
                'oran' => (string) ($item['oran'] ?? ''),
                'yon' => (string) ($item['yon'] ?? ''),
            ],
        ];
    }

    return [
        'code' => $code,
        'label' => $label,
        'value' => $value,
        'change_percent' => $change,
    ];
}

function apply_genelpara_percent_changes(array $rates, array &$percentDebug): array
{
    $currency = fetch_market_rates_json(MARKET_RATES_GENELPARA_DOVIZ_URL);
    $gold = fetch_market_rates_json(MARKET_RATES_GENELPARA_ALTIN_URL);

    if ($currency === null || $gold === null) {
        return $rates;
    }

    $percentRates = [
        parse_genelpara_rate($currency, 'EUR', 'EURO', 'eur', $percentDebug),
        parse_genelpara_rate($currency, 'USD', 'DOLAR', 'usd', $percentDebug),
        parse_genelpara_rate($gold, 'GA', 'GRAM ALTIN', 'gold', $percentDebug),
    ];

    $percentByCode = [];
    foreach ($percentRates as $rate) {
        $percentByCode[$rate['code']] = $rate['change_percent'];
    }

    return array_map(static function (array $rate) use ($percentByCode): array {
        if (array_key_exists($rate['code'], $percentByCode)) {
            $rate['change_percent'] = $percentByCode[$rate['code']];
        }
        return $rate;
    }, $rates);
}

function parse_market_number(string $value): ?float
{
    $value = trim(str_replace(['+', '%'], '', $value));
    $normalized = str_replace(',', '.', $value);
    return is_numeric($normalized) ? (float) $normalized : null;
}

function fallback_market_rates(): array
{
    return [
        'rates' => [
            ['code' => 'eur', 'label' => 'EURO', 'value' => null, 'change_percent' => null],
            ['code' => 'usd', 'label' => 'DOLAR', 'value' => null, 'change_percent' => null],
            ['code' => 'gold', 'label' => 'GRAM ALTIN', 'value' => null, 'change_percent' => null],
        ],
        'source' => MARKET_RATES_DOVIZ_SOURCE_URL,
        'stale' => true,
        'fetched_at' => gmdate('c'),
    ];
}

function read_market_rates_cache(string $cacheFile): ?array
{
    if (!is_file($cacheFile)) {
        return null;
    }

    $data = json_decode((string) @file_get_contents($cacheFile), true);
    return is_array($data) && isset($data['payload']) ? $data : null;
}

function write_market_rates_cache(string $cacheFile, array $payload): void
{
    @file_put_contents($cacheFile, json_encode([
        'cached_at' => time(),
        'payload' => $payload,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}
