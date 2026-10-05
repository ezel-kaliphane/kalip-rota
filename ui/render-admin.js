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
function renderTamamlananTalepTablosu(tamamlananlar, exportListesi){
  // Excel butonu bir onclick metni olduğu için diziyi doğrudan geçemiyoruz; o an EKRANDA
  // gösterilen (filtrelenmiş olabilen) listeyi burada saklayıp dışa aktarımın onu kullanmasını
  // sağlıyoruz. exportListesi opsiyonel: çağıran taraf ekranda kısaltılmış (ör. "son 20") bir
  // liste gösterip Excel'e ARAMA/ATÖLYE filtresine uyan TÜM kayıtları aktarmak isterse ayrıca
  // verir — veri zaten RTDB'den canlı dinlendiği için (tadilatlar düğümü tam indiriliyor) bunu
  // tam listeyle yapmak ek bir Firebase okuması gerektirmez. Verilmezse (ör. eski davranış)
  // ekrandaki liste neyse o dışa aktarılır.
  const disaAktarListesi = exportListesi || tamamlananlar;
  lastTamamlananTalepListesi = disaAktarListesi;
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:10px;flex-wrap:wrap">
    <div style="font-size:11.5px;color:var(--text-muted)">"Bekleme": açılış→başlama · "İşlem Süresi": başlama→bitiş (duvar saati) · "Toplam Süre": açılış→bitiş. Satıra tıkla, adım adım akışı gör.</div>
    ${disaAktarListesi.length>0 ? `<button class="btn-primary" style="width:auto;padding:7px 14px;font-size:12px;flex-shrink:0" onclick="exportTadilatExcel(lastTamamlananTalepListesi)">⬇ Excel'e Aktar (${disaAktarListesi.length})</button>` : ''}
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
  // planliDurus = gün sonu + planlı mola (isVerimlilikDisiDurus'un tanımladığı küme).
  // durusta ise artık YALNIZCA plansız duruş — öğle arasında yarım atölyenin
  // "Duruşta" görünmesi panoda alarm gibi okunuyordu.
  let calisiyor=0, durusta=0, planliDurus=0, bosta=0;
  liveMachines.forEach(m=>{
    const label = `${m.code} · ${m.name}`;
    const tadilatHere = tadilatAktifOnMachine(label);
    const machineEntries = liveEntries.filter(e=>e.makine===label);
    const running = !tadilatHere && machineEntries.some(e=>e.status==='devam');
    const stoppedEntries = machineEntries.filter(e=>e.status==='duruş');
    const stopped = !tadilatHere && !running && stoppedEntries.length>0;
    if(tadilatHere || running) calisiyor++;
    else if(stopped){ (stoppedEntries.every(e=>isVerimlilikDisiDurus(e.duruşNedeni)) ? planliDurus++ : durusta++); }
    else bosta++;
  });
  const uzun = uzunDurusluKayitlar();
  const esikDk = Math.round(uzunDurusEsikMs()/60000);

  const bugun = dateKey(Date.now());
  const dayStartMs = new Date(bugun+'T00:00:00').getTime(), dayEndMs = dayStartMs+86400000;
  const bugunEntries = liveEntries.filter(e => e.startTs < dayEndMs && (e.endTs||nowTick) >= dayStartMs);
  const bugunDurusAgg = {};
  collectDurusEvents(bugunEntries).forEach(ev=>{
    if(isVerimlilikDisiDurus(ev.neden) || !Number.isFinite(ev.sureMs) || ev.sureMs<=0) return;
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
      ${counter('Planlı Duruş', planliDurus, 'var(--gunsonu)')}
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
  // DÜZELTME: Bu eksen eskiden `display:flex; gap:12px` içinde her etikete AYRICA
  // `position:relative; left:X%` uygulayarak çiziliyordu — relative konumlandırmada yüzde,
  // etiketin akıştaki (flex ile yan yana dizilmiş) konumuna EKLENİYOR, ayrıca bu eksen kutusunun
  // toplam genişliği alttaki gerçek `.analiz-gantt-track`'ten 152px (info sütunu 140px + gap 12px)
  // daha genişti. İkisi birlikte saatlerin, özellikle geç saatlerin, sağa doğru giderek kaymasına
  // yol açıyordu. Artık alttaki satırla BİREBİR AYNI kutu modelini (150px isim + esnek track +
  // 140px bilgi) boş yer tutucularla tekrarlayıp, etiketleri "Genel Analiz" sekmesindeki gibi
  // `position:absolute` ile track'in KENDİ genişliğine göre konumlandırıyoruz.
  html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
      <div class="analiz-kisi-name" style="width:150px;flex-shrink:0"></div>
      <div style="position:relative;flex:1;height:14px">
        ${[0,2,4,6,8,10,12,14,16,18,20,22].map(h=>`<span style="position:absolute;left:${(h*60/1440)*100}%;font-size:10px;color:var(--text-muted);transform:translateX(-50%)">${String(h).padStart(2,'0')}:00</span>`).join('')}
      </div>
      <div class="analiz-kisi-info" style="width:140px;flex-shrink:0"></div>
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
    <span style="display:flex;align-items:center;gap:6px"><i style="width:9px;height:9px;border-radius:2px;background:var(--text-faint, #3a4148);display:inline-block"></i>Gün sonu / planlı mola (hariç)</span>
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
/* Bir operatörün (computeAnalizData().perOperator elemanı) gün gün dökümünü — Çalışma/Duruş/
   Boşta/Fazla Mesai/Kalan Mesai tablosu + her günün altında saatlik Gantt şeridi — HTML'e çevirir.
   Hem "Kişi Bazlı Özet" tablosundaki açılır satırda hem de "Operatör Analizi" görünümünde birebir
   aynı şekilde kullanılıyor, ayrı bir hesap/veri modeli icat edilmedi. */
function renderOperatorGunGunTablosu(op){
  return `<div class="table-wrap" style="padding:0"><table><thead><tr>
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
    <div style="display:flex;gap:14px;font-size:11px;color:var(--text-muted);margin-top:8px;flex-wrap:wrap">
      <span><span style="display:inline-block;width:10px;height:10px;background:var(--success);border-radius:2px;margin-right:4px"></span>Çalışma</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:var(--warn);border-radius:2px;margin-right:4px"></span>Duruş</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:var(--panel-alt);border:1px solid var(--border);border-radius:2px;margin-right:4px"></span>Boşta / kayıt yok</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:var(--text-faint, #3a4148);border-radius:2px;margin-right:4px"></span>Gün sonu / planlı mola (hariç tutulan)</span>
    </div>`;
}
/* Analiz sekmesi — "Operatör Analizi" görünümü: tek bir operatörü seçip performansına derinlemesine
   inmek için. Sol tarafta arama + tüm operatörlerin (computeAnalizData().perOperator) listesi
   verimliliğe göre sıralı, sağda seçilinin dönem KPI'ları, günlük verimlilik trendi, duruş
   nedenleri, makine kırılımı, bugünkü vardiya şeridi ve gün gün döküm (renderOperatorGunGunTablosu
   ile Kişi Bazlı Özet'teki AYNI tablo/Gantt tekrar kullanılıyor). Ayrı bir veri modeli icat
   edilmedi — hepsi computeAnalizData ve entriesArray'den; verimlilik formülü de Kişi Bazlı
   sekmesindekiyle (çalışma/(çalışma+duruş)) BİLEREK aynı tutuldu, aksi halde aynı kişi için iki
   ekranda iki farklı yüzde görünürdü.
*/
function renderAnalizOperator(){
  const bugun = dateKey(Date.now());
  const presetDays = { bugun:1, d7:7, d30:30 }[analizOperatorPeriod] || 7;
  const fromDt = new Date(); fromDt.setHours(12,0,0,0); fromDt.setDate(fromDt.getDate()-(presetDays-1));
  const fromKey = dateKey(fromDt.getTime());
  const data = computeAnalizData(fromKey, bugun, 'tumu');
  const periodLabel = { bugun:'Bugün', d7:'Son 7 gün', d30:'Son 30 gün' }[analizOperatorPeriod];
  const verimOf = op => (op.workMin+op.durusMin)>0 ? Math.round(op.workMin/(op.workMin+op.durusMin)*100) : 0;
  const ranked = data.perOperator.map(op=>({ op, verim: verimOf(op) })).sort((a,b)=>b.verim-a.verim);

  const q = analizOperatorArama.trim().toLowerCase();
  const filtered = !q ? ranked : ranked.filter(({op})=>{
    const makineler = op.days.flatMap(d=>d.machines.map(m=>m.code)).join(' ');
    return `${op.operatorName||''} ${op.operatorUsername||''} ${makineler}`.toLowerCase().includes(q);
  });

  if(analizOperatorSecili && !ranked.some(({op})=>op.operatorUsername===analizOperatorSecili)) analizOperatorSecili = null;
  if(!analizOperatorSecili && ranked.length>0) analizOperatorSecili = ranked[0].op.operatorUsername;

  const periodChips = `<div style="display:flex;gap:6px;flex-wrap:wrap">
    ${[['bugun','Bugün'],['d7','Son 7 Gün'],['d30','Son 30 Gün']].map(([p,label])=>`<button class="chip ${analizOperatorPeriod===p?'active':''}" onclick="setAnalizOperatorPeriod('${p}')">${label}</button>`).join('')}
  </div>`;

  let html = `<div style="display:grid;grid-template-columns:270px 1fr;gap:14px;align-items:start">
    <div class="analiz-chart-box" style="padding:12px">
      <input type="text" placeholder="Operatör veya makine ara…" value="${esc(analizOperatorArama)}" oninput="setAnalizOperatorArama(this.value)" style="margin-bottom:10px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${filtered.length} operatör · ${periodLabel} · verimliliğe göre sıralı</div>
      <div style="max-height:640px;overflow-y:auto;display:flex;flex-direction:column;gap:5px">
        ${filtered.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px;padding:14px 0;text-align:center">Sonuç yok.</div>` : filtered.map(({op,verim})=>{
          const selected = op.operatorUsername===analizOperatorSecili;
          const verimColor = verim>=70?'var(--success)':verim>=40?'var(--warn)':'var(--danger)';
          return `<div onclick="setAnalizOperatorSecili('${escJs(op.operatorUsername)}')" style="cursor:pointer;padding:9px 10px;border-radius:8px;background:${selected?'var(--panel-alt)':'transparent'};border:1px solid ${selected?'var(--accent)':'transparent'}">
            <div style="font-size:12.5px;font-weight:600">${esc(op.operatorName||op.operatorUsername)}</div>
            <div class="mono" style="font-size:10.5px;color:var(--text-muted);margin-top:1px">${esc(op.operatorUsername)}</div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px">
              <span style="font-size:10.5px;color:var(--text-muted)">${op.daysUsed} gün · ${op.machineCount} makine</span>
              <span class="mono" style="font-size:12px;font-weight:700;color:${verimColor}">%${verim}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div>`;

  const sel = ranked.find(({op})=>op.operatorUsername===analizOperatorSecili);
  if(!sel){
    return html + `<div class="analiz-chart-box" style="text-align:center;color:var(--text-muted);padding:60px 20px">Bu dönemde hiç kayıt yok.</div></div></div>`;
  }
  const { op, verim } = sel;
  const rank = ranked.findIndex(r=>r.op.operatorUsername===op.operatorUsername)+1;
  const verimColor = verim>=70?'var(--success)':verim>=40?'var(--warn)':'var(--danger)';

  // Canlı durum: şu an devam/duruşta bir üretim kaydı ya da aktif bir tadilat operasyonu var mı —
  // ayrı bir "presence" alanı yok, mevcut entries/tadilat verisinden aynı anda türetiliyor.
  const liveEntry = entriesArray().find(e=>e.operatorUsername===op.operatorUsername && (e.status==='devam'||e.status==='duruş'));
  const liveTadilat = !liveEntry ? tadilatArray().map(t=>({t,o:tadilatAktifOperasyon(t)})).find(x=>x.o && x.o.operatorUsername===op.operatorUsername) : null;
  let statusHtml;
  if(liveEntry){
    const label = liveEntry.status==='duruş' ? `Duruşta · ${esc(liveEntry.duruşNedeni||'')}` : 'Çalışıyor';
    const color = liveEntry.status==='duruş' ? 'var(--warn)' : 'var(--success)';
    statusHtml = `<span style="color:${color};font-weight:600">${label}</span> · ${esc((liveEntry.makine||'').split(' · ')[0]||'')} · ${esc(liveEntry.isEmriNo||liveEntry.talepNo||'')} · ${fmtElapsed(entryDurationBreakdown(liveEntry).netMs)}`;
  } else if(liveTadilat){
    statusHtml = `<span style="color:var(--tadilat-info);font-weight:600">Tadilatta</span> · ${esc(liveTadilat.t.uKodu)} · ${esc(liveTadilat.o.makine||'')} · ${fmtElapsed(tadilatOpDurationBreakdown(liveTadilat.o).netMs)}`;
  } else {
    statusHtml = `<span style="color:var(--text-muted)">Şu an açık kaydı yok</span>`;
  }

  const allEntries = op.days.flatMap(d=>d.entries||[]);
  const tamamlanan = new Set(allEntries.filter(e=>e.status==='tamamlandi').map(e=>e.isEmriNo||e.talepNo)).size;
  const tadilatSayisi = allEntries.filter(e=>e._isTadilat).length;

  html += `<div class="analiz-chart-box" style="margin-bottom:14px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:18px;font-weight:700">${esc(op.operatorName||op.operatorUsername)}</div>
          <div class="mono" style="font-size:11.5px;color:var(--text-muted);margin-top:2px">${esc(op.operatorUsername)} · atölye sırası #${rank} / ${ranked.length} · ${periodLabel}</div>
        </div>
        ${periodChips}
      </div>
      <div style="font-size:12.5px;margin-top:10px">${statusHtml}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px">
      <div class="analiz-chart-box"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Verimlilik</div><div class="mono" style="font-size:24px;font-weight:700;margin-top:6px;color:${verimColor}">%${verim}</div></div>
      <div class="analiz-chart-box"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Net Çalışma</div><div class="mono" style="font-size:24px;font-weight:700;margin-top:6px;color:var(--success)">${fmtDur(op.workMin*60000)}</div></div>
      <div class="analiz-chart-box"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Duruş</div><div class="mono" style="font-size:24px;font-weight:700;margin-top:6px;color:var(--warn)">${fmtDur(op.durusMin*60000)}</div></div>
      <div class="analiz-chart-box"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Fazla Mesai</div><div class="mono" style="font-size:24px;font-weight:700;margin-top:6px;color:${op.overtimeMin>0?'var(--danger)':'var(--text-muted)'}">${op.overtimeMin>0?fmtDur(op.overtimeMin*60000):'—'}</div></div>
      <div class="analiz-chart-box"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Tamamlanan İş</div><div class="mono" style="font-size:24px;font-weight:700;margin-top:6px">${tamamlanan}${tadilatSayisi>0?` <span style="font-size:12px;color:var(--text-muted);font-weight:400">(${tadilatSayisi} tadilat)</span>`:''}</div></div>
    </div>
    ${op.hasPhysicalAnomaly?`<div style="display:flex;align-items:center;gap:8px;background:var(--warn-soft);border:1px solid var(--warn-border);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:var(--warn)">${ico('alert',14)} Bu dönemde en az bir günde gerçek geçen süreden fazla çalışma hesaplandı — muhtemelen kapatılmamış eski bir kayıt var, aşağıdaki gün gün dökümde ${ico('alert',12)} işaretli günlere bak.</div>`:''}
  `;

  const daysAsc = op.days.slice().sort((a,b)=>a.tarih.localeCompare(b.tarih));
  if(daysAsc.length>1){
    html += `<div class="analiz-chart-box" style="margin-bottom:14px">
      <div style="font-size:14.5px;font-weight:700;margin-bottom:2px">Günlük Verimlilik Trendi</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Çalışma / (Çalışma + Duruş) · gün bazında</div>
      <div style="display:flex;align-items:flex-end;gap:8px;height:140px;padding-top:16px;overflow-x:auto">
        ${daysAsc.map(d=>{
          const v = (d.workMin+d.durusMin)>0 ? Math.round(d.workMin/(d.workMin+d.durusMin)*100) : 0;
          const c = v>=70?'var(--success)':v>=40?'var(--warn)':'var(--danger)';
          const dLabel = d.tarih.slice(5).split('-').reverse().join('.');
          return `<div style="flex:0 0 34px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%" title="${esc(d.tarih)} · %${v}">
            <div class="mono" style="font-size:10px;color:${c};margin-bottom:4px">%${v}</div>
            <div style="width:100%;flex:1;display:flex;align-items:flex-end;background:var(--panel-alt);border-radius:4px;overflow:hidden">
              <div style="width:100%;height:${v}%;background:${c}"></div>
            </div>
            <div class="mono" style="font-size:9.5px;color:var(--text-muted);margin-top:6px">${dLabel}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  const durusByReason = {};
  collectDurusEvents(allEntries).forEach(ev=>{
    if(!Number.isFinite(ev.sureMs) || ev.sureMs<=0) return;
    durusByReason[ev.neden] = (durusByReason[ev.neden]||0) + ev.sureMs;
  });
  const durusList = Object.entries(durusByReason).map(([neden,ms])=>({neden,ms})).sort((a,b)=>b.ms-a.ms);
  const durusMax = Math.max(...durusList.map(d=>d.ms), 1);

  const machineAgg = {};
  op.days.forEach(d=>d.machines.forEach(m=>{ machineAgg[m.code] = (machineAgg[m.code]||0) + m.workMin; }));
  const machineList = Object.entries(machineAgg).map(([code,workMin])=>({code,workMin})).sort((a,b)=>b.workMin-a.workMin);
  const machineMax = Math.max(...machineList.map(m=>m.workMin), 1);

  html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
    <div class="analiz-chart-box">
      <div style="font-size:14.5px;font-weight:700;margin-bottom:2px">Duruş Nedenleri</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">${periodLabel} · toplam ${fmtDur(durusList.reduce((s,d)=>s+d.ms,0))}</div>
      ${durusList.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px">Bu dönemde duruş kaydı yok.</div>` : durusList.slice(0,8).map((d,i)=>`
        <div style="padding:6px 0">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${esc(d.neden)}</span><span class="mono" style="font-weight:600">${fmtDur(d.ms)}</span></div>
          <div style="height:9px;background:var(--panel-alt);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.round(d.ms/durusMax*100)}%;background:${i===0?'var(--danger)':i<3?'var(--warn)':'var(--border)'};border-radius:3px"></div></div>
        </div>`).join('')}
    </div>
    <div class="analiz-chart-box">
      <div style="font-size:14.5px;font-weight:700;margin-bottom:2px">Makine Kırılımı</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">${periodLabel} · net çalışma süresi</div>
      ${machineList.length===0 ? `<div style="color:var(--text-muted);font-size:12.5px">Bu dönemde makine kaydı yok.</div>` : machineList.map(m=>`
        <div style="display:grid;grid-template-columns:56px 1fr 64px;align-items:center;gap:10px;padding:5px 0">
          <div class="mono" style="font-size:12px;color:var(--accent);font-weight:600">${esc(m.code)}</div>
          <div style="height:13px;background:var(--panel-alt);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.round(m.workMin/machineMax*100)}%;background:var(--accent)"></div></div>
          <div class="mono" style="font-size:11.5px;text-align:right">${fmtDur(m.workMin*60000)}</div>
        </div>`).join('')}
    </div>
  </div>`;

  const bugunGun = op.days.find(d=>d.tarih===bugun);
  if(bugunGun){
    const dStartMs = new Date(bugun+'T00:00:00').getTime();
    const segs = renderGanttSegmentsHtml(bugunGun.entries||[], dStartMs, dStartMs+86400000, e=>`${e.isEmriNo||e.talepNo||''} · ${e.makine||''}`);
    html += `<div class="analiz-chart-box" style="margin-bottom:14px">
      <div style="font-size:14.5px;font-weight:700;margin-bottom:10px">Bugünkü Vardiya Şeridi</div>
      <div class="analiz-gantt-row" style="margin-bottom:6px">
        <div class="analiz-gantt-label" style="width:0"></div>
        <div style="position:relative;flex:1;height:16px">
          ${[0,2,4,6,8,10,12,14,16,18,20,22].map(h=>`<span style="position:absolute;left:${(h*60/1440)*100}%;font-size:10px;color:var(--text-muted);transform:translateX(-50%)">${String(h).padStart(2,'0')}:00</span>`).join('')}
        </div>
      </div>
      <div class="analiz-gantt-row">
        <div class="analiz-gantt-label" style="width:0"></div>
        <div class="analiz-gantt-track">${segs}<div class="analiz-gantt-cutoff" style="left:${(WORKDAY_END_MINUTE/1440)*100}%"></div></div>
      </div>
    </div>`;
  }

  html += `<div class="analiz-chart-box">
    <div style="font-size:14.5px;font-weight:700;margin-bottom:10px">Gün Gün Döküm</div>
    ${renderOperatorGunGunTablosu(op)}
  </div>`;

  html += `</div></div>`;
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
        <input id="tadilat-analiz-arama" type="text" placeholder="🔍 U Kodu, malzeme ya da açıklama ara…" value="${esc(tadilatAnalizArama)}" oninput="setTadilatAnalizArama(this.value)" style="flex:1;min-width:220px">
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
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Ekranda son ${son20.length} kayıt gösteriliyor (toplam ${tamamlananlar.length}) · Excel tüm ${tamamlananlar.length} kaydı indirir · satıra tıkla</div>
        ${renderTamamlananTalepTablosu(son20, tamamlananlar)}
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
/* Malzeme Stoğu (çelik hammadde) ekranı. Önce Ayarlar > "Malzeme Stoğu" alt sekmesindeydi;
   kullanıcı isteğiyle üst seviye "Stok" sekmesinin üç bölümünden biri oldu. İçerik aynen taşındı. */
/* Ayarlar > "Malzeme Stoğu": SADECE modül aç/kapa anahtarı — kullanıcı isteğiyle burada kaldı.
   Kalem yönetimi ve tüketim geçmişi üst seviye "Stok > Malzeme (çelik)" bölümünde
   (aynı ayrım Takım Stok'ta da var: renderToolStokAdminSettings vs renderToolStokManagementScreen). */
function renderMalzemeStokAyarlar(){
  return `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Malzeme Stoğu <span style="font-size:11.5px;font-weight:400;color:var(--text-muted)">(opsiyonel modül)</span></div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:640px">Hammadde tüketimi sadece bir iş emrinin <b>ilk operasyonunda</b> sorulur — aynı iş emrinin sonraki adımlarında tekrar sorulmaz, çünkü malzeme zaten ilk kesimde tüketilmiştir.</div>
        <label style="display:flex;align-items:center;gap:10px;background:var(--panel);border:2px solid ${stockEnabled()?'var(--success)':'var(--border)'};border-radius:10px;padding:14px 16px;margin-bottom:22px;cursor:pointer;max-width:480px">
          <input type="checkbox" ${stockEnabled()?'checked':''} onchange="toggleStockTracking()" style="width:auto;transform:scale(1.3)">
          <div>
            <div style="font-size:14px;font-weight:600;color:${stockEnabled()?'var(--success)':'var(--text)'}">Malzeme Stok Takibini ${stockEnabled()?'Aktif':'Kapalı'}</div>
            <div style="font-size:11.5px;color:var(--text-muted)">Kapatırsan bu modülle ilgili hiçbir alan/ekran operatörlere görünmez, hiçbir stok işlemi yapılmaz — tek tuşla tamamen devre dışı kalır.</div>
          </div>
        </label>
        <div style="font-size:12px;color:var(--text-muted);max-width:640px">Stok kalemi yönetimi ve tüketim geçmişi için üst menüdeki <b>Stok → Hammadde</b> bölümüne bak.</div>`;
}

/* CANİAS hammadde listesi önizlemesi (bkz. js/state.js caniasListesiOnizlemeKur). Kama
   önizlemesinden ayrı: burada stok sütunu yok, soru "kaç yeni kalem açılacak ve hangi türde". */
function caniasListesiOnizlemeHtml(p){
  const turAdi = { yuvarlak:'Yuvarlak çubuk (boy takipli)', kama:'Kama / parmak (adet)', prizmatik:'Lama / blok (adet)' };
  const ornek = p.yeni.slice(0,12);
  return `<div style="background:var(--panel);border:1px solid var(--accent);border-radius:10px;padding:16px;margin-top:14px;max-width:960px">
    <div style="font-size:13.5px;font-weight:600;margin-bottom:4px">CANİAS hammadde listesi — ${p.toplam} kod</div>
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px"><b style="color:var(--text)">${p.yeni.length}</b> yeni kalem açılacak${(p.eslesen||[]).length?` · <b style="color:var(--success)">${p.eslesen.length}</b> bekleyen kaleme kod bağlanacak`:''} · ${p.zatenVar} kod zaten sistemde (dokunulmayacak)${p.bos?` · ${p.bos} boş satır atlandı`:''}${p.dosyadaTekrar?` · ${p.dosyadaTekrar} tekrarlanan kod atlandı`:''}</div>
    ${p.yeni.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      ${Object.entries(p.sinifSay).filter(([,n])=>n>0).map(([s,n])=>`<span class="matrix-tag" style="--sb:var(--accent)">${esc(turAdi[s])}: ${n}</span>`).join('')}
    </div>
    <div style="overflow-x:auto;margin-bottom:12px">
      <table style="font-size:11.5px"><thead><tr><th>CANİAS</th><th>Açıklama</th><th>Kod</th><th>Çap</th><th>Tür</th></tr></thead><tbody>
        ${ornek.map(r=>`<tr><td class="mono">${esc(r.canias)}</td><td>${esc(r.aciklama)}</td><td class="mono">${esc(r.kod)}</td><td class="mono">${esc(r.cap||'—')}</td><td>${r.tur==='boy'?'Boy':'Adet'}</td></tr>`).join('')}
      </tbody></table>
      ${p.yeni.length>ornek.length ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">…ve ${p.yeni.length-ornek.length} kalem daha.</div>` : ''}
    </div>` : ''}
    ${(p.eslesen||[]).length ? `<div class="notice" style="--nc:var(--success);margin-bottom:12px;padding:9px 12px">
      <div class="notice-title">${p.eslesen.length} bekleyen hammadde CANİAS koduyla eşleşti</div>
      <div class="notice-sub">${p.eslesen.map(e=>`${esc(e.eskiAd)} → <span class="mono">${esc(e.canias)}</span> (${esc(e.aciklama)})`).join('<br>')}<br>Yeni kalem açılmaz; kod mevcut kaleme yazılır, çubukları ve geçmişi korunur.</div></div>` : ''}
    ${p.ayniAciklama.length ? `<div class="notice" style="--nc:var(--warn);margin-bottom:12px;padding:9px 12px">
      <div class="notice-title">CANİAS'ta aynı açıklamayla birden fazla kod var</div>
      <div class="notice-sub">${p.ayniAciklama.map(a=>`${esc(a.aciklama)} → <span class="mono">${a.kodlar.map(esc).join(', ')}</span>`).join('<br>')}<br>Her kod ayrı kalem olarak açılır; hangisinin geçerli olduğu CANIAS tarafında netleşmeli.</div></div>` : ''}
    <div style="display:flex;gap:10px">
      <button class="btn-primary" style="width:auto;padding:10px 18px" ${p.yeni.length||(p.eslesen||[]).length?'':'disabled'} onclick="confirmMalzemeExcelUpload()">✓ ${[p.yeni.length?p.yeni.length+' Kalemi Ekle':'', (p.eslesen||[]).length?(p.eslesen.length+' Kodu Bağla'):''].filter(Boolean).join(', ') || 'Eklenecek yok'}</button>
      <button class="btn-ghost" onclick="malzemeExcelPreview=null; render()">Vazgeç</button>
    </div>
  </div>`;
}

let malzemeAramaMetni = '';
let malzemeStoksuzGoster = false;
/* Stoğu olmayan kalem: boy takipte hiç çubuk yok, adette miktar 0. CANİAS listesi yüklenince
   (01.10.2026) kalemlerin ~%85'i böyle — fiziksel stokta olmayan, sadece tanımı açılmış
   malzeme. Liste aramasızken bunlar gizleniyor (369 kartı her tuşta yeniden çizmek telefonda
   ~1 sn); aramada her zaman çıkıyorlar, ki çubuk girmek için bulunabilsinler. */
function malzemeStoksuzMu(it){
  return it.tur==='boy' ? lotsArray(it).length===0 : (Number(it.miktar)||0)===0;
}
function renderMalzemeStokScreen(){
      const aramaMetni = trNorm(malzemeAramaMetni.trim());
      const aramaParca = aramaMetni ? aramaMetni.split(/\s+/) : [];
      const tumKalemler = stockItemsArray();
      const stoksuzSay = tumKalemler.filter(malzemeStoksuzMu).length;
      const items = aramaParca.length
        ? hammaddeAra(tumKalemler, malzemeAramaMetni)
        : tumKalemler.filter(it=> malzemeStoksuzGoster || !malzemeStoksuzMu(it));
      const recentMoves = Object.entries(stockHareketleri).map(([id,v])=>({id,...v})).sort((a,b)=>b.ts-a.ts).slice(0,20);
      if(!stockEnabled()) return `<div style="font-size:12.5px;color:var(--text-muted)">Modül kapalı — <b>Ayarlar → Malzeme Stoğu</b>'ndan açtığında stok kalemi yönetimi ve tüketim geçmişi burada görünür.</div>`;

      /* Bu ekran eskiden tek düz sayfaydı: ekleme formu + kalem listesi + hareketler alt alta.
         Diğer iki stok modülü bölümlere ayrılmışken bunun ayrılmamış olması, modüller arası
         geçişte ekranın şeklini değiştiriyordu (Takım'da 5 bölüm, Karbür'de 6, burada 0).
         Artık aynı üç fiile bölünmüş — İÇERİK BİREBİR AYNI, yalnızca üçe ayrıldı. */
      const girisBolumu = `
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
              <input id="stok-alt-limit" type="number" placeholder="Alt limit (toplam boy)" style="width:160px">
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Aynı kod+çap için sonradan başka çubuk (lot) eklemek istersen, aşağıdaki listeden o kalemin altına "+ Yeni Çubuk" ile ekleyebilirsin.</div>
          ` : `
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input id="stok-kod" placeholder="Kod (ör. 86x100x55)" style="flex:1;min-width:140px">
              <input id="stok-isim" placeholder="İsim (opsiyonel)" style="flex:1.5;min-width:180px">
              <select id="stok-birim" style="width:100px"><option value="adet">Adet</option><option value="kg">Kg</option></select>
              <input id="stok-miktar" type="number" placeholder="Başlangıç miktarı" style="width:140px">
              <select id="stok-mode" style="width:170px"><option value="oto">Otomatik (Adet kadar)</option><option value="manuel">Manuel (operatör girer)</option></select>
              <input id="stok-alt-limit" type="number" placeholder="Alt limit" style="width:110px">
            </div>
          `}
          <button class="btn-primary" style="width:auto;padding:10px 18px;margin-top:10px" onclick="addStockItem()">+ Ekle</button>
        </div>`;

      const durumBolumu = `
        <div class="sec-h" style="margin-top:0">Stok Kalemleri (${aramaParca.length || malzemeStoksuzGoster ? items.length : items.length+' / '+tumKalemler.length})</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
          <input placeholder="Yaz: 4140 25 · 2344 Ø80 · b13 kalın · KLPHM000290" value="${esc(malzemeAramaMetni)}" oninput="malzemeAramaMetni=this.value; render()" style="max-width:360px;margin-bottom:0">
          ${!aramaParca.length && stoksuzSay>0 ? `<button class="btn-ghost" style="width:auto;padding:8px 12px;font-size:12.5px" onclick="malzemeStoksuzGoster=!malzemeStoksuzGoster; render()">${malzemeStoksuzGoster ? 'Stoksuzları gizle' : `Stoksuz ${stoksuzSay} kalemi de göster`}</button>` : ''}
        </div>
        <div class="op-settings-table" style="margin-bottom:26px">
          ${items.length===0 ? `<div style="font-size:12.5px;color:var(--text-muted);padding:12px 4px">${malzemeAramaMetni.trim() ? 'Aramayla eşleşen kalem yok.' : stoksuzSay>0 ? 'Stoğu olan kalem yok — stoksuz kalemler gizli.' : 'Henüz stok kalemi eklenmedi.'}</div>` : items.map(it=>{
            if(it.tur==='boy'){
              const lots = lotsArray(it);
              return `<div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
                  <div><span class="mono" style="font-weight:700;color:var(--accent)">${esc(it.kod)}</span> ${it.caniasBekliyor?`<span class="matrix-tag" style="--sb:var(--warn)">KOD YOK</span>`:''} <span style="color:var(--text-muted);font-size:12.5px">${esc(it.cap||'')} · Boy Takip · ${lots.length} çubuk</span></div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted)">Alt limit <input type="number" value="${it.altLimit||0}" style="width:90px" onchange="updateStockItemField('${it.id}','altLimit',this.value)"></label>
                    <button class="del-btn" onclick="deleteStockItem('${it.id}')" title="Kalemi tamamen sil">${ico('trash',14)}</button>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px">
                  ${lots.length===0 ? `<div style="font-size:12px;color:var(--text-muted)">Çubuk yok — yeni çubuk eklemek için Kod ile Giriş'ten ara.</div>` : lots.map(lot=>`
                    <div style="display:flex;align-items:center;gap:8px">
                      <input type="number" value="${lot.boy}" style="width:110px" onchange="updateStockLot('${it.id}','${lot.id}',this.value)">
                      <span style="font-size:12px;color:var(--text-muted)">${esc(it.birim||'mm')}</span>
                      <button class="del-btn" onclick="deleteStockLot('${it.id}','${lot.id}')" title="Bu çubuğu sil">${ico('trash',14)}</button>
                    </div>
                  `).join('')}
                </div>
              </div>`;
            }
            return `<div class="op-settings-row" style="flex-wrap:wrap;gap:10px">
              <div style="min-width:140px"><div class="mono" style="font-weight:700;color:var(--accent)">${esc(it.kod)} ${it.caniasBekliyor?`<span class="matrix-tag" style="--sb:var(--warn)">KOD YOK</span>`:''}</div><div style="font-size:11.5px;color:var(--text-muted)">${esc(it.isim||'')}</div></div>
              <input type="number" value="${it.miktar}" style="width:110px" onchange="updateStockItemField('${it.id}','miktar',this.value)" title="Mevcut miktar">
              <span style="font-size:12px;color:var(--text-muted)">${esc(it.birim||'adet')}</span>
              <select onchange="updateStockItemField('${it.id}','mode',this.value)" style="width:170px">
                <option value="oto" ${it.mode==='oto'?'selected':''}>Otomatik (Adet kadar)</option>
                <option value="manuel" ${it.mode==='manuel'?'selected':''}>Manuel (operatör girer)</option>
              </select>
              <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted)">Alt limit <input type="number" value="${it.altLimit||0}" style="width:90px" onchange="updateStockItemField('${it.id}','altLimit',this.value)"></label>
              <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-muted);cursor:pointer">
                <input type="checkbox" style="width:auto" ${it.siparisAcik?'checked':''} onchange="toggleStockItemSiparisAcik('${it.id}')">
                Sipariş açık
              </label>
              <button class="del-btn" onclick="deleteStockItem('${it.id}')" title="Sil">${ico('trash',14)}</button>
            </div>`;
          }).join('')}
        </div>`;

      const hareketBolumu = `
        <div class="sec-h" style="margin-top:0">Son Stok Hareketleri</div>
        <table><thead><tr><th>Tarih</th><th>Kalem</th><th>Miktar</th><th>İş Emri</th><th>Kim</th></tr></thead><tbody>
          ${recentMoves.length===0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:16px">Henüz hareket yok.</td></tr>` : recentMoves.map(m=>`
            <tr><td>${fmtDT(m.ts)}</td><td class="mono">${esc(m.itemKod)}${m.itemIsim?` <span style="color:var(--text-muted)">· ${esc(m.itemIsim)}</span>`:''}</td><td style="color:${m.miktar<0?'var(--danger)':'var(--success)'}">${m.miktar>0?'+':''}${m.miktar} ${esc(m.birim||'')}${m.aciklama?`<div style="font-size:10.5px;color:var(--text-muted);font-weight:400">${esc(m.aciklama)}</div>`:''}</td><td class="mono">${esc(m.talepNo||m.isEmriNo||'—')}</td><td>${esc(m.operatorName||'')}</td></tr>
          `).join('')}
        </tbody></table>`;

      const kodGirisBolumu = (() => {
        const it = stokGirisFoundId ? stockItems[stokGirisFoundId] : null;
        const sonuclar = it ? [] : stockGirisAramaSonuclar();
        return `<div class="sec-h" style="margin-top:0">Kod ile Giriş</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;max-width:640px">Kelimeleri boşlukla ayırarak yaz — sıra önemli değil (ör. "b13 kalın"), Canias alışkanlığın varsa %joker% da kullanabilirsin. Ya da QR okut. Adet takipli kalemlerde mal kabul, boy takipli çubuklarda yeni çubuk eklenir.</div>
        <div class="card" style="max-width:520px">
          ${!it ? `
            <div style="display:flex;gap:8px;margin-bottom:14px">
              <input id="malzeme-giris-arama" class="mono" placeholder="ör. 4140 25 · b13 kalın  (ya da %B13%)" value="${esc(stokGirisArama)}" oninput="stokGirisArama=this.value; render()" autofocus style="flex:1">
              <button class="btn-ghost" title="QR Okut" onclick="stokGirisScanQr()">${ico('camera',16)}</button>
            </div>
            ${!stokGirisArama.trim() ? `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:16px 0">Aramaya başlamak için yukarı yaz.</div>`
              : sonuclar.length===0 ? `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:16px 0">Eşleşme bulunamadı.</div>${hammaddeYeniDugmeHtml({ metin: stokGirisArama, hedef:'giris' })}`
              : `<div style="max-height:340px;overflow-y:auto">
                ${sonuclar.map(r=>{
                  const ozet = r.tur==='boy'
                    ? `${esc(r.cap||'')} · Boy Takip · ${lotsArray(r).length} çubuk`
                    : `${esc(r.isim||'')} · mevcut: ${r.miktar} ${esc(r.birim||'adet')}`;
                  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:6px;cursor:pointer" onclick="stockGirisSecKalem('${escJs(r.id)}')">
                    <div><span class="mono" style="color:var(--accent);font-weight:700">${esc(r.kod)}</span>${r.caniasBekliyor?` <span class="matrix-tag" style="--sb:var(--warn)">KOD YOK</span>`:''}<div style="font-size:11.5px;color:var(--text-muted)">${ozet}</div></div>
                    <span style="font-size:11.5px;color:var(--success);flex-shrink:0">Seç →</span>
                  </div>`;
                }).join('')}
                ${sonuclar.length===50 ? `<div style="font-size:11px;color:var(--text-muted);text-align:center;padding-top:6px">İlk 50 sonuç gösteriliyor — daha spesifik yaz.</div>` : ''}
              </div>${hammaddeYeniDugmeHtml({ metin: stokGirisArama, hedef:'giris' })}`}
          ` : it.tur==='boy' ? `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:14px">
              <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 14px;flex:1">
                <div style="font-weight:600">${esc(it.kod||'')} <span style="font-weight:400;color:var(--text-muted)">${esc(it.cap||'')} · Boy Takip</span></div>
                <div style="font-size:12.5px;margin-top:6px">${lotsArray(it).length===0 ? 'Çubuk yok.' : 'Mevcut çubuklar: ' + lotsArray(it).map(l=>l.boy+' '+(it.birim||'mm')).join(', ')}</div>
              </div>
              <button class="btn-ghost" title="Başka kalem seç" onclick="stokGirisGeriDon()">${ico('x',16)}</button>
            </div>
            <div class="field"><label>Yeni çubuk boyu (${esc(it.birim||'mm')})</label>
              <input type="number" value="${esc(stokGirisCubukBoyu)}" placeholder="ör. 2000" oninput="stokGirisCubukBoyu=this.value">
            </div>
            <button class="btn-primary" style="width:100%;padding:12px;margin-top:6px" onclick="stokGirisCubukEkle()">✓ Çubuğu Ekle</button>
          ` : `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:14px">
              <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 14px;flex:1">
                <div style="font-weight:600">${esc(it.kod||'')}</div>
                <div style="font-size:11.5px;color:var(--text-muted)">${esc(it.isim||'')}</div>
                <div style="font-size:12.5px;margin-top:6px">Mevcut stok: <b>${it.miktar}</b> ${esc(it.birim||'adet')}</div>
              </div>
              <button class="btn-ghost" title="Başka kalem seç" onclick="stokGirisGeriDon()">${ico('x',16)}</button>
            </div>
            <div style="display:flex;align-items:center;gap:16px;justify-content:center;margin-bottom:14px">
              <button class="btn-ghost" style="width:44px;height:44px;font-size:20px;padding:0" onclick="stokGirisMiktarDegistir(-1)">−</button>
              <div style="font-size:24px;font-weight:700;min-width:44px;text-align:center">${stokGirisMiktar}</div>
              <button class="btn-ghost" style="width:44px;height:44px;font-size:20px;padding:0" onclick="stokGirisMiktarDegistir(1)">+</button>
            </div>
            <div class="field"><label>Not (Sipariş No)</label>
              <input value="${esc(stokGirisNot)}" placeholder="ör. Sip. No 2026-114" oninput="stokGirisNot=this.value">
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;margin-bottom:14px">
              <input type="checkbox" style="width:auto" ${stokGirisSiparisAcik?'checked':''} onchange="stokGirisSiparisAcik=this.checked">
              Sipariş açık (bu kalem için tedarikçiye sipariş verildi)
            </label>
            <button class="btn-primary" style="width:100%;padding:12px" onclick="stockGirisKaydet()">✓ Girişi Kaydet</button>
          `}
        </div>`;
      })();

      const excelBolumu = `<div class="sec-h" style="margin-top:0">Excel ile Toplu Yükleme</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:8px;max-width:680px"><b>CANİAS hammadde listesi</b> (BAST03_SELMATERIAL — yalnızca <span class="mono">Canias Kodu</span> ve <span class="mono">Açıklama</span> sütunları) de buradan yüklenir: sistemde olmayan kodlar sıfır stoklu kalem olarak eklenir, var olanlara dokunulmaz.</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px;max-width:680px">Kama listesi için beklenen sütunlar: <span class="mono">KOD</span> ve <span class="mono">STOK</span> (zorunlu), ayrıca varsa ÖLÇÜ (WXDXL), TİP, CANİAS KODU, AÇIKLAMA (opsiyonel — bunlar isim alanına birleştirilerek yazılır). Yükleme <b>birleştirmedir</b> — Excel'de olmayan mevcut kalemler silinmez/değişmez. CANİAS kodu zaten varsa kalem güncellenir; stok adedi yalnızca aşağıdaki kutu işaretlenirse ezilir. Yeni kalemler "Manuel" tüketim modunda eklenir — kama:parmak oranı 1:1 değilse operatör miktarı elle girer; 1:1 olduğu bilinen kalemlerde Durum listesinden "Otomatik"e çevirebilirsin.</div>
        <input type="file" id="malzeme-excel-file-input" accept=".xlsx,.xls" style="margin-bottom:12px;font-size:12.5px">
        <div><button class="btn-primary" style="width:auto;padding:10px 18px" onclick="handleMalzemeExcelPreview()">⬆ Oku ve Önizle</button></div>
        <div id="malzeme-excel-status" style="font-size:12px;color:var(--text-muted);margin-top:10px"></div>
        ${(() => {
          const p = malzemeExcelPreview;
          if(!p) return '';
          if(p.katalog) return caniasListesiOnizlemeHtml(p);
          const first8 = p.rows.slice(0,8);
          return `<div style="background:var(--panel);border:1px solid var(--accent);border-radius:10px;padding:16px;margin-top:14px;max-width:960px">
            <div style="font-size:13.5px;font-weight:600;margin-bottom:6px">Önizleme — ${p.rows.length} geçerli satır${p.blankCount?`, ${p.blankCount} satır atlandı (kod boş)`:''}${p.dupCount?`, ${p.dupCount} tekrarlanan CANİAS kodu`:''}</div>
            <div style="overflow-x:auto;margin-bottom:12px">
              <table style="font-size:11.5px"><thead><tr><th>Kod</th><th>İsim (birleşik)</th><th>Stok</th></tr></thead><tbody>
                ${first8.map(r=>`<tr><td class="mono">${esc(r.kod)}</td><td>${esc(r.isim)}</td><td>${r.stok}</td></tr>`).join('')}
              </tbody></table>
              ${p.rows.length>8 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">…ve ${p.rows.length-8} satır daha.</div>` : ''}
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;margin-bottom:12px">
              <input type="checkbox" style="width:auto" ${malzemeExcelUpdateStock?'checked':''} onchange="malzemeExcelUpdateStock=this.checked; render()">
              Zaten var olan kalemlerin stok adetlerini de güncelle (yeni kalemler için stok her zaman yazılır)
            </label>
            <div style="display:flex;gap:10px">
              <button class="btn-primary" style="width:auto;padding:10px 18px" onclick="confirmMalzemeExcelUpload()">✓ Onayla ve Yükle</button>
              <button class="btn-ghost" onclick="malzemeExcelPreview=null; render()">Vazgeç</button>
            </div>
          </div>`;
        })()}`;

      if(malzemeSubView === 'giris')      return girisBolumu;
      if(malzemeSubView === 'hareketler') return hareketBolumu;
      if(malzemeSubView === 'kodgiris')   return kodGirisBolumu;
      if(malzemeSubView === 'excel')      return excelBolumu;
      return durumBolumu;
}

/* ==================== STOK SEKMESİ (üç bölüm) ====================
   Kullanıcı isteği: tek "Stok" sekmesi, içinde 1) takım stok 2) karbür stok 3) malzeme stok.
   VERİ KATMANI YİNE AYRI — bu yalnızca gezinme birleştirmesi. Üç modül kendi node'larında
   kalır (toolCatalog* / karbur* / stockItems*), hiçbiri veri paylaşmaz. Yetkiler değişmedi:
   takım ve karbür için mevcut sekme izinleri, malzeme için canManageStock() (SuperAdmin+Şef). */
const STOK_BOLUMLERI = [
  { key:'genel',   ikon:'chart',  label:'Genel Bakış',     alt:'üç kaynak bir arada',  gor:()=>true },
  { key:'takim',   ikon:'wrench', label:'Takım & Sarf',    alt:'freze, matkap, sarf',  gor:()=>isAdminTabVisible('takimStok') },
  { key:'karbur',  ikon:'elmas',  label:'Karbür',          alt:'çubuk + tel erozyon',  gor:()=>isAdminTabVisible('karbur') },
  { key:'malzeme', ikon:'katman', label:'Hammadde', alt:'boy ve adet takibi',   gor:()=>canManageStock() },
  /* Malzeme Bekleyenler (29.09.2026): sef malzemeligi bulamayinca is emri buraya
     dusuyor. Yetki Hammadde ile ayni (canManageStock = Sef + SuperAdmin) cunku
     isaretlemeyi sef yapiyor. */
  { key:'bekleyen', ikon:'clock',  label:'Malzeme Bekleyenler', alt:'stok yok, is emri parkta', gor:()=>canManageStock() }
];

/* ---- Bölümler: her modülde aynı fiiller, aynı sırada ----
   ÖNCEDEN: üç modülün her biri kendi alt sekme satırını kendi çiziyordu, hepsi farklı
   isimler ve farklı sıra kullanıyordu (Takım'da "Kalem Listesi/Konumlar/Excel Yükle/Stok
   Girişi/Geçmiş", Karbür'de "Kesim Planı/Stok & Fire/↓ Stok Girişi/...", Malzeme'de hiç
   yoktu). Üstelik bu satır .chip ile çizildiği için AKTİF HÂLİ SARIYDI (--warn) — üstündeki
   iki gezinme seviyesi turuncuyken (--accent) üçüncü seviye uyarı/filtre gibi görünüyordu.

   ARTIK: satırı renderStokScreen tek yerden, .sub-tab-btn ile çiziyor. Ortak üç fiil
   (Durum · Giriş · Hareketler) her modülde başta ve aynı sırada; modüle özel bölümler sonra.
   22.09.2026: "Excel Yükle" bölümü üçünden de çıkarıldı, hepsi Excel Yükleme ekranında toplandı.

   ANAHTARLAR BİLEREK DEĞİŞMEDİ — yalnızca etiket, sıra ve stil ortaklaştı. Takım'ın bölüm
   görünürlük izinleri adminTabPermissions/<kullanıcı>/takimStokViews/<anahtar> altında bu
   anahtarlarla saklanıyor; anahtarı değiştirmek kayıtlı izinleri sessizce geçersiz kılardı. */
/* 'bekleyen' STOK_BOLUM_TANIM'a GIRMIYOR: o ekranin alt bolumu yok, bolum seridi
   otomatik olarak cizilmiyor (tanim bulunamayinca bolumler bos kaliyor). */
const STOK_BOLUM_TANIM = {
  takim: {
    oku: () => toolAdminSubView,
    yaz: k => `setToolAdminSubView('${escJs(k)}')`,
    gor: k => isTakimStokSubTabVisible(k),
    bolumler: [
      { key:'liste',    label:'Durum' },
      { key:'giris',    label:'Giriş' },
      { key:'gecmis',   label:'Hareketler' },
      { key:'konumlar', label:'Konumlar' }
    ],
    ayarla: k => { toolAdminSubView = k; }
  },
  karbur: {
    oku: () => karburSubView,
    yaz: k => `karburSetSubView('${escJs(k)}')`,
    gor: () => true,
    bolumler: [
      { key:'stok',   label:'Durum' },
      { key:'giris',  label:'Giriş' },
      { key:'gecmis', label:'Hareketler' },
      { key:'plan',   label:'Kesim Planı' },
      { key:'isemri', label:'İş Emri Tüketimi' }
    ],
    ayarla: k => { karburSubView = k; }
  },
  malzeme: {
    oku: () => malzemeSubView,
    yaz: k => `setMalzemeSubView('${escJs(k)}')`,
    gor: () => true,
    bolumler: [
      { key:'durum',      label:'Durum' },
      { key:'giris',      label:'Giriş' },
      { key:'hareketler', label:'Hareketler' },
      { key:'kodgiris',   label:'Kod ile Giriş' }
    ],
    ayarla: k => { malzemeSubView = k; }
  }
};
let stokSubView = 'genel';
let malzemeSubView = 'durum'; // 'durum' | 'giris' | 'hareketler' | 'kodgiris' | 'excel' — bkz. renderMalzemeStokScreen
function setMalzemeSubView(k){
  malzemeSubView = k;
  if(k === 'hareketler') malzemeHareketGerekli(); // hareketler canlı dinlenmiyor, tek seferlik okunur
  render();
}
let malzemeHareketYuklendi = false;
function stokErisimVar(){ return STOK_BOLUMLERI.some(b=>b.gor()); }
/* stockHareketleri canlı dinlenmiyor (maliyet optimizasyonu — bkz. js/firebase-push.js:271-275),
   bu yüzden malzeme bölümü ilk açıldığında tek seferlik okunuyor. Eskiden bu tetikleyici
   setSettingsSubTab('stok') içindeydi; o alt sekme kaldırıldığı için buraya taşındı. */
function malzemeHareketGerekli(){
  if(malzemeHareketYuklendi) return;
  malzemeHareketYuklendi = true;
  loadStockHareketleri();
}
function setStokSubView(v){
  stokSubView = v;
  if(v==='malzeme') malzemeHareketGerekli();
  render();
}
/* ==================== GENEL BAKIŞ — üç kaynağı birleştiren özet (2026-09-15) ====================
   Takım (toolCatalog+toolStock), Karbür (karburKatalog+karburStok) ve Malzeme (stockItems) — üç
   ayrı veri kaynağı, ortak bir satır şekline (kod/malzeme/tür/stok/altLimit/durum/sonHareket)
   normalize edilip TEK bir tabloda gösteriliyor. VERİ KATMANI YİNE AYRI (STOK_BOLUMLERI'nin
   üstündeki yorumla aynı ilke) — bu sadece bir okuma/özet katmanı, hiçbir yazma işlemi burada
   yapılmıyor. Erişim kontrolü MEVCUT kurallarla birebir aynı (isAdminTabVisible/canManageStock) —
   kişi bazlı ince ayarlar (takimStokViews gibi) burada GENİŞLETİLMEDİ, sadece kaynağın modül
   seviyesinde hiç görünüp görünmeyeceği kontrol ediliyor. */
let stokGenelArama = '';
/* ===================== ELLE STOK DÜZELTME (yalnızca SuperAdmin) =====================
   Sayım sonrası stoğu doğru değere çekmek için. Negatif stok engeli geldikten sonra sıfır
   stokta görünen kalemler okutulamıyor; düzeltmenin yolu bu.

   YETKİ: doğrudan session.isSuperAdmin. canManageToolStok() zaten yalnızca SuperAdmin ama
   malzeme tarafındaki canManageStock() Şef'i de kapsıyor — bu işlem Şef'e AÇILMIYOR, o yüzden
   ortak fonksiyon değil açık kontrol kullanılıyor. Hem açılışta hem kaydederken kontrol var
   (ekranı atlayıp konsoldan çağıran olursa diye).

   Üç stok türü üç ayrı düğümde ve üç ayrı hareket kütüğünde tutuluyor; düzeltme her birinin
   KENDİ desenine yazılıyor ki geçmiş tek yerde bozulmasın:
     takim_<id>   -> toolStock/<id>/miktar   + toolMoves
     karbur_<id>  -> karburStok/<id>/adet    + karburHareketleri
     malzeme_<id> -> stockItems/<id>/miktar  + stockHareketleri
   Lot bazlı hammadde (tur==='boy') HARİÇ: orada stok tek sayı değil, lot listesinin toplamı —
   tek kutuyla yazmak lotları bozardı. O satırda düzeltme reddediliyor.

   Transaction geri çağrısı KOŞULSUZ yeni değeri döndürüyor, yani hiçbir pasta undefined
   dönmüyor — karbürdeki "ilk pas null gelince transaction ölür" tuzağı burada oluşamaz
   (bkz. HATA_NOTLARI 2026-09-15). Önceki değer sunucu pasında doğru değerle tazeleniyor. */
let stokDuzeltRowId = null, stokDuzeltDeger = '', stokDuzeltNot = '', stokDuzeltBusy = false;

function stokDuzeltYetkisi(){ return !!(session && session.isSuperAdmin); }
function stokDuzeltAc(rowId, mevcut){
  if(!stokDuzeltYetkisi()){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return; }
  stokDuzeltRowId = rowId; stokDuzeltDeger = String(mevcut); stokDuzeltNot = ''; stokDuzeltBusy = false;
  render();
}
function stokDuzeltKapat(){ stokDuzeltRowId = null; stokDuzeltBusy = false; render(); }

function stokDuzeltKaydet(){
  if(!stokDuzeltYetkisi()){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return; }
  if(stokDuzeltBusy) return;
  const rowId = stokDuzeltRowId; if(!rowId) return;
  const yeni = Math.round(Number(stokDuzeltDeger));
  if(!isFinite(yeni)){ toast('Geçerli bir sayı girin'); return; }
  if(yeni < 0){ toast('Stok negatif olamaz'); return; }
  const not = (stokDuzeltNot||'').trim();
  const now = Date.now();
  stokDuzeltBusy = true; render();

  const bitti = (etiket, onceki) => {
    stokDuzeltBusy = false; stokDuzeltRowId = null;
    toast(`${etiket}: ${onceki} → ${yeni}`);
    render();
  };
  const hata = err => {
    stokDuzeltBusy = false;
    toast('Kaydedilemedi: ' + ((err && err.message) || 'bilinmeyen hata'));
    render();
  };

  if(rowId.indexOf('takim_')===0){
    const itemId = rowId.slice(6);
    const it = toolCatalog[itemId]; if(!it){ hata(new Error('kalem bulunamadı')); return; }
    const bilinen = Number((toolStock[itemId]||{}).miktar)||0;
    let onceki = bilinen;
    DB.ref('toolStock/'+itemId+'/miktar').transaction(cur => { onceki = (cur===null?bilinen:(Number(cur)||0)); return yeni; })
      .then(res=>{
        if(!res.committed){ hata(new Error('işlem tamamlanamadı')); return; }
        const moveId = DB.ref('toolMoves').push().key;
        const updates = {};
        updates['toolMoves/'+moveId] = { itemId, canias: it.canias||'', tip:'duzeltme', miktar: yeni-onceki,
          oncekiMiktar: onceki, sonrakiMiktar: yeni, operatorUsername: session.username,
          operatorName: session.displayName, aciklama: not || 'Elle düzeltme', kaynak:'elle', ts: now };
        updates['toolStock/'+itemId+'/sonHareketTs'] = now;
        updates['toolStock/'+itemId+'/sonHareketAciklama'] = 'Elle düzeltme';
        // Alt limitin üstüne çıktıysa uyarı bayrağı sıfırlanıyor (stok girişindeki davranışın aynısı).
        if(Number(it.altLimit)>0 && yeni>Number(it.altLimit)) updates['toolStock/'+itemId+'/uyariGonderildi'] = false;
        DB.ref().update(updates).then(()=>{
          toolStock[itemId] = { ...(toolStock[itemId]||{}), miktar: yeni, sonHareketTs: now };
          bitti(it.ad || it.canias || itemId, onceki);
        }).catch(hata);
      }).catch(hata);
    return;
  }

  if(rowId.indexOf('karbur_')===0){
    const katalogId = rowId.slice(7);
    const k = (typeof karburKatalog!=='undefined' && karburKatalog) ? karburKatalog[katalogId] : null;
    const bilinen = karburStokAdet(katalogId);
    let onceki = bilinen;
    DB.ref('karburStok/'+katalogId+'/adet').transaction(cur => { onceki = (cur===null?bilinen:(Number(cur)||0)); return yeni; })
      .then(res=>{
        if(!res.committed){ hata(new Error('işlem tamamlanamadı')); return; }
        const hid = DB.ref('karburHareketleri').push().key;
        const updates = {};
        updates['karburHareketleri/'+hid] = { tip:'duzeltme', katalogId, kod:(k&&k.kod)||'', adet: yeni-onceki,
          oncekiAdet: onceki, sonrakiAdet: yeni, isEmriNo:'', mm:0, aciklama: not || 'Elle düzeltme',
          kaynak:'elle', operatorUsername: session.username, operatorName: session.displayName, ts: now };
        updates['karburStok/'+katalogId+'/sonHareketTs'] = now;
        updates['karburStok/'+katalogId+'/sonHareketAciklama'] = 'Elle düzeltme';
        DB.ref().update(updates).then(()=>{
          karburStok[katalogId] = { ...(karburStok[katalogId]||{}), adet: yeni, sonHareketTs: now };
          bitti((k&&k.kod)||katalogId, onceki);
        }).catch(hata);
      }).catch(hata);
    return;
  }

  if(rowId.indexOf('malzeme_')===0){
    const itemId = rowId.slice(8);
    const it = stockItems[itemId]; if(!it){ hata(new Error('kalem bulunamadı')); return; }
    if(it.tur==='boy'){
      stokDuzeltBusy = false;
      toast('Bu kalem lot bazlı — stoğu lot ekranından düzeltilir');
      render(); return;
    }
    const onceki = Number(it.miktar)||0;
    const hid = DB.ref('stockHareketleri').push().key;
    const updates = {};
    updates['stockItems/'+itemId+'/miktar'] = yeni;
    updates['stockItems/'+itemId+'/sonHareketTs'] = now;
    updates['stockItems/'+itemId+'/sonHareketAciklama'] = 'Elle düzeltme';
    updates['stockHareketleri/'+hid] = { itemId, itemKod: it.kod||'', itemIsim: it.isim||it.cap||'',
      miktar: yeni-onceki, birim: it.birim||'adet', tip:'duzeltme', aciklama: not || 'Elle düzeltme',
      isEmriNo:'', talepNo:'', operatorUsername: session.username, operatorName: session.displayName, ts: now };
    DB.ref().update(updates).then(()=>{
      stockItems[itemId] = { ...it, miktar: yeni, sonHareketTs: now };
      bitti(it.kod||itemId, onceki);
    }).catch(hata);
    return;
  }

  hata(new Error('bilinmeyen kalem türü'));
}

function renderStokDuzeltModal(){
  if(!stokDuzeltRowId || !stokDuzeltYetkisi()) return '';
  const satir = stokGenelSatirlar().find(s=>s.id===stokDuzeltRowId);
  if(!satir) return '';
  return `<div class="modal-overlay" onclick="if(event.target===this)stokDuzeltKapat()">
    <div class="modal-box" style="max-width:420px;padding:20px">
      <div class="sec-h" style="margin-top:0">Stoğu elle düzelt</div>
      <div style="font-size:13.5px;font-weight:600;margin-bottom:3px">${esc(satir.malzeme)}</div>
      <div class="mono" style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${esc(satir.kod)} · şu an ${esc(satir.stokText)}</div>
      <div class="field">
        <label for="sd-deger">Yeni stok</label>
        <input id="sd-deger" inputmode="numeric" value="${esc(stokDuzeltDeger)}" oninput="stokDuzeltDeger=this.value">
      </div>
      <div class="field">
        <label for="sd-not">Not (hareket kütüğüne yazılır)</label>
        <input id="sd-not" placeholder="ör. sayım sonucu" value="${esc(stokDuzeltNot)}" oninput="stokDuzeltNot=this.value">
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn-primary" style="flex:1" ${stokDuzeltBusy?'disabled':''} onclick="stokDuzeltKaydet()">${stokDuzeltBusy?'Kaydediliyor…':'Kaydet'}</button>
        <button class="btn-ghost" onclick="stokDuzeltKapat()">Vazgeç</button>
      </div>
    </div></div>`;
}

/* Durum rozeti — hem Genel Bakış tablosu hem kalem pencereleri aynısını kullanıyor, o yüzden
   renderStokGenelBakis içinden modül seviyesine çıkarıldı (kopyalanmadı). */
const durumPill = s => s.durum==='negatif'
    ? `<span class="sg-pill" style="color:var(--danger-text);background:var(--danger-bg);border:1px solid var(--danger-border)"><span style="width:6px;height:6px;border-radius:50%;background:var(--danger)"></span>Negatif</span>`
    : s.durum==='altlimit'
    ? `<span class="sg-pill" style="color:var(--warn-text);background:var(--warn-bg);border:1px solid var(--warn-border)"><span style="width:6px;height:6px;border-radius:50%;background:var(--warn)"></span>Alt limit</span>`
    : `<span class="sg-pill" style="color:var(--success-text);background:var(--success-bg);border:1px solid var(--success-border)"><span style="width:6px;height:6px;border-radius:50%;background:var(--success)"></span>Normal</span>`;
function stokGenelSatirlar(){
  const satirlar = [];
  if(isAdminTabVisible('takimStok')){
    toolCatalogArray().forEach(it=>{
      const stok = Number((toolStock[it.id]||{}).miktar)||0;
      const altLimit = Number(it.altLimit)||0;
      satirlar.push({
        id:'takim_'+it.id, kod: it.canias||it.kod||it.id, malzeme: it.ad||it.isim||'—', tur:'Takım', turEtiket:'takım',
        stokText: stok+' adet', stokSayi: stok, altLimit,
        durum: stok<0 ? 'negatif' : (altLimit>0 && stok<altLimit) ? 'altlimit' : 'normal',
        sonHareketTs: Number((toolStock[it.id]||{}).sonHareketTs)||0,
        sonHareketAciklama: (toolStock[it.id]||{}).sonHareketAciklama||'', kaynak:'Takım & Sarf'
      });
    });
  }
  if(isAdminTabVisible('karbur')){
    karburKatalogArray().forEach(k=>{
      const stok = karburStokAdet(k.id);
      const altLimit = Number(k.altLimit)||0;
      satirlar.push({
        id:'karbur_'+k.id, kod:k.kod, malzeme: `Ø${karburFmt(k.disCap)} ${k.kalite||''}`.trim()||'—', tur:'Karbür',
        turEtiket: (k.kullanim==='kesim') ? 'kesim' : 'adet',
        stokText: stok+' adet', stokSayi: stok, altLimit,
        durum: stok<0 ? 'negatif' : (altLimit>0 && stok<altLimit) ? 'altlimit' : 'normal',
        sonHareketTs: Number((karburStok[k.id]||{}).sonHareketTs)||0,
        sonHareketAciklama: (karburStok[k.id]||{}).sonHareketAciklama||'', kaynak:'Karbür'
      });
    });
  }
  if(canManageStock()){
    stockItemsArray().forEach(it=>{
      const altLimit = Number(it.altLimit)||0;
      let stok, stokText;
      let turEtiket;
      if(it.tur==='boy'){
        stok = lotsArray(it).reduce((s,l)=>s+(Number(l.boy)||0),0);
        stokText = stok+' '+(it.birim||'mm');
        turEtiket = lotsArray(it).length+' lot';
      } else {
        stok = Number(it.miktar)||0;
        stokText = stok+' '+(it.birim||'adet');
        turEtiket = 'adet';
      }
      satirlar.push({
        id:'malzeme_'+it.id, kod: it.kod||it.id, malzeme: it.isim || it.cap || '—', tur:'Hammadde', turEtiket,
        stokText, stokSayi: stok, altLimit,
        durum: stok<0 ? 'negatif' : (altLimit>0 && stok<altLimit) ? 'altlimit' : 'normal',
        sonHareketTs: Number(it.sonHareketTs)||0, sonHareketAciklama: it.sonHareketAciklama||'', kaynak:'Hammadde'
      });
    });
  }
  return satirlar;
}
/* Genel Bakış'ın "Son Hareketler" paneli — item üzerindeki denormalize sonHareketTs/Aciklama
   YETERLİ değil (kim/ne kadar bilgisi yok), bu yüzden üç hareket log'undan GERÇEK son kayıtları
   çekiyoruz. Bulk okuma DEĞİL — hepsi .indexOn:["ts"] (database.rules.json) sayesinde
   orderByChild('ts').limitToLast(N) ile ucuz, hedefli bir sorgu (mevcut "maliyet optimizasyonu"
   deseniyle aynı ilke — bkz. BACKEND.md §8). Sadece bir kere yükleniyor, ekran açık kaldığı
   sürece yeniden sorgulanmıyor (diğer ensureXLoaded fonksiyonlarıyla aynı desen). */
let stokSonHareketler = null;
let stokSonHareketlerLoading = false;
/* İkon, kaynak modüle değil EYLEM türüne göre seçiliyor (kullanıcının verdiği tam referansla
   birebir): giriş=aşağı ok, çıkış=yukarı ok, karbür tahsis=makas, sayım=pano-onay. */
function stokHareketSvg(eylem){
  const yollar = {
    giris:  'M19 14l-7 7m0 0l-7-7m7 7V3',
    cikis:  'M5 10l7-7m0 0l7 7m-7-7v18',
    tahsis: 'M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879a3 3 0 11-4.242-4.242L10.758 10.5m1.363 1.363L19 19',
    sayim:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
  };
  const d = yollar[eylem] || yollar.cikis;
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
}
function ensureStokSonHareketlerLoaded(cb){
  if(stokSonHareketler || stokSonHareketlerLoading) return;
  stokSonHareketlerLoading = true;
  Promise.all([
    DB.ref('toolMoves').orderByChild('ts').limitToLast(25).once('value').catch(()=>null),
    DB.ref('karburHareketleri').orderByChild('ts').limitToLast(25).once('value').catch(()=>null),
    DB.ref('stockHareketleri').orderByChild('ts').limitToLast(25).once('value').catch(()=>null)
  ]).then(([toolSnap, karburSnap, malzemeSnap])=>{
    const hepsi = [];
    if(toolSnap) toolSnap.forEach(c=>{
      const v = c.val();
      const eylem = v.tip==='giris' ? 'giris' : 'cikis';
      hepsi.push({ kod: v.canias||'', baslik: (eylem==='giris'?'Stok girişi':(v.makine?v.makine+' çıkışı':'Takım çıkışı')),
        altBaslik: `${v.canias||''} ${v.miktar>0?'+':''}${v.miktar} · ${v.operatorName||''}`.trim(), ts: v.ts||0, svg: stokHareketSvg(eylem) });
    });
    if(karburSnap) karburSnap.forEach(c=>{
      const v = c.val();
      if(v.tip==='tahsis') hepsi.push({ kod: v.kod||'', baslik:'Karbür tahsis'+(v.isEmriNo?' · '+v.isEmriNo:''),
        altBaslik: `${v.parca||v.kod||''}${v.mm?' · '+v.mm+'mm':''}`, ts: v.ts||0, svg: stokHareketSvg('tahsis') });
      else { const eylem = v.tip==='giris' ? 'giris' : v.tip==='sayim' ? 'sayim' : 'cikis';
        hepsi.push({ kod: v.kod||'', baslik: v.tip==='giris'?'Stok girişi':v.tip==='sayim'?'Sayım düzeltme':'Karbür hareketi',
        altBaslik: `${v.kod||''} ${v.adet>0?'+':''}${v.adet||0} · ${v.operatorName||''}`.trim(), ts: v.ts||0, svg: stokHareketSvg(eylem) }); }
    });
    if(malzemeSnap) malzemeSnap.forEach(c=>{
      const v = c.val();
      const eylem = v.tip==='giris' ? 'giris' : v.tip==='sayim' ? 'sayim' : 'cikis';
      hepsi.push({ kod: v.itemKod||'', baslik: v.tip==='giris'?'Stok girişi':v.tip==='sayim'?'Sayım düzeltme':'Stok hareketi',
        altBaslik: `${v.itemKod||''} ${v.miktar>0?'+':''}${v.miktar||0}${v.birim||''} · ${v.operatorName||''}`.trim(), ts: v.ts||0, svg: stokHareketSvg(eylem) });
    });
    hepsi.sort((a,b)=>b.ts-a.ts);
    stokSonHareketler = hepsi.slice(0,40);
    stokSonHareketlerLoading = false;
    if(cb) cb();
  }).catch(()=>{ stokSonHareketlerLoading = false; stokSonHareketler = []; });
}
let stokGenelTurFiltre = 'tumu';   // 'tumu' | 'Takım' | 'Karbür' | 'Hammadde'
/* Sayfalama ve siralama durumu 28.09.2026'da kaldirildi: Genel Bakis'taki stok kalemleri
   tablosu ec06e25'te yerini Son Hareketler'e birakinca bunlari okuyan tek yer kalmadi
   (stokGenelSayfaGit ve stokGenelSiralamaDegistir hic cagrilmiyordu). stokGenelTurFiltre
   DURUYOR: KPI kartlarinin aktif vurgusunu ve stokGenelHedefModul()'u besliyor. */
function stokGenelTurDegistir(v){ stokGenelTurFiltre = v; render(); }
/* Genel Bakış'ın üst başlığındaki "Excel Yükle"/"Stok Girişi" butonları — üç kaynağı birden
   temsil eden TEK bir hedef olmadığı için, o an seçili Tür filtresine (ya da varsayılan olarak
   Hammadde'ye) yönlendiriyor; ilgili modülün zaten var olan Excel/Giriş bölümünü açıyor. */
function stokGenelHedefModul(){ return stokGenelTurFiltre==='Takım' ? 'takim' : stokGenelTurFiltre==='Karbür' ? 'karbur' : 'malzeme'; }
// hedefOverride: üst başlık her sekmede sabit kaldığı için (bkz. renderStokScreen), o an
// hangi modül açıksa butonlar ONA gitsin diye kullanılıyor — Genel Bakış'tayken override
// verilmez, filtre bazlı stokGenelHedefModul() devreye girer.
function stokGenelExcelAc(hedefOverride){
  /* Modül içi Excel bölümleri kaldırıldı; düğme artık Excel Yükleme ekranını açıp ilgili
     sekmeyi seçiyor. EXCEL_BOLUMLERI anahtarları modül anahtarlarıyla birebir aynı
     (takim | karbur | malzeme), o yüzden ek eşleme gerekmiyor. Kullanıcının o sekmeye izni
     yoksa renderExcelYukleme ilk görünür sekmeye düşürüyor. */
  setView('excelYukleme');
  setExcelSubView(hedefOverride || stokGenelHedefModul());
}
function stokGenelGirisAc(hedefOverride){
  const hedef = hedefOverride || stokGenelHedefModul();
  setStokSubView(hedef);
  if(hedef==='takim') setToolAdminSubView('giris'); else if(hedef==='karbur') karburSetSubView('giris'); else setMalzemeSubView('giris');
}
/* "Son Hareketler" panelindeki Tümü düğmesi (28.09.2026). Panel üç kaynağın hareketlerini
   birleştiriyor ama modüllerin her birinin KENDİ Hareketler bölümü var; tek bir "tüm
   hareketler" ekranı yok. O yüzden Excel/Giriş düğmeleriyle aynı kuralı kullanıyor:
   o an seçili Tür filtresine (yoksa Hammadde'ye) gidiyor.
   Bölüm anahtarları modüller arasında farklı — Takım/Karbür'de 'gecmis', Hammadde'de
   'hareketler' (bkz. STOK_BOLUM_TANIM); etiketleri aynı ("Hareketler"), anahtarları değil. */
function stokGenelHareketlerAc(hedefOverride){
  const hedef = hedefOverride || stokGenelHedefModul();
  setStokSubView(hedef);
  if(hedef==='takim') setToolAdminSubView('gecmis'); else if(hedef==='karbur') karburSetSubView('gecmis'); else setMalzemeSubView('hareketler');
}
function stokGenelZamanKisa(ts){
  if(!ts) return '—';
  const fark = Date.now()-ts;
  const dk = Math.floor(fark/60000);
  if(dk<1) return 'az önce';
  if(dk<60) return dk+' dk';
  const sa = Math.floor(dk/60);
  if(sa<24) return sa+' sa';
  return Math.floor(sa/24)+' gün';
}
/* Şefin açtığı, CANİAS kodu bekleyen hammaddeler (01.10.2026, bkz. js/state.js yeniHammaddeAc).
   Stok Genel Bakış'ın en üstünde, yalnızca bekleyen varsa. Kodu yalnızca SuperAdmin bağlar;
   Şef listeyi görür ama kod alanı yerine "SuperAdmin bekleniyor" görür. Kod çoğunlukla
   CANİAS listesi yeniden yüklenince kendiliğinden bağlanıyor — bu kart eşleşmeyenler için. */
function caniasKoduBekleyenKartiHtml(){
  const liste = caniasKoduBekleyenler();
  if(!liste.length) return '';
  const sa = !!(session && session.isSuperAdmin);
  return `<div class="notice" style="--nc:var(--warn);margin:0 24px 14px">
    <div class="notice-title">CANİAS kodu bekleyen ${liste.length} hammadde</div>
    <div class="notice-sub" style="margin-bottom:8px">Şef CANİAS'ta henüz olmayan malzemeyi açtı. Kodu CANİAS'ta açınca hammadde listesini Excel Yükleme → Hammadde'ye yüklemen yeter, kendiliğinden bağlanır; eşleşmeyen olursa kodu buradan gir.</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${liste.map(it=>`<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:8px 10px">
        <div style="flex:1;min-width:180px"><span class="mono" style="font-weight:600">${esc(it.isim || [it.kod,it.cap].filter(Boolean).join(' '))}</span>
          <div style="font-size:11.5px;color:var(--text-muted)">${esc(it.acanName||it.acanUsername||'—')} · ${it.acilisTs?fmtDT(it.acilisTs):'—'} · ${it.tur==='boy'?lotsArray(it).length+' çubuk':(Number(it.miktar)||0)+' adet'}</div></div>
        ${sa ? `<input class="mono" style="width:150px;margin:0" placeholder="KLPHM000…" value="${esc(hkGirdi[it.id]||'')}" oninput="hkGirdi['${escJs(it.id)}']=this.value">
          <button class="btn-primary" style="width:auto;padding:8px 14px" onclick="hammaddeKodBagla('${escJs(it.id)}')">Kodu Bağla</button>`
          : `<span style="font-size:11.5px;color:var(--warn)">SuperAdmin bekleniyor</span>`}
      </div>`).join('')}
    </div>
  </div>`;
}
function renderStokGenelBakis(){
  ensureToolCatalogLoaded(()=>safeRender());
  ensureToolStockLoaded(()=>safeRender());
  ensureKarburKatalogLoaded(()=>safeRender());
  ensureKarburStokLoaded(()=>safeRender());
  ensureStokSonHareketlerLoaded(()=>safeRender());
  const tumu = stokGenelSatirlar();
  const kritik = tumu.filter(s=>s.durum!=='normal').sort((a,b)=>a.stokSayi-b.stokSayi).slice(0,8);
  const sayTakim = tumu.filter(s=>s.tur==='Takım').length;
  const sayKarbur = tumu.filter(s=>s.tur==='Karbür').length;
  const sayMalzeme = tumu.filter(s=>s.tur==='Hammadde').length;
  const sayKritik = tumu.filter(s=>s.durum!=='normal').length;
  const sayNegatif = tumu.filter(s=>s.durum==='negatif').length;
  const fireSayisi = karburFireArray().length;

  const kpiAktifMi = tur => stokGenelTurFiltre===tur;
  const kpiIkon = (i,aktif) => `<span style="width:24px;height:24px;border-radius:7px;background:${aktif?'color-mix(in srgb,currentColor 15%,transparent)':'var(--panel-alt)'};display:flex;align-items:center;justify-content:center;color:${aktif?'#fff':'var(--text-muted)'};flex:none">${i}</span>`;
  const kpiOk = aktif => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${aktif?'#fff':'var(--text-subtle)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>`;
  /* Kart tıklaması artık TÜR FİLTRESİ değil, o türün kalem penceresini açıyor (kullanıcı isteği).
     Tür filtresi kaybolmadı — tablonun üstündeki "Tür:" açılır menüsü aynı işi yapıyor ve
     kartın "aktif" vurgusu hala o filtreyi yansıtıyor. */
  const kpiTikla = tur => `onclick="stokListeAc('${tur}')" style="cursor:pointer" title="${esc(tur==='tumu'?'Tüm kalemleri':tur+' kalemlerini')} pencerede aç"`;
  return `${caniasKoduBekleyenKartiHtml()}
    <div class="stok-genel-kpi">
      <div class="sgk-card ${stokGenelTurFiltre==='tumu'?'aktif':''}" ${kpiTikla('tumu')}>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">${kpiIkon(ico('list',16),stokGenelTurFiltre==='tumu')}${kpiOk(stokGenelTurFiltre==='tumu')}</div>
        <div style="margin-top:6px"><div class="sgk-num">${sayMalzeme+sayTakim+sayKarbur}</div><div class="sgk-label">Tüm Kalemler</div>
        <div style="font-size:12px;margin-top:4px;color:${stokGenelTurFiltre==='tumu'?'color-mix(in srgb,currentColor 70%,transparent)':'var(--text-subtle)'}">üç kaynak bir arada</div></div>
      </div>
      <div class="sgk-card ${kpiAktifMi('Hammadde')?'aktif':''}" ${kpiTikla('Hammadde')}>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">${kpiIkon(ico('katman',16),kpiAktifMi('Hammadde'))}${kpiOk(kpiAktifMi('Hammadde'))}</div>
        <div style="margin-top:6px"><div class="sgk-num">${sayMalzeme}</div><div class="sgk-label">Hammadde Kalemi</div>
        <div style="font-size:12px;margin-top:4px;color:${kpiAktifMi('Hammadde')?'color-mix(in srgb,currentColor 70%,transparent)':'var(--text-subtle)'}">stockItems</div></div>
      </div>
      <div class="sgk-card ${kpiAktifMi('Takım')?'aktif':''}" ${kpiTikla('Takım')}>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">${kpiIkon(ico('wrench',16),kpiAktifMi('Takım'))}${kpiOk(kpiAktifMi('Takım'))}</div>
        <div style="margin-top:6px"><div class="sgk-num">${sayTakim}</div><div class="sgk-label">Takım & Sarf Kalemi</div>
        <div style="font-size:12px;margin-top:4px;color:${kpiAktifMi('Takım')?'color-mix(in srgb,currentColor 70%,transparent)':'var(--text-subtle)'}">toolCatalog</div></div>
      </div>
      <div class="sgk-card ${kpiAktifMi('Karbür')?'aktif':''}" ${kpiTikla('Karbür')}>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">${kpiIkon(ico('elmas',16),kpiAktifMi('Karbür'))}${kpiOk(kpiAktifMi('Karbür'))}</div>
        <div style="margin-top:6px"><div class="sgk-num">${sayKarbur}</div><div class="sgk-label">Karbür Kalemi</div>
        <div style="font-size:12px;margin-top:4px;color:${kpiAktifMi('Karbür')?'color-mix(in srgb,currentColor 70%,transparent)':'var(--text-subtle)'}">Fire havuzu: ${fireSayisi} parça</div></div>
      </div>
      <div class="sgk-card uyari" style="cursor:pointer" title="Stoğu biten kalemleri pencerede aç" onclick="stokListeAc('kritik')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <span style="width:24px;height:24px;border-radius:7px;background:color-mix(in srgb,currentColor 15%,transparent);display:flex;align-items:center;justify-content:center;flex:none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
          </span>
          <span style="background:var(--panel);color:var(--danger-text);font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:6px">ACİL</span>
        </div>
        <div style="margin-top:6px"><div class="sgk-num">${sayKritik}</div><div class="sgk-label">Alt Limit / Negatif</div>
        <div style="font-size:12px;margin-top:4px">${sayNegatif} negatif stok · işlem devam ediyor</div></div>
      </div>
    </div>
    <div class="stok-genel-body">
      <!-- Kalem tablosu buradan KALDIRILDI: kalem listeleri artik KPI kartlarina tiklayinca
           acilan pencerelerde (stokListeAc) ve modul sekmelerinde duruyor, burada tekrar
           ediyordu. Yerine son hareketler geldi ve sag raydaki kucuk kopyasi kalkti. -->
      <div class="sg-table-wrap" style="padding:0 16px 8px">
        <div style="display:flex;align-items:center;gap:10px;padding:16px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:15px;font-weight:700;color:var(--text)">Son Hareketler</span>
          <span style="font-size:12px;font-weight:600;color:var(--text-muted);background:var(--panel-alt);border-radius:6px;padding:2px 8px">${stokSonHareketler ? stokSonHareketler.length : '…'}</span>
          <!-- Buradaki "pushLog" dugmesi 28.09.2026'da kaldirildi: etiketi ham bir kod adiydi ve
               stok hareketleriyle alakasiz sekilde kullanicinin BILDIRIM GECMISINI aciyordu.
               Yerine, panelin kendi isine bakan Tumu dugmesi geldi. -->
          <button style="background:transparent;font-size:12px;font-weight:600;color:var(--accent);margin-left:auto;display:flex;align-items:center;gap:3px;padding:6px 8px;min-height:32px"
            title="Seçili türün tüm hareketlerini aç" onclick="stokGenelHareketlerAc()">Tümü ${ico('chevronRight',13)}</button>
        </div>
        <div style="overflow-y:auto">
        ${!stokSonHareketler
          ? `<div style="font-size:12.5px;color:var(--text-muted);padding:16px 0">Yükleniyor…</div>`
          : stokSonHareketler.length===0
            ? `<div style="font-size:12.5px;color:var(--text-muted);padding:16px 0">Henüz hareket yok.</div>`
            : stokSonHareketler.map(h=>`
          <div class="sg-crit-row" style="align-items:flex-start;justify-content:space-between;gap:10px">
            <div style="display:flex;align-items:flex-start;gap:12px;min-width:0">
              <span style="width:32px;height:32px;border-radius:8px;background:var(--panel-alt);color:var(--text-muted);display:flex;align-items:center;justify-content:center;flex:none">${h.svg}</span>
              <div style="min-width:0">
                <div style="font-size:12.5px;font-weight:700;color:var(--text)">${esc(h.baslik)}</div>
                <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.altBaslik)}</div>
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-subtle);flex:none;white-space:nowrap">${stokGenelZamanKisa(h.ts)}</div>
          </div>`).join('')}
        </div>
      </div>
      <div class="sg-side">
        <div class="sg-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--panel-alt);margin-bottom:2px">
            <span class="sg-panel-title" style="margin-bottom:0">Kritik Stok</span>
            <span style="font-size:12px;color:var(--danger-text);font-weight:600;background:var(--danger-bg);border:1px solid var(--danger-border);border-radius:9999px;padding:2px 9px">${sayKritik} kalem</span>
          </div>
          ${kritik.length===0 ? `<div style="font-size:12px;color:var(--text-muted);padding:12px 0">Kritik kalem yok.</div>` : kritik.map(s=>`
            <div class="sg-crit-row" style="justify-content:space-between">
              <div style="display:flex;align-items:center;gap:12px;min-width:0">
                <span style="width:32px;height:32px;border-radius:8px;background:var(--danger-bg);border:1px solid var(--danger-border);color:var(--danger-text);display:flex;align-items:center;justify-content:center;flex:none">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </span>
                <div style="min-width:0"><div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.malzeme)}</div><div class="mono" style="font-size:11px;color:var(--text-subtle)">${esc(s.kod)}</div></div>
              </div>
              <div style="font-size:14px;font-weight:700;color:var(--danger-text);flex:none">${s.stokSayi}</div>
            </div>
          `).join('')}
          ${kritik.length>0 ? `<button style="width:100%;margin-top:16px;padding:8px 12px;background:var(--panel);border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:600;color:var(--text);display:flex;align-items:center;justify-content:center;gap:6px" onclick="stokGenelTurDegistir('tumu'); render()">Tümünü Gör ${ico('chevronRight',14)}</button>` : ''}
        </div>
      </div>
      <div class="sg-side">
        <div class="sg-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--panel-alt);margin-bottom:6px">
            <span class="sg-panel-title" style="margin-bottom:0">Genel Durum</span>
            <span style="font-size:11.5px;color:var(--text-subtle)">kaynak bazında</span>
          </div>
          ${stokGenelDurumTablosu(tumu)}
        </div>
      </div>
    </div>
    `;
}
/* ===================== GENEL DURUM TABLOSU (28.09.2026) =====================
   Kritik Stok paneli ekranin ucte ikisini kapliyordu; daraltilinca bosalan yere kaynak
   bazinda ozet geldi. Sayilar stokGenelSatirlar()'in AYNI ciktisindan turetiliyor, ayri
   bir sorgu yok — KPI kartlari ve Kritik Stok ile ayni veriden beslendigi icin rakamlar
   birbiriyle celismiyor.

   Sutunlar bilerek ayrisik: "Stok yok" tam sifir, "Negatif" sifirin altinda, "Alt limit"
   ise stogu VAR ama tanimli limitin altinda (durum==='altlimit'). Ucu toplanmaz, her biri
   farkli bir aksiyon demek. */
function stokGenelDurumTablosu(tumu){
  const KAYNAKLAR = [
    { tur:'Hammadde', ad:'Hammadde' },
    { tur:'Takım',    ad:'Takım & Sarf' },
    { tur:'Karbür',   ad:'Karbür' },
  ];
  const olc = liste => ({
    kalem: liste.length,
    yok: liste.filter(x=>Number(x.stokSayi)===0).length,
    alt: liste.filter(x=>x.durum==='altlimit').length,
    neg: liste.filter(x=>x.durum==='negatif').length,
  });
  const satir = (ad, o, kalin) => `<tr${kalin?' style="font-weight:700"':''}>
    <td style="font-weight:${kalin?700:500}">${esc(ad)}</td>
    <td class="mono" style="text-align:right">${o.kalem}</td>
    <td class="mono" style="text-align:right;color:${o.yok?'var(--warn)':'var(--text-subtle)'}">${o.yok||'—'}</td>
    <td class="mono" style="text-align:right;color:${o.alt?'var(--warn)':'var(--text-subtle)'}">${o.alt||'—'}</td>
    <td class="mono" style="text-align:right;color:${o.neg?'var(--danger)':'var(--text-subtle)'}">${o.neg||'—'}</td>
  </tr>`;
  return `<div class="sg-table-wrap" style="padding:0">
    <table style="font-size:12.5px">
      <thead><tr>
        <th>Kaynak</th>
        <th style="text-align:right">Kalem</th>
        <th style="text-align:right" title="Stoğu tam sıfır">Stok yok</th>
        <th style="text-align:right" title="Stok var ama tanımlı alt limitin altında">Alt limit</th>
        <th style="text-align:right" title="Stok sıfırın altına düşmüş">Negatif</th>
      </tr></thead>
      <tbody>
        ${KAYNAKLAR.map(k=>satir(k.ad, olc(tumu.filter(x=>x.tur===k.tur)))).join('')}
        ${satir('Toplam', olc(tumu), true)}
      </tbody>
    </table>
  </div>`;
}
function renderStokScreen(){
  const gorunur = STOK_BOLUMLERI.filter(b=>b.gor());
  if(!gorunur.length) return `<div class="settings-wrap"><div style="color:var(--text-muted);font-size:12.5px">Stok ekranlarına erişim yetkin yok.</div></div>`;
  if(!gorunur.some(b=>b.key===stokSubView)) stokSubView = gorunur[0].key;
  if(stokSubView==='malzeme') malzemeHareketGerekli();

  /* Üst başlık + arama — ARTIK HER modül sekmesinde sabit (tasarım tuvaliyle birebir, bkz.
     design/StokTakibiOneri.dc.html). Önceden sadece Genel Bakış'ta gösteriliyordu; kullanıcı
     sekme değiştirince bu barın kaybolup sekme şeridinin yer değiştirmesinden rahatsız oldu —
     artık konum sabit, sadece kırıntı/hedef aktif sekmeye göre değişiyor. Arama kutusu her
     zaman Genel Bakış'ın aggregasyonunu süzer (stokGenelArama) ve yazınca oraya geçer, çünkü
     diğer modüllerin kendi arama kutuları zaten kendi ekranlarında var. */
  const ustHedef = stokSubView==='genel' ? stokGenelHedefModul() : stokSubView;
  /* Breadcrumb ve "Stok Takibi" basligi 22.09.2026'da UST BARA tasindi (ekranBasligiHtml);
     burada birakilsaydi ayni baslik ekranda iki kez gorunurdu. Arama ve aksiyon butonlari
     kaldi. */
  const topHeader = `<div class="stok-top-header">
    <div style="flex:1;display:flex;justify-content:center;min-width:180px">
      <label class="stok-top-search">
        ${ico('search',14)}
        <input placeholder="Kod, CANIAS no veya malzeme ara…" value="${esc(stokGenelArama)}" oninput="stokAramaYaz(this.value)">
        <kbd style="font-size:10px;color:var(--text-subtle);border:1px solid var(--border);padding:1px 5px;border-radius:4px;flex:none">⌘K</kbd>
      </label>
    </div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:none">
      <button class="btn-ghost" style="width:auto;display:flex;align-items:center;gap:7px;padding:9px 15px;box-shadow:var(--card-shadow)" onclick="stokGenelExcelAc('${escJs(ustHedef)}')" title="${esc(STOK_BOLUMLERI.find(b=>b.key===ustHedef).label)} → Excel Yükle">${ico('upload',14)} Excel Yükle</button>
      <button class="btn-primary" style="width:auto;display:flex;align-items:center;gap:6px;padding:9px 17px;box-shadow:var(--card-shadow)" onclick="stokGenelGirisAc('${escJs(ustHedef)}')" title="${esc(STOK_BOLUMLERI.find(b=>b.key===ustHedef).label)} → Giriş">${ico('plus',14)} Stok Girişi</button>
      <button class="icon-btn" style="position:relative;border-color:var(--border);width:38px;height:38px;border-radius:8px" onclick="openMyPushHistoryModal()" title="Bildirimler">
        ${ico('bell',16)}${unreadPushCount()>0?`<span style="position:absolute;top:7px;right:7px;width:8px;height:8px;background:var(--accent);border:2px solid var(--panel);border-radius:50%"></span>`:''}
      </button>
    </div>
  </div>`;

  /* Seviye 2 — MODÜL SEKMELERİ (2026-09-15: dikey rayın yerini yatay sekme şeridi aldı, Stok
     Takibi tasarım tuvaliyle hizalı — bkz. design/StokTakibiOneri.dc.html). Okuma/yazma mantığı
     (STOK_BOLUMLERI, setStokSubView) DEĞİŞMEDİ, sadece hangi HTML'e sarıldığı değişti. Sayımlar
     sadece o kaynağın verisi ZATEN yüklüyse gösteriliyor — sırf rozet göstermek için ekstra
     Firebase okuması TETİKLENMİYOR (bkz. app genelindeki "maliyet optimizasyonu" ilkesi). */
  const ray = `<div class="stok-tab-row">
    ${gorunur.map(b=>{
      const sayi = stokBolumSayisi(b.key);
      return `<button class="stok-tab-btn ${stokSubView===b.key?'active':''}" onclick="setStokSubView('${escJs(b.key)}')">
        ${ico(b.ikon,15)} ${esc(b.label)}${sayi!=null ? `<span class="stb-ct">${sayi}</span>` : ''}
      </button>`;
    }).join('')}
    <div class="stok-tab-durum" style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);white-space:nowrap;padding:0 4px">
      <span style="width:6px;height:6px;border-radius:50%;background:var(--success);flex:none"></span>RTDB canlı: stockItems · toolStock · karburStok
    </div>
  </div>`;

  /* Seviye 3 — BÖLÜMLER. Üç modülün üçü de kendi satırını kendi çiziyordu; artık tek yerden,
     ana sekmelerle aynı görsel dilde (.sub-tab-btn) çiziliyor. */
  const tanim = STOK_BOLUM_TANIM[stokSubView];
  /* Malzeme modülü kapalıyken üç bölüm de aynı "modül kapalı" yazısını gösteriyor —
     o hâlde bölüm satırı üç kere aynı yere götüren bir gürültüden ibaret, gizliyoruz.
     Takım ve Karbür'de böyle bir istisna yok: onların yönetim ekranı modül kapalıyken de
     çalışıyor (kapalı olan yalnızca operatöre görünürlük). */
  const bolumSatiriGizli = stokSubView === 'malzeme' && !stockEnabled();
  const bolumler = (tanim && !bolumSatiriGizli) ? tanim.bolumler.filter(x=>tanim.gor(x.key)) : [];
  /* "Excel Yükle" bölümü 22.09.2026'da üç modülden de çıkıp Excel Yükleme ekranına taşındı;
     state'te kalmış eski değerin artık şeritte karşılığı yok ve hiçbir düğme seçili görünmüyordu.
     Karşılığı olmayan her değer ilk görünür bölüme çekiliyor. Excel Yükleme ekranı renderStokScreen'den
     GEÇMİYOR, o yüzden oranın kendi 'excel' değeri bu geri düşüşten etkilenmiyor. */
  let aktif = tanim ? tanim.oku() : null;
  if(tanim && tanim.ayarla && bolumler.length && !bolumler.some(x=>x.key===aktif)){
    tanim.ayarla(bolumler[0].key);
    aktif = tanim.oku();
  }
  const bolumSatiri = bolumler.length ? `<div class="sub-tabs stok-bolumler">
    ${bolumler.map(x=>`<button class="sub-tab-btn ${aktif===x.key?'active':''}" onclick="${tanim.yaz(x.key)}">${esc(x.label)}</button>`).join('')}
  </div>` : '';

  let icerik;
  if(stokSubView==='genel')       icerik = renderStokGenelBakis();
  else if(stokSubView==='takim')  icerik = renderToolStokManagementScreen();
  else if(stokSubView==='karbur') icerik = renderKarburScreen();
  else if(stokSubView==='malzeme') icerik = `<div class="settings-wrap">${renderMalzemeStokScreen()}</div>`;
  else if(stokSubView==='bekleyen') icerik = renderMalzemeBekleyen();
  else                             icerik = '';

  return `<div class="stok-govde">${topHeader}${ray}<div class="stok-icerik">${bolumSatiri}${icerik}</div></div>`;
}
/* ===================== KRİTİK STOK SEKMESİ (22.09.2026) =====================
   Genel Bakış'taki kırmızı "ACİL — Alt Limit / Negatif" kartına tıklayınca buraya geliniyor.

   İKİ AYRI GRUP, bilerek: kartın saydığı küme ile "stoğu bitenler" AYNI ŞEY DEĞİL.
   stokGenelSatirlar()'daki kural şu:
       durum = stok<0 ? 'negatif' : (altLimit>0 && stok<altLimit) ? 'altlimit' : 'normal'
   Yani alt limiti tanımlanmamış (altLimit=0) ve stoğu sıfıra inmiş bir kalem 'normal'
   sayılıyor ve karta hiç girmiyor. Kullanıcının istediği "stoğu kalmamış" kalemler büyük
   ölçüde bunlar. Bu yüzden sekme iki başlık altında topluyor:
     1) Stoğu bitenler      -> stokSayi <= 0 (negatif olanlar dahil, en üstte)
     2) Alt limitin altında -> stok var ama tanımlı alt limitin altında
   Böylece hem kartın işaret ettiği liste hem de karta girmeyen "sıfırlananlar" görünüyor.

   Satırlar Genel Bakış'ın ürettiği aynı veriden (stokGenelSatirlar) geliyor — Takım & Sarf,
   Karbür ve Hammadde bir arada; tür sütunu hangisi olduğunu söylüyor. Düzeltme butonu
   Genel Bakış'takiyle aynı fonksiyonu çağırıyor (stokDuzeltAc), yani yetki de aynı:
   yalnızca SuperAdmin. */
function stokKritikVeri(){
  const tumu = stokGenelSatirlar();
  const bitenler = tumu.filter(s=>Number(s.stokSayi)<=0)
    .sort((a,b)=>Number(a.stokSayi)-Number(b.stokSayi) || String(a.kod).localeCompare(String(b.kod)));
  const altLimit = tumu.filter(s=>Number(s.stokSayi)>0 && s.durum==='altlimit')
    .sort((a,b)=>(Number(a.stokSayi)/Math.max(1,Number(a.altLimit))) - (Number(b.stokSayi)/Math.max(1,Number(b.altLimit))));
  return { bitenler, altLimit };
}

/* Kritik stok listesi, uygulamanın kendi modal penceresinde açılıyor (Rapor'daki kayıt detay
   penceresiyle aynı desen: .modal-overlay + .modal-box). Önce ayrı bir tarayıcı penceresi
   (window.open) denendi — kullanıcının kastettiği o değildi.

   Liste uzun olabildiği için gövde kendi içinde kayıyor, başlık ve kapat düğmesi sabit kalıyor.
   Satırlardaki düzeltme butonu Genel Bakış'takiyle aynı fonksiyonu (stokDuzeltAc) çağırıyor,
   yani yetki de aynı: yalnızca SuperAdmin. Düzeltme penceresi bunun ÜSTÜNE açılıyor (kabuktaki
   modal zincirinde sonra geldiği için), kapanınca liste yerinde kalıyor. */
/* KPI kartlarının hepsi aynı pencereyi açıyor, yalnızca hangi kümeyi göstereceği değişiyor:
   'tumu' | 'Hammadde' | 'Takım' | 'Karbür' | 'kritik'. */
let stokListeModalTur = null;
function stokListeAc(tur){ stokListeModalTur = tur; stokListeAramaIle = false; render(); }
function stokListeKapat(){ stokListeModalTur = null; stokListeAramaIle = false; render(); }

/* ===================== STOK ARAMASI (28.09.2026) =====================
   Ust bardaki arama kutusu, Genel Bakis'taki stok tablosu kaldirilinca (ec06e25) suzecek
   bir sey bulamiyordu: yaziliyor ama hicbir sey olmuyordu. Artik uc kaynagi birden
   (Takim & Sarf + Karbur + Hammadde) tarayan "Tum Kalemler" penceresini aciyor ve suzuyor.

   Arama kod, malzeme adi ve kaynak/tur alanlarinda geciyor; stokGenelSatirlar() zaten
   ucunu birlestirdigi icin "her yeri arama" ek bir sorgu gerektirmiyor.

   stokListeAramaIle: pencereyi ARAMANIN acip acmadigini tutuyor. Kullanici pencereyi KPI
   kartindan actiysa arama kutusunu temizlemek onu kapatmamali; yalnizca aramanin actigi
   pencere, arama silinince kapaniyor. */
let stokListeAramaIle = false;
function stokAramaYaz(v){
  stokGenelArama = v;
  const q = (v||'').trim();
  if(q){
    if(!stokListeModalTur){ stokListeModalTur = 'tumu'; stokListeAramaIle = true; }
    setStokSubView('genel');
    return; // setStokSubView zaten render ediyor
  }
  if(stokListeAramaIle){ stokListeModalTur = null; stokListeAramaIle = false; }
  render();
}
/* Satir arama suzgeci — kod, isim ve kaynak/tur uzerinde, Turkce normalizasyonla. */
function stokAramaSuz(liste){
  const q = trNorm((stokGenelArama||'').trim());
  if(!q) return liste;
  return liste.filter(x=> trNorm(`${x.kod} ${x.malzeme} ${x.kaynak||x.tur}`).includes(q));
}

function stokKritikTablo(liste, bosMetin){
  if(liste.length===0) return `<div style="color:var(--text-muted);font-size:12.5px;padding:10px 2px">${bosMetin}</div>`;
  const duzeltilebilir = (typeof stokDuzeltYetkisi==='function') && stokDuzeltYetkisi();
  /* HIZALAMA: .sg-table-wrap'te thead ile HER tbody satırı ayrı birer tablo (display:table +
     table-layout:fixed). Genişlikler iki tarafa da AYNI sırayla yazılmazsa sütunlar kayar —
     ilk halde yalnız başlıktaki son sütunda width vardı ve başlıklar veriyle hizalanmıyordu. */
  const gen = duzeltilebilir
    ? ['12%','27%','11%','10%','8%','12%','14%','6%']
    : ['13%','29%','12%','11%','9%','13%','13%'];
  const basliklar = ['Kod','Malzeme','Tür','Stok','Alt Limit','Durum','Son Hareket'].concat(duzeltilebilir?['']:[]);
  return `<div class="sg-table-wrap" style="margin-bottom:6px">
    <table><thead><tr>
      ${basliklar.map((b,k)=>`<th style="width:${gen[k]}">${b}</th>`).join('')}
    </tr></thead><tbody>
      ${liste.map(s=>{
        const h = [
          `<td class="mono" style="width:${gen[0]};font-weight:500;font-size:12.5px">${esc(s.kod)}</td>`,
          `<td style="width:${gen[1]};font-weight:500">${esc(s.malzeme)}</td>`,
          `<td style="width:${gen[2]};color:var(--text-muted)">${esc(s.kaynak||s.tur)}</td>`,
          `<td style="width:${gen[3]};font-weight:700;color:${Number(s.stokSayi)<0?'var(--danger)':Number(s.stokSayi)===0?'var(--warn)':'var(--text)'}">${esc(s.stokText)}</td>`,
          `<td class="mono" style="width:${gen[4]};color:var(--text-muted)">${s.altLimit||'—'}</td>`,
          `<td style="width:${gen[5]}">${durumPill(s)}</td>`,
          `<td style="width:${gen[6]};color:var(--text-subtle)">${s.sonHareketTs?esc(fmtDT(s.sonHareketTs)):'—'}</td>`,
        ];
        if(duzeltilebilir) h.push(`<td style="width:${gen[7]}"><button class="del-btn" title="Stoğu elle düzelt" onclick="stokDuzeltAc('${escJs(s.id)}',${Number(s.stokSayi)||0})">${ico('edit',14)}</button></td>`);
        return `<tr class="${Number(s.stokSayi)<0?'sg-neg':''}">${h.join('')}</tr>`;
      }).join('')}
    </tbody></table>
  </div>`;
}

function stokListeBasligi(tur){
  if(tur==='kritik')   return 'Kritik Stok';
  if(tur==='tumu')     return 'Tüm Kalemler';
  if(tur==='Takım')    return 'Takım & Sarf Kalemleri';
  if(tur==='Hammadde') return 'Hammadde Kalemleri';
  if(tur==='Karbür')   return 'Karbür Kalemleri';
  return 'Stok Kalemleri';
}
function renderStokListeModal(){
  const tur = stokListeModalTur;
  if(!tur) return '';
  const kritikMi = (tur==='kritik');
  let govde, altBilgi;
  if(kritikMi){
    const ham = stokKritikVeri();
    const bitenler = stokAramaSuz(ham.bitenler), altLimit = stokAramaSuz(ham.altLimit);
    const kartaGirmeyen = bitenler.filter(x=>x.durum==='normal').length;
    const ozet = Object.entries(bitenler.reduce((a,x)=>{ const k=x.kaynak||x.tur; a[k]=(a[k]||0)+1; return a; },{}))
      .map(([k,v])=>`${esc(k)} ${v}`).join(' · ');
    altBilgi = ozet;
    govde = `<div class="sec-h" style="margin-top:0">Stoğu bitenler
        <span class="ayar-deger mono" style="margin-left:8px">${bitenler.length}</span></div>
      <div style="font-size:12px;color:var(--text-muted);margin:-6px 0 10px;line-height:1.5">
        Stoğu sıfıra inmiş ya da eksiye düşmüş kalemler; takım çıkışında bunlar reddedilir.${
          kartaGirmeyen>0?` <b style="color:var(--warn)">${kartaGirmeyen} tanesi</b> alt limiti tanımlı olmadığı için "Alt Limit / Negatif" sayacına girmiyor.`:''}
      </div>
      ${stokKritikTablo(bitenler, 'Stoğu biten kalem yok.')}
      <div class="sec-h">Alt limitin altında
        <span class="ayar-deger mono" style="margin-left:8px">${altLimit.length}</span></div>
      <div style="font-size:12px;color:var(--text-muted);margin:-6px 0 10px">Stok var ama tanımlı alt limitin altına inmiş — en kritik oran en üstte.</div>
      ${stokKritikTablo(altLimit, 'Alt limitin altına inen kalem yok.')}`;
  } else {
    /* Liste, tabloyla AYNI sıralamada: önce sorunlular (negatif, sonra alt limit), sonra normaller. */
    const oncelik = x => x.durum==='negatif' ? 0 : x.durum==='altlimit' ? 1 : 2;
    const liste = stokAramaSuz(stokGenelSatirlar().filter(x=> tur==='tumu' ? true : x.tur===tur))
      .sort((a,b)=> oncelik(a)-oncelik(b) || Number(a.stokSayi)-Number(b.stokSayi) || String(a.kod).localeCompare(String(b.kod)));
    const sorunlu = liste.filter(x=>x.durum!=='normal').length;
    altBilgi = `${liste.length} kalem${sorunlu?` · ${sorunlu} tanesi alt limit / negatif`:''}`;
    govde = stokKritikTablo(liste, 'Kalem yok.');
  }
  return `<div class="modal-overlay" onclick="if(event.target===this)stokListeKapat()">
    <div class="modal-box" style="max-width:1060px;width:100%;max-height:86vh;display:flex;flex-direction:column;padding:0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px 14px;border-bottom:1px solid var(--border);flex:none">
        <div style="min-width:0">
          <div style="font-size:18px;font-weight:700;letter-spacing:-.2px">${esc(stokListeBasligi(tur))}${
            (stokGenelArama||'').trim() ? ` <span style="font-weight:500;color:var(--text-muted);font-size:14px">— "${esc(stokGenelArama.trim())}" araması</span>` : ''}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(fmtDT(Date.now()))} itibarıyla${altBilgi?` · ${altBilgi}`:''}</div>
        </div>
        <button class="icon-btn" style="flex:none" title="Kapat" onclick="stokListeKapat()">${ico('x',16)}</button>
      </div>
      <div style="flex:1;min-height:0;overflow-y:auto;padding:16px 22px 22px">${govde}</div>
    </div></div>`;
}

function stokBolumSayisi(key){
  if(key==='takim')    return toolCatalogReady ? toolCatalogArray().length : null;
  if(key==='karbur')   return karburKatalogReady ? karburKatalogArray().length : null;
  if(key==='malzeme')  return canManageStock() ? stockItemsArray().length : null;
  return null; // 'genel' — tek bir sayı yerine KPI kartlarında gösteriliyor
}

// "İş Yoğunluğu" sekmesi — operatörlerin "Bitir" sırasında işaretlediği sonrakiMakine alanına
// göre, hangi makinede kaç iş emri/adet biriktiğini gösterir (bkz. bekleyenSonrakiOperasyonlar,
// js/operations.js). Press özel durum: bir operasyon değil, _ZARF/_ELMAS'ın fiziksel olarak
// birleştiği (çakıldığı) yer — o yüzden Press satırı, ham kayıt listesi yerine presBekleyenCiftleri()
// ile TALEP NO bazında eşleştirilmiş "ikisi de hazır mı / hangisi eksik" görünümü kullanıyor.
// Kuyruktan çıkış hep AYNI mekanizmayla oluyor: biri o iş için gerçekten normal bir kayıt açıp
// Başla'ya bastığı an (Press'te birleştirme/Tek Parça, FKK'da aynı isEmriNo ile devam), o kayıt
// artık "en son" kayıt olur ve bekleyen listesinden kendiliğinden düşer — elle işaretlemeye gerek yok.
/* --- VERİ — dört görünümün tamamı bu tek hesaptan besleniyor ------------- */
/* MALZEME BEKLEYENLER İŞ YOĞUNLUĞUNDA (05.10.2026, kullanıcı isteği): "malzeme bekleyenlerin amacı
   onun da iş yoğunluğunda görünmesiydi". Malzeme bekleyen iş emrinin çoğu zaman HİÇ kaydı yok
   (testereye bile geçemedi), bu yüzden "sıradaki makine" kuyruğunda görünmüyordu. Ayrı bir satır
   olarak en üstte duruyor; satır rengi siparişin durumuna göre: istek no yoksa kırmızı, varsa sarı
   (malzemeIstekRenk). malzemeBekleyen canlı dinleniyor (bkz. js/malzeme-bekleyen.js). */
function iyMalzemeBekleyenler(){
  if(typeof malzemeBekleyenAktif!=='function') return [];
  ensureMalzemeBekleyenLoaded();
  if(!malzemeBekleyenReady) return [];
  return malzemeBekleyenAktif().slice().sort((a,b)=>(malzemeIstekVar(a)-malzemeIstekVar(b)) || (Number(a.isaretTs)||0)-(Number(b.isaretTs)||0));
}
function iyVeri(){
  const bekleyenler = bekleyenSonrakiOperasyonlar();
  // Sadece _ZARF/_ELMAS + Press kombinasyonu özel çift-eşleştirme görünümüne taşınıyor — bileşensiz
  // (normal) bir iş emri Press'i sonraki makine olarak işaretlemişse (zarf/elmas birleşimiyle
  // ilgisiz, farklı bir kullanım), genel makine listesinde olduğu gibi görünmeye devam etmeli.
  const digerBekleyenler = bekleyenler.filter(e => {
    const kod = String(e.sonrakiMakine||'').split(' · ')[0];
    const bilesen = bilesenOfCode(e.isEmriNo);
    return !(kod==='P01' && (bilesen==='ZARF' || bilesen==='ELMAS'));
  });
  const byMakine = {};
  digerBekleyenler.forEach(e=>{
    const key = e.sonrakiMakine;
    if(!byMakine[key]) byMakine[key] = { label:key, isEmriler:[] };
    byMakine[key].isEmriler.push(e);
  });
  const digerRows = Object.values(byMakine).map(m=>({
    label: m.label, isPres:false,
    isEmriSayisi: m.isEmriler.length,
    toplamAdet: m.isEmriler.reduce((s,e)=>s+(Number(e.adet)||0), 0),
    isEmriler: m.isEmriler.slice().sort((a,b)=>(a.endTs||0)-(b.endTs||0))
  }));
  const presCiftleri = presBekleyenCiftleri();
  const presRow = presCiftleri.length>0
    ? { label:'P01 · Pres (Zarf/Elmas Birleşimi)', isPres:true, isEmriSayisi: presCiftleri.length, toplamAdet:0, ciftler: presCiftleri }
    : null;
  const rows = [...digerRows, ...(presRow?[presRow]:[])].sort((a,b)=> b.isEmriSayisi - a.isEmriSayisi);
  const mb = iyMalzemeBekleyenler();
  const mbIstekYok = mb.filter(x=>!malzemeIstekVar(x)).length;
  const malzemeRow = mb.length>0 ? { label:'Malzeme Bekliyor', isMalzeme:true, isEmriSayisi: mb.length, istekYok: mbIstekYok,
    toplamAdet: mb.reduce((s,x)=>s+(Number(x.ieMiktar)||0), 0), kayitlar: mb } : null;
  const makineRows = rows;

  return {
    rows: malzemeRow ? [malzemeRow, ...makineRows] : makineRows,
    malzemeSayi: mb.length, malzemeIstekYok: mbIstekYok,
    malzemeTalepSet: new Set(mb.map(x=>String(x.talepNo||'').trim().toUpperCase()).filter(Boolean)),
    toplamIsEmri: digerBekleyenler.length + presCiftleri.length,
    toplamAdet: digerBekleyenler.reduce((s,e)=>s+(Number(e.adet)||0), 0),
    belirsizSayi: (byMakine['Belirsiz']?.isEmriler.length) || 0,
    hazirCiftSayisi: presCiftleri.filter(c=>c.ikisiDeHazir).length,
    doluMakine: makineRows.filter(r=>r.label!=='Belirsiz').length,
    enYuksek: Math.max(1, ...makineRows.map(r=>r.isEmriSayisi), mb.length)
  };
}
const iyKod = l => String(l||'').split(' · ')[0];
const iyAd  = l => String(l||'').split(' · ').slice(1).join(' · ');
// Yoğunluk rengi — eşikler ekranda tek anlam taşısın diye dört görünümde de aynı.
// MVP SINIRI (2026-09-21): eşik MUTLAK iş emri sayısı; makine kapasitesine göre
// normalize EDİLMEDİ. Günde 5 iş çıkaran bir pres ile günde 1 iş çıkaran bir ısıl
// işlem fırını, 5 bekleyen işte aynı kırmızıyı alıyor — birinde yarım günlük yük,
// diğerinde bir haftalık. Doğrusu eşiği makine başına beklenen çıktıya bölmek ya da
// sayıyı süreye çevirmek ("kaç günlük iş bekliyor"), ama bunun için makine kapasite
// verisi gerekiyor ve o veri modelde yok. Kısıt bazlı planlama/optimizasyon aşamasında
// zaten çözülecek; o zamana kadar bilinçli olarak mutlak sayıda kalıyor.
const iyRenk = n => n>=5 ? 'var(--danger)' : n>=3 ? 'var(--accent)' : 'var(--success)';
/* Malzeme satırı: içinde istek no'su girilmemiş tek bir kayıt bile varsa kırmızı, hepsinin varsa sarı. */
const iySatirRenk = r => r.isMalzeme ? (r.istekYok>0 ? 'var(--danger)' : 'var(--warn)') : r.label==='Belirsiz' ? 'var(--danger)' : iyRenk(r.isEmriSayisi);

/* --- ORTAK PARÇALAR ----------------------------------------------------- */
function iyKpiHtml(v){
  // --nc: kartın rayı ve sayısı aynı rengi paylaşıyor. "Belirsiz" sıfırdan büyükse
  // kart zemini de hafifçe tonlanıyor — bu ekranda aksiyon gerektiren tek KPI o.
  const kpi = (label, value, color, sub, vurgu) => `<div class="analiz-chart-box iy-kpi${vurgu?' iy-kpi-vurgu':''}" style="--nc:${color}">
    <div class="iy-kpi-label">${label}</div>
    <div class="mono iy-kpi-value">${value}</div>
    ${sub?`<div class="iy-kpi-sub">${sub}</div>`:''}
  </div>`;
  return `<div class="iy-kpi-grid">
    ${kpi('Bekleyen İş Emri', v.toplamIsEmri, 'var(--accent)', 'sıradaki operasyonu bekliyor')}
    ${kpi('Toplam Adet', v.toplamAdet, 'var(--success)', 'Press hariç — çift eşleşmesi adet toplamaz')}
    ${kpi('Dolu Makine Sayısı', v.doluMakine, 'var(--warn)', 'en az bir iş bekleyen makine')}
    ${kpi('Belirsiz', v.belirsizSayi, 'var(--danger)', 'sıradaki makinesi işaretlenmemiş', v.belirsizSayi>0)}
    ${v.malzemeSayi>0 ? kpi('Malzeme Bekliyor', v.malzemeSayi, v.malzemeIstekYok>0?'var(--danger)':'var(--warn)', v.malzemeIstekYok>0 ? `${v.malzemeIstekYok} tanesinde istek no yok` : 'hepsinin istek no’su girildi', v.malzemeIstekYok>0) : ''}
  </div>`;
}
// Bir kaydın son durumuna göre kısa özet + renk — arama sonucu kartlarında kullanılıyor.
function iyDurumOzeti(last){
  const makine = esc(last.makine||'—');
  if(last.status==='devam') return { renk:'var(--accent)', metin:`Şu an ${makine}'de işleniyor`, detay:`${esc(last.operatorName||last.operatorUsername||'')} · ${fmtDT(last.startTs)}'de başladı` };
  if(last.status==='duruş') return { renk:'var(--warn)', metin:`${makine}'de duraklatılmış`, detay:esc(last.duruşNedeni||'') };
  if(last.status==='tamamlandi' && last.sonOperasyon) return { renk:'var(--success)', metin:'Rota tamamlandı', detay:`${makine}'de bitti · ${fmtDT(last.endTs)}` };
  if(last.status==='tamamlandi' && !last.sonOperasyon){
    if(last.sonrakiMakine) return { renk: last.sonrakiMakine==='Belirsiz'?'var(--danger)':'var(--warn)', metin:`${makine}'de bitti`, detay:`Sırada ${esc(last.sonrakiMakine)} bekleniyor` };
    return { renk:'var(--text-muted)', metin:`${makine}'de bitti`, detay:'Sıradaki makine işaretlenmemiş (eski kayıt)' };
  }
  return { renk:'var(--text-muted)', metin:'Durum bilinmiyor', detay:'' };
}
function iyAramaSonucKartHtml(grp){
  const durum = iyDurumOzeti(grp.last);
  const bilesen = bilesenOfCode(grp.isEmriNo);
  const chain = grp.entries.map(e=>(e.makine||'').split(' · ')[0]||'—');
  return `<div class="analiz-chart-box" style="margin-bottom:10px">
    <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:8px">
      <span class="mono" style="font-weight:700;color:var(--accent);font-size:14px;cursor:pointer;text-decoration:underline dotted" onclick="openIyGecmisModal('${escJs(grp.isEmriNo)}')">${esc(grp.talepNo || grp.isEmriNo)}</span>
      ${bilesen ? `<span class="chip" style="padding:3px 9px;font-size:11px">${BILESEN_LABEL[bilesen]} (_${bilesen})</span>` : ''}
      ${grp.talepNo ? `<span style="font-size:11px;color:var(--text-muted)">U kodu: ${esc(grp.isEmriNo)}</span>` : ''}
    </div>
    <div style="margin-top:8px;font-size:13.5px;font-weight:600;color:${durum.renk}">${durum.metin}</div>
    ${durum.detay ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${durum.detay}</div>` : ''}
    <div class="route-chain" style="margin-top:10px">${chain.map((c,i)=>`<span class="route-chip">${esc(c)}</span>${i<chain.length-1?'<span class="route-arrow">→</span>':''}`).join('')}</div>
  </div>`;
}
// İş emri no'ya tıklayınca açılan "geçmiş" penceresi — isEmriNo'nun TÜM kayıtlarını kronolojik
// sırayla, her adımda hangi makine/kim/ne zaman olduğunu gösterir (bkz. iyGecmisIcinKayitlar).
function renderIyGecmisModal(){
  const isEmriNo = iyGecmisModalIsEmriNo;
  const kayitlar = iyGecmisIcinKayitlar(isEmriNo);
  if(kayitlar.length===0){ iyGecmisModalIsEmriNo = null; return ''; }
  const last = kayitlar[kayitlar.length-1];
  const durum = iyDurumOzeti(last);
  const bilesen = bilesenOfCode(isEmriNo);
  return `<div class="modal-overlay" onclick="if(event.target===this) closeIyGecmisModal()">
    <div class="modal-box" style="max-width:640px">
      <div class="modal-header">
        <div>
          <div class="modal-title">${esc(last.talepNo || isEmriNo)}</div>
          <div class="modal-sub">${last.talepNo ? `U kodu: ${esc(isEmriNo)}` : ''}${bilesen ? ` · ${BILESEN_LABEL[bilesen]} (_${bilesen})` : ''}</div>
        </div>
        <button class="icon-btn" onclick="closeIyGecmisModal()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div style="font-size:13.5px;font-weight:600;color:${durum.renk}">${durum.metin}</div>
        ${durum.detay ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;margin-bottom:16px">${durum.detay}</div>` : '<div style="margin-bottom:16px"></div>'}
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:10px">Geçmiş — ${kayitlar.length} adım</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${kayitlar.map((e,i)=>{
            const sureTxt = e.endTs ? fmtDur(e.endTs-e.startTs) : (e.status==='devam' ? fmtElapsed(entryDurationBreakdown(e).netMs)+' (sürüyor)' : '—');
            const durumEtiket = e.status==='devam' ? 'Devam Ediyor' : e.status==='duruş' ? 'Duraklatıldı' : 'Tamamlandı';
            return `<div style="background:var(--panel-alt);border:1px solid var(--border);border-radius:10px;padding:12px 14px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
                <span style="font-weight:700;color:var(--accent);font-size:13px">${i+1}. ${esc(e.makine||'—')}</span>
                <span style="font-size:11.5px;color:var(--text-muted)">${durumEtiket}</span>
              </div>
              <div style="font-size:12.5px;margin-top:6px">${esc(e.operatorName||e.operatorUsername||'—')}${e.finishedByUsername && e.finishedByUsername!==e.operatorUsername ? ` · Bitiren: ${esc(e.finishedByName||e.finishedByUsername)}` : ''}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${fmtDT(e.startTs)} → ${e.endTs?fmtDT(e.endTs):'—'} · ${sureTxt}${e.adet?` · Adet: ${esc(e.adet)}`:''}</div>
              ${e.status==='duruş' && e.duruşNedeni ? `<div style="font-size:12px;color:var(--warn);margin-top:4px">Duruş: "${esc(e.duruşNedeni)}"</div>` : ''}
              ${e.sonrakiMakine ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${ico('chevronRight',11)} Sıradaki: ${esc(e.sonrakiMakine)}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </div>`;
}
/* Arama malzeme bekleyenleri de buluyor (05.10.2026, kullanıcı isteği): malzeme bekleyen iş emrinin
   çoğu zaman hiç operasyon kaydı yok, bu yüzden arama "eşleşen kayıt bulunamadı" diyordu. Talep no,
   U kodu ya da mamul kodunda geçen aktif kayıtlar üstte, siparişin rengiyle (istek no yok = kırmızı,
   var = sarı) gösteriliyor. */
function iyMalzemeAramaSonuclari(q){
  const s = String(q||'').trim().toUpperCase(); if(!s) return [];
  return iyMalzemeBekleyenler().filter(x=>[x.talepNo, x.isEmriNo, x.mamulKodu].some(v=>String(v||'').toUpperCase().includes(s)));
}
function iyMalzemeAramaKartHtml(x){
  const istek = String(x.caniasIstekNo||'').trim(), renk = malzemeIstekRenk(x), bek = mbBeklemeMetni(x.isaretTs);
  return `<div class="analiz-chart-box iy-mb-kart ${istek?'var':'yok'}" style="margin-bottom:10px">
    <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:8px">
      <span class="mono" style="font-weight:700;color:var(--accent);font-size:14px">${esc(x.talepNo||x.isEmriNo||'—')}</span>
      <span class="matrix-tag" style="--sb:${renk}">Malzeme bekliyor</span>
      ${x.isEmriNo && x.isEmriNo!==x.talepNo ? `<span style="font-size:11px;color:var(--text-muted)">U kodu: ${esc(x.isEmriNo)}</span>` : ''}
    </div>
    <div style="margin-top:8px;font-size:13.5px;font-weight:600;color:${renk}">${istek ? `Sipariş açıldı · istek no ${esc(istek)}` : 'İstek no girilmedi · CANIAS isteği henüz açılmadı'}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(x.mamulAdi||'')}${x.mamulAdi?' · ':''}Beklenen: <span class="mono">${esc(x.hammaddeKod||'—')} · ${esc(String(x.gerekenMiktar||''))} ${esc(x.birim||'')}</span> · ${bek.metin} bekliyor · işaretleyen ${esc(x.isaretleyenName||x.isaretleyenUsername||'—')}</div>
    ${canManageStock() ? `<button class="btn-ghost" style="width:auto;padding:6px 12px;margin-top:10px" onclick="stokSubView='bekleyen'; setView('stokYonetim')">Malzeme Bekleyenler'de aç</button>` : ''}
  </div>`;
}
function iyAramaHtml(){
  const q = iyAramaMetni.trim();
  const sonuclar = q ? iyAramaSonuclari(q) : [];
  const mbSonuc = q ? iyMalzemeAramaSonuclari(q) : [];
  return `<div style="margin-bottom:16px">
    <input id="iy-arama" type="search" class="filter-input mono" style="width:100%;max-width:420px" placeholder="İş Emri No / Talep No ile ara — nerede olduğunu gör" value="${esc(iyAramaMetni)}" oninput="setIyAramaMetni(this.value)">
    ${q ? `<div style="margin-top:12px">${sonuclar.length===0 && mbSonuc.length===0
      ? `<div class="analiz-chart-box" style="text-align:center;color:var(--text-muted);padding:16px">"${esc(q)}" ile eşleşen kayıt bulunamadı.</div>`
      : mbSonuc.map(iyMalzemeAramaKartHtml).join('') + sonuclar.map(iyAramaSonucKartHtml).join('')}</div>` : ''}
  </div>`;
}
function iyGorunumSecici(){
  const defs = [['liste','Liste'],['ozet','Özet'],['hafta','Hafta'],['pano','Pano']];
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
    ${defs.map(([k,label])=>`<button class="chip ${isYogunluguGorunum===k?'active':''}" onclick="setIsYogunluguGorunum('${k}')">${label}</button>`).join('')}
    ${isYogunluguGorunum==='pano' ? `<a href="?pano=1" target="_blank" rel="noopener" class="chip" style="text-decoration:none">Tam ekran ↗</a>` : ''}
  </div>`;
}
// Press satırının çift eşleştirme detayı — mevcut görünümden birebir taşındı.
function iyPresDetayHtml(r){
  const branchLine = (label, bilgi) => {
    if(!bilgi) return `<span style="color:var(--text-muted)">${label}: — henüz açılmadı</span>`;
    const tik = `onclick="openIyGecmisModal('${escJs(bilgi.last.isEmriNo)}')"`;
    if(bilgi.hazir) return `<span ${tik} style="color:var(--success);cursor:pointer;text-decoration:underline dotted">${label}: ${ico('check',12)} hazır</span>`;
    const durum = (bilgi.last.status==='devam'||bilgi.last.status==='duruş') ? 'işlemde' : 'bitmedi (son operasyon yok)';
    return `<span ${tik} style="color:var(--warn);cursor:pointer;text-decoration:underline dotted">${label}: bekleniyor (${durum})</span>`;
  };
  return r.ciftler.map(c=>`<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="mono" style="color:var(--accent);font-weight:600">${esc(c.talepNo)}</span>
      <span style="font-weight:600;color:${c.ikisiDeHazir?'var(--success)':'var(--warn)'}">${c.ikisiDeHazir ? 'Preste bekliyor' : (!c.zarfHazir ? 'Zarf bekliyor' : 'Elmas bekliyor')}</span>
    </div>
    <div style="display:flex;gap:16px;margin-top:4px;flex-wrap:wrap">
      ${branchLine('Çelik (_Zarf)', c.zarf)}
      ${branchLine('Karbür (_Elmas)', c.elmas)}
    </div>
  </div>`).join('');
}

/* --- GÖRÜNÜM: LİSTE — telefon öncelikli makine kartları ------------- */
function iyListeHtml(v){
  if(v.rows.length===0) return `<div class="analiz-chart-box" style="text-align:center;color:var(--text-muted);padding:28px 16px">Şu an sıradaki operasyonu bekleyen iş emri yok.</div>`;
  return `<div class="iy-list">
    ${v.rows.map(r=>{
      const acik = isYogunluguAcikMakine===r.label;
      const belirsiz = r.label==='Belirsiz';
      const renk = iySatirRenk(r);
      return `<div class="iy-row${acik?' open':''}" style="--nc:${renk}">
        <button class="iy-head" onclick="toggleIsYogunluguDetay('${escJs(r.label)}')">
          <span style="display:flex;align-items:center;justify-content:space-between;gap:10px">
            <span style="display:flex;align-items:baseline;gap:9px;min-width:0;flex-wrap:wrap">
              <span class="mono" style="font-size:13px;font-weight:700;color:${belirsiz||r.isMalzeme?renk:'var(--accent)'};white-space:nowrap">${esc(iyKod(r.label))}</span>
              <span style="font-size:11.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(iyAd(r.label) || (belirsiz?'sıradaki makinesi işaretlenmemiş':r.isMalzeme?'stok yok, iş emri parkta':''))}</span>
              ${r.isMalzeme ? `<span class="matrix-tag" style="--sb:${r.istekYok>0?'var(--danger)':'var(--warn)'}">${r.istekYok>0 ? `${r.istekYok} istek no yok` : 'istek no’lar girildi'}</span>` : ''}
              ${r.isPres ? `<span class="matrix-tag" style="--sb:var(--tadilat-info)">Çift eşleşme</span>` : ''}
            </span>
            <span style="display:flex;align-items:baseline;gap:7px;white-space:nowrap;flex:none">
              <span class="mono" style="font-size:19px;font-weight:700">${r.isEmriSayisi}</span>
              <span class="mono" style="font-size:12px;color:${r.isPres?'var(--success)':'var(--text-muted)'}">${r.isPres ? `/ ${v.hazirCiftSayisi} hazır` : `/ ${r.toplamAdet} adet`}</span>
              <span style="color:var(--text-muted)">${acik?ico('chevronUp',14):ico('chevronDown',14)}</span>
            </span>
          </span>
          <span class="iy-bar"><span style="width:${Math.round(r.isEmriSayisi/v.enYuksek*100)}%${r.isMalzeme?';background:'+renk:''}"></span></span>
        </button>
        ${acik ? `<div class="iy-detay">
          ${r.isPres ? iyPresDetayHtml(r) : r.isMalzeme ? iyMalzemeDetayHtml(r) : r.isEmriler.map(e=>`<div class="iy-detay-row">
            <span><span class="mono" style="color:var(--accent);font-weight:600;cursor:pointer;text-decoration:underline dotted" onclick="openIyGecmisModal('${escJs(e.isEmriNo)}')">${esc(e.talepNo||e.isEmriNo)}</span>${v.malzemeTalepSet.has(String(e.talepNo||'').trim().toUpperCase()) ? ` <span class="iy-mb-etiket" title="Bu iş emri Malzeme Bekleyenler'de">malzeme bekliyor</span>` : ''}</span>
            <span style="color:var(--text-muted)">${esc(e.makine||'—')}</span>
            <span class="mono sag">${esc(e.adet||'—')}</span>
            <span style="color:var(--text-muted)">${esc(e.operatorName||e.operatorUsername||'')}</span>
            <span class="mono sag" style="color:var(--text-muted)">${e.endTs?fmtDT(e.endTs):'—'}</span>
          </div>`).join('')}
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

/* Malzeme Bekliyor satırının açılan detayı — her kayıt kendi renginde (istek no yoksa kırmızı, varsa sarı). */
function iyMalzemeDetayHtml(r){
  return `${r.kayitlar.map(x=>{ const istek = String(x.caniasIstekNo||'').trim(); const bek = mbBeklemeMetni(x.isaretTs);
    return `<div class="iy-detay-row iy-mb-satir ${istek?'var':'yok'}">
      <span><span class="mono" style="font-weight:700">${esc(x.talepNo||x.isEmriNo||'—')}</span>${x.isEmriNo && x.isEmriNo!==x.talepNo ? `<span class="mono" style="display:block;font-size:10.5px;color:var(--text-subtle)">${esc(x.isEmriNo)}</span>` : ''}</span>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(x.mamulAdi||'')}">${esc(x.mamulAdi||'—')}</span>
      <span class="mono">${esc(x.hammaddeKod||'—')} <span style="color:var(--text-muted)">· ${esc(String(x.gerekenMiktar||''))} ${esc(x.birim||'')}</span></span>
      <span class="iy-mb-istek">${istek ? `İstek ${esc(istek)}` : 'İstek no yok'}</span>
      <span class="mono sag" style="color:${bek.renk}">${bek.metin} bekliyor</span>
    </div>`; }).join('')}
  ${canManageStock() ? `<div style="padding-top:10px"><button class="btn-ghost" style="width:auto;padding:7px 12px" onclick="stokSubView='bekleyen'; setView('stokYonetim')">Malzeme Bekleyenler'de aç</button></div>` : ''}`;
}

/* --- GÖRÜNÜM: ÖZET — atölye ustası, az bilgi ----------------------- */
function iyOzetHtml(v){
  const top = v.rows.filter(r=>r.label!=='Belirsiz' && !r.isMalzeme).slice(0,5);
  const enCokAdet = v.rows.filter(r=>!r.isPres && !r.isMalzeme && r.label!=='Belirsiz').slice().sort((a,b)=>b.toplamAdet-a.toplamAdet)[0];
  const bosMakine = (typeof allMachines==='function')
    ? allMachines().filter(m=>!v.rows.some(r=>iyKod(r.label)===m.code)).length
    : null;
  const satir = (deger, renk, bg, baslik, alt) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 0">
    <div class="mono" style="width:46px;height:46px;border-radius:10px;background:${bg};color:${renk};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">${deger}</div>
    <div style="font-size:12.5px;line-height:1.4;color:var(--text-muted)"><div style="color:var(--text);font-weight:600">${baslik}</div>${alt}</div>
  </div>`;
  return `<div class="analiz-chart-box">
    <div style="font-size:14.5px;font-weight:700">Sırada Bekleyen</div>
    <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;margin-bottom:14px">${v.toplamIsEmri} iş emri · ${v.doluMakine} makinede · ${fmtDT(Date.now())}</div>
    <div style="display:flex;align-items:flex-end;gap:10px;height:200px;margin-bottom:6px">
      ${top.map(r=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px">
        <span class="mono" style="font-size:18px;font-weight:700;color:${iyRenk(r.isEmriSayisi)}">${r.isEmriSayisi}</span>
        <div style="width:100%;height:${34 + Math.round(r.isEmriSayisi/v.enYuksek*130)}px;background:${iyRenk(r.isEmriSayisi)};border-radius:6px 6px 0 0"></div>
        <span class="mono" style="font-size:11px;font-weight:600">${esc(iyKod(r.label))}</span>
      </div>`).join('')}
    </div>
    <div style="height:1px;background:var(--border);margin:12px 0"></div>
    ${satir(v.belirsizSayi, 'var(--danger)', 'color-mix(in srgb, var(--danger) 14%, transparent)', 'Belirsiz', 'sıradaki makinesi girilmemiş iş emri')}
    ${v.malzemeSayi>0 ? (()=>{ const c = v.malzemeIstekYok>0 ? 'var(--danger)' : 'var(--warn)';
      return satir(v.malzemeSayi, c, `color-mix(in srgb, ${c} 16%, transparent)`, 'Malzeme bekliyor', v.malzemeIstekYok>0 ? `${v.malzemeIstekYok} tanesinde istek no girilmedi` : 'hepsinin istek no’su girildi, malzeme yolda'); })() : ''}
    ${enCokAdet ? satir(enCokAdet.toplamAdet, 'var(--accent)', 'var(--accent-dim)', esc(enCokAdet.label), 'en çok adet bekleyen makine') : ''}
    ${bosMakine!=null ? satir(bosMakine, 'var(--text-muted)', 'var(--panel-alt)', 'Boşta makine', 'hiç bekleyen işi yok') : ''}
  </div>`;
}

/* --- GÖRÜNÜM: HAFTA — makine × gün ısı haritası --------------------
   NOT: veride plan/termin tarihi yok. Bu yüzden gün ekseni "iş emrinin kuyruğa
   girdiği gün" = önceki operasyonun bitiş zamanı (e.endTs). Press çiftleri
   tarih taşımadığı için bu görünümün dışında. Hafta Pzt-Cmt (6 gün) — Pazar
   atölyede çalışma günü olmadığı varsayımıyla; gerekirse 7'ye çıkarılabilir. */
function iyHaftaHtml(v){
  const gunAdlari = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const pzt = new Date(bugun); pzt.setDate(pzt.getDate() - ((bugun.getDay()+6)%7));
  const gunler = Array.from({length:6}, (_,i)=>{ const d = new Date(pzt); d.setDate(d.getDate()+i); return d; });
  const sinir = gunler.map(d=>d.getTime());

  const satirlar = v.rows.filter(r=>!r.isPres && !r.isMalzeme).map(r=>{
    const cells = sinir.map(gs=>r.isEmriler.filter(e=>e.endTs>=gs && e.endTs<gs+86400000).length);
    return { label:r.label, cells, toplam:r.isEmriSayisi };
  });
  const hucreBg = n => n>=6 ? 'var(--danger)' : n>=4 ? 'var(--accent)' : n>=2 ? 'var(--accent-dim)' : n>=1 ? 'var(--panel-alt)' : 'var(--panel)';
  const hucreFg = n => n>=4 ? 'var(--on-warn)' : n>=1 ? 'var(--text)' : 'var(--border)';

  return `<div class="analiz-chart-box">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px">
      <div>
        <div style="font-size:14.5px;font-weight:700">Hafta × Makine</div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">Bekleyen iş emrinin kuyruğa girdiği gün (önceki operasyonun bitişi) · ${gunler[0].toLocaleDateString('tr-TR',{day:'2-digit',month:'long'})} – ${gunler[5].toLocaleDateString('tr-TR',{day:'2-digit',month:'long'})}</div>
      </div>
    </div>
    <div style="overflow-x:auto">
      <div style="min-width:520px;display:grid;grid-template-columns:225px repeat(6,1fr) 70px;gap:5px;align-items:center">
        <div></div>
        ${gunAdlari.slice(0,6).map((g,i)=>`<div class="mono" style="text-align:center;font-size:10px;font-weight:600;letter-spacing:.5px;color:var(--text-muted)">${g}<br>${gunler[i].getDate()}</div>`).join('')}
        <div class="mono" style="text-align:right;font-size:10px;font-weight:600;letter-spacing:.5px;color:var(--text-muted)">TOPLAM</div>
        ${satirlar.map(r=>`
          <div style="display:flex;align-items:baseline;gap:8px;min-width:0">
            <span class="mono" style="flex:0 0 auto;font-size:12px;font-weight:600;color:${r.label==='Belirsiz'?'var(--danger)':'var(--accent)'};white-space:nowrap">${esc(iyKod(r.label))}</span>
            <span style="flex:1;min-width:0;font-size:11.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(iyAd(r.label))}</span>
          </div>
          ${r.cells.map(n=>`<div class="mono" style="height:30px;border-radius:5px;background:${hucreBg(n)};color:${hucreFg(n)};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">${n||'·'}</div>`).join('')}
          <div class="mono" style="text-align:right;font-size:13px;font-weight:700">${r.toplam}</div>
        `).join('')}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px">
      <span class="mono" style="font-size:10.5px;color:var(--text-muted)">BOŞ</span>
      ${['var(--panel)','var(--panel-alt)','var(--accent-dim)','var(--accent)','var(--danger)'].map(c=>`<div style="width:44px;height:9px;border-radius:2px;background:${c};border:1px solid var(--border)"></div>`).join('')}
      <span class="mono" style="font-size:10.5px;color:var(--text-muted)">6+ İŞ EMRİ</span>
    </div>
  </div>`;
}

/* --- GÖRÜNÜM: PANO — atölye TV'si ---------------------------------
   Hem sekme içinde hem ?pano=1 ile tam ekran aynı fonksiyonu kullanıyor. */
function iyPanoHtml(v, tamEkran){
  const rows = v.rows;
  const yari = Math.ceil(rows.length/2);
  // Pano 4-6 metreden okunuyor; sekme içindeki önizleme ise masaüstü mesafesinden.
  // Aynı fonksiyon iki ölçek taşıyor — önizleme ölçüleri bilinçli olarak eski değerler,
  // yani sekme görünümü bu turda değişmiyor, sadece ?pano=1 büyüyor.
  const S = tamEkran
    ? { kod:34, ad:22, sayi:44, bolu:22, bar:22, kpi:48, kpiEt:15, baslik:44, alt:16, kol:'minmax(0,330px) 1fr 150px', pad:'14px 0', dis:'30px 44px 34px', bas:'30px 44px 24px' }
    : { kod:17, ad:14, sayi:22, bolu:14, bar:16, kpi:30, kpiEt:13, baslik:26, alt:13, kol:'minmax(0,230px) 1fr 88px', pad:'9px 0',  dis:'22px 30px 26px', bas:'24px 30px 20px' };
  const kolon = (liste) => liste.map(r=>`
    <div style="display:grid;grid-template-columns:${S.kol};align-items:center;gap:16px;padding:${S.pad};border-top:1px solid var(--panel-alt)">
      <div style="display:flex;align-items:baseline;gap:9px;min-width:0">
        <span class="mono" style="flex:0 0 auto;font-size:${S.kod}px;font-weight:700;color:${r.label==='Belirsiz'||r.isMalzeme?iySatirRenk(r):'var(--accent)'};white-space:nowrap">${esc(iyKod(r.label))}</span>
        <span style="flex:1;min-width:0;font-size:${S.ad}px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.isMalzeme ? (r.istekYok>0 ? `${r.istekYok} istek no yok` : 'istek no girildi') : iyAd(r.label))}</span>
      </div>
      <div style="height:${S.bar}px;border-radius:4px;background:var(--panel);overflow:hidden"><div style="height:100%;width:${Math.round(r.isEmriSayisi/v.enYuksek*100)}%;background:${iySatirRenk(r)};border-radius:4px"></div></div>
      <div style="display:flex;align-items:baseline;justify-content:flex-end;gap:6px;white-space:nowrap">
        <span class="mono" style="font-size:${S.sayi}px;font-weight:700">${r.isEmriSayisi}</span>
        <span class="mono" style="font-size:${S.bolu}px;color:var(--text-muted)">/${r.isPres ? v.hazirCiftSayisi : r.toplamAdet}</span>
      </div>
    </div>`).join('');
  const kpiMini = (label, value, color) => `<div style="text-align:right"><div style="font-size:${S.kpiEt}px;font-weight:600;letter-spacing:.6px;color:var(--text-muted)">${label}</div><div class="mono" style="font-size:${S.kpi}px;font-weight:700;color:${color}">${value}</div></div>`;

  return `<div style="background:var(--bg);${tamEkran?'min-height:100vh;':'border:1px solid var(--border);border-radius:12px;'}overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:${S.bas};border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:baseline;gap:18px">
        <span class="pano-title" style="font-size:${S.baslik}px">İŞ YOĞUNLUĞU</span>
        <span style="font-size:${S.alt}px;color:var(--text-muted)">sıradaki makineye göre bekleyen iş emri</span>
      </div>
      <div style="display:flex;align-items:center;gap:28px;flex-wrap:wrap">
        ${kpiMini('BEKLEYEN İŞ EMRİ', v.toplamIsEmri, 'var(--accent)')}
        ${kpiMini('TOPLAM ADET', v.toplamAdet, 'var(--success)')}
        ${kpiMini('BELİRSİZ', v.belirsizSayi, 'var(--danger)')}
        <span class="mono" style="font-size:${S.kpi-4}px;font-weight:700">${fmtDT(Date.now()).split(' ').pop()}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(430px,100%),1fr));gap:0 40px;padding:${S.dis}">
      <div>${kolon(rows.slice(0,yari))}</div>
      <div>${kolon(rows.slice(yari))}</div>
    </div>
    ${v.belirsizSayi>0 ? `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 30px;background:var(--panel);border-top:1px solid var(--border)">
      <span class="mono" style="padding:6px 12px;border-radius:6px;background:var(--danger);color:var(--on-warn);font-size:${S.alt}px;font-weight:700;letter-spacing:.5px;white-space:nowrap">BELİRSİZ ${v.belirsizSayi}</span>
      <span style="font-size:${S.alt+1}px;color:var(--text-muted)">sıradaki makinesi işaretlenmemiş — operatörler "Bitir" ekranında sonraki makineyi seçmiyor</span>
    </div>` : ''}
  </div>`;
}

/* --- SEKME GÖVDESİ ------------------------------------------------------- */
function renderIsYogunlugu(){
  const v = iyVeri();
  const govde = isYogunluguGorunum==='ozet'  ? iyOzetHtml(v)
              : isYogunluguGorunum==='hafta' ? iyHaftaHtml(v)
              : isYogunluguGorunum==='pano'  ? iyPanoHtml(v, false)
              : iyListeHtml(v);
  return `<div class="matrix-wrap">
    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px">Operatör bir operasyonu bitirirken işaretlediği sıradaki makineye göre — o konumda bekleyen iş emirleri. Press satırı özel: _Zarf/_Elmas çiftlerini talep no'ya göre eşleştirir, ikisi de bitmeden "preste bekliyor" saymaz. Biri o iş için gerçekten yeni bir kayıt açıp Başla'ya bastığında kuyruktan kendiliğinden düşer.</div>
    ${iyAramaHtml()}
    ${iyGorunumSecici()}
    ${iyKpiHtml(v)}
    ${govde}
  </div>${iyGecmisModalIsEmriNo ? renderIyGecmisModal() : ''}`;
}
/* Sidebar'ın "Yönetim" grubundaki Excel Yükleme (A.11, 22.09.2026) ve Operatörler (A.12,
   28.09.2026) artık KENDİ ekranlarına gidiyor; ikisi de eskiden var olan işlevlere
   (Stok → Hammadde → Excel, Ayarlar → Personel Ayarları) yönlendiriyordu. */
/* Eskiden Stok Takibi → Hammadde → Excel'e atıyordu; artık tüm yükleme akışlarını toplayan
   kendi ekranını açıyor (22.09.2026). */
function gotoExcelYukleme(){ setView('excelYukleme'); }
function gotoOperatorler(){ setView('operatorler'); }
/* Ayarlar'a nav'dan girilince her zaman menuden baslanir; alt ekranda kalip donmek
   "neden burasi acildi" sorusunu dogururdu. */
function gotoAyarlar(){ settingsSubTab='menu'; setView('adminSettings'); }
/* Makine Matrisi — 2026-09-16: kullanıcının verdiği koyu Material-3 referansına göre yeniden
   tasarlandı (kart üstü renk çubuğu, durum rozeti, ayrı "Detay" butonu, alt özet/senkron
   şeridi). Tüm veri/filtre mantığı ESKİSİYLE AYNI (workMsFor/statusPriority/sortedMachines,
   matrixSort/matrixGroupFilter/matrixAtolyeFilter + setter'ları, tadilatAktifOnMachine,
   live()/fmtElapsed) — sadece çıktı markup'ı değişti. Eskiden inline view dispatch'i içindeydi,
   diğer render* fonksiyonları (renderStokScreen, renderIsYogunlugu) gibi ayrı bir fonksiyona
   çıkarıldı. Referanstaki sabit 26 makine/İş Emri/operatör verisi KULLANILMADI — hepsi gerçek
   allMachines()/entriesArray()/buildTadilatSynthetic() üzerinden hesaplanıyor. Referans Tailwind+
   Material Symbols font kullanıyordu; bu uygulamada build adımı/Tailwind yok, mevcut ico()/ICONS
   SVG ikon sistemi ve düz CSS class'ları (.matrix-*) ile birebir görsel karşılığı üretildi. */
function renderMakineMatrisi(){
  // Tadilat Atölye makineleri "entries" tablosunda hiç iz bırakmaz (orada sadece üretim işleri
  // var) — tadilat operasyonlarını da senkron kayıt gibi katmazsak bu makineler burada hep
  // "hiç kullanılmadı"/boşta görünür, geçmiş tadilat işleri hiç okunmaz.
  const entries = [...entriesArray(), ...buildTadilatSynthetic()];
  const workMsFor = (code) => {
    const label = resolveMachineLabel(code);
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
  const tumMakineler = allMachines();
  const aramaN = trNorm(matrixArama.trim());
  const sortedMachines = tumMakineler.slice()
    .filter(m => matrixGroupFilter==='Tümü' || machineGroupOf(m.code)===matrixGroupFilter)
    .filter(m => matrixAtolyeFilter==='tumu' || machineAtolyeOf(m.code)===matrixAtolyeFilter)
    .filter(m => !aramaN || trNorm(m.code+' '+m.name).includes(aramaN))
    .sort((a,b)=>{
    if(matrixSort==='calisma') return workMsFor(b.code) - workMsFor(a.code);
    if(matrixSort==='renk') return statusPriority(a.code) - statusPriority(b.code) || a.code.localeCompare(b.code);
    return a.code.localeCompare(b.code);
  });
  const groupNames = ['Tümü', ...MACHINE_GROUPS.map(g=>g.name), 'Diğer'];

  // Referanstaki sabit 12/11/0/3 sayaçları yerine gerçek durum dağılımı (tüm makineler, filtreden
  // bağımsız — özet şeridi ekranda ne süzülmüş olursa olsun bütünü göstermeli).
  let calisanSay=0, durusSay=0, tadilatSay=0;
  tumMakineler.forEach(m=>{
    const label = resolveMachineLabel(m.code);
    if(tadilatAktifOnMachine(label)){ tadilatSay++; return; }
    const me = entries.filter(e=>e.makine===label);
    if(me.some(e=>e.status==='devam')) calisanSay++;
    else if(me.some(e=>e.status==='duruş')) durusSay++;
  });
  const bosSay = Math.max(0, tumMakineler.length - calisanSay - durusSay - tadilatSay);
  const imalatSay = tumMakineler.filter(m=>machineAtolyeOf(m.code)==='imalat').length;
  const tadilatAtolyeSay = tumMakineler.filter(m=>machineAtolyeOf(m.code)==='tadilat').length;

  let out = `<div class="matrix-wrap">
    <div class="matrix-toolbar">
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button class="chip ${matrixAtolyeFilter==='tumu'?'active':''}" style="font-size:13.5px;padding:9px 16px" onclick="setMatrixAtolyeFilter('tumu')">${ico('list',13)} Tüm Makineler <b style="margin-left:4px;opacity:.8">${tumMakineler.length}</b></button>
        <button class="chip ${matrixAtolyeFilter==='imalat'?'active':''}" style="font-size:13.5px;padding:9px 16px" onclick="setMatrixAtolyeFilter('imalat')">${ico('factory',13)} İmalat Atölye <b style="margin-left:4px;opacity:.8">${imalatSay}</b></button>
        <button class="chip ${matrixAtolyeFilter==='tadilat'?'active':''}" style="font-size:13.5px;padding:9px 16px" onclick="setMatrixAtolyeFilter('tadilat')">${ico('wrench',13)} Tadilat Atölye <b style="margin-left:4px;opacity:.8">${tadilatAtolyeSay}</b></button>
      </div>
      <label class="stok-top-search" style="max-width:280px">
        ${ico('search',14)}
        <input placeholder="Kod veya ad ile süz…" value="${esc(matrixArama)}" oninput="setMatrixArama(this.value)">
      </label>
    </div>
    <div class="matrix-toolbar" style="margin-bottom:14px">
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${groupNames.map(g=>`<button class="chip ${matrixGroupFilter===g?'active':''}" onclick="setMatrixGroupFilter('${g}')">${g}</button>`).join('')}
      </div>
      <div style="display:flex;gap:6px">
        <button class="chip ${matrixSort==='alpha'?'active':''}" onclick="setMatrixSort('alpha')">Alfabetik</button>
        <button class="chip ${matrixSort==='calisma'?'active':''}" onclick="setMatrixSort('calisma')">Çalışma Süresine Göre</button>
        <button class="chip ${matrixSort==='renk'?'active':''}" onclick="setMatrixSort('renk')">Renge Göre</button>
      </div>
    </div>
    <div class="matrix-legend">
      <span><span class="legend-dot" style="background:var(--success)"></span>Çalışıyor <b>${calisanSay}</b></span>
      <span><span class="legend-dot" style="background:var(--warn)"></span>Duruşta <b>${durusSay}</b></span>
      <span><span class="legend-dot" style="background:var(--danger)"></span>Boşta <b>${bosSay}</b></span>
      <span><span class="legend-dot" style="background:var(--tadilat-info)"></span>Tadilat Yapıyor <b>${tadilatSay}</b></span>
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
    const border = tadilatHere ? 'var(--tadilat-info)' : running?'var(--success)':stopped?'var(--warn)':'var(--danger)';
    const bg = tadilatHere ? 'var(--tadilat-soft)' : running?'var(--success-bg)':stopped?'var(--warn-bg)':'var(--danger-bg)';
    const lastFinished = (!running&&!stopped&&!tadilatHere) ? machineEntries.slice().sort((a,b)=>b.startTs-a.startTs)[0] : null;
    const durusAlert = uzunDurusUyariEnabled() && stopped && stoppedEntries.some(e=>e.duruşTs && !isVerimlilikDisiDurus(e.duruşNedeni) && (nowTick-e.duruşTs)>=uzunDurusEsikMs());
    /* Kartin sag ustundeki renkli nokta TEK BASINA durumu anlatiyordu; renk korlugunde ve
       gun sonu mavisi ile yonetici aksani (teal) yan yana geldiginde ayirt edilemiyordu.
       Nokta yerine ayni rengi tasiyan kisa bir metin etiketi (.matrix-tag) basiyoruz. */
    /* 22.09.2026 — tek "Planlı" etiketi Gün Sonu ile Planlı Mola'yı aynı kefeye koyuyordu; ikisi
       operasyonel olarak farklı şey (biri vardiya bitişi, diğeri öğle/vardiya arası). Ayırım veride
       zaten duruyordu — isVerimlilikDisiDurus bir alan değil, e.duruşNedeni'nin üzerinde çalışan bir
       yüklem ve iki neden ayrı sabitler — yani yeni alan gerekmedi, sadece etiket dallandı.
       Karışık durumda (biri gün sonu, diğeri mola) eski 'Planlı' etiketi korunuyor. */
    const durumEtiket = tadilatHere ? 'Tadilat'
      : running ? 'Çalışıyor'
      : stopped ? (durusAlert ? 'Uzun duruş'
                 : stoppedEntries.every(e=>e.duruşNedeni===GUN_SONU_REASON) ? 'Gün sonu'
                 : stoppedEntries.every(e=>e.duruşNedeni===PLANLI_MOLA_REASON) ? 'Planlı mola'
                 : stoppedEntries.every(e=>isVerimlilikDisiDurus(e.duruşNedeni)) ? 'Planlı' : 'Duruş')
      : 'Boşta';
    const etiketRengi = durusAlert ? 'var(--danger)' : border;

    out += `<div class="matrix-card${durusAlert?' durus-alert':''}" style="background:${bg};border-color:${durusAlert?'var(--danger)':border}" onclick="openMachineDetail('${escJs(m.code)}')">
      ${durusAlert ? `<span class="durus-alert-badge" title="Uzun süredir duruşta">${ico('alert',14)}</span>` : ''}
      <div class="matrix-card-top"><span class="matrix-code">${m.code}</span><span class="matrix-tag" style="--sb:${etiketRengi}">${durumEtiket}</span></div>
      <div class="matrix-name">${esc(m.name)}</div>`;
    if(tadilatHere){
      const { tadilat: tt, operasyon: top } = tadilatHere;
      out += `<div class="matrix-sub" style="color:var(--tadilat-info);font-weight:700">${ico('wrench',14)} ${esc(tt.uKodu)}</div>
        <div class="matrix-sub">${esc(operatorGosterimAdi(top))} · ${live(()=> fmtElapsed(tadilatOpDurationBreakdown(top).netMs))}</div>`;
    } else if(running){
      if(runningEntries.length===1){
        const info = runningEntries[0];
        out += `<div class="matrix-sub">${esc(info.talepNo || info.isEmriNo)} · ${esc(operatorGosterimAdi(info))}</div>
          <div class="matrix-sub">${live(()=> fmtElapsed(entryDurationBreakdown(info).netMs))} çalışıyor</div>`;
      } else {
        out += `<div class="matrix-sub" style="font-weight:700">${runningEntries.length} İş Emri Aktif</div>
          <div class="matrix-sub" style="opacity:.7">Detay için tıkla</div>`;
      }
    } else if(stopped){
      if(stoppedEntries.length===1){
        const info = stoppedEntries[0];
        out += `<div class="matrix-sub">${esc(info.talepNo || info.isEmriNo)} · ${esc(operatorGosterimAdi(info))}</div>
          <div class="matrix-sub">Duruş: "${esc(info.duruşNedeni)}"</div>`;
      } else {
        out += `<div class="matrix-sub" style="font-weight:700">${stoppedEntries.length} İş Duraklatıldı</div>
          <div class="matrix-sub" style="opacity:.7">Detay için tıkla</div>`;
      }
    } else if(lastFinished){
      out += `<div class="matrix-sub">Son: ${esc(operatorGosterimAdi(lastFinished))} · ${fmtDT(lastFinished.startTs)}</div>
        ${lastFinished._isTadilat && lastFinished.aciklama ? `<div class="matrix-sub" style="opacity:.8">${esc(lastFinished.aciklama)}</div>` : ''}`;
    } else {
      out += `<div class="matrix-sub">Hiç kullanılmadı</div>`;
    }
    out += `</div>`;
  });

  out += `</div>
    <div class="matrix-footer">
      <div class="matrix-footer-stats">
        <span>${ico('factory',14)} Toplam Makine: <b>${tumMakineler.length}</b></span>
        <span><span class="mf-dot" style="background:var(--success)"></span>${calisanSay} Çalışıyor</span>
        <span><span class="mf-dot" style="background:var(--warn)"></span>${durusSay} Duruşta</span>
        <span><span class="mf-dot" style="background:var(--tadilat-info)"></span>${tadilatSay} Tadilatta</span>
      </div>
      <div class="matrix-footer-sync">
        ${ico('repeat',14)} Son güncelleme: <b>${fmtDT(nowTick)}</b>
        <button class="chip" onclick="render()">${ico('repeat',13)} Yenile</button>
      </div>
    </div>
  </div>`;
  return out;
}
/* ===================== CANLI PANEL — SEKME KABUĞU (A.9, 22.09.2026) =====================
   Makine Matrisi ve Tamamlanan Kodlar artık ayrı nav öğesi değil; yeni Genel Bakış ile birlikte
   tek bir "Canlı Panel" ekranının üç sekmesi. Rapor BİRLEŞMEDİ — kendi nav öğesi olarak duruyor,
   reportVisibleIds/reportSelectedIds da onunla birlikte kaldı.

   İZİN SEMANTİĞİ — bu adımın en pahalı hata ihtimali olduğu için açıkça yazıyorum: üç sekmenin
   üç AYRI anahtarı var ('genelBakis', 'matrix', 'completed') ve BİRLEŞTİRİLMİYOR. Nav öğesi
   üçünden en az biri görünürse çiziliyor, sekme şeridi yalnızca görünür olanları basıyor. Yani
   "LV sadece Tamamlanan Kodlar'ı görsün" ayarı bozulmadan çalışmaya devam ediyor: LV Canlı
   Panel'e girer ve tek sekme görür. ADMIN_TAB_DEFS'in fallback mantığının bir kademe aşağı
   uygulanması bu; analizViews/takimStokViews ile aynı desen, yeni desen icat edilmedi. */
const CANLI_PANEL_TABS = [
  { view:'genelBakis', key:'genelBakis', label:'Genel Bakış' },
  { view:'matrix',     key:'matrix',     label:'Makine Matrisi' },
  { view:'completed',  key:'completed',  label:'Tamamlanan Kodlar' },
];
function isCanliPanelView(v){ return CANLI_PANEL_TABS.some(t=>t.view===v); }
function canliPanelVisible(){ return CANLI_PANEL_TABS.some(t=>isAdminTabVisible(t.key)); }
/* Nav öğesine tıklandığında ve şef yönlendirmesinde ilk GÖRÜNÜR sekmeye düşülüyor — kullanıcıyı
   izni olmayan bir sekmeye atıp oradan geri sektirmemek için. */
function canliPanelDefaultView(){
  const t = CANLI_PANEL_TABS.find(x=>isAdminTabVisible(x.key));
  return t ? t.view : 'report';
}
function canliPanelTabsHtml(){
  const gorunur = CANLI_PANEL_TABS.filter(t=>isAdminTabVisible(t.key));
  // Tek sekme kalmışsa şerit bilgi taşımıyor, sadece yer kaplıyor — Tamamlanan ekranındaki
  // birleşme sekmelerinin `birlesmeGroups.length>0` koşuluyla aynı mantık.
  if(gorunur.length < 2) return '';
  return `<div class="sub-tabs">${gorunur.map(t=>`<button class="sub-tab-btn ${view===t.view?'active':''}" onclick="setView('${t.view}')">${esc(t.label)}</button>`).join('')}</div>`;
}

/* ===================== GİRİŞ İPUCU =====================
   Makine Matrisi / Tamamlanan Kodlar'ı eski yerinde arayan kullanıcı için TEK SEFERLİK bir
   ipucu — kalıcı şerit DEĞİL, 3 görüşte kendiliğinden kayboluyor. Sayaç localStorage'da:
   cihaz bazlı, kişisel ve geçici bir tercih, Firebase'e yazmanın anlamı yok. Anahtar öneki
   rt_ — mevcut rt_bubble_pos ile aynı konvansiyon.
   ADLANDIRMA: "baloncuk" DEĞİL, "giriş ipucu" / .intro-hint. O ad bu kod tabanında
   ui/bubble.js'teki sürüklenebilir aktif iş baloncuğuna (#bubble-root, .active-bubble) ait;
   ikisini aynı adla anmak sonradan yanlış dosyada arattırır. */
const INTRO_HINT_KEY = 'rt_canli_panel_hint';
const INTRO_HINT_LIMIT = 3;
/* Karar oturum başına BİR kez veriliyor ve sabitleniyor: sayaç her render'da artsaydı ipucu
   ekranda dururken bir sonraki tik'te aniden kaybolurdu. */
let _introHintShow = null;
function introHintCount(){
  try { return parseInt(localStorage.getItem(INTRO_HINT_KEY), 10) || 0; }
  catch(_){ return INTRO_HINT_LIMIT; } // localStorage kapalıysa ipucu hiç gösterilmiyor
}
function dismissIntroHint(){
  _introHintShow = false;
  try { localStorage.setItem(INTRO_HINT_KEY, String(INTRO_HINT_LIMIT)); } catch(_){}
  render();
}
function introHintHtml(){
  if(_introHintShow === null){
    _introHintShow = introHintCount() < INTRO_HINT_LIMIT;
    if(_introHintShow){
      try { localStorage.setItem(INTRO_HINT_KEY, String(introHintCount() + 1)); } catch(_){}
    }
  }
  if(!_introHintShow) return '';
  return `<div class="intro-hint">
    <span class="intro-hint-ico">${ico('clock',16)}</span>
    <div class="intro-hint-body">
      <div class="intro-hint-title">Makine Matrisi ve Tamamlanan Kodlar buraya taşındı</div>
      <div class="intro-hint-sub">Üç ekran tek <b>Canlı Panel</b> oldu; üstteki sekmelerden ulaşırsın. <b>Rapor</b> değişmedi, menüde kendi yerinde duruyor.</div>
    </div>
    <button class="btn-primary intro-hint-btn" onclick="dismissIntroHint()">Anladım</button>
  </div>`;
}

/* ===================== CANLI PANEL — GENEL BAKIŞ =====================
   Canlı Panel'in ilk sekmesi. İzleme ekranı olduğu için tek prensip: bilgi TIKLANINCA değil
   BAKINCA görünür — Uzun Duruşlar, Kapatılmamış Olabilir ve Son Tamamlananlar rozet ya da
   uyarı ikonu değil, üçü de kalıcı panel.

   Tüm veri MEVCUT fonksiyonlardan geliyor, yeni alan/hesap yok: allMachines + entriesArray +
   buildTadilatSynthetic (Makine Matrisi'nin aynısı), uzunDurusluKayitlar, uzunDevamEdenKayitlar,
   computeCompletedRoutes, computeAnalizData.

   Tahtada (Admin-CanliPanel) olup burada BİLEREK OLMAYANLAR — gerekçeleri
   notes/TASARIM_KUYRUGU.md §1'de:
   · "+2,1 puan" ve "dün aynı saatte 24" — önceki dönemle kıyas. Geçmiş veriden hesaplanabilir
     ama yeni hesap = kapsam genişlemesi; ayrıca aynı ifade Admin-Rapor'u geçersiz saymanın
     gerekçesiydi, başka ekranda sessizce kabul etmek o kararla çelişirdi.
   · "Uzun boşta" dikkat kategorisi — kodda boşta süresi için eşik kavramı yok; eklemek yeni bir
     ayar alanı demek (Ayarlar adımı bloke).
   Verimlilik alt metni tahtadaki "net çalışma / (çalışma + duruş)" DEĞİL: gerçek formül
   computeAnalizData'daki Çalışma / Kullanılabilirlik (workMin/availMin, bkz. Analiz ekranı). */
function renderGenelBakis(){
  const entries = [...entriesArray(), ...buildTadilatSynthetic()];
  const tumMakineler = allMachines();
  /* Durum sayımı Makine Matrisi ile BİREBİR aynı sırayla yapılıyor (tadilat → devam → duruş →
     boşta). İkisi aynı ekranın iki sekmesi; sayıların birbirini tutmaması en hızlı fark edilen
     ve en çok güven kaybettiren hata olurdu. */
  let calisanSay = 0, tadilatSay = 0;
  const durustakiler = [];
  tumMakineler.forEach(m=>{
    const label = resolveMachineLabel(m.code);
    if(tadilatAktifOnMachine(label)){ tadilatSay++; return; }
    const me = entries.filter(e=>e.makine===label);
    if(me.some(e=>e.status==='devam')){ calisanSay++; return; }
    const durusta = me.filter(e=>e.status==='duruş');
    if(durusta.length > 0) durustakiler.push({ m, durusta });
  });
  const durusSay = durustakiler.length;
  const bosSay = Math.max(0, tumMakineler.length - calisanSay - durusSay - tadilatSay);

  /* Uyarı listeleri topbar'daki İKİ KOŞULUN AYNISIYLA alınıyor (modül açık mı + kullanıcının o
     uyarıyı görme izni var mı). Aynı veriyi ikinci bir yerde daha gevşek koşulla göstermek,
     uyarısı kapatılmış bir kullanıcının onu burada görmesi demek olurdu. */
  const uzunDurusList = (uzunDurusUyariEnabled() && isAdminTabVisible('uzunDurusUyari')) ? uzunDurusluKayitlar() : [];
  const uzunDevamEdenList = (uzunDevamEdenUyariEnabled() && isAdminTabVisible('uzunDevamEdenUyari')) ? uzunDevamEdenKayitlar() : [];
  const esikDk = Math.round(uzunDurusEsikMs()/60000);
  const esikSaat = Math.round(uzunDevamEdenEsikMs()/3600000);

  const bugun = dateKey(Date.now());
  const gunBasiMs = new Date(bugun+'T00:00:00').getTime();
  const tamamlananlar = computeCompletedRoutes().slice().sort((a,b)=>b.finishedAt-a.finishedAt);
  const bugunTamamlanan = tamamlananlar.filter(r=>r.finishedAt >= gunBasiMs);
  /* Adet ROTA başına anlamlı, kayıt başına değil: aynı iş emrinin her operasyonu aynı adedi
     taşıyor, operasyonlar boyunca toplamak adedi operasyon sayısı kadar katlardı. */
  const bugunAdet = bugunTamamlanan.reduce((s,r)=>{
    const e = r.entries.find(x=>Number(x.adet) > 0);
    return s + (e ? Number(e.adet) : 0);
  }, 0);
  /* DİKKAT İSTEYENLER listesi KPI'lardan ÖNCE hesaplanıyor: "Duruşta" KPI'ı MAKİNE sayıyor, alt
     satırı da aynı birimde olmalı. (22.09.2026 düzeltmesi: alt satır önce uzunDurusluKayitlar()'ın
     uzunluğunu basıyordu — o KAYIT sayıyor. Tek makinede eşiği aşmış iki kayıt varsa ekranda
     "Duruşta 1" başlığının altında "2 tanesi eşiği aştı" yazıyordu.) */
  const GB_KART_LIMIT = 8;
  const dikkat = durustakiler.map(({m, durusta})=>{
    // En uzun süredir duraklamış kayıt kartın yüzü oluyor — görülmesi gereken en eski sorun.
    const info = durusta.slice().sort((a,b)=>(a.duruşTs||Infinity)-(b.duruşTs||Infinity))[0];
    const alert = uzunDurusUyariEnabled() && durusta.some(e=>e.duruşTs && !isVerimlilikDisiDurus(e.duruşNedeni) && (nowTick-e.duruşTs)>=uzunDurusEsikMs());
    return { m, info, alert, sayi: durusta.length, bas: (info && info.duruşTs) ? info.duruşTs : null };
  }).sort((a,b)=> (b.alert - a.alert) || ((a.bas||Infinity) - (b.bas||Infinity)));
  // Uyarıyı görme izni olmayana eşik bilgisi hiç verilmiyor — "0" yazmak "yok" demek olurdu.
  const uzunDurusGorunur = uzunDurusUyariEnabled() && isAdminTabVisible('uzunDurusUyari');
  const uzunDurusMakineSay = uzunDurusGorunur ? dikkat.filter(d=>d.alert).length : 0;

  const todayTotals = computeAnalizData(bugun, bugun, 'tumu').totals;
  const verimRenk = todayTotals.verimlilik>=70 ? 'var(--success)' : todayTotals.verimlilik>=40 ? 'var(--warn)' : 'var(--danger)';

  // İş Yoğunluğu'ndaki KPI deseninin aynısı (.iy-kpi + --nc) — yeni kart tipi icat edilmedi.
  const kpi = (label, value, color, sub, vurgu) => `<div class="analiz-chart-box iy-kpi${vurgu?' iy-kpi-vurgu':''}" style="--nc:${color}">
    <div class="iy-kpi-label">${label}</div>
    <div class="mono iy-kpi-value">${value}</div>
    ${sub?`<div class="iy-kpi-sub">${sub}</div>`:''}
  </div>`;

  let out = `<div class="matrix-wrap">
    <div class="iy-kpi-grid">
      ${kpi('Çalışıyor', `${calisanSay}<span style="font-size:15px;color:var(--text-muted);font-weight:600"> / ${tumMakineler.length}</span>`, 'var(--success)', `${durusSay} duruşta · ${tadilatSay} tadilatta · ${bosSay} boşta`)}
      ${kpi('Duruşta', durusSay, 'var(--warn)', !uzunDurusGorunur ? 'duruştaki makine' : uzunDurusMakineSay>0 ? `${uzunDurusMakineSay} makine ${esikDk} dk eşiğini aştı` : `${esikDk} dk eşiğini aşan yok`, uzunDurusMakineSay>0)}
      ${kpi('Bugün Tamamlanan', bugunTamamlanan.length, 'var(--accent)', bugunAdet>0 ? `${bugunAdet} adet · tamamlanan rota` : 'tamamlanan rota')}
      ${kpi('Vardiya Verimliliği', `%${todayTotals.verimlilik}`, verimRenk, `Çalışma / Kullanılabilirlik · ${fmtDur(todayTotals.workMin*60000)} / ${fmtDur(todayTotals.availMin*60000)}`)}
    </div>
    <div class="gb-grid">`;

  /* DİKKAT İSTEYENLER — duruştaki makineler, uzun duruş önce. Kartlar Makine Matrisi'nin
     .matrix-card deseninin aynısı: aynı şeyi iki farklı görsel dille anlatmamak için. */
  out += `<div class="analiz-chart-box">
      <div class="gb-panel-head">
        <span class="gb-panel-title">Dikkat İsteyenler <b class="mono">${dikkat.length}</b></span>
        <span class="matrix-legend" style="margin:0">
          <span><span class="legend-dot" style="background:var(--danger)"></span>Uzun duruş <b>${dikkat.filter(d=>d.alert).length}</b></span>
          <span><span class="legend-dot" style="background:var(--warn)"></span>Duruş <b>${dikkat.filter(d=>!d.alert).length}</b></span>
        </span>
      </div>`;
  if(dikkat.length === 0){
    out += `<div class="empty-state">Duruşta makine yok.</div>`;
  } else {
    out += `<div class="matrix-grid">`;
    dikkat.slice(0, GB_KART_LIMIT).forEach(d=>{
      const renk = d.alert ? 'var(--danger)' : 'var(--warn)';
      const zemin = d.alert ? 'var(--danger-bg)' : 'var(--warn-bg)';
      /* Etiket Makine Matrisi'yle aynı kademeyi kullanıyor: Gün Sonu ile Planlı Mola artık
         tek "Planlı" altında toplanmıyor (ikisi farklı şey — vardiya bitişi / öğle arası). */
      const etiket = d.alert ? 'Uzun duruş'
        : (d.info && d.info.duruşNedeni===GUN_SONU_REASON) ? 'Gün sonu'
        : (d.info && d.info.duruşNedeni===PLANLI_MOLA_REASON) ? 'Planlı mola'
        : 'Duruş';
      out += `<div class="matrix-card${d.alert?' durus-alert':''}" style="background:${zemin};border-color:${renk}" onclick="openMachineDetail('${escJs(d.m.code)}')">
        <div class="matrix-card-top"><span class="matrix-code">${d.m.code}</span><span class="matrix-tag" style="--sb:${renk}">${etiket}</span></div>
        <div class="matrix-name">${esc(d.m.name)}</div>
        ${d.sayi>1
          ? `<div class="matrix-sub" style="font-weight:700">${d.sayi} iş duraklatıldı</div><div class="matrix-sub" style="opacity:.7">Detay için tıkla</div>`
          : `<div class="matrix-sub">${esc((d.info && (d.info.talepNo||d.info.isEmriNo))||'—')} · ${esc(d.info ? operatorGosterimAdi(d.info) : '—')}</div>
             <div class="matrix-sub">${esc((d.info && d.info.duruşNedeni)||'—')}</div>`}
        ${d.bas ? `<div class="matrix-sub mono" style="color:${renk};font-weight:700">${live(()=> fmtDur(Math.max(0, nowTick - d.bas)))}</div>` : ''}
      </div>`;
    });
    out += `</div>`;
    if(dikkat.length > GB_KART_LIMIT && isAdminTabVisible('matrix')){
      out += `<button class="btn-ghost gb-more" onclick="setView('matrix')">${dikkat.length - GB_KART_LIMIT} makine daha · ${tumMakineler.length} makinenin tamamı için Makine Matrisi</button>`;
    }
  }
  out += `</div>`;

  /* SAĞ RAY — üçü de kalıcı panel. Süreler burada live() ile sarılmıyor: hepsi 30 dk / 14 saat
     mertebesinde, saniyelik tik anlam taşımıyor; renderLiveBits zaten her 15. tik'te tam render
     yapıyor (bkz. ui/live.js kapsam notu), yani en fazla 15 saniyelik bayatlık oluyor. */
  out += `<div class="gb-rail">
      <div class="notice" style="--nc:var(--danger);margin-bottom:0">
        <div class="notice-title">${ico('alert',15)} Uzun Duruşlar <span style="margin-left:auto">${uzunDurusList.length}</span></div>`;
  if(uzunDurusList.length === 0){
    out += `<div class="notice-sub">${esikDk} dk eşiğini aşan duruş yok.</div>`;
  } else {
    uzunDurusList.slice(0,5).forEach(u=>{
      out += `<div class="notice-row" onclick="openUzunDurusModal()">
        <span style="min-width:0"><b class="mono">${esc(String(u.makine||'').split(' · ')[0])}</b> <span style="color:var(--text-muted)">${esc(u.neden||'')}</span></span>
        <span class="mono" style="color:var(--danger);font-weight:700;flex:none">${fmtDur(u.ms)}</span>
      </div>`;
    });
    if(uzunDurusList.length > 5){
      out += `<div class="notice-sub" style="margin-top:8px">+${uzunDurusList.length - 5} tane daha — listeyi açmak için bir satıra tıkla.</div>`;
    }
  }
  out += `</div>
      <div class="notice" style="--nc:var(--warn);margin-bottom:0">
        <div class="notice-title">${ico('clock',15)} Kapatılmamış Olabilir <span style="margin-left:auto">${uzunDevamEdenList.length}</span></div>`;
  if(uzunDevamEdenList.length === 0){
    out += `<div class="notice-sub">${esikSaat} saatten uzun süredir "devam" görünen kayıt yok.</div>`;
  } else {
    uzunDevamEdenList.slice(0,5).forEach(u=>{
      out += `<div class="notice-row" onclick="openUzunDevamEdenModal()">
        <span style="min-width:0"><b class="mono">${esc(String(u.makine||'').split(' · ')[0])}</b> <span style="color:var(--text-muted)">${esc(u.operatorUsername||'')}</span></span>
        <span class="mono" style="color:var(--warn);font-weight:700;flex:none">${fmtDur(u.ms)}</span>
      </div>`;
    });
    if(uzunDevamEdenList.length > 5){
      out += `<div class="notice-sub" style="margin-top:8px">+${uzunDevamEdenList.length - 5} tane daha — listeyi açmak için bir satıra tıkla.</div>`;
    }
  }
  out += `</div>
      <div class="analiz-chart-box">
        <div class="gb-panel-head">
          <span class="gb-panel-title">Son Tamamlananlar</span>
          ${isAdminTabVisible('completed') ? `<button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="setView('completed')">Tümü</button>` : ''}
        </div>`;
  if(tamamlananlar.length === 0){
    out += `<div class="notice-sub">Henüz tamamlanan rota yok.</div>`;
  } else {
    tamamlananlar.slice(0,6).forEach(r=>{
      const talepNo = r.entries.find(e=>e.talepNo)?.talepNo || '';
      const son = r.entries[r.entries.length-1] || {};
      out += `<div class="gb-row" onclick="openRouteDetail('${escJs(r.isEmriNo)}', ${r.finishedAt})">
        <span class="mono" style="color:var(--accent);font-weight:600;flex:none">${esc(talepNo || r.isEmriNo)}</span>
        <span style="color:var(--text-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(son.operatorUsername||'')}</span>
        <span style="color:var(--text-muted);font-size:11.5px;flex:none">${fmtDur(Math.max(0, nowTick - r.finishedAt))} önce</span>
      </div>`;
    });
  }
  out += `</div>
    </div>
  </div>
  </div>${routeModal ? renderRouteModal() : ''}`;
  return out;
}

/* ===================== AYARLAR — DÖRT GRUPLU MENÜ (22.09.2026) =====================
   Admin-Ayarlar tahtası 18 düz alt sekmeyi dört gruba indiriyor: Genel & Kurulum, Makineler,
   Üretim Kuralları, Erişim & Yetkiler. Yatay alt sekme şeridi kalktı; ekran artık bir MENÜ —
   satıra tıklayınca ilgili ayar ekranı açılıyor, aç/kapa anahtarları satır içinde.

   TAHTADAN BİLEREK SAPILAN NOKTA: tahtanın altındaki "Buradan taşınanlar" şeridi dokuz
   maddenin Operatörler / Excel Yükleme / Bildirimler ekranlarına taşındığını söylüyor — ama o
   üç ekran HENÜZ YOK (A.10–A.12 çizilmedi; 9. adımın blokaj sebebi tam olarak bu). Tahta
   birebir uygulansaydı Personel Ayarları, Veri Listeleri, Bildirim Gönder gibi ayarlara
   erişim sessizce kaybolurdu. Bu yüzden şerit tahtadaki gibi duruyor ama ölü link değil:
   ilgili alt sekmeyi açıyor. O ekranlar çizildiğinde şeridin hedefleri oraya çevrilir.

   ERİŞİM: her satırın koşulu, o alt sekmenin ESKİ şerit koşuluyla birebir aynı. Satır
   görünmüyorsa oraya menüden girilemez; state üzerinden girilse bile renderAdmin'in
   başındaki rol zorlaması geri atar (o iki satıra 'menu' istisnası eklendi). */
function ayarSatiri(o){
  /* Yeni satir tipi ICAT EDILMEDI: ac/kapa icin render-common.js'teki switchRow(), gezinme
     icin tasarim sisteminde zaten tanimli .set-row + .chev kullaniliyor. */
  if(o.toggle) return switchRow(o.id, o.ac, o.etiket, o.alt||'', {ok:true, onchange:o.toggle, style:'margin-bottom:8px'});
  const eylem = o.onclick || `setSettingsSubTab('${o.hedef}')`;
  return `<button class="set-row" style="margin-bottom:8px" onclick="${eylem}">
    <span style="min-width:0"><span>${o.etiket}</span>${o.alt?`<span class="sw-sub" style="display:block">${o.alt}</span>`:''}</span>
    ${o.deger?`<span class="ayar-deger mono">${o.deger}</span>`:''}
    <span class="chev">${ico('chevronRight',15)}</span>
  </button>`;
}
function renderAyarlarMenu(){
  const sa = !!session.isSuperAdmin, sef = !!session.isSef;
  // ek: grubun satirlarindan SONRA, kapanis div'inden ONCE basilacak icerik (rol notu gibi)
  const grup = (baslik, satirlar, ek) => {
    const dolu = satirlar.filter(Boolean);
    return dolu.length ? `<div class="set-card"><div class="set-sec" style="margin:0 0 10px">${baslik}</div>${dolu.join('')}${ek||''}</div>` : '';
  };
  const esikDk = Math.round(uzunDurusEsikMs()/60000);
  const makineSay = allMachines().length;
  const bolumKuralSay = Object.keys(getBolumKurallari()||{}).length;
  const yoneticiSay = Object.entries(STATE.operators).filter(([c,v])=>!v.isSuperAdmin && (v.isAdmin||v.isSef||v.isUretimSef)).length;
  /* 28.09.2026 — tahtadaki (design/AyarlarOneri) bes satir menude yoktu, ayarlarin kendisi
     alt ekranlarin icinde gomuluydu. Artik menude kendi satirlari ve GUNCEL DEGERLERI var.
     Sayilar canli kaynaklardan turetiliyor, sabit yazilmis hicbir rakam yok. */
  const fasonSay   = Object.keys(fasonMachines||{}).filter(k=>fasonMachines[k]).length;
  const gizliSay   = Object.keys(hiddenMachines||{}).length;
  const tadilatAtolyeSay = allMachines().filter(m=>machineAtolyeOf(m.code)==='tadilat').length;
  /* Tadilat yetkisi kosulu, Operatorler ekranindaki kutucugun ifadesiyle BIREBIR ayni
     (bkz. renderPersonelAyarlari > toggleTadilatYetkisi): acikca verilmisse o, verilmemisse
     Sef/Uretim Sefi varsayilan acik. SuperAdmin her zaman yetkili oldugu icin sayilmiyor. */
  const tadilatYetkiliSay = Object.entries(STATE.operators).filter(([c,v])=>
    !v.isSuperAdmin && (v.isAdmin||v.isSef||v.isUretimSef) &&
    (v.permTadilatOlustur===true || (v.permTadilatOlustur!==false && (v.isSef||v.isUretimSef)))).length;

  const g1 = grup('Genel &amp; Kurulum', [
    /* Tema satiri toggleTheme() cagiriyordu ve o yalnizca koyu<->acik ceviriyor: yoneticinin
       kayitli temasi 'system' ise satira basinca sessizce sabit bir temaya donusuyordu.
       Operator ayarlarindaki uclu secici (themeOptHtml) burada kullanilamiyor — .set-row bir
       <button> ve icine buton konmaz — o yuzden satir uc durum arasinda donuyor. */
    ayarSatiri({ etiket:'Tema', alt:'Koyu · Açık · Sistem arasında geçer',
      deger: theme==='system' ? 'Sistem' : (resolvedTheme()==='dark'?'Koyu':'Açık'), onclick:'temaDongusu()' }),
    sa && ayarSatiri({ etiket:'Takım &amp; Sarf Stok Modülü', id:'sw-toolstok', toggle:'toggleToolStokEnabled()', ac:toolStokEnabled() }),
    sa && ayarSatiri({ etiket:'Karbür Stok Modülü', id:'sw-karbur', toggle:'toggleKarburEnabled()', ac:karburEnabled() }),
    sa && ayarSatiri({ etiket:'Malzeme Stok Takibi', id:'sw-malzeme', alt:'Kapalıyken operatör stoğu görmez; yönetim ekranı çalışmaya devam eder', toggle:'toggleStockTracking()', ac:stockEnabled() }),
    sa && ayarSatiri({ etiket:'Resim Bul — görsel arama', id:'sw-resimbul', alt:'Yerel ağdaki ayrı sunucuya bağımlı', toggle:'toggleResimBul()', ac:resimBulEnabled() }),
  ]);

  const g2 = grup('Makineler', [
    sa && ayarSatiri({ etiket:'Makine Listesi', alt:'Ad, grup, atölye, fason ve gizleme işaretleri', deger:String(makineSay), hedef:'makineAyarlari' }),
    sa && ayarSatiri({ etiket:'Makine Ekle', hedef:'addMachine' }),
    sa && ayarSatiri({ etiket:'Fason / Dışarı Gönderim İşaretleri', alt:'Bu makinelerde "makine meşgul" kısıtı uygulanmaz',
      deger:`${fasonSay} makine`, hedef:'makineAyarlari' }),
    sa && ayarSatiri({ etiket:'Atölye Ataması', alt:'İmalat / Tadilat — Analiz ekranındaki atölye süzgecini besler',
      deger:`${tadilatAtolyeSay} tadilat`, hedef:'makineAyarlari' }),
    sa && gizliSay>0 && ayarSatiri({ etiket:'Gizlenmiş Makineler', alt:'Silinen dahili makineler — yeni seçimlerde çıkmaz',
      deger:`${gizliSay}`, hedef:'addMachine' }),
    sa && ayarSatiri({ etiket:'Kişi Bazlı Makine Erişimi', alt:'Operatörün "Çalışılan Makine" listesini belirler', hedef:'access' }),
  ]);

  const g3 = grup('Üretim Kuralları', [
    sa && ayarSatiri({ etiket:'Duruş Nedenleri', alt:'Planlı Mola ve Gün Sonu verimlilik paydasına girmez', hedef:'durusReasons' }),
    canManageBildirimAyarlari() && ayarSatiri({ etiket:'Uzun Duruş Uyarı Eşiği', alt:'Bildirim ayarlarının tamamı', deger:`${esikDk} dk`, hedef:'uyarilar' }),
    sa && ayarSatiri({ etiket:'Tadilat Hazır Açıklama Şablonları', hedef:'tadilatSablonlari' }),
    sa && ayarSatiri({ etiket:'Bölüm &rarr; İş Merkezi Eşleştirme', deger:`${bolumKuralSay} kural`, hedef:'bolumKurallari' }),
    sa && ayarSatiri({ etiket:'Karbür Hurda Eşiği', alt:'Bu boyun altındaki artıklar hiç kaydedilmez',
      deger:`${typeof karburHurdaEsigi==='function' ? karburHurdaEsigi() : '—'} mm`, hedef:'karbur' }),
    sa && ayarSatiri({ etiket:'Karbür Stok Ayarları', alt:'Hurda eşiği ve katalog', hedef:'karbur' }),
    (sa||sef) && ayarSatiri({ etiket:'Malzeme Stoğu', hedef:'stok' }),
  ]);

  /* Tahtadaki rol notu gerçeği yansıtıyor: rol atamaları RTDB Rules tarafından istemciye
     kapalı, bu ekrandan yapılamıyor. */
  const rolNotu = `<div class="notice" style="--nc:var(--warn);margin:10px 0 0;padding:11px 13px">
    <div class="notice-sub"><b style="color:var(--nc)">Rol yükseltme burada yok.</b> Admin / SuperAdmin / Şef atamaları yalnızca Firebase Console'dan yapılır — Rules bunu istemciye kapatıyor.</div></div>`;

  /* Grup tek satirliktan uce cikti (28.09.2026): tahtada "Erisim & Yetkiler" uc satir
     gosteriyordu ama ikisi baska yerlerdeydi. Takim gorunurluk/sayim izinleri "Uretim
     Kurallari"ndan buraya TASINDI (icerigi yetki, uretim kurali degil); Tadilat olusturma
     yetkisi ise A.12'de Operatorler ekranina tasindigi icin oraya yonlendiriyor. */
  const g4 = grup('Erişim &amp; Yetkiler', [
    sa && ayarSatiri({ etiket:'Sekme / Bölüm Erişimi', alt:"Kullanıcı bazlı — Canlı Panel'in üç sekmesi ayrı ayrı", deger:`${yoneticiSay} kişi`, hedef:'tabErisimi' }),
    sa && ayarSatiri({ etiket:'Takım Stok Görünürlük / Sayım İzinleri', alt:'Kalem Listesi, Konumlar, Sayım — kullanıcı bazlı', hedef:'takimStok' }),
    sa && ayarSatiri({ etiket:'Tadilat Oluşturma Yetkisi', alt:'Operatörler ekranında, kişi satırlarında',
      deger:`${tadilatYetkiliSay} kişi`, onclick:'gotoOperatorler()' }),
  ], sa ? rolNotu : '');

  /* 28.09.2026: burasi "tasinacak" seridiydi — tahtada bu iki satir A.10 Bildirimler
     ekranina gidiyordu. Kullanici Bildirimler'i sol bardan kaldirdigi ve A.10'u dusurdugu
     icin serit kalkti; satirlar kendi grubuna donustu ve bir yere gitmeyen vaat bitti. */
  const g5 = grup('Bildirimler', [
    ayarSatiri({ etiket:'Bildirimlerim', alt:'Sana gelen son bildirimler', hedef:'bildirimlerim' }),
    sa && ayarSatiri({ etiket:'Bildirim Gönder', alt:'Seçtiğin kişilere anlık bildirim', hedef:'bildirimGonder' }),
  ]);

  return `<div class="ayar-menu">${g1}${g2}${g3}${g4}${g5}</div>`;
}

/* Üst bardaki ekran başlığı — tahtalarda (Admin-Tadilat, Admin-Matris, Admin-Ayarlar) üst bar
   62px ve solunda "üst etiket / başlık / kısa açıklama" bloğu var. Canlı Panel'in üç sekmesinde
   üst etiket ekranın adı, başlık aktif sekme (Admin-Matris tahtasındaki düzen). */
/* ===================== KENAR CUBUGU AC/KAPA (28.09.2026) =====================
   Cubuk 22.09.2026'da 64px ikon seridine cevrilmisti; artik kullanici genisletip
   daraltabiliyor. VARSAYILAN DAR: bugunku davranis bu, genisletmek bilincli bir secim.

   Tercih localStorage'da (rt_ oneki, intro-hint sayaciyla ayni desen) — kullanici bazinda
   degil CIHAZ bazinda, cunku bu bir ekran alani tercihi: ayni kisi genis monitorde genis,
   dizustunde dar isteyebilir. localStorage kapaliysa dar'a dusuyor, hata vermiyor.

   Genislik/etiket gizleme kurallari TAMAMEN CSS'te (.admin-sidebar.dar) — markup her iki
   durumda da ayni, yalnizca sinif degisiyor. 900px altinda yatay serit duzeni gecerli,
   orada bu dugme is gormedigi icin gizleniyor (bkz. styles.v2.css). */
const SIDEBAR_KEY = 'rt_sidebar_genis';
let sidebarGenis = (function(){
  try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch(_){ return false; }
})();
function sidebarDaralt(){
  sidebarGenis = !sidebarGenis;
  try { localStorage.setItem(SIDEBAR_KEY, sidebarGenis ? '1' : '0'); } catch(_){}
  render();
}

/* ===================== MATRIS KARTINDA OPERATOR ADI (28.09.2026) =====================
   Kartlarda "2609280004 · OPRT7" yaziyordu; kod yerine kisinin adi isteniyor.

   Kaynak sirasi: kaydin kendi operatorName'i -> STATE.operators[kod].displayName -> kod.
   Eski kayitlarda operatorName bos olabildigi icin ikinci basamak var; hicbiri yoksa kod
   gosteriliyor (bos birakmaktansa kod bilgi verir).

   Kart dar oldugu icin uzun isimler soyadi bas harfe iniyor: "Ramazan KARAKOC" ->
   "Ramazan K.", ama "Serkan KOL" zaten sigdigi icin oldugu gibi kaliyor. Esik 13 karakter:
   .matrix-sub 12px'te ~13 karakter + " · " + sure satira sigiyor. */
const MATRIS_AD_ESIK = 13;
function operatorGosterimAdi(kayit){
  if(!kayit) return '—';
  const kod = kayit.operatorUsername || '';
  const kayitli = (typeof STATE!=='undefined' && STATE.operators && STATE.operators[kod]) || null;
  const tam = String(kayit.operatorName || (kayitli && kayitli.displayName) || '').trim();
  if(!tam) return kod || '—';
  if(tam.length <= MATRIS_AD_ESIK) return tam;
  const parcalar = tam.split(/\s+/).filter(Boolean);
  if(parcalar.length >= 2){
    const kisa = parcalar[0] + ' ' + parcalar[parcalar.length-1].charAt(0) + '.';
    if(kisa.length <= MATRIS_AD_ESIK) return kisa;
    return parcalar[0].slice(0, MATRIS_AD_ESIK-1) + '…';
  }
  return tam.slice(0, MATRIS_AD_ESIK-1) + '…';
}

const EKRAN_BASLIKLARI = {
  report:       { baslik:'Kayıtlar', alt:'tamamlanan operasyonların listesi' },
  genelBakis:   { ustu:'Canlı Panel', baslik:'Genel Bakış' },
  matrix:       { ustu:'Canlı Panel', baslik:'Makine Matrisi' },
  completed:    { ustu:'Canlı Panel', baslik:'Tamamlanan Kodlar' },
  isYogunlugu:  { baslik:'İş Yoğunluğu' },
  /* Tahtada başlığın altında seçili aralık ve canlı göstergesi var ("21 Eylül 2026 · canlı"). */
  analiz:       { baslik:'Analiz', alt:()=>{
                    if(analizRole==='yonetici') return rtAralik().etiket;
                    const bugun = dateKey(Date.now());
                    if(analizFrom===bugun && analizTo===bugun) return 'bugün · canlı';
                    return analizFrom===analizTo ? analizFrom : (analizFrom+' → '+analizTo);
                  } },
  tadilatYonetim:{ baslik:'Tadilat', alt:'İmalat + Tadilat atölye' },
  /* Breadcrumb gövdeden üst bara taşındı — aktif alt görünümü (Genel Bakış / Takım & Sarf /
     Karbür / Hammadde) gösteriyor, tahtadaki 'Stok / Genel Bakış' satırının karşılığı. */
  stokYonetim:  { ustu:()=>{ const t=(typeof STOK_BOLUMLERI!=='undefined') ? STOK_BOLUMLERI.find(b=>b.key===stokSubView) : null;
                             return 'Stok / '+(t ? t.label : 'Genel Bakış'); }, baslik:'Stok Takibi' },
  excelYukleme: { ustu:'Yönetim', baslik:'Excel Yükleme' },
  operatorler: { ustu:'Yönetim', baslik:'Operatörler' },
  adminSettings:{ ustu:'Yönetim', baslik:'Ayarlar' },
};
function ekranBasligiHtml(){
  const b = EKRAN_BASLIKLARI[view];
  if(!b) return '';
  // 'ustu' fonksiyon olabilir: Stok'ta aktif alt gorunume gore degisiyor (Stok / Karbur gibi).
  const ustu = typeof b.ustu==='function' ? b.ustu() : b.ustu;
  const alt  = typeof b.alt==='function'  ? b.alt()  : b.alt;
  return `<div class="topbar-baslik">
    ${ustu?`<div class="topbar-ustu">${ustu}</div>`:''}
    <div class="topbar-ad">${b.baslik}</div>
    ${alt?`<div class="topbar-alt">${alt}</div>`:''}
  </div>`;
}
/* Veri Listeleri 22.09.2026'da Ayarlar'dan Excel Yükleme ekranına TAŞINDI (kullanıcı isteği).
   Gövde aynen taşındı, yalnızca renderAdmin'in `body` değişkenine eklemek yerine kendi dizesini
   döndürüyor. Erişim koşulu değişmedi: SuperAdmin ya da Şef. */
function renderVeriListeleri(){
  let body = '';
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
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">ERP'den (BAST08) aldığınız iş merkezi kodları (V01, B10, N3 gibi — açıklama alınmaz). Atölye İş Takip'in kendi makine listesinden ayrı; Tadilat'ta "Talep Edilen Makine" alanında kullanılır. Hangi bölümün hangi kodlara erişebileceği "Tadilat Bölüm Kuralları"ndan ayarlanır.</div>
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
  return body;
}
/* ===================== EXCEL YÜKLEME EKRANI (A.11, 22.09.2026) =====================
   Sol bardaki yükleme ikonu eskiden Stok Takibi → Hammadde → Excel'e atıyordu (gotoExcelYukleme).
   Artık kendi ekranı var ve DÖRT yükleme akışının hepsi burada toplandı:

     veriListeleri -> Ayarlar'dan TAŞINDI (renderVeriListeleri) — üretim referans listeleri
     malzeme       -> renderMalzemeStokScreen()'in excel bölümü
     takim         -> renderToolExcelUploadAdmin()
     karbur        -> renderKarburExcel()

   Gövdeler KOPYALANMADI, olduğu yerden çağrılıyor; böylece yükleme mantığı tek yerde kalıyor
   ve modül içindeki mevcut "Excel Yükle" bölümleri de aynı kodu göstermeye devam ediyor.

   Erişim: her sekmenin koşulu, o akışın ESKİ koşuluyla birebir aynı — Veri Listeleri
   SuperAdmin/Şef, Hammadde canManageStock(), Takım isTakimStokSubTabVisible('excel'),
   Karbür isAdminTabVisible('karbur'). Hiçbiri görünmüyorsa ekran bunu söylüyor. */
const EXCEL_BOLUMLERI = [
  { key:'veriListeleri', label:'Veri Listeleri', alt:'üretim referans listeleri',
    gor:()=>!!(session && (session.isSuperAdmin || session.isSef)) },
  { key:'malzeme', label:'Hammadde', alt:'stok kalemleri',
    gor:()=>canManageStock() },
  { key:'takim', label:'Takım & Sarf', alt:'katalog',
    gor:()=>(typeof isTakimStokSubTabVisible==='function') && isTakimStokSubTabVisible('excel') },
  { key:'karbur', label:'Karbür', alt:'katalog',
    gor:()=>isAdminTabVisible('karbur') },
];
let excelSubView = 'veriListeleri';
function setExcelSubView(k){
  excelSubView = k;
  /* Hammadde bölümü renderMalzemeStokScreen()'in içinden geliyor ve hangi bölümü
     döndüreceğine malzemeSubView'a bakarak karar veriyor — sekmeye basınca onu da
     'excel'e alıyoruz ki doğru gövde gelsin. */
  if(k==='malzeme') malzemeSubView = 'excel';
  render();
}
/* ===================== OPERATORLER EKRANI (A.12, 28.09.2026) =====================
   Sol bardaki "Operatorler" dugmesi eskiden Ayarlar -> Personel Ayarlari'na yonlendiriyordu.
   Artik kendi ekrani var ve operator yasam dongusunun uc bolumu burada toplandi:

     personel -> Personel Ayarlari  (varsayilan makine, coklu is, makine erisimi)
     atolye   -> Atolye Ayarlari    (hangi personel hangi atolyede)
     ekle     -> Kullanici Ekle     (yeni operator/kullanici acma)

   A.11 Excel Yukleme ile AYNI desen: govdeler Ayarlar zincirinden buraya TASINDI (kopyalanmadi),
   Ayarlar menusundeki uc satir kaldirildi, AYAR_ALT_SEKMELERI beyaz listesinden de dustuler ki
   state'te kalmis eski deger bombos ekran vermesin. */
function renderPersonelAyarlari(){
  /* Ayarlar > personelAyarlari dalindan tasindi (A.12). */
  let body = '';
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
              <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                <input type="checkbox" style="width:auto" ${v.permTakimStokGor?'checked':''} onchange="toggleUserPerm('${code}','permTakimStokGor')"> ${ico('wrench',13)} Takım Stok: Görebilir/Çıkış
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                <input type="checkbox" style="width:auto" ${v.permTakimStokSayim?'checked':''} onchange="toggleUserPerm('${code}','permTakimStokSayim')"> ${ico('wrench',13)} Takım Stok: Sayım
              </label>
              <select class="filter-input" style="width:200px" onchange="updateDefaultMachine('${code}', this.value)">
                <option value="">— Varsayılan Makine yok —</option>
                ${allMachines().map(m=>{ const label=`${m.code} · ${m.name}`; return `<option value="${esc(label)}" ${v.defaultMachine===label?'selected':''}>${esc(label)}</option>`; }).join('')}
              </select>
              <button class="btn-ghost" style="white-space:nowrap;margin-left:auto" onclick="openMachineAccessModal('${escJs(code)}')">${ico('wrench',14)} Makine Erişimi</button>
            </div>
          `).join('')}
        </div>`;
  return body;
}
function renderPersonelAtolye(){
  /* Ayarlar > personelAtolye dalindan tasindi (A.12). */
  let body = '';
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
  return body;
}
function renderKullaniciEkle(){
  /* Ayarlar > addOperator dalindan tasindi (A.12). */
  let body = '';
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
  return body;
}
const OPERATOR_BOLUMLERI = [
  { key:'personel', label:'Personel Ayarları', alt:'varsayılan makine, çoklu iş, makine erişimi' },
  { key:'atolye',   label:'Atölye Ayarları',   alt:'hangi personel hangi atölyede' },
  { key:'ekle',     label:'Kullanıcı Ekle',    alt:'yeni operatör/kullanıcı aç' },
];
let operatorSubView = 'personel';
function setOperatorSubView(k){ operatorSubView = k; render(); }
function renderOperatorler(){
  /* YETKI: bu uc satir Ayarlar menusunde `sa` ile, yani SADECE SuperAdmin'e ciziliyordu
     (Sef'e degil — bkz. renderAyarlarMenu). Ekran birebir ayni kosulu kullaniyor; taşıma
     sirasinda yetki genisletmek sessiz bir guvenlik degisikligi olurdu. */
  if(!(session && session.isSuperAdmin)){
    return `<div class="settings-wrap"><div style="color:var(--text-muted);font-size:12.5px">Bu ekrana erişim yetkin yok.</div></div>`;
  }
  if(!OPERATOR_BOLUMLERI.some(b=>b.key===operatorSubView)) operatorSubView = 'personel';
  const serit = `<div class="sub-tabs" style="flex-wrap:wrap">
    ${OPERATOR_BOLUMLERI.map(b=>`<button class="sub-tab-btn ${operatorSubView===b.key?'active':''}" title="${esc(b.alt)}" onclick="setOperatorSubView('${b.key}')">${esc(b.label)}</button>`).join('')}
  </div>`;
  let govde = '';
  if(operatorSubView==='personel')    govde = renderPersonelAyarlari();
  else if(operatorSubView==='atolye') govde = renderPersonelAtolye();
  else if(operatorSubView==='ekle')   govde = renderKullaniciEkle();
  return `<div class="settings-wrap">${serit}${govde}</div>`;
}
function renderExcelYukleme(){
  const gorunur = EXCEL_BOLUMLERI.filter(b=>b.gor());
  if(gorunur.length===0){
    return `<div class="settings-wrap"><div style="color:var(--text-muted);font-size:12.5px">Excel yükleme ekranlarına erişim yetkin yok.</div></div>`;
  }
  if(!gorunur.some(b=>b.key===excelSubView)){
    excelSubView = gorunur[0].key;
    if(excelSubView==='malzeme') malzemeSubView = 'excel';
  }
  const serit = `<div class="sub-tabs" style="flex-wrap:wrap">
    ${gorunur.map(b=>`<button class="sub-tab-btn ${excelSubView===b.key?'active':''}" title="${esc(b.alt)}" onclick="setExcelSubView('${b.key}')">${esc(b.label)}</button>`).join('')}
  </div>`;
  let govde = '';
  if(excelSubView==='veriListeleri')  govde = renderVeriListeleri();
  else if(excelSubView==='malzeme')   govde = renderMalzemeStokScreen();
  else if(excelSubView==='takim')     govde = renderToolExcelUploadAdmin();
  else if(excelSubView==='karbur')    govde = renderKarburExcel();
  return `<div class="settings-wrap">${serit}${govde}</div>`;
}

/* Yönetici gezinme öğeleri (02.10.2026) — TEK liste. Masaüstündeki sol kenar çubuğu ve
   telefondaki alt çubuk/menü aynı listeden çiziliyor, ki bir sekmenin yetki koşulu iki yerde
   ayrı ayrı tutulup ayrışmasın. Koşullar eski kenar çubuğu markup'ındakilerin BİREBİR aynısı. */
function adminNavOgeleri(){
  const o = [];
  if(isAdminTabVisible('rapor')) o.push({ key:'rapor', label:'Kayıtlar', ikon:'list', aktif: view==='report', tikla:"setView('report')" });
  if(canliPanelVisible()) o.push({ key:'canli', label:'Canlı Panel', ikon:'clock', aktif: isCanliPanelView(view), tikla:`setView('${canliPanelDefaultView()}')` });
  if(isAdminTabVisible('isYogunlugu')) o.push({ key:'isYogunlugu', label:'İş Yoğunluğu', ikon:'box', aktif: view==='isYogunlugu', tikla:"setView('isYogunlugu')" });
  if(!(session.isSef || session.isUretimSef) && isAdminTabVisible('analiz')) o.push({ key:'analiz', label:'Analiz', ikon:'chart', aktif: view==='analiz', tikla:"setView('analiz')" });
  if(canCreateTadilat() && isAdminTabVisible('tadilat')) o.push({ key:'tadilat', label:'Tadilat', ikon:'wrench', aktif: view==='tadilatYonetim', tikla:"setView('tadilatYonetim')" });
  if(stokErisimVar()) o.push({ key:'stok', label:'Stok', ikon:'box', aktif: view==='stokYonetim', tikla:"setView('stokYonetim')" });
  if(session.isAdmin){
    o.push({ key:'excel', label:'Excel Yükleme', ikon:'upload', aktif: view==='excelYukleme', tikla:'gotoExcelYukleme()', yonetim:true });
    if(session.isSuperAdmin) o.push({ key:'operatorler', label:'Operatörler', ikon:'users', aktif: view==='operatorler', tikla:'gotoOperatorler()', yonetim:true });
    o.push({ key:'ayarlar', label:'Ayarlar', ikon:'gear', aktif: view==='adminSettings', tikla:'gotoAyarlar()', yonetim:true });
  }
  return o;
}
/* TELEFON (≤900px, 02.10.2026). Eskiden kenar çubuğu ekranın EN ÜSTÜNDE yatay bir şeride
   dönüşüyordu: 10 sekme 1335px genişliğinde, ekranda 2,5'i görünüyor; üstelik iPhone'da ana
   ekrandan açılınca (black-translucent durum çubuğu + viewport-fit=cover) şerit saatin/çentiğin
   ALTINA giriyordu ve dokunulamıyordu — güvenli alan boşluğu şeride değil altındaki başlığa
   verilmişti. Artık telefonda şerit yok: altta 4 ana sekme + "Menü" (iOS sekme çubuğu deseni,
   operatör ekranındaki .bottom-nav ile aynı fikir). Menü tüm bölümleri, kullanıcıyı ve
   Çıkış'ı açıyor. Ana sekmeler sırayla: Rapor, Canlı Panel, Tadilat, Stok — kullanıcının
   yetkisi olmayan düşüyor, boşluğu listedeki sıradaki dolduruyor. */
let adminMenuAcik = false;
/* Analiz (raporlar dahil) admine açık; Şef/Üretim Şef'te yok → boşluğu sıradaki (Kayıtlar) doldurur. */
const ADMIN_MOBIL_BIRINCIL = ['analiz','canli','tadilat','stok'];
function adminAltBarHtml(ogeler){
  let birincil = ADMIN_MOBIL_BIRINCIL.map(k=>ogeler.find(n=>n.key===k)).filter(Boolean);
  for(const n of ogeler){ if(birincil.length>=4) break; if(!birincil.includes(n)) birincil.push(n); }
  birincil = birincil.slice(0,4).sort((a,b)=>ogeler.indexOf(a)-ogeler.indexOf(b));
  const menuAktif = adminMenuAcik || ogeler.some(n=>n.aktif && !birincil.includes(n));
  return `<nav class="admin-alt-bar" aria-label="Ana gezinme">
    ${birincil.map(n=>`<button class="admin-alt-item ${n.aktif&&!adminMenuAcik?'active':''}" onclick="adminMenuAcik=false; ${n.tikla}">${ico(n.ikon,20)}<span>${n.label}</span></button>`).join('')}
    <button class="admin-alt-item ${menuAktif?'active':''}" aria-expanded="${adminMenuAcik?'true':'false'}" onclick="adminMenuAcik=!adminMenuAcik; render()">${ico('menu',20)}<span>Menü</span></button>
  </nav>`;
}
function adminMenuHtml(ogeler, kisiHtml){
  if(!adminMenuAcik) return '';
  const kutu = n => `<button class="admin-menu-oge ${n.aktif?'active':''}" onclick="adminMenuAcik=false; ${n.tikla}">${ico(n.ikon,20)}<span>${n.label}</span></button>`;
  const ana = ogeler.filter(n=>!n.yonetim), yon = ogeler.filter(n=>n.yonetim);
  return `<div class="admin-menu-perde" onclick="if(event.target===this){adminMenuAcik=false; render();}">
    <div class="admin-menu-sheet" role="dialog" aria-label="Menü">
      <div class="admin-menu-kisi">${kisiHtml}</div>
      <div class="admin-menu-izgara">${ana.map(kutu).join('')}</div>
      ${yon.length ? `<div class="admin-sidebar-sec" style="padding:4px 2px 0">Yönetim</div><div class="admin-menu-izgara">${yon.map(kutu).join('')}</div>` : ''}
      <button class="btn-ghost admin-menu-cikis" onclick="adminMenuAcik=false; doLogout()">${ico('logout',16)} Çıkış Yap</button>
    </div>
  </div>`;
}
function renderAdmin(){
  /* Stok sekmesi uc bolumlu (takim / karbur / malzeme), asagida `stokYonetim` olarak ayrica ele
     aliniyor — bu yuzden burada karsiligi yok. */
  if(view==='raporlar') view = 'analiz'; // 05.10.2026'da ayrı Raporlar sekmesi Analiz → Genel'e katıldı
  const viewToTabKey = { report:'rapor', genelBakis:'genelBakis', matrix:'matrix', completed:'completed', isYogunlugu:'isYogunlugu', analiz:'analiz', tadilatYonetim:'tadilat' };
  if(viewToTabKey[view] && !isAdminTabVisible(viewToTabKey[view])){
    const tabKeyToView = { rapor:'report', genelBakis:'genelBakis', matrix:'matrix', completed:'completed', isYogunlugu:'isYogunlugu', analiz:'analiz', tadilat:'tadilatYonetim', takimStok:'stokYonetim', karbur:'stokYonetim' };
    const fallbackKey = ADMIN_TAB_DEFS.map(t=>t.key).find(k=>isAdminTabVisible(k) && (k!=='tadilat' || canCreateTadilat()) && (k!=='analiz' || !(session.isSef || session.isUretimSef)));
    view = fallbackKey ? tabKeyToView[fallbackKey] : 'report';
  }
  /* Stok sekmesi üç bölümden (takım / karbür / malzeme) oluşuyor; hiçbirine erişimi olmayan
     biri sekmeyi görmemeli, state üzerinden de girememeli. */
  if(view==='stokYonetim' && !stokErisimVar()) view = 'report';
  const operatorEntries = Object.entries(STATE.operators).filter(([k,v])=>!v.isAdmin);
  const uzunDurusList = (uzunDurusUyariEnabled() && isAdminTabVisible('uzunDurusUyari')) ? uzunDurusluKayitlar() : [];
  const uzunDevamEdenList = (uzunDevamEdenUyariEnabled() && isAdminTabVisible('uzunDevamEdenUyari')) ? uzunDevamEdenKayitlar() : [];
  /* YENİ ADMİN KABUĞU (2026-09-15): eskiden bu blok tek bir `header` (üst şerit: marka+ikonlar,
     altında yatay .tabs) üretiyordu. Şimdi ikiye ayrıldı: `sidebar` (sol sabit nav — eski .tabs +
     Ayarlar + Çıkış, BİREBİR aynı isAdminTabVisible()/canCreateTadilat()/stokErisimVar() koşullarıyla)
     ve `topbar` (marka artık sidebar'da olduğu için sadece durum/aksiyon ikonları kaldı: uzun duruş,
     uzun devam eden, mesajlar, bildirimlerim, çıkış — hiçbiri kaldırılmadı, sadece yeri değişti).
     Ayarlar butonu artık sidebar'da bir nav item. Tema değiştir butonu (themeToggleHtml())
     2026-09-21'de topbar'a GERİ eklendi — admin artık kendi açık/koyu paletine sahip (bkz.
     ui/styles.css .root-wide.theme-light / .root-wide.theme-dark). */
  const navOgeleri = adminNavOgeleri();
  const navBtn = n => `<button class="admin-nav-item ${n.aktif?'active':''}" title="${n.label}" onclick="${n.tikla}">${ico(n.ikon,14)}<span class="nav-label">${n.label}</span></button>`;
  const kisiHtml = `<div style="display:flex;align-items:center;gap:10px">
          <div class="admin-sidebar-avatar" title="${connOK?'Buluta bağlı (senkron)':'Bağlantı yok — internet kontrol edin'}">${esc((session.displayName||session.username||'').slice(0,2).toUpperCase())}<span style="position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;background:${connOK?'var(--success)':'var(--danger)'};border:2px solid var(--sidebar-bg);border-radius:50%"></span></div>
          <div><div class="admin-sidebar-uname">${esc(session.displayName||session.username)}</div><div class="admin-sidebar-urole"><span style="width:6px;height:6px;border-radius:50%;background:${connOK?'var(--success)':'var(--danger)'};display:inline-block"></span>${session.isSuperAdmin?'SuperAdmin':session.isSef?'Şef':session.isUretimSef?'Üretim Şef':'Yönetici'}</div></div>
        </div>`;
  const sidebar = `
    <nav class="admin-sidebar ${sidebarGenis?'':'dar'}">
      <div class="admin-sidebar-brand">
        ${ezelLogoHtml('admin-sidebar-mark')}
        <div class="admin-sidebar-brand-yazi"><div class="admin-sidebar-name">Atölye İş Takip</div></div>
        <button class="sidebar-toggle" onclick="sidebarDaralt()" aria-expanded="${sidebarGenis?'true':'false'}"
          title="${sidebarGenis?'Kenar çubuğunu daralt':'Kenar çubuğunu genişlet'}">${ico('panel',16)}</button>
      </div>
      ${navOgeleri.filter(n=>!n.yonetim).map(navBtn).join('')}
      ${navOgeleri.some(n=>n.yonetim) ? `<div class="admin-sidebar-sec">Yönetim</div>${navOgeleri.filter(n=>n.yonetim).map(navBtn).join('')}` : ''}
      <div class="admin-sidebar-user">
        ${kisiHtml}
        <button class="admin-nav-item" style="width:auto;min-width:40px;padding:6px;justify-content:center" onclick="doLogout()" title="Çıkış Yap">${ico('logout',15)}</button>
      </div>
    </nav>`;
  const header = `
    <div class="admin-topbar">
      ${ekranBasligiHtml()}
      ${uzunDurusList.length>0 ? `<button class="icon-btn" style="position:relative;border-color:var(--danger);color:var(--danger)" onclick="openUzunDurusModal()" title="Uzun süredir duruşta olanlar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <span style="position:absolute;top:-4px;left:-4px;background:var(--danger);color:var(--btn-primary-text);font-size:10px;font-weight:700;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center;line-height:1.3">${uzunDurusList.length}</span>
      </button>` : ''}
      ${uzunDevamEdenList.length>0 ? `<button class="icon-btn" style="position:relative;border-color:var(--warn);color:var(--warn)" onclick="openUzunDevamEdenModal()" title="Uzun süredir devam ediyor görünen (kapatılmayı unutulmuş olabilir)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span style="position:absolute;top:-4px;left:-4px;background:var(--warn);color:var(--btn-primary-text);font-size:10px;font-weight:700;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center;line-height:1.3">${uzunDevamEdenList.length}</span>
      </button>` : ''}
      ${canViewMessages() ? `<button class="icon-btn" style="position:relative" onclick="openMessagesModal()" title="Mesajlar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M2 6l10 7 10-7"></path></svg>
        ${unreadMessageCount()>0 ? `<span style="position:absolute;top:-4px;left:-4px;background:var(--danger);color:var(--btn-primary-text);font-size:10px;font-weight:700;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center;line-height:1.3">${unreadMessageCount()}</span>` : ''}
      </button>` : ''}
      <button class="icon-btn" style="position:relative" onclick="openMyPushHistoryModal()" title="Bildirimlerim">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        ${unreadPushCount()>0 ? `<span style="position:absolute;top:-4px;left:-4px;background:var(--accent);color:var(--btn-primary-text);font-size:10px;font-weight:700;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center;line-height:1.3">${unreadPushCount()}</span>` : ''}
      </button>
      ${themeToggleHtml()}
      <button class="icon-btn-labeled" onclick="doLogout()" title="Çıkış">${ico('logout',14)}<span class="topbar-etiket"> Çıkış</span></button>
    </div>
    ${uzunDurusModalOpen ? renderUzunDurusModal() : ''}
    ${uzunDevamEdenModalOpen ? renderUzunDevamEdenModal() : ''}
    ${messagesModalOpen ? renderMessagesModal() : ''}
    ${myPushHistoryModalOpen ? renderMyPushHistoryModal() : ''}
    ${yeniHammaddeModalHtml()}`;

  let body = '';
  if(view==='adminSettings' && !session.isAdmin){ view = 'report'; }
  if((session.isSef || session.isUretimSef) && view==='analiz'){ view = canliPanelDefaultView(); }
  /* Veri Listeleri Excel Yükleme ekranına taşındığı için Şef'in izinli alt sekmeleri arasından çıktı;
     yasak bir sekmeye düşen Şef artık boş bir ekrana değil MENÜYE atılıyor. */
  /* Bir alt sekme kaldirildiginda (Veri Listeleri -> Excel Yukleme ekranina tasindi) eski deger
     state'te kalabiliyor; asagidaki if/else zincirinden dusup bombos bir Ayarlar ekrani veriyordu.
     Taninmayan her deger menuye donuyor. Rol zorlamalari bunun USTUNE calisiyor, sirasi onemli. */
  const AYAR_ALT_SEKMELERI = ['menu','access','makineAyarlari','addMachine','bolumKurallari',
    'tabErisimi','resimBul','uyarilar','bildirimlerim','bildirimGonder','durusReasons',
    'tadilatSablonlari','takimStok','karbur','stok'];
  if(view==='adminSettings' && AYAR_ALT_SEKMELERI.indexOf(settingsSubTab)===-1){ settingsSubTab = 'menu'; }
  if(session.isSef && view==='adminSettings' && settingsSubTab!=='menu' && settingsSubTab!=='stok' && settingsSubTab!=='bildirimlerim' && !(settingsSubTab==='uyarilar' && canManageBildirimAyarlari())){ settingsSubTab = 'menu'; }
  if(session.isAdmin && !session.isSef && !session.isSuperAdmin && view==='adminSettings' && settingsSubTab!=='menu' && settingsSubTab!=='bildirimlerim' && !(settingsSubTab==='uyarilar' && canManageBildirimAyarlari())){ settingsSubTab = 'bildirimlerim'; } // düz Yönetici: sadece kendi bildirimini (ve izin verilmişse Bildirim Ayarları'nı) yönetebilir
  if(view==='adminSettings'){
    body = `<div class="settings-wrap">
      ${settingsSubTab==='menu' ? renderAyarlarMenu() : `<button class="btn-ghost" style="margin-bottom:14px" onclick="setSettingsSubTab('menu')"><span style="display:inline-flex;transform:rotate(180deg)">${ico('chevronRight',14)}</span> Tüm ayarlar</button>`}`;
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
    } else if(settingsSubTab==='addMachine'){
      body += `<div style="font-size:16px;font-weight:600;margin-bottom:6px">Yeni Makine Ekle</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:480px">Eklediğin makine anında tüm operatörlerin "Çalışılan Makine" listesinde görünür.</div>
        <div style="max-width:400px">
          <div class="field"><label>Makine Kodu</label><input id="new-mk-code" placeholder="ör. SM02"></div>
          <div class="field"><label>Makine Adı</label><input id="new-mk-name" placeholder="ör. Sütun Matkap 2"></div>
          <button class="btn-primary" onclick="addMachine()">+ Makineyi Ekle</button>
        </div>
        <div style="margin-top:24px;font-size:13px;font-weight:600;margin-bottom:8px">Mevcut Makineler (${allMachines().length})</div>
        <div class="machine-grid">${allMachines().map(m=>`<div class="machine-chip" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span><span class="mono" style="color:var(--accent);font-weight:700">${m.code}</span> ${esc(m.name)}</span><button class="del-btn" onclick="deleteMachine('${escJs(m.code)}')" title="Sil">${ico('trash',14)}</button></div>`).join('')}</div>
        ${(()=>{ /* Gizlenmis makineler burada listeleniyor (28.09.2026): silme bu ekranda
             yapiliyordu ama geri alma hicbir yerde yoktu, makine ancak Firebase Console'dan
             kurtariliyordu. Liste bos oldugunda bolum hic cizilmiyor — surekli duran bos bir
             baslik gurultu olurdu. Yalnizca DAHILI makineler gorunur; ek makineler silinince
             dugumden tamamen kalkiyor ve geri getirilecek kayit kalmiyor. */
          const gizli = (typeof gizlenmisMakineler==='function') ? gizlenmisMakineler() : [];
          if(gizli.length===0) return '';
          return `<div style="margin-top:24px;font-size:13px;font-weight:600;margin-bottom:4px">Gizlenmiş Makineler (${gizli.length})</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;max-width:520px">Silinen dahili makineler. Geçmiş kayıtları duruyor; geri getirince yeni seçimlerde tekrar çıkarlar.</div>
            <div class="machine-grid">${gizli.map(m=>`<div class="machine-chip" style="display:flex;align-items:center;justify-content:space-between;gap:8px;opacity:.75">
              <span><span class="mono" style="color:var(--text-muted);font-weight:700">${m.code}</span> ${esc(m.name)}</span>
              <button class="btn-ghost" style="width:auto;padding:4px 10px;font-size:12px;font-weight:600" onclick="restoreMachine('${escJs(m.code)}')" title="Geri getir">Geri getir</button>
            </div>`).join('')}</div>`;
        })()}`;
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
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;max-width:640px">Her yönetici/şef hesabı için, menüdeki ana öğelerden hangilerini görebileceğini AYRI AYRI belirle (ör. "LV sadece Rapor ve Canlı Panel · Makine Matrisi'ni görsün" gibi). Canlı Panel'in üç sekmesinin (Genel Bakış / Makine Matrisi / Tamamlanan Kodlar) ayrı ayrı kutusu var: üçünü de kapatırsan Canlı Panel sol menüde hiç görünmez, birini açık bırakırsan kullanıcı ekrana girer ve yalnızca o sekmeyi görür. Ayrıca "${ico('alert',13)} Uzun Duruş Uyarısı" kutusuyla, üst bardaki uzun süredir duruşta olan işleri gösteren uyarı ikonunu kimin görebileceğini de ayrı ayrı kapatıp açabilirsin. SuperAdmin bu ayardan hiç etkilenmez, her zaman hepsini görür. Bir kullanıcı için hiçbir kutuyu kapatmazsan, o kullanıcı varsayılan olarak tüm sekmeleri/uyarıları görür.</div>
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
              ${(adminTabPermissions[code]?.['takimStok'])!==false ? `
              <div style="width:100%;display:flex;flex-wrap:wrap;gap:10px;padding:8px 0 0 10px;border-left:1px solid var(--border);margin-left:1px">
                <span style="font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;width:100%">Takım Stok — alt sekmeler</span>
                ${TAKIM_STOK_SUBTAB_DEFS.map(v=>`
                  <label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-muted);cursor:pointer">
                    <input type="checkbox" style="width:auto" ${(adminTabPermissions[code]?.takimStokViews?.[v.key])!==false?'checked':''} onchange="setTakimStokSubTabPermission('${code}','${v.key}', this.checked)"> ${esc(v.label)}
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
            : pushPermissionState==='denied' ? `<div style="color:var(--danger);font-size:12.5px;margin-bottom:8px">${esc(pushBlockedInstructions())}</div><button class="btn-ghost" style="font-size:11.5px;padding:6px 12px" onclick="enablePushNotifications()">🔄 Ayarı değiştirdim, tekrar dene</button>`
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
          <div class="field"><label>Başlık (opsiyonel)</label><input id="mpush-title" placeholder="Atölye İş Takip"></div>
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
    } else if(settingsSubTab==='takimStok'){
      body += renderToolStokAdminSettings();
    } else if(settingsSubTab==='karbur'){
      body += renderKarburAdminSettings();
    } else if(settingsSubTab==='stok'){
      body += renderMalzemeStokAyarlar();
    }
    body += `</div>`;
  } else if(view==='operatorler'){
    body = renderOperatorler();
  } else if(view==='excelYukleme'){
    body = renderExcelYukleme();
  } else if(view==='genelBakis'){
    body = renderGenelBakis();
  } else if(view==='matrix'){
    body = renderMakineMatrisi();
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
  } else if(view==='isYogunlugu'){
    body = renderIsYogunlugu();
  } else if(view==='analiz'){
    const visibleAnalizViews = ANALIZ_VIEW_DEFS.filter(v=>isAnalizViewVisible(v.key));
    if(!visibleAnalizViews.some(v=>v.key===analizRole)){
      analizRole = visibleAnalizViews[0] ? visibleAnalizViews[0].key : analizRole;
    }
    /* Rol seçici GEZİNME, filtre değil — tasarım sisteminin kuralı gereği .chip yerine
       .sub-tabs/.sub-tab-btn kullanıyor (chip artık yalnızca filtre; bkz. Bileşen Kütüphanesi).
       Tahtada da bunlar sekme. Altındaki tarih ve atölye çipleri GERÇEKTEN filtre, chip kalıyor. */
    const analizRoleBar = `<div class="sub-tabs" style="flex-wrap:wrap">
      ${visibleAnalizViews.map(v=>`<button class="sub-tab-btn ${analizRole===v.key?'active':''}" onclick="setAnalizRole('${v.key}')">${esc(v.label)}</button>`).join('')}
    </div>`;
    if(visibleAnalizViews.length===0){
      body = `<div class="analiz-wrap"><div style="text-align:center;color:var(--text-muted);padding:60px 20px">Analiz sekmesindeki hiçbir görünüm için yetkin yok.</div></div>`;
    } else if(analizRole==='sef'){
      body = `<div class="analiz-wrap">${analizRoleBar}${renderAnalizSefLive()}</div>`;
    } else if(analizRole==='kisi'){
      body = `<div class="analiz-wrap">${analizRoleBar}${renderAnalizKisiBazli()}</div>`;
    } else if(analizRole==='operator'){
      body = `<div class="analiz-wrap">${analizRoleBar}${renderAnalizOperator()}</div>`;
    } else if(analizRole==='tadilat'){
      body = `<div class="analiz-wrap">${analizRoleBar}${renderAnalizTadilat()}</div>`;
    } else if(analizRole==='saha'){
      body = `<div class="analiz-wrap">${analizRoleBar}${renderAnalizSaha()}</div>`;
    } else {
    analizDonemiEsitle(); // Genel görünüm: dönem ortak seçiciden (bkz. ui/analiz-genel.js)
    const data = agVeri(analizFrom, analizTo, analizAtolyeFilter); // ortak önbellek (ui/analiz-genel.js) — tek slotlu computeAnalizData önbelleği önceki dönem çağrılarıyla takla atıyordu
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
      ${analizGenelUstHtml()}
      ${analizOzetHtml(t)}
      ${analizAyrimHtml()}
      ${analizBolumlerHtml()}
      ${agBolumBas('ag-verimlilik','Verimlilik & Duruş','makinelerin çalışma, duruş ve fazla mesaisi')}
      ${analizVerimlilikYorum(t, pareto, machineRank)}
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
      ${agBolumBas('ag-acik','Açık işler','şu an · dönemden bağımsız')}
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
            ${renderOperatorGunGunTablosu(op)}
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
      // Bekleme süresi kartın kapalı halinde de görünüyor: unutulmuş talep listeye
      // bakar bakmaz belli olsun diye (eskiden açılış tarihi sadece açınca görünüyordu).
      // MVP eşiği: 3 gün sarı, 7 gün kırmızı — mutlak süre, talebin aciliyetini ya da
      // atölye yükünü hesaba katmıyor (iyRenk ile aynı sınır).
      const bekMs = Math.max(0, Date.now() - (t.olusturmaTs || Date.now()));
      const bekRenk = bekMs >= 7*86400000 ? 'var(--danger)' : bekMs >= 3*86400000 ? 'var(--warn)' : 'var(--text-muted)';
      return `<div class="completed-card" style="cursor:pointer;border-left-color:${bekRenk}" onclick="toggleTadilatExpand('${t.id}')">
        <div class="completed-header">
          <span class="completed-id mono" style="color:var(--warn)">${ico('hourglass',13)} ${esc(t.uKodu)}${tadilatKisaLabel(t)?` <span style="color:var(--text-muted);font-weight:400;font-size:.75em">${esc(tadilatKisaLabel(t))}</span>`:''}</span>
          <span style="display:flex;align-items:center;gap:8px">
            <span class="matrix-tag" style="--sb:${bekRenk}">${fmtBekleme(bekMs)} bekliyor</span>
            <span class="completed-meta">${expanded?ico('chevronUp',12):ico('chevronDown',12)}</span>
          </span>
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
      <div class="tad-layout">
        <div class="tad-form">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px">
            <div style="font-size:16px;font-weight:700">Yeni Tadilat Talebi</div>
            <div style="font-size:11.5px;color:var(--text-muted)"><span class="zorunlu">*</span> zorunlu</div>
          </div>

          <div class="tad-grup">
            <div class="tad-ust-satir" style="display:flex;gap:10px;flex-wrap:wrap">
              <div class="field" style="width:200px;flex:none">
                <label for="tad-ukodu">U kodu<span class="zorunlu">*</span></label>
                <div style="display:flex;gap:8px">
                  <input id="tad-ukodu" class="mono" placeholder="ör. U-8841-M10" value="${esc(newTadilatForm.uKodu)}" oninput="newTadilatForm.uKodu=this.value" onblur="tadUkoduBlur('new')" style="flex:1;min-width:0">
                  <button type="button" class="btn-ghost" style="padding:0 14px;flex:none" title="Malzeme Ara" onclick="openMalzemeArama('new')">${ico('search',14)}</button>
                </div>
                ${String(newTadilatForm.uKodu||'').trim() && !tadilatKoduGercekMi(newTadilatForm.uKodu) ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">Kod listesinde yok — <b>kodsuz parça</b> olarak sayılır. Kodu varsa ${ico('search',11)} ile ara.</div>` : ''}
              </div>
            <div class="field" style="flex:1;min-width:0">
              <label for="tad-kisaaciklama">Kısa açıklama<span class="zorunlu">*</span></label>
              <input id="tad-kisaaciklama" placeholder="listede görünecek tek satır" value="${esc(newTadilatForm.kisaAciklama)}" oninput="newTadilatForm.kisaAciklama=this.value; newTadilatForm.aciklamaManual=true">
            </div>
              <div class="field" style="width:96px;flex:none">
                <label for="tad-adet">Adet<span class="zorunlu">*</span></label>
                <input id="tad-adet" inputmode="numeric" placeholder="0" value="${esc(newTadilatForm.adet)}" oninput="this.value=this.value.replace(/\\D/g,''); newTadilatForm.adet=this.value">
              </div>
            </div>
            ${tadilatOnHazirIstekListesi().length>0 ? `
            <div class="tad-sablon-kutu" style="background:var(--panel-alt);border:1px solid var(--border);border-radius:10px;padding:8px 10px;margin-bottom:8px">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px">
                ${tadilatOnHazirIstekListesi().map(p=>{
                  const sel = tadPresetSelections[p.id] || {checked:false, value:''};
                  return `<label style="display:flex;align-items:center;gap:5px;padding:3px 0;cursor:pointer;font-size:12px;text-transform:none;letter-spacing:0;color:var(--text);font-weight:400">
                    <input type="checkbox" style="width:auto;flex-shrink:0;transform:scale(.85)" ${sel.checked?'checked':''} onchange="toggleTadPreset('${p.id}')">
                    <span>${esc(p.hasParam ? p.text.split('{x}')[0] : p.text)}</span>
                    ${p.hasParam ? `<input type="text" inputmode="decimal" placeholder="x" value="${esc(sel.value||'')}" oninput="setTadPresetValue('${p.id}', this.value)" style="width:34px;flex-shrink:0;padding:2px 4px;font-size:12px;display:inline-block">
                    <span style="flex-shrink:0">${esc(p.text.split('{x}')[1]||'')}</span>` : ''}
                  </label>`;
                }).join('')}
              </div>
            </div>` : ''}
            <div class="field">
              <label for="tad-aciklama">Ne işlem yapılacak?<span class="zorunlu">*</span></label>
              <textarea id="tad-aciklama" placeholder="yapılacak işi tarif et" oninput="newTadilatForm.aciklama=this.value" style="min-height:48px">${esc(newTadilatForm.aciklama)}</textarea>
            </div>
          </div>

          <div class="tad-grup">
            <div style="display:flex;gap:10px">
            <div class="field" style="flex:1;min-width:0">
              <label for="tad-bolum">Talep eden bölüm<span class="zorunlu">*</span></label>
              <select id="tad-bolum" onchange="newTadilatForm.bolum=this.value; render()">${tadilatBolumSecenekleriHtml(newTadilatForm.bolum)}</select>
            </div>
            <div class="field" style="flex:1;min-width:0">
              <label for="tad-kisi">Talep eden kişi<span class="zorunlu">*</span></label>
              <input id="tad-kisi" list="uretim-personeli-options" placeholder="ad soyad" value="${esc(newTadilatForm.talepKisi)}" oninput="newTadilatForm.talepKisi=this.value">
            </div>
            </div>
            <datalist id="uretim-personeli-options">${uretimPersoneliFor(newTadilatForm.bolum).map(p=>`<option value="${esc(p)}">`).join('')}</datalist>
          </div>

          <div class="tad-grup">
            <div style="display:flex;gap:10px;align-items:flex-end">
            <div class="field" style="flex:1;min-width:0">
              <label for="tad-makine">Talep edilen makine<span class="zorunlu">*</span></label>
              <input id="tad-makine" list="tadilat-makine-options" placeholder="makine kodu" value="${esc(newTadilatForm.talepMakine)}" oninput="newTadilatForm.talepMakine=this.value">
            </div>
            <datalist id="tadilat-makine-options">${isMerkezleriFor(newTadilatForm.bolum).map(k=>`<option value="${esc(k)}">`).join('')}</datalist>
            ${myAtolyelerAdmin.length>1 ? `
            <div class="field" style="flex:1;min-width:0">
              <label for="tad-atolye">Atölye</label>
              <select id="tad-atolye" onchange="tadilatFormAtolyeSet(this.value)">
                ${myAtolyelerAdmin.includes('imalat') ? `<option value="imalat" ${tadilatFormAtolyeGet()==='imalat'?'selected':''}>İmalat Atölye</option>` : ''}
                ${myAtolyelerAdmin.includes('tadilat') ? `<option value="tadilat" ${tadilatFormAtolyeGet()==='tadilat'?'selected':''}>Tadilat Atölye</option>` : ''}
              </select>
            </div>` : `
            <input type="hidden" id="tad-atolye" value="${myAtolyelerAdmin[0]}">
            <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px">Atölye: ${myAtolyelerAdmin[0]==='tadilat'?(ico('wrench',14)+' Tadilat Atölye'):(ico('factory',14)+' İmalat Atölye')} <span style="opacity:.7">(tek atölyene açılıyor)</span></div>`}
          </div>
          </div>
          <button class="btn-primary" style="width:100%;padding:11px 0;font-size:14.5px" onclick="addTadilat()">+ Talep Oluştur</button>
        </div>
        <div style="padding-right:4px">
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
  } else if(view==='stokYonetim' && stokErisimVar()){
    body = renderStokScreen();
  } else {
    const entries = entriesArray();
    const statOperator = new Set(entries.map(e=>e.operatorUsername)).size;
    const statMakine = new Set(entries.map(e=>e.makine)).size;
    const fe = filteredEntries();
    /* Sayfalama: tablo yalnizca bu sayfanin kayitlarini ciziyor. Istatistikler, "Excel'e Aktar
       (N)" sayaci ve disa aktarim (filteredEntriesForExport) yine SUZULEN TUM kayitlar uzerinden
       — sayfalama yalnizca gorunum. "Tumunu sec" artik SAYFADAKI kayitlari kapsiyor: 30 satir
       gorunurken binlerce kaydi secip toplu silmek tehlikeli bir surpriz olurdu (makine
       detayindaki kararla ayni). Durum ve gerekce: js/tadilat.js RAPOR_SAYFA_BOYUT. */
    const raporImza = JSON.stringify([reportFilter, [...reportOperatorFilter].sort(), [...reportMakineFilter].sort()]);
    if(raporImza !== raporSonImza){ raporSonImza = raporImza; raporSayfa = 1; }
    const raporToplamSayfa = Math.max(1, Math.ceil(fe.length / RAPOR_SAYFA_BOYUT));
    raporSayfa = Math.min(Math.max(1, raporSayfa), raporToplamSayfa);
    const feSayfa = fe.slice((raporSayfa-1)*RAPOR_SAYFA_BOYUT, raporSayfa*RAPOR_SAYFA_BOYUT);
    const raporAralik = fe.length > RAPOR_SAYFA_BOYUT
      ? `<div class="rapor-tablo-bas" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:4px 0 10px">
          <span class="modal-pager-bilgi" style="margin-left:0">${(raporSayfa-1)*RAPOR_SAYFA_BOYUT+1}–${Math.min(raporSayfa*RAPOR_SAYFA_BOYUT, fe.length)} / ${fe.length} kayıt</span>
          <div style="margin-top:8px">${modalSayfaSeridi(raporSayfa, raporToplamSayfa, 'raporSayfaGit')}</div>
        </div>`
      : '<div class="rapor-tablo-bas"></div>';
    reportVisibleIds = feSayfa.map(e=>e.id);
    const raporTadilatSay = raporTadilatDisaAktarimSayisi(); // Excel sayacı: dosyaya giren tadilat satırları
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
        <button class="btn-primary" style="width:auto;margin-left:auto;padding:8px 16px" onclick="exportExcel()" title="${raporTadilatSay>0 ? `Tablodaki ${fe.length} kayıt + ${raporTadilatSay} tadilat operasyonu` : `Tablodaki ${fe.length} kayıt`}">⬇ Excel'e Aktar (${fe.length + raporTadilatSay})</button>
      </div>
      ${raporAralik}
      <div class="table-wrap"><table><thead><tr>
        ${canDeleteReport() ? `<th style="width:26px"><input type="checkbox" title="Bu sayfadaki kayıtları seç" ${reportVisibleIds.length>0 && reportVisibleIds.every(id=>reportSelectedIds.has(id))?'checked':''} onchange="toggleReportSelectAll()"></th>` : ''}
        ${["İş Emri No (U kodu)","İş Talep No","Operasyon No","Malzeme Adı","Malzeme Cinsi","Çap ve Boy","Adet","Makine","Operatör","Başlangıç","Bitiş","Süre","Durum","Not"].map(h=>`<th>${h}</th>`).join('')}
        ${canEditReport() ? `<th style="width:36px"></th>` : ''}
        ${canDeleteReport() ? `<th style="width:36px"></th>` : ''}
      </tr></thead><tbody>`;
    // DÜZELTME: canDeleteReport() İKİ ayrı <th> ekliyor (baştaki seçim kutusu + sondaki sil
    // sütunu), burada bir kez sayılıyordu — "kayıt yok" satırı bir sütun eksik kalıyordu.
    const reportColCount = 14 + (canDeleteReport()?2:0) + (canEditReport()?1:0);
    if(fe.length===0){ body += `<tr><td colspan="${reportColCount}" style="text-align:center;color:var(--text-muted);padding:30px">Filtreyle eşleşen kayıt yok.</td></tr>`; }
    feSayfa.forEach(e=>{
      const isDone = completedRoutes.has(e.id);
      const statusColor = isDone ? 'var(--success-text)' : e.status==='devam'?'var(--accent)':e.status==='duruş'?'var(--warn-text)':'var(--success-text)';
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
    body += `</tbody></table></div><div class="rapor-alt-serit">${modalSayfaSeridi(raporSayfa, raporToplamSayfa, 'raporSayfaGit').replace('class="modal-pager"','class="modal-pager" style="margin:12px 0 8px"')}</div>${entryDetailId ? renderEntryDetailModal() : ''}`;
  }

  /* Canlı Panel'in üç sekmesi tek ekranın içinde: gövdenin başına sekme şeridi ve (varsa) tek
     seferlik giriş ipucu eklenir. Sekmeye tıklamak setView → render, yani morph'u TETİKLEMESİ
     gerekiyor; bu yüzden #bubble-root gibi morph'a rağmen yaşayan bir kök kullanılmıyor. */
  if(isCanliPanelView(view)) body = introHintHtml() + canliPanelTabsHtml() + body;

  return `<div class="root-wide theme-${resolvedTheme()}">${sidebar}<div class="admin-shell-body"><div class="print-brand">ROTA TAKİP · YÖNETİCİ RAPORU</div>${header}${body}</div>${adminAltBarHtml(navOgeleri)}${adminMenuHtml(navOgeleri, kisiHtml)}${machineModal ? renderMachineModal() : ''}${tadilatEditId ? renderTadilatEditModal() : ''}${malzemeAramaOpen ? renderMalzemeAramaModal() : ''}${reportEditId ? renderReportEditModal() : ''}${tadilatRowEditId ? renderTadilatRowEditModal() : ''}${machineAccessModalCode ? renderMachineAccessModal() : ''}${resimAramaOpen ? renderResimAramaModal() : ''}${tadilatAkisModalId ? renderTadilatAkisModal() : ''}${karburPickerFor ? renderKarburPicker() : ''}${renderStokListeModal()}${stokDuzeltRowId ? renderStokDuzeltModal() : ''}</div>`;
}
function setReportFilterFieldLight(field, val){ reportFilter[field]=val; renderTableOnly(); }
function renderTableOnly(){ render(); } // basit yaklaşım: filtre değişince tam yeniden çizim yeterli hızda çalışır

