# İş Yoğunluğu — yeni görünümler / devir paketi

Hedef: `İş Yoğunluğu` sekmesindeki tek tabloyu, dört görünümlü bir ekranla değiştirmek.
Telefon ve atölye TV panosu öncelikli. Tasarım referansı: `İş Yoğunluğu.dc.html` → tur 2
(`2a` liste, `2b` özet, `2c` hafta, `2d` pano).

Hazır kod: `patch/isyogunlugu-yeni.js` (bu repoda; kopyala-yapıştır için bölümlere ayrılmış).

## Repo
- repo: `ezel-kaliphane/kalip-rota`, branch `master`
- ilgili dosyalar:
  - `ui/render-admin.js` → `renderIsYogunlugu()` (satır ~1062–1162) — **değişecek ana yer**
  - `js/tadilat.js:637` → `isYogunluguAcikMakine`, `toggleIsYogunluguDetay()` — durum burada duruyor
  - `js/operations.js` → `bekleyenSonrakiOperasyonlar()`, `presBekleyenCiftleri()` — veri kaynağı
  - `js/constants.js` → `MACHINE_LIST`, `machineLabelFor()`
  - `ui/styles.css` → tema değişkenleri ve `.chip`, `.analiz-chart-box`, `.matrix-wrap`, `.mono`
  - `js/app.js` → `render()`, `renderLiveBits()` — tam ekran pano modu buraya bağlanıyor

## Uygulama adımları
1. `patch/isyogunlugu-yeni.js` bölüm 2–8'i `ui/render-admin.js` içindeki mevcut
   `renderIsYogunlugu()` fonksiyonunun yerine koy (fonksiyonun tamamı gidiyor; Press çift
   eşleştirme detayı `iyPresDetayHtml()` içinde birebir korunuyor).
2. Bölüm 1'deki `isYogunluguGorunum`, `setIsYogunluguGorunum()`, `isYogunluguPanoMode()`
   tanımlarını `js/tadilat.js`'te `isYogunluguAcikMakine`'nin yanına ekle (aynı IIFE kapsamı
   içinde kalmalı, yoksa `onclick` ile çağrılamaz — mevcut `toggleIsYogunluguDetay` ile aynı yer).
3. Tam ekran pano için `js/app.js`:
   - `render()` içinde `if(!session){ ... }` satırından hemen sonra pano dalını ekle,
   - `renderLiveBits()` başına pano için `render(); return;` ekle (saat ve sayılar canlı kalsın).
   Kod bölüm 9'da yazılı. Atölye TV'sine verilecek adres: `.../index.html?pano=1`
   (giriş oturumu gerekiyor; tarayıcı oturumu açık bırakılır).
4. Yeni CSS **yok**. Tüm renkler mevcut değişkenlerden; açık tema kendiliğinden çalışır.

## Veri haritası
| Ekranda | Alan / fonksiyon |
| --- | --- |
| Bekleyen iş emri | `bekleyenSonrakiOperasyonlar().length` + `presBekleyenCiftleri().length` |
| Sıradaki makine | `entry.sonrakiMakine` (`"UT01 · Torna"` biçiminde; `Belirsiz` özel değer) |
| Toplam adet | `entry.adet` toplamı (Press çiftleri hariç) |
| Dolu makine sayısı | `Belirsiz` dışındaki satır sayısı |
| Detay satırı | `entry.talepNo \|\| entry.isEmriNo`, `entry.makine`, `entry.operatorName`, `entry.endTs` |
| Press satırı | `presBekleyenCiftleri()` → `{talepNo, ikisiDeHazir, zarf, elmas}` |
| Hafta ekseni | `entry.endTs` = işin kuyruğa girdiği an |

## Bilinçli kararlar / kısıtlar
- **Hafta görünümünün gün ekseni plan tarihi değil.** Veride termin/plan tarihi alanı yok;
  bu yüzden gün = iş emrinin kuyruğa girdiği gün (`endTs`). Ekranda da böyle yazıyor.
  Gerçek plan bazlı haftalık yoğunluk istenirse iş emrine bir termin alanı eklenmesi gerekir.
- Press çiftleri tarih taşımadığı için hafta görünümünde yok, liste ve panoda var.
- Yoğunluk renk eşikleri dört görünümde aynı: `≥5 danger · ≥3 accent · diğer success`.
  Değiştirilecekse tek yer: `iyRenk()`.
- Görünüm seçimi `localStorage` (`rota_iy_gorunum`) ile hatırlanıyor; panoya ayrı URL verildiği
  için pano seçimi yöneticinin telefonundaki görünümü etkilemez.
- Boşta makine sayımı `allMachines()` varsa gösteriliyor; yoksa o satır düşüyor
  (fason makine filtresi uygulanmadı — istenirse `isFasonMachine()` ile ayıklanabilir).

## Test kontrol listesi
- Sıfır bekleyen iş emri → liste görünümünde boş durum metni.
- Sadece Belirsiz olan durum → pano alt şeridi ve KPI'lar tutarlı.
- Press çifti açıkken satıra tıklama → Zarf/Elmas durum satırları eskisi gibi.
- Açık/koyu tema geçişi → tüm görünümlerde metin kontrastı.
- `?pano=1` → yalnız pano çiziliyor, saat her saniye ilerliyor, sekme çubuğu görünmüyor.
- Telefonda liste görünümü → satırlar taşmıyor, makine adı kısalmıyor.
