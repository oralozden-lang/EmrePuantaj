// subeler.js — app.js (v180) satırları 615-691. Otomatik bölündü; davranış değişmedi.
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, setDoc, writeBatch } from './firebase.js';
import { S, subs, tryLS, undo } from './durum.js';
import { addDays, ayKey, parse } from './yardimci.js';
import { isBolge, isIsveren, isSube } from './rol.js';
import { yazmaHatasi } from './yazma.js';
import { render } from './cerceve.js';
import { toast } from './panel.js';
import { UI } from './cizelge.js';
import { DOGRU_ISIMLER, adBuyuk, isimEslestir } from './excel-aktar.js';

/* ================= Şubeler ================= */
export function subeleriDinle(){subs.subeDocs.forEach(u=>u());subs.subeDocs=[];
  const bitti=()=>{S.subeIds=Object.keys(S.subeler).sort((a,b)=>String(S.subeler[a].ad).localeCompare(String(S.subeler[b].ad),'tr'));if(isIsveren())subeAdSenkron();
    gocKontrol();if(!S.subeId||!S.subeler[S.subeId]){const want=tryLS('pm.sube');const pick=S.subeIds.includes(want)?want:S.subeIds[0];if(pick)selectSube(pick);else render();}else render();};
  if(isIsveren()){subs.subeDocs.push(onSnapshot(collection(db,'subeler'),s=>{S.subeler={};s.docs.forEach(d=>S.subeler[d.id]=d.data());bitti();},e=>toast('Şubeler okunamadı.')));}
  else{const ids=(S.me.subeler||[]);if(!ids.length){S.subeler={};bitti();return;}let gelen=0;
    ids.forEach(id=>subs.subeDocs.push(onSnapshot(doc(db,'subeler',id),s=>{if(s.exists())S.subeler[id]=s.data();else delete S.subeler[id];gelen++;if(gelen>=ids.length)bitti();},()=>{gelen++;if(gelen>=ids.length)bitti();})));}
  personelDinle();
  subs.subeDocs.push(onSnapshot(doc(db,'sistem','subeAdlari'),s=>{S.subeAdlari=s.exists()?(s.data().adlar||{}):{};if(isIsveren())subeAdSenkron();},()=>{}));
  if(isSube())subs.subeDocs.push(onSnapshot(doc(db,'sistem','goc'),s=>{const v=!!(s.exists()&&s.data().v4);if(S.goc4!==v){S.goc4=v;render();}},()=>{}));
  // Bölge müdürü: sadece kendi yönettiği şube müdürleri ve onların şifre kayıtları (tek tek okunur).
  if(isBolge()&&!subs.users){const buid=S.user.uid;const dk={};S.sifreler={};S.sifreIstek={};
    const u1=onSnapshot(query(collection(db,'kullanicilar'),where('bolgeler','array-contains',buid)),s=>{S.users=s.docs.map(d=>({uid:d.id,...d.data()}));
      s.docs.forEach(d=>{if(dk[d.id])return;dk[d.id]=[onSnapshot(doc(db,'sifreler',d.id),x=>{if(x.exists())S.sifreler[d.id]=x.data();else delete S.sifreler[d.id];if(S.tab==='yonetim')render();},()=>{}),
        onSnapshot(doc(db,'sifreIstek',d.id),x=>{if(x.exists())S.sifreIstek[d.id]=x.data();else delete S.sifreIstek[d.id];if(S.tab==='yonetim')render();},()=>{})];});
      if(S.tab==='yonetim')render();},e=>{console.error(e);S.users=[];S.kulHata=true;if(S.tab==='yonetim')render();});
    subs.users=()=>{u1();Object.values(dk).forEach(a=>a.forEach(f=>f()));};}
  if(isIsveren()&&!subs.users){const u1=onSnapshot(collection(db,'kullanicilar'),s=>{S.users=s.docs.map(d=>({uid:d.id,...d.data()}));bolgeSenkron();if(S.tab==='yonetim')render();});
    const u2=onSnapshot(collection(db,'sifreler'),s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.sifreler=m;S.sifreHata=false;if(S.tab==='yonetim')render();},e=>{console.error(e);S.sifreler={};S.sifreHata=true;if(S.tab==='yonetim')render();});const u3=onSnapshot(collection(db,'sifreIstek'),s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.sifreIstek=m;if(S.tab==='yonetim')render();},()=>{S.sifreIstek={};});subs.users=()=>{u1();u2();u3();};}}
// Personel şube şube tutulur: herkes sadece kendi şubelerinin listesini okur. Bölge müdürü ayrıca SGK'sı kendi şubelerinde olanları görür (puantaj için).
function personelDinle(){const parca={};const yay=()=>{const m={};Object.values(parca).forEach(L=>L.forEach(p=>m[p.id]=p));S.personel=Object.values(m);S.loaded.personel=true;S.kuralHata=false;gocKontrol();render();};
  const hata=e=>{console.error(e);S.kuralHata=true;S.loaded.personel=true;render();};
  const dinle=(k,q)=>subs.subeDocs.push(onSnapshot(q,s=>{parca[k]=s.docs.map(d=>({id:d.id,...d.data()}));yay();},hata));
  if(isIsveren()){dinle('hepsi',collection(db,'personel'));return;}
  const ids=S.me.subeler||[];if(!ids.length){S.personel=[];S.loaded.personel=true;return;}
  ids.forEach(sid=>{dinle('a:'+sid,query(collection(db,'personel'),where('anaSube','==',sid)));dinle('s:'+sid,query(collection(db,'personel'),where('sgkSube','==',sid)));
    // Bu şubede de çalışan (çalıştığı şubesi / SGK'sı başka yerde) kişiler: şubenin ek personel listesinden tek tek okunur.
    const tekil={};subs.subeDocs.push(onSnapshot(doc(db,'ekPersonel',sid),s=>{const L=Object.keys((s.exists()&&s.data().ids)||{});
      L.forEach(pid=>{if(tekil[pid])return;tekil[pid]=1;subs.subeDocs.push(onSnapshot(doc(db,'personel',pid),d=>{parca['e:'+pid]=d.exists()?[{id:d.id,...d.data()}]:[];yay();},()=>{parca['e:'+pid]=[];}));});},()=>{}));});}
// Şube müdürlerinin "bolgeler" listesi (hangi bölge müdürleri yönetir): şube atamalarından hesaplanır; bölge müdürünün kuralları buna dayanır.
let bsT;function bolgeSenkron(){clearTimeout(bsT);bsT=setTimeout(async()=>{if(!isIsveren()||!S.users||S.bsBusy)return;const bm=S.users.filter(u=>u.rol==='bolge'&&u.aktif!==false);const b=writeBatch(db);let n=0;
  S.users.forEach(u=>{if(u.rol!=='sube')return;const hed=bm.filter(m=>(m.subeler||[]).some(x=>(u.subeler||[]).includes(x))).map(m=>m.uid).sort();const mev=(u.bolgeler||[]).slice().sort();
    if(JSON.stringify(hed)!==JSON.stringify(mev)){b.update(doc(db,'kullanicilar',u.uid),{bolgeler:hed});n++;}});
  if(!n)return;S.bsBusy=true;try{await b.commit();}catch(e){console.error(e);}finally{S.bsBusy=false;}},1200);}
let senkronT;function subeAdSenkron(){clearTimeout(senkronT);senkronT=setTimeout(()=>{const adlar={};Object.entries(S.subeler).forEach(([id,v])=>adlar[id]=v.ad);
  const a=JSON.stringify(Object.entries(adlar).sort()),b=JSON.stringify(Object.entries(S.subeAdlari||{}).sort());if(a!==b&&Object.keys(adlar).length)setDoc(doc(db,'sistem','subeAdlari'),{adlar}).catch(()=>{});},800);}
export function tumSubeler(){const m={...S.subeAdlari};Object.entries(S.subeler).forEach(([id,v])=>m[id]=v.ad);return Object.entries(m).sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'tr'));}
// Eski sürümde personel şube altında tutuluyordu; işveren ilk açılışta şirket geneli listeye taşır.
async function gocKontrol(){if(!isIsveren()||S.gocBakildi||!S.subeIds.length||!S.loaded.personel)return;S.gocBakildi=true;
  try{const g=await getDoc(doc(db,'sistem','goc'));const gd=g.exists()?g.data():{};
    // v3: isimler büyük harf
    if(!gd.v3){const L=S.personel.filter(p=>p.ad&&p.ad!==adBuyuk(p.ad));for(let i=0;i<L.length;i+=400){const b=writeBatch(db);L.slice(i,i+400).forEach(p=>{p.ad=adBuyuk(p.ad);b.set(doc(db,'personel',p.id),{ad:p.ad},{merge:true});});await b.commit();}
      await setDoc(doc(db,'sistem','goc'),{v3:true},{merge:true});if(L.length){toast(`${L.length} personelin adı büyük harfe çevrildi.`);render();}}
    // v5: aktarımdaki yanlış/eksik isimler (bir kerelik; eşleşmeler işverene gösterilir, onaylarsa yazılır; çift kayıt oluşturacaklara dokunulmaz)
    if(!gd.v5){const E=isimEslestir(S.personel.map(p=>({id:p.id,ad:p.ad})),DOGRU_ISIMLER);
      if(!E.yeni.length){await setDoc(doc(db,'sistem','goc'),{v5:true},{merge:true});}
      else if(confirm('İsimler düzeltilsin mi? ('+E.yeni.length+')\n\n'+E.yeni.map(x=>x.ad+' → '+x.dogru).join('\n')+(E.birles.length?'\n\nZaten kaydı olduğu için DOKUNULMAYAN (elle birleştirilecek):\n'+E.birles.map(x=>x.ad+' → '+x.dogru).join('\n'):'')+(E.belirsiz.length?'\n\nBelirsiz (DOKUNULMAYAN):\n'+E.belirsiz.map(x=>x.ad+' → '+x.adaylar.join(' / ')).join('\n'):''))){
        const b=writeBatch(db);E.yeni.forEach(x=>{b.set(doc(db,'personel',x.id),{ad:x.dogru},{merge:true});const p=S.personel.find(q=>q.id===x.id);if(p)p.ad=x.dogru;});await b.commit();
        await setDoc(doc(db,'sistem','goc'),{v5:true},{merge:true});toast(`${E.yeni.length} personelin adı düzeltildi.`);render();}}
    // v6: giriş/çıkış tarihi düzeltmeleri (4 kişi, işveren seçimi; onaylanınca yazılır)
    if(gd.v5&&!gd.v6){const T=[['EDA ELİBOL',{cikis:'2026-08-18'}],['EMRE AŞMA',{giris:'2026-06-15',cikis:'2026-09-28'}],['ELİF KARACA',{giris:'2026-05-04'}],['BERKAY EKİCİ',{giris:'2026-06-12'}]];
      const trh=v=>{const t=String(v||'').split('-');return t.length===3?`${t[2]}.${t[1]}.${t[0]}`:'boş';};
      const Y=[];T.forEach(([ad,d])=>{const L=S.personel.filter(p=>adBuyuk(p.ad)===ad);if(L.length!==1)return;const p=L[0];const f=Object.entries(d).filter(([k,v])=>(p[k]||'')!==v);if(f.length)Y.push({p,ad,f});});
      if(!Y.length){await setDoc(doc(db,'sistem','goc'),{v6:true},{merge:true});}
      else if(confirm('Tarihler düzeltilsin mi?\n\n'+Y.map(y=>y.ad+': '+y.f.map(([k,v])=>(k==='giris'?'giriş ':'çıkış ')+trh(y.p[k])+' → '+trh(v)).join(', ')).join('\n')+'\n\nOnaylı/kilitli aylardaki SGK günleri bu tarihlere göre değişebilir; önce kontrol edin.')){
        const b=writeBatch(db);Y.forEach(y=>{const o=Object.fromEntries(y.f);b.set(doc(db,'personel',y.p.id),o,{merge:true});Object.assign(y.p,o);});await b.commit();
        await setDoc(doc(db,'sistem','goc'),{v6:true},{merge:true});toast(`${Y.length} personelin tarihi düzeltildi.`);render();}}
    // v4: haftalık kapatma. Haftalara durum yazılır: kapatılmış/onaylanmış aya ait haftalar "onay" (şube müdürüne gizlenir), diğerleri "acik".
    if(!gd.v4){let n=0;const t=new Date().toISOString();
      for(const sid of S.subeIds){const aq=await getDocs(collection(db,'subeler',sid,'aylar'));const ay={};aq.docs.forEach(d=>ay[d.id]=(d.data()||{}).durum);const kil=k=>['bolge_onay'].includes(ay[k]);
        const q=await getDocs(collection(db,'subeler',sid,'haftalar'));const b=writeBatch(db);const w={};let k=0;
        q.docs.forEach(d=>{const x=d.data()||{};if(x.hd)return;const wid=d.id;const hd=kil(wid.slice(0,7))&&kil(ayKey(addDays(parse(wid),6)))?'onay':'acik';
          b.set(doc(db,'subeler',sid,'haftalar',wid),{hd},{merge:true});k++;n++;if(hd==='onay')w[wid]={d:'onay',t,ad:'Sistem (eski kapatılmış ay)',k:Array.isArray(x.kadro)?x.kadro:Object.keys(x.cells||{})};});
        if(Object.keys(w).length)b.set(doc(db,'subeler',sid,'durum','haftalar'),{w},{merge:true});if(k)await b.commit();}
      await setDoc(doc(db,'sistem','goc'),{v4:true,v4Tarih:t},{merge:true});if(n)toast(`${n} haftaya kapatma durumu yazıldı.`);}
    if(gd.v2)return;const var_=new Set(S.personel.map(p=>p.id));let n=0;
    for(const sid of S.subeIds){const q=await getDocs(collection(db,'subeler',sid,'personel'));const b=writeBatch(db);let k=0;
      q.docs.forEach(d=>{if(var_.has(d.id))return;b.set(doc(db,'personel',d.id),{...d.data(),anaSube:sid});k++;n++;});if(k)await b.commit();}
    await setDoc(doc(db,'sistem','goc'),{v2:true,tarih:new Date().toISOString(),tasinan:n},{merge:true});if(n)toast(`${n} personel şirket geneli listeye taşındı.`);}catch(e){console.error(e);S.gocBakildi=false;}}
export function selectSube(id){subs.sube.forEach(u=>u());subs.sube=[];S.tcler={};S.subeId=id;S.haftalar={};S.aylar={};S.haftaDurum={w:{}};S.loaded.haftalar=false;undo.length=0;UI.SEL=null;UI.MOD=null;tryLS('pm.sube',id);
  // Şube müdürü sadece açık haftaları okur (kapatılan hafta ona gizlidir); bölge müdürü ve işveren hepsini.
  const hq=isSube()?query(collection(db,'subeler',id,'haftalar'),where('hd','==','acik')):collection(db,'subeler',id,'haftalar');
  S.haftalarSunucu=false;subs.sube.push(onSnapshot(hq,{includeMetadataChanges:true},s=>{if(S.subeId!==id)return;const m={};s.docs.forEach(d=>m[d.id]=d.data());S.haftalar=m;S.loaded.haftalar=true;S.haftalarSunucu=!s.metadata.fromCache;render();},e=>yazmaHatasi(e)));
  subs.sube.push(onSnapshot(doc(db,'subeler',id,'durum','haftalar'),s=>{S.haftaDurum=s.exists()?{w:{},...s.data()}:{w:{}};render();},()=>{}));
  subs.sube.push(onSnapshot(collection(db,'subeler',id,'aylar'),s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.aylar=m;render();},()=>{}));
  render();}

