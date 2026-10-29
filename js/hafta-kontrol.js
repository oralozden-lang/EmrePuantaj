// hafta-kontrol.js — app.js (v180) satırları 944-984. Otomatik bölündü; davranış değişmedi.
import { AYK, GUN, KOD } from './sabitler.js';
import { arka, setDoc } from './firebase.js';
import { S } from './durum.js';
import { ayKey, esc, fmt, kisaAd, rangeLabel, sg, trTarih, weekDays, ymd } from './yardimci.js';
import { isSube } from './rol.js';
import { aktifHaftada, cellOf, haftaYedi, ilkGun, isEsnaf, weekHasEntry } from './hesap.js';
import { bosSayilir, cokSubeli, digerGunler, gunleriYukle } from './cok-sube.js';
import { CZ_ES, cizelgeKisileri, gunKaydiP, haftaHesapS, kadroOf } from './kadro.js';
import { ayniKisi } from './ay-ozet.js';
import { sirayla, weekRef, yazmaHatasi } from './yazma.js';
import { haftaAyari, hdAlani } from './hucre-yazma.js';
import { byId } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { cizelgeYazabilir } from './cizelge.js';
import { haftaAylari, haftaPazar } from './hafta-kapatma.js';
import { haftayiKapat } from './hafta-islem.js';
import { subePersoneli } from './personel.js';

// Haftanın kontrolü: boş günler ve 7 gün teyidi kapatmayı engeller; eksi fazla mesai ve izinler bilgi için.
export function haftaKontrol(wid) {
  const sb = haftaAyari(wid);
  const ds = weekDays(wid);
  const t7 = (S.haftalar[wid] || {}).teyit7 || {};
  const K = { bos: [], yedi: [], eksi: [], izin: [], izinG: [], gc: [], yok: [] };
  cizelgeKisileri(wid).forEach(p => {
    const L = CZ_ES[p.id] || [p];
    ds.forEach((d, i) => {
      const q = gunKaydiP(p, d);
      if (!q) return;
      const v = cellOf(q.id, wid, i);
      if (
        (v == null || v === '') &&
        (weekHasEntry(q.id, wid) || !isEsnaf(q)) &&
        bosSayilir(q, d) &&
        cizelgeYazabilir(d)
      )
        K.bos.push({ p, d }); // satırı tamamen boş kişi de (esnaf hariç) boş gün sayılır
      if (v && ['R', 'UI', 'YI'].includes(v)) K.izin.push({ p, d, v });
    });
    L.forEach(q => {
      const y = weekHasEntry(q.id, wid) ? haftaYedi(q, wid) : { yedi: false };
      if (y.yedi && y.sube === S.subeId) K.yedi.push({ p: q, ok: !!t7[q.id] });
    });
    if (!isEsnaf(p) && p.sekil !== 'Part') {
      const x = haftaHesapS(p, wid, sb);
      if (x.fm < -0.004) K.eksi.push({ p, fm: x.fm });
    }
    // Giriş / çıkış: SGK tarihi bu haftaya düşenler ve çizelgede ilk / son çalıştığı gün
    const w0 = ymd(ds[0]),
      w6 = ymd(ds[6]);
    L.forEach(q => {
      const calGun = i => {
        const v = cellOf(q.id, wid, i);
        return v && !KOD[v];
      };
      const gi =
        q.giris && q.giris >= w0 && q.giris <= w6
          ? q.giris
          : ilkGun(q) && ilkGun(q) >= w0 && ilkGun(q) <= w6
            ? ilkGun(q)
            : null;
      if (gi) {
        const i = ds.findIndex((d, j) => calGun(j));
        K.gc.push({
          p: q,
          key: 'giris|' + q.id,
          tur: 'Giriş',
          t: gi,
          sgk: q.giris && q.giris !== gi ? q.giris : '',
          cz: i >= 0 ? ds[i] : null,
        });
      }
      if (q.cikis && q.cikis >= w0 && q.cikis <= w6) {
        let i = -1;
        ds.forEach((d, j) => {
          if (calGun(j)) i = j;
        });
        K.gc.push({
          p: q,
          key: 'cikis|' + q.id,
          tur: 'Çıkış',
          t: q.cikis,
          sgk: '',
          cz: i >= 0 ? ds[i] : null,
        });
      }
    });
  });
  // Bu şubede çalışan, haftada aktif ama haftanın listesinde olmayan kişiler (unutulduysa maaşı kesintisiz çıkar): teyit edilir.
  {
    const ids = kadroOf(wid).ids;
    const L0 = ids.map(id => S.personel.find(x => x.id === id)).filter(Boolean);
    subePersoneli()
      .filter(
        p =>
          p.anaSube === S.subeId &&
          !isEsnaf(p) &&
          p.paketBasi !== true &&
          aktifHaftada(p, wid) &&
          !ids.includes(p.id) &&
          !L0.some(x => ayniKisi(x, p)) &&
          !(cokSubeli(p) && weekDays(wid).some(d => digerGunler(p, d)))
      )
      .forEach(p => K.yok.push({ p, key: 'yok|' + p.id }));
  }
  // Rapor / ücretsiz izin / yıllık izin: kişi ve izin türü başına tek madde
  const g = {};
  K.izin.forEach(x => {
    const k = 'izin|' + x.p.id + '|' + x.v;
    (g[k] = g[k] || { key: k, p: x.p, v: x.v, gun: [] }).gun.push(x.d);
  });
  K.izinG = Object.values(g);
  return K;
}
export async function haftaKapatPanel(wid, onayDa) {
  await gunleriYukle(cizelgeKisileri(wid), haftaAylari(wid));
  const K = haftaKontrol(wid);
  const sb = haftaAyari(wid);
  const ad = p => esc(kisaAd(p.ad));
  const tK = (S.haftalar[wid] || {}).teyitK || {};
  const tkEksik = (isSube() ? [...K.izinG, ...K.yok] : K.gc).filter(x => !tK[x.key]).length;
  const engel = K.bos.length
    ? `${K.bos.length} boş gün doldurulmadan`
    : K.yedi.some(x => !x.ok)
      ? '7 gün çalışılan kişiler teyit edilmeden'
      : tkEksik
        ? `Kontrol listesinde ${tkEksik} madde teyit edilmeden`
        : '';
  const kis = cizelgeKisileri(wid);
  const topFm = kis.reduce(
    (t, p) => t + (isEsnaf(p) || p.sekil === 'Part' ? 0 : haftaHesapS(p, wid, sb).fm),
    0
  );
  let h = `<h2>${onayDa ? 'Haftayı kapat ve onayla' : 'Haftayı kapat'}</h2><div class="sub">${esc(sb.ad)} · ${rangeLabel(wid)}</div>`;
  if (K.bos.length)
    h += `<div class="kt kirmizi"><div class="kth"><b>Boş günler · ${K.bos.length}</b><span>Doldurulmadan hafta kapatılamaz.</span></div><div class="kti">${K.bos.map(x => `<span class="kchip">${ad(x.p)} · ${x.d.getDate()} ${AYK[x.d.getMonth()]} ${GUN[(x.d.getDay() + 6) % 7]}</span>`).join('')}</div></div>`;
  if (K.yedi.length)
    h += `<div class="kt ${K.yedi.every(x => x.ok) ? 'yesil' : 'sari'}"><div class="kth"><b>İzin kullanmadan 7 gün çalışanlar · ${K.yedi.length}</b><span>Doğruysa işaretleyin; izin gününün mesaisi bu haftaya ${fmt(7 * sb.gunluk - sb.haftalik)} saat fazla mesai olarak yazılır.</span></div><div class="kti">${K.yedi.map(x => `<label class="kchip ${x.ok ? 'on' : ''}"><input type="checkbox" data-t7="${esc(x.p.id)}" ${x.ok ? 'checked' : ''}> ${ad(x.p)}</label>`).join('')}</div></div>`;
  if (K.eksi.length)
    h += `<div class="kt sari"><div class="kth"><b>Eksi fazla mesai · ${K.eksi.length}</b><span>Eksik çalışma mı, yanlış saat mi bir bakın.</span></div><div class="kti">${K.eksi.map(x => `<span class="kchip">${ad(x.p)} · ${sg(x.fm)} sa</span>`).join('')}</div></div>`;
  const zor = isSube();
  const gunY = d => `${d.getDate()} ${AYK[d.getMonth()]}`;
  const tkChip = (x, t, z = zor) =>
    z
      ? `<label class="kchip ${tK[x.key] ? 'on' : ''}"><input type="checkbox" data-tk="${esc(x.key)}" ${tK[x.key] ? 'checked' : ''}> ${t}</label>`
      : `<span class="kchip">${t}</span>`;
  if (K.izinG.length)
    h += `<div class="kt ${zor ? (K.izinG.every(x => tK[x.key]) ? 'yesil' : 'sari') : 'sari'}"><div class="kth"><b>Rapor ve izinler · ${K.izinG.length}</b><span>${zor ? 'Evrakı ve günleri kontrol edip her birini işaretleyin; işaretlenmeden hafta kapatılamaz.' : 'Evrakı tamam mı kontrol edin.'}</span></div><div class="kti">${K.izinG.map(x => tkChip(x, `${ad(x.p)} · ${x.gun.map(gunY).join(', ')} ${KOD[x.v].ad.toLocaleLowerCase('tr-TR')}`)).join('')}</div></div>`;
  if (K.gc.length && !zor)
    h += `<div class="kt ${K.gc.every(x => tK[x.key]) ? 'yesil' : 'sari'}"><div class="kth"><b>Giriş ve çıkışlar · ${K.gc.length}</b><span>SGK tarihini ve çizelgede ilk / son çalıştığı günü muhasebe grubuyla kontrol edip işaretleyin; işaretlenmeden hafta kapatılamaz.</span></div><div class="kti">${K.gc.map(x => tkChip(x, `${ad(x.p)} · ${x.tur.toLowerCase()} ${trTarih(x.t)}${x.sgk ? ' (SGK ' + trTarih(x.sgk) + ')' : ''} · çizelgede ${x.tur === 'Giriş' ? 'ilk' : 'son'} gün ${x.cz ? gunY(x.cz) : 'yok'}`, true)).join('')}</div></div>`;
  if (K.yok.length)
    h += `<div class="kt ${zor ? (K.yok.every(x => tK[x.key]) ? 'yesil' : 'sari') : 'sari'}"><div class="kth"><b>Haftanın listesinde olmayan çalışanlar · ${K.yok.length}</b><span>${zor ? 'Bu hafta çalışmadıysa işaretleyin: kapatınca bu haftaki günleri <b>ücretsiz izin</b> olarak yazılır. Çalıştıysa "+ ekle" ile listeye ekleyip günlerini girin; işten ayrıldıysa personelden çıkış tarihini girin. İşaretlenmeden hafta kapatılamaz.' : 'Personel listesinde aktif ama bu haftanın listesinde yoklar. Kapatınca bu haftaki günleri <b>ücretsiz izin</b> olarak yazılır; işten ayrıldıysa önce personelden çıkış tarihini girin.'}</span></div><div class="kti">${K.yok.map(x => tkChip(x, `${ad(x.p)} · listede yok`)).join('')}</div></div>`;
  h += `<p class="note">${kis.length} kişi · haftanın toplam fazla mesaisi ${sg(topFm)} sa.${isSube() ? ' Kapatınca bu hafta size kapanır ve bölge müdürünün onayına gider; düzeltme gerekirse bölge müdürü kilidi açar.' : ''}</p>
   ${engel ? `<p class="note" style="color:var(--bad);font-weight:600">${engel} hafta kapatılamaz.</p>` : ''}
   <div class="row2"><button class="btn grow" id="hkNo">Vazgeç</button><button class="btn primary grow" id="hkOk" ${engel ? 'disabled' : ''}>${onayDa ? 'Kapat ve onayla' : 'Evet, kapat'}</button></div>`;
  openSheet(h, sh => {
    byId('hkNo').onclick = closeSheet;
    sh.querySelectorAll('[data-t7]').forEach(
      c =>
        (c.onchange = () => {
          const pid = c.dataset.t7;
          const w0 = S.haftalar[wid] || {};
          S.haftalar[wid] = { ...w0, teyit7: { ...(w0.teyit7 || {}), [pid]: c.checked } };
          {
            const sid = S.subeId,
              hdA = hdAlani(wid);
            sirayla(sid + '|' + wid, () => {
              arka(
                setDoc(
                  weekRef(wid, sid),
                  { hafta: wid, ay2: ayKey(haftaPazar(wid)), ...hdA, teyit7: { [pid]: c.checked } },
                  { merge: true }
                )
              );
            });
          }
          haftaKapatPanel(wid, onayDa);
        })
    );
    sh.querySelectorAll('[data-tk]').forEach(
      c =>
        (c.onchange = () => {
          const key = c.dataset.tk;
          const w0 = S.haftalar[wid] || {};
          S.haftalar[wid] = { ...w0, teyitK: { ...(w0.teyitK || {}), [key]: c.checked } };
          {
            const sid = S.subeId,
              hdA = hdAlani(wid);
            sirayla(sid + '|' + wid, () => {
              arka(
                setDoc(
                  weekRef(wid, sid),
                  { hafta: wid, ay2: ayKey(haftaPazar(wid)), ...hdA, teyitK: { [key]: c.checked } },
                  { merge: true }
                )
              );
            });
          }
          haftaKapatPanel(wid, onayDa);
        })
    );
    const ok = byId('hkOk');
    if (ok)
      ok.onclick = async () => {
        ok.disabled = true;
        try {
          await haftayiKapat(wid, onayDa);
          closeSheet();
          toast(
            onayDa
              ? `${rangeLabel(wid)} kapatıldı ve onaylandı.`
              : `${rangeLabel(wid)} kapatıldı${isSube() ? ', bölge müdürüne gönderildi' : ''}.`
          );
        } catch (e) {
          ok.disabled = false;
          yazmaHatasi(e);
        }
      };
  });
}
