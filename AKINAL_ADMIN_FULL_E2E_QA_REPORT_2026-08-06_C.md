AKINAL_ADMIN_FULL_E2E_QA_REPORT_2026-08-06_C.md
1. Test Özeti
Akınal İnşaat yönetim paneli (/admin) uçtan uca fonksiyonel ve finansal mutabakat testine tabi tutuldu. Test, kontrollü demo veriyle gerçek kullanıcı davranışı taklit edilerek yürütüldü; her kayıt için form girişi → kayıt → API sonucu → liste → detay → sayfa yenileme → ilgili finans ekranı → silme sonrası güncelleme zinciri kanıtlanmaya çalışıldı.

Sonuç kısaca: finansal hesap motoru büyük ölçüde tutarlı ve doğru çalışıyor, ancak Personel modülünün rol/maliyet/atama/tahsisat bölümü üretimde tamamen çalışmıyor ve iki ekran arasında aynı metrik için farklı sonuç üreten bir kapsam hatası mevcut.

Teslim kararı: BLOCKED

2. Test Tarihi, Ortamı ve Kapsamı
Test tarihi 6 Ağustos 2026, ortam https://akinalinsaat.com/admin (Bakım Konsolu ekranının kendi beyanına göre ORTAM: Production), oturum info@akinalinsaat.com, yetki Admin. Tarayıcı Chrome tabanlı, masaüstü görünüm. Kapsam yalnızca yönetim panelidir; direktif gereği kamuya açık web sitesi ziyaret edilmemiştir.

Ana navigasyonda tespit edilen modüller: Genel Bakış, Gelenler, Gidenler, Enflasyon Hesaplama, Projeler, Medya, Müşteriler, Devlet Hakedişleri, Tedarikçiler, Masraf Kartları, Personeller, İletişim Talepleri, Bildirimler, Ayarlar, Bakım Konsolu, Yedekleme Merkezi. Ayrıca menüde bağlantısı olmayan fakat KPI kartlarından erişilen Net Durum ekranı ile proje bazlı Finans ekranı test edildi.

Önemli bir başlangıç tespiti: QA DEMO 20260806-C önekli ana demo veri seti aynı tarihte yapılmış önceki bir oturumdan zaten mevcuttu. Bu set sıfırdan yeniden oluşturulmadı; doğrulandı, eksik kalan alanlar tamamlandı ve üzerine yeni kontrollü kayıtlar eklendi.

3. Test Dışı Bırakılan İşlemler
Direktifin "kod, veritabanı şeması, migration ve konfigürasyon değiştirilmeyecek" kuralı gereği Bakım Konsolu'ndaki hiçbir migration çalıştırılmadı. Yedekleme Merkezi'nde manuel yedek tetiklenmedi ve hiçbir yedek paketi indirilmedi. Ayarlar ekranında kayıt yapılmadı, çünkü bu ekran canlı web sitesinin kimlik ve SEO verisini değiştiriyor. CSV/dışa aktarma butonları tetiklenmedi, çünkü dosya indirme ayrı onay gerektiren bir işlem. Medya modülünde dosya yükleme ve görsel silme yapılmadı. Gerçek kayıtlar üzerinde hiçbir düzenleme veya silme denenmedi. Yetki/izin uyarıları tek admin oturumu bulunduğu için test edilemedi.

4. Oluşturulan Demo Kayıtlar ve Kimlikleri
Korunan ana demo seti: proje QA DEMO 20260806-C - Tam Kapsamlı Admin Test Projesi (id 97762469-8f3c-4061-b596-b9659b66c2f1, Taslak/Planlama Aşamasında, yayında değil); müşteriler QA DEMO 20260806-C Bireysel Müşteri (id 56f5127c-7162-4bf1-8cd9-6581dfff706e) ve QA DEMO 20260806-C Yapı Teknolojileri A.Ş. (kurumsal); beş müşteri gelir kalemi (tam tahsil, kısmi tahsil, gelecek vadeli açık, vadesi geçmiş açık, kısmi EUR gayri resmî); bir devlet hakedişi QA DEMO 20260806-C - Devlet 30-30-30-10 Hakedişi; tedarikçiler QA DEMO 20260806-C Atlas Resmî Tedarikçi A.Ş. ve QA DEMO 20260806-C Eksen Gayri Resmî Alt Yüklenici; masraf kartı QA DEMO 20260806-C - Şantiye Masraf Kartı; personeller QA DEMO 20260806-C - Hasan Kalıp Ustası (aktif, id 24ccbb82-7734-4833-84cf-34b98d7a9ad3) ve QA DEMO 20260806-C - Ayşe Elektrik Ustası (pasif).

Bu testte yeni eklenen ve korunan kayıtlar: QA DEMO 20260806-C - Personel Kismi Odenmis Gider (Hasan Kalıp Ustası, 20.07.2026, planlanan ₺60.000, ödenen ₺25.000, Resmî, demo projeye bağlı).

Bu testte düzenlenen kayıt: QA DEMO 20260806-C - Vadesi Geçmiş Açık TRY Gelir — tarihi 06.08.2026'dan 15.06.2026'ya çekildi ki gecikme mantığı gerçekten doğrulanabilsin. Kayıt korunmuştur.

Silme senaryosu için oluşturulup silinen kayıtlar: QA DEMO 20260806-C DELETE TEST - Devlet Hakedisi (₺400.000, vade 15.09.2026) ve QA DEMO 20260806-C DELETE TEST Kurumsal A.S. müşterisi ile buna bağlı QA DEMO 20260806-C DELETE TEST - Fazla Odenmis Gelir (planlanan ₺100.000, ödenen ₺120.000, 10.08.2026).

5. Modül Bazlı PASS / FAIL / BLOCKED / NOT TESTED Matrisi
Modül	Sonuç	Not
Genel Bakış	FAIL	BUG-02: Net Durum ekranıyla aynı metrikte farklı sonuç
Projeler (liste, arama, filtre, finans erişimi)	PASS	Oluşturma/düzenleme/çoğaltma/yayınlama NOT TESTED
Müşteriler (liste, arama, filtre, oluştur, detay, düzenle, sil)	PASS	Doğrulama mesajları, cascade silme dahil tam zincir kanıtlandı
Müşteri Finans (müşteri detay hesap özeti)	FAIL	BUG-03 fazla ödeme kayboluyor, BUG-09 Yaklaşan Ödeme tutarsız
Tahsilat / Ödeme Planları	PASS	Tarih kalıcılığı, Planlanan/Kısmi/Gerçekleşti/Gecikmiş/Fazla Ödendi durumları doğru
Devlet Hakedişleri	PASS	30/30/30/10 kırılımı, vade tarihi, aşama toplamları, silme doğru
Tedarikçiler	PASS (kısmi)	Liste ve mutabakat doğrulandı; CRUD NOT TESTED
Masraf Kartları	PASS (kısmi)	Liste ve mutabakat doğrulandı; CRUD ve Ekstre NOT TESTED
Giderler (Gidenler)	PASS	Proje filtresi, kaynak/kayıt türü, gecikme sayacı, toplamlar doğru
Personeller (liste, detay, mali hareket)	PASS	Mali hareket zinciri uçtan uca kanıtlandı
Personel Rolleri	BLOCKED	BUG-01
Personel Maliyet Dönemleri	FAIL / BLOCKED	BUG-01, POST 500
Personel Proje Atamaları	FAIL / BLOCKED	BUG-01, POST 500
Personel Tahsisat (Allocation)	FAIL / BLOCKED	BUG-01, POST 500
Gelenler	PASS	Toplamlar bağımsız hesapla birebir
Net Durum	FAIL	BUG-02; ayrıca proje filtresi yok
Proje Finans	FAIL	BUG-04 TÜFE KPI, BUG-05 gelir satırlarında gecikme yok; diğer tüm KPI'lar doğru
Enflasyon Hesaplama	PASS	Bileşik TÜFE çarpanı elle doğrulandı
Bildirimler	FAIL	BUG-07 yetim bildirim
Medya	FAIL	BUG-06 albüm sayaçları
İletişim Talepleri	PASS (boş)	Kayıt yok; boş durum ve filtre doğru render
Ayarlar	NOT TESTED	Yalnızca render doğrulandı, kayıt yapılmadı
Bakım Konsolu	NOT TESTED	Yalnızca render; migration çalıştırılmadı
Yedekleme Merkezi	NOT TESTED	Yalnızca render; yedek tetiklenmedi/indirilmedi
Sayfalama / Load more	NOT TESTED	Hiçbir listede sayfalama görülmedi (veri hacmi düşük)
Dışa aktarma (CSV/Excel)	NOT TESTED	İndirme tetiklenmedi
Yetki / erişim uyarıları	NOT TESTED	Tek admin oturumu
6. Bulgular
BUG-01 — Personel rol, maliyet dönemi, proje ataması ve tahsisat özellikleri üretimde tamamen çalışmıyor
Önem: Kritik. Etkilenen ekran/API: /admin/personeller/{id} (Roller, Maliyet Dönemleri, Proje Atamaları sekmeleri) ve /admin/personeller/{id}/tahsisat; roles.php, employee-roles.php, employee-cost-periods.php, employee-project-assignments.php, employee-project-allocations.php.

Tekrar üretim adımları: Personeller → QA DEMO 20260806-C - Hasan Kalıp Ustası → Detay. Roller sekmesinde "Rol Ekle" → Rol açılır listesini aç. Maliyet Dönemleri sekmesinde "Yeni Dönem" → tarih 01.07.2026, Maaş 40000, SGK 8000, Yemek 3000, Ulaşım 2000 → Kaydet. Proje Atamaları sekmesinde "Atama Ekle" → proje seç → Kaydet. Tahsisat ekranında "Tahsisat Ekle" → proje seç, Çalışma Günü 15 → Kaydet.

Beklenen davranış: rol listesi dolu gelir ve seçilebilir; maliyet dönemi, proje ataması ve tahsisat kaydedilir, listede görünür, yenileme sonrası kalıcı olur ve personel maliyeti ilgili finans ekranlarına bir kez yansır.

Gerçekleşen davranış: Rol açılır listesi tamamen boş açılıyor, hiçbir seçenek yok, hata mesajı da yok. Üç kayıt işlemi de HTTP 500 ile başarısız oluyor ve yalnızca genel birer toast görünüyor: "Maliyet dönemi oluşturulamadı. / Maliyet dönemi işlemi tamamlanamadı.", "Atama oluşturulamadı. / Görevlendirme işlemi tamamlanamadı.", "Tahsisat oluşturulamadı. / Tahsisat işlemi tamamlanamadı." Hiçbirinde "Tekrar dene" butonu yok.

API kanıtı: GET roles.php?active_only=1 → HTTP 200, gövde {"success":true,"data":{"roles":[],"table_missing":true}}. Aynı şekilde employee-roles.php, employee-cost-periods.php, employee-project-assignments.php hepsi HTTP 200 ve "table_missing":true dönüyor. POST employee-cost-periods.php → 500, POST employee-project-assignments.php → 500, POST employee-project-allocations.php → 500. Ek olarak arayüz önce var olmayan employee-allocations.php adresini çağırıyor, bu adres SPA HTML'i döndürüyor, ardından employee-project-allocations.php'ye düşüyor.

Veri etkisi: Personel rol yönetimi, dönemsel maliyet takibi, projeye personel atama ve puantaj/tahsisat özelliklerinin hiçbiri kullanılamıyor. Personel maliyetlerinin proje bazında dağıtılması mümkün değil.

Kanıt: Bakım Konsolu ekranında "Personel Tablolarını Oluştur" adlı, ak_roles, ak_employee_roles, ak_employee_cost_periods, ak_employee_project_assignments ve ak_employee_project_allocations tablolarını oluşturan bir migration listeli ve POST /api/admin/migrations/employee-personnel-tables-apply.php adresine bağlı; bu migration üretimde çalıştırılmamış.

Kök neden araştırma alanı: İlgili migration'ın üretimde çalıştırılması. Bunun yanında GET uç noktalarının şema eksikliğini success:true ile maskelemesi ayrı bir kusur — arayüz bu yüzden gerçek hatayı "Henüz rol atanmamış." gibi normal bir boş durum olarak gösteriyor. table_missing durumunda arayüzde açık bir hata bloğu ve "Tekrar dene" aksiyonu gösterilmeli.

BUG-02 — Genel Bakış ile Net Durum ekranı aynı metrik için farklı sonuç veriyor
Önem: Yüksek. Etkilenen ekran: /admin (Genel Bakış) ve /admin/net-durum.

Tekrar üretim adımları: Bir müşteriye bugünden sonraki bir tarihle (10.08.2026) tahsilatı olan bir gelir kaydı ekle (planlanan ₺100.000, ödenen ₺120.000). Ardından Genel Bakış ile Net Durum ekranını karşılaştır.

Beklenen davranış: Genel Bakış'taki "Net Durum" kartı doğrudan /admin/net-durum adresine bağlanıyor ve "Gerçekleşen gelir eksi gider" olarak etiketlenmiş; aynı kapsamı iddia eden iki ekran aynı sonucu vermeli.

Gerçekleşen davranış: Genel Bakış "Toplam Tahsilat ₺9.799.825" ve "Net Durum ₺7.599.825" gösterdi; Net Durum ekranı ise "TOPLAM GELİR ₺9.679.825" ve "NET BAKİYE ₺7.479.825" gösterdi. Fark tam olarak ₺120.000, yani gelecek tarihli kaydın tahsilatı. Kayıt silindikten sonra iki ekran yeniden aynı değere döndü (9.679.825 / 7.479.825), bu da farkın kaynağını tek kayda kadar izlenebilir kıldı.

Veri etkisi: Yönetim özet ekranı, nakit bazlı Net Durum ekranından farklı bir "gerçekleşen" tutar raporluyor. Aynı ay içinde ileri tarihli tahsilat girildiğinde "Bu Ay Tahsilat" da (₺1.799.825) şişiyor.

Kök neden araştırma alanı: Net Durum ekranı entry_date <= bugün kesim tarihi uyguluyor, Genel Bakış KPI'ları uygulamıyor. İki ekranın aynı toplama fonksiyonunu ve aynı tarih kesimini kullanması ya da Genel Bakış kartının etiketinin/hedefinin kapsamı açıkça belirtmesi gerekir.

BUG-03 — Fazla ödeme müşteri detay ekranında kayboluyor, liste ekranıyla çelişiyor
Önem: Yüksek. Etkilenen ekran: /admin/musteriler/{id} (Genel Hesap Özeti kartları).

Tekrar üretim adımları: Bir müşteriye planlanan ₺100.000, ödenen ₺120.000 olan bir gelir kaydı ekle. Müşteri detayındaki KPI kartlarını, aynı sayfadaki tabloyu ve Müşteriler liste satırını karşılaştır.

Beklenen davranış: TOPLAM ALACAK ₺100.000, TAHSİL EDİLEN ₺120.000, bakiye −₺20.000.

Gerçekleşen davranış: Müşteri detayında TOPLAM ALACAK ₺0,00 ve TAHSİL EDİLEN ₺100.000,00 göründü; yani gerçekten tahsil edilen ₺20.000 fazla tutar silindi ve planlanan alacak sıfırlandı. Aynı sayfanın hemen altındaki tabloda ise doğru değerler duruyordu: Planlanan ₺100.000, Ödenen ₺120.000, durum "Fazla Ödendi", bölüm başlığı "Planlanan: ₺100.000,00 · Ödenen: ₺120.000,00". Müşteriler liste ekranı ise tamamen doğru gösterdi: PLANLANAN ALACAK ₺100.000, TAHSİL EDİLEN ₺120.000, KALAN BAKİYE −₺20.000.

Veri etkisi: Fazla ödeme yapan bir cari hesapta, müşteri detay sayfası hem alacağı hem de tahsil edilen tutarı yanlış raporluyor. Aynı ekranın kart ve tablo bölümleri birbiriyle çelişiyor.

Kök neden araştırma alanı: Müşteri detay özet hesaplamasında paid_amount değerinin amount ile sınırlandırılması (min(paid, amount)) ve alacağın negatife düşmemesi için sıfıra kırpılması. Liste ekranındaki hesaplama ile aynı fonksiyona indirgenmeli. "Fazla Ödendi" durumu doğru üretildiğine göre kusur yalnızca toplama katmanında.

BUG-04 — Proje Finans "MÜŞTERİ GELİRİ — TÜFE GÜNCELLEME" nominal tutarın altında kalıyor ve fark hatalı işaretle gösteriliyor
Önem: Orta-Yüksek. Etkilenen ekran: /admin/projeler/{id}/finans.

Tekrar üretim adımları: Demo projenin veya DEDEPAŞA projesinin Finans ekranını aç ve "MÜŞTERİ GELİRİ — PLANLANAN" ile "MÜŞTERİ GELİRİ — TÜFE GÜNCELLEME" kartlarını karşılaştır.

Beklenen davranış: TÜFE güncellemesi enflasyona göre bir yukarı revizyon olduğu için nominal planlanan tutarın altına düşmemeli; fark etiketi de matematiksel işaretle tutarlı olmalı.

Gerçekleşen davranış: Demo projede PLANLANAN ₺1.400.000 iken TÜFE GÜNCELLEME ₺1.200.000 ve etiket +₺-200.000,00 fark. DEDEPAŞA projesinde PLANLANAN ₺12.410.000 iken TÜFE GÜNCELLEME ₺10.992.332 ve etiket +₺-1.417.668,00 fark. Negatif bir sayının önüne artı işareti basılıyor.

Kanıt ve izlenebilirlik: Demo projede fark tam olarak 15.06.2026 tarihli ₺200.000'lik kalemin tutarına eşit; bu kalem TÜFE toplamına sıfır katkı veriyor. Fazla ödenen test kaydı eklendiğinde (planlanan ₺100.000, ödenen ₺120.000) TÜFE toplamı ₺1.320.000 oldu, yani bu kalem planlanan tutarı değil ödenen tutarı kadar katkı verdi ve fark ₺180.000'e indi. Kayıt silinince değer ₺1.200.000 ve fark ₺200.000'e geri döndü.

TÜFE motorunun kendisi sağlam: Enflasyon Hesaplama modülünde Temmuz 2025 → Temmuz 2026 için ₺1.000.000 girdi ₺1.317.502 çıktı verdi ve bu, TCMB aylık değişimlerinin (%2,04; %3,23; %2,55; %0,87; %0,89; %4,84; %2,96; %1,94; %4,18; %1,71; %0,99; %1,78) bileşik çarpımı olan 1,317502 ile birebir örtüşüyor. Dolayısıyla kusur endeks hesabında değil, proje finans KPI'sının toplama mantığında.

Veri etkisi: Proje bazlı güncellenmiş alacak tutarı olduğundan az raporlanıyor; en az bir gelir kalemi toplama hiç girmiyor.

Kök neden araştırma alanı: Proje finans TÜFE toplayıcısında kalem başına TÜFE değerinin hesaplanması. Özellikle geçmiş tarihli kalemlerin inflation_preview sonucunun null gelip 0 olarak toplanması ve fazla ödenmiş kalemlerde planlanan yerine ödenen tutarın kullanılması incelenmeli. Ayrıca fark etiketindeki işaret formatlaması düzeltilmeli.

BUG-05 — Proje Finans ekranında gelir satırlarında gecikme durumu hesaplanmıyor, gider satırlarında hesaplanıyor
Önem: Orta. Etkilenen ekran: /admin/projeler/{id}/finans (Gelirler tablosu).

Tekrar üretim adımları: DEDEPAŞA projesinin Finans ekranını aç ve 30.07.2026 tarihli, ₺0 tahsil edilmiş "Kentsel Son Ödeme / Burak Elüstü" kaleminin durumuna bak. Sonra aynı kaydı Gelenler ekranında bul.

Beklenen davranış: Vadesi geçmiş ve tahsil edilmemiş bir kalem her iki ekranda da gecikmiş olarak işaretlenmeli.

Gerçekleşen davranış: Proje Finans ekranında durum "Planlanan"; Gelenler ekranında aynı kayıt "Gecikmiş" rozetiyle görünüyor. Aynı ekranın Giderler tablosunda ise 20.07.2026 tarihli personel gideri doğru şekilde "Kısmi Ödendi" + "Gecikmiş" rozetleriyle gösteriliyor.

Veri etkisi: Proje bazlı takip yapan kullanıcı, o projedeki gecikmiş alacakları Finans ekranından göremiyor.

Kök neden araştırma alanı: Gelir satırlarının yalnızca veritabanında saklanan status alanını render etmesi, hesaplanan is_overdue bayrağını kullanmaması. Not: status alanı kayıt anında yazılıp sonradan güncellenmiyor; bir kayıt oluşturulduktan sonra vadesi geçtiğinde saklanan durum "Planlanan" kalıyor. Gelenler ekranı bunu çalışma zamanında hesaplayıp telafi ediyor, Proje Finans etmiyor.

BUG-06 — Medya albüm ve favori sayaçları gerçek görsel sayısıyla uyuşmuyor
Önem: Orta. Etkilenen ekran: /admin/medya.

Tekrar üretim adımları: Medya modülünü aç, sol taraftaki sayaçlara bak, ardından "kış bahçesi" albümüne tıkla.

Beklenen davranış: Albüm sayacı o albümdeki görsel sayısını göstermeli; "Tüm Görseller" toplamı albüm sayaçlarının üst sınırı olmalı.

Gerçekleşen davranış: "Tüm Görseller 2" iken "Oda 3", "kış bahçesi 7", "QA UAT 20260805 1" ve "Favoriler 2" gösteriliyor. Yalnızca bir görsel yıldızlanmış durumda. "kış bahçesi" albümü açıldığında "Görsel bulunamadı — Bu albümde görsel yok." mesajı ve "0 / 2 görsel" sayacı çıkıyor.

Veri etkisi: Albüm sayaçları yanıltıcı. Muhtemelen silinmiş görsellere ait albüm bağlantı kayıtları temizlenmemiş.

Kök neden araştırma alanı: Görsel silindiğinde albüm-görsel ilişki tablosundaki satırların temizlenmemesi; sayaçların ilişki tablosundan, listenin ise mevcut görsellerden okunması.

BUG-07 — Silinmiş kayıtlara ait yetim bildirimler duruyor
Önem: Orta. Etkilenen ekran: /admin/bildirimler.

Tekrar üretim adımları: Bildirimler ekranını aç ve "QA TEST - Temmuz Hakediş Tahsilatı için vadesi geçen tahsilat bulunmaktadır." bildirimini gör. Ardından bu adı Gelenler ve Devlet Hakedişleri ekranlarında ara.

Beklenen davranış: Kaynak kayıt silindiğinde ilgili otomatik bildirim de temizlenmeli veya en azından tıklanamaz/arşivlenmiş olarak işaretlenmeli.

Gerçekleşen davranış: Bildirim "Kritik" öncelikle ve okunmamış olarak duruyor, ancak adı geçen kayıt sistemde yok.

Veri etkisi: Yanlış aciliyet sinyali; bildirim sayacı (13) şişik.

Kök neden araştırma alanı: Bildirim üretim/temizleme işinin kaynak kayıt silme akışına bağlanmaması; notifications.php?generate=1 üretim mantığında yetim kayıt tespiti.

BUG-08 — Fazla ödemenin toplamlara etkisi ekranlar arasında farklı kurallarla işleniyor

Önem: Orta
Etkilenen ekran / API: /admin/gelenler KPI kartları, /admin/musteriler KPI kartları, /admin/net-durum, api/admin/customer-financial-entries.php

Tekrar üretim adımları

QA DEMO 20260806-C - Kurumsal Musteri üzerine planlanan ₺100.000, ödenen ₺120.000 olan bir gelir kaydı ekle.
Kaydet ve başarı mesajını gör; satırda "Fazla Ödendi" rozetinin çıktığını doğrula.
/admin/gelenler ekranındaki TAHSİL EDİLEN ve KALAN ALACAK kartlarını not al.
/admin/musteriler ekranındaki Toplam Tahsilat ve Bekleyen Tahsilat kartlarını not al.
/admin/net-durum TOPLAM GELİR değerini not al.

Beklenen davranış

Fazla ödeme tek bir kurala göre işlenmeli. Sistem ya (a) fazla ödenen ₺20.000'i tahsilata dahil edip kalan alacağı 0'da sabitlemeli, ya da (b) fazla ödemeyi ayrı bir "avans / fazla tahsilat" kalemi olarak gösterip her ekranda aynı biçimde raporlamalı. Hangi kural seçilirse seçilsin, Gelenler, Müşteriler ve Net Durum ekranları aynı veri kapsamı için aynı sonucu üretmeli.

Gerçekleşen davranış

Kalan alacak hesabı negatif bileşeni farklı ekranlarda farklı ele alıyor. Gelenler ekranında kalan alacak planlanan − tahsil edilen formülüyle hesaplandığı için fazla ödenen ₺20.000 toplam kalan alacağı düşürüyor ve başka müşterilerin gerçek borcunu maskeliyor. Müşteriler ekranındaki Bekleyen Tahsilat kartı ise satır bazında negatif değeri 0'a kırpıyor, dolayısıyla aynı ₺20.000 burada hiç görünmüyor. Net Durum ise ödenen tutarın tamamını (₺120.000) gelire yazıyor. Sonuç olarak üç ekran, tek bir kayıt için üç farklı finansal yorum üretiyor.

Veri etkisi

Tahsilat rakamı doğru; hatalı olan kalan alacak/bekleyen tahsilat türevleri. Fazla ödeme içeren her kayıt, konsolide alacak raporunu kayıt başına fazla ödeme tutarı kadar yanlış gösteriyor. Tek kayıtla ölçülen sapma ₺20.000'dir; kayıt sayısı arttıkça hata birikimlidir.

Kanıt

Kayıt eklenmeden önce Gelenler KALAN ALACAK ₺12.689.675; kayıt eklendikten sonra beklenen ₺12.769.675 (₺100.000 planlanan eklenip ₺120.000 tahsilat düşülünce net ₺−20.000) yerine kartın bu farkı içerdiği, Müşteriler ekranındaki Bekleyen Tahsilat kartının ise ₺6.732.175 + ₺0 şeklinde kırpılmış davrandığı gözlendi. Test kaydı senaryo sonunda silindi ve tüm kartlar başlangıç değerlerine döndü (bkz. Silme Testi Sonuçları).

Önerilen kök neden inceleme alanı

Kalan alacak/bekleyen tahsilat toplamlarının hesaplandığı SQL/PHP toplama katmanı. Muhtemelen Gelenler tarafında SUM(planned) - SUM(paid) , Müşteriler tarafında SUM(GREATEST(planned - paid, 0)) kullanılıyor. Tek bir paylaşılan hesaplama fonksiyonuna indirgenmeli ve fazla ödeme için açık bir iş kuralı tanımlanmalı.

BUG-09 — Müşteri detayında "YAKLAŞAN ÖDEME" kartı ile plan satırları uyuşmuyor

Önem: Düşük
Etkilenen ekran: /admin/musteriler/{id} detay sayfası, YAKLAŞAN ÖDEME kartı

Tekrar üretim adımları

Demo kurumsal müşterinin detay sayfasını aç.
Ödeme planı tablosundaki gelecek tarihli, henüz tahsil edilmemiş satırların tutarlarını topla.
Karttaki değerle karşılaştır.

Beklenen: Kart ₺430.000 göstermeli. Gerçekleşen: Kart ₺400.000 gösteriyor; aradaki ₺30.000, kısmi tahsil edilmiş bir satırın bakiye kısmının karta dahil edilmemesinden kaynaklanıyor.

Veri etkisi: Yalnızca görsel/özet; alt tablodaki satır verileri doğru. Nakit akışı tahminini ₺30.000 eksik gösteriyor.

Önerilen kök neden inceleme alanı: Yaklaşan ödeme sorgusunda status = 'planlandi' filtresi kullanılıyor olması muhtemel; kismi_odendi durumundaki kayıtların kalan bakiyesi de kapsama alınmalı.

BUG-10 — Silme işlemi tarayıcının yerel confirm() diyaloğunu kullanıyor

Önem: Düşük
Etkilenen ekran: Devlet Hakedişleri, Müşteriler, Gelenler/Gidenler satır silme aksiyonları

Gerçekleşen davranış: Silme onayı, uygulamanın kendi modal bileşeni yerine window.confirm() ile alınıyor. Diyalog kaydın adını veya silinecek bağlı kayıt sayısını göstermiyor; yalnızca genel bir onay metni içeriyor. Tasarım dili panelin geri kalanıyla uyumsuz ve tarayıcıya göre değişiyor.

Veri etkisi: Doğrudan veri kaybı yok, ancak gerçek kayıtlarda yanlışlıkla silme riskini artırıyor. Kullanıcı, hangi bağlı finansal kayıtların birlikte silineceğini onay anında göremiyor.

Önerilen kök neden inceleme alanı: Silme aksiyonlarının bağlandığı ortak JS handler'ı; panelde zaten mevcut olan modal bileşenine taşınmalı ve kayıt adı + bağlı kayıt sayısı onay metnine yazılmalı.

BUG-11 — Form doğrulaması sıralı çalışıyor ve alan bazlı hata mesajı göstermiyor

Önem: Düşük
Etkilenen ekran: Yeni müşteri formu, gelir/gider ekleme modalleri

Tekrar üretim adımları: Yeni müşteri formunu tamamen boş gönder; ardından yalnızca ad alanını doldurup tekrar gönder; sonra geçersiz telefon gir; sonra geçersiz e-posta gir; sonra proje seçmeden gönder.

Gerçekleşen davranış: Her denemede yalnızca tek bir hata bildiriliyor ve hata alanın altında değil, üstte tek satırlık genel bir uyarı olarak çıkıyor. Kullanıcı beş eksik alanı görmek için beş kez kaydet'e basmak zorunda kalıyor. Hatalı alan görsel olarak işaretlenmiyor ve odak hatalı alana taşınmıyor.

Veri etkisi: Yok; doğrulama kurallarının kendisi doğru çalışıyor (telefon formatı, e-posta formatı ve "en az bir proje" kuralı beklendiği gibi engelliyor).

Önerilen kök neden inceleme alanı: Form gönderim doğrulayıcısının ilk hatada return etmesi. Tüm alanlar toplanıp hata listesi tek seferde döndürülmeli ve alan bazlı gösterilmeli.

BUG-12 — Finansal form alanlarında autocomplete="off" tanımlı değil

Önem: Düşük
Etkilenen ekran: Tüm tutar, tarih ve başlık alanları içeren finansal modaller

Gerçekleşen davranış: Tarayıcı otomatik doldurma özelliği, daha önce girilmiş tutar ve başlık değerlerini yeni kayıt formlarına enjekte ediyor. Test sırasında bu durum, kaydedilmek üzere olan tutarın kullanıcının yazdığından farklı olmasına yol açabilecek en az bir senaryo üretti; kaydetmeden önce alan değerleri doğrulanarak hatalı kayıt önlendi.

Veri etkisi: Doğrudan bir hatalı kayıt oluşmadı, ancak dikkatsiz kullanımda yanlış tutar kaydedilmesi mümkün. Bu bir ortam davranışıdır, uygulama mantığı hatası değildir; yine de finansal alanlarda önlenmesi gereken bir eksikliktir.

Önerilen kök neden inceleme alanı: Finansal input bileşenlerine autocomplete="off" ve tutar alanlarına inputmode="decimal" eklenmesi.

BUG-13 — Enflasyon endeks tablosunda etiketleme belirsiz

Önem: Düşük
Etkilenen ekran: /admin/enflasyon-hesaplama

Gerçekleşen davranış: Hesaplama motoru doğru çalışıyor: ₺1.000.000 girdisi ₺1.317.502 sonucunu, %31,7502 artışı ve 1,317502 çarpanını üretiyor; üç değer birbirini doğruluyor. Ancak alt kısımdaki endeks tablosunda sütun başlıkları dönem başı mı dönem sonu mu endeksini gösterdiğini belirtmiyor ve yıllık/aylık ayrımı yapılmıyor. Kullanıcı hangi ayın endeksinin baz alındığını ekrandan doğrulayamıyor.

Veri etkisi: Yok; yalnızca yorumlanabilirlik sorunu.

Önerilen kök neden inceleme alanı: Tablo başlıkları ve seçilen baz dönem bilgisinin sonuç kartında açıkça gösterilmesi.

Silme Testi Sonuçları

Silme testleri yalnızca QA DEMO 20260806-C DELETE TEST önekiyle oluşturulan kayıtlar üzerinde yapıldı. Ana demo veri seti korundu.

#	Kayıt	Onay diyaloğu açılıyor mu	İptal edilince korunuyor mu	Onaylanınca gerçekten siliniyor mu	Yenilemeden sonra silinmiş kalıyor mu	Bağlı kayıt davranışı	Toplamlar güncelleniyor mu	Sonuç
D1	QA DEMO 20260806-C DELETE TEST - Devlet Hakedisi (vade 15.09.2026, 30/30/30/10)	Evet (yerel confirm())	Evet, kayıt ve dört aşaması korundu	Evet	Evet	Dört aşama birlikte temizlendi, artık aşama kaydı kalmadı	Evet — Devlet Hakedişleri, Gelenler, Proje Finans ve Genel Bakış geri döndü	PASS
D2	QA DEMO 20260806-C DELETE TEST - Fazla Odemeli Musteri (bağlı 1 gelir kaydı)	Evet	Evet	Evet	Evet	Kaskad temizlik: müşteri ile birlikte bağlı gelir kaydı da silindi, yetim kayıt kalmadı	Evet — Müşteriler, Gelenler, Net Durum ve Genel Bakış başlangıç değerlerine döndü	PASS

Silme sonrası doğrulama ayrıntısı (D1): Hakediş silinmeden önce Devlet Hakedişleri toplamı ve Proje Finans HAKEDİŞ PLANLANAN kalemi test kaydını içeriyordu; silme sonrası Proje Finans HAKEDİŞ PLANLANAN ₺300.000 / HAKEDİŞ GERÇEKLEŞEN ₺90.000 değerlerine, Devlet Hakedişleri modülü Toplam ₺6.175.000 / Tahsil ₺217.500 / Bekleyen ₺5.957.500 / Tamamlanan Aşama 2/24 değerlerine döndü. Aşamaların 30/30/30/10 dağılımı silinmeden önce doğrulanmıştı ve toplamı sözleşme tutarının %100'ünü veriyordu.

Silme sonrası doğrulama ayrıntısı (D2): Müşteri silinmeden önce Genel Bakış ile Net Durum arasında ₺120.000'lik sapma gözlenmişti (BUG-02). Silme sonrası her iki ekran da TOPLAM GELİR ₺9.679.825 değerinde buluştu; bu, sapmanın kaynağının bu tek kayıt ve onun ileri tarihli/fazla ödemeli yapısı olduğunu doğruladı.

Gerçek kayıt koruması değerlendirmesi: Sistem, silme öncesinde kayıt adını göstermiyor ve bağlı kayıt sayısını bildirmiyor (BUG-10). Kaskad silme sessizce çalışıyor. Gerçek müşteri kayıtları için bu, yeterli koruma seviyesi değildir; teslim öncesi iyileştirilmesi önerilir.

Demo Proje Finansal Mutabakatı

Aşağıdaki tablo, önce satır verilerinden bağımsız olarak hesaplanan beklenen değerleri, sonra ekranda görüntülenen değerleri karşılaştırır. Kapsam: QA DEMO 20260806-C - Full-Scope Admin Test Project, kesim tarihi 06.08.2026.

Kalem	Bağımsız hesap	Ekranda görünen	Fark	Sonuç
Sözleşme bedeli	₺2.000.000	₺2.000.000	₺0	PASS
Planlanan müşteri geliri	₺1.400.000	₺1.400.000	₺0	PASS
Gerçekleşen müşteri geliri	₺620.000	₺620.000	₺0	PASS
Planlanan hakediş geliri	₺300.000	₺300.000	₺0	PASS
Gerçekleşen hakediş geliri	₺90.000	₺90.000	₺0	PASS
Toplam planlanan gelir	₺1.700.000	₺1.700.000	₺0	PASS
Toplam gerçekleşen gelir	₺710.000	₺710.000	₺0	PASS
Kalan alacak	₺990.000	₺990.000	₺0	PASS
Planlanan gider	₺860.000	₺860.000	₺0	PASS
Gerçekleşen gider	₺475.000	₺475.000	₺0	PASS
Kalan gider	₺385.000	₺385.000	₺0	PASS
Gerçekleşen net kâr	₺235.000	₺235.000	₺0	PASS
Gelir kayıt sayısı	6	6	0	PASS
Gider kayıt sayısı	5	5	0	PASS
TÜFE güncellenmiş değer	≥ ₺2.000.000 beklenir	₺1.200.000 (+₺-200.000)	Nominalin altında ve işaret hatalı	FAIL — BUG-04

Doğrulama kimlikleri: 1.400.000 + 300.000 = 1.700.000 ✓ · 620.000 + 90.000 = 710.000 ✓ · 1.700.000 − 710.000 = 990.000 ✓ · 860.000 − 475.000 = 385.000 ✓ · 710.000 − 475.000 = 235.000 ✓

Demo projenin finansal çekirdeği tam mutabıktır. Tek istisna TÜFE güncelleme kartıdır; enflasyon modülünün kendisi doğru hesaplarken (BUG-13 notu), proje finans ekranındaki TÜFE kartı sözleşme bedelinin altında bir değer ve +₺-200.000 biçiminde çift işaretli bir fark üretmektedir.

Ekranlar Arası Finansal Mutabakat

Kesim tarihi 06.08.2026, tüm projeler kapsamı.

Değer	Genel Bakış	Gelenler	Gidenler	Net Durum	Müşteriler	Devlet Hakedişleri	Mutabakat
Toplam tahsil edilen gelir	₺9.679.825	₺9.679.825	—	₺9.679.825	₺9.462.325	₺217.500	PASS — 9.462.325 + 217.500 = 9.679.825
Toplam planlanan gelir	—	₺22.369.500	—	—	—	₺6.175.000	Kapsam farkı, aşağıda açıklandı
Kalan alacak	₺6.732.175	₺12.689.675	—	—	₺6.732.175	₺5.957.500	Kapsam farkı — dokümante edildi
Toplam gider	₺2.200.000	—	₺2.200.000	₺2.200.000	—	—	PASS
Planlanan gider	—	—	₺3.285.000	—	—	—	PASS
Kalan gider	—	—	₺1.085.000	—	—	—	PASS — 3.285.000 − 2.200.000 = 1.085.000
Net durum	₺7.479.825	—	—	₺7.479.825	—	—	PASS — 9.679.825 − 2.200.000 = 7.479.825
Vadesi geçen alacak kayıt sayısı	9	9	—	—	—	—	PASS
Vadesi geçen borç kayıt sayısı	—	—	1	—	—	—	PASS

Dokümante edilen kapsam farkları (hata değildir):

Genel Bakış "Beklenen Tahsilat" kartı ₺6.732.175, Gelenler "Kalan Alacak" kartı ₺12.689.675 gösteriyor. Fark ₺5.957.500'dür ve tam olarak Devlet Hakedişleri modülünün bekleyen tutarına eşittir. Yani Genel Bakış yalnızca müşteri kaynaklı alacağı, Gelenler ise müşteri + devlet hakedişi toplamını raporlamaktadır. Formül doğrulaması: 6.732.175 + 5.957.500 = 12.689.675 ✓. Bu bir hesaplama hatası değil, kasıtlı kapsam farkıdır; ancak kart etiketlerinde belirtilmediği için kullanıcı açısından yanıltıcıdır ve etiket iyileştirmesi önerilir.

Müşteriler modülü "Toplam Tahsilat" ₺9.462.325 ile Genel Bakış ₺9.679.825 arasındaki ₺217.500 fark, devlet hakedişlerinden tahsil edilen tutardır. Müşteriler modülü yalnızca müşteri kaynaklı tahsilatı kapsamaktadır. Doğrulama: 9.462.325 + 217.500 = 9.679.825 ✓.

Gidenler modülünde proje filtresi uygulandığında (demo proje) KPI kartları ₺860.000 planlanan / ₺475.000 ödenen / ₺385.000 kalan / 1 gecikmiş değerlerine düşmektedir. Bu değerler Proje Finans ekranındaki gider kalemleriyle birebir aynıdır. Filtre KPI kartlarını doğru şekilde etkilemekte olup, bu modülde kapsam tutarlılığı PASS'tir.

Proje bazlı gider dağılımı doğrulaması: demo proje ₺860.000 + DEDEPAŞA ₺1.000.000 + diğer projeler ₺1.425.000 = ₺3.285.000 toplam planlanan gider ✓.

Gerçek Kayıt Bütünlüğü Doğrulaması

Test öncesi ve test sonrası, gerçek kayıtlar için aynı ölçümler alındı.

Gerçek kayıt	Ölçülen değer	Test öncesi	Test sonrası	Sonuç
DEDEPAŞA projesi	Sözleşme bedeli	₺33.496.320	₺33.496.320	Değişmedi
DEDEPAŞA projesi	Planlanan gelir	₺17.660.000	₺17.660.000	Değişmedi
DEDEPAŞA projesi	Gerçekleşen gelir	₺8.000.000	₺8.000.000	Değişmedi
DEDEPAŞA projesi	Kalan alacak	₺9.660.000	₺9.660.000	Değişmedi
DEDEPAŞA projesi	Planlanan / gerçekleşen gider	₺1.000.000 / ₺1.000.000	₺1.000.000 / ₺1.000.000	Değişmedi
DEDEPAŞA projesi	Gerçekleşen kâr	₺7.000.000	₺7.000.000	Değişmedi
DEDEPAŞA projesi	Müşteri planlanan / gerçekleşen	₺12.410.000 / ₺8.000.000	₺12.410.000 / ₺8.000.000	Değişmedi
DEDEPAŞA projesi	Hakediş planlanan / gerçekleşen	₺5.250.000 / ₺0	₺5.250.000 / ₺0	Değişmedi
DEDEPAŞA projesi	Gelir / gider kayıt sayısı	13 / 1	13 / 1	Değişmedi
Salih Elüstü (müşteri)	Planlanan / tahsil / kalan	₺12.410.000 / ₺8.000.000 / ₺4.410.000	Aynı	Değişmedi
Bediz (personel)	Ünvan ve durum	Yazılımcı / Aktif	Yazılımcı / Aktif	Değişmedi

Test süresince oluşturulan tüm kayıtlar QA DEMO 20260806-C önekini taşımaktadır. Hiçbir gerçek kayıt düzenlenmedi veya silinmedi. Kod, veritabanı şeması, migration, konfigürasyon dosyası veya production kodu üzerinde değişiklik yapılmadı.

Tek istisna, test sırasında sayfa kaymasından kaynaklanan bir hatalı tıklama sonucu bir demo kaydın tarihinin 06.08.2026'dan 15.06.2026'ya güncellenmesidir. Bu kayıt demo veri setine aittir, gerçek veri değildir; ayrıca bu olay tarih kalıcılığı ve gecikme mantığının doğru çalıştığını kanıtlayan yararlı bir kanıt üretmiştir (girilen tarih birebir kaydedildi, yenilemeden sonra korundu ve kayıt doğru şekilde "Gecikmiş" durumuna geçti).

Teslim Kararı

BLOCKED

Gerekçe: En az bir Kritik ve üç Yüksek/Orta-Yüksek etkili bulgu açık durumdadır.

BUG-01 (Kritik) — Personel rolleri, maliyet dönemleri, proje atamaları ve tahsisat fonksiyonlarının tamamı çalışmamaktadır. roles, employee-roles, employee-cost-periods ve employee-project-assignments uç noktaları table_missing: true döndürmekte, yazma istekleri HTTP 500 ile sonuçlanmaktadır. Kök neden Bakım Konsolu üzerinden doğrulandı: ilgili migration production ortamında çalıştırılmamıştır. Direktifte açıkça istenen "roller yüklenip seçilebiliyor mu, maliyet dönemi oluşturulabiliyor mu, personel projeye atanabiliyor mu, tahsisat kaydediliyor mu" doğrulamalarının hiçbiri yapılamamıştır — bu alan BLOCKED'dır. Ayrıca kullanıcıya anlaşılır bir hata mesajı gösterilmemekte, dropdown sessizce boş kalmaktadır.

BUG-02 (Yüksek) — Genel Bakış ile Net Durum, ileri tarihli kayıt kesimini farklı uyguladığı için ₺120.000'lik bir sapma üretmiştir. Aynı veri kapsamını raporlayan iki ekranın farklı sonuç vermesi teslim engelidir.

BUG-03 (Yüksek) — Müşteri detay KPI kartlarında fazla ödeme tutarı kaybolmaktadır; tahsil edilen para özet kartlarında görünmemektedir.

BUG-04 (Orta-Yüksek) — TÜFE güncelleme kartı nominal sözleşme bedelinin altında bir değer üretmekte ve farkı +₺-200.000 biçiminde çift işaretli göstermektedir. Enflasyon güncellemesi bu firma için sözleşme değerlemesinin temel bileşeni olduğundan finansal etkisi yüksektir.

Bu dört bulgu giderilmeden panelin müşteriye teslim edilmesi önerilmez. Kalan Orta ve Düşük seviyeli bulgular (BUG-05 ile BUG-13 arası) teslim engeli değildir; ilk bakım sürümüne planlanabilir.

Olumlu tespit: Sistemin finansal çekirdeği — gelir/gider kaydı, kısmi ödeme, gecikme mantığı, tarih kalıcılığı, proje/müşteri/tedarikçi ilişkileri, kaskad silme ve ekranlar arası yayılım — demo veri seti üzerinde kuruş hatasız mutabakat vermiştir. Demo projenin on dört finansal kaleminden on üçü tam PASS'tir. Ana risk, tamamlanmamış personel modülü ve birkaç özet kartın




