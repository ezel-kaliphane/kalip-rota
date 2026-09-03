/* ===================== UI: TADİLAT MODAL GÖRÜNÜMLERİ =====================
   js/tadilat.js'ten ayrıldı -- iş mantığı orada kaldı, sadece render* fonksiyonları burada. */
function renderTadilatEditModal(){
  const t = tadilatlar[tadilatEditId];
  if(!t || !tadilatEditForm){ tadilatEditId=null; return ''; }
  const f = tadilatEditForm;
  return `<div class="modal-overlay" onclick="if(event.target===this) cancelTadilatEdit()">
    <div class="modal-box" style="max-width:460px">
      <div class="modal-header">
        <div><div class="modal-title" style="font-size:18px">Tadilat Talebini Düzelt</div><div class="modal-sub">${fmtDT(t.olusturmaTs)} · ${esc(t.olusturanName)}</div></div>
        <button class="icon-btn" onclick="cancelTadilatEdit()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;align-items:flex-end">
          <div class="field" style="flex:1.3;margin-bottom:0"><label>U kodu</label><input id="tedit-ukodu" class="mono" value="${esc(f.uKodu)}" oninput="tadilatEditForm.uKodu=this.value" onblur="tadUkoduBlur('edit')"></div>
          <button type="button" class="btn-ghost" style="padding:10px 14px" title="Malzeme Ara" onclick="openMalzemeArama('edit')">${ico('search',14)}</button>
          <div class="field" style="flex:1;margin-bottom:0"><label>Adet</label><input id="tedit-adet" inputmode="numeric" value="${esc(f.adet)}" oninput="this.value=this.value.replace(/\\D/g,''); tadilatEditForm.adet=this.value"></div>
        </div>
        <div class="field" style="margin-top:14px"><label>Açıklama</label><input id="tedit-kisaaciklama" value="${esc(f.kisaAciklama)}" oninput="tadilatEditForm.kisaAciklama=this.value; tadilatEditForm.aciklamaManual=true"></div>
        <div style="display:flex;gap:8px">
          <div class="field" style="flex:1"><label>Talep eden bölüm</label><input id="tedit-bolum" list="tadilat-bolum-options" value="${esc(f.bolum)}" oninput="tadilatEditForm.bolum=this.value" onblur="render()"></div>
          <div class="field" style="flex:1"><label>Talep edilen makine</label><input id="tedit-makine" list="tadilat-makine-options-edit" value="${esc(f.talepMakine)}" oninput="tadilatEditForm.talepMakine=this.value"></div>
        </div>
        <datalist id="tadilat-bolum-options">${tadilatBolumOptions().map(b=>`<option value="${b}">`).join('')}</datalist>
        <datalist id="tadilat-makine-options-edit">${isMerkezleriFor(f.bolum).map(k=>`<option value="${esc(k)}">`).join('')}</datalist>
        <div class="field"><label>Talep eden kişi (ad soyad)</label><input id="tedit-kisi" list="uretim-personeli-options-edit" value="${esc(f.talepEdenKisi)}" oninput="tadilatEditForm.talepEdenKisi=this.value"></div>
        <datalist id="uretim-personeli-options-edit">${uretimPersoneliFor(f.bolum).map(p=>`<option value="${esc(p)}">`).join('')}</datalist>

        ${session.isSuperAdmin ? `
        <div class="field"><label>Atölye</label><select id="tedit-atolye">
          <option value="imalat" ${f.atolye==='imalat'?'selected':''}>${ico('factory',14)} İmalat Atölye</option>
          <option value="tadilat" ${f.atolye==='tadilat'?'selected':''}>${ico('wrench',14)} Tadilat Atölye</option>
        </select></div>` : `
        <input type="hidden" id="tedit-atolye" value="${esc(f.atolye)}">
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px">Atölye: ${f.atolye==='tadilat'?(ico('wrench',14)+' Tadilat Atölye'):(ico('factory',14)+' İmalat Atölye')}</div>`}
        <div class="field"><label>Ne işlem yapılacak?</label><textarea id="tedit-aciklama" oninput="tadilatEditForm.aciklama=this.value" style="min-height:80px">${esc(f.aciklama)}</textarea></div>
        <div style="display:flex;gap:10px">
          <button class="btn-primary" onclick="saveTadilatEdit('${tadilatEditId}')">${ico('check',14)} Kaydet</button>
          <button class="btn-ghost" onclick="cancelTadilatEdit()">${ico('x',14)} Vazgeç</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderReportEditModal(){
  const e = STATE.entries[reportEditId];
  if(!e || !reportEditForm){ reportEditId=null; return ''; }
  const f = reportEditForm;
  return `<div class="modal-overlay" onclick="if(event.target===this) closeReportEdit()">
    <div class="modal-box" style="max-width:480px">
      <div class="modal-header">
        <div><div class="modal-title" style="font-size:18px">Kaydı Düzelt</div><div class="modal-sub">${esc(e.makine||'—')} · ${dateKey(e.startTs)}</div></div>
        <button class="icon-btn" onclick="closeReportEdit()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>İş Emri No (U kodu)</label><input id="redit-isemri" class="mono" value="${esc(f.isEmriNo)}"></div>
        <div class="field"><label>İş Talep No</label><input id="redit-talepno" class="mono" value="${esc(f.talepNo)}"></div>
        <div style="display:flex;gap:8px">
          <div class="field" style="flex:1"><label>Malzeme Cinsi</label><input id="redit-malzeme" value="${esc(f.malzemeCinsi)}"></div>
          <div class="field" style="flex:1"><label>Çap ve Boy</label><input id="redit-capboy" value="${esc(f.capBoy)}"></div>
        </div>
        <div style="display:flex;gap:8px">
          <div class="field" style="flex:1"><label>Adet</label><input id="redit-adet" inputmode="numeric" value="${esc(f.adet)}"></div>
          <div class="field" style="flex:1"><label>Durum</label><select id="redit-status" onchange="reportEditForm.status=this.value; render()">
            <option value="devam" ${f.status==='devam'?'selected':''}>Devam Ediyor</option>
            <option value="duruş" ${f.status==='duruş'?'selected':''}>Duruşta</option>
            <option value="tamamlandi" ${f.status==='tamamlandi'?'selected':''}>Tamamlandı</option>
          </select></div>
        </div>
        <div style="display:flex;gap:8px">
          <div class="field" style="flex:1"><label>Başlangıç</label><input id="redit-baslangic" type="datetime-local" value="${f.baslangic}"></div>
          ${f.status==='tamamlandi' ? `<div class="field" style="flex:1"><label>Bitiş</label><input id="redit-bitis" type="datetime-local" value="${f.bitis}"></div>` : ''}
        </div>
        ${f.status==='duruş' ? `
        <div class="field"><label>Duruş Nedeni</label><select id="redit-durusnedeni" onchange="reportEditForm.duruşNedeni=this.value; render()">
          ${getDurusReasons().map(r=>`<option value="${esc(r)}" ${f.duruşNedeni===r?'selected':''}>${esc(r)}</option>`).join('')}
        </select></div>
        ${f.duruşNedeni==='Diğer' ? `<div class="field"><label>Neden (serbest metin)</label><input id="redit-durusnedeni-custom" value="${esc(f.duruşNedeniCustom||'')}" oninput="reportEditForm.duruşNedeniCustom=this.value"></div>` : ''}
        ` : ''}
        <div class="field"><label>Not</label><input id="redit-not" value="${esc(f.not)}"></div>
        ${switchRow('redit-sonop', f.sonOperasyon, 'Son Operasyon', 'Bu rotanın son adımı mı', {style:'margin-bottom:14px'})}
        <div style="display:flex;gap:10px">
          <button class="btn-ghost" style="flex:1" onclick="closeReportEdit()">Vazgeç</button>
          <button class="btn-primary" style="flex:1" onclick="saveReportEdit()">Kaydet</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderSendMessageModal(){
  return `<div class="modal-overlay" onclick="if(event.target===this) cancelSendMessage()">
    <div class="modal-box" style="max-width:400px">
      <div class="modal-header">
        <div><div class="modal-title">Mesaj Gönder</div><div class="modal-sub">💡 Öneri, sorun ya da aklına gelen her şey</div></div>
        <button class="icon-btn" onclick="cancelSendMessage()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Mesajın</label><textarea id="send-msg-text" style="min-height:110px" placeholder="Aklına gelen öneriyi ya da bahsetmek istediğin şeyi yaz…"></textarea></div>
        <div style="display:flex;gap:10px">
          <button class="btn-primary" onclick="submitSendMessage()">${ico('check',14)} Gönder</button>
          <button class="btn-ghost" onclick="cancelSendMessage()">${ico('x',14)} Vazgeç</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderMessagesModal(){
  const list = Object.entries(STATE.messages||{}).map(([id,m])=>({id,...m})).sort((a,b)=>b.ts-a.ts);
  return `<div class="modal-overlay" onclick="if(event.target===this) closeMessagesModal()">
    <div class="modal-box">
      <div class="modal-header">
        <div><div class="modal-title">Mesajlar</div><div class="modal-sub">Değişiklik bildirimleri ve serbest mesajlar</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          ${session.isSuperAdmin && list.length>0 ? `<button class="btn-ghost" style="border-color:var(--danger);color:var(--danger);font-size:11.5px" onclick="deleteAllMessages()">${ico('trash',14)} Tümünü Sil</button>` : ''}
          <button class="icon-btn" onclick="closeMessagesModal()">${ico('x',14)}</button>
        </div>
      </div>
      <div class="modal-body">
        ${list.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:30px 0">Henüz mesaj yok.</div>` : list.map(m=>`
          <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              <div style="font-weight:700;color:var(--accent);font-size:13.5px;margin-bottom:2px">${m.type==='manual'?(ico('mail',14)+' Serbest Mesaj'):(ico('edit',14)+' İş Üzerinde Değişiklik')}</div>
              ${session.isSuperAdmin ? `<button class="del-btn" onclick="deleteMessage('${m.id}')" title="Sil">${ico('trash',14)}</button></div>` : `</div>`}
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${fmtDT(m.ts)}</div>
            ${m.type==='manual' ? `
              <div class="mono" style="font-size:12.5px;color:var(--text-muted);margin-bottom:6px">${esc(m.operatorUsername)} · ${esc(m.operatorName)}</div>
              <div style="font-size:13px;white-space:pre-wrap">${esc(m.text)}</div>
            ` : `
              <div class="mono" style="font-size:12.5px;color:var(--text-muted);margin-bottom:6px">${esc(m.operatorUsername)} · ${esc(m.operatorName)} · ${esc((m.makine||'').split(' · ')[0]||'—')}</div>
              ${(m.changes||[]).map(c=>`<div style="font-size:12.5px;margin-top:4px"><b>${esc(c.field)}</b> değiştirildi — Eskiden: <span style="color:var(--danger)">${esc(c.oldValue)}</span> · Şimdi: <span style="color:var(--success)">${esc(c.newValue)}</span></div>`).join('')}
            `}
          </div>
        `).join('')}
      </div>
    </div>
  </div>`;
}

