// kilit.js — app.js (v180) satırları 479-529. Otomatik bölündü; davranış değişmedi.
import { doc, getDoc, onSnapshot, runTransaction as fsRunTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './firebase.js';
import { S } from './durum.js';
import { esc } from './yardimci.js';
import { isBolge, isIsveren, rol } from './rol.js';
import { gerekliSube } from './yazma.js';
import { byId, render } from './cerceve.js';
import { toast } from './panel.js';
import { benAd } from './hafta-kapatma.js';

/* ================= Düzenleme kilidi ================= */
// Aynı anda tek kişi düzenler: çizelgede şube + hafta, puantajda şube + ay. Bakmak serbesttir.
// Kilit ilk değişiklikte alınır; son işlemden 2 dakika sonra (ya da sayfadan çıkınca, uygulama arka plana geçince) kendiliğinden düşer. İşveren her kilidi, bölge müdürü şube müdürününkini devralabilir.
const KILIT_SN=120,KILIT_TAZE=30000;
export const KL={key:null,k:null,d:null,unsub:null,zT:null,benim:{}};
export const czK=(wid,sid)=>({tur:'cz',sube:gerekliSube(sid),donem:wid});
export const ptK=(sid=S.subeId,ak=S.ay)=>({tur:'pt',sube:sid,donem:ak});
const kilitId=k=>k.tur+'__'+k.sube+'__'+k.donem;
function kilitAnahtar(){if(!S.user||!S.me||!S.subeId)return null;
  if(S.tab==='cizelge'&&S.hafta)return czK(S.hafta,S.subeId);
  if(S.tab==='puantaj'&&S.pt.sube&&S.pt.sube===S.subeId&&S.ay)return ptK();
  return null;}
function kilitMs(d){const t=d&&d.t;return t&&t.toMillis?t.toMillis():0;}
// Bu sayfanın kilidi başkasındaysa kilit kaydı, değilse null.
export function kilitBaskasi(){const d=KL.d;if(!d||!S.user||d.uid===S.user.uid)return null;return Date.now()-kilitMs(d)<KILIT_SN*1000?d:null;}
export function kilitMesaj(d=KL.d){const ad=(d&&d.ad)||'Başka bir kullanıcı';return `${ad} şu an burada düzenleme yapıyor. Değişiklik kaydedilmedi; o bitirince ya da 2 dakika işlem yapmayınca düzenleyebilirsiniz.`;}
// Sayfadaki düzenleme başkasındaysa uyarır ve true döner.
export function kilitEngel(){const d=kilitBaskasi();if(!d)return false;toast(kilitMesaj(d));return true;}
export function kilitTakip(){const k=kilitAnahtar();const id=k?kilitId(k):null;if(id===KL.key)return;
  if(KL.unsub){KL.unsub();KL.unsub=null;}clearTimeout(KL.zT);kilitBirak();KL.key=id;KL.k=k;KL.d=null;if(!id)return;
  KL.unsub=onSnapshot(doc(db,'kilitler',id),s=>{const b0=kilitBaskasi(),once=b0?b0.uid:'';KL.d=s.exists()?s.data({serverTimestamps:'estimate'}):null;
    if(KL.d&&S.user&&KL.d.uid!==S.user.uid)delete KL.benim[id];
    clearTimeout(KL.zT);const b=kilitBaskasi();if(b)KL.zT=setTimeout(()=>render(),Math.max(1000,kilitMs(b)+KILIT_SN*1000-Date.now()+1500));
    if(once!==(b?b.uid:''))render();},()=>{KL.d=null;});}
// Kilidi alır ya da tazeler. Başkasındaysa false. Bağlantı hatasında düzenlemeyi engellemez (kayıt zaten birleştirerek yazılır).
export async function kilitAl(k,zorla=false){if(!k||!S.user)return true;const id=kilitId(k);const ref=doc(db,'kilitler',id);
  if(!zorla&&KL.benim[id]&&Date.now()-KL.benim[id]<KILIT_TAZE)return true;
  if(!zorla&&id===KL.key&&kilitBaskasi())return false;
  if(navigator.onLine===false)return true;// internet yok: kilit alınamaz, kayıt telefonda sıraya girer
  try{const ok=await fsRunTransaction(db,async tr=>{const s=await tr.get(ref);const x=s.exists()?s.data():null;
      if(x&&x.uid!==S.user.uid&&!zorla&&isIsveren()&&Date.now()-kilitMs(x)<KILIT_SN*1000)return false;
      tr.set(ref,{tur:k.tur,sube:k.sube,donem:k.donem,uid:S.user.uid,ad:benAd()||S.user.email||'',rol:rol(),t:serverTimestamp()});return true;});
    if(ok)KL.benim[id]=Date.now();else delete KL.benim[id];return ok;}
  catch(e){const c=(e&&e.code)||'';console.error(e);if(!c.includes('permission'))return true;
    // Yetki hatası: kilit başkasındaysa engelle; kilit okunamıyorsa (kurallar henüz yayınlanmamış) düzenlemeyi durdurma.
    try{const s=await getDoc(ref);const x=s.exists()?s.data():null;if(x&&x.uid!==S.user.uid){delete KL.benim[id];if(id===KL.key)KL.d=x;return false;}}catch(_){}
    return true;}}
export async function kilitliMi(k){if(await kilitAl(k))return false;toast(kilitMesaj());return true;}
// Bende olan kilitleri bırakır (başkası devraldıysa dokunmaz).
export function kilitBirak(){const ids=Object.keys(KL.benim);KL.benim={};if(!S.user)return;const uid=S.user.uid;
  ids.forEach(id=>{const ref=doc(db,'kilitler',id);fsRunTransaction(db,async tr=>{const s=await tr.get(ref);if(s.exists()&&s.data().uid===uid)tr.delete(ref);}).catch(()=>{});});}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')kilitBirak();});
window.addEventListener('pagehide',()=>kilitBirak());
async function kilitDevral(){if(!KL.k)return;if(await kilitAl(KL.k,true)){toast('Düzenleme size geçti.');render();}else toast('Devralınamadı, tekrar deneyin.');}
// İşveren her kilidi, bölge müdürü şube müdürünün kilidini devralabilir.
function kilitDevralabilir(d){return isIsveren()||(isBolge()&&d&&d.rol==='sube');}
export function kilitBandi(){const d=kilitBaskasi();if(!d)return'';const ne=KL.k.tur==='pt'?'bu ayın puantajını':'bu haftanın çizelgesini';
  return `<div class="banner kilit"><b>🔒 ${esc(d.ad||'Başka bir kullanıcı')} şu an ${ne} düzenliyor.</b> Siz sadece bakabilirsiniz. O sayfadan çıkınca ya da 2 dakika işlem yapmayınca düzenleme açılır.${kilitDevralabilir(d)?`<div style="margin-top:8px"><button class="btn" id="kilitDevral">Kilidi devral</button></div>`:''}</div>`;}
export function kilitUygula(){const d=kilitBaskasi();if(!d)return;const v=byId('view');if(!v)return;
  v.querySelectorAll(KL.k.tur==='pt'?'#vGrid input,#vGrid select,#vGrid textarea,[data-bk],#vSatir,#vSatir10,[data-sil]':'button.cell').forEach(x=>{x.disabled=true;});
  const b=byId('kilitDevral');if(b)b.onclick=kilitDevral;}
