// gecmis.js — app.js (v180) satırları 298-321. Otomatik bölündü; davranış değişmedi.
import { BASLANGIC_AY, SGK_YOK, subeAdi } from './sabitler.js';
import { ayAdi, ayKey, today } from './yardimci.js';

// Haftanın listesi (kadro): o hafta çizelgede görünen kişiler. Kayıtlı değilse önceki haftanın listesi önerilir.
export function maasSubesi(p){return p.sgkSube&&p.sgkSube!==SGK_YOK?p.sgkSube:(p.anaSube||'');}
// Maaşın ödendiği şube: varsayılan SGK şubesi; "çalıştığı şubede" seçildiyse çalıştığı şube. Muhasebe (bordro) her zaman SGK şubesinde.
export function odemeSubesiEski(p){const sgk=p.sgkSube&&p.sgkSube!==SGK_YOK?p.sgkSube:'';if(sgk&&p.anaSube&&sgk!==p.anaSube&&p.maasYeri!=='sgk')return p.anaSube;return maasSubesi(p);}
// Maaş şubesi aya göre: maasSubeGecmis {"2026-10":"şubeId"} = "o aydan itibaren". Kayıt yoksa eski kural (çalıştığı şube / SGK).
export function odemeSubesi(p,ak){const g=p&&p.maasSubeGecmis;if(g&&ak){const k=Object.keys(g).filter(x=>x<=ak&&g[x]).sort().pop();if(k)return g[k];}return odemeSubesiEski(p);}
// Maaş şubesini "ak ayından itibaren" değiştirir; önceki aylar o ana kadarki şubede donar. yeni: şube id'si ya da kişinin yeni alanları.
export function maasGecmisYama(p,yeni,ak){if(!ak||ak<BASLANGIC_AY)ak=BASLANGIC_AY;const g0=p.maasSubeGecmis||{};const g={...g0};const ilk=!Object.keys(g0).length;
  if(ilk)g[BASLANGIC_AY]=odemeSubesiEski(p);const once=odemeSubesi({...p,maasSubeGecmis:g},ak);
  const y=typeof yeni==='string'?yeni:odemeSubesiEski({...p,...yeni});if(!y||y===once)return null;
  g[ak]=y;return{maasSubeGecmis:g,maasSubeleri:[...new Set(Object.values(g).filter(Boolean))]};}
// Görev geçmişi: gorevGecmis {"2026-09":{gorev,grup,sekil}} = "o aydan itibaren". Ay hesabında kişinin o ayki görevi, grubu ve çalışma şekli kullanılır.
// İlk kayıttan önceki aylar ilk kaydın değerini alır. Kişinin üstteki gorev/grup/sekil alanları her zaman en son kaydın değeridir.
export function gorevAyda(p,ak){const g=p&&p.gorevGecmis;if(!g||!ak)return p;const ks=Object.keys(g).filter(x=>g[x]&&g[x].gorev).sort();if(!ks.length)return p;const v=g[ks.filter(x=>x<=ak).pop()||ks[0]];
  if(v.gorev===p.gorev&&(v.grup||p.grup)===p.grup&&(v.sekil||p.sekil)===p.sekil)return p;return{...p,gorev:v.gorev,grup:v.grup||p.grup,sekil:v.sekil||p.sekil};}
// Görevi "ak ayından itibaren" değiştirir; önceki aylar eski görevde kalır. yeni: {gorev,grup,sekil}.
export function gorevGecmisYama(p,yeni,ak){if(!ak||ak<BASLANGIC_AY)ak=BASLANGIC_AY;const g0=p.gorevGecmis||{};const g={...g0};
  if(!Object.keys(g0).length)g[BASLANGIC_AY]={gorev:p.gorev||'',grup:p.grup||'K',sekil:p.sekil||'Tam'};
  const once=gorevAyda({...p,gorevGecmis:g},ak);if(g[ak]&&once.gorev===yeni.gorev&&once.grup===yeni.grup&&once.sekil===yeni.sekil)return null;
  g[ak]={gorev:yeni.gorev,grup:yeni.grup,sekil:yeni.sekil};const son=g[Object.keys(g).sort().pop()];return{gorevGecmis:g,gorev:son.gorev,grup:son.grup,sekil:son.sekil};}
export function gorevGecmisYazi(p){const g=(p&&p.gorevGecmis)||{};return Object.keys(g).filter(k=>g[k]&&g[k].gorev).sort().map(k=>`${ayAdi(k)}: ${g[k].gorev}${g[k].sekil&&g[k].sekil!=='Tam'?' ('+g[k].sekil+')':''}`).join(' · ');}
// Personel tablosundan görev / şekil düzeltmesi: geçmişi olan kişide bu aydan itibaren geçerli olur, geçmişi olmayanda eskisi gibi tüm aylar.
export function gorevSatirYama(p,body){if(!p.gorevGecmis||!Object.keys(p.gorevGecmis).length)return body;const y=gorevGecmisYama(p,{gorev:body.gorev??p.gorev,grup:body.grup??p.grup,sekil:body.sekil??p.sekil},ayKey(today()));return y||body;}
export function maasSubeGecmisYazi(p){const g=(p&&p.maasSubeGecmis)||{};return Object.keys(g).sort().map(k=>`${ayAdi(k)}: ${subeAdi(g[k])}`).join(' · ');}
