/* ===================== MALZEME KATALOĞU / DÜRBÜN ARAMA =====================
   SuperAdmin BAST03'ten (Canias) aldığı U kodu + Açıklama listesini Excel olarak yükler.
   Tadilat talebi açarken/düzeltirken, U kodunu bilmeyen kullanıcı ${ico('search',13)} ile bu listede Canias'taki
   gibi %parça% joker karakterli arama yapıp doğru kodu bulup otomatik doldurabilir.
*/
let malzemeListesi = {}; // { "UC14000126": "M6X50-YP-ELMAS ARA KALIPKONIK", ... }
function malzemeListesiArray(){ return Object.entries(malzemeListesi).map(([kod,aciklama])=>({kod,aciklama})); }
// İki mod destekleniyor:
// 1) Boşlukla ayrılmış kelimeler (varsayılan, kolay yol — % tuşuna gerek yok, klavye/tarayıcı
//    kısayol çakışması olmasın diye): tüm kelimeler herhangi bir sırada geçsin yeter.
// 2) % joker karakteri (Canias alışkanlığı olanlar için): sıralı, kesin eşleşme — "%A%B%" gibi.
// Kartlarda U kodunun yanında gösterilecek kısa etiket — kısa "Açıklama" alanı doldurulmamışsa
// (özellikle bu alan eklenmeden ÖNCE açılmış eski talepler için), uzun "Ne işlem yapılacak"
// metnine kısaltarak düşer — hiçbir talep açıklamasız görünmesin diye.
function tadilatKisaLabel(t){
  if(t.kisaAciklama) return t.kisaAciklama;
  if(t.aciklama) return t.aciklama.length>60 ? t.aciklama.slice(0,60)+'…' : t.aciklama;
  return '';
}
/* ===================== RESİM/ÇİZİM BUL (yerel arama sunucusu üzerinden) =====================
   Fabrika ağındaki bir bilgisayarda çalışan resim_arama_sunucusu.py'a (SUNUCUYU_BASLAT.bat ile
   başlatılıyor) bağlanıp, U koduna göre eşleşen resim/çizim/PDF dosyalarını bulur ve gösterir.
   Sunucu SADECE aynı yerel ağdan (fabrika/ofis içinden) erişilebilir — internetten değil.
   Sunucunun IP/portu ya da gizli anahtarı değişirse SADECE aşağıdaki iki satırı güncelleyin —
   resim_arama_sunucusu.py'daki PORT ve GIZLI_ANAHTAR ile birebir aynı olmalılar.
*/
const RESIM_SUNUCU_URL = 'http://192.168.0.36:5051';
const RESIM_SUNUCU_ANAHTAR = 'ezel-2026-resim';
let resimAramaOpen = null;      // aranan U kodu (modal başlığı için)
let resimAramaSonuclar = null;  // null = henüz sonuç yok/aranıyor, [] = sonuç yok, [...] = sonuçlar
let resimAramaHata = null;
async function resimBul(uKodu){
  if(!uKodu){ toast('U kodu boş'); return; }
  resimAramaOpen = uKodu; resimAramaSonuclar = null; resimAramaHata = null;
  render();
  try{
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), 2500);
    const pingRes = await fetch(`${RESIM_SUNUCU_URL}/ping`, { signal: ctrl.signal });
    clearTimeout(t);
    if(!pingRes.ok) throw new Error('ping-fail');
  }catch(err){
    resimAramaHata = `Resim sunucusuna ulaşılamıyor. Sunucunun çalıştığı bilgisayardan "SUNUCUYU_BASLAT.bat" ile başlatıldığından ve aynı ağda olduğunuzdan emin olun. (${RESIM_SUNUCU_URL})`;
    render();
    return;
  }
  try{
    const res = await fetch(`${RESIM_SUNUCU_URL}/ara?q=${encodeURIComponent(uKodu)}&anahtar=${encodeURIComponent(RESIM_SUNUCU_ANAHTAR)}`);
    const data = await res.json();
    if(!data.ok){ resimAramaHata = data.hata || 'Arama başarısız oldu.'; render(); return; }
    resimAramaSonuclar = data.sonuclar || [];
  }catch(err){
    resimAramaHata = 'Arama sırasında bir bağlantı hatası oluştu.';
  }
  render();
}
function closeResimArama(){ resimAramaOpen=null; resimAramaSonuclar=null; resimAramaHata=null; render(); }
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
function malzemeLikeMatch(text, pattern){
  if(!pattern) return true;
  const t = String(text||'');
  if(pattern.includes('%')){
    const startsWithPercent = pattern.startsWith('%');
    const endsWithPercent = pattern.endsWith('%');
    const parts = pattern.split('%').filter(p=>p.length>0).map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    if(parts.length===0) return true;
    let re = parts.join('.*');
    if(!startsWithPercent) re = '^'+re;
    if(!endsWithPercent) re = re+'$';
    try{ return new RegExp(re, 'i').test(t); }catch(e){ return t.toLowerCase().includes(pattern.toLowerCase()); }
  }
  const words = pattern.trim().split(/\s+/).filter(Boolean);
  if(words.length===0) return true;
  const lower = t.toLowerCase();
  return words.every(w => lower.includes(w.toLowerCase()));
}
function canManageMalzemeListesi(){
  if(!session || !session.isSuperAdmin){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return false; }
  return true;
}
function uploadMalzemeListesi(){
  if(!canManageMalzemeListesi()) return;
  const fileInput = document.getElementById('malzeme-file-input');
  const file = fileInput?.files?.[0];
  const statusEl = document.getElementById('malzeme-upload-status');
  const kodColName = trNorm((document.getElementById('malzeme-kod-col')?.value||'U Kodu').trim());
  const aciklamaColName = trNorm((document.getElementById('malzeme-aciklama-col')?.value||'Açıklama').trim());
  if(!file){ toast('Bir dosya seçin'); return; }
  if(statusEl) statusEl.textContent = 'Okunuyor…';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if(rows.length===0){ if(statusEl) statusEl.textContent='Dosya boş görünüyor.'; return; }
      const header = rows[0].map(h=>trNorm(String(h||'').trim()));
      let kodIdx = header.findIndex(h=>h===kodColName); if(kodIdx===-1) kodIdx = header.findIndex(h=>h.includes(kodColName));
      let acikIdx = header.findIndex(h=>h===aciklamaColName); if(acikIdx===-1) acikIdx = header.findIndex(h=>h.includes(aciklamaColName));
      if(kodIdx===-1){ if(statusEl) statusEl.textContent = `"${kodColName}" başlıklı sütun bulunamadı.`; return; }
      const list = {};
      for(let i=1;i<rows.length;i++){
        const kod = String(rows[i][kodIdx]||'').trim().toUpperCase();
        if(!kod) continue;
        const aciklama = acikIdx!==-1 ? String(rows[i][acikIdx]||'').trim() : '';
        list[kod] = aciklama;
      }
      const count = Object.keys(list).length;
      if(count===0){ if(statusEl) statusEl.textContent = 'Sütunda hiç veri bulunamadı.'; return; }
      DB.ref('malzemeListesi').set(list).then(()=>{
        toast(`${count} malzeme kodu yüklendi`);
        if(statusEl) statusEl.textContent = `${count} kayıt başarıyla yüklendi (sayfa: ${sheetName}).`;
        fileInput.value = '';
      });
    } catch(err){
      console.warn(err);
      if(statusEl) statusEl.textContent = 'Dosya okunamadı, .xlsx formatında olduğundan emin olun.';
    }
  };
  reader.readAsArrayBuffer(file);
}
function clearMalzemeListesi(){
  if(!canManageMalzemeListesi()) return;
  if(!confirm('Malzeme listesini tamamen silmek istediğinize emin misiniz?')) return;
  DB.ref('malzemeListesi').remove();
}
/* ===================== İŞ MERKEZİ LİSTESİ (Tadilat "Talep Edilen Makine" kaynağı) =====================
   Bu, uygulamanın kendi "allMachines()" (üretim/rota takip) makine listesinden TAMAMEN AYRI —
   ERP'deki (Canias/BAST08) tüm iş merkezi kodlarını (V01, B10, N3 gibi) kapsıyor. Sadece kod
   tutuyoruz, açıklama YOK (bilinçli olarak — liste çok uzun, sadece kod yeterli).
*/
let isMerkezleri = {}; // { "V01": true, "B10": true, ... }
function isMerkezleriArray(){ return Object.keys(isMerkezleri).sort(); }
function canManageIsMerkezleri(){
  if(!session || !session.isSuperAdmin){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return false; }
  return true;
}
function uploadIsMerkezleri(){
  if(!canManageIsMerkezleri()) return;
  const fileInput = document.getElementById('ismerkezi-file-input');
  const file = fileInput?.files?.[0];
  const statusEl = document.getElementById('ismerkezi-upload-status');
  const kodColName = trNorm((document.getElementById('ismerkezi-kod-col')?.value||'İş Merkezi').trim());
  if(!file){ toast('Bir dosya seçin'); return; }
  if(statusEl) statusEl.textContent = 'Okunuyor…';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if(rows.length===0){ if(statusEl) statusEl.textContent='Dosya boş görünüyor.'; return; }
      const header = rows[0].map(h=>trNorm(String(h||'').trim()));
      let kodIdx = header.findIndex(h=>h===kodColName); if(kodIdx===-1) kodIdx = header.findIndex(h=>h.includes(kodColName));
      if(kodIdx===-1){ if(statusEl) statusEl.textContent = `"${kodColName}" başlıklı sütun bulunamadı.`; return; }
      const list = {};
      for(let i=1;i<rows.length;i++){
        const kod = String(rows[i][kodIdx]||'').trim().toUpperCase();
        if(kod) list[kod] = true;
      }
      const count = Object.keys(list).length;
      if(count===0){ if(statusEl) statusEl.textContent = 'Sütunda hiç veri bulunamadı.'; return; }
      DB.ref('isMerkezleri').set(list).then(()=>{
        toast(`${count} iş merkezi kodu yüklendi`);
        if(statusEl) statusEl.textContent = `${count} kayıt başarıyla yüklendi (sayfa: ${sheetName}).`;
        fileInput.value = '';
      });
    } catch(err){
      console.warn(err);
      if(statusEl) statusEl.textContent = 'Dosya okunamadı, .xlsx/.xls formatında olduğundan emin olun.';
    }
  };
  reader.readAsArrayBuffer(file);
}
function clearIsMerkezleri(){
  if(!canManageIsMerkezleri()) return;
  if(!confirm('İş merkezi listesini tamamen silmek istediğinize emin misiniz?')) return;
  DB.ref('isMerkezleri').remove();
}
/* ===================== ÜRETİM PERSONELİ LİSTESİ =====================
   İş Merkezi Listesi ile aynı mantık: SuperAdmin Excel yükler, kişi kafasına göre isim
   yazamaz — Tadilat talebindeki "Talep eden kişi" alanı bu listeden seçilir/doğrulanır.
   Excel'de "Görev" sütunu da varsa, oradan otomatik bir "bölüm" çıkarımı yapıyoruz (Civata/
   Vida/Somun/Bakım/Kalite anahtar kelimesi geçiyorsa o bölüm, geçmiyorsa "Diğer") — böylece
   "Talep eden kişi" listesi, seçilen "Talep eden bölüm"e göre otomatik daralıyor.
*/
let uretimPersoneli = {}; // { "Enes Çallı": { gorev:"Civata Üretim Operatörü", bolum:"Civata" }, ... }
function uretimPersoneliArray(){ return Object.keys(uretimPersoneli).sort(); }
function uretimPersoneliInfo(ad){
  const v = uretimPersoneli[ad];
  return (v && typeof v==='object') ? v : { gorev:'', bolum:'' }; // eski/boolean formatla geriye dönük uyumluluk
}
function deriveBolumFromGorev(gorev){
  const g = String(gorev||'').toLocaleLowerCase('tr');
  if(g.includes('civata')) return 'Civata';
  if(g.includes('vida')) return 'Vida';
  if(g.includes('somun')) return 'Somun';
  if(g.includes('bakım') || g.includes('bakim')) return 'Bakım';
  if(g.includes('kalite')) return 'Kalite';
  return 'Diğer';
}
// Seçilen "Talep eden bölüm"e göre kişi listesini daraltır. Eşleşme yoksa (bölüm boş, bilinmeyen
// bir isim, ya da o bölümde kayıtlı kimse yoksa) TÜM listeyi döner — boş bırakmak yerine.
function uretimPersoneliFor(bolum){
  const all = uretimPersoneliArray();
  const b = String(bolum||'').trim().toLocaleLowerCase('tr');
  if(!b) return all;
  const filtered = all.filter(ad => uretimPersoneliInfo(ad).bolum.toLocaleLowerCase('tr')===b);
  return filtered.length>0 ? filtered : all;
}
function canManageUretimPersoneli(){
  if(!session || !session.isSuperAdmin){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return false; }
  return true;
}
function uploadUretimPersoneli(){
  if(!canManageUretimPersoneli()) return;
  const fileInput = document.getElementById('personel-file-input');
  const file = fileInput?.files?.[0];
  const statusEl = document.getElementById('personel-upload-status');
  const adColName = trNorm((document.getElementById('personel-ad-col')?.value||'Görünen Ad').trim());
  const gorevColName = trNorm((document.getElementById('personel-gorev-col')?.value||'Görev').trim());
  if(!file){ toast('Bir dosya seçin'); return; }
  if(statusEl) statusEl.textContent = 'Okunuyor…';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if(rows.length===0){ if(statusEl) statusEl.textContent='Dosya boş görünüyor.'; return; }
      const header = rows[0].map(h=>trNorm(String(h||'').trim()));
      let adIdx = header.findIndex(h=>h===adColName); if(adIdx===-1) adIdx = header.findIndex(h=>h.includes(adColName));
      if(adIdx===-1){ if(statusEl) statusEl.textContent = `"${adColName}" başlıklı sütun bulunamadı.`; return; }
      let gorevIdx = header.findIndex(h=>h===gorevColName); if(gorevIdx===-1) gorevIdx = header.findIndex(h=>h.includes(gorevColName));
      const list = {};
      for(let i=1;i<rows.length;i++){
        const ad = String(rows[i][adIdx]||'').trim();
        if(!ad) continue;
        const gorev = gorevIdx!==-1 ? String(rows[i][gorevIdx]||'').trim() : '';
        list[ad] = { gorev, bolum: deriveBolumFromGorev(gorev) };
      }
      const count = Object.keys(list).length;
      if(count===0){ if(statusEl) statusEl.textContent = 'Sütunda hiç veri bulunamadı.'; return; }
      DB.ref('uretimPersoneli').set(list).then(()=>{
        toast(`${count} personel yüklendi`);
        if(statusEl) statusEl.textContent = `${count} kayıt başarıyla yüklendi (sayfa: ${sheetName})${gorevIdx!==-1?' · bölüm otomatik çıkarıldı':''}.`;
        fileInput.value = '';
      });
    } catch(err){
      console.warn(err);
      if(statusEl) statusEl.textContent = 'Dosya okunamadı, .xlsx/.xls formatında olduğundan emin olun.';
    }
  };
  reader.readAsArrayBuffer(file);
}
function clearUretimPersoneli(){
  if(!canManageUretimPersoneli()) return;
  if(!confirm('Üretim personeli listesini tamamen silmek istediğinize emin misiniz?')) return;
  DB.ref('uretimPersoneli').remove();
}
// Liste yüklüyse, girilen ismin listede birebir (büyük/küçük harf duyarsız) olmasını zorunlu kılar.
// Liste boşsa (hiç yüklenmemişse) serbest yazıma izin verir.
function validateTalepEdenKisi(name){
  const n = String(name||'').trim();
  if(!n) return 'Talep eden kişi (ad soyad) zorunlu';
  if(uretimPersoneliArray().length>0){
    const found = uretimPersoneliArray().some(p=>p.toLocaleLowerCase('tr')===n.toLocaleLowerCase('tr'));
    if(!found) return `"${n}" üretim personeli listesinde bulunamadı — listeden seçin`;
  }
  return null;
}
// Kullanıcı listedeki bir ismi farklı büyük/küçük harfle yazmış olsa bile, kaydı hep listedeki
// orijinal yazımla saklıyoruz — tutarlılık için.
function canonicalTalepEdenKisi(name){
  const n = String(name||'').trim();
  const match = uretimPersoneliArray().find(p=>p.toLocaleLowerCase('tr')===n.toLocaleLowerCase('tr'));
  return match || n;
}
// Tadilat talebindeki "Bölüm" seçimine göre hangi iş merkezi kodları seçilebilir:
// Varsayılan kurallar — Ayarlar'dan hiç dokunulmamışsa bu değerler geçerli olur. SuperAdmin
// Ayarlar'dan bunları değiştirebilir/yenilerini ekleyebilir; Firebase'deki override'lar bunların
// ÜZERİNE eklenir (merge), yani sadece bir bölümü özelleştirmek diğerlerini silmez.
const DEFAULT_BOLUM_KURALLARI = {
  'Bakım':  { mode:'all' },
  'Civata': { mode:'include', prefixes:['B'] },
  'Vida':   { mode:'include', prefixes:['V'] },
  'Somun':  { mode:'include', prefixes:['N'] },
  'Kalite': { mode:'exclude', prefixes:['B','V','N'] },
  'Diğer':  { mode:'exclude', prefixes:['B','V','N'] }
};
let tadilatBolumKurallari = {}; // Firebase 'tadilatBolumKurallari' — { "Civata": {mode:'include', prefixes:['B']}, ... }
function getBolumKurallari(){ return { ...DEFAULT_BOLUM_KURALLARI, ...(tadilatBolumKurallari||{}) }; }
/* ===================== YÖNETİCİ SEKME ERİŞİMİ =====================
   SuperAdmin, HER yönetici/şef hesabı için AYRI AYRI, üst menüdeki ana sekmelerden (Rapor,
   Makine Matrisi, Tamamlanan Kodlar, Analiz, Tadilat) hangilerini görebileceğini belirler —
   global bir açma/kapama değil, kullanıcı bazında ("LV sadece şunlara erişsin" gibi).
   SuperAdmin kendisi HER ZAMAN hepsini görür, bu ayardan etkilenmez. Bir kullanıcı için hiç
   ayar girilmemişse varsayılan olarak TÜM sekmeler görünür sayılır (mevcut davranışı bozmamak için).
*/
let adminTabPermissions = {}; // { "LV": {rapor:true, matrix:false, ...}, "SEF": {...}, ... }
const ADMIN_TAB_DEFS = [
  { key:'rapor', label:'Rapor' },
  { key:'matrix', label:'Makine Matrisi' },
  { key:'completed', label:'Tamamlanan Kodlar' },
  { key:'analiz', label:'Analiz' },
  { key:'tadilat', label:'Tadilat' },
];
function isAdminTabVisible(key){
  if(!session) return false;
  if(session.isSuperAdmin) return true;
  const mine = adminTabPermissions[session.username];
  if(!mine) return true; // bu kullanıcı için hiç ayar girilmemiş -> varsayılan hepsi görünür
  return mine[key] !== false;
}
function setAdminTabPermission(username, key, val){
  if(!session || !session.isSuperAdmin){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return; }
  DB.ref(`adminTabPermissions/${username}/${key}`).set(val);
}
function tadilatBolumOptions(){ return Object.keys(getBolumKurallari()); }
function canManageBolumKurallari(){
  if(!session || !session.isSuperAdmin){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return false; }
  return true;
}
function saveBolumKural(ad, isNew){
  if(!canManageBolumKurallari()) return;
  const suffix = isNew ? 'yeni' : ad;
  const adInput = isNew ? (document.getElementById('bolum-yeni-ad')?.value||'').trim() : ad;
  const mode = document.getElementById('bolum-mode-'+suffix)?.value || 'all';
  const prefixesRaw = (document.getElementById('bolum-prefixes-'+suffix)?.value||'').trim();
  const prefixes = prefixesRaw.split(',').map(p=>p.trim().toUpperCase()).filter(Boolean);
  if(!adInput){ toast('Bölüm adı girin'); return; }
  if((mode==='include'||mode==='exclude') && prefixes.length===0){ toast('En az bir harf/önek girin (ör. B veya B,V)'); return; }
  if(isNew && getBolumKurallari()[adInput]){ toast('Bu bölüm zaten var'); return; }
  DB.ref('tadilatBolumKurallari/'+adInput).set({ mode, prefixes }).then(()=>{
    toast('Bölüm kuralı kaydedildi');
    if(isNew){ ['bolum-yeni-ad','bolum-yeni-prefixes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); }
  });
}
function deleteBolumKural(ad){
  if(!canManageBolumKurallari()) return;
  if(DEFAULT_BOLUM_KURALLARI[ad]){ toast('Varsayılan bölümler silinemez, sadece düzenlenebilir'); return; }
  DB.ref('tadilatBolumKurallari/'+ad).remove();
}
function bolumMakineFilter(bolum){
  const kurallar = getBolumKurallari();
  const b = String(bolum||'').trim();
  const key = Object.keys(kurallar).find(k=>k.toLocaleLowerCase('tr')===b.toLocaleLowerCase('tr'));
  if(key) return kurallar[key];
  return { mode:'all' }; // serbest yazılmış, tanımadığımız bir bölüm -> kısıtlama uygulanmaz
}
function isMerkezleriFor(bolum){
  const filter = bolumMakineFilter(bolum);
  const all = isMerkezleriArray();
  if(filter.mode==='include') return all.filter(k=>(filter.prefixes||[]).some(p=>k.startsWith(p)));
  if(filter.mode==='exclude') return all.filter(k=>!(filter.prefixes||[]).some(p=>k.startsWith(p)));
  return all;
}
// Talep edilen makine kodunu, seçilen bölüme göre doğrular. Boşsa/uygun değilse hata metni döner, uygunsa null.
function validateTalepMakine(bolum, makineRaw){
  const makine = String(makineRaw||'').trim().toUpperCase();
  if(!makine) return 'Talep edilen makine zorunlu';
  const filter = bolumMakineFilter(bolum);
  if(filter.mode==='include' && !(filter.prefixes||[]).some(p=>makine.startsWith(p))){
    return `"${bolum}" bölümü için sadece ${(filter.prefixes||[]).join('/')} ile başlayan iş merkezleri seçilebilir`;
  }
  if(filter.mode==='exclude' && (filter.prefixes||[]).some(p=>makine.startsWith(p))){
    return `"${bolum}" bölümü ${(filter.prefixes||[]).join('/')} ile başlayan iş merkezlerine erişemez`;
  }
  if(isMerkezleriArray().length>0 && !isMerkezleri[makine]){
    return `"${makine}" iş merkezi listesinde bulunamadı`;
  }
  return null;
}
// Dürbün arama penceresi: 'new' = Yeni Tadilat Talebi formu, 'edit' = Tadilat Talebini Düzelt formu
let malzemeAramaOpen = null;
let malzemeAramaQuery = '';
function openMalzemeArama(target){ malzemeAramaOpen = target; malzemeAramaQuery=''; render(); }
function closeMalzemeArama(){ malzemeAramaOpen = null; render(); }
function setMalzemeAramaQuery(v){ malzemeAramaQuery = v; render(); }
let newTadilatForm = { uKodu:'', kisaAciklama:'', bolum:'', talepMakine:'', talepKisi:'', adet:'', aciklama:'', aciklamaManual:false }; // dürbün ile seçilen değer buraya, tad-* alanlarının tümü buradan besleniyor
function pickMalzeme(kod, aciklama){
  if(malzemeAramaOpen==='new'){
    newTadilatForm.uKodu = kod; newTadilatForm.kisaAciklama = aciklama; newTadilatForm.aciklamaManual = false;
  } else if(malzemeAramaOpen==='edit' && tadilatEditForm){
    tadilatEditForm.uKodu = kod; tadilatEditForm.kisaAciklama = aciklama; tadilatEditForm.aciklamaManual = false;
  }
  malzemeAramaOpen = null;
  render();
}
// U kodu alanından çıkınca (blur), yüklü malzeme listesinde bu kod varsa açıklamayı otomatik
// doldurur/GÜNCELLER. Operatör açıklamayı KENDİ ELİYLE yazmadıysa (dürbünle seçmek "elle yazmak"
// sayılmaz), U kodu her değiştiğinde açıklama da onunla birlikte tazeleniyor — eski kodun
// açıklaması yeni kodda kalmasın diye. Elle yazılmışsa asla üzerine yazılmaz.
function tadUkoduBlur(target){
  const form = target==='new' ? newTadilatForm : tadilatEditForm;
  if(!form || form.aciklamaManual) return; // operatör kendi eliyle yazdıysa dokunma
  const kodId = target==='new' ? 'tad-ukodu' : 'tedit-ukodu';
  const kod = (document.getElementById(kodId)?.value||'').trim().toUpperCase();
  const found = kod ? malzemeListesi[kod] : null;
  form.kisaAciklama = found || ''; // eşleşme yoksa da eski (artık yanlış) açıklamayı temizle
  render();
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
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--panel-alt);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:6px;cursor:pointer" onclick="pickMalzeme('${m.kod.replace(/'/g,"\\'")}', '${m.aciklama.replace(/'/g,"\\'")}')">
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
// Excel sütun başlıklarını karşılaştırırken düz .toLowerCase() Türkçe İ/I/ı harflerinde yanılıyor
// (İ -> "i̇" nokta işaretli, I -> "i" değil "ı" olması gerekirken farklı davranabiliyor). Bu yüzden
// tüm sütun eşleştirmelerinde bunun yerine bu fonksiyonu kullanıyoruz — İ/I/ı/i hepsini tek bir
// harfe indirip öyle karşılaştırıyoruz, hangi klavye/yazım alışkanlığıyla yazılmış olursa olsun eşleşsin.
function trNorm(s){
  return String(s||'').replace(/İ/g,'i').replace(/I/g,'i').replace(/ı/g,'i').toLowerCase();
}
function normalizeTalepCode(v){
  if(v==null) return '';
  let s = String(v).trim();
  s = s.replace(/\.0$/, ''); // Excel'in tam sayıları bazen "....0" ondalıklı verebiliyor
  s = s.replace(/^[^0-9A-Za-zÇĞİÖŞÜçğıöşü]+|[^0-9A-Za-zÇĞİÖŞÜçğıöşü]+$/g, ''); // baştaki/sondaki başıboş işaretler ("! 123 ?")
  return s.toUpperCase();
}
function uploadIsEmriListesi(){
  if(!canManageIsEmriList()) return;
  const fileInput = document.getElementById('isemri-file-input');
  const file = fileInput?.files?.[0];
  const statusEl = document.getElementById('isemri-upload-status');
  const colName = trNorm((document.getElementById('isemri-col-name')?.value||'İş Talep No').trim());
  if(!file){ toast('Bir dosya seçin'); return; }
  if(statusEl) statusEl.textContent = 'Okunuyor…';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('İŞ EMRİ') || n.toUpperCase().includes('IS EMRI')) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if(rows.length===0){ if(statusEl) statusEl.textContent='Dosya boş görünüyor.'; return; }
      const header = rows[0].map(h=>trNorm(String(h||'').trim()));
      let colIdx = header.findIndex(h => h===colName);
      if(colIdx===-1) colIdx = header.findIndex(h => h.includes(colName));
      if(colIdx===-1){ if(statusEl) statusEl.textContent = `"${colName}" başlıklı sütun bulunamadı (sayfa: ${sheetName}). Sütun adını kontrol edin.`; return; }
      // Malzeme kodu / Malzeme adı sütunlarını da yakalayalım ki İş Talep No girildiğinde hangi
      // malzemeye ait olduğu operatöre/şefe otomatik gösterilebilsin (iki alan birbirine bağlı çünkü).
      const malzKoduIdx = header.findIndex(h => h.includes(trNorm('malzeme kod')));
      const malzAdiIdx = header.findIndex(h => h.includes(trNorm('malzeme ad')));
      const codes = {};
      for(let i=1;i<rows.length;i++){
        const s = normalizeTalepCode(rows[i][colIdx]);
        if(!s) continue;
        const malzemeKodu = malzKoduIdx!==-1 ? String(rows[i][malzKoduIdx]||'').trim() : '';
        const malzemeAdi = malzAdiIdx!==-1 ? String(rows[i][malzAdiIdx]||'').trim() : '';
        codes[s] = (malzemeKodu || malzemeAdi) ? { malzemeKodu, malzemeAdi } : true;
      }
      const codeCount = Object.keys(codes).length;
      if(codeCount===0){ if(statusEl) statusEl.textContent = 'Sütunda hiç veri bulunamadı.'; return; }
      DB.ref('validIsEmri').set(codes).then(()=>{
        toast(`${codeCount} İş Talep No yüklendi`);
        if(statusEl) statusEl.textContent = `${codeCount} kayıt başarıyla yüklendi (sayfa: ${sheetName})${malzKoduIdx!==-1?' · malzeme bilgisi de eşleştirildi':''}.`;
        fileInput.value = '';
      });
    } catch(err){
      console.warn(err);
      if(statusEl) statusEl.textContent = 'Dosya okunamadı, .xlsx formatında olduğundan emin olun.';
    }
  };
  reader.readAsArrayBuffer(file);
}
function clearIsEmriListesi(){
  if(!canManageIsEmriList()) return;
  if(!confirm('İş emri listesini tamamen silmek istediğine emin misin? Bu, doğrulamayı devre dışı bırakır (herkes serbestçe iş emri no girebilir).')) return;
  DB.ref('validIsEmri').remove();
  toast('Liste temizlendi');
}
function addDurusReason(){
  if(!requireSuperAdmin()) return;
  const input = document.getElementById('new-durus-reason');
  const val = (input?.value||'').trim();
  if(!val){ toast('Bir neden yaz'); return; }
  const list = (STATE.durusReasons && STATE.durusReasons.length>0) ? STATE.durusReasons : DEFAULT_DURUS_REASONS;
  if(list.includes(val)){ toast('Bu neden zaten listede'); return; }
  const updated = [...list, val];
  DB.ref('durusReasons').set(updated);
  toast('Eklendi');
  if(input) input.value = '';
}
/* ===================== TADİLAT — HAZIR İSTEK ŞABLONLARI =====================
   SuperAdmin'in Ayarlar → Veri Listeleri'nden yönettiği, tadilat talebi oluştururken
   tek tıkla "Ne işlem yapılacak?" kutusuna eklenebilen hazır ifadeler. Bir şablon metninde
   "{x}" geçiyorsa (hasParam:true), operatör o değeri bir sayı kutusuna girer, metne otomatik
   yerleşir — ör. "Punch önünden {x} mm silinecek." + girilen "3" → "Punch önünden 3 mm silinecek." */
function tadilatOnHazirIstekListesi(){
  return Object.entries(STATE.tadilatOnHazirIstekler||{}).map(([id,v])=>({id,...v}));
}
function addTadilatOnHazirIstek(){
  if(!requireSuperAdmin()) return;
  const textEl = document.getElementById('new-onhazir-text');
  const paramEl = document.getElementById('new-onhazir-param');
  const text = (textEl?.value||'').trim();
  if(!text){ toast('Şablon metni yaz'); return; }
  const hasParam = !!paramEl?.checked;
  if(hasParam && text.indexOf('{x}')<0){ toast('Sayısal değer istiyorsan metnin içine {x} yaz (ör: "...{x} mm...")'); return; }
  DB.ref('tadilatOnHazirIstekler/'+uid()).set({ text, hasParam });
  toast('Eklendi');
  if(textEl) textEl.value=''; if(paramEl) paramEl.checked=false;
}
function removeTadilatOnHazirIstek(id){
  if(!requireSuperAdmin()) return;
  if(!confirm('Bu hazır ifadeyi silmek istediğine emin misin?')) return;
  DB.ref('tadilatOnHazirIstekler/'+id).remove();
}

/* Talep oluşturma ekranındaki checklist state'i — hangi şablon seçili, parametreli olanların
   girilen değeri. Talep başarıyla oluşturulunca sıfırlanır (bkz. addTadilat). */
let tadPresetSelections = {}; // id -> { checked:bool, value:string }
let tadPresetInsertedLines = {}; // id -> son eklenen satırın metni (kaldırabilmek için)
function tadPresetLine(preset, val){
  return preset.hasParam ? preset.text.replace('{x}', val) : preset.text;
}
function syncTadPresetsToTextarea(){
  const ta = document.getElementById('tad-aciklama');
  const current = ta ? ta.value : (newTadilatForm.aciklama || '');
  let lines = current.split('\n');
  // Önce, önceki senkronizasyonda eklenmiş satırları çıkar (kullanıcı elle silmişse zaten yok, sorun değil).
  const prevLines = new Set(Object.values(tadPresetInsertedLines));
  lines = lines.filter(l => !prevLines.has(l));
  const newInserted = {};
  tadilatOnHazirIstekListesi().forEach(preset=>{
    const sel = tadPresetSelections[preset.id];
    if(!sel || !sel.checked) return;
    if(preset.hasParam && !String(sel.value||'').trim()) return; // parametre girilmeden ekleme
    const line = tadPresetLine(preset, sel.value);
    lines.push(line);
    newInserted[preset.id] = line;
  });
  tadPresetInsertedLines = newInserted;
  const sonuc = lines.filter((l,i,arr)=> l.trim()!=='' || i===arr.length-1).join('\n').replace(/\n{3,}/g,'\n\n');
  // newTadilatForm.aciklama ARTIK ASIL KAYNAK — render() bunu okuyup textarea'yı yeniden
  // oluşturuyor, o yüzden sadece DOM'a yazmak (ta.value=...) yeterli değil, aksi halde
  // toggleTadPreset() sonundaki render() çağrısı bu değeri anında silerdi.
  newTadilatForm.aciklama = sonuc;
  if(ta) ta.value = sonuc;
}
function toggleTadPreset(id){
  if(!tadPresetSelections[id]) tadPresetSelections[id] = { checked:false, value:'' };
  tadPresetSelections[id].checked = !tadPresetSelections[id].checked;
  syncTadPresetsToTextarea();
  render();
}
function setTadPresetValue(id, val){
  if(!tadPresetSelections[id]) tadPresetSelections[id] = { checked:true, value:'' };
  tadPresetSelections[id].value = val.replace(/[^0-9.,]/g,'');
  tadPresetSelections[id].checked = true;
  syncTadPresetsToTextarea();
}

function removeDurusReason(i){
  if(!requireSuperAdmin()) return;
  const list = (STATE.durusReasons && STATE.durusReasons.length>0) ? STATE.durusReasons : DEFAULT_DURUS_REASONS;
  if(!confirm(`"${list[i]}" nedenini silmek istediğine emin misin?`)) return;
  const updated = list.filter((_,idx)=>idx!==i);
  DB.ref('durusReasons').set(updated);
  toast('Silindi');
}
function editDurusReason(i){
  if(!requireSuperAdmin()) return;
  const list = (STATE.durusReasons && STATE.durusReasons.length>0) ? STATE.durusReasons : DEFAULT_DURUS_REASONS;
  const newVal = (document.getElementById('durus-edit-'+i)?.value||'').trim();
  if(!newVal){ toast('Neden boş olamaz'); return; }
  if(newVal===list[i]) return; // değişmemiş
  if(list.includes(newVal)){ toast('Bu neden zaten listede'); return; }
  const updated = list.slice(); updated[i] = newVal;
  DB.ref('durusReasons').set(updated);
  toast('Güncellendi');
}
function deleteMachine(code){
  if(!requireSuperAdmin()) return;
  if(!confirm(code+' makinesini silmek istediğine emin misin? Geçmiş kayıtlar etkilenmez, sadece yeni seçimlerde görünmez.')) return;
  if(extraMachines[code]){ DB.ref('machines_extra/'+code).remove(); }
  else { DB.ref('machines_hidden/'+code).set(true); }
  toast(code+' silindi');
}
function deleteOperator(code){
  if(!requireSuperAdmin()) return;
  if(code===session.username){ toast('Kendi hesabını silemezsin'); return; }
  if(!confirm(code+' hesabını silmek istediğine emin misin? Geçmiş kayıtları etkilenmez, sadece giriş yapamaz olur.')) return;
  DB.ref('operators/'+code).remove();
  toast(code+' silindi');
}
function setReportFilterField(field, val){ reportFilter[field]=val; reportSelectedIds = new Set(); render(); }
function setCompletedSearch(v){ completedSearch = v; render(); }
function clearReportFilter(){ reportFilter={isEmriNo:'',tarihFrom:'',tarihTo:''}; reportOperatorFilter.clear(); reportMakineFilter.clear(); reportSelectedIds = new Set(); render(); }
function setReportDatePreset(days){
  const today = new Date();
  const to = dateKey(today.getTime());
  const from = new Date(today);
  from.setDate(from.getDate() - (days-1));
  reportFilter.tarihFrom = dateKey(from.getTime());
  reportFilter.tarihTo = to;
  reportSelectedIds = new Set();
  render();
}
function toggleReportSelect(id){ if(reportSelectedIds.has(id)) reportSelectedIds.delete(id); else reportSelectedIds.add(id); render(); }
function toggleReportSelectAll(){
  const allSelected = reportVisibleIds.length>0 && reportVisibleIds.every(id=>reportSelectedIds.has(id));
  if(allSelected){ reportVisibleIds.forEach(id=>reportSelectedIds.delete(id)); }
  else { reportVisibleIds.forEach(id=>reportSelectedIds.add(id)); }
  render();
}
function deleteReportRecord(id){
  if(!requireSuperAdmin()) return;
  if(!confirm('Bu kaydı silmek istediğine emin misin? Bu işlem geri alınamaz.')) return;
  DB.ref('entries/'+id).remove();
  reportSelectedIds.delete(id);
  toast('Kayıt silindi');
}
function deleteReportSelected(){
  if(!requireSuperAdmin()) return;
  if(reportSelectedIds.size===0) return;
  if(!confirm(`${reportSelectedIds.size} kaydı silmek istediğine emin misin? Bu işlem geri alınamaz.`)) return;
  reportSelectedIds.forEach(id=> DB.ref('entries/'+id).remove());
  toast('Seçilen kayıtlar silindi');
  reportSelectedIds = new Set();
}
function toggleMachineListView(){ showMachineList=!showMachineList; render(); }

// H DÜZELTMESİ: Eskiden bir İş Emri No'nun TÜM kayıtları (geçmiş turlar dahil) tek bir akan
// sayaçla numaralanıyordu — aynı U kodu ikinci kez üretime girince "1,2,3" değil "9,10,11" gibi
// devam ediyordu. computeCompletedRoutes() zaten doğru "tur" mantığını kurmuş (sonOperasyon +
// tamamlandi ile bir tur kapanır); seqMap artık aynı mantığı kullanıp her turda 1'den başlıyor.
function seqMap(){
  const map = {};
  const byIsEmri = {};
  entriesArray().filter(e=>!e.partiRootId).forEach(e=>{ (byIsEmri[e.isEmriNo] ||= []).push(e); });
  Object.values(byIsEmri).forEach(list=>{
    list.sort((a,b)=>a.startTs-b.startTs);
    let seq = 0;
    list.forEach(e=>{
      seq++;
      map[e.id] = seq;
      if(e.sonOperasyon && e.status==='tamamlandi') seq = 0; // tur kapandı — sıradaki kayıt yeni bir tur, 1'den başlar
    });
  });
  // Parti (kısmi aktarım) kullanılan kayıtlar dallanan bir ağaç oluşturduğu için "tur" sınırı
  // net tanımlı değil — bunlar için eski (sıfırlamasız, isEmriNo bazlı sıralı) davranış korunuyor.
  const byIsEmriParti = {};
  entriesArray().filter(e=>e.partiRootId).forEach(e=>{ (byIsEmriParti[e.isEmriNo] ||= []).push(e); });
  Object.values(byIsEmriParti).forEach(list=>{
    list.sort((a,b)=>a.startTs-b.startTs).forEach((e,i)=>{ map[e.id]=i+1; });
  });
  return map;
}
// Aynı İş Emri No tekrar geldiğinde eski "tamamlandı" durumunun sızmaması için:
// her İş Emri No'nun kayıtlarını kronolojik sırayla "tur"lara bölüyoruz. Bir tur,
// sonOperasyon=true VE status='tamamlandi' olan kayıtla kapanır. Kapanan turdaki
// tüm kayıtlar "tamamlanmış rota" sayılır; o turdan SONRA gelen yeni kayıtlar
// otomatik olarak yepyeni, boş bir tur başlatır — eskisinden bağımsız kalır.
function setAnalizFrom(v){ analizFrom = v; if(analizFrom>analizTo) analizTo=analizFrom; render(); }
function setAnalizTo(v){ analizTo = v; if(analizTo<analizFrom) analizFrom=analizTo; render(); }
function setAnalizPreset(days){
  const today = new Date();
  analizTo = dateKey(today.getTime());
  const from = new Date(today);
  from.setDate(from.getDate() - (days-1));
  analizFrom = dateKey(from.getTime());
  render();
}

// Tadilat Atölye makineleri çoğunlukla "entries" tablosunda hiç iz bırakmaz (orada sadece
// üretim işleri var) — bu yüzden tadilat operasyonlarını da senkron "iş" kaydı gibi katıyoruz,
// yoksa Tadilat Atölye filtresinde makineler hep "0 dk / hiç kayıt yok" görünür. Analiz ve Excel
// dışa aktarımlarının HER İKİSİ de bu fonksiyonu kullanıyor, tek bir yerden besleniyorlar.
//
// DÜZELTME: Eskiden duruşToplamMs/excludedMs sabit 0 yazılıyordu — bu yüzden Duruş Analizi
// grafiği tadilat duruşlarını hiç görmüyordu. Artık operasyonun gerçek duruş verisi (ve o an
// hâlâ duruşta olma durumu) korunuyor.
function buildTadilatSynthetic(){
  const out = [];
  tadilatArray().forEach(t=>{
    tadilatOperasyonlarArray(t).forEach(o=>{
      if(!o.makine || !o.baslamaTs) return;
      out.push({
        makine: o.makine, startTs: o.baslamaTs, endTs: o.bitisTs || null,
        status: o.status==='tamamlandi' ? 'tamamlandi' : (o.status==='duruş' ? 'duruş' : 'devam'),
        duruşToplamMs: o.duruşToplamMs||0, excludedMs: o.excludedMs||0,
        duruşNedeni: o.duruşNedeni||null, duruşTs: o.duruşTs||null,
        operatorUsername: o.operatorUsername, operatorName: o.operatorName,
        isEmriNo: t.uKodu, talepNo: t.uKodu, adet: t.adet||null,
        aciklama: t.kisaAciklama || t.aciklama || '',
        _isTadilat: true
      });
    });
  });
  return out;
}
// Bir kaydın (entry ya da tadilat operasyonu) duvar-saati/duruş/hariç-tutulan/net süresini
// tek bir yerden, HER YERDE aynı mantıkla hesaplayan ortak fonksiyon (Analiz ve Excel dışa
// aktarımlarının aynı sonucu vermesi için — eskiden bu hesap 3 farklı yerde ayrı ayrı, bazen
// eksik/yanlış yapılıyordu).
function entryDurationBreakdown(e){
  const endClip = e.endTs || nowTick;
  const wallMs = Math.max(0, endClip - e.startTs);
  let durusMs = e.duruşToplamMs||0;
  let excludedMs = e.excludedMs||0;
  if(e.status==='duruş' && e.duruşTs){
    const liveExtra = Math.max(0, nowTick - e.duruşTs);
    if(e.duruşNedeni===GUN_SONU_REASON) excludedMs += liveExtra;
    else durusMs += liveExtra;
  }
  const netMs = Math.max(0, wallMs - durusMs - excludedMs);
  return { wallMs, durusMs, excludedMs, netMs };
}

function computeAnalizData(fromDate, toDate, atolyeFilter){
  const tadilatSynthetic = buildTadilatSynthetic();
  // E ve F düzeltmeleri için aralığın sınırlarını ms cinsinden de tutuyoruz.
  const rangeStartMs = new Date(fromDate+'T00:00:00').getTime();
  const rangeEndMs = new Date(toDate+'T00:00:00').getTime() + 86400000; // toDate'in SONU (ertesi günün başlangıcı)
  const rangeEntries = [...entriesArray(), ...tadilatSynthetic].filter(e => {
    if(isFasonMachine(e.makine)) return false; // Fason makineler (ör. FII01) hiçbir analize dahil edilmiyor
    // E DÜZELTMESİ: Eskiden sadece e.startTs'in hangi güne denk geldiğine bakılıyordu — yani
    // 1 Ağustos'ta başlayıp 4 Ağustos'ta biten bir iş, "3-5 Ağustos" raporunda HİÇ görünmüyordu
    // (başlangıcı aralığın dışında kaldığı için). Artık kaydın [başlangıç, bitiş] aralığı,
    // seçilen [fromDate, toDate] aralığıyla KESİŞİYORSA dahil ediliyor.
    const entryEndForFilter = e.endTs || nowTick;
    if(e.startTs >= rangeEndMs || entryEndForFilter < rangeStartMs) return false; // hiç kesişmiyor
    if(atolyeFilter && atolyeFilter!=='tumu'){
      const code = String(e.makine||'').split(' · ')[0];
      if(machineAtolyeOf(code)!==atolyeFilter) return false;
    }
    return true;
  });
  const isSingleDay = fromDate===toDate;
  const dayStartMs = isSingleDay ? new Date(fromDate+'T00:00:00').getTime() : null;
  // A3 düzeltmesi: payda artık "kayıt olan günler" değil, SEÇİLEN TARİH ARALIĞININ TAMAMI
  // (takvim günü sayısı) × standart mesai. Eskiden bir makine ayda sadece 2 gün kullanılsa
  // payda da sadece o 2 güne göre hesaplanıyordu — bu da az kullanılan makineleri yapay
  // olarak "çok verimli" gösteriyordu. Not: hafta sonu/tatil ayrımı şu an yok, tüm takvim
  // günleri sayılıyor — istenirse ileride "iş günü" (Pazar hariç vb.) mantığına geçirilebilir.
  const rangeDayCount = Math.round((new Date(toDate+'T00:00:00').getTime() - new Date(fromDate+'T00:00:00').getTime())/86400000) + 1;

  const byMachine = {};
  rangeEntries.forEach(e=>{
    // dk'yi aralığın içine "kelepçeliyoruz" — kayıt aralıktan önce başlamış olsa bile
    // (E düzeltmesiyle artık dahil ediliyor), gün grubu aralığın dışında bir tarihte
    // oluşup kafa karıştırmasın diye fromDate'e sabitleniyor.
    const dk = clampDateKey(dateKey(e.startTs), fromDate, toDate);
    if(!byMachine[e.makine]) byMachine[e.makine] = { entries: [], operators: new Set(), byDay: {} };
    byMachine[e.makine].entries.push(e);
    byMachine[e.makine].operators.add(`${e.operatorUsername} · ${e.operatorName}`);
    (byMachine[e.makine].byDay[dk] ||= []).push(e);
  });

  const overtimeList = [];
  let anyPhysicalAnomaly = false; // en az bir makinede fiziksel imkansızlık tespit edildiyse genel bir not göstermek için
  const perMachine = Object.entries(byMachine).map(([label, data])=>{
    let workMs = 0, durusMs = 0, overtimeMs = 0;
    let hasPhysicalAnomaly = false;
    Object.entries(data.byDay).forEach(([dk, dayList])=>{
      const dStartMs = new Date(dk+'T00:00:00').getTime();
      const cutoffMs = dStartMs + WORKDAY_END_MINUTE*60000;
      let dayOvertimeMs = 0;
      let dayWorkMs = 0, dayDurusMs = 0; // FİZİKSEL TAVAN düzeltmesi için bu güne ait alt toplamlar
      // A1 düzeltmesi: "Çoklu İş Emri" ile aynı makinede aynı anda açılan kayıtlar (aynı
      // groupId) HER ZAMAN birlikte duraklatılıp/bitiriliyor (bkz. duraklatGrup/devamGrup/
      // bitirGrup) — yani fiziksel olarak makine TEK bir süre kadar meşgul olmuş, sadece
      // raporlama için N ayrı iş emri kaydı var. Eskiden her kayıt kendi tam süresini ayrı
      // ayrı topluyordu (3 iş emriyle 8 saat çalışan makine → 24 saat görünüyordu). Artık
      // aynı gün+makine+groupId kombinasyonundan sadece BİR temsilci kayıt sayılıyor.
      const seenGroupsToday = new Set();
      dayList.forEach(e=>{
        if(e.groupId){
          if(seenGroupsToday.has(e.groupId)) return; // bu grup bugün bu makinede zaten sayıldı
          seenGroupsToday.add(e.groupId);
        }
        // F DÜZELTMESİ: Eskiden kapanmamış (endTs olmayan) bir kayıt her zaman "şu ana kadar"
        // (nowTick) sürmüş gibi sayılıyordu — geçmiş bir tarih aralığı seçilse bile. Artık en
        // fazla seçilen aralığın SONUNA kadar sayılıyor.
        // EK DÜZELTME (E ile birlikte ortaya çıkan yan etki): E artık aralıktan ÖNCE başlamış
        // kayıtları da dahil ediyor ve bunlar clampDateKey ile aralığın ilk gününe yığılıyor.
        // Ama başlangıcı da o günün sınırına kelepçelenmezse, haftalarca önce başlayıp hâlâ
        // kapanmamış bir kayıt, TÜM o süreyi tek bir güne boca ediyordu (120 saat gibi imkansız
        // rakamlar). Artık başlangıç da en erken o günün 00:00'ına kelepçeleniyor.
        const effStartMs = Math.max(e.startTs, dStartMs);
        const endClip = Math.min(e.endTs || nowTick, rangeEndMs);
        const wallMs = Math.max(0, endClip - effStartMs);
        let eDurusMs = e.duruşToplamMs || 0;
        let eExcludedMs = e.excludedMs || 0;
        // Şu an hâlâ duraklatılmış durumdaysa (henüz "Devam Et"e basılmadıysa), bu ANLIK
        // bekleme süresini de canlı olarak duruş/hariç tutulan süreye ekle — yoksa devam
        // ettirilene kadar geçen her saat yanlışlıkla "çalışma süresi" sayılıyordu.
        if(e.status==='duruş' && e.duruşTs){
          const liveExtra = Math.max(0, nowTick - e.duruşTs);
          if(e.duruşNedeni===GUN_SONU_REASON) eExcludedMs += liveExtra;
          else eDurusMs += liveExtra;
        }
        dayWorkMs += Math.max(0, wallMs - eDurusMs - eExcludedMs);
        // NOT: eDurusMs (duruş) BİLEREK güne kelepçelenmiyor — bir işin gerçekten kaç saattir
        // duruşta olduğunu (ör. 116 saat, unutulmuş bir kayıt) olduğu gibi göstermek istiyoruz,
        // bu doğru ve önemli bir uyarı sinyali. Aşağıdaki fiziksel tavan sadece "Çalışma"
        // sütununu (workMs) sınırlıyor, "Duruş" sütununa dokunmuyor.
        dayDurusMs += eDurusMs;
        // Şu an duraklatılmış (ör. gün sonu bekleyen) bir iş "hâlâ çalışıyor" sayılıp
        // fazla mesai üretmesin — mesai aşımı sadece fiilen devam eden işler için hesaplanır.
        if(e.status!=='duruş' && endClip > cutoffMs){
          const otMs = endClip - Math.max(cutoffMs, e.startTs);
          if(otMs > 0){
            dayOvertimeMs += otMs;
            overtimeList.push({ makine: label, operatorUsername: e.operatorUsername, operatorName: e.operatorName, isEmriNo: e.isEmriNo, overtimeMin: Math.round(otMs/60000), tarih: dk });
          }
        }
      });
      // FİZİKSEL TAVAN: Bir makine, bir takvim gününde GERÇEKTE GEÇEN süreden fazla "çalışmış"
      // olamaz (ör. bugün saat 14:00'te en fazla 14 saat çalışılmış olabilir, 24 saat değil).
      // Bu durum, aynı makinede birden fazla ESKİ AÇIK KALMIŞ (hiç kapatılmamış) kaydın hepsinin
      // aynı güne yığılıp her birinin ayrı ayrı bu günün payından pay almasıyla oluşabiliyor —
      // her biri tek başına makul görünse de toplamları gerçek süreyi aşabiliyor. Bunu SESSİZCE
      // gizlemek yerine (verimlilik kırpmasında olduğu gibi) tavana çekip anomali olarak
      // işaretliyoruz — "Çalışma" değeri gerçek dışıysa bunu görebilmen lazım.
      const dayElapsedCapMs = Math.max(0, Math.min(nowTick, dStartMs+86400000, rangeEndMs) - dStartMs);
      if(dayWorkMs > dayElapsedCapMs){
        dayWorkMs = dayElapsedCapMs;
        hasPhysicalAnomaly = true;
        anyPhysicalAnomaly = true;
      }
      workMs += dayWorkMs;
      durusMs += dayDurusMs;
      overtimeMs += dayOvertimeMs;
    });
    const availMs = rangeDayCount*WORKDAY_MINUTES*60000 + overtimeMs; // A3: artık tüm aralık × standart mesai + toplam fazla mesai
    const workMin = Math.round(workMs/60000);
    const durusMin = Math.round(durusMs/60000);
    const overtimeMin = Math.round(overtimeMs/60000);
    const availMin = Math.round(availMs/60000);
    // A2 düzeltmesi: %100 üstü sonuç artık SESSİZCE gizlenmiyor — hâlâ ekranda "en fazla 100"
    // gösteriliyor (yüzdelik barın taşmaması için) ama ham değer de (verimlilikRaw) saklanıyor,
    // ekran tarafı bunu görüp %100'ü aşan makineleri KIRMIZI bir veri-anomalisi uyarısıyla
    // işaretleyebiliyor — hatayı gizlemek yerine göstermek için.
    const verimlilikRaw = availMin>0 ? Math.round((workMin/availMin)*100) : 0;
    const verimlilik = Math.min(100, verimlilikRaw);
    return { label, code: label.split(' · ')[0], name: label.split(' · ')[1]||'', operators: [...data.operators], entries: data.entries, workMin, durusMin, overtimeMin, availMin, verimlilik, verimlilikRaw, verimlilikAnomali: verimlilikRaw>100, hasPhysicalAnomaly, daysUsed: Object.keys(data.byDay).length };
  }).sort((a,b)=>b.workMin-a.workMin);

  const totals = perMachine.reduce((t,m)=>({
    workMin: t.workMin+m.workMin, durusMin: t.durusMin+m.durusMin, overtimeMin: t.overtimeMin+m.overtimeMin, availMin: t.availMin+m.availMin
  }), {workMin:0, durusMin:0, overtimeMin:0, availMin:0});
  const totalsVerimlilikRaw = totals.availMin>0 ? Math.round((totals.workMin/totals.availMin)*100) : 0;
  totals.verimlilik = Math.min(100, totalsVerimlilikRaw);
  totals.verimlilikRaw = totalsVerimlilikRaw;
  totals.verimlilikAnomali = totalsVerimlilikRaw>100;
  totals.bostaMin = Math.max(0, totals.availMin - totals.workMin - totals.durusMin);

  // ===== KİŞİ BAZLI, GÜN GÜN ANALİZ =====
  // Aynı rangeEntries listesini bu sefer operatör + gün bazında gruplayıp, her gün için
  // hangi makinelerde ne kadar çalışıldığını ayrıca çıkarıyoruz.
  const byOperator = {};
  rangeEntries.forEach(e=>{
    const opKey = e.operatorUsername || '—';
    const dk = clampDateKey(dateKey(e.startTs), fromDate, toDate);
    if(!byOperator[opKey]) byOperator[opKey] = { operatorUsername: e.operatorUsername, operatorName: e.operatorName, byDay: {} };
    if(!byOperator[opKey].byDay[dk]) byOperator[opKey].byDay[dk] = { entries: [], byMachine: {} };
    byOperator[opKey].byDay[dk].entries.push(e);
    const mCode = String(e.makine||'').split(' · ')[0] || '—';
    if(!byOperator[opKey].byDay[dk].byMachine[mCode]) byOperator[opKey].byDay[dk].byMachine[mCode] = { workMs:0, durusMs:0, label: e.makine };
  });

  const perOperator = Object.values(byOperator).map(op=>{
    let totalWorkMs=0, totalDurusMs=0, totalOvertimeMs=0;
    const machineSet = new Set();
    const days = Object.entries(op.byDay).map(([dk, dayData])=>{
      const dStartMs = new Date(dk+'T00:00:00').getTime();
      const cutoffMs = dStartMs + WORKDAY_END_MINUTE*60000;
      let dayWorkMs=0, dayDurusMs=0, dayOvertimeMs=0;
      // A1 düzeltmesi (kişi bazlı tarafta da aynı mantık): "Çoklu İş Emri" grubundaki kayıtlar
      // hep birlikte duraklatılıp bitiriliyor, o yüzden aynı operatör+gün+groupId için sadece
      // bir temsilci kayıt sayılıyor — yoksa aynı hata burada da süreyi katlıyordu.
      const seenGroupsToday = new Set();
      dayData.entries.forEach(e=>{
        if(e.groupId){
          if(seenGroupsToday.has(e.groupId)) return;
          seenGroupsToday.add(e.groupId);
        }
        // Aynı gün-sınırı kelepçelemesi (bkz. byMachine tarafındaki aynı düzeltme) — eski,
        // hâlâ kapanmamış kayıtların tüm geçmiş süresini tek bir güne yığmasını engelliyor.
        const effStartMs = Math.max(e.startTs, dStartMs);
        const endClip = Math.min(e.endTs || nowTick, rangeEndMs); // F düzeltmesi
        const wallMs = Math.max(0, endClip - effStartMs);
        let eDurusMs = e.duruşToplamMs || 0;
        let eExcludedMs = e.excludedMs || 0;
        if(e.status==='duruş' && e.duruşTs){
          const liveExtra = Math.max(0, nowTick - e.duruşTs);
          if(e.duruşNedeni===GUN_SONU_REASON) eExcludedMs += liveExtra;
          else eDurusMs += liveExtra;
        }
        const eWorkMs = Math.max(0, wallMs - eDurusMs - eExcludedMs);
        const mCode = String(e.makine||'').split(' · ')[0] || '—';
        dayData.byMachine[mCode].workMs += eWorkMs;
        dayData.byMachine[mCode].durusMs += eDurusMs;
        machineSet.add(mCode);
        dayWorkMs += eWorkMs; dayDurusMs += eDurusMs;
        if(e.status!=='duruş' && endClip > cutoffMs){
          const otMs = endClip - Math.max(cutoffMs, e.startTs);
          if(otMs>0) dayOvertimeMs += otMs;
        }
      });
      // FİZİKSEL TAVAN (bkz. byMachine tarafındaki aynı düzeltme): bir kişi de bir günde
      // gerçekte geçen süreden fazla "çalışmış" olamaz — eski açık kalmış kayıtlar birikince
      // bu sınırı aşabiliyordu, artık tavana çekilip anomali olarak işaretleniyor.
      const dayElapsedCapMs = Math.max(0, Math.min(nowTick, dStartMs+86400000, rangeEndMs) - dStartMs);
      const dayHasAnomaly = dayWorkMs > dayElapsedCapMs;
      if(dayHasAnomaly) dayWorkMs = dayElapsedCapMs;
      totalWorkMs += dayWorkMs; totalDurusMs += dayDurusMs; totalOvertimeMs += dayOvertimeMs;
      const machines = Object.entries(dayData.byMachine).map(([code,md])=>({ code, label: md.label, workMin: Math.round(md.workMs/60000), durusMin: Math.round(md.durusMs/60000) })).sort((a,b)=>b.workMin-a.workMin);
      return { tarih: dk, workMin: Math.round(dayWorkMs/60000), durusMin: Math.round(dayDurusMs/60000), overtimeMin: Math.round(dayOvertimeMs/60000), kalanMin: Math.max(0, WORKDAY_MINUTES - Math.round(dayWorkMs/60000)), machines, hasPhysicalAnomaly: dayHasAnomaly };
    }).sort((a,b)=>b.tarih.localeCompare(a.tarih));
    return {
      operatorUsername: op.operatorUsername, operatorName: op.operatorName,
      workMin: Math.round(totalWorkMs/60000), durusMin: Math.round(totalDurusMs/60000), overtimeMin: Math.round(totalOvertimeMs/60000),
      machineCount: machineSet.size, daysUsed: days.length, days,
      hasPhysicalAnomaly: days.some(d=>d.hasPhysicalAnomaly)
    };
  }).sort((a,b)=>b.workMin-a.workMin);

  const anyOperatorAnomaly = perOperator.some(op=>op.hasPhysicalAnomaly);
  return { perMachine, perOperator, totals, overtimeList, isSingleDay, dayStartMs, fromDate, toDate, anyPhysicalAnomaly: anyPhysicalAnomaly||anyOperatorAnomaly };
}

// renderAdmin() analiz sekmesini çizerken hesapladığı veriyi burada saklıyor — grafik init'i
// (app.js render() sonunda) bunu yeniden hesaplamak yerine aynen kullanır. Eskiden burada
// AYRICA (ve atölye filtresi VERİLMEDEN) yeniden hesaplanıyordu — bu yüzden İmalat/Tadilat
// Atölye filtresi tablolarda doğru çalışırken grafikler hep TÜM makinelerin verisini
// gösteriyordu (sayılar ile grafikler çelişiyordu).
let lastAnalizData = null;
let analizCharts = {};
function destroyAnalizCharts(){ Object.values(analizCharts).forEach(c=>{ if(c) c.destroy(); }); analizCharts = {}; }
function initAnalizCharts(data){
  if(typeof Chart === 'undefined') return;
  destroyAnalizCharts();
  const gridColor = resolvedTheme()==='light' ? '#dde1e5' : '#2a3138';
  const textColor = resolvedTheme()==='light' ? '#6b7280' : '#8b939b';

  const barCanvas = document.getElementById('analiz-bar-chart');
  if(barCanvas && data.perMachine.length>0){
    analizCharts.bar = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: data.perMachine.map(m=>m.code),
        datasets: [
          { label: 'Çalışma (dk)', data: data.perMachine.map(m=>m.workMin), backgroundColor: '#4ade80' },
          { label: 'Duruş (dk)', data: data.perMachine.map(m=>m.durusMin), backgroundColor: '#facc15' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { stacked: true, ticks:{color:textColor}, grid:{color:gridColor} },
          y: { stacked: true, ticks:{color:textColor}, grid:{color:gridColor} }
        },
        plugins: { legend: { labels: { color: textColor } } }
      }
    });
  }

  const pieCanvas = document.getElementById('analiz-pie-chart');
  if(pieCanvas){
    const work = pieCanvas.dataset.work!=null ? Number(pieCanvas.dataset.work) : data.totals.workMin;
    const durus = pieCanvas.dataset.durus!=null ? Number(pieCanvas.dataset.durus) : data.totals.durusMin;
    const bosta = pieCanvas.dataset.bosta!=null ? Number(pieCanvas.dataset.bosta) : data.totals.bostaMin;
    analizCharts.pie = new Chart(pieCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Çalışma', 'Duruş', 'Boşta/Kullanılmayan'],
        datasets: [{ data: [work, durus, bosta], backgroundColor: ['#4ade80','#facc15','#3a4148'], borderColor: resolvedTheme()==='light'?'#ffffff':'#1c2024', borderWidth: 3, hoverOffset: 8 }]
      },
      options: { responsive:true, maintainAspectRatio:false, cutout:'72%', plugins:{ legend:{ position:'bottom', labels:{color:textColor, padding:16, font:{size:13} } } } }
    });
  }

  const durusCanvas = document.getElementById('analiz-durus-chart');
  if(durusCanvas){
    const byReason = {};
    // H düzeltmesi: artık kayıt başına TEK neden değil, o kaydın YAŞADIĞI TÜM duruş olayları
    // (durusLog) ayrı ayrı sayılıyor.
    const allEvents = collectDurusEvents(data.perMachine.flatMap(m=>m.entries));
    allEvents.forEach(ev=>{
      const minutes = Math.round(ev.sureMs/60000);
      if(!Number.isFinite(minutes) || minutes<=0) return; // NaN/undefined güvenli
      byReason[ev.neden] = (byReason[ev.neden]||0) + minutes;
    });
    const labels = Object.keys(byReason);
    if(labels.length>0){
      const palette = ['#facc15','#f87171','#fb923c','#a78bfa','var(--gunsonu)','#4ade80','#f472b6','#94a3b8','#eab308'];
      analizCharts.durus = new Chart(durusCanvas, {
        type: 'pie',
        data: { labels, datasets: [{ data: Object.values(byReason), backgroundColor: labels.map((_,i)=>palette[i%palette.length]) }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{color:textColor} } } }
      });
    }
  }

  const mesaiCanvas = document.getElementById('analiz-mesai-chart');
  if(mesaiCanvas){
    const withOt = data.perMachine.filter(m=>m.overtimeMin>0);
    if(withOt.length>0){
      analizCharts.mesai = new Chart(mesaiCanvas, {
        type: 'bar',
        data: { labels: withOt.map(m=>m.code), datasets: [{ label: 'Fazla Mesai (dk)', data: withOt.map(m=>m.overtimeMin), backgroundColor: '#f87171' }] },
        options: { responsive:true, maintainAspectRatio:false, scales:{ x:{ticks:{color:textColor},grid:{color:gridColor}}, y:{ticks:{color:textColor},grid:{color:gridColor}} }, plugins:{ legend:{labels:{color:textColor}} } }
      });
    }
  }
}

// Aynı İş Emri No tekrar geldiğinde eski "tamamlandı" durumunun sızmaması için:
// her İş Emri No'nun kayıtlarını kronolojik sırayla "tur"lara bölüyoruz. Bir tur,
// sonOperasyon=true VE status='tamamlandi' olan kayıtla kapanır. Kapanan turdaki
// tüm kayıtlar "tamamlanmış rota" sayılır; o turdan SONRA gelen yeni kayıtlar
// otomatik olarak yepyeni, boş bir tur başlatır — eskisinden bağımsız kalır.
let _completedRoutesCache = null, _completedRoutesCacheSrc = null;
function computeCompletedRoutes(){
  if(_completedRoutesCacheSrc === STATE.entries) return _completedRoutesCache;
  const all = entriesArray();
  const routes = [];

  // 1) Bölünmemiş (parti kullanılmamış) işler — eski, düz zincir mantığı AYNEN korunuyor.
  const byIsEmri = {};
  all.filter(e=>!e.partiRootId).forEach(e=>{ (byIsEmri[e.isEmriNo] ||= []).push(e); });
  Object.entries(byIsEmri).forEach(([isEmriNo,list])=>{
    list.sort((a,b)=>a.startTs-b.startTs);
    let segment = [];
    list.forEach(e=>{
      segment.push(e);
      if(e.sonOperasyon && e.status==='tamamlandi'){
        routes.push({ isEmriNo, entries: segment.slice(), finishedAt: e.endTs, startedAt: segment[0].startTs });
        segment = [];
      }
    });
  });

  // 2) Kısmi aktarım (parti) kullanılan işler — düz zincir değil, DALLANABİLEN bir ağaç. Aynı
  //    partiRootId'yi paylaşan tüm kayıtlar TEK bir iş emri olarak gruplanır (mükerrer satır
  //    çıkmasın diye). Ağaç, HİÇBİR dalı açık kalmadığında (devam eden yok, devralınmamış
  //    bekleyen parti yok) "tamamlandı" sayılır.
  const partiGroups = {};
  all.filter(e=>e.partiRootId).forEach(e=>{ (partiGroups[e.partiRootId] ||= []).push(e); });
  Object.entries(partiGroups).forEach(([rootId, treeEntries])=>{
    const claimedParentIds = new Set(treeEntries.filter(e=>e.parentEntryId).map(e=>e.parentEntryId));
    const hasOpenBranch = treeEntries.some(e=>{
      if(e.status==='devam' || e.status==='duruş') return true; // hâlâ üzerinde çalışılan bir dal
      if(e.status==='tamamlandi' && !e.sonOperasyon && !claimedParentIds.has(e.id)) return true; // kimsenin devralmadığı bekleyen parti
      return false;
    });
    if(hasOpenBranch) return; // en az bir dal açık — bu iş emri henüz tamamlanmadı
    const sorted = treeEntries.slice().sort((a,b)=>a.startTs-b.startTs);
    const finishedAt = Math.max(...treeEntries.map(e=>e.endTs||0));
    routes.push({ isEmriNo: sorted[0].isEmriNo, entries: sorted, finishedAt, startedAt: sorted[0].startTs });
  });

  routes.sort((a,b)=> b.finishedAt - a.finishedAt); // en son tamamlanan üstte
  _completedRoutesCache = routes;
  _completedRoutesCacheSrc = STATE.entries;
  return routes;
}
// _ZARF (Çelik) ve _ELMAS (Karbür) olarak ayrı ayrı takip edilen iki yarı mamulü, aynı taban
// İş Emri No altında eşleştirip "shrink fit" ile gerçekte ne zaman birleştiklerini gösterir.
function computeBirlesmeGroups(){
  const completedBySuffix = {}; // base -> { ZARF: route, ELMAS: route }
  computeCompletedRoutes().forEach(r=>{
    const bl = bilesenOfCode(r.isEmriNo);
    if(!bl) return;
    const base = baseIsEmriNo(r.isEmriNo);
    (completedBySuffix[base] ||= {})[bl] = r;
  });
  const runningBySuffix = {}; // base -> Set('ZARF'|'ELMAS') henüz tamamlanmamış ama kayıtlı
  entriesArray().forEach(e=>{
    const bl = bilesenOfCode(e.isEmriNo);
    if(!bl) return;
    const base = baseIsEmriNo(e.isEmriNo);
    const finishedHere = completedBySuffix[base] && completedBySuffix[base][bl] &&
      completedBySuffix[base][bl].entries.some(x=>x.id===e.id);
    if(!finishedHere) (runningBySuffix[base] ||= new Set()).add(bl);
  });
  const bases = new Set([...Object.keys(completedBySuffix), ...Object.keys(runningBySuffix)]);
  const groups = [];
  bases.forEach(base=>{
    const zarf = completedBySuffix[base]?.ZARF || null;
    const elmas = completedBySuffix[base]?.ELMAS || null;
    const zarfRunning = !zarf && !!runningBySuffix[base]?.has('ZARF');
    const elmasRunning = !elmas && !!runningBySuffix[base]?.has('ELMAS');
    if(!zarf && !elmas && !zarfRunning && !elmasRunning) return;
    const bothDone = !!(zarf && elmas);
    groups.push({
      base, zarf, elmas, zarfRunning, elmasRunning, bothDone,
      birlesmeTs: bothDone ? Math.max(zarf.finishedAt, elmas.finishedAt) : null
    });
  });
  groups.sort((a,b)=>{
    if(a.bothDone !== b.bothDone) return a.bothDone ? -1 : 1;
    const at = a.bothDone ? a.birlesmeTs : Math.max(a.zarf?.finishedAt||0, a.elmas?.finishedAt||0);
    const bt = b.bothDone ? b.birlesmeTs : Math.max(b.zarf?.finishedAt||0, b.elmas?.finishedAt||0);
    return bt - at;
  });
  return groups;
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
let _completedRouteIdsCache = null, _completedRouteIdsCacheSrc = null;
function computeCompletedRouteIds(){
  if(_completedRouteIdsCacheSrc === STATE.entries) return _completedRouteIdsCache;
  const ids = new Set();
  computeCompletedRoutes().forEach(r=>r.entries.forEach(e=>ids.add(e.id)));
  _completedRouteIdsCache = ids;
  _completedRouteIdsCacheSrc = STATE.entries;
  return ids;
}

// Sadece Excel dışa aktarımı için — ekrandaki "Rapor" sekmesinin (filteredEntries) davranışını
// DEĞİŞTİRMİYORUZ (o hâlâ sadece üretim kayıtlarını gösteriyor, bilinçli tercih). Ama Excel'e
// tadilat kayıtlarını da katıyoruz, yoksa dışa aktarılan raporda tadilat işleri hiç görünmüyordu.
function filteredEntriesForExport(){
  const sm = seqMap();
  const combined = [...entriesArray(), ...buildTadilatSynthetic()];
  return combined.filter(e=>{
    if(reportOperatorFilter.size>0 && !reportOperatorFilter.has(e.operatorUsername)) return false;
    if(reportFilter.isEmriNo){
      const q = reportFilter.isEmriNo.toLowerCase();
      const hit = (e.isEmriNo||'').toLowerCase().includes(q) || (e.talepNo||'').toLowerCase().includes(q);
      if(!hit) return false;
    }
    if(reportMakineFilter.size>0 && !reportMakineFilter.has(e.makine)) return false;
    if(reportFilter.tarihFrom && dateKey(e.startTs) < reportFilter.tarihFrom) return false;
    if(reportFilter.tarihTo && dateKey(e.startTs) > reportFilter.tarihTo) return false;
    return true;
  }).map(e=>({...e, _seq: e.id ? (sm[e.id]||'') : ''})).sort((a,b)=>b.startTs-a.startTs);
}
function filteredEntries(){
  const sm = seqMap();
  return entriesArray().filter(e=>{
    if(reportOperatorFilter.size>0 && !reportOperatorFilter.has(e.operatorUsername)) return false;
    if(reportFilter.isEmriNo){
      const q = reportFilter.isEmriNo.toLowerCase();
      const hit = e.isEmriNo.toLowerCase().includes(q) || (e.talepNo||'').toLowerCase().includes(q);
      if(!hit) return false;
    }
    if(reportMakineFilter.size>0 && !reportMakineFilter.has(e.makine)) return false;
    if(reportFilter.tarihFrom && dateKey(e.startTs) < reportFilter.tarihFrom) return false;
    if(reportFilter.tarihTo && dateKey(e.startTs) > reportFilter.tarihTo) return false;
    return true;
  }).map(e=>({...e, _seq: sm[e.id]||''})).sort((a,b)=>b.startTs-a.startTs);
}
function exportExcel(){
  const rows = filteredEntriesForExport().map(e=>{
    const d = entryDurationBreakdown(e);
    return {
    "Tür": e._isTadilat ? "Tadilat" : "Üretim",
    "İş Talep No": e._isTadilat ? '' : (e.talepNo||''), "U Kodu (İş Emri No)": e.isEmriNo, "Malzeme Adı": e._isTadilat ? '' : (getTalepInfo(e.talepNo)?.malzemeAdi||''), "Operasyon No": e._seq, "Malzeme Cinsi": e.malzemeCinsi||'', "Çap ve Boy": e.capBoy||'', "Adet": e.adet,
    "Makine Kodu": (e.makine||'').split(' · ')[0]||'', "Makine Adı": (e.makine||'').split(' · ')[1]||'',
    "Operatör Kodu": e.operatorUsername, "Operatör Adı": e.operatorName,
    "Başlangıç": new Date(e.startTs), "Bitiş": e.endTs?new Date(e.endTs):"",
    "Süre (dk, brüt)": e.endTs?Math.round(d.wallMs/60000):"",
    "Duruş (dk)": Math.round(d.durusMs/60000),
    "Net Süre (dk)": e.endTs?Math.round(d.netMs/60000):"",
    "Durum": e.status==='devam'?'Devam Ediyor':e.status==='duruş'?'Duruşta':'Tamamlandı',
    "Duruş Nedeni": e.duruşNedeni||"", "Not": e.not||"",
  };});
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rota");
  XLSX.writeFile(wb, `rota_disaaktarim_${dateKey(Date.now())}.xlsx`);
}

function exportTadilatExcel(){
  if(!canViewTadilatAnaliz()) return;
  const rows = [];
  tadilatArray().filter(t=>tadilatTamamlandiMi(t)).forEach(t=>{
    tadilatOperasyonlarArray(t).forEach((o,i)=>{
      const d = tadilatOpDurationBreakdown(o);
      rows.push({
        _bitisTsRaw: o.bitisTs||0, // sıralama için — sadece burada, aşağıda satırdan çıkarılıyor
        "Atölye": (t.atolye||'imalat')==='tadilat'?'Tadilat Atölye':'İmalat Atölye',
        "U Kodu": t.uKodu, "Adet": t.adet||'', "Talep Eden Kişi": t.talepEdenKisi||'', "Talep Eden Bölüm": t.bolum||'', "Yapılan İşlem": t.aciklama||'',
        "Talebi Açan": t.olusturanName||'', "Talep Tarihi": new Date(t.olusturmaTs),
        "Operasyon No": i+1, "Son Operasyon Mu": o.sonOperasyon?'Evet':'Hayır', "Makine": o.makine||'',
        "Yapan": o.operatorName||'', "Başlangıç": new Date(o.baslamaTs), "Bitiş": o.bitisTs?new Date(o.bitisTs):'',
        "Süre (dk, brüt)": o.bitisTs?Math.round(d.wallMs/60000):'',
        "Duruş (dk)": Math.round(d.durusMs/60000),
        "Net Süre (dk)": o.bitisTs?Math.round(d.netMs/60000):''
      });
    });
  });
  // DÜZELTME: Eskiden "Bitiş" alanı (o zaman metin formatındaydı) üzerinden new Date() ile
  // sıralanmaya çalışılıyordu — "10.08.26 14:30" gibi bir metni new Date() ayrıştıramaz,
  // Invalid Date (NaN) döner ve sıralama sessizce hiç çalışmazdı. Artık ham zaman damgası
  // (_bitisTsRaw) üzerinden sıralanıyor, sonra o yardımcı alan satırdan çıkarılıyor.
  rows.sort((a,b)=> b._bitisTsRaw - a._bitisTsRaw);
  rows.forEach(r=> delete r._bitisTsRaw);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tadilat");
  XLSX.writeFile(wb, `tadilat_disaaktarim_${dateKey(Date.now())}.xlsx`);
}

