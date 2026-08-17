/* ===================== RENDER: ADMİN ===================== */
// U kodunun altına, listede eşleşen malzeme adını (varsa) küçük gri yazıyla ekler — hem
// "Tamamlanan Talepler" hem "Bekleyen/Aktif" tablolarında ve akış şeması modalında ortak kullanılıyor.
function uKoduHücresi(uKodu, color){
  const info = getTalepInfo(uKodu);
  return `<div class="mono" style="color:${color||'var(--accent)'};font-weight:600">${esc(uKodu)}</div>${info?.malzemeAdi?`<div style="font-size:10.5px;color:var(--text-muted);font-family:'Inter',sans-serif;font-weight:400">${esc(info.malzemeAdi)}</div>`:''}`;
}
// "Tamamlanan Talepler" tablosu birden fazla yerde (renderAnalizTadilat — hem Analiz sekmesindeki
// "Tadilat" görünümü hem Tadilat sekmesinin kendi "Analiz" alt sekmesi buradan besleniyor) aynı
// şekilde kullanılıyor — tek yerden değiştirilsin diye ayrı fonksiyon. Satıra tıklamak akış
// şemasını açar (bkz. renderTadilatAkisModal); ayrı bir "Detay" butonuna gerek yok.
function renderTamamlananTalepTablosu(tamamlananlar){
  // Excel butonu bir onclick metni olduğu için diziyi doğrudan geçemiyoruz; o an EKRANDA
  // gösterilen (filtrelenmiş olabilen) listeyi burada saklayıp dışa aktarımın onu kullanmasını
  // sağlıyoruz — yoksa ekranda 12 kayıt görünürken Excel'e 400 kayıt iniyordu.
  lastTamamlananTalepListesi = tamamlananlar;
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:10px;flex-wrap:wrap">
    <div style="font-size:11.5px;color:var(--text-muted)">"Bekleme": açılış→başlama · "İşlem Süresi": başlama→bitiş (duvar saati) · "Toplam Süre": açılış→bitiş. Satıra tıkla, adım adım akışı gör.</div>
    ${tamamlananlar.length>0 ? `<button class="btn-primary" style="width:auto;padding:7px 14px;font-size:12px;flex-shrink:0" onclick="exportTadilatExcel(lastTamamlananTalepListesi)">⬇ Excel'e Aktar</button>` : ''}
  </div>
  <div class="table-wrap"><table><thead><tr><th>U Kodu</th><th>İşlem</th><th>Açılış</th><th>Başlama</th><th>Bekleme</th><th>Bitiş</th><th>İşlem Süresi</th><th>Toplam Süre</th></tr></thead><tbody>
    ${tamamlananlar.length===0 ? `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:16px">Henüz tamamlanan yok.</td></tr>` : tamamlananlar.map(t=>{
      const ops = tadilatOperasyonlarArray(t);
      const ilkOp = ops[0];
      const sonBitis = ops[ops.length-1]?.bitisTs;
      const ilkBaslangic = ilkOp?.baslamaTs;
      const beklemeMs = (t.olusturmaTs && ilkBaslangic) ? Math.max(0, ilkBaslangic - t.olusturmaTs) : null;
      const islemSureMs = (ilkBaslangic && sonBitis) ? Math.max(0, sonBitis - ilkBaslangic) : null;
      const toplamSureMs = (t.olusturmaTs && sonBitis) ? Math.max(0, sonBitis - t.olusturmaTs) : null;
      return `<tr style="cursor:pointer" onclick="openTadilatAkis('${t.id}')">
        <td>${uKoduHücresi(t.uKodu)}</td>
        <td style="font-size:12.5px">${esc(t.aciklama)}</td>
        <td style="font-size:12px">${t.olusturmaTs?fmtDT(t.olusturmaTs):'—'}</td>
        <td style="font-size:12px">${ilkBaslangic?`${fmtDT(ilkBaslangic)}<div style="font-size:10.5px;color:var(--text-muted)">${esc(ilkOp.operatorName||ilkOp.operatorUsername||'')}</div>`:'—'}</td>
        <td style="color:${beklemeMs>0?'var(--warn)':'inherit'}">${beklemeMs!=null?fmtDur(beklemeMs):'—'}${(canViewTadilatBeklemeDetay() && beklemeMs>0) ? ` <button class="btn-ghost" style="padding:2px 8px;font-size:10.5px" title="Bu bekleme süresinde operatör ne yapıyordu?" onclick="event.stopPropagation(); openBeklemeDetay('${t.id}')">${ico('search',11)}</button>` : ''}</td>
        <td style="font-size:12px">${sonBitis?fmtDT(sonBitis):'—'}</td>
        <td>${islemSureMs!=null?fmtDur(islemSureMs):'—'}</td>
        <td style="font-weight:700;color:var(--success)">${toplamSureMs!=null?fmtDur(toplamSureMs):'—'}</td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}
// Bekleyen/duraklatılmış/ara-bekleme/devam eden (henüz TAMAMLANMAMIŞ) talepleri, canlı bekleme
// ve geçen süreyle birlikte listeler. sortByUrgency=true ise en uzun bekleyen/en çok geçen süre
// üstte çıkar. Satıra tıklamak akış şemasını açar.
function renderDevamEdenTalepTablosu(devamEdenler, sortByUrgency){
  const rowsData = devamEdenler.map(t=>{
    const ops = tadilatOperasyonlarArray(t);
    const ilkOp = ops[0];
    const aktifOp = tadilatAktifOperasyon(t);
    const duraklatilmisOp = !aktifOp ? ops.find(o=>o.status==='duruş') : null;
    const durumTxt = aktifOp ? 'Devam Ediyor' : duraklatilmisOp ? 'Duraklatıldı' : ilkOp ? 'Ara Bekleme (devamı bekleniyor)' : 'Bekliyor';
    const durumColor = aktifOp ? 'var(--success)' : duraklatilmisOp ? 'var(--warn)' : 'var(--tadilat-info)';
    const beklemeMs = t.olusturmaTs ? Math.max(0, (ilkOp?.baslamaTs || nowTick) - t.olusturmaTs) : null;
    // DÜZELTME: Eskiden `ilkOp ? ... : null` idi — yani HİÇ OPERASYONU OLMAYAN, tam da "Bekliyor"
    // durumundaki talepler (bu sekmenin asıl konusu) "Geçen Süre" hesabının DIŞINDA kalıyordu:
    // hücrede "—" görünüyor, "en uzun süredir açık" sıralamasında en alta düşüyor ve "En Uzun
    // Süredir Açık" KPI'ı onları hiç görmüyordu. 3 gündür kimsenin almadığı bir talep, 5 dakikadır
    // işlenen bir talebin altında kalıyordu. Artık operasyon yoksa talebin açılışından bu yana
    // geçen süre kullanılıyor.
    const gecenMs = aktifOp ? (nowTick-aktifOp.baslamaTs) : (t.olusturmaTs ? (nowTick-t.olusturmaTs) : null);
    return { t, ilkOp, durumTxt, durumColor, beklemeMs, gecenMs };
  });
  if(sortByUrgency) rowsData.sort((a,b)=>(b.gecenMs||0)-(a.gecenMs||0));
  return `<div class="table-wrap"><table><thead><tr><th>Atölye</th><th>Talep Eden</th><th>U Kodu</th><th>İşlem</th><th>Açılış</th><th>Durum</th><th>Başlama</th><th>Bekleme</th><th>Geçen Süre</th></tr></thead><tbody>
    ${rowsData.length===0 ? `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:16px">Bekleyen/devam eden talep yok.</td></tr>` : rowsData.map(({t,ilkOp,durumTxt,durumColor,beklemeMs,gecenMs})=>`
      <tr style="cursor:pointer" onclick="openTadilatAkis('${t.id}')">
        <td>${(t.atolye||'imalat')==='tadilat'?(ico('wrench',13)+' Tadilat'):(ico('factory',13)+' İmalat')}</td>
        <td style="font-size:12.5px">${esc(t.talepEdenKisi||'—')}</td>
        <td>${uKoduHücresi(t.uKodu)}</td>
        <td style="font-size:12.5px">${esc(t.aciklama)}</td>
        <td style="font-size:12px">${t.olusturmaTs?fmtDT(t.olusturmaTs):'—'}</td>
        <td style="color:${durumColor};font-weight:600;font-size:12.5px">${durumTxt}</td>
        <td style="font-size:12px">${ilkOp?.baslamaTs?`${fmtDT(ilkOp.baslamaTs)}<div style="font-size:10.5px;color:var(--text-muted)">${esc(ilkOp.operatorName||ilkOp.operatorUsername||'')}</div>`:'—'}</td>
        <td style="color:${beklemeMs>0?'var(--warn)':'inherit'}">${beklemeMs!=null?fmtDur(beklemeMs):'—'}</td>
        <td style="font-weight:600;color:${gecenMs>=uzunDurusEsikMs()*4?'var(--danger)':'inherit'}">${gecenMs!=null?fmtDur(gecenMs):'—'}</td>
      </tr>
    `).join('')}
  </tbody></table></div>`;
}
/* "Detay" butonuyla açılan iş akışı şeması — İş Açıldı → (Operasyon Başladı → Operasyon Bitti)*
   → Toplam Süre. Çok operasyonlu (ara bekleme geçirmiş) talepler zincire ekstra kutu olarak
   ekleniyor; tek operasyonlu, doğrudan biten sıradan bir talepte tam olarak istenen üç kutu
   (İş Açıldı / İşe Başlandı / İş Bitti) çıkıyor. */
// İş akışı şeması (İş Açıldı → Başladı → Bitti tarzı) için ortak kutu/ok çizim yardımcıları —
// hem Tadilat akış şeması (renderTadilatAkisModal) hem normal İş Emri akış şeması
// (renderEntryAkisChain, bkz. render-common.js) AYNI görseli kullanıyor.
function akisNodeHtml(title, color, tarihSaat, topLabel, bottomLabel){
  return `
    <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:220px">
      <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:8px;text-align:center;min-height:16px">${topLabel||''}</div>
      <div style="background:var(--panel-alt);border:2px solid ${color};border-radius:14px;padding:16px 18px;text-align:center;width:100%">
        <div style="font-size:12.5px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.4px">${title}</div>
        <div class="mono" style="font-size:15px;font-weight:600;margin-top:6px">${tarihSaat||'—'}</div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px;text-align:center;min-height:16px;max-width:210px">${bottomLabel||''}</div>
    </div>`;
}
function akisConnectorHtml(label, color){
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;width:110px;padding-top:26px;gap:5px">
      <div style="font-size:11.5px;font-weight:700;color:${color};white-space:nowrap">${label}</div>
      <div style="width:100%;height:2px;background:${color};position:relative">
        <div style="position:absolute;right:-1px;top:-4px;width:0;height:0;border-left:8px solid ${color};border-top:5px solid transparent;border-bottom:5px solid transparent"></div>
      </div>
    </div>`;
}
function renderTadilatAkisModal(){
  const t = tadilatlar[tadilatAkisModalId];
  if(!t){ tadilatAkisModalId = null; return ''; }
  const ops = tadilatOperasyonlarArray(t);
  const tamamlandi = tadilatTamamlandiMi(t);
  const node = akisNodeHtml, connector = akisConnectorHtml;

  const chain = [];
  chain.push(node('İş Açıldı', 'var(--accent)', t.olusturmaTs?fmtDT(t.olusturmaTs):'—', esc(t.talepEdenKisi||'—'), esc(t.aciklama||'')));
  ops.forEach((o,i)=>{
    const beklemeOncekindenMs = i===0
      ? (t.olusturmaTs && o.baslamaTs ? Math.max(0, o.baslamaTs - t.olusturmaTs) : null)
      : (ops[i-1].bitisTs && o.baslamaTs ? Math.max(0, o.baslamaTs - ops[i-1].bitisTs) : null);
    chain.push(connector(beklemeOncekindenMs!=null ? `${fmtDur(beklemeOncekindenMs)} bekledi` : '—', i===0?'var(--warn)':'var(--gunsonu)'));
    chain.push(node(ops.length>1?`${i+1}. Operasyon Başladı`:'İşe Başlandı', 'var(--tadilat-info)', o.baslamaTs?fmtDT(o.baslamaTs):'—', `${esc(o.operatorName||o.operatorUsername||'—')}`, o.makine?esc(o.makine.split(' · ')[0]):''));
    if(o.bitisTs){
      const islemMs = (o.baslamaTs && o.bitisTs) ? Math.max(0, o.bitisTs-o.baslamaTs) : null;
      chain.push(connector(islemMs!=null?fmtDur(islemMs):'—', 'var(--success)'));
      const sonMu = i===ops.length-1 && o.sonOperasyon;
      chain.push(node(sonMu?'İş Bitti':'Operasyon Bitti', sonMu?'var(--success)':'var(--text-muted)', fmtDT(o.bitisTs), '', sonMu?'':'devamı bekleniyor'));
    }
  });
  const sonBitis = ops[ops.length-1]?.bitisTs;
  const toplamSureMs = (t.olusturmaTs && sonBitis) ? Math.max(0, sonBitis - t.olusturmaTs) : null;

  const malzemeAdi = getTalepInfo(t.uKodu)?.malzemeAdi;
  return `<div class="modal-overlay" onclick="if(event.target===this) closeTadilatAkis()">
    <div class="modal-box" style="max-width:min(98vw,1600px);width:98vw">
      <div class="modal-header">
        <div><div class="modal-title">${ico('wrench',16)} ${esc(t.uKodu)}${malzemeAdi?` <span style="color:var(--text-muted);font-weight:400;font-size:.7em">${esc(malzemeAdi)}</span>`:''}</div><div class="modal-sub">${esc(t.aciklama||'')}${t.bolum?` · ${esc(t.bolum)}`:''}${t.adet?` · Adet: ${esc(t.adet)}`:''}</div></div>
        <button class="icon-btn" onclick="closeTadilatAkis()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;align-items:flex-start;gap:0;overflow-x:auto;padding:14px 4px 24px">${chain.join('')}</div>
        ${toplamSureMs!=null ? `<div style="display:flex;align-items:center;justify-content:center;gap:10px;background:var(--success-row);border:1px solid var(--success);border-radius:10px;padding:14px 18px;margin-top:6px">
          <span style="font-size:14px;font-weight:600;color:var(--success)">Toplam Süre (Açılış → Bitiş)</span>
          <span class="mono" style="font-size:20px;font-weight:700;color:var(--success)">${fmtDur(toplamSureMs)}</span>
        </div>` : `<div style="text-align:center;color:var(--text-muted);font-size:12.5px;padding:8px 0">${tamamlandi?'':'Bu talep henüz tamamlanmadı — toplam süre kapanınca hesaplanır.'}</div>`}
      </div>
    </div>
  </div>`;
}
/* Analiz sekmesi — "Atölye Şefi" görünümü: geçmiş bir aralık değil, ŞU AN atölyede ne olduğunu
   gösteren canlı bir pano (canlı makine sayaçları, uzun süredir duruşta olanlar, bugünün duruş
   nedenleri, bugünkü operatör yükü). Fason makineler diğer analiz ekranlarıyla tutarlı olsun
   diye burada da hariç tutuluyor (bkz. computeAnalizData'daki aynı filtre). */
function renderAnalizSefLive(){
  const liveEntries = [...entriesArray(), ...buildTadilatSynthetic()].filter(e=>!isFasonMachine(e.makine));
  const liveMachines = allMachines().filter(m=>!isFasonMachine(m.code));
  let calisiyor=0, durusta=0, gunsonu=0, bosta=0;
  liveMachines.forEach(m=>{
    const label = `${m.code} · ${m.name}`;
    const tadilatHere = tadilatAktifOnMachine(label);
    const machineEntries = liveEntries.filter(e=>e.makine===label);
    const running = !tadilatHere && machineEntries.some(e=>e.status==='devam');
    const stoppedEntries = machineEntries.filter(e=>e.status==='duruş');
    const stopped = !tadilatHere && !running && stoppedEntries.length>0;
    if(tadilatHere || running) calisiyor++;
    else if(stopped){ (stoppedEntries.every(e=>e.duruşNedeni===GUN_SONU_REASON) ? gunsonu++ : durusta++); }
    else bosta++;
  });
  const uzun = uzunDurusluKayitlar();
  const esikDk = Math.round(uzunDurusEsikMs()/60000);

  const bugun = dateKey(Date.now());
  const dayStartMs = new Date(bugun+'T00:00:00').getTime(), dayEndMs = dayStartMs+86400000;
  const bugunEntries = liveEntries.filter(e => e.startTs < dayEndMs && (e.endTs||nowTick) >= dayStartMs);
  const bugunDurusAgg = {};
  collectDurusEvents(bugunEntries).forEach(ev=>{
    if(ev.neden===GUN_SONU_REASON || !Number.isFinite(ev.sureMs) || ev.sureMs<=0) return;
    const overlap = msOverlap(ev.ts, ev.sureMs, dayStartMs, dayEndMs);
    if(overlap<=0) return;
    (bugunDurusAgg[ev.neden] ||= { ms:0, count:0 });
    bugunDurusAgg[ev.neden].ms += overlap; bugunDurusAgg[ev.neden].count++;
  });
  const bugunList = Object.entries(bugunDurusAgg).map(([neden,v])=>({neden, ms:v.ms, count:v.count})).sort((a,b)=>b.ms-a.ms);
  const bugunMax = Math.max(...bugunList.map(x=>x.ms), 1);

  const todayData = computeAnalizData(bugun, bugun, 'tumu');
  const opLoad = todayData.perOperator.slice(0,10);
  const opMax = Math.max(...opLoad.map(o=>o.workMin+o.durusMin+o.overtimeMin), 1);

  const counter = (label, value, color) => `<div class="analiz-chart-box" style="display:flex;align-items:center;gap:12px">
    <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></span>
    <div><div class="mono" style="font-size:26px;font-weight:700;color:${color}">${value}</div><div style="font-size:11px;color:var(--text-muted)">${label}</div></div>
  </div>`;

  return `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px">
      ${counter('Çalışıyor', calisiyor, 'var(--success)')}
      ${counter('Duruşta', durusta, 'var(--warn)')}
      ${counter('Gün Sonu Bekliyor', gunsonu, 'var(--gunsonu)')}
      ${counter('Boşta', bosta, 'var(--text-muted)')}
    </div>
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;margin-bottom:14px">
      <div class="analiz-chart-box">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:14.5px;font-weight:700;color:var(--danger)">${ico('alert',14)} Uzun Süredir Duruşta</div>
          <span class="mono" style="font-size:12px;color:var(--danger)">${uzun.length} kayıt · eşik ${esikDk} dk</span>
        </div>
        ${uzun.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px;padding:14px 0">Eşiği aşan duruş yok.</div>` : `
        <div class="table-wrap" style="padding:0"><table><thead><tr><th>Makine</th><th>İş Emri</th><th>Operatör</th><th>Neden</th><th style="text-align:right">Süre</th></tr></thead><tbody>
          ${uzun.slice(0,12).map(u=>`<tr><td class="mono" style="color:var(--accent)">${esc((u.makine||'').split(' · ')[0]||'—')}</td><td class="mono">${esc(u.isEmriNo||'—')}</td><td>${esc(u.operatorName||u.operatorUsername||'—')}</td><td style="color:var(--warn)">${esc(u.neden||'—')}</td><td class="mono" style="text-align:right;font-weight:700;color:var(--danger)">${fmtDur(u.ms)}</td></tr>`).join('')}
        </tbody></table></div>`}
      </div>
      <div class="analiz-chart-box">
        <div style="font-size:14.5px;font-weight:700;margin-bottom:10px">Bugünün Duruş Nedenleri</div>
        ${bugunList.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px">Bugün hiç duruş kaydı yok.</div>` : bugunList.map((b,i)=>`
          <div style="display:grid;grid-template-columns:1fr 74px;align-items:center;gap:10px;padding:6px 0">
            <div>
              <div style="font-size:12.5px;margin-bottom:4px">${esc(b.neden)}</div>
              <div style="height:9px;background:var(--panel-alt);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.round(b.ms/bugunMax*100)}%;background:${i===0?'var(--danger)':i<3?'var(--warn)':'var(--border)'};border-radius:3px"></div></div>
            </div>
            <div style="text-align:right">
              <div class="mono" style="font-size:12.5px;font-weight:700">${fmtDur(b.ms)}</div>
              <div style="font-size:10px;color:var(--text-muted)">${b.count} olay</div>
            </div>
          </div>`).join('')}
      </div>
    </div>
    <div class="analiz-chart-box">
      <div style="font-size:14.5px;font-weight:700;margin-bottom:2px">Bugünkü Operatör Yükü</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Net çalışma, duruş ve fazla mesai — bugün</div>
      ${opLoad.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px">Bugün kayıt yok.</div>` : opLoad.map(o=>`
        <div style="display:grid;grid-template-columns:170px 1fr 110px;align-items:center;gap:12px;padding:6px 0">
          <div><div style="font-size:12.5px;font-weight:600">${esc(o.operatorName||o.operatorUsername)}</div><div class="mono" style="font-size:10.5px;color:var(--text-muted)">${esc(o.operatorUsername)} · ${o.machineCount} makine</div></div>
          <div style="display:flex;height:13px;border-radius:3px;overflow:hidden;background:var(--panel-alt)">
            <div style="width:${Math.round(o.workMin/opMax*100)}%;background:var(--success)"></div>
            <div style="width:${Math.round(o.durusMin/opMax*100)}%;background:var(--warn)"></div>
            <div style="width:${Math.round(o.overtimeMin/opMax*100)}%;background:var(--accent)"></div>
          </div>
          <div style="text-align:right" class="mono"><div style="font-size:12px">${fmtDur(o.workMin*60000)}</div>${o.overtimeMin>0?`<div style="font-size:10.5px;color:var(--accent)">+${fmtDur(o.overtimeMin*60000)} mesai</div>`:''}</div>
        </div>`).join('')}
    </div>
  `;
}
/* Analiz sekmesi — "Kişi Bazlı" görünümü: TEK bir gün için tüm operatörlerin saatlik
   çizelgesini (Gantt) yan yana gösterir, birine tıklayınca altta o kişinin o günkü saat saat
   dökümü açılır. computeAnalizData(gün,gün,'tumu') zaten günlük perOperator[].days[0].entries
   içinde ham kayıtları verdiği için renderGanttSegmentsHtml (aynı fonksiyon eski "Kişi Bazlı
   Analiz" alt sekmesinde de kullanılıyor) doğrudan yeniden kullanılabiliyor. */
function renderAnalizKisiBazli(){
  const dt = new Date(); dt.setHours(12,0,0,0); dt.setDate(dt.getDate()-analizKisiGun);
  const dayKey = dateKey(dt.getTime());
  const dayData = computeAnalizData(dayKey, dayKey, 'tumu');
  const rows = dayData.perOperator;
  if(analizKisiSecili && !rows.some(o=>o.operatorUsername===analizKisiSecili)) analizKisiSecili = null;
  if(!analizKisiSecili && rows.length>0) analizKisiSecili = rows[0].operatorUsername;

  const gunChips = [0,1,2,3,4,5,6].map(o=>{
    const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-o);
    const label = o===0 ? 'Bugün' : d.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit'});
    return `<button class="chip ${analizKisiGun===o?'active':''}" onclick="setAnalizKisiGun(${o})">${esc(label)}</button>`;
  }).join('');
  const dayLabel = dt.toLocaleDateString('tr-TR',{day:'2-digit',month:'long',weekday:'long'});

  let html = `<div class="analiz-chart-box" style="margin-bottom:14px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <div><div style="font-size:14.5px;font-weight:700">Operatör Gün Çizelgesi</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">${esc(dayLabel)} · satıra tıklayınca altta saat saat dökümü açılır</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${gunChips}</div>
    </div>`;
  if(rows.length===0){
    return html + `<div style="color:var(--text-muted);padding:30px 0;text-align:center">Bu günde kayıt yok.</div></div>`;
  }
  html += `<div class="analiz-kisi-axis" style="display:flex;gap:12px;padding:0 0 4px 162px">
      ${[0,2,4,6,8,10,12,14,16,18,20,22].map(h=>`<span style="position:relative;left:${(h*60/1440)*100}%;font-size:10px;color:var(--text-muted)">${String(h).padStart(2,'0')}:00</span>`).join('')}
    </div>`;
  rows.forEach(op=>{
    const d0 = op.days[0];
    const verim = (d0.workMin+d0.durusMin)>0 ? Math.round(d0.workMin/(d0.workMin+d0.durusMin)*100) : 0;
    const selected = analizKisiSecili===op.operatorUsername;
    const segs = renderGanttSegmentsHtml(d0.entries||[], dayData.dayStartMs, dayData.dayStartMs+86400000, e=>`${e.isEmriNo||e.talepNo||''} · ${e.makine||''}`);
    html += `<div style="display:flex;align-items:center;gap:12px;padding:7px 6px;margin:0 -6px 4px;border-radius:8px;cursor:pointer;background:${selected?'var(--panel-alt)':'transparent'}" onclick="selectAnalizKisi('${escJs(op.operatorUsername)}')">
      <div class="analiz-kisi-name" style="width:150px;flex-shrink:0">
        <div style="font-size:12.5px;font-weight:600">${esc(op.operatorName||op.operatorUsername)}</div>
        <div class="mono" style="font-size:10.5px;color:var(--text-muted)">${esc(op.operatorUsername)}</div>
      </div>
      <div class="analiz-gantt-track" style="flex:1;height:30px">${segs}<div class="analiz-gantt-cutoff" style="left:${(WORKDAY_END_MINUTE/1440)*100}%"></div></div>
      <div class="analiz-kisi-info" style="width:140px;flex-shrink:0;text-align:right">
        <div style="font-size:11px;color:var(--text-muted)">${fmtDur(d0.workMin*60000)} · ${fmtDur(d0.durusMin*60000)}</div>
        <div class="mono" style="font-size:12.5px;font-weight:700;color:${verim>=70?'var(--success)':verim>=40?'var(--warn)':'var(--danger)'}">%${verim}</div>
      </div>
    </div>`;
  });
  html += `<div style="display:flex;gap:18px;margin-top:10px;padding-top:12px;border-top:1px solid var(--border);font-size:11.5px;color:var(--text-muted)">
    <span style="display:flex;align-items:center;gap:6px"><i style="width:9px;height:9px;border-radius:2px;background:var(--success);display:inline-block"></i>Çalışma</span>
    <span style="display:flex;align-items:center;gap:6px"><i style="width:9px;height:9px;border-radius:2px;background:var(--warn);display:inline-block"></i>Duruş</span>
    <span style="margin-left:auto">Mesai bitişi ${String(Math.floor(WORKDAY_END_MINUTE/60)).padStart(2,'0')}:${String(WORKDAY_END_MINUTE%60).padStart(2,'0')} · sonrası fazla mesai sayılır</span>
  </div></div>`;

  const sec = rows.find(o=>o.operatorUsername===analizKisiSecili);
  if(sec){
    const d0 = sec.days[0];
    const entriesSorted = (d0.entries||[]).slice().sort((a,b)=>a.startTs-b.startTs);
    html += `<div style="display:grid;grid-template-columns:1fr 320px;gap:14px">
      <div class="analiz-chart-box">
        <div style="display:flex;align-items:baseline;gap:10px"><div style="font-size:14.5px;font-weight:700">${esc(sec.operatorName||sec.operatorUsername)}</div><div class="mono" style="font-size:11.5px;color:var(--text-muted)">${esc(sec.operatorUsername)}</div></div>
        <div style="font-size:11px;color:var(--text-muted);margin:2px 0 14px">${esc(dayLabel)} · saat saat hareket dökümü</div>
        ${entriesSorted.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px">Bu günde kaydı yok.</div>` : entriesSorted.map(e=>{
          const baslangic = fmtDT(e.startTs).split(' ').pop();
          const bitis = e.endTs ? fmtDT(e.endTs).split(' ').pop() : (e.status==='devam'?'devam ediyor':'—');
          return `<div style="display:grid;grid-template-columns:110px 1fr 90px;align-items:center;gap:14px;padding:10px 0;border-top:1px solid var(--border)">
            <div class="mono" style="font-size:12.5px;font-weight:600">${esc(baslangic)} – ${esc(bitis)}</div>
            <div>
              <div style="font-size:12.5px">${esc(e.talepNo||e.isEmriNo||'—')}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px"><span class="mono" style="color:var(--accent)">${esc((e.makine||'').split(' · ')[0]||'')}</span> ${esc((e.makine||'').split(' · ')[1]||'')}</div>
            </div>
            <div style="text-align:right;font-size:11px;color:${e.status==='duruş'?'var(--warn)':e.status==='tamamlandi'?'var(--success)':'var(--text-muted)'}">${e.status==='duruş'?'Duruşta':e.status==='tamamlandi'?'Tamamlandı':'Devam'}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="analiz-chart-box" style="align-self:start">
        <div style="font-size:14.5px;font-weight:700;margin-bottom:8px">Gün Özeti</div>
        ${[
          { label:'Net çalışma', value:fmtDur(d0.workMin*60000), color:'var(--success)' },
          { label:'Duruş', value:fmtDur(d0.durusMin*60000), color:'var(--warn)' },
          { label:'Fazla mesai', value: d0.overtimeMin>0 ? fmtDur(d0.overtimeMin*60000) : '—', color:'var(--accent)' },
          { label:'Makine sayısı', value:String(d0.machines.length), color:'var(--text)' }
        ].map(o=>`<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--border)"><span style="font-size:12.5px;color:var(--text-muted)">${o.label}</span><span class="mono" style="font-size:14px;font-weight:700;color:${o.color}">${o.value}</span></div>`).join('')}
      </div>
    </div>`;
  }
  return html;
}
/* Analiz sekmesi — "Tadilat" görünümü: mevcut tadilat.js altyapısı (tadilatArray,
   tadilatOperasyonlarArray, tadilatTamamlandiMi) ve zaten var olan tablo çizicileri
   (renderDevamEdenTalepTablosu / renderTamamlananTalepTablosu — bkz. dosyanın başı) üzerine
   kurulu, sadece KPI özetiyle sarmalanmış bir görünüm. Ayrı bir veri modeli icat edilmedi. */
function renderAnalizTadilat(){
  const q = tadilatAnalizArama.trim().toLowerCase();
  const matchesFilter = (t) => {
    if(tadilatAnalizAtolyeFilter!=='tumu' && (t.atolye||'imalat')!==tadilatAnalizAtolyeFilter) return false;
    if(!q) return true;
    const malzemeAdi = getTalepInfo(t.uKodu)?.malzemeAdi || '';
    return `${t.uKodu} ${t.aciklama} ${malzemeAdi} ${t.talepEdenKisi||''}`.toLowerCase().includes(q);
  };
  const all = tadilatArray().filter(matchesFilter);
  const devamEdenler = all.filter(t=>!tadilatTamamlandiMi(t));
  const tamamlananlar = all.filter(t=>tadilatTamamlandiMi(t)).sort((a,b)=>{
    const aOps=tadilatOperasyonlarArray(a), bOps=tadilatOperasyonlarArray(b);
    return (bOps[bOps.length-1]?.bitisTs||0) - (aOps[aOps.length-1]?.bitisTs||0);
  });
  const durumCounts = { bekliyor:0, uretimde:0, duraklatildi:0, ara:0 };
  let enUzunGecenMs = 0;
  devamEdenler.forEach(t=>{
    const ops = tadilatOperasyonlarArray(t);
    const aktifOp = tadilatAktifOperasyon(t);
    const duraklatilmisOp = !aktifOp ? ops.find(o=>o.status==='duruş') : null;
    if(aktifOp) durumCounts.uretimde++;
    else if(duraklatilmisOp) durumCounts.duraklatildi++;
    else if(ops.length>0) durumCounts.ara++;
    else durumCounts.bekliyor++;
    const gecenMs = aktifOp ? (nowTick-aktifOp.baslamaTs) : (t.olusturmaTs ? (nowTick-t.olusturmaTs) : 0);
    if(gecenMs>enUzunGecenMs) enUzunGecenMs = gecenMs;
  });
  const son20 = tamamlananlar.slice(0,20);

  const kpi = (label, value, color, sub) => `<div class="analiz-chart-box">
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;font-weight:600">${label}</div>
    <div class="mono" style="font-size:26px;font-weight:700;margin-top:8px;color:${color}">${value}</div>
    ${sub?`<div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">${sub}</div>`:''}
  </div>`;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:14px">
      ${kpi('Açık Talep', devamEdenler.length, 'var(--accent)', 'toplam işlenmeyi bekleyen')}
      ${kpi('İşlemde', durumCounts.uretimde, 'var(--success)', 'makinede işlem görüyor')}
      ${kpi('Bekliyor / Duraklatıldı', durumCounts.bekliyor+durumCounts.duraklatildi+durumCounts.ara, 'var(--warn)', 'sırada ya da duraklatılmış')}
      ${kpi('En Uzun Süredir Açık', enUzunGecenMs>0?fmtDur(enUzunGecenMs):'—', 'var(--danger)', 'en kritik bekleyen/işlemde')}
    </div>
    <div class="analiz-chart-box" style="margin-bottom:14px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input type="text" placeholder="🔍 U Kodu, malzeme ya da açıklama ara…" value="${esc(tadilatAnalizArama)}" oninput="setTadilatAnalizArama(this.value)" style="flex:1;min-width:220px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="chip ${tadilatAnalizAtolyeFilter==='tumu'?'active':''}" onclick="setTadilatAnalizAtolyeFilter('tumu')">Tümü</button>
          <button class="chip ${tadilatAnalizAtolyeFilter==='imalat'?'active':''}" onclick="setTadilatAnalizAtolyeFilter('imalat')">${ico('factory',14)} İmalat Atölye</button>
          <button class="chip ${tadilatAnalizAtolyeFilter==='tadilat'?'active':''}" onclick="setTadilatAnalizAtolyeFilter('tadilat')">${ico('wrench',14)} Tadilat Atölye</button>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="analiz-chart-box">
        <div style="font-size:14.5px;font-weight:700;margin-bottom:2px">Bekleyen İşler · Aktif İşler</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">${devamEdenler.length} talep · en uzun süredir açık olan üstte · satıra tıkla</div>
        ${renderDevamEdenTalepTablosu(devamEdenler, true)}
      </div>
      <div class="analiz-chart-box">
        <div style="font-size:14.5px;font-weight:700;margin-bottom:2px">Tamamlanan İşler</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Son ${son20.length} kayıt (toplam ${tamamlananlar.length}) · satıra tıkla</div>
        ${renderTamamlananTalepTablosu(son20)}
      </div>
    </div>
  `;
}
/* Analiz sekmesi — "Saha Ekranı" görünümü: atölyeye asılacak bir TV/kiosk için, uzaktan da
   okunabilecek büyük rakamlarla ÖZET bir pano. Tamamen bugünün gerçek verisiyle (computeAnalizData
   + canlı makine durumları) besleniyor, ayrı bir hesap yok. */
function renderAnalizSaha(){
  const bugun = dateKey(Date.now());
  const todayData = computeAnalizData(bugun, bugun, 'tumu');
  const t = todayData.totals;
  const liveEntries = [...entriesArray(), ...buildTadilatSynthetic()].filter(e=>!isFasonMachine(e.makine));
  const liveMachines = allMachines().filter(m=>!isFasonMachine(m.code));
  let calisiyor=0, durusta=0;
  liveMachines.forEach(m=>{
    const label = `${m.code} · ${m.name}`;
    const running = !!tadilatAktifOnMachine(label) || liveEntries.some(e=>e.makine===label && e.status==='devam');
    const stopped = !running && liveEntries.some(e=>e.makine===label && e.status==='duruş');
    if(running) calisiyor++; else if(stopped) durusta++;
  });
  const uzun = uzunDurusluKayitlar();
  const machineRank = todayData.perMachine.slice().sort((a,b)=>b.verimlilik-a.verimlilik);
  const top5 = machineRank.slice(0,5);
  const adetBugun = todayData.perMachine.reduce((s,m)=>s+m.entries.reduce((ss,e)=>ss+(Number(e.adet)||0),0),0);
  const durusReasonToday = {};
  collectDurusEvents(todayData.perMachine.flatMap(m=>m.entries)).forEach(ev=>{
    if(!Number.isFinite(ev.sureMs)||ev.sureMs<=0) return;
    durusReasonToday[ev.neden] = (durusReasonToday[ev.neden]||0) + ev.sureMs;
  });
  const topReason = Object.entries(durusReasonToday).sort((a,b)=>b[1]-a[1])[0];
  const verimColor = t.verimlilik>=70?'var(--success)':t.verimlilik>=40?'var(--warn)':'var(--danger)';

  return `<div style="padding:8px 4px">
    <div style="display:grid;grid-template-columns:1fr 1.7fr;gap:20px;margin-bottom:20px">
      <div class="analiz-chart-box" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px">
        <div style="font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.4px;font-weight:600">Bugünkü Verimlilik</div>
        <div style="width:220px;height:220px;border-radius:50%;background:conic-gradient(${verimColor} 0% ${t.verimlilik}%, var(--panel-alt) ${t.verimlilik}% 100%);display:flex;align-items:center;justify-content:center;margin:22px 0 6px">
          <div style="width:175px;height:175px;border-radius:50%;background:var(--panel);display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div class="mono" style="font-size:52px;font-weight:700;color:${verimColor}">%${t.verimlilik}</div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:16px">
        <div class="analiz-chart-box" style="border-left:4px solid var(--success);display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:12.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-weight:600">Çalışan Makine</div>
          <div class="mono" style="font-size:44px;font-weight:700;margin-top:6px;color:var(--success)">${calisiyor}/${liveMachines.length}</div>
        </div>
        <div class="analiz-chart-box" style="border-left:4px solid var(--warn);display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:12.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-weight:600">Duruşta</div>
          <div class="mono" style="font-size:44px;font-weight:700;margin-top:6px;color:var(--warn)">${durusta}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">${uzun.length} tanesi eşik üzeri</div>
        </div>
        <div class="analiz-chart-box" style="border-left:4px solid var(--accent);display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:12.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-weight:600">Bugün Üretilen</div>
          <div class="mono" style="font-size:44px;font-weight:700;margin-top:6px;color:var(--accent)">${adetBugun}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">adet</div>
        </div>
        <div class="analiz-chart-box" style="border-left:4px solid var(--danger);display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:12.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-weight:600">En Çok Duruş</div>
          <div class="mono" style="font-size:26px;font-weight:700;margin-top:6px;color:var(--danger)">${topReason?fmtDur(topReason[1]):'—'}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">${topReason?esc(topReason[0]):'bugün duruş yok'}</div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:16px">
      <div class="analiz-chart-box">
        <div style="font-size:18px;font-weight:700;margin-bottom:14px">Şu An Duruşta</div>
        ${uzun.length===0 ? `<div style="color:var(--text-muted);padding:14px 0">Eşiği aşan duruş yok.</div>` : uzun.slice(0,5).map(u=>`
          <div style="display:flex;align-items:center;gap:16px;padding:12px 0;border-top:1px solid var(--border)">
            <div class="mono" style="font-size:20px;font-weight:700;color:var(--accent);width:86px">${esc((u.makine||'').split(' · ')[0]||'—')}</div>
            <div style="flex:1"><div style="font-size:14.5px;font-weight:600">${esc(u.neden||'—')}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(u.isEmriNo||'')} · ${esc(u.operatorName||u.operatorUsername||'')}</div></div>
            <div class="mono" style="font-size:22px;font-weight:700;color:var(--danger)">${fmtDur(u.ms)}</div>
          </div>`).join('')}
      </div>
      <div class="analiz-chart-box">
        <div style="font-size:18px;font-weight:700;margin-bottom:14px">Günün En İyileri</div>
        ${top5.length===0 ? `<div style="color:var(--text-muted);padding:14px 0">Bugün veri yok.</div>` : top5.map((m,i)=>`
          <div style="display:grid;grid-template-columns:28px 90px 1fr 56px;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--border)">
            <div style="font-size:14px;color:var(--text-muted)">#${i+1}</div>
            <div class="mono" style="font-size:15px;font-weight:700">${m.code}</div>
            <div style="height:12px;background:var(--panel-alt);border-radius:4px;overflow:hidden"><div style="height:100%;width:${m.verimlilik}%;background:var(--success);border-radius:4px"></div></div>
            <div class="mono" style="font-size:17px;font-weight:700;text-align:right;color:var(--success)">%${m.verimlilik}</div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}
function renderAdmin(){
  const viewToTabKey = { report:'rapor', matrix:'matrix', completed:'completed', analiz:'analiz', tadilatYonetim:'tadilat' };
  if(viewToTabKey[view] && !isAdminTabVisible(viewToTabKey[view])){
    const tabKeyToView = { rapor:'report', matrix:'matrix', completed:'completed', analiz:'analiz', tadilat:'tadilatYonetim' };
    const fallbackKey = ADMIN_TAB_DEFS.map(t=>t.key).find(k=>isAdminTabVisible(k) && (k!=='tadilat' || canCreateTadilat()) && (k!=='analiz' || !(session.isSef || session.isUretimSef)));
    view = fallbackKey ? tabKeyToView[fallbackKey] : 'report';
  }
  const operatorEntries = Object.entries(STATE.operators).filter(([k,v])=>!v.isAdmin);
  const uzunDurusList = (uzunDurusUyariEnabled() && isAdminTabVisible('uzunDurusUyari')) ? uzunDurusluKayitlar() : [];
  const uzunDevamEdenList = (uzunDevamEdenUyariEnabled() && isAdminTabVisible('uzunDevamEdenUyari')) ? uzunDevamEdenKayitlar() : [];
  const header = `
    <div class="admin-header">
      <div style="display:flex;align-items:center;gap:10px">${connDot()}<span style="font-size:20px">${ico('factory',14)}</span><span class="brand">ROTA TAKİP · YÖNETİCİ RAPORU</span></div>
      <div style="display:flex;gap:10px">
        ${themeToggleHtml()}
        ${uzunDurusList.length>0 ? `<button class="icon-btn" style="position:relative;border-color:var(--danger);color:var(--danger)" onclick="openUzunDurusModal()" title="Uzun süredir duruşta olanlar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          <span style="position:absolute;top:-4px;left:-4px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center;line-height:1.3">${uzunDurusList.length}</span>
        </button>` : ''}
        ${uzunDevamEdenList.length>0 ? `<button class="icon-btn" style="position:relative;border-color:var(--warn);color:var(--warn)" onclick="openUzunDevamEdenModal()" title="Uzun süredir devam ediyor görünen (kapatılmayı unutulmuş olabilir)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span style="position:absolute;top:-4px;left:-4px;background:var(--warn);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center;line-height:1.3">${uzunDevamEdenList.length}</span>
        </button>` : ''}
        ${canViewMessages() ? `<button class="icon-btn" style="position:relative" onclick="openMessagesModal()" title="Mesajlar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M2 6l10 7 10-7"></path></svg>
          ${unreadMessageCount()>0 ? `<span style="position:absolute;top:-4px;left:-4px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center;line-height:1.3">${unreadMessageCount()}</span>` : ''}
        </button>` : ''}
        <button class="icon-btn" style="position:relative" onclick="openMyPushHistoryModal()" title="Bildirimlerim">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          ${unreadPushCount()>0 ? `<span style="position:absolute;top:-4px;left:-4px;background:var(--accent);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center;line-height:1.3">${unreadPushCount()}</span>` : ''}
        </button>
        <button class="icon-btn-labeled" onclick="setView('adminSettings')" style="${view==='adminSettings'?'border-color:var(--accent);color:var(--accent)':''}">${ico('gear',14)} Ayarlar</button>
        <button class="icon-btn-labeled" onclick="doLogout()" style="padding:10px 20px;font-size:14px;font-weight:600">${ico('logout',14)} Çıkış</button>
      </div>
    </div>
    ${uzunDurusModalOpen ? renderUzunDurusModal() : ''}
    ${uzunDevamEdenModalOpen ? renderUzunDevamEdenModal() : ''}
    ${messagesModalOpen ? renderMessagesModal() : ''}
    ${myPushHistoryModalOpen ? renderMyPushHistoryModal() : ''}
    <div class="tabs" style="padding:12px 24px 0">
      ${isAdminTabVisible('rapor') ? `<button class="tab-btn ${view==='report'?'active':''}" onclick="setView('report')">${ico('list',14)} Rapor</button>` : ''}
      ${isAdminTabVisible('matrix') ? `<button class="tab-btn ${view==='matrix'?'active':''}" onclick="setView('matrix')">${ico('factory',14)} Makine Matrisi</button>` : ''}
      ${isAdminTabVisible('completed') ? `<button class="tab-btn ${view==='completed'?'active':''}" onclick="setView('completed')">${ico('check',14)} Tamamlanan Kodlar</button>` : ''}
      ${!(session.isSef || session.isUretimSef) && isAdminTabVisible('analiz') ? `<button class="tab-btn ${view==='analiz'?'active':''}" onclick="setView('analiz')">${ico('chart',14)} Analiz</button>` : ''}
      ${canCreateTadilat() && isAdminTabVisible('tadilat') ? `<button class="tab-btn ${view==='tadilatYonetim'?'active':''}" onclick="setView('tadilatYonetim')">${ico('wrench',14)} Tadilat</button>` : ''}
    </div>`;

  let body = '';
  if(view==='adminSettings' && !session.isAdmin){ view = 'report'; }
  if((session.isSef || session.isUretimSef) && view==='analiz'){ view = 'matrix'; }
  if(session.isSef && view==='adminSettings' && settingsSubTab!=='veriListeleri' && settingsSubTab!=='stok' && settingsSubTab!=='bildirimlerim' && !(settingsSubTab==='uyarilar' && canManageBildirimAyarlari())){ settingsSubTab = 'veriListeleri'; }
  if(session.isAdmin && !session.isSef && !session.isSuperAdmin && view==='adminSettings' && settingsSubTab!=='bildirimlerim' && !(settingsSubTab==='uyarilar' && canManageBildirimAyarlari())){ settingsSubTab = 'bildirimlerim'; } // düz Yönetici: sadece kendi bildirimini (ve izin verilmişse Bildirim Ayarları'nı) yönetebilir
  if(view==='adminSettings'){
    body = `<div class="settings-wrap">
      <div class="sub-tabs">
        ${session.isSuperAdmin ? `
        <button class="sub-tab-btn ${settingsSubTab==='access'?'active':''}" onclick="setSettingsSubTab('access')">Makine Erişimi</button>
        <button class="sub-tab-btn ${settingsSubTab==='personelAyarlari'?'active':''}" onclick="setSettingsSubTab('personelAyarlari')">Personel Ayarları</button>
        <button class="sub-tab-btn ${settingsSubTab==='makineAyarlari'?'active':''}" onclick="setSettingsSubTab('makineAyarlari')">Makine Ayarları</button>
        <button class="sub-tab-btn ${settingsSubTab==='personelAtolye'?'active':''}" onclick="setSettingsSubTab('personelAtolye')">Atölye Ayarları (Personel)</button>
        <button class="sub-tab-btn ${settingsSubTab==='durusReasons'?'active':''}" onclick="setSettingsSubTab('durusReasons')">Duruş Nedenleri</button>
        <button class="sub-tab-btn ${settingsSubTab==='tadilatSablonlari'?'active':''}" onclick="setSettingsSubTab('tadilatSablonlari')">Tadilat Hazır İfadeleri</button>
        <button class="sub-tab-btn ${settingsSubTab==='bolumKurallari'?'active':''}" onclick="setSettingsSubTab('bolumKurallari')">Tadilat Bölüm Kuralları</button>
        <button class="sub-tab-btn ${settingsSubTab==='tabErisimi'?'active':''}" onclick="setSettingsSubTab('tabErisimi')">Sekme Erişimi (Yönetici)</button>` : ''}
        ${(session.isSuperAdmin||session.isSef) ? `
        <button class="sub-tab-btn ${settingsSubTab==='veriListeleri'?'active':''}" onclick="setSettingsSubTab('veriListeleri')">Veri Listeleri</button>
        <button class="sub-tab-btn ${settingsSubTab==='stok'?'active':''}" onclick="setSettingsSubTab('stok')">Malzeme Stoğu</button>` : ''}
        <button class="sub-tab-btn ${settingsSubTab==='bildirimlerim'?'active':''}" onclick="setSettingsSubTab('bildirimlerim')">${ico('bell',14)} Bildirimlerim</button>
        ${canManageBildirimAyarlari() ? `<button class="sub-tab-btn ${settingsSubTab==='uyarilar'?'active':''}" onclick="setSettingsSubTab('uyarilar')">Bildirim Ayarları</button>` : ''}
        ${session.isSuperAdmin ? `
        <button class="sub-tab-btn ${settingsSubTab==='resimBul'?'active':''}" onclick="setSettingsSubTab('resimBul')">Resim/Çizim Bul</button>
        <button class="sub-tab-btn ${settingsSubTab==='bildirimGonder'?'active':''}" onclick="setSettingsSubTab('bildirimGonder')">📤 Bildirim Gönder</button>
        <button class="sub-tab-btn ${settingsSubTab==='addOperator'?'active':''}" onclick="setSettingsSubTab('addOperator')">+ Kullanıcı Ekle</button>
        <button class="sub-tab-btn ${settingsSubTab==='addMachine'?'active':''}" onclick="setSettingsSubTab('addMachine')">+ Makine Ekle</button>` : ''}
      </div>`;
    if(settingsSubTab==='access'){
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Kişi Bazlı Makine Erişimi</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:640px">İşaretli makineler o operatörün "Çalışılan Makine" listesinde görünür.</div>
        <div class="field" style="max-width:340px"><label>Operatör Seç</label>
          <select class="filter-input" onchange="setAccessOperator(this.value)">
            <option value="">— Operatör seçin —</option>
            ${operatorEntries.map(([code,v])=>`<option value="${code}" ${accessOperator===code?'selected':''}>${code} · ${esc(v.displayName)}</option>`).join('')}
          </select></div>`;
      if(accessOperator){
        const op = STATE.operators[accessOperator]||{};
        const allowed = op.allowedMachines ? Object.keys(op.allowedMachines).filter(k=>op.allowedMachines[k]) : allMachineCodes();
        body += `<div class="machine-grid">${allMachines().map(m=>`
          <label class="machine-check-row"><input type="checkbox" ${allowed.includes(m.code)?'checked':''} onchange="toggleMachineAccess('${accessOperator}','${m.code}')"><span class="mono" style="color:var(--accent);font-weight:700">${m.code}</span> ${esc(m.name)}</label>
        `).join('')}</div>`;
      }
    } else if(settingsSubTab==='personelAyarlari'){
      const allUsersForSettings = Object.entries(STATE.operators).filter(([code,v])=>!v.isSuperAdmin);
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Personel Ayarları</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:760px">
          <b>Varsayılan Makine:</b> "Başla" ekranında otomatik dolu gelir. <b>Çoklu İş:</b> aynı anda birden fazla makinede iş açabilir (ör. EDM operatörü). <b>Çoklu İş Emri:</b> tek makinede aynı anda birden fazla İş Emri No birlikte başlatabilir. <b>Fason Yetkisi:</b> "${ico('box',13)} Fasonda Bekleyen İşler" listesini görüp kapatabilir. <b>Mesaj Erişimi:</b> operatörlerin düzenleme mesajlarını (salt okunur) görebilir. <b>${ico('wrench',14)} Makine Erişimi:</b> hangi makinelerin "Çalışılan Makine" listesinde görüneceğini ayarlar.
        </div>
        <div class="op-settings-table">
          ${allUsersForSettings.map(([code,v])=>`
            <div class="op-settings-row" style="flex-wrap:nowrap;gap:14px">
              <div style="min-width:150px">
                <div class="op-settings-id">${esc(code)}</div>
                <div class="op-settings-name">${esc(v.displayName)}${v.isSef?' · <span style="color:var(--gunsonu);font-size:11px">Şef</span>':v.isUretimSef?' · <span style="color:var(--gunsonu);font-size:11px">Üretim Şef</span>':v.isAdmin?' · <span style="color:var(--accent);font-size:11px">Yönetici</span>':''}</div>
              </div>
              <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                <input type="checkbox" style="width:auto" ${v.multiJob?'checked':''} onchange="toggleMultiJob('${code}')"> Çoklu İş
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                <input type="checkbox" style="width:auto" ${v.cokluIsEmri?'checked':''} onchange="toggleCokluIsEmri('${code}')"> Çoklu İş Emri
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                <input type="checkbox" style="width:auto" ${v.fasonYetkisi?'checked':''} onchange="toggleFasonYetkisi('${code}')"> Fason Yetkisi
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                <input type="checkbox" style="width:auto" ${v.messagesAccess?'checked':''} onchange="toggleMessagesAccess('${code}')"> Mesaj Erişimi
              </label>
              <select class="filter-input" style="width:200px" onchange="updateDefaultMachine('${code}', this.value)">
                <option value="">— Varsayılan Makine yok —</option>
                ${allMachines().map(m=>{ const label=`${m.code} · ${m.name}`; return `<option value="${esc(label)}" ${v.defaultMachine===label?'selected':''}>${esc(label)}</option>`; }).join('')}
              </select>
              <button class="btn-ghost" style="white-space:nowrap;margin-left:auto" onclick="openMachineAccessModal('${escJs(code)}')">${ico('wrench',14)} Makine Erişimi</button>
            </div>
          `).join('')}
        </div>`;
    } else if(settingsSubTab==='makineAyarlari'){
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Makine Ayarları</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:760px">
          <b>Fason:</b> bu makinede aynı anda birden fazla parti/iş emri açılabilir, "makine meşgul" uyarısı uygulanmaz (ör. dışarıya ısıl işleme giden FII01) — bu makinelerdeki işler, "Personel Ayarları"ndan Fason Yetkisi verilen operatörlere kim başlatmış olursa olsun görünür. <b>Atölye:</b> İmalat/Tadilat ayrımı, tadilat taleplerinin doğru listeye düşmesi için kullanılıyor. Belirtilmemiş makineler varsayılan olarak İmalat Atölye + Normal (Fason değil) sayılır.
        </div>
        <div class="op-settings-table">
          ${allMachines().map(m=>`
            <div class="op-settings-row" style="flex-wrap:wrap;gap:14px">
              <div style="min-width:150px">
                <div class="op-settings-id">${esc(m.code)}</div>
                <div class="op-settings-name">${esc(m.name)}</div>
              </div>
              <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                <input type="checkbox" style="width:auto" ${fasonMachines[m.code]?'checked':''} onchange="toggleMachineFason('${m.code}')"> Fason
              </label>
              <select onchange="setMachineAtolye('${m.code}', this.value)" style="width:170px">
                <option value="imalat" ${machineAtolyeOf(m.code)==='imalat'?'selected':''}>${ico('factory',14)} İmalat Atölye</option>
                <option value="tadilat" ${machineAtolyeOf(m.code)==='tadilat'?'selected':''}>${ico('wrench',14)} Tadilat Atölye</option>
              </select>
            </div>
          `).join('')}
        </div>`;
    } else if(settingsSubTab==='personelAtolye'){
      const allOpsForAtolye = Object.entries(STATE.operators).filter(([code,v])=>!v.isSuperAdmin);
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Atölye Ayarları (Personel)</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:640px">Her kullanıcıyı (operatör, şef, yönetici) İmalat ve/veya Tadilat Atölye personeli olarak işaretle — ikisi de işaretlenebilir. Tadilat sekmesinde/Talepler ekranında SADECE işaretli atölye(ler)in talepleri görünür; talep açma formundaki atölye seçeneği de buna göre sınırlanır. Hiçbiri işaretli değilse varsayılan İmalat Atölye sayılır.</div>
        <div class="op-settings-table">
          ${allOpsForAtolye.map(([code,v])=>{
            const atolyeler = getUserAtolyeler(code);
            return `
            <div class="op-settings-row" style="flex-wrap:wrap">
              <div class="op-settings-id">${esc(code)}</div>
              <div class="op-settings-name">${esc(v.displayName)}${v.isSef?' · <span style="color:var(--gunsonu);font-size:11px">Şef</span>':v.isUretimSef?' · <span style="color:var(--gunsonu);font-size:11px">Üretim Şef</span>':v.isAdmin?' · <span style="color:var(--accent);font-size:11px">Yönetici</span>':''}</div>
              <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;margin-right:14px">
                <input type="checkbox" style="width:auto" ${atolyeler.includes('imalat')?'checked':''} onchange="toggleUserAtolye('${code}','imalat')">${ico('factory',14)} İmalat Atölye
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                <input type="checkbox" style="width:auto" ${atolyeler.includes('tadilat')?'checked':''} onchange="toggleUserAtolye('${code}','tadilat')">${ico('wrench',14)} Tadilat Atölye
              </label>
            </div>`;
          }).join('')}
        </div>`;
    } else if(settingsSubTab==='addOperator'){
      const allOps = Object.entries(STATE.operators).filter(([code,v])=>!v.isSuperAdmin);
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Yeni Kullanıcı Ekle</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:480px">Operatör için kullanıcı adı OPRT kodu olsun (ör. OPRT17). Şifreyi kendisi sonradan değiştirebilir.</div>
        <div style="max-width:400px">
          <div class="field"><label>Kullanıcı Kodu</label><input id="new-op-code" placeholder="ör. OPRT17"></div>
          <div class="field"><label>Ad Soyad</label><input id="new-op-name" placeholder="ör. Mehmet YILMAZ"></div>
          <div class="field"><label>Şifre (max 8 hane, rakam)</label><input id="new-op-pass" inputmode="numeric" maxlength="8" value="1234"></div>
          <div style="font-size:11.5px;color:var(--text-muted);background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:14px">🔒 Yönetici/Şef/Üretim Şef ataması güvenlik nedeniyle artık buradan yapılamıyor. Kullanıcıyı normal operatör olarak ekledikten sonra, Firebase Console → Realtime Database → <span class="mono">operators/KODU/isAdmin</span> (ve gerekirse <span class="mono">isSef</span> ya da <span class="mono">isUretimSef</span>) alanını elle <span class="mono">true</span> yapman gerekiyor.</div>
          <button class="btn-primary" onclick="addOperator()">+ Operatörü Ekle</button>
        </div>
        <div style="margin-top:28px;font-size:13px;font-weight:600;margin-bottom:8px">Kayıtlı Kullanıcılar (${allOps.length})</div>
        <div class="op-settings-table">
          ${allOps.map(([code,v])=>`
            <div class="op-settings-row" style="flex-wrap:wrap">
              <div class="op-settings-id">${esc(code)}</div>
              <div class="op-settings-name">${esc(v.displayName)}${v.isSuperAdmin?' · <span style="color:var(--accent)">Süper Admin</span>':v.isSef?' · <span style="color:var(--gunsonu)">Şef</span>':v.isUretimSef?' · <span style="color:var(--gunsonu)">Üretim Şef</span>':v.isAdmin?' · <span style="color:var(--accent)">Yönetici</span>':''}</div>
              ${v.isAdmin ? `<label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-muted);cursor:pointer;margin-right:10px">
                <input type="checkbox" style="width:auto" ${v.permReportEdit!==false?'checked':''} onchange="toggleUserPerm('${code}','permReportEdit')"> Rapor: Düzenleyebilir
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-muted);cursor:pointer;margin-right:10px">
                <input type="checkbox" style="width:auto" ${v.permReportDelete?'checked':''} onchange="toggleUserPerm('${code}','permReportDelete')"> Rapor: Silebilir
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-muted);cursor:pointer;margin-right:10px">
                <input type="checkbox" style="width:auto" ${v.permTadilatOlustur===true || (v.permTadilatOlustur!==false && (v.isSef || v.isUretimSef))?'checked':''} onchange="toggleTadilatYetkisi('${code}')"> Tadilat Oluşturabilir${v.isSef?' (Şef için varsayılan açık)':v.isUretimSef?' (Üretim Şef için varsayılan açık)':''}
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-muted);cursor:pointer;margin-right:10px">
                <input type="checkbox" style="width:auto" ${v.permBildirimYonetimi?'checked':''} onchange="toggleUserPerm('${code}','permBildirimYonetimi')"> Bildirim Ayarlarını Yönetebilir
              </label>` : ''}
              ${code===session.username ? `<span style="font-size:11.5px;color:var(--text-muted)">(bu hesap — silinemez)</span>` : `<button class="del-btn" onclick="deleteOperator('${escJs(code)}')" title="Sil">${ico('trash',14)}</button>`}
            </div>
          `).join('')}
        </div>` ;
    } else if(settingsSubTab==='addMachine'){
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Yeni Makine Ekle</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:480px">Eklediğin makine anında tüm operatörlerin "Çalışılan Makine" listesinde görünür.</div>
        <div style="max-width:400px">
          <div class="field"><label>Makine Kodu</label><input id="new-mk-code" placeholder="ör. SM02"></div>
          <div class="field"><label>Makine Adı</label><input id="new-mk-name" placeholder="ör. Sütun Matkap 2"></div>
          <button class="btn-primary" onclick="addMachine()">+ Makineyi Ekle</button>
        </div>
        <div style="margin-top:24px;font-size:13px;font-weight:600;margin-bottom:8px">Mevcut Makineler (${allMachines().length})</div>
        <div class="machine-grid">${allMachines().map(m=>`<div class="machine-chip" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span><span class="mono" style="color:var(--accent);font-weight:700">${m.code}</span> ${esc(m.name)}</span><button class="del-btn" onclick="deleteMachine('${escJs(m.code)}')" title="Sil">${ico('trash',14)}</button></div>`).join('')}</div>`;
    } else if(settingsSubTab==='veriListeleri'){
      const count = Object.keys(STATE.validIsEmri||{}).length;
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Veri Listeleri</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:22px;max-width:760px">Excel'den yüklenen referans listeleri. Excel'iniz güncellendikçe aynı bölümden tekrar yükleyip üzerine yazabilirsiniz.</div>

        <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;max-width:560px;margin-bottom:22px">
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">İş Emri Listesi (ERP Doğrulaması)</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">ERP'den aldığınız Excel'i yükleyin. Operatörler İş Emri No olarak <b>İş Talep No</b> girer, sistem bu listeden doğrular. "Malzeme kodu"/"Malzeme Adı" sütunları da varsa otomatik gösterilir. _ZARF/_ELMAS varyantları taban talep no'ya göre otomatik doğrulanır, ayrıca eklemenize gerek yok.</div>
          <div style="font-size:13px;margin-bottom:10px">Şu an listede <b style="color:var(--accent)">${count}</b> kayıt.${count===0?' <span style="color:var(--warn)">(Liste boşsa doğrulama yapılmaz.)</span>':''}</div>
          <div class="field"><label>Sütun Başlığı (varsayılan: İş Talep No)</label><input id="isemri-col-name" value="İş Talep No" placeholder="İş Talep No"></div>
          <input type="file" id="isemri-file-input" accept=".xlsx,.xls" style="margin-bottom:12px;font-size:12.5px">
          <div style="display:flex;gap:10px">
            <button class="btn-primary" style="width:auto;padding:10px 18px" onclick="uploadIsEmriListesi()">⬆ Yükle ve Güncelle</button>
            ${count>0 ? `<button class="btn-ghost" onclick="clearIsEmriListesi()">${ico('trash',14)} Temizle</button>` : ''}
          </div>
          <div id="isemri-upload-status" style="font-size:12px;color:var(--text-muted);margin-top:10px"></div>
        </div>`;
      if(session.isSuperAdmin){
        const mCount = malzemeListesiArray().length;
        const iCount = isMerkezleriArray().length;
        const pCount = uretimPersoneliArray().length;
        body += `
        <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;max-width:560px;margin-bottom:22px">
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Malzeme Listesi (Dürbün Arama Kaynağı) <span style="font-size:10.5px;color:var(--text-muted);font-weight:400">(SuperAdmin)</span></div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">BAST03'ten (Canias) aldığınız U kodu + Açıklama listesi. Tadilat talebinde ${ico('search',13)} ile <span class="mono">%joker%</span> karakterli arama yapılabilir.</div>
          <div style="font-size:13px;margin-bottom:10px">Şu an listede <b style="color:var(--accent)">${mCount}</b> kayıt.</div>
          <div class="field"><label>U Kodu Sütun Başlığı (varsayılan: U Kodu)</label><input id="malzeme-kod-col" value="U Kodu" placeholder="U Kodu"></div>
          <div class="field"><label>Açıklama Sütun Başlığı (varsayılan: Açıklama)</label><input id="malzeme-aciklama-col" value="Açıklama" placeholder="Açıklama"></div>
          <input type="file" id="malzeme-file-input" accept=".xlsx,.xls" style="margin-bottom:12px;font-size:12.5px">
          <div style="display:flex;gap:10px">
            <button class="btn-primary" style="width:auto;padding:10px 18px" onclick="uploadMalzemeListesi()">⬆ Yükle ve Güncelle</button>
            ${mCount>0 ? `<button class="btn-ghost" onclick="clearMalzemeListesi()">${ico('trash',14)} Temizle</button>` : ''}
          </div>
          <div id="malzeme-upload-status" style="font-size:12px;color:var(--text-muted);margin-top:10px"></div>
        </div>

        <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;max-width:560px;margin-bottom:22px">
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">İş Merkezi Listesi (Tadilat "Talep Edilen Makine" Kaynağı) <span style="font-size:10.5px;color:var(--text-muted);font-weight:400">(SuperAdmin)</span></div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">ERP'den (BAST08) aldığınız iş merkezi kodları (V01, B10, N3 gibi — açıklama alınmaz). Rota Takip'in kendi makine listesinden ayrı; Tadilat'ta "Talep Edilen Makine" alanında kullanılır. Hangi bölümün hangi kodlara erişebileceği "Tadilat Bölüm Kuralları"ndan ayarlanır.</div>
          <div style="font-size:13px;margin-bottom:10px">Şu an listede <b style="color:var(--accent)">${iCount}</b> kayıt.</div>
          <div class="field"><label>Sütun Başlığı (varsayılan: İş Merkezi)</label><input id="ismerkezi-kod-col" value="İş Merkezi" placeholder="İş Merkezi"></div>
          <input type="file" id="ismerkezi-file-input" accept=".xlsx,.xls" style="margin-bottom:12px;font-size:12.5px">
          <div style="display:flex;gap:10px">
            <button class="btn-primary" style="width:auto;padding:10px 18px" onclick="uploadIsMerkezleri()">⬆ Yükle ve Güncelle</button>
            ${iCount>0 ? `<button class="btn-ghost" onclick="clearIsMerkezleri()">${ico('trash',14)} Temizle</button>` : ''}
          </div>
          <div id="ismerkezi-upload-status" style="font-size:12px;color:var(--text-muted);margin-top:10px"></div>
        </div>

        <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;max-width:560px;margin-bottom:22px">
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Üretim Personeli Listesi <span style="font-size:10.5px;color:var(--text-muted);font-weight:400">(SuperAdmin)</span></div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Tadilat'taki "Talep eden kişi" alanı bu listeye göre doğrulanır. "Görev" sütunu varsa (ör. "Civata Üretim Operatörü") bölüm otomatik çıkarılır (Civata/Vida/Somun/Bakım/Kalite/Diğer). Liste boşken serbest yazıma açık kalır.</div>
          <div style="font-size:13px;margin-bottom:10px">Şu an listede <b style="color:var(--accent)">${pCount}</b> kayıt.${pCount===0?' <span style="color:var(--warn)">(Liste boşsa doğrulama yapılmaz.)</span>':''}</div>
          <div class="field"><label>Ad Sütun Başlığı (varsayılan: Görünen Ad)</label><input id="personel-ad-col" value="Görünen Ad" placeholder="Görünen Ad"></div>
          <div class="field"><label>Görev Sütun Başlığı (varsayılan: Görev)</label><input id="personel-gorev-col" value="Görev" placeholder="Görev"></div>
          <input type="file" id="personel-file-input" accept=".xlsx,.xls" style="margin-bottom:12px;font-size:12.5px">
          <div style="display:flex;gap:10px">
            <button class="btn-primary" style="width:auto;padding:10px 18px" onclick="uploadUretimPersoneli()">⬆ Yükle ve Güncelle</button>
            ${pCount>0 ? `<button class="btn-ghost" onclick="clearUretimPersoneli()">${ico('trash',14)} Temizle</button>` : ''}
          </div>
          <div id="personel-upload-status" style="font-size:12px;color:var(--text-muted);margin-top:10px"></div>
        </div>`;
      }
    } else if(settingsSubTab==='bolumKurallari'){
      const kurallar = getBolumKurallari();
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Tadilat Bölüm Kuralları</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:640px">Tadilat talebi açılırken "Talep Eden Bölüm" seçimine göre hangi iş merkezi kodlarının seçilebileceğini burada ayarlıyorsun — kod değişikliği gerekmez. "Tümüne erişebilir" hiç kısıtlama koymaz; "Sadece şunlarla başlayanlar" sadece girdiğin harf(ler)le başlayan kodları gösterir; "Şunlar hariç hepsi" girdiğin harf(ler)le başlayanlar dışındaki her şeyi gösterir. Birden fazla harf/önek için virgülle ayır (ör. B,V).</div>
        <div class="op-settings-table" style="margin-bottom:26px">
          ${Object.entries(kurallar).map(([ad,kural])=>`
            <div class="op-settings-row" style="flex-wrap:wrap;gap:10px">
              <div style="min-width:90px;font-weight:700">${esc(ad)}${!DEFAULT_BOLUM_KURALLARI[ad]?' <span style="font-size:10.5px;color:var(--accent);font-weight:400">(özel)</span>':''}</div>
              <select id="bolum-mode-${ad}" style="width:220px">
                <option value="all" ${kural.mode==='all'?'selected':''}>Tümüne erişebilir</option>
                <option value="include" ${kural.mode==='include'?'selected':''}>Sadece şunlarla başlayanlar</option>
                <option value="exclude" ${kural.mode==='exclude'?'selected':''}>Şunlar hariç hepsi</option>
              </select>
              <input id="bolum-prefixes-${ad}" placeholder="ör. B,V" value="${esc((kural.prefixes||[]).join(','))}" style="width:140px">
              <button class="btn-ghost" onclick="saveBolumKural('${escJs(ad)}', false)">💾 Kaydet</button>
              ${!DEFAULT_BOLUM_KURALLARI[ad] ? `<button class="del-btn" onclick="deleteBolumKural('${escJs(ad)}')" title="Sil">${ico('trash',14)}</button>` : ''}
            </div>
          `).join('')}
        </div>
        <div style="max-width:560px">
          <div style="font-size:13px;font-weight:600;margin-bottom:10px">Yeni Bölüm Ekle</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <input id="bolum-yeni-ad" placeholder="Bölüm adı (ör. Montaj)" style="flex:1;min-width:140px">
            <select id="bolum-mode-yeni" style="width:220px">
              <option value="all">Tümüne erişebilir</option>
              <option value="include">Sadece şunlarla başlayanlar</option>
              <option value="exclude">Şunlar hariç hepsi</option>
            </select>
            <input id="bolum-prefixes-yeni" placeholder="ör. B,V" style="width:140px">
          </div>
          <button class="btn-primary" style="width:auto;padding:10px 18px" onclick="saveBolumKural('', true)">+ Bölüm Ekle</button>
        </div>`;
    } else if(settingsSubTab==='tabErisimi'){
      const adminAccounts = Object.entries(STATE.operators).filter(([code,v])=>!v.isSuperAdmin && (v.isAdmin || v.isSef || v.isUretimSef));
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Sekme Erişimi (Yönetici)</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:640px">Her yönetici/şef hesabı için, üst menüdeki ana sekmelerden hangilerini görebileceğini AYRI AYRI belirle (ör. "LV sadece Rapor ve Makine Matrisi'ni görsün" gibi). Ayrıca "${ico('alert',13)} Uzun Duruş Uyarısı" kutusuyla, üst bardaki uzun süredir duruşta olan işleri gösteren uyarı ikonunu kimin görebileceğini de ayrı ayrı kapatıp açabilirsin. SuperAdmin bu ayardan hiç etkilenmez, her zaman hepsini görür. Bir kullanıcı için hiçbir kutuyu kapatmazsan, o kullanıcı varsayılan olarak tüm sekmeleri/uyarıları görür.</div>
        ${adminAccounts.length===0 ? `<div style="color:var(--text-muted);font-size:13px">Henüz yönetici/şef hesabı yok.</div>` : `
        <div class="op-settings-table">
          ${adminAccounts.map(([code,v])=>`
            <div class="op-settings-row" style="flex-wrap:wrap;gap:10px">
              <div style="min-width:140px">
                <div class="op-settings-id">${esc(code)}</div>
                <div style="font-size:11px;color:var(--text-muted)">${esc(v.displayName)}${v.isSef?' · Şef':v.isUretimSef?' · Üretim Şef':' · Yönetici'}</div>
              </div>
              ${ADMIN_TAB_DEFS.map(t=>`
                <label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-muted);cursor:pointer">
                  <input type="checkbox" style="width:auto" ${(adminTabPermissions[code]?.[t.key])!==false?'checked':''} onchange="setAdminTabPermission('${code}','${t.key}', this.checked)"> ${t.label}
                </label>
              `).join('')}
              <label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-muted);cursor:pointer;padding-left:10px;border-left:1px solid var(--border)">
                <input type="checkbox" style="width:auto" ${(adminTabPermissions[code]?.['uzunDurusUyari'])!==false?'checked':''} onchange="setAdminTabPermission('${code}','uzunDurusUyari', this.checked)"> ${ico('alert',14)} Uzun Duruş Uyarısı
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-muted);cursor:pointer">
                <input type="checkbox" style="width:auto" ${(adminTabPermissions[code]?.['uzunDevamEdenUyari'])!==false?'checked':''} onchange="setAdminTabPermission('${code}','uzunDevamEdenUyari', this.checked)"> ${ico('alert',14)} Uzun Devam Eden Uyarısı
              </label>
              ${(adminTabPermissions[code]?.['analiz'])!==false ? `
              <div style="width:100%;display:flex;flex-wrap:wrap;gap:10px;padding:8px 0 0 10px;border-left:1px solid var(--border);margin-left:1px">
                <span style="font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;width:100%">Analiz — görünümler</span>
                ${ANALIZ_VIEW_DEFS.map(v=>`
                  <label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-muted);cursor:pointer">
                    <input type="checkbox" style="width:auto" ${(adminTabPermissions[code]?.analizViews?.[v.key])!==false?'checked':''} onchange="setAnalizViewPermission('${code}','${v.key}', this.checked)"> ${esc(v.label)}
                  </label>
                `).join('')}
              </div>` : ''}
            </div>
          `).join('')}
        </div>`}`;
    } else if(settingsSubTab==='resimBul'){
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Resim/Çizim Bul <span style="font-size:11.5px;font-weight:400;color:var(--text-muted)">(opsiyonel modül)</span></div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:640px">Bu özellik, yerel ağdaki ayrı bir resim arama sunucusuna (ilgili bilgisayarda "SUNUCUYU_BASLAT.bat" ile açılan) bağımlıdır. Sunucu sadece o bilgisayarın bulunduğu ağdan erişilebilir olduğu için, ağ/erişim koşulları netleşene kadar kapalı tutulması önerilir.</div>
        <label style="display:flex;align-items:center;gap:10px;background:var(--panel);border:2px solid ${resimBulEnabled()?'var(--success)':'var(--border)'};border-radius:10px;padding:14px 16px;margin-bottom:22px;cursor:pointer;max-width:480px">
          <input type="checkbox" ${resimBulEnabled()?'checked':''} onchange="toggleResimBul()" style="width:auto;transform:scale(1.3)">
          <div>
            <div style="font-size:14px;font-weight:600;color:${resimBulEnabled()?'var(--success)':'var(--text)'}">Resim/Çizim Bul Butonunu ${resimBulEnabled()?'Aktif':'Kapalı'}</div>
            <div style="font-size:11.5px;color:var(--text-muted)">Kapalıyken "${ico('camera',13)} Resim/Çizim Bul" butonu operatör ve yönetici ekranlarının hiçbirinde görünmez. Açtığında, ilgili sunucu (${RESIM_SUNUCU_URL}) o an ayakta değilse kullanıcıya net bir uyarı gösterilir.</div>
          </div>
        </label>`;
    } else if(settingsSubTab==='uyarilar'){
      const esikDk = Math.round(uzunDurusEsikMs()/60000);
      const esikSaat = Math.round(uzunDevamEdenEsikMs()/3600000);
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:16px">Bildirim Ayarları</div>

        <div style="font-size:14px;font-weight:600;margin-bottom:6px">1) Uzun Duruş Uyarısı</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;max-width:640px">Bir iş, "Gün Sonu" dışındaki bir nedenle belirlediğiniz süreden daha uzun süre duruşta kalırsa, Makine Matrisi'nde yanıp sönen bir uyarı, üst barda bir sayaç rozeti VE ilgili operatörün telefonuna push bildirimi gider.</div>
        <label style="display:flex;align-items:center;gap:10px;background:var(--panel);border:2px solid ${uzunDurusUyariEnabled()?'var(--success)':'var(--border)'};border-radius:10px;padding:14px 16px;margin-bottom:14px;cursor:pointer;max-width:480px">
          <input type="checkbox" ${uzunDurusUyariEnabled()?'checked':''} onchange="toggleUzunDurusUyari()" style="width:auto;transform:scale(1.3)">
          <div>
            <div style="font-size:14px;font-weight:600;color:${uzunDurusUyariEnabled()?'var(--success)':'var(--text)'}">Uzun Duruş Uyarısını ${uzunDurusUyariEnabled()?'Aktif':'Kapalı'}</div>
            <div style="font-size:11.5px;color:var(--text-muted)">Kapalıyken hiçbir uyarı rozeti/animasyonu/bildirimi olmaz.</div>
          </div>
        </label>
        ${uzunDurusUyariEnabled() ? `
        <div class="field" style="max-width:260px">
          <label>Eşik (dakika)</label>
          <input type="number" min="1" max="600" value="${esikDk}" onchange="setUzunDurusEsikDk(this.value)">
        </div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:6px;margin-bottom:18px;max-width:480px">Bir iş bu süreden fazla duruşta kalırsa uyarı tetiklenir. Varsayılan: 30 dakika.</div>
        <label style="display:flex;align-items:center;gap:10px;background:var(--panel);border:2px solid ${sessizSaatlerEnabled()?'var(--success)':'var(--border)'};border-radius:10px;padding:12px 14px;margin-bottom:10px;cursor:pointer;max-width:480px">
          <input type="checkbox" ${sessizSaatlerEnabled()?'checked':''} onchange="toggleSessizSaatler()" style="width:auto;transform:scale(1.2)">
          <div>
            <div style="font-size:13px;font-weight:600;color:${sessizSaatlerEnabled()?'var(--success)':'var(--text)'}">Sessiz Saatler ${sessizSaatlerEnabled()?'Aktif':'Kapalı'}</div>
            <div style="font-size:11px;color:var(--text-muted)">Belirlediğin saat aralığında bu kontrol hiç çalışmaz (gece vardiyası yoksa boşuna veri çekmesin diye). Aşağıya saatleri kapalıyken de girebilirsin, sadece işaretleyince devreye girer.</div>
          </div>
        </label>
        <div style="display:flex;gap:16px;flex-wrap:wrap;max-width:400px;margin-bottom:6px;opacity:${sessizSaatlerEnabled()?'1':'.55'}">
          <div class="field" style="width:160px">
            <label>Başlangıç</label>
            <input type="time" value="${esc(appSettings.sessizSaatBaslangic||'')}" onchange="setSessizSaat('Baslangic', this.value)">
          </div>
          <div class="field" style="width:160px">
            <label>Bitiş</label>
            <input type="time" value="${esc(appSettings.sessizSaatBitis||'')}" onchange="setSessizSaat('Bitis', this.value)">
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:26px;max-width:480px">Örn. Başlangıç 00:00, Bitiş 06:00 → gece yarısından sabah 6'ya kadar hiç kontrol edilmez. Gece yarısını geçen aralıklar (ör. 22:00 → 06:00) da desteklenir. ${sessizSaatlerEnabled() ? '' : '<b style="color:var(--warn)">Şu an kapalı — yukarıdaki saatleri doldursan bile uygulanmaz, checkbox\'ı işaretlemen gerekir.</b>'}</div>
        ` : `<div style="margin-bottom:26px"></div>`}

        <div style="font-size:14px;font-weight:600;margin-bottom:6px">2) Tadilat Tamamlandı Bildirimi</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;max-width:640px">Bir tadilatın son operasyonu tamamlandığında, tüm şef yetkili hesaplara anında push bildirimi gider ("✅ Tadilat tamamlandı").</div>
        <label style="display:flex;align-items:center;gap:10px;background:var(--panel);border:2px solid ${tadilatTamamlandiBildirimEnabled()?'var(--success)':'var(--border)'};border-radius:10px;padding:14px 16px;margin-bottom:26px;cursor:pointer;max-width:480px">
          <input type="checkbox" ${tadilatTamamlandiBildirimEnabled()?'checked':''} onchange="toggleTadilatTamamlandiBildirim()" style="width:auto;transform:scale(1.3)">
          <div>
            <div style="font-size:14px;font-weight:600;color:${tadilatTamamlandiBildirimEnabled()?'var(--success)':'var(--text)'}">Tadilat Tamamlandı Bildirimini ${tadilatTamamlandiBildirimEnabled()?'Aktif':'Kapalı'}</div>
            <div style="font-size:11.5px;color:var(--text-muted)">Kapalıyken şeflere bu bildirim gitmez.</div>
          </div>
        </label>

        <div style="font-size:14px;font-weight:600;margin-bottom:6px">3) Gün Başı Duruş Hatırlatıcısı</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;max-width:640px">Belirlediğin saatte, hâlâ duruşta olan tüm işler için — <b>"Gün Sonu" nedeni dahil</b> — ilgili operatöre "Lütfen makineyi devreye alınız" bildirimi gider. Günde tek sefer çalışır. Bir gün tipinin saatini boş bırakırsan, o gün tipinde hiç çalışmaz (ör. Pazar'ı boş bırak, hafta sonu rahatsız etmesin).</div>
        <label style="display:flex;align-items:center;gap:10px;background:var(--panel);border:2px solid ${gunBasiHatirlaticiEnabled()?'var(--success)':'var(--border)'};border-radius:10px;padding:14px 16px;margin-bottom:16px;cursor:pointer;max-width:480px">
          <input type="checkbox" ${gunBasiHatirlaticiEnabled()?'checked':''} onchange="toggleGunBasiHatirlatici()" style="width:auto;transform:scale(1.3)">
          <div>
            <div style="font-size:14px;font-weight:600;color:${gunBasiHatirlaticiEnabled()?'var(--success)':'var(--text)'}">Gün Başı Hatırlatıcısını ${gunBasiHatirlaticiEnabled()?'Aktif':'Kapalı'}</div>
            <div style="font-size:11.5px;color:var(--text-muted)">Kapalıyken hiçbir gün sabah hatırlatması gitmez (aşağıdaki saatler ne olursa olsun).</div>
          </div>
        </label>
        ${gunBasiHatirlaticiEnabled() ? `
        <div style="display:flex;gap:16px;flex-wrap:wrap;max-width:600px">
          <div class="field" style="width:160px">
            <label>Hafta İçi Saati (Pzt–Cuma)</label>
            <input type="time" value="${esc(appSettings.gunBasiSaatHaftaIci||'')}" onchange="setGunBasiSaat('HaftaIci', this.value)">
          </div>
          <div class="field" style="width:160px">
            <label>Cumartesi Saati</label>
            <input type="time" value="${esc(appSettings.gunBasiSaatCumartesi||'')}" onchange="setGunBasiSaat('Cumartesi', this.value)">
          </div>
          <div class="field" style="width:160px">
            <label>Pazar Saati</label>
            <input type="time" value="${esc(appSettings.gunBasiSaatPazar||'')}" onchange="setGunBasiSaat('Pazar', this.value)">
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;max-width:480px">Boş bırakılan bir saat alanı, o gün tipinde bildirimi tamamen kapatır.</div>
        ` : ''}

        <div style="font-size:14px;font-weight:600;margin-bottom:6px;margin-top:26px">4) Uzun Süredir Devam Eden Uyarısı</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;max-width:640px">Uzun Duruş Uyarısı'nın tersi senaryo için: bir iş/tadilat operasyonu hiç "Bitir"/"Duraklat" denmeden "Devam Ediyor" durumunda belirlediğiniz süreden fazla kalırsa (operatör kapatmayı unutmuş olabilir), üst barda ayrı bir uyarı rozeti çıkar. Kısa bir eşik burada yanlış alarm üretir (iş gerçekten sürüyor olabilir) — bu yüzden varsayılan eşik saat cinsinden ve çok daha yüksek.</div>
        <label style="display:flex;align-items:center;gap:10px;background:var(--panel);border:2px solid ${uzunDevamEdenUyariEnabled()?'var(--success)':'var(--border)'};border-radius:10px;padding:14px 16px;margin-bottom:14px;cursor:pointer;max-width:480px">
          <input type="checkbox" ${uzunDevamEdenUyariEnabled()?'checked':''} onchange="toggleUzunDevamEdenUyari()" style="width:auto;transform:scale(1.3)">
          <div>
            <div style="font-size:14px;font-weight:600;color:${uzunDevamEdenUyariEnabled()?'var(--success)':'var(--text)'}">Uzun Süredir Devam Eden Uyarısını ${uzunDevamEdenUyariEnabled()?'Aktif':'Kapalı'}</div>
            <div style="font-size:11.5px;color:var(--text-muted)">Kapalıyken hiçbir uyarı rozeti olmaz.</div>
          </div>
        </label>
        ${uzunDevamEdenUyariEnabled() ? `
        <div class="field" style="max-width:260px">
          <label>Eşik (saat)</label>
          <input type="number" min="1" max="48" value="${esikSaat}" onchange="setUzunDevamEdenEsikSaat(this.value)">
        </div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:6px;max-width:480px">Bir iş bu süreden fazla "Devam Ediyor" durumunda kalırsa uyarı tetiklenir. Varsayılan: 14 saat.</div>
        ` : ''}`;
    } else if(settingsSubTab==='bildirimlerim'){
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">${ico('bell',14)} Bildirimlerim</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:640px">Bu telefon/tarayıcıda bildirim almak için aç. SuperAdmin sana bir mesaj gönderirse ya da (şefsen) bir tadilat tamamlandığında buradan bildirim alırsın.</div>
        ${pushConfigured() ? `
        <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px 16px;max-width:480px">
          ${pushPermissionState==='granted' ? `<div style="color:var(--success);font-size:13px;font-weight:600;margin-bottom:6px">${ico('check',14)} Bu cihazda bildirimler açık</div><button class="btn-ghost" style="font-size:11.5px;padding:6px 12px" onclick="enablePushNotifications()">🔄 Yeniden senkronize et</button>`
            : pushPermissionState==='denied' ? `<div style="color:var(--danger);font-size:12.5px">${esc(pushBlockedInstructions())}</div>`
            : `<button class="btn-ghost" onclick="enablePushNotifications()">${ico('bell',14)} Bildirimleri Aç</button>`}
        </div>` : `<div style="font-size:12.5px;color:var(--text-muted)">Bildirim sistemi henüz kurulmadı (VAPID key eksik).</div>`}
        ${renderMyPushHistoryList()}`;
    } else if(settingsSubTab==='bildirimGonder'){
      const opsForSelect = Object.entries(STATE.operators).filter(([code,v])=>!v.isSuperAdmin).sort((a,b)=>a[0].localeCompare(b[0]));
      const allOpsStatus = Object.entries(STATE.operators).sort((a,b)=>a[0].localeCompare(b[0]));
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">📤 Bildirim Gönder</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:640px">Seçtiğin kişiye anında (bekleme yok) push bildirimi gönderir. Alıcının daha önce "Bildirimlerim" ekranından bildirim izni vermiş olması gerekir — yoksa mesaj sessizce gönderilmez.</div>
        <div class="sec-h" style="margin-top:0">Bildirim Durumu — Kim Açık, Kim Senkronize Etmeli</div>
        <div class="table-wrap" style="padding:0;margin-bottom:24px;max-width:560px"><table><thead><tr><th>Kod</th><th>Ad Soyad</th><th>Rol</th><th>Durum</th></tr></thead><tbody>
          ${allOpsStatus.map(([code,v])=>{
            const tokenCount = v.fcmTokens ? Object.keys(v.fcmTokens).length : 0;
            const rol = v.isSuperAdmin ? 'SuperAdmin' : v.isSef ? 'Şef' : v.isUretimSef ? 'Üretim Şef' : v.isAdmin ? 'Yönetici' : 'Operatör';
            return `<tr>
              <td class="mono" style="color:var(--accent)">${esc(code)}</td>
              <td>${esc(v.displayName||'—')}</td>
              <td style="font-size:11.5px;color:var(--text-muted)">${rol}</td>
              <td>${tokenCount>0 ? `<span style="color:var(--success)">${ico('check',14)} Açık${tokenCount>1?` (${tokenCount} cihaz)`:''}</span>` : `<span style="color:var(--danger)">${ico('alert',14)} Kapalı — senkronize etmeli</span>`}</td>
            </tr>`;
          }).join('')}
        </tbody></table></div>
        <div style="max-width:420px">
          <div class="field"><label>Alıcı</label>
            <select id="mpush-to">
              <option value="">— seç —</option>
              ${opsForSelect.map(([code,v])=>{
                const hasToken = v.fcmTokens && Object.keys(v.fcmTokens).length>0;
                return `<option value="${esc(code)}">${esc(code)} · ${esc(v.displayName)}${v.isSef?' (Şef)':v.isUretimSef?' (Üretim Şef)':v.isAdmin?' (Yönetici)':''}${hasToken?'':' — bildirim izni yok'}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="field"><label>Başlık (opsiyonel)</label><input id="mpush-title" placeholder="Rota Takip"></div>
          <div class="field"><label>Mesaj</label><textarea id="mpush-body" style="min-height:80px" maxlength="500" placeholder="Mesajını yaz..."></textarea></div>
          <button class="btn-primary" onclick="sendManualPush()">📤 Gönder</button>
        </div>
        <div style="margin-top:28px;font-size:13px;font-weight:600;margin-bottom:8px">Son Gönderilenler <span style="font-weight:400;color:var(--text-muted);font-size:11px">(manuel + otomatik, son 50)</span></div>
        ${(()=>{ const history = pushLogHistory(); return history.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px">Henüz hiç bildirim gönderilmemiş.</div>` : `
        <div class="table-wrap" style="padding:0"><table><thead><tr><th>Zaman</th><th>Kaynak</th><th>Kime</th><th>Başlık</th><th>Mesaj</th><th>Gönderen</th><th>Durum</th></tr></thead><tbody>
          ${history.map(h=>`<tr>
            <td style="font-size:11.5px">${fmtDT(h.sentAt)}</td>
            <td style="font-size:11px;color:${h.kaynak==='Manuel'?'var(--accent)':'var(--text-muted)'}">${esc(h.kaynak||h.tag||'—')}</td>
            <td class="mono">${esc(h.toUsername||'—')}</td>
            <td>${esc(h.title||'—')}</td>
            <td style="max-width:280px;white-space:normal">${esc(h.body||'—')}</td>
            <td style="font-size:11.5px">${esc(h.gonderen||'—')}</td>
            <td>${h.sent===true?`<span style="color:var(--success)">${ico('check',14)} Gönderildi</span>`:h.sent===false?`<span style="color:var(--danger)" title="${esc(h.reason||'')}">${ico('x',14)} Başarısız${h.reason==='no-tokens'?' (izin yok)':''}</span>`:`<span style="color:var(--text-muted)">… bekliyor</span>`}</td>
          </tr>`).join('')}
        </tbody></table></div>`; })()}`;
    } else if(settingsSubTab==='stok'){
      const items = stockItemsArray();
      const recentMoves = Object.entries(stockHareketleri).map(([id,v])=>({id,...v})).sort((a,b)=>b.ts-a.ts).slice(0,20);
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Malzeme Stoğu <span style="font-size:11.5px;font-weight:400;color:var(--text-muted)">(opsiyonel modül)</span></div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:640px">Hammadde tüketimi sadece bir iş emrinin <b>ilk operasyonunda</b> sorulur — aynı iş emrinin sonraki adımlarında tekrar sorulmaz, çünkü malzeme zaten ilk kesimde tüketilmiştir.</div>
        <label style="display:flex;align-items:center;gap:10px;background:var(--panel);border:2px solid ${stockEnabled()?'var(--success)':'var(--border)'};border-radius:10px;padding:14px 16px;margin-bottom:22px;cursor:pointer;max-width:480px">
          <input type="checkbox" ${stockEnabled()?'checked':''} onchange="toggleStockTracking()" style="width:auto;transform:scale(1.3)">
          <div>
            <div style="font-size:14px;font-weight:600;color:${stockEnabled()?'var(--success)':'var(--text)'}">Malzeme Stok Takibini ${stockEnabled()?'Aktif':'Kapalı'}</div>
            <div style="font-size:11.5px;color:var(--text-muted)">Kapatırsan bu modülle ilgili hiçbir alan/ekran operatörlere görünmez, hiçbir stok işlemi yapılmaz — tek tuşla tamamen devre dışı kalır.</div>
          </div>
        </label>
        ${!stockEnabled() ? `<div style="font-size:12.5px;color:var(--text-muted)">Modül kapalı. Açtığında aşağıdaki stok kalemi yönetimi ve tüketim geçmişi görünür olacak.</div>` : `
        <div style="max-width:640px;margin-bottom:22px">
          <div style="font-size:13px;font-weight:600;margin-bottom:10px">Yeni Stok Kalemi Ekle</div>
          <div style="display:flex;gap:8px;margin-bottom:10px">
            <button type="button" class="chip ${stokAddTurState==='adet'?'active':''}" onclick="stokAddTurState='adet'; render()">Adet Takip <span style="font-size:10.5px;opacity:.8">(dikdörtgen/kare — 86x100x55 gibi)</span></button>
            <button type="button" class="chip ${stokAddTurState==='boy'?'active':''}" onclick="stokAddTurState='boy'; render()">Boy Takip <span style="font-size:10.5px;opacity:.8">(Ø'li çubuklar — birden fazla çubuk/lot olabilir)</span></button>
          </div>
          ${stokAddTurState==='boy' ? `
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input id="stok-kod" placeholder="Malzeme kodu (ör. 2344)" style="flex:1;min-width:140px">
              <input id="stok-cap" placeholder="Çap (ör. Ø18)" style="width:120px">
              <select id="stok-birim-boy" style="width:90px"><option value="mm">mm</option><option value="cm">cm</option></select>
              <input id="stok-ilk-boy" type="number" placeholder="İlk çubuğun boyu" style="width:150px">
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Aynı kod+çap için sonradan başka çubuk (lot) eklemek istersen, aşağıdaki listeden o kalemin altına "+ Yeni Çubuk" ile ekleyebilirsin.</div>
          ` : `
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input id="stok-kod" placeholder="Kod (ör. 86x100x55)" style="flex:1;min-width:140px">
              <input id="stok-isim" placeholder="İsim (opsiyonel)" style="flex:1.5;min-width:180px">
              <select id="stok-birim" style="width:100px"><option value="adet">Adet</option><option value="kg">Kg</option></select>
              <input id="stok-miktar" type="number" placeholder="Başlangıç miktarı" style="width:140px">
              <select id="stok-mode" style="width:170px"><option value="oto">Otomatik (Adet kadar)</option><option value="manuel">Manuel (operatör girer)</option></select>
            </div>
          `}
          <button class="btn-primary" style="width:auto;padding:10px 18px;margin-top:10px" onclick="addStockItem()">+ Ekle</button>
        </div>
        <div class="sec-h" style="margin-top:0">Stok Kalemleri (${items.length})</div>
        <div class="op-settings-table" style="margin-bottom:26px">
          ${items.length===0 ? `<div style="font-size:12.5px;color:var(--text-muted);padding:12px 4px">Henüz stok kalemi eklenmedi.</div>` : items.map(it=>{
            if(it.tur==='boy'){
              const lots = lotsArray(it);
              return `<div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                  <div><span class="mono" style="font-weight:700;color:var(--accent)">${esc(it.kod)}</span> <span style="color:var(--text-muted);font-size:12.5px">${esc(it.cap||'')} · Boy Takip · ${lots.length} çubuk</span></div>
                  <button class="del-btn" onclick="deleteStockItem('${it.id}')" title="Kalemi tamamen sil">${ico('trash',14)}</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
                  ${lots.length===0 ? `<div style="font-size:12px;color:var(--text-muted)">Çubuk yok.</div>` : lots.map(lot=>`
                    <div style="display:flex;align-items:center;gap:8px">
                      <input type="number" value="${lot.boy}" style="width:110px" onchange="updateStockLot('${it.id}','${lot.id}',this.value)">
                      <span style="font-size:12px;color:var(--text-muted)">${esc(it.birim||'mm')}</span>
                      <button class="del-btn" onclick="deleteStockLot('${it.id}','${lot.id}')" title="Bu çubuğu sil">${ico('trash',14)}</button>
                    </div>
                  `).join('')}
                </div>
                <div style="display:flex;gap:8px">
                  <input id="stok-yeni-boy-${it.id}" type="number" placeholder="Yeni çubuk boyu" style="width:150px">
                  <button class="btn-ghost" style="padding:8px 14px;font-size:12.5px" onclick="addStockLot('${it.id}')">+ Yeni Çubuk</button>
                </div>
              </div>`;
            }
            return `<div class="op-settings-row" style="flex-wrap:wrap;gap:10px">
              <div style="min-width:140px"><div class="mono" style="font-weight:700;color:var(--accent)">${esc(it.kod)}</div><div style="font-size:11.5px;color:var(--text-muted)">${esc(it.isim||'')}</div></div>
              <input type="number" value="${it.miktar}" style="width:110px" onchange="updateStockItemField('${it.id}','miktar',this.value)" title="Mevcut miktar">
              <span style="font-size:12px;color:var(--text-muted)">${esc(it.birim||'adet')}</span>
              <select onchange="updateStockItemField('${it.id}','mode',this.value)" style="width:170px">
                <option value="oto" ${it.mode==='oto'?'selected':''}>Otomatik (Adet kadar)</option>
                <option value="manuel" ${it.mode==='manuel'?'selected':''}>Manuel (operatör girer)</option>
              </select>
              <button class="del-btn" onclick="deleteStockItem('${it.id}')" title="Sil">${ico('trash',14)}</button>
            </div>`;
          }).join('')}
        </div>
        <div class="sec-h" style="margin-top:0">Son Stok Hareketleri</div>
        <table><thead><tr><th>Tarih</th><th>Kalem</th><th>Miktar</th><th>İş Emri</th><th>Kim</th></tr></thead><tbody>
          ${recentMoves.length===0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:16px">Henüz hareket yok.</td></tr>` : recentMoves.map(m=>`
            <tr><td>${fmtDT(m.ts)}</td><td class="mono">${esc(m.itemKod)}${m.itemIsim?` <span style="color:var(--text-muted)">· ${esc(m.itemIsim)}</span>`:''}</td><td style="color:${m.miktar<0?'var(--danger)':'var(--success)'}">${m.miktar>0?'+':''}${m.miktar} ${esc(m.birim||'')}</td><td class="mono">${esc(m.talepNo||m.isEmriNo||'—')}</td><td>${esc(m.operatorName||'')}</td></tr>
          `).join('')}
        </tbody></table>`}`;
    } else if(settingsSubTab==='durusReasons'){
      const list = (STATE.durusReasons && STATE.durusReasons.length>0) ? STATE.durusReasons : DEFAULT_DURUS_REASONS;
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Duruş Nedenleri</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:640px">Operatörlerin "Duruşa Al" derken seçebileceği sebep listesi. İstediğini ekleyip çıkarabilirsin. <b>"Gün Sonu"</b> ve <b>"Diğer"</b> sabittir, listede görünmez ama her zaman operatörün karşısına çıkar — biri hesaplara hiç girmeyen özel bir durum, diğeri serbest metin girişi için gerekli.</div>
        <div style="max-width:480px;margin-bottom:18px">
          <div class="field"><label>Yeni Neden Ekle</label><input id="new-durus-reason" placeholder="ör. Kalite Kontrol Onayı Bekleniyor"></div>
          <button class="btn-primary" style="width:auto;padding:10px 18px" onclick="addDurusReason()">+ Ekle</button>
        </div>
        <div class="sec-h" style="margin-top:0">Mevcut Nedenler (${list.length})</div>
        <div class="op-settings-table">
          ${list.map((r,i)=>`
            <div class="op-settings-row">
              <input id="durus-edit-${i}" value="${esc(r)}" style="flex:1">
              <button class="btn-ghost" onclick="editDurusReason(${i})" title="Kaydet">💾 Kaydet</button>
              <button class="del-btn" onclick="removeDurusReason(${i})" title="Sil">${ico('trash',14)}</button>
            </div>
          `).join('')}
        </div>`;
    } else if(settingsSubTab==='tadilatSablonlari'){
      const list = tadilatOnHazirIstekListesi();
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Tadilat Hazır İfadeleri</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:640px">Tadilat talebi oluşturulurken "Ne işlem yapılacak?" kutusunun üstünde checkbox olarak çıkar — işaretlenince metin otomatik eklenir. Sayısal bir değer isteyen ifadeler için metnin içine <span class="mono">{x}</span> yaz (ör: <span class="mono">Punch önünden {x} mm silinecek.</span>) — operatör o zaman yanına bir sayı kutusu görür.</div>
        <div style="max-width:560px;margin-bottom:18px;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div class="field"><label>Şablon Metni</label><input id="new-onhazir-text" placeholder="ör. Punch önünden {x} mm silinecek."></div>
          <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-muted);margin-bottom:12px;cursor:pointer">
            <input type="checkbox" id="new-onhazir-param" style="width:auto"> Bu ifadede sayısal bir değer var (metinde {x} kullandım)
          </label>
          <button class="btn-primary" style="width:auto;padding:10px 18px" onclick="addTadilatOnHazirIstek()">+ Ekle</button>
        </div>
        <div class="sec-h" style="margin-top:0">Mevcut İfadeler (${list.length})</div>
        ${list.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px">Henüz hazır ifade eklenmemiş.</div>` : `
        <div class="op-settings-table">
          ${list.map(p=>`
            <div class="op-settings-row">
              <span style="flex:1;font-size:13px">${esc(p.text)}${p.hasParam?` <span style="color:var(--accent);font-size:11px">(sayı ister)</span>`:''}</span>
              <button class="del-btn" onclick="removeTadilatOnHazirIstek('${p.id}')" title="Sil">${ico('trash',14)}</button>
            </div>
          `).join('')}
        </div>`}`;
    }
    body += `</div>`;
  } else if(view==='matrix'){
    // Tadilat Atölye makineleri "entries" tablosunda hiç iz bırakmaz (orada sadece üretim işleri
    // var) — tadilat operasyonlarını da senkron kayıt gibi katmazsak bu makineler burada hep
    // "hiç kullanılmadı"/boşta görünür, geçmiş tadilat işleri hiç okunmaz (Analiz ekranı için
    // zaten yapılan aynı düzeltme — bkz. buildTadilatSynthetic).
    const entries = [...entriesArray(), ...buildTadilatSynthetic()];
    const workMsFor = (code) => {
      const label = resolveMachineLabel(code);
      // A1 düzeltmesiyle aynı mantık: "Çoklu İş Emri" (groupId) kayıtları aynı makinede aynı
      // anda birden fazla kayıt oluşturuyor ama fiziksel olarak makine TEK süre meşgul —
      // burada da (sadece sıralama için kullanılsa da) mükerrer sayılmasın diye tekilleştiriyoruz.
      const seenGroups = new Set();
      return entries.filter(e=>e.makine===label).reduce((s,e)=>{
        if(e.groupId){ if(seenGroups.has(e.groupId)) return s; seenGroups.add(e.groupId); }
        const endClip = e.endTs || nowTick;
        const wallMs = Math.max(0, endClip - e.startTs);
        return s + Math.max(0, wallMs - (e.duruşToplamMs||0));
      }, 0);
    };
    const statusPriority = (code) => {
      const label = resolveMachineLabel(code);
      if(tadilatAktifOnMachine(label)) return -1;
      const machineEntries = entries.filter(e=>e.makine===label);
      if(machineEntries.some(e=>e.status==='devam')) return 0;
      if(machineEntries.some(e=>e.status==='duruş')) return 1;
      return 2;
    };
    const sortedMachines = allMachines().slice()
      .filter(m => matrixGroupFilter==='Tümü' || machineGroupOf(m.code)===matrixGroupFilter)
      .filter(m => matrixAtolyeFilter==='tumu' || machineAtolyeOf(m.code)===matrixAtolyeFilter)
      .sort((a,b)=>{
      if(matrixSort==='calisma') return workMsFor(b.code) - workMsFor(a.code);
      if(matrixSort==='renk') return statusPriority(a.code) - statusPriority(b.code) || a.code.localeCompare(b.code);
      return a.code.localeCompare(b.code);
    });
    const groupNames = ['Tümü', ...MACHINE_GROUPS.map(g=>g.name), 'Diğer'];
    body = `<div class="matrix-wrap">
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <button class="chip ${matrixAtolyeFilter==='tumu'?'active':''}" style="font-size:16px;border-width:2px;padding:11px 20px;border-radius:10px" onclick="setMatrixAtolyeFilter('tumu')">Tüm Makineler</button>
        <button class="chip ${matrixAtolyeFilter==='imalat'?'active':''}" style="font-size:16px;border-width:2px;padding:11px 20px;border-radius:10px" onclick="setMatrixAtolyeFilter('imalat')">${ico('factory',14)} İmalat Atölye</button>
        <button class="chip ${matrixAtolyeFilter==='tadilat'?'active':''}" style="font-size:16px;border-width:2px;padding:11px 20px;border-radius:10px" onclick="setMatrixAtolyeFilter('tadilat')">${ico('wrench',14)} Tadilat Atölye</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${groupNames.map(g=>`<button class="chip ${matrixGroupFilter===g?'active':''}" onclick="setMatrixGroupFilter('${g}')">${g}</button>`).join('')}
      </div>
      <div class="matrix-legend">
        <span><span class="legend-dot" style="background:var(--success)"></span>Çalışıyor</span>
        <span><span class="legend-dot" style="background:var(--warn)"></span>Duruşta</span>
        <span><span class="legend-dot" style="background:var(--danger)"></span>Boşta</span>
        <span><span class="legend-dot" style="background:var(--tadilat-info)"></span>Tadilat Yapıyor</span>
        <span style="margin-left:auto;display:flex;gap:8px">
          <button class="chip ${matrixSort==='alpha'?'active':''}" onclick="setMatrixSort('alpha')">Alfabetik</button>
          <button class="chip ${matrixSort==='calisma'?'active':''}" onclick="setMatrixSort('calisma')">Çalışma Süresine Göre</button>
          <button class="chip ${matrixSort==='renk'?'active':''}" onclick="setMatrixSort('renk')">Renge Göre</button>
        </span>
      </div>
      <div class="matrix-grid">`;
    sortedMachines.forEach(m=>{
      const label = `${m.code} · ${m.name}`;
      const tadilatHere = tadilatAktifOnMachine(label);
      const machineEntries = entries.filter(e=>e.makine===label);
      const runningEntries = machineEntries.filter(e=>e.status==='devam');
      const stoppedEntries = machineEntries.filter(e=>e.status==='duruş');
      const running = !tadilatHere && runningEntries.length>0;
      const stopped = !tadilatHere && !running && stoppedEntries.length>0;
      const bg = tadilatHere ? (resolvedTheme()==='light'?'var(--tadilat-soft)':'#3b2a5c') : resolvedTheme()==='light'
        ? (running?'#d1fae5':stopped?'#fef3c7':'#fee2e2')
        : (running?'#1a4d2e':stopped?'#4a3f0a':'#3d1f1f');
      const border = tadilatHere ? 'var(--tadilat-info)' : running?'var(--success)':stopped?'var(--warn)':'var(--danger)';
      const dotColor = tadilatHere ? 'var(--tadilat-info)' : running?'var(--success)':stopped?'var(--warn)':'var(--danger)';
      const lastFinished = (!running&&!stopped&&!tadilatHere) ? machineEntries.slice().sort((a,b)=>b.startTs-a.startTs)[0] : null;
      const durusAlert = uzunDurusUyariEnabled() && stopped && stoppedEntries.some(e=>e.duruşTs && e.duruşNedeni!==GUN_SONU_REASON && (nowTick-e.duruşTs)>=uzunDurusEsikMs());
      body += `<div class="matrix-card${durusAlert?' durus-alert':''}" style="background:${bg};border-color:${durusAlert?'var(--danger)':border};position:relative" onclick="openMachineDetail('${escJs(m.code)}')">
        ${durusAlert ? `<span class="durus-alert-badge" title="Uzun süredir duruşta">${ico('alert',14)}</span>` : ''}
        <div class="matrix-card-top"><span class="matrix-code">${m.code}</span><span class="matrix-dot" style="background:${dotColor}"></span></div>
        <div class="matrix-name">${esc(m.name)}</div>`;
      if(tadilatHere){
        const { tadilat: tt, operasyon: top } = tadilatHere;
        body += `<div class="matrix-sub" style="color:var(--tadilat-info);font-weight:700">${ico('wrench',14)} ${esc(tt.uKodu)}</div>
          <div class="matrix-sub">${esc(top.operatorUsername)} · ${fmtElapsed(tadilatOpDurationBreakdown(top).netMs)}</div>`;
      } else if(running){
        if(runningEntries.length===1){
          const info = runningEntries[0];
          body += `<div class="matrix-sub">${esc(info.talepNo || info.isEmriNo)} · ${esc(info.operatorUsername)}</div>
            <div class="matrix-sub">${fmtElapsed(entryDurationBreakdown(info).netMs)} çalışıyor</div>`;
        } else {
          body += `<div class="matrix-sub" style="font-weight:700">${runningEntries.length} İş Emri Aktif</div>
            <div class="matrix-sub" style="opacity:.7">Detay için tıkla</div>`;
        }
      } else if(stopped){
        if(stoppedEntries.length===1){
          const info = stoppedEntries[0];
          body += `<div class="matrix-sub">${esc(info.talepNo || info.isEmriNo)} · ${esc(info.operatorUsername)}</div>
            <div class="matrix-sub">Duruş: "${esc(info.duruşNedeni)}"</div>`;
        } else {
          body += `<div class="matrix-sub" style="font-weight:700">${stoppedEntries.length} İş Duraklatıldı</div>
            <div class="matrix-sub" style="opacity:.7">Detay için tıkla</div>`;
        }
      } else if(lastFinished){
        body += `<div class="matrix-sub">Son: ${esc(lastFinished.operatorUsername)} · ${fmtDT(lastFinished.startTs)}</div>
          ${lastFinished._isTadilat && lastFinished.aciklama ? `<div class="matrix-sub" style="opacity:.8">${esc(lastFinished.aciklama)}</div>` : ''}`;
      } else {
        body += `<div class="matrix-sub">Hiç kullanılmadı</div>`;
      }
      body += `</div>`;
    });
    body += `</div></div>`;
  } else if(view==='completed'){
    const birlesmeGroups = computeBirlesmeGroups();
    body = `<div class="completed-wrap">
      ${birlesmeGroups.length>0 ? `<div style="display:flex;gap:8px;margin-bottom:14px">
        <button class="tab-btn ${completedViewMode==='tumu'?'active':''}" style="flex:1" onclick="setCompletedViewMode('tumu')">Tüm Rotalar</button>
        <button class="tab-btn ${completedViewMode==='birlesik'?'active':''}" style="flex:1" onclick="setCompletedViewMode('birlesik')">🔗 Çelik + Karbür Birleşimi</button>
      </div>` : ''}`;
    if(completedViewMode==='birlesik' && birlesmeGroups.length>0){
      body += `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px">${birlesmeGroups.length} eşleşme · _ZARF (Çelik) ve _ELMAS (Karbür) aynı İş Emri No altında eşleştirilip shrink-fit birleşme anı gösterilir.</div>`;
      birlesmeGroups.forEach(g=>{
        const branch = (route, running, label) => {
          const talepNo = route ? (route.entries.find(e=>e.talepNo)?.talepNo || '') : '';
          if(route){
            const ms = route.entries.reduce((s,e)=>s+(e.endTs?(e.endTs-e.startTs):0),0);
            return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
              <span>${label}${talepNo?` <span class="mono" style="color:var(--text-muted);font-size:11px">(Talep: ${esc(talepNo)})</span>`:''}</span>
              <span style="color:var(--success)">${ico('check',14)} ${fmtDT(route.finishedAt)} · ${fmtDur(ms)}</span>
            </div>`;
          }
          if(running){
            return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
              <span>${label}</span><span style="color:var(--warn)">${ico('hourglass',13)} Devam ediyor</span>
            </div>`;
          }
          return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span>${label}</span><span style="color:var(--text-muted)">— Henüz başlamadı</span>
          </div>`;
        };
        body += `<div class="completed-card">
          <div class="completed-header">
            <span class="completed-id">${esc(g.base)} ${g.bothDone?ico('check',14):''}</span>
            <span class="completed-meta">${g.bothDone ? `Birleşti: ${fmtDT(g.birlesmeTs)}` : 'Birleşme bekleniyor'}</span>
          </div>
          <div style="font-size:12.5px;margin-top:8px">
            ${branch(g.zarf, g.zarfRunning, '_ZARF (Çelik)')}
            ${branch(g.elmas, g.elmasRunning, '_ELMAS (Karbür)')}
          </div>
        </div>`;
      });
      body += `</div>`;
    } else {
      const routes = computeCompletedRoutes().filter(r => {
        if(!completedSearch) return true;
        const q = completedSearch.toLowerCase();
        return r.isEmriNo.toLowerCase().includes(q) || r.entries.some(e=>(e.talepNo||'').toLowerCase().includes(q));
      });
      body += `<input id="completed-search-input" class="filter-input completed-search" placeholder="İş Emri No / Talep No ara…" value="${esc(completedSearch)}" oninput="setCompletedSearch(this.value)">
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px">${routes.length} tamamlanmış rota</div>`;
      if(routes.length===0){ body += `<div style="text-align:center;color:var(--text-muted);padding:40px 0">Henüz tamamlanan rota yok.</div>`; }
      routes.forEach(r=>{
        const totalMs = r.entries.reduce((sum,e)=>sum+(e.endTs?(e.endTs-e.startTs):0),0);
        const chain = r.entries.map(e=>(e.makine||'').split(' · ')[0]||'—');
        const malz = r.entries.find(e=>e.malzemeCinsi||e.capBoy) || {};
        const malzText = [malz.malzemeCinsi, malz.capBoy].filter(Boolean).join(' · ');
        const bl = bilesenOfCode(r.isEmriNo);
        const blTag = bl ? ` <span style="color:var(--accent);font-weight:600;font-size:11.5px">[${BILESEN_LABEL[bl]}]</span>` : '';
        const talepNo = r.entries.find(e=>e.talepNo)?.talepNo || '';
        const uKodu = baseIsEmriNo(r.isEmriNo);
        body += `<div class="completed-card" onclick="openRouteDetail('${escJs(r.isEmriNo)}', ${r.finishedAt})">
          <div class="completed-header">
            <div>
              <span class="completed-id">${esc(talepNo || r.isEmriNo)} ${ico('check',12)}${blTag}</span>
              ${talepNo ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px" class="mono">U kodu: ${esc(uKodu)}</div>` : ''}
            </div>
            <span class="completed-meta">Tamamlandı: ${fmtDT(r.finishedAt)} · Toplam süre: ${fmtDur(totalMs)} · ${r.entries.length} adım</span>
          </div>
          ${malzText ? `<div style="font-size:12.5px;color:var(--text-muted);margin:6px 0">${esc(malzText)}</div>` : ''}
          <div class="route-chain">${chain.map((c,i)=>`<span class="route-chip">${esc(c)}</span>${i<chain.length-1?'<span class="route-arrow">→</span>':''}`).join('')}</div>
        </div>`;
      });
      body += `${routeModal ? renderRouteModal() : ''}`;
    }
    body += `</div>`;
  } else if(view==='analiz'){
    const visibleAnalizViews = ANALIZ_VIEW_DEFS.filter(v=>isAnalizViewVisible(v.key));
    if(!visibleAnalizViews.some(v=>v.key===analizRole)){
      analizRole = visibleAnalizViews[0] ? visibleAnalizViews[0].key : analizRole;
    }
    const analizRoleBar = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${visibleAnalizViews.map(v=>`<button class="chip ${analizRole===v.key?'active':''}" style="font-size:13px;padding:9px 16px" onclick="setAnalizRole('${v.key}')">${esc(v.label)}</button>`).join('')}
    </div>`;
    if(visibleAnalizViews.length===0){
      body = `<div class="analiz-wrap"><div style="text-align:center;color:var(--text-muted);padding:60px 20px">Analiz sekmesindeki hiçbir görünüm için yetkin yok.</div></div>`;
    } else if(analizRole==='sef'){
      body = `<div class="analiz-wrap">${analizRoleBar}${renderAnalizSefLive()}</div>`;
    } else if(analizRole==='kisi'){
      body = `<div class="analiz-wrap">${analizRoleBar}${renderAnalizKisiBazli()}</div>`;
    } else if(analizRole==='tadilat'){
      body = `<div class="analiz-wrap">${analizRoleBar}${renderAnalizTadilat()}</div>`;
    } else if(analizRole==='saha'){
      body = `<div class="analiz-wrap">${analizRoleBar}${renderAnalizSaha()}</div>`;
    } else {
    const data = computeAnalizData(analizFrom, analizTo, analizAtolyeFilter);
    lastAnalizData = data; // initAnalizCharts (app.js) bunu kullanır — bkz. catalog.js'teki not
    const t = data.totals;
    const durusReasonTotals = {};
    collectDurusEvents(data.perMachine.flatMap(m=>m.entries)).forEach(ev=>{
      if(!Number.isFinite(ev.sureMs) || ev.sureMs<=0) return; // NaN/undefined güvenli
      durusReasonTotals[ev.neden] = (durusReasonTotals[ev.neden]||0) + ev.sureMs;
    });
    const durusEvents = collectDurusEvents(data.perMachine.flatMap(m=>m.entries)).filter(ev=>Number.isFinite(ev.sureMs) && ev.sureMs>0).sort((a,b)=>b.ts-a.ts);

    const hasFilter = analizSelectedMachines.size>0;
    const filteredList = hasFilter ? data.perMachine.filter(m=>analizSelectedMachines.has(m.code)) : [];
    const adetSource = hasFilter ? filteredList : data.perMachine;
    const adetTotal = adetSource.reduce((sum,m)=>sum + m.entries.reduce((s,e)=>s+(Number(e.adet)||0),0), 0);

    // Günlük trend şeridi: her operatörün gün gün dökümü (data.perOperator[].days) zaten
    // aynı ham kayıtlardan (rangeEntries) hesaplanmış çalışma/duruş/fazla mesai içeriyor —
    // bunları tarihe göre toplayıp TÜM ATÖLYE için günlük bir özet çıkarıyoruz. Ayrı bir
    // "kullanılabilirlik" hesabına girmiyoruz (o gün kaç makine kullanıldığı belirsiz
    // olduğundan uydurma bir yüzde üretmemek için) — sadece gerçek çalışma/duruş dakikaları.
    const dailyAgg = {};
    data.perOperator.forEach(op=>op.days.forEach(d=>{
      (dailyAgg[d.tarih] ||= { workMin:0, durusMin:0, overtimeMin:0 });
      dailyAgg[d.tarih].workMin += d.workMin;
      dailyAgg[d.tarih].durusMin += d.durusMin;
      dailyAgg[d.tarih].overtimeMin += d.overtimeMin;
    }));
    const dailyTrend = Object.keys(dailyAgg).sort().map(tarih=>({ tarih, ...dailyAgg[tarih] }));
    const dailyMax = Math.max(...dailyTrend.map(d=>d.workMin+d.durusMin), 1);

    // Duruş Pareto — kümülatif %80 eşiğine kadar olan nedenler kayıpların çoğunu üretiyor.
    const paretoList = Object.entries(durusReasonTotals).map(([neden,ms])=>({neden,ms})).sort((a,b)=>b.ms-a.ms);
    const paretoTotalMs = paretoList.reduce((s,x)=>s+x.ms,0) || 1;
    let paretoCum = 0;
    const pareto = paretoList.map(x=>{
      paretoCum += x.ms;
      const cumPct = Math.round(paretoCum/paretoTotalMs*100);
      const pct = Math.round(x.ms/paretoTotalMs*100);
      return { ...x, pct, cumPct, kritik: (cumPct-pct) < 80 };
    });

    // Makine verimlilik sıralaması, yüksekten düşüğe.
    const machineRank = data.perMachine.slice().sort((a,b)=>b.verimlilik-a.verimlilik);

    // Şu an açık (devam/duruş) iş emirleri — bu sistemde rota kaç adım / teslim tarihi gibi
    // alanlar hiç tutulmadığından, tasarımdaki fiktif "İş Emri İlerleme" tablosu yerine
    // buraya GERÇEK, o an açık olan işler konuyor.
    const acikIsler = entriesArray()
      .filter(e => (e.status==='devam'||e.status==='duruş') && !isFasonMachine(e.makine))
      .sort((a,b) => (a.status==='duruş')-(b.status==='duruş') || a.startTs-b.startTs)
      .slice(0, 8);

    // Veri kalitesi / dikkat kartları — sadece gerçekten tespit edilen anomaliler, uydurma yok.
    const anomaliler = [];
    if(data.anyPhysicalAnomaly) anomaliler.push({ title:'Fiziksel süre anomalisi tespit edildi', body:'En az bir makine/kişi için, o günden gerçekte geçen süreden fazla çalışma hesaplandı — muhtemelen uzun süredir kapatılmamış eski bir kayıt var. Aşağıdaki detaylı tablolardaki uyarı ikonunu taşıyan satırlara bak.', color:'var(--danger)' });
    data.perMachine.filter(m=>m.verimlilikAnomali).forEach(m=>anomaliler.push({ title:`${m.code} — ham verimlilik %100'ü aştı`, body:`Ham hesap %${m.verimlilikRaw} çıktı, %100'e kırpıldı. Muhtemelen çakışan ya da unutulmuş açık bir kayıt var.`, color:'var(--warn)' }));
    anomaliler.push({ title:'Fason makineler analiz dışı', body:'Dış tedarikçiye gönderilen (fason) makineler kapasite hesabına girmiyor — dış süre kendi mesaimizle kıyaslanamaz.', color:'var(--gunsonu)' });
    if(anomaliler.length===1) anomaliler.unshift({ title:'Belirgin bir veri anomalisi yok', body:'Bu tarih aralığında otomatik tespit edilen bir tutarsızlık bulunmuyor.', color:'var(--success)' });

    body = `<div class="analiz-wrap">
      ${analizRoleBar}
      <div class="filter-bar" style="border-bottom:none;padding-left:0;padding-right:0;flex-wrap:wrap;align-items:center">
        <label style="font-size:11.5px;color:var(--text-muted)">Başlangıç</label>
        <input type="date" class="filter-input" value="${esc(analizFrom)}" onchange="setAnalizFrom(this.value)">
        <label style="font-size:11.5px;color:var(--text-muted)">Bitiş</label>
        <input type="date" class="filter-input" value="${esc(analizTo)}" onchange="setAnalizTo(this.value)">
        <button class="chip ${analizFrom===analizTo&&analizTo===dateKey(Date.now())?'active':''}" onclick="setAnalizPreset(1)">Bugün</button>
        <button class="chip" onclick="setAnalizPreset(7)">Son 7 Gün</button>
        <button class="chip" onclick="setAnalizPreset(30)">Son 30 Gün</button>
        <button class="chip" onclick="setAnalizPreset(90)">Son 3 Ay</button>
        <div style="display:flex;gap:24px;margin-left:auto">
          <button class="chip ${analizAtolyeFilter==='tumu'?'active':''}" style="font-size:16px;border-width:2px;padding:11px 20px;border-radius:10px" onclick="setAnalizAtolyeFilter('tumu')">Tüm Makineler</button>
          <button class="chip ${analizAtolyeFilter==='imalat'?'active':''}" style="font-size:16px;border-width:2px;padding:11px 20px;border-radius:10px" onclick="setAnalizAtolyeFilter('imalat')">${ico('factory',14)} İmalat Atölye</button>
          <button class="chip ${analizAtolyeFilter==='tadilat'?'active':''}" style="font-size:16px;border-width:2px;padding:11px 20px;border-radius:10px" onclick="setAnalizAtolyeFilter('tadilat')">${ico('wrench',14)} Tadilat Atölye</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Standart mesai: kullanılan her gün için ${WORKDAY_MINUTES} dk (08:00~${String(Math.floor(WORKDAY_END_MINUTE/60)).padStart(2,'0')}:${String(WORKDAY_END_MINUTE%60).padStart(2,'0')}) · ${String(Math.floor(WORKDAY_END_MINUTE/60)).padStart(2,'0')}:${String(WORKDAY_END_MINUTE%60).padStart(2,'0')}'dan sonrası fazla mesai sayılır</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:14px">
        <div class="analiz-chart-box" style="border-left:3px solid ${t.verimlilik>=70?'var(--success)':t.verimlilik>=40?'var(--warn)':'var(--danger)'}">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;font-weight:600">Verimlilik KPI</div>
          <div class="mono" style="font-size:38px;font-weight:700;line-height:1;margin-top:8px;color:${t.verimlilik>=70?'var(--success)':t.verimlilik>=40?'var(--warn)':'var(--danger)'}">%${t.verimlilik}${t.verimlilikAnomali?` <span style="font-size:14px;color:var(--danger)" title="Ham hesap %${t.verimlilikRaw} çıktı — 100'ü aşan kısım veri anomalisi olabilir">${ico('alert',14)} %${t.verimlilikRaw}</span>`:''}</div>
          <div style="height:6px;background:var(--panel-alt);border-radius:3px;margin-top:12px;overflow:hidden"><div style="height:100%;width:${t.verimlilik}%;background:${t.verimlilik>=70?'var(--success)':t.verimlilik>=40?'var(--warn)':'var(--danger)'};border-radius:3px"></div></div>
          <div style="font-size:10.5px;color:var(--text-muted);margin-top:7px">Çalışma / Kullanılabilirlik · ${fmtDur(t.workMin*60000)} / ${fmtDur(t.availMin*60000)}</div>
        </div>
        <div class="analiz-chart-box"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;font-weight:600">Toplam Çalışma</div><div class="mono" style="font-size:22px;font-weight:700;margin-top:10px;color:var(--success)">${fmtDur(t.workMin*60000)}</div></div>
        <div class="analiz-chart-box"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;font-weight:600">Toplam Duruş</div><div class="mono" style="font-size:22px;font-weight:700;margin-top:10px;color:var(--warn)">${fmtDur(t.durusMin*60000)}</div></div>
        <div class="analiz-chart-box"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;font-weight:600">Toplam Adet${hasFilter?' (Seçili)':''}</div><div class="mono" style="font-size:22px;font-weight:700;margin-top:10px;color:var(--accent)">${adetTotal}</div></div>
        <div class="analiz-chart-box"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;font-weight:600">Fazla Mesai</div><div class="mono" style="font-size:22px;font-weight:700;margin-top:10px;color:${t.overtimeMin>0?'var(--danger)':'var(--text-muted)'}">${t.overtimeMin>0?t.overtimeMin+' dk':'—'}</div></div>
      </div>
      ${dailyTrend.length>1 ? `
      <div class="analiz-chart-box" style="margin-bottom:14px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:4px">
          <div style="font-size:14.5px;font-weight:700">Günlük Çalışma / Duruş Trendi</div>
          <div style="display:flex;gap:16px;font-size:11.5px;color:var(--text-muted)">
            <span style="display:flex;align-items:center;gap:6px"><i style="width:9px;height:9px;border-radius:2px;background:var(--success);display:inline-block"></i>Çalışma</span>
            <span style="display:flex;align-items:center;gap:6px"><i style="width:9px;height:9px;border-radius:2px;background:var(--warn);display:inline-block"></i>Duruş</span>
          </div>
        </div>
        <div style="display:flex;align-items:flex-end;gap:8px;height:170px;padding-top:14px;overflow-x:auto">
          ${dailyTrend.map(d=>{
            const workPct = Math.round(d.workMin/dailyMax*100), durusPct = Math.round(d.durusMin/dailyMax*100);
            const dLabel = d.tarih.slice(5).split('-').reverse().join('.');
            return `<div style="flex:0 0 34px;display:flex;flex-direction:column;justify-content:flex-end;height:100%" title="${esc(d.tarih)} · Çalışma ${fmtDur(d.workMin*60000)} · Duruş ${fmtDur(d.durusMin*60000)}">
              <div style="display:flex;flex-direction:column;justify-content:flex-end;height:100%;border-radius:4px;overflow:hidden;background:var(--panel-alt)">
                <div style="height:${100-workPct-durusPct}%"></div>
                <div style="height:${durusPct}%;background:var(--warn);opacity:.85"></div>
                <div style="height:${workPct}%;background:var(--success)"></div>
              </div>
              <div class="mono" style="text-align:center;font-size:9.5px;color:var(--text-muted);margin-top:6px">${dLabel}</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
      ${data.anyPhysicalAnomaly ? `<div style="display:flex;align-items:center;gap:8px;background:var(--warn-soft);border:1px solid var(--warn-border);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12.5px;color:var(--warn)">${ico('alert',14)} Bu tarih aralığında en az bir makine/kişi için, o günden gerçekte geçen süreden fazla çalışma hesaplandı (muhtemelen uzun süredir kapatılmamış eski bir kayıt var) — ilgili satırlardaki ${ico('alert',12)} ikonuna bak.</div>` : ''}
      ${data.perMachine.length===0 ? '' : `
      <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:14px;margin-bottom:14px">
        <div class="analiz-chart-box">
          <div style="font-size:14.5px;font-weight:700">Duruş Pareto</div>
          <div style="font-size:11px;color:var(--text-muted);margin:2px 0 14px">Kümülatif %80 eşiğine kadar olan nedenler kayıpların çoğunu üretiyor</div>
          ${pareto.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px">Bu aralıkta duruş kaydı yok.</div>` : pareto.slice(0,8).map(p=>`
            <div style="padding:7px 0">
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:5px">
                <span style="font-size:12.5px;font-weight:${p.kritik?'600':'400'};color:${p.kritik?'var(--text)':'var(--text-muted)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.neden)}</span>
                <span style="display:flex;gap:12px;flex-shrink:0">
                  <span class="mono" style="font-size:12.5px;font-weight:600">${fmtDur(p.ms)}</span>
                  <span class="mono" style="font-size:11.5px;color:var(--text-muted)">%${p.cumPct}</span>
                </span>
              </div>
              <div style="height:10px;background:var(--panel-alt);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${p.pct}%;background:${p.kritik?'var(--warn)':'var(--border)'};border-radius:3px"></div>
              </div>
            </div>`).join('')}
        </div>
        <div class="analiz-chart-box">
          <div style="display:flex;align-items:baseline;justify-content:space-between">
            <div style="font-size:14.5px;font-weight:700">Makine Verimliliği</div>
            <div style="font-size:11px;color:var(--text-muted)">${machineRank.length} makine</div>
          </div>
          <div style="margin-top:12px;max-height:322px;overflow-y:auto;padding-right:4px">
            ${machineRank.map(m=>`
              <div style="display:grid;grid-template-columns:56px 1fr 42px;align-items:center;gap:10px;padding:5px 0">
                <div class="mono" style="font-size:12px;color:var(--accent);font-weight:600">${m.code}</div>
                <div style="height:13px;background:var(--panel-alt);border-radius:3px;overflow:hidden;position:relative">
                  <div style="height:100%;width:${m.verimlilik}%;background:${m.verimlilik>=70?'var(--success)':m.verimlilik>=40?'var(--warn)':'var(--danger)'};border-radius:3px"></div>
                  <div style="position:absolute;left:7px;top:0;bottom:0;display:flex;align-items:center;font-size:10px;color:var(--text);opacity:.8;white-space:nowrap;overflow:hidden">${esc(m.name)}</div>
                </div>
                <div class="mono" style="font-size:12px;font-weight:700;text-align:right;color:${m.verimlilik>=70?'var(--success)':m.verimlilik>=40?'var(--warn)':'var(--danger)'}">%${m.verimlilik}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-bottom:20px">
        <div class="analiz-chart-box">
          <div style="font-size:14.5px;font-weight:700">Şu An Açık İşler</div>
          <div style="font-size:11px;color:var(--text-muted);margin:2px 0 14px">O an devam eden ya da duraklatılmış olan iş emirleri</div>
          ${acikIsler.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px">Şu an açık iş yok.</div>` : `
          <div class="table-wrap" style="padding:0"><table><thead><tr><th>İş Emri</th><th>Makine</th><th>Operatör</th><th style="text-align:right">Durum</th></tr></thead><tbody>
            ${acikIsler.map(e=>`<tr>
              <td class="mono" style="color:var(--accent)">${esc(e.talepNo||e.isEmriNo)}</td>
              <td class="mono">${esc((e.makine||'').split(' · ')[0]||'—')}</td>
              <td style="font-size:12.5px">${esc(e.operatorName||e.operatorUsername||'—')}</td>
              <td style="text-align:right">${e.status==='duruş' ? `<span style="color:var(--warn)">Duruşta · ${esc(e.duruşNedeni||'')}</span>` : `<span style="color:var(--success)">${fmtElapsed(entryDurationBreakdown(e).netMs)}</span>`}</td>
            </tr>`).join('')}
          </tbody></table></div>`}
        </div>
        <div class="analiz-chart-box">
          <div style="font-size:14.5px;font-weight:700">Veri Kalitesi ve Dikkat</div>
          <div style="font-size:11px;color:var(--text-muted);margin:2px 0 14px">Rakamlara güvenmeden önce bakılacaklar</div>
          ${anomaliler.map(a=>`
            <div style="display:flex;gap:12px;padding:12px;border:1px solid ${a.color}44;background:${a.color}14;border-radius:10px;margin-bottom:9px">
              <div style="width:5px;border-radius:3px;background:${a.color};flex-shrink:0"></div>
              <div><div style="font-size:12.5px;font-weight:600;color:${a.color}">${esc(a.title)}</div><div style="font-size:11.5px;color:var(--text-muted);margin-top:3px;line-height:1.5">${esc(a.body)}</div></div>
            </div>`).join('')}
        </div>
      </div>`}
      <div style="border-top:1px solid var(--border);padding-top:14px">
        <button class="btn-ghost" onclick="toggleAnalizDetay()">${analizDetayOpen?`${ico('chevronUp',13)} Detaylı analiz araçlarını gizle`:`${ico('chevronDown',13)} Detaylı analiz araçları (Makine / Kişi / Duruş / Mesai)`}</button>
      </div>`;

    if(!analizDetayOpen){
      body += `</div>`;
    } else {
    body += `
      <div class="sub-tabs" style="margin-top:18px">
        <button class="sub-tab-btn ${analizSubTab==='genel'?'active':''}" onclick="setAnalizSubTab('genel')">Genel Analiz</button>
        <button class="sub-tab-btn ${analizSubTab==='makine'?'active':''}" onclick="setAnalizSubTab('makine')">Makine Bazlı Analiz</button>
        <button class="sub-tab-btn ${analizSubTab==='kisi'?'active':''}" onclick="setAnalizSubTab('kisi')">Kişi Bazlı Analiz</button>
        <button class="sub-tab-btn ${analizSubTab==='durus'?'active':''}" onclick="setAnalizSubTab('durus')">Duruş Analizi</button>
        <button class="sub-tab-btn ${analizSubTab==='mesai'?'active':''}" onclick="setAnalizSubTab('mesai')">Mesai Analizi</button>
      </div>`;
    if(data.perMachine.length===0){
      body += `<div style="text-align:center;color:var(--text-muted);padding:40px 0">Bu tarihte kayıt yok.</div></div>`;
    } else if(analizSubTab==='genel'){
      const liveEntries = entriesArray();
      const pieWork = hasFilter ? filteredList.reduce((s,m)=>s+m.workMin,0) : t.workMin;
      const pieDurus = hasFilter ? filteredList.reduce((s,m)=>s+m.durusMin,0) : t.durusMin;
      const pieAvail = hasFilter ? filteredList.reduce((s,m)=>s+m.availMin,0) : t.availMin;
      const pieBosta = Math.max(0, pieAvail - pieWork - pieDurus);
      const pieVerim = pieAvail>0 ? Math.min(100, Math.round((pieWork/pieAvail)*100)) : 0;
      const ganttMachines = hasFilter ? data.perMachine.filter(m=>analizSelectedMachines.has(m.code)) : data.perMachine;
      const filterLabel = hasFilter ? [...analizSelectedMachines].sort().join(', ') : '';

      body += `
      <div class="analiz-charts-row">
        <div class="analiz-chart-box" style="flex:1;max-width:460px;position:relative">
          <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:8px">${hasFilter?`${esc(filterLabel)} — Dağılım`:'Günün Genel Dağılımı'}</div>
          <div style="height:340px;position:relative">
            <canvas id="analiz-pie-chart" data-work="${pieWork}" data-durus="${pieDurus}" data-bosta="${pieBosta}"></canvas>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none">
              <div style="font-family:'JetBrains Mono',monospace;font-size:30px;font-weight:700;color:${pieVerim>=70?'var(--success)':pieVerim>=40?'var(--warn)':'var(--danger)'}">%${pieVerim}</div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Verimlilik</div>
            </div>
          </div>
        </div>
        <div class="analiz-chart-box" style="flex:1;min-width:280px">
          <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <span>Makine Durumu (canlı) — filtrelemek için tıkla</span>
            <span style="display:flex;gap:8px">
              <button class="chip ${analizMiniSort==='alpha'?'active':''}" onclick="setAnalizMiniSort('alpha')">Alfabetik</button>
              <button class="chip ${analizMiniSort==='calisma'?'active':''}" onclick="setAnalizMiniSort('calisma')">Çalışma Süresine Göre</button>
              <button class="chip ${analizMiniSort==='renk'?'active':''}" onclick="setAnalizMiniSort('renk')">Renge Göre</button>
              ${analizSelectedMachines.size>0 ? `<button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="clearAnalizMachineFilter()">${ico('x',14)} Filtreyi Kaldır (${analizSelectedMachines.size})</button>` : ''}
            </span>
          </div>
          <div class="analiz-mini-matrix">
            ${allMachines().filter(m=>analizAtolyeFilter==='tumu' || machineAtolyeOf(m.code)===analizAtolyeFilter).slice().sort((a,b)=>{
              const statusOf = (code) => {
                const running = liveEntries.some(e=>e.makine===resolveMachineLabel(code) && e.status==='devam');
                if(running) return 0;
                const stopped = liveEntries.some(e=>e.makine===resolveMachineLabel(code) && e.status==='duruş');
                return stopped ? 1 : 2;
              };
              if(analizMiniSort==='calisma'){
                const wa = (data.perMachine.find(x=>x.code===a.code)||{}).workMin||0;
                const wb = (data.perMachine.find(x=>x.code===b.code)||{}).workMin||0;
                return wb-wa;
              }
              if(analizMiniSort==='renk'){
                return statusOf(a.code) - statusOf(b.code) || a.code.localeCompare(b.code);
              }
              return a.code.localeCompare(b.code);
            }).map(m=>{
              const running = liveEntries.some(e=>e.makine===`${m.code} · ${m.name}` && e.status==='devam');
              const stopped = !running && liveEntries.some(e=>e.makine===`${m.code} · ${m.name}` && e.status==='duruş');
              const bg = running ? 'var(--success)' : stopped ? 'var(--warn)' : 'var(--danger)';
              const dotColor = running ? '#15803d' : stopped ? '#a16207' : '#b91c1c';
              const selected = analizSelectedMachines.has(m.code);
              const md = data.perMachine.find(x=>x.code===m.code);
              const workText = md ? fmtDur(md.workMin*60000) : '0 dk';
              return `<div class="analiz-mini-cell ${selected?'selected':''}" style="background:${bg}" onclick="toggleAnalizMachineFilter('${escJs(m.code)}')" title="${m.code} · ${esc(m.name)}">
                <div style="display:flex;align-items:flex-start;justify-content:space-between">
                  <span>${m.code}</span>
                  <span style="width:10px;height:10px;border-radius:50%;background:${dotColor};flex-shrink:0"></span>
                </div>
                <div style="font-family:'Inter',sans-serif;font-weight:600;font-size:11px;margin-top:6px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${workText}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="sec-h">Makine Zaman Çizelgesi (Gantt)${analizSelectedMachines.size>0?` — ${esc([...analizSelectedMachines].sort().join(', '))}`:''}</div>
      ${!data.isSingleDay ? `<div style="color:var(--text-muted);padding:14px 0;font-size:13px">Gantt zaman çizelgesi sadece tek bir gün seçiliyken gösterilir. ("Bugün"e basarak ya da Başlangıç = Bitiş yaparak tek güne dönebilirsin.)</div>` : `
      <div style="margin-bottom:12px">
        <div class="analiz-gantt-row" style="margin-bottom:6px">
          <div class="analiz-gantt-label"></div>
          <div style="position:relative;flex:1;height:16px">
            ${[0,2,4,6,8,10,12,14,16,18,20,22].map(h=>`<span style="position:absolute;left:${(h*60/1440)*100}%;font-size:10px;color:var(--text-muted);transform:translateX(-50%)">${String(h).padStart(2,'0')}:00</span>`).join('')}
          </div>
        </div>
        ${ganttMachines.length===0 ? `<div style="color:var(--text-muted);padding:10px 0">Bu makine bu tarihte kullanılmamış.</div>` : ganttMachines.map(m=>{
          const cutoffPct = (WORKDAY_END_MINUTE/1440)*100;
          const segs = renderGanttSegmentsHtml(m.entries, data.dayStartMs, data.dayStartMs+86400000, e=>`${e.isEmriNo||''} · ${e.operatorUsername||''}`);
          return `<div class="analiz-gantt-row">
            <div class="analiz-gantt-label mono">${m.code}<div style="font-size:10px;color:var(--text-muted);font-family:'Inter',sans-serif">%${m.verimlilik}</div></div>
            <div class="analiz-gantt-track">${segs}<div class="analiz-gantt-cutoff" style="left:${cutoffPct}%"></div></div>
          </div>`;
        }).join('')}
      </div>
      `}
      </div>`;
    } else if(analizSubTab==='makine'){
      body += `
      <div class="analiz-charts-row">
        <div class="analiz-chart-box" style="flex:1"><div style="font-size:12.5px;color:var(--text-muted);margin-bottom:8px">Makine Bazlı Çalışma / Duruş (dk)</div><div style="height:280px"><canvas id="analiz-bar-chart"></canvas></div></div>
      </div>
      <div class="sec-h">Makine Bazlı Verimlilik Tablosu</div>
      <div class="table-wrap" style="padding:0"><table><thead><tr>
        <th>Makine</th><th>Operatör(ler)</th><th>Çalışma</th><th>Duruş</th><th>Kullanılabilirlik</th><th>Verimlilik</th><th>Fazla Mesai</th>
      </tr></thead><tbody>
        ${data.perMachine.map(m=>`<tr style="cursor:pointer" onclick="openMachineDetail('${escJs(m.code)}')" title="Günlük detay ve zaman çizelgesini aç">
          <td class="mono" style="color:var(--accent)">${m.code}<div style="font-size:11px;color:var(--text-muted);font-family:'Inter',sans-serif">${esc(m.name)}</div></td>
          <td style="font-size:12px">${m.operators.map(esc).join('<br>')}</td>
          <td>${fmtDur(m.workMin*60000)}${m.hasPhysicalAnomaly?` <span style="color:var(--danger)" title="Bu makinede, o günkü gerçek geçen süreden fazla çalışma hesaplandı — muhtemelen uzun süredir kapatılmamış eski bir kayıt var. Değer fiziksel üst sınıra çekildi, ama gerçek kaynağını (unutulmuş açık iş) bulup kapatman gerekiyor.">${ico('alert',14)}</span>`:''}</td>
          <td style="color:${m.durusMin>0?'var(--warn)':'inherit'}">${fmtDur(m.durusMin*60000)}</td>
          <td>${m.availMin} dk</td>
          <td><span style="color:${m.verimlilik>=70?'var(--success)':m.verimlilik>=40?'var(--warn)':'var(--danger)'};font-weight:700">%${m.verimlilik}</span>${m.verimlilikAnomali?` <span style="color:var(--danger)" title="Ham hesap %${m.verimlilikRaw} çıktı — veri anomalisi olabilir (ör. çakışan/hatalı kayıt), kontrol et">${ico('alert',14)}</span>`:''}</td>
          <td>${m.overtimeMin>0?`<span style="color:var(--danger);font-weight:600">${m.overtimeMin} dk</span>`:'—'}</td>
        </tr>`).join('')}
      </tbody></table></div>
      </div>`;
    } else if(analizSubTab==='kisi'){
      body += `
      <div class="sec-h" style="margin-top:0">Kişi Bazlı Özet</div>
      ${data.perOperator.length===0 ? `<div style="color:var(--text-muted);padding:20px 0">Bu tarih aralığında kayıt yok.</div>` : `
      <div class="table-wrap" style="padding:0"><table><thead><tr>
        <th></th><th>Operatör</th><th>Çalışma</th><th>Duruş</th><th>Fazla Mesai</th><th>Makine Sayısı</th><th>Çalışılan Gün</th>
      </tr></thead><tbody>
        ${data.perOperator.map(op=>`
        <tr style="cursor:pointer" onclick="setAnalizOperator('${escJs(op.operatorUsername)}')">
          <td style="width:20px;color:var(--text-muted)">${analizSelectedOperator===op.operatorUsername?'▾':'▸'}</td>
          <td class="mono" style="color:var(--accent)">${esc(op.operatorUsername)}<div style="font-size:11px;color:var(--text-muted);font-family:'Inter',sans-serif">${esc(op.operatorName||'')}</div></td>
          <td>${fmtDur(op.workMin*60000)}${op.hasPhysicalAnomaly?` <span style="color:var(--danger)" title="Bu kişide, bir günde gerçek geçen süreden fazla çalışma hesaplandı — muhtemelen uzun süredir kapatılmamış eski bir kayıt var. Değer fiziksel üst sınıra çekildi, ama gerçek kaynağını (unutulmuş açık iş) bulup kapatman gerekiyor.">${ico('alert',14)}</span>`:''}</td>
          <td style="color:${op.durusMin>0?'var(--warn)':'inherit'}">${fmtDur(op.durusMin*60000)}</td>
          <td>${op.overtimeMin>0?`<span style="color:var(--danger);font-weight:600">${op.overtimeMin} dk</span>`:'—'}</td>
          <td>${op.machineCount}</td>
          <td>${op.daysUsed}</td>
        </tr>
        ${analizSelectedOperator===op.operatorUsername ? `
        <tr><td colspan="7" style="padding:0;background:var(--bg)">
          <div style="padding:14px 16px 18px 40px">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Gün gün dökümü — standart mesai: ${WORKDAY_MINUTES} dk. "Boşta": o günkü kullanılabilirlikten (standart mesai + fazla mesai) çalışma ve duruş süresi düşülünce kalan, hiçbir kayda denk gelmeyen süre.</div>
            <div class="table-wrap" style="padding:0"><table><thead><tr>
              <th>Tarih</th><th>Makineler</th><th>Çalışma</th><th>Duruş</th><th>Boşta</th><th>Fazla Mesai</th><th>Kalan Mesai</th>
            </tr></thead><tbody>
              ${op.days.map(d=>{
                const dStartMs = new Date(d.tarih+'T00:00:00').getTime();
                const availMin = WORKDAY_MINUTES + d.overtimeMin;
                const idleMin = Math.max(0, availMin - d.workMin - d.durusMin);
                const segs = renderGanttSegmentsHtml(d.entries||[], dStartMs, dStartMs+86400000, e=>`${e.isEmriNo||e.talepNo||''} · ${e.makine||''}`);
                return `<tr>
                <td class="mono">${esc(d.tarih)}</td>
                <td style="font-size:12px">${d.machines.map(m=>`<span class="mono" style="color:var(--accent)">${esc(m.code)}</span> (${fmtDur(m.workMin*60000)})`).join('<br>')}</td>
                <td>${fmtDur(d.workMin*60000)}${d.hasPhysicalAnomaly?` <span style="color:var(--danger)" title="O gün, gerçek geçen süreden fazla çalışma hesaplandı — fiziksel üst sınıra çekildi.">${ico('alert',14)}</span>`:''}</td>
                <td style="color:${d.durusMin>0?'var(--warn)':'inherit'}">${fmtDur(d.durusMin*60000)}</td>
                <td style="color:var(--text-muted)">${fmtDur(idleMin*60000)}</td>
                <td>${d.overtimeMin>0?`<span style="color:var(--danger);font-weight:600">${d.overtimeMin} dk</span>`:'—'}</td>
                <td style="color:${d.kalanMin>0?'var(--text-muted)':'var(--success)'}">${d.kalanMin>0?fmtDur(d.kalanMin*60000):'Tamamlandı'}</td>
              </tr>
              <tr><td colspan="7" style="padding:2px 0 12px">
                <div class="analiz-gantt-row" style="margin-bottom:0">
                  <div class="analiz-gantt-label" style="width:0"></div>
                  <div class="analiz-gantt-track">${segs}<div class="analiz-gantt-cutoff" style="left:${(WORKDAY_END_MINUTE/1440)*100}%"></div></div>
                </div>
              </td></tr>`;
              }).join('')}
            </tbody></table></div>
            <div style="display:flex;gap:14px;font-size:11px;color:var(--text-muted);margin-top:8px">
              <span><span style="display:inline-block;width:10px;height:10px;background:var(--success);border-radius:2px;margin-right:4px"></span>Çalışma</span>
              <span><span style="display:inline-block;width:10px;height:10px;background:var(--warn);border-radius:2px;margin-right:4px"></span>Duruş</span>
              <span><span style="display:inline-block;width:10px;height:10px;background:var(--panel-alt);border:1px solid var(--border);border-radius:2px;margin-right:4px"></span>Boşta / kayıt yok</span>
              <span><span style="display:inline-block;width:10px;height:10px;background:#3a4148;border-radius:2px;margin-right:4px"></span>Gün Sonu (hariç tutulan)</span>
            </div>
          </div>
        </td></tr>` : ''}
        `).join('')}
      </tbody></table></div>`}
      </div>`;
    } else if(analizSubTab==='durus'){
      body += `
      <div class="analiz-charts-row">
        <div class="analiz-chart-box" style="flex:1;max-width:420px"><div style="font-size:12.5px;color:var(--text-muted);margin-bottom:8px">Duruş Nedenlerine Göre Dağılım</div><div style="height:260px"><canvas id="analiz-durus-chart"></canvas></div></div>
      </div>
      <div class="sec-h">Duruş Kayıtları</div>
      ${durusEvents.length===0 ? `<div style="color:var(--text-muted);padding:20px 0">Bu tarihte duruş kaydı yok.</div>` : `
      <div class="table-wrap" style="padding:0"><table><thead><tr><th>Makine</th><th>Operatör</th><th>İş Emri No</th><th>Neden</th><th>Duruş Süresi</th></tr></thead><tbody>
        ${durusEvents.map(ev=>`<tr><td class="mono" style="color:var(--accent)">${esc((ev.entry.makine||'').split(' · ')[0])}</td><td>${esc(ev.entry.operatorUsername)} · ${esc(ev.entry.operatorName)}</td><td class="mono">${esc(ev.entry.isEmriNo)}</td><td style="color:var(--warn)">${esc(ev.neden)}${ev.live?' <span style="color:var(--text-muted);font-size:10px">(devam ediyor)</span>':''}</td><td style="font-weight:600">${fmtDur(ev.sureMs)}</td></tr>`).join('')}
      </tbody></table></div>`}
      </div>`;
    } else if(analizSubTab==='mesai'){
      body += `
      ${data.overtimeList.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:40px 0">Bu tarihte fazla mesai yok.</div>` : `
      <div class="analiz-charts-row">
        <div class="analiz-chart-box" style="flex:1"><div style="font-size:12.5px;color:var(--text-muted);margin-bottom:8px">Makine Bazlı Fazla Mesai (dk)</div><div style="height:240px"><canvas id="analiz-mesai-chart"></canvas></div></div>
      </div>
      <div class="sec-h" style="color:var(--danger)">${ico('alert',14)} Fazla Mesai Raporu (17:30 sonrası)</div>
      <div class="table-wrap" style="padding:0"><table><thead><tr><th>Makine</th><th>Operatör</th><th>İş Emri No</th><th>Fazla Mesai</th></tr></thead><tbody>
        ${data.overtimeList.map(o=>`<tr><td class="mono" style="color:var(--accent)">${esc(o.makine.split(' · ')[0])}</td><td>${esc(o.operatorUsername)} · ${esc(o.operatorName)}</td><td class="mono">${esc(o.isEmriNo)}</td><td style="color:var(--danger);font-weight:600">${o.overtimeMin} dk</td></tr>`).join('')}
      </tbody></table></div>`}
      </div>`;
    }
    }
    }
  } else if(view==='tadilatYonetim'){
    const renderBekleyenCard = (t) => {
      const expanded = tadilatExpandedIds.has(t.id);
      const gecmis = tadilatOperasyonlarArray(t).filter(o=>o.status==='tamamlandi');
      return `<div class="completed-card" style="cursor:pointer" onclick="toggleTadilatExpand('${t.id}')">
        <div class="completed-header">
          <span class="completed-id mono" style="color:var(--warn)">${ico('hourglass',13)} ${esc(t.uKodu)}${tadilatKisaLabel(t)?` <span style="color:var(--text-muted);font-weight:400;font-size:.75em">${esc(tadilatKisaLabel(t))}</span>`:''}</span>
          <span class="completed-meta">${expanded?ico('chevronUp',12):ico('chevronDown',12)}</span>
        </div>
        ${expanded ? `
          <div style="font-size:12.5px;color:var(--text-muted);margin:8px 0 4px">${fmtDT(t.olusturmaTs)} · ${esc(t.olusturanName)}</div>
          <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:6px">${t.talepEdenKisi?`Talep eden: ${esc(t.talepEdenKisi)} · `:''}${t.bolum?`Bölüm: ${esc(t.bolum)} · `:''}${t.talepMakine?`Makine: ${esc(t.talepMakine)} · `:''}${t.adet?`Adet: ${esc(t.adet)}`:''}</div>
          <div style="font-size:13px;margin-bottom:10px">${esc(t.aciklama)}</div>
          ${gecmis.length>0 ? `<div style="font-size:11.5px;color:var(--accent);margin-bottom:10px">${ico('repeat',13)} ${gecmis.length} operasyon tamamlandı (${gecmis.map(o=>esc(o.operatorName)).join(', ')}), devamı bekleniyor</div>` : ''}
          <div style="display:flex;gap:8px">
            ${resimBulEnabled() ? `<button class="del-btn" onclick="event.stopPropagation(); resimBul('${escJs(t.uKodu)}')" title="Resim/Çizim Bul">${ico('camera',14)} Resim Bul</button>` : ''}
            ${canCreateTadilat() ? `<button class="del-btn" onclick="event.stopPropagation(); openTadilatEdit('${t.id}')" title="Düzelt">${ico('edit',14)} Düzelt</button>` : ''}
            ${session.isSuperAdmin ? `<button class="del-btn" onclick="event.stopPropagation(); deleteTadilat('${t.id}')" title="Talebi sil">${ico('trash',14)} Sil</button>` : ''}
          </div>
        ` : ''}
      </div>`;
    };
    const renderDevamCard = (t) => {
      const op = tadilatAktifOperasyon(t);
      return `<div class="completed-card">
        <div class="completed-header">
          <span class="completed-id mono">${esc(t.uKodu)}</span>
          <span class="completed-meta" style="color:var(--accent)">${esc(op.operatorUsername)} · ${esc(op.operatorName)} · ${fmtElapsed(tadilatOpDurationBreakdown(op).netMs)}</span>
        </div>
        ${op.makine ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${ico('factory',14)} ${esc(op.makine)}</div>` : ''}
      </div>`;
    };
    const myAtolyelerAdmin = getUserAtolyeler(session.username);
    body = `<div class="body-pad">
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <button class="tab-btn ${tadilatSubTab==='talepler'?'active':''}" onclick="setTadilatSubTab('talepler')">Talepler</button>
        ${(session.isSuperAdmin || session.isSef || session.isUretimSef) ? `<button class="tab-btn ${tadilatSubTab==='canli'?'active':''}" onclick="setTadilatSubTab('canli')">📍 Devam Eden</button>` : ''}
        ${canViewTadilatAnaliz() ? `<button class="tab-btn ${tadilatSubTab==='analiz'?'active':''}" onclick="setTadilatSubTab('analiz')">${ico('chart',14)} Analiz</button>` : ''}
      </div>`;
    if(tadilatSubTab==='canli' && (session.isSuperAdmin || session.isSef || session.isUretimSef)){
      const myAtolyelerCanli = getUserAtolyeler(session.username);
      const aktifler = tadilatArray()
        .map(t=>({ t, op: tadilatAktifOperasyon(t) }))
        .filter(x=>x.op && myAtolyelerCanli.includes(x.t.atolye||'imalat'))
        .sort((a,b)=>a.op.baslamaTs-b.op.baslamaTs);
      body += `
      <div style="font-size:16px;font-weight:600;margin-bottom:6px">Devam Eden Tadilatlar — Canlı Takip</div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:640px">Şu an aktif olarak işlenmekte olan tadilatlar — hangi makinede, kim tarafından, ne zamandır. Sadece kendi atölyen/atölyelerin (${myAtolyelerCanli.map(a=>a==='tadilat'?(ico('wrench',13)+' Tadilat'):(ico('factory',13)+' İmalat')).join(' + ')}) gösteriliyor.</div>
      <div class="table-wrap"><table><thead><tr><th>Atölye</th><th>U Kodu</th><th>Makine</th><th>Operatör</th><th>Başlangıç</th><th>Süre</th><th>Son Operasyon mu</th></tr></thead><tbody>
        ${aktifler.length===0 ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">Şu an devam eden tadilat yok.</td></tr>` : aktifler.map(({t,op})=>`
          <tr>
            <td>${(t.atolye||'imalat')==='tadilat'?(ico('wrench',13)+' Tadilat'):(ico('factory',13)+' İmalat')}</td>
            <td class="mono" style="color:var(--accent);font-weight:600">${esc(t.uKodu)}</td>
            <td>${esc(op.makine||'—')}</td>
            <td>${esc(op.operatorUsername)} · ${esc(op.operatorName)}</td>
            <td>${fmtDT(op.baslamaTs)}</td>
            <td style="color:var(--tadilat-info);font-weight:700">${fmtElapsed(tadilatOpDurationBreakdown(op).netMs)}</td>
            <td>${op.sonOperasyon?'—':'<span style="color:var(--warn)">Hayır, devamı gelecek</span>'}</td>
          </tr>
        `).join('')}
      </tbody></table></div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:10px">${aktifler.length} tadilat şu an aktif.</div>
    `;
    } else if(tadilatSubTab==='analiz' && canViewTadilatAnaliz()){
      body += `
      <div style="font-size:16px;font-weight:600;margin-bottom:6px">Tadilat Analizi</div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:900px">Analiz sekmesindeki "Tadilat" görünümüyle aynı (bkz. renderAnalizTadilat) — açık/tamamlanan talep KPI'ları dahil, bir satıra tıklayınca açılış→başlama→bitiş akış şeması açılır.</div>
      ${renderAnalizTadilat()}
      ${beklemeDetayId ? renderBeklemeDetayModal() : ''}`;
    } else {
      body += `
      <div style="font-size:16px;font-weight:600;margin-bottom:6px">Tadilat Talepleri</div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:900px">Operatörler bu listeden bekleyen bir talebi alıp çalışır. "Son Operasyon" işaretlenene kadar talep tekrar tekrar bekleyenlere düşebilir (çok operasyonlu tadilatlar için). Bitirdiklerinde, varsa duraklattıkları üretim işi otomatik olarak "${TADILAT_SONRASI_REASON}" duruşuna geçer.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start">
        <div>
          <div style="font-size:16px;font-weight:700;margin-bottom:14px">Yeni Tadilat Talebi</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            <input id="tad-ukodu" class="mono" placeholder="U kodu" value="${esc(newTadilatForm.uKodu)}" oninput="newTadilatForm.uKodu=this.value" onblur="tadUkoduBlur('new')" style="flex:1;min-width:120px;padding:12px 14px;font-size:14.5px">
            <button type="button" class="btn-ghost" style="padding:0 14px" title="Malzeme Ara" onclick="openMalzemeArama('new')">${ico('search',14)}</button>
            <input id="tad-kisaaciklama" placeholder="Açıklama (zorunlu)" value="${esc(newTadilatForm.kisaAciklama)}" oninput="newTadilatForm.kisaAciklama=this.value; newTadilatForm.aciklamaManual=true" style="flex:1.5;min-width:140px;padding:12px 14px;font-size:14.5px">
            <input id="tad-adet" inputmode="numeric" placeholder="Adet (zorunlu)" value="${esc(newTadilatForm.adet)}" style="width:110px;padding:12px 14px;font-size:14.5px" oninput="this.value=this.value.replace(/\\D/g,''); newTadilatForm.adet=this.value">
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px">
            <input id="tad-bolum" list="tadilat-bolum-options" placeholder="Talep eden bölüm (seç ya da yaz) (zorunlu)" value="${esc(newTadilatForm.bolum)}" oninput="newTadilatForm.bolum=this.value" onblur="render()" style="flex:1;min-width:140px;padding:12px 14px;font-size:14.5px">
            <input id="tad-makine" list="tadilat-makine-options" placeholder="Talep edilen makine (zorunlu)" value="${esc(newTadilatForm.talepMakine)}" oninput="newTadilatForm.talepMakine=this.value" style="flex:1;min-width:140px;padding:12px 14px;font-size:14.5px">
          </div>
          <datalist id="tadilat-bolum-options">${tadilatBolumOptions().map(b=>`<option value="${b}">`).join('')}</datalist>
          <datalist id="tadilat-makine-options">${isMerkezleriFor(newTadilatForm.bolum).map(k=>`<option value="${esc(k)}">`).join('')}</datalist>
          <input id="tad-kisi" list="uretim-personeli-options" placeholder="Talep eden kişi (ad soyad) (zorunlu)" value="${esc(newTadilatForm.talepKisi)}" oninput="newTadilatForm.talepKisi=this.value" style="margin-bottom:10px;padding:12px 14px;font-size:14.5px">
          <datalist id="uretim-personeli-options">${uretimPersoneliFor(newTadilatForm.bolum).map(p=>`<option value="${esc(p)}">`).join('')}</datalist>
          ${myAtolyelerAdmin.length>1 ? `
          <select id="tad-atolye" style="margin-bottom:10px;padding:12px 14px;font-size:14.5px" onchange="tadilatFormAtolyeSet(this.value)">
            ${myAtolyelerAdmin.includes('imalat') ? `<option value="imalat" ${tadilatFormAtolyeGet()==='imalat'?'selected':''}>${ico('factory',14)} İmalat Atölye</option>` : ''}
            ${myAtolyelerAdmin.includes('tadilat') ? `<option value="tadilat" ${tadilatFormAtolyeGet()==='tadilat'?'selected':''}>${ico('wrench',14)} Tadilat Atölye</option>` : ''}
          </select>` : `
          <input type="hidden" id="tad-atolye" value="${myAtolyelerAdmin[0]}">
          <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">Atölye: ${myAtolyelerAdmin[0]==='tadilat'?(ico('wrench',14)+' Tadilat Atölye'):(ico('factory',14)+' İmalat Atölye')} <span style="opacity:.7">(tek atölyene açılıyor)</span></div>`}
          ${tadilatOnHazirIstekListesi().length>0 ? `
          <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:12px">
            <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:6px">Hazır ifadeler — işaretlediğin, açıklamaya otomatik eklenir</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 14px">
              ${tadilatOnHazirIstekListesi().map(p=>{
                const sel = tadPresetSelections[p.id] || {checked:false, value:''};
                return `<label style="display:flex;align-items:center;gap:5px;padding:3px 0;cursor:pointer;font-size:12px">
                  <input type="checkbox" style="width:auto;flex-shrink:0;transform:scale(.85)" ${sel.checked?'checked':''} onchange="toggleTadPreset('${p.id}')">
                  <span>${esc(p.hasParam ? p.text.split('{x}')[0] : p.text)}</span>
                  ${p.hasParam ? `<input type="text" inputmode="decimal" placeholder="x" value="${esc(sel.value||'')}" oninput="setTadPresetValue('${p.id}', this.value)" style="width:34px;flex-shrink:0;padding:2px 4px;font-size:12px;display:inline-block">
                  <span style="flex-shrink:0">${esc(p.text.split('{x}')[1]||'')}</span>` : ''}
                </label>`;
              }).join('')}
            </div>
          </div>` : ''}
          <textarea id="tad-aciklama" placeholder="Ne işlem yapılacak?" oninput="newTadilatForm.aciklama=this.value" style="min-height:110px;margin-bottom:14px;padding:12px 14px;font-size:14.5px">${esc(newTadilatForm.aciklama)}</textarea>
          <button class="btn-primary" style="width:100%;padding:15px 0;font-size:15.5px" onclick="addTadilat()">+ Talep Oluştur</button>
        </div>
        <div style="max-height:calc(100vh - 300px);overflow-y:auto;padding-right:4px">
          ${myAtolyelerAdmin.map(a=>{
            const list = tadilatBekleyenler(a);
            return `<div class="sec-h" style="margin-top:0">${a==='tadilat'?(ico('wrench',14)+' Tadilat Atölye'):(ico('factory',14)+' İmalat Atölye')} — Bekleyen (${list.length})</div>
            <div style="margin-bottom:20px">
              ${list.length===0 ? `<div style="font-size:12.5px;color:var(--text-muted)">Bekleyen talep yok.</div>` : list.map(renderBekleyenCard).join('')}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }
    body += `</div>`;
  } else {
    const entries = entriesArray();
    const statOperator = new Set(entries.map(e=>e.operatorUsername)).size;
    const statMakine = new Set(entries.map(e=>e.makine)).size;
    const fe = filteredEntries();
    reportVisibleIds = fe.map(e=>e.id);
    const completedRoutes = computeCompletedRouteIds();
    // A1 düzeltmesi: aynı groupId'ye sahip kayıtlar (Çoklu İş Emri) mükerrer sayılmasın.
    const seenGroupsRapor = new Set();
    const toplamDurusMs = fe.reduce((s,e)=>{
      if(e.groupId){ if(seenGroupsRapor.has(e.groupId)) return s; seenGroupsRapor.add(e.groupId); }
      return s+effectiveDurusMs(e);
    },0);
    const bekleyenPartiler = pendingPartiList();
    body = `
      <div class="admin-stats">
        <span><b style="color:var(--accent)">${statOperator}</b> operatör kayıt girmiş</span>
        <span><b style="color:var(--accent)">${statMakine}</b> / ${allMachines().length} makine kullanılmış</span>
        <span><b style="color:var(--accent)">${entries.length}</b> toplam kayıt</span>
        <span><b style="color:var(--warn)">${fmtDur(toplamDurusMs)}</b> toplam duruş (filtreye göre)</span>
        ${bekleyenPartiler.length>0 ? `<span><b style="color:var(--warn)">${ico('shuffle',14)} ${bekleyenPartiler.length}</b> bekleyen parti (devralınmamış)</span>` : ''}
        <button class="btn-ghost" style="margin-left:auto" onclick="toggleMachineListView()">${showMachineList?'Makine Kodlarını Gizle':'Makine Kodlarını Göster'}</button>
      </div>
      ${bekleyenPartiler.length>0 ? `<div style="background:var(--warn-soft);border:2px solid var(--warn);border-radius:12px;padding:14px 16px;margin:0 24px 16px">
        <div style="font-size:13.5px;font-weight:700;color:var(--warn);margin-bottom:8px">${ico('shuffle',14)} Devralınmayı Bekleyen ${bekleyenPartiler.length} Parti Var</div>
        ${bekleyenPartiler.map(p=>`<div style="font-size:12.5px;color:var(--text-muted);padding:4px 0"><span class="mono" style="color:var(--accent);font-weight:700">${esc(p.talepNo||p.isEmriNo)}</span> — ${esc(p.adet)} adet, ${esc(p.makine)} makinesinden aktarıldı (${fmtDT(p.endTs)})</div>`).join('')}
      </div>` : ''}
      ${showMachineList ? `<div class="machine-grid" style="padding:12px 24px;border-bottom:1px solid var(--border)">${allMachines().map(m=>`<div class="machine-chip"><span class="mono" style="color:var(--accent);font-weight:700">${m.code}</span> ${esc(m.name)}</div>`).join('')}</div>` : ''}
      <div class="filter-bar" style="position:relative">
        <div style="position:relative">
          <button class="filter-input" style="cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px" onclick="toggleReportOperatorDropdown()">
            <span>${reportOperatorFilter.size===0?'Tüm Operatörler':`${reportOperatorFilter.size} Operatör Seçili`}</span>
            <span style="font-size:10px;color:var(--text-muted)">${ico('chevronDown',10)}</span>
          </button>
          ${reportOperatorDropdownOpen ? `<div class="dropdown-panel">
            ${reportOperatorFilter.size>0 ? `<button class="btn-ghost" style="width:100%;margin-bottom:6px;font-size:12px" onclick="clearReportOperatorFilter()">${ico('x',14)} Seçimi Temizle</button>` : ''}
            ${operatorEntries.map(([code,v])=>`
              <label class="dropdown-item"><input type="checkbox" ${reportOperatorFilter.has(code)?'checked':''} onchange="toggleReportOperatorSelect('${code}')"><span>${code} · ${esc(v.displayName)}</span></label>
            `).join('')}
          </div>` : ''}
        </div>
        <input id="report-search-isemri" class="filter-input" placeholder="İş Emri No / Talep No ara…" value="${esc(reportFilter.isEmriNo)}" oninput="setReportFilterFieldLight('isEmriNo', this.value)">
        <div style="position:relative">
          <button class="filter-input" style="cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px" onclick="toggleReportMakineDropdown()">
            <span>${reportMakineFilter.size===0?'Tüm Makineler':`${reportMakineFilter.size} Makine Seçili`}</span>
            <span style="font-size:10px;color:var(--text-muted)">${ico('chevronDown',10)}</span>
          </button>
          ${reportMakineDropdownOpen ? `<div class="dropdown-panel">
            ${reportMakineFilter.size>0 ? `<button class="btn-ghost" style="width:100%;margin-bottom:6px;font-size:12px" onclick="clearReportMakineFilter()">${ico('x',14)} Seçimi Temizle</button>` : ''}
            ${allMachines().map(m=>{ const label=`${m.code} · ${m.name}`; return `<label class="dropdown-item"><input type="checkbox" ${reportMakineFilter.has(label)?'checked':''} onchange="toggleReportMakineSelect('${esc(label)}')"><span>${esc(label)}</span></label>`; }).join('')}
          </div>` : ''}
        </div>
        <input type="date" class="filter-input" value="${esc(reportFilter.tarihFrom)}" onchange="setReportFilterField('tarihFrom', this.value)" title="Başlangıç">
        <input type="date" class="filter-input" value="${esc(reportFilter.tarihTo)}" onchange="setReportFilterField('tarihTo', this.value)" title="Bitiş">
        <button class="chip" onclick="setReportDatePreset(1)">Bugün</button>
        <button class="chip" onclick="setReportDatePreset(7)">Son 7 Gün</button>
        <button class="chip" onclick="setReportDatePreset(30)">Son 30 Gün</button>
        <button class="chip" onclick="setReportDatePreset(90)">Son 3 Ay</button>
        ${(reportOperatorFilter.size>0||reportFilter.isEmriNo||reportMakineFilter.size>0||reportFilter.tarihFrom||reportFilter.tarihTo) ? `<button class="btn-ghost" onclick="clearReportFilter()">${ico('x',14)} Temizle</button>` : ''}
        ${canDeleteReport() && reportSelectedIds.size>0 ? `<button class="btn-ghost" style="border-color:var(--danger);color:var(--danger)" onclick="deleteReportSelected()">${ico('trash',14)} Seçilenleri Sil (${reportSelectedIds.size})</button>` : ''}
        <button class="btn-primary" style="width:auto;margin-left:auto;padding:8px 16px" onclick="exportExcel()">⬇ Excel'e Aktar (${fe.length})</button>
      </div>
      <div class="table-wrap"><table><thead><tr>
        ${canDeleteReport() ? `<th style="width:26px"><input type="checkbox" ${reportVisibleIds.length>0 && reportVisibleIds.every(id=>reportSelectedIds.has(id))?'checked':''} onchange="toggleReportSelectAll()"></th>` : ''}
        ${["İş Emri No (U kodu)","İş Talep No","Operasyon No","Malzeme Adı","Malzeme Cinsi","Çap ve Boy","Adet","Makine","Operatör","Başlangıç","Bitiş","Süre","Durum","Not"].map(h=>`<th>${h}</th>`).join('')}
        ${canEditReport() ? `<th style="width:36px"></th>` : ''}
        ${canDeleteReport() ? `<th style="width:36px"></th>` : ''}
      </tr></thead><tbody>`;
    // DÜZELTME: canDeleteReport() İKİ ayrı <th> ekliyor (baştaki seçim kutusu + sondaki sil
    // sütunu), burada bir kez sayılıyordu — "kayıt yok" satırı bir sütun eksik kalıyordu.
    const reportColCount = 14 + (canDeleteReport()?2:0) + (canEditReport()?1:0);
    if(fe.length===0){ body += `<tr><td colspan="${reportColCount}" style="text-align:center;color:var(--text-muted);padding:30px">Filtreyle eşleşen kayıt yok.</td></tr>`; }
    fe.forEach(e=>{
      const isDone = completedRoutes.has(e.id);
      const statusColor = isDone ? 'var(--success)' : e.status==='devam'?'var(--accent)':e.status==='duruş'?'var(--warn)':'var(--success-soft)';
      const statusLabel = e.status==='devam'?'Devam Ediyor':e.status==='duruş'?'Duruşta':'Tamamlandı';
      const rowStyle = isDone ? 'background:var(--success-row)' : '';
      const malzAdi = getTalepInfo(e.talepNo)?.malzemeAdi || '';
      body += `<tr style="${rowStyle}">
        ${canDeleteReport() ? `<td><input type="checkbox" ${reportSelectedIds.has(e.id)?'checked':''} onchange="toggleReportSelect('${e.id}')"></td>` : ''}
        <td class="mono" style="color:var(--accent);cursor:pointer" onclick="openEntryDetail('${e.id}')">${esc(e.isEmriNo)} ${isDone?ico('check',12):''}</td>
        <td class="mono">${esc(e.talepNo||'—')}</td>
        <td style="font-weight:700">${e._seq||'—'}</td>
        <td style="font-size:12.5px">${esc(malzAdi||'—')}</td>
        <td>${esc(e.malzemeCinsi||'—')}</td>
        <td>${esc(e.capBoy||'—')}</td>
        <td>${esc(e.adet||'—')}</td>
        <td>${esc(e.makine||'—')}</td>
        <td>${esc(e.operatorUsername)} · ${esc(e.operatorName)}</td>
        <td>${fmtDT(e.startTs)}</td>
        <td>${e.endTs?fmtDT(e.endTs):'—'}</td>
        <td>${e.endTs?fmtDur(e.endTs-e.startTs):'—'}</td>
        <td><span style="color:${statusColor};font-weight:600">${isDone?'Rota Tamamlandı':statusLabel}</span></td>
        <td style="color:var(--text-muted);font-style:italic">${esc(e.not||'')}</td>
        ${canEditReport() ? `<td><button class="del-btn" onclick="openReportEdit('${e.id}')" title="Düzelt">${ico('edit',14)}</button></td>` : ''}
        ${canDeleteReport() ? `<td><button class="del-btn" onclick="deleteReportRecord('${e.id}')" title="Sil">${ico('trash',14)}</button></td>` : ''}
      </tr>`;
    });
    body += `</tbody></table></div>${entryDetailId ? renderEntryDetailModal() : ''}`;
  }

  return `<div class="root-wide theme-${resolvedTheme()}">${header}${body}${machineModal ? renderMachineModal() : ''}${tadilatEditId ? renderTadilatEditModal() : ''}${malzemeAramaOpen ? renderMalzemeAramaModal() : ''}${reportEditId ? renderReportEditModal() : ''}${tadilatRowEditId ? renderTadilatRowEditModal() : ''}${machineAccessModalCode ? renderMachineAccessModal() : ''}${resimAramaOpen ? renderResimAramaModal() : ''}${tadilatAkisModalId ? renderTadilatAkisModal() : ''}</div>`;
}
function setReportFilterFieldLight(field, val){ reportFilter[field]=val; renderTableOnly(); }
function renderTableOnly(){ render(); } // basit yaklaşım: filtre değişince tam yeniden çizim yeterli hızda çalışır

