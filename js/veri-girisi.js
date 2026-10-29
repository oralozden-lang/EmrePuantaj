// veri-girisi.js — app.js (v180) satırları 1669-1753. Otomatik bölündü; davranış değişmedi.
import { AYK, VERI_TUR, subeAdi, veriTur } from './sabitler.js';
import { S } from './durum.js';
import { ascii, ayAdi, ayKaydir, esc, fmt, isimAnahtar, mondayOf, parse, sayi, sg, tl, tl0, trTarih, ymd } from './yardimci.js';
import { isIsveren } from './rol.js';
import { aktifAyda, cellOf } from './hesap.js';
import { ayniKisi } from './ay-ozet.js';
import { fmKisiUcreti, otoKapi, solHesap } from './puantaj-hesap.js';
import { subePersoneli } from './personel.js';
import { fmOzelMap, netMap, ucretSekli } from './puantaj-veri.js';
import { kfAktifMi, kfBaslik, kfDurum, kfUygula } from './kolon-filtre.js';
import { adBuyuk, xSerialTarih } from './isim-esle.js';

/* ================= Puantaj veri girişi ================= */

export const UI_veri_girisi={veriYapistirBagli:false};
export function veriKisileri(V){const kisiler=new Map();V.satir.forEach(x=>kisiler.set(x.pid,x.sol.ad));
  subePersoneli().filter(p=>aktifAyda(p,V.ak)).forEach(p=>{if(!kisiler.has(p.id))kisiler.set(p.id,p.ad);});
  return [...kisiler.entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'tr'));}
// Excel'den gelen veri türü yazısını koda çevir
export function turCoz(s){const a=ascii(s).replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();if(!a)return null;
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
export function veriKontrol(v,kL,ak,kilitli,V=null){const r={pid:'',tur:'',hata:''};const bos=!String(v.ad||'').trim()&&!v.pid&&!v.tur&&!String(v.miktar??'').toString().trim()&&!String(v.aciklama||'').trim();if(bos)return{...r,bos:true};
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
