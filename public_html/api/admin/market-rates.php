<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();
require_method('GET');

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

const MARKET_RATES_CACHE_TTL = 5;
const MARKET_RATES_SOURCE_URL = 'https://api.genelpara.com/json/';
const MARKET_RATES_DOVIZ_URL = MARKET_RATES_SOURCE_URL . '?list=doviz&sembol=USD,EUR';
const MARKET_RATES_ALTIN_URL = MARKET_RATES_SOURCE_URL . '?list=altin&sembol=GA';

$cacheFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'akinal_market_rates_cache.json';
$cached = read_market_rates_cache($cacheFile);

if ($cached !== null && (time() - (int) ($cached['cached_at'] ?? 0)) < MARKET_RATES_CACHE_TTL) {
    json_success($cached['payload']);
}

$fresh = fetch_market_rates();
if ($fresh !== null) {
    write_market_rates_cache($cacheFile, $fresh);
    json_success($fresh);
}

if ($cached !== null) {
    $payload = $cached['payload'];
    $payload['stale'] = true;
    json_success($payload);
}

json_success(fallback_market_rates());

function fetch_market_rates(): ?array
{
    $currency = fetch_market_rates_json(MARKET_RATES_DOVIZ_URL);
    $gold = fetch_market_rates_json(MARKET_RATES_ALTIN_URL);

    if ($currency === null || $gold === null) {
        return null;
    }

    $rates = [
        parse_genelpara_rate($currency, 'EUR', 'EURO', 'eur'),
        parse_genelpara_rate($currency, 'USD', 'DOLAR', 'usd'),
        parse_genelpara_rate($gold, 'GA', 'GRAM ALTIN', 'gold'),
    ];

    foreach ($rates as $rate) {
        if ($rate['value'] === null) {
            return null;
        }
    }

    return [
        'rates' => $rates,
        'source' => MARKET_RATES_SOURCE_URL,
        'stale' => false,
        'fetched_at' => gmdate('c'),
    ];
}

function fetch_market_rates_json(string $url): ?array
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
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
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
                'header' => "User-Agent: AkinalInsaatAdminTicker/1.0\r\nAccept: application/json\r\n",
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
    }

    if (!is_string($body) || trim($body) === '') {
        return null;
    }

    $data = json_decode($body, true);
    return is_array($data) && ($data['success'] ?? false) === true ? $data : null;
}

function parse_genelpara_rate(array $payload, string $symbol, string $label, string $code): array
{
    $item = $payload['data'][$symbol] ?? null;
    $value = is_array($item) ? parse_market_number((string) ($item['satis'] ?? $item['alis'] ?? '')) : null;
    $change = is_array($item) ? parse_market_number((string) ($item['degisim'] ?? '')) : null;

    return [
        'code' => $code,
        'label' => $label,
        'value' => $value,
        'change_percent' => $change,
    ];
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
        'source' => MARKET_RATES_SOURCE_URL,
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
