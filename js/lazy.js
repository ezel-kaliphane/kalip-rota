/* ===================== GEÇ YÜKLENEN KÜTÜPHANELER =====================
   xlsx (Excel) ve Chart.js eskiden index.html'de <script> ile HER AÇILIŞTA indiriliyordu:
     xlsx.full.min.js  ~308 KB (gzip)   → sadece Excel yükleme/dışa aktarma sırasında gerekli
     chart.umd.min.js   ~69 KB (gzip)   → sadece Analiz sekmesinde gerekli
   Yani atölyedeki bir operatör, telefonundan sadece "başla/bitir" yapmak için girdiğinde de
   ~377 KB'lık, hiç kullanmayacağı JS'i indirip ayrıştırıyordu. İndirme mobil veride zaten
   yavaş; ayrıştırma (parse/compile) maliyeti de telefon CPU'sunda ağır.

   Artık ikisi de ilk gerçekten ihtiyaç duyulduğu anda yükleniyor. Yükleme bir kez yapılır,
   sonuç Promise olarak saklandığı için üst üste gelen çağrılar aynı yüklemeyi bekler. */

const LAZY_LIB_URLS = {
  xlsx:  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  chart: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.0/chart.umd.min.js',
  jsqr:  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
};

const _lazyScripts = {};
function loadScriptOnce(url){
  if(_lazyScripts[url]) return _lazyScripts[url];
  _lazyScripts[url] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    /* Başarısız yüklemeyi önbellekten düşürüyoruz — yoksa geçici bir ağ hatası, kullanıcı
       tekrar denediğinde de kalıcı hata olarak kalırdı. */
    s.onerror = () => { delete _lazyScripts[url]; reject(new Error('Kütüphane yüklenemedi: ' + url)); };
    document.head.appendChild(s);
  });
  return _lazyScripts[url];
}

/* Excel işlemleri bunu bekler. Ağ yoksa kullanıcıya anlaşılır bir mesaj verip false döner —
   çağıran taraf işleme hiç başlamaz. */
async function ensureXLSX(){
  if(typeof XLSX !== 'undefined') return true;
  try {
    await loadScriptOnce(LAZY_LIB_URLS.xlsx);
    return typeof XLSX !== 'undefined';
  } catch(e){
    toast('Excel kütüphanesi yüklenemedi — internet bağlantını kontrol et');
    return false;
  }
}

/* Analiz grafikleri bunu bekler. initAnalizCharts zaten `typeof Chart === 'undefined'` ise
   sessizce çıkıyor; yükleme bitince bir render daha tetikleyip grafikler çizilsin diye
   safeRender'a haber veriyoruz. */
let _chartLoadStarted = false;
function ensureChartLoaded(){
  if(typeof Chart !== 'undefined' || _chartLoadStarted) return;
  _chartLoadStarted = true;
  loadScriptOnce(LAZY_LIB_URLS.chart)
    .then(() => { if(typeof render === 'function') render(); })
    .catch(() => { _chartLoadStarted = false; toast('Grafik kütüphanesi yüklenemedi — internet bağlantını kontrol et'); });
}

/* QR okuma yedeği (jsQR), yalnızca tarayıcıda yerli BarcodeDetector YOKSA gerekiyor —
   ör. iOS Safari, masaüstü Firefox. Android Chrome/Edge bunu hiç indirmez.
   Bekleyen yok: tarama döngüsü her karede `typeof jsQR` kontrol ediyor, kütüphane gelince
   kendiliğinden çözmeye başlıyor (bkz. js/qr.js qrDetectFrame). */
function ensureJsQR(){
  if(typeof jsQR === 'function') return;
  loadScriptOnce(LAZY_LIB_URLS.jsqr).catch(() => {
    toast('QR çözücü yüklenemedi — iş emri numarasını elle yazabilirsin');
  });
}
