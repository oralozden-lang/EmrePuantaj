// takip.js — app.js (v180) satırları 1433-1476. Otomatik bölündü; davranış değişmedi.
import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AYK, subeAdi } from './sabitler.js';
import { db } from './firebase.js';
import { S, subs, tryLS } from './durum.js';
import { addDays, esc, mondayOf, parse, rangeLabel, today, ymd } from './yardimci.js';
import { gunleriYukle } from './cok-sube.js';
import { cizelgeKisileri, kisaSubeAd } from './kadro.js';
import { sunucuHazir } from './hucre-yazma.js';
import { selectSube } from './subeler.js';
import { byId, render } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { KAPATMA_GUN, haftaAylari, haftaBitti, haftaGecikti, haftaPazar, tarihSaat } from './hafta-kapatma.js';
import { haftaKapatPanel, haftaKontrol } from './hafta-kontrol.js';
import { haftaGeriPanel, haftaKilidiAc, haftaOnayPanel, haftaOnayla } from './hafta-islem.js';

/* ================= Haftalar: şubelerin haftalık kapatma takibi (bölge müdürü + işveren) ================= */
const TK_HAFTA=4;
function takipHaftalari(){const bu=parse(mondayOf(today()));const L=[];for(let j=TK_HAFTA;j>=1;j--)L.push(ymd(addDays(bu,-7*(j+(S.tkKay||0)))));return L;}
function takipDinle(){const L=takipHaftalari();const key=L[0]+'|'+S.subeIds.join();if(S.tkKey===key)return;S.tkKey=key;subs.tk.forEach(u=>u());subs.tk=[];S.tk={};
  S.subeIds.forEach(sid=>subs.tk.push(onSnapshot(query(collection(db,'subeler',sid,'haftalar'),where('hafta','>=',L[0])),s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.tk[sid]=m;if(S.tab==='puantaj'&&!S.pt.sube&&S.tkGorunum==='hafta')render();},()=>{S.tk[sid]={};})));}
function tkDurum(sid,wid){const w=(S.tk[sid]||{})[wid];if(!w)return S.tk[sid]?'yok':'yukleniyor';const k=Array.isArray(w.kadro)?w.kadro:Object.keys(w.cells||{});if(!k.length&&!w.hd)return'yok';
  const hd=w.hd||'acik';if(hd==='acik')return haftaBitti(wid)?(haftaGecikti(wid)?'gecikti':(w.geriNot?'geri':'acik')):'devam';return hd;}
const TK={yok:['—','mut',''],yukleniyor:['…','mut',''],devam:['Sürüyor','mut','Hafta bitmedi'],acik:['Açık','warn','Şube kapatmadı, süresi dolmadı'],geri:['Geri gönd.','bad','Geri gönderildi, şube düzeltiyor'],gecikti:['Gecikti','bad','Süresinde kapatılmadı'],kapali:['Onay bekl.','bekle','Şube kapattı, onayınızı bekliyor'],onay:['Onaylı','ok','Onaylandı']};
export function renderTakip(){takipDinle();const L=takipHaftalari();
  let h=`<div class="weeknav"><button class="nav-arrow" id="tkPrev" aria-label="Önceki haftalar">‹</button><div class="ttl">${(()=>{const a=parse(L[0]),b=haftaPazar(L[L.length-1]);return `${a.getDate()} ${AYK[a.getMonth()]} – ${b.getDate()} ${AYK[b.getMonth()]} ${b.getFullYear()}`;})()}<small>${S.tkKay?'Önceki haftalar':`Biten son ${TK_HAFTA} hafta`}</small></div><button class="nav-arrow" id="tkNext" aria-label="Sonraki haftalar" ${S.tkKay?'':'disabled'}>›</button></div>`;
  const say={};const bekleyen=[];
  h+=`<div class="tk-wrap"><table class="tk"><thead><tr><th class="l">Şube</th>${L.map(w=>{const a=parse(w),b=haftaPazar(w);return `<th>${a.getDate()}–${b.getDate()}<small>${AYK[b.getMonth()]}</small></th>`;}).join('')}</tr></thead><tbody>`;
  S.subeIds.forEach(sid=>{h+=`<tr><td class="l"><b>${esc(kisaSubeAd(sid))}</b></td>`;L.forEach(w=>{const d=tkDurum(sid,w);say[d]=(say[d]||0)+1;if(d==='kapali')bekleyen.push([sid,w]);const t=TK[d];
      h+=`<td><button class="tkc ${t[1]}" data-tks="${esc(sid)}" data-tkw="${w}" title="${esc(t[2])}" ${d==='yok'||d==='yukleniyor'?'disabled':''}>${t[0]}</button></td>`;});h+='</tr>';});
  h+=`</tbody></table></div>`;
  h+=`<div class="legend">${['kapali','gecikti','acik','geri','onay'].map(k=>`<span><i class="tkl ${TK[k][1]}"></i>${TK[k][2]}${say[k]?` · ${say[k]}`:''}</span>`).join('')}</div>`;
  if(bekleyen.length)h+=`<div class="actions" style="margin-top:12px"><button class="btn primary grow" id="tkHepsi">Onay bekleyen ${bekleyen.length} haftayı onayla</button></div>`;
  h+=`<p class="note yardim">Hafta bitince şube müdürünün ${KAPATMA_GUN} günü var. Kapatılan hafta şube müdürüne kapanır ve burada onayınızı bekler. Hücreye dokunup çizelgeyi açın, onaylayın, geri gönderin ya da kilidini açın; şube adına da kapatabilirsiniz.</p>`;
  return h;}
export function takipBagla(){const p=byId('tkPrev'),n=byId('tkNext');if(p)p.onclick=()=>{S.tkKay=(S.tkKay||0)+TK_HAFTA;render();};if(n)n.onclick=()=>{S.tkKay=Math.max(0,(S.tkKay||0)-TK_HAFTA);render();};
  document.querySelectorAll('[data-tks]').forEach(b=>b.onclick=()=>takipPanel(b.dataset.tks,b.dataset.tkw));
  const hb=byId('tkHepsi');if(hb)hb.onclick=async()=>{const L=takipHaftalari();const B=[];S.subeIds.forEach(sid=>L.forEach(w=>{if(tkDurum(sid,w)==='kapali')B.push([sid,w]);}));hb.disabled=true;
    let n=0,atla=0,dur=false;for(const[sid,w]of B){hb.textContent=`Onaylanıyor ${n+atla+1} / ${B.length}`;const r=await subedeYap(sid,w,async()=>{await gunleriYukle(cizelgeKisileri(w),haftaAylari(w));const K=haftaKontrol(w);if(K.izinG.length||K.gc.length||K.yok.length)return'atla';return haftaOnayla(w);});if(r===false){dur=true;break;}if(r==='atla')atla++;else n++;}
    toast(dur?`${n} hafta onaylandı; ${B.length-n-atla} hafta onaylanamadı, tekrar deneyin.`:atla?`${n} hafta onaylandı. ${atla} haftada kontrol maddesi (izin, giriş / çıkış) var, tek tek açıp onaylayın.`:`${n} hafta onaylandı.`);render();};}
// Başka şubenin haftasında işlem: önce o şube yüklenir (hesaplar o şubenin çizelgesiyle yapılır).
async function subedeYap(sid,wid,fn){if(S.subeId!==sid)selectSube(sid);S.hafta=wid;for(let i=0;i<300&&!sunucuHazir(sid);i++)await new Promise(r=>setTimeout(r,100));
  if(!sunucuHazir(sid)){toast(`${subeAdi(sid)} şubesinin verileri yüklenemedi, işlem yapılmadı. İnterneti kontrol edip tekrar deneyin.`);return false;}return fn();}
function takipPanel(sid,wid){const w=(S.tk[sid]||{})[wid]||{};const d=tkDurum(sid,wid);const hd=w.hd||'acik';const kay=(w.kayit||[]).slice().sort((a,b)=>String(b.t).localeCompare(String(a.t)));
  const btn=(id,t,c='')=>`<button class="btn grow ${c}" id="${id}">${t}</button>`;
  openSheet(`<h2>${esc(subeAdi(sid))}</h2><div class="sub">${rangeLabel(wid)} · <span class="chip ${TK[d][1]}">${TK[d][0]}</span></div>
   ${w.kapatanAd&&hd!=='acik'?`<p class="note" style="margin-top:0">Kapatan: ${esc(w.kapatanAd)} · ${tarihSaat(w.kapatma)}${w.onaylayanAd?` · Onaylayan: ${esc(w.onaylayanAd)} · ${tarihSaat(w.onayTarihi)}`:''}</p>`:''}
   ${w.geriNot&&hd==='acik'?`<div class="confirm">Geri gönderme notu: "${esc(w.geriNot)}"</div>`:''}
   <div class="row2">${btn('tpAc','Çizelgeyi aç','primary')}</div>
   <div class="row2">${hd==='kapali'?btn('tpOn','Onayla')+btn('tpGeri','Geri gönder','danger'):''}${hd==='acik'&&haftaBitti(wid)?btn('tpKap','Şube adına kapat')+btn('tpKapOn','Kapat ve onayla'):''}</div>
   ${hd!=='acik'?`<div class="row2">${btn('tpKilit','Kilidi aç')}</div>`:''}
   <span class="lbl">Kayıt</span><div class="card list">${kay.map(k=>`<div class="row"><div class="m"><b>${esc(k.i)}</b><span>${esc(k.ad||'')} · ${tarihSaat(k.t)}${k.not?' · "'+esc(k.not)+'"':''}</span></div></div>`).join('')||'<div class="note" style="padding:10px 12px">Henüz işlem yok.</div>'}</div>`,()=>{
   const on=(id,f)=>{const e=byId(id);if(e)e.onclick=f;};
   on('tpAc',()=>{closeSheet();S.tab='cizelge';tryLS('pm.tab','cizelge');S.hafta=wid;if(S.subeId!==sid)selectSube(sid);else render();window.scrollTo(0,0);});
   on('tpOn',async()=>{closeSheet();await subedeYap(sid,wid,()=>haftaOnayPanel(wid));});
   on('tpGeri',async()=>{closeSheet();await subedeYap(sid,wid,()=>haftaGeriPanel(wid));});
   on('tpKap',async()=>{closeSheet();await subedeYap(sid,wid,()=>haftaKapatPanel(wid,false));});
   on('tpKapOn',async()=>{closeSheet();await subedeYap(sid,wid,()=>haftaKapatPanel(wid,true));});
   on('tpKilit',()=>{const e=byId('tpKilit');if(!e.dataset.ok){e.dataset.ok='1';e.textContent='Kilidi açmayı onayla';return;}closeSheet();subedeYap(sid,wid,()=>haftaKilidiAc(wid));});});}

