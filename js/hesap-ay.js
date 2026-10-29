// hesap-ay.js — app.js (v180) satırları 236-260. Otomatik bölündü; davranış değişmedi.
import { KOD } from './sabitler.js';
import { S } from './durum.js';
import { addDays, isShift, mondayOf, parse, shiftHours, ymd } from './yardimci.js';
import { isSube } from './rol.js';
import { cellOf, employed, haftaHesap, haftaYedi, isEsnaf, sube, weekHasEntry } from './hesap.js';
import { fmAyi, fmDonemAraligi, fmGecisGunleri, fmHaftalari } from './fm-donem.js';
import { gorevAyda } from './gecmis.js';
import { bosSayilir, cokSubeli } from './cok-sube.js';

// SGK / bordro gün sayısı. Tam ayda eksik gün yoksa her ay 30. Eksik gün varsa takvim günü − eksik gün, en çok 30:
// 31 çeken ayda 1 gün rapor 30 kalır; Şubat 28 çekerse 27, 29 çekerse 28 olur.
// Ay ortasında giriş/çıkışta: çalışılan takvim günü (en çok 30) − eksik gün. eksik = rapor + ücretsiz izin.
export function sgkGunSayisi(calisilan,takvim,eksik){const tam=calisilan===takvim;const taban=tam?(eksik>0?takvim:30):Math.min(30,calisilan);return Math.max(0,Math.min(30,taban-eksik));}
export function ayHesap(p,ak,sb=sube(),H=S.haftalar,bitis=null){p=gorevAyda(p,ak);const[y,m]=ak.split('-').map(Number);const last=new Date(y,m,0);
  let h=0,fm=0,bos=0,gun=0,istihdam=0;const kod={};const cs=cokSubeli(p);const fmBas=sb.fmDonem==='hafta'?null:fmDonemAraligi(ak,S.subeId,sb).bas;
  for(let d=new Date(y,m-1,1);d<=last&&(!bitis||ymd(d)<=bitis);d=addDays(d,1)){if(!employed(p,d))continue;istihdam++;const wid=mondayOf(d);const i=(d.getDay()+6)%7;
    const v=cellOf(p.id,wid,i,H);const kayit=weekHasEntry(p.id,wid,H);const fmGun=!fmBas||ymd(d)>=fmBas;// geçiş: önceki ayın haftalık döneminde ödenen günler sayılmaz
    if(isShift(v)){const x=shiftHours(v);h+=x;if(fmGun)fm+=x-sb.gunluk;gun++;}else if(v&&KOD[v])kod[v]=(kod[v]||0)+1;else if(kayit&&bosSayilir(p,d)){if(fmGun)fm-=sb.gunluk;bos++;}
    // İzinsiz haftanın fazlası haftanın bittiği güne (pazar) yazılır: hafta iki aya bölünse de pazarın ayına gider.
    if(i===6&&kayit&&fmGun){const yy=haftaYedi(p,wid,H);if(yy.yedi&&yy.sube===S.subeId)fm+=7*sb.gunluk-sb.haftalik;}}
  // Haftalık dönem: pazartesisi bu ayda olan haftalar (örn. Eylül 2026 = 7 Eylül – 4 Ekim); takvim ayından geçişte aradaki günler de
  if(sb.fmDonem==='hafta'){fm=0;fmHaftalari(ak).forEach(wid=>{fm+=haftaHesap(p,wid,sb,H).fm;});fm+=fmGecisGunleri(p,ak,sb,H).fm;}
  const part=p.sekil==='Part',esnaf=isEsnaf(p),fmYok=part||esnaf;
  const tamAy=istihdam===last.getDate();
  const bordroGun=sgkGunSayisi(istihdam,last.getDate(),(kod.R||0)+(kod.UI||0));
  return{h,fm:fmYok?0:fm,fmHam:esnaf?0:fm,bos:esnaf?0:bos,gun,kod,part,esnaf,bordroGun,tamAy};}
// Çizelgedeki ay sütunu: o haftaya kadar (o hafta dahil) birikmiş fazla mesai ve saat. Haftalık dönemde dönemin haftaları, takvim ayında haftanın son gününe kadar.
export function ayKadar(p,wid,sb=sube(),H=S.haftalar){const ak=fmAyi(wid,sb);p=gorevAyda(p,ak);const fmYok=p.sekil==='Part'||isEsnaf(p);
  // Şube müdürü kapatılmış haftaları göremez: o haftaların toplamı kapatılırken kaydedilen özetten gelir.
  const oz=w=>!H[w]?(((S.haftaDurum.w||{})[w]||{}).oz||{})[p.id]:null;
  if(sb.fmDonem==='hafta'){let h=0,fm=fmGecisGunleri(p,ak,sb,H).fm;fmHaftalari(ak).filter(w=>w<=wid).forEach(w=>{const z=oz(w);if(z){h+=z.h||0;fm+=z.fm||0;return;}const x=haftaHesap(p,w,sb,H);h+=x.h;fm+=x.fm;});return{h,fm:fmYok?0:fm};}
  const r=ayHesap(p,ak,sb,H,ymd(addDays(parse(wid),6)));if(!isSube())return r;const o={...r};
  const[y,m]=ak.split('-').map(Number);const fmBas=fmDonemAraligi(ak,S.subeId,sb).bas;for(let w=parse(mondayOf(new Date(y,m-1,1)));ymd(w)<=wid;w=addDays(w,7)){const z=oz(ymd(w));const a=z&&z.a&&z.a[ak];if(a){o.h+=a.h||0;if(!fmYok&&ymd(addDays(w,6))>=fmBas)o.fm+=a.fm||0;}}// geçiş: önceki ayın haftalık döneminde ödenen hafta sayılmaz
  return o;}
