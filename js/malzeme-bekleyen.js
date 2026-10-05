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

   MALİYET: bu düğüm canlı DİNLENMİYOR (toolStock/karburStok ile aynı gerekçe), ekran
   açıldığında bir kez okunuyor. Liste küçük (bekleyen iş emri sayısı), yazma sonrası
   yerel kopya elle güncelleniyor ki kullanıcı kendi işlemini yenilemeden görsün. */

let malzemeBekleyen = {}, malzemeBekleyenReady = false, malzemeBekleyenLoading = false, malzemeBekleyenError = null;
let malzemeBekleyenDenemeTs = 0; // son okuma denemesi — İş Yoğunluğu bununla dakikada bir tazeliyor
let hammaddeRecete = {}, hammaddeReceteReady = false, hammaddeReceteLoading = false;

function ensureMalzemeBekleyenLoaded(cb, force){
  if((malzemeBekleyenReady && !force) || malzemeBekleyenLoading) return;
  malzemeBekleyenLoading = true;
  malzemeBekleyenDenemeTs = Date.now();
  DB.ref('malzemeBekleyen').once('value').then(snap => {
    malzemeBekleyenLoading = false;
    malzemeBekleyen = snap.val() || {};
    malzemeBekleyenReady = true; malzemeBekleyenError = null;
    cb && cb();
  }).catch(err => {
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
function malzemeIstekRenk(x){ return malzemeIstekVar(x) ? 'var(--warn)' : 'var(--danger)'; }
/* Bir hammadde kaleminin rezervesi = o kalemi bekleyen aktif kayıtların toplamı. */
function malzemeRezerve(hammaddeId){
  return malzemeBekleyenAktif()
    .filter(x=>x.hammaddeId===hammaddeId)
    .reduce((t,x)=>t + (Number(x.gerekenMiktar)||0), 0);
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
  return k ? (hammaddeRecete[k]||null) : null;
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
    updates['hammaddeRecete/'+mamul] = yeniRecete;
    hammaddeRecete[mamul] = yeniRecete;
  }
  DB.ref().update(updates).then(()=>{
    malzemeBekleyen[id] = kayit;
    toast((kayit.isEmriNo||kayit.talepNo)+' malzeme bekliyor olarak işaretlendi');
    bitti && bitti();
    render();
  }).catch(err=>{ toast('Kaydedilemedi: '+((err&&err.message)||'hata')); });
}

/* CANIAS istek numarası İKİNCİ AŞAMA: isteği müdür açıyor, o yüzden yalnızca SuperAdmin
   girebiliyor. Şefe açılması istenirse koşul canManageStock()'a çevrilir. */
function malzemeIstekNoYetkisi(){ return !!(session && session.isSuperAdmin); }
function malzemeIstekNoKaydet(id, no){
  if(!malzemeIstekNoYetkisi()){ toast('İstek numarasını yalnızca SuperAdmin girebilir'); return; }
  const kayit = malzemeBekleyen[id]; if(!kayit) return;
  const temiz = String(no||'').trim();
  const now = Date.now();
  const updates = {};
  updates['malzemeBekleyen/'+id+'/caniasIstekNo'] = temiz;
  updates['malzemeBekleyen/'+id+'/istekGirenUsername'] = session.username;
  updates['malzemeBekleyen/'+id+'/istekTs'] = now;
  DB.ref().update(updates).then(()=>{
    malzemeBekleyen[id] = { ...kayit, caniasIstekNo: temiz, istekGirenUsername: session.username, istekTs: now };
    toast(temiz ? ('İstek no kaydedildi: '+temiz) : 'İstek no temizlendi');
    render();
  }).catch(err=>{ toast('Kaydedilemedi: '+((err&&err.message)||'hata')); });
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
    malzemeBekleyen[id] = { ...kayit, durum:'karsilandi', karsilanmaTs:now,
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
