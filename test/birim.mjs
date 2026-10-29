// Saf hesap kuralları için birim testleri (docs/kurallar.md numaralarına göre). Çalıştır: node --import ./test/node-hazirlik.mjs test/birim.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const H = await import('../js/hesap.js');
const HA = await import('../js/hesap-ay.js');
const FD = await import('../js/fm-donem.js');
const PH = await import('../js/puantaj-hesap.js');
const BD = await import('../js/bilgi-dogrulama.js');
const Y = await import('../js/yardimci.js');
const SA = await import('../js/saat.js');
const { S } = await import('../js/durum.js');

const SUBE = { ad: 'Merkez', acilis: '11:00', kapanis: '00:30', gunluk: 8.5, haftalik: 51, fmYontem: 'sabit', fmUcret: 165, fmDonem: 'hafta' };
const A = '11:00-19:30', K = '16:00-00:30';
const kisi = (id, ek = {}) => ({ id, ad: id.toUpperCase(), gorev: 'Mutfak', grup: 'K', sekil: 'Tam', giris: '2026-01-05', cikis: '', sgkSube: 'merkez', anaSube: 'merkez', gorunurSubeler: ['merkez'], ekSubeler: [], ...ek });
const haftaDoc = (wid, cells) => ({ hafta: wid, hd: 'acik', cells });
const gun = (...g) => Object.fromEntries(g.map((v, i) => [String(i), v]));
const kur = (haftalar, personel) => { S.subeId = 'merkez'; S.subeler = { merkez: { ...SUBE } }; S.haftalar = haftalar; S.personel = personel; };

test('G-2 SGK/bordro günü (sgkGunSayisi)', () => {
  const g = HA.sgkGunSayisi;
  assert.equal(g(31, 31, 0), 30, 'tam ay, 31 çeker');
  assert.equal(g(31, 31, 1), 30, '31 çeken ayda 1 gün rapor → 30');
  assert.equal(g(28, 28, 1), 27, 'Şubat 1 gün rapor → 27');
  assert.equal(g(30, 30, 0), 30);
  assert.equal(g(11, 30, 0), 11, 'ay ortası giriş');
  assert.equal(g(11, 30, 2), 9, 'ay ortası giriş, 2 gün rapor');
  assert.equal(g(31, 31, 2), 29);
  assert.equal(g(10, 30, 99), 0, 'negatife düşmez');
});

test('P-7 pasife geçiş (ertesi ayın 10\'undan sonra)', () => {
  assert.equal(H.pasifTarihi('2026-08-18'), '2026-09-10');
  const p = { cikis: '2026-08-18' };
  assert.equal(H.pasifSure(p, '2026-09-10'), false, '10\'unda henüz pasif değil');
  assert.equal(H.pasifSure(p, '2026-09-11'), true, '11\'inde pasif');
  assert.equal(H.pasifTarihi('2026-12-31'), '2027-01-10', 'yıl sonu');
  assert.equal(H.pasifSure({ cikis: '' }, '2030-01-01'), false);
});

test('H-4..H-9 haftalık fazla mesai (haftaHesap)', () => {
  const p = kisi('osman');
  const w = '2026-10-12';
  const hesap = (cells) => { kur({ [w]: haftaDoc(w, { osman: cells }) }, [p]); return H.haftaHesap(p, w, S.subeler.merkez && { ...SUBE, haftalik: 51 }); };
  assert.equal(hesap(gun(A, A, A, A, K, K, 'HT')).fm, 0, '6 gün + 1 izin → 0');
  assert.equal(hesap(gun(A, A, A, A, K, K, K)).fm, 8.5, '7 gün çalışma → bonus +8,5');
  assert.equal(hesap(gun(A, A, A, A, A, null, 'HT')).fm, -8.5, '5 gün + 1 boş + 1 izin → −8,5');
  assert.equal(hesap(gun('10:00-19:30', A, A, A, A, A, 'HT')).fm, 1, '6 gün, biri 9,5 sa → +1');
  kur({}, [p]); assert.equal(H.haftaHesap(p, w, { ...SUBE }).fm, 0, 'kaydı olmayan hafta → 0');
  const part = kisi('fatma', { sekil: 'Part' }); kur({ [w]: haftaDoc(w, { fatma: gun(A, A, A, A, A, A, A) }) }, [part]);
  assert.ok(H.haftaHesap(part, w, { ...SUBE }).h > 0);
});

test('D-1..D-3 fazla mesai dönemi ve geçişler', () => {
  S.subeId = 'merkez';
  S.subeler = { merkez: { ...SUBE, ayarGecmis: { '2026-08': { gunluk: 8.5, fmDonem: 'hafta', fmYontem: 'sabit', fmUcret: 165 }, '2026-10': { gunluk: 8.5, fmDonem: 'takvim', fmYontem: 'sabit', fmUcret: 165 }, '2026-11': { gunluk: 8.5, fmDonem: 'hafta', fmYontem: 'sabit', fmUcret: 165 } } } };
  const aralik = (ak) => FD.fmDonemAraligi(ak, 'merkez');
  assert.deepEqual(aralik('2026-09'), { bas: '2026-09-07', son: '2026-10-04' }, 'Eylül haftalık: 7 Eyl – 4 Eki');
  assert.deepEqual(aralik('2026-10'), { bas: '2026-10-05', son: '2026-10-31' }, 'haftalık → takvim: Ekim 5 Ekim\'den başlar');
  assert.equal(aralik('2026-11').bas, '2026-11-01', 'takvim → haftalık: 1 Kasım yeni aya eklenir');
  assert.deepEqual(FD.fmHaftalari('2026-09', 'merkez'), ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
});

test('O-2 fazla mesai saat ücreti (fmSaatUcreti)', () => {
  const sabit = { fmYontem: 'sabit', fmUcret: 165 };
  assert.equal(PH.fmSaatUcreti(sabit, 99999, '2026-10'), 165);
  const maas = { fmYontem: 'maas' };
  assert.equal(PH.fmSaatUcreti(maas, 37000, '2026-09'), 137, 'Eylül 2026\'dan küsurat atılır');
  assert.ok(Math.abs(PH.fmSaatUcreti(maas, 37000, '2026-08') - 137.037037) < 1e-5, 'eski aylar kuruşlu');
  assert.equal(PH.fmSaatUcreti(maas, 0, '2026-09'), 0);
  assert.equal(PH.fmKisiUcreti(sabit, 37000, { fmOzel: 200, ak: '2026-10' }), 200, 'kişiye özel ücret');
});

test('O-1 maaşlı ödeme: hak, FM, devir, 5 TL yuvarlama (sagHesap)', () => {
  const sol = { maasBurada: true, hakGun: 30, gun: 30, fmSaat: 34, sekil: 'Tam', bayram: 0, calisilanSaat: 0 };
  const sb = { ...SUBE };
  const hes = (sag, devir = 0, net = 33000) => PH.sagHesap('p', sol, sag, net, sb, devir, {}, { tip: 'maas', ak: '2026-09' }, false);
  let r = hes({ bankaya: '33000', avans: '1233' });
  assert.equal(r.hak, 33000); assert.equal(r.maasFarki, 0); assert.equal(r.fmTl, 34 * 165);
  assert.ok(Math.abs(r.kalanHam - 4377) < 1e-9); assert.equal(r.kalan, 4375, '4377 → 4375 (5\'e yuvarlama)');
  r = hes({ bankaya: '33000', avans: '1233' }, -2500.5);
  assert.equal(r.devirAvans, 2500.5, 'eksi devir avans olarak düşer'); assert.equal(r.kalan, 1875, '1876,5 → 1875');
  r = hes({ bankaya: '33000' }, 1500);
  assert.equal(r.devirAvans, 0, 'artı kalan devretmez');
  r = PH.sagHesap('p', { ...sol, bayram: 2 }, { bankaya: '0' }, 30000, sb, 0, {}, { tip: 'maas' }, false);
  assert.equal(r.hak, 30000 * 32 / 30, 'bayramda çalışılan gün +1 gün ücret (G-6)');
});

test('P-11 TC ve IBAN doğrulama', () => {
  assert.equal(BD.tcGecerli('10000000146'), true);
  assert.equal(BD.tcGecerli('10000000147'), false);
  assert.equal(BD.tcGecerli('01234567890'), false, 'sıfırla başlayamaz');
  assert.equal(BD.ibanGecerli('TR330006100519786457841326'), true);
  assert.equal(BD.ibanGecerli('TR330006100519786457841327'), false);
  assert.equal(BD.bilgiCoz({ tip: 'tel' }, '5321234567').v, '05321234567');
  assert.ok(BD.bilgiCoz({ tip: 'tel' }, '123').hata);
});

test('S-1..S-5 saat kuralları', () => {
  assert.equal(Y.normTime('1130'), '11:30'); assert.equal(Y.normTime('9'), '09:00'); assert.equal(Y.normTime('24'), '00:00'); assert.equal(Y.normTime('25'), null);
  assert.equal(Y.shiftHours('18:00-02:30'), 8.5, 'gece vardiyası');
  assert.equal(Y.shiftHours('11:00-19:30'), 8.5);
  const sb = { ...SUBE };
  const gecmis = new Date(2020, 0, 1), gelecek = new Date(2099, 0, 1);
  assert.equal(SA.vardiyaKontrol('10:00-18:30', sb, gecmis).ok, true, 'geçmiş günde 1 saat pay');
  assert.equal(SA.vardiyaKontrol('10:00-18:30', sb, gelecek).ok, false, 'ileri tarihte pay yok');
  assert.equal(SA.vardiyaKontrol('11:00-19:30', sb, gelecek).ok, true);
  assert.equal(SA.vardiyaKontrol('11:15-19:30', sb, gecmis).ok, false, 'yarım saat olmalı');
  assert.equal(Y.shiftKind('11:00-19:30', sb).o, true, 'açılış vardiyası'); assert.equal(Y.shiftKind('16:00-00:30', sb).k, true, 'kapanış vardiyası');
  assert.equal(Y.shiftKind('13:00-21:00', sb).o, false);
});

test('yardımcılar: sayı, isim, tarih', () => {
  assert.equal(Y.sayi('28.075,50'), 28075.5); assert.equal(Y.sayi('50.000'), 50000); assert.equal(Y.sayi('8,5'), 8.5); assert.equal(Y.sayi(''), 0);
  assert.equal(Y.isimAnahtar('ÇELİK  Ayşe'), 'celik ayse'); assert.equal(Y.kisaAd('Ali Veli Yılmaz'), 'Ali Y.');
  assert.equal(Y.mondayOf(new Date(2026, 9, 14)), '2026-10-12'); assert.equal(Y.ayKaydir('2026-12', 1), '2027-01');
});
