/* ==================== VERİMLİLİK — ZAMAN ARALIĞI ÇEKİRDEĞİ (13.10.2026) ====================
   Kullanıcı: "Muhammet Kurt nasıl %100 verimlilik çıkıyor, geç geldiği günler bile var."
   Son 30 günün gerçek verisiyle bulunan hatalar:
   1) Operatör verimliliği = çalışma ÷ (çalışma + duruş) idi. Duruşa basmayan herkes %100 çıkıyordu;
      geç geliş, erken çıkış, işler arası boşluk hiç sayılmıyordu (M. Kurt: 23/24 gün 08:15'ten sonra
      başlamış, vardiyaya göre ~%47).
   2) Birden çok güne yayılan kayıt TAMAMEN başladığı güne yazılıyordu (ör. Cuma açılıp Pazartesi
      kapanan iş Cuma'ya 1137 dk "çalışma"; bazı kişiler %129–211 çıkıyordu), sonraki günlere hiç.
   3) Aynı anda iki makine (UT04 + UT05) çalıştıran operatörün süresi iki kez sayılıyordu.
   4) Makine kullanılabilirliği Pazar ve tatil dahil TÜM takvim günleri × 540 dk idi.
   Yeni hesap (kullanıcı kararları): operatör = net çalışma ÷ (kayıtlı olduğu her hafta içi gün 540 dk
   + fazla mesai); makine = net çalışma ÷ (aralıktaki Pzt–Cum günleri × 540 dk + fazla mesai).
   Hafta sonu çalışma = fazla mesai. Bugün için 540 dk'nın vardiyada geçen kısmı.
   Her kayıt GÜN GÜN bölünür; duruş / Gün Sonu / Planlı Mola kendi zaman damgalarıyla (durusLog,
   excludedLog) çıkarılır. Operatörün süresi aralıkların BİRLEŞİMİ — paralel makine bir kez sayılır. */
const VARDIYA_BAS_DK = WORKDAY_END_MINUTE - 570;   // 08:00 (17:30 − 9,5 saat; 30 dk öğle arası 540'a dahil değil)

function araliklariBirlestir(l){
  const s = l.filter(a => a[1] > a[0]).sort((a, b) => a[0] - b[0]), o = [];
  s.forEach(a => { const son = o[o.length - 1]; if(son && a[0] <= son[1]) son[1] = Math.max(son[1], a[1]); else o.push([a[0], a[1]]); });
  return o;
}
function araliklarToplam(l){ return l.reduce((t, a) => t + (a[1] - a[0]), 0); }
function araliklarKesit(l, s, e){ return l.reduce((t, a) => t + Math.max(0, Math.min(a[1], e) - Math.max(a[0], s)), 0); }
function olayAraliklari(evs){ return araliklariBirlestir(evs.map(ev => [Number(ev.ts) || 0, (Number(ev.ts) || 0) + (Number(ev.sureMs) || 0)])); }

/* GRUP KAYITLARININ GERÇEK BİTİŞİ (13.10.2026 — dış inceleme H1): finishGrup her üyeye adet payına
   göre KISALTILMIŞ endTs yazıyor (kayıt başına süre toplamları doğru çıksın diye — maliyet ve
   raporlar bunu kullanır). Zaman çizelgesi hesabı (verimlilik) ise makinenin GERÇEKTE ne zaman
   boşaldığını ister: yeni kayıtlarda gercekBitisTs; eskilerde başlangıç + süre ÷ pay (pay = adet /
   grubun toplam adedi — finishGrup'un tersi). Sonradan katılan / tek tek bitirilen üye payı
   şişirmesin diye her üyenin tahmini grubun ortanca bitişiyle sınırlanır (birleşim zaten grubun
   aralığını kapsar). Eskiden verimlilik gruptan tek üyenin kısaltılmış süresini sayıyordu: 2 üyeli
   grupta gerçeğin yarısı. */
let _grupBitisOnbellek = null, _grupBitisKaynak = null;
function grupGercekBitisleri(){
  if(_grupBitisKaynak === STATE.entries && _grupBitisOnbellek) return _grupBitisOnbellek;
  const g = {}, talepBaslar = {};
  entriesArray().forEach(e => {
    if(e.groupId) (g[e.groupId] ||= []).push(e);
    const t = String(e.talepNo || '').trim(); if(t) (talepBaslar[t] ||= []).push(e);
  });
  /* Fiziksel sınır: parçanın bu makinedeki işi, AYNI talebin bir sonraki operasyonu başlamadan bitmiştir.
     Gerçek veride (13.10.2026) fason dışı 117 grubun 11'inde payla geri hesaplanan bitiş bu sınırı
     1–97 saat aşıyordu (sonradan katılan / tek tek bitirilen üyeler) — sınır bunu keser. */
  const sonrakiBaslangic = e => {
    const l = talepBaslar[String(e.talepNo || '').trim()] || [];
    let en = Infinity; l.forEach(x => { if(x.id !== e.id && x.groupId !== e.groupId && x.startTs > e.startTs && x.startTs < en) en = x.startTs; });
    return en;
  };
  const sonuc = {};
  Object.values(g).forEach(m => {
    const top = m.reduce((s, e) => s + (Number(e.adet) || 0), 0);
    const tahmin = m.filter(e => e.status === 'tamamlandi' && e.endTs && !e.gercekBitisTs).map(e => {
      const p = (typeof e.grupPayi === 'number' && e.grupPayi > 0) ? e.grupPayi : (top > 0 ? (Number(e.adet) || 0) / top : 1 / m.length);
      return { e, R: p > 0 && p < 1 ? e.startTs + (e.endTs - e.startTs) / p : e.endTs };
    });
    if(!tahmin.length) return;
    const sirali = tahmin.map(x => x.R).sort((a, b) => a - b), orta = sirali[Math.floor((sirali.length - 1) / 2)];
    tahmin.forEach(({ e, R }) => { sonuc[e.id] = Math.max(e.endTs, Math.min(R, Math.max(orta, e.endTs), sonrakiBaslangic(e))); });
  });
  _grupBitisOnbellek = sonuc; _grupBitisKaynak = STATE.entries;
  return sonuc;
}
function entryGercekBitis(e){
  if(!e.endTs) return nowTick;
  if(e.gercekBitisTs) return e.gercekBitisTs;
  if(!e.groupId || e.status !== 'tamamlandi' || !e.id) return e.endTs;
  const r = grupGercekBitisleri()[e.id];
  return r ? Math.min(r, Math.max(nowTick, e.endTs)) : e.endTs;
}

/* Kaydın [aStart, aEnd) penceresindeki NET çalışma aralıkları (duruş + Gün Sonu/Planlı Mola düşülmüş) */
function entryNetAraliklar(e, aStart, aEnd){
  const s = Math.max(e.startTs, aStart), en = Math.min(entryGercekBitis(e), aEnd);
  if(!(en > s)) return [];
  const kes = olayAraliklari(entryDurusEvents(e).concat(entryExcludedEvents(e)));
  const out = []; let cur = s;
  kes.forEach(([a, b]) => { if(b <= cur || a >= en) return; if(a > cur) out.push([cur, Math.min(a, en)]); cur = Math.max(cur, b); });
  if(cur < en) out.push([cur, en]);
  return out;
}
/* Kaydın penceredeki duruş süresi (verimlilik dışı Gün Sonu / Planlı Mola HARİÇ) */
function entryDurusPencere(e, aStart, aEnd){
  const s = Math.max(e.startTs, aStart), en = Math.min(entryGercekBitis(e), aEnd);
  if(!(en > s)) return 0;
  return araliklarKesit(olayAraliklari(entryDurusEvents(e)), s, en);
}
function haftaIciMi(dk){ const g = new Date(dk + 'T12:00:00').getDay(); return g >= 1 && g <= 5; }
/* Bir günün standart kullanılabilirliği (dk): hafta sonu 0; geçmiş hafta içi 540; bugün vardiyanın geçen kısmı */
function gunKullanilabilirDk(dk){
  if(!haftaIciMi(dk)) return 0;
  const bas = new Date(dk + 'T00:00:00').getTime() + VARDIYA_BAS_DK * 60000;
  const gecen = Math.max(0, Math.min(570 * 60000, nowTick - bas));
  return Math.round(WORKDAY_MINUTES * gecen / (570 * 60000));
}
/* Fazla mesai = vardiya (08:00–17:30) DIŞINDAKİ net çalışma + vardiya içinde 540 dk'yı aşan kısım
   (öğle arasında da çalışan makine); hafta sonu tüm net çalışma. Böylece çalışma hiçbir zaman
   kullanılabilirliği (540 + fazla mesai) aşmaz — gece kendi kendine çalışan CNC/erozyon da dahil.
   Mesai Analizi listesi (overtimeList) bu tanımdan beslenir; 17:30 öncesi kısa erken başlangıçlar
   da buraya düşer ama 1 dk altı yazılmaz. */
function gunFazlaMesaiMs(dk, araliklar){
  const toplam = araliklarToplam(araliklar);
  if(!haftaIciMi(dk)) return toplam;
  const d0 = new Date(dk + 'T00:00:00').getTime();
  const ic = araliklarKesit(araliklar, d0 + VARDIYA_BAS_DK * 60000, d0 + WORKDAY_END_MINUTE * 60000);
  return (toplam - ic) + Math.max(0, ic - gunKullanilabilirDk(dk) * 60000);
}
/* Kapatılmamış kayıt şüphesi: kaydın kesintisiz NET çalışması 20 saati aşıyor (gün sonu da duruş da
   yok). Gece kendi kendine çalışan makinelerin 12–16 saatlik normal koşuları uyarı vermez. */
const _uzunKosuOnbellek = new WeakMap();
function entryUzunKosu(e){
  if(_uzunKosuOnbellek.has(e)) return _uzunKosuOnbellek.get(e);
  const v = entryNetAraliklar(e, -Infinity, Infinity).some(([a, b]) => b - a >= 20 * 3600000);
  if(e.endTs) _uzunKosuOnbellek.set(e, v);   // açık kayıt büyüyebilir — önbelleğe alma
  return v;
}
function aralikGunleri(fromDate, toDate){
  const l = []; const d = new Date(fromDate + 'T12:00:00'), son = new Date(toDate + 'T12:00:00');
  while(d <= son){ l.push(dateKey(d.getTime())); d.setDate(d.getDate() + 1); }
  return l;
}
