/* ===================== UI: OPERASYON MODALLARI =====================
   js/operations.js'ten ayrıldı -- iş mantığı orada kaldı, sadece render* fonksiyonları burada. */
function renderDurusModal(){
  const canStart = durusReasonSel && (durusReasonSel!=='Diğer' || durusCustom.trim());
  return `<div class="durus-modal-overlay" onclick="if(event.target===this) closeDurusModalAny()">
    <div class="durus-modal-panel">
      <div class="durus-modal-handle" style="cursor:pointer" onclick="closeDurusModalAny()" title="Kapat"></div>
      <div class="durus-modal-header">
        <div><div class="durus-modal-title">Duruş nedeni</div><div class="durus-modal-sub">Rapora bu yazılacak.</div></div>
        <button class="icon-btn" onclick="closeDurusModalAny()">${ico('x',16)}</button>
      </div>
      <div class="durus-modal-list" id="durus-picker-inner">${durusOptionsListHtml()}</div>
      <div class="durus-modal-footer">
        <button class="durus-modal-footer-btn" id="durus-start-btn" ${canStart?'':'disabled'} onclick="confirmDurusAny()">Duruşu Başlat</button>
      </div>
    </div>
  </div>`;
}

function renderNextOpModal(){
  const canStart = !!nextOpMachineSel;
  return `<div class="durus-modal-overlay" onclick="if(event.target===this) closeNextOpModal()">
    <div class="durus-modal-panel">
      <div class="durus-modal-handle" style="cursor:pointer" onclick="closeNextOpModal()" title="Kapat"></div>
      <div class="durus-modal-header">
        <div><div class="durus-modal-title">${(kaliteBekleyen[nextOpPendingId]||kaliteBekleyen['g:'+nextOpPendingGroupId]) ? 'Red — Düzeltme' : 'Sıradaki Operasyon'}</div><div class="durus-modal-sub">${(kaliteBekleyen[nextOpPendingId]||kaliteBekleyen['g:'+nextOpPendingGroupId]) ? 'Red verilen iş emri düzeltme için hangi makineye gidiyor?' : 'Bu iş emri şimdi hangi makineye gidecek?'}</div></div>
        <button class="icon-btn" onclick="closeNextOpModal()">${ico('x',16)}</button>
      </div>
      <div class="durus-modal-list" id="nextop-picker-inner">${nextOpOptionsListHtml()}</div>
      <div class="durus-modal-footer">
        <button class="durus-modal-footer-btn" id="nextop-start-btn" ${canStart?'':'disabled'} onclick="confirmNextOp()">Onayla ve Bitir</button>
      </div>
    </div>
  </div>`;
}

function renderMachineAccessModal(){
  const code = machineAccessModalCode;
  const op = STATE.operators[code];
  if(!op){ machineAccessModalCode=null; return ''; }
  const allowed = op.allowedMachines ? Object.keys(op.allowedMachines).filter(k=>op.allowedMachines[k]) : allMachineCodes();
  return `<div class="modal-overlay" onclick="if(event.target===this) closeMachineAccessModal()">
    <div class="modal-box" style="max-width:900px">
      <div class="modal-header">
        <div><div class="modal-title">Makine Erişimi</div><div class="modal-sub">${esc(code)} · ${esc(op.displayName)}</div></div>
        <button class="icon-btn" onclick="closeMachineAccessModal()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px">İşaretli makineler bu operatörün "Çalışılan Makine" listesinde görünür.</div>
        <div class="machine-grid">${allMachines().map(m=>`
          <label class="machine-check-row"><input type="checkbox" ${allowed.includes(m.code)?'checked':''} onchange="toggleMachineAccess('${code}','${m.code}')"><span class="mono" style="color:var(--accent);font-weight:700">${m.code}</span> ${esc(m.name)}</label>
        `).join('')}</div>
      </div>
    </div>
  </div>`;
}
function renderKaliteModal(){
  const m = kaliteModal; if(!m) return '';
  const e = m.id ? (STATE.entries[m.id]||{}) : null, uyeler = m.groupId ? groupMembersOf(m.groupId) : [];
  const baslik = e ? `${esc(e.talepNo||e.isEmriNo||'')}${e.adet?` · ${esc(e.adet)} adet`:''}` : `${uyeler.length} iş emri birlikte`;
  const btn = (k, ad, renk) => `<button type="button" class="kal-sonuc ${m.sonuc===k?'on':''}" style="--kc:${renk}" onclick="kaliteSec('sonuc','${k}')">${ad}</button>`;
  const sorunlu = m.sonuc && m.sonuc!=='onay';
  const nedenler = [...kaliteNedenleri(), 'Diğer'];
  const onayMetni = !m.sonuc ? 'Sonucu seçin' : m.sonuc==='onay' ? 'Onayla ve Bitir' : m.sonuc==='sartli' ? 'Şartlı Kabul ile Bitir' : 'Red — Düzeltmeye Gönder';
  return `<div class="durus-modal-overlay" onclick="if(event.target===this) kaliteModalKapat()">
    <div class="durus-modal-panel">
      <div class="durus-modal-handle" style="cursor:pointer" onclick="kaliteModalKapat()" title="Kapat"></div>
      <div class="durus-modal-header">
        <div><div class="durus-modal-title">Final Kalite Kontrol</div><div class="durus-modal-sub">${baslik}</div></div>
        <button class="icon-btn" onclick="kaliteModalKapat()">${ico('x',16)}</button>
      </div>
      <div class="durus-modal-list">
        <div class="kal-sonuclar">${btn('onay','Onay','var(--success)')}${btn('sartli','Şartlı kabul','var(--warn)')}${btn('red','Red','var(--danger)')}</div>
        ${sorunlu ? `
          ${m.groupId ? `<div class="kal-not">Sonuç gruptaki bütün iş emirlerine kendi adetleriyle yazılır.</div>` : `
          <div class="kal-adetler">
            <div class="field"><label for="kal-kontrol">Kontrol edilen adet</label>
              <input id="kal-kontrol" inputmode="numeric" value="${esc(m.kontrolAdet)}" oninput="this.value=this.value.replace(/\\D/g,''); kaliteModal.kontrolAdet=this.value"></div>
            <div class="field"><label for="kal-sorunlu">${m.sonuc==='red'?'Red':'Şartlı kabul'} adet</label>
              <input id="kal-sorunlu" inputmode="numeric" value="${esc(m.sorunluAdet)}" oninput="this.value=this.value.replace(/\\D/g,''); kaliteModal.sorunluAdet=this.value"></div>
          </div>`}
          <div class="durus-option-divider">NEDEN</div>
          ${nedenler.map(n=>`<button type="button" class="durus-option-card ${n==='Diğer'?'dashed':''}" style="${m.neden===n?'border-color:var(--accent);background:var(--accent-dim)':''}" onclick="kaliteSec('neden','${escJs(n)}')">
            <span class="durus-radio" style="${m.neden===n?'border-color:var(--accent)':''}"><span style="width:10px;height:10px;border-radius:50%;background:${m.neden===n?'var(--accent)':'transparent'}"></span></span>
            <span class="durus-option-name" style="${m.neden===n?'color:var(--accent)':''}">${esc(n)}</span></button>`).join('')}
          <div class="field" style="margin-top:6px"><label for="kal-aciklama">Açıklama${m.neden==='Diğer'?' (zorunlu)':' (isteğe bağlı)'}</label>
            <input id="kal-aciklama" placeholder="ör. Ø12 h7 ölçüsü 12,04 çıktı" value="${esc(m.aciklama)}" oninput="kaliteModal.aciklama=this.value"></div>
          ${m.sonuc==='red' ? `<div class="kal-not">Red verilen iş emri kapanmaz — sonraki adımda düzeltme için gideceği makineyi seçeceksin.</div>` : ''}
        ` : m.sonuc==='onay' ? `<div class="kal-not">Onaylanan iş emrinin rotası kapanır.</div>` : `<div class="kal-not">Onay, şartlı kabul ya da red seç.</div>`}
      </div>
      <div class="durus-modal-footer">
        <button class="durus-modal-footer-btn" ${m.sonuc?'':'disabled'} onclick="kaliteOnayla()">${onayMetni}</button>
      </div>
    </div>
  </div>`;
}
