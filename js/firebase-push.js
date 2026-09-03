/* ===================== PUSH BİLDİRİMİ (FCM) =====================
   Firebase Console → Project Settings → Cloud Messaging → Web Push certificates'ten
   ürettiğin VAPID public key'i buraya yapıştır. Boş bırakılırsa bildirim özelliği
   sessizce devre dışı kalır (hata vermez), uygulamanın geri kalanı normal çalışır. */
const VAPID_KEY = 'BCzH63ol7xwko9kjQRuDHDXK8IwyD5E3vq4TaP5Pd3W6bUay1BzR1J2lTcn1x4FRXoM6SsaLiT5ZCAGz7pMyIZs';

function pushConfigured(){ return VAPID_KEY && VAPID_KEY.indexOf('BURAYA')<0; }
let pushPermissionState = (typeof Notification!=='undefined') ? Notification.permission : 'unsupported'; // 'default' | 'granted' | 'denied' | 'unsupported'

/* pushPermissionState==='denied' olduğunda gösterilen düzeltme talimatı — teknik olmayan bir
   operatör için "telefon ayarlarından izin ver" tek başına yetersiz (nereye bakacağını
   bilmiyor). Chrome (Android) ve Safari (iOS) için izin sıfırlama adımları TAMAMEN FARKLI
   yerlerde olduğu için tarayıcıya göre ayrı, somut adımlar gösteriyoruz. */
function pushBlockedInstructions(){
  const ua = navigator.userAgent || '';
  if(/iPad|iPhone|iPod/.test(ua)){
    return 'Telefonun Uygulama Ayarları\'ndaki genel izin bundan AYRI — Safari\'nin kendi site izni hâlâ kapalı. Düzeltmek için: telefonun Ayarlar uygulamasını aç → aşağı kaydırıp bu uygulamayı ("Rota Takip") bul → Bildirimler → aç. (Ana ekranda uygulama yoksa önce Safari\'de Paylaş → "Ana Ekrana Ekle" ile yüklemen gerekir.)';
  }
  if(/Android/.test(ua)){
    return 'Telefonun Uygulama Ayarları\'nda "İzin Verildi" görünse bile bu YETMEZ — Chrome\'un kendi site izni ayrı ve hâlâ engelli. Düzeltmek için: Chrome\'u aç (yüklü uygulama simgesinden değil) → bu siteye git → adres çubuğunun solundaki 🔒 simgesine dokun → İzinler → Bildirimler\'i "İzin Ver" yap → sonra bu uygulamayı kapatıp yeniden aç.';
  }
  return 'Tarayıcı bu site için bildirimi engellemiş. Tarayıcının adres çubuğundaki site bilgisi simgesine (🔒/ⓘ) dokunup site izinlerinden Bildirimler\'i "İzin Ver" yap, sonra sayfayı yenile.';
}

/* Bu cihaz için sabit bir kimlik — tarayıcının localStorage'ında kalıcı olarak saklanıyor.
   Token'lar artık bu ID'ye göre kaydediliyor (fcmTokens/{deviceId}: token), token değeri
   kendisine göre değil — böylece aynı cihazda "Bildirimleri Aç"a tekrar basılsa ya da FCM
   token'ı arka planda yenilense bile, HEP AYNI YUVAYA yazılır, eski token'lar birikip aynı
   bildirimin 2-3 kez gitmesine yol açmaz. */
function pushDeviceId(){
  let id = load('rota_push_device_id', null);
  if(!id){ id = uid()+uid(); save('rota_push_device_id', id); }
  return id;
}

/* Uygulama ÖN PLANDAYKEN (sekme/uygulama açık ve odaklanmış) gelen mesajlar, service worker'ın
   onBackgroundMessage'ından GEÇMEZ — Firebase bunu bilerek böyle tasarlamış, "zaten kullanıcı
   uygulamanın içinde, gerek yok" varsayımıyla. Ama masaüstünde/laptop'ta insanlar genelde
   sekmeyi hep açık/odaklı tutuyor, telefonda da uygulama içindeyken aynı durum oluyor — yani
   pratikte KULLANICI HİÇBİR ZAMAN bildirim görmüyordu. Bu yüzden ön plan mesajlarını da AYRICA
   burada elle yakalayıp, arka plandakiyle aynı şekilde (service worker üzerinden) gösteriyoruz.
   Sadece bir kere kurulması yeterli, VAPID key olmasa bile hata vermez (mesaj hiç gelmez). */
function setupForegroundPushListener(){
  if(!pushConfigured() || typeof firebase.messaging!=='function') return;
  try{
    const messaging = firebase.messaging();
    messaging.onMessage((payload) => {
      const title = payload.data?.title || 'Rota Takip';
      const body = payload.data?.body || '';
      const tag = payload.data?.tag || 'rota-takip-uyari';
      if('serviceWorker' in navigator){
        navigator.serviceWorker.getRegistration().then(reg=>{
          if(reg) reg.showNotification(title, { body, icon:'./icon-192.png', badge:'./icon-192.png', tag, data: payload.data||{} });
          else toast(title+': '+body); // service worker hiç kayıtlı değilse en azından uygulama içi bildirim göster
        });
      } else {
        toast(title+': '+body);
      }
    });
  }catch(err){ console.warn('Ön plan push dinleyicisi kurulamadı:', err); }
}

async function enablePushNotifications(){
  if(!session) return;
  if(typeof Notification==='undefined' || !('serviceWorker' in navigator)){
    toast('Bu tarayıcı bildirim desteklemiyor'); return;
  }
  if(!pushConfigured()){ toast('Bildirim sistemi henüz kurulmadı (VAPID key eksik)'); return; }
  try{
    // ÖNEMLİ: Notification.requestPermission() kullanıcının tıklamasıyla AYNI çağrı yığınına
    // mümkün olduğunca yakın tetiklenmeli — aradan bir await (özellikle serviceWorker.register()
    // gibi süre alabilen bir işlem) girerse, birçok mobil tarayıcı tıklamanın "geçerliliğinin"
    // dolduğunu düşünüp gerçek izin penceresini HİÇ GÖSTERMEDEN sessizce 'default' döndürüyor —
    // "toggle açılıp kendi kendine kapanıyor, hiçbir pencere çıkmıyor" belirtisinin sebebi bu.
    // Bu yüzden izin isteği servis çalışanı kaydından ÖNCE yapılıyor.
    const perm = await Notification.requestPermission();
    pushPermissionState = perm;
    if(perm !== 'granted'){ toast('Bildirim izni verilmedi'); render(); return; }
    const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if(token){
      DB.ref('operators/'+session.username+'/fcmTokens/'+pushDeviceId()).set(token);
      toast('Bildirimler açıldı ✓');
    }
  }catch(err){
    console.error('Push kayıt hatası:', err);
    toast('Bildirim açılamadı: '+(err.message||'bilinmeyen hata'));
  }
  render();
}

/* SuperAdmin'in istediği kişiye anlık, serbest metinli bildirim göndermesi. Client sadece
   manualPushRequests/ altına bir istek yazıyor — Cloud Function bunu anında (database trigger,
   dakikalar sürmüyor) yakalayıp gerçek gönderimi yapıyor, çünkü FCM'e gerçek mesaj göndermek
   Admin SDK gerektiriyor, tarayıcıdan doğrudan yapılamıyor. */
function sendManualPush(){
  if(!session || !session.isSuperAdmin){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return; }
  const toUsername = document.getElementById('mpush-to')?.value || '';
  const title = (document.getElementById('mpush-title')?.value || '').trim() || 'Rota Takip';
  const bodyText = (document.getElementById('mpush-body')?.value || '').trim();
  if(!toUsername){ toast('Alıcı seç'); return; }
  if(!bodyText){ toast('Mesaj boş olamaz'); return; }
  if(bodyText.length>500){ toast('Mesaj çok uzun (max 500 karakter)'); return; }
  DB.ref('manualPushRequests').push({
    toUsername, title, body: bodyText,
    requestedBy: session.username, requestedByName: session.displayName,
    requestedAt: Date.now()
  }).then(()=>{
    toast('Bildirim gönderildi ✓');
    document.getElementById('mpush-body').value = '';
  }).catch(err=>{
    toast('Gönderilemedi: '+(err.message||'bilinmeyen hata'));
  });
}
// Maliyet optimizasyonu: pushLog artık canlı dinlenmiyor (org'daki HERKESİN bildirim geçmişi
// büyüdükçe, sadece kendi son-30'unu göstermek için her operatörün cihazına TAMAMI sürekli
// indiriliyordu). Bunun yerine iki ayrı, kapsamı daraltılmış TEK SEFERLİK sorgu var: kişisel
// geçmiş (loadMyPushHistory — giriş yapınca ve "Bildirimlerim" açılınca tazelenir) ve
// SuperAdmin'in "Bildirim Gönder" ekranındaki tüm-kayıt özeti (loadPushLogHistory — o sekme
// açılınca tazelenir). İkisi de artık CANLI değil — yeni bir bildirim geldiğinde rozet/liste
// ANINDA değil, bir sonraki tazeleme noktasında güncellenir.
function pushLogHistory(){
  return Object.entries(STATE.pushLogAll||{}).map(([id,v])=>({id,...v})).sort((a,b)=>b.sentAt-a.sentAt).slice(0,50);
}
function myPushHistory(){
  if(!session) return [];
  return Object.entries(STATE.myPushHistory||{}).map(([id,v])=>({id,...v})).sort((a,b)=>b.sentAt-a.sentAt).slice(0,30);
}
function unreadPushCount(){ return myPushHistory().filter(h=>!h.read).length; }
function loadMyPushHistory(){
  if(!session) return;
  DB.ref('pushLog').orderByChild('toUsername').equalTo(session.username).limitToLast(30).get().then(snap=>{
    STATE.myPushHistory = snap.val() || {};
    if(myPushHistoryModalOpen){
      // Modal açıkken taze veri gelince görülenler hemen okundu sayılsın (eski davranışla aynı).
      Object.entries(STATE.myPushHistory).forEach(([id,h])=>{ if(!h.read){ DB.ref('pushLog/'+id+'/read').set(true); h.read = true; } });
    }
    safeRender();
  }).catch(err=>console.warn('Kişisel bildirim geçmişi okunamadı:', err));
}
function loadPushLogHistory(){
  DB.ref('pushLog').orderByChild('sentAt').limitToLast(50).get().then(snap=>{
    STATE.pushLogAll = snap.val() || {};
    safeRender();
  }).catch(err=>console.warn('Bildirim günlüğü okunamadı:', err));
}
// Maliyet optimizasyonu: messages de aynı sebeple canlı dinlenmiyordu — sadece canViewMessages()
// olan (SuperAdmin / messagesAccess) hesaplar için, son 100 kayıtla sınırlı tek seferlik sorgu.
// Erişimi olmayan kullanıcılar için hiç sorgu bile atılmıyor.
function loadMessages(){
  if(!canViewMessages()){ STATE.messages = {}; return; }
  DB.ref('messages').orderByChild('ts').limitToLast(100).get().then(snap=>{
    STATE.messages = snap.val() || {};
    safeRender();
  }).catch(err=>console.warn('Mesajlar okunamadı:', err));
}
function loadStockHareketleri(){
  DB.ref('stockHareketleri').orderByChild('ts').limitToLast(20).get().then(snap=>{
    stockHareketleri = snap.val() || {};
    safeRender();
  }).catch(err=>console.warn('Stok hareketleri okunamadı:', err));
}
let myPushHistoryModalOpen = false;
function openMyPushHistoryModal(){
  myPushHistoryModalOpen = true;
  loadMyPushHistory(); // taze son-30'u çek; okundu işaretleme burada, taze veri gelince yapılır
  render();
}
function closeMyPushHistoryModal(){ myPushHistoryModalOpen = false; render(); }

/* ===================== FIREBASE ===================== */
let _scopedLoadsDone = false; // loadMyPushHistory/loadMessages bu oturumda bir kez tetiklendi mi
function fbConfigured(){ return FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.databaseURL.indexOf('BURAYA')<0; }
function initFirebase(){
  if(typeof firebase==='undefined'){ console.warn('Firebase SDK yüklenemedi (internet yok mu?)'); return false; }
  if(!fbConfigured()){ console.warn('Firebase databaseURL girilmemiş'); return false; }
  try{
    firebase.initializeApp(FIREBASE_CONFIG);
    DB = firebase.database();
    FB_OK = true;
    setupForegroundPushListener();
    DB.ref('.info/connected').on('value', snap=>{
      connOK = snap.val() === true;
      safeRender();
    });
    DB.ref('operators').on('value', snap=>{
      STATE.operators = snap.val() || {};
      seedIfNeeded();
      // Maliyet optimizasyonu: messages/pushLog artık canlı dinlenmiyor (bkz. loadMessages,
      // loadMyPushHistory). canViewMessages() operators'a bağlı olduğu için, "hatırlanan" bir
      // oturumla sayfa açılışında bu ikisini operators ilk yüklendiğinde bir kez tetikliyoruz;
      // hatırlanmayan girişlerde doLogin() zaten kendi tetikliyor (_scopedLoadsDone o zaman true olur).
      if(session && !_scopedLoadsDone){ _scopedLoadsDone = true; loadMyPushHistory(); loadMessages(); }
      safeRender();
    });
    DB.ref('entries').on('value', snap=>{
      STATE.entries = snap.val() || {};
      safeRender();
    });
    // Maliyet optimizasyonu: aşağıdaki 6 düğüm nadiren değişen REFERANS listeleri — canlı
    // dinlemeye ihtiyaçları yok, tek seferlik okunuyor. Bir admin bunları düzenlerse (bkz.
    // js/catalog.js, js/operations.js) ilgili fonksiyon kendi yerel kopyasını da güncelleyip
    // render() çağırıyor — o yüzden SAYFAYI YENİLEMEDEN kendi değişikliğini görüyor; sadece
    // BAŞKA bir cihazdaki kullanıcı bir sonraki sayfa yenilemesinde günceli alır (bu tür nadir
    // değişen listeler için kabul edilebilir bir gecikme).
    DB.ref('machines_extra').get().then(snap=>{
      extraMachines = snap.val() || {};
      safeRender();
    }).catch(err=>console.warn('machines_extra okunamadı:', err));
    DB.ref('machines_hidden').get().then(snap=>{
      hiddenMachines = snap.val() || {};
      safeRender();
    }).catch(err=>console.warn('machines_hidden okunamadı:', err));
    // Maliyet optimizasyonu: aşağıdaki 5 düğüm de (machines_extra/machines_hidden'la aynı
    // gerekçeyle) nadiren değişen REFERANS listeleri — canlı dinlemeye gerek yok, tek seferlik
    // okunuyor. Yazan taraf kendi yerel kopyasını da güncelleyip render() çağırıyor (bkz.
    // toggleMachineFason, setMachineAtolye, addTadilatOnHazirIstek/removeTadilatOnHazirIstek,
    // malzeme/uretimPersoneli yükleme-silme fonksiyonları) — o yüzden yazan cihaz sayfayı
    // yenilemeden kendi değişikliğini görür; başka bir cihaz bir sonraki sayfa yenilemesinde alır.
    DB.ref('machines_fason').get().then(snap=>{
      fasonMachines = snap.val() || {};
      safeRender();
    }).catch(err=>console.warn('machines_fason okunamadı:', err));
    DB.ref('machines_atolye').get().then(snap=>{
      machineAtolye = snap.val() || {};
      safeRender();
    }).catch(err=>console.warn('machines_atolye okunamadı:', err));
    // manualPushRequests: bilerek dinlenmiyor — client hiçbir yerde okumuyor (yazma push() ile
    // olduğu için read-back gerekmiyor, gerçek gönderimi Cloud Function admin SDK ile yapıyor).
    DB.ref('tadilatOnHazirIstekler').get().then(snap=>{
      STATE.tadilatOnHazirIstekler = snap.val() || {};
      safeRender();
    }).catch(err=>console.warn('tadilatOnHazirIstekler okunamadı:', err));
    DB.ref('validIsEmri').get().then(snap=>{
      STATE.validIsEmri = snap.val() || {};
      safeRender();
    }).catch(err=>console.warn('validIsEmri okunamadı:', err));
    DB.ref('malzemeListesi').get().then(snap=>{
      malzemeListesi = snap.val() || {};
      safeRender();
    }).catch(err=>console.warn('malzemeListesi okunamadı:', err));
    DB.ref('isMerkezleri').get().then(snap=>{
      isMerkezleri = snap.val() || {};
      safeRender();
    }).catch(err=>console.warn('isMerkezleri okunamadı:', err));
    DB.ref('uretimPersoneli').get().then(snap=>{
      uretimPersoneli = snap.val() || {};
      safeRender();
    }).catch(err=>console.warn('uretimPersoneli okunamadı:', err));
    DB.ref('tadilatBolumKurallari').get().then(snap=>{
      tadilatBolumKurallari = snap.val() || {};
      safeRender();
    }).catch(err=>console.warn('tadilatBolumKurallari okunamadı:', err));
    DB.ref('adminTabPermissions').on('value', snap=>{
      adminTabPermissions = snap.val() || {};
      safeRender();
    });
    DB.ref('durusReasons').get().then(snap=>{
      STATE.durusReasons = snap.val() || [];
      safeRender();
    }).catch(err=>console.warn('durusReasons okunamadı:', err));
    DB.ref('settings').on('value', snap=>{
      appSettings = snap.val() || {};
      safeRender();
    });
    DB.ref('stockItems').on('value', snap=>{
      stockItems = snap.val() || {};
      safeRender();
    });
    // Maliyet optimizasyonu: stockHareketleri de pushLog'la aynı sebeple canlı dinlenmiyor —
    // sadece Ayarlar → Malzeme Stoğu sekmesi son 20 hareketi gösteriyor (bkz. render-admin.js),
    // o yüzden o sekme açılınca (loadStockHareketleri, setSettingsSubTab'da) tek seferlik,
    // son-20'yle sınırlı bir sorgu yeterli. consumeStock() kendi yazdığı hareketi yerel
    // kopyaya da ekleyip render() çağırıyor, o yüzden hareketi yapan cihaz anında görür.
    DB.ref('tadilatlar').on('value', snap=>{
      tadilatlar = snap.val() || {};
      safeRender();
    });
    return true;
  }catch(e){ console.warn('Firebase init hatası', e); return false; }
}
function seedIfNeeded(){
  if(Object.keys(STATE.operators).length>0) return;
  console.warn('Firebase "operators" düğümü boş. Ayarlar → "+ Kullanıcı Ekle" panelinden operatörleri ve bir ADMIN hesabını manuel eklemen gerekiyor.');
}
let _entriesArrayCache = null, _entriesArrayCacheSrc = null;
function entriesArray(){
  // STATE.entries her Firebase güncellemesinde YENİ bir obje referansıyla değiştiriliyor (bkz.
  // initFirebase listener'ı) — o yüzden referans karşılaştırması güvenli bir "değişti mi" testi.
  // Bu fonksiyon tek bir render() geçişinde onlarca yerden çağrılıyor; her seferinde
  // Object.entries+map'i tekrar tekrar yapmak yerine, veri değişmediği sürece sonucu tekrar kullanıyoruz.
  if(_entriesArrayCacheSrc !== STATE.entries){
    _entriesArrayCache = Object.entries(STATE.entries).map(([id,e])=>({id, ...e}));
    _entriesArrayCacheSrc = STATE.entries;
  }
  return _entriesArrayCache;
}

/* ===================== KİMLİK / GİRİŞ ===================== */
async function doLogin(){
  const uname = (document.getElementById('login-username').value||'').trim().toUpperCase();
  const pass = document.getElementById('login-password').value||'';
  const remember = !!document.getElementById('login-remember')?.checked;
  const op = STATE.operators[uname];
  const hash = pass ? await sha256Hex(pass) : '';
  const legacyPlaintextMatch = !!op && op.password === pass && op.password !== hash;
  const passOk = !!op && (op.password === hash || legacyPlaintextMatch);
  if(!op || !passOk){
    loginError = 'Kullanıcı adı veya şifre hatalı';
    toast(loginError);
    render();
    return;
  }
  if(legacyPlaintextMatch){ DB.ref('operators/'+uname+'/password').set(hash); } // sessiz göç
  loginError = '';
  session = { username: uname, displayName: op.displayName, isAdmin: !!op.isAdmin, isSuperAdmin: !!op.isSuperAdmin, isSef: !!op.isSef, isUretimSef: !!op.isUretimSef };
  if(remember){ save('rota_remember', true); save('rota_session', session); }
  else { save('rota_remember', false); save('rota_session', null); }
  _scopedLoadsDone = true;
  loadMyPushHistory();
  loadMessages();
  view = session.isAdmin ? ((session.isSef || session.isUretimSef) ? 'matrix' : 'report') : 'list';
  if(!session.isAdmin) newForm.makine = op.defaultMachine || '';
  render();
}
function doLogout(){
  session=null; save('rota_session', null); save('rota_remember', false); view='list';
  // Paylaşılan bir cihazda bir sonraki kullanıcıya önceki kişinin bildirim/mesaj geçmişi
  // sızmasın diye (aksi halde bir sonraki login tetiklenene kadar eski veri ekranda kalırdı).
  STATE.myPushHistory = {}; STATE.pushLogAll = {}; STATE.messages = {};
  _scopedLoadsDone = false;
  render();
}
let tadilatForceBekleyen = false; // "Tadilat duruşu" ile duraklattıktan hemen sonra bekleyen listeyi göstermeye zorlar
function setView(v){
  if(tadilatForceBekleyen && v!=='tadilat'){ toast('Lütfen gireceğiniz tadilat işini seçin ya da iptal edin'); return; }
  view=v; if(v==='new') newStep=1; if(v!=='tadilat') tadilatForceBekleyen=false; render();
}
function resolvedTheme(){
  if(theme!=='system') return theme==='light' ? 'light' : 'dark';
  try{ return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }catch(e){ return 'dark'; }
}
function setTheme(t){ theme=t; document.documentElement.className = 'theme-'+resolvedTheme(); save('rota_theme', t); render(); }
function toggleTheme(){ setTheme(resolvedTheme()==='dark' ? 'light' : 'dark'); }
function themeToggleHtml(){
  const isDark = resolvedTheme()==='dark';
  return `<button class="icon-btn" onclick="toggleTheme()" title="${isDark?'Açık temaya geç':'Koyu temaya geç'}" style="color:var(--accent)">
    ${isDark
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`}
  </button>`;
}

async function changePassword(){
  const cur = document.getElementById('pw-current').value||'';
  const next = (document.getElementById('pw-next').value||'').replace(/\D/g,'').slice(0,8);
  const conf = (document.getElementById('pw-confirm').value||'').replace(/\D/g,'').slice(0,8);
  if(!/^\d{1,8}$/.test(next)){ toast('Yeni şifre en fazla 8 haneli rakam olmalı'); return; }
  if(next!==conf){ toast('Yeni şifreler eşleşmiyor'); return; }
  const op = STATE.operators[session.username];
  const curHash = cur ? await sha256Hex(cur) : '';
  const curOk = !!op && (op.password === curHash || op.password === cur); // eski düz metin kayıtları için de kabul
  if(!op || !curOk){ toast('Mevcut şifre yanlış'); return; }
  const nextHash = await sha256Hex(next);
  DB.ref('operators/'+session.username+'/password').set(nextHash);
  toast('Şifre güncellendi');
  setView('list');
}

