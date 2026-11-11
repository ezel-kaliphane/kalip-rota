/* ==================== TAKIM & SARF — OTOMATİK SİPARİŞ (11.11.2026, kullanıcı isteği) ====================
   "Çok kullandığımız ürünler için ısıl işlem ve hammaddedeki gibi şablon çıksın; stoğu yazsın, sipariş versin."
   - Kalem panelinde "Otomatik sipariş" kutusu (toolCatalog/{id}/otoSiparis) işaretli kalemler takip edilir.
   - Stok alt limitte ya da altındaysa ve açık istek no'su yoksa sipariş gerekir → Excel'e bir satır.
   - MIKTAR = kalemin "Sipariş miktarı" alanı (boşsa alt limit). MALZEME = CANİAS kodu, BIRIM AD,
     ONCELIK 2, IHTIYACTARIHI bugün+7, SATINALMA 180 — fason ısıl / malzemeyle aynı ŞABLON dosyası.
   - Siparişi açınca CANIAS istek no'su girilir (toolStock/{id}/otoIstekNo); "Sipariş açık" kutusu yerine bu
     kullanılıyor (kullanıcı kararı). Stok girişi yapılınca istek no kendiliğinden kalkar (js/toolstock.js doToolGiris). */
const TAKIM_OTO_SABIT = { oncelik: 2, satinalma: 180, birim: 'AD' };
function takimOtoYetki(){ return !!(session && session.isSuperAdmin); }
function takimOtoIstekNo(id){ return String(((toolStock || {})[id] || {}).otoIstekNo || '').trim(); }
function takimOtoMiktar(it){ return Number(it.siparisMiktari) > 0 ? Number(it.siparisMiktari) : Number(it.altLimit) > 0 ? Number(it.altLimit) : 0; }
/* Takip edilen kalemler, durumlarıyla: 'gerekli' (stok ≤ alt limit, istek yok) · 'sipariste' (istek no var) · 'yeterli' */
function takimOtoListe(){
  return toolCatalogArray().filter(it => it.otoSiparis && it.aktif !== false).map(it => {
    const stok = takimStokSayi(it), alt = Number(it.altLimit) || 0, istek = takimOtoIstekNo(it.id);
    const durum = istek ? 'sipariste' : stok <= alt ? 'gerekli' : 'yeterli';
    return { it, stok, alt, istek, miktar: takimOtoMiktar(it), durum, kod: String(it.canias || '').trim().toUpperCase() };
  }).sort((a, b) => ({ gerekli: 0, sipariste: 1, yeterli: 2 }[a.durum] - { gerekli: 0, sipariste: 1, yeterli: 2 }[b.durum])
    || (a.stok - a.alt) - (b.stok - b.alt) || String(a.it.ad || '').localeCompare(String(b.it.ad || ''), 'tr'));
}
function takimOtoMetni(x){
  const b = String(x.it.birim || 'adet').toLocaleUpperCase('tr-TR');
  return `${x.it.ad || ''}${x.it.marka ? ' (' + x.it.marka + ')' : ''}\n\nSTOK: ${x.stok} ${b}\nALT LİMİT: ${x.alt} ${b}\nSİPARİŞ: ${x.miktar} ${b}`;
}
/* Excel'e girebilecekler: sipariş gerekli + CANİAS kodu var + miktarı belli */
function takimOtoExcelListesi(){
  const g = takimOtoListe().filter(x => x.durum === 'gerekli');
  return { uygun: g.filter(x => x.kod && x.miktar > 0), kodsuz: g.filter(x => !x.kod), miktarsiz: g.filter(x => x.kod && !(x.miktar > 0)) };
}
function takimOtoExcelSatirlari(liste, simdi){
  const tarih = fpExcelTarih(simdi), s = TAKIM_OTO_SABIT;
  return [['MALZEME', 'ONCELIK', 'MIKTAR', 'IHTIYACTARIHI', 'SATINALMA', 'ACIKLAMA', 'BIRIM']]
    .concat(liste.map(x => [x.kod, s.oncelik, x.miktar, tarih, s.satinalma, takimOtoMetni(x), s.birim]));
}
async function takimOtoExcelOlustur(yeniSec){
  if(!takimOtoYetki()){ toast("Excel'i SuperAdmin oluşturur"); return; }
  const { uygun, kodsuz, miktarsiz } = takimOtoExcelListesi();
  if(!uygun.length){ toast(kodsuz.length || miktarsiz.length ? 'Sipariş gereken kalemlerin CANİAS kodu ya da sipariş miktarı eksik' : 'Sipariş gereken kalem yok'); return; }
  const ek = [kodsuz.length ? `${kodsuz.length} kalemin CANİAS kodu yok` : '', miktarsiz.length ? `${miktarsiz.length} kalemin sipariş miktarı yok` : ''].filter(Boolean).join(', ');
  await caniasSablonaYaz(takimOtoExcelSatirlari(uygun), uygun.length, ek ? ` (${ek}, alınmadı)` : '', yeniSec);
}
function takimOtoIstekKaydet(id, deger){
  if(!takimOtoYetki()){ toast("İstek no'yu SuperAdmin girer"); render(); return; }
  const no = String(deger || '').trim().toUpperCase();
  const now = Date.now(), u = {};
  u['toolStock/' + id + '/otoIstekNo'] = no || null;
  u['toolStock/' + id + '/otoIstekTs'] = no ? now : null;
  u['toolStock/' + id + '/otoIstekGiren'] = no ? session.username : null;
  DB.ref().update(u).then(() => {
    const st = { ...((toolStock || {})[id] || {}) };
    if(no){ st.otoIstekNo = no; st.otoIstekTs = now; st.otoIstekGiren = session.username; } else { delete st.otoIstekNo; delete st.otoIstekTs; delete st.otoIstekGiren; }
    toolStock[id] = st;
    toast(no ? `İstek no kaydedildi: ${no}` : 'İstek no kaldırıldı');
    render();
  }).catch(err => { toast('Kaydedilemedi: ' + (err.message || 'bilinmeyen hata')); render(); });
}
function takimOtoKopyala(id){
  const x = takimOtoListe().find(y => y.it.id === id); if(!x) return;
  const metin = takimOtoMetni(x), tamam = () => toast('Kopyalandı — satın alma isteğine yapıştır');
  if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(metin).then(tamam, () => window.prompt('Kopyalanamadı — buradan seçip kopyala:', metin));
  else window.prompt('Buradan seçip kopyala:', metin);
}
function renderTakimOtoSiparis(){
  const l = takimOtoListe(), yetki = takimOtoYetki();
  const say = d => l.filter(x => x.durum === d).length;
  const { uygun, kodsuz, miktarsiz } = takimOtoExcelListesi();
  if(uygun.length && typeof XLSX === 'undefined' && typeof loadScriptOnce === 'function') loadScriptOnce(LAZY_LIB_URLS.xlsx).catch(() => {});
  const durumEt = { gerekli: ['var(--danger)', 'SİPARİŞ GEREKLİ'], sipariste: ['var(--warn)', 'SİPARİŞTE'], yeterli: ['var(--success)', 'YETERLİ'] };
  if(!l.length) return `<div class="notice" style="--nc:var(--accent)"><div class="notice-title">Otomatik siparişte kalem yok</div>
    <div class="notice-sub">Durum listesinde kaleme bas → Yönetim görünümünde <b>Otomatik sipariş</b> kutusunu işaretle. Stok alt limite inince kalem burada "sipariş gerekli" olur ve Excel'e girer.</div></div>`;
  const satir = x => {
    const b = esc(x.it.birim || 'adet'), [renk, et] = durumEt[x.durum];
    return `<tr>
      <td><div class="st-ad">${esc(x.it.ad || '—')}</div><div class="st-alt"><span class="mono">${esc(x.it.canias || '')}</span>${x.it.marka ? ' · ' + esc(x.it.marka) : ''}${!x.kod ? ' · <span style="color:var(--danger)">CANİAS kodu yok</span>' : ''}</div></td>
      <td><span class="matrix-tag" style="--sb:${renk}">${et}</span></td>
      <td class="st-sag mono"><b style="color:${x.stok <= x.alt ? 'var(--danger)' : 'inherit'}">${x.stok}</b> ${b}</td>
      <td class="st-sag mono st-soluk">${x.alt} ${b}</td>
      <td class="st-sag mono">${x.miktar > 0 ? `${x.miktar} ${b}${Number(x.it.siparisMiktari) > 0 ? '' : ' <small class="st-soluk" title="Sipariş miktarı girilmemiş — alt limit kadar">(alt limit)</small>'}` : '<span style="color:var(--danger)">yok</span>'}</td>
      <td class="st-sag">${yetki ? `<input class="mono" style="width:110px" placeholder="istek no" value="${esc(x.istek)}" aria-label="İstek no" onkeydown="if(event.key==='Enter') this.blur()" onchange="takimOtoIstekKaydet('${escJs(x.it.id)}', this.value)">`
        : `<span class="mono">${esc(x.istek || '—')}</span>`}${x.istek && toolStock[x.it.id] && toolStock[x.it.id].otoIstekTs ? `<div class="st-alt">${fmtDT(toolStock[x.it.id].otoIstekTs)}</div>` : ''}</td>
      <td class="st-sag">${x.durum === 'gerekli' ? `<button class="btn-ghost st-kucuk" title="Açıklama metnini kopyala" onclick="takimOtoKopyala('${escJs(x.it.id)}')">${ico('copy', 13)}</button>` : ''}</td>
    </tr>`;
  };
  const uyari = [kodsuz.length ? `Kodu yok, alınmayacak: ${kodsuz.map(x => esc(x.it.ad || '')).join(', ')}` : '', miktarsiz.length ? `Sipariş miktarı ve alt limit yok, alınmayacak: ${miktarsiz.map(x => esc(x.it.ad || '')).join(', ')}` : ''].filter(Boolean);
  return `<div class="og-wrap">
    <div style="font-size:13.5px;margin:0 0 12px"><b>${l.length}</b> kalem otomatik siparişte: <b style="color:var(--danger)">${say('gerekli')}</b> sipariş gerekli, <b style="color:var(--warn)">${say('sipariste')}</b> siparişte, <b style="color:var(--success)">${say('yeterli')}</b> yeterli.
      <span class="st-soluk">Stok alt limite inince sipariş gerekir; istek no girilince "siparişte" olur, stok girişi yapılınca istek no kalkar.</span></div>
    ${yetki ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px">
      <button class="btn-primary" style="width:auto;padding:9px 16px" ${uygun.length ? '' : 'disabled'} title="Sipariş gereken kalemler CANIAS yükleme şablonuna yazılır" onclick="takimOtoExcelOlustur(false)">${ico('file', 14)} Excel oluştur${uygun.length ? ` (${uygun.length})` : ''}</button>
      ${typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function' ? `<button class="btn-ghost mb-mini" title="Yazılacak ŞABLON dosyasını yeniden seç" onclick="takimOtoExcelOlustur(true)">Dosyayı değiştir</button>` : ''}
      <span style="font-size:12px;color:var(--text-muted)">Öncelik ${TAKIM_OTO_SABIT.oncelik} · birim ${TAKIM_OTO_SABIT.birim} · ihtiyaç ${fpIhtiyacTarihi()} · satın alma ${TAKIM_OTO_SABIT.satinalma} · miktar = sipariş miktarı (yoksa alt limit)</span>
      ${uyari.map(u => `<span style="font-size:12px;color:var(--danger)">${ico('alert', 12)} ${u}</span>`).join('')}
    </div>` : ''}
    <div class="st-tablo-kutu"><table class="st-tablo">
      <thead><tr><th>KALEM</th><th>DURUM</th><th class="st-sag">STOK</th><th class="st-sag">ALT LİMİT</th><th class="st-sag">SİPARİŞ</th><th class="st-sag">İSTEK NO</th><th></th></tr></thead>
      <tbody>${l.map(satir).join('')}</tbody>
    </table></div>
  </div>`;
}
