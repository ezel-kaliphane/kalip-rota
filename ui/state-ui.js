/* ===================== UI: DURUM UYARI MODALLARI =====================
   js/state.js'ten ayrıldı -- state değişkenleri ve aç/kapa fonksiyonları orada kaldı,
   sadece render* fonksiyonları burada. */
function renderUzunDurusModal(){
  const list = uzunDurusluKayitlar();
  return `<div class="modal-overlay" onclick="if(event.target===this) closeUzunDurusModal()">
    <div class="modal-box">
      <div class="modal-header">
        <div><div class="modal-title">${ico('alert',14)} Uzun Süredir Duruşta</div><div class="modal-sub">Eşik: ${uzunDurusEsikMs()/60000} dk ve üzeri</div></div>
        <button class="icon-btn" onclick="closeUzunDurusModal()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        ${list.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:30px 0">Şu an eşiği aşan duruş yok.</div>` : `
        <div class="table-wrap" style="padding:0"><table><thead><tr><th>Makine</th><th>İş Emri</th><th>Operatör</th><th>Neden</th><th>Süre</th>${session.isSuperAdmin?'<th></th>':''}</tr></thead><tbody>
          ${list.map(r=>`<tr><td class="mono" style="color:var(--accent)">${esc((r.makine||'').split(' · ')[0]||'—')}</td><td class="mono">${esc(r.isEmriNo||'—')}</td><td>${esc(r.operatorName||r.operatorUsername||'—')}</td><td style="color:var(--warn)">${esc(r.neden||'—')}</td><td style="font-weight:700;color:var(--danger)">${fmtDur(r.ms)}</td>${session.isSuperAdmin?`<td>${r.tur==='entry'?`<button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="closeUzunDurusModal(); openReportEdit('${escJs(r.ref.id)}')">Düzelt</button>`:''}</td>`:''}</tr>`).join('')}
        </tbody></table></div>
        ${session.isSuperAdmin ? `<div style="font-size:11px;color:var(--text-muted);margin-top:10px">"Düzelt" ile — operatörün kullanıcısına girmeden — bu kaydın durumunu/nedenini/saatlerini değiştirebilirsin (ör. yanlışlıkla farklı bir neden girilmiş bir duruşu "Gün Sonu"na çevirmek gibi). Tadilat operasyonları için bu düzeltme henüz desteklenmiyor.</div>` : ''}`}
      </div>
    </div>
  </div>`;
}

function renderUzunDevamEdenModal(){
  const list = uzunDevamEdenKayitlar();
  return `<div class="modal-overlay" onclick="if(event.target===this) closeUzunDevamEdenModal()">
    <div class="modal-box">
      <div class="modal-header">
        <div><div class="modal-title">${ico('alert',14)} Uzun Süredir Devam Ediyor</div><div class="modal-sub">Eşik: ${Math.round(uzunDevamEdenEsikMs()/3600000)} saat ve üzeri — muhtemelen kapatılmayı unutulmuş</div></div>
        <button class="icon-btn" onclick="closeUzunDevamEdenModal()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        ${list.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:30px 0">Şu an eşiği aşan devam eden kayıt yok.</div>` : `
        <div class="table-wrap" style="padding:0"><table><thead><tr><th>Makine</th><th>İş Emri</th><th>Operatör</th><th>Süre</th></tr></thead><tbody>
          ${list.map(r=>`<tr><td class="mono" style="color:var(--accent)">${esc((r.makine||'').split(' · ')[0]||'—')}</td><td class="mono">${esc(r.isEmriNo||'—')}</td><td>${esc(r.operatorName||r.operatorUsername||'—')}</td><td style="font-weight:700;color:var(--danger)">${fmtDur(r.ms)}</td></tr>`).join('')}
        </tbody></table></div>`}
      </div>
    </div>
  </div>`;
}

function renderKismiAktarModal(){
  const e = STATE.entries[kismiAktarId];
  if(!e){ kismiAktarId=null; return ''; }
  return `<div class="modal-overlay" onclick="if(event.target===this) cancelKismiAktar()">
    <div class="modal-box" style="max-width:400px">
      <div class="modal-header">
        <div><div class="modal-title" style="font-size:18px">${ico('shuffle',14)} Kısmi Aktar</div><div class="modal-sub">${esc(e.talepNo||e.isEmriNo)} · Mevcut adet: ${esc(e.adet)}</div></div>
        <button class="icon-btn" onclick="cancelKismiAktar()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Kaç adet hazır, bir sonraki operasyona aktarılsın?</label><input id="kismi-aktar-adet" inputmode="numeric" placeholder="ör. 200" oninput="this.value=this.value.replace(/\\D/g,'')" autofocus></div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">Bu miktar mevcut kayıttan düşülür ve ayrı, bekleyen bir parti olarak işaretlenir. Aynı Talep No ile yeni bir kayıt açan (bir sonraki operasyonu yapacak) kişi otomatik olarak bu partiye bağlanır. Sen kalan adetle burada çalışmaya devam edersin.</div>
        <div style="display:flex;gap:10px">
          <button class="btn-primary" onclick="confirmKismiAktar('${kismiAktarId}')">${ico('check',14)} Aktar</button>
          <button class="btn-ghost" onclick="cancelKismiAktar()">${ico('x',14)} Vazgeç</button>
        </div>
      </div>
    </div>
  </div>`;
}

