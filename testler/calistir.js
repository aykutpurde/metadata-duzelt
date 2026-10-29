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
esit("dil normalize", ["tr-TR", "TR", "tur", "Turkish", "eng", "English", "en_US", "en-GB", "EN", 'scheme="ISO639-1"', "de"].map(dil.normalize), ["tr", "tr", "tr", "tr", "en", "en", "en-US", "en-GB", "en", null, "de"]);
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

console.log("Durum testleri (testler/durumlar.json)");
let durumlar = JSON.parse(fs.readFileSync(path.join(__dirname, "durumlar.json"), "utf8"));
for (let d of durumlar) {
	let r = motor.analiz(d.kayit, d.ayarlar || {});
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
