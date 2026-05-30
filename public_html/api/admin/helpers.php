<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';

function read_admin_json_body(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '{}', true);
    return is_array($data) ? $data : [];
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function normalize_bool($value): int
{
    return ($value === true || $value === 1 || $value === '1') ? 1 : 0;
}

function nullable_string(array $input, string $key): ?string
{
    if (!array_key_exists($key, $input) || $input[$key] === null) {
        return null;
    }

    $value = trim((string) $input[$key]);
    return $value === '' ? null : $value;
}

function require_non_empty(array $input, string $key, string $message): string
{
    $value = trim((string) ($input[$key] ?? ''));
    if ($value === '') {
        json_error($message);
    }
    return $value;
}
