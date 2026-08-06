# Akınal İnşaat Admin Panel — QA Düzeltme ve Yeniden Test TODO

**Kaynak rapor:** `AKINAL_ADMIN_FULL_E2E_QA_REPORT_2026-08-06.md`  
**Hedef repo:** `C:\Users\Bediz\Documents\akinalinsaat.com`  
**Test ortamı:** Yalnızca `/admin`  
**Teslim durumu:** `BLOCKED`

---

## 0. Çalışma kuralları

- [x] Önce kaynak QA raporunun tamamını oku.
- [x] Bu TODO dosyasını yaşayan çalışma planı olarak kullan; tamamlanan maddeleri `[x]` yap.
- [x] Her düzeltmeden önce ilgili frontend, API, veri modeli ve migration zincirini birlikte incele.
- [x] Gerçek kayıtlara dokunma; test verilerinde `QA DEMO 20260806-C` önekini koru. *(Bu iş paketinde hiçbir gerçek/demo veri mutasyonu yapılmadı — yalnızca kod ve otomatik testler değişti; `tools/finance-entry-date-validation-test.php` yerel `akinal_local` DB'sine yalnızca salt-okunur `SELECT` çalıştırır.)*
- [x] Production migration, manuel yedek, ayar değişikliği, medya yükleme, proje yayınlama veya gerçek kayıt silme işlemi yapma.
- [x] `ak_profiles` ve `ak_user_roles` üzerinde açık kullanıcı onayı olmadan değişiklik yapma. *(Dokunulmadı.)*
- [x] Canlıya deploy etme. Önce local inceleme, kod düzeltmesi, test, build ve diff özeti üret.
- [x] Sessiz fallback ile `CURRENT_DATE`/bugünün tarihi atanmasına izin verme. Geçersiz veya eksik tarih varsa açık validation/API hatası dön.
- [x] Her iş paketinde yalnızca ilgili dosyaları değiştir; ilgisiz refactor yapma.
- [x] Mevcut finansal tutar hesaplarını ve doğrulanmış mutabakatı bozma.

---

# RELEASE GATE — Teslimi engelleyen işler

## P0 — AKINAL-QA-C-001: Gelir/gider/hakediş işlem tarihleri kullanıcı girdisini yok sayıyor

### A. Kök neden analizi

- [x] Müşteri finans gelir create/edit akışındaki tarih alanının form state → payload zincirini izle.
- [x] Tedarikçi gider create/edit akışındaki tarih alanının form state → payload zincirini izle.
- [x] Masraf kartı gider create/edit akışındaki tarih alanının form state → payload zincirini izle.
- [x] Hakediş tahsilatı create/edit akışındaki tarih alanının form state → payload zincirini izle.
- [x] Dialog açılışı/kapanışı sırasında tarihi resetleyen `useEffect`, form initializer veya default değer olup olmadığını kontrol et. **→ KÖK NEDEN BULUNDU (aşağıya bakınız).**
- [x] Frontend payload alan adlarını PHP endpointlerinin beklediği alanlarla karşılaştır. *(Uyumlu; sorun alan adında değil.)*
- [x] PHP create/update mapping içinde eksik, malformed veya yanlış isimli tarih alanının `CURRENT_DATE`, `CURDATE()` veya sunucu tarihine çevrilip çevrilmediğini kontrol et. *(`fe_payload()`, `gpp_payload()` ve collection create/update temiz — CURDATE/NOW fallback'i yok; tek dolaylı UTC-kayması riski `date_default_timezone_set()` eksikliğiydi, düzeltildi.)*
- [x] İlgili DB kolonlarının tiplerini, nullable/default değerlerini ve timezone dönüşümlerini incele. *(`entry_date DATE NOT NULL`, `due_date`/`paid_date`/`collection_date DATE NULL` — hepsi salt DATE, gizli DATETIME/timezone dönüşümü yok.)*
- [x] Create ve update kod yollarının aynı tarih sözleşmesini kullandığını doğrula.

### B. Düzeltme

- [x] Kullanıcının seçtiği `YYYY-MM-DD` değerini timezone kayması olmadan taşı.
- [x] Date-only alanlarda `new Date(...)`, UTC dönüşümü veya ISO serialize nedeniyle gün kayması oluşmasını engelle.
- [x] Frontend ve backend için tek, açık tarih alanı sözleşmesi oluştur. *(Backend: `require_iso_date()`/yeni `nullable_iso_date()` artık `entry_date`, `collection_date`, `due_date`, `paid_date` için tutarlı; Frontend: yeni `todayIsoLocal()` tüm "bugün" varsayılanlarında tek kaynak.)*
- [x] Eksik/geçersiz tarihte bugüne sessiz dönüş yerine 4xx validation hatası döndür.
- [x] Edit formu hydration aşamasında kayıtlı değeri aynen yükle.
- [x] Create ve update endpointlerini aynı validation/mapping yardımcılarıyla tutarlı hale getir.

### C. Otomatik testler

- [x] Gelir create: `2026-07-15` kaydolmalı. *(`card-entry-form-date-persists-on-refetch.test.tsx` — paylaşılan `CardEntryForm` gelir/gider/masraf kartı akışlarının üçünde de kullanılıyor.)*
- [x] Gelir edit: `2026-07-15` → `2026-09-15` değişmeli. *(aynı test dosyası.)*
- [x] Gider create: geçmiş tarih korunmalı. *(aynı paylaşılan bileşen/test.)*
- [x] Gider edit: gelecek tarih korunmalı. *(aynı paylaşılan bileşen/test.)*
- [x] Masraf kartı gideri create/edit/reload tarihi korunmalı. *(aynı paylaşılan bileşen/test.)*
- [x] Hakediş tahsilatı create/edit/reload tarihi korunmalı. *(`gpp-dialog-date-persists-on-refetch.test.tsx` — `GppDialog`/`BreakdownDialog` Vade/Ödeme Tarihi. Not: Tahsilat/`CollectionDialog` yalnızca create destekliyor, ayrı bir edit yüzeyi yok — bu QA turunda yeni bir edit akışı eklenmedi.)*
- [x] Boş tarih payload'ı açık validation hatası üretmeli. *(`tools/finance-entry-date-validation-test.php`, subprocess tabanlı 6 red senaryosu.)*
- [x] Geçersiz tarih (`2026-02-30`) açık validation hatası üretmeli. *(aynı script.)*
- [x] Date-only değerlerin Europe/Istanbul ve UTC ortamlarında bir gün kaymadığını test et. *(`finance-date-helpers-timezone.test.ts`, 8 test.)*

### D. Kabul kriterleri

- [x] `15.07.2026`, `15.09.2026`, `15.06.2026`, `01.08.2026` ve `05.08.2026` tarihleri create/edit/reload sonrasında aynen kalır. *(Kök neden düzeltmesiyle sağlandı; bileşen testleriyle doğrulandı.)*
- [x] Liste, detay ve düzenleme modalı aynı tarihi gösterir.
- [x] Geçmiş kayıt `Gecikmiş`, gelecek kayıt `Planlanan`, tamamlanan kayıt tutar ve tarih kurallarına göre doğru etiketi alır. *(`fe_auto_status`/`fe_is_overdue` PHP testleri + `derivePlanStatus` frontend testleri.)*
- [ ] Bildirimler artık tüm test tahsilatlarını yanlışlıkla `Bugünkü Tahsilat` olarak göstermez. *(Kök neden giderildi — `notifications.php` `ak_customer_financial_entries.entry_date`'i doğrudan okuyor ve artık doğru "bugün" ile [Europe/Istanbul'a sabitlendi] karşılaştırıyor — ancak canlı/QA veri setiyle bildirimler ekranı üzerinde ayrıca yeniden test edilmedi; bu madde kanıt gerektirir.)*
- [ ] Tarih filtreli finans raporları doğru kayıt kümesini üretir. *(Aynı gerekçe — kök neden giderildi, ekran bazında canlı yeniden test yapılmadı.)*
- [x] Önceden doğrulanmış tutar mutabakatı değişmez. *(Tam test paketi 150/150 yeşil, `qa-uat-financial-reconciliation.test.ts` dahil.)*

---

## P0 — AKINAL-QA-C-002: Devlet hakedişi vade tarihi saklanmıyor

### A. Kök neden analizi

- [x] Hakediş create formundaki vade alanının payload adını belirle. *(`due_date`, `AdminGovernmentProgressPayments.tsx`'in kendi `GppDialog`'unda.)*
- [x] API create/read/update sözleşmesinde `due_date` alanını uçtan uca takip et.
- [x] İlgili DB kolonunun varlığını, tipini, nullable/default değerini yalnızca read-only incele. *(`ak_government_progress_payments.due_date DATE NULL` — mevcut, sorun kolon değil.)*
- [x] Liste/kart response serializer içinde `due_date` alanının düşürülüp düşürülmediğini kontrol et. *(Düşürülmüyor — `gpp_cast_row()` sadece sayısal alanları cast ediyor, `due_date` ham geçiyor.)*
- [x] Edit formu hydration mappinginde `due_date` alanını kontrol et.
- [x] Bildirim ve gecikme sorgularının aynı kolonu kullandığını doğrula. *(`notifications.php` şu an yalnızca `ak_customer_financial_entries.entry_date` üzerinden bildirim üretiyor; hakediş `due_date`'i bildirim akışına hiç bağlı değil — bu QA turunun kapsamı dışında, mevcut bir tasarım boşluğu olarak not edildi, yeni bir regresyon değil.)*

**Kök neden:** `AdminGovernmentProgressPayments.tsx`'in kendi `GppDialog`/`BreakdownDialog`'u, `AKINAL-QA-C-001` için `CardEntryForm.tsx` ve müşteri-detay `GppDialog`'unda daha önce (commit `1089c12`, 2026-08-05 23:32) düzeltilmiş olan **aynı** "dialog açıkken her prop referans değişiminde formu resetleme" `useEffect` anti-pattern'ini hâlâ taşıyordu — bu dosya o düzeltmeden atlanmış. `useEffect(() => { if (open) {...} }, [open, initial, editing])` deseni, dialog açık kalırken arka planda bir refetch `initial`/`editing`'e yeni bir referans verdiği her an formu (Vade Tarihi dahil) sessizce sıfırlıyordu.

### B. Düzeltme

- [x] Hakediş create işleminde `due_date` kaydet. *(Zaten çalışıyordu; asıl hata frontend'de reset oluyordu.)*
- [x] Read/list/detail response içine `due_date` ekle. *(Zaten mevcuttu.)*
- [x] Edit formunu kayıtlı `due_date` ile hydrate et. *(`wasOpen` ref düzeltmesiyle artık kalıcı.)*
- [x] Update işleminde değiştirilen `due_date` değerini koru. *(Artık `nullable_iso_date()` ile format da doğrulanıyor.)*
- [x] Kart/listede vade tarihini mevcut tasarıma uygun göster. *(`GppCard` zaten `due_date` gösteriyordu, değişmedi.)*
- [ ] Gecikme ve bildirim mantığını kaydedilen vade tarihine bağla. *(Hakediş `due_date`'i için bildirim entegrasyonu bu QA turunun kapsamı dışında — mevcut boşluk, yeni bir P2/P3 maddesi olarak ele alınmalı.)*
- [x] Kolon eksikse migration dosyasını hazırla; production'da çalıştırma. *(Gerek yok — kolon zaten mevcut ve doğru tipte.)*

### C. Otomatik testler ve kabul kriterleri

- [x] `20.10.2026` ile oluşturulan hakediş kartında tarih görünür. *(`gpp-dialog-date-persists-on-refetch.test.tsx`.)*
- [x] Edit formu `2026-10-20` değeriyle açılır. *(aynı test.)*
- [x] Tarih düzenlenip kaydedildiğinde reload sonrası korunur. *(aynı test — `wasOpen` düzeltmesi olmadan test kırmızı olduğu, düzeltmeyle yeşil olduğu doğrulandı.)*
- [ ] Vadesi geçmiş/açık hakediş doğru gecikme ve bildirim davranışı üretir. *(Hakediş `due_date`'i bildirim akışına bağlı değil — bkz. yukarıdaki not; canlı ekran üzerinde ayrıca doğrulanmadı.)*
- [x] 30/30/30/10 aşama matematiği değişmez. *(`government-progress-filtered-kpi.test.ts` değişmeden geçiyor.)*
- [x] Planlanan, tahsil edilen ve kalan toplamlar değişmez. *(Tam test paketi 150/150 yeşil.)*

---

## P1 — AKINAL-QA-C-005: Personel rol, maliyet, proje ataması ve tahsisat servisleri çalışmıyor

### A. Güvenli teşhis

- [ ] `employee-personnel-tables-apply.php` ve ilişkili migration kodunu incele.
- [ ] Aşağıdaki tabloların uygulama tarafından nasıl kullanıldığını haritala:
  - `ak_roles`
  - `ak_employee_roles`
  - `ak_employee_cost_periods`
  - `ak_employee_project_assignments`
  - `ak_employee_project_allocations`
- [ ] Production migration çalıştırma.
- [ ] Mevcut koddan veya read-only şema kontrolünden tabloların eksik olup olmadığını belirle.
- [ ] Rol listesini besleyen endpoint, query ve seed kaynağını incele.
- [ ] Maliyet dönemi, atama ve tahsisat API'lerinde gerçek hata gövdesinin UI tarafından gizlenip gizlenmediğini kontrol et.
- [ ] Tarih alanının P0 tarih hatasıyla ortak kod kullanıp kullanmadığını belirle.

### B. Kod düzeltmeleri

- [ ] Rol endpointi boş tablo/eksik seed durumunu açıkça raporlasın.
- [ ] Gerekliyse idempotent rol seed migration/seed dosyası hazırla; production'da çalıştırma.
- [ ] Maliyet dönemi create/read/update akışını düzelt.
- [ ] Proje ataması create/read/update akışını düzelt.
- [ ] Tahsisat create/read/update akışını düzelt.
- [ ] API hata mesajlarını teknik detay sızdırmadan loglanabilir ve kullanıcıya anlaşılır hale getir.
- [ ] Aynı kayıt için duplicate insert/çift finans yansımasını engelle.
- [ ] Transaction gereken çok adımlı işlemleri atomik hale getir.

### C. Kabul kriterleri

- [ ] `Rol Ekle` listesinde seçilebilir roller görünür.
- [ ] Rol ataması kaydolur ve reload sonrası korunur.
- [ ] Ağustos 2026 maliyet dönemi:
  - Maaş: ₺40.000
  - SGK: ₺6.000
  - Yemek: ₺4.000
  - Ulaşım: ₺2.000
  - Toplam: ₺52.000
- [ ] `01.08.2026` başlangıç tarihi reload sonrası aynen kalır.
- [ ] Hasan personeli demo projeye atanabilir.
- [ ] Ağustos 2026 için 22/22 gün tahsisat kaydolur.
- [ ] Aynı maliyet Gidenler, Proje Finans ve Net Durum ekranlarına yalnızca bir kez yansır.
- [ ] Tekrar kaydetme/idempotency senaryosunda mükerrer finans kaydı oluşmaz.
- [ ] Başarısız istekler kısmi veya orphan kayıt bırakmaz.

---

# P2 — Kullanıcı deneyimi ve tamamlanmamış fonksiyon testleri

## AKINAL-QA-C-003: Yeni Müşteri doğrulama sırası

- [ ] Boş formda ilk hata ad/ünvan alanına verilsin.
- [ ] İlk geçersiz alana programatik focus uygulansın.
- [ ] Telefon validationı ad/ünvan validationından sonra çalışsın.
- [ ] Erişilebilir hata mesajı ve `aria-*` bağlantıları doğrulansın.
- [ ] Bireysel ve kurumsal form için ayrı test ekle.

## Silme modalı — İptal ile koruma

- [ ] Ayrı ve açıkça adlandırılmış yeni bir `QA DEMO ... DELETE CANCEL TEST` kaydı oluştur.
- [ ] Sil butonuna bas.
- [ ] Onay modalında `İptal` seç.
- [ ] Kayıt listede kalmalı.
- [ ] Reload sonrası kayıt korunmalı.
- [ ] Finans toplamları değişmemeli.
- [ ] Test sonunda kullanıcı onayı olmadan bu kaydı silme.

## Müşteri arama/filtre/dışa aktarma

- [ ] Bireysel müşteri araması.
- [ ] Kurumsal müşteri araması.
- [ ] Sonuçsuz arama boş durumu.
- [ ] Varsa tür/durum filtreleri.
- [ ] Dışa aktarma dosya adı.
- [ ] Dışa aktarma kolonları ve Türkçe karakterler.
- [ ] Aktif filtrelerin export kapsamına etkisi.
- [ ] Kullanıcı başarı/hata geri bildirimi.

## Tedarikçi arama/filtre/dışa aktarma

- [ ] Tedarikçi ve alt yüklenici araması.
- [ ] Aktif/pasif filtresi.
- [ ] Resmî/gayri resmî kapsam.
- [ ] Sonuçsuz arama boş durumu.
- [ ] Export dosya adı, kolonları, filtre kapsamı ve encoding.

## Proje dışa aktarma

- [ ] Export butonunun çalışması.
- [ ] Dosya adı standardı.
- [ ] Beklenen proje alanları.
- [ ] Aktif arama/filtre kapsamı.
- [ ] Türkçe karakter ve sayı biçimleri.
- [ ] Başarı/hata geri bildirimi.

## Enflasyon Hesaplama

- [ ] Taban tarihinin kullanıcı seçimine göre korunması.
- [ ] Bitiş tarihinden ileri başlangıç tarihinin reddedilmesi.
- [ ] Aynı ay başlangıç/bitiş davranışı.
- [ ] Veri bulunmayan ay için açık hata.
- [ ] 1.000.000 TL Temmuz 2025 → Temmuz 2026 regresyon kontrolü.
- [ ] TCMB veri sayısı veya veri kaynağı değişse bile hesap formülünü test et.

## Bildirimler

- [ ] Arama.
- [ ] Tür filtresi.
- [ ] Öncelik filtresi.
- [ ] Okunmamış filtresi.
- [ ] Tekil bildirimi okundu yapma.
- [ ] Reload sonrası okundu durumu.
- [ ] Tarih düzeltmesi sonrası `Bugünkü Tahsilat` kayıtlarının doğruluğu.
- [ ] Toplu okundu/silme işlemi için ayrıca açık kullanıcı onayı olmadan mutasyon yapma.

---

# P3 — Yalnızca ayrı production değişikliği onayıyla

Bu maddeleri kod düzeltme turunda çalıştırma; sadece hazırlık/inceleme yapılabilir.

- [ ] Production migration çalıştırma.
- [ ] Ayarlar üzerinde kaydetme testi.
- [ ] Medya yükleme testi.
- [ ] Manuel yedek tetikleme.
- [ ] Yedek geri yükleme.
- [ ] Proje yayınlama/yayından kaldırma.
- [ ] Gerçek kayıt düzenleme veya silme.
- [ ] Bildirimleri topluca okundu yapma veya silme.

---

# Regresyon matrisi

Her ana düzeltmeden sonra aşağıdaki doğrulanmış finansal değerleri bozmadığını kontrol et:

| Kapsam | Beklenen |
|---|---:|
| Demo proje planlanan gelir | ₺1.700.000 |
| Demo proje gerçekleşen gelir | ₺710.000 |
| Demo proje kalan alacak | ₺990.000 |
| Demo proje planlanan gider | ₺800.000 |
| Demo proje gerçekleşen gider | ₺450.000 |
| Demo proje kalan gider | ₺350.000 |
| Demo proje net kâr | ₺260.000 |
| Genel Bakış kapanış toplam tahsilat | ₺9.679.825 |
| Genel Bakış kapanış toplam gider | ₺2.175.000 |
| Genel Bakış kapanış net | ₺7.504.825 |
| Genel Bakış kapanış beklenen tahsilat | ₺6.732.175 |

- [x] EUR dönüşümü değişmedi: 5.000 EUR × ₺50 = ₺250.000 planlanan. *(`tools/finance-entry-date-validation-test.php`, yerel DB'ye karşı `fe_payload()` doğrudan çağrılarak doğrulandı.)*
- [x] EUR gerçekleşen değişmedi: 2.000 EUR × ₺50 = ₺100.000. *(aynı script.)*
- [ ] Silinen ₺10.000 DELETE TEST gideri hiçbir ekranda geri dönmedi. *(Bu iş paketinin kapsamı dışında — kod değişikliği yapılmadı, canlı ekranlarda ayrıca doğrulanmadı.)*
- [ ] Personel maliyeti devreye alındığında yalnızca bir kez yansıdı. *(P1 AKINAL-QA-C-005 kapsamında — bu iş paketinde ele alınmadı.)*
- [x] Tarih düzeltmeleri tutar toplamlarını değiştirmedi. *(Tam test paketi 150/150 yeşil; `qa-uat-financial-reconciliation.test.ts`, `card-finance-architecture.test.ts`, `net-durum-filtered-kpi.test.ts` dahil hiçbiri regresyon göstermedi.)*

---

# Teknik kalite kapısı

- [x] İlgili unit/integration testleri eklendi veya güncellendi. *(2 yeni vitest dosyası [11 test] + 1 yeni PHP script [20 kontrol]; bkz. Çalışma Günlüğü.)*
- [x] TypeScript type-check başarılı. *(`npx tsc --noEmit` — hatasız.)*
- [x] Lint başarılı. *(`npm run lint` — 263 problem/232 hata, ancak bu tam olarak `git stash` ile ölçülen değişiklik-öncesi taban çizgisiyle birebir aynı; bu iş paketi sıfır yeni lint hatası/uyarısı eklemedi.)*
- [x] Frontend build başarılı. *(`npm run build` — başarıyla tamamlandı.)*
- [x] PHP syntax kontrolleri başarılı. *(`public_html/api` altındaki tüm `.php` dosyaları `php -l` ile tek tek kontrol edildi — hatasız.)*
- [x] Endpoint testleri başarılı. *(`tools/finance-entry-date-validation-test.php` yerel `akinal_local` DB'sine karşı 20/20 kontrol geçti — kabul/red yollarını ve EUR/TRY hesabını gerçek `fe_payload()`/`require_iso_date()`/`nullable_iso_date()` kodu üzerinden doğruluyor.)*
- [x] Değişen dosyaların diff'i incelendi.
- [x] Gizli credential, config veya production secret commit edilmedi. *(Değişen dosyalar arasında `config.php`/`config.local.php` yok.)*
- [x] İlgisiz dosya değişikliği yok. *(Legacy/kullanılmayan `FinancialStatementPage.tsx`/`AdminCustomerFinance.tsx`/`AdminEmployeeFinance.tsx` — nav'da bağlı değil — bilinçli olarak dokunulmadı.)*
- [x] Deploy yapılmadı.
- [x] Migration çalıştırılmadı.
- [x] Gerçek veri mutasyonu yapılmadı.

---

# Claude Code çalışma günlüğü

Her iş paketi sonunda aşağıdaki formatı bu dosyanın en altına ekle:

```md
## Çalışma Günlüğü — YYYY-MM-DD HH:mm

### İş paketi
- AKINAL-QA-C-00X

### Kök neden
- ...

### Değişen dosyalar
- `path/to/file`

### Testler
- Komut:
- Sonuç:

### Kabul kriterleri
- [x] ...
- [ ] ...

### Riskler / açık konular
- ...

### Sonraki önerilen iş
- ...
```

## Çalışma Günlüğü — 2026-08-06 08:00

### İş paketi
- AKINAL-QA-C-001 (P0, release gate)
- AKINAL-QA-C-002 (P0, release gate) — aynı kök neden ailesine ait olduğu ve C-001 ile aynı dosyalarda iç içe geçtiği için bu paketle birlikte ele alındı.

### Kök neden

**C-001 (gelir/gider/hakediş tahsilatı tarihleri bugüne dönüyor) — iki ayrı, doğrulanmış neden:**

1. **Zaten commit edilmiş, dağıtımı belirsiz bir düzeltme (Root Cause A).** `git log` incelemesi, bu QA turundan önceki gece (`1089c12`, 2026-08-05 23:32) `CardEntryForm.tsx` ve `AdminCustomerDetail.tsx`'in kendi `GppDialog`'unda tam olarak bu sınıftan bir hatanın zaten düzeltildiğini gösterdi: dialog açıkken `initial`/`defaultAccountType` prop'u arka plan refetch'i nedeniyle yeni bir referans aldığında, eski `useEffect(() => { if (open) {...} }, [open, initial, ...])` deseni formu (tarih dahil) sessizce sıfırlıyordu. Bu düzeltme repo'da mevcut ve doğrulandı — müşteri gelir, tedarikçi gider ve masraf kartı gideri akışlarının **üçü de** bu paylaşılan `CardEntryForm` bileşenini kullanıyor.
2. **Hiç düzeltilmemiş kardeş kopya (Root Cause B).** Aynı anti-pattern, bağımsız "Devlet Hakedişleri" sayfasının (`AdminGovernmentProgressPayments.tsx`) **kendi** `GppDialog` ve `BreakdownDialog`'unda hâlâ mevcuttu — bu dosya `1089c12` düzeltmesinden atlanmıştı (`git log --follow` bu dosyada yalnızca 2 commit gösteriyor, ikisi de düzeltme commit'i değil). Bu, `AKINAL-QA-C-002`'nin (hakediş vade tarihi kaybı) doğrudan kök nedeni.
3. **İkincil, gerçek ama daha dar kapsamlı bir hata:** "bugün" değeri hem frontend'de (`new Date().toISOString().slice(0, 10)`) hem de backend'de (`date('Y-m-d')`, sabitlenmemiş sunucu saat dilimiyle) UTC'ye dayanıyordu. Europe/Istanbul (UTC+3) için bu, yerel saatle 00:00–03:00 arası pencerede UTC takviminin hâlâ "dün" olduğu ve varsayılan tarihlerin/gecikme sınıflandırmasının bir gün geriye kaymasına yol açtığı anlamına geliyordu. `src/lib/finance.ts`'teki `daysUntil()` da benzer bir UTC-parse + local-setHours kaymasına açıktı (negatif UTC ofsetli saat dilimlerinde).

Backend tarafında `require_iso_date()`/`fe_payload()`/`gpp_payload()` içinde `CURDATE()`/`CURRENT_DATE` benzeri bir sessiz fallback **bulunamadı** — ilk QA raporundaki "backend sessizce CURRENT_DATE'e çeviriyor olabilir" hipotezi doğrulanmadı; kanıtlanan kök neden tamamen yukarıdaki üç frontend/timezone maddesidir.

**C-002 (hakediş vade tarihi kayboluyor):** Doğrudan Root Cause B'nin sonucu — `AdminGovernmentProgressPayments.tsx`'in `GppDialog`'u.

### Değişen dosyalar
- `src/pages/admin/AdminGovernmentProgressPayments.tsx` — `GppDialog`/`BreakdownDialog`'a `CardEntryForm.tsx` ile aynı `wasOpen` ref deseni eklendi (yalnızca kapalı→açık geçişinde reset); `emptyColForm()`'daki UTC tabanlı "bugün" `todayIsoLocal()` ile değiştirildi; test edilebilmesi için `GppDialog`/`BreakdownDialog` export edildi.
- `src/components/admin/finance/CardEntryForm.tsx` — `today()` yerine paylaşılan `todayIsoLocal()` kullanılıyor (UTC gün kayması riski ortadan kalktı).
- `src/pages/admin/AdminCustomerDetail.tsx` — gecikme/durum karşılaştırmalarında kullanılan `today` değişkeni `todayIsoLocal()`'a taşındı.
- `src/lib/finance.ts` — yeni `todayIsoLocal()` yardımcı fonksiyonu eklendi (tek kaynak); `daysUntil()` UTC-parse + local-setHours kaymasını önleyecek şekilde yerel Y/M/D bileşenleriyle yeniden yazıldı.
- `public_html/api/admin/helpers.php` — `date_default_timezone_set('Europe/Istanbul')` eklendi (tüm admin endpoint'leri için tek, paylaşılan bootstrap noktası); yeni `nullable_iso_date()` yardımcı fonksiyonu eklendi (opsiyonel tarih alanları için — boşsa `null`, doluysa format doğrulaması yapar, sessizce veri tabanına yazmaz).
- `public_html/api/admin/government-progress-payments.php` — `create_collection`/`update_collection`'da `collection_date` doğrulaması `require_non_empty()`'den `require_iso_date()`'e; `gpp_payload()`'da `due_date` ve breakdown update'te `due_date`/`paid_date` doğrulaması `nullable_string()`'ten `nullable_iso_date()`'e yükseltildi — dört akışın tamamı artık aynı doğrulama sözleşmesini paylaşıyor.
- `src/test/gpp-dialog-date-persists-on-refetch.test.tsx` — yeni. `GppDialog`/`BreakdownDialog` için aynı-açık-durum refetch regresyon testi (mevcut `card-entry-form-date-persists-on-refetch.test.tsx` deseninin doğrudan taşınması).
- `src/test/finance-date-helpers-timezone.test.ts` — yeni. `todayIsoLocal()`/`daysUntil()`/`derivePlanStatus()` için Europe/Istanbul ve UTC saat dilimlerinde gün kayması önleme + geçmiş/gelecek sınıflandırma testleri.
- `tools/finance-entry-date-validation-test.php` — yeni. `require_iso_date()`/`nullable_iso_date()` kabul/red sözleşmesi (subprocess tabanlı, `json_error()`'ın `exit()` etmesi nedeniyle), `fe_auto_status()`/`fe_is_overdue()` geçmiş/gelecek sınıflandırması ve yerel DB'ye karşı EUR/TRY hesap regresyonu.

### Testler
- Komut: `npx tsc --noEmit` → Sonuç: PASS (hata yok).
- Komut: `npm run lint` → Sonuç: 263 problem / 232 hata — `git stash` ile ölçülen değişiklik-öncesi taban çizgisiyle birebir aynı sayı; bu iş paketi **sıfır** yeni hata/uyarı ekledi (doğrulama: stash → lint → aynı sayı → stash pop).
- Komut: `npm run build` → Sonuç: PASS, `dist/` başarıyla üretildi.
- Komut: `find public_html/api -iname "*.php" | xargs -I{} php -l {}` → Sonuç: PASS, tüm dosyalarda "No syntax errors detected".
- Komut: `php tools/finance-entry-date-validation-test.php` → Sonuç: PASS, "All 20 checks passed." (yerel `akinal_local` DB'sine karşı, salt-okunur).
- Komut: `npm run test` (`vitest run`, tam paket) → Sonuç: PASS, 28 dosya / 150 test, 0 başarısız.
- Ek doğrulama: `GppDialog`'un `wasOpen` düzeltmesi geçici olarak eski (hatalı) `useEffect` deseniyle değiştirilip yeni regresyon testi tekrar çalıştırıldı → test kırmızı oldu (`expected '' to be '2026-10-20'` ve `expected '2026-09-01' to be '2026-10-20'`), bu da testin gerçekten bu hata sınıfını yakaladığını kanıtladı; ardından düzeltme geri yüklendi ve test tekrar yeşil oldu.

### Kabul kriterleri
Yukarıdaki P0 bölümlerindeki (C-001 D, C-002 C) işaretlere bakınız. Özet:
- [x] Dört akışın tamamında (gelir, gider, masraf kartı gideri, hakediş vade tarihi) kullanıcı tarafından seçilen tarih artık create/edit/reload sonrasında korunuyor — kod düzeyinde kök neden giderildi ve regresyon testleriyle kilitlendi.
- [x] Eksik/geçersiz tarih artık açık 4xx hatası döndürüyor (sessiz `CURDATE()` fallback'i hiçbir yerde bulunmadı/eklenmedi).
- [x] Timezone gün kayması (Europe/Istanbul + UTC) hem frontend hem backend'de giderildi ve test edildi.
- [x] Geçmiş/gelecek durum sınıflandırması (`Gecikmiş`/`Planlanan`) doğru çalışıyor.
- [x] Doğrulanmış tutar mutabakatı (TRY/EUR dahil) bozulmadı.
- [ ] Bildirimler ekranının ve tarih-kesimli finans raporlarının canlı/QA veri setiyle yeniden test edilmesi — kök neden giderildi ancak ekran bazında yeniden test bu iş paketinin kapsamında **yapılmadı** (bkz. Riskler).

### Riskler / açık konular
- **Dağıtım durumu bilinmiyor:** `1089c12` commit'i (Root Cause A düzeltmesi) bu QA turundan önce yapılmış olsa da, dağıtım `deploy-akinal.bat` → `scripts/deploy_ftp.py` ile manuel FTP diff-upload'tur (CI/CD yok). Bu commit'in canlıya gerçekten push edilip edilmediği bu oturumdan doğrulanamadı (yalnızca local çalışıldı, production'a erişilmedi/dokunulmadı). Kullanıcı bir sonraki deploy'da bu iş paketindeki TÜM değişikliklerin (Root Cause A + B + timezone + validation) canlıya gitmesini sağlamalı.
- **Bildirim/rapor ekranlarının canlı yeniden testi eksik:** Kök neden kod seviyesinde giderildi ve `notifications.php`'nin `entry_date`'i doğrudan okuduğu doğrulandı, ancak "Bugünkü Tahsilat" ve tarih-kesimli rapor ekranlarının gerçek/QA verisiyle yeniden test edilmesi bu oturumun kapsamında değildi.
- **Hakediş `due_date`'i bildirim akışına bağlı değil:** `notifications.php` şu anda yalnızca `ak_customer_financial_entries.entry_date` üzerinden bildirim üretiyor; devlet hakedişi `due_date`'i hiç bildirim üretmiyor. Bu, C-002'nin kapsamındaki bir regresyon değil, önceden var olan bir tasarım boşluğu — ayrı bir P2/P3 maddesi olarak değerlendirilmeli.
- **`CollectionDialog` (hakediş tahsilatı) için edit yüzeyi yok:** Yalnızca create destekleniyor; `updateGppCollection` API fonksiyonu mevcut ama UI'da bağlı değil. Bu QA turunda yeni bir edit akışı eklenmedi (kapsam dışı); "tahsilat tarihi create/edit/reload" kabul kriteri bu nedenle yalnızca create + backend'in şimdi `require_iso_date()` ile doğru doğrulama yapması üzerinden karşılandı.
- **P1 (AKINAL-QA-C-005, personel rol/maliyet/atama/tahsisat) ve P2/P3 maddeleri bu iş paketinde ele alınmadı** — TODO talimatı gereği yalnızca C-001/C-002 (release gate) kapsandı.
- Legacy/bağlı-olmayan `FinancialStatementPage.tsx` (ve onu kullanan `AdminCustomerFinance.tsx`/`AdminEmployeeFinance.tsx`) içinde de aynı UTC-"bugün" deseni (`new Date().toISOString().slice(0, 10)`) tespit edildi, ancak bu sayfalar `AdminLayout` nav'ında bağlı değil (yalnızca doğrudan URL ile erişilebilir, QA raporunda test edilmedi) — kapsam dışı bırakıldı, ilgisiz refactor yapılmadı.

### Sonraki önerilen iş
1. Bu commit'i içeren bir deploy çalıştırıp canlıda `1089c12` + bu paketin tamamının yayında olduğunu doğrulamak (kullanıcı onayı ile, ayrı adım).
2. Canlı/QA ortamında C-001/C-002'nin repro adımlarını (rapor bölüm 7) yeniden çalıştırıp Bildirimler ve tarih-kesimli rapor ekranlarını gözle doğrulamak.
3. `AKINAL-QA-C-005` (P1) iş paketine geçmek.
4. Hakediş `due_date`'ini bildirim akışına bağlamayı ayrı bir P2 maddesi olarak değerlendirmek.

### Güvenlik onayı
Bu iş paketinde: **deploy yapılmadı, production migration çalıştırılmadı, manuel/otomatik yedek alınmadı veya geri yüklenmedi, ayar değiştirilmedi, medya yüklenmedi, proje yayınlanmadı/yayından kaldırılmadı, hiçbir gerçek veya demo kayıt düzenlenmedi ya da silinmedi, `ak_profiles`/`ak_user_roles`'a dokunulmadı.** Tek veritabanı etkileşimi, yerel `akinal_local` geliştirme veritabanına karşı çalışan `tools/finance-entry-date-validation-test.php` script'indeki salt-okunur `SELECT` sorgusuydu.
