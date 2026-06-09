<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();
require_method('POST');

if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
    json_error('Yüklenecek dosya bulunamadı.');
}

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_error('Dosya yüklenemedi.');
}
require_upload_size($file, 2 * 1024 * 1024);

$tmpName = (string) ($file['tmp_name'] ?? '');
$originalName = basename((string) ($file['name'] ?? 'site-asset'));
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$mime = mime_content_type($tmpName) ?: '';
$allowed = [
    'ico' => ['image/x-icon', 'image/vnd.microsoft.icon', 'application/octet-stream'],
    'png' => ['image/png'],
    'webp' => ['image/webp'],
];

if (!isset($allowed[$extension]) || !in_array($mime, $allowed[$extension], true)) {
    json_error('Sadece ICO, PNG veya WEBP dosyaları yüklenebilir.');
}

$baseDir = dirname(__DIR__, 2) . '/uploads/site';
if (!is_dir($baseDir) && !mkdir($baseDir, 0755, true)) {
    json_error('Yükleme klasörü oluşturulamadı.', 500);
}

$safeName = preg_replace('/[^a-zA-Z0-9._-]+/', '-', pathinfo($originalName, PATHINFO_FILENAME)) ?: 'site-asset';
$filename = date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '-' . $safeName . '.' . $extension;
$target = $baseDir . '/' . $filename;

if (!move_uploaded_file($tmpName, $target)) {
    json_error('Dosya kaydedilemedi.', 500);
}

json_success([
    'url' => '/uploads/site/' . $filename,
    'file_name' => $filename,
], 201);
