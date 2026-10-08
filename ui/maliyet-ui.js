/* ==================== MALİYET EKRANLARI (08.10.2026) ====================
   Ayarlar → Maliyet Parametreleri (SuperAdmin düzenler, adminler görür), şifre penceresi,
   BOM + Rota kartında maliyet satırı ve döküm penceresi. Mantık: js/maliyet.js. */

let maliyetForm = null;          // düzenlenen parametreler (son sürümün kopyası)
let maliyetSifreModal = false;   // kilit açma penceresi
let maliyetDokum = null;         // döküm penceresindeki iş emri (bomRotaListesi öğesi)

function mlFormHazirla(zorla){
  if(maliyetForm && !zorla) return;
  const v = maliyetVarsayilan(), son = maliyetSonParam();
  maliyetForm = JSON.parse(JSON.stringify(son ? { ...v, ...son, genel: { ...v.genel, ...(son.genel || {}) }, kur: { ...v.kur, ...(son.kur || {}) } } : v));
}
function mlSet(yol, deger){
  if(!maliyetForm) return;
  const p = yol.split('.'); let o = maliyetForm;
  for(let i = 0; i < p.length - 1; i++){ const k = /^\d+$/.test(p[i]) ? Number(p[i]) : p[i]; if(o[k] == null) o[k] = {}; o = o[k]; }
  o[p[p.length - 1]] = deger;
}
function mlSatirEkle(liste){
  mlFormHazirla();
  const bos = { gruplar: { key:'g' + Date.now().toString(36), ad:'Yeni grup', makineler:[], dk:0, kw:0, verim:100, amortDeger:0, amortYil:10, amortSaat:2340 },
    celik: { tur:'', fiyat:0, para:'EUR', yogunluk:7.85, isil:'' }, karbur: { kalite:'', fiyat:0, para:'USD', yogunluk:13.4 }, isil: { tur:'', fiyat:0, para:'TRY' } }[liste];
  (maliyetForm[liste] = maliyetForm[liste] || []).push(bos); render();
}
function mlSatirSil(liste, i){ if(maliyetForm && maliyetForm[liste]){ maliyetForm[liste].splice(i, 1); render(); } }
function mlMakineEkle(i, kod){
  if(!kod || !maliyetForm) return;
  maliyetForm.gruplar.forEach(g => { g.makineler = (g.makineler || []).filter(m => m !== kod); });   // makine tek grupta
  maliyetForm.gruplar[i].makineler.push(kod); render();
}
function mlMakineCikar(i, kod){ maliyetForm.gruplar[i].makineler = maliyetForm.gruplar[i].makineler.filter(m => m !== kod); render(); }
/* Dakika ücreti yardımcısı: aylık işveren maliyeti ve kişi sayısı SAKLANMAZ, yalnız sonuç (₺/dk) yazılır */
function mlDkHesapla(i){
  const t = mlSayi((document.getElementById('ml-yrd-tutar-' + i) || {}).value), k = mlSayi((document.getElementById('ml-yrd-kisi-' + i) || {}).value) || 1;
  const dakika = mlSayi(maliyetForm.genel.aylikDakika) || 13500;
  if(!(t > 0)){ toast('Aylık toplam işveren maliyetini gir'); return; }
  maliyetForm.gruplar[i].dk = Math.round(t / k / dakika * 1000) / 1000;
  render();
}
function mlNormalize(f){
  const p = JSON.parse(JSON.stringify(f)), n = mlSayi;
  p.kur.usd = n(p.kur.usd); p.kur.eur = n(p.kur.eur);
  ['aylikDakika','kwh','sarfDkUsd','genelGiderYuzde','verimlilik'].forEach(k => { p.genel[k] = n(p.genel[k]); });
  if(!p.genel.verimlilik) p.genel.verimlilik = 1;
  p.genel.isilMakineler = (Array.isArray(p.genel.isilMakineler) ? p.genel.isilMakineler : String(p.genel.isilMakineler || '').split(/[\s,;]+/)).map(s => String(s).trim().toUpperCase()).filter(Boolean);
  p.gruplar.forEach(g => ['dk','kw','verim','amortDeger','amortYil','amortSaat'].forEach(k => { g[k] = n(g[k]); }));
  p.celik = (p.celik || []).filter(c => String(c.tur || '').trim()).map(c => ({ ...c, tur:String(c.tur).trim().toUpperCase(), fiyat:n(c.fiyat), yogunluk:n(c.yogunluk) || 7.85 }));
  p.karbur = (p.karbur || []).filter(c => String(c.kalite || '').trim()).map(c => ({ ...c, kalite:String(c.kalite).trim().toUpperCase(), fiyat:n(c.fiyat), yogunluk:n(c.yogunluk) || 13.4 }));
  p.isil = (p.isil || []).filter(c => String(c.tur || '').trim()).map(c => ({ ...c, tur:String(c.tur).trim(), fiyat:n(c.fiyat) }));
  Object.keys(p.kisiDk || {}).forEach(k => { const v = n(p.kisiDk[k]); if(v > 0) p.kisiDk[k] = v; else delete p.kisiDk[k]; });
  return p;
}
async function mlFormKaydet(){
  if(!canEditMaliyet() || !maliyetForm) return;
  try{ await maliyetKaydet(mlNormalize(maliyetForm)); toast('Maliyet parametreleri kaydedildi (yeni sürüm)'); mlFormHazirla(true); render(); }
  catch(e){ toast('Kaydedilemedi: ' + mlHataMetni(e)); }
}
function mlHataMetni(e){
  const m = (e && e.message) || String(e || 'hata');
  return /permission/i.test(m) ? 'veritabanı izni yok — "maliyet" kuralı yayınlanmalı' : m;
}
async function mlKurulum(){
  const a = (document.getElementById('ml-sifre-1') || {}).value || '', b = (document.getElementById('ml-sifre-2') || {}).value || '';
  if(a.length < 8){ toast('Şifre en az 8 karakter olmalı'); return; }
  if(a !== b){ toast('Şifreler aynı değil'); return; }
  mlFormHazirla();
  try{ await maliyetKaydet(mlNormalize(maliyetForm), a); toast('Maliyet şifresi belirlendi — bu cihazda açık'); render(); }
  catch(e){ toast('Kurulamadı: ' + mlHataMetni(e)); }
}
async function mlSifreDegistir(){
  const a = (document.getElementById('ml-yeni-1') || {}).value || '', b = (document.getElementById('ml-yeni-2') || {}).value || '';
  if(a.length < 8){ toast('Şifre en az 8 karakter olmalı'); return; }
  if(a !== b){ toast('Şifreler aynı değil'); return; }
  try{ await maliyetKaydet(null, a); toast('Şifre değişti — diğer cihazlarda yeni şifre girilmeli'); render(); }
  catch(e){ toast('Değiştirilemedi: ' + mlHataMetni(e)); }
}
async function mlKilitAcTikla(){
  const el = document.getElementById('ml-sifre-ac'); const v = el ? el.value : '';
  if(!v){ toast('Şifreyi gir'); return; }
  const ok = await maliyetKilitAc(v);
  if(el) el.value = '';
  if(ok){ maliyetSifreModal = false; mlFormHazirla(true); toast('Maliyet bu cihazda açıldı'); }
  else toast('Şifre yanlış');
  render();
}
function mlJsonIceAktar(input){
  const f = input && input.files && input.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const j = JSON.parse(r.result); const v = maliyetVarsayilan();
      maliyetForm = { ...v, ...j, genel: { ...v.genel, ...(j.genel || {}) }, kur: { ...v.kur, ...(j.kur || {}) } };
      toast('İçe aktarıldı — kontrol edip "Kaydet" de'); render();
    }catch(e){ toast('Dosya okunamadı: ' + e.message); }
  };
  r.readAsText(f);
}
function mlJsonDisaAktar(){
  if(!maliyetForm) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(mlNormalize(maliyetForm), null, 2)], { type:'application/json' }));
  a.download = 'maliyet-parametreleri-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- Ayarlar → Maliyet Parametreleri ---------- */
function renderMaliyetAyarlari(){
  if(!canSeeMaliyet()) return `<div class="set-card">Bu bölüm yalnız adminler için.</div>`;
  maliyetYukle();
  const d = maliyetDurum, sa = canEditMaliyet();
  const kart = (baslik, ic, alt) => `<div class="set-card"><div class="set-sec" style="margin:0 0 10px">${baslik}</div>${alt ? `<div style="font-size:12px;color:var(--text-muted);margin:-4px 0 10px">${alt}</div>` : ''}${ic}</div>`;
  if(!d.okundu) return kart('Maliyet', '<div style="color:var(--text-muted)">Okunuyor…</div>');
  if(d.hata) return kart('Maliyet', `<div style="color:var(--danger)">Okunamadı: ${esc(mlHataMetni({ message:d.hata }))}</div>`);

  // Erişim
  let h = '';
  if(!d.blob){
    h += kart('Maliyet şifresi', sa ? `<div style="font-size:12.5px;margin-bottom:10px">Parametreler (dakika ücretleri, alış fiyatları) veritabanında <b>şifreli</b> saklanır; şifreyi bilen adminler kendi cihazında bir kez girer. Şifreyi unutursanız parametreler yeniden girilir — bir yere not edin.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="ml-sifre-1" type="password" autocomplete="new-password" placeholder="Şifre (en az 8)" style="max-width:220px">
        <input id="ml-sifre-2" type="password" autocomplete="new-password" placeholder="Şifre (tekrar)" style="max-width:220px">
        <button class="btn-primary" style="width:auto;padding:8px 16px" onclick="mlKurulum()">Şifreyi belirle ve başla</button></div>`
      : `<div style="color:var(--text-muted)">Maliyet henüz kurulmadı — SuperAdmin'in şifre belirlemesi gerekiyor.</div>`);
    return h;
  }
  if(!maliyetAcik()){
    return kart('Maliyet şifresi', `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="ml-sifre-ac" type="password" autocomplete="current-password" placeholder="Maliyet şifresi" style="max-width:240px" onkeydown="if(event.key==='Enter') mlKilitAcTikla()">
      <button class="btn-primary" style="width:auto;padding:8px 16px" onclick="mlKilitAcTikla()">Aç</button></div>`, 'Bu cihazda bir kez girilir; parametreler ve maliyetler ancak şifreyle çözülür.');
  }
  mlFormHazirla();
  const f = maliyetForm, ro = sa ? '' : 'disabled';
  const inp = (yol, val, w, ph, tip) => `<input class="ml-inp" style="width:${w || 90}px" ${tip ? `inputmode="${tip}"` : ''} value="${esc(val == null ? '' : val)}" placeholder="${esc(ph || '')}" ${ro} oninput="mlSet('${yol}', this.value)">`;
  const sel = (yol, val, secenekler) => `<select class="ml-inp" style="width:auto" ${ro} onchange="mlSet('${yol}', this.value)">${secenekler.map(([v, t]) => `<option value="${esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const paraSec = (yol, val) => sel(yol, val || 'TRY', [['TRY','₺'],['EUR','€'],['USD','$']]);
  const son = d.veri.surumler[d.veri.surumler.length - 1];

  h += kart('Maliyet şifresi', `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span style="color:var(--success)">🔓 Bu cihazda açık</span>
      <span style="font-size:12px;color:var(--text-muted)">Son kayıt: ${son ? esc(son.byName || son.by) + ' · ' + fmtDT(son.ts) : '—'} · ${d.veri.surumler.length} sürüm</span>
      <div style="flex:1"></div>
      <button class="btn-ghost" style="width:auto;padding:5px 12px" onclick="maliyetKilitle(); maliyetForm=null; render()">Bu cihazda kilitle</button></div>
    ${sa ? `<details style="margin-top:10px"><summary style="cursor:pointer;font-size:12.5px">Şifreyi değiştir</summary>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><input id="ml-yeni-1" type="password" autocomplete="new-password" placeholder="Yeni şifre" style="max-width:200px">
      <input id="ml-yeni-2" type="password" autocomplete="new-password" placeholder="Yeni şifre (tekrar)" style="max-width:200px">
      <button class="btn-ghost" style="width:auto;padding:6px 12px" onclick="mlSifreDegistir()">Değiştir</button></div></details>` : ''}`);

  /* Değerler boşken (ilk kurulum) içe aktarma en üstte, gözden kaçmasın */
  const bos = !(f.celik || []).some(c => mlSayi(c.fiyat) > 0) && !(f.gruplar || []).some(g => mlSayi(g.dk) > 0);
  if(sa && bos) h += `<div class="set-card" style="border-color:var(--accent)">
      <div class="set-sec" style="margin:0 0 6px">Başlangıç değerleri</div>
      <div style="font-size:13px;margin-bottom:10px">Dakika ücretleri, çelik / karbür / ısıl işlem türleri ve fiyatları Excel'inizden (<b>Kalıp maliyet çalışması.xlsm</b>) hazırlandı:
        <span class="mono">Masaüstü / maliyet çalışması / maliyet-baslangic.json</span>. Dosyayı seçin, değerler aşağıya dolar; kontrol edip <b>Kaydet</b> deyin.</div>
      <label class="btn-primary" style="width:auto;display:inline-flex;padding:9px 18px;cursor:pointer">⬆ maliyet-baslangic.json seç<input type="file" accept=".json,application/json" style="display:none" onchange="mlJsonIceAktar(this)"></label>
    </div>`;

  // Kur
  const k = maliyetKur(Date.now(), f);
  h += kart('Döviz kuru', `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      ${sel('kur.mod', f.kur.mod, [['otomatik','Otomatik (ECB, günlük)'],['elle','Elle']])}
      <span style="font-size:12.5px">Şu an: <b>1 $ = ${mlFmt(k.usd, 4)} ₺</b> · <b>1 € = ${mlFmt(k.eur, 4)} ₺</b> <span style="color:var(--text-muted)">(${k.kaynak === 'ECB' ? 'ECB ' + esc(k.tarih) : 'elle'})</span></span></div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:12.5px">Elle / yedek kur: $ ${inp('kur.usd', f.kur.usd, 90, '47,32', 'decimal')} € ${inp('kur.eur', f.kur.eur, 90, '53,87', 'decimal')}</div>`,
    'Otomatikte her iş emri bittiği günün kuruyla hesaplanır (Avrupa Merkez Bankası referans kuru; TCMB\'ye çok yakın). Kur alınamazsa elle kur kullanılır.');

  // Genel
  h += kart('Genel', `<div class="ml-izgara">
      <label>Aylık çalışma dakikası ${inp('genel.aylikDakika', f.genel.aylikDakika, 90, '13500', 'numeric')}</label>
      <label>Elektrik ₺/kWh ${inp('genel.kwh', f.genel.kwh, 80, '5,26', 'decimal')}</label>
      <label>Sarf $/dk ${inp('genel.sarfDkUsd', f.genel.sarfDkUsd, 90, '0,029', 'decimal')}</label>
      <label>Genel gider % (işçilik üzerine) ${inp('genel.genelGiderYuzde', f.genel.genelGiderYuzde, 70, '17,2', 'decimal')}</label>
      <label>Genel verimlilik çarpanı ${inp('genel.verimlilik', f.genel.verimlilik, 60, '1', 'decimal')}</label>
      <label>İşçilik yöntemi ${sel('genel.iscilikYontemi', f.genel.iscilikYontemi, [['bolum','Bölüm ortalaması'],['kisi','Kişi bazlı (yoksa bölüm)']])}</label>
      <label>Fason ısıl işlem makineleri ${inp('genel.isilMakineler', (f.genel.isilMakineler || []).join(', '), 120, 'FII01')}</label>
    </div>`, 'Genel gider oranı Excel\'deki mühendislik hizmeti oranı gibi işçiliğe eklenir; fırın vb. ayrı hesaplanmayan giderler buna dahil.');

  // Makine grupları
  const atanmis = new Set(f.gruplar.flatMap(g => g.makineler || []));
  const atanmamis = allMachines().filter(m => !atanmis.has(m.code));
  h += kart('Makine grupları', `<div class="ml-tablo-sar"><table class="tbl ml-tablo"><thead><tr><th>Grup</th><th>Makineler</th><th>İşçilik ₺/dk</th><th>kW</th><th>Verim %</th><th>Amortisman (makine değeri ₺ · ömür yıl · yıllık saat)</th><th></th></tr></thead><tbody>
    ${f.gruplar.map((g, i) => {
      const am = mlSayi(g.amortDeger) > 0 && mlSayi(g.amortYil) > 0 && mlSayi(g.amortSaat) > 0 ? mlSayi(g.amortDeger) / (mlSayi(g.amortYil) * mlSayi(g.amortSaat) * 60) : 0;
      return `<tr>
        <td>${inp('gruplar.' + i + '.ad', g.ad, 140, 'grup adı')}</td>
        <td><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">${(g.makineler || []).map(m => `<span class="ml-cip">${esc(m)}${sa ? `<button onclick="mlMakineCikar(${i},'${escJs(m)}')" title="Çıkar">×</button>` : ''}</span>`).join('')}
          ${sa ? `<select class="ml-inp" style="width:70px" onchange="mlMakineEkle(${i}, this.value)"><option value="">+</option>${allMachines().filter(m => !(g.makineler || []).includes(m.code)).map(m => `<option value="${esc(m.code)}">${esc(m.code)} · ${esc(m.name)}${atanmis.has(m.code) ? ' (başka grupta)' : ''}</option>`).join('')}</select>` : ''}</div></td>
        <td>${inp('gruplar.' + i + '.dk', g.dk, 70, '0', 'decimal')}
          ${sa ? `<details class="ml-yrd"><summary>hesapla</summary><input id="ml-yrd-tutar-${i}" class="ml-inp" style="width:110px" inputmode="decimal" placeholder="aylık işveren maliyeti ₺"><input id="ml-yrd-kisi-${i}" class="ml-inp" style="width:50px" inputmode="numeric" placeholder="kişi"><button class="btn-ghost" style="width:auto;padding:3px 8px" onclick="mlDkHesapla(${i})">→ ₺/dk</button><div style="font-size:10.5px;color:var(--text-muted)">Tutar saklanmaz, yalnız sonuç.</div></details>` : ''}</td>
        <td>${inp('gruplar.' + i + '.kw', g.kw, 55, '', 'decimal')}</td>
        <td>${inp('gruplar.' + i + '.verim', g.verim, 50, '100', 'decimal')}</td>
        <td style="white-space:nowrap">${inp('gruplar.' + i + '.amortDeger', g.amortDeger, 95, '0', 'decimal')} ${inp('gruplar.' + i + '.amortYil', g.amortYil, 45, '10', 'decimal')} ${inp('gruplar.' + i + '.amortSaat', g.amortSaat, 60, '2340', 'numeric')}
          <span style="font-size:11px;color:var(--text-muted)">${am ? '= ' + mlFmt(am, 3) + ' ₺/dk' : ''}</span></td>
        <td>${sa ? `<button class="btn-ghost" style="width:auto;padding:3px 8px" title="Grubu sil" onclick="mlSatirSil('gruplar',${i})">${ico('trash', 12)}</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>
    ${sa ? `<button class="btn-ghost" style="width:auto;padding:5px 12px;margin-top:8px" onclick="mlSatirEkle('gruplar')">+ Grup</button>` : ''}
    <div style="font-size:12px;color:var(--text-muted);margin-top:8px">Gruba bağlı olmayan makineler (süreleri maliyete girmez, genel gidere dahil sayılır): ${atanmamis.map(m => esc(m.code)).join(', ') || '—'}</div>`,
    'Elektrik = süre × kW × verim × kWh fiyatı. Amortisman = makine değeri ÷ (ömür × yıllık çalışma saati). Çoklu iş emri grubunda süre iş emirlerine eşit bölünür.');

  // Kişi bazlı
  const opList = Object.entries(STATE.operators || {}).filter(([c, v]) => !v.isSuperAdmin && !v.isAdmin && !v.isSef && !v.isUretimSef).sort((a, b) => a[0].localeCompare(b[0]));
  h += kart('Kişi bazlı dakika ücretleri', `<div class="ml-izgara">${opList.map(([c, v]) => `<label>${esc(c)} · ${esc(v.displayName || '')} ${inp('kisiDk.' + c, (f.kisiDk || {})[c] || '', 70, 'bölüm', 'decimal')}</label>`).join('')}</div>`,
    'Yalnız "İşçilik yöntemi: Kişi bazlı" seçiliyse kullanılır; boş olan kişi için bölüm ücreti geçer. Maaş değil, ₺/dk girilir.');

  // Çelik
  const isilSec = (yol, val) => sel(yol, val || '', [['','—']].concat((f.isil || []).map(t => [t.tur, t.tur])));
  h += kart('Çelik (hammadde)', `<table class="tbl ml-tablo"><thead><tr><th>Tür</th><th>kg fiyatı</th><th>Para</th><th>Yoğunluk g/cm³</th><th>Isıl işlem türü (fason)</th><th></th></tr></thead><tbody>
    ${(f.celik || []).map((c, i) => `<tr><td>${inp('celik.' + i + '.tur', c.tur, 100, 'ör. 2344')}</td><td>${inp('celik.' + i + '.fiyat', c.fiyat, 70, '', 'decimal')}</td><td>${paraSec('celik.' + i + '.para', c.para)}</td>
      <td>${inp('celik.' + i + '.yogunluk', c.yogunluk, 60, '7,85', 'decimal')}</td><td>${isilSec('celik.' + i + '.isil', c.isil)}</td>
      <td>${sa ? `<button class="btn-ghost" style="width:auto;padding:3px 8px" onclick="mlSatirSil('celik',${i})">${ico('trash', 12)}</button>` : ''}</td></tr>`).join('')}</tbody></table>
    ${sa ? `<button class="btn-ghost" style="width:auto;padding:5px 12px;margin-top:8px" onclick="mlSatirEkle('celik')">+ Çelik türü</button>` : ''}`,
    'Tür, stok kaleminin kodundaki 4 haneli çelik numarasıyla eşleşir (2344, 4140…); ıslahlı 4140 için "4140 QT" satırı. Ağırlık stok çıkışından (Ø × mm ya da A×B×C), yoksa operatörün yazdığı çap×boydan.');

  // Karbür
  h += kart('Karbür', `<table class="tbl ml-tablo"><thead><tr><th>Kalite</th><th>kg fiyatı</th><th>Para</th><th>Yoğunluk g/cm³</th><th></th></tr></thead><tbody>
    ${(f.karbur || []).map((c, i) => `<tr><td>${inp('karbur.' + i + '.kalite', c.kalite, 90, 'ör. VA90')}</td><td>${inp('karbur.' + i + '.fiyat', c.fiyat, 70, '', 'decimal')}</td><td>${paraSec('karbur.' + i + '.para', c.para)}</td>
      <td>${inp('karbur.' + i + '.yogunluk', c.yogunluk, 60, '13,4', 'decimal')}</td><td>${sa ? `<button class="btn-ghost" style="width:auto;padding:3px 8px" onclick="mlSatirSil('karbur',${i})">${ico('trash', 12)}</button>` : ''}</td></tr>`).join('')}</tbody></table>
    ${sa ? `<button class="btn-ghost" style="width:auto;padding:5px 12px;margin-top:8px" onclick="mlSatirEkle('karbur')">+ Kalite</button>` : ''}`,
    'Ağırlık karbür çıkışlarından: (dış çap² − delik²) × kesilen boy (testere payı dahil) × yoğunluk.');

  // Isıl işlem
  h += kart('Isıl işlem (fason)', `<table class="tbl ml-tablo"><thead><tr><th>Tür</th><th>kg fiyatı</th><th>Para</th><th></th></tr></thead><tbody>
    ${(f.isil || []).map((c, i) => `<tr><td>${inp('isil.' + i + '.tur', c.tur, 170, 'tür adı yaz')}</td><td>${inp('isil.' + i + '.fiyat', c.fiyat, 70, '', 'decimal')}</td><td>${paraSec('isil.' + i + '.para', c.para)}</td>
      <td>${sa ? `<button class="btn-ghost" style="width:auto;padding:3px 8px" onclick="mlSatirSil('isil',${i})">${ico('trash', 12)}</button>` : ''}</td></tr>`).join('')}</tbody></table>
    ${sa ? `<button class="btn-ghost" style="width:auto;padding:5px 12px;margin-top:8px" onclick="mlSatirEkle('isil')">+ Tür</button>` : ''}`,
    'Rotada fason ısıl işlem makinesi varsa: çelik kg × çelik türüne bağlı ısıl işlem fiyatı.');

  if(sa) h += `<div class="set-card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;position:sticky;bottom:0;z-index:5">
      <button class="btn-primary" style="width:auto;padding:9px 20px" onclick="mlFormKaydet()">Kaydet (yeni sürüm)</button>
      <button class="btn-ghost" style="width:auto;padding:8px 12px" onclick="mlFormHazirla(true); render()">Değişiklikleri at</button>
      <div style="flex:1"></div>
      <label class="btn-ghost" style="width:auto;padding:8px 12px;cursor:pointer">⬆ JSON içe aktar<input type="file" accept=".json,application/json" style="display:none" onchange="mlJsonIceAktar(this)"></label>
      <button class="btn-ghost" style="width:auto;padding:8px 12px" onclick="mlJsonDisaAktar()">⬇ JSON yedek</button></div>`;
  h += kart('Sürümler', `<div style="font-size:12.5px">${d.veri.surumler.slice().reverse().slice(0, 12).map(s => `<div>${fmtDT(s.ts)} · ${esc(s.byName || s.by)}</div>`).join('')}</div>`,
    'Her kayıt yeni sürüm; bir iş emri, bittiği tarihte geçerli sürümle hesaplanır (fiyat değişince geçmiş değişmez).');
  return h;
}

/* ---------- Şifre penceresi (BOM ekranından) ---------- */
function renderMaliyetSifreModal(){
  if(!maliyetSifreModal) return '';
  return `<div class="modal-overlay" onclick="if(event.target===this){maliyetSifreModal=false; render();}">
    <div class="modal-box" style="max-width:380px;padding:20px">
      <div class="sec-h" style="margin-top:0">Maliyet şifresi</div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px">Bu cihazda bir kez girilir.</div>
      <input id="ml-sifre-ac" type="password" autocomplete="current-password" placeholder="Şifre" onkeydown="if(event.key==='Enter') mlKilitAcTikla()">
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn-primary" style="flex:1" onclick="mlKilitAcTikla()">Aç</button>
      <button class="btn-ghost" style="width:auto" onclick="maliyetSifreModal=false; render()">Vazgeç</button></div>
    </div></div>`;
}

/* ---------- BOM + Rota kartı: maliyet satırı ---------- */
function maliyetKartHtml(x){
  if(!canSeeMaliyet()) return '';
  maliyetYukle();
  const d = maliyetDurum;
  let deger;
  if(!d.okundu) deger = '<span class="bom-ikincil">okunuyor…</span>';
  else if(d.hata) deger = `<span class="bom-ikincil">okunamadı — ${esc(mlHataMetni({ message:d.hata }))}</span>`;
  else if(!d.blob) deger = '<span class="bom-ikincil">kurulmadı — Ayarlar → Maliyet Parametreleri</span>';
  else if(!maliyetAcik()) deger = `<button type="button" class="btn-ghost" style="padding:2px 10px;font-size:11.5px" onclick="event.stopPropagation(); maliyetSifreModal=true; render()">🔒 Maliyeti göster</button>`;
  else {
    const m = maliyetHesapla(x);
    if(!m) deger = '<span class="bom-ikincil">parametre yok</span>';
    else deger = `<b>${mlTL(m.toplam)}</b>${m.birim != null ? ` <span class="bom-ikincil">· adet başı</span> <b>${mlTL(m.birim)}</b>${m.kur.eur ? ` <span class="bom-ikincil">(${mlFmt(m.birim / m.kur.eur, 1)} €)</span>` : ''}` : ''}
      ${m.hurda ? ` <span class="bom-ikincil">· ${m.hurda} hurda dahil</span>` : ''}
      ${m.eksik.length ? ` <span style="color:var(--warn)" title="${esc(m.eksik.join('\n'))}">⚠ ${m.eksik.length} eksik</span>` : ''}
      <button type="button" class="btn-ghost" style="padding:2px 10px;font-size:11px;margin-left:6px" onclick="event.stopPropagation(); maliyetDokumAc('${escJs(x.talep || x.uKodu)}')">Döküm</button>`;
  }
  return `<div class="bom-satir"><span class="bom-et">Maliyet</span><span class="bom-deger">${deger}</span></div>`;
}
function maliyetDokumAc(anahtar){
  maliyetDokum = (bomRotaListesi() || []).find(x => (x.talep || x.uKodu) === anahtar) || null;
  render();
}
function renderMaliyetDokum(){
  const x = maliyetDokum; if(!x) return '';
  const m = maliyetHesapla(x);
  if(!m) return '';
  const satir = (ad, deger, alt) => `<tr><td>${ad}</td><td style="text-align:right;white-space:nowrap"><b>${mlTL(deger)}</b></td><td style="font-size:11.5px;color:var(--text-muted)">${alt || ''}</td></tr>`;
  const yuzde = v => m.toplam ? ' · %' + mlFmt(v / m.toplam * 100, 0) : '';
  return `<div class="modal-overlay" onclick="if(event.target===this){maliyetDokum=null; render();}">
    <div class="modal-box kal-modal" style="max-width:720px">
      <div class="kal-modal-bas"><div class="sec-h" style="margin-top:0">Maliyet — <span class="mono">${esc(x.uKodu)}</span>${x.talep ? ' · iş emri ' + esc(x.talep) : ''}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:-4px">${esc(x.mamulAdi || '')} · bitiş ${fmtDT(x.finishedAt)} · kur 1 $ = ${mlFmt(m.kur.usd, 2)} ₺, 1 € = ${mlFmt(m.kur.eur, 2)} ₺ (${m.kur.kaynak === 'ECB' ? 'ECB ' + esc(m.kur.tarih) : 'elle'})</div></div>
      <div class="kal-modal-govde">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px">
          <div><div class="bom-kpi-deger">${mlTL(m.toplam)}</div><div class="bom-kpi-etiket">toplam</div></div>
          <div><div class="bom-kpi-deger">${m.birim != null ? mlTL(m.birim) : '—'}</div><div class="bom-kpi-etiket">adet başı (${m.saglam || m.adet} sağlam${m.hurda ? ', ' + m.hurda + ' hurda' : ''})</div></div>
          <div><div class="bom-kpi-deger">${m.birim != null && m.kur.eur ? mlFmt(m.birim / m.kur.eur, 2) + ' €' : '—'}</div><div class="bom-kpi-etiket">adet başı €</div></div>
        </div>
        <table class="tbl"><tbody>
          ${satir('İşçilik', m.iscilik, mlFmt(m.toplamDk, 0) + ' dk · ' + (m.yontem === 'kisi' ? 'kişi bazlı' : 'bölüm ortalaması') + yuzde(m.iscilik))}
          ${satir('Elektrik', m.elektrik, yuzde(m.elektrik))}
          ${satir('Amortisman', m.amort, yuzde(m.amort))}
          ${satir('Sarf', m.sarf, mlFmt(m.toplamDk, 0) + ' dk × ortalama' + yuzde(m.sarf))}
          ${satir('Genel gider', m.genelGider, '%' + mlFmt(m.genelGiderYuzde, 1) + ' işçilik üzerine' + yuzde(m.genelGider))}
          ${satir('Çelik', m.celik.tutar, (m.celik.kg ? mlFmt(m.celik.kg, 2) + ' kg' : 'kg yok') + (m.celik.tur ? ' · ' + esc(m.celik.tur) : '') + (m.celik.aciklama ? ' · ' + esc(m.celik.aciklama) : '') + yuzde(m.celik.tutar))}
          ${satir('Karbür', m.karbur.tutar, (m.karbur.kg ? mlFmt(m.karbur.kg, 3) + ' kg · ' + m.karbur.satir.map(s => esc(s.kod) + ' ' + mlFmt(s.mm, 0) + ' mm').join(', ') : '—') + yuzde(m.karbur.tutar))}
          ${m.isil.tutar || m.ops.some(o => o.kod === 'FII01') ? satir('Isıl işlem (fason)', m.isil.tutar, esc(m.isil.aciklama) + yuzde(m.isil.tutar)) : ''}
          ${m.hurda ? `<tr><td colspan="3" style="font-size:12px;color:var(--warn)">Hurda payı ≈ ${mlTL(m.hurdaPayi)} (${m.hurda} adet) — toplama dahil, adet başı sağlam parçaya bölündü</td></tr>` : ''}
        </tbody></table>
        <div class="bom-dal-bas">Operasyonlar</div>
        <table class="tbl" style="font-size:12px"><thead><tr><th>Makine</th><th>Grup</th><th>Dal</th><th style="text-align:right">Net dk</th><th style="text-align:right">İşçilik</th><th style="text-align:right">Elektrik</th><th style="text-align:right">Amort.</th><th>Operatör</th></tr></thead><tbody>
          ${m.ops.map(o => `<tr><td class="mono">${esc(o.kod)}</td><td>${o.grup ? esc(o.grup) : '<span style="color:var(--text-muted)">grupsuz</span>'}</td><td>${esc(o.dal === 'ANA' ? '' : '_' + o.dal)}</td>
            <td style="text-align:right">${mlFmt(o.dk, 0)}${o.pay > 1 ? ` <span style="color:var(--text-muted)" title="Çoklu iş emri: süre ${o.pay} iş emrine bölündü">÷${o.pay}</span>` : ''}</td>
            <td style="text-align:right">${mlTL(o.iscilik)}${o.kisiUcret ? ' <span title="kişi ücreti">👤</span>' : ''}</td><td style="text-align:right">${mlTL(o.elektrik)}</td><td style="text-align:right">${mlTL(o.amort)}</td><td>${esc(o.operator)}</td></tr>`).join('')}
        </tbody></table>
        ${m.eksik.length ? `<div style="margin-top:10px;font-size:12px;color:var(--warn)"><b>Eksik / tahmini:</b><br>${m.eksik.map(esc).join('<br>')}</div>` : ''}
      </div>
      <div class="kal-modal-alt"><button class="btn-ghost" style="flex:1" onclick="maliyetDokum=null; render()">Kapat</button></div>
    </div></div>`;
}
