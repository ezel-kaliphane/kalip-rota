/* ===================== QR KOD OKUYUCU =====================
   Operatörler "İş Emri No" alanına elle yazmak yerine, iş kağıdı üzerindeki QR kodu kamerayla
   okutabilsin diye. #app her render()'da baştan innerHTML olarak yeniden yazıldığından (bkz.
   js/bubble.js'teki aynı sorun) kamera akışını (getUserMedia stream + <video>) orada tutmak
   imkansız — periyodik/canlı her yeniden çizimde video elemanı yok olup akış kesilir, kamera
   izni yeniden istenir, tarama sürekli baştan başlardı. Bu yüzden bubble-root ile aynı mantıkla
   #app'in DIŞINDA kendi kalıcı kökünde (index.html'deki #qr-root) ve tamamen imperatif
   (innerHTML string render'ına hiç girmeden) yönetiliyor.
   Okuma için önce tarayıcının yerli BarcodeDetector API'si denenir (Android Chrome/Edge); yoksa
   (ör. iOS Safari, masaüstü Firefox) index.html'de CDN'den yüklenen jsQR ile canvas üzerinden
   çözülür — ikisi de yoksa (jsQR CDN'i engellenmiş/erişilemez olabilir) buton sessizce devre dışı
   kalmaz, sadece tarama hiç sonuç bulamaz; operatör her zaman elle yazmaya devam edebilir.
*/
let qrScan = null; // { stream, video, canvas, ctx, detector, rafId, onResult, active }

function qrScannerSupported(){
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// onResult(text) — QR başarıyla okununca ÇAĞRILIR ve tarayıcı otomatik kapanır. İptal edilirse hiç çağrılmaz.
function openQrScanner(onResult){
  if(!qrScannerSupported()){ toast('Bu cihaz/tarayıcı kamera erişimini desteklemiyor.'); return; }
  const root = document.getElementById('qr-root');
  if(!root) return;
  closeQrScanner(); // önceden açık kalmış bir tarama varsa (olmamalı ama) önce kapat

  const overlay = document.createElement('div');
  overlay.className = 'qr-scan-overlay';
  overlay.innerHTML = `
    <div class="qr-scan-box">
      <div class="qr-scan-head"><span>${ico('camera',16)} QR Kod Okut</span><button type="button" class="btn-ghost qr-scan-close" style="padding:4px 8px">${ico('x',16)}</button></div>
      <video class="qr-scan-video" playsinline muted autoplay></video>
      <div class="qr-scan-hint">İş kağıdındaki QR kodu kareye hizala — otomatik algılanır</div>
    </div>`;
  root.appendChild(overlay);
  const video = overlay.querySelector('.qr-scan-video');
  overlay.querySelector('.qr-scan-close').onclick = ()=>closeQrScanner();

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  qrScan = { onResult, video, overlay, active:true, prevOverflow };

  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal:'environment' } }, audio:false })
    .then(stream=>{
      if(!qrScan || !qrScan.active){ stream.getTracks().forEach(t=>t.stop()); return; } // taranırken arada kapatıldıysa
      qrScan.stream = stream;
      video.srcObject = stream;
      video.play().catch(()=>{});
      startQrDetectLoop();
    })
    .catch(err=>{
      console.warn('Kamera açılamadı:', err);
      toast('Kamera açılamadı — tarayıcıdan izin verildiğinden emin ol.');
      closeQrScanner();
    });
}

function startQrDetectLoop(){
  if(!qrScan) return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  qrScan.canvas = canvas; qrScan.ctx = ctx;
  if('BarcodeDetector' in window){
    try { qrScan.detector = new BarcodeDetector({ formats:['qr_code'] }); } catch(e){ qrScan.detector = null; }
  }
  let lastCheck = 0, busy = false;
  const tick = (ts)=>{
    if(!qrScan || !qrScan.active) return;
    // Saniyede ~5-6 kare taraması yeterli ve fazla ısıtmıyor/pil yakmıyor; native detector zaten
    // async olduğu için (busy) bir önceki kare bitmeden yenisini başlatmıyoruz.
    if(!busy && qrScan.video.readyState>=2 && ts-lastCheck>170){
      lastCheck = ts; busy = true;
      qrDetectFrame(()=>{ busy = false; });
    }
    qrScan.rafId = requestAnimationFrame(tick);
  };
  qrScan.rafId = requestAnimationFrame(tick);
}

function qrDetectFrame(done){
  const { video, canvas, ctx, detector } = qrScan;
  if(!video.videoWidth){ done(); return; }
  if(detector){
    detector.detect(video).then(codes=>{
      if(codes && codes.length>0 && codes[0].rawValue) qrHandleDecoded(codes[0].rawValue);
      done();
    }).catch(()=>done());
    return;
  }
  // Yerel BarcodeDetector yoksa (ör. iOS Safari) jsQR ile canvas üzerinden çöz.
  if(typeof jsQR !== 'function'){ done(); return; }
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imgData.data, imgData.width, imgData.height);
  if(result && result.data) qrHandleDecoded(result.data);
  done();
}

function qrHandleDecoded(text){
  if(!qrScan || !qrScan.active) return;
  const value = String(text||'').trim();
  if(!value) return;
  const cb = qrScan.onResult;
  closeQrScanner();
  if(cb) cb(value);
}

function closeQrScanner(){
  if(!qrScan) return;
  qrScan.active = false;
  if(qrScan.rafId) cancelAnimationFrame(qrScan.rafId);
  if(qrScan.stream) qrScan.stream.getTracks().forEach(t=>t.stop());
  document.body.style.overflow = qrScan.prevOverflow || '';
  const root = document.getElementById('qr-root');
  if(root) root.innerHTML = '';
  qrScan = null;
}
