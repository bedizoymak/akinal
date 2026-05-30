<?php
declare(strict_types=1);

require_once __DIR__ . '/response.php';

$configPath = __DIR__ . '/config.php';

if (!is_file($configPath)) {
    json_error('API configuration file is missing. Copy config.example.php to config.php on the server.', 500);
}

require_once $configPath;

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (!extension_loaded('pdo_mysql')) {
        json_error('Database driver is unavailable.', 500);
    }

    foreach (['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'] as $constant) {
        if (!defined($constant)) {
            json_error('API database configuration is incomplete.', 500);
        }
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (Throwable $exception) {
        json_error('Database connection failed.', 500);
    }

    return $pdo;
}
