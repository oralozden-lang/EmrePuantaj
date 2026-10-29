// firebase.js — app.js (v180) satırları 85-112. Otomatik bölündü; davranış değişmedi.
import { firebaseConfig } from '../config.js?v=67';
import {
  deleteDoc as fsDeleteDoc,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction as fsRunTransaction,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  writeBatch as fsWriteBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { S } from './durum.js';
import { yazmaHatasi } from './yazma.js';
import { toast } from './panel.js';

/* ================= Firebase ================= */
export const ayarliMi = !String(firebaseConfig.apiKey || '').startsWith('BURAYA');
export let app, auth, db;
// Kalıcı önbellek: internet yokken yapılan kayıtlar telefonda saklanır, uygulama kapanıp açılsa da internet gelince gönderilir.
if (ayarliMi) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    console.error(e);
    db = getFirestore(app);
  }
}
/* ---- Bekleyen kayıt takibi ----
   Her yazma sunucu onaylayana kadar sayılır. Bekleyen kayıt varken ekranın altında durum gösterilir, sayfa kapatılmak istenirse uyarılır. */
export const KAYIT = { n: 0 };
export function eskiRet() {
  toast('Uygulama güncellendi; kayıt için sayfayı yenileyin.');
  const r = Promise.reject(Object.assign(new Error('Eski uygulama sürümü'), { code: 'eski-surum' }));
  r.catch(() => {});
  return r;
}
export function kayitIzle(p) {
  KAYIT.n++;
  kayitCiz();
  const bit = () => {
    KAYIT.n = Math.max(0, KAYIT.n - 1);
    kayitCiz();
  };
  p.then(bit, bit);
  return p;
}
// Eski sürüm (sistem/surum) ise yazma SDK'ya hiç gitmez.
export const setDoc = (...a) => (S.eskiSurum ? eskiRet() : kayitIzle(fsSetDoc(...a)));
export const updateDoc = (...a) => (S.eskiSurum ? eskiRet() : kayitIzle(fsUpdateDoc(...a)));
export const deleteDoc = (...a) => (S.eskiSurum ? eskiRet() : kayitIzle(fsDeleteDoc(...a)));
export const runTransaction = (...a) => (S.eskiSurum ? eskiRet() : kayitIzle(fsRunTransaction(...a)));
export function writeBatch(d) {
  const b = fsWriteBatch(d);
  const c = b.commit.bind(b);
  b.commit = () => (S.eskiSurum ? eskiRet() : kayitIzle(c()));
  return b;
}
// Sunucu onayını beklemeden gönder (kayıt telefonda sıraya girdi); ret gelirse kullanıcıya söylenir.
export const arka = p => {
  p.catch(e => yazmaHatasi(e));
};
let kayitT = null;
export function kayitCiz() {
  let el = document.getElementById('kayitDurum');
  if (!el) {
    el = document.createElement('div');
    el.id = 'kayitDurum';
    el.setAttribute('role', 'status');
    el.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom));z-index:60;padding:8px 14px;border-radius:999px;font:600 13px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.18);display:none;max-width:92vw;text-align:center';
    document.body.appendChild(el);
  }
  clearTimeout(kayitT);
  if (!KAYIT.n) {
    el.style.display = 'none';
    return;
  }
  const goster = () => {
    if (!KAYIT.n) {
      el.style.display = 'none';
      return;
    }
    const off = navigator.onLine === false;
    el.style.background = off ? '#b42318' : '#1f3a6b';
    el.style.color = '#fff';
    el.textContent = off
      ? `İnternet yok · ${KAYIT.n} değişiklik bu cihazda bekliyor, internet gelince gönderilecek.`
      : `Kaydediliyor… (${KAYIT.n})`;
    el.style.display = 'block';
  };
  if (navigator.onLine === false) goster();
  else kayitT = setTimeout(goster, 1500);
}
window.addEventListener('online', kayitCiz);
window.addEventListener('offline', kayitCiz);
window.addEventListener('beforeunload', e => {
  if (KAYIT.n > 0) {
    e.preventDefault();
    e.returnValue = 'Kaydedilmeyi bekleyen değişiklikler var.';
    return e.returnValue;
  }
});
