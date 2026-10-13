/* Hesap testleri (13.10.2026) — çalıştırma:  node --test tests/
   Bu oturumda canlıda bulunan hesap hatalarının (verimlilik, malzeme ihtiyacı, reçete) tekrar
   etmemesi için: her test gerçek bir hatanın ya da bir kullanıcı kararının küçük örneğidir.
   Tarihler: 2026-10-05 Pazartesi … 2026-10-11 Pazar. Vardiya 08:00–17:30, 540 dk. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { uygulamaYukle, ts, DK, SA } = require('./_uygulama.cjs');

const A = uygulamaYukle();
const SIMDI = ts('2026-11-01 12:00');     // tüm test günleri geçmişte kalsın (bugün kısmi hesabı devreye girmesin)
function kayitlar(liste){
  const e = {}; liste.forEach((x, i) => { e['k' + i] = { status: 'tamamlandi', operatorUsername: 'OP1', operatorName: 'Op Bir', isEmriNo: 'UC1', talepNo: 'T1', ...x }; });
  A.ata('nowTick', SIMDI);
  A.ata('STATE.entries', e);
}
const analiz = (bas, son) => A.ctx.computeAnalizData(bas, son, 'tumu');
const op = (d, u = 'OP1') => d.perOperator.find(o => o.operatorUsername === u);
const makine = (d, kod) => d.perMachine.find(m => m.code === kod);

/* ==================== VERİMLİLİK ==================== */
test('geç gelen, duruşa hiç basmayan operatör %100 çıkmaz (M. Kurt hatası)', () => {
  kayitlar([{ makine: 'UT04 · Torna', startTs: ts('2026-10-05 10:00'), endTs: ts('2026-10-05 17:30') }]);
  const o = op(analiz('2026-10-05', '2026-10-05'));
  assert.equal(o.workMin, 450);
  assert.equal(o.availMin, 540);
  assert.equal(o.verimlilik, 83);   // eski formül çalışma/(çalışma+duruş) = %100 veriyordu
});

test('iki güne yayılan iş (Gün Sonu ile) her güne kendi payı kadar yazılır', () => {
  const gs = ts('2026-10-05 17:30'), sure = 14.5 * SA;
  kayitlar([{ makine: 'UT04 · Torna', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-06 17:30'),
    excludedMs: sure, excludedLog: [{ ts: gs, sureMs: sure, neden: A.ctx.GUN_SONU_REASON }] }]);
  const o = op(analiz('2026-10-05', '2026-10-06'));
  const pzt = o.days.find(d => d.tarih === '2026-10-05'), sal = o.days.find(d => d.tarih === '2026-10-06');
  assert.equal(pzt.workMin, 570); assert.equal(sal.workMin, 570);   // eskiden hepsi Pazartesi'ye yığılıyordu
  assert.equal(o.verimlilik, 100);
});

test('kapatılmayan kayıt başladığı güne yığılmaz, uzun koşu uyarısı verir', () => {
  kayitlar([{ makine: 'UT04 · Torna', startTs: ts('2026-10-09 08:00'), endTs: ts('2026-10-12 09:00') }]);   // Cuma → Pazartesi
  const d = analiz('2026-10-09', '2026-10-12');
  const o = op(d);
  assert.equal(o.days.find(x => x.tarih === '2026-10-09').workMin, 960);   // eskiden Cuma'ya ~3800 dk
  assert.equal(o.days.find(x => x.tarih === '2026-10-12').workMin, 540);
  assert.ok(makine(d, 'UT04').hasPhysicalAnomaly, 'uzun koşu işaretlenmeli');
  assert.ok(o.verimlilik <= 100);
});

test('aynı anda iki makine: operatör süresi bir kez, paralel ayrı', () => {
  kayitlar([
    { makine: 'UT04 · Torna', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 17:30') },
    { makine: 'UT05 · Torna', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 17:30') }
  ]);
  const d = analiz('2026-10-05', '2026-10-05'), o = op(d);
  assert.equal(o.workMin, 570);       // eskiden 1140
  assert.equal(o.paralelMin, 570);
  assert.equal(makine(d, 'UT04').workMin, 570);
  assert.equal(makine(d, 'UT05').workMin, 570);
});

test('duruş kendi saatiyle düşülür', () => {
  kayitlar([{ makine: 'UT04 · Torna', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 17:30'),
    duruşToplamMs: 60 * DK, durusLog: [{ ts: ts('2026-10-05 10:00'), sureMs: 60 * DK, neden: 'Arıza' }] }]);
  const o = op(analiz('2026-10-05', '2026-10-05'));
  assert.equal(o.workMin, 510);
  assert.equal(o.durusMin, 60);
  assert.equal(o.verimlilik, 94);
});

test('makine paydası yalnız hafta içi günler (Cumartesi-Pazar hariç)', () => {
  kayitlar([{ makine: 'UT04 · Torna', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 16:30') }]);
  const m = makine(analiz('2026-10-05', '2026-10-11'), 'UT04');
  assert.equal(m.availMin, 5 * 540);   // eskiden 7 × 540
  assert.equal(m.verimlilik, 19);
});

test('gece de çalışan makine %100\'ü aşmaz (vardiya dışı = fazla mesai)', () => {
  kayitlar([{ makine: 'C02 · CNC', startTs: ts('2026-10-05 00:00'), endTs: ts('2026-10-06 00:00') }]);
  const m = makine(analiz('2026-10-05', '2026-10-05'), 'C02');
  assert.equal(m.workMin, 1440);
  assert.equal(m.overtimeMin, 900);    // 870 vardiya dışı + 30 öğle arası (540 aşımı)
  assert.equal(m.verimlilikRaw, 100);
});

test('çoklu iş emri grubu makinede bir kez sayılır', () => {
  kayitlar([
    { makine: 'UT04 · Torna', groupId: 'g1', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 12:00') },
    { makine: 'UT04 · Torna', groupId: 'g1', isEmriNo: 'UC2', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 12:00') }
  ]);
  assert.equal(makine(analiz('2026-10-05', '2026-10-05'), 'UT04').workMin, 240);
});

test('hafta sonu çalışması fazla mesai', () => {
  kayitlar([{ makine: 'UT04 · Torna', startTs: ts('2026-10-10 09:00'), endTs: ts('2026-10-10 12:00') }]);   // Cumartesi
  const g = op(analiz('2026-10-10', '2026-10-10')).days[0];
  assert.equal(g.haftaIci, false);
  assert.equal(g.overtimeMin, 180);
  assert.equal(g.availMin, 180);
});

/* ==================== MALZEME BEKLEYEN ==================== */
test('çubukta ihtiyaç = parça boyu × İ.E. + testere payı (2344 Ø66 hatası)', () => {
  const ih = A.ctx.malzemeIhtiyac;
  assert.equal(ih({ birim: 'mm', gerekenMiktar: 60, ieMiktar: 2 }), 126);   // eskiden 66
  assert.equal(ih({ birim: 'mm', gerekenMiktar: 45, ieMiktar: 0 }), 48);    // miktar bilinmiyorsa 1
  assert.equal(ih({ birim: 'adet', gerekenMiktar: 12, ieMiktar: 3 }), 12);  // adet kalemde toplamdır, pay yok
  assert.equal(A.ctx.malzemeGerekenYazi({ birim: 'mm', gerekenMiktar: 60, ieMiktar: 2 }), '60 mm × 2 = 120 mm');
});

test('rezerve yalnız aynı hammaddenin AKTİF kayıtları; taslak toplamı istek no\'suzlardan', () => {
  A.ata('malzemeBekleyen', {
    a: { hammaddeId: 'H1', birim: 'mm', gerekenMiktar: 60, ieMiktar: 2, durum: 'bekliyor', talepNo: '2609180021', mamulAdi: 'M12X35 KALIP', isaretTs: 1 },
    b: { hammaddeId: 'H1', birim: 'mm', gerekenMiktar: 65, ieMiktar: 3, durum: 'bekliyor', talepNo: '2609180020', mamulAdi: 'M12x40 KALIP', isaretTs: 2, caniasIstekNo: '26090535' },
    c: { hammaddeId: 'H1', birim: 'mm', gerekenMiktar: 50, ieMiktar: 3, durum: 'karsilandi', talepNo: 'X', isaretTs: 3 },
    d: { hammaddeId: 'H2', birim: 'mm', gerekenMiktar: 99, ieMiktar: 1, durum: 'bekliyor', talepNo: 'Y', isaretTs: 4 }
  });
  assert.equal(A.ctx.malzemeRezerve('H1'), 126 + 204);
  assert.equal(A.ctx.mbTaslakMetni('H1'), '2609180021 M12X35 KALIP\nTOPLAM GEREKLİ: 126 MM');
});

/* ==================== MALİYET ==================== */
function maliyetKur(P){
  A.ata('maliyetDurum.veri', { surumler: [{ ts: 0, p: A.ctx.maliyetVarsayilan() }, { ts: 1, p: P }] });
  A.ata('_maliyetOnbellek', {});
}
function parametre(){
  const P = A.ctx.maliyetVarsayilan();
  P.kur = { mod: 'elle', usd: 40, eur: 45 };
  P.gruplar.find(g => g.key === 'torna').dk = 10;
  P.celik = [{ tur: '2344', fiyat: 5, para: 'EUR', yogunluk: 7.85, isil: '' }];
  P.isil = [{ tur: 'Islah', fiyat: 20, para: 'TRY' }];
  return P;
}
const isEmri = (ana, ek) => ({ talep: 'T1', uKodu: 'UC1', finishedAt: ts('2026-10-05 12:00'), ana, zarf: [], elmas: [], dalli: false, adet: 2,
  hmRaw: { kaynak: 'stok', kalemler: [{ kod: '2344 Ø66', birim: 'mm', cap: 'Ø66', miktar: 126 }] }, karburRaw: [], ...ek });
const kg126 = Math.PI * 33 * 33 * 126 * 7.85 / 1e6;

test('maliyet: boş parametre sürümü atlanır, işçilik + çelik + birim doğru', () => {
  maliyetKur(parametre());
  const e = { id: 'k0', makine: 'UT04 · Torna', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 09:40'), status: 'tamamlandi', isEmriNo: 'UC1' };
  kayitlar([e]);
  const m = A.ctx.maliyetHesapla(isEmri([e]), true);
  assert.ok(Math.abs(m.iscilik - 1000) < 0.01, 'işçilik 100 dk × 10 ₺');
  assert.ok(Math.abs(m.celik.kg - kg126) < 1e-9);
  assert.ok(Math.abs(m.celik.tutar - kg126 * 5 * 45) < 1e-6);
  assert.ok(Math.abs(m.birim - m.toplam / 2) < 1e-9);
});

test('maliyet: fason ısıl işlemde seçilen tür kg × fiyat', () => {
  maliyetKur(parametre());
  const t = { id: 'k0', makine: 'UT04 · Torna', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 09:00'), status: 'tamamlandi', isEmriNo: 'UC1' };
  const f = { id: 'k1', makine: 'FII01 · Fason Isıl İşlem', startTs: ts('2026-10-05 09:00'), endTs: ts('2026-10-05 10:00'), status: 'tamamlandi', isEmriNo: 'UC1', fasonIsilTur: ['Islah'] };
  kayitlar([t, f]);
  const m = A.ctx.maliyetHesapla(isEmri([t, f]), true);
  assert.ok(Math.abs(m.isil.tutar - kg126 * 20) < 1e-6);
});

test('maliyet: çoklu iş emri grubunda süre üyelere bölünür', () => {
  maliyetKur(parametre());
  const a = { id: 'k0', makine: 'UT04 · Torna', groupId: 'g1', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 09:40'), status: 'tamamlandi', isEmriNo: 'UC1' };
  const b = { id: 'k1', makine: 'UT04 · Torna', groupId: 'g1', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 09:40'), status: 'tamamlandi', isEmriNo: 'UC2' };
  kayitlar([a, b]);
  const m = A.ctx.maliyetHesapla(isEmri([a]), true);
  assert.ok(Math.abs(m.iscilik - 500) < 0.01, '100 dk iki iş emrine bölünür');
});

/* ==================== CANİAS KODU AYRI ALANDA (13.10.2026) ==================== */
test('CANİAS kodu: yeni alan ve eski "(KLPHM…)" açıklama ikisi de okunur', () => {
  const C = A.ctx;
  assert.equal(C.stokCanias({ isim: '12X12X61 BB — B25 PARMAK (KLPHM000378)' }), 'KLPHM000378');
  assert.equal(C.stokAciklama({ isim: '12X12X61 BB — B25 PARMAK (KLPHM000378)' }), '12X12X61 BB — B25 PARMAK');
  assert.equal(C.stokCanias({ isim: '12X12X61 BB — B25 PARMAK', canias: 'klphm000378' }), 'KLPHM000378');
  assert.equal(C.stokAciklama({ isim: '12X12X61 BB — B25 PARMAK', canias: 'KLPHM000378' }), '12X12X61 BB — B25 PARMAK');
});

test('QR okutma hem taşınmış hem eski kalemi bulur', () => {
  A.ata('stockItems', {
    yeni: { kod: 'B25', tur: 'adet', isim: '12X12X61 BB', canias: 'KLPHM000378', miktar: 5, birim: 'adet' },
    eski: { kod: 'B31', tur: 'adet', isim: '12X14X61 BB (KLPHM000422)', miktar: 3, birim: 'adet' }
  });
  assert.equal(A.ctx.stockOptionByScanCode('KLPHM000378').option.itemId, 'yeni');
  assert.equal(A.ctx.stockOptionByScanCode('klphm000422').option.itemId, 'eski');
});
