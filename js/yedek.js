// yedek.js — app.js (v180) satırları 2492-2515, 2668-2687. Otomatik bölündü; davranış değişmedi.
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { AYK, SGK_YOK, subeAdi } from './sabitler.js';
import { db } from './firebase.js';
import { S, tryLS } from './durum.js';
import { addDays, esc, isShift, parse, rangeLabel, ymd } from './yardimci.js';
import { kisiSubeleri } from './cok-sube.js';
import { selectSube } from './subeler.js';
import { byId, render, view } from './cerceve.js';
import { toast } from './panel.js';
import { benAd, tarihSaat } from './hafta-kapatma.js';
import { adBuyuk } from './isim-esle.js';

/* ================= Yedek (işveren) =================
   Tüm veritabanını tek bir JSON dosyası olarak indirir. Ücretsiz planda otomatik yedek olmadığı için düzenli alınmalı.
   Dosyada maaş, TC ve IBAN bilgileri vardır; güvenli yerde saklanmalı. Eksik yedek yanıltıcı olacağı için bir bölüm okunamazsa yedek iptal edilir. */
export function yedekJson(v) {
  if (v && typeof v.toDate === 'function' && typeof v.toMillis === 'function')
    return { __zaman: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(yedekJson);
  if (v && typeof v === 'object') {
    const o = {};
    Object.entries(v).forEach(([k, x]) => (o[k] = yedekJson(x)));
    return o;
  }
  return v;
}
export async function yedekAl(durum) {
  const B = {};
  let n = 0;
  const ekle = (yol, data) => {
    B[yol] = yedekJson(data);
    n++;
  };
  const kol = async yol => {
    const q = await getDocs(collection(db, ...yol));
    q.docs.forEach(d => ekle([...yol, d.id].join('/'), d.data()));
    durum(`${n} kayıt okundu…`);
    return q.docs.map(d => d.id);
  };
  const tek = async yol => {
    const s = await getDoc(doc(db, ...yol));
    if (s.exists()) ekle(yol.join('/'), s.data());
  };
  for (const k of ['kullanicilar', 'personel', 'ekPersonel', 'gunler', 'ozetler', 'iscilik']) await kol([k]);
  for (const d of ['kurulum', 'subeAdlari', 'goc', 'surum']) await tek(['sistem', d]);
  const subeIds = await kol(['subeler']);
  const tum = [...new Set([...subeIds, ...Object.keys(S.subeAdlari || {})])].filter(x => x && x !== SGK_YOK);
  for (const s of tum) {
    for (const alt of ['haftalar', 'durum', 'aylar', 'personel']) await kol(['subeler', s, alt]);
    await kol(['puantaj', s, 'aylar']);
    await tek(['maaslar', s]);
  }
  return {
    uygulama: 'puantaj-merkezi',
    yedekSurum: 1,
    tarih: new Date().toISOString(),
    alan: benAd(),
    subeSayisi: tum.length,
    belgeSayisi: n,
    belgeler: B,
  };
}
// Her şubenin haftalarında: kişi silinmişse ya da kişinin o şubeyle bağı yoksa (çalıştığı / SGK / diğer / görünür şubeleri arasında değilse) listelenir.
export async function veriKontrolu() {
  const P = new Map(S.personel.map(p => [p.id, p]));
  const out = [];
  const vg = {};
  const tum = [...new Set([...S.subeIds, ...Object.keys(S.subeAdlari || {})])].filter(
    x => x && x !== SGK_YOK
  );
  for (const sid of tum) {
    const q = await getDocs(collection(db, 'subeler', sid, 'haftalar'));
    q.docs.forEach(d => {
      const x = d.data() || {};
      const ids = new Set([...(Array.isArray(x.kadro) ? x.kadro : []), ...Object.keys(x.cells || {})]);
      ids.forEach(pid => {
        const dolu = Object.values((x.cells || {})[pid] || {}).filter(v => v).length;
        const p = P.get(pid);
        if (!p) {
          if (dolu) out.push({ sid, wid: d.id, ad: pid, neden: 'silinmiş kişi', dolu });
          return;
        }
        if (!kisiSubeleri(p).includes(sid))
          out.push({ sid, wid: d.id, ad: adBuyuk(p.ad), neden: 'bu şubeyle bağı yok', dolu });
        // Aynı gün iki şubede vardiya (eski yapıştırma hatasından kalmış olabilir)
        Object.entries((x.cells || {})[pid] || {}).forEach(([i, v]) => {
          if (!isShift(v)) return;
          const ds = ymd(addDays(parse(d.id), +i));
          const k = pid + '|' + ds;
          (vg[k] = vg[k] || []).push({ sid, wid: d.id });
        });
      });
    });
  }
  const cg = {};
  Object.entries(vg).forEach(([k, L]) => {
    if (new Set(L.map(x => x.sid)).size < 2) return;
    const [pid, ds] = k.split('|');
    const t = parse(ds);
    const sAd = [...new Set(L.map(x => subeAdi(x.sid)))].join(', ');
    L.forEach(x => {
      const g = x.sid + '|' + x.wid + '|' + pid;
      (cg[g] = cg[g] || { sid: x.sid, wid: x.wid, pid, gun: [], sAd }).gun.push(
        `${t.getDate()} ${AYK[t.getMonth()]}`
      );
    });
  });
  Object.values(cg).forEach(c => {
    const p = P.get(c.pid);
    out.push({
      sid: c.sid,
      wid: c.wid,
      ad: p ? adBuyuk(p.ad) : c.pid,
      neden: `aynı gün iki şubede vardiya (${c.sAd}): ${c.gun.join(', ')}`,
    });
  });
  return out.sort((a, b) => String(a.sid).localeCompare(String(b.sid)) || a.wid.localeCompare(b.wid));
}
export function renderYedek(h) {
  const son = tryLS('pm.sonYedek');
  const gun = son ? Math.floor((Date.now() - Date.parse(son)) / 86400000) : null;
  h += `<div class="card" style="padding:14px">
    <h3 style="margin:0 0 6px">Veritabanı yedeği</h3>
    <p class="note" style="margin-top:0">Bütün şubelerin çizelgeleri, personel listesi, puantajlar, ödemeler, maaşlar ve kullanıcılar tek dosya olarak bilgisayarınıza iner. Ücretsiz Firebase planında otomatik yedek yok; <b>haftada en az bir kez</b> ve her ay sonu onayından sonra alın.</p>
    ${son ? `<div class="banner ${gun >= 7 ? 'bad' : 'ok'}">Bu cihazda son yedek: ${tarihSaat(son)}${gun >= 1 ? ` (${gun} gün önce)` : ''}${gun >= 7 ? ' · Yeni yedek alın.' : ''}</div>` : `<div class="banner bad">Bu cihazda henüz yedek alınmadı.</div>`}
    <div class="actions"><button class="btn primary grow" id="yedekB">Yedek indir</button></div><div id="yedekD" class="note"></div>
    <p class="note">Dosyada maaş, TC ve IBAN bilgileri var; kimseyle paylaşmayın, bilgisayarda ya da kendi bulut klasörünüzde saklayın. Silinen bir veriyi geri getirmek gerekirse bu dosya kullanılır. Yedek alırken tüm kayıtlar okunduğu için günlük okuma kotasından birkaç bin okuma harcanır.</p></div>`;
  h += `<div class="card" style="padding:14px;margin-top:12px"><h3 style="margin:0 0 6px">Veri kontrolü</h3><p class="note" style="margin-top:0">Bütün şubelerin haftalarını tarar: o şubeyle ilgisi olmayan kişilere ait hücreleri (ör. eski şube karışması hatasından kalan) ve silinmiş kişilere ait kayıtları listeler. Hiçbir şeyi değiştirmez.</p>
    <div class="actions"><button class="btn grow" id="kontrolB">Kontrol et</button></div><div id="kontrolD"></div></div>`;
  view(h, () => {
    document.querySelectorAll('#ySeg button').forEach(
      b =>
        (b.onclick = () => {
          S.ynt = b.dataset.v;
          render();
        })
    );
    const kb = byId('kontrolB');
    kb.onclick = async () => {
      kb.disabled = true;
      kb.textContent = 'Taranıyor…';
      const D2 = byId('kontrolD');
      try {
        const L = await veriKontrolu();
        D2.innerHTML = L.length
          ? `<div class="banner bad">${L.length} sorunlu kayıt bulundu.</div><div class="card list">${L.map(x => `<button class="row" data-ks="${esc(x.sid)}" data-kw="${esc(x.wid)}"><div class="m"><b>${esc(x.ad)}</b><span>${esc(subeAdi(x.sid))} · ${rangeLabel(x.wid)} · ${esc(x.neden)}${x.dolu ? ` · ${x.dolu} dolu gün` : ''}</span></div><span class="ch">›</span></button>`).join('')}</div><p class="note">Satıra dokununca o haftanın çizelgesi açılır. Yanlış şubeye yazılmış kişiyi isminden "Bu haftadan çıkar" ile çıkarın; saatleri doğru şubede yoksa oraya girin.</p>`
          : '<div class="banner ok">Sorunlu kayıt bulunmadı.</div>';
        D2.querySelectorAll('[data-ks]').forEach(
          r =>
            (r.onclick = () => {
              S.tab = 'cizelge';
              tryLS('pm.tab', 'cizelge');
              S.hafta = r.dataset.kw;
              if (S.subeId !== r.dataset.ks) selectSube(r.dataset.ks);
              else render();
              window.scrollTo(0, 0);
            })
        );
      } catch (e) {
        console.error(e);
        D2.innerHTML = `<div class="banner bad">Kontrol yapılamadı: ${esc(e.code || e.message || '')}</div>`;
      }
      kb.disabled = false;
      kb.textContent = 'Kontrol et';
    };
    const b = byId('yedekB'),
      D = byId('yedekD');
    b.onclick = async () => {
      b.disabled = true;
      b.textContent = 'Yedek alınıyor…';
      try {
        const Y = await yedekAl(m => {
          D.textContent = m;
        });
        const t = new Date();
        const ad = `Puantaj-yedek-${ymd(t)}-${String(t.getHours()).padStart(2, '0')}.${String(t.getMinutes()).padStart(2, '0')}.json`;
        const f = new File([JSON.stringify(Y)], ad, { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(f);
        a.download = ad;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        tryLS('pm.sonYedek', t.toISOString());
        toast(`Yedek indirildi: ${Y.belgeSayisi} kayıt, ${Y.subeSayisi} şube.`);
        render();
      } catch (e) {
        console.error(e);
        const msj =
          'Yedek alınamadı, hiçbir dosya inmedi: ' +
          ((e && (e.code || e.message)) || 'bilinmeyen hata') +
          '. İnternet bağlantısını kontrol edip tekrar deneyin.';
        D.textContent = msj;
        b.disabled = false;
        b.textContent = 'Yedek indir';
        toast(msj);
      }
    };
  });
}
