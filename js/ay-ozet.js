// ay-ozet.js — app.js (v180) satırları 379-404. Otomatik bölündü; davranış değişmedi.
import { AYK, KOD, SGK_YOK, subeAdi } from './sabitler.js';
import { S } from './durum.js';
import { addDays, isShift, isimAnahtar, mondayOf, parse, tnum, ymd } from './yardimci.js';
import { aktifAyda, cellOf, employed, subeAyari } from './hesap.js';
import { ayHesap } from './hesap-ay.js';
import { ayKadrosu } from './kadro.js';

// Bu şubede çalışılan saat ve izinlerin aylık özeti (diğer şubelerin puantajı için kaydedilir).
export function subeOzeti(ak, sid = S.subeId) {
  const sb = subeAyari(sid, ak);
  const out = {};
  ayKadrosu(ak).forEach(p => {
    const a = ayHesap(p, ak, sb);
    out[p.id] = {
      saat: Math.round(a.h * 100) / 100,
      fm: Math.round((a.part ? a.fmHam : a.fm) * 100) / 100,
      gun: a.gun,
      bos: a.bos,
      R: a.kod.R || 0,
      UI: a.kod.UI || 0,
      YI: a.kod.YI || 0,
      B: a.kod.B || 0,
      D: a.kod.D || 0,
      g: gunHaritasi(p, ak),
    };
  });
  return out;
}
// Kişinin aydaki gün gün çizelgesi {"2026-10-05":"10:00-15:00" | "B" | "R" ...}: şubeler arası tekrar ve çakışma kontrolü için.
export function gunHaritasi(p, ak, H = S.haftalar) {
  const [y, m] = ak.split('-').map(Number);
  const g = {};
  for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d = addDays(d, 1)) {
    if (!employed(p, d)) continue;
    const v = cellOf(p.id, mondayOf(d), (d.getDay() + 6) % 7, H);
    if (isShift(v) || (v && KOD[v])) g[ymd(d)] = v;
  }
  return g;
}
export const IZIN_KODLARI = ['R', 'UI', 'YI'];
// Aynı kişi mi: iki kayıtta da TC varsa TC, yoksa ad soyad.
export function ayniKisi(a, b) {
  if (a.tc && b.tc) return a.tc === b.tc;
  return isimAnahtar(a.ad) === isimAnahtar(b.ad);
}
export const sgkVar = p => !!(p.sgkSube && p.sgkSube !== SGK_YOK);
// SGK girişi boş olan kayıt, aynı kişinin başka kaydında SGK girişi varsa gerçek SGK kaydı değildir (çift SGK günü sayılmaz).
export const sgkYansiKayit = p =>
  sgkVar(p) && !p.giris && S.personel.some(x => x.id !== p.id && sgkVar(x) && x.giris && ayniKisi(x, p));
// SGK şube değişikliği: aynı kişinin bu ay farklı şubelerde (farklı tarihlerde) SGK kaydı. En son girişli kayıt başta.
export function sgkGecisGrubu(p, ak) {
  if (!sgkVar(p)) return [];
  const L = S.personel.filter(
    x => sgkVar(x) && aktifAyda(x, ak) && (x.id === p.id || (ayniKisi(x, p) && x.sgkSube !== p.sgkSube))
  );
  if (L.length < 2) return [];
  return L.sort((a, b) => String(b.giris || '').localeCompare(String(a.giris || '')));
}
export function vardiyaAralik(v) {
  const [a, b] = v.split('-');
  const s = tnum(a);
  let e = tnum(b);
  if (e <= s) e += 24;
  return [s, e];
}
// Birden fazla şubenin gün haritasını birleştirir: aynı gün aynı kod bir kez sayılır; saat çakışması ve izinliyken çalışma bulunur.
// kaynaklar: [{sube, g, sayac}] — g yoksa (eski özet) sayac olduğu gibi eklenir.
export function gunBirlestir(kaynaklar, filtre = null) {
  const tarih = { R: new Set(), UI: new Set(), YI: new Set(), B: new Set() };
  const ek = { R: 0, UI: 0, YI: 0, B: 0 };
  const gunler = {};
  kaynaklar.forEach(k => {
    if (!k.g) {
      Object.keys(ek).forEach(c => (ek[c] += (k.sayac && k.sayac[c]) || 0));
      return;
    }
    Object.entries(k.g).forEach(([d, v]) => {
      if (filtre && !filtre(d)) return;
      if (tarih[v]) tarih[v].add(d);
      (gunler[d] = gunler[d] || []).push({ sube: k.sube, v });
    });
  });
  const cakisma = [];
  Object.keys(gunler)
    .sort()
    .forEach(d => {
      const L = gunler[d];
      if (L.length < 2) return;
      const vard = L.filter(x => isShift(x.v)),
        izin = L.filter(x => IZIN_KODLARI.includes(x.v));
      let sorun = false;
      for (let i = 0; i < vard.length && !sorun; i++)
        for (let j = i + 1; j < vard.length; j++) {
          const [a1, b1] = vardiyaAralik(vard[i].v),
            [a2, b2] = vardiyaAralik(vard[j].v);
          if (a1 < b2 && a2 < b1) {
            sorun = true;
            break;
          }
        }
      if (!sorun && vard.length && izin.length) sorun = true;
      if (sorun) {
        const t = parse(d);
        cakisma.push(
          `${t.getDate()} ${AYK[t.getMonth()]}: ` +
            L.map(
              x => `${subeAdi(x.sube)} ${isShift(x.v) ? x.v : KOD[x.v].ad.toLocaleLowerCase('tr-TR')}`
            ).join(' · ')
        );
      }
    });
  const say = {};
  Object.keys(tarih).forEach(c => (say[c] = tarih[c].size + ek[c]));
  return { say, cakisma };
}
