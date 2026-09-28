# bom-rota — Tasarım Envanteri (Ürün Ağacı)

Kapsam: **web öncelikli** (Admin/SuperAdmin masaüstü kullanımı). Operatör ekranları (B) çoğunlukla atölye/mobil kullanım — aşağıda düşük öncelikli işaretlendi, onay bekliyor.

> **2026-09-15 — Yapısal karar (Banani referansı benimsendi):** Admin kabuğu üst sekmelerden **sol
> sabit sidebar**'a geçecek (rozet sayılarıyla: Tadilat, Bildirimler), ve A.7 Stok Yönetim'in üç
> alt modülü (Takım & Sarf / Karbür / Malzeme) **tek "Stok Takibi" ekranında sekmelere** dönüşecek.
> Tuval: `design/StokTakibiOneri.dc.html` (page-5, "Stok Takibi — Yeni Yapı"). Bu, A.7 ve A.8
> satırlarındaki "✅ Kademe 1+2 kodlandı" durumunu **geçersiz kılmaz ama üzerine yeni bir kademe
> ekler** — mevcut `.stok-ray` dikey modül rayı yerini sidebar'a bırakacak. **Kritik**: STOK_BOLUM_TANIM
> ve stok bölüm anahtarları (`adminTabPermissions/takimStokViews`) bu birleşmeyle yeniden ele
> alınmalı; "Zimmet" sekmesi tuval taslağında var ama `toolZimmet` backend'de aktif değil (bkz.
> BACKEND.md §9) — kodlarken kaldırılacak ya da gerçek bir özelliğe bağlanacak.

Durum kodları: ✅ Kodlandı · 🎨 Design'da var, kod yok · ⛔ Henüz dokunulmadı

---

## 0. ORTAK TASARIM DİLİ (temel katman — önce bu sabitlenecek)

| Öğe | Konum | Not |
|---|---|---|
| 0.1 Renk & tema değişkenleri | `ui/styles.css:23-49` | Mevcut CSS custom property seti |
| 0.2 Tipografi | — | Ayrı/merkezi tanımlı değil — tespit edilecek |
| 0.3 `.tab-btn` (üst sekme) | `ui/styles.css:59` | 40+ kullanım, admin+operatör |
| 0.3 `.sub-tab-btn` (2. seviye sekme) | `ui/styles.css:236-237` | 26 kullanım — hepsi `render-admin.js` |
| 0.3 `.chip` (eski pill/filtre) | `ui/styles.css:69` | ~52 kullanım, karışık amaç (bir kısmı gezinme kalıntısı, bir kısmı gerçek filtre — ayrıştırılmalı) |
| 0.3 `.btn-primary` / `.btn-start` / `.btn-ghost` | `ui/styles.css:66-68` | Genel butonlar |
| 0.3 `.badge` / `.sbadge` | `ui/styles.css:71,76-77` | Rozet/durum etiketi |
| 0.3 `.modal-overlay` / `.modal-box` / `.modal-header` / `.modal-body` | `ui/styles.css:155,192-201` | Genel modal iskeleti |
| 0.3 `.card` | `ui/styles.css:101-104` | Operasyon kartı |
| 0.3 `.sw` / `.sw-track` / `.sw-knob` | `ui/styles.css:79-88` | Aç/kapa anahtarı |
| 0.3 `.set-row` / `.set-card` | `ui/styles.css:91-99` | Ayarlar satırı/kartı |
| 0.4 Inline `style=` yoğunluğu | `render-admin.js` 892 · `karbur-ui.js` 305 · `render-operator.js` 132 · `render-common.js` 159 · `toolstock-ui.js` 117 · `tadilat-ui.js` 41 · `catalog-ui.js` 27 · `state-ui.js` 11 · `operations.js` 11 | Bu ekranlar class sistemine geçmemiş — her ekranı kodlarken ayrıca temizlenecek |

---

## A. ADMİN EKRANLARI — `ui/render-admin.js:1401 renderAdmin()` (öncelik: yüksek)

| # | Ekran | view / konum | CSS | Durum |
|---|---|---|---|---|
| A.1 | Rapor | `view=report`, `:1968` civarı | `.admin-stats .filter-bar .table-wrap` (`styles.css:131-139`) | 🎨 "Canlı Panel"e birleşti, `design/CanliPanelOneri.dc.html` |
| A.2 | Makine Matrisi | `view=matrix`, `:1968` | `.matrix-wrap/.matrix-grid/.matrix-card` (`styles.css:143-153`) | 🎨 "Canlı Panel"e birleşti, `design/CanliPanelOneri.dc.html` |
| A.3 | Tamamlanan Kodlar | `view=completed`, `:2075` | `.completed-wrap/.completed-card` (`styles.css:245-267`) | 🎨 "Canlı Panel"e birleşti, `design/CanliPanelOneri.dc.html` |
| A.4 | İş Yoğunluğu | `view=isYogunlugu`, `:2148` (render `:1387`) | alt görünüm: Liste/Özet/Hafta/Pano (TV panosu) | 🎨 `design/IsYogunluguOneri.dc.html` (yeni kabukta) — eski `IsYogunlugu.dc.html` hâlâ sahipsiz/kullanılmıyor |
| A.5 | Analiz | `view=analiz`, `:2150` | alt sekme `genel/makine/kisi/durus/mesai` (`:2355-2359`, `.sub-tab-btn`), grafikler `.analiz-chart-box/.analiz-gantt-*` (`styles.css:250-261`) | 🎨 `design/AnalizOneri.dc.html` |
| A.6 | Tadilat Yönetim | `view=tadilatYonetim`, `:2523` | alt sekme `talepler/canli/analiz` (`:2558-2560`) | 🎨 `design/TadilatOneri.dc.html` |
| A.7 | **Stok Yönetim** | `view=stokYonetim`, `:2650` (render `:1011 renderStokScreen`) | `.stok-ray/.stok-ray-btn/.stok-govde/.stok-icerik/.stok-bolumler` (`styles.css:219-243`), merkezi tanım `STOK_BOLUM_TANIM` (`:950-981`) | ✅ Kademe 1+2 kodlandı, ama 🎨 `design/StokTakibiOneri.dc.html` ile YENİ bir yapı öneriliyor (3 modül → tek ekran sekmeleri) — kodlama bekliyor |
| A.7.1 | ↳ Takım & Sarf | `toolstock-ui.js:27` | Durum/Giriş/Hareketler/Konumlar/Excel | ✅ (eski yapı), 🎨 StokTakibiOneri'de "Takım & Sarf" sekmesi |
| A.7.2 | ↳ Karbür | `karbur-ui.js:35` | Durum/Giriş/Hareketler/Kesim Planı/İş Emri Tüketimi/Excel | ✅ (eski yapı), 🎨 StokTakibiOneri'de "Karbür" sekmesi |
| A.7.3 | ↳ Malzeme (çelik) | `render-admin.js:742` | Durum/Giriş/Hareketler/Kod ile Giriş/Excel | ✅ (eski yapı), 🎨 StokTakibiOneri'de "Hammadde" sekmesi |
| A.8 | Ayarlar | `view=adminSettings`, `:1460-1967` | 13 düz sekme (`settingsSubTab`, `:1464-1483`): access/personelAyarlari/makineAyarlari/personelAtolye/durusReasons/tadilatSablonlari/bolumKurallari/tabErisimi/takimStok/karbur/veriListeleri/stok/bildirimlerim/uyarilar/resimBul/bildirimGonder/addOperator/addMachine | 🎨 eski `design/Ayarlar.dc.html` (5 grup) terk edildi → YENİ `design/AyarlarOneri.dc.html` (4 grup: Genel&Kurulum/Makineler/Üretim Kuralları/Erişim; Kişiler→Operatörler, Veri→Excel Yükleme, Bildirimler kendi nav'ına taşındı) |
| A.9 | *(yeni)* Canlı Panel | — | — | 🎨 `design/CanliPanelOneri.dc.html` — Rapor+Matris+Tamamlanan birleşimi |
| A.10 | *(yeni)* Bildirimler | — | — | 🎨 `design/BildirimlerOneri.dc.html` — Ayarlar'daki bildirimlerim/uyarılar/bildirimGonder buraya taşındı |
| A.11 | *(yeni)* Excel Yükleme | — | — | 🎨 `design/ExcelYuklemeOneri.dc.html` — Ayarlar'daki veriListeleri buraya taşındı |
| A.12 | *(yeni)* Operatörler | — | — | 🎨 `design/OperatorlerOneri.dc.html` — Ayarlar'daki personelAyarlari/addOperator buraya taşındı |

---

## B. OPERATÖR EKRANLARI — `ui/render-operator.js:2 renderOperator()` (öncelik: **düşük / mobil ağırlıklı — onay bekliyor**)

| # | Ekran | view / konum | CSS | Durum |
|---|---|---|---|---|
| B.1 | Makineler | `view=list`, `:44` | — | ⛔ |
| B.2 | + Yeni Kayıt | `view=new`, `:167` (çok adımlı `newStep`) | — | ⛔ |
| B.3 | Geçmiş | `view=gecmis`, `:313` | — | ⛔ |
| B.4 | Fason | `view=fason`, `:130` | — | ⛔ |
| B.5 | Tadilat | `view=tadilat` (list altı) | — | ⛔ |
| B.6 | Takım Dolabı | `view=takimStok`, `:42` (render `toolstock-ui.js:283`) | — | ⛔ |
| B.7 | Ayarlar | `view=settings`, `:373` | — | ⛔ |
| B.8 | Kilit Ekranı | `render-common.js:789 renderLockScreen()` | `.lock-screen/.lock-timer` (`styles.css:119-128`) | ⛔ |

---

## C. design/ klasörü (mevcut tasarım varlıkları)

- `canvas.json` — 5 sayfa: **Stok** (eski, ✅ kodlandı), **Ayarlar** (eski, terk edildi), **Tasarım Dili**,
  **Yön Seçimi** (3 taslak, henüz seçilmedi — bkz. not), **Uygulama Kabuğu — Yeni Yapı** (page-5,
  güncel/aktif çalışma — 9 ekran: StokTakibiOneri, CanliPanelOneri, AnalizOneri, TadilatOneri,
  IsYogunluguOneri, BildirimlerOneri, ExcelYuklemeOneri, OperatorlerOneri, AyarlarOneri)
- Eski `.dc.html` artboard'ları (page-1/2, artık referans amaçlı): `Simdi.dc.html`, `Main.dc.html`,
  `StokMobil.dc.html`, `AyarlarSimdi.dc.html`, `Ayarlar.dc.html`
- `IsYogunlugu.dc.html` (287 satır, eski/tekil) — **canvas.json'da referansı yok**, sahipsiz kaldı;
  yerini `IsYogunluguOneri.dc.html` aldı
- 2 büyük export: `is-yogunlugu-tasarim.html`, `stok-ve-ayarlar-kurgusu.html` (~2.5MB+, tam-sayfa yedek/yayın dosyası)

**Not — Yön Seçimi henüz sonuçlanmadı**: `page-4`'teki 3 renk/tipografi yönü (A açık-SaaS, B koyu-endüstriyel,
C sıcak-nötr) arasından resmi bir seçim yapılmadı; sonradan gelen Uygulama Kabuğu ekranları (page-5) A'ya
yakın ama BİREBİR aynı değil bir palet kullanıyor (kırmızı-turuncu #E14F44 accent, koyu lacivert #1C2028
sidebar). Kodlamaya geçmeden önce bu paletin kesinleştirilmesi gerekiyor.

---

## Önerilen sıra (2026-09-15 güncellendi)

1. ~~0 — Ortak tasarım dili~~ — yerini Uygulama Kabuğu'nun kendi palet/tipografi kararları aldı (bkz. yukarıdaki not, kesinleştirilmeli).
2. **Kodlamaya başlama sırası** (page-5'teki 9 ekran, hepsi tasarımda hazır):
   a. **Uygulama kabuğu** (sol sidebar, `.app-shell`/`.app-nav` gibi yeni bir ortak bileşen seti) — diğer
      tüm ekranlar buna bağımlı, önce bu kodlanmalı.
   b. **A.7 Stok Takibi** — zaten en olgun ekran, STOK_BOLUM_TANIM'ın yeniden tasarımı burada yapılır.
   c. **A.8 Ayarlar** (yeni 4 grup) — mevcut 13 sekmeden veri/mantık taşıma işi büyük ama tasarım net.
   d. **A.9 Canlı Panel** — Rapor/Matris/Tamamlanan'ın birleşmesi, `renderAdmin()` içindeki 3 ayrı view'ı tek ekrana indirir.
   e. Kalanlar (Analiz, Tadilat, İş Yoğunluğu, Bildirimler, Excel Yükleme, Operatörler) — bağımsız, paralel ilerleyebilir.
3. **B (Operatör)** — kapsam onayına bağlı, düşük öncelik.
