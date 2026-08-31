/* ===================== ANA RENDER ===================== */
function render(){
  const app = document.getElementById('app');
  // DÜZELTME (arka plan kayıyor sorunu): Duruş modalı sabit konumlu (position:fixed) bir
  // overlay olsa da, ALTINDAKİ SAYFA hâlâ kaydırılabilir durumda kalıyordu — bu yüzden
  // modal üzerindeki bazı dokunuşlar (özellikle üstteki tutamaç/boşluk bölgesi) mobilde
  // ARKA PLANI kaydırabiliyordu (fixed overlay'in üstünden "sızan" dokunma kaydırması,
  // bilinen bir mobil-web davranışı). Artık modal açıkken sayfanın kendisi tamamen
  // kilitleniyor — kaydıracak bir şey kalmıyor.
  const shouldLockScroll = durusOpen || tadilatDurusPickerOpen;
  document.body.style.overflow = shouldLockScroll ? 'hidden' : '';

  // Periyodik (saniyelik) yeniden çizim, açık bir modal veya tablo varsa kaydırma
  // konumunu sıfırlamasın diye önce mevcut scroll konumlarını kaydediyoruz.
  const scrollSel = ['.modal-body', '.table-wrap', '.body-pad', '.completed-wrap', '.matrix-wrap', '.settings-wrap', '.lock-screen', '.durus-sheet'];
  const savedScroll = scrollSel.map(sel => { const el = document.querySelector(sel); return el ? el.scrollTop : null; });
  // DÜZELTME: .root-mobile'ın yüksekliği sabit değil (min-height:100vh) — yani .lock-screen'in
  // kendi iç scroll'u (overflow-y:auto) aslında hiç devreye girmiyor, içerik viewport'tan
  // uzun olduğunda kaydırma SAYFA (window) seviyesinde oluyor. Yukarıdaki liste bunu hiç
  // kapsamıyordu — canlı sayaç her saniye tetiklediği render'da sayfa scroll'u telafi
  // edilmiyordu (özellikle Duruş panelinde, "onayla" butonuna ulaşmak için kaydırınca bir
  // sonraki tik'te tepeye sıçrama sorununun asıl kaynağı buydu).
  const savedWinScroll = window.scrollY;

  // Odak koruması: bir input/textarea'da yazarken herhangi bir yeniden çizim
  // o kutuyu sıfırdan oluşturup imleci/odağı kaybettirmesin diye, hangi kutuda
  // olduğumuzu ve imlecin nerede durduğunu kaydedip render sonrası geri koyuyoruz.
  const activeEl = document.activeElement;
  let focusId = null, selStart = null, selEnd = null;
  if(activeEl && (activeEl.tagName==='INPUT' || activeEl.tagName==='TEXTAREA') && activeEl.id){
    focusId = activeEl.id;
    try { selStart = activeEl.selectionStart; selEnd = activeEl.selectionEnd; } catch(e){}
  }

  if(!session){ app.innerHTML = renderLogin(); renderBubble(); return; }
  app.innerHTML = session.isAdmin ? renderAdmin() : renderOperator();
  renderBubble(); // baloncuk #app'ten bağımsız kendi kökünde — bkz. js/bubble.js
  scrollSel.forEach((sel,i) => { if(savedScroll[i]!=null){ const el = document.querySelector(sel); if(el) el.scrollTop = savedScroll[i]; } });
  if(savedWinScroll>0) window.scrollTo(0, savedWinScroll);

  if(focusId){
    const el = document.getElementById(focusId);
    if(el){
      el.focus();
      if(selStart!=null && el.setSelectionRange){ try{ el.setSelectionRange(selStart, selEnd); }catch(e){} }
    }
  }

  if(session && session.isAdmin && view==='analiz'){ initAnalizCharts(lastAnalizData || computeAnalizData(analizFrom, analizTo, analizAtolyeFilter)); }
}
let analizTickCounter = 0;
// Firebase'den arka planda gelen HERHANGİ bir güncelleme (başka bir kullanıcının işlemi bile
// olsa) tüm ekranı yeniden çiziyordu — bu da o an açık olan bir <select>/<input> dropdown'ını ya
// da yazılmakta olan bir form alanını anında kapatıp sıfırlıyordu. Kullanıcı bir alanla aktif
// olarak uğraşırken (odaklanmış input/select/textarea varsa, ya da bilinen "düzenleme" durumları
// açıksa) otomatik render'ları erteliyoruz; odak/etkileşim bitince bir sonraki tetiklemede
// (periyodik tik ya da yeni bir Firebase güncellemesi) ekran zaten güncel hale gelir.
let lastPointerDownAt = 0;
document.addEventListener('pointerdown', ()=>{ lastPointerDownAt = Date.now(); }, true);
function isUserInteracting(){
  if(bubbleDragging) return true; // baloncuk sürüklenirken tam render, DOM'u sıfırlayıp sürüklemeyi keser
  if(editingActiveId) return true;
  // DÜZELTME: Eskiden sadece "Diğer" yazarken meşgul sayılıyordu — panel açıkken (neden
  // seçerken, aşağı kaydırıp onay butonuna ulaşmaya çalışırken) ATÖLYEDEKİ BAŞKA BİR
  // OPERATÖRÜN herhangi bir işlemi (Firebase güncellemesi geldiğinde) ya da her saniye
  // tetiklenen canlı sayaç, ekranı sessizce yeniden çizip tam o anki kaydırma konumunu
  // bozabiliyordu — özellikle "aşağı kaydırırken tepeye sıçrama" şikayetinin en olası
  // kaynağı buydu. Artık panel TAMAMEN AÇIKKEN (neden seçilmiş olsun olmasın) hiçbir
  // arka plan yeniden çizimi araya girmiyor.
  // EK DÜZELTME: Bu koruma eskiden sadece normal iş emri duruş panelini (durusOpen)
  // kapsıyordu — Tadilat modülünün AYNI görünen duruş nedeni paneli ayrı bir bayrak
  // (tadilatDurusPickerOpen) kullanıyor ve buraya hiç eklenmemişti. Sonuç: Tadilat'ta bu
  // panel açıkken, özellikle operatörün aktif bir tadilat oturumu varsa (aşağıdaki
  // renderLiveBits'teki view==='tadilat' dalı) her saniyelik tik hâlâ tam render tetikliyor
  // ve panel listesindeki kaydırma konumu sürekli tepeye sıfırlanıyordu — "aşağı kaydırınca
  // tepeye sıçrama" şikayeti aslında bu ikinci (Tadilat) yoldan hâlâ yaşanıyordu.
  if(durusOpen || tadilatDurusPickerOpen) return true;
  if(sendMsgOpen) return true;
  if(tadilatMakineSecimId) return true;
  const ae = document.activeElement;
  if(ae && ['INPUT','TEXTAREA','SELECT'].includes(ae.tagName)) return true;
  // Bir düğmeye tıklandığının hemen ardından (kısa bir "koruma penceresi" içinde) arka plandaki
  // otomatik yeniden çizimi erteliyoruz — yoksa tam o anda DOM değişip tıklamayı "yutabiliyor",
  // kullanıcı iki kere tıklamak zorunda kalıyordu.
  if(Date.now() - lastPointerDownAt < 500) return true;
  return false;
}
let pendingSafeRender = false;
function safeRender(){
  if(isUserInteracting()){ pendingSafeRender = true; return; }
  pendingSafeRender = false;
  render();
}
function renderLiveBits(){
  // Sadece kilit ekranındaki / matristeki canlı sayaçları güncellemek için tam render yeterli (veri seti küçük).
  // Ama bir form açıkken (düzenleme, duruş nedeni yazma, serbest mesaj, aktif input/select) tam render
  // odağı (focus) kaybettiriyor / açık dropdown'ı kapatıyor — o an atla.
  if(isUserInteracting()) return;
  // Baloncuğun dakika sayacı bağımsız güncelleniyor — aşağıdaki koşul sadece belirli ekranlarda
  // tam render tetikler, ama baloncuk her ekranda görünür olduğu için süresi hep taze kalmalı.
  // renderBubble() elemanı yeniden OLUŞTURMADIĞI için (bkz. js/bubble.js) bunun her saniye
  // çağrılması animasyonu bozmuyor, sadece rakamı güncelliyor.
  if(!bubbleDragging) renderBubble();
  if(activeDetailId || activeGroupId || (session && !session.isAdmin && (view==='list' || (view==='tadilat' && myActiveTadilatSession()))) || (session && session.isAdmin && (view==='matrix' || (view==='tadilatYonetim' && tadilatSubTab==='canli')))){ render(); return; }
  // Analiz'deki sayılar artık duraklamış işler için canlı hesaplanıyor, ama grafikleri (Chart.js)
  // her saniye yeniden çizmek titremeye sebep olur — o yüzden burayı daha seyrek (15 sn) yeniliyoruz.
  if(session && session.isAdmin && view==='analiz'){
    analizTickCounter++;
    if(analizTickCounter>=15){ analizTickCounter=0; render(); }
  }
}

/* ===================== BAŞLAT ===================== */
window.addEventListener('DOMContentLoaded', ()=>{
  document.documentElement.className = 'theme-'+resolvedTheme();
  try{ window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', ()=>{ if(theme==='system'){ document.documentElement.className='theme-'+resolvedTheme(); render(); } }); }catch(e){}
  if(!fbConfigured()){
    document.getElementById('app').innerHTML = `<div class="root-mobile theme-${resolvedTheme()}"><div class="auth-wrap"><div class="error-text" style="max-width:400px;margin:0 auto">Firebase databaseURL henüz girilmemiş. Lütfen KURULUM_BULUT.md dosyasındaki adımları izleyip bu HTML dosyasının başındaki FIREBASE_CONFIG içine databaseURL'i yapıştırın.</div></div></div>`;
    return;
  }
  initFirebase();
  loadBubblePos();
  setupBubbleDrag();
  render();

  // K2 (klavye/duruş modalı): --kb, o an açık olan sanal klavyenin yüksekliğini tutan bir CSS
  // değişkeni. Sadece bunu yazıyor — hiçbir DOM'u yeniden çizmiyor, render()'ın scroll/focus
  // koruma mantığıyla hiç kesişmiyor. iOS'ta klavye layout viewport'unu küçültmediği için
  // (sadece görsel viewport'u kaydırır), position:fixed öğeler bunu otomatik hesaba katmaz —
  // bu değişken, .durus-modal-overlay/.durus-modal-panel'in klavyenin üstünde kalmasını sağlıyor.
  if(window.visualViewport){
    const vv = window.visualViewport;
    const syncKb = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', kb + 'px');
    };
    vv.addEventListener('resize', syncKb);
    vv.addEventListener('scroll', syncKb);
    syncKb();
  }

  // Giriş ekranındayken, sayfanın herhangi bir yerinde (bir kutuya odaklanmış
  // olmasan bile) Enter'a basınca giriş yapmayı dener.
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Enter' && !session){ doLogin(); }
  });
});
