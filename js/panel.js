// panel.js — app.js (v180) satırları 723-739. Otomatik bölündü; davranış değişmedi.
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ROL } from './sabitler.js';
import { auth } from './firebase.js';
import { APP_SURUM, S } from './durum.js';
import { bas, esc } from './yardimci.js';
import { rol } from './rol.js';
import { selectSube } from './subeler.js';
import { byId } from './cerceve.js';
import { sifreKaydet } from './kullanici.js';

/* ================= Panel ve bildirim ================= */
export function openSheet(html, onMount) {
  const r = byId('sheetRoot');
  r.innerHTML = `<div class="dim" id="dim"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  byId('dim').onclick = closeSheet;
  document.addEventListener('keydown', escKapat);
  onMount && onMount(r.querySelector('.sheet'));
}
export function escKapat(e) {
  if (e.key === 'Escape') closeSheet();
}
export function closeSheet() {
  byId('sheetRoot').innerHTML = '';
  document.removeEventListener('keydown', escKapat);
}
let toastT;
export function toast(m) {
  byId('toastRoot').innerHTML = `<div class="toast" role="status">${esc(m)}</div>`;
  clearTimeout(toastT);
  toastT = setTimeout(() => (byId('toastRoot').innerHTML = ''), 3000);
}
export function subeSec(after) {
  openSheet(
    `<h2>Şube seç</h2><div class="sub">${S.subeIds.length} şube</div><div class="card list">${S.subeIds.map(id => `<button class="row" data-id="${esc(id)}"><div class="av">${esc(bas(S.subeler[id].ad))}</div><div class="m"><b>${esc(S.subeler[id].ad)}</b><span>${esc(S.subeler[id].acilis || '')}–${esc(S.subeler[id].kapanis || '')}</span></div>${id === S.subeId ? '<span class="chip ok">Seçili</span>' : ''}</button>`).join('')}</div>`,
    sh => {
      sh.querySelectorAll('.row').forEach(
        b =>
          (b.onclick = () => {
            closeSheet();
            selectSube(b.dataset.id);
            after && after();
          })
      );
    }
  );
}
export function hesapPanel() {
  openSheet(
    `<h2>${esc(S.me.adSoyad || S.me.kullaniciAdi)}</h2><div class="sub">${esc(ROL[rol()])} · kullanıcı adı: ${esc(S.me.kullaniciAdi || '')}</div>
  <span class="lbl">Şifre değiştir</span><label class="field"><span>Mevcut şifre</span><input id="s1" type="password" autocomplete="current-password"></label>
  <label class="field"><span>Yeni şifre (en az 6 karakter)</span><input id="s2" type="password" autocomplete="new-password"></label><div id="sErr"></div>
  <div class="row2"><button class="btn grow" id="sOk">Şifreyi değiştir</button></div><div class="row2"><button class="btn danger grow" id="outB">Çıkış yap</button></div><p class="note" style="text-align:center;margin-top:10px">Sürüm ${APP_SURUM}</p>`,
    sh => {
      byId('outB').onclick = () => {
        closeSheet();
        signOut(auth);
      };
      byId('sOk').onclick = async () => {
        const a = byId('s1').value,
          b = byId('s2').value;
        if (b.length < 6) {
          byId('sErr').innerHTML = '<div class="confirm">Yeni şifre en az 6 karakter olmalı.</div>';
          return;
        }
        try {
          await reauthenticateWithCredential(
            auth.currentUser,
            EmailAuthProvider.credential(auth.currentUser.email, a)
          );
          await updatePassword(auth.currentUser, b);
          sifreKaydet(S.user.uid, S.me.kullaniciAdi || '', b).catch(e => console.error(e));
          closeSheet();
          toast('Şifreniz değiştirildi.');
        } catch (e) {
          byId('sErr').innerHTML =
            `<div class="confirm bad">${(e.code || '').includes('wrong-password') || (e.code || '').includes('invalid-credential') ? 'Mevcut şifre hatalı.' : 'Şifre değiştirilemedi.'}</div>`;
        }
      };
    }
  );
}
