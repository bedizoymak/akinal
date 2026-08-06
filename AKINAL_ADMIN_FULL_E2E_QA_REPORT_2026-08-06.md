# Akınal İnşaat Admin Panel Tam Uçtan Uca QA Raporu

## 1. Test özeti

`https://akinalinsaat.com/admin` canlı yönetim paneli, gerçek kayıtlara dokunmadan `QA DEMO 20260806-C` önekli kontrollü verilerle test edilmiştir. Proje, müşteri, tahsilat, devlet hakedişi, tedarikçi, gider, masraf kartı ve personel kartı akışlarında oluşturma, doğrulama, liste/detay yansıması, düzenleme, filtreleme ve yenileme kontrolleri uygulanmıştır.

Test sırasında ödeme, gider ve hakediş tarihlerinin kullanıcı tarafından seçilen değerden bağımsız biçimde `06.08.2026` tarihine dönüştüğü tekrar üretilebilir yüksek etkili bir veri bütünlüğü hatası bulunmuştur. Bu hata; geçmiş, bugün ve gelecek tarihli durum etiketlerinin güvenilir biçimde test edilmesini ve tarih kesimli finansal mutabakatın kabul edilmesini engellemektedir.

İlk tarayıcı oturumundaki bağlantı kesintisinden sonra teste devam edilmiştir. Kullanıcının açık silme onayıyla yalnızca `QA DEMO 20260806-C DELETE TEST - Masraf Kartı Gideri` silinmiş; yenileme sonrası geri gelmediği, Masraf Kartı, Gidenler, Proje Finans, Net Durum ve Genel Bakış toplamlarından düştüğü doğrulanmıştır. Gelir–gider–net mutabakatı tüm ana finans ekranlarında beklenen değerlerle birebir tutmuştur.

Personel kartı CRUD’u, arama ve durum filtresi çalışmaktadır. Buna karşılık rol seçenekleri boş gelmiş; maliyet dönemi, proje ataması ve tahsisat kayıtları canlıda açık hata mesajlarıyla başarısız olmuştur. Bakım Konsolu’nda bu beş bağımlı tabloyu oluşturan kontrollü migration aksiyonu görünmektedir; QA kapsamında migration çalıştırılmamıştır.

## 2. Test tarihi, ortamı ve test kapsamı

- Test tarihi: 06.08.2026
- Saat dilimi: Europe/Istanbul
- Ortam: Canlı admin paneli
- Tarayıcı: Cloud Chrome, oturum açılmış admin hesabı
- Kapsam: Yalnızca `/admin`
- Public site: Açılmadı
- Test veri öneki: `QA DEMO 20260806-C`
- Devam testi: Tarayıcı bağlantısı yenilendikten ve kullanıcı yalnızca `DELETE TEST` gideri için silme onayı verdikten sonra aynı veri setiyle sürdürüldü
- Başlangıç Genel Bakış kanıtı: 3 proje, toplam tahsilat ₺8.969.825, toplam gider ₺1.725.000, net ₺7.244.825, beklenen tahsilat ₺5.952.175
- Kapanış Genel Bakış kanıtı: 4 proje, toplam tahsilat ₺9.679.825, toplam gider ₺2.175.000, net ₺7.504.825, beklenen tahsilat ₺6.732.175
- Başlangıç güvenli kayıt envanteri:
  - Projeler: 3 (`DEDEPAŞA...`, `QA DEMO 20260805-B...`, `QA UAT 20260805...`)
  - Müşteriler: 4
  - Tedarikçiler: 4
  - Masraf kartları: 2
  - Devlet hakedişleri: 5

## 3. Test dışı bırakılan aksiyonlar

- Mevcut gerçek kayıtların düzenlenmesi veya silinmesi
- Proje yayınlama/yayından kaldırma
- Medya yükleme
- İçe aktarma
- Migration çalıştırma
- Manuel yedek alma veya yedek geri yükleme
- Ayar değişikliği
- Public site kontrolü
- Proje, müşteri, tedarikçi ve personel kartı için ayrıca bağımsız silme kayıtları oluşturma
- Bildirimleri topluca okundu yapma veya silme

## 4. Oluşturulan tüm demo kayıtları ve kimlikleri

| Kaynak | Ad / başlık | Kimlik veya kayıt kanıtı | Durum |
|---|---|---|---|
| Proje | QA DEMO 20260806-C - Tam Kapsamlı Admin Test Projesi | `97762469-8f3c-4061-b596-b9659b66c2f1` | Taslak, kalıcı |
| Bireysel müşteri | QA DEMO 20260806-C Bireysel Müşteri | `56f5127c-7162-4bf1-8cd9-6581dfff706e` | Kalıcı |
| Kurumsal müşteri | QA DEMO 20260806-C Yapı Teknolojileri A.Ş. | `7756d5f0-f001-4054-af40-98d63c23894d` | Kalıcı |
| Tahsilat | QA DEMO 20260806-C - Tam Tahsil Edilmiş TRY Gelir | Müşteri detay satırı | Kalıcı |
| Tahsilat | QA DEMO 20260806-C - Kısmi Tahsil Edilmiş TRY Gelir | Müşteri detay satırı | Kalıcı |
| Tahsilat | QA DEMO 20260806-C - Gelecek Vadeli Açık TRY Gelir | Müşteri detay satırı | Kalıcı; tarih hatalı |
| Tahsilat | QA DEMO 20260806-C - Vadesi Geçmiş Açık TRY Gelir | Müşteri detay satırı | Kalıcı; tarih hatalı |
| Tahsilat | QA DEMO 20260806-C - Kısmi EUR Gayri Resmi Gelir | Müşteri detay satırı | Kalıcı; 1 EUR = ₺50 |
| Devlet hakedişi | QA DEMO 20260806-C - Devlet 30-30-30-10 Hakedişi | Hakediş kartı | Kalıcı; vade tarihi kayıp |
| Hakediş tahsilatı | QA DEMO 20260806-C - Su Basmanı Hakediş Tahsilatı | Hakediş hareketi | Kalıcı; tarih hatalı |
| Tedarikçi | QA DEMO 20260806-C Atlas Resmî Tedarikçi A.Ş. | `d4fb2c51-3702-48a2-8c20-fcf2115952f6` | Kalıcı |
| Alt yüklenici | QA DEMO 20260806-C Eksen Gayri Resmî Alt Yüklenici | `4396830f-7750-4864-a2e6-84690ea67640` | Pasif, kalıcı |
| Gider | QA DEMO 20260806-C - Tam Ödenmiş Resmî Tedarikçi Gideri | Tedarikçi detay satırı | Kalıcı; tarih hatalı |
| Gider | QA DEMO 20260806-C - Kısmi Ödenmiş Resmî Tedarikçi Gideri | Tedarikçi detay satırı | Kalıcı |
| Gider | QA DEMO 20260806-C - Açık Gayri Resmî Alt Yüklenici Gideri | Alt yüklenici detay satırı | Kalıcı; tarih hatalı |
| Masraf kartı | QA DEMO 20260806-C - Şantiye Masraf Kartı | `4cf69dd9-8ada-4d49-b732-7836c7a72811` | Kalıcı |
| Masraf kartı gideri | QA DEMO 20260806-C - Masraf Kartı Kısmi Gider | Masraf kartı ekstre satırı | Kalıcı; tarih hatalı |
| Silme testi gideri | QA DEMO 20260806-C DELETE TEST - Masraf Kartı Gideri | Masraf kartı ekstre satırı | Kullanıcı onayıyla silindi; yenileme sonrası yok |
| Aktif personel | QA DEMO 20260806-C - Hasan Kalıp Ustası | `24ccbb82-7734-4833-84cf-34b98d7a9ad3` | Aktif, kalıcı |
| Pasif personel | QA DEMO 20260806-C - Ayşe Elektrik Ustası | `943e7067-c283-4633-ae33-6ecc2cc5f959` | Pasif, kalıcı |

## 5. Test edilen modüller

### Ana menü envanteri

| Menü sayfası | Gözlenen yüzey/fonksiyon | Test durumu |
|---|---|---|
| Genel Bakış | KPI kartları, aylık özet, takip listesi, son hareketler, proje durumu | PASS; kapanış mutabakatı tamamlandı |
| Gelenler | KPI, proje filtresi, liste ve durumlar | PASS (tutar); tarihler FAIL |
| Gidenler | KPI, proje/kaynak/kayıt türü filtreleri ve liste | PASS |
| Enflasyon Hesaplama | 259 TCMB kaydı ve bileşik hesap | PASS smoke |
| Projeler | Liste, arama, boş durum, oluşturma, detay, düzenleme | PASS; silme/dışa aktarma NOT TESTED |
| Medya | 2 görsel, albümler, arama ve yükleme kontrolleri | PASS smoke; yükleme yapılmadı |
| Müşteriler | Liste, oluşturma, detay, düzenleme, proje ilişkisi, finans sekmeleri | Ana akış PASS; arama/filtre NOT TESTED |
| Devlet Hakedişleri | Liste/kart, oluşturma, düzenleme, aşamalar ve tahsilat | Tutar akışı PASS; tarihler FAIL |
| Tedarikçiler | Liste, oluşturma, detay, gider ekleme | Ana akış PASS |
| Masraf Kartları | Liste, oluşturma, ekstre, gider ekleme ve kontrollü gider silme | PASS |
| Personeller | CRUD, arama, durum filtresi, detay; rol/maliyet/atama/tahsisat | Kart akışı PASS; bağlı servisler FAIL |
| İletişim Talepleri | Arama, durum filtresi ve boş durum | PASS smoke |
| Bildirimler | 13 otomatik bildirim, arama/filtre kontrolleri | PASS smoke; tarih hatası etkisi var |
| Ayarlar | Kimlik, iletişim, ana sayfa, SEO ve harita alanları | PASS smoke; kayıt mutasyonu yapılmadı |
| Bakım Konsolu | Kontrollü migration aksiyonları | PASS smoke; mutasyon yapılmadı |
| Yedekleme Merkezi | Drive bağlantısı, 3 yedek, geçmiş ve denetim kaydı | PASS smoke; yeni yedek alınmadı |

Ana menü dışında bağımsız `Personel Finans` veya ayrı bir `Masraf Kartı Finans` menü öğesi gözlenmedi; masraf kartı finansı kart detay/ekstre yüzeyinden test edildi. Bakım ve yedekleme merkezlerinde veri değiştiren işlemler özellikle çalıştırılmadı.

### Genel Bakış

Sayfa render oldu; KPI kartları, bu ay özeti, takip listesi, son hareketler, proje durumu ve aylık finans özeti yüklendi. Başlangıç ve kapanış toplamları kaydedildi. Kapanışta toplam tahsilat ₺9.679.825, gider ₺2.175.000 ve net ₺7.504.825 oldu; başlangıca göre demo veri setinin beklenen ₺710.000 gelir − ₺450.000 gider = ₺260.000 net etkisi birebir doğrulandı.

### Projeler

- Başlangıç toplamı 3, aktif 3, yayında 2, taslak 1.
- Arama `QA DEMO 20260805-B` ile tek kayıt getirdi.
- Sonuçsuz arama `Proje bulunamadı` boş durumunu gösterdi.
- Boş taslak kaydında `Proje adı zorunludur` mesajı gösterildi.
- Yeni taslak proje oluşturuldu; başarı mesajı `Proje oluşturuldu`.
- Kayıt ID'si URL'de oluştu; düzenleme ekranı alanları doğru hydrate etti.
- Yenileme sonrası proje adı, tür, durum, konum, sözleşme bedeli ve teknik alanlar korundu.
- Detay açıklaması düzenlendi; `Kaydedildi` mesajı ve yenileme sonrası kalıcılık doğrulandı.
- Taslak için public `Görüntüle` linki listede gösterilmedi.

### Müşteriler

- Başlangıç toplamı 4.
- Bireysel ve kurumsal müşteri oluşturuldu.
- Boş formda telefon zorunluluğu erişilebilir hata mesajıyla bildirildi.
- `123` telefon girdisi reddedildi.
- `qa-gecersiz` e-posta girdisi `Geçerli bir e-posta adresi girin` mesajıyla reddedildi.
- `05329000011` mobil telefon kabul edildi.
- `0216 900 00 02` sabit hat kabul edildi ve detayda `0(216) 900 00 02` olarak gösterildi.
- Kurumsal WhatsApp `0532 900 00 12` kabul edildi.
- Yetkili kişi alanı create/edit/read akışında `QA DEMO Yetkili C` olarak hydrate oldu; `QA DEMO Yetkili C Güncel` düzenlemesi yenileme sonrası korundu.
- Her iki müşteri demo projeyle ilişkilendirildi ve müşteri detayında proje finans bağlantısı gösterildi.
- Notlar, adres, e-posta ve vergi numarası detayda doğru göründü.

### Tahsilatlar / ödeme planları

- Resmî ve gayri resmî hesap sekmeleri çalıştı.
- Boş gelir formunda `Başlık zorunludur` inline mesajı gösterildi.
- TRY tam, kısmi, açık ve geçmiş/gelecek amaçlı kayıtlar oluşturuldu.
- EUR kaydı 5.000 EUR planlanan, 2.000 EUR tahsil edilmiş ve 1 EUR = 50 TRY ile kaydedildi; ekranda sırasıyla ₺250.000 ve ₺100.000 karşılıkları doğru gösterildi.
- Tutar bazlı etiketler `Gerçekleşti`, `Kısmi Ödendi` ve `Planlanan` olarak doğru üretildi.
- Tarih alanı için seçilen `15.07.2026`, `15.09.2026`, `15.06.2026` ve `01.08.2026` değerleri kayıtta `06.08.2026` olarak göründü.
- İlk kayıt düzenlemeye açıldığında tarih alanı `2026-08-06` hydrate oldu. `2026-07-15` ile tekrar kaydetme denemesinde değer anında `2026-08-06`'ya döndü ve liste değişmedi.

### Devlet hakedişleri

- Başlangıç toplam hakediş ₺5.875.000, tahsil edilen ₺127.500, kalan ₺5.747.500 ve 1/20 tamamlanmış aşama.
- ₺300.000 hakediş oluşturuldu; 30/30/30/10 dağılımı ₺90.000 / ₺90.000 / ₺90.000 / ₺30.000 ile matematiksel olarak doğru oluştu.
- `20.10.2026` vade tarihi girildi; kartta görünmedi ve düzenleme formunda tarih alanı boş hydrate oldu.
- Su Basmanı aşaması ₺90.000 olarak gerçekleştirildi; toplam `Kısmi Ödendi`, tahsil edilen ₺90.000, kalan ₺210.000 ve %30 tamamlandı oldu.
- Hakediş tahsilatında `05.08.2026` girildi ancak hareket `06.08.2026` kaydedildi.

### Tedarikçiler / alt yükleniciler

- Başlangıç toplamı 4.
- Aktif tedarikçi ve pasif alt yüklenici oluşturuldu.
- Başarı mesajı, detay ekranı ve iletişim/vergi/konum alanları doğrulandı.
- Tedarikçi giderleri detayda ve toplam kartlarında göründü.

### Masraf kartları ve giderler

- Başlangıç masraf kartı sayısı 2.
- Yeni kart oluşturuldu; başarı mesajı ve listede 3 toplam kart doğrulandı.
- Ekstre ekranı boş durumu `Henüz kayıt yok` gösterdi.
- ₺100.000 planlanan / ₺50.000 ödenen gider eklendi; toplamlar ve `Kısmi Ödendi` etiketi doğru oldu.
- Silme için ₺10.000 / ₺10.000 `DELETE TEST` gideri oluşturuldu; kart toplamları geçici olarak ₺110.000 / ₺60.000 / ₺50.000 oldu.
- İlk tıklamada cloud browser bağlantısı zaman aşımına uğradı. Devam testinde kullanıcı silme onayını verdi; kayıt ekstrede kayboldu, sayfa yenilemesinde geri gelmedi ve kart toplamları ₺100.000 / ₺50.000 / ₺50.000 değerlerine döndü.

### Personel, rol, maliyet, proje ataması ve tahsisat

- Başlangıçta 4 personel (3 aktif, 1 pasif) vardı.
- `QA DEMO 20260806-C - Hasan Kalıp Ustası` aktif ve `QA DEMO 20260806-C - Ayşe Elektrik Ustası` pasif olarak oluşturuldu; başarı mesajı, listede 6/4/2 toplamı, arama, pasif filtresi ve yenileme kalıcılığı doğrulandı.
- Hasan detay ekranı açıldı; Roller, Maliyet Dönemleri, Proje Atamaları, Tahsisat ve Mali Hareketler yüzeyleri render oldu.
- `Rol Ekle` penceresi açıldı ancak rol seçicisi boş listbox gösterdi; seçilebilir rol yoktu.
- ₺40.000 maaş + ₺6.000 SGK + ₺4.000 yemek + ₺2.000 ulaşım = ₺52.000 toplamlı Ağustos maliyet dönemi denemesi `Maliyet dönemi oluşturulamadı / Maliyet dönemi işlemi tamamlanamadı` mesajıyla başarısız oldu. Formda seçilen `01.08.2026` tarihi de gönderim sırasında `06.08.2026` değerine döndü.
- Hasan’ın demo projeye atama denemesi `Atama oluşturulamadı / Görevlendirme işlemi tamamlanamadı` mesajıyla başarısız oldu.
- Ağustos 2026 için 22/22 gün demo proje tahsisatı denemesi `Tahsisat oluşturulamadı / Tahsisat işlemi tamamlanamadı` mesajıyla başarısız oldu.
- Bakım Konsolu, bu akışların kullandığı `ak_roles`, `ak_employee_roles`, `ak_employee_cost_periods`, `ak_employee_project_assignments` ve `ak_employee_project_allocations` tablolarını oluşturan idempotent production migration aksiyonunu göstermektedir. QA emri gereği çalıştırılmadı.

### Kapanış smoke testleri

- Bildirimler 13 otomatik kayıtla yüklendi; C veri setindeki tarihleri bugüne düşen tahsilatlar `Bugünkü Tahsilat` olarak göründü.
- Medya 2/2 görsel, albümler, arama ve yükleme kontrolleriyle render oldu; dosya yüklenmedi.
- İletişim Talepleri boş durum, arama ve durum filtresiyle render oldu.
- Ayarlar mevcut site bilgileriyle yüklendi; Kaydet butonu değişiklik yapılmadığı için pasifti.
- Yedekleme Merkezi 3/30 başarılı Drive yedeğini, son cron yedeğini ve denetim kaydını gösterdi; manuel yedek tetiklenmedi.
- Enflasyon Hesaplama 259 TCMB kaydını yükledi; 1.000.000 TL için Temmuz 2025 → Temmuz 2026 sonucu ₺1.317.502 ve %31,7502 olarak render oldu.

## 6. PASS / FAIL / BLOCKED / NOT TESTED matrisi

| Modül / akış | Sonuç | Kanıt özeti |
|---|---|---|
| Genel Bakış render | PASS | KPI, aylık özet, son hareketler ve proje kartları yüklendi |
| Genel Bakış kapanış mutabakatı | PASS (tutar) | Başlangıç neti ₺7.244.825 + demo neti ₺260.000 = ₺7.504.825 |
| Proje liste/arama/boş durum | PASS | Filtrelenmiş tek kayıt ve sonuçsuz boş durum doğrulandı |
| Proje oluşturma/düzenleme/yenileme | PASS | ID, başarı mesajı ve kalıcı alanlar doğrulandı |
| Proje silme | NOT TESTED | Ayrı proje DELETE TEST kaydı oluşturulmadı |
| Müşteri validasyon | PASS | Telefon ve e-posta hataları; sabit/mobil kabulü |
| Müşteri create/detail/edit/reload | PASS | İki tür müşteri, proje ilişkisi ve yetkili kişi kalıcılığı |
| Müşteri arama/filtre | NOT TESTED | Kapanışta öncelik finans ve personel akışlarına verildi |
| Tahsilat tutar/kur/durum | PASS | TRY/EUR ve matematiksel toplamlar doğru |
| Tahsilat tarih kalıcılığı | FAIL | Girilen tarihler 06.08.2026'ya dönüyor |
| Tahsilat geçmiş/gelecek etiketleri | BLOCKED | Tarih hatası nedeniyle senaryolar oluşmuyor |
| Devlet hakedişi aşama matematiği | PASS | 30/30/30/10 toplamı doğru |
| Devlet hakedişi vade tarihi | FAIL | Tarih kayıp, edit formu boş |
| Hakediş tahsilat tarihi | FAIL | 05.08.2026 → 06.08.2026 |
| Tedarikçi/alt yüklenici create/detail | PASS | Aktif/pasif, tür ve iletişim alanları |
| Tedarikçi giderleri | PASS | Tam/kısmi/açık ve resmî/gayri resmî tutarlar |
| Gider tarih kalıcılığı | FAIL | Geçmiş/gelecek tarihler 06.08.2026'ya dönüyor |
| Masraf kartı create/ekstre/gider | PASS | Kart ve kısmi gider toplamları |
| Gider silme onay/yenileme/finans etkisi | PASS | DELETE TEST yok, yenilemede dönmedi; ₺10.000 tüm toplam ekranlarından düştü |
| Gider silme iptal ile koruma | NOT TESTED | Onay öncesi iptal ayrı kayıtta uygulanmadı |
| Personel create/detail/arama/filtre/reload | PASS | Aktif ve pasif iki C kaydı, ID, arama, pasif filtresi ve kalıcılık |
| Personel rol atama | FAIL | Rol seçicisi boş; seçilebilir rol yok |
| Personel maliyet dönemi | FAIL | ₺52.000 dönem kaydı açık hata mesajıyla reddedildi |
| Personel proje ataması | FAIL | Demo proje seçildi; görevlendirme işlemi tamamlanamadı |
| Personel tahsisat | FAIL | 22/22 gün kaydı tahsisat hatasıyla reddedildi |
| Gelenler | PASS (tutar) | Proje filtresi ₺1.700.000 / ₺710.000 / ₺990.000 |
| Gidenler proje/kaynak filtreleri | PASS | Proje ₺800.000/₺450.000/₺350.000; resmî ve gayri resmî ayrımı doğru |
| Net Durum | PASS (tutar) | `QA DEMO 20260806-C` filtresi ₺710.000 − ₺450.000 = ₺260.000 |
| Proje Finans | PASS (tutar) | Gelir, gider, kalan ve ₺260.000 kâr mühendislik hesabıyla aynı |
| Müşteri Finans — müşteri detay kapsamı | PASS | İki müşterinin KPI, resmî/gayri resmî hesap sekmeleri ve tutarları doğrulandı |
| Masraf Kartı Finans | PASS | Ekstre, silme ve yenileme sonrası ₺100.000/₺50.000/₺50.000 |
| Bildirimler modülü | PASS smoke | 13 otomatik kayıt ve tarih hatasının bildirim etkisi gözlendi |
| Enflasyon Hesaplama | PASS smoke | 259 TCMB kaydı ve örnek bileşik hesap yüklendi |
| Medya | PASS smoke | 2 görsel, albüm ve arama/yükleme kontrolleri render oldu |
| İletişim kayıtları | PASS smoke | Arama, durum filtresi ve boş durum render oldu |
| Ayarlar | PASS smoke | Mevcut alanlar yüklendi; kayıt mutasyonu yapılmadı |
| Bakım merkezi | PASS smoke | Kontrollü migration listesi yüklendi; çalıştırılmadı |
| Yedekleme merkezi | PASS smoke | Drive bağlı, 3 yedek ve denetim kaydı yüklendi; yeni yedek alınmadı |

## 7. Başarısız bulgular

### AKINAL-QA-C-001 — Gelir/gider/hakediş işlem tarihleri kullanıcı girdisini yok sayıyor

- Önem seviyesi: Kritik
- Etkilenen ekran/API: Müşteri finans gelir modalı, tedarikçi gider modalı, masraf kartı gider modalı, hakediş tahsilat modalı ve ilgili kayıt servisleri
- Tekrar adımları:
  1. Demo müşteri detayında `Ekle` seç.
  2. Başlık, proje ve tutar gir.
  3. Tarihi `15.07.2026` yap ve kaydet.
  4. Liste satırını ve düzenleme modalını aç.
  5. Tarihi yeniden `15.07.2026` yapıp kaydet.
- Beklenen davranış: Kayıt ve düzenleme sonrası tarih `15.07.2026` kalmalıdır.
- Gerçekleşen davranış: Liste ve edit formu `06.08.2026` göstermektedir. Edit kaydında kullanıcı değeri gönderim sırasında yeniden bugüne dönmektedir.
- Veri etkisi: Geçmiş/gelecek vade sınıfları, gecikme etiketleri, bildirimler, aylık raporlar ve tarih kesimli finans toplamları güvenilmezdir.
- Kanıt: `QA DEMO 20260806-C - Tam Tahsil Edilmiş TRY Gelir`; girilen 15.07.2026, görünen 06.08.2026. Aynı davranış gelecek/açık gelir, tedarikçi gideri, masraf kartı gideri ve hakediş tahsilatında üretildi.
- Önerilen kök neden araştırma alanı: Dialog açıkken form resetleyen prop/effect; payload'da `date` alanının yanlış isimle gönderilmesi; backend'in eksik/malformed tarihi sessizce `CURRENT_DATE` ile değiştirmesi. Frontend gönderim payload'ı ve PHP create/update date mapping birlikte izlenmelidir.

### AKINAL-QA-C-002 — Devlet hakedişi vade tarihi saklanmıyor

- Önem seviyesi: Yüksek
- Etkilenen ekran/API: Devlet Hakedişleri oluşturma/düzenleme
- Tekrar adımları:
  1. Hakediş Ekle aç.
  2. Demo müşteri/proje seç.
  3. `20.10.2026` vade tarihi ile kaydet.
  4. Oluşan kartı düzenlemeye aç.
- Beklenen davranış: Kartta 20.10.2026 görünmeli ve edit alanı bu değerle dolmalıdır.
- Gerçekleşen davranış: Kartta vade tarihi gösterilmedi; düzenleme formunun tarih alanı boş geldi.
- Veri etkisi: Hakediş gecikme ve bildirim mantığı çalışamaz; planlanan nakit akışı yanlış olur.
- Kanıt: `QA DEMO 20260806-C - Devlet 30-30-30-10 Hakedişi`, ₺300.000.
- Önerilen kök neden araştırma alanı: `due_date` create/read/update sözleşmesi, kolon varlığı/migration ve frontend hydration.

### AKINAL-QA-C-003 — Form doğrulama önceliği alan sırasıyla uyumsuz

- Önem seviyesi: Düşük
- Etkilenen ekran: Yeni Müşteri
- Tekrar adımları: Tüm alanlar boşken Kaydet'e bas.
- Beklenen davranış: İlk zorunlu alan `Ad Soyad`/`Firma Resmi Ünvanı` için açıklayıcı uyarı ve alan odağı.
- Gerçekleşen davranış: İlk uyarı telefon biçimi için gösterildi.
- Veri etkisi: Veri kaybı yok; kullanıcı deneyimi ve erişilebilir hata sırası zayıf.
- Kanıt: Boş bireysel formda `Telefon 0XXXXXXXXXX biçiminde...` bildirimi.
- Önerilen kök neden araştırma alanı: Frontend validation sırası ve ilk invalid alana odak yönetimi.

### AKINAL-QA-C-004 — Cloud browser bağlantısı silme ve kapanış testini engelledi

- Önem seviyesi: Orta (test altyapısı)
- Durum: **RESOLVED — devam oturumunda test tamamlandı**
- Etkilenen ekran: Masraf Kartı Finans ve testin kalan modülleri
- Tekrar adımları: `QA DEMO 20260806-C DELETE TEST - Masraf Kartı Gideri` satırındaki çöp kutusu butonuna bas.
- Beklenen davranış: Onay modalı açılmalı; iptal ve onay akışları yürütülmelidir.
- Gerçekleşen davranış: Cloud browser CDP bağlantısı tekrarlayan 20 saniyelik `refresh tabs` zaman aşımına girdi.
- Veri etkisi: Uygulama verisine dair hata değildir. Devam oturumunda silme, finans kapanışı ve sistem modülleri yeniden çalıştırıldı.
- Kanıt: Tekrarlayan tarayıcı kurtarma ve zaman aşımı çıktıları.
- Önerilen kök neden araştırma alanı: Cloud browser servis sağlığı. Uygulama tarafında silme işleminin kendisine ilişkin yeni hata üretilmedi.

### AKINAL-QA-C-005 — Personel rol, maliyet, proje ataması ve tahsisat kayıt servisleri çalışmıyor

- Önem seviyesi: Yüksek
- Etkilenen ekran/API: Personel Detay > Roller, Maliyet Dönemleri, Proje Atamaları; Personel Tahsisat; ilgili employee-personnel API uçları
- Tekrar adımları:
  1. `QA DEMO 20260806-C - Hasan Kalıp Ustası` detayına gir.
  2. `Rol Ekle` penceresini aç; rol seçicisini aç.
  3. Maliyet Dönemleri > Yeni Dönem'de 01.08.2026, ₺40.000 maaş, ₺6.000 SGK, ₺4.000 yemek ve ₺2.000 ulaşım girip kaydet.
  4. Proje Atamaları > Atama Ekle'de C demo projesini seçip kaydet.
  5. Tahsisat ekranında Ağustos 2026 için 22/22 gün girip kaydet.
- Beklenen davranış: Rol seçilebilir; maliyet dönemi, proje ataması ve tahsisat kaydolur; yenileme sonrası korunur ve ilgili finans ekranına yalnızca bir kez yansır.
- Gerçekleşen davranış: Rol listesi boştur. Maliyet dönemi `oluşturulamadı`, proje ataması `tamamlanamadı`, tahsisat `oluşturulamadı` mesajıyla reddedilir. Maliyet tarih alanı da 01.08.2026 yerine 06.08.2026'ya döner.
- Veri etkisi: Personel maliyetleri projelere dağıtılamaz; personel kaynaklı gider ve kârlılık hesapları eksik kalır. Başarısız denemeler finans toplamlarını değiştirmemiştir.
- Kanıt: Hasan personel ID `24ccbb82-7734-4833-84cf-34b98d7a9ad3`; üç ayrı create denemesinde görünür hata mesajları; Bakım Konsolu'nda beş bağımlı tabloyu oluşturan production migration aksiyonu.
- Önerilen kök neden araştırma alanı: Öncelikle `employee-personnel-tables-apply.php` migration'ının production'da uygulanma durumu ve beş tablonun varlığı doğrulanmalı. Bu, ekrandaki bakım aksiyonu ve tüm bağımlı create işlemlerinin aynı anda başarısız olmasına dayanan güçlü bir çıkarımdır; kesin kök neden sunucu logu/DB şemasıyla teyit edilmelidir. Migration sonrası rol seed verisi ve create API hata gövdeleri ayrıca incelenmelidir.

## 8. Silme testlerinin sonuçları

| Senaryo | Sonuç | Kanıt |
|---|---|---|
| Ayrı DELETE TEST gideri oluşturma | PASS | ₺10.000 planlanan ve ödenen kayıt ekstrede göründü |
| Sil butonunun varlığı | PASS | Satırda pencil ve trash2 kontrolleri bulundu |
| Onay modalı | PASS | Kullanıcı yalnızca C DELETE TEST giderinin silinmesini açıkça onayladı |
| İptal ile koruma | NOT TESTED | Ayrı bir DELETE TEST kaydında iptal adımı uygulanmadı |
| Onayla silme | PASS | DELETE TEST satırı ekstrede artık yok |
| Yenileme sonrası kaybolma | PASS | Ekstre yenilendi; kayıt geri gelmedi |
| Finans toplamlarından düşme | PASS | Kart 100/50/50, Gidenler 800/450/350, Proje Finans ve Net Durum beklenen değere döndü |

## 9. Demo proje finansal mutabakat tablosu

Silme testi gideri dışlanarak, oluşturulan kalıcı QA veri setinin beklenen mühendislik hesabı:

| Kalem | Beklenen |
|---|---:|
| Planlanan müşteri geliri | ₺1.400.000 |
| Gerçekleşen müşteri geliri | ₺620.000 |
| Planlanan devlet hakedişi | ₺300.000 |
| Gerçekleşen devlet hakedişi | ₺90.000 |
| Toplam planlanan gelir | ₺1.700.000 |
| Toplam gerçekleşen gelir | ₺710.000 |
| Kalan alacak | ₺990.000 |
| Planlanan gider | ₺800.000 |
| Gerçekleşen gider | ₺450.000 |
| Kalan gider | ₺350.000 |
| Gerçekleşen net kâr/zarar | **₺260.000 kâr** |

Notlar:

- EUR müşteri geliri: 5.000 EUR × ₺50 = ₺250.000 planlanan; 2.000 EUR × ₺50 = ₺100.000 gerçekleşen.
- Silme öncesi geçici ekran değeri planlanan ₺810.000, gerçekleşen ₺460.000, kalan ₺350.000 ve net ₺250.000 idi; silme sonrası beklenen ₺800.000/₺450.000/₺350.000 ve ₺260.000 net değerleri geri geldi.
- Tarih hatası nedeniyle bu hesap yalnızca kayıt tutarlarına dayanır; tarih kesimi uygulanmış mutabakat kabul edilemez.

## 10. Genel ekranlar arası finansal mutabakat tablosu

| Ekran | Aynı proje kapsamı | Sonuç | Açıklama |
|---|---|---|---|
| Müşteri Finans — bireysel | Evet | PASS | Planlanan ₺1.150.000, ödenen ₺520.000, kalan ₺630.000 |
| Müşteri Finans — kurumsal | Evet | PASS | Planlanan ₺250.000, ödenen ₺100.000, kalan ₺150.000 |
| Devlet Hakedişleri | Evet | PASS (tutar) | Planlanan ₺300.000, tahsil ₺90.000, kalan ₺210.000 |
| Tedarikçi Finans — resmî | Evet | PASS | Planlanan ₺550.000, ödenen ₺400.000, kalan ₺150.000 |
| Tedarikçi Finans — gayri resmî | Evet | PASS | Planlanan ₺150.000, ödenen ₺0, kalan ₺150.000 |
| Masraf Kartı Finans | Evet | PASS | Silme ve yenileme sonrası ₺100.000/₺50.000/₺50.000 |
| Proje Finans | Evet | PASS (tutar) | Gelir ₺1.700.000/₺710.000/₺990.000; gider ₺800.000/₺450.000; kâr ₺260.000 |
| Gelenler | Evet | PASS (tutar) | Proje filtresi ₺1.700.000 planlanan, ₺710.000 tahsil, ₺990.000 kalan |
| Gidenler | Evet | PASS | Proje filtresi ₺800.000 planlanan, ₺450.000 ödenen, ₺350.000 kalan |
| Net Durum | C öneki filtresi | PASS | Filtreli gelir ₺710.000, gider ₺450.000, net ₺260.000 |
| Genel Bakış | Global | PASS (tutar) | Başlangıca göre +₺710.000 gelir, +₺450.000 gider, +₺260.000 net |

## 11. Gerçek kayıt bütünlüğü kontrolü

- Hiçbir başlangıç projesi, müşteri, tahsilat, hakediş, tedarikçi, gider, personel veya masraf kartı düzenlenmedi ya da silinmedi.
- Tüm mutasyonlar `QA DEMO 20260806-C` önekli yeni kayıtlarda yapıldı.
- Silinen tek kayıt, kullanıcının açıkça onayladığı `QA DEMO 20260806-C DELETE TEST - Masraf Kartı Gideri` oldu.
- Proje yayınlama, ayar, migration ve yedekleme aksiyonları uygulanmadı.
- Başlangıç ve kapanış KPI karşılaştırması tamamlandı; fark yalnızca C demo veri setinin beklenen gerçekleşen tutarlarıyla açıklanmaktadır.

## 12. Teslim kararı

**BLOCKED**

Kritik tarih veri bütünlüğü hatası canlı sistemde tekrar üretildi. Ayrıca devlet hakedişi vade tarihi kaybolmaktadır. Bu iki hata; gecikme, bildirim, tarih kesimli finans raporlama ve teslim kabulünü doğrudan etkiler. Tutar bazlı ekranlar arası finansal mutabakat başarılıdır; ancak personel rol/maliyet/proje ataması/tahsisat servislerinin canlıda çalışmaması yüksek önem seviyeli ikinci bir teslim engelidir.

## 13. Yeniden test edilmesi gereken maddeler

1. Gelir, gider ve hakediş tahsilatı create/edit/reload tarih kalıcılığı.
2. Devlet hakedişi `due_date` create/read/update ve bildirim davranışı.
3. Personel tabloları production migration durumu; ardından rol seçimi, maliyet dönemi, proje ataması ve tahsisat create/read/reload.
4. Personel maliyetinin Gidenler, Proje Finans ve Net Durum ekranlarına yalnızca bir kez yansıması.
5. Silme modalında `İptal` seçildiğinde kaydın korunması için ayrı DELETE TEST kaydı.
6. Müşteri ve tedarikçi arama/filtre/dışa aktarma.
7. Proje dışa aktarma; kapsam, dosya adı, içerik ve kullanıcı geri bildirimi.
8. Enflasyon hesaplama taban tarihi kalıcılığı ve aralık validasyonu.
9. Bildirim arama/tür/öncelik/okunmamış filtreleri ve güvenli tekil okundu akışı.
10. Ayarlar kaydetme, medya yükleme ve manuel yedekleme yalnızca ayrı, açık production değişikliği onayıyla.
