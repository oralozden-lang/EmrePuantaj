// excel-aktar.js — app.js (v180) satırları 2374-2491. Otomatik bölündü; davranış değişmedi.
import { doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { GOREVLER, SGK_YOK, gorevBul, gorevTahmin, subeAdi } from './sabitler.js';
import { db, writeBatch } from './firebase.js';
import { S } from './durum.js';
import { addDays, ayKey, esc, isimAnahtar, normTime, parse, slug, trTarih, ymd } from './yardimci.js';
import { sube } from './hesap.js';
import { yazmaHatasi } from './yazma.js';
import { selectSube, tumSubeler } from './subeler.js';
import { byId } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { excelBilgi, panoyaYaz, subePersoneli } from './personel.js';

/* ================= Excel'den çizelge aktarma (işveren) ================= */
let xlsxYuklendi=null;export function xlsxLib(){if(xlsxYuklendi)return xlsxYuklendi;xlsxYuklendi=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>ok(window.XLSX);s.onerror=no;document.head.appendChild(s);});return xlsxYuklendi;}
export const XKOD={'HAF. İZİN':'HT','HAF.İZİN':'HT','HAFTALIK İZİN':'HT','HAFTA TATİLİ':'HT','İZİN':'HT','ÜCR. İZİN':'UI','ÜCR.İZİN':'UI','ÜCRETSİZ İZİN':'UI','YILLIK İZİN':'YI','YILLIK':'YI','RAPOR':'R','RAPORLU':'R','BAYRAM':'B','DİĞER':'D'};
export function xSerialTarih(v){if(typeof v!=='number'||v<20000)return null;const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');}
function xSaat(v){if(typeof v==='number'){if(v>=1)v=v%1;const m=Math.round(v*1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}if(typeof v==='string')return normTime(v);return null;}
function xTarihMetin(v){if(typeof v==='number')return xSerialTarih(v);if(typeof v!=='string')return'';const m=v.trim().match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';}
function adBaslik(s){return String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w.charAt(0).toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');}
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
function isimsizSonNo(){let n=0;S.personel.forEach(p=>{const m=adBuyuk(p.ad).match(/^İSİMSİZ (\d+)$/);if(m)n=Math.max(n,+m[1]);});return n;}
// Excel'de adı tutmayan satırı, aynı haftalar daha önce aktarılmışsa çizelge verisinden tanır (ör. adı sonradan düzeltilmiş kişi).
// g: [[hafta, gün, değer]]. Aday: ortak dolu günlerinin %90'ı ve Excel'in o haftalardaki günlerinin %80'i aynı, en az 5 gün; ikinci güçlü aday varsa önerilmez.
function izEslestir(g,adaylar,H){
  const L=adaylar.map(p=>{let ayni=0,dolu=0,tot=0;g.forEach(([w,i,x])=>{const c=H[w]&&H[w].cells&&H[w].cells[p.id];if(!c||!Object.values(c).some(v=>v!=null&&v!==''))return;tot++;const y=c[String(i)];if(y==null||y==='')return;dolu++;if(y===x)ayni++;});return{p,ayni,dolu,tot};})
    .filter(s=>s.ayni>=5&&s.ayni>=0.9*s.dolu&&s.ayni>=0.8*s.tot).sort((a,b)=>b.ayni-a.ayni);
  if(!L.length||(L[1]&&L[1].ayni>=0.6*L[0].ayni))return null;return L[0];}
function xAd(s){return adBuyuk(s);}
function xSekil(s){s=String(s||'').toLocaleUpperCase('tr-TR');return s.includes('PART')?'Part':s.includes('ESNAF')?'Esnaf kurye':'Tam';}
function excelCoz(X,wb){const val=(ws,r,c)=>{const x=ws[X.utils.encode_cell({r,c})];return x?x.v:null;};const sayfalar=[];let liste=null;
  wb.SheetNames.forEach(name=>{const ws=wb.Sheets[name];if(!ws['!ref'])return;const R=X.utils.decode_range(ws['!ref']);const maxR=Math.min(R.e.r,400);
    // Personel listesi sayfası
    for(let r=0;r<=Math.min(maxR,12);r++)for(let c=0;c<=Math.min(R.e.c,20);c++){if(String(val(ws,r,c)||'').trim().toLocaleUpperCase('tr-TR')==='ADI SOYADI'){
      const hdr={};for(let cc=c;cc<=Math.min(R.e.c,c+12);cc++)hdr[String(val(ws,r,cc)||'').trim().toLocaleUpperCase('tr-TR')]=cc;
      if(hdr['GİRİŞ TARİHİ']!=null&&!liste){liste={};for(let rr=r+1;rr<=maxR;rr++){const ad=val(ws,rr,c);if(!ad||typeof ad!=='string')continue;
        const hv=k=>hdr[k]!=null?val(ws,rr,hdr[k]):null;
        liste[isimAnahtar(ad)]={sekil:hdr['ÇALIŞMA ŞEKLİ']!=null?xSekil(val(ws,rr,hdr['ÇALIŞMA ŞEKLİ'])):null,giris:xTarihMetin(val(ws,rr,hdr['GİRİŞ TARİHİ'])),cikis:hdr['ÇIKIŞ TARİHİ']!=null?xTarihMetin(val(ws,rr,hdr['ÇIKIŞ TARİHİ'])):'',
          bilgi:excelBilgi({tel:hv('TELEFON'),eposta:hv('MAİL')??hv('E-POSTA')??hv('MAIL'),iban:hv('IBAN')})};}}}}
    // Çizelge sayfası: A sütununda "N. HAFTA", bir alt satırda C,E,G… tarihler, altında isimler
    const hafta=[];for(let r=0;r<=maxR;r++){const a=String(val(ws,r,0)||'').toLocaleUpperCase('tr-TR');if(!/HAFTA/.test(a))continue;const mon=xSerialTarih(val(ws,r+1,2));if(!mon)continue;
      const kisiler={};for(let rr=r+2;rr<=Math.min(maxR,r+26);rr++){const a2=String(val(ws,rr,0)||'').toLocaleUpperCase('tr-TR');if(/HAFTA/.test(a2))break;const ad=val(ws,rr,1);if(!ad||typeof ad!=='string'||!ad.trim())continue;
        const key=isimAnahtar(ad);const row=kisiler[key]||(kisiler[key]={ad:xAd(ad),gun:{}});
        for(let k=0;k<7;k++){const s=val(ws,rr,2+2*k),e=val(ws,rr,3+2*k);let v=null;
          if(typeof s==='string'&&!normTime(s)){v=XKOD[s.trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,' ')]||null;}
          else{const a1=xSaat(s),b1=xSaat(e);if(a1&&b1)v=a1+'-'+b1;}
          if(v==null)continue;if(row.gun[k]&&row.gun[k]!=='D'&&v==='D')continue;row.gun[k]=v;}}
      if(Object.keys(kisiler).length)hafta.push({mon,kisiler});}
    if(hafta.length)sayfalar.push({name,hafta,ilk:hafta[0].mon,son:hafta[hafta.length-1].mon});});
  return{sayfalar,liste};}
export function excelAktarPanel(sid){const sb=sube(sid);
  openSheet(`<h2>Excel'den çizelge aktar</h2><div class="sub">${esc(sb.ad)} · Mevcut MESAİ ÇİZELGESİ dosyanızı seçin. Personel listesi sayfası varsa giriş/çıkış tarihleri, telefon, e-posta ve IBAN da alınır.</div>
   <label class="field"><span>Excel dosyası (.xlsx)</span><input id="xF" type="file" accept=".xlsx,.xlsm,.xls"></label><div id="xOut"></div>`,()=>{
   byId('xF').onchange=async e=>{const f=e.target.files[0];if(!f)return;const O=byId('xOut');O.innerHTML='<p class="note">Dosya okunuyor…</p>';let X,P;
     try{X=await xlsxLib();P=excelCoz(X,X.read(await f.arrayBuffer(),{type:'array'}));}catch(err){O.innerHTML='<div class="confirm bad">Dosya okunamadı.</div>';return;}
     if(!P.sayfalar.length){O.innerHTML='<div class="confirm bad">Bu dosyada çizelge sayfası bulunamadı.</div>';return;}
     const sirali=P.sayfalar.slice().sort((a,b)=>a.ilk.localeCompare(b.ilk));const son2=sirali.slice(-2).map(s=>s.name);
     O.innerHTML=`<span class="lbl">Aktarılacak aylar (sayfalar)</span><div class="card list">${sirali.map(s=>`<label class="row"><input type="checkbox" value="${esc(s.name)}" ${son2.includes(s.name)?'checked':''} style="width:20px;height:20px"><div class="m"><b>${esc(s.name)}</b><span>${trTarih(s.ilk)} – ${trTarih(ymd(addDays(parse(s.son),6)))} · ${s.hafta.length} hafta</span></div></label>`).join('')}</div>
      <div class="row2"><button class="btn primary grow" id="xOn">Devam</button></div><div id="xOn2"></div>`;
     byId('xOn').onclick=()=>{const sec=[...O.querySelectorAll('input[type=checkbox]:checked')].map(i=>i.value);if(!sec.length){toast('En az bir sayfa seçin.');return;}
       const haftalar={};sirali.filter(s=>sec.includes(s.name)).forEach(s=>s.hafta.forEach(h=>{const w=haftalar[h.mon]||(haftalar[h.mon]={});Object.entries(h.kisiler).forEach(([k,v])=>{w[k]={ad:v.ad,gun:{...((w[k]||{}).gun||{}),...v.gun}};});}));
       const kisi={};Object.values(haftalar).forEach(w=>Object.entries(w).forEach(([k,v])=>{if(!kisi[k])kisi[k]={ad:v.ad,vardiya:0};kisi[k].vardiya+=Object.keys(v.gun).length;}));
       // Kişi satır sırasıyla değil Excel'deki adıyla eşleşir (her haftada sıra değişebilir). Önce ad soyad, sonra önceki aktarımda saklanan Excel adı.
       const SP=subePersoneli(sid);const mevcut={};
       SP.forEach(p=>{if(!p.excelAd)return;const k=isimAnahtar(p.excelAd);if(!mevcut[k]||(isimsizMi(mevcut[k])&&!isimsizMi(p)))mevcut[k]=p;});
       SP.forEach(p=>{mevcut[isimAnahtar(p.ad)]=p;});
       const keys=Object.keys(kisi).sort((a,b)=>kisi[a].ad.localeCompare(kisi[b].ad,'tr'));
       const tutan=new Set(keys.filter(k=>mevcut[k]).map(k=>mevcut[k].id));
       const adaylar=SP.filter(p=>!tutan.has(p.id)).sort((a,b)=>adBuyuk(a.ad).localeCompare(adBuyuk(b.ad),'tr'));
       // Adı tutmayan satır: aynı haftalar daha önce aktarıldıysa çizelgesi aynı olan kişi seçili gelir (aynı kişi iki kayıt olmasın).
       const H=S.subeId===sid?S.haftalar:{};const oneri={};
       keys.filter(k=>!mevcut[k]).forEach(k=>{const g=[];Object.entries(haftalar).forEach(([mon,w])=>{if(w[k])Object.entries(w[k].gun).forEach(([i,x])=>g.push([mon,i,x]));});
         const e=izEslestir(g,adaylar,H);if(e&&(!oneri[e.p.id]||oneri[e.p.id].ayni<e.ayni))oneri[e.p.id]={k,...e};});
       const oneriK={};Object.values(oneri).forEach(o=>{oneriK[o.k]=o;});const izBas=isimsizSonNo();
       byId('xOn2').innerHTML=`<span class="lbl">Personel · ${keys.length} kişi</span><p class="note" style="margin:0 0 8px">Kişiler satır sırasıyla değil Excel'deki adıyla eşleşir. Listede olmayanlar "İsimsiz" açılır; adını sonra Personel'de yazarsınız, Excel'deki adı altında görünür. Kişi listede başka adla varsa "Kim?" sütunundan seçin. Yeni kişilerin görevini ve SGK şubesini seçin.</p>
        <div class="tbl-wrap"><table class="pt"><thead><tr><th class="l">Excel'deki isim</th><th>Kim?</th><th>Görev</th><th>SGK şubesi</th><th>Giriş</th><th>Çıkış</th></tr></thead><tbody>${keys.map(k=>{const m=mevcut[k],l=(P.liste||{})[k]||{};const o=oneriK[k];
          return `<tr><td class="l"><b>${esc(kisi[k].ad)}</b><br><span class="tag">${kisi[k].vardiya} gün</span>${l.sekil&&!m?` <span class="tag">${esc(l.sekil)}</span>`:''}</td><td>${m?`<span class="chip ok">Mevcut</span>${adBuyuk(m.ad)!==kisi[k].ad?`<br><span class="tag">${esc(adBuyuk(m.ad))}</span>`:''}`:`<select data-k="${esc(k)}" data-t="k"><option value="__isz">İsimsiz</option><option value="__ad">Excel'deki adla aç</option>${adaylar.map(p=>`<option value="${esc(p.id)}" ${o&&o.p.id===p.id?'selected':''}>${esc(adBuyuk(p.ad))}${isimsizMi(p)&&p.excelAd?' (Excel: '+esc(p.excelAd)+')':''}${p.cikis?' · çıkış '+trTarih(p.cikis):''}</option>`).join('')}</select>${o?`<br><span class="tag">çizelgesi tutuyor · ${o.ayni}/${o.dolu} gün</span>`:''}`}</td>
          <td>${m?esc(gorevTahmin(m)):`<select data-k="${esc(k)}" data-t="g"><option value="">Seçin</option>${GOREVLER.map(g=>`<option value="${esc(g.ad)}" ${(l.sekil==='Esnaf kurye'&&g.ad==='Esnaf Kurye')?'selected':''}>${esc(g.ad)}</option>`).join('')}</select>`}</td>
          <td>${m?esc(m.sgkSube===SGK_YOK?'Boş':m.sgkSube?subeAdi(m.sgkSube):'—'):`<select data-k="${esc(k)}" data-t="s"><option value="${SGK_YOK}">Boş</option>${tumSubeler().map(([id2,ad2])=>`<option value="${esc(id2)}" ${id2===sid?'selected':''}>${esc(ad2)}</option>`).join('')}</select>`}</td><td>${trTarih(m?m.giris:l.giris)}</td><td>${trTarih(m?m.cikis:l.cikis)}</td></tr>`;}).join('')}</tbody></table></div>
        <p class="note">${Object.keys(haftalar).length} hafta aktarılacak. Aynı haftada çizelgede daha önce girilmiş günler Excel'deki değerle değiştirilir.</p>
        <div class="row2"><button class="btn grow" id="xNo">Vazgeç</button><button class="btn primary grow" id="xOk">Aktar</button></div>`;
       byId('xNo').onclick=closeSheet;
       const X2=byId('xOn2');const sel=(k,t)=>X2.querySelector(`select[data-t="${t}"][data-k="${CSS.escape(k)}"]`);const kim=k=>{const s=sel(k,'k');return s?s.value:null;};
       // İsimsiz numaraları tablo sırasıyla verilir; seçim değişince yeniden sıralanır. Mevcut kişi seçilen satırda görev / SGK seçilmez.
       const izAdlari=()=>{const o={};let n=izBas;keys.forEach(k=>{if(!mevcut[k]&&kim(k)==='__isz')o[k]='İSİMSİZ '+(++n);});return o;};
       const guncelle=()=>{const iz=izAdlari();keys.forEach(k=>{const s=sel(k,'k');if(!s)return;s.options[0].textContent=iz[k]?adBaslik(iz[k]):'İsimsiz';const yeni=s.value==='__isz'||s.value==='__ad';['g','s'].forEach(t=>{const x=sel(k,t);if(x)x.disabled=!yeni;});});};
       X2.querySelectorAll('select[data-t="k"]').forEach(s=>s.onchange=guncelle);guncelle();
       byId('xOk').onclick=async()=>{const iz=izAdlari();const hedef={};// Excel adı → mevcut kayıt
         keys.forEach(k=>{if(mevcut[k]){hedef[k]=mevcut[k];return;}const v=kim(k);if(v&&v!=='__isz'&&v!=='__ad'){const p=S.personel.find(x=>x.id===v);if(p)hedef[k]=p;}});
         const say={};Object.values(hedef).forEach(p=>{say[p.id]=(say[p.id]||0)+1;});const cift=[...new Set(Object.values(hedef).filter(p=>say[p.id]>1).map(p=>adBuyuk(p.ad)))];
         if(cift.length){toast(`${cift.join(', ')} birden fazla Excel satırına seçildi. Her kişi tek satıra seçilebilir.`);return;}
         const eksik=keys.filter(k=>!hedef[k]&&!gorevBul((sel(k,'g')||{}).value));
         if(eksik.length){toast(`${eksik.length} kişinin görevi seçilmedi.`);return;}
         const btn=byId('xOk');btn.disabled=true;btn.textContent='Aktarılıyor…';const pidOf={};const ops=[];
         keys.forEach(k=>{const m=hedef[k];if(m){pidOf[k]=m.id;const lb=((P.liste||{})[k]||{}).bilgi||{};const ek={};Object.entries(lb).forEach(([f,v])=>{if(v&&!m[f])ek[f]=v;});if(!mevcut[k]&&!m.excelAd)ek.excelAd=kisi[k].ad;if(Object.keys(ek).length)ops.push([doc(db,'personel',m.id),ek,true]);return;}
           const l=(P.liste||{})[k]||{};const ad=iz[k]||kisi[k].ad;const pid=slug(ad)+'-'+Math.random().toString(36).slice(2,6);pidOf[k]=pid;
           const g=gorevBul(sel(k,'g').value);const sgkV=sel(k,'s').value;
           ops.push([doc(db,'personel',pid),{ad,excelAd:kisi[k].ad,grup:g.grup,gorev:g.ad,sekil:g.sekil||(l.sekil==='Part'?'Part':'Tam'),giris:l.giris||'',cikis:l.cikis||'',sgkSube:sgkV,anaSube:sid,...(l.bilgi||{})},false]);});
         let atla=0;Object.entries(haftalar).forEach(([mon,w])=>{const cells={};Object.entries(w).forEach(([k,v])=>{cells[pidOf[k]]=Object.fromEntries(Object.entries(v.gun).map(([i,x])=>[String(i),x]));});
           // Var olan haftanın listesi korunur (yeni kişiler eklenir), durumu değişmez; kapatılmış / onaylı haftaya yazılmaz.
           const e=S.subeId===sid?S.haftalar[mon]:null;if(e&&e.hd&&e.hd!=='acik'){atla++;return;}const k0=e?(Array.isArray(e.kadro)?e.kadro:Object.keys(e.cells||{})):[];
           ops.push([doc(db,'subeler',sid,'haftalar',mon),{hafta:mon,ay2:ayKey(addDays(parse(mon),6)),kadro:[...k0,...Object.keys(cells).filter(x=>!k0.includes(x))],...(e?{}:{hd:'acik'}),cells},true]);});
         try{for(let i=0;i<ops.length;i+=400){const b=writeBatch(db);ops.slice(i,i+400).forEach(([r,d,m])=>m?b.set(r,d,{merge:true}):b.set(r,d));await b.commit();}
           const nIz=Object.keys(iz).length;closeSheet();toast(`${Object.keys(haftalar).length-atla} hafta ve ${keys.length} kişi aktarıldı.${atla?` ${atla} kapatılmış / onaylı hafta atlandı.`:''}${nIz?` ${nIz} kişi isimsiz açıldı, adlarını Personel'de yazın.`:''}`);if(S.subeId!==sid)selectSube(sid);}
         catch(e){btn.disabled=false;btn.textContent='Aktar';yazmaHatasi(e);}};};};});}

