// iscilik.js — app.js (v180) satırları 2570-2664. Otomatik bölündü; davranış değişmedi.
import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { GRUP, GRUP_SIRA, SGK_YOK, subeAdi } from './sabitler.js';
import { db, setDoc } from './firebase.js';
import { S } from './durum.js';
import { ayAdi, ayKaydir, esc, sayi, tl, tl0, trTarih } from './yardimci.js';
import { isBolge, isIsveren } from './rol.js';
import { aktifAyda } from './hesap.js';
import { ayniKisi, sgkVar } from './ay-ozet.js';
import { yazmaHatasi } from './yazma.js';
import { byId, render, view } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { tarihSaat } from './hafta-kapatma.js';
import { kfAktifMi, kfBagla, kfBaslik, kfDurum, kfUygula } from './kolon-filtre.js';
import { adBuyuk } from './isim-esle.js';
import { iscAyar, iscAyi, iscGunluk, iscilikHesapla, r2 } from './iscilik-hesap.js';

export function iscDinle(ak) {
  // Bölge müdürü: işverenin yazdığı, sadece kendi şubelerini içeren özet belgeyi (iscilikBolge/{ay}__{uid}) okur.
  if (isBolge()) {
    const buid = S.user.uid;
    if (S.iscKey === ak) return;
    if (S.iscUnsub) S.iscUnsub();
    S.iscKey = ak;
    S.iscDoc = null;
    S.iscOnce = null;
    S.iscUnsub = onSnapshot(
      doc(db, 'iscilikBolge', ak + '__' + buid),
      s => {
        const d = s.exists() ? s.data() : {};
        S.iscDoc = d;
        S.iscSabit = { lojman: d.lojSabit || {} };
        S.iscHata = false;
        if (S.tab === 'yonetim' && S.ynt === 'iscilik') render();
      },
      e => {
        console.error(e);
        S.iscDoc = {};
        S.iscHata = true;
        render();
      }
    );
    getDoc(doc(db, 'iscilikBolge', ayKaydir(ak, -1) + '__' + buid))
      .then(s => {
        if (S.iscKey !== ak) return;
        S.iscOnce = s.exists() ? s.data() : {};
        render();
      })
      .catch(() => {
        S.iscOnce = {};
      });
    return;
  }
  // Her ay aynı lojman tutarları (şube → {ay: tutar}); ayrı belgede tutulur, aya bağlı değildir.
  if (!S.iscSabitUnsub)
    S.iscSabitUnsub = onSnapshot(
      doc(db, 'iscilik', 'sabit'),
      s => {
        S.iscSabit = s.exists() ? s.data() : {};
        iscBolgeSenkron();
        if (S.tab === 'yonetim' && S.ynt === 'iscilik') render();
      },
      e => {
        console.error(e);
        S.iscSabit = {};
      }
    );
  if (S.iscKey === ak) return;
  if (S.iscUnsub) S.iscUnsub();
  S.iscKey = ak;
  S.iscDoc = null;
  S.iscOnce = null;
  S.iscUnsub = onSnapshot(
    doc(db, 'iscilik', ak),
    s => {
      S.iscDoc = s.exists() ? s.data() : {};
      S.iscHata = false;
      iscBolgeSenkron();
      if (S.tab === 'yonetim' && S.ynt === 'iscilik') render();
    },
    e => {
      console.error(e);
      S.iscDoc = {};
      S.iscHata = true;
      render();
    }
  );
  getDoc(doc(db, 'iscilik', ayKaydir(ak, -1)))
    .then(s => {
      if (S.iscKey !== ak) return;
      S.iscOnce = s.exists() ? s.data() : {};
      iscBolgeSenkron();
      render();
    })
    .catch(() => {
      S.iscOnce = {};
    });
}
// İşveren: her bölge müdürü için, sadece kendi şubelerinin işçilik özetini ayrı belgeye yazar (değişmediyse yazmaz).
let ibT;
export function iscBolgeSenkron() {
  clearTimeout(ibT);
  ibT = setTimeout(() => {
    if (!isIsveren() || !S.iscKey || S.iscDoc == null || S.iscSabit == null) return;
    const ak = S.iscKey;
    const bm = (S.users || []).filter(u => u.rol === 'bolge' && u.aktif !== false);
    S.iscPub = S.iscPub || {};
    [
      [ak, S.iscDoc],
      [ayKaydir(ak, -1), S.iscOnce],
    ].forEach(([ay, D]) => {
      if (D == null) return;
      bm.forEach(u => {
        const L = (u.subeler || []).filter(x => S.subeIds.includes(x));
        const pick = o => {
          const r = {};
          L.forEach(x => {
            if (o && o[x] != null) r[x] = o[x];
          });
          return r;
        };
        const veri = {
          ay,
          bm: u.uid,
          ayar: D.ayar || null,
          hesapTarihi: D.hesapTarihi || null,
          hesaplayan: D.hesaplayan || '',
          subeler: pick(D.subeler),
          hesap: pick(D.hesap),
          lojSabit: pick((S.iscSabit || {}).lojman),
        };
        const id = ay + '__' + u.uid,
          js = JSON.stringify(veri);
        if (S.iscPub[id] === js) return;
        S.iscPub[id] = js;
        setDoc(doc(db, 'iscilikBolge', id), veri).catch(e => {
          console.error(e);
          delete S.iscPub[id];
        });
      });
    });
  }, 1500);
}
export const iscOran = (t, c) => (c > 0 ? (t / c) * 100 : null);
export const iscYuzde = x => (x == null ? '—' : '%' + (Math.round(x * 10) / 10).toLocaleString('tr-TR'));
// Lojman: o ay için elle yazılmış tutar varsa o; yoksa "her ay aynı" olarak kaydedilen, o aya kadar geçerli son tutar.
export function iscSabitLoj(sid, ak) {
  const m = ((S.iscSabit || {}).lojman || {})[sid];
  if (!m || typeof m !== 'object') return null;
  const k = Object.keys(m)
    .filter(x => x <= ak)
    .sort()
    .pop();
  return k ? sayi(m[k]) : null;
}
export function iscLoj(D, ak, sid) {
  const g = ((D && D.subeler) || {})[sid] || {};
  if (g.lojman != null) return sayi(g.lojman);
  return iscSabitLoj(sid, ak) || 0;
}
export function iscLojSabitMi(D, ak, sid) {
  const g = ((D && D.subeler) || {})[sid] || {};
  return g.lojman == null && (iscSabitLoj(sid, ak) || 0) > 0;
}
// SGK bilgisi eksik ya da çelişkili personel (işçilik maliyetini yanlış etkileyebilir).
export function sgkSorunlari(ak) {
  const o = [];
  S.personel.forEach(p => {
    if (!aktifAyda(p, ak) || p.sekil === 'Esnaf kurye') return;
    /* esnaf kurye ayrı şirket: SGK uyarısı yok */ const n = [];
    if (!p.sgkSube) n.push('SGK şubesi seçilmemiş');
    else if (p.sgkSube === SGK_YOK) {
      if (p.giris || (p.cikis && false)) n.push('SGK şubesi "Boş" ama SGK giriş tarihi yazılı');
    } else {
      if (!p.giris) {
        const d = S.personel.filter(x => x.id !== p.id && ayniKisi(x, p) && x.giris && sgkVar(x));
        n.push(
          d.length
            ? 'SGK şubesi var ama giriş boş; aynı kişinin ' +
                d
                  .map(
                    x =>
                      subeAdi(x.sgkSube) +
                      ' kaydında SGK girişi ' +
                      trTarih(x.giris) +
                      (x.cikis ? ' – çıkış ' + trTarih(x.cikis) : '')
                  )
                  .join(', ') +
                ' var → bu kayıtta SGK günü sayılmıyor'
            : 'SGK şubesi var ama SGK giriş tarihi boş (ay boyu sigortalı sayılır)'
        );
      }
    }
    if (p.giris && p.cikis && p.cikis < p.giris) n.push('SGK çıkış tarihi girişten önce');
    if (n.length) o.push({ ad: p.ad, sorun: n.join(' · '), sube: subeAdi(p.anaSube) });
  });
  return o;
}
export function iscSgkSheet(ak) {
  const L = sgkSorunlari(ak);
  openSheet(
    `<h2>SGK bilgisi kontrolü</h2><div class="sub">${ayAdi(ak)} · ${L.length} kişi</div>${L.length ? `<div class="tk-wrap"><table class="tk"><thead><tr><th class="l">Kişi</th><th class="l">Şube</th><th class="l">Sorun</th></tr></thead><tbody>${L.map(x => `<tr><td class="l">${esc(adBuyuk(x.ad))}</td><td class="l">${esc(x.sube)}</td><td class="l">${esc(x.sorun)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Sorun bulunmadı.</p>'}<div class="row2"><button class="btn grow" id="sgkK">Kapat</button></div>`,
    () => {
      byId('sgkK').onclick = closeSheet;
    }
  );
}
export function renderIscilik(h) {
  const ak = iscAyi();
  iscDinle(ak);
  const ae = document.activeElement;
  const D = S.iscDoc;
  const ayar = iscAyar(D && D.ayar ? D : S.iscOnce && S.iscOnce.ayar ? S.iscOnce : {});
  const gir = (D && D.subeler) || {};
  const hes = (D && D.hesap) || {};
  const once = S.iscOnce || {};
  h += `<div class="ptnav" style="justify-content:center"><div class="ptay"><button class="nav-arrow" id="iPrev" aria-label="Önceki ay">‹</button><div class="ttl">${ayAdi(ak)}</div><button class="nav-arrow" id="iNext" aria-label="Sonraki ay">›</button></div></div>`;
  if (S.iscHata)
    h += `<div class="banner bad">İşçilik verisi okunamıyor. Firebase kurallarını güncelleyin (firestore.rules).</div>`;
  if (D === null) {
    return view(h + `<div class="empty-state"><b>Yükleniyor</b></div>`, () => iscBagla(ak));
  }
  const iv = isIsveren();
  if (iv)
    h += `<p class="note" style="margin:0 0 6px">Günlük SGK maliyeti ${tl(iscGunluk(ayar))} ₺ (${tl(iscGunluk(ayar) * 30)} ÷ 30) <button class="mini" id="iAyar">⚙ Ayarlar</button></p>`;
  if (iv) {
    const sn = sgkSorunlari(ak).length;
    if (sn)
      h += `<div class="banner bad">${sn} kişinin SGK bilgisi eksik ya da çelişkili. <button class="mini" id="iSgk">Listeyi gör</button></div>`;
  }
  if (iv)
    h += `<div class="actions"><button class="btn primary grow" id="iHes" ${S.iscCalisiyor ? 'disabled' : ''}>${S.iscCalisiyor ? esc(S.iscDurum || 'Hesaplanıyor…') : D && D.hesapTarihi ? 'Yeniden hesapla' : 'Hesapla'}</button></div>`;
  if (D && D.hesapTarihi)
    h += `<p class="note" style="margin-top:0">Son hesap: ${tarihSaat(D.hesapTarihi)}${D.hesaplayan ? ' · ' + esc(D.hesaplayan) : ''}. ${iv ? 'Puantajda değişiklik olduysa yeniden hesaplayın.' : 'Hesabı işveren yapar.'}</p>`;
  if (Object.values(hes).some(x => x && x.fv !== 2))
    h += `<div class="banner bad">Bu ay eski yöntemle hesaplanmış (paket primi Elden'in içinde, bankaya yatan primden düşülmüş). <b>Yeniden hesapla</b>'ya basın.</div>`;
  const IR = S.subeIds.map(sid => {
    const g = gir[sid] || {};
    const x = hes[sid];
    const c = sayi(g.ciro),
      lj = iscLoj(D, ak, sid);
    const top = x ? r2(x.toplam + lj) : null;
    const o = top != null ? iscOran(top, c) : null;
    const og = (once.hesap || {})[sid];
    const oc = sayi(((once.subeler || {})[sid] || {}).ciro);
    const oo = og ? iscOran(og.toplam + iscLoj(once, ayKaydir(ak, -1), sid), oc) : null;
    return { sid, x, c, lj, top, o, oo };
  });
  const nv = (f, k) => r => (r.x ? tl0(f(r)) : '—');
  const IK = [
    { k: 'sube', ad: 'Şube', v: r => subeAdi(r.sid), l: 1 },
    {
      k: 'resmi',
      ad: 'Resmi (SGK + maaş)',
      v: r => (r.x ? tl0(r.x.resmi + r.x.banka) : '—'),
      n: r => (r.x ? r.x.resmi + r.x.banka : -1),
    },
    { k: 'elden', ad: 'Elden', v: r => (r.x ? tl0(r.x.elden) : '—'), n: r => (r.x ? r.x.elden : -1) },
    {
      k: 'paket',
      ad: 'Paket primi',
      v: r => (r.x ? tl0(sayi(r.x.paket)) : '—'),
      n: r => (r.x ? sayi(r.x.paket) : -1),
    },
    {
      k: 'top',
      ad: 'Toplam işçilik',
      v: r => (r.top != null ? tl0(r.top) : '—'),
      n: r => (r.top != null ? r.top : -1),
    },
    { k: 'oran', ad: 'Oran', v: r => iscYuzde(r.o), n: r => (r.o == null ? -1 : r.o) },
  ];
  S.iscKfSatir = { cols: IK, rows: IR };
  const IV = kfUygula('isc', IK, IR);
  const fa = kfAktifMi('isc');
  let tc = 0,
    tl_ = 0,
    tt = 0,
    tr_ = 0,
    te = 0,
    tp = 0;
  IV.forEach(r => {
    if (r.top != null) {
      tc += r.c;
      tl_ += r.lj;
      tt += r.top;
      tr_ += r.x.resmi + r.x.banka;
      te += r.x.elden;
      tp += sayi(r.x.paket);
    }
  });
  const satir = IV.map(({ sid, x, c, lj, top, o, oo }) => {
    const dz = x
      ? {
          kesin: '<span class="chip ok">Kesin</span>',
          onayli: '<span class="chip ok">Onaylı</span>',
          tahmini: '<span class="chip warn">Tahmini</span>',
        }[x.durum] || ''
      : '';
    return `<tr><td class="l"><button class="mini" data-isd="${esc(sid)}">${esc(subeAdi(sid))}</button> ${dz}<br><small class="mut">Ciro ${c ? tl0(c) : 'girilmedi'}${lj ? ' · Lojman ' + tl0(lj) : ''}</small></td>
      <td>${x ? tl0(x.resmi + x.banka) + (x.gunTop ? ` <small>(${x.gunTop} gün)</small>` : '') : '—'}</td><td>${x ? tl0(x.elden) : '—'}</td><td>${x ? tl0(sayi(x.paket)) : '—'}</td><td><b>${top != null ? tl0(top) : '—'}</b></td>
      <td><b>${iscYuzde(o)}</b>${oo != null ? `<br><small class="mut">geçen ay ${iscYuzde(oo)}</small>` : ''}</td></tr>`;
  }).join('');
  if (fa)
    h += `<div class="kfbar">Filtre açık · ${IV.length} / ${IR.length} şube gösteriliyor, toplamlar sadece görünenler için <button class="mini" id="kfHepsiI">Filtreleri kaldır</button></div>`;
  h += `<div class="tk-wrap" style="overflow-x:auto"><table class="tk" id="iscT"><thead><tr>${IK.map(c => kfBaslik('isc', c, c.l ? 'l' : '')).join('')}</tr></thead><tbody>${satir}</tbody>
    <tfoot><tr><td class="l"><b>${fa ? `Filtreli toplam · ${IV.length} / ${IR.length} şube` : 'Toplam'}</b><br><small class="mut">Ciro ${tl0(tc)}${tl_ ? ' · Lojman ' + tl0(tl_) : ''}</small></td><td>${tl0(tr_)}</td><td>${tl0(te)}</td><td>${tl0(tp)}</td><td><b>${tl0(tt)}</b></td><td><b>${iscYuzde(iscOran(tt, tc))}</b></td></tr></tfoot></table></div>
    <p class="note yardim">Şube adına dokunun: ciro, lojman ve kişi kişi döküm. Toplam işçilik lojman dahildir. Resmi: SGK günü × günlük resmi maliyet (bankaya yatan dahil). Elden: maaş farkı, fazla mesai, ciro primi, ek ödeme − kesinti. Paket primi ödemeler listesinden gelir. Maaş, SGK ve fazla mesai kişinin maaşının ödendiği şubeye yazılır. "Tahmini": ay henüz onaylanmadı, rakamlar değişebilir.</p>`;
  return view(h, () => iscBagla(ak));
}
export function iscBagla(ak) {
  document.querySelectorAll('#ySeg button').forEach(
    b =>
      (b.onclick = () => {
        S.ynt = b.dataset.v;
        render();
      })
  );
  const p = byId('iPrev'),
    n = byId('iNext');
  if (p)
    p.onclick = () => {
      S.iscAy = ayKaydir(ak, -1);
      render();
    };
  if (n)
    n.onclick = () => {
      S.iscAy = ayKaydir(ak, 1);
      render();
    };
  const sg = byId('iSgk');
  if (sg) sg.onclick = () => iscSgkSheet(ak);
  const hb = byId('iHes');
  if (hb) hb.onclick = () => iscilikHesapla(ak);
  if (S.iscKfSatir) kfBagla('isc', S.iscKfSatir.cols, S.iscKfSatir.rows);
  const kh = byId('kfHepsiI');
  if (kh)
    kh.onclick = () => {
      const d = kfDurum('isc');
      d.f = {};
      d.sort = null;
      render();
    };
  const ay = byId('iAyar');
  if (ay)
    ay.onclick = () => {
      const D = S.iscDoc || {};
      const a = iscAyar(D && D.ayar ? D : S.iscOnce && S.iscOnce.ayar ? S.iscOnce : {});
      openSheet(
        `<h2>İşçilik ayarı</h2><div class="sub">${ayAdi(ak)}</div><label class="field"><span>30 günlük SGK'lı çalışanın aylık maliyeti (₺)</span><input id="iaM" inputmode="decimal" value="${esc(tl(iscGunluk(a) * 30))}"></label>
     <p class="note">Bankaya yatan net maaş dahil toplam işveren maliyeti. Günlük maliyet bunun 30'a bölünmesiyle bulunur.</p><div class="row2"><button class="btn grow" id="iaN">Vazgeç</button><button class="btn primary grow" id="iaK">Kaydet</button></div>`,
        () => {
          byId('iaN').onclick = closeSheet;
          byId('iaK').onclick = async () => {
            const m = sayi(byId('iaM').value);
            if (!(m > 0)) {
              toast('Tutarı kontrol edin.');
              return;
            }
            try {
              await setDoc(doc(db, 'iscilik', ak), { ay: ak, ayar: { aylik: m } }, { merge: true });
              closeSheet();
              toast('Kaydedildi. Rakamlara yansıması için yeniden hesaplayın.');
            } catch (e) {
              yazmaHatasi(e);
            }
          };
        }
      );
    };
  document.querySelectorAll('[data-isd]').forEach(b => (b.onclick = () => iscSube(ak, b.dataset.isd)));
}
// Şube penceresi: ciro ve lojman girişi + kişi kişi döküm.
export function iscSube(ak, sid) {
  const D = S.iscDoc || {};
  const x = (D.hesap || {})[sid];
  const g = (D.subeler || {})[sid] || {};
  const c = sayi(g.ciro),
    lj = iscLoj(D, ak, sid),
    sab = iscLojSabitMi(D, ak, sid);
  const top = x ? r2(x.toplam + lj) : null;
  const L = S.subeIds,
    sn = L[L.indexOf(sid) + 1] || null;
  let dok = '';
  if (x) {
    const grup = k => x.kisi.filter(y => y.grup === k);
    const satir = y =>
      `<tr><td class="l">${esc(adBuyuk(y.ad))}</td><td>${y.gun || '—'}</td><td>${tl0(y.resmi + y.banka)}${y.gun ? ` <small>(${y.gun} gün)</small>` : ''}</td><td>${tl0(y.elden)}</td><td>${tl0(sayi(y.paket))}</td><td><b>${tl0(y.toplam)}</b></td></tr>`;
    const bolum = GRUP_SIRA.filter(k => grup(k).length)
      .map(
        k =>
          `<tr><td class="l" colspan="5"><b>${GRUP[k]}</b> · ${grup(k).length} kişi</td><td><b>${tl0(x.gruplar[k] || 0)}</b></td></tr>` +
          grup(k).map(satir).join('')
      )
      .join('');
    dok = `${x.fv !== 2 ? '<div class="banner bad">Bu ay eski yöntemle hesaplanmış. İşçilik ekranında Yeniden hesapla\'ya basın.</div>' : ''}${x.ozetHata ? '<div class="banner bad">Diğer şubelerin özetleri okunamadı; rakamlar eksik olabilir. Yeniden hesaplayın.</div>' : ''}
   <div class="tk-wrap" style="overflow-x:auto"><table class="tk"><thead><tr><th class="l">Kişi</th><th>SGK gün</th><th>Resmi</th><th>Elden</th><th>Paket primi</th><th>Toplam</th></tr></thead><tbody>${bolum}</tbody>
   <tfoot><tr><td class="l">Lojman</td><td></td><td></td><td></td><td></td><td>${tl0(lj)}</td></tr><tr><td class="l"><b>Toplam işçilik</b></td><td></td><td>${tl0(x.resmi + x.banka)}${x.gunTop ? ` <small>(${x.gunTop} gün)</small>` : ''}</td><td>${tl0(x.elden)}</td><td>${tl0(sayi(x.paket))}</td><td><b>${tl0(top)}</b></td></tr></tfoot></table></div>
   <p class="note">Oran <b>${iscYuzde(iscOran(top, c))}</b>. Resmi: SGK günü × günlük resmi maliyet (bankaya yatan dahil); SGK'sız ve esnaf kuryede bankaya yatan. Elden: maaş farkı, fazla mesai, ciro primi, ek ödeme − kesinti. Paket primi ödemeler listesinden gelir.</p>`;
  } else dok = `<p class="note">Bu ay henüz hesaplanmadı. İşçilik ekranında Hesapla'ya basın.</p>`;
  openSheet(
    `<h2>${esc(subeAdi(sid))} · İşçilik</h2><div class="sub">${ayAdi(ak)}${x ? ' · ' + (x.durum === 'kesin' ? 'kesin' : x.durum === 'onayli' ? 'onaylı' : 'tahmini') + ' · ' + x.kisiSay + ' kişi' : ''}</div>
   ${
     isIsveren()
       ? `   <div class="fgrid"><label class="field"><span>Ciro (KDV dahil, ₺)</span><input id="icC" inputmode="decimal" value="${c ? esc(tl(c)) : ''}" placeholder="0"></label><label class="field"><span>Lojman (₺)</span><input id="icL" inputmode="decimal" value="${lj ? esc(tl(lj)) : ''}" placeholder="Yok"></label></div>
   <label class="check" style="margin:2px 0 8px"><input type="checkbox" id="icS" ${sab ? 'checked' : ''}> Lojman her ay aynı (bu aydan itibaren)</label>
   <p class="note" style="margin-top:0">Her ay aynı işaretliyse tutar sonraki aylara da geçer; değişirse yeni tutarı o ay işaretli kaydedin. Lojmanı kaldırmak için işaretli bırakıp boş kaydedin.</p>
   <div class="row2"><button class="btn grow" id="icK">Kaydet</button>${sn ? `<button class="btn primary grow" id="icN">Kaydet, sonraki şube ›</button>` : ''}</div>`
       : `<p class="note">Ciro ${c ? tl0(c) : 'girilmedi'} · Lojman ${lj ? tl0(lj) : 'yok'} (işveren girer)</p>`
   }
   ${dok}<div class="row2"><button class="btn grow" id="iDK">Kapat</button></div>`,
    () => {
      byId('iDK').onclick = closeSheet;
      const kaydet = async () => {
        const cv = byId('icC').value.trim() ? sayi(byId('icC').value) : 0;
        const lv = byId('icL').value.trim() ? sayi(byId('icL').value) : 0;
        const sb = byId('icS').checked;
        if (!(cv >= 0) || !(lv >= 0)) {
          toast('Geçersiz tutar.');
          return false;
        }
        try {
          const yaz = { ciro: cv };
          if (sb) {
            yaz.lojman = deleteField();
            if (iscLojSabitMi(D, ak, sid) ? iscSabitLoj(sid, ak) !== lv : true)
              await setDoc(doc(db, 'iscilik', 'sabit'), { lojman: { [sid]: { [ak]: lv } } }, { merge: true });
          } else yaz.lojman = lv;
          await setDoc(doc(db, 'iscilik', ak), { ay: ak, subeler: { [sid]: yaz } }, { merge: true });
          return true;
        } catch (e) {
          yazmaHatasi(e);
          return false;
        }
      };
      const kb = byId('icK');
      if (kb)
        kb.onclick = async () => {
          if (await kaydet()) {
            toast('Kaydedildi.');
            closeSheet();
          }
        };
      const nb = byId('icN');
      if (nb)
        nb.onclick = async () => {
          if (await kaydet()) {
            toast('Kaydedildi.');
            iscSube(ak, sn);
          }
        };
    }
  );
}
