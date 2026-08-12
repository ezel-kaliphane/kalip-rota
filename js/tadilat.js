/* ===================== TADİLAT (REWORK) MODÜLÜ =====================
   Yöneticiler (Şef/SuperAdmin, veya izin verilen diğer admin hesapları) tadilat talebi açar
   (hangi U kodundan kaç adetin, hangi bölümün talebiyle, ne işlem için tadilata alınacağı).
   Operatör üretim işini "Tadilat" duruş sebebiyle durdurunca Tadilat sekmesine düşer, bekleyen
   taleplerden birini alır, bitirince otomatik olarak üretim işi "Tadilat Sonrası Ayar" duruşuna
   geçer — operatör kaldığı yerden devam edebilir.

   Çok operasyonlu yapı: Her tadilat talebi, üretim rotası gibi birden fazla "operasyon" adımından
   oluşabilir (tadilatlar/$id/operasyonlar/$opId). Bir operatör bir talebi alıp "Son Operasyon" tikini
   İŞARETLEMEDEN bitirirse, talep tekrar "bekleyen" listesine düşer — bir sonraki operatör (aynı ya da
   farklı kişi) devam eder. Sadece sonOperasyon=true olan bir operasyon tamamlanınca talep gerçekten
   kapanır. Talebin durumu (bekliyor/aktif/tamamlandı) hep operasyonlardan TÜRETİLİR, ayrı bir
   "status" alanı tutmuyoruz — tek doğruluk kaynağı operasyon listesi.
*/
let tadilatlar = {};
let activeTadilatId = null;   // operatörün şu an üzerinde çalıştığı tadilat talebinin id'si
let activeTadilatOpId = null; // o talebin hangi operasyon kaydı üzerinde çalışıyor
let tadilatExpandedIds = new Set(); // sadeleştirilmiş "Bekleyen" kartlarından hangileri detaylı gösteriliyor
let tadilatSubTab = 'talepler'; // 'talepler' | 'analiz'
function setTadilatSubTab(v){ tadilatSubTab = v; render(); }
// Tadilat için detaylı analiz: toplam süre, atölye kırılımı, kişi bazlı ve günlük dakika.
// G DÜZELTMESİ (iki nokta):
// 1) Artık isteğe bağlı bir [fromDate, toDate] tarih aralığı kabul ediyor (dönem karşılaştırması
//    yapılabilsin diye) — ikisi de boş bırakılırsa eskisi gibi TÜM geçmişi hesaplar.
// 2) Süre artık ham (bitisTs-baslamaTs) değil, entryDurationBreakdown() ile duruş süresi
//    DÜŞÜLMÜŞ net süre — bir tadilat operasyonu status:'duruş' olabiliyor (ör. malzeme
//    beklerken), eskiden bu bekleme süresi de "çalışma" gibi sayılıyordu.
// tadilatOperasyonlarArray()'ın döndürdüğü kayıtlar baslamaTs/bitisTs kullanıyor (entries'teki
// startTs/endTs değil) — entryDurationBreakdown bu adları bilmediği için doğrudan çağrılırsa
// e.startTs undefined kalıp NaN üretiyordu (görünmeyen bir hataydı: Tadilat Analizi'ndeki toplam/
// kişi/gün süreleri ile Tadilat Excel dışa aktarımının süre sütunları hep NaN oluyordu). Alanları
// eşleyip veriyoruz.
function tadilatOpDurationBreakdown(o){
  return entryDurationBreakdown({ ...o, startTs: o.baslamaTs, endTs: o.bitisTs });
}
function computeTadilatAnaliz(fromDate, toDate){
  const ops = [];
  let gecisToplamMs = 0;
  const gecisByPerson = {};
  tadilatArray().forEach(t=>{
    tadilatOperasyonlarArray(t).forEach(o=>{
      if(o.baslamaTs && o.bitisTs){
        const dk = dateKey(o.baslamaTs);
        if((!fromDate || dk>=fromDate) && (!toDate || dk<=toDate)){
          ops.push({ ...o, uKodu:t.uKodu, atolye:(t.atolye||'imalat'), _netMs: tadilatOpDurationBreakdown(o).netMs });
        }
      }
      // Kesinti sırasında "hangi işi alacağım" kararı verilirken geçen süre — duruşa sayılmıyor,
      // ayrı takip ediliyor (sadece SuperAdmin'in gördüğü bu Analiz ekranında).
      if(o.gecisSureToplamMs){
        gecisToplamMs += o.gecisSureToplamMs;
        gecisByPerson[o.operatorUsername] = (gecisByPerson[o.operatorUsername]||0) + o.gecisSureToplamMs;
      }
    });
  });
  const toplamMs = ops.reduce((s,o)=>s+o._netMs,0);
  const byAtolye = { imalat:{ms:0,count:0}, tadilat:{ms:0,count:0} };
  ops.forEach(o=>{ byAtolye[o.atolye].ms += o._netMs; byAtolye[o.atolye].count++; });
  const byPersonMap = {};
  ops.forEach(o=>{
    const k = o.operatorUsername;
    if(!byPersonMap[k]) byPersonMap[k] = { username:o.operatorUsername, name:o.operatorName, ms:0, count:0, imalatMs:0, tadilatMs:0 };
    byPersonMap[k].ms += o._netMs;
    byPersonMap[k].count++;
    byPersonMap[k][o.atolye+'Ms'] += o._netMs;
  });
  const byDayMap = {};
  ops.forEach(o=>{
    const dk = dateKey(o.baslamaTs);
    if(!byDayMap[dk]) byDayMap[dk] = { imalatMs:0, tadilatMs:0, count:0 };
    byDayMap[dk][o.atolye+'Ms'] += o._netMs;
    byDayMap[dk].count++;
  });
  const byDay = Object.entries(byDayMap).map(([gun,v])=>({gun, ...v, toplamMs:v.imalatMs+v.tadilatMs})).sort((a,b)=>b.gun.localeCompare(a.gun));
  return {
    opCount: ops.length, toplamMs, byAtolye,
    byPerson: Object.values(byPersonMap).sort((a,b)=>b.ms-a.ms),
    byDay, gecisToplamMs, gecisByPerson
  };
}
let tadilatAnalizFrom = '', tadilatAnalizTo = ''; // boş = tüm zamanlar (geriye dönük uyumlu varsayılan)
function setTadilatAnalizFrom(v){ tadilatAnalizFrom = v; render(); }
function setTadilatAnalizTo(v){ tadilatAnalizTo = v; render(); }
function setTadilatAnalizPreset(days){
  const today = new Date();
  tadilatAnalizTo = dateKey(today.getTime());
  const from = new Date(today);
  from.setDate(from.getDate() - (days-1));
  tadilatAnalizFrom = dateKey(from.getTime());
  render();
}
function clearTadilatAnalizFilter(){ tadilatAnalizFrom=''; tadilatAnalizTo=''; render(); }
function toggleTadilatExpand(id){
  if(tadilatExpandedIds.has(id)) tadilatExpandedIds.delete(id); else tadilatExpandedIds.add(id);
  render();
}
let _tadilatArrayCache = null, _tadilatArrayCacheSrc = null;
function tadilatArray(){
  if(_tadilatArrayCacheSrc !== tadilatlar){
    _tadilatArrayCache = Object.entries(tadilatlar).map(([id,v])=>({id, ...v}));
    _tadilatArrayCacheSrc = tadilatlar;
  }
  return _tadilatArrayCache;
}
// Eski (tek operasyonlu) kayıtlarla geriye dönük uyumluluk: operasyonlar alanı yoksa, eski
// düz alanlardan (baslayanUsername, baslamaTs, status...) tek bir "sonOperasyon" operasyonu türetiyoruz.
function tadilatOperasyonlarArray(t){
  if(t.operasyonlar) return Object.entries(t.operasyonlar).map(([id,v])=>({id, ...v})).sort((a,b)=>a.baslamaTs-b.baslamaTs);
  if(t.baslayanUsername){
    return [{ id:'legacy', operatorUsername:t.baslayanUsername, operatorName:t.baslayanName, baslamaTs:t.baslamaTs||0, bitisTs:t.bitisTs||null, status: t.status==='tamamlandi'?'tamamlandi':'devam', sonOperasyon:true, kaynakEntryId:t.kaynakEntryId||null }];
  }
  return [];
}
function tadilatAktifOperasyon(t){ return tadilatOperasyonlarArray(t).find(o=>o.status==='devam') || null; }
// Bir makinede şu an aktif bir tadilat operasyonu var mı? Makine Matrisi'nde ayrı bir renk/durum
// olarak göstermek için (üretim "entries" tablosunda hiç izi olmasa bile).
function tadilatAktifOnMachine(makineLabel){
  if(!makineLabel) return null;
  for(const t of tadilatArray()){
    const op = tadilatAktifOperasyon(t);
    if(op && op.makine===makineLabel) return { tadilat:t, operasyon:op };
  }
  return null;
}
function tadilatTamamlandiMi(t){ return tadilatOperasyonlarArray(t).some(o=>o.status==='tamamlandi' && o.sonOperasyon); }
function tadilatBekliyorMu(t){ return !tadilatTamamlandiMi(t) && !tadilatOperasyonlarArray(t).some(o=>o.status==='devam'||o.status==='duruş'); }
function tadilatBekleyenler(atolye){
  const list = tadilatArray().filter(t=>tadilatBekliyorMu(t)).sort((a,b)=>a.olusturmaTs-b.olusturmaTs);
  return atolye ? list.filter(t=>(t.atolye||'imalat')===atolye) : list;
}
// Bir kullanıcının erişebildiği TÜM atölyelerdeki bekleyen talepleri birleştirir (tekrarsız).
function tadilatBekleyenlerCombined(code){
  const atolyeler = getUserAtolyeler(code);
  const seen = new Set(); const out = [];
  atolyeler.forEach(a=>{ tadilatBekleyenler(a).forEach(t=>{ if(!seen.has(t.id)){ seen.add(t.id); out.push(t); } }); });
  return out;
}
function myActiveTadilatSession(){
  let paused = null;
  for(const t of tadilatArray()){
    const op = tadilatOperasyonlarArray(t).find(o=>o.status!=='tamamlandi' && o.operatorUsername===session.username);
    if(op){
      if(op.status==='devam') return { tadilat:t, operasyon:op };
      if(op.status==='duruş' && !paused) paused = { tadilat:t, operasyon:op };
    }
  }
  return paused;
}
// Kesinti zinciri yüzünden bir operatörün AYNI ANDA birden fazla yarım tadilatı olabilir (biri
// aktif, diğerleri duraklatılmış) — Makineler listesinde HİÇBİRİ kaybolmasın diye hepsini döner.
function myAllTadilatSessions(){
  const out = [];
  tadilatArray().forEach(t=>{
    tadilatOperasyonlarArray(t).forEach(op=>{
      if(op.status!=='tamamlandi' && op.operatorUsername===session.username) out.push({ tadilat:t, operasyon:op });
    });
  });
  return out.sort((a,b)=>{
    if(a.operasyon.status==='devam' && b.operasyon.status!=='devam') return -1;
    if(b.operasyon.status==='devam' && a.operasyon.status!=='devam') return 1;
    return (b.operasyon.duruşTs||b.operasyon.baslamaTs||0) - (a.operasyon.duruşTs||a.operasyon.baslamaTs||0);
  });
}
function canCreateTadilat(){
  if(!session) return false;
  if(session.isSuperAdmin) return true;
  if(!session.isAdmin) return false;
  const op = STATE.operators[session.username]||{};
  if(op.permTadilatOlustur===true) return true;
  if(op.permTadilatOlustur===false) return false;
  return !!(session.isSef || session.isUretimSef); // varsayılan: Şef/Üretim Şef açabilir, diğer yöneticiler kapalı (Ayarlar'dan açılabilir)
}
// Tamamlanan tadilatların süre/istatistik analizini sadece SuperAdmin görebilir — talep açma/alma
// yetkisi bundan ayrı (canCreateTadilat), Şef ve izinli diğer hesaplar hâlâ talep açabilir.
function canViewTadilatAnaliz(){ return !!(session && session.isSuperAdmin); }
function toggleTadilatYetkisi(code){
  const op = STATE.operators[code] || {};
  const effectiveNow = op.permTadilatOlustur===true ? true : (op.permTadilatOlustur===false ? false : !!(op.isSef || op.isUretimSef));
  DB.ref('operators/'+code+'/permTadilatOlustur').set(!effectiveNow);
}
// Operatör/yönetici en son hangi atölye için talep açtıysa, bir sonraki sefer form o atölyede
// açılsın diye kullanıcı bazlı hatırlıyoruz (localStorage) — her talepte "İmalat"a geri dönmesin.
function tadilatFormAtolyeGet(){
  const saved = load('tadilat_form_atolye_'+(session?session.username:'anon'), 'imalat');
  const allowed = session ? getUserAtolyeler(session.username) : ['imalat'];
  return allowed.includes(saved) ? saved : allowed[0];
}
function tadilatFormAtolyeSet(v){ save('tadilat_form_atolye_'+(session?session.username:'anon'), v); }
function addTadilat(){
  if(!canCreateTadilat()) return;
  const uKodu = (document.getElementById('tad-ukodu')?.value||'').trim();
  const kisaAciklama = (document.getElementById('tad-kisaaciklama')?.value||'').trim();
  const adet = (document.getElementById('tad-adet')?.value||'').trim();
  const bolum = document.getElementById('tad-bolum')?.value || '';
  const talepMakine = (document.getElementById('tad-makine')?.value||'').trim().toUpperCase();
  const talepEdenKisi = (document.getElementById('tad-kisi')?.value||'').trim();
  const atolye = document.getElementById('tad-atolye')?.value || 'imalat';
  const aciklama = (document.getElementById('tad-aciklama')?.value||'').trim();
  if(!uKodu){ toast('U kodu girin'); return; }
  if(!kisaAciklama){ toast('Açıklama girin'); return; }
  if(!adet){ toast('Adet girin'); return; }
  if(!/^\d+$/.test(adet)){ toast('Adet sadece rakam olmalı'); return; }
  const kisiErr = validateTalepEdenKisi(talepEdenKisi);
  if(kisiErr){ toast(kisiErr); return; }
  if(!bolum){ toast('Talep eden bölüm girin'); return; }
  const makineErr = validateTalepMakine(bolum, talepMakine);
  if(makineErr){ toast(makineErr); return; }
  if(!aciklama){ toast('Ne işlem yapılacağını girin'); return; }
  tadilatFormAtolyeSet(atolye);
  const id = uid();
  DB.ref('tadilatlar/'+id).set({
    uKodu, kisaAciklama, adet, bolum, talepMakine, talepEdenKisi: canonicalTalepEdenKisi(talepEdenKisi), atolye, aciklama,
    olusturanUsername: session.username, olusturanName: session.displayName, olusturmaTs: Date.now()
  }).then(()=>{
    toast('Tadilat talebi oluşturuldu');
    newTadilatForm = { uKodu:'', kisaAciklama:'', bolum:'', talepMakine:'', talepKisi:'', adet:'', aciklama:'', aciklamaManual:false };
    tadPresetSelections = {}; tadPresetInsertedLines = {};
    ['tad-ukodu','tad-kisaaciklama','tad-adet','tad-bolum','tad-makine','tad-kisi','tad-aciklama'].forEach(fid=>{ const el=document.getElementById(fid); if(el) el.value=''; });
  });
}
function deleteTadilat(id){
  if(!session || !session.isSuperAdmin){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return; }
  if(!confirm('Bu tadilat talebini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
  DB.ref('tadilatlar/'+id).remove();
}
// Rapor ekranındaki "Düzelt" ile aynı mantık: tadilat talebinin temel bilgilerini (kod, açıklama,
// adet, bölüm, makine, kişi, atölye) düzeltebilmek için — yöneticiler (canCreateTadilat) kullanır.
let tadilatEditId = null;
let tadilatEditForm = null;
function openTadilatEdit(id){
  if(!canCreateTadilat()) return;
  const t = tadilatlar[id]; if(!t) return;
  tadilatEditId = id;
  tadilatEditForm = { uKodu:t.uKodu||'', kisaAciklama:t.kisaAciklama||'', adet:t.adet||'', bolum:t.bolum||'', talepMakine:t.talepMakine||'', talepEdenKisi:t.talepEdenKisi||'', atolye:t.atolye||'imalat', aciklama:t.aciklama||'', aciklamaManual:false };
  render();
}
function cancelTadilatEdit(){ tadilatEditId = null; tadilatEditForm = null; render(); }
function saveTadilatEdit(id){
  if(!canCreateTadilat()) return;
  const uKodu = (document.getElementById('tedit-ukodu')?.value||'').trim();
  const kisaAciklama = (document.getElementById('tedit-kisaaciklama')?.value||'').trim();
  const adet = (document.getElementById('tedit-adet')?.value||'').trim();
  const bolum = document.getElementById('tedit-bolum')?.value || '';
  const talepMakine = (document.getElementById('tedit-makine')?.value||'').trim().toUpperCase();
  const talepEdenKisi = (document.getElementById('tedit-kisi')?.value||'').trim();
  const t0 = tadilatlar[id] || {};
  const atolye = session.isSuperAdmin ? (document.getElementById('tedit-atolye')?.value || 'imalat') : (t0.atolye || 'imalat');
  const aciklama = (document.getElementById('tedit-aciklama')?.value||'').trim();
  if(!uKodu){ toast('U kodu boş olamaz'); return; }
  if(!kisaAciklama){ toast('Açıklama boş olamaz'); return; }
  if(!adet){ toast('Adet boş olamaz'); return; }
  if(!/^\d+$/.test(adet)){ toast('Adet sadece rakam olmalı'); return; }
  const kisiErr2 = validateTalepEdenKisi(talepEdenKisi);
  if(kisiErr2){ toast(kisiErr2); return; }
  if(!bolum){ toast('Talep eden bölüm boş olamaz'); return; }
  const makineErr = validateTalepMakine(bolum, talepMakine);
  if(makineErr){ toast(makineErr); return; }
  if(!aciklama){ toast('Ne işlem yapılacağı boş olamaz'); return; }
  DB.ref('tadilatlar/'+id).update({ uKodu, kisaAciklama, adet, bolum, talepMakine, talepEdenKisi: canonicalTalepEdenKisi(talepEdenKisi), atolye, aciklama }).then(()=>{
    toast('Tadilat talebi güncellendi');
    cancelTadilatEdit();
  });
}
function renderTadilatEditModal(){
  const t = tadilatlar[tadilatEditId];
  if(!t || !tadilatEditForm){ tadilatEditId=null; return ''; }
  const f = tadilatEditForm;
  return `<div class="modal-overlay" onclick="if(event.target===this) cancelTadilatEdit()">
    <div class="modal-box" style="max-width:460px">
      <div class="modal-header">
        <div><div class="modal-title" style="font-size:18px">Tadilat Talebini Düzelt</div><div class="modal-sub">${fmtDT(t.olusturmaTs)} · ${esc(t.olusturanName)}</div></div>
        <button class="icon-btn" onclick="cancelTadilatEdit()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;align-items:flex-end">
          <div class="field" style="flex:1.3;margin-bottom:0"><label>U kodu</label><input id="tedit-ukodu" class="mono" value="${esc(f.uKodu)}" oninput="tadilatEditForm.uKodu=this.value" onblur="tadUkoduBlur('edit')"></div>
          <button type="button" class="btn-ghost" style="padding:10px 14px" title="Malzeme Ara" onclick="openMalzemeArama('edit')">${ico('search',14)}</button>
          <div class="field" style="flex:1;margin-bottom:0"><label>Adet</label><input id="tedit-adet" inputmode="numeric" value="${esc(f.adet)}" oninput="this.value=this.value.replace(/\\D/g,''); tadilatEditForm.adet=this.value"></div>
        </div>
        <div class="field" style="margin-top:14px"><label>Açıklama</label><input id="tedit-kisaaciklama" value="${esc(f.kisaAciklama)}" oninput="tadilatEditForm.kisaAciklama=this.value; tadilatEditForm.aciklamaManual=true"></div>
        <div style="display:flex;gap:8px">
          <div class="field" style="flex:1"><label>Talep eden bölüm</label><input id="tedit-bolum" list="tadilat-bolum-options" value="${esc(f.bolum)}" oninput="tadilatEditForm.bolum=this.value" onblur="render()"></div>
          <div class="field" style="flex:1"><label>Talep edilen makine</label><input id="tedit-makine" list="tadilat-makine-options-edit" value="${esc(f.talepMakine)}" oninput="tadilatEditForm.talepMakine=this.value"></div>
        </div>
        <datalist id="tadilat-bolum-options">${tadilatBolumOptions().map(b=>`<option value="${b}">`).join('')}</datalist>
        <datalist id="tadilat-makine-options-edit">${isMerkezleriFor(f.bolum).map(k=>`<option value="${esc(k)}">`).join('')}</datalist>
        <div class="field"><label>Talep eden kişi (ad soyad)</label><input id="tedit-kisi" list="uretim-personeli-options-edit" value="${esc(f.talepEdenKisi)}" oninput="tadilatEditForm.talepEdenKisi=this.value"></div>
        <datalist id="uretim-personeli-options-edit">${uretimPersoneliFor(f.bolum).map(p=>`<option value="${esc(p)}">`).join('')}</datalist>

        ${session.isSuperAdmin ? `
        <div class="field"><label>Atölye</label><select id="tedit-atolye">
          <option value="imalat" ${f.atolye==='imalat'?'selected':''}>${ico('factory',14)} İmalat Atölye</option>
          <option value="tadilat" ${f.atolye==='tadilat'?'selected':''}>${ico('wrench',14)} Tadilat Atölye</option>
        </select></div>` : `
        <input type="hidden" id="tedit-atolye" value="${esc(f.atolye)}">
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px">Atölye: ${f.atolye==='tadilat'?(ico('wrench',14)+' Tadilat Atölye'):(ico('factory',14)+' İmalat Atölye')}</div>`}
        <div class="field"><label>Ne işlem yapılacak?</label><textarea id="tedit-aciklama" oninput="tadilatEditForm.aciklama=this.value" style="min-height:80px">${esc(f.aciklama)}</textarea></div>
        <div style="display:flex;gap:10px">
          <button class="btn-primary" onclick="saveTadilatEdit('${t.id}')">${ico('check',14)} Kaydet</button>
          <button class="btn-ghost" onclick="cancelTadilatEdit()">${ico('x',14)} Vazgeç</button>
        </div>
      </div>
    </div>
  </div>`;
}
let tadilatMakineSecimId = null; // hangi bekleyen tadilat kartı için makine seçim kutusu açık
function openTadilatMakineSecim(id){ tadilatMakineSecimId = id; render(); }
function cancelTadilatMakineSecim(){ tadilatMakineSecimId = null; render(); }
// Operatörün şu an "Tadilat" sebebiyle duraklattığı bir üretim işi varsa, o işin makinesini
// otomatik makine önerisi olarak kullanıyoruz (çünkü tadilatı muhtemelen aynı makinede yapıyor).
function tadilatKaynakMakine(){
  const kaynakTad = myActiveTadilatSession();
  if(kaynakTad && kaynakTad.operasyon.status==='duruş' && kaynakTad.operasyon.makine) return kaynakTad.operasyon.makine;
  const kaynak = entriesArray().find(e => e.operatorUsername===session.username && e.status==='duruş' && isTadilatReason(e.duruşNedeni));
  return kaynak ? kaynak.makine : '';
}
// Faz 5 / Madde 6 — İç İçe Kesinti Zinciri: bir tadilat yaparken daha acil bir tadilat gelirse,
// operatör elindekini "Tadilat duruşu" sebebiyle duraklatabilir (aynı üretim işlerindeki duruş
// mekanizması) ve doğrudan yeni tadilata geçebilir. Yeni tadilatı bitirdiğinde otomatik olarak
// duraklattığı ilk tadilata geri döner — zincir kaç seviye derinleşirse derinleşsin, her adım
// bir öncekine referans taşıdığı için sırayla geri sarılır.
let tadilatDurusPickerOpen = false;
function openTadilatDurusPicker(){ tadilatDurusPickerOpen = true; render(); }
function cancelTadilatDurusPicker(){ tadilatDurusPickerOpen = false; render(); }
function confirmTadilatDurus(){
  const reason = durusReasonSel==='Diğer' ? (document.getElementById('durus-custom')?.value||'').trim() : durusReasonSel;
  if(!reason){ toast('Duruş nedeni seçmelisin'); return; }
  const sess = myActiveTadilatSession();
  if(!sess || sess.operasyon.status!=='devam'){ toast('Aktif bir tadilatın yok'); return; }
  const { tadilat: t, operasyon: op } = sess;
  const isInterrupt = isTadilatReason(reason);
  // Kesinti durumunda (başka bir tadilata geçiş) gerçek duruş sayacı HEMEN başlamıyor — hangi işi
  // alacağına karar verirken geçen süre A'nın duruşuna sayılmasın diye. Bu "seçim süresi" ayrı
  // (gecisBaslangic) tutuluyor; yeni tadilat FİİLEN başladığı an gerçek duruş sayacı da başlıyor
  // (bkz. tadilatAl), o ana kadarki fark ise "gecisSureToplamMs" olarak (sadece SuperAdmin görür) kaydediliyor.
  DB.ref(`tadilatlar/${t.id}/operasyonlar/${op.id}`).update({
    status:'duruş', duruşNedeni: reason,
    duruşTs: isInterrupt ? null : Date.now(),
    gecisBaslangic: isInterrupt ? Date.now() : null
  }).then(()=>{
    tadilatDurusPickerOpen = false; durusReasonSel=''; durusCustom='';
    toast('Duruş kaydedildi');
    if(isInterrupt){
      bigToast('Tadilat duraklatıldı — diğer tadilata geçebilirsin.');
      tadilatForceBekleyen = true;
      view = 'tadilat';
    } else {
      bigToast('Tadilat duraklatıldı.');
    }
    render();
  }).catch(err=>{ console.error(err); toast('Duraklatılamadı: '+(err&&err.message||'hata')); });
}
function devamEtTadilatDurus(){
  const sess = myActiveTadilatSession();
  if(!sess || sess.operasyon.status!=='duruş') return;
  const { tadilat: t, operasyon: op } = sess;
  const extra = op.duruşTs ? Math.max(0, Date.now()-op.duruşTs) : 0;
  const duruşToplamMs = (op.duruşToplamMs||0) + extra;
  const durusLog = (!isNaN(extra) && op.duruşNedeni!==GUN_SONU_REASON) ? appendDurusLog(op.durusLog, op.duruşNedeni, extra) : (op.durusLog||null);
  // GÜN SONU süresini de (durusLog'a benzer şekilde) zaman damgalı ayrı bir listede tutuyoruz —
  // yoksa "hangi gün ne kadarı Gün Sonu'na ait" bilinemiyor, günlere bölünürken bu süre ya hiç
  // düşülmüyor (Özet tablosu şişiyor) ya da yanlış güne düşülüyor (Gantt'ta iş "hiç yapılmamış"
  // gibi sıfırlanıyor) — bkz. renderMachineModal'daki gün-bazlı bölme mantığı.
  const excludedLog = (!isNaN(extra) && op.duruşNedeni===GUN_SONU_REASON) ? appendDurusLog(op.excludedLog, op.duruşNedeni, extra) : (op.excludedLog||null);
  // Hiç gerçek duruş başlamadan (kesinti sonrası "hangi işi alacağım" kararı verilirken) direkt
  // "Devam Ettir"e basılırsa, o karar süresi de geçiş süresine (duruşa değil) ekleniyor.
  const gecisEk = (!op.duruşTs && op.gecisBaslangic) ? Math.max(0, Date.now()-op.gecisBaslangic) : 0;
  const gecisSureToplamMs = (op.gecisSureToplamMs||0) + gecisEk;
  DB.ref(`tadilatlar/${t.id}/operasyonlar/${op.id}`).update({ status:'devam', duruşNedeni:null, duruşTs:null, gecisBaslangic:null, duruşToplamMs, gecisSureToplamMs, durusLog, excludedLog }).then(()=>{
    toast('Duruş kaydedildi');
    render();
  });
}
// "Diğer tadilata geçebilirsin" uyarısında yanlışlıkla duraklattıysa ya da vazgeçtiyse, direkt
// buradan iptal edip duraklattığı işe geri dönebilsin diye. Duraklatılan iş ya AKTİF BİR TADİLAT
// (confirmTadilatDurus'tan gelir, devamEtTadilatDurus bunu bulur) ya da NORMAL BİR ÜRETİM İŞİ
// olabilir (confirmDurus'tan tadilat nedenli duruş verilince gelir) — devamEtTadilatDurus sadece
// tadilat oturumlarını bildiği için ikinci durumda hiçbir şey yapmadan sessizce çıkıyor ve buton
// tepkisiz görünüyordu. İkisini de kontrol edip uygun olanı devam ettiriyoruz.
function cancelTadilatInterrupt(){
  tadilatForceBekleyen = false;
  const sess = myActiveTadilatSession();
  if(sess && sess.operasyon.status==='duruş'){ devamEtTadilatDurus(); return; }
  const entry = entriesArray().find(e => e.operatorUsername===session.username && e.status==='duruş' && isTadilatReason(e.duruşNedeni));
  if(entry){ devamEt(entry.id); activeDetailId = entry.id; activeGroupId = entry.groupId || null; view = 'list'; }
  render();
}
function tadilatAl(tadilatId, makine){
  const t = tadilatlar[tadilatId]; if(!t || !tadilatBekliyorMu(t)){ toast('Bu talep şu an müsait değil'); return; }
  if(!makine){ toast('Hangi makinede yapacağını seç'); return; }
  // Kaynak önceliği: önce operatörün "Tadilat duruşu" ile duraklattığı BAŞKA bir tadilat var mı
  // bak (iç içe kesinti zinciri) — yoksa madde 3/4'teki gibi duraklattığı bir üretim işine bak.
  const kaynakTad = myActiveTadilatSession();
  const kaynakTadGecerli = kaynakTad && kaynakTad.operasyon.status==='duruş' && isTadilatReason(kaynakTad.operasyon.duruşNedeni);
  const kaynak = !kaynakTadGecerli ? entriesArray().find(e => e.operatorUsername===session.username && e.status==='duruş' && isTadilatReason(e.duruşNedeni)) : null;
  const opId = uid();
  const now = Date.now();
  // Duraklattığı tadilat (kaynakTad) için gerçek duruş sayacı ŞİMDİ başlıyor — o ana kadar (hangi
  // işi alacağına karar verirken) geçen süre duruşa hiç sayılmıyor, ayrı bir alanda toplanıyor.
  if(kaynakTadGecerli){
    const kOp = kaynakTad.operasyon;
    const gecisSuresi = kOp.gecisBaslangic ? Math.max(0, now - kOp.gecisBaslangic) : 0;
    DB.ref(`tadilatlar/${kaynakTad.tadilat.id}/operasyonlar/${kOp.id}`).update({
      duruşTs: now, gecisBaslangic: null,
      gecisSureToplamMs: (kOp.gecisSureToplamMs||0) + gecisSuresi
    });
  }
  DB.ref(`tadilatlar/${tadilatId}/operasyonlar/${opId}`).set({
    operatorUsername: session.username, operatorName: session.displayName, makine,
    baslamaTs: now, bitisTs: null, status:'devam', sonOperasyon: false,
    kaynakEntryId: kaynak ? kaynak.id : null,
    kaynakTadilatRef: kaynakTadGecerli ? { tadilatId: kaynakTad.tadilat.id, opId: kaynakTad.operasyon.id } : null
  }).then(()=>{
    activeTadilatId = tadilatId;
    activeTadilatOpId = opId;
    tadilatMakineSecimId = null;
    tadilatForceBekleyen = false;
    render();
  }).catch(err=>{ console.error(err); toast('Tadilat alınamadı: '+(err&&err.message||'hata')); });
}
// Aktif operasyonu bitirir. "Son operasyon mu" kararı artık İŞE BAŞLARKEN değil, İŞİ BİTİRİRKEN
// veriliyor — çünkü operatör çoğu zaman işin tek seferde mi bitecek yoksa devamı mı gelecek
// bunu ancak işin içine girince anlıyor. sonOperasyon true ise talep tamamen kapanır; false ise
// talep tekrar "bekleyen" listesine döner (bir sonraki operasyon için). Kaynak (üretim işi VEYA
// duraklatılmış başka bir tadilat) varsa, bu SADECE bu operatörün kendi duraklattığı şeyi geri
// getirir — talebin genel kapanma durumundan bağımsız çalışır.
function tadilatBitir(tadilatId, opId, sonOperasyon){
  const t = tadilatlar[tadilatId]; if(!t) return;
  const isLegacy = !t.operasyonlar && opId==='legacy';
  const opRefPath = isLegacy ? null : `tadilatlar/${tadilatId}/operasyonlar/${opId}`;
  const op = tadilatOperasyonlarArray(t).find(o=>o.id===opId);
  if(!op){ toast('Operasyon bulunamadı'); return; }
  const bitisTs = Date.now();
  const writeP = isLegacy
    ? DB.ref('tadilatlar/'+tadilatId).update({ status:'tamamlandi', bitisTs }) // eski kayıt formatı
    : DB.ref(opRefPath).update({ status:'tamamlandi', bitisTs, sonOperasyon: !!sonOperasyon });
  writeP.then(()=>{
    let kaynakVarMi = false, kaynakTadilatVarMi = false;
    // Önce iç içe kesinti zinciri: duraklatılmış başka bir tadilat varsa ona dön.
    if(op.kaynakTadilatRef && op.kaynakTadilatRef.tadilatId){
      const kt = tadilatlar[op.kaynakTadilatRef.tadilatId];
      const kop = kt && kt.operasyonlar && kt.operasyonlar[op.kaynakTadilatRef.opId];
      if(kop && kop.status==='duruş'){
        // Duraklatılmış tadilatı olduğu gibi (hâlâ duruşta) bırakıyoruz — operatör "Devam Ettir"e
        // basınca kaldığı yerden sürdürüyor. Burada sadece ekranı ona yönlendiriyoruz.
        activeTadilatId = op.kaynakTadilatRef.tadilatId;
        activeTadilatOpId = op.kaynakTadilatRef.opId;
        kaynakTadilatVarMi = true;
      }
    }
    if(!kaynakTadilatVarMi && op.kaynakEntryId){
      const src = STATE.entries[op.kaynakEntryId];
      if(src && src.status==='duruş'){
        const extra = src.duruşTs ? Math.max(0, Date.now()-src.duruşTs) : 0;
        const duruşToplamMs = (src.duruşToplamMs||0) + extra;
        const durusLog = (src.duruşNedeni!==GUN_SONU_REASON) ? appendDurusLog(src.durusLog, src.duruşNedeni, extra) : (src.durusLog||null);
        const excludedLog = (src.duruşNedeni===GUN_SONU_REASON) ? appendDurusLog(src.excludedLog, src.duruşNedeni, extra) : (src.excludedLog||null);
        DB.ref('entries/'+op.kaynakEntryId).update({ duruşNedeni: TADILAT_SONRASI_REASON, duruşTs: Date.now(), duruşToplamMs, durusLog, excludedLog });
        kaynakVarMi = true;
      }
    }
    if(!kaynakTadilatVarMi) { activeTadilatId = null; activeTadilatOpId = null; }
    if(sonOperasyon){
      bigToast(kaynakTadilatVarMi
        ? 'Tadilat tamamlandı. Duraklattığın önceki tadilata dönüyorsun.'
        : kaynakVarMi
        ? 'Tadilat tamamlandı. Tadilat duruşu devam ettirildi ve tadilat sonrası ayar duruşu başlatıldı.'
        : 'Tadilat tamamlandı.');
    } else {
      bigToast(kaynakTadilatVarMi
        ? 'Bu operasyon tamamlandı, tadilat sıradaki operasyonu bekliyor. Duraklattığın önceki tadilata dönüyorsun.'
        : kaynakVarMi
        ? 'Bu operasyon tamamlandı, tadilat sıradaki operasyonu bekliyor. Tadilat duruşu devam ettirildi ve tadilat sonrası ayar duruşu başlatıldı.'
        : 'Bu operasyon tamamlandı — tadilat sıradaki operasyon için bekleyenler listesine döndü.');
    }
    if(!kaynakTadilatVarMi && kaynakVarMi) activeDetailId = op.kaynakEntryId;
    view = kaynakTadilatVarMi ? 'tadilat' : 'list';
    render();
  }).catch(err=>{ console.error(err); toast('Tadilat bitirilemedi: '+(err&&err.message||'hata')); });
}
function fasonBekleyenCount(){
  return entriesArray().filter(e => (e.status==='devam'||e.status==='duruş') && isFasonMachine(e.makine)).length;
}
function allMachineCodes(){ return allMachines().map(m=>m.code); }
function resolveMachineLabel(code){ const m = allMachines().find(x=>x.code===code); return m ? `${m.code} · ${m.name}` : ""; }
let session = load('rota_remember', false) ? load('rota_session', null) : null;
let theme = load('rota_theme', 'dark');
let view = 'list';
let nowTick = Date.now();
let newForm = { isEmriNo:'', bilesen:'', makine:'', malzemeCinsi:'', capBoy:'', adet:'', not:'', sonOperasyon:false, stockItemId:'', stockMiktar:'', cokluMode:false, cokluItems:[{isEmriNo:'',bilesen:'',adet:'',stockItemId:'',stockMiktar:''},{isEmriNo:'',bilesen:'',adet:'',stockItemId:'',stockMiktar:''}] };
function toggleCokluMode(v){ newForm.cokluMode = v; render(); }
function addCokluItem(){ newForm.cokluItems.push({isEmriNo:'',bilesen:'',adet:'',stockItemId:'',stockMiktar:''}); render(); }
function removeCokluItem(i){ newForm.cokluItems.splice(i,1); render(); }
let activeDetailId = null; // görüntülenen aktif işin id'si (Makineler listesinden tıklanan)
let activeGroupId = null; // görüntülenen çoklu iş emri grubunun id'si
function openGroupDetail(groupId){ activeGroupId = groupId; render(); }
function closeGroupDetail(){ activeGroupId = null; view='list'; render(); }
let editingActiveId = null; // düzenleme modunda olan aktif işin id'si
let editForm = { talepNo:'', malzemeCinsi:'', capBoy:'', adet:'', not:'', sonOperasyon:false };
function openEditActive(id){
  const active = STATE.entries[id] || {};
  editingActiveId = id;
  editForm = { talepNo: active.talepNo || active.isEmriNo || '', malzemeCinsi: active.malzemeCinsi||'', capBoy: active.capBoy||'', adet: active.adet||'', not: active.not||'', sonOperasyon: !!active.sonOperasyon };
  render();
}
function cancelEditActive(){ editingActiveId = null; render(); }
function saveEditActive(id){
  const before = STATE.entries[id] || {};
  const talepNoRaw = (document.getElementById('edit-talepno').value||'').trim();
  const malzemeCinsi = (document.getElementById('edit-malzeme-cinsi').value||'').trim();
  const capBoy = (document.getElementById('edit-cap-boy').value||'').trim();
  const adet = (document.getElementById('edit-adet').value||'').trim();
  const not = (document.getElementById('edit-not').value||'').trim();
  const sonOperasyon = !!document.getElementById('edit-son-operasyon')?.checked;
  if(!talepNoRaw){ toast('İş Talep No boş olamaz'); return; }
  if(!adet){ toast('Adet boş olamaz'); return; }
  if(!/^\d+$/.test(adet)){ toast('Adet sadece rakam olmalı'); return; }
  if(!isEmriValid(talepNoRaw)){ toast(`"${talepNoRaw}" bulunamadı, lütfen kodunuzu kontrol edin`); return; }

  // U kodu operatör tarafından elle girilmiyor — Talep No'dan, aynı "+ Yeni Kayıt" akışındaki gibi
  // ERP listesinden otomatik çözülüyor. Varsa mevcut bileşen (_ZARF/_ELMAS) korunuyor.
  const existingBilesen = bilesenOfCode(before.isEmriNo);
  const { isEmriNo, talepNo } = resolveTrackingCode(talepNoRaw, existingBilesen);

  const fieldLabels = { talepNo:'İş Talep No', malzemeCinsi:'Malzeme Cinsi', capBoy:'Çap ve Boy', adet:'Adet', not:'Not', sonOperasyon:'Son Operasyon' };
  const after = { isEmriNo, talepNo, malzemeCinsi, capBoy, adet, not, sonOperasyon };
  const changes = [];
  Object.keys(fieldLabels).forEach(f=>{
    const oldV = f==='sonOperasyon' ? (before[f]?'Evet':'Hayır') : (before[f]||'');
    const newV = f==='sonOperasyon' ? (after[f]?'Evet':'Hayır') : (after[f]||'');
    if(oldV !== newV) changes.push({ field: fieldLabels[f], oldValue: oldV||'—', newValue: newV||'—' });
  });

  DB.ref('entries/'+id).update(after);

  if(changes.length>0){
    const mid = uid();
    DB.ref('messages/'+mid).set({
      type: 'edit', isEmriNo: before.isEmriNo, operatorUsername: session.username, operatorName: session.displayName,
      makine: before.makine||'', changes, ts: Date.now(), read: false
    });
  }

  toast('Güncellendi');
  editingActiveId = null;
  render();
}
let durusOpen = false, durusReasonSel = '', durusCustom = '';
let pwForm = { current:'', next:'', confirm:'' };
let loginForm = { username:'', password:'' };
let loginError = '';
let reportFilter = { isEmriNo:'', tarihFrom:'', tarihTo:'' };
let reportOperatorFilter = new Set();
let reportMakineFilter = new Set();
let reportOperatorDropdownOpen = false;
let reportMakineDropdownOpen = false;
function toggleReportOperatorDropdown(){ reportOperatorDropdownOpen = !reportOperatorDropdownOpen; reportMakineDropdownOpen=false; render(); }
function toggleReportMakineDropdown(){ reportMakineDropdownOpen = !reportMakineDropdownOpen; reportOperatorDropdownOpen=false; render(); }
function toggleReportOperatorSelect(code){ if(reportOperatorFilter.has(code)) reportOperatorFilter.delete(code); else reportOperatorFilter.add(code); reportSelectedIds=new Set(); render(); }
function toggleReportMakineSelect(label){ if(reportMakineFilter.has(label)) reportMakineFilter.delete(label); else reportMakineFilter.add(label); reportSelectedIds=new Set(); render(); }
function clearReportOperatorFilter(){ reportOperatorFilter.clear(); reportSelectedIds=new Set(); render(); }
function clearReportMakineFilter(){ reportMakineFilter.clear(); reportSelectedIds=new Set(); render(); }
let accessOperator = '';
let settingsSubTab = 'access';
let showMachineList = false;
let matrixSort = 'alpha'; // 'alpha' | 'calisma'
function setMatrixSort(v){ matrixSort = v; render(); }
// Makine grupları — Makine Matrisi ekranında gruba göre filtreleme için.
const MACHINE_GROUPS = [
  { name: 'Torna', codes: ['UT01','UT02','UT03'] },
  { name: 'Freze-Matkap', codes: ['UF01','SM01','KCM01'] },
  { name: 'Parlatma', codes: ['PT01','PT02'] },
  { name: 'EDM', codes: ['TE01','TE02','DE01','DE02','DE03','DDTE01'] },
  { name: 'CNC', codes: ['C01','C02'] },
  { name: 'Taşlama', codes: ['ODT01','ODT02','ODT03','MDT01'] },
];
function machineGroupOf(code){
  const g = MACHINE_GROUPS.find(g=>g.codes.includes(code));
  return g ? g.name : 'Diğer';
}
let matrixGroupFilter = 'Tümü';
function setMatrixGroupFilter(v){ matrixGroupFilter = v; render(); }
let matrixAtolyeFilter = 'tumu'; // 'tumu' | 'imalat' | 'tadilat'
function setMatrixAtolyeFilter(v){ matrixAtolyeFilter = v; render(); }
let machineModal = null; // açık modal'ın makine kodu
let entryDetailId = null; // Rapor tablosunda tıklanan tek kaydın detay penceresi
function openEntryDetail(id){ entryDetailId = id; render(); }
function closeEntryDetail(){ entryDetailId = null; render(); }
let reportEditId = null; // Rapor tablosunda "Düzelt" ile açılan düzenleme penceresi
let reportEditForm = null;
function openReportEdit(id){
  if(!canEditReport()) return;
  const e = STATE.entries[id]; if(!e) return;
  reportEditId = id;
  reportEditForm = { isEmriNo:e.isEmriNo||'', talepNo:e.talepNo||'', malzemeCinsi:e.malzemeCinsi||'', capBoy:e.capBoy||'', adet:e.adet||'', not:e.not||'', sonOperasyon:!!e.sonOperasyon, status:e.status||'tamamlandi' };
  render();
}
function closeReportEdit(){ reportEditId = null; reportEditForm = null; render(); }
function saveReportEdit(){
  if(!canEditReport() || !reportEditId) return;
  const isEmriNo = (document.getElementById('redit-isemri')?.value||'').trim().toUpperCase();
  const talepNo = (document.getElementById('redit-talepno')?.value||'').trim().toUpperCase();
  const malzemeCinsi = (document.getElementById('redit-malzeme')?.value||'').trim();
  const capBoy = (document.getElementById('redit-capboy')?.value||'').trim();
  const adet = (document.getElementById('redit-adet')?.value||'').trim();
  const not = (document.getElementById('redit-not')?.value||'').trim();
  const sonOperasyon = !!document.getElementById('redit-sonop')?.checked;
  const status = document.getElementById('redit-status')?.value||'tamamlandi';
  if(!isEmriNo){ toast('İş Emri No (U kodu) boş olamaz'); return; }
  if(adet && !/^\d+$/.test(adet)){ toast('Adet sadece rakam olmalı'); return; }
  const patch = { isEmriNo, talepNo, malzemeCinsi, capBoy, adet, not, sonOperasyon, status };
  if(status!=='devam' && !STATE.entries[reportEditId]?.endTs){ patch.endTs = STATE.entries[reportEditId]?.startTs || Date.now(); }
  if(status==='devam'){ patch.endTs = null; }
  DB.ref('entries/'+reportEditId).update(patch).then(()=>{
    toast('Kayıt güncellendi');
    closeReportEdit();
  });
}
function renderReportEditModal(){
  const e = STATE.entries[reportEditId];
  if(!e || !reportEditForm){ reportEditId=null; return ''; }
  const f = reportEditForm;
  return `<div class="modal-overlay" onclick="if(event.target===this) closeReportEdit()">
    <div class="modal-box" style="max-width:480px">
      <div class="modal-header">
        <div><div class="modal-title" style="font-size:18px">Kaydı Düzelt</div><div class="modal-sub">${esc(e.makine||'—')} · ${dateKey(e.startTs)}</div></div>
        <button class="icon-btn" onclick="closeReportEdit()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>İş Emri No (U kodu)</label><input id="redit-isemri" class="mono" value="${esc(f.isEmriNo)}"></div>
        <div class="field"><label>İş Talep No</label><input id="redit-talepno" class="mono" value="${esc(f.talepNo)}"></div>
        <div style="display:flex;gap:8px">
          <div class="field" style="flex:1"><label>Malzeme Cinsi</label><input id="redit-malzeme" value="${esc(f.malzemeCinsi)}"></div>
          <div class="field" style="flex:1"><label>Çap ve Boy</label><input id="redit-capboy" value="${esc(f.capBoy)}"></div>
        </div>
        <div style="display:flex;gap:8px">
          <div class="field" style="flex:1"><label>Adet</label><input id="redit-adet" inputmode="numeric" value="${esc(f.adet)}"></div>
          <div class="field" style="flex:1"><label>Durum</label><select id="redit-status">
            <option value="devam" ${f.status==='devam'?'selected':''}>Devam Ediyor</option>
            <option value="duruş" ${f.status==='duruş'?'selected':''}>Duruşta</option>
            <option value="tamamlandi" ${f.status==='tamamlandi'?'selected':''}>Tamamlandı</option>
          </select></div>
        </div>
        <div class="field"><label>Not</label><input id="redit-not" value="${esc(f.not)}"></div>
        ${switchRow('redit-sonop', f.sonOperasyon, 'Son Operasyon', 'Bu rotanın son adımı mı', {style:'margin-bottom:14px'})}
        <div style="display:flex;gap:10px">
          <button class="btn-ghost" style="flex:1" onclick="closeReportEdit()">Vazgeç</button>
          <button class="btn-primary" style="flex:1" onclick="saveReportEdit()">Kaydet</button>
        </div>
      </div>
    </div>
  </div>`;
}
let modalSelectedIds = new Set();
let modalVisibleIds = [];
let reportSelectedIds = new Set();
let reportVisibleIds = [];
let completedSearch = '';
let completedViewMode = 'tumu'; // 'tumu' | 'birlesik'
function setCompletedViewMode(v){ completedViewMode = v; render(); }
let analizFrom = dateKey(Date.now());
let analizTo = analizFrom;
let analizSubTab = 'genel';
let sendMsgOpen = false;
let gecmisFrom = '', gecmisTo = '', gecmisSearch = '';
function setGecmisSearch(v){ gecmisSearch=v; render(); }
function setGecmisFrom(v){ gecmisFrom=v; render(); }
function setGecmisTo(v){ gecmisTo=v; render(); }
function setGecmisPreset(days){
  const today = new Date();
  gecmisTo = dateKey(today.getTime());
  const from = new Date(today);
  from.setDate(from.getDate() - (days-1));
  gecmisFrom = dateKey(from.getTime());
  render();
}
function clearGecmisFilter(){ gecmisFrom=''; gecmisTo=''; gecmisSearch=''; render(); }
function openSendMessage(){ sendMsgOpen = true; render(); }
function cancelSendMessage(){ sendMsgOpen = false; render(); }
function submitSendMessage(){
  const text = (document.getElementById('send-msg-text').value||'').trim();
  if(!text){ toast('Mesaj boş olamaz'); return; }
  const mid = uid();
  DB.ref('messages/'+mid).set({
    type: 'manual', operatorUsername: session.username, operatorName: session.displayName,
    text, ts: Date.now(), read: false
  });
  toast('Mesaj gönderildi');
  sendMsgOpen = false;
  render();
}
function renderSendMessageModal(){
  return `<div class="modal-overlay" onclick="if(event.target===this) cancelSendMessage()">
    <div class="modal-box" style="max-width:400px">
      <div class="modal-header">
        <div><div class="modal-title">Mesaj Gönder</div><div class="modal-sub">💡 Öneri, sorun ya da aklına gelen her şey</div></div>
        <button class="icon-btn" onclick="cancelSendMessage()">${ico('x',14)}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Mesajın</label><textarea id="send-msg-text" style="min-height:110px" placeholder="Aklına gelen öneriyi ya da bahsetmek istediğin şeyi yaz…"></textarea></div>
        <div style="display:flex;gap:10px">
          <button class="btn-primary" onclick="submitSendMessage()">${ico('check',14)} Gönder</button>
          <button class="btn-ghost" onclick="cancelSendMessage()">${ico('x',14)} Vazgeç</button>
        </div>
      </div>
    </div>
  </div>`;
}
let messagesModalOpen = false;
function unreadMessageCount(){ return Object.values(STATE.messages||{}).filter(m=>!m.read).length; }
function canViewMessages(){
  if(!session) return false;
  if(session.isSuperAdmin) return true;
  return !!(STATE.operators[session.username]||{}).messagesAccess;
}
function openMessagesModal(){
  messagesModalOpen = true;
  // Açılınca tüm mesajları okundu say (rozet sıfırlansın)
  Object.entries(STATE.messages||{}).forEach(([mid,m])=>{ if(!m.read) DB.ref('messages/'+mid+'/read').set(true); });
  render();
}
function closeMessagesModal(){ messagesModalOpen = false; render(); }
function renderMessagesModal(){
  const list = Object.entries(STATE.messages||{}).map(([id,m])=>({id,...m})).sort((a,b)=>b.ts-a.ts);
  return `<div class="modal-overlay" onclick="if(event.target===this) closeMessagesModal()">
    <div class="modal-box">
      <div class="modal-header">
        <div><div class="modal-title">Mesajlar</div><div class="modal-sub">Değişiklik bildirimleri ve serbest mesajlar</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          ${session.isSuperAdmin && list.length>0 ? `<button class="btn-ghost" style="border-color:var(--danger);color:var(--danger);font-size:11.5px" onclick="deleteAllMessages()">${ico('trash',14)} Tümünü Sil</button>` : ''}
          <button class="icon-btn" onclick="closeMessagesModal()">${ico('x',14)}</button>
        </div>
      </div>
      <div class="modal-body">
        ${list.length===0 ? `<div style="text-align:center;color:var(--text-muted);padding:30px 0">Henüz mesaj yok.</div>` : list.map(m=>`
          <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              <div style="font-weight:700;color:var(--accent);font-size:13.5px;margin-bottom:2px">${m.type==='manual'?(ico('mail',14)+' Serbest Mesaj'):(ico('edit',14)+' İş Üzerinde Değişiklik')}</div>
              ${session.isSuperAdmin ? `<button class="del-btn" onclick="deleteMessage('${m.id}')" title="Sil">${ico('trash',14)}</button></div>` : `</div>`}
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${fmtDT(m.ts)}</div>
            ${m.type==='manual' ? `
              <div class="mono" style="font-size:12.5px;color:var(--text-muted);margin-bottom:6px">${esc(m.operatorUsername)} · ${esc(m.operatorName)}</div>
              <div style="font-size:13px;white-space:pre-wrap">${esc(m.text)}</div>
            ` : `
              <div class="mono" style="font-size:12.5px;color:var(--text-muted);margin-bottom:6px">${esc(m.operatorUsername)} · ${esc(m.operatorName)} · ${esc((m.makine||'').split(' · ')[0]||'—')}</div>
              ${(m.changes||[]).map(c=>`<div style="font-size:12.5px;margin-top:4px"><b>${esc(c.field)}</b> değiştirildi — Eskiden: <span style="color:var(--danger)">${esc(c.oldValue)}</span> · Şimdi: <span style="color:var(--success)">${esc(c.newValue)}</span></div>`).join('')}
            `}
          </div>
        `).join('')}
      </div>
    </div>
  </div>`;
}
function deleteMessage(id){
  if(!requireSuperAdmin()) return;
  if(!confirm('Bu mesajı silmek istediğine emin misin?')) return;
  DB.ref('messages/'+id).remove();
}
function deleteAllMessages(){
  if(!requireSuperAdmin()) return;
  if(!confirm('Tüm mesajları silmek istediğine emin misin? Bu işlem geri alınamaz.')) return;
  // Güvenlik kuralları kök düğüme toplu yazmayı engellediği için tek tek siliyoruz.
  Object.keys(STATE.messages||{}).forEach(mid => DB.ref('messages/'+mid).remove());
}

let analizSelectedMachines = new Set(); // Genel Analiz'deki mini matristen seçilen makine kodları (çoklu filtre)
let analizSelectedOperator = null; // Kişi Bazlı Analiz'de detayı açık olan operatör
let analizMiniSort = 'alpha'; // 'alpha' | 'calisma' | 'renk'
let analizAtolyeFilter = 'tumu'; // 'tumu' | 'imalat' | 'tadilat' — tüm Analiz sekmesini makinenin atölyesine göre süzer
function setAnalizAtolyeFilter(v){ analizAtolyeFilter = v; analizSelectedMachines = new Set(); render(); }
function setAnalizMiniSort(v){ analizMiniSort = v; render(); }
function toggleAnalizMachineFilter(code){
  if(analizSelectedMachines.has(code)) analizSelectedMachines.delete(code);
  else analizSelectedMachines.add(code);
  render();
}
function clearAnalizMachineFilter(){ analizSelectedMachines.clear(); render(); }
function setAnalizSubTab(t){ analizSubTab = t; render(); }
function setAnalizOperator(username){ analizSelectedOperator = (analizSelectedOperator===username) ? null : username; render(); }
const WORKDAY_MINUTES = 540; // gün içi standart çalışma süresi (dk)
const WORKDAY_END_MINUTE = 17*60+30; // 17:30 — bu saatten sonrası mesai sayılır
let routeModal = null; // {base, activeSuffix, finishedAt}
function openRouteDetail(isEmriNo, finishedAt){
  routeModal = { base: baseIsEmriNo(isEmriNo), activeSuffix: bilesenOfCode(isEmriNo) || 'ANA', finishedAt: Number(finishedAt) };
  render();
}
function closeRouteDetail(){ routeModal = null; render(); }
function setRouteModalTab(suf){ routeModal.activeSuffix = suf; routeModal.finishedAt = null; render(); }
// Aynı taban koda (U kodu) ait, verilen bileşen türündeki tamamlanmış rotaları (en yeni önce) döner.
function routesForBaseSuffix(base, suf){
  return computeCompletedRoutes().filter(r=>{
    return baseIsEmriNo(r.isEmriNo)===base && (bilesenOfCode(r.isEmriNo)||'ANA')===suf;
  }).sort((a,b)=>b.finishedAt-a.finishedAt);
}
let modalDateFilter = '';
let DB = null, FB_OK = false, connOK = false;

setInterval(()=>{
  nowTick = Date.now();
  if(!session) return;
  // Etkileşim penceresi (tıklamadan sonraki 500ms) yüzünden ertelenmiş bir Firebase güncellemesi
  // varsa, artık uygunsa (kullanıcı bir şeyle uğraşmıyorsa) burada yakalayıp gösteriyoruz —
  // yoksa güncelleme kaybolup, kullanıcı sekme değiştirip geri dönene kadar ekranda görünmüyordu.
  if(pendingSafeRender && !isUserInteracting()){ pendingSafeRender = false; render(); return; }
  renderLiveBits();
}, 1000);

