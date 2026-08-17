/* Rota Takip — Arka Plan Bildirim Servisi (Service Worker)
   Bu dosya, telefon/tarayıcı kapalıyken (uygulama açık olmasa bile) push bildirimlerinin
   gösterilmesini sağlar. rota_takip.html ile AYNI KLASÖRE konulmalı (aynı origin/kök dizin) —
   yoksa tarayıcı service worker'ı kaydedemez.

   Buradaki FIREBASE_CONFIG, rota_takip.html'deki ile BİREBİR AYNI olmalı. Ana dosyada
   değiştirirsen burayı da güncelle. */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAYRQVtJt3sMTo8spx7AVa5EeS_bKXNrGI",
  authDomain: "ezel-kaliphane.firebaseapp.com",
  databaseURL: "https://ezel-kaliphane-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ezel-kaliphane",
  storageBucket: "ezel-kaliphane.firebasestorage.app",
  messagingSenderId: "525611507963",
  appId: "1:525611507963:web:4428d1487e66acdfcf905e"
});

const messaging = firebase.messaging();

// Uygulama arka plandayken (tab kapalı/telefon kilitli) gelen mesajları bildirim olarak göster.
// Sunucu (Cloud Function) artık SADECE "data" gönderiyor, "notification" alanı yok — bilerek.
// İkisi birlikte gönderilirse tarayıcı otomatik bir bildirim gösteriyor VE biz de burada elle
// bir tane daha gösteriyorduk, bu da aynı bildirimin 2 kez çıkmasına sebep oluyordu.
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || 'Rota Takip';
  const options = {
    body: payload.data?.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: payload.data || {},
    tag: payload.data?.tag || 'rota-takip-uyari' // aynı tag'li bildirimler üst üste değil, güncellenerek gösterilir
  };
  self.registration.showNotification(title, options);
});

// Bildirime tıklanınca uygulamayı öne getir / aç.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
