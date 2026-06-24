<?php
declare(strict_types=1);

// =============================================================================
// TEMPORARY MAINTENANCE ENDPOINT — agent-sql.php
// -----------------------------------------------------------------------------
// This file exists solely to allow a local agent (Claude/Codex) to execute
// reviewed SQL against production MySQL during a maintenance window.
//
// DB_HOST=localhost is not externally reachable; this endpoint runs on the
// server where MySQL is accessible, bridging that gap without cPanel/SSH.
//
// REMOVE OR DISABLE THIS FILE when maintenance is complete:
//   Option A: Delete the file from the server.
//   Option B: Set ENABLE_AGENT_SQL_ENDPOINT to false in config.php.
//
// DO NOT commit real AGENT_SQL_TOKEN values to the repository.
// =============================================================================

require_once __DIR__ . '/../db.php';

// ── Feature flag ─────────────────────────────────────────────────────────────

if (!defined('ENABLE_AGENT_SQL_ENDPOINT') || ENABLE_AGENT_SQL_ENDPOINT !== true) {
    agent_error('Agent SQL endpoint is disabled.', 403);
}

// ── Method guard ─────────────────────────────────────────────────────────────

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    agent_error('Method not allowed.', 405);
}

// ── Token authentication ──────────────────────────────────────────────────────
// Token is sent as: X-Agent-SQL-Token: <value>
// Expected value is defined as AGENT_SQL_TOKEN constant in config.php.

if (!defined('AGENT_SQL_TOKEN') || (string) AGENT_SQL_TOKEN === '') {
    agent_error('Agent SQL token is not configured on the server.', 500);
}

$requestToken = trim((string) ($_SERVER['HTTP_X_AGENT_SQL_TOKEN'] ?? ''));

if ($requestToken === '' || !hash_equals((string) AGENT_SQL_TOKEN, $requestToken)) {
    agent_error('Unauthorized.', 401);
}

// ── Parse body ───────────────────────────────────────────────────────────────

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($body)) {
    agent_error('Request body must be a JSON object.');
}

$rawSql   = trim((string) ($body['sql'] ?? ''));
$confirmed = !empty($body['confirmed']);

// ── SQL validation ────────────────────────────────────────────────────────────

if ($rawSql === '') {
    agent_error('sql must not be empty.');
}

// Strip comments-only input
$strippedForCheck = preg_replace('/--[^\n]*\n?|#[^\n]*\n?|\/\*.*?\*\//s', '', $rawSql) ?? '';
if (trim($strippedForCheck) === '') {
    agent_error('sql contains only comments — no executable statement found.');
}

$sql           = agent_normalize_single_statement($rawSql);
$statementType = agent_statement_type($sql);
$isSelect      = agent_is_select($statementType);
$isDestructive = agent_is_destructive($statementType);

if (!$isSelect && !$confirmed) {
    agent_error(
        'Non-SELECT statement requires confirmed: true in the request body. ' .
        'Review the SQL, then resend with confirmed: true.',
        403
    );
}

// ── Log every execution ───────────────────────────────────────────────────────

$snippet = substr(preg_replace('/\s+/', ' ', $sql) ?? $sql, 0, 1000);
error_log(sprintf(
    '[agent-sql] executed at %s | type=%s | destructive=%s | sql=%s',
    gmdate('c'),
    $statementType,
    $isDestructive ? 'yes' : 'no',
    $snippet
));

// ── Execute ───────────────────────────────────────────────────────────────────

try {
    $pdo       = db();
    $executedAt = gmdate('c');

    if ($isSelect) {
        $stmt    = $pdo->query($sql);
        $rows    = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
        $columns = [];
        if ($stmt) {
            for ($i = 0; $i < $stmt->columnCount(); $i++) {
                $meta      = $stmt->getColumnMeta($i);
                $columns[] = (string) ($meta['name'] ?? 'column_' . ($i + 1));
            }
        }

        agent_success([
            'success'        => true,
            'statement_type' => $statementType,
            'destructive'    => false,
            'columns'        => $columns,
            'rows'           => $rows,
            'row_count'      => count($rows),
            'affected_rows'  => null,
            'executed_at'    => $executedAt,
        ]);
    }

    $affected = $pdo->exec($sql);

    agent_success([
        'success'        => true,
        'statement_type' => $statementType,
        'destructive'    => $isDestructive,
        'columns'        => [],
        'rows'           => [],
        'row_count'      => 0,
        'affected_rows'  => $affected === false ? 0 : $affected,
        'executed_at'    => $executedAt,
    ]);
} catch (PDOException $exception) {
    error_log('[agent-sql] PDO error: ' . $exception->getMessage());
    agent_error(agent_sanitize_pdo_error($exception), 400);
} catch (Throwable $exception) {
    error_log('[agent-sql] failure: ' . $exception->getMessage());
    agent_error('SQL execution failed.', 500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function agent_normalize_single_statement(string $sql): string
{
    $statement = rtrim(trim($sql));

    if (substr($statement, -1) === ';') {
        $statement = rtrim(substr($statement, 0, -1));
    }

    if ($statement === '') {
        agent_error('sql is empty after normalization.');
    }

    if (agent_has_statement_separator($statement)) {
        agent_error('Only one SQL statement is allowed per request. Remove the semicolon between statements.');
    }

    return $statement;
}

function agent_has_statement_separator(string $sql): bool
{
    $quote  = null;
    $length = strlen($sql);

    for ($i = 0; $i < $length; $i++) {
        $char = $sql[$i];
        $next = $i + 1 < $length ? $sql[$i + 1] : '';

        if ($quote !== null) {
            if ($char === '\\') { $i++; continue; }
            if ($char === $quote) { $quote = null; }
            continue;
        }

        if ($char === '\'' || $char === '"' || $char === '`') {
            $quote = $char;
            continue;
        }

        if ($char === '-' && $next === '-') {
            while ($i < $length && $sql[$i] !== "\n") { $i++; }
            continue;
        }

        if ($char === '#') {
            while ($i < $length && $sql[$i] !== "\n") { $i++; }
            continue;
        }

        if ($char === '/' && $next === '*') {
            $i += 2;
            while ($i + 1 < $length && !($sql[$i] === '*' && $sql[$i + 1] === '/')) { $i++; }
            $i++;
            continue;
        }

        if ($char === ';') {
            return true;
        }
    }

    return false;
}

function agent_statement_type(string $sql): string
{
    $clean = preg_replace('/^\s*(?:\/\*.*?\*\/\s*)*/s', '', $sql) ?? $sql;
    if (!preg_match('/^([a-zA-Z]+)/', ltrim($clean), $matches)) {
        agent_error('Could not determine SQL statement type.');
    }

    return strtoupper($matches[1]);
}

function agent_is_select(string $type): bool
{
    return in_array($type, ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN'], true);
}

function agent_is_destructive(string $type): bool
{
    return in_array($type, ['DROP', 'TRUNCATE', 'ALTER'], true);
}

function agent_sanitize_pdo_error(PDOException $exception): string
{
    $errorInfo    = $exception->errorInfo ?? [];
    $sqlState     = (string) ($errorInfo[0] ?? $exception->getCode());
    $driverCode   = isset($errorInfo[1]) ? (string) $errorInfo[1] : '';
    $driverMessage = (string) ($errorInfo[2] ?? $exception->getMessage());

    $driverMessage = preg_replace('/SQLSTATE\[[^\]]+\]:\s*/', '', $driverMessage) ?? $driverMessage;
    $driverMessage = preg_replace('/\s+/', ' ', $driverMessage) ?? $driverMessage;
    $driverMessage = trim($driverMessage);

    foreach (['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'] as $c) {
        if (defined($c) && (string) constant($c) !== '') {
            $driverMessage = str_replace((string) constant($c), '[redacted]', $driverMessage);
        }
    }

    $driverMessage = substr($driverMessage, 0, 500);
    $prefixParts   = array_filter([$sqlState, $driverCode], static fn($v) => $v !== '');
    $prefix        = $prefixParts ? 'SQL error (' . implode(' / ', $prefixParts) . '): ' : 'SQL error: ';

    return $prefix . ($driverMessage !== '' ? $driverMessage : 'Query could not be executed.');
}

function agent_success(array $data): never
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function agent_error(string $message, int $status = 400): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
