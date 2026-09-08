/* ===================== DOM YAMALAMA (MORPH) =====================
   NEDEN VAR: render() eskiden #app'in TAMAMINI `innerHTML = ...` ile baştan kuruyordu.
   Bu, ekranda tek bir saniye sayacı değişse bile tarayıcıya şunu yaptırıyor:
     eski DOM ağacını tamamen yık → yeni HTML'i parse et → tüm ağacı yeniden kur →
     tüm sayfa için stil hesapla → tüm sayfayı yeniden yerleştir (layout) → yeniden boya.
   Masaüstünde bu maliyet göze batmıyor; telefonda (özellikle en çok veriyi gören
   SuperAdmin'de, Makine Matrisi gibi saniyede bir tetiklenen ekranlarda) uygulamayı
   gözle görülür şekilde kasıyordu.

   Ayrıca app.js'teki scroll konumu kaydetme / imleç (caret) kaydetme / isUserInteracting()
   ile render erteleme mantığının TAMAMI aslında bu yıkıp-yeniden-kurma davranışının yan
   etkilerini yamamak için yazılmıştı — DOM düğümü yok edilince odak ve kaydırma da onunla
   gidiyordu.

   BURADAKİ YAKLAŞIM: aynı HTML string'i üretmeye devam ediyoruz (296 çağrı yerinin hiçbiri
   değişmiyor), ama ekrana basarken eski ve yeni ağacı karşılaştırıp SADECE gerçekten farklı
   olan metinleri/öznitelikleri güncelliyoruz. Değişmeyen düğümler DOM'da aynı nesne olarak
   kalıyor — dolayısıyla odak, imleç, kaydırma, CSS animasyonları ve açık <select> kendiliğinden
   korunuyor.

   ÖNEMLİ SÖZLEŞME: morph'un sonucu, `innerHTML = html` ile BİREBİR aynı görünmelidir. Yani
   form alanlarının değeri de (kullanıcı elle değiştirmiş olsa bile) render'ın ürettiği HTML
   ne diyorsa o olur — eski davranış da buydu. Buradaki tek kazanç, aynı sonuca çok daha az
   DOM işlemiyle varmak. */

/* Yeni HTML'i canlı DOM'a dokunmadan çözümlemek için tek bir <template> yeniden kullanılıyor.
   <template>'in içeriği "inert"tir: parse edilirken stil hesaplanmaz, yerleştirilmez, boyanmaz
   ve resimler indirilmeye başlamaz — asıl pahalı olan kısımlar burada hiç çalışmıyor. */
const _morphTemplate = document.createElement('template');

/* Değeri öznitelikten (attribute) değil, DOM property'sinden okunan alanlar. Kullanıcı bir
   kutuya yazdığında/işaretlediğinde öznitelik DEĞİŞMEZ, sadece property değişir — bu yüzden
   bunları ayrıca elle eşitlemek gerekiyor, yoksa "ekrandaki değer state'i takip etmiyor"
   hatası çıkar. */
function morphFormState(from, to){
  const tag = from.tagName;
  if(tag === 'INPUT'){
    const type = (to.getAttribute('type') || 'text').toLowerCase();
    if(type === 'checkbox' || type === 'radio'){
      const checked = to.hasAttribute('checked');
      if(from.checked !== checked) from.checked = checked;
    } else {
      const v = to.getAttribute('value') || '';
      if(from.value !== v) from.value = v;
    }
  } else if(tag === 'OPTION'){
    const sel = to.hasAttribute('selected');
    if(from.selected !== sel) from.selected = sel;
  }
}

function morphAttributes(from, to){
  const toAttrs = to.attributes;
  for(let i = 0; i < toAttrs.length; i++){
    const a = toAttrs[i];
    if(from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
  }
  /* Sondan başa geziyoruz: removeAttribute canlı NamedNodeMap'i kısaltıyor, baştan gitseydik
     araya giren öznitelikleri atlardık. */
  const fromAttrs = from.attributes;
  for(let i = fromAttrs.length - 1; i >= 0; i--){
    const name = fromAttrs[i].name;
    if(!to.hasAttribute(name)) from.removeAttribute(name);
  }
}

/* İki düğümün "aynı şey" sayılıp yamanabileceğine karar verir. id verilmişse id de tutmalı —
   yoksa yan yana duran iki farklı panel birbirine yamanır ve #id ile erişen kodlar şaşırır. */
function morphSameNode(a, b){
  if(a.nodeType !== b.nodeType) return false;
  if(a.nodeType !== 1) return true;              // metin/yorum düğümü: içeriği güncellenir
  if(a.tagName !== b.tagName) return false;
  return (a.id || '') === (b.id || '');
}

function morphNode(from, to){
  if(from.nodeType !== 1){                        // metin ya da yorum
    if(from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  morphAttributes(from, to);
  /* <select> ve <textarea>'nın hedef değeri çocuklar yamanmadan ÖNCE okunmak zorunda:
     morphChildren, `to`nun çocuk düğümlerini canlı ağaca TAŞIYOR — sonrasında `to` boşalmış
     olacağı için to.value '' döner ve alanı yanlışlıkla temizlerdik. */
  const tag = from.tagName;
  const wantValue = (tag === 'SELECT' || tag === 'TEXTAREA') ? to.value : null;
  morphChildren(from, to);
  morphFormState(from, to);
  /* Seçili değer ancak <option>'lar yerine oturduktan sonra atanabilir — aksi halde henüz
     var olmayan bir seçeneğe atama yapıp değer boşa düşer. */
  if(wantValue !== null && from.value !== wantValue) from.value = wantValue;
}

function morphChildren(from, to){
  let fromChild = from.firstChild;
  let toChild = to.firstChild;
  while(toChild){
    const nextTo = toChild.nextSibling;
    if(!fromChild){
      /* Eski ağaçta karşılığı kalmadı: yeni düğümü buraya taşı. toChild inert <template>
         içeriğinden geldiği için taşımak (clone değil) hem yeterli hem daha ucuz. */
      from.appendChild(toChild);
      toChild = nextTo;
      continue;
    }
    const nextFrom = fromChild.nextSibling;
    if(morphSameNode(fromChild, toChild)){
      morphNode(fromChild, toChild);
    } else {
      from.replaceChild(toChild, fromChild);
    }
    fromChild = nextFrom;
    toChild = nextTo;
  }
  /* Yeni ağaçta karşılığı olmayan fazlalık düğümleri sil. */
  while(fromChild){
    const nextFrom = fromChild.nextSibling;
    from.removeChild(fromChild);
    fromChild = nextFrom;
  }
}

/* Dışarıya açılan tek fonksiyon: `el.innerHTML = html` ile aynı sonucu üretir, ama yalnızca
   farkları uygular. */
function morphInto(el, html){
  _morphTemplate.innerHTML = html;
  morphChildren(el, _morphTemplate.content);
  _morphTemplate.innerHTML = '';
}
