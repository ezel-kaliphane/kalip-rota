/* ==================== ÖN MALİYET / TEKLİF (12.10.2026, kullanıcı onayı) ====================
   Yeni bir iş için (CANIAS kodu + adet) geçmişte biten BENZER işlerin adet başı maliyetinden tahmin.
   Aynı CANIAS kodu nadiren tekrar ediyor (394 işte 24 kod), o yüzden aile de kullanılır:
   - UCxxxxxxxx / UVxxxxxxxx / USxxxxxxxx kodları: ilk 6 karakter (UC1303 = yekpare kalıp, UC2000 = hazırlayıcı …)
   - U + 7 hane (sıra no, aile bilgisi yok): mamul adının harf öneki (S-KLP, C-PARMAK, YPB …)
   Benzerlik puanı: aynı kod 100, aynı aile 40; + aynı M ölçüsü 15, aynı pres/boy no 10, aynı DIN 10,
   adede yakınlık en çok 15. En yakın 10 iş (puan ≥ 40) puanla ağırlıklı ortalanır; 5+ işte en düşük ve
   en yüksek adet başı atılır. Her iş kendi bitiş günü kuruyla çevrilir (€/$ tahmini o yüzden ayrı). */
let onMaliyet = null;   // { kod, ad, adet }

function onMlAile(kod, ad){
  kod = String(kod || '').trim().toUpperCase();
  if(/^U[A-Z]\d{8}$/.test(kod)) return kod.slice(0, 6);
  const m = String(ad || '').toLocaleUpperCase('tr').trim().match(/^([A-ZÇĞİÖŞÜ]+(?:-[A-ZÇĞİÖŞÜ]+)*)/);
  return m ? 'ad:' + m[1] : null;
}
function onMlOzellik(ad){
  const a = String(ad || '').toLocaleUpperCase('tr');
  const m = a.match(/(?:^|[^A-Z])M(\d{1,2})(?!\d)/), b = a.match(/(?:^|[^A-Z])B(\d{1,2})(?!\d)/) || a.match(/^[A-Z]+-[A-Z]+-(\d{2})-/);
  const din = a.match(/(?:DIN\s?|-)(\d{3,4})(?:[-\/ ]|$)/);
  return { m: m ? m[1] : null, b: b ? b[1] : null, din: din ? din[1] : null };
}
function onMlBenzerler(kod, ad, adet){
  kod = String(kod || '').trim().toUpperCase();
  const aile = onMlAile(kod, ad), oz = onMlOzellik(ad);
  const n = Number(adet) || 0;
  const ad2 = x => x.mamulAdi || (malzemeListesi && malzemeListesi[x.uKodu]) || '';
  return bomRotaListesi().map(x => {
    const ayni = kod && x.uKodu === kod, xAile = onMlAile(x.uKodu, ad2(x));
    if(!ayni && !(aile && xAile === aile)) return null;
    const m = maliyetHesapla(x); if(!m || !(m.birim > 0)) return null;
    const xo = onMlOzellik(ad2(x)), neden = [ayni ? 'aynı kod' : 'aynı aile'];
    let p = ayni ? 100 : 40;
    if(oz.m && xo.m === oz.m){ p += 15; neden.push('M' + oz.m); }
    if(oz.b && xo.b === oz.b){ p += 10; neden.push('B' + oz.b); }
    if(oz.din && xo.din === oz.din){ p += 10; neden.push(oz.din); }
    const xa = m.saglam || m.adet;
    if(n > 0 && xa > 0) p += 15 * Math.max(0, 1 - Math.abs(Math.log(n / xa)) / Math.log(20));
    return { x, m, p, neden, ad: ad2(x) };
  }).filter(Boolean).sort((a, b) => b.p - a.p || b.x.finishedAt - a.x.finishedAt).slice(0, 10);
}
/* Ağırlıklı adet başı, her para biriminde ayrı (iş kendi kuruyla) */
function onMlTahmin(benzer){
  let kullan = benzer.slice();
  if(kullan.length >= 5){
    const s = kullan.slice().sort((a, b) => a.m.birim - b.m.birim);
    kullan = kullan.filter(r => r !== s[0] && r !== s[s.length - 1]);
  }
  const W = kullan.reduce((s, r) => s + r.p, 0) || 1;
  const sonuc = {};
  ['TRY', 'EUR', 'USD'].forEach(c => {
    const o = { birim: 0, kalem: {} }; ML_KALEMLER.forEach(([k]) => { o.kalem[k] = 0; });
    kullan.forEach(r => {
      const m = mlCevir(r.m, c), bol = r.m.saglam || r.m.adet, w = r.p / W;
      o.birim += w * m.toplam / bol;
      ML_KALEMLER.forEach(([k]) => { o.kalem[k] += w * mlKalemTutar(m, k) / bol; });
    });
    sonuc[c] = o;
  });
  return { sonuc, kullan, atilan: benzer.length - kullan.length };
}
function onMlKodDegis(v){
  v = String(v || '').trim().toUpperCase();
  onMaliyet.kod = v;
  const bilinen = (malzemeListesi && malzemeListesi[v]) || ((bomRotaListesi().find(x => x.uKodu === v) || {}).mamulAdi) || '';
  if(bilinen) onMaliyet.ad = bilinen;
  render();
}
function renderOnMaliyetHtml(){
  const o = onMaliyet; if(!o) return '';
  const n = Number(o.adet) || 0;
  let govde = '';
  if(!o.kod && !o.ad) govde = `<div style="font-size:12.5px;color:var(--text-muted)">CANIAS kodunu girin (mamul adı listeden gelir; yeni kodsa adı siz yazın), sonra adedi.</div>`;
  else if(!onMlAile(o.kod, o.ad)) govde = `<div style="font-size:12.5px;color:var(--warn)">Bu koddan aile çıkarılamadı — mamul adını yazın (ör. "S-KLP-14-M8-…").</div>`;
  else {
    const benzer = onMlBenzerler(o.kod, o.ad, n);
    if(!benzer.length) govde = `<div style="font-size:12.5px;color:var(--warn)">Geçmişte bu aileden maliyeti hesaplanmış iş yok (aile: ${esc(onMlAile(o.kod, o.ad).replace(/^ad:/, ''))}).</div>`;
    else {
      const t = onMlTahmin(benzer), S = t.sonuc;
      const V = (fn, ic) => mlUc({ TRY: fn(S.TRY), EUR: fn(S.EUR), USD: fn(S.USD) }, ic);
      const ayniKod = benzer.filter(r => r.x.uKodu === o.kod).length;
      const adetler = benzer.map(r => r.m.saglam || r.m.adet), amin = Math.min(...adetler), amax = Math.max(...adetler);
      const adetUyari = n > 0 && (n > amax * 3 || n * 3 < amin)
        ? `Benzer işler ${amin === amax ? amin : amin + '–' + amax} adet; ${n} adet için adet başı ${n > amax ? 'daha düşük' : 'daha yüksek'} çıkabilir (hazırlık süresi adede bölünür).` : '';
      govde = agYorum([
        `${benzer.length} benzer iş bulundu${ayniKod ? ` (${ayniKod} tanesi aynı CANIAS kodu)` : ' (aynı kod daha önce yapılmamış, aynı aileden)'}${t.atilan ? `; en düşük ve en yüksek adet başı hesaba katılmadı` : ''}.`,
        `Tahmini adet başı <b>${V(s => s.birim, true)}</b>${n > 0 ? `, ${n} adet için toplam <b>${V(s => s.birim * n, true)}</b>` : ' — toplam için adet girin'}.`,
        ...(adetUyari ? [adetUyari] : [])
      ]) + `
      <div class="table-wrap" style="margin-top:8px"><table class="rt-tablo"><thead><tr><th>Kalem</th><th class="r">Adet başı</th>${n > 0 ? `<th class="r">${n} adet</th>` : ''}</tr></thead><tbody>
        ${ML_KALEMLER.filter(([k]) => S.TRY.kalem[k] > 0).map(([k, et]) => `<tr class="rt-tablo-sabit"><td>${esc(et)}</td><td class="r mono">${V(s => s.kalem[k])}</td>${n > 0 ? `<td class="r mono">${V(s => s.kalem[k] * n)}</td>` : ''}</tr>`).join('')}
        <tr class="rt-tablo-sabit" style="font-weight:600"><td>Toplam</td><td class="r mono">${V(s => s.birim)}</td>${n > 0 ? `<td class="r mono">${V(s => s.birim * n)}</td>` : ''}</tr>
      </tbody></table></div>
      <div style="font-weight:600;margin:14px 0 6px;font-size:13px">Dayanak işler</div>
      <div class="table-wrap"><table class="rt-tablo"><thead><tr><th>İş emri</th><th>CANIAS kodu</th><th class="rt-dar-gizle">Mamul</th><th class="r">Adet</th><th class="r">Adet başı</th><th>Benzerlik</th><th></th></tr></thead><tbody>
        ${benzer.map(r => { const atildi = !t.kullan.includes(r); return `<tr class="rt-tablo-sabit"${atildi ? ' style="opacity:.5" title="En düşük / en yüksek — hesaba katılmadı"' : ''}><td class="mono">${esc(r.x.talep || '—')}</td><td class="mono">${esc(r.x.uKodu)}</td><td class="rt-silik rt-kes rt-dar-gizle">${esc(r.ad)}</td>
          <td class="r mono">${r.m.saglam || r.m.adet}</td><td class="r mono">${mlP(r.m.birim, r.m.kur)}</td><td style="font-size:11.5px;color:var(--text-muted)">${esc(r.neden.join(' · '))}${atildi ? ' · <i>katılmadı</i>' : ''}</td>
          <td><button class="btn-ghost" style="width:auto;padding:2px 9px;font-size:11px" onclick="maliyetDokumAc('${escJs(r.x.talep || r.x.uKodu)}')">Döküm</button></td></tr>`; }).join('')}
      </tbody></table></div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-top:6px">Tahmin tüm geçmişten, bugünkü parametrelerle değil her işin kendi maliyetiyle yapılır; teklif için kâr payı ayrıca eklenmeli.</div>`;
    }
  }
  return `<div class="set-card" style="margin-bottom:16px;border-color:var(--accent)">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div class="set-sec" style="margin:0;flex:1">Ön maliyet — benzer işlerden tahmin</div>
      <button class="icon-btn" title="Kapat" onclick="onMaliyet=null; render()">${ico('x', 14)}</button></div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr) 90px;gap:8px;margin-bottom:12px">
      <div class="field" style="margin:0"><label>CANIAS kodu</label><input class="mono" value="${esc(o.kod)}" placeholder="UC13030236" onchange="onMlKodDegis(this.value)" onkeydown="if(event.key==='Enter') this.blur()"></div>
      <div class="field" style="margin:0"><label>Mamul adı</label><input value="${esc(o.ad)}" placeholder="koddan gelir" onchange="onMaliyet.ad=this.value; render()" onkeydown="if(event.key==='Enter') this.blur()"></div>
      <div class="field" style="margin:0"><label>Adet</label><input inputmode="numeric" value="${esc(o.adet)}" onchange="onMaliyet.adet=this.value.replace(/\\D/g,''); render()" onkeydown="if(event.key==='Enter') this.blur()"></div>
    </div>
    ${govde}
  </div>`;
}
