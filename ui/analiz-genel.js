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
  /* Liste "Ayrıntılar"ın içinde — süzünce görünsün diye ayrıntılar açılır. */
  if(rtSecim && typeof agDetay!=='undefined') agDetay.tadilat = true;
  rtSayfa = 1; render(); if(rtSecim) rtKaydir('rt-liste');
}
function rtSecimKaldir(){ rtSecim = null; rtSayfa = 1; render(); }
function rtSayfaGit(n){ rtSayfa = n; render(); rtKaydir('rt-liste'); }
function usSec(tur, anahtar, etiket){
  usSecim = (usSecim && usSecim.tur===tur && usSecim.anahtar===anahtar) ? null : { tur, anahtar, etiket };
  if(usSecim && typeof agDetay!=='undefined') agDetay.uretim = true;
  usSayfa = 1; render(); if(usSecim) rtKaydir('us-liste');
}
function usSecimKaldir(){ usSecim = null; usSayfa = 1; render(); }
function usSayfaGit(n){ usSayfa = n; render(); rtKaydir('us-liste'); }

function rtGun(ts){ const d=new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
/* Gün hedef aya sığdırılıyor: 31 Ekim'den bir ay geri "31 Eylül" = 1 Ekim olup önceki dönem
   seçili döneme taşıyordu (bulgu 05.10.2026). */
function rtAyEkle(ts, k){ const d=new Date(ts); const Y=d.getFullYear(), M=d.getMonth()+k; const D=Math.min(d.getDate(), new Date(Y, M+1, 0).getDate()); return new Date(Y, M, D, d.getHours(), d.getMinutes()).getTime(); }
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
    let b = rtTarihOku(rtBas), s = rtTarihOku(rtSon);
    if(b!=null && s!=null && s<b){ const x=b; b=s; s=x; } // ters girilmişse yer değiştir
    if(b!=null && s!=null) return { bas:b, son:s+86400000, etiket:`${rtTarihYaz(b)} – ${rtTarihYaz(s)}` };
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
function rtDk(dk){ if(dk==null) return '—'; if(dk<1) return '<1 dk'; if(dk<60) return Math.round(dk)+' dk'; if(dk<1440) return (dk/60).toFixed(dk<600?1:0).replace('.',',')+' sa'; return (dk/1440).toFixed(1).replace('.',',')+' gün'; }
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
  personel: t => [...new Set(tadilatOperasyonlarArray(t).map(o=>o.operatorUsername).filter(Boolean))].map(u=>[u,u]),
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
/* BİTEN İŞ EMRİ (05.10.2026 düzeltmesi) — eskiden "son operasyon" işaretli HER kayıt bir iş emri
   sayılıyordu. Kullanıcı Eylül'ü CANIAS'la kıyasladı: CANIAS 204 iş emri / 1.683 parça, biz 599 /
   2.451. Nedenler: (1) _ZARF ve _ELMAS yarı mamulleri ayrı ayrı "son operasyon"la bitiriliyor, sonra
   preste birleşip fırın/taşlama ile devam ediyor — tek iş emri 2-3 kez sayılıyordu; (2) parti parti
   biten işte her parti ayrı sayılıyordu; (3) aynı iş emrinde birden fazla makinede "son operasyon"
   işaretleniyordu (ör. PT02 sonra FKK). Artık iş emri CANIAS iş emri numarasıyla (talepNo; yoksa U
   kodu) TEK kez sayılıyor: açık operasyonu kalmamış VE en son biten kaydı "son operasyon" işaretli
   ise biter, bitiş = o kaydın bitişi. Parça = o son kaydın yarı mamulünde ve makinesinde "son
   operasyon"la biten kayıtların adet toplamı (partiler toplanır, zarf+elmas ikiye katlanmaz).
   Eylül'de CANIAS'la ortak 159 iş emrinin 146'sında adet birebir aynı çıktı. Kalan fark CANIAS'ın
   kapanış tarihinden: CANIAS iş emrini toplu kapatıyor (09.09, 19.09, 30.09), atölyede bitiş
   tarihi farklı aya düşebiliyor. */
function usYariMamul(k){ const m = /_(ZARF|ELMAS)$/.exec(String(k||'').toUpperCase()); return m ? m[1] : ''; }
let _usIsEmriKaynak = null, _usIsEmriSonuc = null;
function usIsEmirleri(){
  const kaynak = entriesArray();
  if(kaynak === _usIsEmriKaynak) return _usIsEmriSonuc;
  const g = {};
  kaynak.forEach(e=>{ const k = String(e.talepNo||'').trim() || ('U:'+usTabanKod(e.isEmriNo)); (g[k] = g[k] || []).push(e); });
  const sonuc = [];
  Object.values(g).forEach(ops=>{
    if(ops.some(o=>o.status!=='tamamlandi')) return;
    const son = ops.reduce((x,o)=>(o.endTs||0)>(x.endTs||0) ? o : x, ops[0]);
    if(!son.sonOperasyon || !son.endTs) return;
    const ym = usYariMamul(son.isEmriNo);
    const parca = ops.filter(o=>o.sonOperasyon && o.makine===son.makine && usYariMamul(o.isEmriNo)===ym).reduce((s,o)=>s+rtSayi(o.adet),0);
    sonuc.push({ ...son, adet: parca, _ops: ops, _ilk: Math.min(...ops.map(o=>o.startTs||son.startTs)) });
  });
  _usIsEmriKaynak = kaynak; _usIsEmriSonuc = sonuc;
  return sonuc;
}
function usOps(e){ return e._ops || [e]; }
function usIlk(e){ return e._ilk || e.startTs; }
function usBitenler(bas, son){
  return usIsEmirleri().filter(e=>e.endTs>=bas && e.endTs<son && usAtolyeUyar(e));
}
function usOzet(liste, gruplar){
  const sureGun = [], opSay = [];
  let parca = 0;
  liste.forEach(e=>{
    parca += rtSayi(e.adet);
    sureGun.push((e.endTs-usIlk(e))/86400000); opSay.push(usOps(e).length);
  });
  return { isEmri: liste.length, parca, sureGun: rtMedyan(sureGun), opSay: rtMedyan(opSay) };
}
const US_KIRILIM = {
  'u-bolum':  e => [[usBolum(e), usBolum(e)]],
  /* Rotasında o makine olan iş emirleri (yalnız SON makine değil) — "Makine yükü" çubukları her
     operasyonu sayıyor, tıklayınca liste boş kalıyordu (ör. testere, ara makineler). */
  'u-makine': e => [...new Set(usOps(e).map(usMakine).filter(Boolean))].map(m=>[m,m]),
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

/* ---------- SUNUM (05.10.2026, ikinci tur) ----------
   Kullanıcı ilk hâli "anlaşılır değil, okunaklı gelmiyor" buldu. Kendi yıllık sunumundaki biçime
   yaklaştırıldı: her bölüm SAYILARI DÜZ CÜMLEYLE özetleyerek açılıyor (sunumdaki grafik altı
   yorum kutuları gibi); bir sayı sayfada bir kez; fark "▲ %113" yerine "+318 (%113 artış) ·
   Ağustos: 281" diye yazılı, yüzdelerde puan; her bölümde 3 ana kutu, gerisi "Ayrıntılar"da;
   birden fazla ay kapsayan dönemde sunumdaki aylık tablo. */

let agDetay = { uretim:false, tadilat:false, ayrim:false };
function agDetayAc(k){ agDetay[k] = !agDetay[k]; render(); }

/* Önceki dönemin okunur adı — fark satırında "Ağustos: 281" gibi. */
function rtOncekiAd(a, on){
  if(rtDonem==='bugun') return 'Dün';
  if(rtDonem==='son7') return 'Önceki 7 gün';
  if(rtDonem==='buAy') return `${RT_AY[new Date(on.bas).getMonth()]} (aynı günler)`;
  if(rtDonem==='gecenAy') return RT_AY[new Date(on.bas).getMonth()];
  if(rtDonem==='son3Ay') return 'Önceki 3 ay';
  if(rtDonem==='buYil') return `${new Date(on.bas).getFullYear()} (aynı dönem)`;
  return 'Önceki dönem';
}
/* Fark satırı. iyi: 'artis' (artış iyi) | 'azalis' (azalış iyi) | null (renksiz).
   puan: değerler yüzde ise fark "puan" olarak yazılır (verimlilik %29 → %34 = +5 puan). */
function rtFark(simdi, once, opt){
  opt = opt || {};
  if(simdi==null || once==null || !isFinite(once)) return '';
  const onAd = opt.onAd || 'Önceki dönem';
  const onMetin = opt.bicim ? opt.bicim(once) : rtFmt(once);
  if(once===0 && !opt.puan) return `<div class="rt-fark-satir"><span class="rt-fark notr" title="Uygulama Ağustos 2026'da kayıt tutmaya başladı">Önceki dönemde kayıt yok</span></div>`;
  const fark = simdi - once;
  const sinif = Math.abs(fark) < 1e-9 ? 'notr' : (!opt.iyi ? 'notr' : ((fark>0) === (opt.iyi==='artis') ? 'iyi' : 'kotu'));
  let metin;
  if(opt.puan){
    const p = Math.round(fark);
    metin = p===0 ? 'değişmedi' : `${p>0?'+':''}${p} puan`;
  } else {
    const yuzde = Math.abs(fark/once*100);
    const yz = yuzde>=10 ? Math.round(yuzde) : yuzde.toFixed(1).replace('.',',');
    metin = Math.abs(fark)<1e-9 ? 'değişmedi' : `${fark>0?'+':'−'}${opt.bicim ? opt.bicim(Math.abs(fark)) : rtFmt(Math.abs(fark))} <small>(%${yz} ${fark>0?'artış':'azalış'})</small>`;
  }
  return `<div class="rt-fark-satir"><span class="rt-fark ${sinif}">${metin}</span><span class="rt-onceki">${esc(onAd)}: ${onMetin}</span></div>`;
}
function rtKpi(etiket, deger, fark, alt){
  return `<div class="rt-kpi"><div class="rt-kpi-k">${esc(etiket)}</div><div class="rt-kpi-v">${deger}</div>${fark||''}${alt?`<div class="rt-kpi-s">${alt}</div>`:''}</div>`;
}
function agYorum(cumleler){
  const c = cumleler.filter(Boolean);
  return c.length ? `<p class="ag-yorum">${c.join(' ')}</p>` : '';
}
function agYuzde(p){ return '%'+Math.round(p); }
/* 10 saatten uzun süreler "11.410 saat" — "11409 sa 41 dk" okunmuyordu. */
function agSaat(dk){ return dk>=600 ? rtFmt(dk/60)+' saat' : fmtDur(dk*60000); }

function rtCubukListe(tur, gruplar, opt){
  opt = opt || {};
  const secimFn = opt.secFn || 'rtSec', secim = opt.secim !== undefined ? opt.secim : rtSecim;
  const ust = gruplar.slice(0, opt.adet || 10);
  if(!ust.length) return `<div class="rt-bos">Bu dönemde kayıt yok.</div>`;
  const max = Math.max(...ust.map(g=>g.parca), 1);
  const birim = opt.birim || 'talep';
  const toplam = gruplar.reduce((s,g)=>s+g.parca,0) || 1;
  return `<div class="rt-cubuklar">${ust.map(g=>{
    const secili = secim && secim.tur===tur && secim.anahtar===g.anahtar;
    const ana = opt.deger ? opt.deger(g) : rtFmt(g.parca);
    const yan = opt.yan ? opt.yan(g) : `${agYuzde(g.parca/toplam*100)} · ${g.talep} ${birim}`;
    return `<button type="button" class="rt-cubuk ${secili?'secili':''}" onclick="${secimFn}('${escJs(tur)}','${escJs(g.anahtar)}','${escJs(g.etiket)}')" title="${esc(g.etiket)} · listeyi buna göre süz">
      <span class="rt-cubuk-ad ${opt.mono?'mono':''}">${esc(g.etiket)}</span>
      <span class="rt-cubuk-iz"><span style="width:${Math.max(1.5, g.parca/max*100).toFixed(1)}%${opt.renk?';background:'+opt.renk:''}"></span></span>
      <span class="rt-cubuk-d"><b class="mono">${ana}</b><small>${yan}</small></span>
    </button>`;}).join('')}</div>${gruplar.length>ust.length ? `<div class="rt-dip">+${gruplar.length-ust.length} daha · tümü aşağıdaki listede</div>` : ''}`;
}
/* Grafik kutunun GERÇEK genişliğinde çiziliyor (sabit viewBox geniş kutuda yazıları iriltiyor,
   telefonda okunmaz yapıyordu). Kesik çizgi = kova başına ortalama; günlük görünümde hafta sonu soluk. */
function rtSeriSvg(seri, aria, birim){
  const kabuk = document.querySelector('.admin-shell-body');
  const W = Math.max(300, Math.min(1500, ((kabuk && kabuk.clientWidth) || window.innerWidth || 900) - (window.innerWidth<=900 ? 66 : 84)));
  const H=220, alt=26, ust=22, sol=46, sag=8;
  const k = seri.kovalar;
  const toplamlar = k.map(x=>x.d.reduce((s,v)=>s+v,0));
  const ham = Math.max(1, ...toplamlar);
  const adimlar = [1,2,5,10,20,25,50,100,200,250,500,1000,2000,2500,5000,10000,20000,50000];
  const adim = adimlar.find(a=>ham/a<=4) || 50000;
  const max = Math.ceil(ham/adim)*adim;
  const ph=H-alt-ust, pw=W-sol-sag, y=v=>ust+ph-(v/max*ph);
  const grup = pw/Math.max(1,k.length), bw = Math.max(3, Math.min(48, grup*0.64));
  const etiketAdim = Math.ceil(k.length/(W<500?8:16));
  const isGun = seri.kip==='gun';
  /* Ortalama: hafta sonu ve boş günler dahil değil — "çalışılan gün başına" ortalama. */
  const dolu = toplamlar.filter(v=>v>0);
  const ort = dolu.length ? dolu.reduce((s,v)=>s+v,0)/dolu.length : 0;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="rt-svg" role="img" aria-label="${esc(aria||'')}">`;
  for(let v=0; v<=max; v+=adim){
    s += `<line x1="${sol}" x2="${W-sag}" y1="${y(v)}" y2="${y(v)}" class="rt-grid"/><text x="${sol-8}" y="${y(v)+4}" text-anchor="end" class="rt-eks">${rtFmt(v)}</text>`;
  }
  k.forEach((x,i)=>{
    const cx = sol + grup*i + grup/2;
    const hs = isGun && [0,6].includes(new Date(x.bas).getDay());
    let taban = 0;
    x.d.forEach((v,j)=>{ if(v<=0) return; const y1=y(taban+v), y0=y(taban);
      s += `<rect x="${(cx-bw/2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${(y0-y1).toFixed(1)}" rx="2" class="${seri.seriler[j].sinif}${hs?' rt-hs':''}"><title>${esc(x.etiket)} · ${esc(seri.seriler[j].ad)} ${rtFmt(v)}</title></rect>`;
      taban += v; });
    if(k.length<=14 && taban>0) s += `<text x="${cx.toFixed(1)}" y="${(y(taban)-6).toFixed(1)}" text-anchor="middle" class="rt-deger">${rtFmt(taban)}</text>`;
    if(i%etiketAdim===0) s += `<text x="${cx.toFixed(1)}" y="${H-8}" text-anchor="middle" class="rt-eks${hs?' rt-hs-et':''}">${esc(x.etiket)}</text>`;
  });
  if(ort>0 && k.length>2){
    s += `<line x1="${sol}" x2="${W-sag}" y1="${y(ort).toFixed(1)}" y2="${y(ort).toFixed(1)}" class="rt-ort"/>`;
    s += `<text x="${W-sag-2}" y="${(y(ort)-6).toFixed(1)}" text-anchor="end" class="rt-ort-et">ortalama ${rtFmt(ort)} ${esc(birim||'')}/${isGun?'gün':seri.kip==='hafta'?'hafta':'ay'}</text>`;
  }
  return s + `</svg>`;
}
function agBolumBas(id, baslik, alt){
  return `<div class="ag-bolum-bas" id="${id}"><h3>${esc(baslik)}</h3>${alt?`<span>${alt}</span>`:''}</div>`;
}
function agDetayDugme(k, etiket){
  return `<button type="button" class="ag-detay-dugme" onclick="agDetayAc('${k}')" aria-expanded="${agDetay[k]?'true':'false'}">${ico(agDetay[k]?'chevronUp':'chevronDown',14)} ${agDetay[k]?'Ayrıntıları gizle':esc(etiket)}</button>`;
}

/* ---------- Ortak üst kısım ---------- */
function analizGenelUstHtml(opt){
  opt = opt || {};
  const a = rtAralik(), on = rtOncekiAralik(a);
  const donemBtn = (k, ad) => `<button type="button" class="rt-donem ${rtDonem===k?'on':''}" onclick="rtDonemSec('${k}')">${ad}</button>`;
  const atolyeBtn = (k, ad) => `<button type="button" class="rt-donem ${analizAtolyeFilter===k?'on':''}" onclick="rtAtolyeSec('${k}')">${ad}</button>`;
  return `<div class="ag-ust">
    <div class="rt-filtre">
      <div class="rt-filtre-grup">${donemBtn('bugun','Bugün')}${donemBtn('son7','Son 7 gün')}${donemBtn('buAy','Bu ay')}${donemBtn('gecenAy','Geçen ay')}${donemBtn('son3Ay','Son 3 ay')}${donemBtn('buYil','Bu yıl')}${donemBtn('ozel','Özel')}</div>
      ${rtDonem==='ozel' ? `<div class="rt-filtre-grup"><input type="date" id="rt-bas" value="${esc(rtBas)}" onchange="rtOzelYaz('bas',this.value)"><span style="color:var(--text-muted)">–</span><input type="date" id="rt-son" value="${esc(rtSon)}" onchange="rtOzelYaz('son',this.value)"></div>` : ''}
      ${opt.atolyeYok ? '' : `<div class="rt-filtre-grup ag-atolye">${atolyeBtn('tumu','Tüm atölyeler')}${atolyeBtn('imalat','İmalat')}${atolyeBtn('tadilat','Tadilat')}</div>`}
    </div>
    <div class="rt-donem-bilgi"><b>${esc(a.etiket)}</b> · kıyaslanan: ${esc(rtOncekiAd(a,on))} (${rtTarihYaz(on.bas)} – ${rtTarihYaz(Math.max(on.bas, on.son-1))})</div>
  </div>`;
}

/* ---------- ÖZET ----------
   Üç ana sayı + sayfanın geri kalanını özetleyen cümleler. Verimlilik/duruş Özet'te kart değil,
   cümlede: kartı Verimlilik bölümünde (sayı sayfada bir kez). */
function analizOzetHtml(t){
  if(analizAtolyeFilter==='tadilat') return analizOzetTadilatHtml(t);
  const a = rtAralik(), on = rtOncekiAralik(a), onAd = rtOncekiAd(a,on);
  const gr = usGruplar();
  const us = usOzet(usBitenler(a.bas, a.son), gr), usOn = usOzet(usBitenler(on.bas, on.son), gr);
  const rtL = rtKayitlar(a.bas, a.son);
  const rt = rtOzet(rtL), rtOn = rtOzet(rtKayitlar(on.bas, on.son));
  let tOn = null;
  if(!agSaatKiyasYok()) try{ tOn = agVeri(dateKey(on.bas), dateKey(Math.max(on.bas, on.son-1)), analizAtolyeFilter).totals; }catch(e){ tOn = null; }
  const yon = (s,o)=> (o>0 && s!==o) ? `; önceki döneme göre iş emri %${Math.round(Math.abs(s-o)/o*100)} ${s>o?'fazla':'az'}` : '';
  const cumleler = [
    us.isEmri ? `Bu dönemde <b>${rtFmt(us.isEmri)} iş emri</b> bitti ve <b>${rtFmt(us.parca)} parça</b> üretildi${yon(us.isEmri, usOn.isEmri)}.` : 'Bu dönemde biten iş emri yok.',
    rt.talep ? `Tadilatta <b>${rtFmt(rt.talep)} talep</b> ile <b>${rtFmt(rt.parca)} parça</b> işlendi.` : '',
    (t && t.availMin>0) ? `Makine verimliliği <b>%${t.verimlilik}</b>${tOn && tOn.availMin>0 ? ` (${esc(onAd)}: %${tOn.verimlilik})` : ''}.` : '',
  ];
  /* Birden fazla ay kapsayan dönemde sunumdaki aylık tablo. */
  const ayTablo = (()=>{
    const aylar = [];
    for(let d=new Date(a.bas); d.getTime()<Math.min(a.son, Date.now()); d=new Date(d.getFullYear(), d.getMonth()+1, 1)) aylar.push(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
    /* Yalnızca en az ~6 haftalık dönemde (Son 3 ay, Bu yıl, uzun Özel): "Son 7 gün" iki aya
       taşınca tablo iki ayın TAMAMINI gösteriyordu. Her satır dönemle kırpılır. */
    if(aylar.length<2 || (a.son-a.bas) < 40*86400000) return '';
    const satir = aylar.map(b0=>{ const s0 = new Date(new Date(b0).getFullYear(), new Date(b0).getMonth()+1, 1).getTime();
      const b = Math.max(b0, a.bas), s = Math.min(s0, a.son);
      const u = usOzet(usBitenler(b, s), gr), r = rtOzet(rtKayitlar(b, s));
      /* Yarım ay (devam eden ya da dönemin kestiği): tam bir ayla yüzde kıyası yanıltır (Ekim'in 5 günü / Eylül'ün tamamı = "−90%"). */
      const yarim = s0 > Date.now() || b > b0 || s < s0;
      const gun = yarim ? Math.max(1, Math.ceil((Math.min(s, Date.now())-b)/86400000)) : 0;
      return { ad: RT_AY[new Date(b).getMonth()] + (yarim ? ` <small class="rt-silik">(${gun} gün)</small>` : ''), yarim, isEmri:u.isEmri, parca:u.parca, tParca:r.parca, tTalep:r.talep }; });
    const top = satir.reduce((x,r)=>({ isEmri:x.isEmri+r.isEmri, parca:x.parca+r.parca, tParca:x.tParca+r.tParca, tTalep:x.tTalep+r.tTalep }), {isEmri:0,parca:0,tParca:0,tTalep:0});
    /* Üretimde artış iyi (yeşil); tadilatta artış iyi ya da kötü değil (nötr). */
    const hucre = (r,k,i,notr)=>{ const once = (i>0 && !r.yarim && !satir[i-1].yarim) ? satir[i-1][k] : null; const f = once ? Math.round((r[k]-once)/once*100) : null;
      return `<td class="r"><span class="mono">${rtFmt(r[k])}</span>${f!=null&&f!==0?`<small class="${notr?'notr':f>0?'iyi':'kotu'}">${f>0?'+':''}${f}%</small>`:''}</td>`; };
    return `<div class="rt-kutu ag-ay-tablo"><div class="rt-kutu-bas"><h4>Ay ay</h4><span>küçük rakam: bir önceki aya göre değişim · devam eden ay kıyaslanmaz</span></div>
      <div class="table-wrap"><table class="rt-tablo"><thead><tr><th>Ay</th><th class="r">Biten iş emri</th><th class="r">Üretilen parça</th><th class="r">Tadilat parça</th><th class="r">Tadilat talep</th></tr></thead><tbody>
      ${satir.map((r,i)=>`<tr class="rt-tablo-sabit"><td>${r.ad}</td>${hucre(r,'isEmri',i)}${hucre(r,'parca',i)}${hucre(r,'tParca',i,true)}${hucre(r,'tTalep',i,true)}</tr>`).join('')}
      <tr class="rt-tablo-sabit ag-toplam"><td>Toplam</td><td class="r mono">${rtFmt(top.isEmri)}</td><td class="r mono">${rtFmt(top.parca)}</td><td class="r mono">${rtFmt(top.tParca)}</td><td class="r mono">${rtFmt(top.tTalep)}</td></tr>
      </tbody></table></div></div>`;
  })();
  return `${agBolumBas('ag-ozet','Özet', esc(a.etiket))}
  ${agYorum(cumleler)}
  <div class="rt-kpiler ag-kpi-buyuk">
    ${rtKpi('Biten iş emri', rtFmt(us.isEmri), rtFark(us.isEmri, usOn.isEmri, { iyi:'artis', onAd }))}
    ${rtKpi('Üretilen parça', rtFmt(us.parca), rtFark(us.parca, usOn.parca, { iyi:'artis', onAd }))}
    ${rtKpi('Tadilat parça', rtFmt(rt.parca), rtFark(rt.parca, rtOn.parca, { onAd }), `${rtFmt(rt.talep)} talep`)}
  </div>
  ${ayTablo}`;
}

/* ---------- ÜRETİM ---------- */
function analizUretimHtml(){
  const a = rtAralik(), on = rtOncekiAralik(a), onAd = rtOncekiAd(a,on);
  const gr = usGruplar();
  const liste = usBitenler(a.bas, a.son), onceki = usBitenler(on.bas, on.son);
  const oz = usOzet(liste, gr), ozOn = usOzet(onceki, gr);
  const seri = rtZamanSerisi(liste, a, e=>e.endTs, [{ ad:'parça', sinif:'rt-s-tad', fn:e=>rtSayi(e.adet) }]);
  const bolumG = rtGrupla(liste, US_KIRILIM['u-bolum']);
  const belirsiz = bolumG.find(g=>g.anahtar==='Belirsiz');
  const ilkBolum = bolumG.find(g=>g.anahtar!=='Belirsiz');

  const yuk = {};
  entriesArray().forEach(e=>{
    if(!(e.endTs>=a.bas && e.endTs<a.son) || !usAtolyeUyar(e) || isFasonMachine(e.makine)) return;
    const m = String(e.makine||'').split(' · '); const k = m[0]; if(!k) return;
    const g = yuk[k] || (yuk[k] = { anahtar:k, etiket:k, ad:m[1]||'', parca:0, talep:0 });
    g.parca += usNetMs(e)/3.6e6; g.talep += 1;
  });
  const yukL = Object.values(yuk).sort((x,y)=>y.parca-x.parca);
  const mamulG = rtGrupla(liste, e=>{ const k=usTabanKod(e.isEmriNo); return [[k, k]]; }).slice(0,8);

  const suzulmus = liste.filter(usSecimeUyar).sort((x,y)=>(y.endTs||0)-(x.endTs||0));
  usSonListe = suzulmus;
  const toplamSayfa = Math.max(1, Math.ceil(suzulmus.length/RT_SAYFA_BOYUT));
  usSayfa = Math.min(Math.max(1, usSayfa), toplamSayfa);
  const sayfa = suzulmus.slice((usSayfa-1)*RT_SAYFA_BOYUT, usSayfa*RT_SAYFA_BOYUT);
  const suzParca = suzulmus.reduce((s,e)=>s+rtSayi(e.adet),0);
  const toplamParca = oz.parca || 1;

  const cumleler = [
    ilkBolum && oz.parca ? `Biten parçalarda en büyük pay <b>${esc(ilkBolum.etiket)}</b> bölümünün: <b>${agYuzde(ilkBolum.parca/toplamParca*100)}</b>.` : '',
    yukL[0] ? `En çok çalışan makine <b>${esc(yukL[0].anahtar)}</b>: ${rtFmt(yukL[0].parca)} saat net.` : '',
    oz.sureGun!=null ? `Bir iş emrinin ilk operasyondan bitişe süresi genelde <b>${rtDk(oz.sureGun*1440)}</b>, operasyon sayısı <b>${Math.round(oz.opSay)}</b>.` : '',
  ];

  return `${agBolumBas('ag-uretim','Üretim','rotası tamamlanan iş emirleri')}
  ${agYorum(cumleler)}
  <div class="rt-kpiler">
    ${rtKpi('İş emri süresi', oz.sureGun==null?'—':rtDk(oz.sureGun*1440), rtFark(oz.sureGun, ozOn.sureGun, { iyi:'azalis', onAd, bicim:v=>rtDk(v*1440) }), 'ortanca değer · ilk operasyon → bitiş')}
    ${rtKpi('Parça / iş emri', oz.isEmri?(oz.parca/oz.isEmri).toFixed(1).replace('.',','):'—', '', `${rtFmt(oz.isEmri)} iş emri, ${rtFmt(oz.parca)} parça`)}
  </div>
  <div class="rt-izgara">
    <div class="rt-kutu rt-genis">
      <div class="rt-kutu-bas"><h4>Üretilen parça</h4><span>${seri.kip==='gun'?'gün gün · hafta sonu soluk':seri.kip==='hafta'?'hafta hafta':'ay ay'} · iş emrinin bittiği güne göre</span></div>
      ${liste.length ? rtSeriSvg(seri, 'Dönem içinde üretilen parça', 'parça') : `<div class="rt-bos">Bu dönemde biten iş emri yok.</div>`}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Bölüm</h4><span>parça</span></div>
      ${rtCubukListe('u-bolum', bolumG, { secFn:'usSec', secim:usSecim, birim:'iş emri' })}
      ${belirsiz ? `<div class="rt-dip">"Belirsiz": mamul açıklamasından bölüm anlaşılmayan ${belirsiz.talep} iş emri (genelde makine yedek parçaları).</div>` : ''}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Makine yükü</h4><span>net çalışma saati · fason hariç</span></div>
      ${rtCubukListe('u-makine', yukL, { secFn:'usSec', secim:usSecim, mono:true, renk:'var(--success)', deger:g=>`${rtFmt(g.parca)} sa`, yan:g=>`${g.talep} operasyon` })}
    </div>
  </div>
  ${agDetayDugme('uretim', `Ayrıntılar: en çok biten mamuller ve ${rtFmt(suzulmus.length)} iş emrinin listesi`)}
  ${agDetay.uretim ? `
  <div class="rt-izgara" style="margin-top:12px">
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
      <div><h4>Biten iş emirleri</h4><span title="İş emri CANIAS numarasıyla bir kez sayılır: açık operasyonu kalmamış ve en son kaydı 'son operasyon' ise biter. Zarf ve elmas ayrı sayılmaz.">${usSecim ? `<b>${esc(usSecim.etiket)}</b> · ` : ''}${rtFmt(suzulmus.length)} iş emri · ${rtFmt(suzParca)} parça</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${usSecim ? `<button type="button" class="btn-ghost" style="width:auto;padding:7px 12px" onclick="usSecimKaldir()">${ico('x',13)} Süzmeyi kaldır</button>` : ''}
        ${suzulmus.length ? `<button type="button" class="btn-primary" style="width:auto;padding:7px 14px" onclick="usExcelAktar()">Excel'e aktar (${rtFmt(suzulmus.length)})</button>` : ''}
      </div>
    </div>
    ${sayfa.length ? `<div class="table-wrap"><table class="rt-tablo rt-tablo-liste"><thead><tr><th>Bitiş</th><th>İş emri</th><th>Mamul</th><th>Bölüm</th><th>Son makine</th><th class="r">Parça</th><th class="r">Süre</th><th class="r">Operasyon</th></tr></thead><tbody>
      ${sayfa.map(e=>{ const ops = usOps(e), ilk = usIlk(e);
        return `<tr class="rt-tablo-sabit">
          <td class="mono" style="white-space:nowrap">${fmtDT(e.endTs)}</td>
          <td><div class="mono">${esc(e.talepNo||'—')}</div><div class="mono rt-silik">${esc(usTabanKod(e.isEmriNo))}</div></td>
          <td class="rt-kes" style="max-width:260px" title="${esc(usMamulAdi(e))}">${esc(usMamulAdi(e)||'—')}</td>
          <td>${esc(usBolum(e))}</td>
          <td class="mono">${esc(usMakine(e)||'—')}</td>
          <td class="r mono">${rtFmt(rtSayi(e.adet))}</td>
          <td class="r mono">${rtDk((e.endTs-ilk)/60000)}</td>
          <td class="r mono">${ops.length}</td>
        </tr>`; }).join('')}
    </tbody></table></div>
    <div class="rt-sayfa">${modalSayfaSeridi(usSayfa, toplamSayfa, 'usSayfaGit')}</div>` : `<div class="rt-bos">Seçime uyan iş emri yok.</div>`}
  </div>` : ''}`;
}
async function usExcelAktar(){
  if(!(await ensureXLSX())) return;
  const gr = usGruplar();
  const satirlar = usSonListe.map(e=>{ const ops = usOps(e), ilk = usIlk(e);
    return { 'Bitiş': new Date(e.endTs), 'İş Talep No': e.talepNo||'', 'İş Emri (U kodu)': e.isEmriNo||'', 'Mamul': usMamulAdi(e), 'Bölüm': usBolum(e),
      'Son Makine': e.makine||'', 'Parça': rtSayi(e.adet), 'İlk Başlangıç': new Date(ilk), 'Süre (gün)': Math.round((e.endTs-ilk)/86400000*10)/10, 'Operasyon Sayısı': ops.length }; });
  const ws = XLSX.utils.json_to_sheet(satirlar, { cellDates:true });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Biten İş Emirleri');
  XLSX.writeFile(wb, `Biten_Is_Emirleri_${dateKey(Date.now())}.xlsx`);
}

/* ---------- TADİLAT ---------- */
function analizTadilatHtml(){
  const a = rtAralik(), on = rtOncekiAralik(a), onAd = rtOncekiAd(a,on);
  const liste = rtKayitlar(a.bas, a.son);
  const onceki = rtKayitlar(on.bas, on.son);
  const oz = rtOzet(liste), ozOn = rtOzet(onceki);
  const fAt = analizAtolyeFilter;
  const acik = tadilatArray().filter(t=>!t.testKaydi && !tadilatTamamlandiMi(t) && (fAt==='tumu' || (t.atolye||'imalat')===fAt)).length;
  const seri = rtZamanSerisi(liste, a, t=>t.olusturmaTs, [
    { ad:'tadilat atölyesi', sinif:'rt-s-tad', fn:t=>(t.atolye||'imalat')==='tadilat' ? rtSayi(t.adet) : 0 },
    { ad:'imalat atölyesi',  sinif:'rt-s-ima', fn:t=>(t.atolye||'imalat')==='tadilat' ? 0 : rtSayi(t.adet) }]);
  const bolumG = rtGrupla(liste, RT_KIRILIM.bolum), bolumOnG = rtGrupla(onceki, RT_KIRILIM.bolum);
  const makineG = rtGrupla(liste, RT_KIRILIM.makine);
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
  const gunuGecen = bekTad[4]+bekIma[4];
  /* Tek bir talep dönemin parçasının yarısından fazlasıysa söyle — 3.000 adetlik T BOLT gibi. */
  const enBuyuk = liste.reduce((m,t)=> rtSayi(t.adet)>rtSayi(m&&m.adet) ? t : m, null);
  const tekBuyuk = enBuyuk && oz.parca && rtSayi(enBuyuk.adet)/oz.parca > 0.5;

  const suzulmus = liste.filter(rtSecimeUyar).sort((x,y)=>(y.olusturmaTs||0)-(x.olusturmaTs||0));
  rtSonListe = suzulmus;
  const toplamSayfa = Math.max(1, Math.ceil(suzulmus.length/RT_SAYFA_BOYUT));
  rtSayfa = Math.min(Math.max(1, rtSayfa), toplamSayfa);
  const sayfa = suzulmus.slice((rtSayfa-1)*RT_SAYFA_BOYUT, rtSayfa*RT_SAYFA_BOYUT);
  const suzParca = suzulmus.reduce((s,t)=>s+rtSayi(t.adet),0);

  const cumleler = [
    /* Tadilat kipinde talep/parça Özet'te — burada tekrar edilmiyor. */
    fAt==='tadilat' ? '' : (oz.talep ? `<b>${rtFmt(oz.talep)} talep</b>, <b>${rtFmt(oz.parca)} parça</b>${fAt==='tumu' && payTad!=null ? `; tadilat atölyesinin payı <b>${agYuzde(payTad)}</b>` : ''}.` : 'Bu dönemde tadilat talebi yok.'),
    tekBuyuk ? `Dikkat: tek bir talep (${esc(enBuyuk.uKodu||'')}, ${rtFmt(rtSayi(enBuyuk.adet))} adet) dönemin parçasında ${agYuzde(rtSayi(enBuyuk.adet)/oz.parca*100)} pay tutuyor; oranlar bu talepten etkileniyor.` : '',
    bek!=null ? `Talepler genelde açıldıktan <b>${rtDk(bek)}</b> sonra işleme giriyor${gunuGecen ? `; bir günden fazla bekleyen talep: <b>${gunuGecen}</b>` : ''}.` : '',
    makineG[0] && makineG[0].anahtar!=='—' ? `En çok tadilat isteyen makine <b>${esc(makineG[0].etiket)}</b>: ${makineG[0].talep} talep, ${rtFmt(makineG[0].parca)} parça.` : '',
    acik ? `Şu an açık talep: <b>${acik}</b>.` : '',
  ];

  return `${agBolumBas('ag-tadilat','Tadilat','talebin açıldığı güne göre')}
  ${agYorum(cumleler)}
  <div class="rt-kpiler">
    ${fAt==='tadilat' ? '' : rtKpi('Talep', rtFmt(oz.talep), rtFark(oz.talep, ozOn.talep, { onAd }), `talep başına ${oz.talep? (oz.parca/oz.talep).toFixed(1).replace('.',','):'—'} parça`)}
    ${rtKpi('Başlama bekleme', rtDk(bek), rtFark(bek, bekOn, { iyi:'azalis', onAd, bicim:rtDk }), fAt==='tumu' ? `ortanca · tadilat ${rtDk(oz.beklemeTad)}, imalat ${rtDk(oz.beklemeIma)}` : 'ortanca')}
    ${rtKpi('İşlem süresi', rtDk(net), '', fAt==='tumu' ? `ortanca net · tadilat ${rtDk(oz.netTad)}, imalat ${rtDk(oz.netIma)}` : 'ortanca net')}
  </div>
  <div class="rt-izgara">
    <div class="rt-kutu rt-genis">
      <div class="rt-kutu-bas"><h4>Tadilat parça adedi</h4><span>${seri.kip==='gun'?'gün gün · hafta sonu soluk':seri.kip==='hafta'?'hafta hafta':'ay ay'}</span></div>
      ${liste.length ? rtSeriSvg(seri, 'Dönem içinde tadilat parça adedi', 'parça') : `<div class="rt-bos">Bu dönemde talep yok.</div>`}
      <div class="rt-lejant"><span><i class="rt-s-tad-i"></i>Tadilat atölyesi</span><span><i class="rt-s-ima-i"></i>İmalat atölyesi</span></div>
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Bölüm</h4><span>parça payı · çizgi: ${esc(onAd)}</span></div>
      ${bolumG.length ? `<div class="rt-cubuklar">${bolumG.map(g=>{
        const pay = oz.parca ? g.parca/oz.parca*100 : 0;
        const onG = bolumOnG.find(x=>x.anahtar===g.anahtar); const onPay = ozOn.parca && onG ? onG.parca/ozOn.parca*100 : 0;
        const secili = rtSecim && rtSecim.tur==='bolum' && rtSecim.anahtar===g.anahtar;
        return `<button type="button" class="rt-cubuk ${secili?'secili':''}" onclick="rtSec('bolum','${escJs(g.anahtar)}','${escJs(g.etiket)}')" title="${esc(g.etiket)} · listeyi buna göre süz">
          <span class="rt-cubuk-ad">${esc(g.etiket)}</span>
          <span class="rt-cubuk-iz"><span style="width:${Math.max(1.5,pay).toFixed(1)}%"></span>${ozOn.parca?`<em style="left:${Math.min(100,onPay).toFixed(1)}%" title="${esc(onAd)}: %${onPay.toFixed(0)}"></em>`:''}</span>
          <span class="rt-cubuk-d"><b class="mono">${agYuzde(pay)}</b><small>${rtFmt(g.parca)} parça</small></span></button>`; }).join('')}</div>` : `<div class="rt-bos">Bu dönemde kayıt yok.</div>`}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Talep eden makine</h4><span>parça</span></div>
      ${rtCubukListe('makine', makineG, { mono:true, adet:8 })}
    </div>
  </div>
  ${agDetayDugme('tadilat', 'Ayrıntılar: bekleme süreleri, işi yapan makine, işlem türü, tekrar gelen kodlar, talep eden kişi ve talep listesi')}
  ${agDetay.tadilat ? `
  <div class="rt-izgara" style="margin-top:12px">
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Başlama bekleme süresi</h4><span>talep sayısı</span></div>
      <div class="rt-bekleme">${RT_BEKLEME_KOVA.map(([, , ad],i)=>{
        const secili = rtSecim && rtSecim.tur==='bekleme' && rtSecim.anahtar===ad;
        return `<button type="button" class="rt-bek-sut ${secili?'secili':''}" onclick="rtSec('bekleme','${escJs(ad)}','${escJs('Bekleme '+ad)}')" title="${ad}: tadilat ${bekTad[i]}, imalat ${bekIma[i]} talep">
          <span class="rt-bek-cift">${fAt!=='imalat'?`<span class="rt-bek-c tad" style="height:${(bekTad[i]/bekMax*100).toFixed(1)}%"><b>${bekTad[i]||''}</b></span>`:''}${fAt!=='tadilat'?`<span class="rt-bek-c ima" style="height:${(bekIma[i]/bekMax*100).toFixed(1)}%"><b>${bekIma[i]||''}</b></span>`:''}</span>
          <span class="rt-bek-ad">${ad}</span></button>`; }).join('')}</div>
      <div class="rt-lejant"><span><i class="rt-s-tad-i"></i>Tadilat atölyesi</span><span><i class="rt-s-ima-i"></i>İmalat atölyesi</span></div>
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>İşi yapan makine</h4><span>operasyon · net saat</span></div>
      ${isleyenL.length ? `<table class="rt-tablo"><thead><tr><th>Makine</th><th class="r">Operasyon</th><th class="r">Net saat</th><th class="r rt-dar-gizle">Operasyon başına</th></tr></thead><tbody>
        ${isleyenL.map(g=>{ const secili = rtSecim && rtSecim.tur==='isleyen' && rtSecim.anahtar===g.anahtar;
          return `<tr class="${secili?'secili':''}" onclick="rtSec('isleyen','${escJs(g.anahtar)}','${escJs(g.anahtar)}')"><td><span class="mono">${esc(g.anahtar)}</span>${g.ad?` <span class="rt-silik">${esc(g.ad)}</span>`:''}</td><td class="r mono">${rtFmt(g.op)}</td><td class="r mono">${(g.netMs/3.6e6).toFixed(1).replace('.',',')}</td><td class="r mono rt-dar-gizle">${rtDk(g.netMs/60000/Math.max(1,g.op))}</td></tr>`; }).join('')}
      </tbody></table>` : `<div class="rt-bos">Bu dönemde işlenen talep yok.</div>`}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>İşlem türü</h4><span>açıklamadan tahmin · parça</span></div>
      ${rtCubukListe('tur', rtGrupla(liste, RT_KIRILIM.tur), { renk:'var(--tadilat-info)' })}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Tekrar tadilata gelen kodlar</h4><span>${kodFarkli} farklı koddan ${gercekKod.length} tanesi birden fazla kez</span></div>
      ${gercekKod.length ? `<table class="rt-tablo"><thead><tr><th>Kod</th><th class="rt-dar-gizle">Malzeme</th><th class="r">Talep</th><th class="r">Parça</th></tr></thead><tbody>
        ${gercekKod.slice(0,10).map(g=>{ const secili = rtSecim && rtSecim.tur==='kod' && rtSecim.anahtar===g.anahtar; const ad = (getTalepInfo(g.anahtar)||{}).malzemeAdi || (typeof malzemeListesi!=='undefined' && malzemeListesi ? malzemeListesi[g.anahtar] : '') || '';
          return `<tr class="${secili?'secili':''}" onclick="rtSec('kod','${escJs(g.anahtar)}','${escJs(g.anahtar)}')"><td class="mono">${esc(g.anahtar)}</td><td class="rt-silik rt-kes rt-dar-gizle">${esc(ad)}</td><td class="r mono">${g.talep}</td><td class="r mono">${rtFmt(g.parca)}</td></tr>`; }).join('')}
      </tbody></table>` : `<div class="rt-bos">Bu dönemde tekrar gelen kod yok.</div>`}
      ${kodsuz ? `<button type="button" class="rt-alt-link" onclick="rtSec('kod','__kodsuz','Kodsuz parça')">Kodsuz parça: ${kodsuz.talep} talep · ${rtFmt(kodsuz.parca)} parça (kod yerine parça adı yazılmış) →</button>` : ''}
    </div>
    <div class="rt-kutu">
      <div class="rt-kutu-bas"><h4>Talep eden kişi</h4><span>parça</span></div>
      ${rtCubukListe('kisi', rtGrupla(liste, RT_KIRILIM.kisi), { adet:8 })}
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
    ${!rtSecim ? `<div class="rt-dip" style="margin:-4px 0 8px">Yukarıdaki bir satıra dokununca liste ona göre süzülür.</div>` : ''}
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
  </div>` : ''}`;
}

/* Verimlilik & Duruş bölümünün açılış cümlesi — render-admin'deki eski blok hesaplıyor, burası anlatıyor. */
function analizVerimlilikYorum(t, pareto, makineSira){
  if(!t || !t.availMin) return agYorum(['Bu dönemde makine çalışma kaydı yok.']);
  const c = [
    `Kullanılabilir süre <b>${agSaat(t.availMin)}</b>, çalışılan süre <b>${agSaat(t.workMin)}</b>: verimlilik <b>%${t.verimlilik}</b>.`,
    t.durusMin ? `Toplam duruş <b>${agSaat(t.durusMin)}</b>${pareto && pareto[0] ? `; en büyük neden <b>${esc(pareto[0].neden)}</b>, duruşların ${agYuzde(pareto[0].pct)} kadarı` : ''}.` : '',
    /* Hiç çalışmamış (%0) makine "en düşük" sayılmaz — kullanılmamış demek, verimsiz değil. */
    (()=>{ const k = (makineSira||[]).filter(m=>m.verimlilik>0); return k.length>1 ? `En verimli makine <b>${esc(k[0].code)}</b> (%${k[0].verimlilik}), en düşük <b>${esc(k[k.length-1].code)}</b> (%${k[k.length-1].verimlilik}).` : ''; })(),
  ];
  /* "Tadilat" nedenli duruş üretim açısından duruş ama atölye açısından kayıp değil: operatör o
     sürede tadilat işindeydi (o iş çalışma süresine ayrıca giriyor). Bunu söylemezsek pareto
     "Tadilat"ı kayıp gibi gösteriyor. */
  /* Rakam bilerek yok: pareto kaydın tüm duruşlarını sayıyor (dönem dışı ve tadilat içi dahil),
     İmalat ve tadilat bölümü yalnız dönemde başlayan üretim duruşlarını — iki farklı rakam çıkmasın. */
  if((pareto||[]).some(p=>isTadilatReason(p.neden))) c.push(`Listedeki "Tadilat" duruşu kayıp değil: o sürede operatör araya alınan tadilat işindeydi ve o iş çalışma süresinde sayılıyor; ayrıntısı İmalat ve tadilat bölümünde.`);
  return agYorum(c);
}

/* ---------- TADİLAT ATÖLYESİ GÖRÜNÜMÜ (05.10.2026) ----------
   Atölye filtresi "Tadilat" iken Üretim bölümü boş kalıyordu (tadilat atölyesinde iş emri
   bitmiyor) ve Özet "biten iş emri yok" diye açılıyordu — kullanıcı: "saçma durmuyor mu, sadece
   tadilat seçilince farklı bir analiz gelsin". Bu kipte sıra: Özet (tadilat) → Tadilat →
   Tadilat personeli → Verimlilik & Duruş (yalnız tadilat makineleri) → Açık işler. */
function analizBolumlerHtml(){
  return analizAtolyeFilter==='tadilat'
    ? analizTadilatHtml() + analizTadilatPersonelHtml()
    : analizUretimHtml() + analizKaliteHtml() + analizTadilatHtml();
}
function analizOzetTadilatHtml(t){
  const a = rtAralik(), on = rtOncekiAralik(a), onAd = rtOncekiAd(a,on);
  const liste = rtKayitlar(a.bas, a.son), onceki = rtKayitlar(on.bas, on.son);
  const oz = rtOzet(liste), ozOn = rtOzet(onceki);
  const kapali = liste.filter(x=>tadilatTamamlandiMi(x)).length, kapaliOn = onceki.filter(x=>tadilatTamamlandiMi(x)).length;
  let tOn = null;
  if(!agSaatKiyasYok()) try{ tOn = agVeri(dateKey(on.bas), dateKey(Math.max(on.bas, on.son-1)), 'tadilat').totals; }catch(e){ tOn = null; }
  const cumleler = [
    oz.talep ? `Tadilat atölyesine bu dönemde <b>${rtFmt(oz.talep)} talep</b> ile <b>${rtFmt(oz.parca)} parça</b> geldi; tamamlanan talep <b>${rtFmt(kapali)}</b>.` : 'Bu dönemde tadilat atölyesine talep gelmedi.',
    (t && t.availMin>0) ? `Tadilat makinelerinin verimliliği <b>%${t.verimlilik}</b>${tOn && tOn.availMin>0 ? ` (${esc(onAd)}: %${tOn.verimlilik})` : ''}.` : '',
  ];
  return `${agBolumBas('ag-ozet','Özet', esc(a.etiket)+' · tadilat atölyesi')}
  ${agYorum(cumleler)}
  <div class="rt-kpiler ag-kpi-buyuk">
    ${rtKpi('Gelen talep', rtFmt(oz.talep), rtFark(oz.talep, ozOn.talep, { onAd }))}
    ${rtKpi('Tadilat parça', rtFmt(oz.parca), rtFark(oz.parca, ozOn.parca, { onAd }))}
    ${rtKpi('Tamamlanan talep', rtFmt(kapali), rtFark(kapali, kapaliOn, { iyi:'artis', onAd }), oz.talep ? `gelenlerin ${agYuzde(kapali/oz.talep*100)} kadarı` : '')}
  </div>`;
}
/* Tadilat personeli (05.10.2026, kullanıcı isteği): "hangi personel kaç adet tadilat yapmış, hangi
   makinede çalışmış, günlük kaç dakika çalışmış". Burada OPERASYONUN YAPILDIĞI GÜN esas (talebin
   açıldığı gün değil) — günlük çalışma süresi ancak böyle doğru çıkar. Süre = net (duruş ve Gün
   Sonu hariç); devam eden operasyon şu ana kadar sayılır; birden fazla güne yayılan operasyon
   başladığı güne yazılır. Yalnızca tadilat operasyonları — aynı kişinin üretim işleri burada yok. */
let agKisi = null; // seçili personel (operatorUsername)
function agKisiSec(u){
  agKisi = (agKisi===u) ? null : u;
  render();
  if(agKisi) rtKaydir('ag-kisi-detay');
}
function agPersonelOperasyonlari(a){
  const L = [];
  tadilatArray().forEach(t=>{
    if(t.testKaydi) return;
    if(analizAtolyeFilter!=='tumu' && (t.atolye||'imalat')!==analizAtolyeFilter) return;
    tadilatOperasyonlarArray(t).forEach(o=>{
      if(!o.operatorUsername || !o.baslamaTs || o.baslamaTs<a.bas || o.baslamaTs>=a.son) return;
      const mk = String(o.makine||'').split(' · ');
      L.push({ t, o, u:o.operatorUsername, ad:o.operatorName||o.operatorUsername, gun: dateKey(o.baslamaTs),
        makine: mk[0]||'—', makineAd: mk[1]||'', dk: (tadilatOpDurationBreakdown(o).netMs||0)/60000, devam: !o.bitisTs });
    });
  });
  return L;
}
function agKisiOzetleri(ops){
  const m = {};
  ops.forEach(x=>{
    const g = m[x.u] || (m[x.u] = { u:x.u, ad:x.ad, op:0, dk:0, talepler:new Set(), parca:0, gunler:{}, makine:{} });
    g.op += 1; g.dk += x.dk;
    if(!g.talepler.has(x.t.id)){ g.talepler.add(x.t.id); g.parca += rtSayi(x.t.adet); }
    const gn = g.gunler[x.gun] || (g.gunler[x.gun] = { dk:0, op:0, talepler:new Set(), parca:0, makine:{} });
    gn.dk += x.dk; gn.op += 1;
    if(!gn.talepler.has(x.t.id)){ gn.talepler.add(x.t.id); gn.parca += rtSayi(x.t.adet); }
    gn.makine[x.makine] = (gn.makine[x.makine]||0) + x.dk;
    const mk = g.makine[x.makine] || (g.makine[x.makine] = { kod:x.makine, ad:x.makineAd, op:0, dk:0, talepler:new Set(), parca:0 });
    mk.op += 1; mk.dk += x.dk;
    if(!mk.talepler.has(x.t.id)){ mk.talepler.add(x.t.id); mk.parca += rtSayi(x.t.adet); }
  });
  return Object.values(m).map(g=>({ ...g, talep:g.talepler.size, gunSay:Object.keys(g.gunler).length,
    makineL: Object.values(g.makine).sort((x,y)=>y.dk-x.dk) })).sort((x,y)=>y.talep-x.talep || y.dk-x.dk);
}
function agDkYaz(dk){ return dk>=600 ? rtFmt(dk/60)+' sa' : rtFmt(dk)+' dk'; }

function analizTadilatPersonelHtml(){
  const a = rtAralik();
  const ops = agPersonelOperasyonlari(a);
  const L = agKisiOzetleri(ops);
  const mesai = (typeof WORKDAY_MINUTES!=='undefined' ? WORKDAY_MINUTES : 540);
  if(agKisi && !L.some(g=>g.u===agKisi)) agKisi = null;
  if(!L.length) return `${agBolumBas('ag-personel','Tadilat personeli','')}${agYorum(['Bu dönemde tadilat operasyonu yok.'])}`;

  const toplamTalep = new Set(ops.map(x=>x.t.id)).size;
  const toplamDk = L.reduce((s,g)=>s+g.dk,0);
  const kisiGun = L.reduce((s,g)=>s+g.gunSay,0) || 1;
  const ilk = L[0];
  const cumleler = [
    `Bu dönemde <b>${L.length} kişi</b> tadilat operasyonu yaptı: <b>${rtFmt(toplamTalep)} tadilat</b>, <b>${rtFmt(ops.length)} operasyon</b>, toplam <b>${agDkYaz(toplamDk)}</b> net çalışma.`,
    `Çalışılan günlerde kişi başına günlük ortalama <b>${rtFmt(toplamDk/kisiGun)} dk</b> (mesai ${mesai} dk).`,
    ilk ? `En çok tadilatı <b>${esc(ilk.ad)}</b> yaptı: ${rtFmt(ilk.talep)} tadilat, ${rtFmt(ilk.parca)} parça.` : '',
    (()=>{ const n = L.reduce((s,g)=>s+Object.values(g.gunler).filter(gn=>gn.dk>660).length,0);
      return n ? `<span class="ag-uyari-metin">Dikkat: ${n} kişi-günde süre 11 saati aşıyor (tabloda kırmızı çerçeveli) — operasyon akşam kapatılmamış olabilir, o günlerin süresi şişkin.</span>` : ''; })(),
  ];

  /* 1) Kişi özeti */
  const ozet = `<div class="rt-kutu">
    <div class="rt-kutu-bas"><h4>Kim ne kadar tadilat yaptı</h4><span>satıra dokun: makine ve gün dökümü</span></div>
    <div class="table-wrap"><table class="rt-tablo ag-personel-tablo"><thead><tr>
      <th>Personel</th><th class="r">Tadilat</th><th class="r">Parça</th><th class="r">Operasyon</th><th class="r">Toplam süre</th><th class="r">Çalıştığı gün</th><th class="r">Günlük ort.</th><th>Çalıştığı makineler</th></tr></thead><tbody>
    ${L.map(g=>{ const secili = agKisi===g.u;
      return `<tr class="${secili?'secili':''}" onclick="agKisiSec('${escJs(g.u)}')" title="${esc(g.ad)} · makine ve gün dökümü">
        <td><b>${esc(g.ad)}</b></td>
        <td class="r"><span class="ag-oran" style="--p:${(g.talep/L[0].talep*100).toFixed(1)}%"></span><span class="mono">${rtFmt(g.talep)}</span></td>
        <td class="r mono">${rtFmt(g.parca)}</td>
        <td class="r mono">${rtFmt(g.op)}</td>
        <td class="r mono">${agDkYaz(g.dk)}</td>
        <td class="r mono">${g.gunSay}</td>
        <td class="r mono">${rtFmt(g.dk/Math.max(1,g.gunSay))} dk</td>
        <td><div class="ag-makine-cipler">${g.makineL.slice(0,4).map(m=>`<span class="ag-mcip"><b class="mono">${esc(m.kod)}</b> ${agDkYaz(m.dk)}</span>`).join('')}${g.makineL.length>4?`<span class="rt-silik">+${g.makineL.length-4}</span>`:''}</div></td>
      </tr>`; }).join('')}
    </tbody></table></div>
    <div class="rt-dip">Tadilat: kişinin çalıştığı farklı talep sayısı. Bir talepte iki kişi çalıştıysa ikisine de sayılır. Süreler net (duruş ve Gün Sonu hariç).</div>
  </div>`;

  /* 2) Günlük çalışma tablosu — ≤62 gün günlük, daha uzunu haftalık. */
  const bitis = Math.min(a.son, Date.now()+1);
  /* Tablo dönemin başından değil ilk kayıttan başlar — "Bu yıl"da Ocak–Temmuz boş sütun olmasın. */
  const ilkTs = Math.max(a.bas, rtGun(Math.min(...ops.map(x=>x.o.baslamaTs))));
  const gunSay = Math.ceil((bitis - ilkTs)/86400000);
  const haftalik = gunSay > 62;
  const sutunlar = [];
  if(haftalik){
    let k = rtGun(ilkTs); k -= ((new Date(k).getDay()+6)%7)*86400000;
    for(; k<bitis; k = rtGun(k+7*86400000+3600000)) sutunlar.push({ bas:k, son:rtGun(k+7*86400000+3600000), et:`${new Date(k).getDate()} ${RT_AY_KISA[new Date(k).getMonth()]}`, hs:false });
  } else {
    for(let k=rtGun(ilkTs); k<bitis; k=rtGun(k+36*3600000)){ const d=new Date(k); sutunlar.push({ bas:k, son:rtGun(k+36*3600000), et:String(d.getDate()), alt:['Pz','Pt','Sa','Ça','Pe','Cu','Ct'][d.getDay()], hs:[0,6].includes(d.getDay()), anahtar:dateKey(k) }); }
  }
  const hucreDeger = (g, s)=>{
    if(!haftalik){ const gn = g.gunler[s.anahtar]; return gn ? { dk:gn.dk, op:gn.op, talep:gn.talepler.size, makine:gn.makine } : null; }
    let dk=0, op=0, talep=0; const makine={};
    Object.entries(g.gunler).forEach(([gk,gn])=>{ const ts = rtTarihOku(gk); if(ts>=s.bas && ts<s.son){ dk+=gn.dk; op+=gn.op; talep+=gn.talepler.size; Object.entries(gn.makine).forEach(([mk,v])=>makine[mk]=(makine[mk]||0)+v); } });
    return op ? { dk, op, talep, makine } : null;
  };
  const kapasite = haftalik ? mesai*5 : mesai;
  const gunTablo = `<div class="rt-kutu">
    <div class="rt-kutu-bas"><h4>${haftalik?'Haftalık':'Günlük'} çalışma (dakika)</h4><span>net tadilat süresi · renk koyulaştıkça mesaiye (${kapasite} dk${haftalik?'/hafta':''}) yaklaşıyor · hücreye gel: ayrıntı</span></div>
    <div class="table-wrap"><table class="rt-tablo ag-gun-tablo"><thead><tr><th class="ag-gun-ad">Personel</th>${sutunlar.map(s=>`<th class="r ${s.hs?'ag-hs':''}">${s.et}${s.alt?`<small>${s.alt}</small>`:''}</th>`).join('')}<th class="r">Toplam</th></tr></thead><tbody>
    ${L.map(g=>`<tr class="${agKisi===g.u?'secili':''}" onclick="agKisiSec('${escJs(g.u)}')"><td class="ag-gun-ad"><b>${esc(g.ad)}</b></td>${sutunlar.map(s=>{
        const h = hucreDeger(g, s);
        if(!h) return `<td class="r ag-bos-h ${s.hs?'ag-hs':''}">·</td>`;
        const oran = Math.min(1, h.dk/kapasite);
        /* Mesainin çok üstü (günde 11 saatten uzun): büyük ihtimalle akşam kapatılmayıp ertesi güne
           açık kalmış operasyon — başladığı güne yazılıyor. İşaretli ki rakama güvenilmesin. */
        const suphe = !haftalik && h.dk > 660;
        const mk = Object.entries(h.makine).sort((x,y)=>y[1]-x[1]).map(([k,v])=>`${k} ${rtFmt(v)} dk`).join(', ');
        return `<td class="r mono ag-h ${s.hs?'ag-hs':''} ${suphe?'ag-suphe':''}" style="--o:${(8+oran*62).toFixed(0)}%" title="${esc(g.ad)} · ${haftalik?'hafta '+s.et:s.et+' '+RT_AY[new Date(s.bas).getMonth()]} · ${rtFmt(h.dk)} dk · ${h.op} operasyon, ${h.talep} tadilat · ${esc(mk)}${suphe?' · MESAİDEN ÇOK UZUN: operasyon gece açık kalmış olabilir':''}">${rtFmt(h.dk)}</td>`;
      }).join('')}<td class="r mono"><b>${rtFmt(g.dk)}</b></td></tr>`).join('')}
    <tr class="ag-toplam rt-tablo-sabit"><td class="ag-gun-ad">Toplam</td>${sutunlar.map(s=>{ const t = L.reduce((x,g)=>x+((hucreDeger(g,s)||{}).dk||0),0); return `<td class="r mono ${s.hs?'ag-hs':''}">${t?rtFmt(t):''}</td>`; }).join('')}<td class="r mono">${rtFmt(toplamDk)}</td></tr>
    </tbody></table></div>
  </div>`;

  /* 3) Seçili kişinin dökümü: makine makine ve gün gün. */
  const g = agKisi ? L.find(x=>x.u===agKisi) : null;
  const detay = g ? `<div class="rt-kutu ag-kisi-detay" id="ag-kisi-detay">
    <div class="rt-liste-bas"><div><h4>${esc(g.ad)}</h4><span>${rtFmt(g.talep)} tadilat · ${rtFmt(g.parca)} parça · ${rtFmt(g.op)} operasyon · ${agDkYaz(g.dk)} · ${g.gunSay} gün</span></div>
      <button type="button" class="btn-ghost" style="width:auto;padding:7px 12px" onclick="agKisiSec('${escJs(g.u)}')">${ico('x',13)} Kapat</button></div>
    <div class="rt-izgara">
      <div><div class="ag-alt-baslik">Makine makine</div>
        <table class="rt-tablo"><thead><tr><th>Makine</th><th class="r">Tadilat</th><th class="r">Parça</th><th class="r">Operasyon</th><th class="r">Süre</th><th class="r">Pay</th></tr></thead><tbody>
        ${g.makineL.map(m=>`<tr class="rt-tablo-sabit"><td><span class="mono">${esc(m.kod)}</span>${m.ad?` <span class="rt-silik">${esc(m.ad)}</span>`:''}</td><td class="r mono">${m.talepler.size}</td><td class="r mono">${rtFmt(m.parca)}</td><td class="r mono">${m.op}</td><td class="r mono">${agDkYaz(m.dk)}</td><td class="r mono">${agYuzde(m.dk/Math.max(1,g.dk)*100)}</td></tr>`).join('')}
        </tbody></table></div>
      <div><div class="ag-alt-baslik">Gün gün</div>
        <div class="ag-kisi-gunler"><table class="rt-tablo"><thead><tr><th>Gün</th><th class="r">Tadilat</th><th class="r">Parça</th><th class="r">Süre</th><th>Makineler</th></tr></thead><tbody>
        ${Object.entries(g.gunler).sort((x,y)=>y[0].localeCompare(x[0])).map(([gk,gn])=>{ const d = new Date(rtTarihOku(gk));
          return `<tr class="rt-tablo-sabit"><td class="mono" style="white-space:nowrap">${rtTarihYaz(rtTarihOku(gk))} <span class="rt-silik">${['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][d.getDay()]}</span></td><td class="r mono">${gn.talepler.size}</td><td class="r mono">${rtFmt(gn.parca)}</td><td class="r mono">${rtFmt(gn.dk)} dk</td><td class="mono rt-silik">${Object.entries(gn.makine).sort((x,y)=>y[1]-x[1]).map(([k,v])=>`${esc(k)} ${rtFmt(v)}`).join(' · ')}</td></tr>`; }).join('')}
        </tbody></table></div></div>
    </div>
    <div style="margin-top:10px"><button type="button" class="btn-ghost" style="width:auto;padding:7px 12px" onclick="rtSec('personel','${escJs(g.u)}','${escJs(g.ad)}')">Bu kişinin tadilat taleplerini listele →</button></div>
  </div>` : '';

  return `${agBolumBas('ag-personel','Tadilat personeli','operasyonun yapıldığı güne göre')}
  ${agYorum(cumleler)}
  ${ozet}
  ${detay}
  ${gunTablo}`;
}

/* ---------- ÖNBELLEK: dönem × atölye analiz verisi ----------
   computeAnalizData tek slotlu önbellek tutuyor; Genel sayfa aynı render'da hem seçili dönemi hem
   önceki dönemi (hem de İmalat/Tadilat bölümü için "tüm atölyeler"i) istediği için slot her
   render'da takla atıp hesabı baştan yaptırıyordu. Burada birkaç sonucu dakika kovasıyla tutuyoruz
   (computeAnalizData'nın kendi anahtarıyla aynı mantık; veri referansı değişince düşer). */
/* Saat bazlı ölçüler (verimlilik, imalat/tadilat saati) computeAnalizData'dan TAM GÜN olarak
   geliyor; "Bugün"de dünün tamamı bugünün şu ana kadarıyla kıyaslanır ve sabah her şey düşüş
   görünürdü. Bu yüzden "Bugün"de bu ölçülerin önceki dönem kıyası gösterilmiyor (sayımlar —
   iş emri, talep — saatine kadar kıyaslandığı için onlar kalıyor). */
function agSaatKiyasYok(){ return rtDonem==='bugun'; }
let _agVeriOnbellek = [];
function agVeri(bas, son, atolye){
  const k = bas+'|'+son+'|'+(atolye||'tumu')+'|'+Math.floor(nowTick/60000);
  const c = _agVeriOnbellek.find(x=>x.k===k && x.e===STATE.entries && x.t===tadilatlar);
  if(c) return c.d;
  const d = computeAnalizData(bas, son, atolye);
  _agVeriOnbellek = [{ k, e:STATE.entries, t:tadilatlar, d }, ..._agVeriOnbellek].slice(0, 6);
  return d;
}

/* ---------- İMALAT VE TADİLAT (05.10.2026, kullanıcı isteği) ----------
   "Atölyede imal edilen ürünler var (birden fazla prosese girip ürün çıkaranlar), ayrıca gün içinde
   aciliyetten oluşan tadilat işleri var; imalat atölyede bunlar da araya alınıp yapılıyor —
   analiz ekranında imalat ve tadilat AYRILMALI." Atölye filtresi MAKİNENİN atölyesine bakıyor;
   iş türü ise ayrı bir eksen: imalat atölyesindeki bir makine gün içinde hem iş emri hem tadilat
   işler. Bu bölüm ikisini her iki atölye için yan yana koyar; bu yüzden atölye filtresinden
   bağımsız olarak her iki atölyeyi de gösterir, seçili atölyenin satırı vurgulanır.
   Süreler Verimlilik bölümüyle aynı hesaptan (computeAnalizData) gelir: net çalışma, duruş ve
   Gün Sonu hariç; "Tadilat için durdurma" = üretim kaydının "Tadilat" nedenli duruşları,
   "Dönüş ayarı" = tadilattan dönünce otomatik başlayan "Tadilat Sonrası Ayar" duruşları. */
let agAyrimSecim = null; // ayrıntılarda seçili makine kodu (yalnız vurgu için)
function agAyrimTopla(d){
  const at = { imalat:{ ima:0, tad:0 }, tadilat:{ ima:0, tad:0 } };
  const mak = {};
  d.perMachine.forEach(m=>{
    const a = machineAtolyeOf(m.code);
    at[a].ima += m.workImalatMin||0; at[a].tad += m.workTadilatMin||0;
    mak[m.code] = { code:m.code, name:m.name, atolye:a, ima:m.workImalatMin||0, tad:m.workTadilatMin||0, durN:0, durMs:0, ayarN:0, ayarMs:0 };
  });
  const bas = new Date(d.fromDate+'T00:00:00').getTime(), son = new Date(d.toDate+'T00:00:00').getTime()+86400000;
  const ev = collectDurusEvents(d.perMachine.flatMap(m=>m.entries).filter(e=>!e._isTadilat))
    .filter(x=>Number.isFinite(x.sureMs) && x.sureMs>0 && x.ts>=bas && x.ts<son);
  const kisiDur = {};
  let durN=0, durMs=0, ayarN=0, ayarMs=0;
  ev.forEach(x=>{
    const durdurma = isTadilatReason(x.neden), ayar = x.neden===TADILAT_SONRASI_REASON;
    if(!durdurma && !ayar) return;
    const m = mak[String(x.entry.makine||'').split(' · ')[0]];
    if(durdurma){ durN++; durMs+=x.sureMs; if(m){ m.durN++; m.durMs+=x.sureMs; } const u=x.entry.operatorUsername; if(u) kisiDur[u]=(kisiDur[u]||0)+1; }
    else { ayarN++; ayarMs+=x.sureMs; if(m){ m.ayarN++; m.ayarMs+=x.sureMs; } }
  });
  const ima = at.imalat.ima + at.tadilat.ima, tad = at.imalat.tad + at.tadilat.tad;
  return { at, ima, tad, toplam: ima+tad, durN, durMs, ayarN, ayarMs, mak: Object.values(mak), kisiDur };
}
function agSaatKisa(dk){ if(dk>0 && dk<1) return '<1 dk'; return dk>=600 ? rtFmt(dk/60)+' sa' : dk>=60 ? (dk/60).toFixed(1).replace('.',',')+' sa' : rtFmt(dk)+' dk'; }
function agIkiliCubuk(ima, tad){
  const t = ima+tad; if(!t) return '<span class="rt-silik">—</span>';
  return `<span class="ag-ikili" title="imalat ${agSaatKisa(ima)} · tadilat ${agSaatKisa(tad)}"><span class="ima" style="width:${(ima/t*100).toFixed(1)}%"></span><span class="tad" style="width:${(tad/t*100).toFixed(1)}%"></span></span>`;
}
function analizAyrimHtml(){
  const a = rtAralik(), on = rtOncekiAralik(a), onAd = rtOncekiAd(a,on);
  let d, dOn = null;
  try{ d = agVeri(analizFrom, analizTo, 'tumu'); }catch(e){ return ''; }
  if(!agSaatKiyasYok()) try{ dOn = agVeri(dateKey(on.bas), dateKey(Math.max(on.bas, on.son-1)), 'tumu'); }catch(e){ dOn = null; }
  const x = agAyrimTopla(d), xOn = dOn ? agAyrimTopla(dOn) : null;
  const fAt = analizAtolyeFilter;
  const sa = dk => dk/60; // KPI ve farklar saat cinsinden
  const saYaz = v => rtFmt(v)+' sa';
  const tadPay = x.toplam ? x.tad/x.toplam*100 : 0;
  const arayaPay = x.tad ? x.at.imalat.tad/x.tad*100 : 0;
  const imaAtToplam = x.at.imalat.ima + x.at.imalat.tad;
  const enCok = x.mak.filter(m=>m.atolye==='imalat' && m.tad>0).sort((p,q)=>q.tad-p.tad)[0];
  const cumleler = x.toplam ? [
    `Bu dönemde makinelerde <b>${agSaat(x.toplam)}</b> iş yapıldı: imalat (iş emri) <b>${agSaat(x.ima)}</b>, tadilat <b>${agSaat(x.tad)}</b>; tadilat payı <b>${agYuzde(tadPay)}</b>.`,
    x.at.imalat.tad>0 ? `Tadilat işinin <b>${agSaat(x.at.imalat.tad)}</b> kadarı imalat atölyesinde, üretimin arasına alınarak yapıldı (tadilatın ${agYuzde(arayaPay)} kadarı); imalat atölyesinin zamanında tadilat payı <b>${agYuzde(imaAtToplam ? x.at.imalat.tad/imaAtToplam*100 : 0)}</b>.` : 'İmalat atölyesinde bu dönemde araya tadilat alınmadı.',
    x.durN>0 ? `Üretim <b>${rtFmt(x.durN)} kez</b> tadilat için durduruldu, bu duruşlar toplam <b>${agSaat(x.durMs/60000)}</b> sürdü${x.ayarN>0 ? `; tadilattan dönünce ${rtFmt(x.ayarN)} kez yeniden ayar yapıldı, toplam <b>${agSaat(x.ayarMs/60000)}</b>` : ''}.` : '',
    enCok ? `En çok araya tadilat alınan makine <b>${esc(enCok.code)}</b>: ${agSaat(enCok.tad)} tadilat${enCok.durN ? `, üretim ${rtFmt(enCok.durN)} kez durdu` : ''}.` : '',
  ] : ['Bu dönemde makine çalışma kaydı yok.'];

  /* Gün gün (uzun dönemde hafta/ay) imalat ve tadilat saati, yığılmış. */
  const gun = {};
  d.perMachine.forEach(m=>Object.entries(m.gunluk||{}).forEach(([dk,g])=>{ const o = gun[dk] || (gun[dk]={ ima:0, tad:0 }); o.ima += g.workMin-g.tadMin; o.tad += g.tadMin; }));
  const seriListe = Object.entries(gun).map(([dk,g])=>({ ts: rtTarihOku(dk), ...g }));
  const seri = rtZamanSerisi(seriListe, a, z=>z.ts, [
    { ad:'imalat (saat)', sinif:'ag-s-ima', fn:z=>z.ima/60 },
    { ad:'tadilat (saat)', sinif:'ag-s-tad', fn:z=>z.tad/60 }]);

  const atSatir = (k, ad) => { const r = x.at[k], t = r.ima+r.tad;
    return `<tr class="rt-tablo-sabit ${fAt===k?'secili':''}"><td><b>${ad}</b></td><td class="r mono">${r.ima?agSaatKisa(r.ima):'—'}</td><td class="r mono">${r.tad?agSaatKisa(r.tad):'—'}</td><td class="r mono">${t?agYuzde(r.tad/t*100):'—'}</td><td class="ag-ikili-hucre">${agIkiliCubuk(r.ima, r.tad)}</td></tr>`; };

  const makL = x.mak.filter(m=>m.ima+m.tad>0 || m.durN || m.ayarN).sort((p,q)=>(p.atolye===q.atolye?0:p.atolye==='imalat'?-1:1) || q.tad-p.tad || q.ima-p.ima);
  const kisiL = (d.perOperator||[]).filter(o=>o.workMin>0 && o.operatorUsername).map(o=>({ u:o.operatorUsername, ad:o.operatorName||o.operatorUsername, tad:Math.min(o.workMin, o.workTadilatMin||0), ima:o.workMin-Math.min(o.workMin, o.workTadilatMin||0), dur:x.kisiDur[o.operatorUsername]||0 }))
    .sort((p,q)=>(q.ima+q.tad)-(p.ima+p.tad));
  const ikiIs = kisiL.filter(k=>k.ima>0 && k.tad>0).length;

  return `${agBolumBas('ag-ayrim','İmalat ve tadilat','makine zamanı iş türüne göre · her iki atölye')}
  ${agYorum(cumleler)}
  <div class="rt-kpiler">
    ${rtKpi('İmalat işi', saYaz(sa(x.ima)), xOn ? rtFark(sa(x.ima), sa(xOn.ima), { iyi:'artis', onAd, bicim:saYaz }) : '', 'iş emri, net çalışma')}
    ${rtKpi('Tadilat işi', saYaz(sa(x.tad)), xOn ? rtFark(sa(x.tad), sa(xOn.tad), { onAd, bicim:saYaz }) : '', x.tad ? `${agSaatKisa(x.at.imalat.tad)} imalat atölyesinde` : '')}
    ${rtKpi('Tadilat için durdurma', rtFmt(x.durN)+' kez', xOn ? rtFark(x.durN, xOn.durN, { iyi:'azalis', onAd }) : '', x.durN ? `toplam ${agSaatKisa(x.durMs/60000)}${x.ayarN?` · dönüş ayarı ${agSaatKisa(x.ayarMs/60000)}`:''}` : 'üretim tadilat için durmadı')}
  </div>
  <div class="rt-izgara">
    <div class="rt-kutu rt-genis">
      <div class="rt-kutu-bas"><h4>İmalat ve tadilat saati</h4><span>${seri.kip==='gun'?'gün gün · hafta sonu soluk':seri.kip==='hafta'?'hafta hafta':'ay ay'} · net çalışma</span></div>
      ${seriListe.length && seri.kovalar.length>1 ? rtSeriSvg(seri, 'Dönem içinde imalat ve tadilat çalışma saati', 'saat') : `<div class="rt-bos">${seriListe.length ? 'Tek günlük dönemde grafik yok; tabloya bak.' : 'Bu dönemde çalışma kaydı yok.'}</div>`}
      <div class="rt-lejant"><span><i class="ag-s-ima-i"></i>İmalat (iş emri)</span><span><i class="ag-s-tad-i"></i>Tadilat</span></div>
    </div>
    <div class="rt-kutu rt-genis">
      <div class="rt-kutu-bas"><h4>Atölyeye göre</h4><span>atölye = makinenin atölyesi · iş türü = yapılan iş</span></div>
      <div class="table-wrap"><table class="rt-tablo ag-ayrim-tablo"><thead><tr><th>Atölye</th><th class="r">İmalat işi</th><th class="r">Tadilat işi</th><th class="r">Tadilat payı</th><th class="rt-dar-gizle"></th></tr></thead><tbody>
        ${atSatir('imalat','İmalat atölyesi')}${atSatir('tadilat','Tadilat atölyesi')}
        <tr class="rt-tablo-sabit ag-toplam"><td>Toplam</td><td class="r mono">${agSaatKisa(x.ima)}</td><td class="r mono">${agSaatKisa(x.tad)}</td><td class="r mono">${x.toplam?agYuzde(tadPay):'—'}</td><td class="ag-ikili-hucre">${agIkiliCubuk(x.ima, x.tad)}</td></tr>
      </tbody></table></div>
    </div>
  </div>
  ${agDetayDugme('ayrim', 'Ayrıntılar: makine makine ve kişi kişi imalat / tadilat, tadilat için durdurmalar')}
  ${agDetay.ayrim ? `
  <div class="rt-izgara" style="margin-top:12px">
    <div class="rt-kutu rt-genis">
      <div class="rt-kutu-bas"><h4>Makine makine</h4><span>önce imalat atölyesi · tadilat süresine göre</span></div>
      <div class="table-wrap"><table class="rt-tablo ag-ayrim-tablo"><thead><tr><th>Makine</th><th class="r">İmalat işi</th><th class="r">Tadilat işi</th><th class="r">Tadilat payı</th><th class="r">Tadilat için durdurma</th><th class="r rt-dar-gizle">Dönüş ayarı</th><th class="rt-dar-gizle"></th></tr></thead><tbody>
        ${makL.map(m=>{ const t=m.ima+m.tad; return `<tr class="rt-tablo-sabit">
          <td><b class="mono">${esc(m.code)}</b>${m.name?` <span class="rt-silik">${esc(m.name)}</span>`:''}${m.atolye==='tadilat'?` <span class="ag-etiket">tadilat atölyesi</span>`:''}</td>
          <td class="r mono">${m.ima?agSaatKisa(m.ima):'—'}</td>
          <td class="r mono">${m.tad?agSaatKisa(m.tad):'—'}</td>
          <td class="r mono">${t?agYuzde(m.tad/t*100):'—'}</td>
          <td class="r mono">${m.durN?`${rtFmt(m.durN)} kez <span class="rt-silik">· ${agSaatKisa(m.durMs/60000)}</span>`:'—'}</td>
          <td class="r mono rt-dar-gizle">${m.ayarN?`${rtFmt(m.ayarN)} kez <span class="rt-silik">· ${agSaatKisa(m.ayarMs/60000)}</span>`:'—'}</td>
          <td class="ag-ikili-hucre rt-dar-gizle">${agIkiliCubuk(m.ima, m.tad)}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="rt-dip">"Tadilat için durdurma": dönem içinde üretim kaydının "Tadilat" nedeniyle duraklatıldığı kez ve süre. "Dönüş ayarı": tadilat bitince üretime dönerken geçen "Tadilat Sonrası Ayar" duruşu.</div>
    </div>
    <div class="rt-kutu rt-genis">
      <div class="rt-kutu-bas"><h4>Kişi kişi</h4><span>${ikiIs ? `${ikiIs} kişi iki işte de çalıştı` : 'çalışma süresine göre'}</span></div>
      ${kisiL.length ? `<div class="table-wrap"><table class="rt-tablo ag-ayrim-tablo"><thead><tr><th>Personel</th><th class="r">İmalat işi</th><th class="r">Tadilat işi</th><th class="r">Tadilat payı</th><th class="r rt-dar-gizle">Üretimi tadilata durdurdu</th><th class="rt-dar-gizle"></th></tr></thead><tbody>
        ${kisiL.map(k=>{ const t=k.ima+k.tad; return `<tr class="rt-tablo-sabit">
          <td><b>${esc(k.ad)}</b></td>
          <td class="r mono">${k.ima?agSaatKisa(k.ima):'—'}</td>
          <td class="r mono">${k.tad?agSaatKisa(k.tad):'—'}</td>
          <td class="r mono">${t?agYuzde(k.tad/t*100):'—'}</td>
          <td class="r mono rt-dar-gizle">${k.dur?rtFmt(k.dur)+' kez':'—'}</td>
          <td class="ag-ikili-hucre rt-dar-gizle">${agIkiliCubuk(k.ima, k.tad)}</td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="rt-bos">Bu dönemde kayıt yok.</div>`}
    </div>
  </div>` : ''}`;
}
/* ---------- KALİTE (FİNAL KONTROL) — 06.10.2026 ----------
   FKK'da kaydedilen adet dağılımı (entries/{id}/kalite, bkz. js/kalite.js). Dönem FKK kaydının
   bitişine göre. Sorunlu parçanın "geldiği yer" = aynı iş emrinin FKK'dan ÖNCEKİ son operasyonu.
   İlk kontrolde kabul = 1. kontrol kayıtlarında (onay + şartlı) / kontrol edilen — revizyonla dönüp
   sonradan kabul edilen parça bu orana girmez. */
function kaliteKayitlari(bas, son){ return entriesArray().filter(e=>e.kalite && e.kalite.dagilim && e.endTs>=bas && e.endTs<son); }
function kaliteOncekiOp(e){
  const ops = usGruplar()[usTabanKod(e.isEmriNo)] || [];
  const t = String(e.talepNo||'').trim();
  return ops.filter(o=>o.id!==e.id && !kaliteMakinesiMi(o.makine) && (!t || String(o.talepNo||'').trim()===t) && (o.endTs||0) <= (e.startTs||0)+60000)
    .sort((a,b)=>(b.endTs||0)-(a.endTs||0))[0] || null;
}
function kaliteOzet(liste){
  const o = { isEmri: liste.length, kontrol:0, onay:0, sartli:0, red:0, revizyon:0, kstok:0, yariMamul:0, hurda:0, bekliyor:0, ilkKontrol:0, ilkKabul:0 };
  liste.forEach(e=>{ const k = e.kalite, d = kaliteDagilim(k), K = kaliteSayi(k.kontrolAdet);
    o.kontrol += K; ['onay','sartli','red','revizyon','kstok','yariMamul','hurda','bekliyor'].forEach(x=>o[x]+=d[x]);
    if((k.kontrolNo||1)===1){ o.ilkKontrol += K; o.ilkKabul += d.onay + d.sartli; } });
  o.ilkKabulOran = o.ilkKontrol ? o.ilkKabul/o.ilkKontrol*100 : null;
  return o;
}
function kaliteCubuklar(gruplar, renk){
  if(!gruplar.length) return `<div class="rt-bos">Bu dönemde kayıt yok.</div>`;
  const max = Math.max(1, ...gruplar.map(g=>g.v));
  return `<div class="rt-cubuklar">${gruplar.slice(0,8).map(g=>`<div class="rt-cubuk" style="cursor:default">
    <span class="rt-cubuk-ad">${esc(g.ad)}</span>
    <span class="rt-cubuk-iz"><span style="width:${Math.max(1.5,g.v/max*100).toFixed(1)}%;background:${g.renk||renk}"></span></span>
    <span class="rt-cubuk-d"><b class="mono">${rtFmt(g.v)}</b><small>${g.n!=null?g.n+' kez':'parça'}</small></span></div>`).join('')}</div>`;
}
/* Hata kayıtları (FKK red/şartlı + proses içi), parça bazında; hatanın oluştuğu operasyona atfedilir. */
function hataKayitlari(bas, son){
  const l = [];
  kaliteKayitlari(bas, son).forEach(e=>{ const k = e.kalite, d = kaliteDagilim(k);
    if(d.red) l.push({ kaynak:'FKK', tur:'red', adet:d.red, hurda:d.hurda, neden:k.redNeden, hataOp:k.redHataOp, e, ts:e.endTs, aciklama:k.redAciklama||k.aciklama, k });
    if(d.sartli) l.push({ kaynak:'FKK', tur:'sartli', adet:d.sartli, hurda:0, neden:k.sartliNeden, hataOp:k.sartliHataOp, e, ts:e.endTs, aciklama:k.sartliAciklama, k }); });
  prosesUygunsuzluklari().filter(u=>u.ts>=bas && u.ts<son).forEach(u=>l.push({ kaynak:'Proses', tur:u.karar, adet:kaliteSayi(u.adet), hurda: u.karar==='hurda' ? kaliteSayi(u.adet) : 0,
    neden:u.neden, hataOp:u.hataOp, e:u._e, ts:u.ts, aciklama:u.aciklama, u }));
  return l;
}
/* Hatanın kişisi/makinesi: seçilen operasyon; seçim yoksa (eski FKK kaydı) FKK öncesi son operasyon. */
function hataKimde(h){
  if(h.hataOp && h.hataOp.belirsiz) return { makine:'belli değil', kisi:'belli değil', u:null };
  if(h.hataOp && h.hataOp.makine) return { makine:String(h.hataOp.makine).split(' · ')[0], kisi:h.hataOp.operatorName||h.hataOp.operatorUsername||'—', u:h.hataOp.operatorUsername||null };
  const p = h.kaynak==='FKK' ? kaliteOncekiOp(h.e) : null;
  return p ? { makine:String(p.makine||'').split(' · ')[0], kisi:p.operatorName||p.operatorUsername, u:p.operatorUsername } : { makine:'bilinmiyor', kisi:'bilinmiyor', u:null };
}
function duzeltmeKayitlari(bas, son){ return entriesArray().filter(e=>e.duzeltme && e.endTs>=bas && e.endTs<son); }
function analizKaliteHtml(){
  const a = rtAralik(), on = rtOncekiAralik(a), onAd = rtOncekiAd(a,on);
  const liste = kaliteKayitlari(a.bas, a.son), oz = kaliteOzet(liste), ozOn = kaliteOzet(kaliteKayitlari(on.bas, on.son));
  const hatalar = hataKayitlari(a.bas, a.son), hatalarOn = hataKayitlari(on.bas, on.son);
  const rework = duzeltmeKayitlari(a.bas, a.son);
  const reworkDk = rework.reduce((t,e)=>t+(entryDurationBreakdown(e).netMs||0)/60000, 0);
  const bas = agBolumBas('ag-kalite','Kalite','FKK + proses içi · 6 Ekim 2026\'dan itibaren kaydediliyor');
  if(!liste.length && !hatalar.length && !rework.length) return `${bas}${agYorum(['Bu dönemde kalite kaydı yok. Kayıt 6 Ekim 2026\'da başladı: FKK\'da sonuç, proses içi hatalar iş emri geçmişinden "Uygunsuzluk bildir" ile, düzeltme işleri operatörün iş başlatırken işaretlemesiyle kaydediliyor.'])}`;
  const hataliParca = hatalar.reduce((t,h)=>t+h.adet,0), hataliParcaOn = hatalarOn.reduce((t,h)=>t+h.adet,0);
  const prosesParca = hatalar.filter(h=>h.kaynak==='Proses').reduce((t,h)=>t+h.adet,0);
  const hurdaTop = hatalar.reduce((t,h)=>t+h.hurda,0);
  const grupla = fn => { const g = {}; hatalar.forEach(h=>{ const k = fn(h); const x = g[k] || (g[k] = { ad:k, v:0, n:0 }); x.v += h.adet; x.n += 1; }); return Object.values(g).sort((p,q)=>q.v-p.v); };
  const neden = grupla(h=>h.neden||'—'), kaynakMakine = grupla(h=>hataKimde(h).makine), kaynakKisi = grupla(h=>hataKimde(h).kisi);
  const nereye = [['Revizyon','revizyon','var(--accent)'],['K-stok','kstok','var(--warn)'],['Yarı mamul deposu','yariMamul','var(--tadilat-info)'],['Hurda','hurda','var(--danger)'],['Karar bekliyor','bekliyor','var(--text-subtle)']]
    .map(([ad,k,renk])=>({ ad, v: oz[k], renk })).filter(x=>x.v>0);

  /* Personel kalite karnesi: işlediği parça (FKK dışı, dönemde biten kayıtların adedi), hatalı parça
     (FKK / proses), oran, hurda, yol açtığı düzeltme süresi. "belli değil" kişiye atfedilmez. */
  const karne = {};
  const kisi = (u, ad) => karne[u] || (karne[u] = { u, ad: ad||u, islenen:0, fkk:0, proses:0, hurda:0, reworkDk:0, nedenler:{} });
  entriesArray().forEach(e=>{ if(e.status==='tamamlandi' && e.endTs>=a.bas && e.endTs<a.son && !kaliteMakinesiMi(e.makine) && !e.duzeltme && e.operatorUsername) kisi(e.operatorUsername, e.operatorName).islenen += rtSayi(e.adet); });
  hatalar.forEach(h=>{ const w = hataKimde(h); if(!w.u) return; const x = kisi(w.u, w.kisi);
    if(h.kaynak==='FKK') x.fkk += h.adet; else x.proses += h.adet; x.hurda += h.hurda; if(h.neden) x.nedenler[h.neden] = (x.nedenler[h.neden]||0) + h.adet; });
  rework.forEach(e=>{ const h = e.duzeltme && e.duzeltme.hataOp; if(!h || h.belirsiz || !h.operatorUsername) return; kisi(h.operatorUsername, h.operatorName).reworkDk += (entryDurationBreakdown(e).netMs||0)/60000; });
  const karneL = Object.values(karne).filter(x=>x.fkk+x.proses>0 || x.reworkDk>0).sort((p,q)=>(q.fkk+q.proses)-(p.fkk+p.proses));

  const cumleler = [
    liste.length ? `FKK'da <b>${rtFmt(oz.kontrol)} parça</b> kontrol edildi: onay ${rtFmt(oz.onay)}, şartlı kabul ${rtFmt(oz.sartli)}, red ${rtFmt(oz.red)} parça${oz.ilkKabulOran!=null?`; ilk kontrolde kabul <b>${agYuzde(oz.ilkKabulOran)}</b>`:''}.` : '',
    prosesParca ? `FKK'ya gelmeden <b>${rtFmt(prosesParca)} parçada</b> hata yakalandı.` : '',
    reworkDk ? `Düzeltme işlerine <b>${agSaat(reworkDk)}</b> harcandı.` : '',
    karneL[0] ? `En çok hata <b>${esc(karneL[0].ad)}</b> (${rtFmt(karneL[0].fkk+karneL[0].proses)} parça${karneL[0].islenen?`, işlediği parçaların ${agYuzde((karneL[0].fkk+karneL[0].proses)/karneL[0].islenen*100)} kadarı`:''}).` : '',
  ];
  const satirlar = hatalar.slice().sort((p,q)=>(q.ts||0)-(p.ts||0)).slice(0, 80);
  const turAd = h => h.kaynak==='FKK' ? (h.tur==='red'?'Red':'Şartlı') : ((UYG_KARAR.find(x=>x[0]===h.tur)||[0,h.tur])[1]);
  return `${bas}
  ${agYorum(cumleler)}
  <div class="rt-kpiler">
    ${rtKpi('Kontrol edilen parça', rtFmt(oz.kontrol), liste.length ? rtFark(oz.kontrol, ozOn.kontrol, { onAd }) : '', `${rtFmt(oz.isEmri)} FKK kaydı`)}
    ${rtKpi('İlk kontrolde kabul', oz.ilkKabulOran==null?'—':agYuzde(oz.ilkKabulOran), (oz.ilkKabulOran!=null && ozOn.ilkKabulOran!=null) ? rtFark(oz.ilkKabulOran, ozOn.ilkKabulOran, { iyi:'artis', onAd, puan:true, bicim:v=>agYuzde(v) }) : '', 'onay + şartlı, revizyon dönüşleri hariç')}
    ${rtKpi('Hatalı parça', rtFmt(hataliParca), rtFark(hataliParca, hataliParcaOn, { iyi:'azalis', onAd }), `proses ${rtFmt(prosesParca)} · hurda ${rtFmt(hurdaTop)}${reworkDk?` · düzeltme ${agSaat(reworkDk)}`:''}`)}
  </div>
  <div class="rt-izgara">
    ${nereye.length ? `<div class="rt-kutu"><div class="rt-kutu-bas"><h4>FKK red parçalar nereye</h4><span>parça</span></div>${kaliteCubuklar(nereye, 'var(--danger)')}</div>` : ''}
    <div class="rt-kutu"><div class="rt-kutu-bas"><h4>Neden</h4><span>FKK + proses · parça</span></div>${kaliteCubuklar(neden, 'var(--danger)')}</div>
    <div class="rt-kutu"><div class="rt-kutu-bas"><h4>Hatanın oluştuğu operasyon</h4><span>parça</span></div>${kaliteCubuklar(kaynakMakine, 'var(--warn)')}</div>
  </div>
  ${karneL.length ? `<div class="rt-kutu" style="margin-top:12px"><div class="rt-kutu-bas"><h4>Personel kalite karnesi</h4><span>hatanın oluştuğu operasyonu yapan kişiye göre · "belli değil" sayılmaz</span></div>
    <div class="table-wrap"><table class="rt-tablo"><thead><tr><th>Personel</th><th class="r">İşlediği parça</th><th class="r">Hatalı (FKK)</th><th class="r">Hatalı (proses)</th><th class="r">Hata oranı</th><th class="r">Hurda</th><th class="r rt-dar-gizle">Yol açtığı düzeltme</th><th class="rt-dar-gizle">En sık neden</th></tr></thead><tbody>
    ${karneL.map(x=>{ const top = x.fkk+x.proses, oran = x.islenen ? top/x.islenen*100 : null, en = Object.entries(x.nedenler).sort((p,q)=>q[1]-p[1])[0];
      return `<tr class="rt-tablo-sabit"><td><b>${esc(x.ad)}</b></td>
        <td class="r mono">${rtFmt(x.islenen)}</td><td class="r mono">${x.fkk?rtFmt(x.fkk):'—'}</td><td class="r mono">${x.proses?rtFmt(x.proses):'—'}</td>
        <td class="r mono" style="color:${oran==null?'var(--text-muted)':oran>=5?'var(--danger)':oran>=2?'var(--warn)':'var(--text)'}">${oran==null?'—':(oran<10?oran.toFixed(1).replace('.',','):Math.round(oran))+'%'}</td>
        <td class="r mono">${x.hurda?rtFmt(x.hurda):'—'}</td><td class="r mono rt-dar-gizle">${x.reworkDk?agSaat(x.reworkDk):'—'}</td>
        <td class="rt-dar-gizle">${en?esc(en[0])+` <span class="rt-silik">(${en[1]})</span>`:'—'}</td></tr>`; }).join('')}
    </tbody></table></div><div class="rt-dip">Hata oranı = hatalı parça / dönemde bitirdiği operasyonların adet toplamı (FKK ve düzeltme işleri hariç). Hatanın kişisi FKK'da ve proses kaydında şefin seçtiği operasyondan gelir.</div></div>` : ''}
  ${satirlar.length ? `<div class="rt-kutu rt-liste"><div class="rt-liste-bas"><div><h4>Uygunsuzluklar</h4><span>${rtFmt(hatalar.length)} kayıt${hatalar.length>satirlar.length?` · son ${satirlar.length}`:''}</span></div></div>
    <div class="table-wrap"><table class="rt-tablo rt-tablo-liste"><thead><tr><th>Tarih</th><th>Kaynak</th><th>İş emri</th><th>Mamul</th><th>Sonuç</th><th class="r">Adet</th><th>Neden</th><th class="rt-dar-gizle">Açıklama</th><th>Hata</th></tr></thead><tbody>
    ${satirlar.map(h=>{ const w = hataKimde(h); return `<tr class="rt-tablo-sabit">
      <td class="mono" style="white-space:nowrap">${fmtDT(h.ts)}</td>
      <td>${esc(h.kaynak)}</td>
      <td><div class="mono">${esc(h.e.talepNo||'—')}</div><div class="mono rt-silik">${esc(usTabanKod(h.e.isEmriNo))}</div></td>
      <td class="rt-kes" style="max-width:180px" title="${esc(usMamulAdi(h.e))}">${esc(usMamulAdi(h.e)||'—')}</td>
      <td>${esc(turAd(h))}</td>
      <td class="r mono">${rtFmt(h.adet)}</td>
      <td style="font-size:12px">${esc(h.neden||'—')}</td>
      <td class="rt-dar-gizle rt-kes" style="max-width:180px" title="${esc(h.aciklama||'')}">${esc(h.aciklama||'—')}</td>
      <td><span class="mono">${esc(w.makine)}</span> <span class="rt-silik">${esc(w.kisi)}</span></td>
    </tr>`; }).join('')}
    </tbody></table></div></div>` : ''}`;
}
