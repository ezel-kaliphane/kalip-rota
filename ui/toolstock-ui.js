/* ===================== UI: TAKIM & SARF STOK GÖRÜNÜMLERİ =====================
   js/toolstock.js'ten ayrıldı -- iş mantığı orada kaldı, sadece render* fonksiyonları burada. */
/* ---------- render: Ayarlar > "🔧 Takım & Sarf Stok" alt sekmesi (SuperAdmin) ----------
   Kullanıcı isteğiyle (bkz. sohbet) bu ekranda SADECE aç/kapat anahtarı kaldı — kalem/konum
   yönetimi, Excel yükleme ve stok girişi artık üst seviye "🔧 Takım Stok" sekmesinde (bkz.
   renderToolStokManagementScreen), Rapor/Analiz/Tadilat gibi diğer yönetici sekmeleriyle
   aynı seviyede. Bu sayede katalog/stok, sadece bu anahtara bakan bir ziyarette hiç yüklenmiyor. */
function renderToolStokAdminSettings(){
  if(!canManageToolStok()) return '<div style="color:var(--text-muted);font-size:12.5px">Bu ekran için SuperAdmin yetkisi gerekli.</div>';
  return `<div style="font-size:16px;font-weight:600;margin-bottom:6px">🔧 Takım & Sarf Stok</div>
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:680px">CNC atölyesindeki kesici takım ve sarf malzemesi stoğu. "Malzeme Stoğu" (hammadde) modülünden tamamen ayrıdır, hiçbir veri paylaşılmaz. Kalem/konum yönetimi, Excel yükleme ve stok girişi için üst menüdeki <b>🔧 Takım Stok</b> sekmesine bak.</div>
    <label style="display:flex;align-items:center;gap:10px;background:var(--panel);border:2px solid ${toolStokEnabled()?'var(--success)':'var(--border)'};border-radius:10px;padding:14px 16px;max-width:560px">
      <input type="checkbox" ${toolStokEnabled()?'checked':''} onchange="toggleToolStokEnabled()" style="width:auto;transform:scale(1.3)">
      <div>
        <div style="font-size:14px;font-weight:600;color:${toolStokEnabled()?'var(--success)':'var(--text)'}">Takım & Sarf Stok Modülü ${toolStokEnabled()?'Aktif':'Kapalı'}</div>
        <div style="font-size:11.5px;color:var(--text-muted)">Kapalıyken izinli operatörler "🔧 Takım Dolabı" sekmesini hiç görmez.</div>
      </div>
    </label>`;
}

/* ---------- render: üst seviye "🔧 Takım Stok" sekmesi ----------
   Kalem Listesi (arama + kategori/konum filtresi + toplu taşıma + satır içi düzenleme) +
   Konumlar + Excel Yükle + Stok Girişi + Geçmiş. Görünürlük artık SuperAdmin'e sabit değil —
   isAdminTabVisible/isTakimStokSubTabVisible ile kişi bazında ayarlanabiliyor (Ayarlar >
   Sekme Erişimi). Yazma işlemleri yine de HER ZAMAN canManageToolStok() (SuperAdmin) ile
   korunuyor — görünürlük izni verilen bir Yönetici/Şef ekranı görür ama düzenleyemez. */
function renderToolStokManagementScreen(){
  if(!isAdminTabVisible('takimStok')) return `<div class="settings-wrap"><div style="color:var(--text-muted);font-size:12.5px">Bu sekmeyi görme yetkin yok.</div></div>`;
  ensureToolCatalogLoaded(()=>safeRender());
  ensureToolStockLoaded(()=>safeRender());
  ensureToolLocationsLoaded(()=>safeRender());

  const visibleTabs = TAKIM_STOK_SUBTAB_DEFS.filter(t=>isTakimStokSubTabVisible(t.key));
  if(!visibleTabs.some(t=>t.key===toolAdminSubView)){
    toolAdminSubView = visibleTabs.length>0 ? visibleTabs[0].key : null;
  }

  let html = `<div class="settings-wrap">`;
  if(!canManageToolStok()){
    html += `<div style="font-size:12px;color:var(--text-muted);background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px">👁 Sadece görüntüleme modundasın — kayıt/düzenleme işlemleri için SuperAdmin yetkisi gerekir.</div>`;
  }
  html += `<div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap">
      ${visibleTabs.map(t=>`<button type="button" class="chip ${toolAdminSubView===t.key?'active':''}" onclick="toolAdminSubView='${t.key}'; render()">${t.key==='giris'?'↓ ':''}${esc(t.label)}</button>`).join('')}
    </div>`;

  if(!toolStokEnabled()){
    html += `<div style="font-size:12.5px;color:var(--warn);background:var(--panel);border:1px solid var(--warn);border-radius:10px;padding:12px 14px;margin-bottom:16px">Modül şu an kapalı (Ayarlar → Takım & Sarf Stok'tan açabilirsin) — yönetim ekranı yine de çalışır, operatörler görmez.</div>`;
  }
  if(toolCatalogError || toolStockError){
    html += `<div style="font-size:12.5px;color:var(--danger);background:var(--panel);border:1px solid var(--danger);border-radius:10px;padding:12px 14px">
      Veri okunamadı: ${esc(toolCatalogError || toolStockError)}${(toolCatalogError||'').includes('permission')||(toolStockError||'').includes('permission') ? ' — Firebase Rules henüz yayınlanmamış olabilir.' : ''}
      <div style="margin-top:8px"><button class="btn-ghost" onclick="retryToolCatalogLoad(); retryToolStockLoad();">↻ Tekrar Dene</button></div>
    </div></div>`;
    return html;
  }
  if(!toolCatalogReady || !toolStockReady){
    html += `<div style="font-size:12.5px;color:var(--text-muted)">Yükleniyor…</div></div>`;
    return html;
  }
  if(!toolAdminSubView){
    html += `<div style="font-size:12.5px;color:var(--text-muted)">Görebileceğin bir alt sekme yok.</div>`;
  } else if(toolAdminSubView==='liste') html += renderToolCatalogListAdmin();
  else if(toolAdminSubView==='konumlar') html += renderToolLocationsAdmin();
  else if(toolAdminSubView==='excel') html += renderToolExcelUploadAdmin();
  else if(toolAdminSubView==='giris') html += renderToolGirisAdmin();
  else if(toolAdminSubView==='gecmis') html += renderToolHistoryAdmin();
  html += `</div>`;
  return html;
}

function renderToolCatalogListAdmin(){
  const allItems = toolCatalogArray();
  const items = toolCatalogFilteredArray();
  const locs = toolLocationsArray();
  const konumsuzCount = allItems.filter(it=>!it.locId).length;
  const selectedCount = Object.keys(toolBulkSelected).length;
  const allFilteredSelected = items.length>0 && items.every(it=>toolBulkSelected[it.id]);
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:10px">
      <div class="sec-h" style="margin:0">Kalem Listesi (${items.length}/${allItems.length})${konumsuzCount>0?` · <span style="color:var(--warn)">${konumsuzCount} konumsuz</span>`:''}</div>
      <button class="btn-ghost" onclick="ensureToolStockLoaded(function(){ toast('Stok yenilendi'); render(); }, true)">↻ Stok Adetlerini Yenile</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <input placeholder="Ara — kelimeler sırasız (ör. freze 6) ya da %joker%…" value="${esc(toolListSearch)}" style="flex:1;min-width:220px" oninput="toolSetListFilter('search',this.value)">
      <select style="width:170px" onchange="toolSetListFilter('kategori',this.value)">
        <option value="">Tüm Kategoriler</option>
        ${TOOL_KATEGORI_LIST.map(k=>`<option value="${k.v}" ${toolListFilterKategori===k.v?'selected':''}>${k.l}</option>`).join('')}
      </select>
      <select style="width:170px" onchange="toolSetListFilter('loc',this.value)">
        <option value="">Tüm Konumlar</option>
        <option value="__none__" ${toolListFilterLoc==='__none__'?'selected':''}>— Konumsuz —</option>
        ${locs.map(l=>`<option value="${l.id}" ${toolListFilterLoc===l.id?'selected':''}>${esc(l.ad)}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:12px">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
        <input type="checkbox" style="width:auto" ${allFilteredSelected?'checked':''} onchange="toolBulkSelectAllFiltered(this.checked)"> Listedeki ${items.length} kalemin tümünü seç
      </label>
      <span style="font-size:12px;color:var(--text-muted)">${selectedCount} kalem seçili</span>
      <select style="width:170px" onchange="toolBulkTargetLoc=this.value">
        <option value="">— Hedef konum —</option>
        ${locs.map(l=>`<option value="${l.id}" ${toolBulkTargetLoc===l.id?'selected':''}>${esc(l.ad)}</option>`).join('')}
      </select>
      <button class="btn-primary" style="width:auto;padding:8px 14px" ${selectedCount===0?'disabled':''} onclick="bulkMoveToolItemsToLocation()">→ Seçilenleri Taşı</button>
      <button class="btn-ghost" ${selectedCount===0?'disabled':''} onclick="printToolLabels()">🖨 Etiket Yazdır</button>
      ${selectedCount>0?`<button class="btn-ghost" onclick="toolBulkClearSelection()">Seçimi Temizle</button>`:''}
    </div>
    <div style="overflow-x:auto">
    <table style="font-size:12px"><thead><tr>
      <th></th><th>CANİAS</th><th>Ad</th><th>Kategori</th><th>Marka</th><th>Konum</th><th>Göz</th><th>Stok</th><th title="Sipariş açık mı?">Sip.</th><th>Alt Limit</th><th>Sipariş</th><th>Demirbaş</th><th>Aktif</th>
    </tr></thead><tbody>
      ${items.length===0 ? `<tr><td colspan="13" style="text-align:center;color:var(--text-muted);padding:16px">Filtreye uyan kalem yok.</td></tr>` : items.map(it=>{
        const stok = (toolStock[it.id]||{}).miktar;
        const dusuk = it.altLimit>0 && Number(stok||0)<=it.altLimit;
        const siparisAcik = !!(toolStock[it.id]||{}).siparisAcik;
        return `<tr>
          <td style="text-align:center"><input type="checkbox" ${toolBulkSelected[it.id]?'checked':''} onchange="toggleToolBulkSelect('${it.id}',this.checked)"></td>
          <td class="mono">${esc(it.canias)}${it.stokKodu?`<div style="font-size:10px;color:var(--text-muted)">${esc(it.stokKodu)}</div>`:''}</td>
          <td>${esc(it.ad)}</td>
          <td><select onchange="updateToolCatalogField('${it.id}','kategori',this.value)" style="width:130px">
            ${TOOL_KATEGORI_LIST.map(k=>`<option value="${k.v}" ${it.kategori===k.v?'selected':''}>${k.l}</option>`).join('')}
          </select></td>
          <td><input value="${esc(it.marka||'')}" style="width:100px" onchange="updateToolCatalogField('${it.id}','marka',this.value)"></td>
          <td><select onchange="updateToolCatalogField('${it.id}','locId',this.value)" style="width:120px">
            <option value="">—</option>
            ${locs.map(l=>`<option value="${l.id}" ${it.locId===l.id?'selected':''}>${esc(l.ad)}</option>`).join('')}
          </select></td>
          <td><input value="${esc(it.goz||'')}" style="width:70px" onchange="updateToolCatalogField('${it.id}','goz',this.value)"></td>
          <td style="color:${dusuk?'var(--danger)':'var(--text)'};font-weight:${dusuk?'700':'400'}">${stok==null?'—':stok}</td>
          <td style="text-align:center"><input type="checkbox" ${siparisAcik?'checked':''} title="Bu kalem için tedarikçiye sipariş verildi mi?" onchange="toggleToolStokSiparisAcik('${it.id}')"></td>
          <td><input type="number" value="${it.altLimit||0}" style="width:70px" onchange="updateToolCatalogField('${it.id}','altLimit',this.value)"></td>
          <td><input type="number" value="${it.siparisMiktari||0}" style="width:70px" onchange="updateToolCatalogField('${it.id}','siparisMiktari',this.value)"></td>
          <td style="text-align:center"><input type="checkbox" ${it.demirbas?'checked':''} onchange="updateToolCatalogField('${it.id}','demirbas',this.checked)"></td>
          <td style="text-align:center"><input type="checkbox" ${it.aktif!==false?'checked':''} onchange="updateToolCatalogField('${it.id}','aktif',this.checked)"></td>
        </tr>`;
      }).join('')}
    </tbody></table>
    </div>`;
}

function renderToolLocationsAdmin(){
  const locs = toolLocationsArray();
  return `<div class="sec-h" style="margin-top:0">Konumlar (${locs.length})</div>
    <div style="display:flex;gap:8px;margin-bottom:14px;max-width:420px">
      <input id="tool-new-loc-ad" placeholder="ör. Dolap C">
      <button class="btn-primary" style="width:auto;padding:10px 16px" onclick="addToolLocation()">+ Ekle</button>
    </div>
    <div class="op-settings-table">
      ${locs.length===0 ? `<div style="font-size:12.5px;color:var(--text-muted);padding:12px 4px">Henüz konum eklenmedi.</div>` : locs.map(l=>{
        const count = toolCatalogArray().filter(it=>it.locId===l.id).length;
        return `<div class="op-settings-row" style="flex-wrap:wrap;gap:10px">
          <input value="${esc(l.ad)}" style="flex:1;min-width:160px" onchange="renameToolLocation('${l.id}',this.value)">
          <span style="font-size:11.5px;color:var(--text-muted)">${count} kalem</span>
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
            <input type="checkbox" style="width:auto" ${l.aktif!==false?'checked':''} onchange="toggleToolLocationActive('${l.id}')"> Aktif
          </label>
          <button class="del-btn" onclick="deleteToolLocation('${l.id}')" title="Sil">${ico('trash',14)}</button>
        </div>`;
      }).join('')}
    </div>`;
}

function renderToolExcelUploadAdmin(){
  return `<div class="sec-h" style="margin-top:0">Excel ile Toplu Yükleme</div>
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px;max-width:680px">Beklenen sütunlar: <span class="mono">CANİAS KODU</span> (zorunlu), <span class="mono">ÜRÜN KODU/ADI</span> (zorunlu), <span class="mono">STOK ADETİ</span> (zorunlu), ayrıca varsa STOK KODU, MARKA, ALT LİMİT, STANDART SİPARİŞ MİKTARI, KATEGORİ/DOLAP/GÖZ/DEMİRBAŞ (opsiyonel). <b>Dosyada birden fazla sekme varsa hepsi okunur</b> — her sekme kendi adına göre bir kategoriye atanır (ör. "1-ELMAS UÇLAR" → Elmas Uç), CANİAS/ürün/stok sütunu bulunamayan sekmeler otomatik atlanır. Yükleme <b>birleştirmedir</b> — Excel'de olmayan mevcut kalemler silinmez/değişmez. CANİAS kodu zaten varsa katalog bilgileri güncellenir; stok adedi yalnızca aşağıdaki kutu işaretlenirse ezilir.</div>
    <input type="file" id="tool-excel-file-input" accept=".xlsx,.xls" style="margin-bottom:12px;font-size:12.5px">
    <div><button class="btn-primary" style="width:auto;padding:10px 18px" onclick="handleToolExcelPreview()">⬆ Oku ve Önizle</button></div>
    <div id="tool-excel-status" style="font-size:12px;color:var(--text-muted);margin-top:10px"></div>
    ${renderToolExcelPreview()}`;
}

function renderToolExcelPreview(){
  const p = toolExcelPreview;
  if(!p) return '';
  const first8 = p.rows.slice(0,8);
  return `<div style="background:var(--panel);border:1px solid var(--accent);border-radius:10px;padding:16px;margin-top:14px;max-width:960px">
    <div style="font-size:13.5px;font-weight:600;margin-bottom:6px">Önizleme — ${p.rows.length} geçerli satır${p.blankCount?`, ${p.blankCount} satır atlandı (kod boş)`:''}${p.dupCount?`, ${p.dupCount} tekrarlanan kod`:''}</div>
    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px">
      Sekmeler: ${p.perSheet.map(s=>`${esc(s.sheetName)} → <b>${esc(s.kategori)}</b> (${s.count})`).join(' · ')}
      ${p.skippedSheets.length ? `<br>Atlanan sekmeler: ${p.skippedSheets.map(esc).join(', ')}` : ''}
    </div>
    <div style="overflow-x:auto;margin-bottom:12px">
      <table style="font-size:11.5px"><thead><tr>
        <th>CANİAS</th><th>Ad</th><th>Stok Kodu</th><th>Stok</th><th>Kategori</th><th>Marka</th><th>Alt Limit</th><th>Sipariş</th>
      </tr></thead><tbody>
        ${first8.map(r=>`<tr><td class="mono">${esc(r.canias)}</td><td>${esc(r.ad)}</td><td class="mono">${esc(r.stokKodu)}</td><td>${r.stok}</td><td>${esc(r.kategori)}</td><td>${esc(r.marka)}</td><td>${r.altLimit}</td><td>${r.siparis}</td></tr>`).join('')}
      </tbody></table>
      ${p.rows.length>8 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">…ve ${p.rows.length-8} satır daha.</div>` : ''}
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Bu dosyada Dolap/Göz/Demirbaş bilgisi yok — tüm kalemler konumsuz gelecek, "Kalem Listesi"nden elle atamanız gerekecek.</div>
    <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;margin-bottom:12px">
      <input type="checkbox" style="width:auto" ${toolExcelUpdateStock?'checked':''} onchange="toolExcelUpdateStock=this.checked; render()">
      Zaten var olan kalemlerin stok adetlerini de güncelle (yeni kalemler için stok her zaman yazılır)
    </label>
    <div style="display:flex;gap:10px">
      <button class="btn-primary" style="width:auto;padding:10px 18px" onclick="confirmToolExcelUpload()">✓ Onayla ve Yükle</button>
      <button class="btn-ghost" onclick="toolExcelPreview=null; render()">Vazgeç</button>
    </div>
  </div>`;
}

function renderToolGirisAdmin(){
  const it = toolGirisFoundId ? toolCatalog[toolGirisFoundId] : null;
  const stok = toolGirisFoundId ? Number((toolStock[toolGirisFoundId]||{}).miktar||0) : 0;
  return `<div class="sec-h" style="margin-top:0">Stok Girişi (Mal Kabul)</div>
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:640px">CANİAS kodunu yaz ya da QR okut, gelen kalemin adedini gir. "Not" kısmına sipariş numarasını yazabilirsin.</div>
    <div class="card" style="max-width:480px">
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input id="tool-giris-code" class="mono" placeholder="CANİAS kodu, ör. U0003628" value="${esc(toolGirisCode)}" oninput="toolGirisCode=this.value" onkeydown="if(event.key==='Enter'){ toolGirisLookup(this.value); }" style="flex:1">
        <button class="btn-ghost" onclick="toolGirisLookup(document.getElementById('tool-giris-code').value)">Ara</button>
        <button class="btn-ghost" title="QR Okut" onclick="toolGirisScanQr()">${ico('camera',16)}</button>
      </div>
      ${toolGirisError ? `<div style="color:var(--danger);font-size:12.5px;margin-bottom:12px">${esc(toolGirisError)}</div>` : ''}
      ${it ? `
        <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:14px">
          <div style="font-weight:600">${esc(it.ad)}</div>
          <div class="mono" style="font-size:11.5px;color:var(--text-muted)">${esc(it.canias)}</div>
          <div style="font-size:12.5px;margin-top:6px">Mevcut stok: <b>${stok}</b> ${esc(it.birim||'adet')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:16px;justify-content:center;margin-bottom:14px">
          <button class="btn-ghost" style="width:44px;height:44px;font-size:20px;padding:0" onclick="toolGirisChangeQty(-1)">−</button>
          <div style="font-size:24px;font-weight:700;min-width:44px;text-align:center">${toolGirisQty}</div>
          <button class="btn-ghost" style="width:44px;height:44px;font-size:20px;padding:0" onclick="toolGirisChangeQty(1)">+</button>
        </div>
        <div class="field"><label>Not (Sipariş No)</label>
          <input value="${esc(toolGirisNote)}" placeholder="ör. Sip. No 2026-114" oninput="toolGirisNote=this.value">
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;margin-bottom:14px">
          <input type="checkbox" style="width:auto" ${toolGirisSiparisAcik?'checked':''} onchange="toolGirisSiparisAcik=this.checked">
          Sipariş açık (bu kalem için tedarikçiye sipariş verildi)
        </label>
        <button class="btn-primary" style="width:100%;padding:12px" onclick="doToolGiris()">✓ Girişi Kaydet</button>
      ` : ''}
    </div>`;
}

function renderToolHistoryAdmin(){
  if(!toolHistLoaded){ toolHistLoaded = true; loadToolHistory(true); }
  const rows = toolHistFilterTip ? toolHistMoves.filter(m=>m.tip===toolHistFilterTip) : toolHistMoves;
  const opEntries = Object.entries(STATE.operators||{}).sort((a,b)=>(a[1].displayName||a[0]).localeCompare(b[1].displayName||b[0]));
  const tipLabels = { cikis:'Çıkış', giris:'Giriş', sayim:'Sayım', iade:'İade', fire:'Fire' };
  return `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">
      <div class="sec-h" style="margin:0">Hareket Geçmişi (${rows.length})</div>
      <button class="btn-ghost" onclick="exportToolHistoryExcel()">⬇ Excel'e Aktar</button>
    </div>
    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px;max-width:640px">Kalem veya operatör filtresi seçilince o filtreye ait en son 50 kayıt gösterilir (sayfalama kapanır). Filtresizken en yeni 50 kayıtla başlar, "Daha Fazla Yükle" ile geriye doğru sayfalanır.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <input class="mono" placeholder="CANİAS kodu ile filtrele…" onkeydown="if(event.key==='Enter'){ toolHistApplyItemFilter(this.value); }" style="width:190px">
      <select onchange="toolHistSetOperatorFilter(this.value)" style="width:180px">
        <option value="">Tüm Operatörler</option>
        ${opEntries.map(([code,v])=>`<option value="${code}" ${toolHistFilterOperator===code?'selected':''}>${esc(v.displayName||code)}</option>`).join('')}
      </select>
      <select onchange="toolHistSetTipFilter(this.value)" style="width:140px">
        <option value="">Tüm Tipler</option>
        ${Object.entries(tipLabels).map(([k,l])=>`<option value="${k}" ${toolHistFilterTip===k?'selected':''}>${l}</option>`).join('')}
      </select>
      ${(toolHistFilterItemId||toolHistFilterOperator||toolHistFilterTip) ? `<button class="btn-ghost" onclick="toolHistClearFilters()">Filtreleri Temizle</button>` : ''}
    </div>
    <div style="overflow-x:auto">
    <table style="font-size:12px"><thead><tr>
      <th>Tarih</th><th>Kalem</th><th>Tip</th><th>Miktar</th><th>Öncesi→Sonrası</th><th>Kim</th><th>Makine/İş Emri</th><th>Not</th>
    </tr></thead><tbody>
      ${rows.length===0 ? `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:16px">${toolHistLoading?'Yükleniyor…':'Hareket yok.'}</td></tr>` : rows.map(m=>{
        const it = toolCatalog[m.itemId];
        const tipLabel = tipLabels[m.tip] || m.tip;
        const tipColor = m.tip==='cikis' ? 'var(--danger)' : (m.tip==='giris'||m.tip==='iade') ? 'var(--success)' : 'var(--text-muted)';
        return `<tr>
          <td>${fmtDT(m.ts)}</td>
          <td class="mono">${esc(m.canias)}${it?`<div style="font-size:10px;color:var(--text-muted)">${esc(it.ad)}</div>`:''}</td>
          <td style="color:${tipColor}">${tipLabel}</td>
          <td style="color:${m.miktar<0?'var(--danger)':'var(--success)'}">${m.miktar>0?'+':''}${m.miktar}</td>
          <td class="mono" style="font-size:11px">${m.oncekiMiktar}→${m.sonrakiMiktar}</td>
          <td>${esc(m.operatorName||m.operatorUsername||'')}</td>
          <td style="font-size:11px">${esc(m.makine||'')}${m.isEmriNo?` · ${esc(m.isEmriNo)}`:''}</td>
          <td style="font-size:11px;color:var(--text-muted)">${esc(m.aciklama||'')}</td>
        </tr>`;
      }).join('')}
    </tbody></table>
    </div>
    ${(!toolHistFilterItemId && !toolHistFilterOperator && toolHistHasMore) ? `<div style="text-align:center;margin-top:14px"><button class="btn-ghost" ${toolHistLoading?'disabled':''} onclick="toolHistLoadMore()">${toolHistLoading?'Yükleniyor…':'↓ Daha Fazla Yükle'}</button></div>` : ''}`;
}

function renderToolStokOperator(){
  return `
    ${toolLastMoveBannerHtml()}
    ${toolOpFoundItem ? renderToolStokDetailPanel() : renderToolStokScanScreen()}
  `;
}

function renderToolStokScanScreen(){
  return `<div class="card" style="text-align:center;padding:30px 18px">
    <button class="btn-primary" style="font-size:16px;padding:18px;margin-bottom:18px;display:flex;align-items:center;justify-content:center;gap:8px" onclick="toolOpScanQr()">${ico('camera',20)} QR Okut</button>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">veya CANİAS kodunu yaz</div>
    <div style="display:flex;gap:8px">
      <input id="tool-op-manual-code" class="mono" placeholder="ör. U0003628" value="${esc(toolOpScanCode)}" oninput="toolOpScanCode=this.value" onkeydown="if(event.key==='Enter'){ toolOpLookupByCode(this.value); }" style="flex:1;text-align:center">
      <button class="btn-ghost" ${toolOpLookupBusy?'disabled':''} onclick="toolOpLookupByCode(document.getElementById('tool-op-manual-code').value)">Ara</button>
    </div>
    ${toolOpLookupBusy ? `<div style="margin-top:14px;color:var(--text-muted);font-size:12.5px">Aranıyor…</div>` : ''}
    ${toolOpLookupError ? `<div style="margin-top:14px;color:var(--danger);font-size:12.5px">${esc(toolOpLookupError)}</div>` : ''}
  </div>`;
}

function renderToolStokDetailPanel(){
  const it = toolOpFoundItem;
  if(!it) return renderToolStokScanScreen();
  const stok = Number((toolOpFoundStock||{}).miktar||0);
  const locAd = it.locId && toolLocations[it.locId] ? toolLocations[it.locId].ad : null;
  const activeEntries = myActiveEntries();
  return `<div class="card">
    <button class="btn-ghost" style="margin-bottom:14px" onclick="toolOpClearLookup()">← Yeni Arama</button>
    <div style="font-size:17px;font-weight:700;margin-bottom:4px">${esc(it.ad)}</div>
    <div class="mono" style="color:var(--text-muted);margin-bottom:14px">${esc(it.canias)}${locAd?` · ${esc(locAd)}${it.goz?` / ${esc(it.goz)}`:''}`:''}</div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:18px">Mevcut stok: <b style="font-size:16px;color:var(--text)">${stok}</b> ${esc(it.birim||'adet')}</div>
    ${activeEntries.length>1 ? `
      <div class="field"><label>Hangi iş için?</label>
        <select onchange="toolOpSelectedEntryId=this.value">
          ${activeEntries.map(e=>`<option value="${e.id}" ${toolOpSelectedEntryId===e.id?'selected':''}>${esc(e.makine)} · ${esc(e.isEmriNo)}</option>`).join('')}
        </select>
      </div>` : activeEntries.length===1 ? `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${esc(activeEntries[0].makine)} · ${esc(activeEntries[0].isEmriNo)} işine kaydedilecek</div>` : `
      <div class="field"><label>Makine (opsiyonel)</label>
        <select onchange="toolOpManualMachine=this.value">
          <option value="">— Seçilmedi —</option>
          ${allMachines().map(m=>`<option value="${esc(m.code+' · '+m.name)}" ${toolOpManualMachine===(m.code+' · '+m.name)?'selected':''}>${esc(m.code)} · ${esc(m.name)}</option>`).join('')}
        </select>
      </div>`}
    <div style="display:flex;align-items:center;gap:16px;justify-content:center;margin:22px 0">
      <button class="btn-ghost" style="width:48px;height:48px;font-size:22px;padding:0" onclick="toolOpChangeQty(-1)">−</button>
      <div style="font-size:28px;font-weight:700;min-width:50px;text-align:center">${toolOpQty}</div>
      <button class="btn-ghost" style="width:48px;height:48px;font-size:22px;padding:0" onclick="toolOpChangeQty(1)">+</button>
    </div>
    <div class="field"><label>Not (opsiyonel)</label>
      <input value="${esc(toolOpNote)}" placeholder="ör. kırıldı, revizyonda vs." oninput="toolOpNote=this.value">
    </div>
    <button class="btn-primary" style="font-size:15px;padding:14px" ${toolOpBusy?'disabled':''} onclick="doToolCikis()">✓ Çıkış Yap</button>
  </div>`;
}

