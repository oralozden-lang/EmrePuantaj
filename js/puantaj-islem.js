// puantaj-islem.js — app.js (v180) satırları 1903-1962. Otomatik bölündü; davranış değişmedi.
import { arrayUnion, doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ozBirlestir, veriOzet, veriTur } from './sabitler.js';
import { KAYIT, arka, db, setDoc, writeBatch } from './firebase.js';
import { S, subs } from './durum.js';
import { ayAdi, ayKaydir, esc, fmt, isimAnahtar, kisaAd, sayi, today, trTarih, ymd } from './yardimci.js';
import { isIsveren } from './rol.js';
import { AYAR_ALANLARI, sube } from './hesap.js';
import { gunleriYukle } from './cok-sube.js';
import { ayKadrosu } from './kadro.js';
import { subeOzeti } from './ay-ozet.js';
import { otoKapi, sagHesap } from './puantaj-hesap.js';
import { sirayla, yazmaHatasi } from './yazma.js';
import { kilitEngel, kilitliMi, ptK } from './kilit.js';
import { sunucuHazir } from './hucre-yazma.js';
import { byId, render } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { benAd } from './hafta-kapatma.js';
import { ayHaftaDurumu } from './hafta-islem.js';
import { kesinEngel, netMap, ptSol, ptVerisi, usOf } from './puantaj-veri.js';
import { veriKisileri } from './veri-girisi.js';
import { VBEK, kalanYama, sagYama, satirTemiz, veriYaz, yeniSira } from './veri-kayit.js';
import { veriBosTemizle } from './veri-girisi-bagla.js';
import { adBuyuk } from './isim-esle.js';

export function listeyeDon() {
  veriBosTemizle();
  S.pt.sube = null;
  subs.detay.forEach(u => u());
  subs.detay = [];
  render();
}
export function sagSonuclu(V, degisen) {
  const sag = JSON.parse(JSON.stringify((V.D && V.D.sag) || {}));
  if (degisen) Object.entries(degisen).forEach(([pid, v]) => (sag[pid] = { ...(sag[pid] || {}), ...v }));
  const prevSag = (S.pt.prev && S.pt.prev.sag) || {};
  const net = netMap(V.ak);
  const ozB = ozBirlestir(veriOzet(V.D && V.D.veri), V.sol);
  Object.keys(V.sol).forEach(pid => {
    const dv = prevSag[pid] && prevSag[pid].kalan < 0 ? prevSag[pid].kalan : 0;
    const r = sagHesap(
      pid,
      V.sol[pid],
      sag[pid],
      net[pid],
      V.sb,
      dv,
      ozB[pid],
      usOf(pid),
      otoKapi(V.ak, V.kilitli, V.kesin)
    );
    sag[pid] = { ...(sag[pid] || {}), kalan: Math.round(r.kalan * 100) / 100 };
  });
  return sag;
}
export async function onayla() {
  const ak = S.ay,
    sid = S.subeId;
  const ayni = () =>
    S.subeId === sid &&
    S.ay === ak &&
    S.pt.sube === sid &&
    !!S.pt.doc &&
    S.pt.ozetler !== null &&
    S.pt.prev !== null &&
    !S.pt.ozetHata &&
    sunucuHazir(sid);
  if (!ayni()) {
    toast('Puantaj tam yüklenmeden onaylanamaz. Biraz bekleyip tekrar deneyin.');
    return;
  }
  if (await kilitliMi(ptK(sid, ak))) return;
  await gunleriYukle(ayKadrosu(ak), [ayKaydir(ak, -1), ak, ayKaydir(ak, 1)]);
  if (!ayni()) {
    toast('Onay sırasında ekran (şube ya da ay) değişti, onay yapılmadı. Tekrar deneyin.');
    return;
  }
  const V = ptVerisi();
  {
    const bek = V.satir.filter(x => x.hes.otoBekle);
    if (bek.length) {
      toast(
        `${bek.length} kişinin çizelgeden gelen mesaisi onay bekliyor (${bek
          .slice(0, 3)
          .map(x => kisaAd(x.sol.ad))
          .join(
            ', '
          )}${bek.length > 3 ? '…' : ''}). Veri girişi → "Çizelgeden gelenler" listesinden onaylayın.`
      );
      return;
    }
  }
  const sol = ptSol(ak, V.D || {});
  const b = writeBatch(db);
  const V2 = { ...V, sol };
  b.set(
    doc(db, 'puantaj', sid, 'aylar', ak),
    {
      sube: sid,
      ay: ak,
      sol,
      sag: sagYama(sagSonuclu(V2), []),
      kilitli: true,
      onaylayan: S.user.uid,
      onaylayanAd: S.me.adSoyad || '',
      onayTarihi: new Date().toISOString(),
      guncellendi: new Date().toISOString(),
    },
    { merge: true }
  );
  b.set(
    doc(db, 'subeler', sid, 'aylar', ak),
    { durum: 'bolge_onay', onaylayan: S.user.uid, onayTarihi: new Date().toISOString() },
    { merge: true }
  );
  b.set(
    doc(db, 'ozetler', ak + '__' + sid),
    { sube: sid, ay: ak, kisiler: subeOzeti(ak, sid), guncellendi: new Date().toISOString() },
    { mergeFields: ['sube', 'ay', 'kisiler', 'guncellendi'] }
  );
  b.commit()
    .then(() => toast(`${sube().ad} · ${ayAdi(ak)} onaylandı.`))
    .catch(yazmaHatasi);
}
// İşverenin kesin kapanışı: ekranda görünen bütün sonuçlar (muhasebe + ödemeler) saklanır; ay ve haftaları kurallarla kilitlenir.
export async function kesinKapat() {
  const ak = S.ay,
    sid = S.subeId;
  const ayni = () =>
    isIsveren() &&
    S.subeId === sid &&
    S.ay === ak &&
    S.pt.sube === sid &&
    !!S.pt.doc &&
    S.pt.doc.kilitli === true &&
    S.pt.doc.kesin !== true &&
    S.pt.prev !== null &&
    sunucuHazir(sid);
  if (!ayni()) {
    toast('Puantaj tam yüklenmeden kesin kapatılamaz.');
    return;
  }
  // Kesin kapanan aya değen haftalar bir daha düzenlenemez: açık / onaysız hafta kalırsa sonraki ayın günleri de donar.
  if (!ayHaftaDurumu(ak).tamam) {
    toast('Ayın bütün haftaları onaylanmadan kesin kapatılamaz.');
    return;
  }
  if (KAYIT.n || navigator.onLine === false || (VBEK[sid + '|' + ak] || []).length) {
    toast(
      'Gönderilmeyi bekleyen kayıt var. İnternet bağlantısını kontrol edip birkaç saniye sonra tekrar deneyin.'
    );
    return;
  }
  if (await kilitliMi(ptK(sid, ak))) return;
  if (!ayni()) {
    toast('Ekran değişti, işlem yapılmadı.');
    return;
  }
  const V = ptVerisi();
  const sag = sagSonuclu(V);
  const t = new Date().toISOString();
  const ad = benAd();
  const satir = V.satir.map(x => ({ pid: x.pid, sol: x.sol, sag: x.sag, net: x.net ?? null, hes: x.hes }));
  const ayar = Object.fromEntries(AYAR_ALANLARI.map(k => [k, V.sb[k] ?? null]));
  const b = writeBatch(db);
  b.set(
    doc(db, 'puantaj', sid, 'aylar', ak),
    {
      kesin: true,
      kesinSonuc: satirTemiz({ satir, oz: V.oz, sb: ayar }),
      sag: sagYama(sag, []),
      kesinTarihi: t,
      kesinAd: ad,
      kesinKayit: arrayUnion({ t, ad, i: 'kesin kapattı' }),
      guncellendi: t,
    },
    { merge: true }
  );
  b.set(
    doc(db, 'subeler', sid, 'aylar', ak),
    { durum: 'kesin', kesinTarihi: t, kesinAd: ad },
    { merge: true }
  );
  b.commit()
    .then(() => toast(`${ayAdi(ak)} kesin kapandı.`))
    .catch(yazmaHatasi);
}
export async function kesinAc() {
  const ak = S.ay,
    sid = S.subeId;
  if (!isIsveren()) return;
  if ((S.aylar[ayKaydir(ak, 1)] || {}).durum === 'kesin') {
    toast('Sonraki ay kesin kapalı, bu ay açılamaz.');
    return;
  }
  const t = new Date().toISOString();
  const ad = benAd();
  const b = writeBatch(db);
  b.set(
    doc(db, 'puantaj', sid, 'aylar', ak),
    { kesin: false, kesinKayit: arrayUnion({ t, ad, i: 'kesin kapanışı açtı' }), guncellendi: t },
    { merge: true }
  );
  b.set(doc(db, 'subeler', sid, 'aylar', ak), { durum: 'bolge_onay' }, { merge: true });
  b.commit()
    .then(() => toast('Kesin kapanış açıldı; ay bölge onaylı duruma döndü.'))
    .catch(yazmaHatasi);
}
export async function kilidiAc() {
  const ak = S.ay,
    sid = S.subeId;
  if (await kilitliMi(ptK(sid, ak))) return;
  const b = writeBatch(db);
  b.set(
    doc(db, 'puantaj', sid, 'aylar', ak),
    { kilitli: false, guncellendi: new Date().toISOString() },
    { merge: true }
  );
  b.set(doc(db, 'subeler', sid, 'aylar', ak), { durum: 'taslak' }, { merge: true });
  b.commit()
    .then(() => toast('Kilit açıldı, ay yeniden düzenlenebilir.'))
    .catch(yazmaHatasi);
}
export function geriGonderPanel() {
  if (kilitEngel()) return;
  openSheet(
    `<h2>Şubeye geri gönder</h2><div class="sub">Şube müdürü notu görür, düzeltip ayı yeniden kapatır.</div><label class="field"><span>Not</span><textarea id="gNot" rows="3" placeholder="Örn: Ali'nin 14 Ekim raporu eksik"></textarea></label>
  <div class="row2"><button class="btn grow" id="gNo">Vazgeç</button><button class="btn danger grow" id="gOk">Geri gönder</button></div>`,
    () => {
      byId('gNo').onclick = closeSheet;
      byId('gOk').onclick = () => {
        const not = byId('gNot').value.trim();
        {
          const sid = S.subeId,
            ay = S.ay;
          sirayla('ay' + ay, () => {
            arka(
              setDoc(
                doc(db, 'subeler', sid, 'aylar', ay),
                { durum: 'geri', not, geriGonderen: S.user.uid, geriTarih: new Date().toISOString() },
                { merge: true }
              )
            );
          });
        }
        closeSheet();
        toast('Şubeye geri gönderildi.');
      };
    }
  );
}
// Muhasebe satırından gün ekleme: rapor, ücretsiz izin, yıllık izin, bayram, part gün. Yazılan sayı mevcut toplama EKLENİR;
// her biri Veri girişine ayrı satır olarak yazılır (tek kaynak veri girişi, kontroller orada).
export function gunPanel(pid) {
  if (kilitEngel() || kesinEngel()) return;
  const V = ptVerisi();
  const x = V.satir.find(s => s.pid === pid);
  if (!x) return;
  const ak = V.ak,
    sid = S.subeId;
  if (V.kilitli) {
    toast('Ay onaylı: rapor, izin ve part gün eklenemez. Düzeltme için kilidi açın.');
    return;
  }
  const T = [
    ['R', 'Rapor', 'rapor'],
    ['UI', 'Ücretsiz izin', 'ucretsiz'],
    ['YI', 'Yıllık izin', 'yillik'],
    ['B', 'Bayram', 'bayram'],
    ['PG', 'Part gün', 'partGun'],
  ];
  const kL = veriKisileri(V);
  const adP = adBuyuk((kL.find(([id]) => id === pid) || [])[1] || x.sol.ad);
  const mevcut = ((V.D && V.D.veri) || [])
    .filter(
      v =>
        ['R', 'UI', 'YI', 'B', 'PG'].includes(v.tur) &&
        (v.pid === pid || isimAnahtar(v.ad || '') === isimAnahtar(adP))
    )
    .sort((a, b) => String(a.tarih || '').localeCompare(String(b.tarih || '')));
  const sonGun = ymd(new Date(+ak.slice(0, 4), +ak.slice(5), 0));
  const bugun = ymd(today());
  const tar0 = bugun.slice(0, 7) === ak ? bugun : sonGun;
  openSheet(
    `<h2>${esc(x.sol.ad)}</h2><div class="sub">${ayAdi(ak)} · ${esc(x.sol.sekil)} · ${x.sol.gun} gün sayısı${x.sol.hakGun != null && x.sol.hakGun !== x.sol.gun ? ` · ${x.sol.hakGun} çalışılan gün` : ''}</div>
   <p class="note" style="margin-top:0">Yazdığınız gün <b>mevcut toplama eklenir</b> (ör. 2 gün rapor varken 5 yazarsanız 7 olur). Her biri Veri girişine "Muhasebe penceresinden" açıklamasıyla satır olarak yazılır.</p>
   <div class="fgrid">${T.map(([k, ad, f]) => `<label class="field"><span>${ad} <small style="color:var(--mut)">· şu an ${fmt(x.sol[f] || 0)}</small></span><input id="gp${k}" inputmode="decimal" placeholder="+ gün"></label>`).join('')}
   <label class="field"><span>Tarih</span><input id="gpT" type="date" value="${tar0}" min="${ak}-01" max="${sonGun}"></label>
   <label class="field" style="grid-column:1/-1"><span>Açıklama (isteğe bağlı)</span><input id="gpA" placeholder="ör. hastane raporu"></label></div>
   ${mevcut.length ? `<span class="lbl">Bu ay girilmiş gün kayıtları</span><div class="tbl-wrap"><table class="pt"><tbody>${mevcut.map(v => `<tr><td>${v.tarih ? trTarih(v.tarih) : ''}</td><td class="l">${esc((veriTur(v.tur) || {}).ad || v.tur)}</td><td>${fmt(sayi(v.miktar))}</td><td class="l">${esc(v.aciklama || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
   <p class="note">Rapor / izin / part gün, girildiği şubeden bağımsız olarak kişinin SGK ve maaş şubesinde sayılır. Yanlış girilen satırı Veri girişinden silin.</p>
   <div class="row2"><button class="btn grow" id="gpNo">Vazgeç</button><button class="btn primary grow" id="gpOk">Ekle</button></div>`,
    () => {
      byId('gpNo').onclick = closeSheet;
      byId('gpOk').onclick = () => {
        if (kilitEngel() || kesinEngel()) return;
        const tar = byId('gpT').value;
        if (!tar || tar.slice(0, 7) !== ak) {
          toast(`Tarih ${ayAdi(ak)} içinde olmalı.`);
          return;
        }
        const a = byId('gpA').value.trim();
        const kim = S.me.adSoyad || S.me.kullaniciAdi || '';
        const z = new Date().toISOString();
        const ek = [];
        for (const [k, ad] of T) {
          const m = sayi(byId('gp' + k).value);
          if (!m) continue;
          if (m < 0) {
            toast(`${ad}: eksi gün eklenemez, yanlış satırı Veri girişinden silin.`);
            return;
          }
          ek.push({
            id: Math.random().toString(36).slice(2, 10),
            sira: yeniSira(),
            tarih: tar,
            ad: adP,
            pid,
            tur: k,
            miktar: m,
            aciklama: (a ? a + ' · ' : '') + 'Muhasebe penceresinden',
            kim,
            zaman: z,
          });
        }
        if (!ek.length) {
          toast('Eklenecek gün girilmedi.');
          return;
        }
        if (sid !== S.pt.sube || ak !== S.ay) {
          toast('Ekran değişti, eklenmedi. Tekrar deneyin.');
          return;
        }
        const veriY = [...((S.pt.doc && S.pt.doc.veri) || []), ...ek];
        S.pt.doc = { ...S.pt.doc, veri: veriY };
        veriYaz(
          sid,
          ak,
          { deg: Object.fromEntries(ek.map(r => [r.id, r])), sil: [] },
          kalanYama(sid, ak, veriY)
        );
        closeSheet();
        S.pt.zorla = true;
        render();
        toast(
          ek.map(r => `${fmt(r.miktar)} gün ${veriTur(r.tur).ad.toLocaleLowerCase('tr-TR')}`).join(', ') +
            ' eklendi.'
        );
      };
    }
  );
}
