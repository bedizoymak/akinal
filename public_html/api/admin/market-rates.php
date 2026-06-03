<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();
require_method('GET');

const MARKET_RATES_CACHE_TTL = 600;
const MARKET_RATES_SOURCE_URL = 'https://kur.doviz.com/';

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
    $html = fetch_market_rates_html(MARKET_RATES_SOURCE_URL);
    if ($html === null || trim($html) === '') {
        return null;
    }

    $rates = [
        parse_market_rate($html, 'GRAM ALTIN', 'gold'),
        parse_market_rate($html, 'DOLAR', 'usd'),
        parse_market_rate($html, 'EURO', 'eur'),
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

function fetch_market_rates_html(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_USERAGENT => 'AkinalInsaatAdminTicker/1.0',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml'],
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (is_string($body) && $status >= 200 && $status < 300) {
            return $body;
        }
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => 8,
            'header' => "User-Agent: AkinalInsaatAdminTicker/1.0\r\nAccept: text/html,application/xhtml+xml\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);

    return is_string($body) ? $body : null;
}

function parse_market_rate(string $html, string $label, string $code): array
{
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    $value = null;
    $change = null;

    if (preg_match('/' . preg_quote($label, '/') . '\s+([0-9.,]+)\s+%(-?[0-9.,]+)/u', $text, $matches)) {
        $value = parse_tr_market_number($matches[1]);
        $change = parse_tr_market_number($matches[2]);
    } elseif (preg_match('/' . preg_quote($label, '/') . '.{0,180}?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2,4}).{0,80}?%?\s*(-?[0-9]+,[0-9]+)/us', $text, $matches)) {
        $value = parse_tr_market_number($matches[1]);
        $change = parse_tr_market_number($matches[2]);
    }

    return [
        'code' => $code,
        'label' => $label,
        'value' => $value,
        'change_percent' => $change,
    ];
}

function parse_tr_market_number(string $value): ?float
{
    $normalized = str_replace(['.', ','], ['', '.'], trim($value));
    return is_numeric($normalized) ? (float) $normalized : null;
}

function fallback_market_rates(): array
{
    return [
        'rates' => [
            ['code' => 'gold', 'label' => 'GRAM ALTIN', 'value' => null, 'change_percent' => null],
            ['code' => 'usd', 'label' => 'DOLAR', 'value' => null, 'change_percent' => null],
            ['code' => 'eur', 'label' => 'EURO', 'value' => null, 'change_percent' => null],
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
