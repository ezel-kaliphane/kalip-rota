# Hata Notları

Canlıda karşılaşılan gerçek hatalar, sebepleri ve alınan dersler. Amaç aynı sınıftan bir
hatayı ikinci kez yazmamak. En yeni üstte.

---

## 2026-10-13 — Verimlilik: duruşa basmayan operatör %100, çok günlü kayıt tek güne, paralel makine iki kez

**Belirti.** Kullanıcı: "Muhammet Kurt nasıl %100 verimlilik çıkıyor, geç geldiği günler bile var."
Son 30 günde 19 operatörden 5'i %95+; M. Kurt 24 günün 23'ünde 08:15'ten sonra başlamış.

**Sebepler.** (1) Operatör verimliliği `çalışma ÷ (çalışma + duruş)` idi — payda vardiya değil, yalnız
kaydın kendi süresi; duruşa hiç basmayan herkes %100, geç geliş/erken çıkış/işler arası boşluk görünmez.
(2) Kayıt yalnız BAŞLADIĞI güne yazılıyordu: Cuma açılıp Pazartesi kapanan iş Cuma'ya 1137 dk; bazı
kişiler %129–211 (sonra "fiziksel tavan" ile 24 saate kırpılıyordu, kök sebep kalıyordu). (3) Aynı
anda iki makine çalıştıran operatörün süresi toplanıyordu. (4) Makine paydası Pazar dahil tüm takvim
günleri × 540. (5) Gece kendi kendine çalışan CNC/erozyonun 00:00–08:00 çalışması fazla mesai sayılmadığı
için makine/operatör ham verimi %115'e çıkıyordu (ilk düzeltme denemesinde yakalandı).

**Düzeltme (js/verimlilik.js + computeAnalizData).** Her kayıt gün gün bölünür, duruş/Gün Sonu kendi
zaman damgalarıyla (durusLog/excludedLog) çıkarılır, süre aralıkların BİRLEŞİMİ. Kullanılabilirlik:
Pzt–Cum × 540 (bugün: vardiyanın geçen kısmı) + fazla mesai; fazla mesai = vardiya (08:00–17:30)
dışı + vardiya içinde 540'ı aşan + hafta sonu. Operatör = net çalışma ÷ (kayıtlı olduğu günlerin
kullanılabilirliği + fazla mesai). Sonuç: kimse %100'ü aşmıyor; M. Kurt %49. "Fiziksel tavan" uyarısı
yerine 20 saati aşan kesintisiz net çalışma "kapatılmamış kayıt olabilir" diye işaretleniyor.

**Ders.** Oran tasarlarken paydanın neyi temsil ettiğini sor: kaydın kendi süresi kendini ölçer, vardiya
ise kişiyi. Zaman verisini gün gün raporlarken her aralığı GÜNE BÖL; başlangıç gününe yığıp sonra tavana
kırpmak hatayı gizler. "Çalışma" ile "insanın orada olması" aynı şey değil — paralel ve gözetimsiz
çalışma ayrı düşünülmeli.

## 2026-10-13 — Malzeme bekleyen: çubukta rezerve adet kadar eksik (parça boyu toplam sanıldı)

**Belirti.** Kullanıcı: "gerekli boy × adet toplam rezerve olmalı, hesapta hata var." 2344 Ø66 grubunda
5 iş emri (60 mm × 2, 65 × 3, 55 × 6 …) için rezerve 326 mm görünüyordu; doğrusu 981 mm.

**Sebep.** Formdaki alanın adı "Gereken Miktar"dı ve kod onu iş emrinin TOPLAM ihtiyacı sayıyordu.
Şef ise baştan beri (72 mm kaydının hepsinde) PARÇA BOYUNU giriyordu — "Ø72X40 → 45 mm". Testere
payı zaten "kesim sayısı = İ.E. miktarı" ile hesaplandığı için çelişki gözden kaçtı. Aynı yanlış
reçeteye de taşındı: `birimBasina = gereken / İ.E.` → 68 mamulde parça boyu adede bölünmüş kaydedildi
(UC13030327: 55 mm yerine 9,17 mm; U0002975: 36 yerine 0,18). Bu da maliyet tahminini düşürüyordu.

**Düzeltme.** Çubukta (birim mm) `gerekenMiktar` = parça boyu, toplam = boy × İ.E. (`malzemeToplamGereken`);
form "Parça Boyu (mm)" diyor ve toplamı gösteriyor; reçete `birimBasina` = parça boyu. 68 reçete
kullanıcı onayıyla düzeltildi (eski değerler commit mesajında/oturum yedeğinde).

**Ders.** Bir alanın anlamını etiketten değil, kullanıcının GİRDİĞİ veriden doğrula: kayıtlara
bakılsaydı (45 mm, İ.E. 3, mamul adı "Ø72X40") parça boyu olduğu ilk gün belliydi. Etiket belirsizse
("Gereken Miktar") birimi ve kapsamı adıyla söyle ("Parça Boyu (mm)") ve hesaplanan toplamı göster.
Türetilmiş veri (reçete oranı) aynı varsayımla yazılıyorsa hatayı düzeltirken onu da onar.

## 2026-10-12 — Aylık kapanış şifrelenirken "Maximum call stack size exceeded" (canlıya çıkmadan yakalandı)

**Belirti.** Önizleme testinde bir ayı (187 iş emri, ~440 KB) kapatırken şifreli metne çevirme çöktü.

**Sebep.** `btoa(String.fromCharCode(...new Uint8Array(buf)))` — spread her baytı ayrı argüman
yapar; yüz binlerce argüman yığını taşırır. Küçük parametre kaydında (birkaç KB) hiç görünmemişti.

**Ders.** Büyük ikili veride spread/apply ile tek seferde dönüştürme yapma; parça parça (32 KB)
dönüştür. Veri boyutu büyüyecek bir yolu, gerçek boyutlu veriyle dene. (Ek olarak gzip eklendi: 443 → 46 KB.)

## 2026-10-12 — Toplu sipariş "malzemeBekleyen/undefined" kaydı yazdı

**Belirti.** Önizlemede toplu istek no girildi; iş emirlerine istek no yazılmadı, sipariş "0 iş emri ·
fazla 4500 mm" göründü; veritabanında adı `undefined` olan, yalnız istek alanlarını taşıyan bir kayıt oluştu.

**Sebep.** `malzemeBekleyen` ham RTDB düğümü — kayıtların içinde `id` alanı yok (id anahtardır).
`malzemeBekleyenArray()` id'yi ekliyor ama toplu kayıt `malzemeBekleyen[id]`'yi doğrudan aldı;
`'malzemeBekleyen/'+x.id+'/…'` → `malzemeBekleyen/undefined/…`. Yazma engelli testte yol listesine
bakılmadı, yalnız sayıya bakıldı.

**Ders.** Ham düğümden okunan kaydı yol kurmakta kullanırken id'yi anahtardan ekle; yazma engelli
testte yazılacak YOLLARI da kontrol et (`/undefined/` içeren yol = hata). Toplu yazmalarda yol
kurmadan önce id'nin varlığını doğrula.

## 2026-10-07 — Seçilen hammadde stoktan düşülmüyordu (iki ayrı sebep)

**Belirti.** Tamamlanan Kodlar → BOM + Rota ekranında 366 tamamlanan iş emrinin yalnız
%14'ünde BOM vardı; stok çıkışıyla kaydedilmiş hammadde 3 iş emriydi.

**Sebep 1 — telefon formu.** Telefonda yeni iş formu iki adımlı (`isPhone()` → twoStep):
hammadde 1. adımda seçiliyor, BAŞLAT 2. adımda. `baslat()` seçimi
`document.getElementById('nf-stok-item')?.value||''` ile okuyordu — 2. adımda o kutu DOM'da
yok, değer boş geliyor, seçilen hammadde **sessizce** düşülmüyordu. Seçim `newForm.stockItemId`
içinde duruyordu; sadece okunmuyordu. Düzeltme: DOM yoksa `newForm`'dan oku (`??`).

**Sebep 2 — "ilk operasyon" yanlış anahtarla.** `isFirstOperationFor(isEmriNo)` U koduna
bakıyordu. Aynı CANIAS kodu ikinci kez üretime girince (yeni talep no) eski işin kayıtları
bulunuyor, hammadde kutusu hiç çıkmıyordu. Düzeltme: talep no ile bakılıyor; birleşme (eksiz
U kodu) dalları olan iş emrinde ilk operasyon sayılmıyor.

**Ders.** Çok adımlı formda bir adımın alanını başka adımda `getElementById` ile okumak
sessiz veri kaybıdır — form durumu tek kaynaktan (`newForm`) okunmalı. "İlk mi" gibi
kontrollerin anahtarı (U kodu mu, iş emri mi) işin kimliğiyle aynı olmalı. Oranı düşük
çıkan bir rapor çoğu zaman veri girişindeki bir hatanın ilk izidir: önce kaydın neden
yazılmadığına bak.

---

## 2026-10-07 — Yama betiği dosyaya kaçak CR soktu (karbur-ui.js "metin değil")

**Belirti.** `git ls-files --eol` → `ui/karbur-ui.js` `i/-text`; sonraki diff'ler dosyanın
tamamını değişmiş gösterdi. Canlıda görünür etkisi yoktu.

**Sebep.** Python yama betiğinde aranan metin önce `replace("\n", nl)` ile CRLF'ye çevrildi,
sonra yeni metin bu ÇEVRİLMİŞ metinden türetilip bir kez daha aynı dönüşümden geçirildi →
satır sonu `CR CR LF` oldu. Tek kaçak CR dosyayı git gözünde ikili yaptı. (Bu notu yazarken
de aynısı oldu: heredoc içindeki kaçış dizileri gerçek CR'ye dönüştü — not dosyası yeniden
HEAD'den kuruldu.)

**Ders.** Satır sonu dönüşümü bir metne yalnız bir kez uygulanır; dönüştürülmüş metinden
yeni metin türetme. Kaçış dizisi içeren metni kabuk heredoc'u ile değil dosyadan (raw string)
ver. Commit'ten önce `git ls-files --eol` bakmak (zaten kural) ikisini de yakaladı.

## 2026-09-21 — Bayat çalışma kopyası: neredeyse geri alınan iki düzeltme

**Belirti.** Yoktu — canlıya çıkmadı. İş Yoğunluğu yaması çalıştırılırken bir assert
patladı: yama `index.html` içinde `styles.css?v=24` arıyordu, elindeki kopyada `v=23`
yazıyordu.

**Sebep.** Kod cihazda duruyor, üzerinde çalışılan kopya başka bir yere alınıyor
(stage → yamala → geri yaz). Geri yazmak, alınan kopyayı **tazelemiyor**. Bir önceki
adımın değişiklikleri cihaza yazıldıktan sonra da elde hâlâ o adımdan ÖNCEKİ dosyalar
duruyordu. `index.html` tesadüfen sürüm numarası taşıdığı için assert patladı; asıl
tehlike oydu değildi: aynı bayat sette `ui/styles.css` ve `ui/styles.v2.css` de vardı.
Onlar geri yazılsaydı bir önceki adımda eklenen `.notice`, `.empty-state`,
`.matrix-dot` düzeltmesi ve `durus-reason-box` renk devri **sessizce silinecekti** —
ve diff temiz görüneceği için fark edilmeyecekti.

**Aynı hafta ikinci kez.** Birkaç saat önce okuma tarafında aynısı olmuştu: bayat bir
kopyaya bakıp "duruş nedeni seçicisi hâlâ eski koşulu kullanıyor, tutarsızlık var"
sonucuna varılmıştı. Dosya yeniden alınınca görüldü ki düzeltme zaten yapılmıştı; rapor
edilmeden önce tazelendiği için yanlış alarm verilmedi.

**Asıl ders.** Her iki seferde de kurtaran şey bir assert'in tesadüfen patlaması ya da
son anda akla gelen bir kontroldü — **tasarlanmış bir güvenlik ağı değil.** 15 Eylül
notundaki "sürüm bumpını yaptım sanmak yetmiyor, `grep` ile doğrulamak gerekiyor" dersi
burada da geçerli, sadece doğrulanacak şey farklı: *elindeki dosyanın cihazdaki dosya
olduğunu* sanmak yetmiyor.

**Kural (artık süreç adımı).**

1. Her geri yazmadan **sonra** dosyaları yeniden al. Geri yazma, eldeki kopyayı
   güncellemez.
2. Geri yazmadan **önce** de bir kere karşılaştır: yamanın okuduğu kaynak ile o an
   cihazda duran dosya aynı mı? Aynı değilse yamayı iptal et, tazele, baştan üret.
3. Assert'ler bu işi yapmaya yetmez: assert yalnızca yamanın DOKUNDUĞU satırı görür.
   Dosyanın dokunulmayan kısmındaki sürüm farkı hiçbir assert'i patlatmaz.

---

## 2026-09-15 — Karbür KAYDET: stok yerinde dururken "stok yetmedi"

**Belirti.** Karbür kesim planında KAYDET'e basınca *"C40XH40X13,5XST6, C18XH156X3XVA90,
C36XH156X6XVA90, V43X156X5XST7 için stok yetmedi — hiçbir düşüm yapılmadı"*. Ekranda o
kalemlerin stokları 23 / 1 / 12 / 10 görünüyordu ve plan onlara göre kurulmuştu. Planın
**dört kaleminin dördü birden** reddediliyordu; yani "bir kalem eksik" değil, kayıt tümden
kilitliydi. 2026-09-08'den (negatif stok koruması, `05c0a8a`) beri hiçbir karbür çıkışı
kaydedilememiş.

**Sebep.** Koruma şöyle yazılmıştı:

```js
DB.ref(yol).transaction(cur => {
  const sonraki = (Number(cur) || 0) - miktar;
  return sonraki < 0 ? undefined : sonraki;   // negatife düşecekse iptal
})
```

Firebase, transaction'ın update fonksiyonunu **önce yerel önbellekle** çağırır, sonra sunucu
değeriyle tekrar çalıştırır. Karbür modülünde maliyet kısıtı yüzünden **bilerek canlı dinleyici
yok** (`once('value')` ile okunuyor), dolayısıyla o ilk çağrıda değer `null` gelir.
`(Number(null) || 0) - 2` = `-2` → `undefined` → ve `undefined` "iptal" demek: transaction
**sunucuya hiç gitmeden** ölür. Koruma, gerçek stoğu bir kez bile görmeden her kalemi
reddediyordu. Stok ne kadar bol olursa olsun sonuç aynıydı.

Üç katmanlı koruma vardı (ekranda kontrol → kayıt anında taze okuma → transaction içinde son
savunma). İlk ikisi doğru çalışıp geçiyor, üçüncüsü hepsini kesiyordu. Veri bozulmadı: "hiçbir
düşüm yapılmadı" mesajı doğruydu, kısmi düşüm de kalmadı — sadece hiçbir kayıt yapılamıyordu.

**Çözüm.** `karburStokDus` artık her düğümün güncel değerini transaction'dan önce okuyup
`bilinen` olarak saklıyor ve `cur === null` gelen ilk pasta onu kullanıyor. Böylece ilk pas
geçerli bir sayı döndürüyor, transaction sunucuya gidiyor ve fonksiyon **gerçek** değerle
yeniden çalışıyor; gerçekten yetmiyorsa iptal orada oluyor. Negatif koruması kaybolmuyor, doğru
katmana taşınıyor.

**Testler neden yakalamadı — asıl ders bu.** Hata, 28 testlik bir paketle "doğrulanmış" kodda
çıktı. Paketteki sahte RTDB, transaction'ı **tek pas** koşuyordu: fonksiyonu doğrudan gerçek
değerle çağırıp sonucu yazıyordu. Yani gerçek Firebase'in bu hatayı doğuran tek davranışını
modellemiyordu. Test kodu onaylıyordu ama ölçtüğü şey kodun kendi varsayımıydı.

Mock düzeltildi (önce `null` ile çağır; `undefined` dönerse sunucuya gitmeden iptal et) ve eski
kodla koşulunca sahadaki hatayı birebir üretti: "çubuk stoğu 5 → 3" beklenirken stok 5'te kaldı.

**Genel dersler.**

- **Bir kütüphaneyi taklit eden sahte nesne, o kütüphanenin *tuhaf* davranışlarını da taklit
  etmiyorsa test değil, aynadır.** Mock'un modellemediği davranış, testin göremediği hata
  sınıfıdır. Taklit edilecek davranışı kütüphanenin dokümanından seç, kendi zihnindeki
  basitleştirilmiş modelinden değil.
- **Firebase transaction'ında `undefined` döndürmek, henüz sunucu verisini görmemişken
  tehlikelidir.** Canlı dinleyicisi olmayan bir yolda ilk pas daima `null`'dır. İptal kararı
  ancak güvenilir bir değere bakarak verilmeli.
- **Savunma amaçlı kontrol, kullanıcıyı işini yapamaz hale getiriyorsa savunma değil yeni bir
  hatadır.** (2026-09-10 notundaki aynı ders, bu sefer ters yönden: o gün dosya reddediliyordu,
  bu sefer geçerli her kayıt reddedildi.) Koruma eklerken "yanlışlıkla her şeyi engelliyor
  muyum" sorusu, "yeterince sıkı mı" sorusundan önce gelir.
- **"Hiçbir şey kaydedilemiyor" tek bir kalemin hatası gibi görünmez.** Dört kalemin dördünün
  birden reddedilmesi, kalemlerle değil kontrolün kendisiyle ilgili olduğunun işaretiydi;
  hata mesajı kalem kalem yazdığı için bu ilk bakışta veri sorunu gibi okunuyordu.
- **Önbellek sürümünü yükseltmeyi unutma.** Düzeltme commit'i `index.html`'deki
  `js/karbur.js?v=` numarasını yükseltmedi (bumpı yapan komut eski sürüm numarasını arıyordu ve
  sessizce hiçbir şey değiştirmedi); o hâliyle dosyayı önbelleğe almış tarayıcılar düzeltmeyi
  hiç görmeyecekti. Ayrı bir commit ile düzeltildi. Sürüm bumpını "yaptım" sanmak yetmiyor,
  `grep` ile doğrulamak gerekiyor.

---


## 2026-09-10 — Excel yüklerken "program yanıt vermiyor" ve sekmenin kapanması

**Belirti.** Ayarlar → Veri Listeleri → İş Emri Listesi'nde "Yükle ve Güncelle" denince sekme
kilitleniyor, sonra tarayıcı sekmeyi kapatıyordu. Aynı dosya daha önce sorunsuz yüklenmişti.

**Sebep.** Excel okuma satırı şuydu:

```js
XLSX.utils.sheet_to_json(ws, {header:1, defval:''})
```

`sheet_to_json`, sayfanın **beyan ettiği kullanılan aralığı** (`ws['!ref']`) okur — gerçekte
dolu olan satırları değil. ERP'den çıkan dosyalarda bu aralık çoğu zaman `A1:Z1048576` kalıyor:
bir zamanlar biçimlendirilip sonra boşaltılmış satırlar, ya da tablonun çok altında unutulmuş
tek bir hücre yüzünden. `defval` verildiğinde bu aralıktaki **her hücre maddeleştiriliyor** —
27 milyon boş string. Ana iş parçacığı ~24 saniye senkron bloke oluyor, bellek dolunca tarayıcı
sekmeyi öldürüyor.

Kritik nokta: **dosyadaki kayıt sayısının bununla ilgisi yok.** 7.684 satırlık bir listede de
oluyor, çünkü sorun veri değil **aralık beyanı**. Bu yüzden aynı dosya bazen açılıp bazen
çökebiliyor — Excel'in aralığı ne zaman şişirdiğine bağlı, kullanıcı açısından rastgele görünüyor.

Hata kodun kendisinde eskiden beri vardı (`50772c2`'den beri aynı satır); sadece o gün gelen
dosya tetikledi. Yani "dün çalışıyordu" doğru, ama "dün yaptığımız değişiklik bozdu" değil.

**Çözüm.** `js/catalog.js` içinde ortak bir okuyucu: `xlsxSatirlar(ws)`. Sayfa nesnesinde
yalnızca gerçekten var olan hücrelerin anahtarı bulunduğu için (`"A1"`, `"B7"`...), tablonun
nerede bittiğini bunlardan buluyor ve aralığı oraya kırpıyor. Altı yükleme yolunun hepsi buradan
geçiyor: İş Emri, Malzeme Listesi, İş Merkezleri, Üretim Personeli, Takım Excel, Karbür Excel.

Ölçüm (7.684 dolu satır, `A1:Z1048576` beyan): eski yol ~24.500 ms ve çökme → yeni yol 33-55 ms.

**Çözerken iki kez yanlış yapıldı — asıl ders bu:**

1. İlk deneme, dosyayı **reddeden** bir kontrol koydu ("çok fazla satır var, dosya bozuk
   olabilir"). Yanlış: kullanıcının işi yüklemek, programın işi çöpü ayıklamak. Donmayı
   engellemek için yüklemeyi imkânsız hale getirmek çözüm değil, ikinci bir hata.
2. İkinci deneme eşiği "değeri olan en alttaki satır" yaptı. Yine reddetti, çünkü dosyada
   gerçekten `T1048576`'da bir değer vardı.

Doğrusu üçüncüsüydü: yukarıdan aşağı ilerleyip **tablonun bittiği yeri** bulmak (arka arkaya
`XLSX_BOSLUK_TOLERANSI` = 200 boş satır görülünce tablo bitmiştir), altında kalan başıboş
hücreleri yok saymak, ve **yok saydığını kullanıcıya söylemek**. Artık hiçbir dosya reddedilmiyor.

**Genel dersler.**

- **Bir kütüphaneye "bana veriyi ver" derken, onun "veri" tanımının seninkiyle aynı olduğunu
  varsayma.** `sheet_to_json` için veri = beyan edilen aralık; insan için veri = dolu hücreler.
- **Savunma amaçlı kontrol, kullanıcıyı işini yapamaz hale getiriyorsa savunma değil yeni bir
  hatadır.** Reddetmek yerine ayıkla, ayıkladığını da söyle.
- **"Dün çalışıyordu" ifadesini ciddiye al ama otomatik olarak son değişikliği suçlama.** Burada
  git ile o satırın aylardır değişmediği doğrulandı; suçlu girdi dosyasıydı. Tersi de mümkündü —
  önce bak, sonra karar ver.
- **Hata mesajı gerçek sebebi söylemeli.** Bu ekranlar her hataya "Dosya okunamadı, .xlsx
  formatında olduğundan emin olun" diyordu; dosya formatı gayet iyiydi, mesaj yanlış yere
  baktırıyordu. Artık altta gerçek sebep de yazıyor.
- **Uzun süren işin sonucu görünür olmalı.** Yükleme başarısı ekranın altındaki küçük toast'ta
  kayboluyordu; artık ortada, büyük, yeşil kenarlıklı bir onay (`bigToastOk`).
