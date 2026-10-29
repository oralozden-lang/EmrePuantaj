// paylas.js — app.js (v180) satırları 2253-2296. Otomatik bölündü; davranış değişmedi.
import { AY, BOS_RENK, GRUP, GRUP_SIRA, GUNU, KOD, KOD_RENK, KOD_SIRA } from './sabitler.js';
import { S, tryLS } from './durum.js';
import { esc, fmt, gosterAy, isShift, rangeLabel, sg, shiftKind, weekDays } from './yardimci.js';
import { cellOf, isEsnaf, sube } from './hesap.js';
import { fmAyi } from './fm-donem.js';
import { bosSayilir, cokSubeli, digerGunler } from './cok-sube.js';
import { ayKadarS, cizelgeKisileri, gunKaydiP, haftaHesapS, kisaSubeAd } from './kadro.js';
import { haftaAyari } from './hucre-yazma.js';
import { byId } from './cerceve.js';
import { openSheet, toast } from './panel.js';
import { trBuyukBas } from './odeme-cikti.js';
import { jspdfLib } from './muhasebe-cikti.js';

/* ================= Paylaş (görsel) ================= */
async function cizelgeGorseli(withFm,gruplar){const wid=S.hafta;const sb=haftaAyari(wid);const ds=weekDays(wid);const ak=gosterAy(wid);const kisiler=cizelgeKisileri(wid).filter(p=>!gruplar||gruplar.includes(p.grup||'K'));
  try{await document.fonts.ready;}catch(e){}
  const C={navy:'#1f3a6b',ink:'#152033',mut:'#667287',line:'#d9dee8',open:'#fbe58a',openI:'#4a3a00',close:'#f0b24d',closeI:'#3c2500',code:'#e9edf3',codeI:'#33415a',bg:'#ffffff',soft:'#f3f5f9'};
  const pad=28,nameW=240,dayW=150,fmW=withFm?96:0,rowH=42,groupH=34,headH=100,dayH=62;const groups=new Set(kisiler.map(p=>p.grup||'K'));
  const W=pad*2+nameW+dayW*7+fmW*2,H=headH+dayH+kisiler.length*rowH+groups.size*groupH+70;const cv=document.createElement('canvas');cv.width=W*2;cv.height=H*2;const x=cv.getContext('2d');x.scale(2,2);
  const F=(w,s,n)=>`${w} ${s}px ${n?'"Barlow Semi Condensed","Arial Narrow",sans-serif':'Figtree,system-ui,sans-serif'}`;
  const rr=(X,Y,w,h,r,fill)=>{x.beginPath();x.roundRect?x.roundRect(X,Y,w,h,r):x.rect(X,Y,w,h);x.fillStyle=fill;x.fill();};
  x.fillStyle=C.bg;x.fillRect(0,0,W,H);x.fillStyle=C.navy;x.fillRect(0,0,W,78);x.fillStyle='#fff';x.textBaseline='middle';x.font=F(800,28);x.fillText(`${sb.ad} · Haftalık çizelge${gruplar&&gruplar.length<3?' · '+gruplar.map(g=>GRUP[g]).join(' + '):''}`,pad,30);
  x.font=F(600,16);x.globalAlpha=.8;x.fillText(`${rangeLabel(wid)}  ·  Açılış ${sb.acilis}  ·  Kapanış ${sb.kapanis}`,pad,58);x.globalAlpha=1;let y=headH;x.textAlign='center';
  ds.forEach((d,i)=>{const X=pad+nameW+i*dayW;rr(X+3,y,dayW-6,dayH-6,9,C.soft);x.fillStyle=C.ink;x.font=F(800,18);x.fillText(GUNU[i].toLocaleUpperCase('tr-TR'),X+dayW/2,y+19);x.fillStyle=C.navy;x.font=F(700,15.5);x.fillText(`${d.getDate()} ${AY[d.getMonth()]}`,X+dayW/2,y+41);});
  const FMR=[{bg:'#dbeafe',yazi:'#1e3a8a',alt:'#3b5b9a',hb:'#c7dcfb'},{bg:'#1f3a6b',yazi:'#ffffff',alt:'#c9d6ee',hb:'#16305c'}];
  if(withFm)[['Bu hafta','fazla mesai'],[`${AY[+fmAyi(wid,sb).slice(5)-1]}`,'bu haftaya kadar']].forEach(([t,a2],j)=>{const X=pad+nameW+7*dayW+j*fmW;const R=FMR[j];rr(X+3,y,fmW-6,dayH-6,9,R.hb);x.fillStyle=R.yazi;x.font=F(800,14.5);x.fillText(t,X+fmW/2,y+20);x.fillStyle=R.alt;x.font=F(600,12);x.fillText(a2,X+fmW/2,y+40);});
  y+=dayH;let son=null;
  kisiler.forEach(p=>{const g=p.grup||'K';if(g!==son){son=g;x.textAlign='left';x.fillStyle=C.navy;x.font=F(800,14);x.fillText(GRUP[g].toLocaleUpperCase('tr-TR'),pad+2,y+groupH/2+2);x.fillStyle=C.line;x.fillRect(pad+90,y+groupH/2+2,W-pad*2-90,1);y+=groupH;}
    x.textAlign='left';x.fillStyle=C.ink;x.font=F(700,16);x.fillText(p.ad.toLocaleUpperCase('tr-TR'),pad+2,y+rowH/2,nameW-10);x.textAlign='center';
    ds.forEach((d,i)=>{const X=pad+nameW+i*dayW+3,Y=y+3,w=dayW-6,hh=rowH-6;const q=gunKaydiP(p,d);if(!q){x.fillStyle=C.mut;x.font=F(600,15);x.fillText('—',X+w/2,Y+hh/2);return;}const v=cellOf(q.id,wid,i);
      if(isShift(v)){const k=shiftKind(v,sb);const[a,b]=v.split('-');const hw=(w-4)/2;rr(X,Y,hw,hh,7,k.o?C.open:C.soft);rr(X+hw+4,Y,hw,hh,7,k.k?C.close:C.soft);x.font=F(700,18,1);x.fillStyle=k.o?C.openI:C.ink;x.fillText(a,X+hw/2,Y+hh/2+1);x.fillStyle=k.k?C.closeI:C.ink;x.fillText(b,X+hw+4+hw/2,Y+hh/2+1);}
      else if(v&&KOD[v]){const kr=KOD_RENK[v]||[C.code,C.codeI];rr(X,Y,w,hh,7,kr[0]);x.fillStyle=kr[1];x.font=F(800,13);x.fillText(KOD[v].ad.toLocaleUpperCase('tr-TR'),X+w/2,Y+hh/2+1);}
      else if(cokSubeli(q)&&digerGunler(q,d)){const s2=Object.keys(digerGunler(q,d))[0];rr(X,Y,w,hh,7,C.soft);x.fillStyle=C.mut;x.font=F(700,13);x.fillText(kisaSubeAd(s2).toLocaleUpperCase('tr-TR'),X+w/2,Y+hh/2+1,w-8);}
      else if(!bosSayilir(q,d))rr(X,Y,w,hh,7,C.soft);
      else{rr(X,Y,w,hh,7,BOS_RENK);x.strokeStyle='#f0b4b4';x.setLineDash([4,4]);x.beginPath();x.roundRect?x.roundRect(X+.5,Y+.5,w-1,hh-1,7):x.rect(X,Y,w,hh);x.stroke();x.setLineDash([]);}});
    if(withFm){const wk=haftaHesapS(p,wid,sb),ay=ayKadarS(p,wid,sb);const vals=isEsnaf(p)||p.sekil==='Part'?[fmt(wk.h)+' sa',fmt(ay.h)+' sa']:[sg(wk.fm),sg(ay.fm)];vals.forEach((t,j)=>{const X=pad+nameW+7*dayW+j*fmW;const R=FMR[j];rr(X+3,y+3,fmW-6,rowH-6,7,R.bg);x.fillStyle=R.yazi;x.font=F(j?800:700,17,1);x.fillText(t,X+fmW/2,y+rowH/2+1);});}
    y+=rowH;});
  x.textAlign='left';x.font=F(600,12.5);let lx=pad;y+=22;[[C.open,'Açılış saati'],[C.close,'Kapanış saati'],...KOD_SIRA.filter(k=>k!=='B').map(k=>[KOD_RENK[k][0],KOD[k].ad])].forEach(([c,t])=>{rr(lx,y-7,14,14,3,c);x.fillStyle=C.mut;x.fillText(t,lx+20,y);lx+=x.measureText(t).width+44;});
  return cv;}
export function paylas(){let fm=tryLS('pm.shareFm')!=='0';let tur=tryLS('pm.czTur')||'png';let gr=GRUP_SIRA.slice();const baslikF=()=>`${trBuyukBas(sube().ad)} Şube ${rangeLabel(S.hafta)} Haftalık Çizelge${gr.length<3?' - '+gr.map(g=>GRUP[g]).join(' + '):''}`;let baslik=baslikF();
  openSheet(`<h2>Çizelgeyi paylaş</h2><div class="sub" id="shBaslik">${esc(baslik)}</div>
   <div class="seg" id="shTur" style="margin-bottom:8px"><button data-v="png" class="${tur==='png'?'on':''}">Fotoğraf</button><button data-v="pdf" class="${tur==='pdf'?'on':''}">PDF</button></div>
   <div class="seg" id="shGr" style="margin-bottom:8px">${GRUP_SIRA.map(g=>`<button data-g="${g}" class="on">${GRUP[g]}</button>`).join('')}</div><label class="check"><input type="checkbox" id="shFm" ${fm?'checked':''}> Fazla mesai sütunlarını ekle (hafta ve ay toplamı)</label><img class="share-prev" id="shImg" alt="Çizelge görseli">
   <div class="row2"><button class="btn grow" id="shSave">İndir</button><button class="btn primary grow" id="shShare">WhatsApp / Paylaş</button></div>`,async()=>{let cv=null;
   const yap=async()=>{cv=await cizelgeGorseli(byId('shFm').checked,gr);byId('shImg').src=cv.toDataURL('image/png');};
   byId('shFm').onchange=e=>{tryLS('pm.shareFm',e.target.checked?'1':'0');yap();};
   byId('shGr').querySelectorAll('button').forEach(b=>b.onclick=()=>{const g=b.dataset.g;const n=gr.includes(g)?gr.filter(q=>q!==g):GRUP_SIRA.filter(q=>q===g||gr.includes(q));if(!n.length)return;gr=n;baslik=baslikF();byId('shGr').querySelectorAll('button').forEach(q=>q.classList.toggle('on',gr.includes(q.dataset.g)));byId('shBaslik').textContent=baslik;yap();});
   byId('shTur').querySelectorAll('button').forEach(b=>b.onclick=()=>{tur=b.dataset.v;tryLS('pm.czTur',tur);byId('shTur').querySelectorAll('button').forEach(q=>q.classList.toggle('on',q===b));});
   const dosya=async()=>{if(!cv)await yap();if(tur==='png'){const b=await new Promise(r=>cv.toBlob(r,'image/png'));return new File([b],baslik+'.png',{type:'image/png'});}
     const J=await jspdfLib();const w=cv.width/2*0.75,h=cv.height/2*0.75;const pdf=new J({orientation:w>h?'l':'p',unit:'pt',format:[w,h]});pdf.addImage(cv.toDataURL('image/png'),'PNG',0,0,w,h);pdf.setProperties({title:baslik});return new File([pdf.output('blob')],baslik+'.pdf',{type:'application/pdf'});};
   const indir=f=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);};
   byId('shSave').onclick=async()=>{try{indir(await dosya());}catch(e){toast('Dosya hazırlanamadı.');}};
   byId('shShare').onclick=async()=>{let f;try{f=await dosya();}catch(e){toast('Dosya hazırlanamadı.');return;}
     try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:baslik,text:baslik});return;}}catch(e){if(e&&e.name==='AbortError')return;}
     indir(f);window.open('https://wa.me/?text='+encodeURIComponent(baslik),'_blank');};
   await yap();});}

