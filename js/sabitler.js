// sabitler.js — app.js (v180) satırları 7-84. Otomatik bölündü; davranış değişmedi.
import { S } from './durum.js';
import { ayKaydir, ayKey, isimAnahtar, sayi, today } from './yardimci.js';
import { sgkGunSayisi } from './hesap-ay.js';
import { ayniKisi } from './ay-ozet.js';
import { render } from './cerceve.js';
import { toast } from './panel.js';

/* ================= Sabitler ================= */
export const AY = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];
export const AYK = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const GUN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const GUNU = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const GRUP = { M: 'Müdür', K: 'Mutfak', S: 'Kurye' };
export const GRUP_SIRA = ['M', 'K', 'S'];
export const KOD = {
  HT: { ad: 'Haftalık izin', kisa: 'İZİN' },
  R: { ad: 'Rapor', kisa: 'RAPOR' },
  UI: { ad: 'Ücretsiz izin', kisa: 'ÜCR.<br>İZİN' },
  YI: { ad: 'Yıllık izin', kisa: 'YILLIK' },
  B: { ad: 'Bayram', kisa: 'BAYR.' },
  D: { ad: 'Diğer', kisa: 'DİĞER' },
  CG: { ad: 'Part boş', kisa: 'PART<br>BOŞ' },
};
// CG: sadece part-time personelde seçilir; ücrete, SGK gününe ve fazla mesaiye etkisi yok, sadece günün boş sayılmasını önler. Lejantta gösterilmez.
export const KOD_SIRA = ['HT', 'R', 'UI', 'YI', 'B']; // 'D' (Diğer) kaldırıldı: eski kayıtlarda görünür, yeni seçilemez
// Excel'deki koşullu biçim renkleri: [zemin, yazı]
export const KOD_RENK = {
  HT: ['#1c1c1c', '#ffffff'],
  R: ['#c6e3ab', '#24401a'],
  UI: ['#1f3864', '#ffffff'],
  YI: ['#4f6a2a', '#ffffff'],
  B: ['#e9edf3', '#33415a'],
  D: ['#9aa3af', '#ffffff'],
  CG: ['#e01e1e', '#ffffff'],
};
export const BOS_RENK = '#fde2e2';
export const kodStil = k => {
  const r = KOD_RENK[k];
  return r ? `style="background:${r[0]};border-color:${r[0]};color:${r[1]}"` : '';
};
export const SEKILLER = ['Tam', 'Part', 'Esnaf kurye'];
// Görev listesi: seçmeli, elle yazılmaz. Görev çizelgedeki bölümü ve esnaf durumunu belirler.
export const GOREVLER = [
  { ad: 'R. Müdür', grup: 'M' },
  { ad: 'V. Müdür', grup: 'M' },
  { ad: 'Mutfak', grup: 'K' },
  { ad: 'Kurye', grup: 'S' },
  { ad: 'Esnaf Kurye', grup: 'S', sekil: 'Esnaf kurye' },
];
export const SGK_YOK = '-';
// Sistemin başladığı ay: bundan önceki aylar gösterilmez
export const BASLANGIC_AY = '2026-08';
// Varsayılan ay: başlangıçtan itibaren henüz bitmemiş ilk ay (ay sonu: kapatılmamış; puantaj: onaylanmamış)
export function acikAy(tur) {
  const bu = ayKey(today());
  let k = BASLANGIC_AY;
  while (k < bu) {
    const d = (S.aylar[k] || {}).durum;
    const bitti = tur === 'puantaj' ? onayli(d) : d === 'sube_onay' || onayli(d);
    if (!bitti) return k;
    k = ayKaydir(k, 1);
  }
  return k < BASLANGIC_AY ? BASLANGIC_AY : k;
}
export function aktifAy(tur) {
  if (S.ayElle && S.ay) return S.ay < BASLANGIC_AY ? BASLANGIC_AY : S.ay;
  return acikAy(tur);
}
export function ayGit(ak, n) {
  const y = ayKaydir(ak, n);
  if (y < BASLANGIC_AY) {
    toast('Sistem Ağustos 2026 ile başladı, önceki aylar yok.');
    return;
  }
  S.ay = y;
  S.ayElle = true;
  render();
}
// Puantaj veri girişi türleri. b: birim, y: hangi tarafa etki eder (sol=muhasebe, sag=ödeme)
export const VERI_TUR = [
  { k: 'R', ad: 'Rapor', b: 'gün', y: 'sol' },
  { k: 'UI', ad: 'Ücretsiz izin', b: 'gün', y: 'sol' },
  { k: 'YI', ad: 'Yıllık izin', b: 'gün', y: 'sol' },
  { k: 'B', ad: 'Bayram', b: 'gün', y: 'sol' },
  { k: 'PG', ad: 'Part gün', b: 'gün', y: 'sol' },
  { k: 'FM', ad: 'Fazla mesai (saat)', b: 'saat', y: 'sol', gizli: true },
  { k: 'BY', ad: 'Bankaya yatan', b: '₺', y: 'sag' },
  { k: 'MF', ad: 'Maaş farkı (+ / −)', b: '₺', y: 'sag' },
  { k: 'SA', ad: 'Çalışılan saat', b: 'saat', y: 'sag' },
  { k: 'FMT', ad: 'Fazla mesai tutarı', b: '₺', y: 'sag' },
  { k: 'AV', ad: 'Avans', b: '₺', y: 'sag' },
  { k: 'AO', ad: 'Ara ödeme', b: '₺', y: 'sag' },
  { k: 'PS', ad: 'Paket sayısı', b: 'adet', y: 'sag', gizli: true },
  { k: 'PP', ad: 'Paket primi', b: '₺', y: 'sag' },
  { k: 'CP', ad: 'Ciro primi', b: '₺', y: 'sag' },
  { k: 'EK', ad: 'Ek ödeme', b: '₺', y: 'sag', gizli: true },
  { k: 'KS', ad: 'Kesinti', b: '₺', y: 'sag', gizli: true },
];
export const veriTur = k => VERI_TUR.find(t => t.k === k);
// Veri girişi satırının kaydı: kayıt numarası boş ya da silinmiş/değişmiş kayda aitse isimle bulunur (yoksa tutar hiçbir satıra ulaşmaz).
export function veriPid(v) {
  let pid = v.pid;
  if (!pid || !S.personel.some(p => p.id === pid)) {
    const k = isimAnahtar(v.ad || '');
    const p = k ? S.personel.find(p => isimAnahtar(p.ad) === k) : null;
    if (p) pid = p.id;
    else if (!pid) return null;
  }
  return pid;
}
export function veriOzet(veri, ak = S.ay) {
  const o = {};
  (veri || []).forEach(v => {
    const t = veriTur(v.tur);
    if (!t || v.miktar === '' || v.miktar == null) return;
    if (v.gonder) return;
    /* maaş şubesine gönderilen "Bankaya yatan": bu şubenin hesabına girmez */ if (
      v.tarih &&
      ak &&
      v.tarih.slice(0, 7) !== ak
    )
      return;
    const pid = veriPid(v);
    if (!pid) return;
    const x = (o[pid] = o[pid] || {});
    x[v.tur] = (x[v.tur] || 0) + sayi(v.miktar);
  });
  return o;
}
// Veri girişindeki gün türleri (rapor, ücretsiz izin, yıllık izin, bayram, part gün) şubeler arası ay özetine (ozetler → veriGun) yazılır:
// kişinin muhasebe (SGK) şubesi de maaş şubesi de, hangi şubede girilirse girilsin bu günleri sayar. {kayıt: {ad, g: {tarih: {tür: miktar}}}}
// Onaylı ayda onaydan sonra eklenen gün satırları (kırmızı, hesaba katılmaz) alınmaz.
export const GUN_TURLERI = ['R', 'UI', 'YI', 'B', 'PG'];
export function veriGunHesap(veri, ak, D) {
  const o = {};
  const kil = D && D.kilitli === true && D.onayTarihi ? String(D.onayTarihi) : null;
  (veri || []).forEach((v, i) => {
    if (!v || !GUN_TURLERI.includes(v.tur) || v.miktar === '' || v.miktar == null || !sayi(v.miktar)) return;
    if (v.tarih && v.tarih.slice(0, 7) !== ak) return;
    if (kil && v.zaman && String(v.zaman) > kil) return;
    const pid = veriPid(v);
    if (!pid) return;
    const p = S.personel.find(x => x.id === pid);
    const x = (o[pid] = o[pid] || { ad: (p && p.ad) || v.ad || '', g: {} });
    const t = v.tarih || '-' + (v.id || i);
    const z = (x.g[t] = x.g[t] || {});
    z[v.tur] = Math.round(((z[v.tur] || 0) + sayi(v.miktar)) * 100) / 100;
  });
  return o;
}
// Diğer şubelerin veri girişinden gelen gün türleri {kayıt: {tür: miktar}}. Aynı kişi, aynı gün, aynı tür birden fazla şubede yazılmışsa bir kez sayılır.
export function kisiAnahtar(pid, ad) {
  const p = S.personel.find(x => x.id === pid);
  return p && p.tc ? 'tc:' + p.tc : 'ad:' + isimAnahtar((p && p.ad) || ad || '');
}
export function veriDis(ak, sid, D) {
  const V = S.pt.ozetVeri || {};
  const K = {};
  const ekle = (src, dis) =>
    Object.entries(src || {}).forEach(([pid, x]) => {
      const k = kisiAnahtar(pid, x && x.ad);
      const e = (K[k] = K[k] || { pid, t: {} });
      Object.entries((x && x.g) || {}).forEach(([tr, tt]) =>
        Object.entries(tt || {}).forEach(([tur, m]) => {
          if (!GUN_TURLERI.includes(tur)) return;
          const z = (e.t[tur] = e.t[tur] || {});
          const q = (z[tr] = z[tr] || { b: 0, d: 0 });
          if (dis) q.d = Math.max(q.d, sayi(m));
          else q.b += sayi(m);
        })
      );
    });
  ekle(veriGunHesap(D && D.veri, ak, null), false);
  Object.entries(V).forEach(([s, x]) => {
    if (s !== sid) ekle(x, true);
  });
  const out = {};
  Object.values(K).forEach(e =>
    Object.entries(e.t).forEach(([tur, z]) => {
      let n = 0;
      Object.values(z).forEach(q => {
        n += Math.max(0, q.d - q.b);
      });
      if (n > 0.0001) (out[e.pid] = out[e.pid] || {})[tur] = Math.round(n * 100) / 100;
    })
  );
  return out;
}
// Aynı kişi birden fazla kayıtla (ör. iki şubede ayrı kayıt) olabilir; ödeme satırı tek kayıtta birleşir (aynı kişi: TC, TC yoksa ad soyad).
// Veri girişi satırları kayıt numarasıyla bağlıdır: satırın kaydı birleşen diğer kayıtsa, giriş aynı kişinin satırına eklenir (yoksa tutarlar boş kalırdı).
export function ozBirlestir(oz, sol) {
  const satirlar = Object.keys(sol || {}).map(pid => ({
    pid,
    p: S.personel.find(x => x.id === pid) || { id: pid, ad: (sol[pid] && sol[pid].ad) || '' },
  }));
  const o = {};
  Object.entries(oz || {}).forEach(([pid, e]) => {
    let hedef = pid;
    if (!(sol && sol[pid])) {
      const p = S.personel.find(x => x.id === pid);
      const r = p ? satirlar.find(s => ayniKisi(s.p, p)) : null;
      if (r) hedef = r.pid;
    }
    const x = (o[hedef] = o[hedef] || {});
    Object.entries(e).forEach(([t, v]) => {
      x[t] = (x[t] || 0) + v;
    });
  });
  return o;
}
// Elle girilen gün/saat verilerini muhasebe tarafına ekle. Gün sayısı çizelgedeki kuralla (sgkGunSayisi) yeniden hesaplanır:
// 31 çeken ayda 1 gün rapor 30 kalır, Şubat (28) 27 olur; çizelgeye yazılmış gibi.
// Veri girişindeki ücretsiz izin sadece muhasebeyi (bordro günü) değiştirir, part gün gibi; hak edilen gün çizelgedeki çalışmaya göre kalır.
// Rapor gerçektir (elle değiştirilmez): veri girişindeki rapor hak edilen günü de düşürür.
export function veriUygula(sol, oz) {
  Object.entries(oz).forEach(([pid, e]) => {
    const r = sol[pid];
    if (!r) return;
    const n = k => e[k] || 0;
    if (r.maasBurada !== false || r.muhBurada) {
      r.rapor = (r.rapor || 0) + n('R');
      r.ucretsiz = (r.ucretsiz || 0) + n('UI');
      r.yillik = (r.yillik || 0) + n('YI');
      r.bayram = (r.bayram || 0) + n('B');
      r.partGun = Math.round(((r.partGun || 0) + n('PG')) * 100) / 100;
      const T = r.gunTaban;
      const vE = n('R') + n('UI');
      // Part gün girilmemiş part-time: gün sayısı tam zamanlı gibi (ay − rapor − ücretsiz izin)
      if (r.partGun > 0) r.gun = r.partGun;
      else if (vE) r.gun = T ? sgkGunSayisi(T.ist, T.takvim, T.e + vE) : Math.max(0, (r.gun || 0) - vE);
      if (r.hakGun != null && n('R'))
        r.hakGun = T ? sgkGunSayisi(T.istF, T.takvim, T.eH + n('R')) : Math.max(0, r.hakGun - n('R'));
      if (r.iscGun != null && vE && T && T.iS != null) r.iscGun = sgkGunSayisi(T.iS, T.takvim, T.eS + vE);
      // Part gün girilmiş tam zamanlı (ör. SGK'da 1 gün gösterilen, fiilen tüm ay çalışan): işçilikte SGK maliyeti de part gün üzerinden; maaş hak günü değişmez.
      if (r.iscGun != null && r.partGun > 0) r.iscGun = Math.min(r.iscGun, r.partGun);
    }
    r.fmSaat = Math.round(((r.fmSaat || 0) + n('FM')) * 100) / 100;
    if (['R', 'UI', 'YI', 'B', 'PG', 'FM'].some(k => e[k])) r.elle = true;
  });
  return sol;
}
export function gorevBul(ad) {
  return GOREVLER.find(g => g.ad === ad) || null;
}
export function gorevTahmin(p) {
  const g = String(p.gorev || '').toLocaleUpperCase('tr-TR');
  if (gorevBul(p.gorev)) return p.gorev;
  if (p.sekil === 'Esnaf kurye') return 'Esnaf Kurye';
  if (g.startsWith('R.') || g.includes('RESTORAN')) return 'R. Müdür';
  if (g.startsWith('V.') || g.includes('VARD') || g.includes('MÜDÜR')) return 'V. Müdür';
  if (g.includes('SÜRÜCÜ') || g.includes('KURYE') || g.includes('MOTOR') || p.grup === 'S') return 'Kurye';
  if (g.includes('MUTFAK') || p.grup === 'K') return 'Mutfak';
  return '';
}
export function subeAdi(id) {
  if (id === SGK_YOK) return '';
  return (S.subeler[id] && S.subeler[id].ad) || S.subeAdlari[id] || id || '';
}
export const ROL = { sube: 'Şube müdürü', bolge: 'Bölge müdürü', isveren: 'İşveren' };
export const DURUM = {
  taslak: { ad: 'Taslak', c: 'mut' },
  sube_onay: { ad: 'Şube onayladı', c: 'warn' },
  geri: { ad: 'Geri gönderildi', c: 'bad' },
  bolge_onay: { ad: 'Bölge onayladı', c: 'ok' },
  kesin: { ad: 'Kesin kapandı', c: 'ok' },
};
// Ay onaylı mı (bölge onayı ya da işverenin kesin kapanışı). Kesin kapanan ayda hiçbir şey değişmez: rakamlar kapanış anındaki halleriyle saklanır.
export const onayli = d => d === 'bolge_onay' || d === 'kesin';
export const kesinAy = d => (S.aylar[ayKey(d)] || {}).durum === 'kesin';
export const VARSAYILAN = {
  ad: 'Şube',
  acilis: '11:00',
  kapanis: '00:30',
  gunluk: 8.5,
  haftalik: 51,
  fmYontem: 'sabit',
  fmUcret: 165,
  fmDonem: 'hafta',
};
