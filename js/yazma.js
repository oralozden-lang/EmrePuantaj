// yazma.js — app.js (v180) satırları 473-478. Otomatik bölündü; davranış değişmedi.
import { doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase.js';
import { toast } from './panel.js';

/* ================= Yazma ================= */
export const kuyruk = {};
export function sirayla(key, fn) {
  kuyruk[key] = (kuyruk[key] || Promise.resolve()).then(fn).catch(yazmaHatasi);
  return kuyruk[key];
}
export function yazmaHatasi(e) {
  console.error(e);
  const c = (e && e.code) || '';
  if (c.includes('permission')) toast('Bu işlem için yetkiniz yok.');
  else if (c.includes('unavailable')) toast('Bağlantı yok. İnternet gelince tekrar deneyin.');
  else toast('Kaydedilemedi: ' + (e.message || c));
}
export const gerekliSube = sid => {
  if (!sid) throw new Error('Şube belirtilmeden yazma engellendi');
  return sid;
};
export const weekRef = (wid, sid) => doc(db, 'subeler', gerekliSube(sid), 'haftalar', wid);
