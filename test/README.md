# Test altyapısı (sahte Firebase + altın kayıt)

Uygulamayı **gerçek Firebase'e bağlanmadan**, gerçek bir tarayıcıda (Playwright) çalıştırır.
Firebase CDN adresleri (`gstatic.com/firebasejs/…`) `mock-firebase.js` ile değiştirilir; saat 14 Ekim 2026'ya donar, rastgelelik sabittir.

| Dosya | Görev |
|---|---|
| `mock-firebase.js` | Bellekte Firestore + Auth (güvenlik kurallarını UYGULAMAZ) |
| `seed.mjs` | 2 şube, 3 rol (admin / bolge1 / sube1), personel, Ağu–Eki haftaları, ödemeler |
| `calistir.mjs` | Sunucu + sayfa açma yardımcıları; tek başına çalışırsa bir ekran görüntüsü alır |
| `senaryolar.mjs` | Kullanıcı akışları (giriş, çizelge, hafta kapat/onayla, puantaj, yönetim…) |
| `altin.mjs` | Senaryoları çalıştırır, **altın kayıtla karşılaştırır** |
| `altin/*.json` | Kayıtlı beklenen çıktılar (ekran içeriği + yazılan Firestore belgeleri) |

```bash
node test/altin.mjs            # karşılaştır (davranış değişmediyse hepsi ✓)
node test/altin.mjs --kaydet   # kaydı yenile (bilerek davranış değiştirdiysek)
node test/altin.mjs ad1 ad2    # yalnız bu senaryolar
```

Gerekli: `playwright` (Node) ve Chromium. Bir senaryo ya da seed değişince `--kaydet` ile yenilenir.
**Sınır:** Firestore güvenlik kuralları burada sınanmaz; gerçek (test) Firebase projesinde denenir.
