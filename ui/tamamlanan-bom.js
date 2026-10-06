/* ==================== TAMAMLANAN KODLAR → BOM + ROTA (06.10.2026, kullanıcı isteği) ====================
   "Tamamlanan kodlarda görmek istiyorum: CANIAS kodu, kullanılan hammadde ve boyu, varsa kullanılan
   karbür ve boyu, rota x → y → … → bitti; kaç tanesinde hem BOM hem rota var, ekranda yazsın."
   Her tamamlanmış iş emri (computeCompletedRoutes) için kayıtlardan BOM toplanır. Hammadde kaynağı
   en güvenilirden başlayarak:
     1) stok çıkışı   — stockHareketleri (ilk operasyonda stoktan düşülen kalem, gerçek tüketim)
     2) malzeme bekleyen kaydı — şefin o iş emri için seçtiği hammadde ve gereken miktar
     3) operatör girişi — iş başlatırken yazılan malzeme cinsi / çap×boy (serbest metin)
     4) reçete — hammaddeRecete'deki mamul eşlemesi (tahmini; miktar = birim başına × adet)
   Karbür: karburHareketleri (tahsis / kesimsiz / adet çıkışı / fireden), geri alınan planlar hariç;
   iş emri CANIAS iş emri numarasıyla (talepNo) eşlenir. _ZARF (çelik gövde) dalına karbür yazılmaz.
   "BOM var": _ELMAS dalında karbür, diğerlerinde hammadde ya da karbür bulunması. Rota her tamamlanan
   kayıtta zaten var. Veri ekran açılınca BİR KEZ okunur (canlı dinleyici yok, ↻ ile yenilenir). */

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
function bomTalep(r){ return String((r.entries.find(e => e.talepNo) || {}).talepNo || '').trim().toUpperCase(); }

/* Rota zinciri: makine kodları başlangıç sırasıyla; art arda aynı makine (bölünmüş parti,
   duraklat-devam) tek halka sayılır. */
function bomRotaZinciri(r){
  const z = [];
  r.entries.slice().sort((a, b) => (a.startTs || 0) - (b.startTs || 0)).forEach(e => {
    const m = String(e.makine || '').split(' · ')[0] || '—';
    if(z[z.length - 1] !== m) z.push(m);
  });
  return z;
}

function bomRotaListesi(){
  const routes = computeCompletedRoutes();
  const anahtar = [routes, bomRotaVeri.ts, malzemeBekleyen, hammaddeRecete];
  if(_bomRotaCache && _bomRotaCacheAnahtar && anahtar.every((x, i) => x === _bomRotaCacheAnahtar[i])) return _bomRotaCache;

  // Stok çıkışları: talep no ile (yoksa iş emri/U kodu ile) — kalem başına toplanır
  const stokTalep = {}, stokIe = {};
  Object.values(bomRotaVeri.stok || {}).forEach(h => {
    if(!h || !(Number(h.miktar) < 0)) return;
    const t = String(h.talepNo || '').trim().toUpperCase(), ie = String(h.isEmriNo || '').trim().toUpperCase();
    if(t) (stokTalep[t] = stokTalep[t] || []).push(h);
    else if(ie) (stokIe[ie] = stokIe[ie] || []).push(h);
  });
  // Malzeme bekleyen kayıtları
  const mbTalep = {}, mbIe = {};
  Object.values(malzemeBekleyen || {}).forEach(m => {
    if(!m || !m.hammaddeKod) return;
    const t = String(m.talepNo || '').trim().toUpperCase(), ie = String(m.isEmriNo || '').trim().toUpperCase();
    if(t) mbTalep[t] = m; else if(ie) mbIe[ie] = m;
  });
  // Karbür: geri alınan planlar hariç, iş emrine atfedilebilen hareketler
  const iptalPlan = new Set();
  const kh = Object.values(bomRotaVeri.karbur || {});
  kh.forEach(h => { if(h && h.planNo && (h.iptalTs || h.tip === 'iptal')) iptalPlan.add(h.planNo); });
  const karburIe = {};
  kh.forEach(h => {
    if(!h || !h.isEmriNo || h.iptalTs || (h.planNo && iptalPlan.has(h.planNo))) return;
    if(!['tahsis', 'kesimsiz', 'adet_cikis', 'fire_kullanim'].includes(h.tip)) return;
    const b = karburBaseIsEmri(h.isEmriNo);
    (karburIe[b] = karburIe[b] || []).push(h);
  });

  const liste = routes.filter(r => baseIsEmriNo(r.isEmriNo) !== TEST_ISEMRI_NO).map(r => {
    const talep = bomTalep(r), ie = String(r.isEmriNo || '').toUpperCase(), uKodu = baseIsEmriNo(ie);
    const bilesen = bilesenOfCode(ie);
    const adet = Number((r.entries[0] || {}).adet) || 0;

    let hammadde = null;
    const sh = (talep && stokTalep[talep]) || (!talep && stokIe[ie]) || null;
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
      const m = (talep && mbTalep[talep]) || mbIe[ie] || null;
      if(m) hammadde = { kaynak: 'bekleyen', ad: m.hammaddeKod, boy: m.gerekenMiktar ? bomSayi(m.gerekenMiktar) + ' ' + (m.birim || '') : '' };
    }
    if(!hammadde){
      const e = r.entries.find(x => x.malzemeCinsi || x.capBoy);
      if(e) hammadde = { kaynak: 'operator', ad: String(e.malzemeCinsi || '').trim() || '(cins yazılmamış)', boy: String(e.capBoy || '').trim() ? String(e.capBoy).trim() + ' (çap×boy)' : '' };
    }
    if(!hammadde && bilesen !== 'ELMAS'){
      const rc = (hammaddeRecete || {})[uKodu];
      if(rc && rc.hammaddeKod) hammadde = { kaynak: 'recete', ad: rc.hammaddeKod, boy: (Number(rc.birimBasina) > 0 && adet > 0) ? '≈ ' + bomSayi(rc.birimBasina * adet) + ' ' + (rc.birim || '') : '' };
    }

    let karbur = null;
    if(bilesen !== 'ZARF'){
      const hs = karburIe[karburBaseIsEmri(talep || uKodu)] || [];
      if(hs.length){
        const satir = hs.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0)).map(h => {
          const parca = Math.abs(Number(h.parca || h.adet) || 0);
          let boy;
          if(h.tip === 'tahsis') boy = String(h.aciklama || '').replace(/\s*\(.*\)\s*$/, '').trim() || (bomSayi(h.mm) + ' mm');
          else if(h.tip === 'kesimsiz') boy = `${parca} × ${bomSayi(h.boy)} mm (kesimsiz)`;
          else if(h.tip === 'adet_cikis') boy = `${parca} adet${h.boy ? ' × ' + bomSayi(h.boy) + ' mm' : ''}`;
          else boy = `${bomSayi(h.boy)} mm (fireden)`;
          return { kod: h.kod || '', boy };
        });
        const kodlar = [...new Set(satir.map(s => s.kod).filter(Boolean))];
        karbur = { kodlar, satir, mm: hs.reduce((s, h) => s + (Number(h.mm) || 0), 0), parca: hs.reduce((s, h) => s + (Number(h.parca) || 0), 0) };
      }
    }
    const bomVar = bilesen === 'ELMAS' ? !!karbur : !!(hammadde || karbur);
    return { r, talep, uKodu, bilesen, adet, hammadde, karbur, bomVar, zincir: bomRotaZinciri(r),
      mamulAdi: (typeof usMamulAdi === 'function' ? usMamulAdi(r.entries[0] || {}) : '') || '' };
  });
  _bomRotaCache = liste; _bomRotaCacheAnahtar = anahtar;
  return liste;
}

const BOM_KAYNAK = {
  stok:     { ad: 'stok çıkışı',     renk: 'var(--success)',    ipucu: 'İlk operasyonda stoktan düşülen kalem — gerçek tüketim' },
  bekleyen: { ad: 'malzeme kaydı',   renk: 'var(--accent)',     ipucu: 'Malzeme bekleyenlerde bu iş emri için seçilen hammadde ve gereken miktar' },
  operator: { ad: 'operatör girişi', renk: 'var(--warn)',       ipucu: 'İş başlatılırken yazılan malzeme cinsi ve çap×boy (serbest metin)' },
  recete:   { ad: 'reçeteden',       renk: 'var(--text-muted)', ipucu: 'Mamulün hammadde reçetesi — bu iş emrine ait kayıt yok, miktar tahmini' }
};

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
    const metin = [x.r.isEmriNo, x.talep, x.mamulAdi, x.hammadde && x.hammadde.ad, x.karbur && x.karbur.kodlar.join(' '), x.zincir.join(' ')].filter(Boolean).join(' ').toLocaleLowerCase('tr');
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
    <div class="bom-kaynak-not">Hammadde kaynağı: ${Object.keys(BOM_KAYNAK).map(k => `<span title="${esc(BOM_KAYNAK[k].ipucu)}"><i style="background:${BOM_KAYNAK[k].renk}"></i>${BOM_KAYNAK[k].ad} ${kaynakSay[k] || 0}</span>`).join('')}
      <button type="button" class="btn-ghost" style="padding:2px 9px;font-size:11px;margin-left:auto" onclick="bomRotaYenile()" title="Stok ve karbür hareketlerini yeniden oku">↻ Yenile</button></div>
    <input id="completed-search-input" class="filter-input completed-search" placeholder="İş emri / CANIAS kodu / hammadde / karbür / makine ara…" value="${esc(completedSearch)}" oninput="setCompletedSearch(this.value)">
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px">${liste.length} kayıt${liste.length > bomRotaLimit ? ` · ilk ${bomRotaLimit} gösteriliyor` : ''}</div>`;
  if(!liste.length) h += `<div style="text-align:center;color:var(--text-muted);padding:40px 0">Bu filtrede kayıt yok.</div>`;

  liste.slice(0, bomRotaLimit).forEach(x => {
    const k = x.hammadde ? BOM_KAYNAK[x.hammadde.kaynak] : null;
    const satir = (etiket, deger, ek) => `<div class="bom-satir"><span class="bom-et">${etiket}</span><span class="bom-deger">${deger}${ek || ''}</span></div>`;
    const yok = '<span class="bom-yok">— kayıt yok</span>';
    h += `<div class="completed-card bom-kart ${x.bomVar ? '' : 'bom-eksik'}" onclick="openRouteDetail('${escJs(x.r.isEmriNo)}', ${x.r.finishedAt})">
      <div class="completed-header">
        <span class="completed-meta">${x.bomVar ? `<b style="color:var(--success)">${ico('check', 12)} BOM + rota</b>` : '<b style="color:var(--warn)">BOM eksik</b>'} · Tamamlandı: ${fmtDT(x.r.finishedAt)}${x.adet ? ` · ${x.adet} adet` : ''}</span>
      </div>
      <div class="bom-govde">
        ${satir('CANIAS kodu', `<span class="mono"><b>${esc(x.uKodu)}</b></span>${x.bilesen ? ` <span class="bom-bilesen">${esc(BILESEN_LABEL[x.bilesen] || x.bilesen)}</span>` : ''}${x.talep ? ` <span class="mono bom-ikincil">· İş emri ${esc(x.talep)}</span>` : ''}${x.mamulAdi ? ` <span class="bom-ikincil">· ${esc(x.mamulAdi)}</span>` : ''}`)}
        ${satir('Kullanılan hammadde', x.hammadde ? esc(x.hammadde.ad) : (x.bilesen === 'ELMAS' ? '<span class="bom-ikincil">— (karbür dalı)</span>' : yok),
            k ? ` <span class="bom-kaynak" style="color:${k.renk};border-color:${k.renk}" title="${esc(k.ipucu)}">${k.ad}</span>` : '')}
        ${satir('Hammadde boyu', x.hammadde && x.hammadde.boy ? esc(x.hammadde.boy) : (x.hammadde ? '<span class="bom-ikincil">— miktar yazılmamış</span>' : '<span class="bom-ikincil">—</span>'))}
        ${x.karbur ? satir('Kullanılan karbür', `<span class="mono">${esc(x.karbur.kodlar.join(' + ') || '—')}</span>`) : ''}
        ${x.karbur ? satir('Karbür boyu', esc(x.karbur.satir.map(s => (x.karbur.kodlar.length > 1 ? s.kod + ': ' : '') + s.boy).join(' · ')), x.karbur.mm ? ` <span class="bom-ikincil">· toplam ${bomSayi(x.karbur.mm)} mm</span>` : '') : ''}
        ${satir('Rota', `<span class="route-chain bom-rota">${x.zincir.map(c => `<span class="route-chip">${esc(c)}</span><span class="route-arrow">→</span>`).join('')}<span class="route-chip bom-bitti">Bitti</span></span>`)}
      </div>
    </div>`;
  });
  if(liste.length > bomRotaLimit) h += `<div style="text-align:center;margin:8px 0 20px"><button type="button" class="btn-ghost" onclick="bomRotaDahaFazla()">Daha fazla göster (${liste.length - bomRotaLimit} kaldı)</button></div>`;
  return h;
}
