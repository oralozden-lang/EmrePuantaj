// bordro-ocr.js — app.js (v180) satırları 2142-2183. Otomatik bölündü; davranış değişmedi.
import { sayi } from './yardimci.js';
import { tcGecerli } from './bilgi-dogrulama.js';

/* ================= Bordro PDF okuma ================= */
let pdfjsYuklendi=null;function pdfjs(){if(pdfjsYuklendi)return pdfjsYuklendi;pdfjsYuklendi=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';ok(window.pdfjsLib);};s.onerror=no;document.head.appendChild(s);});return pdfjsYuklendi;}
export async function pdfSatirlari(file){const lib=await pdfjs();const pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise;const lines=[];
  for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const tc=await page.getTextContent();const rows=[];
    tc.items.forEach(it=>{if(!it.str.trim())return;const y=it.transform[5],x=it.transform[4];let r=rows.find(r=>Math.abs(r.y-y)<2.5);if(!r){r={y,items:[]};rows.push(r);}r.items.push({x,s:it.str});});
    rows.sort((a,b)=>b.y-a.y).forEach(r=>lines.push(r.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join('  ')));}
  return lines;}
// ---- Tekli "Ücret Hesap Pusulası" (tek kişilik bordro) ----
const PARA_RE=/-?\d{1,3}(?:\.\d{3})*,\d{2}/;
// Alanlardan bordro satırı üretir. Net tutar, "Kazanç toplam − Kesintiler toplamı" ile çapraz kontrol edilir; tutmazsa net boş bırakılır (yanlış tutar işlenmesin).
function pusulaKayit(a){const uyari=[];let net=a.net,tc=a.tc||'';
  if(a.ocr){if(tc&&!tcGecerli(tc)){uyari.push('TC okunamadı');tc='';}
    if(a.kazanc!=null&&a.kesinti!=null&&net!=null){if(Math.abs(a.kazanc-a.kesinti-net)>0.02){uyari.push('Net tutar doğrulanamadı, elle girin');net=null;}}
    else if(net!=null)uyari.push('Tutar doğrulanamadı, kontrol edin');}
  if(net==null&&!uyari.length)uyari.push('Net tutar okunamadı');
  const dm=String(a.donem||'').match(/(\d{2})\s*\/\s*(\d{4})/);
  return{ad:String(a.ad||'').replace(/\s+/g,' ').trim(),tc,giris:'',sgkGun:a.ssk==null?null:a.ssk,eksikGun:a.eksik||0,neden:'',net,isyeri:String(a.isyeri||'').replace(/\s+/g,' ').trim(),donemKey:dm?dm[2]+'-'+dm[1]:null,ocr:!!a.ocr,uyari};}
// Yazı katmanı olan pusula PDF'i: sayfa başına bir pusula ("ÜCRET HESAP PUSULASI" başlığıyla ayrılır).
export function pusulaCoz(lines){const out={isyeri:null,donem:null,kisiler:[],toplam:null};const metin=lines.join('\n');
  metin.split(/ÜCRET\s+HESAP\s+PUSULASI/i).slice(1).forEach(b=>{const g=(re,i=1)=>{const m=b.match(re);return m?m[i]:null;};
    const para=re=>{const m=b.match(re);return m?sayi(m[1]):null;};
    const ad=g(/Ad\s*Soyad\s*:?\s*([^\n]+?)\s+(?:Bordro|$)/m),net=para(/Net\s*Ödenen\s*:?\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})/i);if(!ad||net==null)return;
    const ssk=g(/Gün\s*Sayısı\s+(\d+)/),ek=g(/Eksik\s*Gün\s*:?\s*(YOK|\d+)/i);
    const k=pusulaKayit({ad,isyeri:g(/İşyeri\s*:?\s*([^\n]+?)\s+İşyeri\s*No/m),donem:g(/Dönem\s*:?\s*(\d{2}\s*\/\s*\d{4})/),tc:g(/Vatandaş\s*No\s*:?\s*(\d{11})/),ssk:ssk==null?null:+ssk,eksik:ek&&/^\d+$/.test(ek)?+ek:0,net});out.kisiler.push(k);});
  if(out.kisiler.length){out.isyeri=out.kisiler[0].isyeri;const dk=out.kisiler[0].donemKey;out.donem=dk?dk.slice(5)+'/'+dk.slice(0,4):null;}return out;}
// Yazı katmanı olmayan pusula (ör. "Microsoft Print to PDF" ile alınmış, yazılar çizgi olarak çizilmiş): sayfa görüntüye çevrilir, sabit şablondaki kutular tek tek OCR ile okunur.
// Kutular A4 dikey sayfada 909×1286 piksellik (110 dpi) referansa göre [sol, üst, sağ, alt].
const PUSULA_KUTU={ad:[190,66,470,86],isyeri:[190,89,470,107],donem:[190,130,470,150],tc:[610,173,880,193],ssk:[192,308,305,332],eksik:[30,364,200,382],kazanc:[322,683,443,703],kesinti:[322,727,443,746],net:[322,832,443,853]};
let tesseractYuklendi=null;function tesseractLib(){if(tesseractYuklendi)return tesseractYuklendi;tesseractYuklendi=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=()=>ok(window.Tesseract);s.onerror=()=>{tesseractYuklendi=null;no(new Error('OCR kütüphanesi yüklenemedi'));};document.head.appendChild(s);});return tesseractYuklendi;}
let ocrIsci=null;async function ocrWorker(){if(!ocrIsci){const T=await tesseractLib();ocrIsci=await T.createWorker('eng');}return ocrIsci;}
export async function pusulaOcr(file,durum){const lib=await pdfjs();const pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise;const w=await ocrWorker();const out={isyeri:null,donem:null,kisiler:[],toplam:null};
  const oku=async(cv,k,rakam)=>{const[x0,y0,x1,y1]=PUSULA_KUTU[k];const f=cv.width/909;const c=document.createElement('canvas');c.width=Math.round((x1-x0)*f);c.height=Math.round((y1-y0)*f);c.getContext('2d').drawImage(cv,x0*f,y0*f,c.width,c.height,0,0,c.width,c.height);
    await w.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:rakam||''});return((await w.recognize(c)).data.text||'').trim();};
  for(let p=1;p<=pdf.numPages;p++){if(durum)durum(`Görselden okunuyor… sayfa ${p}/${pdf.numPages}`);const page=await pdf.getPage(p);const v0=page.getViewport({scale:1});
    if(Math.abs(v0.width/v0.height-909/1286)>0.03)continue;// beklenen A4 dikey şablon değil
    const vp=page.getViewport({scale:2480/v0.width});const cv=document.createElement('canvas');cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);await page.render({canvasContext:cx,viewport:vp}).promise;
    const para=async k=>{const m=(await oku(cv,k,'0123456789.,-')).match(PARA_RE);return m?sayi(m[0]):null;};
    const ad=(await oku(cv,'ad')).replace(/[^A-Za-zÇĞİÖŞÜçğıöşü ]/g,' ').replace(/\s+/g,' ').trim();if(!ad)continue;
    const net=await para('net'),kazanc=await para('kazanc'),kesinti=await para('kesinti');const ssk=(await oku(cv,'ssk','0123456789')).match(/\d+/);const ek=(await oku(cv,'eksik')).match(/Eksik\s*G\S*\s*:?\s*(\d+)/i);
    out.kisiler.push(pusulaKayit({ad,isyeri:await oku(cv,'isyeri'),donem:await oku(cv,'donem','0123456789/'),tc:((await oku(cv,'tc','0123456789')).match(/\d{11}/)||[''])[0],ssk:ssk?+ssk[0]:null,eksik:ek?+ek[1]:0,net,kazanc,kesinti,ocr:true}));}
  if(out.kisiler.length){out.isyeri=out.kisiler[0].isyeri;const dk=out.kisiler[0].donemKey;out.donem=dk?dk.slice(5)+'/'+dk.slice(0,4):null;}return out;}
