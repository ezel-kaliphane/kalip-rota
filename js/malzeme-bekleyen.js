/* ===================== MALZEME BEKLEYEN İŞ EMİRLERİ (29.09.2026) =====================
   Kullanıcının anlattığı gerçek akış:

     İş emri çıkar → şef ölçü verir, malzemeliğe gider → FİZİKİ kontrol
       · malzeme VARSA  → işleme alır, kullandığını zaten sistemden yazıyor
       · malzeme YOKSA  → iş emrini müdüre getirir, müdür CANIAS'ta istek açar,
                          iş emri bekleme alanına park eder, şef Excel'e yazar
     Malzeme gelince → bekleyenler incelenir, EŞLEŞEN ÇAPA dağıtılır → testere

   Bu modül o Excel'i öldürüyor. SİPARİŞ AÇMIYOR: sipariş CANIAS'ta açılıyor, burada
   yalnızca "bekliyor" durumu ve CANIAS istek numarası tutuluyor. Tedarikçi, teslim
   takibi, sipariş kalemi gibi kavramlar bilinçli olarak YOK.

   İKİ AŞAMALI: şef "yok" işaretler (istek no henüz yoktur), sonra müdür CANIAS'ta
   isteği açıp numarayı girer. Numarası olmayan kayıtlar müdürün kuyruğudur.

   REZERVE AYRI DÜĞÜMDE TUTULMUYOR. Bekleyen kayıtların gereken miktarları toplanarak
   türetiliyor: kullanılabilir = stok − rezerve. Ayrı bir rezerve düğümü tutulsaydı bir
   kayıt silindiğinde/karşılandığında orada asılı kalma riski olurdu; tek kaynak var.

   REÇETE KENDİLİĞİNDEN BİRİKİYOR. Şef bir mamul için hangi hammaddeyi seçtiyse
   hammaddeRecete'ye yazılıyor; aynı mamul ikinci kez geldiğinde hammadde ve birim
   başına miktar hazır geliyor. Ayrı bir "reçete gir" ekranı YOK — kimse doldurmaz.

   CANLI (05.10.2026): eskiden maliyet gerekçesiyle bir kez okunuyordu; kullanıcı "şefin girdiği
   sipariş ya da benim girdiğim istek no anlık güncellenmiyor, uygulamayı kapatıp açmam gerekiyor"
   dedi. Artık ilk ihtiyaç anında (Malzeme Bekleyenler ya da İş Yoğunluğu açılınca) on('value')
   ile dinleniyor ve oturum boyunca açık kalıyor. Liste küçük (bekleyen iş emri sayısı, onlarca
   kayıt) ve seyrek değişiyor; RTDB yalnızca değişen kısmı gönderiyor. Yazma sonrası yerel
   kopyanın elle güncellenmesi duruyor — dinleyici gelene kadar anında görünsün diye. */

let malzemeBekleyen = {}, malzemeBekleyenReady = false, malzemeBekleyenLoading = false, malzemeBekleyenError = null;
let malzemeBekleyenDenemeTs = 0, malzemeBekleyenDinleniyor = false;
/* SİPARİŞ MİKTARI (06.10.2026, kullanıcı isteği): "aynı çapı bekleyen iki iş emri için 1500 mm
   sipariş açtım, ikisinin istek no'su aynı; ~1200 mm fazla yolda — yeni çıkan işlerde bunu göz
   önünde bulundursun." Kararlar: (1) yeni bekleyen kayıt yoldaki fazla yetiyorsa o siparişe
   KENDİLİĞİNDEN bağlanır; (2) ihtiyaca kesim başına 3 mm testere payı eklenir; (3) siparişi
   "geldi" Şef ve SuperAdmin kapatır.
   malzemeIstek/{istekNo_hammaddeId} = { istekNo, hammaddeId, hammaddeKod, miktar|null, birim,
     durum:'acik'|'geldi', acanUsername, acanName, acilisTs, geldiTs, geldiUsername, geldiName }
   Anahtar istek no + hammadde: CANIAS'ta tek istek birden fazla malzeme içerebilir. Miktarı
   girilmemiş (eski) istekler "miktar bilinmiyor" sayılır — fazlası hesaplanmaz, bağlama yapılmaz. */
const MALZEME_KESIM_PAYI_MM = 3;
let malzemeIstek = {}, malzemeIstekDinleniyor = false, malzemeIstekHata = null;
let hammaddeRecete = {}, hammaddeReceteReady = false, hammaddeReceteLoading = false;

function ensureMalzemeBekleyenLoaded(cb){
  /* Dinleyici bir kez kurulur. Hata olursa (ör. yetki) her render'da yeniden denemesin diye
     en erken bir dakika sonra tekrar denenir. */
  if(malzemeBekleyenDinleniyor && !(malzemeBekleyenError && Date.now()-malzemeBekleyenDenemeTs > 60000)) return;
  malzemeBekleyenDinleniyor = true; malzemeBekleyenLoading = true;
  malzemeBekleyenDenemeTs = Date.now();
  if(!malzemeIstekDinleniyor){
    malzemeIstekDinleniyor = true;
    DB.ref('malzemeIstek').on('value', snap => { malzemeIstek = snap.val() || {}; malzemeIstekHata = null; safeRender(); },
      err => { malzemeIstekHata = (err && err.message) || 'okuma hatası'; console.warn('malzemeIstek okunamadı (kural yayınlanmamış olabilir):', malzemeIstekHata); });
  }
  DB.ref('malzemeBekleyen').on('value', snap => {
    malzemeBekleyenLoading = false;
    malzemeBekleyen = snap.val() || {};
    malzemeBekleyenReady = true; malzemeBekleyenError = null;
    safeRender();
  }, err => {
    malzemeBekleyenLoading = false;
    malzemeBekleyenError = (err && err.message) || 'okuma hatası';
    safeRender();
  });
}
function ensureHammaddeReceteLoaded(cb, force){
  if((hammaddeReceteReady && !force) || hammaddeReceteLoading) return;
  hammaddeReceteLoading = true;
  DB.ref('hammaddeRecete').once('value').then(snap => {
    hammaddeReceteLoading = false;
    hammaddeRecete = snap.val() || {};
    hammaddeReceteReady = true;
    cb && cb();
  }).catch(() => { hammaddeReceteLoading = false; });
}

function malzemeBekleyenArray(){
  return Object.entries(malzemeBekleyen||{}).map(([id,v])=>({id,...v}));
}
function malzemeBekleyenAktif(){
  return malzemeBekleyenArray().filter(x=>x.durum!=='karsilandi');
}
/* Siparişin rengi (05.10.2026, kullanıcı isteği): CANIAS istek no girildiyse SARI (sipariş açıldı,
   malzeme yolda), girilmediyse KIRMIZI (müdürün kuyruğu, henüz sipariş yok). Malzeme Bekleyenler ve
   İş Yoğunluğu aynı kuralı buradan okuyor. */
function malzemeIstekVar(x){ return !!String((x && x.caniasIstekNo)||'').trim(); }
/* Üç durum: istek yok = kırmızı, sipariş açık (yolda) = sarı, malzeme geldi = yeşil. */
function malzemeIstekDurumu(x){
  const no = String((x && x.caniasIstekNo)||'').trim(); if(!no) return 'yok';
  const k = malzemeIstekKaydi(no, x.hammaddeId);
  return k && k.durum==='geldi' ? 'geldi' : 'acik';
}
function malzemeIstekRenk(x){ const d = malzemeIstekDurumu(x); return d==='yok' ? 'var(--danger)' : d==='geldi' ? 'var(--success)' : 'var(--warn)'; }
function malzemeIstekAnahtar(istekNo, hid){ return (String(istekNo||'').trim().toUpperCase()+'_'+String(hid||'')).replace(/[.#$\[\]\/]/g,'-'); }
function malzemeIstekKaydi(istekNo, hid){ return (malzemeIstek||{})[malzemeIstekAnahtar(istekNo, hid)] || null; }
/* İhtiyaç = gereken + testere payı. Pay yalnız mm ile takip edilen çubukta; kesim sayısı = İ.E.
   miktarı (her parça ayrı kesilir), bilinmiyorsa 1. */
function malzemeKesimPayi(x){
  if(String((x && x.birim)||'')!=='mm') return 0;
  return MALZEME_KESIM_PAYI_MM * Math.max(1, Math.round(Number(x.ieMiktar)||0) || 1);
}
function malzemeIhtiyac(x){ return (Number(x && x.gerekenMiktar)||0) + malzemeKesimPayi(x); }
/* Bir hammaddenin AÇIK siparişleri: kayıtlı olanlar + bekleyen kayıtlarda geçip kaydı olmayan
   (miktarı bilinmeyen) istek no'lar. Her biri için bağlı aktif kayıtlar, kullanılan ve fazla. */
function malzemeAcikIstekler(hid){
  const aktif = malzemeBekleyenAktif().filter(x=>x.hammaddeId===hid);
  const nolar = new Map();
  Object.values(malzemeIstek||{}).forEach(k=>{ if(k && k.hammaddeId===hid && k.durum!=='geldi') nolar.set(String(k.istekNo).trim().toUpperCase(), k.istekNo); });
  aktif.forEach(x=>{ const no = String(x.caniasIstekNo||'').trim(); if(no && malzemeIstekDurumu(x)!=='geldi' && !nolar.has(no.toUpperCase())) nolar.set(no.toUpperCase(), no); });
  return [...nolar.values()].map(no=>{
    const k = malzemeIstekKaydi(no, hid);
    const bagli = aktif.filter(x=>String(x.caniasIstekNo||'').trim().toUpperCase()===String(no).trim().toUpperCase());
    const kullanilan = bagli.reduce((t,x)=>t+malzemeIhtiyac(x), 0);
    const miktar = (k && k.miktar!=null && k.miktar!=='' && Number(k.miktar)>0) ? Number(k.miktar) : null;
    return { istekNo: no, anahtar: malzemeIstekAnahtar(no, hid), kayit: k, miktar, birim: (k && k.birim) || (bagli[0] && bagli[0].birim) || '',
      bagli, kullanilan, fazla: miktar==null ? null : miktar - kullanilan, acilisTs: (k && k.acilisTs) || 0 };
  }).sort((a,b)=>(a.acilisTs||0)-(b.acilisTs||0));
}
/* Yeni ihtiyaca yeten açık sipariş: fazlası yetenlerden en az fazlası olan (en sıkı uyan). */
function malzemeUygunIstek(hid, ihtiyac){
  return malzemeAcikIstekler(hid).filter(s=>s.fazla!=null && s.fazla >= ihtiyac).sort((a,b)=>a.fazla-b.fazla)[0] || null;
}
/* Bir hammadde kaleminin rezervesi = o kalemi bekleyen aktif kayıtların toplamı. */
function malzemeRezerve(hammaddeId){
  return malzemeBekleyenAktif()
    .filter(x=>x.hammaddeId===hammaddeId)
    .reduce((t,x)=>t + malzemeIhtiyac(x), 0); // testere payı dahil
}
/* Hammadde kaleminin ekranda görünen adı. 'boy' türünde çap ayırt edici olan şey
   (eşleştirme çapa göre yapılıyor), 'adet' türünde isim. */
function hammaddeEtiket(it){
  if(!it) return '—';
  const kod = it.kod || '';
  if(it.tur==='boy') return (kod + ' ' + (it.cap||'')).trim();
  return kod;
}
function hammaddeAciklama(it){
  if(!it) return '';
  return it.tur==='boy' ? (it.isim||'') : (it.isim||'');
}
/* Bir hammadde kaleminin anlık stok sayısı. 'boy' lot bazlı: lotların toplamı. */
function hammaddeStokSayi(it){
  if(!it) return 0;
  if(it.tur==='boy'){
    const lots = it.lots || {};
    return Object.values(lots).reduce((t,l)=>t + (Number(l && l.kalan!=null ? l.kalan : (l && l.boy))||0), 0);
  }
  return Number(it.miktar)||0;
}

/* İş emri (U kodu) ya da iş talep no girilince ERP listesinden mamul bilgisini bulur.
   validIsEmri TALEP NO ile anahtarlı ({malzemeKodu, malzemeAdi}), o yüzden iki yönlü
   arama yapılıyor: önce talep no olarak, bulunamazsa malzeme kodu (U kodu) olarak. */
function isEmriBilgisiBul(girilen){
  const q = String(girilen||'').trim().toUpperCase();
  if(!q) return null;
  const vi = (STATE && STATE.validIsEmri) || {};
  const dogrudan = vi[q];
  if(dogrudan && typeof dogrudan==='object'){
    return { talepNo:q, mamulKodu:dogrudan.malzemeKodu||'', mamulAdi:dogrudan.malzemeAdi||'', ieMiktar:Number(dogrudan.ieMiktar)||0 };
  }
  if(dogrudan===true) return { talepNo:q, mamulKodu:'', mamulAdi:'', ieMiktar:0 };
  for(const [talep,v] of Object.entries(vi)){
    if(v && typeof v==='object' && String(v.malzemeKodu||'').toUpperCase()===q){
      return { talepNo:talep, mamulKodu:v.malzemeKodu||'', mamulAdi:v.malzemeAdi||'', ieMiktar:Number(v.ieMiktar)||0 };
    }
  }
  return null;
}
function receteOku(mamulKodu){
  const k = String(mamulKodu||'').trim().toUpperCase();
  const r = k ? hammaddeRecete[k] : null;
  return (r && r.hammaddeId) ? r : null; // yalnız karbür reçetesi olan mamul çelik reçetesi sayılmaz
}

function malzemeBekleyenEkle(veri, bitti){
  if(!canManageStock()){ toast('Bu işlem için Şef ya da SuperAdmin yetkisi gerekli'); return; }
  const now = Date.now();
  const id = DB.ref('malzemeBekleyen').push().key;
  const kayit = {
    isEmriNo: veri.isEmriNo||'', talepNo: veri.talepNo||'',
    mamulKodu: veri.mamulKodu||'', mamulAdi: veri.mamulAdi||'',
    ieMiktar: Number(veri.ieMiktar)||0,
    hammaddeId: veri.hammaddeId||'', hammaddeKod: veri.hammaddeKod||'',
    gerekenMiktar: Number(veri.gerekenMiktar)||0, birim: veri.birim||'adet',
    durum: 'bekliyor',
    isaretleyenUsername: session.username, isaretleyenName: session.displayName,
    isaretTs: now, caniasIstekNo: ''
  };
  const uygun = malzemeUygunIstek(kayit.hammaddeId, malzemeIhtiyac(kayit));
  if(uygun){ kayit.caniasIstekNo = uygun.istekNo; kayit.istekOtomatik = true; kayit.istekTs = now; }
  const updates = {};
  updates['malzemeBekleyen/'+id] = kayit;
  /* Reçete aynı yazmada güncelleniyor: şefin seçtiği hammadde bu mamulün reçetesi olur.
     birimBasina = gereken / iş emri miktarı; iş emri miktarı bilinmiyorsa oran
     hesaplanamaz, o zaman yalnızca hammadde eşlemesi saklanır (miktar 0). */
  const mamul = String(kayit.mamulKodu||'').trim().toUpperCase();
  if(mamul && kayit.hammaddeId){
    const eski = hammaddeRecete[mamul] || {};
    const birimBasina = kayit.ieMiktar>0 ? (kayit.gerekenMiktar / kayit.ieMiktar) : 0;
    const yeniRecete = {
      hammaddeId: kayit.hammaddeId, hammaddeKod: kayit.hammaddeKod,
      birimBasina: birimBasina || Number(eski.birimBasina)||0, birim: kayit.birim,
      gozlemSayisi: (Number(eski.gozlemSayisi)||0) + 1,
      sonTs: now, sonKullanan: session.username
    };
    /* Alan alan yazılıyor, kaydın tamamı değil: aynı mamul kaydının altında karbür reçetesi
       (hammaddeRecete/{mamul}/karbur, bkz. js/karbur.js REÇETE) duruyor ve silinmemeli. */
    Object.entries(yeniRecete).forEach(([k,v])=>{ updates['hammaddeRecete/'+mamul+'/'+k] = v; });
    hammaddeRecete[mamul] = { ...eski, ...yeniRecete };
  }
  DB.ref().update(updates).then(()=>{
    /* Yerel kopya elle güncellenmiyor: canlı dinleyici (ensureMalzemeBekleyenLoaded) yazmayı anında
       getiriyor; elle yazmak, arada başka cihazdan gelen daha yeni değeri geri alabiliyordu. */
    if(!malzemeBekleyenDinleniyor) malzemeBekleyen[id] = kayit;
    toast((kayit.isEmriNo||kayit.talepNo)+' malzeme bekliyor olarak işaretlendi' + (uygun ? ` — açık siparişe bağlandı: istek ${uygun.istekNo}, kalan fazla ${Math.round(uygun.fazla - malzemeIhtiyac(kayit))} ${kayit.birim}` : ''));
    bitti && bitti();
    render();
  }).catch(err=>{ toast('Kaydedilemedi: '+((err&&err.message)||'hata')); });
}

/* CANIAS istek numarası İKİNCİ AŞAMA: isteği müdür açıyor, o yüzden yalnızca SuperAdmin
   girebiliyor. Şefe açılması istenirse koşul canManageStock()'a çevrilir. */
function malzemeIstekNoYetkisi(){ return !!(session && session.isSuperAdmin); }
function malzemeIstekNoKaydet(id, no, miktar){
  if(!malzemeIstekNoYetkisi()){ toast('İstek numarasını yalnızca SuperAdmin girebilir'); return; }
  const kayit = malzemeBekleyen[id]; if(!kayit) return;
  const temiz = String(no||'').trim();
  const now = Date.now();
  const updates = {};
  updates['malzemeBekleyen/'+id+'/caniasIstekNo'] = temiz;
  updates['malzemeBekleyen/'+id+'/istekGirenUsername'] = session.username;
  updates['malzemeBekleyen/'+id+'/istekTs'] = now;
  updates['malzemeBekleyen/'+id+'/istekOtomatik'] = null;
  /* Sipariş kaydı: bu istek no + hammadde için ilk kez giriliyorsa açılır; miktar yazıldıysa
     (yeni ya da düzeltme) kaydedilir. Aynı istek no'yu ikinci iş emrine yazarken miktar boş
     bırakılabilir — sipariş zaten biliniyor. */
  const m = Number(String(miktar==null?'':miktar).replace(',','.'));
  if(temiz && kayit.hammaddeId){
    const key = malzemeIstekAnahtar(temiz, kayit.hammaddeId), var_ = malzemeIstek[key];
    if(!var_){
      updates['malzemeIstek/'+key] = { istekNo: temiz, hammaddeId: kayit.hammaddeId, hammaddeKod: kayit.hammaddeKod||'',
        miktar: m>0 ? m : null, birim: kayit.birim||'', durum:'acik',
        acanUsername: session.username, acanName: session.displayName||session.username, acilisTs: now };
    } else if(m>0 && m!==Number(var_.miktar)){
      updates['malzemeIstek/'+key+'/miktar'] = m;
    }
  }
  DB.ref().update(updates).then(()=>{
    if(!malzemeBekleyenDinleniyor) malzemeBekleyen[id] = { ...kayit, caniasIstekNo: temiz, istekGirenUsername: session.username, istekTs: now };
    toast(temiz ? ('İstek no kaydedildi: '+temiz) : 'İstek no temizlendi');
    render();
  }).catch(err=>{
    /* malzemeIstek kuralı yayınlanmamışsa çok-yollu yazma bütünüyle reddedilir — istek no'nun
       kendisi kaybolmasın diye sipariş kaydı olmadan bir kez daha denenir. */
    const sipYollari = Object.keys(updates).filter(k=>k.startsWith('malzemeIstek/'));
    if(!sipYollari.length){ toast('Kaydedilemedi: '+((err&&err.message)||'hata')); return; }
    sipYollari.forEach(k=>delete updates[k]);
    DB.ref().update(updates).then(()=>{ toast('İstek no kaydedildi: '+temiz+' — sipariş miktarı kaydedilemedi (malzemeIstek kuralı yayınlanmamış olabilir)'); render(); })
      .catch(err2=>toast('Kaydedilemedi: '+((err2&&err2.message)||'hata')));
  });
}

/* KARŞILANDI = bekleme bitti, rezerve düşer. STOK HAREKETİ YAZMIYOR: gelen malzemenin
   girişi ve işe çıkışı zaten Hammadde ekranının kendi giriş/çıkış akışında yapılıyor;
   burada da yazsaydık aynı miktar iki kez sayılırdı. */
function malzemeBekleyenKarsila(id){
  if(!canManageStock()){ toast('Bu işlem için Şef ya da SuperAdmin yetkisi gerekli'); return; }
  const kayit = malzemeBekleyen[id]; if(!kayit) return;
  const now = Date.now();
  const updates = {};
  updates['malzemeBekleyen/'+id+'/durum'] = 'karsilandi';
  updates['malzemeBekleyen/'+id+'/karsilanmaTs'] = now;
  updates['malzemeBekleyen/'+id+'/karsilayanUsername'] = session.username;
  updates['malzemeBekleyen/'+id+'/karsilayanName'] = session.displayName;
  DB.ref().update(updates).then(()=>{
    if(!malzemeBekleyenDinleniyor) malzemeBekleyen[id] = { ...kayit, durum:'karsilandi', karsilanmaTs:now,
      karsilayanUsername:session.username, karsilayanName:session.displayName };
    toast((kayit.isEmriNo||kayit.talepNo)+' karşılandı');
    render();
  }).catch(err=>{ toast('Kaydedilemedi: '+((err&&err.message)||'hata')); });
}
function malzemeBekleyenSil(id){
  if(!canManageStock()){ toast('Bu işlem için Şef ya da SuperAdmin yetkisi gerekli'); return; }
  const kayit = malzemeBekleyen[id]; if(!kayit) return;
  if(!confirm((kayit.isEmriNo||kayit.talepNo)+' kaydını silmek istediğine emin misin?')) return;
  DB.ref('malzemeBekleyen/'+id).remove().then(()=>{
    delete malzemeBekleyen[id];
    toast('Kayıt silindi');
    render();
  }).catch(err=>{ toast('Silinemedi: '+((err&&err.message)||'hata')); });
}
/* Sipariş miktarını sonradan gir/düzelt (SuperAdmin) — eski, miktarı bilinmeyen istekler için de. */
function malzemeIstekMiktarKaydet(istekNo, hid, miktar){
  if(!malzemeIstekNoYetkisi()){ toast('Sipariş miktarını yalnızca SuperAdmin girebilir'); return; }
  const m = Number(String(miktar==null?'':miktar).replace(',','.'));
  if(!(m>0)){ toast('Miktarı girin'); return; }
  const key = malzemeIstekAnahtar(istekNo, hid), var_ = malzemeIstek[key], it = (stockItems||{})[hid];
  const upd = var_ ? { ['malzemeIstek/'+key+'/miktar']: m }
    : { ['malzemeIstek/'+key]: { istekNo: String(istekNo).trim(), hammaddeId: hid, hammaddeKod: it ? hammaddeEtiket(it) : '',
        miktar: m, birim: (it && it.birim)||'', durum:'acik', acanUsername: session.username, acanName: session.displayName||session.username, acilisTs: Date.now() } };
  DB.ref().update(upd).then(()=>{ toast('Sipariş miktarı kaydedildi: '+m); render(); })
    .catch(err=>toast('Kaydedilemedi: '+((err&&err.message)||'hata')+' — malzemeIstek kuralı yayınlandı mı?'));
}
/* Sipariş geldi (Şef + SuperAdmin). Yoldaki miktar artık stokta sayılır — stok girişinin
   kendisi Stok Girişi'nden yapılır (orada bu kutu işaretlenince ikisi birlikte olur). */
function malzemeIstekGeldiYaz(istekNo, hid, sessiz){
  if(!canManageStock()){ toast('Bu işlem için Şef ya da SuperAdmin yetkisi gerekli'); return Promise.resolve(false); }
  const key = malzemeIstekAnahtar(istekNo, hid), var_ = malzemeIstek[key], it = (stockItems||{})[hid], now = Date.now();
  const geldi = { durum:'geldi', geldiTs: now, geldiUsername: session.username, geldiName: session.displayName||session.username };
  const upd = {};
  if(var_) Object.entries(geldi).forEach(([k,v])=>{ upd['malzemeIstek/'+key+'/'+k] = v; });
  else upd['malzemeIstek/'+key] = { istekNo: String(istekNo).trim(), hammaddeId: hid, hammaddeKod: it ? hammaddeEtiket(it) : '', miktar: null,
    birim: (it && it.birim)||'', acanUsername: session.username, acanName: session.displayName||session.username, acilisTs: now, ...geldi };
  return DB.ref().update(upd).then(()=>{ if(!sessiz) toast('Sipariş geldi olarak işaretlendi: istek '+istekNo); render(); return true; })
    .catch(err=>{ toast('Kaydedilemedi: '+((err&&err.message)||'hata')+' — malzemeIstek kuralı yayınlandı mı?'); return false; });
}
function malzemeIstekGeldi(istekNo, hid){
  if(!confirm(`İstek ${istekNo} geldi olarak işaretlensin mi?\n\nMalzemeyi stoğa Stok Girişi'nden girmeyi unutma — orada "bu giriş siparişin teslimi" kutusunu işaretlersen ikisi birlikte olur.`)) return;
  malzemeIstekGeldiYaz(istekNo, hid);
}
