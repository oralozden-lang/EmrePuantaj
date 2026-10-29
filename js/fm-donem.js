// fm-donem.js — app.js (v180) satırları 261-297. Otomatik bölündü; davranış değişmedi.
import { doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { AYK, BASLANGIC_AY, KOD, subeAdi } from './sabitler.js';
import { db, setDoc } from './firebase.js';
import { S } from './durum.js';
import {
  addDays,
  ayKaydir,
  ayKey,
  esc,
  gosterAy,
  isShift,
  mondayOf,
  parse,
  shiftHours,
  ymd,
} from './yardimci.js';
import { isIsveren } from './rol.js';
import { cellOf, employed, haftaYedi, sube, subeAyari, weekHasEntry } from './hesap.js';
import { bosSayilir } from './cok-sube.js';
import { yazmaHatasi } from './yazma.js';
import { byId, render } from './cerceve.js';
import { toast } from './panel.js';

// Fazla mesai dönemi geçişi: dönem, bir önceki ayın döneminin bittiği günün ertesinden başlar.
// Haftalıktan takvim ayına geçişte (Eylül 7 Eyl – 4 Eki haftalık, Ekim takvim) 1–4 Ekim Eylül'de ödendiği için Ekim 5 Ekim'den başlar;
// takvim ayından haftalığa geçişte aradaki günler (ör. 1 Kasım pazar) yeni aya eklenir. Böylece hiçbir gün iki kez ödenmez ya da boşta kalmaz.
export function fmDonemTemel(ak, sb) {
  if (sb.fmDonem === 'hafta') {
    const L = fmHaftalari(ak);
    return { bas: L[0], son: ymd(addDays(parse(L[L.length - 1]), 6)) };
  }
  const [y, m] = ak.split('-').map(Number);
  return { bas: ymd(new Date(y, m - 1, 1)), son: ymd(new Date(y, m, 0)) };
}
export function fmDonemAraligi(ak, sid = S.subeId, sb = subeAyari(sid, ak)) {
  const t = fmDonemTemel(ak, sb);
  const once = ayKaydir(ak, -1);
  if (once < BASLANGIC_AY) return t;
  const po = fmDonemTemel(once, subeAyari(sid, once));
  return { bas: ymd(addDays(parse(po.son), 1)), son: t.son };
}
// Haftalık dönemde, dönemin ilk haftasından önceki geçiş günleri (takvim ayından haftalığa geçişte): günlük fazla mesai + o haftanın pazarı aralıktaysa 7 gün farkı.
export function fmGecisGunleri(p, ak, sb, H = S.haftalar) {
  const r = fmDonemAraligi(ak, S.subeId, sb);
  const ilk = fmHaftalari(ak)[0];
  let fm = 0,
    h = 0;
  for (let d = parse(r.bas); ymd(d) < ilk; d = addDays(d, 1)) {
    if (!employed(p, d)) continue;
    const wid = mondayOf(d);
    const i = (d.getDay() + 6) % 7;
    const v = cellOf(p.id, wid, i, H);
    const kayit = weekHasEntry(p.id, wid, H);
    if (isShift(v)) {
      const x = shiftHours(v);
      h += x;
      fm += x - sb.gunluk;
    } else if (!(v && KOD[v]) && kayit && bosSayilir(p, d)) fm -= sb.gunluk;
    if (i === 6 && kayit) {
      const yy = haftaYedi(p, wid, H);
      if (yy.yedi && yy.sube === S.subeId) fm += 7 * sb.gunluk - sb.haftalik;
    }
  }
  return { fm, h };
}
// Haftalık dönem: varsayılan = pazartesisi o ayda olan haftalar. Şube ayarında fmSon {"2026-08":"2026-08-30"} (dönemin son günü, pazar) ile
// ay 1 hafta kısa/uzun seçilebilir; sonraki ay bir önceki ayın bittiği günün ertesinden başlar (hiçbir hafta iki kez sayılmaz ya da boşta kalmaz).
export function fmVarsayilanSon(ak) {
  const [y, m] = ak.split('-').map(Number);
  let d = new Date(y, m, 0);
  while (d.getDay() !== 1) d = addDays(d, -1);
  return ymd(addDays(d, 6));
}
export function fmSonGecerli(ak, e) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e || '')) return false;
  const d = parse(e);
  return d.getDay() === 0 && Math.abs((d - parse(fmVarsayilanSon(ak))) / 864e5) <= 21;
} // pazar, varsayılan bitişten en çok 3 hafta
export function fmBasGecerli(ak, b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b || '')) return false;
  const [y, m] = ak.split('-').map(Number);
  let f = new Date(y, m - 1, 1);
  while (f.getDay() !== 1) f = addDays(f, 1);
  const d = parse(b);
  return d.getDay() === 1 && Math.abs((d - f) / 864e5) <= 21;
} // pazartesi, ilk pazartesiden en çok 3 hafta
export function fmSonu(ak, sid = S.subeId) {
  const o = ((S.subeler[sid] || {}).fmSon || {})[ak];
  return o && fmSonGecerli(ak, o) ? o : fmVarsayilanSon(ak);
}
export function fmHaftalari(ak, sid = S.subeId) {
  const [y, m] = ak.split('-').map(Number);
  const L = [];
  let d = new Date(y, m - 1, 1);
  while (d.getDay() !== 1) d = addDays(d, 1);
  const once = ayKaydir(ak, -1);
  if (
    once >= BASLANGIC_AY &&
    subeAyari(sid, once).fmDonem === 'hafta' &&
    ((S.subeler[sid] || {}).fmSon || {})[once]
  )
    d = addDays(parse(fmSonu(once, sid)), 1);
  else if (once < BASLANGIC_AY) {
    const b = ((S.subeler[sid] || {}).fmBas || {})[ak];
    if (fmBasGecerli(ak, b)) d = parse(b);
  } // sistemin ilk ayı: başlangıç seçilebilir
  const son = fmSonu(ak, sid);
  const d0 = ymd(d);
  for (; ymd(d) <= son; d = addDays(d, 7)) L.push(ymd(d));
  if (!L.length) L.push(d0);
  return L;
}
// İşveren: haftalık dönemde ayın kaç hafta ödeneceğini seçer (ör. Ağustos 4 hafta, Eylül 5 hafta). Ay ya da sonraki ay onaylıysa kilitli.
export function fmSecici(ak, sb) {
  if (!isIsveren() || sb.fmDonem !== 'hafta' || ak < BASLANGIC_AY) return '';
  const sid = S.subeId;
  const L = fmHaftalari(ak, sid);
  const bas = L[0],
    cur = fmSonu(ak, sid);
  const kilitli =
    ['sube_onay', 'bolge_onay', 'kesin'].includes((S.aylar[ak] || {}).durum) ||
    ['bolge_onay', 'kesin'].includes((S.aylar[ayKaydir(ak, 1)] || {}).durum);
  const yaz = t => {
    const d = parse(t);
    return `${d.getDate()} ${AYK[d.getMonth()]}`;
  };
  const ilkAy = ayKaydir(ak, -1) < BASLANGIC_AY;
  const dis = kilitli ? 'disabled' : '';
  const basHtml = ilkAy
    ? `<label class="field"><span>Fazla mesai dönemi başlangıcı (${esc(subeAdi(sid))})</span><input type="date" id="fmBasSec" value="${bas}" ${dis}></label>`
    : '';
  return (
    basHtml +
    `<label class="field"><span>Fazla mesai dönemi bitişi (${esc(subeAdi(sid))})</span><input type="date" id="fmSonSec" value="${cur}" ${dis}></label>
  <p class="note">${L.length} hafta · ${yaz(bas)} – ${yaz(cur)}. ${kilitli ? 'Ay ya da sonraki ay onaylandığı için dönem değiştirilemez; önce kilidi açın.' : `${ilkAy ? 'Sistemin ilk ayı: başlangıç ve bitiş tarihini siz seçersiniz. ' : ''}Seçtiğiniz tarih hafta sınırına oturtulur (başlangıç pazartesi, bitiş pazar). Sonraki ay, bu ayın bittiği günün ertesinden başlar.`}</p>`
  );
}
export function fmDonemKaydet(ak, alan, v) {
  const sid = S.subeId;
  const eski = (S.subeler[sid] || {})[alan] || {};
  return setDoc(doc(db, 'subeler', sid), { [alan]: { [ak]: v } }, { merge: true })
    .then(() => {
      S.subeler[sid] = { ...S.subeler[sid], [alan]: { ...eski, [ak]: v } };
      toast('Fazla mesai dönemi güncellendi.');
      render();
    })
    .catch(yazmaHatasi);
}
export function fmSeciciBagla(ak) {
  const bb = byId('fmBasSec'),
    e = byId('fmSonSec');
  if (bb)
    bb.onchange = () => {
      if (!bb.value) {
        render();
        return;
      }
      const v = mondayOf(parse(bb.value));
      if (!fmBasGecerli(ak, v)) {
        toast('Başlangıç, ayın ilk pazartesisinden en çok 3 hafta uzakta olabilir.');
        render();
        return;
      }
      if (v > fmSonu(ak)) {
        toast('Başlangıç bitişten sonra olamaz.');
        render();
        return;
      }
      fmDonemKaydet(ak, 'fmBas', v);
    };
  if (e)
    e.onchange = () => {
      if (!e.value) {
        render();
        return;
      }
      const v = ymd(addDays(parse(mondayOf(parse(e.value))), 6));
      if (!fmSonGecerli(ak, v)) {
        toast('Bitiş, ay sonundan en çok 3 hafta uzakta olabilir.');
        render();
        return;
      }
      if (v < ymd(addDays(parse(fmHaftalari(ak)[0]), 6))) {
        toast('Dönem en az 1 hafta olmalı.');
        render();
        return;
      }
      fmDonemKaydet(ak, 'fmSon', v);
    };
}
export function fmDonemYazi(ak, sb = sube()) {
  const r = fmDonemAraligi(ak, S.subeId, sb);
  const t = fmDonemTemel(ak, sb);
  if (sb.fmDonem !== 'hafta' && r.bas === t.bas) return '';
  const a = parse(r.bas),
    b = parse(r.son);
  return `${a.getDate()} ${AYK[a.getMonth()]} – ${b.getDate()} ${AYK[b.getMonth()]}`;
}
// Çizelgedeki "ay fazla mesai" sütununun ayı: haftalık dönemde haftanın pazartesisinin ayı
export function fmAyi(wid, sb = sube()) {
  if (sb.fmDonem !== 'hafta') return gosterAy(wid);
  const a = ayKey(parse(wid));
  const sbd = S.subeler[S.subeId] || {};
  if (!Object.keys(sbd.fmSon || {}).length && !Object.keys(sbd.fmBas || {}).length) return a;
  return (
    [a, ayKaydir(a, 1), ayKaydir(a, -1)].find(k => k >= BASLANGIC_AY && fmHaftalari(k).includes(wid)) || a
  );
}
