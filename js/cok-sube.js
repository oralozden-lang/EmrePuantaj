// cok-sube.js — app.js (v180) satırları 322-354. Otomatik bölündü; davranış değişmedi.
import { deleteField, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AY, KOD, SGK_YOK, subeAdi } from './sabitler.js';
import { db, runTransaction } from './firebase.js';
import { S, subs } from './durum.js';
import { ayKey, isShift, kisaAd, parse, ymd } from './yardimci.js';
import { odemeSubesi } from './gecmis.js';
import { gerekliSube } from './yazma.js';
import { render } from './cerceve.js';

/* ---- Çok şubeli çalışma ----
   ekSubeler: kişinin çalıştığı şube ve SGK şubesi dışında şu an çalıştığı diğer şubeler (sadece işveren / bölge müdürü değiştirir).
   gorunurSubeler: kişinin şimdiye kadar çalıştığı tüm şubeler; şubeden çıkarılsa da geçmiş haftaları görünsün diye hiç küçülmez.
   gunler/{kişi}__{ay}.g: gün gün hangi şubede ne yazıldığı. Bir kişi aynı gün iki şubede vardiyalı olamaz. */
export function ekSubeleri(p){return Array.isArray(p&&p.ekSubeler)?p.ekSubeler.filter(Boolean):[];}
export function kisiSubeleri(p){const s=new Set();if(!p)return[];if(p.anaSube)s.add(p.anaSube);if(p.sgkSube&&p.sgkSube!==SGK_YOK)s.add(p.sgkSube);ekSubeleri(p).forEach(x=>s.add(x));(p.gorunurSubeler||[]).forEach(x=>x&&s.add(x));return[...s];}
export function cokSubeli(p){return kisiSubeleri(p).length>1;}
// Boş gün (eksi mesai) sayılır mı: çok şubeli kişide boş gün sadece maaşının ödendiği şubede beklenir; başka şubede çalıştığı gün hiçbir yerde boş sayılmaz.
export function bosSayilir(p,d,sid=S.subeId){if(!cokSubeli(p))return true;if(digerGunler(p,d,sid))return false;return odemeSubesi(p,ayKey(d))===sid;}
export function subedeAktif(p,sid){return p.anaSube===sid||p.sgkSube===sid||ekSubeleri(p).includes(sid);}
// Şubeden çıkarılmış ama geçmiş haftaları için görünen kişi: yeni haftaya önerilmez, kopyalanmaz.
export function subedenCikti(p,sid=S.subeId){return !!p&&!subedeAktif(p,sid)&&(p.gorunurSubeler||[]).includes(sid);}
function gunDoc(pid,ak){const k=pid+'__'+ak;if(!(k in S.gunler)){S.gunler[k]=null;
    // Okunamayan gün kaydı sessizce "boş gün" sayılmaz: hata işaretlenir, ekranda uyarı çıkar (gunHataVar).
    subs.gun.push(onSnapshot(doc(db,'gunler',k),s=>{S.gunler[k]=s.exists()?s.data():{};if(S.gunHata)delete S.gunHata[k];gunRender();},e=>{console.error(e);S.gunler[k]={};(S.gunHata=S.gunHata||{})[k]=1;gunRender();}));}return S.gunler[k];}
export const gunHataVar=()=>!!S.gunHata&&Object.keys(S.gunHata).length>0;
export const GUN_HATA_YAZI='Bazı kişilerin başka şubedeki çalışma günleri okunamadı; o günler boş görünüyor ve fazla mesai / eksik gün yanlış çıkabilir. Sayfayı yenileyin; düzelmezse işverene haber verin, düzelmeden onaylamayın.';
let gunT;function gunRender(){clearTimeout(gunT);gunT=setTimeout(render,60);}
// Kişinin o gün diğer şubelerdeki kaydı {şube: değer} (bu şube hariç); yoksa null.
export function digerGunler(p,d,sid=S.subeId){if(!p||!cokSubeli(p))return null;const ds=typeof d==='string'?d:ymd(d);const D=gunDoc(p.id,ds.slice(0,7));
  const g=D&&D.g&&D.g[ds];if(!g)return null;const o={};Object.entries(g).forEach(([s,v])=>{if(s!==sid&&v)o[s]=v;});return Object.keys(o).length?o:null;}
// Aynı gün kuralı: vardiya varken başka şubede vardiya ya da rapor/ücretsiz/yıllık izin olamaz.
export function gunCakisir(yeni,diger){if(!yeni||!diger)return null;const IZ=['R','UI','YI'];
  for(const[s,v]of Object.entries(diger)){if(isShift(yeni)&&(isShift(v)||IZ.includes(v)))return{s,v};if(IZ.includes(yeni)&&isShift(v))return{s,v};}return null;}
export function cakismaMesaj(p,ds,c){const d=parse(ds);return `${kisaAd(p.ad)} ${d.getDate()} ${AY[d.getMonth()]} günü ${subeAdi(c.s)} şubesinde ${isShift(c.v)?c.v.replace('-',' – '):KOD[c.v]?KOD[c.v].ad.toLocaleLowerCase('tr-TR'):c.v} yazılı. Bir kişi aynı gün tek şubede çalışır; o gün nerede başladıysa oraya yazın.`;}
// Gün kaydını şubeler arası ortak belgeye yazar. Çakışma varsa yazmaz, çakışmayı döner.
export async function gunYaz(p,ds,val,sid){gerekliSube(sid);const ak=ds.slice(0,7);const ref=doc(db,'gunler',p.id+'__'+ak);
  return runTransaction(db,async tr=>{const s=await tr.get(ref);const g=(s.exists()&&s.data().g&&s.data().g[ds])||{};const o={};Object.entries(g).forEach(([x,v])=>{if(x!==sid&&v)o[x]=v;});
    const c=gunCakisir(val,o);if(c)return c;
    // Şube listesi eskisinin üstüne eklenir, hiç küçülmez (eski ekranda yazılan kayıt başka şubenin yetkisini düşürmesin).
    const subeler=[...new Set([...((s.exists()&&Array.isArray(s.data().subeler))?s.data().subeler:[]),...kisiSubeleri(p),sid])];
    tr.set(ref,{pid:p.id,ay:ak,subeler,g:{[ds]:{[sid]:val?val:deleteField()}}},{merge:true});return null;});}
export async function gunleriYukle(kisiler,aylar){const L=[];kisiler.filter(cokSubeli).forEach(p=>aylar.forEach(ak=>{const k=p.id+'__'+ak;if(!S.gunler[k])L.push(getDoc(doc(db,'gunler',k)).then(s=>{if(!S.gunler[k])S.gunler[k]=s.exists()?s.data():{};}).catch(e=>{console.error(e);(S.gunHata=S.gunHata||{})[k]=1;}));gunDoc(p.id,ak);}));await Promise.all(L);}
