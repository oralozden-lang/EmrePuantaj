// puantaj.js — app.js (v180) satırları 1477-1632. Otomatik bölündü; davranış değişmedi.
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { BASLANGIC_AY, DURUM, aktifAy, ayGit, onayli, ozBirlestir, veriDis, veriGunHesap, veriOzet, veriUygula } from './sabitler.js';
import { arka, db, setDoc } from './firebase.js';
import { S, subs } from './durum.js';
import { ayAdi, ayKaydir, bas, esc, fmt, isShift, sayi, tl, tl0, trTarih } from './yardimci.js';
import { isIsveren, puantajYetki } from './rol.js';
import { fmDonemYazi, fmSecici, fmSeciciBagla, odemeSubesi, subeAyari } from './hesap.js';
import { GUN_HATA_YAZI, ayniKisi, gunHaritasi, gunHataVar, muhGorev, muhasebedeMi, otoKapi, sagHesap, solHesap } from './cok-sube.js';
import { sirayla, yazmaHatasi } from './yazma.js';
import { kilitEngel } from './kilit.js';
import { selectSube } from './subeler.js';
import { byId, render, view } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { ayHaftaDurumu, tarihSaat } from './hafta-kapatma.js';
import { renderTakip, takipBagla } from './takip.js';
import { kfAktifMi, kfBagla, kfBaslik, kfDurum, kfUygula } from './kolon-filtre.js';
import { bekleyenUygula, kalanTazele, veriBosTemizle, veriGirisiBagla, veriGirisiHtml, veriListesi } from './veri-girisi.js';
import { geriGonderPanel, gunPanel, kesinAc, kesinKapat, kilidiAc, listeyeDon, odemePanel, onayla } from './puantaj-islem.js';
import { muhasebeCiktisi, odemeCiktisi, trBuyukBas } from './cikti.js';
import { bordroPanel } from './bordro.js';
import { adBuyuk } from './excel-aktar.js';

/* ================= Puantaj (bölge müdürü + işveren) ================= */
export function renderPuantaj(){if(!puantajYetki())return;S.ay=aktifAy('puantaj');
  if(S.pt.sube&&S.subeId===S.pt.sube)return renderPuantajDetay();
  const seg=`<div class="seg" id="tkSeg" style="margin:4px 0 12px"><button data-v="hafta" class="${S.tkGorunum==='hafta'?'on':''}">Haftalar</button><button data-v="ay" class="${S.tkGorunum!=='hafta'?'on':''}">Aylık puantaj</button></div>`;
  const segBagla=()=>document.querySelectorAll('#tkSeg button').forEach(b=>b.onclick=()=>{S.tkGorunum=b.dataset.v;render();});
  if(S.tkGorunum==='hafta')return view(seg+renderTakip(),()=>{segBagla();takipBagla();});
  const ak=S.ay;listeDinle(ak);
  let h=seg+`<div class="weeknav"><button class="nav-arrow" id="prevM">‹</button><div class="ttl">${ayAdi(ak)}<small>${S.subeIds.length} şube</small></div><button class="nav-arrow" id="nextM">›</button></div>`;
  if(!S.subeIds.length)h+=`<div class="empty-state"><b>Sorumlu olduğunuz şube yok</b></div>`;
  const say={};h+=`<div class="card list">${S.subeIds.map(id=>{const d=S.pt.listeAylar[id+'|'+ak]||{durum:'taslak'};say[d.durum]=(say[d.durum]||0)+1;const D=DURUM[d.durum]||DURUM.taslak;
    return `<button class="row" data-id="${esc(id)}"><div class="av">${esc(bas(S.subeler[id].ad))}</div><div class="m"><b>${esc(S.subeler[id].ad)}</b><span>${d.durum==='kesin'?'Kesin kapandı':d.durum==='bolge_onay'?'Puantaj onaylandı':d.kapatma?'Kapatıldı '+new Date(d.kapatma).toLocaleDateString('tr-TR'):'Haftalar onaylandıkça hazır olur'}</span></div><span class="chip ${D.c}">${D.ad}</span></button>`;}).join('')}</div>`;
  h+=`<p class="note">${say.sube_onay?`<b>${say.sube_onay} şube onayınızı bekliyor.</b> `:''}Şubeye dokunup puantajı açın. Muhasebe tarafı çizelgeden hesaplanır; ödemeleri orada işleyin.</p>`;
  view(h,()=>{segBagla();byId('prevM').onclick=()=>ayGit(ak,-1);byId('nextM').onclick=()=>ayGit(ak,1);
    document.querySelectorAll('.row[data-id]').forEach(b=>b.onclick=()=>puantajAc(b.dataset.id));});}
let listeAy=null;function listeDinle(ak){if(listeAy===ak+S.subeIds.join())return;listeAy=ak+S.subeIds.join();subs.liste.forEach(u=>u());subs.liste=[];
  S.subeIds.forEach(id=>subs.liste.push(onSnapshot(doc(db,'subeler',id,'aylar',ak),s=>{S.pt.listeAylar[id+'|'+ak]=s.exists()?s.data():{durum:'taslak'};if(S.tab==='puantaj'&&!S.pt.sube)render();},()=>{})));}
export function puantajAc(id){if(S.subeId!==id)selectSube(id);S.pt.sube=id;S.pt.doc=null;S.pt.ham=null;S.pt.maas=null;S.pt.prev=null;S.pt.ozetler=null;S.pt.ozetVeri=null;S.pt.ozetHata=false;subs.detay.forEach(u=>u());subs.detay=[];const ak=S.ay;
  S.pt.temiz=false;subs.detay.push(onSnapshot(doc(db,'puantaj',id,'aylar',ak),s=>{if(S.pt.sube!==id||S.ay!==ak)return;S.pt.ham=s.exists()?s.data():{};S.pt.doc={...S.pt.ham,veri:bekleyenUygula(id,ak,veriListesi(S.pt.ham))};if(!S.pt.temiz){S.pt.temiz=true;veriBosTemizle();}render();},e=>{S.pt.doc={};yazmaHatasi(e);}));
  subs.detay.push(onSnapshot(doc(db,'maaslar',id),s=>{S.pt.maas=s.exists()?s.data():{};render();},()=>{S.pt.maas={};}));
  // Diğer şubelerin ay özetleri (izin, saat): yüklenmeden puantaj gösterilmez ve onaylanmaz.
  getDocs(query(collection(db,'ozetler'),where('ay','==',ak))).then(q=>{if(S.pt.sube!==id||S.ay!==ak)return;const m={},vg={};q.docs.forEach(d=>{const x=d.data();if(x.sube){m[x.sube]=x.kisiler||{};vg[x.sube]=x.veriGun||{};}});S.pt.ozetVeri=vg;S.pt.ozetler=m;render();}).catch(e=>{console.error(e);if(S.pt.sube===id&&S.ay===ak){S.pt.ozetVeri={};S.pt.ozetler={};S.pt.ozetHata=true;render();}});
  getDoc(doc(db,'puantaj',id,'aylar',ayKaydir(ak,-1))).then(s=>{S.pt.prev=s.exists()?s.data():{};render();}).catch(()=>{S.pt.prev={};});render();}
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
function veriGunSenkron(){clearTimeout(vgT);vgT=setTimeout(()=>{const sid=S.pt.sube,ak=S.ay,D=S.pt.doc;
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
function saklananFark(V){if(!(V.kilitli||V.kesin))return[];const yeni=ptSol(V.ak,V.D||{}),eski=V.sol||{};const L=[];const kisi=(pid,r)=>S.personel.find(x=>x.id===pid)||{id:pid,ad:(r&&r.ad)||''};
  const es={};Object.keys(eski).forEach(pid=>{if(yeni[pid]){es[pid]=pid;return;}const p=kisi(pid,eski[pid]);const q=Object.keys(yeni).find(y=>!eski[y]&&!Object.values(es).includes(y)&&ayniKisi(kisi(y,yeni[y]),p));if(q)es[pid]=q;});
  Object.keys(eski).forEach(pid=>{const a=eski[pid]||{},b=yeni[es[pid]];if(!b){if(sayi(a.gun)||sayi(a.hakGun)||Math.abs(sayi(a.fmSaat))>0.004)L.push({ad:a.ad||pid,t:'güncel hesapta yok'});return;}
    const d=FARK_ALAN.filter(([k])=>Math.abs(sayi(a[k])-sayi(b[k]))>0.004).map(([k,n])=>`${n} ${fmt(sayi(a[k]))} → ${fmt(sayi(b[k]))}`);
    if((a.maasBurada!==false)!==(b.maasBurada!==false))d.push(b.maasBurada!==false?'maaşı artık bu şubede':'maaşı artık başka şubede');if(d.length)L.push({ad:a.ad||pid,t:d.join(', ')});});
  const kul=new Set(Object.values(es));Object.keys(yeni).forEach(pid=>{if(kul.has(pid))return;const b=yeni[pid];if(sayi(b.gun)||sayi(b.hakGun)||Math.abs(sayi(b.fmSaat))>0.004)L.push({ad:b.ad||pid,t:'onayda yoktu'});});
  return L;}
function renderPuantajDetay(){const vg=byId('vGrid');const ae=document.activeElement;if(S.pt.gorunum==='veri'&&vg&&vg.contains(ae)&&/INPUT|SELECT/.test(ae.tagName)&&!S.pt.zorla)return;S.pt.zorla=false;const ak=S.ay;const sb=subeAyari(S.subeId,ak);const durum=(S.aylar[ak]||{durum:'taslak'}).durum;const D=DURUM[durum]||DURUM.taslak;
  const subeSec=S.subeIds.length>1?`<div class="ptsube"><span class="ptcap">Şube</span><div class="ptsel"><select id="ptSube" aria-label="Şube seç">${S.subeIds.map(i=>`<option value="${esc(i)}" ${i===S.pt.sube?'selected':''}>${esc((S.subeler[i]||{}).ad||i)}</option>`).join('')}</select></div></div>`:`<div class="ptsube"><span class="ptcap">Şube</span><div class="ptsube1">${esc(sb.ad)}</div></div>`;
  let h=`<div class="ptbar"><button class="ptback" id="geriL" aria-label="Şube listesine dön"><span aria-hidden="true">‹</span> Şubeler</button><span class="chip mut ptdurum">${D.ad}</span></div><div class="ptnav">${subeSec}<div class="ptay"><button class="nav-arrow" id="ptPrev" aria-label="Önceki ay" ${ayKaydir(ak,-1)<BASLANGIC_AY?'disabled':''}>‹</button><div class="ttl">${ayAdi(ak)}</div><button class="nav-arrow" id="ptNext" aria-label="Sonraki ay">›</button></div></div>`;
  const ayDeg=n=>{const y=ayKaydir(ak,n);if(y<BASLANGIC_AY)return;veriBosTemizle();S.ay=y;S.ayElle=true;S.pt.vsel=null;puantajAc(S.pt.sube);};
  const navBagla=()=>{byId('geriL').onclick=listeyeDon;fmSeciciBagla(ak);const ps=byId('ptSube');if(ps)ps.onchange=e=>{const y=e.target.value;if(!y||y===S.pt.sube)return;veriBosTemizle();S.pt.vsel=null;puantajAc(y);window.scrollTo(0,0);};byId('ptPrev').onclick=()=>ayDeg(-1);byId('ptNext').onclick=()=>ayDeg(1);};
  if(S.pt.doc===null||S.pt.maas===null||S.pt.ozetler===null||S.pt.prev===null||!S.loaded.personel||!S.loaded.haftalar)return view(h+`<div class="empty-state"><b>Puantaj yükleniyor</b></div>`,navBagla);
  const V=ptVerisi();const ad=S.aylar[ak]||{};kalanTazele(V);veriGunSenkron();
  if(sb.fmDonem==='hafta')h+=`<div class="banner ok">Fazla mesai dönemi: ${fmDonemYazi(ak,sb)} (haftalık). Rapor, izin ve bordro günü takvim ayına göre.</div>${fmSecici(ak,sb)}`;
  else if(fmDonemYazi(ak,sb))h+=`<div class="banner ok">Fazla mesai dönemi: ${fmDonemYazi(ak,sb)}. Önceki günler ${ayAdi(ayKaydir(ak,-1))} haftalık döneminde ödendi. Rapor, izin ve bordro günü takvim ayına göre.</div>`;
  if(S.pt.ozetHata)h+=`<div class="banner bad">Diğer şubelerin bu ayki özetleri okunamadı; başka şubelerdeki izin ve saatler eksik görünebilir. Sayfayı yenileyin, düzelmeden onaylamayın.</div>`;
  if(gunHataVar())h+=`<div class="banner bad">${GUN_HATA_YAZI}</div>`;
  const HD=ayHaftaDurumu(ak);if(!onayli(durum)){const yz=[HD.say.onay?`${HD.say.onay} onaylı`:'',HD.say.kapali?`${HD.say.kapali} onay bekliyor`:'',HD.say.acik?`${HD.say.acik} açık`:''].filter(Boolean).join(', ');
    h+=HD.tamam?`<div class="banner ok">Bu ayın ${HD.L.length} haftası da onaylandı. Puantajı kontrol edip onaylayabilirsiniz.</div>`:`<div class="banner">Bu ayın haftaları: ${yz||'çizelge yok'}. Rakamlar çizelge değiştikçe güncellenir; bütün haftalar onaylanınca ay onaylanabilir. <button class="hgit" id="ptHaftalar">Haftalar ›</button></div>`;}
  if(durum==='geri')h+=`<div class="banner bad">Şubeye geri gönderildi${ad.not?': "'+esc(ad.not)+'"':''}.</div>`;
  if(durum==='sube_onay')h+=`<div class="banner">Şube müdürü ayı kapattı${ad.kapatanAd?' ('+esc(ad.kapatanAd)+')':''}. Kontrol edip onaylayın ya da geri gönderin.</div>`;
  {const ck=V.satir.filter(x=>x.sol.cakisma&&x.sol.cakisma.length);if(ck.length)h+=`<div class="banner bad">Şubeler arası çakışma: aynı kişi aynı saatlerde iki şubede ya da bir şubede izinliyken diğerinde çalışıyor görünüyor. Çizelgeleri düzeltin.${ck.map(x=>`<div style="font-weight:400;margin-top:4px"><b>${esc(x.sol.ad)}</b> — ${x.sol.cakisma.map(esc).join('; ')}</div>`).join('')}</div>`;}
  if(V.kesin)h+=`<div class="banner ok"><b>Kesin kapandı</b>${V.D.kesinAd?' · '+esc(V.D.kesinAd):''}${V.D.kesinTarihi?' · '+tarihSaat(V.D.kesinTarihi):''}. Bu ayın rakamları kapanış anındaki halleriyle saklanır; çizelge, ödemeler, veri girişi, maaş ve ayar değişiklikleri bu ayı etkilemez.</div>`;
  else if(durum==='bolge_onay'&&V.kilitli)h+=`<div class="banner ok">Onaylandı${V.D.onaylayanAd?' · '+esc(V.D.onaylayanAd):''}. Muhasebe tarafı kilitli, ödemeler işlenebilir.</div>`;
  if(isIsveren()&&(V.kilitli||V.kesin)&&!S.pt.ozetHata&&!gunHataVar()&&Object.values(S.gunler).every(x=>x!==null)){const F=saklananFark(V);
    if(F.length)h+=`<div class="banner bad"><b>Saklanan rakamlar güncel hesaptan farklı · ${F.length} kişi.</b> Onaydan sonra çizelge, personel bilgisi ya da program değişmiş; bu ayın saklanan rakamları değişmedi. Güncel hali için ${V.kesin?'kesin kapanışı ve ':''}kilidi açıp yeniden onaylayın.${F.slice(0,12).map(x=>`<div style="font-weight:400;margin-top:4px"><b>${esc(x.ad)}</b> — ${esc(x.t)}</div>`).join('')}${F.length>12?`<div style="font-weight:400;margin-top:4px">ve ${F.length-12} kişi daha</div>`:''}</div>`;}
  h+=`<div class="seg" style="margin:4px 0 12px" id="ptSeg"><button data-v="sol" class="${S.pt.gorunum==='sol'?'on':''}">Muhasebe</button><button data-v="sag" class="${S.pt.gorunum==='sag'?'on':''}">Ödemeler</button><button data-v="veri" class="${S.pt.gorunum==='veri'?'on':''}">Veri girişi</button></div>`;
  const cikisMi=s=>s.cikis&&s.cikis<=ayKaydir(ak,1)+'-00';
  const etiketler=x=>{const L=[];if(x.hes.esnaf)L.push('Esnaf kurye');else if(x.hes.pb)L.push('Paket başı');else if(x.hes.saat)L.push('Saatlik');else L.push(x.sol.sekil==='Part'?'Part':'Tam');if(x.hes.netYok)L.push('Net maaş yok');if(cikisMi(x.sol))L.push('Çıkış yapan');if(x.sol.maasBurada===false)L.push('Sadece FM');if(x.hes.kalan<-0.004)L.push('Kalan eksi');if(x.hes.otoBekle)L.push('Mesai onay bekliyor');if(x.sol.hakGun!=null&&x.sol.hakGun!==x.sol.gun)L.push(x.sol.sgkDisi?'SGK dışı gün':'Deneme');return L;};
  const durumK={k:'durum',ad:'Durum',vals:etiketler};const n0=v=>v||0;const tlv=v=>Math.abs(v||0)>0.004?tl(v):'';
  if(S.pt.gorunum==='sol'){
    const KS=[{k:'sgk',ad:'SGK şube',v:x=>x.sol.sgkSube,l:1},{k:'ad',ad:'Ad soyad',v:x=>x.sol.ad,ek:durumK,l:1},{k:'gorev',ad:'Görev',v:x=>muhGorev(x.sol)},{k:'sekil',ad:'Şekil',v:x=>x.sol.muhSekil||x.sol.sekil},{k:'giris',ad:'Giriş',v:x=>trTarih(x.sol.giris),n:x=>x.sol.giris||''},{k:'cikis',ad:'Çıkış',v:x=>trTarih(x.sol.cikis),n:x=>x.sol.cikis||''},
      {k:'rapor',ad:'Rapor',v:x=>x.sol.rapor||'',n:x=>n0(x.sol.rapor)},{k:'ui',ad:'Ücr. izin',v:x=>x.sol.ucretsiz||'',n:x=>n0(x.sol.ucretsiz)},{k:'pg',ad:'Part gün',v:x=>x.sol.partGun?fmt(x.sol.partGun):'',n:x=>n0(x.sol.partGun)},{k:'yi',ad:'Yıllık izin',v:x=>x.sol.yillik||'',n:x=>n0(x.sol.yillik)},{k:'b',ad:'Bayram',v:x=>x.sol.bayram||'',n:x=>n0(x.sol.bayram)},{k:'gun',ad:'Gün sayısı',v:x=>x.sol.maasBurada===false&&!x.sol.muhBurada?'—':(x.sol.bayram>0?`${x.sol.gun}+${fmt(x.sol.bayram)} bayram`:x.sol.gun),n:x=>n0(x.sol.gun)}];
    const tabanS=V.satir.filter(x=>muhasebedeMi(x.sol));const LS=kfUygula('sol',KS,tabanS);S.pt._kf={t:'sol',cols:KS,rows:tabanS};
    if(kfAktifMi('sol'))h+=`<div class="kfbar">Filtre açık · ${LS.length} / ${tabanS.length} kişi gösteriliyor <button class="mini" id="kfHepsi">Filtreleri kaldır</button></div>`;
    h+=`<div class="tbl-wrap"><table class="pt"><thead><tr>${KS.map(c=>kfBaslik('sol',c,c.l?'l':'')).join('')}</tr></thead><tbody>`;
    const gizli=V.satir.filter(({sol})=>!muhasebedeMi(sol)&&sol.sekil!=='Esnaf kurye');
    LS.forEach(({pid,sol})=>{const fo=sol.maasBurada===false&&!sol.muhBurada;h+=`<tr class="click ${cikisMi(sol)?'cikis':''}" data-mpid="${esc(pid)}"><td class="l">${esc(sol.sgkSube)}</td><td class="l"><b>${esc(sol.ad)}</b>${fo?' <span class="tag">sadece fazla mesai</span>':''}${sol.muhBurada&&sol.maasBurada===false?` <span class="tag">ödemesi ${esc(sol.odemeSube)}</span>`:''}${sol.baska&&sol.baska.length?` <span class="tag">+ ${esc(sol.baska.join(', '))}</span>`:''}${sol.bosGun?` <span class="tag warn">${sol.bosGun} boş</span>`:''}${sol.cakisma&&sol.cakisma.length?` <span class="tag warn">${sol.cakisma.length} gün çakışma</span>`:''}${sol.elle?' <span class="tag">+ veri girişi</span>':''}${sol.sekil==='Part'&&!sol.partGun?' <span class="tag warn">part gün girilmedi</span>':''}</td><td>${esc(muhGorev(sol))}</td><td>${esc(sol.muhSekil||sol.sekil)}</td><td>${trTarih(sol.giris)}</td><td>${trTarih(sol.cikis)}</td><td>${sol.rapor||''}</td><td>${sol.ucretsiz||''}</td><td>${sol.partGun?fmt(sol.partGun):''}</td><td>${sol.yillik||''}</td><td>${sol.bayram||''}</td><td>${fo?'—':(sol.bayram>0?`${sol.gun}+${fmt(sol.bayram)} bayram`:sol.gun)}</td></tr>`;});
    h+=`</tbody></table></div><div class="legend"><span><i style="background:var(--yel)"></i>Çıkış yapan</span><span>Gün sayısı = tam ay 30; rapor/ücretsiz izin varsa ayın takvim günü − rapor − ücretsiz izin, en çok 30 (ay ortasında giriş/çıkışta çalışılan takvim günü); part çalışanlarda gün sayısı = part gün</span></div>
    ${gizli.length?`<p class="note"><b>Muhasebede gösterilmeyen ${gizli.length} kişi</b> (SGK'sı başka şubede, SGK'sı yok ya da bu ay SGK girişi yok): ${gizli.map(x=>esc(x.sol.ad)).join(', ')}. Bu kişiler sadece Ödemeler tarafında.</p>`:''}
    <p class="note yardim">Maaş, rapor ve izinler kişinin SGK şubesinde. Fazla mesai muhasebeye gitmez; Ödemeler tarafında, çalıştığı her şubede ayrı hesaplanır. Diğer şubelerdeki izin günleri o şubeler ayı kapattıkça eklenir. "+ şube adı" etiketi o şubeden gelen günlerin eklendiğini gösterir.</p>`;
    h+=`<div class="actions" style="margin-top:12px"><button class="btn grow" id="pdfB">Muhasebe çıktısı · PDF / fotoğraf / WhatsApp</button></div>`;}
  else if(S.pt.gorunum==='veri')h+=veriGirisiHtml(V);
  else{
    const T=V.satir.reduce((t,x)=>{t.hak+=x.hes.hak+x.hes.fmTl+x.hes.paketPrimi+x.hes.ciroPrimi;t.bankaya+=x.hes.bankaya;t.avans+=x.hes.avans+x.hes.araOdeme;t.nakit+=Math.max(x.hes.kalan,0);return t;},{hak:0,bankaya:0,avans:0,nakit:0});
    h+=`<div class="kpis"><div class="kpi"><span>Toplam hak ediş</span><b>${tl0(T.hak)}</b></div><div class="kpi"><span>Bankaya yatan</span><b>${tl0(T.bankaya)}</b></div><div class="kpi"><span>Avans + ara ödeme</span><b>${tl0(T.avans)}</b></div><div class="kpi"><span>İhtiyaç duyulan nakit</span><b>${tl0(T.nakit)}</b></div></div>`;
    const netOf=x=>x.hes.esnaf||x.hes.maasYok||x.hes.pb?0:sayi(x.net);
    const KO=[{k:'ad',ad:'Ad soyad',v:x=>x.sol.ad,ek:durumK,l:1},{k:'gorev',ad:'Görev',v:x=>muhGorev(x.sol)},{k:'gun',ad:'Gün',v:x=>x.hes.saat?fmt(x.hes.saatSayi)+' sa':x.hes.esnaf||x.hes.maasYok?'—':(x.sol.hakGun!=null?x.sol.hakGun:x.sol.gun),n:x=>n0(x.sol.hakGun!=null?x.sol.hakGun:x.sol.gun)},
{k:'hak',ad:'Hak edilen',v:x=>x.hes.pb?'':tlv(x.hes.hak),n:x=>n0(x.hes.hak)},{k:'bankaya',ad:'Bankaya yatan',v:x=>tlv(x.hes.bankaya),n:x=>n0(x.hes.bankaya)},{k:'ara',ad:'Ara ödeme',v:x=>tlv(x.hes.araOdeme),n:x=>n0(x.hes.araOdeme)},
      {k:'mf',ad:'Maaş farkı',v:x=>tlv((x.hes.pb?-x.hes.bankaya:x.hes.maasFarki)+n0(x.hes.ekOd)),n:x=>n0((x.hes.pb?-x.hes.bankaya:x.hes.maasFarki)+n0(x.hes.ekOd))},{k:'fm',ad:'Fazla mesai',v:x=>tlv(x.hes.fmTl),n:x=>n0(x.hes.fmTl)},{k:'pp',ad:'Paket primi',v:x=>tlv(x.hes.paketPrimi),n:x=>n0(x.hes.paketPrimi)},{k:'cp',ad:'Ciro primi',v:x=>tlv(x.hes.ciroPrimi),n:x=>n0(x.hes.ciroPrimi)},
      {k:'avans',ad:'Avans',v:x=>tlv(x.hes.avans),n:x=>n0(x.hes.avans)},{k:'kalan',ad:'Kalan ödeme',v:x=>tl(x.hes.kalan),n:x=>n0(x.hes.kalan)}];
    S.pt._kf={t:'sag',cols:KO,rows:V.satir};
    if(kfAktifMi('sag'))h+=`<div class="kfbar">Filtre açık · toplamlar sadece görünen kişiler için <button class="mini" id="kfHepsi">Filtreleri kaldır</button></div>`;
    h+=`<div class="tbl-wrap"><table class="pt"><thead><tr>${KO.map(c=>kfBaslik('sag',c,c.l?'l':'')).join('')}</tr></thead><tbody>`;
    const tbBas=h.length;
    const VS=kfUygula('sag',KO,V.satir);VS.forEach(({pid,sol,net,hes})=>{const cls=hes.kalan<-0.004?'eksi':cikisMi(sol)?'cikis':'';
      h+=`<tr class="click ${cls}" data-pid="${esc(pid)}"><td class="l"><b>${esc(sol.ad)}</b><br><span class="tag">${esc(sol.sekil)}</span>${hes.netYok?' <span class="tag warn">net maaş yok</span>':''}${!hes.esnaf&&V.sb.fmYontem!=='maas'&&sayi(fmOzelMap(V.ak)[pid])>0?' <span class="tag">özel FM ücreti</span>':''}${sol.cakisma&&sol.cakisma.length?` <span class="tag warn">${sol.cakisma.length} gün çakışma</span>`:''}${hes.pb?' <span class="tag">paket başı</span>':''}${hes.saat?` <span class="tag">saatlik ${tl(hes.saatUcret)}</span>`:''}${hes.otoBekle?' <span class="tag warn">mesai onay bekliyor</span>':''}${hes.otoRed?' <span class="tag">mesai reddedildi</span>':''}${hes.maasYok?` <span class="tag">${sol.muhBurada&&sol.odemeSube?'maaşı '+esc(sol.odemeSube)+' şubesinde':'sadece fazla mesai'}</span>`:''}</td><td>${esc(muhGorev(sol))}</td><td>${hes.saat?`${fmt(hes.saatSayi)} sa`:hes.esnaf||hes.maasYok?'—':(sol.hakGun!=null&&sol.hakGun!==sol.gun?(sol.sekil==='Part'||sol.partGun>0?`${sol.hakGun}<br><span class="tag" title="Muhasebeye part gün gider; maaş normal gün üzerinden">part ${fmt(sol.gun)}</span>`:(sol.sgkYok?`${sol.hakGun}<br><span class="tag" title="SGK şubesi Boş: SGK'sız çalışıyor">SGK yok</span>`:`${sol.hakGun}<br><span class="tag warn" title="Deneme günleri: SGK ${sol.gun} gün">SGK ${sol.gun}</span>`)):sol.gun)}${!hes.saat&&!hes.esnaf&&!hes.maasYok&&!hes.pb&&sol.bayram>0?`<br><span class="tag" title="Bayramda çalışılan gün: hak edilen tutara +1 gün ücret eklendi">+${fmt(sol.bayram)} bayram</span>`:''}</td><td>${hes.pb?'—':tlv(hes.hak)}</td><td>${tlv(hes.bankaya)}</td><td>${hes.araOdeme?tl(hes.araOdeme):''}</td><td>${tlv((hes.pb?-hes.bankaya:hes.maasFarki)+(hes.ekOd||0))}</td><td>${hes.fmTl?tl(hes.fmTl):''}</td><td>${hes.paketPrimi?tl(hes.paketPrimi):''}</td><td>${hes.ciroPrimi?tl(hes.ciroPrimi):''}</td><td>${hes.avans?tl(hes.avans):''}${hes.devirAvans?`<br><span class="tag" title="Geçen aydan eksi kalan">devir ${tl(hes.devirAvans)}</span>`:''}</td><td class="${hes.kalan<0?'neg':'pos'}">${tl(hes.kalan)}</td></tr>`;});
    const top=k=>VS.reduce((t,x)=>t+(x.hes[k]||0),0);const tt=v=>Math.abs(v)>0.004?tl(v):'';const kalT=top('kalan');const netT=VS.reduce((t,x)=>t+(x.hes.esnaf||x.hes.maasYok||x.hes.pb?0:sayi(x.net)),0);
    const totRow=`<tr class="tot"><td class="l">${kfAktifMi('sag')?`Filtreli toplam · ${VS.length} / ${V.satir.length} kişi`:`Toplam · ${VS.length} kişi`}</td><td></td><td></td><td>${tt(top('hak'))}</td><td>${tt(top('bankaya'))}</td><td>${tt(top('araOdeme'))}</td><td>${tt(top('maasFarki'))}</td><td>${tt(top('fmTl'))}</td><td>${tt(top('paketPrimi'))}</td><td>${tt(top('ciroPrimi'))}</td><td>${tt(top('avans'))}</td><td class="${kalT<0?'neg':'pos'}">${tl(kalT)}</td></tr>`;
    h=h.slice(0,tbBas)+totRow.replace('class="tot"','class="tot ust"')+h.slice(tbBas);
    h+=`</tbody></table></div>
     <div class="legend"><span><i style="background:var(--yel)"></i>Çıkış yapan</span><span><i style="background:var(--red)"></i>Kalan eksi: sonraki aya devreder</span><span>Satıra dokunup ödemeleri girin</span></div>
     <div class="actions" style="margin-top:12px"><button class="btn grow" id="odPayB">Ödeme listesi · fotoğraf / PDF / WhatsApp</button></div>`;}
  const bolgeIs=!onayli(durum)&&(durum==='sube_onay'||HD.tamam||isIsveren());
  // Bölge müdürü onay öncesi kontrol: rapor, yıllık izin, SGK giriş/çıkış muhasebe grubundan teyit edilir
  const bk=(V.D&&V.D.bkontrol)||{};const BK=[];V.satir.filter(x=>muhasebedeMi(x.sol)).forEach(({pid,sol})=>{const ic=t=>t&&t.slice(0,7)===ak;
    // Her satır: tam ad, ne olduğu (etiket) ve değer; aynı kişinin birden çok SGK kaydı varsa hangi kayıt olduğu (SGK şubesi) görünsün.
    const e=(k,tur,deg)=>BK.push({k:k+pid,ad:adBuyuk(sol.ad),tur,deg,sgk:sol.sgkSube||'',gorev:muhGorev(sol)});
    if(sol.rapor)e('r_','Rapor',`${sol.rapor} gün`);if(sol.yillik)e('y_','Yıllık izin',`${sol.yillik} gün`);if(sol.ucretsiz)e('u_','Ücretsiz izin',`${sol.ucretsiz} gün`);if(sol.bayram)e('b_','Bayram',`${fmt(sol.bayram)} gün`);
    if(ic(sol.giris))e('g_','SGK giriş',trTarih(sol.giris));if(ic(sol.cikis))e('c_','SGK çıkış',trTarih(sol.cikis));});
  BK.sort((a,b)=>a.ad.localeCompare(b.ad,'tr')||a.tur.localeCompare(b.tur,'tr'));
  const bkEksik=BK.filter(x=>!bk[x.k]).length;
  if(bolgeIs&&BK.length)h+=`<div class="sec">Onay öncesi kontrol · muhasebe grubundan teyit edin</div><div class="card kcard"><div class="kt ${bkEksik?'sari':'yesil'}"><div class="kth"><b>Rapor, izinler, bayram, SGK giriş ve çıkışlar · ${BK.length}</b><span>Her birini muhasebe WhatsApp grubundaki bilgiyle karşılaştırıp işaretleyin. Hepsi işaretlenmeden onaylanamaz.</span></div>
    <div class="bkl">${BK.map(x=>`<label class="${bk[x.k]?'on':''}"><input type="checkbox" data-bk="${esc(x.k)}" ${bk[x.k]?'checked':''}><span><b class="ad">${esc(x.ad)}</b><span class="nt"><em>${esc(x.tur)}</em> · ${esc(x.deg)}</span><span class="alt">${x.gorev?esc(x.gorev)+' · ':''}SGK: ${esc(x.sgk||'—')}</span></span></label>`).join('')}</div></div></div>`;
  const pOnc=ayKaydir(ak,-1);const pOnceki=(pOnc>=BASLANGIC_AY&&!onayli((S.aylar[pOnc]||{}).durum))||bkEksik>0;if(bolgeIs&&pOnceki)h+=`<p class="note" style="color:var(--bad);font-weight:600">${pOnc>=BASLANGIC_AY&&!onayli((S.aylar[pOnc]||{}).durum)?`${ayAdi(pOnc)} puantajı onaylanmadan bu ay onaylanamaz.`:`Onay öncesi kontrolde ${bkEksik} madde işaretlenmedi.`}</p>`;
  if(!bolgeIs&&!onayli(durum))h+=`<p class="note">Bütün haftalar onaylanınca "Onayla ve kilitle" açılır. Bir haftada düzeltme gerekiyorsa Haftalar ekranından o haftayı şubeye geri gönderin.</p>`;
  h+=`<div class="row2">${bolgeIs?`${pOnceki?`<button class="btn primary grow" disabled title="Önce önceki ay onaylanmalı">Onayla ve kilitle</button>`:'<button class="btn primary grow" id="onayB">Onayla ve kilitle</button>'}`:''}${isIsveren()&&durum==='bolge_onay'?'<button class="btn grow" id="acB">Kilidi aç</button>':''}</div>`;
  // İşveren: ödemeler bitince ayı kesin kapatır. Önceki ay kesin kapanmadan olmaz (devir ondan gelir).
  if(isIsveren()&&durum==='bolge_onay'&&V.kilitli){const pk=pOnc<BASLANGIC_AY||(S.aylar[pOnc]||{}).durum==='kesin';
    h+=`<div class="card" style="padding:12px;margin-top:10px"><b>Kesin kapanış</b><p class="note" style="margin:4px 0 8px">Ödemeler ve veri girişi bitince ayı kesin kapatın. Kesin kapanan ayın rakamları o anki halleriyle saklanır; sonradan çizelge, ayar, maaş ya da program değişse de bu ay değişmez ve kimse düzenleyemez.</p>${!HD.tamam?'<p class="note" style="color:var(--bad);font-weight:600;margin:0">Ayın bütün haftaları (sonraki aya taşan hafta dahil) onaylanmadan kesin kapatılamaz.</p>':pk?'<button class="btn primary" id="kesinB" style="width:100%">Ayı kesin kapat</button>':`<p class="note" style="color:var(--bad);font-weight:600;margin:0">${ayAdi(pOnc)} kesin kapanmadan bu ay kesin kapatılamaz.</p>`}</div>`;}
  if(isIsveren()&&durum==='kesin'){const sonraki=(S.aylar[ayKaydir(ak,1)]||{}).durum==='kesin';
    h+=`<div class="row2" style="margin-top:10px">${sonraki?`<p class="note">${ayAdi(ayKaydir(ak,1))} kesin kapalı olduğu için bu ay açılamaz.</p>`:'<button class="btn grow" id="kesinAcB">Kesin kapanışı aç</button>'}</div>`;}
  view(h,()=>{navBagla();document.querySelectorAll('#ptSeg button').forEach(b=>b.onclick=()=>{if(S.pt.gorunum==='veri'&&b.dataset.v!=='veri')veriBosTemizle();S.pt.gorunum=b.dataset.v;S.pt.vsel=null;render();});
    const pb=byId('pdfB');if(pb)pb.onclick=()=>muhasebeCiktisi(V);const opb=byId('odPayB');if(opb)opb.onclick=()=>odemeCiktisi(V);const bb=byId('bordroB');if(bb)bb.onclick=()=>bordroPanel(V);
    if(S.pt._kf&&S.pt.gorunum!=='veri'){kfBagla(S.pt._kf.t,S.pt._kf.cols,S.pt._kf.rows);const kh=byId('kfHepsi');if(kh)kh.onclick=()=>{kfDurum(S.pt._kf.t).f={};render();};}
    if(S.pt.gorunum==='veri'){if(!V.kesin)veriGirisiBagla(V);}else if(!V.kesin){document.querySelectorAll('tr[data-pid]').forEach(r=>r.onclick=()=>odemePanel(r.dataset.pid));document.querySelectorAll('tr[data-mpid]').forEach(r=>r.onclick=()=>gunPanel(r.dataset.mpid));}
    document.querySelectorAll('[data-bk]').forEach(c=>c.onchange=()=>{if(kilitEngel()||kesinEngel()){c.checked=!c.checked;return;}const k=c.dataset.bk;const sid=S.subeId;S.pt.doc={...(S.pt.doc||{}),bkontrol:{...((S.pt.doc||{}).bkontrol||{}),[k]:c.checked}};
      sirayla('pt'+sid+ak,()=>{arka(setDoc(doc(db,'puantaj',sid,'aylar',ak),{sube:sid,ay:ak,bkontrol:{[k]:c.checked}},{merge:true}));});render();});
    const ob=byId('onayB');if(ob)ob.onclick=()=>{const T2=V.satir.reduce((t,x)=>t+Math.max(x.hes.kalan,0),0);openSheet(`<h2>Puantajı onayla</h2><div class="sub">${esc(trBuyukBas(sb.ad))} şubesi · ${ayAdi(ak)}</div>
      <div class="confirm">Onaylayınca muhasebe tarafı kilitlenir ve puantajın son hali işverene iletilir. Raporlar, yıllık izinler ve SGK giriş-çıkışları muhasebe grubundan kontrol ettiğinizden emin olun.</div>
      <p class="note">${V.satir.length} kişi · ihtiyaç duyulan nakit ${tl0(T2)}</p><div class="row2"><button class="btn grow" id="oVz">Vazgeç</button><button class="btn primary grow" id="oEv">Evet, onayla ve gönder</button></div>`,()=>{byId('oVz').onclick=closeSheet;byId('oEv').onclick=()=>{closeSheet();onayla();};});};
    const gb=byId('geriB');if(gb)gb.onclick=geriGonderPanel;const phb=byId('ptHaftalar');if(phb)phb.onclick=()=>{S.tkGorunum='hafta';listeyeDon();};const ab=byId('acB');if(ab)ab.onclick=()=>{if(!ab.dataset.ok){ab.dataset.ok='1';ab.textContent='Kilidi açmayı onayla';return;}kilidiAc();};
    const kb=byId('kesinB');if(kb)kb.onclick=()=>openSheet(`<h2>Ayı kesin kapat</h2><div class="sub">${esc(trBuyukBas(sb.ad))} şubesi · ${ayAdi(ak)}</div><div class="confirm">Muhasebe ve ödemelerin bütün rakamları şu anki halleriyle saklanır. Bu aydan sonra çizelge, veri girişi, ödeme, maaş, şube ayarı ya da program değişse de bu ayın rakamları değişmez. Bu ayın haftaları da kimse tarafından düzenlenemez.</div><div class="row2"><button class="btn grow" id="kVz">Vazgeç</button><button class="btn primary grow" id="kEv">Evet, kesin kapat</button></div>`,()=>{byId('kVz').onclick=closeSheet;byId('kEv').onclick=()=>{closeSheet();kesinKapat();};});
    const ka=byId('kesinAcB');if(ka)ka.onclick=()=>{if(!ka.dataset.ok){ka.dataset.ok='1';ka.textContent='Emin misiniz? Saklanan rakamlar yeniden hesaplanabilir hale gelir';return;}kesinAc();};});}
