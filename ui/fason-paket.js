/* ==================== STOK TAKİBİ → ISIL İŞLEM: FASON PAKETLERİ (15.10.2026, kullanıcı isteği) ====================
   "Personel paket paket yolluyor (aynı tür + aynı sertlik), yanına iş emirlerini ve adetlerini yazıyor;
   ben ERP'de '42 ADET 3 KG 3343 61-63 HRC' diye satın alma isteği açıyorum. Malzeme siparişindeki
   gibi kopyala düğmesi olsun; tek tuşla kopyalayıp istek no'yu gireyim."
   Paket = FII01'e bir başlatma (tek ya da çoklu iş emri); bilgileri gönderimde girilir (js/fason-isil.js).
   İstek no: entries/{id}/fasonIstekNo (paketin tüm iş emirlerine). Kural değişikliği gerekmez. */
let fpIstekAcik = null, fpIstekDeger = '', fpDonenAcik = false;

function fasonPaketleri(){
  const sinir = Date.now() - 30 * 864e5;
  const p = {};
  entriesArray().forEach(e => {
    if(!(typeof fasonIsilMakinesiMi === 'function' && fasonIsilMakinesiMi(e.makine))) return;
    const acik = e.status === 'devam' || e.status === 'duruş';
    if(!acik && !((e.endTs || 0) >= sinir)) return;
    const k = (e.fasonPaket && e.fasonPaket.id) || e.groupId || e.id;
    (p[k] ||= { id: k, uyeler: [] }).uyeler.push(e);
  });
  return Object.values(p).map(x => {
    const ilk = x.uyeler.find(e => e.fasonPaket) || x.uyeler[0];
    const tur = ilk.fasonIsilTur ? (Array.isArray(ilk.fasonIsilTur) ? ilk.fasonIsilTur : Object.values(ilk.fasonIsilTur)) : [];
    return { ...x, uyeler: x.uyeler.sort((a, b) => String(a.talepNo || '').localeCompare(String(b.talepNo || ''))),
      tur, sertlik: ilk.fasonIsilSertlik || null, kg: ilk.fasonPaket ? Number(ilk.fasonPaket.kg) || null : null,
      ts: Math.min(...x.uyeler.map(e => e.startTs || Infinity)), gonderen: (ilk.fasonPaket && ilk.fasonPaket.gonderenAd) || ilk.operatorName || ilk.operatorUsername || '',
      adet: x.uyeler.reduce((t, e) => t + (Number(e.adet) || 0), 0),
      istekNo: (x.uyeler.find(e => e.fasonIstekNo) || {}).fasonIstekNo || '',
      acik: x.uyeler.some(e => e.status === 'devam' || e.status === 'duruş'),
      bilgili: !!(ilk.fasonPaket && tur.length) };
  }).sort((a, b) => b.ts - a.ts);
}
/* Mamul açıklaması: önce malzeme listesi (taban kod), yoksa iş emri listesindeki talep satırı */
function fpMamul(e){
  return (typeof usMamulAdi === 'function' ? usMamulAdi(e) : '') || (typeof getTalepInfo === 'function' && e.talepNo ? (getTalepInfo(e.talepNo) || {}).malzemeAdi : '') || '';
}
function fpTurKisa(tur){ return tur.map(t => String(t).replace(/\s*sertle[sş]tirme\s*$/i, '').trim().toLocaleUpperCase('tr-TR')).join(' + '); }
function fpKg(kg){ return kg == null ? '?' : String(Math.round(kg * 100) / 100).replace('.', ','); }
function fpSertlik(s){ return s && s.min != null ? (Number(s.max) > Number(s.min) ? s.min + '-' + s.max : String(s.min)) + ' HRC' : ''; }
/* ERP isteğine yapıştırılacak metin: ilk satır özet, altında iş emirleri */
function fpTaslakMetni(p){
  const ozet = `${p.adet} ADET ${fpKg(p.kg)} KG ${fpTurKisa(p.tur)} ${fpSertlik(p.sertlik)}`.replace(/\s+/g, ' ').trim();
  const satirlar = p.uyeler.map(e => {
    const mamul = fpMamul(e);
    return [e.talepNo || e.isEmriNo, mamul].filter(Boolean).join(' ') + ' - ' + (Number(e.adet) || 0) + ' ADET' + (Number(e.fasonKg) > 0 ? ' - ' + fpKg(Number(e.fasonKg)) + ' KG' : '');
  });
  /* 06.11.2026 (kullanıcı): özetten sonra boş satır, iş emirleri alt alta (CANIAS açıklamasında böyle okunuyor) */
  return ozet + '\n\n' + satirlar.join('\n');
}
function fpKopyala(id){
  const p = fasonPaketleri().find(x => x.id === id); if(!p) return;
  if(!p.bilgili){ toast('Önce paket bilgisini girin (tür, HRC, KG)'); return; }
  const metin = fpTaslakMetni(p);
  const tamam = () => toast('Kopyalandı — satın alma isteğine yapıştır');
  const yedek = () => {
    const t = document.createElement('textarea'); t.value = metin; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(t); t.select();
    let ok = false; try{ ok = document.execCommand('copy'); }catch(e){}
    document.body.removeChild(t);
    if(ok) tamam(); else window.prompt('Kopyalanamadı — buradan seçip kopyala:', metin);
  };
  if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(metin).then(tamam, yedek); else yedek();
}
function fpIstekAc(id, mevcut){
  fpIstekAcik = id; fpIstekDeger = mevcut || ''; render();
  setTimeout(() => { const el = document.getElementById('fp-istek-' + id); if(el){ el.focus(); el.select(); } }, 30);
}
function fpIstekKaydet(id){
  if(!(typeof malzemeIstekNoYetkisi === 'function' ? malzemeIstekNoYetkisi() : (session && session.isSuperAdmin))){ toast('İstek no\'yu SuperAdmin girer'); return; }
  const p = fasonPaketleri().find(x => x.id === id); if(!p) return;
  const no = String(fpIstekDeger || '').trim();
  const upd = {}; p.uyeler.forEach(e => { upd['entries/' + e.id + '/fasonIstekNo'] = no || null; });
  DB.ref().update(upd).then(() => { toast(no ? 'İstek no kaydedildi: ' + no : 'İstek no silindi'); fpIstekAcik = null; render(); })
    .catch(err => toast('Kaydedilemedi: ' + ((err && err.message) || 'hata')));
}

function fpKartHtml(p){
  const durum = !p.acik ? { r: 'var(--success)', t: 'DÖNDÜ' } : p.istekNo ? { r: 'var(--warn)', t: 'İSTEK AÇIK' } : { r: 'var(--danger)', t: 'İSTEK NO YOK' };
  const yetki = typeof malzemeIstekNoYetkisi === 'function' ? malzemeIstekNoYetkisi() : !!(session && session.isSuperAdmin);
  const istekAlani = fpIstekAcik === p.id
    ? `<span class="mb-satir-girdi"><label for="fp-istek-${esc(p.id)}">İstek no</label>
        <span class="mb-girdi-kutu"><input id="fp-istek-${esc(p.id)}" class="mono" style="text-align:left" placeholder="ör. 26100300" value="${esc(fpIstekDeger)}" oninput="fpIstekDeger=this.value" onkeydown="if(event.key==='Enter') fpIstekKaydet('${escJs(p.id)}'); if(event.key==='Escape'){ fpIstekAcik=null; render(); }"></span>
        <button class="btn-primary" onclick="fpIstekKaydet('${escJs(p.id)}')">Kaydet</button><button class="btn-ghost" onclick="fpIstekAcik=null; render()">Vazgeç</button></span>`
    : `${p.istekNo ? `<span class="mb-istek-no mono" style="font-weight:700">İstek ${esc(p.istekNo)}</span>` : ''}
       ${yetki ? `<button class="btn-ghost mb-mini" onclick="fpIstekAc('${escJs(p.id)}','${escJs(p.istekNo)}')">${p.istekNo ? 'Düzelt' : 'İstek no gir'}</button>` : ''}`;
  return `<div class="mb-grup acik" style="border-left:3px solid ${durum.r}">
    <div class="mb-grup-ust" style="cursor:default">
      <span class="mb-kod">${p.bilgili ? esc(fpTurKisa(p.tur) + ' · ' + fpSertlik(p.sertlik)) : 'Bilgi girilmemiş paket'}</span>
      <span class="matrix-tag" style="--sb:${durum.r}">${durum.t}</span>
      <span class="mb-olcu"><b>${p.adet} adet</b>${p.kg != null ? ` · <b>${fpKg(p.kg)} kg</b>` : ''} · ${p.uyeler.length} iş emri · ${fmtDT(p.ts)} · ${esc(p.gonderen)}</span>
      <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${p.bilgili ? `<button class="btn-ghost mb-mini" title="ERP satın alma isteğine yapıştırmak için" onclick="fpKopyala('${escJs(p.id)}')">${ico('copy', 13)} Taslağı kopyala</button>` : ''}
        ${canManageStock() ? `<button class="btn-ghost mb-mini" onclick="fasonIsilPaketBilgiAc(${esc(JSON.stringify(p.uyeler.map(e => e.id)))})">${p.bilgili ? 'Bilgiyi düzelt' : 'Bilgi gir'}</button>` : ''}
        ${istekAlani}
      </span>
    </div>
    ${p.uyeler.map(e => `<div class="mb-satir" style="grid-template-columns:minmax(0,1fr) minmax(0,2.4fr) auto auto">
      <span><span class="mb-ie">${esc(e.talepNo || e.isEmriNo || '—')}</span><span class="mb-talep">${esc(e.isEmriNo || '')}</span></span>
      <span class="mb-mamul">${esc(fpMamul(e) || '—')}</span>
      <span class="mb-sag"><b>${esc(e.adet || '?')}</b> adet${Number(e.fasonKg) > 0 ? ` · <b>${fpKg(Number(e.fasonKg))}</b> kg <span style="color:var(--text-muted)">(1 adet ${fpKg(Number(e.fasonKg) / (Number(e.adet) || 1))} kg)</span>` : ''}</span>
      <span class="mb-sag" style="color:var(--text-muted)">${e.status === 'tamamlandi' ? 'döndü ' + fmtDT(e.endTs).split(' ')[0] : 'fasonda'}</span>
    </div>`).join('')}
  </div>`;
}
function renderFasonPaketleri(){
  const l = fasonPaketleri();
  const acik = l.filter(p => p.acik), donen = l.filter(p => !p.acik);
  const istekYok = acik.filter(p => !p.istekNo).length, bilgisiz = acik.filter(p => !p.bilgili).length;
  let h = `<div class="settings-wrap" style="max-width:none">
    ${agYorum([
      acik.length ? `Fasonda <b>${acik.length}</b> ısıl işlem paketi var${istekYok ? `; <b style="color:var(--danger)">${istekYok}</b> tanesinin istek no'su girilmemiş` : ''}${bilgisiz ? `; ${bilgisiz} tanesi gönderilirken bilgisi girilmemiş (Bilgi gir)` : ''}.` : 'Fasonda bekleyen ısıl işlem paketi yok.',
      'Paket = FII01\'e bir başlatma. Tür, HRC ve KG gönderirken girilir; "Taslağı kopyala" satın alma isteğine yapıştırılacak metni verir.'
    ])}
    ${fpExcelDugmeHtml()}
    ${acik.map(fpKartHtml).join('')}
    ${donen.length ? `<button type="button" class="ag-detay-dugme" onclick="fpDonenAcik=!fpDonenAcik; render()">${ico(fpDonenAcik ? 'chevronUp' : 'chevronDown', 14)} ${fpDonenAcik ? 'Dönenleri gizle' : 'Son 30 günde dönenler (' + donen.length + ')'}</button>
      ${fpDonenAcik ? donen.map(fpKartHtml).join('') : ''}` : ''}
  </div>`;
  return h + (typeof fasonIsilModal !== 'undefined' && fasonIsilModal && fasonIsilModal.mod === 'paket' ? renderFasonIsilModal() : '');
}

/* ==================== EXCEL OLUŞTUR → CANIAS SATIN ALMA YÜKLEMESİ (06.11.2026, kullanıcı isteği) ====================
   "Masaüstündeki ŞABLON excele istek no yok olanları otomatik yapıştırsın." Şablon (sayfa XLSTBL):
   MALZEME O0000007 · ONCELIK 2 · MIKTAR 1 · IHTIYACTARIHI bugün+7 gün (gg.aa.yyyy metin) · SATINALMA 180 ·
   ACIKLAMA = "Taslağı kopyala" metni · BIRIM KG. Satırlar: fasonda olup istek no'su girilmemiş, bilgisi girilmiş
   paketler. Chrome/Edge'de ilk seferde ŞABLON.xlsx seçilir; dosya tanıtıcısı bu tarayıcıda saklanır, sonraki
   basışlarda aynı dosyanın üstüne yazılır. Destek yoksa ŞABLON.xlsx olarak indirilir. */
const FP_EXCEL_SABIT = { malzeme: 'O0000007', oncelik: 2, miktar: 1, satinalma: 180, birim: 'KG', gun: 7 };
function fpExcelPaketleri(){ return fasonPaketleri().filter(p => p.acik && !p.istekNo); }
function fpIhtiyacTarihi(simdi){
  const d = new Date((simdi || Date.now()) + FP_EXCEL_SABIT.gun * 864e5), iki = n => String(n).padStart(2, '0');
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`;
}
/* CANIAS tarihi METİN olarak okumuyor ("EXCEL 2 SATIRINDA HATA", 06.11.2026) — çalışan dosyada gerçek Excel tarihi
   (seri sayı + tarih biçimi) var. Yerel gün → Excel seri sayısı (1899-12-30 tabanı). */
function fpExcelTarih(simdi){
  const d = new Date((simdi || Date.now()) + FP_EXCEL_SABIT.gun * 864e5);
  return { t: 'n', v: Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 864e5), z: 'm/d/yy' }; // Excel yerleşik kısa tarih (numFmtId 14), çalışan dosyadaki gibi
}
function fpExcelSatirlari(paketler, simdi){
  const tarih = fpExcelTarih(simdi), s = FP_EXCEL_SABIT;
  return [['MALZEME', 'ONCELIK', 'MIKTAR', 'IHTIYACTARIHI', 'SATINALMA', 'ACIKLAMA', 'BIRIM']]
    .concat(paketler.map(p => [s.malzeme, s.oncelik, s.miktar, tarih, s.satinalma, fpTaslakMetni(p), s.birim]));
}
const FP_DOSYA_DB = 'kaliphane-dosya';
function fpDosyaDb(){
  return new Promise((ok, red) => {
    const r = indexedDB.open(FP_DOSYA_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('tanitici');
    r.onsuccess = () => ok(r.result); r.onerror = () => red(r.error);
  });
}
async function fpTaniticiOku(){
  try{ const db = await fpDosyaDb(); return await new Promise(ok => { const q = db.transaction('tanitici').objectStore('tanitici').get('sablon'); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); }catch(e){ return null; }
}
async function fpTaniticiYaz(h){
  try{ const db = await fpDosyaDb(); db.transaction('tanitici', 'readwrite').objectStore('tanitici').put(h, 'sablon'); }catch(e){}
}
/* Yazılacak dosyayı al: saklı tanıtıcı (izin isteyerek) ya da ilk seferde dosya seçtir. null = vazgeçti / destek yok */
async function fpSablonDosyasi(yeniSec){
  if(typeof window.showSaveFilePicker !== 'function') return null;
  if(!yeniSec){
    const h = await fpTaniticiOku();
    if(h){
      try{
        if((await h.queryPermission({ mode: 'readwrite' })) === 'granted' || (await h.requestPermission({ mode: 'readwrite' })) === 'granted') return h;
      }catch(e){}
    }
  }
  const h = await window.showSaveFilePicker({ suggestedName: 'ŞABLON.xlsx', startIn: 'desktop', id: 'fason-sablon',
    types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] });
  await fpTaniticiYaz(h);
  return h;
}
async function fpExcelOlustur(yeniSec){
  if(!(typeof malzemeIstekNoYetkisi === 'function' ? malzemeIstekNoYetkisi() : (session && session.isSuperAdmin))){ toast("Excel'i SuperAdmin oluşturur"); return; }
  const hepsi = fpExcelPaketleri(), paketler = hepsi.filter(p => p.bilgili), bilgisiz = hepsi.length - paketler.length;
  if(!paketler.length){ toast(hepsi.length ? "İstek no'su olmayan paketlerin bilgisi girilmemiş (Bilgi gir)" : "İstek no'su girilmemiş paket yok"); return; }
  /* Kütüphane sayfada önceden yükleniyor (fpExcelDugmeHtml); burada bekleme olursa tıklamanın izni (user activation)
     dosya penceresine kadar düşebiliyor — o yüzden ensureXLSX genelde anında döner. */
  if(!(await ensureXLSX())) return;
  const ws = XLSX.utils.aoa_to_sheet(fpExcelSatirlari(paketler));
  ws['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 7 }, { wch: 13 }, { wch: 10 }, { wch: 70 }, { wch: 6 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'XLSTBL');
  const ek = bilgisiz ? ` (${bilgisiz} paket bilgisi girilmediği için alınmadı)` : '';
  const indir = neden => { XLSX.writeFile(wb, 'ŞABLON.xlsx', { bookSST: true }); toast(`${neden ? neden + ' — ' : ''}ŞABLON.xlsx indirildi — ${paketler.length} satır${ek}`); };
  if(typeof window.showSaveFilePicker !== 'function'){ indir(''); return; }
  let dosya = null;
  try{ dosya = await fpSablonDosyasi(yeniSec); }
  catch(e){ if(e && e.name === 'AbortError') return; }
  if(!dosya){ indir('Dosya seçilemedi'); return; }
  try{
    const w = await dosya.createWritable();
    await w.write(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array', bookSST: true })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    await w.close();
    toast(`${dosya.name} güncellendi — ${paketler.length} satır${ek}`);
  }catch(e){
    /* 06.11.2026: "createWritable ... not allowed by the user agent or the platform" — tarayıcı/kurum politikası yazmayı
       reddediyor. Yarıda bırakma: indir. Excel'de açık dosyada (NoModificationAllowedError) da indir, ama söyle. */
    if(e && e.name === 'NotAllowedError') fpTaniticiYaz(null);
    indir(e && e.name === 'NoModificationAllowedError' ? `${dosya.name} Excel'de açık, üstüne yazılamadı` : 'Tarayıcı dosyaya yazmaya izin vermedi');
  }
}
function fpExcelDugmeHtml(){
  if(!(typeof malzemeIstekNoYetkisi === 'function' ? malzemeIstekNoYetkisi() : (session && session.isSuperAdmin))) return '';
  const n = fpExcelPaketleri().filter(p => p.bilgili).length;
  if(n && typeof XLSX === 'undefined' && typeof loadScriptOnce === 'function') loadScriptOnce(LAZY_LIB_URLS.xlsx).catch(() => {});
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px">
    <button class="btn-primary" ${n ? '' : 'disabled'} title="İstek no'su olmayan paketler CANIAS yükleme şablonuna yazılır" onclick="fpExcelOlustur(false)">${ico('file', 14)} Excel oluştur${n ? ` (${n})` : ''}</button>
    ${typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function' ? `<button class="btn-ghost mb-mini" title="Yazılacak ŞABLON dosyasını yeniden seç" onclick="fpExcelOlustur(true)">Dosyayı değiştir</button>` : ''}
    <span style="font-size:12px;color:var(--text-muted)">Malzeme ${FP_EXCEL_SABIT.malzeme} · öncelik ${FP_EXCEL_SABIT.oncelik} · miktar ${FP_EXCEL_SABIT.miktar} · ihtiyaç ${fpIhtiyacTarihi()} · satın alma ${FP_EXCEL_SABIT.satinalma} · ${FP_EXCEL_SABIT.birim}</span>
  </div>`;
}
