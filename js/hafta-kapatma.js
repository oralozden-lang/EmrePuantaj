// hafta-kapatma.js — app.js (v180) satırları 899-1045. Otomatik bölündü; davranış değişmedi.
import { arrayUnion, deleteField, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AY, AYK, BASLANGIC_AY, GUN, GUNU, KOD, kesinAy } from './sabitler.js';
import { arka, db, setDoc, writeBatch } from './firebase.js';
import { S } from './durum.js';
import { addDays, ayKaydir, ayKey, esc, fmt, kisaAd, mondayOf, parse, rangeLabel, sg, today, trTarih, weekDays, ymd } from './yardimci.js';
import { isIsveren, isSube, puantajYetki } from './rol.js';
import { aktifHaftada, cellOf, employed, fmHaftalari, haftaAyParca, haftaHesap, haftaYedi, ilkGun, isEsnaf, sube, subeAyari, weekHasEntry } from './hesap.js';
import { CZ_ES, ayKadrosu, ayniKisi, bosSayilir, cizelgeKisileri, cokSubeli, digerGunler, gunKaydiP, gunYaz, gunleriYukle, haftaHesapS, kadroDoc, kadroOf, subeOzeti } from './cok-sube.js';
import { gerekliSube, sirayla, weekRef, yazmaHatasi } from './yazma.js';
import { haftaAyari, haftaDurumu, hazirDegil, hdAlani, sunucuHazir } from './hucre-yazma.js';
import { byId, render } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { UI, cizelgeYazabilir } from './cizelge.js';
import { subePersoneli } from './personel.js';

/* ================= Haftalık kapatma =================
   Hafta bitince şube müdürü 2 gün içinde kontrol edip kapatır → bölge müdürünün onayına gider. Kapatılan haftayı şube müdürü göremez.
   Bölge müdürü (kendi şubeleri) ve işveren: kapatır, onaylar, notla geri gönderir, kilidi açar. Her işlem haftanın kaydına yazılır. */
export const KAPATMA_GUN=2;
const durumRef=sid=>doc(db,'subeler',gerekliSube(sid),'durum','haftalar');
export const benAd=()=>(S.me&&(S.me.adSoyad||S.me.kullaniciAdi))||'';
export function haftaPazar(wid){return addDays(parse(wid),6);}
// Hafta pazar gününden itibaren kapatılabilir (pazar günü diğer haftanın eksikleri düzeltilir); son gün KAPATMA_GUN ile aynı kalır.
export function haftaBitti(wid){return ymd(today())>=ymd(haftaPazar(wid));}
function haftaPazarBugun(wid){return ymd(today())===ymd(haftaPazar(wid));}
function haftaSonGun(wid){return addDays(haftaPazar(wid),KAPATMA_GUN);}
export function haftaGecikti(wid){return ymd(today())>ymd(haftaSonGun(wid));}
export function haftaAylari(wid){return[...new Set(weekDays(wid).map(ayKey))];}
const gunAdi=d=>`${d.getDate()} ${AY[d.getMonth()]} ${GUNU[(d.getDay()+6)%7]}`;
export const tarihSaat=t=>{if(!t)return'';const d=new Date(t);return `${d.getDate()} ${AYK[d.getMonth()]} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
function haftaDolu(wid,H=S.haftalar){const k=(H[wid]&&kadroDoc(wid,H))||[];return k.length>0;}
// Şube müdürüne: kapatılmamış ve süresi dolmak üzere / dolmuş haftalar
function acikBitenHaftalar(){const L=[];let w=parse(mondayOf(today()));for(let i=1;i<=8;i++){const wid=ymd(addDays(w,-7*i));if(wid<BASLANGIC_AY+'-01')break;
    if(haftaDolu(wid)&&haftaDurumu(wid)==='acik'&&haftaBitti(wid))L.push(wid);}return L.reverse();}
export function haftaBandi(wid){const hd=haftaDurumu(wid);const w=S.haftalar[wid]||{};const dw=(S.haftaDurum.w||{})[wid]||{};let h='';
  if(isSube()){const L=acikBitenHaftalar().filter(x=>x!==wid);if(L.length)h+=`<div class="banner ${L.some(haftaGecikti)?'bad':''}">Kapatılmamış ${L.length>1?L.length+' hafta':'hafta'}: ${L.map(x=>`<button class="hgit" data-gitw="${x}">${rangeLabel(x)}${haftaGecikti(x)?' · gecikti':''}</button>`).join(' ')}</div>`;}
  if(hd==='acik'){if(w.geriNot)h+=`<div class="banner bad">Bölge müdürü bu haftayı geri gönderdi: "${esc(w.geriNot)}". Düzeltip yeniden kapatın.</div>`;
    if(haftaBitti(wid)&&haftaDolu(wid)){const son=haftaSonGun(wid);h+=haftaGecikti(wid)?`<div class="banner bad">Bu hafta ${gunAdi(son)} gününe kadar kapatılmalıydı, gecikti.</div>`:haftaPazarBugun(wid)?`<div class="banner">Bugün haftanın son günü. Pazar vardiyasının çıkış saatleri henüz bitmemiş olabilir; kapatmadan önce pazar saatlerini kontrol edin. Kapattıktan sonra düzeltme için bölge müdürünün kilidi açması gerekir. En geç ${gunAdi(son)} günü kapatın.</div>`:`<div class="banner">Hafta bitti. Kontrol edip en geç ${gunAdi(son)} günü kapatın.</div>`;}}
  else if(!isSube()){const ad=w.kapatanAd||dw.ad||'';const t=w.kapatma||dw.t;
    h+=hd==='kapali'?`<div class="banner">Hafta kapatıldı${ad?' · '+esc(ad):''}${t?' · '+tarihSaat(t):''}. Onayınızı bekliyor. Düzenlemek için önce "Kilidi aç"a basın.</div>`:`<div class="banner ok">Hafta onaylandı${w.onaylayanAd?' · '+esc(w.onaylayanAd):''}${w.onayTarihi?' · '+tarihSaat(w.onayTarihi):''}. Düzenlemek için önce "Kilidi aç"a basın.</div>`;}
  return h;}
export function kapaliHaftaKart(wid){const dw=(S.haftaDurum.w||{})[wid]||{};
  return `<div class="empty-state kapali-kart"><b>Bu hafta kapatıldı</b>${dw.ad?esc(dw.ad)+' · ':''}${dw.t?tarihSaat(dw.t):''}<br>${dw.d==='onay'?'Bölge müdürü onayladı.':'Bölge müdürünün onayında.'} Kapatılan haftalar görüntülenemez.<br>Düzeltme gerekiyorsa bölge müdürünüzden haftanın kilidini açmasını isteyin.</div>`;}
export function haftaIslemleri(wid){const hd=haftaDurumu(wid);let b='';if(weekDays(wid).some(kesinAy))return'';
  if(hd==='acik'&&haftaBitti(wid)&&haftaDolu(wid)){b+=`<button class="btn primary grow" id="hKap">${isSube()?'Haftayı kapat → bölge müdürüne gönder':'Haftayı kapat'}</button>`;if(puantajYetki())b+=`<button class="btn grow" id="hKapOn">Kapat ve onayla</button>`;}
  if(puantajYetki()){if(hd==='kapali')b+=`<button class="btn primary grow" id="hOn">Onayla</button><button class="btn danger grow" id="hGeri">Geri gönder</button>`;
    if(hd!=='acik')b+=`<button class="btn grow" id="hKilit">Kilidi aç</button>`;const kay=(S.haftalar[wid]||{}).kayit;if(kay&&kay.length)b+=`<button class="btn" id="hKay">Kayıt</button>`;}
  if(isIsveren()&&hd==='acik')b+=`<button class="btn" id="hListe">Listeyi hücrelerden geri kur</button>`;
  return b?`<div class="actions hafta-is">${b}</div>`:'';}
export function haftaIslemBagla(wid){const on=(id,f)=>{const e=byId(id);if(e)e.onclick=f;};
  document.querySelectorAll('[data-gitw]').forEach(x=>x.onclick=()=>{S.hafta=x.dataset.gitw;UI.SEL=null;render();window.scrollTo(0,0);});
  on('hKap',()=>haftaKapatPanel(wid,false));on('hKapOn',()=>haftaKapatPanel(wid,true));on('hOn',()=>haftaOnayPanel(wid));on('hGeri',()=>haftaGeriPanel(wid));
  on('hKilit',()=>{const e=byId('hKilit');if(!e.dataset.ok){e.dataset.ok='1';e.textContent='Kilidi açmayı onayla';return;}haftaKilidiAc(wid);});on('hKay',()=>haftaKayitPanel(wid));
  on('hListe',async()=>{const e=byId('hListe');if(!e.dataset.ok){e.dataset.ok='1';e.textContent='Emin misin? Tekrar dokun';return;}const sid=S.subeId;e.disabled=true;
    try{const s0=await getDoc(weekRef(wid,sid));const c=(s0.exists()&&s0.data().cells)||{};const eski=Array.isArray(s0.exists()&&s0.data().kadro)?s0.data().kadro:[];
      const ids=Object.keys(c).filter(pid=>Object.values(c[pid]||{}).some(v=>v));const sirali=[...eski.filter(x=>ids.includes(x)),...ids.filter(x=>!eski.includes(x))];
      if(!sirali.length){toast('Hücre bulunamadı, liste değişmedi.');e.disabled=false;return;}
      await setDoc(weekRef(wid,sid),{kadro:sirali},{merge:true});toast(`Liste geri kuruldu: ${sirali.length} kişi.`);}catch(x){console.error(x);toast('Geri kurulamadı.');}render();});}
function haftaKayitPanel(wid,H=S.haftalar){const kay=((H[wid]||{}).kayit||[]).slice().sort((a,b)=>String(b.t).localeCompare(String(a.t)));
  openSheet(`<h2>Hafta kaydı</h2><div class="sub">${esc(sube().ad)} · ${rangeLabel(wid)}</div><div class="card list">${kay.map(k=>`<div class="row"><div class="m"><b>${esc(k.i)}</b><span>${esc(k.ad||'')} · ${tarihSaat(k.t)}${k.not?' · "'+esc(k.not)+'"':''}</span></div></div>`).join('')||'<div class="note" style="padding:12px">Kayıt yok.</div>'}</div><div class="row2"><button class="btn grow" id="kyK">Kapat</button></div>`,()=>byId('kyK').onclick=closeSheet);}
// Haftanın kontrolü: boş günler ve 7 gün teyidi kapatmayı engeller; eksi fazla mesai ve izinler bilgi için.
export function haftaKontrol(wid){const sb=haftaAyari(wid);const ds=weekDays(wid);const t7=(S.haftalar[wid]||{}).teyit7||{};const K={bos:[],yedi:[],eksi:[],izin:[],izinG:[],gc:[],yok:[]};
  cizelgeKisileri(wid).forEach(p=>{const L=CZ_ES[p.id]||[p];
    ds.forEach((d,i)=>{const q=gunKaydiP(p,d);if(!q)return;const v=cellOf(q.id,wid,i);if((v==null||v==='')&&(weekHasEntry(q.id,wid)||!isEsnaf(q))&&bosSayilir(q,d)&&cizelgeYazabilir(d))K.bos.push({p,d});// satırı tamamen boş kişi de (esnaf hariç) boş gün sayılır
      if(v&&['R','UI','YI'].includes(v))K.izin.push({p,d,v});});
    L.forEach(q=>{const y=weekHasEntry(q.id,wid)?haftaYedi(q,wid):{yedi:false};if(y.yedi&&y.sube===S.subeId)K.yedi.push({p:q,ok:!!t7[q.id]});});
    if(!isEsnaf(p)&&p.sekil!=='Part'){const x=haftaHesapS(p,wid,sb);if(x.fm<-0.004)K.eksi.push({p,fm:x.fm});}
    // Giriş / çıkış: SGK tarihi bu haftaya düşenler ve çizelgede ilk / son çalıştığı gün
    const w0=ymd(ds[0]),w6=ymd(ds[6]);
    L.forEach(q=>{const calGun=i=>{const v=cellOf(q.id,wid,i);return v&&!KOD[v];};
      const gi=q.giris&&q.giris>=w0&&q.giris<=w6?q.giris:(ilkGun(q)&&ilkGun(q)>=w0&&ilkGun(q)<=w6?ilkGun(q):null);
      if(gi){const i=ds.findIndex((d,j)=>calGun(j));K.gc.push({p:q,key:'giris|'+q.id,tur:'Giriş',t:gi,sgk:q.giris&&q.giris!==gi?q.giris:'',cz:i>=0?ds[i]:null});}
      if(q.cikis&&q.cikis>=w0&&q.cikis<=w6){let i=-1;ds.forEach((d,j)=>{if(calGun(j))i=j;});K.gc.push({p:q,key:'cikis|'+q.id,tur:'Çıkış',t:q.cikis,sgk:'',cz:i>=0?ds[i]:null});}});});
  // Bu şubede çalışan, haftada aktif ama haftanın listesinde olmayan kişiler (unutulduysa maaşı kesintisiz çıkar): teyit edilir.
  {const ids=kadroOf(wid).ids;const L0=ids.map(id=>S.personel.find(x=>x.id===id)).filter(Boolean);
    subePersoneli().filter(p=>p.anaSube===S.subeId&&!isEsnaf(p)&&p.paketBasi!==true&&aktifHaftada(p,wid)&&!ids.includes(p.id)&&!L0.some(x=>ayniKisi(x,p))&&!(cokSubeli(p)&&weekDays(wid).some(d=>digerGunler(p,d)))).forEach(p=>K.yok.push({p,key:'yok|'+p.id}));}
  // Rapor / ücretsiz izin / yıllık izin: kişi ve izin türü başına tek madde
  const g={};K.izin.forEach(x=>{const k='izin|'+x.p.id+'|'+x.v;(g[k]=g[k]||{key:k,p:x.p,v:x.v,gun:[]}).gun.push(x.d);});K.izinG=Object.values(g);
  return K;}
export async function haftaKapatPanel(wid,onayDa){await gunleriYukle(cizelgeKisileri(wid),haftaAylari(wid));const K=haftaKontrol(wid);const sb=haftaAyari(wid);
  const ad=p=>esc(kisaAd(p.ad));const tK=(S.haftalar[wid]||{}).teyitK||{};const tkEksik=(isSube()?[...K.izinG,...K.yok]:K.gc).filter(x=>!tK[x.key]).length;
  const engel=K.bos.length?`${K.bos.length} boş gün doldurulmadan`:K.yedi.some(x=>!x.ok)?'7 gün çalışılan kişiler teyit edilmeden':tkEksik?`Kontrol listesinde ${tkEksik} madde teyit edilmeden`:'';
  const kis=cizelgeKisileri(wid);const topFm=kis.reduce((t,p)=>t+(isEsnaf(p)||p.sekil==='Part'?0:haftaHesapS(p,wid,sb).fm),0);
  let h=`<h2>${onayDa?'Haftayı kapat ve onayla':'Haftayı kapat'}</h2><div class="sub">${esc(sb.ad)} · ${rangeLabel(wid)}</div>`;
  if(K.bos.length)h+=`<div class="kt kirmizi"><div class="kth"><b>Boş günler · ${K.bos.length}</b><span>Doldurulmadan hafta kapatılamaz.</span></div><div class="kti">${K.bos.map(x=>`<span class="kchip">${ad(x.p)} · ${x.d.getDate()} ${AYK[x.d.getMonth()]} ${GUN[(x.d.getDay()+6)%7]}</span>`).join('')}</div></div>`;
  if(K.yedi.length)h+=`<div class="kt ${K.yedi.every(x=>x.ok)?'yesil':'sari'}"><div class="kth"><b>İzin kullanmadan 7 gün çalışanlar · ${K.yedi.length}</b><span>Doğruysa işaretleyin; izin gününün mesaisi bu haftaya ${fmt(7*sb.gunluk-sb.haftalik)} saat fazla mesai olarak yazılır.</span></div><div class="kti">${K.yedi.map(x=>`<label class="kchip ${x.ok?'on':''}"><input type="checkbox" data-t7="${esc(x.p.id)}" ${x.ok?'checked':''}> ${ad(x.p)}</label>`).join('')}</div></div>`;
  if(K.eksi.length)h+=`<div class="kt sari"><div class="kth"><b>Eksi fazla mesai · ${K.eksi.length}</b><span>Eksik çalışma mı, yanlış saat mi bir bakın.</span></div><div class="kti">${K.eksi.map(x=>`<span class="kchip">${ad(x.p)} · ${sg(x.fm)} sa</span>`).join('')}</div></div>`;
  const zor=isSube();const gunY=d=>`${d.getDate()} ${AYK[d.getMonth()]}`;
  const tkChip=(x,t,z=zor)=>z?`<label class="kchip ${tK[x.key]?'on':''}"><input type="checkbox" data-tk="${esc(x.key)}" ${tK[x.key]?'checked':''}> ${t}</label>`:`<span class="kchip">${t}</span>`;
  if(K.izinG.length)h+=`<div class="kt ${zor?(K.izinG.every(x=>tK[x.key])?'yesil':'sari'):'sari'}"><div class="kth"><b>Rapor ve izinler · ${K.izinG.length}</b><span>${zor?'Evrakı ve günleri kontrol edip her birini işaretleyin; işaretlenmeden hafta kapatılamaz.':'Evrakı tamam mı kontrol edin.'}</span></div><div class="kti">${K.izinG.map(x=>tkChip(x,`${ad(x.p)} · ${x.gun.map(gunY).join(', ')} ${KOD[x.v].ad.toLocaleLowerCase('tr-TR')}`)).join('')}</div></div>`;
  if(K.gc.length&&!zor)h+=`<div class="kt ${K.gc.every(x=>tK[x.key])?'yesil':'sari'}"><div class="kth"><b>Giriş ve çıkışlar · ${K.gc.length}</b><span>SGK tarihini ve çizelgede ilk / son çalıştığı günü muhasebe grubuyla kontrol edip işaretleyin; işaretlenmeden hafta kapatılamaz.</span></div><div class="kti">${K.gc.map(x=>tkChip(x,`${ad(x.p)} · ${x.tur.toLowerCase()} ${trTarih(x.t)}${x.sgk?' (SGK '+trTarih(x.sgk)+')':''} · çizelgede ${x.tur==='Giriş'?'ilk':'son'} gün ${x.cz?gunY(x.cz):'yok'}`,true)).join('')}</div></div>`;
  if(K.yok.length)h+=`<div class="kt ${zor?(K.yok.every(x=>tK[x.key])?'yesil':'sari'):'sari'}"><div class="kth"><b>Haftanın listesinde olmayan çalışanlar · ${K.yok.length}</b><span>${zor?'Bu hafta çalışmadıysa işaretleyin: kapatınca bu haftaki günleri <b>ücretsiz izin</b> olarak yazılır. Çalıştıysa "+ ekle" ile listeye ekleyip günlerini girin; işten ayrıldıysa personelden çıkış tarihini girin. İşaretlenmeden hafta kapatılamaz.':'Personel listesinde aktif ama bu haftanın listesinde yoklar. Kapatınca bu haftaki günleri <b>ücretsiz izin</b> olarak yazılır; işten ayrıldıysa önce personelden çıkış tarihini girin.'}</span></div><div class="kti">${K.yok.map(x=>tkChip(x,`${ad(x.p)} · listede yok`)).join('')}</div></div>`;
  h+=`<p class="note">${kis.length} kişi · haftanın toplam fazla mesaisi ${sg(topFm)} sa.${isSube()?' Kapatınca bu hafta size kapanır ve bölge müdürünün onayına gider; düzeltme gerekirse bölge müdürü kilidi açar.':''}</p>
   ${engel?`<p class="note" style="color:var(--bad);font-weight:600">${engel} hafta kapatılamaz.</p>`:''}
   <div class="row2"><button class="btn grow" id="hkNo">Vazgeç</button><button class="btn primary grow" id="hkOk" ${engel?'disabled':''}>${onayDa?'Kapat ve onayla':'Evet, kapat'}</button></div>`;
  openSheet(h,sh=>{byId('hkNo').onclick=closeSheet;
    sh.querySelectorAll('[data-t7]').forEach(c=>c.onchange=()=>{const pid=c.dataset.t7;const w0=S.haftalar[wid]||{};S.haftalar[wid]={...w0,teyit7:{...(w0.teyit7||{}),[pid]:c.checked}};
      {const sid=S.subeId,hdA=hdAlani(wid);sirayla(sid+'|'+wid,()=>{arka(setDoc(weekRef(wid,sid),{hafta:wid,ay2:ayKey(haftaPazar(wid)),...hdA,teyit7:{[pid]:c.checked}},{merge:true}));});}haftaKapatPanel(wid,onayDa);});
    sh.querySelectorAll('[data-tk]').forEach(c=>c.onchange=()=>{const key=c.dataset.tk;const w0=S.haftalar[wid]||{};S.haftalar[wid]={...w0,teyitK:{...(w0.teyitK||{}),[key]:c.checked}};
      {const sid=S.subeId,hdA=hdAlani(wid);sirayla(sid+'|'+wid,()=>{arka(setDoc(weekRef(wid,sid),{hafta:wid,ay2:ayKey(haftaPazar(wid)),...hdA,teyitK:{[key]:c.checked}},{merge:true}));});}haftaKapatPanel(wid,onayDa);});
    const ok=byId('hkOk');if(ok)ok.onclick=async()=>{ok.disabled=true;try{await haftayiKapat(wid,onayDa);closeSheet();toast(onayDa?`${rangeLabel(wid)} kapatıldı ve onaylandı.`:`${rangeLabel(wid)} kapatıldı${isSube()?', bölge müdürüne gönderildi':''}.`);}catch(e){ok.disabled=false;yazmaHatasi(e);}};});}
// Kapatılan haftanın kişi bazında özeti: şube müdürü kapalı haftayı göremediği için "bu haftaya kadar" toplamı buradan gelir.
function haftaOzHesap(wid){const sb=haftaAyari(wid);const oz={};const k=kadroDoc(wid)||[];
  k.forEach(pid=>{const p=S.personel.find(x=>x.id===pid);if(!p||!weekHasEntry(pid,wid))return;const x=haftaHesap(p,wid,sb);oz[pid]={h:Math.round(x.h*100)/100,fm:Math.round(x.fm*100)/100,a:haftaAyParca(p,wid,sb)};});return oz;}
async function haftayiKapat(wid,onayDa=false){const sid=S.subeId;const t=new Date().toISOString();const ad=benAd();const d=onayDa?'onay':'kapali';
  if(!sunucuHazir(sid))throw hazirDegil();await gunleriYukle(cizelgeKisileri(wid),haftaAylari(wid));if(!sunucuHazir(sid))throw hazirDegil();
  // Haftanın listesinde olmayan çalışanlar (paket başı / esnaf hariç): çalıştığı günler ücretsiz izin olarak çizelgeye yazılır, listeye eklenir.
  const yokC={};{const ds=weekDays(wid);for(const x of haftaKontrol(wid).yok){const p=x.p;const c={};
      for(let i=0;i<7;i++){const d=ds[i];if(!employed(p,d)||!cizelgeYazabilir(d)||cellOf(p.id,wid,i))continue;
        if(cokSubeli(p)){let cak=null;try{cak=await gunYaz(p,ymd(d),'UI',sid);}catch(e){console.error(e);cak={hata:1};}if(cak)continue;}c[String(i)]='UI';}
      if(Object.keys(c).length)yokC[p.id]=c;}}
  const yokIds=Object.keys(yokC);
  if(yokIds.length){const w0=S.haftalar[wid]||{};const cells={...(w0.cells||{})};yokIds.forEach(pid=>cells[pid]={...(cells[pid]||{}),...yokC[pid]});
    S.haftalar[wid]={...w0,kadro:[...(kadroDoc(wid)||[]),...yokIds.filter(x=>!(kadroDoc(wid)||[]).includes(x))],cells};}
  const oz=haftaOzHesap(wid);const k=(kadroDoc(wid)||[]).slice();
  const b=writeBatch(db);
  b.set(weekRef(wid,sid),{hafta:wid,ay2:ayKey(haftaPazar(wid)),hd:d,...(yokIds.length?{kadro:k,cells:yokC}:{}),kapatma:t,kapatan:S.user.uid,kapatanAd:ad,geriNot:'',...(onayDa?{onayTarihi:t,onaylayanAd:ad}:{}),kayit:arrayUnion({t,ad,i:(onayDa?'kapattı ve onayladı':'kapattı')+(yokIds.length?` · listede olmayan ${yokIds.length} kişi ücretsiz izin yazıldı`:'')})},{merge:true});
  b.set(durumRef(sid),{w:{[wid]:{d,t,ad,oz,k}}},{mergeFields:['w.'+wid]});
  await b.commit();if(onayDa)await ozetGuncelle(haftaAylari(wid),sid);}
// Hafta onaylandıktan sonra şubeler arası ay özeti; yazılamazsa kullanıcı uyarılır (hafta onayı geçerli kalır).
async function ozetGuncelle(aklar,sid){try{await ozetYaz(aklar,sid);}catch(e){console.error(e);toast('Hafta onaylandı ama ay özeti güncellenemedi (bağlantı ya da şube değişti). Haftanın kilidini açıp yeniden onaylayın.');}}
export async function haftaOnayla(wid){const sid=S.subeId;const t=new Date().toISOString();const ad=benAd();const w0=S.haftalar[wid]||{};
  if(!sunucuHazir(sid)){yazmaHatasi(hazirDegil());return false;}await gunleriYukle(cizelgeKisileri(wid),haftaAylari(wid));if(!sunucuHazir(sid)){yazmaHatasi(hazirDegil());return false;}const dw=(S.haftaDurum.w||{})[wid]||{};
  const b=writeBatch(db);b.set(weekRef(wid,sid),{hd:'onay',onayTarihi:t,onaylayanAd:ad,kayit:arrayUnion({t,ad,i:'onayladı'})},{merge:true});
  b.set(durumRef(sid),{w:{[wid]:{d:'onay',t:dw.t||w0.kapatma||t,ad:dw.ad||w0.kapatanAd||ad,oz:haftaOzHesap(wid),k:(kadroDoc(wid)||[]).slice()}}},{mergeFields:['w.'+wid]});
  try{await b.commit();}catch(e){yazmaHatasi(e);return false;}toast(`${rangeLabel(wid)} onaylandı.`);await ozetGuncelle(haftaAylari(wid),sid);return true;}
// Bölge müdürü / işveren onay verirken kontrol listesi: rapor ve izinler, giriş / çıkışlar, listede olmayanlar. Şube müdürünün işaretlediği maddeler ✓ ile görünür; madde yoksa doğrudan onaylanır.
export async function haftaOnayPanel(wid){await gunleriYukle(cizelgeKisileri(wid),haftaAylari(wid));const K=haftaKontrol(wid);
  if(!K.izinG.length&&!K.gc.length&&!K.yok.length)return haftaOnayla(wid);
  const sb=haftaAyari(wid);const tK=(S.haftalar[wid]||{}).teyitK||{};const ad=p=>esc(kisaAd(p.ad));const gunY=d=>`${d.getDate()} ${AYK[d.getMonth()]}`;
  const chip=(x,t,tik)=>tik?`<label class="kchip ${tK[x.key]?'on':''}"><input type="checkbox" data-tko="${esc(x.key)}" ${tK[x.key]?'checked':''}> ${t}</label>`:`<span class="kchip ${tK[x.key]?'on':''}">${tK[x.key]?'✓ ':''}${t}</span>`;
  const bolum=(L,baslik,not,fn,tik)=>L.length?`<div class="kt ${L.every(x=>tK[x.key])?'yesil':'sari'}"><div class="kth"><b>${baslik} · ${L.length}</b><span>${not}</span></div><div class="kti">${L.map(x=>chip(x,fn(x),tik)).join('')}</div></div>`:'';
  const gcEksik=K.gc.filter(x=>!tK[x.key]).length;
  let h=`<h2>Haftayı onayla</h2><div class="sub">${esc(sb.ad)} · ${rangeLabel(wid)}</div><p class="note" style="margin-top:0">Şube müdürünün işaretlediği maddeler ✓ ile görünür. Evrakı ve tarihleri kontrol edip onaylayın; yanlış varsa haftayı geri gönderebilirsiniz.</p>`;
  h+=bolum(K.izinG,'Rapor ve izinler','Evrakı tamam mı kontrol edin.',x=>`${ad(x.p)} · ${x.gun.map(gunY).join(', ')} ${KOD[x.v].ad.toLocaleLowerCase('tr-TR')}`);
  h+=bolum(K.gc,'Giriş ve çıkışlar','SGK tarihini ve çizelgede ilk / son günü muhasebe grubuyla kontrol edip işaretleyin; işaretlenmeden onaylanamaz.',x=>`${ad(x.p)} · ${x.tur.toLowerCase()} ${trTarih(x.t)}${x.sgk?' (SGK '+trTarih(x.sgk)+')':''} · çizelgede ${x.tur==='Giriş'?'ilk':'son'} gün ${x.cz?gunY(x.cz):'yok'}`,true);
  h+=bolum(K.yok,'Haftanın listesinde olmayan çalışanlar','Personel listesinde aktif ama bu haftanın listesinde yoklar; kontrol edin.',x=>`${ad(x.p)} · listede yok`);
  if(gcEksik)h+=`<p class="note" style="color:var(--bad);font-weight:600">Giriş / çıkışta ${gcEksik} madde işaretlenmeden onaylanamaz.</p>`;
  h+=`<div class="row2"><button class="btn grow" id="hoNo">Vazgeç</button><button class="btn primary grow" id="hoOk" ${gcEksik?'disabled':''}>Onayla</button></div>`;
  openSheet(h,sh=>{byId('hoNo').onclick=closeSheet;byId('hoOk').onclick=async()=>{const b=byId('hoOk');b.disabled=true;closeSheet();await haftaOnayla(wid);};
    sh.querySelectorAll('[data-tko]').forEach(c=>c.onchange=()=>{const key=c.dataset.tko;const w0=S.haftalar[wid]||{};S.haftalar[wid]={...w0,teyitK:{...(w0.teyitK||{}),[key]:c.checked}};
      const sid=S.subeId;sirayla(sid+'|'+wid,()=>{arka(setDoc(weekRef(wid,sid),{teyitK:{[key]:c.checked}},{merge:true}));});haftaOnayPanel(wid);});});}
export function haftaGeriPanel(wid){openSheet(`<h2>Haftayı geri gönder</h2><div class="sub">${esc(sube().ad)} · ${rangeLabel(wid)}. Hafta şube müdürüne yeniden açılır, notu görür, düzeltip tekrar kapatır.</div>
  <label class="field"><span>Not</span><textarea id="hgNot" rows="3" placeholder="Örn: Ali'nin 14 Ekim çıkış saati eksik"></textarea></label>
  <div class="row2"><button class="btn grow" id="hgNo">Vazgeç</button><button class="btn danger grow" id="hgOk">Geri gönder</button></div>`,()=>{byId('hgNo').onclick=closeSheet;
  byId('hgOk').onclick=async()=>{const not=byId('hgNot').value.trim();closeSheet();await haftaAc(wid,'geri gönderdi',not);toast('Hafta şubeye geri gönderildi.');};});}
export async function haftaKilidiAc(wid){await haftaAc(wid,'kilidi açtı','');toast('Haftanın kilidi açıldı, şube düzenleyebilir.');}
async function haftaAc(wid,islem,not){const sid=S.subeId;const t=new Date().toISOString();const ad=benAd();const b=writeBatch(db);
  b.set(weekRef(wid,sid),{hd:'acik',geriNot:not||'',kayit:arrayUnion({t,ad,i:islem,...(not?{not}:{})})},{merge:true});
  b.set(durumRef(sid),{w:{[wid]:deleteField()}},{merge:true});try{await b.commit();}catch(e){yazmaHatasi(e);}}
// Bölge müdürü / işveren kapalı bir haftada değişiklik yaparsa özet ve (onaylıysa) şubeler arası ay özeti yenilenir.
const kgT={};export function kapaliHaftaGuncelle(wid,sid0,deneme=0){const sid=sid0||S.subeId;if(sid!==S.subeId||!puantajYetki()||haftaDurumu(wid)==='acik')return;clearTimeout(kgT[wid]);
  kgT[wid]=setTimeout(async()=>{if(!sunucuHazir(sid)){if(S.subeId===sid&&deneme<40)kapaliHaftaGuncelle(wid,sid,deneme+1);return;}const dw=(S.haftaDurum.w||{})[wid]||{};const d=haftaDurumu(wid);
    try{await setDoc(durumRef(sid),{w:{[wid]:{...dw,d,oz:haftaOzHesap(wid),k:(kadroDoc(wid)||[]).slice()}}},{mergeFields:['w.'+wid]});if(d==='onay')await ozetYaz(haftaAylari(wid),sid);}catch(e){console.error(e);}},1500);}
// Şubeler arası ay özeti (maaşın ödendiği şube diğer şubelerdeki izin ve günleri buradan alır). Sadece her şeyi gören bölge müdürü / işveren yazar.
async function ozetYaz(aklar,sid=S.subeId){if(!puantajYetki())return;if(!sunucuHazir(sid))throw hazirDegil();const ay3=new Set();aklar.forEach(a=>{ay3.add(ayKaydir(a,-1));ay3.add(a);ay3.add(ayKaydir(a,1));});
  for(const ak of aklar){await gunleriYukle(ayKadrosu(ak),[...ay3]);if(!sunucuHazir(sid))throw hazirDegil();arka(setDoc(doc(db,'ozetler',ak+'__'+sid),{sube:sid,ay:ak,kisiler:subeOzeti(ak,sid),guncellendi:new Date().toISOString()},{mergeFields:['sube','ay','kisiler','guncellendi']}));}}
// Bir ayın haftaları (puantaj onayı için): haftalık dönemde dönemin haftaları, takvim ayında aya değen haftalar.
function ayinHaftalari(ak,sb=subeAyari(S.subeId,ak)){if(sb.fmDonem==='hafta'){const L=fmHaftalari(ak);const[y0,m0]=ak.split('-').map(Number);const ilk=mondayOf(new Date(y0,m0-1,1));const son=mondayOf(new Date(y0,m0,0));const R=ilk<L[0]?[ilk,...L]:[...L];if(!R.includes(son))R.push(son);return R.sort();}const[y,m]=ak.split('-').map(Number);const L=[];const last=new Date(y,m,0);
  for(let w=parse(mondayOf(new Date(y,m-1,1)));w<=last;w=addDays(w,7))L.push(ymd(w));return L;}
export function ayHaftaDurumu(ak){const L=ayinHaftalari(ak).filter(w=>haftaDolu(w));const say={acik:0,kapali:0,onay:0};L.forEach(w=>say[haftaDurumu(w)]=(say[haftaDurumu(w)]||0)+1);return{L,say,tamam:L.length>0&&say.onay===L.length};}

