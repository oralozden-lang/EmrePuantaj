// hucre-yazma.js — app.js (v180) satırları 530-575. Otomatik bölündü; davranış değişmedi.
import { arrayUnion, deleteField } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { arka, setDoc } from './firebase.js';
import { S, undo } from './durum.js';
import { addDays, ayKey, gosterAy, isShift, parse, weekDays, ymd } from './yardimci.js';
import { vardiyaKontrol } from './saat.js';
import { isSube } from './rol.js';
import { cellOf, fmAyi, sube, subeAyari } from './hesap.js';
import { cakismaMesaj, cokSubeli, digerGunler, gunCakisir, gunYaz, kadroOf } from './cok-sube.js';
import { sirayla, weekRef } from './yazma.js';
import { czK, kilitAl, kilitBaskasi, kilitEngel, kilitMesaj } from './kilit.js';
import { render } from './cerceve.js';
import { toast } from './panel.js';
import { kapaliHaftaGuncelle } from './hafta-kapatma.js';

function undoKaydet(wid){const w0=S.haftalar[wid]||{};undo.push({wid,cells:JSON.parse(JSON.stringify(w0.cells||{})),kadro:Array.isArray(w0.kadro)?w0.kadro.slice():null});if(undo.length>40)undo.shift();}
// Haftanın durumu: acik (şube düzenler) · kapali (şube kapattı, bölge onayı bekliyor) · onay (bölge onayladı). Şube müdürü kapalı haftayı göremez.
export function haftaDurumu(wid,H=S.haftalar){const w=H[wid];if(w&&w.hd)return w.hd;const d=(S.haftaDurum.w||{})[wid];return H===S.haftalar&&d&&d.d?d.d:'acik';}
// Hücre yazarken haftanın durumu (hd): şube müdürü her zaman 'acik' yazar (kapalı haftaya kurallar zaten izin vermez).
// Bölge müdürü / işveren var olan haftanın durumuna dokunmaz; sadece yeni açılan haftaya 'acik' yazar. Yazma anında (çağrıldığı an) hesaplanır.
export const hdAlani=wid=>isSube()||!S.haftalar[wid]?{hd:'acik'}:{};
// Şube verisi sunucudan tam yüklendi mi (önbellekten değil): özet, onay ve kapatma hesapları buna göre yapılır.
// Haftanın hesabında kullanılan ay ayarı: puantajın haftayı saydığı ay (haftalık dönemde pazartesinin ayı).
export const haftaAyari=wid=>subeAyari(S.subeId,fmAyi(wid,subeAyari(S.subeId,gosterAy(wid))));
export const sunucuHazir=sid=>!!sid&&S.subeId===sid&&S.loaded.haftalar&&S.haftalarSunucu&&S.loaded.personel;
export function hazirDegil(){return new Error('Şube verileri tam yüklenmeden ya da işlem sırasında şube değiştiği için işlem yapılmadı. Tekrar deneyin.');}
// Tek hücreye yazmadan önce kontrol: saat kuralı ve aynı gün başka şube.
export function hucreKontrol(p,wid,i,val,sessiz){const d=weekDays(wid)[i];if(val==='CG'&&!(p&&p.sekil==='Part')){if(!sessiz)toast('"Part boş" sadece part-time personelde seçilebilir.');return false;}if(isShift(val)){const k=vardiyaKontrol(val,sube(),d);if(!k.ok){if(!sessiz)toast(k.neden);return false;}}
  if(val&&p&&cokSubeli(p)){const c=gunCakisir(val,digerGunler(p,d));if(c){if(!sessiz)toast(cakismaMesaj(p,ymd(d),c));return false;}}return true;}
export function setCell(pid,wid,i,val){const sid=S.subeId;const hdA=hdAlani(wid);if(haftaDurumu(wid)!=='acik'){toast('Bu hafta kapalı. Düzenlemek için önce "Kilidi aç"a basın.');return Promise.resolve(false);}if(wid===S.hafta&&kilitEngel())return Promise.resolve(false);const p=S.personel.find(x=>x.id===pid);if(!hucreKontrol(p,wid,i,val))return Promise.resolve(false);
  const w0=S.haftalar[wid]||{};const kad=kadroOf(wid).ids.slice();const kadVardi=kad.includes(pid);if(!kadVardi)kad.push(pid);undoKaydet(wid);const eski=cellOf(pid,wid,i);
  // Liste: hafta kayıtlıysa kişi sadece eklenir (sunucudaki listeye dokunmadan); yeni haftada önerilen liste yazılır.
  const kadAlan=S.haftalar[wid]&&Array.isArray(S.haftalar[wid].kadro)?(kadVardi?{}:{kadro:arrayUnion(pid)}):{kadro:kad};
  const w=S.haftalar[wid]={...w0,kadro:kad,cells:{...(w0.cells||{})}};w.cells[pid]={...(w.cells[pid]||{}),[String(i)]:val};render();const ds=ymd(weekDays(wid)[i]);
  return sirayla(sid+'|'+wid,async()=>{if(!(await kilitAl(czK(wid,sid)))){if(S.subeId===sid){S.haftalar[wid]=w0;undo.pop();render();toast(kilitMesaj());}return false;}
    if(p&&cokSubeli(p)&&(val||eski)){let c=null;try{c=await gunYaz(p,ds,val,sid);}catch(e){console.error(e);toast('Bu hücre diğer şubeye işlenemedi, tekrar dene.');}
      if(c){if(S.subeId===sid){const w1=S.haftalar[wid];if(w1&&w1.cells&&w1.cells[pid])w1.cells[pid][String(i)]=eski;undo.pop();render();toast(cakismaMesaj(p,ds,c));}return false;}}
    arka(setDoc(weekRef(wid,sid),{hafta:wid,ay2:ayKey(addDays(parse(wid),6)),...hdA,...kadAlan,cells:{[pid]:{[String(i)]:val}}},{merge:true}));kapaliHaftaGuncelle(wid,sid);return true;});}
// Birden çok hücre: saat kuralına ya da aynı gün kuralına uymayan hücreler eski değerinde kalır, sayısı döner.
export function setWeek(wid,cells,kadro,pushUndo=true){const DEL_ALAN=deleteField();const sid=S.subeId;const hdA=hdAlani(wid);if(haftaDurumu(wid)!=='acik'){setTimeout(()=>toast('Bu hafta kapalı. Düzenlemek için önce "Kilidi aç"a basın.'),60);return 0;}if(wid===S.hafta&&kilitBaskasi()){setTimeout(()=>toast(kilitMesaj()),60);return 0;}
  const w0=S.haftalar[wid]||{};const eskiC=w0.cells||{};const ds=weekDays(wid);let red=0;const degisen=[];
  Object.keys({...eskiC,...cells}).forEach(pid=>{const p=S.personel.find(x=>x.id===pid);for(let i=0;i<7;i++){const a=(eskiC[pid]||{})[String(i)]??null,b=(cells[pid]||{})[String(i)]??null;if(a===b)continue;
    if(b&&!hucreKontrol(p,wid,i,b,true)){red++;if(cells[pid])cells[pid][String(i)]=a;continue;}if(p&&cokSubeli(p))degisen.push([p,ymd(ds[i]),b]);}});
  if(pushUndo)undoKaydet(wid);const kad=kadro===undefined?kadroOf(wid).ids:kadro;
  // Sadece değişen hücreler yazılır: aynı anda başka birinin girdiği hücreler silinmez.
  const fark={};Object.keys({...eskiC,...cells}).forEach(pid=>{if(!(pid in cells)){if(pid in eskiC)fark[pid]=DEL_ALAN;return;}
    for(let i=0;i<7;i++){const a=(eskiC[pid]||{})[String(i)]??null,b=(cells[pid]||{})[String(i)]??null;if(a!==b)(fark[pid]=fark[pid]||{})[String(i)]=b;}});
  const kadDeg=!Array.isArray(w0.kadro)||JSON.stringify(w0.kadro)!==JSON.stringify(kad);
  S.haftalar[wid]={...w0,hafta:wid,kadro:kad,cells};render();
  sirayla(sid+'|'+wid,async()=>{if(!(await kilitAl(czK(wid,sid)))){if(S.subeId===sid){S.haftalar[wid]=w0;if(pushUndo)undo.pop();render();toast(kilitMesaj());}return;}
    // Çok şubeli kişide önce ortak gün kaydı yazılır; başka şubede o gün kaydı varsa (ekrandaki kontrol önbellekten geçmiş olsa da) hücre çizelgeye hiç yazılmaz, eski değerinde kalır.
    let geri=0,sonC=null;
    for(const[p,d,v]of degisen){let c=null;try{c=await gunYaz(p,d,v,sid);}catch(e){console.error(e);c={hata:1};}
      if(c){const i=ds.findIndex(x=>ymd(x)===d);const a=(eskiC[p.id]||{})[String(i)]??null;if(fark[p.id]&&fark[p.id]!==DEL_ALAN&&String(i) in fark[p.id]){delete fark[p.id][String(i)];if(!Object.keys(fark[p.id]).length)delete fark[p.id];}
        const w1=S.subeId===sid&&S.haftalar[wid];if(w1&&w1.cells){w1.cells[p.id]={...(w1.cells[p.id]||{}),[String(i)]:a};}geri++;if(!c.hata)sonC=[p,d,c];}}
    arka(setDoc(weekRef(wid,sid),{hafta:wid,ay2:ayKey(addDays(parse(wid),6)),...hdA,...(kadDeg?{kadro:kad}:{}),...(Object.keys(fark).length?{cells:fark}:{})},{merge:true}));
    if(geri&&S.subeId===sid){render();toast(sonC?`${geri} hücre yazılmadı: ${RED_NEDEN}. ${cakismaMesaj(...sonC)}`:'Bazı günler diğer şubeye işlenemedi, tekrar dene.');}kapaliHaftaGuncelle(wid,sid);});
  return red;}

export const RED_NEDEN='şube saatleri dışında, yarım saat değil ya da kişi o gün başka şubede';

