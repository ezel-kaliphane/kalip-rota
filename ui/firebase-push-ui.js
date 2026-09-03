/* ===================== UI: BİLDİRİM GEÇMİŞİ GÖRÜNÜMLERİ =====================
   js/firebase-push.js'ten ayrıldı -- iş mantığı orada kaldı, sadece render* fonksiyonları burada. */
function renderMyPushHistoryModal(){
  return `<div class="modal-overlay" onclick="if(event.target===this) closeMyPushHistoryModal()">
    <div class="modal-box">
      <div class="modal-header">
        <div><div class="modal-title">${ico('bell',14)} Bildirimlerim</div><div class="modal-sub">Sana gönderilen son 30 bildirim</div></div>
        <button class="icon-btn" onclick="closeMyPushHistoryModal()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">${renderMyPushHistoryList()}</div>
    </div>
  </div>`;
}

function renderMyPushHistoryList(){
  const list = myPushHistory();
  if(list.length===0) return `<div style="font-size:12px;color:var(--text-muted);margin-top:16px">Henüz hiç bildirim almadın.</div>`;
  return `<div style="margin-top:20px">
    <div class="set-sec" style="margin:0 0 9px">SON BİLDİRİMLER (${list.length})</div>
    <div style="display:flex;flex-direction:column;gap:6px;max-width:520px">
      ${list.map(h=>`<div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 12px">
        <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:2px">
          <span style="font-size:12.5px;font-weight:600">${esc(h.title||'Rota Takip')}</span>
          <span style="font-size:10.5px;color:var(--text-muted);white-space:nowrap">${fmtDT(h.sentAt)}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted)">${esc(h.body||'')}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

