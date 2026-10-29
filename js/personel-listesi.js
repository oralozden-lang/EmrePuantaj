// personel-listesi.js — app.js (v180) satırları 1132-1229. Otomatik bölündü; davranış değişmedi.
import {
  BASLANGIC_AY,
  GOREVLER,
  GRUP,
  GRUP_SIRA,
  SGK_YOK,
  gorevBul,
  gorevTahmin,
  subeAdi,
} from './sabitler.js';
import { S } from './durum.js';
import { ayAdi, ayKey, esc, isimAnahtar, kisaAd, today, trTarih, ymd } from './yardimci.js';
import { isIsveren, isSube } from './rol.js';
import { pasifMi, pasifSure, pasifTarihi, sirala, sube } from './hesap.js';
import { gorevSatirYama, maasGecmisYama, maasSubeGecmisYazi, odemeSubesi } from './gecmis.js';
import { ekSubeleri } from './cok-sube.js';
import { kisaSubeAd } from './kadro.js';
import { ayniKisi } from './ay-ozet.js';
import { tumSubeler } from './subeler.js';
import { byId, render, view } from './cerceve.js';
import { toast } from './panel.js';
import { personelYaz, personelYazabilir, subePersoneli } from './personel.js';
import { ekSubePanel, ekYetkiVar } from './ek-sube.js';
import { BILGI, bilgiCoz, bilgiGoster, bilgiKaydet, tcOf, tcYukle } from './bilgi-dogrulama.js';
import { personelYapistirPanel } from './personel-yapistir.js';
import { personelPanel } from './personel-panel.js';
import { adBuyuk, isimsizMi } from './isim-esle.js';

// Personel listesi: tek tablo, her şey satır içinde düzenlenir, değişiklik anında kaydedilir.
// Aynı kişi farklı tarihlerde farklı şubelerde SGK'lı olabilir (şube değişikliği); aynı tarihlerde olamaz.
export function tarihCakisir(g1, c1, g2, c2) {
  return (!c2 || !g1 || g1 <= c2) && (!c1 || !g2 || g2 <= c1);
}
export function sgkCakisma(p, sgkV, ad, gi = p.giris, ci = p.cikis) {
  if (!sgkV || sgkV === SGK_YOK) return null;
  return (
    S.personel.find(
      x =>
        x.id !== p.id &&
        x.sgkSube &&
        x.sgkSube !== SGK_YOK &&
        x.sgkSube !== sgkV &&
        ayniKisi(x, { ...p, ad: ad || p.ad }) &&
        tarihCakisir(gi, ci, x.giris, x.cikis)
    ) || null
  );
}
export function sgkCakismaMesaj(c) {
  return `${adBuyuk(c.ad)} ${trTarih(c.giris) || '?'} – ${c.cikis ? trTarih(c.cikis) : 'devam'} arası ${subeAdi(c.sgkSube)} şubesinde SGK'lı. Aynı tarihlerde iki şubede SGK olamaz; tarihleri ayırın (örneğin oradan çıkış 1 Eylül, buraya giriş 2 Eylül).`;
}
// Telefonda personel listesi: kişi başına kısa satır, dokununca düzenleme penceresi.
export function accBaslik(k, ad, n, acik) {
  return `<button class="pkg pkgt" data-acc="${k}"><span>${ad} · ${n}</span><span class="ar">${acik ? '▾' : '▸'}</span></button>`;
}
export function mobilListe(A, C, P, Pf, td) {
  const ch = (b, v, c = '') => `<span class="pch ${c}"><b>${b}</b>${esc(v)}</span>`;
  const satir = p => {
    const sgk = p.sgkSube && p.sgkSube !== SGK_YOK ? p.sgkSube : '';
    const ana = p.anaSube || S.subeId;
    const ms = odemeSubesi(p, ayKey(today()));
    const cik = p.cikis && p.cikis < td;
    const tar = [
      p.giris ? 'Giriş ' + trTarih(p.giris) : '',
      p.baslama ? 'Deneme ' + trTarih(p.baslama) : '',
      p.cikis ? 'Çıkış ' + trTarih(p.cikis) : '',
      cik && !pasifSure(p, td) ? 'Pasife geçer ' + trTarih(pasifTarihi(p.cikis)) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const g = gorevTahmin(p);
    let c = sgk
      ? ch('SGK', subeAdi(sgk))
      : p.sgkSube === SGK_YOK
        ? ch('SGK', 'yok')
        : ch('SGK', 'seçilmedi', 'bad');
    if (ana !== sgk) c += ch('Çalıştığı', subeAdi(ana));
    const ek = ekSubeleri(p).filter(x => x !== ana && x !== sgk);
    if (ek.length && !isSube()) c += ch('Diğer', ek.map(subeAdi).join(', '), 'e');
    if (!isSube() && ms !== sgk && (ms !== ana || sgk)) c += ch('Maaş', subeAdi(ms), 'f');
    return `<button class="pkr ${cik ? 'cik' : ''}" data-pk="${esc(p.id)}"><span class="n">${esc(adBuyuk(p.ad))}<i>${esc(g || 'görev yok')} · ${esc(p.sekil || 'Tam')}</i></span>${tar ? `<span class="d">${tar}</span>` : ''}<span class="c">${c}</span></button>`;
  };
  const acc = S.acc || {};
  let h = '';
  GRUP_SIRA.forEach(g => {
    const l = A.filter(p => (p.grup || 'K') === g);
    if (!l.length) return;
    h += `<div class="pkg">${GRUP[g]} · ${l.length}</div>` + l.map(satir).join('');
  });
  if (C.length) {
    h += accBaslik('cik', 'Çıkış yapanlar', C.length, acc.cik);
    if (acc.cik) h += C.map(satir).join('');
  }
  if (P.length) {
    h += accBaslik('pas', 'Pasifler', P.length, acc.pas);
    if (acc.pas)
      h +=
        `<div class="pasara"><input class="pasAra" placeholder="Ad ile ara" value="${esc(S.pasAra || '')}" autocomplete="off"></div>` +
        (Pf.length ? Pf.map(satir).join('') : '<div class="pkg">Eşleşen kişi yok</div>');
  }
  return `<div class="pkl">${h || '<div class="pkg">Henüz personel yok</div>'}</div>`;
}
export function renderBilgiListesi() {
  const T = byId('blTbl');
  const gor = S.pgor || 'calisma';
  const CAL = gor === 'calisma';
  const list = sirala(subePersoneli());
  const td = ymd(today());
  const A = list.filter(p => !p.cikis || p.cikis >= td);
  const Pall = list.filter(p => p.cikis && p.cikis < td && pasifMi(p, td, list));
  const C = list.filter(p => p.cikis && p.cikis < td && !pasifMi(p, td, list));
  const acc = S.acc || {};
  const qa = isimAnahtar(S.pasAra || '');
  const Pf = qa ? Pall.filter(p => isimAnahtar(p.ad).includes(qa)) : Pall;
  const L = [...A, ...(acc.cik ? C : []), ...(acc.pas ? Pf : [])];
  const Lsay = [...A, ...C];
  const F = CAL ? [] : BILGI;
  if (T && T.contains(document.activeElement) && T.dataset.n === String(L.length)) return; // yazarken yeniden çizme
  tcYukle(L);
  const subeler = tumSubeler();
  const anaSec = (isIsveren() ? S.subeIds : S.me.subeler || []).filter(x => S.subeler[x]);
  const eksik = L.filter(p => !p.cikis || p.cikis >= td).filter(p => !p.sgkSube || !gorevBul(p.gorev)).length;
  const isz = Lsay.filter(p => isimsizMi(p)).length;
  const opt = (v, t, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(t)}</option>`;
  const satir = (p, r) => {
    const yaz = personelYazabilir(p);
    const dis = yaz ? '' : 'disabled';
    const disB = yaz && !isSube() ? '' : 'disabled';
    /* SGK / giriş / çıkış / şube / şekil: sadece bölge müdürü ve işveren */ const g = gorevBul(
      gorevTahmin(p)
    );
    const cik = p.cikis && p.cikis < td;
    const ana = p.anaSube || S.subeId;
    return `<tr data-pid="${esc(p.id)}" class="${cik ? 'mutr' : ''}">
     <td class="l nmc"><input class="adI" data-x="ad" value="${esc(adBuyuk(p.ad))}" autocomplete="off" spellcheck="false" ${dis}><span>${[CAL || isSube() ? '' : ana !== S.subeId ? 'çalıştığı: ' + esc(subeAdi(ana)) : '', cik ? 'çıktı' : '', isimsizMi(p) && p.excelAd ? 'Excel: ' + esc(p.excelAd) : ''].filter(Boolean).join(' · ')}</span></td>
     ${
       CAL
         ? `     <td class="bi"><select data-x="gorev" ${dis}>${g ? '' : opt('', 'Seçin', true)}${GOREVLER.map(x => opt(x.ad, x.ad, g && g.ad === x.ad)).join('')}</select></td>
     <td class="bi">${`<select data-x="sekil" ${disB} ${g && g.sekil ? 'disabled' : ''}>${g && g.sekil ? opt(g.sekil, 'Esnaf', true) : ['Tam', 'Part'].map(x => opt(x, x, (p.sekil === 'Part' ? 'Part' : 'Tam') === x)).join('')}</select>`}</td>
     <td class="bi sbh"><div class="sbz">${(() => {
       const sgk = p.sgkSube && p.sgkSube !== SGK_YOK ? p.sgkSube : '';
       const ms = odemeSubesi(p, ayKey(today()));
       let h = `<label class="chs ${p.sgkSube ? '' : 'bad'}"><b>SGK</b><select data-x="sgkSube" ${disB}>${p.sgkSube ? '' : opt('', 'Seçin', true)}${opt(SGK_YOK, 'Yok', p.sgkSube === SGK_YOK)}${subeler.map(([sid, ad]) => opt(sid, ad, p.sgkSube === sid)).join('')}</select></label>`;
       h += `<label class="chs ${ana === sgk ? 'ayni' : ''}" title="Çalıştığı şube (çizelgesinde göründüğü)"><b>Çalıştığı</b><select data-x="anaSube" ${disB}>${(anaSec.includes(ana) ? anaSec : [ana, ...anaSec]).map(x => opt(x, subeAdi(x), ana === x)).join('')}</select></label>`;
       const ek = ekSubeleri(p).filter(x => x !== ana && x !== sgk);
       if (!isSube() && (ek.length || ekYetkiVar()))
         h += `<label class="chs e" title="Bu şubelerin çizelgesinde de görünür; çalıştığı günün mesaisi o şubeden ödenir. Sadece işveren ve bölge müdürü değiştirir."><b>Diğer</b><button class="chb" data-x="ekSube" ${ekYetkiVar() ? '' : 'disabled'}>${ek.length ? esc(ek.map(kisaSubeAd).join(', ')) : '+ ekle'}</button></label>`;
       if (!isSube() && p.paketBasi)
         h += `<span class="chs ayni" title="Paket başı çalışan: maaş yok, hangi şubede paket attıysa o şubede ödenir. Muhasebe SGK şubesinde."><b>Paket başı</b></span>`;
       else if (!isSube() && ((sgk && sgk !== ana) || ms !== ana || ek.length)) {
         const sec = [
           [ana, subeAdi(ana)],
           ...(sgk && sgk !== ana ? [[sgk, subeAdi(sgk)]] : []),
           ...ek.map(x => [x, subeAdi(x)]),
           ...(ms !== ana && ms !== sgk && !ek.includes(ms) ? [[ms, subeAdi(ms)]] : []),
         ];
         h += `<label class="chs f" title="Bu aydan itibaren maaşın ödeneceği şube. Önceki aylar değişmez. Muhasebe SGK şubesinde kalır.${maasSubeGecmisYazi(p) ? ' Geçmiş: ' + esc(maasSubeGecmisYazi(p)) : ''}"><b>Maaş</b><select data-x="maasYeri" ${dis}>${sec.map(([v, a]) => opt(v, a, ms === v)).join('')}</select></label>`;
       }
       return h;
     })()}</div></td>
     <td class="bi"><input type="date" data-x="baslama" title="Deneme başlangıcı (SGK'dan önce çalıştığı ilk gün)" class="${p.baslama ? '' : 'bos'}" value="${esc(p.baslama || '')}" ${dis}></td>
     <td class="bi"><input type="date" data-x="giris" class="${p.giris ? '' : 'bos'}" value="${esc(p.giris || '')}" ${disB}></td>
     <td class="bi"><input type="date" data-x="cikis" class="${p.cikis ? '' : 'bos'}" value="${esc(p.cikis || '')}" ${disB}></td>
`
         : ''
     }
     ${F.map((f, c) => `<td class="bi"><input data-r="${r}" data-c="${c}" data-f="${f.k}" value="${esc(bilgiGoster(f, f.k === 'tc' ? tcOf(p) : p[f.k]))}" placeholder="${esc(f.ph)}" inputmode="${f.im}" autocomplete="off" spellcheck="false" ${dis}></td>`).join('')}
     <td class="bi"><button class="mini" data-x="menu" title="Sil / çıkış ver" ${dis}>⋯</button></td></tr>`;
  };
  let body = '';
  let r = 0;
  const CS = CAL ? 8 : F.length + 2;
  GRUP_SIRA.forEach(g => {
    const l = A.filter(p => (p.grup || 'K') === g);
    if (!l.length) return;
    body += `<tr class="grp"><td class="l nmc">${GRUP[g]} · ${l.length}</td><td colspan="${CS}"></td></tr>`;
    l.forEach(p => {
      body += satir(p, L.indexOf(p));
    });
  });
  const accTr = (k, ad, n) =>
    `<tr class="grp"><td class="l nmc"><button class="accb" data-acc="${k}">${ad} · ${n} ${acc[k] ? '▾' : '▸'}</button></td><td colspan="${CS}"></td></tr>`;
  if (C.length) {
    body += accTr('cik', 'Çıkış yapanlar', C.length);
    if (acc.cik)
      C.forEach(p => {
        body += satir(p, L.indexOf(p));
      });
  }
  if (Pall.length) {
    body += accTr('pas', 'Pasifler', Pall.length);
    if (acc.pas) {
      body += `<tr><td class="l" colspan="${CS + 1}"><input class="pasAra" placeholder="Ad ile ara" value="${esc(S.pasAra || '')}" autocomplete="off"></td></tr>`;
      Pf.forEach(p => {
        body += satir(p, L.indexOf(p));
      });
    }
  }
  const h = `<div class="actions"><button class="btn primary grow" id="addP">Personel ekle</button>${isSube() ? '' : `<button class="btn grow" id="addX">Excel'den yapıştır</button>`}</div>
   <p class="note" style="margin-top:0">${esc(sube().ad)} · ${(() => {
     const dis = Lsay.filter(
       p => p.anaSube !== S.subeId && p.sgkSube !== S.subeId && ekSubeleri(p).includes(S.subeId)
     ).length;
     return dis && !isSube() ? `${Lsay.length - dis} kişi + ${dis} diğer şubeden` : `${Lsay.length} kişi`;
   })()}${eksik ? ` · <b style="color:var(--warn)">${eksik} kişide görev ya da SGK şubesi eksik</b>` : ''}${isz ? ` · <b style="color:var(--warn)">${isz} isimsiz kişinin adı yazılmadı</b>` : ''} · ${CAL ? 'Hücreye tıklayıp değiştirin, anında kaydedilir.' : "Excel'den kopyalayıp yapıştırabilirsiniz; ilk sütun isimse satırlar isimle eşleşir."}</p>
   <div class="seg" id="pGor" style="margin-bottom:10px"><button data-v="calisma" class="${CAL ? 'on' : ''}">Çalışma bilgileri</button><button data-v="iletisim" class="${CAL ? '' : 'on'}">İletişim ve banka</button></div>
   ${CAL ? mobilListe(A, C, Pall, Pf, td) : ''}
   <div class="tbl-wrap ${CAL ? 'bl-cal' : ''}" style="scroll-padding-left:165px"><table class="pt bl sade ${CAL ? 'cal' : ''}" id="blTbl" data-n="${L.length}"><thead><tr><th class="l">Ad soyad</th>${CAL ? `<th>Görev</th><th>Şekil</th><th class="l">Şubeler</th><th>Deneme</th><th>SGK giriş</th><th>Çıkış</th>` : ''}${F.map(f => `<th>${f.ad}</th>`).join('')}<th></th></tr></thead>
   <tbody>${body || `<tr><td class="l" colspan="${CAL ? 8 : F.length + 2}">Henüz personel yok. "Personel ekle" ile başlayın.</td></tr>`}</tbody></table></div>`;
  view(h, () => {
    byId('addP').onclick = () => personelPanel(null);
    if (byId('addX')) byId('addX').onclick = personelYapistirPanel;
    document.querySelectorAll('[data-pk]').forEach(b => (b.onclick = () => personelPanel(b.dataset.pk)));
    const tb = byId('blTbl');
    document.querySelectorAll('[data-acc]').forEach(
      b =>
        (b.onclick = () => {
          S.acc = { ...(S.acc || {}), [b.dataset.acc]: !(S.acc || {})[b.dataset.acc] };
          render();
        })
    );
    document.querySelectorAll('.pasAra').forEach(
      i =>
        (i.oninput = () => {
          S.pasAra = i.value;
          const s0 = i.selectionStart;
          render();
          const nI = [...document.querySelectorAll('.pasAra')].find(x => x.offsetParent);
          if (nI) {
            nI.focus();
            try {
              nI.setSelectionRange(s0, s0);
            } catch (_) {}
          }
        })
    );
    document.querySelectorAll('#pGor button').forEach(
      b =>
        (b.onclick = () => {
          S.pgor = b.dataset.v;
          render();
        })
    );
    const pOf = el => S.personel.find(x => x.id === el.closest('tr').dataset.pid);
    const yaz1 = (p, body, yenidenCiz) => {
      const b2 = personelYaz(p.id, { ...p }, body);
      Object.assign(p, b2);
      if (yenidenCiz) {
        document.activeElement && document.activeElement.blur();
        render();
      }
    };
    const geri = (el, msg, v) => {
      toast(msg);
      el.value = v;
      el.classList.add('bad');
      setTimeout(() => el.classList.remove('bad'), 2500);
    };
    tb.querySelectorAll('[data-x]').forEach(el => {
      const x = el.dataset.x;
      if (x === 'menu') {
        el.onclick = () => personelPanel(el.closest('tr').dataset.pid);
        return;
      }
      if (x === 'ekSube') {
        el.onclick = () => {
          const p = pOf(el);
          if (p) ekSubePanel(p);
        };
        return;
      }
      if (x === 'ad')
        el.oninput = () => {
          const a = el.selectionStart,
            b = el.selectionEnd;
          el.value = el.value.toLocaleUpperCase('tr-TR');
          try {
            el.setSelectionRange(a, b);
          } catch (_) {}
        };
      const tarihMi = el.type === 'date';
      // Tarih alanı yazılırken her rakamda değişiklik gelir; sadece alandan çıkınca ve yıl tamamsa kaydet.
      if (tarihMi) {
        el.onchange = null;
        el.onkeydown = e => {
          if (e.key === 'Enter') el.blur();
        };
      }
      el[tarihMi ? 'onblur' : 'onchange'] = () => {
        const p = pOf(el);
        if (!p) return;
        const v = el.value;
        if (tarihMi) {
          if (v === (p[x] || '')) return;
          if (v && (+v.slice(0, 4) < 1990 || +v.slice(0, 4) > 2100))
            return geri(el, 'Tarih hatalı, yılı 4 haneli yazın.', p[x] || '');
        }
        if (x === 'ad') {
          const ad = adBuyuk(v);
          if (!ad) return geri(el, 'Ad soyad boş olamaz.', adBuyuk(p.ad));
          const c = sgkCakisma(p, p.sgkSube, ad);
          if (c) return geri(el, sgkCakismaMesaj(c), adBuyuk(p.ad));
          // İsimsiz kayda şubede zaten olan birinin adı verilirse: aynı kişiyse günleri iki kayıtta kalır, iki kez sayılır.
          if (isimsizMi(p) && ad !== adBuyuk(p.ad)) {
            const ana = p.anaSube || S.subeId;
            const ay = subePersoneli(ana).find(
              y =>
                y.id !== p.id && isimAnahtar(y.ad) === isimAnahtar(ad) && !(y.cikis && y.cikis < ymd(today()))
            );
            if (
              ay &&
              !confirm(
                `${subeAdi(ana)} listesinde ${adBuyuk(ay.ad)} zaten var.\n\nBu isimsiz kayıt o kişiyse İptal'e basın: çizelge günleri iki ayrı kayıtta kalır ve iki kez sayılır.\n\nFarklı kişiyse Tamam'a basın.`
              )
            )
              return geri(el, 'Ad değiştirilmedi.', adBuyuk(p.ad));
          }
          el.value = ad;
          if (ad !== p.ad) yaz1(p, { ad });
          return;
        }
        if (x === 'gorev') {
          const g = gorevBul(v);
          if (!g) return;
          const body = { gorev: g.ad, grup: g.grup, sekil: g.sekil || (p.sekil === 'Part' ? 'Part' : 'Tam') };
          yaz1(p, gorevSatirYama(p, body), true);
          return;
        }
        if (x === 'sekil') {
          yaz1(p, gorevSatirYama(p, { sekil: v }));
          return;
        }
        if (x === 'maasYeri') {
          const ak = ayKey(today());
          const sgk0 = p.sgkSube && p.sgkSube !== SGK_YOK ? p.sgkSube : '';
          const my = v === sgk0 && v !== (p.anaSube || S.subeId) ? 'sgk' : 'calistigi';
          const ym = maasGecmisYama(p, v, ak);
          yaz1(p, { maasYeri: my, ...(ym || {}) }, true);
          const hs = odemeSubesi(p, ak);
          toast(
            `${ayAdi(ak < BASLANGIC_AY ? BASLANGIC_AY : ak)} ayından itibaren maaşı ${subeAdi(hs)} puantajında; önceki aylar değişmez.${hs !== p.sgkSube && p.sgkSube && p.sgkSube !== SGK_YOK ? ` Muhasebe ${subeAdi(p.sgkSube)}'de kalır.` : ''}`
          );
          return;
        }
        if (x === 'sgkSube') {
          if (!v) return;
          const c = sgkCakisma(p, v);
          if (c) return geri(el, sgkCakismaMesaj(c), p.sgkSube || '');
          const eski = p.sgkSube;
          const ymS = maasGecmisYama(p, { sgkSube: v }, ayKey(today()));
          yaz1(p, { sgkSube: v, ...(ymS || {}) }, true);
          if (v !== SGK_YOK && v !== (p.anaSube || S.subeId) && v !== eski) {
            toast(`${subeAdi(v)} listesinde de görünür. Çizelgeye o şubenin müdürü "+ ekle" ile ekler.`);
          }
          return;
        }
        if (x === 'anaSube') {
          if (!v || v === p.anaSube) return;
          const ak = ayKey(today());
          const ym = maasGecmisYama(p, { anaSube: v }, ak);
          yaz1(p, { anaSube: v, ...(ym || {}) }, true);
          toast(
            `${subeAdi(v)} listesine geçti. Çizelgeye "+ ekle" ile eklenir.${ym ? ` Maaşı ${ayAdi(ak < BASLANGIC_AY ? BASLANGIC_AY : ak)} ayından itibaren ${subeAdi(odemeSubesi(p, ak))} puantajında; önceki aylar değişmez.` : ''}`
          );
          return;
        }
        if (x === 'baslama') {
          if (v && p.giris && v > p.giris)
            return geri(
              el,
              'İşe başlama SGK girişinden sonra olamaz. Boş bırakılırsa SGK girişi kullanılır.',
              p.baslama || ''
            );
          yaz1(p, { baslama: v }, true);
          return;
        }
        if (x === 'giris' || x === 'cikis') {
          const gi = x === 'giris' ? v : p.giris,
            ci = x === 'cikis' ? v : p.cikis;
          if (gi && ci && ci < gi) return geri(el, 'Çıkış tarihi girişten önce olamaz.', p[x] || '');
          {
            const c = sgkCakisma(p, p.sgkSube, p.ad, gi, ci);
            if (c) return geri(el, sgkCakismaMesaj(c), p[x] || '');
          }
          yaz1(p, { [x]: v }, x === 'cikis');
          return;
        }
      };
    });
    const inp = (r, c) => tb.querySelector(`input[data-r="${r}"][data-c="${c}"]`);
    const kaydet = (el, sessiz) => {
      const p = L[+el.dataset.r];
      const f = F[+el.dataset.c];
      if (!p || !f) return true;
      const r = bilgiCoz(f, el.value);
      if (r.hata) {
        el.classList.add('bad');
        el.title = r.hata;
        if (!sessiz) toast(`${kisaAd(p.ad)} · ${r.hata}`);
        return false;
      }
      el.classList.remove('bad');
      el.title = '';
      el.value = bilgiGoster(f, r.v);
      const eski = f.k === 'tc' ? tcOf(p) : p[f.k] || '';
      if (r.v !== eski) bilgiKaydet(p, f, r.v);
      return true;
    };
    const satirSira = [...tb.querySelectorAll('tr[data-pid]')]
      .map(t => t.querySelector('input[data-c="0"]'))
      .map(i => i && +i.dataset.r);
    const asagi = (r, yon) => {
      const i = satirSira.indexOf(r);
      const n = satirSira[i + yon];
      return n == null ? null : n;
    };
    tb.querySelectorAll('input[data-c]').forEach(el => {
      el.onchange = () => kaydet(el);
      el.onkeydown = e => {
        const r = +el.dataset.r,
          c = +el.dataset.c;
        let n = null;
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          const q = asagi(r, 1);
          n = q == null ? null : inp(q, c);
        } else if (e.key === 'ArrowUp') {
          const q = asagi(r, -1);
          n = q == null ? null : inp(q, c);
        }
        if (n || e.key === 'Enter') {
          e.preventDefault();
          if (n) {
            n.focus();
            n.select();
          } else el.blur();
        }
      };
      el.onpaste = e => {
        const t = (e.clipboardData || window.clipboardData).getData('text');
        if (!/[\t\n]/.test(t.trim())) return;
        e.preventDefault();
        let M = t.replace(/\r/g, '').split('\n');
        while (M.length && !M[M.length - 1].trim()) M.pop();
        M = M.map(x => x.split('\t'));
        const r0 = +el.dataset.r,
          c0 = +el.dataset.c;
        const ad = {};
        L.forEach((p, i) => (ad[isimAnahtar(p.ad)] = i));
        const isimli =
          M[0].length > 1 && M.filter(x => x[0].trim()).every(x => ad[isimAnahtar(x[0])] != null);
        let n = 0,
          bad = 0,
          yok = 0;
        let rr = r0;
        M.forEach((row, i) => {
          const r = isimli ? ad[isimAnahtar(row[0])] : i === 0 ? r0 : (rr = asagi(rr, 1));
          const cells = isimli ? row.slice(1) : row;
          if (r == null || r >= L.length) {
            yok++;
            return;
          }
          cells.forEach((v, j) => {
            const x = inp(r, c0 + j);
            if (!x || x.disabled) return;
            x.value = v.trim();
            if (kaydet(x, true)) n++;
            else bad++;
          });
        });
        toast(
          `${n} hücre yapıştırıldı${bad ? `, ${bad} hücre hatalı (kırmızı)` : ''}${yok ? `, ${yok} satır eşleşmedi` : ''}.`
        );
      };
    });
  });
}
