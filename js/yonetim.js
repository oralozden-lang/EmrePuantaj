// yonetim.js — app.js (v180) satırları 2297-2373. Otomatik bölündü; davranış değişmedi.
import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { BASLANGIC_AY, ROL, VARSAYILAN, subeAdi } from './sabitler.js';
import { arka, db, setDoc, writeBatch } from './firebase.js';
import { S } from './durum.js';
import {
  ayAdi,
  ayKey,
  bas,
  esc,
  fmt,
  isimAnahtar,
  normTime,
  sayi,
  slug,
  tl0,
  tnum,
  today,
} from './yardimci.js';
import { SON_SAAT_AZAMI } from './saat.js';
import { isBolge, isIsveren } from './rol.js';
import { ayarGecmisYama, sube } from './hesap.js';
import { sirayla, yazmaHatasi } from './yazma.js';
import { sunucuHazir } from './hucre-yazma.js';
import { selectSube } from './subeler.js';
import { byId, render, view } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { renderIbanBolum } from './iban-listesi.js';
import { excelAktarPanel } from './excel-aktar.js';
import { renderYedek } from './yedek.js';
import { renderIscilik } from './iscilik.js';
import { kullaniciPanel, sifreOf } from './kullanici.js';

/* ================= Yönetim (işveren) ================= */
export function renderYonetim() {
  if (!isIsveren() && !isBolge()) return;
  const iv = isIsveren();
  let bolum = S.ynt || 'subeler';
  if (!iv && bolum === 'yedek') bolum = 'subeler';
  let h = `<div class="seg" style="margin:4px 0 12px" id="ySeg"><button data-v="subeler" class="${bolum === 'subeler' ? 'on' : ''}">Şubeler</button><button data-v="kullanicilar" class="${bolum === 'kullanicilar' ? 'on' : ''}">Kullanıcılar</button><button data-v="iscilik" class="${bolum === 'iscilik' ? 'on' : ''}">İşçilik</button><button data-v="iban" class="${bolum === 'iban' ? 'on' : ''}">IBAN</button>${iv ? `<button data-v="yedek" class="${bolum === 'yedek' ? 'on' : ''}">Yedek</button>` : ''}</div>`;
  if (bolum === 'yedek') return renderYedek(h);
  if (bolum === 'iscilik') return renderIscilik(h);
  if (bolum === 'iban') return renderIbanBolum(h);
  if (bolum === 'subeler') {
    const hf = S.subeIds.filter(id => sube(id).fmDonem === 'hafta').length;
    h += `${iv ? '<div class="actions"><button class="btn primary grow" id="ySubeEkle">Şube ekle</button></div>' : '<p class="note" style="margin:0 0 8px">Şube ayarlarını işveren değiştirir.</p>'}
     ${
       iv
         ? `<div class="card" style="padding:12px;margin-bottom:10px"><span class="lbl" style="margin-top:0">Tüm şubelerde fazla mesai dönemi</span><div class="seg" id="yDon"><button data-v="hafta" class="${hf === S.subeIds.length ? 'on' : ''}">Haftalık (örn. Eylül: 7 Eyl – 4 Eki)</button><button data-v="ay" class="${hf === 0 ? 'on' : ''}">Takvim ayı</button></div>
     <p class="note" style="margin-bottom:0">Şu an ${hf} / ${S.subeIds.length} şube haftalık. Seçince tüm şubelere uygulanır; tek tek şube ayarından da değiştirilebilir.</p></div>`
         : ''
     }`;
    h += S.subeIds.length
      ? `<div class="card list">${S.subeIds
          .map(id => {
            const s = sube(id);
            return `<button class="row" ${iv ? `data-sid="${esc(id)}"` : ''}><div class="av">${esc(bas(s.ad))}</div><div class="m"><b>${esc(s.ad)}</b><span>${esc(s.acilis)}–${esc(s.kapanis)} · günlük ${fmt(s.gunluk)} sa · FM ${s.fmYontem === 'maas' ? 'maaş ÷ 30 ÷ 9' : tl0(s.fmUcret) + '/sa'}</span></div></button>`;
          })
          .join('')}</div>`
      : `<div class="empty-state"><b>Henüz şube yok</b>İlk şubeyi ekleyin.</div>`;
  } else {
    h += `<div class="actions"><button class="btn primary grow" id="yKulEkle">${iv ? 'Kullanıcı ekle' : 'Şube müdürü ekle'}</button></div>`;
    // Şifre listesi durumu: kurallar yayınlanmadıysa okunamaz; eski kullanıcıların şifresi kayıtlı değildir.
    if (S.sifreHata)
      h += `<div class="banner bad"><b>Şifreler okunamıyor.</b> Firebase kuralları güncel değil: Firestore → Kurallar sekmesine GitHub'daki firestore.rules dosyasını yapıştırıp Yayınla'ya basın, sonra uygulamayı kapatıp açın.</div>`;
    else {
      const yok = (S.users || []).filter(u => !sifreOf(u.uid) && !(S.sifreIstek || {})[u.uid]).length;
      if (yok)
        h += `<div class="banner">${yok} kullanıcının şifresi kayıtlı değil (şifre kaydı eklenmeden önce açılmışlar). Kullanıcıya dokunup yeni şifre verin; eski şifreyi bilmeniz gerekmez.</div>`;
      const eski = Object.values(S.sifreIstek || {}).filter(
        x => !x.hata && x.t && Date.now() - new Date(x.t).getTime() > 20 * 60000
      ).length;
      if (eski)
        h += `<div class="banner bad">${eski} şifre isteği 20 dakikadır uygulanmadı. GitHub'daki "Kullanıcı işlemleri" otomasyonu kurulmamış olabilir (FIREBASE_SERVICE_ACCOUNT anahtarı).</div>`;
    }
    if (!iv && S.kulHata)
      h += `<div class="banner bad">Kullanıcı listesi okunamadı. İşveren Firebase kurallarını güncellemeli (firestore.rules).</div>`;
    if (!iv && !S.users.length && !S.kulHata)
      h += `<p class="note">Henüz şube müdürü yok ya da işveren listeyi henüz eşlemedi (işveren uygulamayı bir kez açınca kendiliğinden eşlenir).</p>`;
    const us = S.users
      .slice()
      .sort(
        (a, b) =>
          ['isveren', 'bolge', 'sube'].indexOf(a.rol) - ['isveren', 'bolge', 'sube'].indexOf(b.rol) ||
          String(a.adSoyad).localeCompare(String(b.adSoyad), 'tr')
      );
    h += `<div class="card list">${us
      .map(
        u => `<button class="row" data-uid="${esc(u.uid)}"><div class="av">${esc(bas(u.adSoyad || u.kullaniciAdi))}</div><div class="m"><b>${esc(u.adSoyad || u.kullaniciAdi)}</b><span>${esc(u.kullaniciAdi)} · ${u.rol === 'isveren' ? 'Tüm şubeler' : (u.subeler || []).map(s => (S.subeler[s] ? S.subeler[s].ad : s)).join(', ') || 'Şube atanmamış'}</span></div>
      <span class="chip ${u.aktif === false ? 'mut' : u.rol === 'isveren' ? 'warn' : u.rol === 'bolge' ? 'ok' : 'mut'}">${u.aktif === false ? 'Pasif' : ROL[u.rol] || u.rol}</span>${S.sifreHata || sifreOf(u.uid) ? '' : (S.sifreIstek || {})[u.uid] ? '<span class="chip warn" title="Yeni şifre bekliyor">şifre bekliyor</span>' : '<span class="chip mut" title="Şifre kayıtlı değil">şifre ?</span>'}</button>`
      )
      .join('')}</div>`;
  }
  view(h, () => {
    document.querySelectorAll('#ySeg button').forEach(
      b =>
        (b.onclick = () => {
          S.ynt = b.dataset.v;
          render();
        })
    );
    document.querySelectorAll('#yDon button').forEach(
      b =>
        (b.onclick = async () => {
          const v = b.dataset.v;
          const bt = writeBatch(db);
          S.subeIds.forEach(id =>
            bt.set(
              doc(db, 'subeler', id),
              { fmDonem: v, ...ayarGecmisYama(id, { fmDonem: v }) },
              { merge: true }
            )
          );
          try {
            await bt.commit();
            toast(`Tüm şubelerde fazla mesai dönemi: ${v === 'hafta' ? 'haftalık' : 'takvim ayı'}.`);
          } catch (e) {
            yazmaHatasi(e);
          }
        })
    );
    const se = byId('ySubeEkle');
    if (se) se.onclick = () => subePanel(null);
    document.querySelectorAll('[data-sid]').forEach(b => (b.onclick = () => subePanel(b.dataset.sid)));
    const ke = byId('yKulEkle');
    if (ke) ke.onclick = () => kullaniciPanel(null);
    document.querySelectorAll('[data-uid]').forEach(b => (b.onclick = () => kullaniciPanel(b.dataset.uid)));
  });
}
// Şube silme (işveren): sadece hiç verisi olmayan şube silinir. Personeli, haftası ya da puantajı olan şube silinirse geçmiş kayıtlar sahipsiz kalır; bu yüzden engellenir.
// Şubeyi bütün verisiyle siler (sadece işveren): çizelge haftaları, ay durumları, puantaj (ödemeler, veri girişi), maaşlar, çalıştığı şube bu şube olan personel,
// şubeler arası ay özetleri (kurallar silmeye izin vermediği için boşaltılır), işçilik kayıtları. Diğer şubelerdeki personelden bu şubeye bağlar kaldırılır. Geri alınamaz.
export async function subeSil(id, btn, W) {
  if (!isIsveren()) return;
  const ad = subeAdi(id);
  const pSil = S.personel.filter(p => p.anaSube === id);
  const pBag = S.personel.filter(
    p =>
      p.anaSube !== id &&
      (p.sgkSube === id ||
        (p.ekSubeler || []).includes(id) ||
        (p.gorunurSubeler || []).includes(id) ||
        Object.values(p.maasSubeGecmis || {}).includes(id))
  );
  if (!btn.dataset.ok) {
    btn.dataset.ok = '1';
    btn.textContent = 'Evet, her şeyiyle sil';
    W.innerHTML = `<div class="confirm bad"><b>${esc(ad)} şubesi bütün verisiyle silinecek. Geri alınamaz.</b><br>Silinecekler: çizelgeler ve mesailer, hafta kapatmaları, ay onayları, puantaj (ödemeler, veri girişi), net maaşlar, şubenin işçilik rakamları ve ${pSil.length} personel (çalıştığı şube ${esc(ad)} olanlar)${pBag.length ? `. Diğer şubelerdeki ${pBag.length} kişiden bu şubeye bağ (SGK şubesi, diğer çalıştığı şube, maaş şubesi) kaldırılır` : ''}. Önce Yönetim → Yedek'ten yedek almanız önerilir.</div>
      <label class="field"><span>Onaylamak için şube adını yazın: ${esc(ad)}</span><input id="sSilAd" autocomplete="off"></label>`;
    return;
  }
  const yazilan = (byId('sSilAd') || {}).value || '';
  if (isimAnahtar(yazilan) !== isimAnahtar(ad)) {
    const e = byId('sSilAd');
    if (e) e.focus();
    toast('Şube adını aynen yazın.');
    return;
  }
  btn.disabled = true;
  const geri = m => {
    btn.disabled = false;
    btn.dataset.ok = '';
    btn.textContent = 'Şubeyi sil';
    W.innerHTML = `<div class="confirm bad">${m}</div>`;
  };
  const paket = async ops => {
    for (let i = 0; i < ops.length; i += 400) {
      const bb = writeBatch(db);
      ops.slice(i, i + 400).forEach(f => f(bb));
      await bb.commit();
    }
  };
  try {
    btn.textContent = 'Siliniyor…';
    // 1) Ay durumları önce (kesin kapanmış aya değen hafta, ay silinmeden silinemez), sonra haftalar, durum, puantaj.
    const ay = await getDocs(collection(db, 'subeler', id, 'aylar'));
    await paket(ay.docs.map(d => bb => bb.delete(d.ref)));
    const [hf, du, pt] = await Promise.all([
      getDocs(collection(db, 'subeler', id, 'haftalar')),
      getDocs(collection(db, 'subeler', id, 'durum')),
      getDocs(collection(db, 'puantaj', id, 'aylar')),
    ]);
    await paket([...hf.docs, ...du.docs, ...pt.docs].map(d => bb => bb.delete(d.ref)));
    // 2) Şubeler arası ay özetleri silinemez, boşaltılır. İşçilik kayıtlarından şube çıkarılır.
    const oz = await getDocs(query(collection(db, 'ozetler'), where('sube', '==', id)));
    await paket(
      oz.docs.map(
        d => bb =>
          bb.set(d.ref, {
            sube: id,
            ay: (d.data() || {}).ay || '',
            kisiler: {},
            veriGun: {},
            guncellendi: new Date().toISOString(),
          })
      )
    );
    const isc = await getDocs(collection(db, 'iscilik'));
    await paket(
      isc.docs.map(
        d => bb =>
          bb.update(
            d.ref,
            d.id === 'sabit'
              ? { ['lojman.' + id]: deleteField() }
              : { ['hesap.' + id]: deleteField(), ['subeler.' + id]: deleteField() }
          )
      )
    );
    // 3) Personel: çalıştığı şube bu şube olanlar silinir; diğerlerinden bu şubeye bağ kaldırılır.
    await paket([
      ...pSil.map(p => bb => bb.delete(doc(db, 'personel', p.id))),
      ...pBag.map(p => bb => {
        const g = { ...(p.maasSubeGecmis || {}) };
        Object.keys(g).forEach(k => {
          if (g[k] === id) delete g[k];
        });
        bb.update(doc(db, 'personel', p.id), {
          ...(p.sgkSube === id ? { sgkSube: '' } : {}),
          ekSubeler: (p.ekSubeler || []).filter(x => x !== id),
          gorunurSubeler: (p.gorunurSubeler || []).filter(x => x !== id),
          maasSubeGecmis: g,
          maasSubeleri: [...new Set(Object.values(g).filter(Boolean))],
        });
      }),
    ]);
    // 4) Şube, listesi, maaşlar; kullanıcıların şube ataması.
    const b = writeBatch(db);
    b.delete(doc(db, 'subeler', id));
    b.delete(doc(db, 'ekPersonel', id));
    b.delete(doc(db, 'maaslar', id));
    (S.users || [])
      .filter(u => (u.subeler || []).includes(id))
      .forEach(u => b.update(doc(db, 'kullanicilar', u.uid), { subeler: u.subeler.filter(x => x !== id) }));
    await b.commit();
    S.personel = S.personel.filter(p => p.anaSube !== id);
    closeSheet();
    toast(`${ad} şubesi bütün verisiyle silindi.`);
  } catch (e) {
    console.error(e);
    geri(
      "Şube silinemedi, bir kısmı silinmiş olabilir. Tekrar Şubeyi sil'e basarak kalanları silebilirsiniz. (" +
        esc(e.message || e.code || '') +
        ')'
    );
  }
}
export function subePanel(id) {
  const s = id ? sube(id) : { ...VARSAYILAN, ad: '' };
  openSheet(
    `<h2>${id ? 'Şube ayarları' : 'Yeni şube'}</h2><div class="sub">Vardiya renkleri ve fazla mesai bu ayarlara göre hesaplanır.${id ? ` Mesai ve ücret ayarlarındaki değişiklik ${ayAdi(ayKey(today()) < BASLANGIC_AY ? BASLANGIC_AY : ayKey(today()))} ayından itibaren geçerli olur; önceki aylar eski ayarla kalır.` : ''}</div>
   <label class="field"><span>Şube adı</span><input id="sAd" value="${esc(s.ad)}" placeholder="Altınkale"></label>
   <div class="fgrid"><label class="field"><span>Açılış</span><input id="sAc" inputmode="numeric" value="${esc(s.acilis)}"></label><label class="field"><span>Kapanış</span><input id="sKa" inputmode="numeric" value="${esc(s.kapanis)}"></label>${/legends/i.test(s.ad || '') || s.sonSaat ? `<label class="field"><span>Saat listesi son saati</span><input id="sSon" inputmode="numeric" placeholder="örn. 02:30" value="${esc(s.sonSaat || '')}"></label>` : ''}
   <label class="field"><span>Günlük mesai (sa)</span><input id="sGu" inputmode="decimal" value="${s.gunluk}"></label><div class="note" style="align-self:end;margin:0 0 14px">Haftalık mesai otomatik: günlük × 6</div></div>
   <span class="lbl">Fazla mesai ücreti</span><div class="seg" id="sYon"><button data-v="sabit" class="${s.fmYontem !== 'maas' ? 'on' : ''}">Sabit saat ücreti</button><button data-v="maas" class="${s.fmYontem === 'maas' ? 'on' : ''}">Maaşına göre</button></div>
   <p class="note" style="margin:4px 0 0">Sabit: şubedeki herkes aynı saat ücretiyle (örn. 125, 165). Maaşına göre: maaş ÷ 30 ÷ 9, küsurat atılır; kişi ödeme penceresinden tek tek "Elle yaz" ile saat ücretini kendin yazabilirsin.</p>
   <label class="field" id="sUcW"><span>Saat ücreti (₺)</span><input id="sUc" inputmode="decimal" value="${s.fmUcret}"></label>
   <span class="lbl">Fazla mesai dönemi</span><div class="seg" id="sDon"><button data-v="ay" class="${s.fmDonem !== 'hafta' ? 'on' : ''}">Takvim ayı</button><button data-v="hafta" class="${s.fmDonem === 'hafta' ? 'on' : ''}">Haftalık</button></div>
   <p class="note" style="margin-top:4px">Haftalık: pazartesisi o ayda olan haftalar sayılır. Örnek Eylül 2026: 7 Eylül – 4 Ekim. Rapor, izin ve bordro günü her iki durumda da takvim ayına göredir.</p><div id="sErr"></div>
   <div class="row2"><button class="btn grow" id="sNo">Vazgeç</button><button class="btn primary grow" id="sOk">Kaydet</button></div>
   ${id ? `<div class="row2"><button class="btn grow" id="sX">Excel'den çizelge aktar</button></div>` : ''}${id && isIsveren() ? `<div class="row2"><button class="btn danger grow" id="sSil">Şubeyi sil</button></div>` : ''}`,
    sh => {
      const ss = byId('sSil');
      if (ss) ss.onclick = () => subeSil(id, ss, byId('sErr'));
      const sx = byId('sX');
      if (sx)
        sx.onclick = () => {
          closeSheet();
          if (S.subeId !== id) selectSube(id);
          let n = 0;
          const bekle = () => {
            if (sunucuHazir(id)) excelAktarPanel(id);
            else if (++n < 200) setTimeout(bekle, 150);
            else toast('Şube verileri yüklenemedi, Excel aktarımı açılmadı.');
          };
          bekle();
        };
      const yb = sh.querySelectorAll('#sYon button');
      const tog = () => (byId('sUcW').hidden = sh.querySelector('#sYon .on').dataset.v === 'maas');
      yb.forEach(
        b =>
          (b.onclick = () => {
            yb.forEach(x => x.classList.remove('on'));
            b.classList.add('on');
            tog();
          })
      );
      tog();
      const db_ = sh.querySelectorAll('#sDon button');
      db_.forEach(
        b =>
          (b.onclick = () => {
            db_.forEach(x => x.classList.remove('on'));
            b.classList.add('on');
          })
      );
      byId('sNo').onclick = closeSheet;
      byId('sOk').onclick = () => {
        const ad = byId('sAd').value.trim(),
          ac = normTime(byId('sAc').value),
          ka = normTime(byId('sKa').value);
        if (!ad || !ac || !ka) {
          byId('sErr').innerHTML =
            '<div class="confirm">Şube adı, açılış ve kapanış saati gerekli (örn. 11:00 ve 00:30).</div>';
          return;
        }
        const gu = sayi(byId('sGu').value);
        if (!(gu > 0 && gu <= 16)) {
          byId('sErr').innerHTML =
            '<div class="confirm">Günlük mesai 1–16 saat arasında olmalı (örn. 8,5).</div>';
          return;
        }
        const sid = id || slug(ad);
        if (!id && S.subeler[sid]) {
          byId('sErr').innerHTML = '<div class="confirm">Bu isimde bir şube var.</div>';
          return;
        }
        const sonEl = byId('sSon');
        const sonRaw = sonEl ? sonEl.value.trim() : s.sonSaat || '';
        const son = sonRaw ? normTime(sonRaw) : '';
        if (sonRaw && !son) {
          byId('sErr').innerHTML =
            '<div class="confirm">Saat listesi son saati geçersiz (örn. 02:30) ya da boş bırakın.</div>';
          return;
        }
        if (son) {
          let t = tnum(son);
          const op = tnum(ac);
          while (t <= op) t += 24;
          if (t - op > SON_SAAT_AZAMI) {
            byId('sErr').innerHTML =
              `<div class="confirm">Saat listesi son saati açılıştan en fazla ${SON_SAAT_AZAMI} saat sonra olabilir (örn. 02:30).</div>`;
            return;
          }
        }
        const body = {
          ad,
          acilis: ac,
          kapanis: ka,
          sonSaat: son,
          gunluk: sayi(byId('sGu').value) || 8.5,
          fmYontem: sh.querySelector('#sYon .on').dataset.v,
          fmUcret: sayi(byId('sUc').value),
          fmDonem: sh.querySelector('#sDon .on').dataset.v,
        };
        if (id) Object.assign(body, ayarGecmisYama(id, body));
        sirayla('s' + sid, () => {
          arka(setDoc(doc(db, 'subeler', sid), body, { merge: true }));
        });
        closeSheet();
        toast(id ? 'Şube ayarları kaydedildi.' : `${ad} şubesi eklendi.`);
      };
    }
  );
}
