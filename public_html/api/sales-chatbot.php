<?php
declare(strict_types=1);

require_once __DIR__ . '/response.php';

require_method('POST');

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    json_error('Invalid JSON payload.');
}

$message = trim((string) ($input['message'] ?? ''));
if ($message === '') {
    json_error('Message is required.');
}

if (strlen($message) > 2000) {
    json_error('Message is too long.');
}

// No backend AI provider is configured in this PHP/MySQL migration phase.
// The frontend keeps its deterministic local fallback response when reply is null.
json_success([
    'reply' => null,
    'fallback' => true,
]);
