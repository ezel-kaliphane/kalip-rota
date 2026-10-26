/* ==================== KİŞİ YETKİLERİ — TEK EKRAN (26.10.2026, kullanıcı: "kişi yetkilerini tek ekranda topla") ====================
   Önce bir kişinin yetkileri beş ayrı yerdeydi: Ayarlar → Kişi Bazlı Makine Erişimi, Sekme / Bölüm Erişimi,
   Takım Stok İzinleri (+ içinde Dolap Erişimi), Operatörler → Personel Ayarları (çoklu iş, fason, mesaj,
   varsayılan makine), Atölye Ayarları, Kullanıcı Ekle listesi (rapor / tadilat / bildirim yetkileri).
   Şimdi: kişiyi seç → hepsi bölüm bölüm tek sayfada. YENİ KAYIT MANTIĞI YOK — her kutu eskiden
   kullanılan fonksiyonu çağırır (toggleMachineAccess, setAdminTabPermission, toggleUserPerm,
   toolDolapErisimToggle, toggleUserAtolye, toggleTadilatYetkisi …), değişiklik canlı dinleyiciden
   (operators, adminTabPermissions, settings) ekrana döner. Yalnız SuperAdmin (Operatörler ekranının koşulu). */
let yetkiKisi = '', yetkiAra = '';
function kisiYetkiAc(code){ if(code) yetkiKisi = code; operatorSubView = 'yetki'; setView('operatorler'); }
function yetkiRol(v){ return v.isSuperAdmin ? 'Süper Admin' : v.isSef ? 'Şef' : v.isUretimSef ? 'Üretim Şefi' : v.isAdmin ? 'Yönetici' : 'Operatör'; }
function yetkiYoneticiMi(v){ return !!(v.isAdmin || v.isSef || v.isUretimSef); }

function renderKisiYetkileri(){
  const kisiler = Object.entries(STATE.operators || {}).filter(([c, v]) => v && !v.isSuperAdmin)
    .sort((a, b) => String(a[1].displayName || a[0]).localeCompare(String(b[1].displayName || b[0]), 'tr'));
  if(yetkiKisi && !STATE.operators[yetkiKisi]) yetkiKisi = '';
  const katla = s => trNorm(s).replace(/ş/g,'s').replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ö/g,'o').replace(/ü/g,'u');
  const q = katla(yetkiAra.trim());
  const liste = kisiler.filter(([c, v]) => !q || katla(c + ' ' + (v.displayName || '') + ' ' + yetkiRol(v)).includes(q));

  const kisiListesi = `<aside class="ky-liste" aria-label="Kişiler">
    <div class="ky-ara">${ico('search', 15)}<input type="search" placeholder="Kişi ara — ad, kod, rol" value="${esc(yetkiAra)}" oninput="yetkiAra=this.value; render()" aria-label="Kişi ara"></div>
    <div class="ky-kisiler">${liste.map(([c, v]) => `<button type="button" class="ky-kisi ${yetkiKisi === c ? 'on' : ''}" onclick="yetkiKisi='${escJs(c)}'; render()">
        <span class="ky-ad">${esc(v.displayName || c)}</span><span class="ky-kod mono">${esc(c)}</span><span class="ky-rol ${yetkiYoneticiMi(v) ? 'yon' : ''}">${yetkiRol(v)}</span>
      </button>`).join('') || '<div class="ky-bos">Eşleşen kişi yok.</div>'}</div>
  </aside>`;

  if(!yetkiKisi){
    return `<div class="ky-ekran">${kisiListesi}<section class="ky-detay ky-bos-detay">Soldan bir kişi seç — bütün yetkileri burada, bölüm bölüm görünür.</section></div>`;
  }
  const c = yetkiKisi, v = STATE.operators[c] || {};
  const yon = yetkiYoneticiMi(v);
  const kutu = (ac, onchange, etiket, alt) => `<label class="ky-kutu"><input type="checkbox" ${ac ? 'checked' : ''} onchange="${onchange}"><span><b>${etiket}</b>${alt ? `<small>${alt}</small>` : ''}</span></label>`;
  const bolum = (baslik, ic, not) => `<div class="set-card ky-bolum"><div class="set-sec" style="margin:0 0 10px">${baslik}</div>${not ? `<div class="ky-not">${not}</div>` : ''}${ic}</div>`;
  const cJs = escJs(c);

  // atölye
  const atolyeler = getUserAtolyeler(c);
  const atolye = bolum('Atölye', `<div class="ky-kutular">
    ${kutu(atolyeler.includes('imalat'), `toggleUserAtolye('${cJs}','imalat')`, 'İmalat atölyesi')}
    ${kutu(atolyeler.includes('tadilat'), `toggleUserAtolye('${cJs}','tadilat')`, 'Tadilat atölyesi')}</div>`);

  // operatör ekranı
  const uretim = bolum('Operatör ekranı', `<div class="ky-kutular">
    ${kutu(v.cokluIsEmri, `toggleCokluIsEmri('${cJs}')`, 'Çoklu iş emri', 'tek makinede aynı anda birden fazla iş emri')}
    ${kutu(v.multiJob, `toggleMultiJob('${cJs}')`, 'Çoklu iş', 'aynı anda birden fazla makinede iş')}
    ${kutu(v.fasonYetkisi, `toggleFasonYetkisi('${cJs}')`, 'Fason yetkisi', 'fason makinelerde başkasının işini görür / kapatır')}
    ${kutu(v.messagesAccess, `toggleMessagesAccess('${cJs}')`, 'Mesaj erişimi')}
  </div>
  <label class="ky-alan"><span>Varsayılan makine <small>— "Başla" ekranında dolu gelir</small></span><select onchange="updateDefaultMachine('${cJs}', this.value)">
    <option value="">— Varsayılan makine yok —</option>
    ${allMachines().map(m => { const l = `${m.code} · ${m.name}`; return `<option value="${esc(l)}" ${v.defaultMachine === l ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}
  </select></label>`);

  // makine erişimi
  const izinli = v.allowedMachines ? Object.keys(v.allowedMachines).filter(k => v.allowedMachines[k]) : allMachineCodes();
  const makine = bolum(`Makine erişimi <span class="ky-say">${izinli.length} / ${allMachines().length}</span>`,
    `<div class="ky-makineler">${allMachines().map(m => `<label class="ky-makine ${izinli.includes(m.code) ? 'on' : ''}"><input type="checkbox" ${izinli.includes(m.code) ? 'checked' : ''} onchange="toggleMachineAccess('${cJs}','${escJs(m.code)}')"><b class="mono">${esc(m.code)}</b><span>${esc(m.name)}</span></label>`).join('')}</div>`,
    'İşaretli makineler kişinin "Çalışılan Makine" listesinde çıkar. Hiç değiştirilmemiş kişi hepsini görür.');

  // takım dolabı
  let takim = '';
  if(typeof toolStokEnabled === 'function' && toolStokEnabled()){
    if(typeof ensureToolLocationsLoaded === 'function') ensureToolLocationsLoaded(() => safeRender());
    const dolaplar = (typeof toolLocationsArray === 'function' ? toolLocationsArray() : []).filter(l => l.aktif !== false);
    const ozel = typeof toolDolapErisimi === 'function' && !!toolDolapErisimi(c);
    takim = bolum('Takım &amp; Sarf dolabı', `<div class="ky-kutular">
      ${kutu(v.permTakimStokGor, `toggleUserPerm('${cJs}','permTakimStokGor')`, 'Takım Dolabı\'nı görür / çıkış yapar')}
      ${kutu(v.permTakimStokSayim, `toggleUserPerm('${cJs}','permTakimStokSayim')`, 'Sayım yapabilir')}
    </div>
    ${dolaplar.length ? `<div class="ky-alt-baslik">Çıkış yapabildiği dolaplar ${ozel ? '' : '<small>— hiç değiştirilmemiş: hepsi</small>'}</div>
    <div class="ky-kutular">${dolaplar.map(l => kutu(toolDolapErisebilir(c, l.id), `toolDolapErisimToggle('${cJs}','${escJs(l.id)}')`, esc(l.ad))).join('')}</div>` : ''}`);
  }

  // yönetici ekranı
  let yonetici = '';
  if(yon){
    const tp = adminTabPermissions[c] || {};
    const ac = k => tp[k] !== false;
    yonetici = bolum('Yönetici ekranı — görebildiği bölümler',
      `<div class="ky-kutular">${ADMIN_TAB_DEFS.map(t => kutu(ac(t.key), `setAdminTabPermission('${cJs}','${t.key}', this.checked)`, esc(t.label))).join('')}</div>
      ${ac('analiz') ? `<div class="ky-alt-baslik">Analiz — görünümler</div><div class="ky-kutular">${ANALIZ_VIEW_DEFS.map(a => kutu((tp.analizViews || {})[a.key] !== false, `setAnalizViewPermission('${cJs}','${a.key}', this.checked)`, esc(a.label))).join('')}</div>` : ''}
      ${ac('takimStok') ? `<div class="ky-alt-baslik">Takım Stok — alt bölümler</div><div class="ky-kutular">${TAKIM_STOK_SUBTAB_DEFS.map(a => kutu((tp.takimStokViews || {})[a.key] !== false, `setTakimStokSubTabPermission('${cJs}','${a.key}', this.checked)`, esc(a.label))).join('')}</div>` : ''}
      <div class="ky-alt-baslik">Uyarılar</div><div class="ky-kutular">
        ${kutu(ac('uzunDurusUyari'), `setAdminTabPermission('${cJs}','uzunDurusUyari', this.checked)`, 'Uzun duruş uyarısı')}
        ${kutu(ac('uzunDevamEdenUyari'), `setAdminTabPermission('${cJs}','uzunDevamEdenUyari', this.checked)`, 'Uzun devam eden uyarısı')}
      </div>`, 'Hiç değiştirilmemiş yönetici her bölümü görür.');
  }

  // işlem yetkileri
  let islem = '';
  if(v.isAdmin){
    const tadilat = v.permTadilatOlustur === true || (v.permTadilatOlustur !== false && (v.isSef || v.isUretimSef));
    islem = bolum('İşlem yetkileri', `<div class="ky-kutular">
      ${kutu(tadilat, `toggleTadilatYetkisi('${cJs}')`, 'Tadilat oluşturabilir', v.isSef || v.isUretimSef ? 'şefler için varsayılan açık' : '')}
      ${kutu(v.permReportEdit !== false, `toggleUserPerm('${cJs}','permReportEdit')`, 'Kayıtları düzenleyebilir')}
      ${kutu(v.permReportDelete, `toggleUserPerm('${cJs}','permReportDelete')`, 'Kayıtları silebilir')}
      ${kutu(v.permBildirimYonetimi, `toggleUserPerm('${cJs}','permBildirimYonetimi')`, 'Bildirim ayarlarını yönetebilir')}
    </div>`);
  }

  const detay = `<section class="ky-detay">
    <div class="ky-baslik"><div><div class="ky-baslik-ad">${esc(v.displayName || c)}</div><div class="ky-alt"><span class="mono">${esc(c)}</span> · ${yetkiRol(v)}</div></div>
      <span class="ky-rozet">Değişiklikler anında kaydedilir</span></div>
    ${atolye}${uretim}${makine}${takim}${yonetici}${islem}
    <div class="ky-not">Rol (Yönetici / Şef / Süper Admin) buradan değiştirilemez — yalnızca Firebase Console'dan.</div>
  </section>`;
  return `<div class="ky-ekran">${kisiListesi}${detay}</div>`;
}
