// bilgi-dogrulama.js — app.js (v180) satırları 1075-1101. Otomatik bölündü; davranış değişmedi.
import { doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { arka, db, setDoc } from './firebase.js';
import { S } from './durum.js';
import { today, ymd } from './yardimci.js';
import { isIsveren, puantajYetki } from './rol.js';
import { maasSubesi } from './gecmis.js';
import { sirayla } from './yazma.js';
import { render } from './cerceve.js';

/* ================= Personel bilgileri (telefon, acil durum, e-posta, IBAN) ================= */
// Bu bilgiler personel kaydında durur; kayıt sadece kişinin şubesi (ve SGK şubesinin bölge müdürü / işveren) tarafından okunur.
export const BILGI=[{k:'tel',ad:'Telefon',tip:'tel',im:'tel',ph:'05xx xxx xx xx'},{k:'acilAd',ad:'Acil durum kişisi',tip:'metin',im:'text',ph:'Örn: Annesi Ayşe'},{k:'acilTel',ad:'Acil durum no',tip:'tel',im:'tel',ph:'05xx xxx xx xx'},
  {k:'eposta',ad:'E-posta',tip:'eposta',im:'email',ph:'ornek@mail.com'},{k:'iban',ad:'IBAN',tip:'iban',im:'text',ph:'TR000000000000000000000000'}];
BILGI.push({k:'tc',ad:'TC kimlik no',tip:'tc',im:'numeric',ph:'11 hane'});
// Sıra: telefon, IBAN, e-posta, acil durum, TC en sonda
{const sira=['tel','iban','eposta','acilAd','acilTel','tc'];BILGI.sort((a,b)=>sira.indexOf(a.k)-sira.indexOf(b.k));}
function ibanGecerli(s){if(!/^TR\d{24}$/.test(s))return false;const r=s.slice(4)+s.slice(0,4);let m=0;for(const ch of r){const n=/\d/.test(ch)?ch:String(ch.charCodeAt(0)-55);for(const d of n)m=(m*10+(+d))%97;}return m===1;}
export function tcGecerli(s){if(!/^[1-9]\d{10}$/.test(s))return false;const d=s.split('').map(Number);const t1=((d[0]+d[2]+d[4]+d[6]+d[8])*7-(d[1]+d[3]+d[5]+d[7]))%10;const t2=d.slice(0,10).reduce((a,b)=>a+b,0)%10;return((t1+10)%10)===d[9]&&t2===d[10];}
export function bilgiCoz(f,raw){const s=String(raw??'').trim();if(!s)return{v:''};
  if(f.tip==='tel'){let d=s.replace(/\D/g,'');if(d.startsWith('90')&&d.length===12)d=d.slice(2);if(d.length===10&&d[0]==='5')d='0'+d;return /^0\d{10}$/.test(d)?{v:d}:{hata:'11 haneli telefon numarası yazın (05xx xxx xx xx).'};}
  if(f.tip==='iban'){const d=s.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g,'');return ibanGecerli(d)?{v:d}:{hata:'IBAN hatalı. TR ile başlayan 26 karakterli IBAN\'ı kontrol edin.'};}
  if(f.tip==='eposta'){const d=s.toLocaleLowerCase('tr-TR').replace(/\s/g,'');return /^[^@]+@[^@]+\.[a-z]{2,}$/.test(d)?{v:d}:{hata:'E-posta adresi hatalı.'};}
  if(f.tip==='tc'){const d=s.replace(/\D/g,'');return tcGecerli(d)?{v:d}:{hata:'TC kimlik numarası hatalı.'};}
  return{v:s.replace(/\s+/g,' ').slice(0,80)};}
export function bilgiGoster(f,v){v=v||'';if(f.tip==='tel'&&/^0\d{10}$/.test(v))return`${v.slice(0,4)} ${v.slice(4,7)} ${v.slice(7,9)} ${v.slice(9)}`;return v;}
export function excelBilgi(o){const out={};BILGI.forEach(f=>{if(o[f.k]==null)return;const r=bilgiCoz(f,typeof o[f.k]==='number'?String(o[f.k]):o[f.k]);if(r.v)out[f.k]=r.v;});return out;}
// TC sadece bölge müdürü / işveren: maaslar/{SGK şubesi}.tc
export async function tcYukle(list){if(!puantajYetki())return;S.tcler=S.tcler||{};const need=[...new Set(list.map(maasSubesi))].filter(s=>s&&!(s in S.tcler)&&(isIsveren()||(S.me.subeler||[]).includes(s)));
  if(!need.length)return;await Promise.all(need.map(async s=>{try{const d=await getDoc(doc(db,'maaslar',s));S.tcler[s]=(d.exists()&&d.data().tc)||{};}catch(e){S.tcler[s]=null;}}));render();}
// TC personel kaydında; eski kayıtlarda bordrodan gelen TC maaslar'da durabilir (bölge/işveren görür).
export function tcOf(p){if(p.tc)return p.tc;const m=S.tcler&&S.tcler[maasSubesi(p)];return m?m[p.id]||'':'';}
// IBAN değişince eski değer, tarih ve sunucu saati (ibanZaman) tutulur; kural bunlar olmadan IBAN değiştirtmez (işveren listesinde görünür).
export function bilgiKaydet(p,f,v){const ek={};const iz=f.k==='iban'&&p.iban&&p.iban!==v;if(iz){ek.ibanEski=p.iban;ek.ibanTarih=ymd(today());}
  p[f.k]=v;Object.assign(p,ek);return sirayla('p'+p.id,()=>{arka(setDoc(doc(db,'personel',p.id),{[f.k]:v,...ek,...(iz?{ibanZaman:serverTimestamp()}:{})},{merge:true}));});}
// IBAN'ın değiştiği gün: sunucu saati varsa o (cihaz tarihi değiştirilemez), yoksa eski kayıtlardaki tarih.
export function ibanDegisim(p){const z=p.ibanZaman;return z&&typeof z.toDate==='function'?ymd(z.toDate()):(p.ibanTarih||'');}
