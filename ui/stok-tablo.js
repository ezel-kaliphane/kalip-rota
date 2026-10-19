/* ==================== STOK TABLOLARI — GÖRÜNÜM / YÖNETİM (19.10.2026, kullanıcı isteği) ====================
   "Hammadde ve takım dolaplarındaki tablolar çok anlaşılması güç, aradığını bulmak zor." + "İkisini ayırmak
   lazım: 1) şefin ve diğer adminlerin gördüğü 2) SuperAdmin'in gördüğü ve stoğu değiştirebildiği yer."
   Taslak: Claude Artifact "Stok Tabloları Taslağı" (1 okuma/düzenleme ayrı, 2 sütunlar ne-nerede-kaç,
   3 stok renkli). Ölçüm (19.10): takım tablosu 13 sütun / 1.356 px idi, Stok sütunu ekran dışındaydı;
   hammaddede her kalem ~85 px kart, ekrana 4 kalem sığıyordu.
   - GÖRÜNÜM (herkes, SuperAdmin dahil varsayılan): tek satır, düzenleme kutusu yok; satıra tıklayınca sağda
     yalnız okunan detay.
   - YÖNETİM (yalnız SuperAdmin, sağ üstteki anahtarla): aynı liste + sağda düzenleme paneli; toplu seçim /
     taşıma / etiket takımda. Kaydetme davranışı eskisiyle aynı: alan değişince hemen yazılır, aynı
     fonksiyonlar (toolStokMiktarDuzelt, updateToolCatalogField, updateStockItemField …).
   Renk: kırmızı = yok / eksi, sarı = alt limitte, yeşil = var; yanında yazıyla da söylenir. */
let stokTabloMod = load('stok_tablo_mod', 'gorunum');
let takimDurumFiltre = '', takimSeciliId = null, takimHareketler = {};
let hamDurumFiltre = 'tumu', hamKaliteFiltre = '', hamSeciliId = null;
const hamAcikGruplar = new Set();

function stYonetimMi(){ return !!(session && session.isSuperAdmin) && stokTabloMod === 'yonetim'; }
function stModAyarla(m){ stokTabloMod = m; save('stok_tablo_mod', m); render(); }
function stModSecici(){
  if(!(session && session.isSuperAdmin)) return `<span class="st-rozet">${ico('lock', 14)} Görünüm — yalnız okuma</span>`;
  const y = stokTabloMod === 'yonetim';
  return `<div class="st-mod" role="group" aria-label="Görünüm seçimi">
    <button type="button" class="${y ? '' : 'on'}" aria-pressed="${!y}" onclick="stModAyarla('gorunum')">Görünüm</button>
    <button type="button" class="${y ? 'on yon' : ''}" aria-pressed="${y}" onclick="stModAyarla('yonetim')">${ico('edit', 13)} Yönetim · SuperAdmin</button>
  </div>`;
}
function stChip(on, ad, n, onclick, nokta){
  return `<button type="button" class="st-chip ${on ? 'on' : ''}" onclick="${onclick}">${nokta ? `<span class="st-nokta" style="background:${nokta}"></span>` : ''}${esc(ad)}${n !== '' && n != null ? ` <span class="st-n">${n}</span>` : ''}</button>`;
}
/* durum: 'yok' | 'kritik' | 'ok' | 'eksi' | 'tutulmuyor' */
function stPill(durum, sayi, etiket){
  return `<span class="st-pill ${durum}"><b>${sayi}</b>${etiket ? `<span>${esc(etiket)}</span>` : ''}</span>`;
}
function stPanelKapat(){ takimSeciliId = null; hamSeciliId = null; render(); }

/* ==================== TAKIM & SARF ==================== */
function takimStokSayi(it){ return Number((toolStock[it.id] || {}).miktar || 0); }
function takimDurum(it){ const s = takimStokSayi(it); return s <= 0 ? 'yok' : (Number(it.altLimit) > 0 && s <= Number(it.altLimit)) ? 'kritik' : 'ok'; }
function takimKategoriAdi(v){ return (TOOL_KATEGORI_LIST.find(k => k.v === v) || {}).l || v || '—'; }
function takimSec(id){
  takimSeciliId = takimSeciliId === id ? null : id;
  if(takimSeciliId && !takimHareketler[id]){
    takimHareketler[id] = { yukleniyor: true, liste: [] };
    DB.ref('toolMoves').orderByChild('itemId').equalTo(id).limitToLast(6).once('value').then(s => {
      takimHareketler[id] = { yukleniyor: false, liste: Object.values(s.val() || {}).sort((a, b) => (b.ts || 0) - (a.ts || 0)) };
      safeRender();
    }).catch(() => { takimHareketler[id] = { yukleniyor: false, liste: [], hata: true }; safeRender(); });
  }
  render();
}
function renderTakimTablo(){
  const yon = stYonetimMi();
  const tum = toolCatalogArray();
  let items = toolCatalogFilteredArray();
  if(takimDurumFiltre) items = items.filter(it => takimDurum(it) === takimDurumFiltre);
  const locs = toolLocationsArray().filter(l => l.aktif !== false);
  const say = d => tum.filter(it => takimDurum(it) === d).length;
  const katSay = v => tum.filter(it => it.kategori === v).length;
  const secili = Object.keys(toolBulkSelected).length;
  const konumsuz = tum.filter(it => !it.locId).length;
  const sec = takimSeciliId ? toolCatalog[takimSeciliId] && { id: takimSeciliId, ...toolCatalog[takimSeciliId] } : null;

  const satir = it => {
    const d = takimDurum(it), s = takimStokSayi(it), dl = toolDolaplari(toolStock[it.id], it);
    return `<tr class="st-tr ${takimSeciliId === it.id ? (yon ? 'sec yon' : 'sec') : ''}" onclick="takimSec('${escJs(it.id)}')">
      ${yon ? `<td class="st-cb" onclick="event.stopPropagation()"><input type="checkbox" aria-label="Seç" ${toolBulkSelected[it.id] ? 'checked' : ''} onchange="toggleToolBulkSelect('${escJs(it.id)}',this.checked)"></td>` : ''}
      <td><div class="st-ad">${esc(it.ad || '—')}</div><div class="st-alt"><span class="mono">${esc(it.canias || '')}</span>${it.marka ? ' · ' + esc(it.marka) : ''}${it.aktif === false ? ' · <span style="color:var(--warn)">pasif</span>' : ''}</div></td>
      <td class="st-kat">${esc(takimKategoriAdi(it.kategori))}</td>
      <td class="st-sag">${stPill(d, s, d === 'yok' ? 'yok' : d === 'kritik' ? 'kritik' : (it.birim || 'adet'))}</td>
      <td class="st-dolap">${locs.map(l => { const x = dl.find(y => y.locId === l.id); return `${esc(l.ad)} <b class="mono">${x && x.miktar ? x.miktar : '—'}</b>`; }).join('<span class="st-ayr"> · </span>')}</td>
      <td class="st-sag mono st-soluk">${Number(it.altLimit) > 0 ? it.altLimit : '—'}</td>
    </tr>`;
  };

  const liste = `<section class="st-liste">
    <div class="st-ust">
      <div class="st-ara">${ico('search', 16)}<input placeholder="Ara — ad, CANİAS, marka · ör. tnmg ah120 · m5 klavuz" value="${esc(toolListSearch)}" oninput="toolSetListFilter('search',this.value)"><span class="mono">${items.length} / ${tum.length}</span></div>
      <button class="btn-ghost st-kucuk" title="Stok adetlerini sunucudan yeniden oku" onclick="ensureToolStockLoaded(function(){ toast('Stok yenilendi'); render(); }, true)">↻ Yenile</button>
    </div>
    <div class="st-filtre"><span class="st-fl">DURUM</span>
      ${stChip(!takimDurumFiltre, 'Tümü', tum.length, "takimDurumFiltre=''; render()")}
      ${stChip(takimDurumFiltre === 'kritik', 'Kritik', say('kritik'), "takimDurumFiltre='kritik'; render()", 'var(--warn)')}
      ${stChip(takimDurumFiltre === 'yok', 'Stokta yok', say('yok'), "takimDurumFiltre='yok'; render()", 'var(--danger)')}
    </div>
    <div class="st-filtre"><span class="st-fl">KATEGORİ</span>
      ${stChip(!toolListFilterKategori, 'Hepsi', '', "toolSetListFilter('kategori','')")}
      ${TOOL_KATEGORI_LIST.filter(k => katSay(k.v)).sort((a, b) => katSay(b.v) - katSay(a.v)).map(k => stChip(toolListFilterKategori === k.v, k.l, katSay(k.v), `toolSetListFilter('kategori','${k.v}')`)).join('')}
    </div>
    <div class="st-filtre"><span class="st-fl">KONUM</span>
      ${stChip(!toolListFilterLoc, 'Tüm konumlar', '', "toolSetListFilter('loc','')")}
      ${locs.map(l => stChip(toolListFilterLoc === l.id, l.ad, '', `toolSetListFilter('loc','${escJs(l.id)}')`)).join('')}
      ${konumsuz ? stChip(toolListFilterLoc === '__none__', 'Konumsuz', konumsuz, "toolSetListFilter('loc','__none__')", 'var(--warn)') : ''}
    </div>
    ${yon ? `<div class="st-toplu">
      <label><input type="checkbox" ${items.length && items.every(it => toolBulkSelected[it.id]) ? 'checked' : ''} onchange="toolBulkSelectAllFiltered(this.checked)"> Listedekilerin tümü</label>
      <b>${secili} kalem seçili</b>
      <select onchange="toolBulkTargetLoc=this.value" aria-label="Hedef konum"><option value="">— Hedef konum —</option>${locs.map(l => `<option value="${l.id}" ${toolBulkTargetLoc === l.id ? 'selected' : ''}>${esc(l.ad)}</option>`).join('')}</select>
      <button class="btn-ghost st-kucuk" ${secili ? '' : 'disabled'} onclick="bulkMoveToolItemsToLocation()">Seçilenleri taşı</button>
      <button class="btn-ghost st-kucuk" ${secili ? '' : 'disabled'} onclick="printToolLabels()">Etiket yazdır</button>
      ${secili ? `<button class="btn-ghost st-kucuk" onclick="toolBulkClearSelection()">Seçimi kaldır</button>` : ''}
    </div>` : ''}
    <div class="st-tablo-kutu"><table class="st-tablo">
      <thead><tr>${yon ? '<th class="st-cb"></th>' : ''}<th>KALEM</th><th>KATEGORİ</th><th class="st-sag">STOK</th><th>DOLAPLARDA</th><th class="st-sag">ALT LİMİT</th></tr></thead>
      <tbody>${items.length ? items.map(satir).join('') : `<tr><td colspan="${yon ? 6 : 5}" class="st-bos">Filtreye uyan kalem yok.</td></tr>`}</tbody>
    </table></div>
  </section>`;

  let panel = '';
  if(sec){
    const d = takimDurum(sec), s = takimStokSayi(sec), dl = toolDolaplari(toolStock[sec.id], sec), st = toolStock[sec.id] || {};
    const h = takimHareketler[sec.id] || { yukleniyor: true, liste: [] };
    const tipAd = { cikis: 'Çıkış', giris: 'Giriş', sayim: 'Sayım', iade: 'İade', fire: 'Fire', duzeltme: 'Düzeltme', tasima: 'Taşıma' };
    const bas = `<div class="st-panel-bas"><div>${yon ? '<div class="st-panel-etiket">DÜZENLE</div>' : ''}<div class="st-panel-ad">${esc(sec.ad || '')}</div>
      <div class="st-alt"><span class="mono">${esc(sec.canias || '')}</span>${sec.marka ? ' · ' + esc(sec.marka) : ''} · ${esc(takimKategoriAdi(sec.kategori))}</div></div>
      <button class="icon-btn" aria-label="Kapat" onclick="stPanelKapat()">${ico('x', 16)}</button></div>`;
    const stokKutu = `<div class="st-buyuk ${d}"><b>${s}</b><div><div class="st-buyuk-baslik">${d === 'yok' ? 'Stokta yok' : d === 'kritik' ? 'Kritik — alt limitte' : 'Stokta var'}</div>
      <div>${Number(sec.altLimit) > 0 ? 'Alt limit ' + sec.altLimit + ' ' + esc(sec.birim || 'adet') : 'Alt limit tanımlı değil'}${st.siparisAcik ? ' · sipariş açık' : ''}</div></div></div>`;
    const hareket = `<div class="st-bolum">SON HAREKETLER</div>${h.yukleniyor ? '<div class="st-soluk">Yükleniyor…</div>'
      : !h.liste.length ? '<div class="st-soluk">Hareket yok.</div>'
      : `<div class="st-hareket">${h.liste.map(m => `<div><span class="${m.miktar < 0 ? 'eksi' : 'arti'}">${m.miktar > 0 ? '+' : ''}${m.miktar}</span> ${esc(tipAd[m.tip] || m.tip || '')}${m.dolap ? ' · ' + esc(m.dolap) : ''}<div class="st-alt">${esc(m.operatorName || m.operatorUsername || '')} · ${fmtDT(m.ts)}${m.isEmriNo ? ' · ' + esc(m.isEmriNo) : ''}</div></div>`).join('')}</div>`}`;
    if(!yon){
      panel = `<aside class="st-panel" aria-label="Seçili kalem">${bas}<div class="st-panel-ic">${stokKutu}
        <div class="st-bolum">DOLAPLARDA</div>${locs.map(l => { const x = dl.find(y => y.locId === l.id); return `<div class="st-dolap-satir"><span>${esc(l.ad)}${l.id === sec.locId && sec.goz ? ` <span class="st-soluk">/ ${esc(sec.goz)}</span>` : ''}</span><b class="mono">${x && x.miktar ? x.miktar + ' ' + esc(sec.birim || 'adet') : '—'}</b></div>`; }).join('')}
        ${hareket}
        <div class="st-not">Bu ekranda hiçbir alan değiştirilemez. Stok ve kalem bilgisi SuperAdmin'in Yönetim görünümünde düzenlenir.</div></div></aside>`;
    } else {
      const alan = (et, html) => `<label class="st-alan"><span>${et}</span>${html}</label>`;
      panel = `<aside class="st-panel yon" aria-label="Kalemi düzenle">${bas}<div class="st-panel-ic">${stokKutu}
        <div class="st-bolum">STOK — DOLAP DOLAP SAYIM</div>
        ${locs.map(l => { const x = dl.find(y => y.locId === l.id); const m = x ? x.miktar : 0;
          return `<div class="st-sayim"><span>${esc(l.ad)}</span><b class="mono">${m || '—'}</b><input class="mono" inputmode="numeric" aria-label="${esc(l.ad)} sayılan" placeholder="sayılan" value="" onkeydown="if(event.key==='Enter') this.blur()" onchange="if(this.value.trim()!=='') toolStokMiktarDuzelt('${escJs(sec.id)}',this.value,'${escJs(l.id)}')"></div>`; }).join('')}
        <div class="st-soluk" style="font-size:12px">Sayılan adedi yazıp Enter'a bas — fark "Düzeltme" olarak hareketlere yazılır.</div>
        ${s > 0 && locs.length > 1 ? `<button class="btn-ghost st-kucuk" onclick="toolTasiAc('${escJs(sec.id)}')">⇄ Dolaplar arası taşı</button>` : ''}
        <div class="st-bolum">KALEM BİLGİSİ</div>
        ${alan('Ad', `<input value="${esc(sec.ad || '')}" onchange="updateToolCatalogField('${escJs(sec.id)}','ad',this.value.trim())">`)}
        <div class="st-iki">
          ${alan('Kategori', `<select onchange="updateToolCatalogField('${escJs(sec.id)}','kategori',this.value)">${TOOL_KATEGORI_LIST.map(k => `<option value="${k.v}" ${sec.kategori === k.v ? 'selected' : ''}>${k.l}</option>`).join('')}</select>`)}
          ${alan('Marka', `<input value="${esc(sec.marka || '')}" onchange="updateToolCatalogField('${escJs(sec.id)}','marka',this.value)">`)}
          ${alan('Ana konum', `<select onchange="updateToolCatalogField('${escJs(sec.id)}','locId',this.value)"><option value="">—</option>${locs.map(l => `<option value="${l.id}" ${sec.locId === l.id ? 'selected' : ''}>${esc(l.ad)}</option>`).join('')}</select>`)}
          ${alan('Göz', `<input value="${esc(sec.goz || '')}" placeholder="ör. A-3" onchange="updateToolCatalogField('${escJs(sec.id)}','goz',this.value)">`)}
          ${alan('Alt limit', `<input class="mono" inputmode="numeric" value="${sec.altLimit || 0}" onchange="updateToolCatalogField('${escJs(sec.id)}','altLimit',this.value)">`)}
          ${alan('Sipariş miktarı', `<input class="mono" inputmode="numeric" value="${sec.siparisMiktari || 0}" onchange="updateToolCatalogField('${escJs(sec.id)}','siparisMiktari',this.value)">`)}
        </div>
        <div class="st-kutular">
          <label><input type="checkbox" ${st.siparisAcik ? 'checked' : ''} onchange="toggleToolStokSiparisAcik('${escJs(sec.id)}')"> Sipariş açık</label>
          <label><input type="checkbox" ${sec.demirbas ? 'checked' : ''} onchange="updateToolCatalogField('${escJs(sec.id)}','demirbas',this.checked)"> Demirbaş</label>
          <label><input type="checkbox" ${sec.aktif !== false ? 'checked' : ''} onchange="updateToolCatalogField('${escJs(sec.id)}','aktif',this.checked)"> Aktif</label>
        </div>
        ${hareket}
        <div class="st-not">Değişiklikler alandan çıkınca hemen kaydedilir.</div></div></aside>`;
    }
  }
  return `<div class="st-bas"><div class="sec-h" style="margin:0">Takım &amp; Sarf</div>${stModSecici()}</div>
    <div class="st-govde">${liste}${panel}</div>`;
}

/* ==================== HAMMADDE ==================== */
function hamKalite(it){ return String(it.kod || '').trim().split(/\s+/)[0].toLocaleUpperCase('tr-TR') || '—'; }
function hamOlcu(it){
  if(it.tur === 'boy') return it.cap || String(it.kod || '');
  const geri = String(it.kod || '').trim().split(/\s+/).slice(1).join(' ');
  return geri || String(stokAciklama(it) || '').split(' — ')[0] || it.kod || '';
}
function hamCap(it){ const n = parseFloat(String(it.cap || '').replace(/[^\d.,]/g, '').replace(',', '.')); return isNaN(n) ? 1e9 : n; }
function hamDurum(it){
  if(it.tur === 'boy') return lotsArray(it).length ? 'ok' : 'tutulmuyor';
  const m = Number(it.miktar) || 0;
  if(m < 0) return 'eksi';
  if(m === 0) return 'yok';
  return Number(it.altLimit) > 0 && m <= Number(it.altLimit) ? 'kritik' : 'ok';
}
function hamStokHtml(it){
  const d = hamDurum(it);
  if(it.tur === 'boy'){
    const l = lotsArray(it);
    return l.length ? stPill('ok', l.length, 'çubuk · ' + l.reduce((t, x) => t + (Number(x.boy) || 0), 0) + ' ' + (it.birim || 'mm')) : stPill('tutulmuyor', '', 'stok tutulmuyor');
  }
  const m = Number(it.miktar) || 0;
  return stPill(d === 'yok' ? 'bos' : d, m, (it.birim || 'adet') + (d === 'eksi' ? ' · sayım gerekli' : d === 'kritik' ? ' · kritik' : ''));
}
function hamFiltreUyar(it){
  const d = hamDurum(it);
  if(hamDurumFiltre === 'stoklu') return d === 'ok' || d === 'kritik';
  if(hamDurumFiltre === 'eksi') return d === 'eksi';
  if(hamDurumFiltre === 'adet') return it.tur !== 'boy';
  if(hamDurumFiltre === 'cubuk') return it.tur === 'boy';
  if(hamDurumFiltre === 'kodyok') return !stokCanias(it);
  return true;
}
function hamGrupToggle(k){ if(hamAcikGruplar.has(k)) hamAcikGruplar.delete(k); else hamAcikGruplar.add(k); render(); }
function hamSec(id){ hamSeciliId = hamSeciliId === id ? null : id; render(); }
function renderHammaddeTablo(){
  const yon = stYonetimMi();
  const tum = stockItemsArray();
  const q = String(malzemeAramaMetni || '').trim();
  let items = q ? hammaddeAra(tum, malzemeAramaMetni) : tum.slice();
  items = items.filter(hamFiltreUyar);
  if(hamKaliteFiltre) items = items.filter(it => hamKalite(it) === hamKaliteFiltre);
  const kaliteSay = {}; tum.forEach(it => { const k = hamKalite(it); kaliteSay[k] = (kaliteSay[k] || 0) + 1; });
  const ustKaliteler = Object.entries(kaliteSay).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const say = f => tum.filter(it => { const o = hamDurumFiltre; hamDurumFiltre = f; const r = hamFiltreUyar(it); hamDurumFiltre = o; return r; }).length;
  const gruplar = {};
  items.forEach(it => { (gruplar[hamKalite(it)] ||= []).push(it); });
  const sirali = Object.entries(gruplar).sort((a, b) => (kaliteSay[b[0]] || 0) - (kaliteSay[a[0]] || 0) || a[0].localeCompare(b[0], 'tr'));
  const hepsiAcik = !!(q || hamKaliteFiltre || hamDurumFiltre !== 'tumu');
  const sec = hamSeciliId && stockItems[hamSeciliId] ? { id: hamSeciliId, ...stockItems[hamSeciliId] } : null;

  const satir = it => `<tr class="st-tr ${hamSeciliId === it.id ? (yon ? 'sec yon' : 'sec') : ''}" onclick="hamSec('${escJs(it.id)}')">
      <td class="mono st-olcu">${esc(hamOlcu(it))}</td>
      <td class="st-kat">${esc(stokAciklama(it))}</td>
      <td class="st-soluk" style="font-size:12.5px">${it.tur === 'boy' ? 'çubuk' : 'adet'}</td>
      <td class="st-sag">${hamStokHtml(it)}</td>
      <td class="mono st-soluk" style="font-size:12.5px">${stokCanias(it) ? esc(stokCanias(it)) : '<span class="matrix-tag" style="--sb:var(--warn)">KOD YOK</span>'}</td>
    </tr>`;
  const grupHtml = ([k, list]) => {
    const acik = hepsiAcik || hamAcikGruplar.has(k);
    const eksi = list.filter(it => hamDurum(it) === 'eksi').length, stoklu = list.filter(it => ['ok', 'kritik'].includes(hamDurum(it))).length;
    const adet = list.filter(it => it.tur !== 'boy').length, cubuk = list.length - adet;
    list.sort((a, b) => (a.tur === 'boy') - (b.tur === 'boy') || (a.tur === 'boy' ? hamCap(a) - hamCap(b) : String(a.kod).localeCompare(String(b.kod), 'tr', { numeric: true })));
    return `<div class="st-grup">
      <button type="button" class="st-grup-bas" aria-expanded="${acik}" onclick="hamGrupToggle('${escJs(k)}')">
        <span class="st-ok ${acik ? 'acik' : ''}">${ico('chevronRight', 14)}</span>
        <span class="st-kalite mono">${esc(k)}</span>
        <span class="st-soluk">${list.length} kalem${adet && cubuk ? ` · ${adet} adetli · ${cubuk} çubuk` : cubuk ? ' · çubuk' : ''}</span>
        <span class="st-rozetler">${eksi ? `<span class="st-rz eksi">${eksi} eksi stok</span>` : ''}${stoklu ? `<span class="st-rz ok">${stoklu} stoklu</span>` : ''}</span>
      </button>
      ${acik ? `<div class="st-tablo-kutu ic"><table class="st-tablo"><thead><tr><th>ÖLÇÜ</th><th>AÇIKLAMA</th><th>TÜR</th><th class="st-sag">STOK</th><th>CANİAS</th></tr></thead><tbody>${list.map(satir).join('')}</tbody></table></div>` : ''}
    </div>`;
  };

  const liste = `<section class="st-liste">
    <div class="st-ust"><div class="st-ara">${ico('search', 16)}<input placeholder="Ara — kalite, çap, ölçü, CANİAS · ör. 2344 80 · b13 kalın · KLPHM000290" value="${esc(malzemeAramaMetni)}" oninput="malzemeAramaMetni=this.value; render()"><span class="mono">${items.length} / ${tum.length}</span></div></div>
    <div class="st-filtre"><span class="st-fl">DURUM</span>
      ${[['tumu', 'Tümü', ''], ['stoklu', 'Stoklu', 'var(--success)'], ['eksi', 'Eksi stok', 'var(--danger)'], ['adet', 'Adetli', ''], ['cubuk', 'Çubuk', ''], ['kodyok', 'CANİAS kodu yok', 'var(--warn)']]
        .map(([v, ad, r]) => { const n = say(v); return (v === 'eksi' || v === 'kodyok') && !n ? '' : stChip(hamDurumFiltre === v, ad, n, `hamDurumFiltre='${v}'; render()`, r); }).join('')}
    </div>
    <div class="st-filtre"><span class="st-fl">KALİTE</span>
      ${stChip(!hamKaliteFiltre, 'Hepsi', '', "hamKaliteFiltre=''; render()")}
      ${ustKaliteler.map(([k, n]) => stChip(hamKaliteFiltre === k, k, n, `hamKaliteFiltre='${escJs(k)}'; render()`)).join('')}
      ${!hepsiAcik ? `<button type="button" class="btn-ghost st-kucuk" onclick="${sirali.map(([k]) => k).every(k => hamAcikGruplar.has(k)) ? 'hamAcikGruplar.clear()' : `[${sirali.map(([k]) => `'${escJs(k)}'`).join(',')}].forEach(k=>hamAcikGruplar.add(k))`}; render()">${sirali.map(([k]) => k).every(k => hamAcikGruplar.has(k)) ? 'Hepsini kapat' : 'Hepsini aç'}</button>` : ''}
    </div>
    <div class="st-gruplar">${sirali.length ? sirali.map(grupHtml).join('') : `<div class="st-bos">${q ? 'Aramayla eşleşen kalem yok.' : 'Filtreye uyan kalem yok.'}</div>`}</div>
  </section>`;

  let panel = '';
  if(sec){
    const d = hamDurum(sec), boy = sec.tur === 'boy', lots = boy ? lotsArray(sec) : [];
    const bas = `<div class="st-panel-bas"><div>${yon ? '<div class="st-panel-etiket">DÜZENLE</div>' : ''}<div class="st-panel-ad">${esc(hamKalite(sec))} ${esc(hamOlcu(sec))}</div>
      <div class="st-alt">${stokCanias(sec) ? `<span class="mono">${esc(stokCanias(sec))}</span>` : '<span style="color:var(--warn)">CANİAS kodu yok</span>'} · ${boy ? 'çubuk' : 'adetli'}</div></div>
      <button class="icon-btn" aria-label="Kapat" onclick="stPanelKapat()">${ico('x', 16)}</button></div>`;
    const m = Number(sec.miktar) || 0;
    const stokKutu = boy
      ? `<div class="st-buyuk ${lots.length ? 'ok' : 'tutulmuyor'}"><b>${lots.length || '—'}</b><div><div class="st-buyuk-baslik">${lots.length ? 'çubuk kayıtlı' : 'Çubuk stoğu tutulmuyor'}</div><div>${lots.length ? 'toplam ' + lots.reduce((t, x) => t + (Number(x.boy) || 0), 0) + ' ' + esc(sec.birim || 'mm') : 'Kesilen boy yalnız iş emrine tüketim olarak yazılıyor'}</div></div></div>`
      : `<div class="st-buyuk ${d === 'yok' ? 'bos' : d}"><b>${m}</b><div><div class="st-buyuk-baslik">${d === 'eksi' ? 'Eksi — sayım gerekli' : d === 'yok' ? 'Stokta yok' : d === 'kritik' ? 'Kritik — alt limitte' : 'Stokta var'}</div><div>${esc(sec.birim || 'adet')}${Number(sec.altLimit) > 0 ? ' · alt limit ' + sec.altLimit : ''}${sec.siparisAcik ? ' · sipariş açık' : ''}</div></div></div>`;
    const bilgi = `<div class="st-bolum">BİLGİ</div><div class="st-bilgi"><span>Açıklama</span><b>${esc(stokAciklama(sec))}</b>${!boy ? `<span>Düşüm</span><b>${sec.mode === 'manuel' ? 'Manuel (operatör girer)' : 'Otomatik (adet kadar)'}</b>` : ''}</div>`;
    if(!yon){
      panel = `<aside class="st-panel" aria-label="Seçili hammadde">${bas}<div class="st-panel-ic">${stokKutu}${bilgi}
        ${boy && lots.length ? `<div class="st-bolum">ÇUBUKLAR</div>${lots.map(l => `<div class="st-dolap-satir"><span>Çubuk</span><b class="mono">${l.boy} ${esc(sec.birim || 'mm')}</b></div>`).join('')}` : ''}
        <div class="st-not">Bu ekranda hiçbir alan değiştirilemez. Stok ve kalem bilgisi SuperAdmin'in Yönetim görünümünde düzenlenir.</div></div></aside>`;
    } else {
      const alan = (et, html) => `<label class="st-alan"><span>${et}</span>${html}</label>`;
      panel = `<aside class="st-panel yon" aria-label="Hammaddeyi düzenle">${bas}<div class="st-panel-ic">${stokKutu}
        ${boy ? `<div class="st-bolum">ÇUBUKLAR</div>${lots.length ? lots.map(l => `<div class="st-sayim"><span>Çubuk</span><input class="mono" inputmode="decimal" aria-label="Çubuk boyu" value="${l.boy}" onchange="updateStockLot('${escJs(sec.id)}','${escJs(l.id)}',this.value)"><button class="del-btn" title="Bu çubuğu sil" onclick="deleteStockLot('${escJs(sec.id)}','${escJs(l.id)}')">${ico('trash', 14)}</button></div>`).join('') : '<div class="st-soluk">Kayıtlı çubuk yok — yeni çubuk "Kod ile Giriş"ten eklenir.</div>'}`
          : `<div class="st-bolum">STOK SAYIMI</div><div class="st-sayim"><span>Sayılan (${esc(sec.birim || 'adet')})</span><b class="mono">${m}</b><input class="mono" inputmode="numeric" aria-label="Sayılan adet" placeholder="sayılan" value="" onkeydown="if(event.key==='Enter') this.blur()" onchange="if(this.value.trim()!==''){ updateStockItemField('${escJs(sec.id)}','miktar',this.value); toast('Stok '+this.value+' olarak kaydedildi'); }"></div>`}
        <div class="st-bolum">KALEM BİLGİSİ</div>
        <div class="st-iki">
          ${!boy ? alan('Düşüm', `<select onchange="updateStockItemField('${escJs(sec.id)}','mode',this.value)"><option value="oto" ${sec.mode === 'oto' ? 'selected' : ''}>Otomatik (adet kadar)</option><option value="manuel" ${sec.mode === 'manuel' ? 'selected' : ''}>Manuel (operatör girer)</option></select>`) : ''}
          ${alan('Alt limit', `<input class="mono" inputmode="numeric" value="${sec.altLimit || 0}" onchange="updateStockItemField('${escJs(sec.id)}','altLimit',this.value)">`)}
        </div>
        ${!boy ? `<div class="st-kutular"><label><input type="checkbox" ${sec.siparisAcik ? 'checked' : ''} onchange="toggleStockItemSiparisAcik('${escJs(sec.id)}')"> Sipariş açık</label></div>` : ''}
        <div class="st-eylem">
          <button class="btn-ghost st-kucuk" onclick="hammaddeDuzeltAc('${escJs(sec.id)}')">${ico('edit', 13)} Kod / açıklama / CANİAS düzelt · mevcutla değiştir</button>
          <button class="btn-ghost st-kucuk" style="color:var(--danger)" onclick="deleteStockItem('${escJs(sec.id)}')">${ico('trash', 13)} Kalemi sil</button>
        </div>
        <div class="st-not">Değişiklikler alandan çıkınca hemen kaydedilir.</div></div></aside>`;
    }
  }
  return `<div class="st-bas"><div class="sec-h" style="margin:0">Hammadde</div>${stModSecici()}</div>
    <div class="st-govde">${liste}${panel}</div>`;
}
