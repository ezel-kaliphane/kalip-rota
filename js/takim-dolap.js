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

/* DOLAPLAR ARASI TAŞIMA (14.10.2026, kullanıcı: "ekle"). Tek transaction: kaynaktan düş, hedefe ekle,
   toplam değişmez. Hareket geçmişine tip 'tasima' olarak yazılır. Yalnız SuperAdmin (stok yönetimi). */
let toolTasi = null;   // { itemId, kaynak, hedef, adet, busy }
function toolTasiAc(itemId){
  if(!canManageToolStok()){ toast('Bu işlem için SuperAdmin yetkisi gerekli'); return; }
  const it = toolCatalog[itemId]; if(!it) return;
  ensureToolLocationsLoaded(() => safeRender());
  const dolu = toolDolaplari(toolStock[itemId], it).filter(x => x.miktar > 0);
  if(!dolu.length){ toast('Bu kalemin hiçbir dolapta stoğu yok'); return; }
  const kaynak = dolu[0].locId;
  const hedef = (toolLocationsArray().find(l => l.aktif !== false && l.id !== kaynak) || {}).id || '';
  toolTasi = { itemId, kaynak, hedef, adet: '', busy: false };
  render();
}
function toolTasiKapat(){ toolTasi = null; render(); }
function toolTasiYaz(alan, deger){
  if(!toolTasi) return;
  toolTasi[alan] = deger;
  if(alan === 'kaynak' && toolTasi.hedef === deger) toolTasi.hedef = (toolLocationsArray().find(l => l.aktif !== false && l.id !== deger) || {}).id || '';
  render();
}
function toolTasiTx(itemId, it, bilinenNode, kaynak, hedef, adet){
  const sonuc = { kaynakOnceki: 0, hedefOnceki: 0, toplam: 0 };
  return DB.ref('toolStock/' + itemId).transaction(cur => {
    const c = cur === null ? JSON.parse(JSON.stringify(bilinenNode || {})) : { ...cur };
    const d = {}; toolDolaplari(c, it).forEach(x => { d[x.locId] = x.miktar; });
    sonuc.kaynakOnceki = Number(d[kaynak]) || 0; sonuc.hedefOnceki = Number(d[hedef]) || 0;
    if(sonuc.kaynakOnceki < adet) return;   // iptal — kaynak dolapta yetmiyor
    d[kaynak] = sonuc.kaynakOnceki - adet; d[hedef] = sonuc.hedefOnceki + adet;
    c.dolaplar = d;
    c.miktar = Object.values(d).reduce((s, v) => s + (Number(v) || 0), 0);
    sonuc.toplam = c.miktar;
    return c;
  }).then(res => ({ ...sonuc, committed: res.committed, node: res.snapshot.val() }));
}
function toolTasiKaydet(){
  const t = toolTasi; if(!t || t.busy || !canManageToolStok()) return;
  const it = toolCatalog[t.itemId]; if(!it) return;
  const adet = Math.round(Number(String(t.adet).replace(',', '.')));
  if(!t.kaynak || !t.hedef || t.kaynak === t.hedef){ toast('Farklı iki dolap seçin'); return; }
  if(!(adet > 0)){ toast('Taşınacak adedi girin'); return; }
  const mevcut = (toolDolaplari(toolStock[t.itemId], it).find(x => x.locId === t.kaynak) || {}).miktar || 0;
  if(adet > mevcut){ toast(`${toolDolapAdi(t.kaynak)}'nda ${mevcut} adet var`); return; }
  t.busy = true; render();
  toolTasiTx(t.itemId, it, toolStock[t.itemId], t.kaynak, t.hedef, adet).then(r => {
    if(!r.committed){ t.busy = false; toast('Kaynak dolapta yetmiyor — bu sırada çıkış yapılmış olabilir'); render(); return; }
    const now = Date.now(), yol = toolDolapAdi(t.kaynak) + ' → ' + toolDolapAdi(t.hedef);
    const moveId = DB.ref('toolMoves').push().key;
    const updates = {};
    updates['toolMoves/' + moveId] = { itemId: t.itemId, canias: it.canias || '', tip: 'tasima', miktar: adet,
      oncekiMiktar: r.toplam, sonrakiMiktar: r.toplam, kaynakLocId: t.kaynak, hedefLocId: t.hedef, dolap: yol,
      kaynakOnceki: r.kaynakOnceki, hedefOnceki: r.hedefOnceki, aciklama: yol,
      operatorUsername: session.username, operatorName: session.displayName, kaynak: 'liste', ts: now };
    updates['toolStock/' + t.itemId + '/sonHareketTs'] = now;
    updates['toolStock/' + t.itemId + '/sonHareketAciklama'] = 'Taşıma · ' + yol;
    DB.ref().update(updates).then(() => {
      toolStock[t.itemId] = { ...(r.node || {}), sonHareketTs: now };
      toast(`${it.ad || it.canias}: ${adet} adet ${yol}`);
      toolTasi = null; render();
    }).catch(err => { t.busy = false; toast('Hareket yazılamadı: ' + ((err && err.message) || 'hata')); render(); });
  }).catch(err => { t.busy = false; toast('Taşınamadı: ' + ((err && err.message) || 'hata')); render(); });
}
function renderToolTasiModal(){
  const t = toolTasi; if(!t) return '';
  const it = toolCatalog[t.itemId]; if(!it){ toolTasi = null; return ''; }
  const dl = toolDolaplari(toolStock[t.itemId], it);
  const stokOf = id => (dl.find(x => x.locId === id) || {}).miktar || 0;
  const kaynaklar = dl.filter(x => x.miktar > 0);
  const hedefler = toolLocationsArray().filter(l => l.aktif !== false && l.id !== t.kaynak);
  const mevcut = stokOf(t.kaynak);
  return `<div class="modal-overlay" onclick="if(event.target===this) toolTasiKapat()">
    <div class="modal-box" style="max-width:440px;padding:20px">
      <div class="sec-h" style="margin-top:0">Dolaplar arası taşı</div>
      <div style="font-size:12.5px;color:var(--text-muted);margin:-6px 0 14px"><span class="mono">${esc(it.canias || '')}</span> · ${esc(it.ad || '')}</div>
      <div class="field"><label>Nereden</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${kaynaklar.map(x => `<button type="button" class="chip ${t.kaynak === x.locId ? 'active' : ''}" onclick="toolTasiYaz('kaynak','${escJs(x.locId)}')">${esc(toolDolapAdi(x.locId))} · ${x.miktar}</button>`).join('')}</div></div>
      <div class="field"><label>Nereye</label>
        ${hedefler.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${hedefler.map(l => `<button type="button" class="chip ${t.hedef === l.id ? 'active' : ''}" onclick="toolTasiYaz('hedef','${escJs(l.id)}')">${esc(l.ad)} · ${stokOf(l.id)}</button>`).join('')}</div>`
          : `<div style="font-size:12px;color:var(--warn)">Başka aktif dolap yok — Konumlar'dan ekleyin.</div>`}</div>
      <div class="field"><label>Adet <span style="font-weight:400;color:var(--text-muted)">(en çok ${mevcut})</span></label>
        <div style="display:flex;gap:6px"><input class="mono" inputmode="numeric" value="${esc(t.adet)}" placeholder="${mevcut}" style="flex:1;margin:0" oninput="this.value=this.value.replace(/[^0-9]/g,''); toolTasi.adet=this.value" onkeydown="if(event.key==='Enter') toolTasiKaydet()">
          <button type="button" class="btn-ghost" style="width:auto;padding:6px 12px" onclick="toolTasiYaz('adet','${mevcut}')">Tümü</button></div></div>
      <div style="display:flex;gap:8px;margin-top:6px"><button class="btn-primary" style="flex:1" ${(t.busy || !t.hedef) ? 'disabled' : ''} onclick="toolTasiKaydet()">${t.busy ? 'Taşınıyor…' : 'Taşı'}</button>
        <button class="btn-ghost" onclick="toolTasiKapat()">Vazgeç</button></div>
    </div></div>`;
}
