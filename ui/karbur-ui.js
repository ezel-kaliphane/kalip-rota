/* ===================== UI: KARBÜR ÇUBUK STOK & KESİM PLANLAMA =====================
   js/karbur.js'ten ayrıldı — iş mantığı orada, burada sadece render* fonksiyonları.
   Ev kuralı: oninput state'e yazar ama render ETMEZ, onblur="render()" — aksi halde her
   tuş vuruşunda tam yeniden çizim imleci kaybettirir (bkz. js/app.js:29-33). */

/* ---------- render: Ayarlar > "◆ Karbür Stok" alt sekmesi (SuperAdmin) ---------- */
function renderKarburAdminSettings(){
  if(!(session && session.isSuperAdmin)) return '<div style="color:var(--text-muted);font-size:12.5px">Bu ekran için SuperAdmin yetkisi gerekli.</div>';
  return `<div style="font-size:16px;font-weight:600;margin-bottom:6px">◆ Karbür Çubuk Stok & Kesim</div>
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:680px">Tungsten karbür çubuk stoğu ve tel erozyon kesim planlaması. "Malzeme Stoğu" (çelik hammadde) ve "Takım &amp; Sarf Stok" modüllerinden <b>tamamen ayrıdır</b>, hiçbir veri paylaşılmaz. Kalem/stok yönetimi ve kesim planı için üst menüdeki <b>◆ Karbür</b> sekmesine bak.</div>
    <label style="display:flex;align-items:center;gap:10px;background:var(--panel);border:2px solid ${karburEnabled()?'var(--success)':'var(--border)'};border-radius:10px;padding:14px 16px;max-width:560px">
      <input type="checkbox" ${karburEnabled()?'checked':''} onchange="toggleKarburEnabled()" style="width:auto;transform:scale(1.3)">
      <div>
        <div style="font-size:14px;font-weight:600;color:${karburEnabled()?'var(--success)':'var(--text)'}">Karbür Modülü ${karburEnabled()?'Aktif':'Kapalı'}</div>
        <div style="font-size:11.5px;color:var(--text-muted)">Yönetim ekranı kapalıyken de çalışır; bu anahtar ileride operatör görünümü eklenirse onu kontrol eder.</div>
      </div>
    </label>
    <div style="margin-top:18px;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px 16px;max-width:560px">
      <div style="font-size:13px;font-weight:600;margin-bottom:4px">Hurda eşiği</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px">Bu boyun <b>altındaki</b> artıklar hurdadır: fire havuzuna girmez, hakkında hiçbir kayıt tutulmaz. Eşik ve üzeri artıklar havuza girer.</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="karbur-hurda-esik" value="${esc(karburHurdaEsigi())}" style="width:80px;text-align:right"
          oninput="this.value=this.value.replace(/[^\d,.]/g,'')">
        <span style="font-size:12px;color:var(--text-muted)">mm altı hurdalanır</span>
        <button type="button" class="btn-ghost" onclick="setKarburHurdaEsigi(document.getElementById('karbur-hurda-esik').value)">Kaydet</button>
      </div>
    </div>`;
}

const KARBUR_SUBTABS = [
  { key:'plan',   label:'Kesim Planı' },
  { key:'stok',   label:'Stok & Fire' },
  { key:'giris',  label:'↓ Stok Girişi' },
  { key:'excel',  label:'Excel Yükle' },
  { key:'gecmis', label:'Geçmiş' },
  { key:'isemri', label:'İş Emri Tüketimi' }
];

/* ---------- render: üst seviye "◆ Karbür" sekmesi ---------- */
function renderKarburScreen(){
  if(!isAdminTabVisible('karbur')) return `<div class="settings-wrap"><div style="color:var(--text-muted);font-size:12.5px">Bu sekmeyi görme yetkin yok.</div></div>`;
  ensureKarburKatalogLoaded(()=>safeRender());
  ensureKarburStokLoaded(()=>safeRender());
  ensureKarburFireLoaded(()=>safeRender());

  let html = `<div class="settings-wrap">`;
  if(!canManageKarbur()){
    html += `<div style="font-size:12px;color:var(--text-muted);background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px">👁 Sadece görüntüleme modundasın — kayıt/düzenleme için stok yönetimi yetkisi (SuperAdmin veya Şef) gerekir.</div>`;
  }
  html += `<div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap">
      ${KARBUR_SUBTABS.map(t=>`<button type="button" class="chip ${karburSubView===t.key?'active':''}" onclick="karburSetSubView('${t.key}')">${esc(t.label)}</button>`).join('')}
    </div>`;

  if(karburKatalogError || karburStokError || karburFireError){
    const err = karburKatalogError || karburStokError || karburFireError;
    html += `<div style="font-size:12.5px;color:var(--danger);background:var(--panel);border:1px solid var(--danger);border-radius:10px;padding:12px 14px">
      Veri okunamadı: ${esc(err)}${String(err).includes('permission') ? ' — Firebase Rules henüz yayınlanmamış olabilir.' : ''}
      <div style="margin-top:8px"><button class="btn-ghost" onclick="retryKarburKatalogLoad(); retryKarburStokLoad(); retryKarburFireLoad();">↻ Tekrar Dene</button></div>
    </div></div>`;
    return html;
  }
  if(!karburKatalogReady || !karburStokReady || !karburFireReady){
    html += `<div style="font-size:12.5px;color:var(--text-muted)">Yükleniyor…</div></div>`;
    return html;
  }
  if(!karburKatalogArray().length && karburSubView !== 'excel' && karburSubView !== 'stok'){
    html += `<div style="font-size:12.5px;color:var(--warn);background:var(--panel);border:1px solid var(--warn);border-radius:10px;padding:12px 14px;margin-bottom:16px">
      Karbür kataloğu boş. Önce <b>Excel Yükle</b> sekmesinden stok kodlarını (ör. <code>C18XH156X3XVA90</code>) yükle ya da <b>Stok &amp; Fire</b> sekmesinden elle kalem ekle.</div>`;
  }

  if(karburSubView === 'plan')        html += renderKarburPlan();
  else if(karburSubView === 'stok')   html += renderKarburStok();
  else if(karburSubView === 'giris')  html += renderKarburGiris();
  else if(karburSubView === 'excel')  html += renderKarburExcel();
  else if(karburSubView === 'gecmis') html += renderKarburGecmis();
  else if(karburSubView === 'isemri') html += renderKarburIsEmriRapor();
  html += `</div>`;
  return html;
}

/* ==================== KESİM PLANI ==================== */
function renderKarburPlan(){
  const plan = karburComputePlan();
  const showPlan = !!karburBasePlan;
  const t = karburPlanTotals(plan);
  const fireSecili = Object.keys(karburAssigns).length;
  /* Stok yetmeyen kalem varsa KAYDET kapalı — kayıt stoğu eksiye düşüremez (bkz. js/karbur.js
     KAYDET bölümü). Toplam üzerinden bakılır: aynı kalem birden fazla satırda geçebiliyor. */
  const eksikler = showPlan ? karburPlanEksikleri(plan) : [];

  let html = `<div class="card" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:600;margin-bottom:10px">İş emirleri — gerekli parçalar</div>
    ${renderKarburRowsTable()}
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px">
      <button type="button" class="btn-ghost" onclick="karburAddRow()">+ Satır ekle</button>
      <button type="button" class="btn-primary" onclick="karburHesapla()">HESAPLA</button>
      ${karburRows.length ? `<button type="button" class="btn-ghost" onclick="karburPlanTemizle()">Temizle</button>` : ''}
      <div style="display:flex;align-items:center;gap:6px;margin-left:8px">
        <span style="font-size:11.5px;color:var(--text-muted)">Pay (mm)</span>
        <input value="${esc(karburPay)}" oninput="karburSetPay(this.value)" onblur="render()"
          style="width:56px;text-align:right" title="Her parçaya eklenen pay">
      </div>
    </div>
    <div style="font-size:11.5px;color:var(--text-muted);margin-top:10px;line-height:1.55">
      <b>Boy'u siz girersiniz</b>; program hangi çubuk boyunun en az çubukla çıktığını kendi hesaplar
      ve seçer (plan başlığındaki listeden değiştirebilirsin). İstenen boy stokta hazır standart bir
      parçaya eşitse o satır <b>kesimsiz çıkış</b> olur. <b>Delik ve kalite zorunlu değil</b> — tek
      malzeme eşleşiyorsa kendiliğinden çözülür, birden fazlaysa satırda seçim ister.
      Fire (artık) parçalar plana <b>otomatik katılmaz</b>; hesaptan sonra parçanın yanındaki
      <b>fire</b> düğmesiyle sen seçersin. <b>${karburFmt(karburHurdaEsigi())} mm altı artıklar hurdadır</b> —
      havuza girmez, kaydı tutulmaz (eşiği Ayarlar → ◆ Karbür Stok'tan değiştirebilirsin).
    </div>
  </div>`;

  html += renderKarburAdetTable();

  if(!showPlan) return html;

  if(karburPlanNo){
    html += `<div style="display:flex;align-items:center;gap:10px;background:var(--panel-alt);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:12px">
      <span style="font-size:11px;color:var(--text-muted)">Plan No</span>
      <b style="font-size:13px">${esc(karburPlanNo)}</b>
      <span style="font-size:11px;color:var(--text-muted)">— yazdırılan kâğıt ve kaydedilen hareketler bu numarayı taşır, iş emrinden geri izlenebilir</span>
    </div>`;
  }

  html += renderKarburDelta();
  html += renderKarburBekleyen(plan);
  html += renderKarburHatalar(plan);
  html += renderKarburEksik(eksikler);
  html += renderKarburDirect(plan);
  html += renderKarburAdetCikis(plan);

  if(fireSecili){
    html += `<div class="card" style="margin-bottom:14px;opacity:.62">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">ÖNCE — ilk hesap (fire kullanılmadan)</div>
      <div style="pointer-events:none">${renderKarburCutGroups(karburBasePlan, false)}</div></div>`;
  }

  html += `<div class="card" style="margin-bottom:14px;border-color:${fireSecili?'var(--accent)':'var(--border)'}">
    <div style="font-size:12px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">
      ${fireSecili ? 'Kesimli çıkışlar — SONRA (güncel plan)' : 'Kesimli çıkışlar — çubuktan kesilecek'}</div>
    ${renderKarburCutGroups(plan, true)}
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
      <b style="font-size:12px">Toplam:</b>
      <span style="font-size:12px">${t.adetToplam} adet çıkış · ${t.cubuk} taze çubuk · ${t.kesim} kesim · ${karburFmt(t.mm)} mm taze karbür${t.kesimsiz ? ` · ${t.kesimsiz} kesimsiz` : ''}</span>
      <div style="flex:1"></div>
      <button type="button" class="btn-ghost" onclick="karburYazdir()">🖨 Kesim Raporu (A4 yatay)</button>
      ${canManageKarbur()
        ? `<button type="button" class="btn-primary" ${(karburBusy||eksikler.length)?'disabled':''}
             ${eksikler.length?'title="Stok yetersiz — yukarıdaki listeye bak"':''}
             onclick="karburPlanKaydet()">${karburBusy?'Kaydediliyor…':(eksikler.length?'KAYDEDİLEMEZ — stok yetersiz':'KAYDET')}</button>`
        : ''}
    </div>
  </div>`;

  html += renderKarburAssigned();
  html += renderKarburSaveSummary();
  return html;
}

function renderKarburRowsTable(){
  if(!karburRows.length){
    return `<div style="font-size:12.5px;color:var(--text-muted);padding:14px 4px">Henüz satır yok — <b>+ Satır ekle</b> ile başla.</div>`;
  }
  const caps = karburCaps();
  let html = `<table class="tbl"><thead><tr>
    <th style="width:120px">İş Emri No</th><th style="width:82px">Dış Çap</th>
    <th style="width:78px">Delik</th><th style="width:104px">Kalite</th>
    <th style="width:74px;text-align:right">Boy</th><th style="width:62px;text-align:right">Adet</th>
    <th style="width:30px"></th></tr></thead><tbody>`;
  karburRows.forEach((r, i) => {
    const f = karburResolveRow(r);
    const boy = karburNum(r.boy);
    const hazir = (!f.hata && !f.secimBekliyor && boy > 0) ? karburFamHazir(f, boy) : null;
    html += `<tr>
      <td><input value="${esc(r.isEmri)}" oninput="karburSetRow(${i},'isEmri',this.value)" onblur="render()" placeholder="2609010024"></td>
      <td><select onchange="karburSetRowSel(${i},'disCap',this.value)">
        <option value="" ${!r.disCap?'selected':''}>—</option>
        ${caps.map(c=>`<option value="${c}" ${String(r.disCap)===String(c)?'selected':''}>Ø${karburFmt(c)}</option>`).join('')}
      </select></td>
      <td><select onchange="karburSetRowSel(${i},'delik',this.value)">
        <option value="" ${!r.delik?'selected':''}>hepsi</option>
        ${karburDelikler(r.disCap).map(d=>`<option value="${esc(d)}" ${r.delik===d?'selected':''}>${esc(d)}</option>`).join('')}
      </select></td>
      <td><select onchange="karburSetRowSel(${i},'kalite',this.value)">
        <option value="" ${!r.kalite?'selected':''}>hepsi</option>
        ${karburKaliteler(r.disCap, r.delik).map(k=>`<option value="${esc(k)}" ${r.kalite===k?'selected':''}>${esc(k)}</option>`).join('')}
      </select></td>
      <td><input value="${esc(r.boy)}" style="text-align:right"
        oninput="this.value=this.value.replace(/[^\\d,.]/g,''); karburSetRow(${i},'boy',this.value)" onblur="render()" placeholder="52"></td>
      <td><input value="${esc(r.adet)}" style="text-align:right"
        oninput="this.value=this.value.replace(/\\D/g,''); karburSetRow(${i},'adet',this.value)" onblur="render()"></td>
      <td><button type="button" class="icon-btn" title="satırı sil" onclick="karburRemoveRow(${i})">✕</button></td>
    </tr>`;
    /* Satır altı bilgi/seçim şeridi */
    let not = '';
    if(f.hata){
      not = `<span style="color:var(--danger)">${esc(f.hata)}</span>`;
    } else if(f.secimBekliyor){
      not = `<span class="chip" style="pointer-events:none;border-color:var(--warn);color:var(--warn)">malzeme seçin</span>
        <select onchange="karburSetRowFam(${i},this.value)" style="width:auto;min-width:280px;margin-left:6px">
          <option value="">— ${f.aileler.length} eşleşme var, seçin —</option>
          ${f.aileler.map(a=>{
            const hz = a.kodlar.find(k=>k.tur==='hazir' && Math.abs(k.boy-boy)<0.001);
            const cb = a.kodlar.filter(k=>k.tur==='cubuk').map(k=>karburFmt(k.boy)).join('/');
            return `<option value="${esc(a.delik+'|'+a.kalite)}">delik ${esc(a.delik)} · ${esc(a.kalite)} — stok ${a.adet}${hz?' · hazır '+karburFmt(hz.boy)+' mm':(cb?' · çubuk '+cb+' mm':'')}</option>`;
          }).join('')}
        </select>`;
    } else {
      not = `<span style="font-size:11px;color:var(--text-muted)">→ Ø${karburFmt(f.disCap)} · delik ${esc(f.delik)} · ${esc(f.kalite)}</span>`;
      if(hazir) not += ` <span class="chip" style="pointer-events:none;border-color:var(--success);color:var(--success)">kesimsiz: ${esc(hazir.kod)} (stok ${karburStokAdet(hazir.id)})</span>`;
    }
    html += `<tr><td colspan="7" style="padding-top:0;font-size:11px">${not}</td></tr>`;
  });
  return html + `</tbody></table>`;
}

/* Adet olarak verilecekler — kesim planina girmeyen kalemler (somunlar, hazir kisa parcalar).
   Boy'a gore eslesmedikleri icin kesim tablosuna uymuyorlar: burada dogrudan stok kodu secilir. */
function renderKarburAdetTable(){
  const kalemler = karburAdetKalemleri();
  let html = `<div class="card" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">Adet olarak verilecekler</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Kesilmeden doğrudan stoktan verilen kalemler. Boy yazmıyorsun, stok kodunu seçiyorsun.
      ${kalemler.length ? '' : '<b>Bu listede kalem yok</b> — <b>Stok &amp; Fire</b> ekranından bir kalemi “adet olarak tüketilir” olarak işaretle.'}</div>`;
  if(karburAdetRows.length){
    html += `<table class="tbl"><thead><tr><th style="width:120px">İş Emri No</th><th>Stok Kodu</th>
      <th style="width:70px;text-align:right">Adet</th><th style="width:90px;text-align:right">Stok</th><th style="width:30px"></th></tr></thead><tbody>`;
    karburAdetRows.forEach((r, i) => {
      const it = r.katalogId ? kalemler.find(k => k.id === r.katalogId) : null;
      const adet = parseInt(r.adet, 10) || 0;
      const stok = it ? karburStokAdet(it.id) : null;
      html += `<tr>
        <td><input value="${esc(r.isEmri)}" oninput="karburSetAdetRow(${i},'isEmri',this.value)" onblur="render()" placeholder="2609010024"></td>
        <td><select onchange="karburSetAdetRowSel(${i},'katalogId',this.value)">
          <option value="" ${!r.katalogId ? 'selected' : ''}>— kalem seç —</option>
          ${kalemler.map(k => `<option value="${esc(k.id)}" ${r.katalogId === k.id ? 'selected' : ''}>${esc(k.kod)} · ${esc(k.kalite)} (stok ${karburStokAdet(k.id)})</option>`).join('')}
        </select></td>
        <td><input value="${esc(r.adet)}" style="text-align:right"
          oninput="this.value=this.value.replace(/\D/g,''); karburSetAdetRow(${i},'adet',this.value)" onblur="render()"></td>
        <td style="text-align:right">${stok == null ? '—'
          : `${stok}${adet > stok ? ` <span class="chip" style="pointer-events:none;border-color:var(--danger);color:var(--danger)">yetersiz</span>` : ''}`}</td>
        <td><button type="button" class="icon-btn" title="satırı sil" onclick="karburRemoveAdetRow(${i})">✕</button></td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }
  return html + `<div style="margin-top:10px"><button type="button" class="btn-ghost" onclick="karburAddAdetRow()">+ Adet satırı ekle</button></div></div>`;
}

function renderKarburBekleyen(plan){
  if(!plan.bekleyen.length) return '';
  return `<div class="card" style="margin-bottom:14px;border-color:var(--warn)">
    <div style="font-size:12px;font-weight:600;color:var(--warn);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Malzeme seçimi bekliyor — bu satırlar plana alınmadı</div>
    ${plan.bekleyen.map(d=>`<div style="font-size:12px;margin-bottom:5px">
      <b>${esc(d.r.isEmri||'—')}</b> · Ø${karburFmt(karburNum(d.r.disCap))} · boy ${esc(d.r.boy||'—')} mm ·
      <span style="color:var(--text-muted)">${d.aileler.length} farklı delik/kalite eşleşiyor — yukarıdaki satırdaki listeden seç</span></div>`).join('')}
    <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Delik ve kalite zorunlu değil; yalnızca birden fazla malzeme eşleştiğinde seçim isteniyor. Varsayım yapılmıyor.</div>
  </div>`;
}

function renderKarburHatalar(plan){
  if(!plan.hatalar.length) return '';
  return `<div class="card" style="margin-bottom:14px;border-color:var(--danger)">
    <div style="font-size:12px;font-weight:600;color:var(--danger);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Eksik/hatalı satırlar — plana alınmadı</div>
    ${plan.hatalar.map(d=>`<div style="font-size:12px;margin-bottom:4px"><b>${esc(d.r.isEmri||'—')}</b> — ${esc(d.hata)}</div>`).join('')}
  </div>`;
}

/* Stok yetersizliği — kaydı durduran tek şey. Satır bazlı "yetersiz" rozetinden farklı:
   burası kalem TOPLAMINA bakar, yani aynı kalem kesimsiz çıkış + adet çıkışı + kesim
   satırlarına dağılmışsa toplamı görür.
   Çözüm yolu bilinçli olarak "yine de kaydet" değil, sayım düzeltmesi: fiili sayı farklıysa
   düzeltme `sayim` hareketi olarak kaydedilir ve kim ne zaman düzeltmiş belli olur. */
function renderKarburEksik(eksikler){
  const u = karburEksikUyari;
  if(!eksikler.length && !u) return '';
  const liste = eksikler.length ? eksikler : u.eksik;
  return `<div class="card" style="margin-bottom:14px;border-color:var(--danger)">
    <div style="font-size:12px;font-weight:600;color:var(--danger);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">
      Stok yetersiz — kayıt yapılamaz</div>
    ${(u && u.bayat) ? `<div style="font-size:12px;color:var(--warn);margin-bottom:8px">Sen planı hesapladıktan sonra stok değişmiş (başka biri kaydetmiş olabilir). Hiçbir düşüm yapılmadı — <b>HESAPLA</b>'ya basıp planı yenile.</div>` : ''}
    <table class="tbl"><thead><tr><th>Kalem</th>
      <th style="text-align:right">Gereken</th><th style="text-align:right">Mevcut</th><th style="text-align:right">Eksik</th></tr></thead><tbody>
      ${liste.map(e => `<tr><td>${esc(e.kod)}${e.tur==='fire'?' <span style="font-size:10.5px;color:var(--text-muted)">(fire havuzu)</span>':''}</td>
        <td style="text-align:right">${e.gereken}</td>
        <td style="text-align:right">${e.mevcut}</td>
        <td style="text-align:right;color:var(--danger)"><b>${e.gereken - e.mevcut}</b></td></tr>`).join('')}
    </tbody></table>
    <div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.55">
      Stok eksiye düşürülmez — buradaki fire havuzu, iş emri mm'si ve sayım farkı hep bu adetten türüyor.
      Fiilen raftaki sayı farklıysa <b>Stok &amp; Fire</b> sekmesinden <b>sayım düzeltmesi</b> yap;
      fark hareket olarak kaydedilir. Ya da planı küçültüp tekrar <b>HESAPLA</b>'ya bas.
    </div>
  </div>`;
}

function renderKarburDirect(plan){
  const list = plan.direct.filter(d=>d.adet>0), eksik = plan.direct.filter(d=>d.eksik);
  if(!list.length && !eksik.length) return '';
  let html = `<div class="card" style="margin-bottom:14px;border-color:var(--success)">
    <div style="font-size:12px;font-weight:600;color:var(--success);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Kesimsiz çıkışlar — doğrudan verilir</div>`;
  if(list.length){
    html += `<table class="tbl"><thead><tr><th>İş Emri</th><th>Stok Kodu</th>
      <th style="text-align:right">Boy</th><th style="text-align:right">Adet</th><th style="text-align:right">Stok</th></tr></thead><tbody>
      ${list.map(d=>`<tr><td>${esc(d.isEmri||'—')}</td><td>${esc(d.item.kod)}</td>
        <td style="text-align:right">${karburFmt(d.boy)} mm</td>
        <td style="text-align:right"><b>${d.adet}</b></td>
        <td style="text-align:right;color:var(--text-muted)">${d.stok}</td></tr>`).join('')}
    </tbody></table>`;
  }
  eksik.forEach(d => {
    html += `<div style="font-size:12px;margin-top:8px">
      <span class="chip" style="pointer-events:none;border-color:var(--warn);color:var(--warn)">stok yetmedi</span>
      ${esc(d.item.kod)} — ${d.eksik} adet kesimle karşılanacak</div>`;
  });
  return html + `<div style="font-size:11px;color:var(--text-muted);margin-top:8px">Standart boy karbürler (kod içindeki boy, istenen boya eşit) kesilmeden stoktan verilir; tel erozyona gitmez.</div></div>`;
}

function renderKarburAdetCikis(plan){
  const list = (plan.adetCikis || []).filter(d => !d.hata);
  const hatalar = (plan.adetCikis || []).filter(d => d.hata);
  if(!list.length && !hatalar.length) return '';
  let html = `<div class="card" style="margin-bottom:14px;border-color:var(--success)">
    <div style="font-size:12px;font-weight:600;color:var(--success);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Adet olarak verilecekler — kesim yok</div>`;
  if(list.length){
    html += `<table class="tbl"><thead><tr><th>İş Emri</th><th>Stok Kodu</th><th>Kalite</th>
      <th style="text-align:right">Adet</th><th style="text-align:right">Stok</th></tr></thead><tbody>
      ${list.map(d => `<tr><td>${esc(d.isEmri || '—')}</td><td>${esc(d.item.kod)}</td><td>${esc(d.item.kalite)}</td>
        <td style="text-align:right"><b>${d.adet}</b></td>
        <td style="text-align:right;color:${d.yetersiz ? 'var(--danger)' : 'var(--text-muted)'}">${d.stok}${d.yetersiz ? ' — yetersiz' : ''}</td></tr>`).join('')}
    </tbody></table>`;
  }
  hatalar.forEach(d => {
    html += `<div style="font-size:12px;margin-top:6px"><span class="chip" style="pointer-events:none;border-color:var(--warn);color:var(--warn)">eksik satır</span>
      ${esc(d.r.isEmri || '—')} — ${esc(d.hata)}</div>`;
  });
  return html + `</div>`;
}

function renderKarburCutGroups(plan, interactive){
  const groups = plan.cut.filter(g => g.secili && g.secili.cubuk > 0);
  const yok = plan.cut.filter(g => g.rodYok);
  /* Karşılanamayan parçalar sessizce kaybolmasın */
  let html = yok.map(g => `<div style="font-size:12px;margin-bottom:8px">
    <span class="chip" style="pointer-events:none;border-color:var(--warn);color:var(--warn)">kesilecek çubuk yok</span>
    Ø${karburFmt(g.fam.disCap)} · delik ${esc(g.fam.delik)} · ${esc(g.fam.kalite)} —
    <b>${g.pieces.length} parça karşılanamadı</b>
    <span style="color:var(--text-muted)">bu malzemede stokta çubuk (${KARBUR_CUBUK_MIN} mm üzeri) yok</span></div>`).join('');
  if(!groups.length && !yok.length) return `<div style="font-size:12.5px;color:var(--text-muted);padding:10px 2px">Kesim gerektiren parça yok.</div>`;

  groups.forEach(g => {
    const s = g.secili;
    const alt = g.secenekler.filter(x => x.item.kod !== s.item.kod)
      .map(x => `${karburFmt(x.item.boy)} mm → ${x.cubuk} çubuk${x.stok < x.cubuk ? ' (stok '+x.stok+')' : ''}`).join(' · ');
    html += `<div style="display:flex;align-items:center;gap:9px;margin:14px 0 4px;flex-wrap:wrap">
      <span style="font-weight:600;font-size:13.5px">Ø${karburFmt(g.fam.disCap)} · delik ${esc(g.fam.delik)} · ${esc(g.fam.kalite)}</span>
      ${interactive && g.secenekler.length > 1
        ? `<select onchange="karburSetRodPick('${esc(g.key)}',this.value)" style="width:auto;min-width:250px">
            ${g.secenekler.map(x=>`<option value="${esc(x.item.kod)}" ${x.item.kod===s.item.kod?'selected':''}>${esc(x.item.kod)} — ${karburFmt(x.item.boy)} mm × ${x.cubuk} çubuk</option>`).join('')}
           </select>`
        : `<span style="font-size:11.5px;color:var(--text-muted)">${esc(s.item.kod)} · çubuk ${karburFmt(s.item.boy)} mm</span>`}
      <span class="chip" style="pointer-events:none">${s.cubuk} çubuk</span>
      <span style="font-size:11px;color:var(--text-muted)">stokta ${s.stok}</span>
      ${g.yetersiz ? `<span class="chip" style="pointer-events:none;border-color:var(--danger);color:var(--danger)">stok yetersiz</span>` : ''}
      ${interactive && g.secenekler.length > 1 ? `<span style="font-size:11px;color:var(--text-muted)">program en uygunu seçti${alt ? ' · alternatif: '+esc(alt) : ''}</span>` : ''}
    </div>`;
    s.bars.forEach((b, bi) => {
      const pieces = b.pieces.map(p => `<span style="display:inline-flex;align-items:center;gap:5px;background:var(--accent-dim);border:1px solid var(--border);border-radius:6px;padding:2px 5px 2px 7px;margin:2px 3px 2px 0">
        <b>${karburFmt(p.boy + karburPay)}</b>
        <span style="font-size:10.5px;color:var(--text-muted)">${esc(p.isEmri||'—')}</span>
        ${interactive ? `<button type="button" class="btn-ghost" style="padding:0 5px;font-size:10.5px" title="bu parçayı fireden karşıla" onclick="karburOpenPicker('${esc(p.key)}')">fire</button>` : ''}
      </span>`).join('');
      html += `<div style="border-bottom:1px solid var(--border);padding:7px 0;display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div style="min-width:80px;font-size:11px;color:var(--text-muted);padding-top:5px">Çubuk #${bi+1}</div>
        <div style="flex:1;min-width:220px">${pieces}</div>
        <div style="font-size:11px;color:var(--text-muted);padding-top:5px;white-space:nowrap">
          toplam ${karburFmt(b.used)} · artık
          <span class="chip" style="pointer-events:none;${b.fire===0?'border-color:var(--success);color:var(--success)':(b.fire<karburHurdaEsigi()?'border-color:var(--danger);color:var(--danger)':'')}">${karburFmt(b.fire)} mm${(b.fire>0 && b.fire<karburHurdaEsigi())?' hurda':''}</span>
          · ${b.kesim} kesim</div>
      </div>`;
    });
  });
  return html;
}

function renderKarburAssigned(){
  const keys = Object.keys(karburAssigns);
  if(!keys.length) return '';
  let html = `<div class="card" style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Fireden karşılananlar</div>
    <table class="tbl"><thead><tr><th>İş Emri</th><th>Parça</th><th>Kaynak fire</th><th>Sonuç</th><th></th></tr></thead><tbody>`;
  keys.forEach(key => {
    const p = karburDemandPiece(key), f = karburFireById(karburAssigns[key]);
    if(!p || !f) return;
    const tam = Math.abs(f.boy - p.boy) < 0.001;
    html += `<tr><td>${esc(p.isEmri||'—')}</td><td>${karburFmt(p.boy)} mm</td>
      <td>${karburFmt(f.boy)} mm · Ø${karburFmt(f.disCap)} · ${esc(f.kalite)}</td>
      <td>${tam
        ? `<span class="chip" style="pointer-events:none;border-color:var(--success);color:var(--success)">kesim gerekmez</span>`
        : `<span class="chip" style="pointer-events:none">1 kesim</span> <span style="font-size:11px;color:var(--text-muted)">${karburFmt(f.boy - p.boy - karburPay)} mm kalır</span>`}</td>
      <td><button type="button" class="btn-ghost" style="padding:1px 7px;font-size:11px" onclick="karburUndoAssign('${esc(key)}')">geri al</button></td></tr>`;
  });
  return html + `</tbody></table></div>`;
}

function renderKarburDelta(){
  if(!karburBasePlan || !Object.keys(karburAssigns).length) return '';
  const a = karburPlanTotals(karburBasePlan), b = karburPlanTotals(karburComputePlan());
  const cell = (k, x, y, s) => `<div style="font-size:12px">
    <span style="display:block;font-size:11px;color:var(--text-muted)">${k}</span>
    ${karburFmt(x)}${s||''} <span style="color:var(--accent);font-weight:600">→</span> <b>${karburFmt(y)}${s||''}</b></div>`;
  const artik = list => list.length ? list.map(karburFmt).join(', ') + ' mm' : '—';
  return `<div style="display:flex;gap:18px;flex-wrap:wrap;background:var(--panel-alt);border:1px solid var(--border);border-radius:8px;padding:9px 12px;margin-bottom:14px">
    ${cell('Taze çubuk', a.cubuk, b.cubuk, ' ad')}
    ${cell('Kesim', a.kesim, b.kesim, '')}
    ${cell('Kullanılan taze', a.mm, b.mm, ' mm')}
    <div style="font-size:12px"><span style="display:block;font-size:11px;color:var(--text-muted)">Oluşan artıklar</span>
      ${artik(a.artiklar)} <span style="color:var(--accent);font-weight:600">→</span> <b>${artik(b.artiklar)}</b></div>
  </div>`;
}

function renderKarburSaveSummary(){
  if(!karburSaveSummary) return '';
  const s = karburSaveSummary;
  const emirler = Object.keys(s.isEmriMm).sort()
    .map(k=>`<tr><td>${esc(k)}</td><td style="text-align:right">${karburFmt(s.isEmriMm[k])} mm</td></tr>`).join('');
  const dus = Object.keys(s.cikisAdet)
    .map(id=>`<tr><td>${esc(s.kodlar[id]||id)}</td><td style="text-align:right">-${s.cikisAdet[id]}</td></tr>`).join('');
  return `<div class="card" style="margin-bottom:14px;border-color:var(--success)">
    <div style="font-size:12px;font-weight:600;color:var(--success);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Kaydedildi — stok güncellendi${s.planNo ? ` · Plan No ${esc(s.planNo)}` : ''}</div>
    <div style="display:flex;gap:22px;flex-wrap:wrap">
      <div style="min-width:260px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">İş emri bazlı kullanılan karbür</div>
        <table class="tbl"><thead><tr><th>İş Emri</th><th style="text-align:right">Kullanılan</th></tr></thead><tbody>${emirler}</tbody></table>
      </div>
      <div style="min-width:220px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Stok düşümü</div>
        <table class="tbl"><thead><tr><th>Stok Kodu</th><th style="text-align:right">Düşüm</th></tr></thead><tbody>${dus}</tbody></table>
        <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Havuza giren artık: ${s.fireEkle.length ? s.fireEkle.map(a=>karburFmt(a.boy)+' mm').join(', ') : '—'}</div>
        <div style="font-size:11px;color:var(--text-muted)">Tüketilen fire: ${Object.keys(s.fireDus).length || '—'}</div>
        ${s.hurdaMm ? `<div style="font-size:11px;color:var(--danger)">Hurdaya giden: ${karburFmt(s.hurdaMm)} mm (${karburFmt(karburHurdaEsigi())} mm altı — kaydedilmedi)</div>` : ''}
      </div>
    </div>
  </div>`;
}

/* ---------- fire seçici modal (root seviyesinde çizilir) ---------- */
function renderKarburPicker(){
  if(!karburPickerFor) return '';
  const p = karburDemandPiece(karburPickerFor);
  if(!p) return '';
  const cands = karburCandidates(p);
  const body = cands.length ? cands.map(c => `
    <div onclick="karburPickFire('${esc(p.key)}','${esc(c.f.id)}')"
      style="display:flex;align-items:center;gap:12px;padding:10px 11px;border:1px solid ${c.tam?'var(--success)':'var(--border)'};border-radius:8px;margin-bottom:7px;cursor:pointer;background:${c.tam?'var(--success-row, transparent)':'transparent'}">
      <div style="font-size:15px;font-weight:600;min-width:66px">${karburFmt(c.f.boy)} mm</div>
      <div style="flex:1">
        <div style="font-size:12.5px">Ø${karburFmt(c.f.disCap)} · delik ${esc(c.f.delik)} · <b>${esc(c.f.kalite)}</b>
          ${c.f.delik !== p.fam.delik ? `<span class="chip" style="pointer-events:none;border-color:var(--warn);color:var(--warn)">delik farklı</span>` : ''}
          ${c.f.kalite !== p.fam.kalite ? `<span class="chip" style="pointer-events:none;border-color:var(--warn);color:var(--warn)">kalite farklı</span>` : ''}</div>
        <div style="font-size:11px;color:${c.tam?'var(--success)':'var(--text-muted)'}">
          ${c.tam ? '<b>Tam eşleşme — kesim gerekmez, doğrudan verilebilir</b>' : 'Kesersen <b>'+karburFmt(c.kalan)+' mm</b> kalır'}
          &nbsp;·&nbsp; havuzda ${c.f.adet} adet</div>
      </div>
      <div style="font-size:11px;color:var(--text-muted)">Seç →</div>
    </div>`).join('')
    : `<div style="padding:22px 10px;text-align:center;color:var(--text-muted);font-size:12.5px">Bu parça için uygun fire yok.<br>
       <span style="font-size:11px">Aranan: Ø${karburFmt(p.fam.disCap)} ve boy ≥ ${karburFmt(p.boy + karburPay)} mm (ya da tam ${karburFmt(p.boy)} mm)</span></div>`;
  return `<div class="modal-overlay" onclick="if(event.target===this) karburClosePicker()">
    <div class="modal-box" style="max-width:640px">
      <div class="modal-header">
        <div><div class="modal-title">Fireden karşıla — ${karburFmt(p.boy)} mm parça</div>
        <div class="modal-sub">İş emri ${esc(p.isEmri||'—')} · paylı boy ${karburFmt(p.boy + karburPay)} mm · filtre: yalnızca dış çap Ø${karburFmt(p.fam.disCap)}</div></div>
        <button type="button" class="icon-btn" onclick="karburClosePicker()">✕</button>
      </div>
      <div class="modal-body">${body}</div>
    </div></div>`;
}

/* ==================== STOK & FİRE ==================== */
function renderKarburStok(){
  const kesimler = karburKesimKalemleri();
  const adetler  = karburAdetKalemleri();
  const fireler  = karburFireArray();
  const yon = canManageKarbur();

  /* Kalemin kesime mi gireceği, adet olarak mı tüketileceği kullanıcının işaretine bağlı.
     Dış çap/boy kodundan okunamayan kalemler kesime alınamaz — o seçenek kapalı gelir. */
  const kullanimSecici = k => {
    const cur = k.kullanim || 'kesim';
    const kesimOlur = k.disCap > 0 && k.boy > 0;
    if(!yon) return `<span style="font-size:11px;color:var(--text-muted)">${cur === 'kesim' ? 'kesim planına girer' : 'adet olarak tüketilir'}</span>`;
    return `<select onchange="karburSetKullanim('${esc(k.id)}',this.value)" style="width:auto;font-size:11.5px;padding:3px 5px">
      <option value="kesim" ${cur === 'kesim' ? 'selected' : ''} ${kesimOlur ? '' : 'disabled'}>kesim planına girer</option>
      <option value="adet" ${cur === 'adet' ? 'selected' : ''}>adet olarak tüketilir</option>
    </select>${kesimOlur ? '' : `<div style="font-size:10.5px;color:var(--text-muted)">ölçüleri koddan okunamadı</div>`}`;
  };
  const adetHucre = k => yon
    ? `<input value="${karburStokAdet(k.id)}" style="width:70px;text-align:right"
         oninput="this.value=this.value.replace(/\D/g,'')"
         onchange="karburSayimSet('${esc(k.id)}',this.value)" title="sayım düzeltmesi">`
    : `<b>${karburStokAdet(k.id)}</b>`;

  let html = `<div class="card" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">Kesim planına girenler</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Boyu ${KARBUR_CUBUK_MIN} mm ve üzeri olanlar çubuk (kesilir), kısası hazır standart parça (istenen boya eşitse kesimsiz verilir).</div>
    ${kesimler.length ? `<table class="tbl"><thead><tr><th>Stok Kodu</th><th>Dış Çap</th><th>Delik</th><th>Kalite</th>
      <th style="text-align:right">Boy</th><th>Tür</th><th style="text-align:right">Adet</th><th>Kullanım</th></tr></thead><tbody>
      ${kesimler.map(k => `<tr><td>${esc(k.kod)}</td><td>Ø${karburFmt(k.disCap)}</td><td>${esc(k.delik)}</td>
        <td>${esc(k.kalite)}</td><td style="text-align:right">${karburFmt(k.boy)} mm</td>
        <td style="font-size:11px;color:var(--text-muted)">${k.tur === 'cubuk' ? 'çubuk' : 'hazır parça'}</td>
        <td style="text-align:right;width:88px">${adetHucre(k)}</td>
        <td style="width:200px">${kullanimSecici(k)}</td></tr>`).join('')}
    </tbody></table>` : `<div style="font-size:12.5px;color:var(--text-muted)">Kayıt yok.</div>`}
  </div>

  <div class="card" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">Adet olarak tüketilenler</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Kesilik gelen kalemler (ör. somun elmasları) — kesim planına hiç girmez, doğrudan adet düşülür. Bir kalemi listeler arasında taşımak için sağdaki <b>Kullanım</b> seçeneğini değiştir.</div>
    ${adetler.length ? `<table class="tbl"><thead><tr><th>Stok Kodu</th><th>Ölçüler</th><th>Kalite</th>
      <th style="text-align:right">Adet</th><th>Kullanım</th></tr></thead><tbody>
      ${adetler.map(k => `<tr><td>${esc(k.kod)}</td>
        <td style="font-size:11px;color:var(--text-muted)">${(k.alanlar || []).map(karburFmt).join(' × ') || '—'}</td>
        <td>${esc(k.kalite)}</td>
        <td style="text-align:right;width:88px">${adetHucre(k)}</td>
        <td style="width:200px">${kullanimSecici(k)}</td></tr>`).join('')}
    </tbody></table>` : `<div style="font-size:12.5px;color:var(--text-muted)">Kayıt yok.</div>`}
  </div>

  <div class="card" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">Fire havuzu — artık parçalar</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Eşik yok, tüm artıklar stoğa girer. Kesim planında <b>otomatik kullanılmaz</b>; parça bazında sen seçersin.</div>
    ${fireler.length ? `<table class="tbl"><thead><tr><th>Dış Çap</th><th>Delik</th><th>Kalite</th>
      <th style="text-align:right">Kalan Boy</th><th style="text-align:right">Adet</th></tr></thead><tbody>
      ${fireler.map(f => `<tr><td>Ø${karburFmt(f.disCap)}</td><td>${esc(f.delik)}</td><td>${esc(f.kalite)}</td>
        <td style="text-align:right">${karburFmt(f.boy)} mm</td>
        <td style="text-align:right;width:88px">${yon
          ? `<input value="${Number(f.adet) || 0}" style="width:70px;text-align:right"
               oninput="this.value=this.value.replace(/\D/g,'')"
               onchange="karburFireSet('${esc(f.id)}',this.value)" title="fire sayım düzeltmesi">`
          : `<b>${Number(f.adet) || 0}</b>`}</td></tr>`).join('')}
    </tbody></table>` : `<div style="font-size:12.5px;color:var(--text-muted)">Havuz boş.</div>`}
    ${yon ? `<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
      <div class="field" style="width:96px"><label>Dış Çap</label><input id="karbur-fire-cap" placeholder="18"></div>
      <div class="field" style="width:88px"><label>Delik</label><input id="karbur-fire-delik" placeholder="3"></div>
      <div class="field" style="width:110px"><label>Kalite</label><input id="karbur-fire-kalite" placeholder="VA90"></div>
      <div class="field" style="width:96px"><label>Kalan Boy</label><input id="karbur-fire-boy" placeholder="61"></div>
      <div class="field" style="width:80px"><label>Adet</label><input id="karbur-fire-adet" placeholder="1"></div>
      <button type="button" class="btn-ghost" onclick="karburFireEkle()">+ Fire ekle</button>
      <span style="font-size:11px;color:var(--text-muted)">ilk kurulum / fiziksel sayım için</span>
    </div>` : ''}
  </div>

  ${yon ? `<div class="card">
    <div style="font-size:13px;font-weight:600;margin-bottom:8px">Yeni kalem ekle</div>
    <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
      <div class="field" style="width:230px"><label>Stok Kodu</label><input id="karbur-yeni-kod" placeholder="C18XH156X3XVA90"></div>
      <div class="field" style="width:96px"><label>Adet</label><input id="karbur-yeni-adet" placeholder="0"></div>
      <button type="button" class="btn-ghost" onclick="karburKatalogEkle()">+ Ekle</button>
      <span style="font-size:11px;color:var(--text-muted)">önek serbest (C/V/S ya da hiç) · üç ölçülü kodlar kesime, diğerleri adete varsayılır</span>
    </div></div>` : ''}`;
  return html;
}

/* ==================== STOK GİRİŞİ ==================== */
function renderKarburGiris(){
  if(!canManageKarbur()) return `<div style="font-size:12.5px;color:var(--text-muted)">Stok girişi için yetkin yok.</div>`;
  return `<div class="card" style="max-width:560px">
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">↓ Stok girişi</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Satın alma / iade ile gelen çubuk veya hazır parça girişi. Katalogda olmayan kod için önce <b>Stok &amp; Fire</b> sekmesinden kalem açın.</div>
    <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
      <div class="field" style="width:240px"><label>Stok Kodu</label>
        <input value="${esc(karburGirisKod)}" oninput="karburGirisKod=this.value" onblur="render()" placeholder="C18XH156X3XVA90"></div>
      <div class="field" style="width:100px"><label>Adet</label>
        <input value="${esc(karburGirisAdet)}" oninput="this.value=this.value.replace(/\\D/g,''); karburGirisAdet=this.value" onblur="render()"></div>
      <button type="button" class="btn-primary" ${karburBusy?'disabled':''} onclick="karburStokGiris()">${karburBusy?'…':'Giriş Yap'}</button>
    </div>
  </div>`;
}

/* ==================== EXCEL YÜKLE ====================
   Mevcut kalemlerin stok adedi için açık onay bloğu. Varsayılan KAPALI: Excel'in sessizce
   stok ezmesi (aynı dosyanın ikinci yüklemesinde aradaki tüm çıkışların sıfırlanması) bu
   yüzden mümkün değil. İşaretlenirse önce fark tablosu gösterilir. */
function renderKarburExcelStokBloku(pv){
  if(!pv.guncel) return '';                       // güncellenecek mevcut kalem yok
  if(!pv.adetSutunuVar){
    return `<div style="font-size:11.5px;color:var(--text-muted);background:var(--panel-alt);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px">
      Dosyada <b>ADET</b>/<b>MİKTAR</b> sütunu yok — stok adetlerine dokunulmayacak, yalnızca katalog güncellenecek.</div>`;
  }
  const f = pv.farklar || [];
  let html = `<label style="display:flex;align-items:flex-start;gap:10px;background:var(--panel-alt);border:2px solid ${karburExcelStokGuncelle?'var(--warn)':'var(--border)'};border-radius:8px;padding:10px 12px;margin-bottom:12px;cursor:pointer">
    <input type="checkbox" ${karburExcelStokGuncelle?'checked':''} onchange="karburSetExcelStokGuncelle(this.checked)" style="width:auto;transform:scale(1.2);margin-top:2px">
    <div>
      <div style="font-size:12.5px;font-weight:600;color:${karburExcelStokGuncelle?'var(--warn)':'var(--text)'}">Mevcut kalemlerin stok adedini de Excel'deki değere ayarla <span style="font-weight:400;color:var(--text-muted)">(sayım)</span></div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">İşaretlemezsen mevcut kalemlerin adedine <b>hiç dokunulmaz</b>; sadece katalog bilgisi güncellenir. İşaretlersen ${f.length} kalemin adedi değişir ve her biri <b>sayım hareketi</b> olarak Geçmiş'e yazılır.</div>
    </div>
  </label>`;
  if(!karburExcelStokGuncelle) return html;
  if(!f.length){
    return html + `<div style="font-size:11.5px;color:var(--success);margin-bottom:12px">Excel'deki adetler sistemdekilerle aynı — değişecek bir şey yok.</div>`;
  }
  html += `<div style="border:1px solid var(--warn);border-radius:8px;padding:10px 12px;margin-bottom:12px">
    <div style="font-size:12px;font-weight:600;color:var(--warn);margin-bottom:8px">Uygulanacak sayım farkları (${f.length})</div>
    <table class="tbl"><thead><tr><th>Kod</th>
      <th style="text-align:right">Sistemde</th><th style="text-align:right">Excel'de</th><th style="text-align:right">Fark</th></tr></thead><tbody>
      ${f.slice(0,30).map(x=>`<tr><td>${esc(x.kod)}</td>
        <td style="text-align:right">${x.sistem}</td>
        <td style="text-align:right"><b>${x.excel}</b></td>
        <td style="text-align:right;color:${x.excel<x.sistem?'var(--danger)':'var(--success)'}">${x.excel-x.sistem>0?'+':''}${x.excel-x.sistem}</td></tr>`).join('')}
    </tbody></table>
    ${f.length>30 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">…ve ${f.length-30} kalem daha</div>` : ''}
    <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Excel'de adet hücresi <b>boş</b> olan kalemler bu listede yok — boş hücre "sıfır" değil, "bilgi yok" sayılır ve o kaleme dokunulmaz.</div>
  </div>`;
  return html;
}

function renderKarburExcel(){
  if(!canManageKarbur()) return `<div style="font-size:12.5px;color:var(--text-muted)">Excel yükleme için yetkin yok.</div>`;
  const pv = karburExcelPreview;
  let html = `<div class="card" style="margin-bottom:14px;max-width:760px">
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">Excel ile stok yükleme</div>
    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px;line-height:1.55">
      Kod öneki serbest (<code>C</code>ivata / <code>V</code>ida / <code>S</code>omun ya da hiç) ve
      boydan önceki <code>H</code> opsiyonel. <b>Üç ölçülü</b> kodlar (ör. <code>C18XH156X3XVA90</code>,
      <code>V10X156X3XST7</code>) dış çap · boy · delik olarak okunup <b>kesim planına</b>, diğerleri
      (ör. <code>S22X20X11X5XST7</code>) <b>adet olarak tüketilenlere</b> varsayılır — bu yalnızca
      varsayılan, hangi kalemin nereye ait olduğunu <b>Stok &amp; Fire</b> listesinden kendin
      işaretleyebilirsin. Tüm sayfalar taranır, <b>hiçbir kayıt silinmez</b>.
      <br><b>Stok adetleri:</b> Excel yeni kalem açarken <b>ADET</b>/<b>MİKTAR</b> sütununu başlangıç
      adedi olarak yazar. <b>Mevcut</b> kalemlerin adedine varsayılan olarak dokunmaz — Excel'deki
      sayıyı uygulamak istersen önizlemedeki kutuyu işaretle, ne değişeceğini önce fark tablosunda
      görürsün ve her değişiklik <b>sayım hareketi</b> olarak kaydedilir.
    </div>
    <input type="file" accept=".xlsx,.xls" onchange="karburExcelSec(event)" style="width:auto">
  </div>`;
  if(!pv) return html;

  html += `<div class="card" style="max-width:760px;border-color:var(--accent)">
    <div style="font-size:13px;font-weight:600;margin-bottom:8px">Önizleme — onay bekliyor</div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;margin-bottom:12px">
      <div><span style="display:block;font-size:11px;color:var(--text-muted)">Okunan satır</span><b>${pv.satirlar.length}</b></div>
      <div><span style="display:block;font-size:11px;color:var(--text-muted)">Yeni kalem</span><b style="color:var(--success)">${pv.yeni}</b></div>
      <div><span style="display:block;font-size:11px;color:var(--text-muted)">Güncellenecek</span><b>${pv.guncel}</b></div>
      <div><span style="display:block;font-size:11px;color:var(--text-muted)">Kesime / Adete</span><b>${pv.kesim} / ${pv.adet}</b></div>
      <div><span style="display:block;font-size:11px;color:var(--text-muted)">Okunamayan kod</span><b style="color:${pv.hatali.length?'var(--danger)':'var(--text)'}">${pv.hatali.length}</b></div>
      ${pv.tekrar ? `<div><span style="display:block;font-size:11px;color:var(--text-muted)">Tekrar eden kod</span><b>${pv.tekrar}</b></div>` : ''}
    </div>
    ${pv.hatali.length ? `<div style="font-size:11px;color:var(--danger);margin-bottom:10px">
      Format dışı kodlar atlanacak: ${pv.hatali.slice(0,8).map(h=>esc(h.kod)).join(', ')}${pv.hatali.length>8?' …':''}</div>` : ''}
    ${pv.tekrar ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Aynı kod birden fazla satırda geçiyor — her kod için <b>son</b> satır geçerli sayıldı (aksi halde aynı kod için ikinci bir stok kalemi açılırdı).</div>` : ''}
    ${renderKarburExcelStokBloku(pv)}
    <table class="tbl"><thead><tr><th>Kod</th><th>Ölçüler</th><th>Kalite</th><th>Varsayılan kullanım</th><th style="text-align:right">Adet</th></tr></thead><tbody>
      ${pv.satirlar.slice(0,25).map(s=>`<tr><td>${esc(s.kod)}</td>
        <td style="font-size:11px;color:var(--text-muted)">${(s.alanlar||[]).map(karburFmt).join(' × ')}${s.kullanim==='kesim'?` <span style="color:var(--text)">(Ø${karburFmt(s.disCap)} · boy ${karburFmt(s.boy)} · delik ${esc(s.delik)})</span>`:''}</td>
        <td>${esc(s.kalite)}</td>
        <td>${s.kullanim==='kesim'?`kesim planına girer <span style="font-size:10.5px;color:var(--text-muted)">(${s.tur==='cubuk'?'çubuk':'hazır parça'})</span>`:'adet olarak tüketilir'}</td>
        <td style="text-align:right">${s.adet == null ? '<span style="color:var(--text-muted)">—</span>' : s.adet}</td></tr>`).join('')}
    </tbody></table>
    ${pv.satirlar.length>25 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">…ve ${pv.satirlar.length-25} satır daha</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:12px">
      <button type="button" class="btn-primary" ${karburBusy?'disabled':''} onclick="karburExcelOnayla()">${karburBusy?'Yükleniyor…':'Onayla ve Yükle'}</button>
      <button type="button" class="btn-ghost" onclick="karburExcelIptal()">İptal</button>
    </div>
  </div>`;
  return html;
}

/* ==================== GEÇMİŞ ====================
   Hareketler plana göre gruplanır: bir kesim planı tek bir olaydır, 8 ayrı satır olarak
   okumak anlamsızdı. Grup başlığında planın stok etkisi (çubuk tüketimi), altında o planın
   iş emirlerine tahsisi görünür. Plan dışı kayıtlar (giriş / sayım / Excel) tarihe göre
   ayrı listelenir. */
const KARBUR_TIP_ETIKET = {
  kesim:        { ad:'Çubuk tüketimi', renk:'var(--accent)' },
  tahsis:       { ad:'İş emri tahsisi', renk:'var(--text-muted)' },
  adet_cikis:   { ad:'Adet çıkışı',     renk:'var(--success)' },
  kesimsiz:     { ad:'Kesimsiz çıkış',  renk:'var(--success)' },
  fire_kullanim:{ ad:'Fire kullanımı',  renk:'var(--gunsonu)' },
  fire_uretim:  { ad:'Kesimden artan',  renk:'var(--gunsonu)' },
  fire_giris:   { ad:'Fire girişi',     renk:'var(--gunsonu)' },
  iptal:        { ad:'Geri alma',       renk:'var(--danger)' },
  fire_sayim:   { ad:'Fire sayımı',     renk:'var(--warn)' },
  giris:        { ad:'Stok girişi',     renk:'var(--success)' },
  sayim:        { ad:'Sayım',           renk:'var(--warn)' }
};
function karburTipEtiket(tip){ return KARBUR_TIP_ETIKET[tip] || { ad: tip || '—', renk:'var(--text-muted)' }; }
function karburAdetHucre(h){
  if(h.adet == null || h.adet === 0) return '<span style="color:var(--text-muted)">—</span>';
  const n = Number(h.adet);
  const iz = (h.oncekiAdet != null && h.sonrakiAdet != null)
    ? ` <span style="font-size:10.5px;color:var(--text-muted)">(${h.oncekiAdet}→${h.sonrakiAdet})</span>` : '';
  return `<span style="color:${n < 0 ? 'var(--danger)' : 'var(--success)'}">${n > 0 ? '+' : ''}${n}</span>${iz}`;
}
function karburTarih(ts){ return ts ? new Date(ts).toLocaleString('tr-TR') : '—'; }

function renderKarburGecmis(){
  const hepsi = karburHareketler || [];
  const planli = hepsi.filter(h => h.planNo);
  const digerler = hepsi.filter(h => !h.planNo);

  /* planNo -> { ts, stok:[], tahsis:[], fire:[], artik:[], iptalKayitlari:[] } */
  const gruplar = {};
  planli.forEach(h => {
    const g = (gruplar[h.planNo] = gruplar[h.planNo] || { planNo:h.planNo, ts:h.ts, kim:h.operatorName || h.operatorUsername, stok:[], tahsis:[], fire:[], artik:[], iptalKayitlari:[] });
    g.ts = Math.max(g.ts || 0, h.ts || 0);
    /* Eski biçimli kayıt: tip 'kesim' ama iş emrine bağlı ve stok izi (oncekiAdet) yok —
       ilk sürümde çubuk tüketimi ile tahsis aynı satırda yazılıyordu. Tahsis gibi gösteriyoruz
       ki geçmiş anlamlı okunsun; veriye dokunmuyoruz. */
    const eskiBicim = h.tip === 'kesim' && h.isEmriNo && h.oncekiAdet == null;
    if(eskiBicim) h._eski = true;
    /* Geri alma kayıtları planın kendi numarasını taşıyor — aynı grupta ama AYRI bölümde,
       yoksa toplamlara karışıp planı iki kat büyük gösterirlerdi. */
    if(h.tip === 'iptal'){ g.iptalKayitlari.push(h); g.iptal = true; return; }
    if(h.iptalTs) g.iptal = true;
    if(h.tip === 'fire_uretim') g.artik.push(h);
    else if(h.tip === 'tahsis' || eskiBicim) g.tahsis.push(h);
    else if(h.tip === 'fire_kullanim') g.fire.push(h);
    else g.stok.push(h);
  });
  const grupListe = Object.values(gruplar).sort((a, b) => (b.ts || 0) - (a.ts || 0));

  let html = `<div class="card" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:600">Kesim planları</div>
      <button type="button" class="btn-ghost" style="padding:2px 8px;font-size:11px" onclick="loadKarburHareketleri(200)">↻ Yenile</button>
      <span style="font-size:11px;color:var(--text-muted)">son ${hepsi.length} hareket okundu — tüm hareketler hiç toplu indirilmez</span>
    </div>`;

  if(!grupListe.length){
    html += `<div style="font-size:12.5px;color:var(--text-muted)">Kayıtlı plan yok — <b>↻ Yenile</b> ile okumayı tetikle.</div>`;
  }

  grupListe.forEach(g => {
    const cubukToplam = g.stok.reduce((a, h) => a + Math.abs(Number(h.adet) || 0), 0);
    const mmToplam = g.tahsis.concat(g.fire).reduce((a, h) => a + (Number(h.mm) || 0), 0);
    const parcaToplam = g.tahsis.concat(g.fire).reduce((a, h) => a + (Number(h.parca) || 0), 0);
    const artikToplam = g.artik.reduce((a, h) => a + (Number(h.adet) || 0), 0);
    html += `<div style="border:1px solid ${g.iptal?'var(--danger)':'var(--border)'};border-radius:9px;padding:10px 12px;margin-bottom:10px;background:var(--panel-alt)">
      <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px">
        <b style="font-size:13px;${g.iptal?'text-decoration:line-through;opacity:.7':''}">${esc(g.planNo)}</b>
        ${g.iptal ? `<span class="chip" style="pointer-events:none;border-color:var(--danger);color:var(--danger);font-size:10.5px">GERİ ALINDI</span>` : ''}
        <span style="font-size:11.5px;color:var(--text-muted)">${karburTarih(g.ts)} · ${esc(g.kim || '—')}</span>
        <div style="flex:1"></div>
        <span style="font-size:11.5px;${g.iptal?'opacity:.6':''}">${[
          cubukToplam ? cubukToplam + ' çubuk' : '',
          parcaToplam ? parcaToplam + ' parça' : '',
          mmToplam ? karburFmt(mmToplam) + ' mm' : '',
          artikToplam ? artikToplam + ' artık' : '',
          g.tahsis.length + ' iş emri'
        ].filter(Boolean).join(' · ')}</span>
        ${(canManageKarbur() && !g.iptal) ? `<button type="button" class="btn-ghost" style="padding:2px 9px;font-size:11px"
          ${(karburBusy||karburIptalYukleniyor)?'disabled':''} onclick="karburPlanIptalIste('${esc(g.planNo)}')"
          title="Bu planın stok düşümlerini ve iş emri tüketimini geri al">↩ Geri al</button>` : ''}
      </div>
      ${(karburIptalOnay && karburIptalOnay.planNo === g.planNo) ? renderKarburIptalOnay() : ''}`;

    if(g.stok.length){
      html += `<div style="font-size:11px;color:var(--text-muted);margin:6px 0 3px">Stok etkisi</div>
        <table class="tbl"><tbody>
        ${g.stok.map(h => `<tr><td style="width:150px">${esc(karburTipEtiket(h.tip).ad)}</td>
          <td>${esc(h.kod || '—')}</td>
          <td style="width:130px;text-align:right">${karburAdetHucre(h)}</td>
          <td style="font-size:11px;color:var(--text-muted)">${esc(h.aciklama || '')}</td></tr>`).join('')}
        </tbody></table>`;
    }
    if(g.tahsis.length || g.fire.length){
      html += `<div style="font-size:11px;color:var(--text-muted);margin:8px 0 3px">İş emirlerine tahsis</div>
        <table class="tbl"><thead><tr><th>İş Emri</th><th>Kaynak</th>
          <th style="text-align:right">Parça</th><th style="text-align:right">mm</th><th>Detay</th></tr></thead><tbody>
        ${g.tahsis.concat(g.fire).sort((a,b)=>String(a.isEmriNo).localeCompare(String(b.isEmriNo)))
          .map(h => `<tr><td>${esc(h.isEmriNo || '—')}</td>
          <td style="font-size:11px;color:${h._eski ? 'var(--text-muted)' : karburTipEtiket(h.tip).renk}">${h._eski
            ? 'İş emri tahsisi <span style="font-size:10px">(eski biçim)</span>'
            : esc(karburTipEtiket(h.tip).ad)}</td>
          <td style="text-align:right"><b>${h.parca != null ? h.parca : '—'}</b></td>
          <td style="text-align:right">${h.mm ? karburFmt(h.mm) : '—'}</td>
          <td style="font-size:11px;color:var(--text-muted)">${h._eski
            ? 'parça detayı kaydedilmemiş (mm doğru)'
            : esc(h.aciklama || '')}</td></tr>`).join('')}
        </tbody></table>`;
    }
    if(g.artik.length){
      html += `<div style="font-size:11px;color:var(--text-muted);margin:8px 0 3px">Havuza dönen artıklar</div>
        <table class="tbl"><tbody>
        ${g.artik.map(h => `<tr><td style="width:150px">${esc(karburTipEtiket(h.tip).ad)}</td>
          <td>${esc(h.kod || '—')}</td>
          <td style="width:130px;text-align:right">${karburAdetHucre(h)}</td>
          <td style="font-size:11px;color:var(--text-muted)">${esc(h.aciklama || '')}</td></tr>`).join('')}
        </tbody></table>`;
    }
    if(g.iptalKayitlari.length){
      html += `<div style="font-size:11px;color:var(--danger);margin:8px 0 3px">Geri alma — ${karburTarih(g.iptalKayitlari[0].ts)} · ${esc(g.iptalKayitlari[0].operatorName || g.iptalKayitlari[0].operatorUsername || '—')}</div>
        <table class="tbl"><tbody>
        ${g.iptalKayitlari.map(h => `<tr><td>${esc(h.kod || '—')}</td>
          <td style="width:130px;text-align:right">${karburAdetHucre(h)}</td>
          <td style="font-size:11px;color:var(--text-muted)">${esc(h.aciklama || '')}</td></tr>`).join('')}
        </tbody></table>`;
    }
    html += `</div>`;
  });
  html += `</div>`;

  html += `<div class="card">
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">Plan dışı hareketler</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Stok girişi, sayım düzeltmesi, Excel ile ilk yükleme, fire havuzu düzeltmeleri.</div>
    ${digerler.length ? `<table class="tbl"><thead><tr><th>Tarih</th><th>Tip</th><th>Kalem</th>
      <th style="text-align:right">Adet</th><th>Kim</th><th>Not</th></tr></thead><tbody>
      ${digerler.map(h => `<tr><td style="white-space:nowrap">${karburTarih(h.ts)}</td>
        <td style="color:${karburTipEtiket(h.tip).renk}">${esc(karburTipEtiket(h.tip).ad)}</td>
        <td>${esc(h.kod || '—')}</td>
        <td style="text-align:right">${karburAdetHucre(h)}</td>
        <td>${esc(h.operatorName || h.operatorUsername || '—')}</td>
        <td style="font-size:11px;color:var(--text-muted)">${esc(h.aciklama || '')}</td></tr>`).join('')}
    </tbody></table>` : `<div style="font-size:12.5px;color:var(--text-muted)">Kayıt yok.</div>`}
  </div>`;
  return html;
}

/* Geri alma onayı — ne olacağı basılmadan önce kalem kalem gösterilir. Plan kaydında olduğu
   gibi burada da varsayım yapılmıyor: kullanıcı listeyi görüp onaylıyor. */
function renderKarburIptalOnay(){
  const o = karburIptalOnay;
  if(!o) return '';
  const satir = (kod, adet, renk) => `<tr><td>${esc(kod)}</td>
    <td style="text-align:right;color:${renk}"><b>${adet > 0 ? '+' : ''}${adet}</b></td></tr>`;
  const stokSatirlari = Object.keys(o.stokEkle).map(id => {
    const it = karburKatalogArray().find(k => k.id === id);
    return satir(it ? it.kod : id, o.stokEkle[id], 'var(--success)');
  });
  const fireIadeSatirlari = Object.keys(o.fireEkle).map(id =>
    satir(karburFireKodu(karburFireById(id) || {}), o.fireEkle[id], 'var(--success)'));
  const fireDusSatirlari = Object.keys(o.fireDus).map(id =>
    satir(karburFireKodu(karburFireById(id) || {}), -o.fireDus[id], 'var(--danger)'));
  const ozetSatirlari = Object.keys(o.ozetDus).map(base =>
    `<tr><td>${esc(base)}</td><td style="text-align:right;color:var(--danger)">
      −${karburFmt(o.ozetDus[base].mm)} mm · −${o.ozetDus[base].parca} parça</td></tr>`);

  return `<div style="border:1px solid var(--danger);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--panel)">
    <div style="font-size:12px;font-weight:600;color:var(--danger);margin-bottom:6px">${esc(o.planNo)} geri alınacak — onayla</div>
    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;line-height:1.55">
      Kayıtlar <b>silinmez</b>: plana ait hareketler iptal olarak işaretlenir ve her düzeltme için
      ters kayıt yazılır, geçmişte ne yapıldığı okunabilir kalır.
    </div>
    ${o.uyari === 'artik-bilinmiyor' ? `<div style="font-size:11.5px;color:var(--warn);border:1px solid var(--warn);border-radius:6px;padding:8px 10px;margin-bottom:8px;line-height:1.5">
      Bu plan, artıkların hangi havuz kaydına gittiğini tutmayan eski bir sürümde kaydedilmiş.
      Stok iadesi ve iş emri özeti düzeltilecek, ama <b>kesimden artan parçalar havuzda kalacak</b> —
      onları <b>Stok &amp; Fire</b> sekmesinden elle düşür.</div>` : ''}
    ${(stokSatirlari.length || fireIadeSatirlari.length) ? `<div style="font-size:11px;color:var(--text-muted);margin:4px 0 3px">Stoğa iade</div>
      <table class="tbl"><tbody>${stokSatirlari.join('')}${fireIadeSatirlari.join('')}</tbody></table>` : ''}
    ${fireDusSatirlari.length ? `<div style="font-size:11px;color:var(--text-muted);margin:8px 0 3px">Havuzdan çıkarılacak artıklar</div>
      <table class="tbl"><tbody>${fireDusSatirlari.join('')}</tbody></table>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Bu artıklar bu arada başka bir işte kullanılmışsa geri alma yapılmaz ve hiçbir şey değişmez.</div>` : ''}
    ${ozetSatirlari.length ? `<div style="font-size:11px;color:var(--text-muted);margin:8px 0 3px">İş emri tüketiminden düşülecek</div>
      <table class="tbl"><tbody>${ozetSatirlari.join('')}</tbody></table>` : ''}
    <div style="display:flex;gap:8px;margin-top:10px">
      <button type="button" class="btn-primary" ${karburBusy?'disabled':''} onclick="karburPlanIptalUygula()">${karburBusy?'Geri alınıyor…':'Evet, geri al'}</button>
      <button type="button" class="btn-ghost" onclick="karburPlanIptalVazgec()">Vazgeç</button>
    </div>
  </div>`;
}

/* ==================== İŞ EMRİ TÜKETİM RAPORU ====================
   Modülün asıl iş değeri: hangi iş emri ne kadar karbür yedi. Veri zaten karburIsEmriOzet'te
   denormalize duruyordu, tek görünen yeri operatör ekranındaki tek satırlık şeritti. */
function renderKarburIsEmriRapor(){
  let html = `<div class="card">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <div style="font-size:13px;font-weight:600">İş emri bazlı karbür tüketimi</div>
      <button type="button" class="btn-ghost" style="padding:2px 8px;font-size:11px" onclick="loadKarburIsEmriOzet(150)">↻ Yenile</button>
    </div>
    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px;line-height:1.55">
      Son hareket gören 150 iş emri. <b>mm</b> brüt tüketimdir — kesim payı dahil, yani çubuktan
      fiilen giden boy. Geri alınan planlar bu toplamlardan düşülmüştür.
    </div>`;

  if(karburOzetListeHata){
    return html + `<div style="font-size:12.5px;color:var(--danger)">Okunamadı: ${esc(karburOzetListeHata)}
      <div style="margin-top:8px"><button class="btn-ghost" onclick="loadKarburIsEmriOzet(150)">↻ Tekrar Dene</button></div></div></div>`;
  }
  if(karburOzetListe == null){
    if(!karburOzetListeYukleniyor) loadKarburIsEmriOzet(150);
    return html + `<div style="font-size:12.5px;color:var(--text-muted)">Yükleniyor…</div></div>`;
  }
  if(!karburOzetListe.length){
    return html + `<div style="font-size:12.5px;color:var(--text-muted)">Henüz hiçbir iş emrine karbür çıkışı yapılmamış.</div></div>`;
  }

  const toplamMm = karburOzetListe.reduce((a, o) => a + (Number(o.mm) || 0), 0);
  const toplamParca = karburOzetListe.reduce((a, o) => a + (Number(o.parca) || 0), 0);
  html += `<div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;margin-bottom:10px">
      <div><span style="display:block;font-size:11px;color:var(--text-muted)">İş emri</span><b>${karburOzetListe.length}</b></div>
      <div><span style="display:block;font-size:11px;color:var(--text-muted)">Toplam parça</span><b>${toplamParca}</b></div>
      <div><span style="display:block;font-size:11px;color:var(--text-muted)">Toplam karbür</span><b>${karburFmt(toplamMm)} mm</b></div>
    </div>
    <table class="tbl"><thead><tr><th>İş Emri</th>
      <th style="text-align:right">Parça</th><th style="text-align:right">mm</th>
      <th>Son plan</th><th>Son hareket</th></tr></thead><tbody>
      ${karburOzetListe.map(o => `<tr><td class="mono">${esc(o.no)}</td>
        <td style="text-align:right"><b>${Number(o.parca) || 0}</b></td>
        <td style="text-align:right">${karburFmt(Number(o.mm) || 0)}</td>
        <td style="font-size:11px;color:var(--text-muted)">${esc(o.sonPlanNo || '—')}</td>
        <td style="font-size:11px;color:var(--text-muted);white-space:nowrap">${karburTarih(o.sonTs)}</td></tr>`).join('')}
    </tbody></table>
  </div>`;
  return html;
}

/* Operatör/yönetici ekranlarında tek satırlık bilgi şeridi: bu iş emrine karbür çıkışı
   yapıldıysa ne kadar ve hangi plandan. Kayıt yoksa hiçbir şey basmaz (gürültü olmasın). */
function karburOzetSerit(isEmriNoRaw){
  if(typeof karburOzetIste !== 'function') return '';
  const base = karburBaseIsEmri(isEmriNoRaw);
  if(!base || base.length < 6) return '';
  const o = karburOzetIste(base);
  if(!o) return '';
  const parcalar = [
    o.mm ? karburFmt(o.mm) + ' mm' : '',
    o.parca ? o.parca + ' parça' : '',
    o.sonPlanNo ? esc(o.sonPlanNo) : ''
  ].filter(Boolean).join(' · ');
  return `<div style="font-size:11.5px;color:var(--gunsonu)">◆ Karbür çıkışı yapıldı${parcalar ? ' · ' + parcalar : ''}</div>`;
}

/* ==================== YAZDIR — A4 YATAY KESİM RAPORU ====================
   Ayrı pencerede yazdırılıyor ki ana sayfanın @media print kuralları ile çakışmasın
   (aynı gerekçe js/toolstock.js:620-632 printToolLabels içinde de yazılı). */
function karburYazdir(){
  const plan = karburComputePlan();
  const w = window.open('', '_blank');
  if(!w){ toast('Açılır pencere engellendi — tarayıcı ayarından izin ver'); return; }
  const tarih = new Date().toLocaleString('tr-TR');
  let body = '';

  const dList = plan.direct.filter(d => d.adet > 0);
  const aList = (plan.adetCikis || []).filter(d => !d.hata);
  if(dList.length || aList.length){
    body += `<h3>1) KESİM YAPILMAYACAKLAR <span class="sub">— doğrudan stoktan verilir</span></h3>
      <table><tr><th>İş Emri</th><th>Stok Kodu</th><th>Kalite</th><th>Boy</th><th>Adet</th><th>Not</th></tr>
      ${dList.map(d=>`<tr><td>${esc(d.isEmri||'')}</td><td>${esc(d.item.kod)}</td><td>${esc(d.item.kalite)}</td>
        <td>${karburFmt(d.boy)} mm</td><td>${d.adet}</td><td>standart boy — kesim yok</td></tr>`).join('')}
      ${aList.map(d=>`<tr><td>${esc(d.isEmri||'')}</td><td>${esc(d.item.kod)}</td><td>${esc(d.item.kalite)}</td>
        <td>${d.item.boy ? karburFmt(d.item.boy) + ' mm' : '—'}</td><td>${d.adet}</td><td>adet olarak verilir</td></tr>`).join('')}
      </table>`;
  }

  const fireRows = Object.keys(karburAssigns).map(key => {
    const p = karburDemandPiece(key), f = karburFireById(karburAssigns[key]);
    if(!p || !f) return '';
    const tam = Math.abs(f.boy - p.boy) < 0.001;
    return `<tr><td>${esc(p.isEmri||'')}</td><td>Ø${karburFmt(f.disCap)} · ${esc(f.kalite)}</td>
      <td>${karburFmt(f.boy)} mm fire</td>
      <td>${tam ? 'KESİM YOK — doğrudan ver' : 'kes → ' + karburFmt(p.boy + karburPay) + ' mm'}</td>
      <td>${tam ? '—' : karburFmt(f.boy - p.boy - karburPay) + ' mm kalır'}</td></tr>`;
  }).join('');
  if(fireRows){
    body += `<h3>2) FİREDEN KARŞILANANLAR <span class="sub">— artık parçadan</span></h3>
      <table><tr><th>İş Emri</th><th>Malzeme</th><th>Kaynak</th><th>İşlem</th><th>Kalan</th></tr>${fireRows}</table>`;
  }

  const groups = plan.cut.filter(g => g.secili && g.secili.cubuk > 0);
  if(groups.length){
    body += `<h3>3) KESİMLİ ÇIKIŞLAR <span class="sub">— çubuktan kesilecek</span></h3>`;
    groups.forEach(g => {
      const s = g.secili;
      const maxCell = s.bars.reduce((m,b)=>Math.max(m, b.pieces.length), 0);
      /* İş emri numarası artık PARÇANIN ALTINDA. Eskiden satır sonunda tek hücrede virgülle
         listeleniyordu; bir çubuğa 5 ayrı iş emrinden parça düşünce o hücre A4'ün sağ kenarını
         taşırıyordu. Parça altına yazmak hem taşmayı bitiriyor hem operatöre daha faydalı:
         hangi parçanın hangi işe gideceği doğrudan görünüyor. Grup altındaki özet satırı ise
         tablo hücresi olmadığı için serbestçe alt satıra sarıyor. */
      /* Sütun sayısı A4 yatayı taşırmasın: bir çubuktan 5'ten fazla parça çıkıyorsa satır
         devam satırlarına bölünür. 20 mm'lik parçalarda 11 sütun oluşup sayfa taşıyordu
         (ölçüldü: +129 px), 10 mm'de +848 px. Bölmek tabloyu daima sayfa içinde tutuyor
         ve fiziksel kesim sırası da korunuyor. */
      const SUTUN = 5;   // 5 parça sütunu = 9 kolon: ölçümle sıfır taşma (6'da sınırda 2 px kalıyordu)
      const sutunSayisi = Math.min(maxCell, SUTUN);
      body += `<h4>${esc(s.item.kod)} — Ø${karburFmt(g.fam.disCap)} · delik ${esc(g.fam.delik)} · ${esc(g.fam.kalite)} · çubuk ${karburFmt(s.item.boy)} mm · ${s.cubuk} adet</h4>
        <table><tr><th>Çubuk</th>${Array.from({length:sutunSayisi},(_,i)=>`<th>${i+1}. PARÇA</th>`).join('')}
        <th>TOPLAM</th><th>ARTIK</th><th>KESİM</th></tr>`;
      s.bars.forEach((b, bi) => {
        for(let off = 0; off < b.pieces.length; off += SUTUN){
          const dilim = b.pieces.slice(off, off + SUTUN);
          const ilk = off === 0;
          body += `<tr><td>${ilk ? '#' + (bi+1) : '<span class="dev">#' + (bi+1) + ' devam</span>'}</td>
            ${dilim.map(p=>`<td class="pc">${karburFmt(p.boy + karburPay)}<span class="ie">${esc(p.isEmri||'—')}</span></td>`).join('')}
            ${Array.from({length:sutunSayisi-dilim.length},()=>'<td></td>').join('')}
            ${ilk ? `<td>${karburFmt(b.used)}</td><td>${karburFmt(b.fire)}</td><td>${b.kesim}</td>`
                  : '<td></td><td></td><td></td>'}</tr>`;
        }
      });
      const grupSayim = {};
      s.bars.forEach(b => b.pieces.forEach(p => {
        const k = p.isEmri || '(iş emri yok)';
        grupSayim[k] = (grupSayim[k] || 0) + 1;
      }));
      body += `</table><div class="ieozet">İş emirleri: ${Object.keys(grupSayim).sort()
        .map(k => `<b>${esc(k)}</b> ${grupSayim[k]} parça`).join(' &nbsp;·&nbsp; ')}</div>`;
    });
  }

  if(!body){ toast('Yazdırılacak çıkış yok'); w.close(); return; }   // adet çıkışları da bölüm 1'de sayılıyor

  w.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Karbür Kesim Raporu</title><style>
    @page{ size:A4 landscape; margin:10mm; }
    body{font:11px/1.35 Arial,sans-serif;color:#000;margin:0}
    .hdr{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:8px}
    .hdr h1{font-size:15px;margin:0}
    h3{font-size:12px;margin:11px 0 3px;background:#e6e6e6;padding:3px 5px;border:1px solid #888}
    h4{font-size:11px;margin:7px 0 2px}
    .sub{font-weight:normal;font-size:10px}
    table{border-collapse:collapse;width:100%;margin-bottom:6px}
    th,td{border:1px solid #666;padding:3px 5px;text-align:left}
    th{background:#f2f2f2;font-size:10px}
    td.pc{font-weight:bold;background:#f8f8f8;white-space:nowrap}
    td.pc .ie{display:block;font-weight:normal;font-size:8.5px;color:#333;letter-spacing:-.2px}
    .ieozet{font-size:10px;margin:-3px 0 8px;line-height:1.5}
    td .dev{font-size:9px;color:#555}
    tr{break-inside:avoid}
    .ft{margin-top:10px;font-size:10px;color:#555}
  </style></head><body>
    <div class="hdr"><h1>KARBÜR ÇIKIŞ / KESİM RAPORU</h1><div>${karburPlanNo ? '<b>Plan No: ' + esc(karburPlanNo) + '</b> &nbsp;|&nbsp; ' : ''}Pay: ${karburFmt(karburPay)} mm &nbsp;|&nbsp; ${tarih}</div></div>
    ${body}
    <div class="ft">Yazdırma penceresi açılmadıysa Ctrl+P ile yazdırabilirsin.</div>
  </body></html>`);
  w.document.close();
  setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 250);
}
/* ==================== UI: KARBÜR — SON ==================== */
