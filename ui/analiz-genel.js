/* ===================== ANALİZ → GENEL (05.10.2026) =====================
   Kullanıcının yıllık sunumundaki ve verimlilik Excel'indeki dönemsel raporların uygulamadaki
   karşılığı — AYRI bir "Raporlar" sekmesi olarak başladı, kullanıcının isteğiyle (05.10.2026)
   Analiz'in ana görünümüne katıldı: tek uzun sayfa, üstte ortak dönem + atölye seçimi, altında
   Özet → Üretim → Tadilat → Verimlilik & Duruş → Açık işler. Verimlilik/duruş/açık iş blokları
   render-admin.js'teki eski "Yönetim" görünümünün kendisi (computeAnalizData), bu dosya Özet,
   Üretim ve Tadilat bölümlerini ve ortak dönem kontrolünü veriyor.
   Ön çalışma: https://claude.ai/artifact/REdamcRQtM4TgFUsU1NgZA
   Kararlar (05.10.2026): ana ölçü PARÇA ADEDİ; kıyas ÖNCEKİ DÖNEMLE (geçen yıl yok); Analiz'i
   kimler görüyorsa onlar (Şef/Üretim Şef görmez); eski "Rapor" ekranının adı "Kayıtlar".

   Veri: entries ve tadilatlar zaten canlı, tam bellekte — ek Firebase okuması yok. Tadilat
   talebi AÇILDIĞI tarihe (olusturmaTs), iş emri rotanın son operasyonunun BİTTİĞİ tarihe göre
   döneme düşer. testKaydi:true tadilatlar (açılış günündeki 14 deneme kaydı) sayılmaz. */

let rtDonem = 'buAy';            // bugun | son7 | buAy | gecenAy | son3Ay | buYil | ozel
let rtBas = '', rtSon = '';      // özel aralık, 'YYYY-MM-DD'
let rtSecim = null;              // { tur, anahtar, etiket } — tadilat kırılımında tıklanan satır
let rtSayfa = 1;
let usSecim = null;              // üretim kırılımında tıklanan satır
let usSayfa = 1;
const RT_SAYFA_BOYUT = 30;
let rtSonListe = [];             // tadilat: Excel'e aktarılacak süzülmüş liste
let usSonListe = [];             // üretim: Excel'e aktarılacak süzülmüş liste

const RT_AY = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const RT_AY_KISA = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function rtSifirla(){ rtSecim = null; rtSayfa = 1; usSecim = null; usSayfa = 1; }
function rtDonemSec(d){ rtDonem = d; rtSifirla(); if(d==='ozel' && !rtBas){ const s=rtAralik(); rtBas=dateKey(s.bas); rtSon=dateKey(Math.min(s.son, Date.now())-1); } render(); }
function rtAtolyeSec(a){ rtSifirla(); setAnalizAtolyeFilter(a); }
function rtOzelYaz(alan, deger){ if(alan==='bas') rtBas = deger; else rtSon = deger; rtSifirla(); render(); }
function rtKaydir(id){ setTimeout(()=>{ const el=document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); }, 30); }
function rtSec(tur, anahtar, etiket){
  rtSecim = (rtSecim && rtSecim.tur===tur && rtSecim.anahtar===anahtar) ? null : { tur, anahtar, etiket };
  rtSayfa = 1; render(); if(rtSecim) rtKaydir('rt-liste');
}
function rtSecimKaldir(){ rtSecim = null; rtSayfa = 1; render(); }
function rtSayfaGit(n){ rtSayfa = n; render(); rtKaydir('rt-liste'); }
function usSec(tur, anahtar, etiket){
  usSecim = (usSecim && usSecim.tur===tur && usSecim.anahtar===anahtar) ? null : { tur, anahtar, etiket };
  usSayfa = 1; render(); if(usSecim) rtKaydir('us-liste');
}
function usSecimKaldir(){ usSecim = null; usSayfa = 1; render(); }
function usSayfaGit(n){ usSayfa = n; render(); rtKaydir('us-liste'); }

function rtGun(ts){ const d=new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function rtAyEkle(ts, k){ const d=new Date(ts); return new Date(d.getFullYear(), d.getMonth()+k, d.getDate(), d.getHours(), d.getMinutes()).getTime(); }
function rtTarihOku(s){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); return m ? new Date(+m[1], +m[2]-1, +m[3]).getTime() : null; }
function rtTarihYaz(ts){ return dateKey(ts).split('-').reverse().join('.'); }

/* Seçili dönem: [bas, son) ms. Önceki dönem, seçili dönemin BUGÜNE KADARKİ kısmıyla aynı
   uzunlukta: 5 Ekim'de "Bu ay" 1–5 Eylül'le, "Bugün" dünün aynı saatine kadarıyla kıyaslanır
   (yoksa dönem başında her şey düşüş görünürdü). Ay tabanlıda takvim ayı kadar geri kayar. */
function rtAralik(){
  const n = new Date(), y = n.getFullYear(), m = n.getMonth(), g = n.getDate();
  const t = (Y,M,D)=> new Date(Y,M,D).getTime();
  if(rtDonem==='bugun')   return { bas:t(y,m,g),   son:t(y,m,g+1), gun:1, etiket:'Bugün' };
  if(rtDonem==='son7')    return { bas:t(y,m,g-6), son:t(y,m,g+1), gun:7, etiket:'Son 7 gün' };
  if(rtDonem==='gecenAy') return { bas:t(y,m-1,1), son:t(y,m,1),   ay:1,  etiket:`${RT_AY[(m+11)%12]} ${m===0?y-1:y}` };
  if(rtDonem==='son3Ay'){ const b = t(y,m-2,1); return { bas:b, son:t(y,m+1,1), ay:3, etiket:`${RT_AY[new Date(b).getMonth()]} – ${RT_AY[m]} ${y}` }; }
  if(rtDonem==='buYil')   return { bas:t(y,0,1),   son:t(y+1,0,1), ay:12, etiket:`${y}` };
  if(rtDonem==='ozel'){
    const b = rtTarihOku(rtBas), s = rtTarihOku(rtSon);
    if(b!=null && s!=null && s>=b) return { bas:b, son:s+86400000, etiket:`${rtTarihYaz(b)} – ${rtTarihYaz(s)}` };
  }
  return { bas:t(y,m,1), son:t(y,m+1,1), ay:1, etiket:`${RT_AY[m]} ${y}` };
}
function rtOncekiAralik(a){
  const bitis = Math.min(a.son, Math.max(Date.now(), a.bas+1));
  if(a.ay) return { bas: rtAyEkle(a.bas, -a.ay), son: rtAyEkle(bitis, -a.ay) };
  const uz = (a.gun ? a.gun*86400000 : a.son - a.bas);
  return { bas: a.bas - uz, son: bitis - uz };
}
/* Verimlilik/duruş blokları computeAnalizData(analizFrom, analizTo) ile çalışıyor — gün anahtarları,
   iki uç dahil. Genel görünüm her çizimde bunları seçili dönemden türetir. */
function analizDonemiEsitle(){
  const a = rtAralik();
  analizFrom = dateKey(a.bas);
  analizTo = dateKey(Math.max(a.bas, Math.min(a.son, Date.now()+1) - 1));
}

function rtSayi(x){ const v = Number(String(x||'').replace(',','.')); return isFinite(v) && v>0 ? v : 0; }
function rtBolum(b){
  const s = String(b||'').trim();
  const k = tadilatBolumOptions().find(o=>o.toLocaleLowerCase('tr')===s.toLocaleLowerCase('tr'));
  return k || 'Diğer';
}
/* Talepteki "U kodu" gerçekten bir malzeme kodu mu? Kayıtların ~%42'sinde kod yerine parça adı
   yazılı ("M6 KOVAN", "ENJEKTÖR") — kodu olmayan iş için normal. Tekrar eden kod analizi yalnızca
   gerçek kodlara bakar; kodsuzlar ayrı sayılır. */
function tadilatKoduGercekMi(kod){
  const k = String(kod||'').trim().toUpperCase();
  if(!k) return false;
  if(typeof malzemeListesi!=='undefined' && malzemeListesi && malzemeListesi[k]) return true;
  return /^(U[A-Z]{0,2}\d{6,}|SS-[A-Z]\d{5,})$/.test(k);
}
/* İşlem türü — formda ayrı alan yok, "Ne işlem yapılacak" metninden tahmin. Bir talep birden
   fazla türe girebilir; hiçbirine uymayanlar "Belirsiz". */
const RT_ISLEM_TURLERI = [
  ['silme',   'Silme / yüzey',     ['SİLİNECEK','SILINECEK','SİLİN','SILIN']],
  ['cap',     'Çap',               ['ÇAP','CAP ']],
  ['boy',     'Boy ayarı',         ['BOY']],
  ['delik',   'Delik',             ['DELİK','DELIK']],
  ['parlatma','Parlatma',          ['PARLAT']],
  ['resme',   'Resme göre imalat', ['RESME','RESİME','RESIME']],
  ['derece',  'Derece / açı',      ['DERECE']],
  ['taslama', 'Taşlama',           ['TAŞLA','TASLA']],
];
function rtIslemTurleri(t){
  const a = String(t.aciklama||'').toLocaleUpperCase('tr') + ' ';
  const bulunan = RT_ISLEM_TURLERI.filter(([,,ws])=>ws.some(w=>a.includes(w))).map(([k])=>k);
  return bulunan.length ? bulunan : ['belirsiz'];
}
const RT_BEKLEME_KOVA = [[0,15,'0–15 dk'],[15,60,'15–60 dk'],[60,240,'1–4 sa'],[240,1440,'4–24 sa'],[1440,Infinity,'1 gün+']];

function rtTalepOlcu(t){
  const ops = tadilatOperasyonlarArray(t);
  const ilk = ops.filter(o=>o.baslamaTs).sort((a,b)=>a.baslamaTs-b.baslamaTs)[0];
  const beklemeDk = (ilk && t.olusturmaTs) ? Math.max(0,(ilk.baslamaTs - t.olusturmaTs)/60000) : null;
  let netMs = 0, netVar = false;
  ops.forEach(o=>{ if(o.baslamaTs && o.bitisTs){ netMs += tadilatOpDurationBreakdown(o).netMs||0; netVar = true; } });
  return { ops, beklemeDk, netDk: netVar ? netMs/60000 : null, kapali: tadilatTamamlandiMi(t), parca: rtSayi(t.adet) };
}
function rtMedyan(a){ if(!a.length) return null; const s=[...a].sort((x,y)=>x-y); const i=Math.floor(s.length/2); return s.length%2 ? s[i] : (s[i-1]+s[i])/2; }
function rtDk(dk){ if(dk==null) return '—'; if(dk<60) return Math.round(dk)+' dk'; if(dk<1440) return (dk/60).toFixed(dk<600?1:0).replace('.',',')+' sa'; return (dk/1440).toFixed(1).replace('.',',')+' gün'; }
function rtFmt(n){ return Math.round(n).toLocaleString('tr-TR'); }

/* ---------- TADİLAT verisi ---------- */
function rtKayitlar(bas, son){
  return tadilatArray().filter(t=>!t.testKaydi && t.olusturmaTs>=bas && t.olusturmaTs<son
    && (analizAtolyeFilter==='tumu' || (t.atolye||'imalat')===analizAtolyeFilter));
}
function rtOzet(liste){
  let parca=0, parcaTad=0, beklemeTad=[], beklemeIma=[], netTad=[], netIma=[];
  liste.forEach(t=>{
    const o = rtTalepOlcu(t); parca += o.parca;
    const tad = (t.atolye||'imalat')==='tadilat';
    if(tad) parcaTad += o.parca;
    if(o.beklemeDk!=null) (tad?beklemeTad:beklemeIma).push(o.beklemeDk);
    if(o.netDk!=null) (tad?netTad:netIma).push(o.netDk);
  });
  return { talep: liste.length, parca, parcaTad, beklemeTad: rtMedyan(beklemeTad), beklemeIma: rtMedyan(beklemeIma),
    netTad: rtMedyan(netTad), netIma: rtMedyan(netIma), beklemeHepsi: rtMedyan([...beklemeTad,...beklemeIma]), netHepsi: rtMedyan([...netTad,...netIma]) };
}
function rtGrupla(liste, anahtarFn, parcaFn){
  const m = {};
  liste.forEach(x=>{
    const parca = parcaFn ? parcaFn(x) : rtSayi(x.adet);
    [].concat(anahtarFn(x)).forEach(k=>{
      if(!k || !k[0]) return;
      const [anahtar, etiket] = k;
      const g = m[anahtar] || (m[anahtar] = { anahtar, etiket, parca:0, talep:0 });
      g.parca += parca; g.talep += 1;
    });
  });
  return Object.values(m).sort((a,b)=> b.parca-a.parca || b.talep-a.talep);
}
const RT_KIRILIM = {
  bolum:   t => [[rtBolum(t.bolum), rtBolum(t.bolum)]],
  makine:  t => { const m=String(t.talepMakine||'').trim().toUpperCase(); return [[m||'—', m||'(boş)']]; },
  kisi:    t => { const k=String(t.talepEdenKisi||'').trim(); return [[k.toLocaleLowerCase('tr')||'—', k||'(boş)']]; },
  kod:     t => tadilatKoduGercekMi(t.uKodu) ? [[String(t.uKodu).trim().toUpperCase(), String(t.uKodu).trim().toUpperCase()]] : [['__kodsuz','Kodsuz parça']],
  tur:     t => rtIslemTurleri(t).map(k=>[k, k==='belirsiz' ? 'Belirsiz' : RT_ISLEM_TURLERI.find(x=>x[0]===k)[1]]),
  bekleme: t => { const o=rtTalepOlcu(t); if(o.beklemeDk==null) return [['__baslamadi','Başlamadı']]; const k=RT_BEKLEME_KOVA.find(([a,b])=>o.beklemeDk>=a && o.beklemeDk<b); return [[k[2],k[2]]]; },
  isleyen: t => [...new Set(tadilatOperasyonlarArray(t).map(o=>String(o.makine||'').split(' · ')[0]).filter(Boolean))].map(m=>[m,m]),
};
function rtSecimeUyar(t){
  if(!rtSecim) return true;
  const fn = RT_KIRILIM[rtSecim.tur]; if(!fn) return true;
  return [].concat(fn(t)).some(k=>k && k[0]===rtSecim.anahtar);
}

/* ---------- ÜRETİM verisi ----------
   "Biten iş emri" = rotanın son operasyonu (sonOperasyon:true, tamamlandi) dönem içinde bitmiş
   kayıt; parça = o son operasyonun adedi. Kullanıcının Excel'indeki "biten" sayfasının karşılığı.
   Atölye filtresi son operasyonun yapıldığı makinenin atölyesine göre. */
function usTabanKod(k){ return String(k||'').toUpperCase().replace(/_(ZARF|ELMAS)$/,''); }
function usMamulAdi(e){
  const k = usTabanKod(e.isEmriNo);
  return (typeof malzemeListesi!=='undefined' && malzemeListesi && malzemeListesi[k]) || (getTalepInfo(k)||{}).malzemeAdi || '';
}
/* Bölüm — ERP'de Malzeme Grubu yok (kullanıcı kararı: şimdilik eklenmeyecek), mamul açıklamasından
   çıkarılıyor: C-/S-/V- önekleri, CİVATA/SOMUN/VİDA kelimesi, ya da açıklamanın başındaki makine
   kodu (B26-… cıvata presi, V21 … vida, N/BF … somun). Çıkarılamayan "Belirsiz". */
function usBolum(e){
  const a = usMamulAdi(e).toLocaleUpperCase('tr').trim();
  if(!a) return 'Belirsiz';
  if(/^C-|CİVATA|CIVATA|^YPB|^B\d|^M\d/.test(a)) return 'Civata';
  if(/^S-|SOMUN|^BF\d|^N\d/.test(a)) return 'Somun';
  if(/^V-|VİDA|VIDA|^V\d/.test(a)) return 'Vida';
  return 'Belirsiz';
}
function usMakine(e){ return String(e.makine||'').split(' · ')[0]; }
function usAtolyeUyar(e){ return analizAtolyeFilter==='tumu' || machineAtolyeOf(usMakine(e))===analizAtolyeFilter; }
function usNetMs(e){ return e.endTs ? (entryDurationBreakdown(e).netMs||0) : 0; }
/* İş emri bazında tüm operasyonlar — süre (ilk başlangıç → son bitiş) ve rota uzunluğu için. */
let _usGruplarKaynak = null, _usGruplarSonuc = null;
function usGruplar(){
  /* entriesArray() veri değişmedikçe aynı diziyi döndürüyor — gruplama da onunla birlikte önbellekte. */
  const kaynak = entriesArray();
  if(kaynak === _usGruplarKaynak) return _usGruplarSonuc;
  const g = {};
  kaynak.forEach(e=>{ const k = usTabanKod(e.isEmriNo); (g[k] = g[k] || []).push(e); });
  _usGruplarKaynak = kaynak; _usGruplarSonuc = g;
  return g;
}
function usBitenler(bas, son){
  return entriesArray().filter(e=>e.status==='tamamlandi' && e.sonOperasyon && e.endTs>=bas && e.endTs<son && usAtolyeUyar(e));
}
function usOzet(liste, gruplar){
  const sureGun = [], opSay = [];
  let parca = 0;
  liste.forEach(e=>{
    parca += rtSayi(e.adet);
    const ops = gruplar[usTabanKod(e.isEmriNo)] || [e];
    const ilk = Math.min(...ops.map(o=>o.startTs||e.startTs));
    sureGun.push((e.endTs-ilk)/86400000); opSay.push(ops.length);
  });
  return { isEmri: liste.length, parca, sureGun: rtMedyan(sureGun), opSay: rtMedyan(opSay) };
}
const US_KIRILIM = {
  'u-bolum':  e => [[usBolum(e), usBolum(e)]],
  'u-makine': e => [[usMakine(e)||'—', usMakine(e)||'—']],
};
function usSecimeUyar(e){
  if(!usSecim) return true;
  const fn = US_KIRILIM[usSecim.tur]; if(!fn) return true;
  return [].concat(fn(e)).some(k=>k && k[0]===usSecim.anahtar);
}

/* Zaman serisi: ≤35 gün günlük, ≤120 gün haftalık (Pazartesi başlangıçlı), daha uzunu aylık.
   seriler: [{ anahtar, sinif, fn(x)→sayı }] ; tsFn(x) → kovaya düşeceği zaman. */
function rtZamanSerisi(liste, a, tsFn, seriler){
  const bitis = Math.min(a.son, Math.max(Date.now(), a.bas+86400000));
  const gun = (bitis - a.bas)/86400000;
  const kip = gun<=35 ? 'gun' : gun<=120 ? 'hafta' : 'ay';
  const kovaBas = ts => { const d=new Date(ts);
    if(kip==='gun') return rtGun(ts);
    if(kip==='hafta'){ const g=rtGun(ts), w=(new Date(g).getDay()+6)%7; return g - w*86400000; }
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
  const kovalar = [];
  for(let k=kovaBas(a.bas); k<bitis; ){
    kovalar.push({ bas:k, d: seriler.map(()=>0) });
    if(kip==='gun') k = rtGun(k+36*3600000); else if(kip==='hafta') k = rtGun(k+7*86400000+3600000); else { const d=new Date(k); k = new Date(d.getFullYear(), d.getMonth()+1, 1).getTime(); }
  }
  const idx = {}; kovalar.forEach((k,i)=>idx[k.bas]=i);
  liste.forEach(x=>{ const i = idx[kovaBas(tsFn(x))]; if(i==null) return; seriler.forEach((s,j)=>{ kovalar[i].d[j] += s.fn(x); }); });
  const etiket = k => { const d=new Date(k.bas);
    if(kip==='ay') return RT_AY_KISA[d.getMonth()];
    if(kip==='hafta') return `${d.getDate()} ${RT_AY_KISA[d.getMonth()]}`;
    return String(d.getDate()); };
  return { kip, seriler, kovalar: kovalar.map(k=>({ ...k, etiket: etiket(k) })) };
}

/* ---------- çizim yardımcıları ---------- */
function rtDegisim(simdi, once){
  if(once==null || !isFinite(once)) return '';
  if(once===0) return simdi>0 ? `<span class="rt-fark notr" title="Kıyaslanacak dönemde hiç kayıt yok (uygulama Ağustos 2026'da başladı)">önceki dönemde kayıt yok</span>` : '';
  const p = (simdi-once)/once*100;
  if(Math.abs(p) < 0.5) return `<span class="rt-fark notr">±0</span>`;
  return `<span class="rt-fark ${p>0?'artis':'azalis'}">${p>0?'▲':'▼'} %${Math.abs(p).toFixed(Math.abs(p)<10?1:0).replace('.',',')}</span>`;
}
/* Süre ve duruşta artış kötüdür — renk ters. */
function rtTersDegisim(simdi, once){
  if(simdi==null || once==null || !isFinite(once) || once===0) return '';
  const p = (simdi-once)/once*100;
  if(Math.abs(p) < 0.5) return `<span class="rt-fark notr">±0</span>`;
  return `<span class="rt-fark ${p>0?'azalis':'artis'}">${p>0?'▲':'▼'} %${Math.abs(p).toFixed(0)}</span>`;
}
function rtKpi(etiket, deger, alt, fark, ikinci){
  return `<div class="rt-kpi${ikinci?' ikincil':''}"><div class="rt-kpi-k">${esc(etiket)}</div><div class="rt-kpi-v">${deger}</div><div class="rt-kpi-s">${fark||''}${alt?`<span>${alt}</span>`:''}</div></div>`;
}
function rtCubukListe(tur, gruplar, opt){
  opt = opt || {};
  const secimFn = opt.secFn || 'rtSec', secim = opt.secim !== undefined ? opt.secim : rtSecim;
  const ust = gruplar.slice(0, opt.adet || 10);
  if(!ust.length) return `<div class="rt-bos">Bu dönemde kayıt yok.</div>`;
  const max = Math.max(...ust.map(g=>g.parca), 1);
  const birim = opt.birim || 'talep';
  return `<div class="rt-cubuklar">${ust.map(g=>{
    const secili = secim && secim.tur===tur && secim.anahtar===g.anahtar;
    return `<button type="button" class="rt-cubuk ${secili?'secili':''}" onclick="${secimFn}('${escJs(tur)}','${escJs(g.anahtar)}','${escJs(g.etiket)}')" title="${esc(g.etiket)} — ${rtFmt(g.parca)} parça, ${g.talep} ${birim} · listeyi süz">
      <span class="rt-cubuk-ad ${opt.mono?'mono':''}">${esc(g.etiket)}</span>
      <span class="rt-cubuk-iz"><span style="width:${Math.max(1.5, g.parca/max*100).toFixed(1)}%${opt.renk?';background:'+opt.renk:''}"></span></span>
      <span class="rt-cubuk-d mono">${rtFmt(g.parca)}<small>${g.talep} ${birim}</small></span>
    </button>`;}).join('')}</div>${gruplar.length>ust.length ? `<div class="rt-dip">+${gruplar.length-ust.length} daha</div>` : ''}`;
}
/* Grafik kutunun GERÇEK genişliğinde çiziliyor: sabit viewBox geniş kutuda büyüyüp yazıları
   iriltiyor, telefonda küçültüp okunmaz yapıyordu. Genişlik her render'da kabuktan okunur. */
function rtSeriSvg(seri, aria){
  const kabuk = document.querySelector('.admin-shell-body');
  const W = Math.max(300, Math.min(1500, ((kabuk && kabuk.clientWidth) || window.innerWidth || 900) - (window.innerWidth<=900 ? 66 : 84)));
  const H=210, alt=24, ust=18, sol=44, sag=6;
  const k = seri.kovalar;
  const ham = Math.max(1, ...k.map(x=>x.d.reduce((s,v)=>s+v,0)));
  const adimlar = [1,2,5,10,20,25,50,100,200,250,500,1000,2000,2500,5000,10000,20000,50000];
  const adim = adimlar.find(a=>ham/a<=4) || 50000;
  const max = Math.ceil(ham/adim)*adim;
  const ph=H-alt-ust, pw=W-sol-sag, y=v=>ust+ph-(v/max*ph);
  const grup = pw/Math.max(1,k.length), bw = Math.max(3, Math.min(46, grup*0.62));
  const etiketAdim = Math.ceil(k.length/14);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="rt-svg" role="img" aria-label="${esc(aria||'')}">`;
  for(let v=0; v<=max; v+=adim){
    s += `<line x1="${sol}" x2="${W-sag}" y1="${y(v)}" y2="${y(v)}" class="rt-grid"/><text x="${sol-6}" y="${y(v)+4}" text-anchor="end" class="rt-eks">${rtFmt(v)}</text>`;
  }
  k.forEach((x,i)=>{
    const cx = sol + grup*i + grup/2;
    let taban = 0;
    x.d.forEach((v,j)=>{ if(v<=0) return; const y1=y(taban+v), y0=y(taban);
      s += `<rect x="${(cx-bw/2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${(y0-y1).toFixed(1)}" class="${seri.seriler[j].sinif}"><title>${esc(x.etiket)} · ${esc(seri.seriler[j].ad)} ${rtFmt(v)}</title></rect>`;
      taban += v; });
    if(k.length<=16 && taban>0) s += `<text x="${cx.toFixed(1)}" y="${(y(taban)-5).toFixed(1)}" text-anchor="middle" class="rt-deger">${rtFmt(taban)}</text>`;
    if(i%etiketAdim===0) s += `<text x="${cx.toFixed(1)}" y="${H-7}" text-anchor="middle" class="rt-eks">${esc(x.etiket)}</text>`;
  });
  return s + `</svg>`;
}
function agBolumBas(id, baslik, alt){
  return `<div class="ag-bolum-bas" id="${id}"><h3>${esc(baslik)}</h3>${alt?`<span>${alt}</span>`:''}</div>`;
}

/* ---------- Ortak üst kısım: dönem + atölye + bölüm atlama ---------- */
function analizGenelUstHtml(){
  const a = rtAralik(), on = rtOncekiAralik(a);
  const donemBtn = (k, ad) => `<button type="button" class="rt-donem ${rtDonem===k?'on':''}" onclick="rtDonemSec('${k}')">${ad}</button>`;
  const atolyeBtn = (k, ad) => `<button type="button" class="rt-donem ${analizAtolyeFilter===k?'on':''}" onclick="rtAtolyeSec('${k}')">${ad}</button>`;
  return `<div class="ag-ust">
    <div class="rt-filtre">
      <div class="rt-filtre-grup">${donemBtn('bugun','Bugün')}${donemBtn('son7','Son 7 gün')}${donemBtn('buAy','Bu ay')}${donemBtn('gecenAy','Geçen ay')}${donemBtn('son3Ay','Son 3 ay')}${donemBtn('buYil','Bu yıl')}${donemBtn('ozel','Özel')}</div>
      ${rtDonem==='ozel' ? `<div class="rt-filtre-grup"><input type="date" id="rt-bas" value="${esc(rtBas)}" onchange="rtOzelYaz('bas',this.value)"><span style="color:var(--text-muted)">–</span><input type="date" id="rt-son" value="${esc(rtSon)}" onchange="rtOzelYaz('son',this.value)"></div>` : ''}
      <div class="rt-filtre-grup">${atolyeBtn('tumu','Tüm atölyeler')}${atolyeBtn('imalat','İmalat atölyesi')}${atolyeBtn('tadilat','Tadilat atölyesi')}</div>
    </div>
    <div class="rt-donem-bilgi">${esc(a.etiket)} · ▲▼ işaretleri önceki dönemle kıyas (${rtTarihYaz(on.bas)} – ${rtTarihYaz(Math.max(on.bas, on.son-1))})</div>
    <nav class="ag-atla" aria-label="Bölümlere git">
      <button type="button" onclick="rtKaydir('ag-ozet')">Özet</button><button type="button" onclick="rtKaydir('ag-uretim')">Üretim</button><button type="button" onclick="rtKaydir('ag-tadilat')">Tadilat</button><button type="button" onclick="rtKaydir('ag-verimlilik')">Verimlilik &amp; Duruş</button><button type="button" onclick="rtKaydir('ag-acik')">Açık işler</button>
    </nav>
  </div>`;
}

/* ---------- ÖZET ----------
   t: computeAnalizData(...).totals (verimlilik, çalışma, duruş) — çağıran (render-admin) verir.
   Önceki dönemin verimliliği ayrı bir computeAnalizData çağrısı gerektirir (aynı hesap, kısa dönem). */
function analizOzetHtml(t){
  const a = rtAralik(), on = rtOncekiAralik(a);
  const gr = usGruplar();
  const us = usOzet(usBitenler(a.bas, a.son), gr), usOn = usOzet(usBitenler(on.bas, on.son), gr);
  const rt = rtOzet(rtKayitlar(a.bas, a.son)), rtOn = rtOzet(rtKayitlar(on.bas, on.son));
  let tOn = null;
  try{ tOn = computeAnalizData(dateKey(on.bas), dateKey(Math.max(on.bas, on.son-1)), analizAtolyeFilter).totals; }catch(e){ tOn = null; }
  const durusOn = tOn ? tOn.durusMin : null;
  return `${agBolumBas('ag-ozet','Özet', esc(a.etiket))}
  <div class="rt-kpiler">
    ${rtKpi('Biten iş emri', rtFmt(us.isEmri), `önceki ${rtFmt(usOn.isEmri)}`, rtDegisim(us.isEmri, usOn.isEmri))}
    ${rtKpi('Üretilen parça', rtFmt(us.parca), `önceki ${rtFmt(usOn.parca)}`, rtDegisim(us.parca, usOn.parca))}
    ${rtKpi('Tadilat parça', rtFmt(rt.parca), `${rtFmt(rt.talep)} talep`, rtDegisim(rt.parca, rtOn.parca))}
    ${rtKpi('Verimlilik', t ? '%'+t.verimlilik : '—', tOn ? `önceki %${tOn.verimlilik}` : 'çalışma / kullanılabilirlik', (t && tOn && tOn.availMin>0) ? rtDegisim(t.verimlilik, tOn.verimlilik) : '')}
    ${rtKpi('Toplam duruş', t ? (t.durusMin>=600 ? rtFmt(t.durusMin/60)+' sa' : fmtDur(t.durusMin*60000)) : '—', 'Gün Sonu hariç', (t && durusOn) ? rtTersDegisim(t.durusMin, durusOn) : '')}
  </div>`;
}

/* ---------- ÜRETİM ---------- */
function analizUretimHtml(){
  const a = rtAralik(), on = rtOncekiAralik(a);
  const gr = usGruplar();
  const liste = usBitenler(a.bas, a.son), onceki = usBitenler(on.bas, on.son);
  const oz = usOzet(liste, gr), ozOn = usOzet(onceki, gr);
  const seri = rtZamanSerisi(liste, a, e=>e.endTs, [{ ad:'parça', sinif:'rt-s-tad', fn:e=>rtSayi(e.adet) }]);
  const bolumG = rtGrupla(liste, US_KIRILIM['u-bolum']);
  const belirsiz = bolumG.find(g=>g.anahtar==='Belirsiz');

  /* Makine yükü: dönem içinde biten TÜM operasyonların net çalışma saati (fason hariç). */
  const yuk = {};
  entriesArray().forEach(e=>{
    if(!(e.endTs>=a.bas && e.endTs<a.son) || !usAtolyeUyar(e) || isFasonMachine(e.makine)) return;
    const m = String(e.makine||'').split(' · '); const k = m[0]; if(!k) return;
    const g = yuk[k] || (yuk[k] = { anahtar:k, etiket:k, ad:m[1]||'', parca:0, talep:0 });
    g.parca += usNetMs(e)/3.6e6; g.talep += 1;
  });
  const yukL = Object.values(yuk).sort((x,y)=>y.parca-x.parca);

  /* Mamul — en çok biten ürünler (parça). */
  const mamulG = rtGrupla(liste, e=>{ const k=usTabanKod(e.isEmriNo); return [[k, k]]; }).slice(0,8);

  const suzulmus = liste.filter(usSecimeUyar).sort((x,y)=>(y.endTs||0)-(x.endTs||0));
  usSonListe = suzulmus;
  const toplamSayfa = Math.max(1, Math.ceil(suzulmus.length/RT_SAYFA_BOYUT));
  usSayfa = Math.min(Math.max(1, usSayfa), toplamSayfa);
  const sayfa = suzulmus.slice((usSayfa-1)*RT_SAYFA_BOYUT, usSayfa*RT_SAYFA_BOYUT);
  const suzParca = suzulmus.reduce((s,e)=>s+rtSayi(e.adet),0);

  return `${agBolumBas('ag-uretim','Üretim','rotası tamamlanan iş emirleri · son operasyonun bittiği güne göre')}
  <div class="rt-kpiler">
    ${rtKpi('Biten iş emri', rtFmt(oz.isEmri), `önceki ${rtFmt(ozOn.isEmri)}`, rtDegisim(oz.isEmri, ozOn.isEmri))}
    ${rtKpi('Parça', rtFmt(oz.parca), `iş emri başına ${oz.isEmri?(oz.parca/oz.isEmri).toFixed(1).replace('.',','):'—'}`, rtDegisim(oz.parca, ozOn.parca))}
    ${rtKpi('İş emri süresi', oz.sureGun==null?'—':rtDk(oz.sureGun*1440), 'medyan · ilk operasyon → bitiş', rtTersDegisim(oz.sureGun, ozOn.sureGun))}
    ${rtKpi('Operasyon / iş emri', oz.opSay==null?'—':String(Math.round(oz.opSay)), 'medyan · bileşenler dahil', '')}
  </div>
  <div class="rt-izgara">
    <div class="rt-kutu rt-genis">
      <div class="rt-kutu-bas"><h4>Üretilen parça</h4><span>${seri.kip==='gun'?'günlük':seri.kip==='hafta'?'haftalık':'aylık'}</span></div>
      ${liste.length ? rtSeriSvg(seri, 'Dönem içinde üretilen parça') : `<div class="rt-bos">Bu dönemde biten iş emri yok.</div>`}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Bölüm</h4><span>parça · mamul açıklamasından</span></div>
      ${rtCubukListe('u-bolum', bolumG, { secFn:'usSec', secim:usSecim, birim:'iş emri' })}
      ${belirsiz ? `<div class="rt-uyari">${belirsiz.talep} iş emrinin bölümü açıklamadan anlaşılamadı (ör. "B26-8.80-EJEKTOR BURCU" gibi makine parçaları).</div>` : ''}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Makine yükü</h4><span>net çalışma saati · fason hariç</span></div>
      ${yukL.length ? `<div class="rt-cubuklar">${yukL.slice(0,10).map(g=>{
        const max = yukL[0].parca||1; const secili = usSecim && usSecim.tur==='u-makine' && usSecim.anahtar===g.anahtar;
        return `<button type="button" class="rt-cubuk ${secili?'secili':''}" onclick="usSec('u-makine','${escJs(g.anahtar)}','${escJs(g.anahtar)}')" title="${esc(g.anahtar)} ${esc(g.ad)} — ${g.talep} operasyon">
          <span class="rt-cubuk-ad mono">${esc(g.anahtar)}</span>
          <span class="rt-cubuk-iz"><span style="width:${Math.max(1.5,g.parca/max*100).toFixed(1)}%;background:var(--success)"></span></span>
          <span class="rt-cubuk-d mono">${g.parca.toFixed(g.parca<10?1:0).replace('.',',')} sa<small>${g.talep} op.</small></span></button>`; }).join('')}</div>
        ${yukL.length>10?`<div class="rt-dip">+${yukL.length-10} makine daha</div>`:''}` : `<div class="rt-bos">Bu dönemde biten operasyon yok.</div>`}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>En çok biten mamul</h4><span>parça</span></div>
      ${mamulG.length ? `<table class="rt-tablo"><thead><tr><th>Mamul</th><th class="rt-dar-gizle">Açıklama</th><th class="r">İş emri</th><th class="r">Parça</th></tr></thead><tbody>
        ${mamulG.map(g=>{ const ad = (typeof malzemeListesi!=='undefined' && malzemeListesi && malzemeListesi[g.anahtar]) || (getTalepInfo(g.anahtar)||{}).malzemeAdi || '';
          return `<tr class="rt-tablo-sabit"><td class="mono">${esc(g.anahtar)}</td><td class="rt-silik rt-kes rt-dar-gizle">${esc(ad)}</td><td class="r mono">${g.talep}</td><td class="r mono">${rtFmt(g.parca)}</td></tr>`; }).join('')}
      </tbody></table>` : `<div class="rt-bos">Bu dönemde biten iş emri yok.</div>`}
    </div>
  </div>
  <div class="rt-kutu rt-liste" id="us-liste">
    <div class="rt-liste-bas">
      <div><h4>Biten iş emirleri</h4><span>${usSecim ? `<b>${esc(usSecim.etiket)}</b> · ` : ''}${rtFmt(suzulmus.length)} iş emri · ${rtFmt(suzParca)} parça</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${usSecim ? `<button type="button" class="btn-ghost" style="width:auto;padding:7px 12px" onclick="usSecimKaldir()">${ico('x',13)} Süzmeyi kaldır</button>` : ''}
        ${suzulmus.length ? `<button type="button" class="btn-primary" style="width:auto;padding:7px 14px" onclick="usExcelAktar()">Excel'e aktar (${rtFmt(suzulmus.length)})</button>` : ''}
      </div>
    </div>
    ${sayfa.length ? `<div class="table-wrap"><table class="rt-tablo rt-tablo-liste"><thead><tr><th>Bitiş</th><th>İş emri</th><th>Mamul</th><th>Bölüm</th><th>Son makine</th><th class="r">Parça</th><th class="r">Süre</th><th class="r">Op.</th></tr></thead><tbody>
      ${sayfa.map(e=>{ const ops = gr[usTabanKod(e.isEmriNo)]||[e]; const ilk = Math.min(...ops.map(o=>o.startTs||e.startTs));
        return `<tr class="rt-tablo-sabit">
          <td class="mono" style="white-space:nowrap">${fmtDT(e.endTs)}</td>
          <td><div class="mono">${esc(e.talepNo||'—')}</div><div class="mono rt-silik">${esc(e.isEmriNo||'')}</div></td>
          <td class="rt-kes" style="max-width:260px" title="${esc(usMamulAdi(e))}">${esc(usMamulAdi(e)||'—')}</td>
          <td>${esc(usBolum(e))}</td>
          <td class="mono">${esc(usMakine(e)||'—')}</td>
          <td class="r mono">${rtFmt(rtSayi(e.adet))}</td>
          <td class="r mono">${rtDk((e.endTs-ilk)/60000)}</td>
          <td class="r mono">${ops.length}</td>
        </tr>`; }).join('')}
    </tbody></table></div>
    <div class="rt-sayfa">${modalSayfaSeridi(usSayfa, toplamSayfa, 'usSayfaGit')}</div>` : `<div class="rt-bos">Seçime uyan iş emri yok.</div>`}
  </div>`;
}
async function usExcelAktar(){
  if(!(await ensureXLSX())) return;
  const gr = usGruplar();
  const satirlar = usSonListe.map(e=>{ const ops = gr[usTabanKod(e.isEmriNo)]||[e]; const ilk = Math.min(...ops.map(o=>o.startTs||e.startTs));
    return { 'Bitiş': new Date(e.endTs), 'İş Talep No': e.talepNo||'', 'İş Emri (U kodu)': e.isEmriNo||'', 'Mamul': usMamulAdi(e), 'Bölüm': usBolum(e),
      'Son Makine': e.makine||'', 'Parça': rtSayi(e.adet), 'İlk Başlangıç': new Date(ilk), 'Süre (gün)': Math.round((e.endTs-ilk)/86400000*10)/10, 'Operasyon Sayısı': ops.length }; });
  const ws = XLSX.utils.json_to_sheet(satirlar, { cellDates:true });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Biten İş Emirleri');
  XLSX.writeFile(wb, `Biten_Is_Emirleri_${dateKey(Date.now())}.xlsx`);
}

/* ---------- TADİLAT ---------- */
function analizTadilatHtml(){
  const a = rtAralik(), on = rtOncekiAralik(a);
  const liste = rtKayitlar(a.bas, a.son);
  const onceki = rtKayitlar(on.bas, on.son);
  const oz = rtOzet(liste), ozOn = rtOzet(onceki);
  const fAt = analizAtolyeFilter;
  const acik = tadilatArray().filter(t=>!t.testKaydi && !tadilatTamamlandiMi(t) && (fAt==='tumu' || (t.atolye||'imalat')===fAt)).length;
  const seri = rtZamanSerisi(liste, a, t=>t.olusturmaTs, [
    { ad:'tadilat atölyesi', sinif:'rt-s-tad', fn:t=>(t.atolye||'imalat')==='tadilat' ? rtSayi(t.adet) : 0 },
    { ad:'imalat atölyesi',  sinif:'rt-s-ima', fn:t=>(t.atolye||'imalat')==='tadilat' ? 0 : rtSayi(t.adet) }]);
  const bolumG = rtGrupla(liste, RT_KIRILIM.bolum), bolumOnG = rtGrupla(onceki, RT_KIRILIM.bolum);
  const kodG = rtGrupla(liste, RT_KIRILIM.kod);
  const kodsuz = kodG.find(g=>g.anahtar==='__kodsuz');
  const gercekKod = kodG.filter(g=>g.anahtar!=='__kodsuz' && g.talep>=2).sort((x,y)=>y.talep-x.talep||y.parca-x.parca);
  const kodFarkli = kodG.filter(g=>g.anahtar!=='__kodsuz').length;

  const isleyen = {};
  liste.forEach(t=>tadilatOperasyonlarArray(t).forEach(o=>{
    const m = String(o.makine||'').split(' · '); const k = m[0]; if(!k) return;
    const g = isleyen[k] || (isleyen[k] = { anahtar:k, ad:m[1]||'', op:0, netMs:0 });
    g.op += 1; if(o.baslamaTs && o.bitisTs) g.netMs += tadilatOpDurationBreakdown(o).netMs||0;
  }));
  const isleyenL = Object.values(isleyen).sort((x,y)=>y.op-x.op).slice(0,10);

  const bekTad = RT_BEKLEME_KOVA.map(()=>0), bekIma = RT_BEKLEME_KOVA.map(()=>0);
  liste.forEach(t=>{ const o=rtTalepOlcu(t); if(o.beklemeDk==null) return; const i=RT_BEKLEME_KOVA.findIndex(([x,y])=>o.beklemeDk>=x && o.beklemeDk<y); ((t.atolye||'imalat')==='tadilat'?bekTad:bekIma)[i]++; });
  const bekMax = Math.max(1, ...bekTad, ...bekIma);
  const payTad = oz.parca>0 ? oz.parcaTad/oz.parca*100 : null;
  const bek = fAt==='imalat'?oz.beklemeIma:fAt==='tadilat'?oz.beklemeTad:oz.beklemeHepsi;
  const bekOn = fAt==='imalat'?ozOn.beklemeIma:fAt==='tadilat'?ozOn.beklemeTad:ozOn.beklemeHepsi;
  const net = fAt==='imalat'?oz.netIma:fAt==='tadilat'?oz.netTad:oz.netHepsi;

  const suzulmus = liste.filter(rtSecimeUyar).sort((x,y)=>(y.olusturmaTs||0)-(x.olusturmaTs||0));
  rtSonListe = suzulmus;
  const toplamSayfa = Math.max(1, Math.ceil(suzulmus.length/RT_SAYFA_BOYUT));
  rtSayfa = Math.min(Math.max(1, rtSayfa), toplamSayfa);
  const sayfa = suzulmus.slice((rtSayfa-1)*RT_SAYFA_BOYUT, rtSayfa*RT_SAYFA_BOYUT);
  const suzParca = suzulmus.reduce((s,t)=>s+rtSayi(t.adet),0);

  return `${agBolumBas('ag-tadilat','Tadilat','talebin açıldığı güne göre · parça adedi')}
  <div class="rt-kpiler">
    ${rtKpi('Parça', rtFmt(oz.parca), `önceki ${rtFmt(ozOn.parca)}`, rtDegisim(oz.parca, ozOn.parca))}
    ${rtKpi('Talep', rtFmt(oz.talep), `talep başına ${oz.talep? (oz.parca/oz.talep).toFixed(1).replace('.',','):'—'} parça`, rtDegisim(oz.talep, ozOn.talep))}
    ${fAt==='tumu' ? rtKpi('Tadilat atölyesi payı', payTad==null?'—':'%'+Math.round(payTad), 'parça bazında', '') : ''}
    ${rtKpi('Başlama bekleme', rtDk(bek), fAt==='tumu' ? `medyan · tadilat ${rtDk(oz.beklemeTad)}, imalat ${rtDk(oz.beklemeIma)}` : 'medyan', rtTersDegisim(bek, bekOn))}
    ${rtKpi('İşlem süresi', rtDk(net), fAt==='tumu' ? `medyan net · tadilat ${rtDk(oz.netTad)}, imalat ${rtDk(oz.netIma)}` : 'medyan net', '')}
    ${rtKpi('Şu an açık', rtFmt(acik), 'dönemden bağımsız', '')}
  </div>
  <div class="rt-izgara">
    <div class="rt-kutu rt-genis">
      <div class="rt-kutu-bas"><h4>Tadilat parça adedi</h4><span>${seri.kip==='gun'?'günlük':seri.kip==='hafta'?'haftalık':'aylık'}</span></div>
      ${liste.length ? rtSeriSvg(seri, 'Dönem içinde tadilat parça adedi') : `<div class="rt-bos">Bu dönemde talep yok.</div>`}
      <div class="rt-lejant"><span><i class="rt-s-tad-i"></i>Tadilat atölyesi</span><span><i class="rt-s-ima-i"></i>İmalat atölyesi</span></div>
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Bölüm</h4><span>parça · önceki döneme göre</span></div>
      ${bolumG.length ? `<div class="rt-cubuklar">${bolumG.map(g=>{
        const pay = oz.parca ? g.parca/oz.parca*100 : 0;
        const onG = bolumOnG.find(x=>x.anahtar===g.anahtar); const onPay = ozOn.parca && onG ? onG.parca/ozOn.parca*100 : 0;
        const secili = rtSecim && rtSecim.tur==='bolum' && rtSecim.anahtar===g.anahtar;
        return `<button type="button" class="rt-cubuk ${secili?'secili':''}" onclick="rtSec('bolum','${escJs(g.anahtar)}','${escJs(g.etiket)}')">
          <span class="rt-cubuk-ad">${esc(g.etiket)}</span>
          <span class="rt-cubuk-iz"><span style="width:${Math.max(1.5,pay).toFixed(1)}%"></span>${ozOn.parca?`<em style="left:${Math.min(100,onPay).toFixed(1)}%" title="önceki dönem %${onPay.toFixed(0)}"></em>`:''}</span>
          <span class="rt-cubuk-d mono">%${pay.toFixed(0)}<small>${rtFmt(g.parca)} parça</small></span></button>`; }).join('')}</div>
        ${ozOn.parca ? `<div class="rt-dip">Çizgi: önceki dönemdeki pay</div>` : ''}` : `<div class="rt-bos">Bu dönemde kayıt yok.</div>`}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Talep eden makine</h4><span>en çok tadilat isteyen · parça</span></div>
      ${rtCubukListe('makine', rtGrupla(liste, RT_KIRILIM.makine), { mono:true })}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Başlama bekleme süresi</h4><span>açılıştan ilk işleme · talep sayısı</span></div>
      <div class="rt-bekleme">${RT_BEKLEME_KOVA.map(([, , ad],i)=>{
        const secili = rtSecim && rtSecim.tur==='bekleme' && rtSecim.anahtar===ad;
        return `<button type="button" class="rt-bek-sut ${secili?'secili':''}" onclick="rtSec('bekleme','${escJs(ad)}','${escJs('Bekleme '+ad)}')" title="${ad}: tadilat ${bekTad[i]}, imalat ${bekIma[i]} talep">
          <span class="rt-bek-cift">${fAt!=='imalat'?`<span class="rt-bek-c tad" style="height:${(bekTad[i]/bekMax*100).toFixed(1)}%"><b>${bekTad[i]||''}</b></span>`:''}${fAt!=='tadilat'?`<span class="rt-bek-c ima" style="height:${(bekIma[i]/bekMax*100).toFixed(1)}%"><b>${bekIma[i]||''}</b></span>`:''}</span>
          <span class="rt-bek-ad">${ad}</span></button>`; }).join('')}</div>
      ${(bekTad[4]+bekIma[4])>0 ? `<div class="rt-uyari">${bekIma[4]?`İmalat atölyesinde ${bekIma[4]}`:''}${bekIma[4]&&bekTad[4]?', ':''}${bekTad[4]?`tadilat atölyesinde ${bekTad[4]}`:''} talep bir günden fazla bekledi.</div>` : ''}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>İşi yapan makine</h4><span>operasyon sayısı · net işlem saati</span></div>
      ${isleyenL.length ? `<table class="rt-tablo"><thead><tr><th>Makine</th><th class="r">Operasyon</th><th class="r">Net saat</th><th class="r rt-dar-gizle">Op. başına</th></tr></thead><tbody>
        ${isleyenL.map(g=>{ const secili = rtSecim && rtSecim.tur==='isleyen' && rtSecim.anahtar===g.anahtar;
          return `<tr class="${secili?'secili':''}" onclick="rtSec('isleyen','${escJs(g.anahtar)}','${escJs(g.anahtar)}')"><td><span class="mono">${esc(g.anahtar)}</span>${g.ad?` <span class="rt-silik">${esc(g.ad)}</span>`:''}</td><td class="r mono">${rtFmt(g.op)}</td><td class="r mono">${(g.netMs/3.6e6).toFixed(1).replace('.',',')}</td><td class="r mono rt-dar-gizle">${rtDk(g.netMs/60000/Math.max(1,g.op))}</td></tr>`; }).join('')}
      </tbody></table>` : `<div class="rt-bos">Bu dönemde işlenen talep yok.</div>`}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>İşlem türü</h4><span>açıklama metninden tahmin · parça</span></div>
      ${rtCubukListe('tur', rtGrupla(liste, RT_KIRILIM.tur), { renk:'var(--tadilat-info)' })}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Tekrar tadilata gelen kodlar</h4><span>${kodFarkli} farklı koddan ${gercekKod.length} tanesi iki veya daha fazla kez</span></div>
      ${gercekKod.length ? `<table class="rt-tablo"><thead><tr><th>Kod</th><th class="rt-dar-gizle">Malzeme</th><th class="r">Talep</th><th class="r">Parça</th></tr></thead><tbody>
        ${gercekKod.slice(0,10).map(g=>{ const secili = rtSecim && rtSecim.tur==='kod' && rtSecim.anahtar===g.anahtar; const ad = (getTalepInfo(g.anahtar)||{}).malzemeAdi || (typeof malzemeListesi!=='undefined' && malzemeListesi ? malzemeListesi[g.anahtar] : '') || '';
          return `<tr class="${secili?'secili':''}" onclick="rtSec('kod','${escJs(g.anahtar)}','${escJs(g.anahtar)}')"><td class="mono">${esc(g.anahtar)}</td><td class="rt-silik rt-kes rt-dar-gizle">${esc(ad)}</td><td class="r mono">${g.talep}</td><td class="r mono">${rtFmt(g.parca)}</td></tr>`; }).join('')}
      </tbody></table>` : `<div class="rt-bos">Bu dönemde tekrar gelen kod yok.</div>`}
      ${kodsuz ? `<button type="button" class="rt-alt-link" onclick="rtSec('kod','__kodsuz','Kodsuz parça')">Kodsuz parça: ${kodsuz.talep} talep · ${rtFmt(kodsuz.parca)} parça (kod yerine parça adı yazılmış) →</button>` : ''}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Talep eden kişi</h4><span>parça</span></div>
      ${rtCubukListe('kisi', rtGrupla(liste, RT_KIRILIM.kisi))}
    </div>
  </div>
  <div class="rt-kutu rt-liste" id="rt-liste">
    <div class="rt-liste-bas">
      <div><h4>Tadilat talepleri</h4><span>${rtSecim ? `<b>${esc(rtSecim.etiket)}</b> · ` : ''}${rtFmt(suzulmus.length)} talep · ${rtFmt(suzParca)} parça</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${rtSecim ? `<button type="button" class="btn-ghost" style="width:auto;padding:7px 12px" onclick="rtSecimKaldir()">${ico('x',13)} Süzmeyi kaldır</button>` : ''}
        ${suzulmus.length ? `<button type="button" class="btn-primary" style="width:auto;padding:7px 14px" onclick="exportTadilatExcel(rtSonListe)">Excel'e aktar (${rtFmt(suzulmus.length)})</button>` : ''}
      </div>
    </div>
    ${!rtSecim ? `<div class="rt-dip" style="margin:-4px 0 8px">Yukarıdaki bir satıra ya da sütuna dokununca liste ona göre süzülür.</div>` : ''}
    ${sayfa.length ? `<div class="table-wrap"><table class="rt-tablo rt-tablo-liste"><thead><tr><th>Açılış</th><th>Atölye</th><th>Kod / parça</th><th>İşlem</th><th>Bölüm</th><th>Talep eden</th><th class="r">Adet</th><th class="r">Bekleme</th><th>Durum</th></tr></thead><tbody>
      ${sayfa.map(t=>{ const o = rtTalepOlcu(t); const tad=(t.atolye||'imalat')==='tadilat';
        return `<tr onclick="openTadilatAkis('${escJs(t.id)}')" title="Akışı aç">
          <td class="mono" style="white-space:nowrap">${t.olusturmaTs?fmtDT(t.olusturmaTs):'—'}</td>
          <td><span class="matrix-tag" style="--sb:${tad?'var(--accent)':'var(--tadilat-info)'}">${tad?'TADİLAT':'İMALAT'}</span></td>
          <td><div class="mono">${esc(t.uKodu||'—')}</div>${t.kisaAciklama?`<div class="rt-silik rt-kes">${esc(t.kisaAciklama)}</div>`:''}</td>
          <td class="rt-kes" style="max-width:280px" title="${esc(t.aciklama||'')}">${esc(t.aciklama||'')}</td>
          <td>${esc(rtBolum(t.bolum))}${t.talepMakine?` <span class="mono rt-silik">${esc(t.talepMakine)}</span>`:''}</td>
          <td>${esc(t.talepEdenKisi||'—')}</td>
          <td class="r mono">${rtFmt(o.parca)}</td>
          <td class="r mono">${rtDk(o.beklemeDk)}</td>
          <td>${o.kapali?`<span style="color:var(--success)">Tamamlandı</span>`:o.ops.some(x=>x.status==='devam')?`<span style="color:var(--accent)">İşlemde</span>`:`<span style="color:var(--warn)">Bekliyor</span>`}</td>
        </tr>`; }).join('')}
    </tbody></table></div>
    <div class="rt-sayfa">${modalSayfaSeridi(rtSayfa, toplamSayfa, 'rtSayfaGit')}</div>` : `<div class="rt-bos">Seçime uyan talep yok.</div>`}
  </div>`;
}
