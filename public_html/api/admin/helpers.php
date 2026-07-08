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

function require_positive_amount(array $input, string $key = 'amount'): float
{
    $amount = (float) ($input[$key] ?? 0);
    if ($amount <= 0) {
        json_error('Tutar 0 değerinden büyük olmalıdır.');
    }
    return $amount;
}

function require_allowed_value(array $input, string $key, array $allowed, string $message): string
{
    $value = require_non_empty($input, $key, $message);
    if (!in_array($value, $allowed, true)) {
        json_error($message);
    }
    return $value;
}

function require_iso_date(array $input, string $key, string $message): string
{
    $value = require_non_empty($input, $key, $message);
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        json_error($message);
    }
    return $value;
}

/**
 * Checks that no row exists in $table where $column = $id.
 * Calls json_error(409) with $message when a linked record is found.
 * Prevents FK RESTRICT violations from reaching the DB layer.
 */
function assert_no_linked_records(string $table, string $column, string $id, string $message): void
{
    $stmt = db()->prepare("SELECT 1 FROM `{$table}` WHERE `{$column}` = :id LIMIT 1");
    $stmt->execute(['id' => $id]);
    if ($stmt->fetch()) {
        json_error($message, 409);
    }
}

function require_upload_size(array $file, int $maxBytes): void
{
    $size = (int) ($file['size'] ?? 0);
    if ($size <= 0) {
        json_error('Yüklenen dosya boş.');
    }
    if ($size > $maxBytes) {
        json_error('Dosya boyutu izin verilen sınırı aşıyor.');
    }
}
