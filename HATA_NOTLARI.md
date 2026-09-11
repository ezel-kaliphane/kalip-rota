# Hata Notları

Canlıda karşılaşılan gerçek hatalar, sebepleri ve alınan dersler. Amaç aynı sınıftan bir
hatayı ikinci kez yazmamak. En yeni üstte.

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
