// yardimci.js — app.js (v180) satırları 126-146, 164-180. Otomatik bölündü; davranış değişmedi.
import { GIRIS_ALANI } from '../config.js?v=67';
import { AY, AYK } from './sabitler.js';

/* ================= Yardımcılar ================= */
export function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function ymd(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}
export function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function mondayOf(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return ymd(x);
}
export function weekDays(wid) {
  const m = parse(wid);
  return [0, 1, 2, 3, 4, 5, 6].map(i => addDays(m, i));
}
export function ayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
export function ayAdi(k) {
  const [y, m] = k.split('-').map(Number);
  return AY[m - 1] + ' ' + y;
}
export function ayKaydir(k, n) {
  const [y, m] = k.split('-').map(Number);
  return ayKey(new Date(y, m - 1 + n, 1));
}
export function rangeLabel(wid) {
  const ds = weekDays(wid);
  const a = ds[0],
    b = ds[6];
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${AY[b.getMonth()]} ${b.getFullYear()}`
    : `${a.getDate()} ${AYK[a.getMonth()]} – ${b.getDate()} ${AYK[b.getMonth()]} ${b.getFullYear()}`;
}
export function gosterAy(wid) {
  return ayKey(addDays(parse(wid), 3));
}
export const tnum = s => {
  const [h, m] = s.split(':').map(Number);
  return h + m / 60;
};
export const isShift = v => typeof v === 'string' && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(v);
export function shiftHours(v) {
  const [a, b] = v.split('-');
  let s = tnum(a),
    e = tnum(b);
  if (e <= s) e += 24;
  return e - s;
}
export function shiftKind(v, sb) {
  const [a, b] = v.split('-');
  let s = tnum(a),
    e = tnum(b);
  if (e <= s) e += 24;
  const op = tnum(sb.acilis || '11:00');
  let cl = tnum(sb.kapanis || '00:30');
  if (cl <= op) cl += 24;
  return { o: s <= op + 1e-6, k: e >= cl - 1e-6 };
}
export function normTime(raw) {
  let s = String(raw || '')
    .trim()
    .replace(/[.,\s]/g, ':');
  if (!s) return null;
  let h, m;
  if (s.includes(':')) {
    const p = s.split(':');
    h = +p[0];
    m = +(p[1] || 0);
    if (p[1] && p[1].length === 1) m *= 10;
  } else {
    const d = s.replace(/\D/g, '');
    if (!d) return null;
    if (d.length <= 2) {
      h = +d;
      m = 0;
    } else if (d.length <= 4) {
      h = +d.slice(0, -2);
      m = +d.slice(-2);
    } else return null;
  }
  if (!(h >= 0 && h <= 24 && m >= 0 && m <= 59)) return null;
  if (h === 24) h = 0;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export const fmt = x =>
  (Math.round((x || 0) * 100) / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
export const sg = x => {
  const r = Math.round((x || 0) * 100) / 100;
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
};
export const tl = x =>
  (Math.round((x || 0) * 100) / 100).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const tl0 = x => Math.round(x || 0).toLocaleString('tr-TR') + ' ₺';
export const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export function kisaAd(ad) {
  const p = String(ad || '')
    .trim()
    .split(/\s+/);
  return p.length > 1
    ? /^\d+$/.test(p[p.length - 1])
      ? p.join(' ')
      : p[0] + ' ' + p[p.length - 1][0] + '.'
    : p[0] || '';
} // "İSİMSİZ 12" kısalmaz (İSİMSİZ 1 ile karışmasın)
export function bas(ad) {
  const p = String(ad || '')
    .trim()
    .split(/\s+/);
  return ((p[0] || '')[0] || '') + ((p.length > 1 ? p[p.length - 1][0] : '') || '');
}
export function ascii(s) {
  return String(s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/i̇/g, 'i');
}
export function slug(s) {
  return (
    ascii(s)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'x'
  );
}
export function isimAnahtar(s) {
  return ascii(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function kadiNorm(s) {
  return ascii(s).replace(/[^a-z0-9._-]/g, '');
}
export const eposta = k => `${kadiNorm(k)}@${GIRIS_ALANI}`;
export const trTarih = s => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${+d}.${m}.${y}`;
};
// "8,5", "8.5", "28.075,50", "50.000" hepsini doğru okur: virgül varsa ondalık virgüldür; sadece nokta varsa ve 3'lü gruplarsa binlik ayırıcıdır.
export const sayi = v => {
  if (v === '' || v == null) return 0;
  if (typeof v === 'number') return v;
  let t = String(v).trim().replace(/[\s₺]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = +t;
  return isFinite(n) ? n : 0;
};
