/* ==================== MALZEME BEKLEYEN → SATIN ALMAYA MAİL (11.11.2026, kullanıcı isteği) ====================
   Stok → Malzeme Bekleyenler üst satırı (yalnız SuperAdmin; 11.11.2026'da İş Yoğunluğu'ndan taşındı — "listenin
   en altına iniyorsun"): 15 günden uzun bekleyen siparişler için satın almaya
   bilgi isteği maili. Bir sipariş = bir istek no + bir hammadde (malzemeIstek anahtarı gibi). Bekleme günü ekrandaki
   "N gün bekliyor" ile aynı: o siparişe bağlı en eski işaretleme (isaretTs). Mail önce pencerede gösterilir
   (düzenlenebilir), "Mail uygulamasında aç" mailto ile Outlook'u açar; uzun metinde mailto kısalabildiği için
   "Kopyala" da var. Kullanıcının taslağı: "3343 Ø26 HSS CELIK 2000MM OLAN SİPARİŞ 36 GÜNDÜR BEKLEMEDEDİR.
   İSTEK NO : 26100287 — BU MALZEME İÇİN BİLGİ RİCA EDERİZ". */
const MM_ESIK_GUN = 15;
let mmMail = null;   // { konu, metin, n }
function mmYetki(){ return !!(session && session.isSuperAdmin); }
function mmGunTarih(ts){ const d = new Date(ts), iki = n => String(n).padStart(2, '0'); return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`; }
function mmSayi(n){ return String(Math.round(Number(n) * 100) / 100).replace('.', ','); }
/* 15 günden uzun bekleyen açık siparişler, en uzun bekleyen önce */
function mmGecikenSiparisler(simdi){
  simdi = simdi || Date.now();
  const g = new Map();
  malzemeBekleyenAktif().filter(x => malzemeIstekVar(x) && malzemeIstekDurumu(x) !== 'geldi').forEach(x => {
    const no = String(x.caniasIstekNo).trim(), key = no.toUpperCase() + '|' + x.hammaddeId;
    if(!g.has(key)) g.set(key, { no, hid: x.hammaddeId, kayitlar: [] });
    g.get(key).kayitlar.push(x);
  });
  return [...g.values()].map(s => {
    s.kayitlar.sort((a, b) => (Number(a.isaretTs) || 0) - (Number(b.isaretTs) || 0));
    const ilk = Number(s.kayitlar[0].isaretTs) || simdi;
    const k = malzemeIstekKaydi(s.no, s.hid) || {};
    const istekTs = Number(k.acilisTs) || Math.min(...s.kayitlar.map(x => Number(x.istekTs) || Infinity));
    const it = (stockItems || {})[s.hid];
    const ad = (it && (stokAciklama(it) || hammaddeEtiket(it))) || s.kayitlar[0].hammaddeKod || '';
    return { ...s, gun: Math.floor((simdi - ilk) / 864e5), istekTs: isFinite(istekTs) ? istekTs : null, ad,
      miktar: Number(k.miktar) > 0 ? Number(k.miktar) : null, gelen: Number(k.gelen) || 0, birim: String(k.birim || s.kayitlar[0].birim || '').toLocaleLowerCase('tr-TR') };
  }).filter(s => s.gun > MM_ESIK_GUN).sort((a, b) => b.gun - a.gun);
}
function mmMetin(liste){
  const blok = (s, i) => {
    /* 11.11.2026 kullanıcı: "hepsinin büyük harf olması iyi değil" — normal yazım; malzeme/mamul adları kayıttaki gibi */
    const mik = s.miktar ? ` – ${mmSayi(s.miktar)} ${s.birim}` : '';
    const kalan = s.miktar && s.gelen > 0 ? ` (${mmSayi(s.gelen)} ${s.birim} geldi, ${mmSayi(Math.max(0, s.miktar - s.gelen))} ${s.birim} bekleniyor)` : '';
    /* aynı talep no'nun iki bileşeni (ayrı kayıt) mailde tek satır */
    const isler = [...new Set(s.kayitlar.map(x => `   - ${[x.talepNo || x.isEmriNo, x.mamulAdi || ''].filter(Boolean).join(' ')}`))];
    return [
      `${i + 1}) ${s.ad}${mik}`,
      `   ${s.gun} gündür bekliyor${kalan}`,
      `   İstek no: ${s.no}`,
      s.istekTs ? `   İstek tarihi: ${mmGunTarih(s.istekTs)}` : '',
      `   Bekleyen iş emirleri (${isler.length}):`,
      ...isler
    ].filter(Boolean).join('\n');
  };
  const giris = liste.length === 1
    ? 'Aşağıdaki satın alma isteğimiz uzun süredir beklemededir. Bu malzeme için bilgi (tahmini geliş tarihi) rica ederiz.'
    : `Aşağıdaki ${liste.length} satın alma isteğimiz ${MM_ESIK_GUN} günden uzun süredir beklemededir. Bu malzemeler için bilgi (tahmini geliş tarihi) rica ederiz.`;
  return `Merhabalar,\n\n${giris}\n\n${liste.map(blok).join('\n\n')}\n\nİyi çalışmalar,\n${(session && (session.displayName || session.username)) || ''}`;
}
function mmMailAc(){
  if(!mmYetki()) return;
  const l = mmGecikenSiparisler();
  if(!l.length){ toast(`${MM_ESIK_GUN} günden uzun bekleyen sipariş yok`); return; }
  mmMail = { konu: `Bekleyen malzeme siparişleri — bilgi rica (${l.length} istek)`, metin: mmMetin(l), n: l.length };
  render();
}
function mmMailKapat(){ mmMail = null; render(); }
function mmMailGonder(){
  if(!mmMail) return;
  const u = 'mailto:?subject=' + encodeURIComponent(mmMail.konu) + '&body=' + encodeURIComponent(mmMail.metin.replace(/\n/g, '\r\n'));
  if(u.length > 1900) toast('Mail uzun — uygulamada eksik görünürse "Kopyala" ile yapıştır');
  window.location.href = u;
}
function mmMailKopyala(){
  if(!mmMail) return;
  const tamam = () => toast('Mail metni kopyalandı');
  if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(mmMail.metin).then(tamam, () => window.prompt('Buradan seçip kopyala:', mmMail.metin));
  else window.prompt('Buradan seçip kopyala:', mmMail.metin);
}
function mmDugmeHtml(){
  if(!mmYetki()) return '';
  const n = mmGecikenSiparisler().length;
  return `<button class="btn-ghost" style="width:auto;padding:7px 12px" ${n ? '' : 'disabled'} title="${n ? `${MM_ESIK_GUN} günden uzun bekleyen ${n} sipariş için satın almaya bilgi isteği maili` : `${MM_ESIK_GUN} günden uzun bekleyen sipariş yok`}" onclick="mmMailAc()">${ico('send', 14)} Satın almaya mail${n ? ` (${n})` : ''}</button>`;
}
function renderMmMailModal(){
  if(!mmMail) return '';
  return `<div class="modal-overlay" onclick="if(event.target===this)mmMailKapat()">
    <div class="modal-box" style="max-width:720px;width:100%;padding:20px">
      <div class="sec-h" style="margin-top:0">Satın almaya mail · ${mmMail.n} sipariş</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">${MM_ESIK_GUN} günden uzun bekleyen siparişler. Metni burada düzenleyebilirsin; "Mail uygulamasında aç" Outlook'u bu metinle açar, alıcıyı orada seçersin.</div>
      <div class="field"><label for="mm-konu">Konu</label><input id="mm-konu" value="${esc(mmMail.konu)}" oninput="mmMail.konu=this.value"></div>
      <div class="field"><label for="mm-metin">Metin</label><textarea id="mm-metin" class="mono" style="min-height:340px;font-size:12.5px;line-height:1.45" oninput="mmMail.metin=this.value">${esc(mmMail.metin)}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn-ghost" style="width:auto;padding:8px 14px" onclick="mmMailKapat()">Kapat</button>
        <button class="btn-ghost" style="width:auto;padding:8px 14px" onclick="mmMailKopyala()">${ico('copy', 14)} Kopyala</button>
        <button class="btn-primary" style="width:auto;padding:8px 16px" onclick="mmMailGonder()">${ico('send', 14)} Mail uygulamasında aç</button>
      </div>
    </div>
  </div>`;
}
