// puantaj-hesap.js — app.js (v180) satırları 405-472. Otomatik bölündü; davranış değişmedi.
import { SGK_YOK, subeAdi } from './sabitler.js';
import { S } from './durum.js';
import { addDays, parse, sayi } from './yardimci.js';
import { aktifAyda, employed, sgkli, subeAyari } from './hesap.js';
import { sgkGunSayisi } from './hesap-ay.js';
import { gorevAyda, maasSubesi, odemeSubesi } from './gecmis.js';
import { ayniKisi, gunBirlestir, sgkGecisGrubu, sgkVar, sgkYansiKayit, subeOzeti } from './ay-ozet.js';

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

