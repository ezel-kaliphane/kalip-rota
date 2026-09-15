# Hata Notları

Canlıda karşılaşılan gerçek hatalar, sebepleri ve alınan dersler. Amaç aynı sınıftan bir
hatayı ikinci kez yazmamak. En yeni üstte.

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
