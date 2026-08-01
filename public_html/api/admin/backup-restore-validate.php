<?php
declare(strict_types=1);

require_once __DIR__ . '/backup-lib.php';

/**
 * V1 restore preparation only: accepts the files of a recovery package created by
 * this system (manifest.json, checksums.sha256, and the two encrypted archives),
 * stores them in a private staging directory outside public_html, and validates
 * their structure/checksums. It never extracts, decrypts, or applies anything —
 * live restore is intentionally not implemented yet.
 */

$admin = require_admin();
require_method('POST');
backup_ensure_tables();

if (empty($_FILES['package']) || !is_array($_FILES['package']['name'])) {
    json_error('Paket dosyaları bulunamadı. manifest.json, checksums.sha256 ve iki arşiv dosyasını birlikte seçin.');
}

$files = $_FILES['package'];
$count = count($files['name']);
if ($count < 1 || $count > 10) {
    json_error('Beklenmeyen dosya sayısı.');
}

$stagingRoot = backup_staging_dir();
$batchId = date('Ymd-His') . '-' . bin2hex(random_bytes(4));
$batchDir = $stagingRoot . '/' . $batchId;
if (!mkdir($batchDir, 0700, true)) {
    json_error('Geçici klasör oluşturulamadı.', 500);
}

$saved = [];
for ($i = 0; $i < $count; $i++) {
    if (($files['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        continue;
    }
    require_upload_size(['size' => $files['size'][$i] ?? 0], 4 * 1024 * 1024 * 1024);

    $originalName = basename((string) $files['name'][$i]);
    // Reject path traversal / hidden separators outright — never trust the client filename beyond its basename.
    if ($originalName === '' || strpos($originalName, '..') !== false || preg_match('/[\/\\\\\x00]/', (string) $files['name'][$i])) {
        json_error('Geçersiz dosya adı: ' . $originalName);
    }

    $destPath = $batchDir . '/' . $originalName;
    if (!move_uploaded_file($files['tmp_name'][$i], $destPath)) {
        json_error('Dosya kaydedilemedi: ' . $originalName, 500);
    }
    $saved[$originalName] = $destPath;
}

if (!$saved) {
    backup_rrmdir($batchDir);
    json_error('Yüklenen geçerli dosya bulunamadı.');
}

$report = [
    'batch_id' => $batchId,
    'staged_files' => array_keys($saved),
    'manifest_found' => false,
    'manifest_version_ok' => false,
    'checksums_found' => false,
    'checksum_results' => [],
    'issues' => [],
    'valid' => false,
    'manifest' => null,
];

// Manifest checks
if (isset($saved['manifest.json'])) {
    $report['manifest_found'] = true;
    $manifestRaw = file_get_contents($saved['manifest.json']);
    $manifest = json_decode((string) $manifestRaw, true);
    if (!is_array($manifest)) {
        $report['issues'][] = 'manifest.json geçerli bir JSON değil.';
    } else {
        $report['manifest'] = $manifest;
        if ((string) ($manifest['package_version'] ?? '') === BACKUP_PACKAGE_VERSION) {
            $report['manifest_version_ok'] = true;
        } else {
            $report['issues'][] = 'Paket sürümü desteklenmiyor veya eksik (package_version).';
        }
        foreach (['created_at', 'archives', 'checksums'] as $key) {
            if (!isset($manifest[$key])) {
                $report['issues'][] = "manifest.json içinde '{$key}' alanı eksik.";
            }
        }
        if (isset($manifest['archives']) && is_array($manifest['archives'])) {
            foreach (backup_manifest_archive_name_issues($manifest) as $issue) {
                $report['issues'][] = $issue;
            }
        }
        if (($manifest['status'] ?? null) === 'partial') {
            $report['issues'][] = 'Bu paket tam bir yedek değildi (bazı veritabanı nesneleri dışa aktarılamamıştı) — manifest.status=partial.';
        }
    }
} else {
    $report['issues'][] = 'manifest.json bulunamadı.';
}

// Checksum checks
if (isset($saved['checksums.sha256'])) {
    $report['checksums_found'] = true;
    $lines = preg_split('/\r\n|\r|\n/', (string) file_get_contents($saved['checksums.sha256']));
    $expected = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        if (preg_match('/^([a-f0-9]{64})\s+\*?(.+)$/i', $line, $m)) {
            $expected[basename($m[2])] = strtolower($m[1]);
        }
    }
    if (!$expected) {
        $report['issues'][] = 'checksums.sha256 içinde geçerli satır bulunamadı.';
    }
    foreach ($expected as $filename => $expectedHash) {
        if (!isset($saved[$filename])) {
            $report['checksum_results'][] = ['file' => $filename, 'status' => 'missing'];
            $report['issues'][] = "Beklenen arşiv yüklenmedi: {$filename}";
            continue;
        }
        $size = filesize($saved[$filename]) ?: 0;
        if ($size === 0) {
            $report['checksum_results'][] = ['file' => $filename, 'status' => 'empty'];
            $report['issues'][] = "Arşiv boş: {$filename}";
            continue;
        }
        $actualHash = backup_checksum_file($saved[$filename]);
        $ok = hash_equals($expectedHash, $actualHash);
        $report['checksum_results'][] = [
            'file' => $filename,
            'status' => $ok ? 'match' : 'mismatch',
            'expected' => $expectedHash,
            'actual' => $actualHash,
            'size' => $size,
        ];
        if (!$ok) {
            $report['issues'][] = "Checksum uyuşmuyor: {$filename}";
        }
    }
} else {
    $report['issues'][] = 'checksums.sha256 bulunamadı.';
}

$report['valid'] = $report['manifest_found'] && $report['manifest_version_ok'] && $report['checksums_found'] && !$report['issues'];

backup_audit($admin, 'restore_validate', json_encode(['batch_id' => $batchId, 'valid' => $report['valid'], 'files' => array_keys($saved)]));
backup_log('Restore package validated by ' . ($admin['email'] ?? 'unknown') . ': batch=' . $batchId . ' valid=' . ($report['valid'] ? 'yes' : 'no'));

json_success(['report' => $report]);
