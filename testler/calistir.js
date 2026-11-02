#!/usr/bin/env node
/* Metadata Düzelt — kural testleri. Bağımlılık yok: `node testler/calistir.js`
 *
 * 1) Birim testleri: tek tek kural fonksiyonları.
 * 2) Durum testleri: testler/durumlar.json içindeki kayıtlar motor.analiz'den geçirilir,
 *    beklenen alan değerleri ve "dokunulmamalı" koşulları karşılaştırılır.
 */
"use strict";
const path = require("path");
const fs = require("fs");
const K = path.join(__dirname, "..", "zotero-eklenti", "kurallar");
const dil = require(path.join(K, "dil.js"));
const karakter = require(path.join(K, "karakter.js"));
const tire = require(path.join(K, "tire.js"));
const harf = require(path.join(K, "harf.js"));
const yazar = require(path.join(K, "yazar.js"));
const motor = require(path.join(K, "motor.js"));
const dogrula = require(path.join(K, "dogrula.js"));

let gecti = 0, kaldi = 0;
function esit(ad, alinan, beklenen) {
	let a = JSON.stringify(alinan), b = JSON.stringify(beklenen);
	if (a === b) {
		gecti++;
	}
	else {
		kaldi++;
		console.log(`  ✗ ${ad}\n      beklenen: ${b}\n      alınan:   ${a}`);
	}
}

console.log("Birim testleri");
esit("mojibake tr", karakter.mojibake("TÃ¼rkiye'de Ã§evre hakkÄ± ve ÅŸehir Ä°dare ÄŸ"), "Türkiye'de çevre hakkı ve şehir İdare ğ");
esit("mojibake küçültülmüş", ["İdari Yargılama Usã›L Kanunu'nda", "Kã¼ltã¼r", "Devlet Şã›rası", "KÃœLTÃœR", "USÃ›L", "São Paulo não"].map(karakter.mojibake), ["İdari Yargılama Usûl Kanunu'nda", "Kültür", "Devlet Şûrası", "KÜLTÜR", "USÛL", "São Paulo não"]);
esit("mojibake karışık tırnak", karakter.mojibake("TÃ¼rkiye’de"), "Türkiye’de");
esit("mojibake değil (şapkalı)", karakter.mojibake("YAPAY ZEKÂ KARŞISINDA MÜLÂHAZALAR"), "YAPAY ZEKÂ KARŞISINDA MÜLÂHAZALAR");
esit("eski kod sayfası", karakter.eskiKodSayfasi("Ýdare hukukunda kamu yararý ve þeffaflýk", {}), "İdare hukukunda kamu yararı ve şeffaflık");
esit("eski kod sayfası izlandaca", karakter.eskiKodSayfasi("Þórður Guðmundsson", {}), "Þórður Guðmundsson");
esit("html varlık", karakter.htmlVarliklar("x &amp;lt; 5% &ndash; y &#305; &#x130;"), "x < 5% – y ı İ");
esit("bağlı harf", karakter.bagliHarf("ﬁnd conﬂicts"), "find conflicts");
esit("görünmez", karakter.gorunmez("​​Kirazlı freni­"), "Kirazlı freni");
esit("nfc i̇", karakter.nfc("Görevli̇si̇ İ İ̇"), "Görevlisi İ İ");
esit("boşluk başlık", karakter.bosluk("  Madencilik  Alanında\nBir , Gerek ", { alan: "title" }), "Madencilik Alanında Bir, Gerek");
esit("boşluk özet satırları korur", karakter.bosluk("Abstract\n   \n   Whilst  many", { alan: "abstractNote" }), "Abstract\n\nWhilst many");
esit("dergipark öneki", karakter.dergiparkOneki("Türkiye Adalet Akademisi Dergisi » Makale » GENEL VERİ KORUMA İLKELERİ"), "GENEL VERİ KORUMA İLKELERİ");
esit("saran tırnak", ["'TÜRKİYE’DE ÇALIŞMA HAYATI'", "“Akıllı Anayasa” Üzerine", "“A” ve “B”", "\"Kamu Yararı\"", "‘Yeni’ Bir Bakış"].map(karakter.saranTirnak),
	["TÜRKİYE’DE ÇALIŞMA HAYATI", "“Akıllı Anayasa” Üzerine", "“A” ve “B”", "Kamu Yararı", "‘Yeni’ Bir Bakış"]);
esit("sondaki nokta", karakter.sondakiNokta("Onur kırıcı idari muamele olmaktadır."), "Onur kırıcı idari muamele olmaktadır");
esit("sondaki nokta kısaltma", karakter.sondakiNokta("Karışık notlarım vb."), "Karışık notlarım vb.");
esit("sondaki nokta harf", karakter.sondakiNokta("Ledyayeva v. Rusya, B.N. 53157/99 ve 56850/00."), "Ledyayeva v. Rusya, B.N. 53157/99 ve 56850/00.");
esit("kopuk kelime", tire.kopukKelime("Türk idare hu- kukunda kamu yara- rı", { dil: "tr" }), "Türk idare hukukunda kamu yararı");
esit("askıda tire", tire.kopukKelime("ön- ve son- denetim", { dil: "tr" }), "ön- ve son- denetim");
esit("almanca bileşik", tire.kopukKelime("Gasus Dosier- und Fördertechnik", { dil: "de" }), "Gasus Dosier- und Fördertechnik");
esit("dil tespit tr", dil.tespit("Dünyada Maden Hukukuyla İlgili Yeni Yaklaşımlar").dil, "tr");
esit("dil tespit en", dil.tespit("Human rights approach to environmental protection").dil, "en");
esit("dil tespit de", dil.tespit("Recht und Ordnung der Verwaltung im Staat").dil, "de");
esit("dil tespit kısa", dil.tespit("D13D").dil, null);
esit("dil normalize", ["tr-TR", "TR", "tur", "Turkish", "eng", "English", "en_US", "en-GB", "EN", 'scheme="ISO639-1"', "de", "tr,en"].map(dil.normalize), ["tr", "tr", "tr", "tr", "en", "en", "en-US", "en-GB", "en", null, "de", "tr"]);
esit("tamamı büyük", harf.tamamiBuyuk("TÜRK İDARE HUKUKUNDA KAMU YARARI"), true);
esit("tamamı büyük Türkçe harfler", harf.tamamiBuyuk("DANIŞTAY 8. DAİRE E. 2014/2609"), true);
esit("tamamı büyük künye", harf.tamamiBuyuk("D13D, E. 2018/1891, K. 2018/2650, T. 28.9.2018"), false);
esit("tamamı büyük kısa", harf.tamamiBuyuk("YÜHFD"), false);
esit("title case gibi", harf.titleCaseGibi("Türkiye Madencilik Sektörü İçin Bir Politika Çerçevesi"), true);
esit("title case değil", harf.titleCaseGibi("Çevre Hukukuna Giriş"), false);
esit("title case değil 2", harf.titleCaseGibi("Türk idare hukukunda kamu yararı"), false);
esit("cümle düzeni tr", harf.cumleDuzeni("TÜRK İDARE HUKUKUNDA KAMU YARARI", { dil: "tr" }), "Türk idare hukukunda kamu yararı");
esit("cümle düzeni kesme", harf.cumleDuzeni("KARL RENNER’İN GÖRÜŞLERİ VE TÜRKİYE'DE AİHM'NİN ROLÜ", { dil: "tr" }), "Karl Renner’in görüşleri ve Türkiye'de AİHM'nin rolü");
esit("cümle düzeni iki nokta", harf.cumleDuzeni("YAPAY ZEKÂNIN ANAYASASI: “AKILLI ANAYASA” ÜZERİNE", { dil: "tr" }), "Yapay zekânın anayasası: “Akıllı Anayasa” üzerine");
esit("cümle düzeni romen+kısaltma", harf.cumleDuzeni("AİHM KARARLARI IŞIĞINDA II. MEŞRUTİYET DÖNEMİNDE DANIŞTAY VE AB HUKUKU", { dil: "tr" }), "AİHM kararları ışığında II. Meşrutiyet döneminde Danıştay ve AB hukuku");
esit("cümle düzeni sayılı kanun", harf.cumleDuzeni("7343 Sayılı Kanun İle İhalenin Feshi (İİK M.134)", { dil: "tr" }), "7343 sayılı Kanun ile ihalenin feshi (İİK M.134)");
esit("cümle düzeni istisna", harf.cumleDuzeni("ÇAMLICA KÖYLÜLERİNİN HUKUK ZAFERİ", { dil: "tr", istisnalar: ["Çamlıca"] }), "Çamlıca köylülerinin hukuk zaferi");
esit("cümle düzeni tire alt başlık", harf.cumleDuzeni("Sağlıklı Bir Çevrede Yaşama Hakkı – Çevreye Bir Kamu Hukuku Yaklaşımı", { dil: "tr" }), "Sağlıklı bir çevrede yaşama hakkı – Çevreye bir kamu hukuku yaklaşımı");
esit("cümle düzeni en", harf.cumleDuzeni("HUMAN RIGHTS APPROACH TO ENVIRONMENTAL PROTECTION IN THE EU AND TURKEY", { dil: "en" }), "Human rights approach to environmental protection in the EU and Turkey");
esit("İngilizce küçük kelime kenar durumları", ["Administrative Law Values V: Substantive Review", "(23) The LLM Is Not the Product", "The In Dubio Pro Natura Principle: An Attempt of A Comprehensive Legal Reconstruction"].map(harf.ingilizceKucukKelimeler),
	["Administrative Law Values V: Substantive Review", "(23) The LLM Is Not the Product", "The In Dubio Pro Natura Principle: An Attempt of a Comprehensive Legal Reconstruction"]);
esit("İngilizce the/and/vs.", harf.ingilizceKucukKelimeler("Legal Challenges And Opportunities In Regulating Free And Open Source Software Within The European Union: Smith Vs. Jones"),
	"Legal Challenges and Opportunities in Regulating Free and Open Source Software Within the European Union: Smith vs. Jones");
esit("cümle düzeni en iç büyük korunur", harf.cumleDuzeni("Using ChatGPT in eHealth: A Study", { dil: "en" }), "Using ChatGPT in eHealth: A study");
esit("başlık düzeni TDK cümle→her kelime", harf.baslikDuzeni("Türk idare hukukunda kamu yararı kavramı ve Danıştay içtihadı", { dil: "tr" }), "Türk İdare Hukukunda Kamu Yararı Kavramı ve Danıştay İçtihadı");
esit("başlık düzeni TDK tamamı büyük", harf.baslikDuzeni("KARL RENNER’İN GÖRÜŞLERİ VE TÜRKİYE'DE AİHM'NİN ROLÜ", { dil: "tr" }), "Karl Renner’in Görüşleri ve Türkiye'de AİHM'nin Rolü");
esit("başlık düzeni TDK iki nokta", harf.baslikDuzeni("Yapay zekânın anayasası: “akıllı anayasa” üzerine mülâhazalar", { dil: "tr" }), "Yapay Zekânın Anayasası: “Akıllı Anayasa” Üzerine Mülâhazalar");
esit("başlık düzeni TDK bağlaçlar", harf.baslikDuzeni("Suç ve ceza mı, ya devlet başa ya kuzgun leşe: ben de yazdım", { dil: "tr" }), "Suç ve Ceza mı, ya Devlet Başa ya Kuzgun Leşe: Ben de Yazdım");
esit("başlık düzeni TDK ile/sayılı", harf.baslikDuzeni("7343 Sayılı Kanun İle İhalenin Feshi (İİK M.134)", { dil: "tr" }), "7343 Sayılı Kanun ile İhalenin Feshi (İİK M.134)");
esit("başlık düzeni TDK künye dokunma", harf.baslikDuzeni("Ledyayeva v. Rusya, B.N. 53157/99 ve 56850/00", { dil: "tr" }), "Ledyayeva v. Rusya, B.N. 53157/99 ve 56850/00");
esit("başlık düzeni TDK iç büyük/tire", harf.baslikDuzeni("Sosyo-ekonomik haklar, e-Devlet ve e-imza: ChatGPT ile McDonald’s davası", { dil: "tr" }), "Sosyo-Ekonomik Haklar, e-Devlet ve e-İmza: ChatGPT ile McDonald’s Davası");
esit("başlık düzeni TDK zaten doğru", harf.baslikDuzeni("Çevre Hakkı Kavramı ve Avrupa İnsan Hakları Mahkemesi'nin Çevre Hakkına Yaklaşımı", { dil: "tr" }), "Çevre Hakkı Kavramı ve Avrupa İnsan Hakları Mahkemesi'nin Çevre Hakkına Yaklaşımı");
esit("başlık düzeni istisna küçük kalır", harf.baslikDuzeni("Kamu yararı için bir model", { dil: "tr", istisnalar: ["için"] }), "Kamu Yararı için Bir Model");
esit("başlık düzeni TDK sıra sayısı sonrası", harf.baslikDuzeni("İYUK’un 3. ve 5. maddesi bağlamında", { dil: "tr" }), "İYUK’un 3. ve 5. Maddesi Bağlamında");
esit("cümle düzeni sıra sayısı sonrası", harf.cumleDuzeni("İYUK’UN 3. VE 5. MADDESİ BAĞLAMINDA DEĞERLENDİRMELER", { dil: "tr" }), "İYUK’un 3. ve 5. maddesi bağlamında değerlendirmeler");
esit("başlık düzeni TDK parantez kısaltma", harf.baslikDuzeni("ULUSLARARASI OMBUDSMANLIK ENSTİTÜSÜ (IOI) İÇ TÜZÜKLERİ (TCK m. 194)", { dil: "tr" }), "Uluslararası Ombudsmanlık Enstitüsü (IOI) İç Tüzükleri (TCK m. 194)");
esit("başlık düzeni TDK yabancı kesme", harf.baslikDuzeni("Danıştay ve Conseil d’Etat içtihatları: O’Brien davası", { dil: "tr" }), "Danıştay ve Conseil d’Etat İçtihatları: O’Brien Davası");
esit("başlık düzeni TDK izafet", harf.baslikDuzeni("Islah-ı sanayi komisyonu ve Kanun-ı Esasi", { dil: "tr" }), "Islah-ı Sanayi Komisyonu ve Kanun-ı Esasi");
esit("başlık düzeni TDK İngilizce künye dokunma", harf.baslikDuzeni("Case of Big Brother Watch and Others v. Birleşik Krallık, No.58170/13", { dil: "tr" }), "Case of Big Brother Watch and Others v. Birleşik Krallık, No.58170/13");
esit("başlık düzeni dergi", harf.baslikDuzeni("ANKARA ÜNİVERSİTESİ HUKUK FAKÜLTESİ DERGİSİ", { dil: "tr" }), "Ankara Üniversitesi Hukuk Fakültesi Dergisi");
esit("başlık düzeni T.C.", harf.baslikDuzeni("T.C. ANAYASA MAHKEMESİ", { dil: "tr" }), "T.C. Anayasa Mahkemesi");
esit("başlık düzeni en", harf.baslikDuzeni("JOURNAL OF THE HISTORY OF IDEAS AND LAW", { dil: "en" }), "Journal of the History of Ideas and Law");
esit("unvan sil", ["Prof. Dr. Ahmet", "Dr A", "Arş Gör Ayla", "Av Müslüm", "Yrd. Doç. Dr. Ali", "Ahmet, PhD", "Dr.Ahmet", "Fraser", "Peel", "Drake", "Avni", "Msomi"].map(yazar.unvanSil), ["Ahmet", "A", "Ayla", "Müslüm", "Ali", "Ahmet", "Ahmet", "Fraser", "Peel", "Drake", "Avni", "Msomi"]);
esit("baş harf tr", yazar.basHarf("YILMAZ", "tr"), "Yılmaz");
esit("baş harf parçacık", yazar.basHarf("VON BOGDANDY", "en-US"), "von Bogdandy");
esit("baş harf tireli", yazar.basHarf("ALİ-RIZA", "tr"), "Ali-Rıza");
esit("baş harf kısaltma korunur", yazar.basHarf("H.Ş. ŞEBNEM J.B.", "tr"), "H.Ş. Şebnem J.B.");
esit("tamamı büyük yazar", [yazar.tamamiBuyuk("J.B."), yazar.tamamiBuyuk("SC"), yazar.tamamiBuyuk("MUSTAFA"), yazar.tamamiBuyuk("A.Ş")], [false, false, true, false]);
esit("diakritik", yazar.diakritik("Hasan Yilmaz Hatipoglu"), "Hasan Yılmaz Hatipoğlu");
esit("kişi gibi", [yazar.kisiGibi("Ahmet Yılmaz"), yazar.kisiGibi("Muğla Büyükşehir Belediyesi"), yazar.kisiGibi("TESEV")], [true, false, false]);
esit("doğrula kat", dogrula.kat("İÇTİHADÎ mi, Olmalı?"), dogrula.kat("içtihadi mi olmali"));
esit("doğrula kesit", dogrula.kesit("Başlık\nYrd. Doç. Dr. N. Erdal FANİD\nÖZET", "Fanid", 12), "…N. Erdal FANİD ÖZET");
esit("doğrula yazar CrossRef aynı", dogrula.degerlendir({ alan: "creators", guven: "orta", yeniYazar: { firstName: "H. Şebnem", lastName: "Düzgün" } }, { yazarlar: [{ kaynak: "CrossRef", tam: "H.Şebnem DÜZGÜN" }] }).durum, "dogrulandi");
esit("doğrula meta", dogrula.metaOku('<meta name="citation_title" content="Mültecilerin Temel Hak &amp; Özgürlükleri"><meta content="Ahmet Yılmaz" name="citation_author"><meta name="DC.Title" content="Mültecilerin Temel Hak &amp; Özgürlükleri">'),
	{ basliklar: ["Mültecilerin Temel Hak & Özgürlükleri"], yazarlar: ["Ahmet Yılmaz"] });
esit("doğrula crossref", dogrula.crossrefOku({ title: ["A <i>study</i>"], author: [{ given: "N. Erdal", family: "Fanid" }] }), { basliklar: ["A study"], yazarlar: ["N. Erdal Fanid"], adSoyad: [{ ad: "N. Erdal", soyad: "Fanid" }] });
esit("doğrula DOI", [dogrula.doiBul({ DOI: "10.1234/abc.5" }), dogrula.doiBul({ extra: "DOI: 10.5555/x-y." }), dogrula.doiBul({ url: "https://doi.org/10.33629/auhfd.1234" }), dogrula.doiBul({})],
	["10.1234/abc.5", "10.5555/x-y", "10.33629/auhfd.1234", null]);
esit("kısa başlık", ["Yeni Bir Dönemin Başlangıcı: Avrupa Yeşil Mutabakatı", "\"Yetki Genişliği\" İlkesi Üzerine Bir İnceleme", "Çevre Hakkı", "Hukuk mu Siyaset mi? Bir İnceleme",
	"Avrupa Birliği SIGMA (Support for Improvement in Governance) Programı", "Sağlıklı ve Dengeli Bir Çevrede Yaşama Hakkı – Çevreye Bir Yaklaşım"].map((t) => harf.kisaBaslik(t)),
	["Yeni Bir Dönemin Başlangıcı", "\"Yetki Genişliği\" İlkesi Üzerine", "Çevre Hakkı", "Hukuk mu Siyaset mi?", "Avrupa Birliği SIGMA", "Sağlıklı ve Dengeli"]);
esit("kısa başlık kesik", ["Yeni Bir Dönemin Başlang", "Yeni Bir Dönemin", "Yeni Bir…", "Başka"].map((k) => harf.kisaBaslikKesik(k, "Yeni Bir Dönemin Başlangıcı")), [true, false, true, false]);
esit("kısaltma açılımı", [dil.acilimMi("Sıgma", "Support for Improvement in Governance and Management"), dil.acilimMi("TAIEX", "Technical Assistance and Information Exchange"), dil.acilimMi("Programı", "Support for Improvement in Governance and Management")], [true, true, false]);
esit("başlıkta not", karakter.notParantez("Kamusal Malların Ölçütü (amme, künye yok)"), "Kamusal Malların Ölçütü");
esit("başlıkta not değil", ["Kamu Yararı (Kontrol Mekanizmaları)", "İdare Hukuku (Genel Esaslar)"].map(karakter.notParantez), ["Kamu Yararı (Kontrol Mekanizmaları)", "İdare Hukuku (Genel Esaslar)"]);
esit("başlık düzeni v. / Roma rakamı V", ["Mıaılhe V. Fransa Kararı", "Anayasa ve İdare Hukukundan Kesitler V"].map((t) => harf.baslikDuzeni(t, { dil: "tr" })), ["Mıaılhe v. Fransa Kararı", "Anayasa ve İdare Hukukundan Kesitler V"]);
esit("yazım şüphesi", ["ARTTIRILAMAMASF’ Kuralını", "Orantılılk İlkesi", "Teklifl erinin", "Türk Halk Reform Konsept Atatürk İnanç Modern", "HUMK TBMM ChatGPT 20.7.1999"].map(harf.yazimSupheli),
	[["ARTTIRILAMAMASF"], ["Orantılılk"], ["Teklifl"], [], []]);
esit("PDF kodlaması", ["MADENCĠLĠK FAALĠYETLERĠ", "Ġdari Vesayet GörevlendirilmiĢ", "Atđna Đle Đstanbul", "Đorđević i Šešelj"].map((x) => karakter.pdfKodlama(x, { dil: "tr" })),
	["MADENCİLİK FAALİYETLERİ", "İdari Vesayet Görevlendirilmiş", "Atina İle İstanbul", "Đorđević i Šešelj"]);
esit("küçük başlayan ad", yazar.kucukBasla("ali Fuat de la Cruz", "tr"), "Ali Fuat de la Cruz");
esit("PDF son kelime sınırı", [dogrula.pdfEslesme("İHAM PERSPEKTİFİ\nAhmet", "ihamperspektif"), dogrula.pdfEslesme("İHAM PERSPEKTİF\nAhmet", "ihamperspektif"), dogrula.pdfEslesme("BİR ANALİZYrd. Doç.", "biranaliz")],
	[{ tam: false, devam: "İ" }, { tam: true }, { tam: false, devam: null }]);
{
	let satir = { alan: "title", eski: "KAMU GÖREVLİLERİYLE İLGİLİ İDARİ DAVALARDA ADİL YARGILANMA HAKKININ UYGULANABİLİRLİĞİ Pellegrin’den 1999 Baka’ya 2016 İHAM Perspektif",
		yeni: "Kamu Görevlileriyle İlgili İdari Davalarda Adil Yargılanma Hakkının Uygulanabilirliği Pellegrin’den 1999 Baka’ya 2016 İHAM Perspektif" };
	let pdf = "KAMU GÖREVLİLERİYLE İLGİLİ İDARİ DAVALARDA ADİL YARGILANMA\nHAKKININ UYGULANABİLİRLİĞİ: PELLEGRIN’DEN 1999 BAKA’YA 2016 İHAM PERSPEKTİFİ\nAhmet Yılmaz*";
	esit("doğrula başlık PDF'te son kelime eksik (DergiPark da eksik)", dogrula.degerlendir(satir, { pdf, basliklar: [{ kaynak: "DergiPark", metin: satir.eski }] }).yeniOneri, satir.yeni + "i");
}
{
	let pdf = "Hukuk Dergisi Cilt 3\nMÜLTECİLERİN TEMEL HAK VE ÖZGÜRLÜKLERİNİN KORUN-\nMASI: TÜRK VE ETİYOPYA MÜLTECİ HUKUKU BAKIMINDAN KARŞILAŞTIRMALI BİR ANALİZ\nYrd. Doç. Dr. N. Erdal FANİD";
	let baslik = { alan: "title", eski: "MÜLTECİLERİN … ANALİZ [tr]", yeni: "Mültecilerin Temel Hak ve Özgürlüklerinin Korunması: Türk ve Etiyopya Mülteci Hukuku Bakımından Karşılaştırmalı Bir Analiz" };
	esit("doğrula başlık PDF'te", dogrula.degerlendir(baslik, { pdf }).durum, "dogrulandi");
	esit("doğrula başlık farklı", dogrula.degerlendir(baslik, { basliklar: [{ kaynak: "CrossRef", metin: "Başka Bir Başlık" }] }).durum, "farkli");
	esit("doğrula başlık kaynak yok", dogrula.degerlendir(baslik, {}).durum, "kaynakYok");
	let yazar = { alan: "creators", guven: "orta", yeniYazar: { firstName: "N-erdal", lastName: "Fanid" } };
	esit("doğrula yazar PDF'te başka biçim", dogrula.degerlendir(yazar, { pdf }).durum, "farkli");
	esit("doğrula yazar PDF'te aynı", dogrula.degerlendir({ ...yazar, yeniYazar: { firstName: "N. Erdal", lastName: "Fanid" } }, { pdf }).durum, "dogrulandi");
	esit("doğrula yazar DergiPark aynı ama PDF farklı (YYDKAATG)", dogrula.degerlendir(yazar, { pdf: "İRAN’IN İDARİ TEŞKİLAT SİTEMİ Nematollah AGHABALAEI FANID1 ÖZ: …", yazarlar: [{ kaynak: "DergiPark", tam: "Yrd. Doç. Dr. N-erdal Fanid" }] }).durum, "farkli");
	esit("doğrula yazar CrossRef farklı", dogrula.degerlendir(yazar, { yazarlar: [{ kaynak: "CrossRef", tam: "N. Erdal Fanid" }] }).mesaj, "Kaynakta başka biçim — CrossRef: N. Erdal Fanid");
	esit("şapka kaynaktan eklenir", dogrula.sapkaUyumla("Yapay Zeka ile Hukuk", ["YAPAY ZEKÂ İLE HUKUK"]), "Yapay Zekâ ile Hukuk");
	esit("şapka kaynakta yoksa kalkar", dogrula.sapkaUyumla("Yapay Zekâ ve İçtihadî Mülâhazalar", ["Yapay Zeka ve İçtihadi Mülahazalar"]), "Yapay Zeka ve İçtihadi Mülahazalar");
	esit("şapka aynıysa öneri yok", dogrula.sapkaUyumla("Yapay Zeka ile İlgili", ["Yapay zeka ile ilgili"]), null);
	esit("şapka doğrulama sonucunda", dogrula.degerlendir({ alan: "title", eski: "x", yeni: "Yapay Zeka Çağında Hukuk" }, { basliklar: [{ kaynak: "DergiPark", metin: "Yapay Zekâ Çağında Hukuk" }] }).yeniOneri, "Yapay Zekâ Çağında Hukuk");
	esit("doğrula tırnak kaynakta da var", dogrula.degerlendir({ alan: "title", eski: "“Hiçbir Yasa Birden Çok Konu İçermemelidir”", yeni: "Hiçbir Yasa Birden Çok Konu İçermemelidir" }, { basliklar: [{ kaynak: "DergiPark", metin: "“Hiçbir Yasa Birden Çok Konu İçermemelidir”" }] }).durum, "farkli");
	esit("doğrula tırnak kaynakta yok", dogrula.degerlendir({ alan: "title", eski: "'Kamu Yararı'", yeni: "Kamu Yararı" }, { basliklar: [{ kaynak: "DergiPark", metin: "KAMU YARARI" }] }).durum, "dogrulandi");
	esit("ad kaynaktan: harfler", dogrula.adiKaynaktanAl({ firstName: "Cansu", lastName: "Koç Basar" }, { yazarlar: [{ kaynak: "DergiPark", tam: "Cansu Koç Başar" }] }), { firstName: "Cansu", lastName: "Koç Başar" });
	esit("ad kaynaktan: PDF büyük harfli soyadı", dogrula.adiKaynaktanAl({ firstName: "Cansu Koc", lastName: "Basar" }, { yazarlar: [], pdf: "Araştırma Makalesi\nCansu KOÇ BAŞAR*\nÖZ" }), { firstName: "Cansu", lastName: "Koç Başar" });
	esit("ad kaynaktan: CrossRef ayrımı", dogrula.adiKaynaktanAl({ firstName: "Ezgi Turgut", lastName: "Bilgic" }, { yazarlar: [], adSoyad: [{ ad: "Ezgi", soyad: "Turgut Bilgiç" }] }), { firstName: "Ezgi", lastName: "Turgut Bilgiç" });
	esit("ad kaynaktan: diakritiksiz kaynak, PDF doğru (ALGA985W)", dogrula.adiKaynaktanAl({ firstName: "Cansu", lastName: "Koç Basar" }, { yazarlar: [{ kaynak: "DergiPark", tam: "Cansu Koc Basar" }], pdf: "Serkan Ekiz1 Cansu Koç Başar2* 1 Dr." }), { firstName: "Cansu", lastName: "Koç Başar" });
	esit("ad kaynaktan: diakritik hiç silinmez", dogrula.adiKaynaktanAl({ firstName: "Cansu", lastName: "Koç Basar" }, { yazarlar: [{ kaynak: "DergiPark", tam: "Cansu Koc Basar" }] }), null);
	esit("ad kaynaktan: aynıysa öneri yok", dogrula.adiKaynaktanAl({ firstName: "N-erdal", lastName: "Fanid" }, { yazarlar: [{ kaynak: "DergiPark", tam: "Yrd. Doç. Dr. N-erdal Fanid" }] }), null);
	esit("doğrula dil satırı yok", dogrula.degerlendir({ alan: "language", eski: "", yeni: "tr" }, { pdf }), null);
}

console.log("Durum testleri (testler/durumlar.json)");
let durumlar = JSON.parse(fs.readFileSync(path.join(__dirname, "durumlar.json"), "utf8"));
for (let d of durumlar) {
	let ayarlar = { ...(d.ayarlar || {}) };
	if (ayarlar.sozlukKisiler) {
		ayarlar.adSozluk = yazar.sozlukKur(ayarlar.sozlukKisiler);
	}
	if (ayarlar.sozlukMetinler) {
		ayarlar.kelimeSozluk = dil.kelimeSozlukKur(ayarlar.sozlukMetinler);
	}
	let r = motor.analiz(d.kayit, ayarlar);
	let yeni = {};
	for (let o of r.oneriler) {
		if (o.alan == "creators") {
			yeni["creator" + o.indeks] = o.yeniYazar;
		}
		else {
			yeni[o.alan] = o.yeni;
		}
	}
	if (d.bekle) {
		for (let [alan, deger] of Object.entries(d.bekle)) {
			esit(`${d.ad} › ${alan}`, yeni[alan], deger);
		}
	}
	for (let alan of d.dokunma || []) {
		esit(`${d.ad} › ${alan} dokunulmamalı`, yeni[alan], undefined);
	}
	if (d.oneriYok) {
		esit(`${d.ad} › öneri yok`, r.oneriler.map((o) => o.alan), []);
	}
	if (d.otomatik !== undefined) {
		esit(`${d.ad} › otomatik`, r.oneriler.filter((o) => o.otomatik).map((o) => o.alan), d.otomatik);
	}
	if (d.uyari !== undefined) {
		esit(`${d.ad} › uyarı sayısı`, r.uyarilar.length, d.uyari);
	}
	for (let [alan, kurallar] of Object.entries(d.kurallar || {})) {
		let o = r.oneriler.find((x) => x.alan == alan);
		esit(`${d.ad} › ${alan} kuralları`, o ? o.kurallar.map((k) => k.kural) : [], kurallar);
	}
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
