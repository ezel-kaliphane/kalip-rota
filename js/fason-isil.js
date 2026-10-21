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
let fasonGonderim = null;   // { tur:[], sertlik, kg, kgler:{anahtar:kg} } — modal kaydedilince baslat() bunu kayda yazar
/* İŞ EMRİ BAŞINA KG (15.10.2026, kullanıcı: "her iş emrinin kendi adedi ve kilosu var; bir iş emrinin
   bir adedi kaç kg görmek istiyorum — ileride maliyette kullanacağız; operatör çok uğraşmasın").
   Operatör her iş emrinin parçalarını AYRI tartıp kantarda gördüğünü yazar (bölme yapmaz);
   entries/{id}/fasonKg = o iş emrinin bu paketteki kg'si, 1 adet = fasonKg / adet (fasonBirimKg),
   paket kg = toplam. Aynı iş emri kodu (mamul + bileşen) daha önce tartıldıysa kutu önceki
   adet ağırlığı × adet ile dolu gelir — doğruysa operatör dokunmaz. */
function fasonSayi(v){ const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; }
function fasonKgYazi(v){ return v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ','); }
function fasonKalemAnahtar(talepNo, isEmriNo){ return String(talepNo || '') + '|' + String(isEmriNo || ''); }
function fasonBirimKg(e){ const kg = Number(e && e.fasonKg), a = Number(e && e.adet); return kg > 0 && a > 0 ? kg / a : null; }
/* Aynı iş emri kodunun (ör. UC17000274_ELMAS) en son tartılan 1 adet ağırlığı */
function fasonOncekiBirimKg(isEmriNo){
  let son = null;
  entriesArray().forEach(e => { if(e.isEmriNo === isEmriNo && fasonBirimKg(e) && (!son || (e.startTs || 0) > (son.startTs || 0))) son = e; });
  return son ? fasonBirimKg(son) : null;
}
function fasonKalemMamul(k){
  return (typeof fpMamul === 'function' ? fpMamul(k) : '') || (typeof getTalepInfo === 'function' && k.talepNo ? (getTalepInfo(k.talepNo) || {}).malzemeAdi : '') || '';
}
function fasonKalemHazirla(k, anahtar, kgVar){
  const onceki = fasonOncekiBirimKg(k.isEmriNo), adet = Number(k.adet) || 0;
  const kg = kgVar != null ? kgVar : (onceki && adet ? Math.round(onceki * adet * 100) / 100 : null);
  return { anahtar, talepNo: k.talepNo, isEmriNo: k.isEmriNo, adet, mamul: fasonKalemMamul(k), onceki, oneri: kgVar == null && kg != null, kg: kg != null ? fasonKgYazi(kg) : '' };
}
/* baslat() doğrulamadan SONRA çağırır: kalemler = [{ talepNo, isEmriNo, adet }] */
function fasonIsilGerekli(makine, kalemler){
  if(!fasonIsilMakinesiMi(makine)){ fasonGonderim = null; return false; }
  const g = fasonGonderim;
  if(g && (g.atla || kalemler.every(k => g.kgler && g.kgler[fasonKalemAnahtar(k.talepNo, k.isEmriNo)] > 0))) return false;
  fasonGonderim = null;
  return fasonIsilGonderimAc(kalemler);
}
function fasonIsilGonderimAc(kalemler){
  if(!fasonIsilTurleri().length) return false;
  fasonIsilModal = { mod: 'gonderim', secili: {}, sertMin: '', sertMax: '',
    /* 21.10.2026 (Şeref KOLDAŞ): "çoklu iş emrinde her iş emrini tartıp adet yazıp kenara kaldırıyorum, sonra kg için
       başa dönmek zorluyor" — kg artık başlatma formunda adetle birlikte girilir (Kg (toplam)); burada dolu gelir. */
    kalemler: (kalemler || []).map(k => fasonKalemHazirla(k, fasonKalemAnahtar(k.talepNo, k.isEmriNo), fasonSayi(k.kg) > 0 ? fasonSayi(k.kg) : null)) };
  render();
  return true;
}
/* Satır altı: kutuya ne yazılacağı açık olsun (kullanıcı: "2 adedin ağırlığını mı yazıyor yoksa tek mi?") */
function fasonKalemIpucu(k){
  const kg = fasonSayi(k.kg), a = k.adet;
  if(kg > 0 && a && !k.oneri) return a > 1 ? `${a} adet toplam ${fasonKgYazi(kg)} kg → 1 adet = ${fasonKgYazi(kg / a)} kg` : `1 adet = ${fasonKgYazi(kg)} kg`;
  if(k.oneri && k.onceki) return `Geçen sefer 1 adet ${fasonKgYazi(k.onceki)} kg${a > 1 ? ` × ${a} adet` : ''} — doğruysa dokunmayın`;
  return a > 1 ? `${a} adedin hepsini birlikte tartın, toplamı yazın` : 'Parçayı tartıp yazın';
}
function fasonKalemKgYaz(i, v){
  const m = fasonIsilModal; if(!m || !m.kalemler || !m.kalemler[i]) return;
  const k = m.kalemler[i]; k.kg = String(v || '').replace(/[^0-9.,]/g, ''); k.oneri = false;
  const kg = fasonSayi(k.kg), b = document.getElementById('fis-birim-' + i), t = document.getElementById('fis-toplam');
  if(b) b.textContent = fasonKalemIpucu(k);
  if(t) t.textContent = fasonKgYazi(m.kalemler.reduce((s, x) => s + (fasonSayi(x.kg) || 0), 0)) + ' kg';
}
/* Eski / bilgisiz pakete sonradan bilgi (Isıl İşlem listesinden) */
function fasonIsilPaketBilgiAc(ids){
  if(!fasonIsilTurleri().length){ toast('Isıl işlem türleri tanımlı değil (Maliyet parametreleri)'); return; }
  const ilk = STATE.entries[ids[0]] || {};
  const tur = ilk.fasonIsilTur ? (Array.isArray(ilk.fasonIsilTur) ? ilk.fasonIsilTur : Object.values(ilk.fasonIsilTur)) : [];
  const s = ilk.fasonIsilSertlik || {};
  const eskiToplam = ilk.fasonPaket && Number(ilk.fasonPaket.kg) > 0 ? Number(ilk.fasonPaket.kg) : null;
  fasonIsilModal = { mod: 'paket', ids, secili: Object.fromEntries(tur.map(t => [t, true])), sertMin: s.min != null ? String(s.min) : '', sertMax: s.max != null ? String(s.max) : '',
    eskiToplam: ids.some(id => !(Number((STATE.entries[id] || {}).fasonKg) > 0)) ? eskiToplam : null,
    kalemler: ids.map(id => { const e = STATE.entries[id] || {};
      /* tek iş emirli eski pakette paket kg'si zaten o iş emrinin kg'si */
      const kgVar = Number(e.fasonKg) > 0 ? Number(e.fasonKg) : (ids.length === 1 && eskiToplam ? eskiToplam : null);
      return fasonKalemHazirla(e, id, kgVar); }) };
  render();
}
function fasonGonderimAlanlari(paketId, talepNo, isEmriNo){
  const g = fasonGonderim; if(!g || g.atla) return {};
  const kg = g.kgler && g.kgler[fasonKalemAnahtar(talepNo, isEmriNo)];
  return { fasonIsilTur: g.tur, fasonIsilSertlik: g.sertlik, ...(kg > 0 ? { fasonKg: kg } : {}),
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
    const kgler = {}; let kg = 0;
    for(let i = 0; i < (m.kalemler || []).length; i++){
      const k = m.kalemler[i], v = fasonSayi(k.kg);
      if(!(v > 0)){ toast(`${k.talepNo || k.isEmriNo}: parçaları tartıp kg yazın`); const el = document.getElementById('fis-kg-' + i); if(el) el.focus(); return; }
      kgler[k.anahtar] = Math.round(v * 1000) / 1000; kg += v;
    }
    if(!(kg > 0)){ toast('Ağırlık yazın'); return; }
    kg = Math.round(kg * 1000) / 1000;
    if(m.mod === 'gonderim'){
      fasonGonderim = { tur: secim, sertlik, kg, kgler };
      fasonIsilModal = null;
      baslat();   // asıl başlatma — bilgi kayda yazılır (bkz. fasonGonderimAlanlari)
      return;
    }
    const upd = {}, ilk = STATE.entries[m.ids[0]] || {};
    const paket = { ...(ilk.fasonPaket || {}), id: (ilk.fasonPaket && ilk.fasonPaket.id) || ilk.groupId || m.ids[0], kg: Math.round(kg * 1000) / 1000,
      ts: (ilk.fasonPaket && ilk.fasonPaket.ts) || ilk.startTs || Date.now(), gonderen: (ilk.fasonPaket && ilk.fasonPaket.gonderen) || ilk.operatorUsername || '',
      gonderenAd: (ilk.fasonPaket && ilk.fasonPaket.gonderenAd) || ilk.operatorName || '' };
    m.ids.forEach(id => { upd['entries/' + id + '/fasonIsilTur'] = secim; upd['entries/' + id + '/fasonIsilSertlik'] = sertlik; upd['entries/' + id + '/fasonPaket'] = paket; upd['entries/' + id + '/fasonKg'] = kgler[id]; });
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
        <div class="durus-modal-sub">${m.mod ? 'Bu pakete hangi ısıl işlem yapılacak? Tür, istenen sertlik ve her iş emrinin kg\'si — satın alma isteği bu bilgiyle açılır.' : 'Fasondan dönen parçaya hangi ısıl işlem yapıldı? Birden fazla seçilebilir.'}</div></div>
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
            <input id="fis-sert-max" class="mono" inputmode="decimal" placeholder="max" value="${esc(m.sertMax)}" oninput="fasonIsilModal.sertMax=this.value.replace(/[^0-9.,]/g,'')" onkeydown="if(event.key==='Enter'){ const kg=document.getElementById('fis-kg-0'); if(kg) kg.focus(); else fasonIsilKaydet(false); }">
            <em>HRC</em>
          </div>
          ${(() => { const son = fasonIsilSonAraliklar(); return son.length ? `<div class="fis-sertlik-son">${son.map(([a, b]) => `<button type="button" class="chip ${String(m.sertMin) === String(a) && String(m.sertMax) === String(b) ? 'active' : ''}" onclick="fasonIsilModal.sertMin='${a}'; fasonIsilModal.sertMax='${b}'; render()">${a === b ? a : a + '–' + b}</button>`).join('')}</div>` : ''; })()}
          ${m.mod ? `<div class="fis-sertlik-bas" style="margin-top:12px">Ağırlık <span>her iş emrinin tüm parçaları birlikte — toplam kg</span></div>
          <div class="fis-kalemler">${(m.kalemler || []).map((k, i, l) => { const kg = fasonSayi(k.kg); return `<div class="fis-kalem">
            <div class="fis-kalem-ad"><b class="mono">${esc(k.talepNo || k.isEmriNo || '—')}</b><span>${esc(k.mamul || k.isEmriNo || '')}</span></div>
            <div class="fis-kalem-adet">${k.adet} adet</div>
            <span class="mb-girdi-kutu"><input id="fis-kg-${i}" class="mono" inputmode="decimal" placeholder="${k.adet > 1 ? 'toplam' : 'ağırlık'}" value="${esc(k.kg)}" oninput="fasonKalemKgYaz(${i}, this.value)" onkeydown="if(event.key==='Enter'){ const s=document.getElementById('fis-kg-${i + 1}'); if(s) s.focus(); else fasonIsilKaydet(false); }"><em>kg</em></span>
            <div class="fis-kalem-birim" id="fis-birim-${i}">${esc(fasonKalemIpucu(k))}</div>
          </div>`; }).join('')}</div>
          <div class="fis-toplam"><span>Paket toplamı${m.eskiToplam ? ` <em>(eski kayıt: ${fasonKgYazi(m.eskiToplam)} kg)</em>` : ''}</span><b id="fis-toplam">${fasonKgYazi((m.kalemler || []).reduce((s, x) => s + (fasonSayi(x.kg) || 0), 0))} kg</b></div>` : ''}
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
