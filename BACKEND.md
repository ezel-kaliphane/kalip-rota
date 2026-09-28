# bom-rota — Backend Referansı

Bu doküman uygulamanın **backend'ini** (veri modeli, kimlik doğrulama, iş mantığı, Cloud Functions,
güvenlik kuralları) baştan sona anlatır. Görsel/arayüz tarafı (CSS, ekran düzeni) kasıtlı olarak
dışarıda bırakılmıştır — amaç, mevcut backend'e karşı yeni bir frontend tasarlanabilmesi için
gereken eksiksiz referansı sağlamaktır. Dosya:satır referansları geçtiği yerlerde koddaki gerçek
karşılığına bakılabilir.

> KPI/Verimlilik hesaplama formüllerinin (computeAnalizData vb.) çok daha derin bir dökümü için
> ayrıca `DATA_LOGIC_AUDIT.md`'ye bakın — bu doküman o detaya girmez, sadece hangi düğümleri
> okuduğunu belirtir.

---

## 1. Genel Mimari

- **Geleneksel bir "backend server" yok.** İstemci (tarayıcı) JavaScript'i doğrudan **Firebase
  Realtime Database**'e bağlanır; tüm iş mantığı istemci tarafında çalışır.
- **Cloud Functions** (`functions/index.js`) sadece zamanlanmış/olay-tetiklemeli **push bildirimi**
  görevleri için var — hiçbir hesaplama/agregasyon sunucu tarafında yapılmıyor.
- **Veritabanı**: Firebase RTDB (tek bulut kaynağı), proje `ezel-kaliphane`, bölge
  `europe-west1`. Bağlantı bilgisi `index.html:24-33`; aynı config `firebase-messaging-sw.js:11-19`'da
  service worker için elle senkron tutulan bir kopya olarak tekrar ediliyor.
- **SDK**: Firebase JS SDK compat 10.13.2 — `app`, `database`, `messaging` (`index.html:14-16`).
  Firestore/Storage yok.
- **Kalıcılık**: `localStorage` sadece UI tercihleri ve cache için (oturum, tema, katalog cache,
  push cihaz ID) — hiçbir ham iş verisi orada tutulmuyor.

---

## 2. Kimlik Doğrulama (Auth) ve Roller

**Gerçek Firebase Auth kullanılmıyor.** Kendi yazılmış, `operators/{username}` düğümüne dayanan bir
login sistemi var:

- `doLogin()` (`js/firebase-push.js:301-326`) — girilen kullanıcı adını `operators` içinde arar,
  girilen şifreyi **SHA-256** (Web Crypto API, `sha256Hex()`, `js/state.js:8-11`) ile hashleyip
  `op.password` alanıyla karşılaştırır.
- Şifre saklama: `operators/{code}/password` alanında **64 karakterlik SHA-256 hex** (Rules bunu
  zorunlu kılıyor — `database.rules.json:29`). Eski düz-metin kayıtlarla eşleşme olursa
  (`legacyPlaintextMatch`) giriş kabul edilip arka planda hash'e "sessiz göç" yapılıyor.
- `changePassword()` (`js/firebase-push.js:355-369`) — yeni şifre 1-8 haneli rakamla (PIN) sınırlı.
- **Gerçek token/JWT/expiry yok.** Oturum, tarayıcı belleğinde tutulan basit bir `session`
  nesnesi; `localStorage` (`rota_session`, `rota_remember`) ile kalıcı hale getiriliyor, süresiz.

### Rol/İzin modeli

`session = { username, displayName, isAdmin, isSuperAdmin, isSef, isUretimSef }`
(`js/firebase-push.js:317`) — bu 4 boole bayrak doğrudan `operators/{username}` düğümünden okunur.
Roller **kodda değil, Firebase Console'dan elle** set ediliyor; RTDB Rules bu 3 alanı istemcinin
kendi kendine yazmasını engelliyor (`database.rules.json:45-47`: `isAdmin`/`isSuperAdmin`/`isSef`
→ `.validate:false`). Bu, sistemdeki **tek gerçek yetki-yükseltme koruması**.

| Bayrak | Anlamı |
|---|---|
| `isAdmin` | "Yönetici ekranını gör" — SuperAdmin/Şef/Üretim Şef/sıradan Admin hepsi taşır |
| `isSuperAdmin` | Tam yetki: kullanıcı/makine yönetimi, silme, Excel yükleme, ayarlar |
| `isSef` / `isUretimSef` | Orta seviye: tadilat oluşturma varsayılan yetkisi, analiz/matrix/Devam Eden erişimi |

Ayrıca `operators/{code}` altında kullanıcı bazlı ince ayar boole alanları var: `permTadilatOlustur`,
`permReportEdit`, `permReportDelete`, `permBildirimYonetimi`, `permTakimStokGor`,
`permTakimStokSayim`, `messagesAccess`, `multiJob`, `cokluIsEmri`, `fasonYetkisi`,
`atolyeImalat`/`atolyeTadilat`, `allowedMachines`, `defaultMachine` (hepsi
`database.rules.json:23-49`'da tanımlı).

**Önemli:** RTDB Rules'ın kendisi rol bazlı yazma kısıtlaması **neredeyse hiç yapmıyor** — bkz.
Bölüm 4. Gerçek yetkilendirme tamamen istemci JS'teki `session.isX` kontrollerine dayanıyor. Yeni
bir frontend yazılırsa bu kontroller yeniden uygulanmalı, Rules'a güvenilemez.

---

## 3. RTDB Şema Envanteri

`js/firebase-push.js` içindeki `initFirebase()` (satır 175-282), açılışta hangi düğümün **canlı**
(`.on('value')`) hangisinin **tek seferlik** (`.get()`/`.once()`) okunduğunu belirleyen merkezi
yerdir.

| Düğüm | Amaç | Yazan | Okuma şekli |
|---|---|---|---|
| `entries/{id}` | Üretim rota kayıtları (iş emri başlat/duraklat/bitir) | `js/operations.js` | **Canlı** |
| `operators/{code}` | Hesaplar, roller, izinler, şifre hash'i, `fcmTokens` | `js/firebase-push.js` | **Canlı** |
| `tadilatlar/{id}/operasyonlar/{opId}` | Tadilat (rework) talepleri + operasyon adımları | `js/tadilat.js` | **Canlı** |
| `messages/{id}` | Değişiklik/manuel bildirim mesaj kutusu | `js/tadilat.js` | Tek seferlik, son 100 |
| `machines_extra/{code}` | Admin'in eklediği ek makineler `{name}` | `js/operations.js` | Tek seferlik |
| `machines_hidden/{code}` | Silinmiş dahili makineler (`true`) | `js/catalog.js` | Tek seferlik |
| `machines_fason/{code}` | "Fason/Dışarı Gönderim" işaretli makineler | `js/state.js` | Tek seferlik |
| `machines_atolye/{code}` | Makinenin İmalat/Tadilat atölye ataması | `js/state.js` | Tek seferlik |
| `tadilatOnHazirIstekler/{id}` | Tadilat formu hazır açıklama şablonları | `js/catalog.js` | Tek seferlik |
| `validIsEmri/{kod}` | ERP'den yüklenen geçerli İş Talep No listesi | `js/catalog.js` (Excel) | Tek seferlik |
| `malzemeListesi/{uKodu}` | U kodu → açıklama sözlüğü | `js/catalog.js` (Excel) | Tek seferlik |
| `isMerkezleri/{kod}` | ERP iş merkezi kodları (tadilat "talep makine" kaynağı) | `js/catalog.js` (Excel) | Tek seferlik |
| `uretimPersoneli/{ad}` | `{gorev,bolum}` — tadilat "talep eden kişi" doğrulama | `js/catalog.js` (Excel) | Tek seferlik |
| `tadilatBolumKurallari/{bolum}` | Bölüm → iş merkezi önek filtresi `{mode,prefixes}` | `js/catalog.js` | Tek seferlik |
| `adminTabPermissions/{username}` | Kullanıcı bazlı sekme/alt-görünüm görünürlüğü | `js/catalog.js` | **Canlı** |
| `durusReasons` (array) | Özelleştirilmiş duruş nedenleri | `js/catalog.js` | Tek seferlik |
| `settings/*` | Uygulama genelinde toggle/eşik ayarları (bkz. aşağı) | `js/state.js`, `js/karbur.js`, `js/toolstock.js` | **Canlı** |
| `stockItems/{id}` | Malzeme (hammadde) stok kalemleri | `js/state.js` | **Canlı** |
| `stockHareketleri/{id}` | Malzeme stok hareket günlüğü | `js/state.js` | Tek seferlik, son 20 |
| `pushLog/{id}` | Gönderilen tüm push bildirimlerinin günlüğü | Cloud Functions | Tek seferlik, filtreli |
| `manualPushRequests/{id}` | Manuel bildirim isteği (yaz-ve-unut) | `js/firebase-push.js` | Hiç okunmuyor |
| `pushNotified/*` | CF'lerin "bildirdim mi" iz düğümü | Sadece CF (Admin SDK) | `.read/.write:false` (client için) |
| `toolLocations/{id}` | Takım dolabı/konum listesi | `js/toolstock.js` | Ekran açılınca tek seferlik |
| `toolCatalog/{id}` | Takım & sarf katalog kalemleri (statik) | `js/toolstock.js` | Versiyon kontrollü localStorage cache |
| `toolStock/{id}` | Takım stok adedi (değişken) | `js/toolstock.js` | Her açılışta taze |
| `toolMoves/{id}` | Takım stok hareket günlüğü | `js/toolstock.js` | Sayfalı/filtreli, toplu indirilmez |
| `toolZimmet/{id}` | Demirbaş zimmet kayıtları | Rules'da tanımlı, JS'te aktif yazan bulunamadı — kısmen inşa halinde | — |
| `karburKatalog/{id}` | Karbür çubuk/hazır parça katalog kalemleri | `js/karbur.js` | Versiyon kontrollü cache |
| `karburStok/{katalogId}` | `{adet, sonHareketTs}` | `js/karbur.js` | Her açılışta taze |
| `karburFire/{id}` | `{disCap,delik,kalite,boy,adet}` — artık/fire havuzu | `js/karbur.js` | Her açılışta taze |
| `karburHareketleri/{id}` | Stok hareketi + iş emri tahsisi (2 kayıt sınıfı, bkz. §5) | `js/karbur.js` | Sayfalı, toplu indirilmez |
| `karburIsEmriOzet/{baseIsEmriNo}` | Denormalize iş emri bazlı karbür tüketim özeti | `js/karbur.js` (transaction) | Hedefli tek-kayıt sorgusu, cache'li |
| `tadilatDurustaOperasyonlar/{tadilatId}_{opId}` | Duruştaki tadilat operasyonlarının küçük denormalize kopyası (CF maliyet optimizasyonu) | `js/tadilat.js` | Sadece CF okur |

### `settings/*` bilinen alanlar

`stockTrackingEnabled`, `resimBulEnabled`, `uzunDurusUyariEnabled`, `uzunDurusEsikDk`,
`sessizSaatlerEnabled`, `sessizSaatBaslangic`/`sessizSaatBitis`, `tadilatTamamlandiBildirimEnabled`,
`gunBasiHatirlaticiEnabled`, `gunBasiSaatHaftaIci`/`Cumartesi`/`Pazar`, `uzunDevamEdenUyariEnabled`,
`uzunDevamEdenEsikSaat`, `mesaiBitisHatirlaticiEnabled`, `mesaiBitisSaat`,
`mesaiSonuHatirlaticiEnabled`, `mesaiSonuSaat`, `toolStokEnabled`, `toolCatalogVersion`,
`karburEnabled`, `karburHurdaEsigi`, `karburKatalogVersion`.

### `entries/{id}` alan şeması

Rules'ın zorunlu kıldığı çekirdek alanlar: `isEmriNo, makine, operatorUsername, startTs, status`
(`database.rules.json:9-21`). Ayrıca serbest bırakılmış (`$other:{.validate:true}`) ek alanlar:

```
talepNo, operatorName, adet, endTs, sonOperasyon, duruşNedeni, duruşTs,
duruşToplamMs, durusLog[], excludedMs, excludedLog[], groupId,
partiRootId, parentEntryId, sonrakiMakine,
finishedByUsername, finishedByName, startedByUsername, startedByName,
gunSonuOncesiNeden
```

`status`: `'devam' | 'duruş' | 'tamamlandi'`. Zaman damgaları JS `Date.now()` epoch milisaniye,
`number` olarak saklanıyor. Sunucu saatiyle doğrulama yok — istemci cihazının saatine güveniliyor.

---

## 4. Security Rules (`database.rules.json`)

Kök `.read:false, .write:false`; her düğüm ayrı açılıyor. **Genel desen: çoğu düğüm herkese
`.read:true`**, yazma ise düğüm bazında ya tamamen kapalı ya da `$id` alt-anahtarı seviyesinde
serbest.

- **Rol bazlı (per-role) yazma kısıtı Rules seviyesinde neredeyse hiç yok** — herhangi bir
  oturum açmış istemci herhangi bir `$entryId`/`$code` altına yazabiliyor. Gerçek yetkilendirme
  tamamen istemci JS'teki `session.isX` kontrollerine dayanıyor.
- Rules'ın yaptığı şey **veri tipi/uzunluk doğrulaması** (`entries`, `operators`,
  `manualPushRequests` için alan bazlı `.validate`) ve **tek gerçek koruma**:
  `operators/$code/isAdmin|isSuperAdmin|isSef` client tarafından hiç yazılamaz
  (`.validate:false`) — rol yükseltme sadece Firebase Console'dan mümkün.
- `pushNotified` ve CF-only düğümler client'tan tamamen kapalı (`.read/.write:false`).
- İndeksler (sorgu maliyeti için): `entries.status`, `messages.ts`, `toolCatalog.canias`,
  `toolMoves.ts/itemId/operatorUsername`, `toolZimmet.durum/operatorUsername/itemId`,
  `karburKatalog.kod`, `karburHareketleri.ts/isEmriNo/katalogId/planNo`,
  `karburIsEmriOzet.sonTs`, `stockHareketleri.ts`, `pushLog.toUsername/sentAt`.

**Sonuç: bu "açık" bir RTDB modeli** — gerçek güvenlik sınırı yok, sadece veri bütünlüğü
doğrulanıyor. Yeni bir frontend, yetkilendirmeyi kendi tarafında yeniden uygulamak zorunda.

---

## 5. Cloud Functions (`functions/index.js`)

Tümü `europe-west1` bölgesinde, `firebase-admin` ile `db = admin.database()`. Ortak yardımcı
`sendToOperator(username, title, body, tag, meta)` (`:20-69`) — `operators/{username}/fcmTokens`
altındaki cihaz token'larına `sendEachForMulticast` ile data-only FCM mesajı gönderir, geçersiz
token'ları temizler, her denemeyi `pushLog`'a yazar.

| Fonksiyon | Tetikleyici | Ne yapar |
|---|---|---|
| `uzunDurusUyarisi` | `onSchedule`, her 1 dk | `entries` (`status='duruş'` indexli) + `tadilatDurustaOperasyonlar`'ı okur; `settings.uzunDurusEsikDk` eşiğini aşan duruşlar için operatöre bildirim yollar. `pushNotified/entries|tadilat` ile tekrar göndermeyi engeller, `sessizSaatler`e uyar. |
| `tadilatTamamlandiBildirimi` | `onValueWritten` (`tadilatlar/{id}/operasyonlar/{opId}`) | Bir operasyon `status:'tamamlandi' & sonOperasyon:true` olduğu ANDA tüm `isSef:true` hesaplara bildirim gönderir. `_bildirimClaimed` transaction kilidi ile çift tetiklenmeyi engeller. |
| `manuelBildirimGonder` | `onValueCreated` (`manualPushRequests/{reqId}`) | SuperAdmin panelinden yazılan isteği yakalayıp FCM gönderir, sonucu (`sent`/`error`) aynı kayda geri yazar. `_claimed` transaction ile idempotent. |
| `gunBasiDurusHatirlatici` | `onSchedule`, her 1 dk (fiilen günde bir kez, `settings.gunBasiSaat*`e denk gelince) | O an duruşta olan (Gün Sonu dahil) ve dünden beri `'devam'`da kalmış tüm işleri (fason hariç) sahiplerine bildirir. Günlük tekilleştirme `pushNotified/gunBasi/{tarih}/_ran`. |
| `mesaiBitisiHatirlatici` / `mesaiSonuHatirlatici` | `onSchedule`, her 1 dk, ortak yardımcı `mesaiHatirlaticiCalistir` | Ayarlanan saatte (`settings.mesaiBitisSaat`/`mesaiSonuSaat`) o an `'devam'` olan tüm entries/tadilat operasyonlarının sahiplerine "mesai bitti, durdur" hatırlatması gönderir. |

---

## 6. Ana İş Akışları

### 6.1 İş Emri Yaşam Döngüsü (`js/operations.js`)

- **Başlat** (`baslat()`, `:138-261`): "Talep No" girilir → `resolveTrackingCode()` ile
  `validIsEmri`'den gerçek U koduna (`isEmriNo`) çevrilir; `_ZARF`/`_ELMAS` bileşen eki eklenir
  (`BILESEN_SUFFIX`). Kontroller: `isEmriValid()`, makine meşgul mü (fason hariç), bileşen
  dallarının tamamlanmış olma zorunluluğu. `entries/{id}` = `{status:'devam', startTs,
  duruşToplamMs:0, excludedMs:0, ...}` yazılır. İlk operasyonsa ve stok takibi açıksa hammadde
  `consumeStock()` ile düşülür. "Çoklu İş Emri" modu aynı makinede birden fazla iş emrini
  `groupId` ile açabiliyor.
- **Duraklat** (`confirmDurus`/`duraklatGrup`, `:468-546`): `status:'duruş', duruşNedeni,
  duruşTs`. Neden "Gün Sonu" ise süre `excludedMs`'e (verimlilikten hariç), değilse
  `duruşToplamMs`'e eklenir; her ikisinde de olay `durusLog`/`excludedLog`'a push edilir. Neden
  "Tadilat" ise otomatik tadilat ekranına yönlendirilir.
- **Devam Et** (`devamEt`, `:504-527`): duruşu kapatır, makine meşgulse engeller. Bir operatör
  Gün Sonu verdiğinde elindeki DİĞER duraklamış işler de otomatik Gün Sonu'na taşınır
  (`carryGunSonuToOtherPausedEntries`); tekrar çalışmaya dönünce geri çevrilir
  (`wakeOtherGunSonuEntries`).
- **Bitir** (`bitir`/`finishEntry`/`bitirGrup`/`finishGrup`, `:266-295, 571-629`): son operasyon
  değilse "Sıradaki Operasyon" sorulur; Press (bileşen dalları için) veya Final Kalite Kontrol
  seçilirse rota otomatik son operasyon sayılır. `status:'tamamlandi', endTs, sonrakiMakine`
  yazılır.
- **Devral** (`devralIs`, `:491-502`): başka bir operatörün açık bıraktığı işi
  `operatorUsername` değiştirerek üstlenir.
- **Kısmi Aktarım** (`confirmKismiAktar`, `js/state.js:345-376`): bir işin bir kısmının bitmeden
  sonraki operasyona `partiRootId`/`parentEntryId` ile aktarılması.

### 6.2 Tadilat (Rework) Akışı (`js/tadilat.js`)

- Yetkili kullanıcı (`canCreateTadilat`) `addTadilat()` (`:228-259`) ile `tadilatlar/{id}` altına
  talep açar (`uKodu, adet, bolum, talepMakine, talepEdenKisi, atolye, aciklama`).
- Talebin durumu **ayrı bir status alanına yazılmaz** — `tadilatBekliyorMu`/`tadilatTamamlandiMi`
  tamamen `operasyonlar/{opId}` listesinden türetilir: `sonOperasyon:true & status:'tamamlandi'`
  olan bir operasyon varsa talep kapanır.
- **Al** (`tadilatAl`, `:436-467`): operatör makine seçer, `operasyonlar/{opId}` =
  `{status:'devam', baslamaTs, kaynakEntryId, kaynakTadilatRef}`. `kaynakEntryId` — operatörün
  "Tadilat" nedeniyle duraklattığı üretim işine referans (varsa); iç içe kesinti zincirleri de
  (`kaynakTadilatRef`) izlenir.
- **Duraklat/Devam/Bitir**: merkezi `tadilatOpUpdate()` (`:135-151`) üzerinden —
  `tadilatlar/{id}/operasyonlar/{opId}`'i günceller ve CF maliyet optimizasyonu için
  `tadilatDurustaOperasyonlar/{id}_{opId}` index'ini best-effort ayrıca yazar.
- **Bitir** (`tadilatBitir`, `:475-531`): `sonOperasyon` işareti bitirirken sorulur. Kapanınca:
  kaynak bir üretim işiyse, o işin duruş nedeni otomatik `"Tadilat Sonrası Ayar"`a çevrilir —
  operatör kaldığı yerden devam edebilsin diye. Kaynak başka bir duraklatılmış tadilatsa, oraya
  geri yönlendirilir. Tamamlanma anında CF (`tadilatTamamlandiBildirimi`) tüm `isSef`
  hesaplara anlık push gönderir.

### 6.3 Takım & Sarf Stok Akışı (`js/toolstock.js`)

- Üç düğüm: `toolCatalog` (statik, versiyon cache'li), `toolStock` (değişken adet, hiç
  cache'lenmez), `toolMoves` (hareket günlüğü, toplu indirilmez).
- **Operatör çıkışı** (`doToolCikis`, `:892-936`): QR/kod ile hedefli tek-kalem sorgusu,
  `toolStock/{id}/miktar` üzerinde **transaction** ile azaltma. Negatife düşmesi
  **engellenmiyor** (bilinçli tasarım — engelleme operatörü kayıt yapmamaya iter), UI'da kırmızı
  gösteriliyor. Son işlem 10 dk içinde `undoLastToolMove()` ile geri alınabilir (yalnızca oturum
  belleğinde, sayfa yenilenince kaybolur).
- **SuperAdmin girişi** (`doToolGiris`, `:593-626`) aynı transaction deseniyle stok artırır;
  `altLimit` üzerine çıkarsa `uyariGonderildi` bayrağı sıfırlanır.
- Excel toplu yükleme sekme adından kategori çıkarır, CANİAS koduna göre upsert yapar.

### 6.4 Karbür Stok Akışı (`js/karbur.js`)

En karmaşık modül:

- `karburKatalog/{id}`: `{kod, disCap, boy, delik, kalite, tur:'cubuk'|'hazir',
  kullanim:'kesim'|'adet'}`. Kod formatı `C18XH156X3XVA90` (çap/boy/delik/kalite),
  `karburParseKod()` ile ayrıştırılır.
- `karburHareketleri` **iki ayrı kayıt sınıfı** taşır: (a) stok hareketi (`adet` dolu,
  `tip: kesim|adet_cikis|kesimsiz|fire_kullanim|giris|sayim|iptal|fire_uretim`), (b) iş emri
  tahsisi (`tip:'tahsis'`, `adet` yok, `parca`+`mm` dolu, `isEmriNo` dolu — bir çubuk birden
  fazla iş emrine hizmet edebildiği için ayrı tutulmuş).
- **Kesim planlama**: First-Fit-Decreasing algoritması (`karburPack`, `:305-324`) — talepleri
  mevcut çubuklara yerleştirir, `KARBUR_PAY_VARSAYILAN=2mm` pay ekler.
- **Hurda eşiği** (`settings.karburHurdaEsigi`, varsayılan 5mm): eşik altı artıklar hiç
  kaydedilmez; eşik ve üzeri "fire" havuzuna (`karburFire`) girer. Fire asla otomatik
  kullanılmaz, kullanıcı elle seçer.
- **Kaydet** (`karburPlanKaydet`, `:583-771`): 3 katmanlı negatif stok koruması (buton kapatma +
  kayıt anında yeniden doğrulama + transaction içinde iptal/geri alma). `karburStok`/`karburFire`
  transaction ile düşülür, `karburIsEmriOzet/{baseIsEmriNo}` transaction ile artırılır
  (denormalize özet).
- **Plan İptali** (`karburPlanIptalUygula`, `:877-967`): silme değil, ters kayıt (`tip:'iptal'`)
  yazılır; orijinal kayıtlar `iptalTs` ile işaretlenir (muhasebe deseni).

### 6.5 Malzeme Stoğu (Hammadde) Akışı (`js/state.js:148-260, 379-737`)

- `stockItems/{id}`: `tur:'adet'` (düz sayaç) veya `tur:'boy'` (Ø'li çubuklar,
  `lots/{lotId}:{boy}` alt-düğümü ile çoklu fiziksel lot takibi).
- `consumeStock()` (`:427-452`) — **transaction kullanmıyor**, yerel değerden
  read-modify-write yapıyor (Karbür modülünün kendi yorumunda eleştirilen, düzeltilmemiş bir
  zayıflık — eşzamanlı iki tüketim yarış durumu riski taşıyor).
- İlk operasyonda hammadde tüketimi soruluyor, rotanın sonraki adımlarında tekrar sorulmuyor.
- Excel toplu yükleme CANİAS koduna göre isim sonundaki `(KOD)` parçasından eşleştirme yapıyor.

### 6.6 QR Kod Akışı (`js/qr.js`)

`#app`'in dışında, `#qr-root` kökünde tamamen imperatif yönetiliyor (render döngüsünden
etkilenmesin diye). Önce native `BarcodeDetector` API denenir, yoksa `jsQR` (CDN'den lazy-load,
`js/lazy.js`) ile canvas üzerinden çözülür. `openQrScanner(onResult)` sonucu callback ile döner.
Kullanım yerleri: stok girişi/çıkışı kod arama, hammadde seçimi.

### 6.7 Push Bildirim Akışı (`js/firebase-push.js` + Cloud Functions)

- Client: `enablePushNotifications()` (`:63-91`) — `Notification.requestPermission()` →
  `serviceWorker.register()` → `messaging.getToken(vapidKey)` → token
  `operators/{username}/fcmTokens/{deviceId}` altına yazılır (cihaz bazlı sabit ID,
  `pushDeviceId()`).
- Foreground mesajlar `setupForegroundPushListener()` (`:43-61`) ile ayrıca yakalanıp service
  worker üzerinden gösteriliyor.
- Gerçek FCM gönderimi **sadece Cloud Functions'ta** (Admin SDK gerektiriyor) — client asla
  doğrudan FCM'e göndermiyor; ya `manualPushRequests`'e yazıp CF'nin tetiklenmesini bekliyor ya
  da otomatik CF'ler devreye giriyor (§5).
- `pushLog` her gönderimi (başarılı/başarısız) kaydeder; client filtreli tek seferlik sorguyla
  okur (canlı dinlenmiyor).

---

## 7. Sabitler (`js/constants.js`)

- `MACHINE_LIST` (`:2-17`) — sabit kodlanmış 28 dahili makine (`{code, name}`), örn. `UF01`
  Freze, `C01` CNC Torna, `FKK` Final Kalite Kontrol. Admin ek makine ekleyebiliyor
  (`machines_extra`).
- `DEFAULT_DURUS_REASONS` (`:26`) — Ayarlar'dan liste boşsa kullanılan 9 varsayılan duruş
  nedeni.
- `GUN_SONU_REASON`, `TADILAT_REASON`, `TADILAT_SONRASI_REASON` — özel anlamlı duruş nedeni
  sabitleri; iş mantığının kilit noktaları (verimlilikten hariç tutma, tadilata yönlendirme,
  tadilat sonrası otomatik duruş).
- `appendDurusLog`/`msOverlap`/`entryDurusEvents`/`entryExcludedEvents`/`collectDurusEvents` —
  duruş olaylarının gün bazlı kesişim/bölme hesaplarının çekirdek yardımcıları.
- Dağınık modül-seviyesi sabitler: `BILESEN_SUFFIX={ZARF:'_ZARF',ELMAS:'_ELMAS'}`
  (`js/state.js`), `TEST_ISEMRI_NO='DENEME'`, `MACHINE_GROUPS` (Analiz filtreleme grupları),
  `WORKDAY_MINUTES=540`, `WORKDAY_END_MINUTE=1050` (17:30, `js/tadilat.js`).

---

## 8. Uygulama Durumu Yönetimi (`js/state.js`)

- **Global state**: `STATE = {operators, entries, messages, validIsEmri, durusReasons,
  tadilatOnHazirIstekler, myPushHistory, pushLogAll}` (`:48`) — Firebase'den gelen büyük
  koleksiyonlar burada. Ayrıca modül-seviyesinde ayrı `let` değişkenleri var: `extraMachines,
  hiddenMachines, fasonMachines, machineAtolye, appSettings, stockItems, stockHareketleri,
  malzemeListesi, isMerkezleri, uretimPersoneli, tadilatBolumKurallari, adminTabPermissions,
  tadilatlar` — hepsini `initFirebase()` dolduruyor.
- **Render tetikleme**: framework yok — `render()` (`js/app.js:82-146`) `#app`'i HTML string
  olarak yeniden üretip `ui/morph.js` ile DOM'a "yama" olarak uyguluyor (`innerHTML` yerine).
  Firebase `.on('value')` callback'leri `safeRender()` çağırıyor; kullanıcı bir input/select ile
  etkileşimdeyse (`isUserInteracting()`) render ertelenip `pendingSafeRender` bayrağıyla bir
  sonraki uygun ana bırakılıyor.
- **Canlı sayaçlar**: `setInterval(...,1000)` (`js/tadilat.js:855-863`) her saniye
  `renderLiveBits()` çağırıyor — tam render yerine `ui/live.js`'teki kayıtlı DOM düğümlerinin
  sadece metnini güncelliyor, 15 tik'te bir (`LIVE_FULL_EVERY`) tam render'a düşüyor.
- **localStorage kullanımı**: oturum (`rota_session`, `rota_remember`), tema (`rota_theme`),
  takım/karbür katalog cache + versiyon (`tool_catalog_cache`/`version`, `karbur_katalog_cache`/
  `version`), push cihaz ID (`rota_push_device_id`), İş Yoğunluğu görünüm tercihi
  (`rota_iy_gorunum`), tadilat form atölye hatırlatıcı, render/perf debug flag'leri
  (`rota_render`, `rota_perf`).
- **Cache pattern**: `entriesArray()`/`tadilatArray()` referans eşitliği kontrolüyle memoize
  ediliyor — `STATE.entries` her Firebase güncellemesinde yeni referans olduğu için ucuz
  "değişti mi" testi olarak kullanılıyor.
- **Maliyet optimizasyonu deseni** (tekrarlayan bir mimari karar): büyük/sık değişmeyen düğümler
  (`messages`, `pushLog`, `stockHareketleri`, `toolMoves`, `karburHareketleri`, referans
  listeleri) **canlı dinlenmiyor**, ilgili ekran açıldığında filtreli/limitli tek seferlik sorgu
  yapılıyor; yazan taraf kendi yerel state kopyasını da güncelleyip `render()` çağırarak "kendi
  yazdığını anında görme" davranışını taklit ediyor.

---

## 9. Bilinmeyen/Eksik Alanlar (yeni frontend yazılırken dikkat)

- `toolZimmet` düğümü Rules'da tanımlı ama JS'te aktif bir yazan bulunamadı — kısmen inşa
  halinde/gelecekteki bir özellik olabilir.
- Sunucu saati doğrulaması yok; tüm zaman damgaları istemci cihazının saatine dayanıyor
  (bkz. `DATA_LOGIC_AUDIT.md` §0.4, zaman dilimi tutarsızlığı).
- `consumeStock()` (malzeme stoğu) transaction kullanmıyor — eşzamanlı iki tüketimde yarış
  durumu riski var; Karbür modülü aynı sorunu transaction ile çözmüş, malzeme stoğu çözmemiş.
- RTDB Rules rol bazlı yazma kısıtlaması sağlamıyor — yeni bir backend/API katmanı yazılacaksa
  yetkilendirme orada yeniden inşa edilmeli.
