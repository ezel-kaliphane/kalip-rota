/* ===================== UZUN DURUŞ PUSH BİLDİRİMİ =====================
 * 5 dakikada bir çalışır: entries ve tadilatlar içindeki "duruş" kayıtlarını tarar,
 * appSettings'teki eşiği (varsayılan 30 dk) aşanlar için, o işin sahibi operatöre
 * (operatorUsername) telefonuna push bildirimi gönderir.
 *
 * Aynı duruş için tekrar tekrar bildirim atmamak için (5 dakikada bir taranıyor çünkü),
 * her kayıt için "bu duruşu (bu duruşTs için) zaten bildirdik mi" diye pushNotified/
 * altında bir iz tutuluyor. Operatör "Devam Et"e basıp yeniden duruşa girerse duruşTs
 * değişeceği için yeni bir bildirim hakkı doğuyor.
 *
 * Kurulum: bkz. proje köküne eklenen DEPLOY_TALIMATI.md
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.database();

const GUN_SONU_REASON = "Gün Sonu (Mesai Bitti, yarın devam edilecek)";

async function sendToOperator(username, title, body, tag, meta){
  meta = meta || {};
  const logAndReturn = async (result) => {
    await db.ref('pushLog').push({
      toUsername: username || null, title, body, tag,
      kaynak: meta.kaynak || tag, gonderen: meta.gonderen || null,
      sentAt: Date.now(), sent: result.ok, reason: result.reason || null
    });
    return result;
  };

  if(!username) return logAndReturn({ ok:false, reason:'no-username' });
  const opSnap = await db.ref('operators/'+username).get();
  const opVal = opSnap.val() || {};
  if(opVal.pushMuted) return logAndReturn({ ok:false, reason:'muted' }); // operatör bildirimleri kendi ayarlarından kapatmış
  const tokensObj = opVal.fcmTokens;
  if(!tokensObj) return logAndReturn({ ok:false, reason:'no-tokens' }); // bu operatör hiç bildirim açmamış
  // fcmTokens artık { deviceId: token } şeklinde tutuluyor (bkz. rota_takip.html — pushDeviceId).
  // Eski (geçiş öncesi) kayıtlarda token doğrudan key olarak durabilir; ikisini de destekleyelim:
  // değer bir string ise cihaz->token eşlemesi, değer `true` ise (eski format) key'in kendisi token'dır.
  const entries = Object.entries(tokensObj).map(([key, val]) => [key, typeof val==='string' ? val : key]);
  const tokens = entries.map(([,t]) => t);
  if(tokens.length===0) return logAndReturn({ ok:false, reason:'no-tokens' });

  // ÖNEMLİ: Payload'da SADECE "data" var, üst seviye "notification" yok. Çünkü ikisi birlikte
  // gönderilirse tarayıcı mesajı OTOMATİK gösteriyor (Web Push'un standart davranışı) VE bizim
  // service worker'ımızdaki onBackgroundMessage da AYRICA elle gösteriyor — aynı bildirim 2 kez
  // çıkıyordu. Data-only gönderince gösterimi tamamen biz (service worker) kontrol ediyoruz.
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    data: { title, body, tag },
    webpush: { fcmOptions: { link: '/' } }
  });

  // Artık geçersiz olan (uygulama kaldırılmış, izin geri alınmış vs.) token'ları temizle.
  const updates = {};
  res.responses.forEach((r, i) => {
    if(!r.success){
      const code = r.error?.code || '';
      if(code==='messaging/registration-token-not-registered' || code==='messaging/invalid-argument'){
        const deviceKey = entries[i][0];
        updates['operators/'+username+'/fcmTokens/'+deviceKey] = null;
      }
    }
  });
  if(Object.keys(updates).length>0){ await db.ref().update(updates); }

  const successCount = res.responses.filter(r=>r.success).length;
  return logAndReturn({ ok: successCount>0, reason: successCount>0 ? null : 'send-failed', successCount, failureCount: tokens.length-successCount });
}

/* Sessiz Saatler — Ayarlar'dan (js/state.js: toggleSessizSaatler/setSessizSaat) yönetilen, gece
 * vardiyası olmayan işletmelerde belirli saatler arasında zamanlanmış fonksiyonların hiç veri
 * çekmeden atlamasını sağlayan ortak kontrol. settings/sessizSaatlerEnabled kapalıysa (varsayılan)
 * hep false döner — yani davranış değişmez. Gece yarısını aşan aralıkları da destekler (ör.
 * 22:00 → 06:00). Şu an sadece uzunDurusUyarisi kullanıyor; ileride başka zamanlanmış
 * fonksiyonlara (ör. gunBasiDurusHatirlatici) eklenmek istenirse burası paylaşılan yardımcı
 * olarak kullanılabilir.
 */
function sessizSaattemi(settings){
  if(!settings.sessizSaatlerEnabled) return false;
  const baslangic = settings.sessizSaatBaslangic;
  const bitis = settings.sessizSaatBitis;
  if(!baslangic || !bitis) return false;
  const nowIst = new Date(Date.now() + 3*60*60*1000); // UTC+3 (Türkiye sabit, DST yok)
  const su = String(nowIst.getUTCHours()).padStart(2,'0')+':'+String(nowIst.getUTCMinutes()).padStart(2,'0');
  if(baslangic <= bitis){
    // normal aralık, örn. 08:00 -> 18:00
    return su >= baslangic && su < bitis;
  } else {
    // gece yarısını aşan aralık, örn. 22:00 -> 06:00
    return su >= baslangic || su < bitis;
  }
}

exports.uzunDurusUyarisi = onSchedule({ schedule: 'every 1 minutes', region: 'europe-west1', timeZone: 'Europe/Istanbul' }, async () => {
  // ÖNEMLİ (maliyet optimizasyonu): settings, ağır veri çekimlerinden ÖNCE tek başına okunuyor —
  // uzunDurusUyariEnabled kapalıysa ya da Sessiz Saatler'e denk geliyorsa entries/tadilat
  // sorgularına hiç gidilmeden çıkılıyor, o dakikanın indirme maliyeti sıfırlanıyor.
  const settingsSnap = await db.ref('settings').get();
  const settings = settingsSnap.val() || {};
  if(settings.uzunDurusUyariEnabled === false) return; // varsayılan: açık
  if(sessizSaattemi(settings)) return; // gece vardiyası yok, bu saatte hiç kontrol yapma

  // ÖNEMLİ (maliyet optimizasyonu): entries düğümü büyüdükçe, her dakika TAMAMINI indirmek
  // gereksiz Realtime Database "download" maliyeti yaratıyordu. Bunun yerine sunucu tarafında
  // sadece status='duruş' olan kayıtları filtreleyip çekiyoruz — zaten sadece onlarla
  // ilgileniyoruz. Bunun çalışması için Rules'da entries için ".indexOn": ["status"] tanımlı
  // olmalı (yoksa da çalışır ama Firebase loglarında "indekssiz sorgu" uyarısı çıkar).
  //
  // tadilatlar düğümü için de aynı sorun vardı, ama iç içe operasyonlar/{opId}/status alanına
  // RTDB'de orderByChild ile filtre uygulanamıyor (sadece bir seviye altına indeks konabilir).
  // Bunun yerine js/tadilat.js, bir operasyon 'duruş'a her girdiğinde/çıktığında küçük bir
  // denormalize düğüm olan tadilatDurustaOperasyonlar/{tadilatId}_{opId} altını güncel tutuyor —
  // biz burada tüm tadilatlar ağacı yerine sadece bu küçük düğümü okuyoruz.
  const [entriesSnap, tadilatDurustakilerSnap, notifiedEntriesSnap, notifiedTadilatSnap] = await Promise.all([
    db.ref('entries').orderByChild('status').equalTo('duruş').get(),
    db.ref('tadilatDurustaOperasyonlar').get(),
    db.ref('pushNotified/entries').get(),
    db.ref('pushNotified/tadilat').get()
  ]);

  const esikMs = (Number(settings.uzunDurusEsikDk) || 30) * 60000;
  const now = Date.now();

  const entries = entriesSnap.val() || {};
  const notifiedEntries = notifiedEntriesSnap.val() || {};
  const entryUpdates = {};

  for(const [entryId, e] of Object.entries(entries)){
    if(e.status!=='duruş' || !e.duruşTs || e.duruşNedeni===GUN_SONU_REASON) continue;
    if(now - e.duruşTs < esikMs) continue;
    const prev = notifiedEntries[entryId];
    if(prev && prev.duruşTs === e.duruşTs) continue; // bu duruş için zaten bildirildi
    const dk = Math.round((now - e.duruşTs)/60000);
    const makineKisa = (e.makine||'').split(' · ')[0] || '';
    await sendToOperator(
      e.operatorUsername,
      '⚠ Duruş devam ediyor',
      `${makineKisa} · ${e.isEmriNo||e.talepNo||''} — "${e.duruşNedeni}" nedeniyle ${dk} dakikadır duruşta. Unutmadıysan devam et.`,
      'uzun-durus',
      { kaynak: 'Duruş Uyarısı (Otomatik)' }
    );
    entryUpdates['pushNotified/entries/'+entryId] = { duruşTs: e.duruşTs, notifiedAt: now };
  }
  if(Object.keys(entryUpdates).length>0){ await db.ref().update(entryUpdates); }

  const tadilatDurustakiler = tadilatDurustakilerSnap.val() || {};
  const notifiedTadilat = notifiedTadilatSnap.val() || {};
  const tadilatUpdates = {};

  for(const [key, op] of Object.entries(tadilatDurustakiler)){
    if(!op.duruşTs || op.duruşNedeni===GUN_SONU_REASON) continue;
    if(now - op.duruşTs < esikMs) continue;
    const prev = notifiedTadilat[key];
    if(prev && prev.duruşTs === op.duruşTs) continue;
    const dk = Math.round((now - op.duruşTs)/60000);
    const makineKisa = (op.makine||'').split(' · ')[0] || '';
    await sendToOperator(
      op.operatorUsername,
      '⚠ Tadilat duruşu devam ediyor',
      `${makineKisa} · ${op.uKodu||''} — "${op.duruşNedeni}" nedeniyle ${dk} dakikadır duruşta. Unutmadıysan devam et.`,
      'uzun-durus-tadilat',
      { kaynak: 'Duruş Uyarısı (Otomatik)' }
    );
    tadilatUpdates['pushNotified/tadilat/'+key] = { duruşTs: op.duruşTs, notifiedAt: now };
  }
  if(Object.keys(tadilatUpdates).length>0){ await db.ref().update(tadilatUpdates); }
});

/* ===================== TADİLAT TAMAMLANDI BİLDİRİMİ (anlık) =====================
 * Periyodik taramadan farklı: bu bir "database trigger" — tadilatlar/{id}/operasyonlar/{opId}
 * altında herhangi bir yazma olduğu AN tetiklenir, dakikalarca beklemeye gerek yok.
 *
 * Bir operasyon "tamamlandi" + "sonOperasyon: true" olduğunda (yani tadilatın SON adımı
 * bitip parça tamamen hazır olduğunda), tüm ŞEF yetkili (isSef:true) hesaplara bildirim
 * gönderilir — şefler, kendi ekiplerindeki talep sahibine haber verecek diye tasarlandı.
 *
 * "before" durumunda zaten tamamlanmışsa tekrar göndermiyor (örn. kayıt başka bir sebeple
 * güncellenirse ikinci kez bildirim gitmesin diye).
 */
const { onValueWritten, onValueCreated } = require('firebase-functions/v2/database');

exports.tadilatTamamlandiBildirimi = onValueWritten(
  { ref: 'tadilatlar/{tadilatId}/operasyonlar/{opId}', region: 'europe-west1', instance: 'ezel-kaliphane-default-rtdb' },
  async (event) => {
    const before = event.data.before.val();
    const after = event.data.after.val();
    if(!after) return; // silinmişse ilgilenme

    const wasCompleted = !!(before && before.status==='tamamlandi' && before.sonOperasyon);
    const isCompletedNow = !!(after.status==='tamamlandi' && after.sonOperasyon);
    if(!isCompletedNow || wasCompleted) return; // yeni bir "tamamlandı" anı değilse çık

    const settingsSnap = await db.ref('settings/tadilatTamamlandiBildirimEnabled').get();
    if(settingsSnap.val() === false) return; // SuperAdmin/yetkili yönetici kapatmış

    // Eventarc "en az bir kez" teslimat garantisi verdiği için aynı olay 2 kez tetiklenebilir —
    // atomik bir "_claimed" bayrağıyla ikinci tetiklenmede gönderimi engelliyoruz.
    const claim = await event.data.after.ref.child('_bildirimClaimed').transaction(cur => cur ? undefined : true);
    if(!claim.committed) return;

    const tadilatId = event.params.tadilatId;
    const tSnap = await db.ref('tadilatlar/'+tadilatId).get();
    const t = tSnap.val();
    if(!t) return;

    const opsSnap = await db.ref('operators').get();
    const operators = opsSnap.val() || {};
    const sefUsernames = Object.entries(operators).filter(([code, v]) => v.isSef).map(([code]) => code);
    if(sefUsernames.length===0) return;

    const title = '✅ Tadilat tamamlandı';
    const body = `${t.uKodu||''}${t.kisaAciklama?` — ${t.kisaAciklama}`:''}${t.talepEdenKisi?` (Talep eden: ${t.talepEdenKisi})`:''} hazır.`;

    await Promise.all(sefUsernames.map(code => sendToOperator(code, title, body, 'tadilat-tamamlandi', { kaynak: 'Tadilat Tamamlandı (Otomatik)' })));
  }
);

/* ===================== MANUEL BİLDİRİM (SuperAdmin panelinden) =====================
 * SuperAdmin panelindeki "📤 Bildirim Gönder" formu, manualPushRequests/{id} altına bir
 * istek YAZAR (client). Bu fonksiyon o yazma anında (anlık, bekleme yok) tetiklenir, gerçek
 * FCM gönderimini yapar ve sonucu (sent/error) aynı kayda geri yazar — panel bunu okuyup
 * "Gönderildi / Başarısız" olarak gösteriyor.
 */
exports.manuelBildirimGonder = onValueCreated(
  { ref: 'manualPushRequests/{reqId}', region: 'europe-west1', instance: 'ezel-kaliphane-default-rtdb' },
  async (event) => {
    // Google'ın database trigger sistemi "en az bir kez" teslim garantisi veriyor — yani aynı
    // olay bazen 2 kez tetiklenebilir. Bunu göndermeden ÖNCE bir "_claimed" bayrağını atomik
    // olarak (transaction) işaretleyerek engelliyoruz: ikinci tetiklenme bayrağı zaten dolu
    // bulur, "committed:false" döner, gönderim tekrarlanmaz.
    const claim = await event.data.ref.child('_claimed').transaction(cur => cur ? undefined : true);
    if(!claim.committed) return;

    const req = event.data.val();
    if(!req || !req.toUsername) return;
    const result = await sendToOperator(req.toUsername, req.title || 'Rota Takip', req.body || '', 'manuel-bildirim', { kaynak: 'Manuel', gonderen: req.requestedByName || req.requestedBy });
    await event.data.ref.update({
      sent: result.ok,
      sentAt: Date.now(),
      error: result.ok ? null : (result.reason==='no-tokens' ? 'Alıcı bildirim izni vermemiş' : 'Gönderim başarısız')
    });
  }
);

/* ===================== GÜN BAŞI DURUŞ HATIRLATICISI =====================
 * Diğer duruş uyarısından farkı: "eşik/süre" mantığı değil, GÜNE ÖZEL, SuperAdmin'in
 * Ayarlar'dan belirlediği SAATTE tek sefer çalışan bir kontrol. O an duruşta olan HER işi
 * yakalar — "Gün Sonu" nedeni bile DAHİL (diğer uyarı bunu bilerek dışarıda bırakıyordu,
 * çünkü o "beklenen/planlı" bir duruştu; ama sabah olunca artık "unutulmuş" sayılır).
 *
 * Saat, gün tipine göre 3 ayrı ayardan okunuyor: settings/gunBasiSaatHaftaIci (Pzt-Cuma),
 * settings/gunBasiSaatCumartesi, settings/gunBasiSaatPazar — hepsi "HH:MM" string. Bir gün
 * tipi için ayar boşsa, o gün tipinde hiç çalışmıyor (ör. Pazar'ı boş bırakırsan Pazar günü
 * hiç bildirim gitmez). Türkiye artık yaz/kış saati uygulamadığı için (sabit UTC+3), saat
 * hesaplamasını basit bir +3 saat kaymasıyla güvenle yapabiliyoruz.
 *
 * Cron yerine HER DAKİKA çalışıp "şu an, ayarlanan saate denk geliyor mu" diye bakıyoruz —
 * böylece saat, deploy gerekmeden Ayarlar ekranından anında değiştirilebiliyor.
 *
 * İKİNCİ KONTROL (status='devam'): "Uzun Duruş"un tam tersi senaryo için — bir iş hiç
 * "Bitir"/"Duraklat" denmeden 'devam' durumunda bir önceki günden beri açık kalmış olabilir
 * (operatör kapatmayı unutup gitmiş). Bilerek AYRI bir mesaj/tag ile gönderiliyor (duruş
 * "makineyi devreye al" der, bu "hâlâ açık görünüyor, unuttun mu" der — farklı eylem
 * gerektiriyorlar). Eşik olarak sabit bir süre yerine "bugünden ÖNCE başlamış mı" (gün sınırı)
 * kullanılıyor — Gün Başı zaten günde bir kez, günün başında çalıştığı için en doğru ölçüt bu.
 * Fason (dışarı gönderim) makineleri BİLİNÇLİ olarak dışlanıyor — orada 'devam' durumunun
 * günlerce açık kalması bug değil, kayıp günü ölçmenin asıl yöntemi (bkz. js/state.js'teki
 * uzunDevamEdenKayitlar() içindeki aynı gerekçe — gerçek veride FII01/OPRT14'te 88 kayıt hiç
 * kapatılmadan biriktiği görüldü, bu kontrol olmadan her sabah o operatöre onlarca yanlış
 * alarm giderdi).
 */
exports.gunBasiDurusHatirlatici = onSchedule({ schedule: 'every 1 minutes', region: 'europe-west1', timeZone: 'Europe/Istanbul' }, async () => {
  const settingsSnap = await db.ref('settings').get();
  const settings = settingsSnap.val() || {};
  if(settings.gunBasiHatirlaticiEnabled === false) return;

  const nowIst = new Date(Date.now() + 3*60*60*1000); // UTC+3 (Türkiye sabit, DST yok)
  const gun = nowIst.getUTCDay(); // 0=Pazar, 1-5=Pzt-Cuma, 6=Cumartesi (getUTCDay çünkü nowIst zaten kaydırılmış "sanal UTC")
  const hedefSaat = gun===0 ? settings.gunBasiSaatPazar : gun===6 ? settings.gunBasiSaatCumartesi : settings.gunBasiSaatHaftaIci;
  if(!hedefSaat) return; // bu gün tipi için saat girilmemiş — çalışma

  const su = String(nowIst.getUTCHours()).padStart(2,'0')+':'+String(nowIst.getUTCMinutes()).padStart(2,'0');
  if(su !== hedefSaat) return; // henüz sırası değil

  const bugun = nowIst.toISOString().slice(0,10); // YYYY-MM-DD (Türkiye günü)
  const alreadyRanRef = db.ref('pushNotified/gunBasi/'+bugun+'/_ran');
  const claim = await alreadyRanRef.transaction(cur => cur ? undefined : true);
  if(!claim.committed) return; // bu gün için zaten çalıştı (ya da aynı dakika içinde ikinci tetiklenme)

  const bugunBaslangicMs = Date.parse(bugun+'T00:00:00+03:00'); // Türkiye gününün başlangıcı (UTC epoch ms)

  const [entriesSnap, devamEntriesSnap, tadilatlarSnap, fasonSnap] = await Promise.all([
    db.ref('entries').orderByChild('status').equalTo('duruş').get(),
    db.ref('entries').orderByChild('status').equalTo('devam').get(),
    db.ref('tadilatlar').get(),
    db.ref('machines_fason').get()
  ]);
  const fasonMakineleri = fasonSnap.val() || {};
  const isFason = (makine) => !!fasonMakineleri[(makine||'').split(' · ')[0]];

  const entries = entriesSnap.val() || {};
  for(const [entryId, e] of Object.entries(entries)){
    if(e.status!=='duruş' || !e.duruşTs) continue; // "Gün Sonu" dahil, HİÇBİR neden hariç tutulmuyor
    const makineKisa = (e.makine||'').split(' · ')[0] || '';
    await sendToOperator(
      e.operatorUsername,
      '🌅 Günaydın — makine duruşta',
      `${makineKisa} · ${e.isEmriNo||e.talepNo||''} — "${e.duruşNedeni||'—'}" nedeniyle duruşta bekliyor. Lütfen makineyi devreye alınız.`,
      'gun-basi-hatirlatici',
      { kaynak: 'Gün Başı Hatırlatıcısı (Otomatik)' }
    );
  }

  const devamEntries = devamEntriesSnap.val() || {};
  for(const [entryId, e] of Object.entries(devamEntries)){
    if(e.status!=='devam' || !e.startTs || e.startTs>=bugunBaslangicMs || isFason(e.makine)) continue;
    const makineKisa = (e.makine||'').split(' · ')[0] || '';
    await sendToOperator(
      e.operatorUsername,
      '🌅 Günaydın — iş hâlâ açık görünüyor',
      `${makineKisa} · ${e.isEmriNo||e.talepNo||''} — dünden beri "Devam Ediyor" durumunda. Hâlâ çalışıyorsan sorun yok, unuttuysan bitirmeyi/duraklatmayı unutma.`,
      'gun-basi-devam-hatirlatici',
      { kaynak: 'Gün Başı Hatırlatıcısı (Otomatik)' }
    );
  }

  const tadilatlar = tadilatlarSnap.val() || {};
  for(const [tadilatId, t] of Object.entries(tadilatlar)){
    const ops = t.operasyonlar || {};
    for(const [opId, op] of Object.entries(ops)){
      if(op.status==='duruş' && op.duruşTs){
        const makineKisa = (op.makine||'').split(' · ')[0] || '';
        await sendToOperator(
          op.operatorUsername,
          '🌅 Günaydın — makine duruşta',
          `${makineKisa} · ${t.uKodu||''} — "${op.duruşNedeni||'—'}" nedeniyle duruşta bekliyor. Lütfen makineyi devreye alınız.`,
          'gun-basi-hatirlatici',
          { kaynak: 'Gün Başı Hatırlatıcısı (Otomatik)' }
        );
      } else if(op.status==='devam' && op.baslamaTs && op.baslamaTs<bugunBaslangicMs && !isFason(op.makine)){
        const makineKisa = (op.makine||'').split(' · ')[0] || '';
        await sendToOperator(
          op.operatorUsername,
          '🌅 Günaydın — iş hâlâ açık görünüyor',
          `${makineKisa} · ${t.uKodu||''} — dünden beri "Devam Ediyor" durumunda. Hâlâ çalışıyorsan sorun yok, unuttuysan bitirmeyi/duraklatmayı unutma.`,
          'gun-basi-devam-hatirlatici',
          { kaynak: 'Gün Başı Hatırlatıcısı (Otomatik)' }
        );
      }
    }
  }
});

/* ===================== MESAİ BİTİŞİ / MESAİ SONU HATIRLATICILARI =====================
 * Gün Başı Hatırlatıcısı ile AYNI desen (her dakika kontrol, ayarlanan saate denk gelince
 * günde bir kez çalışma) ama hedef kitle ters: o an duruşta olanları değil, O AN FİİLEN
 * ÇALIŞMAKTA OLAN (status='devam') her iş/tadilatı yakalar ve operatörüne "mesai saati
 * geldi, fazla mesai yapmayacaksan durdur" hatırlatması gönderir.
 *
 * Saat, settings/mesaiBitisSaat (varsayılan "17:30") ve settings/mesaiSonuSaat (varsayılan
 * "21:30") üzerinden okunuyor — Firebase'den (Ayarlar'a arayüz eklenmeden de doğrudan) bu
 * alanlar değiştirilerek saat kod değişikliği/deploy gerekmeden ayarlanabilir. settings/
 * mesaiBitisHatirlaticiEnabled ve settings/mesaiSonuHatirlaticiEnabled ile ayrı ayrı
 * kapatılabilir (varsayılan: açık — Gün Başı Hatırlatıcısı ile aynı varsayılan mantık).
 */
async function mesaiHatirlaticiCalistir({ enabledKey, saatKey, varsayilanSaat, claimNode, title, bodySuffix, tag }){
  const settingsSnap = await db.ref('settings').get();
  const settings = settingsSnap.val() || {};
  if(settings[enabledKey] === false) return;

  const hedefSaat = settings[saatKey] || varsayilanSaat;
  const nowIst = new Date(Date.now() + 3*60*60*1000); // UTC+3 (Türkiye sabit, DST yok)
  const su = String(nowIst.getUTCHours()).padStart(2,'0')+':'+String(nowIst.getUTCMinutes()).padStart(2,'0');
  if(su !== hedefSaat) return; // henüz sırası değil

  const bugun = nowIst.toISOString().slice(0,10); // YYYY-MM-DD (Türkiye günü)
  const claimRef = db.ref('pushNotified/'+claimNode+'/'+bugun+'/_ran');
  const claim = await claimRef.transaction(cur => cur ? undefined : true);
  if(!claim.committed) return; // bu gün için zaten çalıştı (ya da aynı dakika içinde ikinci tetiklenme)

  const [entriesSnap, tadilatlarSnap] = await Promise.all([
    db.ref('entries').orderByChild('status').equalTo('devam').get(),
    db.ref('tadilatlar').get()
  ]);

  const entries = entriesSnap.val() || {};
  for(const [entryId, e] of Object.entries(entries)){
    if(e.status!=='devam') continue;
    const makineKisa = (e.makine||'').split(' · ')[0] || '';
    await sendToOperator(
      e.operatorUsername,
      title,
      `${makineKisa} · ${e.isEmriNo||e.talepNo||''} — ${bodySuffix}`,
      tag,
      { kaynak: title+' (Otomatik)' }
    );
  }

  const tadilatlar = tadilatlarSnap.val() || {};
  for(const [tadilatId, t] of Object.entries(tadilatlar)){
    const ops = t.operasyonlar || {};
    for(const [opId, op] of Object.entries(ops)){
      if(op.status!=='devam') continue;
      const makineKisa = (op.makine||'').split(' · ')[0] || '';
      await sendToOperator(
        op.operatorUsername,
        title,
        `${makineKisa} · ${t.uKodu||''} — ${bodySuffix}`,
        tag,
        { kaynak: title+' (Otomatik)' }
      );
    }
  }
}

exports.mesaiBitisiHatirlatici = onSchedule({ schedule: 'every 1 minutes', region: 'europe-west1', timeZone: 'Europe/Istanbul' }, async () => {
  await mesaiHatirlaticiCalistir({
    enabledKey: 'mesaiBitisHatirlaticiEnabled',
    saatKey: 'mesaiBitisSaat',
    varsayilanSaat: '17:30',
    claimNode: 'mesaiBitis',
    title: '🕠 Mesai saati bitti',
    bodySuffix: 'Fazla mesai yapmayacaksanız üretimi durdurup çıkış yapınız.',
    tag: 'mesai-bitis-hatirlatici'
  });
});

exports.mesaiSonuHatirlatici = onSchedule({ schedule: 'every 1 minutes', region: 'europe-west1', timeZone: 'Europe/Istanbul' }, async () => {
  await mesaiHatirlaticiCalistir({
    enabledKey: 'mesaiSonuHatirlaticiEnabled',
    saatKey: 'mesaiSonuSaat',
    varsayilanSaat: '21:30',
    claimNode: 'mesaiSonu',
    title: '🌙 Mesai sonu',
    bodySuffix: 'Daha fazla kalmayacaksanız üretimi durdurup çıkış yapınız.',
    tag: 'mesai-sonu-hatirlatici'
  });
});
