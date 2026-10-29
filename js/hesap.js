// hesap.js — app.js (v180) satırları 186-321. Otomatik bölündü; davranış değişmedi.
import { doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AYK, BASLANGIC_AY, GRUP_SIRA, KOD, SGK_YOK, VARSAYILAN, onayli, subeAdi } from './sabitler.js';
import { db, setDoc } from './firebase.js';
import { S } from './durum.js';
import { addDays, ayAdi, ayKaydir, ayKey, esc, gosterAy, isShift, mondayOf, parse, shiftHours, today, weekDays, ymd } from './yardimci.js';
import { isIsveren, isSube } from './rol.js';
import { ayniKisi, bosSayilir, cokSubeli, digerGunler } from './cok-sube.js';
import { yazmaHatasi } from './yazma.js';
import { byId, render } from './cerceve.js';
import { toast } from './panel.js';

/* ================= Hesaplar ================= */
export function sube(id){const o=Object.assign({},VARSAYILAN,S.subeler[id||S.subeId]||{});o.haftalik=Math.round(o.gunluk*6*100)/100;return o;}// haftalık mesai = günlük × 6 (ayrı ayar yok)
// Hesaba giren şube ayarları aya göre: ayarGecmis {"2026-11": {gunluk, fmUcret, …}} = "o aydan itibaren". Ayar değişince önceki aylar eski ayarla kalır.
export const AYAR_ALANLARI=['gunluk','fmYontem','fmUcret','fmDonem'];
export function subeAyari(id,ak){const sb=sube(id);const g=sb.ayarGecmis;if(!g||!ak)return sb;const k=Object.keys(g).filter(x=>x<=ak).sort().pop();if(!k)return sb;const r={...sb,...g[k]};r.haftalik=Math.round(r.gunluk*6*100)/100;return r;}
export function ayarGecmisYama(id,yeni){const s0=sube(id);if(!S.subeler[id])return{};const ak0=ayKey(today());const ak=ak0<BASLANGIC_AY?BASLANGIC_AY:ak0;const g={...(s0.ayarGecmis||{})};
  const al=o=>Object.fromEntries(AYAR_ALANLARI.map(k=>[k,o[k]??VARSAYILAN[k]??null]));const simdi=subeAyari(id,ak);
  if(!AYAR_ALANLARI.some(k=>yeni[k]!==undefined&&yeni[k]!==simdi[k]))return{};
  if(!Object.keys(g).length)g[BASLANGIC_AY]=al(s0);// ilk değişiklik: o güne kadarki ayarlar başlangıçtan itibaren geçerli kalır
  g[ak]=al({...simdi,...yeni});return{ayarGecmis:g};}
export function cellOf(pid,wid,i,H=S.haftalar){const w=H[wid];const c=w&&w.cells&&w.cells[pid];const v=c?c[String(i)]:null;return v==null?null:v;}
// Fiili çalışma: işe başlama (deneme dahil) varsa ondan, yoksa SGK girişinden itibaren.
export function ilkGun(p){return p.baslama&&(!p.giris||p.baslama<p.giris)?p.baslama:p.giris;}
export function sgkli(p,d){const s=ymd(d);if(p.giris&&s<p.giris)return false;if(p.cikis&&s>p.cikis)return false;return true;}
export function employed(p,d){const s=ymd(d);const g=ilkGun(p);if(g&&s<g)return false;if(p.cikis&&s>p.cikis)return false;return true;}
// Çıkış yapan kişi, son çalıştığı ayın maaşı ödendikten sonra (ertesi ayın 10'undan sonra) Pasif'e geçer.
// Aynı kişinin başka bir (çıkmış) kaydı henüz pasife geçmediyse (ör. SGK'sız ikinci kayıt) ikisi birlikte geçer.
const PASIF_GUN=10;
export function pasifTarihi(c){const[y,m]=c.split('-').map(Number);return ymd(new Date(y,m,PASIF_GUN));}
export function pasifSure(p,td){return !!p.cikis&&td>pasifTarihi(p.cikis);}
export function pasifMi(p,td,list){if(!pasifSure(p,td))return false;return !list.some(x=>x.id!==p.id&&x.cikis&&x.cikis<td&&ayniKisi(x,p)&&!pasifSure(x,td));}
export function weekHasEntry(pid,wid,H=S.haftalar){const w=H[wid];const c=w&&w.cells&&w.cells[pid];return !!c&&Object.values(c).some(v=>v!=null&&v!=='');}
export function isEsnaf(p){return p.sekil==='Esnaf kurye';}
export function locked(d){const a=S.aylar[ayKey(d)];return !!a&&onayli(a.durum);} // aylık şube kapatması yok; haftalar kapatılır, ay sadece bölge onayında kilitlenir
export function aktifHaftada(p,wid){return weekDays(wid).some(d=>employed(p,d));}
export function aktifAyda(p,ak){const[y,m]=ak.split('-').map(Number);for(let d=new Date(y,m-1,1);d.getMonth()===m-1;d=addDays(d,1))if(employed(p,d))return true;return false;}
export function sirala(list){return list.slice().sort((a,b)=>GRUP_SIRA.indexOf(a.grup||'K')-GRUP_SIRA.indexOf(b.grup||'K')||(a.sira??999)-(b.sira??999)||String(a.ad).localeCompare(String(b.ad),'tr'));}
// Excel kuralı: hafta FM = çalışılan − (gün × günlük); 7 gün çalışılmışsa çalışılan − haftalık. Kaydı olmayan hafta sayılmaz; boş gün beklenen gündür.
// Çok şubeli kişide başka şubede çalıştığı gün bu şubede "boş gün" sayılmaz; o günün normal saati çalıştığı şubede beklenir.
// İzin kullanmadan 7 gün çalışılan haftanın fazlası (7 × günlük − haftalık) haftaYedi'nin seçtiği şubeye yazılır.
export function haftaHesap(p,wid,sb=sube(),H=S.haftalar){let h=0,wd=0,bos=0;const kayit=weekHasEntry(p.id,wid,H);const cs=cokSubeli(p);
  weekDays(wid).forEach((d,i)=>{if(!employed(p,d))return;const v=cellOf(p.id,wid,i,H);if(isShift(v)){h+=shiftHours(v);wd++;}else if((v==null||v==='')&&kayit&&bosSayilir(p,d))bos++;});
  const y=kayit?haftaYedi(p,wid,H):{yedi:false};const bonus=y.yedi&&y.sube===S.subeId?7*sb.gunluk-sb.haftalik:0;
  return{h,wd,bos,fm:!kayit?0:h-(wd+bos)*sb.gunluk+bonus,kayit};}
// Haftanın 7 günü de (bu şube + kişinin diğer şubeleri) vardiyalı mı? İzin günü mesaisini ödeyen şube: maaş şubesi dışında çalışılan son günün şubesi, yoksa maaş şubesi.
// Aynı kişinin birden fazla kaydı varsa (SGK şube devri, SGK'sız devam) hafta kişi bazında birleşik bakılır: her gün o gün çalışan kaydın hücresine bakılır.
// Sonuç yalnızca pazar günü çalışan kayıt için döner; böylece fazla mesai bonusu kayıtlar toplanırken bir kez sayılır.
export function haftaYedi(p,wid,H=S.haftalar,sid=S.subeId){const ds=weekDays(wid);const ms=odemeSubesi(p,ayKey(ds[6]));let son=null,burada=0;
  if(!employed(p,ds[6]))return{yedi:false};
  const grup=S.personel.filter(x=>x.id===p.id||ayniKisi(x,p));
  for(let i=0;i<7;i++){const d=ds[i];const E=grup.filter(x=>employed(x,d));if(!E.length)return{yedi:false};const L=[];if(E.some(x=>isShift(cellOf(x.id,wid,i,H)))){L.push(sid);burada++;}
    E.forEach(x=>{if(!cokSubeli(x))return;const o=digerGunler(x,d,sid);if(o)Object.entries(o).forEach(([s,v])=>{if(isShift(v))L.push(s);});});
    if(!L.length)return{yedi:false};L.forEach(s=>{if(s!==ms)son=s;});}
  return{yedi:true,sube:burada===7?sid:(son||ms)};}
// Bir haftanın kişi bazında ay ay dökümü (takvim ayı hesabıyla aynı kural): kapatılan haftanın özeti için.
export function haftaAyParca(p,wid,sb=sube(),H=S.haftalar){const o={};if(!weekHasEntry(p.id,wid,H))return o;const cs=cokSubeli(p);
  weekDays(wid).forEach((d,i)=>{if(!employed(p,d))return;const ak=ayKey(d);const x=o[ak]=o[ak]||{h:0,fm:0};const v=cellOf(p.id,wid,i,H);
    if(isShift(v)){const s=shiftHours(v);x.h+=s;x.fm+=s-sb.gunluk;}else if(!(v&&KOD[v])&&bosSayilir(p,d))x.fm-=sb.gunluk;
    if(i===6){const y=haftaYedi(p,wid,H);if(y.yedi&&y.sube===S.subeId)x.fm+=7*sb.gunluk-sb.haftalik;}});
  Object.values(o).forEach(x=>{x.h=Math.round(x.h*100)/100;x.fm=Math.round(x.fm*100)/100;});return o;}
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
// Fazla mesai dönemi geçişi: dönem, bir önceki ayın döneminin bittiği günün ertesinden başlar.
// Haftalıktan takvim ayına geçişte (Eylül 7 Eyl – 4 Eki haftalık, Ekim takvim) 1–4 Ekim Eylül'de ödendiği için Ekim 5 Ekim'den başlar;
// takvim ayından haftalığa geçişte aradaki günler (ör. 1 Kasım pazar) yeni aya eklenir. Böylece hiçbir gün iki kez ödenmez ya da boşta kalmaz.
function fmDonemTemel(ak,sb){if(sb.fmDonem==='hafta'){const L=fmHaftalari(ak);return{bas:L[0],son:ymd(addDays(parse(L[L.length-1]),6))};}
  const[y,m]=ak.split('-').map(Number);return{bas:ymd(new Date(y,m-1,1)),son:ymd(new Date(y,m,0))};}
function fmDonemAraligi(ak,sid=S.subeId,sb=subeAyari(sid,ak)){const t=fmDonemTemel(ak,sb);const once=ayKaydir(ak,-1);if(once<BASLANGIC_AY)return t;
  const po=fmDonemTemel(once,subeAyari(sid,once));return{bas:ymd(addDays(parse(po.son),1)),son:t.son};}
// Haftalık dönemde, dönemin ilk haftasından önceki geçiş günleri (takvim ayından haftalığa geçişte): günlük fazla mesai + o haftanın pazarı aralıktaysa 7 gün farkı.
function fmGecisGunleri(p,ak,sb,H=S.haftalar){const r=fmDonemAraligi(ak,S.subeId,sb);const ilk=fmHaftalari(ak)[0];let fm=0,h=0;
  for(let d=parse(r.bas);ymd(d)<ilk;d=addDays(d,1)){if(!employed(p,d))continue;const wid=mondayOf(d);const i=(d.getDay()+6)%7;const v=cellOf(p.id,wid,i,H);const kayit=weekHasEntry(p.id,wid,H);
    if(isShift(v)){const x=shiftHours(v);h+=x;fm+=x-sb.gunluk;}else if(!(v&&KOD[v])&&kayit&&bosSayilir(p,d))fm-=sb.gunluk;
    if(i===6&&kayit){const yy=haftaYedi(p,wid,H);if(yy.yedi&&yy.sube===S.subeId)fm+=7*sb.gunluk-sb.haftalik;}}
  return{fm,h};}
// Haftalık dönem: varsayılan = pazartesisi o ayda olan haftalar. Şube ayarında fmSon {"2026-08":"2026-08-30"} (dönemin son günü, pazar) ile
// ay 1 hafta kısa/uzun seçilebilir; sonraki ay bir önceki ayın bittiği günün ertesinden başlar (hiçbir hafta iki kez sayılmaz ya da boşta kalmaz).
function fmVarsayilanSon(ak){const[y,m]=ak.split('-').map(Number);let d=new Date(y,m,0);while(d.getDay()!==1)d=addDays(d,-1);return ymd(addDays(d,6));}
function fmSonGecerli(ak,e){if(!/^\d{4}-\d{2}-\d{2}$/.test(e||''))return false;const d=parse(e);return d.getDay()===0&&Math.abs((d-parse(fmVarsayilanSon(ak)))/864e5)<=21;}// pazar, varsayılan bitişten en çok 3 hafta
function fmBasGecerli(ak,b){if(!/^\d{4}-\d{2}-\d{2}$/.test(b||''))return false;const[y,m]=ak.split('-').map(Number);let f=new Date(y,m-1,1);while(f.getDay()!==1)f=addDays(f,1);const d=parse(b);return d.getDay()===1&&Math.abs((d-f)/864e5)<=21;}// pazartesi, ilk pazartesiden en çok 3 hafta
function fmSonu(ak,sid=S.subeId){const o=((S.subeler[sid]||{}).fmSon||{})[ak];return o&&fmSonGecerli(ak,o)?o:fmVarsayilanSon(ak);}
export function fmHaftalari(ak,sid=S.subeId){const[y,m]=ak.split('-').map(Number);const L=[];let d=new Date(y,m-1,1);while(d.getDay()!==1)d=addDays(d,1);
  const once=ayKaydir(ak,-1);if(once>=BASLANGIC_AY&&subeAyari(sid,once).fmDonem==='hafta'&&((S.subeler[sid]||{}).fmSon||{})[once])d=addDays(parse(fmSonu(once,sid)),1);
  else if(once<BASLANGIC_AY){const b=((S.subeler[sid]||{}).fmBas||{})[ak];if(fmBasGecerli(ak,b))d=parse(b);}// sistemin ilk ayı: başlangıç seçilebilir
  const son=fmSonu(ak,sid);const d0=ymd(d);for(;ymd(d)<=son;d=addDays(d,7))L.push(ymd(d));if(!L.length)L.push(d0);return L;}
// İşveren: haftalık dönemde ayın kaç hafta ödeneceğini seçer (ör. Ağustos 4 hafta, Eylül 5 hafta). Ay ya da sonraki ay onaylıysa kilitli.
export function fmSecici(ak,sb){if(!isIsveren()||sb.fmDonem!=='hafta'||ak<BASLANGIC_AY)return'';const sid=S.subeId;const L=fmHaftalari(ak,sid);const bas=L[0],cur=fmSonu(ak,sid);
  const kilitli=['sube_onay','bolge_onay','kesin'].includes((S.aylar[ak]||{}).durum)||['bolge_onay','kesin'].includes((S.aylar[ayKaydir(ak,1)]||{}).durum);
  const yaz=t=>{const d=parse(t);return `${d.getDate()} ${AYK[d.getMonth()]}`;};const ilkAy=ayKaydir(ak,-1)<BASLANGIC_AY;const dis=kilitli?'disabled':'';
  const basHtml=ilkAy?`<label class="field"><span>Fazla mesai dönemi başlangıcı (${esc(subeAdi(sid))})</span><input type="date" id="fmBasSec" value="${bas}" ${dis}></label>`:'';
  return basHtml+`<label class="field"><span>Fazla mesai dönemi bitişi (${esc(subeAdi(sid))})</span><input type="date" id="fmSonSec" value="${cur}" ${dis}></label>
  <p class="note">${L.length} hafta · ${yaz(bas)} – ${yaz(cur)}. ${kilitli?'Ay ya da sonraki ay onaylandığı için dönem değiştirilemez; önce kilidi açın.':`${ilkAy?'Sistemin ilk ayı: başlangıç ve bitiş tarihini siz seçersiniz. ':''}Seçtiğiniz tarih hafta sınırına oturtulur (başlangıç pazartesi, bitiş pazar). Sonraki ay, bu ayın bittiği günün ertesinden başlar.`}</p>`;}
function fmDonemKaydet(ak,alan,v){const sid=S.subeId;const eski=(S.subeler[sid]||{})[alan]||{};return setDoc(doc(db,'subeler',sid),{[alan]:{[ak]:v}},{merge:true}).then(()=>{S.subeler[sid]={...S.subeler[sid],[alan]:{...eski,[ak]:v}};toast('Fazla mesai dönemi güncellendi.');render();}).catch(yazmaHatasi);}
export function fmSeciciBagla(ak){const bb=byId('fmBasSec'),e=byId('fmSonSec');
  if(bb)bb.onchange=()=>{if(!bb.value){render();return;}const v=mondayOf(parse(bb.value));if(!fmBasGecerli(ak,v)){toast('Başlangıç, ayın ilk pazartesisinden en çok 3 hafta uzakta olabilir.');render();return;}if(v>fmSonu(ak)){toast('Başlangıç bitişten sonra olamaz.');render();return;}fmDonemKaydet(ak,'fmBas',v);};
  if(e)e.onchange=()=>{if(!e.value){render();return;}const v=ymd(addDays(parse(mondayOf(parse(e.value))),6));if(!fmSonGecerli(ak,v)){toast('Bitiş, ay sonundan en çok 3 hafta uzakta olabilir.');render();return;}if(v<ymd(addDays(parse(fmHaftalari(ak)[0]),6))){toast('Dönem en az 1 hafta olmalı.');render();return;}fmDonemKaydet(ak,'fmSon',v);};}
export function fmDonemYazi(ak,sb=sube()){const r=fmDonemAraligi(ak,S.subeId,sb);const t=fmDonemTemel(ak,sb);if(sb.fmDonem!=='hafta'&&r.bas===t.bas)return'';const a=parse(r.bas),b=parse(r.son);return `${a.getDate()} ${AYK[a.getMonth()]} – ${b.getDate()} ${AYK[b.getMonth()]}`;}
// Çizelgedeki "ay fazla mesai" sütununun ayı: haftalık dönemde haftanın pazartesisinin ayı
export function fmAyi(wid,sb=sube()){if(sb.fmDonem!=='hafta')return gosterAy(wid);const a=ayKey(parse(wid));const sbd=S.subeler[S.subeId]||{};if(!Object.keys(sbd.fmSon||{}).length&&!Object.keys(sbd.fmBas||{}).length)return a;return[a,ayKaydir(a,1),ayKaydir(a,-1)].find(k=>k>=BASLANGIC_AY&&fmHaftalari(k).includes(wid))||a;}
// Haftanın listesi (kadro): o hafta çizelgede görünen kişiler. Kayıtlı değilse önceki haftanın listesi önerilir.
export function maasSubesi(p){return p.sgkSube&&p.sgkSube!==SGK_YOK?p.sgkSube:(p.anaSube||'');}
// Maaşın ödendiği şube: varsayılan SGK şubesi; "çalıştığı şubede" seçildiyse çalıştığı şube. Muhasebe (bordro) her zaman SGK şubesinde.
export function odemeSubesiEski(p){const sgk=p.sgkSube&&p.sgkSube!==SGK_YOK?p.sgkSube:'';if(sgk&&p.anaSube&&sgk!==p.anaSube&&p.maasYeri!=='sgk')return p.anaSube;return maasSubesi(p);}
// Maaş şubesi aya göre: maasSubeGecmis {"2026-10":"şubeId"} = "o aydan itibaren". Kayıt yoksa eski kural (çalıştığı şube / SGK).
export function odemeSubesi(p,ak){const g=p&&p.maasSubeGecmis;if(g&&ak){const k=Object.keys(g).filter(x=>x<=ak&&g[x]).sort().pop();if(k)return g[k];}return odemeSubesiEski(p);}
// Maaş şubesini "ak ayından itibaren" değiştirir; önceki aylar o ana kadarki şubede donar. yeni: şube id'si ya da kişinin yeni alanları.
export function maasGecmisYama(p,yeni,ak){if(!ak||ak<BASLANGIC_AY)ak=BASLANGIC_AY;const g0=p.maasSubeGecmis||{};const g={...g0};const ilk=!Object.keys(g0).length;
  if(ilk)g[BASLANGIC_AY]=odemeSubesiEski(p);const once=odemeSubesi({...p,maasSubeGecmis:g},ak);
  const y=typeof yeni==='string'?yeni:odemeSubesiEski({...p,...yeni});if(!y||y===once)return null;
  g[ak]=y;return{maasSubeGecmis:g,maasSubeleri:[...new Set(Object.values(g).filter(Boolean))]};}
// Görev geçmişi: gorevGecmis {"2026-09":{gorev,grup,sekil}} = "o aydan itibaren". Ay hesabında kişinin o ayki görevi, grubu ve çalışma şekli kullanılır.
// İlk kayıttan önceki aylar ilk kaydın değerini alır. Kişinin üstteki gorev/grup/sekil alanları her zaman en son kaydın değeridir.
export function gorevAyda(p,ak){const g=p&&p.gorevGecmis;if(!g||!ak)return p;const ks=Object.keys(g).filter(x=>g[x]&&g[x].gorev).sort();if(!ks.length)return p;const v=g[ks.filter(x=>x<=ak).pop()||ks[0]];
  if(v.gorev===p.gorev&&(v.grup||p.grup)===p.grup&&(v.sekil||p.sekil)===p.sekil)return p;return{...p,gorev:v.gorev,grup:v.grup||p.grup,sekil:v.sekil||p.sekil};}
// Görevi "ak ayından itibaren" değiştirir; önceki aylar eski görevde kalır. yeni: {gorev,grup,sekil}.
export function gorevGecmisYama(p,yeni,ak){if(!ak||ak<BASLANGIC_AY)ak=BASLANGIC_AY;const g0=p.gorevGecmis||{};const g={...g0};
  if(!Object.keys(g0).length)g[BASLANGIC_AY]={gorev:p.gorev||'',grup:p.grup||'K',sekil:p.sekil||'Tam'};
  const once=gorevAyda({...p,gorevGecmis:g},ak);if(g[ak]&&once.gorev===yeni.gorev&&once.grup===yeni.grup&&once.sekil===yeni.sekil)return null;
  g[ak]={gorev:yeni.gorev,grup:yeni.grup,sekil:yeni.sekil};const son=g[Object.keys(g).sort().pop()];return{gorevGecmis:g,gorev:son.gorev,grup:son.grup,sekil:son.sekil};}
export function gorevGecmisYazi(p){const g=(p&&p.gorevGecmis)||{};return Object.keys(g).filter(k=>g[k]&&g[k].gorev).sort().map(k=>`${ayAdi(k)}: ${g[k].gorev}${g[k].sekil&&g[k].sekil!=='Tam'?' ('+g[k].sekil+')':''}`).join(' · ');}
// Personel tablosundan görev / şekil düzeltmesi: geçmişi olan kişide bu aydan itibaren geçerli olur, geçmişi olmayanda eskisi gibi tüm aylar.
export function gorevSatirYama(p,body){if(!p.gorevGecmis||!Object.keys(p.gorevGecmis).length)return body;const y=gorevGecmisYama(p,{gorev:body.gorev??p.gorev,grup:body.grup??p.grup,sekil:body.sekil??p.sekil},ayKey(today()));return y||body;}
export function maasSubeGecmisYazi(p){const g=(p&&p.maasSubeGecmis)||{};return Object.keys(g).sort().map(k=>`${ayAdi(k)}: ${subeAdi(g[k])}`).join(' · ');}
