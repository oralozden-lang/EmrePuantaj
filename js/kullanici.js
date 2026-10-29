// kullanici.js — app.js (v180) satırları 2688-2774. Otomatik bölündü; davranış değişmedi.
import { firebaseConfig } from "../config.js?v=67";
import { doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { createUserWithEmailAndPassword, deleteUser, getAuth, signInWithEmailAndPassword, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { ROL } from './sabitler.js';
import { db, deleteDoc, setDoc, updateDoc, writeBatch } from './firebase.js';
import { S } from './durum.js';
import { eposta, esc, kadiNorm } from './yardimci.js';
import { isIsveren } from './rol.js';
import { yazmaHatasi } from './yazma.js';
import { byId } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { benAd, tarihSaat } from './hafta-kapatma.js';

let ikincil=null;function ikincilAuth(){if(!ikincil)ikincil=getAuth(initializeApp(firebaseConfig,'ikincil'));return ikincil;}
/* ---- Giriş bilgileri (işveren) ----
   Firebase şifreyi geri okunamaz biçimde saklar; işverenin görebilmesi için şifre ayrıca sifreler/{uid} belgesinde tutulur.
   Bu belgeyi sadece işveren okur (kural); yedek dosyasına girmez. Kullanıcı kendi şifresini değiştirince kaydı güncellenir.
   Başka kullanıcının şifresi / kullanıcı adı, kayıtlı şifreyle ikinci (arka plan) oturumda giriş yapılarak değiştirilir; işverenin oturumu kapanmaz. */
export const sifreOf=uid=>((S.sifreler||{})[uid]||{}).sifre||'';
export function sifreKaydet(uid,k,p){return setDoc(doc(db,'sifreler',uid),{kullaniciAdi:k,sifre:p,guncellendi:new Date().toISOString(),guncelleyen:benAd()});}
async function ikincilCikis(){try{await signOut(ikincilAuth());}catch(e){}}
async function ikincilGiris(k,p){await ikincilCikis();return(await signInWithEmailAndPassword(ikincilAuth(),eposta(k),p)).user;}
function girisHata(e){const c=(e&&e.code)||'';
  if(c==='sifre-yok')return 'Bu kullanıcının şifresi kayıtlı değil. Önce bildiğiniz şifreyi kaydedin ya da yeni şifre yazın.';
  if(c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found'))return 'Şifre tutmuyor. Kullanıcı şifresini değiştirmiş olabilir; doğru şifreyi yazıp "Şifreyi kaydet" deyin.';
  if(c.includes('email-already-in-use'))return 'Bu kullanıcı adı alınmış.';if(c.includes('weak-password'))return 'Şifre çok zayıf.';
  if(c.includes('too-many-requests'))return 'Çok fazla deneme yapıldı, birkaç dakika sonra tekrar deneyin.';if(c.includes('network'))return 'İnternet bağlantısı yok.';
  if(c.includes('permission'))return 'Yetki hatası. Firebase kurallarının güncel olduğundan emin olun.';return 'İşlem yapılamadı: '+((e&&(e.message||c))||'');}
async function kSifreDegistir(u,yeni){const eski=sifreOf(u.uid);if(!eski)throw{code:'sifre-yok'};const user=await ikincilGiris(u.kullaniciAdi,eski);
  try{await updatePassword(user,yeni);}finally{await ikincilCikis();}await sifreKaydet(u.uid,u.kullaniciAdi,yeni);}
// Şifresi bilinmeyen kullanıcıya yeni şifre: istek yazılır, GitHub'daki "Kullanıcı işlemleri" otomasyonu birkaç dakika içinde uygular.
function kSifreIstek(u,p){return setDoc(doc(db,'sifreIstek',u.uid),{sifre:p,isteyen:S.user.uid,isteyenAd:benAd(),t:new Date().toISOString()});}
// Tek düğme: kayıtlı şifre varsa hemen değiştirir; yoksa yazılan şifre mevcut şifreyse hemen kaydeder; ikisi de olmazsa yeni şifre isteği bırakır.
async function kSifreAyarla(u,p){try{if(sifreOf(u.uid))await kSifreDegistir(u,p);else await kSifreDogrula(u,p);return 'hemen';}
  catch(e){const c=(e&&e.code)||'';if(c==='sifre-yok'||c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found')){await kSifreIstek(u,p);return 'bekliyor';}throw e;}}
// Bilinen şifreyi kaydeder; önce o şifreyle giriş denenir (yanlış şifre kaydedilmez).
async function kSifreDogrula(u,p){await ikincilGiris(u.kullaniciAdi,p);await ikincilCikis();await sifreKaydet(u.uid,u.kullaniciAdi,p);}
// Kullanıcı adı Firebase'de giriş adresidir, olduğu yerde değişmez: yeni adla giriş hesabı açılır, rol / şube / durum taşınır, eski giriş hesabı silinir.
async function kAdDegistir(u,yeniK,yeniP){const eskiP=sifreOf(u.uid);const p=yeniP||eskiP;if(!p)throw{code:'sifre-yok'};const t=new Date().toISOString();
  await ikincilCikis();const cred=await createUserWithEmailAndPassword(ikincilAuth(),eposta(yeniK),p);const nu=cred.user;const nuid=nu.uid;
  try{const{uid:_x,...veri}=u;const b=writeBatch(db);
    b.set(doc(db,'kullanicilar',nuid),{...veri,kullaniciAdi:yeniK,oncekiKullaniciAdi:u.kullaniciAdi,oncekiUid:u.uid,adDegisim:t});b.delete(doc(db,'kullanicilar',u.uid));
    b.set(doc(db,'sifreler',nuid),{kullaniciAdi:yeniK,sifre:p,guncellendi:t,guncelleyen:benAd()});b.delete(doc(db,'sifreler',u.uid));await b.commit();}
  catch(e){try{await deleteUser(nu);}catch(e2){}await ikincilCikis();throw e;}// taşıma olmadıysa yeni giriş hesabı geri silinir
  await ikincilCikis();let eskiSilindi=false;
  if(eskiP){try{await deleteUser(await ikincilGiris(u.kullaniciAdi,eskiP));eskiSilindi=true;}catch(e){}finally{await ikincilCikis();}}return eskiSilindi;}
async function kSil(u){const p=sifreOf(u.uid);const b=writeBatch(db);b.delete(doc(db,'kullanicilar',u.uid));b.delete(doc(db,'sifreler',u.uid));await b.commit();
  let girisSilindi=false;if(p){try{await deleteUser(await ikincilGiris(u.kullaniciAdi,p));girisSilindi=true;}catch(e){}finally{await ikincilCikis();}}return girisSilindi;}
function girisKarti(u,ben){const sf=sifreOf(u.uid);const ist=(S.sifreIstek||{})[u.uid];
  const istH=ist?`<div class="banner${ist.hata?' bad':''}" style="margin:6px 0">${ist.hata?`Yeni şifre uygulanamadı: ${esc(ist.hata)}`:`Yeni şifre verildi (${esc(tarihSaat(ist.t))}). Birkaç dakika içinde geçerli olur ve burada görünür.`} <button class="mini" id="uIstIptal">İptal et</button></div>`:'';
  return `<div class="card" style="padding:12px;margin:10px 0"><span class="lbl" style="margin-top:0">Giriş bilgileri</span>
   <p style="margin:4px 0">Kullanıcı adı: <b class="mono">${esc(u.kullaniciAdi)}</b></p>
   <p style="margin:4px 0">Şifre: ${sf?`<b class="mono" id="uSfG" data-s="${esc(sf)}">••••••</b> <button class="mini" id="uSfGos">Göster</button>`:'<i>kayıtlı değil</i>'}</p>${istH}
   ${ben?'<p class="note" style="margin-bottom:0">Kendi şifrenizi sağ üstteki hesap menüsünden değiştirin; değiştirince burada görünür.</p>':`
   <label class="field"><span>Yeni şifre (en az 6)</span><input id="uYP" type="text" autocomplete="off" autocapitalize="none" autocorrect="off"></label>
   <div class="row2"><button class="btn grow" id="uSfB">${sf?'Şifreyi değiştir':'Şifreyi ayarla'}</button></div>
   ${sf?'':'<p class="note">Eski şifreyi bilmeniz gerekmez. Yeni şifreyi yazıp "Şifreyi ayarla" deyin; birkaç dakika içinde geçerli olur ve burada görünür. Bundan sonra şifreyi her zaman burada görür ve anında değiştirirsiniz.</p>'}
   ${isIsveren()?`<label class="field"><span>Yeni kullanıcı adı</span><input id="uYK" autocapitalize="none" autocorrect="off" placeholder="${esc(u.kullaniciAdi)}"></label>
   <div class="row2"><button class="btn grow" id="uKB">Kullanıcı adını değiştir</button></div>
   <p class="note" style="margin-bottom:0">Değişiklikten sonra kullanıcı yeni bilgilerle giriş yapar; açık oturumu kapanır.</p>`:''}`}<div id="uGErr"></div></div>`;}
export function kullaniciPanel(uid){const u=uid?S.users.find(x=>x.uid===uid):{kullaniciAdi:'',adSoyad:'',rol:'sube',subeler:[],aktif:true};if(!u)return;const ben=uid===S.user.uid;
  openSheet(`<h2>${uid?'Kullanıcıyı düzenle':'Yeni kullanıcı'}</h2><div class="sub">${uid?(u.aktif===false?'Pasif · giriş yapamaz':'Aktif'):'Kullanıcı bu ad ve şifreyle giriş yapar.'}</div>
   <label class="field"><span>Ad soyad</span><input id="uAd" value="${esc(u.adSoyad||'')}"></label>
   ${uid?'':`<div class="fgrid"><label class="field"><span>Kullanıcı adı</span><input id="uK" autocapitalize="none" autocorrect="off" placeholder="ornek: ayse.bucak"></label><label class="field"><span>Şifre (en az 6)</span><input id="uP" type="text" autocomplete="new-password"></label></div>`}
   <span class="lbl">Rol</span><div class="seg" id="uRol">${(isIsveren()?['sube','bolge','isveren']:['sube']).map(r=>`<button data-v="${r}" class="${u.rol===r?'on':''}" ${ben?'disabled':''}>${ROL[r]}</button>`).join('')}</div>
   <div id="uSubW"><span class="lbl">Şubeler</span><div class="checks">${S.subeIds.map(id=>`<label class="check" style="margin:0"><input type="checkbox" value="${esc(id)}" ${(u.subeler||[]).includes(id)?'checked':''}> ${esc(S.subeler[id].ad)}</label>`).join('')||'<span class="note">Önce şube ekleyin.</span>'}</div></div>
   <div id="uErr"></div><div class="row2"><button class="btn grow" id="uNo">Vazgeç</button><button class="btn primary grow" id="uOk">${uid?'Kaydet':'Kullanıcıyı oluştur'}</button></div>
   ${uid?girisKarti(u,ben):''}
   ${uid&&!ben?`<div class="row2"><button class="btn grow" id="uPasif">${u.aktif===false?'Aktif et':'Pasife al'}</button><button class="btn danger grow" id="uSil">Kullanıcıyı sil</button></div>
   <p class="note">Pasif kullanıcı giriş yapamaz; istediğiniz zaman yeniden aktif edebilirsiniz. Silinen kullanıcı geri gelmez (geçmiş kayıtlarda adı kalır). Bir süre çalışmayacaksa silmek yerine pasife alın.</p>`:''}`,sh=>{
   const rb=sh.querySelectorAll('#uRol button');const tog=()=>byId('uSubW').hidden=sh.querySelector('#uRol .on').dataset.v==='isveren';rb.forEach(b=>b.onclick=()=>{rb.forEach(x=>x.classList.remove('on'));b.classList.add('on');tog();});tog();
   byId('uNo').onclick=closeSheet;const E=byId('uErr');
   const gos=byId('uSfGos');if(gos)gos.onclick=()=>{const g=byId('uSfG');const ac=gos.textContent==='Göster';g.textContent=ac?g.dataset.s:'••••••';gos.textContent=ac?'Gizle':'Göster';};
   const GE=byId('uGErr');const mesgul=(b,y)=>{sh.querySelectorAll('#uSfB,#uKB,#uPasif,#uSil,#uOk').forEach(x=>x.disabled=!!y);if(b&&y)b.textContent='Bekleyin…';};
   const sfB=byId('uSfB');if(sfB)sfB.onclick=async()=>{const p=byId('uYP').value;if(p.length<6){GE.innerHTML='<div class="confirm">Şifre en az 6 karakter olmalı.</div>';return;}const ad0=sfB.textContent;mesgul(sfB,true);
     try{const r=await kSifreAyarla(u,p);closeSheet();toast(r==='hemen'?`${u.adSoyad||u.kullaniciAdi} için şifre kaydedildi.`:`Yeni şifre verildi; birkaç dakika içinde geçerli olur.`);}
     catch(e){console.error(e);mesgul(null,false);sfB.textContent=ad0;GE.innerHTML=`<div class="confirm bad">${esc(girisHata(e))}</div>`;}};
   const ipt=byId('uIstIptal');if(ipt)ipt.onclick=async()=>{try{await deleteDoc(doc(db,'sifreIstek',u.uid));closeSheet();toast('Şifre isteği iptal edildi.');}catch(e){yazmaHatasi(e);}};
   const kB=byId('uKB');if(kB)kB.onclick=async()=>{const k=kadiNorm(byId('uYK').value);const p=byId('uYP').value;
     if(k.length<3){GE.innerHTML='<div class="confirm">Yeni kullanıcı adı en az 3 karakter olmalı (harf, rakam, nokta).</div>';return;}if(k===u.kullaniciAdi){GE.innerHTML='<div class="confirm">Kullanıcı adı aynı.</div>';return;}
     if(p&&p.length<6){GE.innerHTML='<div class="confirm">Şifre en az 6 karakter olmalı.</div>';return;}if(!p&&!sifreOf(u.uid)){GE.innerHTML=`<div class="confirm">${esc(girisHata({code:'sifre-yok'}))}</div>`;return;}
     if(!kB.dataset.ok){kB.dataset.ok='1';kB.textContent=`Evet, ${k} olarak değiştir`;return;}mesgul(kB,true);
     try{const sil=await kAdDegistir(u,k,p);closeSheet();toast(`Kullanıcı adı ${k} oldu${p?', şifre de değişti':''}.${sil?'':' Eski kullanıcı adı artık giriş yapamaz.'}`);}
     catch(e){console.error(e);mesgul(null,false);kB.dataset.ok='';kB.textContent='Kullanıcı adını değiştir';GE.innerHTML=`<div class="confirm bad">${esc(girisHata(e))}</div>`;}};
   const pB=byId('uPasif');if(pB)pB.onclick=async()=>{const yeni=u.aktif===false;mesgul(pB,true);try{await updateDoc(doc(db,'kullanicilar',u.uid),{aktif:yeni});closeSheet();toast(`${u.adSoyad||u.kullaniciAdi} ${yeni?'aktif edildi':'pasife alındı; giriş yapamaz'}.`);}catch(e){mesgul(null,false);pB.textContent=yeni?'Aktif et':'Pasife al';yazmaHatasi(e);}};
   const sB=byId('uSil');if(sB)sB.onclick=async()=>{if(!sB.dataset.ok){sB.dataset.ok='1';sB.textContent='Evet, kalıcı olarak sil';GE.innerHTML='<div class="confirm bad">Kullanıcı silinir ve giriş yapamaz. Bu geri alınamaz. Sadece geçici olarak durduracaksanız "Pasife al" deyin.</div>';return;}
     mesgul(sB,true);try{await kSil(u);closeSheet();toast(`${u.adSoyad||u.kullaniciAdi} silindi.`);}catch(e){console.error(e);mesgul(null,false);sB.dataset.ok='';sB.textContent='Kullanıcıyı sil';GE.innerHTML=`<div class="confirm bad">${esc(girisHata(e))}</div>`;}};
   byId('uOk').onclick=async()=>{const adSoyad=byId('uAd').value.trim();const r=sh.querySelector('#uRol .on').dataset.v;const subeler=[...sh.querySelectorAll('.checks input:checked')].map(i=>i.value);
     if(!adSoyad){E.innerHTML='<div class="confirm">Ad soyad gerekli.</div>';return;}if(r!=='isveren'&&!subeler.length){E.innerHTML='<div class="confirm">En az bir şube seçin.</div>';return;}
     if(r==='sube'&&subeler.length>1&&!E.dataset.ok){E.dataset.ok='1';E.innerHTML='<div class="confirm">Şube müdürüne birden fazla şube seçtiniz. Doğruysa tekrar basın.</div>';return;}
     const btn=byId('uOk');btn.disabled=true;
     try{if(uid){const body=isIsveren()?{adSoyad,rol:r,subeler:r==='isveren'?[]:subeler}:{adSoyad,subeler};await updateDoc(doc(db,'kullanicilar',uid),body);closeSheet();toast('Kullanıcı güncellendi.');}
       else{const k=kadiNorm(byId('uK').value),p=byId('uP').value;if(k.length<3){E.innerHTML='<div class="confirm">Kullanıcı adı en az 3 karakter olmalı (harf, rakam, nokta).</div>';btn.disabled=false;return;}
         if(p.length<6){E.innerHTML='<div class="confirm">Şifre en az 6 karakter olmalı.</div>';btn.disabled=false;return;}
         const a2=ikincilAuth();await ikincilCikis();const cred=await createUserWithEmailAndPassword(a2,eposta(k),p);const nuid=cred.user.uid;await signOut(a2);
         await setDoc(doc(db,'kullanicilar',nuid),{kullaniciAdi:k,adSoyad,rol:isIsveren()?r:'sube',subeler:r==='isveren'&&isIsveren()?[]:subeler,aktif:true,olusturma:new Date().toISOString(),olusturan:S.user.uid,...(isIsveren()?{}:{bolgeler:[S.user.uid]})});
         let sfOk=true;try{await sifreKaydet(nuid,k,p);}catch(e){sfOk=false;console.error(e);}
         closeSheet();toast(`${adSoyad} oluşturuldu. Kullanıcı adı: ${k}${sfOk?'':' (şifre listeye kaydedilemedi: Firebase kurallarını güncelleyin)'}`);}}
     catch(e){btn.disabled=false;const c=e.code||'';E.innerHTML=`<div class="confirm bad">${c.includes('email-already-in-use')?'Bu kullanıcı adı alınmış.':c.includes('weak-password')?'Şifre çok zayıf.':'Kaydedilemedi: '+esc(e.message)}</div>`;}};});}

