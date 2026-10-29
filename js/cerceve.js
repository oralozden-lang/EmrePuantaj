// cerceve.js — app.js (v180) satırları 692-722. Otomatik bölündü; davranış değişmedi.
import { AYK, DURUM, ROL, aktifAy } from './sabitler.js';
import { S, tryLS } from './durum.js';
import { esc, gosterAy, today, ymd } from './yardimci.js';
import { isBolge, isIsveren, puantajYetki, rol } from './rol.js';
import { sube } from './hesap.js';
import { kilitBandi, kilitTakip, kilitUygula } from './kilit.js';
import { eskiSurumEkrani } from './oturum.js';
import { hesapPanel, subeSec } from './panel.js';
import { renderCizelge } from './cizelge.js';
import { renderPersonel } from './personel.js';
import { renderAy } from './ay-sonu.js';
import { puantajAc, renderPuantaj } from './puantaj.js';
import { veriBosTemizle } from './veri-girisi-bagla.js';
import { renderYonetim } from './yonetim.js';

/* ================= Çizim çerçevesi ================= */
export const byId = id => document.getElementById(id);
export function view(html, after) {
  const ap = document.querySelector('.app');
  if (ap)
    ap.classList.toggle(
      'wide',
      (S.tab === 'puantaj' && !!S.pt.sube) || ['cizelge', 'personel', 'ay'].includes(S.tab)
    );
  kilitTakip();
  byId('view').innerHTML = kilitBandi() + html;
  after && after();
  kilitUygula();
}
export function top(eyebrow, title, right = '') {
  byId('top').innerHTML =
    `<div class="top-row"><div class="grow"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>${right}</div>`;
}
export function sekmeler() {
  if (!S.me) return [];
  const t = [
    ['cizelge', 'Çizelge'],
    ['personel', 'Personel'],
  ];
  if (puantajYetki()) t.push(['puantaj', 'Puantaj']);
  if (isIsveren() || isBolge()) t.push(['yonetim', 'Yönetim']);
  return t;
}
export function renderTabs() {
  const t = sekmeler();
  if (!t.some(x => x[0] === S.tab)) S.tab = 'cizelge';
  const n = byId('tabs');
  n.hidden = false;
  byId('tabsIn').innerHTML = t
    .map(([k, a]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${a}</button>`)
    .join('');
  n.querySelectorAll('button').forEach(
    b =>
      (b.onclick = () => {
        if (S.tab === 'puantaj' && S.pt.sube) veriBosTemizle();
        S.tab = b.dataset.tab;
        tryLS('pm.tab', S.tab);
        if (S.tab === 'ay') S.ay = S.ay || gosterAy(S.hafta);
        if (S.tab === 'puantaj') {
          S.pt.sube = null;
          if (S.subeId && S.subeIds.includes(S.subeId)) {
            S.ay = aktifAy('puantaj');
            puantajAc(S.subeId);
          }
        }
        render();
        window.scrollTo(0, 0);
      })
  );
}
const OK_ASAGI =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
export function renderTop() {
  const sb = S.subeId ? sube() : null;
  const ak = S.tab === 'ay' ? aktifAy('ay') : gosterAy(S.hafta);
  const baslik = {
    cizelge: 'Haftalık çizelge',
    personel: 'Personel',
    ay: 'Ay sonu',
    puantaj: 'Puantaj',
    yonetim: 'Yönetim',
  }[S.tab];
  const d = S.aylar[ak];
  const chip =
    sb && S.tab !== 'puantaj' && S.tab !== 'yonetim'
      ? `<span class="chip on-navy">${AYK[+ak.slice(5) - 1]} · ${(DURUM[d && d.durum] || DURUM.taslak).ad}</span>`
      : '';
  const subeSekmesi = ['cizelge', 'personel', 'ay'].includes(S.tab);
  const coklu = S.subeIds.length > 1;
  const sol = subeSekmesi
    ? `<button class="sube-hap" id="subeBtn" aria-label="Şube seç">${sb ? esc(sb.ad) : 'Şube yok'}${coklu ? OK_ASAGI : ''}</button><h1 class="sr">${baslik}</h1>`
    : `<div class="top-baslik"><div class="eyebrow">${esc(ROL[rol()] + ' · ' + (S.me.adSoyad || S.me.kullaniciAdi))}</div><h1>${baslik}</h1></div>`;
  byId('top').innerHTML =
    `<div class="top-row">${sol}<span class="grow"></span>${chip}
   <button class="icon-btn yardim-btn ${document.body.classList.contains('yardim-acik') ? 'on' : ''}" id="yardimBtn" aria-label="Açıklamalar" title="Açıklamaları göster / gizle">?</button>
   <button class="icon-btn" id="hesapBtn" aria-label="Hesap"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg></button></div>`;
  const subeBtn = byId('subeBtn');
  if (subeBtn)
    subeBtn.onclick = () => {
      if (S.tab !== 'puantaj' && S.tab !== 'yonetim' && coklu) subeSec();
    };
  byId('hesapBtn').onclick = hesapPanel;
  byId('yardimBtn').onclick = () => {
    const a = !document.body.classList.contains('yardim-acik');
    document.body.classList.toggle('yardim-acik', a);
    tryLS('pm.yardim', a ? '1' : '0');
    renderTop();
  };
}
export function render() {
  if (!S.me || S.me.aktif !== true) return;
  if (S.eskiSurum) return eskiSurumEkrani();
  tryLS(
    'pm.gor',
    JSON.stringify({
      d: ymd(today()),
      hafta: S.hafta,
      ay: S.ay,
      ayElle: !!S.ayElle,
      tk: S.tkGorunum,
      pt: S.pt.sube || null,
    })
  );
  renderTabs();
  renderTop();
  if (S.ptGeri && S.tab === 'puantaj' && puantajYetki() && S.subeIds.includes(S.ptGeri)) {
    const id = S.ptGeri;
    S.ptGeri = null;
    S.ay = aktifAy('puantaj');
    return puantajAc(id);
  }
  if (S.kuralHata)
    return view(
      `<div class="banner bad">Personel listesi okunamadı. Firebase kuralları güncel değil. ${isIsveren() ? "Firestore → Rules sekmesine son firestore.rules dosyasını yapıştırıp Publish'e basın." : 'İşverene haber verin.'}</div>`
    );
  if (S.tab === 'yonetim') return renderYonetim();
  if (S.tab === 'puantaj') return renderPuantaj();
  if (!S.subeIds.length)
    return view(
      `<div class="empty-state"><b>Size atanmış şube yok</b>${isIsveren() ? 'Yönetim sekmesinden şube ekleyin.' : 'İşvereninizden şube ataması yapmasını isteyin.'}</div>`
    );
  if (!S.subeId) return;
  if (S.tab === 'personel') return renderPersonel();
  if (S.tab === 'ay') return renderAy();
  renderCizelge();
}
