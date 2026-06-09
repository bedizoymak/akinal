<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    ensure_site_settings_favicon_column();

    if ($method === 'GET') {
        $statement = db()->query('SELECT * FROM ak_site_settings ORDER BY updated_at DESC LIMIT 1');
        json_success(['settings' => $statement->fetch() ?: null]);
    }

    if ($method !== 'PATCH' && $method !== 'POST') {
        header('Allow: GET, PATCH, POST');
        json_error('İstek yöntemi desteklenmiyor.', 405);
    }

    $input = read_admin_json_body();
    $id = require_non_empty($input, 'id', 'Site ayar kaydı bulunamadı.');
    $fields = [
        'company_name',
        'phone',
        'whatsapp_number',
        'email',
        'address',
        'map_embed_url',
        'instagram_url',
        'facebook_url',
        'linkedin_url',
        'footer_description',
        'hero_title',
        'hero_subtitle',
        'favicon_url',
        'whatsapp_message',
        'seo_title',
        'seo_description',
    ];

    $sets = [];
    $params = ['id' => $id];
    foreach ($fields as $field) {
        if (array_key_exists($field, $input)) {
            $sets[] = "`{$field}` = :{$field}";
            $params[$field] = $field === 'company_name'
                ? require_non_empty($input, $field, 'Firma adı zorunludur.')
                : nullable_string($input, $field);
        }
    }

    if ($sets === []) {
        json_error('Güncellenecek alan bulunamadı.');
    }

    $sql = 'UPDATE ak_site_settings SET ' . implode(', ', $sets) . ' WHERE id = :id';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    $statement = db()->prepare('SELECT * FROM ak_site_settings WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $id]);
    json_success(['settings' => $statement->fetch() ?: null]);
} catch (Throwable $exception) {
    json_error('Site ayarları işlenemedi.', 500);
}

function ensure_site_settings_favicon_column(): void
{
    $statement = db()->query("SHOW COLUMNS FROM ak_site_settings LIKE 'favicon_url'");
    if ($statement->fetch()) {
        return;
    }

    db()->exec('ALTER TABLE ak_site_settings ADD COLUMN favicon_url VARCHAR(500) NULL AFTER hero_subtitle');
}
