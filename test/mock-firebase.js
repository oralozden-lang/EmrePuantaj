// Test için sahte Firebase: Firestore ve Auth, bellekte çalışır. Güvenlik kurallarını UYGULAMAZ
// (kurallar gerçek Firebase'te sınanır); amaç uygulamanın mantığını ve ekranlarını çalıştırmaktır.
// Uygulamanın kullandığı API alt kümesini destekler (app.js içindeki import listesi).

/* ------------------------------ Zaman damgası ------------------------------ */
export class Timestamp {
  constructor(ms) { this._ms = ms; }
  toMillis() { return this._ms; }
  toDate() { return new Date(this._ms); }
  isEqual(o) { return o && o._ms === this._ms; }
}

/* ------------------------------ Belge deposu ------------------------------ */
const store = new Map(); // yol -> veri
const dinleyiciler = new Set(); // {kind, ref, cb, son}
const yazimlar = [];

const kopya = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v, (k, x) => (x instanceof Timestamp ? { __ts: x._ms } : x)), (k, x) => (x && typeof x === 'object' && '__ts' in x ? new Timestamp(x.__ts) : x)));
const duzMu = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !v.__sentinel;
const esit = (a, b) => JSON.stringify(a, (k, x) => (x instanceof Timestamp ? { __ts: x._ms } : x)) === JSON.stringify(b, (k, x) => (x instanceof Timestamp ? { __ts: x._ms } : x));

export const deleteField = () => ({ __sentinel: 'delete' });
export const arrayUnion = (...els) => ({ __sentinel: 'union', els });
export const serverTimestamp = () => ({ __sentinel: 'ts' });

const simdi = () => (globalThis.__mockNow ? globalThis.__mockNow() : Date.now());

// Değeri hedefe işler (sentinel'leri çözer)
function degerUygula(eski, yeni) {
  if (yeni && yeni.__sentinel === 'delete') return undefined;
  if (yeni && yeni.__sentinel === 'ts') return new Timestamp(simdi());
  if (yeni && yeni.__sentinel === 'union') {
    const L = Array.isArray(eski) ? eski.slice() : [];
    yeni.els.forEach((e) => { if (!L.some((x) => esit(x, e))) L.push(kopya(e)); });
    return L;
  }
  if (Array.isArray(yeni)) return yeni.map((x) => degerUygula(undefined, x)).filter((x) => x !== undefined);
  if (duzMu(yeni)) return derinBirlestir(duzMu(eski) ? eski : {}, yeni);
  return kopya(yeni);
}
function derinBirlestir(hedef, kaynak) {
  const o = { ...hedef };
  for (const [k, v] of Object.entries(kaynak)) {
    const r = degerUygula(o[k], v);
    if (r === undefined) delete o[k]; else o[k] = r;
  }
  return o;
}
// Sentinel'li veriyi birleştirmesiz (tam yazım) çöz
function tamCoz(veri) {
  const o = {};
  for (const [k, v] of Object.entries(veri)) {
    const r = duzMu(v) ? tamCoz(v) : degerUygula(undefined, v);
    if (r !== undefined) o[k] = r;
  }
  return o;
}
function noktaliAyarla(obj, yol, deger) {
  const p = yol.split('.');
  let o = obj;
  for (let i = 0; i < p.length - 1; i++) { if (!duzMu(o[p[i]])) o[p[i]] = {}; o = o[p[i]]; }
  const r = degerUygula(o[p[p.length - 1]], deger);
  if (r === undefined) delete o[p[p.length - 1]]; else o[p[p.length - 1]] = r;
}
function noktaliOku(obj, yol) {
  return yol.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function yazUygula(op) {
  const { tur, yol, veri, secenek } = op;
  const mevcut = store.get(yol);
  if (tur === 'delete') { store.delete(yol); return; }
  if (tur === 'update') {
    if (!mevcut) { const e = new Error('Belge yok: ' + yol); e.code = 'not-found'; throw e; }
    const o = kopya(mevcut);
    for (const [k, v] of Object.entries(veri)) noktaliAyarla(o, k, v);
    store.set(yol, o); return;
  }
  // set
  if (secenek && secenek.mergeFields) {
    const o = mevcut ? kopya(mevcut) : {};
    for (const f of secenek.mergeFields) { const v = noktaliOku(veri, f); if (v !== undefined) noktaliAyarla(o, f, v); }
    store.set(yol, o); return;
  }
  if (secenek && secenek.merge) { store.set(yol, derinBirlestir(mevcut ? kopya(mevcut) : {}, veri)); return; }
  store.set(yol, tamCoz(veri));
}

/* ------------------------------ Referanslar ------------------------------ */
const dbNesnesi = { __db: true };
const yolBirles = (segs) => segs.flat().join('/');
export const doc = (ilk, ...segs) => {
  const yol = ilk && ilk.__type === 'col' ? yolBirles([ilk.path, ...segs]) : yolBirles(segs);
  return { __type: 'doc', path: yol, id: yol.split('/').pop() };
};
export const collection = (ilk, ...segs) => ({ __type: 'col', path: ilk && ilk.__type === 'doc' ? yolBirles([ilk.path, ...segs]) : yolBirles(segs) });
export const where = (alan, op, deger) => ({ alan, op, deger });
export const query = (col, ...kisitlar) => ({ __type: 'query', col, kisitlar });

function snapOlustur(yol) {
  const v = store.get(yol);
  return {
    id: yol.split('/').pop(), ref: { __type: 'doc', path: yol, id: yol.split('/').pop() },
    exists: () => v !== undefined, data: () => (v === undefined ? undefined : kopya(v)),
    metadata: { fromCache: false, hasPendingWrites: false },
  };
}
function kisitUyar(veri, k) {
  const x = noktaliOku(veri, k.alan);
  switch (k.op) {
    case '==': return esit(x, k.deger);
    case '>=': return x !== undefined && x >= k.deger;
    case '<=': return x !== undefined && x <= k.deger;
    case '>': return x !== undefined && x > k.deger;
    case '<': return x !== undefined && x < k.deger;
    case 'array-contains': return Array.isArray(x) && x.some((e) => esit(e, k.deger));
    case 'in': return k.deger.some((e) => esit(x, e));
    default: throw new Error('Desteklenmeyen sorgu: ' + k.op);
  }
}
function koleksiyonYollari(path) {
  const on = path + '/';
  return [...store.keys()].filter((y) => y.startsWith(on) && !y.slice(on.length).includes('/')).sort();
}
function sorguSnap(ref) {
  const col = ref.__type === 'query' ? ref.col : ref;
  const k = ref.__type === 'query' ? ref.kisitlar : [];
  const docs = koleksiyonYollari(col.path).filter((y) => k.every((c) => kisitUyar(store.get(y), c))).map(snapOlustur);
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (f) => docs.forEach(f), metadata: { fromCache: false, hasPendingWrites: false } };
}
const imza = (ref) => (ref.__type === 'doc' ? JSON.stringify(store.get(ref.path) ?? null, (k, x) => (x instanceof Timestamp ? { __ts: x._ms } : x))
  : JSON.stringify(sorguSnap(ref).docs.map((d) => [d.id, store.get(d.ref.path)]), (k, x) => (x instanceof Timestamp ? { __ts: x._ms } : x)));

/* ------------------------------ Okuma ------------------------------ */
export const getDoc = async (ref) => snapOlustur(ref.path);
export const getDocs = async (ref) => sorguSnap(ref);
export function onSnapshot(ref, ...a) {
  const cb = typeof a[0] === 'function' ? a[0] : a[1];
  const hata = typeof a[0] === 'function' ? a[1] : a[2];
  const kayit = { ref, cb, hata, son: null, acik: true };
  dinleyiciler.add(kayit);
  setTimeout(() => teslimEt(kayit, true), 0);
  return () => { kayit.acik = false; dinleyiciler.delete(kayit); };
}
function teslimEt(k, ilk = false) {
  if (!k.acik) return;
  const s = imza(k.ref);
  if (!ilk && s === k.son) return;
  k.son = s;
  try { k.cb(k.ref.__type === 'doc' ? snapOlustur(k.ref.path) : sorguSnap(k.ref)); } catch (e) { console.error('[mock onSnapshot]', e); }
}
function bildir() { setTimeout(() => [...dinleyiciler].forEach((k) => teslimEt(k)), 0); }

/* ------------------------------ Yazma ------------------------------ */
const yaz = (op) => { yazimlar.push({ tur: op.tur, yol: op.yol }); yazUygula(op); bildir(); return Promise.resolve(); };
export const setDoc = (ref, veri, secenek) => yaz({ tur: 'set', yol: ref.path, veri, secenek });
export const updateDoc = (ref, veri) => yaz({ tur: 'update', yol: ref.path, veri });
export const deleteDoc = (ref) => yaz({ tur: 'delete', yol: ref.path });
export function writeBatch() {
  const ops = [];
  const b = {
    set: (ref, veri, secenek) => { ops.push({ tur: 'set', yol: ref.path, veri, secenek }); return b; },
    update: (ref, veri) => { ops.push({ tur: 'update', yol: ref.path, veri }); return b; },
    delete: (ref) => { ops.push({ tur: 'delete', yol: ref.path }); return b; },
    commit: async () => {
      const yedek = new Map([...store].map(([k, v]) => [k, kopya(v)]));
      try { ops.forEach((o) => { yazimlar.push({ tur: o.tur, yol: o.yol }); yazUygula(o); }); } catch (e) { store.clear(); yedek.forEach((v, k) => store.set(k, v)); throw e; }
      bildir();
    },
  };
  return b;
}
export async function runTransaction(db, fn) {
  const ops = [];
  const tr = {
    get: async (ref) => snapOlustur(ref.path),
    set: (ref, veri, secenek) => { ops.push({ tur: 'set', yol: ref.path, veri, secenek }); return tr; },
    update: (ref, veri) => { ops.push({ tur: 'update', yol: ref.path, veri }); return tr; },
    delete: (ref) => { ops.push({ tur: 'delete', yol: ref.path }); return tr; },
  };
  const sonuc = await fn(tr);
  ops.forEach((o) => { yazimlar.push({ tur: o.tur, yol: o.yol }); yazUygula(o); });
  bildir();
  return sonuc;
}

/* ------------------------------ Firestore başlatma ------------------------------ */
export const getFirestore = () => dbNesnesi;
export const initializeFirestore = () => dbNesnesi;
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});

/* ------------------------------ App / Auth ------------------------------ */
export const initializeApp = (config, ad) => ({ __app: true, config, ad });
const auth = { currentUser: null };
const authDinleyiciler = new Set();
const kullaniciKayit = new Map(); // e-posta -> {uid, sifre}
const authBildir = () => setTimeout(() => authDinleyiciler.forEach((f) => f(auth.currentUser)), 0);
export const getAuth = () => auth;
export function onAuthStateChanged(a, cb) {
  authDinleyiciler.add(cb);
  setTimeout(() => cb(auth.currentUser), 0);
  return () => authDinleyiciler.delete(cb);
}
export async function signInWithEmailAndPassword(a, eposta, sifre) {
  const k = kullaniciKayit.get(String(eposta).toLowerCase());
  if (!k || k.sifre !== sifre) { const e = new Error('invalid-credential'); e.code = 'auth/invalid-credential'; throw e; }
  auth.currentUser = { uid: k.uid, email: eposta };
  authBildir();
  return { user: auth.currentUser };
}
export async function signOut() { auth.currentUser = null; authBildir(); }
export async function createUserWithEmailAndPassword(a, eposta, sifre) {
  const uid = 'uid-' + Math.random().toString(36).slice(2, 10);
  kullaniciKayit.set(String(eposta).toLowerCase(), { uid, sifre });
  return { user: { uid, email: eposta } };
}
export async function updatePassword(user, sifre) { const k = kullaniciKayit.get(String(user.email).toLowerCase()); if (k) k.sifre = sifre; }
export async function deleteUser() {}
export const EmailAuthProvider = { credential: (e, s) => ({ e, s }) };
export async function reauthenticateWithCredential(user, c) {
  const k = kullaniciKayit.get(String(user.email).toLowerCase());
  if (!k || k.sifre !== c.s) { const e = new Error('wrong-password'); e.code = 'auth/wrong-password'; throw e; }
}

/* ------------------------------ Test arayüzü ------------------------------ */
globalThis.__mock = {
  // Belge deposunu sıfırlayıp {yol: veri} ile doldurur
  tohumla(belgeler) { store.clear(); Object.entries(belgeler).forEach(([y, v]) => store.set(y, tamCoz(v))); bildir(); },
  kullanici(eposta, uid, sifre) { kullaniciKayit.set(eposta.toLowerCase(), { uid, sifre }); },
  dok() { return Object.fromEntries([...store].map(([y, v]) => [y, kopya(v)])); },
  oku(y) { return kopya(store.get(y)); },
  yazimlar() { return yazimlar.slice(); },
  yazimSifirla() { yazimlar.length = 0; },
};

// Sayfa açılmadan önce enjekte edilen tohum (globalThis.__SEED): belgeler, kullanıcılar, giriş yapan
if (globalThis.__SEED) {
  const T = globalThis.__SEED;
  store.clear();
  Object.entries(T.belgeler || {}).forEach(([y, v]) => store.set(y, tamCoz(v)));
  (T.kullanicilar || []).forEach((k) => kullaniciKayit.set(k.eposta.toLowerCase(), { uid: k.uid, sifre: k.sifre }));
  if (T.girisYapan) { const k = kullaniciKayit.get(T.girisYapan.toLowerCase()); if (k) auth.currentUser = { uid: k.uid, email: T.girisYapan }; }
}
