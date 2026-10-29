// isim-esle.js — app.js (v180) satırları 2374-2415. Otomatik bölündü; davranış değişmedi.
import { SGK_YOK, subeAdi } from './sabitler.js';
import { S } from './durum.js';
import { normTime } from './yardimci.js';
import { toast } from './panel.js';
import { panoyaYaz } from './iban-listesi.js';

/* ================= Excel'den çizelge aktarma (işveren) ================= */
let xlsxYuklendi=null;export function xlsxLib(){if(xlsxYuklendi)return xlsxYuklendi;xlsxYuklendi=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>ok(window.XLSX);s.onerror=no;document.head.appendChild(s);});return xlsxYuklendi;}
export const XKOD={'HAF. İZİN':'HT','HAF.İZİN':'HT','HAFTALIK İZİN':'HT','HAFTA TATİLİ':'HT','İZİN':'HT','ÜCR. İZİN':'UI','ÜCR.İZİN':'UI','ÜCRETSİZ İZİN':'UI','YILLIK İZİN':'YI','YILLIK':'YI','RAPOR':'R','RAPORLU':'R','BAYRAM':'B','DİĞER':'D'};
export function xSerialTarih(v){if(typeof v!=='number'||v<20000)return null;const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');}
export function xSaat(v){if(typeof v==='number'){if(v>=1)v=v%1;const m=Math.round(v*1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}if(typeof v==='string')return normTime(v);return null;}
export function xTarihMetin(v){if(typeof v==='number')return xSerialTarih(v);if(typeof v!=='string')return'';const m=v.trim().match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';}
export function adBaslik(s){return String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w.charAt(0).toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');}
function cikisBildirimMetni(p){const t=(p.cikis||'').split('-');const tar=t.length===3?`${t[2]}.${t[1]}.${t[0]}`:'';const sid=(p.sgkSube&&p.sgkSube!==SGK_YOK)?p.sgkSube:(p.anaSube||'');
  const sk=p.sekil==='Part'?'Part time':'Tam zamanlı';
  return `ÇIKIŞ BİLDİRİMİ\n\nAdı Soyadı: ${adBuyuk(p.ad)}\nŞube: ${subeAdi(sid)}\nÇıkış tarihi: ${tar}\nÇıkış nedeni: İstifa\nÇalışma şekli: ${sk}`;}
export async function cikisBildirimKopyala(p,ek){const ok=await panoyaYaz(cikisBildirimMetni(p));toast(ok?(ek||'')+'Çıkış bildirimi kopyalandı.':(ek||'')+'Kopyalanamadı, personel kartındaki "Çıkış bildirimi"ne tekrar basın.');}
export function adBuyuk(s){return String(s||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('tr-TR');}
// Doğru isim listesi (Yıldız + İlkbahar puantaj dosyalarından) ve yanlış yazılmış isimleri bunlarla eşleştiren yardımcı
export const DOGRU_ISIMLER=['SERDAR ÖZTÜRK','ELİF KARACA','HATİCE KÜBRA KARIK','UMUT GÖNEN','BERKAY EKİCİ','EMİR CAN ACAY','RIZA ŞAHİN','DAMLA AYDIN','ÖMER MELİH YILDIRIM','SEZAİ ACAR','FATMANUR ÇAKMAK','EMRE AŞMA','SAKİNE KORKMAZER','ADEM ELÇİ','EDA ELİBOL','YAĞMUR AYDIN','NEJLA AKÇABAY','KAYAHAN KARATUÇ','MERAL KENESARI','ÜMİT AYGÜN','BİRSEN KARA','OĞUZHAN ÇAKMAK','SÜMEYRA GİZEM KONGÜL','MEHMET YURTÇU','NACİYE ELÇİ','DOĞAN AKBAŞ','MUSTAFA HOCAOĞLU','AYŞEGÜL ÖZKAN','CEYHAN TURAN'];
export function isimEslestir(liste,dogru){
  const kat=s=>adBuyuk(s).replace(/Ç/g,'C').replace(/Ğ/g,'G').replace(/İ/g,'I').replace(/Ö/g,'O').replace(/Ş/g,'S').replace(/Ü/g,'U');
  const ed=(a,b)=>{const m=a.length,n=b.length;let p=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return p[n];};
  const D=dogru.map(d=>({d,t:kat(d).split(' ')}));const tam=new Set(dogru.map(d=>adBuyuk(d)));const var_=new Set(liste.map(x=>adBuyuk(x.ad)));
  const yeni=[],birles=[],belirsiz=[];
  liste.forEach(x=>{const a=adBuyuk(x.ad);if(!a||tam.has(a))return;const at=kat(a).split(' ');
    const ad=D.filter(c=>{const sub=(u,v)=>u.every(w=>v.includes(w));
      if(at.join(' ')===c.t.join(' '))return true;
      if(at.length<c.t.length&&sub(at,c.t))return true;
      if(c.t.length<at.length&&sub(c.t,at))return true;
      if(at.length===c.t.length){let fark=0;for(let i=0;i<at.length;i++){if(at[i]!==c.t[i]){if(at[i].length>=5&&c.t[i].length>=5&&ed(at[i],c.t[i])<=1)fark++;else return false;}}return fark<=1;}
      return false;});
    if(!ad.length)return;
    if(ad.length>1){belirsiz.push({id:x.id,ad:a,adaylar:ad.map(c=>c.d)});return;}
    const dg=ad[0].d;if(var_.has(dg)||yeni.some(y=>y.dogru===dg))birles.push({id:x.id,ad:a,dogru:dg});else yeni.push({id:x.id,ad:a,dogru:dg});});
  return {yeni,birles,belirsiz};}
// Aktarımda adı sonra yazılacak kişi "İSİMSİZ 3" diye açılır; Excel'deki adı excelAd'da kalır (ipucu ve sonraki aktarımda eşleşme için).
// Numara şirket genelinde tektir: aynı adlı iki kayıt aynı kişi sayıldığından iki "İSİMSİZ 1" olmamalı.
export function isimsizMi(p){return !!p&&/^İSİMSİZ \d+$/.test(adBuyuk(p.ad));}
export function isimsizSonNo(){let n=0;S.personel.forEach(p=>{const m=adBuyuk(p.ad).match(/^İSİMSİZ (\d+)$/);if(m)n=Math.max(n,+m[1]);});return n;}
// Excel'de adı tutmayan satırı, aynı haftalar daha önce aktarılmışsa çizelge verisinden tanır (ör. adı sonradan düzeltilmiş kişi).
// g: [[hafta, gün, değer]]. Aday: ortak dolu günlerinin %90'ı ve Excel'in o haftalardaki günlerinin %80'i aynı, en az 5 gün; ikinci güçlü aday varsa önerilmez.
export function izEslestir(g,adaylar,H){
  const L=adaylar.map(p=>{let ayni=0,dolu=0,tot=0;g.forEach(([w,i,x])=>{const c=H[w]&&H[w].cells&&H[w].cells[p.id];if(!c||!Object.values(c).some(v=>v!=null&&v!==''))return;tot++;const y=c[String(i)];if(y==null||y==='')return;dolu++;if(y===x)ayni++;});return{p,ayni,dolu,tot};})
    .filter(s=>s.ayni>=5&&s.ayni>=0.9*s.dolu&&s.ayni>=0.8*s.tot).sort((a,b)=>b.ayni-a.ayni);
  if(!L.length||(L[1]&&L[1].ayni>=0.6*L[0].ayni))return null;return L[0];}
export function xAd(s){return adBuyuk(s);}
export function xSekil(s){s=String(s||'').toLocaleUpperCase('tr-TR');return s.includes('PART')?'Part':s.includes('ESNAF')?'Esnaf kurye':'Tam';}
