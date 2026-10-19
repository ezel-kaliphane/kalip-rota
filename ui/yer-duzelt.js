/* ==================== İŞ YOĞUNLUĞU → YER DÜZELTME (19.10.2026, kullanıcı isteği) ====================
   "Makinedeki kişi işi bitirince 'şuraya bırakıyorum' diyor; bazen yanlış yere bırakıyor. Bazen de bir
   iş hiçbir makineye girmeden (testereye bile) bir makinenin sırasına konuyor. Şef bunu düzeltmek için
   kodu kandırıp herhangi bir makinede sahte bir operasyon açıp kapatıyor." Kararlar (kullanıcı):
   - Düzeltme İş Yoğunluğu'nda, yalnız Şef ve SuperAdmin (canManageStock). Operatör düzeltemez.
   - Geçmişteki sahte kayıtlara şimdilik dokunulmaz.
   İki iş:
   1) YERİNİ DEĞİŞTİR — iş emrinin EN SON kaydı bitmişse, o kaydın "bırakılan yer"i (sonrakiMakine)
      değiştirilir; bitirmedeki kural aynen: Pres'e giden zarf/elmas dalı ve FKK'ya giden iş "son
      operasyon" sayılır (otomatikSonOperasyonMu). Her değişiklik kaydın içine yazılır:
      entries/{id}/yerDuzeltme/{push} = { eskiYer, yeniYer, ts, kim, kimAd }. Sahte operasyon yok →
      rota zinciri, verimlilik, maliyet etkilenmez.
   2) SIRAYA KOY — hiç kaydı olmayan iş emri (ilk operasyon) bir makinenin sırasına konur:
      isEmriSira/{talepNo_bileşen} = { talepNo, isEmriNo, bilesen, adet, makine, ts, kim, kimAd, mamulAdi }.
      O iş emrinde (aynı talep no + takip kodu) herhangi bir kayıt açıldığı an sıradan kendiliğinden
      düşer — İş Yoğunluğu'nun "biri gerçekten Başla'ya basınca kuyruktan çıkar" kuralının aynısı.
      KURAL: isEmriSira { ".read": true, ".write": false, "$k": { ".write": true } } (Console'dan). */
let ydModal = null;   // { tip:'kayit'|'sira'|'yeni', entryId, siraKey, talepNo, isEmriNo, bilesen, adet, mamulAdi, eskiYer, ara, secim, busy, uyari }
let isEmriSira = {}, isEmriSiraReady = false, _isEmriSiraDinleniyor = false;

function ydYetki(){ return typeof canManageStock === 'function' && canManageStock(); }
function ensureIsEmriSiraLoaded(){
  if(_isEmriSiraDinleniyor || typeof DB === 'undefined' || !DB) return;
  _isEmriSiraDinleniyor = true;
  DB.ref('isEmriSira').on('value', s => { isEmriSira = s.val() || {}; isEmriSiraReady = true; safeRender(); },
    err => { isEmriSira = {}; isEmriSiraReady = true; console.warn('isEmriSira okunamadı (kural yayınlandı mı?):', err && err.message); });
}
/* Sıradaki (henüz hiç kaydı açılmamış) iş emirleri — İş Yoğunluğu kuyruğuna sahte kayıt gibi girer */
function isEmriSiraAktif(){
  ensureIsEmriSiraLoaded();
  const kayitli = new Set(entriesArray().map(e => String(e.talepNo || '').trim().toUpperCase() + '|' + e.isEmriNo));
  return Object.entries(isEmriSira || {}).map(([key, x]) => ({ ...x, key }))
    .filter(x => x && x.makine && !kayitli.has(String(x.talepNo || '').trim().toUpperCase() + '|' + x.isEmriNo));
}
/* iyVeri'nin kuyruğuna girecek biçim (bekleyenSonrakiOperasyonlar kayıtlarıyla aynı alanlar) */
function isEmriSiraKuyrukKayitlari(){
  return isEmriSiraAktif().map(x => ({ id: 'sira:' + x.key, _sira: true, siraKey: x.key, isEmriNo: x.isEmriNo, talepNo: x.talepNo,
    adet: x.adet, sonrakiMakine: x.makine, makine: 'İlk operasyon', operatorName: 'sıraya koyan: ' + (x.kimAd || x.kim || ''),
    status: 'tamamlandi', endTs: x.ts, startTs: x.ts }));
}
function ydSiraAnahtar(talepNo, bilesen){ return (String(talepNo || '').trim().toUpperCase() + '_' + (bilesen || 'TEK')).replace(/[.#$\[\]\/]/g, '-'); }

/* ---------- açılış ---------- */
function ydKayitAc(isEmriNo){
  if(!ydYetki()){ toast('Bu işlem için Şef ya da SuperAdmin yetkisi gerekli'); return; }
  const list = iyGecmisIcinKayitlar(isEmriNo), son = list[list.length - 1];
  if(!son){ toast('Bu iş emrinin kaydı yok — "Sıraya koy"u kullanın'); return; }
  if(son.status !== 'tamamlandi'){ toast('Şu an ' + (son.makine || '') + "'de işleniyor — bitmeden yeri değiştirilemez"); return; }
  const kapali = !!son.sonOperasyon && !son.sonrakiMakine;
  ydModal = { tip: 'kayit', entryId: son.id, talepNo: son.talepNo || '', isEmriNo, adet: son.adet || '', mamulAdi: '', ara: '', secim: '', busy: false,
    eskiYer: kapali ? 'Rota tamamlandı' : (son.sonrakiMakine || '—'),
    uyari: kapali ? 'Bu iş emrinin rotası "tamamlandı" olarak kapanmış — yeni yer seçilince yeniden açılır.' : '' };
  iyGecmisModalIsEmriNo = null;
  render();
}
function ydSiraAc(key){
  if(!ydYetki()){ toast('Bu işlem için Şef ya da SuperAdmin yetkisi gerekli'); return; }
  const x = (isEmriSira || {})[key]; if(!x) return;
  ydModal = { tip: 'sira', siraKey: key, talepNo: x.talepNo, isEmriNo: x.isEmriNo, bilesen: x.bilesen || '', adet: x.adet || '', mamulAdi: x.mamulAdi || '',
    eskiYer: x.makine, ara: '', secim: '', busy: false, uyari: '' };
  render();
}
/* TEK PENCERE (19.10.2026, kullanıcı: "+ Sıraya koy ile hâlihazırda bir yerde bekleyen işi başka yere
   sokabiliyorum — o zaman 'değiştir' demesi lazım; ayrı pencere açılsın, oradan yapsın"). Pencere önce
   iş emrini bulur ve ŞU AN NEREDE olduğunu gösterir; sunulan işlem duruma göre tektir:
   kaydı var + bitmiş → Yeri değiştir (son kayıt) · sırada → Yeri değiştir (sıra kaydı) / Sıradan çıkar ·
   hiç kaydı yok → Sıraya koy · şu an işleniyor → işlem yok. */
function ydBulAc(talep){
  if(!ydYetki()){ toast('Bu işlem için Şef ya da SuperAdmin yetkisi gerekli'); return; }
  ensureIsEmriSiraLoaded();
  ydModal = { bul: true, tip: null, talepNo: talep || '', isEmriNo: '', bilesen: '', adet: '', mamulAdi: '', eskiYer: '', ara: '', secim: '', busy: false, uyari: '', durum: null };
  if(talep) ydTalepCoz(); else render();
  setTimeout(() => { const el = document.getElementById('yd-talep'); if(el && !talep) el.focus(); }, 30);
}
const ydYeniAc = ydBulAc;
function ydKapat(){ ydModal = null; render(); }

function ydTalepCoz(){
  const m = ydModal; if(!m || !m.bul) return;
  const talep = String(m.talepNo || '').trim().toUpperCase();
  Object.assign(m, { tip: null, entryId: null, siraKey: null, eskiYer: '', isEmriNo: '', mamulAdi: '', uyari: '', durum: null, secim: '' });
  if(!talep){ render(); return; }
  if(!isEmriValid(talep)){ m.durum = { renk: 'var(--danger)', metin: 'Bu iş emri listede yok', detay: 'Kodu kontrol edin' }; render(); return; }
  const r = resolveTrackingCode(talep, m.bilesen || '');
  const bilgi = typeof isEmriBilgisiBul === 'function' ? isEmriBilgisiBul(talep) : null;
  m.isEmriNo = r.isEmriNo; m.talepNo = r.talepNo;
  m.mamulAdi = (bilgi && bilgi.mamulAdi) || '';
  const kayitlar = entriesArray().filter(e => String(e.talepNo || '').trim().toUpperCase() === r.talepNo && e.isEmriNo === r.isEmriNo)
    .sort((a, b) => (a.startTs || 0) - (b.startTs || 0));
  const son = kayitlar[kayitlar.length - 1];
  const mbVar = typeof malzemeBekleyenAktif === 'function' && malzemeBekleyenAktif().some(x => String(x.talepNo || '').trim().toUpperCase() === r.talepNo);
  if(son){
    m.durum = iyDurumOzeti(son); m.adet = son.adet || '';
    if(son.status !== 'tamamlandi'){ m.uyari = 'Şu an işleniyor — bitmeden yeri değiştirilemez.'; }
    else {
      const kapali = !!son.sonOperasyon && !son.sonrakiMakine;
      Object.assign(m, { tip: 'kayit', entryId: son.id, eskiYer: kapali ? 'Rota tamamlandı' : (son.sonrakiMakine || '—'),
        uyari: kapali ? 'Rotası "tamamlandı" olarak kapanmış — yeni yer seçilince yeniden açılır.' : '' });
    }
  } else {
    const key = ydSiraAnahtar(r.talepNo, m.bilesen), sira = (isEmriSira || {})[key];
    if(sira){
      Object.assign(m, { tip: 'sira', siraKey: key, eskiYer: sira.makine, adet: sira.adet || '' });
      m.durum = { renk: 'var(--warn)', metin: `${sira.makine} sırasında bekliyor`, detay: `İlk operasyon · ${esc(sira.kimAd || sira.kim || '')} ${fmtDT(sira.ts)}'de sıraya koydu` };
    } else {
      m.tip = 'yeni';
      if(!String(m.adet || '').trim() && bilgi && bilgi.ieMiktar) m.adet = String(bilgi.ieMiktar);
      m.durum = { renk: 'var(--text-muted)', metin: 'Hiç operasyonu açılmamış', detay: 'Bir makinenin sırasına konacak (ilk operasyon)' };
    }
  }
  if(mbVar) m.durum.detay = (m.durum.detay ? m.durum.detay + ' · ' : '') + 'Malzeme Bekleyenler\'de';
  render();
}

/* ---------- kaydet ---------- */
function ydSecimEtiketi(kod){
  if(kod === 'Belirsiz') return 'Belirsiz';
  const mk = allMachines().find(x => x.code === kod);
  return mk ? `${mk.code} · ${mk.name}` : kod;
}
function ydKaydet(){
  const m = ydModal; if(!m || m.busy || !ydYetki()) return;
  if(!m.tip){ toast(m.uyari || 'Önce iş emrini bulun'); return; }
  if(!m.secim){ toast('Gideceği yeri seçin'); return; }
  const yeni = ydSecimEtiketi(m.secim), now = Date.now(), kim = session.username, kimAd = session.displayName || session.username;
  if(m.tip !== 'yeni' && yeni === m.eskiYer){ toast('Zaten orada'); return; }
  const upd = {};
  if(m.tip === 'kayit'){
    const e = STATE.entries[m.entryId];
    if(!e || e.status !== 'tamamlandi'){ toast('Kayıt değişmiş — pencereyi kapatıp tekrar açın'); return; }
    const sonOp = yeni !== 'Belirsiz' && otomatikSonOperasyonMu(yeni, bilesenOfCode(e.isEmriNo));
    const p = 'entries/' + m.entryId;
    upd[p + '/sonrakiMakine'] = yeni;
    upd[p + '/sonOperasyon'] = sonOp;
    upd[p + '/yerDuzeltme/' + DB.ref().push().key] = { eskiYer: m.eskiYer, yeniYer: yeni, ts: now, kim, kimAd };
  } else {
    if(m.tip === 'yeni'){
      if(!m.isEmriNo){ toast('İş emri no yazın'); return; }
      /* pencere açıkken başka biri kayıt açtıysa sıraya koyma — değiştir olmalı */
      if(entriesArray().some(e => String(e.talepNo || '').trim().toUpperCase() === m.talepNo && e.isEmriNo === m.isEmriNo)){ toast('Bu iş emrinde az önce kayıt açıldı — tekrar arayın'); ydTalepCoz(); return; }
      if(!/^\d+$/.test(String(m.adet || '').trim()) || !(Number(m.adet) > 0)){ toast('Adet yazın'); return; }
    }
    const key = m.tip === 'sira' ? m.siraKey : ydSiraAnahtar(m.talepNo, m.bilesen);
    const eski = (isEmriSira || {})[key] || {};
    upd['isEmriSira/' + key] = { talepNo: m.talepNo, isEmriNo: m.isEmriNo, bilesen: m.bilesen || null, adet: String(m.adet || eski.adet || ''),
      mamulAdi: m.mamulAdi || eski.mamulAdi || null, makine: yeni,
      ts: eski.ts || now, kim: eski.kim || kim, kimAd: eski.kimAd || kimAd,
      ...(eski.makine && eski.makine !== yeni ? { degisiklik: { ...(eski.degisiklik || {}), [DB.ref().push().key]: { eskiYer: eski.makine, yeniYer: yeni, ts: now, kim, kimAd } } } : (eski.degisiklik ? { degisiklik: eski.degisiklik } : {})) };
  }
  m.busy = true; render();
  DB.ref().update(upd).then(() => {
    toast(m.tip === 'yeni' ? `${m.talepNo} → ${yeni} sırasına kondu` : `${m.talepNo || m.isEmriNo}: ${m.eskiYer} → ${yeni}`);
    ydModal = null; render();
  }).catch(err => { m.busy = false; toast('Kaydedilemedi: ' + ((err && err.message) || 'hata')); render(); });
}
function ydSiradanCikar(key){
  if(!ydYetki()) return;
  const x = (isEmriSira || {})[key]; if(!x) return;
  if(!confirm(`${x.talepNo} sıradan çıkarılsın mı? (${x.makine})`)) return;
  DB.ref('isEmriSira/' + key).remove().then(() => { toast('Sıradan çıkarıldı'); if(ydModal && ydModal.siraKey === key) ydModal = null; render(); })
    .catch(err => toast('Çıkarılamadı: ' + ((err && err.message) || 'hata')));
}
function ydMalzemeBekliyor(){
  const m = ydModal; if(!m) return;
  const talep = m.talepNo || m.isEmriNo;
  ydModal = null;
  setView('stokYonetim'); setStokSubView('bekleyen');
  if(typeof mbFormBos === 'function'){ mbForm = mbFormBos(); mbForm.girilen = talep; mbYeniAc(); if(typeof mbKodAra === 'function') mbKodAra(); }
}

/* ---------- görünüm ---------- */
function ydDugme(isEmriNo, kucuk){
  if(!ydYetki()) return '';
  return `<button type="button" class="btn-ghost yd-dugme${kucuk ? ' kucuk' : ''}" title="Bırakılan yeri düzelt (Şef / SuperAdmin)" onclick="event.stopPropagation(); ydKayitAc('${escJs(isEmriNo)}')">${ico('chevronRight', 12)} Yerini değiştir</button>`;
}
function ydSiraDugmeleri(key){
  if(!ydYetki()) return '';
  return `<button type="button" class="btn-ghost yd-dugme kucuk" onclick="event.stopPropagation(); ydSiraAc('${escJs(key)}')">${ico('chevronRight', 12)} Yerini değiştir</button>
    <button type="button" class="btn-ghost yd-dugme kucuk" style="color:var(--danger)" onclick="event.stopPropagation(); ydSiradanCikar('${escJs(key)}')">Sıradan çıkar</button>`;
}
function ydMakineListesiHtml(){
  const m = ydModal, q = String(m.ara || '').trim().toLocaleUpperCase('tr-TR');
  const fav = new Set(typeof makineFavorileri === 'function' ? makineFavorileri() : []);
  const eskiKod = String(m.eskiYer || '').split(' · ')[0];
  const uyan = allMachines().filter(x => !q || (x.code + ' ' + x.name).toLocaleUpperCase('tr-TR').includes(q));
  const kart = x => { const on = m.secim === x.code, simdi = x.code === eskiKod;
    return `<button type="button" class="durus-option-card" style="${on ? 'border-color:var(--accent);background:var(--accent-dim)' : ''}" onclick="ydModal.secim='${escJs(x.code)}'; render()">
      <span class="durus-radio" style="${on ? 'border-color:var(--accent)' : ''}"><span style="width:10px;height:10px;border-radius:50%;background:${on ? 'var(--accent)' : 'transparent'}"></span></span>
      <span class="durus-option-name" style="${on ? 'color:var(--accent)' : ''}">${esc(x.code)} · ${esc(x.name)}${simdi ? ' <span style="font-size:11px;color:var(--text-muted);font-weight:500">· şu an burada</span>' : ''}</span></button>`; };
  const favL = uyan.filter(x => fav.has(x.code)), diger = uyan.filter(x => !fav.has(x.code));
  const belOn = m.secim === 'Belirsiz';
  return `${favL.length ? `<div class="durus-option-divider">FAVORİLER</div>${favL.map(kart).join('')}<div class="durus-option-divider">TÜM MAKİNELER</div>` : ''}${diger.map(kart).join('')}
    ${!uyan.length ? `<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:12.5px">"${esc(m.ara)}" ile eşleşen makine yok</div>` : ''}
    <div class="durus-option-divider">DİĞER</div>
    <button type="button" class="durus-option-card dashed" onclick="ydModal.secim='Belirsiz'; render()">
      <span class="durus-radio" style="${belOn ? 'border-color:var(--warn)' : ''}"><span style="width:10px;height:10px;border-radius:50%;background:${belOn ? 'var(--warn)' : 'transparent'}"></span></span>
      <span class="durus-option-name" style="color:var(--text-muted)">Belirsiz / Henüz belli değil</span></button>
    <button type="button" class="durus-option-card dashed" onclick="ydMalzemeBekliyor()">
      <span class="durus-option-name" style="color:var(--warn)">Malzeme bekliyor — Malzeme Bekleyenler'e ekle</span></button>`;
}
function renderYerDuzeltModal(){
  const m = ydModal; if(!m) return '';
  const baslik = m.bul ? 'Yer düzelt / sıraya koy' : 'Yerini değiştir';
  const yeniUst = m.bul ? `<div class="yd-yeni">
      <div class="yd-alanlar">
        <div class="field" style="margin:0;flex:1.4;min-width:150px"><label>İş emri no</label>
          <input id="yd-talep" class="mono" placeholder="ör. 2610020008 — yaz, Enter" value="${esc(m.talepNo)}" oninput="ydModal.talepNo=this.value" onchange="ydTalepCoz()" onkeydown="if(event.key==='Enter') this.blur()"></div>
        ${m.tip === 'yeni' ? `<div class="field" style="margin:0;width:96px"><label>Adet</label>
          <input class="mono" inputmode="numeric" value="${esc(m.adet)}" oninput="this.value=this.value.replace(/\\D/g,''); ydModal.adet=this.value"></div>` : ''}
      </div>
      <div class="yd-bilesen">${[['', 'Tek parça'], ['ZARF', 'Çelik (_Zarf)'], ['ELMAS', 'Karbür (_Elmas)']].map(([k, l]) => `<button type="button" class="chip ${m.bilesen === k ? 'active' : ''}" onclick="ydModal.bilesen='${k}'; ydTalepCoz()">${l}</button>`).join('')}</div>
      ${m.durum ? `<div class="yd-durum" style="--yd:${m.durum.renk}">
        <div class="yd-durum-ust">${m.isEmriNo ? `<span class="mono">${esc(m.talepNo)}</span> <span class="yd-bilgi">${esc(m.isEmriNo)}${m.mamulAdi ? ' · ' + esc(m.mamulAdi) : ''}${m.adet && m.tip !== 'yeni' ? ' · ' + esc(m.adet) + ' adet' : ''}</span>` : ''}</div>
        <div class="yd-durum-metin">${m.durum.metin}</div>
        ${m.durum.detay ? `<div class="yd-bilgi">${m.durum.detay}</div>` : ''}
        ${m.tip ? `<div class="yd-islem">${m.tip === 'yeni' ? 'İşlem: <b>sıraya koy</b>' : `İşlem: <b>yerini değiştir</b> — şu an: <b>${esc(m.eskiYer)}</b>${m.secim ? ` → <b style="color:var(--accent)">${esc(ydSecimEtiketi(m.secim))}</b>` : ''}`}
          ${m.tip === 'sira' ? `<button type="button" class="btn-ghost yd-dugme kucuk" style="color:var(--danger)" onclick="ydSiradanCikar('${escJs(m.siraKey)}')">Sıradan çıkar</button>` : ''}</div>` : ''}
      </div>` : ''}
      ${m.uyari ? `<div class="yd-uyari">${esc(m.uyari)}</div>` : ''}
    </div>` : `<div class="yd-ozet">
      <div><span class="mono" style="font-weight:700;color:var(--accent)">${esc(m.talepNo || m.isEmriNo)}</span>${m.talepNo ? ` <span style="font-size:11.5px;color:var(--text-muted)">${esc(m.isEmriNo)}</span>` : ''}${m.adet ? ` · ${esc(m.adet)} adet` : ''}</div>
      <div class="yd-simdi">Şu an: <b>${esc(m.eskiYer)}</b>${m.secim ? ` → <b style="color:var(--accent)">${esc(ydSecimEtiketi(m.secim))}</b>` : ''}</div>
      ${m.uyari ? `<div class="yd-uyari">${esc(m.uyari)}</div>` : ''}
    </div>`;
  return `<div class="durus-modal-overlay" onclick="if(event.target===this) ydKapat()">
    <div class="durus-modal-panel">
      <div class="durus-modal-handle" style="cursor:pointer" onclick="ydKapat()"></div>
      <div class="durus-modal-header"><div><div class="durus-modal-title">${baslik}</div>
        <div class="durus-modal-sub">${m.bul ? 'İş emri no yazın: şu an nerede olduğu görünür. Bir yerde bekliyorsa yeri değiştirilir, hiç kaydı yoksa sıraya konur. Sahte operasyon açılmaz.' : 'Yanlış bırakılan yeri düzeltir — sahte operasyon açılmaz, rota ve verimlilik etkilenmez. Değişiklik kayda not edilir.'}</div></div>
        <button class="icon-btn" onclick="ydKapat()">${ico('x', 16)}</button></div>
      ${yeniUst}
      ${m.tip ? `<div style="padding:0 16px 8px"><input id="yd-ara" type="search" placeholder="Makine ara — kod ya da ad" value="${esc(m.ara)}" oninput="ydModal.ara=this.value; render()" style="margin:0"></div>
      <div class="durus-modal-list">${ydMakineListesiHtml()}</div>` : `<div class="durus-modal-list"></div>`}
      <div class="durus-modal-footer">
        <button class="durus-modal-footer-btn" ${m.tip && m.secim && !m.busy ? '' : 'disabled'} onclick="ydKaydet()">${m.busy ? 'Kaydediliyor…' : m.tip === 'yeni' ? 'Sıraya koy' : 'Yeri değiştir'}</button>
      </div>
    </div></div>`;
}
/* Arama: sıradaki (kaydı olmayan) iş emirleri de bulunsun */
function ydAramaKartlari(q){
  const s = String(q || '').trim().toUpperCase(); if(!s) return '';
  return isEmriSiraAktif().filter(x => [x.talepNo, x.isEmriNo].some(v => String(v || '').toUpperCase().includes(s))).map(x => `<div class="analiz-chart-box" style="margin-bottom:10px">
    <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:8px">
      <span class="mono" style="font-weight:700;color:var(--accent);font-size:14px">${esc(x.talepNo)}</span>
      <span class="matrix-tag" style="--sb:var(--warn)">Sırada · ilk operasyon</span>
      <span style="font-size:11px;color:var(--text-muted)">U kodu: ${esc(x.isEmriNo)}</span>
    </div>
    <div style="margin-top:8px;font-size:13.5px;font-weight:600;color:var(--warn)">${esc(x.makine)} sırasında bekliyor</div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(x.mamulAdi || '')}${x.mamulAdi ? ' · ' : ''}${esc(x.adet || '?')} adet · ${esc(x.kimAd || x.kim || '')} ${fmtDT(x.ts)}'de sıraya koydu</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${ydSiraDugmeleri(x.key)}</div>
  </div>`).join('');
}
