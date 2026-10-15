/* ==================== STOK TAKİBİ → ISIL İŞLEM: FASON PAKETLERİ (15.10.2026, kullanıcı isteği) ====================
   "Personel paket paket yolluyor (aynı tür + aynı sertlik), yanına iş emirlerini ve adetlerini yazıyor;
   ben ERP'de '42 ADET 3 KG 3343 61-63 HRC' diye satın alma isteği açıyorum. Malzeme siparişindeki
   gibi kopyala düğmesi olsun; tek tuşla kopyalayıp istek no'yu gireyim."
   Paket = FII01'e bir başlatma (tek ya da çoklu iş emri); bilgileri gönderimde girilir (js/fason-isil.js).
   İstek no: entries/{id}/fasonIstekNo (paketin tüm iş emirlerine). Kural değişikliği gerekmez. */
let fpIstekAcik = null, fpIstekDeger = '', fpDonenAcik = false;

function fasonPaketleri(){
  const sinir = Date.now() - 30 * 864e5;
  const p = {};
  entriesArray().forEach(e => {
    if(!(typeof fasonIsilMakinesiMi === 'function' && fasonIsilMakinesiMi(e.makine))) return;
    const acik = e.status === 'devam' || e.status === 'duruş';
    if(!acik && !((e.endTs || 0) >= sinir)) return;
    const k = (e.fasonPaket && e.fasonPaket.id) || e.groupId || e.id;
    (p[k] ||= { id: k, uyeler: [] }).uyeler.push(e);
  });
  return Object.values(p).map(x => {
    const ilk = x.uyeler.find(e => e.fasonPaket) || x.uyeler[0];
    const tur = ilk.fasonIsilTur ? (Array.isArray(ilk.fasonIsilTur) ? ilk.fasonIsilTur : Object.values(ilk.fasonIsilTur)) : [];
    return { ...x, uyeler: x.uyeler.sort((a, b) => String(a.talepNo || '').localeCompare(String(b.talepNo || ''))),
      tur, sertlik: ilk.fasonIsilSertlik || null, kg: ilk.fasonPaket ? Number(ilk.fasonPaket.kg) || null : null,
      ts: Math.min(...x.uyeler.map(e => e.startTs || Infinity)), gonderen: (ilk.fasonPaket && ilk.fasonPaket.gonderenAd) || ilk.operatorName || ilk.operatorUsername || '',
      adet: x.uyeler.reduce((t, e) => t + (Number(e.adet) || 0), 0),
      istekNo: (x.uyeler.find(e => e.fasonIstekNo) || {}).fasonIstekNo || '',
      acik: x.uyeler.some(e => e.status === 'devam' || e.status === 'duruş'),
      bilgili: !!(ilk.fasonPaket && tur.length) };
  }).sort((a, b) => b.ts - a.ts);
}
/* Mamul açıklaması: önce malzeme listesi (taban kod), yoksa iş emri listesindeki talep satırı */
function fpMamul(e){
  return (typeof usMamulAdi === 'function' ? usMamulAdi(e) : '') || (typeof getTalepInfo === 'function' && e.talepNo ? (getTalepInfo(e.talepNo) || {}).malzemeAdi : '') || '';
}
function fpTurKisa(tur){ return tur.map(t => String(t).replace(/\s*sertle[sş]tirme\s*$/i, '').trim().toLocaleUpperCase('tr-TR')).join(' + '); }
function fpKg(kg){ return kg == null ? '?' : String(Math.round(kg * 100) / 100).replace('.', ','); }
function fpSertlik(s){ return s && s.min != null ? (Number(s.max) > Number(s.min) ? s.min + '-' + s.max : String(s.min)) + ' HRC' : ''; }
/* ERP isteğine yapıştırılacak metin: ilk satır özet, altında iş emirleri */
function fpTaslakMetni(p){
  const ozet = `${p.adet} ADET ${fpKg(p.kg)} KG ${fpTurKisa(p.tur)} ${fpSertlik(p.sertlik)}`.replace(/\s+/g, ' ').trim();
  const satirlar = p.uyeler.map(e => {
    const mamul = fpMamul(e);
    return [e.talepNo || e.isEmriNo, mamul].filter(Boolean).join(' ') + ' - ' + (Number(e.adet) || 0) + ' ADET' + (Number(e.fasonKg) > 0 ? ' - ' + fpKg(Number(e.fasonKg)) + ' KG' : '');
  });
  return [ozet].concat(satirlar).join('\n');
}
function fpKopyala(id){
  const p = fasonPaketleri().find(x => x.id === id); if(!p) return;
  if(!p.bilgili){ toast('Önce paket bilgisini girin (tür, HRC, KG)'); return; }
  const metin = fpTaslakMetni(p);
  const tamam = () => toast('Kopyalandı — satın alma isteğine yapıştır');
  const yedek = () => {
    const t = document.createElement('textarea'); t.value = metin; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(t); t.select();
    let ok = false; try{ ok = document.execCommand('copy'); }catch(e){}
    document.body.removeChild(t);
    if(ok) tamam(); else window.prompt('Kopyalanamadı — buradan seçip kopyala:', metin);
  };
  if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(metin).then(tamam, yedek); else yedek();
}
function fpIstekAc(id, mevcut){
  fpIstekAcik = id; fpIstekDeger = mevcut || ''; render();
  setTimeout(() => { const el = document.getElementById('fp-istek-' + id); if(el){ el.focus(); el.select(); } }, 30);
}
function fpIstekKaydet(id){
  if(!(typeof malzemeIstekNoYetkisi === 'function' ? malzemeIstekNoYetkisi() : (session && session.isSuperAdmin))){ toast('İstek no\'yu SuperAdmin girer'); return; }
  const p = fasonPaketleri().find(x => x.id === id); if(!p) return;
  const no = String(fpIstekDeger || '').trim();
  const upd = {}; p.uyeler.forEach(e => { upd['entries/' + e.id + '/fasonIstekNo'] = no || null; });
  DB.ref().update(upd).then(() => { toast(no ? 'İstek no kaydedildi: ' + no : 'İstek no silindi'); fpIstekAcik = null; render(); })
    .catch(err => toast('Kaydedilemedi: ' + ((err && err.message) || 'hata')));
}

function fpKartHtml(p){
  const durum = !p.acik ? { r: 'var(--success)', t: 'DÖNDÜ' } : p.istekNo ? { r: 'var(--warn)', t: 'İSTEK AÇIK' } : { r: 'var(--danger)', t: 'İSTEK NO YOK' };
  const yetki = typeof malzemeIstekNoYetkisi === 'function' ? malzemeIstekNoYetkisi() : !!(session && session.isSuperAdmin);
  const istekAlani = fpIstekAcik === p.id
    ? `<span class="mb-satir-girdi"><label for="fp-istek-${esc(p.id)}">İstek no</label>
        <span class="mb-girdi-kutu"><input id="fp-istek-${esc(p.id)}" class="mono" style="text-align:left" placeholder="ör. 26100300" value="${esc(fpIstekDeger)}" oninput="fpIstekDeger=this.value" onkeydown="if(event.key==='Enter') fpIstekKaydet('${escJs(p.id)}'); if(event.key==='Escape'){ fpIstekAcik=null; render(); }"></span>
        <button class="btn-primary" onclick="fpIstekKaydet('${escJs(p.id)}')">Kaydet</button><button class="btn-ghost" onclick="fpIstekAcik=null; render()">Vazgeç</button></span>`
    : `${p.istekNo ? `<span class="mb-istek-no mono" style="font-weight:700">İstek ${esc(p.istekNo)}</span>` : ''}
       ${yetki ? `<button class="btn-ghost mb-mini" onclick="fpIstekAc('${escJs(p.id)}','${escJs(p.istekNo)}')">${p.istekNo ? 'Düzelt' : 'İstek no gir'}</button>` : ''}`;
  return `<div class="mb-grup acik" style="border-left:3px solid ${durum.r}">
    <div class="mb-grup-ust" style="cursor:default">
      <span class="mb-kod">${p.bilgili ? esc(fpTurKisa(p.tur) + ' · ' + fpSertlik(p.sertlik)) : 'Bilgi girilmemiş paket'}</span>
      <span class="matrix-tag" style="--sb:${durum.r}">${durum.t}</span>
      <span class="mb-olcu"><b>${p.adet} adet</b>${p.kg != null ? ` · <b>${fpKg(p.kg)} kg</b>` : ''} · ${p.uyeler.length} iş emri · ${fmtDT(p.ts)} · ${esc(p.gonderen)}</span>
      <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${p.bilgili ? `<button class="btn-ghost mb-mini" title="ERP satın alma isteğine yapıştırmak için" onclick="fpKopyala('${escJs(p.id)}')">${ico('copy', 13)} Taslağı kopyala</button>` : ''}
        ${canManageStock() ? `<button class="btn-ghost mb-mini" onclick="fasonIsilPaketBilgiAc(${esc(JSON.stringify(p.uyeler.map(e => e.id)))})">${p.bilgili ? 'Bilgiyi düzelt' : 'Bilgi gir'}</button>` : ''}
        ${istekAlani}
      </span>
    </div>
    ${p.uyeler.map(e => `<div class="mb-satir" style="grid-template-columns:minmax(0,1fr) minmax(0,2.4fr) auto auto">
      <span><span class="mb-ie">${esc(e.talepNo || e.isEmriNo || '—')}</span><span class="mb-talep">${esc(e.isEmriNo || '')}</span></span>
      <span class="mb-mamul">${esc(fpMamul(e) || '—')}</span>
      <span class="mb-sag"><b>${esc(e.adet || '?')}</b> adet${Number(e.fasonKg) > 0 ? ` · <b>${fpKg(Number(e.fasonKg))}</b> kg <span style="color:var(--text-muted)">(1 adet ${fpKg(Number(e.fasonKg) / (Number(e.adet) || 1))} kg)</span>` : ''}</span>
      <span class="mb-sag" style="color:var(--text-muted)">${e.status === 'tamamlandi' ? 'döndü ' + fmtDT(e.endTs).split(' ')[0] : 'fasonda'}</span>
    </div>`).join('')}
  </div>`;
}
function renderFasonPaketleri(){
  const l = fasonPaketleri();
  const acik = l.filter(p => p.acik), donen = l.filter(p => !p.acik);
  const istekYok = acik.filter(p => !p.istekNo).length, bilgisiz = acik.filter(p => !p.bilgili).length;
  let h = `<div class="settings-wrap" style="max-width:none">
    ${agYorum([
      acik.length ? `Fasonda <b>${acik.length}</b> ısıl işlem paketi var${istekYok ? `; <b style="color:var(--danger)">${istekYok}</b> tanesinin istek no'su girilmemiş` : ''}${bilgisiz ? `; ${bilgisiz} tanesi gönderilirken bilgisi girilmemiş (Bilgi gir)` : ''}.` : 'Fasonda bekleyen ısıl işlem paketi yok.',
      'Paket = FII01\'e bir başlatma. Tür, HRC ve KG gönderirken girilir; "Taslağı kopyala" satın alma isteğine yapıştırılacak metni verir.'
    ])}
    ${acik.map(fpKartHtml).join('')}
    ${donen.length ? `<button type="button" class="ag-detay-dugme" onclick="fpDonenAcik=!fpDonenAcik; render()">${ico(fpDonenAcik ? 'chevronUp' : 'chevronDown', 14)} ${fpDonenAcik ? 'Dönenleri gizle' : 'Son 30 günde dönenler (' + donen.length + ')'}</button>
      ${fpDonenAcik ? donen.map(fpKartHtml).join('') : ''}` : ''}
  </div>`;
  return h + (typeof fasonIsilModal !== 'undefined' && fasonIsilModal && fasonIsilModal.mod === 'paket' ? renderFasonIsilModal() : '');
}
