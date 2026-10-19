/* ==================== ÖNCEKİ OPERASYON NOTLARI (19.10.2026, kullanıcı isteği) ====================
   "Talaşlı imalatta operatör kaynaklı olmayan hatalar oluyor; operatör bunu kendi hatası olmadığını
   belirtmek için Not'a yazıyor. FKK'da kontrol yapan şef bu notları göremediği için parçaya şartlı
   kabul vermek yerine personeli uyarmaya gidebiliyor. Parçaya başlamadan önce notları görebilmeliler."
   Not, her kaydın kendi alanında (entries/{id}/not — başlatırken ya da iş sürerken yazılır). Aynı iş
   emrinin (kaliteIsAnahtari: talep no; yoksa U kodu, dal ekleri birlikte) DİĞER kayıtlarındaki notlar
   şuralarda gösterilir: başlatma formu (Başla'dan hemen önce), aktif iş ve çoklu iş ekranı, FKK sonuç
   penceresi, İş Yoğunluğu iş emri geçmişi. Yalnız okuma — veri modeli değişmedi. */
function oncekiNotlar(ref, haricId){
  if(!ref || (!ref.talepNo && !ref.isEmriNo) || typeof kaliteIsAnahtari !== 'function') return [];
  const k = kaliteIsAnahtari(ref);
  return entriesArray().filter(o => o.id !== haricId && String(o.not || '').trim() && kaliteIsAnahtari(o) === k)
    .sort((a, b) => (a.startTs || 0) - (b.startTs || 0));
}
function oncekiNotlarHtml(ref, haricId, baslik){
  const l = oncekiNotlar(ref, haricId); if(!l.length) return '';
  return `<div class="onceki-not">
    <div class="onceki-not-bas">${ico('alert', 14)} ${baslik || 'Önceki operasyon notları'} <span>${l.length}</span></div>
    ${l.map(o => { const dal = typeof bilesenOfCode === 'function' ? bilesenOfCode(o.isEmriNo) : '';
      return `<div class="onceki-not-satir">
        <div class="onceki-not-kim"><b class="mono">${esc(String(o.makine || '').split(' · ')[0] || '—')}</b>${dal ? ` <small>_${esc(dal)}</small>` : ''} · ${esc(o.operatorName || o.operatorUsername || '')} · ${fmtDT(o.startTs)}</div>
        <div class="onceki-not-metin">"${esc(String(o.not).trim())}"</div>
      </div>`; }).join('')}
  </div>`;
}
/* Başlatma formu: tekli ya da çoklu iş emri — geçerli iş emri yazılmışsa */
function oncekiNotlarFormHtml(){
  if(typeof newForm === 'undefined' || !newForm) return '';
  const kalemler = newForm.cokluMode ? (newForm.cokluItems || []).map(it => ({ no: it.isEmriNo, bilesen: it.bilesen })) : [{ no: newForm.isEmriNo, bilesen: newForm.bilesen }];
  const gorulen = new Set();
  return kalemler.map(k => {
    const no = String(k.no || '').trim(); if(!no || !isEmriValid(no)) return '';
    const ref = resolveTrackingCode(no, k.bilesen || ''), anahtar = kaliteIsAnahtari(ref);
    if(gorulen.has(anahtar)) return ''; gorulen.add(anahtar);
    return oncekiNotlarHtml(ref, null, newForm.cokluMode ? `${esc(ref.talepNo)} — önceki operasyon notları` : 'Başlamadan önce oku — önceki operasyon notları');
  }).join('');
}
