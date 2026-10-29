// oturum.js — app.js (v180) satırları 576-614. Otomatik bölündü; davranış değişmedi.
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc as fsSetDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { auth, ayarliMi, db, writeBatch } from './firebase.js';
import { APP_SURUM, S, subs, tryLS } from './durum.js';
import { eposta, esc, mondayOf, today, ymd } from './yardimci.js';
import { isIsveren } from './rol.js';
import { KL, kilitBirak } from './kilit.js';
import { subeleriDinle } from './subeler.js';
import { byId, top, view } from './cerceve.js';
import { toast } from './panel.js';

/* ================= Başlangıç ve oturum ================= */
export function bootstrap() {
  if (tryLS('pm.yardim') === '1') document.body.classList.add('yardim-acik');
  if (!ayarliMi) {
    view(
      `<div class="login"><div class="card"><h2>Kurulum gerekli</h2><p class="note" style="margin:6px 0 0">config.js dosyasına Firebase proje bilgilerini yapıştırın.</p></div></div>`
    );
    top('Puantaj Merkezi', 'Kurulum');
    return;
  }
  S.hafta = mondayOf(today());
  S.tab = tryLS('pm.tab') || 'cizelge';
  try {
    const g = JSON.parse(tryLS('pm.gor') || 'null');
    if (g) {
      if (g.tk === 'ay' || g.tk === 'hafta') S.tkGorunum = g.tk;
      S.ptGeri = g.pt || null;
    }
    if (g && g.d === ymd(today())) {
      if (/^\d{4}-\d\d-\d\d$/.test(g.hafta || '')) S.hafta = g.hafta;
      if (/^\d{4}-\d\d$/.test(g.ay || '')) {
        S.ay = g.ay;
        S.ayElle = !!g.ayElle;
      }
    }
  } catch (e) {} // aynı gün yenilenirse bakılan hafta/ay korunur
  onAuthStateChanged(auth, async u => {
    S.user = u;
    temizle();
    if (!u) {
      S.me = null;
      loginEkrani();
      return;
    }
    view(`<div class="empty-state"><b>Hesabınız yükleniyor</b></div>`);
    subs.me = onSnapshot(
      doc(db, 'kullanicilar', u.uid),
      async s => {
        S.meYuklendi = true;
        S.me = s.exists() ? s.data() : null;
        if (!S.me) {
          try {
            const k = await getDoc(doc(db, 'sistem', 'kurulum'));
            S.kurulumVar = k.exists();
          } catch (e) {
            S.kurulumVar = true;
          }
          return hesapYok();
        }
        if (S.me.aktif !== true) {
          return view(
            `<div class="login"><div class="card"><h2>Hesabınız kapalı</h2><p class="note">İşvereninizle görüşün.</p><button class="btn" id="outB">Çıkış yap</button></div></div>`,
            () => (byId('outB').onclick = () => signOut(auth))
          );
        }
        if (!subs.surum)
          subs.surum = onSnapshot(
            doc(db, 'sistem', 'surum'),
            s => {
              const min = (s.exists() && +s.data().min) || 0;
              S.eskiSurum = min > APP_SURUM;
              if (S.eskiSurum) return eskiSurumEkrani();
              if (isIsveren() && min < APP_SURUM)
                fsSetDoc(
                  doc(db, 'sistem', 'surum'),
                  { min: APP_SURUM, tarih: new Date().toISOString() },
                  { merge: true }
                ).catch(() => {});
            },
            () => {}
          );
        subeleriDinle();
      },
      e => {
        view(`<div class="banner bad">Hesap bilgisi okunamadı: ${esc(e.message)}</div>`);
      }
    );
  });
}
export function eskiSurumEkrani() {
  byId('tabs').hidden = true;
  view(
    `<div class="login"><div class="card"><h2>Uygulama güncellendi</h2><p class="note">Bu ekrandaki sürüm eski; kayıtların doğru tutulması için yeni sürümü açın. Bekleyen değişiklikleriniz kaybolmaz.</p><div class="row2"><button class="btn primary grow" id="yenileB">Yenile</button></div></div></div>`,
    () =>
      (byId('yenileB').onclick = () => {
        location.replace(location.pathname + '?v=' + Date.now());
      })
  );
}
export function temizle() {
  if (KL.unsub) {
    KL.unsub();
    KL.unsub = null;
  }
  clearTimeout(KL.zT);
  kilitBirak();
  KL.key = null;
  KL.k = null;
  KL.d = null;
  [...subs.sube, ...subs.detay, ...subs.liste, ...subs.subeDocs, ...subs.gun, ...subs.tk].forEach(u => u());
  subs.sube = [];
  subs.detay = [];
  subs.liste = [];
  subs.subeDocs = [];
  subs.gun = [];
  subs.tk = [];
  S.gunler = {};
  S.tk = {};
  S.tkKey = null;
  S.haftaDurum = { w: {} };
  if (subs.me) {
    subs.me();
    subs.me = null;
  }
  if (subs.users) {
    subs.users();
    subs.users = null;
  }
  if (S.iscUnsub) {
    S.iscUnsub();
    S.iscUnsub = null;
    S.iscKey = null;
  }
  if (S.iscSabitUnsub) {
    S.iscSabitUnsub();
    S.iscSabitUnsub = null;
    S.iscSabit = null;
  }
  if (subs.surum) {
    subs.surum();
    subs.surum = null;
  }
  S.subeler = {};
  S.subeIds = [];
  S.subeId = null;
  S.personel = [];
  S.haftalar = {};
  S.aylar = {};
  S.loaded = { personel: false, haftalar: false };
  S.gocBakildi = false;
}
export function loginEkrani() {
  top('Puantaj Merkezi', 'Giriş');
  byId('tabs').hidden = true;
  view(
    `<div class="login"><form class="card" id="lf"><h2>Giriş yap</h2><p class="note" style="margin:2px 0 6px">Kullanıcı adınız ve şifrenizle girin.</p>
   <label class="field"><span>Kullanıcı adı</span><input id="lk" autocomplete="username" autocapitalize="none" autocorrect="off" required></label>
   <label class="field"><span>Şifre</span><input id="lp" type="password" autocomplete="current-password" required></label>
   <div id="lerr"></div><div class="row2"><button class="btn primary grow" id="lb" type="submit">Giriş yap</button></div></form></div>`,
    () => {
      byId('lf').onsubmit = async e => {
        e.preventDefault();
        const k = byId('lk').value,
          p = byId('lp').value;
        const b = byId('lb');
        b.disabled = true;
        b.textContent = 'Giriş yapılıyor';
        try {
          await signInWithEmailAndPassword(auth, eposta(k), p);
        } catch (err) {
          const c = err.code || '';
          byId('lerr').innerHTML =
            `<div class="confirm bad">${c.includes('too-many') ? 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.' : c.includes('network') ? 'İnternet bağlantısı yok.' : 'Kullanıcı adı ya da şifre hatalı.'}</div>`;
          b.disabled = false;
          b.textContent = 'Giriş yap';
        }
      };
    }
  );
}
export function hesapYok() {
  top('Puantaj Merkezi', 'Hesap');
  byId('tabs').hidden = true;
  if (S.kurulumVar === false) {
    view(
      `<div class="login"><div class="card"><h2>İlk kurulum</h2><p class="note">Sistemde henüz işveren yok. Bu hesap işveren olarak ayarlanacak ve tüm yetkilere sahip olacak.</p>
    <label class="field"><span>Ad soyad</span><input id="kAd" autocomplete="name"></label><div id="kErr"></div>
    <div class="row2"><button class="btn grow" id="kOut">Çıkış</button><button class="btn primary grow" id="kOk">İşveren olarak kur</button></div></div></div>`,
      () => {
        byId('kOut').onclick = () => signOut(auth);
        byId('kOk').onclick = async () => {
          const ad = byId('kAd').value.trim();
          if (!ad) {
            byId('kErr').innerHTML = '<div class="confirm">Ad soyad gerekli.</div>';
            return;
          }
          const b = writeBatch(db);
          const uid = S.user.uid;
          const kadi = S.user.email.split('@')[0];
          b.set(doc(db, 'kullanicilar', uid), {
            kullaniciAdi: kadi,
            adSoyad: ad,
            rol: 'isveren',
            subeler: [],
            aktif: true,
            olusturma: new Date().toISOString(),
          });
          b.set(doc(db, 'sistem', 'kurulum'), { tarih: new Date().toISOString(), uid });
          try {
            await b.commit();
            toast('Kurulum tamamlandı.');
          } catch (e) {
            byId('kErr').innerHTML = `<div class="confirm bad">Kurulum yapılamadı: ${esc(e.message)}</div>`;
          }
        };
      }
    );
    return;
  }
  view(
    `<div class="login"><div class="card"><h2>Hesabınız tanımlı değil</h2><p class="note">Bu kullanıcı için yetki verilmemiş. İşvereninizden hesabınızı açmasını isteyin.</p><button class="btn" id="outB">Çıkış yap</button></div></div>`,
    () => (byId('outB').onclick = () => signOut(auth))
  );
}
