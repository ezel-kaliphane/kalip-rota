/* ==================== ANALİZ → MAKİNE BAZLI (25.11.2026, kullanıcı isteği) ====================
   "Her makinede seçebileceğim zaman aralığında neler işlenmiş, hangi iş emirleri kullanılmış görebileyim.
   Detaylı olsun." Bir makine + tarih aralığı → özet cümle, rakam kutuları, iş emri bazında tablo (mamul, adet,
   operatörler, net süre, parça başı, durum), günlük döküm, duruş nedenleri, kayıt kayıt tam liste, Excel.
   Kaynak Makine detay penceresiyle AYNI (machineDetailAllRows: üretim + tadilat operasyonları); süreler
   Operatör Günlüğü / Kişi Bazlı ile aynı pencere hesabından (entryNetAraliklar / entryDurusPencere) — aralığa
   taşan işin yalnız aralık içindeki kısmı sayılır. Yeni veri yazılmaz, kural değişmez.
   ADET: aynı iş emri bu makinede birden çok kayıtla geçtiyse (yeniden başlatma, 3+3 → 3) SON kaydın adedi;
   kısmi aktarla bölünmüşse (partiRootId / tadilat kismiAktarlar) parçalar toplanır. */
let mbaMakine = null;            // makine kodu
let mbaBas = null, mbaBit = null; // 'YYYY-MM-DD' (null = son 7 gün)
let mbaAcik = new Set();         // iş emri satırında kayıtları açılmış gruplar
let mbaKayitSayfa = 1;
const MBA_SAYFA = 25;

function mbaVarsayilan(){ const b = new Date(); b.setHours(12, 0, 0, 0); b.setDate(b.getDate() - 6); return [dateKey(b.getTime()), dateKey(Date.now())]; }
function mbaAralik(){ const [vb, vt] = mbaVarsayilan(); let b = mbaBas || vb, t = mbaBit || vt; if(b > t) [b, t] = [t, b]; return [b, t]; }
function mbaSetMakine(c){ mbaMakine = c || null; mbaAcik = new Set(); mbaKayitSayfa = 1; render(); }
function mbaSetBas(v){ mbaBas = v || null; mbaKayitSayfa = 1; render(); }
function mbaSetBit(v){ mbaBit = v || null; mbaKayitSayfa = 1; render(); }
function mbaHazir(k){
  const bugun = new Date(); bugun.setHours(12, 0, 0, 0);
  const g = n => { const d = new Date(bugun); d.setDate(d.getDate() - n); return dateKey(d.getTime()); };
  if(k === 'bugun'){ mbaBas = mbaBit = dateKey(bugun.getTime()); }
  else if(k === '7'){ mbaBas = g(6); mbaBit = dateKey(bugun.getTime()); }
  else if(k === '30'){ mbaBas = g(29); mbaBit = dateKey(bugun.getTime()); }
  else if(k === 'buay'){ const d = new Date(bugun); d.setDate(1); mbaBas = dateKey(d.getTime()); mbaBit = dateKey(bugun.getTime()); }
  else if(k === 'gecenay'){ const d = new Date(bugun); d.setDate(1); d.setMonth(d.getMonth() - 1); mbaBas = dateKey(d.getTime()); const s = new Date(bugun); s.setDate(0); mbaBit = dateKey(s.getTime()); }
  mbaKayitSayfa = 1; render();
}
function mbaGrupToggle(k){ if(mbaAcik.has(k)) mbaAcik.delete(k); else mbaAcik.add(k); render(); }
function mbaSayfaGit(n){ mbaKayitSayfa = n; render(); }

function mbaPencere(bas, bit){
  const d0 = new Date(bas + 'T00:00:00').getTime();
  const d1 = Math.min(new Date(bit + 'T00:00:00').getTime() + 864e5, nowTick);
  return [d0, d1];
}
/* Makinedeki, aralıkla kesişen kayıtlar — pencere içi net / duruş ile */
function mbaKayitlari(code, d0, d1){
  return machineDetailAllRows(code).filter(e => e.startTs < d1 && entryGercekBitis(e) > d0).map(e => {
    const bitis = entryGercekBitis(e), acik = e.status === 'devam' || e.status === 'duruş';
    return { e, netMs: araliklarToplam(entryNetAraliklar(e, d0, d1)), durusMs: entryDurusPencere(e, d0, d1),
      adet: Math.round(Number(e.adet) || 0), acik, bitti: e.status === 'tamamlandi' && bitis > d0 && bitis <= d1,
      tasti: e.startTs < d0 || bitis > d1 };
  });
}
function mbaGrupAnahtari(e){ return e._isTadilat ? 'T:' + (e._tadilatId || e.isEmriNo) : 'U:' + (e.talepNo || '') + '|' + (e.isEmriNo || ''); }
function mbaMamulAdi(e){
  if(e._isTadilat) return e.aciklama || e.malzemeCinsi || 'Tadilat';
  return (typeof isEmriMamulAdi === 'function' ? isEmriMamulAdi(e.talepNo, e.isEmriNo) : '') || e.malzemeCinsi || '';
}
/* Aynı iş emrinin bu makinedeki adedi: yeniden başlatma toplanmaz (son kayıt), kısmi aktar parçaları toplanır */
function mbaGrupAdet(kayitlar){
  const sirali = kayitlar.slice().sort((a, b) => a.e.startTs - b.e.startTs);
  const bolundu = sirali.some(k => k.e.partiRootId) || sirali.some(k => k.e._kismi);
  return bolundu ? sirali.reduce((t, k) => t + k.adet, 0) : (sirali[sirali.length - 1] || {}).adet || 0;
}
function mbaGruplar(kayitlar){
  const tamam = typeof computeCompletedRouteIds === 'function' ? computeCompletedRouteIds() : new Set();
  const m = new Map();
  kayitlar.forEach(k => { const a = mbaGrupAnahtari(k.e); (m.get(a) || m.set(a, []).get(a)).push(k); });
  return [...m.entries()].map(([anahtar, l]) => {
    const e0 = l[0].e, netMs = l.reduce((t, k) => t + k.netMs, 0), adet = mbaGrupAdet(l);
    return { anahtar, kayitlar: l.sort((a, b) => a.e.startTs - b.e.startTs), tadilat: !!e0._isTadilat,
      no: e0._isTadilat ? (e0.isEmriNo || '') : (e0.talepNo || e0.isEmriNo || ''), uKodu: e0._isTadilat ? '' : (e0.isEmriNo || ''),
      ad: mbaMamulAdi(e0), operatorler: [...new Set(l.map(k => k.e.operatorName || k.e.operatorUsername).filter(Boolean))],
      ilk: Math.min(...l.map(k => k.e.startTs)), son: Math.max(...l.map(k => entryGercekBitis(k.e))),
      netMs, durusMs: l.reduce((t, k) => t + k.durusMs, 0), adet,
      acik: l.some(k => k.acik), bitti: l.some(k => k.bitti), rota: l.some(k => tamam.has(k.e.id)),
      tadilatBitti: l.some(k => k.e._isTadilat && k.e._sonOperasyon), tasti: l.some(k => k.tasti),
      e0 };
  }).sort((a, b) => b.ilk - a.ilk);
}
function mbaGunluk(kayitlar, bas, bit){
  const gunler = [];
  for(let d = new Date(bas + 'T12:00:00'); dateKey(d.getTime()) <= bit; d.setDate(d.getDate() + 1)) gunler.push(dateKey(d.getTime()));
  return gunler.map(g => {
    const [g0, g1] = mbaPencere(g, g);
    const l = kayitlar.filter(k => k.e.startTs < g1 && entryGercekBitis(k.e) > g0);
    const netMs = l.reduce((t, k) => t + araliklarToplam(entryNetAraliklar(k.e, g0, g1)), 0);
    const durusMs = l.reduce((t, k) => t + entryDurusPencere(k.e, g0, g1), 0);
    const biten = l.filter(k => k.e.status === 'tamamlandi' && entryGercekBitis(k.e) > g0 && entryGercekBitis(k.e) <= g1);
    const kul = typeof gunKullanilabilirDk === 'function' ? gunKullanilabilirDk(g) : (haftaIciMi(g) ? WORKDAY_MINUTES : 0);
    return { g, kayit: l.length, isSayisi: new Set(l.map(k => mbaGrupAnahtari(k.e))).size, bitenAdet: biten.reduce((t, k) => t + k.adet, 0),
      netMs, durusMs, kulDk: kul, doluluk: kul > 0 ? Math.round(netMs / 6e4 / kul * 100) : null };
  }).filter(x => x.kayit > 0 || x.kulDk > 0);
}
function mbaDurumHtml(x){
  if(x.tadilat) return x.acik ? '<span class="mba-d acik">tadilat devam</span>' : x.tadilatBitti ? '<span class="mba-d bitti">tadilat tamamlandı</span>' : '<span class="mba-d">operasyon bitti</span>';
  if(x.rota) return `<span class="mba-d rota">${ico('check', 11)} rota tamamlandı</span>`;
  if(x.acik) return `<span class="mba-d acik">${x.kayitlar.some(k => k.e.status === 'duruş') ? 'duruşta' : 'devam ediyor'}</span>`;
  return x.bitti ? '<span class="mba-d bitti">bu makinede bitti</span>' : '<span class="mba-d">aralık dışında bitti</span>';
}
function mbaGitAttr(e){
  return e._isTadilat ? (e._tadilatId ? `onclick="openTadilatAkis('${escJs(e._tadilatId)}')" title="Tadilat akışı"` : '')
    : `onclick="openIyGecmisModal('${escJs(e.isEmriNo || '')}','${escJs(e.talepNo || '')}')" title="İş emrinin tüm geçmişi: hangi makinede kim ne zaman"`;
}
function mbaParcaBasi(x){ return x.adet > 0 && x.netMs > 0 ? fmtDur(x.netMs / x.adet) : '—'; }

/* Düzen (25.11.2026, kullanıcı: "çok çirkin olmuş, Makine Matrisi gibi daha kolay seçilebilir olsun, combo box ile
   işin kolayına kaçmışsın"): açılışta makineler MATRİS gibi kart kart — her kartta seçili aralıktaki iş emri / adet /
   net süre; grup çipleri + arama. Karta basınca o makinenin detayı, üstte "← Tüm makineler". Tarih çubuğu ikisinde de. */
let mbaGrup = 'Tümü', mbaArama = '';
function mbaSetGrup(g){ mbaGrup = g; render(); }
function mbaSetArama(v){ mbaArama = v; render(); setTimeout(() => { const el = document.getElementById('mba-arama'); if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0); }
function mbaOzet(code, d0, d1){
  const k = mbaKayitlari(code, d0, d1), g = mbaGruplar(k);
  return { kayit: k.length, is: g.filter(x => !x.tadilat).length, tad: g.filter(x => x.tadilat).length,
    adet: g.filter(x => !x.tadilat).reduce((t, x) => t + x.adet, 0), netMs: k.reduce((t, x) => t + x.netMs, 0),
    acik: k.some(x => x.acik && x.e.status === 'devam') };
}
function mbaTarihCubugu(bas, bit){
  const bugun = dateKey(Date.now()), [vb, vt] = mbaVarsayilan();
  const hazir = [['bugun', 'Bugün', bugun, bugun], ['7', 'Son 7 gün', vb, vt], ['30', 'Son 30 gün'], ['buay', 'Bu ay'], ['gecenay', 'Geçen ay']];
  const aktif = k => { if(k === 'bugun') return bas === bugun && bit === bugun; if(k === '7') return bas === vb && bit === vt; return false; };
  return `<div class="mba-tarih-cubuk">
    <div class="mba-hazir">${hazir.map(([k, l]) => `<button class="chip ${aktif(k) ? 'active' : ''}" onclick="mbaHazir('${k}')">${l}</button>`).join('')}</div>
    <div class="mba-tarih"><input type="date" value="${esc(bas)}" max="${esc(bugun)}" onchange="mbaSetBas(this.value)" aria-label="Başlangıç"><span>–</span><input type="date" value="${esc(bit)}" max="${esc(bugun)}" onchange="mbaSetBit(this.value)" aria-label="Bitiş"></div>
  </div>`;
}
function renderAnalizMakineBazli(){
  const [bas, bit] = mbaAralik(), [d0, d1] = mbaPencere(bas, bit);
  const aralikYazi = bas === bit ? ogTarihYazi(bas) : `${ogTarihYazi(bas, true)} – ${ogTarihYazi(bit, true)}`;
  const makineler = allMachines();
  if(mbaMakine && !makineler.some(m => m.code === mbaMakine)) mbaMakine = null;
  const tarih = mbaTarihCubugu(bas, bit);
  const iyModal = typeof iyGecmisModalIsEmriNo !== 'undefined' && iyGecmisModalIsEmriNo && typeof renderIyGecmisModal === 'function' ? renderIyGecmisModal() : '';

  /* ---------- 1) Makine seçimi: matris kartları ---------- */
  if(!mbaMakine){
    const ozet = {}; makineler.forEach(m => { ozet[m.code] = mbaOzet(m.code, d0, d1); });
    const gruplar = ['Tümü', ...MACHINE_GROUPS.map(g => g.name), 'Diğer'];
    const q = mbaArama.trim().toLocaleLowerCase('tr-TR');
    const gorunen = makineler.filter(m => (mbaGrup === 'Tümü' || machineGroupOf(m.code) === mbaGrup)
        && (!q || `${m.code} ${m.name || ''}`.toLocaleLowerCase('tr-TR').includes(q)))
      .sort((a, b) => (ozet[b.code].kayit > 0) - (ozet[a.code].kayit > 0) || String(a.code).localeCompare(String(b.code), 'tr', { numeric: true }));
    const calisan = makineler.filter(m => ozet[m.code].kayit > 0).length;
    const topIs = makineler.reduce((t, m) => t + ozet[m.code].is, 0), topAdet = makineler.reduce((t, m) => t + ozet[m.code].adet, 0);
    const kart = m => {
      const o = ozet[m.code], var_ = o.kayit > 0;
      return `<div class="matrix-card mba-kart${var_ ? '' : ' bos'}" onclick="mbaSetMakine('${escJs(m.code)}')" title="${esc(m.code)} · ${esc(m.name || '')} — detayı aç">
        <div class="matrix-card-top"><span class="matrix-code">${esc(m.code)}</span>${o.acik ? `<span class="matrix-tag" style="--sb:var(--success)">çalışıyor</span>` : ''}</div>
        <div class="matrix-name">${esc(m.name || '')}</div>
        ${var_ ? `<div class="mba-kart-say"><b>${o.is}</b> iş emri${o.tad ? ` · <b>${o.tad}</b> tadilat` : ''}</div>
          <div class="mba-kart-say">${o.adet ? `<b>${ogAdetYazi(o.adet)}</b> adet · ` : ''}net <b>${fmtDur(o.netMs)}</b></div>`
          : `<div class="mba-kart-say bos">Bu aralıkta kayıt yok</div>`}
      </div>`;
    };
    return `<div class="mba-wrap">
      ${tarih}
      <div class="og-cumle">${aralikYazi}: <b>${calisan}</b> makinede kayıt var, toplam <b>${topIs}</b> iş emri, <b>${ogAdetYazi(topAdet)}</b> adet. Detay için makineye bas.</div>
      <div class="matrix-toolbar" style="margin:0">
        <div style="display:flex;flex-wrap:wrap;gap:6px">${gruplar.map(g => `<button class="chip ${mbaGrup === g ? 'active' : ''}" onclick="mbaSetGrup('${escJs(g)}')">${esc(g)}</button>`).join('')}</div>
        <label class="stok-top-search" style="max-width:240px">${ico('search', 14)}<input id="mba-arama" placeholder="Kod veya ad ile süz…" value="${esc(mbaArama)}" oninput="mbaSetArama(this.value)"></label>
      </div>
      <div class="matrix-grid mba-grid">${gorunen.map(kart).join('') || `<div class="og-bos">Aramaya uyan makine yok.</div>`}</div>
    </div>${iyModal}`;
  }

  /* ---------- 2) Seçili makinenin detayı ---------- */
  const m = makineler.find(x => x.code === mbaMakine);
  const kayitlar = mbaKayitlari(m.code, d0, d1), gruplar = mbaGruplar(kayitlar), gunluk = mbaGunluk(kayitlar, bas, bit);
  const netMs = kayitlar.reduce((t, k) => t + k.netMs, 0), durusMs = kayitlar.reduce((t, k) => t + k.durusMs, 0);
  const uretim = gruplar.filter(x => !x.tadilat), tadilat = gruplar.filter(x => x.tadilat);
  const adet = uretim.reduce((t, x) => t + x.adet, 0), tadAdet = tadilat.reduce((t, x) => t + x.adet, 0);
  const kulDk = gunluk.reduce((t, x) => t + x.kulDk, 0), doluluk = kulDk > 0 ? Math.round(netMs / 6e4 / kulDk * 100) : null;
  const operatorler = [...new Set(kayitlar.map(k => k.e.operatorName || k.e.operatorUsername).filter(Boolean))];
  const enUzun = uretim.slice().sort((a, b) => b.netMs - a.netMs)[0];
  const isler = [uretim.length ? `<b>${uretim.length}</b> iş emri (<b>${ogAdetYazi(adet)}</b> adet)` : '', tadilat.length ? `<b>${tadilat.length}</b> tadilat (${ogAdetYazi(tadAdet)} adet)` : ''].filter(Boolean).join(' ve ');
  const cumle = !kayitlar.length ? `${aralikYazi}: bu makinede kayıt yok.`
    : `${aralikYazi}: ${isler} işlendi. Net çalışma <b>${fmtDur(netMs)}</b>${durusMs > 0 ? `, duruş <b style="color:var(--warn)">${fmtDur(durusMs)}</b>` : ''}${doluluk != null ? `, mesaiye göre doluluk <b>%${doluluk}</b>` : ''}.${operatorler.length ? ` Çalışan: ${operatorler.map(esc).join(', ')}.` : ''}${enUzun ? ` En uzun süren iş emri <b>${esc(enUzun.no)}</b> (${fmtDur(enUzun.netMs)}).` : ''}`;
  const kutu = (n, l, renk) => `<div class="mba-kutu"><div class="mba-kutu-n"${renk ? ` style="color:${renk}"` : ''}>${n}</div><div class="mba-kutu-l">${l}</div></div>`;
  const kutular = `<div class="mba-kutular">
    ${uretim.length ? kutu(uretim.length, 'İş emri') + kutu(ogAdetYazi(adet), 'Adet') : ''}${tadilat.length ? kutu(tadilat.length, 'Tadilat') : ''}
    ${kutu(fmtDur(netMs), 'Net çalışma')}${kutu(durusMs > 0 ? fmtDur(durusMs) : '—', 'Duruş', durusMs > 0 ? 'var(--warn)' : '')}
    ${doluluk != null ? kutu('%' + doluluk, 'Doluluk (mesai)', doluluk >= 70 ? 'var(--success)' : doluluk >= 40 ? 'var(--warn)' : 'var(--danger)') : ''}${kutu(kayitlar.length, 'Kayıt')}
  </div>`;
  /* Sırayla önceki / sonraki makine (kayıtlı olanlar arasında) — tek tek bakarken listeye dönmeden */
  const sira = makineler.slice().sort((a, b) => String(a.code).localeCompare(String(b.code), 'tr', { numeric: true }));
  const i = sira.findIndex(x => x.code === m.code), onceki = sira[(i - 1 + sira.length) % sira.length], sonraki = sira[(i + 1) % sira.length];
  const bas_ = `<div class="mba-bas">
    <button class="btn-ghost mb-mini" onclick="mbaSetMakine(null)">← Tüm makineler</button>
    <div class="mba-bas-ad"><span class="matrix-code">${esc(m.code)}</span><span>${esc(m.name || '')}</span></div>
    <div class="mba-bas-gec">
      <button class="btn-ghost mb-mini" onclick="mbaSetMakine('${escJs(onceki.code)}')" title="${esc(onceki.code)}">‹ ${esc(onceki.code)}</button>
      <button class="btn-ghost mb-mini" onclick="mbaSetMakine('${escJs(sonraki.code)}')" title="${esc(sonraki.code)}">${esc(sonraki.code)} ›</button>
    </div>
  </div>`;

  const isTablo = `<div class="mba-bolum"><div class="mba-bolum-bas"><b>İş emirleri</b><span class="mba-alt">satıra bas: bu makinedeki kayıtlar · numaraya bas: iş emrinin tüm geçmişi</span></div>
  <div class="table-wrap mba-tablo" style="padding:0"><table><thead><tr>
    <th></th><th>İş emri</th><th>Mamul / iş</th><th class="sag">Adet</th><th>Operatör</th><th>Başladı</th><th>Bitti</th><th class="sag">Net</th><th class="sag">Parça başı</th><th class="sag">Duruş</th><th>Durum</th>
  </tr></thead><tbody>
  ${gruplar.length ? gruplar.map(x => {
    const acik = mbaAcik.has(x.anahtar);
    return `<tr class="mba-grup${x.tadilat ? ' tad' : ''}" onclick="mbaGrupToggle('${escJs(x.anahtar)}')">
      <td class="mba-ok">${x.kayitlar.length > 1 ? (acik ? '▾' : '▸') : ''}</td>
      <td class="mono"><a class="mba-no" ${mbaGitAttr(x.e0).replace('onclick="', 'onclick="event.stopPropagation(); ')}>${x.tadilat ? `${ico('wrench', 12)} ` : ''}${esc(x.no || '—')}</a>${x.uKodu && x.uKodu !== x.no ? `<div class="mba-u">${esc(x.uKodu)}</div>` : ''}</td>
      <td class="mba-ad" title="${esc(x.ad)}">${esc(x.ad || '—')}</td>
      <td class="mono sag"><b>${x.adet ? ogAdetYazi(x.adet) : '—'}</b></td>
      <td class="mba-kisi">${x.operatorler.map(esc).join(', ')}</td>
      <td class="mono mba-ts">${fmtDT(x.ilk)}</td>
      <td class="mono mba-ts">${x.acik ? '<span class="mba-d acik">sürüyor</span>' : fmtDT(x.son)}</td>
      <td class="mono sag">${fmtDur(x.netMs)}${x.tasti ? '<span class="mba-tasti" title="İş aralığın dışına taşıyor — yalnız aralık içindeki süre sayıldı">*</span>' : ''}</td>
      <td class="mono sag">${mbaParcaBasi(x)}</td>
      <td class="mono sag"${x.durusMs > 0 ? ' style="color:var(--warn)"' : ''}>${x.durusMs > 0 ? fmtDur(x.durusMs) : '—'}</td>
      <td>${mbaDurumHtml(x)}${x.kayitlar.length > 1 ? ` <span class="mba-alt">· ${x.kayitlar.length} kayıt</span>` : ''}</td>
    </tr>${acik ? x.kayitlar.map(k => mbaKayitSatiri(k, true)).join('') : ''}`;
  }).join('') : `<tr><td colspan="11" class="og-bos">Bu aralıkta iş yok.</td></tr>`}
  </tbody></table></div>
  ${gruplar.some(x => x.tasti) ? `<div class="mba-alt" style="margin-top:6px">* İş seçilen aralığın dışına taşıyor; net süre yalnız aralık içindeki kısım.</div>` : ''}</div>`;

  const gunTablo = gunluk.filter(x => x.kayit).length > 1 ? `<div class="mba-bolum"><div class="mba-bolum-bas"><b>Günlük döküm</b></div>
  <div class="table-wrap mba-tablo" style="padding:0"><table><thead><tr><th>Gün</th><th class="sag">Kayıt</th><th class="sag">İş emri</th><th class="sag">Biten adet</th><th class="sag">Net</th><th class="sag">Duruş</th><th class="sag">Doluluk</th></tr></thead><tbody>
  ${gunluk.slice().reverse().map(x => `<tr${x.kayit ? '' : ' class="mba-sonuk"'}>
    <td>${esc(ogTarihYazi(x.g, true))}</td><td class="mono sag">${x.kayit || '—'}</td><td class="mono sag">${x.isSayisi || '—'}</td>
    <td class="mono sag">${x.bitenAdet ? ogAdetYazi(x.bitenAdet) : '—'}</td><td class="mono sag">${x.netMs ? fmtDur(x.netMs) : '—'}</td>
    <td class="mono sag"${x.durusMs ? ' style="color:var(--warn)"' : ''}>${x.durusMs ? fmtDur(x.durusMs) : '—'}</td>
    <td class="mono sag">${x.doluluk == null ? '<span class="mba-alt">hafta sonu</span>' : `<span style="color:${x.doluluk >= 70 ? 'var(--success)' : x.doluluk >= 40 ? 'var(--warn)' : 'var(--danger)'};font-weight:700">%${x.doluluk}</span>`}</td>
  </tr>`).join('')}
  </tbody></table></div></div>` : '';

  const sirali = kayitlar.slice().sort((a, b) => b.e.startTs - a.e.startTs);
  const toplamSayfa = Math.max(1, Math.ceil(sirali.length / MBA_SAYFA)), sayfa = Math.min(Math.max(1, mbaKayitSayfa), toplamSayfa);
  const kayitTablo = kayitlar.length ? `<div class="mba-bolum"><div class="mba-bolum-bas"><b>Tüm kayıtlar</b><span class="mba-alt">${(sayfa - 1) * MBA_SAYFA + 1}–${Math.min(sayfa * MBA_SAYFA, sirali.length)} / ${sirali.length}</span>
    <button class="btn-ghost mb-mini" style="margin-left:auto" onclick="mbaExcel()">⬇ Excel'e aktar</button></div>
  <div class="table-wrap mba-tablo" style="padding:0"><table><thead><tr>
    <th>Başladı</th><th>Bitti</th><th>İş emri</th><th>Mamul / iş</th><th class="sag">Adet</th><th>Operatör</th><th class="sag">Net</th><th class="sag">Duruş</th><th>Durum</th>
  </tr></thead><tbody>${sirali.slice((sayfa - 1) * MBA_SAYFA, sayfa * MBA_SAYFA).map(k => mbaKayitSatiri(k, false)).join('')}</tbody></table></div>
  ${toplamSayfa > 1 ? `<div class="mba-sayfa">${Array.from({ length: toplamSayfa }, (_, n) => n + 1).map(n => `<button class="chip ${n === sayfa ? 'active' : ''}" onclick="mbaSayfaGit(${n})">${n}</button>`).join('')}</div>` : ''}</div>` : '';

  const durus = kayitlar.length && typeof renderDurusBreakdown === 'function' ? renderDurusBreakdown(kayitlar.map(k => k.e)) : '';
  return `<div class="mba-wrap">${tarih}${bas_}<div class="og-cumle">${cumle}</div>${kayitlar.length ? kutular : ''}${isTablo}${durus}${gunTablo}${kayitTablo}</div>${iyModal}`;
}
function mbaKayitSatiri(k, ic){
  const e = k.e;
  const durum = e._isTadilat ? (e.status === 'tamamlandi' ? (e._sonOperasyon ? 'Tadilat tamamlandı' : 'Operasyon bitti') : 'Tadilat devam')
    : e.status === 'devam' ? 'Devam ediyor' : e.status === 'duruş' ? `Duruşta${e.duruşNedeni ? ' · ' + e.duruşNedeni : ''}` : 'Tamamlandı';
  if(ic) return `<tr class="mba-ic"><td></td><td class="mono mba-ts" colspan="2">${fmtDT(e.startTs)} → ${e.endTs ? fmtDT(e.endTs) : 'şimdi'}</td>
    <td class="mono sag">${k.adet || '—'}</td><td class="mba-kisi">${esc(e.operatorName || e.operatorUsername || '')}</td><td colspan="2"></td>
    <td class="mono sag">${fmtDur(k.netMs)}</td><td></td><td class="mono sag"${k.durusMs ? ' style="color:var(--warn)"' : ''}>${k.durusMs ? fmtDur(k.durusMs) : '—'}</td><td>${esc(durum)}</td></tr>`;
  const no = e._isTadilat ? (e.isEmriNo || '') : (e.talepNo || e.isEmriNo || '');
  return `<tr><td class="mono mba-ts">${fmtDT(e.startTs)}</td><td class="mono mba-ts">${e.endTs ? fmtDT(e.endTs) : '<span class="mba-d acik">sürüyor</span>'}</td>
    <td class="mono"><a class="mba-no" ${mbaGitAttr(e)}>${e._isTadilat ? `${ico('wrench', 12)} ` : ''}${esc(no || '—')}</a></td>
    <td class="mba-ad" title="${esc(mbaMamulAdi(e))}">${esc(mbaMamulAdi(e) || '—')}</td><td class="mono sag">${k.adet || '—'}</td>
    <td class="mba-kisi">${esc(e.operatorName || e.operatorUsername || '')}</td><td class="mono sag">${fmtDur(k.netMs)}</td>
    <td class="mono sag"${k.durusMs ? ' style="color:var(--warn)"' : ''}>${k.durusMs ? fmtDur(k.durusMs) : '—'}</td><td class="mba-durum-y">${esc(durum)}</td></tr>`;
}
async function mbaExcel(){
  const [bas, bit] = mbaAralik(), [d0, d1] = mbaPencere(bas, bit);
  const m = allMachines().find(x => x.code === mbaMakine); if(!m){ toast('Makine seçin'); return; }
  if(!(await ensureXLSX())) return;
  const kayitlar = mbaKayitlari(m.code, d0, d1).sort((a, b) => a.e.startTs - b.e.startTs);
  const gruplar = mbaGruplar(kayitlar);
  const ws1 = XLSX.utils.json_to_sheet(gruplar.map(x => ({
    'Tür': x.tadilat ? 'Tadilat' : 'Üretim', 'İş Talep No': x.tadilat ? '' : x.no, 'U Kodu': x.tadilat ? x.no : x.uKodu, 'Mamul / İş': x.ad, 'Adet': x.adet || '',
    'Operatör(ler)': x.operatorler.join(', '), 'Kayıt': x.kayitlar.length, 'İlk Başlama': new Date(x.ilk), 'Son Bitiş': x.acik ? '' : new Date(x.son),
    'Net (dk, aralıkta)': Math.round(x.netMs / 6e4), 'Parça Başı (dk)': x.adet > 0 && x.netMs > 0 ? Math.round(x.netMs / x.adet / 6e4 * 10) / 10 : '',
    'Duruş (dk, aralıkta)': Math.round(x.durusMs / 6e4),
    'Durum': x.tadilat ? (x.acik ? 'Tadilat devam' : x.tadilatBitti ? 'Tadilat tamamlandı' : 'Operasyon bitti') : x.rota ? 'Rota tamamlandı' : x.acik ? 'Devam ediyor' : 'Bitti'
  })));
  const ws2 = XLSX.utils.json_to_sheet(kayitlar.map(k => { const e = k.e; return {
    'Tür': e._isTadilat ? 'Tadilat' : 'Üretim', 'İş Talep No': e._isTadilat ? '' : (e.talepNo || ''), 'U Kodu': e.isEmriNo || '', 'Mamul / İş': mbaMamulAdi(e), 'Adet': k.adet || '',
    'Operatör': `${e.operatorUsername || ''} · ${e.operatorName || ''}`, 'Başlangıç': new Date(e.startTs), 'Bitiş': e.endTs ? new Date(e.endTs) : '',
    'Net (dk, aralıkta)': Math.round(k.netMs / 6e4), 'Duruş (dk, aralıkta)': Math.round(k.durusMs / 6e4),
    'Durum': e._isTadilat ? (e.status === 'tamamlandi' ? (e._sonOperasyon ? 'Tadilat tamamlandı' : 'Operasyon bitti') : 'Tadilat devam') : (e.status === 'devam' ? 'Devam ediyor' : e.status === 'duruş' ? 'Duruşta' : 'Tamamlandı'),
    'Duruş Nedeni': e.duruşNedeni || '', 'Not': e.not || ''
  }; }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'İş emirleri');
  XLSX.utils.book_append_sheet(wb, ws2, 'Kayıtlar');
  XLSX.writeFile(wb, `${m.code}_${bas}_${bit}.xlsx`);
}
