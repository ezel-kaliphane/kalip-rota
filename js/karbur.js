/* ==================== KARBÜR ÇUBUK STOK & KESİM PLANLAMA — BAŞLANGIÇ ====================
   Tungsten karbür çubuk ("elmas") stoğu ve tel erozyonda kesim planlaması.

   Mevcut stockItems/stockHareketleri (çelik hammadde) ve toolCatalog/toolStock (kesici takım)
   modüllerinden TAMAMEN AYRI — hiçbir node veya fonksiyon paylaşmaz. Tüm değişkenler ve
   fonksiyonlar `karbur` önekli.

   Neden ayrı: "çelik ve karbür karışmasın" açık bir gereksinim. İzolasyon filtre alanıyla değil
   ayrı node ile sağlanıyor; böylece bir sorguda filtrenin atlanması karışmaya yol açamaz.
   Toplam envanter ihtiyacı, ileride bu modüllerden OKUYAN salt-okunur bir toplayıcı görünümle
   çözülecek — modüller birleştirilmeyecek (üç farklı semantik tek modüle tıkılmayacak).

   NODE'LAR
     karburKatalog/{id}      { kod, disCap, boy, delik, kalite, tur:'cubuk'|'hazir',
                               aktif, updatedTs, updatedBy }
     karburStok/{katalogId}  { adet, sonHareketTs }
     karburFire/{id}         { disCap, delik, kalite, boy, adet, sonHareketTs }
     karburHareketleri/{id}  { tip, kod, planNo, ts, ... }  — İKİ AYRI KAYIT SINIFI:
        (a) STOK HAREKETİ    : adet = stok değişimi (çıkışta negatif), oncekiAdet/sonrakiAdet dolu.
                               tip: 'kesim' | 'adet_cikis' | 'kesimsiz' | 'fire_kullanim' | 'giris' | 'sayim'
                               'kesim' kaydı PLAN başınadır (kalem başına bir satır), isEmriNo BOŞ —
                               çünkü bir çubuk birden fazla iş emrine hizmet eder, tek iş emrine
                               atfedilemez.
        (b) İŞ EMRİ TAHSİSİ  : tip 'tahsis'; adet YOK (stok değişimi değil), parca + mm dolu,
                               isEmriNo dolu. Bir iş emrinin o plandan aldığı malzemeyi anlatır.
        Bu ayrım bilinçli: ikisini tek satırda birleştirmek "adet=0" gibi anlamsız kayıtlar
        üretiyordu ve çubuk sayısı yanlışlıkla iş emri başına atfedilmiş görünüyordu.
     settings/karburEnabled, settings/karburKatalogVersion, settings/karburHurdaEsigi

   STOK KODU:  C18XH156X3XVA90  =  dış çap 18 / boy 156 / delik 3 / kalite VA90

   MODEL NOTLARI (sahadaki işleyişten)
     - Çubuklar birbirinin yerine geçer (fungible): "10 adet Ø18'den hangisini aldığım önemsiz;
       önemli olan kalite". Bu yüzden fiziksel lot/seri takibi YOK — kod bazında adet tutulur.
       (Çelik modülündeki `lots` yaklaşımı bilinçli olarak kopyalanmadı.)
     - Fire (artık) parçalar da (çap + delik + kalite + boy) içinde fungible; havuz bir çokluk
       kümesi olarak tutulur.
     - Fire ASLA otomatik kullanılmaz. Optimizer sadece taze çubuk üzerinden plan yapar; fireyi
       kullanıcı elle seçer. Gerekçe: 61 mm fireyi 52'lik iş için bozmak taze çubuğu tam
       bölmekten kötüdür — hem malzeme israfı olur, hem ileride kesimsiz verilebilecek bir parça
       yok edilir. "Önce fireyi kullan" tipi açgözlü kural değer yok eder.
     - HURDA EŞİĞİ (settings/karburHurdaEsigi, varsayılan 5 mm): eşiğin ALTINDAKİ artıklar
       hurdadır ve HİÇ KAYDEDİLMEZ — havuza girmez, hareket yazılmaz, hakkında veri tutulmaz
       (kullanıcı isteği). Eşik ve üzeri her artık havuza girer. Eşiği SuperAdmin ayarlar.
       Sonuç: havuz toplamı = tüketilen çubuk mm − iş emirlerine tahsis − hurda. Hurda saklanmadığı
       için kalan farktan türetilir; ayrı bir kaydı yoktur.
     - Karşılanamayan talep asla sessizce düşürülmez; plan ekranında uyarı olarak görünür.
   ======================================================================================== */

const KARBUR_PAY_VARSAYILAN = 2;     // her parçaya eklenen pay (mm)
const KARBUR_CUBUK_MIN = 100;        // bu boydan uzun kalem = kesilecek çubuk, kısası hazır parça

/* ---------- modül-yerel durum (STATE'e dokunulmaz) ---------- */
let karburKatalog = {};
let karburStok = {};
let karburFire = {};
let karburKatalogReady = false, karburStokReady = false, karburFireReady = false;
let karburHareketler = [];
let karburSubView = 'plan';          // plan | stok | giris | excel | gecmis
let karburRows = [];                 // kesim planı giriş satırları
let karburPay = KARBUR_PAY_VARSAYILAN;
let karburBasePlan = null;           // fire seçimi öncesi ilk plan (ÖNCE/SONRA karşılaştırması)
let karburAssigns = {};              // parçaKey -> fireId
let karburRodPick = {};              // aileKey -> seçilen çubuk kodu (kullanıcı override)
let karburPickerFor = null;          // fire seçici modalı açık olan parçaKey
let karburSaveSummary = null;
let karburEksikUyari = null;         // { eksik:[...], bayat } — stok yetmediği için durdurulan kayıt
let karburBusy = false;
let karburExcelPreview = null;
let karburExcelStokGuncelle = false; // Excel'deki adetler mevcut kalemlere sayım olarak uygulansın mı
let karburGirisKod = '', karburGirisAdet = '';
let karburAdetRows = [];             // adet olarak verilecekler: { isEmri, katalogId, adet }
let karburPlanNo = null;             // HESAPLA'da üretilir; kâğıt ile kayıt aynı numarayı taşır

/* ---------- sayı / kod yardımcıları ---------- */
function karburNum(s){ const v = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isNaN(v) ? NaN : v; }
function karburFmt(n){ if(n == null || isNaN(n)) return '—'; return String(Math.round(n*100)/100).replace('.', ','); }
/* Kod ayrıştırma — MÜSAMAHAKÂR.
   Önek ürün ailesini gösteriyor (C=Civata, V=Vida, S=Somun) ve zamanında öyle tanımlandığı için
   duruyor; malzeme ayrımı DEĞİL. Kullanıcı ileride kaldırabileceğini söyledi, bu yüzden önek
   serbest bırakıldı: baştaki harfler ne olursa olsun (hatta hiç olmasa da) okunur. Boydan
   önceki 'H' de opsiyonel (C kodlarında var, V/S kodlarında yok).

   ÜÇ sayısal alan -> dış çap / boy / delik olarak biliniyor, kalem kesim planına girebilir.
   Başka sayıda alan -> alanların anlamı bilinmiyor, kalem adet olarak tüketilir.
   Bu yalnızca VARSAYILAN; hangi kalemin kesime gireceğini kullanıcı kalem listesinden
   işaretler (bkz. karburSetKullanim). Program tahmine dayanmaz. */
function karburParseKod(kod){
  const raw = String(kod == null ? '' : kod).trim().toUpperCase();
  if(!raw) return null;
  const parts = raw.split('X').filter(p => p !== '');
  if(parts.length < 2) return null;
  const kalite = parts[parts.length - 1];
  if(!/[A-Z]/.test(kalite)) return null;                  // son parça kalite olmalı
  const sayiToken = parts.slice(0, -1).map(p => p.replace(/^[A-Z]+/, ''));
  const alanlar = sayiToken.map(karburNum);
  if(!alanlar.length || alanlar.some(v => isNaN(v) || v <= 0)) return null;
  const onek = (/^([A-Z]+)/.exec(parts[0]) || [])[1] || '';
  const uc = alanlar.length === 3;
  return {
    kod: raw, onek, alanlar, kalite,
    disCap: uc ? alanlar[0] : null,
    boy:    uc ? alanlar[1] : null,
    delik:  uc ? sayiToken[2].replace('.', ',') : null,
    tur:    uc ? (alanlar[1] >= KARBUR_CUBUK_MIN ? 'cubuk' : 'hazir') : null,
    kullanim: uc ? 'kesim' : 'adet'
  };
}
/* ERP (Canias) karbür yarı mamulünü _ELMAS ekiyle ayırıyor; tüketim bu dala yazılır.
   BILESEN_SUFFIX js/state.js'de tanımlı — yeniden tanımlamak yerine onu kullanıyoruz. */
function karburIsEmriKey(isEmriNo){
  const s = String(isEmriNo == null ? '' : isEmriNo).trim().toUpperCase();
  if(!s) return '';
  const suf = (typeof BILESEN_SUFFIX !== 'undefined' && BILESEN_SUFFIX.ELMAS) || '_ELMAS';
  return s.endsWith(suf) ? s : s + suf;
}

/* Plan numarasi: yazdirilan kagit ile kaydedilen hareketler ayni numarayi tasisin ki
   uretimdeki bir kayittan hangi kesim planina ait oldugu izlenebilsin. HESAPLA'da uretilir,
   satirlar degisince (karburResetPlan) sifirlanir — yani numara her zaman ekranda duran
   planin numarasidir. */
function karburYeniPlanNo(){
  const d = new Date();
  const gun = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  return 'KP-' + gun + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}
/* Ozet ana is emri numarasiyla tutulur (_ELMAS eki atilir) ki uretimdeki biri ana is emrine
   bakarken de karbur cikisini gorebilsin. baseIsEmriNo js/state.js:52'de tanimli. */
function karburBaseIsEmri(no){
  const s = String(no == null ? '' : no).trim().toUpperCase();
  const base = (typeof baseIsEmriNo === 'function') ? baseIsEmriNo(s) : s.replace(/_ELMAS$/, '');
  return base.replace(/[.#$\[\]\/]/g, '-');   // RTDB anahtarinda yasak karakterler
}

/* Hurda eşiği: bu boyun ALTINDAKİ artıklar kaydedilmez. settings node'u uygulama açılışında
   zaten dinlendiği için appSettings içinde ek maliyetsiz hazır. */
const KARBUR_HURDA_VARSAYILAN = 5;
function karburHurdaEsigi(){
  const v = karburNum((typeof appSettings !== 'undefined' && appSettings) ? appSettings.karburHurdaEsigi : null);
  return (isNaN(v) || v < 0) ? KARBUR_HURDA_VARSAYILAN : v;
}
function setKarburHurdaEsigi(raw){
  if(!(session && session.isSuperAdmin)) return;
  const v = karburNum(raw);
  if(isNaN(v) || v < 0){ toast('Geçerli bir mm değeri girin'); return; }
  DB.ref('settings/karburHurdaEsigi').set(v).then(() => {
    karburResetPlan();
    toast('Hurda eşiği: ' + karburFmt(v) + ' mm altı kaydedilmeyecek');
    render();
  }).catch(err => toast('Kaydedilemedi: ' + ((err && err.message) || 'hata')));
}

/* ---------- yetki ---------- */
function karburEnabled(){ return !!(typeof appSettings !== 'undefined' && appSettings && appSettings.karburEnabled); }
/* Çelik stoğunu yönetenlerle aynı kitle: SuperAdmin + Şef (bkz. js/state.js canManageStock) */
function canManageKarbur(){ return typeof canManageStock === 'function' ? canManageStock() : !!(session && session.isSuperAdmin); }
function canSeeKarbur(){ return canManageKarbur(); }
function toggleKarburEnabled(){
  if(!(session && session.isSuperAdmin)) return;
  DB.ref('settings/karburEnabled').set(!karburEnabled());
}

/* ---------- diziler ---------- */
function karburKatalogArray(){
  return Object.entries(karburKatalog)
    .map(([id, v]) => ({ id, ...v }))
    .filter(k => k.aktif !== false)
    .sort((a, b) => (a.disCap - b.disCap) || (b.boy - a.boy) || String(a.kod).localeCompare(String(b.kod)));
}
function karburStokAdet(katalogId){ return Number((karburStok[katalogId] || {}).adet) || 0; }
function karburFireArray(){
  return Object.entries(karburFire)
    .map(([id, v]) => ({ id, ...v }))
    .filter(f => (Number(f.adet) || 0) > 0)
    .sort((a, b) => (a.disCap - b.disCap) || (b.boy - a.boy));
}
function karburCaps(){ return [...new Set(karburKesimKalemleri().map(k => k.disCap))].sort((a, b) => a - b); }
function karburDelikler(cap){ const c = karburNum(cap); return [...new Set(karburKesimKalemleri().filter(k => k.disCap === c).map(k => k.delik))]; }
function karburKaliteler(cap, delik){ const c = karburNum(cap); return [...new Set(karburKesimKalemleri().filter(k => k.disCap === c && (!delik || k.delik === delik)).map(k => k.kalite))]; }

/* ---------- lazy okuma (canlı dinleyici YOK — maliyet kısıtı) ----------
   Desen js/toolstock.js:120-184'ten: katalog sürüm kontrollü localStorage cache'inden,
   adetler her açılışta taze, hata "Tekrar Dene" ile latch'lenir (her render'da yeni istek
   ateşlenmesin). cb SADECE gerçek asenkron okuma bittiğinde çağrılır — aksi halde
   render -> ensure -> render senkron sonsuz döngüsü oluşur (toolstock'ta yaşanmış bir hata). */
let karburKatalogLoading = false, karburKatalogError = null;
function ensureKarburKatalogLoaded(cb){
  if(karburKatalogReady || karburKatalogLoading) return;
  const cachedVer = load('karbur_katalog_version', -1);
  const serverVer = Number((typeof appSettings !== 'undefined' && appSettings && appSettings.karburKatalogVersion) || 0);
  if(cachedVer === serverVer){
    const cached = load('karbur_katalog_cache', null);
    if(cached){ karburKatalog = cached; karburKatalogReady = true; return; }
  }
  karburKatalogLoading = true;
  DB.ref('karburKatalog').once('value').then(snap => {
    karburKatalogLoading = false;
    karburKatalog = snap.val() || {};
    karburKatalogReady = true; karburKatalogError = null;
    save('karbur_katalog_cache', karburKatalog);
    save('karbur_katalog_version', serverVer);
    cb && cb();
  }).catch(err => {
    karburKatalogLoading = false;
    karburKatalogError = (err && err.message) || 'okuma hatası';
    safeRender();
  });
}
function retryKarburKatalogLoad(){ karburKatalogError = null; ensureKarburKatalogLoaded(() => safeRender()); }
function bumpLocalKarburKatalogVersion(){
  save('karbur_katalog_version', Number(load('karbur_katalog_version', 0)) + 1);
  save('karbur_katalog_cache', karburKatalog);
}

let karburStokLoading = false, karburStokError = null;
function ensureKarburStokLoaded(cb, force){
  if((karburStokReady && !force) || karburStokLoading) return;
  karburStokLoading = true;
  DB.ref('karburStok').once('value').then(snap => {
    karburStokLoading = false;
    karburStok = snap.val() || {};
    karburStokReady = true; karburStokError = null;
    cb && cb();
  }).catch(err => {
    karburStokLoading = false;
    karburStokError = (err && err.message) || 'okuma hatası';
    safeRender();
  });
}
function retryKarburStokLoad(){ karburStokError = null; ensureKarburStokLoaded(() => safeRender(), true); }

let karburFireLoading = false, karburFireError = null;
function ensureKarburFireLoaded(cb, force){
  if((karburFireReady && !force) || karburFireLoading) return;
  karburFireLoading = true;
  DB.ref('karburFire').once('value').then(snap => {
    karburFireLoading = false;
    karburFire = snap.val() || {};
    karburFireReady = true; karburFireError = null;
    cb && cb();
  }).catch(err => {
    karburFireLoading = false;
    karburFireError = (err && err.message) || 'okuma hatası';
    safeRender();
  });
}
function retryKarburFireLoad(){ karburFireError = null; ensureKarburFireLoaded(() => safeRender(), true); }

/* Hareketler hiç toplu indirilmez — yalnızca son N kayıt sayfalanır (indexOn:["ts"]) */
function loadKarburHareketleri(limit){
  DB.ref('karburHareketleri').orderByChild('ts').limitToLast(limit || 50).once('value').then(snap => {
    const v = snap.val() || {};
    karburHareketler = Object.entries(v).map(([id, x]) => ({ id, ...x })).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    safeRender();
  }).catch(err => { toast('Hareketler okunamadı: ' + ((err && err.message) || 'hata')); });
}

/* ==================== SAF PLANLAMA MANTIĞI (Firebase'den bağımsız) ====================
   calculator.py:3-37 (first-fit-decreasing) portu. Pay HER PARÇA başına eklenir.
   ==================================================================================== */

/* Satırı malzeme ailesine (dış çap + delik + kalite) çözer.
   Delik/kalite ZORUNLU DEĞİL: tek aile eşleşiyorsa kendiliğinden çözülür, birden fazlaysa
   VARSAYIM YAPILMAZ — kullanıcı seçer, seçilene kadar satır plana girmez. */
function karburResolveRow(r){
  const c = karburNum(r.disCap);
  if(!(c > 0)) return { hata: 'çap seçilmedi' };
  let cands = karburKesimKalemleri().filter(k => k.disCap === c);
  if(r.delik)  cands = cands.filter(k => k.delik === r.delik);
  if(r.kalite) cands = cands.filter(k => k.kalite === r.kalite);
  if(!cands.length) return { hata: 'bu özellikte stok kalemi yok' };
  const fams = {};
  cands.forEach(k => {
    const key = k.delik + '|' + k.kalite;
    (fams[key] = fams[key] || { delik: k.delik, kalite: k.kalite, adet: 0, kodlar: [] });
    fams[key].adet += karburStokAdet(k.id);
    fams[key].kodlar.push(k);
  });
  const list = Object.values(fams).sort((a, b) => b.adet - a.adet);
  if(list.length > 1) return { disCap: c, secimBekliyor: true, aileler: list };
  return { disCap: c, delik: list[0].delik, kalite: list[0].kalite };
}
function karburFamKey(f){ return f.disCap + '|' + f.delik + '|' + f.kalite; }
/* Kesim mantığı SADECE 'kesim' işaretli kalemleri görür; 'adet' kalemleri plana hiç girmez. */
function karburKesimKalemleri(){ return karburKatalogArray().filter(k => (k.kullanim || 'kesim') === 'kesim' && k.disCap > 0 && k.boy > 0); }
function karburAdetKalemleri(){ return karburKatalogArray().filter(k => (k.kullanim || 'kesim') === 'adet'); }
function karburFamItems(f){ return karburKesimKalemleri().filter(k => k.disCap === f.disCap && k.delik === f.delik && k.kalite === f.kalite); }
function karburFamCubuklar(f){ return karburFamItems(f).filter(k => k.tur === 'cubuk' && karburStokAdet(k.id) > 0); }
function karburFamHazir(f, boy){ return karburFamItems(f).find(k => k.tur === 'hazir' && Math.abs(k.boy - boy) < 0.001) || null; }

function karburBuildDemands(){
  const out = [];
  karburRows.forEach((r, ri) => {
    const boy = karburNum(r.boy), adet = parseInt(r.adet, 10);
    const f = karburResolveRow(r);
    if(f.hata){ out.push({ ri, r, hata: f.hata }); return; }
    if(f.secimBekliyor){ out.push({ ri, r, bekliyor: true, aileler: f.aileler }); return; }
    if(!(boy > 0) || !(adet > 0)){ out.push({ ri, r, hata: 'boy/adet eksik' }); return; }
    out.push({ ri, r, fam: f, boy, adet, isEmri: (r.isEmri || '').trim() });
  });
  return out;
}

/* Bir çubuk kalemine parçaları yerleştirir (FFD) */
function karburPack(item, pieces){
  const list = pieces.slice().sort((a, b) => b.boy - a.boy);
  const bars = [];
  list.forEach(p => {
    const need = p.boy + karburPay;
    let placed = false;
    for(const b of bars){ if(b.used + need <= item.boy){ b.pieces.push(p); b.used += need; placed = true; break; } }
    if(!placed) bars.push({ pieces: [p], used: need });
  });
  bars.forEach(b => {
    b.fire = Math.round((item.boy - b.used) * 100) / 100;
    /* Tam bölünüyorsa son parça için ayrı kesim gerekmez */
    b.kesim = b.fire > 0 ? b.pieces.length : b.pieces.length - 1;
  });
  return {
    bars, cubuk: bars.length, mm: bars.length * item.boy,
    kesim: bars.reduce((s, b) => s + b.kesim, 0),
    artiklar: bars.map(b => b.fire).filter(x => x > 0)
  };
}

/* Planı kurar: 1) hazır standart parça varsa kesimsiz çıkış  2) kalanı çubuktan kesim
   3) fire hesaba KATILMAZ (karburAssigns ile kullanıcı seçtiyse o parça plandan düşer) */
function karburComputePlan(){
  const demands = karburBuildDemands();
  const direct = [], hatalar = [], bekleyen = [], byFam = {};

  demands.forEach(d => {
    if(d.hata){ hatalar.push(d); return; }
    if(d.bekliyor){ bekleyen.push(d); return; }
    let kalan = d.adet;
    const hazir = karburFamHazir(d.fam, d.boy);
    if(hazir){
      const stok = karburStokAdet(hazir.id);
      const ver = Math.min(kalan, stok);
      if(ver > 0){ direct.push({ ri: d.ri, isEmri: d.isEmri, item: hazir, boy: d.boy, adet: ver, stok }); kalan -= ver; }
      if(kalan > 0) direct.push({ ri: d.ri, isEmri: d.isEmri, item: hazir, boy: d.boy, adet: 0, eksik: kalan, stok });
    }
    for(let k = 0; k < kalan; k++){
      const key = karburFamKey(d.fam);
      (byFam[key] = byFam[key] || { fam: d.fam, pieces: [] }).pieces.push({
        key: d.ri + ':' + k, ri: d.ri, isEmri: d.isEmri, boy: d.boy
      });
    }
  });

  const cut = [];
  Object.keys(byFam).sort().forEach(key => {
    const g = byFam[key];
    const pieces = g.pieces.filter(p => !karburAssigns[p.key]);
    const rods = karburFamCubuklar(g.fam);
    if(!rods.length){ cut.push({ fam: g.fam, key, rodYok: true, pieces: g.pieces }); return; }
    /* En uygun çubuk boyunu program seçer: en az çubuk → en az mm → en az kesim.
       Stok yetmeyen seçenekler ikinci plana atılır ama gizlenmez. */
    const secenekler = rods.map(item => Object.assign({ item, stok: karburStokAdet(item.id) }, karburPack(item, pieces)))
      .sort((a, b) => (a.cubuk - b.cubuk) || (a.mm - b.mm) || (a.kesim - b.kesim));
    const uygun = secenekler.filter(s => s.stok >= s.cubuk);
    const varsayilan = uygun[0] || secenekler[0];
    const secili = karburRodPick[key] ? (secenekler.find(s => s.item.kod === karburRodPick[key]) || varsayilan) : varsayilan;
    cut.push({ fam: g.fam, key, secili, secenekler, yetersiz: secili.stok < secili.cubuk, bosPlan: !pieces.length });
  });

  /* Adet olarak verilecekler — kesim mantigina hic girmez, dogrudan stoktan dusulur. */
  const adetCikis = [];
  karburAdetRows.forEach((r, ri) => {
    const adet = parseInt(r.adet, 10);
    const it = r.katalogId ? karburKatalogArray().find(k => k.id === r.katalogId) : null;
    if(!it || !(adet > 0)){
      if(r.katalogId || r.adet || r.isEmri) adetCikis.push({ ri, r, hata: it ? 'adet girilmedi' : 'kalem seçilmedi' });
      return;
    }
    const stok = karburStokAdet(it.id);
    adetCikis.push({ ri, isEmri: (r.isEmri || '').trim(), item: it, adet, stok, yetersiz: adet > stok });
  });

  return { direct, cut, hatalar, bekleyen, adetCikis };
}

function karburPlanTotals(plan){
  let cubuk = 0, kesim = 0, mm = 0, artiklar = [];
  plan.cut.forEach(g => {
    if(!g.secili) return;
    cubuk += g.secili.cubuk; kesim += g.secili.kesim; mm += g.secili.mm;
    artiklar = artiklar.concat(g.secili.artiklar);
  });
  const adetToplam = (plan.adetCikis || []).reduce((s, d) => s + (d.hata ? 0 : d.adet), 0);
  return { cubuk, kesim, mm, artiklar, adetToplam, kesimsiz: plan.direct.reduce((s, d) => s + d.adet, 0) };
}

/* ---------- fire adayları: YALNIZCA dış çap filtresi ----------
   Delik ve kalite bilgi olarak gösterilir (farklıysa etiketlenir) — kararı kullanıcı verir. */
function karburDemandPiece(key){
  const ri = String(key).split(':')[0];
  const d = karburBuildDemands().find(x => String(x.ri) === ri && !x.hata && !x.bekliyor);
  return d ? { key, ri: d.ri, isEmri: d.isEmri, boy: d.boy, fam: d.fam } : null;
}
function karburFireById(id){ const f = karburFire[id]; return f ? { id, ...f } : null; }
function karburCountAssigned(fireId){ return Object.values(karburAssigns).filter(v => v === fireId).length; }
function karburCandidates(piece){
  return karburFireArray()
    .filter(f => f.disCap === piece.fam.disCap)
    .filter(f => (Number(f.adet) || 0) - karburCountAssigned(f.id) > 0)
    .map(f => {
      const tam = Math.abs(f.boy - piece.boy) < 0.001;                  // kesim gerekmez
      const kesilebilir = f.boy + 0.001 >= piece.boy + karburPay;
      return { f, tam, kesilebilir, kalan: tam ? 0 : Math.round((f.boy - piece.boy - karburPay) * 100) / 100 };
    })
    .filter(c => c.tam || c.kesilebilir)
    .sort((a, b) => (b.tam - a.tam) || (a.kalan - b.kalan));
}

/* ==================== GİRİŞ SATIRLARI ==================== */
function karburAddRow(){ karburRows.push({ isEmri: '', disCap: '', delik: '', kalite: '', boy: '', adet: '' }); karburResetPlan(); render(); }
function karburRemoveRow(i){ karburRows.splice(i, 1); karburResetPlan(); render(); }
function karburSetRow(i, f, v){ if(karburRows[i]) karburRows[i][f] = v; }
function karburSetRowSel(i, f, v){
  if(!karburRows[i]) return;
  karburRows[i][f] = v;
  if(f === 'disCap'){ karburRows[i].delik = ''; karburRows[i].kalite = ''; }
  if(f === 'delik'){ karburRows[i].kalite = ''; }
  karburResetPlan(); render();
}
function karburSetRowFam(i, v){
  if(!v || !karburRows[i]) return;
  const parts = String(v).split('|');
  karburRows[i].delik = parts[0]; karburRows[i].kalite = parts[1];
  karburResetPlan(); render();
}
/* ---------- adet olarak verilecekler (kesim planina girmeyen kalemler) ---------- */
function karburAddAdetRow(){ karburAdetRows.push({ isEmri: '', katalogId: '', adet: '' }); karburResetPlan(); render(); }
function karburRemoveAdetRow(i){ karburAdetRows.splice(i, 1); karburResetPlan(); render(); }
function karburSetAdetRow(i, f, v){ if(karburAdetRows[i]) karburAdetRows[i][f] = v; }
function karburSetAdetRowSel(i, f, v){ if(!karburAdetRows[i]) return; karburAdetRows[i][f] = v; karburResetPlan(); render(); }

function karburSetPay(v){ const n = karburNum(v); if(n >= 0) karburPay = n; karburResetPlan(); }
function karburResetPlan(){ karburBasePlan = null; karburAssigns = {}; karburRodPick = {}; karburSaveSummary = null; karburEksikUyari = null; karburPlanNo = null; }
function karburHesapla(){ karburResetPlan(); karburPlanNo = karburYeniPlanNo(); karburBasePlan = karburComputePlan(); render(); }
function karburPlanTemizle(){ karburRows = []; karburAdetRows = []; karburResetPlan(); render(); }
function karburSetRodPick(key, kod){ karburRodPick[key] = kod; karburSaveSummary = null; karburEksikUyari = null; render(); }
function karburOpenPicker(key){ karburPickerFor = key; render(); }
function karburClosePicker(){ karburPickerFor = null; render(); }
function karburPickFire(key, fireId){
  if(!karburBasePlan) karburBasePlan = karburComputePlan();
  karburAssigns[key] = fireId; karburPickerFor = null; karburSaveSummary = null; karburEksikUyari = null; render();
}
function karburUndoAssign(key){ delete karburAssigns[key]; karburSaveSummary = null; karburEksikUyari = null; render(); }

/* ==================== KAYDET ====================
   Stok düşümleri transaction ile yapılır. Çelik modülündeki consumeStock yerel değerden
   read-modify-write yapıyor (js/state.js:395) — iki kişi aynı anda kesim kaydederse bir düşüm
   kaybolur. Bu hata burada tekrarlanmıyor.
   Yazılan hareketler iş emri bazlı mm tüketimini taşır (isEmriNo = <no>_ELMAS).

   ÜÇ KATMANLI NEGATİF STOK KORUMASI (bkz. karburEksikListesi):
     1) Ekranda: eksik varsa KAYDET düğmesi kapalı, gerekçesi listelenir.
     2) Kayıtta: önce yerel, sonra TAZE okunan stokla doğrulanır — eksik varsa hiçbir yazma yapılmaz.
     3) Transaction içinde: sonuç negatife düşecekse işlem iptal edilir (araya giren başka bir
        kayda karşı son savunma). İptal olursa commit olmuş kardeş düşümler geri alınır — aksi
        halde kısmi düşüm kalır ve hiçbir hareket kaydı yazılmadığı için izi de bulunmaz.

   Negatif stok yasak, çünkü buradaki her sayı (fire havuzu, iş emri mm'si, sayım farkı) stok
   adedinden türüyor. Sayı fiilen yanlışsa doğru yol Stok & Fire'dan sayım düzeltmesidir: orada
   fark `sayim` hareketi olarak kaydedilir ve kim ne zaman düzeltmiş belli olur. */

/* Planı yazılacak hareketlere ve stok düşümlerine çevirir. SAF: hiçbir şey yazmaz, hiçbir
   modül durumunu değiştirmez. Hem KAYDET hem de ekrandaki eksik kontrolü bu fonksiyonu
   kullanır — iki ayrı toplama mantığı zamanla birbirinden ayrılmasın diye. */
function karburCikisHazirla(plan){
  const cikisAdet = {};    // katalogId -> düşülecek adet
  const hareketler = [];   // yazılacak hareket kayıtları
  const fireDus = {};      // fireId -> tüketilen adet
  const fireEkle = [];     // { disCap, delik, kalite, boy }
  const stokAciklama = {}; // katalogId -> çubuk tüketimi hareketinin açıklaması
  let hurdaMm = 0;         // eşik altı artıklar — yalnızca kayıt özetinde gösterilir, saklanmaz

  plan.direct.forEach(d => {
    if(d.adet <= 0) return;
    cikisAdet[d.item.id] = (cikisAdet[d.item.id] || 0) + d.adet;
    hareketler.push({ tip: 'kesimsiz', katalogId: d.item.id, kod: d.item.kod, boy: d.boy,
      adet: -d.adet, parca: d.adet, isEmriNo: karburIsEmriKey(d.isEmri), mm: d.boy * d.adet,
      aciklama: d.adet + ' adet × ' + karburFmt(d.boy) + ' mm — standart boy, kesim yok' });
  });

  (plan.adetCikis || []).forEach(d => {
    if(d.hata) return;
    cikisAdet[d.item.id] = (cikisAdet[d.item.id] || 0) + d.adet;
    hareketler.push({ tip: 'adet_cikis', katalogId: d.item.id, kod: d.item.kod, boy: d.item.boy || 0,
      adet: -d.adet, parca: d.adet, isEmriNo: karburIsEmriKey(d.isEmri),
      /* Boyu bilinen (üç ölçülü) kalemlerde mm de kaydedilir; 4 ölçülü kalemlerde boy
         bilinmediği için yalnızca adet anlamlı. */
      mm: d.item.boy ? d.item.boy * d.adet : 0,
      aciklama: d.adet + ' adet — kesilmeden verildi' });
  });

  plan.cut.forEach(g => {
    if(!g.secili || !g.secili.cubuk) return;
    const it = g.secili.item;
    cikisAdet[it.id] = (cikisAdet[it.id] || 0) + g.secili.cubuk;
    /* İş emri bazlı tahsis: her iş emrinin bu gruptan aldığı parça sayısı ve mm. */
    const perIs = {};
    g.secili.bars.forEach(b => {
      b.pieces.forEach(p => {
        const k = karburIsEmriKey(p.isEmri);
        const o = (perIs[k] = perIs[k] || { parca: 0, mm: 0, boylar: {} });
        o.parca += 1; o.mm += p.boy + karburPay;
        o.boylar[p.boy] = (o.boylar[p.boy] || 0) + 1;
      });
      /* Eşik altı artık HURDA: havuza hiç girmiyor, hakkında kayıt tutulmuyor. */
      if(b.fire > 0){
        if(b.fire < karburHurdaEsigi()) hurdaMm += b.fire;
        else fireEkle.push({ disCap: g.fam.disCap, delik: g.fam.delik, kalite: g.fam.kalite, boy: b.fire });
      }
    });

    /* (a) Çubuk tüketimi — PLAN başına tek stok hareketi, iş emrine atfedilmez. */
    stokAciklama[it.id] = g.secili.cubuk + ' çubuk × ' + karburFmt(it.boy) + ' mm, ' + g.secili.kesim + ' kesim';

    /* (b) İş emri tahsisleri — stok değişimi değil, bu yüzden adet alanı YOK. */
    Object.keys(perIs).forEach(k => {
      const o = perIs[k];
      const boyMetni = Object.keys(o.boylar).sort((a, b) => b - a)
        .map(b => o.boylar[b] + ' × ' + karburFmt(karburNum(b) + karburPay) + ' mm').join(' + ');
      hareketler.push({ tip: 'tahsis', katalogId: it.id, kod: it.kod, parca: o.parca,
        isEmriNo: k, mm: o.mm, aciklama: boyMetni + ' (' + it.kod + ')' });
    });
  });

  Object.keys(karburAssigns).forEach(key => {
    const p = karburDemandPiece(key), f = karburFireById(karburAssigns[key]);
    if(!p || !f) return;
    const tam = Math.abs(f.boy - p.boy) < 0.001;
    fireDus[f.id] = (fireDus[f.id] || 0) + 1;
    hareketler.push({ tip: 'fire_kullanim', fireId: f.id,
      kod: 'Ø' + karburFmt(f.disCap) + ' ' + f.kalite + ' ' + karburFmt(f.boy) + 'mm fire',
      boy: p.boy, adet: -1, parca: 1, isEmriNo: karburIsEmriKey(p.isEmri), mm: tam ? p.boy : p.boy + karburPay,
      aciklama: tam ? 'tam eşleşme — kesim yok' : 'fireden kesildi, ' + karburFmt(f.boy - p.boy - karburPay) + ' mm kaldı' });
    const kalan = tam ? 0 : Math.round((f.boy - p.boy - karburPay) * 100) / 100;
    if(kalan > 0){
      if(kalan < karburHurdaEsigi()) hurdaMm += kalan;      // eşik altı: hurda, kaydedilmez
      else fireEkle.push({ disCap: f.disCap, delik: f.delik, kalite: f.kalite, boy: kalan });
    }
  });

  return { cikisAdet, hareketler, fireDus, fireEkle, stokAciklama, hurdaMm };
}

/* Stok yetmeyen kalemleri döndürür. TOPLAM üzerinden bakar: aynı kalem birden fazla satırda
   (kesimsiz çıkış + adet çıkışı + kesim) geçebiliyor ve her satır tek başına stoğa sığıyor
   olsa bile toplamı aşabiliyordu — satır bazlı "yetersiz" rozeti bunu göremiyordu.
   stokMap/fireMap dışarıdan veriliyor ki aynı fonksiyon hem yerel kopyayla (ekran) hem de
   taze okunan veriyle (kayıt anı) çalışsın. */
function karburEksikListesi(hazirlik, stokMap, fireMap){
  const eksik = [];
  Object.keys(hazirlik.cikisAdet).forEach(id => {
    const gereken = hazirlik.cikisAdet[id];
    const mevcut = Number(((stokMap || {})[id] || {}).adet) || 0;
    if(gereken > mevcut){
      const it = karburKatalogArray().find(k => k.id === id);
      eksik.push({ tur: 'stok', kod: it ? it.kod : id, gereken, mevcut });
    }
  });
  Object.keys(hazirlik.fireDus).forEach(id => {
    const gereken = hazirlik.fireDus[id];
    const f = (fireMap || {})[id] || {};
    const mevcut = Number(f.adet) || 0;
    if(gereken > mevcut){
      eksik.push({ tur: 'fire', gereken, mevcut,
        kod: 'Ø' + karburFmt(f.disCap) + ' ' + (f.kalite || '') + ' ' + karburFmt(f.boy) + ' mm fire' });
    }
  });
  return eksik;
}

/* Ekranın kullandığı hâli — yerel kopyalarla, ağ trafiği yok. */
function karburPlanEksikleri(plan){
  return karburEksikListesi(karburCikisHazirla(plan), karburStok, karburFire);
}

function karburPlanKaydet(){
  if(!canManageKarbur() || karburBusy) return;
  const plan = karburComputePlan();
  const t = karburPlanTotals(plan);
  if(!t.kesimsiz && !t.cubuk && !t.adetToplam && !Object.keys(karburAssigns).length){ toast('Kaydedilecek çıkış yok'); return; }
  const planNo = karburPlanNo || karburYeniPlanNo();

  const hazirlik = karburCikisHazirla(plan);
  const cikisAdet = hazirlik.cikisAdet, hareketler = hazirlik.hareketler,
        fireDus = hazirlik.fireDus, fireEkle = hazirlik.fireEkle,
        stokAciklama = hazirlik.stokAciklama, hurdaMm = hazirlik.hurdaMm;

  /* 1. katman — yerel veriyle bak, ağa hiç çıkmadan durdur. */
  const yerelEksik = karburEksikListesi(hazirlik, karburStok, karburFire);
  if(yerelEksik.length){
    karburEksikUyari = { eksik: yerelEksik, bayat: false };
    toast('Stok yetersiz — kayıt yapılmadı');
    render();
    return;
  }

  karburBusy = true; karburEksikUyari = null; render();
  const now = Date.now();

  /* 2. katman — TAZE stokla doğrula. Plan burada YENİDEN KURULMUYOR: ekrandakinden farklı bir
     planı sessizce kaydetmek, yazdırılan kâğıt ile kaydı birbirinden ayırırdı. Bunun yerine
     kullanıcıdan HESAPLA'ya basıp planı yenilemesi isteniyor. */
  Promise.all([DB.ref('karburStok').once('value'), DB.ref('karburFire').once('value')]).then(snaps => {
    const tazeStok = snaps[0].val() || {}, tazeFire = snaps[1].val() || {};
    karburStok = tazeStok; karburFire = tazeFire;
    karburStokReady = true; karburFireReady = true;
    const tazeEksik = karburEksikListesi(hazirlik, tazeStok, tazeFire);
    if(tazeEksik.length){
      karburBusy = false;
      karburEksikUyari = { eksik: tazeEksik, bayat: true };
      toast('Stok bu arada değişmiş — kayıt yapılmadı');
      render();
      return null;
    }
    return karburStokDus(cikisAdet, fireDus);
  }).then(results => {
    if(!results) return;      // taze kontrolde durduysak devam etme

    const updates = {};
    results.forEach(r => {
      updates[(r.tip === 'stok' ? 'karburStok/' : 'karburFire/') + r.id + '/sonHareketTs'] = now;
    });

    /* Çubuk tüketimini belgeleyen stok hareketleri — onceki/sonraki adet transaction'ın
       KENDİ sonucundan türetiliyor, kendi hesapladığımız (yarışabilecek) değerden değil. */
    results.filter(r => r.tip === 'stok' && stokAciklama[r.id]).forEach(r => {
      const it = karburKatalogArray().find(k => k.id === r.id);
      hareketler.push({ tip: 'kesim', katalogId: r.id, kod: it ? it.kod : r.id,
        adet: -cikisAdet[r.id], oncekiAdet: r.sonraki + cikisAdet[r.id], sonrakiAdet: r.sonraki,
        isEmriNo: '', mm: 0, aciklama: stokAciklama[r.id] });
    });

    /* Yeni artıkları havuza ekle — aynı (çap|delik|kalite|boy) varsa adedi artır.

       İKİ HATA BURADA KAPATILDI (ikisi de sahada görüldü, 2 × 24 mm artık kayboldu / ölçü
       ikiye bölündü):

       1) ÖNCE AYNI BOYLAR TOPLANIR, sonra yaz/artır kararı verilir. Eskiden her artık tek tek
          işleniyordu: aynı planda aynı boydan iki artık çıkınca birincisi `updates` ile YENİ
          düğüm yazıyor, ikincisi aynı düğüme transaction ile +1 yapıyordu — transaction'lar
          toplu yazmadan ÖNCE koştuğu için sonraki `update` artırmayı eziyordu. Artık mevcut
          düğüme yalnızca transaction, yeni düğüme yalnızca toplu yazma gidiyor.

       2) Karar TAZE havuz verisiyle veriliyor. Yerel `karburFire` kopyası bayatsa (başka bir
          sekme/oturum kaydettiyse) var olan ölçü bulunamıyor ve aynı ölçü için ikinci bir düğüm
          açılıyordu — toplam doğru kalıyor ama havuz aynı ölçüyü iki satır gösteriyordu.
          Kayıt başına tek küçük okuma; render başına değil, maliyet ihmal edilebilir. */
    const fireArtis = {};
    const fireGrup = {};
    fireEkle.forEach(a => {
      const k = a.disCap + '|' + a.delik + '|' + a.kalite + '|' + a.boy;
      (fireGrup[k] = fireGrup[k] || { ...a, sayi: 0 }).sayi += 1;
    });
    const fireGrupListe = Object.values(fireGrup);
    const fireHazirla = fireGrupListe.length
      ? DB.ref('karburFire').once('value').then(snap => { karburFire = snap.val() || {}; })
                            .catch(() => {})     // okunamazsa yerel kopyayla devam
      : Promise.resolve();

    return fireHazirla.then(() => {
    fireGrupListe.forEach(a => {
      const mevcut = karburFireArray().find(f => f.disCap === a.disCap && f.delik === a.delik &&
        f.kalite === a.kalite && Math.abs(f.boy - a.boy) < 0.001);
      let fid;
      if(mevcut){
        fireArtis[mevcut.id] = (fireArtis[mevcut.id] || 0) + a.sayi;
        updates['karburFire/' + mevcut.id + '/sonHareketTs'] = now;   // artırılan kayıtta da tarih tazelenir
        fid = mevcut.id;
      }else{
        const id = DB.ref('karburFire').push().key;
        const rec = { disCap: a.disCap, delik: a.delik, kalite: a.kalite, boy: a.boy, adet: a.sayi, sonHareketTs: now };
        updates['karburFire/' + id] = rec;
        karburFire[id] = rec;
        fid = id;
      }
      /* Planın ÜRETTİĞİ artık da kayda geçiyor. İki sebep: (1) geçmişte plan başına yalnızca
         "ne gitti" görünüyor, "ne geri geldi" görünmüyordu; (2) plan geri alınırken hangi havuz
         kaydından ne düşüleceği başka türlü bilinemez — plan saklanmıyor, artıklar da fungible
         olduğu için sonradan türetilemez.
         Havuz düğümüne "bu plandan geldi" diye bir alan YAZILMIYOR: aynı düğüm başka planların
         artıklarıyla da artıyor, tek bir plan numarası orada yanıltıcı olurdu. Doğru yer bu
         hareket kaydı. */
      hareketler.push({ tip: 'fire_uretim', fireId: fid, kod: karburFireKodu(a), boy: a.boy,
        adet: a.sayi, isEmriNo: '', mm: a.boy * a.sayi, aciklama: 'kesimden artan' });
    });

    hareketler.forEach(h => {
      const id = DB.ref('karburHareketleri').push().key;
      updates['karburHareketleri/' + id] = Object.assign({
        planNo, kaynak: 'plan', operatorUsername: session.username, operatorName: session.displayName, ts: now
      }, h);
    });

    const fireArtisTxs = Object.keys(fireArtis).map(id =>
      DB.ref('karburFire/' + id + '/adet').transaction(cur => (Number(cur) || 0) + fireArtis[id])
    );

    /* Is emri ozeti — denormalize. Rota/rapor ekrani hareketleri taramak yerine tek kucuk
       dugum okuyabilsin diye (canli dinleyici yok, okuma yuku sabit). Ana is emri numarasiyla
       tutulur; ayni is emrine sonradan baska cikis olursa uzerine EKLENIR. */
    /* Özet YALNIZCA iş emrine atfedilebilen kayıtlardan toplanır (tahsis / adet_cikis /
       kesimsiz / fire_kullanim). Çubuk sayısı kasıtlı olarak YOK: bir çubuk birden fazla iş
       emrine hizmet ettiği için iş emri başına "çubuk" diye bir büyüklük tanımlı değil —
       önceki sürümde planın toplam çubuğu her iş emrine ayrı ayrı yazılıyordu, o hataydı. */
    const ozetEk = {};
    hareketler.forEach(h => {
      if(!h.isEmriNo) return;
      const base = karburBaseIsEmri(h.isEmriNo);
      if(!base) return;
      const o = (ozetEk[base] = ozetEk[base] || { mm: 0, parca: 0 });
      o.mm += Number(h.mm) || 0;
      o.parca += Number(h.parca) || 0;
    });
    const ozetTxs = Object.keys(ozetEk).map(base =>
      DB.ref('karburIsEmriOzet/' + base).transaction(cur => {
        const c = cur || {};
        const yeni = {
          mm: (Number(c.mm) || 0) + ozetEk[base].mm,
          parca: (Number(c.parca) || 0) + ozetEk[base].parca,
          sonPlanNo: planNo, sonTs: now
        };
        if(c.cubuk != null) yeni.cubuk = null;   // eski hatalı alan varsa temizlenir
        return yeni;
      })
    );

    Promise.all(fireArtisTxs.concat(ozetTxs)).then(() => karburChunkedUpdate(updates)).then(() => {
      karburBusy = false;
      karburSaveSummary = {
        planNo,
        isEmriMm: hareketler.reduce((acc, h) => {
          if(h.isEmriNo) acc[h.isEmriNo] = (acc[h.isEmriNo] || 0) + (h.mm || 0);
          return acc;
        }, {}),
        cikisAdet, fireDus, fireEkle,
        hurdaMm,
        kodlar: Object.keys(cikisAdet).reduce((acc, id) => {
          const it = karburKatalogArray().find(k => k.id === id);
          acc[id] = it ? it.kod : id; return acc;
        }, {})
      };
      const kaydedilenOzet = karburSaveSummary;
      karburRows = []; karburAdetRows = []; karburResetPlan();
      karburSaveSummary = kaydedilenOzet;      // resetPlan ozeti siliyor, kayit sonrasi gorunsun
      /* Operatör ekranındaki "karbür çıkışı yapıldı" şeridi bu iş emirleri için önbellekte
         "kayıt yok" olarak duruyor olabilir — önbellek kalıcı, süresi dolmuyor. Temizlenmezse
         kaydı yapan cihazda şerit sayfa yenilenene kadar görünmüyordu. */
      Object.keys(ozetEk).forEach(base => { delete karburOzetCache[base]; });
      /* Yazan cihaz kendi yazdığını görsün — yerel kopyalar tazelenir */
      ensureKarburStokLoaded(() => safeRender(), true);
      ensureKarburFireLoaded(() => safeRender(), true);
      toast('Karbür çıkışı kaydedildi');
      render();
    }).catch(err => { karburBusy = false; toast('Kayıt hatası: ' + ((err && err.message) || 'bilinmeyen')); render(); });
    });   // fireHazirla.then
  }).catch(err => {
    karburBusy = false;
    /* Yerel kopya bayat kaldıysa kullanıcı eski sayıları görmesin */
    ensureKarburStokLoaded(() => safeRender(), true);
    ensureKarburFireLoaded(() => safeRender(), true);
    toast('Stok düşülemedi: ' + ((err && err.message) || 'bilinmeyen'));
    render();
  });
}

/* Stok ve fire düşümlerini yapar. Her transaction sonucu negatife düşürecekse İPTAL edilir —
   `undefined` döndürmek transaction'ı commit etmeden bırakır.

   Kardeşlerden biri iptal olursa commit olmuş olanlar GERİ ALINIR: düşümler paralel koşuyor,
   biri düşüp diğeri düşmezse ve akış orada kesilirse ortada hiçbir hareket kaydı olmayan kısmi
   bir stok düşümü kalırdı — sayım tutmaz, izi de bulunmaz. Geri alma da transaction ile yapılır
   ki bu arada başkasının yaptığı bir düşüm ezilmesin. */
function karburStokDus(cikisAdet, fireDus){
  const istekler = []
    .concat(Object.keys(cikisAdet).map(id => ({ tip: 'stok', id, yol: 'karburStok/' + id + '/adet', miktar: cikisAdet[id] })))
    .concat(Object.keys(fireDus).map(id => ({ tip: 'fire', id, yol: 'karburFire/' + id + '/adet', miktar: fireDus[id] })));

  return Promise.all(istekler.map(x =>
    DB.ref(x.yol).transaction(cur => {
      const sonraki = (Number(cur) || 0) - x.miktar;
      return sonraki < 0 ? undefined : sonraki;      // negatife düşecekse iptal
    }).then(res => Object.assign({ ok: res.committed, sonraki: Number(res.snapshot && res.snapshot.val()) || 0 }, x))
  )).then(results => {
    const basarisiz = results.filter(r => !r.ok);
    if(!basarisiz.length) return results;
    const geriAl = results.filter(r => r.ok).map(r =>
      DB.ref(r.yol).transaction(cur => (Number(cur) || 0) + r.miktar).catch(() => {})
    );
    return Promise.all(geriAl).then(() => {
      const kodlar = basarisiz.map(r => {
        if(r.tip === 'fire') return 'fire havuzu';
        const it = karburKatalogArray().find(k => k.id === r.id);
        return it ? it.kod : r.id;
      });
      throw new Error(kodlar.join(', ') + ' için stok yetmedi — hiçbir düşüm yapılmadı, HESAPLA ile planı yenile');
    });
  });
}

/* ==================== PLAN GERİ ALMA ====================
   Terminal başında yanlış iş emri no'su ya da yanlış adet girilmesi kaçınılmaz. Geri dönüşü
   olmadığında tek çare stok için elle sayım, iş emri özeti içinse hiçbir şeydi — özet yalnızca
   topluyor, azaltma yolu yok.

   KAYIT SİLİNMEZ, TERS KAYIT YAZILIR (muhasebedeki gibi): plana ait hareketler `iptalTs` ile
   işaretlenir, geri alınan her düğüm için `tip:'iptal'` hareketi yazılır. Geçmiş ekranı planı
   iptal edilmiş olarak gösterir, ne yapıldığı okunabilir kalır.

   SIRA ÖNEMLİ: önce havuzdan DÜŞÜLECEKLER (planın ürettiği artıklar) yapılır, çünkü tek
   başarısız olabilecek adım odur — o artık bu arada başka bir işte kullanılmış olabilir.
   karburStokDus zaten negatife düşecekse iptal edip commit olan kardeşleri geri alıyor; aynı
   makineyi kullanıyoruz. Ancak ondan sonra iadeler yapılır.

   ESKİ PLANLAR: `fire_uretim` kayıtları bu sürümle geldi. Daha önce kaydedilmiş planlarda
   artıkların hangi havuz düğümüne gittiği bilinmiyor — o planlar geri alınırken stok ve özet
   düzeltilir, havuzdaki artık kullanıcıya bildirilip elle düzeltmesi istenir. Sessizce
   bırakılmaz. */
let karburIptalOnay = null;        // { planNo, kayitlar, stokEkle, fireEkle, fireDus, ozetDus, uyari }
let karburIptalYukleniyor = false;

function karburPlanIptalVazgec(){ karburIptalOnay = null; render(); }

/* Planın hareketlerini okur ve ne yapılacağını çıkarır — HİÇBİR ŞEY YAZMAZ. */
function karburPlanIptalIste(planNo){
  if(!canManageKarbur() || karburIptalYukleniyor || karburBusy) return;
  karburIptalYukleniyor = true; karburIptalOnay = null; render();
  DB.ref('karburHareketleri').orderByChild('planNo').equalTo(planNo).once('value').then(snap => {
    karburIptalYukleniyor = false;
    const kayitlar = Object.entries(snap.val() || {}).map(([id, x]) => ({ id, ...x }));
    if(!kayitlar.length){ toast('Bu plana ait hareket bulunamadı'); render(); return; }
    if(kayitlar.some(h => h.iptalTs || h.tip === 'iptal')){ toast('Bu plan zaten geri alınmış'); render(); return; }

    const stokEkle = {};   // katalogId -> iade edilecek adet
    const fireEkle = {};   // fireId    -> iade edilecek adet (planın TÜKETTİĞİ fire)
    const fireDus  = {};   // fireId    -> havuzdan düşülecek adet (planın ÜRETTİĞİ artık)
    const ozetDus  = {};   // ana iş emri no -> { mm, parca }

    kayitlar.forEach(h => {
      const adet = Number(h.adet) || 0;
      if(h.tip === 'fire_uretim'){ if(adet > 0) fireDus[h.fireId] = (fireDus[h.fireId] || 0) + adet; }
      else if(adet < 0){
        /* Stok değişimi olan her kayıt: kesim / kesimsiz / adet_cikis (katalogId) ve
           fire_kullanim (fireId). 'tahsis' kayıtlarında adet yok, kendiliğinden dışarıda kalır. */
        if(h.katalogId) stokEkle[h.katalogId] = (stokEkle[h.katalogId] || 0) + (-adet);
        else if(h.fireId) fireEkle[h.fireId] = (fireEkle[h.fireId] || 0) + (-adet);
      }
      if(h.isEmriNo){
        const base = karburBaseIsEmri(h.isEmriNo);
        if(base){
          const o = (ozetDus[base] = ozetDus[base] || { mm: 0, parca: 0 });
          o.mm += Number(h.mm) || 0;
          o.parca += Number(h.parca) || 0;
        }
      }
    });

    const cubukVar = kayitlar.some(h => h.tip === 'kesim');
    const uretimVar = kayitlar.some(h => h.tip === 'fire_uretim');
    karburIptalOnay = { planNo, kayitlar, stokEkle, fireEkle, fireDus, ozetDus,
      /* Eski plan: kesim yapılmış ama artıkların nereye gittiği kayıtlı değil. */
      uyari: (cubukVar && !uretimVar) ? 'artik-bilinmiyor' : null };
    render();
  }).catch(err => {
    karburIptalYukleniyor = false;
    toast('Plan okunamadı: ' + ((err && err.message) || 'hata'));
    render();
  });
}

function karburPlanIptalUygula(){
  const o = karburIptalOnay;
  if(!o || !canManageKarbur() || karburBusy) return;
  karburBusy = true; render();
  const now = Date.now();
  const hareketler = [];

  /* 1) Önce havuzdan düşülecekler — tek başarısız olabilecek adım. Planın ürettiği artık bu
        arada başka bir işte kullanılmışsa havuzda yok; o zaman hiçbir şey yapılmadan durulur. */
  karburStokDus({}, o.fireDus).then(dusResults => {
    dusResults.forEach(r => {
      hareketler.push({ tip: 'iptal', fireId: r.id, kod: karburFireKodu(karburFireById(r.id) || {}),
        adet: -r.miktar, oncekiAdet: r.sonraki + r.miktar, sonrakiAdet: r.sonraki,
        isEmriNo: '', mm: 0, aciklama: 'plan geri alındı — kesimden artan havuzdan çıkarıldı' });
    });

    /* 2) İadeler. Bunlar artırma olduğu için negatife düşme riski yok, iptal edilemezler. */
    const iadeler = []
      .concat(Object.keys(o.stokEkle).map(id => ({ tur: 'stok', id, yol: 'karburStok/' + id + '/adet', miktar: o.stokEkle[id] })))
      .concat(Object.keys(o.fireEkle).map(id => ({ tur: 'fire', id, yol: 'karburFire/' + id + '/adet', miktar: o.fireEkle[id] })));
    return Promise.all(iadeler.map(x =>
      DB.ref(x.yol).transaction(cur => (Number(cur) || 0) + x.miktar)
        .then(res => Object.assign({ sonraki: Number(res.snapshot && res.snapshot.val()) || 0 }, x))
    ));
  }).then(iadeResults => {
    const updates = {};
    iadeResults.forEach(r => {
      /* Etiket kaydın TÜRÜNDEN seçilir, katalogda bulunup bulunmamasından değil. Katalog kaydı
         silinmiş bir stok kalemi olabilir — Console'dan elle silinen bir kalemin stok düğümü
         geride kalıyor (sahada bir tanesi var) — ve kod bulunamayınca fire etiketi basmak
         stok kaydını fire gibi gösterirdi. Kod yoksa düğüm id'si yazılır. */
      const kodMetni = r.tur === 'stok'
        ? ((karburKatalogArray().find(k => k.id === r.id) || {}).kod || r.id)
        : karburFireKodu(karburFireById(r.id) || {});
      updates[(r.tur === 'stok' ? 'karburStok/' : 'karburFire/') + r.id + '/sonHareketTs'] = now;
      hareketler.push({ tip: 'iptal', [r.tur === 'stok' ? 'katalogId' : 'fireId']: r.id,
        kod: kodMetni,
        adet: r.miktar, oncekiAdet: r.sonraki - r.miktar, sonrakiAdet: r.sonraki,
        isEmriNo: '', mm: 0, aciklama: 'plan geri alındı — stoğa iade' });
    });

    /* 3) Orijinal kayıtlar iptal olarak işaretlenir — silinmez, çift geri almayı da bu engeller. */
    o.kayitlar.forEach(h => {
      updates['karburHareketleri/' + h.id + '/iptalTs'] = now;
      updates['karburHareketleri/' + h.id + '/iptalBy'] = session.username;
    });
    hareketler.forEach(h => {
      const id = DB.ref('karburHareketleri').push().key;
      updates['karburHareketleri/' + id] = Object.assign({
        planNo: o.planNo, kaynak: 'iptal', operatorUsername: session.username,
        operatorName: session.displayName, ts: now
      }, h);
    });

    /* 4) İş emri özeti azaltılır; sıfıra inen kayıt tamamen silinir (o iş emrine karbür
          çıkmamış sayılır, operatör şeridi de kaybolmalı). */
    const ozetTxs = Object.keys(o.ozetDus).map(base =>
      DB.ref('karburIsEmriOzet/' + base).transaction(cur => {
        if(!cur) return cur;
        const mm = Math.round(((Number(cur.mm) || 0) - o.ozetDus[base].mm) * 100) / 100;
        const parca = (Number(cur.parca) || 0) - o.ozetDus[base].parca;
        if(mm <= 0.001 && parca <= 0) return null;          // null = düğümü sil
        return {
          mm: Math.max(0, mm), parca: Math.max(0, parca),
          /* Son plan iptal edilen plansa artık ona işaret etmek yanlış olur; önceki plan
             numarası bilinmediği için alan düşürülür. */
          sonPlanNo: cur.sonPlanNo === o.planNo ? null : cur.sonPlanNo,
          sonTs: now
        };
      })
    );

    return Promise.all(ozetTxs).then(() => karburChunkedUpdate(updates));
  }).then(() => {
    karburBusy = false;
    const planNo = karburIptalOnay ? karburIptalOnay.planNo : '';
    Object.keys(o.ozetDus).forEach(base => { delete karburOzetCache[base]; });
    karburIptalOnay = null;
    ensureKarburStokLoaded(() => safeRender(), true);
    ensureKarburFireLoaded(() => safeRender(), true);
    loadKarburHareketleri(200);
    toast(planNo + ' geri alındı');
    render();
  }).catch(err => {
    karburBusy = false;
    ensureKarburStokLoaded(() => safeRender(), true);
    ensureKarburFireLoaded(() => safeRender(), true);
    toast('Geri alınamadı: ' + ((err && err.message) || 'hata'));
    render();
  });
}

/* ==================== İŞ EMRİ TÜKETİM RAPORU ====================
   karburIsEmriOzet zaten denormalize ve sonTs index'li — "son N iş emri ne kadar karbür yedi"
   tek küçük sorgu. Canlı dinleyici yok, hareketler taranmıyor. */
let karburOzetListe = null, karburOzetListeYukleniyor = false, karburOzetListeHata = null;
function loadKarburIsEmriOzet(limit){
  if(karburOzetListeYukleniyor) return;
  karburOzetListeYukleniyor = true; karburOzetListeHata = null;
  DB.ref('karburIsEmriOzet').orderByChild('sonTs').limitToLast(limit || 150).once('value').then(snap => {
    karburOzetListeYukleniyor = false;
    karburOzetListe = Object.entries(snap.val() || {})
      .map(([no, x]) => ({ no, ...x }))
      .sort((a, b) => (b.sonTs || 0) - (a.sonTs || 0));
    safeRender();
  }).catch(err => {
    karburOzetListeYukleniyor = false;
    karburOzetListeHata = (err && err.message) || 'okuma hatası';
    safeRender();
  });
}

/* ==================== KATALOG & STOK YÖNETİMİ ==================== */
function karburKatalogEkle(){
  if(!canManageKarbur()) return;
  const kodEl = document.getElementById('karbur-yeni-kod');
  const adetEl = document.getElementById('karbur-yeni-adet');
  const kod = ((kodEl && kodEl.value) || '').trim().toUpperCase();
  const adet = parseInt((adetEl && adetEl.value) || '0', 10) || 0;
  const p = karburParseKod(kod);
  if(!p){ toast('Kod formatı: C18XH156X3XVA90 (dış çap / boy / delik / kalite)'); return; }
  if(karburKatalogArray().some(k => k.kod === p.kod)){ toast('Bu kod zaten kayıtlı'); return; }
  const id = DB.ref('karburKatalog').push().key, now = Date.now();
  const rec = { kod: p.kod, onek: p.onek, alanlar: p.alanlar, disCap: p.disCap, boy: p.boy,
                delik: p.delik, kalite: p.kalite, tur: p.tur, kullanim: p.kullanim,
                aktif: true, updatedTs: now, updatedBy: session.username };
  const updates = {};
  updates['karburKatalog/' + id] = rec;
  updates['karburStok/' + id] = { adet, sonHareketTs: now };
  if(adet > 0){
    const hid = DB.ref('karburHareketleri').push().key;
    updates['karburHareketleri/' + hid] = { tip: 'giris', katalogId: id, kod: p.kod, adet, oncekiAdet: 0,
      sonrakiAdet: adet, isEmriNo: '', mm: 0, aciklama: 'kalem açılışı', kaynak: 'elle',
      operatorUsername: session.username, operatorName: session.displayName, ts: now };
  }
  DB.ref().update(updates).then(() => {
    karburKatalog[id] = rec; karburStok[id] = { adet, sonHareketTs: now };
    bumpLocalKarburKatalogVersion();
    DB.ref('settings/karburKatalogVersion').set(firebase.database.ServerValue.increment(1));
    if(kodEl) kodEl.value = '';
    if(adetEl) adetEl.value = '';
    toast('Kalem eklendi: ' + p.kod);
    render();
  }).catch(err => toast('Eklenemedi: ' + ((err && err.message) || 'hata')));
}

/* Stok girişi (satın alma / iade) — adet artışı, transaction ile */
function karburStokGiris(){
  if(!canManageKarbur() || karburBusy) return;
  const kod = (karburGirisKod || '').trim().toUpperCase();
  const adet = parseInt(karburGirisAdet || '0', 10) || 0;
  if(!kod || adet <= 0){ toast('Kod ve adet girin'); return; }
  const it = karburKatalogArray().find(k => k.kod === kod);
  if(!it){ toast('Kod katalogda yok — önce kalem olarak ekleyin'); return; }
  karburBusy = true; render();
  DB.ref('karburStok/' + it.id + '/adet').transaction(cur => (Number(cur) || 0) + adet).then(res => {
    karburBusy = false;
    if(!res.committed){ toast('Giriş yapılamadı, tekrar deneyin'); render(); return; }
    const sonraki = Number(res.snapshot.val()) || 0, now = Date.now();
    const hid = DB.ref('karburHareketleri').push().key;
    const updates = {};
    updates['karburHareketleri/' + hid] = { tip: 'giris', katalogId: it.id, kod: it.kod, adet,
      oncekiAdet: sonraki - adet, sonrakiAdet: sonraki, isEmriNo: '', mm: 0, aciklama: 'stok girişi',
      kaynak: 'elle', operatorUsername: session.username, operatorName: session.displayName, ts: now };
    updates['karburStok/' + it.id + '/sonHareketTs'] = now;
    DB.ref().update(updates).then(() => {
      karburStok[it.id] = { adet: sonraki, sonHareketTs: now };
      karburGirisKod = ''; karburGirisAdet = '';
      toast('Giriş: ' + it.kod + ' +' + adet + ' (yeni: ' + sonraki + ')');
      render();
    });
  }).catch(err => { karburBusy = false; toast('Giriş hatası: ' + ((err && err.message) || 'hata')); render(); });
}

/* Sayım düzeltmesi — mutlak değere set, fark hareket olarak yazılır.

   Yeni adet mutlak yazılır (sayımın anlamı bu: "rafta şu kadar var"), ama `oncekiAdet` ve fark
   TRANSACTION'IN GÖRDÜĞÜ değerden alınır, yerel kopyadan değil. Yerel `karburStok` canlı
   dinlenmiyor; başka biri arada çıkış yaptıysa yeni adet yine doğru yazılırdı ama hareketteki
   önceki/fark yanlış olurdu — stok doğru, denetim izi yalan. Aynı hatanın kayıt yolundaki hâli
   KAYDET bölümünde kapatılmıştı. */
function karburSayimSet(katalogId, yeniAdetRaw){
  if(!canManageKarbur() || karburBusy) return;
  const yeni = parseInt(yeniAdetRaw, 10);
  if(isNaN(yeni) || yeni < 0) return;
  const it = karburKatalogArray().find(k => k.id === katalogId);
  if(!it) return;
  if(karburStokAdet(katalogId) === yeni) return;      // yerel kopyaya göre değişiklik yok, boşuna yazma
  karburBusy = true; render();
  let onceki = 0;
  DB.ref('karburStok/' + katalogId + '/adet').transaction(cur => { onceki = Number(cur) || 0; return yeni; }).then(res => {
    karburBusy = false;
    if(!res.committed){ toast('Güncellenemedi, tekrar deneyin'); render(); return; }
    if(onceki === yeni){ karburStok[katalogId] = { adet: yeni, sonHareketTs: (karburStok[katalogId]||{}).sonHareketTs }; render(); return; }
    const now = Date.now();
    const hid = DB.ref('karburHareketleri').push().key;
    const updates = {};
    updates['karburStok/' + katalogId + '/sonHareketTs'] = now;
    updates['karburHareketleri/' + hid] = { tip: 'sayim', katalogId, kod: it.kod, adet: yeni - onceki,
      oncekiAdet: onceki, sonrakiAdet: yeni, isEmriNo: '', mm: 0, aciklama: 'sayım düzeltmesi', kaynak: 'elle',
      operatorUsername: session.username, operatorName: session.displayName, ts: now };
    return DB.ref().update(updates).then(() => {
      karburStok[katalogId] = { adet: yeni, sonHareketTs: now };
      toast(it.kod + ': ' + onceki + ' → ' + yeni);
      render();
    });
  }).catch(err => { karburBusy = false; toast('Güncellenemedi: ' + ((err && err.message) || 'hata')); render(); });
}

function karburFireKodu(f){ return 'Ø' + karburFmt(f.disCap) + ' ' + (f.kalite || '') + ' ' + karburFmt(f.boy) + ' mm fire'; }

/* Fire havuzu elle düzeltme — parça kırılır, sistem dışı kullanılır, sayım farkı çıkar.
   `oncekiAdet` karburSayimSet ile aynı gerekçeyle transaction'ın gördüğü değerden alınır. */
function karburFireSet(fireId, yeniAdetRaw){
  if(!canManageKarbur() || karburBusy) return;
  const yeni = parseInt(yeniAdetRaw, 10);
  if(isNaN(yeni) || yeni < 0) return;
  const f = karburFireById(fireId);
  if(!f) return;
  if((Number(f.adet) || 0) === yeni) return;
  karburBusy = true; render();
  let onceki = 0;
  DB.ref('karburFire/' + fireId + '/adet').transaction(cur => { onceki = Number(cur) || 0; return yeni; }).then(res => {
    karburBusy = false;
    if(!res.committed){ toast('Güncellenemedi, tekrar deneyin'); render(); return; }
    karburFire[fireId] = Object.assign({}, karburFire[fireId], { adet: yeni });
    if(onceki === yeni){ render(); return; }
    const now = Date.now();
    const hid = DB.ref('karburHareketleri').push().key;
    const updates = {};
    updates['karburFire/' + fireId + '/sonHareketTs'] = now;
    updates['karburHareketleri/' + hid] = { tip: 'fire_sayim', fireId, kod: karburFireKodu(f),
      adet: yeni - onceki, oncekiAdet: onceki, sonrakiAdet: yeni, isEmriNo: '', mm: 0,
      aciklama: 'fire sayım düzeltmesi', kaynak: 'elle',
      operatorUsername: session.username, operatorName: session.displayName, ts: now };
    return DB.ref().update(updates).then(() => {
      karburFire[fireId] = { disCap: f.disCap, delik: f.delik, kalite: f.kalite, boy: f.boy, adet: yeni, sonHareketTs: now };
      toast('Fire güncellendi: ' + onceki + ' → ' + yeni);
      render();
    });
  }).catch(err => { karburBusy = false; toast('Güncellenemedi: ' + ((err && err.message) || 'hata')); render(); });
}

/* Var olan bir fire ölçüsüne EKLEME — mutlak sayım değil, artış. Eskiden karburFireSet'e
   (yerel adet + yeni adet) hesaplanıp veriliyordu: yerel kopya bayatsa aradaki değişiklik
   siliniyordu. Artış transaction ile yapılır, hareket de `fire_giris` olarak yazılır —
   çünkü bu bir sayım düzeltmesi değil, havuza giren malzeme. */
function karburFireArtir(fireId, adet){
  const f = karburFireById(fireId);
  if(!f || !(adet > 0) || karburBusy) return;
  karburBusy = true; render();
  DB.ref('karburFire/' + fireId + '/adet').transaction(cur => (Number(cur) || 0) + adet).then(res => {
    karburBusy = false;
    if(!res.committed){ toast('Eklenemedi, tekrar deneyin'); render(); return; }
    const sonraki = Number(res.snapshot.val()) || 0, now = Date.now();
    const hid = DB.ref('karburHareketleri').push().key;
    const updates = {};
    updates['karburFire/' + fireId + '/sonHareketTs'] = now;
    updates['karburHareketleri/' + hid] = { tip: 'fire_giris', fireId, kod: karburFireKodu(f),
      adet, oncekiAdet: sonraki - adet, sonrakiAdet: sonraki, isEmriNo: '', mm: 0,
      aciklama: 'fire havuzuna elle giriş', kaynak: 'elle',
      operatorUsername: session.username, operatorName: session.displayName, ts: now };
    return DB.ref().update(updates).then(() => {
      karburFire[fireId] = { disCap: f.disCap, delik: f.delik, kalite: f.kalite, boy: f.boy, adet: sonraki, sonHareketTs: now };
      karburFireFormTemizle();
      toast('Fire eklendi (yeni: ' + sonraki + ')');
      render();
    });
  }).catch(err => { karburBusy = false; toast('Eklenemedi: ' + ((err && err.message) || 'hata')); render(); });
}

/* Fire havuzuna elle ekleme (ilk kurulum / fiziksel sayım) */
function karburFireEkle(){
  if(!canManageKarbur()) return;
  const g = id => ((document.getElementById(id) || {}).value) || '';
  const disCap = karburNum(g('karbur-fire-cap')), boy = karburNum(g('karbur-fire-boy'));
  const delik = g('karbur-fire-delik').trim(), kalite = g('karbur-fire-kalite').trim().toUpperCase();
  const adet = parseInt(g('karbur-fire-adet'), 10) || 0;
  if(!(disCap > 0) || !(boy > 0) || adet <= 0){ toast('Çap, boy ve adet gerekli'); return; }
  const mevcut = karburFireArray().find(f => f.disCap === disCap && f.delik === delik &&
    f.kalite === kalite && Math.abs(f.boy - boy) < 0.001);
  if(mevcut){ karburFireArtir(mevcut.id, adet); return; }
  const id = DB.ref('karburFire').push().key, now = Date.now();
  const rec = { disCap, delik, kalite, boy, adet, sonHareketTs: now };
  const hid = DB.ref('karburHareketleri').push().key;
  const updates = {};
  updates['karburFire/' + id] = rec;
  updates['karburHareketleri/' + hid] = { tip: 'fire_giris', fireId: id, kod: karburFireKodu(rec),
    adet, oncekiAdet: 0, sonrakiAdet: adet, isEmriNo: '', mm: 0,
    aciklama: 'fire havuzuna elle giriş', kaynak: 'elle',
    operatorUsername: session.username, operatorName: session.displayName, ts: now };
  DB.ref().update(updates).then(() => {
    karburFire[id] = rec;
    karburFireFormTemizle();
    toast('Fire eklendi');
    render();
  }).catch(err => toast('Eklenemedi: ' + ((err && err.message) || 'hata')));
}
function karburFireFormTemizle(){
  ['karbur-fire-cap', 'karbur-fire-boy', 'karbur-fire-delik', 'karbur-fire-kalite', 'karbur-fire-adet']
    .forEach(x => { const el = document.getElementById(x); if(el) el.value = ''; });
}

/* ==================== EXCEL İLE İLK YÜKLEME ====================
   SheetJS index.html'de global olarak zaten yüklü (XLSX, bkz. index.html:17). Kolon eşleme
   toleranslı: KOD sütunu aranır, ADET/MİKTAR varsa okunur. Desen js/toolstock.js:325-470
   (iki aşamalı önizleme → onay) ile aynı; upsert yapar, hiçbir şey silmez. */
function karburExcelSec(ev){
  const file = ev && ev.target && ev.target.files && ev.target.files[0];
  if(!file) return;
  const rd = new FileReader();
  rd.onload = e => {
    try{
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const okunan = [], hatali = [];
      let adetSutunuVar = false;
      wb.SheetNames.forEach(sn => {
        const rowsRaw = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
        if(!rowsRaw.length) return;
        const head = (rowsRaw[0] || []).map(x => String(x).trim().toLowerCase());
        let kodIdx = head.findIndex(h => h.indexOf('kod') >= 0);
        const adetIdx = head.findIndex(h => h.indexOf('adet') >= 0 || h.indexOf('miktar') >= 0);
        if(adetIdx >= 0) adetSutunuVar = true;
        const basla = kodIdx >= 0 ? 1 : 0;
        if(kodIdx < 0) kodIdx = 0;   // başlık satırı yoksa ilk sütun kod kabul edilir
        for(let i = basla; i < rowsRaw.length; i++){
          const kod = String((rowsRaw[i] || [])[kodIdx] || '').trim().toUpperCase();
          if(!kod) continue;
          const p = karburParseKod(kod);
          if(!p){ hatali.push({ sheet: sn, kod }); continue; }
          /* adet: null = "Excel bu kalem için bir sayı söylemiyor" (sütun yok ya da hücre boş),
             0 = "sıfır" — geçerli bir sayım değeri. Eskiden ikisi de 0 sayılıyordu; bu yüzden
             biten bir kalemi Excel'le sıfırlamak imkânsız, dolu bir kalemi kazara ezmek ise
             mümkündü. Şimdi ikisi ayrı. */
          let adet = null;
          if(adetIdx >= 0){
            const ham = String((rowsRaw[i] || [])[adetIdx] == null ? '' : (rowsRaw[i] || [])[adetIdx]).trim();
            if(ham !== ''){
              const n = parseInt(ham.replace(/[^\d-]/g, ''), 10);
              if(!isNaN(n) && n >= 0) adet = n;
            }
          }
          okunan.push(Object.assign(p, { adet, sheet: sn }));
        }
      });

      /* Aynı kod birden fazla satırda/sayfada geçebiliyor (elle tutulan dosya). Tekilleştirilmezse
         aynı kod için İKİ katalog düğümü açılıyordu — kod aynı, id farklı, stok ikiye bölünür.
         Son görülen satır geçerli sayılır, kaç tekrar atlandığı önizlemede gösterilir. */
      const teklesmis = new Map();
      okunan.forEach(s => teklesmis.set(s.kod, s));
      const satirlar = [...teklesmis.values()];

      const mevcutMap = {};
      karburKatalogArray().forEach(k => { mevcutMap[k.kod] = k; });
      /* Mevcut kalemlerde Excel'in söylediği sayı sistemdekinden farklıysa: sayım farkı.
         Kullanıcı onay kutusunu işaretlemedikçe UYGULANMAZ, yalnızca gösterilir. */
      const farklar = satirlar
        .filter(s => mevcutMap[s.kod] && s.adet != null && s.adet !== karburStokAdet(mevcutMap[s.kod].id))
        .map(s => ({ kod: s.kod, id: mevcutMap[s.kod].id, sistem: karburStokAdet(mevcutMap[s.kod].id), excel: s.adet }));

      karburExcelPreview = {
        satirlar, hatali, farklar, adetSutunuVar,
        tekrar: okunan.length - satirlar.length,
        yeni: satirlar.filter(s => !mevcutMap[s.kod]).length,
        guncel: satirlar.filter(s => mevcutMap[s.kod]).length,
        kesim: satirlar.filter(s => s.kullanim === 'kesim').length,
        adet:  satirlar.filter(s => s.kullanim === 'adet').length
      };
      karburExcelStokGuncelle = false;   // her yeni dosyada kapalı başlar — bilerek işaretlenir
      render();
    }catch(err){ toast('Excel okunamadı: ' + ((err && err.message) || 'hata')); }
  };
  rd.readAsArrayBuffer(file);
}
function karburExcelIptal(){ karburExcelPreview = null; karburExcelStokGuncelle = false; render(); }
function karburSetExcelStokGuncelle(v){ karburExcelStokGuncelle = !!v; render(); }

/* Excel ONAYLA — KATALOG aracı, stok aracı değil.

   Mevcut bir kalemin stok adedine varsayılan olarak DOKUNULMAZ. Eskiden Excel'deki sayı sessizce
   üzerine yazılıyor ve hiçbir hareket kaydı düşülmüyordu: aynı dosya ikinci kez yüklendiğinde
   aradaki tüm çıkışlar sıfırlanıyor, izi de kalmıyordu.
   Sayımı Excel'den yapmak yine mümkün — ama kullanıcı önizlemedeki kutuyu işaretleyerek,
   ne değişeceğini fark tablosunda gördükten sonra. Uygulanan her değişiklik `sayim` hareketi
   olarak yazılır (kaynak:'excel'), yani elle yapılan sayımla birebir aynı izi bırakır. */
function karburExcelOnayla(){
  if(!canManageKarbur() || !karburExcelPreview || karburBusy) return;
  const now = Date.now(), updates = {}, mevcut = {};
  karburKatalogArray().forEach(k => { mevcut[k.kod] = k; });
  const stokGuncelle = !!karburExcelStokGuncelle;
  let yeni = 0, guncellenen = 0, sayimDuzeltilen = 0;
  karburExcelPreview.satirlar.forEach(s => {
    const ex = mevcut[s.kod];
    if(ex){
      updates['karburKatalog/' + ex.id + '/updatedTs'] = now;
      guncellenen++;
      if(!stokGuncelle || s.adet == null) return;      // adet'e dokunma
      const onceki = karburStokAdet(ex.id);
      if(onceki === s.adet) return;
      updates['karburStok/' + ex.id + '/adet'] = s.adet;
      updates['karburStok/' + ex.id + '/sonHareketTs'] = now;
      const shid = DB.ref('karburHareketleri').push().key;
      updates['karburHareketleri/' + shid] = { tip: 'sayim', katalogId: ex.id, kod: s.kod,
        adet: s.adet - onceki, oncekiAdet: onceki, sonrakiAdet: s.adet, isEmriNo: '', mm: 0,
        aciklama: 'Excel ile sayım düzeltmesi', kaynak: 'excel',
        operatorUsername: session.username, operatorName: session.displayName, ts: now };
      sayimDuzeltilen++;
      return;
    }
    const id = DB.ref('karburKatalog').push().key;
    const baslangic = s.adet == null ? 0 : s.adet;
    updates['karburKatalog/' + id] = { kod: s.kod, onek: s.onek, alanlar: s.alanlar, disCap: s.disCap,
      boy: s.boy, delik: s.delik, kalite: s.kalite, tur: s.tur, kullanim: s.kullanim,
      aktif: true, updatedTs: now, updatedBy: session.username };
    updates['karburStok/' + id] = { adet: baslangic, sonHareketTs: now };
    const hid = DB.ref('karburHareketleri').push().key;
    updates['karburHareketleri/' + hid] = { tip: 'sayim', katalogId: id, kod: s.kod, adet: baslangic,
      oncekiAdet: 0, sonrakiAdet: baslangic, isEmriNo: '', mm: 0, aciklama: 'Excel ile ilk yükleme',
      kaynak: 'excel', operatorUsername: session.username, operatorName: session.displayName, ts: now };
    yeni++;
  });
  karburBusy = true; render();
  karburChunkedUpdate(updates).then(() => {
    DB.ref('settings/karburKatalogVersion').set(firebase.database.ServerValue.increment(1));
    karburBusy = false; karburExcelPreview = null; karburExcelStokGuncelle = false;
    karburKatalogReady = false; karburStokReady = false;
    ensureKarburKatalogLoaded(() => safeRender());
    ensureKarburStokLoaded(() => safeRender(), true);
    toast(yeni + ' yeni kalem, ' + guncellenen + ' güncelleme' +
      (sayimDuzeltilen ? ', ' + sayimDuzeltilen + ' sayım düzeltmesi' : ', stok adetlerine dokunulmadı'));
    render();
  }).catch(err => { karburBusy = false; toast('Yükleme hatası: ' + ((err && err.message) || 'hata')); render(); });
}
/* Büyük update objeleri compat SDK'da "Maximum call stack size exceeded" verebiliyor
   (bkz. js/toolstock.js:225 notu) — parçalara bölüp sırayla gönderiyoruz. */
function karburChunkedUpdate(updates, chunkSize){
  chunkSize = chunkSize || 120;
  const entries = Object.entries(updates);
  if(!entries.length) return Promise.resolve();
  let p = Promise.resolve();
  for(let i = 0; i < entries.length; i += chunkSize){
    const chunk = entries.slice(i, i + chunkSize);
    p = p.then(() => DB.ref().update(Object.fromEntries(chunk)));
  }
  return p;
}

/* Kalemin kesim planına mı gireceği, adet olarak mı tüketileceği — KULLANICI işaretler.
   Program kod biçimine göre yalnızca bir varsayılan atar; karar kullanıcının. */
function karburSetKullanim(katalogId, v){
  if(!canManageKarbur()) return;
  if(v !== 'kesim' && v !== 'adet') return;
  const it = karburKatalogArray().find(k => k.id === katalogId);
  if(!it || (it.kullanim || 'kesim') === v) return;
  if(v === 'kesim' && !(it.disCap > 0 && it.boy > 0)){
    toast('Bu kalemin dış çap/boy bilgisi kodundan okunamadı — kesim planına alınamaz');
    return;
  }
  DB.ref('karburKatalog/' + katalogId + '/kullanim').set(v).then(() => {
    karburKatalog[katalogId] = Object.assign({}, karburKatalog[katalogId], { kullanim: v });
    bumpLocalKarburKatalogVersion();
    DB.ref('settings/karburKatalogVersion').set(firebase.database.ServerValue.increment(1));
    karburResetPlan();
    toast(it.kod + ' → ' + (v === 'kesim' ? 'kesim planına girer' : 'adet olarak tüketilir'));
    render();
  }).catch(err => toast('Güncellenemedi: ' + ((err && err.message) || 'hata')));
}

/* ==================== İŞ EMRİ ÖZETİ — HEDEFLİ OKUMA ====================
   Operatör ekranında "bu iş emrine karbür çıkışı yapıldı mı" bilgisini göstermek için
   kullanılıyor. Tüm özet düğümü ASLA indirilmez: yalnızca ekranda duran iş emri numarası
   için tek bir once('value') yapılır ve sonuç (bulunamadı dahil) önbelleğe alınır, böylece
   her yeniden çizimde yeni istek ateşlenmez. Canlı dinleyici yok.
   Operatörün iş başlatmasını hiçbir koşulda engellememesi gerekir — hata sessizce yutulur. */
let karburOzetCache = {};      // base iş emri no -> özet | null (null = sorguladık, kayıt yok)
let karburOzetLoading = {};

function karburOzetIste(base){
  if(!base || base.length < 6) return undefined;
  if(Object.prototype.hasOwnProperty.call(karburOzetCache, base)) return karburOzetCache[base];
  if(karburOzetLoading[base]) return undefined;
  karburOzetLoading[base] = true;
  try{
    DB.ref('karburIsEmriOzet/' + base).once('value').then(snap => {
      delete karburOzetLoading[base];
      karburOzetCache[base] = snap.val() || null;
      safeRender();
    }).catch(() => { delete karburOzetLoading[base]; karburOzetCache[base] = null; });
  }catch(e){ delete karburOzetLoading[base]; karburOzetCache[base] = null; }
  return undefined;
}

function karburSetSubView(v){
  karburSubView = v;
  karburIptalOnay = null;
  if(v === 'gecmis') loadKarburHareketleri(200);
  if(v === 'isemri' && !karburOzetListe) loadKarburIsEmriOzet(150);
  render();
}
/* ==================== KARBÜR MODÜLÜ — SON ==================== */
