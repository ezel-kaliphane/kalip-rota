/* ===================== AKTİF İŞ BALONCUĞU (sürüklenebilir) =====================
   Eskiden "şu an ne yapıyorsun" bilgisi altta sabit bir şerit (.active-strip) olarak duruyordu ve
   bazı ekranlarda (ör. Tadilat aktif ekranındaki 3 butonlu sütun) o ekranın kendi fixed
   butonlarının üzerine biniyordu. Artık mobil şebeke operatörü uygulamalarındaki gibi yuvarlak,
   sürüklenebilir bir baloncuk — operatör dikeyde istediği yere taşıyabiliyor, yatayda ise
   baloncuk her zaman en yakın kenara (sol/sağ) yapışıyor, konumu localStorage'da kalıcı olarak
   saklanıyor. Tıklama (sürüklemeden) ilgili işin detayını açar; sürükleme sırasında otomatik
   yeniden çizimler durur (bkz. isUserInteracting). */
let activeBubblePos = null; // {x,y} — baloncuğun sol-üst köşesinin ekran koordinatı (px)
let bubbleDragging = false; // sürükleme sırasında true — otomatik render'ları engeller
const BUBBLE_SIZE = 64;
function loadBubblePos(){
  try{
    const raw = localStorage.getItem('rt_bubble_pos');
    if(raw){ const p = JSON.parse(raw); if(p && typeof p.x==='number' && typeof p.y==='number') activeBubblePos = snapEdge(p.x, p.y); }
  }catch(e){}
}
function saveBubblePos(){
  try{ localStorage.setItem('rt_bubble_pos', JSON.stringify(activeBubblePos)); }catch(e){}
}
function clampBubble(x,y){
  const margin = 6;
  const maxX = Math.max(margin, window.innerWidth - BUBBLE_SIZE - margin);
  const maxY = Math.max(margin, window.innerHeight - BUBBLE_SIZE - margin);
  return { x: Math.min(Math.max(x, margin), maxX), y: Math.min(Math.max(y, margin), maxY) };
}
// Baloncuk yatayda SADECE ekranın sol ya da sağ kenarına yapışabilir (mobil şebeke
// operatörü uygulamalarındaki "chat head" davranışı) — ekranın ortasında asılı kalamaz.
// Dikeyde operatör istediği yere bırakabilir, sadece üst/alt sınırlar içinde kalır.
function snapEdge(x,y){
  const margin = 6;
  const vw = window.innerWidth;
  const leftX = margin;
  const rightX = Math.max(margin, vw - BUBBLE_SIZE - margin);
  const chosenX = (x + BUBBLE_SIZE/2) < vw/2 ? leftX : rightX;
  return clampBubble(chosenX, y);
}
function defaultBubblePos(){
  // Varsayılan: sağ kenar, üst başlığın hemen altı — alt gezinme/aksiyon butonlarıyla
  // çakışmayan en güvenli bölge. Operatör isterse buradan istediği yere sürükler.
  return snapEdge(window.innerWidth, 84);
}
// Baloncuğun kenarlığı işin durumuna göre renk alır: çalışıyor / duruşta / tadilat / gün sonu.
function activeBubbleColor(e){
  if(e.status!=='duruş') return 'var(--success)';
  if(e.duruşNedeni===GUN_SONU_REASON) return 'var(--gunsonu)';
  if(isTadilatRelated(e.duruşNedeni)) return 'var(--tadilat-info)';
  return 'var(--warn)';
}
// Hangi işin baloncukta gösterileceğine karar verir: önce gerçek bir üretim işi (devam/duruş),
// yoksa (kaynaksız/doğrudan başlatılmış) bir tadilat oturumu. İkisi de yoksa null.
function currentBubbleTarget(){
  if(!session || session.isAdmin) return null;
  const mine = (typeof myActiveEntries==='function') ? myActiveEntries() : [];
  if(mine && mine.length>0) return { kind:'entry', entries: mine };
  const tSess = (typeof myActiveTadilatSession==='function') ? myActiveTadilatSession() : null;
  if(tSess) return { kind:'tadilat', sess: tSess };
  return null;
}
function renderBubble(){
  const target = currentBubbleTarget();
  const root = document.getElementById('bubble-root');
  if(!root) return;
  if(!target){ root.innerHTML = ''; return; }

  if(!activeBubblePos) activeBubblePos = defaultBubblePos();
  const pos = clampBubble(activeBubblePos.x, activeBubblePos.y);

  let mins, color, badgeCount, kind, entryId, groupId, titleText;
  if(target.kind==='entry'){
    const e = target.entries[0];
    const ms = e.status==='duruş' ? (e.duruşTs ? nowTick-e.duruşTs : 0) : nowTick-e.startTs;
    mins = Math.max(0, Math.floor(ms/60000));
    color = activeBubbleColor(e);
    badgeCount = target.entries.length-1;
    kind = 'entry'; entryId = e.id; groupId = e.groupId||'';
    titleText = `${e.talepNo || e.isEmriNo} · ${e.makine||''}`;
  } else {
    const { tadilat: t, operasyon: op } = target.sess;
    const ms = op.status==='duruş' ? (op.duruşTs ? nowTick-op.duruşTs : 0) : nowTick-op.baslamaTs;
    mins = Math.max(0, Math.floor(ms/60000));
    color = op.status==='duruş' ? (isTadilatRelated(op.duruşNedeni) ? 'var(--tadilat-info)' : 'var(--warn)') : 'var(--tadilat-info)';
    badgeCount = 0;
    kind = 'tadilat';
    titleText = `Tadilat · ${t.uKodu||''}`;
  }

  // DÜZELTME (dönen halkanın "takılıp en başa atlaması"): Eskiden bu fonksiyon her çağrıldığında
  // (saniyede bir) baloncuğu tamamen yeni bir HTML string olarak üretip DOM'a basıyordu — yani
  // eleman saniyede bir yok olup yeniden doğuyordu, bu da üzerindeki CSS animasyonunu her seferinde
  // 0. kareden yeniden başlatıyordu (2.6 sn'lik turu asla tamamlayamıyordu). Artık eleman SADECE
  // yoksa oluşturuluyor; varsa üzerindeki animasyona hiç dokunmadan sadece metin/renk/konum gibi
  // özellikleri güncelliyoruz — animasyon tarayıcının kendi zaman çizelgesinde gerçekten kesintisiz akıyor.
  let el = document.getElementById('active-bubble');
  if(!el){
    el = document.createElement('div');
    el.className = 'active-bubble';
    el.id = 'active-bubble';
    el.style.left = pos.x+'px';
    el.style.top = pos.y+'px';
    root.appendChild(el);
  } else if(!bubbleDragging){
    // Sürükleme sırasında konumu zaten pointermove doğrudan güncelliyor — üstüne yazmayalım.
    el.style.left = pos.x+'px';
    el.style.top = pos.y+'px';
  }
  el.style.setProperty('--bc', color);
  el.title = titleText;
  el.setAttribute('data-kind', kind);
  if(kind==='entry'){ el.setAttribute('data-entry-id', entryId); el.setAttribute('data-group-id', groupId); }
  else { el.removeAttribute('data-entry-id'); el.removeAttribute('data-group-id'); }
  const badgeHtml = badgeCount>0 ? `<span class="bubble-badge">+${badgeCount}</span>` : '';
  el.innerHTML = `${badgeHtml}<div class="bubble-time">${mins}<span class="bubble-unit"> dk</span></div>`;
}
function goToActiveBubbleTarget(el){
  const kind = el.getAttribute('data-kind');
  if(kind==='tadilat'){ setView('tadilat'); return; }
  const gid = el.getAttribute('data-group-id');
  const eid = el.getAttribute('data-entry-id');
  if(gid) openGroupDetail(gid); else if(eid) openActiveDetail(eid);
}
// Sürükleme mantığı: document üzerinde TEK SEFER kurulur (bkz. DOMContentLoaded). Baloncuk artık
// kalıcı bir elemana sahip olduğu için aslında sürekli aynı node ile çalışıyoruz, ama delegasyon
// yine de en sağlamı — hangi tıklamanın baloncuğa ait olduğunu her zaman doğru yakalıyor.
// THRESH'in altında kalan hareket dokunma (tıklama) sayılır, üstündeki hareket sürükleme sayılır
// ve tıklamayı iptal eder.
function setupBubbleDrag(){
  let dragEl=null, pointerId=null, startX=0, startY=0, origX=0, origY=0, moved=false;
  const THRESH = 8;
  document.addEventListener('pointerdown', (e)=>{
    const el = e.target.closest('.active-bubble');
    if(!el) return;
    dragEl = el; pointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    origX = parseFloat(el.style.left)||0; origY = parseFloat(el.style.top)||0;
    moved = false; bubbleDragging = true;
    try{ el.setPointerCapture(pointerId); }catch(err){}
  }, true);
  document.addEventListener('pointermove', (e)=>{
    if(!dragEl || e.pointerId!==pointerId) return;
    const dx = e.clientX-startX, dy = e.clientY-startY;
    if(!moved && (Math.abs(dx)>THRESH || Math.abs(dy)>THRESH)) moved = true;
    if(moved){
      const c = clampBubble(origX+dx, origY+dy);
      dragEl.style.left = c.x+'px';
      dragEl.style.top = c.y+'px';
    }
  });
  const endDrag = (e)=>{
    if(!dragEl || (pointerId!=null && e.pointerId!==pointerId)) return;
    if(moved){
      const el = dragEl;
      const snapped = snapEdge(parseFloat(el.style.left), parseFloat(el.style.top));
      activeBubblePos = snapped;
      saveBubblePos();
      el.classList.add('bubble-snap');
      el.style.left = snapped.x+'px';
      el.style.top = snapped.y+'px';
      setTimeout(()=>{ el.classList.remove('bubble-snap'); }, 260);
    } else {
      goToActiveBubbleTarget(dragEl);
    }
    bubbleDragging = false; dragEl = null; pointerId = null; moved = false;
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', ()=>{ bubbleDragging=false; dragEl=null; pointerId=null; moved=false; });
  window.addEventListener('resize', ()=>{ if(activeBubblePos) activeBubblePos = snapEdge(activeBubblePos.x, activeBubblePos.y); });
}
