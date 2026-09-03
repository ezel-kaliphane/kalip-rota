/* ==================== TAKIM & SARF STOK MODÜLÜ — BAŞLANGIÇ ====================
   CNC atölyesindeki iki dolapta duran kesici takım/sarf malzemesi (elmas uç, freze,
   matkap/kılavuz, CBN, kater, piko...) stok takibi. Mevcut stockItems/stockHareketleri
   (hammadde) modülünden TAMAMEN AYRI — hiçbir node veya fonksiyon paylaşmaz.
   Tüm değişkenler/fonksiyonlar "tool" önekli, isim çakışması olmasın diye.

   AŞAMA 1: veri modeli + toolCatalogVersion cache mekanizması + Excel toplu yükleme +
   SuperAdmin kalem/konum yönetimi (+ toplu konum taşıma).
   AŞAMA 2 (bu ek blok): Operatör "🔧 Takım Dolabı" ekranı — arama + çıkış + transaction() +
   hareket kaydı + 10 dakikalık geri alma. QR okuma henüz YOK (Aşama 3), demirbaş/zimmet
   ayrımı henüz YOK (Aşama 5) — demirbas:true kalemler de şimdilik düz "Çıkış Yap" ile tüketiliyor.

   Firebase indirme maliyeti kuralı (bkz. görev talimatı §3): toolCatalog/toolStock/
   toolMoves/toolZimmet hiçbiri uygulama açılışında dinlenmiyor. Katalog sadece bu
   modülün ekranlarından biri açıldığında, versiyon uyuşmuyorsa .once('value') ile çekilip
   localStorage'a cache'leniyor. Stok adetleri her açılışta taze .once('value') ile çekiliyor.
   toolMoves ASLA toplu indirilmiyor — geri alma bile sadece bu oturumun kendi belleğinde
   tutulan son işleme (toolLastMove) bakıyor, Firebase'den okuma yapmıyor.

   Eşzamanlılık notu: Operatör çıkışı artık transaction() kullanıyor (bkz. doToolCikis) —
   vardiya başında birden fazla operatör aynı koddan alsa da stok kayması olmuyor. Stok
   negatife düşerse ENGELLENMİYOR, kaydediliyor ve UI'da kırmızı gösteriliyor (bkz. görev
   talimatı §4 — engelleme operatörü kayıt yapmamaya iter).
*/

/* ---------- state ---------- */
let toolLocations = {};        // toolLocations/{id} — sadece bu ekran açıkken .once() ile
let toolCatalog = {};          // toolCatalog/{id}   — statik katalog, localStorage cache'li
let toolStock = {};            // toolStock/{id}     — değişken stok adedi, cache'lenmez
let toolCatalogReady = false;
let toolStockReady = false;
let toolAdminSubView = 'liste';  // 'liste' | 'konumlar' | 'excel'
let toolExcelPreview = null;     // onay öncesi önizleme — {sheetName, rows, blankCount, dupCount}
let toolExcelUpdateStock = false;
let toolBulkSelected = {};       // {itemId: true} — Kalem Listesi'nde çoklu seçim (toplu konum taşıma için)
let toolBulkTargetLoc = '';
let toolListFilterKategori = '';
let toolListFilterLoc = '';      // '' = tümü, '__none__' = konumsuz
let toolListSearch = '';

/* SuperAdmin "Stok Girişi" (mal kabul) ekranı state'i — Kalem Listesi'ndeki büyük tabloyu
   scroll edip satır içi düzenlemek yerine, operatör çıkış ekranıyla aynı mantıkta kod ara/QR
   okut -> kalem gelsin -> adet+not gir -> kaydet akışı. Katalog zaten bu panelde (Kalem
   Listesi için) yüklü olduğundan burada AYRICA bir Firebase sorgusu YAPILMIYOR, toolCatalog
   bellek-içi taranıyor (itemId varsa aramaya gerek yok, ek okuma maliyeti sıfır). */
let toolGirisCode = '';
let toolGirisFoundId = null;
let toolGirisError = null;
let toolGirisQty = 1;
let toolGirisNote = '';          // sipariş no buraya yazılır
let toolGirisSiparisAcik = false;

/* Hareket Geçmişi (SuperAdmin/görünürlük izni olanlar) — toolMoves ASLA toplu indirilmiyor,
   sadece orderByChild('ts').limitToLast(50) ile sayfalanarak, ya da bir kalem/operatör
   filtresi seçilince o filtreye özel indeksli bir sorguyla (bkz. görev talimatı §3.4). */
let toolHistMoves = [];         // {id, itemId, canias, tip, miktar, ts, ...}[] — en yeni önce
let toolHistOldestTs = null;    // sayfalama imleci (ts filtresiz moddayken)
let toolHistHasMore = true;
let toolHistLoading = false;
let toolHistLoaded = false;
let toolHistFilterItemId = '';
let toolHistFilterOperator = '';
let toolHistFilterTip = '';

/* Aşama 2 — operatör "🔧 Takım Dolabı" ekranı state'i. Kasıtlı olarak "tüm kalemleri listele"
   YOK — sadece QR/kod ile bulunan TEK kalem tutuluyor (bkz. toolOpLookupByCode), bu yüzden
   toolCatalog/toolStock burada asla topluca doldurulmuyor. */
let toolOpScanCode = '';          // son taranan/yazılan CANİAS kodu
let toolOpFoundItem = null;       // hedefli sorgudan gelen TEK katalog kaydı {id, ...}
let toolOpFoundStock = null;      // aynı kalemin TEK stok kaydı {miktar, ...}
let toolOpLookupBusy = false;
let toolOpLookupError = null;
let toolOpQty = 1;
let toolOpManualMachine = '';
let toolOpSelectedEntryId = null; // birden fazla aktif kayıt varsa hangisine bağlansın
let toolOpNote = '';              // opsiyonel not — toolMoves'a aciklama olarak yazılır
let toolOpBusy = false;
let toolLastMove = null;          // {id, itemId, canias, ad, tip, miktar, operatorUsername, ts, makine, isEmriNo} — SADECE bu oturumun belleğinde, geri alma için

const TOOL_KATEGORI_LIST = [
  { v:'elmas_uc',       l:'Elmas Uç' },
  { v:'freze',          l:'Freze' },
  { v:'matkap_klavuz',  l:'Matkap/Kılavuz' },
  { v:'cbn',            l:'CBN' },
  { v:'piko',           l:'Piko' },
  { v:'kater',          l:'Kater' },
  { v:'diger',          l:'Diğer' },
];

/* ---------- yetki ---------- */
function toolStokEnabled(){ return !!(appSettings && appSettings.toolStokEnabled); }
function canManageToolStok(){ return !!(session && session.isSuperAdmin); }
function canSeeToolStok(){
  if(!session) return false;
  if(session.isSuperAdmin) return true;
  const op = STATE.operators[session.username];
  return !!(op && op.permTakimStokGor);
}
function canSayimToolStok(){
  if(!session) return false;
  if(session.isSuperAdmin) return true;
  const op = STATE.operators[session.username];
  return !!(op && op.permTakimStokSayim);
}
function toggleToolStokEnabled(){
  if(!canManageToolStok()) return;
  DB.ref('settings/toolStokEnabled').set(!toolStokEnabled());
}

/* ---------- yardımcı diziler ---------- */
function toolLocationsArray(){ return Object.entries(toolLocations).map(([id,v])=>({id,...v})).sort((a,b)=>(a.sira||0)-(b.sira||0)); }
function toolCatalogArray(){ return Object.entries(toolCatalog).map(([id,v])=>({id,...v})); }

/* ---------- katalog cache (versiyon kontrollü) ----------
   settings/toolCatalogVersion zaten `settings` node'u açılışta dinlendiği için appSettings
   içinde ek maliyetsiz hazır bulunuyor. localStorage'daki versiyon sunucudakiyle eşleşiyorsa
   toolCatalog hiç Firebase'e gitmeden cache'ten doldurulur. */
let toolCatalogLoading = false;
let toolCatalogError = null;
function ensureToolCatalogLoaded(cb){
  // cb SADECE gerçek asenkron okuma tamamlandığında çağrılır — zaten hazırsa (ister önceden
  // yüklenmiş olsun ister az önce cache'ten senkron dolmuş olsun) cb HİÇ çağrılmaz. Aksi halde
  // renderToolStokAdminSettings() -> ensureToolCatalogLoaded(safeRender) -> render() -> aynı
  // fonksiyon -> ... şeklinde senkron sonsuz döngüye (stack overflow) giriyordu — bir buton
  // tıklamasından sonra (input focus'u kalmadığında) gerçekten oluyordu, bkz. sohbet.
  if(toolCatalogReady) return;
  if(toolCatalogLoading) return;
  const cachedVer = load('tool_catalog_version', -1);
  const serverVer = Number((appSettings&&appSettings.toolCatalogVersion) || 0);
  if(cachedVer === serverVer){
    const cached = load('tool_catalog_cache', null);
    if(cached){ toolCatalog = cached; toolCatalogReady = true; return; }
  }
  toolCatalogLoading = true;
  DB.ref('toolCatalog').once('value').then(snap=>{
    toolCatalogLoading = false;
    toolCatalog = snap.val() || {};
    toolCatalogReady = true;
    toolCatalogError = null;
    save('tool_catalog_cache', toolCatalog);
    save('tool_catalog_version', serverVer);
    cb&&cb();
  }).catch(err=>{
    // Sessizce yutmuyoruz ama her render'da yeniden denemiyoruz da — aksi halde rules henüz
    // yayınlanmamışken (veya yetkisiz bir kullanıcıda) her yeniden çizimde yeni bir istek
    // ateşlenir. Kullanıcı "Tekrar Dene"ye basana kadar bekliyoruz.
    toolCatalogLoading = false;
    toolCatalogError = err && err.message || 'okuma hatası';
    safeRender();
  });
}
function retryToolCatalogLoad(){ toolCatalogError = null; ensureToolCatalogLoaded(()=>safeRender()); }
// Bu modülün kendi yazma fonksiyonları dışında toolCatalogVersion'ı hiçbir şey artırmıyor,
// bu yüzden her yerel yazımdan sonra cache'i de aynı miktarda ileri kaydırmak (sunucudaki
// ServerValue.increment ile aynı adımda) yeniden okumaya gerek bırakmıyor. Başka bir SuperAdmin
// eşzamanlı yazarsa bir sonraki açılışta versiyon uyuşmaz, tek seferlik ekstra bir okuma olur —
// veri kaybı YOK, sadece nadir bir cache-miss.
function bumpLocalToolCatalogVersion(){
  const newVer = Number(load('tool_catalog_version', 0)) + 1;
  save('tool_catalog_version', newVer);
  save('tool_catalog_cache', toolCatalog);
}

/* ---------- stok adetleri — her açılışta taze, hiç cache'lenmez ---------- */
let toolStockLoading = false;
let toolStockError = null;
function ensureToolStockLoaded(cb, force){
  // cb sadece gerçek asenkron okuma bittiğinde çağrılır — bkz. ensureToolCatalogLoaded'daki not.
  if(toolStockReady && !force) return;
  if(toolStockLoading) return;
  toolStockLoading = true;
  DB.ref('toolStock').once('value').then(snap=>{
    toolStockLoading = false;
    toolStock = snap.val() || {};
    toolStockReady = true;
    toolStockError = null;
    cb&&cb();
  }).catch(err=>{
    toolStockLoading = false;
    toolStockError = err && err.message || 'okuma hatası';
    safeRender();
  });
}
function retryToolStockLoad(){ toolStockError = null; ensureToolStockLoaded(()=>safeRender(), true); }

/* ---------- konum yönetimi (SuperAdmin) ---------- */
function addToolLocation(){
  if(!canManageToolStok()) return;
  const input = document.getElementById('tool-new-loc-ad');
  const ad = (input?.value||'').trim();
  if(!ad){ toast('Konum adı girin'); return; }
  const id = DB.ref('toolLocations').push().key;
  const maxSira = toolLocationsArray().reduce((m,l)=>Math.max(m, l.sira||0), 0);
  const rec = { ad, sira: maxSira+1, aktif: true };
  DB.ref('toolLocations/'+id).set(rec).then(()=>{
    toolLocations[id] = rec;
    if(input) input.value = '';
    toast('Konum eklendi');
    render();
  });
}
function renameToolLocation(id, val){
  if(!canManageToolStok()) return;
  const ad = (val||'').trim(); if(!ad) return;
  DB.ref('toolLocations/'+id+'/ad').set(ad);
  if(toolLocations[id]) toolLocations[id].ad = ad;
}
function toggleToolLocationActive(id){
  if(!canManageToolStok()) return;
  const cur = !!(toolLocations[id] && toolLocations[id].aktif!==false);
  DB.ref('toolLocations/'+id+'/aktif').set(!cur);
  if(toolLocations[id]) toolLocations[id].aktif = !cur;
  render();
}
function deleteToolLocation(id){
  if(!canManageToolStok()) return;
  const inUse = toolCatalogArray().some(it=>it.locId===id);
  if(inUse){ toast('Bu konumda kalemler var, önce onları başka konuma taşıyın'); return; }
  if(!confirm('Bu konumu silmek istediğine emin misin?')) return;
  DB.ref('toolLocations/'+id).remove();
  delete toolLocations[id];
  render();
}

/* Firebase RTDB compat SDK'nın .update() çağrısı, tek istekte çok sayıda farklı path içeren
   büyük objelerle (100+ ayrı yol) "Maximum call stack size exceeded" hatası verebiliyor —
   186 kalemlik toplu konum taşımasında görüldü. Büyük update objelerini küçük parçalara
   bölüp sırayla gönderiyoruz; sonuç tek bir mantıksal işlem, sadece Firebase'e birden fazla
   küçük istek halinde gidiyor. */
function toolChunkedUpdate(updates, chunkSize){
  chunkSize = chunkSize || 120;
  const entries = Object.entries(updates);
  if(entries.length===0) return Promise.resolve();
  const chunks = [];
  for(let i=0;i<entries.length;i+=chunkSize) chunks.push(entries.slice(i,i+chunkSize));
  let p = Promise.resolve();
  chunks.forEach(chunk=>{
    p = p.then(()=>DB.ref().update(Object.fromEntries(chunk)));
  });
  return p;
}

/* ---------- kalem alanı düzenleme (SuperAdmin, tek alan) ---------- */
function updateToolCatalogField(itemId, field, val){
  if(!canManageToolStok()) return;
  const it = toolCatalog[itemId]; if(!it) return;
  let v = val;
  if(field==='altLimit' || field==='siparisMiktari') v = Number(val)||0;
  if(field==='demirbas' || field==='aktif') v = !!val;
  const updates = {};
  updates['toolCatalog/'+itemId+'/'+field] = v;
  updates['toolCatalog/'+itemId+'/updatedTs'] = Date.now();
  updates['toolCatalog/'+itemId+'/updatedBy'] = session.username;
  updates['settings/toolCatalogVersion'] = firebase.database.ServerValue.increment(1);
  toolChunkedUpdate(updates).then(()=>{
    it[field] = v;
    it.updatedTs = Date.now();
    it.updatedBy = session.username;
    bumpLocalToolCatalogVersion();
    render();
  });
}

/* ---------- Excel toplu yükleme (SuperAdmin) ----------
   Mevcut uploadMalzemeListesi() deseni (bkz. js/catalog.js) aynen kullanılıyor:
   FileReader -> XLSX.read -> sheet_to_json({header:1}) -> trNorm ile esnek sütun eşleştirme. */
const TOOL_EXCEL_COLS = {
  canias:   ['CANİAS KODU','CANIAS KODU','CANİAS','CANIAS'],
  ad:       ['ÜRÜN ADI','URUN ADI','ÜRÜN KODU','URUN KODU'],
  stokKodu: ['STOK KODU','STOK KODU '],
  stok:     ['STOK ADETİ','STOK ADETI'],
  kategori: ['KATEGORİ','KATEGORI'],
  marka:    ['MARKA'],
  dolap:    ['DOLAP'],
  goz:      ['GÖZ','GOZ'],
  altLimit: ['ALT LİMİT','ALT LIMIT'],
  siparis:  ['STANDART SİPARİŞ MİKTARI','SİPARİŞ MİKTARI','SIPARIS MIKTARI'],
  demirbas: ['DEMİRBAŞ','DEMIRBAS'],
};
/* Gerçek CNC OFİS STOK.xlsx dosyasında KATEGORİ/DOLAP/GÖZ/DEMİRBAŞ sütunları YOK — her
   kategori kendi sekmesinde tutuluyor (1-ELMAS UÇLAR, 2-KARBÜR FREZE ÇAKISI, ...), kategori
   sekme adından çıkarılıyor. Konum/göz/demirbaş yüklemeden sonra Kalem Listesi'nden elle
   atanacak. Sütun bazlı eşleştirme yine de esnek bırakıldı — KATEGORİ/DOLAP sütunu olan bir
   dosya gelirse (satır bazlı) otomatik yakalanır ve sekme varsayılanının önüne geçer. */
const TOOL_SHEET_KATEGORI_MAP = [
  { match:['elmas'],                     kategori:'elmas_uc' },
  { match:['freze'],                     kategori:'freze' },
  { match:['matkap','klavuz','kilavuz'], kategori:'matkap_klavuz' },
  { match:['cbn'],                       kategori:'cbn' },
  { match:['piko'],                      kategori:'piko' },
  { match:['kater','udrill','u-drill'],  kategori:'kater' },
];
function toolSheetKategori(sheetName){
  const n = trNorm(sheetName);
  for(const m of TOOL_SHEET_KATEGORI_MAP){ if(m.match.some(k=>n.includes(trNorm(k)))) return m.kategori; }
  return 'diger';
}
// "KODU OLMAYANLAR" (CANİAS kodu olmayan kalemler) ve "GİRİŞ-ÇIKIŞ" (eski elle tutulan
// hareket kütüğü — katalog değil, kullanıcı isteğiyle dışarıda bırakıldı) toplu yüklemeye dahil edilmiyor.
const TOOL_EXCEL_EXCLUDED_SHEETS = ['KODU OLMAYANLAR','GİRİŞ-ÇIKIŞ','GIRIS-CIKIS'];
function toolFindColIdx(header, candidates){
  const norm = header.map(h=>trNorm(String(h||'').trim()));
  for(const c of candidates){ const nc=trNorm(c); const i=norm.findIndex(h=>h===nc); if(i!==-1) return i; }
  for(const c of candidates){ const nc=trNorm(c); const i=norm.findIndex(h=>h.includes(nc)); if(i!==-1) return i; }
  return -1;
}
function toolFindColsForSheet(header){
  return {
    canias:   toolFindColIdx(header, TOOL_EXCEL_COLS.canias),
    ad:       toolFindColIdx(header, TOOL_EXCEL_COLS.ad),
    stokKodu: toolFindColIdx(header, TOOL_EXCEL_COLS.stokKodu),
    stok:     toolFindColIdx(header, TOOL_EXCEL_COLS.stok),
    kategori: toolFindColIdx(header, TOOL_EXCEL_COLS.kategori),
    marka:    toolFindColIdx(header, TOOL_EXCEL_COLS.marka),
    dolap:    toolFindColIdx(header, TOOL_EXCEL_COLS.dolap),
    goz:      toolFindColIdx(header, TOOL_EXCEL_COLS.goz),
    altLimit: toolFindColIdx(header, TOOL_EXCEL_COLS.altLimit),
    siparis:  toolFindColIdx(header, TOOL_EXCEL_COLS.siparis),
    demirbas: toolFindColIdx(header, TOOL_EXCEL_COLS.demirbas),
  };
}
// Dosyanın her sekmesini ayrı ayrı okuyup birleştiriyor (bkz. CNC OFİS STOK.xlsx yapısı —
// her kategori kendi sekmesinde). "KODU OLMAYANLAR"/"GİRİŞ-ÇIKIŞ" ve zorunlu sütunu (CANİAS/
// ürün adı/stok adeti) olmayan sekmeler otomatik atlanır, kullanıcıya raporlanır.
function handleToolExcelPreview(){
  if(!canManageToolStok()) return;
  const fileInput = document.getElementById('tool-excel-file-input');
  const file = fileInput?.files?.[0];
  const statusEl = document.getElementById('tool-excel-status');
  if(!file){ toast('Bir dosya seçin'); return; }
  if(statusEl) statusEl.textContent = 'Okunuyor…';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const parsed = [];
      const seenCodes = new Set();
      let dupCount = 0, blankCount = 0;
      const perSheet = [];
      const skippedSheets = [];
      wb.SheetNames.forEach(sheetName=>{
        if(TOOL_EXCEL_EXCLUDED_SHEETS.some(x=>trNorm(x)===trNorm(sheetName))){ skippedSheets.push(sheetName); return; }
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
        if(rows.length===0) return;
        const header = rows[0];
        const col = toolFindColsForSheet(header);
        if(col.canias===-1 || col.ad===-1 || col.stok===-1){
          skippedSheets.push(sheetName+' (CANİAS/ürün/stok sütunu bulunamadı)');
          return;
        }
        const sheetKategori = toolSheetKategori(sheetName);
        let sheetCount = 0;
        for(let i=1;i<rows.length;i++){
          const r = rows[i];
          const canias = String(r[col.canias]||'').trim().toUpperCase();
          if(!canias){ blankCount++; continue; }
          if(seenCodes.has(canias)) dupCount++;
          seenCodes.add(canias);
          const demirbasRaw = col.demirbas!==-1 ? String(r[col.demirbas]||'').trim().toUpperCase() : '';
          parsed.push({
            canias,
            ad:       col.ad!==-1 ? String(r[col.ad]||'').trim() : '',
            stokKodu: col.stokKodu!==-1 ? String(r[col.stokKodu]||'').trim() : '',
            stok:     col.stok!==-1 ? (Number(r[col.stok])||0) : 0,
            kategori: col.kategori!==-1 ? (String(r[col.kategori]||'').trim() || sheetKategori) : sheetKategori,
            marka:    col.marka!==-1 ? String(r[col.marka]||'').trim() : '',
            dolap:    col.dolap!==-1 ? String(r[col.dolap]||'').trim() : '',
            goz:      col.goz!==-1 ? String(r[col.goz]||'').trim() : '',
            altLimit: col.altLimit!==-1 ? (Number(r[col.altLimit])||0) : 0,
            siparis:  col.siparis!==-1 ? (Number(r[col.siparis])||0) : 0,
            demirbas: ['EVET','X','TRUE','1'].includes(demirbasRaw),
          });
          sheetCount++;
        }
        perSheet.push({ sheetName, kategori: sheetKategori, count: sheetCount });
      });
      if(parsed.length===0){ if(statusEl) statusEl.textContent = 'Geçerli satır bulunamadı.'; return; }
      toolExcelPreview = { rows: parsed, blankCount, dupCount, perSheet, skippedSheets };
      toolExcelUpdateStock = false;
      if(statusEl) statusEl.textContent = `${parsed.length} satır okundu (${perSheet.length} sekme), önizleme aşağıda.`;
      render();
    } catch(err){
      console.warn(err);
      if(statusEl) statusEl.textContent = 'Dosya okunamadı, .xlsx formatında olduğundan emin olun.';
    }
  };
  reader.readAsArrayBuffer(file);
}
function confirmToolExcelUpload(){
  if(!canManageToolStok() || !toolExcelPreview) return;
  const rows = toolExcelPreview.rows;
  if(rows.length===0){ toast('Yüklenecek satır yok'); return; }

  // 1) Excel'deki "DOLAP" metinlerini mevcut konumlara eşle, eşleşmeyenler için yeni konum aç.
  const locByName = {};
  toolLocationsArray().forEach(l=>{ locByName[trNorm(l.ad)] = l.id; });
  let maxSira = toolLocationsArray().reduce((m,l)=>Math.max(m,l.sira||0), 0);
  const updates = {};
  rows.forEach(r=>{
    if(!r.dolap) return;
    const key = trNorm(r.dolap);
    if(!locByName[key]){
      const id = DB.ref('toolLocations').push().key;
      maxSira++;
      updates['toolLocations/'+id] = { ad: r.dolap, sira: maxSira, aktif: true };
      locByName[key] = id;
    }
  });

  // 2) Kalemleri işle — CANİAS kodu zaten varsa güncelle, yoksa yeni oluştur. Excel'de olmayan
  //    mevcut kalemlere hiç dokunulmaz (birleştirme, silme değil).
  const now = Date.now();
  let yeni = 0, guncellendi = 0;
  const byCode = {};
  Object.entries(toolCatalog).forEach(([id,v])=>{ if(v.canias) byCode[v.canias] = id; });
  rows.forEach(r=>{
    const isNew = !byCode[r.canias];
    const itemId = isNew ? DB.ref('toolCatalog').push().key : byCode[r.canias];
    const locId = r.dolap ? locByName[trNorm(r.dolap)] : null;
    updates['toolCatalog/'+itemId+'/canias']         = r.canias;
    updates['toolCatalog/'+itemId+'/ad']             = r.ad;
    updates['toolCatalog/'+itemId+'/stokKodu']       = r.stokKodu;
    updates['toolCatalog/'+itemId+'/kategori']       = r.kategori;
    updates['toolCatalog/'+itemId+'/marka']          = r.marka;
    if(locId) updates['toolCatalog/'+itemId+'/locId'] = locId;
    updates['toolCatalog/'+itemId+'/goz']            = r.goz;
    updates['toolCatalog/'+itemId+'/birim']          = 'adet';
    updates['toolCatalog/'+itemId+'/altLimit']       = r.altLimit;
    updates['toolCatalog/'+itemId+'/siparisMiktari'] = r.siparis;
    updates['toolCatalog/'+itemId+'/demirbas']       = r.demirbas;
    updates['toolCatalog/'+itemId+'/aktif']          = true;
    updates['toolCatalog/'+itemId+'/updatedTs']      = now;
    updates['toolCatalog/'+itemId+'/updatedBy']      = session.username;
    if(isNew){
      yeni++;
      updates['toolStock/'+itemId+'/miktar']          = r.stok;
      updates['toolStock/'+itemId+'/sonHareketTs']    = now;
      updates['toolStock/'+itemId+'/uyariGonderildi'] = false;
      const moveId = DB.ref('toolMoves').push().key;
      updates['toolMoves/'+moveId] = {
        itemId, canias: r.canias, tip:'sayim', miktar:r.stok, oncekiMiktar:0, sonrakiMiktar:r.stok,
        operatorUsername: session.username, operatorName: session.displayName,
        kaynak:'excel', ts: now
      };
    } else {
      guncellendi++;
      if(toolExcelUpdateStock){
        const onceki = Number((toolStock[itemId]||{}).miktar) || 0;
        updates['toolStock/'+itemId+'/miktar']       = r.stok;
        updates['toolStock/'+itemId+'/sonHareketTs'] = now;
        const moveId = DB.ref('toolMoves').push().key;
        updates['toolMoves/'+moveId] = {
          itemId, canias: r.canias, tip:'sayim', miktar:r.stok-onceki, oncekiMiktar:onceki, sonrakiMiktar:r.stok,
          operatorUsername: session.username, operatorName: session.displayName,
          kaynak:'excel', ts: now
        };
      }
    }
  });
  updates['settings/toolCatalogVersion'] = firebase.database.ServerValue.increment(1);

  toolChunkedUpdate(updates).then(()=>{
    // Yazdığımız her alanı yerel state'e de uygula (optimistic update, sunucudan yeniden okuma yok).
    Object.entries(updates).forEach(([path,val])=>{
      const parts = path.split('/');
      if(parts[0]==='toolCatalog'){ toolCatalog[parts[1]] = toolCatalog[parts[1]]||{}; toolCatalog[parts[1]][parts[2]] = val; }
      else if(parts[0]==='toolStock'){ toolStock[parts[1]] = toolStock[parts[1]]||{}; toolStock[parts[1]][parts[2]] = val; }
      else if(parts[0]==='toolLocations' && parts.length===2){ toolLocations[parts[1]] = val; }
    });
    bumpLocalToolCatalogVersion();
    toast(`${yeni} yeni kalem · ${guncellendi} güncellendi · ${toolExcelPreview.blankCount} satır atlandı (kod boş) · ${toolExcelPreview.dupCount} tekrarlanan kod`);
    toolExcelPreview = null;
    const fi = document.getElementById('tool-excel-file-input'); if(fi) fi.value = '';
    render();
  }).catch(err=>{
    toast('Yükleme başarısız: '+(err.message||'bilinmeyen hata'));
  });
}



/* ---------- Kalem Listesi: filtre + çoklu seçim + toplu konum taşıma ----------
   186 kalemi tek tek dolap seçtirmek yerine: kategoriye/"konumsuz"a göre filtrele, tümünü
   seç, hedef konumu seç, tek DB.ref().update() ile hepsini aynı anda taşı. */
function toolCatalogFilteredArray(){
  const q = toolListSearch||'';
  return toolCatalogArray().filter(it=>{
    if(toolListFilterKategori && it.kategori!==toolListFilterKategori) return false;
    if(toolListFilterLoc==='__none__'){ if(it.locId) return false; }
    else if(toolListFilterLoc){ if(it.locId!==toolListFilterLoc) return false; }
    // Tadilat "Malzeme Ara" ile aynı desen (bkz. malzemeLikeMatch, js/catalog.js): kelimeler
    // sırasız AND ile eşleşir, Canias alışkanlığı olanlar %joker% da kullanabilir.
    if(q && !malzemeLikeMatch((it.canias||'')+' '+(it.ad||'')+' '+(it.stokKodu||''), q)) return false;
    return true;
  }).sort((a,b)=>(a.ad||'').localeCompare(b.ad||''));
}
function toolSetListFilter(field, val){
  if(field==='kategori') toolListFilterKategori = val;
  else if(field==='loc') toolListFilterLoc = val;
  else if(field==='search') toolListSearch = val;
  render();
}
function toggleToolBulkSelect(id, checked){
  if(checked) toolBulkSelected[id] = true; else delete toolBulkSelected[id];
  render();
}
function toolBulkSelectAllFiltered(checked){
  toolCatalogFilteredArray().forEach(it=>{ if(checked) toolBulkSelected[it.id] = true; else delete toolBulkSelected[it.id]; });
  render();
}
function toolBulkClearSelection(){ toolBulkSelected = {}; render(); }
function bulkMoveToolItemsToLocation(){
  if(!canManageToolStok()) return;
  const ids = Object.keys(toolBulkSelected);
  if(ids.length===0){ toast('Önce kalem seçin'); return; }
  if(!toolBulkTargetLoc){ toast('Hedef konum seçin'); return; }
  const locAd = (toolLocations[toolBulkTargetLoc]||{}).ad || '?';
  if(!confirm(`${ids.length} kalemi "${locAd}" konumuna taşımak istediğine emin misin?`)) return;
  const now = Date.now();
  const updates = {};
  ids.forEach(id=>{
    updates['toolCatalog/'+id+'/locId']     = toolBulkTargetLoc;
    updates['toolCatalog/'+id+'/updatedTs'] = now;
    updates['toolCatalog/'+id+'/updatedBy'] = session.username;
  });
  updates['settings/toolCatalogVersion'] = firebase.database.ServerValue.increment(1);
  toolChunkedUpdate(updates).then(()=>{
    ids.forEach(id=>{ if(toolCatalog[id]){ toolCatalog[id].locId = toolBulkTargetLoc; toolCatalog[id].updatedTs = now; toolCatalog[id].updatedBy = session.username; } });
    bumpLocalToolCatalogVersion();
    toast(`${ids.length} kalem "${locAd}" konumuna taşındı`);
    toolBulkSelected = {};
    render();
  }).catch(err=>{
    toast('Taşıma başarısız: '+(err.message||'bilinmeyen hata'));
  });
}





/* ---------- Sipariş Açık bayrağı — Kalem Listesi'nde tek tıkla, stoklara bakarken
   hangi kalem için tedarikçiye zaten sipariş verildiğini görmek için (SuperAdmin) ---------- */
function toggleToolStokSiparisAcik(itemId){
  if(!canManageToolStok()) return;
  const cur = !!(toolStock[itemId]||{}).siparisAcik;
  DB.ref('toolStock/'+itemId+'/siparisAcik').set(!cur).then(()=>{
    toolStock[itemId] = { ...(toolStock[itemId]||{}), siparisAcik: !cur };
    render();
  });
}

/* ---------- Stok Girişi (mal kabul) — SuperAdmin ----------
   Kalem Listesi'ndeki büyük tabloyu scroll edip satır içi düzenlemek "pek mantıklı değil" —
   operatör çıkış ekranıyla AYNI mantık: kod ara/QR okut -> kalem gelsin -> adet+not(sipariş
   no) gir -> kaydet. Katalog bu panelde (Kalem Listesi için) zaten yüklü olduğundan burada
   AYRICA bir Firebase okuması YAPILMIYOR — toolCatalog bellek-içi taranıyor. */
function toolGirisLookup(code){
  code = String(code||'').trim().toUpperCase();
  toolGirisError = null;
  toolGirisFoundId = null;
  if(!code) return;
  const found = Object.entries(toolCatalog).find(([id,v])=>v.canias===code);
  if(!found){ toolGirisError = `"${code}" tanımlı değil.`; render(); return; }
  toolGirisFoundId = found[0];
  toolGirisQty = 1;
  toolGirisNote = '';
  toolGirisSiparisAcik = !!(toolStock[found[0]]||{}).siparisAcik;
  render();
}
function toolGirisScanQr(){
  openQrScanner(function(code){ toolGirisCode = code; toolGirisLookup(code); });
}
function toolGirisClear(){
  toolGirisCode = ''; toolGirisFoundId = null; toolGirisError = null;
  toolGirisQty = 1; toolGirisNote = ''; toolGirisSiparisAcik = false;
  render();
}
function toolGirisChangeQty(delta){
  toolGirisQty = Math.max(1, (Number(toolGirisQty)||1) + delta);
  render();
}
function doToolGiris(){
  if(!canManageToolStok()) return;
  const itemId = toolGirisFoundId; if(!itemId) return;
  const it = toolCatalog[itemId]; if(!it) return;
  const qty = Math.max(1, Number(toolGirisQty)||1);
  const siparisAcik = !!toolGirisSiparisAcik;
  DB.ref('toolStock/'+itemId+'/miktar').transaction(cur => (Number(cur)||0) + qty)
    .then(result=>{
      if(!result.committed){ toast('İşlem tamamlanamadı, tekrar deneyin'); return; }
      const sonrakiMiktar = Number(result.snapshot.val())||0;
      const oncekiMiktar = sonrakiMiktar - qty;
      const now = Date.now();
      const moveId = DB.ref('toolMoves').push().key;
      const moveRec = {
        itemId, canias: it.canias, tip:'giris', miktar: qty, oncekiMiktar, sonrakiMiktar,
        operatorUsername: session.username, operatorName: session.displayName,
        aciklama: (toolGirisNote||'').trim(), kaynak:'arama', ts: now
      };
      const updates = {};
      updates['toolMoves/'+moveId] = moveRec;
      updates['toolStock/'+itemId+'/sonHareketTs'] = now;
      updates['toolStock/'+itemId+'/siparisAcik'] = siparisAcik;
      // Stok alt limitin üzerine çıktıysa uyarı bayrağını da sıfırla — Aşama 4'te bir düşüşte
      // tekrar uyarabilsin diye (bkz. görev talimatı §9).
      if(it.altLimit>0 && sonrakiMiktar>it.altLimit){ updates['toolStock/'+itemId+'/uyariGonderildi'] = false; }
      DB.ref().update(updates).then(()=>{
        toolStock[itemId] = { ...(toolStock[itemId]||{}), miktar: sonrakiMiktar, sonHareketTs: now, siparisAcik };
        toast(`Giriş kaydedildi: ${it.ad} (+${qty})`);
        toolGirisClear();
      });
    }).catch(err=>{
      toast('Giriş kaydedilemedi: '+(err.message||'bilinmeyen hata'));
    });
}

/* ---------- Etiket Yazdırma (SuperAdmin) ----------
   "Kalem seçimi (tümü/konuma göre/kategoriye göre/tek tek)" — Kalem Listesi'ndeki mevcut
   filtreler (kategori/konum/arama) + "tümünü seç" checkbox'ı ZATEN bu dört modu karşılıyor,
   ayrı bir seçim ekranı kurmaya gerek yok: filtrele, tümünü seç (ya da satır satır işaretle),
   sonra bu butona bas. QR üretimi CDN'den (qrcode-generator) SADECE bu pencerede, sadece bu
   butona basılınca yükleniyor — ana uygulamanın açılış paketine hiç eklenmiyor. Ayrı bir
   window.open() penceresinde basılıyor ki mevcut sayfanın @media print kurallarıyla çakışmasın.

   Izgara ölçüleri kullanıcının verdiği örnek etiket şablonundan (KOD123213.docx) birebir
   alındı — standart "21'li" A4 etiket kağıdı (63,5×38,1mm, 3 sütun × 7 satır, sütunlar arası
   3mm boşluk, üst kenar 15,1mm, sol/sağ kenar 6,5mm, satırlar arası boşluksuz — Avery L7160 ile
   aynı fiziksel ölçüler). Her sayfaya tam 21 etiket sığdırılıyor, fazlası otomatik yeni
   sayfalara taşıyor (her sayfa kendi 15,1mm üst boşluğuyla YENİDEN başlıyor). */
const TOOL_LABEL_COLS = 3, TOOL_LABEL_ROWS = 7, TOOL_LABEL_PER_PAGE = TOOL_LABEL_COLS*TOOL_LABEL_ROWS;
function printToolLabels(){
  if(!canManageToolStok()) return;
  const ids = Object.keys(toolBulkSelected);
  if(ids.length===0){ toast('Önce Kalem Listesi\'nden yazdırılacak kalemleri seçin'); return; }
  const items = ids.map(id=>({ id, ...toolCatalog[id] })).filter(it=>it.canias);
  if(items.length===0){ toast('Seçilen kalemler bulunamadı'); return; }

  const w = window.open('', '_blank');
  if(!w){ toast('Yazdırma penceresi açılamadı — popup engelleyiciyi kontrol edin'); return; }

  const labelHtml = (it) => {
    const locAd = it.locId && toolLocations[it.locId] ? toolLocations[it.locId].ad : '';
    return `<div class="label">
      <div class="qr" data-code="${esc(it.canias)}"></div>
      <div class="info">
        <div class="kod">${esc(it.canias)}</div>
        <div class="ad">${esc(it.ad)}</div>
        ${(locAd||it.goz) ? `<div class="konum">${esc(locAd)}${it.goz?` / ${esc(it.goz)}`:''}</div>` : ''}
      </div>
    </div>`;
  };
  const pages = [];
  for(let i=0;i<items.length;i+=TOOL_LABEL_PER_PAGE) pages.push(items.slice(i,i+TOOL_LABEL_PER_PAGE));
  const pagesHtml = pages.map(pageItems=>`<div class="page">${pageItems.map(labelHtml).join('')}</div>`).join('');

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Takım Etiketleri</title>
    <style>
      @page{ size:A4; margin:0; }
      *{ box-sizing:border-box; }
      body{ font-family:Arial,Helvetica,sans-serif; margin:0; }
      .page{
        width:210mm; height:297mm;
        padding:15.1mm 6.5mm 0 6.5mm;
        display:grid;
        grid-template-columns:repeat(${TOOL_LABEL_COLS}, 63.5mm);
        grid-auto-rows:38.1mm;
        column-gap:3mm; row-gap:0mm;
        page-break-after:always;
      }
      .page:last-child{ page-break-after:auto; }
      .label{ width:63.5mm; height:38.1mm; padding:2mm; display:flex; gap:2mm; align-items:center; overflow:hidden; }
      .qr{ flex-shrink:0; width:26mm; height:26mm; }
      .qr svg{ width:100%; height:100%; display:block; }
      .info{ min-width:0; overflow:hidden; }
      .kod{ font-family:'Courier New',monospace; font-weight:700; font-size:11pt; }
      .ad{ font-size:8pt; line-height:1.25; margin-top:1mm; max-height:3.2em; overflow:hidden; }
      .konum{ font-size:7.5pt; color:#555; margin-top:1mm; }
      .no-print{ font-family:Arial,sans-serif; padding:14px; }
    </style></head>
    <body>
      <div class="no-print">Etiketler hazırlanıyor…</div>
      <div id="pages" style="display:none">${pagesHtml}</div>
    </body></html>`);
  w.document.close();

  const script = w.document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  script.onload = () => {
    try {
      w.document.querySelectorAll('.qr').forEach(el=>{
        const code = el.getAttribute('data-code');
        const qr = w.qrcode(0, 'M');
        qr.addData(code);
        qr.make();
        el.innerHTML = qr.createSvgTag({ cellSize:4, margin:0 });
      });
    } catch(e){ console.warn('QR üretilemedi:', e); }
    const noPrint = w.document.querySelector('.no-print'); if(noPrint) noPrint.style.display='none';
    const pagesEl = w.document.getElementById('pages'); if(pagesEl) pagesEl.style.display='block';
    setTimeout(()=>{ w.focus(); w.print(); }, 150);
  };
  script.onerror = () => {
    toast('QR kütüphanesi yüklenemedi (internet/CDN erişimi gerekli) — etiketler QR olmadan yazdırılabilir');
    const noPrint = w.document.querySelector('.no-print'); if(noPrint) noPrint.style.display='none';
    const pagesEl = w.document.getElementById('pages'); if(pagesEl) pagesEl.style.display='block';
  };
  w.document.body.appendChild(script);
}

/* ---------- Hareket Geçmişi (SuperAdmin/görünürlük izni olanlar, salt görüntüleme) ---------- */
function toolHistApplyItemFilter(code){
  code = String(code||'').trim().toUpperCase();
  if(!code){ toolHistFilterItemId=''; loadToolHistory(true); return; }
  const found = Object.entries(toolCatalog).find(([id,v])=>v.canias===code);
  if(!found){ toast('Kod bulunamadı'); return; }
  toolHistFilterItemId = found[0];
  toolHistFilterOperator = '';
  loadToolHistory(true);
}
function toolHistSetOperatorFilter(username){
  toolHistFilterOperator = username;
  toolHistFilterItemId = '';
  loadToolHistory(true);
}
function toolHistSetTipFilter(tip){ toolHistFilterTip = tip; render(); }
function toolHistClearFilters(){
  toolHistFilterItemId = ''; toolHistFilterOperator = ''; toolHistFilterTip = '';
  loadToolHistory(true);
}
function toolHistLoadMore(){ loadToolHistory(false); }

function loadToolHistory(reset){
  if(reset){ toolHistMoves = []; toolHistOldestTs = null; toolHistHasMore = true; }
  if(toolHistLoading || !toolHistHasMore) return;
  toolHistLoading = true;
  render();
  let q = DB.ref('toolMoves');
  const filtered = !!(toolHistFilterItemId || toolHistFilterOperator);
  if(toolHistFilterItemId) q = q.orderByChild('itemId').equalTo(toolHistFilterItemId);
  else if(toolHistFilterOperator) q = q.orderByChild('operatorUsername').equalTo(toolHistFilterOperator);
  else {
    q = q.orderByChild('ts');
    if(toolHistOldestTs) q = q.endAt(toolHistOldestTs - 1);
  }
  q.limitToLast(50).once('value').then(snap=>{
    toolHistLoading = false;
    const val = snap.val() || {};
    const batch = Object.entries(val).map(([id,v])=>({id, ...v}));
    batch.sort((a,b)=>b.ts-a.ts);
    toolHistHasMore = filtered ? false : batch.length>=50;
    const seen = new Set(toolHistMoves.map(m=>m.id));
    toolHistMoves = [...toolHistMoves, ...batch.filter(m=>!seen.has(m.id))].sort((a,b)=>b.ts-a.ts);
    if(batch.length>0) toolHistOldestTs = batch[batch.length-1].ts;
    render();
  }).catch(err=>{
    toolHistLoading = false;
    toast('Geçmiş yüklenemedi: '+(err.message||'bilinmeyen hata'));
    render();
  });
}

function exportToolHistoryExcel(){
  const rows = (toolHistFilterTip ? toolHistMoves.filter(m=>m.tip===toolHistFilterTip) : toolHistMoves).map(m=>({
    Tarih: fmtDT(m.ts), Kod: m.canias, Kalem: (toolCatalog[m.itemId]||{}).ad || '', Tip: m.tip, Miktar: m.miktar,
    Öncesi: m.oncekiMiktar, Sonrası: m.sonrakiMiktar, Operatör: m.operatorName || m.operatorUsername || '',
    Makine: m.makine || '', 'İş Emri': m.isEmriNo || '', Kaynak: m.kaynak || '', Not: m.aciklama || '',
  }));
  if(rows.length===0){ toast('Aktarılacak kayıt yok'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hareketler');
  XLSX.writeFile(wb, 'takim_stok_hareketleri.xlsx');
}


/* ==================== AŞAMA 2 — OPERATÖR "🔧 TAKIM DOLABI" EKRANI ====================
   QR/kod ÖNCELİKLİ, TEK KALEM hedefli tasarım — bilinçli bir karar (bkz. sohbet): tüm
   katalog+stok ÖNCEDEN indirilmiyor. Operatör QR okutur veya CANİAS kodunu yazar; sadece O
   KODA ait tek katalog kaydı ve tek stok kaydı hedefli bir sorguyla indirilir. "Tüm kalemleri
   listele" ekranı YOK — bu tamamen SuperAdmin'in Ayarlar > Kalem Listesi ekranına ait.
   demirbaş/zimmet ayrımı (Aşama 5) burada YOK — her kalem düz "Çıkış Yap" ile tüketiliyor. */

function toolLastMoveBannerHtml(){
  if(!toolLastMove || !session || toolLastMove.operatorUsername !== session.username) return '';
  const age = Date.now() - toolLastMove.ts;
  if(age > 10*60*1000) return '';
  const kalanDk = Math.max(1, Math.ceil((10*60*1000 - age)/60000));
  return `<div class="card" style="border-color:var(--accent);margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
    <div style="font-size:12.5px">Son işlem: <b>${esc(toolLastMove.ad)}</b> (${toolLastMove.miktar>0?'+':''}${toolLastMove.miktar} adet) — ${kalanDk} dk içinde geri alabilirsin</div>
    <button class="btn-ghost" onclick="undoLastToolMove()">↶ Geri Al</button>
  </div>`;
}

/* toolLocations küçük bir liste (bir avuç dolap adı) — katalog/stok gibi büyümüyor, bu yüzden
   versiyon cache'i gerekmiyor, sadece oturumda bir kez .once() ile çekilip bellekte tutuluyor.
   Konum adını göstermek opsiyonel bir süs — okunamazsa sessizce boş kalır, akışı bozmaz. */
let toolLocationsReady = false;
let toolLocationsLoading = false;
function ensureToolLocationsLoaded(cb){
  // cb SADECE gerçek asenkron okuma tamamlandığında çağrılır — zaten hazırsa cb hiç çağrılmaz.
  // Aksi halde ensureToolCatalogLoaded'daki notta anlatılan senkron sonsuz döngüye (stack
  // overflow) giriyordu — bu üç "ensure" fonksiyonundan sadece bu ikisi bu deseni izliyordu,
  // bu üçüncüsü unutulmuştu (bkz. sohbet).
  if(toolLocationsReady) return;
  if(toolLocationsLoading) return;
  toolLocationsLoading = true;
  DB.ref('toolLocations').once('value').then(snap=>{
    toolLocationsLoading = false;
    toolLocations = snap.val() || {};
    toolLocationsReady = true;
    cb&&cb();
  }).catch(()=>{ toolLocationsLoading = false; });
}

function toolOpScanQr(){
  openQrScanner(function(code){
    toolOpScanCode = code;
    toolOpLookupByCode(code);
  });
}
/* Hedefli tek-kalem sorgusu: orderByChild('canias').equalTo(...) sadece EŞLEŞEN kaydı
   istemciye gönderir, koleksiyonun tamamını değil — indexOn eklendiği için sunucu tarafında
   da taramasız/hızlı çalışır (bkz. database.rules.json toolCatalog.indexOn). */
function toolOpLookupByCode(code){
  code = String(code||'').trim().toUpperCase();
  if(!code) return;
  if(!canSeeToolStok()) return;
  toolOpLookupBusy = true;
  toolOpLookupError = null;
  toolOpFoundItem = null;
  toolOpFoundStock = null;
  render();
  DB.ref('toolCatalog').orderByChild('canias').equalTo(code).limitToFirst(1).once('value')
    .then(snap=>{
      const val = snap.val();
      if(!val){
        toolOpLookupBusy = false;
        toolOpLookupError = `"${code}" tanımlı değil.`;
        render();
        return null;
      }
      const itemId = Object.keys(val)[0];
      const item = { id: itemId, ...val[itemId] };
      ensureToolLocationsLoaded(()=>safeRender());
      return DB.ref('toolStock/'+itemId).once('value').then(stockSnap=>{
        toolOpLookupBusy = false;
        toolOpFoundItem = item;
        toolOpFoundStock = stockSnap.val() || { miktar: 0 };
        toolOpQty = 1;
        toolOpNote = '';
        const active = myActiveEntries();
        toolOpSelectedEntryId = active.length>0 ? active[0].id : null;
        toolOpManualMachine = '';
        render();
      });
    }).catch(err=>{
      toolOpLookupBusy = false;
      toolOpLookupError = 'Arama başarısız: '+(err.message||'bilinmeyen hata');
      render();
    });
}
function toolOpClearLookup(){
  toolOpFoundItem = null;
  toolOpFoundStock = null;
  toolOpScanCode = '';
  toolOpLookupError = null;
  toolOpNote = '';
  render();
}
function toolOpChangeQty(delta){
  toolOpQty = Math.max(1, (Number(toolOpQty)||1) + delta);
  render();
}




/* Stok azaltma transaction() ile — vardiya başında birden fazla operatör aynı koddan çıkış
   yapsa da yazma kaybı olmuyor. Negatife düşerse ENGELLENMİYOR (bkz. görev talimatı §4). */
function doToolCikis(){
  if(!canSeeToolStok()) return;
  if(toolOpBusy) return;
  const it = toolOpFoundItem; if(!it) return;
  const itemId = it.id;
  const qty = Math.max(1, Number(toolOpQty)||1);
  toolOpBusy = true;
  render();

  const activeEntries = myActiveEntries();
  const chosen = activeEntries.find(e=>e.id===toolOpSelectedEntryId) || activeEntries[0] || null;
  const makine = chosen ? chosen.makine : (toolOpManualMachine||'');
  const isEmriNo = chosen ? chosen.isEmriNo : '';

  DB.ref('toolStock/'+itemId+'/miktar').transaction(cur => (Number(cur)||0) - qty)
    .then(result=>{
      toolOpBusy = false;
      if(!result.committed){ toast('İşlem tamamlanamadı, tekrar deneyin'); render(); return; }
      // oncekiMiktar/sonrakiMiktar transaction'ın kendi sonucundan türetiliyor, kendi
      // hesapladığımız (raced olabilecek) bir değerden değil — bkz. görev talimatı §4.
      const sonrakiMiktar = Number(result.snapshot.val())||0;
      const oncekiMiktar = sonrakiMiktar + qty;
      const now = Date.now();
      const moveId = DB.ref('toolMoves').push().key;
      const moveRec = {
        itemId, canias: it.canias, tip:'cikis', miktar: -qty, oncekiMiktar, sonrakiMiktar,
        operatorUsername: session.username, operatorName: session.displayName,
        makine: makine||'', isEmriNo: isEmriNo||'', aciklama: (toolOpNote||'').trim(),
        kaynak: toolOpScanCode ? 'qr' : 'arama', ts: now
      };
      const updates = {};
      updates['toolMoves/'+moveId] = moveRec;
      updates['toolStock/'+itemId+'/sonHareketTs'] = now;
      DB.ref().update(updates).then(()=>{
        toolOpFoundStock = { ...(toolOpFoundStock||{}), miktar: sonrakiMiktar, sonHareketTs: now };
        toolLastMove = { id: moveId, ad: it.ad, ...moveRec };
        toast(sonrakiMiktar<0 ? `⚠ Kaydedildi — stok negatife düştü (${sonrakiMiktar})` : `Çıkış kaydedildi: ${it.ad}`);
        toolOpClearLookup();
      });
    }).catch(err=>{
      toolOpBusy = false;
      toast('Çıkış kaydedilemedi: '+(err.message||'bilinmeyen hata'));
      render();
    });
}

/* Geri alma: silme değil, ters yönde yeni bir hareket. toolMoves toplu indirilmediği için
   sadece BU OTURUMDA yapılan son işlem geri alınabilir (toolLastMove salt bellekte tutuluyor,
   sayfa yenilenirse geri alma şeridi kaybolur — bu bilinçli bir sadeleştirme). */
function undoLastToolMove(){
  if(!toolLastMove || !session || toolLastMove.operatorUsername !== session.username) return;
  const age = Date.now() - toolLastMove.ts;
  if(age > 10*60*1000){ toast('Geri alma süresi geçti (10 dakika)'); toolLastMove = null; render(); return; }
  const itemId = toolLastMove.itemId;
  const qty = -toolLastMove.miktar; // çıkışın tersi
  DB.ref('toolStock/'+itemId+'/miktar').transaction(cur => (Number(cur)||0) + qty)
    .then(result=>{
      if(!result.committed){ toast('Geri alma tamamlanamadı'); return; }
      const sonrakiMiktar = Number(result.snapshot.val())||0;
      const oncekiMiktar = sonrakiMiktar - qty;
      const now = Date.now();
      const moveId = DB.ref('toolMoves').push().key;
      const rec = {
        itemId, canias: toolLastMove.canias, tip:'iade', miktar: qty, oncekiMiktar, sonrakiMiktar,
        operatorUsername: session.username, operatorName: session.displayName,
        makine: toolLastMove.makine||'', isEmriNo: toolLastMove.isEmriNo||'',
        aciklama:'geri alındı', kaynak: toolLastMove.kaynak||'arama', ts: now
      };
      DB.ref('toolMoves/'+moveId).set(rec).then(()=>{
        if(toolOpFoundItem && toolOpFoundItem.id===itemId){
          toolOpFoundStock = { ...(toolOpFoundStock||{}), miktar: sonrakiMiktar, sonHareketTs: now };
        }
        toast('İşlem geri alındı');
        toolLastMove = null;
        render();
      });
    }).catch(err=>{
      toast('Geri alma başarısız: '+(err.message||'bilinmeyen hata'));
    });
}
/* ==================== TAKIM & SARF STOK MODÜLÜ — BİTİŞ ==================== */
