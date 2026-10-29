// puantaj-veri.js — app.js (v180) satırları 1499-1544. Otomatik bölündü; davranış değişmedi.
import { doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ozBirlestir, veriDis, veriGunHesap, veriOzet, veriUygula } from './sabitler.js';
import { db, setDoc } from './firebase.js';
import { S } from './durum.js';
import { ayAdi, fmt, isShift, sayi, tl0 } from './yardimci.js';
import { puantajYetki } from './rol.js';
import { subeAyari } from './hesap.js';
import { odemeSubesi } from './gecmis.js';
import { ayniKisi, gunHaritasi } from './ay-ozet.js';
import { otoKapi, sagHesap, solHesap } from './puantaj-hesap.js';
import { yazmaHatasi } from './yazma.js';
import { toast } from './panel.js';

export function ucretSekli(pid){const kp=S.personel.find(x=>x.id===pid);if(kp&&kp.paketBasi===true)return'paket';/* kişi paket başı: her şubede */const m=S.pt.maas||{};const u=m.ucretSekli&&m.ucretSekli[pid];if(u)return u;return m.paketBasi&&m.paketBasi[pid]?'paket':'maas';}
export function paketBasiMi(pid){return ucretSekli(pid)==='paket';}
// Paket başı kuryede bordro tutarı (bankaya yatan) en çok çalıştığı şubeye yazılır (çizelgedeki vardiyalı gün sayısı; eşitse maaş/SGK şubesi). Diğerlerinde maaşın ödendiği şube.
function enCokCalisilanSube(pid,ak,varsayilan){const p=S.personel.find(x=>x.id===pid);if(!p)return varsayilan;const kayit=S.personel.filter(x=>x.id===pid||ayniKisi(x,p));const sayac={};const say=g=>Object.values(g||{}).filter(v=>isShift(v)).length;
  kayit.forEach(q=>{const n=say(gunHaritasi(q,ak));if(n)sayac[S.subeId]=(sayac[S.subeId]||0)+n;});
  Object.entries(S.pt.ozetler||{}).forEach(([sb,k])=>{if(sb===S.subeId||!k)return;kayit.forEach(q=>{const x=k[q.id];const n=x?say(x.g):0;if(n)sayac[sb]=(sayac[sb]||0)+n;});});
  const L=Object.entries(sayac).sort((a,b)=>b[1]-a[1]||(a[0]===varsayilan?-1:b[0]===varsayilan?1:0));return L.length?L[0][0]:varsayilan;}
export function bordroHedef(pid,ak,V){const r=V&&V.sol&&V.sol[pid];const p=S.personel.find(q=>q.id===pid);const h=r&&r.odemeSid?r.odemeSid:(p?odemeSubesi(p,ak):S.subeId);return paketBasiMi(pid)?enCokCalisilanSube(pid,ak,h):h;}
// Ücretler aya göre: "x ayından itibaren" kaydı tutulur, geçmiş aylar değişmez.
function ayDegeri(eski,gecmis,ak){const o={...(eski||{})};Object.entries(gecmis||{}).forEach(([pid,g])=>{const k=Object.keys(g||{}).filter(x=>x<=ak).sort().pop();if(k)o[pid]=g[k];});return o;}
export function netMap(ak=S.ay){const m=S.pt.maas||{};return ayDegeri(m.net,m.netGecmis,ak);}
function saatMap(ak=S.ay){const m=S.pt.maas||{};return ayDegeri(m.saatUcret,m.saatGecmis,ak);}
export function ucretGecmisi(alan,pid){const m=S.pt.maas||{};const g=(m[alan]||{})[pid]||{};return Object.keys(g).sort().map(k=>`${ayAdi(k)}: ${tl0(g[k]||0)}`).join(' · ');}
export function fmOzelMap(ak=S.ay){const m=S.pt.maas||{};return ayDegeri(null,m.fmOzelGecmis,ak);}
export function usOf(pid){return{tip:ucretSekli(pid),saatUcret:sayi(saatMap()[pid]),fmOzel:sayi(fmOzelMap()[pid]),ak:S.ay};}
export function ptSol(ak,D){const oz=veriOzet(D.veri,ak);const sol=solHesap(ak,S.subeId,S.pt.ozetler||{},Object.keys(oz));
  // Başka şubenin veri girişindeki rapor / izin / part gün: kişinin muhasebe ya da maaş satırı buradaysa burada da sayılır (aynı gün aynı tür bir kez).
  const own=ozBirlestir(oz,sol),dis=ozBirlestir(veriDis(ak,S.subeId,D),sol);const top={};
  [own,dis].forEach(M=>Object.entries(M).forEach(([pid,e])=>{const x=top[pid]=top[pid]||{};Object.entries(e).forEach(([t,v])=>{x[t]=(x[t]||0)+v;});}));
  veriUygula(sol,top);Object.entries(dis).forEach(([pid,e])=>{const r=sol[pid];if(r&&(r.maasBurada!==false||r.muhBurada))r.disVeri=e;});return sol;}
// Bu şubenin veri girişindeki gün türlerini şubeler arası ay özetine yazar (değişmediyse yazmaz).
export function jsSirali(o){return JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(x=>[x,v[x]])):v);}
const VG_YAZILAN={};let vgT=null;
export function veriGunYaz(sid,ak,vg){const key=ak+'__'+sid;VG_YAZILAN[key]=jsSirali(vg);return setDoc(doc(db,'ozetler',key),{sube:sid,ay:ak,veriGun:vg},{mergeFields:['sube','ay','veriGun']}).catch(e=>{delete VG_YAZILAN[key];throw e;});}
export function veriGunSenkron(){clearTimeout(vgT);vgT=setTimeout(()=>{const sid=S.pt.sube,ak=S.ay,D=S.pt.doc;
  if(!puantajYetki()||!sid||sid!==S.subeId||!D||!S.pt.ozetVeri||S.pt.ozetler===null||S.pt.ozetHata||!S.loaded.personel)return;
  const vg=veriGunHesap(D.veri,ak,D);const key=ak+'__'+sid;const once=VG_YAZILAN[key]!=null?VG_YAZILAN[key]:jsSirali(S.pt.ozetVeri[sid]||{});if(jsSirali(vg)===once)return;
  S.pt.ozetVeri={...S.pt.ozetVeri,[sid]:vg};veriGunYaz(sid,ak,vg).catch(yazmaHatasi);},1200);}
export function kesinEngel(){if(S.pt.doc&&S.pt.doc.kesin===true){toast('Bu ay kesin kapandı, değişiklik yapılamaz.');return true;}return false;}
export function ptVerisi(){const ak=S.ay;const D=S.pt.doc||{};
  if(D.kesin===true&&D.kesinSonuc){const K=D.kesinSonuc;const sb={...subeAyari(S.subeId,ak),...(K.sb||{})};const satir=(K.satir||[]).map(x=>({...x,sag:x.sag||{},hes:x.hes||{}}));const sol={};satir.forEach(x=>sol[x.pid]=x.sol);
    return{ak,kilitli:true,kesin:true,sol,satir,sb,D,oz:K.oz||{}};}const kilitli=D.kilitli===true;const sol=kilitli&&D.sol?D.sol:ptSol(ak,D);const oz=ozBirlestir(veriOzet(D.veri),sol);const sb=subeAyari(S.subeId,ak);const net=netMap(ak);
  const prevSag=(S.pt.prev&&S.pt.prev.sag)||{};const sag=D.sag||{};
  const ids=Object.keys(sol).sort((a,b)=>String(sol[a].ad).localeCompare(String(sol[b].ad),'tr'));
  const satir=ids.map(pid=>{const dv=prevSag[pid]&&prevSag[pid].kalan<0?prevSag[pid].kalan:0;return{pid,sol:sol[pid],sag:sag[pid]||{},net:net[pid],hes:sagHesap(pid,sol[pid],sag[pid],net[pid],sb,dv,oz[pid],usOf(pid),otoKapi(ak,kilitli,false))};});
  return{ak,kilitli,sol,satir,sb,D,oz};}
// Onaylı / kesin ayda saklanan muhasebe rakamları ile bugünkü hesap farklı mı (onaydan sonra çizelge, personel bilgisi ya da program değişti).
// Sadece gösterir; saklanan rakamlara dokunmaz. Düzeltmek için kilit açılıp yeniden onaylanır.
const FARK_ALAN=[['gun','gün'],['hakGun','çalışılan gün'],['rapor','rapor'],['ucretsiz','ücr. izin'],['yillik','yıllık izin'],['bayram','bayram'],['partGun','part gün'],['fmSaat','FM saat']];
export function saklananFark(V){if(!(V.kilitli||V.kesin))return[];const yeni=ptSol(V.ak,V.D||{}),eski=V.sol||{};const L=[];const kisi=(pid,r)=>S.personel.find(x=>x.id===pid)||{id:pid,ad:(r&&r.ad)||''};
  const es={};Object.keys(eski).forEach(pid=>{if(yeni[pid]){es[pid]=pid;return;}const p=kisi(pid,eski[pid]);const q=Object.keys(yeni).find(y=>!eski[y]&&!Object.values(es).includes(y)&&ayniKisi(kisi(y,yeni[y]),p));if(q)es[pid]=q;});
  Object.keys(eski).forEach(pid=>{const a=eski[pid]||{},b=yeni[es[pid]];if(!b){if(sayi(a.gun)||sayi(a.hakGun)||Math.abs(sayi(a.fmSaat))>0.004)L.push({ad:a.ad||pid,t:'güncel hesapta yok'});return;}
    const d=FARK_ALAN.filter(([k])=>Math.abs(sayi(a[k])-sayi(b[k]))>0.004).map(([k,n])=>`${n} ${fmt(sayi(a[k]))} → ${fmt(sayi(b[k]))}`);
    if((a.maasBurada!==false)!==(b.maasBurada!==false))d.push(b.maasBurada!==false?'maaşı artık bu şubede':'maaşı artık başka şubede');if(d.length)L.push({ad:a.ad||pid,t:d.join(', ')});});
  const kul=new Set(Object.values(es));Object.keys(yeni).forEach(pid=>{if(kul.has(pid))return;const b=yeni[pid];if(sayi(b.gun)||sayi(b.hakGun)||Math.abs(sayi(b.fmSaat))>0.004)L.push({ad:b.ad||pid,t:'onayda yoktu'});});
  return L;}
