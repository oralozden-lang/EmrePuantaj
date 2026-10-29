// cikti.js — app.js (v180) satırları 2020-2141. Otomatik bölündü; davranış değişmedi.
import { AY } from './sabitler.js';
import { S, tryLS } from './durum.js';
import { ayKaydir, esc, fmt, tl, tl0, today, trTarih, ymd } from './yardimci.js';
import { muhGorev, muhasebedeMi } from './cok-sube.js';
import { byId } from './cerceve.js';
import { openSheet, toast } from './panel.js';

/* ================= Muhasebe çıktısı ================= */
/* ================= Muhasebe çıktısı: görsel / PDF, paylaş ================= */
export function trBuyukBas(t){return String(t||'').toLocaleLowerCase('tr-TR').split(/(\s+)/).map(w=>w.trim()?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join('');}
/* ---- Ödeme listesi paylaşımı: kişi seçerek (hepsi seçili gelir), üstte seçilenlerin toplamı ----
   Sade: ad + gün + kalan ödeme (çalışanlara). Ayrıntılı: ödemeler tablosunun sütunları (müdüre). */
function odBaslik(V){return `${trBuyukBas(V.sb.ad)} Şube ${AY[+V.ak.slice(5)-1]} Ayı Ödeme Listesi`;}
function odToplam(L){return L.reduce((t,x)=>{const h=x.hes;t.hak+=(h.pb?0:h.hak)+h.fmTl+h.paketPrimi+h.ciroPrimi+(h.ekOd||0);t.bankaya+=h.bankaya;t.avans+=h.avans+h.araOdeme;t.nakit+=Math.max(h.kalan,0);t.kalan+=h.kalan;return t;},{hak:0,bankaya:0,avans:0,nakit:0,kalan:0});}
async function odemeGorseli(V,L,sade){try{await document.fonts.ready;}catch(e){}const T=MUH_TEMA.klasik;
  const tmp=document.createElement('canvas').getContext('2d');const F=(w,s)=>`${w} ${s}px Figtree,system-ui,sans-serif`;const olc=(t,f)=>{tmp.font=f;return tmp.measureText(String(t)).width;};
  const gunY=x=>x.hes.saat?fmt(x.hes.saatSayi)+' sa':x.hes.esnaf||x.hes.maasYok?'—':String(x.sol.hakGun!=null?x.sol.hakGun:x.sol.gun);const t2=v=>Math.abs(v||0)>0.004?tl(v):'';
  const bas=sade?['#','ADI SOYADI','GÜN','ÖDENECEK']:['#','ADI SOYADI','GÜN','HAK EDİLEN','BANKAYA YATAN','FAZLA MESAİ','PRİM','AVANS + ARA ÖD.','ÖDENECEK'];
  const veri=L.map((x,i)=>{const h=x.hes;const ad=String(x.sol.ad).toLocaleUpperCase('tr-TR');return sade?[i+1,ad,gunY(x),tl(h.kalan)]:[i+1,ad,gunY(x),h.pb?'':t2(h.hak+(h.ekOd||0)),t2(h.bankaya),t2(h.fmTl),t2(h.paketPrimi+h.ciroPrimi),t2(h.avans+h.araOdeme),tl(h.kalan)];});
  const son=bas.length-1;const fH=F(800,10.5),fA=F(700,12),fD=F(600,11.5),fK=F(800,12.5);
  const cw=bas.map((b,j)=>Math.ceil(Math.max(olc(b,fH),...veri.map(r=>olc(r[j],j===1?fA:j===son?fK:fD)),j===1?150:24)+(j===1?22:18)));
  const Tp=odToplam(L);const kutu=sade?[['Ödenecek toplam',tl0(Tp.nakit)],['Kişi',String(L.length)]]:[['Hak ediş',tl0(Tp.hak)],['Bankaya yatan',tl0(Tp.bankaya)],['Avans + ara ödeme',tl0(Tp.avans)],['Ödenecek toplam',tl0(Tp.nakit)]];
  const pad=28,tw=cw.reduce((a,b)=>a+b,0),W=Math.max(tw+pad*2,sade?460:720),ox=(W-tw)/2,rowH=26,thH=30,kH=58,top=96+kH+16;const H=top+thH+L.length*rowH+thH+48;
  const cv=document.createElement('canvas');cv.width=W*2;cv.height=H*2;const x=cv.getContext('2d');x.scale(2,2);x.textBaseline='middle';
  x.fillStyle='#fff';x.fillRect(0,0,W,H);
  x.fillStyle=T.bant;x.fillRect(0,0,W,58);x.fillStyle=T.bantYazi;x.font=F(800,18);x.textAlign='left';x.fillText(`${String(V.sb.ad).toLocaleUpperCase('tr-TR')} ŞUBE`,ox,24);
  x.font=F(500,11.5);x.globalAlpha=.85;x.fillText('Ödeme listesi',ox,43);x.globalAlpha=1;
  const ayT=`${AY[+V.ak.slice(5)-1].toLocaleUpperCase('tr-TR')} ${V.ak.slice(0,4)}`;x.font=F(800,13);const aw=olc(ayT,F(800,13))+28;
  x.fillStyle=T.ayKutu;x.beginPath();x.roundRect?x.roundRect(ox+tw-aw,15,aw,28,6):x.rect(ox+tw-aw,15,aw,28);x.fill();x.fillStyle=T.ayYazi;x.textAlign='center';x.fillText(ayT,ox+tw-aw/2,29.5);
  x.textAlign='left';x.fillStyle=T.not;x.font=F(600,11);x.fillText(`${L.length} kişi`,ox,78);x.textAlign='right';x.fillText(`Hazırlayan: ${S.me.adSoyad||S.me.kullaniciAdi||''} · ${trTarih(ymd(today()))}`,ox+tw,78);
  // üstte toplam kutuları (son kutu: ödenecek nakit, vurgulu)
  const kg=8,kw=(tw-kg*(kutu.length-1))/kutu.length;kutu.forEach(([a,v],k)=>{const kx=ox+k*(kw+kg),ky=96;const vur=a==='Ödenecek toplam';
    x.fillStyle=vur?T.bant:T.zebra;x.beginPath();x.roundRect?x.roundRect(kx,ky,kw,kH,8):x.rect(kx,ky,kw,kH);x.fill();
    x.textAlign='left';x.fillStyle=vur?'#fff':T.not;x.font=F(600,11);x.fillText(a,kx+12,ky+18);x.fillStyle=vur?'#fff':'#14202f';x.font=F(800,18);x.fillText(v,kx+12,ky+40);});
  let y=top;x.fillStyle=T.th;x.beginPath();x.roundRect?x.roundRect(ox,y,tw,thH,[6,6,0,0]):x.rect(ox,y,tw,thH);x.fill();let cx=ox;x.font=fH;x.fillStyle=T.thYazi;
  const hiz=j=>j===1?'left':j<=2?'center':'right';const tx=(j,cx)=>j===1?cx+10:j<=2?cx+cw[j]/2:cx+cw[j]-10;
  bas.forEach((b,j)=>{x.textAlign=hiz(j);x.fillText(b,tx(j,cx),y+thH/2+.5);cx+=cw[j];});y+=thH;
  L.forEach((r,i)=>{x.fillStyle=i%2?T.zebra:'#fff';x.fillRect(ox,y,tw,rowH);cx=ox;veri[i].forEach((v,j)=>{x.textAlign=hiz(j);const neg=j===son&&r.hes.kalan<-0.004;x.fillStyle=j===0?T.not:neg?'#c0392b':'#14202f';x.font=j===1?fA:j===son?fK:fD;x.fillText(String(v),tx(j,cx),y+rowH/2+.5);cx+=cw[j];});
    x.fillStyle=T.cizgi;x.fillRect(ox,y+rowH-1,tw,1);y+=rowH;});
  // toplam satırı
  x.fillStyle=T.th;x.fillRect(ox,y,tw,thH);x.fillStyle=T.thYazi;x.font=fK;const tr=sade?['','TOPLAM','',tl(Tp.kalan)]:['','TOPLAM','',tl(L.reduce((a,q)=>a+(q.hes.pb?0:q.hes.hak)+(q.hes.ekOd||0),0)),tl(Tp.bankaya),t2(L.reduce((a,q)=>a+q.hes.fmTl,0)),t2(L.reduce((a,q)=>a+q.hes.paketPrimi+q.hes.ciroPrimi,0)),tl(Tp.avans),tl(Tp.kalan)];
  cx=ox;tr.forEach((v,j)=>{x.textAlign=hiz(j);x.fillText(v,tx(j,cx),y+thH/2+.5);cx+=cw[j];});
  cx=ox;x.fillStyle=T.cizgi;cw.slice(0,-1).forEach(w=>{cx+=w;x.fillRect(cx,top+thH,1,L.length*rowH);});x.strokeStyle=T.cizgi;x.strokeRect(ox+.5,top+.5,tw-1,thH*2+L.length*rowH-1);
  y+=thH+22;x.textAlign='left';x.fillStyle=T.not;x.font=F(500,10.5);if(Tp.kalan<Tp.nakit-0.004)x.fillText('Ödenecek toplam: kalanı artı olanların toplamı (eksi kalanlar ödenmez, sonraki aya devreder).',ox,y);
  return cv;}
async function odemeDosya(V,L,sade,tur){const cv=await odemeGorseli(V,L,sade);const ad=odBaslik(V);
  if(tur==='png'){const b=await new Promise(r=>cv.toBlob(r,'image/png'));return new File([b],ad+'.png',{type:'image/png'});}
  const J=await jspdfLib();const w=cv.width/2*0.75,h=cv.height/2*0.75;const pdf=new J({orientation:w>h?'l':'p',unit:'pt',format:[w,h]});pdf.addImage(cv.toDataURL('image/png'),'PNG',0,0,w,h);
  pdf.setProperties({title:ad});return new File([pdf.output('blob')],ad+'.pdf',{type:'application/pdf'});}
export function odemeCiktisi(V){let tur=tryLS('pm.odTur')||'png';let sade=tryLS('pm.odSade')==='1';const baslik=odBaslik(V);
  const tum=V.satir.slice().sort((a,b)=>String(a.sol.ad).localeCompare(String(b.sol.ad),'tr'));const sec=new Set(tum.map(x=>x.pid));
  openSheet(`<h2>Ödeme listesi paylaş</h2><div class="sub">${esc(baslik)}</div>
   <div class="seg" id="odSade" style="margin-bottom:8px"><button data-v="0" class="${!sade?'on':''}">Ayrıntılı</button><button data-v="1" class="${sade?'on':''}">Sade (ad + ödenecek)</button></div>
   <div class="seg" id="odTur" style="margin-bottom:10px"><button data-v="png" class="${tur==='png'?'on':''}">Fotoğraf</button><button data-v="pdf" class="${tur==='pdf'?'on':''}">PDF</button></div>
   <div class="kpis" id="odTop"></div>
   <div class="actions" style="margin:8px 0 4px"><button class="mini" id="odHepsi">Tümünü seç</button><button class="mini" id="odHicbiri">Tümünü kaldır</button></div>
   <div class="card list" id="odKisi" style="max-height:34vh;overflow:auto">${tum.map(x=>`<label class="kfrow" style="padding:6px 10px"><input type="checkbox" data-od="${esc(x.pid)}" checked> <span style="flex:1"><b>${esc(x.sol.ad)}</b></span><em style="font-style:normal">${tl(x.hes.kalan)}</em></label>`).join('')}</div>
   <img class="share-prev" id="odImg" alt="Ödeme listesi önizleme" style="margin-top:10px">
   <div class="row2"><button class="btn grow" id="odIndir">İndir</button><button class="btn primary grow" id="odPay">WhatsApp / Paylaş</button></div>
   <p class="note">Görmemesi gereken kişilerin işaretini kaldırın; üstteki toplamlar ve görsel sadece seçilenlerden hazırlanır.</p>`,()=>{
   const secili=()=>tum.filter(x=>sec.has(x.pid));let zT;
   const ciz=()=>{const L=secili();const Tp=odToplam(L);byId('odTop').innerHTML=`<div class="kpi"><span>Seçili kişi</span><b>${L.length} / ${tum.length}</b></div><div class="kpi"><span>Hak ediş</span><b>${tl0(Tp.hak)}</b></div><div class="kpi"><span>Bankaya yatan</span><b>${tl0(Tp.bankaya)}</b></div><div class="kpi"><span>Ödenecek toplam</span><b>${tl0(Tp.nakit)}</b></div>`;
     clearTimeout(zT);zT=setTimeout(async()=>{const im=byId('odImg');if(!im)return;if(!L.length){im.removeAttribute('src');return;}const cv=await odemeGorseli(V,L,sade);if(byId('odImg'))byId('odImg').src=cv.toDataURL('image/png');},150);};
   document.querySelectorAll('[data-od]').forEach(c=>c.onchange=()=>{c.checked?sec.add(c.dataset.od):sec.delete(c.dataset.od);ciz();});
   byId('odHepsi').onclick=()=>{tum.forEach(x=>sec.add(x.pid));document.querySelectorAll('[data-od]').forEach(c=>c.checked=true);ciz();};
   byId('odHicbiri').onclick=()=>{sec.clear();document.querySelectorAll('[data-od]').forEach(c=>c.checked=false);ciz();};
   byId('odSade').querySelectorAll('button').forEach(b=>b.onclick=()=>{sade=b.dataset.v==='1';tryLS('pm.odSade',sade?'1':'0');byId('odSade').querySelectorAll('button').forEach(q=>q.classList.toggle('on',q===b));ciz();});
   byId('odTur').querySelectorAll('button').forEach(b=>b.onclick=()=>{tur=b.dataset.v;tryLS('pm.odTur',tur);byId('odTur').querySelectorAll('button').forEach(q=>q.classList.toggle('on',q===b));});
   const indir=f=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);};
   const hazir=async()=>{const L=secili();if(!L.length){toast('Kimse seçilmedi.');return null;}try{return await odemeDosya(V,L,sade,tur);}catch(e){console.error(e);toast('Dosya hazırlanamadı.');return null;}};
   byId('odIndir').onclick=async()=>{const f=await hazir();if(f)indir(f);};
   byId('odPay').onclick=async()=>{const f=await hazir();if(!f)return;try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:baslik,text:baslik});return;}}catch(e){if(e&&e.name==='AbortError')return;}
     indir(f);window.open('https://wa.me/?text='+encodeURIComponent(baslik),'_blank');};
   ciz();});}
function muhBaslik(V){return `${trBuyukBas(V.sb.ad)} Şube ${AY[+V.ak.slice(5)-1]} Ayı Puantaj Verisi`;}
const MUH_TEMA={
  klasik:{ad:'Klasik mavi',bant:'#0f6fc6',bantYazi:'#fff',baslik:'#0b3d6e',ayKutu:'#ffd23f',ayYazi:'#3a2a00',th:'#1593e8',thYazi:'#fff',zebra:'#e9f3fd',cizgi:'#cfe0f1',cik:['#fff1a8','#ffd54a'],cikKen:'#e0b21c',not:'#5a6b80'},
  lacivert:{ad:'Lacivert & altın',bant:'#14284b',bantYazi:'#fff',baslik:'#14284b',ayKutu:'#f2b632',ayYazi:'#2a1d00',th:'#1f3a6b',thYazi:'#fff',zebra:'#eef2f8',cizgi:'#d6deea',cik:['#ffe9a3','#ffcd3c'],cikKen:'#d9a514',not:'#5e6b80'},
  dominos:{ad:'Mavi & kırmızı',bant:'#006491',bantYazi:'#fff',baslik:'#00527a',ayKutu:'#e31837',ayYazi:'#fff',th:'#006491',thYazi:'#fff',zebra:'#e8f3f8',cizgi:'#cde3ec',cik:['#fff2a6','#ffd84d'],cikKen:'#e2b51d',not:'#56697a'}};
async function muhasebeGorseli(V,temaK){try{await document.fonts.ready;}catch(e){}const T=MUH_TEMA[temaK||'klasik']||MUH_TEMA.klasik;
  const rows=V.satir.filter(x=>muhasebedeMi(x.sol)).map(x=>x.sol).sort((a,b)=>String(a.ad).localeCompare(String(b.ad),'tr'));
  const tmp=document.createElement('canvas').getContext('2d');const F=(w,s)=>`${w} ${s}px Figtree,system-ui,sans-serif`;const olc=(t,f)=>{tmp.font=f;return tmp.measureText(String(t)).width;};
  const veri=rows.map((r,i)=>[i+1,r.ad.toLocaleUpperCase('tr-TR'),muhGorev(r).toLocaleUpperCase('tr-TR'),(r.muhSekil||r.sekil||'').toLocaleUpperCase('tr-TR'),trTarih(r.giris),trTarih(r.cikis),r.rapor||'',r.ucretsiz||'',r.partGun?fmt(r.partGun):'',r.yillik||'',r.bayram||'',r.gun??'']);
  const bas=['#','ADI SOYADI','GÖREV','ŞEKİL','GİRİŞ','ÇIKIŞ','RAPOR','ÜCR. İZİN','PART GÜN','YILLIK İZİN','BAYRAM','GÜN SAYISI'];
  const fH=F(800,10.5),fA=F(700,12),fD=F(600,11.5);
  const cw=bas.map((b,j)=>Math.ceil(Math.max(olc(b,fH),...veri.map(r=>olc(r[j],j===1?fA:fD)),j===1?150:24)+(j===1?22:16)));
  const pad=28,tw=cw.reduce((a,b)=>a+b,0),W=Math.max(tw+pad*2,560),ox=(W-tw)/2,rowH=26,thH=30,top=104;const H=top+thH+rows.length*rowH+70;
  const cv=document.createElement('canvas');cv.width=W*2;cv.height=H*2;const x=cv.getContext('2d');x.scale(2,2);x.textBaseline='middle';
  x.fillStyle='#fff';x.fillRect(0,0,W,H);
  // üst bant
  x.fillStyle=T.bant;x.fillRect(0,0,W,58);x.fillStyle=T.bantYazi;x.font=F(800,18);x.textAlign='left';x.fillText(`${String(V.sb.ad).toLocaleUpperCase('tr-TR')} ŞUBE`,ox,24);
  x.font=F(500,11.5);x.globalAlpha=.85;x.fillText('Aylık puantaj verisi',ox,43);x.globalAlpha=1;
  const ayT=`${AY[+V.ak.slice(5)-1].toLocaleUpperCase('tr-TR')} ${V.ak.slice(0,4)}`;x.font=F(800,13);const aw=olc(ayT,F(800,13))+28;
  x.fillStyle=T.ayKutu;x.beginPath();x.roundRect?x.roundRect(ox+tw-aw,15,aw,28,6):x.rect(ox+tw-aw,15,aw,28);x.fill();x.fillStyle=T.ayYazi;x.textAlign='center';x.fillText(ayT,ox+tw-aw/2,29.5);
  x.textAlign='left';x.fillStyle=T.not;x.font=F(600,11);x.fillText(`${rows.length} personel`,ox,80);x.textAlign='right';x.fillText(`Hazırlayan: ${S.me.adSoyad||S.me.kullaniciAdi||''} · ${trTarih(ymd(today()))}`,ox+tw,80);
  // başlık satırı
  let y=top;x.fillStyle=T.th;x.beginPath();x.roundRect?x.roundRect(ox,y,tw,thH,[6,6,0,0]):x.rect(ox,y,tw,thH);x.fill();let cx=ox;x.font=fH;x.fillStyle=T.thYazi;
  bas.forEach((b,j)=>{x.textAlign=j===1?'left':'center';x.fillText(b,j===1?cx+10:cx+cw[j]/2,y+thH/2+.5);cx+=cw[j];});y+=thH;
  rows.forEach((r,i)=>{const cik=r.cikis&&r.cikis<=ayKaydir(V.ak,1)+'-00';
    if(cik){const g=x.createLinearGradient(0,y,0,y+rowH);g.addColorStop(0,T.cik[0]);g.addColorStop(1,T.cik[1]);x.fillStyle=g;}else x.fillStyle=i%2?T.zebra:'#fff';x.fillRect(ox,y,tw,rowH);
    cx=ox;veri[i].forEach((v,j)=>{x.textAlign=j===1?'left':'center';x.fillStyle=j===0?T.not:'#14202f';x.font=j===1?fA:j===11?F(800,12.5):fD;x.fillText(String(v),j===1?cx+10:cx+cw[j]/2,y+rowH/2+.5);cx+=cw[j];});
    x.fillStyle=cik?T.cikKen:T.cizgi;x.fillRect(ox,y+rowH-1,tw,1);y+=rowH;});
  // dikey ince çizgiler
  cx=ox;x.fillStyle=T.cizgi;cw.slice(0,-1).forEach(w=>{cx+=w;x.fillRect(cx,top+thH,1,rows.length*rowH);});
  x.strokeStyle=T.cizgi;x.strokeRect(ox+.5,top+.5,tw-1,thH+rows.length*rowH-1);
  y+=22;const g2=x.createLinearGradient(0,y-6,0,y+6);g2.addColorStop(0,T.cik[0]);g2.addColorStop(1,T.cik[1]);x.fillStyle=g2;x.fillRect(ox,y-6,14,12);x.strokeStyle=T.cikKen;x.strokeRect(ox+.5,y-5.5,13,11);
  x.textAlign='left';x.fillStyle=T.not;x.font=F(600,11);x.fillText('Ay içinde çıkış yapan',ox+20,y);
  const tp=k=>rows.reduce((s,r)=>s+(r[k]||0),0);x.textAlign='right';x.fillText(`Rapor ${tp('rapor')} · Ücretsiz izin ${tp('ucretsiz')} · Yıllık izin ${tp('yillik')} · Bayram ${tp('bayram')} gün`,ox+tw,y);
  x.textAlign='center';x.font=F(500,10);x.fillText(muhBaslik(V),W/2,y+26);
  return cv;}
let jspdfY=null;export function jspdfLib(){if(jspdfY)return jspdfY;jspdfY=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=()=>ok(window.jspdf.jsPDF);s.onerror=no;document.head.appendChild(s);});return jspdfY;}
async function muhasebeDosya(V,tur){const cv=await muhasebeGorseli(V);const ad=muhBaslik(V);
  if(tur==='png'){const b=await new Promise(r=>cv.toBlob(r,'image/png'));return new File([b],ad+'.png',{type:'image/png'});}
  const J=await jspdfLib();const w=cv.width/2*0.75,h=cv.height/2*0.75;const pdf=new J({orientation:w>h?'l':'p',unit:'pt',format:[w,h]});pdf.addImage(cv.toDataURL('image/png'),'PNG',0,0,w,h);
  pdf.setProperties({title:muhBaslik(V)});return new File([pdf.output('blob')],ad+'.pdf',{type:'application/pdf'});}
export function muhasebeCiktisi(V){let tur=tryLS('pm.muhTur')||'pdf';const baslik=muhBaslik(V);
  openSheet(`<h2>Muhasebe çıktısı</h2><div class="sub">${esc(baslik)}</div>
   <div class="seg" id="mTur" style="margin-bottom:10px"><button data-v="pdf" class="${tur==='pdf'?'on':''}">PDF</button><button data-v="png" class="${tur==='png'?'on':''}">Fotoğraf</button></div>
   <img class="share-prev" id="mImg" alt="Puantaj önizleme">
   <div class="row2"><button class="btn grow" id="mIndir">İndir</button><button class="btn primary grow" id="mPay">WhatsApp / Paylaş</button></div>
   <p class="note yardim">Paylaş'a basınca telefonun paylaşım menüsü açılır, WhatsApp'ı seçin; açıklama "${esc(baslik)}" olarak eklenir. Bilgisayarda dosya indirilir ve WhatsApp açılır, dosyayı sohbete sürükleyin.</p>`,async()=>{
   const cv=await muhasebeGorseli(V);byId('mImg').src=cv.toDataURL('image/png');
   byId('mTur').querySelectorAll('button').forEach(b=>b.onclick=()=>{tur=b.dataset.v;tryLS('pm.muhTur',tur);byId('mTur').querySelectorAll('button').forEach(q=>q.classList.toggle('on',q===b));});
   const indir=f=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);};
   byId('mIndir').onclick=async()=>{try{indir(await muhasebeDosya(V,tur));}catch(e){toast('Dosya hazırlanamadı.');}};
   byId('mPay').onclick=async()=>{let f;try{f=await muhasebeDosya(V,tur);}catch(e){toast('Dosya hazırlanamadı.');return;}
     try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:baslik,text:baslik});return;}}catch(e){if(e&&e.name==='AbortError')return;}
     indir(f);window.open('https://wa.me/?text='+encodeURIComponent(baslik),'_blank');};});}

