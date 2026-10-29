// personel.js — app.js (v180) satırları 1046-1368. Otomatik bölündü; davranış değişmedi.
import { collection, doc, getDoc, getDocs, query, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { BASLANGIC_AY, GOREVLER, GRUP, GRUP_SIRA, SGK_YOK, gorevBul, gorevTahmin, subeAdi } from './sabitler.js';
import { arka, db, deleteDoc, runTransaction, setDoc, writeBatch } from './firebase.js';
import { S, tryLS } from './durum.js';
import { addDays, ascii, ayAdi, ayKaydir, ayKey, bas, esc, isimAnahtar, kisaAd, mondayOf, parse, rangeLabel, sayi, slug, tl0, today, trTarih, ymd } from './yardimci.js';
import { isBolge, isIsveren, isSube, puantajYetki } from './rol.js';
import { gorevGecmisYama, gorevGecmisYazi, gorevSatirYama, ilkGun, maasGecmisYama, maasSubeGecmisYazi, maasSubesi, odemeSubesi, odemeSubesiEski, pasifMi, pasifSure, pasifTarihi, sgkGunSayisi, sgkli, sirala, sube } from './hesap.js';
import { ayniKisi, ekSubeleri, kisaSubeAd, kisiSubeleri, subedeAktif } from './cok-sube.js';
import { sirayla, weekRef, yazmaHatasi } from './yazma.js';
import { tumSubeler } from './subeler.js';
import { byId, render, view } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { trTarihCoz } from './veri-girisi.js';
import { adBuyuk, cikisBildirimKopyala, isimsizMi, xlsxLib } from './excel-aktar.js';

/* ================= Personel (şirket geneli liste) ================= */
// Kişiyi bir şubenin haftalık listesine ekler (o haftanın listesi yoksa önceki haftanın listesini temel alır).
async function cizelgeyeKoy(sid,wid,pid){if(!erisimVar(sid))return;const ref=weekRef(wid,sid);
  // Ekrandaki (belki eski ya da yüklenmemiş) liste değil, sunucudaki liste esas alınır; haftanın durumuna dokunulmaz.
  try{let s0;try{s0=await getDoc(ref);}catch(e){if(String(e.code||'').includes('permission'))return;throw e;}// kapalı hafta: şube müdürü göremez, eklenmez
    let taban=[];if(!s0.exists())for(let i=1;i<=8;i++){let q;try{q=await getDoc(weekRef(ymd(addDays(parse(wid),-7*i)),sid));}catch(e){continue;}if(q.exists()){const d=q.data();taban=Array.isArray(d.kadro)?d.kadro.slice():Object.keys(d.cells||{});break;}}
    await runTransaction(db,async tr=>{const s=await tr.get(ref);const yeni=!s.exists();let kad;const hdYok=yeni||!('hd' in s.data());if(!yeni){const d=s.data();kad=Array.isArray(d.kadro)?d.kadro.slice():Object.keys(d.cells||{});}else kad=taban.slice();
      if(kad.includes(pid))return;kad.push(pid);tr.set(ref,{hafta:wid,ay2:ayKey(addDays(parse(wid),6)),kadro:kad,...(hdYok?{hd:'acik'}:{})},{merge:true});});}
  catch(e){console.error(e);toast(`${subeAdi(sid)} çizelgesine eklenemedi (${rangeLabel(wid)}). İnternet gelince kişiyi "+ ekle" ile ekleyin.`);}}
/* ---- Diğer çalıştığı şubeler (çok şubeli çalışma): sadece işveren ve bölge müdürü (kendi şubeleri) ---- */
function ekYetkiVar(){return isIsveren()||isBolge();}
function ekYetki(sid){return isIsveren()||(isBolge()&&(S.me.subeler||[]).includes(sid));}
function ekSubePanel(p){const ana=p.anaSube||'',sgk=p.sgkSube&&p.sgkSube!==SGK_YOK?p.sgkSube:'';const ek=ekSubeleri(p);
  const L=[...new Set([...(isIsveren()?S.subeIds:(S.me.subeler||[])),...ek])].filter(x=>x&&x!==ana&&x!==sgk).sort((a,b)=>String(subeAdi(a)).localeCompare(String(subeAdi(b)),'tr'));
  openSheet(`<h2>${esc(adBuyuk(p.ad))}</h2><div class="sub">Çalıştığı şube: ${esc(subeAdi(ana))}${sgk&&sgk!==ana?' · SGK: '+esc(subeAdi(sgk)):''}. Diğer çalıştığı şubeleri işaretleyin.</div>
   <div class="checks" id="ekL">${L.map(x=>`<label class="check" style="margin:0"><input type="checkbox" value="${esc(x)}" ${ek.includes(x)?'checked':''} ${ekYetki(x)?'':'disabled'}> ${esc(subeAdi(x))}</label>`).join('')||'<span class="note">Eklenebilecek şube yok.</span>'}</div>
   <p class="note">Kişi işaretlenen şubelerin personel listesinde ve çizelgesinde de görünür; o şubede çalıştığı günün mesaisi o şubenin puantajına yazılır. Maaşı yine tek şubeden ödenir. Bir şubeden çıkarınca geçmiş haftaları ve saatleri silinmez, sadece yeni haftalara eklenmez. Bir kişi aynı gün tek şubede çalışır.</p>
   <div id="ekErr"></div><div class="row2"><button class="btn grow" id="ekNo">Vazgeç</button><button class="btn primary grow" id="ekOk">Kaydet</button></div>`,sh=>{
   byId('ekNo').onclick=closeSheet;byId('ekOk').onclick=async()=>{const yeni=[...sh.querySelectorAll('#ekL input:checked')].map(i=>i.value);const b=byId('ekOk');b.disabled=true;
     const r=await ekSubeKaydet(p,yeni);if(r===true)closeSheet();else{b.disabled=false;if(r)byId('ekErr').innerHTML=`<div class="confirm bad">${esc(r)}</div>`;}};});}
async function ekSubeKaydet(p,yeni){const eski=ekSubeleri(p);const ekl=yeni.filter(x=>!eski.includes(x)),cik=eski.filter(x=>!yeni.includes(x));if(!ekl.length&&!cik.length)return true;
  if([...ekl,...cik].some(x=>!ekYetki(x)))return'Sadece sorumlu olduğunuz şubeleri ekleyip çıkarabilirsiniz.';
  const ak=ayKey(today());const ms=odemeSubesi(p,ak);if(cik.includes(ms))return `${subeAdi(ms)} bu ay maaşının ödendiği şube. Önce maaş şubesini değiştirin.`;
  const gor=[...new Set([...(p.gorunurSubeler||[]),...kisiSubeleri(p),...yeni])];const body={ekSubeler:yeni,gorunurSubeler:gor};
  try{const b=writeBatch(db);b.set(doc(db,'personel',p.id),body,{merge:true});ekl.forEach(x=>b.set(doc(db,'ekPersonel',x),{ids:{[p.id]:true}},{merge:true}));await b.commit();}
  catch(e){yazmaHatasi(e);return'Kaydedilemedi.';}
  Object.assign(p,body);render();/* çizelgeye otomatik eklenmez: şube müdürü "+ ekle" ile ekler */
  toast([ekl.length?`${ekl.map(subeAdi).join(', ')} çizelgesine eklendi`:'',cik.length?`${cik.map(subeAdi).join(', ')} şubesinden çıkarıldı; geçmiş haftaları duruyor`:''].filter(Boolean).join('. ')+'.');return true;}

/* ================= Personel bilgileri (telefon, acil durum, e-posta, IBAN) ================= */
// Bu bilgiler personel kaydında durur; kayıt sadece kişinin şubesi (ve SGK şubesinin bölge müdürü / işveren) tarafından okunur.
const BILGI=[{k:'tel',ad:'Telefon',tip:'tel',im:'tel',ph:'05xx xxx xx xx'},{k:'acilAd',ad:'Acil durum kişisi',tip:'metin',im:'text',ph:'Örn: Annesi Ayşe'},{k:'acilTel',ad:'Acil durum no',tip:'tel',im:'tel',ph:'05xx xxx xx xx'},
  {k:'eposta',ad:'E-posta',tip:'eposta',im:'email',ph:'ornek@mail.com'},{k:'iban',ad:'IBAN',tip:'iban',im:'text',ph:'TR000000000000000000000000'}];
BILGI.push({k:'tc',ad:'TC kimlik no',tip:'tc',im:'numeric',ph:'11 hane'});
// Sıra: telefon, IBAN, e-posta, acil durum, TC en sonda
{const sira=['tel','iban','eposta','acilAd','acilTel','tc'];BILGI.sort((a,b)=>sira.indexOf(a.k)-sira.indexOf(b.k));}
function ibanGecerli(s){if(!/^TR\d{24}$/.test(s))return false;const r=s.slice(4)+s.slice(0,4);let m=0;for(const ch of r){const n=/\d/.test(ch)?ch:String(ch.charCodeAt(0)-55);for(const d of n)m=(m*10+(+d))%97;}return m===1;}
export function tcGecerli(s){if(!/^[1-9]\d{10}$/.test(s))return false;const d=s.split('').map(Number);const t1=((d[0]+d[2]+d[4]+d[6]+d[8])*7-(d[1]+d[3]+d[5]+d[7]))%10;const t2=d.slice(0,10).reduce((a,b)=>a+b,0)%10;return((t1+10)%10)===d[9]&&t2===d[10];}
function bilgiCoz(f,raw){const s=String(raw??'').trim();if(!s)return{v:''};
  if(f.tip==='tel'){let d=s.replace(/\D/g,'');if(d.startsWith('90')&&d.length===12)d=d.slice(2);if(d.length===10&&d[0]==='5')d='0'+d;return /^0\d{10}$/.test(d)?{v:d}:{hata:'11 haneli telefon numarası yazın (05xx xxx xx xx).'};}
  if(f.tip==='iban'){const d=s.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g,'');return ibanGecerli(d)?{v:d}:{hata:'IBAN hatalı. TR ile başlayan 26 karakterli IBAN\'ı kontrol edin.'};}
  if(f.tip==='eposta'){const d=s.toLocaleLowerCase('tr-TR').replace(/\s/g,'');return /^[^@]+@[^@]+\.[a-z]{2,}$/.test(d)?{v:d}:{hata:'E-posta adresi hatalı.'};}
  if(f.tip==='tc'){const d=s.replace(/\D/g,'');return tcGecerli(d)?{v:d}:{hata:'TC kimlik numarası hatalı.'};}
  return{v:s.replace(/\s+/g,' ').slice(0,80)};}
function bilgiGoster(f,v){v=v||'';if(f.tip==='tel'&&/^0\d{10}$/.test(v))return`${v.slice(0,4)} ${v.slice(4,7)} ${v.slice(7,9)} ${v.slice(9)}`;return v;}
export function excelBilgi(o){const out={};BILGI.forEach(f=>{if(o[f.k]==null)return;const r=bilgiCoz(f,typeof o[f.k]==='number'?String(o[f.k]):o[f.k]);if(r.v)out[f.k]=r.v;});return out;}
// TC sadece bölge müdürü / işveren: maaslar/{SGK şubesi}.tc
async function tcYukle(list){if(!puantajYetki())return;S.tcler=S.tcler||{};const need=[...new Set(list.map(maasSubesi))].filter(s=>s&&!(s in S.tcler)&&(isIsveren()||(S.me.subeler||[]).includes(s)));
  if(!need.length)return;await Promise.all(need.map(async s=>{try{const d=await getDoc(doc(db,'maaslar',s));S.tcler[s]=(d.exists()&&d.data().tc)||{};}catch(e){S.tcler[s]=null;}}));render();}
// TC personel kaydında; eski kayıtlarda bordrodan gelen TC maaslar'da durabilir (bölge/işveren görür).
function tcOf(p){if(p.tc)return p.tc;const m=S.tcler&&S.tcler[maasSubesi(p)];return m?m[p.id]||'':'';}
// IBAN değişince eski değer, tarih ve sunucu saati (ibanZaman) tutulur; kural bunlar olmadan IBAN değiştirtmez (işveren listesinde görünür).
function bilgiKaydet(p,f,v){const ek={};const iz=f.k==='iban'&&p.iban&&p.iban!==v;if(iz){ek.ibanEski=p.iban;ek.ibanTarih=ymd(today());}
  p[f.k]=v;Object.assign(p,ek);return sirayla('p'+p.id,()=>{arka(setDoc(doc(db,'personel',p.id),{[f.k]:v,...ek,...(iz?{ibanZaman:serverTimestamp()}:{})},{merge:true}));});}
// IBAN'ın değiştiği gün: sunucu saati varsa o (cihaz tarihi değiştirilemez), yoksa eski kayıtlardaki tarih.
function ibanDegisim(p){const z=p.ibanZaman;return z&&typeof z.toDate==='function'?ymd(z.toDate()):(p.ibanTarih||'');}
/* İşverene IBAN listesi: seçilen ayda SGK girişi olanlar + IBAN'ı o ay değişenler. Tüm şubeler tek listede; IBAN bitişik yazılır. Sadece bölge müdürü ve işveren. */
export function ibanAyi(){const bu=ayKey(today());return S.ibanAy||(today().getDate()<=15?ayKaydir(bu,-1):bu);}
// O ay ücretsiz izinle SGK günü 0'a düşen kişi (ör. 30 gün ücretsiz izin): bankaya maaş yatmaz, IBAN istenmez.
// Gün sayıları şubelerin ay özetlerinden (çizelge + veri girişi) okunur; özet yüklenene kadar kişi listede kalır.
function ibanOzetYukle(ak){S.ibanOzet=S.ibanOzet||{};if(S.ibanOzet[ak])return;S.ibanOzet[ak]={yuk:true};
  getDocs(query(collection(db,'ozetler'),where('ay','==',ak))).then(q=>{const ui={};const ekle=(pid,n)=>{ui[pid]=(ui[pid]||0)+n;};
    q.docs.forEach(d=>{const x=d.data()||{};Object.entries(x.kisiler||{}).forEach(([pid,k])=>{if(k&&k.UI)ekle(pid,sayi(k.UI));});
      Object.entries(x.veriGun||{}).forEach(([pid,k])=>{Object.values((k&&k.g)||{}).forEach(t=>{if(t&&t.UI)ekle(pid,sayi(t.UI));});});});
    S.ibanOzet[ak]={ui};if(S.tab==='personel')render();}).catch(e=>{console.error(e);S.ibanOzet[ak]={ui:{},hata:true};});}
function ibanSgkGunuYok(p,ak){const o=S.ibanOzet&&S.ibanOzet[ak];if(!o||!o.ui)return false;const n=o.ui[p.id]||0;if(!n)return false;
  const[y,m]=ak.split('-').map(Number);const last=new Date(y,m,0).getDate();let ist=0;for(let d=1;d<=last;d++)if(sgkli(p,new Date(y,m-1,d)))ist++;return ist>0&&sgkGunSayisi(ist,last,n)===0;}
function ibanListe(ak){ibanOzetYukle(ak);const g=[],u=[],n=[];S.personel.forEach(p=>{if(p.giris&&p.giris.slice(0,7)===ak&&p.sgkSube!==SGK_YOK){(ibanSgkGunuYok(p,ak)?n:g).push(p);}else if(p.iban&&ibanDegisim(p).slice(0,7)===ak)u.push(p);});
  const o=(a,b)=>String(subeAdi(maasSubesi(a))).localeCompare(String(subeAdi(maasSubesi(b))),'tr')||String(a.ad).localeCompare(String(b.ad),'tr');return{g:g.sort(o),u:u.sort(o),n:n.sort(o)};}
export function ibanMetin(ak){const L=ibanListe(ak);const s=p=>`${adBuyuk(p.ad)} | ${tcOf(p)||'TC yok'} | ${p.iban||'IBAN yok'}`;
  let t=`${ayAdi(ak)} · yeni girenler (${L.g.length})\n`+L.g.map(s).join('\n');if(L.u.length)t+=`\n\nIBAN'ı güncellenenler (${L.u.length})\n`+L.u.map(s).join('\n');return t;}
export async function panoyaYaz(t){try{await navigator.clipboard.writeText(t);return true;}catch(e){try{const a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();const ok=document.execCommand('copy');a.remove();return ok;}catch(_){return false;}}}
export async function ibanExcel(ak){const L=ibanListe(ak);let X;try{X=await xlsxLib();}catch(e){toast('Excel kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edin.');return;}
  const sat=(p,d)=>[adBuyuk(p.ad),tcOf(p)||'',p.iban||'',subeAdi(maasSubesi(p)),d,trTarih(p.giris)];
  const ws=X.utils.aoa_to_sheet([['Ad soyad','TC kimlik no','IBAN','Şube','Durum','SGK giriş'],...L.g.map(p=>sat(p,'Yeni giriş')),...L.u.map(p=>sat(p,'IBAN güncellendi'))]);
  ws['!cols']=[{wch:28},{wch:14},{wch:30},{wch:18},{wch:18},{wch:12}];const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'IBAN');X.writeFile(wb,`IBAN-${ak}.xlsx`);}
export function ibanKutusu(){if(!puantajYetki())return'';const bu=ayKey(today());const ak=ibanAyi();const acik=true;const L=ibanListe(ak);const hepsi=[...L.g,...L.u];const eks=hepsi.filter(p=>!p.iban).length;
  let h=`<div class="ibk"><div class="ibk-h" id="ibanBas"><b>İşverene IBAN listesi</b><span class="n">${hepsi.length}</span>${eks?`<span class="chip bad">${eks} IBAN eksik</span>`:''}</div>`;
  if(acik){tcYukle(hepsi);const aylar=[...new Set([ak,...[0,1,2,3,4,5].map(i=>ayKaydir(bu,-i))])].sort().reverse();
    const satir=(p,gun,guncel)=>{const ib=p.iban||'';const tc=tcOf(p);return `<div class="ibr ${ib?'':'eks'}"><div class="n"><b>${esc(adBuyuk(p.ad))}</b><i>${esc(gorevTahmin(p)||'')} · ${esc(subeAdi(maasSubesi(p)))} · ${gun}</i></div><div class="v"><span class="mono">${ib?esc(ib):'IBAN girilmemiş'}</span><span>TC ${tc?esc(tc):'—'}${guncel&&p.ibanEski?' · eski: '+esc(p.ibanEski):''}</span></div></div>`;};
    h+=`<div class="ibk-t"><label>Ay <select id="ibanAy">${aylar.map(a=>`<option value="${a}" ${a===ak?'selected':''}>${ayAdi(a)}</option>`).join('')}</select></label><span>Tüm şubeler tek listede</span></div>
     <div class="ibk-s"><span>Yeni girenler · ${L.g.length}</span><span>SGK girişi bu ay</span></div>${L.g.length?L.g.map(p=>satir(p,'giriş '+trTarih(p.giris),false)).join(''):L.n.length?'':'<div class="ibr"><div class="n"><i>Bu ay SGK girişi olan yok.</i></div></div>'}
     ${L.n.map(p=>`<div class="ibr"><div class="n"><b>${esc(adBuyuk(p.ad))}</b><i>${esc(gorevTahmin(p)||'')} · ${esc(subeAdi(maasSubesi(p)))} · giriş ${trTarih(p.giris)}</i></div><div class="v"><span class="chip">SGK günü 0 · IBAN gerekmiyor</span></div></div>`).join('')}
     <div class="ibk-s"><span>IBAN'ı güncellenenler · ${L.u.length}</span><span>Bu ay değişen</span></div>${L.u.length?L.u.map(p=>satir(p,'değişiklik '+trTarih(ibanDegisim(p)),true)).join(''):'<div class="ibr"><div class="n"><i>Bu ay IBAN değişikliği yok.</i></div></div>'}
     <div class="ibk-f"><button class="btn primary grow" id="ibanKop">WhatsApp için kopyala</button><button class="btn grow" id="ibanXls">Excel indir</button></div>`;}
  return h+'</div>';}
// Personel listesi: tek tablo, her şey satır içinde düzenlenir, değişiklik anında kaydedilir.
// Aynı kişi farklı tarihlerde farklı şubelerde SGK'lı olabilir (şube değişikliği); aynı tarihlerde olamaz.
function tarihCakisir(g1,c1,g2,c2){return (!c2||!g1||g1<=c2)&&(!c1||!g2||g2<=c1);}
function sgkCakisma(p,sgkV,ad,gi=p.giris,ci=p.cikis){if(!sgkV||sgkV===SGK_YOK)return null;
  return S.personel.find(x=>x.id!==p.id&&x.sgkSube&&x.sgkSube!==SGK_YOK&&x.sgkSube!==sgkV&&ayniKisi(x,{...p,ad:ad||p.ad})&&tarihCakisir(gi,ci,x.giris,x.cikis))||null;}
function sgkCakismaMesaj(c){return `${adBuyuk(c.ad)} ${trTarih(c.giris)||'?'} – ${c.cikis?trTarih(c.cikis):'devam'} arası ${subeAdi(c.sgkSube)} şubesinde SGK'lı. Aynı tarihlerde iki şubede SGK olamaz; tarihleri ayırın (örneğin oradan çıkış 1 Eylül, buraya giriş 2 Eylül).`;}
// Telefonda personel listesi: kişi başına kısa satır, dokununca düzenleme penceresi.
function accBaslik(k,ad,n,acik){return `<button class="pkg pkgt" data-acc="${k}"><span>${ad} · ${n}</span><span class="ar">${acik?'▾':'▸'}</span></button>`;}
function mobilListe(A,C,P,Pf,td){const ch=(b,v,c='')=>`<span class="pch ${c}"><b>${b}</b>${esc(v)}</span>`;
  const satir=p=>{const sgk=p.sgkSube&&p.sgkSube!==SGK_YOK?p.sgkSube:'';const ana=p.anaSube||S.subeId;const ms=odemeSubesi(p,ayKey(today()));const cik=p.cikis&&p.cikis<td;
    const tar=[p.giris?'Giriş '+trTarih(p.giris):'',p.baslama?'Deneme '+trTarih(p.baslama):'',p.cikis?'Çıkış '+trTarih(p.cikis):'',cik&&!pasifSure(p,td)?'Pasife geçer '+trTarih(pasifTarihi(p.cikis)):''].filter(Boolean).join(' · ');
    const g=gorevTahmin(p);let c=sgk?ch('SGK',subeAdi(sgk)):p.sgkSube===SGK_YOK?ch('SGK','yok'):ch('SGK','seçilmedi','bad');if(ana!==sgk)c+=ch('Çalıştığı',subeAdi(ana));const ek=ekSubeleri(p).filter(x=>x!==ana&&x!==sgk);if(ek.length&&!isSube())c+=ch('Diğer',ek.map(subeAdi).join(', '),'e');if(!isSube()&&ms!==sgk&&(ms!==ana||sgk))c+=ch('Maaş',subeAdi(ms),'f');
    return `<button class="pkr ${cik?'cik':''}" data-pk="${esc(p.id)}"><span class="n">${esc(adBuyuk(p.ad))}<i>${esc(g||'görev yok')} · ${esc(p.sekil||'Tam')}</i></span>${tar?`<span class="d">${tar}</span>`:''}<span class="c">${c}</span></button>`;};
  const acc=S.acc||{};
  let h='';GRUP_SIRA.forEach(g=>{const l=A.filter(p=>(p.grup||'K')===g);if(!l.length)return;h+=`<div class="pkg">${GRUP[g]} · ${l.length}</div>`+l.map(satir).join('');});
  if(C.length){h+=accBaslik('cik','Çıkış yapanlar',C.length,acc.cik);if(acc.cik)h+=C.map(satir).join('');}
  if(P.length){h+=accBaslik('pas','Pasifler',P.length,acc.pas);if(acc.pas)h+=`<div class="pasara"><input class="pasAra" placeholder="Ad ile ara" value="${esc(S.pasAra||'')}" autocomplete="off"></div>`+(Pf.length?Pf.map(satir).join(''):'<div class="pkg">Eşleşen kişi yok</div>');}
  return `<div class="pkl">${h||'<div class="pkg">Henüz personel yok</div>'}</div>`;}
function renderBilgiListesi(){const T=byId('blTbl');const gor=S.pgor||'calisma';const CAL=gor==='calisma';
  const list=sirala(subePersoneli());const td=ymd(today());
  const A=list.filter(p=>!p.cikis||p.cikis>=td);const Pall=list.filter(p=>p.cikis&&p.cikis<td&&pasifMi(p,td,list));const C=list.filter(p=>p.cikis&&p.cikis<td&&!pasifMi(p,td,list));
  const acc=S.acc||{};const qa=isimAnahtar(S.pasAra||'');const Pf=qa?Pall.filter(p=>isimAnahtar(p.ad).includes(qa)):Pall;
  const L=[...A,...(acc.cik?C:[]),...(acc.pas?Pf:[])];const Lsay=[...A,...C];
  const F=CAL?[]:BILGI;
  if(T&&T.contains(document.activeElement)&&T.dataset.n===String(L.length))return; // yazarken yeniden çizme
  tcYukle(L);
  const subeler=tumSubeler();const anaSec=(isIsveren()?S.subeIds:(S.me.subeler||[])).filter(x=>S.subeler[x]);
  const eksik=L.filter(p=>!p.cikis||p.cikis>=td).filter(p=>!p.sgkSube||!gorevBul(p.gorev)).length;const isz=Lsay.filter(p=>isimsizMi(p)).length;
  const opt=(v,t,sel)=>`<option value="${esc(v)}" ${sel?'selected':''}>${esc(t)}</option>`;
  const satir=(p,r)=>{const yaz=personelYazabilir(p);const dis=yaz?'':'disabled';const disB=yaz&&!isSube()?'':'disabled';/* SGK / giriş / çıkış / şube / şekil: sadece bölge müdürü ve işveren */const g=gorevBul(gorevTahmin(p));const cik=p.cikis&&p.cikis<td;const ana=p.anaSube||S.subeId;
    return `<tr data-pid="${esc(p.id)}" class="${cik?'mutr':''}">
     <td class="l nmc"><input class="adI" data-x="ad" value="${esc(adBuyuk(p.ad))}" autocomplete="off" spellcheck="false" ${dis}><span>${[CAL||isSube()?'':(ana!==S.subeId?'çalıştığı: '+esc(subeAdi(ana)):''),cik?'çıktı':'',isimsizMi(p)&&p.excelAd?'Excel: '+esc(p.excelAd):''].filter(Boolean).join(' · ')}</span></td>
     ${CAL?`     <td class="bi"><select data-x="gorev" ${dis}>${g?'':opt('','Seçin',true)}${GOREVLER.map(x=>opt(x.ad,x.ad,g&&g.ad===x.ad)).join('')}</select></td>
     <td class="bi">${`<select data-x="sekil" ${disB} ${g&&g.sekil?'disabled':''}>${g&&g.sekil?opt(g.sekil,'Esnaf',true):['Tam','Part'].map(x=>opt(x,x,(p.sekil==='Part'?'Part':'Tam')===x)).join('')}</select>`}</td>
     <td class="bi sbh"><div class="sbz">${(()=>{const sgk=p.sgkSube&&p.sgkSube!==SGK_YOK?p.sgkSube:'';const ms=odemeSubesi(p,ayKey(today()));
       let h=`<label class="chs ${p.sgkSube?'':'bad'}"><b>SGK</b><select data-x="sgkSube" ${disB}>${p.sgkSube?'':opt('','Seçin',true)}${opt(SGK_YOK,'Yok',p.sgkSube===SGK_YOK)}${subeler.map(([sid,ad])=>opt(sid,ad,p.sgkSube===sid)).join('')}</select></label>`;
       h+=`<label class="chs ${ana===sgk?'ayni':''}" title="Çalıştığı şube (çizelgesinde göründüğü)"><b>Çalıştığı</b><select data-x="anaSube" ${disB}>${(anaSec.includes(ana)?anaSec:[ana,...anaSec]).map(x=>opt(x,subeAdi(x),ana===x)).join('')}</select></label>`;
       const ek=ekSubeleri(p).filter(x=>x!==ana&&x!==sgk);if(!isSube()&&(ek.length||ekYetkiVar()))h+=`<label class="chs e" title="Bu şubelerin çizelgesinde de görünür; çalıştığı günün mesaisi o şubeden ödenir. Sadece işveren ve bölge müdürü değiştirir."><b>Diğer</b><button class="chb" data-x="ekSube" ${ekYetkiVar()?'':'disabled'}>${ek.length?esc(ek.map(kisaSubeAd).join(', ')):'+ ekle'}</button></label>`;
       if(!isSube()&&p.paketBasi)h+=`<span class="chs ayni" title="Paket başı çalışan: maaş yok, hangi şubede paket attıysa o şubede ödenir. Muhasebe SGK şubesinde."><b>Paket başı</b></span>`;else if(!isSube()&&((sgk&&sgk!==ana)||ms!==ana||ek.length)){const sec=[[ana,subeAdi(ana)],...(sgk&&sgk!==ana?[[sgk,subeAdi(sgk)]]:[]),...ek.map(x=>[x,subeAdi(x)]),...(ms!==ana&&ms!==sgk&&!ek.includes(ms)?[[ms,subeAdi(ms)]]:[])];
         h+=`<label class="chs f" title="Bu aydan itibaren maaşın ödeneceği şube. Önceki aylar değişmez. Muhasebe SGK şubesinde kalır.${maasSubeGecmisYazi(p)?' Geçmiş: '+esc(maasSubeGecmisYazi(p)):''}"><b>Maaş</b><select data-x="maasYeri" ${dis}>${sec.map(([v,a])=>opt(v,a,ms===v)).join('')}</select></label>`;}
       return h;})()}</div></td>
     <td class="bi"><input type="date" data-x="baslama" title="Deneme başlangıcı (SGK'dan önce çalıştığı ilk gün)" class="${p.baslama?'':'bos'}" value="${esc(p.baslama||'')}" ${dis}></td>
     <td class="bi"><input type="date" data-x="giris" class="${p.giris?'':'bos'}" value="${esc(p.giris||'')}" ${disB}></td>
     <td class="bi"><input type="date" data-x="cikis" class="${p.cikis?'':'bos'}" value="${esc(p.cikis||'')}" ${disB}></td>
`:''}
     ${F.map((f,c)=>`<td class="bi"><input data-r="${r}" data-c="${c}" data-f="${f.k}" value="${esc(bilgiGoster(f,f.k==='tc'?tcOf(p):p[f.k]))}" placeholder="${esc(f.ph)}" inputmode="${f.im}" autocomplete="off" spellcheck="false" ${dis}></td>`).join('')}
     <td class="bi"><button class="mini" data-x="menu" title="Sil / çıkış ver" ${dis}>⋯</button></td></tr>`;};
  let body='';let r=0;const CS=CAL?8:F.length+2;GRUP_SIRA.forEach(g=>{const l=A.filter(p=>(p.grup||'K')===g);if(!l.length)return;body+=`<tr class="grp"><td class="l nmc">${GRUP[g]} · ${l.length}</td><td colspan="${CS}"></td></tr>`;l.forEach(p=>{body+=satir(p,L.indexOf(p));});});
  const accTr=(k,ad,n)=>`<tr class="grp"><td class="l nmc"><button class="accb" data-acc="${k}">${ad} · ${n} ${acc[k]?'▾':'▸'}</button></td><td colspan="${CS}"></td></tr>`;
  if(C.length){body+=accTr('cik','Çıkış yapanlar',C.length);if(acc.cik)C.forEach(p=>{body+=satir(p,L.indexOf(p));});}
  if(Pall.length){body+=accTr('pas','Pasifler',Pall.length);if(acc.pas){body+=`<tr><td class="l" colspan="${CS+1}"><input class="pasAra" placeholder="Ad ile ara" value="${esc(S.pasAra||'')}" autocomplete="off"></td></tr>`;Pf.forEach(p=>{body+=satir(p,L.indexOf(p));});}}
  const h=`<div class="actions"><button class="btn primary grow" id="addP">Personel ekle</button>${isSube()?'':`<button class="btn grow" id="addX">Excel'den yapıştır</button>`}</div>
   <p class="note" style="margin-top:0">${esc(sube().ad)} · ${(()=>{const dis=Lsay.filter(p=>p.anaSube!==S.subeId&&p.sgkSube!==S.subeId&&ekSubeleri(p).includes(S.subeId)).length;return dis&&!isSube()?`${Lsay.length-dis} kişi + ${dis} diğer şubeden`:`${Lsay.length} kişi`;})()}${eksik?` · <b style="color:var(--warn)">${eksik} kişide görev ya da SGK şubesi eksik</b>`:''}${isz?` · <b style="color:var(--warn)">${isz} isimsiz kişinin adı yazılmadı</b>`:''} · ${CAL?'Hücreye tıklayıp değiştirin, anında kaydedilir.':'Excel\'den kopyalayıp yapıştırabilirsiniz; ilk sütun isimse satırlar isimle eşleşir.'}</p>
   <div class="seg" id="pGor" style="margin-bottom:10px"><button data-v="calisma" class="${CAL?'on':''}">Çalışma bilgileri</button><button data-v="iletisim" class="${CAL?'':'on'}">İletişim ve banka</button></div>
   ${CAL?mobilListe(A,C,Pall,Pf,td):''}
   <div class="tbl-wrap ${CAL?'bl-cal':''}" style="scroll-padding-left:165px"><table class="pt bl sade ${CAL?'cal':''}" id="blTbl" data-n="${L.length}"><thead><tr><th class="l">Ad soyad</th>${CAL?`<th>Görev</th><th>Şekil</th><th class="l">Şubeler</th><th>Deneme</th><th>SGK giriş</th><th>Çıkış</th>`:''}${F.map(f=>`<th>${f.ad}</th>`).join('')}<th></th></tr></thead>
   <tbody>${body||`<tr><td class="l" colspan="${CAL?8:F.length+2}">Henüz personel yok. "Personel ekle" ile başlayın.</td></tr>`}</tbody></table></div>`;
  view(h,()=>{byId('addP').onclick=()=>personelPanel(null);if(byId('addX'))byId('addX').onclick=personelYapistirPanel;document.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>personelPanel(b.dataset.pk));const tb=byId('blTbl');document.querySelectorAll('[data-acc]').forEach(b=>b.onclick=()=>{S.acc={...(S.acc||{}),[b.dataset.acc]:!(S.acc||{})[b.dataset.acc]};render();});document.querySelectorAll('.pasAra').forEach(i=>i.oninput=()=>{S.pasAra=i.value;const s0=i.selectionStart;render();const nI=[...document.querySelectorAll('.pasAra')].find(x=>x.offsetParent);if(nI){nI.focus();try{nI.setSelectionRange(s0,s0);}catch(_){}}});document.querySelectorAll('#pGor button').forEach(b=>b.onclick=()=>{S.pgor=b.dataset.v;render();});
    const pOf=el=>S.personel.find(x=>x.id===el.closest('tr').dataset.pid);
    const yaz1=(p,body,yenidenCiz)=>{const b2=personelYaz(p.id,{...p},body);Object.assign(p,b2);if(yenidenCiz){document.activeElement&&document.activeElement.blur();render();}};
    const geri=(el,msg,v)=>{toast(msg);el.value=v;el.classList.add('bad');setTimeout(()=>el.classList.remove('bad'),2500);};
    tb.querySelectorAll('[data-x]').forEach(el=>{const x=el.dataset.x;
      if(x==='menu'){el.onclick=()=>personelPanel(el.closest('tr').dataset.pid);return;}
      if(x==='ekSube'){el.onclick=()=>{const p=pOf(el);if(p)ekSubePanel(p);};return;}
      if(x==='ad')el.oninput=()=>{const a=el.selectionStart,b=el.selectionEnd;el.value=el.value.toLocaleUpperCase('tr-TR');try{el.setSelectionRange(a,b);}catch(_){}};
      const tarihMi=el.type==='date';
      // Tarih alanı yazılırken her rakamda değişiklik gelir; sadece alandan çıkınca ve yıl tamamsa kaydet.
      if(tarihMi){el.onchange=null;el.onkeydown=e=>{if(e.key==='Enter')el.blur();};}
      el[tarihMi?'onblur':'onchange']=()=>{const p=pOf(el);if(!p)return;const v=el.value;if(tarihMi){if(v===(p[x]||''))return;if(v&&(+v.slice(0,4)<1990||+v.slice(0,4)>2100))return geri(el,'Tarih hatalı, yılı 4 haneli yazın.',p[x]||'');}
        if(x==='ad'){const ad=adBuyuk(v);if(!ad)return geri(el,'Ad soyad boş olamaz.',adBuyuk(p.ad));const c=sgkCakisma(p,p.sgkSube,ad);if(c)return geri(el,sgkCakismaMesaj(c),adBuyuk(p.ad));
          // İsimsiz kayda şubede zaten olan birinin adı verilirse: aynı kişiyse günleri iki kayıtta kalır, iki kez sayılır.
          if(isimsizMi(p)&&ad!==adBuyuk(p.ad)){const ana=p.anaSube||S.subeId;const ay=subePersoneli(ana).find(y=>y.id!==p.id&&isimAnahtar(y.ad)===isimAnahtar(ad)&&!(y.cikis&&y.cikis<ymd(today())));
            if(ay&&!confirm(`${subeAdi(ana)} listesinde ${adBuyuk(ay.ad)} zaten var.\n\nBu isimsiz kayıt o kişiyse İptal'e basın: çizelge günleri iki ayrı kayıtta kalır ve iki kez sayılır.\n\nFarklı kişiyse Tamam'a basın.`))return geri(el,'Ad değiştirilmedi.',adBuyuk(p.ad));}
          el.value=ad;if(ad!==p.ad)yaz1(p,{ad});return;}
        if(x==='gorev'){const g=gorevBul(v);if(!g)return;const body={gorev:g.ad,grup:g.grup,sekil:g.sekil||(p.sekil==='Part'?'Part':'Tam')};yaz1(p,gorevSatirYama(p,body),true);return;}
        if(x==='sekil'){yaz1(p,gorevSatirYama(p,{sekil:v}));return;}
        if(x==='maasYeri'){const ak=ayKey(today());const sgk0=p.sgkSube&&p.sgkSube!==SGK_YOK?p.sgkSube:'';const my=v===sgk0&&v!==(p.anaSube||S.subeId)?'sgk':'calistigi';const ym=maasGecmisYama(p,v,ak);yaz1(p,{maasYeri:my,...(ym||{})},true);const hs=odemeSubesi(p,ak);toast(`${ayAdi(ak<BASLANGIC_AY?BASLANGIC_AY:ak)} ayından itibaren maaşı ${subeAdi(hs)} puantajında; önceki aylar değişmez.${hs!==p.sgkSube&&p.sgkSube&&p.sgkSube!==SGK_YOK?` Muhasebe ${subeAdi(p.sgkSube)}'de kalır.`:''}`);return;}
        if(x==='sgkSube'){if(!v)return;const c=sgkCakisma(p,v);if(c)return geri(el,sgkCakismaMesaj(c),p.sgkSube||'');
          const eski=p.sgkSube;const ymS=maasGecmisYama(p,{sgkSube:v},ayKey(today()));yaz1(p,{sgkSube:v,...(ymS||{})},true);if(v!==SGK_YOK&&v!==(p.anaSube||S.subeId)&&v!==eski){toast(`${subeAdi(v)} listesinde de görünür. Çizelgeye o şubenin müdürü "+ ekle" ile ekler.`);}return;}
        if(x==='anaSube'){if(!v||v===p.anaSube)return;const ak=ayKey(today());const ym=maasGecmisYama(p,{anaSube:v},ak);yaz1(p,{anaSube:v,...(ym||{})},true);toast(`${subeAdi(v)} listesine geçti. Çizelgeye "+ ekle" ile eklenir.${ym?` Maaşı ${ayAdi(ak<BASLANGIC_AY?BASLANGIC_AY:ak)} ayından itibaren ${subeAdi(odemeSubesi(p,ak))} puantajında; önceki aylar değişmez.`:''}`);return;}
        if(x==='baslama'){if(v&&p.giris&&v>p.giris)return geri(el,'İşe başlama SGK girişinden sonra olamaz. Boş bırakılırsa SGK girişi kullanılır.',p.baslama||'');yaz1(p,{baslama:v},true);return;}
        if(x==='giris'||x==='cikis'){const gi=x==='giris'?v:p.giris,ci=x==='cikis'?v:p.cikis;if(gi&&ci&&ci<gi)return geri(el,'Çıkış tarihi girişten önce olamaz.',p[x]||'');{const c=sgkCakisma(p,p.sgkSube,p.ad,gi,ci);if(c)return geri(el,sgkCakismaMesaj(c),p[x]||'');}yaz1(p,{[x]:v},x==='cikis');return;}};});
    const inp=(r,c)=>tb.querySelector(`input[data-r="${r}"][data-c="${c}"]`);
    const kaydet=(el,sessiz)=>{const p=L[+el.dataset.r];const f=F[+el.dataset.c];if(!p||!f)return true;const r=bilgiCoz(f,el.value);
      if(r.hata){el.classList.add('bad');el.title=r.hata;if(!sessiz)toast(`${kisaAd(p.ad)} · ${r.hata}`);return false;}
      el.classList.remove('bad');el.title='';el.value=bilgiGoster(f,r.v);const eski=f.k==='tc'?tcOf(p):(p[f.k]||'');if(r.v!==eski)bilgiKaydet(p,f,r.v);return true;};
    const satirSira=[...tb.querySelectorAll('tr[data-pid]')].map(t=>t.querySelector('input[data-c="0"]')).map(i=>i&&+i.dataset.r);
    const asagi=(r,yon)=>{const i=satirSira.indexOf(r);const n=satirSira[i+yon];return n==null?null:n;};
    tb.querySelectorAll('input[data-c]').forEach(el=>{el.onchange=()=>kaydet(el);
      el.onkeydown=e=>{const r=+el.dataset.r,c=+el.dataset.c;let n=null;if(e.key==='Enter'||e.key==='ArrowDown'){const q=asagi(r,1);n=q==null?null:inp(q,c);}else if(e.key==='ArrowUp'){const q=asagi(r,-1);n=q==null?null:inp(q,c);}if(n||e.key==='Enter'){e.preventDefault();if(n){n.focus();n.select();}else el.blur();}};
      el.onpaste=e=>{const t=(e.clipboardData||window.clipboardData).getData('text');if(!/[\t\n]/.test(t.trim()))return;e.preventDefault();
        let M=t.replace(/\r/g,'').split('\n');while(M.length&&!M[M.length-1].trim())M.pop();M=M.map(x=>x.split('\t'));
        const r0=+el.dataset.r,c0=+el.dataset.c;const ad={};L.forEach((p,i)=>ad[isimAnahtar(p.ad)]=i);
        const isimli=M[0].length>1&&M.filter(x=>x[0].trim()).every(x=>ad[isimAnahtar(x[0])]!=null);let n=0,bad=0,yok=0;let rr=r0;
        M.forEach((row,i)=>{const r=isimli?ad[isimAnahtar(row[0])]:(i===0?r0:(rr=asagi(rr,1)));const cells=isimli?row.slice(1):row;if(r==null||r>=L.length){yok++;return;}
          cells.forEach((v,j)=>{const x=inp(r,c0+j);if(!x||x.disabled)return;x.value=v.trim();if(kaydet(x,true))n++;else bad++;});});
        toast(`${n} hücre yapıştırıldı${bad?`, ${bad} hücre hatalı (kırmızı)`:''}${yok?`, ${yok} satır eşleşmedi`:''}.`);};});});}

// Excel'den personel listesi yapıştırma: SGK ŞUBE · ÇALIŞMA ŞEKLİ · ADI SOYADI · GÖREV · GİRİŞ · ÇIKIŞ (başlık varsa sütunlar ona göre bulunur)
function gorevCoz(x){const a=ascii(x).replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();if(!a)return null;if(/esnaf/.test(a))return gorevBul('Esnaf Kurye');if(/surucu|kurye|motor/.test(a))return gorevBul('Kurye');
  if(/^r\b|restoran|^mudur$|^r mudur/.test(a))return gorevBul('R. Müdür');if(/^v\b|vardiya|^v mudur|yardimci/.test(a))return gorevBul('V. Müdür');if(/mutfak|ekip|personel|ekip uyesi/.test(a))return gorevBul('Mutfak');return null;}
function personelYapistirPanel(){const sid=S.subeId;
  openSheet(`<h2>Excel'den personel ekle</h2><div class="sub">${esc(sube().ad)} listesine eklenir. Sütunlar: SGK ŞUBE · ÇALIŞMA ŞEKLİ · ADI SOYADI · GÖREV · GİRİŞ TARİHİ · ÇIKIŞ TARİHİ. Başlık satırını da kopyalarsanız sütun sırası önemli değil.</div>
   <label class="field"><span>Excel'den kopyaladığınız satırlar</span><textarea id="piT" rows="5" placeholder="Excel'de satırları seçip Ctrl+C, buraya Ctrl+V"></textarea></label><div id="piOut"></div>`,()=>{
   const T=byId('piT');let sonuc=[];
   const coz=()=>{let L=T.value.replace(/\r/g,'').split('\n').filter(x=>x.trim()).map(x=>x.split('\t').map(y=>y.trim()));if(!L.length){byId('piOut').innerHTML='';return;}
     let sira={sgk:0,sekil:1,ad:2,gorev:3,giris:4,cikis:5};const bas=L[0].map(x=>ascii(x));
     if(bas.some(x=>/adi|soyad/.test(x))){sira={};bas.forEach((x,j)=>{if(/sgk/.test(x))sira.sgk=j;else if(/calisma|sekil/.test(x))sira.sekil=j;else if(/adi|soyad|isim/.test(x))sira.ad=j;else if(/gorev/.test(x))sira.gorev=j;else if(/giris/.test(x))sira.giris=j;else if(/cikis/.test(x))sira.cikis=j;});L=L.slice(1);}
     const subeAd={};tumSubeler().forEach(([id,a])=>subeAd[isimAnahtar(a)]=id);const mevcut=subePersoneli(sid);const gorulen={};
     sonuc=L.map(r=>{const al=k=>sira[k]!=null?(r[sira[k]]||''):'';const ad=adBuyuk(al('ad'));const o={ad,hata:'',uyari:''};if(!ad){o.hata='İsim yok';return o;}
       const sg=al('sgk');o.sgk=sg?subeAd[isimAnahtar(sg)]:SGK_YOK;if(sg&&!o.sgk)o.hata=`SGK şubesi bulunamadı: ${sg}`;
       const g=gorevCoz(al('gorev'));o.gorev=g;if(!g)o.hata=o.hata||`Görev tanınmadı: ${al('gorev')||'boş'}`;
       const sk=ascii(al('sekil'));o.sekil=g&&g.sekil?g.sekil:(/part/.test(sk)?'Part':'Tam');
       o.giris=al('giris')?trTarihCoz(al('giris')):'';o.cikis=al('cikis')?trTarihCoz(al('cikis')):'';if(al('giris')&&!o.giris)o.hata=o.hata||'Giriş tarihi okunamadı';if(al('cikis')&&!o.cikis)o.hata=o.hata||'Çıkış tarihi okunamadı';
       if(o.giris&&o.cikis&&o.cikis<o.giris)o.hata=o.hata||'Çıkış girişten önce';
       const k=isimAnahtar(ad);const var_=mevcut.find(p=>isimAnahtar(p.ad)===k);if(var_){o.hata=o.hata||'Listede zaten var';}
       if(gorulen[k]){o.uyari='Aynı isim bu yapıştırmada iki kez var';}gorulen[k]=1;
       if(!o.hata&&o.sgk&&o.sgk!==SGK_YOK){const c=S.personel.find(x=>isimAnahtar(x.ad)===k&&x.sgkSube&&x.sgkSube!==SGK_YOK&&x.sgkSube!==o.sgk&&(!x.cikis||x.cikis>=ymd(today())));if(c)o.hata=`Zaten ${subeAdi(c.sgkSube)} şubesinde SGK'lı`;}
       o.sec=!o.hata&&!o.uyari;return o;});
     const iyi=sonuc.filter(x=>!x.hata).length;
     byId('piOut').innerHTML=`<div class="tbl-wrap" style="max-height:46vh;overflow:auto"><table class="pt"><thead><tr><th></th><th class="l">Ad soyad</th><th>Görev</th><th>Şekil</th><th>SGK</th><th>Giriş</th><th>Çıkış</th><th class="l">Durum</th></tr></thead><tbody>${sonuc.map((o,j)=>`<tr class="${o.hata?'oto':''}"><td>${o.hata?'':`<input type="checkbox" data-j="${j}" ${o.sec?'checked':''}>`}</td><td class="l"><b>${esc(o.ad)}</b></td><td>${o.gorev?esc(o.gorev.ad):''}</td><td>${esc(o.sekil||'')}</td><td>${o.sgk===SGK_YOK?'Boş':o.sgk?esc(subeAdi(o.sgk)):''}</td><td>${trTarih(o.giris)}</td><td>${trTarih(o.cikis)}</td><td class="l">${o.hata?`<span class="chip warn">${esc(o.hata)}</span>`:o.uyari?`<span class="chip warn">${esc(o.uyari)}</span>`:'<span class="chip ok">Eklenecek</span>'}</td></tr>`).join('')}</tbody></table></div>
       <div class="row2"><button class="btn grow" id="piNo">Vazgeç</button><button class="btn primary grow" id="piOk" ${iyi?'':'disabled'}>Seçilenleri ekle</button></div>`;
     byId('piNo').onclick=closeSheet;byId('piOut').querySelectorAll('input[data-j]').forEach(c=>c.onchange=()=>{sonuc[+c.dataset.j].sec=c.checked;});
     byId('piOk').onclick=async()=>{const L2=sonuc.filter(o=>!o.hata&&o.sec);if(!L2.length){toast('Seçili kişi yok.');return;}const b=writeBatch(db);const yeni=[];const td=ymd(today());
       L2.forEach(o=>{const pid=slug(o.ad)+'-'+Math.random().toString(36).slice(2,6);const body={ad:o.ad,gorev:o.gorev.ad,grup:o.gorev.grup,sekil:o.sekil,giris:o.giris||'',cikis:o.cikis||'',sgkSube:o.sgk,anaSube:sid};b.set(doc(db,'personel',pid),body);yeni.push({id:pid,...body});});
       try{await b.commit();yeni.forEach(p=>{if(!S.personel.some(x=>x.id===p.id))S.personel.push(p);});
         const hafta=mondayOf(today());const aktif=yeni.filter(p=>(!p.cikis||p.cikis>=td)&&(!p.giris||p.giris<=ymd(addDays(parse(hafta),6))));/* çizelgeye otomatik eklenmez */void aktif;void hafta;
         closeSheet();toast(`${yeni.length} personel eklendi${aktif.length?`, ${aktif.length} kişi bu haftanın çizelgesine kondu`:''}.`);render();}catch(e){yazmaHatasi(e);}};};
   T.oninput=coz;T.focus();});}
// Kişinin çalıştığı şube ya da SGK şubesi değişince eski şube "görünür şubeler"e ve o şubenin ek personel listesine eklenir:
// eski şubenin geçmiş haftaları, özetleri ve puantajı kişiyi kaybetmez (kişi yeni haftalara önerilmez).
function eskiSubeYama(p0,body){const once=[p0.anaSube,p0.sgkSube].filter(x=>x&&x!==SGK_YOK);const sonra=new Set([body.anaSube??p0.anaSube,body.sgkSube??p0.sgkSube,...ekSubeleri({...p0,...body})].filter(x=>x&&x!==SGK_YOK));
  const dusen=once.filter(x=>!sonra.has(x));if(!dusen.length)return{body,dusen};return{body:{...body,gorunurSubeler:[...new Set([...(p0.gorunurSubeler||[]),...dusen])]},dusen};}
function personelYaz(pid,p0,body){const r=eskiSubeYama(p0||{},body);
  sirayla('p'+pid,()=>{const b=writeBatch(db);b.set(doc(db,'personel',pid),r.body,{merge:true});r.dusen.forEach(x=>b.set(doc(db,'ekPersonel',x),{ids:{[pid]:true}},{merge:true}));arka(b.commit());});return r.body;}
// Silmeden önce: kişinin herhangi bir şubede çizelge kaydı var mı (varsa silinmez, çıkış tarihi girilir).
async function personelKaydiVar(p){for(const sid of kisiSubeleri(p)){const q=await getDocs(collection(db,'subeler',sid,'haftalar'));
    if(q.docs.some(d=>{const x=d.data()||{};return (Array.isArray(x.kadro)&&x.kadro.includes(p.id))||Object.values((x.cells||{})[p.id]||{}).some(v=>v);}))return subeAdi(sid)||sid;}
  return null;}
function personelYazabilir(p){const m=S.me.subeler||[];return isIsveren()||!p.anaSube||m.includes(p.anaSube)||m.includes(p.sgkSube);}
function erisimVar(sid){return isIsveren()||(S.me.subeler||[]).includes(sid);}
// Şubenin listesi: o şubede çalışanlar + SGK'sı o şubede olanlar (başka şubede çalışsa da).
export function subePersoneli(sid=S.subeId){return S.personel.filter(p=>subedeAktif(p,sid));}
function personelMod(){return `<div class="seg" id="pMod" style="margin-bottom:10px"><button data-v="kart" class="${S.plist?'':'on'}">Kartlar</button><button data-v="liste" class="${S.plist?'on':''}">Bilgi listesi</button></div>`;}
function personelModBagla(){document.querySelectorAll('#pMod button').forEach(b=>b.onclick=()=>{S.plist=b.dataset.v==='liste';tryLS('pm.plist',S.plist?'1':'0');render();});}
export function renderPersonel(){return renderBilgiListesi();}
function eskiKartListesi(){const list=sirala(subePersoneli());const td=ymd(today());
  let h=personelMod()+`<div class="actions"><button class="btn primary grow" id="addP">Personel ekle</button></div><p class="note" style="margin-top:0">${esc(sube().ad)} personel listesi. SGK'sı bu şubede olup başka şubede çalışanlar da burada görünür.</p>`;
  if(!list.length)return view(h+`<div class="empty-state"><b>Henüz personel yok</b>"Personel ekle" ile şubenin çalışanlarını girin.</div>`,()=>{personelModBagla();byId('addP').onclick=()=>personelPanel(null);});
  const aktif=list.filter(p=>!p.cikis||p.cikis>=td),cikan=list.filter(p=>p.cikis&&p.cikis<td);
  const row=p=>`<button class="row" data-id="${esc(p.id)}"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(gorevTahmin(p)||'Görev seçilmemiş')}${p.sekil==='Part'?' · Part':''} · SGK: ${p.sgkSube===SGK_YOK?'yok':p.sgkSube?esc(subeAdi(p.sgkSube)):'<b style="color:var(--warn)">seçilmemiş</b>'}${p.anaSube&&p.anaSube!==S.subeId?' · çalıştığı: '+esc(subeAdi(p.anaSube)):''}${p.giris?' · giriş '+trTarih(p.giris):''}</span></div>
    <div class="r">${p.cikis?`<span class="chip ${p.cikis<td?'mut':'warn'}">Çıkış ${trTarih(p.cikis)}</span>`:''}</div></button>`;
  GRUP_SIRA.forEach(g=>{const l=aktif.filter(p=>(p.grup||'K')===g);if(l.length)h+=`<div class="sec">${GRUP[g]} · ${l.length}</div><div class="card list">${l.map(row).join('')}</div>`;});
  if(cikan.length)h+=`<div class="sec">Çıkış yapanlar · ${cikan.length}</div><div class="card list">${cikan.map(row).join('')}</div>`;
  view(h,()=>{personelModBagla();byId('addP').onclick=()=>personelPanel(null);document.querySelectorAll('.row[data-id]').forEach(b=>b.onclick=()=>personelPanel(b.dataset.id));});}
// Kişi kartındaki geçmiş: aynı kişinin tüm kayıtları (çalışma dönemleri), görev geçmişi ve (yetkisi olana) maaş geçmişi.
function personelGecmisHtml(p){const td=ymd(today());const K=S.personel.filter(x=>x.id===p.id||ayniKisi(x,p)).sort((a,b)=>String(ilkGun(a)||'').localeCompare(String(ilkGun(b)||'')));
  const don=K.map(x=>{const sgk=x.sgkSube&&x.sgkSube!==SGK_YOK?x.sgkSube:'';const ana=x.anaSube||'';const yer=esc(subeAdi(ana)||subeAdi(sgk)||'—')+(sgk&&sgk!==ana?` <small>(SGK ${esc(subeAdi(sgk))})</small>`:'');
    return `<div class="gcr"><span>${esc(trTarih(ilkGun(x))||'?')} – ${x.cikis?esc(trTarih(x.cikis)):'devam'}</span><span>${yer} · ${esc(gorevTahmin(x)||'—')}</span>${x.id===p.id?'<i>bu kayıt</i>':`<button class="mini" data-gk="${esc(x.id)}">Aç</button>`}</div>`;}).join('');
  const gg=gorevGecmisYazi(p);
  return `<div class="field gcm"><span>Geçmiş</span><div class="gcb"><b>Çalışma dönemleri</b>${don}</div>
    <div class="gcb"><b>Görev</b><div class="gcr"><span>${gg?esc(gg):esc(gorevTahmin(p)||'—')+(p.sekil&&p.sekil!=='Tam'?' ('+esc(p.sekil)+')':'')+' · değişiklik yok'}</span></div></div>
    ${isSube()?'':'<div class="gcb"><b>Maaş</b><div class="gcr" id="pMaasG"><span class="note" style="margin:0">Yükleniyor…</span></div></div>'}</div>`;}
async function personelMaasGecmisi(p){document.querySelectorAll('[data-gk]').forEach(b=>b.onclick=()=>{closeSheet();personelPanel(b.dataset.gk);});
  const el=byId('pMaasG');if(!el)return;const K=S.personel.filter(x=>x.id===p.id||ayniKisi(x,p));const ay={};let once=null;
  for(const x of K){const subs=[...new Set([...Object.values(x.maasSubeGecmis||{}),odemeSubesiEski(x)].filter(Boolean))];
    for(const sid of subs){try{const d=await getDoc(doc(db,'maaslar',sid));const m=d.exists()?d.data():{};const g=(m.netGecmis||{})[x.id]||{};Object.entries(g).forEach(([k,v])=>{if(sayi(v))ay[k]=sayi(v);});const n=sayi((m.net||{})[x.id]);if(n&&once==null)once=n;}catch(e){}}}
  if(!byId('pMaasG'))return;const ks=Object.keys(ay).sort();const L=ks.filter((k,i)=>i===0||ay[k]!==ay[ks[i-1]]).map(k=>`${ayAdi(k)}: ${tl0(ay[k])}`);
  if(once!=null&&(!ks.length||(ks[0]>BASLANGIC_AY&&once!==ay[ks[0]])))L.unshift(`${ks.length?'Önce':'Kayıtlı'}: ${tl0(once)}`);// ilk kayıt başlangıç ayındaysa eski değer hiçbir aya uygulanmaz
  byId('pMaasG').innerHTML=`<span>${L.length?esc(L.join(' · ')):'Maaş girilmemiş'}</span>`;}
export function personelPanel(id,gr,opt={}){const eskiK=!id&&opt.eski?S.personel.find(x=>x.id===opt.eski):null;// yeniden işe giriş: eski kaydın bilgileriyle yeni kayıt
  const p=id?S.personel.find(x=>x.id===id):eskiK?{ad:eskiK.ad,grup:eskiK.grup||'K',gorev:eskiK.gorev||'',sekil:eskiK.sekil||'Tam',giris:isSube()?'':ymd(today()),cikis:'',anaSube:isSube()?S.subeId:(eskiK.anaSube||S.subeId),sgkSube:isSube()?'':(eskiK.sgkSube||'')}:{ad:'',grup:gr||'K',gorev:'',sekil:'Tam',giris:isSube()?'':ymd(today()),cikis:'',anaSube:S.subeId};if(!p)return;
  const yaz=personelYazabilir(p);const yazB=yaz&&!isSube();/* SGK şubesi, çalıştığı şube, şekil, SGK giriş, çıkış: sadece bölge müdürü ve işveren (şube müdürü görür) */const gv=id||eskiK?gorevTahmin(p):'';const sgk=p.sgkSube||'';const subeler=tumSubeler();
  const anaSec=(isIsveren()?S.subeIds:(S.me.subeler||[])).filter(x=>S.subeler[x]);
  const gorevOpt=GOREVLER.filter(g=>id||!gr||g.grup===gr).map(g=>`<option value="${esc(g.ad)}" ${gv===g.ad?'selected':''}>${esc(g.ad)}</option>`).join('');
  const buAy=ayKey(today());const gayOpt=(()=>{const L=[];for(let k=BASLANGIC_AY;k<=buAy;k=ayKaydir(k,1))L.push(k);return L.reverse().map(k=>`<option value="${k}" ${k===buAy?'selected':''}>${esc(ayAdi(k))}</option>`).join('');})();
  openSheet(`<h2>${id?'Personeli düzenle':eskiK?'Yeniden işe giriş':'Yeni personel · '+GRUP[gr||'K']}</h2><div class="sub">${yaz?'İsim puantaj ve bordro eşleşmesinde kullanılır, bordrodaki gibi yazın.':'Bu kişi başka bir şubeye kayıtlı; bilgilerini o şube düzenler.'}</div>
   <label class="field"><span>Ad soyad (büyük harf)</span><input id="pAd" value="${esc(adBuyuk(p.ad))}" autocomplete="off" autocapitalize="characters" ${yaz?'':'disabled'}></label>${id?'':'<div id="pEski"></div>'}${id&&isimsizMi(p)&&p.excelAd?`<p class="note" style="margin:-4px 0 10px">Excel'deki adı: <b>${esc(p.excelAd)}</b> · doğru ad soyadı yazın.</p>`:''}
   <label class="field"><span>Görev</span><select id="pGorev" ${yaz?'':'disabled'}><option value="">Seçin</option>${gorevOpt}</select></label>
   <div id="pSekilW"><span class="lbl">Çalışma şekli</span><div class="seg" id="pSekil">${['Tam','Part'].map(x=>`<button data-v="${x}" class="${(p.sekil==='Part'?'Part':'Tam')===x?'on':''}" ${yazB?'':'disabled'}>${x}</button>`).join('')}</div></div>
   ${id&&yaz?`<label class="field" id="pGayW" hidden><span>Yeni görev / şekil hangi aydan geçerli</span><select id="pGay">${gayOpt}</select><small class="note" style="margin:4px 0 0;display:block">Önceki aylar eski görevle kalır. Yanlış girilmiş görevi düzeltiyorsanız ${esc(ayAdi(BASLANGIC_AY))} seçin.</small></label>`:''}
   <label class="field"><span>SGK şubesi (maaşı bu şubenin puantajında)</span><select id="pSgk" ${yazB?'':'disabled'}><option value="" ${!sgk?'selected':''}>Seçin</option><option value="${SGK_YOK}" ${sgk===SGK_YOK?'selected':''}>Boş (SGK şubesi yok)</option>${subeler.map(([sid,ad])=>`<option value="${esc(sid)}" ${sgk===sid?'selected':''}>${esc(ad)}</option>`).join('')}</select></label>
   <label class="field"><span>Çalıştığı şube (çizelgesinde göründüğü)</span><select id="pAna" ${yazB?'':'disabled'}>${(anaSec.includes(p.anaSube||S.subeId)?anaSec:[p.anaSube||S.subeId,...anaSec]).map(x=>`<option value="${esc(x)}" ${(p.anaSube||S.subeId)===x?'selected':''}>${esc(subeAdi(x))}</option>`).join('')}</select></label>
   <div class="fgrid"><label class="field"><span>SGK giriş</span><input id="pGiris" type="date" value="${esc(p.giris||'')}" ${yazB?'':'disabled'}></label><label class="field"><span>Çıkış (boşsa çalışıyor)</span><input id="pCikis" type="date" value="${esc(p.cikis||'')}" ${yazB?'':'disabled'}></label></div>
   <label class="field"><span>${isSube()?'İlk çalıştığı gün (deneme başlangıcı)':"Deneme başlangıcı (SGK'dan önce çalıştığı ilk gün, boşsa SGK girişi)"}</span><input id="pBas" type="date" value="${esc(p.baslama||'')}" ${yaz?'':'disabled'}></label>
   ${id&&!isSube()?(()=>{const ek=ekSubeleri(p);return `<div class="field"><span>Diğer çalıştığı şubeler</span><div class="ekbox">${ek.length?ek.map(x=>`<span class="pch e"><b>${esc(subeAdi(x))}</b></span>`).join(''):'<span class="note" style="margin:0">Yok</span>'}${ekYetkiVar()?'<button class="btn small" id="pEk">Değiştir</button>':''}</div></div>`;})():''}
   ${id&&!isSube()?(()=>{const ak=ayKey(today());const ms=odemeSubesi(p,ak);const ids=[...new Set([p.anaSube||S.subeId,sgk!==SGK_YOK?sgk:'',...ekSubeleri(p),ms].filter(Boolean))];const gy=maasSubeGecmisYazi(p);
     return `<label class="field"><span>Maaşın ödendiği şube · ${ayAdi(ak<BASLANGIC_AY?BASLANGIC_AY:ak)} ayından itibaren</span><select id="pMs" ${yaz?'':'disabled'}>${ids.map(i=>`<option value="${esc(i)}" ${i===ms?'selected':''}>${esc(subeAdi(i))}</option>`).join('')}</select></label><p class="note" style="margin-top:-4px">Önceki aylar değişmez. Muhasebe SGK şubesinde kalır.${gy?' Geçmiş: '+esc(gy):''}</p>`;})():''}
   ${isSube()?`<p class="note" style="margin-top:-2px">SGK şubesi, SGK giriş, çıkış ve çalışma şeklini bölge müdürü ve işveren girer.</p>`:''}
   ${id&&!p.cikis&&yazB?'<button class="btn" id="pOut" style="margin-top:8px;width:100%">Bugün itibarıyla çıkış ver</button>':''}
   ${id&&p.cikis&&!isSube()&&p.sekil!=='Esnaf kurye'?'<button class="btn" id="pCB" style="margin-top:8px;width:100%">Çıkış bildirimi</button>':''}
   ${id&&p.cikis&&p.cikis<ymd(today())&&!S.personel.some(x=>x.id!==p.id&&ayniKisi(x,p)&&!(x.cikis&&x.cikis<ymd(today())))?'<button class="btn" id="pYeni" style="margin-top:8px;width:100%">Yeniden işe al</button>':''}
   ${id?personelGecmisHtml(p):''}
   <div id="pWarn"></div><div class="row2">${id&&(isIsveren()||(isBolge()&&(S.me.subeler||[]).includes(p.anaSube)))?'<button class="btn danger" id="pDel">Personeli sil</button>':''}<button class="btn grow" id="pNo">${yaz?'Vazgeç':'Kapat'}</button>${yaz?'<button class="btn primary grow" id="pOk">Kaydet</button>':''}</div>`,sh=>{
   sh.querySelectorAll('#pSekil button').forEach(bt=>bt.onclick=()=>{sh.querySelectorAll('#pSekil button').forEach(x=>x.classList.remove('on'));bt.classList.add('on');});
   const G=byId('pGorev');const gayW=byId('pGayW');const sekilSec=()=>{const g=gorevBul(G.value);return g&&g.sekil?g.sekil:sh.querySelector('#pSekil .on').dataset.v;};
   const gorevDeg=()=>{const g=gorevBul(G.value);return !!g&&(g.ad!==gv||sekilSec()!==(p.sekil||'Tam'));};
   const tog=()=>{const g=gorevBul(G.value);byId('pSekilW').hidden=!!(g&&g.sekil);if(gayW)gayW.hidden=!gorevDeg();};G.onchange=tog;tog();sh.querySelectorAll('#pSekil button').forEach(bt=>bt.addEventListener('click',tog));
   const pcb=byId('pCB');if(pcb)pcb.onclick=()=>cikisBildirimKopyala(p);const py=byId('pYeni');if(py)py.onclick=()=>{closeSheet();personelPanel(null,null,{eski:p.id});};if(id)personelMaasGecmisi(p);
   const po=byId('pOut');if(po)po.onclick=()=>{byId('pCikis').value=ymd(today());po.hidden=true;};byId('pNo').onclick=closeSheet;const pe=byId('pEk');if(pe)pe.onclick=()=>ekSubePanel(p);const W=byId('pWarn');if(!yaz)return;
   byId('pAd').oninput=e=>{const el=e.target,a=el.selectionStart,b=el.selectionEnd;el.value=el.value.toLocaleUpperCase('tr-TR');try{el.setSelectionRange(a,b);}catch(_){}};
   let eskiB=null;if(eskiK){const o={},liste=[];BILGI.forEach(f=>{const v=f.k==='tc'?tcOf(eskiK):eskiK[f.k];if(v){o[f.k]=v;liste.push(f.ad);}});eskiB={o,liste:liste.length?liste:['kayıtlı bilgi yok']};}
   if(!id){const E=byId('pEski');const td0=ymd(today());
     const adaylar=()=>{const q=isimAnahtar(byId('pAd').value);if(q.length<3)return[];const k=[];S.personel.filter(x=>x.cikis&&x.cikis<td0&&isimAnahtar(x.ad).includes(q)).sort((a,b)=>b.cikis.localeCompare(a.cikis)).forEach(x=>{if(!k.some(y=>ayniKisi(y,x)))k.push(x);});return k.slice(0,3);};
     const ciz=()=>{if(eskiB){E.innerHTML=`<div class="note" style="margin:0 0 8px">Kayıtlı bilgiler yeni kayda eklenecek: ${eskiB.liste.map(esc).join(', ')}.</div>`;return;}
       const a=adaylar();E.innerHTML=a.map(x=>`<button class="btn small" data-e="${esc(x.id)}" style="margin:0 6px 8px 0">${esc(adBuyuk(x.ad))} · çıkış ${trTarih(x.cikis)} — bilgilerini getir</button>`).join('');
       E.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{const m=S.personel.find(x=>x.id===b.dataset.e);if(!m)return;const o={},liste=[];BILGI.forEach(f=>{const v=f.k==='tc'?tcOf(m):m[f.k];if(v){o[f.k]=v;liste.push(f.ad);}});byId('pAd').value=adBuyuk(m.ad);eskiB={o,liste:liste.length?liste:['kayıtlı bilgi yok']};ciz();});};
     byId('pAd').addEventListener('input',()=>{eskiB=null;ciz();});ciz();}
   byId('pOk').onclick=()=>{const ad=adBuyuk(byId('pAd').value);if(!ad){W.innerHTML='<div class="confirm">Ad soyad gerekli.</div>';return;}
     const g=gorevBul(G.value);if(!g){W.innerHTML='<div class="confirm">Görev seçin.</div>';return;}
     const subeK=isSube();// şube müdürü: SGK / giriş / çıkış / şube / şekil değişmez (yeni kişide boş kalır, bölge müdürü girer)
     const sgkV=subeK?(id?(p.sgkSube||''):''):byId('pSgk').value;if(!subeK&&!sgkV){W.innerHTML='<div class="confirm">SGK şubesini seçin. SGK şubesi yoksa "Boş" seçeneğini seçin.</div>';return;}
     if(subeK&&!id&&!byId('pBas').value){W.innerHTML='<div class="confirm">İlk çalıştığı günü girin.</div>';return;}
     // Bir kişi sadece bir şubede SGK'lı olabilir: aynı isim ya da TC'li başka kayıt başka şubede SGK'lıysa kaydetme.
     if(!subeK&&sgkV!==SGK_YOK){const tcK=p.tc||'';const cak=sgkCakisma({...p,id,tc:tcK},sgkV,ad,byId('pGiris').value,byId('pCikis').value);
       if(cak){W.innerHTML=`<div class="confirm bad">${esc(sgkCakismaMesaj(cak))} Aynı dönemde başka şubede de çalışıyorsa SGK şubesini ${esc(subeAdi(cak.sgkSube))} bırakın, "Çalıştığı şube"yi değiştirin.</div>`;return;}}
     const anaS=subeK?(id?(p.anaSube||S.subeId):S.subeId):(byId('pAna').value||S.subeId);const ayni=subePersoneli(anaS).find(x=>x.id!==id&&isimAnahtar(x.ad)===isimAnahtar(ad)&&!(x.cikis&&x.cikis<ymd(today())));if(ayni&&!W.dataset.ok){W.dataset.ok='1';W.innerHTML=isimsizMi(p)?`<div class="confirm bad">${esc(subeAdi(anaS))} listesinde ${esc(adBuyuk(ayni.ad))} zaten var. Bu isimsiz kayıt o kişiyse kaydetmeyin: çizelge günleri iki ayrı kayıtta kalır ve iki kez sayılır. Farklı kişiyse tekrar Kaydet'e basın.</div>`:`<div class="confirm">${esc(subeAdi(anaS))} listesinde bu isimde biri zaten var. Aynı kişiyse yeni kayıt açmayın. Farklı kişiyse tekrar Kaydet'e basın.</div>`;return;}
     const bilgi={...((!id&&eskiB&&eskiB.o)||{})};
     const giris=subeK?(id?(p.giris||''):''):byId('pGiris').value,cikis=subeK?(id?(p.cikis||''):''):byId('pCikis').value;if(giris&&cikis&&cikis<giris){W.innerHTML='<div class="confirm">Çıkış tarihi girişten önce olamaz.</div>';return;}
     const sekil=g.sekil||(subeK?(id&&p.sekil&&p.sekil!=='Esnaf kurye'?p.sekil:'Tam'):sh.querySelector('#pSekil .on').dataset.v);const ana=anaS;
     const bas=byId('pBas').value;if(bas&&giris&&bas>giris){W.innerHTML='<div class="confirm">Deneme başlangıcı SGK girişinden sonra olamaz.</div>';return;}
     const body={ad,gorev:g.ad,grup:g.grup,sekil,giris,cikis,baslama:bas,sgkSube:sgkV,anaSube:ana,...bilgi};
     if(subeK&&id)['giris','cikis','sgkSube','anaSube'].forEach(k=>delete body[k]);// şube müdürü bu alanlara dokunmaz (kural da reddeder)
     if(id){if(gorevDeg()){const y=gorevGecmisYama(p,{gorev:g.ad,grup:g.grup,sekil},byId('pGay')?byId('pGay').value:buAy);if(y)Object.assign(body,y);else Object.assign(body,{gorev:p.gorev,grup:p.grup,sekil:p.sekil});}else if(p.gorevGecmis){Object.assign(body,{gorev:p.gorev,grup:p.grup,sekil:p.sekil});}}
     if(id&&!subeK){const akM=ayKey(today());const msEl=byId('pMs');const ms0=odemeSubesi(p,akM);const ym=msEl&&msEl.value!==ms0?maasGecmisYama(p,msEl.value,akM):maasGecmisYama(p,{anaSube:ana,sgkSube:sgkV},akM);if(ym)Object.assign(body,ym);}if(p.sira!=null)body.sira=p.sira;const pid=id||(slug(ad)+'-'+Math.random().toString(36).slice(2,6));
     const p0={...p};const body2=personelYaz(pid,id?p0:{},body);if(!id)S.personel.push({id:pid,...body2});else Object.assign(p,body2);closeSheet();
     const ilkHafta=mondayOf(giris&&parse(giris)>today()?parse(giris):today());
     if(opt.sonra)opt.sonra(pid);
     const eskiAna=id?p0.anaSube:null,eskiSgk=id?p0.sgkSube:null;
     void ilkHafta;/* çizelgeye otomatik eklenmez: şube müdürü "+ ekle" ile ekler (opt.sonra: çizelgeden eklenen kişi zaten eklenir) */
     let sgkNot='';if(sgkV&&sgkV!==SGK_YOK&&sgkV!==ana&&(!id||eskiSgk!==sgkV))sgkNot=`. ${subeAdi(sgkV)} listesinde de görünür`;
     if(id&&!subeK&&cikis&&!p0.cikis&&sekil!=='Esnaf kurye'){cikisBildirimKopyala(p,'Personel güncellendi. ');return;}
     toast((id?'Personel güncellendi':`Personel eklendi${opt.sonra?'':'. Çizelgeye "+ ekle" ile eklenir'}`)+sgkNot+'.');};
   const del=byId('pDel');if(del)del.onclick=()=>{if(!del.dataset.ok){del.dataset.ok='1';del.textContent='Evet, sil';W.innerHTML='<div class="confirm">Kişi şirketin personel listesinden silinir. Ayrılan biri için silmek yerine çıkış tarihi girin.</div>';return;}
     del.disabled=true;del.textContent='Kontrol ediliyor…';personelKaydiVar(p).then(var_=>{if(var_){del.disabled=false;del.textContent='Personeli sil';del.dataset.ok='';W.innerHTML=`<div class="confirm bad">${esc(var_)} çizelgesinde bu kişinin kaydı var, silinemez: silinirse geçmiş haftaları ve puantajı hesaplardan düşer. Ayrıldıysa çıkış tarihi girin.</div>`;return;}
       sirayla('p'+id,()=>{arka(deleteDoc(doc(db,'personel',id)));});closeSheet();toast(`${p.ad} silindi.`);}).catch(e=>{del.disabled=false;del.textContent='Personeli sil';yazmaHatasi(e);});};});}

