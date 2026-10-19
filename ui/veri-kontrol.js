/* ==================== VERİ KONTROLÜ (13.10.2026, kullanıcı onayı: "veri kalitesi kontrolleri") ====================
   Analiz rakamları ancak kayıtlar doğruysa doğru. Bu hafta bulunan hataların hepsinin kökünde veri vardı:
   gün sonunda kapatılmayan kayıtlar süreyi şişiriyordu, ilk operasyonların çoğunda hammadde girilmemişti,
   iş emri miktarı 33 / 0 girilmişti. Bu ekran bunları tek listede, düzeltilecek yerin bağlantısıyla verir.
   Yalnız okur — hiçbir kaydı kendisi değiştirmez. Analiz → Veri Kontrolü (adminler). */
let veriKontrolGun = 7;
const VK_GOZETIMSIZ = /^(C0\d|DE\d\d|TE\d\d|DDTE\d\d)$/;   // CNC / erozyon: gece kendi kendine çalışabilir
const VK_KESIM = /^(TES\d\d|TE\d\d|DDTE\d\d)$/;               // testere / tel erozyon: bir bloktan birden çok parça çıkar

function veriKontrolBulgulari(){
  const simdi = nowTick, bas = simdi - veriKontrolGun * 864e5;
  const kod = e => String(e.makine || '').split(' · ')[0];
  /* Fason ve FKK bekleme istasyonları: orada uzun kalmak normal (iş fasonda / kalite kararında) */
  const tum = entriesArray().filter(e => !isFasonMachine(e.makine) && !(typeof kaliteMakinesiMi === 'function' && kaliteMakinesiMi(e.makine)));

  /* 1) Şu an açık ve uzun süredir kapatılmamış: devam ≥ 16 saat; duruş (Gün Sonu / Planlı Mola dışı) ≥ 24 saat */
  const acik = tum.filter(e => {
    if(e.status === 'devam') return simdi - (e.startTs || simdi) >= 16 * 3600000 && !(e.excludedLog || []).some(x => x.ts > simdi - 16 * 3600000);
    if(e.status === 'duruş' && e.duruşTs && !isVerimlilikDisiDurus(e.duruşNedeni)) return simdi - e.duruşTs >= 24 * 3600000;
    return false;
  }).map(e => ({ e, sure: simdi - (e.status === 'duruş' ? e.duruşTs : e.startTs) }))
    .sort((a, b) => b.sure - a.sure);

  /* 2) Dönemde biten, 20 saatten uzun KESİNTİSİZ çalışma (gün sonu da duruş da yok) */
  const uzun = tum.filter(e => e.status === 'tamamlandi' && (e.endTs || 0) >= bas && entryUzunKosu(e))
    .map(e => { const en = entryNetAraliklar(e, -Infinity, Infinity).reduce((m, [a, b]) => Math.max(m, b - a), 0); return { e, sure: en, gozetimsiz: VK_GOZETIMSIZ.test(kod(e)) }; })
    .sort((a, b) => (a.gozetimsiz - b.gozetimsiz) || (b.sure - a.sure));

  /* 3) Hammaddesi girilmemiş ilk operasyonlar (İş Yoğunluğu'ndaki listenin aynısı) */
  const hammaddesiz = typeof hammaddesizIsler === 'function' ? hammaddesizIsler().filter(e => (e.startTs || 0) >= bas) : [];

  /* 4) İş emri miktarı tutarsız: SONRAKİ bir operasyonda adet ilk operasyonun 2 katından fazla (parça
     sonradan çoğalamaz — "3 → 33" yazım hatası), ya da ilk operasyonda adet yok. Azalma normal:
     kısmi aktarım ve hurda yüzünden sonraki operasyonlar daha az adetle devam eder. Testere / tel
     erozyonda ve onlardan SONRA artış da normal (1 blok → 5 parça) — o işler hiç işaretlenmez. */
  const talepler = {};
  tum.filter(e => (e.startTs || 0) >= bas - 60 * 864e5 && e.talepNo).forEach(e => { (talepler[String(e.talepNo).trim()] ||= []).push(e); });
  const miktar = [];
  Object.entries(talepler).forEach(([t, l]) => {
    if(!l.some(e => (e.startTs || 0) >= bas)) return;
    const sirali = l.slice().sort((a, b) => (a.startTs || 0) - (b.startTs || 0));
    const ilk = sirali[0], ilkAdet = Number(ilk.adet) || 0;
    const adetler = sirali.map(e => Number(e.adet) || 0);
    if(!adetler.some(a => a > 0)) miktar.push({ talep: t, e: ilk, neden: 'adet girilmemiş (0 / boş)', adetler });
    else if(ilkAdet > 0){
      const kesimSirasi = sirali.findIndex(e => VK_KESIM.test(kod(e)));
      const kesimOncesi = kesimSirasi < 0 ? sirali : sirali.slice(0, kesimSirasi);
      const fazla = kesimOncesi.find(e => (Number(e.adet) || 0) >= 3 * ilkAdet && (Number(e.adet) || 0) - ilkAdet >= 3);
      if(fazla) miktar.push({ talep: t, e: ilk, neden: `ilk operasyon ${ilkAdet} adet, ${String(fazla.makine || '').split(' · ')[0]}'de ${fazla.adet} adet — parça sonradan çoğalamaz`, adetler });
    }
  });
  /* Malzeme bekleyende İ.E. miktarı 0 ya da iş emrindeki adetten çok farklı */
  const mb = Object.values(malzemeBekleyen || {}).filter(x => x && x.durum !== 'karsilandi').map(x => {
    const ie = Number(x.ieMiktar) || 0;
    const kayit = (talepler[String(x.talepNo || '').trim()] || []).map(e => Number(e.adet) || 0).filter(a => a > 0);
    const gercek = kayit.length ? Math.max(...kayit) : 0;
    if(!ie) return { x, neden: 'İ.E. miktarı 0 — ihtiyaç 1 adet sayılıyor' };
    if(gercek && (ie >= 2 * gercek || gercek >= 2 * ie) && Math.abs(ie - gercek) >= 3) return { x, neden: `İ.E. miktarı ${ie}, iş emri kayıtlarında ${gercek}` };
    return null;
  }).filter(Boolean);

  /* 5) Duruş kaydı tutarsız: zaman damgalı duruş listesi toplamı, kayıttaki toplam duruştan 5 dk+ farklı (verimlilik saat bazında hesaplanıyor) */
  const durus = tum.filter(e => (e.endTs || e.startTs || 0) >= bas && Array.isArray(e.durusLog) && e.durusLog.length)
    .map(e => ({ e, fark: (e.duruşToplamMs || 0) - e.durusLog.reduce((s, v) => s + (Number(v.sureMs) || 0), 0) }))
    .filter(x => Math.abs(x.fark) >= 5 * 60000);

  return { acik, uzun, hammaddesiz, miktar, mb, durus };
}

function vkSure(ms){ return ms >= 48 * 3600000 ? Math.round(ms / 864e5 * 10) / 10 + ' gün' : fmtDur(ms); }
function vkBolum(baslik, sayi, aciklama, govde, renk){
  return `<div class="set-card" style="margin-bottom:14px;border-left:3px solid ${sayi ? (renk || 'var(--warn)') : 'var(--success)'}">
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="set-sec" style="margin:0">${esc(baslik)}</div>
      <span class="mono" style="font-weight:700;color:${sayi ? (renk || 'var(--warn)') : 'var(--success)'}">${sayi ? sayi : '✓ yok'}</span></div>
    <div style="font-size:12px;color:var(--text-muted);margin:4px 0 ${sayi ? 10 : 0}px">${aciklama}</div>
    ${sayi ? govde : ''}</div>`;
}
function vkTablo(basliklar, satirlar, sinir){
  const n = sinir || 25;
  return `<div class="table-wrap"><table class="rt-tablo"><thead><tr>${basliklar.map(b => `<th>${b}</th>`).join('')}</tr></thead><tbody>${satirlar.slice(0, n).join('')}</tbody></table></div>
    ${satirlar.length > n ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:6px">+${satirlar.length - n} satır daha</div>` : ''}`;
}
function vkIsEmri(e){
  return `<span class="mono" style="color:var(--accent);cursor:pointer;text-decoration:underline dotted" title="İş emrinin geçmişi" onclick="openIyGecmisModal('${escJs(e.isEmriNo)}')">${esc(e.talepNo || e.isEmriNo || '—')}</span>
    <span class="mono" style="display:block;font-size:10.5px;color:var(--text-subtle)">${esc(e.isEmriNo || '')}</span>`;
}
const vkMakine = e => `<span class="mono">${esc(String(e.makine || '').split(' · ')[0])}</span>`;
const vkKisi = e => esc(e.operatorName || e.operatorUsername || '—');

function renderVeriKontrol(){
  if(typeof bomRotaYukle === 'function') bomRotaYukle(false);   // hammaddesiz listesi stok hareketlerini okur
  const b = veriKontrolBulgulari();
  const toplam = b.acik.length + b.uzun.filter(x => !x.gozetimsiz).length + b.hammaddesiz.length + b.miktar.length + b.mb.length;
  const cip = (g, et) => `<button class="chip ${veriKontrolGun === g ? 'active' : ''}" onclick="veriKontrolGun=${g}; render()">${et}</button>`;
  let h = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px">${cip(7, 'Son 7 gün')}${cip(30, 'Son 30 gün')}</div>`;
  h += agYorum([
    toplam ? `Son ${veriKontrolGun} günde düzeltilmesi gereken <b>${toplam}</b> kayıt var. Bunlar düzelmeden verimlilik, mesai ve maliyet rakamları gerçeği tam göstermez.`
           : `Son ${veriKontrolGun} günde düzeltilmesi gereken kayıt yok — analiz rakamları bu açıdan güvenilir.`,
    'Bu ekran yalnız gösterir; düzeltme ilgili ekrandan yapılır (iş emri numarasına tıklayınca geçmişi açılır).'
  ]);

  h += vkBolum('Şu an açık, uzun süredir kapatılmamış', b.acik.length,
    'Çalışıyor görünen ve 16 saattir gün sonu almamış, ya da 24 saattir duruşta bekleyen kayıtlar. Bu süre çalışma/duruş sayılmaya devam ediyor.',
    vkTablo(['İş emri', 'Makine', 'Operatör', 'Durum', 'Ne zamandır'], b.acik.map(({ e, sure }) =>
      `<tr class="rt-tablo-sabit"><td>${vkIsEmri(e)}</td><td>${vkMakine(e)}</td><td>${vkKisi(e)}</td>
        <td>${e.status === 'duruş' ? `<span style="color:var(--warn)">duruşta · ${esc(e.duruşNedeni || '')}</span>` : '<span style="color:var(--success)">çalışıyor</span>'}</td>
        <td class="mono" style="color:var(--danger);font-weight:600">${vkSure(sure)}</td></tr>`)), 'var(--danger)');

  const uzunElle = b.uzun.filter(x => !x.gozetimsiz).length;
  h += vkBolum('20 saatten uzun kesintisiz çalışma', uzunElle,
    'Bitmiş ama arada hiç gün sonu ya da duruş olmadan 20 saatten uzun çalışmış kayıtlar — çoğunlukla gün sonunda kapatılmamış iş. CNC / erozyon (gece kendi kendine çalışabilir) ayrıca gri gösterilir, sayıya katılmaz.',
    vkTablo(['İş emri', 'Makine', 'Operatör', 'Başlama → bitiş', 'Kesintisiz'], b.uzun.map(({ e, sure, gozetimsiz }) =>
      `<tr class="rt-tablo-sabit"${gozetimsiz ? ' style="opacity:.55" title="Gözetimsiz çalışabilen makine — uzun koşu normal olabilir"' : ''}><td>${vkIsEmri(e)}</td><td>${vkMakine(e)}</td><td>${vkKisi(e)}</td>
        <td class="mono" style="font-size:12px">${fmtDT(e.startTs)} → ${fmtDT(e.endTs)}</td><td class="mono" style="font-weight:600">${vkSure(sure)}</td></tr>`)));

  h += vkBolum('Hammaddesi girilmemiş ilk operasyon', b.hammaddesiz.length,
    'İlk operasyon hammadde seçilmeden başlamış — maliyette çelik 0 sayılıyor. "Hammadde gir" ile stoktan düşülür ya da "Kullanılmadı" denir.',
    vkTablo(['İş emri', 'Makine', 'Operatör', 'Başlama', ''], b.hammaddesiz.map(e =>
      `<tr class="rt-tablo-sabit"><td>${vkIsEmri(e)}</td><td>${vkMakine(e)}</td><td>${vkKisi(e)}</td><td class="mono" style="font-size:12px">${fmtDT(e.startTs)}</td>
        <td style="text-align:right;white-space:nowrap">${canManageStock() ? `<button class="btn-ghost" style="width:auto;padding:2px 9px;font-size:11px" onclick="hmGirAc('${escJs(e.id)}')">Hammadde gir</button>
        <button class="btn-ghost" style="width:auto;padding:2px 9px;font-size:11px" onclick="hmKullanilmadi('${escJs(e.id)}')">Kullanılmadı</button>` : ''}</td></tr>`)));

  h += vkBolum('İş emri miktarı tutarsız', b.miktar.length + b.mb.length,
    'Sonraki bir operasyonda adet ilk operasyonun 3 katından fazla (ör. 3 → 33; azalma normaldir, testere / tel erozyon sonrası artış da) ya da hiç girilmemiş; malzeme bekleyende İ.E. miktarı 0 ya da iş emrindekinden çok farklı. Maliyetin adet başı ve malzeme ihtiyacı buna göre hesaplanıyor.',
    vkTablo(['İş emri', 'Nerede', 'Sorun'], b.miktar.map(m =>
      `<tr class="rt-tablo-sabit"><td>${vkIsEmri(m.e)}</td><td>operasyon kayıtları</td><td style="color:var(--warn)">${esc(m.neden)}</td></tr>`).concat(b.mb.map(({ x, neden }) =>
      `<tr class="rt-tablo-sabit"><td><span class="mono">${esc(x.talepNo || x.isEmriNo || '—')}</span><span class="mono" style="display:block;font-size:10.5px;color:var(--text-subtle)">${esc(x.isEmriNo || '')}</span></td>
        <td>Malzeme Bekleyenler · ${esc(x.hammaddeKod || '')}</td><td style="color:var(--warn)">${esc(neden)}</td></tr>`))));

  h += vkBolum('Duruş kaydı tutarsız', b.durus.length,
    'Kaydın toplam duruşu ile saatli duruş listesi uyuşmuyor (5 dk+). Verimlilik saatli listeden hesaplanır; fark çoğunlukla elle düzeltilmiş eski kayıtlardan. Bilgi amaçlı — genel sayıya katılmaz.',
    vkTablo(['İş emri', 'Makine', 'Operatör', 'Fark'], b.durus.map(({ e, fark }) =>
      `<tr class="rt-tablo-sabit"><td>${vkIsEmri(e)}</td><td>${vkMakine(e)}</td><td>${vkKisi(e)}</td><td class="mono">${fark > 0 ? '+' : '−'}${fmtDur(Math.abs(fark))}</td></tr>`), 15), 'var(--text-muted)');

  return h + (iyGecmisModalIsEmriNo ? renderIyGecmisModal() : '') + (typeof renderHmGirModal === 'function' ? renderHmGirModal() : '') + (typeof ydModal !== 'undefined' && ydModal ? renderYerDuzeltModal() : '');
}
