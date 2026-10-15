/* ==================== FASON ISIL İŞLEM DÖNÜŞÜ (12.10.2026, kullanıcı: "tür başına kg; fason
   dönüşünde otomatik hesaplansın katsayılarla") ====================
   FII01 (ya da adında "ısıl" geçen fason makine) işi BİTİRİLİRKEN "Hangi ısıl işlem yapıldı?" sorulur
   (çoklu seçim, atlanabilir); seçim entries/{id}/fasonIsilTur = [tür adları]. Maliyet: çelik kg × her
   seçilen türün kg fiyatı (js/maliyet.js). Tür ADLARI fiyatsız olarak settings/isilIslemTurleri'nde
   (operatör cihazı şifreli parametreleri çözemez); fiyatlar şifreli kalır. Liste SuperAdmin maliyet
   parametrelerini kaydedince / açınca güncellenir. Liste boşsa soru sorulmaz, bitirme engellenmez. */
let fasonIsilModal = null;          // { id, groupId, secili:{tur:true}, sertMin, sertMax }
/* SERTLİK ARALIĞI (15.10.2026, kullanıcı: "türü seçtikten sonra hangi aralıkta sertleştirme yapıldı,
   ör. 54-56, 40-42 — bunu yazsın"). entries/{id}/fasonIsilSertlik = { min, max, birim:'HRC' }.
   Tür seçildiyse zorunlu; "Bilmiyorum / atla" yine her şeyi atlar. */
const FASON_SERTLIK_ALT = 10, FASON_SERTLIK_UST = 70;
function fasonIsilSertlikYazi(s){
  if(!s || s.min == null) return '';
  const f = v => String(v).replace('.', ',');
  return (Number(s.max) > Number(s.min) ? f(s.min) + '–' + f(s.max) : f(s.min)) + ' ' + (s.birim || 'HRC');
}
/* Daha önce girilmiş aralıklar — en sık kullanılan 6'sı, tek dokunuşla seçilsin */
function fasonIsilSonAraliklar(){
  const say = {};
  entriesArray().forEach(e => { const s = e.fasonIsilSertlik; if(s && s.min != null){ const k = s.min + '-' + (s.max != null ? s.max : s.min); say[k] = (say[k] || 0) + 1; } });
  return Object.entries(say).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k.split('-').map(Number));
}
const fasonIsilGecildi = new Set(); // bu oturumda sorusu cevaplanan kayıt / 'g:'+grup

function fasonIsilMakinesiMi(makine){
  const kod = String(makine || '').split(' · ')[0], ad = String(makine || '').split(' · ').slice(1).join(' ');
  return kod === 'FII01' || (typeof isFasonMachine === 'function' && isFasonMachine(makine) && /ısıl|isil/i.test(ad));
}
function fasonIsilTurleri(){
  const l = (appSettings && appSettings.isilIslemTurleri) || [];
  return (Array.isArray(l) ? l : Object.values(l)).filter(Boolean);
}
function fasonIsilModalAc(id, groupId){
  if(!fasonIsilTurleri().length) return false;
  fasonIsilModal = { id, groupId, secili: {}, sertMin: '', sertMax: '' };
  render();
  return true;
}
/* GÖNDERİMDE PAKET BİLGİSİ (15.10.2026, kullanıcı: "fason ısıl işleme paket paket yollanıyor — tür,
   HRC ve KG gönderirken girilsin; ben ERP'de bu bilgiyle satın alma isteği açıyorum"). Kararlar:
   bilgiler GÖNDERİRKEN (FII01 başlatılırken) girilir; bir başlatma = bir paket (farklı paketler ayrı
   başlatılır). Başlatmadaki tüm iş emirlerine fasonIsilTur, fasonIsilSertlik ve fasonPaket
   {id, kg, ts, gonderen} yazılır; liste Stok Takibi → Isıl İşlem (ui/fason-paket.js). Dönüşte bilgi
   zaten varsa soru sorulmaz. */
let fasonGonderim = null;   // { tur:[], sertlik, kg } — modal kaydedilince baslat() bunu kayda yazar
function fasonIsilGonderimAc(){
  if(!fasonIsilTurleri().length) return false;
  fasonIsilModal = { mod: 'gonderim', secili: {}, sertMin: '', sertMax: '', kg: '' };
  render();
  return true;
}
/* Eski / bilgisiz pakete sonradan bilgi (Isıl İşlem listesinden) */
function fasonIsilPaketBilgiAc(ids){
  if(!fasonIsilTurleri().length){ toast('Isıl işlem türleri tanımlı değil (Maliyet parametreleri)'); return; }
  const ilk = STATE.entries[ids[0]] || {};
  const tur = ilk.fasonIsilTur ? (Array.isArray(ilk.fasonIsilTur) ? ilk.fasonIsilTur : Object.values(ilk.fasonIsilTur)) : [];
  const s = ilk.fasonIsilSertlik || {};
  fasonIsilModal = { mod: 'paket', ids, secili: Object.fromEntries(tur.map(t => [t, true])), sertMin: s.min != null ? String(s.min) : '', sertMax: s.max != null ? String(s.max) : '',
    kg: ilk.fasonPaket && ilk.fasonPaket.kg ? String(ilk.fasonPaket.kg).replace('.', ',') : '' };
  render();
}
function fasonGonderimAlanlari(paketId){
  const g = fasonGonderim; if(!g || g.atla) return {};
  return { fasonIsilTur: g.tur, fasonIsilSertlik: g.sertlik,
    fasonPaket: { id: paketId, kg: g.kg, ts: Date.now(), gonderen: session.username, gonderenAd: session.displayName || session.username } };
}
function fasonIsilKaydet(atla){
  const m = fasonIsilModal; if(!m) return;
  if(m.mod === 'gonderim' && atla){ fasonGonderim = { atla: true }; fasonIsilModal = null; baslat(); return; }
  const secim = atla ? [] : Object.keys(m.secili).filter(k => m.secili[k]);
  if(!atla && !secim.length){ toast(m.mod === 'gonderim' ? 'En az bir tür seçin ya da "Şimdi değil" deyin' : m.mod === 'paket' ? 'En az bir tür seçin' : 'En az bir tür seçin ya da "Bilmiyorum" deyin'); return; }
  let sertlik = null;
  if(!atla){
    const sayi = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
    let mn = sayi(m.sertMin), mx = sayi(m.sertMax);
    if(mn == null && mx != null){ mn = mx; }
    if(mx == null && mn != null){ mx = mn; }
    if(mn == null){ toast('Sertlik aralığını yazın (ör. 54 – 56 HRC)'); return; }
    if(mn > mx){ const t = mn; mn = mx; mx = t; }
    if(mn < FASON_SERTLIK_ALT || mx > FASON_SERTLIK_UST){ toast(`Sertlik ${FASON_SERTLIK_ALT}–${FASON_SERTLIK_UST} HRC arasında olmalı`); return; }
    sertlik = { min: mn, max: mx, birim: 'HRC' };
  }
  if(m.mod === 'gonderim' || m.mod === 'paket'){
    const kg = parseFloat(String(m.kg || '').replace(',', '.'));
    if(!(kg > 0)){ toast('Paketin KG\'sini yazın (ör. 9,27)'); return; }
    if(m.mod === 'gonderim'){
      fasonGonderim = { tur: secim, sertlik, kg: Math.round(kg * 1000) / 1000 };
      fasonIsilModal = null;
      baslat();   // asıl başlatma — bilgi kayda yazılır (bkz. fasonGonderimAlanlari)
      return;
    }
    const upd = {}, ilk = STATE.entries[m.ids[0]] || {};
    const paket = { ...(ilk.fasonPaket || {}), id: (ilk.fasonPaket && ilk.fasonPaket.id) || ilk.groupId || m.ids[0], kg: Math.round(kg * 1000) / 1000,
      ts: (ilk.fasonPaket && ilk.fasonPaket.ts) || ilk.startTs || Date.now(), gonderen: (ilk.fasonPaket && ilk.fasonPaket.gonderen) || ilk.operatorUsername || '',
      gonderenAd: (ilk.fasonPaket && ilk.fasonPaket.gonderenAd) || ilk.operatorName || '' };
    m.ids.forEach(id => { upd['entries/' + id + '/fasonIsilTur'] = secim; upd['entries/' + id + '/fasonIsilSertlik'] = sertlik; upd['entries/' + id + '/fasonPaket'] = paket; });
    DB.ref().update(upd).then(() => toast('Paket bilgisi kaydedildi')).catch(err => toast('Kaydedilemedi: ' + ((err && err.message) || 'hata')));
    fasonIsilModal = null; render();
    return;
  }
  const ids = m.groupId ? groupMembersOf(m.groupId).map(e => e.id) : [m.id];
  if(secim.length){
    const upd = {}; ids.forEach(id => { upd['entries/' + id + '/fasonIsilTur'] = secim; if(sertlik) upd['entries/' + id + '/fasonIsilSertlik'] = sertlik; });
    DB.ref().update(upd).catch(err => toast('Isıl işlem türü kaydedilemedi: ' + ((err && err.message) || 'hata')));
  }
  ids.forEach(id => fasonIsilGecildi.add(id)); if(m.groupId) fasonIsilGecildi.add('g:' + m.groupId);
  fasonIsilModal = null;
  if(m.groupId) bitirGrup(m.groupId); else bitir(m.id);
}
function renderFasonIsilModal(){
  const m = fasonIsilModal; if(!m) return '';
  const turler = fasonIsilTurleri();
  return `<div class="durus-modal-overlay" onclick="if(event.target===this){fasonIsilModal=null; render();}">
    <div class="durus-modal-panel">
      <div class="durus-modal-handle" style="cursor:pointer" onclick="fasonIsilModal=null; render()"></div>
      <div class="durus-modal-header"><div><div class="durus-modal-title">${m.mod === 'gonderim' ? 'Fason ısıl işleme gönderim' : m.mod === 'paket' ? 'Isıl işlem paket bilgisi' : 'Fason ısıl işlem'}</div>
        <div class="durus-modal-sub">${m.mod ? 'Bu pakete hangi ısıl işlem yapılacak? Tür, istenen sertlik ve paketin KG\'si — satın alma isteği bu bilgiyle açılır.' : 'Fasondan dönen parçaya hangi ısıl işlem yapıldı? Birden fazla seçilebilir.'}</div></div>
        <button class="icon-btn" onclick="fasonIsilModal=null; render()">${ico('x',16)}</button></div>
      <div class="durus-modal-list">
        ${turler.map(t => { const on = !!m.secili[t]; return `<button class="durus-option-card" style="${on ? 'border-color:var(--accent);background:var(--accent-dim)' : ''}" onclick="fasonIsilModal.secili['${escJs(t)}']=!fasonIsilModal.secili['${escJs(t)}']; render()">
          <span class="durus-radio" style="${on ? 'border-color:var(--accent)' : ''};border-radius:5px"><span style="width:10px;height:10px;border-radius:2px;background:${on ? 'var(--accent)' : 'transparent'}"></span></span>
          <span class="durus-option-name" style="${on ? 'color:var(--accent)' : ''}">${esc(t)}</span></button>`; }).join('')}
        ${m.mod === 'paket' ? '' : `<button class="durus-option-card dashed" onclick="fasonIsilKaydet(true)"><span class="durus-option-name" style="color:var(--text-muted)">${m.mod === 'gonderim' ? 'Şimdi değil — bilgisiz gönder' : 'Bilmiyorum / atla'}</span></button>`}
      </div>
      <div class="durus-modal-footer" style="flex-direction:column;align-items:stretch;gap:10px">
        <div class="fis-sertlik" style="margin:0">
          <div class="fis-sertlik-bas">Sertlik aralığı <span>HRC</span></div>
          <div class="fis-sertlik-kutular">
            <input id="fis-sert-min" class="mono" inputmode="decimal" placeholder="min" value="${esc(m.sertMin)}" oninput="fasonIsilModal.sertMin=this.value.replace(/[^0-9.,]/g,'')" onkeydown="if(event.key==='Enter') document.getElementById('fis-sert-max').focus()">
            <span>–</span>
            <input id="fis-sert-max" class="mono" inputmode="decimal" placeholder="max" value="${esc(m.sertMax)}" oninput="fasonIsilModal.sertMax=this.value.replace(/[^0-9.,]/g,'')" onkeydown="if(event.key==='Enter'){ const kg=document.getElementById('fis-kg'); if(kg) kg.focus(); else fasonIsilKaydet(false); }">
            <em>HRC</em>
          </div>
          ${(() => { const son = fasonIsilSonAraliklar(); return son.length ? `<div class="fis-sertlik-son">${son.map(([a, b]) => `<button type="button" class="chip ${String(m.sertMin) === String(a) && String(m.sertMax) === String(b) ? 'active' : ''}" onclick="fasonIsilModal.sertMin='${a}'; fasonIsilModal.sertMax='${b}'; render()">${a === b ? a : a + '–' + b}</button>`).join('')}</div>` : ''; })()}
          ${m.mod ? `<div class="fis-sertlik-bas" style="margin-top:12px">Paket ağırlığı <span>KG</span></div>
          <div class="fis-sertlik-kutular"><input id="fis-kg" class="mono" inputmode="decimal" placeholder="ör. 9,27" style="width:120px" value="${esc(m.kg || '')}" oninput="fasonIsilModal.kg=this.value.replace(/[^0-9.,]/g,'')" onkeydown="if(event.key==='Enter') fasonIsilKaydet(false)"><em>KG</em></div>` : ''}
        </div>
        <button class="durus-modal-footer-btn" onclick="fasonIsilKaydet(false)">${m.mod === 'gonderim' ? 'Kaydet ve gönder (başlat)' : m.mod === 'paket' ? 'Kaydet' : 'Kaydet ve devam et'}</button></div>
    </div></div>`;
}
/* SuperAdmin'in cihazı: parametrelerdeki tür adlarını (fiyatsız) operatörlerin görebileceği yere yaz */
function fasonIsilTurleriEsitle(p){
  if(!(typeof canEditMaliyet === 'function' && canEditMaliyet()) || !p) return;
  const adlar = (p.isil || []).map(i => String(i.tur || '').trim()).filter(Boolean);
  if(JSON.stringify(adlar) === JSON.stringify(fasonIsilTurleri())) return;
  DB.ref('settings/isilIslemTurleri').set(adlar.length ? adlar : null).catch(() => {});
}
