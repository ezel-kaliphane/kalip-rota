/* ============================================================================
   İŞ YOĞUNLUĞU — YENİ GÖRÜNÜMLER  (drop-in)
   ----------------------------------------------------------------------------
   ui/render-admin.js içindeki mevcut renderIsYogunlugu() fonksiyonunun (satır
   ~1062–1162) yerine bu dosyanın içeriği geçer. Mevcut tablo, "Liste"
   görünümünün içinde makine kartlarına dönüşüyor; sekmenin üstüne 4 görünümlü
   bir seçici geliyor:

     liste  → 2a  telefon: makine kartı + kapasite barı, dokun→detay
     ozet   → 2b  usta için az bilgi: en yoğun 5 makine
     hafta  → 2c  hafta × makine ısı haritası (kuyruğa giriş gününe göre)
     pano   → 2d  atölye TV panosu (ayrıca ?pano=1 ile tam ekran)

   Hiç yeni CSS gerekmiyor: yalnızca mevcut değişkenler (--bg/--panel/--panel-alt
   /--border/--text/--text-muted/--accent/--success/--warn/--danger) ve mevcut
   sınıflar (.matrix-wrap .analiz-chart-box .chip .mono) kullanılıyor.

   Kullanılan mevcut yardımcılar: bekleyenSonrakiOperasyonlar(), presBekleyenCiftleri(),
   bilesenOfCode(), esc(), escJs(), ico(), fmtDT(), dateKey(), isYogunluguAcikMakine,
   toggleIsYogunluguDetay() — yenisi eklenmedi.
   ========================================================================== */

/* --- 1) DURUM (js/tadilat.js içindeki isYogunluguAcikMakine'nin yanına) ----- */
let isYogunluguGorunum = (()=>{ try{ return localStorage.getItem('rota_iy_gorunum') || 'liste'; }catch(e){ return 'liste'; } })();
function setIsYogunluguGorunum(g){
  isYogunluguGorunum = g;
  try{ localStorage.setItem('rota_iy_gorunum', g); }catch(e){}
  render();
}
// Tam ekran pano modu: index.html?pano=1
function isYogunluguPanoMode(){
  try{ return new URLSearchParams(location.search).get('pano') === '1'; }catch(e){ return false; }
}

/* --- 2) VERİ — dört görünümün tamamı bu tek hesaptan besleniyor ------------- */
function iyVeri(){
  const bekleyenler = bekleyenSonrakiOperasyonlar();
  // _ZARF/_ELMAS + Press özel çift eşleştirmesi ayrı satırda (mevcut davranış korunuyor).
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

  return {
    rows,
    toplamIsEmri: digerBekleyenler.length + presCiftleri.length,
    toplamAdet: digerBekleyenler.reduce((s,e)=>s+(Number(e.adet)||0), 0),
    belirsizSayi: (byMakine['Belirsiz']?.isEmriler.length) || 0,
    hazirCiftSayisi: presCiftleri.filter(c=>c.ikisiDeHazir).length,
    doluMakine: rows.filter(r=>r.label!=='Belirsiz').length,
    enYuksek: Math.max(1, ...rows.map(r=>r.isEmriSayisi))
  };
}
const iyKod = l => String(l||'').split(' · ')[0];
const iyAd  = l => String(l||'').split(' · ').slice(1).join(' · ');
// Yoğunluk rengi — eşikler ekranda tek anlam taşısın diye dört görünümde de aynı.
const iyRenk = n => n>=5 ? 'var(--danger)' : n>=3 ? 'var(--accent)' : 'var(--success)';

/* --- 3) ORTAK PARÇALAR ----------------------------------------------------- */
function iyKpiHtml(v){
  const kpi = (label, value, color, sub) => `<div class="analiz-chart-box">
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;font-weight:600">${label}</div>
    <div class="mono" style="font-size:26px;font-weight:700;margin-top:8px;color:${color}">${value}</div>
    ${sub?`<div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">${sub}</div>`:''}
  </div>`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:14px">
    ${kpi('Bekleyen İş Emri', v.toplamIsEmri, 'var(--accent)', 'sıradaki operasyonu bekliyor')}
    ${kpi('Toplam Adet', v.toplamAdet, 'var(--success)', 'Press hariç — çift eşleşmesi adet toplamaz')}
    ${kpi('Dolu Makine Sayısı', v.doluMakine, 'var(--warn)', 'en az bir iş bekleyen makine')}
    ${kpi('Belirsiz', v.belirsizSayi, 'var(--danger)', 'sıradaki makinesi işaretlenmemiş')}
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
    if(bilgi.hazir) return `<span style="color:var(--success)">${label}: ${ico('check',12)} hazır</span>`;
    const durum = (bilgi.last.status==='devam'||bilgi.last.status==='duruş') ? 'işlemde' : 'bitmedi (son operasyon yok)';
    return `<span style="color:var(--warn)">${label}: bekleniyor (${durum})</span>`;
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

/* --- 4) GÖRÜNÜM: LİSTE (2a) — telefon öncelikli makine kartları ------------- */
function iyListeHtml(v){
  if(v.rows.length===0) return `<div class="analiz-chart-box" style="text-align:center;color:var(--text-muted);padding:28px 16px">Şu an sıradaki operasyonu bekleyen iş emri yok.</div>`;
  return `<div style="display:flex;flex-direction:column;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:10px;overflow:hidden">
    ${v.rows.map(r=>{
      const acik = isYogunluguAcikMakine===r.label;
      const belirsiz = r.label==='Belirsiz';
      const renk = belirsiz ? 'var(--danger)' : iyRenk(r.isEmriSayisi);
      return `<div style="background:var(--panel)">
        <div style="padding:11px 14px;cursor:pointer" onclick="toggleIsYogunluguDetay('${escJs(r.label)}')">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
            <div style="min-width:0">
              <div class="mono" style="font-size:12.5px;font-weight:600;color:${belirsiz?'var(--danger)':'var(--accent)'};white-space:nowrap">${esc(iyKod(r.label))}</div>
              <div style="font-size:11.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(iyAd(r.label) || (belirsiz?'sıradaki makinesi işaretlenmemiş':''))}</div>
            </div>
            <div style="display:flex;align-items:baseline;gap:7px;white-space:nowrap">
              <span class="mono" style="font-size:19px;font-weight:700">${r.isEmriSayisi}</span>
              <span class="mono" style="font-size:12px;color:var(--text-muted)">${r.isPres ? `/ ${v.hazirCiftSayisi} hazır` : `/ ${r.toplamAdet} adet`}</span>
              <span style="color:var(--text-muted)">${acik?ico('chevronUp',14):ico('chevronDown',14)}</span>
            </div>
          </div>
          <div style="margin-top:8px;height:5px;border-radius:3px;background:var(--panel-alt);overflow:hidden">
            <div style="height:100%;width:${Math.round(r.isEmriSayisi/v.enYuksek*100)}%;background:${renk}"></div>
          </div>
        </div>
        ${acik ? `<div style="background:var(--panel-alt);padding:4px 14px 12px">
          ${r.isPres ? iyPresDetayHtml(r) : r.isEmriler.map(e=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px;flex-wrap:wrap">
            <span class="mono" style="color:var(--accent);font-weight:600">${esc(e.talepNo||e.isEmriNo)}</span>
            <span style="color:var(--text-muted)">${esc(e.makine||'—')}</span>
            <span>Adet: ${esc(e.adet||'—')}</span>
            <span style="color:var(--text-muted)">${esc(e.operatorName||e.operatorUsername||'')}</span>
            <span style="color:var(--text-muted)">Bitiş: ${e.endTs?fmtDT(e.endTs):'—'}</span>
          </div>`).join('')}
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

/* --- 5) GÖRÜNÜM: ÖZET (2b) — atölye ustası, az bilgi ----------------------- */
function iyOzetHtml(v){
  const top = v.rows.filter(r=>r.label!=='Belirsiz').slice(0,5);
  const enCokAdet = v.rows.filter(r=>!r.isPres && r.label!=='Belirsiz').slice().sort((a,b)=>b.toplamAdet-a.toplamAdet)[0];
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
    ${satir(v.belirsizSayi, 'var(--danger)', 'var(--danger)1f', 'Belirsiz', 'sıradaki makinesi girilmemiş iş emri')}
    ${enCokAdet ? satir(enCokAdet.toplamAdet, 'var(--accent)', 'var(--accent-dim)', esc(enCokAdet.label), 'en çok adet bekleyen makine') : ''}
    ${bosMakine!=null ? satir(bosMakine, 'var(--text-muted)', 'var(--panel-alt)', 'Boşta makine', 'hiç bekleyen işi yok') : ''}
  </div>`;
}

/* --- 6) GÖRÜNÜM: HAFTA (2c) — makine × gün ısı haritası --------------------
   NOT: veride plan/termin tarihi yok. Bu yüzden gün ekseni "iş emrinin kuyruğa
   girdiği gün" = önceki operasyonun bitiş zamanı (e.endTs). Press çiftleri
   tarih taşımadığı için bu görünümün dışında. */
function iyHaftaHtml(v){
  const gunAdlari = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const pzt = new Date(bugun); pzt.setDate(pzt.getDate() - ((bugun.getDay()+6)%7));
  const gunler = Array.from({length:6}, (_,i)=>{ const d = new Date(pzt); d.setDate(d.getDate()+i); return d; });
  const sinir = gunler.map(d=>d.getTime());

  const satirlar = v.rows.filter(r=>!r.isPres).map(r=>{
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

/* --- 7) GÖRÜNÜM: PANO (2d) — atölye TV'si ---------------------------------
   Hem sekme içinde hem ?pano=1 ile tam ekran aynı fonksiyonu kullanıyor. */
function iyPanoHtml(v, tamEkran){
  const rows = v.rows;
  const yari = Math.ceil(rows.length/2);
  const kolon = (liste) => liste.map(r=>`
    <div style="display:grid;grid-template-columns:minmax(0,230px) 1fr 88px;align-items:center;gap:16px;padding:9px 0;border-top:1px solid var(--panel-alt)">
      <div style="display:flex;align-items:baseline;gap:9px;min-width:0">
        <span class="mono" style="flex:0 0 auto;font-size:17px;font-weight:700;color:${r.label==='Belirsiz'?'var(--danger)':'var(--accent)'};white-space:nowrap">${esc(iyKod(r.label))}</span>
        <span style="flex:1;min-width:0;font-size:14px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(iyAd(r.label))}</span>
      </div>
      <div style="height:16px;border-radius:4px;background:var(--panel);overflow:hidden"><div style="height:100%;width:${Math.round(r.isEmriSayisi/v.enYuksek*100)}%;background:${r.label==='Belirsiz'?'var(--danger)':iyRenk(r.isEmriSayisi)};border-radius:4px"></div></div>
      <div style="display:flex;align-items:baseline;justify-content:flex-end;gap:6px;white-space:nowrap">
        <span class="mono" style="font-size:22px;font-weight:700">${r.isEmriSayisi}</span>
        <span class="mono" style="font-size:14px;color:var(--text-muted)">/${r.isPres ? v.hazirCiftSayisi : r.toplamAdet}</span>
      </div>
    </div>`).join('');
  const kpiMini = (label, value, color) => `<div style="text-align:right"><div style="font-size:13px;font-weight:600;letter-spacing:.6px;color:var(--text-muted)">${label}</div><div class="mono" style="font-size:30px;font-weight:700;color:${color}">${value}</div></div>`;

  return `<div style="background:var(--bg);${tamEkran?'min-height:100vh;':'border:1px solid var(--border);border-radius:12px;'}overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:24px 30px 20px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:baseline;gap:18px">
        <span style="font-family:'Oswald',sans-serif;font-size:26px;font-weight:600;letter-spacing:2px">İŞ YOĞUNLUĞU</span>
        <span style="font-size:13px;color:var(--text-muted)">sıradaki makineye göre bekleyen iş emri</span>
      </div>
      <div style="display:flex;align-items:center;gap:28px;flex-wrap:wrap">
        ${kpiMini('BEKLEYEN İŞ EMRİ', v.toplamIsEmri, 'var(--accent)')}
        ${kpiMini('TOPLAM ADET', v.toplamAdet, 'var(--success)')}
        ${kpiMini('BELİRSİZ', v.belirsizSayi, 'var(--danger)')}
        <span class="mono" style="font-size:26px;font-weight:700">${fmtDT(Date.now()).split(' ').pop()}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(430px,1fr));gap:0 40px;padding:22px 30px 26px">
      <div>${kolon(rows.slice(0,yari))}</div>
      <div>${kolon(rows.slice(yari))}</div>
    </div>
    ${v.belirsizSayi>0 ? `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 30px;background:var(--panel);border-top:1px solid var(--border)">
      <span class="mono" style="padding:6px 12px;border-radius:6px;background:var(--danger);color:var(--on-warn);font-size:13px;font-weight:700;letter-spacing:.5px;white-space:nowrap">BELİRSİZ ${v.belirsizSayi}</span>
      <span style="font-size:14px;color:var(--text-muted)">sıradaki makinesi işaretlenmemiş — operatörler "Bitir" ekranında sonraki makineyi seçmiyor</span>
    </div>` : ''}
  </div>`;
}

/* --- 8) SEKME GÖVDESİ — renderIsYogunlugu()'nun yeni hâli ------------------ */
function renderIsYogunlugu(){
  const v = iyVeri();
  const govde = isYogunluguGorunum==='ozet'  ? iyOzetHtml(v)
              : isYogunluguGorunum==='hafta' ? iyHaftaHtml(v)
              : isYogunluguGorunum==='pano'  ? iyPanoHtml(v, false)
              : iyListeHtml(v);
  return `<div class="matrix-wrap">
    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px">Operatör bir operasyonu bitirirken işaretlediği sıradaki makineye göre — o konumda bekleyen iş emirleri. Press satırı özel: _Zarf/_Elmas çiftlerini talep no'ya göre eşleştirir, ikisi de bitmeden "preste bekliyor" saymaz. Biri o iş için gerçekten yeni bir kayıt açıp Başla'ya bastığında kuyruktan kendiliğinden düşer.</div>
    ${iyGorunumSecici()}
    ${iyKpiHtml(v)}
    ${govde}
  </div>`;
}

/* --- 9) TAM EKRAN PANO (?pano=1) ------------------------------------------
   js/app.js → render() içine, `if(!session){...}` satırından HEMEN SONRA:

     if(session.isAdmin && isYogunluguPanoMode()){
       paintApp(app, `<div class="root-mobile theme-${resolvedTheme()}">${iyPanoHtml(iyVeri(), true)}</div>`);
       return;
     }

   js/app.js → renderLiveBits() içine, en başa (saat ve sayılar canlı kalsın):

     if(session && session.isAdmin && isYogunluguPanoMode()){ render(); return; }
   ------------------------------------------------------------------------- */
