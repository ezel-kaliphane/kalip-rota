/* ===================== YARDIMCI FONKSİYONLAR ===================== */
const uid = () => Math.random().toString(36).slice(2,10);
/* Şifreler artık düz metin yerine SHA-256 hash olarak saklanıyor (bkz. doLogin/changePassword/
   addOperator). Tarayıcının kendi Web Crypto API'si kullanılıyor, ek kütüphane gerekmiyor.
   Eski (henüz hash'lenmemiş) kayıtlarla geriye dönük uyumluluk için doLogin, düz metin eşleşmesi
   olursa girişe izin verip o an sessizce hash'e yükseltiyor — ayrı bir "şifre sıfırlama" göçü
   gerekmiyor, her operatör bir sonraki girişinde otomatik olarak güvenli hale geliyor. */
async function sha256Hex(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
const esc = s => (s==null?"":String(s)).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// onclick="fn('DEĞER')" gibi, HTML ÖZNİTELİĞİ İÇİNDEKİ bir JS STRING'ine değer gömerken kullanılır.
// DÜZELTME: Buralarda tek başına esc() kullanmak GÜVENLİ DEĞİL — esc() tek tırnağı &#39; yapar, ama
// tarayıcı öznitelik değerindeki karakter referanslarını JS'i derlemeden ÖNCE çözer, yani &#39;
// tekrar ' olur ve JS string'i erken kapanır: resimBul('U123'A') → SyntaxError, buton ölür
// (kötü niyetli bir değerle kod enjeksiyonu da mümkün olur). Doğrusu: ÖNCE JS için kaçır
// (ters bölü + tek tırnak), SONRA HTML için kaçır. Tarayıcı HTML kaçışını çözünce geriye
// geçerli bir JS kaçışı (\') kalır.
const escJs = s => esc(String(s==null?"":s).replace(/\\/g,"\\\\").replace(/'/g,"\\'"));
const fmtDT = ts => new Date(ts).toLocaleString("tr-TR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
const fmtDur = ms => { const m=Math.round(ms/60000); return m<60?`${m} dk`:`${Math.floor(m/60)} sa ${m%60} dk`; };
const fmtElapsed = ms => { const s=Math.max(0,Math.floor(ms/1000)); const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; const p=n=>String(n).padStart(2,"0"); return h>0?`${p(h)}:${p(m)}:${p(sec)}`:`${p(m)}:${p(sec)}`; };
// ÖNEMLİ DÜZELTME: Eskiden toISOString() kullanıyordu — bu HER ZAMAN UTC döndürür. Türkiye
// UTC+3 olduğu için, yerel saatle 00:00-03:00 arası başlayan işler yanlışlıkla BİR ÖNCEKİ
// güne yazılıyordu (Analiz'de kaybolma, Gantt'ta görünmeme, "Bugün" filtresinin gece 3'ten
// önce dünü seçmesi gibi sorunlara yol açıyordu). Artık tarayıcının YEREL tarih bileşenleri
// (getFullYear/getMonth/getDate) kullanılıyor — dateKey artık gerçekten "bu yerel gün" demek.
function dateKey(ts){
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function clampDateKey(dk, fromDate, toDate){ return dk<fromDate ? fromDate : (dk>toDate ? toDate : dk); }
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.className='toast show'; clearTimeout(t._t); t._t=setTimeout(()=>t.className='toast',2200); }
function bigToast(msg){ const t=document.getElementById('toast-big'); if(!t) return; t.textContent=msg; t.className='toast-big show'; clearTimeout(t._t); t._t=setTimeout(()=>t.className='toast-big',3800); }
function connDot(){ return `<span class="conn-dot ${connOK?'on':'off'}" title="${connOK?'Buluta bağlı (senkron)':'Bağlantı yok — internet kontrol edin'}"></span>`; }
function save(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } }

/* ===================== DURUM (STATE) ===================== */
let STATE = { operators: {}, entries: {}, messages: {}, validIsEmri: {}, durusReasons: [], tadilatOnHazirIstekler: {}, myPushHistory: {}, pushLogAll: {} };
/* ===================== BİLEŞEN (KOVAN/KARBÜR) AYRIMI =====================
   Bazı malzemelerde kalıp iki farklı yarı mamulden oluşuyor (kovan/sıkma çemberi ve karbür),
   bunlar farklı rotalarda ayrı ayrı işlenip sonra shrink-fit ile birleşiyor. ERP (Canias)
   bu iki yarı mamulü _ZARF (kovan) ve _ELMAS (karbür) ekleriyle ayırıyor; aynı mantığı
   burada da kullanıyoruz ki rotalar birbirine karışmasın. */
const BILESEN_SUFFIX = { ZARF: '_ZARF', ELMAS: '_ELMAS' };
const BILESEN_LABEL = { ZARF: 'Çelik', ELMAS: 'Karbür' };
function baseIsEmriNo(code){
  const s = String(code||'').trim().toUpperCase();
  for(const suf of Object.values(BILESEN_SUFFIX)){ if(s.endsWith(suf)) return s.slice(0, -suf.length); }
  return s;
}
function bilesenOfCode(code){
  const s = String(code||'').trim().toUpperCase();
  for(const key of Object.keys(BILESEN_SUFFIX)){ if(s.endsWith(BILESEN_SUFFIX[key])) return key; }
  return null;
}
function isEmriValid(code){
  if(Object.keys(STATE.validIsEmri||{}).length===0) return true; // liste boşsa doğrulama yapılmaz
  const upper = String(code||'').trim().toUpperCase();
  if(STATE.validIsEmri[upper]) return true;
  const base = baseIsEmriNo(upper);
  return base !== upper && !!STATE.validIsEmri[base];
}
// Girilen İş Emri No (Talep No) için, ERP listesinden eşleşen malzeme kodu/adı bilgisini döner
// (varsa) — operatöre/şefe "bu talep no hangi malzemeye ait" bilgisini anında göstermek için.
function getTalepInfo(code){
  if(!code) return null;
  const upper = String(code||'').trim().toUpperCase();
  let v = STATE.validIsEmri && STATE.validIsEmri[upper];
  if(!v){ const base = baseIsEmriNo(upper); if(base!==upper) v = STATE.validIsEmri && STATE.validIsEmri[base]; }
  return (v && typeof v === 'object') ? v : null;
}
let extraMachines = {}; // admin tarafından sonradan eklenen makineler (Firebase 'machines_extra')
let hiddenMachines = {}; // silinen dahili makineler (Firebase 'machines_hidden')
let fasonMachines = {}; // "Fason / Dışarı Gönderim" olarak işaretlenen makineler (Firebase 'machines_fason')
function allMachines(){ return MACHINE_LIST.filter(m=>!hiddenMachines[m.code]).concat(Object.entries(extraMachines).map(([code,v])=>({code, name:v.name}))); }
// Fason makinede (ör. dışarıya ısıl işleme giden) aynı anda birden fazla parti/iş emri açılabilir;
// "makine meşgul" kısıtı burada uygulanmaz. Ayrıca bu makinelerdeki aktif işler, fasonYetkisi verilen
// operatörlere kim başlatmış olursa olsun görünür ve onlar tarafından kapatılabilir.
function isFasonMachine(makineLabel){
  const code = String(makineLabel||'').split(' · ')[0];
  return !!fasonMachines[code];
}
function toggleMachineFason(code){
  if(!session || !(session.isSuperAdmin || session.isSef)){ toast('Bu işlem için yetkin yok'); return; }
  const yeni = !fasonMachines[code];
  DB.ref('machines_fason/'+code).set(yeni);
  fasonMachines[code] = yeni; render(); // artık canlı dinlenmiyor, yerel kopyayı biz güncelliyoruz
}
function toggleFasonYetkisi(code){
  // DÜZELTME: Komşu fonksiyonların (toggleMachineFason/setMachineAtolye/toggleUserAtolye) hepsinde
  // olan yetki kontrolü burada atlanmıştı — fasonYetkisi, fason makinelerde başkasının işlerini
  // görme/kapatma yetkisi verdiği için bu ciddi bir boşluktu.
  if(!session || !(session.isSuperAdmin || session.isSef)){ toast('Bu işlem için yetkin yok'); return; }
  const op = STATE.operators[code] || {};
  DB.ref('operators/'+code+'/fasonYetkisi').set(!op.fasonYetkisi);
}
// Makineleri "İmalat Atölye" / "Tadilat Atölye" olarak ikiye ayırmak için (Firebase 'machines_atolye').
// Belirtilmemiş makineler varsayılan olarak İmalat Atölye sayılır.
let machineAtolye = {};
function machineAtolyeOf(code){ return machineAtolye[code]==='tadilat' ? 'tadilat' : 'imalat'; }
function setMachineAtolye(code, val){
  if(!session || !(session.isSuperAdmin || session.isSef)){ toast('Bu işlem için yetkin yok'); return; }
  DB.ref('machines_atolye/'+code).set(val);
  machineAtolye[code] = val; render(); // artık canlı dinlenmiyor, yerel kopyayı biz güncelliyoruz
}
// Personeli (hem sıradan operatörleri hem tadilat açabilen yönetici/şef hesaplarını) İmalat/Tadilat
// Atölye'ye ata — artık ikili (ya bu ya o) değil, çoklu seçim: hiçbiri/biri/ikisi de işaretlenebilir
// (0-1-2 durumu). Bir kullanıcının hem Bekleyen listesi hem Yeni Talep formundaki atölye seçeneği
// buradan türetiliyor. Hiçbiri işaretli değilse (ve eski tekil "atolye" alanı da yoksa) varsayılan
// İmalat Atölye sayılır ki kimse yanlışlıkla erişimsiz kalmasın.
function getUserAtolyeler(code){
  const op = STATE.operators[code] || {};
  if(op.isSuperAdmin) return ['imalat','tadilat']; // SuperAdmin her zaman her iki atölyeyi de görür/yönetir
  if(op.atolyeImalat===undefined && op.atolyeTadilat===undefined){
    return op.atolye==='tadilat' ? ['tadilat'] : ['imalat']; // eski tekil alan / hiç ayarlanmamış
  }
  const list = [];
  if(op.atolyeImalat) list.push('imalat');
  if(op.atolyeTadilat) list.push('tadilat');
  return list.length>0 ? list : ['imalat'];
}
function toggleUserAtolye(code, which){
  if(!session || !(session.isSuperAdmin || session.isSef)){ toast('Bu işlem için yetkin yok'); return; }
  const cur = getUserAtolyeler(code);
  const isImalat = cur.includes('imalat'), isTadilat = cur.includes('tadilat');
  DB.ref('operators/'+code).update({
    atolyeImalat: which==='imalat' ? !isImalat : isImalat,
    atolyeTadilat: which==='tadilat' ? !isTadilat : isTadilat
  });
}
/* ===================== MALZEME STOK TAKİBİ (opsiyonel modül) =====================
   Tamamen tek bir anahtarla açılıp kapanabilir (appSettings.stockTrackingEnabled).
   İki tür stok kalemi var:
   - "adet": dikdörtgen/kare gibi sabit ölçülü parçalar — düz adet sayacı (86x100x55 gibi).
   - "boy": Ø'li çubuklar — aynı kod/çapta BİRDEN FAZLA ayrı çubuk (lot) olabilir, her lotun
     kendi kalan boyu var (ör. 2344 Ø18'den 2000mm'lik ve 1500mm'lik iki ayrı çubuk). Tüketirken
     operatör HANGİ çubuktan kesileceğini seçer, kestiği mm'yi girer, o çubuğun boyu düşer.
*/
let appSettings = {};
let stockItems = {};
let stockHareketleri = {};
function stockEnabled(){ return !!appSettings.stockTrackingEnabled; }
function canManageStock(){ return !!(session && (session.isSuperAdmin || session.isSef)); }
function canManageBildirimAyarlari(){
  if(!session) return false;
  if(session.isSuperAdmin) return true;
  const op = STATE.operators[session.username]||{};
  return !!(session.isAdmin && op.permBildirimYonetimi);
}
function toggleStockTracking(){
  if(!canManageStock()) return;
  DB.ref('settings/stockTrackingEnabled').set(!stockEnabled());
}
/* ===================== RESİM/ÇİZİM BULMA (opsiyonel modül) =====================
   Yerel ağdaki resim arama sunucusuna bağımlı olduğu için, sadece sunucu ayaktayken
   ve SuperAdmin tarafından istendiğinde açılabilir bir anahtarla kontrol edilir
   (appSettings.resimBulEnabled). Kapalıyken "${ico('camera',13)} Resim/Çizim Bul" butonları hiçbir
   ekranda görünmez.
*/
function resimBulEnabled(){ return !!appSettings.resimBulEnabled; }
function toggleResimBul(){
  if(!session || !session.isSuperAdmin){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return; }
  DB.ref('settings/resimBulEnabled').set(!resimBulEnabled());
}
/* ===================== UZUN DURUŞ UYARISI (opsiyonel modül) =====================
   Bir iş emri/operasyon, "Gün Sonu" dışındaki bir nedenle appSettings.uzunDurusEsikDk
   dakikadan (varsayılan 30) daha uzun süredir duruşta kalmışsa, admin ekranlarında görsel
   uyarı (Makine Matrisi'nde yanıp sönen çerçeve + üst barda sayaç rozeti) gösterilir.
   "Gün Sonu (Mesai Bitti...)" nedeni hariç tutulur çünkü o zaten beklenen/planlı bir duruştur. */
function uzunDurusUyariEnabled(){ return appSettings.uzunDurusUyariEnabled !== false; } // varsayılan: açık
function uzunDurusEsikMs(){ return (Number(appSettings.uzunDurusEsikDk) || 30) * 60000; }
function toggleUzunDurusUyari(){
  if(!canManageBildirimAyarlari()){ toast('Bu işlem için yetkin yok'); return; }
  DB.ref('settings/uzunDurusUyariEnabled').set(!uzunDurusUyariEnabled());
}
function setUzunDurusEsikDk(v){
  if(!canManageBildirimAyarlari()) return;
  const n = Math.max(1, Math.min(600, parseInt(v,10)||30));
  DB.ref('settings/uzunDurusEsikDk').set(n);
}
/* Sessiz saatler — gece vardiyası olmayan işletmelerde, o saatler arasında uzunDurusUyarisi
   fonksiyonunun (dakikada bir çalışan, en maliyetli sorgu) hiç veri çekmeden atlaması için. */
function sessizSaatlerEnabled(){ return !!appSettings.sessizSaatlerEnabled; } // varsayılan: kapalı
function toggleSessizSaatler(){
  if(!canManageBildirimAyarlari()){ toast('Bu işlem için yetkin yok'); return; }
  DB.ref('settings/sessizSaatlerEnabled').set(!sessizSaatlerEnabled());
}
function setSessizSaat(hangisi, val){ // hangisi: 'Baslangic' | 'Bitis'
  if(!canManageBildirimAyarlari()) return;
  DB.ref('settings/sessizSaat'+hangisi).set(val || null);
}
/* Tadilat tamamlandığında şeflere giden anlık bildirim — aç/kapa. */
function tadilatTamamlandiBildirimEnabled(){ return appSettings.tadilatTamamlandiBildirimEnabled !== false; } // varsayılan: açık
function toggleTadilatTamamlandiBildirim(){
  if(!canManageBildirimAyarlari()){ toast('Bu işlem için yetkin yok'); return; }
  DB.ref('settings/tadilatTamamlandiBildirimEnabled').set(!tadilatTamamlandiBildirimEnabled());
}
/* Gün başında (mesai başlangıcında) hâlâ duruşta olan işler için — Gün Sonu nedeni DAHİL —
   "lütfen makineyi devreye alınız" hatırlatması. Diğer uyarılardan farkı: eşik/süre değil,
   günün belirli bir saatinde (mesai başlangıcı + birkaç dk) TEK SEFER tetikleniyor. */
function gunBasiHatirlaticiEnabled(){ return appSettings.gunBasiHatirlaticiEnabled !== false; } // varsayılan: açık
function toggleGunBasiHatirlatici(){
  if(!canManageBildirimAyarlari()){ toast('Bu işlem için yetkin yok'); return; }
  DB.ref('settings/gunBasiHatirlaticiEnabled').set(!gunBasiHatirlaticiEnabled());
}
function setGunBasiSaat(gunTipi, val){ // gunTipi: 'HaftaIci' | 'Cumartesi' | 'Pazar'
  if(!canManageBildirimAyarlari()) return;
  DB.ref('settings/gunBasiSaat'+gunTipi).set(val || null); // boş bırakılırsa o gün tipinde çalışmaz
}
function uzunDurusluKayitlar(){
  // Normal imalat/tadilat rota kayıtları (entries) + devam eden tadilat operasyonları, birleşik liste.
  if(!uzunDurusUyariEnabled()) return [];
  const esik = uzunDurusEsikMs();
  const sonuc = [];
  entriesArray().forEach(e=>{
    if(e.status==='duruş' && e.duruşTs && e.duruşNedeni!==GUN_SONU_REASON){
      const ms = nowTick - e.duruşTs;
      if(ms>=esik) sonuc.push({ tur:'entry', makine:e.makine, isEmriNo:e.isEmriNo||e.talepNo, operatorName:e.operatorName, operatorUsername:e.operatorUsername, neden:e.duruşNedeni, ms, ref:e });
    }
  });
  tadilatArray().forEach(t=>{
    tadilatOperasyonlarArray(t).forEach(op=>{
      if(op.status==='duruş' && op.duruşTs && op.duruşNedeni!==GUN_SONU_REASON){
        const ms = nowTick - op.duruşTs;
        if(ms>=esik) sonuc.push({ tur:'tadilat', makine:op.makine, isEmriNo:t.uKodu, operatorName:op.operatorName, operatorUsername:op.operatorUsername, neden:op.duruşNedeni, ms, ref:op });
      }
    });
  });
  return sonuc.sort((a,b)=>b.ms-a.ms);
}
let uzunDurusModalOpen = false;
function openUzunDurusModal(){ uzunDurusModalOpen = true; render(); }
function closeUzunDurusModal(){ uzunDurusModalOpen = false; render(); }
function renderUzunDurusModal(){
  const list = uzunDurusluKayitlar();
  return `<div class="modal-overlay" onclick="if(event.target===this) closeUzunDurusModal()">
    <div class="modal-box">
      <div class="modal-header">
        <div><div class="modal-title">${ico('alert',14)} Uzun Süredir Duruşta</div><div class="modal-sub">Eşik: ${uzunDurusEsikMs()/60000} dk ve üzeri</div></div>
        <button class="icon-btn" onclick="closeUzunDurusModal()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        ${list.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:30px 0">Şu an eşiği aşan duruş yok.</div>` : `
        <div class="table-wrap" style="padding:0"><table><thead><tr><th>Makine</th><th>İş Emri</th><th>Operatör</th><th>Neden</th><th>Süre</th>${session.isSuperAdmin?'<th></th>':''}</tr></thead><tbody>
          ${list.map(r=>`<tr><td class="mono" style="color:var(--accent)">${esc((r.makine||'').split(' · ')[0]||'—')}</td><td class="mono">${esc(r.isEmriNo||'—')}</td><td>${esc(r.operatorName||r.operatorUsername||'—')}</td><td style="color:var(--warn)">${esc(r.neden||'—')}</td><td style="font-weight:700;color:var(--danger)">${fmtDur(r.ms)}</td>${session.isSuperAdmin?`<td>${r.tur==='entry'?`<button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="closeUzunDurusModal(); openReportEdit('${escJs(r.ref.id)}')">Düzelt</button>`:''}</td>`:''}</tr>`).join('')}
        </tbody></table></div>
        ${session.isSuperAdmin ? `<div style="font-size:11px;color:var(--text-muted);margin-top:10px">"Düzelt" ile — operatörün kullanıcısına girmeden — bu kaydın durumunu/nedenini/saatlerini değiştirebilirsin (ör. yanlışlıkla farklı bir neden girilmiş bir duruşu "Gün Sonu"na çevirmek gibi). Tadilat operasyonları için bu düzeltme henüz desteklenmiyor.</div>` : ''}`}
      </div>
    </div>
  </div>`;
}
/* ===================== UZUN SÜREDİR DEVAM EDEN UYARISI (opsiyonel modül) =====================
   uzunDurusUyarisi'nin ayna görüntüsü ama TERSİ senaryo için: operatör bir işi/tadilat
   operasyonunu "Bitir" ya da "Duraklat" demeden, status:'devam'da bırakıp gitmiş olabilir (ör.
   eve giderken unutmuş). Bu durum ne uzunDurusluKayitlar()'da (sadece 'duruş' bakıyor) ne de
   Gün Başı Hatırlatıcısı'nda (o da sadece 'duruş' bakıyor) hiç yakalanmıyordu — kayıt sessizce
   günler boyu "aktif çalışıyor" gibi görünüp raporlarda hayali süre biriktirmeye devam ediyordu.
   Eşik kasıtlı olarak duruş uyarısından çok daha yüksek (varsayılan 14 saat, normal bir vardiya +
   tolerans) — 'devam'da 30 dakika gibi kısa bir eşik gerçekten çalışılan işler için sürekli yanlış
   alarm üretirdi. Farklı bir mesaj/eylem gerektirdiği için uzunDurusUyarisi ile BİLEREK ayrı
   tutuluyor (biri "makineyi devreye al" der, bu "hâlâ açık görünüyor, unuttun mu" demeli). */
function uzunDevamEdenUyariEnabled(){ return appSettings.uzunDevamEdenUyariEnabled !== false; } // varsayılan: açık
function uzunDevamEdenEsikMs(){ return (Number(appSettings.uzunDevamEdenEsikSaat) || 14) * 3600000; }
function toggleUzunDevamEdenUyari(){
  if(!canManageBildirimAyarlari()){ toast('Bu işlem için yetkin yok'); return; }
  DB.ref('settings/uzunDevamEdenUyariEnabled').set(!uzunDevamEdenUyariEnabled());
}
function setUzunDevamEdenEsikSaat(v){
  if(!canManageBildirimAyarlari()) return;
  const n = Math.max(1, Math.min(48, parseInt(v,10)||14));
  DB.ref('settings/uzunDevamEdenEsikSaat').set(n);
}
function uzunDevamEdenKayitlar(){
  // Fason (dışarı gönderim) makineleri BİLİNÇLİ olarak dışlanıyor — bir iş fasonda günlerce
  // 'devam' durumunda kalması bug değil, ne kadar süre kaybedildiğini ölçmenin asıl yöntemi.
  // Gerçek veri: FII01/OPRT14'te 78 kayıt, hepsi bu desende — "unutulmuş iş" değil, fason'un
  // doğası. Bu filtre olmadan alarm sürekli gürültü üretir ve gerçek unutulmuş kayıtları gizler.
  if(!uzunDevamEdenUyariEnabled()) return [];
  const esik = uzunDevamEdenEsikMs();
  const sonuc = [];
  entriesArray().forEach(e=>{
    // Ham (nowTick-startTs) yerine NET süre kullanılıyor — yoksa gece boyu doğru şekilde
    // "Gün Sonu" verilmiş (excludedMs'e düşmüş) bir iş, sabah normal devam ediyor olsa bile
    // ham geçen süre eşiği aştığı için yanlışlıkla "unutulmuş" diye işaretlenirdi (bkz.
    // entryDurationBreakdown — Analiz'de zaten kullanılan aynı net hesap).
    if(e.status==='devam' && e.startTs && !isFasonMachine(e.makine)){
      const ms = entryDurationBreakdown(e).netMs;
      if(ms>=esik) sonuc.push({ tur:'entry', makine:e.makine, isEmriNo:e.isEmriNo||e.talepNo, operatorName:e.operatorName, operatorUsername:e.operatorUsername, ms, ref:e });
    }
  });
  tadilatArray().forEach(t=>{
    tadilatOperasyonlarArray(t).forEach(op=>{
      if(op.status==='devam' && op.baslamaTs && !isFasonMachine(op.makine)){
        const ms = tadilatOpDurationBreakdown(op).netMs;
        if(ms>=esik) sonuc.push({ tur:'tadilat', makine:op.makine, isEmriNo:t.uKodu, operatorName:op.operatorName, operatorUsername:op.operatorUsername, ms, ref:op });
      }
    });
  });
  return sonuc.sort((a,b)=>b.ms-a.ms);
}
let uzunDevamEdenModalOpen = false;
function openUzunDevamEdenModal(){ uzunDevamEdenModalOpen = true; render(); }
function closeUzunDevamEdenModal(){ uzunDevamEdenModalOpen = false; render(); }
function renderUzunDevamEdenModal(){
  const list = uzunDevamEdenKayitlar();
  return `<div class="modal-overlay" onclick="if(event.target===this) closeUzunDevamEdenModal()">
    <div class="modal-box">
      <div class="modal-header">
        <div><div class="modal-title">${ico('alert',14)} Uzun Süredir Devam Ediyor</div><div class="modal-sub">Eşik: ${Math.round(uzunDevamEdenEsikMs()/3600000)} saat ve üzeri — muhtemelen kapatılmayı unutulmuş</div></div>
        <button class="icon-btn" onclick="closeUzunDevamEdenModal()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        ${list.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:30px 0">Şu an eşiği aşan devam eden kayıt yok.</div>` : `
        <div class="table-wrap" style="padding:0"><table><thead><tr><th>Makine</th><th>İş Emri</th><th>Operatör</th><th>Süre</th></tr></thead><tbody>
          ${list.map(r=>`<tr><td class="mono" style="color:var(--accent)">${esc((r.makine||'').split(' · ')[0]||'—')}</td><td class="mono">${esc(r.isEmriNo||'—')}</td><td>${esc(r.operatorName||r.operatorUsername||'—')}</td><td style="font-weight:700;color:var(--danger)">${fmtDur(r.ms)}</td></tr>`).join('')}
        </tbody></table></div>`}
      </div>
    </div>
  </div>`;
}
function stockItemsArray(){ return Object.entries(stockItems).map(([id,v])=>({id, ...v})).sort((a,b)=>(a.kod||'').localeCompare(b.kod||'')); }
function lotsArray(item){ return Object.entries(item.lots||{}).map(([id,v])=>({id, ...v})).sort((a,b)=>(b.boy||0)-(a.boy||0)); }
// Bir isEmriNo için daha önce hiç kayıt açılmamışsa "ilk operasyon"dur — hammadde tüketimi
// sadece bu noktada sorulur, rotanın sonraki adımlarında tekrar sorulmaz.
function isFirstOperationFor(isEmriNo){
  if(!isEmriNo) return true;
  return !entriesArray().some(e => e.isEmriNo === isEmriNo);
}
/* ===================== KISMİ AKTARIM (FAZ 5 / MADDE 7) =====================
   Bir iş emrinin, mevcut operasyonu tam bitmeden ELİNDEKİ HAZIR ADEDİ bir sonraki operasyona
   aktarabilme özelliği. Mantık: mevcut kayıttan bir "parti" (kısmi adet) koparılıp AYRI bir
   kayıt olarak "tamamlandi, son operasyon değil" şeklinde işaretlenir; orijinal kayıt kalan
   adetle çalışmaya devam eder. Biri o iş emrini tekrar açtığında (aynı Talep No ile), bekleyen
   parti varsa otomatik olarak ona bağlanır (parentEntryId) — ayrı bir "bekleyen partiler" ekranı
   AÇMADAN, mevcut "Talep No'yu tekrar gir" akışına sessizce entegre olur.
   partiRootId: aynı soydan gelen TÜM kayıtların (orijinal + tüm parçaları) paylaştığı ortak kök
   id — Tamamlanan Kodlar/Excel/Rapor'da hepsi TEK bir iş emri olarak gruplanabilsin diye.
   parentEntryId: bu kayıt hangi kayıttan koptu/devam ediyor (soy ağacı, sadece iç mantık için).
*/
let kismiAktarId = null;
function openKismiAktar(id){
  const e = STATE.entries[id]; if(!e) return;
  if(e.sonOperasyon){ toast('Son operasyon olarak işaretli işlerde kısmi aktarım yapılmaz — bu, rotayı kapatan adımdır.'); return; }
  kismiAktarId = id;
  render();
}
function cancelKismiAktar(){ kismiAktarId = null; render(); }
// Bu iş emri (isEmriNo) için "tamamlanmış ama son operasyon değil VE henüz kimse devam etmemiş"
// bekleyen bir parti var mı? Varsa, yeni açılan kayıt otomatik olarak ona (parentEntryId ile) bağlanır.
function findPendingParti(isEmriNo){
  if(!isEmriNo) return null;
  const all = entriesArray();
  const claimedParentIds = new Set(all.filter(e=>e.parentEntryId).map(e=>e.parentEntryId));
  return all.find(e => e.isEmriNo===isEmriNo && e.partiRootId && e.status==='tamamlandi' && !e.sonOperasyon && !claimedParentIds.has(e.id)) || null;
}
// Rapor ekranında "unutulmasın" diye gösterilecek — hiç kimsenin henüz devralmadığı, bekleyen
// TÜM partileri döner (Tadilat modülündeki "gölgede kalan iş" uyarısıyla aynı mantık).
function pendingPartiList(){
  const all = entriesArray();
  const claimedParentIds = new Set(all.filter(e=>e.parentEntryId).map(e=>e.parentEntryId));
  return all.filter(e => e.partiRootId && e.status==='tamamlandi' && !e.sonOperasyon && !claimedParentIds.has(e.id));
}
function confirmKismiAktar(id){
  const e = STATE.entries[id]; if(!e) return;
  const miktarRaw = (document.getElementById('kismi-aktar-adet')?.value||'').trim();
  const miktar = Number(miktarRaw);
  const mevcut = Number(e.adet)||0;
  if(!miktarRaw || !Number.isFinite(miktar) || miktar<=0){ toast('Geçerli bir adet girin'); return; }
  if(!Number.isInteger(miktar)){ toast('Adet tam sayı olmalı'); return; }
  if(miktar>=mevcut){ toast(`Kalan adedin tamamını (${mevcut}) aktaracaksan "Bitir" kullan — Kısmi Aktar sadece BİR KISMINI ayırmak içindir.`); return; }
  const now = Date.now();
  const rootId = e.partiRootId || e.id; // ilk kez bölünüyorsa bu kayıt kendisi kök olur
  const kalan = mevcut - miktar;
  const childId = uid();
  const childEntry = {
    isEmriNo: e.isEmriNo, talepNo: e.talepNo||'', makine: e.makine,
    malzemeCinsi: e.malzemeCinsi||'', capBoy: e.capBoy||'', not: e.not||'',
    adet: String(miktar), sonOperasyon:false,
    operatorUsername: e.operatorUsername, operatorName: e.operatorName,
    startedByUsername: e.startedByUsername||e.operatorUsername, startedByName: e.startedByName||e.operatorName,
    startTs: e.startTs, endTs: now, status:'tamamlandi',
    duruşToplamMs:0, excludedMs:0,
    partiRootId: rootId, parentEntryId: e.id
  };
  const updates = {};
  updates['entries/'+childId] = childEntry;
  updates['entries/'+id+'/adet'] = String(kalan);
  updates['entries/'+id+'/partiRootId'] = rootId;
  DB.ref().update(updates).then(()=>{
    kismiAktarId = null;
    bigToast(`${miktar} adet bir sonraki operasyona aktarıldı — ${kalan} adet ile burada devam ediyorsun.`);
    render();
  }).catch(err=>{ console.error(err); toast('Aktarılamadı: '+(err&&err.message||'hata')); });
}
function renderKismiAktarModal(){
  const e = STATE.entries[kismiAktarId];
  if(!e){ kismiAktarId=null; return ''; }
  return `<div class="modal-overlay" onclick="if(event.target===this) cancelKismiAktar()">
    <div class="modal-box" style="max-width:400px">
      <div class="modal-header">
        <div><div class="modal-title" style="font-size:18px">${ico('shuffle',14)} Kısmi Aktar</div><div class="modal-sub">${esc(e.talepNo||e.isEmriNo)} · Mevcut adet: ${esc(e.adet)}</div></div>
        <button class="icon-btn" onclick="cancelKismiAktar()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Kaç adet hazır, bir sonraki operasyona aktarılsın?</label><input id="kismi-aktar-adet" inputmode="numeric" placeholder="ör. 200" oninput="this.value=this.value.replace(/\\D/g,'')" autofocus></div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">Bu miktar mevcut kayıttan düşülür ve ayrı, bekleyen bir parti olarak işaretlenir. Aynı Talep No ile yeni bir kayıt açan (bir sonraki operasyonu yapacak) kişi otomatik olarak bu partiye bağlanır. Sen kalan adetle burada çalışmaya devam edersin.</div>
        <div style="display:flex;gap:10px">
          <button class="btn-primary" onclick="confirmKismiAktar('${kismiAktarId}')">${ico('check',14)} Aktar</button>
          <button class="btn-ghost" onclick="cancelKismiAktar()">${ico('x',14)} Vazgeç</button>
        </div>
      </div>
    </div>
  </div>`;
}
// Forma tek bir düz liste olarak basılacak seçenekler: adet kalemleri tek seçenek, boy kalemleri
// HER LOT ayrı bir seçenek olarak (operatör hangi çubuğu kullanacağını doğrudan seçsin).
function stockConsumableOptions(){
  const opts = [];
  stockItemsArray().forEach(it=>{
    if(it.tur==='boy'){
      lotsArray(it).forEach(lot=>{
        opts.push({
          value: it.id+'::'+lot.id, itemId: it.id, lotId: lot.id, tur:'boy',
          label: `${it.kod}${it.cap?' '+it.cap:''} · ${lot.boy}${it.birim||'mm'} kaldı`,
          remaining: lot.boy, birim: it.birim||'mm'
        });
      });
    } else {
      opts.push({
        value: it.id, itemId: it.id, lotId: null, tur:'adet',
        label: `${it.kod}${it.isim?' — '+it.isim:''} (mevcut: ${it.miktar} ${it.birim||'adet'})`,
        remaining: it.miktar, birim: it.birim||'adet', mode: it.mode
      });
    }
  });
  return opts;
}
function stockOptionByValue(val){ return stockConsumableOptions().find(o=>o.value===val) || null; }
function consumeStock(itemId, lotId, miktar, meta){
  if(!itemId || !miktar) return;
  const item = stockItems[itemId]; if(!item) return;
  if(item.tur==='boy' && lotId){
    const lot = (item.lots||{})[lotId]; if(!lot) return;
    const yeniBoy = (Number(lot.boy)||0) - Number(miktar);
    DB.ref(`stockItems/${itemId}/lots/${lotId}/boy`).set(yeniBoy);
    const hid = uid();
    const hareket = {
      itemId, lotId, itemKod: item.kod||'', itemIsim: `${item.cap||''} (${lot.boy}${item.birim||'mm'} çubuk)`, miktar: -Number(miktar), birim: item.birim||'mm',
      isEmriNo: meta.isEmriNo||'', talepNo: meta.talepNo||'', operatorUsername: session.username, operatorName: session.displayName, ts: Date.now()
    };
    DB.ref('stockHareketleri/'+hid).set(hareket);
    stockHareketleri[hid] = hareket; // artık canlı dinlenmiyor (bkz. loadStockHareketleri), yerel kopyayı biz güncelliyoruz
  } else {
    const yeniMiktar = (Number(item.miktar)||0) - Number(miktar);
    DB.ref('stockItems/'+itemId+'/miktar').set(yeniMiktar);
    const hid = uid();
    const hareket = {
      itemId, itemKod: item.kod||'', itemIsim: item.isim||'', miktar: -Number(miktar), birim: item.birim||'',
      isEmriNo: meta.isEmriNo||'', talepNo: meta.talepNo||'', operatorUsername: session.username, operatorName: session.displayName, ts: Date.now()
    };
    DB.ref('stockHareketleri/'+hid).set(hareket);
    stockHareketleri[hid] = hareket;
  }
}
let stokAddTurState = 'adet';
function addStockItem(){
  if(!canManageStock()) return;
  const tur = stokAddTurState;
  const kod = (document.getElementById('stok-kod')?.value||'').trim();
  if(!kod){ toast('Stok kodu girin'); return; }
  const id = uid();
  if(tur==='boy'){
    const cap = (document.getElementById('stok-cap')?.value||'').trim();
    const birim = document.getElementById('stok-birim-boy')?.value||'mm';
    const ilkBoy = Number(document.getElementById('stok-ilk-boy')?.value||0);
    if(ilkBoy<=0){ toast('İlk boy (mm) girin'); return; }
    const lotId = uid();
    DB.ref('stockItems/'+id).set({ kod, tur:'boy', cap, birim, lots: { [lotId]: { boy: ilkBoy } } }).then(()=>{
      toast('Boy takipli stok kalemi eklendi (1 çubuk ile)');
      ['stok-kod','stok-cap','stok-ilk-boy'].forEach(fid=>{ const el=document.getElementById(fid); if(el) el.value=''; });
    });
  } else {
    const isim = (document.getElementById('stok-isim')?.value||'').trim();
    const birim = document.getElementById('stok-birim')?.value||'adet';
    const miktar = Number(document.getElementById('stok-miktar')?.value||0);
    const mode = document.getElementById('stok-mode')?.value||'oto';
    DB.ref('stockItems/'+id).set({ kod, tur:'adet', isim, birim, miktar, mode }).then(()=>{
      toast('Stok kalemi eklendi');
      ['stok-kod','stok-isim','stok-miktar'].forEach(fid=>{ const el=document.getElementById(fid); if(el) el.value=''; });
    });
  }
}
function updateStockItemField(id, field, val){
  if(!canManageStock()) return;
  DB.ref('stockItems/'+id+'/'+field).set(field==='miktar' ? Number(val) : val);
}
function deleteStockItem(id){
  if(!canManageStock()) return;
  if(!confirm('Bu malzeme stok kalemini silmek istediğinize emin misiniz?')) return;
  DB.ref('stockItems/'+id).remove();
}
function addStockLot(itemId){
  if(!canManageStock()) return;
  const boy = Number(document.getElementById('stok-yeni-boy-'+itemId)?.value||0);
  if(boy<=0){ toast('Boy (mm) girin'); return; }
  const lotId = uid();
  DB.ref(`stockItems/${itemId}/lots/${lotId}`).set({ boy }).then(()=>{
    toast('Yeni çubuk eklendi');
    const el = document.getElementById('stok-yeni-boy-'+itemId); if(el) el.value='';
  });
}
function updateStockLot(itemId, lotId, val){
  if(!canManageStock()) return;
  DB.ref(`stockItems/${itemId}/lots/${lotId}/boy`).set(Number(val));
}
function deleteStockLot(itemId, lotId){
  if(!canManageStock()) return;
  if(!confirm('Bu çubuğu/lotu silmek istediğinize emin misiniz?')) return;
  DB.ref(`stockItems/${itemId}/lots/${lotId}`).remove();
}
