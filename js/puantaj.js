// puantaj.js — app.js (v180) satırları 1477-1498. Otomatik bölündü; davranış değişmedi.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { DURUM, aktifAy, ayGit } from './sabitler.js';
import { db } from './firebase.js';
import { S, subs } from './durum.js';
import { ayAdi, ayKaydir, bas, esc } from './yardimci.js';
import { puantajYetki } from './rol.js';
import { yazmaHatasi } from './yazma.js';
import { selectSube } from './subeler.js';
import { byId, render, view } from './cerceve.js';
import { renderTakip, takipBagla } from './takip.js';
import { renderPuantajDetay } from './puantaj-detay.js';
import { bekleyenUygula, veriListesi } from './veri-kayit.js';
import { veriBosTemizle } from './veri-girisi-bagla.js';

/* ================= Puantaj (bölge müdürü + işveren) ================= */
export function renderPuantaj() {
  if (!puantajYetki()) return;
  S.ay = aktifAy('puantaj');
  if (S.pt.sube && S.subeId === S.pt.sube) return renderPuantajDetay();
  const seg = `<div class="seg" id="tkSeg" style="margin:4px 0 12px"><button data-v="hafta" class="${S.tkGorunum === 'hafta' ? 'on' : ''}">Haftalar</button><button data-v="ay" class="${S.tkGorunum !== 'hafta' ? 'on' : ''}">Aylık puantaj</button></div>`;
  const segBagla = () =>
    document.querySelectorAll('#tkSeg button').forEach(
      b =>
        (b.onclick = () => {
          S.tkGorunum = b.dataset.v;
          render();
        })
    );
  if (S.tkGorunum === 'hafta')
    return view(seg + renderTakip(), () => {
      segBagla();
      takipBagla();
    });
  const ak = S.ay;
  listeDinle(ak);
  let h =
    seg +
    `<div class="weeknav"><button class="nav-arrow" id="prevM">‹</button><div class="ttl">${ayAdi(ak)}<small>${S.subeIds.length} şube</small></div><button class="nav-arrow" id="nextM">›</button></div>`;
  if (!S.subeIds.length) h += `<div class="empty-state"><b>Sorumlu olduğunuz şube yok</b></div>`;
  const say = {};
  h += `<div class="card list">${S.subeIds
    .map(id => {
      const d = S.pt.listeAylar[id + '|' + ak] || { durum: 'taslak' };
      say[d.durum] = (say[d.durum] || 0) + 1;
      const D = DURUM[d.durum] || DURUM.taslak;
      return `<button class="row" data-id="${esc(id)}"><div class="av">${esc(bas(S.subeler[id].ad))}</div><div class="m"><b>${esc(S.subeler[id].ad)}</b><span>${d.durum === 'kesin' ? 'Kesin kapandı' : d.durum === 'bolge_onay' ? 'Puantaj onaylandı' : d.kapatma ? 'Kapatıldı ' + new Date(d.kapatma).toLocaleDateString('tr-TR') : 'Haftalar onaylandıkça hazır olur'}</span></div><span class="chip ${D.c}">${D.ad}</span></button>`;
    })
    .join('')}</div>`;
  h += `<p class="note">${say.sube_onay ? `<b>${say.sube_onay} şube onayınızı bekliyor.</b> ` : ''}Şubeye dokunup puantajı açın. Muhasebe tarafı çizelgeden hesaplanır; ödemeleri orada işleyin.</p>`;
  view(h, () => {
    segBagla();
    byId('prevM').onclick = () => ayGit(ak, -1);
    byId('nextM').onclick = () => ayGit(ak, 1);
    document.querySelectorAll('.row[data-id]').forEach(b => (b.onclick = () => puantajAc(b.dataset.id)));
  });
}
let listeAy = null;
export function listeDinle(ak) {
  if (listeAy === ak + S.subeIds.join()) return;
  listeAy = ak + S.subeIds.join();
  subs.liste.forEach(u => u());
  subs.liste = [];
  S.subeIds.forEach(id =>
    subs.liste.push(
      onSnapshot(
        doc(db, 'subeler', id, 'aylar', ak),
        s => {
          S.pt.listeAylar[id + '|' + ak] = s.exists() ? s.data() : { durum: 'taslak' };
          if (S.tab === 'puantaj' && !S.pt.sube) render();
        },
        () => {}
      )
    )
  );
}
export function puantajAc(id) {
  if (S.subeId !== id) selectSube(id);
  S.pt.sube = id;
  S.pt.doc = null;
  S.pt.ham = null;
  S.pt.maas = null;
  S.pt.prev = null;
  S.pt.ozetler = null;
  S.pt.ozetVeri = null;
  S.pt.ozetHata = false;
  subs.detay.forEach(u => u());
  subs.detay = [];
  const ak = S.ay;
  S.pt.temiz = false;
  subs.detay.push(
    onSnapshot(
      doc(db, 'puantaj', id, 'aylar', ak),
      s => {
        if (S.pt.sube !== id || S.ay !== ak) return;
        S.pt.ham = s.exists() ? s.data() : {};
        S.pt.doc = { ...S.pt.ham, veri: bekleyenUygula(id, ak, veriListesi(S.pt.ham)) };
        if (!S.pt.temiz) {
          S.pt.temiz = true;
          veriBosTemizle();
        }
        render();
      },
      e => {
        S.pt.doc = {};
        yazmaHatasi(e);
      }
    )
  );
  subs.detay.push(
    onSnapshot(
      doc(db, 'maaslar', id),
      s => {
        S.pt.maas = s.exists() ? s.data() : {};
        render();
      },
      () => {
        S.pt.maas = {};
      }
    )
  );
  // Diğer şubelerin ay özetleri (izin, saat): yüklenmeden puantaj gösterilmez ve onaylanmaz.
  getDocs(query(collection(db, 'ozetler'), where('ay', '==', ak)))
    .then(q => {
      if (S.pt.sube !== id || S.ay !== ak) return;
      const m = {},
        vg = {};
      q.docs.forEach(d => {
        const x = d.data();
        if (x.sube) {
          m[x.sube] = x.kisiler || {};
          vg[x.sube] = x.veriGun || {};
        }
      });
      S.pt.ozetVeri = vg;
      S.pt.ozetler = m;
      render();
    })
    .catch(e => {
      console.error(e);
      if (S.pt.sube === id && S.ay === ak) {
        S.pt.ozetVeri = {};
        S.pt.ozetler = {};
        S.pt.ozetHata = true;
        render();
      }
    });
  getDoc(doc(db, 'puantaj', id, 'aylar', ayKaydir(ak, -1)))
    .then(s => {
      S.pt.prev = s.exists() ? s.data() : {};
      render();
    })
    .catch(() => {
      S.pt.prev = {};
    });
  render();
}
