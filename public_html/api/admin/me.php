<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../auth.php';

require_method('GET');

json_success([
    'admin' => require_admin(),
]);
