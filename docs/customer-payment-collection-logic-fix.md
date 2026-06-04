# Root Cause

- Ödeme planı kayıtları manuel durumla kaydedilebiliyor, bu da gerçek tahsilat olmadan "Ödendi" görünmesine yol açabiliyordu.
- Plan satırı ödemeleri bazı ekranlarda yalnızca `payment_plan_id` ile bağlı tahsilatlardan hesaplanıyordu.
- Bağsız tahsilatlar müşteri/account bakiyesini azaltırken plan satırı durumlarını ve kalan tutarları tutarlı biçimde etkilemiyordu.

# Changes Made

- Ödeme planı durumu artık gerçek tahsilat toplamına göre türetiliyor: `Ödendi`, `Kısmi Ödendi`, `Vadesi Geçti`, `Bekliyor`, `İptal`.
- Tahsilatlar aynı müşteri ve hesap türü içinde vade sırasına göre planlanan alacaklara uygulanıyor.
- Müşteri detayı özetleri `Planlanan Alacak`, `Tahsil Edilen`, `Müşteri Bakiyesi`, `Vadesi Geçen Tutar`, `Yaklaşan Ödeme` mantığıyla güncellendi.
- Resmi / Gayri Resmi hesap ayrımı korunarak plan ve tahsilat hesapları karıştırılmadı.
- Ödeme planı ve tahsilat endpointleri, ilgili müşteri/hesap plan durumlarını tahsilat değişikliklerinden sonra yeniden hesaplıyor.

# Validation

- `npm run build`
- `php -l public_html/api/admin/customers.php`
- `php -l public_html/api/admin/payment-plans.php`
- `php -l public_html/api/admin/payments.php`
