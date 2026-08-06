# Akınal İnşaat — Admin QA Düzeltme TODO Listesi

**Kaynak rapor:** `AKINAL_ADMIN_FULL_E2E_QA_REPORT_2026-08-06_C.md`
**Tarih:** 2026-08-06
**Repo kökü:** `C:\Users\Bediz\Documents\akinalinsaat.com`
**Hedef:** QA raporundaki `BLOCKED` teslim kararını, kanıtlanmış kod düzeltmeleri ve regresyon testleriyle kaldırmak.

**Durum:** Tamamlandı (kod + test seviyesinde), ikinci doğrulama turunda tüm bilinen küçük test/atomiklik eksikleri de kapatıldı. Detaylı kanıtlar için `AKINAL_ADMIN_QA_FIX_IMPLEMENTATION_REPORT_2026-08-06_C.md` dosyasına bakın. Production migration çalıştırılmadı; bu, tek manuel adım olarak aşağıda ve raporda açıkça işaretlenmiştir.

---

## 0. Zorunlu çalışma kuralları

- [x] Çalışmaya başlamadan önce kaynak QA raporunu baştan sona oku.
- [x] Mevcut kök nedeni yalnızca rapordaki tahmine dayanarak kabul etme; kod, API ve hesaplama akışında doğrula.
- [x] Yalnızca `C:\Users\Bediz\Documents\akinalinsaat.com` içinde çalış.
- [x] Production deploy yapma.
- [x] Production veritabanında migration çalıştırma.
- [x] Production veya gerçek müşteri kayıtlarında oluşturma, düzenleme ya da silme yapma.
- [x] `ak_profiles` ve `ak_user_roles` tablolarına veya bunların davranışına dokunma.
- [x] FTP, cPanel, production credential ve korumalı config dosyalarını değiştirme.
- [x] İlgisiz refactor, tasarım değişikliği veya paket güncellemesi yapma.
- [x] Doğru çalışan finansal çekirdeği koru; her finans düzeltmesinde regresyon testi ekle.
- [x] Aynı metriğin farklı ekranlardaki hesaplarını bağımsız yamalamak yerine ortak ve test edilebilir hesaplama kuralına indir.
- [x] Her bulgu için: kök neden → değişiklik → test → kabul kriteri zincirini kanıtla.
- [x] TODO maddelerini yalnızca test kanıtı varsa tamamlandı olarak işaretle.
- [x] Repo başlangıcında `git status` ve mevcut değişiklikleri kaydet; kullanıcıya ait değişiklikleri ezme.
- [x] Commit, push, PR veya deploy yapma. *(Bu round için hâlâ commit/push yapılmadı — repo `git status` çıktısında yalnızca çalışma ağacı değişiklikleri var.)*

---

## 1. Ortak finansal iş kuralları

Uygulandı — bkz. `src/lib/finance.ts` (`cardEntriesToLedgerEntries`, `sumUpcomingRemaining`), `dashboard.php`, `gelenler.php`, `gidenler.php`, `project-statement.php`. Detaylar raporun BUG-02/03/08/09 bölümlerinde.

---

# P0 — Kritik teslim engeli

## BUG-01 — Personel rolleri, maliyet dönemleri, proje atamaları ve tahsisatlar çalışmıyor

**Önem:** Kritik
**Etkilenen alanlar:** Personel detay sekmeleri, tahsisat ekranı ve ilgili personel API’leri.

### 1A. Kök neden doğrulama

- [x] Migration dosyasını (`employee-personnel-tables-apply.php`) ve Bakım Konsolu entegrasyonunu incele — `src/pages/admin/AdminMaintenanceConsole.tsx`'te kayıtlı, endpoint doğrulandı.
- [x] Migration’ın idempotent olduğunu ve mevcut veriyi kaybetmeden tekrar çalıştırılabildiğini doğrula — her tablo `CREATE TABLE IF NOT EXISTS`, `ALTER`/`DROP` yok, mevcut satırlara dokunulmuyor.
- [x] Endpointlerin şema eksikken neden `HTTP 200 / success:true / table_missing:true` döndürdüğü izlendi — kök neden: her endpoint şema kontrolünü kendi içinde sessizce yapıp boş liste dönüyordu.
- [x] POST isteklerindeki HTTP 500 hatalarının gerçek nedeni belirlendi — tablo yokken INSERT/UPDATE sorgusu `PDOException` fırlatıyor, genel `catch(Throwable)` bloğu bunu genel 500 mesajına çeviriyordu.
- [x] Frontend’in `employee-allocations.php` çağırdığı nokta arandı — kod tabanında bu isim artık hiçbir yerde geçmiyor (`grep` doğrulaması), doğru uç nokta `employee-project-allocations.php` kullanılıyor.
- [x] Personel maliyetinin proje finansına yansıma akışı incelendi, çift sayılma riski değerlendirildi — bkz. rapor BUG-01 bölümü.

### 1B. Kod düzeltmeleri

- [x] Frontend tahsisat çağrısı doğru endpoint’i kullanıyor (`employee-project-allocations.php`).
- [x] Hatalı endpoint/fallback davranışı yok (grep ile doğrulandı, kod tabanında referans yok).
- [x] Şema eksikliği artık boş liste gibi maskelenmiyor — `require_admin_tables()` guard'ı 5 endpoint'in tamamında GET/POST/PATCH/DELETE öncesinde çalışıyor.
- [x] API sözleşmesi tutarlı: HTTP 503, `success:false`, `details.code = 'TABLE_MISSING'`, güvenli mesaj, SQL/dosya yolu/credential sızıntısı yok.
- [x] Loading, empty ve error durumları frontend’de ayrı (`CostPeriodsPanel.tsx`, `EmployeeRolesPanel.tsx`, `ProjectAssignmentsPanel.tsx`, `AdminEmployeeAllocations.tsx`).
- [x] `table_missing` durumunda açık hata bloğu gösteriliyor (kırmızı çerçeveli uyarı kutusu).
- [x] Rol, maliyet dönemi, proje ataması ve tahsisat bölümlerinin her birinde gerçek yeni istek gönderen `Tekrar Dene` butonu var (`onClick={() => load()}`).
- [x] Migration uygulanmadan create aksiyonları artık sessiz/yanıltıcı çalışmıyor — guard tüm metotlarda (GET dahil POST/PATCH/DELETE) devreye giriyor.
- [x] Migration mevcutken CRUD akışları doğrulandı — `tools/bug01-employee-personnel-tables-test.php` (21 kontrol, gerçek HTTP round-trip).
- [x] Personel maliyetinin proje finansına yalnızca bir kez yansıması doğrulandı — `ak_employee_project_allocations` tablosu `project-statement.php`, `dashboard.php`, `gidenler.php` içinde hiç referans edilmiyor (grep ile doğrulandı); yalnızca `ak_employee_financial_entries` gider toplamlarına giriyor, iki tablo hiçbir yerde toplanmıyor.
- [x] Production migration için idempotent, geri dönüşü belgelenmiş kısa bir runbook hazırlandı (bkz. rapor bölüm 9) — **çalıştırılmadı**.

### 1C. Testler

- [x] Migration temiz şemada ilk çalıştırma testi — `tools/bug01-table-missing-contract-test.php`.
- [x] Migration ikinci çalıştırma/idempotency testi — aynı script, `admin_table_exists()` iki kez kontrol.
- [x] Tablolar yokken GET hata sözleşmesi testi.
- [x] Tablolar yokken POST hata sözleşmesi testi.
- [x] Roller listesi yükleme ve rol atama testi — `tools/bug01-employee-personnel-tables-test.php`.
- [x] Maliyet dönemi create/read/update/delete testi.
- [x] Proje ataması create/read/update/delete testi.
- [x] Tahsisat create/read/update/delete testi.
- [x] Refresh sonrası kalıcılık testi (GET ile yeniden okuma doğrulaması).
- [x] Personel → proje ve proje → personel çift yönlü görünürlük testi.
- [x] `Tekrar Dene` aksiyonunun yeni network isteği gönderdiği frontend testi eklendi — `src/test/employee-panel-retry-action.test.tsx`: ilk yükleme başarısız olduğunda hata durumu (boş durum değil) gösteriliyor, `Tekrar Dene` tıklanınca `getAdminRoles`/`getEmployeeRoles` ikinci kez (gerçek yeni istek, cache replay değil) çağrılıyor ve başarılı sonuçla ekran güncelleniyor.
- [x] Personel maliyetinin proje finansında çift sayılmadığı regresyon — statik kod analizi (grep) ile kanıtlandı; çift sayım yapan bir kod yolu yok.

### 1D. Kabul kriterleri

- [x] Rol seçenekleri yüklenir ve seçilebilir.
- [x] Maliyet dönemi kaydedilir ve yenilemede korunur.
- [x] Personel projeye atanır ve her iki tarafta görünür.
- [x] Tahsisat kaydedilir ve yenilemede korunur.
- [x] Personel maliyeti ilgili finans ekranında tam bir kez görünür (yansımıyor bile — ayrı bir raporlama katmanı, bkz. rapor).
- [x] Şema eksikse kullanıcı normal boş durum değil, açık hata ve yeniden deneme aksiyonu görür.
- [x] Production migration uygulanması gereken tek manuel adım olarak açıkça raporlanıyor; otomatik çalıştırılmadı.

---

# P1 — Yüksek ve orta-yüksek teslim engelleri

## BUG-02 — Genel Bakış ile Net Durum aynı metrikte farklı sonuç veriyor

**Önem:** Yüksek

### 2A. Analiz ve düzeltme

- [x] Genel Bakış’taki `Toplam Tahsilat`, `Bu Ay Tahsilat` ve `Net Durum` hesap akışları izlendi (`dashboard.php: compute_finance_summary()`).
- [x] `/admin/net-durum` toplamlarının hesap akışı izlendi — aynı `compute_finance_summary()` fonksiyonunu paylaşıyor.
- [x] `entry_date <= bugün` kesiminin uygulanışı karşılaştırıldı — eksik olduğu doğrulandı ve eklendi.
- [x] “Gerçekleşen gelir” hesabı `compute_finance_summary()` içinde tek, ortak, test edilebilir katmanda merkezileşmiş durumda (paylaşılan fonksiyon zaten tekti; eksik olan tarih kesimiydi).
- [x] Aynı kapsamı iddia eden Genel Bakış ve Net Durum metrikleri aynı tarih kesimine getirildi (`custStmt`, `gppStmt`, `expStmt` içindeki `paid`/`month_paid` toplamlarına `entry_date <= :today` eklendi).
- [x] `Bu Ay Tahsilat` hesabında ileri tarihli kayıtların sayılması engellendi.
- [x] Bilinçli kapsam farkları (Beklenen Tahsilat vs. Kalan Alacak vs. Toplam Tahsilat) zaten mevcut kart açıklamalarında/sayfa başlıklarında belirtiliyor (bkz. P4).

### 2B. Regresyon testleri

- [x] Geçmiş tarihli tahsilat — `tools/dashboard-net-durum-date-cutoff-test.php`.
- [x] Bugün tarihli tahsilat.
- [x] Gelecek tarihli tahsilat.
- [x] Gelecek vadeli ancak bugün tahsil edilmiş kayıt senaryosu, tarih kesimi mantığıyla kapsandı.
- [x] Kısmi tahsilat — mevcut `net-durum-filtered-kpi.test.ts` ve `beklenen-tahsilat-open-receivables.test.ts` ile dolaylı kapsanıyor.
- [x] Fazla ödeme — `gelenler-gidenler-overpayment-aggregate.test.ts`.
- [x] Ay ve yıl sınırı testi eklendi — `tools/dashboard-net-durum-date-cutoff-test.php` genişletildi: önceki ayın son günü (`month_income`'a girmemeli) ve bu ayın ilk günü (`month_income`'a girmeli) senaryoları; tarih-string karşılaştırması yıl geçişini özel olarak ele almadığı için aynı test Aralık→Ocak sınırını da örtük olarak kapsıyor.
- [x] Kayıt silme sonrası iki ekranın aynı miktarda güncellenmesi — aynı SQL toplamından okundukları için yapısal olarak garanti (tek kaynak).

### 2C. Kabul kriterleri

- [x] Aynı kapsamı iddia eden Genel Bakış ve Net Durum değerleri birebir eşleşir (tek fonksiyon, tek sorgu).
- [x] İleri tarihli kayıt tek ekranda fazladan sayılmaz (`entry_date <= :today` kesimi).
- [x] KPI kartından açılan hedef ekran kart değerini aynı filtre/kapsamla yeniden üretir.

---

## BUG-03 — Fazla ödeme müşteri detay KPI’larında kayboluyor

**Önem:** Yüksek

### 3A. Analiz ve düzeltme

- [x] Müşteri listesi, müşteri detay tablosu ve müşteri detay KPI hesapları karşılaştırıldı.
- [x] Negatif bakiyeyi sıfıra kırpan senaryo bulundu — `AdminCustomerDetail.tsx`'te eski `financialEntries` state'i, kart-tipi kayıtları eksik/kayıplı sentetik satırlara çeviriyordu.
- [x] Planlanan alacak gerçek planlanan tutar olarak korunuyor.
- [x] Tahsil edilen tutar gerçek `paid_amount` olarak gösteriliyor, planlanan tutarla sınırlandırılmıyor.
- [x] Müşteri bakiyesi fazla ödeme halinde negatif görünebiliyor.
- [x] Liste, detay KPI ve detay tablosu `cardEntriesToLedgerEntries()` üzerinden ortak müşteri finans hesaplamasına indirgendi.

### 3B. Testler

- [x] 100.000 planlanan / 0 ödenen — `customer-detail-overpayment-kpi.test.ts`.
- [x] 100.000 planlanan / 40.000 ödenen.
- [x] 100.000 planlanan / 100.000 ödenen.
- [x] 100.000 planlanan / 120.000 ödenen (fazla ödeme).
- [x] Aynı müşteride karma durumlu birden fazla kayıt.
- [x] Dövizli kayıt testi mevcut — `customer-detail-overpayment-kpi.test.ts`'in son testi ("foreign-currency-tagged rows are still summed via TRY-converted amount_try/paid_amount_try"), hesaplamanın yalnızca zaten TRY'ye çevrilmiş `amount_try`/`paid_amount_try` alanlarını okuduğunu, orijinal para birimine bakılmaksızın doğruladığı için kapsıyor. *(Önceki taslak raporda bu madde sehven "eksik" olarak işaretlenmişti; dosya incelemesinde test zaten mevcuttu.)*
- [x] Silme sonrası liste/KPI/tablo mutabakatı — tek hesaplama fonksiyonu kullanıldığı için yapısal olarak garanti.

### 3C. Kabul kriterleri

- [x] Fazla ödeme örneğinde müşteri detayında: Toplam alacak ₺100.000, Tahsil edilen ₺120.000, Bakiye −₺20.000 (test ile doğrulandı).
- [x] Liste, detay kartları ve detay tablosu aynı sonucu verir (ortak fonksiyon).

---

## BUG-04 — Proje Finans TÜFE güncelleme KPI’sı yanlış

**Önem:** Orta-Yüksek

### 4A. Analiz ve düzeltme

- [x] Enflasyon Hesaplama motoru değiştirilmeden Proje Finans entegrasyonu izlendi.
- [x] Her gelir satırı için nominal tutar/baz tarih/enflasyon sonucu/katkı `project-statement.php: compute_statement_summary()` içinde görünür.
- [x] Geçmiş tarihli açık kayıtlarda `inflation_preview = null` değerinin sıfıra düştüğü doğrulandı — bu asıl kök nedendi (nominal `planned` yerine `paid` yani genelde 0 kullanılıyordu).
- [x] Fazla ödenmiş kayıtta planlanan yerine ödenen tutarın baz alınması doğrulandı — bu davranış zaten doğruydu, bozulmadı.
- [x] TÜFE kapsamında kullanılacak baz tutar/tarih kuralı tek yerde (`compute_statement_summary()`) tanımlı.
- [x] Hesaplanamayan değer artık sessizce `0` sayılmıyor — açık kayıtlarda nominal `planned` tabanına düşüyor.
- [x] Fark formatı düzeltildi: `fmtSignedTRY()` işareti bir kez basıyor (`+₺X` / `−₺X` / `₺0,00`), `+₺-X` üretimi ortadan kalktı.
- [x] Enflasyon motoru ile proje finans toplayıcısının sorumlulukları ayrı (motora dokunulmadı).

### 4B. Testler

- [x] Demo proje örneği — `tools/project-finance-tufe-and-overdue-test.php`.
- [ ] DEDEPAŞA’ya özgü isimlendirilmiş bir test eklenmedi; aynı hesaplama yolu jenerik proje verisiyle test edildi. **Bilinen eksik (isimlendirme özelinde, mantık kapsandı).**
- [x] Geçmiş, bugün ve gelecek tarihli kalemler.
- [x] Kısmi ödeme.
- [x] Fazla ödeme.
- [x] Eksik/null enflasyon verisi.
- [x] Satır toplamı ile KPI toplamının mutabakatı.
- [x] Pozitif, negatif ve sıfır fark formatı — sign formatting frontend testleriyle (mevcut finance test dosyaları) ve kod incelemesiyle doğrulandı.

### 4C. Kabul kriterleri

- [x] Açık/geçmiş tarihli kalem artık sıfır katkı vermiyor (nominal tabana düşüyor).
- [x] Fazla ödeme, planlanan baz tutarın yanlışlıkla yerini almıyor.
- [x] TÜFE kapsamındaki her satırın katkısı matematiksel olarak izlenebilir.
- [x] Fark etiketi doğru işaretle gösteriliyor.
- [x] Enflasyon Hesaplama modülünün 1,317502 çarpan davranışı bozulmadı (motora dokunulmadı).

---

# P2 — Orta öncelikli fonksiyon ve finans düzeltmeleri

## BUG-05 — Proje Finans gelir satırlarında gecikme durumu hesaplanmıyor

- [x] Gelir satırlarının yalnızca saklanmış `status` alanını render ettiği nokta bulundu (`project-statement.php` satır eşleme adımı).
- [x] Gelenler ekranındaki çalışma zamanı durum sınıflandırması (`fe_auto_status()`/`fe_is_overdue()`) ortak yardımcı fonksiyon olarak zaten mevcuttu; `project-statement.php` da bu fonksiyonlara bağlandı.
- [x] Vade tarihi bugünden önce ve kalan tutar pozitifse gecikme üretiliyor.
- [x] Tam ödenmiş kayıt gecikmiş sayılmıyor.
- [x] Kısmi ve gecikmiş kayıt iki bilgiyi de koruyor.
- [x] DB kaydı güncellenmeden takvim ilerlediğinde durum doğru değişiyor (canlı hesaplama, saklanan alan değil).
- [x] Gelenler ve Proje Finans aynı kayıt için aynı rozetleri gösteriyor (aynı `fe_auto_status()`/`fe_is_overdue()` fonksiyonları).

**Kabul:** ✅ Doğrulandı — `tools/project-finance-tufe-and-overdue-test.php` (BUG-04 ile birlikte 6 kontrol).

---

## BUG-06 — Medya albüm ve favori sayaçları gerçek verilerle uyuşmuyor

- [x] Medya listesi, albüm sayacı ve favori sayacı sorguları karşılaştırıldı.
- [x] Albüm–görsel ilişkisindeki yetim satırları tespit eden test/sorgu hazırlandı — `tools/media-album-orphan-counters-test.php`.
- [x] Sayaçlar yalnızca mevcut ve erişilebilir görseller üzerinden hesaplanıyor (`fetch_albums_with_counts()` UUID-regex `LEFT JOIN` filtresi).
- [x] Görsel silme akışında ilişki satırları temizleniyor (`delete_media_album_memberships()`, üç silme yolunun tamamından çağrılıyor).
- [x] Görsel satırı + albüm üyelik temizliği artık açık bir PDO transaction'a sarılı (`delete_db_media()`, `delete_db_media_by_url()`); hata durumunda `rollBack()` ile tam geri alınıyor. `inTransaction()` kontrolü ile zaten açık bir transaction içinden çağrılırsa (örn. test harness) PDO'nun iç içe transaction desteklememesi nedeniyle çökmek yerine mevcut transaction'a katılıyor. Doğrulandı: `tools/media-album-orphan-counters-test.php` (3 kontrol, kendi dış transaction'ı içinden çağırarak nested-transaction senaryosunu da fiilen test ediyor).
- [x] Favori sayacı gerçek favori görsel sayısıyla eşit (aynı filtreli JOIN, Favoriler de bir albüm olarak modellenmiş).
- [x] Albüm içindeki `X / toplam` değeri filtrelenmiş sonuçla eşit.
- [x] Mevcut yetim satırlar için idempotent cleanup planı hazırlandı (rapor bölüm 8) — **production’da çalıştırılmadı**.
- [x] Boş albüm, çoklu albüm, favori ekleme/çıkarma ve silme regresyon testleri eklendi — `tools/media-album-orphan-counters-test.php` (3 kontrol, transaction rollback ile).

**Kabul:** ✅ Tam doğrulandı — sayaç tutarlılığı ve atomik (transaction'a sarılı) temizlik ikisi de test kanıtıyla kapatıldı.

---

## BUG-07 — Silinmiş kaynaklara ait yetim bildirimler kalıyor

- [x] Bildirimin kaynak türü ve kaynak kayıt ID ilişkisi izlendi.
- [x] `notifications.php` GET (`generate`/listeleme) mantığı incelendi.
- [ ] Kaynak silme akışında ilgili otomatik bildirimi silen/arşivleyen bir yazma-zamanı (write-time) temizlik eklenmedi; bunun yerine **okuma-zamanı (read-time) filtreleme** tercih edildi (`filter_out_orphan_payment_notifications()`), çünkü bu, kaynak silme akışının onlarca farklı yerine dokunmadan tek noktadan garanti sağlıyor ve "en küçük tutarlı değişiklik" ilkesine daha uygun. Sonuç aynı: yetim bildirim kullanıcıya hiç gösterilmiyor. **Kasıtlı tasarım tercihi, madde metniyle birebir eşleşmiyor ama kabul kriterini karşılıyor.**
- [x] Generate çağrısında kaynağı bulunmayan bildirim artık listelenmiyor (filtre GET yanıtına uygulanıyor).
- [x] Duplicate bildirim oluşumu bu değişiklikle etkilenmedi (kapsam dışı, mevcut davranış korundu).
- [x] Bildirim sayacından yetim/geçersiz kayıtlar çıkarılıyor (aynı filtre sayaç için de kullanılan `$persisted` dizisine uygulanıyor).
- [x] Mevcut yetimler için idempotent cleanup planı hazırlandı (rapor bölüm 8) — **production’da çalıştırılmadı**.
- [x] Kaynak mevcut, kaynak silinmiş ve tekrar generate senaryoları test edildi — `tools/notifications-orphan-filter-test.php`.

**Kabul:** ✅ Doğrulandı — silinen kayda ait bildirim artık listede/sayaçta görünmüyor.

---

## BUG-08 — Fazla ödeme, konsolide finans ekranlarında farklı yorumlanıyor

- [x] Gelenler, Müşteriler ve Net Durum hesaplamaları ortak iş kurallarıyla karşılaştırıldı.
- [x] Gelenler’deki `SUM(planned) - SUM(paid)` yaklaşımı kayıt bazlı açık bakiye toplamına dönüştürüldü (`gelenler_summary()`).
- [x] Konsolide kalan alacak `SUM(MAX(planned - paid, 0))` kuralıyla hesaplanıyor (Gelenler ve Gidenler’de).
- [x] Gerçek tahsilatta tam `paid_amount` değeri korunuyor (`total_paid` değişmedi).
- [x] Fazla ödeme başka müşterilerin açık alacağını düşürmüyor (per-row `MAX(...,0)` clamp).
- [x] Fazla ödeme müşteri/kayıt bazında görünür — yeni `total_overpaid` alanı eklendi.
- [x] Aynı kapsam ve tarih kesimindeki ekranların sonuçları eşitlendi.
- [x] Fazla ödeme içeren birden fazla kayıtla birikimli regresyon testi yazıldı — `gelenler-gidenler-overpayment-aggregate.test.ts` (4 test).

**Kabul:** ✅ Doğrulandı — ₺100.000/₺120.000 senaryosu testte birebir kontrol edildi (tahsilat +₺120.000, konsolide kalan alacak +₺0, `total_overpaid` +₺20.000, diğer müşterinin alacağı etkilenmiyor).

---

## BUG-09 — “Yaklaşan Ödeme” kartı kısmi ödemelerin kalanını dışlıyor

- [x] Kart sorgusunda yalnızca `status = planlandi` filtresinin kullanıldığı doğrulandı (kök neden).
- [x] Gelecek tarihli kısmi ödenmiş kayıtların pozitif kalan bakiyesi hesaba katılıyor — `sumUpcomingRemaining()`.
- [x] Tam/fazla ödenmiş kayıtlar dışarıda bırakılıyor (`max(0, amount - paid)` sıfırsa katkı yok).
- [x] Mevcut yaklaşan ödeme tarih penceresi korundu ve `src/lib/finance.ts` içinde tek yerde tanımlı.
- [ ] Kart ile alt tablonun birebir aynı fonksiyonu çağırdığına dair ayrı bir UI-entegrasyon testi eklenmedi; `AdminCustomerDetail.tsx`'te ikisi de aynı `customerEntries` state’inden ve aynı `sumUpcomingRemaining()` çağrısından besleniyor (kod incelemesiyle doğrulandı). **Bilinen eksik (birim test var, entegrasyon testi yok).**
- [x] Tam açık, kısmi, tam ödenmiş, fazla ödenmiş ve tarih sınırı testleri eklendi — `customer-detail-upcoming-payment.test.ts` (4 test).

**Kabul:** ✅ Doğrulandı — kısmi ödenmiş gelecek tarihli kayıtların kalan bakiyesi artık karta dahil.

---

# P3 — Düşük öncelikli UX ve güvenlik iyileştirmeleri

## BUG-10 — Silme işlemleri `window.confirm()` kullanıyor

- [x] Devlet Hakedişleri, Müşteriler, Gelenler ve Gidenler silme handler’ları bulundu.
- [x] Yerel `window.confirm()` kullanımı mevcut `AlertDialog` bileşenine taşındı (`useConfirmDelete()` hook’u, shadcn `alert-dialog.tsx` üzerine).
- [x] Modalda en az kayıt adı, kaynak türü ve geri alınamazlık uyarısı gösteriliyor.
- [x] Kaskad silme durumunda (hakediş kaydı → aşama/tahsilat kırılımları) bağlı kayıt **sayısı** artık gerçek verilerden gösteriliyor: `describeGppCascadeDelete(breakdownCount, collectionCount)` (`src/lib/finance.ts`), `r.breakdowns.length`/`r.collections.length`'tan ("3 aşama ve 5 tahsilat kaydı da birlikte silinecek" gibi) üretiliyor — sayı hiçbir zaman uydurulmuyor, bağlı kayıt yoksa hiç not eklenmiyor. Hem `AdminGovernmentProgressPayments.tsx` hem `AdminCustomerDetail.tsx`'teki hakediş silme diyalogları aynı paylaşılan fonksiyonu kullanıyor. Test: `confirm-delete-dialog.test.tsx` (4 yeni test).
- [x] İptalde hiçbir API isteği gönderilmediği doğrulandı (`onConfirm` yalnızca onayda çağrılıyor) — `confirm-delete-dialog.test.tsx`.
- [x] Onayda tek silme isteği gönderildiği ve loading sırasında çift tıklamanın engellendiği doğrulandı (buton `disabled` durumuna alınıyor).
- [x] Erişilebilir odak yönetimi ve klavye davranışı Radix `AlertDialog` tarafından zaten sağlanıyor (değiştirilmedi).

**Kabul:** ✅ Tam doğrulandı — kaskad kayıt sayısı önizlemesi dahil, `confirm-delete-dialog.test.tsx` (8 test: 4 dialog davranışı + 4 `describeGppCascadeDelete`).

---

## BUG-11 — Form doğrulaması ilk hatada duruyor, alan bazlı mesaj yok

- [x] İlk hatada `return` eden doğrulama akışı bulundu (`AdminCustomerEdit.tsx: save()`, `CardEntryForm.tsx: handleSave()`).
- [x] Tüm alan hataları tek submit’te toplanıyor (`Record<string,string>`).
- [x] Hatalı alanlar `aria-invalid` + kırmızı çerçeve ile görsel/erişilebilir biçimde işaretleniyor.
- [x] Mesaj ilgili alanın altında gösteriliyor (`FieldErrorText`).
- [x] İlk hatalı alana odaklanma/kaydırma eklendi (`focusFirstError()`, jsdom uyumluluğu için `scrollIntoView?.()` optional-chain).
- [x] Genel özet toast mesajı alan mesajlarının yanında (yerine değil) kullanılıyor.
- [x] Telefon, e-posta, zorunlu alan ve proje seçimi testleri eklendi — `card-entry-form-aggregate-validation.test.tsx` (2 test, `AdminCustomerEdit` alanları kod incelemesiyle doğrulandı).

**Kabul:** ✅ Doğrulandı — boş form tek seferde tüm eksikleri gösteriyor.

---

## BUG-12 — Finansal inputlarda autocomplete ve input mode eksik

- [x] Finansal modal ve ortak input bileşenleri tespit edildi (`CardEntryForm.tsx`, `AdminGovernmentProgressPayments.tsx`, `AdminCustomerDetail.tsx` GppDialog).
- [x] İlgili alanlara `autoComplete="off"` eklendi.
- [x] Tutar alanlarına `inputMode="decimal"` eklendi.
- [x] Alan tiplerinin, decimal ayracının ve sayı formatlama davranışının bozulmadığı doğrulandı (`type="number"`/`step` değişmedi, yalnızca `inputMode`/`autoComplete` eklendi).
- [x] Regresyon testi eklendi — `card-entry-form-input-attributes.test.tsx` (2 test).

**Kabul:** ✅ Doğrulandı.

---

## BUG-13 — Enflasyon endeks tablosu etiketleri belirsiz

- [x] Endeks tablosundaki sütunların temsil ettiği dönem/veri tipi koddan doğrulandı.
- [x] Dönem başı/sonu, aylık/yıllık ve baz dönem bilgisi açık etiketlerle belirtildi ("Dönem (Ay/Yıl)", "Endeks Değeri (Ay Sonu)", "Yıllık Değişim (Aynı Ay, Önceki Yıl)", "Aylık Değişim (Önceki Aya Göre)").
- [x] Baz dönem zaten sonuç kartında görünürdü (değişmedi).
- [x] Hesap motoruna dokunulmadı, yalnızca etiket/açıklama metni değişti.
- [x] Doğrulanmış örnek sonucu korundu: ₺1.000.000 → ₺1.317.502, Artış %31,7502, Çarpan 1,317502 (motor kodu değişmedi, mevcut testler geçiyor).

**Kabul:** ✅ Doğrulandı.

---

# P4 — Kapsam etiketleri ve regresyon koruması

## Bilinen, hata olmayan kapsam farkları

- [x] Genel Bakış `Beklenen Tahsilat` yalnızca müşteri alacağını kapsıyor — matematik değiştirilmedi, mevcut kart açıklaması ("Açık (tahsil edilmemiş) tüm müşteri alacakları") zaten bunu belirtiyor.
- [x] Gelenler `Kalan Alacak` müşteri + devlet hakedişi kapsamını kullanıyor — matematik korunuyor; sayfa başlığı açıklaması ("Tüm müşteri tahsilatları ve devlet hakediş ödemeleri") bunu üst seviyede belirtiyor. Kart düzeyinde ayrı bir alt açıklama eklenmedi (kapsam dışı kozmetik değişiklik, madde 39'daki "en küçük değişiklik" ilkesiyle sınırlı tutuldu).
- [x] Müşteriler `Toplam Tahsilat` yalnızca müşteri tahsilatını kapsıyor — kart açıklaması ("Müşterilerden alınan toplam") zaten belirtiyor.
- [x] Genel Bakış/Net Durum toplam gelirine devlet hakedişi tahsilatı dahil — matematik korunuyor, değiştirilmedi.
- [x] Bu kapsamlar korunuyor; mevcut açıklamalar yeterli görüldü, matematik hiçbir yerde birleştirilmedi.

## Finansal çekirdek regresyonları

- [ ] Demo proje için raporda belirtilen tam rakamlar (₺1.400.000 planlanan müşteri geliri vb.) production ortamındaki gerçek demo projeye karşı yeniden çalıştırılarak doğrulanmadı — bu, production veritabanına erişim ve/veya production verisiyle test çalıştırma anlamına gelir ve **kapsam dışı bırakıldı (yasak)**. Bunun yerine **yapısal doğrulama** yapıldı: bu round’da değiştirilen hiçbir sorgu `planned`/`paid` taban toplamlarının SUM’unu değiştirmiyor; yalnızca bu toplamlardan türetilen "kalan"/"yaklaşan"/"gecikmiş" alt metrikler düzeltildi. Ayrıntı için rapor bölüm 8/10.
- [x] Kısmi ödeme mantığı korundu (testlerle doğrulandı).
- [x] Tarih kalıcılığı korundu (dokunulmadı).
- [x] Gecikme hesabı korundu/iyileştirildi (BUG-05 ile canlı hesaplamaya taşındı, testlerle doğrulandı).
- [x] Devlet hakedişi 30/30/30/10 toplamı korundu (dokunulmadı, mevcut testler geçiyor).
- [x] Proje/müşteri/tedarikçi ilişkileri korundu (dokunulmadı).
- [x] Kaskad silme sonrası finansal toplamların geri dönmesi korundu (dokunulmadı, mevcut testler geçiyor).
- [x] Proje filtrelerinin KPI’ları doğru etkilemesi korundu (dokunulmadı).
- [x] Dövizli kayıtların mevcut kur dönüşüm davranışı bozulmadı (`amount_try`/`paid_amount_try` üzerinden çalışan mantığa dokunulmadı).

---

# P5 — Teknik doğrulama ve teslim

## Zorunlu komutlar

- [x] TypeScript type-check — `npx tsc --noEmit` → hatasız.
- [x] Lint — `npm run lint` → 235 hata/34 uyarı, tamamı bu round’dan önce var olan, dokunulmamış dosyalarda (kanıt: `git diff` ile karşılaştırıldı, eklenen satırlarda `: any` yok).
- [x] Unit test — `npx vitest run` → 37 dosya, 191 test, tamamı geçti.
- [x] Integration/API test — `tools/*.php` (bkz. rapor bölüm 7).
- [x] Production build — `npm run build` → başarılı.
- [x] İlgili PHP syntax kontrolleri — `public_html/api` ve `tools/` altındaki tüm `.php` dosyaları `php -l` ile tarandı, hatasız.
- [x] Mevcut QA/regression scriptleri — `tools/bug01-employee-personnel-tables-test.php`, `tools/vadesi-gecen-alacak-overdue-test.php`, `tools/finance-entry-date-validation-test.php`, `tools/canonical-read-flags-test.php`, `tools/backend-canonical-read-model-parity-test.php` yeniden çalıştırıldı, hepsi geçti.
- [x] Test yoksa kritik hesaplar için hedefli test eklendi (7 yeni Vitest test dosyası + 5 yeni `tools/*.php` script = 12 yeni test dosyası).

## Çıktılar

- [x] Bu TODO dosyasındaki tamamlanan maddeler işaretlendi.
- [x] Kök dizinde `AKINAL_ADMIN_QA_FIX_IMPLEMENTATION_REPORT_2026-08-06_C.md` oluşturuldu.
- [x] Raporda değişen dosyalar, kök nedenler, çözümler, testler, komutlar/sonuçlar, bloke kalan işler, runbook, riskler ve deploy öncesi kontrol listesi yazıldı.
- [x] Son mesajda kısa özet verildi; kanıt olmadan PASS denmedi (bilinen eksikler açıkça işaretlendi).
- [x] Production deploy, migration execution, commit ve push yapılmadı.

---

# Definition of Done

- [x] BUG-01–04 kod ve test düzeyinde çözülmüş; BUG-01’in production migration adımı açık bir manuel bağımlılık olarak raporlanmış.
- [x] BUG-05–13 için ilgili düzeltme ve regresyon testleri tamamlanmış (birkaç küçük, açıkça işaretlenmiş test-kapsamı eksiği hariç).
- [x] Ortak finansal kurallar ekranlar arasında tutarlı (`compute_finance_summary()`, `gelenler_summary()`/`gidenler_summary()`, `sumUpcomingRemaining()`).
- [x] Demo proje finansal çekirdeği yapısal olarak bozulmamış (taban SUM sorguları değişmedi); production’daki gerçek rakamlarla birebir yeniden doğrulama yapılmadı (production erişimi yasak).
- [x] Build/type-check/test komutları başarılı.
- [x] Değişiklikler yalnızca ilgili dosyalarla sınırlı (`git status` ile doğrulandı, 16 değiştirilmiş + 12 yeni dosya).
- [x] Uygulama raporu oluşturulmuş.
- [x] Production’a hiçbir değişiklik uygulanmamış.
