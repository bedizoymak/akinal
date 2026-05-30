<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

require_method('GET');

try {
    ensure_public_favicon_column();

    $statement = db()->query('SELECT * FROM ak_site_settings ORDER BY updated_at DESC LIMIT 1');
    $settings = $statement->fetch() ?: [];

    json_success(['settings' => $settings]);
} catch (Throwable $exception) {
    json_error('Unable to load site settings.', 500);
}

function ensure_public_favicon_column(): void
{
    try {
        $statement = db()->query("SHOW COLUMNS FROM ak_site_settings LIKE 'favicon_url'");
        if ($statement->fetch()) {
            return;
        }
        db()->exec('ALTER TABLE ak_site_settings ADD COLUMN favicon_url VARCHAR(500) NULL AFTER hero_subtitle');
    } catch (Throwable $exception) {
        // Keep public settings readable even if the database user cannot alter schema.
    }
}
