// cizelge-hucre.js — app.js (v180) satırları 836-898. Otomatik bölündü; davranış değişmedi.
import { AY, GRUP, GUNU, KOD, KOD_SIRA, gorevTahmin, kodStil, subeAdi } from './sabitler.js';
import { S, undo } from './durum.js';
import {
  addDays,
  bas,
  esc,
  fmt,
  isShift,
  isimAnahtar,
  kisaAd,
  parse,
  rangeLabel,
  shiftHours,
  shiftKind,
  weekDays,
  ymd,
} from './yardimci.js';
import { duzeltmeGunu, saatAraligi, saatKonum, saatListesi, saatYaz, vardiyaKontrol } from './saat.js';
import { cellOf, employed, sube } from './hesap.js';
import { cokSubeli, digerGunler, subedenCikti } from './cok-sube.js';
import { cizelgeKisileri, kadroDoc, kadroOf } from './kadro.js';
import { kilitEngel } from './kilit.js';
import { RED_NEDEN, hucreKontrol, setCell, setWeek } from './hucre-yazma.js';
import { byId } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { cizelgeYazabilir, degerYazi } from './cizelge.js';
import { satirKopyaMod } from './cizelge-secim.js';
import { subePersoneli } from './personel.js';
import { personelPanel } from './personel-panel.js';

export function hucre(pid, i, opt = {}) {
  if (kilitEngel()) return;
  const p = S.personel.find(x => x.id === pid);
  if (!p) return;
  const wid = S.hafta;
  const d = weekDays(wid)[i];
  const val = cellOf(pid, wid, i);
  const sb = sube();
  let [a, b] = isShift(val) ? val.split('-') : ['', ''];
  const pay = duzeltmeGunu(d);
  const L = saatListesi(sb, pay);
  const o = cokSubeli(p) ? digerGunler(p, d) : null;
  // Listede olmayan eski bir saat (ör. 11:15) seçili kalsın ama düzeltilmesi istensin.
  const secenek = (sec, yok) => {
    const grup = (t, f) => {
      const x = L.filter(f);
      return x.length
        ? `<optgroup label="${t}">${x.map(q => `<option value="${q.s}" ${q.s === sec ? 'selected' : ''}>${q.s}${q.pay === 'erken' ? ' · erken' : q.pay === 'gec' ? ' · geç' : ''}</option>`).join('')}</optgroup>`
        : '';
    };
    const disarda =
      sec && !L.some(q => q.s === sec)
        ? `<option value="${esc(sec)}" selected>${esc(sec)} · listede yok, düzeltin</option>`
        : '';
    return `<option value="" ${sec ? '' : 'selected'}>${yok}</option>${disarda}${pay ? grup('Erken çağrılma', q => q.pay === 'erken') : ''}${grup('Normal saatler', q => !q.pay)}${pay ? grup('Geç çıkış', q => q.pay === 'gec') : ''}`;
  };
  openSheet(
    `<h2>${esc(p.ad)}</h2><div class="sub">${GUNU[i]}, ${d.getDate()} ${AY[d.getMonth()]}${pay ? ' · düzeltme yapılabilir' : ' · plan'}</div>
   ${o ? `<div class="confirm">${esc(subeAdi(Object.keys(o)[0]))} şubesinde bu gün ${esc(degerYazi(Object.values(o)[0]))} yazılı. Bir kişi aynı gün tek şubede çalışır.</div>` : ''}
   <span class="lbl">Vardiya saati</span>
   <div class="times tsec"><label><small>Giriş</small><select id="tA" aria-label="Giriş saati">${secenek(a, 'Seçin')}</select></label><span>–</span><label><small>Çıkış</small><select id="tB" aria-label="Çıkış saati">${secenek(b, 'Seçin')}</select></label></div>
   <div class="meta" id="tMeta"></div><div class="row2"><button class="btn primary grow" id="tSave">Kaydet</button><button class="btn grow" id="tNext">Kaydet, sonraki gün</button></div>
   <p class="note" style="margin:6px 0 0">${pay ? `Bugün ve geçmiş günlerde ${saatYaz(saatAraligi(sb).n0 - 1)} – ${saatYaz(saatAraligi(sb).n1 + 1)} arası seçilebilir; turuncu işaretli saatler erken çağrılma / geç çıkıştır.` : `Plan: ${saatYaz(saatAraligi(sb).n0)} – ${saatYaz(saatAraligi(sb).n1)} arası. Erken çağrılma ve geç çıkış, gün geldiğinde düzeltme olarak yazılır.`}</p>
   <span class="lbl">Durum</span><div class="codes">${[...KOD_SIRA.filter(k => (k !== 'B' && k !== 'D') || val === k), ...(p.sekil === 'Part' || val === 'CG' ? ['CG'] : [])].map(k => `<button data-k="${k}" class="${val === k ? 'sel' : ''}" ${kodStil(k)}>${KOD[k].ad}</button>`).join('')}</div>
   <div class="codes" style="margin-top:8px;grid-template-columns:1fr"><button class="clear" data-k="">Hücreyi temizle</button></div>`,
    sh => {
      const A = byId('tA'),
        B = byId('tB'),
        M = byId('tMeta');
      const bitisSecenek = () => {
        const x = A.value;
        if (!x) return;
        const ar = saatAraligi(sb);
        const azami = Math.max(16, ar.n1 - ar.n0 + (pay ? 2 : 0));
        const ta = saatKonum(x, sb);
        [...B.options].forEach(op => {
          if (!op.value) return;
          let tb = saatKonum(op.value, sb);
          if (tb <= ta) tb += 24;
          op.disabled = tb <= ta || tb - ta > azami;
        });
        if (B.selectedOptions[0] && B.selectedOptions[0].disabled) B.value = '';
      };
      const upd = () => {
        const x = A.value,
          y = B.value;
        if (x && y) {
          const v = x + '-' + y;
          const k = shiftKind(v, sb);
          const vk = vardiyaKontrol(v, sb, d);
          M.innerHTML = vk.ok
            ? `<span>${fmt(shiftHours(v))} saat</span><span class="chip ${k.o || k.k ? 'warn' : 'mut'}">${k.o && k.k ? 'Açılış + kapanış' : k.o ? 'Açılış vardiyası' : k.k ? 'Kapanış vardiyası' : 'Ara vardiya'}</span>${vk.pay ? '<span class="chip warn">Erken / geç</span>' : ''}`
            : `<span class="chip bad">${esc(vk.neden)}</span>`;
        } else M.innerHTML = '';
      };
      A.onchange = () => {
        bitisSecenek();
        upd();
        if (!B.value) B.focus();
      };
      B.onchange = upd;
      bitisSecenek();
      const kaydet = async next => {
        const x = A.value,
          y = B.value;
        if (!x || !y) {
          toast('Giriş ve çıkış saatini seçin.');
          (x ? B : A).focus();
          return;
        }
        const v = x + '-' + y;
        const vk = vardiyaKontrol(v, sb, d);
        if (!vk.ok) {
          toast(vk.neden);
          return;
        }
        if (!hucreKontrol(p, wid, i, v)) return;
        setCell(pid, wid, i, v);
        if (next) sonraki(pid, i);
        else closeSheet();
      };
      byId('tSave').onclick = () => kaydet(false);
      byId('tNext').onclick = () => kaydet(true);
      sh.querySelectorAll('.codes button').forEach(
        bt =>
          (bt.onclick = () => {
            const k = bt.dataset.k || null;
            if (k && !hucreKontrol(p, wid, i, k)) return;
            setCell(pid, wid, i, k);
            closeSheet();
          })
      );
      upd();
    }
  );
}
export function sonraki(pid, i) {
  const p = S.personel.find(x => x.id === pid);
  const ds = weekDays(S.hafta);
  let j = i + 1;
  while (j < 7 && (!employed(p, ds[j]) || !cizelgeYazabilir(ds[j]))) j++;
  if (j < 7) hucre(pid, j);
  else {
    closeSheet();
    toast('Haftanın son günü kaydedildi.');
  }
}
export function geriAl() {
  const u = undo.pop();
  if (!u) return;
  setWeek(u.wid, u.cells, u.kadro, false);
  S.hafta = u.wid;
  toast('Son değişiklik geri alındı.');
}
export function kopyala() {
  const wid = S.hafta;
  const prev = ymd(addDays(parse(wid), -7));
  const pk = kadroDoc(prev);
  const src = (S.haftalar[prev] && S.haftalar[prev].cells) || {};
  if (!pk || !pk.length) {
    toast(`${rangeLabel(prev)} haftasında kopyalanacak liste yok.`);
    return;
  }
  const dolu = Object.values((S.haftalar[wid] && S.haftalar[wid].cells) || {}).some(
    o => o && Object.values(o).some(v => v)
  );
  openSheet(
    `<h2>Geçen haftayı kopyala</h2><div class="sub">${rangeLabel(prev)} haftasının listesi ve saatleri ${rangeLabel(wid)} haftasına yazılacak.</div>${dolu ? '<div class="confirm">Bu haftada girilmiş vardiyalar var, kopyalama üzerine yazar. "Geri al" ile dönebilirsiniz.</div>' : ''}
   <div class="row2"><button class="btn grow" id="cNo">Vazgeç</button><button class="btn primary grow" id="cYes">Kopyala</button></div>`,
    () => {
      byId('cNo').onclick = closeSheet;
      byId('cYes').onclick = () => {
        const ds = weekDays(wid);
        const out = JSON.parse(JSON.stringify((S.haftalar[wid] && S.haftalar[wid].cells) || {}));
        const kad = kadroOf(wid).ids.slice();
        pk.forEach(pid => {
          const p = S.personel.find(x => x.id === pid);
          if (!p || subedenCikti(p) || !ds.some(d => employed(p, d))) return;
          if (!kad.includes(pid)) kad.push(pid);
          const s = src[pid];
          if (!s) return;
          out[pid] = out[pid] || {};
          ds.forEach((d, i) => {
            if (employed(p, d) && cizelgeYazabilir(d) && s[String(i)] != null)
              out[pid][String(i)] = s[String(i)];
          });
        });
        const red = setWeek(wid, out, kad);
        closeSheet();
        toast(
          `Geçen haftanın listesi ve saatleri kopyalandı.${red ? ` ${red} hücre yazılmadı: ${RED_NEDEN}.` : ''}`
        );
      };
    }
  );
}
export function kadroEkle(pid) {
  const wid = S.hafta;
  const kad = kadroOf(wid).ids.slice();
  if (kad.includes(pid)) return;
  kad.push(pid);
  setWeek(wid, JSON.parse(JSON.stringify((S.haftalar[wid] && S.haftalar[wid].cells) || {})), kad);
}
export function kadroCikar(pid) {
  const wid = S.hafta;
  const kad = kadroOf(wid).ids.filter(x => x !== pid);
  const cells = JSON.parse(JSON.stringify((S.haftalar[wid] && S.haftalar[wid].cells) || {}));
  delete cells[pid];
  setWeek(wid, cells, kad);
}
export function kisiSec(g) {
  const wid = S.hafta;
  const ds = weekDays(wid);
  const var_ = new Set(kadroOf(wid).ids);
  const L = subePersoneli()
    .filter(p => (p.grup || 'K') === g && !var_.has(p.id) && ds.some(d => employed(p, d)))
    .sort((a, b) => String(a.ad).localeCompare(String(b.ad), 'tr'));
  const satir = p =>
    `<button class="row" data-id="${esc(p.id)}" data-ara="${esc(isimAnahtar(p.ad))}"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(gorevTahmin(p))}</span></div></button>`;
  openSheet(
    `<h2>${GRUP[g]} ekle · ${rangeLabel(wid)}</h2><div class="sub">${esc(sube().ad)} personel listesinden seçin. Başka şubeden gelen biri listede yoksa "Yeni personel oluştur" ile bu şubenin listesine ekleyin.</div>
   <label class="field"><span>Ara</span><input id="kAra" autocomplete="off" placeholder="İsim yazın"></label>
   <div class="card list" id="kList" style="margin-top:10px;max-height:46vh;overflow:auto">${L.map(satir).join('') || '<div class="note" style="padding:12px">Bu bölümde eklenebilecek kişi yok.</div>'}</div>
   <div class="row2"><button class="btn grow" id="kNo">Kapat</button><button class="btn grow" id="kYeni">+ Yeni personel oluştur</button></div>`,
    sh => {
      byId('kNo').onclick = closeSheet;
      byId('kYeni').onclick = () => personelPanel(null, g, { sonra: pid => kadroEkle(pid) });
      byId('kAra').oninput = e => {
        const q = isimAnahtar(e.target.value);
        sh.querySelectorAll('#kList .row').forEach(r => (r.hidden = !!q && !r.dataset.ara.includes(q)));
      };
      sh.querySelectorAll('#kList .row').forEach(
        r =>
          (r.onclick = () => {
            kadroEkle(r.dataset.id);
            r.remove();
            toast(`${kisaAd(S.personel.find(p => p.id === r.dataset.id).ad)} bu haftaya eklendi.`);
          })
      );
    }
  );
}
export function kadroTasi(pid, yon) {
  const wid = S.hafta;
  const ids = kadroOf(wid).ids.slice();
  const L = cizelgeKisileri(wid);
  const p = L.find(x => x.id === pid);
  if (!p) return false;
  const grup = L.filter(x => (x.grup || 'K') === (p.grup || 'K'));
  const k = grup.findIndex(x => x.id === pid);
  const hedef = grup[k + yon];
  if (!hedef) return false;
  const a = ids.indexOf(pid),
    b = ids.indexOf(hedef.id);
  [ids[a], ids[b]] = [ids[b], ids[a]];
  setWeek(wid, JSON.parse(JSON.stringify((S.haftalar[wid] && S.haftalar[wid].cells) || {})), ids);
  return true;
}
export function isimMenu(pid) {
  const p = S.personel.find(x => x.id === pid);
  if (!p) return;
  const dolu = Object.values(((S.haftalar[S.hafta] || {}).cells || {})[pid] || {}).some(v => v);
  const L = cizelgeKisileri(S.hafta).filter(x => (x.grup || 'K') === (p.grup || 'K'));
  const k = L.findIndex(x => x.id === pid);
  openSheet(
    `<h2>${esc(p.ad)}</h2><div class="sub">${rangeLabel(S.hafta)} · ${GRUP[p.grup || 'K']} bölümünde ${k + 1}. sırada</div>
   <div class="row2" style="margin-top:4px"><button class="btn grow" id="iUp" ${k <= 0 ? 'disabled' : ''}>▲ Yukarı taşı</button><button class="btn grow" id="iDn" ${k >= L.length - 1 ? 'disabled' : ''}>▼ Aşağı taşı</button></div>
   <div class="card list" style="margin-top:12px">
   <button class="row" id="iKop"><div class="m"><b>Haftasını kopyala</b><span>Sonra hedef kişinin adına dokunarak yapıştırın</span></div></button>
   <button class="row" id="iCik"><div class="m"><b style="color:var(--bad)">Bu haftadan çıkar</b><span>${dolu ? 'Bu haftaki saatleri de silinir. ' : ''}Personel listesinde kalır.</span></div></button></div>
   <p class="note">Görev, SGK şubesi ve tarihler Personel sekmesinden değiştirilir.</p>`,
    () => {
      byId('iUp').onclick = () => {
        if (kadroTasi(pid, -1)) isimMenu(pid);
      };
      byId('iDn').onclick = () => {
        if (kadroTasi(pid, 1)) isimMenu(pid);
      };
      byId('iKop').onclick = () => {
        closeSheet();
        satirKopyaMod(pid);
      };
      const c = byId('iCik');
      c.onclick = () => {
        if (dolu && !c.dataset.ok) {
          c.dataset.ok = '1';
          c.querySelector('b').textContent = 'Çıkarmayı onayla';
          return;
        }
        closeSheet();
        kadroCikar(pid);
        toast(`${kisaAd(p.ad)} bu haftadan çıkarıldı.`);
      };
    }
  );
}
