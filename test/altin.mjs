// Altın kayıt: senaryoları çalıştırır, ekran içeriğini ve yazılan Firestore belgelerini kaydeder / karşılaştırır.
//   node test/altin.mjs --kaydet        → test/altin/*.json yazar
//   node test/altin.mjs                 → kayıtla karşılaştırır, fark varsa çıkış kodu 1
//   node test/altin.mjs ad1 ad2         → yalnızca bu senaryolar
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { sunucu, sayfaAc } from './calistir.mjs';
import { tohum } from './seed.mjs';
import { SENARYOLAR } from './senaryolar.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'altin');
const kaydet = process.argv.includes('--kaydet');
const sadeceVeri = process.argv.includes('--sadece-veri');
const secili = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const sade = (h) => h.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
async function ekranAl(page) {
  return page.evaluate(() => {
    const al = (id) => { const e = document.getElementById(id); return e ? e.innerHTML : ''; };
    return { top: al('top'), view: al('view'), tabs: al('tabs'), sheet: al('sheetRoot'), toast: al('toastRoot') };
  }).then((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, sade(v)])));
}
async function farkDok(page, baslangic) {
  const son = await page.evaluate(() => globalThis.__mock.dok());
  const fark = {};
  for (const y of new Set([...Object.keys(baslangic), ...Object.keys(son)])) {
    if (JSON.stringify(baslangic[y]) !== JSON.stringify(son[y])) fark[y] = son[y] === undefined ? '(silindi)' : son[y];
  }
  return fark;
}

const { s, port } = await sunucu();
const b = await chromium.launch();
fs.mkdirSync(DIR, { recursive: true });
let bozuk = 0, toplam = 0;
for (const sen of SENARYOLAR) {
  if (secili.length && !secili.includes(sen.ad)) continue;
  toplam++;
  const { ctx, page, hatalar } = await sayfaAc(b, port, { girisYapan: sen.girisYapan });
  const ekranlar = {}; let hata = '';
  const baslangic = JSON.parse(JSON.stringify(tohum()));
  const k = async (etiket) => { ekranlar[etiket] = await ekranAl(page); };
  try {
    if (sen.girisYapan) await page.waitForSelector('#tabsIn button, .weeknav, .banner', { timeout: 15000 });
    await page.waitForTimeout(1200);
    await sen.adim(page, k);
    await page.waitForTimeout(500);
  } catch (e) { hata = String(e.message).split('\n')[0]; }
  ekranlar.son = await ekranAl(page);
  const dok = await farkDok(page, baslangic).catch(() => ({}));
  const sonuc = { ad: sen.ad, hata, ekranlar, yazilanBelgeler: dok, konsolHatalari: hatalar.filter((h) => !/ERR_FAILED/.test(h)) };
  await ctx.close();
  const dosya = path.join(DIR, sen.ad + '.json');
  if (kaydet) { fs.writeFileSync(dosya, JSON.stringify(sonuc, null, 1)); console.log(`${hata ? '⚠️ ' : '✓ '} kaydedildi: ${sen.ad}${hata ? '  HATA: ' + hata : ''}${sonuc.konsolHatalari.length ? '  konsol: ' + sonuc.konsolHatalari[0].slice(0, 100) : ''}`); if (hata) bozuk++; continue; }
  if (!fs.existsSync(dosya)) { console.log(`✗ kayıt yok: ${sen.ad}`); bozuk++; continue; }
  const eski = JSON.parse(fs.readFileSync(dosya, 'utf-8'));
  const farklar = [];
  if (eski.hata !== sonuc.hata) farklar.push(`hata: "${eski.hata}" → "${sonuc.hata}"`);
  if (!sadeceVeri) for (const et of new Set([...Object.keys(eski.ekranlar), ...Object.keys(sonuc.ekranlar)])) {
    for (const bol of ['top', 'view', 'tabs', 'sheet', 'toast']) {
      const a = (eski.ekranlar[et] || {})[bol], c = (sonuc.ekranlar[et] || {})[bol];
      if (a !== c) farklar.push(`ekran[${et}].${bol} farklı`);
    }
  }
  if (JSON.stringify(eski.yazilanBelgeler) !== JSON.stringify(sonuc.yazilanBelgeler)) farklar.push('yazılan belgeler farklı');
  if (JSON.stringify(eski.konsolHatalari) !== JSON.stringify(sonuc.konsolHatalari)) farklar.push('konsol hataları farklı');
  if (farklar.length) { bozuk++; console.log(`✗ ${sen.ad}\n   ` + farklar.join('\n   ')); } else console.log(`✓ ${sen.ad}`);
}
await b.close(); s.close();
console.log(kaydet ? `\n${toplam} senaryo kaydedildi${bozuk ? `, ${bozuk} tanesinde hata var` : ''}.` : `\n${toplam - bozuk}/${toplam} senaryo aynı.`);
process.exit(bozuk ? 1 : 0);
