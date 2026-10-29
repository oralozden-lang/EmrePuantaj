// Altın kayıt senaryoları: her biri gerçek bir kullanıcı akışı. k(etiket) = ara ekran görüntüsü kaydı.
const bekle = (p, ms = 700) => p.waitForTimeout(ms);
const sekme = async (p, ad) => { await p.click(`#tabsIn button[data-tab="${ad}"]`); await bekle(p); };

export const SENARYOLAR = [
  { ad: 'giris-hatali-sonra-basarili', girisYapan: null, adim: async (p, k) => {
    await p.waitForSelector('#lf'); await p.fill('#lk', 'admin'); await p.fill('#lp', 'yanlis'); await p.click('#lb'); await bekle(p); await k('hatali');
    await p.fill('#lp', 'Test1234'); await p.click('#lb'); await p.waitForSelector('.weeknav'); await bekle(p);
  } },
  { ad: 'cizelge-isveren-bu-hafta', girisYapan: 'admin', adim: async () => {} },
  { ad: 'cizelge-isveren-gecen-hafta-kapali', girisYapan: 'admin', adim: async (p) => { await p.click('#prevW'); await bekle(p); } },
  { ad: 'cizelge-bolge-bu-hafta', girisYapan: 'bolge1', adim: async () => {} },
  { ad: 'cizelge-sube-bu-hafta', girisYapan: 'sube1', adim: async () => {} },
  { ad: 'cizelge-sube-gecen-hafta-kapali-gizli', girisYapan: 'sube1', adim: async (p) => { await p.click('#prevW'); await bekle(p); } },
  { ad: 'hucre-duzenle-sube', girisYapan: 'sube1', adim: async (p, k) => {
    await p.dblclick('button.cell[data-p="osman-celik"][data-i="3"]'); await bekle(p); await k('saat-paneli');
    await p.selectOption('#tA', '11:00'); await p.selectOption('#tB', '19:30'); await bekle(p, 200); await k('saat-secili');
    await p.click('#tSave'); await bekle(p, 1200);
  } },
  { ad: 'hucre-temizle-sube', girisYapan: 'sube1', adim: async (p) => {
    await p.dblclick('button.cell[data-p="mehmet-karakaya"][data-i="1"]'); await bekle(p);
    await p.click('.codes button.clear'); await bekle(p, 1200);
  } },
  { ad: 'hafta-onayla-isveren', girisYapan: 'admin', adim: async (p, k) => {
    await p.click('#prevW'); await bekle(p); await k('onay-oncesi'); await p.click('#hOn'); await bekle(p, 2000);
  } },
  { ad: 'hafta-geri-gonder-isveren', girisYapan: 'admin', adim: async (p, k) => {
    await p.click('#prevW'); await bekle(p); await p.click('#hGeri'); await bekle(p); await k('geri-paneli');
    await p.fill('#hgNot', 'Osman Çelik cumartesi eksik'); await p.click('#hgOk'); await bekle(p, 1500);
  } },
  { ad: 'hafta-kilidi-ac-bolge', girisYapan: 'bolge1', adim: async (p) => {
    await p.click('#prevW'); await bekle(p); await p.click('#hKilit'); await bekle(p, 300); await p.click('#hKilit'); await bekle(p, 1500);
  } },
  { ad: 'gecen-haftayi-kopyala-isveren', girisYapan: 'admin', adim: async (p, k) => {
    await p.click('#copyW'); await bekle(p); await k('kopya-paneli'); await p.click('#cYes'); await bekle(p, 1500);
  } },
  { ad: 'personel-listesi-isveren', girisYapan: 'admin', adim: async (p) => { await sekme(p, 'personel'); } },
  { ad: 'personel-listesi-sube', girisYapan: 'sube1', adim: async (p) => { await sekme(p, 'personel'); } },
  // "Puantaj" sekmesi seçili şubenin ayrıntısını açar (ilk açık ay: Ağustos); "‹ Şubeler" listeye döner
  { ad: 'puantaj-sekmesi-ilk-ekran-bolge', girisYapan: 'bolge1', adim: async (p) => { await sekme(p, 'puantaj'); await bekle(p, 1200); } },
  { ad: 'puantaj-haftalar-takibi-bolge', girisYapan: 'bolge1', adim: async (p) => { await sekme(p, 'puantaj'); await p.click('#geriL'); await bekle(p); } },
  { ad: 'puantaj-aylik-liste-bolge', girisYapan: 'bolge1', adim: async (p) => {
    await sekme(p, 'puantaj'); await p.click('#geriL'); await bekle(p); await p.click('#tkSeg button[data-v="ay"]'); await bekle(p);
  } },
  { ad: 'puantaj-eylul-muhasebe-odemeler-veri', girisYapan: 'admin', adim: async (p, k) => {
    await sekme(p, 'puantaj'); await p.waitForSelector('#ptNext'); await bekle(p, 1000); await p.click('#ptNext'); await bekle(p, 2000); await k('muhasebe');
    await p.click('#ptSeg button[data-v="sag"]'); await bekle(p); await k('odemeler');
    await p.click('#ptSeg button[data-v="veri"]'); await bekle(p); await k('veri-girisi');
  } },
  { ad: 'yonetim-bolumleri-isveren', girisYapan: 'admin', adim: async (p, k) => {
    await sekme(p, 'yonetim'); await k('subeler');
    for (const v of ['kullanicilar', 'iscilik', 'iban', 'yedek']) { await p.click(`#ySeg button[data-v="${v}"]`); await bekle(p, 900); await k(v); }
  } },
  { ad: 'yonetim-bolge', girisYapan: 'bolge1', adim: async (p) => { await sekme(p, 'yonetim'); } },
];
