// bordro.js — app.js (v180) satırları 2184-2252. Otomatik bölündü; davranış değişmedi.
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { AY, subeAdi } from './sabitler.js';
import { db, setDoc } from './firebase.js';
import { S } from './durum.js';
import { ayAdi, esc, fmt, isimAnahtar, sayi, tl, ymd } from './yardimci.js';
import { isIsveren } from './rol.js';
import { yazmaHatasi } from './yazma.js';
import { kilitEngel, kilitliMi, ptK } from './kilit.js';
import { byId, render } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { bordroHedef, kesinEngel, paketBasiMi } from './puantaj-veri.js';
import { sagYama, veriListesi, veriYaz, yeniSira } from './veri-kayit.js';
import { sagSonuclu } from './puantaj-islem.js';
import { pdfSatirlari, pusulaCoz, pusulaOcr } from './bordro-ocr.js';
import { adBuyuk } from './isim-esle.js';

// Önce toplu bordro listesi, olmazsa tekli pusula (yazı katmanı varsa metinden, yoksa görselden OCR ile).
export async function bordroOku(file, durum) {
  const lines = await pdfSatirlari(file);
  const r = bordroCoz(lines);
  if (r.kisiler.length) return r;
  const p = pusulaCoz(lines);
  if (p.kisiler.length) return p;
  if (lines.join('').replace(/\s/g, '').length < 20) return await pusulaOcr(file, durum);
  return r;
}
export function bordroCoz(lines) {
  const para = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
  const out = { isyeri: null, donem: null, kisiler: [], toplam: null };
  lines.forEach((l, i) => {
    let m;
    if (!out.isyeri && (m = l.match(/İşyeri\s+Adı\s+(.+)/))) out.isyeri = m[1].replace(/\s+/g, ' ').trim();
    if (!out.donem && (m = l.match(/Ay\s*\/\s*Yıl\s+([A-ZÇĞİÖŞÜ]+)\s*\/\s*(\d{4})/)))
      out.donem = m[1] + ' ' + m[2];
    if ((m = l.match(/^\s*(\d+)\s+(.+?)\s+(\d{11})\s+(\d{2}\.\d{2}\.\d{4})(.*)$/))) {
      const rest = m[5];
      const nums = rest.match(para) || [];
      const g = rest.match(/(\d[\d.]*,\d{2})\s*([GS])\s+(\d+)/);
      const eksik = rest.match(/(\d+)\s+Gün/);
      const nxt = (lines[i + 1] || '').trim();
      const neden = eksik && /İzin|Rapor|Devamsız|Diğer/i.test(nxt) ? nxt.replace(/\s+/g, ' ') : '';
      out.kisiler.push({
        ad: m[2].replace(/\s+/g, ' ').trim(),
        tc: m[3],
        giris: m[4],
        sgkGun: g ? +g[3] : null,
        eksikGun: eksik ? +eksik[1] : 0,
        neden,
        net: nums.length ? sayi(nums[nums.length - 1]) : null,
      });
    }
    if ((m = l.match(/Toplamlar:/))) {
      const nums = l.match(para) || [];
      if (nums.length) out.toplam = sayi(nums[nums.length - 1]);
    }
  });
  {
    const m = String(out.donem || '').match(/^(\S+)\s+(\d{4})$/);
    if (m) {
      const ai = AY.findIndex(a => a.toLocaleUpperCase('tr-TR') === m[1].toLocaleUpperCase('tr-TR'));
      if (ai >= 0) {
        const dk = m[2] + '-' + String(ai + 1).padStart(2, '0');
        out.kisiler.forEach(k => {
          k.donemKey = dk;
        });
      }
    }
  }
  if (out.kisiler.length && !out.kisiler[0].donemKey)
    out.kisiler.forEach(k => {
      k.uyari = [...(k.uyari || []), 'Bordronun ayı okunamadı, doğru ay olduğunu kontrol edin'];
    });
  return out;
}
export function bordroPanel(V) {
  if (kilitEngel() || kesinEngel()) return;
  const ids = Object.keys(V.sol);
  let satirlar = [];
  const okunan = [];
  openSheet(
    `<h2>Bordro PDF yükle</h2><div class="sub">${esc(V.sb.ad)} · ${ayAdi(V.ak)}. Birden çok şubenin bordrosunu birlikte bırakabilirsiniz; sadece bu puantajdaki kişiler eşleşir, diğerleri atlanır. Net ödenen tutarlar veri girişine "Bankaya yatan" olarak eklenir.</div>
   <label class="drop" id="bDrop"><input id="bF" type="file" accept="application/pdf" multiple hidden><b>PDF'leri buraya sürükleyip bırakın</b><span>ya da tıklayıp seçin (birden fazla seçebilirsiniz)</span></label><div id="bDosya"></div><div id="bOut"></div>`,
    sh => {
      const tcMap = { ...((S.pt.maas && S.pt.maas.tc) || {}) };
      S.personel.forEach(q => {
        if (q.tc && !tcMap[q.id]) tcMap[q.id] = q.tc;
      });
      const D = byId('bDrop');
      ['dragenter', 'dragover'].forEach(ev =>
        D.addEventListener(ev, e => {
          e.preventDefault();
          D.classList.add('on');
        })
      );
      ['dragleave', 'drop'].forEach(ev =>
        D.addEventListener(ev, e => {
          e.preventDefault();
          D.classList.remove('on');
        })
      );
      D.addEventListener('drop', e => oku([...e.dataTransfer.files]));
      byId('bF').onchange = e => oku([...e.target.files]);
      const oku = async files => {
        files = files.filter(f => /pdf$/i.test(f.name) || f.type === 'application/pdf');
        if (!files.length) {
          toast('PDF dosyası seçin.');
          return;
        }
        byId('bOut').innerHTML = '<p class="note">PDF okunuyor…</p>';
        for (const f of files) {
          let r;
          try {
            r = await bordroOku(f, m => {
              byId('bOut').innerHTML = `<p class="note">${esc(m)} (ilk seferde birkaç saniye sürebilir)</p>`;
            });
          } catch (err) {
            okunan.push({ ad: f.name, hata: 'okunamadı (taranmış PDF olabilir)' });
            continue;
          }
          if (!r.kisiler.length) {
            okunan.push({ ad: f.name, hata: 'bordro satırı bulunamadı' });
            continue;
          }
          const top = r.kisiler.reduce((s, k) => s + (k.net || 0), 0);
          okunan.push({
            ad: f.name,
            isyeri: r.isyeri,
            donem: r.donem,
            n: r.kisiler.length,
            toplamOk: r.toplam == null || Math.abs(top - r.toplam) < 0.05,
            toplam: r.toplam,
            top,
          });
          r.kisiler.forEach(k => {
            const uyari = [...(k.uyari || [])];
            let pid = null,
              yol = null;
            // Önce TC (kayıtlıysa), sonra isim. Aynı isimde birden fazla kişi varsa ya da isim tutup TC farklıysa elle seçilir.
            if (k.tc) {
              pid = ids.find(id => tcMap[id] && tcMap[id] === k.tc) || null;
              if (pid) yol = isimAnahtar(V.sol[pid].ad) === isimAnahtar(k.ad) ? 'isim' : 'tc';
            }
            if (!pid) {
              const ad = ids.filter(id => isimAnahtar(V.sol[id].ad) === isimAnahtar(k.ad));
              if (ad.length === 1) {
                if (k.tc && tcMap[ad[0]] && tcMap[ad[0]] !== k.tc)
                  uyari.push('İsim tuttu ama TC farklı: kişiyi elle seçin');
                else {
                  pid = ad[0];
                  yol = 'isim';
                }
              } else if (ad.length > 1) uyari.push('Bu isimde birden fazla kişi var: elle seçin');
            }
            if (k.donemKey && k.donemKey !== V.ak) {
              uyari.push(`Dönem ${k.donemKey.slice(5)}/${k.donemKey.slice(0, 4)}, bu ay değil: atlanır`);
              pid = null;
              yol = null;
            }
            satirlar.push({ ...k, uyari, isyeri: k.isyeri || r.isyeri || f.name, pid, yol, netYazi: k.net });
          });
        }
        ciz();
      };
      const ciz = () => {
        // aynı kişi iki kez eşleşirse (aynı PDF iki kez bırakıldıysa vb.) ilki geçerli
        const gor = {};
        satirlar.forEach(k => {
          k.tekrar = false;
          if (!k.pid) return;
          if (gor[k.pid]) k.tekrar = true;
          else gor[k.pid] = 1;
        });
        byId('bDosya').innerHTML = okunan
          .map(
            o =>
              `<div class="tags" style="margin:6px 0 0"><span class="tag">${esc(o.ad)}</span>${o.hata ? `<span class="tag warn">${esc(o.hata)}</span>` : `<span class="tag">${esc(o.isyeri || '')}</span><span class="tag">${esc(o.donem || '')}</span><span class="tag ${o.toplamOk ? '' : 'warn'}">${o.n} kişi · ${tl(o.top)} ₺ ${o.toplamOk ? '✓' : '⚠ PDF toplamı ' + tl(o.toplam)}</span>`}</div>`
          )
          .join('');
        const baskaAy = k => !!(k.donemKey && k.donemKey !== V.ak);
        const es = satirlar.filter(k => k.pid && !k.tekrar && !baskaAy(k)),
          yok = satirlar.filter(k => !k.pid || baskaAy(k));
        const satir = k => {
          const j = satirlar.indexOf(k);
          const sol = k.pid && V.sol[k.pid];
          const fark = sol && k.sgkGun != null && sol.gun !== k.sgkGun;
          const p = k.pid && S.personel.find(q => q.id === k.pid);
          const h = p && bordroHedef(k.pid, V.ak, V);
          return `<tr class="${!k.pid ? 'oto' : k.tekrar ? 'hata' : ''}"><td class="l">${esc(k.ad)}<br><span class="tag">${esc(k.isyeri)}</span>${k.neden ? ` <span class="tag">${k.eksikGun} gün ${esc(k.neden)}</span>` : ''}${k.ocr ? ' <span class="tag">görselden okundu</span>' : ''}${(k.uyari || []).map(u => ` <span class="tag warn">${esc(u)}</span>`).join('')}</td>
         <td class="l"><select data-j="${j}" style="max-width:170px"><option value="">— bu şubede yok —</option>${ids.map(id => `<option value="${esc(id)}" ${id === k.pid ? 'selected' : ''}>${esc(V.sol[id].ad)}</option>`).join('')}</select>
         ${k.yol === 'tc' ? '<br><span class="tag warn">İsim tutmadı, TC ile eşleşti</span>' : ''}${k.tekrar ? '<br><span class="tag warn">Bu kişi başka satırda zaten var, atlanır</span>' : ''}${h && h !== S.subeId ? `<br><span class="tag">${paketBasiMi(k.pid) ? 'en çok çalıştığı şube' : 'maaşı'} ${esc(subeAdi(h))} → oraya işlenir</span>` : ''}</td>
         <td>${k.sgkGun ?? ''}</td><td>${sol ? sol.gun : ''}${fark ? ' <span class="tag warn">gün farkı</span>' : ''}</td>
         <td class="bi"><input data-n="${j}" value="${esc(k.netYazi == null ? '' : fmt(k.netYazi))}" inputmode="decimal" style="width:110px;text-align:right;font-weight:700" title="Okunan tutar yanlışsa düzeltin"></td></tr>`;
        };
        byId('bOut').innerHTML = satirlar.length
          ? `<p class="note" style="margin:8px 0 4px"><b>${es.length} kişi eşleşti</b>${yok.length ? ` · ${yok.length} kişi bu şubede yok (atlanır)` : ''}. Tutar yanlış okunduysa kutudan düzeltin.</p>
       <div class="tbl-wrap" style="max-height:48vh;overflow:auto"><table class="pt vt"><thead><tr><th class="l">Bordrodaki isim</th><th class="l">Personel</th><th>SGK gün</th><th>Puantaj gün</th><th>Net ödenen</th></tr></thead><tbody>${[...es, ...satirlar.filter(k => k.pid && k.tekrar), ...yok].map(satir).join('')}</tbody></table></div>
       <div class="row2"><button class="btn grow" id="bEk">+ PDF ekle</button><button class="btn primary grow" id="bOk" ${es.length ? '' : 'disabled'}>${es.length} kişinin bankaya yatanını işle</button></div>`
          : '';
        const be = byId('bEk');
        if (be) be.onclick = () => byId('bF').click();
        byId('bOut')
          .querySelectorAll('select[data-j]')
          .forEach(
            s =>
              (s.onchange = () => {
                const k = satirlar[+s.dataset.j];
                k.pid = s.value || null;
                k.yol = s.value ? 'elle' : null;
                ciz();
              })
          );
        byId('bOut')
          .querySelectorAll('input[data-n]')
          .forEach(
            i =>
              (i.onchange = () => {
                const bos = i.value.trim() === '';
                satirlar[+i.dataset.n].netYazi = bos ? null : sayi(i.value);
                i.value = bos ? '' : fmt(sayi(i.value));
              })
          );
        const ok = byId('bOk');
        if (ok)
          ok.onclick = () => {
            const tutarli = es.filter(k => k.netYazi != null);
            if (tutarli.length < es.length)
              toast(`${es.length - tutarli.length} kişinin net tutarı boş, atlandı.`);
            isle(tutarli);
          };
      };
      const isle = async es => {
        const sid0 = S.subeId,
          ak = V.ak;
        if (sid0 !== S.pt.sube || ak !== S.ay) {
          toast('Ekran değişti, bordroyu yeniden yükleyin.');
          return;
        }
        if (await kilitliMi(ptK(sid0, ak))) return;
        const deg = {},
          tcYeni = {};
        es.forEach(k => {
          deg[k.pid] = { bankaya: sayi(k.netYazi), kaynak: k.isyeri };
          if (!tcMap[k.pid] && k.tc) tcYeni[k.pid] = k.tc;
        });
        const n = Object.keys(deg).length;
        if (!n) {
          toast('Eşleşen personel yok.');
          return;
        }
        try {
          if (Object.keys(tcYeni).length)
            setDoc(doc(db, 'maaslar', sid0), { tc: tcYeni }, { merge: true }).catch(yazmaHatasi);
          const sonGun = ymd(new Date(+ak.slice(0, 4), +ak.slice(5), 0));
          const kim = S.me.adSoyad || S.me.kullaniciAdi || '';
          const z = new Date().toISOString();
          const hedefOf = pid => bordroHedef(pid, ak, V) || sid0;
          const satirOf = pid => ({
            id: Math.random().toString(36).slice(2, 10),
            sira: yeniSira(),
            tarih: sonGun,
            ad: adBuyuk(V.sol[pid].ad),
            pid,
            tur: 'BY',
            miktar: deg[pid].bankaya,
            aciklama: `Bordro PDF (${deg[pid].kaynak || V.sb.ad})`,
            kaynak: 'bordro',
            kim,
            zaman: z,
          });
          const burada = Object.keys(deg).filter(pid => hedefOf(pid) === sid0),
            disari = {};
          Object.keys(deg).forEach(pid => {
            const h = hedefOf(pid);
            if (h !== sid0) (disari[h] = disari[h] || []).push(pid);
          });
          // Aynı kişinin önceki bordro satırı yenisiyle değişir; diğer satırlara dokunulmaz.
          const mevcut = (sid0 === S.pt.sube && ak === S.ay && S.pt.doc ? S.pt.doc.veri : V.D.veri) || [];
          const silB = mevcut.filter(v => v.kaynak === 'bordro' && burada.includes(v.pid)).map(v => v.id);
          const yeniS = burada.map(satirOf);
          const yeni = [...mevcut.filter(v => !silB.includes(v.id)), ...yeniS];
          const degS = {};
          Object.keys(deg).forEach(pid => (degS[pid] = { bankaya: '' }));
          if (sid0 === S.pt.sube && ak === S.ay) S.pt.doc = { ...(S.pt.doc || {}), veri: yeni };
          const V2 = { ...V, D: { ...V.D, veri: yeni } };
          const sag = sagSonuclu(V2, degS);
          veriYaz(
            sid0,
            ak,
            { deg: Object.fromEntries(yeniS.map(r => [r.id, r])), sil: silB },
            { ...(V.kilitli ? {} : { sube: sid0, ay: ak }), sag: sagYama(sag, Object.keys(deg)) },
            { kilitsiz: true }
          );
          const giden = [],
            yetkiYok = [];
          for (const [h, L] of Object.entries(disari)) {
            if (!(isIsveren() || (S.me.subeler || []).includes(h))) {
              yetkiYok.push(subeAdi(h) + ': ' + L.map(pid => adBuyuk(V.sol[pid].ad)).join(', '));
              continue;
            }
            const s0 = await getDoc(doc(db, 'puantaj', h, 'aylar', ak));
            const d0 = s0.exists() ? s0.data() : {};
            const silH = veriListesi(d0)
              .filter(v => v.kaynak === 'bordro' && L.includes(v.pid))
              .map(v => v.id);
            const yeniH = L.map(satirOf);
            veriYaz(
              h,
              ak,
              { deg: Object.fromEntries(yeniH.map(r => [r.id, r])), sil: silH },
              d0.kilitli ? {} : { sube: h, ay: ak },
              { kilitsiz: true }
            );
            giden.push(`${L.length} kişi → ${subeAdi(h)}`);
          }
          closeSheet();
          toast(`${burada.length} kişi bu şubeye işlendi${giden.length ? ', ' + giden.join(', ') : ''}.`);
          render();
          if (yetkiYok.length)
            openSheet(
              `<h2>Bazı tutarlar işlenemedi</h2><div class="sub">Bu kişilerin maaşı yetkiniz olmayan şubede ödeniyor. Tutarları o şubenin bölge müdürü veri girişine "Bankaya yatan" olarak girmeli.</div><div class="card" style="padding:12px">${yetkiYok.map(esc).join('<br>')}</div><div class="row2"><button class="btn primary grow" onclick="document.getElementById('sheetRoot').innerHTML=''">Tamam</button></div>`
            );
        } catch (e) {
          yazmaHatasi(e);
        }
      };
    }
  );
}
