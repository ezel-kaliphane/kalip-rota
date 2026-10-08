/* ==================== MALİYET ANALİZİ (08.10.2026, kullanıcı isteği) ====================
   Sol menüde "Maliyet" — yalnız adminler (canSeeMaliyet). Tamamlanan iş emirlerinin gerçekleşen
   maliyeti (js/maliyet.js maliyetHesapla) dönem bazında. Sunum kullanıcının rapor tercihine göre:
   bölüm cümleyle açılır, üç ana kutu, aylık tablo, sayı bir kez, ayrıntılar açılır. */

let maliyetAnalizDonem = 'buyil';   // buay | 3ay | buyil | tumu
let maliyetAnalizTumKod = false;
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

function renderMaliyetAnalizi(){
  if(!canSeeMaliyet()) return `<div class="analiz-wrap"><div class="set-card">Bu ekran yalnız adminler için.</div></div>`;
  maliyetYukle(); bomRotaYukle(false);
  const d = maliyetDurum;
  const kutu = ic => `<div class="analiz-wrap"><div class="set-card" style="max-width:560px">${ic}</div></div>`;
  if(!d.okundu || !bomRotaVeri.stok || !bomRotaVeri.karbur) return kutu('<div style="color:var(--text-muted)">Okunuyor…</div>');
  if(d.hata) return kutu(`Okunamadı: ${esc(mlHataMetni({ message:d.hata }))}`);
  if(!d.blob) return kutu(`Maliyet henüz kurulmadı. ${canEditMaliyet() ? '<button class="btn-ghost" style="width:auto;padding:4px 10px" onclick="settingsSubTab=\'maliyet\'; setView(\'adminSettings\')">Ayarlar → Maliyet Parametreleri</button>' : 'SuperAdmin kurmalı.'}`);
  if(!maliyetAcik()) return kutu(`<div class="set-sec" style="margin:0 0 8px">Maliyet şifresi</div><div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">Bu cihazda bir kez girilir.</div>
    <div style="display:flex;gap:8px"><input id="ml-sifre-ac" type="password" autocomplete="current-password" placeholder="Şifre" onkeydown="if(event.key==='Enter') mlKilitAcTikla()"><button class="btn-primary" style="width:auto;padding:8px 16px" onclick="mlKilitAcTikla()">Aç</button></div>`);

  const bas = mlDonemBas(maliyetAnalizDonem);
  const kayit = bomRotaListesi().filter(x => x.finishedAt >= bas).map(x => ({ x, m: maliyetHesapla(x) })).filter(r => r.m);
  const donemAd = { buay:'Bu ay', '3ay':'Son 3 ayda', buyil:'Bu yıl', tumu:'Kayıtlı dönemde' }[maliyetAnalizDonem];
  const cip = (k, et) => `<button class="chip ${maliyetAnalizDonem === k ? 'active' : ''}" onclick="setMaliyetAnalizDonem('${k}')">${et}</button>`;
  let h = `<div class="analiz-wrap">
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${cip('buay','Bu ay')}${cip('3ay','Son 3 ay')}${cip('buyil','Bu yıl')}${cip('tumu','Tümü')}</div>`;
  if(!kayit.length) return h + `<div class="set-card">${donemAd} tamamlanan iş emri yok.</div></div>`;

  // Toplamlar
  const T = { toplam:0, adet:0, saglam:0, hurdaPayi:0, rework:0 }; ML_KALEMLER.forEach(([k]) => { T[k] = 0; });
  const grup = {}, ay = {}, kod = {}, eksikNeden = {};
  let eksikli = 0;
  kayit.forEach(({ x, m }) => {
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
    if(m.eksik.length){ eksikli++; m.eksik.forEach(e => { const k = e.replace(/:.*$/, ''); eksikNeden[k] = (eksikNeden[k] || 0) + 1; }); }
  });
  const kalemler = ML_KALEMLER.map(([k, ad]) => ({ k, ad, t:T[k] })).filter(r => r.t > 0).sort((a, b) => b.t - a.t);
  const pay = v => T.toplam ? v / T.toplam * 100 : 0;
  const ort = T.toplam / kayit.length;
  const kalite = T.hurdaPayi + T.rework;

  // Özet
  h += agBolumBas('ml-ozet', 'Özet', donemAd.toLocaleLowerCase('tr') + ' · ' + kayit.length + ' iş emri');
  h += agYorum([
    `${donemAd} <b>${kayit.length}</b> iş emri tamamlandı; toplam maliyet <b>${mlTL(T.toplam)}</b>.`,
    kalemler.length ? `En büyük kalem ${kalemler[0].ad.toLocaleLowerCase('tr')}, payı %${Math.round(pay(kalemler[0].t))}${kalemler[1] ? `; ardından ${kalemler[1].ad.toLocaleLowerCase('tr')} (%${Math.round(pay(kalemler[1].t))})` : ''}${kalemler[2] ? ` ve ${kalemler[2].ad.toLocaleLowerCase('tr')} (%${Math.round(pay(kalemler[2].t))})` : ''} geliyor.` : '',
    kalite > 0 ? `Kalitesizliğin bedeli ${mlTL(kalite)}: hurdaya giden parçalar ${mlTL(T.hurdaPayi)}, düzeltme (rework) işleri ${mlTL(T.rework)}.` : 'Bu dönemde hurda ya da düzeltme işi maliyeti yok.',
    eksikli ? `<span style="color:var(--warn)">${eksikli} iş emrinde eksik ya da tahmini kalem var (çoğunlukla hammadde kaydı) — bu iş emirlerinde maliyet olduğundan düşük çıkabilir; ayrıntı en altta.</span>` : ''
  ]);
  h += `<div class="rt-kpiler ag-kpi-buyuk">
    ${rtKpi('Toplam maliyet', mlTL(T.toplam), '', T.saglam ? 'sağlam parça başı ' + mlTL(T.toplam / T.saglam) : '')}
    ${rtKpi('İş emri başına', mlTL(ort), '', kayit.length + ' iş emri ortalaması')}
    ${rtKpi('Kalitesizlik maliyeti', mlTL(kalite), '', 'hurda + düzeltme · toplamın içinde, payı %' + mlFmt(pay(kalite), 1))}
  </div>`;

  // Kalemler
  h += agBolumBas('ml-kalem', 'Maliyet kalemleri', 'toplam içindeki payları');
  h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>Kalem</th><th class="r">Tutar</th><th class="r">Pay</th></tr></thead><tbody>
    ${kalemler.map(r => `<tr class="rt-tablo-sabit"><td>${r.ad}</td><td class="r mono">${mlTL(r.t)}</td><td class="r"><span class="ag-oran" style="--p:${pay(r.t).toFixed(1)}%"></span><span class="mono">%${mlFmt(pay(r.t), 1)}</span></td></tr>`).join('')}
  </tbody></table></div>`;

  // Aylık
  const aylar = Object.keys(ay).sort();
  if(aylar.length > 1){
    const buAy = new Date(); const buAyK = buAy.getFullYear() + '-' + String(buAy.getMonth() + 1).padStart(2, '0');
    h += agBolumBas('ml-ay', 'Aylık', 'devam eden ay önceki ayla kıyaslanmaz');
    h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>Ay</th><th class="r">İş emri</th><th class="r">Toplam</th><th class="r">İş emri başına</th><th class="r">İşçilik</th><th class="r">Malzeme</th><th>Önceki aya göre (iş emri başına)</th></tr></thead><tbody>
      ${aylar.map((k, i) => {
        const A = ay[k], o = A.toplam / A.n, onc = i > 0 ? ay[aylar[i - 1]] : null;
        let fark = '';
        if(k === buAyK) fark = '<span class="rt-silik">devam ediyor</span>';
        else if(onc){ const oo = onc.toplam / onc.n, f = o - oo, y = oo ? Math.abs(f / oo * 100) : 0;
          fark = Math.abs(f) < 1 ? 'değişmedi' : `${f > 0 ? '+' : '−'}${mlTL(Math.abs(f))} <small>(%${Math.round(y)} ${f > 0 ? 'artış' : 'azalış'})</small>`; }
        return `<tr class="rt-tablo-sabit"><td>${A.ad}</td><td class="r mono">${A.n}</td><td class="r mono">${mlTL(A.toplam)}</td><td class="r mono">${mlTL(o)}</td><td class="r mono">${mlTL(A.iscilik)}</td><td class="r mono">${mlTL(A.malzeme)}</td><td>${fark}</td></tr>`;
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
      ${gl.map(g => `<tr class="rt-tablo-sabit"><td>${esc(g.ad)}</td><td class="r mono">${agSaat(g.dk)}</td><td class="r mono">${mlTL(g.tutar)}</td><td class="r"><span class="ag-oran" style="--p:${(g.tutar / gt * 100).toFixed(1)}%"></span><span class="mono">%${mlFmt(g.tutar / gt * 100, 1)}</span></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  // CANIAS kodu bazında
  const kl = Object.values(kod).sort((a, b) => b.toplam - a.toplam);
  const tekrar = kl.filter(k => k.n > 1).length;
  h += agBolumBas('ml-kod', 'CANIAS kodu bazında', 'adet başı maliyet — teklif için');
  h += agYorum([`${kl.length} farklı CANIAS kodu üretildi${tekrar ? `; ${tekrar} tanesi bu dönemde birden fazla kez — onlarda en düşük ile en yüksek adet başı maliyet yan yana` : ''}.`]);
  const kGoster = maliyetAnalizTumKod ? kl : kl.slice(0, 15);
  h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>CANIAS kodu</th><th class="rt-dar-gizle">Mamul</th><th class="r">İş emri</th><th class="r">Adet</th><th class="r">Toplam</th><th class="r">Adet başı</th><th class="r">En düşük – en yüksek</th></tr></thead><tbody>
    ${kGoster.map(k => { const mn = Math.min(...k.birimler), mx = Math.max(...k.birimler);
      return `<tr class="rt-tablo-sabit"><td class="mono">${esc(k.kod)}</td><td class="rt-silik rt-kes rt-dar-gizle">${esc(k.ad || '')}</td><td class="r mono">${k.n}</td><td class="r mono">${rtFmt(k.adet)}</td><td class="r mono">${mlTL(k.toplam)}</td>
        <td class="r mono">${k.adet ? mlTL(k.toplam / k.adet) : '—'}</td><td class="r mono">${k.n > 1 && k.birimler.length > 1 ? mlTL(mn) + ' – ' + mlTL(mx) : '<span class="rt-silik">—</span>'}</td></tr>`; }).join('')}
  </tbody></table></div>
  ${kl.length > 15 ? `<button type="button" class="ag-detay-dugme" onclick="maliyetAnalizTumKod=!maliyetAnalizTumKod; render()">${ico(maliyetAnalizTumKod ? 'chevronUp' : 'chevronDown', 14)} ${maliyetAnalizTumKod ? 'İlk 15\'i göster' : 'Tümünü göster (' + kl.length + ')'}</button>` : ''}`;

  // En pahalı iş emirleri
  const pahali = kayit.slice().sort((a, b) => b.m.toplam - a.m.toplam).slice(0, 10);
  h += agBolumBas('ml-pahali', 'En yüksek maliyetli iş emirleri', 'Döküm ile kalem kalem');
  h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>İş emri</th><th>CANIAS kodu</th><th class="rt-dar-gizle">Mamul</th><th class="r">Adet</th><th class="r">Toplam</th><th class="r">Adet başı</th><th></th></tr></thead><tbody>
    ${pahali.map(({ x, m }) => `<tr class="rt-tablo-sabit"><td class="mono">${esc(x.talep || '—')}</td><td class="mono">${esc(x.uKodu)}</td><td class="rt-silik rt-kes rt-dar-gizle">${esc(x.mamulAdi || '')}</td><td class="r mono">${m.adet}${m.hurda ? ` <span style="color:var(--warn)" title="hurda">(${m.hurda} h)</span>` : ''}</td>
      <td class="r mono">${mlTL(m.toplam)}${m.eksik.length ? ` <span style="color:var(--warn)" title="${esc(m.eksik.join('\n'))}">⚠</span>` : ''}</td><td class="r mono">${m.birim != null ? mlTL(m.birim) : '—'}</td>
      <td><button class="btn-ghost" style="width:auto;padding:2px 9px;font-size:11px" onclick="maliyetDokumAc('${escJs(x.talep || x.uKodu)}')">Döküm</button></td></tr>`).join('')}
  </tbody></table></div>`;

  // Eksik veri
  const en = Object.entries(eksikNeden).sort((a, b) => b[1] - a[1]);
  if(en.length){
    h += agBolumBas('ml-eksik', 'Eksik veri', 'maliyetin eksik kaldığı yerler');
    h += agYorum([`${eksikli} iş emrinde en az bir eksik var. En sık sebep "${esc(en[0][0])}" (${en[0][1]} iş emri). Hammadde stok çıkışı, ilk operasyonda hammadde seçilerek ya da BOM + Rota'da standart tanımlanarak tamamlanır; fiyatı olmayan türler Ayarlar → Maliyet Parametreleri'nden eklenir.`]);
    h += `<div class="table-wrap"><table class="rt-tablo"><thead><tr><th>Sebep</th><th class="r">İş emri</th></tr></thead><tbody>
      ${en.slice(0, 12).map(([k, n]) => `<tr class="rt-tablo-sabit"><td>${esc(k)}</td><td class="r mono">${n}</td></tr>`).join('')}</tbody></table></div>`;
  }
  return h + `</div>` + renderMaliyetDokum();
}
