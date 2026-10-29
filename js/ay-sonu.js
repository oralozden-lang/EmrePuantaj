// ay-sonu.js — app.js (v180) satırları 1369-1432. Otomatik bölündü; davranış değişmedi.
import { doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AYK, BASLANGIC_AY, DURUM, GRUP, GUN, KOD, aktifAy, ayGit } from './sabitler.js';
import { arka, db, setDoc, writeBatch } from './firebase.js';
import { S, tryLS } from './durum.js';
import { addDays, ayAdi, ayKaydir, ayKey, bas, esc, fmt, isShift, kisaAd, mondayOf, parse, rangeLabel, sg, today, trTarih, weekDays, ymd } from './yardimci.js';
import { aktifAyda, ayHesap, cellOf, employed, fmDonemYazi, fmHaftalari, fmSecici, fmSeciciBagla, isEsnaf, sirala, sube, weekHasEntry } from './hesap.js';
import { ayKadroIds, ayKadrosu, bosSayilir, subeOzeti } from './cok-sube.js';
import { sirayla, weekRef } from './yazma.js';
import { byId, render, view } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { subePersoneli } from './personel.js';
import { trBuyukBas } from './cikti.js';

/* ================= Ay sonu (şube müdürü) ================= */
// Ay sonu kontrol listesi
const YUKSEK_FM=60;
// Hiç açılmamış hafta (ör. sistem 3 Ağustos'ta başlarken 27 Tem – 2 Ağu): o haftaya düşen ay günleri de boş gün sayılır, doldurulmadan ay kapatılamaz.
// Şube müdürü kapalı haftaları yüklemez; onlar haftaDurum'da kayıtlı olduğu için "hiç yok" sayılmaz.
const haftaHicYok=wid=>!S.haftalar[wid]&&!((S.haftaDurum&&S.haftaDurum.w)||{})[wid];
function ayKontrolleri(ak,R,sb,d){const[y,m]=ak.split('-').map(Number);const ilk=new Date(y,m-1,1),son=new Date(y,m,0);const teyit=d.teyit||{};
  const K={bos:[],yedi:[],eksi:[],yuksek:[],izin:[],gc:[],yok:[]};
  R.forEach(({p,a})=>{for(let dd=new Date(ilk);dd<=son;dd=addDays(dd,1)){if(!employed(p,dd))continue;const wid=mondayOf(dd),i=(dd.getDay()+6)%7;const v=cellOf(p.id,wid,i);if((v==null||v==='')&&(weekHasEntry(p.id,wid)||(!isEsnaf(p)&&haftaHicYok(wid)))&&bosSayilir(p,dd))K.bos.push({p,wid,d:new Date(dd)});}
    for(let w=parse(mondayOf(ilk));w<=son;w=addDays(w,7)){const wid=ymd(w);const ds=weekDays(wid);if(ds.every((dd,i)=>employed(p,dd)&&isShift(cellOf(p.id,wid,i)))){const key=p.id+'_'+wid;const t7=(S.haftalar[wid]||{}).teyit7||{};K.yedi.push({p,wid,key,ok:!!t7[p.id]});}}
    if(!a.part&&!a.esnaf){if(a.fm<0)K.eksi.push({p,a});if(a.fm>YUKSEK_FM)K.yuksek.push({p,a});}
    const iz=['R','UI','YI','B'].filter(k=>a.kod[k]);if(iz.length)K.izin.push({p,a,iz});
    const ic=t=>t&&t.slice(0,7)===ak;if(ic(p.giris)||ic(p.cikis)||ic(p.baslama))K.gc.push({p});});
  const ids=ayKadroIds(ak);subePersoneli().filter(p=>p.anaSube===S.subeId&&aktifAyda(p,ak)&&!ids.has(p.id)&&!isEsnaf(p)).forEach(p=>K.yok.push({p}));
  return K;}
function ayKontrolHtml(K,ak,kilit,kon={}){const tik=(key,t)=>`<label class="kchip ${kon[key]?'on':''}"><input type="checkbox" data-kon="${esc(key)}" ${kon[key]?'checked':''} ${kilit?'disabled':''}> ${t}</label>`;const gunY=dd=>`${dd.getDate()} ${AYK[dd.getMonth()]} ${GUN[(dd.getDay()+6)%7]}`;const ad=p=>esc(kisaAd(p.ad));
  const bolum=(cls,baslik,aciklama,ic)=>`<div class="kt ${cls}"><div class="kth"><b>${baslik}</b><span>${aciklama}</span></div><div class="kti">${ic}</div></div>`;
  const git=(wid,t)=>`<button class="kchip" data-git="${wid}">${t}</button>`;let h='';
  if(K.bos.length)h+=bolum('kirmizi',`Boş günler · ${K.bos.length}`,'Bu günler doldurulmadan ay kapatılamaz. Tıklayınca o haftanın çizelgesi açılır.',K.bos.map(x=>git(x.wid,`${ad(x.p)} · ${gunY(x.d)}`)).join(''));
  if(K.yedi.length)h+=bolum(K.yedi.every(x=>x.ok)?'yesil':'sari',`Haftalık izin kullanmadan 7 gün çalışanlar · ${K.yedi.length}`,'Doğruysa teyit edin. Teyit edilmeden ay kapatılamaz.',K.yedi.map(x=>`<label class="kchip ${x.ok?'on':''}"><input type="checkbox" data-teyit="${esc(x.key)}" ${x.ok?'checked':''} ${kilit?'disabled':''}> ${ad(x.p)} · ${rangeLabel(x.wid)}</label>`).join(''));
  const tamam=(L,f)=>L.every(x=>kon[f(x)]);
  if(K.eksi.length)h+=bolum(tamam(K.eksi,x=>'eksi_'+x.p.id)?'yesil':'sari',`Eksi fazla mesai · ${K.eksi.length}`,'Eksik çalışma mı, yanlış saat mi kontrol edip işaretleyin.',K.eksi.map(x=>tik('eksi_'+x.p.id,`${ad(x.p)} · ${sg(x.a.fm)} sa`)).join(''));
  if(K.yuksek.length)h+=bolum(tamam(K.yuksek,x=>'yuksek_'+x.p.id)?'yesil':'sari',`Çok yüksek fazla mesai (${YUKSEK_FM} saatin üstü) · ${K.yuksek.length}`,'Saatlerin doğru girildiğini kontrol edip işaretleyin.',K.yuksek.map(x=>tik('yuksek_'+x.p.id,`${ad(x.p)} · ${sg(x.a.fm)} sa`)).join(''));
  if(K.izin.length)h+=bolum(tamam(K.izin,x=>'izin_'+x.p.id)?'yesil':'sari',`Rapor ve izinler · ${K.izin.length}`,'Rapor evrakı ve izin dilekçeleri tamamsa işaretleyin.',K.izin.map(x=>tik('izin_'+x.p.id,`${ad(x.p)} · ${x.iz.map(k=>`${x.a.kod[k]} ${KOD[k].ad.toLocaleLowerCase('tr-TR')}`).join(', ')}`)).join(''));
  if(K.gc.length)h+=bolum(tamam(K.gc,x=>'gc_'+x.p.id)?'yesil':'sari',`Ay içinde giren / çıkan · ${K.gc.length}`,'Tarihler doğruysa işaretleyin.',K.gc.map(({p})=>tik('gc_'+p.id,`${ad(p)} · ${[p.baslama&&p.baslama.slice(0,7)===ak?'deneme '+trTarih(p.baslama):'',p.giris&&p.giris.slice(0,7)===ak?'giriş '+trTarih(p.giris):'',p.cikis&&p.cikis.slice(0,7)===ak?'çıkış '+trTarih(p.cikis):''].filter(Boolean).join(' · ')}`)).join(''));
  if(K.yok.length)h+=bolum(tamam(K.yok,x=>'yok_'+x.p.id)?'yesil':'sari',`Bu ay çizelgede hiç görünmeyenler · ${K.yok.length}`,'Personel listesinde aktif ama çizelgeye eklenmemiş. Unutulmadıysa işaretleyin.',K.yok.map(({p})=>tik('yok_'+p.id,ad(p))).join(''));
  return h?`<div class="sec">Kontrol edilecekler · hepsi işaretlenmeden ay kapatılamaz</div><div class="card kcard">${h}</div>`:`<div class="banner ok">Kontrol edilecek bir şey yok.</div>`;}
export function renderAy(){const ak=aktifAy('ay');S.ay=ak;const sb=sube();const kisiler=sirala(ayKadrosu(ak));const R=kisiler.map(p=>({p,a:ayHesap(p,ak,sb)}));
  const d=S.aylar[ak]||{durum:'taslak'};const kilit=d.durum==='sube_onay'||d.durum==='bolge_onay';
  const topFm=R.reduce((s,x)=>s+x.a.fm,0),rap=R.reduce((s,x)=>s+(x.a.kod.R||0),0),ui=R.reduce((s,x)=>s+(x.a.kod.UI||0),0),bos=R.reduce((s,x)=>s+x.a.bos,0);
  let h=`<div class="weeknav"><button class="nav-arrow" id="prevM">‹</button><div class="ttl">${ayAdi(ak)}<small>${DURUM[d.durum].ad}</small></div><button class="nav-arrow" id="nextM">›</button></div>`;
  if(sb.fmDonem==='hafta'){const L=fmHaftalari(ak);const bitis=ymd(addDays(parse(L[L.length-1]),6));h+=`<div class="banner ${ymd(today())<=bitis&&!kilit?'':'ok'}">Fazla mesai dönemi: ${fmDonemYazi(ak,sb)}.${ymd(today())<=bitis&&!kilit?` Ayı ${trTarih(bitis)} çizelgesi bittikten sonra kapatın.`:''}</div>${fmSecici(ak,sb)}`;}
  if(d.durum==='geri')h+=`<div class="banner bad">Bölge müdürü geri gönderdi${d.not?': "'+esc(d.not)+'"':''}. Düzeltip ayı yeniden kapatın.</div>`;
  if(d.durum==='sube_onay')h+=`<div class="banner">Ay kapatıldı, bölge müdürünün onayı bekleniyor. Bu ayın günleri kilitli.</div>`;
  if(d.durum==='bolge_onay')h+=`<div class="banner ok">Bölge müdürü onayladı. Puantaj işverene gönderildi.</div>`;
  h+=`<div class="kpis"><div class="kpi"><span>Toplam fazla mesai</span><b>${fmt(topFm)} sa</b></div><div class="kpi"><span>Çalışan</span><b>${R.length}</b></div><div class="kpi"><span>Rapor / Ücr. izin</span><b>${rap} / ${ui} gün</b></div><div class="kpi"><span>Boş gün</span><b style="color:${bos?'var(--warn)':'var(--ok)'}">${bos?bos+' gün':'Yok'}</b></div></div>`;
  const K=ayKontrolleri(ak,R,sb,d);const kon=d.kontrol||{};
  const isaretsiz=[...K.eksi.map(x=>'eksi_'+x.p.id),...K.yuksek.map(x=>'yuksek_'+x.p.id),...K.izin.map(x=>'izin_'+x.p.id),...K.gc.map(x=>'gc_'+x.p.id),...K.yok.map(x=>'yok_'+x.p.id)].filter(k=>!kon[k]).length;
  const onceki=ayKaydir(ak,-1);const oncekiAcik=onceki>=BASLANGIC_AY&&!['sube_onay','bolge_onay'].includes((S.aylar[onceki]||{}).durum);
  const engel=oncekiAcik?`${ayAdi(onceki)} kapatılmadan`:K.bos.length?`${K.bos.length} boş gün doldurulmadan`:K.yedi.some(x=>!x.ok)?`7 gün çalışılan haftalar teyit edilmeden`:isaretsiz?`Kontrol edilecekler listesinde ${isaretsiz} madde işaretlenmeden`:'';
  if(R.length)h+=ayKontrolHtml(K,ak,kilit,kon);
  let son=null;R.forEach(({p,a})=>{const g=p.grup||'K';if(g!==son){if(son)h+='</div>';son=g;h+=`<div class="sec">${GRUP[g]}</div><div class="card list">`;}
    const tags=['R','UI','YI','B'].filter(k=>a.kod[k]).map(k=>`<span class="tag">${a.kod[k]} ${KOD[k].ad.toLocaleLowerCase('tr-TR')}</span>`).join('')+(a.bos?`<span class="tag warn">${a.bos} boş gün</span>`:'');
    const sag=a.esnaf?`<b>${fmt(a.h)} sa</b><span>esnaf</span>`:a.part?`<b>${fmt(a.h)} sa</b><span>part</span>`:`<b>${sg(a.fm)} sa</b><span>${fmt(a.h)} sa çalıştı</span>`;
    h+=`<div class="row"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(p.gorev||GRUP[g])} · ${p.sekil==='Part'?`${a.gun} gün çalıştı`:`${a.bordroGun} gün${a.gun!==a.bordroGun?` <em style="font-style:normal;color:var(--mut)">(${a.gun} gün çalıştı)</em>`:''}`}</span>${tags?`<div class="tags">${tags}</div>`:''}</div><div class="r">${sag}</div></div>`;});
  if(son)h+='</div>';if(!R.length)h+=`<div class="empty-state"><b>Bu ay için çizelge yok</b></div>`;
  h+=`<div style="margin-top:16px">${d.durum==='sube_onay'?'<button class="btn" style="width:100%" id="cekB">Kapatmayı geri çek</button>':d.durum==='bolge_onay'?'':(engel?`<button class="btn primary" style="width:100%" disabled>Ayı kapat → bölge müdürüne gönder</button><p class="note" style="color:var(--bad);font-weight:600">${engel} ay kapatılamaz.</p>`:`<button class="btn primary" style="width:100%" id="kapB">Ayı kapat → bölge müdürüne gönder</button>`)}</div>
   <p class="note">Ayı kapatınca bu ayın çalışma günleri, fazla mesaisi, rapor ve izinleri bölge müdürünün puantaj ekranına düşer. Bölge müdürü onaylayınca puantaj işverene hazır olur.</p>`;
  view(h,()=>{byId('prevM').onclick=()=>ayGit(ak,-1);byId('nextM').onclick=()=>ayGit(ak,1);fmSeciciBagla(ak);
    document.querySelectorAll('[data-git]').forEach(b=>b.onclick=()=>{S.hafta=b.dataset.git;S.tab='cizelge';tryLS('pm.tab','cizelge');render();window.scrollTo(0,0);});
    // Teyit, haftanın kaydına yazılır (ay kapanmadan değiştirilebilir)
    document.querySelectorAll('[data-teyit]').forEach(c=>c.onchange=()=>{const k=c.dataset.teyit;const i=k.lastIndexOf('_');const pid=k.slice(0,i),wid=k.slice(i+1);
      const w0=S.haftalar[wid]||{};S.haftalar[wid]={...w0,teyit7:{...(w0.teyit7||{}),[pid]:c.checked}};
      {const sid=S.subeId;sirayla(sid+'|'+wid,()=>{arka(setDoc(weekRef(wid,sid),{hafta:wid,ay2:ayKey(addDays(parse(wid),6)),teyit7:{[pid]:c.checked}},{merge:true}));});}render();});
    document.querySelectorAll('[data-kon]').forEach(c=>c.onchange=()=>{const k=c.dataset.kon;S.aylar[ak]={...d,kontrol:{...(d.kontrol||{}),[k]:c.checked}};
      {const sid=S.subeId;sirayla('ay'+ak,()=>{arka(setDoc(doc(db,'subeler',sid,'aylar',ak),{durum:d.durum||'taslak',kontrol:{[k]:c.checked}},{merge:true}));});}render();});
    const kb=byId('kapB');if(kb)kb.onclick=()=>openSheet(`<h2>Ayı kapat</h2><div class="sub">${esc(trBuyukBas(sb.ad))} şubesi · ${ayAdi(ak)}</div>
      <div class="confirm">Ay kapatılınca bu ayın çizelgesi şube tarafından değiştirilemez. Çalışma günleri, fazla mesai, rapor ve izinler bölge müdürünün onayına gönderilir.</div>
      <p class="note">${R.length} çalışan · toplam fazla mesai ${fmt(topFm)} sa · rapor ${rap} gün · ücretsiz izin ${ui} gün</p>
      <div class="row2"><button class="btn grow" id="kNo">Vazgeç</button><button class="btn primary grow" id="kOk">Evet, kapat ve gönder</button></div>`,()=>{byId('kNo').onclick=closeSheet;byId('kOk').onclick=()=>{closeSheet();
      const sid=S.subeId;sirayla('ay'+ak,async()=>{const b=writeBatch(db);b.set(doc(db,'subeler',sid,'aylar',ak),{durum:'sube_onay',kapatan:S.user.uid,kapatanAd:S.me.adSoyad||'',kapatma:new Date().toISOString(),not:''},{merge:true});
        b.set(doc(db,'ozetler',ak+'__'+sid),{sube:sid,ay:ak,kisiler:subeOzeti(ak,sid),guncellendi:new Date().toISOString()},{mergeFields:['sube','ay','kisiler','guncellendi']});await b.commit();});toast(`${ayAdi(ak)} kapatıldı, bölge müdürüne gönderildi.`);};});
    const cb=byId('cekB');if(cb)cb.onclick=()=>{{const sid=S.subeId;sirayla('ay'+ak,()=>{arka(setDoc(doc(db,'subeler',sid,'aylar',ak),{durum:'taslak'},{merge:true}));});}toast('Kapatma geri çekildi.');};});}

