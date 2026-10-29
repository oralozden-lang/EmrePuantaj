// Test verisi: 2 şube, 3 rol, personel ve birkaç hafta. "Bugün" 14 Ekim 2026 Çarşamba.
export const BUGUN = '2026-10-14T10:00:00+03:00';
const ALAN = 'puantaj-merkezi.app';
export const KULLANICILAR = [
  { kadi: 'admin', uid: 'u-iv', sifre: 'Test1234', rol: 'isveren', ad: 'Test İşveren', subeler: [] },
  { kadi: 'bolge1', uid: 'u-bm', sifre: 'Test1234', rol: 'bolge', ad: 'Test Bölge', subeler: ['merkez', 'sahil'] },
  { kadi: 'sube1', uid: 'u-sm', sifre: 'Test1234', rol: 'sube', ad: 'Test Şube', subeler: ['merkez'], bolgeler: ['u-bm'] },
];
export const eposta = (kadi) => `${kadi}@${ALAN}`;

const sube = (ad) => ({ ad, acilis: '11:00', kapanis: '00:30', gunluk: 8.5, haftalik: 51, fmYontem: 'sabit', fmUcret: 165, fmDonem: 'hafta' });
const kisi = (ad, gorev, grup, sube_, giris, ekstra = {}) => ({ ad, gorev, grup, sekil: 'Tam', giris, cikis: '', sgkSube: sube_, anaSube: sube_, gorunurSubeler: [sube_], ekSubeler: [], ...ekstra });

export function tohum() {
  const b = {};
  KULLANICILAR.forEach((k) => {
    b[`kullanicilar/${k.uid}`] = { kullaniciAdi: k.kadi, adSoyad: k.ad, rol: k.rol, subeler: k.subeler, aktif: true, olusturma: '2026-08-01T00:00:00.000Z', ...(k.bolgeler ? { bolgeler: k.bolgeler } : {}) };
  });
  b['sistem/kurulum'] = { tarih: '2026-08-01T00:00:00.000Z', uid: 'u-iv' };
  b['sistem/surum'] = { min: 0 };
  b['sistem/goc'] = { v2: true, v3: true, v4: true, v5: true, v6: true };
  b['sistem/subeAdlari'] = { adlar: { merkez: 'Merkez', sahil: 'Sahil' } };
  b['subeler/merkez'] = sube('Merkez');
  b['subeler/sahil'] = sube('Sahil');
  const P = {
    'mehmet-karakaya': kisi('MEHMET KARAKAYA', 'R. Müdür', 'M', 'merkez', '2026-01-05'),
    'ayse-demir': kisi('AYŞE DEMİR', 'V. Müdür', 'M', 'merkez', '2026-02-01'),
    'osman-celik': kisi('OSMAN ÇELİK', 'Mutfak', 'K', 'merkez', '2026-03-10'),
    'fatma-ozturk': kisi('FATMA ÖZTÜRK', 'Mutfak', 'K', 'merkez', '2026-06-01', { sekil: 'Part' }),
    'emre-asma': kisi('EMRE AŞMA', 'Kurye', 'S', 'merkez', '2026-06-15'),
    'can-yilmaz': kisi('CAN YILMAZ', 'Kurye', 'S', 'merkez', '2026-09-01'),
    'eda-elibol': kisi('EDA ELİBOL', 'Mutfak', 'K', 'merkez', '2026-03-01', { cikis: '2026-08-18' }), // pasif (ertesi ayın 10'undan sonra)
    'berkay-ekici': kisi('BERKAY EKİCİ', 'Kurye', 'S', 'merkez', '2026-06-12', { cikis: '2026-10-02' }), // çıkış yaptı, henüz pasif değil
    'zeynep-kaya': kisi('ZEYNEP KAYA', 'R. Müdür', 'M', 'sahil', '2026-04-01'),
    'burak-aydin': kisi('BURAK AYDIN', 'Mutfak', 'K', 'sahil', '2026-05-01'),
  };
  Object.entries(P).forEach(([id, v]) => { b[`personel/${id}`] = v; });

  const v = (a, c) => `${a}-${c}`;
  const A = v('11:00', '19:30'), K = v('16:00', '00:30');
  const hafta = (wid, hd, cells, kadro) => ({ hafta: wid, ay2: wid.slice(0, 7), hd, kadro, cells });
  const tam = (...gunler) => Object.fromEntries(gunler.map((g, i) => [String(i), g]));
  const merkezKadro = ['mehmet-karakaya', 'ayse-demir', 'osman-celik', 'fatma-ozturk', 'emre-asma', 'can-yilmaz'];
  // Geçen hafta (5 Ekim): kapatılmış, onay bekliyor
  b['subeler/merkez/haftalar/2026-10-05'] = {
    ...hafta('2026-10-05', 'kapali', {
      'mehmet-karakaya': tam(A, A, A, A, K, K, 'HT'),
      'ayse-demir': tam(K, K, 'HT', A, A, A, 'HT'),
      'osman-celik': tam(A, A, A, A, A, 'HT', 'HT'),
      'fatma-ozturk': tam(A, 'CG', A, 'CG', A, A, 'HT'),
      'emre-asma': tam(K, K, 'HT', K, K, K, 'HT'),
      'can-yilmaz': tam(A, A, A, 'HT', A, A, A),
    }, merkezKadro),
    kapatma: '2026-10-12T09:00:00.000Z', kapatan: 'u-sm', kapatanAd: 'Test Şube', geriNot: '', kayit: [{ t: '2026-10-12T09:00:00.000Z', ad: 'Test Şube', i: 'kapattı' }],
  };
  b['subeler/merkez/durum/haftalar'] = { w: { '2026-10-05': { d: 'kapali', t: '2026-10-12T09:00:00.000Z', ad: 'Test Şube', oz: {}, k: merkezKadro } } };
  // Bu hafta (12 Ekim): açık, Pzt-Çar dolu
  b['subeler/merkez/haftalar/2026-10-12'] = hafta('2026-10-12', 'acik', {
    'mehmet-karakaya': tam(A, A, A),
    'ayse-demir': tam(K, K, 'HT'),
    'osman-celik': tam(A, A, A),
    'fatma-ozturk': tam(A, 'CG', A),
    'emre-asma': tam(K, K, K),
    'can-yilmaz': tam(A, A, A),
  }, merkezKadro);
  b['subeler/sahil/haftalar/2026-10-12'] = hafta('2026-10-12', 'acik', { 'zeynep-kaya': tam(A, A, A), 'burak-aydin': tam(K, K, K) }, ['zeynep-kaya', 'burak-aydin']);
  // 31 Ağu – 28 Eyl haftaları: merkez, onaylı (Eylül puantajı için); her kişi 6 gün + 1 izin
  const sirali = ['mehmet-karakaya', 'ayse-demir', 'osman-celik', 'fatma-ozturk', 'emre-asma', 'can-yilmaz'];
  const kalip = (i) => {
    const gun = [A, A, A, A, K, K, 'HT'];
    if (i === 1) return [K, K, 'HT', A, A, A, 'HT'];
    if (i === 3) return [A, 'CG', A, 'CG', A, A, 'HT'];
    if (i === 4) return [K, K, K, K, K, K, K]; // 7 gün: bonus
    return gun;
  };
  const durumW = {};
  ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'].forEach((wid) => {
    const cells = {};
    sirali.forEach((id, i) => { if (id === 'can-yilmaz' && wid < '2026-09-01') return; cells[id] = tam(...kalip(i)); });
    b[`subeler/merkez/haftalar/${wid}`] = { ...hafta(wid, 'onay', cells, sirali), kapatma: wid + 'T20:00:00.000Z', kapatan: 'u-sm', kapatanAd: 'Test Şube', onayTarihi: wid + 'T22:00:00.000Z', onaylayanAd: 'Test Bölge' };
    durumW[wid] = { d: 'onay', t: wid + 'T20:00:00.000Z', ad: 'Test Şube', oz: {}, k: sirali };
  });
  durumW['2026-10-05'] = b['subeler/merkez/durum/haftalar'].w['2026-10-05'];
  b['subeler/merkez/durum/haftalar'] = { w: durumW };
  // Ödemeler: kalan tutarlar 5 TL'nin katı olmasın ki yuvarlama kuralı sınansın
  b['puantaj/merkez/aylar/2026-08'] = { sube: 'merkez', ay: '2026-08', sag: { 'osman-celik': { kalan: -2500.5 } }, kilitli: true };
  b['puantaj/merkez/aylar/2026-09'] = {
    sube: 'merkez', ay: '2026-09',
    sag: {
      'emre-asma': { bankaya: '33000', avans: '1233', otoOnay: { fm: 34 } },
      'osman-celik': { bankaya: '35100', avans: '400', araOdeme: '150.5' },
      'mehmet-karakaya': { bankaya: '58000', ciroPrimi: '777', paketPrimi: '' },
    },
    veriM: {
      v1: { id: 'v1', sira: 1, tarih: '2026-09-12', pid: 'ayse-demir', ad: 'AYŞE DEMİR', tur: 'AV', miktar: '1111', aciklama: 'avans' },
      v2: { id: 'v2', sira: 2, tarih: '2026-09-15', pid: 'can-yilmaz', ad: 'CAN YILMAZ', tur: 'R', miktar: '2', aciklama: 'rapor' },
      v3: { id: 'v3', sira: 3, tarih: '2026-09-20', pid: 'fatma-ozturk', ad: 'FATMA ÖZTÜRK', tur: 'PG', miktar: '18', aciklama: 'part gün' },
    },
  };
  b['maaslar/merkez'] = { net: { 'mehmet-karakaya': 60000, 'ayse-demir': 45000, 'osman-celik': 37000, 'fatma-ozturk': 20000, 'emre-asma': 33000, 'can-yilmaz': 33000 } };
  return b;
}
