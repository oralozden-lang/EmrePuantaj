// yedek.js — app.js (v180) satırları 2492-2515. Otomatik bölündü; davranış değişmedi.
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AYK, SGK_YOK, subeAdi } from './sabitler.js';
import { db } from './firebase.js';
import { S } from './durum.js';
import { addDays, isShift, parse, ymd } from './yardimci.js';
import { kisiSubeleri } from './cok-sube.js';
import { benAd } from './hafta-kapatma.js';
import { adBuyuk } from './excel-aktar.js';

/* ================= Yedek (işveren) =================
   Tüm veritabanını tek bir JSON dosyası olarak indirir. Ücretsiz planda otomatik yedek olmadığı için düzenli alınmalı.
   Dosyada maaş, TC ve IBAN bilgileri vardır; güvenli yerde saklanmalı. Eksik yedek yanıltıcı olacağı için bir bölüm okunamazsa yedek iptal edilir. */
function yedekJson(v){if(v&&typeof v.toDate==='function'&&typeof v.toMillis==='function')return{__zaman:v.toDate().toISOString()};
  if(Array.isArray(v))return v.map(yedekJson);if(v&&typeof v==='object'){const o={};Object.entries(v).forEach(([k,x])=>o[k]=yedekJson(x));return o;}return v;}
export async function yedekAl(durum){const B={};let n=0;const ekle=(yol,data)=>{B[yol]=yedekJson(data);n++;};
  const kol=async yol=>{const q=await getDocs(collection(db,...yol));q.docs.forEach(d=>ekle([...yol,d.id].join('/'),d.data()));durum(`${n} kayıt okundu…`);return q.docs.map(d=>d.id);};
  const tek=async yol=>{const s=await getDoc(doc(db,...yol));if(s.exists())ekle(yol.join('/'),s.data());};
  for(const k of ['kullanicilar','personel','ekPersonel','gunler','ozetler','iscilik'])await kol([k]);
  for(const d of ['kurulum','subeAdlari','goc','surum'])await tek(['sistem',d]);
  const subeIds=await kol(['subeler']);const tum=[...new Set([...subeIds,...Object.keys(S.subeAdlari||{})])].filter(x=>x&&x!==SGK_YOK);
  for(const s of tum){for(const alt of ['haftalar','durum','aylar','personel'])await kol(['subeler',s,alt]);await kol(['puantaj',s,'aylar']);await tek(['maaslar',s]);}
  return{uygulama:'puantaj-merkezi',yedekSurum:1,tarih:new Date().toISOString(),alan:benAd(),subeSayisi:tum.length,belgeSayisi:n,belgeler:B};}
// Her şubenin haftalarında: kişi silinmişse ya da kişinin o şubeyle bağı yoksa (çalıştığı / SGK / diğer / görünür şubeleri arasında değilse) listelenir.
export async function veriKontrolu(){const P=new Map(S.personel.map(p=>[p.id,p]));const out=[];const vg={};const tum=[...new Set([...S.subeIds,...Object.keys(S.subeAdlari||{})])].filter(x=>x&&x!==SGK_YOK);
  for(const sid of tum){const q=await getDocs(collection(db,'subeler',sid,'haftalar'));q.docs.forEach(d=>{const x=d.data()||{};const ids=new Set([...(Array.isArray(x.kadro)?x.kadro:[]),...Object.keys(x.cells||{})]);
    ids.forEach(pid=>{const dolu=Object.values((x.cells||{})[pid]||{}).filter(v=>v).length;const p=P.get(pid);
      if(!p){if(dolu)out.push({sid,wid:d.id,ad:pid,neden:'silinmiş kişi',dolu});return;}if(!kisiSubeleri(p).includes(sid))out.push({sid,wid:d.id,ad:adBuyuk(p.ad),neden:'bu şubeyle bağı yok',dolu});
      // Aynı gün iki şubede vardiya (eski yapıştırma hatasından kalmış olabilir)
      Object.entries((x.cells||{})[pid]||{}).forEach(([i,v])=>{if(!isShift(v))return;const ds=ymd(addDays(parse(d.id),+i));const k=pid+'|'+ds;(vg[k]=vg[k]||[]).push({sid,wid:d.id});});});});}
  const cg={};Object.entries(vg).forEach(([k,L])=>{if(new Set(L.map(x=>x.sid)).size<2)return;const[pid,ds]=k.split('|');const t=parse(ds);const sAd=[...new Set(L.map(x=>subeAdi(x.sid)))].join(', ');
    L.forEach(x=>{const g=x.sid+'|'+x.wid+'|'+pid;(cg[g]=cg[g]||{sid:x.sid,wid:x.wid,pid,gun:[],sAd}).gun.push(`${t.getDate()} ${AYK[t.getMonth()]}`);});});
  Object.values(cg).forEach(c=>{const p=P.get(c.pid);out.push({sid:c.sid,wid:c.wid,ad:p?adBuyuk(p.ad):c.pid,neden:`aynı gün iki şubede vardiya (${c.sAd}): ${c.gun.join(', ')}`});});
  return out.sort((a,b)=>String(a.sid).localeCompare(String(b.sid))||a.wid.localeCompare(b.wid));}
