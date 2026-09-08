/* ===================== CANLI DEĞERLER (SANİYELİK TİK) =====================
   SORUN: saniyede bir çalışan tik (bkz. js/tadilat.js sonundaki setInterval) ekranda sadece
   geçen süre sayaçlarını ilerletmek için TÜM EKRANI yeniden üretiyordu — renderAdmin() /
   renderOperator() baştan çalışıp bütün kayıtlar üzerinde tekrar toplama/filtreleme yapıyor,
   sonuç string parse edilip DOM'a uygulanıyordu. Yani "00:12:34" yazısının "00:12:35" olması
   için makinelerin çalışma süreleri, duruş kırılımları, sıralamalar... hepsi yeniden
   hesaplanıyordu.

   ÇÖZÜM: şablonlar, saniyede bir değişen değerleri live() ile sarıyor. live() değeri o an
   hesaplayıp basar, ayrıca onu ÜRETEN kapanışı (closure) kaydeder. Tik geldiğinde artık
   refreshLive() çağrılıyor: hiç HTML üretilmiyor, parse edilmiyor, ağaç gezilmiyor —
   yalnızca kayıtlı düğümlerin metni yeniden hesaplanıp (değiştiyse) yazılıyor.

   ui/morph.js ile ilişkisi: morph, TAM render'ı ucuzlatıyor (Firebase güncellemesi geldiğinde,
   sekme değiştiğinde). live() ise saniyelik tik'in tam render'a hiç girmemesini sağlıyor.
   İkisi birbirinin yerine değil, farklı yolları hızlandırıyor.

   KAPSAM SINIRI — bilerek: live() yalnızca saniyede bir değişen METİNLERİ kapsıyor. Eşik
   aşımıyla ortaya çıkan görsel durumlar (ör. "uzun süredir duruşta" kartının kırmızıya
   dönmesi) ya da sıralamanın değişmesi bir metin değil, yapı değişikliğidir. Bunlar için
   renderLiveBits() her 15. tik'te yine TAM render yapıyor (bkz. js/app.js LIVE_FULL_EVERY) —
   yani bayatlık en fazla 15 saniye, maliyetin 14/15'i ise ortadan kalkıyor. */

let liveFns = [];

/* Her render'ın BAŞINDA çağrılır — indeksler o render'da basılan data-live sırasıyla
   birebir eşleşmek zorunda. */
function liveReset(){ liveFns = []; }

/* Şablonda kullanım:
     ${live(() => fmtElapsed(entryDurationBreakdown(info).netMs))}
   Metin döndüren bir fonksiyon ver; başka bir şey değil (HTML basmak için değil — güncelleme
   textContent ile yapılıyor, yani içine yazılan her şey düz metin olarak görünür). */
function live(fn, extraClass){
  const i = liveFns.length;
  liveFns.push(fn);
  let v = '';
  try { v = String(fn()); } catch(e){}
  return `<span data-live="${i}"${extraClass ? ` class="${extraClass}"` : ''}>${esc(v)}</span>`;
}

/* ---- Görünürlük takibi ----
   Makine Matrisi'nde DOM'da onlarca kart var ama telefon ekranına aynı anda 8-10'u sığıyor.
   Görünmeyen kartların sayaçlarını her saniye güncellemek saf israf: her yazma bir yerleşim
   (layout) daha demek ve ölçümde kalan maliyetin neredeyse tamamı buydu.

   getBoundingClientRect ile bakmak işe yaramaz — onu 600 düğüm için okumak zorunlu bir layout
   tetikler, yani çözmeye çalıştığımız maliyeti aynen ödemiş olurduk. IntersectionObserver bunu
   tarayıcı tarafında, layout tetiklemeden bildiriyor.

   Varsayılan "görünür": gözlemci ilk raporunu asenkron veriyor, o gelene kadar hiçbir sayacı
   atlamıyoruz. rootMargin ile ekranın hemen dışındakiler de taze tutuluyor, böylece kaydırma
   sırasında bayat bir değer görünmüyor. */
let liveObserver = null;
let liveOffscreen = new Set();

function liveTrackVisibility(){
  if(typeof IntersectionObserver !== 'function') return; // desteklenmiyorsa hepsi güncellenir
  if(!liveObserver){
    liveObserver = new IntersectionObserver(entries => {
      for(const en of entries){
        if(en.isIntersecting) liveOffscreen.delete(en.target);
        else liveOffscreen.add(en.target);
      }
    }, { rootMargin: '300px' });
  }
  liveObserver.disconnect();
  liveOffscreen = new Set(); // DOM yenilendi, eski kararlar geçersiz
  const els = document.querySelectorAll('[data-live]');
  for(let i = 0; i < els.length; i++) liveObserver.observe(els[i]);
}

/* Saniyelik tik bunu çağırır. Kaç düğüm güncellendiyse onu döndürür (ölçüm/teşhis için). */
function refreshLive(){
  if(!liveFns.length) return 0;
  const els = document.querySelectorAll('[data-live]');
  let changed = 0;
  for(let i = 0; i < els.length; i++){
    const el = els[i];
    if(liveOffscreen.has(el)) continue; // ekranda değil — bir sonraki tam render'da yine hesaplanır
    const fn = liveFns[+el.getAttribute('data-live')];
    if(!fn) continue;
    let v;
    try { v = String(fn()); } catch(e){ continue; }
    /* Değişmeyen düğüme dokunmuyoruz: gereksiz yazma, gereksiz yerleşim (layout) demek. */
    if(el.textContent !== v){ el.textContent = v; changed++; }
  }
  return changed;
}
