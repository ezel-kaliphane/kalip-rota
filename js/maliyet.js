/* ==================== MALİYET (08.10.2026) ====================
   Kullanıcının "Kalıp maliyet çalışması.xlsm" modeli, uygulamanın GERÇEK verisiyle:
     operasyon: net dk (duruş hariç; çoklu iş emri grubunda süre iş emirlerine bölünür)
                × makine grubunun dk ücreti (işçilik) + elektrik (kW × verim × kWh) + amortisman
     sarf:      toplam net dk × $/dk × kur   (takım tek iş emrinde bitmediği için ortalama — kullanıcı kararı)
     genel gider: işçilik × %   (Excel'deki "mühendislik hizmeti" oranı; fırın vb. buna dahil)
     çelik:     kg × €/kg (tür başına; stok çıkışı → malzeme kaydı → operatör girişi → standart reçete)
     karbür:    kg × kalite $/kg (karbür çıkış hareketleri; yoksa standart)
     ısıl işlem: rotada fason ısıl işlem (FII01) varsa çelik kg × türün kg fiyatı
     hurda:     dahil — birim maliyet = toplam / sağlam adet
   Kararlar (kullanıcı, 07–08.10.2026): Excel makine eşleşmesi onaylandı; işçilik hem bölüm ortalaması
   hem kişi bazlı (ayarlardan seçilir); amortismanı SuperAdmin ayarlar; karbür kaliteye göre kg;
   yalnız adminler görür; kur otomatik (Firebase kullanımı artmadan); hurda dahil.

   GİZLİLİK: depo herkese açık ve RTDB'de giriş kontrolü yok — ücret ve fiyatlar KODDA YOK, veritabanında
   ŞİFRELİ duruyor (AES-GCM, anahtar PBKDF2 ile maliyet şifresinden). Adminler şifreyi cihaz başına bir
   kez girer; çözülmüş anahtar yalnız o tarayıcının localStorage'ında durur. Maaş hiç saklanmaz — yalnız
   dakika ücreti. maliyet/sifreli = { v, salt, iv, ct, ts, by }; ct içinde { surumler:[{ ts, by, byName, p }] }.
   Her kayıt yeni sürüm: iş emri, bittiği tarihte geçerli parametrelerle hesaplanır. */

const MALIYET_GRUP_VARSAYILAN = [
  { key:'torna',        ad:'Torna',                  makineler:['UT01','UT02','UT03','UT04','UT05'], kw:5.5 },
  { key:'freze',        ad:'Freze',                  makineler:['UF01','UF02'],               kw:5.5 },
  { key:'cncDik',       ad:'CNC dik işlem',          makineler:['C02'],                       kw:15 },
  { key:'cncTorna',     ad:'CNC torna',              makineler:['C01'],                       kw:15 },
  { key:'delikTaslama', ad:'Delik taşlama',          makineler:['ODT01','ODT02','ODT03','MDT01','MDT02'], kw:5 },
  { key:'satihTaslama', ad:'Satıh taşlama',          makineler:['UST01','UST02'],             kw:6.2 },
  { key:'pres',         ad:'Pres',                   makineler:['P01'],                       kw:10 },
  { key:'parlatma',     ad:'Parlatma',               makineler:['PT01','PT02','PT03'],        kw:4.5 },
  { key:'sodick',       ad:'Sodick (tel erozyon)',   makineler:['TE01'],                      kw:11 },
  { key:'dalmaErozyon', ad:'Dalma erozyon',          makineler:['DE01','DE02','DE03','DDTE01'], kw:5 },
  { key:'testere',      ad:'Testere',                makineler:['TES01'],                     kw:2.55 },
  { key:'sammlite',     ad:'Sammlite (tel erozyon)', makineler:['TE02'],                      kw:9 }
];
function maliyetVarsayilan(){
  return {
    kur: { mod:'otomatik', usd:0, eur:0 },
    genel: { aylikDakika:13500, kwh:0, sarfDkUsd:0, genelGiderYuzde:0, iscilikYontemi:'bolum', verimlilik:1, isilMakineler:['FII01'] },
    gruplar: MALIYET_GRUP_VARSAYILAN.map(g => ({ ...g, makineler:g.makineler.slice(), dk:0, verim:100, amortDeger:0, amortYil:10, amortSaat:2340 })),
    kisiDk: {},
    celik: [],
    karbur: [ { kalite:'VA90', fiyat:0, para:'USD', yogunluk:13.4 }, { kalite:'ST7', fiyat:0, para:'USD', yogunluk:13.41 },
              { kalite:'ST6', fiyat:0, para:'USD', yogunluk:13.84 }, { kalite:'CTE50', fiyat:0, para:'EUR', yogunluk:13.15 },
              { kalite:'CTF30', fiyat:0, para:'EUR', yogunluk:14.05 } ],
    isil: []
  };
}
function canSeeMaliyet(){ return !!(session && (session.isSuperAdmin || (session.isAdmin && !session.isSef && !session.isUretimSef))); }
function canEditMaliyet(){ return !!(session && session.isSuperAdmin); }

/* ---------- Şifreleme ---------- */
const ML_ITER = 250000;
const mlB64e = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const mlB64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function mlAnahtarTuret(sifre, saltB64){
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(sifre), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt:mlB64d(saltB64), iterations:ML_ITER, hash:'SHA-256' }, base, { name:'AES-GCM', length:256 }, true, ['encrypt','decrypt']);
}
async function mlAnahtarSakla(key, saltB64){
  try{ localStorage.setItem('maliyetAnahtar:' + saltB64, mlB64e(await crypto.subtle.exportKey('raw', key))); }catch(e){}
}
async function mlAnahtarOku(saltB64){
  let raw = null; try{ raw = localStorage.getItem('maliyetAnahtar:' + saltB64); }catch(e){}
  if(!raw) return null;
  try{ return await crypto.subtle.importKey('raw', mlB64d(raw), { name:'AES-GCM' }, true, ['encrypt','decrypt']); }catch(e){ return null; }
}
async function mlCoz(blob, key){
  const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv:mlB64d(blob.iv) }, key, mlB64d(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function mlSifrele(veri, key){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(veri)));
  return { iv: mlB64e(iv), ct: mlB64e(ct) };
}

/* ---------- Durum ---------- */
let maliyetDurum = { yukleniyor:false, okundu:false, hata:null, blob:null, key:null, veri:null };
function maliyetAcik(){ return !!maliyetDurum.veri; }
function maliyetYukle(zorla){
  if(!canSeeMaliyet() || maliyetDurum.yukleniyor || (maliyetDurum.okundu && !zorla)) return;
  maliyetDurum.yukleniyor = true; maliyetDurum.hata = null;
  if(typeof ensureKarburKatalogLoaded === 'function') ensureKarburKatalogLoaded(() => safeRender());
  maliyetKurYukle();
  DB.ref('maliyet/sifreli').once('value').then(async snap => {
    maliyetDurum.blob = snap.val() || null;
    maliyetDurum.okundu = true;
    if(maliyetDurum.blob){
      const key = await mlAnahtarOku(maliyetDurum.blob.salt);
      if(key){ try{ maliyetDurum.veri = await mlCoz(maliyetDurum.blob, key); maliyetDurum.key = key; }catch(e){ maliyetDurum.veri = null; } }
    }
    maliyetDurum.yukleniyor = false; _maliyetOnbellek = {};
    safeRender();
  }).catch(err => {
    maliyetDurum.yukleniyor = false; maliyetDurum.okundu = true;
    maliyetDurum.hata = (err && err.message) || 'okuma hatası';
    safeRender();
  });
}
async function maliyetKilitAc(sifre){
  const b = maliyetDurum.blob; if(!b || !sifre) return false;
  try{
    const key = await mlAnahtarTuret(sifre, b.salt);
    maliyetDurum.veri = await mlCoz(b, key); maliyetDurum.key = key;
    await mlAnahtarSakla(key, b.salt); _maliyetOnbellek = {};
    return true;
  }catch(e){ return false; }
}
function maliyetKilitle(){
  try{ if(maliyetDurum.blob) localStorage.removeItem('maliyetAnahtar:' + maliyetDurum.blob.salt); }catch(e){}
  maliyetDurum.veri = null; maliyetDurum.key = null; _maliyetOnbellek = {};
}
/* Yeni sürüm kaydı. yeniSifre verilirse yeni tuz + anahtar (ilk kurulum / şifre değişikliği). */
async function maliyetKaydet(p, yeniSifre){
  if(!canEditMaliyet()) throw new Error('Yalnız SuperAdmin');
  let key = maliyetDurum.key, salt = maliyetDurum.blob && maliyetDurum.blob.salt;
  if(yeniSifre){ salt = mlB64e(crypto.getRandomValues(new Uint8Array(16))); key = await mlAnahtarTuret(yeniSifre, salt); }
  if(!key) throw new Error('Önce maliyet şifresini gir');
  const eski = (maliyetDurum.veri && maliyetDurum.veri.surumler) || [];
  const surumler = p ? eski.concat([{ ts: Date.now(), by: session.username, byName: session.displayName || session.username, p }]).slice(-40) : eski;
  const veri = { surumler };
  const s = await mlSifrele(veri, key);
  const blob = { v:1, salt, iv:s.iv, ct:s.ct, ts:Date.now(), by:session.username };
  await DB.ref('maliyet/sifreli').set(blob);
  maliyetDurum.blob = blob; maliyetDurum.key = key; maliyetDurum.veri = veri; _maliyetOnbellek = {};
  await mlAnahtarSakla(key, salt);
}
function maliyetSonParam(){ const s = maliyetDurum.veri && maliyetDurum.veri.surumler; return (s && s.length) ? s[s.length - 1].p : null; }
/* İş emrinin bittiği anda geçerli sürüm; o tarihten önce hiç sürüm yoksa ilk DOLU sürüm.
   Boş sürümler (şifre belirlenirken oluşan, ücret/fiyat girilmemiş kayıt) atlanır — yoksa kurulumdan
   önce biten tüm iş emirleri 0 ₺ çıkıyordu (08.10.2026). */
function mlSurumDolu(p){
  return !!p && ((p.gruplar || []).some(g => Number(g.dk) > 0) || (p.celik || []).some(c => Number(c.fiyat) > 0) || (p.karbur || []).some(c => Number(c.fiyat) > 0));
}
function maliyetParam(ts){
  const tum = maliyetDurum.veri && maliyetDurum.veri.surumler; if(!tum || !tum.length) return null;
  const dolu = tum.filter(v => mlSurumDolu(v.p));
  const s = dolu.length ? dolu : tum;
  let sec = s[0]; for(const v of s){ if(v.ts <= (ts || Date.now())) sec = v; }
  return sec.p;
}

/* ---------- Kur (otomatik: ECB referans kuru, api.frankfurter.dev — Firebase'e dokunmaz) ----------
   Bir kez çekilen günlük seri localStorage'da; günde en fazla bir istek. TCMB'nin CORS izni yok. */
let maliyetKurSeri = null, maliyetKurYukleniyor = false, maliyetKurHata = null;
function maliyetKurYukle(zorla){
  const bugun = new Date().toISOString().slice(0, 10);
  if(!maliyetKurSeri){ try{ const c = JSON.parse(localStorage.getItem('maliyetKurSeri') || 'null'); if(c && c.seri) maliyetKurSeri = c; }catch(e){} }
  if(maliyetKurYukleniyor || (!zorla && maliyetKurSeri && maliyetKurSeri.cekilen === bugun)) return;
  maliyetKurYukleniyor = true;
  const bas = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  Promise.all([
    fetch(`https://api.frankfurter.dev/v1/${bas}..${bugun}?from=USD&symbols=TRY`).then(r => r.json()),
    fetch(`https://api.frankfurter.dev/v1/${bas}..${bugun}?from=EUR&symbols=TRY`).then(r => r.json())
  ]).then(([u, e]) => {
    const seri = {};
    Object.entries(u.rates || {}).forEach(([d, r]) => { (seri[d] = seri[d] || {}).usd = r.TRY; });
    Object.entries(e.rates || {}).forEach(([d, r]) => { (seri[d] = seri[d] || {}).eur = r.TRY; });
    maliyetKurSeri = { cekilen: bugun, seri };
    try{ localStorage.setItem('maliyetKurSeri', JSON.stringify(maliyetKurSeri)); }catch(err){}
    maliyetKurYukleniyor = false; maliyetKurHata = null; _maliyetOnbellek = {};
    safeRender();
  }).catch(err => { maliyetKurYukleniyor = false; maliyetKurHata = (err && err.message) || 'kur alınamadı'; });
}
/* ts tarihindeki (ya da önceki son iş günündeki) kur; otomatik yoksa ayardaki elle kur. */
function maliyetKur(ts, P){
  const elle = { usd: Number(P && P.kur && P.kur.usd) || 0, eur: Number(P && P.kur && P.kur.eur) || 0, kaynak:'elle', tarih:'' };
  if(P && P.kur && P.kur.mod === 'elle') return elle;
  const s = maliyetKurSeri && maliyetKurSeri.seri;
  if(!s) return elle;
  const hedef = new Date(ts || Date.now()).toISOString().slice(0, 10);
  const gunler = Object.keys(s).sort();
  let sec = null; for(const d of gunler){ if(d <= hedef) sec = d; else break; }
  if(!sec) sec = gunler[0];
  const r = sec ? s[sec] : null;
  return (r && r.usd && r.eur) ? { usd: r.usd, eur: r.eur, kaynak:'ECB', tarih: sec } : elle;
}
function mlPara(fiyat, para, kur){ const f = Number(fiyat) || 0; return para === 'EUR' ? f * kur.eur : para === 'USD' ? f * kur.usd : f; }
function mlSayi(v){ const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; }

/* ---------- Ağırlık ---------- */
function mlCelikSatiri(P, metin){
  const t = String(metin || '').toLocaleUpperCase('tr-TR');
  const l = (P.celik || []);
  const dort = (t.match(/\b(\d{4})\b/) || [])[1];
  if(dort && /ISLAH|QT/.test(t)){ const q = l.find(c => String(c.tur).toUpperCase().replace(/\s+/g,' ') === dort + ' QT'); if(q) return q; }
  if(dort){ const r = l.find(c => String(c.tur).toUpperCase() === dort); if(r) return r; }
  return l.find(c => c.tur && t.includes(String(c.tur).toUpperCase())) || null;
}
/* Stok kalemi + miktar → kg. Boy takipli çubuk: Ø × mm; adet kalem: ölçülerinden (AxBxC) × adet. */
function mlKalemKg(it, miktar, yog){
  if(!it || !(miktar > 0)) return null;
  const metin = [it.kod, it.isim, it.cap].filter(Boolean).join(' ');
  if(it.tur === 'boy'){
    const D = mlSayi((String(it.cap || metin).match(/Ø\s*(\d+(?:[.,]\d+)?)/) || [])[1]);
    return D > 0 ? Math.PI * (D/2) * (D/2) * miktar * yog / 1e6 : null;
  }
  const m = metin.match(/(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);
  if(m) return mlSayi(m[1]) * mlSayi(m[2]) * mlSayi(m[3]) * yog / 1e6 * miktar;
  const c = metin.match(/Ø\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);
  if(c){ const D = mlSayi(c[1]); return Math.PI * (D/2) * (D/2) * mlSayi(c[2]) * yog / 1e6 * miktar; }
  return null;
}
/* Operatör girişi: "Ø26 x 200" / "51x123" (çap×boy) ya da "80x50x20" (blok) — parça başı × adet */
function mlMetinKg(capBoy, adet, yog){
  const n = String(capBoy || '').match(/\d+(?:[.,]\d+)?/g) || [];
  if(n.length >= 3) return mlSayi(n[0]) * mlSayi(n[1]) * mlSayi(n[2]) * yog / 1e6 * (adet || 1);
  if(n.length === 2){ const D = mlSayi(n[0]); return Math.PI * (D/2) * (D/2) * mlSayi(n[1]) * yog / 1e6 * (adet || 1); }
  return null;
}

/* ---------- İş emri maliyeti ---------- */
let _maliyetOnbellek = {};
function maliyetHesapla(x){
  if(!x || !maliyetAcik()) return null;
  const anahtar = (x.talep || x.uKodu) + '|' + x.finishedAt + '|' + (x.hammadde ? x.hammadde.kaynak : '') + '|' + Object.keys(karburKatalog || {}).length;
  if(_maliyetOnbellek[anahtar]) return _maliyetOnbellek[anahtar];
  const P = maliyetParam(x.finishedAt); if(!P) return null;
  const kur = maliyetKur(x.finishedAt, P);
  const eksik = [];
  if(!(kur.usd > 0 && kur.eur > 0)) eksik.push('Kur yok — ayarlardan elle kur gir');
  const grupOf = kod => (P.gruplar || []).find(g => (g.makineler || []).includes(kod));
  const verim = Number(P.genel.verimlilik) || 1;

  // Operasyonlar
  const ops = [];
  const gruplar = {};
  entriesArray().forEach(e => { if(e.groupId) gruplar[e.groupId] = (gruplar[e.groupId] || 0) + 1; });
  x.ana.concat(x.zarf, x.elmas).sort((a, b) => (a.startTs || 0) - (b.startTs || 0)).forEach(e => {
    const kod = String(e.makine || '').split(' · ')[0];
    const pay = e.groupId ? (gruplar[e.groupId] || 1) : 1;
    const dk = entryDurationBreakdown(e).netMs / 60000 / pay;
    const g = grupOf(kod);
    const kisi = P.genel.iscilikYontemi === 'kisi' ? mlSayi((P.kisiDk || {})[e.operatorUsername]) : 0;
    const dkUcret = g ? (kisi > 0 ? kisi : mlSayi(g.dk)) : 0;
    const iscilik = dk * dkUcret * verim;
    const elektrik = g ? dk * mlSayi(g.kw) * (mlSayi(g.verim) || 100) / 100 * mlSayi(P.genel.kwh) / 60 : 0;
    const amort = (g && mlSayi(g.amortDeger) > 0 && mlSayi(g.amortYil) > 0 && mlSayi(g.amortSaat) > 0)
      ? dk * mlSayi(g.amortDeger) / (mlSayi(g.amortYil) * mlSayi(g.amortSaat) * 60) : 0;
    const dal = bilesenOfCode(e.isEmriNo) || 'ANA';
    ops.push({ kod, grup: g ? g.ad : null, dk, iscilik, elektrik, amort, operator: e.operatorName || e.operatorUsername || '', dal, pay, kisiUcret: kisi > 0, duzeltme: !!e.duzeltme });
    if(g && !(dkUcret > 0)) eksik.push(g.ad + ': dakika ücreti girilmemiş');
  });
  const grupsuz = [...new Set(ops.filter(o => !o.grup).map(o => o.kod))];
  /* Sarf ve gösterilen toplam dakika yalnız ücretlendirilen gruplardan: fason ısıl işlem (FII01) süresi
     fasonda geçen beklemedir — maliyeti yalnız kg × kg fiyatı; FKK'nın ücreti yok (kullanıcı, 08.10.2026). */
  const toplamDk = ops.reduce((s, o) => s + (o.grup ? o.dk : 0), 0);
  const iscilik = ops.reduce((s, o) => s + o.iscilik, 0);
  const elektrik = ops.reduce((s, o) => s + o.elektrik, 0);
  const amort = ops.reduce((s, o) => s + o.amort, 0);
  const sarf = toplamDk * mlSayi(P.genel.sarfDkUsd) * kur.usd;
  const genelGider = iscilik * mlSayi(P.genel.genelGiderYuzde) / 100;

  // Çelik
  const celik = { kg:null, tutar:0, aciklama:'', tur:null };
  const hr = x.hmRaw;
  if(hr && (x.zarf.length || !x.dalli)){
    const kalemler = hr.kalemler || [];
    let kg = 0, tutar = 0, tamam = !!kalemler.length || hr.kaynak === 'operator';
    kalemler.forEach(k => {
      const it = (k.itemId && stockItems[k.itemId]) || { kod:k.kod, isim:k.isim, tur: k.birim === 'mm' ? 'boy' : 'adet', cap:k.cap };
      const satir = mlCelikSatiri(P, [it.kod, it.isim].join(' '));
      const yog = satir ? (mlSayi(satir.yogunluk) || 7.85) : 7.85;
      const kk = mlKalemKg(it, k.miktar, yog);
      if(kk == null){ tamam = false; eksik.push('Ağırlık hesaplanamadı: ' + (it.kod || it.isim || '?')); return; }
      kg += kk;
      if(satir && mlSayi(satir.fiyat) > 0){ tutar += kk * mlPara(satir.fiyat, satir.para || 'EUR', kur); celik.tur = celik.tur || satir.tur; }
      else { tamam = false; eksik.push('Çelik fiyatı yok: ' + (satir ? satir.tur : (it.kod || '?'))); }
    });
    if(hr.kaynak === 'operator'){
      const satir = mlCelikSatiri(P, hr.cins);
      const kk = mlMetinKg(hr.capBoy, x.adet, satir ? (mlSayi(satir.yogunluk) || 7.85) : 7.85);
      if(kk == null){ tamam = false; eksik.push('Operatör girişinden ağırlık çıkmadı: "' + (hr.capBoy || '') + '"'); }
      else { kg += kk; if(satir && mlSayi(satir.fiyat) > 0){ tutar += kk * mlPara(satir.fiyat, satir.para || 'EUR', kur); celik.tur = satir.tur; } else { tamam = false; eksik.push('Çelik türü/fiyatı bulunamadı: "' + (hr.cins || '') + '"'); } }
    }
    celik.kg = kg > 0 ? kg : null; celik.tutar = tutar;
    celik.aciklama = (BOM_KAYNAK[hr.kaynak] || {}).ad || '';
    if(!tamam) celik.eksik = true;
  } else if(x.zarf.length || !x.dalli){ eksik.push('Çelik hammadde kaydı yok'); }

  // Karbür
  const karbur = { kg:0, tutar:0, satir:[] };
  (x.karburRaw || []).forEach(h => {
    /* Katalog yüklenmemişse koddan: C28XH156X3XVA90 → Ø28, boy 156, delik 3, VA90 */
    const kk = String(h.kod || '').toUpperCase().match(/^[A-Z]?(\d+(?:[.,]\d+)?)XH(\d+(?:[.,]\d+)?)X(\d+(?:[.,]\d+)?)X?([A-Z]+\d+)/);
    const it = (h.katalogId && karburKatalog[h.katalogId]) || (kk ? { disCap: kk[1], boy: kk[2], delik: kk[3], kalite: kk[4] } : null);
    const kalite = (it && it.kalite) || (String(h.kod || '').match(/(VA\d+|ST\d+|CT[EF]\d+)/i) || [])[1] || '';
    const ks = (P.karbur || []).find(k => String(k.kalite).toUpperCase() === String(kalite).toUpperCase());
    const D = it ? mlSayi(it.disCap) : mlSayi((String(h.kod || '').match(/Ø\s*(\d+(?:[.,]\d+)?)/) || [])[1]);
    const d = it ? mlSayi(it.delik) : 0;
    const L = mlSayi(h.mm) || (mlSayi(h.boy) * (Math.abs(mlSayi(h.parca || h.adet)) || 1));
    if(!(D > 0) || !(L > 0)){ eksik.push('Karbür ölçüsü bulunamadı: ' + (h.kod || '?')); return; }
    const yog = ks ? (mlSayi(ks.yogunluk) || 13.4) : 13.4;
    const kg = Math.PI * ((D/2) * (D/2) - (d/2) * (d/2)) * L * yog / 1e6;
    const tutar = ks && mlSayi(ks.fiyat) > 0 ? kg * mlPara(ks.fiyat, ks.para || 'USD', kur) : 0;
    if(!(tutar > 0)) eksik.push('Karbür fiyatı yok: ' + (kalite || h.kod || '?'));
    karbur.kg += kg; karbur.tutar += tutar; karbur.satir.push({ kod: h.kod || (it && it.kod) || '', kalite, mm: L, kg, tutar });
  });
  if(x.elmas.length && !(x.karburRaw || []).length) eksik.push('Karbür çıkış kaydı yok');

  // Isıl işlem (fason): rotada FII01 vb.
  const isil = { tutar:0, aciklama:'' };
  const isilMak = (P.genel.isilMakineler || ['FII01']);
  if(ops.some(o => isilMak.includes(o.kod))){
    const satir = celik.tur ? (P.celik || []).find(c => c.tur === celik.tur) : null;
    const tur = satir && satir.isil ? (P.isil || []).find(i => i.tur === satir.isil) : null;
    if(tur && celik.kg){ isil.tutar = celik.kg * mlPara(tur.fiyat, tur.para || 'TRY', kur); isil.aciklama = tur.tur + ' · ' + mlFmt(celik.kg, 2) + ' kg'; }
    else eksik.push('Isıl işlem fiyatı bulunamadı (çelik türüne ısıl işlem türü bağla)');
  }

  // Hurda (dahil): FKK kararı + proses içi uygunsuzluklar
  let hurda = 0;
  x.ana.concat(x.zarf, x.elmas).forEach(e => {
    if(e.kalite && typeof kaliteDagilim === 'function') hurda += kaliteDagilim(e.kalite).hurda || 0;
    Object.values(e.uygunsuzluklar || {}).forEach(u => { if(u && u.karar === 'hurda') hurda += Number(u.adet) || 0; });
  });

  const toplam = iscilik + elektrik + amort + sarf + genelGider + celik.tutar + karbur.tutar + isil.tutar;
  const adet = Number(x.adet) || 0;
  const saglam = Math.max(0, adet - hurda);
  const birim = (saglam || adet) ? toplam / (saglam || adet) : null;
  const sonuc = { toplam, birim, adet, hurda, saglam, hurdaPayi: birim && hurda ? birim * hurda : 0, kur, toplamDk,
    iscilik, elektrik, amort, sarf, genelGider, celik, karbur, isil, ops, grupsuz, eksik:[...new Set(eksik)],
    yontem: P.genel.iscilikYontemi, genelGiderYuzde: mlSayi(P.genel.genelGiderYuzde), isilMak };
  _maliyetOnbellek[anahtar] = sonuc;
  return sonuc;
}
function mlFmt(n, ond){ return (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: ond || 0, maximumFractionDigits: ond == null ? 0 : ond }); }
function mlTL(n){ return mlFmt(n, (Math.abs(n) < 100 ? 2 : 0)) + ' ₺'; }
