<?php
declare(strict_types=1);

/**
 * One-shot demo seed for Operations pages.
 * Tables: ak_contact_requests, ak_notifications
 *
 * Idempotent: INSERT IGNORE on fixed UUIDs — safe to run twice.
 * DELETE THIS FILE from the server immediately after a successful run.
 *
 * Usage:
 *   https://akinalinsaat.com/seed-demo-operations.php?confirm=SEED_OPERATIONS_DEMO
 */

require_once __DIR__ . '/api/db.php';

if (($_GET['confirm'] ?? '') !== 'SEED_OPERATIONS_DEMO') {
    http_response_code(403);
    echo "<pre>Locked. Run: seed-demo-operations.php?confirm=SEED_OPERATIONS_DEMO\n";
    echo "Delete this file immediately after a successful run.</pre>";
    exit;
}

$pdo = db();
$results = [];

// ── 1. ak_contact_requests ────────────────────────────────────────────────────

$contacts = [
    [
        'id'           => 'f47ac10b-58cc-4372-a567-0e02b2c3d001',
        'full_name'    => 'Mehmet Karaaslan',
        'phone'        => '0532 411 2233',
        'email'        => 'mehmet.karaaslan@gmail.com',
        'service_type' => 'Kentsel Dönüşüm',
        'message'      => "Merhaba, Fatih ilçesindeki apartmanımız 1975 yılı yapısı. Kentsel dönüşüm kapsamında değerlendirme yaptırmak istiyoruz. Ne zaman müsait olursunuz?",
        'status'       => 'Yeni',
        'created_at'   => '2026-06-20 09:14:00',
    ],
    [
        'id'           => 'f47ac10b-58cc-4372-a567-0e02b2c3d002',
        'full_name'    => 'Elif Şahin',
        'phone'        => '0541 622 3344',
        'email'        => 'elif.sahin@hotmail.com',
        'service_type' => 'Satış Sonrası Destek',
        'message'      => "3 ay önce anahtar teslim aldığımız dairenin balkon kapısında sızdırmazlık sorunu var. Teknik ekibinizin görmesini rica ediyorum.",
        'status'       => 'Arandı',
        'created_at'   => '2026-06-18 14:22:00',
    ],
    [
        'id'           => 'f47ac10b-58cc-4372-a567-0e02b2c3d003',
        'full_name'    => 'Hüseyin Doğan',
        'phone'        => '0535 733 4455',
        'email'        => null,
        'service_type' => 'Kat Karşılığı İnşaat',
        'message'      => "Üsküdar'da 6 daireli binamız var, yaklaşık 1970 yapımı. Kat karşılığı inşaat için teklif almak istiyoruz. Binanın tapusu temiz.",
        'status'       => 'Teklif Verildi',
        'created_at'   => '2026-06-15 10:45:00',
    ],
    [
        'id'           => 'f47ac10b-58cc-4372-a567-0e02b2c3d004',
        'full_name'    => 'Ayşe Korkmaz',
        'phone'        => '0544 844 5566',
        'email'        => 'ayse.korkmaz@outlook.com',
        'service_type' => 'Ruhsat ve Belediye',
        'message'      => "Belediyeye ruhsat başvurusu için hangi belgeler hazırlanmalı? İmar planı değişikliği konusunda da bilgi almak istiyorum.",
        'status'       => 'Yeni',
        'created_at'   => '2026-06-22 11:00:00',
    ],
    [
        'id'           => 'f47ac10b-58cc-4372-a567-0e02b2c3d005',
        'full_name'    => 'İbrahim Çelik',
        'phone'        => '0533 955 6677',
        'email'        => 'ibrahim.celik@yandex.com',
        'service_type' => 'Şantiye Ziyareti',
        'message'      => "Güneşli projesini yerinde görmek istiyorum. Ziyaret için müsait olduğunuz bir gün ve saat öğrenebilir miyim?",
        'status'       => 'Arandı',
        'created_at'   => '2026-06-21 16:30:00',
    ],
    [
        'id'           => 'f47ac10b-58cc-4372-a567-0e02b2c3d006',
        'full_name'    => 'Cengiz Polat',
        'phone'        => '0539 066 7788',
        'email'        => 'cengiz.polat@elektrik.com',
        'service_type' => 'Taşeron Başvurusu',
        'message'      => "Firmamız elektrik tesisat ve zayıf akım işleri konusunda uzmanlaşmış. Projelerinizde alt yüklenici olarak çalışmak üzere başvuru yapıyoruz. Referans listesi hazır.",
        'status'       => 'Tamamlandı',
        'created_at'   => '2026-06-10 08:55:00',
    ],
    [
        'id'           => 'f47ac10b-58cc-4372-a567-0e02b2c3d007',
        'full_name'    => 'Fatma Arslan',
        'phone'        => '0542 177 8899',
        'email'        => 'fatmaarslan@gmail.com',
        'service_type' => 'Satış Sonrası Destek',
        'message'      => "Geçen ay teslim aldığım 3+1 dairede mutfak dolabının menteşelerinde sorun oluştu. Ayrıca banyoda küçük bir sızıntı var. Teknik ekibinizin iletişime geçmesini bekliyorum.",
        'status'       => 'Arandı',
        'created_at'   => '2026-06-19 09:10:00',
    ],
    [
        'id'           => 'f47ac10b-58cc-4372-a567-0e02b2c3d008',
        'full_name'    => 'Kemal Yıldız',
        'phone'        => '0530 288 9900',
        'email'        => null,
        'service_type' => 'Genel Bilgi',
        'message'      => "Yeni projeleriniz hakkında bilgi almak istiyorum. Özellikle Kadıköy veya Üsküdar bölgesinde bir projeniz var mı? Broşür gönderebilirsiniz.",
        'status'       => 'Yeni',
        'created_at'   => '2026-06-23 13:45:00',
    ],
    [
        'id'           => 'f47ac10b-58cc-4372-a567-0e02b2c3d009',
        'full_name'    => 'Serap Güneş',
        'phone'        => '0546 399 0011',
        'email'        => 'serap.gunes@icloud.com',
        'service_type' => 'Kat Karşılığı İnşaat',
        'message'      => "Bakırköy'de 8 katlı eski binamız için yıkım ve yeniden inşaat düşünüyoruz. Kat karşılığı anlaşma yapabilir miyiz? Sözleşme süreci hakkında bilgi almak istiyorum.",
        'status'       => 'Teklif Verildi',
        'created_at'   => '2026-06-12 15:20:00',
    ],
    [
        'id'           => 'f47ac10b-58cc-4372-a567-0e02b2c3d00a',
        'full_name'    => 'Murat Tekin',
        'phone'        => '0537 400 1122',
        'email'        => 'murat.tekin@gmail.com',
        'service_type' => 'Proje Bilgisi',
        'message'      => "Sitenizde gördüğüm Akinal Residence projesi hakkında daha fazla bilgi almak istiyorum. Ön kayıt veya opsiyonel rezervasyon mümkün mü?",
        'status'       => 'Yeni',
        'created_at'   => '2026-06-24 10:05:00',
    ],
];

$stmt = $pdo->prepare(
    'INSERT IGNORE INTO ak_contact_requests
       (id, full_name, phone, email, service_type, message, status, created_at)
     VALUES
       (:id, :full_name, :phone, :email, :service_type, :message, :status, :created_at)'
);
$crInserted = 0;
$crSkipped = 0;
foreach ($contacts as $c) {
    $stmt->execute($c);
    if ($stmt->rowCount() > 0) {
        $crInserted++;
    } else {
        $crSkipped++;
    }
}
$results[] = "ak_contact_requests: inserted={$crInserted}, skipped={$crSkipped}";

// ── 2. ak_notifications ───────────────────────────────────────────────────────
// Avoids reserved payment types: 'Yaklaşan Ödeme', 'Bugünkü Tahsilat', 'Geciken Ödeme'
// (those are auto-managed by ensure_payment_notifications() in notifications.php)

$notifications = [
    [
        'id'                      => 'a1b2c3d4-e5f6-4789-a012-000000000001',
        'title'                   => 'Yaklaşan Müşteri Tahsilatı',
        'message'                 => 'Elif Şahin — 3. taksit ödemesi 5 gün içinde (02.07.2026) vadesi dolmaktadır. Kalan tutar: ₺180.000. Müşteri ile teyit görüşmesi yapılması önerilir.',
        'type'                    => 'Tahsilat Hatırlatması',
        'priority'                => 'Yüksek',
        'related_customer_id'     => null,
        'related_project_id'      => null,
        'related_payment_plan_id' => null,
        'is_read'                 => 0,
        'created_at'              => '2026-06-26 08:00:00',
    ],
    [
        'id'                      => 'a1b2c3d4-e5f6-4789-a012-000000000002',
        'title'                   => 'Geciken Müşteri Ödemesi',
        'message'                 => 'Hüseyin Doğan — Mayıs ayı taksiti 12 gündür tahsil edilemedi. Kalan bakiye: ₺95.000. Hukuki süreç başlatılmadan önce son bir iletişim denemesi yapılmalı.',
        'type'                    => 'Gecikmiş Tahsilat',
        'priority'                => 'Kritik',
        'related_customer_id'     => null,
        'related_project_id'      => null,
        'related_payment_plan_id' => null,
        'is_read'                 => 0,
        'created_at'              => '2026-06-25 09:30:00',
    ],
    [
        'id'                      => 'a1b2c3d4-e5f6-4789-a012-000000000003',
        'title'                   => 'Tedarikçi Fatura Ödeme Hatırlatması',
        'message'                 => 'Yılmaz Demir İnşaat Malzemeleri Ltd. — Haziran ayı faturaları toplamı ₺47.500, son ödeme tarihi 30.06.2026. Onay için muhasebe ile koordinasyon sağlanmalı.',
        'type'                    => 'Tedarikçi',
        'priority'                => 'Yüksek',
        'related_customer_id'     => null,
        'related_project_id'      => null,
        'related_payment_plan_id' => null,
        'is_read'                 => 1,
        'created_at'              => '2026-06-24 10:15:00',
    ],
    [
        'id'                      => 'a1b2c3d4-e5f6-4789-a012-000000000004',
        'title'                   => 'Haziran Maaş Ödemeleri',
        'message'                 => 'Haziran ayı personel maaşları 25 Haziran–1 Temmuz arasında ödenecek. Toplam 4 aktif personel etkilenmektedir. Bordro onayı bekleniyor.',
        'type'                    => 'Personel',
        'priority'                => 'Orta',
        'related_customer_id'     => null,
        'related_project_id'      => null,
        'related_payment_plan_id' => null,
        'is_read'                 => 1,
        'created_at'              => '2026-06-23 11:00:00',
    ],
    [
        'id'                      => 'a1b2c3d4-e5f6-4789-a012-000000000005',
        'title'                   => 'Yeni İletişim Talebi',
        'message'                 => 'Web formundan yeni iletişim talebi: Mehmet Karaaslan — Fatih\'teki apartman için kentsel dönüşüm bilgi talebi. 0532 411 2233',
        'type'                    => 'İletişim',
        'priority'                => 'Orta',
        'related_customer_id'     => null,
        'related_project_id'      => null,
        'related_payment_plan_id' => null,
        'is_read'                 => 0,
        'created_at'              => '2026-06-20 09:15:00',
    ],
    [
        'id'                      => 'a1b2c3d4-e5f6-4789-a012-000000000006',
        'title'                   => 'Proje Bütçe Uyarısı',
        'message'                 => 'Akinal Residence projesi — Haziran ayı harcamaları bütçenin %78\'ine ulaştı. Kalan bütçe: ₺220.000. Gider kalemleri için proje finans sayfasını inceleyin.',
        'type'                    => 'Proje',
        'priority'                => 'Orta',
        'related_customer_id'     => null,
        'related_project_id'      => null,
        'related_payment_plan_id' => null,
        'is_read'                 => 1,
        'created_at'              => '2026-06-22 14:45:00',
    ],
    [
        'id'                      => 'a1b2c3d4-e5f6-4789-a012-000000000007',
        'title'                   => 'Masraf Kartı Limit Uyarısı',
        'message'                 => 'Şantiye Avans Kartı — Bu ay ₺38.200 harcama gerçekleşti. Aylık limit hedefinin %95\'i tüketildi. Ek harcamalar için yönetici onayı gerekiyor.',
        'type'                    => 'Masraf Kartı',
        'priority'                => 'Yüksek',
        'related_customer_id'     => null,
        'related_project_id'      => null,
        'related_payment_plan_id' => null,
        'is_read'                 => 0,
        'created_at'              => '2026-06-26 07:30:00',
    ],
    [
        'id'                      => 'a1b2c3d4-e5f6-4789-a012-000000000008',
        'title'                   => 'Günlük Nakit Akış Özeti',
        'message'                 => '26 Haziran 2026 — Gelen: ₺0 | Giden: ₺12.400 | Net bugün: -₺12.400. Bu haftaki net nakit akışı: -₺31.750. Detaylar için finans sayfasını inceleyin.',
        'type'                    => 'Genel',
        'priority'                => 'Orta',
        'related_customer_id'     => null,
        'related_project_id'      => null,
        'related_payment_plan_id' => null,
        'is_read'                 => 1,
        'created_at'              => '2026-06-26 06:00:00',
    ],
];

$stmt = $pdo->prepare(
    'INSERT IGNORE INTO ak_notifications
       (id, title, message, type, priority,
        related_customer_id, related_project_id, related_payment_plan_id,
        is_read, created_at)
     VALUES
       (:id, :title, :message, :type, :priority,
        :related_customer_id, :related_project_id, :related_payment_plan_id,
        :is_read, :created_at)'
);
$ntInserted = 0;
$ntSkipped = 0;
foreach ($notifications as $n) {
    $stmt->execute($n);
    if ($stmt->rowCount() > 0) {
        $ntInserted++;
    } else {
        $ntSkipped++;
    }
}
$results[] = "ak_notifications: inserted={$ntInserted}, skipped={$ntSkipped}";

// ── Report ─────────────────────────────────────────────────────────────────────
echo "<pre>Demo operations seed complete.\n\n";
foreach ($results as $line) {
    echo $line . "\n";
}
echo "\nDelete this file (seed-demo-operations.php) from the server now.\n</pre>";
