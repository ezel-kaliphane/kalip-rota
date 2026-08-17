/* ===================== RENDER: OPERATÖR ANA UYGULAMA ===================== */
function renderOperator(){
  if(view==='new' && !getUserAtolyeler(session.username).includes('imalat')){ view = 'tadilat'; }
  const detailEntry = activeDetailId ? entriesArray().find(e=>e.id===activeDetailId && (e.status==='devam'||e.status==='duruş')) : null;
  if(detailEntry) return renderLockScreen(detailEntry);
  const groupMembers = activeGroupId ? entriesArray().filter(e=>e.groupId===activeGroupId && (e.status==='devam'||e.status==='duruş')) : [];
  if(activeGroupId && groupMembers.length>0) return renderGroupScreen(activeGroupId, groupMembers);
  if(activeGroupId && groupMembers.length===0){ activeGroupId=null; }

  const header = `
    <div class="header">
      <div class="header-left">${connDot()}<span style="font-size:20px">${ico('factory',14)}</span><div><div class="brand">ROTA TAKİP</div><div class="brand-sub">${esc(session.username)} · ${esc(session.displayName)}</div></div></div>
      <div style="display:flex;gap:6px">
        ${themeToggleHtml()}
        <button class="icon-btn" onclick="openSendMessage()" title="Mesaj / Öneri Gönder">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
        ${canViewMessages() ? `<button class="icon-btn" style="position:relative" onclick="openMessagesModal()" title="Mesajlar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M2 6l10 7 10-7"></path></svg>
          ${unreadMessageCount()>0 ? `<span style="position:absolute;top:-4px;left:-4px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center;line-height:1.3">${unreadMessageCount()}</span>` : ''}
        </button>` : ''}
        <button class="icon-btn" style="position:relative" onclick="openMyPushHistoryModal()" title="Bildirimlerim">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          ${unreadPushCount()>0 ? `<span style="position:absolute;top:-4px;left:-4px;background:var(--accent);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center;line-height:1.3">${unreadPushCount()}</span>` : ''}
        </button>
        <button class="icon-btn" onclick="setView('settings')" title="Ayarlar">${ico('gear',14)}</button>
        <button class="icon-btn" onclick="doLogout()" title="Çıkış">${ico('logout',14)}</button>
      </div>
    </div>
    ${myPushHistoryModalOpen ? renderMyPushHistoryModal() : ''}
    <div class="tabs">
      <button class="tab-btn ${view==='list'?'active':''}" onclick="setView('list')">${ico('factory',14)} Makineler</button>
      ${getUserAtolyeler(session.username).includes('imalat') ? `<button class="tab-btn ${view==='new'?'active':''}" onclick="setView('new')">+ Yeni Kayıt</button>` : ''}
      <button class="tab-btn ${view==='gecmis'?'active':''}" onclick="setView('gecmis')">${ico('history',14)} Geçmiş</button>
      ${(STATE.operators[session.username]||{}).fasonYetkisi ? `<button class="tab-btn ${view==='fason'?'active':''}" onclick="setView('fason')">${ico('box',14)} Fason${fasonBekleyenCount()>0?` (${fasonBekleyenCount()})`:''}</button>` : ''}
      <button class="tab-btn ${view==='tadilat'?'active':''}" onclick="setView('tadilat')">${ico('wrench',14)} Tadilat${tadilatBekleyenlerCombined(session.username).length>0?` (${tadilatBekleyenlerCombined(session.username).length})`:''}</button>
    </div>`;

  let body = '';
  if(view==='tadilat'){
    const sess = tadilatForceBekleyen ? null : myActiveTadilatSession();
    if(sess && sess.operasyon.status==='duruş'){
      const { tadilat: mine, operasyon: op } = sess;
      const isTadDurus = isTadilatReason(op.duruşNedeni);
      body = `<div class="lock-screen" style="padding-top:40px">
        <div class="lock-label" style="color:var(--warn)">TADİLAT — DURAKLATILDI</div>
        <div class="lock-id">${esc(mine.uKodu)}</div>
        <div class="lock-machine">${esc(op.makine||'—')}</div>
        <div class="lock-timer" style="color:var(--warn)">${op.duruşTs ? fmtElapsed(nowTick-op.duruşTs) : '—:—'}</div>
        <div class="lock-meta">${op.duruşTs ? 'duruş süresi' : 'seçim yapılıyor — duruş henüz başlamadı'}</div>
        <div class="durus-reason-box" style="${isTadDurus?'color:var(--tadilat-info);background:var(--tadilat-med);border-color:var(--tadilat-border)':''}">${isTadDurus?(ico('wrench',13)+' '):''}"${esc(op.duruşNedeni)}"</div>
        <div class="lock-actions lock-actions-nav-clear" style="display:flex;gap:10px;margin-top:24px">
          <button class="btn-start" style="width:auto;padding:13px 26px" onclick="devamEtTadilatDurus()">${ico('play',14)} Duraklatmayı Devam Ettir</button>
        </div>
        ${isTadDurus ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:18px;max-width:320px;text-align:center">İstersen Tadilat sekmesinden bekleyen başka bir işi alıp devam edebilirsin — bu iş burada duraklatılmış kalır, bitirdiğinde otomatik geri döneceksin.</div>` : ''}
      </div>`;
    } else if(sess){
      const { tadilat: mine, operasyon: op } = sess;
      const opsGecmis = tadilatOperasyonlarArray(mine).filter(o=>o.id!==op.id);
      if(tadilatDurusPickerOpen){
        body = `<div class="lock-screen" style="padding-top:40px">
          <div class="lock-label">TADİLATI DURAKLAT</div>
          <div class="lock-id" style="font-size:22px">${esc(mine.uKodu)}</div>
        </div>${renderDurusModal()}`;
      } else {
        body = `<div class="lock-screen" style="padding-top:40px">
          <div class="lock-label">TADİLAT — AKTİF</div>
          <div class="lock-id">${esc(mine.uKodu)}</div>
          ${resimBulEnabled() ? `<button class="btn-ghost" style="margin-top:4px;padding:6px 14px;font-size:11.5px" onclick="resimBul('${escJs(mine.uKodu)}')">${ico('camera',14)} Resim/Çizim Bul</button>` : ''}
          <div class="lock-machine">${esc(op.makine||'—')}</div>
          <div class="lock-timer">${fmtElapsed(tadilatOpDurationBreakdown(op).netMs)}</div>
          <div class="lock-meta">${fmtDT(op.baslamaTs)} itibarıyla devam ediyor${opsGecmis.length>0?` · Bu, ${opsGecmis.length+1}. operasyon`:''}</div>
          <div class="lock-meta">${mine.bolum?`${esc(mine.bolum)} · `:''}${mine.adet?`Adet: ${esc(mine.adet)}`:''}</div>
          ${mine.aciklama ? `<div class="lock-note">"${esc(mine.aciklama)}"</div>` : ''}
          <div style="font-size:12px;color:var(--text-muted);margin-top:16px;max-width:320px;text-align:center">Bitirirken seç: bu iş tamamen bitti mi, yoksa devamı gelecek mi?</div>
          <div class="lock-actions lock-actions-col lock-actions-nav-clear" style="display:flex;flex-direction:column;gap:10px;margin-top:14px;width:100%;max-width:340px">
            <button class="btn-primary" style="padding:14px" onclick="tadilatBitir('${mine.id}','${op.id}',true)">${ico('stop',14)} Tamamen Bitir <span style="font-weight:400;opacity:.85">(Son Operasyon)</span></button>
            <button style="padding:14px;font-size:14px;border-radius:10px;border:2px solid var(--gunsonu);background:var(--gunsonu-med);color:var(--gunsonu);font-weight:700;cursor:pointer" onclick="tadilatBitir('${mine.id}','${op.id}',false)">${ico('pause',14)} Bu Operasyonu Bitir <span style="opacity:.85;font-weight:600">(Devamı Var)</span></button>
            <button class="btn-ghost" onclick="openTadilatDurusPicker()">${ico('clock',14)} Duraklat <span style="opacity:.7;font-weight:400">(daha acil bir iş çıktıysa)</span></button>
          </div>
          ${op.kaynakEntryId ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:18px;max-width:320px;text-align:center">Hangisini seçersen seç, duraklattığın üretim işi otomatik olarak "${TADILAT_SONRASI_REASON}" duruşuna geçecek — kaldığın yerden devam edebileceksin.</div>` : ''}
          ${op.kaynakTadilatRef ? `<div style="font-size:11.5px;color:var(--tadilat-info);margin-top:18px;max-width:320px;text-align:center">Bunu bitirince, daha önce duraklattığın diğer tadilata otomatik döneceksin.</div>` : ''}
        </div>`;
      }
    } else {
      const renderCard = (t) => {
        const expanded = tadilatExpandedIds.has(t.id);
        const gecmis = tadilatOperasyonlarArray(t).filter(o=>o.status==='tamamlandi');
        const secimAcik = tadilatMakineSecimId===t.id;
        return `<div class="card">
          <div class="card-header" style="cursor:pointer" onclick="toggleTadilatExpand('${t.id}')"><span class="card-id" style="color:var(--warn)">${ico('hourglass',13)} ${esc(t.uKodu)}${tadilatKisaLabel(t)?` <span style="color:var(--text-muted);font-weight:400;font-size:.75em">${esc(tadilatKisaLabel(t))}</span>`:''}</span><span class="card-meta">${expanded?`${ico('chevronUp',12)} gizle`:`${ico('chevronDown',12)} detay`}</span></div>
          ${expanded ? `
            <div style="font-size:12.5px;color:var(--text-muted);margin:6px 0 8px">${t.talepEdenKisi?`${esc(t.talepEdenKisi)} · `:''}${t.bolum?`${esc(t.bolum)} · `:''}${t.adet?`Adet: ${esc(t.adet)}`:''}</div>
            <div style="font-size:13px;margin-bottom:8px">${esc(t.aciklama)}</div>
            ${gecmis.length>0 ? `<div style="font-size:11.5px;color:var(--accent);margin-bottom:10px">${ico('repeat',13)} ${gecmis.length} operasyon tamamlandı, devamı bekleniyor</div>` : ''}
            ${resimBulEnabled() ? `<button class="btn-ghost" style="padding:6px 14px;font-size:11.5px;margin-bottom:8px" onclick="event.stopPropagation(); resimBul('${escJs(t.uKodu)}')">${ico('camera',14)} Resim/Çizim Bul</button>` : ''}
          ` : ''}
          ${secimAcik ? `
            <div style="background:var(--panel-alt);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px">
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Hangi makinede yapılacak?</div>
              <input id="tad-al-makine-${t.id}" list="tadilat-makine-options" placeholder="Makine seç" value="${esc(tadilatKaynakMakine())}" style="margin-bottom:8px">
              <div style="display:flex;gap:8px">
                <button class="btn-primary" style="flex:1" onclick="tadilatAl('${t.id}', document.getElementById('tad-al-makine-${t.id}').value)">${ico('play',14)} Başla</button>
                <button class="btn-ghost" onclick="cancelTadilatMakineSecim()">Vazgeç</button>
              </div>
            </div>
          ` : `<button class="btn-primary" onclick="openTadilatMakineSecim('${t.id}')">${ico('play',14)} Bu İşi Al ve Başla</button>`}
        </div>`;
      };
      const myAtolyeler = getUserAtolyeler(session.username);
      body = `<div class="body-pad">
        <datalist id="tadilat-makine-options">${getAllowedMachines().map(m=>`<option value="${esc(m)}">`).join('')}</datalist>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px">Bekleyen Tadilat İşleri</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px">Bir işi alırsan üzerinde çalışmaya başlarsın. İşi bitirirken tamamen mi bitti yoksa devamı mı var, orada seçersin.</div>
        ${tadilatForceBekleyen ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--tadilat-med);border:2px solid var(--tadilat-info);border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:13.5px;font-weight:700;color:var(--tadilat-info)">${ico('wrench',14)} Tadilat duraklatıldı — devam edeceğin işi seç.</div>
          <button class="btn-ghost" style="white-space:nowrap" onclick="cancelTadilatInterrupt()">${ico('x',14)} İptal, geri dön</button>
        </div>` : ''}
        ${myAtolyeler.map(a=>{
          const list = tadilatBekleyenler(a);
          return `<div style="font-size:12.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px">${a==='tadilat'?(ico('wrench',14)+' Tadilat Atölye'):(ico('factory',14)+' İmalat Atölye')} (${list.length})</div>
          ${list.length===0 ? `<div style="color:var(--text-muted);padding:14px 0;font-size:12.5px">Bekleyen tadilat işi yok.</div>` : list.map(renderCard).join('')}`;
        }).join('')}
      </div>`;
    }
  } else if(view==='fason'){
    const items = entriesArray().filter(e => (e.status==='devam'||e.status==='duruş') && isFasonMachine(e.makine));
    const groups = [];
    const seenG = new Set();
    items.forEach(e=>{
      if(e.groupId){
        if(seenG.has(e.groupId)) return;
        seenG.add(e.groupId);
        groups.push({ groupId:e.groupId, members: items.filter(x=>x.groupId===e.groupId) });
      } else {
        groups.push({ groupId:null, members:[e] });
      }
    });
    body = `<div class="body-pad">
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px">Fason makinelerdeki (dışarı gönderilen) tüm aktif işler — kim başlatmış olursa olsun burada görünür ve kapatılabilir.</div>
      ${groups.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:40px 0">Fasonda bekleyen iş yok.</div>` : groups.map(g=>{
        if(g.members.length===1){
          const e = g.members[0];
          const dotColor = e.status==='duruş'?'var(--warn)':'var(--success)';
          const subInfo = e.status==='duruş' ? `Duruşta: "${esc(e.duruşNedeni)}"` : `${fmtElapsed(entryDurationBreakdown(e).netMs)} · ${esc(e.operatorUsername)} başlattı`;
          return `<div class="card" style="cursor:pointer" onclick="openActiveDetail('${e.id}')">
            <div class="card-header"><span class="card-id">${esc(e.talepNo || e.isEmriNo)}</span><span class="matrix-dot" style="background:${dotColor};width:9px;height:9px;border-radius:50%;display:inline-block"></span></div>
            ${e.talepNo ? `<div style="font-size:11px;color:var(--text-muted);margin:-4px 0 4px" class="mono">U kodu: ${esc(e.isEmriNo)}</div>` : ''}
            <div class="op-top" style="margin-bottom:6px"><span class="op-code">${esc(e.makine)}</span></div>
            <div class="op-foot">${subInfo}${e.adet?` · Adet: ${esc(e.adet)}`:''}</div>
          </div>`;
        }
        const makine = g.members[0].makine;
        const anyDurus = g.members.some(m=>m.status==='duruş');
        const dotColor = anyDurus ? 'var(--warn)' : 'var(--success)';
        return `<div class="card" style="cursor:pointer" onclick="openGroupDetail('${g.groupId}')">
          <div class="card-header"><span class="card-id">${g.members.length} İş Emri Aktif</span><span class="matrix-dot" style="background:${dotColor};width:9px;height:9px;border-radius:50%;display:inline-block"></span></div>
          <div class="op-top" style="margin-bottom:6px"><span class="op-code">${esc(makine)}</span></div>
          <div class="op-foot">${g.members.map(m=>`${esc(m.talepNo || m.isEmriNo)} (${m.status==='duruş'?'duruşta':fmtElapsed(entryDurationBreakdown(m).netMs)})`).join(', ')}</div>
        </div>`;
      }).join('')}
    </div>`;
  } else if(view==='new'){
    const allowed = getAllowedMachines();
    const canCoklu = !!(STATE.operators[session.username]||{}).cokluIsEmri;
    // Telefonda form iki adıma bölünüyor: (1) iş emri + makine, (2) adet + detay + başlat.
    // Masaüstünde tek sayfa olarak kalıyor (twoStep=false).
    const twoStep = isPhone();
    const s1 = !twoStep || newStep===1;
    const s2 = !twoStep || newStep===2;
    const stepBar = twoStep ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <div style="flex:1;height:4px;border-radius:2px;background:var(--accent)"></div>
        <div style="flex:1;height:4px;border-radius:2px;background:${newStep===2?'var(--accent)':'var(--panel-alt)'}"></div>
        <span style="font-size:11.5px;color:var(--text-muted);white-space:nowrap">Adım ${newStep} / 2</span>
      </div>` : '';
    body = `<div class="body-pad">
      ${stepBar}
      ${s1 ? `
      ${canCoklu ? switchRow('nf-coklu-mode', newForm.cokluMode, 'Çoklu İş Emri', 'Bu makinede aynı anda birden fazla iş emri', {onchange:'toggleCokluMode(this.checked)', style:'margin-bottom:14px'}) : ''}
      ${newForm.cokluMode ? `
        <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px">Her iş için ayrı İş Emri No (Talep No) ve Adet gir. İstediğin kadar ekleyebilirsin.</div>
        ${newForm.cokluItems.map((it,i)=>{
          const cInfo = getTalepInfo(it.isEmriNo);
          return `
          <div style="margin-bottom:10px">
          <div style="display:flex;gap:8px;align-items:flex-end">
            <div class="field" style="flex:1.3;margin-bottom:0"><label>İş Emri No (Talep No) ${i+1}</label><input id="nf-coklu-isemri-${i}" class="mono" placeholder="ör. 2607140006" value="${esc(it.isEmriNo)}" oninput="newForm.cokluItems[${i}].isEmriNo=this.value" onblur="render()"></div>
            <div class="field" style="width:110px;margin-bottom:0"><label>Bileşen</label><select id="nf-coklu-bilesen-${i}" onchange="newForm.cokluItems[${i}].bilesen=this.value; render()">
              <option value="" ${!it.bilesen?'selected':''}>Tek Parça</option>
              <option value="ZARF" ${it.bilesen==='ZARF'?'selected':''}>_ZARF (Çelik)</option>
              <option value="ELMAS" ${it.bilesen==='ELMAS'?'selected':''}>_ELMAS (Karbür)</option>
            </select></div>
            <div class="field" style="width:80px;margin-bottom:0"><label>Adet</label><input id="nf-coklu-adet-${i}" inputmode="numeric" placeholder="120" value="${esc(it.adet)}" oninput="this.value=this.value.replace(/\\D/g,''); newForm.cokluItems[${i}].adet=this.value" onblur="render()"></div>
            ${newForm.cokluItems.length>1 ? `<button type="button" class="btn-ghost" style="padding:10px 12px" onclick="removeCokluItem(${i})">${ico('trash',14)}</button>` : ''}
          </div>
          ${it.isEmriNo ? (cInfo ? `<div style="font-size:11.5px;color:var(--success);margin:4px 0 0 2px">${ico('check',14)} ${esc(cInfo.malzemeKodu||'')}${cInfo.malzemeKodu&&cInfo.malzemeAdi?' · ':''}${esc(cInfo.malzemeAdi||'')}</div>` : (Object.keys(STATE.validIsEmri||{}).length>0 ? `<div style="font-size:11.5px;color:var(--warn);margin:4px 0 0 2px">${ico('alert',14)} Bu talep no listede bulunamadı</div>` : '')) : ''}
          ${(() => {
            if(!stockEnabled() || !it.isEmriNo) return '';
            const { isEmriNo: prevCode } = resolveTrackingCode(it.isEmriNo, it.bilesen);
            if(!isFirstOperationFor(prevCode)) return '';
            const opts = stockConsumableOptions();
            if(opts.length===0) return '';
            const selOpt = stockOptionByValue(it.stockItemId);
            const isManualInput = selOpt && (selOpt.tur==='boy' || selOpt.mode==='manuel');
            return `<div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:6px">
              <div style="font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${ico('box',14)} İlk Operasyon — Hammadde (opsiyonel)</div>
              <select id="nf-coklu-stok-${i}" onchange="newForm.cokluItems[${i}].stockItemId=this.value; render()" style="margin-bottom:${isManualInput?'6px':'0'}">
                <option value="">Hammadde tüketilmiyor</option>
                ${opts.map(o=>`<option value="${o.value}" ${it.stockItemId===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}
              </select>
              ${selOpt ? (isManualInput
                ? `<input id="nf-coklu-stok-miktar-${i}" type="number" placeholder="${selOpt.tur==='boy'?`Kesilen boy (${esc(selOpt.birim||'mm')})`:'Kullanılan miktar'}" value="${esc(it.stockMiktar)}" oninput="newForm.cokluItems[${i}].stockMiktar=this.value">`
                : `<div style="font-size:11px;color:var(--text-muted)">Otomatik: Adet kadar (${esc(it.adet||'?')} ${esc(selOpt.birim||'')}) düşülecek</div>`) : ''}
            </div>`;
          })()}
          </div>
        `}).join('')}
        <button type="button" class="btn-ghost" style="margin-bottom:14px" onclick="addCokluItem()">+ İş Emri Ekle</button>
      ` : `
        <div style="display:flex;gap:8px">
          <div class="field" style="flex:1"><label>İş Emri No (Talep No)</label><input id="nf-isemri" class="mono" placeholder="ör. 2607140006" value="${esc(newForm.isEmriNo)}" oninput="newForm.isEmriNo=this.value" onblur="render()"></div>
          <div class="field" style="width:130px"><label>Bileşen</label><select id="nf-bilesen" onchange="newForm.bilesen=this.value; render()">
            <option value="" ${!newForm.bilesen?'selected':''}>Tek Parça</option>
            <option value="ZARF" ${newForm.bilesen==='ZARF'?'selected':''}>_ZARF (Çelik)</option>
            <option value="ELMAS" ${newForm.bilesen==='ELMAS'?'selected':''}>_ELMAS (Karbür)</option>
          </select></div>
        </div>
        ${(() => {
          const info = getTalepInfo(newForm.isEmriNo);
          const lines = [];
          if(newForm.isEmriNo){
            if(info) lines.push(`<div style="font-size:11.5px;color:var(--success)">${ico('check',14)} ${esc(info.malzemeKodu||'')}${info.malzemeKodu&&info.malzemeAdi?' · ':''}${esc(info.malzemeAdi||'')}</div>`);
            else if(Object.keys(STATE.validIsEmri||{}).length>0) lines.push(`<div style="font-size:11.5px;color:var(--warn)">${ico('alert',14)} Bu talep no listede bulunamadı</div>`);
          }
          if(newForm.bilesen) lines.push(`<div style="font-size:11.5px;color:var(--text-muted)">Kaydedilecek kod: <b class="mono" style="color:var(--accent)">${esc(newForm.isEmriNo||'…')}${BILESEN_SUFFIX[newForm.bilesen]}</b></div>`);
          if(!newForm.bilesen && newForm.isEmriNo){
            const incomplete = incompleteBilesenBranches(newForm.isEmriNo);
            if(incomplete.length>0){
              const msg = incomplete.map(x=>`_${x.suf} (${BILESEN_LABEL[x.suf]}) ${x.durum}`).join(' ve ');
              lines.push(`<div style="font-size:11.5px;color:var(--danger)">⛔ Tamamlanmamış: ${esc(msg)} — birleştirme başlatılamaz</div>`);
            }
          }
          return lines.length ? `<div style="margin:-8px 0 12px 2px;display:flex;flex-direction:column;gap:3px">${lines.join('')}</div>` : '';
        })()}
        ${(() => {
          if(!stockEnabled() || !newForm.isEmriNo) return '';
          const { isEmriNo: previewCode } = resolveTrackingCode(newForm.isEmriNo, newForm.bilesen);
          if(!isFirstOperationFor(previewCode)) return '';
          const opts = stockConsumableOptions();
          if(opts.length===0) return '';
          const selOpt = stockOptionByValue(newForm.stockItemId);
          const isManualInput = selOpt && (selOpt.tur==='boy' || selOpt.mode==='manuel');
          return `<div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">${ico('box',14)} İlk Operasyon — Kullanılan Hammadde (opsiyonel)</div>
            <select id="nf-stok-item" onchange="newForm.stockItemId=this.value; render()" style="margin-bottom:${isManualInput?'8px':'0'}">
              <option value="">Hammadde tüketilmiyor</option>
              ${opts.map(o=>`<option value="${o.value}" ${newForm.stockItemId===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}
            </select>
            ${selOpt ? (isManualInput
              ? `<input id="nf-stok-miktar" type="number" placeholder="${selOpt.tur==='boy'?`Kesilen boy (${esc(selOpt.birim||'mm')})`:`Kullanılan miktar (${esc(selOpt.birim||'')})`}" value="${esc(newForm.stockMiktar)}" oninput="newForm.stockMiktar=this.value">`
              : `<div style="font-size:11.5px;color:var(--text-muted)">Otomatik: Adet kadar (${esc(newForm.adet||'?')} ${esc(selOpt.birim||'')}) düşülecek</div>`) : ''}
          </div>`;
        })()}
      `}
      <div class="field"><label>Çalışılan Makine</label>
        <div style="display:flex;gap:8px">
          <input id="nf-makine" list="makine-options" placeholder="Yazmaya başla… ör. TES" value="${esc(newForm.makine)}" oninput="newForm.makine=this.value" onblur="render()" onfocus="this.select()" style="flex:1">
          <button type="button" class="btn-ghost" title="Temizle" onclick="newForm.makine=''; render(); const el=document.getElementById('nf-makine'); if(el){el.focus();}">${ico('x',14)}</button>
        </div>
        <datalist id="makine-options">${allowed.map(m=>`<option value="${esc(m)}">`).join('')}</datalist>
      </div>
      ${(() => {
        const cand = machineHandoffCandidate(newForm.makine);
        if(!cand) return '';
        const groupCount = cand.groupId ? entriesArray().filter(x=>x.groupId===cand.groupId && (x.status==='devam'||x.status==='duruş')).length : 1;
        const durumTxt = cand.status==='duruş' ? `Duruşta: "${esc(cand.duruşNedeni||'')}"` : `${fmtElapsed(entryDurationBreakdown(cand).netMs)} çalışıyor`;
        return `<div style="background:var(--warn-soft);border:1px solid var(--warn-border);border-radius:10px;padding:14px;margin-bottom:14px">
          <div style="font-size:12.5px;color:var(--warn);font-weight:600;margin-bottom:6px">${ico('alert',14)} Bu makinede yarım kalmış ${groupCount>1?`${groupCount} iş emri`:'bir iş'} var</div>
          <div style="font-size:13px;margin-bottom:2px"><span class="mono" style="color:var(--accent)">${esc(cand.talepNo || cand.isEmriNo)}</span>${groupCount>1?` +${groupCount-1} daha`:''} · ${esc(cand.operatorUsername)} · ${esc(cand.operatorName)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">${durumTxt}${cand.adet?` · Adet: ${esc(cand.adet)}`:''}</div>
          <button type="button" class="btn-ghost" style="border-color:var(--warn);color:var(--warn)" onclick="devralIs('${cand.id}')">↺ ${groupCount>1?'Tümünü Devral':'Bu İşi Devral'} (Kaldığı Yerden Devam Et)</button>
        </div>`;
      })()}
      ${twoStep ? `<button type="button" class="btn-start" onclick="goNewStep2()">Devam → Adet ve Başlat</button>` : ''}
      ` : ''}
      ${s2 ? `
      ${twoStep ? `<button type="button" class="btn-ghost" style="margin-bottom:16px" onclick="setNewStep(1)">← Geri · iş emri ve makine</button>` : ''}
      <div class="field"><label>Malzeme Cinsi (opsiyonel)</label><input id="nf-malzeme-cinsi" placeholder="ör. 4Mo1 ıslahlı" value="${esc(newForm.malzemeCinsi)}" oninput="newForm.malzemeCinsi=this.value"></div>
      <div class="field"><label>Çap ve Boy (opsiyonel)</label><input id="nf-cap-boy" placeholder="ör. Ø26 x 200" value="${esc(newForm.capBoy)}" oninput="newForm.capBoy=this.value"></div>
      ${!newForm.cokluMode ? `<div class="field"><label>Adet</label><input id="nf-adet" inputmode="numeric" placeholder="ör. 120" value="${esc(newForm.adet)}" oninput="this.value=this.value.replace(/\\D/g,''); newForm.adet=this.value" onblur="render()"></div>` : ''}
      ${(twoStep && !newForm.cokluMode) ? `<div style="display:flex;gap:8px;margin:-6px 0 16px">${[10,50,100,250,500].map(n=>`<button type="button" class="chip" style="flex:1;text-align:center;padding:11px 4px" onclick="setAdetQuick(${n})">${n}</button>`).join('')}</div>` : ''}
      <div class="field"><label>Not (opsiyonel)</label><textarea id="nf-not" style="min-height:60px" placeholder="Serbest not" oninput="newForm.not=this.value">${esc(newForm.not)}</textarea></div>
      ${switchRow('nf-son-operasyon', newForm.sonOperasyon, 'Son Operasyon', 'Bitince iş rotası kapanır', {onchange:'newForm.sonOperasyon=this.checked', style:'margin-bottom:14px'})}
      <button class="btn-start" onclick="baslat()">${ico('play',14)} Başla (saat otomatik)</button>
      ` : ''}
    </div>`;
  } else if(view==='gecmis'){
    const myEntries = entriesArray()
      .filter(e => e.operatorUsername===session.username)
      .filter(e => (!gecmisFrom || dateKey(e.startTs)>=gecmisFrom) && (!gecmisTo || dateKey(e.startTs)<=gecmisTo))
      .filter(e => !gecmisSearch || e.isEmriNo.toLowerCase().includes(gecmisSearch.toLowerCase()) || (e.talepNo||'').toLowerCase().includes(gecmisSearch.toLowerCase()));
    const myTadilatOps = [];
    tadilatArray().forEach(t=>{
      tadilatOperasyonlarArray(t).forEach(o=>{
        if(o.operatorUsername!==session.username) return;
        myTadilatOps.push({
          id: 'tad-'+t.id+'-'+o.id, isEmriNo: t.uKodu, talepNo: t.uKodu,
          makine: o.makine||'', startTs: o.baslamaTs, endTs: o.bitisTs||null,
          status: o.status==='tamamlandi' ? 'tamamlandi' : 'devam',
          _isTadilat: true, _sonOperasyon: !!o.sonOperasyon,
          malzemeCinsi: t.kisaAciklama || t.aciklama || ''
        });
      });
    });
    const myTadilatOpsFiltered = myTadilatOps
      .filter(e => (!gecmisFrom || dateKey(e.startTs)>=gecmisFrom) && (!gecmisTo || dateKey(e.startTs)<=gecmisTo))
      .filter(e => !gecmisSearch || e.isEmriNo.toLowerCase().includes(gecmisSearch.toLowerCase()));
    const myAll = [...myEntries, ...myTadilatOpsFiltered].sort((a,b)=>b.startTs-a.startTs);
    body = `<div class="body-pad">
      <div class="field"><label>İş Emri No / Talep No Ara</label><input id="gecmis-search" class="mono" placeholder="ör. 2607140006" value="${esc(gecmisSearch)}" oninput="setGecmisSearch(this.value)"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <input type="date" class="filter-input" style="flex:1;min-width:130px" value="${esc(gecmisFrom)}" onchange="setGecmisFrom(this.value)" title="Başlangıç">
        <input type="date" class="filter-input" style="flex:1;min-width:130px" value="${esc(gecmisTo)}" onchange="setGecmisTo(this.value)" title="Bitiş">
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <button class="chip" onclick="setGecmisPreset(7)">Son 7 Gün</button>
        <button class="chip" onclick="setGecmisPreset(30)">Son 30 Gün</button>
        ${(gecmisFrom||gecmisTo||gecmisSearch) ? `<button class="btn-ghost" onclick="clearGecmisFilter()">${ico('x',14)} Temizle</button>` : ''}
      </div>
      ${myAll.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:40px 0">Bu aralıkta kayıt yok.</div>` : myAll.map(e=>{
        if(e._isTadilat){
          const durT = e.endTs ? fmtDur(e.endTs-e.startTs) : fmtElapsed(entryDurationBreakdown(e).netMs)+' (sürüyor)';
          const statusLabelT = e.status==='tamamlandi' ? (e._sonOperasyon?'Tadilat Tamamlandı':'Operasyon Bitti (Devamı Var)') : 'Tadilat — Devam Ediyor';
          return `<div class="card" style="border-color:var(--tadilat-info);border-left:4px solid var(--tadilat-info);cursor:pointer" onclick="openTadilatHistoryDetail('${e.id}')">
            <div class="card-header"><span class="card-id" style="color:var(--tadilat-info)">${ico('wrench',14)} ${esc(e.isEmriNo)}</span><span class="card-meta">${dateKey(e.startTs)}</span></div>
            ${e.malzemeCinsi ? `<div style="font-size:11.5px;color:var(--text-muted);margin:-4px 0 4px">${esc(e.malzemeCinsi)}</div>` : ''}
            <div class="op-top"><span class="op-code">${esc(e.makine||'—')}</span></div>
            <div class="op-foot">${ico('clock',14)} ${fmtDT(e.startTs)} → ${e.endTs?fmtDT(e.endTs):'—'} · ${durT}</div>
            <div style="margin-top:6px;font-size:12px;font-weight:600;color:var(--tadilat-info)">${statusLabelT}</div>
          </div>`;
        }
        const statusColor = e.status==='devam'?'var(--accent)':e.status==='duruş'?'var(--warn)':'var(--success)';
        const statusLabel = e.status==='devam'?'Devam Ediyor':e.status==='duruş'?'Duruşta':'Tamamlandı';
        const dur = e.endTs ? fmtDur(e.endTs-e.startTs) : (e.status==='devam' ? fmtElapsed(entryDurationBreakdown(e).netMs)+' (sürüyor)' : '—');
        return `<div class="card" style="cursor:pointer" onclick="openEntryDetail('${e.id}')">
          <div class="card-header"><span class="card-id">${esc(e.talepNo || e.isEmriNo)}</span><span class="card-meta">${dateKey(e.startTs)}</span></div>
          ${e.talepNo ? `<div style="font-size:11.5px;color:var(--text-muted);margin:-4px 0 4px" class="mono">U kodu: ${esc(e.isEmriNo)}</div>` : ''}
          <div class="op-top"><span class="op-code">${esc(e.makine||'—')}</span></div>
          <div class="op-foot">${ico('clock',14)} ${fmtDT(e.startTs)} → ${e.endTs?fmtDT(e.endTs):'—'} · ${dur}</div>
          <div style="margin-top:6px;font-size:12px;font-weight:600;color:${statusColor}">${statusLabel}</div>
        </div>`;
      }).join('')}
      ${entryDetailId ? renderEntryDetailModal() : ''}
      ${tadilatHistoryDetailId ? renderTadilatHistoryDetailModal() : ''}
    </div>`;
  } else if(view==='settings'){
    const chev = `<span class="chev">${ico('chevronRight',17)}</span>`;
    const pushOn = pushPermissionState==='granted';
    body = `<div class="body-pad">
      <div class="set-card" style="display:flex;align-items:center;gap:13px">
        <span class="avatar">${esc(initials(session.displayName))}</span>
        <span>
          <span style="display:block;font-size:16px;font-weight:700">${esc(session.displayName)}</span>
          <span style="display:block;font-size:12px;color:var(--text-muted);margin-top:2px">${esc(session.username)} · ${myRoleLabel()}</span>
        </span>
      </div>

      <div class="set-sec">GÖRÜNÜM</div>
      <div class="theme-pick">
        ${themeOptHtml('dark','Koyu','#15181c','#15181c')}
        ${themeOptHtml('light','Açık','#ffffff','#ffffff')}
        ${themeOptHtml('system','Sistem','#15181c','#ffffff')}
      </div>

      <div style="display:flex;flex-direction:column;gap:9px;margin-top:14px">
        ${pushConfigured() ? (
          pushPermissionState==='denied'
            ? `<div class="set-card" style="border-color:var(--danger)"><div style="font-size:14px;font-weight:600;margin-bottom:4px">${ico('bell',15)} Bildirimler kapalı</div><div style="font-size:12px;color:var(--text-muted)">Telefonun Uygulama Ayarları'nda "İzin Verildi" görünse bile bu YETMEZ — Chrome'un kendi site izni ayrı ve hâlâ engelli. Düzeltmek için: Chrome'u aç (yüklü uygulama simgesinden değil) → bu siteye git → adres çubuğunun solundaki 🔒 simgesine dokun → İzinler → Bildirimler'i "İzin Ver" yap → sonra bu uygulamayı kapatıp yeniden aç.</div></div>`
            : switchRow('set-push', pushOn, 'Bildirimler', pushOn ? 'Uzun duruş hatırlatması açık' : 'Uzun duruş hatırlatması', { ok:true, onchange:'onPushToggle(this)' })
        ) : ''}
        <button class="set-row" onclick="togglePwPanel()">${ico('lock',17)} Şifre değiştir ${pwOpen?'<span class="chev">−</span>':chev}</button>
        ${pwOpen ? `<div class="set-card">
          <div class="field"><label>Mevcut Şifre</label><input id="pw-current" type="password" placeholder="••••"></div>
          <div class="field"><label>Yeni Şifre (max 8 hane, sadece rakam)</label><input id="pw-next" type="password" inputmode="numeric" maxlength="8" placeholder="ör. 4821"></div>
          <div class="field" style="margin-bottom:12px"><label>Yeni Şifre (tekrar)</label><input id="pw-confirm" type="password" inputmode="numeric" maxlength="8" placeholder="ör. 4821"></div>
          <button class="btn-primary" onclick="changePassword()">${ico('check',15)} Şifreyi Güncelle</button>
        </div>` : ''}
        <button class="set-row" onclick="openSendMessage()">${ico('mail',17)} Mesaj / öneri gönder ${chev}</button>
      </div>

      ${renderMyPushHistoryList()}

      <button class="btn-ghost" style="width:100%;margin-top:26px;min-height:52px;border-color:var(--danger);color:var(--danger);font-size:15px;font-weight:700" onclick="doLogout()">${ico('logout',16)} Çıkış Yap</button>
    </div>`;
  } else {
    const mine = myActiveEntries();
    // Aynı groupId'ye sahip kayıtları TEK kart olarak göster (çoklu iş emri).
    const groups = [];
    const seenGroups = new Set();
    mine.forEach(e=>{
      if(e.groupId){
        if(seenGroups.has(e.groupId)) return;
        seenGroups.add(e.groupId);
        groups.push({ groupId: e.groupId, members: mine.filter(x=>x.groupId===e.groupId) });
      } else {
        groups.push({ groupId: null, members: [e] });
      }
    });
    body = `<div class="body-pad">`;
    // Madde 3+4 ile ilgili "gölgede kalan iş" riskine karşı: tadilat sonrası ayar bekleyen
    // işler sadece arka planda durmasın, operatör buraya her girdiğinde göze çarpsın.
    const bekleyenAyar = mine.filter(e => e.status==='duruş' && e.duruşNedeni===TADILAT_SONRASI_REASON);
    if(bekleyenAyar.length>0){
      body += `<div style="background:var(--tadilat-soft);border:2px solid var(--tadilat-info);border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:13.5px;font-weight:700;color:var(--tadilat-info);margin-bottom:8px">${ico('wrench',14)} Devam Etmeyi Bekleyen ${bekleyenAyar.length} Duraklatılmış İş Var</div>
        ${bekleyenAyar.map(e=>`
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--panel);border-radius:8px;padding:8px 12px;margin-top:6px;cursor:pointer" onclick="openActiveDetail('${e.id}')">
            <div><span class="mono" style="color:var(--accent);font-weight:700">${esc(e.talepNo || e.isEmriNo)}</span> <span style="font-size:11.5px;color:var(--text-muted)">${esc(e.makine)}</span></div>
            <span style="font-size:11.5px;color:var(--tadilat-info)">Tadilat sonrası ayar →</span>
          </div>
        `).join('')}
      </div>`;
    }
    // Bir operatör aynı anda birden fazla iş açık bırakıp (ör. çoklu iş izni olan biri tadilatı
    // kapattım sanıp üstüne yeni bir üretim işi de açarsa) birini unutabiliyor — hepsini tek
    // bakışta gösteren bir uyarı + tadilatları da bu listeye dahil ediyoruz, sadece Tadilat
    // sekmesinde gizli kalmasın. Kesinti zinciri yüzünden BİRDEN FAZLA yarım tadilat olabilir
    // (biri aktif, diğerleri duraklatılmış) — hepsi ayrı ayrı listeleniyor.
    const myTadilatSessions = myAllTadilatSessions();
    const totalActiveCount = groups.length + myTadilatSessions.length;
    if(totalActiveCount>1){
      body += `<div style="background:var(--warn-soft);border:2px solid var(--warn);border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:13.5px;font-weight:700;color:var(--warn);margin-bottom:6px">${ico('alert',14)} Aynı anda ${totalActiveCount} aktif işin var</div>
        <div style="font-size:12.5px;color:var(--text-muted)">${groups.length>0?(ico('factory',13)+` ${groups.length} üretim işi`):''}${groups.length>0 && myTadilatSessions.length>0?' · ':''}${myTadilatSessions.length>0?(ico('wrench',13)+` ${myTadilatSessions.length} tadilat`):''}</div>
      </div>`;
    }
    if(groups.length===0 && myTadilatSessions.length===0) body += `<div style="text-align:center;color:var(--text-muted);padding:40px 0">Henüz aktif işlem yok.<br><span style="font-size:12px">"+ Yeni Kayıt" ile bir makine başlat.</span></div>`;
    myTadilatSessions.forEach(({tadilat: mt, operasyon: mop})=>{
      const isPaused = mop.status==='duruş';
      body += `<div class="card" style="cursor:pointer;border-color:${isPaused?'var(--warn)':'var(--tadilat-info)'};border-left:4px solid ${isPaused?'var(--warn)':'var(--tadilat-info)'}" onclick="setView('tadilat')">
        <div class="card-header"><span class="card-id" style="color:${isPaused?'var(--warn)':'var(--tadilat-info)'}">${ico('wrench',14)} ${esc(mt.uKodu)}</span><span class="matrix-dot" style="background:${isPaused?'var(--warn)':'var(--tadilat-info)'};width:9px;height:9px;border-radius:50%;display:inline-block"></span></div>
        <div class="op-top" style="margin-bottom:6px"><span class="op-code">${esc(mop.makine||'—')}</span></div>
        <div class="op-foot">${isPaused ? (mop.duruşTs ? `${fmtElapsed(nowTick-mop.duruşTs)} duruşta · "${esc(mop.duruşNedeni)}"` : `seçim yapılıyor · "${esc(mop.duruşNedeni)}"`) : `${fmtElapsed(tadilatOpDurationBreakdown(mop).netMs)} çalışıyor · Tadilat${mt.adet?` · Adet: ${esc(mt.adet)}`:''}`}</div>
      </div>`;
    });
    groups.forEach(g=>{
      if(g.members.length===1){
        const e = g.members[0];
        const dotColor = e.status==='duruş'?'var(--warn)':'var(--success)';
        const subInfo = e.status==='duruş' ? `Duruşta: "${esc(e.duruşNedeni)}"` : `${fmtElapsed(entryDurationBreakdown(e).netMs)} çalışıyor`;
        body += `<div class="card" style="cursor:pointer" onclick="openActiveDetail('${e.id}')">
          <div class="card-header"><span class="card-id">${esc(e.talepNo || e.isEmriNo)}</span><span class="matrix-dot" style="background:${dotColor};width:9px;height:9px;border-radius:50%;display:inline-block"></span></div>
          ${e.talepNo ? `<div style="font-size:11px;color:var(--text-muted);margin:-4px 0 4px" class="mono">U kodu: ${esc(e.isEmriNo)}</div>` : ''}
          <div class="op-top" style="margin-bottom:6px"><span class="op-code">${esc(e.makine)}</span></div>
          <div class="op-foot">${subInfo}${e.adet?` · Adet: ${esc(e.adet)}`:''}</div>
        </div>`;
      } else {
        const makine = g.members[0].makine;
        const anyDurus = g.members.some(m=>m.status==='duruş');
        const dotColor = anyDurus ? 'var(--warn)' : 'var(--success)';
        body += `<div class="card" style="cursor:pointer" onclick="openGroupDetail('${g.groupId}')">
          <div class="card-header"><span class="card-id">${g.members.length} İş Emri Aktif</span><span class="matrix-dot" style="background:${dotColor};width:9px;height:9px;border-radius:50%;display:inline-block"></span></div>
          <div class="op-top" style="margin-bottom:6px"><span class="op-code">${esc(makine)}</span></div>
          <div class="op-foot">${g.members.map(m=>`${esc(m.talepNo || m.isEmriNo)} (${m.status==='duruş'?'duruşta':fmtElapsed(entryDurationBreakdown(m).netMs)})`).join(', ')}</div>
        </div>`;
      }
    });
    body += `</div>`;
  }

  return `<div class="root-mobile theme-${resolvedTheme()}">${header}${body}${bottomNavHtml()}${messagesModalOpen ? renderMessagesModal() : ''}${sendMsgOpen ? renderSendMessageModal() : ''}${resimAramaOpen ? renderResimAramaModal() : ''}</div>`;
}

