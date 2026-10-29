// kadro.js — app.js (v180) satırları 355-378. Otomatik bölündü; davranış değişmedi.
import { GRUP_SIRA, subeAdi } from './sabitler.js';
import { S } from './durum.js';
import { addDays, ascii, gosterAy, mondayOf, parse, weekDays, ymd } from './yardimci.js';
import { aktifAyda, employed, haftaHesap, ilkGun } from './hesap.js';
import { ayKadar } from './hesap-ay.js';
import { fmAyi } from './fm-donem.js';
import { gorevAyda } from './gecmis.js';
import { subedenCikti } from './cok-sube.js';
import { ayniKisi } from './ay-ozet.js';
import { subePersoneli } from './personel.js';

export function kisaSubeAd(s) {
  const a = subeAdi(s) || '';
  const p = a.split(/\s+/);
  return p.length > 1 && /^(ankara|antalya|isparta|burdur)$/i.test(ascii(p[0])) ? p.slice(1).join(' ') : a;
}
export function kadroDoc(wid, H = S.haftalar) {
  const w = H[wid];
  if (!w) {
    const k = H === S.haftalar && ((S.haftaDurum.w || {})[wid] || {}).k;
    return Array.isArray(k) && k.length ? k : null;
  }
  if (Array.isArray(w.kadro)) return w.kadro;
  const c = Object.keys(w.cells || {});
  return c.length ? c : null;
}
export function kadroOf(wid) {
  const k = S.haftalar[wid] && kadroDoc(wid);
  if (k) return { ids: k, oneri: false };
  const ds = weekDays(wid);
  for (let i = 1; i <= 8; i++) {
    const kk = kadroDoc(ymd(addDays(parse(wid), -7 * i)));
    if (kk)
      return {
        ids: kk.filter(id => {
          const p = S.personel.find(x => x.id === id);
          return p && !subedenCikti(p) && ds.some(d => employed(p, d));
        }),
        oneri: true,
      };
  }
  return { ids: [], oneri: true };
}
// Çizelgede aynı kişinin birden fazla kaydı (SGK şube değişikliği) tek satırda: her gün o gün çalışan kayda yazılır.
export let CZ_ES = {};
export function rowPid(pid, i, wid = S.hafta) {
  const L = CZ_ES[pid];
  if (!L) return pid;
  const d = weekDays(wid)[i];
  const q = L.find(x => employed(x, d));
  return q ? q.id : pid;
}
export function gunKaydiP(p, d) {
  const L = CZ_ES[p.id] || [p];
  return L.find(x => employed(x, d)) || null;
}
export function haftaHesapS(p, wid, sb) {
  const L = CZ_ES[p.id];
  if (!L) return haftaHesap(p, wid, sb);
  const o = { h: 0, fm: 0 };
  L.forEach(q => {
    const x = haftaHesap(q, wid, sb);
    o.h += x.h;
    o.fm += x.fm;
  });
  return o;
}
export function ayKadarS(p, wid, sb) {
  let L = CZ_ES[p.id];
  // O hafta kadroda sadece devam kaydı varsa (ör. SGK çıkıştan sonra SGK'sız devam), aynı kişinin o aydaki önceki kaydı da aya-kadar toplamına katılır.
  if (!L) {
    const ak = fmAyi(wid, sb);
    const es = subePersoneli().filter(x => x.id === p.id || (ayniKisi(x, p) && aktifAyda(x, ak)));
    if (es.length > 1) L = es;
  }
  if (!L) return ayKadar(p, wid, sb);
  const o = { h: 0, fm: 0 };
  L.forEach(q => {
    const x = ayKadar(q, wid, sb);
    o.h += x.h;
    o.fm += x.fm;
  });
  return o;
}
export function cizelgeKisileri(wid) {
  const ids = kadroOf(wid).ids;
  let L = ids.map(id => S.personel.find(p => p.id === id)).filter(Boolean);
  if (wid === S.hafta) CZ_ES = {};
  const son = weekDays(wid)[6];
  const gor = new Set();
  const out = [];
  L.forEach(p => {
    if (gor.has(p.id)) return;
    const es = L.filter(x => x.id === p.id || (!gor.has(x.id) && ayniKisi(x, p)));
    es.forEach(x => gor.add(x.id));
    if (es.length < 2) {
      out.push(p);
      return;
    }
    es.sort((a, b) => String(a.giris || ilkGun(a) || '').localeCompare(String(b.giris || ilkGun(b) || '')));
    const rep = es.find(x => employed(x, son)) || es[es.length - 1];
    if (wid === S.hafta) CZ_ES[rep.id] = es;
    out.push(rep);
  });
  L = out.map(p => gorevAyda(p, gosterAy(wid)));
  const sira = id => {
    const L2 = CZ_ES[id] || [{ id }];
    return Math.min(
      ...L2.map(x => {
        const k = ids.indexOf(x.id);
        return k < 0 ? 999 : k;
      })
    );
  };
  return L.sort(
    (a, b) => GRUP_SIRA.indexOf(a.grup || 'K') - GRUP_SIRA.indexOf(b.grup || 'K') || sira(a.id) - sira(b.id)
  );
}
export function ayKadroIds(ak, H = S.haftalar) {
  const [y, m] = ak.split('-').map(Number);
  const set = new Set();
  const last = new Date(y, m, 0);
  for (let w = parse(mondayOf(new Date(y, m - 1, 1))); w <= last; w = addDays(w, 7)) {
    const k = kadroDoc(ymd(w), H);
    if (k) k.forEach(id => set.add(id));
  }
  return set;
}
export function ayKadrosu(ak) {
  const ids = ayKadroIds(ak);
  return S.personel.filter(p => ids.has(p.id) && aktifAyda(p, ak));
}
