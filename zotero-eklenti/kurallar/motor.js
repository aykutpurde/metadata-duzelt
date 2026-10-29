/* Metadata Düzelt — kural motoru (saf; Zotero'ya bağımlı değil).
 *
 * analiz(kayit, ayarlar) → { dil, oneriler, uyarilar }
 *   kayit:   { itemType, fields: { title, language, … }, creators: [{ firstName, lastName, fieldMode, creatorType }] }
 *   ayarlar: { stil: "baslik"|"cumle"|"dokunma" (Türkçe başlık düzeni), titleCaseDonustur: bool (yalnızca "cumle"), istisnalar: string[]|Map }
 *   oneri:   { alan, eski, yeni, kurallar: [{kural, aciklama, guven}], aciklama, guven: "yuksek"|"orta", otomatik: bool,
 *              (yazar için) indeks, eskiYazar, yeniYazar }
 *   "otomatik": yalnızca yüksek güvenli karakter temizlikleri; otomatik modda sorulmadan uygulanır.
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory(require("./dil.js"), require("./karakter.js"), require("./tire.js"), require("./harf.js"), require("./yazar.js"));
	}
	else {
		let K = root.MetadataDuzeltKurallar;
		K.motor = factory(K.dil, K.karakter, K.tire, K.harf, K.yazar);
	}
})(this, function (dil, karakter, tire, harf, yazar) {
	"use strict";

	const METIN_ALANLARI = ["title", "shortTitle", "bookTitle", "proceedingsTitle", "encyclopediaTitle", "dictionaryTitle",
		"publicationTitle", "series", "seriesTitle", "publisher", "university", "institution", "websiteTitle", "blogTitle",
		"forumTitle", "place", "court", "reporter", "conferenceName", "meetingName", "journalAbbreviation", "abstractNote"];
	const OTOMATIK_GRUP = /^karakter\.(nfc|mojibake|eskiKodSayfasi|htmlVarliklar|bagliHarf|gorunmez|bosluk|dergiparkOneki)$|^yazar\.temizle$/;

	function yazarMetni(y) {
		if (y.fieldMode == 1) {
			return `[${y.lastName}]`;
		}
		return `[${y.lastName}] [${y.firstName}]`;
	}

	function guvenBirlestir(kurallar) {
		return kurallar.some((k) => k.guven == "orta") ? "orta" : "yuksek";
	}

	function oneriYap(alan, eski, yeni, kurallar, ek = {}) {
		return {
			alan, eski, yeni, kurallar,
			aciklama: kurallar.map((k) => k.aciklama).join("; "),
			guven: guvenBirlestir(kurallar),
			otomatik: kurallar.every((k) => k.guven == "yuksek" && OTOMATIK_GRUP.test(k.kural)),
			...ek,
		};
	}

	/** Dil alanı + başlıktan etkin dili bulur; gerekiyorsa dil alanı için öneri üretir. */
	function dilBelirle(fields, oneriler) {
		let ham = fields.language || "";
		let norm = dil.normalize(ham);
		// tespit, karakter temizliğinden geçmiş başlık üzerinde (mojibake'li metin dil göstermez)
		let baslik = [fields.title, fields.shortTitle, fields.bookTitle].filter(Boolean)
			.map((b) => karakter.uygula(b, { alan: "title" }).metin).join(" ");
		let t = dil.tespit(baslik);
		if (!t.dil && fields.abstractNote) {
			t = dil.tespit(fields.abstractNote.slice(0, 600));
			if (t.guven == "yuksek") {
				t.guven = "orta";  // özet başka dilde olabilir
			}
		}
		let etkin = norm ? norm.split("-")[0] : null;
		if (!ham.trim()) {
			if (t.dil && t.guven == "yuksek") {
				oneriler.push(oneriYap("language", ham, t.dil, [{ kural: "dil.bos", aciklama: "Dil alanı boştu; metinden tespit edildi", guven: "yuksek" }]));
				etkin = t.dil;
			}
			else {
				etkin = t.dil;
			}
		}
		else if (!norm) {
			if (t.dil && t.guven == "yuksek") {
				oneriler.push(oneriYap("language", ham, t.dil, [{ kural: "dil.bozuk", aciklama: "Dil alanı tanınmadı; metinden tespit edildi", guven: "orta" }]));
				etkin = t.dil;
			}
		}
		else if (etkin == "tr" && t.dil && t.dil != "tr" && t.guven == "yuksek") {
			oneriler.push(oneriYap("language", ham, t.dil, [{ kural: "dil.yanlis", aciklama: `Dil alanı “${ham}” ama başlık Türkçe görünmüyor`, guven: "orta" }]));
			etkin = t.dil;
		}
		else if (etkin == "tr" && norm != "tr") {
			oneriler.push(oneriYap("language", ham, "tr", [{ kural: "dil.normalize", aciklama: `“${ham}” → “tr”`, guven: "yuksek" }]));
		}
		else if (etkin != "tr" && t.dil == "tr" && t.guven == "yuksek") {
			oneriler.push(oneriYap("language", ham, "tr", [{ kural: "dil.yanlis", aciklama: "Başlık Türkçe görünüyor", guven: "orta" }]));
			etkin = "tr";
		}
		else if (norm != ham) {
			oneriler.push(oneriYap("language", ham, norm, [{ kural: "dil.normalize", aciklama: `“${ham}” → “${norm}”`, guven: "yuksek" }]));
		}
		return etkin;
	}

	function analiz(kayit, ayarlar = {}) {
		let fields = kayit.fields || {};
		let oneriler = [];
		let uyarilar = [];
		let d = dilBelirle(fields, oneriler);
		let baglamTemel = { dil: d, stil: ayarlar.stil || "baslik", titleCaseDonustur: ayarlar.titleCaseDonustur !== false, istisnalar: ayarlar.istisnalar || [] };

		for (let alan of METIN_ALANLARI) {
			let eski = fields[alan];
			if (typeof eski != "string" || !eski) {
				continue;
			}
			let baglam = { ...baglamTemel, alan };
			let kurallar = [];
			let r = karakter.uygula(eski, baglam);
			kurallar.push(...r.degisiklikler);
			let s = r.metin;
			if (d == "tr" && alan != "abstractNote") {
				r = tire.uygula(s, baglam);
				kurallar.push(...r.degisiklikler);
				s = r.metin;
			}
			if (alan != "abstractNote" && alan != "journalAbbreviation") {
				r = harf.uygula(s, baglam);
				kurallar.push(...r.degisiklikler);
				s = r.metin;
			}
			if (s != eski) {
				oneriler.push(oneriYap(alan, eski, s, kurallar));
			}
			if (alan == "title" && /i̇/.test(eski)) {
				uyarilar.push({ alan, mesaj: "Başlık yanlış yerelle küçültülmüş (i̇ artığı): “ı” olması gereken “i”ler elle kontrol edilmeli (Alımında, Sınav, Yargısal…)" });
			}
		}

		let y = yazar.uygula(kayit.creators || [], baglamTemel);
		for (let dg of y.degisiklikler) {
			oneriler.push(oneriYap("creators", yazarMetni(dg.eski), yazarMetni(dg.yeni), dg.kurallar, { indeks: dg.indeks, eskiYazar: dg.eski, yeniYazar: dg.yeni }));
		}
		for (let u of y.uyarilar) {
			uyarilar.push({ alan: "creators", indeks: u.indeks, mesaj: u.mesaj });
		}
		return { dil: d, oneriler, uyarilar };
	}

	return { analiz, METIN_ALANLARI, yazarMetni };
});
