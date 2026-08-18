/* ===================== OPERASYON İŞLEMLERİ ===================== */
function myActiveEntries(){
  if(!session || session.isAdmin) return [];
  return entriesArray().filter(e => e.operatorUsername===session.username && (e.status==='devam'||e.status==='duruş')).sort((a,b)=>a.startTs-b.startTs);
}
function getAllowedMachines(){
  if(!session || session.isAdmin) return allMachines().map(m=>`${m.code} · ${m.name}`);
  const op = STATE.operators[session.username] || {};
  const allowedCodes = op.allowedMachines ? Object.keys(op.allowedMachines).filter(k=>op.allowedMachines[k]) : allMachineCodes();
  return allMachines().filter(m=>allowedCodes.includes(m.code)).map(m=>`${m.code} · ${m.name}`);
}
function openActiveDetail(id){ activeDetailId = id; render(); }
function closeActiveDetail(){ activeDetailId = null; setView('list'); }
// Girilen İş Talep No'yu gerçek takip koduna (U kodu + varsa bileşen eki) çevirir.
// Rota takibi (isEmriNo/tur/zincir hesapları) tarihten beri U kodu üzerinden çalıştığı için
// bunu koruyoruz; operatör sadece talep no giriyor, sistem arka planda U koduna çeviriyor.
// Bir talep no altında _ZARF/_ELMAS olarak ayrı ayrı işlenen dallardan hangileri henüz
// gerçekten bitmemiş (son operasyon işaretlenmemiş)? Ana/Tek Parça (birleştirme) işini
// başlatmadan önce bunu kontrol ediyoruz, çünkü shrink-fit birleşimi ancak her iki dal da
// gerçekten tamamlanınca mantıklı.
function incompleteBilesenBranches(talepNoRaw){
  const talepNo = String(talepNoRaw||'').trim().toUpperCase();
  if(!talepNo) return [];
  const out = [];
  ['ZARF','ELMAS'].forEach(suf=>{
    const branchEntries = entriesArray().filter(e => (e.talepNo||'').toUpperCase()===talepNo && bilesenOfCode(e.isEmriNo)===suf);
    if(branchEntries.length===0) return;
    const last = branchEntries.slice().sort((a,b)=>b.startTs-a.startTs)[0];
    const done = last.status==='tamamlandi' && !!last.sonOperasyon;
    if(!done){
      const durum = (last.status==='devam'||last.status==='duruş') ? 'aktif' : 'tamamlanmamış (son operasyon işaretlenmemiş)';
      out.push({ suf, durum });
    }
  });
  return out;
}
function resolveTrackingCode(talepNoRaw, bilesenSel){
  const talepNo = String(talepNoRaw||'').trim().toUpperCase();
  const info = getTalepInfo(talepNo);
  const uKodu = (info && info.malzemeKodu) ? info.malzemeKodu.trim().toUpperCase() : talepNo; // eşleşme yoksa talep no'yu kendisi takip kodu olsun
  const isEmriNo = uKodu + (bilesenSel ? BILESEN_SUFFIX[bilesenSel] : '');
  return { isEmriNo, talepNo };
}
function baslat(){
  const makine = (document.getElementById('nf-makine')?.value) || newForm.makine || '';
  const malzemeCinsi = (document.getElementById('nf-malzeme-cinsi').value||'').trim();
  const capBoy = (document.getElementById('nf-cap-boy').value||'').trim();
  const not = (document.getElementById('nf-not').value||'').trim();
  const sonOperasyon = !!document.getElementById('nf-son-operasyon')?.checked;
  const canCoklu = !!(STATE.operators[session.username]||{}).cokluIsEmri;

  if(!getAllowedMachines().includes(makine)){ toast('Listeden geçerli bir makine seçin'); return; }

  if(canCoklu && newForm.cokluMode){
    // Çoklu İş Emri: aynı makinede, aynı anda birden fazla İş Emri No — her birinin kendi adediyle
    const items = newForm.cokluItems.map((it,i)=>{
      const raw = (document.getElementById('nf-coklu-isemri-'+i)?.value ?? it.isEmriNo ?? '').trim();
      const bilesen = document.getElementById('nf-coklu-bilesen-'+i)?.value ?? it.bilesen ?? '';
      return {
        talepNoRaw: raw,
        bilesen,
        adet: (document.getElementById('nf-coklu-adet-'+i)?.value ?? it.adet ?? '').trim(),
        stockItemId: document.getElementById('nf-coklu-stok-'+i)?.value ?? it.stockItemId ?? '',
        stockMiktar: (document.getElementById('nf-coklu-stok-miktar-'+i)?.value ?? it.stockMiktar ?? '').trim()
      };
    });
    if(items.length===0){ toast('En az bir İş Emri No girin'); return; }
    const seenPairs = new Set();
    for(const it of items){
      if(!it.talepNoRaw){ toast('Tüm İş Emri No alanlarını doldurun'); return; }
      if(!it.adet){ toast('Tüm Adet alanlarını doldurun'); return; }
      if(!/^\d+$/.test(it.adet)){ toast('Adet sadece rakam olmalı'); return; }
      if(!isEmriValid(it.talepNoRaw)){
        toast(`"${it.talepNoRaw}" bulunamadı, lütfen kodunuzu kontrol edin`); return;
      }
      // Aynı talep no + aynı bileşen ikinci kez eklenemez (ör. 2 kere "Tek Parça", 2 kere "_ZARF").
      // Farklı bileşenler (Zarf + Elmas gibi) aynı talep no ile birlikte açılabilir, o geçerli bir senaryo.
      const pairKey = it.talepNoRaw.trim().toUpperCase()+'::'+(it.bilesen||'TEK');
      if(seenPairs.has(pairKey)){
        const bilesenLabel = it.bilesen ? `${BILESEN_LABEL[it.bilesen]} (_${it.bilesen})` : 'Tek Parça';
        toast(`"${it.talepNoRaw}" için ${bilesenLabel} zaten listede — aynı talep no + aynı bileşen ikinci kez eklenemez.`); return;
      }
      seenPairs.add(pairKey);
      if(!it.bilesen){
        const incomplete = incompleteBilesenBranches(it.talepNoRaw);
        if(incomplete.length>0){
          const msg = incomplete.map(x=>`_${x.suf} (${BILESEN_LABEL[x.suf]}) operasyonu ${x.durum}`).join(' ve ');
          toast(`"${it.talepNoRaw}": Tamamlanmamış ${msg} — bu iş emrine (birleştirme) önce onlar bitmeden başlanamaz.`); return;
        }
      }
    }
    const groupId = uid();
    items.forEach(it=>{
      const id = uid();
      const { isEmriNo, talepNo } = resolveTrackingCode(it.talepNoRaw, it.bilesen);
      const wasFirst = isFirstOperationFor(isEmriNo);
      const entry = { isEmriNo, talepNo, makine, malzemeCinsi, capBoy, adet: it.adet, not, sonOperasyon, operatorUsername:session.username, operatorName:session.displayName, startedByUsername:session.username, startedByName:session.displayName, startTs:Date.now(), endTs:null, status:'devam', duruşToplamMs:0, excludedMs:0, groupId };
      const pendingParti = findPendingParti(isEmriNo);
      if(pendingParti){ entry.partiRootId = pendingParti.partiRootId; entry.parentEntryId = pendingParti.id; }
      DB.ref('entries/'+id).set(entry);
      if(stockEnabled() && wasFirst && it.stockItemId){
        const [selItemId, selLotId] = it.stockItemId.split('::');
        const stItem = stockItems[selItemId];
        const miktar = selLotId ? (Number(it.stockMiktar)||0) : (stItem && stItem.mode==='oto' ? Number(it.adet)||0 : Number(it.stockMiktar)||0);
        if(miktar>0) consumeStock(selItemId, selLotId||null, miktar, { isEmriNo, talepNo });
      }
    });
    toast(`${items.length} iş emri birlikte başlatıldı`);
    newForm = { isEmriNo:'', bilesen:'', makine: (STATE.operators[session.username]||{}).defaultMachine || '', malzemeCinsi:'', capBoy:'', adet:'', not:'', sonOperasyon:false, stockItemId:'', stockMiktar:'', cokluMode:false, cokluItems:[{isEmriNo:'',bilesen:'',adet:'',stockItemId:'',stockMiktar:''},{isEmriNo:'',bilesen:'',adet:'',stockItemId:'',stockMiktar:''}] };
    activeGroupId = groupId;
    activeDetailId = null;
    view = 'list';
    render();
    return;
  }

  // Tekli mod (varsayılan)
  const isEmriNoRaw = (document.getElementById('nf-isemri')?.value ?? newForm.isEmriNo ?? '').trim();
  const bilesenSel = document.getElementById('nf-bilesen')?.value ?? newForm.bilesen ?? '';
  const adet = (document.getElementById('nf-adet').value||'').trim();
  const allowMulti = !!(STATE.operators[session.username]||{}).multiJob;
  if(!allowMulti && myActiveEntries().length>0){ toast('Bu hesap aynı anda tek iş açabilir. Önce mevcut işi bitirmelisin.'); return; }
  if(!isEmriNoRaw){ toast('İş Emri No girin'); return; }
  if(!adet){ toast('Adet girin'); return; }
  if(!/^\d+$/.test(adet)){ toast('Adet sadece rakam olmalı'); return; }
  if(!isEmriValid(isEmriNoRaw)){
    toast('Bu iş emri bulunamadı, lütfen kodunuzu kontrol edin'); return;
  }
  if(!bilesenSel){
    const incomplete = incompleteBilesenBranches(isEmriNoRaw);
    if(incomplete.length>0){
      const msg = incomplete.map(x=>`_${x.suf} (${BILESEN_LABEL[x.suf]}) operasyonu ${x.durum}`).join(' ve ');
      toast(`Tamamlanmamış ${msg} — bu iş emrine (birleştirme) önce onlar bitmeden başlanamaz.`); return;
    }
  }
  const machineBusy = !isFasonMachine(makine) && entriesArray().some(e => e.makine === makine && e.status === 'devam');
  if(machineBusy){ toast('Bu makinede zaten aktif bir iş var. Önce o iş bitirilmeli ya da duraklatılmalı.'); return; }
  const { isEmriNo, talepNo } = resolveTrackingCode(isEmriNoRaw, bilesenSel);
  const wasFirst = isFirstOperationFor(isEmriNo);
  let stockItemIdSel = '', stockLotIdSel = null, stockMiktarSel = 0;
  if(stockEnabled() && wasFirst){
    const rawVal = document.getElementById('nf-stok-item')?.value||'';
    if(rawVal){
      const [selItemId, selLotId] = rawVal.split('::');
      stockItemIdSel = selItemId; stockLotIdSel = selLotId||null;
      const stItem = stockItems[stockItemIdSel];
      const isManual = stockLotIdSel || (stItem && stItem.mode==='manuel');
      if(isManual){
        stockMiktarSel = Number(document.getElementById('nf-stok-miktar')?.value||0);
        if(stockMiktarSel<=0){ toast(stockLotIdSel ? 'Kesilen boyu girin' : 'Kullanılan hammadde miktarını girin'); return; }
      } else {
        stockMiktarSel = Number(adet)||0;
      }
    }
  }
  const id = uid();
  const entry = { isEmriNo, talepNo, makine, malzemeCinsi, capBoy, adet, not, sonOperasyon, operatorUsername:session.username, operatorName:session.displayName, startedByUsername:session.username, startedByName:session.displayName, startTs:Date.now(), endTs:null, status:'devam', duruşToplamMs:0, excludedMs:0 };
  const pendingParti = findPendingParti(isEmriNo);
  if(pendingParti){ entry.partiRootId = pendingParti.partiRootId; entry.parentEntryId = pendingParti.id; }
  DB.ref('entries/'+id).set(entry);
  if(stockItemIdSel && stockMiktarSel>0) consumeStock(stockItemIdSel, stockLotIdSel, stockMiktarSel, { isEmriNo, talepNo });
  toast(pendingParti ? `Operasyon başlatıldı — bekleyen ${pendingParti.adet} adetlik partiye bağlandı` : 'Operasyon başlatıldı');
  newForm = { isEmriNo:'', bilesen:'', makine: (STATE.operators[session.username]||{}).defaultMachine || '', malzemeCinsi:'', capBoy:'', adet:'', not:'', sonOperasyon:false, stockItemId:'', stockMiktar:'', cokluMode:false, cokluItems:[{isEmriNo:'',bilesen:'',adet:'',stockItemId:'',stockMiktar:''},{isEmriNo:'',bilesen:'',adet:'',stockItemId:'',stockMiktar:''}] };
  activeDetailId = id;
  view = 'list';
  render();
}
function bitir(id){
  const e = STATE.entries[id] || {};
  let extra = 0;
  if(e.status==='duruş' && e.duruşTs) extra = Date.now() - e.duruşTs;
  const isGunSonu = e.duruşNedeni===GUN_SONU_REASON;
  const duruşToplamMs = (e.duruşToplamMs||0) + (isGunSonu?0:extra);
  const excludedMs = (e.excludedMs||0) + (isGunSonu?extra:0);
  const durusLog = isGunSonu ? (e.durusLog||null) : appendDurusLog(e.durusLog, e.duruşNedeni, extra, e.duruşTs);
  const excludedLog = isGunSonu ? appendDurusLog(e.excludedLog, e.duruşNedeni, extra, e.duruşTs) : (e.excludedLog||null);
  DB.ref('entries/'+id).update({ endTs: Date.now(), status:'tamamlandi', duruşToplamMs, excludedMs, durusLog, excludedLog, finishedByUsername: session.username, finishedByName: session.displayName });
  toast('Operasyon tamamlandı');
  if(activeDetailId===id){ activeDetailId=null; view='list'; }
}
// DÜZELTME: render()'daki genel "scroll koruma" mantığı, bu panel AÇILDIĞINDA/GENİŞLEDİĞİNDE
// yanlış çalışıyordu — panel kısa haldeyken (sadece "Duruşa Al" butonu) scrollTop zaten 0'dı,
// panel neden seçici + onay/vazgeç butonlarıyla GENİŞLEYİNCE de bu eski (0) konum zorla geri
// yükleniyordu. Sonuç: kullanıcı her seferinde en alttaki "Onayla" butonuna ulaşmak için elle
// kaydırmak zorunda kalıyordu (ve panel kapanmadan önce görmediği için "geri butonu yok"
// sanıyordu — o buton hep vardı, sadece görünmüyordu). Artık panel her genişlediğinde
// Not: Duruş seçici artık GERÇEK bir modal (renderDurusModal, sabit konumlu overlay) —
// sayfanın neresinde olursan ol her zaman ekranın üstünde, tam ortada açılıyor. Bu yüzden
// artık pencere kaydırmasıyla hiç uğraşmaya gerek yok (eskiden satır içi genişleyen bir
// panel olduğu için bu gerekiyordu).
function toggleDurus(open){ durusOpen=open; durusReasonSel=''; durusCustom=''; render(); }
// Duruş nedeni seçici — mockup tasarımına göre: kart listesi + "ÖZEL DURUMLAR" ayracı +
// alta sabitlenmiş "Duruşu Başlat" butonu. Gerçek bir MODAL (bkz. CSS) olduğu için arkadaki
// ekranla (canlı sayaç, matris) hiçbir etkileşim/görsel çakışma olmuyor.
const DURUS_DESCRIPTIONS = {
  [GUN_SONU_REASON]: 'Süre verimlilikten düşülmez',
};
function durusOptionDesc(r){
  if(DURUS_DESCRIPTIONS[r]) return DURUS_DESCRIPTIONS[r];
  if(isTadilatRelated(r) && r!==GUN_SONU_REASON) return 'Tadilat sekmesine düşer';
  return '';
}
// Hangi ekrandan (tekli iş / çoklu iş emri grubu / tadilat duraklatma) açıldığını anlayıp
// doğru onay fonksiyonunu çağıran tek merkezi fonksiyon — modal, üç farklı yerden de aynı
// şekilde tetiklenebiliyor.
function confirmDurusAny(){
  if(activeGroupId){ duraklatGrup(activeGroupId); return; }
  if(view==='tadilat' && tadilatDurusPickerOpen){ confirmTadilatDurus(); return; }
  if(activeDetailId){ confirmDurus(activeDetailId); return; }
}
function durusOptionsListHtml(){
  const reasons = getDurusReasons();
  const normal = reasons.filter(r=>r!==GUN_SONU_REASON && !isTadilatRelated(r) && r!=='Diğer');
  const special = reasons.filter(r=>(r===GUN_SONU_REASON || isTadilatRelated(r)) && r!=='Diğer');
  const hasDiger = reasons.includes('Diğer');
  const optionCard = (r,i)=>{
    const isGunSonu = r===GUN_SONU_REASON;
    const isTad = !isGunSonu && isTadilatRelated(r);
    const isActive = durusReasonSel===r;
    const color = isGunSonu ? 'var(--gunsonu)' : isTad ? 'var(--tadilat-info)' : 'var(--warn)';
    const desc = durusOptionDesc(r);
    return `<button class="durus-option-card" style="${isActive?`border-color:${color};background:${isGunSonu?'var(--gunsonu-soft)':isTad?'var(--tadilat-soft)':'var(--accent-dim)'}`:''}" onclick="pickDurusReason(${i})">
      <span class="durus-radio" style="${isActive?`border-color:${color}`:''}"><span style="width:10px;height:10px;border-radius:50%;background:${isActive?color:'transparent'}"></span></span>
      <span>
        <div class="durus-option-name" style="${isActive||isGunSonu||isTad?`color:${color}`:''}">${esc(r)}</div>
        ${desc?`<div class="durus-option-desc">${esc(desc)}</div>`:''}
      </span>
    </button>`;
  };
  return `${normal.map((r)=>optionCard(r, reasons.indexOf(r))).join('')}
    ${special.length>0 ? `<div class="durus-option-divider">ÖZEL DURUMLAR</div>${special.map((r)=>optionCard(r, reasons.indexOf(r))).join('')}` : ''}
    ${hasDiger ? `<button class="durus-option-card dashed" onclick="pickDurusReason(${reasons.indexOf('Diğer')})">
      <span class="durus-radio" style="${durusReasonSel==='Diğer'?'border-color:var(--warn)':''}"><span style="width:10px;height:10px;border-radius:50%;background:${durusReasonSel==='Diğer'?'var(--warn)':'transparent'}"></span></span>
      <span class="durus-option-name" style="color:var(--text-muted)">Diğer — kendin yaz</span>
    </button>` : ''}
    ${durusReasonSel==='Diğer' ? `<input id="durus-custom" placeholder="Nedeni yaz…" value="${esc(durusCustom)}" oninput="durusCustom=this.value; updateDurusStartBtn()" style="margin-top:2px">` : ''}`;
}
function closeDurusModalAny(){
  // Modal üç farklı ekrandan açılabiliyor (tekli iş/grup → durusOpen, tadilat duraklatma →
  // tadilatDurusPickerOpen) — kapatma butonu hangisi açıksa onu kapatıyor.
  if(tadilatDurusPickerOpen){ cancelTadilatDurusPicker(); durusReasonSel=''; durusCustom=''; }
  else { toggleDurus(false); }
}
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
// "Diğer" kutusuna yazarken alt butonun aktif/pasif durumunu tam sayfa render olmadan güncelliyor.
function updateDurusStartBtn(){
  const btn = document.getElementById('durus-start-btn');
  // DÜZELTME: Eskiden mantık tersine dönmüştü — sadece "Diğer" seçilip metin girilince aktif
  // oluyordu, "Elektrik/Basınçlı Hava Kesintisi" gibi HER NORMAL neden için buton kalıcı
  // olarak pasif kalıyordu. Doğrusu: herhangi bir neden seçilmişse aktif — "Diğer" özel
  // durumunda ekstra olarak metin de girilmiş olmalı (bkz. renderDurusModal'daki canStart).
  const canStart = durusReasonSel && (durusReasonSel!=='Diğer' || durusCustom.trim());
  if(btn) btn.disabled = !canStart;
}
// DÜZELTME (kayan/atlayan scroll sorunu): Eskiden bir neden seçildiğinde TÜM SAYFA yeniden
// çiziliyordu (render()) — listenin ALT kısmındaki seçenekler (Gün Sonu, Yemek Molası gibi)
// için bu, görünür bir "tepeye sıçrama" flaşına yol açıyordu (render()'ın kendi scroll
// koruma mantığıyla benim "en alta kaydır" düzeltmem arasındaki yarış, sayfa ne kadar uzunsa
// o kadar belirgin oluyordu). Kökten çözüm: artık tam sayfa YENİDEN ÇİZİLMİYOR — sadece
// chip satırı + "Diğer" kutusunu içeren küçük #durus-picker-inner parçası güncelleniyor.
// Sayfanın geri kalanına hiç dokunulmadığı için scroll konumu zaten hiç bozulmuyor.
function pickDurusReason(i){
  durusReasonSel = getDurusReasons()[i];
  const el = document.getElementById('durus-picker-inner');
  if(el){ el.innerHTML = durusOptionsListHtml(); updateDurusStartBtn(); }
  else { render(); } // güvenlik ağı: beklenmedik bir ekranda id yoksa eskisi gibi tam çizim
}
// Operatör "Gün Sonu" verdiğinde, elinde BAŞKA duruşta unutulmuş kayıt varsa (ör. "Farklı İş
// Emrine Geçiş" ile duraklatıp hiç geri dönmediği bir iş) onları da Gün Sonu'na çeviriyoruz.
// SEBEP: Gün Sonu VERİLMEZSE o kayıtların duruş sayacı gece boyu GERÇEK SAATLE işlemeye devam
// eder — sabaha karşı devasa (10+ saatlik) bir "duruş" olarak raporlanır (oysa operatör o süre
// boyunca aslında BAŞKA bir işte çalışıyordu, hiç durmamıştı) VE uzunDurusUyarisi Cloud Function'ı
// gece boyu tekrar tekrar "hâlâ duruşta" bildirimi göndermeye devam eder. Bu fonksiyon, o ana
// kadarki GERÇEK nedeni (ör. "Farklı İş Emrine Geçiş") durusLog'a olduğu gibi yazıp kaydediyor,
// bundan sonraki süre ise (B'nin kendi Gün Sonu'su gibi) verimlilikten hariç tutuluyor.
function carryGunSonuToOtherPausedEntries(username, excludeIds){
  const now = Date.now();
  const excluded = excludeIds instanceof Set ? excludeIds : new Set(excludeIds||[]);
  entriesArray().filter(e => e.operatorUsername===username && e.status==='duruş' && !excluded.has(e.id) && e.duruşNedeni!==GUN_SONU_REASON).forEach(e=>{
    const extra = e.duruşTs ? Math.max(0, now - e.duruşTs) : 0;
    const duruşToplamMs = (e.duruşToplamMs||0) + extra;
    const durusLog = appendDurusLog(e.durusLog, e.duruşNedeni, extra, e.duruşTs);
    // "gunSonuOncesiNeden": bu kaydın GERÇEKTEN kendi isteğiyle mi (operatör bu işe bilerek Gün
    // Sonu verdi) yoksa CASCADE ile mi (unutulmuş başka bir duruş) Gün Sonu'na düştüğünü ayırt
    // etmek için — bkz. wakeOtherGunSonuEntries. Sadece bu alanı taşıyan kayıtlar, operatör
    // BAŞKA bir işine dönüp çalışmaya başlayınca otomatik olarak eski (gerçek) nedenine geri
    // döner; doğrudan Gün Sonu verilmiş bir kayıtta bu alan yok, o operatör kendisi dönene kadar
    // Gün Sonu'nda kalır (çünkü onun "eskiden" gerçek bir duruş nedeni yoktu, aktif çalışıyordu).
    DB.ref('entries/'+e.id).update({ duruşNedeni: GUN_SONU_REASON, duruşTs: now, duruşToplamMs, durusLog, gunSonuOncesiNeden: e.duruşNedeni });
  });
}
// carryGunSonuToOtherPausedEntries'in tersi: operatör HERHANGİ bir işini devam ettirdiğinde
// (yani artık fiilen çalışmaya döndüğünde), elinde cascade ile Gün Sonu'na düşmüş (gerçek bir
// önceki nedeni olan) başka kayıt varsa, onu kendi gerçek nedenine geri döndürüp BU ANDAN
// itibaren yeniden GERÇEK duruş saymaya başlatır — yoksa o kayıt operatör gündüz boyu çalışsa
// bile "Gün Sonu" limbo'sunda donuk kalır, gerçekten bekleyen bir iş görünmez/raporlanmaz olur.
function wakeOtherGunSonuEntries(username, excludeIds){
  const now = Date.now();
  const excluded = excludeIds instanceof Set ? excludeIds : new Set(excludeIds||[]);
  entriesArray().filter(e => e.operatorUsername===username && e.status==='duruş' && e.duruşNedeni===GUN_SONU_REASON && e.gunSonuOncesiNeden && !excluded.has(e.id)).forEach(e=>{
    DB.ref('entries/'+e.id).update({ duruşNedeni: e.gunSonuOncesiNeden, duruşTs: now, gunSonuOncesiNeden: null });
  });
}
function confirmDurus(id){
  const reason = durusReasonSel==='Diğer' ? (document.getElementById('durus-custom')?.value||'').trim() : durusReasonSel;
  if(!reason){ toast('Duruş nedeni seçmelisin'); return; }
  DB.ref('entries/'+id).update({ status:'duruş', duruşNedeni: reason, duruşTs: Date.now() });
  toast('Duruş kaydedildi');
  durusOpen=false; durusReasonSel=''; durusCustom='';
  if(reason===GUN_SONU_REASON){
    carryGunSonuToOtherPausedEntries(session.username, [id]);
    carryGunSonuToOtherPausedTadilatOps(session.username, null);
  } else if(isTadilatReason(reason)){
    activeDetailId = null; activeGroupId = null;
    tadilatForceBekleyen = true;
    view = 'tadilat';
    render();
  }
}
// Bir operatör/şef bir makinede iş bırakıp gidebiliyor (ör. yerine geçen kişi izinli); ertesi gün
// asıl operatör aynı makineyi seçtiğinde, üzerinde kimin başlattığı yarım bir iş varsa burada
// buluyoruz — yeni kayıt açmak yerine "Devral" ile aynı kayda kaldığı yerden devam edebilsin.
function machineHandoffCandidate(makineLabel){
  if(!makineLabel || isFasonMachine(makineLabel)) return null;
  return entriesArray().find(e => e.makine===makineLabel && (e.status==='devam'||e.status==='duruş') && e.operatorUsername!==session.username) || null;
}
function devralIs(id){
  const e = STATE.entries[id]; if(!e) return;
  const targets = e.groupId ? entriesArray().filter(x=>x.groupId===e.groupId && (x.status==='devam'||x.status==='duruş')) : [{ ...e, id }];
  Promise.all(targets.map(t => DB.ref('entries/'+t.id).update({ operatorUsername: session.username, operatorName: session.displayName }))).then(()=>{
    toast(targets.length>1 ? `${targets.length} iş emri devralındı — kaldığı yerden devam edebilirsin` : 'İş devralındı — kaldığı yerden devam edebilirsin');
    if(e.groupId){ activeGroupId = e.groupId; } else { activeDetailId = id; }
    view = 'list';
    render();
  }).catch(err=>{
    console.error('devralIs hatası', err);
    toast('Devralma başarısız oldu: '+(err && err.message ? err.message : 'bilinmeyen hata'));
  });
}
function devamEt(id){
  const e = STATE.entries[id] || {};
  const machineBusy = !isFasonMachine(e.makine) && entriesArray().some(o => o.id!==id && o.makine===e.makine && o.status==='devam' && !(e.groupId && o.groupId===e.groupId));
  if(machineBusy){ toast('Bu makinede zaten aktif başka bir iş var. Önce onu bitir ya da duraklat.'); return; }
  // DÜZELTME (duruş süresinin çift sayılması): Eskiden burada bitir()'deki gibi bir DURUM KONTROLÜ
  // yoktu ve duruşTs hiç temizlenmiyordu. Operatör "Devam Ettir"e mobilde iki kez dokunduğunda
  // (ilk dokunuştan sonra ekran 500ms/1sn boyunca yeniden çizilmediği için buton hâlâ oradadır)
  // ikinci çağrı, kayıt zaten 'devam' olmasına rağmen bayat duruşTs'i tekrar işleyip aynı duruşu
  // duruşToplamMs'e İKİNCİ KEZ ekliyor ve durusLog'a sahte bir olay daha yazıyordu.
  if(e.status!=='duruş'){ toast('Bu iş zaten devam ediyor'); return; }
  const extra = e.duruşTs ? (Date.now() - e.duruşTs) : 0;
  const isGunSonu = e.duruşNedeni===GUN_SONU_REASON;
  const duruşToplamMs = (e.duruşToplamMs||0) + (isGunSonu?0:extra);
  const excludedMs = (e.excludedMs||0) + (isGunSonu?extra:0);
  const durusLog = isGunSonu ? (e.durusLog||null) : appendDurusLog(e.durusLog, e.duruşNedeni, extra, e.duruşTs);
  const excludedLog = isGunSonu ? appendDurusLog(e.excludedLog, e.duruşNedeni, extra, e.duruşTs) : (e.excludedLog||null);
  DB.ref('entries/'+id).update({ status:'devam', duruşTs:null, duruşNedeni:null, duruşToplamMs, excludedMs, durusLog, excludedLog })
    .catch(err=>{ console.error('devamEt hatası', err); toast('Devam ettirilemedi: '+(err&&err.message||'hata')); });
  toast('Operasyona devam ediliyor');
  // Operatör fiilen çalışmaya döndü — elinde cascade ile Gün Sonu'na düşmüş başka iş/tadilat
  // varsa (bkz. carryGunSonuToOtherPausedEntries), onları da gerçek nedenlerine geri döndür.
  wakeOtherGunSonuEntries(session.username, [id]);
  wakeOtherGunSonuTadilatOps(session.username, null);
}
function silKayit(id){ DB.ref('entries/'+id).remove(); }

/* ===================== ÇOKLU İŞ EMRİ GRUBU — TOPLU İŞLEMLER ===================== */
function groupMembersOf(groupId){ return entriesArray().filter(e=>e.groupId===groupId && (e.status==='devam'||e.status==='duruş')); }
function duraklatGrup(groupId){
  const reason = durusReasonSel==='Diğer' ? (document.getElementById('durus-custom')?.value||'').trim() : durusReasonSel;
  if(!reason){ toast('Duruş nedeni seçmelisin'); return; }
  const now = Date.now();
  const members = groupMembersOf(groupId);
  members.forEach(e=>{
    DB.ref('entries/'+e.id).update({ status:'duruş', duruşNedeni: reason, duruşTs: now });
  });
  toast('Tüm iş emirleri duraklatıldı');
  durusOpen=false; durusReasonSel=''; durusCustom='';
  if(reason===GUN_SONU_REASON){
    carryGunSonuToOtherPausedEntries(session.username, members.map(e=>e.id));
    carryGunSonuToOtherPausedTadilatOps(session.username, null);
  }
}
function devamGrup(groupId){
  const members = groupMembersOf(groupId);
  if(members.length===0) return;
  const makine = members[0].makine;
  const machineBusy = !isFasonMachine(makine) && entriesArray().some(o => o.groupId!==groupId && o.makine===makine && o.status==='devam');
  if(machineBusy){ toast('Bu makinede zaten aktif başka bir iş var. Önce onu bitir ya da duraklat.'); return; }
  const now = Date.now();
  members.forEach(e=>{
    // DÜZELTME (bkz. devamEt'teki aynı düzeltme): zaten devam eden bir üyeyi tekrar işlemek,
    // bayat duruşTs yüzünden aynı duruşu ikinci kez sayıyordu. Grupta karışık durum oluşabiliyor
    // (ör. tadilat dönüşünde sadece kaynak üye devam ettirilir), bu yüzden üye bazında kontrol.
    if(e.status!=='duruş') return;
    const extra = e.duruşTs ? (now - e.duruşTs) : 0;
    const isGunSonu = e.duruşNedeni===GUN_SONU_REASON;
    const duruşToplamMs = (e.duruşToplamMs||0) + (isGunSonu?0:extra);
    const excludedMs = (e.excludedMs||0) + (isGunSonu?extra:0);
    const durusLog = isGunSonu ? (e.durusLog||null) : appendDurusLog(e.durusLog, e.duruşNedeni, extra, e.duruşTs);
    const excludedLog = isGunSonu ? appendDurusLog(e.excludedLog, e.duruşNedeni, extra, e.duruşTs) : (e.excludedLog||null);
    DB.ref('entries/'+e.id).update({ status:'devam', duruşTs:null, duruşNedeni:null, duruşToplamMs, excludedMs, durusLog, excludedLog });
  });
  toast('Tüm iş emirleri devam ediyor');
  wakeOtherGunSonuEntries(session.username, members.map(e=>e.id));
  wakeOtherGunSonuTadilatOps(session.username, null);
}
function bitirGrup(groupId){
  const members = groupMembersOf(groupId);
  if(members.length===0) return;
  const now = Date.now();
  // Duraklatılmışsa önce ortak duruş süresini kapat (Gün Sonu hariç tutma kuralı aynı şekilde uygulanır).
  const withDurus = members.map(e=>{
    let extra = 0;
    if(e.status==='duruş' && e.duruşTs) extra = now - e.duruşTs;
    const isGunSonu = e.duruşNedeni===GUN_SONU_REASON;
    // Not: durusLog'a BÖLÜŞTÜRÜLMEMİŞ (tam) süre yazılıyor — çünkü fiziksel olarak makine
    // TEK bir süre kadar duraklamış, aşağıdaki "share" oranı sadece adet bazlı raporlama
    // amaçlı bir dağıtım, gerçek olayın kendisi değil.
    // DÜZELTME: ts olarak duruşun BAŞLANGICI veriliyor. Eskiden ts hiç verilmediği için
    // appendDurusLog her üye için ayrı ayrı Date.now() (= duruşun BİTİŞİ) yazıyordu; bu hem
    // msOverlap'ın gün bölme hesabını kaydırıyor hem de collectDurusEvents'in grup tekilleştirme
    // anahtarını (groupId|ts|sureMs|neden) üyeler arasında farklılaştırıp aynı fiziksel duruşun
    // birden çok kez sayılmasına yol açabiliyordu.
    const durusLog = isGunSonu ? (e.durusLog||null) : appendDurusLog(e.durusLog, e.duruşNedeni, extra, e.duruşTs);
    const excludedLog = isGunSonu ? appendDurusLog(e.excludedLog, e.duruşNedeni, extra, e.duruşTs) : (e.excludedLog||null);
    return { e, duruşToplamMs: (e.duruşToplamMs||0) + (isGunSonu?0:extra), excludedMs: (e.excludedMs||0) + (isGunSonu?extra:0), durusLog, excludedLog };
  });
  const totalAdet = withDurus.reduce((s,x)=>s+(Number(x.e.adet)||0), 0);
  const n = withDurus.length;
  withDurus.forEach(x=>{
    const share = totalAdet>0 ? (Number(x.e.adet)||0)/totalAdet : 1/n;
    const wallMs = now - x.e.startTs;
    const allocatedWallMs = Math.round(wallMs*share);
    const allocatedDurusMs = Math.round(x.duruşToplamMs*share);
    const allocatedExcludedMs = Math.round(x.excludedMs*share);
    DB.ref('entries/'+x.e.id).update({
      endTs: x.e.startTs + allocatedWallMs,
      status: 'tamamlandi',
      duruşToplamMs: allocatedDurusMs,
      excludedMs: allocatedExcludedMs,
      durusLog: x.durusLog,
      excludedLog: x.excludedLog,
      finishedByUsername: session.username,
      finishedByName: session.displayName
    });
  });
  toast('Tüm iş emirleri tamamlandı');
  activeGroupId = null; view='list'; render();
}

/* ===================== ADMİN İŞLEMLERİ ===================== */
function updateDefaultMachine(code, val){ DB.ref('operators/'+code+'/defaultMachine').set(val); toast(code+' için varsayılan makine güncellendi'); }
function toggleMachineAccess(code, machineCode){
  const op = STATE.operators[code] || {};
  const current = op.allowedMachines ? {...op.allowedMachines} : Object.fromEntries(allMachineCodes().map(c=>[c,true]));
  current[machineCode] = !current[machineCode];
  DB.ref('operators/'+code+'/allowedMachines').set(current);
}
function setAccessOperator(v){ accessOperator=v; render(); }
let machineAccessModalCode = null;
function openMachineAccessModal(code){ machineAccessModalCode = code; render(); }
function closeMachineAccessModal(){ machineAccessModalCode = null; render(); }
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
function toggleMultiJob(code){
  const op = STATE.operators[code] || {};
  DB.ref('operators/'+code+'/multiJob').set(!op.multiJob);
}
function toggleCokluIsEmri(code){
  const op = STATE.operators[code] || {};
  DB.ref('operators/'+code+'/cokluIsEmri').set(!op.cokluIsEmri);
}
function toggleMessagesAccess(code){
  const op = STATE.operators[code] || {};
  DB.ref('operators/'+code+'/messagesAccess').set(!op.messagesAccess);
}
function setSettingsSubTab(t){ settingsSubTab=t; if(t==='bildirimGonder') loadPushLogHistory(); if(t==='stok') loadStockHareketleri(); render(); }

async function addOperator(){
  const code = (document.getElementById('new-op-code').value||'').trim().toUpperCase();
  const displayName = (document.getElementById('new-op-name').value||'').trim();
  const password = (document.getElementById('new-op-pass').value||'').replace(/\D/g,'').slice(0,8) || '1234';
  if(!code){ toast('Kullanıcı kodu girin'); return; }
  if(!displayName){ toast('Ad soyad girin'); return; }
  if(STATE.operators[code]){ toast(code+' zaten kayıtlı'); return; }
  const record = { displayName, password: await sha256Hex(password), defaultMachine: '' };
  DB.ref('operators/'+code).set(record);
  toast(code+' eklendi — Yönetici/Şef/Üretim Şef yapmak için Firebase Console\'dan isAdmin/isSef/isUretimSef alanını ayarla');
  document.getElementById('new-op-code').value='';
  document.getElementById('new-op-name').value='';
  document.getElementById('new-op-pass').value='1234';
}
function addMachine(){
  const code = (document.getElementById('new-mk-code').value||'').trim().toUpperCase();
  const name = (document.getElementById('new-mk-name').value||'').trim();
  if(!code){ toast('Makine kodu girin'); return; }
  if(!name){ toast('Makine adı girin'); return; }
  if(allMachines().some(m=>m.code===code)){ toast(code+' zaten kayıtlı'); return; }
  DB.ref('machines_extra/'+code).set({ name }).then(()=>{
    extraMachines[code] = { name }; // artık canlı dinlenmiyor (bkz. firebase-push.js) — yerel kopyayı da güncelle
    toast(code+' eklendi');
    document.getElementById('new-mk-code').value='';
    document.getElementById('new-mk-name').value='';
    render();
  }).catch(err=>{ console.error(err); toast('Eklenemedi, tekrar deneyin: '+(err&&err.message||'hata')); });
}
function requireSuperAdmin(){
  if(!session || !session.isSuperAdmin){ toast('Bu işlem için süper admin yetkisi gerekli'); return false; }
  return true;
}
function canManageIsEmriList(){
  if(!session) return false;
  if(session.isSuperAdmin || session.isSef) return true;
  toast('Bu işlem için yetkin yok');
  return false;
}
// Rapor ekranında silme/düzenleme yetkisi: süper admin her zaman tam yetkili. Diğer yönetici/şef
// hesapları için bu, SuperAdmin'in Ayarlar > + Kullanıcı Ekle ekranından her kullanıcıya özel
// açıp kapatabildiği bir izin. Varsayılan: silme kapalı, düzenleme açık.
function canDeleteReport(){
  if(!session) return false;
  if(session.isSuperAdmin) return true;
  if(!session.isAdmin) return false;
  const op = STATE.operators[session.username]||{};
  return !!op.permReportDelete;
}
function canEditReport(){
  if(!session) return false;
  if(session.isSuperAdmin) return true;
  if(!session.isAdmin) return false;
  const op = STATE.operators[session.username]||{};
  return op.permReportEdit !== false;
}
function toggleUserPerm(code, field){
  if(!requireSuperAdmin()) return;
  const op = STATE.operators[code]; if(!op) return;
  const newVal = field==='permReportEdit' ? (op.permReportEdit===false) : !op[field];
  DB.ref('operators/'+code+'/'+field).set(newVal);
}
