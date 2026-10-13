/* ==================== FAVORİLER — HER SEÇİMDE (13.10.2026, kullanıcı: "sonraki operasyondaki
   favorileme hepsinde olsun") ====================
   Sıradaki operasyon seçicideki yıldızın (bkz. makineFavorileri, js/operations.js) aynısı diğer
   seçimlerde: Yeni Kayıt makinesi, tadilat makinesi, ilk operasyon hammaddesi, duruş nedeni,
   Takım Dolabı, FKK / uygunsuzluk nedeni. Yıldızlananlar listenin üstünde tek dokunuşluk çip olur.
   Kişiye özel. Makine favorileri ortak (sıradaki operasyonla aynı liste, favoriMakineler).
   Diğerleri: operators/{kod}/favoriler/{tip}/{anahtar} = değer (anahtar RTDB'ye uygun kodlanmış,
   değer asıl metin). Kural yayınlanmadan yazma reddedilir — o yüzden makinelerdeki gibi her zaman
   bu cihazda da (localStorage) tutulur; veritabanında yoksa oradan okunur. */
const FAV_IPUCU_GOSTER = true;

function favAnahtar(v){ return String(v).replace(/[.#$\[\]\/%]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); }
function favMakineKodu(v){ return String(v || '').split(' · ')[0].trim(); }

function favoriler(tip){
  if(tip === 'makine') return makineFavorileri();
  const u = session && session.username; if(!u) return [];
  const db = (((STATE.operators[u] || {}).favoriler) || {})[tip];
  if(db && typeof db === 'object'){ const l = Object.values(db).filter(v => typeof v === 'string' && v); if(l.length) return l; }
  try{ const l = JSON.parse(localStorage.getItem('favori:' + tip + ':' + u) || '[]'); return Array.isArray(l) ? l : []; }catch(e){ return []; }
}
function favoriMi(tip, v){
  if(v == null || v === '') return false;
  return favoriler(tip).includes(tip === 'makine' ? favMakineKodu(v) : String(v));
}
function favoriToggle(tip, v){
  const u = session && session.username; if(!u || v == null || v === '') return;
  if(tip === 'makine'){ makineFavoriToggle(favMakineKodu(v)); return; }   // kendi içinde yeniden çizer
  v = String(v);
  const fav = favoriler(tip).filter(x => x !== v), ekle = !favoriMi(tip, v);
  if(ekle) fav.push(v);
  try{ localStorage.setItem('favori:' + tip + ':' + u, JSON.stringify(fav)); }catch(e){}
  const op = STATE.operators[u];
  if(op){
    op.favoriler = op.favoriler || {};
    op.favoriler[tip] = fav.length ? Object.fromEntries(fav.map(x => [favAnahtar(x), x])) : null;
  }
  DB.ref('operators/' + u + '/favoriler/' + tip + '/' + favAnahtar(v)).set(ekle ? v : null)
    .catch(err => console.warn('Favori veritabanına yazılamadı (kural yayınlanmamış olabilir) — bu cihazda saklandı:', err && err.message));
  if(tip === 'durus' && document.getElementById('durus-picker-inner')){
    document.getElementById('durus-picker-inner').innerHTML = durusOptionsListHtml(); updateDurusStartBtn(); return;
  }
  render();
}
/* Küçük yıldız düğmesi (seçili değeri favorile / çıkar) */
function favYildizHtml(tip, v, kucuk){
  if(v == null || v === '') return '';
  const f = favoriMi(tip, v);
  return `<button type="button" class="nextop-yildiz ${kucuk ? 'fav-yildiz-k' : ''} ${f ? 'on' : ''}" aria-pressed="${f}" title="${f ? 'Favorilerden çıkar' : 'Favorilere ekle'}" aria-label="${f ? 'Favorilerden çıkar' : 'Favorilere ekle'}"
    onclick="event.stopPropagation(); favoriToggle('${tip}','${escJs(v)}')">${ico('star', kucuk ? 16 : 22)}</button>`;
}
/* Favori çip satırı. ogeler: [{ v, etiket, onclick, secili }] — yalnız hâlâ seçilebilir olanlar. */
function favCiplerHtml(ogeler, ipucu){
  if(!ogeler.length) return ipucu && FAV_IPUCU_GOSTER ? `<div class="nextop-ipucu" style="margin:0 2px 8px">${ico('star', 13)} ${esc(ipucu)}</div>` : '';
  return `<div class="fav-cipler">${ogeler.map(o => `<button type="button" class="fav-cip ${o.secili ? 'on' : ''}" title="${esc(o.baslik || o.etiket)}" onclick="${o.onclick}">${ico('star', 12)}<span>${esc(o.etiket)}</span></button>`).join('')}</div>`;
}

/* ---- Makine (etiketler "KOD · Ad") ---- */
function favMakineCipleri(etiketler, secili, secJs){
  const fav = new Set(makineFavorileri());
  const l = etiketler.filter(e => fav.has(favMakineKodu(e)));
  return favCiplerHtml(l.map(e => ({ v: e, etiket: favMakineKodu(e), baslik: e, secili: secili === e, onclick: secJs(e) })),
    'Sık kullandığın makineyi seçip yanındaki yıldıza dokun — burada tek dokunuşla çıkar.');
}

/* ---- Hammadde (favori = stok kalemi; boy takipte hangi çubuk olduğu yine seçilir) ---- */
function favHammaddeKalemi(optValue){ return String(optValue || '').split('::')[0]; }
function favHammaddeCipleri(opts, seciliValue, secJs, araJs){
  const fav = favoriler('hammadde');
  const ogeler = [];
  fav.forEach(itemId => {
    const o = opts.filter(x => x.itemId === itemId); if(!o.length) return;
    const it = (stockItems || {})[itemId] || {};
    const kisa = it.tur === 'boy' ? [it.kod, it.cap].filter(Boolean).join(' ') : (typeof hammaddeGosterimAdi === 'function' ? hammaddeGosterimAdi(it) : it.isim);
    const etiket = String(kisa || o[0].label || itemId);
    const secili = favHammaddeKalemi(seciliValue) === itemId;
    /* tek seçenek → doğrudan seç; birden fazla çubuk (lot) → aramaya yaz, operatör çubuğu seçsin */
    ogeler.push({ v: itemId, etiket: etiket + (o.length > 1 ? ' (' + o.length + ' çubuk)' : ''), baslik: o.length > 1 ? 'Çubuğu aşağıdan seç' : o[0].label, secili,
      onclick: o.length === 1 ? secJs(o[0].value) : araJs(kisa || '') });
  });
  return favCiplerHtml(ogeler, opts.length ? 'Seçtiğin hammaddenin yanındaki yıldıza dokun — sonraki işte burada çıkar.' : '');
}
