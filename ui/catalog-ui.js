/* ===================== UI: KATALOG / MALZEME / ANALİZ YARDIMCI GÖRÜNÜMLERİ =====================
   js/catalog.js'ten ayrıldı -- iş mantığı orada kaldı, sadece render* fonksiyonları burada. */
function renderResimAramaModal(){
  const resimUzantilar = ['.jpg','.jpeg','.png','.bmp','.gif'];
  return `<div class="modal-overlay" onclick="if(event.target===this) closeResimArama()">
    <div class="modal-box" style="max-width:760px">
      <div class="modal-header">
        <div><div class="modal-title">${ico('camera',14)} Resim/Çizim Bul</div><div class="modal-sub mono">${esc(resimAramaOpen)}</div></div>
        <button class="icon-btn" onclick="closeResimArama()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        ${resimAramaHata ? `<div style="color:var(--danger);font-size:13px;padding:24px;text-align:center;line-height:1.6">${esc(resimAramaHata)}</div>`
        : resimAramaSonuclar===null ? `<div style="text-align:center;color:var(--text-muted);padding:30px">Aranıyor…</div>`
        : resimAramaSonuclar.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:30px">Eşleşen dosya bulunamadı.</div>`
        : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">
          ${resimAramaSonuclar.map(d=>{
            const dosyaUrl = `${RESIM_SUNUCU_URL}/dosya?id=${d.id}&anahtar=${encodeURIComponent(RESIM_SUNUCU_ANAHTAR)}`;
            const kategoriIkon = (d.kategori||'').split(' ')[0] || '📄';
            return resimUzantilar.includes(d.uzanti)
              ? `<a href="${dosyaUrl}" target="_blank" style="display:block;border:1px solid var(--border);border-radius:8px;overflow:hidden;text-decoration:none">
                  <img src="${dosyaUrl}" loading="lazy" style="width:100%;height:110px;object-fit:cover;background:var(--panel-alt);display:block">
                  <div style="padding:6px 8px;font-size:10.5px;color:var(--text);word-break:break-all">${esc(d.ad)}</div>
                </a>`
              : `<a href="${dosyaUrl}" target="_blank" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1px solid var(--border);border-radius:8px;padding:14px 8px;text-decoration:none;background:var(--panel-alt);min-height:110px">
                  <span style="font-size:24px">${kategoriIkon}</span>
                  <div style="font-size:10.5px;color:var(--text);text-align:center;word-break:break-all">${esc(d.ad)}</div>
                </a>`;
          }).join('')}
        </div>`}
      </div>
    </div>
  </div>`;
}

function renderMalzemeAramaModal(){
  const results = malzemeAramaQuery ? malzemeListesiArray().filter(m=>malzemeLikeMatch(m.kod,malzemeAramaQuery)||malzemeLikeMatch(m.aciklama,malzemeAramaQuery)).slice(0,200) : [];
  return `<div class="modal-overlay" onclick="if(event.target===this) closeMalzemeArama()">
    <div class="modal-box" style="max-width:640px">
      <div class="modal-header">
        <div><div class="modal-title" style="font-size:18px">${ico('search',14)} Malzeme Ara</div><div class="modal-sub">${malzemeListesiArray().length} kayıtlı malzeme · Kelimeleri boşlukla ayırarak yaz (sıra önemli değil) — Canias alışkanlığın varsa %joker% da kullanabilirsin</div></div>
        <button class="icon-btn" onclick="closeMalzemeArama()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <input id="malzeme-arama-input" class="mono" placeholder="ör. m6x50 ara  (ya da Canias tarzı %m6x50%ara%)" value="${esc(malzemeAramaQuery)}" oninput="setMalzemeAramaQuery(this.value)" autofocus style="margin-bottom:14px">
        ${malzemeListesiArray().length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:30px 0">Henüz malzeme listesi yüklenmemiş. SuperAdmin, Ayarlar → Malzeme Listesi'nden Excel yükleyebilir.</div>`
          : !malzemeAramaQuery ? `<div style="text-align:center;color:var(--text-muted);padding:30px 0">Aramaya başlamak için yukarı yaz.</div>`
          : results.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:30px 0">Eşleşme bulunamadı.</div>`
          : `<div style="max-height:50vh;overflow-y:auto">
            ${results.map(m=>`
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--panel-alt);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:6px;cursor:pointer" onclick="pickMalzeme('${escJs(m.kod)}', '${escJs(m.aciklama)}')">
                <div><span class="mono" style="color:var(--accent);font-weight:700">${esc(m.kod)}</span><div style="font-size:12.5px;color:var(--text-muted)">${esc(m.aciklama)}</div></div>
                <span style="font-size:11.5px;color:var(--success)">Seç →</span>
              </div>
            `).join('')}
            ${results.length===200 ? `<div style="font-size:11.5px;color:var(--text-muted);text-align:center;padding-top:6px">İlk 200 sonuç gösteriliyor — daha spesifik yaz.</div>` : ''}
          </div>`}
      </div>
    </div>
  </div>`;
}

// Bir günün 24 saatlik zaman çizelgesinde (Gantt), verilen kayıtları saat bazlı segmentler
// olarak çizen ORTAK fonksiyon — Makine Gantt'ı (analizSubTab==='genel') ve Kişi Gantt'ı
// (analizSubTab==='kisi') birbirinden bağımsız aynı çizim mantığını tekrarlamasın diye tek
// yerden. Her segment kendi içinde çalışma (yeşil) / duruş (sarı) / Gün Sonu (koyu gri)
// oranına göre renkleniyor; segmentin OLMADIĞI boşluklar track'in kendi arka planıyla
// (var(--panel-alt)) otomatik olarak "boşta" gibi görünür, ayrıca renklendirmeye gerek yok.
function renderGanttSegmentsHtml(entries, dayStartMs, rangeEndMs, titleFn){
  return entries.map(e=>{
    const endClip = Math.min(e.endTs || nowTick, rangeEndMs);
    const segStart = Math.max(e.startTs, dayStartMs);
    const segEndForSeg = Math.min(endClip, dayStartMs+86400000);
    if(segEndForSeg <= segStart) return '';
    const startMin = Math.max(0, (segStart - dayStartMs)/60000);
    const durMin = Math.max(1,(segEndForSeg - segStart)/60000);
    const leftPct = Math.max(0,(startMin/1440)*100);
    const widthPct = Math.min(100-leftPct,(durMin/1440)*100);
    const totalMs = Math.max(0, segEndForSeg - segStart);
    // GÜNE ORANTILI PAYLAŞIM (bkz. computeAnalizData'daki aynı düzeltme): durusLog/excludedLog
    // (zaman damgalı, gerçek olaylar) varsa segmentle kesişimi doğrudan hesaplıyoruz — bu zaten
    // doğru. Ama log'u OLMAYAN eski kayıtlarda entryDurusEvents tek bir kümülatif "olayı" kaydın
    // BAŞLANGICINA iğneliyor; kayıt bugünden önce başlamışsa bu iğne bugünün penceresiyle hiç
    // kesişmiyor ve dünden kalan, aslında duruşta geçmiş bir iş segmenti sanki tam verimli
    // çalışmış gibi TAMAMEN YEŞİL görünüyordu. Log yoksa toplamı, kaydın bilinen toplam süresi
    // içindeki bu günün payına göre ORANTILI bölüyoruz.
    const hasLoggedEvents = (Array.isArray(e.durusLog) && e.durusLog.length>0) || (Array.isArray(e.excludedLog) && e.excludedLog.length>0);
    let durusMs, exclMs;
    if(hasLoggedEvents){
      durusMs = entryDurusEvents(e).reduce((s,ev)=>s+msOverlap(ev.ts, ev.sureMs, segStart, segEndForSeg), 0);
      exclMs = entryExcludedEvents(e).reduce((s,ev)=>s+msOverlap(ev.ts, ev.sureMs, segStart, segEndForSeg), 0);
    } else {
      const entryTotalMs = Math.max(1, endClip - e.startTs);
      const share = totalMs / entryTotalMs;
      durusMs = Math.min(totalMs, (e.duruşToplamMs||0) * share);
      exclMs = Math.min(Math.max(0, totalMs - durusMs), (e.excludedMs||0) * share);
      if(e.status==='duruş' && e.duruşTs){
        const liveExtra = msOverlap(e.duruşTs, Math.max(0, nowTick - e.duruşTs), segStart, segEndForSeg);
        if(e.duruşNedeni===GUN_SONU_REASON) exclMs = Math.min(Math.max(0, totalMs-durusMs), exclMs+liveExtra);
        else durusMs = Math.min(totalMs, durusMs+liveExtra);
      }
    }
    const workMs = Math.max(0, totalMs - durusMs - exclMs);
    const workPct = totalMs>0 ? Math.round(workMs/totalMs*100) : 0;
    const durusPct = totalMs>0 ? Math.round(durusMs/totalMs*100) : 0;
    const exclPct = Math.max(0, 100-workPct-durusPct);
    let bg;
    if(exclPct>=99) bg = '#3a4148';
    else if(workPct>=99) bg = 'var(--success)';
    else if(durusPct>=99) bg = 'var(--warn)';
    else bg = `linear-gradient(to right, var(--success) 0%, var(--success) ${workPct}%, var(--warn) ${workPct}%, var(--warn) ${workPct+durusPct}%, #3a4148 ${workPct+durusPct}%, #3a4148 100%)`;
    const titleTxt = titleFn ? titleFn(e) : `${e.isEmriNo||e.talepNo||''} · ${e.makine||''}`;
    return `<div class="analiz-gantt-seg" style="left:${leftPct}%;width:${widthPct}%;background:${bg}" title="${esc(titleTxt)} · ${fmtDT(e.startTs)}–${e.endTs?fmtDT(e.endTs):'şu an'}"></div>`;
  }).join('');
}

function renderDurusBreakdown(entries){
  const byReason = {};
  collectDurusEvents(entries).forEach(ev=>{
    if(!Number.isFinite(ev.sureMs) || ev.sureMs<=0) return; // NaN/undefined güvenli — eski/bozuk bir kayıt varsa sessizce atla, "NaN sa NaN dk" göstermesin
    byReason[ev.neden] = (byReason[ev.neden]||0) + ev.sureMs;
  });
  const rows = Object.entries(byReason).sort((a,b)=>b[1]-a[1]);
  if(rows.length===0) return '';
  return `<div style="margin-bottom:16px">
    <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Duruş Nedenlerine Göre Dağılım</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${rows.map(([reason,ms])=>`<div class="chip" style="color:var(--warn);border-color:var(--warn-border);background:var(--warn-soft)">${esc(reason)}: <b>${fmtDur(ms)}</b></div>`).join('')}
    </div>
  </div>`;
}

