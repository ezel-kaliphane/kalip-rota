/* ==================== HAMMADDESİZ BAŞLAYAN İŞLER (12.10.2026, kullanıcı onayı) ====================
   Telefon düzeltmesinden (08.10) sonra ilk operasyonların ~%18'inde hammadde stoktan düşüldü; geri
   kalanı operatör "hammadde seçilmedi" uyarısına Tamam deyip başlattı. Maliyetin en büyük eksiği bu.
   İş Yoğunluğu'nda Şef/SuperAdmin için "Hammaddesi Girilmemiş" satırı: son 30 günde (08.10'dan eski
   değil) başlamış, hammadde stoktan düşülmemiş, malzeme bekleyen kaydı da olmayan İLK operasyonlar.
   Şef buradan hammaddeyi seçip stoktan düşer ya da "Hammadde kullanılmadı" der (entries/{id}/hammaddeYok).
   Hariç: _ELMAS dalı (karbür), birleşme (dalları olan iş emrinin eksiz kaydı), DENEME. */
const HM_BASLANGIC = Date.parse('2026-10-08T00:00:00');
let hmGir = null;   // { entryId, talep, isEmriNo, adet, ara, secim, miktar }

function hammaddesizIsler(){
  if(!canManageStock() || !stockEnabled()) return [];
  bomRotaYukle(false);
  if(!bomRotaVeri.stok) return [];
  const cikis = new Set();
  [bomRotaVeri.stok, stockHareketleri].forEach(kaynak => Object.values(kaynak || {}).forEach(h => {
    if(h && Number(h.miktar) < 0 && h.talepNo) cikis.add(String(h.talepNo).trim().toUpperCase());
  }));
  const mb = new Set(Object.values(malzemeBekleyen || {}).map(m => String(m.talepNo || '').trim().toUpperCase()).filter(Boolean));
  const dalli = new Set(), ilk = {};
  entriesArray().forEach(e => {
    const t = String(e.talepNo || '').trim().toUpperCase(); if(!t) return;
    if(bilesenOfCode(e.isEmriNo)) dalli.add(t);
    const k = t + '|' + e.isEmriNo;
    if(!ilk[k] || (e.startTs || 0) < (ilk[k].startTs || 0)) ilk[k] = e;
  });
  const bas = Math.max(HM_BASLANGIC, Date.now() - 30 * 864e5);
  return Object.values(ilk).filter(e => {
    const t = String(e.talepNo || '').trim().toUpperCase();
    if((e.startTs || 0) < bas) return false;
    if(bilesenOfCode(e.isEmriNo) === 'ELMAS' || baseIsEmriNo(e.isEmriNo) === TEST_ISEMRI_NO) return false;
    if(!bilesenOfCode(e.isEmriNo) && dalli.has(t)) return false;
    if(e.hammaddeYok || e.hammaddeGirildiTs) return false;
    return !cikis.has(t) && !mb.has(t);
  }).sort((a, b) => (b.startTs || 0) - (a.startTs || 0));
}

function hammaddesizDetayHtml(r){
  return r.kayitlar.map(e => {
    const mamul = (typeof usMamulAdi === 'function' ? usMamulAdi(e) : '') || '';
    const yazi = [e.malzemeCinsi, e.capBoy].filter(Boolean).join(' · ');
    return `<div class="iy-detay-row" style="grid-template-columns:minmax(0,1.1fr) minmax(0,1.6fr) minmax(0,.9fr) minmax(0,1fr) auto">
      <span><span class="mono" style="color:var(--accent);font-weight:600;cursor:pointer;text-decoration:underline dotted" onclick="openIyGecmisModal('${escJs(e.isEmriNo)}')">${esc(e.talepNo || e.isEmriNo)}</span>
        <span class="mono" style="display:block;font-size:10.5px;color:var(--text-subtle)">${esc(e.isEmriNo)} · ${esc(e.adet || '?')} adet</span></span>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(mamul)}">${esc(mamul || '—')}${yazi ? `<span style="display:block;font-size:11px;color:var(--warn)">operatör yazdı: ${esc(yazi)}</span>` : ''}</span>
      <span style="color:var(--text-muted)">${esc(String(e.makine || '').split(' · ')[0])} · ${esc(e.operatorName || e.operatorUsername || '')}</span>
      <span class="mono" style="color:var(--text-muted)">${fmtDT(e.startTs)}</span>
      <span style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn-primary" style="width:auto;padding:4px 10px;font-size:11.5px" onclick="hmGirAc('${escJs(e.id)}')">Hammadde gir</button>
        <button class="btn-ghost" style="width:auto;padding:4px 10px;font-size:11.5px" title="Bu işte hammadde kullanılmadı (ör. hazır parça, tadilat)" onclick="hmKullanilmadi('${escJs(e.id)}')">Kullanılmadı</button>
      </span>
    </div>`; }).join('');
}

function hmGirAc(id){
  const e = STATE.entries[id]; if(!e) return;
  const opts = stockConsumableOptions();
  hmGir = { entryId: id, talep: e.talepNo || '', isEmriNo: e.isEmriNo, adet: Number(e.adet) || 0, ara: '', secim: '', miktar: '' };
  /* Standart / reçete varsa önceden seç (yalnız adet takipli; boy takipte lot operatöre kalır) */
  const r = typeof urunStandartHammadde === 'function' ? urunStandartHammadde(e.isEmriNo) : null;
  if(r && opts.some(o => o.value === r.hammaddeId)){
    hmGir.secim = r.hammaddeId;
    if(Number(r.birimBasina) > 0 && hmGir.adet) hmGir.miktar = String(Math.round(r.birimBasina * hmGir.adet * 100) / 100);
  }
  render();
}
function hmGirKapat(){ hmGir = null; render(); }
function hmKullanilmadi(id){
  const e = STATE.entries[id]; if(!e) return;
  if(!confirm((e.talepNo || e.isEmriNo) + ' işinde hammadde kullanılmadı olarak işaretlensin mi? Listeden düşer.')) return;
  DB.ref().update({ ['entries/' + id + '/hammaddeYok']: true, ['entries/' + id + '/hammaddeYokBy']: session.username, ['entries/' + id + '/hammaddeYokTs']: Date.now() })
    .then(() => { toast('İşaretlendi'); render(); }).catch(err => toast('Kaydedilemedi: ' + ((err && err.message) || 'hata')));
}
function hmGirKaydet(){
  const g = hmGir; if(!g) return;
  const opt = stockOptionByValue(g.secim);
  if(!opt){ toast('Hammadde seçin'); return; }
  const [itemId, lotId] = String(g.secim).split('::');
  const it = stockItems[itemId]; if(!it){ toast('Kalem bulunamadı'); return; }
  const manuel = !!lotId || it.mode === 'manuel' || it.tur === 'boy';
  const miktar = manuel ? Number(String(g.miktar || '').replace(',', '.')) : (Number(String(g.miktar || '').replace(',', '.')) || g.adet);
  if(!(miktar > 0)){ toast(lotId ? 'Kesilen boyu girin' : 'Kullanılan miktarı girin'); return; }
  consumeStock(itemId, lotId || null, miktar, { isEmriNo: g.isEmriNo, talepNo: g.talep });
  DB.ref().update({ ['entries/' + g.entryId + '/hammaddeGirildiTs']: Date.now(), ['entries/' + g.entryId + '/hammaddeGirenUsername']: session.username })
    .catch(() => {});
  toast((g.talep || g.isEmriNo) + ' · ' + miktar + ' ' + (opt.birim || '') + ' stoktan düşüldü');
  hmGir = null; render();
}
function renderHmGirModal(){
  const g = hmGir; if(!g) return '';
  const e = STATE.entries[g.entryId] || {};
  const opts = stockConsumableOptions(), sec = stockOptionByValue(g.secim);
  const lot = String(g.secim || '').includes('::');
  const manuel = sec && (lot || sec.tur === 'boy' || sec.mode === 'manuel');
  const yazi = [e.malzemeCinsi, e.capBoy].filter(Boolean).join(' · ');
  return `<div class="modal-overlay" onclick="if(event.target===this) hmGirKapat()">
    <div class="modal-box kal-modal" style="max-width:520px">
      <div class="kal-modal-bas"><div class="sec-h" style="margin-top:0">Hammadde gir — ${esc(g.talep || g.isEmriNo)}</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-top:-4px">${esc((typeof usMamulAdi === 'function' ? usMamulAdi(e) : '') || '')} · ${g.adet || '?'} adet · ${esc(String(e.makine || '').split(' · ')[0])} · ${esc(e.operatorName || '')}${yazi ? `<br><span style="color:var(--warn)">Operatör yazdı: ${esc(yazi)}</span>` : ''}</div></div>
      <div class="kal-modal-govde">
        ${typeof urunHammaddeIpucuHtml === 'function' ? urunHammaddeIpucuHtml(g.isEmriNo) : ''}
        ${opHammaddeAramaHtml(g.ara, opts, 'hm-gir-ara', "hmGir.ara=this.value; render()", v => `hmGir.secim='${escJs(v)}'; hmGir.ara=''; render()`, 'hm')}
        <select onchange="hmGir.secim=this.value; render()" style="margin-bottom:8px">
          <option value="">Hammadde seç…</option>
          ${opts.map(o => `<option value="${esc(o.value)}" ${g.secim === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>
        ${sec ? `<div class="field" style="margin:0"><label>${lot ? 'Kesilen boy (' + esc(sec.birim || 'mm') + ')' : 'Kullanılan miktar (' + esc(sec.birim || '') + ')'}</label>
          <input inputmode="decimal" value="${esc(g.miktar)}" placeholder="${manuel ? '' : 'boşsa adet kadar: ' + (g.adet || '?')}" oninput="hmGir.miktar=this.value.replace(/[^0-9.,]/g,'')"></div>` : ''}
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:8px">Seçilen miktar stoktan düşülür, hareket bu iş emrine yazılır; maliyet de bundan hesaplanır.</div>
      </div>
      <div class="kal-modal-alt"><button class="btn-primary" style="flex:1" onclick="hmGirKaydet()">Stoktan düş</button><button class="btn-ghost" onclick="hmGirKapat()">Vazgeç</button></div>
    </div></div>`;
}
