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
