// iscilik-hesap.js — app.js (v180) satırları 2516-2569. Otomatik bölündü; davranış değişmedi.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { subeAdi, veriGunHesap } from './sabitler.js';
import { db, setDoc } from './firebase.js';
import { S, subs } from './durum.js';
import { ayKaydir, ayKey, sayi, today } from './yardimci.js';
import { isIsveren } from './rol.js';
import { odemeSubesi } from './gecmis.js';
import { gunHataVar, gunleriYukle } from './cok-sube.js';
import { ayKadrosu } from './kadro.js';
import { yazmaHatasi } from './yazma.js';
import { sunucuHazir } from './hucre-yazma.js';
import { selectSube } from './subeler.js';
import { render } from './cerceve.js';
import { toast } from './panel.js';
import { benAd } from './hafta-kapatma.js';
import { puantajAc } from './puantaj.js';
import { jsSirali, ptVerisi, veriGunYaz } from './puantaj-veri.js';
import { veriListesi } from './veri-kayit.js';

/* ================= İşçilik (sadece işveren): şube başına aylık işçilik maliyeti ve ciroya oranı =================
   Kişi maliyeti = resmi maliyet + elden ödenen + paket primi.
   Resmi maliyet: SGK'lı gün × (asgari brüt × (1 + işveren SGK payı + işsizlik)) ÷ 30. Bankaya yatan net maaş bunun içindedir (1 ya da 5 günlük SGK'lı kurye dahil).
   Elden ödenen: maaş farkı + fazla mesai + ciro primi + ek ödeme − kesinti (avans ve ara ödemeler bunun ödenmiş kısmıdır, ayrıca eklenmez;
   geçen aydan gelen eksi devir bu ayın maliyeti değildir). SGK'sı olmayan / esnaf kuryede bankaya yatan da Resmi sütununa eklenir.
   Paket primi: ödemeler listesindeki tutar, ayrı kalem; bankaya yatan primden düşülmez.
   Maaş, SGK ve fazla mesai kişinin maaşının ödendiği şubeye yazılır. Lojman şube başına elle girilir. Ciro KDV dahil girilir.
   Hesap her şubenin puantajından (onaylı ayda kilitli rakamlar, kesin ayda saklanan rakamlar, açık ayda tahmini) yapılır ve iscilik/{ay} belgesine saklanır. */
export const ISC_VARS = { aylik: 40874.63 }; // 30 günlük SGK'lı çalışanın aylık işveren maliyeti (bankaya yatan net maaş dahil)
// Eski kayıtlar asgari/SGK/işsizlik ile saklanmış olabilir; onlar eski formülle okunur.
export const iscAyar = D => {
  const a = { ...((D && D.ayar) || {}) };
  if (a.aylik == null && a.asgari == null) a.aylik = ISC_VARS.aylik;
  return a;
};
export const iscGunluk = a =>
  (a.aylik != null && sayi(a.aylik) > 0
    ? sayi(a.aylik)
    : sayi(a.asgari) * (1 + sayi(a.sgk) / 100 + sayi(a.issizlik) / 100)) / 30;
export const r2 = x => Math.round((x || 0) * 100) / 100;
export function iscAyi() {
  if (S.iscAy) return S.iscAy;
  const bu = ayKey(today());
  return today().getDate() <= 15 ? ayKaydir(bu, -1) : bu;
}
export function iscKisi(x, ayar) {
  const sol = x.sol || {},
    h = x.hes || {};
  const esnaf = sol.sekil === 'Esnaf kurye' || h.esnaf;
  const maasB = sol.maasBurada !== false;
  const burada = esnaf || h.pb ? true : maasB; // paket başı kurye de esnaf gibi: maliyet paket attığı şubede kalır (SGK günü yine maaş/SGK şubesinde). Esnaf kuryenin maliyeti çalıştığı (verisinin girildiği) şubede kalır, maaş şubesine taşınmaz
  const gun = maasB && !esnaf && !sol.sgkYok ? sayi(sol.iscGun != null ? sol.iscGun : sol.gun) : 0;
  /* SGK şubesi değişen kişide iki kaydın günleri (en çok 30) */ const resmi = r2(gun * iscGunluk(ayar));
  // Paket primi ayrı kalemdir (ödemeler listesindeki tutar olduğu gibi); bankaya yatan primden düşülmez, kuryenin sigortası da diğerleri gibi Resmi'ye girer.
  let elden = r2(sayi(h.maasFarki) + sayi(h.fmTl) + sayi(h.ciroPrimi) + sayi(h.ekOd));
  let paket = r2(sayi(h.paketPrimi));
  let banka =
    burada && resmi <= 0 && !h.pb
      ? r2(sayi(h.bankaya))
      : 0; /* paket başında bankaya yatan paket primini ödemektir, ayrı maliyet değil */
  // Esnaf kurye ayrı bir şirkettir: SGK / maaş yok, her şubede o şubede attığı paketin bedeli (paket sayısı × ücret + girilen paket primi) o şubenin paket primidir.
  if (esnaf) {
    paket = r2(sayi(h.paketHak) + sayi(h.paketPrimi));
    elden = r2(
      sayi(h.maasFarki) + sayi(h.bankaya) - sayi(h.paketHak) + sayi(h.fmTl) + sayi(h.ciroPrimi) + sayi(h.ekOd)
    );
    banka = 0;
  }
  return {
    pid: x.pid,
    ad: sol.ad || '',
    grup: sol.grup || 'K',
    gun,
    resmi,
    banka,
    elden,
    paket,
    toplam: r2(resmi + banka + elden + paket),
    burada,
  };
}
export const iscBekle = ms => new Promise(r => setTimeout(r, ms));
export async function iscilikHesapla(ak) {
  if (!isIsveren() || S.iscCalisiyor) return;
  S.iscCalisiyor = true;
  const D0 = S.iscDoc || {};
  const ayar = iscAyar(D0);
  const eskiSube = S.subeId,
    eskiAy = S.ay,
    eskiAyElle = S.ayElle;
  const sonuc = {},
    hata = [],
    tasi = [];
  const L = S.subeIds.slice();
  try {
    // Önce her şubenin veri girişindeki rapor / izin / part gün ay özetine yazılır: bir şubede girilen gün diğer şubenin hesabına da girer.
    try {
      S.iscDurum = 'Veri girişleri okunuyor';
      render();
      const q = await getDocs(query(collection(db, 'ozetler'), where('ay', '==', ak)));
      const kay = {};
      q.docs.forEach(d => {
        const x = d.data();
        if (x.sube) kay[x.sube] = x.veriGun || {};
      });
      for (const sid of L) {
        const s = await getDoc(doc(db, 'puantaj', sid, 'aylar', ak));
        const d = s.exists() ? s.data() : null;
        const vg = d ? veriGunHesap(veriListesi(d), ak, d) : {};
        if (jsSirali(vg) !== jsSirali(kay[sid] || {})) await veriGunYaz(sid, ak, vg);
      }
    } catch (e) {
      console.error(e);
      hata.push('veri girişi özetleri');
    }
    for (let i = 0; i < L.length; i++) {
      const sid = L[i];
      S.iscDurum = `Hesaplanıyor ${i + 1} / ${L.length}: ${subeAdi(sid)}`;
      render();
      S.ay = ak;
      puantajAc(sid);
      const t0 = Date.now();
      let hazir = false;
      while (Date.now() - t0 < 30000) {
        if (
          S.pt.sube === sid &&
          S.ay === ak &&
          S.pt.doc &&
          S.pt.maas !== null &&
          S.pt.prev !== null &&
          S.pt.ozetler !== null &&
          sunucuHazir(sid)
        ) {
          hazir = true;
          break;
        }
        await iscBekle(150);
      }
      if (!hazir) {
        hata.push(subeAdi(sid));
        continue;
      }
      try {
        await gunleriYukle(ayKadrosu(ak), [ayKaydir(ak, -1), ak, ayKaydir(ak, 1)]);
      } catch (e) {}
      if (S.pt.sube !== sid || S.ay !== ak) {
        hata.push(subeAdi(sid));
        continue;
      }
      const V = ptVerisi();
      const durum = V.kesin ? 'kesin' : V.kilitli ? 'onayli' : 'tahmini';
      const kisi = [];
      V.satir.forEach(x => {
        const k = iscKisi(x, ayar);
        if (!k.toplam && !k.gun) return;
        if (!k.burada) {
          const p = S.personel.find(q => q.id === x.pid);
          const hedef = (x.sol && x.sol.odemeSid) || (p ? odemeSubesi(p, ak) : '');
          if (hedef && hedef !== sid && L.includes(hedef)) {
            // Paket primi girildiği şubede kalır; fazla mesai ve diğer kalemler maaşın ödendiği şubeye taşınır.
            const paket = k.paket || 0;
            if (paket)
              kisi.push({
                ...k,
                resmi: 0,
                banka: 0,
                elden: 0,
                gun: 0,
                paket,
                toplam: paket,
                burada: true,
                ad: k.ad + ' · paket',
              });
            const tk = { ...k, paket: 0, toplam: r2(k.toplam - paket), hedef, kaynak: sid };
            if (Math.abs(tk.toplam) > 0.004 || tk.gun) tasi.push(tk);
            return;
          }
        }
        kisi.push(k);
      });
      sonuc[sid] = { durum, kisi, ozetHata: !!S.pt.ozetHata || gunHataVar() };
    }
    // Başka şubede yapılan fazla mesai: kişinin maaş şubesine
    tasi.forEach(k => {
      const h = sonuc[k.hedef];
      if (!h) return;
      h.kisi.push({ ...k, ad: k.ad + ' · ' + subeAdi(k.kaynak) + ' FM', burada: true });
    });
    const t = new Date().toISOString();
    const hesap = {};
    Object.entries(sonuc).forEach(([sid, x]) => {
      const top = k => r2(x.kisi.reduce((a, y) => a + (y[k] || 0), 0));
      const gr = {};
      x.kisi.forEach(y => {
        gr[y.grup] = r2((gr[y.grup] || 0) + y.toplam);
      });
      hesap[sid] = {
        fv: 2,
        durum: x.durum,
        ozetHata: x.ozetHata,
        resmi: top('resmi'),
        gunTop: top('gun'),
        banka: top('banka'),
        elden: top('elden'),
        paket: top('paket'),
        toplam: top('toplam'),
        kisiSay: x.kisi.filter(y => !/ (FM|paket)$/.test(y.ad)).length,
        gruplar: gr,
        kisi: x.kisi.map(y => ({
          ad: y.ad,
          grup: y.grup,
          gun: y.gun,
          resmi: y.resmi,
          banka: y.banka,
          elden: y.elden,
          paket: y.paket || 0,
          toplam: y.toplam,
        })),
        tarih: t,
      };
    });
    await setDoc(
      doc(db, 'iscilik', ak),
      { ay: ak, ayar, hesap, hesapTarihi: t, hesaplayan: benAd() },
      { merge: true }
    );
    toast(
      hata.length
        ? `Hesaplandı; ${hata.length} şube yüklenemedi: ${hata.join(', ')}. Tekrar deneyin.`
        : 'İşçilik hesaplandı.'
    );
  } catch (e) {
    console.error(e);
    yazmaHatasi(e);
  } finally {
    subs.detay.forEach(u => u());
    subs.detay = [];
    S.pt.sube = null;
    S.pt.doc = null;
    S.ay = eskiAy;
    S.ayElle = eskiAyElle;
    if (eskiSube && S.subeId !== eskiSube) selectSube(eskiSube);
    S.iscCalisiyor = false;
    S.iscDurum = '';
    render();
  }
}
