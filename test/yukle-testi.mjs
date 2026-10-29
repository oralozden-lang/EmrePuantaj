// Yedekten yükleme aracı (araclar/yukle.html) testi. Kullanım: node test/yukle-testi.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { sunucu, sayfaAc } from './calistir.mjs';
import { tohum } from './seed.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// Yedek dosyası: tohum verisi + eski "veri" listeli puantaj + zaman damgası + yeni bir kullanıcı
const belgeler = tohum();
belgeler['puantaj/merkez/aylar/2026-09'] = { ...belgeler['puantaj/merkez/aylar/2026-09'], veriM: undefined, veri: [{ id: 'e1', tarih: '2026-09-03', pid: 'osman-celik', ad: 'OSMAN ÇELİK', tur: 'AV', miktar: '500' }, { tur: 'R', pid: 'can-yilmaz', miktar: '1', tarih: '2026-09-09' }] };
belgeler['puantaj/merkez/aylar/2026-09'].veriM = { v9: { id: 'v9', sira: 9, tarih: '2026-09-12', pid: 'ayse-demir', tur: 'AV', miktar: '10' } };
belgeler['personel/osman-celik'].ibanZaman = { __zaman: '2026-09-01T10:00:00.000Z' };
belgeler['kullanicilar/eski-uid-9'] = { kullaniciAdi: 'yeni.mudur', adSoyad: 'Yeni Müdür', rol: 'sube', subeler: ['sahil'], aktif: true };
belgeler['sifreler/u-sm'] = { sifre: 'gizli' }; // atlanmalı
belgeler['kilitler/cz__merkez__x'] = { uid: 'x' }; // atlanmalı
const yedek = { uygulama: 'puantaj-merkezi', yedekSurum: 1, tarih: '2026-10-14T10:00:00.000Z', belgeSayisi: Object.keys(belgeler).length, belgeler };

const ONCEKI = { 'kullanicilar/u-iv': { kullaniciAdi: 'admin', adSoyad: 'Test İşveren', rol: 'isveren', subeler: [], aktif: true }, 'sistem/kurulum': { uid: 'u-iv', tarih: 'ilk' } };
const { s, port } = await sunucu();
const b = await chromium.launch();
let ok = 0; const dogru = (m, f) => { f(); ok++; console.log('✓', m); };

// 1) Normal akış
{
  const { page, ctx, hatalar } = await sayfaAc(b, port, { belgeler: ONCEKI, yol: '/araclar/yukle.html' });
  await page.fill('#sifre', 'Test1234'); await page.click('#girisB');
  await page.waitForSelector('#adim2:not([hidden])');
  await page.setInputFiles('#dosya', { name: 'yedek.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(yedek)) });
  await page.waitForSelector('#secenekler:not([hidden])');
  await page.fill('#ortakSifre', 'Test1234'); await page.click('#yukleB');
  await page.waitForFunction(() => document.getElementById('sonuc').textContent.includes('Tamamlandı:'), null, { timeout: 20000 });
  const sonuc = await page.locator('#sonuc').innerText();
  const dok = await page.evaluate(() => globalThis.__mock.dok());
  console.log('  sonuç:', sonuc.replace(/\s+/g, ' ').slice(0, 200));
  dogru('personel ve şube belgeleri yazıldı', () => { assert.ok(dok['subeler/merkez']); assert.ok(dok['personel/osman-celik']); assert.ok(dok['subeler/merkez/haftalar/2026-10-12']); });
  dogru('eski "veri" listesi veriM\'e taşındı, "veri" yok', () => {
    const d = dok['puantaj/merkez/aylar/2026-09']; assert.equal(d.veri, undefined);
    assert.equal(d.veriM.e1.miktar, '500'); assert.equal(d.veriM.v9.miktar, '10'); assert.ok(d.veriM._e1, 'kimliksiz satır _e1 olarak');
    assert.equal(Object.keys(d.veriM).length, 3);
  });
  dogru('zaman damgası geri çevrildi', () => assert.equal(dok['personel/osman-celik'].ibanZaman._ms, Date.parse('2026-09-01T10:00:00.000Z')));
  dogru('kurulum belgesi ve işveren korundu', () => { assert.equal(dok['sistem/kurulum'].tarih, 'ilk'); assert.equal(dok['kullanicilar/u-iv'].kullaniciAdi, 'admin'); });
  dogru('şifre ve kilit kayıtları atlandı', () => { assert.equal(dok['sifreler/u-sm'], undefined); assert.equal(dok['kilitler/cz__merkez__x'], undefined); });
  dogru('kullanıcılar yeniden oluşturuldu (yeni + zaten var olan)', () => {
    const k = Object.entries(dok).filter(([y]) => y.startsWith('kullanicilar/')).map(([, v]) => v.kullaniciAdi).sort();
    assert.deepEqual(k, ['admin', 'bolge1', 'sube1', 'yeni.mudur']);
    assert.equal(Object.keys(dok).filter(([y]) => y === 'kullanicilar/eski-uid-9').length, 0, 'eski uid kullanılmadı');
  });
  dogru('sayfada hata yok', () => assert.equal(hatalar.filter((h) => !/ERR_FAILED/.test(h)).length, 0));
  await ctx.close();
}
// 1b) Hesap zaten var ama şifre farklı: anlaşılır hata, diğer işler tamam
{
  const { page, ctx } = await sayfaAc(b, port, { belgeler: ONCEKI, yol: '/araclar/yukle.html' });
  await page.fill('#sifre', 'Test1234'); await page.click('#girisB'); await page.waitForSelector('#adim2:not([hidden])');
  await page.setInputFiles('#dosya', { name: 'yedek.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(yedek)) });
  await page.waitForSelector('#secenekler:not([hidden])'); await page.fill('#ortakSifre', 'Baska9999'); await page.click('#yukleB');
  await page.waitForFunction(() => document.getElementById('sonuc').textContent.includes('Tamamlandı:'), null, { timeout: 20000 });
  const t = await page.locator('#sonuc').innerText();
  dogru('şifresi farklı hesaplar için anlaşılır hata', () => { assert.match(t, /bolge1 → hesap-var-sifre-farkli/); assert.match(t, /1\/3 kullanıcı/); });
  await ctx.close();
}
// 2) Yanlış proje: araç devre dışı kalmalı
{
  const { page, ctx } = await sayfaAc(b, port, { belgeler: ONCEKI, yol: '/araclar/yukle.html', hazirlik: async (p) => {
    await p.route(/\/config\.js/, (r) => r.fulfill({ contentType: 'text/javascript', body: 'export const firebaseConfig={projectId:"puantaj-merkezi"};export const GIRIS_ALANI="puantaj-merkezi.app";' }));
  } });
  await page.waitForSelector('#guvenlik:not([hidden])');
  const dis = await page.evaluate(() => [...document.querySelectorAll('button')].every((x) => x.disabled));
  dogru('canlı projede araç devre dışı', () => assert.equal(dis, true));
  await ctx.close();
}
await b.close(); s.close();
console.log(`\n${ok} kontrol geçti.`);
