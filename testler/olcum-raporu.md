# Ölçüm raporu — kütüphanedeki metadata hataları

Tarih: 2026-10-28 · Kaynak: `~/Zotero/zotero.sqlite`'ın scratchpad'e alınmış **salt okunur kopyası** (orijinale yazılmadı).
Betik: Python, bağımlılıksız. Örnekler itemKey ile `ornekler.json` dosyasında.

## Kapsam

| | Sayı |
|---|---|
| Düzenli kayıt (ek, not, açıklama hariç; çöp hariç) | 3870 |
| Türkçe aday (dil alanı tr/tur/Türkçe, ya da başlıkta ğşıİ, ya da DergiPark DOI/URL, ya da 2+ sık Türkçe kelime) | 2453 |

Türkçe aday sezgisi DergiPark DOI'si yüzünden 99 İngilizce makaleyi de kapsadı (`dil_en_dergipark`). Ders: **dil tespiti metinden yapılmalı**, DOI/dergi ipucu tek başına yetmez.

## Hata türleri (çoktan aza)

| Tür | Sayı | Not |
|---|---|---|
| Türkçe başlık Title Case | 1419 | En büyük grup. Çoğu DergiPark/Crossref kaynaklı. Cümle düzenine çevirmek özel ad sözlüğü ister; güven "orta". |
| Türkçe kayıtta dil alanı boş | 1054 | Metinden tespitle `tr` yazılabilir; güven "yüksek" (ğşıİ varsa). |
| Türkçe başlık tamamen BÜYÜK | 721 | Crossref/DergiPark'tan geliyor. Cümle düzenine çevrilir; kısaltma + özel ad sözlüğü gerekir. |
| Dil alanı biçimi (`tr-TR`, `TR`, `tur`, `Turkish`) | 71 | `tr` olarak normalize. |
| Çift soyadı (Sarıbeyoğlu Skalar) | 53 | Meşru, dokunulmaz. Kuralların bunu bozmaması test edilmeli. |
| `i̇` artığı (i + U+0307) | 52 | Title Case'in yanlış yerelle yapılması: `Görevli̇si̇`, ayrıca aynı kayıtlarda `Aliminda`, `Sinav`, `Yargisal` (I→i yerine I→ı olmalıydı). `i̇→i` temizliği güvenli; `i→ı` geri kazanımı sözlük ister, v1'de yalnızca uyarı. |
| Boşluk sorunları | 31 | Çift boşluk, baş/son boşluk, özetlerde satır sonu artıkları. Güvenli. |
| Diakritiksiz Türkçe soyadı | 17 | `Yilmaz`, `Yildiz`. Küçük bir soyadı sözlüğüyle "orta" güvenle düzeltilebilir. |
| Küçük harfle başlayan ad | 14 | 13'ü meşru parçacık (von, de, van den); 1'i çöp (`madenci`). Dokunulmaz. |
| NBSP | 13 | Özetlerde. Güvenli. |
| HTML varlıkları | 12 | `&amp;lt;`, `&ndash;`, `[footnote-short-crop]`. Çift kodlanmış olabilir; sabitlenene dek çöz. |
| Türkçe başlık ama dil `en` | 12 | Metinden tespit `tr` der; "orta" güven (kullanıcı görsün). |
| Tire + boşluk | 12 | **Hepsi meşru** Almanca/Fince bileşik (`Dosier- und`, `Friedhofs- und`). Türkçede kopuk kelime bulunmadı. Kural çok muhafazakâr olmalı: yalnızca Türkçe metinde, sağ taraf küçük harfle başlıyor ve bağlaç değilse. |
| Bağlı harf (ﬁ ﬂ) | 11 | Özetlerde. Güvenli. |
| Dergi/yayıncı adı tamamen büyük | 9 | `CLIMATE CHANGE LITIGATION`, `T.C. ANAYASA MAHKEMESİ`; ama `İSOD`, `YÜHFD`, `MDPI`, `OECD` kısaltma. Kural: yalnızca 2+ uzun kelime varsa. |
| Yazarda unvan | 8 | `Dr Murat Aydo`, `Arş Gör Ayla Çalişkan`, `Av Müslüm Fincan`. Nokta olmadan da geliyor. |
| Görünmez karakter | 4 | Başlık başında 7 adet U+200B. |
| Başlık sonunda nokta | 3 | Zotero geleneği: nokta yok. Kısaltma/sayı ile bitiyorsa dokunma. |
| İngilizce başlık tamamen büyük | 2 | İngilizce cümle düzeni kuralı. |
| Tek alana `Soyad, Ad` | 2 | `Yılmaz Turgut, Nükhet` → ayır. |
| DergiPark sayfa başlığı öneki | 1 | `Türkiye Adalet Akademisi Dergisi » Makale » GENEL VERİ…` → son `»` öncesini at. |
| **Mojibake (Ã¼, Ä±…)** | **0** | İlk sayım 145 demişti; hepsi `zekâ`, `mülâhaza` gibi şapkalı meşru harflerdi. Kural yine yazılır (DOI içe aktarımında sık görülür) ama tetikleyici Türkçe'ye özgü ikililer (`Ã¼ Ã§ Ä± ÅŸ Ä° ÄŸ`) olmalı, tek `Â` asla. |
| Eski kod sayfası (ý þ ð) | 0 | Kural yazılır, tetiklenmedi. |

## Dil alanı dağılımı (tüm kayıtlar)

boş 1846 · tr 1217 · en 635 · tr-TR 64 · de 53 · eng 16 · en-US 13 · en-GB 5 · `scheme="ISO639-1"` 5 (bozuk) · tur 3 · Turkish 3 · en_US 2 · English 2 · diğer tekil.

## Kurallara etkisi

1. **Karakter kuralları** (mojibake, kod sayfası, HTML, bağlı harf, görünmez, boşluk, NFC, `i̇`, `»` öneki): güven yüksek, otomatik moda uygun.
2. **Dil**: metinden tespit + normalize. Boş alana yazma yüksek güven; `en`→`tr` değişikliği orta.
3. **Harf**: tamamen büyük → cümle düzeni (orta); Title Case → cümle düzeni (orta, tercihle kapatılabilir); dergi adı büyük → Title Case (orta). Kısaltma listesi ve özel ad sözlüğü şart; kesme işaretli kelime (`Türkiye'de`, `Renner'in`) özel ad sayılır.
4. **Yazar**: unvan sil (yüksek), tamamı büyük → baş harf (yüksek, tr yereli), `Soyad, Ad` ayır (orta), diakritiksiz soyadı sözlüğü (orta). Çift soyadı ve parçacıklara dokunma.
5. **Tire**: yalnızca Türkçe metinde ve sağ taraf bağlaç değilse (orta).
6. **`I→ı` geri kazanımı**: kapsam dışı; yalnızca uyarı.
