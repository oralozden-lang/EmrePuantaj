// veri-girisi-bagla.js — app.js (v180) satırları 1797-1902. Otomatik bölündü; davranış değişmedi.
import { veriTur } from './sabitler.js';
import { S } from './durum.js';
import { esc, fmt, isimAnahtar, sayi, today, trTarih, ymd } from './yardimci.js';
import { otoKapi } from './puantaj-hesap.js';
import { kilitBaskasi, kilitMesaj } from './kilit.js';
import { tumSubeler } from './subeler.js';
import { byId, render } from './cerceve.js';
import { toast } from './panel.js';
import { kesinEngel } from './puantaj-veri.js';
import { kfBagla, kfDurum } from './kolon-filtre.js';
import { UI_veri_girisi, trTarihCoz, turCoz, veriKisileri, veriKontrol } from './veri-girisi.js';
import { bankaGonder, kalanYama, sagYama, veriFark, veriYaz, yeniSira } from './veri-kayit.js';
import { sagSonuclu } from './puantaj-islem.js';
import { adBuyuk } from './isim-esle.js';

export function veriGirisiBagla(V) {
  const ak = V.ak,
    sid = S.subeId;
  const kL = veriKisileri(V);
  const veri0 = () => (S.pt.doc && S.pt.doc.veri) || [];
  // Her değişiklik anında, sadece değişen satırlar yazılır.
  const ayarla = (yeni, ciz) => {
    if (kesinEngel()) {
      S.pt.zorla = true;
      render();
      return;
    }
    if (kilitBaskasi()) {
      toast(kilitMesaj());
      S.pt.zorla = true;
      render();
      return;
    }
    if (sid !== S.pt.sube || ak !== S.ay) {
      S.pt.zorla = true;
      render();
      return;
    }
    const eski = veri0();
    const fark = veriFark(eski, yeni);
    S.pt.doc = { ...(S.pt.doc || {}), veri: yeni };
    if (!Object.keys(fark.deg).length && !fark.sil.length) {
      if (ciz) {
        S.pt.zorla = true;
        render();
      }
      return;
    }
    Promise.resolve(veriYaz(sid, ak, fark, kalanYama(sid, ak, yeni))).then(ok => {
      if (ok !== false) bankaGonder(sid, ak, fark, eski);
    });
    if (ciz) {
      S.pt.zorla = true;
      render();
    }
  };
  const coz = v => {
    const k = veriKontrol(v, kL, ak, V.kilitli, V);
    return {
      ...v,
      pid:
        k.gecersiz &&
        k.hata !== 'Veri türü seçin' &&
        k.hata !== 'Muhasebe kilitli' &&
        k.hata !== 'Başka ay' &&
        k.hata !== 'Miktar yok'
          ? ''
          : k.pid,
      _k: k,
    };
  };
  const temiz = v => {
    const k = veriKontrol(v, kL, ak, V.kilitli, V);
    const o = { ...v, pid: k.gecersiz ? '' : k.pid, tur: v.tur || '' };
    if (k.gonder && !k.gecersiz) o.gonder = k.gonder;
    else delete o.gonder;
    return o;
  };
  // Güncellemeden önce girilmiş "Bankaya yatan" satırları (maaşı başka şubede): ekran açılınca bir kez işaretlenir ve maaş şubesine gönderilir.
  {
    const gk = sid + '|' + ak;
    S.pt.gonderGecis = S.pt.gonderGecis || {};
    if (!S.pt.gonderGecis[gk] && S.pt.doc && S.pt.doc.kesin !== true && !kilitBaskasi()) {
      const ids = new Set(
        veri0()
          .filter(v => {
            if (v.gonder || v.tur !== 'BY') return false;
            const k = veriKontrol(v, kL, ak, V.kilitli, V);
            return k.gonder && !k.gecersiz;
          })
          .map(v => v.id)
      );
      if (ids.size) {
        S.pt.gonderGecis[gk] = 1;
        setTimeout(() => {
          if (sid !== S.pt.sube || ak !== S.ay) return;
          ayarla(
            veri0().map(v => (ids.has(v.id) ? temiz(v) : v)),
            false
          );
        }, 400);
      }
    }
  }
  const yeniSatir = (o = {}) => {
    const son = veri0()[veri0().length - 1] || {};
    const bugun =
      ymd(today()).slice(0, 7) === ak ? ymd(today()) : ymd(new Date(+ak.slice(0, 4), +ak.slice(5), 0));
    return {
      id: Math.random().toString(36).slice(2, 10),
      sira: yeniSira(),
      tarih: son.tarih || bugun,
      ad: '',
      pid: '',
      tur: '',
      miktar: '',
      aciklama: '',
      kim: S.me.adSoyad || S.me.kullaniciAdi || '',
      zaman: new Date().toISOString(),
      ...o,
    };
  };
  const grid = byId('vGrid');
  const durumGuncelle = (tr, v) => {
    const k = veriKontrol(v, kL, ak, V.kilitli, V);
    tr.classList.toggle('hata', !!k.gecersiz);
    tr.querySelector('.dur').innerHTML = k.gecersiz
      ? `<span class="chip bad">${esc(k.hata)}</span>`
      : k.uyari
        ? `<span class="chip warn">${esc(k.uyari)}</span>`
        : k.gonder
          ? `<span class="chip ok">→ ${esc(k.gonderAd)} şubesine işlenir</span>`
          : '';
  };
  const hucreYaz = (v, c, val) => {
    if (c === 0) {
      const d = trTarihCoz(val);
      v.tarih = d || '';
      v._tarihYazi = d ? '' : val;
    } else if (c === 1) {
      v.ad = adBuyuk(val);
      v.pid = '';
    } else if (c === 2) {
      const t = veriTur(val) ? val : turCoz(val);
      v.tur = t || '';
      v.turYazi = t ? '' : val;
    } else if (c === 3) v.miktar = String(val).trim() === '' ? '' : sayi(val);
    else if (c === 4) v.aciklama = String(val).trim();
    return temiz(v);
  };
  // Hücreler çizelgedeki gibi: tıkla seç, sürükle / Shift ile aralık, çift tıkla (ya da Enter / F2 / yazmaya başla) düzenle.
  // Ctrl+C / Ctrl+V / Delete seçili hücrelerde çalışır; yapıştırma seçili hücreden başlar, seçim yoksa ilk boş satıra.
  const hucreEl = (r, c) => grid.querySelector(`tr[data-r="${r}"] [data-c="${c}"]`);
  const aralik = () => {
    const A = S.pt.vsel;
    if (!A) return null;
    return {
      r0: Math.min(A.r0, A.r1),
      r1: Math.max(A.r0, A.r1),
      c0: Math.min(A.c0, A.c1),
      c1: Math.max(A.c0, A.c1),
    };
  };
  const satirSay = () => grid.querySelectorAll('tr[data-vid]').length;
  const selCiz = () => {
    grid.querySelectorAll('td.vsel,td.vakt').forEach(t => t.classList.remove('vsel', 'vakt'));
    const A = aralik();
    if (!A) return;
    for (let r = A.r0; r <= A.r1; r++)
      for (let c = A.c0; c <= A.c1; c++) {
        const e = hucreEl(r, c);
        const t = e && e.closest('td');
        if (t) t.classList.add('vsel');
      }
    const a = hucreEl(S.pt.vsel.r1, S.pt.vsel.c1);
    if (a && a.closest('td')) a.closest('td').classList.add('vakt');
  };
  const sec = (r, c, uzat) => {
    const n = satirSay();
    if (!n) return;
    r = Math.max(0, Math.min(n - 1, r));
    c = Math.max(0, Math.min(4, c));
    S.pt.vsel = uzat && S.pt.vsel ? { ...S.pt.vsel, r1: r, c1: c } : { r0: r, c0: c, r1: r, c1: c };
    selCiz();
    const e = hucreEl(r, c);
    if (e && e.scrollIntoView) e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const duzenleniyor = () => {
    const a = document.activeElement;
    return !!(a && grid.contains(a) && a.matches('[data-c]') && (a.tagName === 'SELECT' || !a.readOnly));
  };
  const duzenle = (r, c, ilk) => {
    const el = hucreEl(r, c);
    if (!el || el.disabled) return;
    sec(r, c);
    if (el.tagName === 'SELECT') {
      el.focus();
      try {
        el.showPicker && el.showPicker();
      } catch (_) {}
      return;
    }
    el.readOnly = false;
    el.focus();
    if (ilk != null) {
      el.value = c === 1 ? ilk.toLocaleUpperCase('tr-TR') : ilk;
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch (_) {}
    } else {
      try {
        el.select();
      } catch (_) {}
    }
  };
  const bitir = el => {
    if (el.tagName !== 'SELECT') el.readOnly = true;
    grid.focus({ preventScroll: true });
  };
  grid.querySelectorAll('tr[data-vid]').forEach(tr => {
    const id = tr.dataset.vid;
    tr.querySelectorAll('[data-c]').forEach(el => {
      const c = +el.dataset.c;
      if (c === 1)
        el.oninput = () => {
          const a = el.selectionStart,
            b = el.selectionEnd;
          el.value = el.value.toLocaleUpperCase('tr-TR');
          try {
            el.setSelectionRange(a, b);
          } catch (_) {}
        };
      el.onchange = () => {
        const L = veri0().map(v => (v.id === id ? hucreYaz({ ...v }, c, el.value) : v));
        const v = L.find(x => x.id === id);
        if (c === 0 && v.tarih) el.value = trTarih(v.tarih);
        if (c === 3 && v.miktar !== '') el.value = fmt(v.miktar);
        durumGuncelle(tr, v);
        ayarla(L, false);
        if (el.tagName === 'SELECT') bitir(el);
      };
      el.onblur = () => {
        if (el.tagName !== 'SELECT') el.readOnly = true;
      };
      el.onkeydown = e => {
        if (el.tagName !== 'SELECT' && el.readOnly) return;
        const r = +tr.dataset.r;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          const v = veri0().find(x => x.id === id);
          if (v && el.tagName !== 'SELECT') {
            el.value =
              c === 0
                ? v.tarih
                  ? trTarih(v.tarih)
                  : ''
                : c === 1
                  ? v.ad != null
                    ? v.ad
                    : adBuyuk(adOf(v.pid))
                  : c === 3
                    ? v.miktar == null || v.miktar === ''
                      ? ''
                      : fmt(sayi(v.miktar))
                    : c === 4
                      ? v.aciklama || ''
                      : el.value;
          }
          bitir(el);
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          el.dispatchEvent(new Event('change'));
          bitir(el);
          sec(r, c + (e.shiftKey ? -1 : 1));
          return;
        }
        if (
          e.key === 'Enter' ||
          ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && el.tagName !== 'SELECT')
        ) {
          e.preventDefault();
          el.dispatchEvent(new Event('change'));
          bitir(el);
          const r2 = r + (e.key === 'ArrowUp' ? -1 : 1);
          if (r2 >= satirSay() && e.key === 'Enter') {
            S.pt.odak = { c, yeni: true };
            ayarla([...veri0(), yeniSatir()], true);
          } else sec(r2, c);
        }
      };
      el.onpaste = e => {
        if (el.tagName !== 'SELECT' && el.readOnly) return;
        const t = (e.clipboardData || window.clipboardData).getData('text');
        if (!/[\t\n]/.test(t.trim())) return;
        e.preventDefault();
        e.stopPropagation();
        bitir(el);
        yapistir(t, +tr.dataset.r, c);
      };
    });
  });
  const sutunlar = M => {
    // şube sütununu ve başlık satırını at
    if (M.length && M[0].some(x => /TAR[İI]H|ADI|VER[İI] T[ÜU]R|M[İI]KTAR/i.test(x))) M = M.slice(1);
    const sb = tumSubeler().map(([i, a]) => isimAnahtar(a));
    const w = Math.max(...M.map(r => r.length));
    const at = [];
    for (let j = 0; j < w; j++) {
      const col = M.map(r => r[j] || '').filter(x => x.trim());
      if (col.length && col.every(x => sb.includes(isimAnahtar(x)))) at.push(j);
    }
    return M.map(r => r.filter((x, j) => !at.includes(j)));
  };
  const vis = () => S.pt._vvis || veri0().map((v, i) => i);
  const yapistir = (t, r0, c0) => {
    let M = t.replace(/\r/g, '').split('\n');
    while (M.length && !M[M.length - 1].trim()) M.pop();
    M = sutunlar(M.map(x => x.split('\t')));
    if (!M.length) return;
    const L = veri0().slice();
    const VI = vis();
    const dok = [];
    M.forEach((row, i) => {
      const pos = r0 + i;
      let r = pos < VI.length ? VI[pos] : null;
      if (r == null) {
        L.push(yeniSatir());
        r = L.length - 1;
      }
      let v = { ...L[r] };
      row.forEach((val, j) => {
        const c = c0 + j;
        if (c <= 4) v = hucreYaz(v, c, val);
      });
      L[r] = v;
      dok.push(r);
    });
    const hata = dok.filter(r => veriKontrol(L[r], kL, ak, V.kilitli, V).gecersiz).length;
    ayarla(L, true);
    toast(`${M.length} satır yapıştırıldı${hata ? `, ${hata} satırda uyuşmazlık var (kırmızı)` : ''}.`);
  };
  byId('vSatir').onclick = () => {
    S.pt.odak = { c: 1 };
    ayarla([...veri0(), yeniSatir()], true);
  };
  byId('vSatir10').onclick = () => {
    const L = veri0().slice();
    for (let i = 0; i < 10; i++) L.push(yeniSatir());
    S.pt.odak = { c: 1, ilkBos: true };
    ayarla(L, true);
  };
  const ob = byId('vOto');
  if (ob)
    ob.onclick = () => {
      S.pt.otoAcik = !(S.pt.otoAcik ?? S.pt._otoBek > 0);
      render();
    };
  // Çizelgeden gelenlerin onayı: sag[pid].otoOnay.{fm|sa} = onaylanan saat (çizelge değişince eşleşmez, onay düşer)
  const otoYaz = L => {
    if (!otoKapi(V.ak, V.kilitli, V.kesin)) return;
    const deg = {};
    L.forEach(([pid, k, dr]) => {
      const x = V.satir.find(y => y.pid === pid);
      if (!x) return;
      const h = Math.round((k === 'fm' ? x.sol.fmSaat || 0 : x.sol.calisilanSaat || 0) * 100) / 100;
      const cur = ((V.D && V.D.sag) || {})[pid] || {};
      const d0 = deg[pid] || {};
      deg[pid] = {
        otoOnay: { ...(cur.otoOnay || {}), ...(d0.otoOnay || {}), [k]: dr === 'on' ? h : null },
        otoRed: { ...(cur.otoRed || {}), ...(d0.otoRed || {}), [k]: dr === 'red' ? h : null },
      };
    });
    if (!Object.keys(deg).length) return;
    const sag2 = sagSonuclu(V, deg);
    S.pt.doc = {
      ...(S.pt.doc || {}),
      sag: {
        ...((S.pt.doc && S.pt.doc.sag) || {}),
        ...Object.fromEntries(Object.keys(deg).map(p => [p, sag2[p]])),
      },
    };
    veriYaz(sid, ak, { deg: {}, sil: [] }, { sube: sid, ay: ak, sag: sagYama(sag2, Object.keys(deg)) });
    S.pt.zorla = true;
    render();
  };
  document.querySelectorAll('[data-oto]').forEach(
    c =>
      (c.onchange = () => {
        const [pid, k] = c.dataset.oto.split('|');
        otoYaz([[pid, k, c.value]]);
      })
  );
  const oh = byId('vOtoHepsi');
  if (oh)
    oh.onclick = () => {
      const L = [];
      V.satir.forEach(x => {
        const b = x.hes.otoBekle;
        if (!b) return;
        if (b.fm != null) L.push([x.pid, 'fm', 'on']);
        if (b.sa != null) L.push([x.pid, 'sa', 'on']);
      });
      otoYaz(L);
      toast(`${L.length} kalem onaylandı.`);
    };
  if (S.pt._vkf) kfBagla('veri', S.pt._vkf.cols, S.pt._vkf.rows);
  const kv = byId('kfHepsiV');
  if (kv)
    kv.onclick = () => {
      kfDurum('veri').f = {};
      kfDurum('veri').sort = null;
      S.pt.vsel = null;
      render();
    };
  document.querySelectorAll('[data-sil]').forEach(
    b =>
      (b.onclick = () => {
        const v = veri0().find(x => x.id === b.dataset.sil);
        const bos = v && veriKontrol(v, kL, ak, V.kilitli, V).bos;
        if (!bos && !b.dataset.ok) {
          b.dataset.ok = '1';
          b.textContent = 'Sil?';
          return;
        }
        ayarla(
          veri0().filter(x => x.id !== b.dataset.sil),
          true
        );
      })
  );
  // Fare: tıkla seç, sürükle / Shift+tıkla aralık, çift tıkla düzenle. Dokunmatik ekranda dokununca düzenler.
  let surukle = false,
    ptr = 'mouse';
  const konum = t => {
    const td = t.closest && t.closest('td.bi');
    const el = td && td.querySelector('[data-c]');
    const tr = td && td.closest('tr[data-r]');
    return el && tr ? { r: +tr.dataset.r, c: +el.dataset.c, el } : null;
  };
  grid.onpointerdown = e => {
    ptr = e.pointerType || 'mouse';
    const k = konum(e.target);
    if (!k || k.el.disabled) return;
    if (ptr !== 'mouse') return;
    if (e.button !== 0) return;
    if (document.activeElement === k.el && duzenleniyor()) return; // düzenlenen hücrenin içinde imleç / metin seçimi serbest
    e.preventDefault();
    const a = document.activeElement;
    if (a && grid.contains(a) && a !== grid) a.blur();
    grid.focus({ preventScroll: true });
    sec(k.r, k.c, e.shiftKey);
    surukle = true;
  };
  grid.onpointermove = e => {
    if (!surukle || ptr !== 'mouse' || !(e.buttons & 1)) return;
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const k = t && konum(t);
    if (k && S.pt.vsel && (k.r !== S.pt.vsel.r1 || k.c !== S.pt.vsel.c1)) sec(k.r, k.c, true);
  };
  grid.onpointerup = grid.onpointercancel = () => {
    surukle = false;
  };
  grid.ondblclick = e => {
    const k = konum(e.target);
    if (k && ptr === 'mouse') duzenle(k.r, k.c);
  };
  grid.onclick = e => {
    if (ptr === 'mouse') return;
    const k = konum(e.target);
    if (k) duzenle(k.r, k.c);
  };
  grid.querySelectorAll('select[data-c]').forEach(el =>
    el.addEventListener('mousedown', e => {
      if (ptr === 'mouse' && document.activeElement !== el) e.preventDefault();
    })
  );
  window.__vg = {
    aktif: () =>
      S.tab === 'puantaj' &&
      S.pt.gorunum === 'veri' &&
      !byId('sheetRoot').innerHTML &&
      byId('vGrid') === grid &&
      grid.isConnected,
    duzenleniyor,
    aralik,
    sec,
    duzenle,
    tsv: () => {
      const A = aralik();
      if (!A) return null;
      const R = [];
      for (let r = A.r0; r <= A.r1; r++) {
        const row = [];
        for (let c = A.c0; c <= A.c1; c++) {
          const x = hucreEl(r, c);
          row.push(x ? (x.tagName === 'SELECT' ? (x.value ? x.selectedOptions[0].text : '') : x.value) : '');
        }
        R.push(row.join('\t'));
      }
      return { t: R.join('\n'), n: (A.r1 - A.r0 + 1) * (A.c1 - A.c0 + 1) };
    },
    yapistir: t => {
      const A = aralik();
      const tek = !/[\t\n]/.test(t.replace(/[\r\n]+$/, ''));
      if (A) {
        if (tek && (A.r1 > A.r0 || A.c1 > A.c0)) {
          window.__vDoldur(t.replace(/[\r\n]+$/, ''), A);
          return;
        }
        yapistir(t, A.r0, A.c0);
        return;
      }
      if (tek) return;
      const L = veri0();
      const VI = vis();
      const bosP = VI.findIndex(i => L[i] && veriKontrol(L[i], kL, ak, V.kilitli, V).bos);
      yapistir(t, bosP >= 0 ? bosP : VI.length, 0);
    },
  };
  window.__vDoldur = (val, A) => {
    const L = veri0().slice();
    const VI = vis();
    let n = 0;
    for (let p = A.r0; p <= A.r1; p++) {
      const r = VI[p];
      if (r == null || !L[r]) continue;
      let v = { ...L[r] };
      for (let c = A.c0; c <= A.c1; c++) {
        if (c > 4) continue;
        v = hucreYaz(v, c, val);
        n++;
      }
      L[r] = v;
    }
    ayarla(L, true);
    toast(val === '' ? `${n} hücre temizlendi.` : `${n} hücreye yapıştırıldı.`);
  };
  if (!UI_veri_girisi.veriYapistirBagli) {
    UI_veri_girisi.veriYapistirBagli = true;
    document.addEventListener('copy', e => {
      const G = window.__vg;
      if (!G || !G.aktif() || G.duzenleniyor()) return;
      const x = G.tsv();
      if (!x) return;
      e.clipboardData.setData('text/plain', x.t);
      e.preventDefault();
      toast(`${x.n} hücre kopyalandı.`);
    });
    document.addEventListener('paste', e => {
      const G = window.__vg;
      if (!G || !G.aktif() || G.duzenleniyor()) return;
      const a = document.activeElement;
      if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && !(byId('vGrid') && byId('vGrid').contains(a)))
        return;
      const t = (e.clipboardData || window.clipboardData).getData('text');
      if (!t) return;
      e.preventDefault();
      G.yapistir(t);
    });
    document.addEventListener('keydown', e => {
      const G = window.__vg;
      if (!G || !G.aktif() || G.duzenleniyor()) return;
      const a = document.activeElement;
      if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && !(byId('vGrid') && byId('vGrid').contains(a)))
        return;
      const A = G.aralik();
      if (!A) return;
      const P = S.pt.vsel;
      if (e.key === 'Escape') {
        S.pt.vsel = null;
        G.sec &&
          byId('vGrid')
            .querySelectorAll('td.vsel,td.vakt')
            .forEach(t => t.classList.remove('vsel', 'vakt'));
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        window.__vDoldur('', A);
        return;
      }
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        G.duzenle(P.r1, P.c1);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        G.sec(P.r1, P.c1 + (e.shiftKey ? -1 : 1));
        return;
      }
      const yon = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (yon) {
        e.preventDefault();
        G.sec(P.r1 + yon[0], P.c1 + yon[1], e.shiftKey);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (P.c1 === 2) G.duzenle(P.r1, P.c1);
        else G.duzenle(P.r1, P.c1, e.key);
      }
    });
  }
  selCiz();
  // odak: yeni eklenen satırın hücresi seçilip düzenlemeye açılır
  if (S.pt.odak) {
    const o = S.pt.odak;
    S.pt.odak = null;
    const rows = [...grid.querySelectorAll('tr[data-vid]')];
    let tr = o.ilkBos
      ? rows.find(t => {
          const v = veri0().find(x => x.id === t.dataset.vid);
          return v && veriKontrol(v, kL, ak, V.kilitli, V).bos;
        })
      : rows[rows.length - 1];
    if (tr) duzenle(+tr.dataset.r, o.c);
  }
}

// Boş satırlar: sekme değişince, şubeden çıkınca ve sayfa açılınca silinir.
export function bosSatirMi(v) {
  return (
    !String(v.ad || '').trim() &&
    !v.pid &&
    !v.tur &&
    (v.miktar === '' || v.miktar == null) &&
    !String(v.aciklama || '').trim()
  );
}
// Sadece kendi açtığım ya da 1 saatten eski boş satırlar silinir (başkasının o an doldurduğu yeni satıra dokunulmaz).
export function veriBosTemizle() {
  const D = S.pt.doc;
  if (!D || D.kesin === true || !Array.isArray(D.veri) || !S.pt.sube || S.pt.sube !== S.subeId) return;
  const ben = (S.me && (S.me.adSoyad || S.me.kullaniciAdi)) || '';
  const silinir = v =>
    bosSatirMi(v) && (v.kim === ben || !v.zaman || Date.now() - Date.parse(v.zaman) > 3600000);
  const sil = D.veri.filter(silinir).map(v => v.id);
  if (!sil.length) return;
  const sid = S.pt.sube,
    ak = S.ay;
  if (kilitBaskasi()) return;
  S.pt.doc = { ...D, veri: D.veri.filter(v => !silinir(v)) };
  veriYaz(sid, ak, { deg: {}, sil });
}
