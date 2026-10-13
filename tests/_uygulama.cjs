/* Hesap testleri için uygulamayı tarayıcısız yükler (13.10.2026).
   index.html'deki js/ ve ui/ betiklerini SIRASIYLA tek bir vm bağlamında çalıştırır; DOM, Firebase,
   localStorage gibi tarayıcı nesneleri boş taklitlerle karşılanır. Böylece testler canlı uygulamanın
   AYNI fonksiyonlarını çağırır — ayrı bir kopya yok, kod değişince test de onu dener.
   Saat dilimi atölyeninki: gün sınırları (08:00, 17:30, gece yarısı) buna göre. */
process.env.TZ = 'Europe/Istanbul';
const vm = require('vm'), fs = require('fs'), path = require('path');
const KOK = path.join(__dirname, '..');

function uygulamaYukle(){
  const bos = () => {};
  const el = new Proxy(function(){}, { get: (t, k) => k === 'style' ? {} : k === Symbol.toPrimitive ? () => '' : el, apply: () => el, construct: () => el });
  const ctx = {
    console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: bos, Date, Math, JSON, Intl, URL,
    TextEncoder, TextDecoder, crypto: globalThis.crypto,
    localStorage: { getItem: () => null, setItem: bos, removeItem: bos }, sessionStorage: { getItem: () => null, setItem: bos },
    navigator: { userAgent: 'node-test' }, location: { search: '', hash: '', href: '' },
    matchMedia: () => ({ matches: false, addEventListener: bos, addListener: bos }),
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: bos,
      createElement: () => el, documentElement: { style: {}, classList: { add: bos, remove: bos, toggle: bos }, setAttribute: bos }, body: el, visibilityState: 'visible' },
    addEventListener: bos, removeEventListener: bos, requestAnimationFrame: bos, firebase: undefined
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
  const betikler = [...html.matchAll(/<script src="((?:js|ui)\/[^"?]+)/g)].map(m => m[1]);
  for(const b of betikler) vm.runInContext(fs.readFileSync(path.join(KOK, b), 'utf8'), ctx, { filename: b });
  const calistir = kod => vm.runInContext(kod, ctx);
  /* Uygulamanın `let` değişkenleri bağlamın özelliği değil — atama kodla yapılır */
  const ata = (ad, deger) => { ctx.__deger = deger; vm.runInContext(`${ad} = __deger`, ctx); };
  return { ctx, calistir, ata };
}
/* Yerel saatle zaman damgası: ts('2026-10-05 08:00') */
function ts(s){ return new Date(s.replace(' ', 'T') + ':00').getTime(); }
const DK = 60000, SA = 3600000;
module.exports = { uygulamaYukle, ts, DK, SA };
