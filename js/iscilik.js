// iscilik.js — app.js (v180) satırları 2516-2687. Otomatik bölündü; davranış değişmedi.
import { collection, deleteField, doc, getDoc, getDocs, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { GRUP, GRUP_SIRA, SGK_YOK, subeAdi, veriGunHesap } from './sabitler.js';
import { db, setDoc } from './firebase.js';
import { S, subs, tryLS } from './durum.js';
import { ayAdi, ayKaydir, ayKey, esc, rangeLabel, sayi, tl, tl0, today, trTarih, ymd } from './yardimci.js';
import { isBolge, isIsveren } from './rol.js';
import { aktifAyda, odemeSubesi } from './hesap.js';
import { ayKadrosu, ayniKisi, gunHataVar, gunleriYukle, sgkVar } from './cok-sube.js';
import { yazmaHatasi } from './yazma.js';
import { sunucuHazir } from './hucre-yazma.js';
import { selectSube } from './subeler.js';
import { byId, render, view } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { benAd, tarihSaat } from './hafta-kapatma.js';
import { ibanAyi, ibanExcel, ibanKutusu, ibanMetin, panoyaYaz } from './personel.js';
import { jsSirali, ptVerisi, puantajAc, veriGunYaz } from './puantaj.js';
import { kfAktifMi, kfBagla, kfBaslik, kfDurum, kfUygula } from './kolon-filtre.js';
import { veriListesi } from './veri-girisi.js';
import { adBuyuk } from './excel-aktar.js';
import { veriKontrolu, yedekAl } from './yedek.js';

/* ================= İşçilik (sadece işveren): şube başına aylık işçilik maliyeti ve ciroya oranı =================
   Kişi maliyeti = resmi maliyet + elden ödenen + paket primi.
   Resmi maliyet: SGK'lı gün × (asgari brüt × (1 + işveren SGK payı + işsizlik)) ÷ 30. Bankaya yatan net maaş bunun içindedir (1 ya da 5 günlük SGK'lı kurye dahil).
   Elden ödenen: maaş farkı + fazla mesai + ciro primi + ek ödeme − kesinti (avans ve ara ödemeler bunun ödenmiş kısmıdır, ayrıca eklenmez;
   geçen aydan gelen eksi devir bu ayın maliyeti değildir). SGK'sı olmayan / esnaf kuryede bankaya yatan da Resmi sütununa eklenir.
   Paket primi: ödemeler listesindeki tutar, ayrı kalem; bankaya yatan primden düşülmez.
   Maaş, SGK ve fazla mesai kişinin maaşının ödendiği şubeye yazılır. Lojman şube başına elle girilir. Ciro KDV dahil girilir.
   Hesap her şubenin puantajından (onaylı ayda kilitli rakamlar, kesin ayda saklanan rakamlar, açık ayda tahmini) yapılır ve iscilik/{ay} belgesine saklanır. */
const ISC_VARS={aylik:40874.63};// 30 günlük SGK'lı çalışanın aylık işveren maliyeti (bankaya yatan net maaş dahil)
// Eski kayıtlar asgari/SGK/işsizlik ile saklanmış olabilir; onlar eski formülle okunur.
const iscAyar=D=>{const a={...((D&&D.ayar)||{})};if(a.aylik==null&&a.asgari==null)a.aylik=ISC_VARS.aylik;return a;};
const iscGunluk=a=>(a.aylik!=null&&sayi(a.aylik)>0?sayi(a.aylik):sayi(a.asgari)*(1+sayi(a.sgk)/100+sayi(a.issizlik)/100))/30;
const r2=x=>Math.round((x||0)*100)/100;
function iscAyi(){if(S.iscAy)return S.iscAy;const bu=ayKey(today());return today().getDate()<=15?ayKaydir(bu,-1):bu;}
function iscKisi(x,ayar){const sol=x.sol||{},h=x.hes||{};const esnaf=sol.sekil==='Esnaf kurye'||h.esnaf;const maasB=sol.maasBurada!==false;const burada=esnaf||h.pb?true:maasB;// paket başı kurye de esnaf gibi: maliyet paket attığı şubede kalır (SGK günü yine maaş/SGK şubesinde). Esnaf kuryenin maliyeti çalıştığı (verisinin girildiği) şubede kalır, maaş şubesine taşınmaz
  const gun=maasB&&!esnaf&&!sol.sgkYok?sayi(sol.iscGun!=null?sol.iscGun:sol.gun):0;/* SGK şubesi değişen kişide iki kaydın günleri (en çok 30) */const resmi=r2(gun*iscGunluk(ayar));
  // Paket primi ayrı kalemdir (ödemeler listesindeki tutar olduğu gibi); bankaya yatan primden düşülmez, kuryenin sigortası da diğerleri gibi Resmi'ye girer.
  let elden=r2(sayi(h.maasFarki)+sayi(h.fmTl)+sayi(h.ciroPrimi)+sayi(h.ekOd));
  let paket=r2(sayi(h.paketPrimi));
  let banka=burada&&resmi<=0&&!h.pb?r2(sayi(h.bankaya)):0;/* paket başında bankaya yatan paket primini ödemektir, ayrı maliyet değil */
  // Esnaf kurye ayrı bir şirkettir: SGK / maaş yok, her şubede o şubede attığı paketin bedeli (paket sayısı × ücret + girilen paket primi) o şubenin paket primidir.
  if(esnaf){paket=r2(sayi(h.paketHak)+sayi(h.paketPrimi));elden=r2(sayi(h.maasFarki)+sayi(h.bankaya)-sayi(h.paketHak)+sayi(h.fmTl)+sayi(h.ciroPrimi)+sayi(h.ekOd));banka=0;}
  return{pid:x.pid,ad:sol.ad||'',grup:sol.grup||'K',gun,resmi,banka,elden,paket,toplam:r2(resmi+banka+elden+paket),burada};}
const iscBekle=ms=>new Promise(r=>setTimeout(r,ms));
async function iscilikHesapla(ak){if(!isIsveren()||S.iscCalisiyor)return;S.iscCalisiyor=true;const D0=S.iscDoc||{};const ayar=iscAyar(D0);
  const eskiSube=S.subeId,eskiAy=S.ay,eskiAyElle=S.ayElle;const sonuc={},hata=[],tasi=[];const L=S.subeIds.slice();
  try{// Önce her şubenin veri girişindeki rapor / izin / part gün ay özetine yazılır: bir şubede girilen gün diğer şubenin hesabına da girer.
    try{S.iscDurum='Veri girişleri okunuyor';render();const q=await getDocs(query(collection(db,'ozetler'),where('ay','==',ak)));const kay={};q.docs.forEach(d=>{const x=d.data();if(x.sube)kay[x.sube]=x.veriGun||{};});
      for(const sid of L){const s=await getDoc(doc(db,'puantaj',sid,'aylar',ak));const d=s.exists()?s.data():null;const vg=d?veriGunHesap(veriListesi(d),ak,d):{};if(jsSirali(vg)!==jsSirali(kay[sid]||{}))await veriGunYaz(sid,ak,vg);}}
    catch(e){console.error(e);hata.push('veri girişi özetleri');}
    for(let i=0;i<L.length;i++){const sid=L[i];S.iscDurum=`Hesaplanıyor ${i+1} / ${L.length}: ${subeAdi(sid)}`;render();
      S.ay=ak;puantajAc(sid);const t0=Date.now();let hazir=false;
      while(Date.now()-t0<30000){if(S.pt.sube===sid&&S.ay===ak&&S.pt.doc&&S.pt.maas!==null&&S.pt.prev!==null&&S.pt.ozetler!==null&&sunucuHazir(sid)){hazir=true;break;}await iscBekle(150);}
      if(!hazir){hata.push(subeAdi(sid));continue;}
      try{await gunleriYukle(ayKadrosu(ak),[ayKaydir(ak,-1),ak,ayKaydir(ak,1)]);}catch(e){}
      if(S.pt.sube!==sid||S.ay!==ak){hata.push(subeAdi(sid));continue;}
      const V=ptVerisi();const durum=V.kesin?'kesin':V.kilitli?'onayli':'tahmini';const kisi=[];
      V.satir.forEach(x=>{const k=iscKisi(x,ayar);if(!k.toplam&&!k.gun)return;
        if(!k.burada){const p=S.personel.find(q=>q.id===x.pid);const hedef=(x.sol&&x.sol.odemeSid)||(p?odemeSubesi(p,ak):'');if(hedef&&hedef!==sid&&L.includes(hedef)){
          // Paket primi girildiği şubede kalır; fazla mesai ve diğer kalemler maaşın ödendiği şubeye taşınır.
          const paket=k.paket||0;if(paket)kisi.push({...k,resmi:0,banka:0,elden:0,gun:0,paket,toplam:paket,burada:true,ad:k.ad+' · paket'});
          const tk={...k,paket:0,toplam:r2(k.toplam-paket),hedef,kaynak:sid};if(Math.abs(tk.toplam)>0.004||tk.gun)tasi.push(tk);return;}}
        kisi.push(k);});
      sonuc[sid]={durum,kisi,ozetHata:!!S.pt.ozetHata||gunHataVar()};}
    // Başka şubede yapılan fazla mesai: kişinin maaş şubesine
    tasi.forEach(k=>{const h=sonuc[k.hedef];if(!h)return;h.kisi.push({...k,ad:k.ad+' · '+subeAdi(k.kaynak)+' FM',burada:true});});
    const t=new Date().toISOString();const hesap={};
    Object.entries(sonuc).forEach(([sid,x])=>{const top=k=>r2(x.kisi.reduce((a,y)=>a+(y[k]||0),0));const gr={};x.kisi.forEach(y=>{gr[y.grup]=r2((gr[y.grup]||0)+y.toplam);});
      hesap[sid]={fv:2,durum:x.durum,ozetHata:x.ozetHata,resmi:top('resmi'),gunTop:top('gun'),banka:top('banka'),elden:top('elden'),paket:top('paket'),toplam:top('toplam'),kisiSay:x.kisi.filter(y=>!/ (FM|paket)$/.test(y.ad)).length,gruplar:gr,kisi:x.kisi.map(y=>({ad:y.ad,grup:y.grup,gun:y.gun,resmi:y.resmi,banka:y.banka,elden:y.elden,paket:y.paket||0,toplam:y.toplam})),tarih:t};});
    await setDoc(doc(db,'iscilik',ak),{ay:ak,ayar,hesap,hesapTarihi:t,hesaplayan:benAd()},{merge:true});
    toast(hata.length?`Hesaplandı; ${hata.length} şube yüklenemedi: ${hata.join(', ')}. Tekrar deneyin.`:'İşçilik hesaplandı.');}
  catch(e){console.error(e);yazmaHatasi(e);}
  finally{subs.detay.forEach(u=>u());subs.detay=[];S.pt.sube=null;S.pt.doc=null;S.ay=eskiAy;S.ayElle=eskiAyElle;if(eskiSube&&S.subeId!==eskiSube)selectSube(eskiSube);
    S.iscCalisiyor=false;S.iscDurum='';render();}}
function iscDinle(ak){
  // Bölge müdürü: işverenin yazdığı, sadece kendi şubelerini içeren özet belgeyi (iscilikBolge/{ay}__{uid}) okur.
  if(isBolge()){const buid=S.user.uid;if(S.iscKey===ak)return;if(S.iscUnsub)S.iscUnsub();S.iscKey=ak;S.iscDoc=null;S.iscOnce=null;
    S.iscUnsub=onSnapshot(doc(db,'iscilikBolge',ak+'__'+buid),s=>{const d=s.exists()?s.data():{};S.iscDoc=d;S.iscSabit={lojman:d.lojSabit||{}};S.iscHata=false;if(S.tab==='yonetim'&&S.ynt==='iscilik')render();},e=>{console.error(e);S.iscDoc={};S.iscHata=true;render();});
    getDoc(doc(db,'iscilikBolge',ayKaydir(ak,-1)+'__'+buid)).then(s=>{if(S.iscKey!==ak)return;S.iscOnce=s.exists()?s.data():{};render();}).catch(()=>{S.iscOnce={};});return;}
  // Her ay aynı lojman tutarları (şube → {ay: tutar}); ayrı belgede tutulur, aya bağlı değildir.
  if(!S.iscSabitUnsub)S.iscSabitUnsub=onSnapshot(doc(db,'iscilik','sabit'),s=>{S.iscSabit=s.exists()?s.data():{};iscBolgeSenkron();if(S.tab==='yonetim'&&S.ynt==='iscilik')render();},e=>{console.error(e);S.iscSabit={};});
  if(S.iscKey===ak)return;if(S.iscUnsub)S.iscUnsub();S.iscKey=ak;S.iscDoc=null;S.iscOnce=null;
  S.iscUnsub=onSnapshot(doc(db,'iscilik',ak),s=>{S.iscDoc=s.exists()?s.data():{};S.iscHata=false;iscBolgeSenkron();if(S.tab==='yonetim'&&S.ynt==='iscilik')render();},e=>{console.error(e);S.iscDoc={};S.iscHata=true;render();});
  getDoc(doc(db,'iscilik',ayKaydir(ak,-1))).then(s=>{if(S.iscKey!==ak)return;S.iscOnce=s.exists()?s.data():{};iscBolgeSenkron();render();}).catch(()=>{S.iscOnce={};});}
// İşveren: her bölge müdürü için, sadece kendi şubelerinin işçilik özetini ayrı belgeye yazar (değişmediyse yazmaz).
let ibT;function iscBolgeSenkron(){clearTimeout(ibT);ibT=setTimeout(()=>{if(!isIsveren()||!S.iscKey||S.iscDoc==null||S.iscSabit==null)return;const ak=S.iscKey;
  const bm=(S.users||[]).filter(u=>u.rol==='bolge'&&u.aktif!==false);S.iscPub=S.iscPub||{};
  [[ak,S.iscDoc],[ayKaydir(ak,-1),S.iscOnce]].forEach(([ay,D])=>{if(D==null)return;bm.forEach(u=>{const L=(u.subeler||[]).filter(x=>S.subeIds.includes(x));const pick=o=>{const r={};L.forEach(x=>{if(o&&o[x]!=null)r[x]=o[x];});return r;};
    const veri={ay,bm:u.uid,ayar:D.ayar||null,hesapTarihi:D.hesapTarihi||null,hesaplayan:D.hesaplayan||'',subeler:pick(D.subeler),hesap:pick(D.hesap),lojSabit:pick((S.iscSabit||{}).lojman)};
    const id=ay+'__'+u.uid,js=JSON.stringify(veri);if(S.iscPub[id]===js)return;S.iscPub[id]=js;setDoc(doc(db,'iscilikBolge',id),veri).catch(e=>{console.error(e);delete S.iscPub[id];});});});},1500);}
const iscOran=(t,c)=>c>0?t/c*100:null;
const iscYuzde=x=>x==null?'—':'%'+(Math.round(x*10)/10).toLocaleString('tr-TR');
// Lojman: o ay için elle yazılmış tutar varsa o; yoksa "her ay aynı" olarak kaydedilen, o aya kadar geçerli son tutar.
function iscSabitLoj(sid,ak){const m=(((S.iscSabit||{}).lojman)||{})[sid];if(!m||typeof m!=='object')return null;const k=Object.keys(m).filter(x=>x<=ak).sort().pop();return k?sayi(m[k]):null;}
function iscLoj(D,ak,sid){const g=((D&&D.subeler)||{})[sid]||{};if(g.lojman!=null)return sayi(g.lojman);return iscSabitLoj(sid,ak)||0;}
function iscLojSabitMi(D,ak,sid){const g=((D&&D.subeler)||{})[sid]||{};return g.lojman==null&&(iscSabitLoj(sid,ak)||0)>0;}
// SGK bilgisi eksik ya da çelişkili personel (işçilik maliyetini yanlış etkileyebilir).
function sgkSorunlari(ak){const o=[];S.personel.forEach(p=>{if(!aktifAyda(p,ak)||p.sekil==='Esnaf kurye')return;/* esnaf kurye ayrı şirket: SGK uyarısı yok */const n=[];
  if(!p.sgkSube)n.push('SGK şubesi seçilmemiş');
  else if(p.sgkSube===SGK_YOK){if(p.giris||p.cikis&&false)n.push('SGK şubesi "Boş" ama SGK giriş tarihi yazılı');}
  else{if(!p.giris){const d=S.personel.filter(x=>x.id!==p.id&&ayniKisi(x,p)&&x.giris&&sgkVar(x));n.push(d.length?'SGK şubesi var ama giriş boş; aynı kişinin '+d.map(x=>subeAdi(x.sgkSube)+' kaydında SGK girişi '+trTarih(x.giris)+(x.cikis?' – çıkış '+trTarih(x.cikis):'')).join(', ')+' var → bu kayıtta SGK günü sayılmıyor':'SGK şubesi var ama SGK giriş tarihi boş (ay boyu sigortalı sayılır)');}}
  if(p.giris&&p.cikis&&p.cikis<p.giris)n.push('SGK çıkış tarihi girişten önce');
  if(n.length)o.push({ad:p.ad,sorun:n.join(' · '),sube:subeAdi(p.anaSube)});});return o;}
function iscSgkSheet(ak){const L=sgkSorunlari(ak);openSheet(`<h2>SGK bilgisi kontrolü</h2><div class="sub">${ayAdi(ak)} · ${L.length} kişi</div>${L.length?`<div class="tk-wrap"><table class="tk"><thead><tr><th class="l">Kişi</th><th class="l">Şube</th><th class="l">Sorun</th></tr></thead><tbody>${L.map(x=>`<tr><td class="l">${esc(adBuyuk(x.ad))}</td><td class="l">${esc(x.sube)}</td><td class="l">${esc(x.sorun)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="note">Sorun bulunmadı.</p>'}<div class="row2"><button class="btn grow" id="sgkK">Kapat</button></div>`,()=>{byId('sgkK').onclick=closeSheet;});}
export function renderIscilik(h){const ak=iscAyi();iscDinle(ak);const ae=document.activeElement;
  const D=S.iscDoc;const ayar=iscAyar(D&&D.ayar?D:(S.iscOnce&&S.iscOnce.ayar?S.iscOnce:{}));const gir=(D&&D.subeler)||{};const hes=(D&&D.hesap)||{};const once=S.iscOnce||{};
  h+=`<div class="ptnav" style="justify-content:center"><div class="ptay"><button class="nav-arrow" id="iPrev" aria-label="Önceki ay">‹</button><div class="ttl">${ayAdi(ak)}</div><button class="nav-arrow" id="iNext" aria-label="Sonraki ay">›</button></div></div>`;
  if(S.iscHata)h+=`<div class="banner bad">İşçilik verisi okunamıyor. Firebase kurallarını güncelleyin (firestore.rules).</div>`;
  if(D===null){return view(h+`<div class="empty-state"><b>Yükleniyor</b></div>`,()=>iscBagla(ak));}
  const iv=isIsveren();
  if(iv)h+=`<p class="note" style="margin:0 0 6px">Günlük SGK maliyeti ${tl(iscGunluk(ayar))} ₺ (${tl(iscGunluk(ayar)*30)} ÷ 30) <button class="mini" id="iAyar">⚙ Ayarlar</button></p>`;
  if(iv){const sn=sgkSorunlari(ak).length;if(sn)h+=`<div class="banner bad">${sn} kişinin SGK bilgisi eksik ya da çelişkili. <button class="mini" id="iSgk">Listeyi gör</button></div>`;}
  if(iv)h+=`<div class="actions"><button class="btn primary grow" id="iHes" ${S.iscCalisiyor?'disabled':''}>${S.iscCalisiyor?esc(S.iscDurum||'Hesaplanıyor…'):(D&&D.hesapTarihi?'Yeniden hesapla':'Hesapla')}</button></div>`;
  if(D&&D.hesapTarihi)h+=`<p class="note" style="margin-top:0">Son hesap: ${tarihSaat(D.hesapTarihi)}${D.hesaplayan?' · '+esc(D.hesaplayan):''}. ${iv?'Puantajda değişiklik olduysa yeniden hesaplayın.':'Hesabı işveren yapar.'}</p>`;
  if(Object.values(hes).some(x=>x&&x.fv!==2))h+=`<div class="banner bad">Bu ay eski yöntemle hesaplanmış (paket primi Elden'in içinde, bankaya yatan primden düşülmüş). <b>Yeniden hesapla</b>'ya basın.</div>`;
  const IR=S.subeIds.map(sid=>{const g=gir[sid]||{};const x=hes[sid];const c=sayi(g.ciro),lj=iscLoj(D,ak,sid);const top=x?r2(x.toplam+lj):null;
    const o=top!=null?iscOran(top,c):null;const og=((once.hesap||{})[sid]);const oc=sayi(((once.subeler||{})[sid]||{}).ciro);const oo=og?iscOran(og.toplam+iscLoj(once,ayKaydir(ak,-1),sid),oc):null;return{sid,x,c,lj,top,o,oo};});
  const nv=(f,k)=>r=>r.x?tl0(f(r)):'—';
  const IK=[{k:'sube',ad:'Şube',v:r=>subeAdi(r.sid),l:1},{k:'resmi',ad:'Resmi (SGK + maaş)',v:r=>r.x?tl0(r.x.resmi+r.x.banka):'—',n:r=>r.x?r.x.resmi+r.x.banka:-1},{k:'elden',ad:'Elden',v:r=>r.x?tl0(r.x.elden):'—',n:r=>r.x?r.x.elden:-1},
    {k:'paket',ad:'Paket primi',v:r=>r.x?tl0(sayi(r.x.paket)):'—',n:r=>r.x?sayi(r.x.paket):-1},{k:'top',ad:'Toplam işçilik',v:r=>r.top!=null?tl0(r.top):'—',n:r=>r.top!=null?r.top:-1},{k:'oran',ad:'Oran',v:r=>iscYuzde(r.o),n:r=>r.o==null?-1:r.o}];
  S.iscKfSatir={cols:IK,rows:IR};
  const IV=kfUygula('isc',IK,IR);const fa=kfAktifMi('isc');let tc=0,tl_=0,tt=0,tr_=0,te=0,tp=0;
  IV.forEach(r=>{if(r.top!=null){tc+=r.c;tl_+=r.lj;tt+=r.top;tr_+=r.x.resmi+r.x.banka;te+=r.x.elden;tp+=sayi(r.x.paket);}});
  const satir=IV.map(({sid,x,c,lj,top,o,oo})=>{
    const dz=x?{kesin:'<span class="chip ok">Kesin</span>',onayli:'<span class="chip ok">Onaylı</span>',tahmini:'<span class="chip warn">Tahmini</span>'}[x.durum]||'':'';
    return `<tr><td class="l"><button class="mini" data-isd="${esc(sid)}">${esc(subeAdi(sid))}</button> ${dz}<br><small class="mut">Ciro ${c?tl0(c):'girilmedi'}${lj?' · Lojman '+tl0(lj):''}</small></td>
      <td>${x?tl0(x.resmi+x.banka)+(x.gunTop?` <small>(${x.gunTop} gün)</small>`:''):'—'}</td><td>${x?tl0(x.elden):'—'}</td><td>${x?tl0(sayi(x.paket)):'—'}</td><td><b>${top!=null?tl0(top):'—'}</b></td>
      <td><b>${iscYuzde(o)}</b>${oo!=null?`<br><small class="mut">geçen ay ${iscYuzde(oo)}</small>`:''}</td></tr>`;}).join('');
  if(fa)h+=`<div class="kfbar">Filtre açık · ${IV.length} / ${IR.length} şube gösteriliyor, toplamlar sadece görünenler için <button class="mini" id="kfHepsiI">Filtreleri kaldır</button></div>`;
  h+=`<div class="tk-wrap" style="overflow-x:auto"><table class="tk" id="iscT"><thead><tr>${IK.map(c=>kfBaslik('isc',c,c.l?'l':'')).join('')}</tr></thead><tbody>${satir}</tbody>
    <tfoot><tr><td class="l"><b>${fa?`Filtreli toplam · ${IV.length} / ${IR.length} şube`:'Toplam'}</b><br><small class="mut">Ciro ${tl0(tc)}${tl_?' · Lojman '+tl0(tl_):''}</small></td><td>${tl0(tr_)}</td><td>${tl0(te)}</td><td>${tl0(tp)}</td><td><b>${tl0(tt)}</b></td><td><b>${iscYuzde(iscOran(tt,tc))}</b></td></tr></tfoot></table></div>
    <p class="note yardim">Şube adına dokunun: ciro, lojman ve kişi kişi döküm. Toplam işçilik lojman dahildir. Resmi: SGK günü × günlük resmi maliyet (bankaya yatan dahil). Elden: maaş farkı, fazla mesai, ciro primi, ek ödeme − kesinti. Paket primi ödemeler listesinden gelir. Maaş, SGK ve fazla mesai kişinin maaşının ödendiği şubeye yazılır. "Tahmini": ay henüz onaylanmadı, rakamlar değişebilir.</p>`;
  return view(h,()=>iscBagla(ak));}
function iscBagla(ak){document.querySelectorAll('#ySeg button').forEach(b=>b.onclick=()=>{S.ynt=b.dataset.v;render();});const p=byId('iPrev'),n=byId('iNext');if(p)p.onclick=()=>{S.iscAy=ayKaydir(ak,-1);render();};if(n)n.onclick=()=>{S.iscAy=ayKaydir(ak,1);render();};
  const sg=byId('iSgk');if(sg)sg.onclick=()=>iscSgkSheet(ak);
  const hb=byId('iHes');if(hb)hb.onclick=()=>iscilikHesapla(ak);
  if(S.iscKfSatir)kfBagla('isc',S.iscKfSatir.cols,S.iscKfSatir.rows);const kh=byId('kfHepsiI');if(kh)kh.onclick=()=>{const d=kfDurum('isc');d.f={};d.sort=null;render();};
  const ay=byId('iAyar');if(ay)ay.onclick=()=>{const D=S.iscDoc||{};const a=iscAyar(D&&D.ayar?D:(S.iscOnce&&S.iscOnce.ayar?S.iscOnce:{}));
    openSheet(`<h2>İşçilik ayarı</h2><div class="sub">${ayAdi(ak)}</div><label class="field"><span>30 günlük SGK'lı çalışanın aylık maliyeti (₺)</span><input id="iaM" inputmode="decimal" value="${esc(tl(iscGunluk(a)*30))}"></label>
     <p class="note">Bankaya yatan net maaş dahil toplam işveren maliyeti. Günlük maliyet bunun 30'a bölünmesiyle bulunur.</p><div class="row2"><button class="btn grow" id="iaN">Vazgeç</button><button class="btn primary grow" id="iaK">Kaydet</button></div>`,()=>{
      byId('iaN').onclick=closeSheet;byId('iaK').onclick=async()=>{const m=sayi(byId('iaM').value);if(!(m>0)){toast('Tutarı kontrol edin.');return;}
        try{await setDoc(doc(db,'iscilik',ak),{ay:ak,ayar:{aylik:m}},{merge:true});closeSheet();toast('Kaydedildi. Rakamlara yansıması için yeniden hesaplayın.');}catch(e){yazmaHatasi(e);}};});};
  document.querySelectorAll('[data-isd]').forEach(b=>b.onclick=()=>iscSube(ak,b.dataset.isd));}
// Şube penceresi: ciro ve lojman girişi + kişi kişi döküm.
function iscSube(ak,sid){const D=S.iscDoc||{};const x=(D.hesap||{})[sid];const g=(D.subeler||{})[sid]||{};const c=sayi(g.ciro),lj=iscLoj(D,ak,sid),sab=iscLojSabitMi(D,ak,sid);const top=x?r2(x.toplam+lj):null;
  const L=S.subeIds,sn=L[L.indexOf(sid)+1]||null;let dok='';
  if(x){const grup=k=>x.kisi.filter(y=>y.grup===k);const satir=y=>`<tr><td class="l">${esc(adBuyuk(y.ad))}</td><td>${y.gun||'—'}</td><td>${tl0(y.resmi+y.banka)}${y.gun?` <small>(${y.gun} gün)</small>`:''}</td><td>${tl0(y.elden)}</td><td>${tl0(sayi(y.paket))}</td><td><b>${tl0(y.toplam)}</b></td></tr>`;
    const bolum=GRUP_SIRA.filter(k=>grup(k).length).map(k=>`<tr><td class="l" colspan="5"><b>${GRUP[k]}</b> · ${grup(k).length} kişi</td><td><b>${tl0(x.gruplar[k]||0)}</b></td></tr>`+grup(k).map(satir).join('')).join('');
    dok=`${x.fv!==2?'<div class="banner bad">Bu ay eski yöntemle hesaplanmış. İşçilik ekranında Yeniden hesapla\'ya basın.</div>':''}${x.ozetHata?'<div class="banner bad">Diğer şubelerin özetleri okunamadı; rakamlar eksik olabilir. Yeniden hesaplayın.</div>':''}
   <div class="tk-wrap" style="overflow-x:auto"><table class="tk"><thead><tr><th class="l">Kişi</th><th>SGK gün</th><th>Resmi</th><th>Elden</th><th>Paket primi</th><th>Toplam</th></tr></thead><tbody>${bolum}</tbody>
   <tfoot><tr><td class="l">Lojman</td><td></td><td></td><td></td><td></td><td>${tl0(lj)}</td></tr><tr><td class="l"><b>Toplam işçilik</b></td><td></td><td>${tl0(x.resmi+x.banka)}${x.gunTop?` <small>(${x.gunTop} gün)</small>`:''}</td><td>${tl0(x.elden)}</td><td>${tl0(sayi(x.paket))}</td><td><b>${tl0(top)}</b></td></tr></tfoot></table></div>
   <p class="note">Oran <b>${iscYuzde(iscOran(top,c))}</b>. Resmi: SGK günü × günlük resmi maliyet (bankaya yatan dahil); SGK'sız ve esnaf kuryede bankaya yatan. Elden: maaş farkı, fazla mesai, ciro primi, ek ödeme − kesinti. Paket primi ödemeler listesinden gelir.</p>`;}
  else dok=`<p class="note">Bu ay henüz hesaplanmadı. İşçilik ekranında Hesapla'ya basın.</p>`;
  openSheet(`<h2>${esc(subeAdi(sid))} · İşçilik</h2><div class="sub">${ayAdi(ak)}${x?' · '+(x.durum==='kesin'?'kesin':x.durum==='onayli'?'onaylı':'tahmini')+' · '+x.kisiSay+' kişi':''}</div>
   ${isIsveren()?`   <div class="fgrid"><label class="field"><span>Ciro (KDV dahil, ₺)</span><input id="icC" inputmode="decimal" value="${c?esc(tl(c)):''}" placeholder="0"></label><label class="field"><span>Lojman (₺)</span><input id="icL" inputmode="decimal" value="${lj?esc(tl(lj)):''}" placeholder="Yok"></label></div>
   <label class="check" style="margin:2px 0 8px"><input type="checkbox" id="icS" ${sab?'checked':''}> Lojman her ay aynı (bu aydan itibaren)</label>
   <p class="note" style="margin-top:0">Her ay aynı işaretliyse tutar sonraki aylara da geçer; değişirse yeni tutarı o ay işaretli kaydedin. Lojmanı kaldırmak için işaretli bırakıp boş kaydedin.</p>
   <div class="row2"><button class="btn grow" id="icK">Kaydet</button>${sn?`<button class="btn primary grow" id="icN">Kaydet, sonraki şube ›</button>`:''}</div>`:`<p class="note">Ciro ${c?tl0(c):'girilmedi'} · Lojman ${lj?tl0(lj):'yok'} (işveren girer)</p>`}
   ${dok}<div class="row2"><button class="btn grow" id="iDK">Kapat</button></div>`,()=>{
    byId('iDK').onclick=closeSheet;
    const kaydet=async()=>{const cv=byId('icC').value.trim()?sayi(byId('icC').value):0;const lv=byId('icL').value.trim()?sayi(byId('icL').value):0;const sb=byId('icS').checked;
      if(!(cv>=0)||!(lv>=0)){toast('Geçersiz tutar.');return false;}
      try{const yaz={ciro:cv};
        if(sb){yaz.lojman=deleteField();if(iscLojSabitMi(D,ak,sid)?iscSabitLoj(sid,ak)!==lv:true)await setDoc(doc(db,'iscilik','sabit'),{lojman:{[sid]:{[ak]:lv}}},{merge:true});}
        else yaz.lojman=lv;
        await setDoc(doc(db,'iscilik',ak),{ay:ak,subeler:{[sid]:yaz}},{merge:true});return true;}
      catch(e){yazmaHatasi(e);return false;}};
    const kb=byId('icK');if(kb)kb.onclick=async()=>{if(await kaydet()){toast('Kaydedildi.');closeSheet();}};
    const nb=byId('icN');if(nb)nb.onclick=async()=>{if(await kaydet()){toast('Kaydedildi.');iscSube(ak,sn);}};});}
function ibanBagla(){const ibA=byId('ibanAy');if(ibA)ibA.onchange=()=>{S.ibanAy=ibA.value;render();};const ibK=byId('ibanKop');if(ibK)ibK.onclick=async()=>{toast(await panoyaYaz(ibanMetin(ibanAyi()))?'Liste kopyalandı. WhatsApp\'a yapıştırabilirsiniz.':'Kopyalanamadı.');};const ibX=byId('ibanXls');if(ibX)ibX.onclick=()=>ibanExcel(ibanAyi());}
// Yönetim → IBAN: işverene IBAN listesi (eskiden Personel ekranının üstündeydi).
export function renderIbanBolum(h){h+=ibanKutusu();view(h,()=>{document.querySelectorAll('#ySeg button').forEach(b=>b.onclick=()=>{S.ynt=b.dataset.v;render();});ibanBagla();});}
export function renderYedek(h){const son=tryLS('pm.sonYedek');const gun=son?Math.floor((Date.now()-Date.parse(son))/86400000):null;
  h+=`<div class="card" style="padding:14px">
    <h3 style="margin:0 0 6px">Veritabanı yedeği</h3>
    <p class="note" style="margin-top:0">Bütün şubelerin çizelgeleri, personel listesi, puantajlar, ödemeler, maaşlar ve kullanıcılar tek dosya olarak bilgisayarınıza iner. Ücretsiz Firebase planında otomatik yedek yok; <b>haftada en az bir kez</b> ve her ay sonu onayından sonra alın.</p>
    ${son?`<div class="banner ${gun>=7?'bad':'ok'}">Bu cihazda son yedek: ${tarihSaat(son)}${gun>=1?` (${gun} gün önce)`:''}${gun>=7?' · Yeni yedek alın.':''}</div>`:`<div class="banner bad">Bu cihazda henüz yedek alınmadı.</div>`}
    <div class="actions"><button class="btn primary grow" id="yedekB">Yedek indir</button></div><div id="yedekD" class="note"></div>
    <p class="note">Dosyada maaş, TC ve IBAN bilgileri var; kimseyle paylaşmayın, bilgisayarda ya da kendi bulut klasörünüzde saklayın. Silinen bir veriyi geri getirmek gerekirse bu dosya kullanılır. Yedek alırken tüm kayıtlar okunduğu için günlük okuma kotasından birkaç bin okuma harcanır.</p></div>`;
  h+=`<div class="card" style="padding:14px;margin-top:12px"><h3 style="margin:0 0 6px">Veri kontrolü</h3><p class="note" style="margin-top:0">Bütün şubelerin haftalarını tarar: o şubeyle ilgisi olmayan kişilere ait hücreleri (ör. eski şube karışması hatasından kalan) ve silinmiş kişilere ait kayıtları listeler. Hiçbir şeyi değiştirmez.</p>
    <div class="actions"><button class="btn grow" id="kontrolB">Kontrol et</button></div><div id="kontrolD"></div></div>`;
  view(h,()=>{document.querySelectorAll('#ySeg button').forEach(b=>b.onclick=()=>{S.ynt=b.dataset.v;render();});
    const kb=byId('kontrolB');kb.onclick=async()=>{kb.disabled=true;kb.textContent='Taranıyor…';const D2=byId('kontrolD');
      try{const L=await veriKontrolu();D2.innerHTML=L.length?`<div class="banner bad">${L.length} sorunlu kayıt bulundu.</div><div class="card list">${L.map(x=>`<button class="row" data-ks="${esc(x.sid)}" data-kw="${esc(x.wid)}"><div class="m"><b>${esc(x.ad)}</b><span>${esc(subeAdi(x.sid))} · ${rangeLabel(x.wid)} · ${esc(x.neden)}${x.dolu?` · ${x.dolu} dolu gün`:''}</span></div><span class="ch">›</span></button>`).join('')}</div><p class="note">Satıra dokununca o haftanın çizelgesi açılır. Yanlış şubeye yazılmış kişiyi isminden "Bu haftadan çıkar" ile çıkarın; saatleri doğru şubede yoksa oraya girin.</p>`:'<div class="banner ok">Sorunlu kayıt bulunmadı.</div>';
        D2.querySelectorAll('[data-ks]').forEach(r=>r.onclick=()=>{S.tab='cizelge';tryLS('pm.tab','cizelge');S.hafta=r.dataset.kw;if(S.subeId!==r.dataset.ks)selectSube(r.dataset.ks);else render();window.scrollTo(0,0);});}
      catch(e){console.error(e);D2.innerHTML=`<div class="banner bad">Kontrol yapılamadı: ${esc(e.code||e.message||'')}</div>`;}kb.disabled=false;kb.textContent='Kontrol et';};
    const b=byId('yedekB'),D=byId('yedekD');b.onclick=async()=>{b.disabled=true;b.textContent='Yedek alınıyor…';
      try{const Y=await yedekAl(m=>{D.textContent=m;});const t=new Date();const ad=`Puantaj-yedek-${ymd(t)}-${String(t.getHours()).padStart(2,'0')}.${String(t.getMinutes()).padStart(2,'0')}.json`;
        const f=new File([JSON.stringify(Y)],ad,{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=ad;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
        tryLS('pm.sonYedek',t.toISOString());toast(`Yedek indirildi: ${Y.belgeSayisi} kayıt, ${Y.subeSayisi} şube.`);render();}
      catch(e){console.error(e);const msj='Yedek alınamadı, hiçbir dosya inmedi: '+((e&&(e.code||e.message))||'bilinmeyen hata')+'. İnternet bağlantısını kontrol edip tekrar deneyin.';D.textContent=msj;b.disabled=false;b.textContent='Yedek indir';toast(msj);}};});}

