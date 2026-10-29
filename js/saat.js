// saat.js — app.js (v180) satırları 147-163. Otomatik bölündü; davranış değişmedi.
import { isShift, tnum, today, ymd } from './yardimci.js';

/* ---- Saat seçimi: yarım saatlik, şubenin saatlerine göre ----
   Normal aralık: açılış – kapanış + 30 dk (örn. 11:00 – 02:30). Bugün ve geçmiş günlerde düzeltme için iki uçta birer saat pay (10:00 – 03:30). */
export const SON_SAAT_AZAMI = 20; // saat listesi son saati, açılıştan en fazla 20 saat sonra olabilir
export function saatAraligi(sb) {
  const op = Math.round(tnum(sb.acilis || '11:00') * 2) / 2;
  let cl = Math.round(tnum(sb.kapanis || '00:30') * 2) / 2;
  if (cl <= op) cl += 24;
  let n1 = cl + 0.5;
  // İsteğe bağlı "saat listesi son saati" (örn. destek için 02:30): kapanış değişmez, sadece seçilebilir saatler uzar.
  if (sb.sonSaat && /^\d{1,2}:\d{2}$/.test(sb.sonSaat)) {
    let t = Math.round(tnum(sb.sonSaat) * 2) / 2;
    while (t <= op) t += 24;
    if (t > n1 && t - op <= SON_SAAT_AZAMI) n1 = t;
  }
  return { n0: op, n1 };
}
export function saatYaz(t) {
  const tt = ((t % 24) + 24) % 24;
  const h = Math.floor(tt + 1e-9);
  return String(h).padStart(2, '0') + ':' + (tt - h > 0.25 ? '30' : '00');
}
export function duzeltmeGunu(d) {
  return ymd(d) <= ymd(today());
}
export function saatListesi(sb, pay) {
  const { n0, n1 } = saatAraligi(sb);
  const L = [];
  for (let t = n0 - (pay ? 1 : 0); t <= n1 + (pay ? 1 : 0) + 1e-9; t += 0.5)
    L.push({ s: saatYaz(t), t, pay: t < n0 - 1e-9 ? 'erken' : t > n1 + 1e-9 ? 'gec' : '' });
  return L;
}
// Saatin listedeki konumu: gece yarısından sonraki saatler kapanışa göre sıralanır (02:00 → 26).
export function saatKonum(s, sb) {
  const { n0 } = saatAraligi(sb);
  let t = tnum(s);
  while (t < n0 - 1 - 1e-9) t += 24;
  return t;
}
// Vardiya kurala uyuyor mu: yarım saat, şube aralığında (ileri tarihli günde pay yok). pay: erken çağrılma / geç çıkış.
export function vardiyaKontrol(v, sb, d) {
  if (!isShift(v)) return { ok: true };
  const [a, b] = v.split('-');
  const yarim = x => /:(00|30)$/.test(x);
  if (!yarim(a) || !yarim(b))
    return { ok: false, neden: 'Saatler yarım saatlik olmalı (örn. 11:00, 11:30).' };
  const { n0, n1 } = saatAraligi(sb);
  const pay = duzeltmeGunu(d) ? 1 : 0;
  const ta = saatKonum(a, sb);
  let tb = saatKonum(b, sb);
  if (tb <= ta) tb += 24;
  if (ta < n0 - pay - 1e-9 || ta > n1 + pay + 1e-9 || tb > n1 + pay + 1e-9)
    return {
      ok: false,
      neden: pay
        ? `Saat ${saatYaz(n0 - 1)} – ${saatYaz(n1 + 1)} arasında olmalı.`
        : `İleri tarihli günlerde saat ${saatYaz(n0)} – ${saatYaz(n1)} arasında olmalı. Erken çağrılma ve geç çıkış, gün geldiğinde düzeltme olarak yazılır.`,
    };
  return { ok: true, pay: ta < n0 - 1e-9 || tb > n1 + 1e-9 };
}
