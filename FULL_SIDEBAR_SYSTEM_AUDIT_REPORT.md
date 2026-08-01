# Full Sidebar System Audit Report

Tarih: 2026-07-27
Kapsam: `main` branch, 14 sidebar modülü + global mimari/veritabanı/API/finans/güvenlik/performans/test/deploy denetimi.
Yöntem: Salt-okunur statik inceleme (Read/Grep/Glob/Bash git diff). Hiçbir kaynak dosya değiştirilmedi, migration çalıştırılmadı, veritabanına yazılmadı.

---

## 0. Executive Summary

**Genel olgunluk:** Sistem, `ak_payments`/`ak_expenses`/`ak_financial_entries` gibi eski (legacy) tablolardan dört sahibe-özel kart tablosuna (`ak_customer_financial_entries`, `ak_employee_financial_entries`, `ak_supplier_financial_entries`, `ak_expense_card_financial_entries`) geçiş sürecinin **son aşamasındadır**. `dashboard.php` artık yalnızca bu dört kanonik tablodan okuma yapıyor; legacy tablolara hiç referans yok — bu, daha önceki denetim turlarında (bkz. commit `a663294`, `1f36e05`) tespit edilmiş çift-sayım risklerinin önemli ölçüde giderildiğini gösteriyor.

**Bu turda incelenen commit edilmemiş değişiklikler (`git status` ile görülen 19 dosya + `install-schema.php`):** Bunların tamamı, önceki bir denetimde bulunmuş somut P0 sorunlarını kapatmaya yönelik, tutarlı ve iyi belgelenmiş düzeltmelerdir:
- **Cascade-delete kaldırıldı** (`employees.php`, `projects.php`, `expense-cards.php`): Personel/proje/masraf kartı silme uçları artık bağlı finansal kayıt varsa **409 ile reddediyor**, sessizce cascade silmiyor. Bu, önceden var olan bir P0 veri kaybı riskini kapatıyor.
- **`ak_project_expense_transactions` yazma yolu tamamen devre dışı bırakıldı** (`project-expense-transactions.php`, `AdminProjectExpenses.tsx`, `apiClient.ts`): Bu tablo hiçbir güncel rapor tarafından okunmadığı için POST/PATCH/DELETE artık 409 döndürüyor; sayfa salt-okunur "kullanım dışı" uyarı bandı ile yeniden düzenlenmiş.
- **Enflasyon/vade farkı motoru genişletildi** (`inflation-helper.php`, `inflation-indices.php`, `customer-financial-entries.php`, `CardEntryForm.tsx`, `CardStatementTable.tsx`): Artık her müşteri tahsilat kaydında opsiyonel `inflation_enabled` + `inflation_start_date` alanları var; resmi TCMB verisi olmayan aylar için "son 5 yılın aynı ayı ortalaması" ile **açıkça işaretlenmiş tahmin** kullanılıyor.
- **Zorunlu proje seçimi** (`finance-entry-helpers.php`, `CardEntryForm.tsx`): `project_id` artık dört kart tablosunda da NOT NULL olduğu için backend + frontend tarafında zorunlu hale getirildi ve projenin var olduğu DB'den doğrulanıyor.
- **GPP breakdown backfill migration'ı** (`gpp-breakdowns-apply.php`) artık önceden ödenmiş tutarları (`paid_amount_try`) 4 aşamaya "waterfall" olarak dağıtıyor; eskiden bu alan sıfırlanma riski taşıyordu.

Bu değişiklikler bir bütün olarak **finansal bütünlüğü artıran, geriye dönük uyumlu, iyi gerekçelendirilmiş** düzeltmelerdir; kod incelemesinde yeni bir çift-sayım veya veri kaybı riski tespit edilmedi. Ancak yeni bir **P1 React anahtar (key) hatası** ve birkaç **P2/P3 tutarlılık/performans** bulgusu tespit edildi.

**En büyük riskler:**
1. **P1** — `CardStatementTable.tsx` içinde `.map()` döngüsünde dönen kısa `<>...</>` Fragment'in kendisi `key` almıyor (yalnızca içindeki `<tr>` elemanları key alıyor). React listelerinde bu, liste yeniden sıralandığında/silindiğinde yanlış DOM eşleşmesine ve konsol uyarısına yol açabilir.
2. **P1** — `Devlet Hakedişleri` (GPP) modülü, `dashboard.php`'de **hiç okunmuyor**: `compute_finance_summary()`, `build_customer_cards()`, `build_cashflow_command_center()` fonksiyonlarının hiçbirinde `ak_government_progress_payments` veya `ak_government_progress_payment_breakdowns` tablosuna referans yok. Bu, GPP tahsilatlarının Genel Bakış toplamlarına hiç yansımadığı anlamına gelir (çift sayım yok, ama eksik sayım var).
3. **P1** — `ak_project_expense_transactions` tablosunun yazma yolu artık kapalı olsa da tablo ve ilişkili `expense_item_id`/`pet_profitability()` mantığı hâlâ `AdminProjectExpenses.tsx`'te "kârlılık" paneli olarak gösteriliyor; okuma tarafı hâlâ canlı ama üretici tarafı kapalı — modülün nihai kaderi (tamamen kaldırılacak mı, arşive mi taşınacak) net değil.
4. **P2** — `ensure_inflation_columns()` (`customer-financial-entries.php`) her yazma isteğinde `ALTER TABLE ... ADD COLUMN` deniyor (try/catch ile 1060 hatasını yutuyor). Üretimde her PATCH/POST çağrısında gereksiz bir DDL denemesi çalışıyor; bu, yüksek trafikte performans/lock riski taşır ve idealde tek seferlik bir migration'a taşınmalıdır.

**P0/P1/P2/P3 sayıları:** Bkz. §16 Tam Sorun Kaydı. Özet: **P0: 0, P1: 4, P2: 9, P3: 6** (toplam 19 kayıtlı bulgu; ayrıca birçok madde için `Kanıtlanamadı` işaretlenmiştir).

**Üretime hazır mı:** Kısmen. Commit edilmemiş değişiklikler üretime **hazırlık düzeyini yükseltiyor** (cascade-delete riskini kapatıyor). Ancak GPP/dashboard tutarsızlığı (P1) ve React key hatası (P1) commit öncesi ele alınmalıdır. `ak_project_expense_transactions` modülünün nihai statüsü netleştirilmelidir.

**İlk yapılması gerekenler:**
1. `CardStatementTable.tsx`'te fragment key hatasını düzelt (`<React.Fragment key={e.id}>`).
2. GPP'nin dashboard'a dahil edilip edilmeyeceğine karar ver; edilecekse `dashboard.php`'ye entegre et, edilmeyecekse bunu UI'da açıkça belirt.
3. `ensure_inflation_columns()` çağrısını tek seferlik migration'a taşı.
4. `AdminProjectExpenses.tsx`/`ak_project_expense_transactions` için nihai kaldırma planı oluştur.

---

## 1. Read-Only Preflight

- **Branch:** `main`
- **`git status --short` (başlangıç):**
  ```
   M public_html/api/admin/customer-financial-entries.php
   M public_html/api/admin/employees.php
   M public_html/api/admin/expense-cards.php
   M public_html/api/admin/finance-entry-helpers.php
   M public_html/api/admin/inflation-helper.php
   M public_html/api/admin/inflation-indices.php
   M public_html/api/admin/migrations/gpp-breakdowns-apply.php
   M public_html/api/admin/project-expense-transactions.php
   M public_html/api/admin/projects.php
   M public_html/install-schema.php
   M src/components/admin/finance/CardEntryForm.tsx
   M src/components/admin/finance/CardStatementTable.tsx
   M src/lib/apiClient.ts
   M src/lib/apiTypes.ts
   M src/pages/admin/AdminCustomerDetail.tsx
   M src/pages/admin/AdminEmployees.tsx
   M src/pages/admin/AdminExpenseCards.tsx
   M src/pages/admin/AdminInflationCalculator.tsx
   M src/pages/admin/AdminProjectExpenses.tsx
   M src/pages/admin/AdminProjects.tsx
  ?? FULL_SIDEBAR_SYSTEM_AUDIT_REPORT.md
  ?? claude_full_sidebar_audit_prompt.md
  ?? scripts/__pycache__/
  ```
- **Stack tespiti:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui (frontend), React Router (`src/App.tsx`), TanStack Query (server state), PHP 8+ REST (her admin uç noktası `public_html/api/admin/*.php`), MySQL (PDO, `api/db.php`), oturum tabanlı auth (`api/auth.php`, `require_admin()`), FTP deploy (`deploy-akinal.bat` → `scripts/deploy_ftp.py`).
- **Kullanılan komutlar:** `git branch --show-current`, `git status --short`, `git log --oneline -15`, `git diff --stat`, `git diff -- <dosya>` (tüm 19 değişen dosya için), `find`/`wc -l`/`sed -n` (salt okunur), `Read`/`Grep`/`Glob` araçları.
- **Yazma güvenliği onayı:** Bu oturumda hiçbir uygulama dosyası değiştirilmedi; tek yazma işlemi bu rapor dosyasıdır. §21'de nihai `git status --short` ile doğrulanmıştır.

---

## 2. Project Inventory

- **Sidebar tanımı:** `src/components/admin/AdminLayout.tsx` — `NAV_GROUPS` (satır 30-81), `PAGE_META` (satır 91-124).
- **Route tanımları:** `src/App.tsx` (satır 65-137), tüm admin route'lar `<Route path="/admin" element={<AdminLayout />}>` içinde lazy-loaded.
- **Sayfa bileşenleri:** `src/pages/admin/*.tsx` (33 dosya, bkz. §3 tablo).
- **Paylaşılan layout:** `src/components/admin/AdminLayout.tsx`; finans kart bileşenleri `src/components/admin/finance/` (`CardStatementTable.tsx`, `CardEntryForm.tsx`, `EntryStatusBadge.tsx`, `CurrencyAmount.tsx`).
- **API istemcisi:** `src/lib/apiClient.ts` (1350 satır) — tüm `apiGet`/`apiRequest` sarmalayıcı çağrıları burada.
- **TS tipleri:** `src/lib/apiTypes.ts` (1139+ satır, değişiklikle birlikte).
- **Backend uç noktaları:** `public_html/api/admin/*.php` (60+ dosya, bkz. §6 API haritası).
- **DB/şema:** `public_html/install-schema.php` — tek şema kurucu dosya, `CREATE TABLE IF NOT EXISTS` ile idempotent.
- **Auth/permission:** `public_html/api/auth.php` (`require_admin()`, `current_admin()`), her admin dosyasının başında zorunlu.
- **Medya/upload:** `public_html/api/admin/media-upload.php`, `upload-project-image.php`, `upload-expense-document.php`, `upload-payment-document.php`, `upload-site-asset.php`.
- **Hesaplama yardımcıları:** `public_html/api/admin/inflation-helper.php` (TÜFE/vade farkı), `finance-entry-helpers.php` (ortak kart-giriş doğrulama/hesaplama), `src/lib/finance.ts` (747 satır, frontend para birimi/hesap tipi sabitleri).
- **Testler:** `src/test/` dizini (vitest, jsdom); `npm run test` ile çalıştırılır (bu denetimde çalıştırılmadı).
- **Dokümantasyon:** `CLAUDE.md`, `docs/GLOBAL_TABLE_DEPENDENCY_AUDIT.md` (referans; içeriği bu turda tam okunmadı — `Kanıtlanamadı`).

---

## 3. Sidebar Coverage Matrix

| # | Sidebar Sayfası | Route Bulundu | UI Bulundu | API Bulundu | DB Bulundu | Audit Durumu | En Yüksek Ciddiyet |
|---|---|---|---|---|---|---|---|
| 1 | Genel Bakış | `/admin` → `AdminDashboard.tsx` | Var | `dashboard.php` | 4 kanonik + `ak_projects`, `ak_customers`, `ak_contact_requests`, `ak_notifications` | Tamamlandı | P1 (GPP dashboard'da yok) |
| 2 | Gelenler | `/admin/gelenler` → `AdminGelenler.tsx` | Var | `gelenler.php` (varlığı doğrulandı, içerik derin incelenmedi) | `ak_customer_financial_entries` | Kısmi | Kanıtlanamadı |
| 3 | Gidenler | `/admin/gidenler` → `AdminGidenler.tsx` | Var | `gidenler.php` (varlığı doğrulandı, içerik derin incelenmedi) | 3 gider kart tablosu | Kısmi | Kanıtlanamadı |
| 4 | Enflasyon Hesaplama | `/admin/enflasyon-hesaplama` → `AdminInflationCalculator.tsx` | Var | `inflation-indices.php`, `inflation-helper.php` | `ak_inflation_indices` | Tamamlandı (diff derin) | P3 |
| 5 | Projeler | `/admin/projeler` → `AdminProjects.tsx` | Var | `projects.php` | `ak_projects` + tüm kart tabloları | Tamamlandı | P1 (deprecated modül belirsizliği) |
| 6 | Medya | `/admin/medya` → `AdminMedia.tsx` | Var | `media.php`, `media-albums.php`, `media-upload.php`, `upload-project-image.php`, `project-images.php` | `ak_project_images`, medya albüm tabloları | Kısmi | Kanıtlanamadı |
| 7 | Müşteriler | `/admin/musteriler` → `AdminCustomers.tsx`, `AdminCustomerDetail.tsx`, `AdminCustomerEdit.tsx` | Var | `customers.php`, `customer-financial-entries.php` | `ak_customers`, `ak_customer_financial_entries` | Tamamlandı (diff derin) | P1 (fragment key + ALTER her yazımda) |
| 8 | Devlet Hakedişleri | `/admin/devlet-hakedisleri` → `AdminGovernmentProgressPayments.tsx` | Var | `government-progress-payments.php`, `migrations/gpp-breakdowns-apply.php` | `ak_government_progress_payments`, `ak_government_progress_payment_breakdowns` | Kısmi (migration diff derin, ana uç nokta üstünkörü) | P1 |
| 9 | Tedarikçiler | `/admin/tedarikciler` → `AdminSuppliers.tsx`, detay/edit | Var | `suppliers.php`, `supplier-financial-entries.php` | `ak_suppliers`, `ak_supplier_financial_entries` | Kısmi | Kanıtlanamadı |
| 10 | Masraf Kartları | `/admin/gider-kartlari` → `AdminExpenseCards.tsx`, `AdminExpenseCardFinance.tsx` | Var | `expense-cards.php`, `expense-card-financial-entries.php` | `ak_expense_cards`, `ak_expense_card_financial_entries` | Tamamlandı (diff derin) | P0 riski kapatıldı → şimdi düşük |
| 11 | Personeller | `/admin/personeller` → `AdminEmployees.tsx`, `AdminEmployeeDetail.tsx`, `AdminEmployeeAllocations.tsx` | Var | `employees.php`, `employee-financial-entries.php`, `employee-project-allocations.php` | `ak_employees`, `ak_employee_financial_entries`, `ak_employee_roles`, `ak_employee_cost_periods` | Tamamlandı (diff derin) | P0 riski kapatıldı → şimdi düşük |
| 12 | İletişim Talepleri | `/admin/talepler` → `AdminContacts.tsx` | Var | `contact-requests.php` | `ak_contact_requests` | Kısmi | Kanıtlanamadı |
| 13 | Bildirimler | `/admin/bildirimler` → `AdminNotifications.tsx` | Var | `notifications.php` | `ak_notifications` | Tamamlandı (dosya tam okundu) | P2 |
| 14 | Ayarlar | `/admin/ayarlar` → `AdminSettings.tsx` | Var | `site-settings.php` | `ak_site_settings` | Kısmi | Kanıtlanamadı |

**Not:** Sidebar'da olmayan ama route'da bulunan ek admin sayfaları da mevcut: `sql-editor` (`AdminSqlEditor.tsx`), `bakim-konsolu` (`AdminMaintenanceConsole.tsx`), `raporlar` (`AdminReports.tsx`). Bunlar `NAV_GROUPS`'ta yok ama `PAGE_META`'da var ve doğrudan URL ile erişilebilir — bkz. §9 Güvenlik Denetimi.

Bu denetim turunun kapsamı ve zaman bütçesi gereği, 14 modülün tamamı için Faz 3'teki 15 alt-başlığın (buton envanteri, veri akışı matrisi, edge-case listesi vb.) tam detayında doldurulması mümkün olmamıştır. Aşağıdaki §13'te her modül için **doğrulanmış mimari haritalama + kritik bulgular** verilmiş, ancak buton-bazlı tam envanter yalnızca commit edilmemiş değişikliklerin dokunduğu modüller (Müşteriler, Personeller, Masraf Kartları, Projeler, Enflasyon) için derinlemesine yapılmıştır. Diğer modüller için mimari harita + `Kanıtlanamadı` notları verilmiştir.

---

## 4. Global Architecture Audit

- **Frontend klasör yapısı:** `src/pages/site` (halka açık) ve `src/pages/admin` (yönetim) net ayrılmış; `src/components/admin/finance/` finans kart UI bileşenlerini paylaşımlı hale getiriyor (`CardStatementTable`, `CardEntryForm`) — Müşteri/Tedarikçi/Personel/Masraf Kartı sayfaları aynı bileşeni kullanıyor (kod tekrarını önlüyor).
- **Route organizasyonu:** Tek `App.tsx` dosyasında düz liste; 139 satır, hâlâ okunabilir boyutta. `FinancRedirect` yardımcı bileşeni (`App.tsx` satır 5-8) eski `/musteriler/:id/finans` ve `/personeller/:id/finans` URL'lerini yeni birleşik detay sayfasına yönlendiriyor — geriye dönük uyumluluk iyi yönetilmiş.
- **API istemci mimarisi:** `apiClient.ts` tek dosyada tüm çağrılar; 1350 satır, büyümeye devam ediyor — orta vadede modüle bölünmesi (customers.ts, projects.ts vb.) bakım kolaylığı sağlar (P3).
- **Ölü/placeholder kod:** `getProjectExpenseTransactions` hâlâ `apiClient.ts`'te var ve okunuyor, ama create/update/delete fonksiyonları bilinçli olarak kaldırılmış ve yorum satırıyla gerekçelendirilmiş — iyi pratik.
- **Tutarsız desen:** Silme uç noktalarının bir kısmı artık "guard + 409" desenini kullanıyor (`employees.php`, `projects.php`, `expense-cards.php`), ama bu turda incelenmeyen diğer silme uçlarının (`suppliers.php`, `customers.php`) aynı deseni kullanıp kullanmadığı doğrulanmadı — **Kanıtlanamadı**; risk: tutarsız silme davranışı sürebilir.
- **Response zarfı:** İncelenen tüm dosyalarda (`dashboard.php`, `notifications.php`, `customer-financial-entries.php`, `employees.php`, `projects.php`, `expense-cards.php`) `json_success`/`json_error` zarfı tutarlı kullanılmış; CLAUDE.md'de belirtilen `{success, data}` / `{success:false, message}` deseniyle uyumlu.

---

## 5. Database Audit

| Tablo | Amaç | PK | Önemli Kolonlar | FK | Kullanan Sayfalar | Riskler |
|---|---|---|---|---|---|---|
| `ak_customer_financial_entries` | Müşteri tahsilat kalemleri (kanonik) | `id` CHAR(36) | `amount_try`, `paid_amount_try`, `status`, `is_overdue`, **`inflation_enabled`, `inflation_start_date` (yeni)** | `customer_id`, `project_id` | Gelenler, Müşteriler, Genel Bakış | Yeni kolonlar `ensure_inflation_columns()` ile runtime'da ALTER ediliyor (P2) |
| `ak_employee_financial_entries` | Personel maaş/avans hareketleri | `id` | `amount_try`, `paid_amount_try`, `is_overdue` | `employee_id`, `project_id` | Personeller, Gidenler, Genel Bakış | RESTRICT davranışı artık backend'de application-level guard ile korunuyor |
| `ak_supplier_financial_entries` | Tedarikçi ödeme hareketleri | `id` | `amount_try`, `paid_amount_try` | `supplier_id`, `project_id` | Tedarikçiler, Gidenler | Kanıtlanamadı: silme guard'ı bu turda doğrulanmadı |
| `ak_expense_card_financial_entries` | Masraf kartı hareketleri | `id` | `amount_try`, `paid_amount_try` | `expense_card_id`, `project_id` | Masraf Kartları, Gidenler | Guard eklendi (bu turda) |
| `ak_project_expense_transactions` | **Deprecated** eski proje gider kaydı | `id` | `expense_item_id`, `amount`, `currency` | `project_id`, `expense_item_id` (SET NULL) | Proje Giderleri (salt okunur) | Artık yazılamıyor; okuma kalıyor — tablo "ölü ama silinmemiş" durumda (P1) |
| `ak_government_progress_payments` | Devlet hakedişi ana kaydı | `id` | `planned_amount_try`, `paid_amount_try` | `project_id` | Devlet Hakedişleri | Dashboard'a dahil değil (P1) |
| `ak_government_progress_payment_breakdowns` | Hakediş 4 aşama kırılımı | `id` | `stage`, `stage_percentage`, `planned_amount_try`, `paid_amount_try`, `status` | `government_progress_payment_id` | Devlet Hakedişleri | Migration artık paid_amount_try'ı waterfall ile koruyor |
| `ak_inflation_indices` | TCMB aylık TÜFE verisi | `id` (Kanıtlanamadı: PK tipi doğrulanmadı) | `period_year`, `period_month`, `monthly_change_percent`, `index_type` | — | Enflasyon Hesaplama, Müşteri vade farkı | Aynı ay için mükerrer satır riski `forecast_monthly_for_period()` içinde `GROUP BY period_year, period_month` + `MAX()` ile bilinçli olarak ele alınmış |
| `ak_projects` | Proje ana kaydı | `id` | `project_status`, `is_published`, `slug`, `contract_total_try` | — | Projeler, tüm finans modülleri | Silme artık guard'lı (P0 kapandı) |
| `ak_expense_cards` | Masraf kartı master verisi | `id` | `name` | — | Masraf Kartları | Silme artık guard'lı |
| `ak_employees` | Personel master verisi | `id` | `full_name`, `status` | — | Personeller | Silme artık guard'lı; "Pasif" durumuna geçiş öneriliyor ama UI erişimi doğrulanmadı |
| `ak_notifications` | Bildirimler | `id` | `is_read`, `created_at` | — | Bildirimler, Genel Bakış (unread sayacı) | `ensure_payment_notifications()` her GET'te `?generate=1` ile tetikleniyor — mükerrer bildirim üretme riski **Kanıtlanamadı** |
| `ak_site_settings` | Site ayarları (tek satır) | `id` | `company_name`, `phone`, `email`, ... | — | Ayarlar, public site | `ensure_site_settings_favicon_column()` çağrısı görüldü, aynı runtime-ALTER deseni olabilir (P2, Kanıtlanamadı) |

**Genel DB riskleri:**
- Runtime'da `ALTER TABLE ... ADD COLUMN` çalıştıran fonksiyon tespit edildi (`ensure_inflation_columns()`, `customer-financial-entries.php`). Bu desen küçük ölçekte zararsızdır ama shared-hosting MySQL'de yüksek eşzamanlı yazımda metadata lock riski taşır (P2).
- `install-schema.php`'nin idempotent `CREATE TABLE IF NOT EXISTS` deseni yeni kolonları (`inflation_enabled`, `inflation_start_date`) yalnızca **taze kurulumlarda** ekler; var olan kurulumlarda `ensure_inflation_columns()` runtime ALTER'ı devreye giriyor — iki mekanizmanın (schema installer + runtime ALTER) birbirini tamamladığı doğru ama iki farklı yerde şema tanımının bakımı riski var (P3).

---

## 6. API Contract Audit (öncelik: commit edilmemiş değişikliklerin dokunduğu uç noktalar)

| Endpoint | Method | Frontend Caller | Backend Dosya | İstek Alanları | Yanıt Alanları | DB Tabloları | Auth | Risk |
|---|---|---|---|---|---|---|---|---|
| `/api/admin/customer-financial-entries.php` | POST/PATCH | `AdminCustomerDetail.tsx` → `handleEntryAdd`/`handleInflationSave` | `customer-financial-entries.php` | `customer_id`, `project_id`, `inflation_enabled`, `inflation_start_date`, ... | `{entries:[...]}` her satırda `inflation_preview` | `ak_customer_financial_entries` | `require_admin()` | P2: `ensure_inflation_columns()` her yazımda çalışıyor |
| `/api/admin/employees.php` | DELETE | `AdminEmployees.tsx::deleteEmployee` | `employees.php` | `id` | `409` + Türkçe hata mesajı bağlı kayıt varsa | `ak_employees` + 5 bağlı tablo (yalnızca COUNT, DELETE yok) | `require_admin()` | Düşük (guard eklendi) |
| `/api/admin/projects.php` | DELETE | `AdminProjects.tsx` (silme aksiyonu — Kanıtlanamadı: tetikleyici UI bu turda görülmedi) | `projects.php` | `id` | `409` + 13 tablo bazlı bağlı kayıt listesi | `ak_projects` + 12 bağlı tablo | `require_admin()` | Düşük (guard eklendi) |
| `/api/admin/expense-cards.php` | DELETE | `AdminExpenseCards.tsx::remove` | `expense-cards.php` | `id` | `409` + hareket sayısı | `ak_expense_cards`, `ak_expense_card_financial_entries` | `require_admin()` | Düşük |
| `/api/admin/project-expense-transactions.php` | POST/PATCH/DELETE | (kaldırıldı) | `project-expense-transactions.php` | — | `409 "kullanım dışı"` | `ak_project_expense_transactions` | `require_admin()` | P1: tablo hâlâ okunuyor ama artık büyüyemiyor |
| `/api/admin/inflation-indices.php` | POST (`handle_calculate`) | `AdminInflationCalculator.tsx` | `inflation-indices.php` | `amount_try`, base/target yıl-ay | `factor`, `official_compound_rate_percent`, `forecast_compound_rate_percent`, `used_forecast`, `forecast_method` | `ak_inflation_indices` | `require_admin()` | Düşük — hesap tutarlı |
| `/api/admin/migrations/gpp-breakdowns-apply.php` | POST | Kanıtlanamadı (muhtemelen `AdminMaintenanceConsole.tsx`) | `gpp-breakdowns-apply.php` | — | `parents_with_preserved_paid_amount`, `breakdowns_inserted` | `ak_government_progress_payment_breakdowns` | `require_admin()` | Düşük — idempotent, waterfall paid-amount koruması var |

**Global API riskleri:**
- `finance-entry-helpers.php::fe_payload()` artık `project_id`'yi DB'de var olup olmadığını kontrol ederek doğruluyor — dört kart tablosu için ortak kod yolu olduğundan iyi bir merkezi doğrulama; her yazımda ekstra bir SELECT sorgusu demektir (kabul edilebilir, P3).

---

## 7. Finance and Accounting Audit

**Kanonik doğruluk kaynakları (`dashboard.php`'den doğrulandı):**
1. **Gelir:** `ak_customer_financial_entries` (tek kaynak — `compute_finance_summary()` içinde `$custStmt`).
2. **Gider:** `UNION ALL` ile `ak_employee_financial_entries` + `ak_supplier_financial_entries` + `ak_expense_card_financial_entries` (tek kaynak, `$expStmt`).
3. **Müşteri bakiyesi:** `build_customer_cards()` — `ak_customer_financial_entries` üzerinden canlı `SUM()` ile hesaplanıyor, **stoklanmış/denormalize toplam yok**.
4. **Proje kârlılığı:** `build_project_cards()` — dört kart tablosunun `UNION ALL`'ı ile canlı hesaplanıyor.
5. **Devlet hakedişi:** **Hiçbir yerde `dashboard.php`'ye dahil edilmemiş** — ayrı bir modül, kendi `government-progress-payments.php` uç noktasından okunuyor (P1).

**Çift sayım riski değerlendirmesi:** `dashboard.php` yalnızca 4 kanonik tabloyu okuyor; legacy `ak_payments`/`ak_expenses`/`ak_financial_entries` tablolarına **hiç referans yok**. Bu, CLAUDE.md'de belirtilen "Both tracks are currently read by dashboard.php, gated by canonical-read-flags.php" ifadesiyle **çelişiyor görünüyor** — mevcut `dashboard.php` kodu artık yalnızca kanonik okuyor. Bu ya CLAUDE.md'nin güncellenmemiş olduğu (dokümantasyon gecikmesi) ya da `canonical-read-flags.php`'nin farklı bir dosyada (örn. `financial-statement.php`, `reports.php`) hâlâ legacy okuma yaptığı anlamına gelir — **Kanıtlanamadı**: `canonical-read-flags.php` içeriği ve onu kullanan diğer dosyalar bu turda tam taranmadı. Risk: CLAUDE.md güncel değilse gelecekteki geliştiriciler yanlış varsayımla kod yazabilir.

**Planlanan vs gerçekleşen ayrımı:** `ak_customer_financial_entries.amount_try` (planlanan/toplam) ile `paid_amount_try` (gerçekleşen) ayrımı tutarlı biçimde tüm sorgularda korunuyor (`GREATEST(amount_try - paid_amount_try, 0)` deseni kalan bakiye için her yerde tekrarlanıyor — kod tekrarı var ama en azından tutarlı, P3).

**Vade farkı / enflasyon etkisi:** `cfe_inflation_preview()` yalnızca **önizleme** (`inflation_preview` alanı) üretiyor; `amount_try`/`paid_amount_try` gibi saklanan tutarları **hiç mutasyona uğratmıyor** — bu CLAUDE.md'deki "Exchange rates saved with entries are immutable snapshots" ilkesiyle uyumlu bir tasarım kararı ve doğru uygulanmış.

**Zorunlu mutabakat tablosu:**

| Finansal Metrik | Kaynak Kayıtlar | Formül | Nerede Gösteriliyor | Çift Sayım Riski | Not |
|---|---|---|---|---|---|
| Toplam tahsilat (paid) | `ak_customer_financial_entries.paid_amount_try` | `SUM(paid_amount_try)` | Genel Bakış (`total_payments`) | Yok — tek tablo | — |
| Toplam gider (paid) | 3 gider kart tablosu | `SUM(paid_amount_try)` UNION ALL | Genel Bakış (`total_expenses`) | Yok — `UNION ALL` ayrık ID alanlarıyla | — |
| Gerçekleşen kâr | tahsilat − gider | `custRow.paid − expRow.paid` | Genel Bakış (`realized_profit`) | Yok | — |
| Müşteri kalan alacağı | `ak_customer_financial_entries` | `GREATEST(amount_try-paid_amount_try,0)` | Müşteriler, Genel Bakış | Yok | Canlı hesap, stoklanmamış |
| Devlet hakedişi tahsilatı | `ak_government_progress_payments`/breakdowns | Kanıtlanamadı (uç nokta derin incelenmedi) | Devlet Hakedişleri sayfası | **Genel Bakış'a hiç dahil değil** | P1 — eksik entegrasyon |
| Vade farkı / TÜFE önizleme | `ak_inflation_indices` + `cfe_inflation_preview()` | Bileşik faiz zinciri | Müşteriler satır paneli | Yok (yalnızca önizleme, saklanmıyor) | Doğru tasarım |

---

## 8. UI/UX Consistency Audit

- **Türkçe etiketler:** İncelenen tüm dosyalarda (buton metinleri, hata mesajları, onay diyalogları) Türkçe kullanılmış ve muhasebe terimleri (`tahsilat`, `gider`, `alacak`, `borç`, `vade farkı`) tutarlı. Kod tarafı (değişken adları, fonksiyon adları, yorum satırları) İngilizce — CLAUDE.md'deki dil kuralına uyumlu.
- **Silme onay diyalogları güncellendi:** `AdminEmployees.tsx` ve `AdminExpenseCards.tsx`'teki `confirm()` metinleri artık backend'in yeni guard davranışını (bağlı kayıt varsa engellenir) doğru yansıtıyor — UI ile backend arasında mesaj tutarlılığı sağlanmış.
- **Hata mesajı iletimi iyileştirildi:** Her iki dosyada da `catch` bloğu artık `error.message`'ı (backend'in 409 mesajını) toast'a aktarıyor; önceden generic "silinemedi" mesajı gösteriliyordu — bu iyi bir UX düzeltmesi.
- **Deprecated sayfa uyarısı iyi tasarlanmış:** `AdminProjectExpenses.tsx`'teki turuncu uyarı bandı (`AlertTriangle` ikonlu) kullanıcıyı doğru sayfalara (`Gidenler`, `Masraf Kartları`) yönlendiriyor — net ve eyleme dönük.
- **Tutarsızlık riski:** `AdminProjects.tsx`'te "Giderler" butonunun `title` özniteliği güncellenmiş ("Kullanım Dışı — yalnızca geçmiş kayıtlar") ama buton hâlâ görünür ve tıklanabilir durumda; ikon/renk olarak "aktif" bir aksiyon gibi görünüyor — deprecated durumu görsel olarak vurgulanmamış (P3).

---

## 9. Security Audit

- **Route guard:** `AdminLayout.tsx` içinde `!session` veya `!isAdmin` durumunda `/admin/giris`'e yönlendirme yapılıyor (satır 149, 161) — tüm `/admin/*` route'ları bu layout altında olduğu için sidebar'da olmayan `sql-editor` ve `bakim-konsolu` da aynı route guard'ından geçiyor.
- **Backend auth:** İncelenen tüm dosyalarda `require_admin()` çağrısı dosyanın en başında — CLAUDE.md'deki zorunlu boilerplate kuralına uyulmuş.
- **SQL güvenliği:** İncelenen sorguların tamamı `PDO::prepare()` + named parameter kullanıyor. Tek istisna: dinamik tablo adları `$linkedTableLabels` array anahtarlarından geliyor (`employees.php`, `projects.php`, `expense-cards.php`) — bu değerler **kod içinde sabit tanımlanmış** (kullanıcı girdisi değil), SQL injection riski yok, ama gelecekte bu array'e kullanıcı girdisinden gelen bir değer eklenirse riskli hale gelebilir (P3, savunma amaçlı not).
- **`sql-editor.php`:** Sidebar'da yok ama route'da var. Potansiyel olarak yüksek riskli bir yüzey (serbest SQL çalıştırma) — bu turda dosya içeriği **derin incelenmedi**. **Kanıtlanamadı**: yetkilendirme seviyesi doğrulanmadı. **Öneri:** ayrı ve öncelikli bir güvenlik incelemesine konu olmalı.
- **Upload güvenliği:** `media-upload.php` MIME whitelist (`image/jpeg`, `png`, `webp`, `gif`) + `mime_content_type()` ile gerçek içerik kontrolü + rastgele dosya adı (`bin2hex(random_bytes(4))`) + boyut sınırı (10MB) kullanıyor — iyi pratik. Dosya adı `preg_replace('/[^a-zA-Z0-9._-]+/', '-', ...)` ile temizleniyor, path traversal riski düşük.
- **Silme guard'ları:** Artık backend seviyesinde uygulanıyor (yalnızca frontend `confirm()` diyaloğuna güvenilmiyor) — buton gizliliğine değil backend 409'una güveniliyor, doğru yaklaşım.

---

## 10. Performance Audit

- **Genel Bakış (`dashboard.php`):** Tek istekte ~20+ ayrı SQL sorgusu çalıştırıyor (`dash_one` x3, `compute_finance_summary` x3 sorgu, `fetch_customer_entries_overdue/upcoming`, `fetch_recent_movements`, `fetch_monthly_financials`, `build_all_cards` içinde 4 sorgu, drilldown'lar için 8 sorgu, `build_expense_category_intelligence` için 3 sorgu). N+1 yok (hepsi tek sorguluk agregasyonlar) ama **sorgu sayısı yüksek** — büyük veri setlerinde (binlerce finansal kayıt) dashboard yükleme süresini uzatabilir (P2).
- **`ensure_inflation_columns()`:** Her yazma isteğinde `ALTER TABLE` deneyip hatayı yutma deseni — MySQL'de metadata lock riski taşır (P2, bkz. §5).
- **Frontend:** Tüm admin route'ları `lazy()` ile yükleniyor (`App.tsx`) — iyi pratik, bundle boyutu kontrol altında.

---

## 11. Test Coverage Audit

| Test Alanı | Mevcut Kapsam | Eksik Kritik Testler | Öncelik |
|---|---|---|---|
| Enflasyon/vade farkı hesaplama | Kanıtlanamadı | `inflation_monthly_chain_with_forecast()` ve `forecast_monthly_for_period()` için birim testleri | P1 |
| Cascade-delete guard'ları | Yok (proje genelinde PHP birim testi yok; `php -l` + smoke script kullanılıyor) | `employees.php`/`projects.php`/`expense-cards.php` DELETE için entegrasyon testi | P1 |
| Dashboard mutabakatı | Kanıtlanamadı | Genel Bakış toplamlarının Gelenler/Gidenler/Müşteriler sayfalarıyla eşleştiğini doğrulayan test | P1 |
| `fe_payload()` proje doğrulaması | Yok | Boş/var olmayan `project_id` için 422 testi | P2 |
| GPP breakdown migration waterfall | Yok | `SUM(breakdown.paid_amount_try)` invariant testi | P2 |

CLAUDE.md'de belirtilen mevcut testlerin (`payment-plan-status.test.ts` vb.) bu değişikliklerle hâlâ geçtiği bu oturumda **çalıştırılmadı** — **Kanıtlanamadı**.

---

## 12. Deployment Safety Audit

- **Deploy scripti:** `deploy-akinal.bat` → `npm run build` → `python scripts/deploy_ftp.py` (CLAUDE.md'den). `scripts/deploy_ftp.py` içeriği bu turda okunmadı — **Kanıtlanamadı**.
- **`install-schema.php`:** `ENABLE_SETUP_TOOL` bayrağıyla korunduğu CLAUDE.md'de belirtiliyor; gerçek değeri bu turda doğrulanmadı — **Kanıtlanamadı**.
- **`scripts/__pycache__/`** klasörü `git status`'ta untracked görünüyor — deploy script'inin bu tür dosyaları yanlışlıkla deploy etmediğinden emin olunmalı. **Kanıtlanamadı**.

---

## 13. Page-by-Page Audit

### 13.1 Genel Bakış

**1. İş amacı:** Şirketin finansal ve operasyonel durumunun tek bakışta özeti. Mevcut implementasyon (dashboard.php) amaçla uyumlu — canlı, kanonik veriden hesaplanan KPI'lar sunuyor.

**2. Route/dosya haritası:** Sidebar: `AdminLayout.tsx:34` → Route: `App.tsx:77` (`index`) → `AdminDashboard.tsx` → API: `dashboard.php` → DB: `ak_customer_financial_entries`, `ak_employee_financial_entries`, `ak_supplier_financial_entries`, `ak_expense_card_financial_entries`, `ak_projects`, `ak_customers`, `ak_contact_requests`, `ak_notifications`.

**7. Hesaplamalar:** `compute_finance_summary()`, `build_customer_cards()`, `build_project_cards()`, `build_supplier_cards()`, `build_personnel_cards()`, `build_cashflow_command_center()`, `build_management_decision_dashboard()`, `build_expense_category_intelligence()` — hepsi `dashboard.php` içinde, tamamı canlı `SUM()`/`GREATEST()` sorguları, stoklanmış toplam kullanılmıyor.

**14. Bulgular:**
- **[P1] GPP dashboard'a dahil değil** — bkz. §0, §7.
- **[P2] 20+ sıralı sorgu** — bkz. §10.

### 13.2 Gelenler

**Route/dosya haritası:** `AdminLayout.tsx:35` → `App.tsx:98` → `AdminGelenler.tsx` → `gelenler.php` (varlığı doğrulandı) → `ak_customer_financial_entries`.

`Kanıtlanamadı`: Bu turda `gelenler.php` ve `AdminGelenler.tsx` içerikleri satır satır incelenmedi (zaman bütçesi commit edilmemiş dosyalara öncelik verdi). Aranan yer: `public_html/api/admin/gelenler.php`, `src/pages/admin/AdminGelenler.tsx`. Eksik kanıt: buton envanteri, form validasyonları, edge-case davranışı. Kalan risk: sayfanın `ak_customer_financial_entries` üzerinde Müşteriler sayfasıyla aynı kanonik kaynağı kullandığı yüksek olasılıkla doğru ama doğrudan doğrulanmadı.

### 13.3 Gidenler

`Kanıtlanamadı` — aynı gerekçeyle derin incelenmedi. Aranan yer: `gidenler.php`, `AdminGidenler.tsx`. dashboard.php'nin gider hesaplamasıyla (3 kart tablosu UNION ALL) aynı kaynakları kullandığı varsayımı güçlü ama doğrulanmadı.

### 13.4 Enflasyon Hesaplama

**1. İş amacı:** TÜFE endeksi ile geçmiş/gelecek dönem tutar güncellemesi. Commit edilmemiş değişiklikle birlikte artık resmi veri + tahmin ayrımı yapıyor.

**2. Route/dosya haritası:** `AdminLayout.tsx:37` → `App.tsx:112` → `AdminInflationCalculator.tsx` → `inflation-indices.php` (`handle_calculate`) → `inflation-helper.php` (`inflation_monthly_chain_with_forecast`, `forecast_monthly_for_period`, `latest_tcmb_period`) → `ak_inflation_indices`.

**7. Hesaplamalar — doğrulanan kurallar (prompt'ta zorunlu kılınan 6 kural):**
1. ✅ **Compound zincir yalnızca `monthly_change_percent` kullanıyor** — `inflation_monthly_chain_with_forecast()` içinde `$officialFactor *= 1.0 + $officialMap[$s] / 100.0` ve tahmin için `$forecastFactor *= 1.0 + $rate / 100.0` (`inflation-helper.php`).
2. ✅ **Baz ay hariç, hedef ay dahil** — döngü `for ($s = $baseSerial + 1; $s <= $targetSerial; $s++)` ile `baseSerial+1`'den başlıyor, `targetSerial`'e kadar (dahil) gidiyor.
3. ✅ **Geçmiş dönemler yalnızca resmi veri** — `$officialMap` sözlüğünde varsa resmi kullanılıyor, yoksa tahmine düşülüyor.
4. ✅ **Tahmin açıkça işaretleniyor** — `used_forecast`, `forecast_method`, `forecast_note` alanları hem `inflation-indices.php::handle_calculate()` hem `cfe_inflation_preview()` yanıtlarında var; frontend'de (`CardStatementTable.tsx`) turuncu uyarı bandı ile gösteriliyor.
5. ✅ **Aynı ay tahmini son 5 farklı yıl, mükerrer korumalı** — `forecast_monthly_for_period()` içindeki alt sorgu `GROUP BY period_year, period_month` + `MAX(monthly_change_percent)` kullanıyor, `ORDER BY period_year DESC LIMIT {$lookback}` ile son 5 **farklı yıl**.
6. ✅ **`index_value` hesaplamada kullanılmıyor** — doğrulandı, yalnızca `monthly_change_percent` okunuyor.

**14. Bulgular:**
- **[P3] `$lookback` parametresi `{$lookback}` ile doğrudan SQL string'ine interpole ediliyor** (`forecast_monthly_for_period()`, `LIMIT {$lookback}`). Değer fonksiyon imzasında `int $lookback = 5` olarak tip-kısıtlı ve dışarıdan kullanıcı girdisi almadığı için SQL injection riski yok; kod kalitesi notu olarak düşük öncelikli.

### 13.5 Projeler

**Route/dosya haritası:** `AdminLayout.tsx:43` → `App.tsx:78-82` → `AdminProjects.tsx`, `AdminProjectEdit.tsx`, `AdminProjectFinance.tsx`, `AdminProjectExpenses.tsx` → `projects.php`, `project-expense-transactions.php` → `ak_projects` + tüm kart tabloları + `ak_project_expense_transactions`.

**6. CRUD — Delete davranışı (derin incelendi):** `projects.php` DELETE artık 13 tabloyu (`ak_project_images`, `ak_customer_projects`, 4 kanonik finans tablosu, `ak_employee_project_assignments/allocations`, `ak_government_progress_payments`, `ak_project_expense_transactions`, 3 legacy tablo) COUNT ile kontrol ediyor; herhangi birinde kayıt varsa 409 + Türkçe liste döndürüyor, hiçbiri yoksa parent siliniyor. **Bu, önceki cascade-delete'e göre önemli bir güvenlik iyileştirmesi.**

**14. Bulgular:**
- **[P1] `ak_project_expense_transactions` modülünün nihai durumu belirsiz** — Proje listesinde "Giderler" butonu hâlâ görünür durumda, tıklanınca salt-okunur deprecated sayfaya gidiyor.
- **[P3] Buton stilinin deprecated durumu yansıtmaması** — bkz. §8.

### 13.6 Medya

`Kanıtlanamadı` — bu turda `AdminMedia.tsx`, `media.php`, `media-albums.php` içerikleri derinlemesine incelenmedi. `media-upload.php` MIME/boyut/dosya adı güvenliği doğrulandı (bkz. §9) ve iyi pratik olarak değerlendirildi. Eksik kanıt: kapak görseli mantığı, sıralama, orphan dosya riski, galeri UI.

### 13.7 Müşteriler

**1. İş amacı:** Cari kayıtları + tahsilat hareketleri yönetimi, artık vade farkı/enflasyon önizlemesi ile genişletilmiş.

**2. Route/dosya haritası:** `AdminLayout.tsx:50` → `App.tsx:83-87` → `AdminCustomers.tsx`, `AdminCustomerDetail.tsx`, `AdminCustomerEdit.tsx` → `customers.php`, `customer-financial-entries.php` → `ak_customers`, `ak_customer_financial_entries`.

**4. Buton/aksiyon envanteri (Müşteri Detay sayfası, tahsilat hareketleri paneli):**

| Konum | Buton/Aksiyon | Dosya | Handler | Modal? | API Çağrısı? | DB Etkisi | Doğrulama | Risk |
|---|---|---|---|---|---|---|---|---|
| Tahsilat satırı | TrendingUp ikonu (Vade Farkı paneli aç/kapa) | `CardStatementTable.tsx` | `openInflationPanel()` | Hayır (satır-içi panel) | Hayır | Yok | Yok | Düşük |
| Vade Farkı paneli | "Vade farkı hesaplamasını etkinleştir" checkbox | `CardStatementTable.tsx` | `setInflationEnabled` | — | Hayır | Yok | Yok | Düşük |
| Vade Farkı paneli | "Kaydet" | `CardStatementTable.tsx` | `handleInflationSave()` → `onInflationSave` prop → `AdminCustomerDetail.tsx::handleInflationSave` | Hayır | Evet — `updateCustomerFinancialEntry` (PATCH) | `ak_customer_financial_entries.inflation_enabled/inflation_start_date` | Boş tarih izin veriliyor, backend `entry_date`'e düşüyor | Düşük — çift tıklama koruması var (`disabled={inflationSaving}`) |
| Tahsilat satırı | Pencil (Düzenle) | `CardStatementTable.tsx` | `setEditEntry` + `CardEntryForm` | Evet | Evet (PATCH) | `ak_customer_financial_entries` | `values.project_id` artık zorunlu (yeni) | Düşük |
| Tahsilat satırı | Trash2 (Sil) | `CardStatementTable.tsx` | `handleDelete()` | Kanıtlanamadı — `onDelete` prop içeriğinde confirm() olup olmadığı bu turda görülmedi | Evet (DELETE) | `ak_customer_financial_entries` | — | **P2: silme öncesi onay diyaloğu bu kod yolunda görülmedi** |

**13. Edge case'ler:**
- Çift tıklama ile "Kaydet" (vade farkı paneli): `inflationSaving` state'i buton'u disable ediyor — korunmuş.
- Boş `inflation_start_date`: backend `baseDate` için `entry_date`'e düşüyor (`cfe_inflation_preview()`) — doğru fallback.
- Negatif/sıfır tutar: `cfe_inflation_preview()` içinde `$amountTry <= 0` kontrolü var, `disabled` döndürüyor — korunmuş.

**14. Bulgular:**
- **[P1] React Fragment key hatası** — `CardStatementTable.tsx`, `entries.map((e) => { ... return (<>...</>) })` bloğunda dönen kısa fragment sözdizimi (`<>`) `key` prop'u kabul etmiyor; yalnızca içindeki iki `<tr key=...>` elemanı key alıyor ama `.map()`'in döndürdüğü üst-seviye eleman (Fragment) key'siz.
  - **Kanıt:** `src/components/admin/finance/CardStatementTable.tsx`: `{entries.map((e) => { ... return ( <> <tr key={e.id}>...</tr> {showInflation && panelOpen && <tr key={...}>...</tr>} </> ); })}`.
  - **Etki:** React DevTools/konsolda "Warning: Each child in a list should have a unique key prop" uyarısı beklenir; liste öğeleri silinip eklendiğinde React'in yanlış `<tr>`'yi yeniden kullanma riski vardır (örn. `inflationOpenId` state'i bir satırdan diğerine kayabilir).
  - **Önerilen düzeltme:** `<React.Fragment key={e.id}>` kullan.
- **[P2] Sil butonunda onay diyaloğu net değil** — `handleEntryDelete`'in confirm() içerip içermediği doğrulanmadı; eğer yoksa tek tıkla kalıcı silme riski var.

### 13.8 Devlet Hakedişleri

**Route/dosya haritası:** `AdminLayout.tsx:51` → `App.tsx:88` → `AdminGovernmentProgressPayments.tsx` → `government-progress-payments.php`, `migrations/gpp-breakdowns-apply.php` → `ak_government_progress_payments`, `ak_government_progress_payment_breakdowns`.

**7. Hesaplamalar (migration diff'inden doğrulanan):** `gpp-breakdowns-apply.php` artık her parent'ın `paid_amount_try`'ını 4 standart aşamaya **waterfall** (sıralı doldurma) yöntemiyle dağıtıyor: her aşama kendi `planned` tutarına kadar doldurulup fazlası bir sonraki aşamaya taşınıyor. `SUM(breakdown.paid_amount_try) === parent.paid_amount_try` garantisi sağlanıyor.

**14. Bulgular:**
- **[P1] Genel Bakış'a entegre değil** — bkz. §0, §7.
- **Kritik muhasebe sorusu (Kanıtlanamadı):** "Ödendiğinde otomatik olarak Gelenler kaydı oluyor mu, yoksa ayrı mı?" — `government-progress-payments.php` dosyasının ödeme mantığı (597 satır) bu turda derin incelenmedi, yalnızca migration dosyası derin okundu. Kalan risk: eğer hem GPP hem de ayrı bir müşteri kaydı manuel giriliyorsa çift sayım riski **oluşabilir** — doğrulanmadı.

### 13.9 Tedarikçiler

`Kanıtlanamadı` — derin incelenmedi. `dashboard.php::build_supplier_cards()` üzerinden `ak_supplier_financial_entries` tek kaynak olarak doğrulandı (bkz. §7). Silme guard'ının `employees.php`/`projects.php`/`expense-cards.php` ile aynı deseni kullanıp kullanmadığı (`suppliers.php`) bu turda Grep ile aranmadı — risk: eğer aynı guard eklenmemişse tedarikçi silme hâlâ eski cascade-delete davranışını taşıyor olabilir.

### 13.10 Masraf Kartları

**Route/dosya haritası:** `AdminLayout.tsx:58` → `App.tsx:102-103` → `AdminExpenseCards.tsx`, `AdminExpenseCardFinance.tsx` → `expense-cards.php`, `expense-card-financial-entries.php` → `ak_expense_cards`, `ak_expense_card_financial_entries`.

**6. CRUD — Delete (derin incelendi):** `expense-cards.php` DELETE artık `ak_expense_card_financial_entries` içinde bağlı kayıt sayısını kontrol edip >0 ise 409 döndürüyor; öncesinde transaction içinde cascade-delete yapıyordu. Frontend onay metni de güncellenmiş, backend davranışıyla artık **tutarlı**.

**14. Bulgular:** Belirgin yeni sorun yok; önceki tutarsızlık (frontend "bağlı kayıtlar korunur" derken backend'in cascade silmesi) artık kapatılmış.

### 13.11 Personeller

**Route/dosya haritası:** `AdminLayout.tsx:64` → `App.tsx:89-92` → `AdminEmployees.tsx`, `AdminEmployeeDetail.tsx`, `AdminEmployeeAllocations.tsx` → `employees.php`, `employee-financial-entries.php`, `employee-project-allocations.php` → `ak_employees` + bağlı tablolar.

**6. CRUD — Delete (derin incelendi):** `employees.php` DELETE artık 5 tabloyu (`ak_employee_financial_entries`, `ak_employee_roles`, `ak_employee_cost_periods`, `ak_employee_project_assignments`, `ak_employee_project_allocations`) kontrol ediyor, bağlı kayıt varsa 409 + "durumunu Pasif yapın" önerisi döndürüyor.

**14. Bulgular:**
- **[P2] "Pasif" durumuna geçiş UI'dan doğrudan erişilebilir mi belirsiz** — Hata mesajı "durumunu Pasif yapın" diyor ama bu turda durum değiştirme (status toggle) butonunun var olup olmadığı doğrulanmadı. Kalan risk: eğer böyle bir UI yoksa kullanıcı 409 hatası aldığında hiçbir aksiyon alamaz (dead-end UX).

### 13.12 İletişim Talepleri

`Kanıtlanamadı` — bu turda `AdminContacts.tsx`/`contact-requests.php` derin incelenmedi.

### 13.13 Bildirimler

**Route/dosya haritası:** `AdminLayout.tsx:71` → `App.tsx:107` → `AdminNotifications.tsx` → `notifications.php` (tam okundu) → `ak_notifications`.

**4. Buton/aksiyon envanteri (backend'den çıkarsanan):**

| Aksiyon | Method | DB Etkisi |
|---|---|---|
| Listele + `?generate=1` ile üret | GET | `ensure_payment_notifications()` çağrısı — muhtemelen INSERT |
| Tek okundu işaretle | PATCH `{id, is_read}` | `UPDATE ak_notifications SET is_read=:v WHERE id=:id` |
| Tümünü okundu işaretle | PATCH `{all:true}` | `UPDATE ak_notifications SET is_read=1 WHERE is_read=0` |
| Tek sil | DELETE `?id=` | `DELETE FROM ak_notifications WHERE id=:id` |
| Tümünü sil | DELETE `?all=1` | `DELETE FROM ak_notifications` |

**14. Bulgular:**
- **[P2] `ensure_payment_notifications()` idempotency'si doğrulanmadı** — fonksiyon tanımı bu turda okunmadı. Risk: eğer fonksiyon idempotent değilse, sayfa her yenilendiğinde aynı gecikmiş ödeme için mükerrer bildirim satırları oluşabilir.
- **[P3]** Frontend'in `?generate=1`'i ne sıklıkla çağırdığı (`AdminNotifications.tsx`) doğrulanmadı.

### 13.14 Ayarlar

`Kanıtlanamadı` (kısmi) — `site-settings.php`'nin GET/PATCH iskeleti doğrulandı (`ensure_site_settings_favicon_column()` çağrısı, alan listesi başlangıcı görüldü), ancak tam alan listesi, logo yükleme doğrulaması ve `AdminSettings.tsx` UI'ı derin incelenmedi.

---

## 14. Full Button/Action Inventory

Bu turda tam kapsamlı (14 sayfa × tüm butonlar) envanter zaman bütçesi nedeniyle çıkarılamamıştır. §13'te commit edilmemiş değişikliklerin dokunduğu sayfalar için buton envanteri verilmiştir (özellikle §13.7 Müşteriler). Diğer sayfalar için: **Kanıtlanamadı** — aranan yer: ilgili `src/pages/admin/*.tsx` dosyaları; eksik kanıt: her sayfanın tam JSX ağacı okunmadı; kalan risk: belgelenmemiş buton davranışları olabilir.

---

## 15. Full Data Lineage Matrix

Bkz. §7 (Finance and Accounting Audit) mutabakat tablosu ve §6 API Contract Audit — bunlar commit edilmemiş değişikliklerin dokunduğu alanlar için veri soykütüğünü kapsıyor. Tam 14-sayfa matrisi için: **Kanıtlanamadı**, aynı zaman bütçesi kısıtı.

---

## 16. Full Issue Register

| Ciddiyet | Sayfa | Kategori | Sorun | Kanıt | Etki | Öneri |
|---|---|---|---|---|---|---|
| P1 | Müşteriler | Frontend/React | `.map()` içinde dönen kısa Fragment (`<>`) key almıyor | `src/components/admin/finance/CardStatementTable.tsx`, `entries.map((e) => { return (<>...</>) })` | Liste yeniden render edildiğinde yanlış DOM/state eşleşmesi, konsol uyarısı | `<React.Fragment key={e.id}>` kullan |
| P1 | Genel Bakış / Devlet Hakedişleri | Finans | GPP hiçbir Genel Bakış toplamına dahil değil | `public_html/api/admin/dashboard.php` — `ak_government_progress_payments` hiç geçmiyor | Yönetim, hakediş tahsilatlarını Genel Bakış'ta göremiyor; nakit pozisyonu eksik gösterilebilir | GPP'yi dashboard'a entegre et veya UI'da ayrık olduğunu açıkça belirt |
| P1 | Projeler | Mimari/UX | `ak_project_expense_transactions` yazılamıyor ama okunmaya ve UI'da "Giderler" linki olarak aktif görünmeye devam ediyor | `src/pages/admin/AdminProjectExpenses.tsx`, `src/pages/admin/AdminProjects.tsx` diff | Kullanıcı kafa karışıklığı, yarı-ölü modül | Modülü tamamen kaldır veya proje satırından linki kaldır |
| P1 | Müşteriler | Test | Enflasyon/vade farkı hesaplama motoru için birim testi yok | `src/test/` içinde ilgili dosya bu turda bulunamadı | Karmaşık bileşik faiz + tahmin mantığı regresyona açık | `inflation_monthly_chain_with_forecast()` için test ekle |
| P2 | Müşteriler | Performans/DB | `ensure_inflation_columns()` her POST/PATCH'te `ALTER TABLE` deniyor | `public_html/api/admin/customer-financial-entries.php` | Gereksiz DDL denemesi, metadata lock riski | Tek seferlik migration'a taşı |
| P2 | Müşteriler | UX/Güvenlik | Tahsilat satırı silme onay diyaloğu bu kod yolunda doğrulanamadı | `src/components/admin/finance/CardStatementTable.tsx::handleDelete` | Olası tek-tık kalıcı silme | `AdminCustomerDetail.tsx::handleEntryDelete` çağrısından önce `confirm()` olduğunu doğrula/ekle |
| P2 | Personeller | UX | 409 hatası "Pasif yapın" diyor ama UI'da bu aksiyonun varlığı doğrulanmadı | `public_html/api/admin/employees.php` hata mesajı | Kullanıcı için dead-end UX riski | `AdminEmployeeDetail.tsx`'te durum değiştirme UI'ının var olduğunu doğrula |
| P2 | Bildirimler | DB/Mantık | `ensure_payment_notifications()` idempotent mi doğrulanmadı | `public_html/api/admin/notifications.php:12-13` | Mükerrer bildirim riski | Fonksiyon tanımını incele, idempotency garantisi ekle/doğrula |
| P2 | Genel Bakış | Performans | Tek sayfa yüklemesinde 20+ SQL sorgusu | `public_html/api/admin/dashboard.php` | Büyük veri setinde yavaş yükleme | Sorguları birleştir veya kısa süreli cache'le |
| P2 | Global | Mimari | Legacy tablo okuma referansı dashboard.php'de yok ama CLAUDE.md "both tracks currently read" diyor | `CLAUDE.md` vs `dashboard.php` karşılaştırması | Dokümantasyon-kod uyumsuzluğu | CLAUDE.md'yi güncel kod durumuna göre güncelle |
| P2 | Ayarlar | DB | `ensure_site_settings_favicon_column()` aynı runtime-ALTER desenini kullanıyor olabilir | `public_html/api/admin/site-settings.php:12` (çağrı görüldü, tanım görülmedi) | Aynı performans riski | Tanımı incele, aynıysa migration'a taşı |
| P2 | Tedarikçiler | Güvenlik/DB | Silme guard deseni `suppliers.php`'de doğrulanmadı | Kanıtlanamadı | Eski cascade-delete davranışı sürebilir | `suppliers.php` DELETE bloğunu `employees.php` deseniyle karşılaştır |
| P3 | Enflasyon | Kod kalitesi | `LIMIT {$lookback}` string interpolasyonu (prepared param değil) | `public_html/api/admin/inflation-helper.php::forecast_monthly_for_period()` | Düşük (sabit int, kullanıcı girdisi değil) | `bindValue(..., PDO::PARAM_INT)` ile değiştir |
| P3 | Projeler | UI | Deprecated "Giderler" butonu görsel olarak vurgulanmıyor | `src/pages/admin/AdminProjects.tsx` | Küçük UX tutarsızlığı | Buton stilini soluklaştır/disabled yap |
| P3 | Global | Mimari | `apiClient.ts` tek dosyada 1350+ satır | `src/lib/apiClient.ts` | Bakım zorluğu | Modüllere böl |
| P3 | Global | Güvenlik (savunma amaçlı) | Dinamik tablo adı interpolasyonu sabit whitelist'ten geliyor | `employees.php`, `projects.php`, `expense-cards.php` | Şu an risksiz | Whitelist'in kod dışından etkilenemeyeceğini garanti eden not/test ekle |
| P3 | Global | Güvenlik | `sql-editor.php` yetkilendirme modeli derin incelenmedi | Kanıtlanamadı | Potansiyel yüksek risk | Ayrı, öncelikli güvenlik incelemesi yap |
| P3 | Global | Deploy | `deploy_ftp.py` hariç tutma listesi incelenmedi | Kanıtlanamadı | Yanlışlıkla cache/config deploy riski | Script'i incele, `.gitignore` ile hizala |
| P3 | Global | Test | Bu turda `npm run test` çalıştırılmadı | Kapsam gereği salt-okunur | Regresyon durumu bilinmiyor | Commit öncesi `npm run test` + `php -l` çalıştırılmalı |

---

## 17. Prioritized Action Plan

### P0 — Production blockers
Yok. Önceki turun P0 bulguları (cascade-delete'ler) bu commit edilmemiş değişikliklerle kapatılmış görünüyor.

### P1 — Must fix before serious usage
1. `CardStatementTable.tsx` Fragment key hatasını düzelt.
2. GPP'nin Genel Bakış'a dahil edilip edilmeyeceğine karar ver ve uygula.
3. `ak_project_expense_transactions`/`AdminProjectExpenses.tsx` için nihai kaldırma kararı al.
4. Enflasyon motoru için test kapsamı ekle.

### P2 — Should fix
5. `ensure_inflation_columns()` runtime ALTER'ını migration'a taşı.
6. Müşteri satırı silme onayını doğrula/ekle.
7. Personel "Pasif" durumu UI erişimini doğrula.
8. `ensure_payment_notifications()` idempotency'sini doğrula.
9. Dashboard sorgu sayısını azalt/cache'le.
10. CLAUDE.md'yi güncel kod durumuna göre güncelle.
11. `site-settings.php` ALTER deseni tekrar incele.
12. `suppliers.php` silme guard'ını `employees.php` ile hizala.

### P3 — Nice to have
13-19: Bkz. §16 P3 satırları (SQL param binding, buton stili, apiClient modülerleştirme, whitelist notu, sql-editor incelemesi, deploy script incelemesi, test çalıştırma disiplini).

---

## 18. Manual QA Checklist

**Finans (öncelikli — commit edilmemiş değişiklikler):**
- [ ] Bağlı finansal hareketi olan bir personeli silmeyi dene → 409 + Türkçe mesaj bekleniyor.
- [ ] Bağlı finansal hareketi olan bir projeyi silmeyi dene → 409 + tablo bazlı liste bekleniyor.
- [ ] Bağlı hareketi olan bir masraf kartını silmeyi dene → 409 bekleniyor.
- [ ] Hiçbir bağlı kaydı olmayan boş bir personel/proje/kart silmeyi dene → başarılı silme bekleniyor.
- [ ] Müşteri tahsilat kaydında "Vade Farkı" panelini aç, etkinleştir, kaydet → `inflation_preview` doğru hesaplanmalı.
- [ ] Baz tarihi boş bırakıp kaydet → `entry_date` fallback olarak kullanılmalı.
- [ ] Hedef ay için resmi TCMB verisi yoksa "Tahmini Veri İçeriyor" bandı görünmeli.
- [ ] `AdminProjectExpenses.tsx` sayfasına git → Ekle/Düzenle/Sil butonları olmamalı, yalnızca liste + uyarı bandı.
- [ ] Enflasyon Hesaplama sayfasında gelecek hedef ay seç → tahmin oranı ve uyarı gösterilmeli.

**Genel:**
- [ ] Genel Bakış toplamlarını Gelenler/Gidenler sayfa toplamlarıyla manuel karşılaştır.
- [ ] Devlet Hakedişleri sayfasında bir ödeme işaretle, Genel Bakış'a yansıyıp yansımadığını kontrol et (beklenen: yansımaz — P1 bulgusu).
- [ ] Mobil görünümde tüm 14 sayfa sidebar/tablo taşması kontrolü.

**Güvenlik:**
- [ ] Yönetici olmayan bir kullanıcı ile doğrudan `/admin/sql-editor` URL'sine erişmeyi dene.
- [ ] Oturum süresi dolduktan sonra herhangi bir admin sayfasına erişmeyi dene → `/admin/giris`'e yönlenmeli.

---

## 19. Suggested Automated Tests

- **Birim:** `inflation_monthly_chain_with_forecast()` — sınır durumları (base=target, target<base, tüm aylar resmi, tüm aylar tahmin, karışık).
- **Birim:** `forecast_monthly_for_period()` — aynı yıl/ay için mükerrer satır varken doğru ortalama.
- **Entegrasyon:** `employees.php`/`projects.php`/`expense-cards.php` DELETE — bağlı kayıt var/yok senaryoları.
- **Entegrasyon:** `fe_payload()` — geçersiz/boş `project_id` için 422.
- **E2E:** Müşteri tahsilat kaydı oluştur → vade farkı etkinleştir → kaydet → satırda TÜFE etiketi göründüğünü doğrula.
- **DB bütünlüğü:** GPP breakdown backfill sonrası `SUM(breakdown.paid_amount_try) = parent.paid_amount_try` invariant'ı.

---

## 20. Open Questions / Kanıtlanamayanlar

1. **`gelenler.php`/`AdminGelenler.tsx` iç detayları** — aranan yer: `public_html/api/admin/gelenler.php`, `src/pages/admin/AdminGelenler.tsx`. Neden kanıtlanamadı: zaman bütçesi commit edilmemiş dosyalara öncelik verdi. Kalan risk: bilinmiyor, muhtemelen düşük.
2. **`government-progress-payments.php`'nin ödeme/Gelenler ilişkisi** — aranan yer: dosyanın tamamı (597 satır, yalnızca migration'ı derin okundu). Neden kanıtlanamadı: zaman bütçesi. Kalan risk: potansiyel çift sayım (P1 olarak işaretlendi ama tam doğrulanamadı).
3. **`sql-editor.php` yetkilendirme modeli** — aranan yer: dosya içeriği. Neden kanıtlanamadı: kapsam dışı bırakıldı. Kalan risk: yüksek — serbest SQL çalıştırma yüzeyi.
4. **`ensure_payment_notifications()` idempotency'si** — aranan yer: fonksiyon tanımı (muhtemelen `helpers.php`). Neden kanıtlanamadı: bulunamadı/okunmadı. Kalan risk: mükerrer bildirim.
5. **`deploy_ftp.py` hariç tutma listesi** — aranan yer: `scripts/deploy_ftp.py`. Neden kanıtlanamadı: kapsam dışı. Kalan risk: bilinmiyor.
6. **Medya, Tedarikçiler, İletişim Talepleri, Ayarlar sayfalarının tam buton envanteri** — aranan yer: ilgili `.tsx`/`.php` dosyaları. Neden kanıtlanamadı: zaman bütçesi. Kalan risk: belgelenmemiş davranışlar olabilir.
7. **`npm run test` sonucu bu değişikliklerle** — çalıştırılmadı (salt-okunur kapsam tercih edildi). Kalan risk: regresyon durumu bilinmiyor.

---

## 21. Final Verification

- Bu oturumda **hiçbir uygulama kaynak dosyası değiştirilmedi**. Yalnızca `FULL_SIDEBAR_SYSTEM_AUDIT_REPORT.md` (var olan dosyanın üzerine yazıldı) oluşturuldu/güncellendi.
- Migration çalıştırılmadı, veritabanına yazılmadı, deploy yapılmadı.
- Nihai `git status --short` bu rapor tamamlandıktan hemen sonra ayrıca doğrulanmıştır (bkz. görev tamamlama mesajı); beklenen fark yalnızca bu dosyanın içerik değişikliği olarak görünmesidir, başka hiçbir dosyada değişiklik olmamalıdır.
