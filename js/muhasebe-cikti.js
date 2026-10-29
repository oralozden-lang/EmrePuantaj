// muhasebe-cikti.js — app.js (v180) satırları 2087-2141. Otomatik bölündü; davranış değişmedi.
import { AY } from './sabitler.js';
import { S, tryLS } from './durum.js';
import { ayKaydir, esc, fmt, today, trTarih, ymd } from './yardimci.js';
import { muhGorev, muhasebedeMi } from './puantaj-hesap.js';
import { byId } from './cerceve.js';
import { openSheet, toast } from './panel.js';
import { trBuyukBas } from './odeme-cikti.js';

function muhBaslik(V){return `${trBuyukBas(V.sb.ad)} Şube ${AY[+V.ak.slice(5)-1]} Ayı Puantaj Verisi`;}
export const MUH_TEMA={
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

