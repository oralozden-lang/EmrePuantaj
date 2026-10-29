// cizelge.js — app.js (v180) satırları 740-898. Otomatik bölündü; davranış değişmedi.
import { AY, AYK, BOS_RENK, GRUP, GRUP_SIRA, GUN, GUNU, KOD, KOD_RENK, KOD_SIRA, gorevTahmin, kesinAy, kodStil, subeAdi } from './sabitler.js';
import { S, undo } from './durum.js';
import { addDays, bas, esc, fmt, gosterAy, isShift, isimAnahtar, kisaAd, mondayOf, normTime, parse, rangeLabel, sg, shiftHours, shiftKind, today, weekDays, ymd } from './yardimci.js';
import { duzeltmeGunu, saatAraligi, saatKonum, saatListesi, saatYaz, vardiyaKontrol } from './saat.js';
import { isIsveren, isSube, puantajYetki } from './rol.js';
import { cellOf, employed, fmAyi, fmDonemYazi, isEsnaf, locked, sube } from './hesap.js';
import { GUN_HATA_YAZI, ayKadarS, bosSayilir, cizelgeKisileri, cokSubeli, digerGunler, gunHataVar, gunKaydiP, haftaHesapS, kadroDoc, kadroOf, kisaSubeAd, rowPid, subedenCikti } from './cok-sube.js';
import { kilitEngel } from './kilit.js';
import { RED_NEDEN, haftaAyari, haftaDurumu, hucreKontrol, setCell, setWeek } from './hucre-yazma.js';
import { byId, render, view } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { haftaBandi, haftaIslemBagla, haftaIslemleri, kapaliHaftaKart } from './hafta-kapatma.js';
import { personelPanel, subePersoneli } from './personel.js';
import { paylas } from './paylas.js';
import { XKOD, adBuyuk, isimsizMi } from './excel-aktar.js';

/* ================= Çizelge ================= */
let ROWS=[],ptrTip='mouse',suruk=false,lpT=null,lpOldu=false,lpX=0,lpY=0;
export const UI={SEL:null,MOD:null};
export function cizelgeYazabilir(d){return !kesinAy(d)&&haftaDurumu(mondayOf(d))==='acik'&&(!locked(d)||puantajYetki());}// kapalı / onaylı haftada önce "Kilidi aç" gerekir
export function renderCizelge(){const wid=S.hafta;const sb=haftaAyari(wid);const ds=weekDays(wid);const td=ymd(today());const ak=gosterAy(wid);
  const K=kadroOf(wid);const kisiler=cizelgeKisileri(wid);ROWS=kisiler.map(p=>p.id);if(UI.SEL&&UI.SEL.wid!==wid)UI.SEL=null;
  let h=`<div class="weeknav"><button class="nav-arrow" id="prevW" aria-label="Önceki hafta">‹</button><button class="ttl" id="thisW">${rangeLabel(wid)}<small>${mondayOf(today())===wid?'Bu hafta':'Bu haftaya dön'}</small></button><button class="nav-arrow" id="nextW" aria-label="Sonraki hafta">›</button></div>`;
  if(!(sb.gunluk>0&&sb.gunluk<=16))h+=`<div class="banner bad">Şube ayarlarında günlük mesai ${fmt(sb.gunluk)} saat görünüyor, bu yüzden fazla mesai yanlış hesaplanıyor. ${isIsveren()?'Yönetim → Şubeler\'den 8,5 olarak düzeltin.':'İşverenden şube ayarını düzeltmesini isteyin.'}</div>`;
  if(isSube()&&S.goc4===false)h+=`<div class="banner">Sistem güncelleniyor. İşveren uygulamayı bir kez açınca önceki haftalar yeniden görünecek.</div>`;
  h+=haftaBandi(wid);
  if(gunHataVar())h+=`<div class="banner bad">${GUN_HATA_YAZI}</div>`;
  if(isSube()&&haftaDurumu(wid)!=='acik')return view(h+kapaliHaftaKart(wid),bindWeek);
  if(ds.some(kesinAy))h+=`<div class="banner">Bu haftanın ${ds.every(kesinAy)?'tamamı':'bir kısmı'} kesin kapanmış aya ait; o günler kimse tarafından değiştirilemez.</div>`;
  else if(ds.some(d=>locked(d)))h+=`<div class="banner">${isSube()?'Bu haftanın bir kısmı kapatılmış aya ait, o günler düzenlenemez.':'Bu haftanın bir kısmı kapatılmış aya ait. Yaptığınız değişiklik onaylanmış puantajı değiştirmez.'}</div>`;
  if(K.oneri&&K.ids.length)h+=`<div class="banner ok">Bu haftanın listesi geçen haftadan getirildi. Gelmeyeni ismine dokunup çıkarın, yeni geleni "+ ekle" ile ekleyin.</div>`;
  h+=`<div class="actions"><button class="btn grow" id="copyW">Geçen haftayı kopyala</button><button class="btn" id="undoB" ${undo.length?'':'disabled'}>Geri al</button><button class="btn" id="shareB">Paylaş</button></div>`+haftaIslemleri(wid);
  if(!S.loaded.personel||!S.loaded.haftalar)return view(h+`<div class="empty-state"><b>Vardiyalar yükleniyor</b></div>`,bindWeek);
  const akF=fmAyi(wid,sb);const ak3=AYK[+akF.slice(5)-1];
  const czMod='sutun';// isim her zaman solda
  h+=`<div class="grid cz-${czMod}" id="grid"><div></div>${ds.map((d,i)=>`<div class="dh ${ymd(d)===td?'today':''}">${GUN[i]}<span>${d.getDate()}</span></div>`).join('')}<div class="dh fmh">Hafta<span>fazla mesai</span></div><div class="dh fmh">${ak3}<span>bu haftaya kadar</span></div>`;
  GRUP_SIRA.forEach(g=>{h+=`<div class="gt">${GRUP[g]}<button class="gadd" data-g="${g}">+ ${GRUP[g]} ekle</button></div>`;
    kisiler.filter(p=>(p.grup||'K')===g).forEach(p=>{const r=ROWS.indexOf(p.id);const wk=haftaHesapS(p,wid,sb);const ay=ayKadarS(p,wid,sb);
      const alt=`${fmt(wk.h)} sa${isEsnaf(p)?' · esnaf':p.sekil==='Part'?' · part':''}`;
      const fmH=isEsnaf(p)?['—',`${fmt(ay.h)}<small>sa</small>`]:p.sekil==='Part'?['—',`${fmt(ay.h)}<small>sa</small>`]:[sg(wk.fm),sg(ay.fm)];
      h+=`<button class="nm ${UI.MOD&&UI.MOD.tip==='satir'&&UI.MOD.pid===p.id?'kaynak':''}" data-pe="${esc(p.id)}"><b title="${esc(p.ad)}${isimsizMi(p)&&p.excelAd?' · Excel: '+esc(p.excelAd):''}"><span class="adU">${esc(adBuyuk(p.ad))}</span><span class="adK">${esc(adBuyuk(kisaAd(p.ad)))}</span></b><span>${alt}</span><em class="nmfm">${isEsnaf(p)||p.sekil==='Part'?`${ak3} ${fmH[1]}`:`hafta <i>${fmH[0]}</i> · ${ak3} <i>${fmH[1]}</i>`}</em><em class="nmfmK">${isEsnaf(p)||p.sekil==='Part'?`<i class="fmp sa" title="Bu hafta çalışılan saat">${fmt(wk.h)} sa</i>`:`<i class="fmp ${wk.fm>0.004?'art':wk.fm<-0.004?'eks':'sif'}" title="Bu haftanın fazla mesaisi">${sg(wk.fm)}</i>`}</em></button>`;
      ds.forEach((d,i)=>{const q=gunKaydiP(p,d);if(!q){h+=`<div class="cell out" data-r="${r}" data-c="${i}">—</div>`;return;}
        const lk=!cizelgeYazabilir(d);const val=cellOf(q.id,wid,i);const tag=lk?'div':'button';const at=`data-p="${esc(q.id)}" data-i="${i}" data-r="${r}" data-c="${i}"`;
        if(isShift(val)){const k=shiftKind(val,sb);const vk=vardiyaKontrol(val,sb,d);const[a,b]=val.split('-');h+=`<${tag} class="cell ${!vk.ok?'yuvarla':vk.pay?'pay':''}" ${at} ${!vk.ok?`title="${esc(vk.neden)}"`:vk.pay?'title="Erken çağrılma / geç çıkış (düzeltme)"':''} aria-label="${esc(p.ad)} ${GUNU[i]} ${a}–${b}"><span class="t ${k.o?'o':''}">${a}</span><span class="t ${k.k?'k':''}">${b}</span></${tag}>`;}
        else if(val&&KOD[val])h+=`<${tag} class="cell code" ${kodStil(val)} ${at}>${KOD[val].kisa}</${tag}>`;
        else{const o=cokSubeli(q)?digerGunler(q,d):null;
          if(o){const[s2,v2]=Object.entries(o)[0];h+=`<div class="cell baska" data-r="${r}" data-c="${i}" title="${esc(subeAdi(s2))}: ${esc(degerYazi(v2))}"><b>${esc(kisaSubeAd(s2))}</b><small>${isShift(v2)?esc(v2.replace('-','–')):KOD[v2]?esc(KOD[v2].ad):''}</small></div>`;}
          else h+=`<${tag} class="cell empty ${bosSayilir(q,d)?'':'serbest'}" ${at} aria-label="${esc(p.ad)} ${GUNU[i]} boş">${lk?'':'+'}</${tag}>`;}});
      h+=`<div class="fmc">${fmH[0]}</div><div class="fmc ay">${fmH[1]}</div>`;});});
  h+=`</div>`;
  if(!kisiler.length)h+=`<div class="empty-state"><b>Bu haftanın listesi boş</b>Gruplardaki "+ ekle" ile personel listesinden kişi seçin ya da "Geçen haftayı kopyala"ya basın.</div>`;
  h+=`<div class="legend"><span><i style="background:var(--open)"></i>Açılış saati</span><span><i style="background:var(--close)"></i>Kapanış saati</span>${KOD_SIRA.filter(k=>k!=='B').map(k=>`<span><i style="background:${KOD_RENK[k][0]}"></i>${KOD[k].ad}</span>`).join('')}${kisiler.some(p=>p.sekil==='Part')?`<span><i style="background:${KOD_RENK.CG[0]}"></i>${KOD.CG.ad} (part)</span>`:''}<span><i style="background:${BOS_RENK}"></i>Boş gün</span><span><i class="lg-baska"></i>Başka şubede çalıştığı gün</span><span><i class="lg-pay"></i>Erken çağrılma / geç çıkış</span><span>— İşe giriş öncesi / çıkış sonrası</span></div>
   <p class="note yardim"><b>Kopyala-yapıştır:</b> Bilgisayarda hücreleri fareyle sürükleyerek seçin, Ctrl+C ile kopyalayıp hedef hücrede Ctrl+V yapın; Excel'den kopyaladığınız saatler de yapıştırılır. Delete ile silin, çift tıklayarak düzenleyin. Telefonda hücreye ya da isme basılı tutun.</p>
   <p class="note yardim">İsim altında haftanın toplam saati. En sağda: haftanın fazla mesaisi ve ayın toplam fazla mesaisi${sb.fmDonem==='hafta'?` (fazla mesai dönemi ${fmDonemYazi(akF,sb)})`:''}. Hesap: çalışılan − (çalışılan gün × ${fmt(sb.gunluk)} sa); izin günü kullanılmadan 7 gün çalışılan haftada − ${fmt(sb.haftalik)} sa. Başka şubede çalıştığı günler bu şubede hesaba girmez; o günün mesaisi çalıştığı şubede.</p>
   <p class="note yardim"><b>Saatler:</b> yarım saatlik seçilir. İleri tarihli günlerde ${saatYaz(saatAraligi(sb).n0)} – ${saatYaz(saatAraligi(sb).n1)} arası; bugün ve geçmiş günlerde düzeltme için iki uçta birer saat daha (erken çağrılma, geç çıkış).</p>`;
  if(UI.MOD)h+=`<div class="modbar"><span>${UI.MOD.tip==='hucre'?`<b>${esc(degerYazi(UI.MOD.val))}</b> kopyalandı. Yapıştırmak için hücrelere dokunun.`:`<b>${esc(kisaAd((S.personel.find(p=>p.id===UI.MOD.pid)||{}).ad))}</b> haftası kopyalandı. Hedef kişinin adına dokunun.`}</span><button class="btn small primary" id="modB">Bitti</button></div>`;
  view(h,()=>{bindWeek();gridBagla();selCiz();const mb=byId('modB');if(mb)mb.onclick=()=>{UI.MOD=null;render();};});}
function degerYazi(v){return isShift(v)?v.replace('-',' – '):v&&KOD[v]?KOD[v].ad:'Boş';}
function bindWeek(){byId('prevW').onclick=()=>{S.hafta=ymd(addDays(parse(S.hafta),-7));UI.SEL=null;render();};byId('nextW').onclick=()=>{S.hafta=ymd(addDays(parse(S.hafta),7));UI.SEL=null;render();};
  byId('thisW').onclick=()=>{S.hafta=mondayOf(today());render();};const on=(id,f)=>{const e=byId(id);if(e)e.onclick=f;};on('copyW',kopyala);on('undoB',geriAl);on('shareB',paylas);haftaIslemBagla(S.hafta);}
function gridBagla(){const G=byId('grid');if(!G)return;
  G.oncontextmenu=e=>{if(e.target.closest('.cell,.nm'))e.preventDefault();};
  G.onpointerdown=e=>{ptrTip=e.pointerType||'mouse';const c=e.target.closest('.cell[data-r]');const n=e.target.closest('[data-pe]');
    if(ptrTip==='mouse'){if(c&&e.button===0){e.preventDefault();const r=+c.dataset.r,cc=+c.dataset.c;
        if(e.shiftKey&&UI.SEL)Object.assign(UI.SEL,{r1:r,c1:cc});else UI.SEL={wid:S.hafta,r0:r,c0:cc,r1:r,c1:cc};suruk=true;selCiz();}return;}
    lpOldu=false;clearTimeout(lpT);lpX=e.clientX;lpY=e.clientY;
    lpT=setTimeout(()=>{lpOldu=true;if(navigator.vibrate)try{navigator.vibrate(15);}catch(_){}
      if(c&&c.dataset.p)hucreKopyaMod(c.dataset.p,+c.dataset.i);else if(n)satirKopyaMod(n.dataset.pe);},480);};
  G.onpointermove=e=>{if(lpT&&(Math.abs(e.clientX-lpX)>8||Math.abs(e.clientY-lpY)>8))clearTimeout(lpT);
    if(suruk&&ptrTip==='mouse'){const c=document.elementFromPoint(e.clientX,e.clientY);const cc=c&&c.closest&&c.closest('.cell[data-r]');if(cc&&UI.SEL){const r=+cc.dataset.r,k=+cc.dataset.c;if(r!==UI.SEL.r1||k!==UI.SEL.c1){UI.SEL.r1=r;UI.SEL.c1=k;selCiz();}}}};
  G.onpointerup=G.onpointercancel=()=>clearTimeout(lpT);
  G.querySelectorAll('button.cell').forEach(b=>{b.onclick=()=>{if(lpOldu){lpOldu=false;return;}if(ptrTip==='mouse')return;
      if(UI.MOD&&UI.MOD.tip==='hucre'){setCell(b.dataset.p,S.hafta,+b.dataset.i,UI.MOD.val);return;}hucre(b.dataset.p,+b.dataset.i);};
    b.ondblclick=()=>{if(ptrTip==='mouse')hucre(b.dataset.p,+b.dataset.i);};});
  G.querySelectorAll('button[data-pe]').forEach(b=>b.onclick=()=>{if(lpOldu){lpOldu=false;return;}if(UI.MOD&&UI.MOD.tip==='satir'){satirYapistir(b.dataset.pe);return;}isimMenu(b.dataset.pe);});
  G.querySelectorAll('.gadd').forEach(b=>b.onclick=()=>kisiSec(b.dataset.g));}
document.addEventListener('pointerup',()=>{suruk=false;});
function selAralik(){if(!UI.SEL)return null;return{r0:Math.min(UI.SEL.r0,UI.SEL.r1),r1:Math.max(UI.SEL.r0,UI.SEL.r1),c0:Math.min(UI.SEL.c0,UI.SEL.c1),c1:Math.max(UI.SEL.c0,UI.SEL.c1)};}
function selCiz(){document.querySelectorAll('.cell.sel').forEach(x=>x.classList.remove('sel'));const A=selAralik();if(!A||UI.SEL.wid!==S.hafta)return;
  document.querySelectorAll('.cell[data-r]').forEach(x=>{const r=+x.dataset.r,c=+x.dataset.c;if(r>=A.r0&&r<=A.r1&&c>=A.c0&&c<=A.c1)x.classList.add('sel');});}
function secimAktif(){if(S.tab!=='cizelge'||!UI.SEL||UI.SEL.wid!==S.hafta||byId('sheetRoot').innerHTML)return false;const a=document.activeElement;return !(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName));}
const KOD_EXCEL={HT:'HAF. İZİN',UI:'ÜCR. İZİN',YI:'YILLIK İZİN',R:'RAPOR',B:'BAYRAM',D:'DİĞER',CG:'ÇALIŞMA GÜNÜ DEĞİL'};
function secimTSV(){const A=selAralik();const out=[];for(let r=A.r0;r<=A.r1;r++){const row=[];for(let c=A.c0;c<=A.c1;c++){const v=cellOf(rowPid(ROWS[r],c),S.hafta,c);
  if(isShift(v))row.push(...v.split('-'));else if(v&&KOD[v])row.push(KOD_EXCEL[v],'');else row.push('','');}out.push(row.join('\t'));}return out.join('\r\n');}
function hucreCoz(a,b){a=String(a??'').trim();b=String(b??'').trim();if(!a&&!b)return null;const ust=a.toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');
  if(XKOD[ust])return XKOD[ust];const kn=Object.keys(KOD).find(k=>KOD[k].ad.toLocaleUpperCase('tr-TR')===ust);if(kn)return kn;
  let m=a.match(/^(\d{1,2}[:.]?\d{0,2})\s*[-–]\s*(\d{1,2}[:.]?\d{0,2})$/);if(m&&!b){const x=normTime(m[1]),y=normTime(m[2]);return x&&y?x+'-'+y:undefined;}
  const x=normTime(a),y=normTime(b);return x&&y?x+'-'+y:undefined;}
function metinMatris(t){let L=String(t||'').replace(/\r/g,'').split('\n');while(L.length&&!L[L.length-1].trim())L.pop();
  return L.map(l=>{let c=l.split('\t');if(c.length===1)return[hucreCoz(c[0],'')];
    if(c.length%2===1){const ilk=hucreCoz(c[0],c[1]);if(ilk===undefined)c=c.slice(1);else c=c.concat(['']);}
    const o=[];for(let j=0;j<c.length;j+=2)o.push(hucreCoz(c[j],c[j+1]));return o;});}
function matrisUygula(M){const A=selAralik();if(!A||!M.length)return;const wid=S.hafta;const ds=weekDays(wid);
  const cells=JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{}));let n=0;
  const yaz=(r,c,v)=>{if(v===undefined||r<0||r>=ROWS.length||c<0||c>6)return;const pid=rowPid(ROWS[r],c);const p=S.personel.find(x=>x.id===pid);if(!p||!employed(p,ds[c])||!cizelgeYazabilir(ds[c]))return;
    cells[pid]=cells[pid]||{};cells[pid][String(c)]=v;n++;};
  if(M.length===1&&M[0].length===1&&(A.r1>A.r0||A.c1>A.c0)){for(let r=A.r0;r<=A.r1;r++)for(let c=A.c0;c<=A.c1;c++)yaz(r,c,M[0][0]);}
  else M.forEach((row,i)=>row.forEach((v,j)=>yaz(A.r0+i,A.c0+j,v)));
  if(!n){toast('Yapıştırılacak uygun hücre yok.');return;}const red=setWeek(wid,cells,kadroOf(wid).ids);toast(`${n-red} hücre yapıştırıldı.${red?` ${red} hücre yazılmadı: ${RED_NEDEN}.`:''}`);}
function secimTemizle(){matrisUygula([[null]]);}
document.addEventListener('copy',e=>{if(!secimAktif())return;e.clipboardData.setData('text/plain',secimTSV());e.preventDefault();const A=selAralik();toast(`${(A.r1-A.r0+1)*(A.c1-A.c0+1)} hücre kopyalandı.`);});
document.addEventListener('cut',e=>{if(!secimAktif())return;e.clipboardData.setData('text/plain',secimTSV());e.preventDefault();secimTemizle();});
document.addEventListener('paste',e=>{if(!secimAktif())return;e.preventDefault();matrisUygula(metinMatris(e.clipboardData.getData('text/plain')));});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(UI.MOD||UI.SEL)&&!byId('sheetRoot').innerHTML){UI.MOD=null;UI.SEL=null;render();return;}if(!secimAktif())return;const A=selAralik();
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();secimTemizle();return;}
  if((e.key==='Enter'||e.key==='F2')&&ROWS[UI.SEL.r0]!=null){e.preventDefault();hucre(rowPid(ROWS[UI.SEL.r0],UI.SEL.c0),UI.SEL.c0);return;}
  if(/^[0-9]$/.test(e.key)&&!e.ctrlKey&&!e.metaKey&&ROWS[UI.SEL.r0]!=null){e.preventDefault();hucre(rowPid(ROWS[UI.SEL.r0],UI.SEL.c0),UI.SEL.c0,{ilk:e.key});return;}
  const yon={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];if(yon){e.preventDefault();const r=Math.max(0,Math.min(ROWS.length-1,UI.SEL.r1+yon[0])),c=Math.max(0,Math.min(6,UI.SEL.c1+yon[1]));
    if(e.shiftKey)Object.assign(UI.SEL,{r1:r,c1:c});else UI.SEL={wid:S.hafta,r0:r,c0:c,r1:r,c1:c};selCiz();}});
function hucreKopyaMod(pid,i){const v=cellOf(pid,S.hafta,i);if(!v){toast('Boş hücre kopyalanamaz.');return;}UI.MOD={tip:'hucre',val:v};render();}
function satirKopyaMod(pid){const c=(S.haftalar[S.hafta]&&S.haftalar[S.hafta].cells&&S.haftalar[S.hafta].cells[pid])||{};if(!Object.values(c).some(v=>v)){toast('Bu kişinin haftası boş.');return;}UI.MOD={tip:'satir',pid,gun:{...c}};render();}
function satirYapistir(pid){if(pid===UI.MOD.pid)return;const wid=S.hafta;const ds=weekDays(wid);const p=S.personel.find(x=>x.id===pid);const cells=JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{}));
  cells[pid]=cells[pid]||{};ds.forEach((d,i)=>{if(employed(p,d)&&cizelgeYazabilir(d))cells[pid][String(i)]=UI.MOD.gun[String(i)]??null;});const red=setWeek(wid,cells,kadroOf(wid).ids);toast(`${kisaAd(p.ad)} için yapıştırıldı.${red?` ${red} gün yazılmadı: ${RED_NEDEN}.`:''}`);}
function hucre(pid,i,opt={}){if(kilitEngel())return;const p=S.personel.find(x=>x.id===pid);if(!p)return;const wid=S.hafta;const d=weekDays(wid)[i];const val=cellOf(pid,wid,i);const sb=sube();let[a,b]=isShift(val)?val.split('-'):['',''];
  const pay=duzeltmeGunu(d);const L=saatListesi(sb,pay);const o=cokSubeli(p)?digerGunler(p,d):null;
  // Listede olmayan eski bir saat (ör. 11:15) seçili kalsın ama düzeltilmesi istensin.
  const secenek=(sec,yok)=>{const grup=(t,f)=>{const x=L.filter(f);return x.length?`<optgroup label="${t}">${x.map(q=>`<option value="${q.s}" ${q.s===sec?'selected':''}>${q.s}${q.pay==='erken'?' · erken':q.pay==='gec'?' · geç':''}</option>`).join('')}</optgroup>`:'';};
    const disarda=sec&&!L.some(q=>q.s===sec)?`<option value="${esc(sec)}" selected>${esc(sec)} · listede yok, düzeltin</option>`:'';
    return `<option value="" ${sec?'':'selected'}>${yok}</option>${disarda}${pay?grup('Erken çağrılma',q=>q.pay==='erken'):''}${grup('Normal saatler',q=>!q.pay)}${pay?grup('Geç çıkış',q=>q.pay==='gec'):''}`;};
  openSheet(`<h2>${esc(p.ad)}</h2><div class="sub">${GUNU[i]}, ${d.getDate()} ${AY[d.getMonth()]}${pay?' · düzeltme yapılabilir':' · plan'}</div>
   ${o?`<div class="confirm">${esc(subeAdi(Object.keys(o)[0]))} şubesinde bu gün ${esc(degerYazi(Object.values(o)[0]))} yazılı. Bir kişi aynı gün tek şubede çalışır.</div>`:''}
   <span class="lbl">Vardiya saati</span>
   <div class="times tsec"><label><small>Giriş</small><select id="tA" aria-label="Giriş saati">${secenek(a,'Seçin')}</select></label><span>–</span><label><small>Çıkış</small><select id="tB" aria-label="Çıkış saati">${secenek(b,'Seçin')}</select></label></div>
   <div class="meta" id="tMeta"></div><div class="row2"><button class="btn primary grow" id="tSave">Kaydet</button><button class="btn grow" id="tNext">Kaydet, sonraki gün</button></div>
   <p class="note" style="margin:6px 0 0">${pay?`Bugün ve geçmiş günlerde ${saatYaz(saatAraligi(sb).n0-1)} – ${saatYaz(saatAraligi(sb).n1+1)} arası seçilebilir; turuncu işaretli saatler erken çağrılma / geç çıkıştır.`:`Plan: ${saatYaz(saatAraligi(sb).n0)} – ${saatYaz(saatAraligi(sb).n1)} arası. Erken çağrılma ve geç çıkış, gün geldiğinde düzeltme olarak yazılır.`}</p>
   <span class="lbl">Durum</span><div class="codes">${[...KOD_SIRA.filter(k=>(k!=='B'&&k!=='D')||val===k),...(p.sekil==='Part'||val==='CG'?['CG']:[])].map(k=>`<button data-k="${k}" class="${val===k?'sel':''}" ${kodStil(k)}>${KOD[k].ad}</button>`).join('')}</div>
   <div class="codes" style="margin-top:8px;grid-template-columns:1fr"><button class="clear" data-k="">Hücreyi temizle</button></div>`,sh=>{
   const A=byId('tA'),B=byId('tB'),M=byId('tMeta');
   const bitisSecenek=()=>{const x=A.value;if(!x)return;const ar=saatAraligi(sb);const azami=Math.max(16,ar.n1-ar.n0+(pay?2:0));const ta=saatKonum(x,sb);[...B.options].forEach(op=>{if(!op.value)return;let tb=saatKonum(op.value,sb);if(tb<=ta)tb+=24;op.disabled=tb<=ta||tb-ta>azami;});if(B.selectedOptions[0]&&B.selectedOptions[0].disabled)B.value='';};
   const upd=()=>{const x=A.value,y=B.value;if(x&&y){const v=x+'-'+y;const k=shiftKind(v,sb);const vk=vardiyaKontrol(v,sb,d);
       M.innerHTML=vk.ok?`<span>${fmt(shiftHours(v))} saat</span><span class="chip ${k.o||k.k?'warn':'mut'}">${k.o&&k.k?'Açılış + kapanış':k.o?'Açılış vardiyası':k.k?'Kapanış vardiyası':'Ara vardiya'}</span>${vk.pay?'<span class="chip warn">Erken / geç</span>':''}`:`<span class="chip bad">${esc(vk.neden)}</span>`;}
     else M.innerHTML='';};
   A.onchange=()=>{bitisSecenek();upd();if(!B.value)B.focus();};B.onchange=upd;bitisSecenek();
   const kaydet=async next=>{const x=A.value,y=B.value;if(!x||!y){toast('Giriş ve çıkış saatini seçin.');(x?B:A).focus();return;}const v=x+'-'+y;const vk=vardiyaKontrol(v,sb,d);if(!vk.ok){toast(vk.neden);return;}
     if(!hucreKontrol(p,wid,i,v))return;setCell(pid,wid,i,v);if(next)sonraki(pid,i);else closeSheet();};
   byId('tSave').onclick=()=>kaydet(false);byId('tNext').onclick=()=>kaydet(true);
   sh.querySelectorAll('.codes button').forEach(bt=>bt.onclick=()=>{const k=bt.dataset.k||null;if(k&&!hucreKontrol(p,wid,i,k))return;setCell(pid,wid,i,k);closeSheet();});upd();});}
function sonraki(pid,i){const p=S.personel.find(x=>x.id===pid);const ds=weekDays(S.hafta);let j=i+1;while(j<7&&(!employed(p,ds[j])||!cizelgeYazabilir(ds[j])))j++;if(j<7)hucre(pid,j);else{closeSheet();toast('Haftanın son günü kaydedildi.');}}
function geriAl(){const u=undo.pop();if(!u)return;setWeek(u.wid,u.cells,u.kadro,false);S.hafta=u.wid;toast('Son değişiklik geri alındı.');}
function kopyala(){const wid=S.hafta;const prev=ymd(addDays(parse(wid),-7));const pk=kadroDoc(prev);const src=(S.haftalar[prev]&&S.haftalar[prev].cells)||{};
  if(!pk||!pk.length){toast(`${rangeLabel(prev)} haftasında kopyalanacak liste yok.`);return;}
  const dolu=Object.values((S.haftalar[wid]&&S.haftalar[wid].cells)||{}).some(o=>o&&Object.values(o).some(v=>v));
  openSheet(`<h2>Geçen haftayı kopyala</h2><div class="sub">${rangeLabel(prev)} haftasının listesi ve saatleri ${rangeLabel(wid)} haftasına yazılacak.</div>${dolu?'<div class="confirm">Bu haftada girilmiş vardiyalar var, kopyalama üzerine yazar. "Geri al" ile dönebilirsiniz.</div>':''}
   <div class="row2"><button class="btn grow" id="cNo">Vazgeç</button><button class="btn primary grow" id="cYes">Kopyala</button></div>`,()=>{byId('cNo').onclick=closeSheet;
   byId('cYes').onclick=()=>{const ds=weekDays(wid);const out=JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{}));const kad=kadroOf(wid).ids.slice();
     pk.forEach(pid=>{const p=S.personel.find(x=>x.id===pid);if(!p||subedenCikti(p)||!ds.some(d=>employed(p,d)))return;if(!kad.includes(pid))kad.push(pid);const s=src[pid];if(!s)return;out[pid]=out[pid]||{};
       ds.forEach((d,i)=>{if(employed(p,d)&&cizelgeYazabilir(d)&&s[String(i)]!=null)out[pid][String(i)]=s[String(i)];});});
     const red=setWeek(wid,out,kad);closeSheet();toast(`Geçen haftanın listesi ve saatleri kopyalandı.${red?` ${red} hücre yazılmadı: ${RED_NEDEN}.`:''}`);};});}
function kadroEkle(pid){const wid=S.hafta;const kad=kadroOf(wid).ids.slice();if(kad.includes(pid))return;kad.push(pid);setWeek(wid,JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{})),kad);}
function kadroCikar(pid){const wid=S.hafta;const kad=kadroOf(wid).ids.filter(x=>x!==pid);const cells=JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{}));delete cells[pid];setWeek(wid,cells,kad);}
function kisiSec(g){const wid=S.hafta;const ds=weekDays(wid);const var_=new Set(kadroOf(wid).ids);
  const L=subePersoneli().filter(p=>(p.grup||'K')===g&&!var_.has(p.id)&&ds.some(d=>employed(p,d))).sort((a,b)=>String(a.ad).localeCompare(String(b.ad),'tr'));
  const satir=p=>`<button class="row" data-id="${esc(p.id)}" data-ara="${esc(isimAnahtar(p.ad))}"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(gorevTahmin(p))}</span></div></button>`;
  openSheet(`<h2>${GRUP[g]} ekle · ${rangeLabel(wid)}</h2><div class="sub">${esc(sube().ad)} personel listesinden seçin. Başka şubeden gelen biri listede yoksa "Yeni personel oluştur" ile bu şubenin listesine ekleyin.</div>
   <label class="field"><span>Ara</span><input id="kAra" autocomplete="off" placeholder="İsim yazın"></label>
   <div class="card list" id="kList" style="margin-top:10px;max-height:46vh;overflow:auto">${L.map(satir).join('')||'<div class="note" style="padding:12px">Bu bölümde eklenebilecek kişi yok.</div>'}</div>
   <div class="row2"><button class="btn grow" id="kNo">Kapat</button><button class="btn grow" id="kYeni">+ Yeni personel oluştur</button></div>`,sh=>{
   byId('kNo').onclick=closeSheet;byId('kYeni').onclick=()=>personelPanel(null,g,{sonra:pid=>kadroEkle(pid)});
   byId('kAra').oninput=e=>{const q=isimAnahtar(e.target.value);sh.querySelectorAll('#kList .row').forEach(r=>r.hidden=!!q&&!r.dataset.ara.includes(q));};
   sh.querySelectorAll('#kList .row').forEach(r=>r.onclick=()=>{kadroEkle(r.dataset.id);r.remove();toast(`${kisaAd(S.personel.find(p=>p.id===r.dataset.id).ad)} bu haftaya eklendi.`);});});}
function kadroTasi(pid,yon){const wid=S.hafta;const ids=kadroOf(wid).ids.slice();const L=cizelgeKisileri(wid);const p=L.find(x=>x.id===pid);if(!p)return false;
  const grup=L.filter(x=>(x.grup||'K')===(p.grup||'K'));const k=grup.findIndex(x=>x.id===pid);const hedef=grup[k+yon];if(!hedef)return false;
  const a=ids.indexOf(pid),b=ids.indexOf(hedef.id);[ids[a],ids[b]]=[ids[b],ids[a]];
  setWeek(wid,JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{})),ids);return true;}
function isimMenu(pid){const p=S.personel.find(x=>x.id===pid);if(!p)return;const dolu=Object.values(((S.haftalar[S.hafta]||{}).cells||{})[pid]||{}).some(v=>v);
  const L=cizelgeKisileri(S.hafta).filter(x=>(x.grup||'K')===(p.grup||'K'));const k=L.findIndex(x=>x.id===pid);
  openSheet(`<h2>${esc(p.ad)}</h2><div class="sub">${rangeLabel(S.hafta)} · ${GRUP[p.grup||'K']} bölümünde ${k+1}. sırada</div>
   <div class="row2" style="margin-top:4px"><button class="btn grow" id="iUp" ${k<=0?'disabled':''}>▲ Yukarı taşı</button><button class="btn grow" id="iDn" ${k>=L.length-1?'disabled':''}>▼ Aşağı taşı</button></div>
   <div class="card list" style="margin-top:12px">
   <button class="row" id="iKop"><div class="m"><b>Haftasını kopyala</b><span>Sonra hedef kişinin adına dokunarak yapıştırın</span></div></button>
   <button class="row" id="iCik"><div class="m"><b style="color:var(--bad)">Bu haftadan çıkar</b><span>${dolu?'Bu haftaki saatleri de silinir. ':''}Personel listesinde kalır.</span></div></button></div>
   <p class="note">Görev, SGK şubesi ve tarihler Personel sekmesinden değiştirilir.</p>`,()=>{
   byId('iUp').onclick=()=>{if(kadroTasi(pid,-1))isimMenu(pid);};byId('iDn').onclick=()=>{if(kadroTasi(pid,1))isimMenu(pid);};
   byId('iKop').onclick=()=>{closeSheet();satirKopyaMod(pid);};
   const c=byId('iCik');c.onclick=()=>{if(dolu&&!c.dataset.ok){c.dataset.ok='1';c.querySelector('b').textContent='Çıkarmayı onayla';return;}closeSheet();kadroCikar(pid);toast(`${kisaAd(p.ad)} bu haftadan çıkarıldı.`);};});}

