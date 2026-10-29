// personel.js — app.js (v180) satırları 1046-1054, 1261-1301. Otomatik bölündü; davranış değişmedi.
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { BASLANGIC_AY, GRUP, GRUP_SIRA, SGK_YOK, gorevTahmin, subeAdi } from './sabitler.js';
import { arka, db, runTransaction, writeBatch } from './firebase.js';
import { S, tryLS } from './durum.js';
import { addDays, ayAdi, ayKey, bas, esc, parse, rangeLabel, sayi, tl0, today, trTarih, ymd } from './yardimci.js';
import { isIsveren, isSube } from './rol.js';
import { ilkGun, sirala, sube } from './hesap.js';
import { gorevGecmisYazi, odemeSubesiEski } from './gecmis.js';
import { ekSubeleri, kisiSubeleri, subedeAktif } from './cok-sube.js';
import { ayniKisi } from './ay-ozet.js';
import { sirayla, weekRef } from './yazma.js';
import { byId, render, view } from './cerceve.js';
import { closeSheet, toast } from './panel.js';
import { renderBilgiListesi } from './personel-listesi.js';
import { personelPanel } from './personel-panel.js';

/* ================= Personel (şirket geneli liste) ================= */
// Kişiyi bir şubenin haftalık listesine ekler (o haftanın listesi yoksa önceki haftanın listesini temel alır).
async function cizelgeyeKoy(sid,wid,pid){if(!erisimVar(sid))return;const ref=weekRef(wid,sid);
  // Ekrandaki (belki eski ya da yüklenmemiş) liste değil, sunucudaki liste esas alınır; haftanın durumuna dokunulmaz.
  try{let s0;try{s0=await getDoc(ref);}catch(e){if(String(e.code||'').includes('permission'))return;throw e;}// kapalı hafta: şube müdürü göremez, eklenmez
    let taban=[];if(!s0.exists())for(let i=1;i<=8;i++){let q;try{q=await getDoc(weekRef(ymd(addDays(parse(wid),-7*i)),sid));}catch(e){continue;}if(q.exists()){const d=q.data();taban=Array.isArray(d.kadro)?d.kadro.slice():Object.keys(d.cells||{});break;}}
    await runTransaction(db,async tr=>{const s=await tr.get(ref);const yeni=!s.exists();let kad;const hdYok=yeni||!('hd' in s.data());if(!yeni){const d=s.data();kad=Array.isArray(d.kadro)?d.kadro.slice():Object.keys(d.cells||{});}else kad=taban.slice();
      if(kad.includes(pid))return;kad.push(pid);tr.set(ref,{hafta:wid,ay2:ayKey(addDays(parse(wid),6)),kadro:kad,...(hdYok?{hd:'acik'}:{})},{merge:true});});}
  catch(e){console.error(e);toast(`${subeAdi(sid)} çizelgesine eklenemedi (${rangeLabel(wid)}). İnternet gelince kişiyi "+ ekle" ile ekleyin.`);}}
// Kişinin çalıştığı şube ya da SGK şubesi değişince eski şube "görünür şubeler"e ve o şubenin ek personel listesine eklenir:
// eski şubenin geçmiş haftaları, özetleri ve puantajı kişiyi kaybetmez (kişi yeni haftalara önerilmez).
function eskiSubeYama(p0,body){const once=[p0.anaSube,p0.sgkSube].filter(x=>x&&x!==SGK_YOK);const sonra=new Set([body.anaSube??p0.anaSube,body.sgkSube??p0.sgkSube,...ekSubeleri({...p0,...body})].filter(x=>x&&x!==SGK_YOK));
  const dusen=once.filter(x=>!sonra.has(x));if(!dusen.length)return{body,dusen};return{body:{...body,gorunurSubeler:[...new Set([...(p0.gorunurSubeler||[]),...dusen])]},dusen};}
export function personelYaz(pid,p0,body){const r=eskiSubeYama(p0||{},body);
  sirayla('p'+pid,()=>{const b=writeBatch(db);b.set(doc(db,'personel',pid),r.body,{merge:true});r.dusen.forEach(x=>b.set(doc(db,'ekPersonel',x),{ids:{[pid]:true}},{merge:true}));arka(b.commit());});return r.body;}
// Silmeden önce: kişinin herhangi bir şubede çizelge kaydı var mı (varsa silinmez, çıkış tarihi girilir).
export async function personelKaydiVar(p){for(const sid of kisiSubeleri(p)){const q=await getDocs(collection(db,'subeler',sid,'haftalar'));
    if(q.docs.some(d=>{const x=d.data()||{};return (Array.isArray(x.kadro)&&x.kadro.includes(p.id))||Object.values((x.cells||{})[p.id]||{}).some(v=>v);}))return subeAdi(sid)||sid;}
  return null;}
export function personelYazabilir(p){const m=S.me.subeler||[];return isIsveren()||!p.anaSube||m.includes(p.anaSube)||m.includes(p.sgkSube);}
function erisimVar(sid){return isIsveren()||(S.me.subeler||[]).includes(sid);}
// Şubenin listesi: o şubede çalışanlar + SGK'sı o şubede olanlar (başka şubede çalışsa da).
export function subePersoneli(sid=S.subeId){return S.personel.filter(p=>subedeAktif(p,sid));}
function personelMod(){return `<div class="seg" id="pMod" style="margin-bottom:10px"><button data-v="kart" class="${S.plist?'':'on'}">Kartlar</button><button data-v="liste" class="${S.plist?'on':''}">Bilgi listesi</button></div>`;}
function personelModBagla(){document.querySelectorAll('#pMod button').forEach(b=>b.onclick=()=>{S.plist=b.dataset.v==='liste';tryLS('pm.plist',S.plist?'1':'0');render();});}
export function renderPersonel(){return renderBilgiListesi();}
function eskiKartListesi(){const list=sirala(subePersoneli());const td=ymd(today());
  let h=personelMod()+`<div class="actions"><button class="btn primary grow" id="addP">Personel ekle</button></div><p class="note" style="margin-top:0">${esc(sube().ad)} personel listesi. SGK'sı bu şubede olup başka şubede çalışanlar da burada görünür.</p>`;
  if(!list.length)return view(h+`<div class="empty-state"><b>Henüz personel yok</b>"Personel ekle" ile şubenin çalışanlarını girin.</div>`,()=>{personelModBagla();byId('addP').onclick=()=>personelPanel(null);});
  const aktif=list.filter(p=>!p.cikis||p.cikis>=td),cikan=list.filter(p=>p.cikis&&p.cikis<td);
  const row=p=>`<button class="row" data-id="${esc(p.id)}"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(gorevTahmin(p)||'Görev seçilmemiş')}${p.sekil==='Part'?' · Part':''} · SGK: ${p.sgkSube===SGK_YOK?'yok':p.sgkSube?esc(subeAdi(p.sgkSube)):'<b style="color:var(--warn)">seçilmemiş</b>'}${p.anaSube&&p.anaSube!==S.subeId?' · çalıştığı: '+esc(subeAdi(p.anaSube)):''}${p.giris?' · giriş '+trTarih(p.giris):''}</span></div>
    <div class="r">${p.cikis?`<span class="chip ${p.cikis<td?'mut':'warn'}">Çıkış ${trTarih(p.cikis)}</span>`:''}</div></button>`;
  GRUP_SIRA.forEach(g=>{const l=aktif.filter(p=>(p.grup||'K')===g);if(l.length)h+=`<div class="sec">${GRUP[g]} · ${l.length}</div><div class="card list">${l.map(row).join('')}</div>`;});
  if(cikan.length)h+=`<div class="sec">Çıkış yapanlar · ${cikan.length}</div><div class="card list">${cikan.map(row).join('')}</div>`;
  view(h,()=>{personelModBagla();byId('addP').onclick=()=>personelPanel(null);document.querySelectorAll('.row[data-id]').forEach(b=>b.onclick=()=>personelPanel(b.dataset.id));});}
// Kişi kartındaki geçmiş: aynı kişinin tüm kayıtları (çalışma dönemleri), görev geçmişi ve (yetkisi olana) maaş geçmişi.
export function personelGecmisHtml(p){const td=ymd(today());const K=S.personel.filter(x=>x.id===p.id||ayniKisi(x,p)).sort((a,b)=>String(ilkGun(a)||'').localeCompare(String(ilkGun(b)||'')));
  const don=K.map(x=>{const sgk=x.sgkSube&&x.sgkSube!==SGK_YOK?x.sgkSube:'';const ana=x.anaSube||'';const yer=esc(subeAdi(ana)||subeAdi(sgk)||'—')+(sgk&&sgk!==ana?` <small>(SGK ${esc(subeAdi(sgk))})</small>`:'');
    return `<div class="gcr"><span>${esc(trTarih(ilkGun(x))||'?')} – ${x.cikis?esc(trTarih(x.cikis)):'devam'}</span><span>${yer} · ${esc(gorevTahmin(x)||'—')}</span>${x.id===p.id?'<i>bu kayıt</i>':`<button class="mini" data-gk="${esc(x.id)}">Aç</button>`}</div>`;}).join('');
  const gg=gorevGecmisYazi(p);
  return `<div class="field gcm"><span>Geçmiş</span><div class="gcb"><b>Çalışma dönemleri</b>${don}</div>
    <div class="gcb"><b>Görev</b><div class="gcr"><span>${gg?esc(gg):esc(gorevTahmin(p)||'—')+(p.sekil&&p.sekil!=='Tam'?' ('+esc(p.sekil)+')':'')+' · değişiklik yok'}</span></div></div>
    ${isSube()?'':'<div class="gcb"><b>Maaş</b><div class="gcr" id="pMaasG"><span class="note" style="margin:0">Yükleniyor…</span></div></div>'}</div>`;}
export async function personelMaasGecmisi(p){document.querySelectorAll('[data-gk]').forEach(b=>b.onclick=()=>{closeSheet();personelPanel(b.dataset.gk);});
  const el=byId('pMaasG');if(!el)return;const K=S.personel.filter(x=>x.id===p.id||ayniKisi(x,p));const ay={};let once=null;
  for(const x of K){const subs=[...new Set([...Object.values(x.maasSubeGecmis||{}),odemeSubesiEski(x)].filter(Boolean))];
    for(const sid of subs){try{const d=await getDoc(doc(db,'maaslar',sid));const m=d.exists()?d.data():{};const g=(m.netGecmis||{})[x.id]||{};Object.entries(g).forEach(([k,v])=>{if(sayi(v))ay[k]=sayi(v);});const n=sayi((m.net||{})[x.id]);if(n&&once==null)once=n;}catch(e){}}}
  if(!byId('pMaasG'))return;const ks=Object.keys(ay).sort();const L=ks.filter((k,i)=>i===0||ay[k]!==ay[ks[i-1]]).map(k=>`${ayAdi(k)}: ${tl0(ay[k])}`);
  if(once!=null&&(!ks.length||(ks[0]>BASLANGIC_AY&&once!==ay[ks[0]])))L.unshift(`${ks.length?'Önce':'Kayıtlı'}: ${tl0(once)}`);// ilk kayıt başlangıç ayındaysa eski değer hiçbir aya uygulanmaz
  byId('pMaasG').innerHTML=`<span>${L.length?esc(L.join(' · ')):'Maaş girilmemiş'}</span>`;}
