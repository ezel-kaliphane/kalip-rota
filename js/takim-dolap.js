/* ==================== TAKIM — DOLAP BAZLI STOK (13.10.2026, kullanıcı isteği) ====================
   "Aynı U kodlu ürün hem CNC dolabında hem atölye dolabında. Çıkışta alınan konum seçilsin; dolaba
   erişim kişi bazlı olsun, ayarlardan ben belirleyeyim." (QR etiketini dolaba göre yeniden basmak
   istenmedi — konum çıkışta seçilir.)
   Veri: toolStock/{itemId}/dolaplar/{locId} = adet; toolStock/{itemId}/miktar = TOPLAM (alt limit,
   Genel Bakış, raporlar, Excel toplamı okur — değişmedi). dolaplar yoksa (eski kayıt) tüm stok
   katalogdaki ana konumdadır (toolCatalog.locId; yoksa "Konumsuz"). İlk dolap hareketinde kayıt
   kendiliğinden dolaplı biçime geçer — ayrı bir taşıma gerekmez.
   Erişim: settings/takimDolapErisim/{kullanıcı}/{locId} = true. Kaydı olmayan herkes tüm dolapları
   görür; kayıt varsa yalnız işaretli dolaplar. */
const TOOL_KONUMSUZ = '_';
function toolDolapAdi(locId){ return locId === TOOL_KONUMSUZ ? 'Konumsuz' : ((toolLocations[locId] || {}).ad || 'Bilinmeyen dolap'); }
function toolDolaplari(stokNode, it){
  const d = stokNode && stokNode.dolaplar;
  if(d && typeof d === 'object' && Object.keys(d).length) return Object.entries(d).map(([locId, m]) => ({ locId, miktar: Number(m) || 0 }));
  return [{ locId: (it && it.locId) || TOOL_KONUMSUZ, miktar: Number((stokNode || {}).miktar) || 0 }];
}
function toolDolapErisimi(username){
  const e = ((appSettings || {}).takimDolapErisim || {})[username];
  return (e && typeof e === 'object' && Object.keys(e).length) ? e : null;
}
function toolDolapErisebilir(username, locId){
  const e = toolDolapErisimi(username);
  return !e || !!e[locId];
}
function toolDolapErisimToggle(username, locId){
  if(!canManageToolStok()) return;
  const aktifler = toolLocationsArray().filter(l => l.aktif !== false).map(l => l.id);
  const mevcut = toolDolapErisimi(username);
  const yeni = {};
  aktifler.forEach(id => { yeni[id] = mevcut ? !!mevcut[id] : true; });   // kayıt yoksa "hepsi" başlangıcı
  yeni[locId] = !yeni[locId];
  const hepsi = aktifler.every(id => yeni[id]);
  const kayit = hepsi ? null : (aktifler.some(id => yeni[id]) ? Object.fromEntries(aktifler.filter(id => yeni[id]).map(id => [id, true])) : { _hicbiri: true });
  DB.ref('settings/takimDolapErisim/' + username).set(kayit).catch(err => toast('Kaydedilemedi: ' + ((err && err.message) || 'hata')));
}
/* Dolaptaki adedi değiştir (delta) ya da ayarla (mutlak) — toplamla birlikte TEK transaction.
   İlk pasta yerel kopya yoksa cur === null gelir; o zaman taze okunan düğüm kullanılır (karbürde
   naif null korumasının her çıkışı reddettiği hata — HATA_NOTLARI 2026-09-15). */
function toolDolapTx(itemId, it, bilinenNode, locId, { delta = 0, mutlak = null, negatifIzin = false } = {}){
  const sonuc = { onceki: 0, sonraki: 0, oncekiToplam: 0, sonrakiToplam: 0 };
  return DB.ref('toolStock/' + itemId).transaction(cur => {
    const c = cur === null ? JSON.parse(JSON.stringify(bilinenNode || {})) : { ...cur };
    const d = {}; toolDolaplari(c, it).forEach(x => { d[x.locId] = x.miktar; });
    sonuc.onceki = Number(d[locId]) || 0;
    sonuc.sonraki = mutlak != null ? Number(mutlak) : sonuc.onceki + delta;
    if(sonuc.sonraki < 0 && !negatifIzin) return;   // iptal — o dolapta yetmiyor
    d[locId] = sonuc.sonraki;
    sonuc.oncekiToplam = Number(c.miktar) || 0;
    c.dolaplar = d;
    c.miktar = Object.values(d).reduce((s, v) => s + (Number(v) || 0), 0);
    sonuc.sonrakiToplam = c.miktar;
    return c;
  }).then(res => ({ ...sonuc, committed: res.committed, node: res.snapshot.val() }));
}
