/* ==================== KESİM PLANINDA İŞ EMRİ ARAMA (13.10.2026, kullanıcı: "bir iş emrinin ne
   zaman hangi kesim raporunda kesildiğini bulmak istiyorum") ====================
   Karbür → Hareketler normalde yalnız son 200 hareketi okur; aranan iş emri daha eskiyse görünmezdi.
   Arama veritabanına iş emrine göre sorgu atar (karburHareketleri .indexOn isEmriNo) — hem "talep no"
   hem "talep no_ELMAS" biçimi — bulunan planların TÜM satırlarını planNo ile çeker ve listeye ekler.
   U kodu yazılırsa o koddaki iş emirlerinin talep numaraları (canlı kayıtlardan) aranır.
   Kısa / kısmi yazımda (ör. "2609") yalnız okunmuş planlar içinde süzülür. */
let karburPlanArama = { q: '', durum: null, ieler: [], planlar: [], hata: null };
let karburAramaEk = [];   // aramanın getirdiği hareketler — son-200 yüklemesi bunları da listeye katar

function karburAramaBaz(n){ return String(n || '').trim().toUpperCase().replace(/_ELMAS$/, ''); }
function karburAramaIeleri(q){
  q = karburAramaBaz(q);
  if(!q) return [];
  if(/^\d{8,}$/.test(q)) return [q];
  if(/^U[A-Z]?\d{5,}$/.test(q)){
    const t = new Set();
    entriesArray().forEach(e => {
      if(String(e.isEmriNo || '').toUpperCase().replace(/_[A-Z]+$/, '') === q && e.talepNo) t.add(String(e.talepNo).trim());
    });
    return [...t].slice(0, 20);
  }
  return [];
}
function karburPlanEslesir(g){
  const a = karburPlanArama; if(!a.q) return true;
  const q = karburAramaBaz(a.q);
  return (g.ieler || []).some(n => { n = karburAramaBaz(n); return n.includes(q) || a.ieler.includes(n); });
}
function karburHareketEslesir(isEmriNo){
  const a = karburPlanArama; if(!a.q || !isEmriNo) return false;
  const n = karburAramaBaz(isEmriNo), q = karburAramaBaz(a.q);
  return n.includes(q) || a.ieler.includes(n);
}
async function karburPlanAra(q){
  q = String(q || '').trim();
  karburPlanArama = { q, durum: q ? 'araniyor' : null, ieler: karburAramaIeleri(q), planlar: [], hata: null };
  render();
  if(!q) return;
  const ieler = karburPlanArama.ieler;
  try{
    const planNolar = new Set();
    const okumalar = [];
    ieler.forEach(n => [n, n + '_ELMAS'].forEach(v => okumalar.push(
      DB.ref('karburHareketleri').orderByChild('isEmriNo').equalTo(v).once('value').then(s => {
        Object.values(s.val() || {}).forEach(h => { if(h && h.planNo) planNolar.add(h.planNo); });
      }))));
    await Promise.all(okumalar);
    /* Bulunan planların tüm satırları (stok etkisi, diğer iş emirleri, geri alma kayıtları) */
    const getirilen = [];
    await Promise.all([...planNolar].map(p => DB.ref('karburHareketleri').orderByChild('planNo').equalTo(p).once('value').then(s => {
      Object.entries(s.val() || {}).forEach(([id, x]) => getirilen.push({ id, ...x }));
    })));
    if(karburPlanArama.q !== q) return;   // bu arada yeni arama başladı
    const ekIds = new Set(karburAramaEk.map(h => h.id));
    getirilen.forEach(h => { if(!ekIds.has(h.id)){ ekIds.add(h.id); karburAramaEk.push(h); } });
    const varOlan = new Set((karburHareketler || []).map(h => h.id));
    const yeni = getirilen.filter(h => !varOlan.has(h.id));
    if(yeni.length) karburHareketler = (karburHareketler || []).concat(yeni).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    karburPlanArama.planlar = [...planNolar];
    karburPlanArama.planlar.forEach(p => { karburGecmisAcik[p] = true; });
    karburPlanArama.durum = 'bitti';
  }catch(err){
    if(karburPlanArama.q !== q) return;
    karburPlanArama.durum = 'hata'; karburPlanArama.hata = (err && err.message) || 'hata';
  }
  render();
}
function karburPlanAramaTemizle(){ karburPlanArama = { q: '', durum: null, ieler: [], planlar: [], hata: null }; render(); }
/* Stok Takibi üst aramasından: iş emri gibi görünüyorsa Karbür → Hareketler'de ara */
function karburAramayaGit(q){
  stokListeModalTur = null; stokListeAramaIle = false; stokGenelArama = '';
  stokSubView = 'karbur';
  karburSubView = 'gecmis';
  if(!(karburHareketler || []).length) loadKarburHareketleri(200);
  karburPlanAra(q);
}
function karburIsEmriGibiMi(q){ q = karburAramaBaz(q); return /^\d{4,}$/.test(q) || /^U[A-Z]?\d{5,}$/.test(q); }

function karburPlanAramaHtml(gosterilen){
  const a = karburPlanArama;
  const kutu = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
    <div style="display:flex;gap:6px;flex:1;min-width:220px;max-width:460px">
      <input id="karbur-plan-ara" class="mono" style="flex:1;margin-bottom:0" placeholder="İş emri / talep no ara — ör. 2609010018 ya da UC13030236" value="${esc(a.q)}"
        onkeydown="if(event.key==='Enter') karburPlanAra(this.value)">
      <button type="button" class="btn-primary" style="width:auto;padding:6px 14px" onclick="karburPlanAra(document.getElementById('karbur-plan-ara').value)">${ico('search', 14)} Ara</button>
      ${a.q ? `<button type="button" class="btn-ghost" style="width:auto;padding:6px 10px" onclick="karburPlanAramaTemizle()" title="Aramayı temizle">${ico('x', 14)}</button>` : ''}
    </div>
  </div>`;
  if(!a.q) return kutu;
  if(a.durum === 'araniyor') return kutu + `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">Aranıyor…</div>`;
  if(a.durum === 'hata') return kutu + `<div style="font-size:12.5px;color:var(--danger);margin-bottom:10px">Aranamadı: ${esc(a.hata)}</div>`;
  const kisa = !a.ieler.length;
  const ozet = gosterilen.length
    ? `<b class="mono">${esc(a.q)}</b> → <b>${gosterilen.length}</b> kesim planında: ${gosterilen.map(g => `<b class="mono">${esc(g.planNo)}</b> ${karburTarih(g.ts)}${g.iptal ? ' <span style="color:var(--danger)">(geri alındı)</span>' : ''}`).join(' · ')}`
    : `<b class="mono">${esc(a.q)}</b> hiçbir kesim planında bulunamadı${kisa ? ' (kısa yazımda yalnız son okunan planlar içinde aranır — talep numarasının tamamını yazın)' : ''}.`;
  return kutu + `<div style="font-size:12.5px;margin-bottom:12px;padding:8px 11px;border-radius:8px;background:color-mix(in srgb, var(--accent) 9%, transparent);border:1px solid color-mix(in srgb, var(--accent) 30%, transparent)">${ozet}
    ${a.ieler.length > 1 ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:3px">${esc(a.q)} kodunun talep numaraları: <span class="mono">${a.ieler.map(esc).join(', ')}</span></div>` : ''}</div>`;
}
