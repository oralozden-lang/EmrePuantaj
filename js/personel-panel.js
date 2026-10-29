// personel-panel.js — app.js (v180) satırları 1302-1368. Otomatik bölündü; davranış değişmedi.
import { doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { BASLANGIC_AY, GOREVLER, GRUP, SGK_YOK, gorevBul, gorevTahmin, subeAdi } from './sabitler.js';
import { arka, db, deleteDoc } from './firebase.js';
import { S } from './durum.js';
import { ayAdi, ayKaydir, ayKey, esc, isimAnahtar, mondayOf, parse, slug, today, trTarih, ymd } from './yardimci.js';
import { isBolge, isIsveren, isSube } from './rol.js';
import { gorevGecmisYama, maasGecmisYama, maasSubeGecmisYazi, odemeSubesi } from './gecmis.js';
import { ekSubeleri } from './cok-sube.js';
import { ayniKisi } from './ay-ozet.js';
import { sirayla, yazmaHatasi } from './yazma.js';
import { tumSubeler } from './subeler.js';
import { byId } from './cerceve.js';
import { closeSheet, openSheet, toast } from './panel.js';
import { personelGecmisHtml, personelKaydiVar, personelMaasGecmisi, personelYaz, personelYazabilir, subePersoneli } from './personel.js';
import { ekSubePanel, ekYetkiVar } from './ek-sube.js';
import { BILGI, tcOf } from './bilgi-dogrulama.js';
import { sgkCakisma, sgkCakismaMesaj } from './personel-listesi.js';
import { adBuyuk, cikisBildirimKopyala, isimsizMi } from './isim-esle.js';

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

