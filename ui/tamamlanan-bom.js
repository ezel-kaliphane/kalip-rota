/* ==================== TAMAMLANAN KODLAR → BOM + ROTA (06.10.2026, kullanıcı isteği) ====================
   "Tamamlanan kodlarda görmek istiyorum: CANIAS kodu, kullanılan hammadde ve boyu, varsa kullanılan
   karbür ve boyu, rota x → y → … → bitti; kaç tanesinde hem BOM hem rota var, ekranda yazsın."
   Kart = BİR CANIAS iş emri (talepNo; yoksa U kodu). _ZARF ve _ELMAS ayrı kod DEĞİL, aynı U kodunun
   dalları (kullanıcı düzeltmesi): kartta _ZARF altında çelik hammadde, _ELMAS altında karbür; rota
   iki dalın ayrı ayrı operasyonları → preste birleşme → ana (U kodu) operasyonları → Bitti.
   Tamamlandı sayılması: grupta devam/duruş yok; ana (eksiz) kayıt varsa sonuncusu "son operasyon",
   yoksa var olan her dalın sonuncusu "son operasyon". Ara adımlarda "son" işaretlenmiş olsa bile iş
   emri tek kart (computeCompletedRoutes onları ayrı rota sayıyordu, burada mükerrer çıkmasın).
   Hammadde kaynağı en güvenilirden başlayarak:
     1) stok çıkışı   — stockHareketleri (ilk operasyonda stoktan düşülen kalem, gerçek tüketim)
     2) malzeme bekleyen kaydı — şefin o iş emri için seçtiği hammadde ve gereken miktar
     3) operatör girişi — iş başlatırken yazılan malzeme cinsi / çap×boy (serbest metin)
     4) reçete — hammaddeRecete'deki mamul eşlemesi (tahmini; miktar = birim başına × adet)
   Karbür: karburHareketleri (tahsis / kesimsiz / adet çıkışı / fireden), geri alınan planlar hariç,
   talepNo ile eşlenir; yoksa _ELMAS dalında operatörün yazdığı malzeme.
   "BOM tam": var olan her dalın malzemesi bulunmuş (ZARF → hammadde, ELMAS → karbür); dalsız işte
   hammadde ya da karbür. Veri ekran açılınca BİR KEZ okunur (canlı dinleyici yok, ↻ ile yenilenir). */

let bomRotaVeri = { stok: null, karbur: null, yukleniyor: false, hata: null, ts: 0 };
let bomRotaFiltre = 'tumu';        // tumu | tam | eksik | karburlu
let bomRotaLimit = 100;
let _bomRotaCache = null, _bomRotaCacheAnahtar = null;

function bomRotaYukle(zorla){
  if(bomRotaVeri.yukleniyor) return;
  if(!zorla && bomRotaVeri.stok && bomRotaVeri.karbur) return;
  bomRotaVeri.yukleniyor = true; bomRotaVeri.hata = null;
  if(typeof ensureMalzemeBekleyenLoaded === 'function') ensureMalzemeBekleyenLoaded();
  if(typeof ensureHammaddeReceteLoaded === 'function') ensureHammaddeReceteLoaded(() => safeRender(), !!zorla);
  const oku = yol => DB.ref(yol).once('value').then(s => s.val() || {}).catch(err => { bomRotaVeri.hata = (err && err.message) || 'okuma hatası'; return {}; });
  Promise.all([oku('stockHareketleri'), oku('karburHareketleri')]).then(([stok, karbur]) => {
    bomRotaVeri = { stok, karbur, yukleniyor: false, hata: bomRotaVeri.hata, ts: Date.now() };
    _bomRotaCache = null;
    safeRender();
  });
}
function bomRotaYenile(){ bomRotaYukle(true); render(); }
function setBomRotaFiltre(f){ bomRotaFiltre = f; bomRotaLimit = 100; render(); }
function bomRotaDahaFazla(){ bomRotaLimit += 100; render(); }

function bomSayi(n){
  const x = Math.round((Number(n) || 0) * 10) / 10;
  return x.toLocaleString('tr-TR');
}
const _bomZaman = (a, b) => (a.startTs || 0) - (b.startTs || 0);

/* Rota zinciri: makine kodları başlangıç sırasıyla; art arda aynı makine (bölünmüş parti,
   duraklat-devam) tek halka sayılır. */
function bomRotaZinciri(list){
  const z = [];
  list.forEach(e => {
    const m = String(e.makine || '').split(' · ')[0] || '—';
    if(z[z.length - 1] !== m) z.push(m);
  });
  return z;
}

/* Tamamlanmış iş emirleri — CANIAS iş emri (talepNo) başına tek grup, dallar ayrılmış. */
function bomTamamlananGruplar(){
  const g = {};
  entriesArray().forEach(e => {
    const uKodu = baseIsEmriNo(e.isEmriNo);
    if(!uKodu || uKodu === TEST_ISEMRI_NO) return;
    const talep = String(e.talepNo || '').trim().toUpperCase();
    const k = talep || ('U:' + uKodu);
    (g[k] = g[k] || { talep, uKodu, entries: [] }).entries.push(e);
  });
  const sonMu = list => { const s = list[list.length - 1]; return !!(s && s.status === 'tamamlandi' && s.sonOperasyon); };
  const sonuc = [];
  Object.values(g).forEach(grp => {
    const es = grp.entries.sort(_bomZaman);
    if(es.some(e => e.status === 'devam' || e.status === 'duruş')) return;
    const devralinan = new Set(es.filter(e => e.parentEntryId).map(e => e.parentEntryId));
    if(es.some(e => e.partiRootId && e.status === 'tamamlandi' && !e.sonOperasyon && !devralinan.has(e.id))) return; // bekleyen parti
    const ana = es.filter(e => !bilesenOfCode(e.isEmriNo));
    const zarf = es.filter(e => bilesenOfCode(e.isEmriNo) === 'ZARF');
    const elmas = es.filter(e => bilesenOfCode(e.isEmriNo) === 'ELMAS');
    const tamam = ana.length ? sonMu(ana) : ((!zarf.length || sonMu(zarf)) && (!elmas.length || sonMu(elmas)));
    if(!tamam) return;
    sonuc.push({ ...grp, ana, zarf, elmas, finishedAt: Math.max(...es.map(e => e.endTs || 0)) });
  });
  return sonuc.sort((a, b) => b.finishedAt - a.finishedAt);
}

function bomRotaListesi(){
  const anahtar = [STATE.entries, bomRotaVeri.ts, malzemeBekleyen, hammaddeRecete];
  if(_bomRotaCache && _bomRotaCacheAnahtar && anahtar.every((x, i) => x === _bomRotaCacheAnahtar[i])) return _bomRotaCache;

  // Stok çıkışları: talep no ile (yoksa iş emri/U kodu ile)
  const stokTalep = {}, stokIe = {};
  Object.values(bomRotaVeri.stok || {}).forEach(h => {
    if(!h || !(Number(h.miktar) < 0)) return;
    const t = String(h.talepNo || '').trim().toUpperCase(), ie = baseIsEmriNo(h.isEmriNo);
    if(t) (stokTalep[t] = stokTalep[t] || []).push(h);
    else if(ie) (stokIe[ie] = stokIe[ie] || []).push(h);
  });
  // Malzeme bekleyen kayıtları
  const mbTalep = {}, mbIe = {};
  Object.values(malzemeBekleyen || {}).forEach(m => {
    if(!m || !m.hammaddeKod) return;
    const t = String(m.talepNo || '').trim().toUpperCase(), ie = baseIsEmriNo(m.isEmriNo);
    if(t) mbTalep[t] = m; else if(ie) mbIe[ie] = m;
  });
  // Karbür: geri alınan planlar hariç, iş emrine atfedilebilen hareketler
  const iptalPlan = new Set();
  const kh = Object.values(bomRotaVeri.karbur || {});
  kh.forEach(h => { if(h && h.planNo && (h.iptalTs || h.tip === 'iptal')) iptalPlan.add(h.planNo); });
  /* Eski plan biçiminde (tahsis kaydı yokken) iş emrine bağlı 'kesim' kaydı iş emrinin mm'sini
     taşıyor — yalnız o plandan aynı iş emrine tahsis yazılmamışsa sayılır (çift saymasın). */
  const karburIe = {}, eskiKesim = {}, tahsisli = new Set();
  kh.forEach(h => {
    if(!h || !h.isEmriNo || h.iptalTs || (h.planNo && iptalPlan.has(h.planNo))) return;
    const b = karburBaseIsEmri(h.isEmriNo);
    if(h.tip === 'kesim'){ if(h.oncekiAdet == null) (eskiKesim[b] = eskiKesim[b] || []).push(h); return; }
    if(!['tahsis', 'kesimsiz', 'adet_cikis', 'fire_kullanim'].includes(h.tip)) return;
    (karburIe[b] = karburIe[b] || []).push(h);
    tahsisli.add(b + '|' + (h.planNo || ''));
  });
  Object.entries(eskiKesim).forEach(([b, list]) => list.forEach(h => {
    if(!tahsisli.has(b + '|' + (h.planNo || ''))) (karburIe[b] = karburIe[b] || []).push(h);
  }));
  const operatorMalz = list => {
    const e = list.find(x => x.malzemeCinsi || x.capBoy);
    return e ? { kaynak: 'operator', ad: String(e.malzemeCinsi || '').trim() || '(cins yazılmamış)', boy: String(e.capBoy || '').trim() ? String(e.capBoy).trim() + ' (çap×boy)' : '' } : null;
  };

  const liste = bomTamamlananGruplar().map(grp => {
    const { talep, uKodu, ana, zarf, elmas } = grp;
    const dalli = !!(zarf.length || elmas.length);
    const ilk = ana[0] || zarf[0] || elmas[0] || {};
    const adet = Number(ilk.adet) || 0;

    // Çelik hammadde (_ZARF ya da dalsız iş)
    let hammadde = null;
    const sh = (talep && stokTalep[talep]) || (!talep && stokIe[uKodu]) || null;
    if(sh){
      const kalem = {};
      sh.forEach(h => {
        const k = h.itemId || h.itemKod;
        const o = (kalem[k] = kalem[k] || { kod: h.itemKod || '', isim: h.itemIsim || '', miktar: 0, birim: h.birim || '' });
        o.miktar += Math.abs(Number(h.miktar) || 0);
      });
      const kl = Object.values(kalem);
      hammadde = { kaynak: 'stok', ad: kl.map(k => k.isim || k.kod).join(' + '), boy: kl.map(k => bomSayi(k.miktar) + ' ' + k.birim).join(' + ') };
    }
    if(!hammadde){
      const m = (talep && mbTalep[talep]) || mbIe[uKodu] || null;
      if(m) hammadde = { kaynak: 'bekleyen', ad: m.hammaddeKod, boy: m.gerekenMiktar ? bomSayi(m.gerekenMiktar) + ' ' + (m.birim || '') : '' };
    }
    if(!hammadde) hammadde = operatorMalz(dalli ? zarf : ana);
    if(!hammadde && (zarf.length || !dalli)){
      const rc = (hammaddeRecete || {})[uKodu];
      if(rc && rc.hammaddeKod) hammadde = { kaynak: 'recete', ad: rc.hammaddeKod, boy: (Number(rc.birimBasina) > 0 && adet > 0) ? '≈ ' + bomSayi(rc.birimBasina * adet) + ' ' + (rc.birim || '') : '' };
    }

    // Karbür (_ELMAS ya da dalsız iş)
    let karbur = null;
    const hs = karburIe[karburBaseIsEmri(talep || uKodu)] || [];
    if(hs.length){
      const satir = hs.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0)).map(h => {
        const parca = Math.abs(Number(h.parca || h.adet) || 0);
        let boy;
        if(h.tip === 'tahsis') boy = String(h.aciklama || '').replace(/\s*\(.*\)\s*$/, '').trim() || (bomSayi(h.mm) + ' mm');
        else if(h.tip === 'kesimsiz') boy = `${parca} × ${bomSayi(h.boy)} mm (kesimsiz)`;
        else if(h.tip === 'kesim') boy = `${bomSayi(h.mm)} mm`;
        else if(h.tip === 'adet_cikis') boy = `${parca} adet${h.boy ? ' × ' + bomSayi(h.boy) + ' mm' : ''}`;
        else boy = `${bomSayi(h.boy)} mm (fireden)`;
        return { kod: h.kod || '', boy };
      });
      const kodlar = [...new Set(satir.map(s => s.kod).filter(Boolean))];
      karbur = { kaynak: 'karbur', kodlar, ad: kodlar.join(' + '), satir, mm: satir.length > 1 ? hs.reduce((s, h) => s + (Number(h.mm) || 0), 0) : 0 };
      karbur.boy = satir.map(s => (kodlar.length > 1 ? s.kod + ': ' : '') + s.boy).join(' · ');
    } else if(elmas.length){
      const o = operatorMalz(elmas);
      if(o) karbur = { ...o, kodlar: [], mm: 0 };
    }

    const bomVar = dalli
      ? ((!zarf.length || !!hammadde) && (!elmas.length || !!karbur))
      : !!(hammadde || karbur);
    const mamulAdi = (typeof usMamulAdi === 'function' ? usMamulAdi(ilk) : '') || '';
    return { ...grp, dalli, adet, hammadde, karbur, bomVar, mamulAdi,
      zAna: bomRotaZinciri(ana), zZarf: bomRotaZinciri(zarf), zElmas: bomRotaZinciri(elmas) };
  });
  _bomRotaCache = liste; _bomRotaCacheAnahtar = anahtar;
  return liste;
}

const BOM_KAYNAK = {
  stok:     { ad: 'stok çıkışı',     renk: 'var(--success)',    ipucu: 'İlk operasyonda stoktan düşülen kalem — gerçek tüketim' },
  bekleyen: { ad: 'malzeme kaydı',   renk: 'var(--accent)',     ipucu: 'Malzeme bekleyenlerde bu iş emri için seçilen hammadde ve gereken miktar' },
  operator: { ad: 'operatör girişi', renk: 'var(--warn)',       ipucu: 'İş başlatılırken yazılan malzeme cinsi ve çap×boy (serbest metin)' },
  recete:   { ad: 'reçeteden',       renk: 'var(--text-muted)', ipucu: 'Mamulün hammadde reçetesi — bu iş emrine ait kayıt yok, miktar tahmini' },
  karbur:   { ad: 'karbür çıkışı',   renk: 'var(--success)',    ipucu: 'Karbür kesim planından bu iş emrine yapılan çıkış (testere payı dahil boy)' }
};

/* Rota: dallar (üstte _ELMAS, altta _ZARF) → preste birleşme → U kodunun operasyonları → Bitti */
function bomRotaHtml(x){
  const zincir = z => z.map(c => `<span class="route-chip">${esc(c)}</span>`).join('<span class="route-arrow">→</span>');
  const ok = '<span class="route-arrow">→</span>';
  const bitti = '<span class="route-chip bom-bitti">Bitti</span>';
  const son = `<span class="bom-rota">${x.zAna.length ? zincir(x.zAna) + ok : ''}${bitti}</span>`;
  const dallar = [['_ELMAS', x.zElmas], ['_ZARF', x.zZarf]].filter(d => d[1].length);
  if(!dallar.length) return son;
  return `<div class="bom-rota2">
      <div class="bom-dallar">${dallar.map(([ad, z]) => `<div class="bom-dal"><span class="bom-dal-ad">${ad}</span>${zincir(z)}</div>`).join('')}</div>
      ${dallar.length > 1 ? '<span class="bom-birles" title="Preste birleşme"></span>' : ''}${ok}${son}
    </div>`;
}

function renderTamamlananBomRota(){
  bomRotaYukle(false);
  if(!bomRotaVeri.stok || !bomRotaVeri.karbur){
    return `<div style="text-align:center;color:var(--text-muted);padding:40px 0">${bomRotaVeri.hata ? 'Okunamadı: ' + esc(bomRotaVeri.hata) : 'Stok ve karbür hareketleri okunuyor…'}</div>`;
  }
  const tum = bomRotaListesi();
  const tamN = tum.filter(x => x.bomVar).length, karN = tum.filter(x => x.karbur).length;
  const kaynakSay = {}; tum.forEach(x => { if(x.hammadde) kaynakSay[x.hammadde.kaynak] = (kaynakSay[x.hammadde.kaynak] || 0) + 1; });
  const yuzde = tum.length ? Math.round(tamN * 100 / tum.length) : 0;

  const q = (completedSearch || '').trim().toLocaleLowerCase('tr');
  const liste = tum.filter(x => {
    if(bomRotaFiltre === 'tam' && !x.bomVar) return false;
    if(bomRotaFiltre === 'eksik' && x.bomVar) return false;
    if(bomRotaFiltre === 'karburlu' && !x.karbur) return false;
    if(!q) return true;
    const metin = [x.uKodu, x.talep, x.mamulAdi, x.hammadde && x.hammadde.ad, x.karbur && x.karbur.ad, x.zElmas.join(' '), x.zZarf.join(' '), x.zAna.join(' ')].filter(Boolean).join(' ').toLocaleLowerCase('tr');
    return metin.includes(q);
  });

  const kpi = (deger, etiket, alt, f) => `<button type="button" class="bom-kpi ${bomRotaFiltre === f ? 'active' : ''}" onclick="setBomRotaFiltre('${f}')">
      <div class="bom-kpi-deger">${deger}</div><div class="bom-kpi-etiket">${etiket}</div>${alt ? `<div class="bom-kpi-alt">${alt}</div>` : ''}</button>`;
  let h = `<div class="bom-kpi-sira">
      ${kpi(tum.length, 'Tamamlanan iş emri', 'tümü', 'tumu')}
      ${kpi(tamN, 'BOM + rota tam', `%${yuzde}`, 'tam')}
      ${kpi(tum.length - tamN, 'BOM eksik', 'yalnız rota var', 'eksik')}
      ${kpi(karN, 'Karbür kullanılan', '', 'karburlu')}
    </div>
    <div class="bom-kaynak-not">Hammadde kaynağı: ${['stok', 'bekleyen', 'operator', 'recete'].map(k => `<span title="${esc(BOM_KAYNAK[k].ipucu)}"><i style="background:${BOM_KAYNAK[k].renk}"></i>${BOM_KAYNAK[k].ad} ${kaynakSay[k] || 0}</span>`).join('')}
      <button type="button" class="btn-ghost" style="padding:2px 9px;font-size:11px;margin-left:auto" onclick="bomRotaYenile()" title="Stok ve karbür hareketlerini yeniden oku">↻ Yenile</button></div>
    <input id="completed-search-input" class="filter-input completed-search" placeholder="İş emri / CANIAS kodu / hammadde / karbür / makine ara…" value="${esc(completedSearch)}" oninput="setCompletedSearch(this.value)">
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px">${liste.length} iş emri${liste.length > bomRotaLimit ? ` · ilk ${bomRotaLimit} gösteriliyor` : ''}</div>`;
  if(!liste.length) h += `<div style="text-align:center;color:var(--text-muted);padding:40px 0">Bu filtrede kayıt yok.</div>`;

  const satir = (etiket, deger, ek) => `<div class="bom-satir"><span class="bom-et">${etiket}</span><span class="bom-deger">${deger}${ek || ''}</span></div>`;
  const yok = '<span class="bom-yok">— kayıt yok</span>';
  const kaynakEt = m => { const k = m && BOM_KAYNAK[m.kaynak]; return k ? ` <span class="bom-kaynak" style="color:${k.renk};border-color:${k.renk}" title="${esc(k.ipucu)}">${k.ad}</span>` : ''; };
  const hamSatirlari = (m, etAd, etBoy) => satir(etAd, m ? esc(m.ad) : yok, kaynakEt(m))
    + satir(etBoy, m && m.boy ? esc(m.boy) : (m ? '<span class="bom-ikincil">— miktar yazılmamış</span>' : '<span class="bom-ikincil">—</span>'),
      m && m.mm ? ` <span class="bom-ikincil">· toplam ${bomSayi(m.mm)} mm</span>` : '');

  liste.slice(0, bomRotaLimit).forEach(x => {
    let malz = '';
    if(x.dalli){
      if(x.zarf.length) malz += `<div class="bom-dal-bas">_ZARF <span>çelik</span></div>` + hamSatirlari(x.hammadde, 'Kullanılan hammadde', 'Hammadde boyu');
      if(x.elmas.length) malz += `<div class="bom-dal-bas">_ELMAS <span>karbür</span></div>` + hamSatirlari(x.karbur, 'Kullanılan karbür', 'Karbür boyu');
    } else {
      malz += hamSatirlari(x.hammadde, 'Kullanılan hammadde', 'Hammadde boyu');
      if(x.karbur) malz += hamSatirlari(x.karbur, 'Kullanılan karbür', 'Karbür boyu');
    }
    h += `<div class="completed-card bom-kart ${x.bomVar ? '' : 'bom-eksik'}" onclick="openRouteDetail('${escJs(x.uKodu)}', ${x.finishedAt})">
      <div class="completed-header">
        <span class="completed-meta">${x.bomVar ? `<b style="color:var(--success)">${ico('check', 12)} BOM + rota</b>` : '<b style="color:var(--warn)">BOM eksik</b>'} · Tamamlandı: ${fmtDT(x.finishedAt)}${x.adet ? ` · ${x.adet} adet` : ''}</span>
      </div>
      <div class="bom-govde">
        ${satir('CANIAS kodu', `<span class="mono"><b>${esc(x.uKodu)}</b></span>${x.talep ? ` <span class="mono bom-ikincil">· İş emri ${esc(x.talep)}</span>` : ''}${x.mamulAdi ? ` <span class="bom-ikincil">· ${esc(x.mamulAdi)}</span>` : ''}`)}
        ${malz}
        <div class="bom-dal-bas bom-rota-bas"></div>
        ${satir('Rota', bomRotaHtml(x))}
      </div>
    </div>`;
  });
  if(liste.length > bomRotaLimit) h += `<div style="text-align:center;margin:8px 0 20px"><button type="button" class="btn-ghost" onclick="bomRotaDahaFazla()">Daha fazla göster (${liste.length - bomRotaLimit} kaldı)</button></div>`;
  return h;
}
