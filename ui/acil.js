/* ==================== ACİL İŞ EMİRLERİ (06.11.2026, kullanıcı isteği) ====================
   "Şef ve SuperAdmin bazı iş emirlerini acil olarak belirtebilsin. İş o kişinin sırasında bekliyorsa
   (ör. tornanın sırasında) yeni işe başlarken uyarı çıksın: 'Sıranızda bekleyen acil bir iş var,
   iş emri no: …'."
   isEmriAcil/{TALEPNO_TAKİPKODU} = { talepNo, isEmriNo, ts, kim, kimAd }
   - İşaretleme İş Yoğunluğu'nda (arama kartı, geçmiş penceresi, makine sıraları) — yalnız Şef / SuperAdmin.
   - Acil iş nerede bekliyor: son kaydı bitmiş ve bırakılan yeri (sonrakiMakine) o makine olan, ya da hiç
     kaydı açılmadan o makinenin sırasına konmuş (isEmriSira) iş emri — İş Yoğunluğu kuyruğunun aynı kuralı.
     Makinede Başla'ya basılınca sıradan düşer, uyarı kendiliğinden kalkar; işaret Şef kaldırana kadar durur
     (iş bir sonraki makinenin sırasına geçince orada da acil sayılır).
   - Operatör: başlatma formunda makine seçilince kırmızı uyarı + "Bu işi seç"; başka bir işe Başla derse
     onay sorar — engel değil (operatör o anki işi bitirmek zorunda olabilir).
   KURAL: isEmriAcil { ".read": true, ".write": false, "$k": { ".write": true } } (Console'dan). */
let isEmriAcil = {}, _isEmriAcilDinleniyor = false;
function ensureIsEmriAcilLoaded(){
  if(_isEmriAcilDinleniyor || typeof DB === 'undefined' || !DB) return;
  _isEmriAcilDinleniyor = true;
  DB.ref('isEmriAcil').on('value', s => { isEmriAcil = s.val() || {}; safeRender(); },
    err => { isEmriAcil = {}; console.warn('isEmriAcil okunamadı (kural yayınlandı mı?):', err && err.message); });
}
function acilYetki(){ return typeof canManageStock === 'function' && canManageStock(); }
function acilAnahtar(talepNo, isEmriNo){
  return (String(talepNo || '').trim().toUpperCase() + '_' + String(isEmriNo || '').trim().toUpperCase()).replace(/[.#$\[\]\/]/g, '-');
}
function acilMi(talepNo, isEmriNo){ ensureIsEmriAcilLoaded(); return !!(isEmriAcil || {})[acilAnahtar(talepNo, isEmriNo)]; }
function acilDegistir(talepNo, isEmriNo){
  if(!acilYetki()){ toast('Bu işlem için Şef ya da SuperAdmin yetkisi gerekli'); return; }
  const key = acilAnahtar(talepNo, isEmriNo), vardi = !!(isEmriAcil || {})[key], etiket = talepNo || isEmriNo;
  const ref = DB.ref('isEmriAcil/' + key);
  (vardi ? ref.remove() : ref.set({ talepNo: String(talepNo || '').trim().toUpperCase(), isEmriNo: String(isEmriNo || '').trim().toUpperCase(),
    ts: Date.now(), kim: session.username, kimAd: session.displayName || session.username }))
    .then(() => toast(vardi ? etiket + ' artık acil değil' : etiket + ' acil — sırasındaki makinede yeni işe başlayan uyarılacak'))
    .catch(err => toast('Kaydedilemedi: ' + ((err && err.message) || 'hata') + ' — isEmriAcil kuralı yayınlandı mı?'));
}
/* Bir makinenin sırasında bekleyen acil iş emirleri (makine "KOD · Ad" ya da yalnız kod) */
function acilBekleyenler(makine){
  ensureIsEmriAcilLoaded();
  const kod = s => String(s || '').split(' · ')[0].trim().toUpperCase();
  const hedef = kod(makine);
  const istenen = new Map(Object.values(isEmriAcil || {}).filter(a => a && a.isEmriNo).map(a => [isEmriAnahtari(a), a]));
  if(!hedef || !istenen.size) return [];
  const son = {};
  entriesArray().forEach(e => { const k = isEmriAnahtari(e); if(istenen.has(k) && (!son[k] || (e.startTs || 0) > (son[k].startTs || 0))) son[k] = e; });
  const sira = typeof isEmriSiraAktif === 'function' ? isEmriSiraAktif() : [];
  const sonuc = [];
  istenen.forEach((a, k) => {
    const e = son[k], x = e ? null : sira.find(s => isEmriAnahtari(s) === k);
    const yer = e ? (e.status === 'tamamlandi' ? e.sonrakiMakine || '' : '') : (x ? x.makine : '');
    if(yer && kod(yer) === hedef) sonuc.push({ ...a, yer });
  });
  return sonuc.sort((p, q) => (p.ts || 0) - (q.ts || 0));
}
/* Operatörün başlatma formu: makine seçilince */
function acilUyariFormHtml(makine){
  const l = acilBekleyenler(makine); if(!l.length) return '';
  const secili = !newForm.cokluMode && newForm.isEmriNo ? isEmriAnahtari(resolveTrackingCode(newForm.isEmriNo, newForm.bilesen)) : '';
  return `<div class="acil-uyari" role="alert">
    <div class="acil-uyari-bas">${ico('alert', 16)} Sıranızda bekleyen ACİL ${l.length > 1 ? l.length + ' iş' : 'bir iş'} var</div>
    ${l.map(a => { const ad = isEmriMamulAdi(a.talepNo, a.isEmriNo); return `<div class="acil-uyari-satir">
      <div style="min-width:0"><div>İş emri no: <b class="mono">${esc(a.talepNo || a.isEmriNo)}</b></div>${ad ? `<div class="acil-uyari-ad">${esc(ad)}</div>` : ''}</div>
      ${newForm.cokluMode ? '' : secili === isEmriAnahtari(a) ? `<span class="acil-uyari-secili">${ico('check', 13)} seçili</span>`
        : `<button type="button" class="btn-ghost acil-uyari-dugme" onclick="acilFormaAl('${escJs(a.talepNo)}','${escJs(a.isEmriNo)}')">Bu işi seç</button>`}
    </div>`; }).join('')}
  </div>`;
}
function acilFormaAl(talepNo, isEmriNo){ newForm.isEmriNo = talepNo || isEmriNo; newForm.bilesen = bilesenOfCode(isEmriNo) || ''; render(); }
/* Başla: sıradaki acil iş yerine başka işe başlanıyorsa sor (baslananlar: [{ talepNo, isEmriNo }]) */
function acilBaslatOnayi(makine, baslananlar){
  const set = new Set(baslananlar.map(isEmriAnahtari));
  const kalan = acilBekleyenler(makine).filter(a => !set.has(isEmriAnahtari(a)));
  if(!kalan.length) return true;
  return confirm('Sıranızda bekleyen ACİL iş var:\n' + kalan.map(a => { const ad = isEmriMamulAdi(a.talepNo, a.isEmriNo); return '• İş emri no: ' + (a.talepNo || a.isEmriNo) + (ad ? ' — ' + ad : ''); }).join('\n')
    + '\n\nYine de bu işe başlansın mı?');
}
/* İş Yoğunluğu: işaretle / kaldır düğmesi ve rozet */
function acilDugme(talepNo, isEmriNo, kucuk){
  if(!acilYetki()) return '';
  const on = acilMi(talepNo, isEmriNo);
  return `<button type="button" class="btn-ghost acil-dugme${on ? ' on' : ''}${kucuk ? ' kucuk' : ''}" title="${on ? 'Acil işaretini kaldır' : 'Acil olarak işaretle — sırasındaki makinede yeni işe başlayan uyarılır'}" onclick="event.stopPropagation(); acilDegistir('${escJs(talepNo || '')}','${escJs(isEmriNo || '')}')">${ico('alert', 12)} ${on ? 'Acil · kaldır' : 'Acil yap'}</button>`;
}
function acilRozet(talepNo, isEmriNo){ return acilMi(talepNo, isEmriNo) ? '<span class="acil-rozet">ACİL</span>' : ''; }
