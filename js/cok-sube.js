// cok-sube.js — app.js (v180) satırları 322-472. Otomatik bölündü; davranış değişmedi.
import { deleteField, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AY, AYK, GRUP_SIRA, KOD, SGK_YOK, subeAdi } from './sabitler.js';
import { db, runTransaction } from './firebase.js';
import { S, subs } from './durum.js';
import { addDays, ascii, ayKey, gosterAy, isShift, isimAnahtar, kisaAd, mondayOf, parse, sayi, tnum, weekDays, ymd } from './yardimci.js';
import { aktifAyda, ayHesap, ayKadar, cellOf, employed, fmAyi, gorevAyda, haftaHesap, ilkGun, maasSubesi, odemeSubesi, sgkGunSayisi, sgkli, subeAyari } from './hesap.js';
import { gerekliSube } from './yazma.js';
import { render } from './cerceve.js';
import { subePersoneli } from './personel.js';

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
export function kisaSubeAd(s){const a=subeAdi(s)||'';const p=a.split(/\s+/);return p.length>1&&/^(ankara|antalya|isparta|burdur)$/i.test(ascii(p[0]))?p.slice(1).join(' '):a;}
export function kadroDoc(wid,H=S.haftalar){const w=H[wid];if(!w){const k=H===S.haftalar&&((S.haftaDurum.w||{})[wid]||{}).k;return Array.isArray(k)&&k.length?k:null;}if(Array.isArray(w.kadro))return w.kadro;const c=Object.keys(w.cells||{});return c.length?c:null;}
export function kadroOf(wid){const k=S.haftalar[wid]&&kadroDoc(wid);if(k)return{ids:k,oneri:false};const ds=weekDays(wid);
  for(let i=1;i<=8;i++){const kk=kadroDoc(ymd(addDays(parse(wid),-7*i)));if(kk)return{ids:kk.filter(id=>{const p=S.personel.find(x=>x.id===id);return p&&!subedenCikti(p)&&ds.some(d=>employed(p,d));}),oneri:true};}
  return{ids:[],oneri:true};}
// Çizelgede aynı kişinin birden fazla kaydı (SGK şube değişikliği) tek satırda: her gün o gün çalışan kayda yazılır.
export let CZ_ES={};
export function rowPid(pid,i,wid=S.hafta){const L=CZ_ES[pid];if(!L)return pid;const d=weekDays(wid)[i];const q=L.find(x=>employed(x,d));return q?q.id:pid;}
export function gunKaydiP(p,d){const L=CZ_ES[p.id]||[p];return L.find(x=>employed(x,d))||null;}
export function haftaHesapS(p,wid,sb){const L=CZ_ES[p.id];if(!L)return haftaHesap(p,wid,sb);const o={h:0,fm:0};L.forEach(q=>{const x=haftaHesap(q,wid,sb);o.h+=x.h;o.fm+=x.fm;});return o;}
export function ayKadarS(p,wid,sb){let L=CZ_ES[p.id];
  // O hafta kadroda sadece devam kaydı varsa (ör. SGK çıkıştan sonra SGK'sız devam), aynı kişinin o aydaki önceki kaydı da aya-kadar toplamına katılır.
  if(!L){const ak=fmAyi(wid,sb);const es=subePersoneli().filter(x=>x.id===p.id||(ayniKisi(x,p)&&aktifAyda(x,ak)));if(es.length>1)L=es;}
  if(!L)return ayKadar(p,wid,sb);const o={h:0,fm:0};L.forEach(q=>{const x=ayKadar(q,wid,sb);o.h+=x.h;o.fm+=x.fm;});return o;}
export function cizelgeKisileri(wid){const ids=kadroOf(wid).ids;let L=ids.map(id=>S.personel.find(p=>p.id===id)).filter(Boolean);
  if(wid===S.hafta)CZ_ES={};const son=weekDays(wid)[6];const gor=new Set();const out=[];
  L.forEach(p=>{if(gor.has(p.id))return;const es=L.filter(x=>x.id===p.id||(!gor.has(x.id)&&ayniKisi(x,p)));es.forEach(x=>gor.add(x.id));
    if(es.length<2){out.push(p);return;}es.sort((a,b)=>String(a.giris||ilkGun(a)||'').localeCompare(String(b.giris||ilkGun(b)||'')));
    const rep=es.find(x=>employed(x,son))||es[es.length-1];if(wid===S.hafta)CZ_ES[rep.id]=es;out.push(rep);});
  L=out.map(p=>gorevAyda(p,gosterAy(wid)));const sira=id=>{const L2=CZ_ES[id]||[{id}];return Math.min(...L2.map(x=>{const k=ids.indexOf(x.id);return k<0?999:k;}));};
  return L.sort((a,b)=>GRUP_SIRA.indexOf(a.grup||'K')-GRUP_SIRA.indexOf(b.grup||'K')||sira(a.id)-sira(b.id));}
export function ayKadroIds(ak,H=S.haftalar){const[y,m]=ak.split('-').map(Number);const set=new Set();const last=new Date(y,m,0);
  for(let w=parse(mondayOf(new Date(y,m-1,1)));w<=last;w=addDays(w,7)){const k=kadroDoc(ymd(w),H);if(k)k.forEach(id=>set.add(id));}return set;}
export function ayKadrosu(ak){const ids=ayKadroIds(ak);return S.personel.filter(p=>ids.has(p.id)&&aktifAyda(p,ak));}
// Bu şubede çalışılan saat ve izinlerin aylık özeti (diğer şubelerin puantajı için kaydedilir).
export function subeOzeti(ak,sid=S.subeId){const sb=subeAyari(sid,ak);const out={};ayKadrosu(ak).forEach(p=>{const a=ayHesap(p,ak,sb);
  out[p.id]={saat:Math.round(a.h*100)/100,fm:Math.round((a.part?a.fmHam:a.fm)*100)/100,gun:a.gun,bos:a.bos,R:a.kod.R||0,UI:a.kod.UI||0,YI:a.kod.YI||0,B:a.kod.B||0,D:a.kod.D||0,g:gunHaritasi(p,ak)};});return out;}
// Kişinin aydaki gün gün çizelgesi {"2026-10-05":"10:00-15:00" | "B" | "R" ...}: şubeler arası tekrar ve çakışma kontrolü için.
export function gunHaritasi(p,ak,H=S.haftalar){const[y,m]=ak.split('-').map(Number);const g={};
  for(let d=new Date(y,m-1,1);d.getMonth()===m-1;d=addDays(d,1)){if(!employed(p,d))continue;const v=cellOf(p.id,mondayOf(d),(d.getDay()+6)%7,H);if(isShift(v)||(v&&KOD[v]))g[ymd(d)]=v;}return g;}
const IZIN_KODLARI=['R','UI','YI'];
// Aynı kişi mi: iki kayıtta da TC varsa TC, yoksa ad soyad.
export function ayniKisi(a,b){if(a.tc&&b.tc)return a.tc===b.tc;return isimAnahtar(a.ad)===isimAnahtar(b.ad);}
export const sgkVar=p=>!!(p.sgkSube&&p.sgkSube!==SGK_YOK);
// SGK girişi boş olan kayıt, aynı kişinin başka kaydında SGK girişi varsa gerçek SGK kaydı değildir (çift SGK günü sayılmaz).
const sgkYansiKayit=p=>sgkVar(p)&&!p.giris&&S.personel.some(x=>x.id!==p.id&&sgkVar(x)&&x.giris&&ayniKisi(x,p));
// SGK şube değişikliği: aynı kişinin bu ay farklı şubelerde (farklı tarihlerde) SGK kaydı. En son girişli kayıt başta.
function sgkGecisGrubu(p,ak){if(!sgkVar(p))return[];const L=S.personel.filter(x=>sgkVar(x)&&aktifAyda(x,ak)&&(x.id===p.id||(ayniKisi(x,p)&&x.sgkSube!==p.sgkSube)));
  if(L.length<2)return[];return L.sort((a,b)=>String(b.giris||'').localeCompare(String(a.giris||'')));}
function vardiyaAralik(v){const[a,b]=v.split('-');const s=tnum(a);let e=tnum(b);if(e<=s)e+=24;return[s,e];}
// Birden fazla şubenin gün haritasını birleştirir: aynı gün aynı kod bir kez sayılır; saat çakışması ve izinliyken çalışma bulunur.
// kaynaklar: [{sube, g, sayac}] — g yoksa (eski özet) sayac olduğu gibi eklenir.
function gunBirlestir(kaynaklar,filtre=null){const tarih={R:new Set(),UI:new Set(),YI:new Set(),B:new Set()};const ek={R:0,UI:0,YI:0,B:0};const gunler={};
  kaynaklar.forEach(k=>{if(!k.g){Object.keys(ek).forEach(c=>ek[c]+=(k.sayac&&k.sayac[c])||0);return;}
    Object.entries(k.g).forEach(([d,v])=>{if(filtre&&!filtre(d))return;if(tarih[v])tarih[v].add(d);(gunler[d]=gunler[d]||[]).push({sube:k.sube,v});});});
  const cakisma=[];Object.keys(gunler).sort().forEach(d=>{const L=gunler[d];if(L.length<2)return;const vard=L.filter(x=>isShift(x.v)),izin=L.filter(x=>IZIN_KODLARI.includes(x.v));let sorun=false;
    for(let i=0;i<vard.length&&!sorun;i++)for(let j=i+1;j<vard.length;j++){const[a1,b1]=vardiyaAralik(vard[i].v),[a2,b2]=vardiyaAralik(vard[j].v);if(a1<b2&&a2<b1){sorun=true;break;}}
    if(!sorun&&vard.length&&izin.length)sorun=true;
    if(sorun){const t=parse(d);cakisma.push(`${t.getDate()} ${AYK[t.getMonth()]}: `+L.map(x=>`${subeAdi(x.sube)} ${isShift(x.v)?x.v:KOD[x.v].ad.toLocaleLowerCase('tr-TR')}`).join(' · '));}});
  const say={};Object.keys(tarih).forEach(c=>say[c]=tarih[c].size+ek[c]);return{say,cakisma};}
// Puantaj sol tarafı. Maaş (bordro günü, izinler) kişinin SGK şubesinde; fazla mesai çalıştığı her şubede ayrı.
export function solHesap(ak,sid=S.subeId,diger=S.pt.ozetler||{},ekIds=[]){const sb=subeAyari(sid,ak);const out={};const burada=subeOzeti(ak,sid);
  const ids=new Set(Object.keys(burada));ekIds.forEach(x=>{if(S.personel.some(p=>p.id===x))ids.add(x);});S.personel.forEach(p=>{if((maasSubesi(p)===sid||odemeSubesi(p,ak)===sid)&&aktifAyda(p,ak))ids.add(p.id);});
  // Aynı kişi birden fazla şubenin listesinde ayrı kayıtla olabilir (SGK'sı burada): tek satırda birleşir. Aynı kişi: iki kayıtta da TC varsa TC, yoksa ad soyad
  // (aynı isimli ama TC'si farklı iki kişi ayrı satırda kalır).
  const esler={};const grp=[];[...ids].forEach(pid=>{const p=S.personel.find(x=>x.id===pid);if(!p)return;const g=grp.find(L=>L.some(x=>ayniKisi(x,p)));if(g)g.push(p);else grp.push([p]);});
  // Satırın asıl kaydı: SGK'sı burada olan (birden fazlaysa bu ay SGK'lı olan), sonra çalıştığı şube burada olan.
  grp.forEach(L=>{if(L.length<2)return;const sg=x=>aktifAyda(x,ak)&&sgkVar(x)?1:0;
    L.sort((a,b)=>sg(b)-sg(a)||(maasSubesi(b)===sid)-(maasSubesi(a)===sid)||String(b.giris||'').localeCompare(String(a.giris||''))||(b.anaSube===sid)-(a.anaSube===sid));esler[L[0].id]=L.map(x=>x.id);L.slice(1).forEach(x=>ids.delete(x.id));});
  const[y,m]=ak.split('-').map(Number);const last=new Date(y,m,0);
  ids.forEach(pid=>{const p0=S.personel.find(x=>x.id===pid);if(!p0)return;const p=gorevAyda(p0,ak);const pids=esler[pid]||[pid];const o={saat:0,fm:0,gun:0,bos:0,R:0,UI:0,YI:0,B:0};
    pids.forEach(q=>{const b=burada[q];if(b)Object.keys(o).forEach(k=>o[k]+=b[k]||0);});const tg=sgkGecisGrubu(p,ak);const maasKaydi=tg.length?tg[0]:p;// şube değişikliği olan ayda maaş tek kayıtta (son SGK girişi)
    // Maaş, maaş kaydının ödendiği şubedeki satırda ödenir; o satırın kaydı aynı kişinin eski SGK kaydı olsa da (ör. SGK şubesi değişti, kişi aynı şubede çalışıyor).
    const odemeSid=odemeSubesi(maasKaydi,ak);const maasBurada=odemeSid===sid;const muhBurada=maasSubesi(p)===sid;const tumGun=maasBurada||muhBurada;
    const t={R:o.R,UI:o.UI,YI:o.YI,B:o.B,saat:o.saat,baska:[],cakisma:[]};
    // SGK'lı kaydın ardından aynı kişi SGK'sız devam ediyorsa (ör. 21'inde SGK çıkış, 29'una kadar fiili çalışma): bordro günü SGK'lı günlere göre, hak edilen gün fiili çalışılan tüm günlere göre.
    const fiiliP=pids.map(q=>S.personel.find(x=>x.id===q)).filter(Boolean);const sgkDisi=sgkVar(p)&&fiiliP.some(x=>x.id!==p.id&&!sgkVar(x)&&aktifAyda(x,ak));
    const fiiliGrup=tg.length||sgkDisi?[...new Map([...tg,...(sgkDisi?fiiliP:[])].map(x=>[x.id,x])).values()]:[];
    const tumPid=[...new Set([...pids,...tg.map(x=>x.id)])];
    const kaynak=[];tumPid.forEach(q=>{const b=burada[q];if(b)kaynak.push({sube:sid,g:b.g,sayac:b});});
    if(tumGun)Object.entries(diger).forEach(([s2,k])=>{if(s2===sid||!k)return;let var_=false;tumPid.forEach(q=>{const x=k[q];if(!x)return;var_=true;kaynak.push({sube:s2,g:x.g,sayac:x});t.saat+=x.saat||0;});if(var_)t.baska.push(subeAdi(s2));});
    // İzin, rapor ve bayram: aynı gün iki şubede yazılsa da 1 gün sayılır.
    // Muhasebe: sadece bu kaydın SGK'lı olduğu günler (şube değişikliğinde her gün o tarihteki SGK şubesine gider).
    let tH={R:0,UI:0};
    if(kaynak.length){const bl=gunBirlestir(kaynak,sgkVar(p)?(d=>sgkli(p,parse(d))):null);t.R=bl.say.R;t.UI=bl.say.UI;t.YI=bl.say.YI;t.B=bl.say.B;t.cakisma=gunBirlestir(kaynak).cakisma;
      tH=fiiliGrup.length?gunBirlestir(kaynak,d=>fiiliGrup.some(x=>employed(x,parse(d)))).say:t;}
    // SGK şubesi ay içinde değişen kişi: işçilikte iki kaydın SGK günleri maaş şubesinde birlikte sayılır, tek kayıt gibi en çok 30 (31 günlük maaş yok).
    const tgS=tg.filter(x=>!sgkYansiKayit(x));let ist=0,istF=0,istS=0;for(let d=new Date(y,m-1,1);d<=last;d=addDays(d,1)){if(sgkVar(p)&&!sgkYansiKayit(p)&&sgkli(p,d))ist++;/* SGK şubesi 'Boş' ise SGK günü yok */if(fiiliGrup.length?fiiliGrup.some(x=>employed(x,d)):employed(p,d))istF++;if(tgS.some(x=>sgkli(x,d)))istS++;}
    const eS=tg.length?(()=>{const b=kaynak.length?gunBirlestir(kaynak,d=>tgS.some(x=>sgkli(x,parse(d)))).say:t;return(b.R||0)+(b.UI||0);})():0;
    const gun=sgkGunSayisi(ist,last.getDate(),t.R+t.UI);const hakGun=sgkGunSayisi(istF,last.getDate(),tH.R+tH.UI);const part=p.sekil==='Part';const iscGun=tg.length&&maasBurada&&!part?sgkGunSayisi(istS,last.getDate(),eS):null;
    out[pid]={ad:p.ad,maasBurada,sgkSube:p.sgkSube===SGK_YOK?'':p.sgkSube?subeAdi(p.sgkSube):subeAdi(p.anaSube),sekil:p.sekil||'Tam',gorev:p.gorev||'',grup:p.grup||'K',giris:p.giris||'',cikis:p.cikis||'',
      rapor:tumGun?t.R:0,ucretsiz:tumGun?t.UI:0,yillik:tumGun?t.YI:0,bayram:tumGun?t.B:0,muhBurada,odemeSube:subeAdi(odemeSid),odemeSid,partGun:0,// part gün elle, veri girişinden
      gunTaban:{ist,istF,takvim:last.getDate(),e:t.R+t.UI,eH:tH.R+tH.UI,...(iscGun!=null?{iS:istS,eS}:{})},...(iscGun!=null?{iscGun}:{}),// veri girişindeki rapor / ücretsiz izin gün sayısını aynı kuralla düşürmek için
      muhSekil:p.sekil||'Tam',
      fmSaat:o.fm,calisilanSaat:o.saat,gun:tumGun?gun:0,hakGun:tumGun?hakGun:0,// part: bordro günü = part gün (veri girişinden); girilmemişse normal gün
      baslama:p.baslama&&p.baslama<(p.giris||'9')?p.baslama:'',sgkDisi:sgkDisi?1:0,bosGun:o.bos,baska:t.baska,cakisma:t.cakisma,sgkYok:p.sgkSube===SGK_YOK};});
  return out;}
// Muhasebeye giden tarafta sadece SGK'sı bu şubede olanlar; başka şubenin SGK'lısı ve SGK'sı olmayanlar sadece ödemelerde.
// Muhasebede görev adı: kuryeler muhasebenin kullandığı şekilde "Sürücü" yazılır
export function muhGorev(sol){const g=sol.gorev||'';return /kurye/i.test(g)?'Sürücü':g;}
export function muhasebedeMi(sol){if(sol.sekil==='Esnaf kurye')return false;/* esnaf kurye muhasebede (liste, kontrol, PDF) görünmez; sadece Ödemeler tarafında */const g=sol.gunTaban;if(g&&g.ist===0&&!g.iS)return false;/* ay içinde hiç SGK günü yok (SGK girişi sonraki ayda): muhasebede görünmez, ödemelerde kalır */return (sol.muhBurada!=null?sol.muhBurada:sol.maasBurada!==false)&&sol.sgkYok!==true;}
// Fazla mesai saat ücreti. "Maaşına göre": net ÷ 30 ÷ 9; Eylül 2026'dan itibaren küsurat atılır (37.000 → 137), eski aylar kuruşlu kalır.
export const FM_KUSURAT_AYI='2026-09';
// Sabit ücretli şubede kişiye özel saat ücreti varsa o geçerli (aya göre, maaslar/{şube}.fmOzelGecmis).
export function fmKisiUcreti(sb,n,us){return sb.fmYontem!=='maas'&&sayi(us&&us.fmOzel)>0?sayi(us.fmOzel):fmSaatUcreti(sb,n,us&&us.ak);}
export function fmSaatUcreti(sb,n,ak){if(sb.fmYontem!=='maas')return sayi(sb.fmUcret);if(!n)return 0;const h=n/30/9;return(ak&&ak>=FM_KUSURAT_AYI)?Math.floor(h+1e-9):h;}
// Puantaj sağ tarafı (ödemeler).
// kapi: açık (onaylanmamış) ayda çizelgeden gelen fazla mesai ve saatlik çalışma saati, Veri girişinde onaylanmadan hesaba girmez.
// Onay sag[pid].otoOnay = {fm: saat, sa: saat}; çizelge değişip saat farklılaşınca onay kendiliğinden düşer. Onaylı / kesin ayda kapı yok.
// Kilitli (onaylı) ya da kesin ayda çizelgeden gelenler onaylı sayılır; açık ayda onay bekler.
export const otoKapi=(ak,kilitli,kesin)=>!kilitli&&!kesin;
const otoAyni=(a,b)=>a!=null&&Math.abs(sayi(a)-(b||0))<0.005;
export function sagHesap(pid,sol,sag,net,sb,devir,ek={},us={},kapi=false){const e=k=>ek[k]||0;if(typeof us==='boolean')us={tip:us?'paket':'maas'};const tip=us.tip||'maas';let pb=tip==='paket';const saat=tip==='saat'&&!(sol.sekil==='Esnaf kurye');const s0=sag||{};const devirAvans=devir<0?-devir:0;const araOdeme=e('AO');const s={...s0,avans:sayi(s0.avans)+e('AV')+devirAvans,paketPrimi:sayi(s0.paketPrimi)+e('PP'),ciroPrimi:sayi(s0.ciroPrimi)+e('CP'),paketSayisi:sayi(s0.paketSayisi)+e('PS')};const esnaf=sol.sekil==='Esnaf kurye';
  const bankaya=sayi(s.bankaya)+e('BY'),paketPrimi=sayi(s.paketPrimi),ciroPrimi=sayi(s.ciroPrimi),avans=sayi(s.avans);
  let hak=0,maasFarki=0,fmTl=0,paketHak=0;const on=s0.otoOnay||{},rd=s0.otoRed||{};let fmBekle=false,saBekle=false,fmRed=false,saRed=false;
  // Reddedilen (otoRed, aynı saat için) ödenmez ama beklemez; çizelge değişince yeniden karar bekler.
  // Açıkça reddedilen (aynı saat) ay kilitlense de ödenmez; karar verilmemiş olan kilitli ayda onaylı sayılır.
  const fmS=()=>{const h=sol.fmSaat||0;if(Math.abs(h)<=0.004||otoAyni(on.fm,h))return h;if(otoAyni(rd.fm,h)){fmRed=true;return 0;}if(kapi){fmBekle=true;return 0;}return h;};const saS=()=>{const h=sol.calisilanSaat||0;if(h<=0.004||otoAyni(on.sa,h))return h;if(otoAyni(rd.sa,h)){saRed=true;return 0;}if(kapi){saBekle=true;return 0;}return h;};
  if(esnaf){paketHak=sayi(s.paketSayisi)*sayi(s.paketUcret);hak=paketHak;maasFarki=paketHak-bankaya;}
  else if(saat){hak=(saS()+e('SA'))*sayi(us.saatUcret);maasFarki=hak-bankaya;fmTl=0;}
  else if(pb){hak=0;maasFarki=0;fmTl=0;/* paket başı: kazanç paket primi sütununda; fazla mesai yok */}
  else if(sol.maasBurada===false){const n=sayi(net);const fm=fmS()/* eksi mesai de işlenir */;fmTl=fm*(sb.fmYontem==='maas'&&s.fmMod==='elle'&&s.fmBirim!==undefined?sayi(s.fmBirim):fmKisiUcreti(sb,n,us));}
  else{const n=sayi(net);const hg=sol.hakGun!=null?sol.hakGun:sol.gun;const bg=sol.bayram||0;/* bayramda çalışılan her gün için +1 gün ücret */hak=n?n*(hg+bg)/30:0;maasFarki=n?hak-bankaya:0;
    const fm=fmS()/* eksi mesai de işlenir */;fmTl=fm*(sb.fmYontem==='maas'&&s.fmMod==='elle'&&s.fmBirim!==undefined?sayi(s.fmBirim):fmKisiUcreti(sb,n,us));}
  const maasYok=!esnaf&&!saat&&!pb&&sol.maasBurada===false;const bank2=maasYok?0:bankaya;
  fmTl+=e('FMT');maasFarki+=e('MF');const ekOd=e('EK')-e('KS');const pp=paketPrimi;const pbBanka=pb&&!esnaf?bankaya:0;const kalanHam=maasFarki+fmTl+pp+ciroPrimi-avans-araOdeme+ekOd-pbBanka;const kalan=Math.round(kalanHam/5)*5||0;// kuruş ödenmez: 5 TL'ye yuvarla
  return{esnaf,maasYok,pb:pb&&!esnaf,saat,saatSayi:(saBekle?0:(sol.calisilanSaat||0))+e('SA'),otoBekle:fmBekle||saBekle?{fm:fmBekle?(sol.fmSaat||0):null,sa:saBekle?(sol.calisilanSaat||0):null}:null,otoRed:fmRed||saRed?{fm:fmRed,sa:saRed}:null,cizelgeSaat:sol.calisilanSaat||0,saatUcret:sayi(us.saatUcret),bankaya:bank2,paketPrimi:pp,kalanHam,ciroPrimi,avans,araOdeme,devirAvans,hak,maasFarki,fmTl,paketHak,devir,kalan,ekOd,netYok:!esnaf&&!maasYok&&!pb&&!saat&&!sayi(net)};}

