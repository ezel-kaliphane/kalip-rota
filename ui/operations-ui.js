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

