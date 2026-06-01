<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

$admin = require_admin();
require_method('POST');

try {
    $input = read_admin_json_body();
    $sql = trim((string) ($input['sql'] ?? ''));

    if ($sql === '') {
        json_error('SQL sorgusu boş olamaz.');
    }

    $sql = normalize_single_statement($sql);
    $statementType = statement_type($sql);
    $isSelect = is_select_statement($statementType);
    $isDestructive = is_destructive_statement($statementType);

    if (!$isSelect && empty($input['confirmed'])) {
        json_error('SELECT dışındaki sorgular için onay kutusu işaretlenmelidir.');
    }

    if ($isDestructive && trim((string) ($input['destructive_confirmation'] ?? '')) !== 'UYGULA') {
        json_error('DROP, TRUNCATE ve ALTER sorguları için UYGULA yazarak ek onay vermelisiniz.');
    }

    log_admin_sql($admin, $statementType, $sql);

    $pdo = db();
    $executedAt = gmdate('c');

    if ($isSelect) {
        $stmt = $pdo->query($sql);
        $rows = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
        $columns = [];
        if ($stmt) {
            for ($i = 0; $i < $stmt->columnCount(); $i++) {
                $meta = $stmt->getColumnMeta($i);
                $columns[] = (string) ($meta['name'] ?? 'column_' . ($i + 1));
            }
        }

        json_success([
            'result' => [
                'statement_type' => $statementType,
                'is_select' => true,
                'destructive' => false,
                'columns' => $columns,
                'rows' => $rows,
                'row_count' => count($rows),
                'affected_rows' => null,
                'executed_at' => $executedAt,
            ],
        ]);
    }

    $affected = $pdo->exec($sql);

    json_success([
        'result' => [
            'statement_type' => $statementType,
            'is_select' => false,
            'destructive' => $isDestructive,
            'columns' => [],
            'rows' => [],
            'row_count' => 0,
            'affected_rows' => $affected === false ? 0 : $affected,
            'executed_at' => $executedAt,
        ],
    ]);
} catch (PDOException $exception) {
    error_log('Admin SQL editor error: ' . $exception->getMessage());
    json_error('SQL sorgusu çalıştırılamadı. Söz dizimini ve tablo/kolon adlarını kontrol edin.', 400);
} catch (Throwable $exception) {
    error_log('Admin SQL editor failure: ' . $exception->getMessage());
    json_error('SQL editör işlemi tamamlanamadı.', 500);
}

function normalize_single_statement(string $sql): string
{
    $trimmed = trim($sql);
    $statement = rtrim($trimmed);

    if (substr($statement, -1) === ';') {
        $statement = rtrim(substr($statement, 0, -1));
    }

    if ($statement === '') {
        json_error('SQL sorgusu boş olamaz.');
    }

    if (has_statement_separator($statement)) {
        json_error('Her istekte yalnızca tek SQL ifadesi çalıştırılabilir.');
    }

    return $statement;
}

function has_statement_separator(string $sql): bool
{
    $quote = null;
    $length = strlen($sql);

    for ($i = 0; $i < $length; $i++) {
        $char = $sql[$i];
        $next = $i + 1 < $length ? $sql[$i + 1] : '';

        if ($quote !== null) {
            if ($char === '\\') {
                $i++;
                continue;
            }
            if ($char === $quote) {
                $quote = null;
            }
            continue;
        }

        if ($char === '\'' || $char === '"' || $char === '`') {
            $quote = $char;
            continue;
        }

        if ($char === '-' && $next === '-') {
            while ($i < $length && $sql[$i] !== "\n") {
                $i++;
            }
            continue;
        }

        if ($char === '#') {
            while ($i < $length && $sql[$i] !== "\n") {
                $i++;
            }
            continue;
        }

        if ($char === '/' && $next === '*') {
            $i += 2;
            while ($i + 1 < $length && !($sql[$i] === '*' && $sql[$i + 1] === '/')) {
                $i++;
            }
            $i++;
            continue;
        }

        if ($char === ';') {
            return true;
        }
    }

    return false;
}

function statement_type(string $sql): string
{
    $clean = preg_replace('/^\s*(?:\/\*.*?\*\/\s*)*/s', '', $sql) ?? $sql;
    if (!preg_match('/^([a-zA-Z]+)/', ltrim($clean), $matches)) {
        json_error('SQL ifade türü belirlenemedi.');
    }

    return strtoupper($matches[1]);
}

function is_select_statement(string $statementType): bool
{
    return in_array($statementType, ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN'], true);
}

function is_destructive_statement(string $statementType): bool
{
    return in_array($statementType, ['DROP', 'TRUNCATE', 'ALTER'], true);
}

function log_admin_sql(array $admin, string $statementType, string $sql): void
{
    $email = (string) ($admin['email'] ?? '');
    $id = (string) ($admin['id'] ?? '');
    $snippet = substr(preg_replace('/\s+/', ' ', $sql) ?? $sql, 0, 1000);
    error_log(sprintf(
        'Admin SQL executed at %s by %s <%s>, type=%s, sql=%s',
        gmdate('c'),
        $id,
        $email,
        $statementType,
        $snippet
    ));
}
