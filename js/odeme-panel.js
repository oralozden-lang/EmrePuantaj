// odeme-panel.js — app.js (v180) satırları 1963-2019. Otomatik bölündü; davranış değişmedi.
import { doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { SGK_YOK, subeAdi } from './sabitler.js';
import { db, setDoc } from './firebase.js';
import { S } from './durum.js';
import { ayAdi, esc, fmt, sayi, sg, tl, tl0, ymd } from './yardimci.js';
import { isIsveren } from './rol.js';
import { maasGecmisYama, maasSubeGecmisYazi, odemeSubesi } from './gecmis.js';
import { FM_KUSURAT_AYI, fmSaatUcreti, otoKapi, sagHesap } from './puantaj-hesap.js';
import { yazmaHatasi } from './yazma.js';
import { kilitEngel, kilitliMi, ptK } from './kilit.js';
import { tumSubeler } from './subeler.js';
import { byId, render } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { kesinEngel, ptVerisi, ucretGecmisi, usOf } from './puantaj-veri.js';
import { sagYama, veriYaz, yeniSira } from './veri-kayit.js';
import { sagSonuclu } from './puantaj-islem.js';
import { adBuyuk } from './isim-esle.js';

export function odemePanel(pid) {
  if (kilitEngel() || kesinEngel()) return;
  const V = ptVerisi();
  const x = V.satir.find(s => s.pid === pid);
  if (!x) return;
  const s = x.sag;
  const esnaf = x.hes.esnaf;
  const ekToplam = k => {
    const v = (V.oz[pid] || {})[k] || 0;
    return v ? tl(v) : '';
  };
  const us0 = usOf(pid);
  let tip = us0.tip;
  const maasDisi = x.sol.maasBurada === false;
  const kuryeMi = (x.sol.grup || '') === 'S';
  const partMi = x.sol.sekil === 'Part';
  if (!kuryeMi && tip === 'paket') tip = 'maas';
  if (!partMi && tip === 'saat' && !maasDisi) tip = us0.tip === 'saat' ? 'saat' : tip;
  const tc =
    (S.pt.maas && S.pt.maas.tc && S.pt.maas.tc[pid]) || (S.personel.find(q => q.id === pid) || {}).tc || '';
  const inp = (id, label, val, ph = '') =>
    `<label class="field"><span>${label}</span><input id="${id}" inputmode="decimal" value="${val ?? ''}" placeholder="${ph}"></label>`;
  const pK = S.personel.find(q => q.id === pid);
  const ms0 = pK ? odemeSubesi(pK, V.ak) : '';
  let msSecHtml = '';
  if (pK && !esnaf) {
    const sgk = pK.sgkSube && pK.sgkSube !== SGK_YOK ? pK.sgkSube : '';
    const ana = pK.anaSube || '';
    // İşveren her şubeyi seçebilir; diğerleri kişinin görüldüğü şubeleri (çalıştığı, SGK).
    const ids = isIsveren() ? tumSubeler().map(([i]) => i) : [...new Set([ana, sgk, ms0].filter(Boolean))];
    if (ms0 && !ids.includes(ms0)) ids.unshift(ms0);
    const gy = maasSubeGecmisYazi(pK);
    msSecHtml = `<label class="field" style="grid-column:1/-1"><span>Maaşın ödendiği şube · ${ayAdi(V.ak)} ayından itibaren</span><select id="oMs" ${V.kilitli ? 'disabled' : ''}>${ids.map(i => `<option value="${esc(i)}" ${i === ms0 ? 'selected' : ''}>${esc(subeAdi(i))}${i === sgk ? ' (SGK)' : i === ana ? ' (çalıştığı)' : ''}</option>`).join('')}</select></label>
     <p class="note" style="grid-column:1/-1;margin-top:0">${V.kilitli ? 'Bu ay onaylı, bu ay için değiştirilemez. ' : ''}Değiştirirseniz bu ay ve sonrası için geçerli olur; önceki aylar değişmez. Muhasebe ${esc(subeAdi(sgk || ana))}'de kalır.${gy ? ' Geçmiş: ' + esc(gy) : ''}</p>`;
  }
  let fmModD = s.fmMod === 'elle' && s.fmBirim !== undefined ? 'elle' : 'maas';
  openSheet(
    `<h2>${esc(x.sol.ad)}</h2><div class="sub">${ayAdi(V.ak)} · ${esc(x.sol.sekil)} · ${esnaf ? 'paket başı' : x.sol.gun + ' bordro günü' + (x.sol.hakGun != null && x.sol.hakGun !== x.sol.gun ? ` · ${x.sol.hakGun} çalışılan gün` : '')}${x.sol.fmSaat && !esnaf ? ' · fazla mesai ' + sg(x.sol.fmSaat) + ' sa' : ''}${x.sol.sekil === 'Part' ? ` · çizelgede ${fmt(x.sol.calisilanSaat || 0)} sa` : ''}</div>
   <div class="fgrid">${
     esnaf
       ? inp('oPs', 'Paket sayısı', s.paketSayisi) + inp('oPu', 'Paket başı ücret (₺)', s.paketUcret, '')
       : `<div style="grid-column:1/-1"><span class="lbl">Ücret şekli</span><div class="seg" id="oSekil">${(maasDisi ? [['maas', 'Maaşı başka şubede'], ...(kuryeMi ? [['paket', 'Paket başı']] : []), ['saat', 'Saatlik']] : [['maas', 'Maaşlı'], ...(kuryeMi ? [['paket', 'Paket başı']] : []), ['saat', 'Saatlik']]).map(([k, a]) => `<button data-v="${k}" class="${tip === k ? 'on' : ''}">${a}</button>`).join('')}</div></div>
     <div id="oNetW" style="grid-column:1/-1" ${tip === 'maas' && !maasDisi ? '' : 'hidden'}>${inp('oNet', `Anlaşılan aylık net (₺) · ${ayAdi(V.ak)} ayından itibaren`, x.net, 'örn. 50000')}<p class="note" style="margin-top:0">Değiştirirseniz bu ay ve sonrası için geçerli olur; önceki aylar değişmez.${ucretGecmisi('netGecmis', pid) ? ' Geçmiş: ' + esc(ucretGecmisi('netGecmis', pid)) : ''}</p></div>
     <p class="note" id="oMdNot" style="grid-column:1/-1" ${tip === 'maas' && maasDisi ? '' : 'hidden'}>Maaşı ${esc(x.sol.odemeSube || 'SGK şubesinin')} puantajında. Burada sadece bu şubede yaptığı fazla mesai ve buraya ait primler hesaplanır.</p>
     <p class="note" id="oPbNot" style="grid-column:1/-1" ${tip === 'paket' ? '' : 'hidden'}>Paket başı: kazanç paket primleridir. Paket primlerini Veri girişinden "Paket primi" olarak girin; bankaya yatan, ara ödeme ve avans düşülür, kalan elden ödenir. Fazla mesai hesaplanmaz.</p>
     <div id="oSaatW" style="grid-column:1/-1" ${tip === 'saat' ? '' : 'hidden'}>${inp('oSaat', `Saat ücreti (₺) · ${ayAdi(V.ak)} ayından itibaren`, us0.saatUcret || '', 'örn. 120')}<p class="note" style="margin-top:0">Saatler mesai çizelgesinden ayın 1'i ile son günü arasında otomatik alınır (bu ay ${fmt(x.sol.calisilanSaat || 0)} sa, sadece bu şubedeki saatler). Eksik ya da fazla varsa Veri girişine "Çalışılan saat" türüyle + ya da − saat girin. Hak ediş = saat × ücret; bankaya yatan, ara ödeme ve avans düşülür. Fazla mesai hesaplanmaz.</p></div>`
   }
   ${!esnaf && V.sb.fmYontem === 'maas' ? `<div id="oFmW" style="grid-column:1/-1" ${tip === 'maas' ? '' : 'hidden'}><span class="lbl">Fazla mesai</span><div class="seg" id="oFmS"><button data-v="maas" class="${fmModD === 'elle' ? '' : 'on'}">Maaşına göre</button><button data-v="elle" class="${fmModD === 'elle' ? 'on' : ''}">Elle yaz</button></div><div id="oFmTW" ${fmModD === 'elle' ? '' : 'hidden'}>${inp('oFmT', 'Fazla mesai saat ücreti (₺)', s.fmBirim || '', 'örn. 220')}</div><p class="note" id="oFmH" style="margin-top:4px"></p></div>` : ''}
   ${!esnaf && V.sb.fmYontem !== 'maas' ? `<div id="oFoW" style="grid-column:1/-1" ${tip === 'maas' ? '' : 'hidden'}>${inp('oFo', `Özel fazla mesai saat ücreti (₺) · ${ayAdi(V.ak)} ayından itibaren`, us0.fmOzel || '', 'boşsa şube ücreti: ' + (sayi(V.sb.fmUcret) || '-'))}<p class="note" style="margin-top:0">Sadece bu kişi için. Boş bırakırsanız şubenin sabit ücreti uygulanır; bu ay ve sonrası için geçerli olur, önceki aylar değişmez.${ucretGecmisi('fmOzelGecmis', pid) ? ' Geçmiş: ' + esc(ucretGecmisi('fmOzelGecmis', pid)) : ''}</p></div>` : ''}
   ${inp('oCiro', 'Ciro primi ekle (₺)', '')}
   <p class="note yardim" style="grid-column:1/-1;margin-top:0">Buraya yazdığınız ciro primi veri girişine ayın son günü tarihli satır olarak eklenir. Paket primi, avans ve ara ödemeyi veri girişinden girin.${ekToplam('PP') || ekToplam('CP') ? ` Bu ay girilmiş: ${ekToplam('PP') ? 'paket primi ' + ekToplam('PP') : ''}${ekToplam('PP') && ekToplam('CP') ? ', ' : ''}${ekToplam('CP') ? 'ciro primi ' + ekToplam('CP') : ''}.` : ''}</p>
   ${msSecHtml}
   <label class="field"><span>TC kimlik no (bordro eşleşmesi için)</span><input id="oTc" inputmode="numeric" maxlength="11" value="${esc(tc)}"></label></div>
   <div class="calc" id="oCalc"></div><div id="oErr"></div><div class="row2"><button class="btn grow" id="oNo">Vazgeç</button><button class="btn primary grow" id="oOk">Kaydet</button></div>`,
    sh => {
      const oku = () => {
        const v = id => {
          const e = byId(id);
          return e ? e.value.trim() : undefined;
        };
        const o = {};
        if (esnaf) {
          o.paketSayisi = v('oPs');
          o.paketUcret = v('oPu');
        }
        if (byId('oFmW')) {
          const el = fmModD === 'elle' && tip === 'maas';
          o.fmMod = el ? 'elle' : '';
          o.fmBirim = el ? v('oFmT') || '' : '';
        }
        return o;
      };
      const ekV = V.oz[pid] || {};
      sh.querySelectorAll('#oSekil button').forEach(
        b =>
          (b.onclick = () => {
            tip = b.dataset.v;
            sh.querySelectorAll('#oSekil button').forEach(q => q.classList.toggle('on', q === b));
            byId('oNetW').hidden = !(tip === 'maas' && !maasDisi);
            byId('oMdNot').hidden = !(tip === 'maas' && maasDisi);
            byId('oPbNot').hidden = tip !== 'paket';
            byId('oSaatW').hidden = tip !== 'saat';
            const fw = byId('oFmW');
            if (fw) fw.hidden = tip !== 'maas';
            const fo = byId('oFoW');
            if (fo) fo.hidden = tip !== 'maas';
            calc();
          })
      );
      sh.querySelectorAll('#oFmS button').forEach(
        b =>
          (b.onclick = () => {
            fmModD = b.dataset.v;
            sh.querySelectorAll('#oFmS button').forEach(q => q.classList.toggle('on', q === b));
            byId('oFmTW').hidden = fmModD !== 'elle';
            if (fmModD === 'elle') {
              const ti = byId('oFmT');
              if (ti && !ti.value) {
                const nn = byId('oNet') ? sayi(byId('oNet').value) : sayi(x.net);
                const r0 = fmSaatUcreti(V.sb, nn, V.ak);
                if (r0) ti.value = String(r0);
              }
            }
            calc();
          })
      );
      const usSimdi = () => ({
        tip,
        saatUcret: byId('oSaat') ? sayi(byId('oSaat').value) : 0,
        fmOzel: byId('oFo') && tip === 'maas' ? sayi(byId('oFo').value) : 0,
        ak: V.ak,
      });
      const calc = () => {
        const o = oku();
        const fh = byId('oFmH');
        if (fh) {
          const nn = byId('oNet') ? sayi(byId('oNet').value) : sayi(x.net);
          const fs = x.sol.fmSaat || 0;
          fh.textContent =
            fmModD === 'elle'
              ? `Çizelgede ${sg(fs)} sa fazla mesai var. Saat ücretini kendiniz yazın.`
              : nn
                ? `${tl0(nn)} ÷ 30 ÷ 9 = ${fmt(nn / 30 / 9)} → ${tl0(fmSaatUcreti(V.sb, nn, V.ak))}/sa${V.ak >= FM_KUSURAT_AYI ? ' (küsurat atılır)' : ''} × ${sg(fs)} sa`
                : 'Net maaş girilmedi, saat ücretini "Elle yaz" ile girin.';
        }
        const n = esnaf ? 0 : byId('oNet') ? sayi(byId('oNet').value) : sayi(x.net);
        const ek2 = { ...ekV, CP: (ekV.CP || 0) + sayi(byId('oCiro').value) };
        const r = sagHesap(
          pid,
          x.sol,
          { ...s, ...o },
          n,
          V.sb,
          x.hes.devir,
          ek2,
          esnaf ? {} : usSimdi(),
          otoKapi(V.ak, V.kilitli, V.kesin)
        );
        const pb = r.pb;
        byId('oCalc').innerHTML =
          `${esnaf ? `<div><span>Paket hak edişi</span><b>${tl(r.paketHak)}</b></div>` : pb ? '' : r.saat ? `<div><span>Hak edilen (${fmt(r.saatSayi)} saat${r.saatSayi !== r.cizelgeSaat ? ` = çizelge ${fmt(r.cizelgeSaat)} ${r.saatSayi > r.cizelgeSaat ? '+' : '−'} ${fmt(Math.abs(r.saatSayi - r.cizelgeSaat))}` : ''} × ${tl(r.saatUcret)})</span><b>${tl(r.hak)}</b></div>` : `<div><span>Hak edilen (net × ${x.sol.hakGun != null ? x.sol.hakGun : x.sol.gun}${x.sol.bayram > 0 ? `+${fmt(x.sol.bayram)} bayram` : ''}/30${x.sol.hakGun != null && x.sol.hakGun !== x.sol.gun ? (x.sol.sekil === 'Part' || x.sol.partGun > 0 ? ` · muhasebede part ${fmt(x.sol.gun)} gün` : x.sol.sgkYok ? ' · SGK yok' : ` · ${x.sol.hakGun - x.sol.gun} gün deneme`) : ''})</span><b>${tl(r.hak)}</b></div>`}<div><span>− Bankaya yatan</span><b>${tl(r.bankaya)}</b></div>${pb ? '' : `<div><span>= Maaş farkı</span><b>${tl(r.maasFarki)}</b></div>`}
       ${r.fmTl ? `<div><span>+ Fazla mesai</span><b>${tl(r.fmTl)}</b></div>` : ''}${r.paketPrimi ? `<div><span>+ Paket primi</span><b>${tl(r.paketPrimi)}</b></div>` : ''}${r.ciroPrimi ? `<div><span>+ Ciro primi</span><b>${tl(r.ciroPrimi)}</b></div>` : ''}${r.araOdeme ? `<div><span>− Ara ödeme</span><b>${tl(r.araOdeme)}</b></div>` : ''}${r.avans ? `<div><span>− Avans${r.devirAvans ? ` (${tl(r.devirAvans)} geçen ay devri dahil)` : ''}</span><b>${tl(r.avans)}</b></div>` : ''}
       ${Math.abs(r.kalan - r.kalanHam) > 0.004 ? `<div><span>Yuvarlama (5 ₺)</span><b>${tl(r.kalan - r.kalanHam)}</b></div>` : ''}<div style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><span>Kalan ödeme</span><b class="${r.kalan < 0 ? 'neg' : 'pos'}">${tl(r.kalan)}</b></div>${r.kalan < 0 ? '<div><span class="note" style="margin:0">Eksi tutar sonraki ayın ödemesinden düşülür.</span></div>' : ''}`;
      };
      sh.querySelectorAll('input').forEach(i => (i.oninput = calc));
      calc();
      byId('oNo').onclick = closeSheet;
      byId('oOk').onclick = async () => {
        const o = oku();
        const tcv = byId('oTc').value.replace(/\D/g, '');
        if (tcv && tcv.length !== 11) {
          byId('oErr').innerHTML = '<div class="confirm">TC kimlik no 11 haneli olmalı.</div>';
          return;
        }
        const sid = S.subeId,
          ak = V.ak;
        const sag = sagSonuclu(V, { [pid]: o });
        if (await kilitliMi(ptK(sid, ak))) return;
        try {
          const netEl = byId('oNet');
          if (!esnaf) {
            const u = usSimdi();
            if (u.tip !== us0.tip || (u.tip === 'saat' && u.saatUcret !== us0.saatUcret)) {
              const m0 = S.pt.maas || {};
              const sg0 = (m0.saatGecmis || {})[pid] || {};
              S.pt.maas = {
                ...m0,
                ucretSekli: { ...(m0.ucretSekli || {}), [pid]: u.tip },
                paketBasi: { ...(m0.paketBasi || {}), [pid]: u.tip === 'paket' },
                ...(u.tip === 'saat'
                  ? { saatGecmis: { ...(m0.saatGecmis || {}), [pid]: { ...sg0, [ak]: u.saatUcret } } }
                  : {}),
              };
              setDoc(
                doc(db, 'maaslar', sid),
                {
                  ucretSekli: { [pid]: u.tip },
                  paketBasi: { [pid]: u.tip === 'paket' },
                  ...(u.tip === 'saat' ? { saatGecmis: { [pid]: { [ak]: u.saatUcret } } } : {}),
                },
                { merge: true }
              ).catch(yazmaHatasi);
            }
            const kp = S.personel.find(q => q.id === pid),
              yPb = u.tip === 'paket';
            if (kp && !!kp.paketBasi !== yPb) {
              kp.paketBasi = yPb;
              setDoc(doc(db, 'personel', pid), { paketBasi: yPb }, { merge: true }).catch(yazmaHatasi);
            } /* paket başı kişinin kendisinde: her şubede geçerli */
          }
          if (!esnaf && byId('oFo')) {
            const yeni = tip === 'maas' ? sayi(byId('oFo').value) || 0 : 0;
            const eski = sayi(us0.fmOzel) || 0;
            if (yeni !== eski) {
              const m0 = S.pt.maas || {};
              const g0 = (m0.fmOzelGecmis || {})[pid] || {};
              S.pt.maas = {
                ...m0,
                fmOzelGecmis: { ...(m0.fmOzelGecmis || {}), [pid]: { ...g0, [ak]: yeni } },
              };
              setDoc(
                doc(db, 'maaslar', sid),
                { fmOzelGecmis: { [pid]: { [ak]: yeni } } },
                { merge: true }
              ).catch(yazmaHatasi);
            }
          }
          const netYeni = !esnaf && netEl && !byId('oNetW').hidden ? sayi(netEl.value) || null : undefined;
          const netDeg = netYeni !== undefined && netYeni !== (sayi(x.net) || null);
          if (netDeg || tcv !== tc) {
            const m = {};
            if (netDeg) m.netGecmis = { [pid]: { [ak]: netYeni } };
            if (tcv !== tc) m.tc = { [pid]: tcv || null };
            if (netDeg) {
              const m0 = S.pt.maas || {};
              S.pt.maas = {
                ...m0,
                netGecmis: {
                  ...(m0.netGecmis || {}),
                  [pid]: { ...((m0.netGecmis || {})[pid] || {}), [ak]: netYeni },
                },
              };
            }
            setDoc(doc(db, 'maaslar', sid), m, { merge: true }).catch(yazmaHatasi);
          }
          // Primler ve eski kayıtlı avans/prim tutarları veri girişine taşınır: veri tek yerde.
          const sonGun = ymd(new Date(+ak.slice(0, 4), +ak.slice(5), 0));
          const kim = S.me.adSoyad || S.me.kullaniciAdi || '';
          const z = new Date().toISOString();
          const adP = adBuyuk(x.sol.ad);
          const satir = (tur, m, a) => ({
            id: Math.random().toString(36).slice(2, 10),
            sira: yeniSira(),
            tarih: sonGun,
            ad: adP,
            pid,
            tur,
            miktar: m,
            aciklama: a,
            kim,
            zaman: z,
          });
          const ek = [];
          if (sayi(byId('oCiro').value))
            ek.push(satir('CP', sayi(byId('oCiro').value), 'Ödeme penceresinden'));
          const eskiS = sag[pid] || {};
          [
            ['paketPrimi', 'PP'],
            ['ciroPrimi', 'CP'],
            ['avans', 'AV'],
          ].forEach(([f, t]) => {
            if (sayi(eskiS[f])) {
              ek.push(satir(t, sayi(eskiS[f]), 'Önceki kayıttan taşındı'));
              sag[pid] = { ...sag[pid], [f]: '' };
            }
          });
          const burada = sid === S.pt.sube && ak === S.ay && S.pt.doc;
          const veriY = [...((burada ? S.pt.doc.veri : V.D.veri) || []), ...ek];
          if (burada) S.pt.doc = { ...S.pt.doc, veri: veriY };
          const sag2 = sagSonuclu({ ...V, D: { ...V.D, sag, veri: veriY } });
          veriYaz(
            sid,
            ak,
            { deg: Object.fromEntries(ek.map(r => [r.id, r])), sil: [] },
            { ...(V.kilitli ? {} : { sube: sid, ay: ak }), sag: sagYama(sag2, [pid]) },
            { kilitsiz: true }
          );
          const msEl = byId('oMs');
          let msMesaj = '';
          if (pK && msEl && !msEl.disabled && msEl.value && msEl.value !== ms0) {
            const ym = maasGecmisYama(pK, msEl.value, ak);
            if (ym) {
              Object.assign(pK, ym);
              setDoc(doc(db, 'personel', pK.id), ym, { merge: true }).catch(yazmaHatasi);
              msMesaj = ` Maaşı ${ayAdi(ak)} ayından itibaren ${subeAdi(msEl.value)} puantajında.`;
            }
          }
          closeSheet();
          toast(
            (ek.length ? 'Kaydedildi, primler veri girişine eklendi.' : 'Ödeme bilgileri kaydedildi.') +
              msMesaj
          );
          if (msMesaj) render();
        } catch (e) {
          yazmaHatasi(e);
        }
      };
    }
  );
}
