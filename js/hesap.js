// hesap.js — app.js (v180) satırları 186-235. Otomatik bölündü; davranış değişmedi.
import { BASLANGIC_AY, GRUP_SIRA, KOD, VARSAYILAN, onayli } from './sabitler.js';
import { S } from './durum.js';
import { addDays, ayKey, isShift, shiftHours, today, weekDays, ymd } from './yardimci.js';
import { odemeSubesi } from './gecmis.js';
import { bosSayilir, cokSubeli, digerGunler } from './cok-sube.js';
import { ayniKisi } from './ay-ozet.js';

/* ================= Hesaplar ================= */
export function sube(id) {
  const o = Object.assign({}, VARSAYILAN, S.subeler[id || S.subeId] || {});
  o.haftalik = Math.round(o.gunluk * 6 * 100) / 100;
  return o;
} // haftalık mesai = günlük × 6 (ayrı ayar yok)
// Hesaba giren şube ayarları aya göre: ayarGecmis {"2026-11": {gunluk, fmUcret, …}} = "o aydan itibaren". Ayar değişince önceki aylar eski ayarla kalır.
export const AYAR_ALANLARI = ['gunluk', 'fmYontem', 'fmUcret', 'fmDonem'];
export function subeAyari(id, ak) {
  const sb = sube(id);
  const g = sb.ayarGecmis;
  if (!g || !ak) return sb;
  const k = Object.keys(g)
    .filter(x => x <= ak)
    .sort()
    .pop();
  if (!k) return sb;
  const r = { ...sb, ...g[k] };
  r.haftalik = Math.round(r.gunluk * 6 * 100) / 100;
  return r;
}
export function ayarGecmisYama(id, yeni) {
  const s0 = sube(id);
  if (!S.subeler[id]) return {};
  const ak0 = ayKey(today());
  const ak = ak0 < BASLANGIC_AY ? BASLANGIC_AY : ak0;
  const g = { ...(s0.ayarGecmis || {}) };
  const al = o => Object.fromEntries(AYAR_ALANLARI.map(k => [k, o[k] ?? VARSAYILAN[k] ?? null]));
  const simdi = subeAyari(id, ak);
  if (!AYAR_ALANLARI.some(k => yeni[k] !== undefined && yeni[k] !== simdi[k])) return {};
  if (!Object.keys(g).length) g[BASLANGIC_AY] = al(s0); // ilk değişiklik: o güne kadarki ayarlar başlangıçtan itibaren geçerli kalır
  g[ak] = al({ ...simdi, ...yeni });
  return { ayarGecmis: g };
}
export function cellOf(pid, wid, i, H = S.haftalar) {
  const w = H[wid];
  const c = w && w.cells && w.cells[pid];
  const v = c ? c[String(i)] : null;
  return v == null ? null : v;
}
// Fiili çalışma: işe başlama (deneme dahil) varsa ondan, yoksa SGK girişinden itibaren.
export function ilkGun(p) {
  return p.baslama && (!p.giris || p.baslama < p.giris) ? p.baslama : p.giris;
}
export function sgkli(p, d) {
  const s = ymd(d);
  if (p.giris && s < p.giris) return false;
  if (p.cikis && s > p.cikis) return false;
  return true;
}
export function employed(p, d) {
  const s = ymd(d);
  const g = ilkGun(p);
  if (g && s < g) return false;
  if (p.cikis && s > p.cikis) return false;
  return true;
}
// Çıkış yapan kişi, son çalıştığı ayın maaşı ödendikten sonra (ertesi ayın 10'undan sonra) Pasif'e geçer.
// Aynı kişinin başka bir (çıkmış) kaydı henüz pasife geçmediyse (ör. SGK'sız ikinci kayıt) ikisi birlikte geçer.
export const PASIF_GUN = 10;
export function pasifTarihi(c) {
  const [y, m] = c.split('-').map(Number);
  return ymd(new Date(y, m, PASIF_GUN));
}
export function pasifSure(p, td) {
  return !!p.cikis && td > pasifTarihi(p.cikis);
}
export function pasifMi(p, td, list) {
  if (!pasifSure(p, td)) return false;
  return !list.some(x => x.id !== p.id && x.cikis && x.cikis < td && ayniKisi(x, p) && !pasifSure(x, td));
}
export function weekHasEntry(pid, wid, H = S.haftalar) {
  const w = H[wid];
  const c = w && w.cells && w.cells[pid];
  return !!c && Object.values(c).some(v => v != null && v !== '');
}
export function isEsnaf(p) {
  return p.sekil === 'Esnaf kurye';
}
export function locked(d) {
  const a = S.aylar[ayKey(d)];
  return !!a && onayli(a.durum);
} // aylık şube kapatması yok; haftalar kapatılır, ay sadece bölge onayında kilitlenir
export function aktifHaftada(p, wid) {
  return weekDays(wid).some(d => employed(p, d));
}
export function aktifAyda(p, ak) {
  const [y, m] = ak.split('-').map(Number);
  for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d = addDays(d, 1))
    if (employed(p, d)) return true;
  return false;
}
export function sirala(list) {
  return list
    .slice()
    .sort(
      (a, b) =>
        GRUP_SIRA.indexOf(a.grup || 'K') - GRUP_SIRA.indexOf(b.grup || 'K') ||
        (a.sira ?? 999) - (b.sira ?? 999) ||
        String(a.ad).localeCompare(String(b.ad), 'tr')
    );
}
// Excel kuralı: hafta FM = çalışılan − (gün × günlük); 7 gün çalışılmışsa çalışılan − haftalık. Kaydı olmayan hafta sayılmaz; boş gün beklenen gündür.
// Çok şubeli kişide başka şubede çalıştığı gün bu şubede "boş gün" sayılmaz; o günün normal saati çalıştığı şubede beklenir.
// İzin kullanmadan 7 gün çalışılan haftanın fazlası (7 × günlük − haftalık) haftaYedi'nin seçtiği şubeye yazılır.
export function haftaHesap(p, wid, sb = sube(), H = S.haftalar) {
  let h = 0,
    wd = 0,
    bos = 0;
  const kayit = weekHasEntry(p.id, wid, H);
  const cs = cokSubeli(p);
  weekDays(wid).forEach((d, i) => {
    if (!employed(p, d)) return;
    const v = cellOf(p.id, wid, i, H);
    if (isShift(v)) {
      h += shiftHours(v);
      wd++;
    } else if ((v == null || v === '') && kayit && bosSayilir(p, d)) bos++;
  });
  const y = kayit ? haftaYedi(p, wid, H) : { yedi: false };
  const bonus = y.yedi && y.sube === S.subeId ? 7 * sb.gunluk - sb.haftalik : 0;
  return { h, wd, bos, fm: !kayit ? 0 : h - (wd + bos) * sb.gunluk + bonus, kayit };
}
// Haftanın 7 günü de (bu şube + kişinin diğer şubeleri) vardiyalı mı? İzin günü mesaisini ödeyen şube: maaş şubesi dışında çalışılan son günün şubesi, yoksa maaş şubesi.
// Aynı kişinin birden fazla kaydı varsa (SGK şube devri, SGK'sız devam) hafta kişi bazında birleşik bakılır: her gün o gün çalışan kaydın hücresine bakılır.
// Sonuç yalnızca pazar günü çalışan kayıt için döner; böylece fazla mesai bonusu kayıtlar toplanırken bir kez sayılır.
export function haftaYedi(p, wid, H = S.haftalar, sid = S.subeId) {
  const ds = weekDays(wid);
  const ms = odemeSubesi(p, ayKey(ds[6]));
  let son = null,
    burada = 0;
  if (!employed(p, ds[6])) return { yedi: false };
  const grup = S.personel.filter(x => x.id === p.id || ayniKisi(x, p));
  for (let i = 0; i < 7; i++) {
    const d = ds[i];
    const E = grup.filter(x => employed(x, d));
    if (!E.length) return { yedi: false };
    const L = [];
    if (E.some(x => isShift(cellOf(x.id, wid, i, H)))) {
      L.push(sid);
      burada++;
    }
    E.forEach(x => {
      if (!cokSubeli(x)) return;
      const o = digerGunler(x, d, sid);
      if (o)
        Object.entries(o).forEach(([s, v]) => {
          if (isShift(v)) L.push(s);
        });
    });
    if (!L.length) return { yedi: false };
    L.forEach(s => {
      if (s !== ms) son = s;
    });
  }
  return { yedi: true, sube: burada === 7 ? sid : son || ms };
}
// Bir haftanın kişi bazında ay ay dökümü (takvim ayı hesabıyla aynı kural): kapatılan haftanın özeti için.
export function haftaAyParca(p, wid, sb = sube(), H = S.haftalar) {
  const o = {};
  if (!weekHasEntry(p.id, wid, H)) return o;
  const cs = cokSubeli(p);
  weekDays(wid).forEach((d, i) => {
    if (!employed(p, d)) return;
    const ak = ayKey(d);
    const x = (o[ak] = o[ak] || { h: 0, fm: 0 });
    const v = cellOf(p.id, wid, i, H);
    if (isShift(v)) {
      const s = shiftHours(v);
      x.h += s;
      x.fm += s - sb.gunluk;
    } else if (!(v && KOD[v]) && bosSayilir(p, d)) x.fm -= sb.gunluk;
    if (i === 6) {
      const y = haftaYedi(p, wid, H);
      if (y.yedi && y.sube === S.subeId) x.fm += 7 * sb.gunluk - sb.haftalik;
    }
  });
  Object.values(o).forEach(x => {
    x.h = Math.round(x.h * 100) / 100;
    x.fm = Math.round(x.fm * 100) / 100;
  });
  return o;
}
