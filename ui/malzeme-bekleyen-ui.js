/* ===================== MALZEME BEKLEYENLER — EKRAN (29.09.2026) =====================
   Onaylanan maketin (maket-malzeme.html) kodu. Gruplama HAMMADDEYE göre, iş emrine göre
   değil: kritik an malzemenin geldiği an ve o anda sorulan soru "bu çapı kim bekliyordu".

   Yeni desen icat edilmedi — KPI şeridi .stok-genel-kpi/.sgk-card, sekmeler .sub-tab-btn,
   rozetler .matrix-tag, uyarı .notice, modal .modal-overlay/.modal-box. */

let mbYeniAcik = false;
let mbForm = { girilen:'', talepNo:'', mamulKodu:'', mamulAdi:'', ieMiktar:'', hammaddeId:'', gerekenMiktar:'', busy:false, bulundu:null };
let mbIstekDuzenId = null, mbIstekDeger = '';
let mbGecmisAcik = false;
let mbHamAra = '';

function mbYeniAc(){
  if(!canManageStock()){ toast('Bu işlem için Şef ya da SuperAdmin yetkisi gerekli'); return; }
  mbYeniAcik = true; mbHamAra = '';
  mbForm = { girilen:'', talepNo:'', mamulKodu:'', mamulAdi:'', ieMiktar:'', hammaddeId:'', gerekenMiktar:'', busy:false, bulundu:null };
  render();
}
function mbYeniKapat(){ mbYeniAcik = false; render(); }
function mbGecmisToggle(){ mbGecmisAcik = !mbGecmisAcik; render(); }

/* İş emri / talep no girilince ERP listesinden mamul, varsa reçeteden hammadde ve miktar
   OTOMATİK doluyor. Şefin elle yazacağı tek şey, reçetesi olmayan mamulde hammadde seçimi. */
function mbKodAra(){
  const b = isEmriBilgisiBul(mbForm.girilen);
  mbForm.bulundu = !!b;
  if(b){
    mbForm.talepNo = b.talepNo; mbForm.mamulKodu = b.mamulKodu; mbForm.mamulAdi = b.mamulAdi;
    if(b.ieMiktar>0 && !mbForm.ieMiktar) mbForm.ieMiktar = String(b.ieMiktar);
    const r = receteOku(b.mamulKodu);
    if(r){
      if(!mbForm.hammaddeId) mbForm.hammaddeId = r.hammaddeId||'';
      const adet = Number(mbForm.ieMiktar)||0;
      if(!mbForm.gerekenMiktar && r.birimBasina>0 && adet>0){
        mbForm.gerekenMiktar = String(Math.round(r.birimBasina*adet*100)/100);
      }
    }
  } else {
    mbForm.talepNo=''; mbForm.mamulKodu=''; mbForm.mamulAdi='';
  }
  render();
}
/* QR (30.09.2026): iş kağıdındaki QR iş emri alanına, malzeme etiketindeki QR hammadde
   seçimine gidiyor. Kalem eşleşmesi stockOptionByScanCode ile aynı kural (CANİAS kodu, yoksa
   kod) ama çubuk (lot) değil KALEM seçiliyor — bekleyen kayıt kaleme bağlı. Birden fazla kalem
   eşleşirse (aynı kodun farklı çapları) tahmin edilmiyor, şef listeden seçiyor. */
function mbIsEmriQr(){
  openQrScanner(function(v){ mbForm.girilen = String(v||'').trim(); mbKodAra(); });
}
function mbHammaddeQr(){
  openQrScanner(function(kod){
    kod = String(kod||'').trim().toUpperCase();
    const eslesen = Object.entries(stockItems||{}).filter(([id,it])=>{
      const canias = malzemeCaniasFromIsim(it && it.isim);
      return canias ? canias===kod : String((it && it.kod)||'').trim().toUpperCase()===kod;
    });
    if(eslesen.length===1){ toast('Seçildi: '+hammaddeEtiket(eslesen[0][1])); mbFormYaz('hammaddeId', eslesen[0][0]); }
    else { toast(eslesen.length>1 ? `"${kod}" için ${eslesen.length} kalem eşleşti — listeden elle seçin` : `"${kod}" ile eşleşen hammadde bulunamadı`); render(); }
  });
}
/* Açılır liste ve sonuç satırı metni — operatör formuyla ortak (hammaddeGosterimAdi, js/catalog.js). */
function mbSecenekMetni(it){ return hammaddeGosterimAdi(it); }
function mbHamSec(id){ mbHamAra = ''; mbFormYaz('hammaddeId', id); }
function mbFormYaz(alan, deger){
  mbForm[alan] = deger;
  /* İ.E. miktarı değişince reçeteden gelen oranla gereken yeniden hesaplanıyor —
     şef adet düzeltince miktarı elle çarpmasın. */
  if(alan==='ieMiktar' && mbForm.mamulKodu){
    const r = receteOku(mbForm.mamulKodu);
    const adet = Number(deger)||0;
    if(r && r.birimBasina>0 && adet>0) mbForm.gerekenMiktar = String(Math.round(r.birimBasina*adet*100)/100);
  }
  render();
}
function mbKaydet(){
  if(mbForm.busy) return;
  const kod = String(mbForm.girilen||'').trim().toUpperCase();
  if(!kod){ toast('İş emri ya da talep numarası girin'); return; }
  if(!mbForm.hammaddeId){ toast('Hangi hammaddenin beklendiğini seçin'); return; }
  const gereken = Number(mbForm.gerekenMiktar);
  if(!isFinite(gereken) || gereken<=0){ toast('Gereken miktarı girin'); return; }
  const it = (stockItems||{})[mbForm.hammaddeId];
  mbForm.busy = true; render();
  malzemeBekleyenEkle({
    isEmriNo: mbForm.mamulKodu || kod, talepNo: mbForm.talepNo || kod,
    mamulKodu: mbForm.mamulKodu, mamulAdi: mbForm.mamulAdi,
    ieMiktar: Number(mbForm.ieMiktar)||0,
    hammaddeId: mbForm.hammaddeId, hammaddeKod: hammaddeEtiket(it),
    gerekenMiktar: gereken, birim: (it && it.birim) || 'adet'
  }, ()=>{ mbYeniAcik = false; });
}
function mbIstekAc(id, mevcut){
  if(!malzemeIstekNoYetkisi()){ toast('İstek numarasını yalnızca SuperAdmin girebilir'); return; }
  mbIstekDuzenId = id; mbIstekDeger = mevcut||''; render();
}
function mbIstekKapat(){ mbIstekDuzenId = null; render(); }
function mbIstekKaydet(){
  const id = mbIstekDuzenId; if(!id) return;
  mbIstekDuzenId = null;
  malzemeIstekNoKaydet(id, mbIstekDeger);
}

function mbBeklemeMetni(ts){
  const fark = Date.now() - (Number(ts)||Date.now());
  const dk = Math.floor(fark/60000);
  if(dk < 60) return { metin: dk+' dk', renk: 'var(--text-muted)' };
  const sa = Math.floor(dk/60);
  if(sa < 24) return { metin: sa+' sa', renk: 'var(--text-muted)' };
  const gun = Math.floor(sa/24);
  return { metin: gun+' gün', renk: gun>=7 ? 'var(--danger)' : gun>=3 ? 'var(--warn)' : 'var(--text-muted)' };
}

function renderMalzemeBekleyen(){
  ensureMalzemeBekleyenLoaded(()=>safeRender());
  ensureHammaddeReceteLoaded(()=>safeRender());
  if(malzemeBekleyenError){
    return `<div class="settings-wrap"><div class="notice" style="--nc:var(--danger)">
      <div class="notice-title">Liste okunamadı</div><div class="notice-sub">${esc(malzemeBekleyenError)}</div></div></div>`;
  }
  if(!malzemeBekleyenReady){
    return `<div class="settings-wrap"><div style="color:var(--text-muted);font-size:12.5px;padding:18px 0">Yükleniyor…</div></div>`;
  }

  const aktif = malzemeBekleyenAktif();
  const items = stockItems || {};
  const istekYok = aktif.filter(x=>!String(x.caniasIstekNo||'').trim()).length;
  const haftaOnce = Date.now() - 7*86400000;
  const haftaKarsilanan = malzemeBekleyenArray().filter(x=>x.durum==='karsilandi' && (Number(x.karsilanmaTs)||0) >= haftaOnce);

  /* Gruplar hammadde bazında; içinde en uzun bekleyen üstte (aksiyon sırası budur). */
  const gruplar = {};
  aktif.forEach(x=>{ (gruplar[x.hammaddeId] = gruplar[x.hammaddeId] || []).push(x); });
  const grupListesi = Object.entries(gruplar).map(([hid, satirlar])=>{
    const it = items[hid];
    const stok = hammaddeStokSayi(it);
    const rezerve = satirlar.reduce((t,s)=>t+(Number(s.gerekenMiktar)||0), 0);
    return { hid, it, stok, rezerve, kullanilabilir: stok-rezerve,
      satirlar: satirlar.sort((a,b)=>(Number(a.isaretTs)||0)-(Number(b.isaretTs)||0)) };
  }).sort((a,b)=> a.kullanilabilir - b.kullanilabilir);

  /* "Eksik Kalem" (29.09.2026): eskiden burada "Rezerveli Kalem" vardı ve yalnızca grup
     sayısını (kaç farklı hammadde bekleniyor) gösteriyordu; adı da stoktan ayrılmış bir
     şeyi çağrıştırıyordu. Şimdi asıl soruyu cevaplıyor: stoğu bekleyenleri KARŞILAMAYAN
     kaç kalem var. Miktar TOPLANMIYOR — kalemler farklı birimde (mm ve adet), toplam
     anlamsız olurdu; bu yüzden kalem sayılıyor. Kalemi silinmiş grup sayılmıyor. */
  const eksikKalem = grupListesi.filter(g => g.it && g.kullanilabilir < 0).length;

  const kpi = (ikon, sayi, etiket, alt, uyari) => `
    <div class="sgk-card ${uyari?'uyari':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span style="width:24px;height:24px;border-radius:7px;background:color-mix(in srgb,currentColor 15%,transparent);display:flex;align-items:center;justify-content:center;flex:none">${ico(ikon,16)}</span>
        ${uyari?`<span class="matrix-tag" style="--sb:var(--panel)">SENDE</span>`:''}
      </div>
      <div style="margin-top:6px"><div class="sgk-num">${sayi}</div><div class="sgk-label">${esc(etiket)}</div>
      <div style="font-size:12px;margin-top:4px;color:${uyari?'inherit':'var(--text-subtle)'}">${esc(alt)}</div></div>
    </div>`;

  const basliklar = `<div class="mb-bas">
    <span>İş Emri</span><span>Mamul</span><span class="mb-sag">İ.E. Mik.</span><span class="mb-sag">Gereken</span>
    <span>İşaretleyen</span><span class="mb-sag">Bekleme</span><span class="mb-sag">İstek No</span></div>`;

  const grupHtml = grupListesi.map(g=>{
    const etiketMetin = g.it ? hammaddeEtiket(g.it) : '(kalem silinmiş)';
    const durum = !g.it ? { r:'var(--text-subtle)', t:'BİLİNMİYOR' }
      : g.stok <= 0 ? { r:'var(--danger)', t: g.stok<0 ? 'NEGATİF' : 'STOK YOK' }
      : g.kullanilabilir < 0 ? { r:'var(--warn)', t:'YETMİYOR' }
      : { r:'var(--success)', t:'STOKTA VAR' };
    const birim = (g.it && g.it.birim) || '';
    return `<div class="mb-grup">
      <div class="mb-grup-ust">
        <span class="mb-kod">${esc(etiketMetin)}</span>
        <span class="matrix-tag" style="--sb:${durum.r}">${durum.t}</span>
        <span class="mb-olcu">${g.it && g.it.isim ? esc(String(g.it.isim).slice(0,40))+' · ' : ''}Stok <b${g.stok<0?' style="color:var(--danger)"':''}>${g.stok} ${esc(birim)}</b> · Rezerve <b>${g.rezerve} ${esc(birim)}</b> · Kullanılabilir <b style="color:${g.kullanilabilir<0?'var(--danger)':'var(--success)'}">${g.kullanilabilir} ${esc(birim)}</b></span>
      </div>
      ${basliklar}
      ${g.satirlar.map(s=>{
        const bek = mbBeklemeMetni(s.isaretTs);
        const istek = String(s.caniasIstekNo||'').trim();
        return `<div class="mb-satir${istek?'':' mb-istek-yok'}">
          <span><span class="mb-ie">${esc(s.isEmriNo||'—')}</span><span class="mb-talep">${esc(s.talepNo||'')}</span></span>
          <span class="mb-mamul" title="${esc(s.mamulAdi||'')}">${esc(s.mamulAdi||'—')}</span>
          <span class="mb-sag">${s.ieMiktar||'—'}</span>
          <span class="mb-sag">${s.gerekenMiktar} ${esc(s.birim||'')}</span>
          <span style="color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(operatorGosterimAdi({operatorName:s.isaretleyenName, operatorUsername:s.isaretleyenUsername}))}</span>
          <span class="mb-sag" style="color:${bek.renk}">${bek.metin}</span>
          <span class="mb-sag">${istek
            ? `<button class="btn-ghost mb-mini" style="color:var(--success);border-color:transparent" onclick="mbIstekAc('${escJs(s.id)}','${escJs(istek)}')">${esc(istek)}</button>`
            : (malzemeIstekNoYetkisi()
                ? `<button class="btn-ghost mb-mini" style="color:var(--warn);border-color:var(--warn)" onclick="mbIstekAc('${escJs(s.id)}','')">no gir</button>`
                : `<span style="color:var(--warn);font-size:11px">bekliyor</span>`)}</span>
          <span class="mb-eylem">
            ${canManageStock()?`<button class="btn-ghost mb-mini" title="Malzemesi geldi, bekleme bitti" onclick="malzemeBekleyenKarsila('${escJs(s.id)}')">Karşılandı</button>
            <button class="del-btn" title="Kaydı sil" onclick="malzemeBekleyenSil('${escJs(s.id)}')">${ico('trash',13)}</button>`:''}
          </span>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');

  const gecmis = malzemeBekleyenArray().filter(x=>x.durum==='karsilandi')
    .sort((a,b)=>(Number(b.karsilanmaTs)||0)-(Number(a.karsilanmaTs)||0)).slice(0,20);

  return `<div class="settings-wrap" style="max-width:none">
    <div class="stok-genel-kpi" style="padding:0 0 16px;grid-template-columns:repeat(4,1fr)">
      ${kpi('clock', aktif.length, 'Bekleyen İş Emri', grupListesi.length+' farklı hammadde')}
      ${kpi('box', eksikKalem, 'Eksik Kalem', eksikKalem>0 ? 'stoğu bekleyenleri karşılamıyor' : aktif.length===0 ? 'bekleyen iş emri yok' : 'bekleyenlerin hepsi stoktan karşılanır')}
      ${kpi('alert', istekYok, 'İstek No Girilmemiş', 'şef işaretledi, CANIAS isteği bekliyor', istekYok>0)}
      ${kpi('check', haftaKarsilanan.length, 'Bu Hafta Karşılanan', 'son 7 gün')}
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      ${canManageStock()?`<button class="btn-primary" style="width:auto;padding:9px 16px" onclick="mbYeniAc()">+ Malzeme Bekliyor</button>`:''}
      <button class="btn-ghost" style="width:auto;padding:9px 14px" onclick="mbGecmisToggle()">${mbGecmisAcik?'Geçmişi gizle':'Karşılananlar'}</button>
    </div>

    ${aktif.length===0
      ? `<div class="notice" style="--nc:var(--success)"><div class="notice-title">Malzeme bekleyen iş emri yok</div>
         <div class="notice-sub">Şef malzemeliğe gidip aradığını bulamazsa buraya işaretler; iş emri o andan itibaren burada görünür.</div></div>`
      : grupHtml}

    ${mbGecmisAcik ? `<div class="sec-h" style="margin-top:20px">Karşılananlar <span class="ayar-deger mono" style="margin-left:8px">${gecmis.length}</span></div>
      <div class="sg-table-wrap"><table><thead><tr><th>İş Emri</th><th>Mamul</th><th>Hammadde</th><th>Gereken</th><th>İstek No</th><th>Bekledi</th><th>Karşılayan</th></tr></thead><tbody>
      ${gecmis.length===0?`<tr><td colspan="7" style="color:var(--text-muted);padding:14px">Henüz karşılanan kayıt yok.</td></tr>`:gecmis.map(s=>{
        const sure = (Number(s.karsilanmaTs)||0) - (Number(s.isaretTs)||0);
        const gun = Math.max(0, Math.round(sure/86400000));
        return `<tr><td class="mono">${esc(s.isEmriNo||'—')}</td><td>${esc(s.mamulAdi||'—')}</td>
          <td class="mono">${esc(s.hammaddeKod||'—')}</td><td class="mono">${s.gerekenMiktar} ${esc(s.birim||'')}</td>
          <td class="mono">${esc(s.caniasIstekNo||'—')}</td><td>${gun} gün</td>
          <td style="color:var(--text-muted)">${esc(s.karsilayanName||s.karsilayanUsername||'—')}</td></tr>`;
      }).join('')}
      </tbody></table></div>` : ''}

    <div class="notice" style="--nc:var(--accent);margin-top:16px">
      <div class="notice-title">Reçete kendiliğinden birikiyor</div>
      <div class="notice-sub">Şef bir mamul için hangi hammaddeyi seçtiyse kaydediliyor. Aynı mamul ikinci kez geldiğinde
      hammadde ve miktar hazır geliyor — ayrı bir reçete ekranı yok. Şu an <b>${Object.keys(hammaddeRecete||{}).length}</b> mamulün reçetesi var.</div>
    </div>
  </div>${renderMbYeniModal()}${renderMbIstekModal()}`;
}

function renderMbYeniModal(){
  if(!mbYeniAcik) return '';
  /* CANİAS listesi yüklendikten sonra (01.10.2026) burada ~370 kalem var. Şef arama
     kutusuna sistemin her yerdeki gibi yazar ("4140 25", "4140 Ø25", "b13 kalın", %joker%)
     ve altında çıkan satıra dokunur (hammaddeAra, js/catalog.js). Açılır liste göz atmak
     için tam hâliyle duruyor. */
  const items = Object.entries(stockItems||{}).map(([id,v])=>({id,...v}))
    .sort((a,b)=>String(a.kod||'').localeCompare(String(b.kod||''), 'tr', {numeric:true}) || String(a.cap||'').localeCompare(String(b.cap||''), 'tr', {numeric:true}));
  const sonuclar = mbHamAra.trim() ? hammaddeAra(items, mbHamAra) : null;
  const secili = mbForm.hammaddeId ? (stockItems||{})[mbForm.hammaddeId] : null;
  const stok = secili ? hammaddeStokSayi(secili) : null;
  const rezerve = mbForm.hammaddeId ? malzemeRezerve(mbForm.hammaddeId) : 0;
  const receteVar = mbForm.mamulKodu ? receteOku(mbForm.mamulKodu) : null;
  return `<div class="modal-overlay" onclick="if(event.target===this)mbYeniKapat()">
    <div class="modal-box" style="max-width:560px;padding:20px">
      <div class="sec-h" style="margin-top:0">Malzeme bekliyor olarak işaretle</div>
      <div style="font-size:12px;color:var(--text-muted);margin:-6px 0 14px">Malzemelikte bulunamayan iş emri buraya işaretlenir; müdür CANIAS'ta isteği açınca numarasını girer.</div>

      <div class="field">
        <label for="mb-kod">İş Emri (U kodu) ya da İş Talep No</label>
        <div style="display:flex;gap:8px">
          <input id="mb-kod" style="flex:1" placeholder="ör. U0007150 veya 2607300022" value="${esc(mbForm.girilen)}"
            oninput="mbForm.girilen=this.value" onchange="mbKodAra()">
          <button class="btn-ghost" style="width:auto;padding:0 14px" title="QR Kod Okut" onclick="mbIsEmriQr()">${ico('camera',14)}</button>
          <button class="btn-ghost" style="width:auto;padding:0 14px" title="Ara" onclick="mbKodAra()">${ico('search',14)}</button>
        </div>
      </div>
      ${mbForm.bulundu===false ? `<div class="notice" style="--nc:var(--warn);margin:-4px 0 12px;padding:9px 12px">
        <div class="notice-sub">Bu kod iş emri listesinde bulunamadı. Yine de işaretleyebilirsin, mamul adı boş kalır.</div></div>` : ''}
      ${mbForm.mamulKodu ? `<div class="notice" style="--nc:var(--accent);margin:-4px 0 12px;padding:9px 12px">
        <div class="notice-sub"><b class="mono">${esc(mbForm.mamulKodu)}</b> · ${esc(mbForm.mamulAdi||'—')}
        ${receteVar?` <span style="color:var(--success)">· reçete bulundu (${receteVar.gozlemSayisi||1} gözlem)</span>`:''}</div></div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label for="mb-ie">İ.E. Miktarı</label>
          <input id="mb-ie" inputmode="numeric" placeholder="0" value="${esc(mbForm.ieMiktar)}"
            oninput="this.value=this.value.replace(/[^0-9.]/g,'')" onchange="mbFormYaz('ieMiktar',this.value)"></div>
        <div class="field"><label for="mb-gereken">Gereken Miktar</label>
          <input id="mb-gereken" inputmode="numeric" placeholder="0" value="${esc(mbForm.gerekenMiktar)}"
            oninput="this.value=this.value.replace(/[^0-9.]/g,''); mbForm.gerekenMiktar=this.value"></div>
      </div>

      <div class="field">
        <label for="mb-ham-ara">Beklenen Hammadde</label>
        <div style="display:flex;gap:8px;margin-bottom:6px">
          <input id="mb-ham-ara" style="flex:1;min-width:0;margin-bottom:0" placeholder="Yaz: 4140 25 · 2344 Ø80 · b13 kalın" value="${esc(mbHamAra)}"
            oninput="mbHamAra=this.value; render()">
          <button class="btn-ghost" style="width:auto;padding:0 14px;flex:none" title="Malzeme etiketindeki QR'ı okut" onclick="mbHammaddeQr()">${ico('camera',14)}</button>
        </div>
        ${sonuclar ? hammaddeSonucListesiHtml(sonuclar.slice(0,6).map(it=>({ metin: mbSecenekMetni(it), alt: 'Stok '+hammaddeStokSayi(it)+' '+(it.birim||''), onclick: `mbHamSec('${escJs(it.id)}')` })), sonuclar.length, { metin: mbHamAra, hedef:'mb' }) : ''}
        <select id="mb-ham" onchange="mbFormYaz('hammaddeId',this.value)">
          <option value="">— ya da listeden seç —</option>
          ${items.map(it=>`<option value="${escJs(it.id)}" ${mbForm.hammaddeId===it.id?'selected':''}>${esc(mbSecenekMetni(it))}</option>`).join('')}
        </select>
      </div>
      ${secili ? `<div style="font-size:12px;color:var(--text-muted);margin:-6px 0 12px">
        Stok <b style="color:${stok<=0?'var(--danger)':'var(--text)'}">${stok} ${esc(secili.birim||'')}</b> ·
        mevcut rezerve <b>${rezerve} ${esc(secili.birim||'')}</b></div>` : ''}

      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn-primary" style="flex:1" ${mbForm.busy?'disabled':''} onclick="mbKaydet()">${mbForm.busy?'Kaydediliyor…':'İşaretle'}</button>
        <button class="btn-ghost" onclick="mbYeniKapat()">Vazgeç</button>
      </div>
    </div></div>`;
}

function renderMbIstekModal(){
  if(!mbIstekDuzenId) return '';
  const k = malzemeBekleyen[mbIstekDuzenId]; if(!k) return '';
  return `<div class="modal-overlay" onclick="if(event.target===this)mbIstekKapat()">
    <div class="modal-box" style="max-width:400px;padding:20px">
      <div class="sec-h" style="margin-top:0">CANIAS istek numarası</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:3px">${esc(k.mamulAdi||k.isEmriNo||'—')}</div>
      <div class="mono" style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${esc(k.isEmriNo||'')} · ${esc(k.hammaddeKod||'')} ${k.gerekenMiktar} ${esc(k.birim||'')}</div>
      <div class="field">
        <label for="mb-istek">İstek No</label>
        <input id="mb-istek" placeholder="ör. 4711" value="${esc(mbIstekDeger)}" oninput="mbIstekDeger=this.value">
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn-primary" style="flex:1" onclick="mbIstekKaydet()">Kaydet</button>
        <button class="btn-ghost" onclick="mbIstekKapat()">Vazgeç</button>
      </div>
    </div></div>`;
}
