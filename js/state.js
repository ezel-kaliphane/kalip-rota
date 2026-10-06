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
// Bekleme süresi — fmtDur günlerce bekleyen bir talep için "76 sa 12 dk" diyor ve
// okunmuyor. 24 saatin altında fmtDur ile aynı, üstünde gün/saat.
const fmtBekleme = ms => {
  const dk = Math.max(0, Math.round(ms/60000));
  if(dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk/60);
  if(sa < 24) return `${sa} sa ${dk%60} dk`;
  return `${Math.floor(sa/24)} gün ${sa%24} sa`;
};
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
/* Başarı bildirimi — ekranın ortasında, yeşil kenarlıklı, onay rozetli. Uzun süren ve sonucu
   merak edilen işler için (Excel yüklemeleri): küçük alttaki toast bu işlerde gözden kaçıyordu.
   Ekranda 4.5 sn duruyor — normal toast'tan uzun ama okunup geçilecek kadar kısa. */
function bigToastOk(msg){ const t=document.getElementById('toast-big'); if(!t) return; t.textContent=msg; t.className='toast-big ok show'; clearTimeout(t._t); t._t=setTimeout(()=>t.className='toast-big',4500); }
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
// Excel'e (validIsEmri listesi) bağlı olmadan her zaman kabul edilen sabit bir test kodu — deneme
// amaçlı kayıt açmak için gerçek bir iş emri no aramaya gerek kalmasın diye. Report ekranındaki
// arama + "Seçilenleri Sil" ile (İş Emri No alanına "DENEME" yazıp hepsini seçerek) kolayca
// temizlenebilir, ayrı bir silme mekanizması gerekmiyor.
const TEST_ISEMRI_NO = 'DENEME';
function isEmriValid(code){
  const upper = String(code||'').trim().toUpperCase();
  if(upper===TEST_ISEMRI_NO) return true;
  if(Object.keys(STATE.validIsEmri||{}).length===0) return true; // liste boşsa doğrulama yapılmaz
  if(STATE.validIsEmri[upper]) return true;
  const base = baseIsEmriNo(upper);
  return base !== upper && !!STATE.validIsEmri[base];
}
// Girilen İş Emri No (Talep No) için, ERP listesinden eşleşen malzeme kodu/adı bilgisini döner
// (varsa) — operatöre/şefe "bu talep no hangi malzemeye ait" bilgisini anında göstermek için.
function getTalepInfo(code){
  if(!code) return null;
  const upper = String(code||'').trim().toUpperCase();
  if(baseIsEmriNo(upper)===TEST_ISEMRI_NO) return { malzemeKodu: TEST_ISEMRI_NO, malzemeAdi: 'Test kaydı' };
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
    if(e.status==='duruş' && e.duruşTs && !isVerimlilikDisiDurus(e.duruşNedeni)){
      const ms = nowTick - e.duruşTs;
      if(ms>=esik) sonuc.push({ tur:'entry', makine:e.makine, isEmriNo:e.isEmriNo||e.talepNo, operatorName:e.operatorName, operatorUsername:e.operatorUsername, neden:e.duruşNedeni, ms, ref:e });
    }
  });
  tadilatArray().forEach(t=>{
    tadilatOperasyonlarArray(t).forEach(op=>{
      if(op.status==='duruş' && op.duruşTs && !isVerimlilikDisiDurus(op.duruşNedeni)){
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
// Forma tek bir düz liste olarak basılacak seçenekler: adet kalemleri tek seçenek, boy kalemleri
// HER LOT ayrı bir seçenek olarak (operatör hangi çubuğu kullanacağını doğrudan seçsin).
function stockConsumableOptions(){
  const opts = [];
  stockItemsArray().forEach(it=>{
    if(it.tur==='boy'){
      lotsArray(it).forEach(lot=>{
        opts.push({
          value: it.id+'::'+lot.id, itemId: it.id, lotId: lot.id, tur:'boy',
          label: `${it.kod}${it.cap?' '+it.cap:''} · ${lot.boy}${it.birim||'mm'} kaldı${it.caniasBekliyor && !malzemeCaniasFromIsim(it.isim) ? ' · KOD YOK' : ''}`,
          remaining: lot.boy, birim: it.birim||'mm'
        });
      });
    } else {
      opts.push({
        value: it.id, itemId: it.id, lotId: null, tur:'adet',
        label: `${hammaddeGosterimAdi(it)} (mevcut: ${it.miktar} ${it.birim||'adet'})`,
        remaining: it.miktar, birim: it.birim||'adet', mode: it.mode
      });
    }
  });
  return opts;
}
function stockOptionByValue(val){ return stockConsumableOptions().find(o=>o.value===val) || null; }
/* İlk Operasyon hammadde seçimini QR ile de yapabilsin diye — CANİAS koduna göre eşleştiriyor
   (isim'in sonundaki "(KOD)" parçasından, bkz. malzemeCaniasFromIsim), Kod ile Giriş'teki mal
   kabul akışıyla aynı mantık. CANİAS'ı olmayan kalemlerde (boy takipli çelik gibi) kod alanına
   düşülür. Boy takipli kalemde aynı kod+çap'ta birden fazla çubuk (lot) eşleşirse OTOMATİK
   SEÇİM YAPILMAZ — hangi fiziksel çubuğun tarandığı QR'dan anlaşılamaz, operatör elle seçsin. */
function stockOptionByScanCode(code){
  code = String(code||'').trim().toUpperCase();
  if(!code) return { status:'empty' };
  const matches = stockConsumableOptions().filter(o=>{
    const item = stockItems[o.itemId]; if(!item) return false;
    const canias = malzemeCaniasFromIsim(item.isim);
    return canias ? canias===code : String(item.kod||'').trim().toUpperCase()===code;
  });
  if(matches.length===1) return { status:'ok', option: matches[0] };
  if(matches.length===0) return { status:'none' };
  return { status:'multi', options: matches };
}
function stockScanUygula(setStockItemId){
  openQrScanner(function(code){
    const r = stockOptionByScanCode(code);
    if(r.status==='ok'){ setStockItemId(r.option.value); toast('Seçildi: '+r.option.label); }
    else if(r.status==='multi'){ toast(`"${code}" için ${r.options.length} çubuk eşleşti — listeden elle seçin`); }
    else { toast(`"${code}" ile eşleşen hammadde bulunamadı`); }
    render();
  });
}
function consumeStock(itemId, lotId, miktar, meta){
  if(!itemId || !miktar) return;
  const item = stockItems[itemId]; if(!item) return;
  if(item.tur==='boy' && lotId){
    const lot = (item.lots||{})[lotId]; if(!lot) return;
    const yeniBoy = (Number(lot.boy)||0) - Number(miktar);
    DB.ref(`stockItems/${itemId}/lots/${lotId}/boy`).set(yeniBoy);
    DB.ref(`stockItems/${itemId}/sonHareketTs`).set(Date.now()); // Genel Bakış "Son Hareket" sütunu için denormalize alan
    DB.ref(`stockItems/${itemId}/sonHareketAciklama`).set('Üretim tüketimi'+(meta.isEmriNo?' · '+meta.isEmriNo:''));
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
    DB.ref('stockItems/'+itemId+'/sonHareketTs').set(Date.now()); // Genel Bakış "Son Hareket" sütunu için denormalize alan
    DB.ref('stockItems/'+itemId+'/sonHareketAciklama').set('Üretim tüketimi'+(meta.isEmriNo?' · '+meta.isEmriNo:''));
    const hid = uid();
    const hareket = {
      itemId, itemKod: item.kod||'', itemIsim: item.isim||'', miktar: -Number(miktar), birim: item.birim||'',
      isEmriNo: meta.isEmriNo||'', talepNo: meta.talepNo||'', operatorUsername: session.username, operatorName: session.displayName, ts: Date.now()
    };
    DB.ref('stockHareketleri/'+hid).set(hareket);
    stockHareketleri[hid] = hareket;
  }
}
/* ---------- Kod ile Giriş (mal kabul) — SuperAdmin/Şef ----------
   Tadilat'taki "Malzeme Ara" modalıyla (bkz. js/catalog.js malzemeLikeMatch, ui/catalog-ui.js
   renderMalzemeAramaModal) AYNI arama deneyimi: tek kutuya kelimeler boşlukla, sırasız yazılır
   (ya da Canias alışkanlığı için %joker%), eşleşenler ANINDA liste olarak aşağıda çıkar,
   tıklayınca seçilir — ayrı bir "Ara" tuşuna basmaya ya da kodu harfiyen bilmeye gerek yok.
   stockItems zaten bellek-içi (canlı dinleniyor), ayrıca Firebase okuması YAPILMIYOR. TEK giriş
   noktası — hem adet takipli kalemler (mal kabul: adet+not+sipariş açık) hem boy takipli
   çubuklar (yeni çubuk ekleme) burada; Durum ekranında artık sadece düzeltme/silme var, giriş yok. */
let stokGirisArama = '';
let stokGirisFoundId = null;
let stokGirisMiktar = 1;
let stokGirisNot = '';
let stokGirisSiparisAcik = false;
let stokGirisCubukBoyu = '';
let stokGirisIstekKapat = {}; // { istekNo: true } — bu giriş hangi açık malzeme siparişinin teslimi (06.10.2026)
/* Girişten sonra işaretli siparişleri "geldi" yap. */
function stokGirisIstekleriKapat(itemId){
  const nolar = Object.keys(stokGirisIstekKapat).filter(k=>stokGirisIstekKapat[k]);
  stokGirisIstekKapat = {};
  if(!nolar.length || typeof malzemeIstekGeldiYaz!=='function') return;
  nolar.forEach(no=>malzemeIstekGeldiYaz(no, itemId, true));
  toast('Sipariş geldi olarak işaretlendi: '+nolar.join(', '));
}
/* Seçili kalemin açık malzeme siparişleri — Stok Girişi'nde "teslim" kutuları. */
function stokGirisIstekKutulariHtml(itemId){
  if(typeof malzemeAcikIstekler!=='function') return '';
  if(typeof ensureMalzemeBekleyenLoaded==='function') ensureMalzemeBekleyenLoaded();
  const liste = malzemeAcikIstekler(itemId); if(!liste.length) return '';
  return `<div class="notice" style="--nc:var(--warn);margin:0 0 12px;padding:9px 12px"><div class="notice-sub">
    <b>Bu malzemenin açık siparişi var.</b> Bu giriş bir siparişin teslimiyse işaretle — sipariş "geldi" olur:
    ${liste.map(s=>`<label style="display:flex;align-items:center;gap:8px;margin-top:6px;cursor:pointer">
      <input type="checkbox" style="width:auto" ${stokGirisIstekKapat[s.istekNo]?'checked':''} onchange="stokGirisIstekKapat['${escJs(s.istekNo)}']=this.checked">
      İstek <b class="mono">${esc(s.istekNo)}</b> · ${s.miktar==null?'miktar bilinmiyor':s.miktar+' '+esc(s.birim||'')} · ${s.bagli.length} iş emri bekliyor</label>`).join('')}
  </div></div>`;
}
function stockGirisAramaSonuclar(){
  const q = stokGirisArama.trim();
  if(!q) return [];
  /* 01.10.2026: malzemeLikeMatch yerine hammaddeAra — aynı kelime/%joker% kuralı, artı Ø'süz
     yazım ("4140 25"), Türkçe ı/İ ve en iyi eşleşme başta (bkz. js/catalog.js). */
  return hammaddeAra(stockItemsArray(), q).slice(0,50);
}
function stockGirisSecKalem(itemId){
  const it = stockItems[itemId]; if(!it) return;
  stokGirisFoundId = itemId;
  stokGirisMiktar = 1;
  stokGirisNot = '';
  stokGirisSiparisAcik = !!it.siparisAcik;
  stokGirisCubukBoyu = '';
  stokGirisIstekKapat = {};
  render();
}
function stokGirisScanQr(){
  openQrScanner(function(kod){
    stokGirisArama = kod;
    const exact = stockItemsArray().find(it=>String(it.kod||'').trim().toUpperCase()===String(kod||'').trim().toUpperCase());
    if(exact) stockGirisSecKalem(exact.id); else render();
  });
}
function stokGirisGeriDon(){
  stokGirisFoundId = null; stokGirisArama = '';
  stokGirisMiktar = 1; stokGirisNot = ''; stokGirisSiparisAcik = false; stokGirisCubukBoyu = '';
  render();
}
function stokGirisMiktarDegistir(delta){
  stokGirisMiktar = Math.max(1, (Number(stokGirisMiktar)||1) + delta);
  render();
}
function stokGirisCubukEkle(){
  if(!canManageStock()) return;
  const itemId = stokGirisFoundId; if(!itemId) return;
  const boy = Number(stokGirisCubukBoyu)||0;
  if(boy<=0){ toast('Boy (mm) girin'); return; }
  const lotId = uid();
  DB.ref(`stockItems/${itemId}/lots/${lotId}`).set({ boy }).then(()=>{
    DB.ref(`stockItems/${itemId}/sonHareketTs`).set(Date.now()); // Genel Bakış "Son Hareket" sütunu için denormalize alan
    DB.ref(`stockItems/${itemId}/sonHareketAciklama`).set('Yeni çubuk eklendi');
    toast('Yeni çubuk eklendi');
    stokGirisIstekleriKapat(itemId);
    stokGirisGeriDon();
  });
}
function stockGirisKaydet(){
  if(!canManageStock()) return;
  const itemId = stokGirisFoundId; if(!itemId) return;
  const item = stockItems[itemId]; if(!item) return;
  const miktar = Math.max(1, Number(stokGirisMiktar)||1);
  const siparisAcik = !!stokGirisSiparisAcik;
  DB.ref('stockItems/'+itemId+'/miktar').transaction(cur => (Number(cur)||0) + miktar)
    .then(result=>{
      if(!result.committed){ toast('İşlem tamamlanamadı, tekrar deneyin'); return; }
      const sonrakiMiktar = Number(result.snapshot.val())||0;
      DB.ref('stockItems/'+itemId+'/siparisAcik').set(siparisAcik);
      DB.ref('stockItems/'+itemId+'/sonHareketTs').set(Date.now()); // Genel Bakış "Son Hareket" sütunu için denormalize alan
      DB.ref('stockItems/'+itemId+'/sonHareketAciklama').set('Stok girişi');
      const hid = uid();
      const hareket = {
        itemId, itemKod: item.kod||'', itemIsim: item.isim||'', miktar: miktar, birim: item.birim||'',
        tip:'giris', aciklama: (stokGirisNot||'').trim(),
        operatorUsername: session.username, operatorName: session.displayName, ts: Date.now()
      };
      DB.ref('stockHareketleri/'+hid).set(hareket);
      stockHareketleri[hid] = hareket;
      stockItems[itemId] = { ...item, miktar: sonrakiMiktar, siparisAcik, sonHareketTs: Date.now() };
      toast(`Giriş kaydedildi: ${item.kod||''} (+${miktar})`);
      stokGirisIstekleriKapat(itemId);
      stokGirisGeriDon();
    }).catch(err=>{
      toast('Giriş kaydedilemedi: '+(err.message||'bilinmeyen hata'));
    });
}
function toggleStockItemSiparisAcik(id){
  if(!canManageStock()) return;
  const cur = !!(stockItems[id]||{}).siparisAcik;
  DB.ref('stockItems/'+id+'/siparisAcik').set(!cur).then(()=>{
    stockItems[id] = { ...(stockItems[id]||{}), siparisAcik: !cur };
    render();
  });
}

/* ---------- Malzeme Excel Toplu Yükleme (SuperAdmin/Şef) ----------
   Kama gibi kalemler (Ölçü/Tip/CANİAS Kodu alanları) için: bu bilgiler ayrı şema alanı olarak
   DEĞİL, isim metnine gömülü tutuluyor (kullanıcı kararı). Bu yüzden CANİAS kodu, tekrar
   yüklemede eşleştirme için isim'in sonundaki "(KOD)" parçasından ayrıştırılıyor — toolstock'ta
   canias ayrı bir alan olduğu için doğrudan eşleşiyordu, buradaki tek fark bu. kod alanı
   biricik DEĞİL (ör. B13 dört farklı ölçüde tekrar eder), o yüzden upsert anahtarı kod değil. */
const MALZEME_EXCEL_COLS = {
  kod:      ['KOD'],
  olcu:     ['ÖLÇÜ (WXDXL)','OLCU (WXDXL)','ÖLÇÜ','OLCU'],
  tip:      ['TİP','TIP'],
  stok:     ['STOK'],
  canias:   ['CANİAS KODU','CANIAS KODU','CANİAS','CANIAS'],
  aciklama: ['AÇIKLAMA','ACIKLAMA'],
};
function malzemeFindColIdx(header, candidates){
  const norm = header.map(h=>trNorm(String(h||'').trim()));
  for(const c of candidates){ const nc=trNorm(c); const i=norm.findIndex(h=>h===nc); if(i!==-1) return i; }
  for(const c of candidates){ const nc=trNorm(c); const i=norm.findIndex(h=>h.includes(nc)); if(i!==-1) return i; }
  return -1;
}
function malzemeCaniasFromIsim(isim){
  const m = String(isim||'').match(/\(([^()]+)\)\s*$/);
  return m ? m[1].trim().toUpperCase() : '';
}
function malzemeKamaIsimOlustur(r){
  const parcalar = [r.olcu, r.tip].filter(Boolean).join(' ');
  let isim = parcalar;
  if(r.aciklama) isim += (isim?' — ':'') + r.aciklama;
  if(r.canias) isim += ` (${r.canias})`;
  return isim.trim();
}
/* ---------- CANİAS hammadde listesi (01.10.2026) ----------
   CANİAS'tan alınan BAST03_SELMATERIAL dışa aktarımı yalnızca iki sütun taşıyor: "Canias Kodu"
   ve "Açıklama" (KOD/STOK yok). Bu dosya Excel Yükleme → Hammadde'ye verilince yukarıdaki kama
   akışı yerine bu "liste modu" çalışıyor: sistemde OLMAYAN CANİAS kodları sıfır stoklu kalem
   olarak açılıyor, var olanlara hiç dokunulmuyor (isim, kod, stok aynen kalıyor). Liste büyüdükçe
   (CANİAS'ta yeni KLPHM kodu açıldıkça) aynı dosya yeniden yüklenip yalnızca yeniler ekleniyor.
   Kalem türü açıklamadan çıkarılıyor:
     "Ø" geçen → yuvarlak çubuk, boy takipli (kod = kalite, ör. "4140 ISLAHLI"; cap = "Ø25")
     KAMA / DÖKÜM PARMAK → adet (açıklamada B kodu varsa kod o)
     diğerleri (lama, blok: "130X20X400") → adet, kod = açıklamanın kendisi
   CANİAS kodu, kama akışındaki gibi isim'in sonuna "(KOD)" olarak yazılıyor — QR ve yeniden
   yüklemede eşleştirme bu parçadan (malzemeCaniasFromIsim). Sıfır stok + alt limit 0 olduğu
   için yeni kalemler Kritik Stok'a düşmüyor. Stok hareketi YAZILMIYOR: ortada sayım yok,
   yüzlerce "0 adet" satırı Son Hareketler'i doldururdu. */
function caniasMalzemeCoz(canias, aciklama){
  const ac = String(aciklama||'').replace(/\s+/g,' ').trim();
  const isim = `${ac} (${canias})`;
  const capM = ac.match(/Ø\s*([\d]+(?:[.,]\d+)?)/);
  if(capM){
    const kalite = ac.slice(0, capM.index).trim() || ac;
    return { tur:'boy', sinif:'yuvarlak', kod: kalite, cap: 'Ø'+capM[1], birim:'mm', isim };
  }
  if(/^(KAMA|D[OÖ]K[UÜ]M PARMAK)\b/i.test(ac)){
    const bKod = ac.match(/\bB\d+\b/i);
    const kod = bKod ? bKod[0].toUpperCase() : ac;
    return { tur:'adet', sinif:'kama', kod, isim, birim:'adet' };
  }
  return { tur:'adet', sinif:'prizmatik', kod: ac.replace(/\s+[CÇ]EL[İI]K$/i,''), isim, birim:'adet' };
}
/* ---------- CANİAS'ta henüz açılmamış hammadde (01.10.2026) ----------
   Bazen ürün CANİAS'ta kodu olmayan bir malzemeyle yapılıyor: usta malzemeyi belirliyor, kodu
   SuperAdmin sonra CANİAS'ta açıyor. Şef beklemesin diye hammadde aramasında "+ Yeni hammadde
   aç" var: kalem hemen açılıyor, caniasBekliyor:true taşıyor ve her yerde "KOD YOK" görünüyor.
   Kod iki yoldan bağlanıyor: CANİAS listesi yeniden yüklenince açıklamadan kendiliğinden
   (caniasListesiOnizlemeKur), ya da Stok Genel Bakış'taki karttan elle (hammaddeKodBagla).
   SuperAdmin'e haber Cloud Function'dan (yeniHammaddeBildirimi) Bildirimlerim'e düşüyor —
   telefona push YOK (kullanıcı kararı); pushLog istemciye yazma kapalı olduğu için oradan.
   Yetki: Şef + SuperAdmin (canManageStock). */
function hammaddeEslesmeAnahtari(s){
  return hammaddeNorm(String(s||'').replace(/\s*\([^()]*\)\s*$/,'')).replace(/\b[cç]el[iı]k\b/g,'').replace(/\s+/g,' ').trim();
}
/* Aramaya yazılan metinden form taslağı: "4140 ıslahlı 27" / "4140 Ø27" → çubuk (kalite +
   çap); ölçü ("90x40x400") → adet. Şef formda düzeltebilir. */
function yeniHammaddeTaslak(metin){
  const ust = String(metin||'').replace(/%/g,' ').replace(/\s+/g,' ').trim().toLocaleUpperCase('tr-TR');
  if(/\d\s*X\s*\d/.test(ust)) return { tur:'adet', kod: ust, cap:'', aciklama: ust };
  const ortada = ust.match(/^(.*?)\s*Ø\s*(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if(ortada && ortada[1].trim()){
    const cap = 'Ø'+ortada[2].replace('.',',');
    return { tur:'boy', kod: ortada[1].trim(), cap, aciklama: [ortada[1].trim(), cap, ortada[3].trim()].filter(Boolean).join(' ') };
  }
  const sonda = ust.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)$/);
  if(sonda && sonda[1].trim()){
    const cap = 'Ø'+sonda[2].replace('.',',');
    return { tur:'boy', kod: sonda[1].trim(), cap, aciklama: `${sonda[1].trim()} ${cap}` };
  }
  return { tur:'adet', kod: ust, cap:'', aciklama: ust };
}
let yhModal = null; // { hedef, tur, kod, cap, aciklama, boy, adet, busy, aciklamaElle }
function yeniHammaddeAc(metin, hedef){
  if(!canManageStock()){ toast('Yeni hammaddeyi yalnızca Şef ya da SuperAdmin açabilir'); return; }
  yhModal = { hedef: hedef||'', ...yeniHammaddeTaslak(metin), boy:'', adet:'', busy:false, aciklamaElle:false };
  render();
}
function yeniHammaddeKapat(){ yhModal = null; render(); }
function yeniHammaddeYaz(alan, deger, cizme){
  if(!yhModal) return;
  yhModal[alan] = deger;
  /* Kalite/çap/tür değişince açıklama da (şef elle değiştirmediyse) birlikte güncellensin. */
  if(alan==='aciklama') yhModal.aciklamaElle = true;
  else if((alan==='kod' || alan==='cap' || alan==='tur') && !yhModal.aciklamaElle){
    yhModal.aciklama = yhModal.tur==='boy' ? [yhModal.kod, yhModal.cap].filter(Boolean).join(' ') : yhModal.kod;
  }
  if(cizme!==false) render();
}
/* Kaydedilen kalemi açıldığı yerde seçili hâle getir. */
function yeniHammaddeHedefeSec(hedef, id, lotId){
  const it = stockItems[id]; if(!it){ render(); return; }
  /* İşaretleme penceresi o arada kapatılmış olsa bile taslağıyla birlikte geri açılsın. */
  if(hedef==='mb'){ mbYeniAcik = true; mbHamSec(id); return; }
  if(hedef==='giris'){ stokGirisArama = ''; stockGirisSecKalem(id); return; }
  if(String(hedef).startsWith('op')){
    const deger = it.tur==='boy' ? (lotId ? id+'::'+lotId : '') : id;
    if(!deger){ toast('Çubuk boyu girilmediği için seçilemedi — boyu Stok Girişi\'nden ekle'); render(); return; }
    const i = hedef.startsWith('op:') ? Number(hedef.slice(3)) : -1;
    const hedefForm = i>=0 ? (newForm.cokluItems||[])[i] : newForm;
    if(hedefForm){ hedefForm.stockItemId = deger; hedefForm.stokAra = ''; }
  }
  render();
}
function yeniHammaddeKaydet(){
  if(!canManageStock() || !yhModal || yhModal.busy) return;
  const m = yhModal;
  const kod = String(m.kod||'').replace(/\s+/g,' ').trim().toLocaleUpperCase('tr-TR');
  let cap = String(m.cap||'').replace(/\s+/g,'').toLocaleUpperCase('tr-TR').replace(/^Ø?/,'Ø').replace('.',',');
  if(m.tur!=='boy') cap = '';
  const aciklama = String(m.aciklama||'').replace(/\s+/g,' ').trim().toLocaleUpperCase('tr-TR') || [kod, cap].filter(Boolean).join(' ');
  if(!kod){ toast(m.tur==='boy' ? 'Kaliteyi yazın (ör. 4140 ISLAHLI)' : 'Kodu ya da ölçüyü yazın'); return; }
  if(m.tur==='boy' && !/^Ø\d/.test(cap)){ toast('Çapı yazın (ör. Ø27)'); return; }
  /* Aynısı zaten varsa yeni kalem açma, onu seç. */
  const ayni = stockItemsArray().find(it=> m.tur==='boy'
    ? (it.tur==='boy' && hammaddeEslesmeAnahtari(it.isim || `${it.kod||''} ${it.cap||''}`)===hammaddeEslesmeAnahtari(aciklama))
    : (it.tur!=='boy' && hammaddeEslesmeAnahtari(it.isim||it.kod||'')===hammaddeEslesmeAnahtari(aciklama)));
  if(ayni){ toast('Bu malzeme zaten var: '+hammaddeGosterimAdi(ayni)+' — o seçildi'); const h=m.hedef; yhModal=null; yeniHammaddeHedefeSec(h, ayni.id, null); return; }
  const id = uid(), now = Date.now();
  const iz = { caniasBekliyor:true, acanUsername: session.username, acanName: session.displayName||session.username, acilisTs: now, altLimit:0 };
  let lotId = null, data;
  if(m.tur==='boy'){
    const boy = Number(m.boy)||0;
    data = { kod, tur:'boy', cap, birim:'mm', isim: aciklama, ...iz };
    if(boy>0){ lotId = uid(); data.lots = { [lotId]: { boy } }; }
  } else {
    data = { kod, tur:'adet', isim: aciklama, birim:'adet', miktar: Number(m.adet)||0, mode:'manuel', ...iz };
  }
  m.busy = true; render();
  DB.ref('stockItems/'+id).set(data).then(()=>{
    stockItems[id] = data;
    toast('Hammadde açıldı — CANİAS kodu bekleniyor');
    const h = m.hedef; yhModal = null;
    yeniHammaddeHedefeSec(h, id, lotId);
  }).catch(err=>{ m.busy = false; toast('Açılamadı: '+(err.message||'bilinmeyen hata')); render(); });
}
function caniasKoduBekleyenler(){
  return stockItemsArray().filter(it=>it.caniasBekliyor && !malzemeCaniasFromIsim(it.isim))
    .sort((a,b)=>(Number(b.acilisTs)||0)-(Number(a.acilisTs)||0));
}
let hkGirdi = {}; // { itemId: SuperAdmin'in yazdığı CANİAS kodu }
function hammaddeKodBagla(id){
  if(!session || !session.isSuperAdmin){ toast('CANİAS kodunu yalnızca SuperAdmin bağlayabilir'); return; }
  const it = stockItems[id]; if(!it) return;
  const kod = String(hkGirdi[id]||'').replace(/\s+/g,'').toUpperCase();
  if(!kod){ toast('CANİAS kodunu yazın (ör. KLPHM000566)'); return; }
  const baska = stockItemsArray().find(x=>x.id!==id && malzemeCaniasFromIsim(x.isim)===kod);
  if(baska){ toast('Bu kod zaten başka kalemde: '+hammaddeGosterimAdi(baska)); return; }
  const isim = `${String(it.isim || [it.kod, it.cap].filter(Boolean).join(' ')).trim()} (${kod})`;
  DB.ref('stockItems/'+id).update({ isim, caniasBekliyor:null, kodBaglamaTs: Date.now(), kodBaglayan: session.displayName||session.username }).then(()=>{
    delete hkGirdi[id]; toast('CANİAS kodu bağlandı: '+kod); render();
  }).catch(err=>toast('Kaydedilemedi: '+(err.message||'bilinmeyen hata')));
}
/* ---------- CANİAS KODU BEKLEYEN KALEMİ DÜZELT / DEĞİŞTİR / SİL (05.10.2026, kullanıcı isteği) ----------
   "Şef bazen yanlış açabilir veya doğru malzemeyi yazmamış olabilir; hangi iş emrine istedi
   görünsün, düzelt ve sil olsun." Yalnızca SuperAdmin.
   - Düzelt (bilgi): kalite/kod, çap, açıklama. Bekleyen kayıtlarda ve reçetelerde saklanan
     hammaddeKod metni de yeni ada güncellenir (o ekranlar adı oradan okuyor).
   - Değiştir: doğru malzeme sistemde zaten varsa, bu kalemi gösteren bütün bekleyen kayıtlar
     (karşılananlar dahil) ve çelik reçeteleri ona taşınır; bu kalemdeki stok (çubuklar ya da
     adet) ona aktarılır; bu kalem silinir. Tek çok-yollu yazma — yarım kalmaz.
   - Sil: kalemi bekleyen AKTİF iş emri varsa izin yok (iş emri hammaddesiz kalırdı) — önce
     Değiştir. Reçetelerdeki çelik alanları temizlenir, karbür reçetesine dokunulmaz. */
let hdModal = null; // { id, sekme:'bilgi'|'degistir', kod, cap, isim, ara, hedefId, busy }
function hammaddeBagliKayitlar(id){
  const mb = (typeof malzemeBekleyenArray==='function' ? malzemeBekleyenArray() : []).filter(x=>x.hammaddeId===id);
  const recete = Object.entries((typeof hammaddeRecete!=='undefined' && hammaddeRecete) || {}).filter(([,r])=>r && r.hammaddeId===id).map(([m])=>m);
  return { mb, aktif: mb.filter(x=>x.durum!=='karsilandi'), recete };
}
function hammaddeDuzeltAc(id){
  if(!session || !session.isSuperAdmin){ toast('Yalnızca SuperAdmin düzeltebilir'); return; }
  const it = stockItems[id]; if(!it) return;
  if(typeof ensureMalzemeBekleyenLoaded==='function') ensureMalzemeBekleyenLoaded();
  if(typeof ensureHammaddeReceteLoaded==='function') ensureHammaddeReceteLoaded(()=>safeRender());
  hdModal = { id, sekme:'bilgi', kod: it.kod||'', cap: it.cap||'', isim: it.isim||'', ara:'', hedefId:'', busy:false };
  render();
}
function hammaddeDuzeltKapat(){ hdModal = null; render(); }
function hammaddeDuzeltYaz(alan, deger, cizme){ if(!hdModal) return; hdModal[alan] = deger; if(cizme!==false) render(); }
function hammaddeDuzeltKaydet(){
  if(!session || !session.isSuperAdmin || !hdModal || hdModal.busy) return;
  const m = hdModal, it = stockItems[m.id]; if(!it){ hammaddeDuzeltKapat(); return; }
  const boy = it.tur==='boy';
  const kod = String(m.kod||'').replace(/\s+/g,' ').trim().toLocaleUpperCase('tr-TR');
  let cap = boy ? String(m.cap||'').replace(/\s+/g,'').toLocaleUpperCase('tr-TR').replace(/^Ø?/,'Ø').replace('.',',') : '';
  const isim = String(m.isim||'').replace(/\s+/g,' ').trim().toLocaleUpperCase('tr-TR') || [kod, cap].filter(Boolean).join(' ');
  if(!kod){ toast(boy ? 'Kaliteyi yazın' : 'Kodu ya da ölçüyü yazın'); return; }
  if(boy && !/^Ø\d/.test(cap)){ toast('Çapı yazın (ör. Ø27)'); return; }
  const ayni = stockItemsArray().find(x=>x.id!==m.id && (x.tur==='boy')===boy && hammaddeEslesmeAnahtari(x.isim || `${x.kod||''} ${x.cap||''}`)===hammaddeEslesmeAnahtari(isim));
  if(ayni){ toast('Bu malzeme zaten var: '+hammaddeGosterimAdi(ayni)+' — "Mevcut malzemeyle değiştir"i kullanın'); hdModal.sekme='degistir'; hdModal.hedefId=ayni.id; render(); return; }
  const yeni = { ...it, kod, isim, ...(boy ? { cap } : {}) };
  const etiket = hammaddeEtiket(yeni);
  const b = hammaddeBagliKayitlar(m.id), updates = {};
  updates['stockItems/'+m.id+'/kod'] = kod; updates['stockItems/'+m.id+'/isim'] = isim;
  if(boy) updates['stockItems/'+m.id+'/cap'] = cap;
  b.mb.forEach(x=>{ updates['malzemeBekleyen/'+x.id+'/hammaddeKod'] = etiket; });
  b.recete.forEach(mm=>{ updates['hammaddeRecete/'+mm+'/hammaddeKod'] = etiket; });
  m.busy = true; render();
  DB.ref().update(updates).then(()=>{
    stockItems[m.id] = yeni;
    b.recete.forEach(mm=>{ hammaddeRecete[mm] = { ...hammaddeRecete[mm], hammaddeKod: etiket }; });
    toast('Düzeltildi: '+etiket); hdModal = null; render();
  }).catch(err=>{ m.busy = false; toast('Kaydedilemedi: '+(err.message||'hata')); render(); });
}
function hammaddeDegistirKaydet(){
  if(!session || !session.isSuperAdmin || !hdModal || hdModal.busy) return;
  const m = hdModal, src = stockItems[m.id], dst = stockItems[m.hedefId];
  if(!src){ hammaddeDuzeltKapat(); return; }
  if(!dst || m.hedefId===m.id){ toast('Doğru malzemeyi listeden seçin'); return; }
  const stok = hammaddeStokSayi(src);
  if(stok>0 && (src.tur==='boy')!==(dst.tur==='boy')){ toast('Bu kalemde stok var ve seçilen malzemenin türü farklı (çubuk / adet) — önce stoğu düzeltin'); return; }
  const b = hammaddeBagliKayitlar(m.id), etiket = hammaddeEtiket(dst), updates = {};
  b.mb.forEach(x=>{ updates['malzemeBekleyen/'+x.id+'/hammaddeId'] = m.hedefId; updates['malzemeBekleyen/'+x.id+'/hammaddeKod'] = etiket; });
  b.recete.forEach(mm=>{ updates['hammaddeRecete/'+mm+'/hammaddeId'] = m.hedefId; updates['hammaddeRecete/'+mm+'/hammaddeKod'] = etiket; });
  const yeniLotlar = {};
  if(stok>0){
    if(src.tur==='boy') lotsArray(src).forEach(l=>{ const lid = uid(); const { id, ...lot } = l; yeniLotlar[lid] = lot; updates['stockItems/'+m.hedefId+'/lots/'+lid] = lot; });
    else updates['stockItems/'+m.hedefId+'/miktar'] = (Number(dst.miktar)||0) + (Number(src.miktar)||0);
  }
  updates['stockItems/'+m.id] = null;
  const ozet = `${hammaddeGosterimAdi(src)} → ${hammaddeGosterimAdi(dst)}\n\n`
    + `${b.mb.length} bekleyen kayıt ve ${b.recete.length} reçete yeni malzemeye geçecek`
    + (stok>0 ? `, bu kalemdeki stok (${stok} ${src.birim||''}) ona aktarılacak` : '')
    + `, bu kalem silinecek. Devam edilsin mi?`;
  if(!confirm(ozet)) return;
  m.busy = true; render();
  DB.ref().update(updates).then(()=>{
    if(stok>0){
      if(src.tur==='boy') stockItems[m.hedefId] = { ...dst, lots: { ...(dst.lots||{}), ...yeniLotlar } };
      else stockItems[m.hedefId] = { ...dst, miktar: (Number(dst.miktar)||0) + (Number(src.miktar)||0) };
    }
    delete stockItems[m.id];
    b.recete.forEach(mm=>{ hammaddeRecete[mm] = { ...hammaddeRecete[mm], hammaddeId: m.hedefId, hammaddeKod: etiket }; });
    toast('Değiştirildi: '+etiket); hdModal = null; render();
  }).catch(err=>{ m.busy = false; toast('Kaydedilemedi: '+(err.message||'hata')); render(); });
}
function hammaddeBekleyenKalemSil(id){
  if(!session || !session.isSuperAdmin){ toast('Yalnızca SuperAdmin silebilir'); return; }
  const it = stockItems[id]; if(!it) return;
  const b = hammaddeBagliKayitlar(id);
  if(b.aktif.length){ toast(`Bu malzemeyi bekleyen ${b.aktif.length} iş emri var (${b.aktif.map(x=>x.talepNo||x.isEmriNo).join(', ')}). Önce Düzelt → "Mevcut malzemeyle değiştir" ile doğru malzemeye taşıyın ya da bekleyen kaydı silin.`); return; }
  const stok = hammaddeStokSayi(it);
  if(!confirm(`${hammaddeGosterimAdi(it)} silinsin mi?` + (stok>0 ? `\n\nDİKKAT: bu kalemde stok var (${stok} ${it.birim||''}), o da silinir.` : '') + (b.recete.length ? `\n${b.recete.length} mamulün çelik reçetesinden çıkarılır.` : ''))) return;
  const updates = { ['stockItems/'+id]: null };
  b.recete.forEach(mm=>{ ['hammaddeId','hammaddeKod','birimBasina','birim'].forEach(k=>{ updates['hammaddeRecete/'+mm+'/'+k] = null; }); });
  DB.ref().update(updates).then(()=>{
    delete stockItems[id];
    b.recete.forEach(mm=>{ const r = { ...hammaddeRecete[mm] }; ['hammaddeId','hammaddeKod','birimBasina','birim'].forEach(k=>delete r[k]); hammaddeRecete[mm] = r; });
    toast('Silindi'); render();
  }).catch(err=>toast('Silinemedi: '+(err.message||'hata')));
}
/* rows: [[caniasKodu, aciklama], ...] (başlık satırı hariç). Dosya okuyucu ile doğrudan
   çağrı aynı yoldan geçsin diye ayrı tutuldu. */
function caniasListesiOnizlemeKur(rows){
  const mevcut = {};
  Object.entries(stockItems||{}).forEach(([id,v])=>{ const c = malzemeCaniasFromIsim(v && v.isim); if(c) mevcut[c] = id; });
  /* Şefin açtığı, CANİAS kodu bekleyen kalemler (bkz. yeniHammaddeKaydet). Listede yeni bir
     kod bunlardan birine uyuyorsa YENİ KALEM AÇILMIYOR — kod o kaleme yazılıyor ki çubuğu ve
     geçmişi kaybolmasın, aynı malzemeden iki kalem olmasın. Uyma: açıklama ("ÇELİK" hariç,
     Ø'süz) aynı, ya da çubukta kalite + çap aynı. Her bekleyen kalem en fazla bir koda. */
  const bekleyen = Object.entries(stockItems||{}).filter(([,v])=>v && v.caniasBekliyor && !malzemeCaniasFromIsim(v.isim))
    .map(([id,v])=>({ id, v, anahtar: hammaddeEslesmeAnahtari(v.isim || `${v.kod||''} ${v.cap||''}`), kodCap: v.tur==='boy' ? hammaddeNorm(`${v.kod||''} ${v.cap||''}`) : null }));
  const eslesen = [];
  const gorulen = new Set(), yeni = [];
  let zatenVar = 0, bos = 0, dosyadaTekrar = 0;
  const sinifSay = { yuvarlak:0, kama:0, prizmatik:0 };
  const aciklamaKodlari = {};
  rows.forEach(r=>{
    const canias = String((r && r[0])||'').trim().toUpperCase();
    const aciklama = String((r && r[1])||'').replace(/\s+/g,' ').trim();
    if(!canias || !aciklama){ bos++; return; }
    if(gorulen.has(canias)){ dosyadaTekrar++; return; }
    gorulen.add(canias);
    const anahtar = aciklama.replace(/\s*[CÇ]EL[İI]K\s*$/i,'').replace(/\s*Ø\s*/g,'Ø').toUpperCase();
    (aciklamaKodlari[anahtar] = aciklamaKodlari[anahtar] || []).push(canias);
    if(mevcut[canias]){ zatenVar++; return; }
    const c = caniasMalzemeCoz(canias, aciklama);
    const aAnahtar = hammaddeEslesmeAnahtari(aciklama);
    const kodCap = c.tur==='boy' ? hammaddeNorm(`${c.kod} ${c.cap}`) : null;
    const bi = bekleyen.findIndex(x=> x.anahtar===aAnahtar || (kodCap && x.kodCap===kodCap));
    if(bi!==-1){
      const x = bekleyen.splice(bi,1)[0];
      eslesen.push({ canias, aciklama, isim: c.isim, itemId: x.id, eskiAd: x.v.isim || `${x.v.kod||''} ${x.v.cap||''}`.trim() });
      return;
    }
    sinifSay[c.sinif]++;
    yeni.push({ canias, aciklama, ...c });
  });
  /* CANİAS'ta aynı açıklamayla iki ayrı kod açılmış olabiliyor (ör. 2767 Ø75). İkisi de ayrı
     kalem olarak açılıyor — hangisinin geçerli olduğuna CANİAS tarafı karar verir — ama
     önizlemede gösteriliyor ki fark edilsin. */
  const ayniAciklama = Object.entries(aciklamaKodlari).filter(([,k])=>k.length>1).map(([a,k])=>({ aciklama:a, kodlar:k }));
  return { katalog:true, toplam: gorulen.size, yeni, eslesen, zatenVar, bos, dosyadaTekrar, sinifSay, ayniAciklama };
}
function caniasListesiYukle(){
  if(!canManageStock() || !malzemeExcelPreview || !malzemeExcelPreview.katalog) return;
  const yeni = malzemeExcelPreview.yeni, eslesen = malzemeExcelPreview.eslesen || [];
  if(yeni.length===0 && eslesen.length===0){ toast('Eklenecek yeni kalem yok — listedeki tüm kodlar zaten sistemde'); return; }
  const updates = {};
  const now = Date.now();
  eslesen.forEach(e=>{
    updates['stockItems/'+e.itemId+'/isim'] = e.isim;
    updates['stockItems/'+e.itemId+'/caniasBekliyor'] = null;
    updates['stockItems/'+e.itemId+'/kodBaglamaTs'] = now;
    updates['stockItems/'+e.itemId+'/kodBaglayan'] = 'CANİAS listesi';
  });
  yeni.forEach(r=>{
    const id = uid();
    updates['stockItems/'+id] = r.tur==='boy'
      ? { kod: r.kod, tur:'boy', cap: r.cap, birim:'mm', altLimit:0, isim: r.isim }
      : { kod: r.kod, tur:'adet', isim: r.isim, birim:'adet', miktar:0, mode:'manuel', altLimit:0 };
  });
  DB.ref().update(updates).then(()=>{
    toast(`${yeni.length} yeni hammadde kalemi eklendi`+(eslesen.length?`, ${eslesen.length} bekleyen kaleme kod bağlandı`:''));
    malzemeExcelPreview = null;
    render();
  }).catch(err=>{
    toast('Yükleme başarısız: '+(err.message||'bilinmeyen hata'));
  });
}
let malzemeExcelPreview = null;
let malzemeExcelUpdateStock = false;
async function handleMalzemeExcelPreview(){
  if(!canManageStock()) return;
  const fileInput = document.getElementById('malzeme-excel-file-input');
  const file = fileInput?.files?.[0];
  const statusEl = document.getElementById('malzeme-excel-status');
  if(!file){ toast('Bir dosya seçin'); return; }
  if(!(await ensureXLSX())) return;
  if(statusEl) statusEl.textContent = 'Okunuyor…';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsxSatirlar(ws);
      if(rows.length===0){ if(statusEl) statusEl.textContent = 'Sayfa boş.'; return; }
      const header = rows[0];
      const col = {
        kod: malzemeFindColIdx(header, MALZEME_EXCEL_COLS.kod),
        olcu: malzemeFindColIdx(header, MALZEME_EXCEL_COLS.olcu),
        tip: malzemeFindColIdx(header, MALZEME_EXCEL_COLS.tip),
        stok: malzemeFindColIdx(header, MALZEME_EXCEL_COLS.stok),
        canias: malzemeFindColIdx(header, MALZEME_EXCEL_COLS.canias),
        aciklama: malzemeFindColIdx(header, MALZEME_EXCEL_COLS.aciklama),
      };
      if(col.kod===-1 || col.stok===-1){
        /* KOD/STOK yok ama CANİAS + Açıklama var → CANİAS hammadde listesi (bkz. caniasMalzemeCoz). */
        if(col.canias!==-1 && col.aciklama!==-1){
          malzemeExcelPreview = caniasListesiOnizlemeKur(rows.slice(1).map(r=>[r[col.canias], r[col.aciklama]]));
          if(statusEl) statusEl.textContent = `CANİAS hammadde listesi tanındı — ${malzemeExcelPreview.toplam} kod okundu, önizleme aşağıda.`;
          render();
          return;
        }
        if(statusEl) statusEl.textContent = 'KOD/STOK sütunu bulunamadı.';
        return;
      }
      const parsed = [];
      const seenCodes = new Set();
      let dupCount = 0, blankCount = 0;
      for(let i=1;i<rows.length;i++){
        const r = rows[i];
        const kod = col.kod!==-1 ? String(r[col.kod]||'').trim() : '';
        if(!kod){ blankCount++; continue; }
        const canias = col.canias!==-1 ? String(r[col.canias]||'').trim().toUpperCase() : '';
        if(canias){ if(seenCodes.has(canias)) dupCount++; seenCodes.add(canias); }
        const row = {
          kod,
          olcu: col.olcu!==-1 ? String(r[col.olcu]||'').trim() : '',
          tip: col.tip!==-1 ? String(r[col.tip]||'').trim() : '',
          stok: col.stok!==-1 ? (Number(r[col.stok])||0) : 0,
          canias,
          aciklama: col.aciklama!==-1 ? String(r[col.aciklama]||'').trim() : '',
        };
        row.isim = malzemeKamaIsimOlustur(row);
        parsed.push(row);
      }
      if(parsed.length===0){ if(statusEl) statusEl.textContent = 'Geçerli satır bulunamadı.'; return; }
      malzemeExcelPreview = { rows: parsed, blankCount, dupCount };
      malzemeExcelUpdateStock = false;
      if(statusEl) statusEl.textContent = `${parsed.length} satır okundu, önizleme aşağıda.`;
      render();
    } catch(err){
      console.warn(err);
      if(statusEl) statusEl.textContent = 'Dosya okunamadı, .xlsx formatında olduğundan emin olun.' + (err && err.message ? ' (' + err.message + ')' : '');
    }
  };
  reader.readAsArrayBuffer(file);
}
function confirmMalzemeExcelUpload(){
  if(!canManageStock() || !malzemeExcelPreview) return;
  if(malzemeExcelPreview.katalog){ caniasListesiYukle(); return; }
  const rows = malzemeExcelPreview.rows;
  if(rows.length===0){ toast('Yüklenecek satır yok'); return; }
  // Mevcut kalemleri isim'in sonundaki (CANİAS) parçasından eşleştir — kod biricik değil.
  const byCanias = {};
  Object.entries(stockItems).forEach(([id,v])=>{
    if(v.tur==='boy') return;
    const c = malzemeCaniasFromIsim(v.isim);
    if(c) byCanias[c] = id;
  });
  const now = Date.now();
  const updates = {};
  let yeni = 0, guncellendi = 0;
  rows.forEach(r=>{
    const existingId = r.canias ? byCanias[r.canias] : null;
    const isNew = !existingId;
    const itemId = isNew ? uid() : existingId;
    updates['stockItems/'+itemId+'/kod'] = r.kod;
    updates['stockItems/'+itemId+'/isim'] = r.isim;
    updates['stockItems/'+itemId+'/tur'] = 'adet';
    updates['stockItems/'+itemId+'/birim'] = 'adet';
    if(isNew){
      yeni++;
      updates['stockItems/'+itemId+'/mode'] = 'manuel';
      updates['stockItems/'+itemId+'/miktar'] = r.stok;
      const hid = uid();
      updates['stockHareketleri/'+hid] = {
        itemId, itemKod: r.kod, itemIsim: r.isim, miktar: r.stok, birim:'adet',
        tip:'sayim', aciklama:'Excel toplu yükleme (ilk kayıt)',
        operatorUsername: session.username, operatorName: session.displayName, ts: now
      };
    } else if(malzemeExcelUpdateStock){
      guncellendi++;
      updates['stockItems/'+itemId+'/miktar'] = r.stok;
      const onceki = Number((stockItems[itemId]||{}).miktar)||0;
      const hid = uid();
      updates['stockHareketleri/'+hid] = {
        itemId, itemKod: r.kod, itemIsim: r.isim, miktar: r.stok-onceki, birim:'adet',
        tip:'sayim', aciklama:'Excel toplu yükleme (sayım güncelleme)',
        operatorUsername: session.username, operatorName: session.displayName, ts: now
      };
    } else {
      guncellendi++;
    }
  });
  DB.ref().update(updates).then(()=>{
    toast(`Yükleme tamamlandı: ${yeni} yeni, ${guncellendi} güncellendi`);
    malzemeExcelPreview = null;
    render();
  }).catch(err=>{
    toast('Yükleme başarısız: '+(err.message||'bilinmeyen hata'));
  });
}

let stokAddTurState = 'adet';
function addStockItem(){
  if(!canManageStock()) return;
  const tur = stokAddTurState;
  const kod = (document.getElementById('stok-kod')?.value||'').trim();
  if(!kod){ toast('Stok kodu girin'); return; }
  const id = uid();
  const altLimit = Number(document.getElementById('stok-alt-limit')?.value||0);
  if(tur==='boy'){
    const cap = (document.getElementById('stok-cap')?.value||'').trim();
    const birim = document.getElementById('stok-birim-boy')?.value||'mm';
    const ilkBoy = Number(document.getElementById('stok-ilk-boy')?.value||0);
    if(ilkBoy<=0){ toast('İlk boy (mm) girin'); return; }
    const lotId = uid();
    DB.ref('stockItems/'+id).set({ kod, tur:'boy', cap, birim, altLimit, lots: { [lotId]: { boy: ilkBoy } } }).then(()=>{
      toast('Boy takipli stok kalemi eklendi (1 çubuk ile)');
      ['stok-kod','stok-cap','stok-ilk-boy','stok-alt-limit'].forEach(fid=>{ const el=document.getElementById(fid); if(el) el.value=''; });
    });
  } else {
    const isim = (document.getElementById('stok-isim')?.value||'').trim();
    const birim = document.getElementById('stok-birim')?.value||'adet';
    const miktar = Number(document.getElementById('stok-miktar')?.value||0);
    const mode = document.getElementById('stok-mode')?.value||'oto';
    DB.ref('stockItems/'+id).set({ kod, tur:'adet', isim, birim, miktar, mode, altLimit }).then(()=>{
      toast('Stok kalemi eklendi');
      ['stok-kod','stok-isim','stok-miktar','stok-alt-limit'].forEach(fid=>{ const el=document.getElementById(fid); if(el) el.value=''; });
    });
  }
}
function updateStockItemField(id, field, val){
  if(!canManageStock()) return;
  DB.ref('stockItems/'+id+'/'+field).set((field==='miktar'||field==='altLimit') ? Number(val) : val);
}
function deleteStockItem(id){
  if(!canManageStock()) return;
  if(!confirm('Bu malzeme stok kalemini silmek istediğinize emin misiniz?')) return;
  DB.ref('stockItems/'+id).remove();
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
