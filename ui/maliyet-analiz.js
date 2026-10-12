/* ==================== MALİYET ANALİZİ (08.10.2026, kullanıcı isteği) ====================
   Sol menüde "Maliyet" — yalnız adminler (canSeeMaliyet). Tamamlanan iş emirlerinin gerçekleşen
   maliyeti (js/maliyet.js maliyetHesapla) dönem bazında. Sunum kullanıcının rapor tercihine göre:
   bölüm cümleyle açılır, üç ana kutu, aylık tablo, sayı bir kez, ayrıntılar açılır. */

let maliyetAnalizDonem = 'buyil';   // buay | 3ay | buyil | tumu
let maliyetAnalizTumKod = false;
let maliyetKontrolAy = null;   // kapanış öncesi kontrol listesi açık olan ay (YYYY-MM)
/* KAPANIŞ ÖNCESİ KONTROL (12.10.2026): ayı kapatmadan o ayın eksikleri tek yerde — hammaddesiz
   işler (buradan hammadde girilir), fiyatı olmayan çelik/karbür türleri, ücreti girilmemiş gruplar. */
function maliyetAyKontrol(ay){
  const liste = bomRotaListesi().filter(x => mlAyAnahtar(x.finishedAt) === ay);
  const hammaddesiz = [], neden = {};
  liste.forEach(x => {
    const m = maliyetHesapla(x, true); if(!m) return;
    m.eksik.forEach(e => {
      const k = e.replace(/:.*$/, ''), d = (e.match(/:\s*(.*)$/) || [])[1] || '';
      if(/hammadde kaydı yok|Operatör girişinden ağırlık/.test(e)){ if(!hammaddesiz.includes(x)) hammaddesiz.push(x); return; }
      const o = (neden[k] = neden[k] || { n:0, detay:new Set() }); o.n++; if(d) o.detay.add(d);
    });
  });
  return { n: liste.length, hammaddesiz, neden };
}
function maliyetKontrolHtml(ay){
  const k = maliyetAyKontrol(ay);
  const ilkOp = x => (x.zarf.length ? x.zarf : x.ana)[0] || x.ana[0] || x.zarf[0];
  const sebepler = Object.entries(k.neden).sort((a, b) => b[1].n - a[1].n);
  if(!k.hammaddesiz.length && !sebepler.length) return `<div class="set-card" style="border-color:var(--success)">✓ ${mlAyAdi(ay)}: ${k.n} iş emrinin hepsinde maliyet tam — kapatmaya hazır.</div>`;
  return `<div class="set-card" style="border-color:var(--warn)">
    <div class="set-sec" style="margin:0 0 8px">Kapanış öncesi kontrol — ${mlAyAdi(ay)}</div>
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">${k.n} iş emri. Aşağıdakiler düzeltilmeden kapatılırsa o hâliyle sabitlenir.</div>
    ${k.hammaddesiz.length ? `<div style="font-weight:600;margin:6px 0">Hammadde kaydı yok · ${k.hammaddesiz.length} iş emri <span style="font-weight:400;color:var(--text-muted);font-size:12px">— çelik maliyeti 0 sayılıyor</span></div>
      <div class="table-wrap" style="max-height:260px;overflow-y:auto"><table class="rt-tablo"><tbody>
      ${k.hammaddesiz.map(x => { const e = ilkOp(x); return `<tr class="rt-tablo-sabit"><td class="mono">${esc(x.talep || '—')}</td><td class="mono">${esc(x.uKodu)}</td><td class="rt-silik rt-kes">${esc(x.mamulAdi || '')}</td><td class="r">${x.adet || ''} adet</td>
        <td style="text-align:right">${e && canManageStock() ? `<button class="btn-ghost" style="width:auto;padding:2px 9px;font-size:11px" onclick="hmGirAc('${escJs(e.id)}')">Hammadde gir</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : ''}
    ${sebepler.length ? `<div style="font-weight:600;margin:12px 0 6px">Diğer eksikler</div>
      ${sebepler.map(([ad, o]) => `<div style="font-size:12.5px;margin-bottom:4px">• ${esc(ad)} — ${o.n} iş emri${o.detay.size ? ': <span class="mono">' + [...o.detay].slice(0, 8).map(esc).join(', ') + (o.detay.size > 8 ? ' …' : '') + '</span>' : ''}</div>`).join('')}
      ${canEditMaliyet() ? `<button class="btn-ghost" style="width:auto;padding:4px 10px;margin-top:6px" onclick="settingsSubTab='maliyet'; setView('adminSettings')">Ayarlar → Maliyet Parametreleri</button>` : ''}` : ''}
  </div>`;
}
function setMaliyetAnalizDonem(d){ maliyetAnalizDonem = d; render(); }

function mlDonemBas(d){
  const n = new Date();
  if(d === 'buay') return new Date(n.getFullYear(), n.getMonth(), 1).getTime();
  if(d === '3ay') return new Date(n.getFullYear(), n.getMonth() - 2, 1).getTime();
  if(d === 'buyil') return new Date(n.getFullYear(), 0, 1).getTime();
  return 0;
}
const ML_AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const ML_KALEMLER = [
  ['iscilik','İşçilik'], ['elektrik','Elektrik'], ['amort','Amortisman'], ['sarf','Sarf'], ['genelGider','Genel gider'],
  ['celik','Çelik'], ['karbur','Karbür'], ['isil','Isıl işlem (fason)']
];
function mlKalemTutar(m, k){ return k === 'celik' ? m.celik.tutar : k === 'karbur' ? m.karbur.tutar : k === 'isil' ? m.isil.tutar : (m[k] || 0); }

/* Analiz → Maliyet sekmesinin içeriği (08.10.2026: sol menüden Analiz'in içine taşındı) */
function renderMaliyetAnaliziIcerik(){
  if(!canSeeMaliyet()) return `<div class="set-card">Bu bölüm yalnız adminler için.</div>`;
  maliyetYukle(); bomRotaYukle(false);
  const d = maliyetDurum;
  const kutu = ic => `<div class="set-card" style="max-width:560px">${ic}</div>`;
  if(!d.okundu || !bomRotaVeri.stok || !bomRotaVeri.karbur) return kutu('<div style="color:var(--text-muted)">Okunuyor…</div>');
  if(d.hata) return kutu(`Okunamadı: ${esc(mlHataMetni({ message:d.hata }))}`);
  if(!d.blob) return kutu(`Maliyet henüz kurulmadı. ${canEditMaliyet() ? '<button class="btn-ghost" style="width:auto;padding:4px 10px" onclick="settingsSubTab=\'maliyet\'; setView(\'adminSettings\')">Ayarlar → Maliyet Parametreleri</button>' : 'SuperAdmin kurmalı.'}`);
  if(!maliyetAcik()) return kutu(`<div class="set-sec" style="margin:0 0 8px">Maliyet şifresi</div><div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">Bu cihazda bir kez girilir.</div>
    <div style="display:flex;gap:8px"><input id="ml-sifre-ac" type="password" autocomplete="current-password" placeholder="Şifre" onkeydown="if(event.key==='Enter') mlKilitAcTikla()"><button class="btn-primary" style="width:auto;padding:8px 16px" onclick="mlKilitAcTikla()">Aç</button></div>`);

  const bas = mlDonemBas(maliyetAnalizDonem);
  const kayit = bomRotaListesi().filter(x => x.finishedAt >= bas).map(x => ({ x, m: maliyetHesapla(x) })).filter(r => r.m);
  const donemAd = { buay:'Bu ay', '3ay':'Son 3 ayda', buyil:'Bu yıl', tumu:'Kayıtlı dönemde' }[maliyetAnalizDonem];
  const cip = (k, et) => `<button class="chip ${maliyetAnalizDonem === k ? 'active' : ''}" onclick="setMaliyetAnalizDonem('${k}')">${et}</button>`;
  let h = `<div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center">${cip('buay','Bu ay')}${cip('3ay','Son 3 ay')}${cip('buyil','Bu yıl')}${cip('tumu','Tümü')}
      <span style="flex:1"></span>${onMaliyet ? '' : `<button class="btn-ghost" style="width:auto;padding:5px 12px;font-size:12px" onclick="onMaliyet={kod:'',ad:'',adet:''}; render()">Ön maliyet hesapla</button>`}${mlParaSecici()}</div>
    ${renderOnMaliyetHtml()}`;
  if(!kayit.length) return h + `<div class="set-card">${donemAd} tamamlanan iş emri yok.</div></div>`;

  // Toplamlar — her para biriminde ayrı (iş emri kendi kuruyla çevrilir), sayılar/oranlar TL'den
  const topla = c => {
    const T = { toplam:0, adet:0, saglam:0, hurdaPayi:0, rework:0 }; ML_KALEMLER.forEach(([k]) => { T[k] = 0; });
    const grup = {}, ay = {}, kod = {};
    kayit.forEach(({ x, m: m0 }) => {
      const m = mlCevir(m0, c);
      T.toplam += m.toplam; T.adet += m.adet; T.saglam += (m.saglam || m.adet); T.hurdaPayi += m.hurdaPayi || 0;
      ML_KALEMLER.forEach(([k]) => { T[k] += mlKalemTutar(m, k); });
      m.ops.forEach(o => {
        if(o.duzeltme) T.rework += o.iscilik + o.elektrik + o.amort;
        if(!o.grup) return;
        const g = (grup[o.grup] = grup[o.grup] || { dk:0, tutar:0 });
        g.dk += o.dk; g.tutar += o.iscilik + o.elektrik + o.amort;
      });
      const a = new Date(x.finishedAt), ak = a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0');
      const A = (ay[ak] = ay[ak] || { ad: ML_AYLAR[a.getMonth()] + ' ' + a.getFullYear(), n:0, toplam:0, iscilik:0, malzeme:0 });
      A.n++; A.toplam += m.toplam; A.iscilik += m.iscilik; A.malzeme += m.celik.tutar + m.karbur.tutar;
      const K = (kod[x.uKodu] = kod[x.uKodu] || { kod:x.uKodu, ad:x.mamulAdi, n:0, toplam:0, adet:0, birimler:[] });
      K.n++; K.toplam += m.toplam; K.adet += (m.saglam || m.adet); if(m.birim != null) K.birimler.push(m.birim);
    });
    return { T, grup, ay, kod };
  };
  const R = { TRY: topla('TRY'), EUR: topla('EUR'), USD: topla('USD') };
  const U = (fn, ic) => mlUc({ TRY: fn(R.TRY), EUR: fn(R.EUR), USD: fn(R.USD) }, ic);   // para gösterimi (ic: cümle içinde yan yana)
  const { T, grup, ay, kod } = R.TRY;
  const eksikNeden = {}; let eksikli = 0;
  kayit.forEach(({ m }) => { if(m.eksik.length){ eksikli++; m.eksik.forEach(e => { const k = e.replace(/:.*$/, ''); eksikNeden[k] = (eksikNeden[k] || 0) + 1; }); } });
  const kalemler = ML_KALEMLER.map(([k, ad]) => ({ k, ad, t:T[k] })).filter(r => r.t > 0).sort((a, b) => b.t - a.t);
  const pay = v => T.toplam ? v / T.toplam * 100 : 0;
  const kalite = T.hurdaPayi + T.rework;

  // Özet
  h += agBolumBas('ml-ozet', 'Özet', donemAd.toLocaleLowerCase('tr') + ' · ' + kayit.length + ' iş emri');
  h += agYorum([
    `${donemAd} <b>${kayit.length}</b> iş emri tamamlandı; toplam maliyet <b>${U(r => r.T.toplam, 1)}</b>.`,
    kalemler.length ? `En büyük kalem ${kalemler[0].ad.toLocaleLowerCase('tr')}, payı %${Math.round(pay(kalemler[0].t))}${kalemler[1] ? `; ardından ${kalemler[1].ad.toLocaleLowerCase('tr')} (%${Math.round(pay(kalemler[1].t))})` : ''}${kalemler[2] ? ` ve ${kalemler[2].ad.toLocaleLowerCase('tr')} (%${Math.round(pay(kalemler[2].t))})` : ''} geliyor.` : '',
    kalite > 0 ? `Kalitesizliğin bedeli ${U(r => r.T.hurdaPayi + r.T.rework, 1)}: hurdaya giden parçalar ${U(r => r.T.hurdaPayi, 1)}, düzeltme (rework) işleri ${U(r => r.T.rework, 1)}.` : 'Bu dönemde hurda ya da düzeltme işi maliyeti yok.',
    eksikli ? `<span style="color:var(--warn)">${eksikli} iş emrinde eksik ya da tahmini kalem var (çoğunlukla hammadde kaydı) — bu iş emirlerinde maliyet olduğundan düşük çıkabilir; ayrıntı en altta.</span>` : ''
  ]);
  h += `<div class="rt-kpiler ag-kpi-buyuk">
    ${rtKpi('Toplam maliyet', U(r => r.T.toplam), '', T.saglam ? 'sağlam parça başı ' + U(r => r.T.toplam / r.T.saglam, 1) : '')}
    ${rtKpi('İş emri başına', U(r => r.T.toplam / kayit.length), '', kayit.length + ' iş emri ortalaması')}
    ${rtKpi('Kalitesizlik maliyeti', U(r => r.T.hurdaPayi + r.T.rework), '', 'hurda + düzeltme · toplamın içinde, payı %' + mlFmt(pay(kalite), 1))}
  </div>`;

  // Kalemler
  h += agBolumBas('ml-kalem', 'Maliyet kalemleri', 'toplam içindeki payları');
  h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>Kalem</th><th class="r">Tutar</th><th class="r">Pay</th></tr></thead><tbody>
    ${kalemler.map(k => `<tr class="rt-tablo-sabit"><td>${k.ad}</td><td class="r mono">${U(r => r.T[k.k])}</td><td class="r"><span class="ag-oran" style="--p:${pay(k.t).toFixed(1)}%"></span><span class="mono">%${mlFmt(pay(k.t), 1)}</span></td></tr>`).join('')}
  </tbody></table></div>`;

  // Aylık
  const aylar = Object.keys(ay).sort();
  if(aylar.length > 1){
    const buAy = new Date(); const buAyK = buAy.getFullYear() + '-' + String(buAy.getMonth() + 1).padStart(2, '0');
    const tekPara = maliyetParaModu === 'HEPSI' ? 'TRY' : maliyetParaModu;
    h += agBolumBas('ml-ay', 'Aylık', 'devam eden ay önceki ayla kıyaslanmaz');
    h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>Ay</th><th class="r">İş emri</th><th class="r">Toplam</th><th class="r">İş emri başına</th><th class="r">İşçilik</th><th class="r">Malzeme</th><th>Önceki aya göre (iş emri başına)</th></tr></thead><tbody>
      ${aylar.map((k, i) => {
        const A = ay[k], onc = i > 0 ? aylar[i - 1] : null;
        let fark = '';
        if(k === buAyK) fark = '<span class="rt-silik">devam ediyor</span>';
        else if(onc){ const Ac = R[tekPara].ay[k], Oc = R[tekPara].ay[onc], o = Ac.toplam / Ac.n, oo = Oc.toplam / Oc.n, f = o - oo, y = oo ? Math.abs(f / oo * 100) : 0;
          fark = Math.abs(f) < (tekPara === 'TRY' ? 1 : 0.05) ? 'değişmedi' : `${f > 0 ? '+' : '−'}${mlParaYaz(Math.abs(f), tekPara)} <small>(%${Math.round(y)} ${f > 0 ? 'artış' : 'azalış'})</small>`; }
        return `<tr class="rt-tablo-sabit"><td>${A.ad}${maliyetAyKapali(k) ? ' <span title="Kapalı ay — rakamlar sabit">🔒</span>' : ''}</td><td class="r mono">${A.n}</td><td class="r mono">${U(r => r.ay[k].toplam)}</td><td class="r mono">${U(r => r.ay[k].toplam / r.ay[k].n)}</td><td class="r mono">${U(r => r.ay[k].iscilik)}</td><td class="r mono">${U(r => r.ay[k].malzeme)}</td><td>${fark}</td></tr>`;
      }).join('')}
    </tbody></table></div>`;
  }

  // Makine grupları
  const gl = Object.entries(grup).map(([ad, g]) => ({ ad, ...g })).sort((a, b) => b.tutar - a.tutar);
  if(gl.length){
    const gt = gl.reduce((s, g) => s + g.tutar, 0);
    h += agBolumBas('ml-grup', 'Makine grupları', 'işçilik + elektrik + amortisman');
    h += agYorum([`Makine zamanının en pahalı kısmı ${esc(gl[0].ad.toLocaleLowerCase('tr'))}: ${agSaat(gl[0].dk)}, payı %${Math.round(gl[0].tutar / gt * 100)}.`]);
    h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>Grup</th><th class="r">Süre</th><th class="r">Tutar</th><th class="r">Pay</th></tr></thead><tbody>
      ${gl.map(g => `<tr class="rt-tablo-sabit"><td>${esc(g.ad)}</td><td class="r mono">${agSaat(g.dk)}</td><td class="r mono">${U(r => r.grup[g.ad].tutar)}</td><td class="r"><span class="ag-oran" style="--p:${(g.tutar / gt * 100).toFixed(1)}%"></span><span class="mono">%${mlFmt(g.tutar / gt * 100, 1)}</span></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  // CANIAS kodu bazında
  const kl = Object.values(kod).sort((a, b) => b.toplam - a.toplam);
  const tekrar = kl.filter(k => k.n > 1).length;
  h += agBolumBas('ml-kod', 'CANIAS kodu bazında', 'adet başı maliyet — teklif için');
  h += agYorum([`${kl.length} farklı CANIAS kodu üretildi${tekrar ? `; ${tekrar} tanesi bu dönemde birden fazla kez — onlarda en düşük ile en yüksek adet başı maliyet yan yana` : ''}.`]);
  const kGoster = maliyetAnalizTumKod ? kl : kl.slice(0, 15);
  h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>CANIAS kodu</th><th class="rt-dar-gizle">Mamul</th><th class="r">İş emri</th><th class="r">Adet</th><th class="r">Toplam</th><th class="r">Adet başı</th><th class="r">En düşük – en yüksek</th></tr></thead><tbody>
    ${kGoster.map(k => `<tr class="rt-tablo-sabit"><td class="mono">${esc(k.kod)}</td><td class="rt-silik rt-kes rt-dar-gizle">${esc(k.ad || '')}</td><td class="r mono">${k.n}</td><td class="r mono">${rtFmt(k.adet)}</td><td class="r mono">${U(r => r.kod[k.kod].toplam)}</td>
        <td class="r mono">${k.adet ? U(r => r.kod[k.kod].toplam / r.kod[k.kod].adet) : '—'}</td><td class="r mono">${k.n > 1 && k.birimler.length > 1 ? U(r => Math.min(...r.kod[k.kod].birimler)) + ' – ' + U(r => Math.max(...r.kod[k.kod].birimler)) : '<span class="rt-silik">—</span>'}</td></tr>`).join('')}
  </tbody></table></div>
  ${kl.length > 15 ? `<button type="button" class="ag-detay-dugme" onclick="maliyetAnalizTumKod=!maliyetAnalizTumKod; render()">${ico(maliyetAnalizTumKod ? 'chevronUp' : 'chevronDown', 14)} ${maliyetAnalizTumKod ? 'İlk 15\'i göster' : 'Tümünü göster (' + kl.length + ')'}</button>` : ''}`;

  // En pahalı iş emirleri
  const pahali = kayit.slice().sort((a, b) => b.m.toplam - a.m.toplam).slice(0, 10);
  h += agBolumBas('ml-pahali', 'En yüksek maliyetli iş emirleri', 'Döküm ile kalem kalem');
  h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>İş emri</th><th>CANIAS kodu</th><th class="rt-dar-gizle">Mamul</th><th class="r">Adet</th><th class="r">Toplam</th><th class="r">Adet başı</th><th></th></tr></thead><tbody>
    ${pahali.map(({ x, m }) => `<tr class="rt-tablo-sabit"><td class="mono">${esc(x.talep || '—')}</td><td class="mono">${esc(x.uKodu)}</td><td class="rt-silik rt-kes rt-dar-gizle">${esc(x.mamulAdi || '')}</td><td class="r mono">${m.adet}${m.hurda ? ` <span style="color:var(--warn)" title="hurda">(${m.hurda} h)</span>` : ''}</td>
      <td class="r mono">${mlP(m.toplam, m.kur)}${m.eksik.length ? ` <span style="color:var(--warn)" title="${esc(m.eksik.join('\n'))}">⚠</span>` : ''}</td><td class="r mono">${m.birim != null ? mlP(m.birim, m.kur) : '—'}</td>
      <td><button class="btn-ghost" style="width:auto;padding:2px 9px;font-size:11px" onclick="maliyetDokumAc('${escJs(x.talep || x.uKodu)}')">Döküm</button></td></tr>`).join('')}
  </tbody></table></div>`;

  // Olağandışı maliyetler (12.10.2026): veri hatası şüphesi — aynı kodda adet başı uçurum, uzun açık kalmış operasyon
  {
    const supheli = [];
    /* Aynı kodda adet başı uçurum — yalnız ADETİ BENZER işler arasında (1 adet ile 10 adetin adet başı
       zaten farklıdır, ayar süresi adede bölünür): adet oranı < 2 iken adet başı ≥ 3 kat. */
    const kodIs = {}; kayit.forEach(r => { if(r.m.birim != null && r.m.birim > 0) (kodIs[r.x.uKodu] = kodIs[r.x.uKodu] || []).push(r); });
    Object.values(kodIs).filter(l => l.length > 1).forEach(l => {
      l.forEach((a, i) => l.slice(i + 1).forEach(c => {
        const ad = Math.max(a.m.adet, c.m.adet) / Math.max(1, Math.min(a.m.adet, c.m.adet));
        const bk = Math.max(a.m.birim, c.m.birim) / Math.min(a.m.birim, c.m.birim);
        if(ad < 2 && bk >= 3) [a, c].forEach(r => { if(!supheli.some(s => s.r === r)) supheli.push({ r, neden: `Aynı CANIAS kodu, benzer adet (${a.m.adet} / ${c.m.adet}) ama adet başı ${Math.round(bk)} kat farklı (${mlTL(Math.min(a.m.birim, c.m.birim))} – ${mlTL(Math.max(a.m.birim, c.m.birim))}) — yanlış adet ya da yarım kayıt olabilir` }); });
      }));
    });
    /* Uzun operasyon: grubun TİPİK süresine göre — dalma erozyonda 9 saat olağan (ortanca ~560 dk),
       taşlamada değil. Eşik = en az 10 saat ve grubun ortanca operasyonunun 5 katı. */
    const gSure = {}; kayit.forEach(r => r.m.ops.forEach(o => { if(o.grup) (gSure[o.grup] = gSure[o.grup] || []).push(o.dk); }));
    const esik = {}; Object.entries(gSure).forEach(([g, l]) => { l.sort((a, b) => a - b); esik[g] = Math.max(600, 5 * l[Math.floor(l.length / 2)]); });
    kayit.forEach(r => {
      const uzun = r.m.ops.filter(o => o.grup && o.dk > esik[o.grup]);
      if(uzun.length) supheli.push({ r, neden: uzun.map(o => `${o.kod} ${agSaat(o.dk)} net (bu grupta tipik ${agSaat(esik[o.grup] / 5)})`).join(', ') + ' — operasyon kapatılmamış olabilir, süre şişkin' });
    });
    if(supheli.length){
      h += agBolumBas('ml-supheli', 'Kontrol edilmesi gerekenler', 'olağandışı maliyet — veri hatası şüphesi');
      h += agYorum([`${new Set(supheli.map(s => s.r.x.talep || s.r.x.uKodu)).size} iş emrinin maliyeti olağandışı görünüyor. Bunlar çoğunlukla kayıt hatasıdır (yanlış adet, kapatılmamış operasyon); düzeltilirse maliyet de düzelir. Ay kapatılmadan bakılması önerilir.`]);
      h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>İş emri</th><th>CANIAS kodu</th><th class="r">Adet başı</th><th>Neden</th><th></th></tr></thead><tbody>
        ${supheli.slice(0, 30).map(({ r, neden }) => `<tr class="rt-tablo-sabit"><td class="mono">${esc(r.x.talep || '—')}</td><td class="mono">${esc(r.x.uKodu)}</td><td class="r mono">${r.m.birim != null ? mlP(r.m.birim, r.m.kur) : '—'}</td>
          <td style="font-size:12px">${esc(neden)}</td><td><button class="btn-ghost" style="width:auto;padding:2px 9px;font-size:11px" onclick="maliyetDokumAc('${escJs(r.x.talep || r.x.uKodu)}')">Döküm</button></td></tr>`).join('')}
      </tbody></table></div>${supheli.length > 30 ? `<div class="rt-silik" style="font-size:12px;margin-top:4px">+${supheli.length - 30} satır daha</div>` : ''}`;
    }
  }

  // Aylık kapanış
  {
    const tumAy = {}; bomRotaListesi().forEach(x => { const a = mlAyAnahtar(x.finishedAt); tumAy[a] = (tumAy[a] || 0) + 1; });
    Object.keys(maliyetKapanis.meta || {}).forEach(a => { if(!(a in tumAy)) tumAy[a] = 0; });
    const buAyK = mlAyAnahtar(Date.now());
    const aylarK = Object.keys(tumAy).sort().reverse();
    h += agBolumBas('ml-kapanis', 'Aylık kapanış', 'kapalı ayın rakamları sabittir');
    h += agYorum(['Biten bir ay kapatılınca o ayın her iş emrinin maliyeti o günkü hâliyle sabitlenir; sonradan değişen ücret, fiyat, kur, kural ya da kayıt düzeltmesi kapalı ayı etkilemez. Hata bulunursa ay yeniden açılıp düzeltilir ve tekrar kapatılır.']);
    h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>Ay</th><th class="r">İş emri</th><th>Durum</th><th>Son işlem</th><th></th></tr></thead><tbody>
      ${aylarK.map(a => { const m = maliyetKapanis.meta[a] || {}, kapali = m.durum === 'kapali', son = (m.gecmis || []).slice(-1)[0];
        const durum = kapali ? `<span style="color:var(--success)">🔒 Kapalı</span>${maliyetKapanis.veri[a] ? '' : ' <span style="color:var(--warn)" title="Bu cihazda açılamadı">(okunamadı)</span>'}` : a >= buAyK ? '<span class="rt-silik">devam ediyor</span>' : (m.durum === 'acik' ? '<span style="color:var(--warn)">Yeniden açıldı</span>' : 'Açık');
        const kontrol = !kapali && a < buAyK && tumAy[a] ? `<button class="btn-ghost" style="width:auto;padding:2px 10px;font-size:11px" onclick="maliyetKontrolAy = maliyetKontrolAy==='${a}' ? null : '${a}'; render()">${maliyetKontrolAy === a ? 'Kontrolü gizle' : 'Kontrol et'}</button> ` : '';
        const dugme = kontrol + (!canEditMaliyet() || a >= buAyK ? '' : kapali
          ? `<button class="btn-ghost" style="width:auto;padding:2px 10px;font-size:11px" onclick="maliyetAyAc('${a}')">Yeniden aç</button>`
          : `<button class="btn-primary" style="width:auto;padding:3px 12px;font-size:11.5px" onclick="maliyetAyKapat('${a}')">Kapat</button>`);
        return `<tr class="rt-tablo-sabit"><td>${mlAyAdi(a)}</td><td class="r mono">${kapali && m.n != null ? m.n : tumAy[a]}</td><td>${durum}</td>
          <td class="rt-silik">${son ? (son.tip === 'kapat' ? 'kapatıldı' : 'açıldı') + ' · ' + fmtDT(son.ts) + ' · ' + esc(son.byName || son.by || '') : '—'}</td><td style="text-align:right;white-space:nowrap">${dugme}</td></tr>`; }).join('')}
    </tbody></table></div>
    ${maliyetKontrolAy ? maliyetKontrolHtml(maliyetKontrolAy) : ''}`;
  }

  // Eksik veri
  const en = Object.entries(eksikNeden).sort((a, b) => b[1] - a[1]);
  if(en.length){
    h += agBolumBas('ml-eksik', 'Eksik veri', 'maliyetin eksik kaldığı yerler');
    h += agYorum([`${eksikli} iş emrinde en az bir eksik var. En sık sebep "${esc(en[0][0])}" (${en[0][1]} iş emri). Hammadde stok çıkışı, ilk operasyonda hammadde seçilerek ya da BOM + Rota'da standart tanımlanarak tamamlanır; fiyatı olmayan türler Ayarlar → Maliyet Parametreleri'nden eklenir.`]);
    h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>Sebep</th><th class="r">İş emri</th></tr></thead><tbody>
      ${en.slice(0, 12).map(([k, n]) => `<tr class="rt-tablo-sabit"><td>${esc(k)}</td><td class="r mono">${n}</td></tr>`).join('')}</tbody></table></div>`;
  }
  return h + `</div>` + renderMaliyetDokum() + (typeof renderHmGirModal === 'function' ? renderHmGirModal() : '');
}
