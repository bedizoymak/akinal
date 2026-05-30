<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../auth.php';

require_method('POST');

logout_admin_session();

json_success(['logged_out' => true]);
