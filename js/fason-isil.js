/* ==================== FASON ISIL İŞLEM DÖNÜŞÜ (12.10.2026, kullanıcı: "tür başına kg; fason
   dönüşünde otomatik hesaplansın katsayılarla") ====================
   FII01 (ya da adında "ısıl" geçen fason makine) işi BİTİRİLİRKEN "Hangi ısıl işlem yapıldı?" sorulur
   (çoklu seçim, atlanabilir); seçim entries/{id}/fasonIsilTur = [tür adları]. Maliyet: çelik kg × her
   seçilen türün kg fiyatı (js/maliyet.js). Tür ADLARI fiyatsız olarak settings/isilIslemTurleri'nde
   (operatör cihazı şifreli parametreleri çözemez); fiyatlar şifreli kalır. Liste SuperAdmin maliyet
   parametrelerini kaydedince / açınca güncellenir. Liste boşsa soru sorulmaz, bitirme engellenmez. */
let fasonIsilModal = null;          // { id, groupId, secili:{tur:true} }
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
  fasonIsilModal = { id, groupId, secili: {} };
  render();
  return true;
}
function fasonIsilKaydet(atla){
  const m = fasonIsilModal; if(!m) return;
  const secim = atla ? [] : Object.keys(m.secili).filter(k => m.secili[k]);
  if(!atla && !secim.length){ toast('En az bir tür seçin ya da "Bilmiyorum" deyin'); return; }
  const ids = m.groupId ? groupMembersOf(m.groupId).map(e => e.id) : [m.id];
  if(secim.length){
    const upd = {}; ids.forEach(id => { upd['entries/' + id + '/fasonIsilTur'] = secim; });
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
      <div class="durus-modal-header"><div><div class="durus-modal-title">Fason ısıl işlem</div>
        <div class="durus-modal-sub">Fasondan dönen parçaya hangi ısıl işlem yapıldı? Birden fazla seçilebilir.</div></div>
        <button class="icon-btn" onclick="fasonIsilModal=null; render()">${ico('x',16)}</button></div>
      <div class="durus-modal-list">
        ${turler.map(t => { const on = !!m.secili[t]; return `<button class="durus-option-card" style="${on ? 'border-color:var(--accent);background:var(--accent-dim)' : ''}" onclick="fasonIsilModal.secili['${escJs(t)}']=!fasonIsilModal.secili['${escJs(t)}']; render()">
          <span class="durus-radio" style="${on ? 'border-color:var(--accent)' : ''};border-radius:5px"><span style="width:10px;height:10px;border-radius:2px;background:${on ? 'var(--accent)' : 'transparent'}"></span></span>
          <span class="durus-option-name" style="${on ? 'color:var(--accent)' : ''}">${esc(t)}</span></button>`; }).join('')}
        <button class="durus-option-card dashed" onclick="fasonIsilKaydet(true)"><span class="durus-option-name" style="color:var(--text-muted)">Bilmiyorum / atla</span></button>
      </div>
      <div class="durus-modal-footer"><button class="durus-modal-footer-btn" onclick="fasonIsilKaydet(false)">Kaydet ve devam et</button></div>
    </div></div>`;
}
/* SuperAdmin'in cihazı: parametrelerdeki tür adlarını (fiyatsız) operatörlerin görebileceği yere yaz */
function fasonIsilTurleriEsitle(p){
  if(!(typeof canEditMaliyet === 'function' && canEditMaliyet()) || !p) return;
  const adlar = (p.isil || []).map(i => String(i.tur || '').trim()).filter(Boolean);
  if(JSON.stringify(adlar) === JSON.stringify(fasonIsilTurleri())) return;
  DB.ref('settings/isilIslemTurleri').set(adlar.length ? adlar : null).catch(() => {});
}
