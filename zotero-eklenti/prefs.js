// Yeni eklenen kayıtlarda yalnızca güvenli kuralları (karakter temizliği) sormadan uygula
pref("extensions.metadataduzelt.otomatik", false);
// Başlık düzeni (Türkçe ve İngilizce): "baslik" (Her Kelime Büyük; TDK / Title Case, bağlaçlar küçük) | "cumle" (cümle düzeni) | "dokunma"
pref("extensions.metadataduzelt.baslikStili", "baslik");
// Yalnızca "cumle" düzeninde: Her Kelimesi Büyük Türkçe başlıkları da cümle düzenine çevir
pref("extensions.metadataduzelt.titleCaseDonustur", true);
// "Kaynakla doğrula": PDF'e ek olarak CrossRef (DOI) ve DergiPark makale sayfasına da bakılsın
pref("extensions.metadataduzelt.cevrimiciDogrula", true);
