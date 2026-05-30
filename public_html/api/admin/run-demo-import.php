<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();
require_method('POST');

if (!defined('DEMO_IMPORT_TOKEN') || DEMO_IMPORT_TOKEN === '' || DEMO_IMPORT_TOKEN === 'LONG_RANDOM_DEMO_IMPORT_TOKEN_HERE') {
    json_error('Demo import token is not configured.', 500);
}

$providedToken = trim((string) ($_GET['token'] ?? ''));
if ($providedToken === '') {
    $providedToken = trim((string) ($_SERVER['HTTP_X_DEMO_IMPORT_TOKEN'] ?? ''));
}

if ($providedToken === '' || !hash_equals((string) DEMO_IMPORT_TOKEN, $providedToken)) {
    json_error('Invalid demo import token.', 403);
}

$sqlPath = __DIR__ . '/../../migration-tools/output/import-demo-data.sql';
if (!is_file($sqlPath) || !is_readable($sqlPath)) {
    json_error('Demo import SQL file was not found on the server.', 500, [
        'expected_path' => $sqlPath,
        'file_exists' => file_exists($sqlPath),
        'is_readable' => is_readable($sqlPath),
    ]);
}

$sql = file_get_contents($sqlPath);
if ($sql === false || trim($sql) === '') {
    json_error('Demo import SQL file is empty or unreadable.', 500);
}

$statements = split_sql_statements($sql);
$statementsRun = 0;
$errors = [];
$pdo = db();

try {
    $transactionStarted = false;
    if (!$pdo->inTransaction()) {
        $transactionStarted = $pdo->beginTransaction();
    }

    foreach ($statements as $statement) {
        $trimmed = trim($statement);
        if ($trimmed === '') {
            continue;
        }

        try {
            $pdo->exec($trimmed);
            $statementsRun++;
        } catch (Throwable $exception) {
            $errors[] = [
                'statement_number' => $statementsRun + 1,
                'message' => $exception->getMessage(),
            ];
            throw $exception;
        }
    }

    if ($transactionStarted && $pdo->inTransaction()) {
        $pdo->commit();
    }

    json_success([
        'success' => true,
        'statements_run' => $statementsRun,
        'errors' => $errors,
        'delete_this_file_immediately' => true,
        'message' => 'Demo import completed. Delete /api/admin/run-demo-import.php from production immediately.',
    ]);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_error('Demo import failed.', 500, [
        'success' => false,
        'statements_run' => $statementsRun,
        'errors' => $errors ?: [['message' => $exception->getMessage()]],
    ]);
}

function split_sql_statements(string $sql): array
{
    $statements = [];
    $current = '';
    $length = strlen($sql);
    $inSingleQuote = false;
    $inDoubleQuote = false;
    $lineComment = false;
    $blockComment = false;

    for ($index = 0; $index < $length; $index++) {
        $char = $sql[$index];
        $next = $index + 1 < $length ? $sql[$index + 1] : '';

        if ($lineComment) {
            if ($char === "\n") {
                $lineComment = false;
            }
            continue;
        }

        if ($blockComment) {
            if ($char === '*' && $next === '/') {
                $blockComment = false;
                $index++;
            }
            continue;
        }

        if (!$inSingleQuote && !$inDoubleQuote && $char === '-' && $next === '-') {
            $lineComment = true;
            $index++;
            continue;
        }

        if (!$inSingleQuote && !$inDoubleQuote && $char === '#') {
            $lineComment = true;
            continue;
        }

        if (!$inSingleQuote && !$inDoubleQuote && $char === '/' && $next === '*') {
            $blockComment = true;
            $index++;
            continue;
        }

        $current .= $char;

        if ($char === "'" && !$inDoubleQuote) {
            $backslashes = 0;
            for ($back = $index - 1; $back >= 0 && $sql[$back] === '\\'; $back--) {
                $backslashes++;
            }
            if ($backslashes % 2 === 0) {
                $inSingleQuote = !$inSingleQuote;
            }
            continue;
        }

        if ($char === '"' && !$inSingleQuote) {
            $backslashes = 0;
            for ($back = $index - 1; $back >= 0 && $sql[$back] === '\\'; $back--) {
                $backslashes++;
            }
            if ($backslashes % 2 === 0) {
                $inDoubleQuote = !$inDoubleQuote;
            }
            continue;
        }

        if ($char === ';' && !$inSingleQuote && !$inDoubleQuote) {
            $statements[] = substr($current, 0, -1);
            $current = '';
        }
    }

    if (trim($current) !== '') {
        $statements[] = $current;
    }

    return $statements;
}
