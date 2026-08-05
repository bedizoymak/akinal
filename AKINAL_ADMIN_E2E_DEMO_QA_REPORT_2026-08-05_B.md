# Akınal İnşaat Admin Paneli — Uçtan Uca Demo Veri ve Finans Mutabakatı QA Raporu

**Test tarihi:** 05.08.2026  
**Ortam:** Canlı yönetim paneli (`https://akinalinsaat.com/admin`)  
**Test yaklaşımı:** Cloud Browser ile sayfa render süreleri beklenerek, uzun ekranlarda kaydırma yapılarak, gerçek kullanıcı akışları üzerinden  
**Kapsam:** Yalnızca admin paneli; public site ziyaret edilmedi  
**Demo veri öneki:** `QA DEMO 20260805-B` / `QA DEMO B`  
**Teslim kararı:** **BLOCKED — teslim onayı verilmedi**

---

## 1. Yönetici Özeti

Canlı admin panelinde sıfırdan bir taslak proje, iki müşteri, beş müşteri ödeme kaydı, bir devlet hakedişi, iki tedarikçi/alt yüklenici, iki tedarikçi gideri, bir masraf kartı, iki masraf kartı gideri ve iki personel kartı oluşturuldu. Resmi/gayri resmi, tam ödenmiş, kısmi ödenmiş, açık, dövizli, aktif ve pasif senaryolar çalıştırıldı.

Temel cari ve gider akışları büyük ölçüde çalışmaktadır. Demo proje finansı, Gelenler ve Gidenler kayıtları matematiksel olarak doğru hesaplanmıştır. Bununla birlikte aşağıdaki üç hata teslimatı doğrudan bloke etmektedir:

1. **Genel Bakış toplam tahsilat ve net durum değerleri ₺55.000 fazla.**
2. **Müşteri ödeme tarihleri ve devlet hakedişi vade tarihi kullanıcı girişini kaybetmektedir.**
3. **Personel rol, maliyet dönemi, proje ataması ve tahsisat servisleri yüklenememekte; personel–proje ilişkisi doğrulanamamaktadır.**

Ek olarak Gidenler ekranındaki proje filtresi yeni demo proje seçildiğinde boş sonuç vermekte, kurumsal müşteri telefon doğrulaması hatayı kullanıcıya göstermemekte ve kurumsal “Yetkili Kişi” alanı veritabanı alanı tanımlı olmadığı için devre dışıdır.

---

## 2. Test Güvenliği ve Veri İzolasyonu

- Mevcut gerçek müşteri, proje, tedarikçi, ödeme, personel veya ayar kayıtları değiştirilmedi.
- Hiçbir gerçek kayıt silinmedi.
- Public siteye gidilmedi; admin içindeki public bağlantılar tıklanmadı.
- Proje **taslak/yayında değil** olarak bırakıldı.
- Bakım Konsolu migration butonları çalıştırılmadı.
- Manuel/Drive yedekleme, yedek indirme ve geri yükleme aksiyonları çalıştırılmadı.
- Ayarlar ekranında Kaydet/Sıfırla kullanılmadı.
- Medya yükleme/silme yapılmadı.
- Bildirimlerde “Tümünü Okundu Yap” ve “Tüm Bildirimleri Sil” kullanılmadı.
- Silme, gerçek veri düzenleme, yayınlama ve geri dönüşü zor sistem aksiyonları uygulanmadı.

---

## 3. Oluşturulan Demo Veri Seti

### 3.1 Proje

| Alan | Değer |
|---|---|
| Proje | `QA DEMO 20260805-B - Moda Rezidans` |
| Proje ID | `e346e692-593a-4a34-9c41-ad1245a7d169` |
| Slug | `qa-demo-20260805-b-moda-rezidans` |
| Yayın | Taslak / Yayında Değil |
| Tür | Konut Projesi |
| Durum | Planlama Aşamasında |
| Konum | Kadıköy, İstanbul |
| Sözleşme bedeli | ₺2.500.000,00 |
| Başlangıç / teslim | 2026 / 2028 |
| Arsa / inşaat alanı | 1.850 m² / 7.200 m² |
| Daire / kat / blok | 48 / 12 / 2 |
| Sıralama | 99 |

SEO başlığı, SEO açıklaması, kısa açıklama, detaylı açıklama ve teknik alanlar dolduruldu. Görsel yüklenmedi; proje taslak bırakıldığı için yayınlanmadı.

### 3.2 Müşteriler

| Müşteri | Tür | ID | Proje | Sonuç |
|---|---|---|---|---|
| `QA DEMO Bireysel Müşteri B` | Bireysel | `4f841b72-f2c8-4bd1-82bb-d762ee75deea` | Demo proje | Oluşturuldu |
| `QA DEMO B Yapı Teknolojileri A.Ş.` | Kurumsal | `82265234-c048-4051-9eeb-3be1aa3890f7` | Demo proje | Oluşturuldu |

Her iki müşteri için telefon, WhatsApp, e-posta, vergi/kimlik numarası, adres, il, ilçe, not ve proje ilişkisi girildi.

### 3.3 Müşteri Ödemeleri

| Kayıt | Hesap | Para birimi | Planlanan | Tahsil edilen | Beklenen durum | Görülen durum |
|---|---|---:|---:|---:|---|---|
| QA DEMO Resmi Peşin Tahsilat B | Resmi | TRY | ₺250.000 | ₺250.000 | Gerçekleşti | Gerçekleşti |
| QA DEMO Resmi Kısmi Tahsilat B | Resmi | TRY | ₺400.000 | ₺125.000 | Kısmi Ödendi | Kısmi Ödendi |
| QA DEMO Resmi Gecikmiş Senet B | Resmi | TRY | ₺150.000 | ₺0 | Geçmiş tarihe göre gecikmiş | Planlanan; tarih bugüne dönüştü |
| QA DEMO Gayri Resmi EUR Tahsilat B | Gayri Resmi | EUR, kur 55 | €10.000 / ₺550.000 | €4.000 / ₺220.000 | Kısmi Ödendi | Kısmi Ödendi |
| QA DEMO Kurumsal Açık Çek B | Resmi | TRY | ₺300.000 | ₺0 | Planlanan | Planlanan |

Müşteri ödeme toplamları:

- Planlanan: **₺1.650.000,00**
- Tahsil edilen: **₺595.000,00**
- Kalan: **₺1.055.000,00**

### 3.4 Devlet Hakedişi

| Alan | Değer |
|---|---|
| Başlık | `QA DEMO 20260805-B Devlet Teşvik Hakedişi` |
| Müşteri | QA DEMO B Yapı Teknolojileri A.Ş. |
| Proje | QA DEMO 20260805-B - Moda Rezidans |
| Planlanan | ₺200.000,00 |
| Tahsil edilen | ₺0,00 |
| Girilen vade | 15.09.2026 |
| Kaydedilen/görünen vade | Boş; Gelenler satırı 05.08.2026 gösteriyor |

Aşama dağılımı doğru üretildi:

- Su Basmanı: %30 / ₺60.000
- Kaba İnşaat: %30 / ₺60.000
- İnce İnşaat: %30 / ₺60.000
- İskan: %10 / ₺20.000

### 3.5 Tedarikçi ve Alt Yüklenici

| Kayıt | Tür | Durum | Sonuç |
|---|---|---|---|
| `QA DEMO B Atlas Beton A.Ş.` | Tedarikçi | Aktif | Oluşturuldu |
| `QA DEMO B Eksen Kalıp Alt Yüklenici` | Alt Yüklenici | Pasif | Oluşturuldu |

Tedarikçi giderleri:

| Kayıt | Hesap | Planlanan | Ödenen | Durum |
|---|---|---:|---:|---|
| QA DEMO Resmi Beton ve Donatı Gideri B | Resmi | ₺500.000 | ₺200.000 | Kısmi Ödendi |
| QA DEMO Gayri Resmi Nakliye Gideri B | Gayri Resmi | ₺120.000 | ₺120.000 | Gerçekleşti |

Tedarikçi toplamı:

- Planlanan: **₺620.000,00**
- Ödenen: **₺320.000,00**
- Kalan: **₺300.000,00**

### 3.6 Masraf Kartı

Kart: `QA DEMO 20260805-B - Şantiye Genel Giderleri`  
Kart ID: `7fc0cecc-5052-40eb-ba00-8b47c6081ec9`

| Kayıt | Hesap | Planlanan | Ödenen | Durum |
|---|---|---:|---:|---|
| QA DEMO Resmi Ruhsat ve Harç Gideri B | Resmi | ₺180.000 | ₺80.000 | Kısmi Ödendi |
| QA DEMO Gayri Resmi Şantiye Sarf Gideri B | Gayri Resmi | ₺50.000 | ₺50.000 | Gerçekleşti |

Masraf kartı toplamı:

- Planlanan: **₺230.000,00**
- Ödenen: **₺130.000,00**
- Kalan: **₺100.000,00**

### 3.7 Personel

| Personel | Durum | Görev | Sonuç |
|---|---|---|---|
| `QA DEMO 20260805-B - Mehmet Kalıp Ustası` | Aktif | Kalıp Ustası | Kart oluşturuldu |
| `QA DEMO 20260805-B - Ali Elektrik Ustası` | Pasif | Elektrik Ustası | Kart oluşturuldu |

Personel listesi oluşturma sonrası doğru sayım gösterdi:

- Toplam: 4
- Aktif: 3
- Pasif: 1

Aktif personel için hem Tahsisat hem Proje Ataması formu açıldı ve demo proje seçilerek kaydetme denendi. Ancak ilgili servisler yüklenemediği için kayıt sonucu doğrulanamadı; proje finansında personel gideri görünmedi.

---

## 4. Sayısal Mutabakat

### 4.1 Demo Proje Mutabakatı

| Ölçüt | Hesaplanan beklenen | Proje Finans | Gelenler/Gidenler | Sonuç |
|---|---:|---:|---:|---|
| Planlanan müşteri geliri | ₺1.650.000 | ₺1.650.000 | ₺1.650.000 | PASS |
| Planlanan devlet hakedişi | ₺200.000 | ₺200.000 | ₺200.000 | PASS |
| Planlanan toplam gelir | ₺1.850.000 | ₺1.850.000 | ₺1.850.000 | PASS |
| Gerçekleşen gelir | ₺595.000 | ₺595.000 | ₺595.000 | PASS |
| Kalan alacak | ₺1.255.000 | ₺1.255.000 | ₺1.255.000 | PASS |
| Planlanan gider | ₺850.000 | ₺850.000 | ₺850.000 | PASS |
| Gerçekleşen gider | ₺450.000 | ₺450.000 | ₺450.000 | PASS |
| Kalan gider | ₺400.000 | Kayıtlardan doğrulandı | ₺400.000 | PASS |
| Gerçekleşen kâr | ₺145.000 | ₺145.000 | 595.000 − 450.000 | PASS |

### 4.2 Global Finans Mutabakatı

| Ekran | Gelir/Tahsilat | Gider | Net | Sonuç |
|---|---:|---:|---:|---|
| Gelenler | ₺8.969.825 | — | — | Referans doğru toplam |
| Gidenler | — | ₺1.725.000 | — | Referans doğru toplam |
| Net Durum | ₺8.969.825 | ₺1.725.000 | ₺7.244.825 | Matematik doğru |
| Genel Bakış | ₺9.024.825 | ₺1.725.000 | ₺7.299.825 | **FAIL** |

Fark:

- Genel Bakış tahsilat fazlası: **₺55.000**
- Genel Bakış net durum fazlası: **₺55.000**
- Gider toplamı ekranlar arasında tutarlı: **₺1.725.000**

Matematik kontrolü:

`₺8.969.825 − ₺1.725.000 = ₺7.244.825`

Genel Bakış kendi yanlış tahsilat tutarı ile aritmetik olarak tutarlı olsa da gelir veri kümesi Gelenler ve Net Durum’dan farklıdır:

`₺9.024.825 − ₺1.725.000 = ₺7.299.825`

Bu nedenle problem aritmetik değil, Genel Bakış gelir sorgusu/tekilleştirme kapsamıdır.

### 4.3 Global Liste Toplamları

**Gelenler:**

- Planlanan toplam: ₺20.669.500
- Tahsil edilen: ₺8.969.825
- Kalan alacak: ₺11.699.675
- Gecikmiş kayıt: 2

**Gidenler:**

- Planlanan toplam: ₺2.425.000
- Ödenen: ₺1.725.000
- Kalan borç: ₺700.000
- Gecikmiş kayıt: 0

---

## 5. Kritik ve Yüksek Öncelikli Bulgular

### BUG-01 — Genel Bakış gelir ve net toplamı ₺55.000 fazla

**Önem:** Blocker / Critical  
**Durum:** Tekrar üretildi

**Adımlar:**

1. Admin > Genel Bakış açılır.
2. Toplam Tahsilat ve Net Durum not edilir.
3. Admin > Gelenler ve `/admin/net-durum` açılır.
4. Aynı 05.08.2026 kesim tarihindeki toplamlar karşılaştırılır.

**Beklenen:** Gelir ve net değerleri aynı veri kümesinde birebir eşit olmalıdır.  
**Gerçekleşen:** Genel Bakış gelir ve net değerleri ₺55.000 fazladır.

**Teknik yorum:** Fark demo veri eklenmeden önce de ₺55.000 idi ve yeni kayıtlar eklendikten sonra değişmeden kaldı. Bu, yeni demo kayıtlarından bağımsız, Genel Bakış sorgusundaki eski bir mükerrer/ek kaynak kapsamına işaret etmektedir.

### BUG-02 — Müşteri ödeme tarihleri kullanıcı girişini kaybediyor

**Önem:** Blocker / Critical  
**Durum:** Üç farklı kayıtta tekrar üretildi

| Kayıt | Girilen tarih | Kaydedilen tarih |
|---|---|---|
| Resmi Peşin | 01.08.2026 | 05.08.2026 |
| Resmi Kısmi | 20.08.2026 | 05.08.2026 |
| Resmi Gecikmiş Senet | 10.07.2026 | 05.08.2026 |

Sonuç olarak geçmiş tarihli senet “Gecikmiş” yerine “Planlanan” görünmektedir ve bildirim motoru bunu “Bugünkü Tahsilat” olarak üretmektedir.

### BUG-03 — Devlet hakedişi vade tarihi kayboluyor

**Önem:** High  
**Durum:** Tekrar üretildi

**Girilen:** 15.09.2026  
**Kaydedilen/görünen:** Vade alanı boş; Gelenler satırı 05.08.2026 gösteriyor.

### BUG-04 — Personel tahsisat ve gelişmiş personel servisleri çalışmıyor

**Önem:** Blocker / Critical  
**Durum:** Kalıcı; retry sonrası devam ediyor

Gözlenen hatalar:

- Yeni proje düzenleme ekranı: `Personel maliyet verileri yüklenemedi.`
- Personel Tahsisat ekranı: `Tahsisat verileri yüklenemedi.`
- “Tekrar Dene” sonrası aynı hata.
- Personel Detay > Roller: `Roller yüklenemedi.`
- Rol seçim listesi boş.
- Maliyet Dönemleri: sürekli `Yükleniyor...` durumunda.
- Proje Atamaları: `Proje atamaları yüklenemedi.`
- Tahsisat Ekle ve Proje Ataması Ekle formları açılıyor, fakat Kaydet sonrası başarı/hata bildirimi yok ve listeler yüklenmediği için sonuç doğrulanamıyor.
- Proje finansında personel kaynağı/gideri oluşmadı.

### BUG-05 — Gidenler proje filtresi yeni projede boş sonuç döndürüyor

**Önem:** High  
**Durum:** Tekrar üretildi

**Adımlar:**

1. Gidenler açılır.
2. Proje filtresinden `QA DEMO 20260805-B - Moda Rezidans` seçilir.

**Gerçekleşen:** Seçili proje etiketi boş kalır ve `Kayıt bulunamadı` gösterilir.  
**Karşı kanıt:** Arama kutusuna `QA DEMO` yazıldığında aynı projeye bağlı dört gider kaydı eksiksiz gelir ve toplamlar ₺850.000 / ₺450.000 / ₺400.000 olarak doğru hesaplanır.

---

## 6. Orta Öncelikli ve UX Bulguları

### BUG-06 — Kurumsal müşteri telefon doğrulaması sessizce başarısız

Kurumsal müşteri oluştururken `02169000002` girildiğinde Kaydet butonu görünür hata, alan uyarısı veya toast üretmeden hiçbir işlem yapmadı. Telefon `05329000002` olarak değiştirildiğinde kayıt başarıyla oluştu.

Alan etiketi yalnızca “Telefon” olduğu için mobil numara zorunluluğu açık değildir. Ya sabit telefon kabul edilmeli ya da doğrulama mesajı ve format kuralı kullanıcıya gösterilmelidir.

### BUG-07 — Kurumsal müşteri Yetkili Kişi alanı kullanılamıyor

Kurumsal müşteri formunda Yetkili Kişi alanı devre dışı ve şu açıklamayı göstermektedir:

`Veritabanı alanı henüz tanımlı değil`

Teslim edilmiş bir cari modülde kullanıcıya tamamlanmamış şema mesajı gösterilmemelidir.

### BUG-08 — Vade Farkı/TÜFE baz tarihi kaydedilmiyor

Kurumsal açık ödeme için Vade Farkı/TÜFE etkinleştirildi ve baz tarih `01.01.2026` girildi. Kayıt sonrası alan boş kaldı ve önizleme yerine `Baz dönem hedef dönemden sonra veya aynı dönem.` mesajı görüldü. Ödeme tarihindeki ana bug nedeniyle hedef dönem de 05.08.2026’ya sabitlenmektedir.

### OBS-01 — Net Durum arama filtresi satırları filtreliyor, KPI kartları global kalıyor

`QA DEMO` araması yedi gerçekleşmiş demo hareketini doğru biçimde listeledi (üç gelir, dört gider). Buna rağmen Toplam Gelir, Toplam Gider ve Net Bakiye kartları global değerleri göstermeye devam etti. Bu davranış tasarımsa ekranda belirtilmeli; filtrelenmiş mutabakat bekleniyorsa KPI’lar da filtreye uymalıdır.

### OBS-02 — Taslak projede public “Görüntüle” bağlantısı gösteriliyor

Proje “Yayında Değil” olarak işaretli olmasına rağmen kartta `/projelerimiz/qa-demo-20260805-b-moda-rezidans` bağlantılı “Görüntüle” aksiyonu görünmektedir. Public siteye gitmeme talimatı gereği bağlantı açılmadı; erişim kontrolü doğrulanmadı.

### OBS-03 — Proje Dışa Aktar aksiyonu doğrulanamadı

Filtrelenmiş taslak proje listesinde Dışa Aktar tıklandı. 10 saniye içinde tarayıcı indirme olayı veya görünür başarı/hata mesajı alınamadı. Bu sonuç tarayıcı indirme davranışına bağlı olabilir; manuel tarayıcıda ayrıca doğrulanmalıdır.

---

## 7. Fonksiyonel Test Matrisi

| Modül / Fonksiyon | Sonuç | Kanıt / Not |
|---|---|---|
| Proje oluşturma | PASS | Taslak proje ve tüm temel/teknik alanlar kaydedildi |
| Proje tür/durum/yayın filtreleri | PASS | Konut + Planlama + Taslak tek kayıt döndürdü |
| Proje finans ekranı | PASS | Gelir/gider/kâr matematiği doğru |
| Bireysel müşteri oluşturma | PASS | Kart ve proje ilişkisi doğrulandı |
| Kurumsal müşteri oluşturma | PASS/WARN | Mobil telefonla başarılı; sabit telefon sessizce reddedildi |
| Müşteri arama/tür/proje/bakiye filtreleri | PASS | Kurumsal + demo proje + bakiyesi olan filtreleri çalıştı |
| Resmi tam tahsilat | PASS | ₺250.000 / ₺250.000 |
| Resmi kısmi tahsilat | PASS | ₺400.000 / ₺125.000 |
| Resmi açık tahsilat | PASS | ₺300.000 / ₺0 |
| Gayri resmi EUR tahsilat | PASS | Kur 55 ve TL karşılıkları doğru |
| Ödeme tarihi kalıcılığı | FAIL | Üç farklı tarih 05.08.2026 olarak kaydedildi |
| TÜFE/vade farkı ödeme ayarı | FAIL | Baz tarih kayboldu, önizleme oluşmadı |
| Genel enflasyon hesaplama | PASS | ₺500.000 → ₺658.751; fark ₺158.751; %31,7502 |
| Devlet hakedişi oluşturma | PASS | 30/30/30/10 aşamalar doğru |
| Devlet hakedişi vade tarihi | FAIL | 15.09.2026 kayboldu |
| Aktif tedarikçi oluşturma | PASS | Kart ve iletişim alanları doğrulandı |
| Pasif alt yüklenici oluşturma | PASS | Tür ve durum doğrulandı |
| Resmi tedarikçi gideri | PASS | ₺500.000 / ₺200.000 |
| Gayri resmi tedarikçi gideri | PASS | ₺120.000 / ₺120.000 |
| Masraf kartı oluşturma | PASS | Yeni kart listede ve ekstrede göründü |
| Resmi/gayri resmi masraf kartı gideri | PASS | ₺180.000/₺80.000 ve ₺50.000/₺50.000 |
| Aktif personel oluşturma | PASS | Listede aktif |
| Pasif personel oluşturma | PASS | Sayaç 1 pasif gösterdi |
| Personel rolü | FAIL | Roller yüklenemedi, liste boş |
| Personel maliyet dönemleri | FAIL | Sürekli yükleniyor |
| Personel proje ataması | FAIL/BLOCKED | Servis yüklenemedi; kayıt doğrulanamadı |
| Personel tahsisat | FAIL/BLOCKED | Servis yüklenemedi; retry başarısız |
| Gelenler global toplam | PASS | ₺8.969.825 tahsil |
| Gelenler proje filtresi | PASS | Demo proje ₺1.850.000 / ₺595.000 / ₺1.255.000 |
| Gelenler kayıt türü filtresi | PASS | Gayri resmi ₺550.000 / ₺220.000 / ₺330.000 |
| Gidenler global toplam | PASS | ₺1.725.000 ödenen |
| Gidenler arama filtresi | PASS | Demo ₺850.000 / ₺450.000 / ₺400.000 |
| Gidenler kaynak filtresi | PASS | Tedarikçi ₺620.000 / ₺320.000 / ₺300.000 |
| Gidenler proje filtresi | FAIL | Seçim sonrası boş etiket ve sıfır kayıt |
| Net Durum global toplam | PASS | ₺8.969.825 − ₺1.725.000 = ₺7.244.825 |
| Genel Bakış global toplam | FAIL | Gelir/net ₺55.000 fazla |
| Medya ekranı | PASS (smoke) | 2 görsel ve albümler yüklendi; değişiklik yapılmadı |
| İletişim Talepleri | PASS (smoke) | Boş durum doğru render edildi |
| Bildirimler | PASS (smoke) | 9 bildirim yüklendi; demo kayıt bildirimleri görüldü |
| Site Ayarları | PASS (smoke) | Form ve tamamlanma göstergeleri yüklendi; kaydetme yapılmadı |
| Bakım Konsolu | PASS (smoke) | İki kontrollü migration aksiyonu render edildi; çalıştırılmadı |
| Yedekleme Merkezi | PASS (smoke) | Gecikmeli olarak yüklendi; 2/30 başarılı Drive yedeği göründü |

---

## 8. Bildirim Doğrulaması

Demo ödeme kayıtları sonrasında bildirim sayısı 9 oldu. Aşağıdaki demo bildirimleri görüldü:

- QA DEMO Kurumsal Açık Çek B — Bugünkü Tahsilat
- QA DEMO Resmi Kısmi Tahsilat B — Bugünkü Tahsilat
- QA DEMO Resmi Gecikmiş Senet B — Bugünkü Tahsilat
- QA DEMO Gayri Resmi EUR Tahsilat B — Bugünkü Tahsilat

“Gecikmiş Senet” kaydının bugünkü tahsilat olarak görünmesi ödeme tarihi kaybı hatasının bildirim motoruna doğrudan etkisini kanıtlamaktadır.

---

## 9. Teslim Kararı ve Çıkış Kriterleri

**Karar: BLOCKED — şu haliyle proje teslim onayı alamaz.**

Teslim onayı için asgari kapanış kriterleri:

1. Genel Bakış gelir sorgusundaki ₺55.000 farkın kaynağı bulunmalı ve Gelenler/Net Durum ile aynı tekilleştirilmiş veri kümesine bağlanmalı.
2. Müşteri ödeme tarihi, devlet hakedişi vade tarihi ve TÜFE baz tarihi uçtan uca doğru saklanmalı.
3. Tarih düzeltmesinden sonra gecikmiş/yaklaşan durumları ve bildirimler yeniden test edilmeli.
4. Personel roller, maliyet dönemleri, proje atamaları ve tahsisat API’leri çalışmalı.
5. Personel proje ilişkisi hem personel detayında hem proje tarafında çift yönlü görünmeli.
6. Personel maliyeti Gidenler ve proje finansına doğru yansımalı.
7. Gidenler proje filtresi yeni proje için doğru kayıtları ve ₺850.000 / ₺450.000 / ₺400.000 toplamlarını göstermeli.
8. Kurumsal telefon doğrulaması görünür hata mesajı vermeli veya sabit telefon kabul etmeli.
9. Yetkili Kişi alanı tamamlanmalı ya da canlı formdan kaldırılmalı.
10. Düzeltilmiş sürümde aynı `QA DEMO 20260805-B` veri setiyle regresyon testi tekrarlanmalı.

---

## 10. Sonuç

Temel proje, cari, tedarikçi, masraf ve finans toplama fonksiyonları çalışmaktadır. Demo proje özelindeki gelir ve gider hesapları doğru, döviz dönüşümü tutarlı ve resmi/gayri resmi ayrımı korunmuştur. Buna karşılık global dashboard tekilleştirmesi, tarih kalıcılığı ve personel alt sistemi teslimat seviyesinde kritik açıklara sahiptir.

Bu rapor yalnızca canlı admin panelinde gözlenen ve oluşturulan demo kayıtlarla tekrar edilen kanıtlara dayanır; public site hakkında yeni bir PASS/FAIL iddiası içermez.
