<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/canonical-read-flags.php';

require_admin();
require_method('GET');

try {
    json_success([
        'canonical_read_model' => canonical_read_diagnostics(db()),
    ]);
} catch (Throwable $exception) {
    json_error('Canonical read diagnostics could not be generated.', 500);
}
