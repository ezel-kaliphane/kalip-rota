/* ==================== KARBÜR STOK & FİRE — GÖRÜNÜM / YÖNETİM (19.10.2026, kullanıcı: "aynı şeyleri karbür için de yap") ====================
   Takım & Sarf / Hammadde ile aynı düzen (ortak parçalar ui/stok-tablo.js: stYonetimMi, stModSecici, stChip, stPill).
   Kesim kalemleri DIŞ ÇAPA göre gruplu (kesim planı da çapa göre arar), adet kalemleri ve fire havuzu ayrı bölüm.
   Görünüm herkese yalnız okuma; Yönetim (SuperAdmin) panelde sayım / alt limit / kullanım, fire sayımı, yeni kalem
   ve fire ekleme. Kaydetme eskisiyle aynı fonksiyonlar: karburSayimSet, karburSetAltLimit, karburSetKullanim,
   karburFireSet, karburKatalogEkle, karburFireEkle. Arama karburDurumAra / karburDurumEslesir (ui/karbur-ui.js). */
let krbDurumFiltre = '', krbKaliteFiltre = '', krbSecili = null, krbHareketler = {};
const krbAcikCaplar = new Set();
function krbDurum(k){ const s = karburStokAdet(k.id); return s <= 0 ? 'yok' : (Number(k.altLimit) > 0 && s <= Number(k.altLimit)) ? 'kritik' : 'ok'; }
function krbSec(tip, id){
  krbSecili = krbSecili && krbSecili.id === id ? null : { tip, id };
  if(krbSecili && tip === 'k' && !krbHareketler[id]){
    krbHareketler[id] = { yukleniyor: true, liste: [] };
    DB.ref('karburHareketleri').orderByChild('katalogId').equalTo(id).limitToLast(6).once('value').then(s => {
      krbHareketler[id] = { yukleniyor: false, liste: Object.values(s.val() || {}).filter(h => !h.iptalTs).sort((a, b) => (b.ts || 0) - (a.ts || 0)) };
      safeRender();
    }).catch(() => { krbHareketler[id] = { yukleniyor: false, liste: [] }; safeRender(); });
  }
  render();
}
function krbKapat(){ krbSecili = null; render(); }
function krbCapToggle(c){ if(krbAcikCaplar.has(c)) krbAcikCaplar.delete(c); else krbAcikCaplar.add(c); render(); }
function krbHepsiniAcKapat(caplar){
  if(caplar.every(c => krbAcikCaplar.has(c))) krbAcikCaplar.clear(); else caplar.forEach(c => krbAcikCaplar.add(c));
  render();
}
const KRB_TIP_AD = { kesim: 'Kesim', adet_cikis: 'Adet çıkış', kesimsiz: 'Kesimsiz', fire_kullanim: 'Fireden', giris: 'Giriş', sayim: 'Sayım' };

function renderKarburTablo(){
  const yon = stYonetimMi();
  const tumKesim = karburKesimKalemleri(), tumAdet = karburAdetKalemleri(), fireler = karburFireArray();
  const tum = tumKesim.concat(tumAdet);
  const uy = k => karburDurumEslesir(k) && (!krbDurumFiltre || krbDurum(k) === krbDurumFiltre) && (!krbKaliteFiltre || k.kalite === krbKaliteFiltre);
  const kesim = tumKesim.filter(uy), adet = tumAdet.filter(uy);
  const q = String(karburDurumAra || '').trim();
  const hepsiAcik = !!(q || krbDurumFiltre || krbKaliteFiltre);
  const say = d => tum.filter(k => krbDurum(k) === d).length;
  const kaliteSay = {}; tum.forEach(k => { if(k.kalite) kaliteSay[k.kalite] = (kaliteSay[k.kalite] || 0) + 1; });
  const ustKalite = Object.entries(kaliteSay).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const secK = krbSecili && krbSecili.tip === 'k' ? tum.find(k => k.id === krbSecili.id) : null;
  const secF = krbSecili && krbSecili.tip === 'f' ? fireler.find(f => f.id === krbSecili.id) : null;
  const pill = k => { const d = krbDurum(k); return stPill(d, karburStokAdet(k.id), d === 'yok' ? 'yok' : d === 'kritik' ? 'kritik' : 'adet'); };
  const secSinif = id => krbSecili && krbSecili.id === id ? (yon ? 'sec yon' : 'sec') : '';
  const aciklama = t => `<span class="st-soluk" style="font-weight:500;letter-spacing:0">${t}</span>`;

  const kesimSatir = k => `<tr class="st-tr ${secSinif(k.id)}" onclick="krbSec('k','${escJs(k.id)}')">
      <td class="mono st-olcu">${esc(k.kod)}</td><td class="mono">${esc(k.delik)}</td><td class="mono">${esc(k.kalite)}</td>
      <td class="st-sag mono">${karburFmt(k.boy)} mm</td><td class="st-soluk" style="font-size:12.5px">${k.tur === 'cubuk' ? 'çubuk' : 'hazır parça'}</td>
      <td class="st-sag">${pill(k)}</td><td class="st-sag mono st-soluk">${Number(k.altLimit) > 0 ? k.altLimit : '—'}</td></tr>`;
  const caplar = {};
  kesim.forEach(k => { (caplar[k.disCap] ||= []).push(k); });
  const capSirali = Object.entries(caplar).sort((a, b) => Number(a[0]) - Number(b[0]));
  const capGrup = ([c, list]) => {
    const acik = hepsiAcik || krbAcikCaplar.has(c);
    const yok = list.filter(k => krbDurum(k) === 'yok').length, kritik = list.filter(k => krbDurum(k) === 'kritik').length;
    const toplam = list.reduce((t, k) => t + karburStokAdet(k.id), 0);
    return `<div class="st-grup">
      <button type="button" class="st-grup-bas" aria-expanded="${acik}" onclick="krbCapToggle('${escJs(c)}')">
        <span class="st-ok ${acik ? 'acik' : ''}">${ico('chevronRight', 14)}</span>
        <span class="st-kalite mono">Ø${karburFmt(Number(c))}</span>
        <span class="st-soluk">${list.length} kalem · toplam ${toplam} adet</span>
        <span class="st-rozetler">${yok ? `<span class="st-rz eksi">${yok} stokta yok</span>` : ''}${kritik ? `<span class="st-rz kritik">${kritik} kritik</span>` : ''}</span>
      </button>
      ${acik ? `<div class="st-tablo-kutu ic"><table class="st-tablo"><thead><tr><th>STOK KODU</th><th>DELİK</th><th>KALİTE</th><th class="st-sag">BOY</th><th>TÜR</th><th class="st-sag">STOK</th><th class="st-sag">ALT LİMİT</th></tr></thead><tbody>${list.map(kesimSatir).join('')}</tbody></table></div>` : ''}
    </div>`;
  };
  const capAnahtarlari = capSirali.map(([c]) => c);
  const hepsiAcikMi = capAnahtarlari.length && capAnahtarlari.every(c => krbAcikCaplar.has(c));

  const liste = `<section class="st-liste">
    <div class="st-ust"><div class="st-ara">${ico('search', 16)}<input id="karbur-durum-ara" placeholder="Ara — kod, çap, kalite · ör. 15 va90 · ST7 · 156" value="${esc(karburDurumAra)}" oninput="karburDurumAra=this.value; render()" onkeydown="if(event.key==='Escape'){ karburDurumAra=''; render(); }"><span class="mono">${kesim.length + adet.length} / ${tum.length}</span></div></div>
    <div class="st-filtre"><span class="st-fl">DURUM</span>
      ${stChip(!krbDurumFiltre, 'Tümü', tum.length, "krbDurumFiltre=''; render()")}
      ${stChip(krbDurumFiltre === 'kritik', 'Kritik', say('kritik'), "krbDurumFiltre='kritik'; render()", 'var(--warn)')}
      ${stChip(krbDurumFiltre === 'yok', 'Stokta yok', say('yok'), "krbDurumFiltre='yok'; render()", 'var(--danger)')}
    </div>
    <div class="st-filtre"><span class="st-fl">KALİTE</span>
      ${stChip(!krbKaliteFiltre, 'Hepsi', '', "krbKaliteFiltre=''; render()")}
      ${ustKalite.map(([k, n]) => stChip(krbKaliteFiltre === k, k, n, `krbKaliteFiltre='${escJs(k)}'; render()`)).join('')}
      ${!hepsiAcik && capAnahtarlari.length ? `<button type="button" class="btn-ghost st-kucuk" onclick="krbHepsiniAcKapat(${esc(JSON.stringify(capAnahtarlari))})">${hepsiAcikMi ? 'Hepsini kapat' : 'Hepsini aç'}</button>` : ''}
    </div>

    <div class="st-bolum st-bolum-buyuk">KESİM PLANINA GİRENLER · ${kesim.length} kalem ${aciklama(`— boyu ${KARBUR_CUBUK_MIN} mm ve üzeri çubuk (kesilir), kısası hazır parça`)}</div>
    <div class="st-gruplar">${capSirali.length ? capSirali.map(capGrup).join('') : `<div class="st-bos">${q ? 'Aramayla eşleşen kalem yok.' : 'Filtreye uyan kalem yok.'}</div>`}</div>

    <div class="st-bolum st-bolum-buyuk">ADET OLARAK TÜKETİLENLER · ${adet.length} kalem ${aciklama('— kesim planına girmez, doğrudan adet düşülür')}</div>
    <div class="st-tablo-kutu"><table class="st-tablo"><thead><tr><th>STOK KODU</th><th>ÖLÇÜLER</th><th>KALİTE</th><th class="st-sag">STOK</th><th class="st-sag">ALT LİMİT</th></tr></thead><tbody>
      ${adet.length ? adet.map(k => `<tr class="st-tr ${secSinif(k.id)}" onclick="krbSec('k','${escJs(k.id)}')"><td class="mono st-olcu">${esc(k.kod)}</td><td class="mono st-soluk">${(k.alanlar || []).map(karburFmt).join(' × ') || '—'}</td><td class="mono">${esc(k.kalite || '')}</td><td class="st-sag">${pill(k)}</td><td class="st-sag mono st-soluk">${Number(k.altLimit) > 0 ? k.altLimit : '—'}</td></tr>`).join('')
        : `<tr><td colspan="5" class="st-bos">${hepsiAcik ? 'Filtreye uyan kalem yok.' : 'Kayıt yok.'}</td></tr>`}
    </tbody></table></div>

    <div class="st-bolum st-bolum-buyuk">FİRE HAVUZU · ${fireler.length} çeşit ${aciklama('— kesimde otomatik kullanılmaz, parça bazında seçilir')}</div>
    <div class="st-tablo-kutu"><table class="st-tablo"><thead><tr><th>DIŞ ÇAP</th><th>DELİK</th><th>KALİTE</th><th class="st-sag">KALAN BOY</th><th class="st-sag">ADET</th></tr></thead><tbody>
      ${fireler.length ? fireler.map(f => `<tr class="st-tr ${secSinif(f.id)}" onclick="krbSec('f','${escJs(f.id)}')"><td class="mono st-olcu">Ø${karburFmt(f.disCap)}</td><td class="mono">${esc(f.delik)}</td><td class="mono">${esc(f.kalite)}</td><td class="st-sag mono">${karburFmt(f.boy)} mm</td><td class="st-sag">${stPill('ok', Number(f.adet) || 0, 'adet')}</td></tr>`).join('')
        : '<tr><td colspan="5" class="st-bos">Havuz boş.</td></tr>'}
    </tbody></table></div>

    ${yon ? `<div class="st-tablo-kutu st-ekle">
      <div class="st-bolum" style="margin-top:0">YENİ KALEM EKLE</div>
      <div class="st-ekle-satir">
        <div class="field" style="width:230px"><label>Stok Kodu</label><input id="karbur-yeni-kod" placeholder="C18XH156X3XVA90"></div>
        <div class="field" style="width:96px"><label>Adet</label><input id="karbur-yeni-adet" placeholder="0"></div>
        <div class="field" style="width:96px"><label>Alt Limit</label><input id="karbur-yeni-alt-limit" placeholder="0"></div>
        <button type="button" class="btn-ghost st-kucuk" onclick="karburKatalogEkle()">+ Ekle</button>
      </div>
      <div class="st-soluk" style="font-size:11.5px">Önek serbest (C/V/S ya da hiç) · üç ölçülü kodlar kesime, diğerleri adete varsayılır</div>
      <div class="st-bolum">FİRE EKLE ${aciklama('— ilk kurulum / fiziksel sayım için')}</div>
      <div class="st-ekle-satir">
        <div class="field" style="width:96px"><label>Dış Çap</label><input id="karbur-fire-cap" placeholder="18"></div>
        <div class="field" style="width:88px"><label>Delik</label><input id="karbur-fire-delik" placeholder="3"></div>
        <div class="field" style="width:110px"><label>Kalite</label><input id="karbur-fire-kalite" placeholder="VA90"></div>
        <div class="field" style="width:96px"><label>Kalan Boy</label><input id="karbur-fire-boy" placeholder="61"></div>
        <div class="field" style="width:80px"><label>Adet</label><input id="karbur-fire-adet" placeholder="1"></div>
        <button type="button" class="btn-ghost st-kucuk" onclick="karburFireEkle()">+ Fire ekle</button>
      </div>
    </div>` : ''}
  </section>`;

  const alan = (et, html) => `<label class="st-alan"><span>${et}</span>${html}</label>`;
  const not = yon ? '<div class="st-not">Değişiklikler alandan çıkınca hemen kaydedilir.</div>'
    : '<div class="st-not">Bu ekranda hiçbir alan değiştirilemez. Stok ve kalem bilgisi SuperAdmin\'in Yönetim görünümünde düzenlenir.</div>';
  let panel = '';
  if(secK){
    const d = krbDurum(secK), s = karburStokAdet(secK.id), h = krbHareketler[secK.id] || { yukleniyor: true, liste: [] };
    const kesimMi = (secK.kullanim || 'kesim') === 'kesim', kesimOlur = secK.disCap > 0 && secK.boy > 0;
    const hareketler = h.liste.filter(x => x.adet != null);
    const olcu = kesimMi
      ? `Ø${karburFmt(secK.disCap)} · delik ${esc(secK.delik)} · ${esc(secK.kalite)} · ${karburFmt(secK.boy)} mm · ${secK.tur === 'cubuk' ? 'çubuk' : 'hazır parça'}`
      : `${(secK.alanlar || []).map(karburFmt).join(' × ')}${secK.kalite ? ' · ' + esc(secK.kalite) : ''} · adet olarak`;
    panel = `<aside class="st-panel ${yon ? 'yon' : ''}" aria-label="Karbür kalemi">
      <div class="st-panel-bas"><div>${yon ? '<div class="st-panel-etiket">DÜZENLE</div>' : ''}<div class="st-panel-ad mono">${esc(secK.kod)}</div><div class="st-alt">${olcu}</div></div>
        <button class="icon-btn" aria-label="Kapat" onclick="krbKapat()">${ico('x', 16)}</button></div>
      <div class="st-panel-ic">
        <div class="st-buyuk ${d}"><b>${s}</b><div><div class="st-buyuk-baslik">${d === 'yok' ? 'Stokta yok' : d === 'kritik' ? 'Kritik — alt limitte' : 'Stokta var'}</div><div>${Number(secK.altLimit) > 0 ? 'Alt limit ' + secK.altLimit + ' adet' : 'Alt limit tanımlı değil'}</div></div></div>
        ${yon ? `<div class="st-bolum">STOK SAYIMI</div>
          <div class="st-sayim"><span>Sayılan (adet)</span><b class="mono">${s}</b><input class="mono" inputmode="numeric" aria-label="Sayılan adet" placeholder="sayılan" value="" onkeydown="if(event.key==='Enter') this.blur()" onchange="if(this.value.trim()!=='') karburSayimSet('${escJs(secK.id)}',this.value)"></div>
          <div class="st-soluk" style="font-size:12px">Sayılan adedi yazıp Enter'a bas — fark "Sayım" olarak hareketlere yazılır.</div>
          <div class="st-bolum">KALEM BİLGİSİ</div>
          <div class="st-iki">
            ${alan('Alt limit', `<input class="mono" inputmode="numeric" value="${secK.altLimit || 0}" onchange="karburSetAltLimit('${escJs(secK.id)}',this.value)">`)}
            ${alan('Kullanım', `<select onchange="karburSetKullanim('${escJs(secK.id)}',this.value)"><option value="kesim" ${kesimMi ? 'selected' : ''} ${kesimOlur ? '' : 'disabled'}>Kesim planına girer</option><option value="adet" ${!kesimMi ? 'selected' : ''}>Adet olarak tüketilir</option></select>`)}
          </div>
          ${kesimOlur ? '' : '<div class="st-soluk" style="font-size:12px">Ölçüleri koddan okunamadığı için kesim planına alınamaz.</div>'}`
        : `<div class="st-bilgi"><span>Kullanım</span><b>${kesimMi ? 'Kesim planına girer' : 'Adet olarak tüketilir'}</b></div>`}
        <div class="st-bolum">SON HAREKETLER</div>
        ${h.yukleniyor ? '<div class="st-soluk">Yükleniyor…</div>' : !hareketler.length ? '<div class="st-soluk">Hareket yok.</div>'
          : `<div class="st-hareket">${hareketler.map(m => `<div><span class="${m.adet < 0 ? 'eksi' : 'arti'}">${m.adet > 0 ? '+' : ''}${m.adet}</span> ${esc(KRB_TIP_AD[m.tip] || m.tip || '')}${m.planNo ? ' · plan ' + esc(m.planNo) : ''}<div class="st-alt">${esc(m.operatorName || m.operatorUsername || '')} · ${fmtDT(m.ts)}${m.isEmriNo ? ' · ' + esc(m.isEmriNo) : ''}</div></div>`).join('')}</div>`}
        ${not}
      </div></aside>`;
  } else if(secF){
    panel = `<aside class="st-panel ${yon ? 'yon' : ''}" aria-label="Fire">
      <div class="st-panel-bas"><div>${yon ? '<div class="st-panel-etiket">DÜZENLE</div>' : ''}<div class="st-panel-ad">Fire · Ø${karburFmt(secF.disCap)} · ${karburFmt(secF.boy)} mm</div><div class="st-alt">delik ${esc(secF.delik)} · ${esc(secF.kalite)}</div></div>
        <button class="icon-btn" aria-label="Kapat" onclick="krbKapat()">${ico('x', 16)}</button></div>
      <div class="st-panel-ic">
        <div class="st-buyuk ok"><b>${Number(secF.adet) || 0}</b><div><div class="st-buyuk-baslik">havuzda</div><div>kalan boy ${karburFmt(secF.boy)} mm</div></div></div>
        ${yon ? `<div class="st-bolum">FİRE SAYIMI</div>
          <div class="st-sayim"><span>Sayılan (adet)</span><b class="mono">${Number(secF.adet) || 0}</b><input class="mono" inputmode="numeric" aria-label="Sayılan fire adedi" placeholder="sayılan" value="" onkeydown="if(event.key==='Enter') this.blur()" onchange="if(this.value.trim()!=='') karburFireSet('${escJs(secF.id)}',this.value)"></div>
          <div class="st-soluk" style="font-size:12px">0 yazılırsa fire havuzdan düşer.</div>` : ''}
        ${not}
      </div></aside>`;
  }
  return `<div class="st-bas"><div class="sec-h" style="margin:0">Karbür — Stok &amp; Fire</div>${stModSecici()}</div>
    <div class="st-govde">${liste}${panel}</div>`;
}
