// puantaj-islem.js — app.js (v180) satırları 1903-2019. Otomatik bölündü; davranış değişmedi.
import { arrayUnion, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { SGK_YOK, ozBirlestir, subeAdi, veriOzet, veriTur } from './sabitler.js';
import { KAYIT, arka, db, setDoc, writeBatch } from './firebase.js';
import { S, subs } from './durum.js';
import { ayAdi, ayKaydir, esc, fmt, isimAnahtar, kisaAd, sayi, sg, tl, tl0, today, trTarih, ymd } from './yardimci.js';
import { isIsveren } from './rol.js';
import { AYAR_ALANLARI, maasGecmisYama, maasSubeGecmisYazi, odemeSubesi, sube } from './hesap.js';
import { FM_KUSURAT_AYI, ayKadrosu, fmSaatUcreti, gunleriYukle, otoKapi, sagHesap, subeOzeti } from './cok-sube.js';
import { sirayla, yazmaHatasi } from './yazma.js';
import { kilitEngel, kilitliMi, ptK } from './kilit.js';
import { sunucuHazir } from './hucre-yazma.js';
import { tumSubeler } from './subeler.js';
import { byId, render } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { ayHaftaDurumu, benAd } from './hafta-kapatma.js';
import { kesinEngel, netMap, ptSol, ptVerisi, ucretGecmisi, usOf } from './puantaj.js';
import { VBEK, kalanYama, sagYama, satirTemiz, veriBosTemizle, veriKisileri, veriYaz, yeniSira } from './veri-girisi.js';
import { adBuyuk } from './excel-aktar.js';

export function listeyeDon(){veriBosTemizle();S.pt.sube=null;subs.detay.forEach(u=>u());subs.detay=[];render();}
export function sagSonuclu(V,degisen){const sag=JSON.parse(JSON.stringify((V.D&&V.D.sag)||{}));if(degisen)Object.entries(degisen).forEach(([pid,v])=>sag[pid]={...(sag[pid]||{}),...v});
  const prevSag=(S.pt.prev&&S.pt.prev.sag)||{};const net=netMap(V.ak);
  const ozB=ozBirlestir(veriOzet(V.D&&V.D.veri),V.sol);
  Object.keys(V.sol).forEach(pid=>{const dv=prevSag[pid]&&prevSag[pid].kalan<0?prevSag[pid].kalan:0;const r=sagHesap(pid,V.sol[pid],sag[pid],net[pid],V.sb,dv,ozB[pid],usOf(pid),otoKapi(V.ak,V.kilitli,V.kesin));sag[pid]={...(sag[pid]||{}),kalan:Math.round(r.kalan*100)/100};});return sag;}
export async function onayla(){const ak=S.ay,sid=S.subeId;const ayni=()=>S.subeId===sid&&S.ay===ak&&S.pt.sube===sid&&!!S.pt.doc&&S.pt.ozetler!==null&&S.pt.prev!==null&&!S.pt.ozetHata&&sunucuHazir(sid);
  if(!ayni()){toast('Puantaj tam yüklenmeden onaylanamaz. Biraz bekleyip tekrar deneyin.');return;}if(await kilitliMi(ptK(sid,ak)))return;await gunleriYukle(ayKadrosu(ak),[ayKaydir(ak,-1),ak,ayKaydir(ak,1)]);
  if(!ayni()){toast('Onay sırasında ekran (şube ya da ay) değişti, onay yapılmadı. Tekrar deneyin.');return;}const V=ptVerisi();{const bek=V.satir.filter(x=>x.hes.otoBekle);if(bek.length){toast(`${bek.length} kişinin çizelgeden gelen mesaisi onay bekliyor (${bek.slice(0,3).map(x=>kisaAd(x.sol.ad)).join(', ')}${bek.length>3?'…':''}). Veri girişi → "Çizelgeden gelenler" listesinden onaylayın.`);return;}}const sol=ptSol(ak,V.D||{});const b=writeBatch(db);const V2={...V,sol};
  b.set(doc(db,'puantaj',sid,'aylar',ak),{sube:sid,ay:ak,sol,sag:sagYama(sagSonuclu(V2),[]),kilitli:true,onaylayan:S.user.uid,onaylayanAd:S.me.adSoyad||'',onayTarihi:new Date().toISOString(),guncellendi:new Date().toISOString()},{merge:true});
  b.set(doc(db,'subeler',sid,'aylar',ak),{durum:'bolge_onay',onaylayan:S.user.uid,onayTarihi:new Date().toISOString()},{merge:true});
  b.set(doc(db,'ozetler',ak+'__'+sid),{sube:sid,ay:ak,kisiler:subeOzeti(ak,sid),guncellendi:new Date().toISOString()},{mergeFields:['sube','ay','kisiler','guncellendi']});
  b.commit().then(()=>toast(`${sube().ad} · ${ayAdi(ak)} onaylandı.`)).catch(yazmaHatasi);}
// İşverenin kesin kapanışı: ekranda görünen bütün sonuçlar (muhasebe + ödemeler) saklanır; ay ve haftaları kurallarla kilitlenir.
export async function kesinKapat(){const ak=S.ay,sid=S.subeId;const ayni=()=>isIsveren()&&S.subeId===sid&&S.ay===ak&&S.pt.sube===sid&&!!S.pt.doc&&S.pt.doc.kilitli===true&&S.pt.doc.kesin!==true&&S.pt.prev!==null&&sunucuHazir(sid);
  if(!ayni()){toast('Puantaj tam yüklenmeden kesin kapatılamaz.');return;}
  // Kesin kapanan aya değen haftalar bir daha düzenlenemez: açık / onaysız hafta kalırsa sonraki ayın günleri de donar.
  if(!ayHaftaDurumu(ak).tamam){toast('Ayın bütün haftaları onaylanmadan kesin kapatılamaz.');return;}
  if(KAYIT.n||navigator.onLine===false||(VBEK[sid+'|'+ak]||[]).length){toast('Gönderilmeyi bekleyen kayıt var. İnternet bağlantısını kontrol edip birkaç saniye sonra tekrar deneyin.');return;}
  if(await kilitliMi(ptK(sid,ak)))return;if(!ayni()){toast('Ekran değişti, işlem yapılmadı.');return;}
  const V=ptVerisi();const sag=sagSonuclu(V);const t=new Date().toISOString();const ad=benAd();
  const satir=V.satir.map(x=>({pid:x.pid,sol:x.sol,sag:x.sag,net:x.net??null,hes:x.hes}));const ayar=Object.fromEntries(AYAR_ALANLARI.map(k=>[k,V.sb[k]??null]));
  const b=writeBatch(db);b.set(doc(db,'puantaj',sid,'aylar',ak),{kesin:true,kesinSonuc:satirTemiz({satir,oz:V.oz,sb:ayar}),sag:sagYama(sag,[]),kesinTarihi:t,kesinAd:ad,kesinKayit:arrayUnion({t,ad,i:'kesin kapattı'}),guncellendi:t},{merge:true});
  b.set(doc(db,'subeler',sid,'aylar',ak),{durum:'kesin',kesinTarihi:t,kesinAd:ad},{merge:true});
  b.commit().then(()=>toast(`${ayAdi(ak)} kesin kapandı.`)).catch(yazmaHatasi);}
export async function kesinAc(){const ak=S.ay,sid=S.subeId;if(!isIsveren())return;if((S.aylar[ayKaydir(ak,1)]||{}).durum==='kesin'){toast('Sonraki ay kesin kapalı, bu ay açılamaz.');return;}
  const t=new Date().toISOString();const ad=benAd();const b=writeBatch(db);
  b.set(doc(db,'puantaj',sid,'aylar',ak),{kesin:false,kesinKayit:arrayUnion({t,ad,i:'kesin kapanışı açtı'}),guncellendi:t},{merge:true});
  b.set(doc(db,'subeler',sid,'aylar',ak),{durum:'bolge_onay'},{merge:true});
  b.commit().then(()=>toast('Kesin kapanış açıldı; ay bölge onaylı duruma döndü.')).catch(yazmaHatasi);}
export async function kilidiAc(){const ak=S.ay,sid=S.subeId;if(await kilitliMi(ptK(sid,ak)))return;const b=writeBatch(db);b.set(doc(db,'puantaj',sid,'aylar',ak),{kilitli:false,guncellendi:new Date().toISOString()},{merge:true});
  b.set(doc(db,'subeler',sid,'aylar',ak),{durum:'taslak'},{merge:true});b.commit().then(()=>toast('Kilit açıldı, ay yeniden düzenlenebilir.')).catch(yazmaHatasi);}
export function geriGonderPanel(){if(kilitEngel())return;openSheet(`<h2>Şubeye geri gönder</h2><div class="sub">Şube müdürü notu görür, düzeltip ayı yeniden kapatır.</div><label class="field"><span>Not</span><textarea id="gNot" rows="3" placeholder="Örn: Ali'nin 14 Ekim raporu eksik"></textarea></label>
  <div class="row2"><button class="btn grow" id="gNo">Vazgeç</button><button class="btn danger grow" id="gOk">Geri gönder</button></div>`,()=>{byId('gNo').onclick=closeSheet;
  byId('gOk').onclick=()=>{const not=byId('gNot').value.trim();{const sid=S.subeId,ay=S.ay;sirayla('ay'+ay,()=>{arka(setDoc(doc(db,'subeler',sid,'aylar',ay),{durum:'geri',not,geriGonderen:S.user.uid,geriTarih:new Date().toISOString()},{merge:true}));});}closeSheet();toast('Şubeye geri gönderildi.');};});}
// Muhasebe satırından gün ekleme: rapor, ücretsiz izin, yıllık izin, bayram, part gün. Yazılan sayı mevcut toplama EKLENİR;
// her biri Veri girişine ayrı satır olarak yazılır (tek kaynak veri girişi, kontroller orada).
export function gunPanel(pid){if(kilitEngel()||kesinEngel())return;const V=ptVerisi();const x=V.satir.find(s=>s.pid===pid);if(!x)return;const ak=V.ak,sid=S.subeId;
  if(V.kilitli){toast('Ay onaylı: rapor, izin ve part gün eklenemez. Düzeltme için kilidi açın.');return;}
  const T=[['R','Rapor','rapor'],['UI','Ücretsiz izin','ucretsiz'],['YI','Yıllık izin','yillik'],['B','Bayram','bayram'],['PG','Part gün','partGun']];
  const kL=veriKisileri(V);const adP=adBuyuk(((kL.find(([id])=>id===pid)||[])[1])||x.sol.ad);
  const mevcut=((V.D&&V.D.veri)||[]).filter(v=>['R','UI','YI','B','PG'].includes(v.tur)&&(v.pid===pid||isimAnahtar(v.ad||'')===isimAnahtar(adP))).sort((a,b)=>String(a.tarih||'').localeCompare(String(b.tarih||'')));
  const sonGun=ymd(new Date(+ak.slice(0,4),+ak.slice(5),0));const bugun=ymd(today());const tar0=bugun.slice(0,7)===ak?bugun:sonGun;
  openSheet(`<h2>${esc(x.sol.ad)}</h2><div class="sub">${ayAdi(ak)} · ${esc(x.sol.sekil)} · ${x.sol.gun} gün sayısı${x.sol.hakGun!=null&&x.sol.hakGun!==x.sol.gun?` · ${x.sol.hakGun} çalışılan gün`:''}</div>
   <p class="note" style="margin-top:0">Yazdığınız gün <b>mevcut toplama eklenir</b> (ör. 2 gün rapor varken 5 yazarsanız 7 olur). Her biri Veri girişine "Muhasebe penceresinden" açıklamasıyla satır olarak yazılır.</p>
   <div class="fgrid">${T.map(([k,ad,f])=>`<label class="field"><span>${ad} <small style="color:var(--mut)">· şu an ${fmt(x.sol[f]||0)}</small></span><input id="gp${k}" inputmode="decimal" placeholder="+ gün"></label>`).join('')}
   <label class="field"><span>Tarih</span><input id="gpT" type="date" value="${tar0}" min="${ak}-01" max="${sonGun}"></label>
   <label class="field" style="grid-column:1/-1"><span>Açıklama (isteğe bağlı)</span><input id="gpA" placeholder="ör. hastane raporu"></label></div>
   ${mevcut.length?`<span class="lbl">Bu ay girilmiş gün kayıtları</span><div class="tbl-wrap"><table class="pt"><tbody>${mevcut.map(v=>`<tr><td>${v.tarih?trTarih(v.tarih):''}</td><td class="l">${esc((veriTur(v.tur)||{}).ad||v.tur)}</td><td>${fmt(sayi(v.miktar))}</td><td class="l">${esc(v.aciklama||'')}</td></tr>`).join('')}</tbody></table></div>`:''}
   <p class="note">Rapor / izin / part gün, girildiği şubeden bağımsız olarak kişinin SGK ve maaş şubesinde sayılır. Yanlış girilen satırı Veri girişinden silin.</p>
   <div class="row2"><button class="btn grow" id="gpNo">Vazgeç</button><button class="btn primary grow" id="gpOk">Ekle</button></div>`,()=>{
   byId('gpNo').onclick=closeSheet;
   byId('gpOk').onclick=()=>{if(kilitEngel()||kesinEngel())return;const tar=byId('gpT').value;if(!tar||tar.slice(0,7)!==ak){toast(`Tarih ${ayAdi(ak)} içinde olmalı.`);return;}
     const a=byId('gpA').value.trim();const kim=S.me.adSoyad||S.me.kullaniciAdi||'';const z=new Date().toISOString();const ek=[];
     for(const[k,ad]of T){const m=sayi(byId('gp'+k).value);if(!m)continue;if(m<0){toast(`${ad}: eksi gün eklenemez, yanlış satırı Veri girişinden silin.`);return;}
       ek.push({id:Math.random().toString(36).slice(2,10),sira:yeniSira(),tarih:tar,ad:adP,pid,tur:k,miktar:m,aciklama:(a?a+' · ':'')+'Muhasebe penceresinden',kim,zaman:z});}
     if(!ek.length){toast('Eklenecek gün girilmedi.');return;}
     if(sid!==S.pt.sube||ak!==S.ay){toast('Ekran değişti, eklenmedi. Tekrar deneyin.');return;}
     const veriY=[...((S.pt.doc&&S.pt.doc.veri)||[]),...ek];S.pt.doc={...S.pt.doc,veri:veriY};
     veriYaz(sid,ak,{deg:Object.fromEntries(ek.map(r=>[r.id,r])),sil:[]},kalanYama(sid,ak,veriY));closeSheet();S.pt.zorla=true;render();
     toast(ek.map(r=>`${fmt(r.miktar)} gün ${veriTur(r.tur).ad.toLocaleLowerCase('tr-TR')}`).join(', ')+' eklendi.');};});}
export function odemePanel(pid){if(kilitEngel()||kesinEngel())return;const V=ptVerisi();const x=V.satir.find(s=>s.pid===pid);if(!x)return;const s=x.sag;const esnaf=x.hes.esnaf;const ekToplam=k=>{const v=(V.oz[pid]||{})[k]||0;return v?tl(v):'';};const us0=usOf(pid);let tip=us0.tip;const maasDisi=x.sol.maasBurada===false;const kuryeMi=(x.sol.grup||'')==='S';const partMi=x.sol.sekil==='Part';if(!kuryeMi&&tip==='paket')tip='maas';if(!partMi&&tip==='saat'&&!maasDisi)tip=us0.tip==='saat'?'saat':tip;const tc=(S.pt.maas&&S.pt.maas.tc&&S.pt.maas.tc[pid])||((S.personel.find(q=>q.id===pid)||{}).tc)||'';
  const inp=(id,label,val,ph='')=>`<label class="field"><span>${label}</span><input id="${id}" inputmode="decimal" value="${val??''}" placeholder="${ph}"></label>`;
  const pK=S.personel.find(q=>q.id===pid);const ms0=pK?odemeSubesi(pK,V.ak):'';let msSecHtml='';
  if(pK&&!esnaf){const sgk=pK.sgkSube&&pK.sgkSube!==SGK_YOK?pK.sgkSube:'';const ana=pK.anaSube||'';
    // İşveren her şubeyi seçebilir; diğerleri kişinin görüldüğü şubeleri (çalıştığı, SGK).
    const ids=isIsveren()?tumSubeler().map(([i])=>i):[...new Set([ana,sgk,ms0].filter(Boolean))];if(ms0&&!ids.includes(ms0))ids.unshift(ms0);
    const gy=maasSubeGecmisYazi(pK);
    msSecHtml=`<label class="field" style="grid-column:1/-1"><span>Maaşın ödendiği şube · ${ayAdi(V.ak)} ayından itibaren</span><select id="oMs" ${V.kilitli?'disabled':''}>${ids.map(i=>`<option value="${esc(i)}" ${i===ms0?'selected':''}>${esc(subeAdi(i))}${i===sgk?' (SGK)':i===ana?' (çalıştığı)':''}</option>`).join('')}</select></label>
     <p class="note" style="grid-column:1/-1;margin-top:0">${V.kilitli?'Bu ay onaylı, bu ay için değiştirilemez. ':''}Değiştirirseniz bu ay ve sonrası için geçerli olur; önceki aylar değişmez. Muhasebe ${esc(subeAdi(sgk||ana))}'de kalır.${gy?' Geçmiş: '+esc(gy):''}</p>`;}
  let fmModD=s.fmMod==='elle'&&s.fmBirim!==undefined?'elle':'maas';
  openSheet(`<h2>${esc(x.sol.ad)}</h2><div class="sub">${ayAdi(V.ak)} · ${esc(x.sol.sekil)} · ${esnaf?'paket başı':x.sol.gun+' bordro günü'+(x.sol.hakGun!=null&&x.sol.hakGun!==x.sol.gun?` · ${x.sol.hakGun} çalışılan gün`:'')}${x.sol.fmSaat&&!esnaf?' · fazla mesai '+sg(x.sol.fmSaat)+' sa':''}${x.sol.sekil==='Part'?` · çizelgede ${fmt(x.sol.calisilanSaat||0)} sa`:''}</div>
   <div class="fgrid">${esnaf?inp('oPs','Paket sayısı',s.paketSayisi)+inp('oPu','Paket başı ücret (₺)',s.paketUcret,''):`<div style="grid-column:1/-1"><span class="lbl">Ücret şekli</span><div class="seg" id="oSekil">${(maasDisi?[['maas','Maaşı başka şubede'],...(kuryeMi?[['paket','Paket başı']]:[]),['saat','Saatlik']]:[['maas','Maaşlı'],...(kuryeMi?[['paket','Paket başı']]:[]),['saat','Saatlik']]).map(([k,a])=>`<button data-v="${k}" class="${tip===k?'on':''}">${a}</button>`).join('')}</div></div>
     <div id="oNetW" style="grid-column:1/-1" ${tip==='maas'&&!maasDisi?'':'hidden'}>${inp('oNet',`Anlaşılan aylık net (₺) · ${ayAdi(V.ak)} ayından itibaren`,x.net,'örn. 50000')}<p class="note" style="margin-top:0">Değiştirirseniz bu ay ve sonrası için geçerli olur; önceki aylar değişmez.${ucretGecmisi('netGecmis',pid)?' Geçmiş: '+esc(ucretGecmisi('netGecmis',pid)):''}</p></div>
     <p class="note" id="oMdNot" style="grid-column:1/-1" ${tip==='maas'&&maasDisi?'':'hidden'}>Maaşı ${esc(x.sol.odemeSube||'SGK şubesinin')} puantajında. Burada sadece bu şubede yaptığı fazla mesai ve buraya ait primler hesaplanır.</p>
     <p class="note" id="oPbNot" style="grid-column:1/-1" ${tip==='paket'?'':'hidden'}>Paket başı: kazanç paket primleridir. Paket primlerini Veri girişinden "Paket primi" olarak girin; bankaya yatan, ara ödeme ve avans düşülür, kalan elden ödenir. Fazla mesai hesaplanmaz.</p>
     <div id="oSaatW" style="grid-column:1/-1" ${tip==='saat'?'':'hidden'}>${inp('oSaat',`Saat ücreti (₺) · ${ayAdi(V.ak)} ayından itibaren`,us0.saatUcret||'','örn. 120')}<p class="note" style="margin-top:0">Saatler mesai çizelgesinden ayın 1'i ile son günü arasında otomatik alınır (bu ay ${fmt(x.sol.calisilanSaat||0)} sa, sadece bu şubedeki saatler). Eksik ya da fazla varsa Veri girişine "Çalışılan saat" türüyle + ya da − saat girin. Hak ediş = saat × ücret; bankaya yatan, ara ödeme ve avans düşülür. Fazla mesai hesaplanmaz.</p></div>`}
   ${!esnaf&&V.sb.fmYontem==='maas'?`<div id="oFmW" style="grid-column:1/-1" ${tip==='maas'?'':'hidden'}><span class="lbl">Fazla mesai</span><div class="seg" id="oFmS"><button data-v="maas" class="${fmModD==='elle'?'':'on'}">Maaşına göre</button><button data-v="elle" class="${fmModD==='elle'?'on':''}">Elle yaz</button></div><div id="oFmTW" ${fmModD==='elle'?'':'hidden'}>${inp('oFmT','Fazla mesai saat ücreti (₺)',s.fmBirim||'','örn. 220')}</div><p class="note" id="oFmH" style="margin-top:4px"></p></div>`:''}
   ${!esnaf&&V.sb.fmYontem!=='maas'?`<div id="oFoW" style="grid-column:1/-1" ${tip==='maas'?'':'hidden'}>${inp('oFo',`Özel fazla mesai saat ücreti (₺) · ${ayAdi(V.ak)} ayından itibaren`,us0.fmOzel||'','boşsa şube ücreti: '+(sayi(V.sb.fmUcret)||'-'))}<p class="note" style="margin-top:0">Sadece bu kişi için. Boş bırakırsanız şubenin sabit ücreti uygulanır; bu ay ve sonrası için geçerli olur, önceki aylar değişmez.${ucretGecmisi('fmOzelGecmis',pid)?' Geçmiş: '+esc(ucretGecmisi('fmOzelGecmis',pid)):''}</p></div>`:''}
   ${inp('oCiro','Ciro primi ekle (₺)','')}
   <p class="note yardim" style="grid-column:1/-1;margin-top:0">Buraya yazdığınız ciro primi veri girişine ayın son günü tarihli satır olarak eklenir. Paket primi, avans ve ara ödemeyi veri girişinden girin.${ekToplam('PP')||ekToplam('CP')?` Bu ay girilmiş: ${ekToplam('PP')?'paket primi '+ekToplam('PP'):''}${ekToplam('PP')&&ekToplam('CP')?', ':''}${ekToplam('CP')?'ciro primi '+ekToplam('CP'):''}.`:''}</p>
   ${msSecHtml}
   <label class="field"><span>TC kimlik no (bordro eşleşmesi için)</span><input id="oTc" inputmode="numeric" maxlength="11" value="${esc(tc)}"></label></div>
   <div class="calc" id="oCalc"></div><div id="oErr"></div><div class="row2"><button class="btn grow" id="oNo">Vazgeç</button><button class="btn primary grow" id="oOk">Kaydet</button></div>`,sh=>{
   const oku=()=>{const v=id=>{const e=byId(id);return e?e.value.trim():undefined;};const o={};if(esnaf){o.paketSayisi=v('oPs');o.paketUcret=v('oPu');}if(byId('oFmW')){const el=fmModD==='elle'&&tip==='maas';o.fmMod=el?'elle':'';o.fmBirim=el?(v('oFmT')||''):'';}return o;};
   const ekV=V.oz[pid]||{};
   sh.querySelectorAll('#oSekil button').forEach(b=>b.onclick=()=>{tip=b.dataset.v;sh.querySelectorAll('#oSekil button').forEach(q=>q.classList.toggle('on',q===b));byId('oNetW').hidden=!(tip==='maas'&&!maasDisi);byId('oMdNot').hidden=!(tip==='maas'&&maasDisi);byId('oPbNot').hidden=tip!=='paket';byId('oSaatW').hidden=tip!=='saat';const fw=byId('oFmW');if(fw)fw.hidden=tip!=='maas';const fo=byId('oFoW');if(fo)fo.hidden=tip!=='maas';calc();});
   sh.querySelectorAll('#oFmS button').forEach(b=>b.onclick=()=>{fmModD=b.dataset.v;sh.querySelectorAll('#oFmS button').forEach(q=>q.classList.toggle('on',q===b));byId('oFmTW').hidden=fmModD!=='elle';if(fmModD==='elle'){const ti=byId('oFmT');if(ti&&!ti.value){const nn=byId('oNet')?sayi(byId('oNet').value):sayi(x.net);const r0=fmSaatUcreti(V.sb,nn,V.ak);if(r0)ti.value=String(r0);}}calc();});
   const usSimdi=()=>({tip,saatUcret:byId('oSaat')?sayi(byId('oSaat').value):0,fmOzel:byId('oFo')&&tip==='maas'?sayi(byId('oFo').value):0,ak:V.ak});
   const calc=()=>{const o=oku();const fh=byId('oFmH');if(fh){const nn=byId('oNet')?sayi(byId('oNet').value):sayi(x.net);const fs=x.sol.fmSaat||0;fh.textContent=fmModD==='elle'?`Çizelgede ${sg(fs)} sa fazla mesai var. Saat ücretini kendiniz yazın.`:nn?`${tl0(nn)} ÷ 30 ÷ 9 = ${fmt(nn/30/9)} → ${tl0(fmSaatUcreti(V.sb,nn,V.ak))}/sa${V.ak>=FM_KUSURAT_AYI?' (küsurat atılır)':''} × ${sg(fs)} sa`:'Net maaş girilmedi, saat ücretini "Elle yaz" ile girin.';}const n=esnaf?0:byId('oNet')?sayi(byId('oNet').value):sayi(x.net);const ek2={...ekV,CP:(ekV.CP||0)+sayi(byId('oCiro').value)};const r=sagHesap(pid,x.sol,{...s,...o},n,V.sb,x.hes.devir,ek2,esnaf?{}:usSimdi(),otoKapi(V.ak,V.kilitli,V.kesin));const pb=r.pb;
     byId('oCalc').innerHTML=`${esnaf?`<div><span>Paket hak edişi</span><b>${tl(r.paketHak)}</b></div>`:pb?'':r.saat?`<div><span>Hak edilen (${fmt(r.saatSayi)} saat${r.saatSayi!==r.cizelgeSaat?` = çizelge ${fmt(r.cizelgeSaat)} ${r.saatSayi>r.cizelgeSaat?'+':'−'} ${fmt(Math.abs(r.saatSayi-r.cizelgeSaat))}`:''} × ${tl(r.saatUcret)})</span><b>${tl(r.hak)}</b></div>`:`<div><span>Hak edilen (net × ${x.sol.hakGun!=null?x.sol.hakGun:x.sol.gun}${x.sol.bayram>0?`+${fmt(x.sol.bayram)} bayram`:''}/30${x.sol.hakGun!=null&&x.sol.hakGun!==x.sol.gun?(x.sol.sekil==='Part'||x.sol.partGun>0?` · muhasebede part ${fmt(x.sol.gun)} gün`:x.sol.sgkYok?' · SGK yok':` · ${x.sol.hakGun-x.sol.gun} gün deneme`):''})</span><b>${tl(r.hak)}</b></div>`}<div><span>− Bankaya yatan</span><b>${tl(r.bankaya)}</b></div>${pb?'':`<div><span>= Maaş farkı</span><b>${tl(r.maasFarki)}</b></div>`}
       ${r.fmTl?`<div><span>+ Fazla mesai</span><b>${tl(r.fmTl)}</b></div>`:''}${r.paketPrimi?`<div><span>+ Paket primi</span><b>${tl(r.paketPrimi)}</b></div>`:''}${r.ciroPrimi?`<div><span>+ Ciro primi</span><b>${tl(r.ciroPrimi)}</b></div>`:''}${r.araOdeme?`<div><span>− Ara ödeme</span><b>${tl(r.araOdeme)}</b></div>`:''}${r.avans?`<div><span>− Avans${r.devirAvans?` (${tl(r.devirAvans)} geçen ay devri dahil)`:''}</span><b>${tl(r.avans)}</b></div>`:''}
       ${Math.abs(r.kalan-r.kalanHam)>0.004?`<div><span>Yuvarlama (5 ₺)</span><b>${tl(r.kalan-r.kalanHam)}</b></div>`:''}<div style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><span>Kalan ödeme</span><b class="${r.kalan<0?'neg':'pos'}">${tl(r.kalan)}</b></div>${r.kalan<0?'<div><span class="note" style="margin:0">Eksi tutar sonraki ayın ödemesinden düşülür.</span></div>':''}`;};
   sh.querySelectorAll('input').forEach(i=>i.oninput=calc);calc();byId('oNo').onclick=closeSheet;
   byId('oOk').onclick=async()=>{const o=oku();const tcv=byId('oTc').value.replace(/\D/g,'');if(tcv&&tcv.length!==11){byId('oErr').innerHTML='<div class="confirm">TC kimlik no 11 haneli olmalı.</div>';return;}
     const sid=S.subeId,ak=V.ak;const sag=sagSonuclu(V,{[pid]:o});
     if(await kilitliMi(ptK(sid,ak)))return;
     try{const netEl=byId('oNet');if(!esnaf){const u=usSimdi();if(u.tip!==us0.tip||(u.tip==='saat'&&u.saatUcret!==us0.saatUcret)){const m0=S.pt.maas||{};
         const sg0=(m0.saatGecmis||{})[pid]||{};S.pt.maas={...m0,ucretSekli:{...(m0.ucretSekli||{}),[pid]:u.tip},paketBasi:{...(m0.paketBasi||{}),[pid]:u.tip==='paket'},...(u.tip==='saat'?{saatGecmis:{...(m0.saatGecmis||{}),[pid]:{...sg0,[ak]:u.saatUcret}}}:{})};
         setDoc(doc(db,'maaslar',sid),{ucretSekli:{[pid]:u.tip},paketBasi:{[pid]:u.tip==='paket'},...(u.tip==='saat'?{saatGecmis:{[pid]:{[ak]:u.saatUcret}}}:{})},{merge:true}).catch(yazmaHatasi);}
         const kp=S.personel.find(q=>q.id===pid),yPb=u.tip==='paket';if(kp&&!!kp.paketBasi!==yPb){kp.paketBasi=yPb;setDoc(doc(db,'personel',pid),{paketBasi:yPb},{merge:true}).catch(yazmaHatasi);}/* paket başı kişinin kendisinde: her şubede geçerli */}
       if(!esnaf&&byId('oFo')){const yeni=tip==='maas'?(sayi(byId('oFo').value)||0):0;const eski=sayi(us0.fmOzel)||0;if(yeni!==eski){const m0=S.pt.maas||{};const g0=(m0.fmOzelGecmis||{})[pid]||{};
         S.pt.maas={...m0,fmOzelGecmis:{...(m0.fmOzelGecmis||{}),[pid]:{...g0,[ak]:yeni}}};setDoc(doc(db,'maaslar',sid),{fmOzelGecmis:{[pid]:{[ak]:yeni}}},{merge:true}).catch(yazmaHatasi);}}
       const netYeni=!esnaf&&netEl&&!byId('oNetW').hidden?(sayi(netEl.value)||null):undefined;const netDeg=netYeni!==undefined&&netYeni!==(sayi(x.net)||null);
       if(netDeg||tcv!==tc){const m={};if(netDeg)m.netGecmis={[pid]:{[ak]:netYeni}};if(tcv!==tc)m.tc={[pid]:tcv||null};
         if(netDeg){const m0=S.pt.maas||{};S.pt.maas={...m0,netGecmis:{...(m0.netGecmis||{}),[pid]:{...((m0.netGecmis||{})[pid]||{}),[ak]:netYeni}}};}setDoc(doc(db,'maaslar',sid),m,{merge:true}).catch(yazmaHatasi);}
       // Primler ve eski kayıtlı avans/prim tutarları veri girişine taşınır: veri tek yerde.
       const sonGun=ymd(new Date(+ak.slice(0,4),+ak.slice(5),0));const kim=S.me.adSoyad||S.me.kullaniciAdi||'';const z=new Date().toISOString();const adP=adBuyuk(x.sol.ad);
       const satir=(tur,m,a)=>({id:Math.random().toString(36).slice(2,10),sira:yeniSira(),tarih:sonGun,ad:adP,pid,tur,miktar:m,aciklama:a,kim,zaman:z});const ek=[];
       if(sayi(byId('oCiro').value))ek.push(satir('CP',sayi(byId('oCiro').value),'Ödeme penceresinden'));
       const eskiS=sag[pid]||{};[['paketPrimi','PP'],['ciroPrimi','CP'],['avans','AV']].forEach(([f,t])=>{if(sayi(eskiS[f])){ek.push(satir(t,sayi(eskiS[f]),'Önceki kayıttan taşındı'));sag[pid]={...sag[pid],[f]:''};}});
       const burada=sid===S.pt.sube&&ak===S.ay&&S.pt.doc;const veriY=[...((burada?S.pt.doc.veri:V.D.veri)||[]),...ek];if(burada)S.pt.doc={...S.pt.doc,veri:veriY};
       const sag2=sagSonuclu({...V,D:{...V.D,sag,veri:veriY}});
       veriYaz(sid,ak,{deg:Object.fromEntries(ek.map(r=>[r.id,r])),sil:[]},{...(V.kilitli?{}:{sube:sid,ay:ak}),sag:sagYama(sag2,[pid])},{kilitsiz:true});
       const msEl=byId('oMs');let msMesaj='';if(pK&&msEl&&!msEl.disabled&&msEl.value&&msEl.value!==ms0){const ym=maasGecmisYama(pK,msEl.value,ak);if(ym){Object.assign(pK,ym);setDoc(doc(db,'personel',pK.id),ym,{merge:true}).catch(yazmaHatasi);msMesaj=` Maaşı ${ayAdi(ak)} ayından itibaren ${subeAdi(msEl.value)} puantajında.`;}}
       closeSheet();toast((ek.length?'Kaydedildi, primler veri girişine eklendi.':'Ödeme bilgileri kaydedildi.')+msMesaj);if(msMesaj)render();}
     catch(e){yazmaHatasi(e);}};});}

