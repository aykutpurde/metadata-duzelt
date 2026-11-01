# Metadata Düzelt

Zotero eklentisi. PDF'ten ya da DOI ile eklenen kayıtlarda, özellikle **Türkçe eserlerde** sık görülen
metadata hatalarını bulur ve **önizlemeli, geri alınabilir** biçimde düzeltir. Tamamen Zotero içinde
JavaScript; ek program gerektirmez, hiçbir veri dışarı gönderilmez.

> **English:** A Zotero plugin that finds and fixes common metadata errors, especially in Turkish
> records: mojibake and broken characters, ALL-CAPS or lowercase titles (Turkish title case per TDK
> rules, with proper `I/ı` and `İ/i` handling), author names with academic titles, and missing or wrong
> language fields. Every change is shown in a preview first and can be undone. Runs entirely inside
> Zotero; nothing is sent anywhere. Install `metadata-duzelt.xpi` from the
> [latest release](https://github.com/aykutpurde/metadata-duzelt/releases/latest).

## Ne düzeltir

| Grup | Örnek | Güven |
|---|---|---|
| Bozuk karakterler | `TÃ¼rkiye → Türkiye`, `ý þ ð → ı ş ğ`, `&amp;lt;`, `ﬁ → fi`, görünmez karakterler, NBSP, çift boşluk, `i̇` artığı (i + U+0307), `Dergi » Makale »` öneki | yüksek |
| Tamamı büyük Türkçe başlık | `TÜRK İDARE HUKUKUNDA KAMU YARARI → Türk İdare Hukukunda Kamu Yararı` | orta |
| Küçük harfli / cümle düzenli Türkçe başlık | `Türk idare hukukunda kamu yararı ve Danıştay → Türk İdare Hukukunda Kamu Yararı ve Danıştay` | orta |
| Tamamı büyük İngilizce başlık | `HUMAN RIGHTS APPROACH TO … → Human rights approach to …` (cümle düzeni) | orta |
| Tamamı büyük dergi / kurum adı | `ANKARA ÜNİVERSİTESİ HUKUK FAKÜLTESİ DERGİSİ → Ankara Üniversitesi Hukuk Fakültesi Dergisi` | orta |
| Dil alanı | boş → `tr`; `tr-TR`, `tur`, `Turkish` → `tr`; Türkçe başlıkta `en` → `tr` | yüksek / orta |
| Yazar adları | `YILMAZ, AHMET → Yılmaz, Ahmet`; `Prof. Dr.`, `Arş. Gör.`, `Av.` silinir; `Soyad, Ad` tek alandan ayrılır; `Yilmaz → Yılmaz` | yüksek / orta |
| Kopuk kelimeler | `hu- kuk → hukuk` (yalnızca Türkçe metinde; `ön- ve son-` korunur) | orta |

Türkçe başlıklarda **TDK kuralı** uygulanır: her kelime büyük harfle başlar; `ve, ile, ya, veya, yahut, ki,
da, de` bağlaçları ile `mı/mi/mu/mü` soru eki küçük kalır (ilk kelime ve iki noktadan sonraki ilk kelime
hep büyük). **Kısaltmalar** (AİHM, TBMM, İYUK…), iç büyük harfli adlar (ChatGPT, e-Devlet), **kesme işaretli
ekler** (`Türkiye'de`, `AİHM'nin`), Roma rakamları, parantez içi kısaltmalar (`(IOI)`), `m.`/`f.`/`v.` gibi atıf
kısaltmaları ve `Islah-ı`, `Şûrâ-yı` gibi izafet ekleri korunur. Başlığın yalnızca bir kısmı TAMAMI BÜYÜK yazılmışsa
(`KAMU MALİ KRİZİ VE YEREL YÖNETİMLER -Yerel…`) o kısım da çevrilir. **İki dilli başlıklarda** (`Türkçe başlık /
English title`, ` - `, `=`, ayraçsız `TÜRKÇE BAŞLIK English title`) yalnızca eserin dilindeki (dil alanı) parça
bırakılır. Sona yapışmış dil etiketleri (`[tr]`) ve başlığın tamamını saran tırnaklar silinir; Türkçe yerelle bozulmuş yabancı başlıklarda
`ı → i` düzeltilir (`Internatıonal → International`); `N-erdal` gibi bozuk görünen yazar adları işaretlenir.
**İki soyadlı yazarlar:** ad alanına düşmüş soyadı (`Cansu Koç` + `Başar`, `Şeyma SAĞDIÇ` + `Güven`) soyadına
taşınır. İşaret ya ad alanındaki BÜYÜK harfli kelimedir ya da kelimenin kütüphanenizde yalnızca soyadı olarak
geçmesidir (sözlük her taramada `creators` tablosundan kurulur; `Nur`, `Can`, `Gül` gibi ikinci adlar taşınmaz).
İngilizce başlıklarda büyük yazılmış `of, the, in, on, a…` küçültülür (ilk kelime ve iki nokta sonrası hariç).
Şapkalı harflere (`zekâ / zeka`) kurallar dokunmaz; kaynakla doğrulamada kaynaktaki yazıma uydurulur. Araçlar › Metadata Düzelt menüsünden **cümle düzeni**
(yalnızca ilk harf büyük) ya da **dokunma** seçilebilir. Küçültme Türkçe yerelle yapılır (`I → ı`, `İ → i`).
Sözlükte olmayan özel adlar ve küçük kalması istenen kelimeler için **istisna listesi** vardır (listedeki
yazım aynen korunur).

Yapmadıkları: diakritiksiz Türkçeyi geri getirme (`Sinav → Sınav`; yalnızca uyarı verir), İngilizce
Title Case başlıkları çevirme (Zotero'nun kendi sağ tık menüsü var).

## Kurulum

[En son sürüm](https://github.com/aykutpurde/metadata-duzelt/releases/latest) sayfasından `metadata-duzelt.xpi`
dosyasını indirin: Zotero › Tools › Plugins › ⚙ › *Install Plugin From File…*. Bir kez kurulduktan sonra
kendiliğinden güncellenir.

## Kullanım

- **Seçili kayıtlar:** sağ tık › **Metadata'yı düzelt…** Önizleme penceresi her alan için *eski → yeni*
  gösterir; satırları tek tek seçip **Seçilenleri uygula** deyin. Onaysız hiçbir şey yazılmaz.
- **Kaynakla doğrula:** önizlemedeki düğme, başlık önerilerini ve şüpheli yazar adlarını özgün kaynakla
  karşılaştırır: bağlı PDF'in ilk sayfaları (Zotero'nun tam metin dizini), DOI varsa CrossRef, DergiPark
  bağlantısı varsa makale sayfası. Karşılaştırma harf düzeninden bağımsızdır (PDF'te başlık genelde büyük
  harflidir); metin aynıysa `✓`, kaynak başka bir başlık/ad gösteriyorsa `≠` ve o satırın seçimi kaldırılır.
  Şapka (â î û) kaynaktaki başlık kaydına (yoksa PDF'e) göre ayarlanır: kaynakta `Zekâ` ise öneri `Zekâ` olur.
  Yazar önerilerinde ad kaynaktan alınır (`Basar → Başar`; PDF'te `Cansu KOÇ BAŞAR` ise soyadı `Koç Başar`);
  kaynaklardan Türkçe harfi en eksiksiz olan seçilir, var olan bir Türkçe harf asla silinmez.
  İnternete çıkılmasın isterseniz `extensions.metadataduzelt.cevrimiciDogrula` ayarını `false` yapın
  (yalnızca PDF'e bakılır).
- **Bütün kütüphane:** Tools › Metadata Düzelt › **Kütüphanede metadata sorunlarını tara…** Özet ve
  toplu önizleme verir; *Zotero'da göster* sorunlu kayıtları seçer.
- **Geri alma:** Tools › Metadata Düzelt › **Son düzeltmeyi geri al**. Her uygulama bir "parti" olarak
  `~/Zotero/metadataduzelt.json` dosyasına yazılır; sonradan elle değiştirilmiş alanlara dokunulmaz.
- **Otomatik mod** (varsayılan kapalı): yeni eklenen kayıtlarda yalnızca yüksek güvenli *karakter*
  kuralları (mojibake, bağlı harf, boşluk, HTML varlığı…) sormadan uygulanır ve geri alınabilir.
  Büyük/küçük harf ve yazar kuralları asla otomatik çalışmaz.
- **İstisna listesi:** Tools › Metadata Düzelt › *İstisna listesini aç*. `~/Zotero/metadataduzelt-istisnalar.txt`,
  her satıra bir kelime/ifade; yazımı aynen korunur.
- **"Metadata" sütunu:** öğe listesinde sütun başlığına sağ tıklayıp açın; kayıt başına öneri sayısı (`⚠ 3`) ya da `✓`.
- **Değişiklik kaydı:** `~/Library/Logs/MetadataDuzelt/zotero.log` (Windows: `%LOCALAPPDATA%\MetadataDuzelt\zotero.log`).

## Geliştirme

```
zotero-eklenti/
  bootstrap.js        Zotero yaşam döngüsü, chrome:// kaydı
  metadataduzelt.js   menüler, sütun, önizleme, yazma, geri alma, otomatik mod
  kurallar/           saf kurallar (Zotero'suz, Node'da çalışır): dil, karakter, tire, harf, yazar, motor, dogrula
  content/            önizleme penceresi (XHTML + JS)
  locale/             tr ve en-US (.ftl)
testler/
  calistir.js         node testler/calistir.js — birim + durum testleri
  durumlar.json       gerçek kütüphaneden türetilmiş durumlar
  olcum-raporu.md     kütüphane ölçümü (hata türleri ve sayıları), ornekler.json
paketleme/xpi_yap.py  python paketleme/xpi_yap.py metadata-duzelt.xpi
```

Kurallar `(metin, bağlam) → { metin, degisiklikler[] }` döndüren UMD modülleridir; `motor.analiz(kayit, ayarlar)`
bir kaydın tüm önerilerini üretir (`guven: yuksek | orta`, `otomatik: bool`).

Sürüm çıkarma: `manifest.json` sürümünü artırın, `vX.Y.Z` etiketi atın; GitHub Actions xpi'yi, `updates.json`'ı ve sürümü üretir.

## Lisans

MIT. Fikir düzeyinde [Linter for Zotero](https://github.com/northword/zotero-format-metadata) (AGPL-3.0)
incelenmiştir; kod alınmamıştır.
