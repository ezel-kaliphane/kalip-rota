/* ==================== STANDART ÜRÜN AĞACI — CANIAS KODU BAŞINA BOM + ROTA (07.10.2026) ====================
   Kullanıcı: "Şef ve SuperAdmin için BOM'ları ve rotaları değiştirme olsun (yalnız bu ikisi);
   sistem CANIAS kodundan takip ettiği için aynı CANIAS kodlu iş geldiğinde hammaddesi ve rotası
   otomatik gelsin." Kararlar: düzenleme o CANIAS kodunun (U kodu) STANDARDI olur — gerçekleşen
   kayıtlar (hangi makinede kim çalıştı) değişmez; yeni işte standart ÖNERİ olarak gelir,
   operatör değiştirebilir; ilk operasyonda hammadde boş geçilirse uyarı sorar (engellemez).

   Veri: mevcut hammaddeRecete/{U} düğümü (kural değişikliği yok):
     hammaddeId, hammaddeKod, birim, birimBasina  — çelik hammadde (malzeme bekleyen akışı da okuyor)
     karbur: { satirlar:[{tip:'kesim',disCap,delik,kalite,boy,adet,katalogId,kod} | {tip:'adet',katalogId,kod,adet}],
               standart:true, ... }               — kesim planı aynı mamulde bunu dolduruyor
     rota:   { elmas:[makine], zarf:[makine], ana:[makine] }
     standart: { by, byName, ts, talep }        — Şef/SuperAdmin tanımladı işareti
   Standart varken kendiliğinden biriken reçete (malzeme bekleyen / karbür kaydı) onu EZMEZ. */

function canEditUrunAgaci(){ return !!(session && (session.isSuperAdmin || session.isSef)); }
function urunStandardi(uKodu){
  const r = (typeof hammaddeRecete !== 'undefined' && hammaddeRecete) ? hammaddeRecete[String(uKodu || '').toUpperCase()] : null;
  return (r && r.standart) ? r : null;
}

/* ---------- Sıradaki operasyon önerisi ----------
   Bitirilen kaydın dalındaki (ANA/_ZARF/_ELMAS) standart rotada şu makinenin yeri bulunur:
   aynı iş emrinin (talep no) bu daldaki geçmişinde bu makineye kaçıncı kez gelindiyse rotadaki
   o sıradaki geçiş alınır; bulunamazsa geçmişteki adım sayısına göre konum. Dalın sonundaysa
   (_ZARF/_ELMAS) birleşme — ana rotanın ilk makinesi (genelde pres). */
function rotaSiradakiOneri(e){
  if(!e || !e.isEmriNo) return null;
  const std = urunStandardi(baseIsEmriNo(e.isEmriNo));
  if(!std || !std.rota) return null;
  const dal = bilesenOfCode(e.isEmriNo);
  const liste = (std.rota[dal === 'ZARF' ? 'zarf' : dal === 'ELMAS' ? 'elmas' : 'ana'] || []).slice();
  const ana = (std.rota.ana || []).slice();
  if(!liste.length && !(dal && ana.length)) return null;
  const m = String(e.makine || '').split(' · ')[0].toUpperCase();
  const t = String(e.talepNo || '').trim().toUpperCase();
  const gecmis = entriesArray().filter(x => x.isEmriNo === e.isEmriNo && (!t || String(x.talepNo || '').trim().toUpperCase() === t)
      && (x.startTs || 0) <= (e.startTs || 0)).sort((a, b) => (a.startTs || 0) - (b.startTs || 0));
  const zincir = [];
  gecmis.forEach(x => { const k = String(x.makine || '').split(' · ')[0].toUpperCase(); if(zincir[zincir.length - 1] !== k) zincir.push(k); });
  if(zincir[zincir.length - 1] !== m) zincir.push(m);
  const kacinci = zincir.filter(k => k === m).length;
  let idx = -1, say = 0;
  for(let i = 0; i < liste.length; i++){ if(liste[i] === m && ++say === kacinci){ idx = i; break; } }
  if(idx < 0) idx = Math.min(zincir.length - 1, liste.length - 1);
  let sonraki = liste[idx + 1] || null;
  if(!sonraki && dal) sonraki = ana[0] || null;
  return (sonraki && allMachineCodes().includes(sonraki) && sonraki !== m) ? sonraki : null;
}
/* Sıradaki operasyon penceresi için: bekleyen kayıt (ya da grubun hepsi aynı öneriyi veriyorsa) */
function nextOpRotaOnerisi(){
  if(typeof kaliteBekleyen !== 'undefined' && (kaliteBekleyen[nextOpPendingId] || kaliteBekleyen['g:' + nextOpPendingGroupId])) return null; // red → düzeltme
  if(nextOpPendingId) return rotaSiradakiOneri(STATE.entries[nextOpPendingId]);
  if(nextOpPendingGroupId){
    const l = entriesArray().filter(x => x.groupId === nextOpPendingGroupId && (x.status === 'devam' || x.status === 'duruş'));
    const o = [...new Set(l.map(rotaSiradakiOneri))];
    return (o.length === 1 && o[0]) ? o[0] : null;
  }
  return null;
}

/* ---------- İlk operasyon: standart hammadde ---------- */
function urunStandartHammadde(isEmriNo){
  const u = baseIsEmriNo(isEmriNo);
  if(bilesenOfCode(isEmriNo) === 'ELMAS') return null;   // karbür dalı — çelik hammadde yok
  const r = (typeof hammaddeRecete !== 'undefined' && hammaddeRecete) ? hammaddeRecete[u] : null;
  return (r && r.hammaddeId) ? r : null;
}
/* Operatör formunda bir kez önceden seçer (kullanıcı değiştirirse dokunmaz). Yalnız adetle
   takip edilen kalem seçilir; boy (lot) takipli çubukta hangi lot olduğu operatöre kalır. */
function urunHammaddeOnSecim(hedef, isEmriNo, anahtar){
  if(typeof hammaddeReceteReady !== 'undefined' && !hammaddeReceteReady) return;   // reçete gelince yeniden denenir
  if(hedef.receteOto === anahtar) return;
  hedef.receteOto = anahtar;
  if(hedef.stockItemId) return;
  const r = urunStandartHammadde(isEmriNo);
  if(r && stockConsumableOptions().some(o => o.value === r.hammaddeId)) hedef.stockItemId = r.hammaddeId;
}
function urunHammaddeIpucuHtml(isEmriNo){
  const r = urunStandartHammadde(isEmriNo);
  if(!r) return '';
  return `<div style="font-size:11.5px;color:var(--accent);margin:-2px 0 8px">★ Bu CANIAS kodunun ${r.standart ? 'standart' : 'son kullanılan'} hammaddesi: <b>${esc(r.hammaddeKod || '')}</b>${Number(r.birimBasina) > 0 ? ` · parça başı ${esc(String(Math.round(r.birimBasina * 100) / 100))} ${esc(r.birim || '')}` : ''}</div>`;
}

/* ---------- Düzenleme penceresi durumu ---------- */
let bomDuzenle = null;   // { uKodu, talep, mamulAdi, zarf, elmas, hammadde, birimBasina, karbur:[{kod,boy,adet}], rota:{elmas,zarf,ana}, busy }

function bomDuzenleAc(uKodu){
  if(!canEditUrunAgaci()){ toast('Bu işlem yalnız Şef ve SuperAdmin için'); return; }
  const x = (bomRotaListesi() || []).find(y => y.uKodu === uKodu) || { uKodu, zarf: [], elmas: [], zElmas: [], zZarf: [], zAna: [] };
  if(typeof ensureKarburKatalogLoaded === 'function') ensureKarburKatalogLoaded(() => safeRender());
  const std = urunStandardi(uKodu) || {}, rc = (hammaddeRecete || {})[uKodu] || {};
  // Hammadde: standart → reçete → bu iş emrinde stoktan düşülen kalem
  let hmId = rc.hammaddeId || '';
  if(!hmId && x.hammadde && x.hammadde.kaynak === 'stok'){
    const it = stockItemsArray().find(s => (s.isim || s.kod) === x.hammadde.ad || hammaddeGosterimAdi(s) === x.hammadde.ad);
    if(it) hmId = it.id;
  }
  const hmIt = hmId ? stockItems[hmId] : null;
  // Karbür: standart satırlar → bu iş emrinin karbür çıkışları
  let karbur = [];
  const ks = (rc.karbur && Array.isArray(rc.karbur.satirlar)) ? rc.karbur.satirlar : [];
  if(ks.length){
    karbur = ks.map(s => ({ kod: s.kod || (s.katalogId && karburKatalog[s.katalogId] ? karburKatalog[s.katalogId].kod : '') || ('Ø' + karburFmt(s.disCap) + ' ' + (s.kalite || '')), boy: s.tip === 'kesim' ? karburFmt(s.boy) : '', adet: String(s.adet || '') }));
  } else if(x.karbur && x.karbur.satir){
    karbur = x.karbur.satir.filter(s => s.kod).map(s => {
      /* "3 × 33 mm" (tahsis: testere payı dahil), "3 × 40 mm (kesimsiz)" (pay yok), "156 mm" (eski biçim, tek parça) */
      const t = String(s.boy || ''), kesimsiz = /kesimsiz/.test(t), pay = kesimsiz ? 0 : KARBUR_PAY_VARSAYILAN;
      const m = /(\d+)\s*×\s*([\d.,]+)\s*mm/.exec(t) || /()([\d.,]+)\s*mm/.exec(t);
      return { kod: s.kod, boy: m ? karburFmt(karburNum(m[2]) - pay) : '', adet: (m && m[1]) ? m[1] : '1' };
    });
  }
  const rota = std.rota || {};
  bomDuzenle = {
    uKodu, talep: x.talep || '', mamulAdi: x.mamulAdi || '',
    dalZarf: !!(x.zarf && x.zarf.length) || !!(rota.zarf && rota.zarf.length),
    dalElmas: !!(x.elmas && x.elmas.length) || !!(rota.elmas && rota.elmas.length) || karbur.length > 0,
    hammadde: hmIt ? hammaddeGosterimAdi(hmIt) : '', hammaddeId: hmId,
    birimBasina: Number(rc.birimBasina) > 0 ? String(Math.round(rc.birimBasina * 1000) / 1000).replace('.', ',') : '',
    karbur: karbur.length ? karbur : [],
    rota: {
      elmas: (rota.elmas || x.zElmas || []).slice(),
      zarf:  (rota.zarf  || x.zZarf  || []).slice(),
      ana:   (rota.ana   || x.zAna   || []).slice()
    },
    secili: null, aktifDal: 'ana',
    standartVar: !!std.standart, std: std.standart || null, busy: false
  };
  render();
}
function bomDuzenleKapat(){ bomDuzenle = null; render(); }
function bomDuzenleHammaddeYaz(v){
  const d = bomDuzenle; if(!d) return;
  d.hammadde = v;
  const it = stockItemsArray().find(s => hammaddeGosterimAdi(s) === v || s.kod === v);
  d.hammaddeId = it ? it.id : '';
}
/* ---------- Rota düzenleyici: kutular (07.10.2026, kullanıcı: "elle yazmak zor, kutular olsun
   sürükleyip bıraksın, arasına ya da nereye isterse") ----------
   Fareyle: kutuyu sürükleyip iki kutunun arasındaki boşluğa bırak; alttaki makine listesinden
   sürükleyip istediğin yere bırak. Dokunmatikte / tıklayarak: kutuya ya da listedeki makineye
   dokun (seçilir), sonra gitmesini istediğin boşluğa dokun. Listedeki makineye çift tıklamak
   onu seçili dalın sonuna ekler. × kutuyu çıkarır. */
function rotaEdYenile(){
  const g = document.querySelector('.kal-modal-govde'), y = g ? g.scrollTop : 0;
  render();
  const g2 = document.querySelector('.kal-modal-govde'); if(g2) g2.scrollTop = y;
}
function rotaEdYerlestir(kaynak, dal, pos){
  const d = bomDuzenle; if(!d || !kaynak) return;
  const hedef = d.rota[dal]; if(!hedef) return;
  if(kaynak.tip === 'tasi'){
    const liste = d.rota[kaynak.dal]; const kod = liste[kaynak.i]; if(kod == null) return;
    liste.splice(kaynak.i, 1);
    if(kaynak.dal === dal && kaynak.i < pos) pos--;
    hedef.splice(pos, 0, kod);
  } else if(kaynak.tip === 'yeni' && kaynak.kod){
    hedef.splice(pos, 0, kaynak.kod);
  }
  d.secili = null; d.aktifDal = dal;
  rotaEdYenile();
}
function rotaEdDragStart(ev, veri){ try{ ev.dataTransfer.setData('text/plain', veri); ev.dataTransfer.effectAllowed = 'move'; }catch(e){} }
function rotaEdKaynak(veri){
  const p = String(veri || '').split(':');
  if(p[0] === 'tasi') return { tip: 'tasi', dal: p[1], i: Number(p[2]) };
  if(p[0] === 'yeni') return { tip: 'yeni', kod: p.slice(1).join(':') };
  return null;
}
function rotaEdDrop(ev, dal, pos){
  ev.preventDefault();
  let veri = ''; try{ veri = ev.dataTransfer.getData('text/plain'); }catch(e){}
  rotaEdYerlestir(rotaEdKaynak(veri), dal, pos);
}
function rotaEdBosluk(dal, pos){
  const d = bomDuzenle; if(!d) return;
  if(!d.secili){ d.aktifDal = dal; toast('Önce bir kutuya ya da alttaki listeden bir makineye dokun, sonra buraya'); rotaEdYenile(); return; }
  rotaEdYerlestir(d.secili, dal, pos);
}
function rotaEdSec(kaynak){
  const d = bomDuzenle; if(!d) return;
  const ayni = d.secili && JSON.stringify(d.secili) === JSON.stringify(kaynak);
  d.secili = ayni ? null : kaynak;
  if(kaynak.tip === 'tasi') d.aktifDal = kaynak.dal;
  rotaEdYenile();
}
function rotaEdSonaEkle(kod){
  const d = bomDuzenle; if(!d) return;
  const dal = d.rota[d.aktifDal] ? d.aktifDal : 'ana';
  d.rota[dal].push(kod); d.secili = null;
  rotaEdYenile();
}
function rotaEdSil(dal, i){ const d = bomDuzenle; if(!d) return; d.rota[dal].splice(i, 1); d.secili = null; rotaEdYenile(); }
function rotaEdDalEkle(dal){ const d = bomDuzenle; if(!d) return; if(dal === 'zarf') d.dalZarf = true; else d.dalElmas = true; d.aktifDal = dal; rotaEdYenile(); }
function rotaEdFiltre(v){
  const q = String(v || '').trim().toLocaleUpperCase('tr');
  document.querySelectorAll('.rota-palet .rota-kutu').forEach(el => {
    el.style.display = (!q || (el.getAttribute('data-ara') || '').includes(q)) ? '' : 'none';
  });
}

function bomDuzenleKarburEkle(){ if(bomDuzenle){ bomDuzenle.karbur.push({ kod: '', boy: '', adet: '1' }); bomDuzenle.dalElmas = true; render(); } }
function bomDuzenleKarburSil(i){ if(bomDuzenle){ bomDuzenle.karbur.splice(i, 1); render(); } }

function bomDuzenleKaydet(){
  const d = bomDuzenle;
  if(!d || d.busy || !canEditUrunAgaci()) return;
  const u = d.uKodu;
  if(!u || /[.#$\[\]\/]/.test(u)){ toast('Geçersiz CANIAS kodu'); return; }
  // Hammadde
  if(d.hammadde && !d.hammaddeId){ toast('Hammadde listede bulunamadı — listeden seç'); return; }
  const it = d.hammaddeId ? stockItems[d.hammaddeId] : null;
  const bb = karburNum(d.birimBasina);
  // Karbür
  const katalog = karburKatalogArray();
  const satirlar = [];
  for(const k of d.karbur){
    if(!k.kod && !k.boy) continue;
    const item = katalog.find(c => c.kod === String(k.kod || '').trim().toUpperCase() || c.kod === String(k.kod || '').trim());
    if(!item){ toast('Karbür kodu katalogda yok: ' + (k.kod || '—')); return; }
    const adet = parseInt(k.adet, 10) || 0;
    if(!(adet > 0)){ toast(item.kod + ': adet gir'); return; }
    if((item.kullanim || 'kesim') === 'kesim'){
      const boy = karburNum(k.boy);
      if(!(boy > 0)){ toast(item.kod + ': kesilecek parça boyunu gir (mm)'); return; }
      satirlar.push({ tip: 'kesim', disCap: item.disCap, delik: item.delik || '', kalite: item.kalite || '', boy, adet, birimBasina: 0, katalogId: item.id, kod: item.kod });
    } else {
      satirlar.push({ tip: 'adet', katalogId: item.id, kod: item.kod, adet, birimBasina: 0 });
    }
  }
  // Rota
  const rota = { elmas: d.rota.elmas.slice(), zarf: d.rota.zarf.slice(), ana: d.rota.ana.slice() };
  const bilinen = new Set(allMachineCodes());
  const bilinmeyen = [...new Set([].concat(rota.elmas, rota.zarf, rota.ana).filter(c => !bilinen.has(c)))];
  if(bilinmeyen.length && !confirm('Makine listesinde olmayan kod(lar): ' + bilinmeyen.join(', ') + '\n\nYine de kaydedilsin mi?')) return;
  if(!rota.elmas.length && !rota.zarf.length && !rota.ana.length){ toast('Rota boş — en az bir makine yaz'); return; }

  const now = Date.now(), p = 'hammaddeRecete/' + u + '/';
  const updates = {};
  updates[p + 'hammaddeId'] = it ? d.hammaddeId : null;
  updates[p + 'hammaddeKod'] = it ? hammaddeEtiket(it) : null;   // malzeme bekleyen akışıyla aynı etiket
  updates[p + 'birim'] = it ? (it.birim || (it.tur === 'boy' ? 'mm' : 'adet')) : null;
  updates[p + 'birimBasina'] = (it && bb > 0) ? bb : null;
  updates[p + 'karbur'] = satirlar.length ? { satirlar, ieMiktar: 0, standart: true, sonTs: now, sonKullanan: session.username } : null;
  updates[p + 'rota'] = { elmas: rota.elmas.length ? rota.elmas : null, zarf: rota.zarf.length ? rota.zarf : null, ana: rota.ana.length ? rota.ana : null };
  updates[p + 'standart'] = { by: session.username, byName: session.displayName || session.username, ts: now, talep: d.talep || null };
  d.busy = true; render();
  DB.ref().update(updates).then(() => {
    const eski = hammaddeRecete[u] || {};
    const yeni = { ...eski };
    Object.entries(updates).forEach(([k, v]) => { const alan = k.slice(p.length); if(v === null) delete yeni[alan]; else yeni[alan] = v; });
    hammaddeRecete = { ...hammaddeRecete, [u]: yeni };   // referans değişsin — BOM önbelleği yenilensin
    bomDuzenle = null;
    toast(u + ' standart BOM ve rotası kaydedildi — aynı CANIAS kodlu yeni işlerde öneri olarak gelecek');
    render();
  }).catch(err => {
    d.busy = false;
    toast('Kaydedilemedi: ' + ((err && err.message) || 'hata'));
    render();
  });
}

/* ---------- Excel'e aktar (CSV, Excel Türkçe ayarı için ; ayraçlı, UTF-8 BOM'lu) ---------- */
function bomRotaExcelIndir(){
  const liste = (typeof bomRotaFiltreli === 'function') ? bomRotaFiltreli() : [];
  if(!liste.length){ toast('Aktarılacak kayıt yok'); return; }
  const h = v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const satirlar = [['CANIAS kodu', 'İş emri', 'Mamul', 'Tamamlandı', 'Adet', 'BOM durumu', 'Hammadde', 'Hammadde kaynağı', 'Hammadde boyu',
    'Karbür', 'Karbür boyu', 'Rota _ELMAS', 'Rota _ZARF', 'Rota (U kodu)', 'Standart rota']];
  liste.forEach(x => {
    const std = urunStandardi(x.uKodu);
    const sr = std && std.rota ? ['elmas', 'zarf', 'ana'].map(k => (std.rota[k] || []).join('→')).filter(Boolean).join(' | ') : '';
    satirlar.push([x.uKodu, x.talep, x.mamulAdi, new Date(x.finishedAt).toLocaleString('tr-TR'), x.adet || '', x.bomVar ? 'tam' : 'eksik',
      x.hammadde ? x.hammadde.ad : '', x.hammadde ? (BOM_KAYNAK[x.hammadde.kaynak] || {}).ad || '' : '', x.hammadde ? x.hammadde.boy : '',
      x.karbur ? x.karbur.ad : '', x.karbur ? x.karbur.boy : '',
      x.zElmas.join('→'), x.zZarf.join('→'), x.zAna.concat(['Bitti']).join('→'), sr]);
  });
  const csv = '﻿' + satirlar.map(r => r.map(h).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'bom-rota-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
