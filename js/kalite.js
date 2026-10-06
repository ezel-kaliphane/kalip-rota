/* ===================== FİNAL KALİTE KONTROL (06.10.2026, kullanıcı isteği) =====================
   Kullanıcının akışı (FKK planı):
     FKK → Onay        → kalıp stok teslim (atölye dışı birim — sistemde yer kaydı yok)
         → Şartlı kabul → gerekli açıklama → K-stok teslim (takip edilmiyor, yalnız sonuç)
         → Red → Revizyonla kurtarılabilir mi?  Evet → geçmiş rotadan operasyon seçimi (rota açık kalır)
                 Hayır → Başka yerde kullanılabilir mi?  Hayır → HURDA
                         Evet → Bu hâli ile kullanılabilir mi?  Evet → K-stok teslim
                                                               Hayır → YARI MAMUL DEPOSU (giriş tarihi)
   Kararlar: (1) bir iş emri birden fazla sonuca DAĞILIR (10 parçadan 7 onay, 1 şartlı, 2 red; red
   olanlar da revizyon/hurda… diye dağılır); (2) yarı mamul deposu görülür, ileride başka iş emri
   oradan tüketir (örn. M6 kalıbında delik büyük işlendi → M8 kalıbında delik büyütülerek
   kullanılabilir); (3) hedef iş emri zorunlu değil; (4) kaliteci şef — kararı FKK anında verebilir,
   yine de "karar sonra" seçeneği var (Şef/SuperAdmin İş Yoğunluğu'ndan karar verir); (6) maliyet
   ileride: hurda kaydı iş emrine ve rotasına bağlı kalıyor ki rota süreleri × makine saat ücreti +
   malzeme ile hesaplanabilsin.

   VERİ (kural değişikliği yok — entries/$id ek alanlara açık):
     entries/{id}/kalite = { surum:2, kontrolNo, kontrolAdet,
       dagilim:{ onay, sartli, red, revizyon, kstok, yariMamul, hurda, bekliyor },
       sartliNeden, sartliAciklama, sartliHataOp, redNeden, redAciklama, redHataOp,
       geriMakine, kullanimNotu, ts, username, name,
       (…HataOp = { entryId, makine, operatorUsername, operatorName } | { belirsiz:true } — hatanın
        oluştuğu operasyon ve kişi, geçmiş rotadan seçilir; 06.10.2026 kullanıcı isteği)
       kararlar/{k}: { revizyon, kstok, yariMamul, hurda, geriMakine, kullanimNotu, ts, username, name },
       yariMamulCikislar/{k}: { adet, tur:'kullanim'|'hurda', isEmri, aciklama, ts, username, name } }
   Yarı mamul deposu ayrı düğüm DEĞİL: dagilim.yariMamul − çıkışlar = depodaki adet (tek kaynak).
   Rota: revizyon ya da "karar sonra" varsa açık kalır (revizyonda sonrakiMakine = geri operasyon),
   yoksa kapanır. */
const KALITE_MAKINE_KODU = 'FKK';
const KALITE_NEDENLERI_VARSAYILAN = ['Ölçü dışı','Yüzey hatası / çizik','Sertlik uygun değil','Çapak / kenar hatası','Form / geometri hatası','Diş / vida hatası','Teknik resme uygunsuz','Malzeme hatası','Montaj / geçme sorunu'];
const KALITE_SONUC_AD = { onay:'Onay', sartli:'Şartlı kabul', red:'Red' };
const KALITE_RED_KARAR = [
  ['revizyon',  'Revizyon',          'revizyonla kurtarılır — geri operasyona gider'],
  ['kstok',     'K-stok',            'başka yerde bu hâli ile kullanılır'],
  ['yariMamul', 'Yarı mamul deposu', 'başka yerde işlenerek kullanılabilir'],
  ['hurda',     'Hurda',             'hiçbir yerde kullanılamaz'],
  ['bekliyor',  'Karar sonra',       'Şef / SuperAdmin sonra karar verir']
];
let kaliteModal = null;       // FKK "Bitir" penceresi
let kaliteBekleyen = {};      // id | 'g:'+groupId → { kalite, kapat, sonrakiMakine } (finishEntry/finishGrup okur)
let kaliteKararModal = null;  // "karar sonra" bırakılan red parçalar için karar penceresi
let ymCikisModal = null;      // yarı mamul deposundan çıkış penceresi

function kaliteMakinesiMi(makine){ return String(makine||'').split(' · ')[0].trim().toUpperCase()===KALITE_MAKINE_KODU; }
function kaliteNedenleri(){
  const l = (typeof appSettings!=='undefined' && appSettings && Array.isArray(appSettings.kaliteNedenleri)) ? appSettings.kaliteNedenleri.filter(Boolean) : [];
  return l.length ? l : KALITE_NEDENLERI_VARSAYILAN;
}
function kaliteSayi(v){ return Math.max(0, Math.round(Number(v)||0)); }
function kaliteIsAnahtari(e){ return String((e && e.talepNo)||'').trim().toUpperCase() || ('U:'+String((e && e.isEmriNo)||'').toUpperCase().replace(/_(ZARF|ELMAS)$/,'')); }
function kaliteIsKayitlari(e){ const k = kaliteIsAnahtari(e); return entriesArray().filter(o=>kaliteIsAnahtari(o)===k); }
/* Kaçıncı kontrol: aynı iş emrinin bu kayıttan önce kalite sonucu almış FKK kayıtları + 1. */
function kaliteKontrolNo(e){ return 1 + kaliteIsKayitlari(e).filter(o=>o.id!==e.id && o.kalite && (o.startTs||0) < (e.startTs||0)).length; }
/* Hata alanı seçimi için geçmiş rota ADIMLARI (her kayıt bir adım: makine + operatör + tarih). */
function kaliteGecmisAdimlar(e){
  return kaliteIsKayitlari(e).filter(o=>o.id!==e.id && !kaliteMakinesiMi(o.makine) && o.makine && (o.startTs||0) <= (e.startTs||Date.now()))
    .sort((a,b)=>(a.startTs||0)-(b.startTs||0));
}
const KALITE_HATA_BELIRSIZ = '__belirsiz__';
function kaliteHataOp(secim){
  if(!secim) return null;
  if(secim===KALITE_HATA_BELIRSIZ) return { belirsiz:true };
  const o = STATE.entries[secim]; if(!o) return null;
  return { entryId: secim, makine: o.makine||'', operatorUsername: o.operatorUsername||'', operatorName: o.operatorName||o.operatorUsername||'' };
}
function kaliteHataMetni(h){ if(!h) return ''; if(h.belirsiz) return 'belli değil'; return `${String(h.makine||'').split(' · ')[0]} · ${h.operatorName||h.operatorUsername||''}`; }
/* Geçmiş rota: iş emrinin geçtiği makineler (FKK hariç), ilk geçiş sırasıyla. */
function kaliteGecmisRota(e){
  const gor = new Set(), l = [];
  kaliteIsKayitlari(e).filter(o=>!kaliteMakinesiMi(o.makine) && o.makine).sort((a,b)=>(a.startTs||0)-(b.startTs||0))
    .forEach(o=>{ if(!gor.has(o.makine)){ gor.add(o.makine); l.push(o.makine); } });
  return l;
}
function kaliteDagilim(k){ const d = (k && k.dagilim) || {}; const r = {}; ['onay','sartli','red','revizyon','kstok','yariMamul','hurda','bekliyor'].forEach(x=>r[x]=kaliteSayi(d[x])); return r; }
function kaliteOzetMetni(k){
  const d = kaliteDagilim(k), p = [];
  if(d.onay) p.push(d.onay+' onay'); if(d.sartli) p.push(d.sartli+' şartlı');
  if(d.red){ const alt = KALITE_RED_KARAR.filter(([x])=>d[x]).map(([x,ad])=>d[x]+' '+(x==='kstok'?ad:ad.toLocaleLowerCase('tr-TR'))); p.push(d.red+' red'+(alt.length?' ('+alt.join(', ')+')':'')); }
  return p.join(' · ');
}
/* Rozet: en kötü sonuç rengi; metin "Red 2/10" gibi. */
function kaliteRozet(e){
  const k = e && e.kalite; if(!k) return '';
  const d = kaliteDagilim(k), sinif = d.red ? 'red' : d.sartli ? 'sartli' : 'onay';
  const metin = d.red ? `Red ${d.red}/${k.kontrolAdet||'?'}` : d.sartli ? `Şartlı ${d.sartli}/${k.kontrolAdet||'?'}` : 'Onay';
  return `<span class="kal-rozet ${sinif}" title="${esc(kaliteOzetMetni(k) + (k.redNeden?' · red: '+k.redNeden:'') + (k.sartliNeden?' · şartlı: '+k.sartliNeden:'') + (k.redHataOp?' · hata: '+kaliteHataMetni(k.redHataOp):''))}">${esc(metin)}</span>`;
}
/* Kayıttaki açıklamaların tek satırı (eski tek "aciklama" alanı da okunur). */
function kaliteAciklamaMetni(k){
  if(!k) return '';
  return [k.sartliAciklama ? 'şartlı: '+k.sartliAciklama : '', k.redAciklama ? 'red: '+k.redAciklama : '', k.aciklama||''].filter(Boolean).join(' · ');
}

/* ---------- FKK "Bitir" ---------- */
function kaliteModalAc(id, groupId){
  if(groupId){ kaliteModal = { groupId, grupSonuc:'', neden:'', aciklama:'' }; render(); return; }
  const e = STATE.entries[id] || {}, adet = kaliteSayi(e.adet);
  kaliteModal = { id, kontrol: adet ? String(adet) : '', onay: adet ? String(adet) : '', sartli:'', red:'',
    sartliNeden:'', sartliAciklama:'', sartliHata:'', redNeden:'', redAciklama:'', redHata:'',
    revizyon:'', kstok:'', yariMamul:'', hurda:'', bekliyor:'',
    geriMakine:'', kullanimNotu:'', kontrolNo: kaliteKontrolNo({ ...e, id }) };
  render();
}
function kaliteModalKapat(){ kaliteModal = null; render(); }
function kaliteYaz(alan, deger, cizme){ if(!kaliteModal) return; kaliteModal[alan] = deger; if(cizme!==false) render(); }
function kaliteHepsiOnay(){ if(!kaliteModal) return; Object.assign(kaliteModal, { onay: kaliteModal.kontrol, sartli:'', red:'', revizyon:'', kstok:'', yariMamul:'', hurda:'', bekliyor:'' }); render(); }
/* Kontrol edilen adet değişince, onay kalan farkı otomatik tamamlar (en sık durum hızlı olsun). */
function kaliteKontrolYaz(v){
  if(!kaliteModal) return;
  kaliteModal.kontrol = v;
  const K = kaliteSayi(v), S = kaliteSayi(kaliteModal.sartli), R = kaliteSayi(kaliteModal.red);
  kaliteModal.onay = String(Math.max(0, K - S - R));
  render();
}
function kaliteSorunluYaz(alan, v){
  if(!kaliteModal) return;
  kaliteModal[alan] = v;
  const K = kaliteSayi(kaliteModal.kontrol), S = kaliteSayi(kaliteModal.sartli), R = kaliteSayi(kaliteModal.red);
  kaliteModal.onay = String(Math.max(0, K - S - R));
  if(alan==='red'){ // red değişince karar dağılımı: tek kalem varsa ona, yoksa "karar sonra"ya
    const dolu = ['revizyon','kstok','yariMamul','hurda','bekliyor'].filter(x=>kaliteSayi(kaliteModal[x])>0);
    if(dolu.length<=1){ ['revizyon','kstok','yariMamul','hurda','bekliyor'].forEach(x=>kaliteModal[x]=''); kaliteModal[dolu[0]||'bekliyor'] = R ? String(R) : ''; }
  }
  render();
}
function kaliteOnayla(){
  const m = kaliteModal; if(!m) return;
  const ts = Date.now(), kim = { username: session.username, name: session.displayName||session.username };
  if(m.groupId){
    if(!m.grupSonuc){ toast('Sonucu seçin'); return; }
    if(m.grupSonuc!=='onay' && !m.neden){ toast('Nedeni seçin'); return; }
    if(m.grupSonuc==='sartli' && !String(m.aciklama||'').trim()){ toast('Şartlı kabul için açıklama yazın'); return; }
    kaliteBekleyen['g:'+m.groupId] = { grup:true, tur: m.grupSonuc, neden: m.grupSonuc==='onay' ? null : m.neden, aciklama: String(m.aciklama||'').trim()||null, ts, ...kim };
    const gid = m.groupId; kaliteModal = null;
    finishGrup(gid, null, null);
    return;
  }
  const K = kaliteSayi(m.kontrol), O = kaliteSayi(m.onay), S = kaliteSayi(m.sartli), R = kaliteSayi(m.red);
  if(!(K>0)){ toast('Kontrol edilen adedi girin'); return; }
  if(O+S+R!==K){ toast(`Onay + Şartlı + Red = ${O+S+R}, kontrol edilen ${K} olmalı`); return; }
  if(S>0 && !String(m.sartliNeden||'').trim()){ toast('Şartlı kabul nedenini seçin ya da yazın'); return; }
  if(S>0 && !String(m.sartliAciklama||'').trim()){ toast('Şartlı kabul için açıklama / not yazın'); return; }
  if(S>0 && !m.sartliHata){ toast('Şartlı kabul: hatanın oluştuğu operasyonu seçin (bilinmiyorsa "Belli değil")'); return; }
  if(R>0 && !String(m.redNeden||'').trim()){ toast('Red nedenini seçin ya da yazın'); return; }
  if(R>0 && !m.redHata){ toast('Red: hatanın oluştuğu operasyonu seçin (bilinmiyorsa "Belli değil")'); return; }
  const rv = kaliteSayi(m.revizyon), ks = kaliteSayi(m.kstok), ym = kaliteSayi(m.yariMamul), hu = kaliteSayi(m.hurda), bk = kaliteSayi(m.bekliyor);
  if(R>0 && rv+ks+ym+hu+bk!==R){ toast(`Red parçaların dağılımı ${rv+ks+ym+hu+bk}, red ${R} olmalı`); return; }
  if(rv>0 && !m.geriMakine){ toast('Revizyon için geri gideceği operasyonu seçin'); return; }
  const kalite = { surum:2, kontrolNo: m.kontrolNo||1, kontrolAdet:K,
    dagilim:{ onay:O, sartli:S, red:R, revizyon: R?rv:0, kstok: R?ks:0, yariMamul: R?ym:0, hurda: R?hu:0, bekliyor: R?bk:0 },
    sartliNeden: S ? String(m.sartliNeden).trim() : null, sartliAciklama: S ? String(m.sartliAciklama).trim() : null, sartliHataOp: S ? kaliteHataOp(m.sartliHata) : null,
    redNeden: R ? String(m.redNeden).trim() : null, redAciklama: R ? (String(m.redAciklama||'').trim() || null) : null, redHataOp: R ? kaliteHataOp(m.redHata) : null,
    geriMakine: R && rv ? m.geriMakine : null,
    kullanimNotu: R && ym ? (String(m.kullanimNotu||'').trim() || null) : null, ymGirisTs: R && ym ? ts : null, ts, ...kim };
  const kapat = !(R && (rv>0 || bk>0));
  kaliteBekleyen[m.id] = { kalite, kapat, sonrakiMakine: R && rv ? m.geriMakine : null };
  const id = m.id; kaliteModal = null;
  finishEntry(id, null, false);
  toast('Kalite kaydedildi: '+kaliteOzetMetni(kalite) + (kapat ? ' — rota kapandı' : rv ? ' — revizyon: '+String(m.geriMakine).split(' · ')[0] : ' — karar bekliyor'));
  render();
}

/* ---------- "Karar sonra" bırakılan red parçalar (Şef + SuperAdmin) ---------- */
function kaliteKararBekleyenler(){ return entriesArray().filter(e=>e.kalite && kaliteDagilim(e.kalite).bekliyor>0).sort((a,b)=>(a.endTs||0)-(b.endTs||0)); }
function kaliteKararAc(id){
  if(!canManageStock()){ toast('Kararı Şef ya da SuperAdmin verir'); return; }
  const e = STATE.entries[id]; if(!e || !e.kalite) return;
  kaliteKararModal = { id, revizyon:'', kstok:'', yariMamul:'', hurda:'', geriMakine:'', kullanimNotu:'', busy:false };
  render();
}
function kaliteKararKapat(){ kaliteKararModal = null; render(); }
function kaliteKararYaz(alan, deger, cizme){ if(!kaliteKararModal) return; kaliteKararModal[alan] = deger; if(cizme!==false) render(); }
function kaliteKararKaydet(){
  const m = kaliteKararModal; if(!m || m.busy) return;
  const e = STATE.entries[m.id]; if(!e || !e.kalite){ kaliteKararKapat(); return; }
  const d = kaliteDagilim(e.kalite), n = d.bekliyor;
  const rv = kaliteSayi(m.revizyon), ks = kaliteSayi(m.kstok), ym = kaliteSayi(m.yariMamul), hu = kaliteSayi(m.hurda);
  if(rv+ks+ym+hu!==n){ toast(`Dağılım ${rv+ks+ym+hu}, karar bekleyen ${n} parça olmalı`); return; }
  if(rv>0 && !m.geriMakine){ toast('Revizyon için geri gideceği operasyonu seçin'); return; }
  const ts = Date.now(), p = 'entries/'+m.id;
  const updates = {};
  updates[p+'/kalite/dagilim'] = { ...d, revizyon: d.revizyon+rv, kstok: d.kstok+ks, yariMamul: d.yariMamul+ym, hurda: d.hurda+hu, bekliyor: 0 };
  updates[p+'/kalite/kararlar/'+DB.ref().push().key] = { revizyon:rv, kstok:ks, yariMamul:ym, hurda:hu, geriMakine: rv ? m.geriMakine : null,
    kullanimNotu: ym ? (String(m.kullanimNotu||'').trim()||null) : null, ts, username: session.username, name: session.displayName||session.username };
  if(ym && !e.kalite.ymGirisTs) updates[p+'/kalite/ymGirisTs'] = ts;
  if(ym && String(m.kullanimNotu||'').trim()) updates[p+'/kalite/kullanimNotu'] = [e.kalite.kullanimNotu, String(m.kullanimNotu).trim()].filter(Boolean).join(' / ');
  if(rv>0){ updates[p+'/sonrakiMakine'] = m.geriMakine; updates[p+'/sonOperasyon'] = false; updates[p+'/kalite/geriMakine'] = m.geriMakine; }
  else if(!e.sonrakiMakine){ updates[p+'/sonOperasyon'] = true; } // yalnız karar bekliyordu → rota kapanır
  m.busy = true; render();
  DB.ref().update(updates).then(()=>{ toast('Karar kaydedildi'); kaliteKararModal = null; render(); })
    .catch(err=>{ m.busy = false; toast('Kaydedilemedi: '+((err&&err.message)||'hata')); render(); });
}

/* ---------- Yarı mamul deposu ---------- */
function yariMamulKayitlari(){
  return entriesArray().filter(e=>e.kalite && kaliteDagilim(e.kalite).yariMamul>0).map(e=>{
    const giren = kaliteDagilim(e.kalite).yariMamul;
    const cikislar = Object.entries(e.kalite.yariMamulCikislar||{}).map(([k,v])=>({ k, ...v })).sort((a,b)=>(a.ts||0)-(b.ts||0));
    const cikan = cikislar.reduce((t,c)=>t+kaliteSayi(c.adet), 0);
    const girisTs = e.kalite.ymGirisTs || e.kalite.ts || e.endTs; // depoya ilk giriş
    return { e, giren, cikan, kalan: giren - cikan, cikislar, girisTs };
  }).sort((a,b)=>(a.girisTs||0)-(b.girisTs||0));
}
function ymCikisAc(id, tur){
  if(!canManageStock()){ toast('Bu işlem için Şef ya da SuperAdmin yetkisi gerekli'); return; }
  const x = yariMamulKayitlari().find(r=>r.e.id===id); if(!x || x.kalan<=0) return;
  ymCikisModal = { id, tur, adet: String(x.kalan), isEmri:'', aciklama:'', busy:false };
  render();
}
function ymCikisKapat(){ ymCikisModal = null; render(); }
function ymCikisKaydet(){
  const m = ymCikisModal; if(!m || m.busy) return;
  const x = yariMamulKayitlari().find(r=>r.e.id===m.id); if(!x){ ymCikisKapat(); return; }
  const a = kaliteSayi(m.adet);
  if(!(a>0 && a<=x.kalan)){ toast(`Adet 1 ile ${x.kalan} arasında olmalı`); return; }
  const kayit = { adet:a, tur:m.tur, isEmri: String(m.isEmri||'').trim().toUpperCase() || null, aciklama: String(m.aciklama||'').trim() || null,
    ts: Date.now(), username: session.username, name: session.displayName||session.username };
  m.busy = true; render();
  DB.ref('entries/'+m.id+'/kalite/yariMamulCikislar').push(kayit).then(()=>{
    toast(m.tur==='hurda' ? `${a} adet hurdaya ayrıldı` : `${a} adet depodan çıktı`+(kayit.isEmri?' — '+kayit.isEmri:''));
    ymCikisModal = null; render();
  }).catch(err=>{ m.busy = false; toast('Kaydedilemedi: '+((err&&err.message)||'hata')); render(); });
}

/* ---------- Ayarlar → Kalite Red Nedenleri (SuperAdmin; settings canlı) ---------- */
function kaliteNedeniEkle(){
  if(!session || !session.isSuperAdmin) return;
  const el = document.getElementById('kalite-neden-yeni'); const v = String(el && el.value || '').trim();
  if(!v){ toast('Bir neden yazın'); return; }
  const l = kaliteNedenleri(); if(l.includes(v)){ toast('Bu neden zaten listede'); return; }
  DB.ref('settings/kaliteNedenleri').set([...l, v]).then(()=>toast('Eklendi'));
}
function kaliteNedeniDuzenle(i){
  if(!session || !session.isSuperAdmin) return;
  const el = document.getElementById('kalite-neden-'+i); const v = String(el && el.value || '').trim();
  if(!v){ toast('Boş olamaz'); return; }
  const l = [...kaliteNedenleri()]; l[i] = v; DB.ref('settings/kaliteNedenleri').set(l).then(()=>toast('Kaydedildi'));
}
function kaliteNedeniSil(i){
  if(!session || !session.isSuperAdmin) return;
  const l = kaliteNedenleri(); if(!confirm(`"${l[i]}" silinsin mi?`)) return;
  DB.ref('settings/kaliteNedenleri').set(l.filter((_,j)=>j!==i)).then(()=>toast('Silindi'));
}
