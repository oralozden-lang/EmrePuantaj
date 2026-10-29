// personel-yapistir.js — app.js (v180) satırları 1230-1260. Otomatik bölündü; davranış değişmedi.
import { doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { SGK_YOK, gorevBul, subeAdi } from './sabitler.js';
import { db, writeBatch } from './firebase.js';
import { S } from './durum.js';
import { addDays, ascii, esc, isimAnahtar, mondayOf, parse, slug, today, trTarih, ymd } from './yardimci.js';
import { sube } from './hesap.js';
import { yazmaHatasi } from './yazma.js';
import { tumSubeler } from './subeler.js';
import { byId, render } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { subePersoneli } from './personel.js';
import { trTarihCoz } from './veri-girisi.js';
import { adBuyuk } from './isim-esle.js';

// Excel'den personel listesi yapıştırma: SGK ŞUBE · ÇALIŞMA ŞEKLİ · ADI SOYADI · GÖREV · GİRİŞ · ÇIKIŞ (başlık varsa sütunlar ona göre bulunur)
export function gorevCoz(x) {
  const a = ascii(x)
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!a) return null;
  if (/esnaf/.test(a)) return gorevBul('Esnaf Kurye');
  if (/surucu|kurye|motor/.test(a)) return gorevBul('Kurye');
  if (/^r\b|restoran|^mudur$|^r mudur/.test(a)) return gorevBul('R. Müdür');
  if (/^v\b|vardiya|^v mudur|yardimci/.test(a)) return gorevBul('V. Müdür');
  if (/mutfak|ekip|personel|ekip uyesi/.test(a)) return gorevBul('Mutfak');
  return null;
}
export function personelYapistirPanel() {
  const sid = S.subeId;
  openSheet(
    `<h2>Excel'den personel ekle</h2><div class="sub">${esc(sube().ad)} listesine eklenir. Sütunlar: SGK ŞUBE · ÇALIŞMA ŞEKLİ · ADI SOYADI · GÖREV · GİRİŞ TARİHİ · ÇIKIŞ TARİHİ. Başlık satırını da kopyalarsanız sütun sırası önemli değil.</div>
   <label class="field"><span>Excel'den kopyaladığınız satırlar</span><textarea id="piT" rows="5" placeholder="Excel'de satırları seçip Ctrl+C, buraya Ctrl+V"></textarea></label><div id="piOut"></div>`,
    () => {
      const T = byId('piT');
      let sonuc = [];
      const coz = () => {
        let L = T.value
          .replace(/\r/g, '')
          .split('\n')
          .filter(x => x.trim())
          .map(x => x.split('\t').map(y => y.trim()));
        if (!L.length) {
          byId('piOut').innerHTML = '';
          return;
        }
        let sira = { sgk: 0, sekil: 1, ad: 2, gorev: 3, giris: 4, cikis: 5 };
        const bas = L[0].map(x => ascii(x));
        if (bas.some(x => /adi|soyad/.test(x))) {
          sira = {};
          bas.forEach((x, j) => {
            if (/sgk/.test(x)) sira.sgk = j;
            else if (/calisma|sekil/.test(x)) sira.sekil = j;
            else if (/adi|soyad|isim/.test(x)) sira.ad = j;
            else if (/gorev/.test(x)) sira.gorev = j;
            else if (/giris/.test(x)) sira.giris = j;
            else if (/cikis/.test(x)) sira.cikis = j;
          });
          L = L.slice(1);
        }
        const subeAd = {};
        tumSubeler().forEach(([id, a]) => (subeAd[isimAnahtar(a)] = id));
        const mevcut = subePersoneli(sid);
        const gorulen = {};
        sonuc = L.map(r => {
          const al = k => (sira[k] != null ? r[sira[k]] || '' : '');
          const ad = adBuyuk(al('ad'));
          const o = { ad, hata: '', uyari: '' };
          if (!ad) {
            o.hata = 'İsim yok';
            return o;
          }
          const sg = al('sgk');
          o.sgk = sg ? subeAd[isimAnahtar(sg)] : SGK_YOK;
          if (sg && !o.sgk) o.hata = `SGK şubesi bulunamadı: ${sg}`;
          const g = gorevCoz(al('gorev'));
          o.gorev = g;
          if (!g) o.hata = o.hata || `Görev tanınmadı: ${al('gorev') || 'boş'}`;
          const sk = ascii(al('sekil'));
          o.sekil = g && g.sekil ? g.sekil : /part/.test(sk) ? 'Part' : 'Tam';
          o.giris = al('giris') ? trTarihCoz(al('giris')) : '';
          o.cikis = al('cikis') ? trTarihCoz(al('cikis')) : '';
          if (al('giris') && !o.giris) o.hata = o.hata || 'Giriş tarihi okunamadı';
          if (al('cikis') && !o.cikis) o.hata = o.hata || 'Çıkış tarihi okunamadı';
          if (o.giris && o.cikis && o.cikis < o.giris) o.hata = o.hata || 'Çıkış girişten önce';
          const k = isimAnahtar(ad);
          const var_ = mevcut.find(p => isimAnahtar(p.ad) === k);
          if (var_) {
            o.hata = o.hata || 'Listede zaten var';
          }
          if (gorulen[k]) {
            o.uyari = 'Aynı isim bu yapıştırmada iki kez var';
          }
          gorulen[k] = 1;
          if (!o.hata && o.sgk && o.sgk !== SGK_YOK) {
            const c = S.personel.find(
              x =>
                isimAnahtar(x.ad) === k &&
                x.sgkSube &&
                x.sgkSube !== SGK_YOK &&
                x.sgkSube !== o.sgk &&
                (!x.cikis || x.cikis >= ymd(today()))
            );
            if (c) o.hata = `Zaten ${subeAdi(c.sgkSube)} şubesinde SGK'lı`;
          }
          o.sec = !o.hata && !o.uyari;
          return o;
        });
        const iyi = sonuc.filter(x => !x.hata).length;
        byId('piOut').innerHTML =
          `<div class="tbl-wrap" style="max-height:46vh;overflow:auto"><table class="pt"><thead><tr><th></th><th class="l">Ad soyad</th><th>Görev</th><th>Şekil</th><th>SGK</th><th>Giriş</th><th>Çıkış</th><th class="l">Durum</th></tr></thead><tbody>${sonuc.map((o, j) => `<tr class="${o.hata ? 'oto' : ''}"><td>${o.hata ? '' : `<input type="checkbox" data-j="${j}" ${o.sec ? 'checked' : ''}>`}</td><td class="l"><b>${esc(o.ad)}</b></td><td>${o.gorev ? esc(o.gorev.ad) : ''}</td><td>${esc(o.sekil || '')}</td><td>${o.sgk === SGK_YOK ? 'Boş' : o.sgk ? esc(subeAdi(o.sgk)) : ''}</td><td>${trTarih(o.giris)}</td><td>${trTarih(o.cikis)}</td><td class="l">${o.hata ? `<span class="chip warn">${esc(o.hata)}</span>` : o.uyari ? `<span class="chip warn">${esc(o.uyari)}</span>` : '<span class="chip ok">Eklenecek</span>'}</td></tr>`).join('')}</tbody></table></div>
       <div class="row2"><button class="btn grow" id="piNo">Vazgeç</button><button class="btn primary grow" id="piOk" ${iyi ? '' : 'disabled'}>Seçilenleri ekle</button></div>`;
        byId('piNo').onclick = closeSheet;
        byId('piOut')
          .querySelectorAll('input[data-j]')
          .forEach(
            c =>
              (c.onchange = () => {
                sonuc[+c.dataset.j].sec = c.checked;
              })
          );
        byId('piOk').onclick = async () => {
          const L2 = sonuc.filter(o => !o.hata && o.sec);
          if (!L2.length) {
            toast('Seçili kişi yok.');
            return;
          }
          const b = writeBatch(db);
          const yeni = [];
          const td = ymd(today());
          L2.forEach(o => {
            const pid = slug(o.ad) + '-' + Math.random().toString(36).slice(2, 6);
            const body = {
              ad: o.ad,
              gorev: o.gorev.ad,
              grup: o.gorev.grup,
              sekil: o.sekil,
              giris: o.giris || '',
              cikis: o.cikis || '',
              sgkSube: o.sgk,
              anaSube: sid,
            };
            b.set(doc(db, 'personel', pid), body);
            yeni.push({ id: pid, ...body });
          });
          try {
            await b.commit();
            yeni.forEach(p => {
              if (!S.personel.some(x => x.id === p.id)) S.personel.push(p);
            });
            const hafta = mondayOf(today());
            const aktif = yeni.filter(
              p => (!p.cikis || p.cikis >= td) && (!p.giris || p.giris <= ymd(addDays(parse(hafta), 6)))
            );
            /* çizelgeye otomatik eklenmez */ void aktif;
            void hafta;
            closeSheet();
            toast(
              `${yeni.length} personel eklendi${aktif.length ? `, ${aktif.length} kişi bu haftanın çizelgesine kondu` : ''}.`
            );
            render();
          } catch (e) {
            yazmaHatasi(e);
          }
        };
      };
      T.oninput = coz;
      T.focus();
    }
  );
}
