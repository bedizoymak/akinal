<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

require_method('GET');

try {
    $statement = db()->query('SELECT * FROM ak_site_settings ORDER BY updated_at DESC LIMIT 1');
    $settings = $statement->fetch() ?: [];

    json_success(['settings' => $settings]);
} catch (Throwable $exception) {
    json_error('Unable to load site settings.', 500);
}
