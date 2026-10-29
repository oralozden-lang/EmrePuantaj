// veri-girisi.js — app.js (v180) satırları 1669-1902. Otomatik bölündü; davranış değişmedi.
import { deleteField, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AYK, VERI_TUR, subeAdi, veriTur } from './sabitler.js';
import { db, setDoc } from './firebase.js';
import { S } from './durum.js';
import { ascii, ayAdi, ayKaydir, esc, fmt, isimAnahtar, mondayOf, parse, sayi, sg, tl, tl0, today, trTarih, ymd } from './yardimci.js';
import { isIsveren, puantajYetki } from './rol.js';
import { aktifAyda, cellOf } from './hesap.js';
import { ayniKisi, fmKisiUcreti, otoKapi, solHesap } from './cok-sube.js';
import { gerekliSube, sirayla, yazmaHatasi } from './yazma.js';
import { kilitAl, kilitBaskasi, kilitMesaj, ptK } from './kilit.js';
import { tumSubeler } from './subeler.js';
import { byId, render } from './cerceve.js';
import { toast } from './panel.js';
import { subePersoneli } from './personel.js';
import { fmOzelMap, kesinEngel, netMap, ptVerisi, ucretSekli } from './puantaj.js';
import { kfAktifMi, kfBagla, kfBaslik, kfDurum, kfUygula } from './kolon-filtre.js';
import { sagSonuclu } from './puantaj-islem.js';
import { adBuyuk, xSerialTarih } from './excel-aktar.js';

/* ================= Puantaj veri girişi ================= */
let veriYapistirBagli=false;
export function veriKisileri(V){const kisiler=new Map();V.satir.forEach(x=>kisiler.set(x.pid,x.sol.ad));
  subePersoneli().filter(p=>aktifAyda(p,V.ak)).forEach(p=>{if(!kisiler.has(p.id))kisiler.set(p.id,p.ad);});
  return [...kisiler.entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'tr'));}
// Excel'den gelen veri türü yazısını koda çevir
function turCoz(s){const a=ascii(s).replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();if(!a)return null;
  const L=[['maas fark','MF'],['calisilan saat','SA'],['saat','SA'],['banka','BY'],['net odenen','BY'],['fazla mesai tutar','FMT'],['fazla mesai','FMT'],['ucretsiz','UI'],['yillik','YI'],['rapor','R'],['bayram','B'],['part','PG'],['avans','AV'],['ara odeme','AO'],['paket sayi','PS'],['paket prim','PP'],['ciro','CP'],['prim','CP'],['ek odeme','EK'],['kesinti','KS']];
  const x=L.find(([k])=>a.includes(k));return x?x[1]:null;}
// Veri girişi: Excel gibi tablo. Satır ekle ya da Excel'den yapıştır; isim/tür tutmazsa satır kırmızı.
export function trTarihCoz(x){x=String(x||'').trim();let m=x.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;if(/^\d{4}-\d{2}-\d{2}$/.test(x))return x;
  if(/^\d{5}$/.test(x)){const d=xSerialTarih(+x);if(d)return d;}return null;}
// Aynı gün aynı rapor / izin başka yerde de yazılı mı (çizelgede ya da başka şubenin veri girişinde).
function veriCiftYazim(pid,tur,tarih){if(!['R','UI','YI','B'].includes(tur)||!/^\d{4}-\d{2}-\d{2}$/.test(tarih||''))return'';const p=S.personel.find(x=>x.id===pid);if(!p)return'';
  const kayit=S.personel.filter(x=>x.id===pid||ayniKisi(x,p));const d=parse(tarih);const wid=mondayOf(d),i=(d.getDay()+6)%7;
  if(S.pt.sube===S.subeId&&kayit.some(q=>cellOf(q.id,wid,i)===tur))return'Çizelgede de yazılı, iki kez sayılır';
  for(const[s,k]of Object.entries(S.pt.ozetler||{})){if(s===S.subeId||!k)continue;if(kayit.some(q=>k[q.id]&&k[q.id].g&&k[q.id].g[tarih]===tur))return`${subeAdi(s)} çizelgesinde de yazılı, iki kez sayılır`;}
  for(const[s,k]of Object.entries(S.pt.ozetVeri||{})){if(s===S.subeId||!k)continue;if(kayit.some(q=>k[q.id]&&k[q.id].g&&k[q.id].g[tarih]&&k[q.id].g[tarih][tur]))return`${subeAdi(s)} veri girişinde de yazılı, bir kez sayılır`;}
  return'';}
// Kişinin puantajdaki satırı (aynı kişinin başka kaydının satırı da olabilir: TC, TC yoksa ad soyad).
function satirKaydi(sol,pid){if(!sol||!pid)return null;if(sol[pid])return pid;const p=S.personel.find(x=>x.id===pid);if(!p)return null;return Object.keys(sol).find(r=>{const q=S.personel.find(x=>x.id===r);return q&&ayniKisi(q,p);})||null;}
// V (isteğe bağlı): ekrandaki puantaj. Onaylı ayda onaydan sonra eklenen kişiye ve maaşı başka şubede olan kişiye "bankaya yatan" girilemez.
function veriKontrol(v,kL,ak,kilitli,V=null){const r={pid:'',tur:'',hata:''};const bos=!String(v.ad||'').trim()&&!v.pid&&!v.tur&&!String(v.miktar??'').toString().trim()&&!String(v.aciklama||'').trim();if(bos)return{...r,bos:true};
  const adT=v.ad!=null&&v.ad!==''?v.ad:(v.pid?((kL.find(([id])=>id===v.pid)||[])[1]||''):'');const k=isimAnahtar(adT);const x=adT?kL.find(([id,a])=>isimAnahtar(a)===k):null;if(x)r.pid=x[0];const t=veriTur(v.tur);if(t)r.tur=t.k;
  if(!adT.trim())r.hata='İsim yok';else if(!x)r.hata='Böyle bir personel yok';else if(!t)r.hata='Veri türü seçin';else if(v.miktar===''||v.miktar==null||String(v.miktar).trim()==='')r.hata='Miktar yok';
  else if(v.tarih&&v.tarih.slice(0,7)!==ak)r.hata='Başka ay';else if(kilitli&&t.y==='sol')r.hata='Muhasebe kilitli';
  else if(V&&V.sol&&kilitli&&!satirKaydi(V.sol,x[0]))r.hata='Onaydan sonra eklenen kişi';
  else if(V&&V.sol&&t.k==='BY'&&(()=>{const sr=V.sol[satirKaydi(V.sol,x[0])];return sr&&sr.maasBurada===false&&sr.sekil!=='Esnaf kurye'&&!['saat','paket'].includes(ucretSekli(satirKaydi(V.sol,x[0])));})()){
    // Maaşı başka şubede: yetkin varsa tutar o şubenin veri girişine de yazılır (bordro PDF'indeki gibi); yetkin yoksa eskisi gibi engellenir.
    const sr=V.sol[satirKaydi(V.sol,x[0])];const h=sr.odemeSid;
    if(h&&h!==S.subeId&&(isIsveren()||(S.me.subeler||[]).includes(h))){r.gonder=h;r.gonderAd=sr.odemeSube||subeAdi(h);}
    else r.hata=`Maaşı ${sr.odemeSube||'başka'} şubesinde`;}
  if(!r.hata&&V&&x){const u=veriCiftYazim(x[0],t.k,v.tarih);if(u)r.uyari=u;}
  // Mantık kontrolü: rapor + ücretsiz izin + yıllık izin, kişinin o ay fiilen çalıştığı takvim gününden fazla olamaz (ör. 28 Eylül'de başlayana 30 gün ücretsiz izin).
  if(!r.hata&&!r.uyari&&V&&V.sol&&x&&['R','UI','YI'].includes(t.k)){const sr=V.sol[satirKaydi(V.sol,x[0])];const ist=sr&&sr.gunTaban&&sr.gunTaban.istF;const top=sr?(sr.rapor||0)+(sr.ucretsiz||0)+(sr.yillik||0):0;if(ist!=null&&top>ist)r.uyari=`Bu ay ${ist} gün çalışılabilir, rapor/izin toplamı ${top} gün: mantıksız`;}
  if(r.hata){r.pid=r.hata==='Başka ay'||r.hata==='Muhasebe kilitli'||r.hata==='Miktar yok'?'':r.pid;if(r.hata!=='Veri türü seçin')r.tur=r.tur;r.gecersiz=true;}return r;}
export function veriGirisiHtml(V){const veri=(V.D&&V.D.veri)||[];const ak=V.ak;const kL=veriKisileri(V);const kisiler=new Map(kL);const adOf=pid=>kisiler.get(pid)||((S.personel.find(p=>p.id===pid)||{}).ad)||'?';
  const turlar=VERI_TUR.filter(t=>!t.gizli);
  // Çizelgeden ve devirden gelenler (salt okunur)
  const oto=[];const sol0=V.kilitli&&V.D.sol?null:solHesap(ak);const kaynak=sol0||V.sol;
  const netM=netMap(ak);const ozM=fmOzelMap(ak);const fmOran=pid=>{const n=sayi(netM[pid]);if(V.sb.fmYontem==='maas'&&!n)return null;return fmKisiUcreti(V.sb,n,{fmOzel:ozM[pid],ak});};
  Object.entries(kaynak).forEach(([pid,r])=>{[['R','rapor'],['UI','ucretsiz'],['YI','yillik'],['B','bayram'],['PG','partGun'],['FM','fmSaat']].forEach(([k,f])=>{let v=r[f]||0;if(V.kilitli){const e=((V.oz[pid]||{})[k]||0)+((r.disVeri||{})[k]||0);v-=e;}if(Math.abs(v)<=0.001)return;
    if(k==='FM'){if(ucretSekli(pid)!=='maas')return;const sg0=((V.D&&V.D.sag)||{})[pid]||{};if(V.sb.fmYontem==='maas'&&sg0.fmMod==='elle'&&sg0.fmBirim!==undefined){oto.push({pid,on:'fm',tur:'FMT',miktar:Math.round(v*sayi(sg0.fmBirim)*100)/100,aciklama:`${sg(v)} saat × ${tl0(sayi(sg0.fmBirim))} (saat ücreti elle girildi)`});return;}const o=fmOran(pid);oto.push({pid,on:'fm',tur:'FMT',miktar:o==null?null:Math.round(v*o*100)/100,aciklama:`${sg(v)} saat ${v<0?'eksi mesai':'fazla mesai'}${o==null?' · net maaş girilmedi':V.sb.fmYontem!=='maas'&&sayi(ozM[pid])>0?' · özel ücret '+tl0(o)+'/sa':''}`});return;}oto.push({pid,tur:k,miktar:v});});});
  const ayAralik=(()=>{const L=ymd(new Date(+ak.slice(0,4),+ak.slice(5),0));return `1–${+L.slice(8)} ${AYK[+ak.slice(5)-1]}`;})();
  V.satir.forEach(x=>{if(x.hes.saat&&x.hes.cizelgeSaat)oto.push({pid:x.pid,on:'sa',tur:'SA',miktar:x.hes.cizelgeSaat,aciklama:`çizelgedeki saatler (${ayAralik})`});});
  V.satir.forEach(x=>{Object.entries(x.sol.disVeri||{}).forEach(([k,v])=>{if(Math.abs(v)>0.001)oto.push({pid:x.pid,tur:k,miktar:v,aciklama:'başka şubenin veri girişinden',kaynak:'başka şube'});});});
  V.satir.forEach(x=>{if(x.hes.devirAvans)oto.push({pid:x.pid,tur:'AV',miktar:x.hes.devirAvans,aciklama:`devir avans (${ayAdi(ayKaydir(ak,-1))})`});});
  oto.sort((a,b)=>String(adOf(a.pid)).localeCompare(String(adOf(b.pid)),'tr'));
  const opt=(v,t,sel)=>`<option value="${esc(v)}" ${sel?'selected':''}>${esc(t)}</option>`;
  const hataSay=veri.filter(v=>veriKontrol(v,kL,ak,V.kilitli,V).gecersiz).length;const uyariSay=veri.filter(v=>veriKontrol(v,kL,ak,V.kilitli,V).uyari).length;
  const adYazi=v=>v.ad!=null&&v.ad!==''?v.ad:(v.pid?adBuyuk(adOf(v.pid)):'');
  const VC=[{k:'tarih',ad:'Tarih',v:x=>x.v.tarih?trTarih(x.v.tarih):'',n:x=>x.v.tarih||''},{k:'ad',ad:'Ad soyad',v:x=>adYazi(x.v),l:1},{k:'tur',ad:'Veri türü',v:x=>veriTur(x.v.tur)?veriTur(x.v.tur).ad:'',l:1},
    {k:'miktar',ad:'Miktar',v:x=>x.v.miktar===''||x.v.miktar==null?'':fmt(sayi(x.v.miktar)),n:x=>sayi(x.v.miktar)},{k:'ack',ad:'Açıklama',v:x=>x.v.aciklama||'',l:1},{k:'durum',ad:'Durum',v:x=>x.k.bos?'Boş satır':x.k.gecersiz?x.k.hata:x.k.uyari||(x.k.gonder?'→ '+x.k.gonderAd+' şubesine işlenir':'Tamam'),l:1}];
  const tumR=veri.map((v,i)=>({v,i,k:veriKontrol(v,kL,ak,V.kilitli,V)}));
  // Excel gibi: sıralama / filtre seçildiği anda sıra sabitlenir; yazdıkça satırlar yerinden oynamaz, sonradan eklenen satırlar en altta.
  // Yeniden sıralamak için sıralama / filtre tekrar seçilir.
  let VIS;{const kfS=kfDurum('veri');const sig=JSON.stringify(kfS)+'|'+S.subeId+'|'+ak;
    if(!kfS.sort&&!Object.keys(kfS.f).length){S.pt.vDon=null;VIS=tumR.filter(x=>!x.k.bos);tumR.forEach(x=>{if(x.k.bos)VIS.push(x);});}
    else{let D=S.pt.vDon;if(!D||D.sig!==sig){const sr=kfUygula('veri',VC,tumR).filter(x=>!x.k.bos);D=S.pt.vDon={sig,sira:[...sr,...tumR.filter(x=>x.k.bos)].map(x=>x.v.id),tum:new Set(tumR.map(x=>x.v.id))};}
      const byId=new Map(tumR.map(x=>[x.v.id,x]));VIS=D.sira.map(id=>byId.get(id)).filter(Boolean);tumR.forEach(x=>{if(!D.tum.has(x.v.id))VIS.push(x);});}}
  S.pt._vvis=VIS.map(x=>x.i);S.pt._vkf={cols:VC,rows:tumR};
  let h=`${V.kesin?'':'<div class="actions" style="margin-top:0"><button class="btn grow" id="bordroB">Bordro PDF yükle</button></div>'}${hataSay?`<div class="banner bad">${hataSay} satırda veri uyuşmazlığı var (kırmızı). Bu satırlar hesaba katılmaz; ismi ya da türü düzeltin.</div>`:''}${uyariSay?`<div class="banner">${uyariSay} satırda uyarı var (sarı). Satırdaki yazıyı okuyun: rapor / izin aynı gün çizelgede ya da başka şubede de yazılmış (iki kez sayılır) veya kişinin o ay çalıştığı günden fazla rapor / izin girilmiş olabilir.</div>`:''}
   ${kfAktifMi('veri')?`<div class="kfbar">Filtre açık · ${VIS.length} / ${veri.length} satır gösteriliyor <button class="mini" id="kfHepsiV">Filtreleri kaldır</button></div>`:''}
   <div class="tbl-wrap"><table class="pt vt vg2" id="vGrid" tabindex="0"><thead><tr>${VC.map(c=>kfBaslik('veri',c,c.l?'l':'')).join('')}<th></th></tr></thead><tbody>`;
  VIS.forEach((x,r)=>{const v=x.v;const k=x.k;const kil=V.kesin||(V.kilitli&&veriTur(v.tur)&&veriTur(v.tur).y==='sol'&&!k.gecersiz);
    h+=`<tr data-vid="${esc(v.id)}" data-r="${r}" class="${k.gecersiz?'hata':''}">
     <td class="bi"><input data-c="0" readonly value="${esc(v.tarih?trTarih(v.tarih):'')}" placeholder="gg.aa.yyyy" ${kil?'disabled':''}></td>
     <td class="bi l"><input data-c="1" readonly list="vKisiL" value="${esc(v.ad!=null?v.ad:adBuyuk(adOf(v.pid)))}" autocomplete="off" ${kil?'disabled':''}></td>
     <td class="bi l"><select data-c="2" ${kil?'disabled':''}>${opt('',v.turYazi&&!veriTur(v.tur)?v.turYazi+' ?':'Seçin',!veriTur(v.tur))}${turlar.map(t=>opt(t.k,t.ad,v.tur===t.k)).join('')}${veriTur(v.tur)&&veriTur(v.tur).gizli?opt(v.tur,veriTur(v.tur).ad,true):''}</select></td>
     <td class="bi"><input data-c="3" readonly value="${esc(v.miktar==null||v.miktar===''?'':fmt(sayi(v.miktar)))}" inputmode="decimal" style="text-align:right" ${kil?'disabled':''}></td>
     <td class="bi l"><input data-c="4" readonly value="${esc(v.aciklama||'')}" ${kil?'disabled':''}></td>
     <td class="l dur">${k.gecersiz?`<span class="chip bad">${esc(k.hata)}</span>`:k.uyari?`<span class="chip warn">${esc(k.uyari)}</span>`:k.gonder?`<span class="chip ok">→ ${esc(k.gonderAd)} şubesine işlenir</span>`:''}</td><td>${kil?'':`<button class="mini" data-sil="${esc(v.id)}" title="Satırı sil">✕</button>`}</td></tr>`;});
  if(!V.kesin)h+=`<tr class="ekle"><td colspan="7"><button class="mini ekleB" id="vSatir">+ Satır ekle</button><button class="mini ekleB" id="vSatir10">+ 10 satır</button></td></tr></tbody></table></div>
   <datalist id="vKisiL">${kL.map(([id,ad])=>`<option value="${esc(adBuyuk(ad))}">`).join('')}</datalist>
   <p class="note yardim">Çizelgedeki gibi: hücreye tıklayıp seçin, sürükleyerek ya da Shift ile aralık seçin; çift tıklayarak ya da yazmaya başlayarak düzenleyin. Ctrl+C / Ctrl+V / Delete seçili hücrelerde çalışır. Excel'deki satırları (TARİH · ŞUBE · AD SOYAD · VERİ TÜRÜ · MİKTAR · AÇIKLAMA) kopyalayıp seçili hücreye yapıştırın (seçim yoksa ilk boş satıra); satırlar kendiliğinden eklenir, şube sütunu atlanır. Yazdıklarınız anında kaydedilir. İsmi ya da türü tutmayan satırlar kırmızı görünür ve hesaba katılmaz.${V.kilitli?' Ay onaylandığı için gün türleri (rapor, izin, part gün) eklenemez; onaydan sonra eklenen kişiye de giriş yapılamaz. Düzeltme için kilidi açıp yeniden onaylayın.':''} Rapor, izin ve part gün hangi şubede girilirse girilsin kişinin SGK şubesinde ve maaş şubesinde sayılır.</p>`;
  // Çizelgeden gelen fazla mesai / saat: açık ayda onaylanmadan hesaba girmez (sagHesap kapısı). Onay kutusu ve "Hepsini onayla".
  const onayAcik=otoKapi(V.ak,V.kilitli,V.kesin);const satirM=new Map(V.satir.map(x=>[x.pid,x]));
  const bekliyor=v=>{const x=satirM.get(v.pid);const b=x&&x.hes.otoBekle;return !!(b&&b[v.on]!=null);};const reddi=v=>{const x=satirM.get(v.pid);const r=x&&x.hes.otoRed;return !!(r&&r[v.on]);};
  const bekSay=onayAcik?oto.filter(v=>v.on&&bekliyor(v)).length:0;S.pt._otoBek=bekSay;
  if(oto.length){const ac=S.pt.otoAcik??(bekSay>0);h+=`<button class="btn" id="vOto" style="width:100%;margin-top:6px">${ac?'Otomatik gelenleri gizle':'Çizelgeden ve devirden otomatik gelenler'} · ${oto.length}${bekSay?` · <b style="color:var(--warn)">${bekSay} onay bekliyor</b>`:''}</button>`;
    if(ac&&bekSay)h+=`<div class="actions" style="margin-top:6px"><button class="btn primary grow" id="vOtoHepsi">Çizelgeden gelenlerin hepsini onayla · ${bekSay}</button></div><p class="note yardim" style="margin:4px 0 0">Onay bekleyen ve reddedilen fazla mesai / saat ödemelere girmez; onay bekleyen varken ay onaylanamaz. Ödemeyeceğiniz küçük mesaileri "Reddedildi" yapın. Çizelge değişirse o satır yeniden karar bekler.</p>`;
    if(ac)h+=`<div class="tbl-wrap" style="margin-top:8px"><table class="pt"><thead><tr><th>Kaynak</th><th class="l">Ad soyad</th><th class="l">Veri türü</th><th>Miktar</th><th class="l">Açıklama</th></tr></thead><tbody>${oto.map(v=>{const t=veriTur(v.tur);const mk=v.miktar==null?'—':t&&t.b==='₺'?tl(sayi(v.miktar)):fmt(sayi(v.miktar))+' '+(t?t.b:'');
      const dr=bekliyor(v)?'bek':reddi(v)?'red':'on';const kutu=onayAcik&&v.on&&satirM.has(v.pid)?`<select class="otoSec" data-oto="${esc(v.pid)}|${v.on}" title="Onaylanan ödemelere girer, reddedilen girmez">${[['bek','Onay bekliyor'],['on','Onaylandı'],['red','Reddedildi']].map(([k,t])=>`<option value="${k}" ${dr===k?'selected':''}>${t}</option>`).join('')}</select> `:'';
      return`<tr class="oto ${onayAcik&&v.on?(dr==='bek'?'bekle':dr==='red'?'red':''):''}"><td>${kutu}<span class="tag">${v.kaynak||(v.tur==='AV'?'devir':'çizelge')}</span></td><td class="l"><b>${esc(adBuyuk(adOf(v.pid)))}</b></td><td class="l">${esc(t?t.ad:v.tur)}</td><td>${mk}</td><td class="l">${esc(v.aciklama||'Mesai çizelgesinden')}</td></tr>`;}).join('')}</tbody></table></div>`;}
  return h;}
/* ---- Veri girişi kayıtları ----
   Satırlar puantaj belgesinde satır satır tutulur: veriM.{id} = satır, silinen satır veriSil.{id} = true. Eski belgelerdeki "veri" dizisi okunurken birleştirilir.
   Her kayıt sadece değişen satırları gönderir ve şube + ay yazma anında sabittir: başka ay / şube açılsa ya da aynı anda başka biri yazsa da diğer satırlara dokunulmaz.
   Gönderilmeyi bekleyen değişiklikler, sunucudan gelen her güncellemede ekrandaki listeye yeniden uygulanır (yazılan değer kaybolmaz). */
export function veriListesi(D){if(!D)return[];const M=D.veriM||{},Sil=D.veriSil||{};const out=[];
  (Array.isArray(D.veri)?D.veri:[]).forEach((v,i)=>{if(!v)return;const id=v.id||('_e'+i);if(Sil[id]||M[id])return;out.push({sira:i,...v,id});});
  Object.entries(M).forEach(([id,v])=>{if(!v||Sil[id])return;out.push({...v,id});});return out.sort((a,b)=>(a.sira??0)-(b.sira??0));}
let siraSay=0;export const yeniSira=()=>Date.now()*100+(siraSay++%100);
function veriFark(eski,yeni){const E=new Map((eski||[]).map(v=>[v.id,v]));const Y=new Set((yeni||[]).map(v=>v.id));const deg={},sil=[];
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
async function bankaGonder(sid,ak,fark,eski){const E=new Map((eski||[]).map(v=>[v.id,v]));const Y={};const ekle=h=>Y[h]=Y[h]||{deg:{},sil:[]};
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
export function veriGirisiBagla(V){const ak=V.ak,sid=S.subeId;const kL=veriKisileri(V);
  const veri0=()=>((S.pt.doc&&S.pt.doc.veri)||[]);
  // Her değişiklik anında, sadece değişen satırlar yazılır.
  const ayarla=(yeni,ciz)=>{if(kesinEngel()){S.pt.zorla=true;render();return;}if(kilitBaskasi()){toast(kilitMesaj());S.pt.zorla=true;render();return;}if(sid!==S.pt.sube||ak!==S.ay){S.pt.zorla=true;render();return;}
    const eski=veri0();const fark=veriFark(eski,yeni);S.pt.doc={...(S.pt.doc||{}),veri:yeni};if(!Object.keys(fark.deg).length&&!fark.sil.length){if(ciz){S.pt.zorla=true;render();}return;}Promise.resolve(veriYaz(sid,ak,fark,kalanYama(sid,ak,yeni))).then(ok=>{if(ok!==false)bankaGonder(sid,ak,fark,eski);});if(ciz){S.pt.zorla=true;render();}};
  const coz=v=>{const k=veriKontrol(v,kL,ak,V.kilitli,V);return{...v,pid:k.gecersiz&&k.hata!=='Veri türü seçin'&&k.hata!=='Muhasebe kilitli'&&k.hata!=='Başka ay'&&k.hata!=='Miktar yok'?'':k.pid,_k:k};};
  const temiz=v=>{const k=veriKontrol(v,kL,ak,V.kilitli,V);const o={...v,pid:k.gecersiz?'':k.pid,tur:v.tur||''};if(k.gonder&&!k.gecersiz)o.gonder=k.gonder;else delete o.gonder;return o;};
  // Güncellemeden önce girilmiş "Bankaya yatan" satırları (maaşı başka şubede): ekran açılınca bir kez işaretlenir ve maaş şubesine gönderilir.
  {const gk=sid+'|'+ak;S.pt.gonderGecis=S.pt.gonderGecis||{};
   if(!S.pt.gonderGecis[gk]&&S.pt.doc&&S.pt.doc.kesin!==true&&!kilitBaskasi()){const ids=new Set(veri0().filter(v=>{if(v.gonder||v.tur!=='BY')return false;const k=veriKontrol(v,kL,ak,V.kilitli,V);return k.gonder&&!k.gecersiz;}).map(v=>v.id));
     if(ids.size){S.pt.gonderGecis[gk]=1;setTimeout(()=>{if(sid!==S.pt.sube||ak!==S.ay)return;ayarla(veri0().map(v=>ids.has(v.id)?temiz(v):v),false);},400);}}}
  const yeniSatir=(o={})=>{const son=veri0()[veri0().length-1]||{};const bugun=ymd(today()).slice(0,7)===ak?ymd(today()):ymd(new Date(+ak.slice(0,4),+ak.slice(5),0));
    return{id:Math.random().toString(36).slice(2,10),sira:yeniSira(),tarih:son.tarih||bugun,ad:'',pid:'',tur:'',miktar:'',aciklama:'',kim:S.me.adSoyad||S.me.kullaniciAdi||'',zaman:new Date().toISOString(),...o};};
  const grid=byId('vGrid');
  const durumGuncelle=(tr,v)=>{const k=veriKontrol(v,kL,ak,V.kilitli,V);tr.classList.toggle('hata',!!k.gecersiz);tr.querySelector('.dur').innerHTML=k.gecersiz?`<span class="chip bad">${esc(k.hata)}</span>`:k.uyari?`<span class="chip warn">${esc(k.uyari)}</span>`:k.gonder?`<span class="chip ok">→ ${esc(k.gonderAd)} şubesine işlenir</span>`:'';};
  const hucreYaz=(v,c,val)=>{if(c===0){const d=trTarihCoz(val);v.tarih=d||'';v._tarihYazi=d?'':val;}else if(c===1){v.ad=adBuyuk(val);v.pid='';}else if(c===2){const t=veriTur(val)?val:turCoz(val);v.tur=t||'';v.turYazi=t?'':val;}else if(c===3)v.miktar=String(val).trim()===''?'':sayi(val);else if(c===4)v.aciklama=String(val).trim();return temiz(v);};
  // Hücreler çizelgedeki gibi: tıkla seç, sürükle / Shift ile aralık, çift tıkla (ya da Enter / F2 / yazmaya başla) düzenle.
  // Ctrl+C / Ctrl+V / Delete seçili hücrelerde çalışır; yapıştırma seçili hücreden başlar, seçim yoksa ilk boş satıra.
  const hucreEl=(r,c)=>grid.querySelector(`tr[data-r="${r}"] [data-c="${c}"]`);
  const aralik=()=>{const A=S.pt.vsel;if(!A)return null;return{r0:Math.min(A.r0,A.r1),r1:Math.max(A.r0,A.r1),c0:Math.min(A.c0,A.c1),c1:Math.max(A.c0,A.c1)};};
  const satirSay=()=>grid.querySelectorAll('tr[data-vid]').length;
  const selCiz=()=>{grid.querySelectorAll('td.vsel,td.vakt').forEach(t=>t.classList.remove('vsel','vakt'));const A=aralik();if(!A)return;
    for(let r=A.r0;r<=A.r1;r++)for(let c=A.c0;c<=A.c1;c++){const e=hucreEl(r,c);const t=e&&e.closest('td');if(t)t.classList.add('vsel');}
    const a=hucreEl(S.pt.vsel.r1,S.pt.vsel.c1);if(a&&a.closest('td'))a.closest('td').classList.add('vakt');};
  const sec=(r,c,uzat)=>{const n=satirSay();if(!n)return;r=Math.max(0,Math.min(n-1,r));c=Math.max(0,Math.min(4,c));
    S.pt.vsel=uzat&&S.pt.vsel?{...S.pt.vsel,r1:r,c1:c}:{r0:r,c0:c,r1:r,c1:c};selCiz();const e=hucreEl(r,c);if(e&&e.scrollIntoView)e.scrollIntoView({block:'nearest',inline:'nearest'});};
  const duzenleniyor=()=>{const a=document.activeElement;return !!(a&&grid.contains(a)&&a.matches('[data-c]')&&(a.tagName==='SELECT'||!a.readOnly));};
  const duzenle=(r,c,ilk)=>{const el=hucreEl(r,c);if(!el||el.disabled)return;sec(r,c);
    if(el.tagName==='SELECT'){el.focus();try{el.showPicker&&el.showPicker();}catch(_){}return;}
    el.readOnly=false;el.focus();if(ilk!=null){el.value=c===1?ilk.toLocaleUpperCase('tr-TR'):ilk;try{el.setSelectionRange(el.value.length,el.value.length);}catch(_){}}else{try{el.select();}catch(_){}}};
  const bitir=el=>{if(el.tagName!=='SELECT')el.readOnly=true;grid.focus({preventScroll:true});};
  grid.querySelectorAll('tr[data-vid]').forEach(tr=>{const id=tr.dataset.vid;
    tr.querySelectorAll('[data-c]').forEach(el=>{const c=+el.dataset.c;
      if(c===1)el.oninput=()=>{const a=el.selectionStart,b=el.selectionEnd;el.value=el.value.toLocaleUpperCase('tr-TR');try{el.setSelectionRange(a,b);}catch(_){}};
      el.onchange=()=>{const L=veri0().map(v=>v.id===id?hucreYaz({...v},c,el.value):v);const v=L.find(x=>x.id===id);if(c===0&&v.tarih)el.value=trTarih(v.tarih);if(c===3&&v.miktar!=='')el.value=fmt(v.miktar);durumGuncelle(tr,v);ayarla(L,false);if(el.tagName==='SELECT')bitir(el);};
      el.onblur=()=>{if(el.tagName!=='SELECT')el.readOnly=true;};
      el.onkeydown=e=>{if(el.tagName!=='SELECT'&&el.readOnly)return;const r=+tr.dataset.r;
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const v=veri0().find(x=>x.id===id);if(v&&el.tagName!=='SELECT'){el.value=c===0?(v.tarih?trTarih(v.tarih):''):c===1?(v.ad!=null?v.ad:adBuyuk(adOf(v.pid))):c===3?(v.miktar==null||v.miktar===''?'':fmt(sayi(v.miktar))):c===4?(v.aciklama||''):el.value;}bitir(el);return;}
        if(e.key==='Tab'){e.preventDefault();el.dispatchEvent(new Event('change'));bitir(el);sec(r,c+(e.shiftKey?-1:1));return;}
        if(e.key==='Enter'||((e.key==='ArrowDown'||e.key==='ArrowUp')&&el.tagName!=='SELECT')){e.preventDefault();el.dispatchEvent(new Event('change'));bitir(el);
          const r2=r+(e.key==='ArrowUp'?-1:1);if(r2>=satirSay()&&e.key==='Enter'){S.pt.odak={c,yeni:true};ayarla([...veri0(),yeniSatir()],true);}else sec(r2,c);}};
      el.onpaste=e=>{if(el.tagName!=='SELECT'&&el.readOnly)return;const t=(e.clipboardData||window.clipboardData).getData('text');if(!/[\t\n]/.test(t.trim()))return;e.preventDefault();e.stopPropagation();bitir(el);yapistir(t,+tr.dataset.r,c);};});});
  const sutunlar=M=>{// şube sütununu ve başlık satırını at
    if(M.length&&M[0].some(x=>/TAR[İI]H|ADI|VER[İI] T[ÜU]R|M[İI]KTAR/i.test(x)))M=M.slice(1);
    const sb=tumSubeler().map(([i,a])=>isimAnahtar(a));const w=Math.max(...M.map(r=>r.length));const at=[];
    for(let j=0;j<w;j++){const col=M.map(r=>r[j]||'').filter(x=>x.trim());if(col.length&&col.every(x=>sb.includes(isimAnahtar(x))))at.push(j);}
    return M.map(r=>r.filter((x,j)=>!at.includes(j)));};
  const vis=()=>S.pt._vvis||veri0().map((v,i)=>i);
  const yapistir=(t,r0,c0)=>{let M=t.replace(/\r/g,'').split('\n');while(M.length&&!M[M.length-1].trim())M.pop();M=sutunlar(M.map(x=>x.split('\t')));if(!M.length)return;
    const L=veri0().slice();const VI=vis();const dok=[];M.forEach((row,i)=>{const pos=r0+i;let r=pos<VI.length?VI[pos]:null;if(r==null){L.push(yeniSatir());r=L.length-1;}let v={...L[r]};row.forEach((val,j)=>{const c=c0+j;if(c<=4)v=hucreYaz(v,c,val);});L[r]=v;dok.push(r);});
    const hata=dok.filter(r=>veriKontrol(L[r],kL,ak,V.kilitli,V).gecersiz).length;ayarla(L,true);toast(`${M.length} satır yapıştırıldı${hata?`, ${hata} satırda uyuşmazlık var (kırmızı)`:''}.`);};
  byId('vSatir').onclick=()=>{S.pt.odak={c:1};ayarla([...veri0(),yeniSatir()],true);};
  byId('vSatir10').onclick=()=>{const L=veri0().slice();for(let i=0;i<10;i++)L.push(yeniSatir());S.pt.odak={c:1,ilkBos:true};ayarla(L,true);};
  const ob=byId('vOto');if(ob)ob.onclick=()=>{S.pt.otoAcik=!(S.pt.otoAcik??(S.pt._otoBek>0));render();};
  // Çizelgeden gelenlerin onayı: sag[pid].otoOnay.{fm|sa} = onaylanan saat (çizelge değişince eşleşmez, onay düşer)
  const otoYaz=L=>{if(!otoKapi(V.ak,V.kilitli,V.kesin))return;const deg={};L.forEach(([pid,k,dr])=>{const x=V.satir.find(y=>y.pid===pid);if(!x)return;const h=Math.round((k==='fm'?(x.sol.fmSaat||0):(x.sol.calisilanSaat||0))*100)/100;
      const cur=((V.D&&V.D.sag)||{})[pid]||{};const d0=deg[pid]||{};deg[pid]={otoOnay:{...(cur.otoOnay||{}),...(d0.otoOnay||{}),[k]:dr==='on'?h:null},otoRed:{...(cur.otoRed||{}),...(d0.otoRed||{}),[k]:dr==='red'?h:null}};});if(!Object.keys(deg).length)return;
    const sag2=sagSonuclu(V,deg);S.pt.doc={...(S.pt.doc||{}),sag:{...((S.pt.doc&&S.pt.doc.sag)||{}),...Object.fromEntries(Object.keys(deg).map(p=>[p,sag2[p]]))}};
    veriYaz(sid,ak,{deg:{},sil:[]},{sube:sid,ay:ak,sag:sagYama(sag2,Object.keys(deg))});S.pt.zorla=true;render();};
  document.querySelectorAll('[data-oto]').forEach(c=>c.onchange=()=>{const[pid,k]=c.dataset.oto.split('|');otoYaz([[pid,k,c.value]]);});
  const oh=byId('vOtoHepsi');if(oh)oh.onclick=()=>{const L=[];V.satir.forEach(x=>{const b=x.hes.otoBekle;if(!b)return;if(b.fm!=null)L.push([x.pid,'fm','on']);if(b.sa!=null)L.push([x.pid,'sa','on']);});otoYaz(L);toast(`${L.length} kalem onaylandı.`);};
  if(S.pt._vkf)kfBagla('veri',S.pt._vkf.cols,S.pt._vkf.rows);const kv=byId('kfHepsiV');if(kv)kv.onclick=()=>{kfDurum('veri').f={};kfDurum('veri').sort=null;S.pt.vsel=null;render();};
  document.querySelectorAll('[data-sil]').forEach(b=>b.onclick=()=>{const v=veri0().find(x=>x.id===b.dataset.sil);const bos=v&&veriKontrol(v,kL,ak,V.kilitli,V).bos;if(!bos&&!b.dataset.ok){b.dataset.ok='1';b.textContent='Sil?';return;}ayarla(veri0().filter(x=>x.id!==b.dataset.sil),true);});
  // Fare: tıkla seç, sürükle / Shift+tıkla aralık, çift tıkla düzenle. Dokunmatik ekranda dokununca düzenler.
  let surukle=false,ptr='mouse';
  const konum=t=>{const td=t.closest&&t.closest('td.bi');const el=td&&td.querySelector('[data-c]');const tr=td&&td.closest('tr[data-r]');return el&&tr?{r:+tr.dataset.r,c:+el.dataset.c,el}:null;};
  grid.onpointerdown=e=>{ptr=e.pointerType||'mouse';const k=konum(e.target);if(!k||k.el.disabled)return;if(ptr!=='mouse')return;if(e.button!==0)return;
    if(document.activeElement===k.el&&duzenleniyor())return;// düzenlenen hücrenin içinde imleç / metin seçimi serbest
    e.preventDefault();const a=document.activeElement;if(a&&grid.contains(a)&&a!==grid)a.blur();grid.focus({preventScroll:true});sec(k.r,k.c,e.shiftKey);surukle=true;};
  grid.onpointermove=e=>{if(!surukle||ptr!=='mouse'||!(e.buttons&1))return;const t=document.elementFromPoint(e.clientX,e.clientY);const k=t&&konum(t);if(k&&S.pt.vsel&&(k.r!==S.pt.vsel.r1||k.c!==S.pt.vsel.c1))sec(k.r,k.c,true);};
  grid.onpointerup=grid.onpointercancel=()=>{surukle=false;};
  grid.ondblclick=e=>{const k=konum(e.target);if(k&&ptr==='mouse')duzenle(k.r,k.c);};
  grid.onclick=e=>{if(ptr==='mouse')return;const k=konum(e.target);if(k)duzenle(k.r,k.c);};
  grid.querySelectorAll('select[data-c]').forEach(el=>el.addEventListener('mousedown',e=>{if(ptr==='mouse'&&document.activeElement!==el)e.preventDefault();}));
  window.__vg={
    aktif:()=>S.tab==='puantaj'&&S.pt.gorunum==='veri'&&!byId('sheetRoot').innerHTML&&byId('vGrid')===grid&&grid.isConnected,
    duzenleniyor,aralik,sec,duzenle,
    tsv:()=>{const A=aralik();if(!A)return null;const R=[];for(let r=A.r0;r<=A.r1;r++){const row=[];for(let c=A.c0;c<=A.c1;c++){const x=hucreEl(r,c);row.push(x?(x.tagName==='SELECT'?(x.value?x.selectedOptions[0].text:''):x.value):'');}R.push(row.join('\t'));}return{t:R.join('\n'),n:(A.r1-A.r0+1)*(A.c1-A.c0+1)};},
    yapistir:t=>{const A=aralik();const tek=!/[\t\n]/.test(t.replace(/[\r\n]+$/,''));
      if(A){if(tek&&(A.r1>A.r0||A.c1>A.c0)){window.__vDoldur(t.replace(/[\r\n]+$/,''),A);return;}yapistir(t,A.r0,A.c0);return;}
      if(tek)return;const L=veri0();const VI=vis();const bosP=VI.findIndex(i=>L[i]&&veriKontrol(L[i],kL,ak,V.kilitli,V).bos);yapistir(t,bosP>=0?bosP:VI.length,0);}};
  window.__vDoldur=(val,A)=>{const L=veri0().slice();const VI=vis();let n=0;for(let p=A.r0;p<=A.r1;p++){const r=VI[p];if(r==null||!L[r])continue;let v={...L[r]};for(let c=A.c0;c<=A.c1;c++){if(c>4)continue;v=hucreYaz(v,c,val);n++;}L[r]=v;}
    ayarla(L,true);toast(val===''?`${n} hücre temizlendi.`:`${n} hücreye yapıştırıldı.`);};
  if(!veriYapistirBagli){veriYapistirBagli=true;
    document.addEventListener('copy',e=>{const G=window.__vg;if(!G||!G.aktif()||G.duzenleniyor())return;const x=G.tsv();if(!x)return;e.clipboardData.setData('text/plain',x.t);e.preventDefault();toast(`${x.n} hücre kopyalandı.`);});
    document.addEventListener('paste',e=>{const G=window.__vg;if(!G||!G.aktif()||G.duzenleniyor())return;const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&!(byId('vGrid')&&byId('vGrid').contains(a)))return;
      const t=(e.clipboardData||window.clipboardData).getData('text');if(!t)return;e.preventDefault();G.yapistir(t);});
    document.addEventListener('keydown',e=>{const G=window.__vg;if(!G||!G.aktif()||G.duzenleniyor())return;const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&!(byId('vGrid')&&byId('vGrid').contains(a)))return;
      const A=G.aralik();if(!A)return;const P=S.pt.vsel;
      if(e.key==='Escape'){S.pt.vsel=null;G.sec&&byId('vGrid').querySelectorAll('td.vsel,td.vakt').forEach(t=>t.classList.remove('vsel','vakt'));return;}
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();window.__vDoldur('',A);return;}
      if(e.key==='Enter'||e.key==='F2'){e.preventDefault();G.duzenle(P.r1,P.c1);return;}
      if(e.key==='Tab'){e.preventDefault();G.sec(P.r1,P.c1+(e.shiftKey?-1:1));return;}
      const yon={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];if(yon){e.preventDefault();G.sec(P.r1+yon[0],P.c1+yon[1],e.shiftKey);return;}
      if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(P.c1===2)G.duzenle(P.r1,P.c1);else G.duzenle(P.r1,P.c1,e.key);}});}
  selCiz();
  // odak: yeni eklenen satırın hücresi seçilip düzenlemeye açılır
  if(S.pt.odak){const o=S.pt.odak;S.pt.odak=null;const rows=[...grid.querySelectorAll('tr[data-vid]')];let tr=o.ilkBos?rows.find(t=>{const v=veri0().find(x=>x.id===t.dataset.vid);return v&&veriKontrol(v,kL,ak,V.kilitli,V).bos;}):rows[rows.length-1];
    if(tr)duzenle(+tr.dataset.r,o.c);}}

// Boş satırlar: sekme değişince, şubeden çıkınca ve sayfa açılınca silinir.
function bosSatirMi(v){return !String(v.ad||'').trim()&&!v.pid&&!v.tur&&(v.miktar===''||v.miktar==null)&&!String(v.aciklama||'').trim();}
// Sadece kendi açtığım ya da 1 saatten eski boş satırlar silinir (başkasının o an doldurduğu yeni satıra dokunulmaz).
export function veriBosTemizle(){const D=S.pt.doc;if(!D||D.kesin===true||!Array.isArray(D.veri)||!S.pt.sube||S.pt.sube!==S.subeId)return;const ben=(S.me&&(S.me.adSoyad||S.me.kullaniciAdi))||'';
  const silinir=v=>bosSatirMi(v)&&(v.kim===ben||!v.zaman||Date.now()-Date.parse(v.zaman)>3600000);const sil=D.veri.filter(silinir).map(v=>v.id);if(!sil.length)return;
  const sid=S.pt.sube,ak=S.ay;if(kilitBaskasi())return;S.pt.doc={...D,veri:D.veri.filter(v=>!silinir(v))};veriYaz(sid,ak,{deg:{},sil});}
