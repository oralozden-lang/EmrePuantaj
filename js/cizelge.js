// cizelge.js — app.js (v180) satırları 740-780. Otomatik bölündü; davranış değişmedi.
import { AYK, BOS_RENK, GRUP, GRUP_SIRA, GUN, GUNU, KOD, KOD_RENK, KOD_SIRA, kesinAy, kodStil, subeAdi } from './sabitler.js';
import { S, undo } from './durum.js';
import { esc, fmt, gosterAy, isShift, kisaAd, mondayOf, rangeLabel, sg, shiftKind, today, weekDays, ymd } from './yardimci.js';
import { saatAraligi, saatYaz, vardiyaKontrol } from './saat.js';
import { isIsveren, isSube, puantajYetki } from './rol.js';
import { cellOf, isEsnaf, locked } from './hesap.js';
import { fmAyi, fmDonemYazi } from './fm-donem.js';
import { GUN_HATA_YAZI, bosSayilir, cokSubeli, digerGunler, gunHataVar } from './cok-sube.js';
import { ayKadarS, cizelgeKisileri, gunKaydiP, haftaHesapS, kadroOf, kisaSubeAd } from './kadro.js';
import { haftaAyari, haftaDurumu } from './hucre-yazma.js';
import { byId, render, view } from './cerceve.js';
import { bindWeek, gridBagla, selCiz } from './cizelge-secim.js';
import { haftaBandi, haftaIslemleri, kapaliHaftaKart } from './hafta-kapatma.js';
import { adBuyuk, isimsizMi } from './isim-esle.js';

/* ================= Çizelge ================= */
export let ROWS=[];
export const UI_cizelge={SEL:null,MOD:null,ptrTip:'mouse',suruk:false,lpT:null,lpOldu:false,lpX:0,lpY:0};
export function cizelgeYazabilir(d){return !kesinAy(d)&&haftaDurumu(mondayOf(d))==='acik'&&(!locked(d)||puantajYetki());}// kapalı / onaylı haftada önce "Kilidi aç" gerekir
export function renderCizelge(){const wid=S.hafta;const sb=haftaAyari(wid);const ds=weekDays(wid);const td=ymd(today());const ak=gosterAy(wid);
  const K=kadroOf(wid);const kisiler=cizelgeKisileri(wid);ROWS=kisiler.map(p=>p.id);if(UI_cizelge.SEL&&UI_cizelge.SEL.wid!==wid)UI_cizelge.SEL=null;
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
      h+=`<button class="nm ${UI_cizelge.MOD&&UI_cizelge.MOD.tip==='satir'&&UI_cizelge.MOD.pid===p.id?'kaynak':''}" data-pe="${esc(p.id)}"><b title="${esc(p.ad)}${isimsizMi(p)&&p.excelAd?' · Excel: '+esc(p.excelAd):''}"><span class="adU">${esc(adBuyuk(p.ad))}</span><span class="adK">${esc(adBuyuk(kisaAd(p.ad)))}</span></b><span>${alt}</span><em class="nmfm">${isEsnaf(p)||p.sekil==='Part'?`${ak3} ${fmH[1]}`:`hafta <i>${fmH[0]}</i> · ${ak3} <i>${fmH[1]}</i>`}</em><em class="nmfmK">${isEsnaf(p)||p.sekil==='Part'?`<i class="fmp sa" title="Bu hafta çalışılan saat">${fmt(wk.h)} sa</i>`:`<i class="fmp ${wk.fm>0.004?'art':wk.fm<-0.004?'eks':'sif'}" title="Bu haftanın fazla mesaisi">${sg(wk.fm)}</i>`}</em></button>`;
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
  if(UI_cizelge.MOD)h+=`<div class="modbar"><span>${UI_cizelge.MOD.tip==='hucre'?`<b>${esc(degerYazi(UI_cizelge.MOD.val))}</b> kopyalandı. Yapıştırmak için hücrelere dokunun.`:`<b>${esc(kisaAd((S.personel.find(p=>p.id===UI_cizelge.MOD.pid)||{}).ad))}</b> haftası kopyalandı. Hedef kişinin adına dokunun.`}</span><button class="btn small primary" id="modB">Bitti</button></div>`;
  view(h,()=>{bindWeek();gridBagla();selCiz();const mb=byId('modB');if(mb)mb.onclick=()=>{UI_cizelge.MOD=null;render();};});}
export function degerYazi(v){return isShift(v)?v.replace('-',' – '):v&&KOD[v]?KOD[v].ad:'Boş';}
