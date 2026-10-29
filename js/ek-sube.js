// ek-sube.js — app.js (v180) satırları 1055-1074. Otomatik bölündü; davranış değişmedi.
import { doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { SGK_YOK, subeAdi } from './sabitler.js';
import { db, writeBatch } from './firebase.js';
import { S } from './durum.js';
import { ayKey, esc, today } from './yardimci.js';
import { isBolge, isIsveren } from './rol.js';
import { odemeSubesi } from './gecmis.js';
import { ekSubeleri, kisiSubeleri } from './cok-sube.js';
import { yazmaHatasi } from './yazma.js';
import { byId, render } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { adBuyuk } from './isim-esle.js';

/* ---- Diğer çalıştığı şubeler (çok şubeli çalışma): sadece işveren ve bölge müdürü (kendi şubeleri) ---- */
export function ekYetkiVar() {
  return isIsveren() || isBolge();
}
export function ekYetki(sid) {
  return isIsveren() || (isBolge() && (S.me.subeler || []).includes(sid));
}
export function ekSubePanel(p) {
  const ana = p.anaSube || '',
    sgk = p.sgkSube && p.sgkSube !== SGK_YOK ? p.sgkSube : '';
  const ek = ekSubeleri(p);
  const L = [...new Set([...(isIsveren() ? S.subeIds : S.me.subeler || []), ...ek])]
    .filter(x => x && x !== ana && x !== sgk)
    .sort((a, b) => String(subeAdi(a)).localeCompare(String(subeAdi(b)), 'tr'));
  openSheet(
    `<h2>${esc(adBuyuk(p.ad))}</h2><div class="sub">Çalıştığı şube: ${esc(subeAdi(ana))}${sgk && sgk !== ana ? ' · SGK: ' + esc(subeAdi(sgk)) : ''}. Diğer çalıştığı şubeleri işaretleyin.</div>
   <div class="checks" id="ekL">${L.map(x => `<label class="check" style="margin:0"><input type="checkbox" value="${esc(x)}" ${ek.includes(x) ? 'checked' : ''} ${ekYetki(x) ? '' : 'disabled'}> ${esc(subeAdi(x))}</label>`).join('') || '<span class="note">Eklenebilecek şube yok.</span>'}</div>
   <p class="note">Kişi işaretlenen şubelerin personel listesinde ve çizelgesinde de görünür; o şubede çalıştığı günün mesaisi o şubenin puantajına yazılır. Maaşı yine tek şubeden ödenir. Bir şubeden çıkarınca geçmiş haftaları ve saatleri silinmez, sadece yeni haftalara eklenmez. Bir kişi aynı gün tek şubede çalışır.</p>
   <div id="ekErr"></div><div class="row2"><button class="btn grow" id="ekNo">Vazgeç</button><button class="btn primary grow" id="ekOk">Kaydet</button></div>`,
    sh => {
      byId('ekNo').onclick = closeSheet;
      byId('ekOk').onclick = async () => {
        const yeni = [...sh.querySelectorAll('#ekL input:checked')].map(i => i.value);
        const b = byId('ekOk');
        b.disabled = true;
        const r = await ekSubeKaydet(p, yeni);
        if (r === true) closeSheet();
        else {
          b.disabled = false;
          if (r) byId('ekErr').innerHTML = `<div class="confirm bad">${esc(r)}</div>`;
        }
      };
    }
  );
}
export async function ekSubeKaydet(p, yeni) {
  const eski = ekSubeleri(p);
  const ekl = yeni.filter(x => !eski.includes(x)),
    cik = eski.filter(x => !yeni.includes(x));
  if (!ekl.length && !cik.length) return true;
  if ([...ekl, ...cik].some(x => !ekYetki(x)))
    return 'Sadece sorumlu olduğunuz şubeleri ekleyip çıkarabilirsiniz.';
  const ak = ayKey(today());
  const ms = odemeSubesi(p, ak);
  if (cik.includes(ms)) return `${subeAdi(ms)} bu ay maaşının ödendiği şube. Önce maaş şubesini değiştirin.`;
  const gor = [...new Set([...(p.gorunurSubeler || []), ...kisiSubeleri(p), ...yeni])];
  const body = { ekSubeler: yeni, gorunurSubeler: gor };
  try {
    const b = writeBatch(db);
    b.set(doc(db, 'personel', p.id), body, { merge: true });
    ekl.forEach(x => b.set(doc(db, 'ekPersonel', x), { ids: { [p.id]: true } }, { merge: true }));
    await b.commit();
  } catch (e) {
    yazmaHatasi(e);
    return 'Kaydedilemedi.';
  }
  Object.assign(p, body);
  render(); /* çizelgeye otomatik eklenmez: şube müdürü "+ ekle" ile ekler */
  toast(
    [
      ekl.length ? `${ekl.map(subeAdi).join(', ')} çizelgesine eklendi` : '',
      cik.length ? `${cik.map(subeAdi).join(', ')} şubesinden çıkarıldı; geçmiş haftaları duruyor` : '',
    ]
      .filter(Boolean)
      .join('. ') + '.'
  );
  return true;
}
