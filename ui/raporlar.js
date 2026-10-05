/* ===================== RAPORLAR (05.10.2026) =====================
   Kullanıcının yıllık sunumundaki (2025 KALIPHANE - KALIP STOK SUNUM) ve verimlilik Excel'indeki
   dönemsel raporların uygulamadaki karşılığı. Ön çalışma: https://claude.ai/artifact/REdamcRQtM4TgFUsU1NgZA
   Kararlar (kullanıcı, 05.10.2026): ana ölçü PARÇA ADEDİ; geçen yılla değil ÖNCEKİ DÖNEMLE kıyas;
   yalnızca adminler görür (Şef/Üretim Şef hariç — Analiz'le aynı kural); eski "Rapor" ekranının
   adı "Kayıtlar". İlk rapor Tadilat; İmalat vb. sonra bu dosyaya alt sekme olarak eklenecek.

   Veri: tadilatlar düğümü zaten canlı ve tam bellekte (tadilatArray) — ek Firebase okuması yok.
   Talep, AÇILDIĞI tarihe (olusturmaTs) göre döneme düşer. testKaydi:true kayıtlar (açılış
   günündeki 14 deneme kaydı, 05.10.2026'da işaretlendi) hiçbir yerde sayılmaz. */

function raporlarGorunur(){
  return !!(session && session.isAdmin && !(session.isSef || session.isUretimSef) && isAdminTabVisible('raporlar'));
}

let rtDonem = 'son3Ay';          // buAy | gecenAy | son3Ay | buYil | ozel
let rtBas = '', rtSon = '';      // özel aralık, 'YYYY-MM-DD'
let rtAtolye = 'tumu';           // tumu | tadilat | imalat
let rtSecim = null;              // { tur, anahtar, etiket } — kırılımda tıklanan satır, alttaki listeyi süzer
let rtSayfa = 1;
const RT_SAYFA_BOYUT = 30;
let rtSonListe = [];             // Excel'e aktarılacak (süzülmüş) talep listesi

const RT_AY = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const RT_AY_KISA = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function rtDonemSec(d){ rtDonem = d; rtSecim = null; rtSayfa = 1; if(d==='ozel' && !rtBas){ const s=rtAralik(); rtBas=dateKey(s.bas); rtSon=dateKey(Math.min(s.son, Date.now())-1); } render(); }
function rtAtolyeSec(a){ rtAtolye = a; rtSecim = null; rtSayfa = 1; render(); }
function rtOzelYaz(alan, deger){ if(alan==='bas') rtBas = deger; else rtSon = deger; rtSecim = null; rtSayfa = 1; render(); }
function rtSec(tur, anahtar, etiket){
  rtSecim = (rtSecim && rtSecim.tur===tur && rtSecim.anahtar===anahtar) ? null : { tur, anahtar, etiket };
  rtSayfa = 1; render();
  if(rtSecim){ setTimeout(()=>{ const el=document.getElementById('rt-liste'); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); }, 30); }
}
function rtSecimKaldir(){ rtSecim = null; rtSayfa = 1; render(); }
function rtSayfaGit(n){ rtSayfa = n; render(); const el=document.getElementById('rt-liste'); if(el) el.scrollIntoView({block:'start'}); }

function rtGun(ts){ const d=new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function rtAyEkle(ts, k){ const d=new Date(ts); return new Date(d.getFullYear(), d.getMonth()+k, d.getDate(), d.getHours(), d.getMinutes()).getTime(); }
function rtTarihOku(s){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); return m ? new Date(+m[1], +m[2]-1, +m[3]).getTime() : null; }

/* Seçili dönem: [bas, son) ms. Ay tabanlı dönemlerin "önceki dönemi" aynı sayıda ay geriye kaydırılıp
   BUGÜNE KADARKİ kısmıyla kıyaslanır — 5 Ekim'de "Bu Ay", 1–5 Eylül ile karşılaştırılır, tam Eylül'le
   değil (yoksa ay başında her şey düşüş görünürdü). Özel aralıkta önceki dönem = hemen önceki eşit süre. */
function rtAralik(){
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  const t = (Y,M,D)=> new Date(Y,M,D).getTime();
  if(rtDonem==='buAy')    return { bas:t(y,m,1),   son:t(y,m+1,1), ay:1,  etiket:`${RT_AY[m]} ${y}` };
  if(rtDonem==='gecenAy') return { bas:t(y,m-1,1), son:t(y,m,1),   ay:1,  etiket:`${RT_AY[(m+11)%12]} ${m===0?y-1:y}` };
  if(rtDonem==='buYil')   return { bas:t(y,0,1),   son:t(y+1,0,1), ay:12, etiket:`${y}` };
  if(rtDonem==='ozel'){
    const b = rtTarihOku(rtBas), s = rtTarihOku(rtSon);
    if(b!=null && s!=null && s>=b) return { bas:b, son:s+86400000, ay:0, etiket:`${rtBas.split('-').reverse().join('.')} – ${rtSon.split('-').reverse().join('.')}` };
  }
  const b = t(y,m-2,1);
  return { bas:b, son:t(y,m+1,1), ay:3, etiket:`${RT_AY[new Date(b).getMonth()]} – ${RT_AY[m]} ${y}` };
}
function rtOncekiAralik(a){
  const bitis = Math.min(a.son, Date.now());
  if(a.ay>0) return { bas: rtAyEkle(a.bas, -a.ay), son: rtAyEkle(bitis, -a.ay) };
  const uz = a.son - a.bas;
  return { bas: a.bas - uz, son: a.bas };
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
/* İşlem türü — formda henüz ayrı alan yok, "Ne işlem yapılacak" metninden tahmin. Bir talep birden
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

/* Bir talebin ölçümleri — liste ve özet ikisi de buradan. */
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

function rtKayitlar(bas, son){
  return tadilatArray().filter(t=>!t.testKaydi && t.olusturmaTs>=bas && t.olusturmaTs<son
    && (rtAtolye==='tumu' || (t.atolye||'imalat')===rtAtolye));
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

/* Kırılımlar: anahtar → { etiket, parca, talep }. Her talep kendi parça adediyle sayılır. */
function rtGrupla(liste, anahtarFn){
  const m = {};
  liste.forEach(t=>{
    const parca = rtSayi(t.adet);
    [].concat(anahtarFn(t)).forEach(k=>{
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
  atolye:  t => (t.atolye||'imalat')==='tadilat' ? [['tadilat','Tadilat atölyesi']] : [['imalat','İmalat atölyesi']],
  isleyen: t => [...new Set(tadilatOperasyonlarArray(t).map(o=>String(o.makine||'').split(' · ')[0]).filter(Boolean))].map(m=>[m,m]),
};
function rtSecimeUyar(t){
  if(!rtSecim) return true;
  const fn = RT_KIRILIM[rtSecim.tur]; if(!fn) return true;
  return [].concat(fn(t)).some(k=>k && k[0]===rtSecim.anahtar);
}

/* Zaman serisi: ≤35 gün günlük, ≤120 gün haftalık (Pazartesi başlangıçlı), daha uzunu aylık. */
function rtZamanSerisi(liste, a){
  const bitis = Math.min(a.son, Math.max(Date.now(), a.bas+86400000));
  const gun = (bitis - a.bas)/86400000;
  const kip = gun<=35 ? 'gun' : gun<=120 ? 'hafta' : 'ay';
  const kovaBas = ts => { const d=new Date(ts);
    if(kip==='gun') return rtGun(ts);
    if(kip==='hafta'){ const g=rtGun(ts), w=(new Date(g).getDay()+6)%7; return g - w*86400000; }
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
  const kovalar = [];
  for(let k=kovaBas(a.bas); k<bitis; ){
    kovalar.push({ bas:k, tad:0, ima:0 });
    if(kip==='gun') k = rtGun(k+36*3600000); else if(kip==='hafta') k = rtGun(k+7*86400000+3600000); else { const d=new Date(k); k = new Date(d.getFullYear(), d.getMonth()+1, 1).getTime(); }
  }
  const idx = {}; kovalar.forEach((k,i)=>idx[k.bas]=i);
  liste.forEach(t=>{ const i = idx[kovaBas(t.olusturmaTs)]; if(i==null) return; const p = rtSayi(t.adet); if((t.atolye||'imalat')==='tadilat') kovalar[i].tad += p; else kovalar[i].ima += p; });
  const etiket = k => { const d=new Date(k.bas);
    if(kip==='ay') return RT_AY_KISA[d.getMonth()];
    if(kip==='hafta') return `${d.getDate()} ${RT_AY_KISA[d.getMonth()]}`;
    return String(d.getDate()); };
  return { kip, kovalar: kovalar.map(k=>({ ...k, etiket: etiket(k) })) };
}

/* ---------- çizim yardımcıları ---------- */
function rtDegisim(simdi, once){
  if(once==null || !isFinite(once)) return '';
  if(once===0) return simdi>0 ? `<span class="rt-fark notr" title="Kıyaslanacak dönemde hiç kayıt yok (uygulama Ağustos 2026'da başladı)">önceki dönemde kayıt yok</span>` : '';
  const p = (simdi-once)/once*100;
  if(Math.abs(p) < 0.5) return `<span class="rt-fark notr">±0</span>`;
  return `<span class="rt-fark ${p>0?'artis':'azalis'}">${p>0?'▲':'▼'} %${Math.abs(p).toFixed(Math.abs(p)<10?1:0).replace('.',',')}</span>`;
}
/* Süre KPI'sında artış kötüdür — renk ters çevrilir. */
function rtSureDegisim(simdi, once){
  if(simdi==null || once==null || once===0) return '';
  const p = (simdi-once)/once*100;
  if(Math.abs(p) < 0.5) return `<span class="rt-fark notr">±0</span>`;
  return `<span class="rt-fark ${p>0?'azalis':'artis'}">${p>0?'▲':'▼'} %${Math.abs(p).toFixed(0)}</span>`;
}
function rtKpi(etiket, deger, alt, fark){
  return `<div class="rt-kpi"><div class="rt-kpi-k">${esc(etiket)}</div><div class="rt-kpi-v">${deger}</div><div class="rt-kpi-s">${fark||''}${alt?`<span>${alt}</span>`:''}</div></div>`;
}
/* Yatay çubuk listesi — satır tıklanınca alttaki talep listesini süzer. */
function rtCubukListe(tur, gruplar, opt){
  opt = opt || {};
  const ust = gruplar.slice(0, opt.adet || 10);
  if(!ust.length) return `<div class="rt-bos">Bu dönemde kayıt yok.</div>`;
  const max = Math.max(...ust.map(g=>g.parca), 1);
  return `<div class="rt-cubuklar">${ust.map(g=>{
    const secili = rtSecim && rtSecim.tur===tur && rtSecim.anahtar===g.anahtar;
    return `<button type="button" class="rt-cubuk ${secili?'secili':''}" onclick="rtSec('${escJs(tur)}','${escJs(g.anahtar)}','${escJs(g.etiket)}')" title="${esc(g.etiket)} — ${rtFmt(g.parca)} parça, ${g.talep} talep · listeyi süz">
      <span class="rt-cubuk-ad ${opt.mono?'mono':''}">${esc(g.etiket)}</span>
      <span class="rt-cubuk-iz"><span style="width:${Math.max(1.5, g.parca/max*100).toFixed(1)}%${opt.renk?';background:'+opt.renk:''}"></span></span>
      <span class="rt-cubuk-d mono">${rtFmt(g.parca)}<small>${g.talep} talep</small></span>
    </button>`;}).join('')}</div>${gruplar.length>ust.length ? `<div class="rt-dip">+${gruplar.length-ust.length} daha</div>` : ''}`;
}
/* Grafik kutunun GERÇEK genişliğinde çiziliyor: sabit viewBox geniş kutuda büyüyüp yazıları
   iriltiyor, telefonda küçültüp okunmaz yapıyordu. Genişlik her render'da kabuktan okunur. */
function rtSeriSvg(seri){
  const kabuk = document.querySelector('.admin-shell-body');
  const W = Math.max(300, Math.min(1500, ((kabuk && kabuk.clientWidth) || window.innerWidth || 900) - (window.innerWidth<=900 ? 66 : 84)));
  const H=210, alt=24, ust=18, sol=44, sag=6;
  const k = seri.kovalar;
  const ham = Math.max(1, ...k.map(x=>x.tad+x.ima));
  const adimlar = [1,2,5,10,20,25,50,100,200,250,500,1000,2000,2500,5000,10000];
  const adim = adimlar.find(a=>ham/a<=4) || 10000;
  const max = Math.ceil(ham/adim)*adim;
  const ph=H-alt-ust, pw=W-sol-sag, y=v=>ust+ph-(v/max*ph);
  const grup = pw/Math.max(1,k.length), bw = Math.max(3, Math.min(46, grup*0.62));
  const etiketAdim = Math.ceil(k.length/14);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="rt-svg" role="img" aria-label="Dönem içinde parça adedi">`;
  for(let v=0; v<=max; v+=adim){
    s += `<line x1="${sol}" x2="${W-sag}" y1="${y(v)}" y2="${y(v)}" class="rt-grid"/><text x="${sol-6}" y="${y(v)+4}" text-anchor="end" class="rt-eks">${rtFmt(v)}</text>`;
  }
  k.forEach((x,i)=>{
    const cx = sol + grup*i + grup/2, tY = y(x.tad), iY = y(x.tad+x.ima);
    if(x.tad>0) s += `<rect x="${(cx-bw/2).toFixed(1)}" y="${tY.toFixed(1)}" width="${bw.toFixed(1)}" height="${(ust+ph-tY).toFixed(1)}" class="rt-s-tad"><title>${esc(x.etiket)} · tadilat atölyesi ${rtFmt(x.tad)} parça</title></rect>`;
    if(x.ima>0) s += `<rect x="${(cx-bw/2).toFixed(1)}" y="${iY.toFixed(1)}" width="${bw.toFixed(1)}" height="${(tY-iY).toFixed(1)}" class="rt-s-ima"><title>${esc(x.etiket)} · imalat atölyesi ${rtFmt(x.ima)} parça</title></rect>`;
    if(k.length<=16 && x.tad+x.ima>0) s += `<text x="${cx.toFixed(1)}" y="${(iY-5).toFixed(1)}" text-anchor="middle" class="rt-deger">${rtFmt(x.tad+x.ima)}</text>`;
    if(i%etiketAdim===0) s += `<text x="${cx.toFixed(1)}" y="${H-7}" text-anchor="middle" class="rt-eks">${esc(x.etiket)}</text>`;
  });
  return s + `</svg>`;
}

function renderRaporlar(){
  if(!raporlarGorunur()) return `<div class="settings-wrap"><div class="notice" style="--nc:var(--warn)"><div class="notice-title">Raporlar yalnızca yöneticilere açık</div></div></div>`;
  return `<div class="rt-wrap">${renderTadilatRaporu()}</div>`;
}

function renderTadilatRaporu(){
  const a = rtAralik(), on = rtOncekiAralik(a);
  const liste = rtKayitlar(a.bas, a.son);
  const onceki = rtKayitlar(on.bas, on.son);
  const oz = rtOzet(liste), ozOn = rtOzet(onceki);
  const acik = tadilatArray().filter(t=>!t.testKaydi && !tadilatTamamlandiMi(t) && (rtAtolye==='tumu' || (t.atolye||'imalat')===rtAtolye)).length;
  const seri = rtZamanSerisi(liste, a);
  const bolumG = rtGrupla(liste, RT_KIRILIM.bolum), bolumOnG = rtGrupla(onceki, RT_KIRILIM.bolum);
  const kodG = rtGrupla(liste, RT_KIRILIM.kod);
  const kodsuz = kodG.find(g=>g.anahtar==='__kodsuz');
  const gercekKod = kodG.filter(g=>g.anahtar!=='__kodsuz' && g.talep>=2).sort((x,y)=>y.talep-x.talep||y.parca-x.parca);
  const kodFarkli = kodG.filter(g=>g.anahtar!=='__kodsuz').length;

  /* İşi yapan makine: operasyon sayısı + net işlem saati (operasyon bazında, parça değil). */
  const isleyen = {};
  liste.forEach(t=>tadilatOperasyonlarArray(t).forEach(o=>{
    const m = String(o.makine||'').split(' · '); const k = m[0]; if(!k) return;
    const g = isleyen[k] || (isleyen[k] = { anahtar:k, ad:m[1]||'', op:0, netMs:0 });
    g.op += 1; if(o.baslamaTs && o.bitisTs) g.netMs += tadilatOpDurationBreakdown(o).netMs||0;
  }));
  const isleyenL = Object.values(isleyen).sort((x,y)=>y.op-x.op).slice(0,10);

  /* Bekleme dağılımı: atölyeye göre ayrı sütun, talep sayısı. */
  const bekTad = RT_BEKLEME_KOVA.map(()=>0), bekIma = RT_BEKLEME_KOVA.map(()=>0);
  liste.forEach(t=>{ const o=rtTalepOlcu(t); if(o.beklemeDk==null) return; const i=RT_BEKLEME_KOVA.findIndex(([x,y])=>o.beklemeDk>=x && o.beklemeDk<y); ((t.atolye||'imalat')==='tadilat'?bekTad:bekIma)[i]++; });
  const bekMax = Math.max(1, ...bekTad, ...bekIma);

  const donemBtn = (k, ad) => `<button type="button" class="rt-donem ${rtDonem===k?'on':''}" onclick="rtDonemSec('${k}')">${ad}</button>`;
  const atolyeBtn = (k, ad) => `<button type="button" class="rt-donem ${rtAtolye===k?'on':''}" onclick="rtAtolyeSec('${k}')">${ad}</button>`;
  const payTad = oz.parca>0 ? oz.parcaTad/oz.parca*100 : null;

  // Alttaki liste: dönem + atölye + (varsa) tıklanan kırılım
  const suzulmus = liste.filter(rtSecimeUyar).sort((x,y)=>(y.olusturmaTs||0)-(x.olusturmaTs||0));
  rtSonListe = suzulmus;
  const toplamSayfa = Math.max(1, Math.ceil(suzulmus.length/RT_SAYFA_BOYUT));
  rtSayfa = Math.min(Math.max(1, rtSayfa), toplamSayfa);
  const sayfa = suzulmus.slice((rtSayfa-1)*RT_SAYFA_BOYUT, rtSayfa*RT_SAYFA_BOYUT);
  const suzParca = suzulmus.reduce((s,t)=>s+rtSayi(t.adet),0);

  return `
  <div class="rt-ust">
    <div class="rt-alt-sekme"><span class="sub-tab-btn active">Tadilat Raporu</span></div>
    <div class="rt-filtre">
      <div class="rt-filtre-grup">${donemBtn('buAy','Bu ay')}${donemBtn('gecenAy','Geçen ay')}${donemBtn('son3Ay','Son 3 ay')}${donemBtn('buYil','Bu yıl')}${donemBtn('ozel','Özel')}</div>
      ${rtDonem==='ozel' ? `<div class="rt-filtre-grup"><input type="date" id="rt-bas" value="${esc(rtBas)}" onchange="rtOzelYaz('bas',this.value)"><span style="color:var(--text-muted)">–</span><input type="date" id="rt-son" value="${esc(rtSon)}" onchange="rtOzelYaz('son',this.value)"></div>` : ''}
      <div class="rt-filtre-grup">${atolyeBtn('tumu','Tüm atölyeler')}${atolyeBtn('tadilat','Tadilat atölyesi')}${atolyeBtn('imalat','İmalat atölyesi')}</div>
    </div>
    <div class="rt-donem-bilgi">${esc(a.etiket)} · ${rtFmt(oz.talep)} talep · kıyas: önceki ${a.ay===1?'ayın':a.ay===12?'yılın':a.ay===3?'3 ayın':'eşit sürenin'} aynı kısmı (${dateKey(on.bas).split('-').reverse().join('.')} – ${dateKey(on.son-1).split('-').reverse().join('.')})</div>
  </div>

  <div class="rt-kpiler">
    ${rtKpi('Parça', rtFmt(oz.parca), `önceki ${rtFmt(ozOn.parca)}`, rtDegisim(oz.parca, ozOn.parca))}
    ${rtKpi('Talep', rtFmt(oz.talep), `talep başına ${oz.talep? (oz.parca/oz.talep).toFixed(1).replace('.',','):'—'} parça`, rtDegisim(oz.talep, ozOn.talep))}
    ${rtAtolye==='tumu' ? rtKpi('Tadilat atölyesi payı', payTad==null?'—':'%'+Math.round(payTad), 'parça bazında', '') : ''}
    ${rtKpi('Başlama bekleme', rtDk(rtAtolye==='imalat'?oz.beklemeIma:rtAtolye==='tadilat'?oz.beklemeTad:oz.beklemeHepsi), rtAtolye==='tumu' ? `medyan · tadilat ${rtDk(oz.beklemeTad)}, imalat ${rtDk(oz.beklemeIma)}` : 'medyan', rtSureDegisim(rtAtolye==='imalat'?oz.beklemeIma:rtAtolye==='tadilat'?oz.beklemeTad:oz.beklemeHepsi, rtAtolye==='imalat'?ozOn.beklemeIma:rtAtolye==='tadilat'?ozOn.beklemeTad:ozOn.beklemeHepsi))}
    ${rtKpi('İşlem süresi', rtDk(rtAtolye==='imalat'?oz.netIma:rtAtolye==='tadilat'?oz.netTad:oz.netHepsi), rtAtolye==='tumu' ? `medyan net · tadilat ${rtDk(oz.netTad)}, imalat ${rtDk(oz.netIma)}` : 'medyan net', '')}
    ${rtKpi('Şu an açık', rtFmt(acik), 'dönemden bağımsız', '')}
  </div>

  <div class="rt-izgara">
    <div class="rt-kutu rt-genis">
      <div class="rt-kutu-bas"><h4>Parça adedi</h4><span>${seri.kip==='gun'?'günlük':seri.kip==='hafta'?'haftalık':'aylık'} · talebin açıldığı tarihe göre</span></div>
      ${liste.length ? rtSeriSvg(seri) : `<div class="rt-bos">Bu dönemde talep yok.</div>`}
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
          <span class="rt-bek-cift">${rtAtolye!=='imalat'?`<span class="rt-bek-c tad" style="height:${(bekTad[i]/bekMax*100).toFixed(1)}%"><b>${bekTad[i]||''}</b></span>`:''}${rtAtolye!=='tadilat'?`<span class="rt-bek-c ima" style="height:${(bekIma[i]/bekMax*100).toFixed(1)}%"><b>${bekIma[i]||''}</b></span>`:''}</span>
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
      <div><h4>Talepler</h4><span>${rtSecim ? `<b>${esc(rtSecim.etiket)}</b> · ` : ''}${rtFmt(suzulmus.length)} talep · ${rtFmt(suzParca)} parça</span></div>
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
