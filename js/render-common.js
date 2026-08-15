/* ===================== MAKİNE DETAY MODAL ===================== */
function openMachineDetail(code){ machineModal = code; modalDateFilter=''; modalSelectedIds = new Set(); render(); }
function closeMachineDetail(){ machineModal = null; modalSelectedIds = new Set(); render(); }
function setModalDateFilter(v){ modalDateFilter = v; modalSelectedIds = new Set(); render(); }
function toggleModalSelect(id){ if(modalSelectedIds.has(id)) modalSelectedIds.delete(id); else modalSelectedIds.add(id); render(); }
function toggleModalSelectAll(){
  const allSelected = modalVisibleIds.length>0 && modalVisibleIds.every(id=>modalSelectedIds.has(id));
  if(allSelected){ modalVisibleIds.forEach(id=>modalSelectedIds.delete(id)); }
  else { modalVisibleIds.forEach(id=>modalSelectedIds.add(id)); }
  render();
}
function deleteModalRecord(id){
  if(!requireSuperAdmin()) return;
  if(!confirm('Bu kaydı silmek istediğine emin misin? Bu işlem geri alınamaz.')) return;
  DB.ref('entries/'+id).remove();
  modalSelectedIds.delete(id);
  toast('Kayıt silindi');
}
// Makine Matrisi detayında görünen tadilat satırları, entries değil tadilatlar/$id/operasyonlar/$opId
// altında yaşıyor — silme isteği geldiğinde oraya gidip o TEK operasyonu siliyoruz.
function deleteMachineModalTadilatRow(rowId){
  if(!session || !session.isSuperAdmin){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return; }
  const m = rowId.match(/^tad-(.+)-([^-]+)$/);
  if(!m) return;
  const [, tadilatId, opId] = m;
  if(!confirm('Bu tadilat operasyon kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
  DB.ref(`tadilatlar/${tadilatId}/operasyonlar/${opId}`).remove().then(()=>toast('Tadilat kaydı silindi'));
}
function tsToLocalInputStr(ts){
  if(!ts) return '';
  const d = new Date(ts);
  const pad = n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
let tadilatRowEditId = null;
let tadilatRowEditForm = null;
function openTadilatRowEdit(rowId){
  if(!session || !session.isSuperAdmin) return;
  const m = rowId.match(/^tad-(.+)-([^-]+)$/);
  if(!m) return;
  const [, tadilatId, opId] = m;
  const t = tadilatlar[tadilatId]; if(!t) return;
  const op = t.operasyonlar && t.operasyonlar[opId]; if(!op) return;
  tadilatRowEditId = rowId;
  tadilatRowEditForm = {
    tadilatId, opId,
    baslangic: tsToLocalInputStr(op.baslamaTs), bitis: tsToLocalInputStr(op.bitisTs),
    status: op.status||'devam', sonOperasyon: !!op.sonOperasyon
  };
  render();
}
function cancelTadilatRowEdit(){ tadilatRowEditId=null; tadilatRowEditForm=null; render(); }
function saveTadilatRowEdit(){
  if(!session || !session.isSuperAdmin || !tadilatRowEditForm) return;
  const f = tadilatRowEditForm;
  const baslangicStr = document.getElementById('trowedit-baslangic')?.value;
  const bitisStr = document.getElementById('trowedit-bitis')?.value;
  const status = document.getElementById('trowedit-status')?.value || 'devam';
  const sonOperasyon = !!document.getElementById('trowedit-sonop')?.checked;
  if(!baslangicStr){ toast('Başlangıç zamanı boş olamaz'); return; }
  const baslamaTs = new Date(baslangicStr).getTime();
  if(isNaN(baslamaTs)){ toast('Başlangıç zamanı geçersiz'); return; }
  const patch = { status, sonOperasyon, baslamaTs };
  if(status==='tamamlandi'){
    const bitisTs = bitisStr ? new Date(bitisStr).getTime() : Date.now();
    if(isNaN(bitisTs)){ toast('Bitiş zamanı geçersiz'); return; }
    patch.bitisTs = bitisTs;
  } else {
    patch.bitisTs = null;
  }
  DB.ref(`tadilatlar/${f.tadilatId}/operasyonlar/${f.opId}`).update(patch).then(()=>{
    toast('Tadilat operasyonu güncellendi');
    cancelTadilatRowEdit();
  });
}
function renderTadilatRowEditModal(){
  const f = tadilatRowEditForm;
  const t = f && tadilatlar[f.tadilatId];
  if(!f || !t){ tadilatRowEditId=null; return ''; }
  return `<div class="modal-overlay" onclick="if(event.target===this) cancelTadilatRowEdit()">
    <div class="modal-box" style="max-width:420px">
      <div class="modal-header">
        <div><div class="modal-title" style="font-size:18px">Tadilat Operasyonunu Düzelt</div><div class="modal-sub">${ico('wrench',14)} ${esc(t.uKodu)}</div></div>
        <button class="icon-btn" onclick="cancelTadilatRowEdit()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Başlangıç</label><input id="trowedit-baslangic" type="datetime-local" value="${f.baslangic}"></div>
        <div class="field"><label>Durum</label><select id="trowedit-status" onchange="tadilatRowEditForm.status=this.value; render()">
          <option value="devam" ${f.status==='devam'?'selected':''}>Devam Ediyor</option>
          <option value="tamamlandi" ${f.status==='tamamlandi'?'selected':''}>Tamamlandı</option>
        </select></div>
        ${f.status==='tamamlandi' ? `<div class="field"><label>Bitiş</label><input id="trowedit-bitis" type="datetime-local" value="${f.bitis}"></div>` : ''}
        ${switchRow('trowedit-sonop', f.sonOperasyon, 'Son Operasyon', 'Bitince tadilat kapanır', {style:'margin-bottom:14px'})}
        <div style="display:flex;gap:10px">
          <button class="btn-primary" onclick="saveTadilatRowEdit()">${ico('check',14)} Kaydet</button>
          <button class="btn-ghost" onclick="cancelTadilatRowEdit()">${ico('x',14)} Vazgeç</button>
        </div>
      </div>
    </div>
  </div>`;
}
function deleteModalSelected(){
  if(!requireSuperAdmin()) return;
  if(modalSelectedIds.size===0) return;
  if(!confirm(`${modalSelectedIds.size} kaydı silmek istediğine emin misin? Bu işlem geri alınamaz.`)) return;
  modalSelectedIds.forEach(id=>{
    if(id.startsWith('tad-')){
      const m = id.match(/^tad-(.+)-([^-]+)$/);
      if(m) DB.ref(`tadilatlar/${m[1]}/operasyonlar/${m[2]}`).remove();
    } else {
      DB.ref('entries/'+id).remove();
    }
  });
  toast('Seçilen kayıtlar silindi');
  modalSelectedIds = new Set();
}
function machineDetailEntries(code){
  const label = resolveMachineLabel(code);
  return entriesArray().filter(e=>e.makine===label).sort((a,b)=>a.startTs-b.startTs);
}
// Bir makinede yapılan tadilat operasyonlarını da üretim kayıtlarıyla AYNI şekilde (tarih/süre/
// operatör) gösterebilmek için, entry benzeri satırlara çeviriyoruz — böylece Makine Matrisi
// detayında ikisi tek bir zaman çizelgesinde/tabloda birleşiyor.
function machineDetailTadilatRows(code){
  const label = resolveMachineLabel(code);
  const out = [];
  tadilatArray().forEach(t=>{
    tadilatOperasyonlarArray(t).forEach(o=>{
      if(o.makine!==label) return;
      out.push({
        id: 'tad-'+t.id+'-'+o.id,
        isEmriNo: t.uKodu, talepNo: t.uKodu,
        makine: label,
        operatorUsername: o.operatorUsername, operatorName: o.operatorName,
        startTs: o.baslamaTs, endTs: o.bitisTs || null,
        status: o.status==='tamamlandi' ? 'tamamlandi' : (o.status==='duruş' ? 'duruş' : 'devam'),
        malzemeCinsi: t.kisaAciklama || t.aciklama || '',
        adet: t.adet || '',
        duruşToplamMs: o.duruşToplamMs||0, excludedMs: o.excludedMs||0,
        duruşNedeni: o.duruşNedeni||null, duruşTs: o.duruşTs||null,
        _isTadilat: true, _sonOperasyon: !!o.sonOperasyon
      });
    });
  });
  return out;
}
function machineDetailAllRows(code){
  return [...machineDetailEntries(code), ...machineDetailTadilatRows(code)].sort((a,b)=>a.startTs-b.startTs);
}
function exportMachineExcel(code){
  const m = allMachines().find(x=>x.code===code);
  if(!m){ toast('Makine bulunamadı'); return; }
  let rows = machineDetailAllRows(code);
  // DÜZELTME: Ekrandaki tablo/Gantt "o günle KESİŞEN" kayıtları gösteriyor (bkz. aşağıdaki aynı
  // isimli düzeltme), ama dışa aktarım hâlâ sadece "o gün BAŞLAYAN" kayıtları alıyordu. Üstelik
  // butonun üzerindeki sayaç tablonun sayısını gösterdiği için ("Excel'e Aktar (1)") kullanıcı
  // eksikliği fark etmiyordu: 05.08'de başlayıp 10.08'de biten bir iş, 10.08 seçiliyken tabloda
  // görünüyor ama indirilen dosya boş geliyordu. Artık iki taraf aynı kuralı kullanıyor.
  if(modalDateFilter){
    const fDayStart = new Date(modalDateFilter+'T00:00:00').getTime();
    const fDayEnd = fDayStart + 86400000;
    rows = rows.filter(e=>{
      const eEnd = e.endTs || nowTick;
      return e.startTs < fDayEnd && eEnd >= fDayStart;
    });
  }
  const data = rows.map(e=>{
    const d = entryDurationBreakdown(e);
    return {
    // DÜZELTME: ico() bir SVG/HTML string'i döndürüyor; Excel hücresine ham markup yazılıyordu
    // ("<svg class=... </svg> Tadilat"), sütun okunamaz ve filtrelenemez hale geliyordu.
    "Tür": e._isTadilat ? 'Tadilat' : 'Üretim',
    "Tarih": new Date(e.startTs), "İş Talep No": e._isTadilat ? '' : (e.talepNo||''), "U Kodu (İş Emri No)": e.isEmriNo, "Malzeme Adı": e._isTadilat ? '' : (getTalepInfo(e.talepNo)?.malzemeAdi||''), "Malzeme Cinsi": e.malzemeCinsi||'', "Çap ve Boy": e.capBoy||'', "Adet": e.adet,
    "Operatör": `${e.operatorUsername} · ${e.operatorName}`,
    "Başlangıç": new Date(e.startTs), "Bitiş": e.endTs?new Date(e.endTs):"",
    "Süre (dk, brüt)": e.endTs?Math.round(d.wallMs/60000):"",
    "Duruş (dk)": Math.round(d.durusMs/60000),
    "Net Süre (dk)": e.endTs?Math.round(d.netMs/60000):"",
    "Durum": e._isTadilat ? (e.status==='tamamlandi' ? (e._sonOperasyon?'Tadilat Tamamlandı':'Operasyon Bitti (Devamı Var)') : 'Tadilat Devam Ediyor') : (e.status==='devam'?'Devam Ediyor':e.status==='duruş'?'Duruşta':'Tamamlandı'),
    "Duruş Nedeni": e.duruşNedeni||"", "Not": e.not||"",
  };});
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, m.code);
  XLSX.writeFile(wb, `${m.code}_${modalDateFilter||'tumu'}.xlsx`);
}
let tadilatHistoryDetailId = null; // 'tad-{tadilatId}-{opId}' — Geçmiş'te tıklanan tadilat operasyonu
function openTadilatHistoryDetail(rowId){ tadilatHistoryDetailId = rowId; render(); }
function closeTadilatHistoryDetail(){ tadilatHistoryDetailId = null; render(); }
function renderTadilatHistoryDetailModal(){
  const m = String(tadilatHistoryDetailId||'').match(/^tad-(.+)-([^-]+)$/);
  if(!m){ tadilatHistoryDetailId=null; return ''; }
  const [, tadilatId, opId] = m;
  const t = tadilatlar[tadilatId];
  const op = t && t.operasyonlar && t.operasyonlar[opId];
  if(!t || !op){ tadilatHistoryDetailId=null; return ''; }
  const dur = op.bitisTs ? fmtDur(op.bitisTs-op.baslamaTs) : fmtElapsed(tadilatOpDurationBreakdown(op).netMs)+' (sürüyor)';
  const statusLabel = op.status==='tamamlandi' ? (op.sonOperasyon?'Tadilat Tamamlandı':'Operasyon Bitti (Devamı Var)') : 'Tadilat — Devam Ediyor';
  return `<div class="modal-overlay" onclick="if(event.target===this) closeTadilatHistoryDetail()">
    <div class="modal-box" style="max-width:440px">
      <div class="modal-header">
        <div><div class="modal-title" style="color:var(--tadilat-info)">${ico('wrench',14)} ${esc(t.uKodu)}</div><div class="modal-sub">${op.makine?esc(op.makine):'—'}</div></div>
        <button class="icon-btn" onclick="closeTadilatHistoryDetail()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div class="modal-stat-box" style="margin-bottom:14px"><div class="modal-stat-num" style="color:var(--tadilat-info)">${statusLabel}</div><div class="modal-stat-label">Durum${!op.sonOperasyon && op.status==='tamamlandi'?' · devamı bekleniyor':''}</div></div>
        ${t.kisaAciklama ? `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:4px">Açıklama</div><div style="font-size:14px;margin-bottom:14px">${esc(t.kisaAciklama)}</div>` : ''}
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:4px">Ne İşlem Yapılacak</div><div style="font-size:14px;margin-bottom:14px">${esc(t.aciklama||'—')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div><div style="font-size:11.5px;color:var(--text-muted)">Adet</div><div style="font-size:14px">${esc(t.adet||'—')}</div></div>
          <div><div style="font-size:11.5px;color:var(--text-muted)">Atölye</div><div style="font-size:14px">${(t.atolye||'imalat')==='tadilat'?(ico('wrench',13)+' Tadilat'):(ico('factory',13)+' İmalat')}</div></div>
          <div><div style="font-size:11.5px;color:var(--text-muted)">Talep Eden Bölüm</div><div style="font-size:14px">${esc(t.bolum||'—')}</div></div>
          <div><div style="font-size:11.5px;color:var(--text-muted)">Talep Eden Kişi</div><div style="font-size:14px">${esc(t.talepEdenKisi||'—')}</div></div>
        </div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:4px">Başlangıç → Bitiş</div>
        <div style="font-size:14px;margin-bottom:14px">${fmtDT(op.baslamaTs)} → ${op.bitisTs?fmtDT(op.bitisTs):'—'} <span style="color:var(--text-muted)">(${dur})</span></div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:4px">Talebi Açan</div>
        <div style="font-size:14px">${esc(t.olusturanName||'—')} · ${fmtDT(t.olusturmaTs)}</div>
      </div>
    </div>
  </div>`;
}
// Normal İş Emri için Tadilat'takiyle AYNI görsel akış şeması (İşe Başlandı → [duruş/Gün Sonu
// aralıkları] → Bitti) — kullanıcı Tadilat Analizi'ndeki bu görseli çok sevdiği için Rapor
// ekranındaki (ve operatörün kendi kayıt detayındaki) İş Emri detayına da eklendi. Tadilat'ta
// birden çok OPERASYON varken, burada tek bir kayıt İÇİNDE birden çok duruş/Gün Sonu aralığı
// var — o yüzden zincir "duraklat → devam et" düğüm çiftleriyle ilerliyor.
function renderEntryAkisChain(e){
  const allEvents = [
    ...entryDurusEvents(e).map(ev=>({...ev, tip:'duruş'})),
    ...entryExcludedEvents(e).map(ev=>({...ev, tip:'gunsonu'}))
  ].filter(ev=>Number.isFinite(ev.sureMs) && ev.sureMs>0).sort((a,b)=>a.ts-b.ts);

  const chain = [];
  chain.push(akisNodeHtml('İşe Başlandı', 'var(--accent)', fmtDT(e.startTs), esc(e.startedByName||e.startedByUsername||e.operatorName||e.operatorUsername||'—'), e.makine?esc(e.makine.split(' · ')[0]):''));
  let cursor = e.startTs;
  allEvents.forEach(ev=>{
    const workMs = Math.max(0, ev.ts - cursor);
    chain.push(akisConnectorHtml(fmtDur(workMs), 'var(--success)'));
    const isGunSonu = ev.tip==='gunsonu';
    chain.push(akisNodeHtml('Duraklatıldı', isGunSonu?'var(--gunsonu)':'var(--warn)', fmtDT(ev.ts), '', esc(ev.neden||'')));
    chain.push(akisConnectorHtml(`${fmtDur(ev.sureMs)}${isGunSonu?' (Gün Sonu)':''}`, isGunSonu?'var(--gunsonu)':'var(--warn)'));
    cursor = ev.ts + ev.sureMs;
    chain.push(akisNodeHtml('Devam Edildi', 'var(--tadilat-info)', fmtDT(cursor), '', ''));
  });
  const stillRunning = e.status==='devam';
  const lastWorkMs = Math.max(0, (e.endTs || (stillRunning ? nowTick : cursor)) - cursor);
  chain.push(akisConnectorHtml(fmtDur(lastWorkMs), 'var(--success)'));
  chain.push(akisNodeHtml(e.endTs ? 'İş Bitti' : (e.status==='duruş' ? 'Duraklatıldı' : 'Devam Ediyor'), e.endTs?'var(--success)':(e.status==='duruş'?'var(--warn)':'var(--accent)'), e.endTs?fmtDT(e.endTs):'—', '', ''));

  return `<div style="display:flex;align-items:flex-start;gap:0;overflow-x:auto;padding:10px 4px 18px;margin-bottom:6px">${chain.join('')}</div>`;
}
function renderEntryDetailModal(){
  const e = STATE.entries[entryDetailId];
  if(!e){ entryDetailId=null; return ''; }
  const isDone = computeCompletedRouteIds().has(e.id);
  const statusColor = isDone ? 'var(--success)' : e.status==='devam'?'var(--accent)':e.status==='duruş'?'var(--warn)':'var(--success-soft)';
  const statusLabel = isDone ? 'Rota Tamamlandı' : e.status==='devam'?'Devam Ediyor':e.status==='duruş'?'Duruşta':'Tamamlandı';
  // DÜZELTME: Eskiden burada `e.status==='devam'` dışındaki her kapanmamış kayıt için wallMs=0
  // yazılıyordu — yani DURUŞTAKİ bir kaydın detayı açıldığında "Üretim Süresi 0 dk / Toplam 0 dk"
  // görünüyordu (3 saat çalışılmış olsa bile). Ayrıca o an devam eden duruş süresi de duruşa
  // eklenmiyordu. Artık bu hesabın tek doğru kaynağı olan ortak fonksiyonu kullanıyoruz.
  const _d = entryDurationBreakdown(e);
  const wallMs = _d.wallMs, durusMs = _d.durusMs, netMs = _d.netMs;
  const malzAdi = getTalepInfo(e.talepNo)?.malzemeAdi || '';
  const startedByUsername = e.startedByUsername || e.operatorUsername;
  const startedByName = e.startedByName || e.operatorName;
  const handedOver = e.operatorUsername !== startedByUsername;
  const malzTxt = [e.malzemeCinsi, e.capBoy].filter(Boolean).join(' ');
  return `<div class="modal-overlay" onclick="if(event.target===this) closeEntryDetail()">
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <div class="modal-title">${esc(e.talepNo || e.isEmriNo)}${malzAdi ? ` <span style="color:var(--accent);opacity:.45;font-weight:600;font-size:1em">${esc(malzAdi)}</span>` : ''}</div>
          <div class="modal-sub">${e.talepNo ? `U kodu: ${esc(e.isEmriNo)} · ` : ''}${esc(e.makine||'—')}</div>
        </div>
        <button class="icon-btn" onclick="closeEntryDetail()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        ${renderEntryAkisChain(e)}
        <div class="modal-stats" style="flex-wrap:nowrap;gap:10px">
          <div class="modal-stat-box" style="min-width:0;flex:1;padding:10px 8px"><div class="modal-stat-num" style="color:var(--success);font-size:16px">${fmtDur(netMs)}</div><div class="modal-stat-label" style="font-size:9.5px">Üretim Süresi</div></div>
          <div class="modal-stat-box" style="min-width:0;flex:1;padding:10px 8px"><div class="modal-stat-num" style="color:${durusMs>0?'var(--warn)':'var(--text-muted)'};font-size:16px">${fmtDur(durusMs)}</div><div class="modal-stat-label" style="font-size:9.5px">Duruş Süresi</div></div>
          <div class="modal-stat-box" style="min-width:0;flex:1;padding:10px 8px"><div class="modal-stat-num" style="font-size:16px">${fmtDur(wallMs)}</div><div class="modal-stat-label" style="font-size:9.5px">Toplam (Geçen Zaman)</div></div>
          <div class="modal-stat-box" style="min-width:0;flex:1.3;padding:10px 8px"><div class="modal-stat-num" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${malzTxt ? esc(malzTxt)+' · ' : ''}Adet: ${esc(e.adet||'—')}</div><div class="modal-stat-label" style="font-size:9.5px">Malzeme / Adet</div></div>
          <div class="modal-stat-box" style="min-width:0;flex:1;padding:10px 8px"><div class="modal-stat-num" style="color:${statusColor};font-size:14px">${statusLabel}</div><div class="modal-stat-label" style="font-size:9.5px">Durum</div></div>
        </div>

        ${handedOver ? `<div class="op-settings-row" style="display:block;margin-bottom:14px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">🔄 Devralan / Şu An Sorumlu</div>
          <div style="font-size:14px">${esc(e.operatorUsername)} · ${esc(e.operatorName)}</div>
        </div>` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
          <div class="op-settings-row" style="display:block">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Başlatan</div>
            <div style="font-size:14px">${esc(startedByUsername)} · ${esc(startedByName)}</div>
          </div>
          <div class="op-settings-row" style="display:block">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Bitiren</div>
            <div style="font-size:14px">${e.status==='tamamlandi' ? `${esc(e.finishedByUsername || e.operatorUsername)} · ${esc(e.finishedByName || e.operatorName)}` : '—'}</div>
          </div>
          <div class="op-settings-row" style="display:block">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Başlangıç</div>
            <div style="font-size:14px" class="mono">${fmtDT(e.startTs)}</div>
          </div>
          <div class="op-settings-row" style="display:block">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Bitiş</div>
            <div style="font-size:14px" class="mono">${e.endTs?fmtDT(e.endTs):'— (henüz bitmedi)'}</div>
          </div>
        </div>

        ${durusMs>0 ? `<div style="background:var(--warn-soft);border:1px solid var(--warn-border);border-radius:10px;padding:14px;margin-bottom:14px">
          <div style="font-size:11px;color:var(--warn);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Duruş Bilgisi</div>
          <div style="font-size:14px;color:var(--warn)">Toplam ${fmtDur(durusMs)} durdu ${e.duruşNedeni?`— Neden: "${esc(e.duruşNedeni)}"`:''}</div>
        </div>` : ''}

        ${e.not ? `<div style="background:var(--panel-alt);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Not</div>
          <div style="font-size:14px;font-style:italic">"${esc(e.not)}"</div>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}
function renderBeklemeDetayModal(){
  const t = tadilatlar[beklemeDetayId];
  const ilkOp = t ? tadilatOperasyonlarArray(t)[0] : null;
  if(!t || !ilkOp || !t.olusturmaTs || !ilkOp.baslamaTs){ beklemeDetayId=null; return ''; }
  const fromMs = t.olusturmaTs, toMs = ilkOp.baslamaTs;
  const beklemeMs = Math.max(0, toMs - fromMs);
  const activity = operatorActivityInRange(ilkOp.operatorUsername, fromMs, toMs);
  let accountedMs = 0;
  const rows = activity.map(e=>{
    const segStart = Math.max(e.startTs, fromMs);
    const segEnd = Math.min(e.endTs||nowTick, toMs);
    const overlapMs = Math.max(0, segEnd-segStart);
    accountedMs += overlapMs;
    const label = e._isTadilat ? `${ico('wrench',12)} Tadilat: ${esc(e.isEmriNo)}` : `Üretim: ${esc(e.isEmriNo||'—')}`;
    const statusLabel = e.status==='devam' ? 'Çalışıyor' : e.status==='duruş' ? `Duruşta ("${esc(e.duruşNedeni||'')}")` : 'Tamamlandı';
    return `<tr>
      <td style="font-size:12.5px">${label}</td>
      <td style="font-size:12px">${esc(e.makine||'—')}</td>
      <td style="font-size:12px" class="mono">${fmtDT(segStart)} → ${fmtDT(segEnd)}</td>
      <td style="font-size:12px;color:${e.status==='duruş'?'var(--warn)':'inherit'}">${statusLabel}</td>
      <td style="font-weight:600">${fmtDur(overlapMs)}</td>
    </tr>`;
  }).join('');
  const unaccountedMs = Math.max(0, beklemeMs - accountedMs);
  return `<div class="modal-overlay" onclick="if(event.target===this) closeBeklemeDetay()">
    <div class="modal-box" style="max-width:760px">
      <div class="modal-header">
        <div><div class="modal-title">${ico('wrench',14)} ${esc(t.uKodu)} — Bekleme Detayı</div><div class="modal-sub">${esc(ilkOp.operatorName||ilkOp.operatorUsername)} · ${fmtDT(fromMs)} → ${fmtDT(toMs)}</div></div>
        <button class="icon-btn" onclick="closeBeklemeDetay()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px">"${esc(t.aciklama||'')}" talebi açıldıktan sonra ${esc(ilkOp.operatorName||ilkOp.operatorUsername)} bu işi seçip başlayana kadar geçen ${fmtDur(beklemeMs)} boyunca bu kişinin sistemdeki tüm kayıtlı hareketleri (üretim + tadilat) aşağıda listeleniyor.</div>
        <div class="modal-stats" style="margin-bottom:16px">
          <div class="modal-stat-box"><div class="modal-stat-num" style="color:var(--warn)">${fmtDur(beklemeMs)}</div><div class="modal-stat-label">Toplam Bekleme</div></div>
          <div class="modal-stat-box"><div class="modal-stat-num" style="color:var(--success)">${fmtDur(accountedMs)}</div><div class="modal-stat-label">Başka İşle Meşgul</div></div>
          <div class="modal-stat-box"><div class="modal-stat-num" style="color:${unaccountedMs>0?'var(--danger)':'var(--text-muted)'}">${fmtDur(unaccountedMs)}</div><div class="modal-stat-label">Sistemde Kaydı Yok</div></div>
        </div>
        ${activity.length===0 ? `<div style="color:var(--text-muted);padding:20px 0;text-align:center">Bu aralıkta bu kişinin sistemde hiç kaydı yok — sistem üzerinden görünürde hiçbir iş yapmamış.</div>` : `
        <div class="table-wrap" style="padding:0"><table><thead><tr><th>İş</th><th>Makine</th><th>Zaman Aralığı</th><th>Durum</th><th>Bu Aralıktaki Süre</th></tr></thead><tbody>
          ${rows}
        </tbody></table></div>`}
        ${unaccountedMs>0 ? `<div style="margin-top:14px;font-size:11.5px;color:var(--text-muted)">"Sistemde Kaydı Yok" süresi, kişinin o sırada izinli/molada olabileceği ya da sisteme hiç kayıt açmadan bekliyor olabileceği anlamına gelir — kesin yorum için ilgili kişiyle konuşulması gerekir.</div>` : ''}
      </div>
    </div>
  </div>`;
}
function renderMachineModal(){
  const m = allMachines().find(x=>x.code===machineModal);
  // DÜZELTME: m undefined olabiliyordu — modal AÇIKKEN başka bir yönetici o makineyi gizler/silerse
  // Firebase listener yeniden render tetikliyor ve aşağıdaki m.code okuması TypeError atıp TÜM
  // yönetici ekranını boş bırakıyordu. Artık modal sessizce kapanıyor.
  if(!m){ machineModal = null; return ''; }
  const allRows = machineDetailAllRows(machineModal);

  // DÜZELTME: Eskiden bir kaydın TÜM ömrü (ör. 5 gün süren, aralarda duraklamalarla dolu bir
  // iş) tek bir güne — SADECE BAŞLADIĞI güne — yazılıyordu ve o süre hiç duruş düşülmeden
  // "Toplam Süre" diye gösteriliyordu (120 saat gibi anlamsız rakamlar). Artık her kayıt,
  // GERÇEKTEN DOKUNDUĞU her takvim gününe kendi payı kadar bölünüyor, ve duruş süresi o günün
  // payından DÜŞÜLÜYOR — kalan "Net Çalışma" gerçekten o gün çalışılan süreyi gösteriyor. Duruş
  // olaylarının hangi güne ait olduğunu da durusLog'daki gerçek zaman damgalarından buluyoruz.
  const byDayAll = {};
  allRows.forEach(e=>{
    const endClip = e.endTs || nowTick;
    const events = entryDurusEvents(e); // {ts, sureMs, neden} — H2 (durusLog) sayesinde artık gerçek zaman damgalı
    const exclEvents = entryExcludedEvents(e); // Gün Sonu süreleri — AYRICA zaman damgalı (excludedLog)
    let cur = e.startTs;
    let guard = 0;
    while(cur < endClip && guard < 400){ // 400 gün güvenlik sınırı (sonsuz döngüye karşı)
      guard++;
      const dk = dateKey(cur);
      const dayStart = new Date(dk+'T00:00:00').getTime();
      const dayEnd = dayStart + 86400000;
      const segEnd = Math.min(endClip, dayEnd);
      const segWallMs = Math.max(0, segEnd - cur);
      // Bu güne denk gelen duruş olaylarını, olayın KENDİSİNİN de gece yarısını aşabileceğini
      // hesaba katarak (msOverlap) buluyoruz — sadece başlangıç zaman damgasına bakmıyoruz.
      const segEvents = events.filter(ev => msOverlap(ev.ts, ev.sureMs, cur, segEnd) > 0);
      const segDurusMs = events.reduce((s,ev)=>s+msOverlap(ev.ts, ev.sureMs, cur, segEnd), 0);
      // Gün Sonu süresini de AYNI şekilde sadece bu güne denk gelen kısmıyla düşüyoruz —
      // eskiden bu hiç düşülmüyordu (gece boyu bekleme "çalışma" sayılıp gün şişiyordu).
      const segExclMs = exclEvents.reduce((s,ev)=>s+msOverlap(ev.ts, ev.sureMs, cur, segEnd), 0);
      const segWorkMs = Math.max(0, segWallMs - segDurusMs - segExclMs);
      if(!byDayAll[dk]) byDayAll[dk] = {count:0, workMs:0, durusMs:0, durusCount:0, jobs:new Set()};
      byDayAll[dk].count++;
      byDayAll[dk].workMs += segWorkMs;
      byDayAll[dk].durusMs += segDurusMs;
      byDayAll[dk].durusCount += segEvents.length;
      byDayAll[dk].jobs.add(e.isEmriNo);
      cur = segEnd;
    }
  });
  // FİZİKSEL TAVAN: bir makine bir günde, O GÜNDEN GERÇEKTE GEÇEN süreden fazla "çalışmış"
  // olamaz — Analiz sekmesindeki (computeAnalizData) aynı isimli düzeltmeyle AYNI eşiği
  // kullanıyoruz. Eskiden burada sabit bir tavan (540+300 dk) vardı — bu da aynı makine/gün
  // için Analiz sekmesi "anomali yok" derken bu modalın "anomali var" demesine (ya da tersi)
  // yol açabiliyordu, çünkü iki ekran aynı veriye farklı eşikle bakıyordu.
  Object.keys(byDayAll).forEach(dk=>{
    const d = byDayAll[dk];
    const dStartMs = new Date(dk+'T00:00:00').getTime();
    const dayElapsedCapMs = Math.max(0, Math.min(nowTick, dStartMs+86400000) - dStartMs);
    d.anomali = d.workMs > dayElapsedCapMs;
    if(d.anomali) d.workMs = dayElapsedCapMs;
  });
  const allDays = Object.keys(byDayAll).sort(); // eskiden yeniye, timeline soldan sağa akar
  const maxMs = Math.max(1, ...allDays.map(d=>byDayAll[d].workMs+byDayAll[d].durusMs));

  const timelineHtml = `<div class="timeline-strip">
    <div class="timeline-all ${!modalDateFilter?'selected':''}" onclick="setModalDateFilter('')" title="Tüm tarihler">
      <div class="timeline-all-icon">⟷</div><div class="timeline-day-label">Tümü</div>
    </div>
    ${allDays.map(d=>{
      const dayTotalMs = byDayAll[d].workMs + byDayAll[d].durusMs;
      const pct = Math.max(6, Math.round((dayTotalMs/maxMs)*100));
      const [, mm, dd] = d.split('-'); const label = `${dd}.${mm}`; // DD.MM
      return `<div class="timeline-day ${modalDateFilter===d?'selected':''}" onclick="setModalDateFilter('${d}')" title="${d} · Çalışma: ${fmtDur(byDayAll[d].workMs)} · Duruş: ${fmtDur(byDayAll[d].durusMs)} · ${byDayAll[d].jobs.size} iş">
        <div class="timeline-bar-track"><div class="timeline-bar-fill" style="height:${pct}%"></div></div>
        <div class="timeline-day-label">${label}</div>
      </div>`;
    }).join('')}
  </div>`;

  let rows = allRows;
  // DÜZELTME: Eskiden sadece o gün BAŞLAYAN kayıtlar gösteriliyordu — bir iş önceki günden
  // başlayıp seçilen güne devam ediyorsa (ör. 05.08'de başlayıp 10.08'de biten bir iş), o günün
  // görünümünde HİÇ görünmüyordu (10.08 sabahı "boş" görünüyordu, oysa iş orada devam ediyordu).
  // Artık kaydın [başlangıç, bitiş] aralığı seçilen günle KESİŞİYORSA gösteriliyor.
  if(modalDateFilter){
    const fDayStart = new Date(modalDateFilter+'T00:00:00').getTime();
    const fDayEnd = fDayStart + 86400000;
    rows = rows.filter(e=>{
      const eEnd = e.endTs || nowTick;
      return e.startTs < fDayEnd && eEnd >= fDayStart;
    });
  }
  modalVisibleIds = rows.map(e=>e.id);

  // GANTT (saat bazlı zaman çizelgesi) — sadece TEK BİR gün seçiliyken anlamlı (birden fazla
  // gün üst üste binerse saat ekseni anlamsızlaşır). Yukarıdaki "timeline-strip" gün SEÇİCİ,
  // bu ise seçilen günün İÇİNDE hangi saatlerde ne olmuş onu gösteriyor.
  let ganttHtml = '';
  if(modalDateFilter){
    const gDayStartMs = new Date(modalDateFilter+'T00:00:00').getTime();
    const gSegs = rows.map(e=>{
      const endClip = e.endTs || nowTick;
      const segStart = Math.max(e.startTs, gDayStartMs);
      const segEndForSeg = Math.min(endClip, gDayStartMs+86400000);
      const startMin = Math.max(0, (e.startTs - gDayStartMs)/60000);
      const durMin = Math.max(1, (segEndForSeg - segStart)/60000);
      const leftPct = Math.max(0, (startMin/1440)*100);
      const widthPct = Math.min(100-leftPct, (durMin/1440)*100);
      const totalMs = Math.max(0, segEndForSeg - segStart);
      // DÜZELTME: Eskiden effectiveDurusMs/effectiveExcludedMs kaydın TÜM geçmişindeki
      // (birden fazla günü kapsayan) toplam duruş/Gün Sonu süresini döndürüyordu — bu, tek bir
      // günün küçük bir dilimine (totalMs) uygulanınca sonucu negatife düşürüp sıfırlıyordu
      // (ör. dün akşam başlayıp bu sabah biten bir iş, bu sabahki gerçek çalışma saati bile
      // "hiç çalışılmamış" gibi görünüyordu). Artık SADECE bu günün segmentine denk gelen
      // duruş/Gün Sonu olayları (zaman damgalarına göre) hesaba katılıyor.
      const durusMs = entryDurusEvents(e).reduce((s,ev)=>s+msOverlap(ev.ts, ev.sureMs, segStart, segEndForSeg), 0);
      const exclMs = entryExcludedEvents(e).reduce((s,ev)=>s+msOverlap(ev.ts, ev.sureMs, segStart, segEndForSeg), 0);
      const workMs = Math.max(0, totalMs - durusMs - exclMs);
      const workPct = totalMs>0 ? Math.round(workMs/totalMs*100) : 0;
      const durusPct = totalMs>0 ? Math.round(durusMs/totalMs*100) : 0;
      return { e, leftPct, widthPct, workPct, durusPct };
    });
    ganttHtml = `<div class="sec-h" style="margin-top:0">Saat Bazlı Zaman Çizelgesi (Gantt) — ${modalDateFilter}</div>
    <div style="margin-bottom:20px">
      <div style="position:relative;height:16px;margin-bottom:4px">
        ${[0,3,6,9,12,15,18,21].map(h=>`<span style="position:absolute;left:${(h*60/1440)*100}%;font-size:10px;color:var(--text-muted);transform:translateX(-50%)">${String(h).padStart(2,'0')}:00</span>`).join('')}
      </div>
      ${gSegs.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px;padding:8px 0">Bu günde kayıt yok.</div>` : gSegs.map(({e,leftPct,widthPct,workPct,durusPct})=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <div style="width:90px;font-size:11px;color:var(--text-muted);flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(e.isEmriNo||'')}">${esc(e.isEmriNo||'—')}</div>
          <div style="position:relative;flex:1;height:20px;background:var(--panel-alt);border-radius:4px;overflow:hidden">
            <div style="position:absolute;left:${leftPct}%;width:${widthPct}%;height:100%;display:flex;border-radius:3px;overflow:hidden" title="${esc(e.operatorName||'')} · ${fmtDT(e.startTs)}${e.endTs?' - '+fmtDT(e.endTs):' (devam ediyor)'}">
              <div style="width:${workPct}%;background:#4ade80"></div>
              <div style="width:${durusPct}%;background:#facc15"></div>
              <div style="flex:1;background:#3a4148"></div>
            </div>
          </div>
        </div>
      `).join('')}
      <div style="display:flex;gap:16px;font-size:11px;color:var(--text-muted);margin-top:6px">
        <span><span style="display:inline-block;width:10px;height:10px;background:#4ade80;border-radius:2px;margin-right:4px"></span>Çalışma</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#facc15;border-radius:2px;margin-right:4px"></span>Duruş</span>
      </div>
    </div>`;
  }

  // DÜZELTME: Artık ham (duruş dahil, gün sınırı gözetmeyen) toplam yerine, yukarıda doğru
  // hesaplanmış byDayAll verisinden (gün bazlı, net, duruş düşülmüş) türetiyoruz — tutarlı olsun.
  const relevantDays = modalDateFilter ? [modalDateFilter] : allDays;
  const totalMs = relevantDays.reduce((s,d)=> s + (byDayAll[d]?.workMs||0), 0);
  const totalDurusMs = relevantDays.reduce((s,d)=> s + (byDayAll[d]?.durusMs||0), 0);
  const jobCount = new Set(rows.map(e=>e.isEmriNo)).size;
  const recordCount = rows.length;

  let dailyTable = '';
  if(!modalDateFilter){
    const days = allDays.slice().reverse();
    dailyTable = `<div class="sec-h" style="margin-top:0">Günlere Göre Özet</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;margin-top:-8px">Her gün, o güne denk gelen kısmıyla ayrı ayrı hesaplanıyor — çok günlü/duraklamalı işler artık başladıkları güne toptan yazılmıyor. Verimlilik, standart mesaiye (${WORKDAY_MINUTES} dk) göre.</div>
      <table style="margin-bottom:20px"><thead><tr><th>Tarih</th><th>Kayıt Sayısı</th><th>İş Sayısı</th><th>Net Çalışma</th><th>Duruş</th><th>Verimlilik</th></tr></thead><tbody>
      ${days.map(d=>{
        const dd = byDayAll[d];
        const verim = Math.min(100, Math.round((dd.workMs/60000)/WORKDAY_MINUTES*100));
        return `<tr>
          <td>${d}</td>
          <td>${dd.count}</td>
          <td>${dd.jobs.size}</td>
          <td>${fmtDur(dd.workMs)}${dd.anomali?` <span style="color:var(--danger)" title="Standart mesai + makul fazla mesai payını aştığı için tavana çekildi, kontrol et">${ico('alert',14)}</span>`:''}</td>
          <td style="color:${dd.durusMs>0?'var(--warn)':'inherit'}">${dd.durusCount>0?`${dd.durusCount} kez · ${fmtDur(dd.durusMs)}`:'—'}</td>
          <td><span style="color:${verim>=70?'var(--success)':verim>=40?'var(--warn)':'var(--danger)'};font-weight:700">%${verim}</span></td>
        </tr>`;
      }).join('')}
      </tbody></table>`;
  }

  return `<div class="modal-overlay" onclick="if(event.target===this) closeMachineDetail()">
    <div class="modal-box" style="max-width:1180px">
      <div class="modal-header">
        <div><div class="modal-title">${m.code}</div><div class="modal-sub">${esc(m.name)}</div></div>
        <button class="icon-btn" onclick="closeMachineDetail()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        ${timelineHtml}
        <div class="modal-filter-row">
          ${canDeleteReport() && modalSelectedIds.size>0 ? `<button class="btn-ghost" style="border-color:var(--danger);color:var(--danger)" onclick="deleteModalSelected()">${ico('trash',14)} Seçilenleri Sil (${modalSelectedIds.size})</button>` : ''}
          <button class="btn-primary" style="width:auto;margin-left:auto;padding:8px 16px" onclick="exportMachineExcel('${machineModal}')">⬇ Excel'e Aktar (${rows.length})</button>
        </div>
        <div class="modal-stats">
          <div class="modal-stat-box"><div class="modal-stat-num">${recordCount}</div><div class="modal-stat-label">Kayıt</div></div>
          <div class="modal-stat-box"><div class="modal-stat-num">${jobCount}</div><div class="modal-stat-label">Farklı İş Emri</div></div>
          <div class="modal-stat-box"><div class="modal-stat-num">${fmtDur(totalMs)}</div><div class="modal-stat-label">Toplam Süre</div></div>
          <div class="modal-stat-box"><div class="modal-stat-num" style="color:var(--warn)">${fmtDur(totalDurusMs)}</div><div class="modal-stat-label">Toplam Duruş</div></div>
        </div>
        ${totalDurusMs>0 ? renderDurusBreakdown(rows) : ''}
        ${dailyTable}
        ${ganttHtml}
        <div class="sec-h" style="margin-top:0">${modalDateFilter ? modalDateFilter+' — Detay' : 'Tüm Kayıtlar — Detay (eskiden yeniye)'}</div>
        <table><thead><tr>
          ${canDeleteReport() ? `<th style="width:26px"><input type="checkbox" ${modalVisibleIds.length>0 && modalVisibleIds.every(id=>modalSelectedIds.has(id))?'checked':''} onchange="toggleModalSelectAll()"></th>` : ''}
          <th>Tarih</th><th>İş Emri No</th><th>Malzeme</th><th>Operatör</th><th>Başlangıç</th><th>Bitiş</th><th>Süre</th><th>Durum</th>${session.isSuperAdmin ? `<th style="width:36px"></th>` : ''}${canDeleteReport() ? `<th style="width:36px"></th>` : ''}
        </tr></thead><tbody>
        ${(() => { const completedIdsForModal = computeCompletedRouteIds(); return rows.length===0 ? `<tr><td colspan="${8 + (canDeleteReport()?2:0) + (session.isSuperAdmin?1:0)}" style="text-align:center;color:var(--text-muted);padding:20px">Kayıt yok.</td></tr>` : rows.map(e=>{
          if(e._isTadilat){
            const dur = e.endTs ? fmtDur(e.endTs-e.startTs) : fmtElapsed(entryDurationBreakdown(e).netMs)+' (sürüyor)';
            const statusLabel = e.status==='tamamlandi' ? (e._sonOperasyon?'Tadilat Tamamlandı':'Operasyon Bitti (Devamı Var)') : 'Tadilat — Devam Ediyor';
            return `<tr>
              ${canDeleteReport() ? `<td><input type="checkbox" ${modalSelectedIds.has(e.id)?'checked':''} onchange="toggleModalSelect('${e.id}')"></td>` : ''}
              <td>${dateKey(e.startTs)}</td><td class="mono" style="color:var(--tadilat-info)">${ico('wrench',14)} ${esc(e.isEmriNo)}</td><td style="font-size:12.5px">${esc(e.malzemeCinsi||'—')}</td><td>${esc(e.operatorUsername)} · ${esc(e.operatorName)}</td><td>${fmtDT(e.startTs)}</td><td>${e.endTs?fmtDT(e.endTs):'—'}</td><td>${dur}</td><td><span style="color:var(--tadilat-info);font-weight:600">${statusLabel}</span></td>
              ${session.isSuperAdmin ? `<td><button class="del-btn" onclick="openTadilatRowEdit('${e.id}')" title="Düzelt">${ico('edit',14)}</button></td>` : ''}
              ${canDeleteReport() ? `<td>${session.isSuperAdmin ? `<button class="del-btn" onclick="deleteMachineModalTadilatRow('${e.id}')" title="Sil">${ico('trash',14)}</button>` : ''}</td>` : ''}
            </tr>`;
          }
          const isDone = completedIdsForModal.has(e.id);
          const statusColor = isDone ? 'var(--success)' : e.status==='devam'?'var(--accent)':e.status==='duruş'?'var(--warn)':'var(--success-soft)';
          const statusLabel = e.status==='devam'?'Devam Ediyor':e.status==='duruş'?'Duruşta':'Tamamlandı';
          const dur = e.endTs ? fmtDur(e.endTs-e.startTs) : (e.status==='devam' ? fmtElapsed(entryDurationBreakdown(e).netMs)+' (sürüyor)' : '—');
          const malzAdi = e.malzemeCinsi || getTalepInfo(e.talepNo)?.malzemeAdi || '—';
          return `<tr style="${isDone?'background:var(--success-row)':''}">
            ${canDeleteReport() ? `<td><input type="checkbox" ${modalSelectedIds.has(e.id)?'checked':''} onchange="toggleModalSelect('${e.id}')"></td>` : ''}
            <td>${dateKey(e.startTs)}</td><td class="mono" style="color:var(--accent)">${esc(e.talepNo || e.isEmriNo)} ${isDone?ico('check',12):''}</td><td style="font-size:12.5px">${esc(malzAdi)}</td><td>${esc(e.operatorUsername)} · ${esc(e.operatorName)}</td><td>${fmtDT(e.startTs)}</td><td>${e.endTs?fmtDT(e.endTs):'—'}</td><td>${dur}</td><td><span style="color:${statusColor};font-weight:600">${isDone?'Rota Tamamlandı':statusLabel}</span></td>
            ${session.isSuperAdmin ? `<td><button class="del-btn" onclick="openReportEdit('${e.id}')" title="Düzelt">${ico('edit',14)}</button></td>` : ''}
            ${canDeleteReport() ? `<td><button class="del-btn" onclick="deleteModalRecord('${e.id}')" title="Sil">${ico('trash',14)}</button></td>` : ''}
          </tr>`;
        }).join('') })()}
        </tbody></table>
      </div>
    </div>
  </div>`;
}
function renderRouteModal(){
  const tabDefs = [
    { key:'ANA', label:'Ana' },
    { key:'ZARF', label:'_ZARF (Çelik)' },
    { key:'ELMAS', label:'_ELMAS (Karbür)' }
  ].map(t=>({ ...t, list: routesForBaseSuffix(routeModal.base, t.key) })).filter(t=>t.list.length>0);
  if(tabDefs.length===0){ routeModal=null; return ''; }
  let activeTab = tabDefs.find(t=>t.key===routeModal.activeSuffix) || tabDefs[0];
  let route = routeModal.finishedAt ? activeTab.list.find(r=>r.finishedAt===routeModal.finishedAt) : activeTab.list[0];
  if(!route) route = activeTab.list[0];
  if(!route){ routeModal=null; return ''; }

  const malz = route.entries.find(e=>e.malzemeCinsi||e.capBoy) || {};
  const malzText = [malz.malzemeCinsi, malz.capBoy].filter(Boolean).join(' · ');
  const talepNo = route.entries.find(e=>e.talepNo)?.talepNo || '';
  const uKodu = baseIsEmriNo(route.isEmriNo);

  const grandTotalMs = route.entries.reduce((s,e)=>s+(e.endTs?(e.endTs-e.startTs):0),0);
  const grandDurusMs = route.entries.reduce((s,e)=>s+(e.duruşToplamMs||0),0);
  const grandExcludedMs = route.entries.reduce((s,e)=>s+(e.excludedMs||0),0);
  const grandNetMs = grandTotalMs - grandDurusMs - grandExcludedMs;

  const stepsHtml = route.entries.map((e,i)=>{
    const wallMs = e.endTs ? (e.endTs-e.startTs) : 0;
    const durusMs = e.duruşToplamMs||0;
    const netMs = Math.max(0, wallMs - durusMs - (e.excludedMs||0));
    return `<div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-family:'JetBrains Mono',monospace;color:var(--accent);font-weight:700;font-size:13px">${i+1}. ${esc((e.makine||'').split(' · ')[0]||'—')}</span>
        <span style="color:var(--text-muted);font-size:12px">${esc((e.makine||'').split(' · ')[1]||'')}</span>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:8px">${esc(e.operatorUsername)} · ${esc(e.operatorName)} &nbsp;·&nbsp; ${fmtDT(e.startTs)} → ${e.endTs?fmtDT(e.endTs):'—'}</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div><span style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">Üretim Süresi</span><div style="font-family:'JetBrains Mono',monospace;font-weight:700">${fmtDur(netMs)}</div></div>
        <div><span style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">Duruş Süresi</span><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${durusMs>0?'var(--warn)':'var(--text-muted)'}">${fmtDur(durusMs)}</div></div>
        <div><span style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">Toplam (Geçen Zaman)</span><div style="font-family:'JetBrains Mono',monospace;font-weight:700">${fmtDur(wallMs)}</div></div>
      </div>
      ${e.not?`<div style="font-size:12px;color:var(--text-muted);font-style:italic;margin-top:8px">"${esc(e.not)}"</div>`:''}
    </div>`;
  }).join('');

  return `<div class="modal-overlay" onclick="if(event.target===this) closeRouteDetail()">
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <div class="modal-title">${esc(talepNo || route.isEmriNo)}</div>
          <div class="modal-sub mono">U kodu: ${esc(uKodu)}${malzText?' · '+esc(malzText):''}</div>
          <div class="modal-sub">Tamamlandı: ${fmtDT(route.finishedAt)}</div>
        </div>
        <button class="icon-btn" onclick="closeRouteDetail()">${ico('x',14)}</button>
      </div>
      ${tabDefs.length>1 ? `<div style="display:flex;gap:6px;padding:0 20px;margin-top:10px">
        ${tabDefs.map(t=>`<button class="tab-btn ${t.key===activeTab.key?'active':''}" style="flex:1;font-size:12.5px" onclick="setRouteModalTab('${t.key}')">${t.label}</button>`).join('')}
      </div>` : ''}
      <div class="modal-body">
        <div class="modal-stats">
          <div class="modal-stat-box"><div class="modal-stat-num">${fmtDur(grandNetMs)}</div><div class="modal-stat-label">Toplam Üretim Süresi</div></div>
          <div class="modal-stat-box"><div class="modal-stat-num" style="color:var(--warn)">${fmtDur(grandDurusMs)}</div><div class="modal-stat-label">Toplam Duruş</div></div>
          <div class="modal-stat-box"><div class="modal-stat-num">${route.entries.length}</div><div class="modal-stat-label">Adım</div></div>
        </div>
        <div style="font-size:13px;font-weight:600;margin-bottom:10px">Operasyon Operasyon Detay</div>
        ${stepsHtml}
      </div>
    </div>
  </div>`;
}
function renderLogin(){
  return `
  <div class="root-mobile theme-${resolvedTheme()}">
    <div class="auth-wrap">
      <div class="auth-header" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center">
        <div></div>
        <div style="display:flex;align-items:center;gap:12px;justify-content:center"><span class="logo-plate"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAABeCAMAAAA69LKOAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAPuaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjMtYzAxMSA2Ni4xNDU2NjEsIDIwMTIvMDIvMDYtMTQ6NTY6MjcgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0idXVpZDo1RDIwODkyNDkzQkZEQjExOTE0QTg1OTBEMzE1MDhDOCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoyMkE5NDBENkU3QTMxMUU1QjMxOThEREY3MDEwQkE1QiIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo2MTQ2NzJBMkU2MTYxMUU1QjMxOThEREY3MDEwQkE1QiIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBJbGx1c3RyYXRvciBDUzYgKFdpbmRvd3MpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MThBODM2OUM3MzMyRTMxMTg1MENCMjVEODYzNDgzMEEiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MThBODM2OUM3MzMyRTMxMTg1MENCMjVEODYzNDgzMEEiLz4gPGRjOnRpdGxlPiA8cmRmOkFsdD4gPHJkZjpsaSB4bWw6bGFuZz0ieC1kZWZhdWx0Ij55ZW5pX3N1bnVtPC9yZGY6bGk+IDwvcmRmOkFsdD4gPC9kYzp0aXRsZT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz56j1xOAAAAYFBMVEVMaXGsm5ldXmAlISJYWVttbnF6fH+mnZ0kICGLVlMvLS7BGCImIyQkICFvcHOBg4bDJSfBHiTTZVLGNS4jHyAkICHNU0InJCVGRkjWcFzFMCtBQUPBGCMjHyC9FBwvLC5FeLVzAAAAIHRSTlMAL7RAnWuCGG4L5K01ZJJMl/JyvpjtocDJRtug/////puofigAAAg6SURBVHja7Z3rdqo6EIAJEiLsSkpQBCvw/m95EK2izWWSDEJ7mB97d3UhjfnIJHMlCFZZZZVVVlllEmF1LYT4hEl/ZV0z802T7cc6s/ZSi7I4nduL9P+eATJcmp+KUhA95W7741c0i5yEXQnjyD55jIhQtwFF14/z5ztvZPNAs14YbGGI8nRFYS/Dx05lbQGEV13jKAN60uBI/JiryvkmV6jZ8y+PkmnIvkiQ0CMHrI0yd2PxROUkGBBI5DGHAxCGzCNxx9EcpED2P2chzoKP3SZgITHhKHxpfDM5lwQCJGyWAQSFBxgIiwJy3O2igGdaHKRAoXFjchZmIFmzDCCPefHhAQZC44DT/m/xINJtIwIRx7BKTrUBiKf+RwMSPaaqeQeQHQ1IGEc8CSLNmbPE5TEgEXog1TKAhI8RpW8B0msq/kUq0uuuRMmjwMYhJzIG4juXSEBGPHjzFiBJyMi239KDOH4rDxmRMRC6CCAV2p4GP2Xxahj7Vm2JlJPwuBCp1UCiJQAZ8/DVoWAgPZGY7rIvpt7Pz+epiDAlkGoBQJ6stqR7F5DeKqRUbRaSdjIg5/akBJLODyR92lR9rX4LIHo5TcejJyIUQJLD7EDS5+XLFwKknpLHuc0VQLy3Y29f1uFFh/sCaZCATLpAXpaIBkiaxXYyTCc7wmSfKohqgFiPKEAB4rtAWptdRAOEB1MKT408XoGkiduf8gWiO/Je3fC5Vs5ng7d+fPTVAEkm5dGZebwCOQazAEnyVuNHL0VNGEt0wkhdiyJXI2lLEBA2IQ/JTiNZkK8rZB4gSo3V5rpI0w+utdJXPNZZ8wCB8VgIEIXGatvSdoZq1emgJfMCAfJYCBC5F+uHz8MLrpgViIQHDRYLRL6FtC1xGoucyGgTUQPpJsueOWgC6Mvb1OVbiNP6UK63toAA2e4shSHz+LFCbAe0mwzI+Fxk+TjKdvbRro5uqRs1QKoJ2AYLtNRljt42d7cJSv393g6k0gRssYGg+LI+ZRorL6xEGJZIe2ZzAbHhsQwg/5QWOlwKo2eMzASk0gVsf9EKsXRmlcaD1kxAQn2A8P8BRMjWUD0LkMiOxx8FQoREZtlDbHn8USABNPt9aiCZIWC7AnkvkNgUsF2BvBVIbAzYrkDeCYS6HMpWIJMB4U5WywpkKiBuPFYgUwHhwIDUIp2LiwHSbT4sJfEMEBrd77YD+gj+FJB3B2wXGqBajspik/GggROQdAXy1oDtQoH8QwBSLAeID49lABH//EUsBogkYAvnsZA0oPfKxKmkRx8eEwHJfisQhGRrq4CtEUjnlgr16karyC8F0lShnTAzj+aYHlKIZFLD0HJAkSIOA/j7X0sE4mup+/TpCBEtdZdi1uMCgOCUtOHwaDJEX5ZLufd+AUBwij41AVtrIOx/DqTCBOJZ859hrNkbEP5bgUSIQOIGAQhS4wCXcve91jD89JnyWnLDQpaX5a2yCR6PGxCc1houXPd614mP0SxNFpblZQUJGhDfrinfQAgOEOoD5BOzGOEi4MxFb51F0AJLd3P6iAIkQQciPICc4EAYDhAEHt9AOAoQhyWy12uYwp0HAWe/e6t+gsfj7nDKUIDY20QGIC3D3ULyQA7E7/sTDL3/6gEMUYBY7+sPIPIKKoGqseQVVNfF3XkCQerbm2FsbCMgto/aAwgxN4zxXSCKGsPbL7LKBwhWH+WRV5hEzi6E5PmLWdiZD1+WogrXtcjQdDdJq/GAcOokF736scERgjKi13AZAQ9v1J1UUaeOWhYttEBWgcxhzrAUlqqTwyoKV4diEk/MgUdr0etkFYW7T9Hwqs0JDg9VN6BVFKJq2dvaHX7VneMV/bJWsVP8Q/d2AU0FIepO5U9naGQgf/J1PYm6SV/b5qWo9f3LLg3MSt1rLp6O0LhAIlMZ5186Z41fZWTo8adv8Pd0gsYFQo/xXwTCTH2UW8PLWywSTUFAGOecgJQl4KJ+DUt/1n8GdtVIgB/wXyL+vcaJHZCEpqPMHL3sD+ZYNH9UeyYpLBuvag6QE+bYM3KAPPgptNEpO0/YarwMrIBc2rlGdENpBdBG+8acYJZ093IE2nSQCeHAjMftVy9Vk17+gyjiGJ6eOWEz/hc3pQlIPxkRPMkXAiTI7jt/Bcv0rRoKLx+K4bm7aUfBh5BijtdVyNaqXXY0CAgZRU4g3gfWpD0TaKZxBk4f5r0S7hqgta1u3ovZid8MJLM7x4KA9LOb3Q7JIfSZhz/KcCBhrzoj8NXTvLHipxffAORotUCAQOi1sCAB9qBL+8ug11oAYZdwCYFXXUxBRBKb1wNhlkUJMCD9ts4HLhVMs1TDasqQgcTDhRW44DGo0bWWLMo1B5CbrqqgZ95hbYAOsjZA0ua6j8F1Mjkhv8dQ5pvUA0kO8AfIAgi5aosOqFnCLMwy6KMBBdIfH7P+viFYF14NRMQ3febSbDvDHlLZlTwBgQQXgxCohL4zkw7ARxkKJGwODkVd9QkJibJzvAEItXqAwEBoPwsdrKr025gnwJEAgbDv23GYcfowEXN/JJc+papkVJNh2Bu+BB9Ib1pQ2JmX30s9gYsVCCS+L7jUTisHiTh5vTG6bbWvuTABYRfPCU8GByMekCH9DbilZ3c0HSKQhxcttg8Z1K5vuL98KC+ETjWYnYv3DDPAuI/QL8eBRc5jY74D2UQhaOWN6DKnemMiyiI/Q6m0t7jJqRB1YlIeRjdcwqOvqoooQHVtthvgF9ptQZrwY7t7TOIWolv4FhK1HA+Ubh0LwBNSCyE+QVIKUdeQTTPZ/smo6yqrrLLKKqvMK/8BBtKv9AAhavsAAAAASUVORK5CYII=" alt="Ezel Cıvata"></span><span class="brand">TAKİP</span>${connDot()}</div>
        <div style="display:flex;gap:6px;justify-content:flex-end">${themeToggleHtml()}</div>
      </div>
      <div class="auth-form">
        <div class="field"><label>Kullanıcı Adı (OPRT No)</label><input id="login-username" placeholder="ör. OPRT7" value="${esc(loginForm.username)}" oninput="loginForm.username=this.value"></div>
        <div class="field"><label>Şifre</label><input id="login-password" type="password" placeholder="Şifreyi giriniz" value="${esc(loginForm.password)}" oninput="loginForm.password=this.value"></div>
        ${loginError ? `<div class="error-text">${esc(loginError)}</div>` : ''}
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
          <input id="login-remember" type="checkbox" style="width:auto"> Beni Hatırla (bu cihazda kalıcı giriş kalsın)
        </label>
        <button class="btn-primary" onclick="doLogin()">${ico('check',14)} Giriş Yap</button>
      </div>
    </div>
  </div>`;
}

/* ===================== RENDER: KİLİT EKRANI (aktif operasyon) ===================== */
function renderGroupScreen(groupId, groupMembers){
  const makine = groupMembers[0]?.makine || '—';
  const anyDurus = groupMembers.some(e=>e.status==='duruş');
  const ref = groupMembers[0];
  const header = `
    <div class="header">
      <div class="header-left">${connDot()}<span style="font-size:20px">${ico('factory',14)}</span><div><div class="brand">ROTA TAKİP</div><div class="brand-sub">${esc(session.username)} · ${esc(session.displayName)}</div></div></div>
      <button class="icon-btn" onclick="doLogout()" title="Çıkış">${ico('logout',14)}</button>
    </div>
    <div style="padding:14px 18px 0">
      <button class="lock-back-btn" onclick="closeGroupDetail()">← Makineler</button>
    </div>`;

  let actionBlock;
  if(anyDurus){
    actionBlock = `<div class="lock-actions" style="display:flex;gap:10px;margin-top:28px">
      <button class="btn-start" style="width:auto;padding:13px 26px" onclick="devamGrup('${groupId}')">${ico('play',14)} Devam Ettir (Tümü)</button>
    </div>`;
  } else {
    // DÜZELTME: durusOpen olsa bile butonlar yerinde kalıyor — asıl seçim artık aşağıda
    // gerçek bir MODAL (renderDurusModal) olarak açılıyor, satır içi değil (bkz. tekli iş
    // akışındaki aynı düzeltmenin açıklaması).
    actionBlock = `<div class="lock-actions" style="display:flex;gap:10px;margin-top:28px">
      <button class="chip" style="padding:13px 22px" onclick="toggleDurus(true)">${ico('clock',14)} Duruşa Al (Tümü)</button>
      <button class="btn-primary" style="width:auto;padding:13px 22px" onclick="bitirGrup('${groupId}')">${ico('stop',14)} Bitir (Tümü)</button>
    </div>`;
  }

  const body = `<div class="lock-screen">
    <div class="lock-label" style="${anyDurus?'color:var(--warn)':''}">${anyDurus?'DURUŞTA':'ÇOKLU İŞ EMRİ'}</div>
    <div class="lock-id">${esc(makine)}</div>
    <div class="lock-machine">${groupMembers.map(e=>esc(e.talepNo || e.isEmriNo)).join(', ')}</div>
    <div class="lock-timer" style="${anyDurus?'color:var(--warn)':''}">${anyDurus?fmtElapsed(nowTick-ref.duruşTs):fmtElapsed(entryDurationBreakdown(ref).netMs)}</div>
    <div class="lock-meta">${anyDurus?'duruş süresi (tüm iş emirleri için ortak)':`${groupMembers.length} iş emri bu makinede aynı anda aktif`}</div>
    ${anyDurus ? `<div class="durus-reason-box" style="${ref.duruşNedeni===GUN_SONU_REASON?'color:var(--gunsonu);background:var(--gunsonu-soft);border-color:var(--gunsonu-border)':isTadilatRelated(ref.duruşNedeni)?'color:var(--tadilat-info);background:var(--tadilat-soft);border-color:var(--tadilat-border)':''}">${ref.duruşNedeni===GUN_SONU_REASON?(ico('moon',13)+' '):isTadilatRelated(ref.duruşNedeni)?(ico('wrench',13)+' '):''}"${esc(ref.duruşNedeni)}"</div>` : ''}
    <div style="margin-top:20px;width:100%;max-width:440px;display:flex;flex-direction:column;gap:8px;text-align:left">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;padding:0 2px">Parti parti dönebilir — her iş emrini ayrı ayrı bitirebilirsin</div>
      ${groupMembers.map(e=>`
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
          <div>
            <div class="mono" style="font-weight:700;color:var(--accent)">${esc(e.talepNo || e.isEmriNo)}</div>
            <div style="font-size:11.5px;color:var(--text-muted)">Adet: ${esc(e.adet||'—')}${e.status==='duruş'?' · Duruşta':''}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-ghost" style="padding:8px 10px;font-size:12.5px" onclick="openEditActive('${e.id}')" title="Bilgileri Düzenle">${ico('edit',14)}</button>
            <button class="btn-ghost" style="padding:8px 14px;font-size:12.5px;white-space:nowrap" onclick="bitir('${e.id}')">${ico('stop',14)} Bitir</button>
          </div>
        </div>
      `).join('')}
    </div>
    ${actionBlock}
  </div>`;

  const editingMember = groupMembers.find(e=>e.id===editingActiveId);
  const editBlock = editingMember ? `
    <div class="modal-overlay" onclick="if(event.target===this) cancelEditActive()">
      <div class="modal-box" style="max-width:400px">
        <div class="modal-header">
          <div><div class="modal-title">Bilgileri Düzenle</div><div class="modal-sub">${esc(editingMember.talepNo || editingMember.isEmriNo)} · ${esc(editingMember.makine)}</div></div>
          <button class="icon-btn" onclick="cancelEditActive()">${ico('x',14)}</button>
        </div>
        <div class="modal-body">
          <div class="field"><label>İş Talep No</label><input id="edit-talepno" class="mono" value="${esc(editForm.talepNo)}"></div>
          <div class="field"><label>Malzeme Cinsi</label><input id="edit-malzeme-cinsi" value="${esc(editForm.malzemeCinsi)}"></div>
          <div class="field"><label>Çap ve Boy</label><input id="edit-cap-boy" value="${esc(editForm.capBoy)}"></div>
          <div class="field"><label>Adet</label><input id="edit-adet" inputmode="numeric" value="${esc(editForm.adet)}" oninput="this.value=this.value.replace(/\\D/g,'')"></div>
          <div class="field"><label>Not</label><textarea id="edit-not" style="min-height:60px">${esc(editForm.not)}</textarea></div>
          ${switchRow('edit-son-operasyon', editForm.sonOperasyon, 'Son Operasyon', 'Bitince iş rotası kapanır', {style:'margin-bottom:14px'})}
          <div style="display:flex;gap:10px">
            <button class="btn-primary" onclick="saveEditActive('${editingMember.id}')">${ico('check',14)} Kaydet</button>
            <button class="btn-ghost" onclick="cancelEditActive()">${ico('x',14)} Vazgeç</button>
          </div>
        </div>
      </div>
    </div>` : '';

  return `<div class="root-mobile theme-${resolvedTheme()}">${header}${body}${editBlock}${!anyDurus && durusOpen ? renderDurusModal() : ''}</div>`;
}
function renderLockScreen(active){
  const header = `
    <div class="header">
      <div class="header-left">${connDot()}<span style="font-size:20px">${ico('factory',14)}</span><div><div class="brand">ROTA TAKİP</div><div class="brand-sub">${esc(session.username)} · ${esc(session.displayName)}</div></div></div>
      <button class="icon-btn" onclick="doLogout()" title="Çıkış">${ico('logout',14)}</button>
    </div>
    <div style="padding:14px 18px 0">
      <button class="lock-back-btn" onclick="closeActiveDetail()">← Makineler</button>
    </div>`;

  const editBlock = editingActiveId===active.id ? `
    <div class="modal-overlay" onclick="if(event.target===this) cancelEditActive()">
      <div class="modal-box" style="max-width:400px">
        <div class="modal-header">
          <div><div class="modal-title">Bilgileri Düzenle</div><div class="modal-sub">${esc(active.makine)}</div></div>
          <button class="icon-btn" onclick="cancelEditActive()">${ico('x',14)}</button>
        </div>
        <div class="modal-body">
          <div class="field"><label>İş Talep No</label><input id="edit-talepno" class="mono" value="${esc(editForm.talepNo)}"></div>
          <div class="field"><label>Malzeme Cinsi</label><input id="edit-malzeme-cinsi" value="${esc(editForm.malzemeCinsi)}"></div>
          <div class="field"><label>Çap ve Boy</label><input id="edit-cap-boy" value="${esc(editForm.capBoy)}"></div>
          <div class="field"><label>Adet</label><input id="edit-adet" inputmode="numeric" value="${esc(editForm.adet)}" oninput="this.value=this.value.replace(/\\D/g,'')"></div>
          <div class="field"><label>Not</label><textarea id="edit-not" style="min-height:60px">${esc(editForm.not)}</textarea></div>
          ${switchRow('edit-son-operasyon', editForm.sonOperasyon, 'Son Operasyon', 'Bitince iş rotası kapanır', {style:'margin-bottom:14px'})}
          <div style="display:flex;gap:10px">
            <button class="btn-primary" onclick="saveEditActive('${active.id}')">${ico('check',14)} Kaydet</button>
            <button class="btn-ghost" onclick="cancelEditActive()">${ico('x',14)} Vazgeç</button>
          </div>
        </div>
      </div>
    </div>` : '';
  const editButton = `<button class="btn-ghost" style="margin-top:20px" onclick="openEditActive('${active.id}')">${ico('edit',14)} Bilgileri Düzenle (Malzeme / Adet / Not)</button>`;

  if(active.status==='duruş'){
    return `<div class="root-mobile theme-${resolvedTheme()}">${header}
      <div class="lock-screen">
        <div class="lock-label" style="color:var(--warn)">DURUŞTA</div>
        <div class="lock-id">${esc(active.talepNo || active.isEmriNo)}</div>
        ${active.talepNo ? `<div style="font-size:12px;color:var(--text-muted);margin-top:-4px" class="mono">U kodu: ${esc(active.isEmriNo)}</div>` : ''}
        <div class="lock-machine">${esc(active.makine)}</div>
        <div class="lock-timer" style="color:var(--warn)">${fmtElapsed(nowTick-active.duruşTs)}</div>
        <div class="lock-meta">duruş süresi</div>
        <div class="durus-reason-box" style="${active.duruşNedeni===GUN_SONU_REASON?'color:var(--gunsonu);background:var(--gunsonu-soft);border-color:var(--gunsonu-border)':isTadilatRelated(active.duruşNedeni)?'color:var(--tadilat-info);background:var(--tadilat-soft);border-color:var(--tadilat-border)':''}">${active.duruşNedeni===GUN_SONU_REASON?(ico('moon',13)+' '):isTadilatRelated(active.duruşNedeni)?(ico('wrench',13)+' '):''}"${esc(active.duruşNedeni)}"</div>
        <div class="lock-actions" style="display:flex;gap:10px;margin-top:28px">
          <button class="btn-start" style="width:auto;padding:13px 26px" onclick="devamEt('${active.id}')">${ico('play',14)} Devam Ettir</button>
        </div>
        ${editButton}
        ${editBlock}
      </div></div>`;
  }

  // DÜZELTME: Eskiden durusOpen true olunca "Duruşa Al/Bitir" butonları YOK OLUP yerine satır
  // içi bir panel açılıyordu — bu panel gerçek bir modal olmadığı için arkadaki lock-screen
  // (canlı sayaç, diğer tıklanabilir alanlar) hâlâ üstteydi/etkileşilebilirdi: "arka plan
  // hareket ediyor, birkaç saniye tıklayamıyorum" şikayetinin kaynağı buydu. Artık durusOpen
  // olsa bile bu butonlar YERİNDE KALIYOR (görünmez olmuyor) — asıl seçim ekranı, aşağıda
  // ayrı bir gerçek MODAL (renderDurusModal — sabit konumlu, arka planı karartan, altındaki
  // hiçbir şeyle etkileşime izin vermeyen) olarak açılıyor.
  const durusBlock = `<div class="lock-actions" style="display:flex;gap:10px;margin-top:28px;flex-wrap:wrap;justify-content:center">
      <button class="chip" style="padding:13px 22px" onclick="toggleDurus(true)">${ico('clock',14)} Duruşa Al</button>
      <button class="btn-primary" style="width:auto;padding:13px 22px" onclick="bitir('${active.id}')">${ico('stop',14)} Bitir</button>
      ${!active.sonOperasyon ? `<button class="btn-ghost" style="padding:13px 18px" onclick="openKismiAktar('${active.id}')" title="Hazır olan bir kısmını bir sonraki operasyona aktar">${ico('shuffle',14)} Kısmi Aktar</button>` : ''}
    </div>`;

  return `<div class="root-mobile theme-${resolvedTheme()}">${header}
    <div class="lock-screen">
      <div class="lock-label">AKTİF OPERASYON</div>
      <div class="lock-id">${esc(active.talepNo || active.isEmriNo)}</div>
      ${active.talepNo ? `<div style="font-size:12px;color:var(--text-muted);margin-top:-4px" class="mono">U kodu: ${esc(active.isEmriNo)}</div>` : ''}
      <div class="lock-machine">${esc(active.makine)}</div>
      <div class="lock-timer">${fmtElapsed(entryDurationBreakdown(active).netMs)}</div>
      <div class="lock-meta">${fmtDT(active.startTs)} itibarıyla devam ediyor</div>
      ${active.adet ? `<div class="lock-meta">Adet: ${esc(active.adet)}</div>` : ''}
      ${active.not ? `<div class="lock-note">"${esc(active.not)}"</div>` : ''}
      ${durusBlock}
      ${editButton}
      ${editBlock}
    </div>${durusOpen ? renderDurusModal() : ''}${kismiAktarId ? renderKismiAktarModal() : ''}</div>`;
}

/* ===================== MOBİL ALT GEZİNME (v27) =====================
   Telefonda üstteki sekme şeridi gizleniyor, yerine başparmak bölgesinde sabit bir alt çubuk
   geliyor: Makineler · Geçmiş · Yeni · Tadilat · Ayarlar. Üstünde "aktif iş şeridi" — hangi
   sekmede olursan ol çalışan işi ve süresini gösterir, dokununca o işin ekranını açar.
   Masaüstü görünümü değişmiyor (tüm kurallar max-width:768px içinde). */
let newStep = 1;
function isPhone(){ try{ return window.matchMedia('(max-width:768px)').matches; }catch(e){ return false; } }
function setNewStep(n){ newStep = n; render(); try{ window.scrollTo(0,0); }catch(e){} }
function goNewStep2(){
  const eksik = [];
  if(newForm.cokluMode){ if(!newForm.cokluItems.some(it=>String(it.isEmriNo||'').trim())) eksik.push('en az bir İş Emri No'); }
  else if(!String(newForm.isEmriNo||'').trim()) eksik.push('İş Emri No');
  if(!String(newForm.makine||'').trim()) eksik.push('Çalışılan Makine');
  if(eksik.length){ toast('Önce ' + eksik.join(' ve ') + ' gir'); return; }
  setNewStep(2);
}
function setAdetQuick(n){ newForm.adet = String(n); const el = document.getElementById('nf-adet'); if(el) el.value = String(n); }

/* ===================== İKON SETİ =====================
   Emoji yerine tek bir inline SVG seti: her platformda (Android/iOS/Windows) aynı
   çizim, currentColor ile bulunduğu butonun rengini alır, boyutu tek yerden ayarlanır. */
const ICONS = {
  factory:'<path d="M3 21h18"/><path d="M4 21V11l5 3V11l5 3V8l5 3v10"/><path d="M8 21v-3"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 7.5V12l3 2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  box:'<path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16.7 16.7"/>',
  camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5l2-3h7l2 3H21a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  x:'<path d="M18 6L6 18M6 6l12 12"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  chart:'<path d="M3 3v18h18"/><path d="M8 17v-5"/><path d="M13 17V8"/><path d="M18 17v-8"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  shuffle:'<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M3 4l5 5"/>',
  alert:'<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  chevronRight:'<path d="M9 18l6-6-6-6"/>',
  chevronDown:'<path d="M6 9l6 6 6-6"/>',
  chevronUp:'<path d="M18 15l-6-6-6 6"/>',
  play:'<path d="M6 3l15 9-15 9V3z"/>',
  pause:'<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  repeat:'<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  hourglass:'<path d="M5 22h14M5 2h14M6 2c0 4 12 12 12 20M18 2c0 4-12 12-12 20"/>',
  lock:'<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
};
function ico(name, size){
  const p = ICONS[name]; if(!p) return '';
  const s = size || 15;
  return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
}
function switchRow(id, checked, title, sub, opts){
  const o = opts||{};
  return `<label class="sw ${o.ok?'sw-ok':''}" style="${o.style||''}">
    <input id="${id}" type="checkbox" ${checked?'checked':''} ${o.onchange?`onchange="${o.onchange}"`:''}>
    <span class="sw-track"><span class="sw-knob"></span></span>
    <span><span class="sw-title">${title}</span>${sub?`<span class="sw-sub" style="display:block">${sub}</span>`:''}</span>
  </label>`;
}
let pwOpen = false;
function togglePwPanel(){ pwOpen = !pwOpen; render(); }
function onPushToggle(el){
  if(el.checked){ enablePushNotifications(); return; }
  el.checked = true;
  toast('Bildirimleri kapatmak için telefon/tarayıcı ayarlarını kullan');
}
function initials(name){ return String(name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase(); }
function myRoleLabel(){ return session.isSuperAdmin ? 'Süper Admin' : session.isSef ? 'Şef' : session.isUretimSef ? 'Üretim Şef' : session.isAdmin ? 'Yönetici' : 'Operatör'; }
function themeOptHtml(val, label, a, b){
  return `<button class="theme-opt ${theme===val?'on':''}" onclick="setTheme('${val}')">
    <span class="theme-swatch"><span style="flex:1;background:${a}"></span><span style="flex:1;background:${b}"></span></span>
    <span>${label}</span>
  </button>`;
}

/* ===================== DURUM ROZETİ =====================
   Her ekranda (kart, tablo, modal, matris efsanesi) aynı görünen tek bileşen:
   renkli nokta + etiket. Renk/etiket eşlemesi tek yerden yönetilir. */
const STATUS_MAP = {
  calisiyor: ['var(--success)','Çalışıyor'],
  durus:     ['var(--warn)','Duruşta'],
  tadilat:   ['var(--tadilat-info)','Tadilat'],
  bos:       ['var(--danger)','Boşta'],
  bekliyor:  ['var(--text-muted)','Bekliyor'],
  tamam:     ['var(--success)','Tamamlandı'],
};
function statusBadge(kind, label){
  const m = STATUS_MAP[kind] || ['var(--text-muted)', kind];
  return '<span class="sbadge" style="--sb:'+m[0]+'"><span class="sbadge-dot"></span>'+esc(label || m[1])+'</span>';
}
function entryStatusKind(e){ return e.status==='devam' ? 'calisiyor' : e.status==='duruş' ? 'durus' : 'tamam'; }

// NOT: Eski bottomStripHtml() (altta sabit "aktif iş şeridi") kaldırıldı — yerini sürüklenebilir
// aktif iş baloncuğu aldı, bkz. js/bubble.js. Baloncuk #app'ten bağımsız kendi kalıcı köküne
// (#bubble-root) çizildiği için artık bottomNavHtml()'in döndürdüğü HTML'in parçası değil.
function bottomNavHtml(){
  const isImalat = getUserAtolyeler(session.username).includes('imalat');
  const hasFason = !!(STATE.operators[session.username]||{}).fasonYetkisi;
  const tadBek = tadilatBekleyenlerCombined(session.username).length;
  const fasBek = hasFason ? fasonBekleyenCount() : 0;
  const item = (v,icoHtml,label,badge) => `<button class="bn-item ${view===v?'active':''}" onclick="setView('${v}')"><span class="bn-ico">${icoHtml}</span><span class="bn-lbl">${label}</span>${badge>0?`<span class="bn-badge">${badge}</span>`:''}</button>`;
  return `<nav class="bottom-nav">
    ${item('list',ico('factory',26),'Makineler',0)}
    ${item('gecmis',ico('history',26),'Geçmiş',0)}
    ${isImalat ? item('new',ico('plus',26),'Yeni',0) : ''}
    ${item('tadilat',ico('wrench',26),'Tadilat',tadBek)}
    ${hasFason ? item('fason',ico('box',26),'Fason',fasBek) : ''}
    ${item('settings',ico('gear',26),'Ayarlar',0)}
  </nav>`;
}

