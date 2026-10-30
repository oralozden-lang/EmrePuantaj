// hafta-kapatma.js — app.js (v180) satırları 899-943. Otomatik bölündü; davranış değişmedi.
import { doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { AY, AYK, BASLANGIC_AY, GUNU, kesinAy } from './sabitler.js';
import { db } from './firebase.js';
import { S } from './durum.js';
import { addDays, ayKey, esc, mondayOf, parse, rangeLabel, today, weekDays, ymd } from './yardimci.js';
import { isIsveren, isSube, puantajYetki } from './rol.js';
import { sube } from './hesap.js';
import { kadroDoc } from './kadro.js';
import { gerekliSube } from './yazma.js';
import { haftaDurumu } from './hucre-yazma.js';
import { byId, render } from './cerceve.js';
import { closeSheet, openSheet } from './panel.js';
import { UI_cizelge } from './cizelge.js';
import { haftaKapatPanel } from './hafta-kontrol.js';
import { haftaGeriPanel, haftaKilidiAc, haftaOnayPanel } from './hafta-islem.js';

/* ================= Haftalık kapatma =================
   Hafta bitince şube müdürü 2 gün içinde kontrol edip kapatır → bölge müdürünün onayına gider. Kapatılan haftayı şube müdürü göremez.
   Bölge müdürü (kendi şubeleri) ve işveren: kapatır, onaylar, notla geri gönderir, kilidi açar. Her işlem haftanın kaydına yazılır. */
export const KAPATMA_GUN = 2;
export const durumRef = sid => doc(db, 'subeler', gerekliSube(sid), 'durum', 'haftalar');
export const benAd = () => (S.me && (S.me.adSoyad || S.me.kullaniciAdi)) || '';
export function haftaPazar(wid) {
  return addDays(parse(wid), 6);
}
// Hafta pazar gününden itibaren kapatılabilir (pazar günü diğer haftanın eksikleri düzeltilir); son gün KAPATMA_GUN ile aynı kalır.
export function haftaBitti(wid) {
  return ymd(today()) >= ymd(haftaPazar(wid));
}
export function haftaPazarBugun(wid) {
  return ymd(today()) === ymd(haftaPazar(wid));
}
export function haftaSonGun(wid) {
  return addDays(haftaPazar(wid), KAPATMA_GUN);
}
export function haftaGecikti(wid) {
  return ymd(today()) > ymd(haftaSonGun(wid));
}
export function haftaAylari(wid) {
  return [...new Set(weekDays(wid).map(ayKey))];
}
export const gunAdi = d => `${d.getDate()} ${AY[d.getMonth()]} ${GUNU[(d.getDay() + 6) % 7]}`;
export const tarihSaat = t => {
  if (!t) return '';
  const d = new Date(t);
  return `${d.getDate()} ${AYK[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export function haftaDolu(wid, H = S.haftalar) {
  const k = (H[wid] && kadroDoc(wid, H)) || [];
  return k.length > 0;
}
// Şube müdürüne: kapatılmamış ve süresi dolmak üzere / dolmuş haftalar
export function acikBitenHaftalar() {
  const L = [];
  let w = parse(mondayOf(today()));
  for (let i = 1; i <= 8; i++) {
    const wid = ymd(addDays(w, -7 * i));
    if (wid < BASLANGIC_AY + '-01') break;
    if (haftaDolu(wid) && haftaDurumu(wid) === 'acik' && haftaBitti(wid)) L.push(wid);
  }
  return L.reverse();
}
export function haftaBandi(wid) {
  const hd = haftaDurumu(wid);
  const w = S.haftalar[wid] || {};
  const dw = (S.haftaDurum.w || {})[wid] || {};
  let h = '';
  if (isSube()) {
    const L = acikBitenHaftalar().filter(x => x !== wid);
    if (L.length)
      h += `<div class="banner ${L.some(haftaGecikti) ? 'bad' : ''}">Kapatılmamış ${L.length > 1 ? L.length + ' hafta' : 'hafta'}: ${L.map(x => `<button class="hgit" data-gitw="${x}">${rangeLabel(x)}${haftaGecikti(x) ? ' · gecikti' : ''}</button>`).join(' ')}</div>`;
  }
  if (hd === 'acik') {
    if (w.geriNot)
      h += `<div class="banner bad">Bölge müdürü bu haftayı geri gönderdi: "${esc(w.geriNot)}". Düzeltip yeniden kapatın.</div>`;
    if (haftaBitti(wid) && haftaDolu(wid)) {
      const son = haftaSonGun(wid);
      h += haftaGecikti(wid)
        ? `<div class="banner bad">Bu hafta ${gunAdi(son)} gününe kadar kapatılmalıydı, gecikti.</div>`
        : haftaPazarBugun(wid)
          ? `<div class="banner">Bugün haftanın son günü. Pazar vardiyasının çıkış saatleri henüz bitmemiş olabilir; kapatmadan önce pazar saatlerini kontrol edin. Kapattıktan sonra düzeltme için bölge müdürünün kilidi açması gerekir. En geç ${gunAdi(son)} günü kapatın.</div>`
          : `<div class="banner">Hafta bitti. Kontrol edip en geç ${gunAdi(son)} günü kapatın.</div>`;
    }
  } else if (!isSube()) {
    const ad = w.kapatanAd || dw.ad || '';
    const t = w.kapatma || dw.t;
    h +=
      hd === 'kapali'
        ? `<div class="banner">Hafta kapatıldı${ad ? ' · ' + esc(ad) : ''}${t ? ' · ' + tarihSaat(t) : ''}. Onayınızı bekliyor. Düzenlemek için önce "Kilidi aç"a basın.</div>`
        : `<div class="banner ok">Hafta onaylandı${w.onaylayanAd ? ' · ' + esc(w.onaylayanAd) : ''}${w.onayTarihi ? ' · ' + tarihSaat(w.onayTarihi) : ''}. Düzenlemek için önce "Kilidi aç"a basın.</div>`;
  }
  return h;
}
export function kapaliHaftaKart(wid) {
  const dw = (S.haftaDurum.w || {})[wid] || {};
  return `<div class="empty-state kapali-kart"><b>Bu hafta kapatıldı</b>${dw.ad ? esc(dw.ad) + ' · ' : ''}${dw.t ? tarihSaat(dw.t) : ''}<br>${dw.d === 'onay' ? 'Bölge müdürü onayladı.' : 'Bölge müdürünün onayında.'} Kapatılan haftalar görüntülenemez.<br>Düzeltme gerekiyorsa bölge müdürünüzden haftanın kilidini açmasını isteyin.</div>`;
}
export function haftaIslemleri(wid) {
  const hd = haftaDurumu(wid);
  let b = '';
  if (weekDays(wid).some(kesinAy)) return '';
  if (hd === 'acik' && haftaBitti(wid) && haftaDolu(wid)) {
    b += `<button class="btn primary grow" id="hKap">${isSube() ? 'Haftayı kapat → bölge müdürüne gönder' : 'Haftayı kapat'}</button>`;
    if (puantajYetki()) b += `<button class="btn grow" id="hKapOn">Kapat ve onayla</button>`;
  }
  if (puantajYetki()) {
    if (hd === 'kapali')
      b += `<button class="btn primary grow" id="hOn">Onayla</button><button class="btn danger grow" id="hGeri">Geri gönder</button>`;
    if (hd !== 'acik') b += `<button class="btn grow" id="hKilit">Kilidi aç</button>`;
    const kay = (S.haftalar[wid] || {}).kayit;
    if (kay && kay.length) b += `<button class="btn" id="hKay">Kayıt</button>`;
  }
  return b ? `<div class="actions hafta-is">${b}</div>` : '';
}
export function haftaIslemBagla(wid) {
  const on = (id, f) => {
    const e = byId(id);
    if (e) e.onclick = f;
  };
  document.querySelectorAll('[data-gitw]').forEach(
    x =>
      (x.onclick = () => {
        S.hafta = x.dataset.gitw;
        UI_cizelge.SEL = null;
        render();
        window.scrollTo(0, 0);
      })
  );
  on('hKap', () => haftaKapatPanel(wid, false));
  on('hKapOn', () => haftaKapatPanel(wid, true));
  on('hOn', () => haftaOnayPanel(wid));
  on('hGeri', () => haftaGeriPanel(wid));
  on('hKilit', () => {
    const e = byId('hKilit');
    if (!e.dataset.ok) {
      e.dataset.ok = '1';
      e.textContent = 'Kilidi açmayı onayla';
      return;
    }
    haftaKilidiAc(wid);
  });
  on('hKay', () => haftaKayitPanel(wid));
}
export function haftaKayitPanel(wid, H = S.haftalar) {
  const kay = ((H[wid] || {}).kayit || []).slice().sort((a, b) => String(b.t).localeCompare(String(a.t)));
  openSheet(
    `<h2>Hafta kaydı</h2><div class="sub">${esc(sube().ad)} · ${rangeLabel(wid)}</div><div class="card list">${kay.map(k => `<div class="row"><div class="m"><b>${esc(k.i)}</b><span>${esc(k.ad || '')} · ${tarihSaat(k.t)}${k.not ? ' · "' + esc(k.not) + '"' : ''}</span></div></div>`).join('') || '<div class="note" style="padding:12px">Kayıt yok.</div>'}</div><div class="row2"><button class="btn grow" id="kyK">Kapat</button></div>`,
    () => (byId('kyK').onclick = closeSheet)
  );
}
