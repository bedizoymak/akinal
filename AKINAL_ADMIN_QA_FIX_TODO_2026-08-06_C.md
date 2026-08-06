# Akınal İnşaat — Admin QA Düzeltme TODO Listesi

**Kaynak rapor:** `AKINAL_ADMIN_FULL_E2E_QA_REPORT_2026-08-06_C.md`  
**Tarih:** 2026-08-06  
**Repo kökü:** `C:\Users\Bediz\Documents\akinalinsaat.com`  
**Hedef:** QA raporundaki `BLOCKED` teslim kararını, kanıtlanmış kod düzeltmeleri ve regresyon testleriyle kaldırmak.

---

## 0. Zorunlu çalışma kuralları

- [ ] Çalışmaya başlamadan önce kaynak QA raporunu baştan sona oku.
- [ ] Mevcut kök nedeni yalnızca rapordaki tahmine dayanarak kabul etme; kod, API ve hesaplama akışında doğrula.
- [ ] Yalnızca `C:\Users\Bediz\Documents\akinalinsaat.com` içinde çalış.
- [ ] Production deploy yapma.
- [ ] Production veritabanında migration çalıştırma.
- [ ] Production veya gerçek müşteri kayıtlarında oluşturma, düzenleme ya da silme yapma.
- [ ] `ak_profiles` ve `ak_user_roles` tablolarına veya bunların davranışına dokunma.
- [ ] FTP, cPanel, production credential ve korumalı config dosyalarını değiştirme.
- [ ] İlgisiz refactor, tasarım değişikliği veya paket güncellemesi yapma.
- [ ] Doğru çalışan finansal çekirdeği koru; her finans düzeltmesinde regresyon testi ekle.
- [ ] Aynı metriğin farklı ekranlardaki hesaplarını bağımsız yamalamak yerine ortak ve test edilebilir hesaplama kuralına indir.
- [ ] Her bulgu için: kök neden → değişiklik → test → kabul kriteri zincirini kanıtla.
- [ ] TODO maddelerini yalnızca test kanıtı varsa tamamlandı olarak işaretle.
- [ ] Repo başlangıcında `git status` ve mevcut değişiklikleri kaydet; kullanıcıya ait değişiklikleri ezme.
- [ ] Commit, push, PR veya deploy yapma.

---

## 1. Ortak finansal iş kuralları

Aşağıdaki kurallar BUG-02, BUG-03, BUG-08 ve BUG-09 için tek kaynak olarak uygulanmalıdır:

### 1.1 Gerçekleşen/tahsil edilen gelir

- Gerçek tahsilat, kaydedilmiş gerçek `paid_amount` değeridir.
- Fazla ödeme varsa tahsil edilen tutar planlanan tutarla sınırlandırılmaz.
- Nakit bazlı ve “bugüne kadar gerçekleşen” metriklerde kayıt tarihi kesimi açıkça uygulanır.
- Aynı adı ve kapsamı kullanan ekranlar aynı tarih kesimini kullanır.

### 1.2 Kayıt ve müşteri bakiyesi

- Kayıt bakiyesi: `planned_amount - paid_amount`.
- Fazla ödenmiş tek kayıt veya müşteri bakiyesi negatif olabilir; bu, müşterinin alacaklı/avanslı durumunu gösterir.
- Müşteri detayında planlanan ve tahsil edilen tutarların ikisi de gerçek değerleriyle gösterilir.

### 1.3 Konsolide kalan alacak / bekleyen tahsilat

- Konsolide kalan alacak, başka müşterilerin açık borcunu fazla ödeme ile maskelememelidir.
- Toplam açık alacak satır bazında hesaplanır: `SUM(MAX(planned_amount - paid_amount, 0))`.
- Fazla ödeme tutarı gerekiyorsa ayrıca `SUM(MAX(paid_amount - planned_amount, 0))` olarak hesaplanabilir.
- Yeni bir KPI eklenmesi mevcut tasarımı gereksiz büyütecekse, en azından fazla ödeme satır ve müşteri detayında görünür kalmalı; konsolide açık alacaktan düşülmemelidir.

### 1.4 Yaklaşan ödeme

- Gelecek tarihli ve pozitif kalan bakiyesi bulunan kayıtlar kapsama alınır.
- Kısmi ödenmiş kayıtların kalan bakiyesi de yaklaşan ödeme hesabına girer.
- Tam ödenmiş ve fazla ödenmiş kayıtlar yaklaşan ödeme tutarına girmez.
- Mevcut “yaklaşan” tarih penceresi korunmalı ve tek yerde tanımlanmalıdır.

---

# P0 — Kritik teslim engeli

## BUG-01 — Personel rolleri, maliyet dönemleri, proje atamaları ve tahsisatlar çalışmıyor

**Önem:** Kritik  
**Etkilenen alanlar:** Personel detay sekmeleri, tahsisat ekranı ve ilgili personel API’leri.

### 1A. Kök neden doğrulama

- [ ] Aşağıdaki tabloları oluşturan migration dosyasını ve Bakım Konsolu entegrasyonunu incele:
  - `ak_roles`
  - `ak_employee_roles`
  - `ak_employee_cost_periods`
  - `ak_employee_project_assignments`
  - `ak_employee_project_allocations`
- [ ] Migration’ın idempotent olduğunu ve mevcut veriyi kaybetmeden tekrar çalıştırılabildiğini doğrula.
- [ ] Aşağıdaki endpointlerin şema eksikken neden `HTTP 200`, `success: true`, `table_missing: true` döndürdüğünü izle:
  - `roles.php`
  - `employee-roles.php`
  - `employee-cost-periods.php`
  - `employee-project-assignments.php`
  - `employee-project-allocations.php`
- [ ] POST isteklerindeki HTTP 500 hatalarının gerçek SQL/exception nedenini belirle.
- [ ] Frontend’in neden önce var olmayan `employee-allocations.php` adresini çağırdığını ve SPA HTML’i aldıktan sonra fallback yaptığını bul.
- [ ] Personel maliyetinin proje finansına hangi akışla yansıdığını ve çift sayılma riskini incele.

### 1B. Kod düzeltmeleri

- [ ] Frontend tahsisat çağrısını doğrudan doğru endpoint olan `employee-project-allocations.php` adresine yönlendir.
- [ ] Hatalı endpoint/fallback davranışını kaldır.
- [ ] Şema eksikliğini normal boş liste gibi maskeleme.
- [ ] API sözleşmesini tutarlı hale getir:
  - Uygun HTTP hata durumu
  - `success: false`
  - Makinece okunabilir hata kodu
  - Güvenli ve anlaşılır mesaj
  - Hassas SQL/dosya yolu/credential sızıntısı olmaması
- [ ] Loading, empty ve error durumlarını frontend’de ayır.
- [ ] `table_missing` durumunda açık hata bloğu göster.
- [ ] Rol, maliyet dönemi, proje ataması ve tahsisat bölümlerine gerçekten yeni istek gönderen `Tekrar dene` aksiyonu ekle.
- [ ] Migration uygulanmadan create aksiyonlarının sessiz veya yanıltıcı şekilde çalışmasını engelle.
- [ ] Migration mevcutken CRUD akışlarının doğru endpoint ve payload ile çalışmasını doğrula/düzelt.
- [ ] Personel maliyetinin proje finansına yalnızca bir kez yansımasını güvenceye al.
- [ ] Production migration’ını çalıştırmadan önce uygulanabilir, geri dönüş adımlı kısa bir runbook hazırla.

### 1C. Testler

- [ ] Migration temiz şemada ilk çalıştırma testi.
- [ ] Migration ikinci çalıştırma/idempotency testi.
- [ ] Tablolar yokken GET hata sözleşmesi testi.
- [ ] Tablolar yokken POST hata sözleşmesi testi.
- [ ] Roller listesi yükleme ve rol atama testi.
- [ ] Maliyet dönemi create/read/update/delete testi.
- [ ] Proje ataması create/read/update/delete testi.
- [ ] Tahsisat create/read/update/delete testi.
- [ ] Refresh sonrası kalıcılık testi.
- [ ] Personel → proje ve proje → personel çift yönlü görünürlük testi.
- [ ] `Tekrar dene` aksiyonunun yeni network isteği gönderdiği frontend testi.
- [ ] Personel maliyetinin proje finansında çift sayılmadığı regresyon testi.

### 1D. Kabul kriterleri

- [ ] Rol seçenekleri yüklenir ve seçilebilir.
- [ ] Maliyet dönemi kaydedilir ve yenilemede korunur.
- [ ] Personel projeye atanır ve her iki tarafta görünür.
- [ ] Tahsisat kaydedilir ve yenilemede korunur.
- [ ] Personel maliyeti ilgili finans ekranında tam bir kez görünür.
- [ ] Şema eksikse kullanıcı normal boş durum değil, açık hata ve yeniden deneme aksiyonu görür.
- [ ] Production migration uygulanması gereken tek manuel adım olarak açıkça raporlanır; otomatik çalıştırılmaz.

---

# P1 — Yüksek ve orta-yüksek teslim engelleri

## BUG-02 — Genel Bakış ile Net Durum aynı metrikte farklı sonuç veriyor

**Önem:** Yüksek

### 2A. Analiz ve düzeltme

- [ ] Genel Bakış’taki `Toplam Tahsilat`, `Bu Ay Tahsilat` ve `Net Durum` hesap akışlarını izle.
- [ ] `/admin/net-durum` toplamlarının hesap akışını izle.
- [ ] `entry_date <= bugün` kesiminin her iki akışta nasıl uygulandığını karşılaştır.
- [ ] “Gerçekleşen gelir” hesabını ortak, test edilebilir bir hesaplama katmanında merkezileştir.
- [ ] Aynı kapsamı iddia eden Genel Bakış ve Net Durum metriklerini aynı tarih kesimine getir.
- [ ] `Bu Ay Tahsilat` hesabında ileri tarihli kayıtların yanlışlıkla sayılmasını engelle.
- [ ] Bilinçli kapsam farkı varsa kart adı, açıklaması ve hedef ekranı kapsamı açıkça belirtir hale getir.

### 2B. Regresyon testleri

- [ ] Geçmiş tarihli tahsilat.
- [ ] Bugün tarihli tahsilat.
- [ ] Gelecek tarihli tahsilat.
- [ ] Gelecek vadeli ancak bugün tahsil edilmiş kayıt.
- [ ] Kısmi tahsilat.
- [ ] Fazla ödeme.
- [ ] Ay ve yıl sınırı.
- [ ] Kayıt silme sonrası iki ekranın aynı miktarda güncellenmesi.

### 2C. Kabul kriterleri

- [ ] Aynı kapsamı iddia eden Genel Bakış ve Net Durum değerleri birebir eşleşir.
- [ ] Rapordaki ileri tarihli ₺120.000 kayıt tek ekranda fazladan sayılmaz.
- [ ] KPI kartından açılan hedef ekran kart değerini aynı filtre/kapsamla yeniden üretir.

---

## BUG-03 — Fazla ödeme müşteri detay KPI’larında kayboluyor

**Önem:** Yüksek

### 3A. Analiz ve düzeltme

- [ ] Müşteri listesi, müşteri detay tablosu ve müşteri detay KPI hesaplarını karşılaştır.
- [ ] `min(paid_amount, amount)` veya negatif bakiyeyi sıfıra kırpan detay hesaplamasını bul.
- [ ] Planlanan alacağı gerçek planlanan tutar olarak koru.
- [ ] Tahsil edilen tutarı gerçek `paid_amount` olarak göster; planlanan tutarla sınırlandırma.
- [ ] Müşteri bakiyesinin fazla ödeme halinde negatif görünmesine izin ver.
- [ ] Liste, detay KPI ve detay tablosunu ortak müşteri finans hesaplamasına indir.

### 3B. Testler

- [ ] 100.000 planlanan / 0 ödenen.
- [ ] 100.000 planlanan / 40.000 ödenen.
- [ ] 100.000 planlanan / 100.000 ödenen.
- [ ] 100.000 planlanan / 120.000 ödenen.
- [ ] Aynı müşteride karma durumlu birden fazla kayıt.
- [ ] Dövizli kayıt.
- [ ] Silme sonrası liste/KPI/tablo mutabakatı.

### 3C. Kabul kriterleri

- [ ] Fazla ödeme örneğinde müşteri detayında:
  - Toplam alacak: ₺100.000
  - Tahsil edilen: ₺120.000
  - Bakiye: −₺20.000
- [ ] Liste, detay kartları ve detay tablosu aynı sonucu verir.

---

## BUG-04 — Proje Finans TÜFE güncelleme KPI’sı yanlış

**Önem:** Orta-Yüksek

### 4A. Analiz ve düzeltme

- [ ] Doğru çalışan Enflasyon Hesaplama motorunu değiştirmeden önce Proje Finans entegrasyonunu izle.
- [ ] Her gelir satırı için nominal tutar, baz tarih, enflasyon sonucu ve toplama katkısını test fixture ile görünür hale getir.
- [ ] Geçmiş tarihli kayıtlarda `inflation_preview = null` değerinin sıfır katkıya dönüşüp dönüşmediğini doğrula.
- [ ] Fazla ödenmiş kayıtta planlanan yerine ödenen tutarın baz alınıp alınmadığını doğrula.
- [ ] TÜFE kapsamında kullanılacak baz tutarı ve tarih kuralını tek yerde tanımla.
- [ ] Hesaplanamayan değeri sessizce `0` sayma; güvenli fallback veya görünür hata üret.
- [ ] Fark formatını düzelt:
  - Pozitif: `+₺X`
  - Negatif: `−₺X`
  - Sıfır: `₺0`
  - `+₺-X` asla üretilmemeli.
- [ ] Enflasyon motoru ile proje finans toplayıcısının sorumluluklarını ayır.

### 4B. Testler

- [ ] Demo proje örneği.
- [ ] DEDEPAŞA örneği.
- [ ] Geçmiş, bugün ve gelecek tarihli kalemler.
- [ ] Kısmi ödeme.
- [ ] Fazla ödeme.
- [ ] Eksik/null enflasyon verisi.
- [ ] Satır toplamı ile KPI toplamının mutabakatı.
- [ ] Pozitif, negatif ve sıfır fark formatı.

### 4C. Kabul kriterleri

- [ ] Rapordaki ₺200.000 kalem sıfır katkı vermez.
- [ ] Fazla ödeme, planlanan baz tutarın yanlışlıkla yerini almaz.
- [ ] TÜFE kapsamındaki her satırın katkısı matematiksel olarak izlenebilir.
- [ ] Fark etiketi doğru işaretle gösterilir.
- [ ] Enflasyon Hesaplama modülünün doğrulanmış 1,317502 çarpan davranışı bozulmaz.

---

# P2 — Orta öncelikli fonksiyon ve finans düzeltmeleri

## BUG-05 — Proje Finans gelir satırlarında gecikme durumu hesaplanmıyor

- [ ] Gelir satırlarının yalnızca saklanmış `status` alanını render ettiği noktayı bul.
- [ ] Gelenler ekranındaki çalışma zamanı durum sınıflandırmasını ortak yardımcı fonksiyona veya ortak backend alanına taşı.
- [ ] Vade tarihi bugünden önce ve kalan tutar pozitifse gecikme üret.
- [ ] Tam ödenmiş kayıt gecikmiş sayılmasın.
- [ ] Kısmi ve gecikmiş kayıt iki bilgiyi de korusun.
- [ ] DB kaydı güncellenmeden takvim ilerlediğinde durum doğru değişsin.
- [ ] Gelenler ve Proje Finans aynı kayıt için aynı rozetleri göstersin.

**Kabul:** Rapordaki 30.07.2026 tarihli açık kayıt iki ekranda da `Gecikmiş` görünür.

---

## BUG-06 — Medya albüm ve favori sayaçları gerçek verilerle uyuşmuyor

- [ ] Medya listesi, albüm sayacı ve favori sayacı sorgularını karşılaştır.
- [ ] Albüm–görsel ilişkisindeki yetim satırları tespit eden test/sorgu hazırla.
- [ ] Sayaçları yalnızca mevcut ve erişilebilir görseller üzerinden hesapla.
- [ ] Görsel silme akışında ilişki satırlarını transaction içinde güvenli temizle.
- [ ] Favori sayacını gerçek favori görsel sayısıyla eşitle.
- [ ] Albüm içindeki `X / toplam` değerini filtrelenmiş sonuçla eşitle.
- [ ] Mevcut yetim satırlar için idempotent cleanup/migration planı hazırla; production’da çalıştırma.
- [ ] Boş albüm, çoklu albüm, favori ekleme/çıkarma ve silme regresyon testlerini ekle.

**Kabul:** Albüm, favori ve liste sayaçları gerçek kayıtlarla birebir eşleşir; silinen görsel sayaçta kalmaz.

---

## BUG-07 — Silinmiş kaynaklara ait yetim bildirimler kalıyor

- [ ] Bildirimin kaynak türü ve kaynak kayıt ID ilişkisini izle.
- [ ] `notifications.php?generate=1` üretim mantığını incele.
- [ ] Kaynak silme akışında ilgili otomatik bildirimi sil, arşivle veya geçersiz hale getir.
- [ ] Generate çağrısında kaynağı bulunmayan bildirimi yeniden üretme.
- [ ] Duplicate bildirim oluşmasını engelle.
- [ ] Bildirim sayacından yetim/geçersiz kayıtları çıkar.
- [ ] Mevcut yetimler için idempotent cleanup planı hazırla; production’da çalıştırma.
- [ ] Kaynak mevcut, kaynak silinmiş ve tekrar generate senaryolarını test et.

**Kabul:** Silinen kayda ait kritik bildirim aktif ve okunmamış biçimde kalmaz; sayaç doğru azalır.

---

## BUG-08 — Fazla ödeme, konsolide finans ekranlarında farklı yorumlanıyor

- [ ] Gelenler, Müşteriler ve Net Durum hesaplamalarını ortak iş kurallarıyla karşılaştır.
- [ ] Gelenler’deki `SUM(planned) - SUM(paid)` yaklaşımını kayıt bazlı açık bakiye toplamına dönüştür.
- [ ] Konsolide kalan alacağı `SUM(MAX(planned - paid, 0))` kuralıyla hesapla.
- [ ] Gerçek tahsilatta tam `paid_amount` değerini koru.
- [ ] Fazla ödeme başka müşterilerin açık alacağını düşürmesin.
- [ ] Fazla ödeme müşteri/kayıt bazında görünür kalsın.
- [ ] Aynı kapsam ve tarih kesimindeki ekranların sonuçlarını eşitle.
- [ ] Fazla ödeme içeren birden fazla kayıtla birikimli regresyon testi yaz.

**Kabul:** ₺100.000 planlanan / ₺120.000 ödenen kayıt tahsilata ₺120.000 ekler; konsolide kalan alacağa ₺0 ekler ve diğer müşterilerin alacağını ₺20.000 azaltmaz.

---

## BUG-09 — “Yaklaşan Ödeme” kartı kısmi ödemelerin kalanını dışlıyor

- [ ] Kart sorgusunda yalnızca `status = planlandi` filtresi kullanılıp kullanılmadığını doğrula.
- [ ] Gelecek tarihli kısmi ödenmiş kayıtların pozitif kalan bakiyesini hesaba kat.
- [ ] Tam/fazla ödenmiş kayıtları dışarıda bırak.
- [ ] Mevcut yaklaşan ödeme tarih penceresini koru ve ortaklaştır.
- [ ] Kart ile alt tablonun aynı filtre ve kalan bakiye mantığını kullanmasını sağla.
- [ ] Tam açık, kısmi, tam ödenmiş, fazla ödenmiş ve tarih sınırı testlerini ekle.

**Kabul:** Rapordaki demo müşteri kartı ₺400.000 yerine doğru değer olan ₺430.000’i gösterir.

---

# P3 — Düşük öncelikli UX ve güvenlik iyileştirmeleri

## BUG-10 — Silme işlemleri `window.confirm()` kullanıyor

- [ ] Devlet Hakedişleri, Müşteriler, Gelenler ve Gidenler silme handler’larını bul.
- [ ] Yerel `window.confirm()` kullanımını mevcut uygulama modal bileşenine taşı.
- [ ] Modalda en az kayıt adı, kaynak türü ve geri alınamazlık uyarısı göster.
- [ ] Kaskad silme varsa bağlı kayıt sayısını güvenli preview ile göster; sayı bilinmiyorsa uydurma.
- [ ] İptalde hiçbir API isteği gönderilmediğini doğrula.
- [ ] Onayda tek silme isteği gönderildiğini ve loading sırasında çift tıklamanın engellendiğini doğrula.
- [ ] Erişilebilir odak yönetimi ve klavye davranışını koru.

**Kabul:** Silme öncesinde kullanıcı hangi kaydı ve varsa kaç bağlı kaydı sileceğini açıkça görür.

---

## BUG-11 — Form doğrulaması ilk hatada duruyor, alan bazlı mesaj yok

- [ ] Yeni müşteri ve gelir/gider formlarındaki ilk hatada `return` eden doğrulama akışını bul.
- [ ] Tüm alan hatalarını tek submit’te topla.
- [ ] Hatalı alanları görsel ve erişilebilir biçimde işaretle.
- [ ] Mesajı ilgili alanın altında göster.
- [ ] İlk hatalı alana odaklan/kaydır.
- [ ] Genel özet mesajı varsa alan mesajlarının yerine değil yanında kullan.
- [ ] Telefon, e-posta, zorunlu alan ve proje seçimi testlerini ekle.

**Kabul:** Kullanıcı boş formu bir kez gönderdiğinde tüm eksikleri görür; beş kez kaydetmek zorunda kalmaz.

---

## BUG-12 — Finansal inputlarda autocomplete ve input mode eksik

- [ ] Finansal modal ve ortak input bileşenlerini tespit et.
- [ ] Uygun alanlara React biçimiyle `autoComplete="off"` ekle.
- [ ] Tutar alanlarına `inputMode="decimal"` ekle.
- [ ] Alan tiplerinin, decimal ayracının ve mevcut sayı formatlama davranışının bozulmadığını doğrula.
- [ ] Tarayıcı otomatik doldurma ve manuel giriş regresyon testi yap.

**Kabul:** Eski tutar/başlık değerleri yeni finans kaydına istemsiz taşınmaz; mobil/masaüstü ondalık giriş davranışı korunur.

---

## BUG-13 — Enflasyon endeks tablosu etiketleri belirsiz

- [ ] Endeks tablosundaki sütunların hangi dönem ve veri tipini temsil ettiğini koddan doğrula.
- [ ] Dönem başı/dönem sonu, aylık/yıllık ve baz dönem bilgisini açık etiketle.
- [ ] Seçilen baz dönemini sonuç kartında görünür yap.
- [ ] Hesap motoruna dokunmadan yalnızca yorumlanabilirliği düzelt.
- [ ] Mevcut doğrulanmış örneğin sonucunu koru:
  - ₺1.000.000 → ₺1.317.502
  - Artış: %31,7502
  - Çarpan: 1,317502

**Kabul:** Kullanıcı kullanılan baz ayı ve endeks değerinin neyi temsil ettiğini ekrandan anlayabilir.

---

# P4 — Kapsam etiketleri ve regresyon koruması

## Bilinen, hata olmayan kapsam farkları

Aşağıdaki farkları yanlışlıkla “düzeltme”:

- [ ] Genel Bakış `Beklenen Tahsilat` yalnızca müşteri alacağını kapsıyor.
- [ ] Gelenler `Kalan Alacak` müşteri + devlet hakedişi kapsamını kullanıyor.
- [ ] Müşteriler `Toplam Tahsilat` yalnızca müşteri tahsilatını kapsıyor.
- [ ] Genel Bakış/Net Durum toplam gelirine devlet hakedişi tahsilatı da dahil.
- [ ] Bu kapsamlar korunacaksa kart alt açıklamalarında açıkça belirtilsin.

## Finansal çekirdek regresyonları

- [ ] Demo proje için aşağıdaki doğrulanmış değerleri koru:
  - Planlanan müşteri geliri: ₺1.400.000
  - Gerçekleşen müşteri geliri: ₺620.000
  - Planlanan hakediş: ₺300.000
  - Gerçekleşen hakediş: ₺90.000
  - Toplam planlanan gelir: ₺1.700.000
  - Toplam gerçekleşen gelir: ₺710.000
  - Kalan alacak: ₺990.000
  - Planlanan gider: ₺860.000
  - Gerçekleşen gider: ₺475.000
  - Kalan gider: ₺385.000
  - Gerçekleşen net kâr: ₺235.000
- [ ] Kısmi ödeme mantığını koru.
- [ ] Tarih kalıcılığını koru.
- [ ] Gecikme hesabını koru.
- [ ] Devlet hakedişi 30/30/30/10 toplamını koru.
- [ ] Proje/müşteri/tedarikçi ilişkilerini koru.
- [ ] Kaskad silme sonrası finansal toplamların geri dönmesini koru.
- [ ] Proje filtrelerinin KPI’ları doğru etkilemesini koru.
- [ ] Dövizli kayıtların mevcut kur dönüşüm davranışını bozma.

---

# P5 — Teknik doğrulama ve teslim

## Zorunlu komutlar

Projede mevcut scriptleri tespit ederek uygun olanları çalıştır:

- [ ] TypeScript type-check.
- [ ] Lint.
- [ ] Unit test.
- [ ] Integration/API test.
- [ ] Production build.
- [ ] İlgili PHP syntax kontrolleri.
- [ ] Varsa mevcut QA/regression scriptleri.
- [ ] Test yoksa kritik hesaplar için hedefli test ekle.

## Çıktılar

- [ ] Bu TODO dosyasındaki tamamlanan maddeleri işaretle.
- [ ] Kök dizinde `AKINAL_ADMIN_QA_FIX_IMPLEMENTATION_REPORT_2026-08-06_C.md` oluştur.
- [ ] Raporda şunları yaz:
  1. Değişen dosyalar
  2. Her BUG için doğrulanan kök neden
  3. Uygulanan çözüm
  4. Eklenen/değiştirilen testler
  5. Çalıştırılan komutlar ve sonuçları
  6. Yapılamayan veya bloke kalan işler
  7. Production’da manuel uygulanması gereken migration/runbook
  8. Bilinen riskler
  9. Deploy öncesi kontrol listesi
- [ ] Son mesajda kısa özet ver; kanıt olmadan PASS deme.
- [ ] Production deploy, migration execution, commit ve push yapma.

---

# Definition of Done

Çalışma aşağıdakilerin tamamı sağlanmadan bitmiş sayılmaz:

- [ ] BUG-01–04 kod ve test düzeyinde çözülmüş veya production migration gibi açık bir manuel bağımlılığa indirgenmiş.
- [ ] BUG-05–13 için ilgili düzeltme ve regresyon testleri tamamlanmış.
- [ ] Ortak finansal kurallar ekranlar arasında tutarlı.
- [ ] Demo proje finansal çekirdeği bozulmamış.
- [ ] Build/type-check/test komutları başarılı.
- [ ] Değişiklikler yalnızca ilgili dosyalarla sınırlı.
- [ ] Uygulama raporu oluşturulmuş.
- [ ] Production’a hiçbir değişiklik uygulanmamış.
