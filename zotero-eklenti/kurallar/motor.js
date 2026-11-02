/* Metadata Düzelt — kural motoru (saf; Zotero'ya bağımlı değil).
 *
 * analiz(kayit, ayarlar) → { dil, oneriler, uyarilar }
 *   kayit:   { itemType, fields: { title, language, … }, creators: [{ firstName, lastName, fieldMode, creatorType }],
 *              alanlar?: türün geçerli alan adları (boş alanlar fields'ta yok; kısa başlık ancak türde varsa üretilir) }
 *   ayarlar: { stil: "baslik"|"cumle"|"dokunma" (Türkçe başlık düzeni), titleCaseDonustur: bool (yalnızca "cumle"), istisnalar: string[]|Map,
 *              adSozluk: yazar.sozlukKur(…), kelimeSozluk: dil.kelimeSozlukKur(kütüphanedeki başlık/özetler) }
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
		// iki dilli başlıkta dil alanı parçalardan birinin diliyse alana güvenilir
		if (etkin && t.dil != etkin && dil.parcalar(baslik).some((p) => p.dil == etkin)) {
			t = { dil: etkin, guven: "yuksek" };
		}
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

	/** Kısa başlık boşsa ya da kelime ortasında kesikse ("Yeni Bir Dönemin Başlang") düzeltilmiş başlıktan üretilir.
	 *  Elle yazılmış, kelime sınırında biten kısa başlığa dokunulmaz. Boş kısa başlık ancak türün alan listesi
	 *  (kayit.alanlar) verilmiş ve türde shortTitle varsa doldurulur. */
	function kisaBaslikOner(kayit, fields, oneriler) {
		let baslik = (oneriler.find((o) => o.alan == "title") || {}).yeni || fields.title;
		if (!baslik) {
			return;
		}
		let ki = oneriler.findIndex((o) => o.alan == "shortTitle");
		let simdiki = ki >= 0 ? oneriler[ki].yeni : (fields.shortTitle || "");
		let kural = !simdiki.trim() && (kayit.alanlar || []).includes("shortTitle")
			? { kural: "harf.kisaBaslikBos", aciklama: "Kısa başlık boştu; başlıktan üretildi (ana başlık, en çok 4 kelime)", guven: "orta" }
			: harf.kisaBaslikKesik(simdiki, baslik)
				? { kural: "harf.kisaBaslikKesik", aciklama: "Kısa başlık kelime ortasında kesilmişti; başlıktan yeniden üretildi (ana başlık, en çok 4 kelime)", guven: "orta" }
				: null;     // boş ama türde kısa başlık yok (ya da alan listesi bilinmiyor): üretilmez
		let yeni = kural && harf.kisaBaslik(baslik);
		if (!yeni || yeni == (fields.shortTitle || "")) {
			return;
		}
		let o = oneriYap("shortTitle", fields.shortTitle || "", yeni, [...(ki >= 0 ? oneriler[ki].kurallar : []), kural]);
		if (ki >= 0) {
			oneriler[ki] = o;
		}
		else {
			oneriler.push(o);
		}
	}

	/** Kelime kelime kütüphane sözlüğüne bakar (dil.eksikHarfKelime). Kısaltmalara, iç büyük harfli kelimelere ve
	 *  kullanıcı istisnalarına dokunmaz. → { metin, kelimeler: ["Kavrami → Kavramı", …] } */
	function eksikHarf(metin, baglam, eski) {
		// başlıkta hiç geçmeyen harf eksik sayılır; yanlış yerelle küçültülmüş metinde (i̇ artığı) "ı" her zaman
		let izinli = new Set([..."ışçğöü"].filter((h) => !eski.includes(h) && (h == "ı" || !eski.includes(dil.buyult(h, "tr")))));
		if (/i̇/.test(eski)) {
			izinli.add("ı");
		}
		if (!izinli.size) {
			return { metin, kelimeler: [] };
		}
		let istisna = new Set([...(baglam.istisnalar instanceof Map ? baglam.istisnalar.values() : baglam.istisnalar || [])].map((x) => dil.kucult(String(x), "tr")));
		let kelimeler = [];
		let y = metin.replace(/\p{L}+/gu, (w) => {
			if (harf.KISALTMALAR.has(w) || /\p{Lu}/u.test(w.slice(1)) || istisna.has(dil.kucult(w, "tr"))) {
				return w;
			}
			let z = dil.eksikHarfKelime(w, baglam.kelimeSozluk, izinli);
			if (z && z != w) {
				kelimeler.push(`${w} → ${z}`);
				return z;
			}
			return w;
		});
		return { metin: y, kelimeler };
	}

	function analiz(kayit, ayarlar = {}) {
		let fields = kayit.fields || {};
		let oneriler = [];
		let uyarilar = [];
		let d = dilBelirle(fields, oneriler);
		let baglamTemel = { dil: d, stil: ayarlar.stil || "baslik", titleCaseDonustur: ayarlar.titleCaseDonustur !== false, istisnalar: ayarlar.istisnalar || [], adSozluk: ayarlar.adSozluk || null, kelimeSozluk: ayarlar.kelimeSozluk || null };

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
			if (alan == "title" && d) {
				let ps = dil.parcalar(s);
				let diller = new Set(ps.map((p) => p.dil).filter(Boolean));
				if (diller.size >= 2 && diller.has(d)) {
					let kalan = ps.filter((p) => p.dil == d);
					let atilan = ps.filter((p) => p.dil != d).map((p) => p.metin).join(" / ");
					s = kalan.map((p, i) => (i ? p.ayirac + p.metin + (p.son || "") : p.metin)).join("");
					kurallar.push({ kural: "dil.ikiDilliBaslik", aciklama: `İki dilli başlık: eser dilindeki (${d}) kısım bırakıldı; atılan: “${atilan}”`, guven: "orta" });
				}
				else if (diller.size >= 2) {
					uyarilar.push({ alan, mesaj: `Başlık birden çok dilde görünüyor (${[...diller].join(", ")}); eserin dili belirlenemedi, elle bakılmalı` });
				}
			}
			if (alan != "abstractNote") {
				let y = dil.sahteIDuzelt(s);
				if (y != s) {
					kurallar.push({ kural: "karakter.sahteI", aciklama: "Yabancı dildeki kelimelerde Türkçe yerelden kalan ı → i düzeltildi (Internatıonal → International)", guven: "orta" });
					s = y;
				}
			}
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
			if (d == "tr" && alan != "abstractNote" && alan != "journalAbbreviation" && baglam.kelimeSozluk) {
				let y = eksikHarf(s, baglam, eski);
				if (y.metin != s) {
					kurallar.push({ kural: "harf.eksikHarf", aciklama: `Kaybolmuş Türkçe harf kütüphanedeki yazımdan tamamlandı (${y.kelimeler.join(", ")})`, guven: "orta" });
					s = y.metin;
				}
			}
			if (s != eski) {
				oneriler.push(oneriYap(alan, eski, s, kurallar));
			}
			if (alan == "title" && d == "tr" && harf.yazimSupheli(s).length) {
				uyarilar.push({ alan, mesaj: `Olası yazım hatası: ${harf.yazimSupheli(s).map((w) => `“${w}”`).join(", ")} (Türkçe kelime böyle bitmez; özgün kaynaktan kontrol edin)` });
			}
			if (alan == "title" && d == "tr" && s.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length >= 5 && !/[çğıöşüÇĞİÖŞÜâîû]/.test(s)) {
				uyarilar.push({ alan, mesaj: "Türkçe başlıkta hiç Türkçe harf (ı ş ç ğ ö ü İ) yok: harfler kaybolmuş olabilir, özgün kaynaktan kontrol edin" });
			}
			if (alan == "title" && karakter.notlar(eski).length) {
				uyarilar.push({ alan, mesaj: `Başlıktaki not atıldı: ${karakter.notlar(eski).join(" ")} — künye eksikse kütüphanedeki kopyalara ya da kaynağa bakın; notu gerekirse Not/Extra alanına taşıyın` });
			}
			if (alan == "title" && /i̇/.test(eski) && !kurallar.some((k) => k.kural == "karakter.yerelI")) {
				uyarilar.push({ alan, mesaj: "Başlık yanlış yerelle küçültülmüş (i̇ artığı): “ı” olması gereken “i”ler elle kontrol edilmeli (Alımında, Sınav, Yargısal…)" });
			}
		}

		kisaBaslikOner(kayit, fields, oneriler);

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
