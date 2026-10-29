// hafta-islem.js — app.js (v180) satırları 985-1045. Otomatik bölündü; davranış değişmedi.
import { arrayUnion, deleteField, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AYK, KOD } from './sabitler.js';
import { arka, db, setDoc, writeBatch } from './firebase.js';
import { S } from './durum.js';
import { addDays, ayKaydir, ayKey, esc, kisaAd, mondayOf, parse, rangeLabel, trTarih, weekDays, ymd } from './yardimci.js';
import { puantajYetki } from './rol.js';
import { cellOf, employed, haftaAyParca, haftaHesap, sube, subeAyari, weekHasEntry } from './hesap.js';
import { fmHaftalari } from './fm-donem.js';
import { cokSubeli, gunYaz, gunleriYukle } from './cok-sube.js';
import { ayKadrosu, cizelgeKisileri, kadroDoc } from './kadro.js';
import { subeOzeti } from './ay-ozet.js';
import { sirayla, weekRef, yazmaHatasi } from './yazma.js';
import { haftaAyari, haftaDurumu, hazirDegil, sunucuHazir } from './hucre-yazma.js';
import { byId } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { cizelgeYazabilir } from './cizelge.js';
import { benAd, durumRef, haftaAylari, haftaDolu, haftaPazar } from './hafta-kapatma.js';
import { haftaKontrol } from './hafta-kontrol.js';

// Kapatılan haftanın kişi bazında özeti: şube müdürü kapalı haftayı göremediği için "bu haftaya kadar" toplamı buradan gelir.
function haftaOzHesap(wid){const sb=haftaAyari(wid);const oz={};const k=kadroDoc(wid)||[];
  k.forEach(pid=>{const p=S.personel.find(x=>x.id===pid);if(!p||!weekHasEntry(pid,wid))return;const x=haftaHesap(p,wid,sb);oz[pid]={h:Math.round(x.h*100)/100,fm:Math.round(x.fm*100)/100,a:haftaAyParca(p,wid,sb)};});return oz;}
export async function haftayiKapat(wid,onayDa=false){const sid=S.subeId;const t=new Date().toISOString();const ad=benAd();const d=onayDa?'onay':'kapali';
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

