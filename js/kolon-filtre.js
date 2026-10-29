// kolon-filtre.js — app.js (v180) satırları 1633-1668. Otomatik bölündü; davranış değişmedi.
import { S } from './durum.js';
import { esc, isimAnahtar } from './yardimci.js';
import { byId, render } from './cerceve.js';

/* ================= Excel tarzı sütun filtresi ================= */
export const BOS_V = '(Boş)';
export function kfDurum(t) {
  const K = t === 'isc' ? (S.iscKf = S.iscKf || {}) : (S.pt.kf = S.pt.kf || {});
  return (K[t] = K[t] || { f: {}, sort: null });
}
export function kfDegerler(c, x) {
  const v = c.vals ? c.vals(x) : [c.v(x)];
  return v.map(y => (y == null || y === '' ? BOS_V : String(y)));
}
export function kfUygula(t, cols, rows) {
  const st = kfDurum(t);
  const hepsi = [];
  cols.forEach(c => {
    hepsi.push(c);
    if (c.ek) hepsi.push(c.ek);
  });
  let R = rows.filter(x =>
    hepsi.every(c => {
      const sel = st.f[c.k];
      if (!sel) return true;
      return kfDegerler(c, x).some(v => sel.includes(v));
    })
  );
  if (st.sort) {
    const c = hepsi.find(c => c.k === st.sort.k);
    if (c) {
      const key = c.n || (x => kfDegerler(c, x)[0]);
      R = R.slice().sort((a, b) => {
        const A = key(a),
          B = key(b);
        const r =
          typeof A === 'number' && typeof B === 'number' ? A - B : String(A).localeCompare(String(B), 'tr');
        return st.sort.d * r;
      });
    }
  }
  return R;
}
export function kfAktifMi(t) {
  const st = kfDurum(t);
  return Object.keys(st.f).length > 0;
}
export function kfBaslik(t, c, cls) {
  const st = kfDurum(t);
  const akt = !!st.f[c.k] || !!(c.ek && st.f[c.ek.k]);
  const so = st.sort && st.sort.k === c.k;
  return `<th class="${cls || ''}"><button class="kfb ${akt ? 'on' : ''}" data-kft="${t}" data-kfc="${c.k}" title="Filtrele / sırala">${c.ad}<i>${so ? (st.sort.d > 0 ? '▲' : '▼') : akt ? '⧩' : '▾'}</i></button></th>`;
}
export function kfBagla(t, cols, rows) {
  document.querySelectorAll(`.kfb[data-kft="${t}"]`).forEach(
    b =>
      (b.onclick = e => {
        e.stopPropagation();
        const c = cols.find(c => c.k === b.dataset.kfc);
        if (c) kfAc(t, c, rows, b);
      })
  );
}
export function kfAc(t, c, rows, btn) {
  kfKapat();
  const st = kfDurum(t);
  const pop = document.createElement('div');
  pop.className = 'kfpop';
  pop.id = 'kfPop';
  const bolum = (cc, ara) => {
    const say = {};
    const ord = {};
    rows.forEach(x =>
      kfDegerler(cc, x).forEach((v, i) => {
        say[v] = (say[v] || 0) + 1;
        if (ord[v] == null) ord[v] = cc.n ? cc.n(x) : v;
      })
    );
    const vals = Object.keys(say).sort((a, b) =>
      a === BOS_V
        ? 1
        : b === BOS_V
          ? -1
          : typeof ord[a] === 'number' && typeof ord[b] === 'number'
            ? ord[a] - ord[b]
            : String(a).localeCompare(String(b), 'tr')
    );
    const sel = st.f[cc.k];
    return `<div class="kfsec" data-k="${cc.k}">${cc.baslik ? `<div class="kft">${esc(cc.baslik)}</div>` : ''}${ara ? `<input class="kfara" placeholder="Ara">` : ''}
      <label class="kfrow kfall"><input type="checkbox" ${!sel ? 'checked' : ''}> (Tümünü seç)</label><div class="kflist">${vals.map(v => `<label class="kfrow" data-ara="${esc(isimAnahtar(v))}"><input type="checkbox" value="${esc(v)}" ${!sel || sel.includes(v) ? 'checked' : ''}> <span>${esc(v)}</span><em>${say[v]}</em></label>`).join('')}</div></div>`;
  };
  pop.innerHTML = `<button class="kfs" data-d="1">${c.n ? 'Küçükten büyüğe' : 'A → Z'} sırala</button><button class="kfs" data-d="-1">${c.n ? 'Büyükten küçüğe' : 'Z → A'} sırala</button>
    ${c.ek ? bolum({ ...c.ek, baslik: c.ek.ad }, false) : ''}${bolum({ ...c, baslik: c.ek ? c.ad : '' }, true)}
    <div class="kfbtns"><button class="btn small" id="kfTem">Filtreyi temizle</button><button class="btn small primary" id="kfOk">Tamam</button></div>`;
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  const w = Math.min(280, window.innerWidth - 16);
  pop.style.width = w + 'px';
  pop.style.left =
    Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - w - 8)) + 'px';
  pop.style.top = r.bottom + window.scrollY + 4 + 'px';
  pop.onclick = e => e.stopPropagation();
  pop.querySelectorAll('.kfsec').forEach(sec => {
    const all = sec.querySelector('.kfall input');
    const boxes = () => [...sec.querySelectorAll('.kflist input')];
    all.onchange = () =>
      boxes().forEach(b => {
        if (!b.closest('.kfrow').hidden) b.checked = all.checked;
      });
    sec.querySelectorAll('.kflist input').forEach(
      b =>
        (b.onchange = () => {
          all.checked = boxes().every(x => x.checked);
        })
    );
    const ara = sec.querySelector('.kfara');
    if (ara) {
      ara.oninput = () => {
        const q = isimAnahtar(ara.value);
        sec.querySelectorAll('.kflist .kfrow').forEach(l => (l.hidden = !!q && !l.dataset.ara.includes(q)));
      };
      setTimeout(() => ara.focus(), 0);
    }
  });
  pop.querySelectorAll('.kfs').forEach(
    b =>
      (b.onclick = () => {
        st.sort = { k: c.k, d: +b.dataset.d };
        S.pt.vDon = null;
        kfKapat();
        render();
      })
  );
  byId('kfTem').onclick = () => {
    delete st.f[c.k];
    if (c.ek) delete st.f[c.ek.k];
    if (st.sort && st.sort.k === c.k) st.sort = null;
    S.pt.vDon = null;
    kfKapat();
    render();
  };
  byId('kfOk').onclick = () => {
    pop.querySelectorAll('.kfsec').forEach(sec => {
      const k = sec.dataset.k;
      const boxes = [...sec.querySelectorAll('.kflist input')];
      const ara = sec.querySelector('.kfara');
      // Excel gibi: aramada sadece görünenler seçilir
      const secili = boxes
        .filter(b => b.checked && !(ara && ara.value && b.closest('.kfrow').hidden))
        .map(b => b.value);
      if (secili.length === boxes.length) delete st.f[k];
      else st.f[k] = secili;
    });
    S.pt.vsel = null;
    S.pt.vDon = null;
    kfKapat();
    render();
  };
  setTimeout(() => document.addEventListener('click', kfKapat, { once: true }), 0);
}
export function kfKapat() {
  const p = byId('kfPop');
  if (p) p.remove();
}
