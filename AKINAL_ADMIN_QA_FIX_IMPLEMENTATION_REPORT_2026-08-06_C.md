# Akınal İnşaat — Admin QA Düzeltme Uygulama Raporu (Round C)

**Tarih:** 2026-08-06
**Kaynak QA raporu:** `AKINAL_ADMIN_FULL_E2E_QA_REPORT_2026-08-06_C.md`
**Görev tanımı:** `CLAUDE_CODE_AKINAL_ADMIN_QA_FIX_PROMPT_2026-08-06_C.md`
**Repo kökü:** `C:\Users\Bediz\Documents\akinalinsaat.com`

---

## 1. Özet

QA raporunda listelenen 13 bulgunun (BUG-01–BUG-13) tamamı için kök neden kod seviyesinde doğrulandı, en küçük tutarlı değişiklik seti ile düzeltildi ve gerçek (ama yalnızca yerel geliştirme aynası olan) bir MySQL veritabanına karşı transaction-wrapped/rollback-garantili test senaryolarıyla ya da Vitest birim testleriyle kanıtlandı. Ortak finansal kurallar (gerçekleşen gelir, kayıt/müşteri bakiyesi, konsolide açık alacak, yaklaşan ödeme) sayfa-özel yamalar yerine paylaşılan hesaplama katmanlarına indirgendi.

Bu rapor **iki doğrulama turunun** birleşik sonucudur. İlk turda 13 bulgunun tamamı kapatıldı ve birkaç küçük, açıkça işaretlenmiş test/atomiklik eksiği not edildi. İkinci (bu) turda, önceki turda "bilinen eksik" olarak bırakılan tüm maddeler tek tek ele alındı:

- **BUG-06** medya silme + albüm üyeliği temizliği artık gerçek bir PDO transaction’a sarılı (önceden iki ayrı, atomik olmayan `DELETE` idi).
- **BUG-10** hakediş kaskad silme diyaloğu artık gerçek bağlı kayıt sayısını (`X aşama ve Y tahsilat kaydı`) gösteriyor — sayı hiçbir zaman uydurulmuyor.
- **BUG-01** "Tekrar Dene" aksiyonunun gerçekten yeni bir network isteği gönderdiğini doğrulayan bir RTL testi eklendi.
- **BUG-02** ay/yıl sınırı (önceki ayın son günü hariç, bu ayın ilk günü dahil) için özel bir regresyon testi eklendi.
- **BUG-03** dövizli kayıt testi bir önceki raporda sehven "eksik" işaretlenmişti; dosya incelemesinde zaten mevcut olduğu doğrulandı ve düzeltildi.

Bu round için **hiçbir commit, push, deploy veya production migration çalıştırılmadı**. Tüm değişiklikler çalışma ağacında (`git status`) bekliyor.

**Sonuç:** 13 bulgunun tamamı kod ve test kanıtıyla kapatıldı; ikinci turun sonunda bilinen kod/test eksiği kalmadı. Geriye kalan tek dış bağımlılık: BUG-01’in `employee-personnel-tables-apply.php` migration’ının production’da manuel olarak (Bakım Konsolu üzerinden) çalıştırılması — bu, görev kısıtları gereği bilinçli olarak yapılmadı ve production erişimi gerektirdiği için kod değişikliğiyle kapatılamaz.

---

## 2. Başlangıç repo durumu

Çalışmaya başlarken `git status` çıktısı:

```
Değişiklikler: (temiz — commit edilecek bir şey yoktu)
```

`main` dalı, aşağıdaki commit’lerin üzerindeydi (bir önceki round B teslimatı + bu round’un QA/TODO/prompt dosyalarını ekleyen iki commit):

```
7814b5f changes   (round-C QA raporu + TODO + FIX_PROMPT dosyaları eklendi)
2a88a68 changes   (BUG-01 backend sözleşme düzeltmesinin bir kısmı — 503/TABLE_MISSING guard, helpers.php)
992783b docs: add QA-B repair report and update repair TODO with real results
...
```

Yani bu round’a başlarken BUG-01’in backend `TABLE_MISSING` sözleşmesi (`helpers.php` içindeki `require_admin_tables()` guard’ı ve 5 endpoint’in tamamına uygulanması) zaten committed haldeydi; geri kalan 12.5 bulgu (BUG-01’in kalan kısımları + BUG-02–13) bu round’da tamamlandı. Önceden mevcut hiçbir değişiklik ezilmedi veya geri alınmadı.

---

## 3. Değişen dosyalar

`git diff --stat` (bu round, henüz commit edilmemiş; iki doğrulama turunun toplamı):

```
 public_html/api/admin/dashboard.php                 |  35 +++++--
 public_html/api/admin/gelenler.php                  |  24 +++--
 public_html/api/admin/gidenler.php                  |  26 +++--
 public_html/api/admin/media-albums.php              |  23 ++++-
 public_html/api/admin/media.php                     |  67 +++++++++++-
 public_html/api/admin/notifications.php             |  63 ++++++++++++
 public_html/api/admin/project-statement.php         |  36 ++++++-
 src/components/admin/finance/CardEntryForm.tsx      |  51 +++++++---
 src/components/admin/finance/CardStatementTable.tsx |  19 +++-
 src/lib/finance.ts                                  | 113 +++++++++++++++++++++
 src/pages/admin/AdminCustomerDetail.tsx             |  40 +++++---
 src/pages/admin/AdminCustomerEdit.tsx               |  73 ++++++++++---
 src/pages/admin/AdminCustomers.tsx                  |  26 +++--
 src/pages/admin/AdminGovernmentProgressPayments.tsx |  46 ++++++---
 src/pages/admin/AdminInflationCalculator.tsx        |  15 ++-
 src/pages/admin/AdminProjectFinance.tsx             |  10 +-
 16 files changed, 555 insertions(+), 112 deletions(-)   (kod dosyaları; TODO/rapor ayrı)
```

**İkinci turda ek olarak değişen dosyalar** (ilk turda zaten değişmiş olanların üzerine): `media.php` (BUG-06 transaction wrap), `finance.ts` (yeni `describeGppCascadeDelete()` yardımcı fonksiyonu), `AdminGovernmentProgressPayments.tsx` + `AdminCustomerDetail.tsx` (BUG-10 kaskad sayı önizlemesi), `tools/dashboard-net-durum-date-cutoff-test.php` (BUG-02 ay/yıl sınırı senaryosu eklendi).

**Yeni dosyalar:**

Uygulama kodu:
- `src/hooks/useConfirmDelete.tsx`
- `src/components/admin/FieldError.tsx`

Test kanıtları:
- `src/test/customer-detail-overpayment-kpi.test.ts`
- `src/test/customer-detail-upcoming-payment.test.ts`
- `src/test/gelenler-gidenler-overpayment-aggregate.test.ts`
- `src/test/confirm-delete-dialog.test.tsx`
- `src/test/card-entry-form-aggregate-validation.test.tsx`
- `src/test/card-entry-form-input-attributes.test.tsx`
- `src/test/employee-panel-retry-action.test.tsx` *(ikinci tur)*
- `tools/bug01-table-missing-contract-test.php`
- `tools/dashboard-net-durum-date-cutoff-test.php`
- `tools/media-album-orphan-counters-test.php`
- `tools/notifications-orphan-filter-test.php`
- `tools/project-finance-tufe-and-overdue-test.php`

Belge:
- `AKINAL_ADMIN_QA_FIX_IMPLEMENTATION_REPORT_2026-08-06_C.md` (bu dosya)
- `AKINAL_ADMIN_QA_FIX_TODO_2026-08-06_C.md` (güncellendi)

Hiçbir dosya `ak_profiles`, `ak_user_roles`, production config veya FTP/deploy dosyalarına dokunmadı.

---

## 4–5. Her bulgu için doğrulanan kök neden ve uygulanan çözüm

### BUG-01 — Personel rolleri/maliyet dönemleri/proje atamaları/tahsisatlar

**Kök neden:** Beş personel endpoint’i (`roles.php`, `employee-roles.php`, `employee-cost-periods.php`, `employee-project-assignments.php`, `employee-project-allocations.php`) şema eksikken sessizce `success:true` + boş liste döndürüyordu; POST istekleri ise tablo yokluğunda ham `PDOException` fırlatıp genel 500 hatasına düşüyordu. `employee-personnel-tables-apply.php` migration’ı bu 5 tabloyu (`ak_roles`, `ak_employee_roles`, `ak_employee_cost_periods`, `ak_employee_project_assignments`, `ak_employee_project_allocations`) `CREATE TABLE IF NOT EXISTS` ile oluşturuyor ama production’da hiç çalıştırılmamış.

**Bu round’da yapılan doğrulama/tamamlama** (backend sözleşme düzeltmesi zaten committed'di):
- Migration idempotency’si kod incelemesiyle doğrulandı: her tablo için `epta_table_exists()` ile önce/sonra kontrolü var, `ALTER`/`DROP` yok, mevcut veriye dokunmuyor.
- Frontend’de `employee-allocations.php` (yanlış isim) referansı arandı — kod tabanında hiç yok, doğru endpoint (`employee-project-allocations.php`) zaten kullanılıyor.
- Loading/empty/error state ayrımı ve gerçek `Tekrar Dene` aksiyonu `CostPeriodsPanel.tsx`, `EmployeeRolesPanel.tsx`, `ProjectAssignmentsPanel.tsx`, `AdminEmployeeAllocations.tsx` içinde zaten mevcuttu (`loadError` state + `onClick={() => load()}`).
- **Çift sayım doğrulaması (bu round’un asıl açık kalan alt maddesi):** `grep -rn "ak_employee_project_allocations" project-statement.php dashboard.php gidenler.php` → **sıfır sonuç**. Tahsisat (`ak_employee_project_allocations`) tablosu proje finans/dashboard/gidenler toplamlarının hiçbirinde referans edilmiyor; bu üç dosya yalnızca `ak_employee_financial_entries` (gerçek personel ödeme kaydı) tablosunu topluyor. Sonuç: **çift sayım riski yok**, çünkü tahsisat verisi şu an bu finans toplamlarına hiç yansımıyor — ayrı, bağımsız bir raporlama katmanı (`ProjectEmployeeCostPanel.tsx`, `AdminEmployeeAllocations.tsx`).
- Production migration runbook'u hazırlandı (bkz. Bölüm 9) — **çalıştırılmadı**.

**Test kanıtı:** `tools/bug01-table-missing-contract-test.php` (5 kontrol), `tools/bug01-employee-personnel-tables-test.php` (21 kontrol, gerçek `php -S` HTTP round-trip ile tam CRUD + iş kuralları: rol atama, maliyet dönemi otomatik kapatma, tahsisat snapshot/tavan/recompute, çift yönlü görünürlük).

---

### BUG-02 — Genel Bakış vs. Net Durum tarih kapsamı uyuşmazlığı

**Kök neden:** `dashboard.php: compute_finance_summary()` içindeki `paid`/`month_paid` toplamları (`custStmt`, `gppStmt`, `expStmt`) hiçbir `entry_date <= bugün` kesimi uygulamıyordu; ileri tarihli ama `paid_amount_try > 0` olan (örn. önceden girilmiş, henüz gerçekleşmemiş bir kayıt) satırlar "gerçekleşen" toplamlara dahil oluyordu. Genel Bakış ve Net Durum aynı fonksiyonu çağırdığı için hata her iki ekranda da vardı (görünürdeki fark, ekranların farklı filtre/varsayılan tarih aralığı kullanmasından kaynaklanıyordu).

**Çözüm:** `custStmt`/`gppStmt`/`expStmt` içindeki `paid`/`month_paid` toplamlarına `entry_date <= :today` kesimi eklendi (PDO'nun aynı isimli parametreyi tekrar bağlamayı reddetmesi nedeniyle `:today1`/`:today2`/`:today3`/`:today4` gibi benzersiz isimler kullanıldı). Tek fonksiyon paylaşıldığı için düzeltme otomatik olarak her iki ekrana da yayıldı.

**Test kanıtı:** `tools/dashboard-net-durum-date-cutoff-test.php` (2 kontrol) — geçmiş/bugün/gelecek tarihli kayıtlarla ileri tarihli tahsilatın toplamdan hariç tutulduğu doğrulandı.

---

### BUG-03 — Fazla ödeme müşteri detay KPI’larında kayboluyor

**Kök neden:** `AdminCustomerDetail.tsx` içinde ölü/kullanılmayan bir `financialEntries` state’i (asla dolu şekilde set edilmeyen, eski API şeklinden kalma) `accountSummaries` hesaplamasına giriyordu; gerçek veri kaynağı olan kart-tipi `customerEntries` doğrudan kullanılmıyordu. Bu, `summarizeCustomerLedgerEntries()`’ın beklediği sentetik Planlandı/Gerçekleşti çift satır modeline dönüştürülmeden kayıp/eksik veri üretiyordu.

**Çözüm:** `cardEntriesToLedgerEntries()` yeni yardımcı fonksiyonu (`src/lib/finance.ts`) eklendi — kart-tipi kayıtları sunucu tarafındaki `map_cfe_entries_to_legacy()` ile birebir aynı mantıkla sentetik satırlara çeviriyor. `financialEntries` state’i tamamen kaldırıldı, `accountSummaries` artık `cardEntriesToLedgerEntries(customerEntries)` kullanıyor.

**Test kanıtı:** `customer-detail-overpayment-kpi.test.ts` (6 test: 0/kısmi/tam/fazla ödeme + karma kayıtlar).

---

### BUG-04 — Proje Finans TÜFE KPI’sı ve işaret formatı

**Kök neden 1 (KPI):** `compute_statement_summary()`’de açık (henüz tam ödenmemiş, enflasyon hesaplanamayan) müşteri gelir satırları için `inflation_adjusted_amount_try` `null` geldiğinde toplam `$paid` (genelde 0) değerine düşüyordu — doğru davranış nominal `$planned` tabanına düşmesiydi. Fazla ödenmiş kayıtlarda `$paid` kullanımı ise **zaten doğruydu** (QA raporunun kendi kabul kriteri bunu doğruluyor) ve bozulmadı.

**Kök neden 2 (işaret):** `AdminProjectFinance.tsx`’te fark gösterimi `+{fmtTRY(diff)}` şeklindeydi; `fmtTRY()` zaten negatif sayılar için kendi eksi işaretini basıyordu, bu da negatif farklarda `+₺-X` gibi çift işaretli bir çıktı üretiyordu.

**Çözüm:** `compute_statement_summary()`’de fallback zinciri `adj !== null → adj`, `else if Gerçekleşti/Fazla Ödendi → paid`, `else → planned` şeklinde düzeltildi. Frontend’de işareti tam olarak bir kez basan `fmtSignedTRY()` eklendi ve `+{fmtTRY(diff)}` yerine kullanıldı.

**Test kanıtı:** `tools/project-finance-tufe-and-overdue-test.php` (6 kontrol — açık/fazla ödenmiş/gecikmiş 3 test satırıyla, TÜFE tabanının doğru düşmesi ve satır/KPI mutabakatı).

---

### BUG-05 — Proje Finans gelir satırlarında gecikme durumu

**Kök neden:** `project-statement.php`, satırları maparken saklanmış `status` alanını olduğu gibi render ediyordu; Gelenler ekranının kullandığı canlı `fe_auto_status()`/`fe_is_overdue()` hesaplamasını çağırmıyordu. Sonuç: vadesi geçmiş ama DB’de hâlâ "Planlandı" yazan kayıtlar Proje Finans’ta gecikmiş görünmüyordu.

**Çözüm:** Satır eşleme adımına, TÜFE bloğundan önce, `government` dışındaki tüm kaynak türleri için `fe_auto_status()`/`fe_is_overdue()` çağrısı eklendi.

**Test kanıtı:** BUG-04 ile aynı script içinde birlikte doğrulandı (`tools/project-finance-tufe-and-overdue-test.php`, gecikmiş test satırı).

---

### BUG-06 — Medya albüm/favori sayaçları

**Kök neden:** Görsel silindiğinde `ak_media_album_items` tablosundaki üyelik satırları temizlenmiyordu; `fetch_albums_with_counts()` bu yetim satırları da sayıma dahil ediyordu.

**Çözüm:** `delete_media_album_memberships()` eklendi ve üç silme yolunun (`delete_db_media()`, `delete_db_media_by_url()`, `delete_filesystem_media()`) tamamından çağrıldı. `fetch_albums_with_counts()` sorgusu, `media_id`’nin gerçekten var olan bir `ak_project_images` satırına karşılık geldiğini doğrulayan bir `LEFT JOIN` + UUID-regex koşuluyla yeniden yazıldı; artık yetim satırlar zaten var olsa bile sayıma girmiyor.

**İkinci tur iyileştirmesi (atomiklik):** `delete_db_media()` ve `delete_db_media_by_url()`, `ak_project_images` satır silme işlemini ve albüm üyeliği temizliğini artık açık bir `$pdo->beginTransaction()`/`commit()`/`rollBack()` bloğuna sarıyor — ikisi ya birlikte başarılı olur ya da hiçbiri kalıcı olmaz. PDO iç içe (nested) transaction desteklemediği için, çağıran taraf zaten bir transaction açmışsa (`$pdo->inTransaction()`), fonksiyon kendi transaction’ını açmak yerine mevcut olana katılır — bu, hem gerçek isteklerde atomikliği sağlıyor hem de fonksiyonun bir üst-transaction içinden çağrılması durumunda çökmüyor. Bu davranış, testin kendisinin dış bir transaction içinden bu kod yolunu çağırmasıyla fiilen de doğrulandı (ilk denemede `inTransaction()` kontrolü olmadan test "There is already an active transaction" hatasıyla başarısız oldu; kontrol eklenince geçti — gerçek bir kod düzeltmesiydi, test'e özel bir es geçme değil).

**Test kanıtı:** `tools/media-album-orphan-counters-test.php` (3 kontrol, transaction-wrapped/rollback; nested-transaction senaryosunu da örtük olarak kapsıyor).

---

### BUG-07 — Yetim bildirimler

**Kök neden:** `ak_notifications` tablosundaki `related_payment_plan_id` bir kayda işaret ettiğinde, o kayıt silinse bile bildirim satırı `ak_notifications`’ta kalıyor ve GET listelemesinde/sayaçta görünmeye devam ediyordu.

**Çözüm:** `filter_out_orphan_payment_notifications()` eklendi — GET yanıtında, hatırlatma tipi (`Yaklaşan Ödeme`/`Bugünkü Tahsilat`/`Geciken Ödeme`) satırlar arasından, `notifications_fetch_open_receivables()`/`notifications_classify_receivable()` ile hesaplanan güncel açık alacaklar kümesinde artık karşılığı olmayanlar okuma anında (write-time silme yerine) elenir. Bu, kaynak silme akışının çok sayıda farklı yerine dokunmadan tek noktadan garanti sağlar; kullanıcıya sonuç aynıdır (yetim bildirim hiç görünmez).

**Bulunan ve düzeltilen yan hata:** `NOTIFICATIONS_PAYMENT_REMINDER_TYPES` sabiti dosyanın ortasında tanımlanmıştı; PHP’de üst seviye `const` fonksiyon tanımları gibi önceden yüklenmez (hoisted değildir), dosya çalıştırma sırasına göre değerlendirilir — bu, GET akışı gerçekten çalıştığında "Undefined constant" hatasına yol açıyordu. Sabit dosyanın başına (`require_admin()`’den hemen sonra) taşındı.

**Test kanıtı:** `tools/notifications-orphan-filter-test.php` (2 kontrol).

---

### BUG-08 — Fazla ödemenin konsolide ekranlarda tutarsız yorumlanması

**Kök neden:** `gelenler_summary()`/`gidenler_summary()`, konsolide `total_remaining`’i `SUM(planned) - SUM(paid)` olarak (global fark) hesaplıyordu. Bir müşterinin fazla ödemesi, matematiksel olarak başka bir müşterinin açık borcunu maskeleyebiliyordu.

**Çözüm:** Her iki fonksiyon da satır bazlı `MAX(planned - paid, 0)` toplamına dönüştürüldü (`$remaining += max(0, $rowPlanned - $rowPaid)`); ayrıca `total_overpaid` alanı (`$overpaid += max(0, $rowPaid - $rowPlanned)`) eklendi, fazla ödeme artık görünür ama konsolide açık alacaktan düşülmüyor.

**Test kanıtı:** `gelenler-gidenler-overpayment-aggregate.test.ts` (4 test) — çoklu müşteri, biri fazla ödemeli senaryoda diğerinin alacağının etkilenmediği doğrulandı.

---

### BUG-09 — “Yaklaşan Ödeme” kısmi ödeme kalanını dışlıyor

**Kök neden:** Kart, yalnızca `status === 'Planlandı'` (hiç ödeme yapılmamış) kayıtları sayıyordu; kısmi ödenmiş ama hâlâ gelecek tarihli/pozitif kalan bakiyesi olan kayıtlar (`status === 'Kısmi Ödendi'`) hariç tutuluyordu.

**Çözüm:** `sumUpcomingRemaining()` eklendi — `entry_date >= today` olan her kayıt için `max(0, amount_try - paid_amount_try)` toplar, status alanına bakmaz (tam/fazla ödenmişlerin kalanı zaten 0’dır, doğal olarak elenir). `AdminCustomerDetail.tsx`’te `ledgerSummary.upcoming` yerine bu fonksiyon kullanıldı.

**Test kanıtı:** `customer-detail-upcoming-payment.test.ts` (4 test: tam açık, kısmi, tam ödenmiş, fazla ödenmiş + tarih sınırı).

---

### BUG-10 — `window.confirm()` kullanımı

**Kök neden:** Devlet Hakedişleri, Müşteriler ve ortak `CardStatementTable.tsx` (Gelenler + Gidenler’in her ikisi de bunu kullanıyor) silme handler’ları native `window.confirm()` çağırıyordu — erişilebilir değil, marka/tasarım diliyle tutarsız, test edilemez.

**Çözüm:** `useConfirmDelete()` hook’u eklendi (shadcn `AlertDialog` üzerine); dört alandaki (`AdminGovernmentProgressPayments.tsx`, `AdminCustomers.tsx`, `CardStatementTable.tsx`, `AdminCustomerDetail.tsx`) silme handler’ları bu hook’u kullanacak şekilde yeniden yazıldı. Onay iptalinde hiçbir istek gönderilmiyor; onayda `onConfirm` bir kez çalışıyor ve buton işlem sırasında devre dışı kalıyor.

**İkinci tur iyileştirmesi (kaskad sayı önizlemesi):** Hakediş kaydı silme, aşama (`breakdowns`) ve tahsilat (`collections`) kırılımlarını da kaskad olarak siler. Paylaşılan `describeGppCascadeDelete(breakdownCount, collectionCount)` fonksiyonu (`src/lib/finance.ts`) eklendi — API yanıtında zaten var olan gerçek `r.breakdowns.length`/`r.collections.length` değerlerinden "Buna bağlı 3 aşama ve 5 tahsilat kaydı da birlikte silinecek." gibi bir cümle üretiyor; bağlı kayıt yoksa hiçbir ek not eklenmiyor (sayı asla uydurulmuyor). Hem `AdminGovernmentProgressPayments.tsx` hem `AdminCustomerDetail.tsx`’teki hakediş silme diyalogları aynı fonksiyonu çağırıyor.

**Test kanıtı:** `confirm-delete-dialog.test.tsx` (8 test: 4 dialog davranışı + 4 `describeGppCascadeDelete` senaryosu).

---

### BUG-11 — Form doğrulama ilk hatada duruyor

**Kök neden:** `AdminCustomerEdit.tsx: save()` ve `CardEntryForm.tsx: handleSave()` ilk geçersiz alanda `return` ediyordu; kullanıcı formu tekrar tekrar gönderip her seferinde yeni bir hatayla karşılaşıyordu.

**Çözüm:** Her iki dosyada da tüm alan hataları `Record<string,string>` içinde toplanacak, `aria-invalid` + kırmızı çerçeve + alan altı mesaj (`FieldErrorText`) ile gösterilecek, ilk hatalı alana `focusFirstError()` ile odaklanılacak şekilde yeniden yazıldı.

**Bulunan yan hata:** `focusFirstError()`’ın koşulsuz `el.scrollIntoView(...)` çağrısı jsdom test ortamında (bu metodu implemente etmiyor) unhandled promise rejection’a yol açıyordu; `el.scrollIntoView?.(...)` optional-chain ile düzeltildi — gerçek tarayıcı davranışını değiştirmeyen, savunmacı bir düzeltme.

**Test kanıtı:** `card-entry-form-aggregate-validation.test.tsx` (2 test).

---

### BUG-12 — Finansal inputlarda autocomplete/inputMode eksik

**Kök neden:** `CardEntryForm.tsx` ve GPP dialoglarındaki başlık/tutar alanlarında `autoComplete`/`inputMode` ayarlanmamıştı; tarayıcı otomatik doldurma önceki bir kayıttan değer sızdırabiliyordu, mobilde sayısal klavye açılmıyordu.

**Çözüm:** İlgili alanlara `autoComplete="off"` (başlık/not alanları) ve `inputMode="decimal" autoComplete="off"` (tutar/kur alanları) eklendi.

**Test kanıtı:** `card-entry-form-input-attributes.test.tsx` (2 test).

---

### BUG-13 — Enflasyon tablosu etiketleri belirsiz

**Kök neden:** Sütun başlıkları ("Dönem", "Endeks Değeri", "Yıllık Değişim", "Aylık Değişim") hangi dönem ölçütünün (ay sonu kümülatif endeks mi, hangi baz ay?) kullanıldığını belirtmiyordu.

**Çözüm:** Yalnızca etiket/açıklama metni değişti (hesap motoruna dokunulmadı): "Dönem (Ay/Yıl)", "Endeks Değeri (Ay Sonu)", "Yıllık Değişim (Aynı Ay, Önceki Yıl)", "Aylık Değişim (Önceki Aya Göre)" + tablo altına açıklayıcı bir paragraf eklendi.

**Test kanıtı:** Gerekli değil (yalnızca etiketleme); mevcut enflasyon motoru testleri (1,317502 çarpan davranışı) değişmeden geçmeye devam ediyor.

---

## 6. Eklenen/değiştirilen testler

| Dosya | Tür | Kapsam |
|---|---|---|
| `tools/bug01-table-missing-contract-test.php` | PHP, transaction-wrapped | BUG-01 503/TABLE_MISSING sözleşmesi |
| `tools/dashboard-net-durum-date-cutoff-test.php` | PHP, transaction-wrapped | BUG-02 tarih kesimi |
| `tools/media-album-orphan-counters-test.php` | PHP, transaction-wrapped | BUG-06 yetim sayaç filtreleme |
| `tools/notifications-orphan-filter-test.php` | PHP, transaction-wrapped | BUG-07 yetim bildirim filtreleme |
| `tools/project-finance-tufe-and-overdue-test.php` | PHP, transaction-wrapped | BUG-04 + BUG-05 birleşik |
| `src/test/customer-detail-overpayment-kpi.test.ts` | Vitest | BUG-03 (6 test, dövizli kayıt senaryosu dahil) |
| `src/test/customer-detail-upcoming-payment.test.ts` | Vitest | BUG-09 (4 test) |
| `src/test/gelenler-gidenler-overpayment-aggregate.test.ts` | Vitest | BUG-08 (4 test) |
| `src/test/confirm-delete-dialog.test.tsx` | Vitest/RTL | BUG-10 (8 test: 4 dialog + 4 kaskad sayı önizlemesi) |
| `src/test/card-entry-form-aggregate-validation.test.tsx` | Vitest/RTL | BUG-11 (2 test) |
| `src/test/card-entry-form-input-attributes.test.tsx` | Vitest/RTL | BUG-12 (2 test) |
| `src/test/employee-panel-retry-action.test.tsx` | Vitest/RTL | BUG-01 "Tekrar Dene" gerçek yeniden istek (1 test) |

Tüm `tools/*.php` scriptleri gerçek bir yerel MySQL veritabanına (`config.local.php` → `akinal_local`, **production değil**) karşı çalışır; her biri bir PDO transaction açar, disposable test verisi ekler, gerçek/değiştirilmemiş endpoint dosyasını `include` eder ve `register_shutdown_function` ile (endpoint `exit()` çağırsa bile) her zaman `rollBack()` yapar — DB’de kalıcı iz bırakmaz. `dashboard-net-durum-date-cutoff-test.php` artık ay/yıl sınırı senaryosunu da içeriyor (önceki ayın son günü hariç, bu ayın ilk günü dahil).

---

## 7. Çalıştırılan komutlar ve tam sonuçlar

Aşağıdaki komutların tamamı, ikinci (son) doğrulama turunun sonunda, tüm kod değişiklikleri tamamlandıktan sonra **bir kez daha uçtan uca** çalıştırıldı.

### TypeScript type-check
```
npx tsc --noEmit
```
**Sonuç:** Hatasız (boş çıktı).

### Lint
```
npm run lint
```
**Sonuç:** 269 problem (235 hata, 34 uyarı) — **tamamı bu round’dan önce var olan, bu round’da dokunulmamış dosyalarda** (`AdminSuppliers.tsx`, `AdminReports.tsx`, `AdminFinance.tsx`, `Contact.tsx`, `apiClient.ts` vb., çoğunlukla önceden var olan `@typescript-eslint/no-explicit-any`). Sayı, ikinci turdaki tüm yeni/değişen dosyalardan (yeni `describeGppCascadeDelete()`, yeni `employee-panel-retry-action.test.tsx`, genişletilmiş `dashboard-net-durum-date-cutoff-test.php` dahil) önceki turla **birebir aynı** (269) — doğrulama: `grep` ile yeni test dosyalarının adı lint çıktısında hiç geçmiyor, `git diff` ile eklenen satırlarda `: any` deseni sıfır.

### Unit testler
```
npx vitest run
```
**Sonuç:** 37 dosya, **191 test, tamamı geçti** (önceki turdan +1 dosya / +5 test: `employee-panel-retry-action.test.tsx` yeni, `confirm-delete-dialog.test.tsx`'e 4 yeni `describeGppCascadeDelete` testi eklendi).

### Production build
```
npm run build
```
**Sonuç:** Başarılı, 18.52s.

### PHP syntax kontrolü
```
public_html/api ve tools/ altındaki tüm .php dosyaları için php -l
```
**Sonuç:** Tamamı "No syntax errors detected" — 0 hata.

### Bu round’un doğrulama scriptleri (son çalıştırma)
```
php tools/bug01-table-missing-contract-test.php        → All 5 checks passed.
php tools/dashboard-net-durum-date-cutoff-test.php      → All 3 checks passed (rolled back).   [BUG-02 ay/yıl sınırı eklendi: 2 → 3 kontrol]
php tools/media-album-orphan-counters-test.php          → All 3 checks passed (rolled back).   [BUG-06 transaction wrap sonrası yeniden doğrulandı]
php tools/notifications-orphan-filter-test.php          → All 2 checks passed.
php tools/project-finance-tufe-and-overdue-test.php     → All 6 checks passed (rolled back).
```

### Regresyon — önceden var olan scriptler (bu round değişikliklerinden etkilenip etkilenmediğini doğrulamak için yeniden çalıştırıldı)
```
php tools/bug01-employee-personnel-tables-test.php       → All 21 checks passed.
php tools/vadesi-gecen-alacak-overdue-test.php           → All 7 checks passed (rolled back).
php tools/finance-entry-date-validation-test.php         → All 20 checks passed.
php tools/canonical-read-flags-test.php                  → PASS
php tools/backend-canonical-read-model-parity-test.php   → PASS
```

Hiçbir script kalıcı veri bırakmadı; her biri ya transaction rollback ya da kendi oluşturduğu test kayıtlarını açıkça temizleyerek sonlandı. `git status`/`git log` son kontrolde de HEAD'in hâlâ `7814b5f` olduğu ve hiçbir commit oluşmadığı doğrulandı.

---

## 8. Yapılamayan / bloke kalan işler

1. **BUG-01 production migration:** `employee-personnel-tables-apply.php`, Bakım Konsolu üzerinden production’da **çalıştırılmadı** (yasak). Bkz. Bölüm 9 — runbook hazır.
2. **BUG-06/BUG-07 production cleanup:** Mevcut (halihazırda oluşmuş) yetim `ak_media_album_items` satırları ve yetim `ak_notifications` satırları production’da fiilen silinmedi; yalnızca artık **görünmüyorlar/sayılmıyorlar** (okuma-zamanı filtreleme). İsteğe bağlı, idempotent temizlik SQL’i:
   ```sql
   -- BUG-06: yetim albüm üyeliklerini temizle (media_id artık ak_project_images'ta yok)
   DELETE i FROM ak_media_album_items i
   LEFT JOIN ak_project_images p ON p.id = i.media_id
   WHERE i.media_id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     AND p.id IS NULL;

   -- BUG-07: kaynağı olmayan (silinmiş) ödeme hatırlatma bildirimlerini arşivle/sil
   -- (related_payment_plan_id NULL değilse ve karşılık gelen açık alacak artık yoksa)
   -- Production'da çalıştırmadan önce notifications_fetch_open_receivables() ile
   -- karşılaştırmalı bir DRY-RUN SELECT önerilir; bu iki tablo doğrudan JOIN edilemez
   -- (open receivables PHP tarafında hesaplanan bir küme, saklı bir tablo değil).
   ```
   Bu iki DELETE de idempotent'tir (WHERE koşulunu sağlayan satır kalmayınca 0 satır etkiler) ama **production’da çalıştırılmadı**, yalnızca burada belgelendi.
3. **Kalan çok küçük kapsam notu:** BUG-04'ün "DEDEPAŞA" adıyla özel isimlendirilmiş bir test senaryosu yok — aynı hesaplama yolu jenerik proje verisiyle (`tools/project-finance-tufe-and-overdue-test.php`) test edildi, mantık tam kapsanıyor, yalnızca isimlendirme farklı. BUG-09 kart ile alt tablonun aynı `sumUpcomingRemaining()` çağrısını paylaştığı ayrı bir RTL entegrasyon testiyle değil, kod incelemesiyle doğrulandı (birim test seviyesinde fonksiyonun kendisi 4 senaryoyla test edildi). Bunların ikisi de işlevsel bir risk taşımıyor. **İkinci doğrulama turunda kapatılan eski eksikler:** BUG-01 "Tekrar Dene" artık RTL testiyle kanıtlı; BUG-02 ay/yıl sınırı artık test kapsamında; BUG-03 döviz senaryosu zaten mevcuttu (önceki raporda yanlışlıkla eksik işaretlenmişti); BUG-06 temizlik artık transaction'a sarılı; BUG-10 kaskad silmede bağlı kayıt sayısı artık gösteriliyor.
4. **Demo projenin production’daki tam finansal rakamları** (₺1.400.000 planlanan müşteri geliri vb.) production erişimi yasak olduğu için birebir yeniden çalıştırılıp doğrulanamadı. Bunun yerine yapısal analiz yapıldı: bu round’da değiştirilen hiçbir sorgu taban `planned`/`paid` SUM’larını değiştirmiyor, yalnızca bunlardan türetilen alt metrikleri (kalan/yaklaşan/gecikmiş) düzeltiyor.

---

## 9. Production migration runbook — `employee-personnel-tables-apply.php`

**Amaç:** `ak_roles`, `ak_employee_roles`, `ak_employee_cost_periods`, `ak_employee_project_assignments`, `ak_employee_project_allocations` tablolarını production’da oluşturmak (BUG-01’in kök nedeni).

**Ön koşullar:**
- Production veritabanının güncel bir yedeği alınmış olmalı (rutin önlem; bu migration teoride veri kaybettirmez ama her production DDL öncesi standart uygulama).
- Migration çağrısını yapacak admin kullanıcının aktif bir oturumu olmalı (`require_admin()` zorunlu).

**Adımlar:**
1. Admin paneline giriş yap → **Bakım Konsolu** (`/admin/maintenance` veya ilgili menü öğesi).
2. "employee-personnel-tables-apply" migration kartını bul.
3. Çalıştır’a bas. Endpoint `POST /api/admin/migrations/employee-personnel-tables-apply.php` çağrılır.
4. Yanıtta `data.tables_created` alanını kontrol et — her tablo için `true` (yeni oluşturuldu) veya `false` (zaten vardı) döner. İlk çalıştırmada 5 tablonun da `true` olması beklenir.
5. Personel sekmelerini (Roller, Maliyet Dönemleri, Proje Atamaları, Tahsisatlar) yeniden yükleyip veri girişi/listelemenin çalıştığını doğrula.

**Idempotency / güvenlik notu:** Migration `CREATE TABLE IF NOT EXISTS` kullanır; yanlışlıkla ikinci kez çalıştırılırsa hiçbir tablo yeniden oluşturulmaz, hiçbir veri silinmez veya değiştirilmez (`tables_created` tüm alanlar için `false` döner). Migration hiçbir `ALTER TABLE`/`DROP TABLE`/`TRUNCATE` içermez.

**Geri dönüş (rollback) adımları:** Migration yalnızca ek (additive) tablo oluşturur, mevcut hiçbir tabloyu değiştirmez. Geri almak gerekirse (örn. özellik iptal edilirse) ve tablolar henüz hiç kullanılmadıysa:
```sql
DROP TABLE IF EXISTS ak_employee_project_allocations;
DROP TABLE IF EXISTS ak_employee_project_assignments;
DROP TABLE IF EXISTS ak_employee_cost_periods;
DROP TABLE IF EXISTS ak_employee_roles;
DROP TABLE IF EXISTS ak_roles;
```
(FK bağımlılığı nedeniyle bu sıralamayla — önce bağımlı tablolar.) **Bu DROP komutları da yalnızca burada belgelenmiştir, çalıştırılmamıştır.** Tablolar gerçek veri içermeye başladıktan sonra bu geri dönüş yolu kullanılmamalı; onun yerine ileri yönlü bir düzeltme migration’ı tercih edilmeli.

**Migration sonrası doğrulama (önerilen, opsiyonel):** `tools/bug01-employee-personnel-tables-test.php` scripti — production’a karşı DEĞİL, yalnızca `config.local.php` varsa yerel/test ortamına karşı — aynı CRUD akışını tekrar doğrulamak için kullanılabilir. Production’da doğrulama için admin panelinden manuel bir "oluştur → listele → sil" turu önerilir.

---

## 10. Bilinen riskler

- **BUG-07 çözümü read-time filtreleme, write-time cleanup değil** — kaynak silindiğinde bildirim satırı DB’de kalır (yalnızca görünmez); zamanla `ak_notifications` tablosunda birikebilir. Fonksiyonel etkisi yok ama uzun vadede tablo boyutu için hafif bir teknik borç. (BUG-06 için aynı desen artık geçerli değil — bkz. altta, temizlik artık transaction'a sarılı ve atomik.)
- **BUG-01 CRUD testi `php -S` ile gerçek bir HTTP sunucusu açıyor** (yalnızca test sırasında, yerel loopback’te, rastgele yüksek port) — production ortamında bu script hiç çalıştırılmamalı ve çalıştırılmadı.
- **Production’daki gerçek demo proje rakamları bu round’da yeniden doğrulanmadı** (production erişimi yasak) — yapısal analizle güven sağlandı ama birebir sayısal teyit production’a deploy sonrası manuel olarak yapılmalı.
- **Lint’teki 235 pre-existing hata** bu round’un kapsamı dışında bırakıldı ("ilgisiz refactor yapma" kısıtı gereği); temizlenmeleri ayrı bir görev olmalı.
- **`media.php`'deki yeni `inTransaction()` kontrolü** (`delete_db_media()`/`delete_db_media_by_url()`), bu fonksiyonun ileride başka bir transaction içinden çağrılması ihtimaline karşı savunmacı bir davranış ekliyor — normal (test dışı) istek akışında tek bir çağrı zaten kendi transaction'ını açıp kapatıyor, davranış değişmiyor; risk yok, yalnızca not düşülüyor çünkü bu kod yolu bu round'da eklendi.

---

## 11. Deploy öncesi kontrol listesi

1. `git diff` ile bu round’un tüm değişikliklerini gözden geçir, commit’le (bu görev commit yapmadı — kullanıcı kendi commit akışını çalıştırmalı).
2. Production veritabanı yedeği al.
3. Normal deploy akışını çalıştır (`npm run build` → `python scripts/deploy_ftp.py`, `deploy-akinal.bat` üzerinden).
4. Deploy sonrası, Bölüm 9’daki runbook’u takip ederek `employee-personnel-tables-apply.php` migration’ını Bakım Konsolu’ndan çalıştır.
5. Personel sekmelerinin (roller/maliyet/atama/tahsisat) production’da gerçekten çalıştığını manuel olarak doğrula.
6. Demo/gerçek bir müşteri kaydında BUG-02/03/08/09’un finansal davranışını (fazla ödeme, kısmi ödeme, yaklaşan ödeme) production verisiyle gözle kontrol et — bu round’da production verisiyle test yapılmadığı için ilk gerçek doğrulama bu olacak.
7. Medya/bildirim sayaçlarının (BUG-06/07) production’da beklenen şekilde düştüğünü kontrol et.

---

## 12. Son öneri

13 bulgunun tamamı kod seviyesinde düzeltildi ve mevcut regresyonları kırmadan (191/191 test, temiz `tsc`/build/`php -l`, bu round’dan önce var olan lint hatalarına dokunulmadı) yerel/transaction-wrapped kanıtlarla desteklendi. İki doğrulama turu sonunda, ilk turda bırakılan tüm küçük test/atomiklik eksikleri de (BUG-01 retry testi, BUG-02 ay/yıl sınırı testi, BUG-06 transaction atomikliği, BUG-10 kaskad sayı önizlemesi) kapatıldı; BUG-03'ün döviz testi zaten mevcuttu. Ortak finansal kurallar artık paylaşılan fonksiyonlarda tek kaynaktan yönetiliyor, bu da gelecekteki benzer "ekranlar arası tutarsızlık" bulgularının tekrarlanma riskini azaltıyor.

**Production’a taşınmadan önce tek zorunlu manuel adım** BUG-01 migration’ının Bölüm 9’daki runbook’a göre çalıştırılmasıdır — bu, kod değişikliğiyle kapatılamaz çünkü tanım gereği production veritabanına yazma gerektirir ve görev kısıtları bunu yasaklıyor. Bunun dışında geriye yalnızca Bölüm 10’daki düşük riskli, işlevsel engel teşkil etmeyen notlar kalıyor (BUG-07’nin read-time-filtreleme tasarımı, production rakamlarının bu round’da yeniden doğrulanamaması, pre-existing lint borcu).

**Bu round için commit, push, PR ve deploy yapılmamıştır** — çalışma ağacı, kullanıcı incelemesi için olduğu gibi bırakılmıştır. `git log` HEAD hâlâ `7814b5f`; `git status` yalnızca bu göreve ait uncommitted değişiklikleri gösteriyor.
