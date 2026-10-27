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

/* Grup kayıtlarını ELLE yazmak yerine uygulamanın kendi finishGrup'u üretir (dış inceleme K4/H1:
   eski test tam bitiş saati veriyordu, finishGrup ise adet payına göre kısaltılmış saat yazıyor). */
function grupBitir(uyeler, bitis, eskiBicim){
  const e = {}; uyeler.forEach((x, i) => { e['g' + i] = { status: 'devam', operatorUsername: 'OP1', operatorName: 'Op Bir', talepNo: 'T' + i, groupId: 'g1', ...x }; });
  A.ata('nowTick', SIMDI);
  A.ata('STATE.entries', e);
  let yazilan = null;
  const eskiDB = A.calistir('DB'), eskiNow = Date.now;
  A.ata('DB', { ref: () => ({ update: o => { yazilan = o; return Promise.resolve(); } }) });
  A.ctx.toast = () => {}; A.ctx.render = () => {};
  A.ata('session', { username: 'OP1', displayName: 'Op Bir' });
  Date.now = () => bitis;
  try{ A.ctx.finishGrup('g1', null, null); } finally { Date.now = eskiNow; A.ata('DB', eskiDB); }
  const son = JSON.parse(JSON.stringify(e));
  Object.entries(yazilan).forEach(([yol, v]) => { const [, id, alan] = yol.split('/'); son[id][alan] = v; });
  if(eskiBicim) Object.values(son).forEach(x => { delete x.gercekBitisTs; delete x.grupPayi; });   // 13.10 öncesi kayıtlar
  A.ata('STATE.entries', son);
  return son;
}

test('grup bitirme: makine ve operatör süresi gerçek süre (H1)', () => {
  const son = grupBitir([
    { makine: 'UT04 · Torna', isEmriNo: 'UC1', adet: 10, startTs: ts('2026-10-05 08:00') },
    { makine: 'UT04 · Torna', isEmriNo: 'UC2', adet: 10, startTs: ts('2026-10-05 08:00') }
  ], ts('2026-10-05 09:40'));
  assert.equal(son.g0.endTs, ts('2026-10-05 08:50'), 'endTs adet payına göre kısaltılmış kalır (kayıt başına toplamlar)');
  const d = analiz('2026-10-05', '2026-10-05');
  assert.equal(makine(d, 'UT04').workMin, 100);   // eskiden 50
  assert.equal(op(d).workMin, 100);
});

test('grup bitirme: 13.10 öncesi kayıtlarda da gerçek süre geri hesaplanır', () => {
  grupBitir([
    { makine: 'UT04 · Torna', isEmriNo: 'UC1', adet: 30, startTs: ts('2026-10-05 08:00') },
    { makine: 'UT04 · Torna', isEmriNo: 'UC2', adet: 10, startTs: ts('2026-10-05 08:30') }
  ], ts('2026-10-05 10:00'), true);
  assert.equal(makine(analiz('2026-10-05', '2026-10-05'), 'UT04').workMin, 120);   // 08:00–10:00
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

test('maliyet: grupta süre üyelere bir kez bölünür — eski ve yeni kayıt (H1)', () => {
  maliyetKur(parametre());
  [false, true].forEach(eski => {
    const son = grupBitir([
      { makine: 'UT04 · Torna', isEmriNo: 'UC1', adet: 10, startTs: ts('2026-10-05 08:00') },
      { makine: 'UT04 · Torna', isEmriNo: 'UC2', adet: 10, startTs: ts('2026-10-05 08:00') }
    ], ts('2026-10-05 09:40'), eski);
    A.ata('_maliyetOnbellek', {});
    const m = A.ctx.maliyetHesapla(isEmri([{ id: 'g0', ...son.g0 }]), true);
    assert.ok(Math.abs(m.iscilik - 500) < 0.01, (eski ? 'eski' : 'yeni') + ' kayıt: 100 dk / 2 = 50 dk × 10 ₺ (eskiden 250)');
  });
});

test('maliyet: hepsi hurda olan işte birim maliyet yok (H4)', () => {
  maliyetKur(parametre());
  const e = { id: 'k0', makine: 'UT04 · Torna', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 09:00'), status: 'tamamlandi', isEmriNo: 'UC1',
    uygunsuzluklar: { u1: { karar: 'hurda', adet: 2 } } };
  kayitlar([e]);
  const m = A.ctx.maliyetHesapla(isEmri([e]), true);
  assert.equal(m.saglam, 0); assert.equal(m.birim, null);
});

test('maliyet: kayıt düzeltilince önbellek yenilenir (H2)', () => {
  maliyetKur(parametre());
  const e = { id: 'k0', makine: 'UT04 · Torna', startTs: ts('2026-10-05 08:00'), endTs: ts('2026-10-05 09:40'), status: 'tamamlandi', isEmriNo: 'UC1' };
  kayitlar([e]);
  const once = A.ctx.maliyetHesapla(isEmri([e]), true).iscilik;
  const e2 = { ...e, duruşToplamMs: 60 * DK, durusLog: [{ ts: ts('2026-10-05 08:10'), sureMs: 60 * DK, neden: 'Arıza' }] };
  kayitlar([e2]);   // yeni STATE.entries referansı — aynı iş emri, aynı bitiş
  const sonra = A.ctx.maliyetHesapla(isEmri([e2]), true).iscilik;
  assert.ok(Math.abs(once - 1000) < 0.01 && Math.abs(sonra - 400) < 0.01, `önce ${once}, sonra ${sonra}`);
});

test('maliyet: kur günü yerel güne göre (H8)', () => {
  const P = parametre(); P.kur = { mod: 'otomatik', usd: 0, eur: 0 };
  A.ata('maliyetKurSeri', { seri: { '2026-10-05': { usd: 40, eur: 45 }, '2026-10-06': { usd: 41, eur: 46 } } });
  const k = A.ctx.maliyetKur(ts('2026-10-06 01:30'), P);   // UTC'de hâlâ 5 Ekim
  assert.equal(k.tarih, '2026-10-06');
  A.ata('maliyetKurSeri', null);
});

test('karbür: çubuktan uzun parça seçenek dışı (H6)', () => {
  const r = A.ctx.karburPack({ boy: 156 }, [{ boy: 160 }, { boy: 50 }]);
  assert.equal(r.sigmayan, 1);
});

test('malzeme: İ.E. miktarı yoksa ekranda belli (H7)', () => {
  assert.match(A.ctx.malzemeGerekenYazi({ birim: 'mm', gerekenMiktar: 45, ieMiktar: 0 }), /İ\.E\. miktarı yok/);
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

test('açıklamadaki normal parantez kod sayılmaz: "(1000 YOGUNLUK)"', () => {
  const it = { isim: 'POLIETILEN Ø55 PLASTIK MALZEME (1000 YOGUNLUK)', canias: 'KLPHM000362' };
  assert.equal(A.ctx.stokAciklama(it), 'POLIETILEN Ø55 PLASTIK MALZEME (1000 YOGUNLUK)');
  assert.equal(A.ctx.stokCanias({ isim: 'POLIETILEN Ø55 PLASTIK MALZEME (1000 YOGUNLUK)' }), '');
});

/* ==================== TAKIM — DOLAP BAZLI STOK (13.10.2026) ==================== */
function sahteDB(depo){
  return { ref: yol => ({ transaction: fn => {
    const cur = depo[yol] === undefined ? null : JSON.parse(JSON.stringify(depo[yol]));
    const sonuc = fn(cur);
    if(sonuc === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => depo[yol] } });
    depo[yol] = sonuc; return Promise.resolve({ committed: true, snapshot: { val: () => sonuc } });
  } }) };
}
test('takım: eski tek konumlu kayıt ilk çıkışta dolaplı biçime geçer, yetmeyen dolaptan çıkış iptal', async () => {
  const depo = { 'toolStock/T1': { miktar: 6, siparisAcik: true } };
  const eskiDB = A.calistir('DB'); A.ata('DB', sahteDB(depo));
  try{
    const it = { locId: 'CNC' };
    let r = await A.ctx.toolDolapTx('T1', it, depo['toolStock/T1'], 'CNC', { delta: -2 });
    assert.ok(r.committed); assert.equal(JSON.stringify(depo['toolStock/T1'].dolaplar), JSON.stringify({ CNC: 4 })); assert.equal(depo['toolStock/T1'].miktar, 4);
    assert.equal(depo['toolStock/T1'].siparisAcik, true, 'diğer alanlar korunur');
    r = await A.ctx.toolDolapTx('T1', it, depo['toolStock/T1'], 'ATOLYE', { delta: 5 });
    assert.equal(JSON.stringify(depo['toolStock/T1'].dolaplar), JSON.stringify({ CNC: 4, ATOLYE: 5 })); assert.equal(depo['toolStock/T1'].miktar, 9);
    r = await A.ctx.toolDolapTx('T1', it, depo['toolStock/T1'], 'ATOLYE', { delta: -6 });
    assert.equal(r.committed, false, 'ATOLYE dolabında 5 var, 6 çıkamaz');
    assert.equal(depo['toolStock/T1'].miktar, 9);
  } finally { A.ata('DB', eskiDB); }
});
test('takım: dolap erişimi — kaydı olmayan herkes tüm dolapları görür', () => {
  A.ata('appSettings', { takimDolapErisim: { OP1: { CNC: true }, OP3: { _hicbiri: true } } });
  assert.equal(A.ctx.toolDolapErisebilir('OP1', 'CNC'), true);
  assert.equal(A.ctx.toolDolapErisebilir('OP1', 'ATOLYE'), false);
  assert.equal(A.ctx.toolDolapErisebilir('OP2', 'ATOLYE'), true);
  assert.equal(A.ctx.toolDolapErisebilir('OP3', 'CNC'), false);
  A.ata('appSettings', {});
});

test('takım: dolaplar arası taşıma toplamı değiştirmez, kaynakta yetmezse iptal', async () => {
  const depo = { 'toolStock/T2': { miktar: 6, dolaplar: { CNC: 4, ATOLYE: 2 } } };
  const eskiDB = A.calistir('DB'); A.ata('DB', sahteDB(depo));
  try{
    let r = await A.ctx.toolTasiTx('T2', {}, depo['toolStock/T2'], 'CNC', 'ATOLYE', 3);
    assert.ok(r.committed);
    assert.equal(JSON.stringify(depo['toolStock/T2'].dolaplar), JSON.stringify({ CNC: 1, ATOLYE: 5 }));
    assert.equal(depo['toolStock/T2'].miktar, 6);
    r = await A.ctx.toolTasiTx('T2', {}, depo['toolStock/T2'], 'CNC', 'ATOLYE', 2);
    assert.equal(r.committed, false);
  } finally { A.ata('DB', eskiDB); }
});

/* ==================== STOKSUZ ÇUBUK (15.10.2026) ==================== */
test('çubuk stoğu yoksa kalem yine seçilir; kesim yalnız tüketim olarak yazılır, stok düşülmez', () => {
  A.ata('stockItems', {
    c1: { kod: '2344', cap: 'Ø66', tur: 'boy', birim: 'mm', isim: '2344 Ø66 CELIK', canias: 'KLPHM000224' },
    c2: { kod: '2344', cap: 'Ø91', tur: 'boy', birim: 'mm', isim: '2344 Ø91 CELIK', lots: { L1: { boy: 1000 } } },
    a1: { kod: 'B25', tur: 'adet', isim: 'KAMA', miktar: 5, birim: 'adet' }
  });
  const opts = A.ctx.stockConsumableOptions();
  const c1 = opts.filter(o => o.itemId === 'c1'), c2 = opts.filter(o => o.itemId === 'c2');
  assert.equal(c1.length, 1); assert.equal(c1[0].value, 'c1'); assert.equal(c1[0].stoksuz, true);
  assert.equal(c2.length, 1); assert.equal(c2[0].value, 'c2::L1', 'kayıtlı çubuk varsa yalnız çubuklar');
  let yazilan = null;
  const eskiDB = A.calistir('DB');
  A.ata('DB', { ref: () => ({ update: o => { yazilan = o; return Promise.resolve(); } }) });
  A.ata('session', { username: 'OP1', displayName: 'Op Bir' });
  try{ A.ctx.consumeStock('c1', null, 126, { isEmriNo: 'UC1', talepNo: 'T1' }); } finally { A.ata('DB', eskiDB); }
  const yollar = Object.keys(yazilan);
  assert.ok(!yollar.some(y => /\/miktar$|\/lots\//.test(y)), 'stok yolu yazılmamalı: ' + yollar.join(', '));
  const h = yollar.filter(y => y.startsWith('stockHareketleri/')).map(y => yazilan[y])[0];
  assert.equal(h.miktar, -126); assert.equal(h.talepNo, 'T1'); assert.equal(h.stoksuz, true);
});

test('stoksuz çubuktan tüketimde onay sorulur; stoklu / adet kalemde sorulmaz', () => {
  A.ata('stockItems', {
    c1: { kod: '2344', cap: 'Ø66', tur: 'boy', birim: 'mm' },
    c2: { kod: '2344', cap: 'Ø91', tur: 'boy', birim: 'mm', lots: { L1: { boy: 1000 } } },
    a1: { kod: 'B25', tur: 'adet', miktar: 5 }
  });
  const sorular = []; const eski = A.ctx.confirm;
  A.ctx.confirm = m => { sorular.push(m); return false; };
  try{
    assert.equal(A.ctx.stoksuzTuketimOnay([{ itemId: 'c2', lotId: 'L1', miktar: 100 }, { itemId: 'a1', miktar: 2 }]), true);
    assert.equal(sorular.length, 0);
    assert.equal(A.ctx.stoksuzTuketimOnay([{ itemId: 'c1', lotId: null, miktar: 126, etiket: 'T1' }]), false);
    assert.equal(sorular.length, 1); assert.match(sorular[0], /STOKSUZ/); assert.match(sorular[0], /2344 Ø66 — 126 mm \(T1\)/);
  } finally { A.ctx.confirm = eski; }
});

/* ==================== MALZEME SİPARİŞİ — KISMİ TESLİM (15.10.2026) ==================== */
test('sipariş kısmi teslim: 8000 mm siparişin 3600\'ü gelince 4400 yolda, sipariş açık; kalanı gelince kapanır', async () => {
  const depo = { istek: { 'X_H1': { istekNo: 'X', hammaddeId: 'H1', miktar: 8000, birim: 'mm', durum: 'acik' } } };
  A.ata('malzemeIstek', depo.istek);
  A.ata('malzemeBekleyen', {});
  A.ata('stockItems', { H1: { kod: '2344', cap: 'Ø91', tur: 'boy', birim: 'mm' } });
  A.ata('session', { username: 'SEF', displayName: 'Şef', isSef: true, isAdmin: true });
  const uygula = o => { Object.entries(o).forEach(([yol, v]) => { const p = yol.split('/'); if(p[0] !== 'malzemeIstek') return;
    let n = depo.istek; for(let i = 1; i < p.length - 1; i++){ n = (n[p[i]] ||= {}); } n[p[p.length - 1]] = v; }); };
  const eskiDB = A.calistir('DB'); A.ctx.toast = () => {}; A.ctx.render = () => {}; A.ctx.canManageStock = () => true;
  A.ata('DB', { ref: () => ({ update: o => { uygula(o); return Promise.resolve(); } }) });
  try{
    await A.ctx.malzemeIstekGeldiYaz('X', 'H1', true, 3600);
    let s = A.ctx.malzemeAcikIstekler('H1')[0];
    assert.equal(s.gelen, 3600); assert.equal(s.kalan, 4400); assert.notEqual(depo.istek.X_H1.durum, 'geldi');
    await A.ctx.malzemeIstekGeldiYaz('X', 'H1', true, 4400);
    assert.equal(depo.istek.X_H1.durum, 'geldi'); assert.equal(depo.istek.X_H1.gelen, 8000);
    assert.equal(Object.keys(depo.istek.X_H1.teslimler).length, 2);
    assert.equal(A.ctx.malzemeAcikIstekler('H1').length, 0, 'tamamı gelen sipariş açık listede yok');
  } finally { A.ata('DB', eskiDB); }
});

/* ==================== FASON ISIL İŞLEM — SERTLİK ARALIĞI (15.10.2026) ==================== */
test('fason ısıl işlem: tür seçilince sertlik aralığı zorunlu, kayda yazılır', () => {
  const C = A.ctx; const mesajlar = []; let yazilan = null, bitirilen = null;
  const eskiDB = A.calistir('DB'), eskiToast = C.toast, eskiBitir = C.bitir;
  C.toast = m => mesajlar.push(m); C.bitir = id => { bitirilen = id; };
  A.ata('DB', { ref: () => ({ update: o => { yazilan = o; return Promise.resolve(); } }) });
  try{
    A.ata('fasonIsilModal', { id: 'e1', groupId: null, secili: { 'Islah': true }, sertMin: '', sertMax: '' });
    C.fasonIsilKaydet(false);
    assert.equal(yazilan, null); assert.match(mesajlar.pop(), /Sertlik aralığını yazın/);
    A.ata('fasonIsilModal', { id: 'e1', groupId: null, secili: { 'Islah': true }, sertMin: '56', sertMax: '54' });
    C.fasonIsilKaydet(false);
    assert.equal(JSON.stringify(yazilan['entries/e1/fasonIsilSertlik']), JSON.stringify({ min: 54, max: 56, birim: 'HRC' }), 'ters yazılırsa düzeltilir');
    assert.equal(bitirilen, 'e1');
    assert.equal(C.fasonIsilSertlikYazi({ min: 54, max: 56 }), '54–56 HRC');
    assert.equal(C.fasonIsilSertlikYazi({ min: 40.5, max: 40.5, birim: 'HRC' }), '40,5 HRC');
  } finally { A.ata('DB', eskiDB); C.toast = eskiToast; C.bitir = eskiBitir; }
});

/* ==================== FASON ISIL İŞLEM PAKETİ (15.10.2026) ==================== */
test('ısıl işlem paketi: kopyalanan taslak kullanıcının ERP biçiminde', () => {
  const paket = { id: 'g1', kg: 9.27, ts: ts('2026-10-09 14:00'), gonderen: 'OP14', gonderenAd: 'Şeref' };
  const ortak = { makine: 'FII01 · Fason Isıl İşlem', status: 'devam', groupId: 'g1', startTs: ts('2026-10-09 14:00'),
    fasonIsilTur: ['2344 sertleştirme'], fasonIsilSertlik: { min: 45, max: 47, birim: 'HRC' }, fasonPaket: paket };
  kayitlar([
    { ...ortak, talepNo: '2610020008', isEmriNo: 'UC1', adet: '2' },
    { ...ortak, talepNo: '2610020010', isEmriNo: 'UC2', adet: '2' },
    { ...ortak, talepNo: '2610020012', isEmriNo: 'UC3', adet: '3' },
    { ...ortak, talepNo: '2610050021', isEmriNo: 'UC4', adet: '1' },
    { makine: 'FII01 · Fason Isıl İşlem', status: 'devam', talepNo: '2609030006', isEmriNo: 'UC5', adet: '42', startTs: ts('2026-10-10 13:09'),
      fasonIsilTur: ['3343 sertleştirme'], fasonIsilSertlik: { min: 61, max: 63 }, fasonPaket: { id: 'k4', kg: 3 } }
  ]);
  A.ctx.usMamulAdi = e => ({ UC1: 'M12X35 KALIP' })[e.isEmriNo] || '';
  A.ctx.getTalepInfo = k => k === '2610020010' ? { malzemeAdi: 'B33 KONIK KVN' } : null;
  const l = A.ctx.fasonPaketleri();
  assert.equal(l.length, 2);
  const p1 = l.find(p => p.id === 'g1'), p4 = l.find(p => p.id === 'k4');
  assert.equal(p1.adet, 8);
  const metin = A.ctx.fpTaslakMetni(p1).split('\n');
  assert.equal(metin[0], '8 ADET 9,27 KG 2344 45-47 HRC');
  assert.equal(metin[1], '2610020008 M12X35 KALIP - 2 ADET');
  assert.equal(metin[2], '2610020010 B33 KONIK KVN - 2 ADET');
  assert.equal(metin.length, 5);
  assert.equal(A.ctx.fpTaslakMetni(p4).split('\n')[0], '42 ADET 3 KG 3343 61-63 HRC');
});

test('ısıl işlem paketi: iş emri başına kg kayda gider, 1 adet kg hesaplanır, önceki tartım bulunur', () => {
  kayitlar([
    { makine: 'FII01 · Fason Isıl İşlem', status: 'tamamlandi', talepNo: '2609010001', isEmriNo: 'UC9_ELMAS', adet: '4', fasonKg: 2, startTs: ts('2026-09-01 10:00') },
    { makine: 'FII01 · Fason Isıl İşlem', status: 'tamamlandi', talepNo: '2609200001', isEmriNo: 'UC9_ELMAS', adet: '2', fasonKg: 1.2, startTs: ts('2026-09-20 10:00') },
    { makine: 'FII01 · Fason Isıl İşlem', status: 'tamamlandi', talepNo: '2609200002', isEmriNo: 'UC9_ZARF', adet: '2', fasonKg: 9, startTs: ts('2026-09-25 10:00') }
  ]);
  // en son tartılan aynı kod (ZARF farklı parça, sayılmaz)
  assert.equal(A.ctx.fasonOncekiBirimKg('UC9_ELMAS'), 0.6);
  assert.equal(A.ctx.fasonOncekiBirimKg('YOK'), null);
  assert.equal(A.ctx.fasonBirimKg({ fasonKg: 4.1, adet: '2' }), 2.05);
  A.ata('session', { username: 'OPRT14', displayName: 'Şeref' });
  A.ata('fasonGonderim', { tur: ['2344 sertleştirme'], sertlik: { min: 45, max: 47, birim: 'HRC' }, kg: 5.3,
    kgler: { [A.ctx.fasonKalemAnahtar('2610020008', 'UC1')]: 4.1, [A.ctx.fasonKalemAnahtar('2610020010', 'UC2')]: 1.2 } });
  const a = A.ctx.fasonGonderimAlanlari('g1', '2610020008', 'UC1');
  assert.equal(a.fasonKg, 4.1);
  assert.equal(a.fasonPaket.kg, 5.3);
  assert.equal(a.fasonPaket.id, 'g1');
  // aynı kalemlerle tekrar başlatmada pencere tekrar açılmaz; farklı makinede bilgi temizlenir
  assert.equal(A.ctx.fasonIsilGerekli('FII01 · Fason Isıl İşlem', [{ talepNo: '2610020008', isEmriNo: 'UC1' }, { talepNo: '2610020010', isEmriNo: 'UC2' }]), false);
  assert.equal(A.ctx.fasonIsilGerekli('UT03 · Torna', [{ talepNo: '2610020008', isEmriNo: 'UC1' }]), false);
  assert.equal(A.calistir('fasonGonderim'), null);
  // kopyalanan metinde iş emri satırına kg
  A.ctx.usMamulAdi = () => '';
  const p = { adet: 2, kg: 4.1, tur: ['2344 sertleştirme'], sertlik: { min: 45, max: 47 }, uyeler: [{ talepNo: '2610020008', adet: '2', fasonKg: 4.1 }] };
  assert.equal(A.ctx.fpTaslakMetni(p).split('\n')[1], '2610020008 - 2 ADET - 4,1 KG');
});

/* 16.10.2026 hata taraması: FII01'de Kısmi Aktar — kalan kayıtta kg aynı kalıp adet azalınca "1 adet kg"
   katlanıyordu; aktarılan kısım paket bilgisini taşımıyordu. Kayıt uygulamanın kendi fonksiyonlarıyla üretilir. */
test('ısıl işlem paketi: kısmi aktar kg\'yi adede göre böler, paket bilgisi aktarılan kısma geçer', () => {
  A.ata('session', { username: 'OPRT14', displayName: 'Şeref' });
  A.ata('fasonGonderim', { tur: ['2344 sertleştirme'], sertlik: { min: 45, max: 47, birim: 'HRC' }, kg: 6,
    kgler: { [A.ctx.fasonKalemAnahtar('2610020008', 'UC1')]: 6 } });
  const e = { isEmriNo: 'UC1', talepNo: '2610020008', makine: 'FII01 · Fason Isıl İşlem', adet: '3', status: 'devam',
    operatorUsername: 'OPRT14', operatorName: 'Şeref', startTs: ts('2026-10-14 11:00'), ...A.ctx.fasonGonderimAlanlari('p1', '2610020008', 'UC1') };
  A.ata('fasonGonderim', null);
  A.ata('STATE.entries', { p1: e });
  let yazilan = null;
  const eskiDB = A.calistir('DB'), eskiGet = A.ctx.document.getElementById;
  A.ata('DB', { ref: () => ({ update: o => { yazilan = o; return { then: () => ({ catch: () => {} }) }; } }) });
  A.ctx.document.getElementById = id => id === 'kismi-aktar-adet' ? { value: '1' } : null;
  try{ A.ctx.confirmKismiAktar('p1'); } finally { A.ata('DB', eskiDB); A.ctx.document.getElementById = eskiGet; }
  assert.ok(yazilan, 'yazma yok');
  assert.ok(!Object.keys(yazilan).some(y => y.includes('undefined')));
  const cocukYol = Object.keys(yazilan).find(y => y.split('/').length === 2 && y !== 'entries/p1');
  const cocuk = yazilan[cocukYol];
  assert.equal(cocuk.adet, '1');
  assert.equal(cocuk.fasonKg, 2);
  assert.equal(yazilan['entries/p1/fasonKg'], 4);
  assert.equal(yazilan['entries/p1/adet'], '2');
  assert.equal(cocuk.fasonPaket.id, 'p1');
  assert.equal(JSON.stringify(cocuk.fasonIsilTur), '["2344 sertleştirme"]');
  // 1 adet ağırlığı iki tarafta da aynı kalır
  assert.equal(A.ctx.fasonBirimKg(cocuk), 2);
  assert.equal(A.ctx.fasonBirimKg({ fasonKg: yazilan['entries/p1/fasonKg'], adet: yazilan['entries/p1/adet'] }), 2);
});

test('karbür durum araması: kelimeler ayrı ayrı, sayı ölçüyle tam eşleşir', () => {
  const k1 = { kod: 'C15XH156X3XVA90', disCap: 15, delik: '3', kalite: 'VA90', boy: 156 };
  const k2 = { kod: 'V150X156X3XST7', disCap: 150, delik: '3', kalite: 'ST7', boy: 156 };
  const ara = q => { A.ata('karburDurumAra', q); return [k1, k2].filter(A.ctx.karburDurumEslesir).map(k => k.kod).join(','); };
  assert.equal(ara(''), 'C15XH156X3XVA90,V150X156X3XST7');
  assert.equal(ara('15 va90'), 'C15XH156X3XVA90');
  assert.equal(ara('Ø15'), 'C15XH156X3XVA90');
  assert.equal(ara('st7'), 'V150X156X3XST7');
  assert.equal(ara('156'), 'C15XH156X3XVA90,V150X156X3XST7');
  assert.equal(ara('c15xh'), 'C15XH156X3XVA90');
  assert.equal(ara('99'), '');
  A.ata('karburDurumAra', '');
});

test('karbür Ctrl+D: üstteki hücre; çapta delik + kalite de gelir; Ctrl+Shift+D satırın tamamı', () => {
  A.ctx.toast = () => {};
  const ust = { isEmri: '2610010001', disCap: '15', delik: '3', kalite: 'VA90', boy: '52', adet: '4' };
  const yeni = () => ({ isEmri: '', disCap: '12', delik: '1.5', kalite: 'ST7', boy: '', adet: '' });
  const satirlar = () => JSON.parse(A.calistir('JSON.stringify(karburRows)'));
  A.ata('karburRows', [ust, yeni()]);
  assert.equal(A.ctx.karburTusKopyala('kesim', 1, 'boy', false), true);
  assert.equal(JSON.stringify(satirlar()[1]), JSON.stringify({ isEmri: '', disCap: '12', delik: '1.5', kalite: 'ST7', boy: '52', adet: '' }));
  A.ata('karburRows', [ust, yeni()]);
  A.ctx.karburTusKopyala('kesim', 1, 'disCap', false);
  assert.equal(JSON.stringify(satirlar()[1]), JSON.stringify({ isEmri: '', disCap: '15', delik: '3', kalite: 'VA90', boy: '', adet: '' }));
  A.ata('karburRows', [ust, yeni()]);
  A.ctx.karburTusKopyala('kesim', 1, 'adet', true);
  assert.equal(JSON.stringify(satirlar()[1]), JSON.stringify(ust));
  assert.equal(A.ctx.karburTusKopyala('kesim', 0, 'boy', false), false);   // üstte satır yok
  A.ata('karburRows', []);
});

/* 19.10.2026 maliyet: entries/tadilatlar haftalık dilimlerle dinleniyor — dilimler her kaydı TAM BİR kez kapsamalı */
test('parçalı dinleme: haftalık dilimler boşluksuz ve çakışmasız', () => {
  const simdi = ts('2026-10-19 11:00');
  const s = A.ctx.parcaSinirlari(simdi);
  assert.equal(new Date(s[0]).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long' }), 'Pazartesi');
  assert.ok(s[s.length - 1] <= simdi && simdi - s[s.length - 1] < 7 * 864e5, 'son dilim bu hafta başlamalı');
  // firebase sorgularının anlamı: [ -∞ , s0-1 ], [ s_i , s_{i+1}-1 ], [ s_n , +∞ )
  const dilimler = [[-Infinity, s[0] - 1]].concat(s.map((b, i) => [b, i + 1 < s.length ? s[i + 1] - 1 : Infinity]));
  const ornekler = [0, s[0] - 1, s[0], s[1] - 1, s[1], ts('2026-08-14 10:00'), ts('2026-10-12 00:00'), ts('2026-10-18 23:59'), simdi, simdi + 30 * 864e5];
  ornekler.forEach(v => assert.equal(dilimler.filter(([a, b]) => v >= a && v <= b).length, 1, 'değer ' + v));
});

/* 27.10.2026 maliyet: eski haftalar tarayıcıda — saklanan bölge ile canlı sorgu (startAt(canliBas)) tam tümleyen olmalı */
test('önbellek: saklanan / canlı bölge ayrımı ve değişiklik uygulama', () => {
  const canliBas = ts('2026-10-19 00:00');
  // RTDB: startAt(sayı) sayıları ≥ ve bütün metin/nesneleri alır; null/boolean/küçük sayılar saklanan bölgede kalır
  [[canliBas, true], [canliBas - 1, false], [ts('2026-08-01 10:00'), false], [null, false], [undefined, false], [true, false], ['2026', true], [{ a: 1 }, true]]
    .forEach(([v, beklenen]) => assert.equal(A.ctx.obCanliMi(v, canliBas), beklenen, 'değer ' + JSON.stringify(v)));
  const kayit = { veri: { a: { startTs: ts('2026-09-01 08:00'), adet: '1' }, b: { startTs: ts('2026-09-02 08:00') } } };
  A.ctx.obUygula(kayit, 'a', { startTs: ts('2026-09-01 08:00'), adet: '2' }, 'startTs', canliBas);   // eski kayıt düzeltildi
  A.ctx.obUygula(kayit, 'b', null, 'startTs', canliBas);                                            // silindi
  A.ctx.obUygula(kayit, 'c', { startTs: ts('2026-09-05 08:00') }, 'startTs', canliBas);             // tarihi geriye çekildi → saklanan bölgeye girdi
  A.ctx.obUygula(kayit, 'a2', { startTs: canliBas + 1 }, 'startTs', canliBas);                      // canlı bölgeye geçti → saklanmaz
  assert.deepEqual(Object.keys(kayit.veri).sort(), ['a', 'c']);
  assert.equal(kayit.veri.a.adet, '2');
});

/* 19.10.2026: İş Yoğunluğu yer düzeltme — sahte operasyon yerine son kaydın bırakılan yeri değişir */
test('yer düzeltme: son kaydın yeri değişir, FKK seçilince rota kapanır, not düşülür', () => {
  const fkk = A.ctx.allMachines().find(m => m.code === 'FKK'), diger = A.ctx.allMachines().find(m => m.code !== 'FKK');
  assert.ok(fkk && diger, 'makine listesi');
  kayitlar([
    { makine: diger.code + ' · ' + diger.name, status: 'tamamlandi', talepNo: '2610020008', isEmriNo: 'UC1', adet: '4', startTs: ts('2026-10-17 09:00'), endTs: ts('2026-10-17 10:00'), sonOperasyon: false, sonrakiMakine: 'Belirsiz' }
  ]);
  let yazilan = null;
  const eskiDB = A.calistir('DB');
  A.ata('DB', { ref: () => ({ update: o => { yazilan = o; return Promise.resolve(); }, push: () => ({ key: 'k1' }) }) });
  A.ata('session', { username: 'SEF1', displayName: 'Şef Bir', isSef: true });
  A.ctx.render = () => {}; A.ctx.toast = () => {};
  try{
    A.ctx.ydKayitAc('UC1');
    A.calistir("ydModal.secim = 'FKK'");
    A.ctx.ydKaydet();
  } finally { A.ata('DB', eskiDB); }
  const id = Object.keys(JSON.parse(A.calistir('JSON.stringify(STATE.entries)')))[0];
  assert.equal(yazilan['entries/' + id + '/sonrakiMakine'], 'FKK · ' + fkk.name);
  assert.equal(yazilan['entries/' + id + '/sonOperasyon'], true);
  const not = yazilan['entries/' + id + '/yerDuzeltme/k1'];
  assert.equal(not.eskiYer, 'Belirsiz'); assert.equal(not.kim, 'SEF1');
  assert.ok(!Object.keys(yazilan).some(y => y.includes('undefined')));
});

test('sıraya koy: kaydı olmayan iş emri kuyrukta, ilk kayıt açılınca düşer', () => {
  const sira = { '2610050001_TEK': { talepNo: '2610050001', isEmriNo: 'UC9', adet: '3', makine: 'TES01 · Testere', ts: ts('2026-10-18 08:00'), kim: 'SEF1' } };
  A.ata('isEmriSira', sira); A.ata('_isEmriSiraDinleniyor', true);
  kayitlar([]);
  let k = A.ctx.isEmriSiraKuyrukKayitlari();
  assert.equal(k.length, 1); assert.equal(k[0].sonrakiMakine, 'TES01 · Testere'); assert.equal(k[0]._sira, true);
  kayitlar([{ makine: 'TES01 · Testere', status: 'devam', talepNo: '2610050001', isEmriNo: 'UC9', adet: '3', startTs: ts('2026-10-19 08:00') }]);
  assert.equal(A.ctx.isEmriSiraKuyrukKayitlari().length, 0);
  A.ata('isEmriSira', {}); A.ata('_isEmriSiraDinleniyor', false);
});

/* 19.10.2026 (kullanıcı): "+ Sıraya koy" bir yerde bekleyen işi ikinci bir yere sokabiliyordu — tek pencere durumu bulur */
test('yer düzelt penceresi: bekleyen iş → değiştir, sıradaki → değiştir, hiç kaydı yok → sıraya koy, işlenen → işlem yok', () => {
  A.ata('session', { username: 'SEF1', displayName: 'Şef Bir', isSef: true });
  A.ctx.render = () => {}; A.ctx.toast = () => {};
  A.ata('_isEmriSiraDinleniyor', true);
  A.ata('isEmriSira', { 'T3_TEK': { talepNo: 'T3', isEmriNo: 'T3', makine: 'TES01 · Testere', ts: ts('2026-10-18 08:00') } });
  kayitlar([
    { makine: 'C01 · CNC Torna', status: 'tamamlandi', talepNo: 'T1', isEmriNo: 'T1', adet: '4', startTs: ts('2026-10-17 09:00'), endTs: ts('2026-10-17 10:00'), sonrakiMakine: 'UF01 · Freze' },
    { makine: 'C01 · CNC Torna', status: 'devam', talepNo: 'T2', isEmriNo: 'T2', adet: '2', startTs: ts('2026-10-19 09:00') }
  ]);
  const durum = t => { A.ctx.ydBulAc(t); return JSON.parse(A.calistir('JSON.stringify({ tip: ydModal.tip, eski: ydModal.eskiYer })')); };
  assert.equal(JSON.stringify(durum('T1')), JSON.stringify({ tip: 'kayit', eski: 'UF01 · Freze' }));
  assert.equal(durum('T2').tip, null);                       // şu an işleniyor
  assert.equal(JSON.stringify(durum('T3')), JSON.stringify({ tip: 'sira', eski: 'TES01 · Testere' }));
  assert.equal(durum('T4').tip, 'yeni');                     // hiç kaydı yok
  A.ata('ydModal', null); A.ata('isEmriSira', {}); A.ata('_isEmriSiraDinleniyor', false);
});

/* 19.10.2026: FKK başlamadan önce aynı iş emrinin diğer operasyon notlarını görmeli */
test('önceki notlar: aynı talep no (dallar dahil), kendi kaydı ve boş notlar hariç, zaman sırasıyla', () => {
  kayitlar([
    { makine: 'TES01 · Testere', status: 'tamamlandi', talepNo: '2610010001', isEmriNo: 'UC5_ZARF', startTs: ts('2026-10-14 08:00'), not: 'Malzeme çapı küçük geldi' },
    { makine: 'C01 · CNC Torna', status: 'tamamlandi', talepNo: '2610010001', isEmriNo: 'UC5', startTs: ts('2026-10-15 08:00'), not: '  ' },
    { makine: 'UF01 · Freze', status: 'tamamlandi', talepNo: '2610010001', isEmriNo: 'UC5', startTs: ts('2026-10-16 08:00'), not: 'Takım kırıldı, yüzeyde iz var' },
    { makine: 'C01 · CNC Torna', status: 'tamamlandi', talepNo: '2610019999', isEmriNo: 'UC5', startTs: ts('2026-10-16 09:00'), not: 'başka iş emri' },
    { makine: 'FKK · Final Kalite Kontrol', status: 'devam', talepNo: '2610010001', isEmriNo: 'UC5', startTs: ts('2026-10-17 08:00'), not: 'kendi notu' }
  ]);
  const fkk = A.ctx.entriesArray().find(e => e.makine.startsWith('FKK'));
  const l = A.ctx.oncekiNotlar(fkk, fkk.id).map(e => e.not);
  assert.equal(JSON.stringify(l), JSON.stringify(['Malzeme çapı küçük geldi', 'Takım kırıldı, yüzeyde iz var']));
  assert.ok(A.ctx.oncekiNotlarHtml(fkk, fkk.id).includes('Takım kırıldı'));
  assert.equal(A.ctx.oncekiNotlarHtml({ talepNo: '2610030000', isEmriNo: 'X' }, null), '');
});

/* 19.10.2026: stok tabloları — gruplama ve renk durumu */
test('stok tablosu: kalite / ölçü ayrıştırma ve stok durumu', () => {
  const adet = { kod: '1040 LAMA 30X85X400', tur: 'adet', miktar: -2 };
  const cubuk = { kod: '2344', cap: 'Ø80', tur: 'boy', lots: {} };
  const parmak = { kod: 'B13', isim: '12X12X56 BB — B13 DAYAMALAR', tur: 'adet', miktar: 120 };
  assert.equal(A.ctx.hamKalite(adet), '1040'); assert.equal(A.ctx.hamOlcu(adet), 'LAMA 30X85X400');
  assert.equal(A.ctx.hamKalite(cubuk), '2344'); assert.equal(A.ctx.hamOlcu(cubuk), 'Ø80');
  assert.equal(A.ctx.hamDurum(adet), 'eksi'); assert.equal(A.ctx.hamDurum(cubuk), 'tutulmuyor'); assert.equal(A.ctx.hamDurum(parmak), 'ok');
  assert.equal(A.ctx.hamDurum({ kod: 'X', tur: 'adet', miktar: 2, altLimit: 3 }), 'kritik');
  A.ata('toolStock', { a: { miktar: 0 }, b: { miktar: 1 }, c: { miktar: 9 } });
  assert.equal(A.ctx.takimDurum({ id: 'a', altLimit: 10 }), 'yok');
  assert.equal(A.ctx.takimDurum({ id: 'b', altLimit: 1 }), 'kritik');
  assert.equal(A.ctx.takimDurum({ id: 'c', altLimit: 1 }), 'ok');
  A.ata('toolStock', {});
});

/* 21.10.2026 (Şeref KOLDAŞ): kg başlatma formunda adetle birlikte girilir — gönderim penceresinde dolu gelir */
test('fason ısıl gönderim: formda yazılan iş emri kg\'si pencerede dolu, yazılmayan boş', () => {
  A.ctx.render = () => {};
  A.ata('appSettings', { isilIslemTurleri: ['2344 sertleştirme'] });
  kayitlar([]);
  A.ctx.fasonIsilGonderimAc([{ talepNo: 'T1', isEmriNo: 'UC1', adet: '2', kg: '4,1' }, { talepNo: 'T2', isEmriNo: 'UC2', adet: '3', kg: '' }]);
  const k = JSON.parse(A.calistir('JSON.stringify(fasonIsilModal.kalemler.map(x => ({ kg: x.kg, oneri: x.oneri })))'));
  assert.equal(JSON.stringify(k), JSON.stringify([{ kg: '4,1', oneri: false }, { kg: '', oneri: false }]));
  A.ata('fasonIsilModal', null); A.ata('appSettings', {});
});

/* 26.10.2026 HATA: aynı U kodlu iki iş emri — arama/geçmiş/kuyruk U koduna göre karışıyordu */
test('aynı U kodlu iki iş emri: kuyrukta ikisi de, arama iş emri / U kodu ayrımı, geçmiş yalnız o iş emri', () => {
  kayitlar([
    { makine: 'UT01 · Torna', status: 'tamamlandi', talepNo: '2609080005', isEmriNo: 'UC13040009', adet: '5', startTs: ts('2026-10-01 08:00'), endTs: ts('2026-10-01 10:00'), sonrakiMakine: 'PT01 · Pres' },
    { makine: 'ODT03 · Taşlama', status: 'tamamlandi', talepNo: '2609100004', isEmriNo: 'UC13040009', adet: '5', startTs: ts('2026-10-10 08:00'), endTs: ts('2026-10-10 10:00'), sonrakiMakine: 'UT01 · Torna' },
    { makine: 'P01 · Pres', status: 'tamamlandi', talepNo: '2609100004', isEmriNo: 'UC13040009', adet: '5', startTs: ts('2026-09-26 08:00'), endTs: ts('2026-09-26 08:10'), sonrakiMakine: 'F02 · Fırın' }
  ]);
  const kuyruk = A.ctx.bekleyenSonrakiOperasyonlar().map(e => e.talepNo + '→' + e.sonrakiMakine.split(' · ')[0]).sort();
  assert.equal(JSON.stringify(kuyruk), JSON.stringify(['2609080005→PT01', '2609100004→UT01']));
  assert.equal(JSON.stringify(A.ctx.iyAramaSonuclari('2609080005').map(g => g.talepNo)), JSON.stringify(['2609080005']));
  assert.equal(A.ctx.iyAramaSonuclari('UC13040009').length, 2);
  assert.equal(A.ctx.iyGecmisIcinKayitlar('UC13040009', '2609080005').length, 1);
  assert.equal(A.ctx.iyGecmisIcinKayitlar('UC13040009', '2609100004').length, 2);
});
