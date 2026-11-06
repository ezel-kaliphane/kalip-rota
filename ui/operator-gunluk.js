/* ==================== ANALİZ → OPERATÖR GÜNLÜĞÜ (06.11.2026, kullanıcı isteği) ====================
   "Her operatörün hangi gün ne kadar çalıştığını, kaç adet iş yaptığını, işe kaçta başladığını görmek
   istiyorum; bir işin rotası gibi olabilir." Her (operatör, gün) bir satır: üstte özet (başladı → bıraktı,
   net çalışma, iş / biten, adet, duruş, verim), altında o günün işleri ROTA gibi soldan sağa zincir —
   her kutu bir kayıt (saat, makine, iş emri, mamul, adet, süre, bitti/devam), aralarda boşluk süresi.
   İki bakış: Güne göre (o gün herkes) / Kişiye göre (bir kişinin son 7–30 günü).
   Rakamlar Kişi Bazlı / Operatör Analizi ile AYNI kaynaktan (computeAnalizData → perOperator.days):
   aynı kişi-gün için iki ekranda iki farklı süre görünmesin. Yeni veri yazılmaz, kural değişmez. */
let ogMod = 'gun';                 // 'gun' | 'kisi'
let ogTarih = null;                // gün modu: 'YYYY-MM-DD' (null = bugün)
let ogKisi = null;                 // kişi modu: operatorUsername
let ogDonem = 7;                   // kişi modu: 7 | 30 gün
let ogArama = '';
const OG_BOSLUK_DK = 10;           // iki iş arasında bundan uzun boşluk zincirde yazılır

function ogSetMod(m){ ogMod = m; render(); }
function ogSetTarih(t){ ogTarih = t || null; render(); }
function ogGunKaydir(n){ const d = new Date((ogTarih || dateKey(Date.now())) + 'T12:00:00'); d.setDate(d.getDate() + n); const k = dateKey(d.getTime()); ogTarih = k > dateKey(Date.now()) ? null : k; render(); }
function ogKisiSec(u){ ogKisi = u; ogMod = 'kisi'; render(); }
function ogGunSec(t){ ogTarih = t; ogMod = 'gun'; render(); }
function ogSetDonem(n){ ogDonem = n; render(); }
function ogSetArama(v){ ogArama = v; render(); setTimeout(() => { const el = document.getElementById('og-arama'); if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0); }

function ogSaat(ts){ return ts ? new Date(ts).toTimeString().slice(0, 5) : '—'; }
function ogTarihYazi(dk, kisa){
  const d = new Date(dk + 'T12:00:00');
  return d.toLocaleDateString('tr-TR', kisa ? { day: 'numeric', month: 'short', weekday: 'short' } : { day: 'numeric', month: 'long', weekday: 'long' });
}
function ogAdetYazi(n){ return Number(n || 0).toLocaleString('tr-TR'); }

/* Bir (operatör, gün) için işler — gün penceresindeki kendi payıyla, başlama sırasına göre */
function ogGunAdimlari(gun){
  const d0 = new Date(gun.tarih + 'T00:00:00').getTime(), gunSonu = d0 + 864e5, d1 = Math.min(gunSonu, nowTick);
  const adimlar = (gun.entries || []).map(e => {
    const bitis = entryGercekBitis(e);
    const acik = e.status === 'devam' || e.status === 'duruş';
    const bitti = e.status === 'tamamlandi' && bitis > d0 && bitis <= gunSonu;
    /* Kutudaki saat o gün GERÇEKTEN çalışılan aralık: Gün Sonu'ndan 07:58'de devam eden iş 00:00 değil 07:58,
       ertesi güne süren iş 24:00 değil son çalışma saati. O gün hiç çalışılmadıysa (bütün gün duruşta) pencere. */
    const ara = entryNetAraliklar(e, d0, d1), calisti = ara.length > 0;
    const bas = calisti ? ara[0][0] : Math.max(e.startTs, d0), bit = calisti ? ara[ara.length - 1][1] : Math.min(bitis, d1);
    return { e, bas, bit, calisti, geceye: bit >= gunSonu - 6e4,
      netMin: Math.round(araliklarToplam(ara) / 6e4),
      durusMin: Math.round(entryDurusPencere(e, d0, d1) / 6e4),
      adet: Number(e.adet) || 0, bitti, acik: acik && d1 === nowTick,
      dunden: e.startTs < d0, surdu: bitis > gunSonu, tadilat: !!e._isTadilat };
  }).sort((a, b) => a.bas - b.bas || a.bit - b.bit);
  let enGec = null;
  adimlar.forEach(a => {
    a.boslukMin = enGec == null || !a.calisti ? 0 : Math.round((a.bas - enGec) / 6e4);
    a.paralel = a.calisti && enGec != null && a.bas < enGec - 6e4;
    if(a.calisti) enGec = enGec == null ? a.bit : Math.max(enGec, a.bit);
  });
  return adimlar;
}
/* "İşe kaçta başladı / kaçta bıraktı" OPERATÖRÜN hareketi: gece yarısından taşan çalışma (Gün Sonu'na
   alınmadan açık kalan ya da gece kendi çalışan erozyon/CNC) 00:00'da "başladı" saydırmasın; gün sonuna
   kadar süren iş de "bıraktı"yı 24:00 yapmasın — onun yerine "gece devam" yazılır. */
function ogGunOzeti(gun){
  const adimlar = ogGunAdimlari(gun);
  const biten = adimlar.filter(a => a.bitti);
  const d0 = new Date(gun.tarih + 'T00:00:00').getTime(), gunSonu = d0 + 864e5, d1 = Math.min(gunSonu, nowTick);
  const ara = adimlar.flatMap(a => entryNetAraliklar(a.e, d0, d1));
  const basla = ara.map(x => x[0]).filter(t => t > d0 + 6e4), birak = ara.map(x => x[1]).filter(t => t < gunSonu - 6e4);
  const geldi = basla.length ? Math.min(...basla) : null;
  const geceDevam = d1 === gunSonu && ara.some(x => x[1] >= gunSonu - 6e4);
  return { adimlar, isSayisi: adimlar.length, bitenSayisi: biten.length, bitenAdet: biten.reduce((t, a) => t + a.adet, 0),
    geldi, gitti: birak.length ? Math.max(...birak) : null, geceDevam,
    gecDk: gun.haftaIci && geldi ? Math.round((geldi - (d0 + VARDIYA_BAS_DK * 6e4)) / 6e4) : 0,
    simdiCalisiyor: adimlar.some(a => a.acik && a.e.status === 'devam') };
}

function ogAdimHtml(a){
  const e = a.e, kod = String(e.makine || '').split(' · ')[0] || '—';
  const no = e._isTadilat ? (e.isEmriNo || '') : (e.talepNo || e.isEmriNo || '');
  const ad = e._isTadilat ? (e.aciklama || 'Tadilat') : (typeof isEmriMamulAdi === 'function' ? isEmriMamulAdi(e.talepNo, e.isEmriNo) : '');
  const durum = a.bitti ? `<span class="og-durum bitti">${ico('check', 11)} bitti</span>`
    : a.acik ? `<span class="og-durum acik">${e.status === 'duruş' ? 'duruşta' : 'devam ediyor'}</span>`
    : a.surdu ? `<span class="og-durum surdu">ertesi güne sürdü</span>`
    : e.status === 'tamamlandi' ? '' : `<span class="og-durum surdu">açık</span>`;
  /* Kutuya basınca detay (06.11.2026, kullanıcı): tadilatta mevcut akış penceresi (kim ne zaman açtı → kim ne zaman
     başladı → bitti), üretimde İş Yoğunluğu'ndaki iş emri geçmişi penceresi — ikisi de hazır, aynısı açılıyor. */
  const git = e._isTadilat ? (e._tadilatId ? `onclick="openTadilatAkis('${escJs(e._tadilatId)}')" title="Tadilat akışı: kim açtı, kim ne zaman başladı"` : '')
    : (e.isEmriNo || e.talepNo) ? `onclick="openIyGecmisModal('${escJs(e.isEmriNo || '')}','${escJs(e.talepNo || '')}')" title="İş emrinin geçmişi: hangi makinede kim ne zaman"` : '';
  return `<div class="og-adim${a.bitti ? ' bitti' : ''}${a.acik ? ' acik' : ''}${a.tadilat ? ' tadilat' : ''}${git ? ' tik' : ''}" ${git}>
    <div class="og-adim-ust"><span class="mono">${a.dunden ? '<span title="önceki günden devam">↩</span> ' : ''}${a.calisti ? `${ogSaat(a.bas)}–${a.acik ? 'şimdi' : a.geceye ? 'gece' : ogSaat(a.bit)}` : 'çalışılmadı'}</span><span class="og-mak mono">${esc(kod)}</span></div>
    <div class="og-adim-no mono">${a.tadilat ? '<span class="og-tad">TADİLAT</span> ' : ''}${esc(no || '—')}</div>
    ${ad ? `<div class="og-adim-ad" title="${esc(ad)}">${esc(ad)}</div>` : ''}
    <div class="og-adim-alt">${a.adet ? `<b>${ogAdetYazi(a.adet)} adet</b> · ` : ''}${fmtDur(a.netMin * 6e4)}${a.durusMin > 0 ? ` <span class="og-durus">· duruş ${fmtDur(a.durusMin * 6e4)}</span>` : ''}</div>
    ${durum ? `<div class="og-adim-durum">${durum}</div>` : ''}
  </div>`;
}
function ogRotaHtml(oz, gun){
  const ok = '<span class="og-ok" aria-hidden="true">→</span>';
  const parcalar = [oz.geldi ? `<div class="og-uc mono" title="Gün içindeki ilk başlatma / devam">${ico('play', 11)} ${ogSaat(oz.geldi)}</div>` : `<div class="og-uc mono" title="Bu gün yeni başlatma yok — önceki günden süren iş">↩ önceki günden</div>`];
  oz.adimlar.forEach(a => {
    parcalar.push(a.boslukMin >= OG_BOSLUK_DK ? `<span class="og-ok bosluk" title="İki iş arasında hiçbir kayıt yok (öğle arası dahil)">→<small>${fmtDur(a.boslukMin * 6e4)} ara</small></span>`
      : a.paralel ? `<span class="og-ok paralel" title="Önceki iş sürerken başladı — aynı anda iki makine">⇉<small>paralel</small></span>` : ok);
    parcalar.push(ogAdimHtml(a));
  });
  parcalar.push(ok, oz.simdiCalisiyor ? `<div class="og-uc acik mono">şu an çalışıyor</div>`
    : oz.geceDevam ? `<div class="og-uc mono" title="Bir iş gece yarısından sonra da çalışmaya devam etti (Gün Sonu'na alınmadı ya da makine gece çalıştı)">${oz.gitti ? `${ico('stop', 11)} ${ogSaat(oz.gitti)} · ` : ''}gece devam</div>`
    : `<div class="og-uc mono" title="Son çalışma">${ico('stop', 11)} ${ogSaat(oz.gitti)}</div>`);
  return `<div class="og-rota">${parcalar.join('')}</div>`;
}
function ogSatirHtml(baslik, gun){
  const oz = ogGunOzeti(gun);
  const vRenk = gun.verimlilik >= 70 ? 'var(--success)' : gun.verimlilik >= 40 ? 'var(--warn)' : 'var(--danger)';
  const bilgi = [
    `<span class="mono"><b>${oz.geldi ? ogSaat(oz.geldi) : '↩'}</b> → <b>${oz.simdiCalisiyor ? 'şimdi' : oz.gitti ? ogSaat(oz.gitti) : '—'}</b>${oz.geceDevam && !oz.simdiCalisiyor ? ' <span class="og-not">+ gece</span>' : ''}</span>${oz.gecDk > 15 ? ` <span class="og-gec" title="Vardiya 08:00'de başlıyor">${oz.gecDk} dk geç</span>` : ''}${gun.haftaIci ? '' : ' <span class="og-not">hafta sonu</span>'}`,
    `net <b>${fmtDur(gun.workMin * 6e4)}</b>`,
    `<b>${oz.isSayisi}</b> iş${oz.bitenSayisi ? ` (${oz.bitenSayisi} bitti)` : ''}`,
    oz.bitenAdet ? `<b>${ogAdetYazi(oz.bitenAdet)}</b> adet bitti` : '',
    gun.durusMin > 0 ? `<span style="color:var(--warn)">duruş ${fmtDur(gun.durusMin * 6e4)}</span>` : '',
    gun.overtimeMin > 0 ? `<span style="color:var(--danger)">fazla mesai ${fmtDur(gun.overtimeMin * 6e4)}</span>` : '',
    gun.haftaIci ? `verim <b style="color:${vRenk}">%${gun.verimlilik || 0}</b>` : ''
  ].filter(Boolean).map(x => `<span>${x}</span>`).join('<span class="og-nokta">·</span>');
  return `<div class="analiz-chart-box og-satir">
    <div class="og-satir-ust">${baslik}<div class="og-bilgi">${bilgi}${gun.hasPhysicalAnomaly ? ` <span style="color:var(--danger)" title="20 saatten uzun kesintisiz çalışan bir kayıt var — muhtemelen kapatılmamış">${ico('alert', 13)}</span>` : ''}</div></div>
    ${ogRotaHtml(oz, gun)}
  </div>`;
}

function renderOperatorGunlugu(){
  const bugun = dateKey(Date.now());
  const modlar = `<div style="display:flex;gap:6px;flex-wrap:wrap">
    ${[['gun', 'Güne göre'], ['kisi', 'Kişiye göre']].map(([k, l]) => `<button class="chip ${ogMod === k ? 'active' : ''}" onclick="ogSetMod('${k}')">${l}</button>`).join('')}
  </div>`;
  let h = '';
  if(ogMod === 'gun'){
    const tarih = ogTarih || bugun;
    const data = computeAnalizData(tarih, tarih, 'tumu');
    const satirlar = data.perOperator.map(op => ({ op, gun: op.days.find(d => d.tarih === tarih) })).filter(x => x.gun);
    const q = ogArama.trim().toLocaleLowerCase('tr-TR');
    const ozler = satirlar.map(x => ({ ...x, oz: ogGunOzeti(x.gun) }));
    const gorunen = ozler.filter(({ op }) => !q || `${op.operatorName || ''} ${op.operatorUsername || ''}`.toLocaleLowerCase('tr-TR').includes(q))
      .sort((a, b) => (a.oz.geldi || Infinity) - (b.oz.geldi || Infinity));
    const ilk = ozler.filter(x => x.oz.geldi).sort((a, b) => a.oz.geldi - b.oz.geldi)[0];
    const son = ozler.filter(x => x.oz.gitti).sort((a, b) => b.oz.gitti - a.oz.gitti)[0];
    const bitenIs = ozler.reduce((t, x) => t + x.oz.bitenSayisi, 0), bitenAdet = ozler.reduce((t, x) => t + x.oz.bitenAdet, 0);
    const ad = op => esc(op.operatorName || op.operatorUsername);
    const cumle = !satirlar.length ? `${ogTarihYazi(tarih)}: kayıt yok.`
      : `${ogTarihYazi(tarih)}: <b>${satirlar.length}</b> operatör çalıştı.${ilk ? ` İlk başlayan ${ad(ilk.op)} (<b>${ogSaat(ilk.oz.geldi)}</b>)${tarih === bugun || !son ? '' : `, en son bırakan ${ad(son.op)} (<b>${ogSaat(son.oz.gitti)}</b>)`}.` : ''} ${bitenIs ? `<b>${bitenIs}</b> iş bitti, toplam <b>${ogAdetYazi(bitenAdet)}</b> adet.` : 'Henüz biten iş yok.'}`;
    h += `<div class="og-arac">
      ${modlar}
      <div class="og-gun-sec">
        <button class="btn-ghost mb-mini" onclick="ogGunKaydir(-1)" title="Önceki gün">‹</button>
        <input type="date" value="${esc(tarih)}" max="${esc(bugun)}" onchange="ogSetTarih(this.value)">
        <button class="btn-ghost mb-mini" onclick="ogGunKaydir(1)" title="Sonraki gün" ${tarih >= bugun ? 'disabled' : ''}>›</button>
        ${tarih !== bugun ? `<button class="btn-ghost mb-mini" onclick="ogSetTarih(null)">Bugün</button>` : ''}
      </div>
      <input id="og-arama" type="text" class="og-arama" placeholder="Operatör ara…" value="${esc(ogArama)}" oninput="ogSetArama(this.value)">
    </div>
    <div class="og-cumle">${cumle}</div>
    ${gorunen.map(({ op, gun }) => ogSatirHtml(`<button type="button" class="og-kim" onclick="ogKisiSec('${escJs(op.operatorUsername)}')" title="Bu kişinin son günlerini gör"><b>${ad(op)}</b><span class="mono">${esc(op.operatorUsername || '')}</span></button>`, gun)).join('')
      || (satirlar.length ? `<div class="og-bos">Aramaya uyan operatör yok.</div>` : `<div class="og-bos">Bu gün kayıt yok.</div>`)}`;
  } else {
    const bas = new Date(); bas.setHours(12, 0, 0, 0); bas.setDate(bas.getDate() - (ogDonem - 1));
    const data = computeAnalizData(dateKey(bas.getTime()), bugun, 'tumu');
    const kisiler = data.perOperator.slice().sort((a, b) => String(a.operatorName || a.operatorUsername).localeCompare(String(b.operatorName || b.operatorUsername), 'tr'));
    if(!ogKisi || !kisiler.some(o => o.operatorUsername === ogKisi)) ogKisi = kisiler[0] ? kisiler[0].operatorUsername : null;
    const op = kisiler.find(o => o.operatorUsername === ogKisi);
    h += `<div class="og-arac">
      ${modlar}
      <select onchange="ogKisi=this.value; render()" class="og-kisi-sec">${kisiler.map(o => `<option value="${esc(o.operatorUsername)}" ${o.operatorUsername === ogKisi ? 'selected' : ''}>${esc(o.operatorName || o.operatorUsername)}</option>`).join('')}</select>
      <div style="display:flex;gap:6px">${[[7, 'Son 7 gün'], [30, 'Son 30 gün']].map(([n, l]) => `<button class="chip ${ogDonem === n ? 'active' : ''}" onclick="ogSetDonem(${n})">${l}</button>`).join('')}</div>
    </div>`;
    if(!op){
      h += `<div class="og-bos">Bu dönemde kayıt yok.</div>`;
    } else {
      const gunler = op.days.slice().sort((a, b) => b.tarih.localeCompare(a.tarih));
      const ozler = gunler.map(g => ogGunOzeti(g));
      const haftaIci = gunler.map((g, i) => ({ g, oz: ozler[i] })).filter(x => x.g.haftaIci && x.oz.geldi);
      const ortBas = haftaIci.length ? haftaIci.reduce((t, x) => t + (x.oz.geldi - new Date(x.g.tarih + 'T00:00:00').getTime()), 0) / haftaIci.length : null;
      const ortSaat = ortBas == null ? '' : `${String(Math.floor(ortBas / 36e5)).padStart(2, '0')}:${String(Math.round(ortBas % 36e5 / 6e4)).padStart(2, '0')}`;
      const bitenIs = ozler.reduce((t, o) => t + o.bitenSayisi, 0), bitenAdet = ozler.reduce((t, o) => t + o.bitenAdet, 0);
      const gelinen = ozler.filter(o => o.geldi).length;   // operatörün o gün kendisi başlattığı/devam ettirdiği bir iş var
      h += `<div class="og-cumle"><b>${esc(op.operatorName || op.operatorUsername)}</b> son ${ogDonem} günde <b>${gelinen}</b> gün işe geldi${gunler.length > gelinen ? ` (${gunler.length - gelinen} gün yalnız önceki günden süren iş var)` : ''}; günde ortalama <b>${fmtDur(op.workMin / Math.max(1, gelinen) * 6e4)}</b> net${ortSaat ? `, hafta içi ortalama başlama <b>${ortSaat}</b>` : ''}. ${bitenIs ? `<b>${bitenIs}</b> iş bitirdi, toplam <b>${ogAdetYazi(bitenAdet)}</b> adet.` : 'Biten iş yok.'}</div>
      ${gunler.map(g => ogSatirHtml(`<button type="button" class="og-kim" onclick="ogGunSec('${g.tarih}')" title="O gün herkesi gör"><b>${esc(ogTarihYazi(g.tarih))}</b></button>`, g)).join('')}`;
    }
  }
  return `<div class="og-wrap">${h}</div>` + (typeof iyGecmisModalIsEmriNo !== 'undefined' && iyGecmisModalIsEmriNo ? renderIyGecmisModal() : '');
}
