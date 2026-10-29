# Geliştirme

## Yapı
Derleme gerektirmeyen, tarayıcıda doğrudan çalışan ES modülleri. Giriş: `index.html` → `js/main.js` → tüm modüller → `bootstrap()`.
`js/` içinde 57 modül var (eski tek dosyalı `app.js` bölümlere ayrıldı; davranış aynı). Dosya adları bölüm başlıklarından gelir:

| Katman | Modüller |
|---|---|
| Temel | `sabitler`, `durum` (uygulama durumu `S`), `yardimci`, `saat`, `rol`, `firebase` (yazma sarmalayıcıları, bekleyen kayıt) |
| Hesap (saf kurallar) | `hesap` (hafta fazla mesai, 7 gün), `hesap-ay` (SGK günü, ay), `fm-donem` (dönem ve geçişleri), `gecmis` (maaş şubesi, görev), `cok-sube`, `kadro`, `ay-ozet`, `puantaj-hesap` (muhasebe ve ödeme hesapları) |
| Yazma / kilit / oturum | `yazma`, `kilit`, `hucre-yazma`, `oturum`, `subeler`, `cerceve`, `panel` |
| Çizelge | `cizelge`, `cizelge-secim`, `cizelge-hucre`, `hafta-kapatma`, `hafta-kontrol`, `hafta-islem` |
| Personel | `personel`, `ek-sube`, `bilgi-dogrulama` (TC, IBAN), `iban-listesi`, `personel-listesi`, `personel-yapistir`, `personel-panel` |
| Ay ve puantaj | `ay-sonu`, `takip`, `puantaj`, `puantaj-veri`, `puantaj-detay`, `kolon-filtre`, `veri-girisi`, `veri-kayit`, `veri-girisi-bagla`, `puantaj-islem`, `odeme-panel` |
| Çıktılar | `odeme-cikti`, `muhasebe-cikti`, `paylas`, `bordro-ocr`, `bordro` |
| Yönetim | `yonetim`, `isim-esle`, `excel-aktar`, `yedek`, `iscilik-hesap`, `iscilik`, `kullanici` |

Birden çok modülden atanan durum değişkenleri `UI_<modül>` nesnelerinde durur (ör. `UI_cizelge.SEL`).

## Testler (gerçek Firebase gerekmez)
Gerekli: Node 22, `playwright` (Chromium), `npm i -D prettier`.
```bash
node test/altin.mjs                                        # 23 ekran/akış senaryosu, kayıtlı çıktıyla birebir karşılaştırır
node --import ./test/node-hazirlik.mjs test/birim.mjs      # hesap kuralları birim testleri
node test/yukle-testi.mjs                                  # yedekten yükleme aracı
```
Bilerek davranış değiştirince: `node test/altin.mjs --kaydet`. Ayrıntı: `test/README.md`.
Biçim: `npx prettier --config .prettierrc.json --write "js/*.js"`.

## Ortamlar
- `main`: orijinal canlı Firebase projesini gösterir; **dokunulmaz**.
- `claude/modullere-bol`: test projesi `puantaj-test` (`config.js`). Vercel üretim dalı budur.
- Test verisini yüklemek: `/araclar/yukle.html` (Yönetim → Yedek dosyasını seçer; yalnızca test projesinde çalışır).
