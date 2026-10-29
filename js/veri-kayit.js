// veri-kayit.js — app.js (v180) satırları 1754-1796. Otomatik bölündü; davranış değişmedi.
import { deleteField, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { subeAdi } from './sabitler.js';
import { db, setDoc } from './firebase.js';
import { S } from './durum.js';
import { ayAdi } from './yardimci.js';
import { puantajYetki } from './rol.js';
import { gerekliSube, sirayla, yazmaHatasi } from './yazma.js';
import { kilitAl, kilitBaskasi, kilitMesaj, ptK } from './kilit.js';
import { render } from './cerceve.js';
import { toast } from './panel.js';
import { ptVerisi } from './puantaj-veri.js';
import { sagSonuclu } from './puantaj-islem.js';

/* ---- Veri girişi kayıtları ----
   Satırlar puantaj belgesinde satır satır tutulur: veriM.{id} = satır, silinen satır veriSil.{id} = true. Eski belgelerdeki "veri" dizisi okunurken birleştirilir.
   Her kayıt sadece değişen satırları gönderir ve şube + ay yazma anında sabittir: başka ay / şube açılsa ya da aynı anda başka biri yazsa da diğer satırlara dokunulmaz.
   Gönderilmeyi bekleyen değişiklikler, sunucudan gelen her güncellemede ekrandaki listeye yeniden uygulanır (yazılan değer kaybolmaz). */
export function veriListesi(D){if(!D)return[];const M=D.veriM||{},Sil=D.veriSil||{};const out=[];
  (Array.isArray(D.veri)?D.veri:[]).forEach((v,i)=>{if(!v)return;const id=v.id||('_e'+i);if(Sil[id]||M[id])return;out.push({sira:i,...v,id});});
  Object.entries(M).forEach(([id,v])=>{if(!v||Sil[id])return;out.push({...v,id});});return out.sort((a,b)=>(a.sira??0)-(b.sira??0));}
let siraSay=0;export const yeniSira=()=>Date.now()*100+(siraSay++%100);
export function veriFark(eski,yeni){const E=new Map((eski||[]).map(v=>[v.id,v]));const Y=new Set((yeni||[]).map(v=>v.id));const deg={},sil=[];
  (yeni||[]).forEach(v=>{const e=E.get(v.id);if(!e||JSON.stringify(e)!==JSON.stringify(v))deg[v.id]=v;});E.forEach((v,id)=>{if(!Y.has(id))sil.push(id);});return{deg,sil};}
function veriFarkUygula(list,f){const sil=new Set(f.sil);const out=list.filter(v=>!sil.has(v.id)).map(v=>f.deg[v.id]||v);const var_=new Set(out.map(v=>v.id));
  Object.values(f.deg).forEach(v=>{if(!var_.has(v.id)&&!sil.has(v.id))out.push(v);});return out;}
export const VBEK={};// şube|ay → henüz gönderilmemiş farklar
export function bekleyenUygula(sid,ak,list){(VBEK[sid+'|'+ak]||[]).forEach(f=>{list=veriFarkUygula(list,f);});return list;}
export const satirTemiz=v=>JSON.parse(JSON.stringify(v));
// Farkı yazar. ek: aynı kayda eklenecek alanlar (sag, sube, ay…). Kilit başkasındaysa yazmaz, false döner.
export function veriYaz(sid,ak,fark,ek={},sec={}){gerekliSube(sid);const deg=fark.deg||{},sil=fark.sil||[];const n=Object.keys(deg).length+sil.length;if(!n&&!Object.keys(ek).length)return Promise.resolve(true);
  const key=sid+'|'+ak;const f={deg,sil};(VBEK[key]=VBEK[key]||[]).push(f);const birak=()=>{const L=VBEK[key]||[];const i=L.indexOf(f);if(i>=0)L.splice(i,1);};
  const vm={},vs={};Object.entries(deg).forEach(([id,v])=>{vm[id]=satirTemiz({...v,id});});sil.forEach(id=>{vm[id]=deleteField();vs[id]=true;});
  const body={...(n?{veriM:vm}:{}),...(sil.length?{veriSil:vs}:{}),guncellendi:new Date().toISOString(),...ek};
  return sirayla('pt'+key,async()=>{try{if(!sec.kilitsiz&&!(await kilitAl(ptK(sid,ak)))){birak();toast(kilitMesaj());if(sid===S.pt.sube&&ak===S.ay&&S.pt.ham){S.pt.doc={...S.pt.ham,veri:bekleyenUygula(sid,ak,veriListesi(S.pt.ham))};S.pt.zorla=true;render();}return false;}
      const p=setDoc(doc(db,'puantaj',sid,'aylar',ak),body,{merge:true});birak();p.catch(e=>{yazmaHatasi(e);});return true;}
    catch(e){birak();throw e;}});}
// Maaşı başka şubede olan kişiye elle girilen "Bankaya yatan": satır bu şubede kalır (gonder = hedef şube, bu şubenin hesabına girmez),
// aynı satır maaşın ödendiği şubenin veri girişine de yazılır. Satır değişince / silinince / hedef değişince oradaki kopya da güncellenir.
export async function bankaGonder(sid,ak,fark,eski){const E=new Map((eski||[]).map(v=>[v.id,v]));const Y={};const ekle=h=>Y[h]=Y[h]||{deg:{},sil:[]};
  Object.values(fark.deg||{}).forEach(v=>{const o=E.get(v.id);if(o&&o.gonder&&o.gonder!==v.gonder)ekle(o.gonder).sil.push(v.id);
    if(v.gonder){const{gonder,...r}=v;ekle(gonder).deg[v.id]={...r,gonderenSid:sid,aciklama:`${subeAdi(sid)} veri`+(r.aciklama?' · '+r.aciklama:'')};}});
  (fark.sil||[]).forEach(id=>{const o=E.get(id);if(o&&o.gonder)ekle(o.gonder).sil.push(id);});
  const giden=[];const yeniGidis=h=>Object.keys(Y[h].deg).some(id=>{const o=E.get(id);return !o||o.gonder!==h;});// bildirim sadece satır ilk kez o şubeye giderken
  for(const[h,f] of Object.entries(Y)){try{const s0=await getDoc(doc(db,'puantaj',h,'aylar',ak));const d0=s0.exists()?s0.data():{};
      if(d0.kesin===true){toast(`${subeAdi(h)} şubesinin ${ayAdi(ak)} ayı kesin kapandı, "Bankaya yatan" oraya işlenemedi.`);continue;}
      await veriYaz(h,ak,f,d0.kilitli?{}:{sube:h,ay:ak},{kilitsiz:true});if(yeniGidis(h))giden.push(subeAdi(h));}
    catch(e){yazmaHatasi(e);toast(`${subeAdi(h)} şubesine işlenemedi, satırı yeniden kaydedin.`);}}
  if(giden.length)toast(`Bankaya yatan → ${giden.join(', ')} şubesine de işlendi.`);}
// Ekrandaki ay için, yeni veri listesiyle hesaplanan "kalan"lar: sonraki ayın devri bu kayıtlı kalandan gelir, her veri değişikliğinde güncellenir.
export function kalanYama(sid,ak,veri){if(sid!==S.pt.sube||sid!==S.subeId||ak!==S.ay||!S.pt.doc)return{};try{const V=ptVerisi();return{sag:sagYama(sagSonuclu({...V,D:{...V.D,veri}}),[])};}catch(e){console.error(e);return{};}}
// Sağ taraf (ödemeler): sadece değişen kişilerin alanları; diğerlerinin yalnız hesaplanan kalanı yazılır.
export function sagYama(sag,kisiler){const o={};Object.entries(sag||{}).forEach(([pid,v])=>{o[pid]=kisiler.includes(pid)?v:{kalan:(v||{}).kalan??0};});return o;}
// Onaylı (kilitli) ayda kayıtlı "kalan" hesaplanandan farklıysa düzeltilir: sonraki ayın devri doğru olsun. Ekran her açılışta bir kez bakar.
export function kalanTazele(V){if(V.kesin)return;const sid=S.subeId,ak=V.ak;const key=sid+'|'+ak;S.pt.kalanBak=S.pt.kalanBak||{};if(!V.kilitli||!puantajYetki()||S.pt.kalanBak[key]||kilitBaskasi()||!S.pt.prev||S.pt.sube!==sid)return;S.pt.kalanBak[key]=1;
  const sag=sagSonuclu(V);const fark=Object.keys(sag).filter(pid=>Math.abs(((((V.D.sag||{})[pid])||{}).kalan??0)-(sag[pid].kalan??0))>0.004);if(!fark.length)return;
  veriYaz(sid,ak,{deg:{},sil:[]},{sag:sagYama(sag,[])},{kilitsiz:true});}
