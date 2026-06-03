<?php
declare(strict_types=1);

const IMPORT_CONFIRM_TOKEN = 'IMPORT_PUBLIC_LAUNCH';
const IMPORT_SQL_FILE = __DIR__ . '/import-data/import-public-launch.sql';
const ENABLE_SETUP_TOOL = false;

$forbiddenPatterns = [
    '/\bDROP\b/i',
    '/\bTRUNCATE\b/i',
    '/\bDELETE\b/i',
    '/DEMO_DATA/i',
    '/`?ak_customers`?/i',
    '/`?ak_payments`?/i',
    '/`?ak_financial_entries`?/i',
    '/`?ak_notifications`?/i',
    '/`?ak_contact_requests`?/i',
    '/`?ak_cookie_consents`?/i',
    '/`?ak_admin_users`?/i',
    '/`?ak_profiles`?/i',
    '/`?ak_user_roles`?/i',
];

header('Content-Type: text/plain; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if (!ENABLE_SETUP_TOOL) {
    http_response_code(403);
    echo "This public launch importer is disabled for launch readiness.\n";
    echo "Enable it only in a temporary setup copy, run the import, then delete that copy immediately.\n";
    exit;
}

if (($_GET['confirm'] ?? '') !== IMPORT_CONFIRM_TOKEN) {
    http_response_code(403);
    echo "Refused.\n";
    echo "Run with ?confirm=" . IMPORT_CONFIRM_TOKEN . " to import public launch SQL.\n";
    exit;
}

if (!is_file(IMPORT_SQL_FILE)) {
    http_response_code(404);
    echo "Refused: SQL file is missing.\n";
    echo "Expected: public_html/import-data/import-public-launch.sql\n";
    exit;
}

$sql = file_get_contents(IMPORT_SQL_FILE);
if ($sql === false || trim($sql) === '') {
    http_response_code(400);
    echo "Refused: SQL file is empty or unreadable.\n";
    exit;
}

foreach ($forbiddenPatterns as $pattern) {
    if (preg_match($pattern, $sql) === 1) {
        http_response_code(400);
        echo "Refused: SQL contains a forbidden token matched by {$pattern}.\n";
        exit;
    }
}

require_once __DIR__ . '/api/db.php';

try {
    $pdo = db();
    $statements = splitSqlStatements($sql);
    $executedCount = 0;
    $affectedRows = 0;

    echo "Connected DB: " . (defined('DB_NAME') ? DB_NAME : '(configured database)') . "\n";
    echo "Import started.\n";

    $pdo->beginTransaction();
    foreach ($statements as $statement) {
        $trimmed = trim(removeSqlLineComments($statement));
        if ($trimmed === '') {
            continue;
        }

        $affected = $pdo->exec($trimmed);
        $executedCount++;
        if ($affected !== false) {
            $affectedRows += $affected;
        }
    }
    $pdo->commit();

    echo "Import finished.\n";
    echo "Affected statement count: {$executedCount}\n";
    echo "Affected row count: {$affectedRows}\n";
    echo "Delete public_html/import-public-launch.php and public_html/import-data/import-public-launch.sql immediately.\n";
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo "Import failed.\n";
    echo "No credentials were exposed. Check server logs for details.\n";
}

function splitSqlStatements(string $sql): array
{
    $statements = [];
    $current = '';
    $length = strlen($sql);
    $quote = null;
    $lineComment = false;
    $blockComment = false;

    for ($index = 0; $index < $length; $index++) {
        $char = $sql[$index];
        $next = $index + 1 < $length ? $sql[$index + 1] : '';

        if ($lineComment) {
            $current .= $char;
            if ($char === "\n") {
                $lineComment = false;
            }
            continue;
        }

        if ($blockComment) {
            $current .= $char;
            if ($char === '*' && $next === '/') {
                $current .= $next;
                $index++;
                $blockComment = false;
            }
            continue;
        }

        if ($quote !== null) {
            $current .= $char;
            if ($char === '\\' && $next !== '') {
                $current .= $next;
                $index++;
                continue;
            }
            if ($char === $quote) {
                $quote = null;
            }
            continue;
        }

        if ($char === '-' && $next === '-') {
            $current .= $char . $next;
            $index++;
            $lineComment = true;
            continue;
        }

        if ($char === '/' && $next === '*') {
            $current .= $char . $next;
            $index++;
            $blockComment = true;
            continue;
        }

        if ($char === '\'' || $char === '"') {
            $current .= $char;
            $quote = $char;
            continue;
        }

        if ($char === ';') {
            $statements[] = $current;
            $current = '';
            continue;
        }

        $current .= $char;
    }

    if (trim($current) !== '') {
        $statements[] = $current;
    }

    return $statements;
}

function removeSqlLineComments(string $statement): string
{
    $lines = preg_split('/\R/', $statement);
    if ($lines === false) {
        return $statement;
    }

    $keptLines = [];
    foreach ($lines as $line) {
        if (preg_match('/^\s*--/', $line) === 1) {
            continue;
        }
        $keptLines[] = $line;
    }

    return implode("\n", $keptLines);
}
