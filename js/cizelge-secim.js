// cizelge-secim.js — app.js (v180) satırları 781-835. Otomatik bölündü; davranış değişmedi.
import { KOD } from './sabitler.js';
import { S } from './durum.js';
import { addDays, isShift, kisaAd, mondayOf, normTime, parse, today, weekDays, ymd } from './yardimci.js';
import { cellOf, employed } from './hesap.js';
import { kadroOf, rowPid } from './kadro.js';
import { RED_NEDEN, setCell, setWeek } from './hucre-yazma.js';
import { byId, render } from './cerceve.js';
import { toast } from './panel.js';
import { ROWS, UI_cizelge, cizelgeYazabilir } from './cizelge.js';
import { geriAl, hucre, isimMenu, kisiSec, kopyala } from './cizelge-hucre.js';
import { haftaIslemBagla } from './hafta-kapatma.js';
import { paylas } from './paylas.js';
import { XKOD } from './isim-esle.js';

export function bindWeek() {
  byId('prevW').onclick = () => {
    S.hafta = ymd(addDays(parse(S.hafta), -7));
    UI_cizelge.SEL = null;
    render();
  };
  byId('nextW').onclick = () => {
    S.hafta = ymd(addDays(parse(S.hafta), 7));
    UI_cizelge.SEL = null;
    render();
  };
  byId('thisW').onclick = () => {
    S.hafta = mondayOf(today());
    render();
  };
  const on = (id, f) => {
    const e = byId(id);
    if (e) e.onclick = f;
  };
  on('islemB', () => {
    const m = byId('islemMenu');
    if (!m) return;
    m.hidden = !m.hidden;
    byId('islemB').setAttribute('aria-expanded', String(!m.hidden));
  });
  const menu = byId('islemMenu');
  if (menu)
    menu.addEventListener('click', e => {
      if (e.target.closest('button')) menu.hidden = true;
    });
  on('copyW', kopyala);
  on('undoB', geriAl);
  on('shareB', paylas);
  haftaIslemBagla(S.hafta);
}
export function gridBagla() {
  const G = byId('grid');
  if (!G) return;
  G.oncontextmenu = e => {
    if (e.target.closest('.cell,.nm')) e.preventDefault();
  };
  G.onpointerdown = e => {
    UI_cizelge.ptrTip = e.pointerType || 'mouse';
    const c = e.target.closest('.cell[data-r]');
    const n = e.target.closest('[data-pe]');
    if (UI_cizelge.ptrTip === 'mouse') {
      if (c && e.button === 0) {
        e.preventDefault();
        const r = +c.dataset.r,
          cc = +c.dataset.c;
        if (e.shiftKey && UI_cizelge.SEL) Object.assign(UI_cizelge.SEL, { r1: r, c1: cc });
        else UI_cizelge.SEL = { wid: S.hafta, r0: r, c0: cc, r1: r, c1: cc };
        UI_cizelge.suruk = true;
        selCiz();
      }
      return;
    }
    UI_cizelge.lpOldu = false;
    clearTimeout(UI_cizelge.lpT);
    UI_cizelge.lpX = e.clientX;
    UI_cizelge.lpY = e.clientY;
    UI_cizelge.lpT = setTimeout(() => {
      UI_cizelge.lpOldu = true;
      if (navigator.vibrate)
        try {
          navigator.vibrate(15);
        } catch (_) {}
      if (c && c.dataset.p) hucreKopyaMod(c.dataset.p, +c.dataset.i);
      else if (n) satirKopyaMod(n.dataset.pe);
    }, 480);
  };
  G.onpointermove = e => {
    if (
      UI_cizelge.lpT &&
      (Math.abs(e.clientX - UI_cizelge.lpX) > 8 || Math.abs(e.clientY - UI_cizelge.lpY) > 8)
    )
      clearTimeout(UI_cizelge.lpT);
    if (UI_cizelge.suruk && UI_cizelge.ptrTip === 'mouse') {
      const c = document.elementFromPoint(e.clientX, e.clientY);
      const cc = c && c.closest && c.closest('.cell[data-r]');
      if (cc && UI_cizelge.SEL) {
        const r = +cc.dataset.r,
          k = +cc.dataset.c;
        if (r !== UI_cizelge.SEL.r1 || k !== UI_cizelge.SEL.c1) {
          UI_cizelge.SEL.r1 = r;
          UI_cizelge.SEL.c1 = k;
          selCiz();
        }
      }
    }
  };
  G.onpointerup = G.onpointercancel = () => clearTimeout(UI_cizelge.lpT);
  G.querySelectorAll('button.cell').forEach(b => {
    b.onclick = () => {
      if (UI_cizelge.lpOldu) {
        UI_cizelge.lpOldu = false;
        return;
      }
      if (UI_cizelge.ptrTip === 'mouse') return;
      if (UI_cizelge.MOD && UI_cizelge.MOD.tip === 'hucre') {
        setCell(b.dataset.p, S.hafta, +b.dataset.i, UI_cizelge.MOD.val);
        return;
      }
      hucre(b.dataset.p, +b.dataset.i);
    };
    b.ondblclick = () => {
      if (UI_cizelge.ptrTip === 'mouse') hucre(b.dataset.p, +b.dataset.i);
    };
  });
  G.querySelectorAll('button[data-pe]').forEach(
    b =>
      (b.onclick = () => {
        if (UI_cizelge.lpOldu) {
          UI_cizelge.lpOldu = false;
          return;
        }
        if (UI_cizelge.MOD && UI_cizelge.MOD.tip === 'satir') {
          satirYapistir(b.dataset.pe);
          return;
        }
        isimMenu(b.dataset.pe);
      })
  );
  G.querySelectorAll('.gadd').forEach(b => (b.onclick = () => kisiSec(b.dataset.g)));
}
document.addEventListener('pointerup', () => {
  UI_cizelge.suruk = false;
});
export function selAralik() {
  if (!UI_cizelge.SEL) return null;
  return {
    r0: Math.min(UI_cizelge.SEL.r0, UI_cizelge.SEL.r1),
    r1: Math.max(UI_cizelge.SEL.r0, UI_cizelge.SEL.r1),
    c0: Math.min(UI_cizelge.SEL.c0, UI_cizelge.SEL.c1),
    c1: Math.max(UI_cizelge.SEL.c0, UI_cizelge.SEL.c1),
  };
}
export function selCiz() {
  document.querySelectorAll('.cell.sel').forEach(x => x.classList.remove('sel'));
  const A = selAralik();
  if (!A || UI_cizelge.SEL.wid !== S.hafta) return;
  document.querySelectorAll('.cell[data-r]').forEach(x => {
    const r = +x.dataset.r,
      c = +x.dataset.c;
    if (r >= A.r0 && r <= A.r1 && c >= A.c0 && c <= A.c1) x.classList.add('sel');
  });
}
export function secimAktif() {
  if (S.tab !== 'cizelge' || !UI_cizelge.SEL || UI_cizelge.SEL.wid !== S.hafta || byId('sheetRoot').innerHTML)
    return false;
  const a = document.activeElement;
  return !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName));
}
export const KOD_EXCEL = {
  HT: 'HAF. İZİN',
  UI: 'ÜCR. İZİN',
  YI: 'YILLIK İZİN',
  R: 'RAPOR',
  B: 'BAYRAM',
  D: 'DİĞER',
  CG: 'ÇALIŞMA GÜNÜ DEĞİL',
};
export function secimTSV() {
  const A = selAralik();
  const out = [];
  for (let r = A.r0; r <= A.r1; r++) {
    const row = [];
    for (let c = A.c0; c <= A.c1; c++) {
      const v = cellOf(rowPid(ROWS[r], c), S.hafta, c);
      if (isShift(v)) row.push(...v.split('-'));
      else if (v && KOD[v]) row.push(KOD_EXCEL[v], '');
      else row.push('', '');
    }
    out.push(row.join('\t'));
  }
  return out.join('\r\n');
}
export function hucreCoz(a, b) {
  a = String(a ?? '').trim();
  b = String(b ?? '').trim();
  if (!a && !b) return null;
  const ust = a.toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
  if (XKOD[ust]) return XKOD[ust];
  const kn = Object.keys(KOD).find(k => KOD[k].ad.toLocaleUpperCase('tr-TR') === ust);
  if (kn) return kn;
  let m = a.match(/^(\d{1,2}[:.]?\d{0,2})\s*[-–]\s*(\d{1,2}[:.]?\d{0,2})$/);
  if (m && !b) {
    const x = normTime(m[1]),
      y = normTime(m[2]);
    return x && y ? x + '-' + y : undefined;
  }
  const x = normTime(a),
    y = normTime(b);
  return x && y ? x + '-' + y : undefined;
}
export function metinMatris(t) {
  let L = String(t || '')
    .replace(/\r/g, '')
    .split('\n');
  while (L.length && !L[L.length - 1].trim()) L.pop();
  return L.map(l => {
    let c = l.split('\t');
    if (c.length === 1) return [hucreCoz(c[0], '')];
    if (c.length % 2 === 1) {
      const ilk = hucreCoz(c[0], c[1]);
      if (ilk === undefined) c = c.slice(1);
      else c = c.concat(['']);
    }
    const o = [];
    for (let j = 0; j < c.length; j += 2) o.push(hucreCoz(c[j], c[j + 1]));
    return o;
  });
}
export function matrisUygula(M) {
  const A = selAralik();
  if (!A || !M.length) return;
  const wid = S.hafta;
  const ds = weekDays(wid);
  const cells = JSON.parse(JSON.stringify((S.haftalar[wid] && S.haftalar[wid].cells) || {}));
  let n = 0;
  const yaz = (r, c, v) => {
    if (v === undefined || r < 0 || r >= ROWS.length || c < 0 || c > 6) return;
    const pid = rowPid(ROWS[r], c);
    const p = S.personel.find(x => x.id === pid);
    if (!p || !employed(p, ds[c]) || !cizelgeYazabilir(ds[c])) return;
    cells[pid] = cells[pid] || {};
    cells[pid][String(c)] = v;
    n++;
  };
  if (M.length === 1 && M[0].length === 1 && (A.r1 > A.r0 || A.c1 > A.c0)) {
    for (let r = A.r0; r <= A.r1; r++) for (let c = A.c0; c <= A.c1; c++) yaz(r, c, M[0][0]);
  } else M.forEach((row, i) => row.forEach((v, j) => yaz(A.r0 + i, A.c0 + j, v)));
  if (!n) {
    toast('Yapıştırılacak uygun hücre yok.');
    return;
  }
  const red = setWeek(wid, cells, kadroOf(wid).ids);
  toast(`${n - red} hücre yapıştırıldı.${red ? ` ${red} hücre yazılmadı: ${RED_NEDEN}.` : ''}`);
}
export function secimTemizle() {
  matrisUygula([[null]]);
}
document.addEventListener('copy', e => {
  if (!secimAktif()) return;
  e.clipboardData.setData('text/plain', secimTSV());
  e.preventDefault();
  const A = selAralik();
  toast(`${(A.r1 - A.r0 + 1) * (A.c1 - A.c0 + 1)} hücre kopyalandı.`);
});
document.addEventListener('cut', e => {
  if (!secimAktif()) return;
  e.clipboardData.setData('text/plain', secimTSV());
  e.preventDefault();
  secimTemizle();
});
document.addEventListener('paste', e => {
  if (!secimAktif()) return;
  e.preventDefault();
  matrisUygula(metinMatris(e.clipboardData.getData('text/plain')));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (UI_cizelge.MOD || UI_cizelge.SEL) && !byId('sheetRoot').innerHTML) {
    UI_cizelge.MOD = null;
    UI_cizelge.SEL = null;
    render();
    return;
  }
  if (!secimAktif()) return;
  const A = selAralik();
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    secimTemizle();
    return;
  }
  if ((e.key === 'Enter' || e.key === 'F2') && ROWS[UI_cizelge.SEL.r0] != null) {
    e.preventDefault();
    hucre(rowPid(ROWS[UI_cizelge.SEL.r0], UI_cizelge.SEL.c0), UI_cizelge.SEL.c0);
    return;
  }
  if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && ROWS[UI_cizelge.SEL.r0] != null) {
    e.preventDefault();
    hucre(rowPid(ROWS[UI_cizelge.SEL.r0], UI_cizelge.SEL.c0), UI_cizelge.SEL.c0, { ilk: e.key });
    return;
  }
  const yon = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (yon) {
    e.preventDefault();
    const r = Math.max(0, Math.min(ROWS.length - 1, UI_cizelge.SEL.r1 + yon[0])),
      c = Math.max(0, Math.min(6, UI_cizelge.SEL.c1 + yon[1]));
    if (e.shiftKey) Object.assign(UI_cizelge.SEL, { r1: r, c1: c });
    else UI_cizelge.SEL = { wid: S.hafta, r0: r, c0: c, r1: r, c1: c };
    selCiz();
  }
});
export function hucreKopyaMod(pid, i) {
  const v = cellOf(pid, S.hafta, i);
  if (!v) {
    toast('Boş hücre kopyalanamaz.');
    return;
  }
  UI_cizelge.MOD = { tip: 'hucre', val: v };
  render();
}
export function satirKopyaMod(pid) {
  const c = (S.haftalar[S.hafta] && S.haftalar[S.hafta].cells && S.haftalar[S.hafta].cells[pid]) || {};
  if (!Object.values(c).some(v => v)) {
    toast('Bu kişinin haftası boş.');
    return;
  }
  UI_cizelge.MOD = { tip: 'satir', pid, gun: { ...c } };
  render();
}
export function satirYapistir(pid) {
  if (pid === UI_cizelge.MOD.pid) return;
  const wid = S.hafta;
  const ds = weekDays(wid);
  const p = S.personel.find(x => x.id === pid);
  const cells = JSON.parse(JSON.stringify((S.haftalar[wid] && S.haftalar[wid].cells) || {}));
  cells[pid] = cells[pid] || {};
  ds.forEach((d, i) => {
    if (employed(p, d) && cizelgeYazabilir(d)) cells[pid][String(i)] = UI_cizelge.MOD.gun[String(i)] ?? null;
  });
  const red = setWeek(wid, cells, kadroOf(wid).ids);
  toast(`${kisaAd(p.ad)} için yapıştırıldı.${red ? ` ${red} gün yazılmadı: ${RED_NEDEN}.` : ''}`);
}
