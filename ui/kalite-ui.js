/* ===================== FİNAL KALİTE KONTROL — EKRANLAR (06.10.2026) =====================
   Mantık: js/kalite.js. Burada: FKK "Bitir" penceresi (adet dağılımı + red kararı), "karar sonra"
   penceresi, yarı mamul deposu (Stok Takibi → Yarı Mamul) ve İş Yoğunluğu'ndaki karar satırı. */

function kaliteSayiKutu(id, deger, onchange, renk){
  return `<input id="${id}" class="kal-sayi mono" inputmode="numeric" style="${renk?`--kc:${renk}`:''}" value="${esc(deger||'')}" placeholder="0"
    oninput="this.value=this.value.replace(/\\D/g,'')" onchange="${onchange}">`;
}
/* Revizyon: geri gideceği operasyon — önce iş emrinin geçmiş rotası, sonra tüm makineler. */
function kaliteGeriMakineSecici(rota, secili, yazFn){
  const tum = allMachines().map(m=>`${m.code} · ${m.name}`).filter(l=>!kaliteMakinesiMi(l));
  return `<div class="kal-rota">${rota.length ? rota.map((l,i)=>`<button type="button" class="kal-rota-adim ${secili===l?'on':''}" onclick="${yazFn}('geriMakine','${escJs(l)}')"><small>${i+1}</small> ${esc(String(l).split(' · ')[0])}</button>`).join('<span class="route-arrow">→</span>') : '<span style="font-size:12px;color:var(--text-muted)">Bu iş emrinin geçmiş rotası bulunamadı.</span>'}</div>
    <select style="margin-top:6px" onchange="${yazFn}('geriMakine', this.value)">
      <option value="">${rota.length ? '— ya da başka bir makine —' : '— makine seç —'}</option>
      ${tum.map(l=>`<option value="${esc(l)}" ${secili===l && !rota.includes(l)?'selected':''}>${esc(l)}</option>`).join('')}
    </select>`;
}
/* Neden: listeden seç ya da elle yaz (06.10.2026 — "elle yazı yazmak isteyebilir"). */
function kaliteNedenSecici(alan, secili, yazFn){
  return `<input list="kal-neden-${alan}" placeholder="Listeden seç ya da yaz" value="${esc(secili||'')}" onfocus="this.select()" onchange="${yazFn}('${alan}', this.value.trim())">
    <datalist id="kal-neden-${alan}">${kaliteNedenleri().map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist>`;
}
/* Hatanın oluştuğu operasyon: geçmiş rotanın her adımı (makine · operatör · tarih) + "Belli değil". */
function kaliteHataSecici(adimlar, secili, alan){
  return `<div class="kal-hata">${adimlar.map((o,i)=>`<button type="button" class="kal-hata-adim ${secili===o.id?'on':''}" onclick="kaliteYaz('${alan}','${escJs(o.id)}')">
      <small>${i+1}</small><b class="mono">${esc(String(o.makine||'').split(' · ')[0])}</b><span>${esc(o.operatorName||o.operatorUsername||'')}</span><em>${o.endTs?fmtDT(o.endTs).split(' ')[0]:''}</em></button>`).join('')}
    <button type="button" class="kal-hata-adim belirsiz ${secili===KALITE_HATA_BELIRSIZ?'on':''}" onclick="kaliteYaz('${alan}','${KALITE_HATA_BELIRSIZ}')"><b>Belli değil</b></button></div>
    ${adimlar.length ? '' : '<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">Bu iş emrinin önceki operasyon kaydı bulunamadı.</div>'}`;
}

function renderKaliteModal(){
  const m = kaliteModal; if(!m) return '';
  if(m.groupId) return renderKaliteGrupModal();
  const e = STATE.entries[m.id] || {};
  const K = kaliteSayi(m.kontrol), O = kaliteSayi(m.onay), S = kaliteSayi(m.sartli), R = kaliteSayi(m.red);
  const top = O+S+R, kararTop = ['revizyon','kstok','yariMamul','hurda','bekliyor'].reduce((t,x)=>t+kaliteSayi(m[x]),0);
  const rota = R && kaliteSayi(m.revizyon) ? kaliteGecmisRota({ ...e, id:m.id }) : [];
  const adimlar = (S || R) ? kaliteGecmisAdimlar({ ...e, id:m.id }) : [];
  return `<div class="durus-modal-overlay" onclick="if(event.target===this) kaliteModalKapat()">
    <div class="durus-modal-panel">
      <div class="durus-modal-handle" style="cursor:pointer" onclick="kaliteModalKapat()" title="Kapat"></div>
      <div class="durus-modal-header">
        <div><div class="durus-modal-title">Final Kalite Kontrol</div>
          <div class="durus-modal-sub">${esc(e.talepNo||e.isEmriNo||'')}${e.adet?` · ${esc(e.adet)} adet`:''}${m.kontrolNo>1?` · <b style="color:var(--warn)">${m.kontrolNo}. kontrol (revizyon dönüşü)</b>`:''}</div></div>
        <button class="icon-btn" onclick="kaliteModalKapat()">${ico('x',16)}</button>
      </div>
      <div class="durus-modal-list">
        <div class="kal-satir">
          <label for="kal-k">Kontrol edilen</label>
          ${kaliteSayiKutu('kal-k', m.kontrol, 'kaliteKontrolYaz(this.value)')}
          <button type="button" class="btn-ghost kal-hepsi" onclick="kaliteHepsiOnay()">Hepsi onay</button>
        </div>
        <div class="kal-dagilim">
          <div><span style="color:var(--success)">Onay</span>${kaliteSayiKutu('kal-o', m.onay, "kaliteYaz('onay',this.value)", 'var(--success)')}</div>
          <div><span style="color:var(--warn)">Şartlı kabul</span>${kaliteSayiKutu('kal-s', m.sartli, "kaliteSorunluYaz('sartli',this.value)", 'var(--warn)')}</div>
          <div><span style="color:var(--danger)">Red</span>${kaliteSayiKutu('kal-r', m.red, "kaliteSorunluYaz('red',this.value)", 'var(--danger)')}</div>
        </div>
        <div class="kal-toplam ${top===K && K>0?'tamam':'eksik'}">Onay + Şartlı + Red = <b>${top}</b> / ${K}${top!==K?' — eşit olmalı':''}</div>

        ${S ? `<div class="kal-blok sartli"><div class="kal-blok-bas">Şartlı kabul nedeni <small>→ K-stok teslim</small></div>${kaliteNedenSecici('sartliNeden', m.sartliNeden, 'kaliteYaz')}
          <div class="kal-blok-bas" style="margin-top:10px">Açıklama ve notlar <small>zorunlu</small></div>
          <textarea class="kal-textarea" rows="3" placeholder="ör. Ø12 h7 ölçüsü 12,02 — montajda sorun çıkarmaz, müşteri onayıyla kullanılacak" oninput="kaliteModal.sartliAciklama=this.value">${esc(m.sartliAciklama)}</textarea>
          <div class="kal-blok-bas" style="margin-top:10px">Hatanın oluştuğu operasyon <small>geçmiş rota</small></div>${kaliteHataSecici(adimlar, m.sartliHata, 'sartliHata')}</div>` : ''}

        ${R ? `<div class="kal-blok red">
          <div class="kal-blok-bas">Red nedeni</div>${kaliteNedenSecici('redNeden', m.redNeden, 'kaliteYaz')}
          <div class="kal-blok-bas" style="margin-top:10px">Açıklama <small>isteğe bağlı</small></div>
          <textarea class="kal-textarea" rows="3" placeholder="ör. delik Ø6,6 olması gerekirken Ø6,9 işlenmiş" oninput="kaliteModal.redAciklama=this.value">${esc(m.redAciklama)}</textarea>
          <div class="kal-blok-bas" style="margin-top:10px">Hatanın oluştuğu operasyon <small>geçmiş rota</small></div>${kaliteHataSecici(adimlar, m.redHata, 'redHata')}
          <div class="kal-blok-bas" style="margin-top:12px">Red ${R} parça ne olacak? <small>dağıtılan ${kararTop} / ${R}</small></div>
          ${KALITE_RED_KARAR.map(([k,ad,ipucu])=>`<div class="kal-karar">
            <div><b>${esc(ad)}</b><small>${esc(ipucu)}</small></div>${kaliteSayiKutu('kal-'+k, m[k], `kaliteYaz('${k}',this.value)`)}</div>`).join('')}
          ${kaliteSayi(m.revizyon) ? `<div class="kal-blok-bas" style="margin-top:10px">Geri gideceği operasyon <small>geçmiş rota</small></div>${kaliteGeriMakineSecici(rota, m.geriMakine, 'kaliteYaz')}` : ''}
          ${kaliteSayi(m.yariMamul) ? `<div class="kal-blok-bas" style="margin-top:10px">Nerede kullanılabilir? <small>isteğe bağlı</small></div>
            <input placeholder="ör. M8 kalıbında delik büyütülerek" value="${esc(m.kullanimNotu)}" oninput="kaliteModal.kullanimNotu=this.value">` : ''}
        </div>` : ''}


      </div>
      <div class="durus-modal-footer">
        <button class="durus-modal-footer-btn" onclick="kaliteOnayla()">${R && kaliteSayi(m.revizyon) ? 'Kaydet — revizyona gönder' : R && kaliteSayi(m.bekliyor) ? 'Kaydet — karar bekliyor' : 'Kaydet ve Bitir'}</button>
      </div>
    </div>
  </div>`;
}
function renderKaliteGrupModal(){
  const m = kaliteModal, uyeler = groupMembersOf(m.groupId);
  const btn = (k, ad, renk) => `<button type="button" class="kal-sonuc ${m.grupSonuc===k?'on':''}" style="--kc:${renk}" onclick="kaliteYaz('grupSonuc','${k}')">${ad}</button>`;
  return `<div class="durus-modal-overlay" onclick="if(event.target===this) kaliteModalKapat()">
    <div class="durus-modal-panel">
      <div class="durus-modal-handle" style="cursor:pointer" onclick="kaliteModalKapat()" title="Kapat"></div>
      <div class="durus-modal-header">
        <div><div class="durus-modal-title">Final Kalite Kontrol</div><div class="durus-modal-sub">${uyeler.length} iş emri birlikte — sonuç her birine kendi adediyle yazılır</div></div>
        <button class="icon-btn" onclick="kaliteModalKapat()">${ico('x',16)}</button>
      </div>
      <div class="durus-modal-list">
        <div class="kal-sonuclar">${btn('onay','Onay','var(--success)')}${btn('sartli','Şartlı kabul','var(--warn)')}${btn('red','Red','var(--danger)')}</div>
        ${m.grupSonuc==='red' ? `<div class="kal-not">Grupta red parçalar "karar sonra" olarak kaydedilir; Şef / SuperAdmin İş Yoğunluğu'ndan her iş emri için ayrı karar verir. Parça parça dağılım gerekiyorsa iş emirlerini tek tek bitir.</div>` : ''}
        ${m.grupSonuc && m.grupSonuc!=='onay' ? `<div class="kal-blok"><div class="kal-blok-bas">Neden</div>${kaliteNedenSecici('neden', m.neden, 'kaliteYaz')}</div>
          <div class="field" style="margin-top:10px"><label>Açıklama${m.grupSonuc==='sartli'?' (zorunlu)':' (isteğe bağlı)'}</label><textarea class="kal-textarea" rows="3" oninput="kaliteModal.aciklama=this.value">${esc(m.aciklama)}</textarea></div>` : ''}
      </div>
      <div class="durus-modal-footer"><button class="durus-modal-footer-btn" ${m.grupSonuc?'':'disabled'} onclick="kaliteOnayla()">Kaydet ve Bitir</button></div>
    </div>
  </div>`;
}

/* "Karar sonra" penceresi (yönetici ekranı). */
function renderKaliteKararModal(){
  const m = kaliteKararModal; if(!m) return '';
  const e = STATE.entries[m.id]; if(!e || !e.kalite){ kaliteKararModal = null; return ''; }
  const k = e.kalite, d = kaliteDagilim(k), n = d.bekliyor;
  const top = ['revizyon','kstok','yariMamul','hurda'].reduce((t,x)=>t+kaliteSayi(m[x]),0);
  const rota = kaliteSayi(m.revizyon) ? kaliteGecmisRota({ ...e, id:m.id }) : [];
  return `<div class="modal-overlay" onclick="if(event.target===this)kaliteKararKapat()">
    <div class="modal-box kal-modal" style="max-width:520px">
      <div class="kal-modal-bas"><div class="sec-h" style="margin-top:0">Red kararı — ${esc(e.talepNo||e.isEmriNo||'')}</div></div>
      <div class="kal-modal-govde">
      <div style="font-size:12.5px;color:var(--text-muted);margin:-6px 0 12px">${esc((typeof usMamulAdi==='function' && usMamulAdi(e))||'')}<br>
        FKK ${fmtDT(k.ts||e.endTs)} · ${esc(k.name||'')} · red nedeni <b>${esc(k.redNeden||'—')}</b>${kaliteAciklamaMetni(k)?` — ${esc(kaliteAciklamaMetni(k))}`:''}${k.redHataOp?`<br>Hata: ${esc(kaliteHataMetni(k.redHataOp))}`:''}<br>
        Karar bekleyen <b>${n} parça</b> · dağıtılan ${top} / ${n}</div>
      ${KALITE_RED_KARAR.filter(([x])=>x!=='bekliyor').map(([x,ad,ipucu])=>`<div class="kal-karar"><div><b>${esc(ad)}</b><small>${esc(ipucu)}</small></div>${kaliteSayiKutu('kk-'+x, m[x], `kaliteKararYaz('${x}',this.value)`)}</div>`).join('')}
      ${kaliteSayi(m.revizyon) ? `<div class="kal-blok-bas" style="margin-top:10px">Geri gideceği operasyon <small>geçmiş rota</small></div>${kaliteGeriMakineSecici(rota, m.geriMakine, 'kaliteKararYaz')}` : ''}
      ${kaliteSayi(m.yariMamul) ? `<div class="field" style="margin-top:10px"><label>Nerede kullanılabilir? (isteğe bağlı)</label><input placeholder="ör. M8 kalıbında delik büyütülerek" value="${esc(m.kullanimNotu)}" oninput="kaliteKararModal.kullanimNotu=this.value"></div>` : ''}
      </div>
      <div class="kal-modal-alt">
        <button class="btn-primary" style="flex:1" ${m.busy?'disabled':''} onclick="kaliteKararKaydet()">${m.busy?'Kaydediliyor…':'Kararı Kaydet'}</button>
        <button class="btn-ghost" onclick="kaliteKararKapat()">Vazgeç</button>
      </div>
    </div></div>`;
}
/* İş Yoğunluğu → "Kalite Kararı Bekliyor" satırının detayı. */
function kaliteKararDetayHtml(r){
  return r.kayitlar.map(e=>{ const k = e.kalite, d = kaliteDagilim(k);
    return `<div class="iy-detay-row iy-mb-satir yok">
      <span><span class="mono" style="font-weight:700">${esc(e.talepNo||e.isEmriNo||'—')}</span><span class="mono" style="display:block;font-size:10.5px;color:var(--text-subtle)">${esc(String(e.isEmriNo||'').replace(/_(ZARF|ELMAS)$/,''))}</span></span>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc((typeof usMamulAdi==='function' && usMamulAdi(e))||'')}">${esc((typeof usMamulAdi==='function' && usMamulAdi(e))||'—')}</span>
      <span><b>${d.bekliyor}</b> parça · ${esc(k.redNeden||'—')}</span>
      <span style="color:var(--text-muted)">${fmtDT(k.ts||e.endTs)}</span>
      <span class="sag">${canManageStock() ? `<button class="btn-primary" style="width:auto;padding:6px 12px" onclick="kaliteKararAc('${escJs(e.id)}')">Karar ver</button>` : ''}</span>
    </div>`; }).join('');
}

/* ---------- Stok Takibi → Yarı Mamul (FKK + proses içi) ---------- */
let ymGecmisAcik = false;
function renderYariMamul(){
  const l = yariMamulKayitlari(), stokta = l.filter(x=>x.kalan>0);
  const cikanlar = l.flatMap(x=>x.cikislar.map(c=>({ ...c, x }))).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const toplam = stokta.reduce((t,x)=>t+x.kalan,0);
  const gun = ts => Math.max(0, Math.floor((Date.now()-(ts||Date.now()))/86400000));
  const mamul = e => esc((typeof usMamulAdi==='function' && usMamulAdi(e))||'—');
  return `<div class="settings-wrap" style="max-width:none">
    <div class="notice" style="--nc:var(--accent);margin-bottom:14px"><div class="notice-sub">Final Kalite Kontrol'de ya da proses içinde hatalı bulunup <b>başka yerde işlenerek kullanılabilir</b> denen parçalar buraya kendiliğinden girer (ör. M6 kalıbında delik büyük işlendi → M8 kalıbında delik büyütülerek kullanılabilir). İleride o iş gelince buradan kullanılır.</div></div>
    <div class="stok-genel-kpi" style="padding:0 0 14px;grid-template-columns:repeat(3,1fr)">
      <div class="sgk-card"><div class="sgk-num">${toplam}</div><div class="sgk-label">Depodaki parça</div></div>
      <div class="sgk-card"><div class="sgk-num">${stokta.length}</div><div class="sgk-label">Kalem</div></div>
      <div class="sgk-card"><div class="sgk-num">${stokta.length ? gun(stokta[0].girisTs) : 0}</div><div class="sgk-label">En eski bekleyen (gün)</div></div>
    </div>
    ${stokta.length ? `<div class="sg-table-wrap"><table><thead><tr><th>Giriş</th><th>Bekleme</th><th>Kaynak</th><th>İş emri</th><th>Mamul</th><th style="text-align:right">Adet</th><th>Neden</th><th>Nerede kullanılabilir</th><th></th></tr></thead><tbody>
      ${stokta.map(x=>{ const e=x.e, g=gun(x.girisTs); return `<tr>
        <td class="mono" style="white-space:nowrap">${fmtDT(x.girisTs)}</td>
        <td style="color:${g>=90?'var(--danger)':g>=30?'var(--warn)':'var(--text-muted)'}">${g} gün</td>
        <td>${esc(x.kaynak)}</td>
        <td><div class="mono">${esc(e.talepNo||'—')}</div><div class="mono" style="font-size:10.5px;color:var(--text-subtle)">${esc(String(e.isEmriNo||'').replace(/_(ZARF|ELMAS)$/,''))}</div></td>
        <td>${mamul(e)}</td>
        <td class="mono" style="text-align:right"><b>${x.kalan}</b>${x.cikan?` <span style="color:var(--text-muted)">/ ${x.giren}</span>`:''}</td>
        <td>${esc(x.neden||'—')}${x.aciklama?`<div style="font-size:11px;color:var(--text-muted)">${esc(x.aciklama)}</div>`:''}</td>
        <td>${esc(x.kullanimNotu||'—')}</td>
        <td style="white-space:nowrap">${canManageStock()?`<button class="btn-ghost" style="width:auto;padding:5px 10px" onclick="ymCikisAc('${escJs(x.key)}','kullanim')">Kullan</button>
          <button class="btn-ghost" style="width:auto;padding:5px 10px;color:var(--danger)" onclick="ymCikisAc('${escJs(x.key)}','hurda')">Hurda</button>`:''}</td>
      </tr>`; }).join('')}
    </tbody></table></div>` : `<div class="notice" style="--nc:var(--success)"><div class="notice-title">Yarı mamul deposu boş</div><div class="notice-sub">FKK'da ya da proses içi uygunsuzlukta "Yarı mamul deposu" seçilince burada görünür.</div></div>`}
    <button class="btn-ghost" style="width:auto;padding:8px 14px;margin-top:14px" onclick="ymGecmisAcik=!ymGecmisAcik; render()">${ymGecmisAcik?'Çıkışları gizle':`Çıkışlar (${cikanlar.length})`}</button>
    ${ymGecmisAcik ? `<div class="sg-table-wrap" style="margin-top:10px"><table><thead><tr><th>Tarih</th><th>Tür</th><th>Kaynak iş emri</th><th style="text-align:right">Adet</th><th>Kullanılan iş emri</th><th>Açıklama</th><th>Kim</th></tr></thead><tbody>
      ${cikanlar.length ? cikanlar.map(c=>`<tr><td class="mono">${fmtDT(c.ts)}</td><td>${c.tur==='hurda'?'<span style="color:var(--danger)">Hurda</span>':'Kullanım'}</td>
        <td class="mono">${esc(c.x.e.talepNo||c.x.e.isEmriNo||'—')}</td><td class="mono" style="text-align:right">${kaliteSayi(c.adet)}</td>
        <td class="mono">${esc(c.isEmri||'—')}</td><td>${esc(c.aciklama||'—')}</td><td style="color:var(--text-muted)">${esc(c.name||c.username||'')}</td></tr>`).join('')
        : `<tr><td colspan="7" style="color:var(--text-muted);padding:14px">Henüz çıkış yok.</td></tr>`}
    </tbody></table></div>` : ''}
  </div>`;
}
function renderYmCikisModal(){
  const m = ymCikisModal; if(!m) return '';
  const x = yariMamulKayitlari().find(r=>r.key===m.key); if(!x){ ymCikisModal = null; return ''; }
  const hurda = m.tur==='hurda';
  return `<div class="modal-overlay" onclick="if(event.target===this)ymCikisKapat()">
    <div class="modal-box" style="max-width:420px;padding:20px;overflow-y:auto">
      <div class="sec-h" style="margin-top:0">${hurda?'Hurdaya ayır':'Yarı mamulü kullan'} — ${esc(x.e.talepNo||x.e.isEmriNo||'')}</div>
      <div style="font-size:12.5px;color:var(--text-muted);margin:-6px 0 12px">${esc((typeof usMamulAdi==='function' && usMamulAdi(x.e))||'')} · depoda ${x.kalan} parça${x.kullanimNotu?`<br>Not: ${esc(x.kullanimNotu)}`:''}</div>
      <div class="field"><label>Adet</label><input inputmode="numeric" value="${esc(m.adet)}" oninput="this.value=this.value.replace(/\\D/g,''); ymCikisModal.adet=this.value"></div>
      ${hurda ? '' : `<div class="field"><label>Kullanıldığı iş emri (isteğe bağlı)</label><input class="mono" placeholder="ör. 2610050011" value="${esc(m.isEmri)}" oninput="ymCikisModal.isEmri=this.value"></div>`}
      <div class="field"><label>Açıklama (isteğe bağlı)</label><input placeholder="${hurda?'ör. delik büyütülünce çatladı':'ör. delik Ø6,8\'e büyütüldü'}" value="${esc(m.aciklama)}" oninput="ymCikisModal.aciklama=this.value"></div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" style="flex:1${hurda?';background:var(--danger)':''}" ${m.busy?'disabled':''} onclick="ymCikisKaydet()">${m.busy?'Kaydediliyor…':hurda?'Hurdaya ayır':'Depodan çıkar'}</button>
        <button class="btn-ghost" onclick="ymCikisKapat()">Vazgeç</button>
      </div>
    </div></div>`;
}

/* ---------- Proses içi uygunsuzluk penceresi (Şef / SuperAdmin) ---------- */
function renderUygModal(){
  const m = uygModal; if(!m) return '';
  const e = STATE.entries[m.baglamId]; if(!e){ uygModal = null; return ''; }
  const adimlar = kaliteGecmisAdimlar({ ...e, id:m.baglamId, startTs: Date.now() }).filter(o=>o.id!==m.baglamId || o.status==='tamamlandi');
  const tumAdimlar = kaliteIsKayitlari(e).filter(o=>!kaliteMakinesiMi(o.makine) && o.makine).sort((a,b)=>(a.startTs||0)-(b.startTs||0));
  const rota = m.karar==='revizyon' ? kaliteGecmisRota({ ...e, id:m.baglamId }) : [];
  const hataSec = (secili) => `<div class="kal-hata">${tumAdimlar.map((o,i)=>`<button type="button" class="kal-hata-adim ${secili===o.id?'on':''}" onclick="uygYaz('hata','${escJs(o.id)}')">
      <small>${i+1}</small><b class="mono">${esc(String(o.makine||'').split(' · ')[0])}</b><span>${esc(o.operatorName||o.operatorUsername||'')}</span><em>${fmtDT(o.endTs||o.startTs).split(' ')[0]}</em></button>`).join('')}
    <button type="button" class="kal-hata-adim belirsiz ${secili===KALITE_HATA_BELIRSIZ?'on':''}" onclick="uygYaz('hata','${KALITE_HATA_BELIRSIZ}')"><b>Belli değil</b></button></div>`;
  return `<div class="modal-overlay" onclick="if(event.target===this)uygKapat()">
    <div class="modal-box kal-modal" style="max-width:560px">
      <div class="kal-modal-bas"><div class="sec-h" style="margin-top:0">Uygunsuzluk bildir — ${esc(e.talepNo||e.isEmriNo||'')}</div>
      <div style="font-size:12.5px;color:var(--text-muted);margin:-6px 0 0">Final Kalite Kontrol'e gelmeden fark edilen hata. ${esc((typeof usMamulAdi==='function' && usMamulAdi(e))||'')}</div></div>
      <div class="kal-modal-govde">
      <div class="kal-satir"><label>Hatalı adet</label><input class="kal-sayi mono" inputmode="numeric" value="${esc(m.adet)}" oninput="this.value=this.value.replace(/\\D/g,''); uygModal.adet=this.value"></div>
      <div class="kal-blok-bas">Neden</div>
      <input list="uyg-neden" placeholder="Listeden seç ya da yaz" value="${esc(m.neden)}" onchange="uygYaz('neden', this.value.trim())">
      <datalist id="uyg-neden">${kaliteNedenleri().map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist>
      <div class="kal-blok-bas" style="margin-top:10px">Açıklama <small>isteğe bağlı</small></div>
      <textarea class="kal-textarea" rows="3" placeholder="ör. UST02'de fark edildi, delik 0,2 mm büyük" oninput="uygModal.aciklama=this.value">${esc(m.aciklama)}</textarea>
      <div class="kal-blok-bas" style="margin-top:10px">Hatanın oluştuğu operasyon <small>geçmiş rota</small></div>
      ${hataSec(m.hata)}
      <div class="kal-blok-bas" style="margin-top:12px">Ne yapıldı?</div>
      <div class="kal-karar-secim">${UYG_KARAR.map(([k,ad,ipucu])=>`<button type="button" class="kal-karar-btn ${m.karar===k?'on':''}" onclick="uygYaz('karar','${k}')"><b>${esc(ad)}</b><small>${esc(ipucu)}</small></button>`).join('')}</div>
      ${m.karar==='revizyon' ? `<div class="kal-blok-bas" style="margin-top:10px">Geri gideceği operasyon</div>${kaliteGeriMakineSecici(rota, m.geriMakine, 'uygYaz')}` : ''}
      ${m.karar==='yariMamul' ? `<div class="field" style="margin-top:10px"><label>Nerede kullanılabilir? (isteğe bağlı)</label><input placeholder="ör. M8 kalıbında delik büyütülerek" value="${esc(m.kullanimNotu)}" oninput="uygModal.kullanimNotu=this.value"></div>` : ''}
      </div>
      <div class="kal-modal-alt">
        <button class="btn-primary" style="flex:1" ${m.busy?'disabled':''} onclick="uygKaydet()">${m.busy?'Kaydediliyor…':'Kaydet'}</button>
        <button class="btn-ghost" onclick="uygKapat()">Vazgeç</button>
      </div>
    </div></div>`;
}
/* Geçmiş penceresinde bir adımın altına: proses uygunsuzlukları ve düzeltme işi rozeti. */
function kaliteGecmisEkHtml(e){
  const uyg = Object.values(e.uygunsuzluklar||{}).filter(Boolean).sort((a,b)=>(a.ts||0)-(b.ts||0));
  const kararAd = k => (UYG_KARAR.find(x=>x[0]===k)||[k,k])[1];
  return `${e.duzeltme ? `<div style="font-size:12px;color:var(--warn);margin-top:4px">${ico('repeat',12)} Düzeltme (rework) işi${e.duzeltme.hataOp?` · hata: ${esc(kaliteHataMetni(e.duzeltme.hataOp))}`:''}</div>` : ''}
    ${uyg.map(u=>`<div style="font-size:12px;color:var(--danger);margin-top:4px">${ico('alert',12)} Uygunsuzluk: ${kaliteSayi(u.adet)} adet · ${esc(u.neden||'')} · ${esc(kararAd(u.karar))}${u.geriMakine?` → ${esc(String(u.geriMakine).split(' · ')[0])}`:''}${u.hataOp?` · hata: ${esc(kaliteHataMetni(u.hataOp))}`:''}${u.aciklama?` — ${esc(u.aciklama)}`:''} · ${esc(u.name||'')} ${fmtDT(u.ts)}</div>`).join('')}`;
}
