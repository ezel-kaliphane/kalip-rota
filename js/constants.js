/* ===================== SABİT VERİLER ===================== */
const MACHINE_LIST = [
  { code:"UF01", name:"Freze" }, { code:"SM01", name:"Sütun Matkap" },
  { code:"TE01", name:"Tel Erezyon Sodick" }, { code:"TE02", name:"Tel Erezyon Sammlite" },
  { code:"TES01", name:"Testere" }, { code:"DDTE01", name:"Delik Delme Tel Erozyon" },
  { code:"KM01", name:"Kumlama Makinası" }, { code:"PT01", name:"Parlatma Tezgahı" },
  { code:"PT02", name:"Parlatma Tezgahı" }, { code:"KCM01", name:"Kılavuz Makinesi" },
  { code:"ODT01", name:"Silindirik Taşlama" }, { code:"ODT02", name:"Silindirik Taşlama" },
  { code:"ODT03", name:"Silindirik Taşlama" }, { code:"P01", name:"Pres" },
  { code:"DE01", name:"Dalma Erezyon" }, { code:"DE02", name:"Dalma Erezyon" },
  { code:"DE03", name:"Dalma Erezyon" }, { code:"F01", name:"Fırın" }, { code:"F02", name:"Fırın" },
  { code:"C02", name:"CNC Dik İşleme Merkezi" }, { code:"C01", name:"CNC Torna" },
  { code:"UST01", name:"Satıh Taşlama" }, { code:"UST02", name:"Satıh Taşlama" },
  { code:"UT01", name:"Torna" }, { code:"UT02", name:"Torna" }, { code:"UT03", name:"Torna" },
  { code:"FII01", name:"Fason Isıl İşlem" }, { code:"SAL01", name:"Şaloma" },
];
const machineLabelFor = c => { const m = MACHINE_LIST.find(x=>x.code===c); return m ? `${m.code} · ${m.name}` : ""; };
const ALL_MACHINE_CODES = MACHINE_LIST.map(m=>m.code);

// NOT: Buradaki eski sabit operatör/şifre listesi kaldırıldı — Firebase'e bir kere
// yazıldıktan sonra kaynak kodda durmasının hiçbir faydası yoktu, sadece herkesin
// "Sayfa Kaynağını Görüntüle" ile şifreleri (ADMIN dahil) okuyabilmesine yol açıyordu.
// Yeni operatörler artık Ayarlar → "+ Kullanıcı Ekle" panelinden eklenir.

const DEFAULT_DURUS_REASONS = ["Arıza / Bakım","Malzeme Bekleniyor","Kalıp/Takım Değişimi","Program/Ayar Değişimi","Kalite Kontrol Bekleniyor","Elektrik/Basınçlı Hava Kesintisi","Operatör Molası","Farklı İş Emrine Geçiş","Tuvalet"];
const GUN_SONU_REASON = "Gün Sonu (Mesai Bitti, yarın devam edilecek)";
const TADILAT_REASON = "Tadilat";
const TADILAT_SONRASI_REASON = "Tadilat Sonrası Ayar";
function getDurusReasons(){
  const custom = (STATE.durusReasons && STATE.durusReasons.length>0) ? STATE.durusReasons : DEFAULT_DURUS_REASONS;
  const hasTadilat = custom.some(r=>isTadilatReason(r));
  return [...custom, ...(hasTadilat?[]:[TADILAT_REASON]), GUN_SONU_REASON, "Diğer"];
}
// Admin'in Duruş Nedenleri listesine "Tadilat", "Tadilat Duruşu" gibi kendi yazdığı bir metin
// eklemiş olması ihtimaline karşı esnek (bulanık) eşleştirme — birebir "Tadilat" yazmasına gerek yok.
function isTadilatReason(r){
  if(!r) return false;
  const s = String(r).toLowerCase();
  return s.includes('tadilat') && r!==TADILAT_SONRASI_REASON;
}
// Stil amaçlı: hem "Tadilat" hem "Tadilat Sonrası Ayar" için (ikisi de tadilatla ilgili duruş).
function isTadilatRelated(r){ return !!r && String(r).toLowerCase().includes('tadilat'); }
function effectiveDurusMs(e){
  let d = e.duruşToplamMs||0;
  if(e.status==='duruş' && e.duruşTs && e.duruşNedeni!==GUN_SONU_REASON) d += Math.max(0, nowTick - e.duruşTs);
  return d;
}
function effectiveExcludedMs(e){
  let d = e.excludedMs||0;
  if(e.status==='duruş' && e.duruşTs && e.duruşNedeni===GUN_SONU_REASON) d += Math.max(0, nowTick - e.duruşTs);
  return d;
}
function effectiveDurusReason(e){
  // Duraklatılmış bir işin en son nedeni Gün Sonu olabilir ama duruşToplamMs'de daha
  // önceki (Gün Sonu'ndan önceki) GERÇEK bir duruştan kalma süre birikmiş olabilir.
  // Bu durum sadece "şu an duraklı" iken değil, iş sonradan devam edip bitse bile
  // kalıcı olarak veride kalıyor — o yüzden statüden bağımsız olarak düzeltiyoruz.
  if(e.duruşNedeni===GUN_SONU_REASON && (e.duruşToplamMs||0)>0) return 'Belirtilmemiş (önceki duraklama)';
  return e.duruşNedeni || 'Belirtilmemiş';
}
// H DÜZELTMESİ — Duruş Olay Listesi: Eskiden bir kaydın duruş bilgisi TEK bir kümülatif sayı
// (duruşToplamMs) + TEK bir "son neden" (duruşNedeni) olarak tutuluyordu. Bir iş birden fazla
// kez farklı nedenlerle duraklarsa, eski nedenin KENDİSİ ve SÜRESİ kalıcı olarak kayboluyordu.
// Artık HER duruş periyodu, bittiği anda ayrı bir olay olarak durusLog dizisine ekleniyor —
// {ts, neden, sureMs}. Eski (bu alan eklenmeden önce oluşmuş) kayıtlarda durusLog olmayabilir,
// okuyan taraflar bu durumda eski (tek-neden) davranışa otomatik geri düşüyor.
function appendDurusLog(currentLog, neden, sureMs, ts){
  if(!sureMs || sureMs<=0) return currentLog || null;
  const log = Array.isArray(currentLog) ? currentLog.slice() : [];
  log.push({ ts: ts||Date.now(), neden: neden||'Belirtilmemiş', sureMs: Math.round(sureMs) });
  return log;
}
// Bir duruş/Gün Sonu OLAYININ KENDİSİ de gece yarısını aşabilir (ör. dün 17:30'da başlayıp
// bugün 08:00'de biten bir Gün Sonu bekleyişi, 14.5 saat, iki günü kapsıyor). Gün bazlı bölme
// yaparken bu olayı SADECE başladığı güne yazmak, bir kademe daha aynı hatayı tekrarlıyordu —
// bu yüzden olayın [ts, ts+sureMs] aralığıyla ilgili günün [segStart, segEnd] aralığının
// KESİŞEN kısmını hesaplıyoruz, olayın tamamını değil.
function msOverlap(evTs, evSureMs, segStart, segEnd){
  const evStart = evTs, evEnd = evTs + evSureMs;
  const overlapStart = Math.max(evStart, segStart);
  const overlapEnd = Math.min(evEnd, segEnd);
  return Math.max(0, overlapEnd - overlapStart);
}
function entryDurusEvents(e){
  const events = [];
  if(Array.isArray(e.durusLog) && e.durusLog.length>0){
    e.durusLog.forEach(ev => events.push({ neden: ev.neden||'Belirtilmemiş', sureMs: ev.sureMs, ts: ev.ts }));
  } else if((e.duruşToplamMs||0) > 0){
    events.push({ neden: effectiveDurusReason(e), sureMs: e.duruşToplamMs, ts: e.startTs });
  }
  if(e.status==='duruş' && e.duruşTs && e.duruşNedeni!==GUN_SONU_REASON){
    const liveExtra = Math.max(0, nowTick - e.duruşTs);
    if(liveExtra>0) events.push({ neden: e.duruşNedeni||'Belirtilmemiş', sureMs: liveExtra, ts: e.duruşTs, live:true });
  }
  return events;
}
// GÜN SONU süreleri için entryDurusEvents'in eşdeğeri — ayrı tutuyoruz çünkü Gün Sonu bir
// "duruş nedeni" olarak RAPORLANMIYOR (Duruş Analizi'nde görünmemesi bilinçli bir tasarım),
// ama gün-bazlı bölme sırasında (Günlere Göre Özet, Gantt) HANGİ GÜNE ait olduğunu bilmemiz
// lazım — yoksa bu süre bazen çalışma gibi sayılıp şişiriyor, bazen yanlış günden düşülüp
// o günü sıfırlıyordu. Eski (excludedLog eklenmeden önceki) kayıtlar için, tek bir zaman
// damgası bilinemediğinden, kalan cumulative excludedMs'i kaydın BAŞLANGICINA atfediyoruz —
// tam isabetli olmayabilir ama en azından "çalışma" olarak sayılmasını önlüyor.
function entryExcludedEvents(e){
  const events = [];
  if(Array.isArray(e.excludedLog) && e.excludedLog.length>0){
    e.excludedLog.forEach(ev => events.push({ neden: ev.neden||GUN_SONU_REASON, sureMs: ev.sureMs, ts: ev.ts }));
  } else if((e.excludedMs||0) > 0){
    events.push({ neden: GUN_SONU_REASON, sureMs: e.excludedMs, ts: e.startTs });
  }
  if(e.status==='duruş' && e.duruşTs && e.duruşNedeni===GUN_SONU_REASON){
    const liveExtra = Math.max(0, nowTick - e.duruşTs);
    if(liveExtra>0) events.push({ neden: GUN_SONU_REASON, sureMs: liveExtra, ts: e.duruşTs, live:true });
  }
  return events;
}
function collectDurusEvents(entries){
  const seen = new Set();
  const out = [];
  entries.forEach(e=>{
    entryDurusEvents(e).forEach(ev=>{
      const key = e.groupId ? `${e.groupId}|${ev.ts}|${ev.sureMs}|${ev.neden}` : `${e.id||e.startTs}|${ev.ts}|${ev.sureMs}`;
      if(seen.has(key)) return;
      seen.add(key);
      out.push({ ...ev, entry: e });
    });
  });
  return out;
}

