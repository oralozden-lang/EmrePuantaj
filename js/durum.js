// durum.js — app.js (v180) satırları 113-125. Otomatik bölündü; davranış değişmedi.

/* ================= Sürüm kontrolü =================
   sistem/surum.min: kayıt yapabilecek en eski uygulama sürümü. İşveren yeni sürümü açınca min yükselir; eski sürümle açık kalan
   telefonlar yazamaz, "yenileyin" ekranı görür (eski kodun hatalı kayıt yapması engellenir). Her yayında APP_SURUM bir artırılır. */
export const APP_SURUM = 180;
/* ================= Durum ================= */
export const S = {
  subeAdlari: {},
  user: null,
  me: null,
  meYuklendi: false,
  kurulumVar: null,
  subeler: {},
  subeIds: [],
  subeId: null,
  personel: [],
  haftalar: {},
  aylar: {},
  loaded: { personel: false, haftalar: false },
  tab: 'cizelge',
  hafta: null,
  ay: null,
  pt: { sube: null, gorunum: 'sol', doc: null, maas: null, prev: null, listeAylar: {} },
  users: [],
  gunler: {},
  haftaDurum: { w: {} },
  tk: {},
  tkGorunum: 'hafta',
  tkKay: 0,
};
export const subs = { sube: [], detay: [], liste: [], me: null, users: null, subeDocs: [], gun: [], tk: [] };
export const undo = [];
export const tryLS = (k, v) => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch (e) {
    return null;
  }
};
