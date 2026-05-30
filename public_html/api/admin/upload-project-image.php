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

$tmpName = (string) ($file['tmp_name'] ?? '');
$originalName = basename((string) ($file['name'] ?? 'image'));
$mime = mime_content_type($tmpName) ?: '';
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
];

if (!isset($allowed[$mime])) {
    json_error('Sadece JPG, PNG, WEBP veya GIF görseller yüklenebilir.');
}

$baseDir = dirname(__DIR__, 2) . '/uploads/project-images';
if (!is_dir($baseDir) && !mkdir($baseDir, 0755, true)) {
    json_error('Yükleme klasörü oluşturulamadı.', 500);
}

$safeName = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $originalName) ?: 'image';
$filename = date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '-' . $safeName;
$extension = '.' . $allowed[$mime];
if (substr(strtolower($filename), -strlen($extension)) !== $extension) {
    $filename .= '.' . $allowed[$mime];
}

$target = $baseDir . '/' . $filename;
if (!move_uploaded_file($tmpName, $target)) {
    json_error('Dosya kaydedilemedi.', 500);
}

json_success([
    'url' => '/uploads/project-images/' . $filename,
    'file_name' => $filename,
]);
