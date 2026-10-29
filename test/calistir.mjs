// Sahte Firebase ile uygulamayı gerçek tarayıcıda çalıştırır. Kullanım: node test/calistir.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { BUGUN, KULLANICILAR, eposta, tohum } from './seed.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

export function sunucu() {
  const s = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(KOK, u === '/' ? 'index.html' : u);
    if (!f.startsWith(KOK) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIP[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok({ s, port: s.address().port })));
}

// Sayfa: sahte Firebase + sabit saat. girisYapan: kullanıcı adı (giriş ekranını atlar)
export async function sayfaAc(browser, port, { girisYapan = null, genislik = 390, yukseklik = 844, belgeler = tohum(), yol = '/index.html', hazirlik = null, renkSemasi = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: genislik, height: yukseklik }, deviceScaleFactor: 2, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', colorScheme: renkSemasi });
  const page = await ctx.newPage();
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') hatalar.push('console: ' + m.text()); });
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.fulfill({ contentType: 'text/javascript', body: `export * from 'http://127.0.0.1:${port}/test/mock-firebase.js';` }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route(/cdn(js)?\.(cloudflare|jsdelivr)/, (r) => r.abort());
  const seed = { belgeler, kullanicilar: KULLANICILAR.map((k) => ({ eposta: eposta(k.kadi), uid: k.uid, sifre: k.sifre })), girisYapan: girisYapan ? eposta(girisYapan) : null };
  await page.addInitScript(({ bugun, seed }) => {
    // Saat donuk (sonuçlar her çalıştırmada aynı olsun), rastgelelik sabit tohumlu
    const Gercek = Date; const taban = new Gercek(bugun).getTime();
    const simdi = () => taban;
    class SahteTarih extends Gercek { constructor(...a) { if (a.length === 0) super(simdi()); else super(...a); } static now() { return simdi(); } }
    let t = 123456789;
    Math.random = () => { t |= 0; t = (t + 0x6d2b79f5) | 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
    globalThis.Date = SahteTarih; globalThis.__mockNow = simdi; globalThis.__SEED = seed;
  }, { bugun: BUGUN, seed });
  if (hazirlik) await hazirlik(page);
  await page.goto(`http://127.0.0.1:${port}${yol}`, { waitUntil: 'domcontentloaded' });
  return { ctx, page, hatalar };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { s, port } = await sunucu();
  const b = await chromium.launch();
  const { page, hatalar } = await sayfaAc(b, port, { girisYapan: 'admin' });
  await page.waitForSelector('.weeknav', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const cikis = process.argv[2] || '/tmp/claude-0/-home-user/32adee85-9bfa-5157-b45c-67f0da91ccde/scratchpad/emre-ilk.png';
  await page.screenshot({ path: cikis, fullPage: true });
  console.log('başlık:', await page.locator('h1').first().innerText(), '| hata sayısı:', hatalar.length);
  hatalar.slice(0, 8).forEach((h) => console.log(' ', h.slice(0, 200)));
  await b.close(); s.close();
}
