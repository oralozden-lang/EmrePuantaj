// iban-listesi.js — app.js (v180) satırları 1102-1131, 2665-2667. Otomatik bölündü; davranış değişmedi.
import {
  collection,
  getDocs,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { SGK_YOK, gorevTahmin, subeAdi } from './sabitler.js';
import { db } from './firebase.js';
import { S } from './durum.js';
import { ayAdi, ayKaydir, ayKey, esc, sayi, today, trTarih } from './yardimci.js';
import { puantajYetki } from './rol.js';
import { sgkli } from './hesap.js';
import { sgkGunSayisi } from './hesap-ay.js';
import { maasSubesi } from './gecmis.js';
import { byId, render, view } from './cerceve.js';
import { toast } from './panel.js';
import { ibanDegisim, tcOf, tcYukle } from './bilgi-dogrulama.js';
import { adBuyuk, xlsxLib } from './isim-esle.js';

/* İşverene IBAN listesi: seçilen ayda SGK girişi olanlar + IBAN'ı o ay değişenler. Tüm şubeler tek listede; IBAN bitişik yazılır. Sadece bölge müdürü ve işveren. */
export function ibanAyi() {
  const bu = ayKey(today());
  return S.ibanAy || (today().getDate() <= 15 ? ayKaydir(bu, -1) : bu);
}
// O ay ücretsiz izinle SGK günü 0'a düşen kişi (ör. 30 gün ücretsiz izin): bankaya maaş yatmaz, IBAN istenmez.
// Gün sayıları şubelerin ay özetlerinden (çizelge + veri girişi) okunur; özet yüklenene kadar kişi listede kalır.
export function ibanOzetYukle(ak) {
  S.ibanOzet = S.ibanOzet || {};
  if (S.ibanOzet[ak]) return;
  S.ibanOzet[ak] = { yuk: true };
  getDocs(query(collection(db, 'ozetler'), where('ay', '==', ak)))
    .then(q => {
      const ui = {};
      const ekle = (pid, n) => {
        ui[pid] = (ui[pid] || 0) + n;
      };
      q.docs.forEach(d => {
        const x = d.data() || {};
        Object.entries(x.kisiler || {}).forEach(([pid, k]) => {
          if (k && k.UI) ekle(pid, sayi(k.UI));
        });
        Object.entries(x.veriGun || {}).forEach(([pid, k]) => {
          Object.values((k && k.g) || {}).forEach(t => {
            if (t && t.UI) ekle(pid, sayi(t.UI));
          });
        });
      });
      S.ibanOzet[ak] = { ui };
      if (S.tab === 'personel') render();
    })
    .catch(e => {
      console.error(e);
      S.ibanOzet[ak] = { ui: {}, hata: true };
    });
}
export function ibanSgkGunuYok(p, ak) {
  const o = S.ibanOzet && S.ibanOzet[ak];
  if (!o || !o.ui) return false;
  const n = o.ui[p.id] || 0;
  if (!n) return false;
  const [y, m] = ak.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  let ist = 0;
  for (let d = 1; d <= last; d++) if (sgkli(p, new Date(y, m - 1, d))) ist++;
  return ist > 0 && sgkGunSayisi(ist, last, n) === 0;
}
export function ibanListe(ak) {
  ibanOzetYukle(ak);
  const g = [],
    u = [],
    n = [];
  S.personel.forEach(p => {
    if (p.giris && p.giris.slice(0, 7) === ak && p.sgkSube !== SGK_YOK) {
      (ibanSgkGunuYok(p, ak) ? n : g).push(p);
    } else if (p.iban && ibanDegisim(p).slice(0, 7) === ak) u.push(p);
  });
  const o = (a, b) =>
    String(subeAdi(maasSubesi(a))).localeCompare(String(subeAdi(maasSubesi(b))), 'tr') ||
    String(a.ad).localeCompare(String(b.ad), 'tr');
  return { g: g.sort(o), u: u.sort(o), n: n.sort(o) };
}
export function ibanMetin(ak) {
  const L = ibanListe(ak);
  const s = p => `${adBuyuk(p.ad)} | ${tcOf(p) || 'TC yok'} | ${p.iban || 'IBAN yok'}`;
  let t = `${ayAdi(ak)} · yeni girenler (${L.g.length})\n` + L.g.map(s).join('\n');
  if (L.u.length) t += `\n\nIBAN'ı güncellenenler (${L.u.length})\n` + L.u.map(s).join('\n');
  return t;
}
export async function panoyaYaz(t) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch (e) {
    try {
      const a = document.createElement('textarea');
      a.value = t;
      a.style.position = 'fixed';
      a.style.opacity = '0';
      document.body.appendChild(a);
      a.select();
      const ok = document.execCommand('copy');
      a.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }
}
export async function ibanExcel(ak) {
  const L = ibanListe(ak);
  let X;
  try {
    X = await xlsxLib();
  } catch (e) {
    toast('Excel kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edin.');
    return;
  }
  const sat = (p, d) => [
    adBuyuk(p.ad),
    tcOf(p) || '',
    p.iban || '',
    subeAdi(maasSubesi(p)),
    d,
    trTarih(p.giris),
  ];
  const ws = X.utils.aoa_to_sheet([
    ['Ad soyad', 'TC kimlik no', 'IBAN', 'Şube', 'Durum', 'SGK giriş'],
    ...L.g.map(p => sat(p, 'Yeni giriş')),
    ...L.u.map(p => sat(p, 'IBAN güncellendi')),
  ]);
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'IBAN');
  X.writeFile(wb, `IBAN-${ak}.xlsx`);
}
export function ibanKutusu() {
  if (!puantajYetki()) return '';
  const bu = ayKey(today());
  const ak = ibanAyi();
  const acik = true;
  const L = ibanListe(ak);
  const hepsi = [...L.g, ...L.u];
  const eks = hepsi.filter(p => !p.iban).length;
  let h = `<div class="ibk"><div class="ibk-h" id="ibanBas"><b>İşverene IBAN listesi</b><span class="n">${hepsi.length}</span>${eks ? `<span class="chip bad">${eks} IBAN eksik</span>` : ''}</div>`;
  if (acik) {
    tcYukle(hepsi);
    const aylar = [...new Set([ak, ...[0, 1, 2, 3, 4, 5].map(i => ayKaydir(bu, -i))])].sort().reverse();
    const satir = (p, gun, guncel) => {
      const ib = p.iban || '';
      const tc = tcOf(p);
      return `<div class="ibr ${ib ? '' : 'eks'}"><div class="n"><b>${esc(adBuyuk(p.ad))}</b><i>${esc(gorevTahmin(p) || '')} · ${esc(subeAdi(maasSubesi(p)))} · ${gun}</i></div><div class="v"><span class="mono">${ib ? esc(ib) : 'IBAN girilmemiş'}</span><span>TC ${tc ? esc(tc) : '—'}${guncel && p.ibanEski ? ' · eski: ' + esc(p.ibanEski) : ''}</span></div></div>`;
    };
    h += `<div class="ibk-t"><label>Ay <select id="ibanAy">${aylar.map(a => `<option value="${a}" ${a === ak ? 'selected' : ''}>${ayAdi(a)}</option>`).join('')}</select></label><span>Tüm şubeler tek listede</span></div>
     <div class="ibk-s"><span>Yeni girenler · ${L.g.length}</span><span>SGK girişi bu ay</span></div>${L.g.length ? L.g.map(p => satir(p, 'giriş ' + trTarih(p.giris), false)).join('') : L.n.length ? '' : '<div class="ibr"><div class="n"><i>Bu ay SGK girişi olan yok.</i></div></div>'}
     ${L.n.map(p => `<div class="ibr"><div class="n"><b>${esc(adBuyuk(p.ad))}</b><i>${esc(gorevTahmin(p) || '')} · ${esc(subeAdi(maasSubesi(p)))} · giriş ${trTarih(p.giris)}</i></div><div class="v"><span class="chip">SGK günü 0 · IBAN gerekmiyor</span></div></div>`).join('')}
     <div class="ibk-s"><span>IBAN'ı güncellenenler · ${L.u.length}</span><span>Bu ay değişen</span></div>${L.u.length ? L.u.map(p => satir(p, 'değişiklik ' + trTarih(ibanDegisim(p)), true)).join('') : '<div class="ibr"><div class="n"><i>Bu ay IBAN değişikliği yok.</i></div></div>'}
     <div class="ibk-f"><button class="btn primary grow" id="ibanKop">WhatsApp için kopyala</button><button class="btn grow" id="ibanXls">Excel indir</button></div>`;
  }
  return h + '</div>';
}
export function ibanBagla() {
  const ibA = byId('ibanAy');
  if (ibA)
    ibA.onchange = () => {
      S.ibanAy = ibA.value;
      render();
    };
  const ibK = byId('ibanKop');
  if (ibK)
    ibK.onclick = async () => {
      toast(
        (await panoyaYaz(ibanMetin(ibanAyi())))
          ? "Liste kopyalandı. WhatsApp'a yapıştırabilirsiniz."
          : 'Kopyalanamadı.'
      );
    };
  const ibX = byId('ibanXls');
  if (ibX) ibX.onclick = () => ibanExcel(ibanAyi());
}
// Yönetim → IBAN: işverene IBAN listesi (eskiden Personel ekranının üstündeydi).
export function renderIbanBolum(h) {
  h += ibanKutusu();
  view(h, () => {
    document.querySelectorAll('#ySeg button').forEach(
      b =>
        (b.onclick = () => {
          S.ynt = b.dataset.v;
          render();
        })
    );
    ibanBagla();
  });
}
