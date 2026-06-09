<?php
declare(strict_types=1);

function json_success(array $data = [], int $status = 200): void
{
    send_json_headers($status);
    echo json_encode([
        'success' => true,
        'data' => $data,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400, $details = null): void
{
    send_json_headers($status);

    $payload = [
        'success' => false,
        'message' => $message,
    ];

    if ($details !== null) {
        $payload['details'] = $details;
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function send_json_headers(int $status): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    // Same-domain deployment does not require wildcard CORS headers.
}

function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        header('Allow: ' . $method);
        json_error('İstek yöntemi desteklenmiyor.', 405);
    }
}
