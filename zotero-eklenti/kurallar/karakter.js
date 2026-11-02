/* Metadata Düzelt — karakter kuralları (saf fonksiyonlar).
 *
 * uygula(metin, baglam) → { metin, degisiklikler: [{ kural, aciklama, guven }] }
 * baglam: { alan: "title"|"abstractNote"|…, dil: "tr"|"en"|…|null }
 *
 * Kurallar: mojibake (UTF-8'in Latin-1/CP1252 okunması), eski Türkçe kod sayfası (ý þ ð),
 * PDF yazı tipi kodlaması (Ġ đ Ģ → İ i ş), HTML varlıkları, bağlı harfler (ﬁ ﬂ), görünmez karakterler, NFC + "i̇" artığı, boşluklar,
 * DergiPark sayfa başlığı öneki ("Dergi » Makale » …"), başlık sonundaki nokta.
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory(require("./dil.js"));
	}
	else {
		root.MetadataDuzeltKurallar = root.MetadataDuzeltKurallar || {};
		root.MetadataDuzeltKurallar.karakter = factory(root.MetadataDuzeltKurallar.dil);
	}
})(this, function (dil) {
	"use strict";

	// CP1252'de 0x80–0x9F aralığı (Latin-1'de kontrol karakteri)
	const CP1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";
	const CP1252_TERS = new Map();
	for (let i = 0; i < CP1252.length; i++) {
		CP1252_TERS.set(CP1252[i], 0x80 + i);
	}
	// Türkçe metinde mojibake'nin tipik ikilileri: ü ç ö ı ş İ ğ Ç Ü Ö Ş Ğ â î û Â Î Û ve tırnaklar
	const MOJI_TETIK = /Ã[¼§¶‡œ–¢®»‚Ž›]|Ä[°±Ÿž]|Å[Ÿž]|â€[™œ\u009d“”¦“]/;
	const MOJI_ADAY = /[ÃÄÅâ][\u0080-ÿ -⃿ŒœŠšŸŽžƒˆ˜™]/;

	function utf8Coz(parca) {
		let bytes = new Uint8Array(parca.length);
		for (let i = 0; i < parca.length; i++) {
			let c = parca.charCodeAt(i);
			if (c < 0x100) {
				bytes[i] = c;
			}
			else if (CP1252_TERS.has(parca[i])) {
				bytes[i] = CP1252_TERS.get(parca[i]);
			}
			else {
				return null;
			}
		}
		try {
			return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		}
		catch (e) {
			return null;
		}
	}

	// mojibake dizisi: Ã/Ä/Å/â + ikinci bayt (Latin-1 üst yarısı ya da CP1252 simgeleri); art arda gelebilir
	const MOJI_DIZI = /(?:[ÃÄÅâ][\u00a0-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2018-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u2122\u20ac](?:[\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2018-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u2122\u20ac])?)+/g;

	// Mojibake'li metin sonradan küçültülmüş: "USÃ›L" → "Usã›L" (Ã → ã; "›" sonrası "L" kelime başı sanılmış)
	const MOJI_KUCUK = /(\p{L})([ãäå])([\u00a0-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2018-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u2122\u20ac])(\p{L}?)/gu;
	const TR_HARF = /^[üçöışİğÇÜÖŞĞâîûÂÎÛ]$/;

	/** "Ã¼" → "ü": yalnızca Türkçeye özgü ikililer görülünce, dizi dizi ve doğrulamalı.
	 *  Küçültülmüş biçim ("Usã›L" → "Usûl") yalnızca çözülen harf Türkçe harfse; harf büyüklüğü kelimeye uydurulur. */
	function mojibake(metin) {
		let s = metin;
		if (MOJI_TETIK.test(s)) {
			s = s.replace(MOJI_DIZI, (p) => {
				let c = utf8Coz(p);
				return c && /\p{L}|[’“”–—…]/u.test(c) && !/[\u0080-\u009f\ufffd]/.test(c) ? c : p;
			});
		}
		return s.replace(MOJI_KUCUK, (tum, once, bas, ikinci, sonra) => {
			let c = utf8Coz({ "ã": "Ã", "ä": "Ä", "å": "Å" }[bas] + ikinci);
			if (!c || !TR_HARF.test(c)) {
				return tum;
			}
			let kucukMu = (x) => !!x && x !== x.toLocaleUpperCase("tr");
			// kelime küçük harfle sürüyorsa ("Usã›L", "Şã›rası") çözülen harf ve "›" sonrası büyütülmüş harf küçülür
			if (kucukMu(once)) {
				return once + c.toLocaleLowerCase("tr") + sonra.toLocaleLowerCase("tr");
			}
			return once + (kucukMu(sonra) ? c.toLocaleLowerCase("tr") : c) + sonra;
		});
	}

	const ESKI_KOD = { "ý": "ı", "þ": "ş", "ð": "ğ", "Ý": "İ", "Þ": "Ş", "Ð": "Ğ" };

	/** ISO-8859-9/CP1254 metnin Latin-1 okunması: ý→ı þ→ş ð→ğ. Yalnızca sonuç Türkçe görünüyorsa. */
	function eskiKodSayfasi(metin, baglam) {
		if (!/[ýþðÝÞÐ]/.test(metin)) {
			return metin;
		}
		let yeni = metin.replace(/[ýþðÝÞÐ]/g, (c) => ESKI_KOD[c]);
		if (baglam.dil == "tr") {
			return yeni;
		}
		// Dil bilinmiyorsa harf sayısı yetmez (İzlandaca da ý/þ/ð kullanır): Türkçe kelime/ek kanıtı aranır
		let t = dil.tespit(yeni);
		let kelimeKaniti = dil.kelimeler(yeni).filter((w) => dil.SIK.tr.includes(w) || /(ında|inde|ları|leri|lık|lik|ması|mesi)$/.test(w)).length;
		if (t.dil == "tr" && kelimeKaniti >= 1) {
			return yeni;
		}
		return metin;
	}

	// PDF'ten kopyalanmış Türkçe metinde yazı tipi kodlaması: "MADENCĠLĠK", "DANIġTAY", "BirleĢmiĢ", "Türkđye"
	const PDF_KOD = { "Ġ": "i", "Đ": "i", "đ": "i", "ġ": "ş", "Ģ": "ş" };

	/** Ġ/Đ/đ → İ/i, ġ/Ģ → Ş/ş. Büyüklük çevreden: kelime başında ya da büyük harfler arasında büyük.
	 *  Yalnızca metin Türkçe görünüyorsa; Hırvatça (ć č š ž) metne dokunulmaz ("Đorđević"). */
	function pdfKodlama(metin, baglam) {
		if (!/[ĠĐđġĢ]/.test(metin) || /[ćčšžĆČŠŽ]/.test(metin)) {
			return metin;
		}
		let harf = (c) => !!c && /\p{L}/u.test(c);
		let buyuk = (c) => harf(c) && c !== c.toLocaleLowerCase("tr");
		let yeni = metin.replace(/[ĠĐđġĢ]/g, (c, i, s) => {
			let once = s[i - 1], sonra = s[i + 1];
			let up = !harf(once) || (buyuk(once) && (!harf(sonra) || buyuk(sonra) || /[ĠĐĢ]/.test(sonra)));
			return up ? PDF_KOD[c].toLocaleUpperCase("tr") : PDF_KOD[c];
		});
		return baglam.dil == "tr" || dil.tespit(yeni).dil == "tr" ? yeni : metin;
	}

	const VARLIK = {
		amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
		lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", shy: "", middot: "·", bull: "•",
		copy: "©", reg: "®", trade: "™", deg: "°", sect: "§", para: "¶", times: "×", euro: "€", pound: "£",
		Ccedil: "Ç", ccedil: "ç", Ouml: "Ö", ouml: "ö", Uuml: "Ü", uuml: "ü", Icirc: "Î", icirc: "î", Acirc: "Â", acirc: "â",
		Ucirc: "Û", ucirc: "û", eacute: "é", Eacute: "É", agrave: "à", egrave: "è", auml: "ä", Auml: "Ä", szlig: "ß",
	};

	/** &amp; &#305; &ndash; … → karakter. Çift kodlanmış olabilir: sabitlenene dek (en çok 3 kez). */
	function htmlVarliklar(metin) {
		let s = metin;
		for (let i = 0; i < 3; i++) {
			let y = s.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z]{2,8});/g, (m, k) => {
				if (k[0] == "#") {
					let n = k[1] == "x" || k[1] == "X" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
					return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
				}
				return k in VARLIK ? VARLIK[k] : m;
			});
			if (y == s) {
				break;
			}
			s = y;
		}
		return s;
	}

	const LIGATUR = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "ft", "ﬆ": "st" };

	function bagliHarf(metin) {
		return metin.replace(/[ﬀ-ﬆ]/g, (c) => LIGATUR[c] || c);
	}

	/** Yumuşak tire, sıfır genişlikli boşluk, BOM silinir; NBSP ve ince boşluklar normal boşluk olur. */
	function gorunmez(metin) {
		return metin
			.replace(/[­​‌‍⁠﻿]/g, "")
			.replace(/[   -  　]/g, " ");
	}

	/** NFC'ye getir; Türkçe küçültmeden kalan "i̇" (i + U+0307) artığını "i" yap. */
	function nfc(metin) {
		return metin.normalize("NFC").replace(/i̇/g, "i").replace(/İ̇/g, "İ");
	}

	const SESLI_ART = /[aıou]/, SESLI_ON = /[eiöü]/;

	/** Yanlış yerelle küçültülmüş metin ("Mücavi̇r Alan Kavrami", "Aliminda"): "İ" küçülünce "i̇" artığı bırakır,
	 *  "I" ise düz "i" olur. Metinde artık varsa düz "i"ler büyük olasılıkla "I"dan gelmiştir; ses uyumu kalın
	 *  (önceki ünlü a/ı/o/u; kelime başındaysa sonraki ünlü) olanlar "ı" yapılır. İnce bağlamdaki "i"ye dokunulmaz
	 *  ("AİHM'nin", "ilkeleri" gibi zaten küçük yazılmış kelimeler bozulmasın); metinde doğru "ı" varsa hiç dokunulmaz.
	 *  Artık bu adımdan sonra nfc'de temizlenir. */
	function yerelI(metin, baglam = {}) {
		// metinde doğru "ı" varsa kaynak tamamı büyük değildi (karışık metin: "Biyokütle" bozulmasın)
		if (!/i̇/.test(metin) || /ı/.test(metin) || (baglam.dil && baglam.dil != "tr")) {
			return metin;
		}
		return metin.replace(/[\p{L}\u0307]+/gu, (w) => {
			let h = [...w];
			let cikti = [];
			for (let j = 0; j < h.length; j++) {
				let c = h[j];
				if (c == "\u0307") {
					cikti.push(c);
					continue;
				}
				if (c != "i" || h[j + 1] == "\u0307") {
					cikti.push(c);
					continue;
				}
				// önceki ünlü (artıklı i̇ ince sayılır); yoksa sonraki ilk ünlü
				let onceki = null;
				for (let k = cikti.length - 1; k >= 0 && !onceki; k--) {
					let x = cikti[k].toLowerCase();
					if (SESLI_ART.test(x) || SESLI_ON.test(x)) {
						onceki = x;
					}
				}
				let sonraki = null;
				for (let k = j + 1; k < h.length && !onceki && !sonraki; k++) {
					let x = h[k].toLowerCase();
					if (SESLI_ART.test(x) || (SESLI_ON.test(x) && !(x == "i" && h[k + 1] != "\u0307"))) {
						sonraki = x;
					}
				}
				let kalin = SESLI_ART.test(onceki || sonraki || "");
				cikti.push(kalin ? "ı" : c);
			}
			return cikti.join("");
		});
	}

	/** "Frameworks:Case studies" → "Frameworks: Case studies"; "Öneri:birlikte" → "Öneri: birlikte".
	 *  İki tarafta da en az iki harf olmalı (saat, DOI, URL, "e:" etkilenmez); "Māori:non-Māori" gibi aynı kelimeyi
	 *  içeren bileşiklere dokunulmaz. */
	function ikiNokta(metin) {
		return metin.replace(/(\p{L}{2,})([:;])(?=(\p{L}{2}[^\s]*))/gu, (m, sol, isaret, sag) =>
			sag.toLowerCase().includes(sol.toLowerCase()) ? m : `${sol}${isaret} `);
	}

	/** Çift boşluk, baş/son boşluk; başlık alanlarında satır sonları boşluk olur; ", " öncesi boşluk kalkar. */
	function bosluk(metin, baglam) {
		let s = metin;
		if (baglam.alan != "abstractNote" && baglam.alan != "extra" && baglam.alan != "note") {
			s = s.replace(/[\r\n\t]+/g, " ");
		}
		else {
			s = s.replace(/[ \t]*\r?\n[ \t]*/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ");
		}
		s = s.replace(/ {2,}/g, " ").replace(/ +([,;:!?])(?=\s|$)/g, "$1").replace(/,(?=\p{L})/gu, ", ").trim();
		return s;
	}

	/** "Türkiye Adalet Akademisi Dergisi » Makale » GERÇEK BAŞLIK" → "GERÇEK BAŞLIK" (DergiPark sayfa başlığı). */
	function dergiparkOneki(metin) {
		let m = metin.match(/^(?:[^»]{2,80}\s»\s)+(.{10,})$/);
		return m ? m[1].trim() : metin;
	}

	const SARAN_TIRNAK = [["'", "'"], ['"', '"'], ["“", "”"], ["‘", "’"], ["«", "»"], ["„", "“"], ["”", "”"], ["’", "’"]];

	/** Başlığın tamamını saran tırnak: "'TÜRKİYE’DE … MEVCUDİYETİ'" → "TÜRKİYE’DE … MEVCUDİYETİ".
	 *  İçeride aynı tırnak geçiyorsa ("“A” ve “B”") dokunulmaz. */
	function saranTirnak(metin) {
		let s = metin.trim();
		for (let [ac, kapa] of SARAN_TIRNAK) {
			if (s.length > 2 && s.startsWith(ac) && s.endsWith(kapa)) {
				let ic = s.slice(ac.length, -kapa.length);
				if (!ic.includes(ac) && !ic.includes(kapa) && /\p{L}/u.test(ic)) {
					return ic.trim();
				}
			}
		}
		return metin;
	}

	/** Başlığın başında kapanmamış tırnak: "'türk Kamu Yönetiminde …" → "türk Kamu Yönetiminde …".
	 *  Tek tırnakta (' ‘) ardından küçük harf gelmeli: kapanışı kesmeyle karışır ("‘Kentsel Yeşil Alan’ın" alıntıdır),
	 *  küçük harf ise bozuk içe aktarmanın izidir. Çift tırnakta (" “) metinde ikinci bir tırnak olmamalı
	 *  ("Anayasa'ya Uygunluk Denetimi"nde: tırnak ekten önce kapanır). */
	function basTirnak(metin) {
		let ac = metin[0], geri = metin.slice(1);
		if ((ac == "'" || ac == "‘") && /^\p{Ll}/u.test(geri)) {
			return geri;
		}
		if ((ac == '"' || ac == "“") && /^\p{L}/u.test(geri) && !/["“”]/.test(geri)) {
			return geri;
		}
		return metin;
	}

	const DIL_ETIKETI = /\s*[\[(](?:tr|tur|en|eng|de|deu|ger|fr|fra|fre|türkçe|turkish|english|ingilizce)[\])]\s*$/i;

	/** Başlık sonuna yapışmış dil etiketi: "… BİR ANALİZ [tr]", "… (en)". */
	function dilEtiketi(metin) {
		return metin.replace(DIL_ETIKETI, "") || metin;
	}

	// Başlığa düşmüş kişisel not: "Kamusal Malların Ölçütü (amme, künye yok)", "… [pdf yok]", "… (kontrol et)"
	const NOT_PARANTEZ = /\s*[\[(][^\[\]()]*(?<!\p{L})(?:künye\s*(?:yok|eksik|bulunamadı|bilinmiyor)|künyesiz|eksik\s*künye|kaynak\s*yok|pdf\s*yok|tam\s*metin\s*yok|kontrol\s*(?:et|edil\p{L}*)|bakılacak|okunacak|tarih\s*yok|yıl\s*yok|sayfa\s*yok|todo|citation\s*missing|no\s*citation)(?!\p{L})[^\[\]()]*[\])]/giu;

	/** Başlıktaki not parantezleri: ["(amme, künye yok)"]. Motor bunları uyarı olarak gösterir (not kaybolmasın). */
	function notlar(metin) {
		return (metin.match(NOT_PARANTEZ) || []).map((x) => x.trim());
	}

	/** Başlıktaki not parantezini atar: "Kamusal Malların Ölçütü (amme, künye yok)" → "Kamusal Malların Ölçütü". */
	function notParantez(metin) {
		return metin.replace(NOT_PARANTEZ, "").trim() || metin;
	}

	const KISALTMA_SONU = /(?<!\p{L})(?:vs|vb|vd|bkz|krş|etc|al|Inc|Ltd|Jr|Sr|Co|No|Nr|St|Bd|Vol|Cilt|Sayı|pp)\.$/iu;
	const TEK_HARF_SONU = /(?<!\p{L})(?:\p{Lu}|\p{N}+)\.$/u;   // "A.", "B.N.", "2018."

	/** Başlık sonundaki noktayı kaldırır (Zotero geleneği); kısaltma, harf veya sayıyla bitiyorsa dokunmaz. */
	function sondakiNokta(metin) {
		let s = metin.trimEnd();
		if (!s.endsWith(".") || s.endsWith("...") || s.endsWith("…") || KISALTMA_SONU.test(s) || TEK_HARF_SONU.test(s)) {
			return metin;
		}
		return s.slice(0, -1).trimEnd();
	}

	const BASLIK_ALANLARI = new Set(["title", "shortTitle", "bookTitle", "proceedingsTitle", "encyclopediaTitle", "dictionaryTitle"]);

	function uygula(metin, baglam = {}) {
		let degisiklikler = [];
		if (typeof metin != "string" || !metin) {
			return { metin, degisiklikler };
		}
		let s = metin;
		let adim = (ad, aciklama, fn, guven = "yuksek") => {
			let y = fn(s);
			if (y != s) {
				degisiklikler.push({ kural: "karakter." + ad, aciklama, guven });
				s = y;
			}
		};
		adim("yerelI", "Yanlış yerelle küçültülmüş metin: “I”dan gelen “i”ler “ı” yapıldı (Kavrami → Kavramı)", (x) => yerelI(x, baglam), "orta");
		adim("nfc", "Birleşik karakterler NFC'ye getirildi / i̇ artığı temizlendi", nfc);
		adim("mojibake", "Bozuk kodlama (mojibake) düzeltildi", mojibake);
		adim("eskiKodSayfasi", "Eski Türkçe kod sayfası harfleri (ý þ ð) düzeltildi", (x) => eskiKodSayfasi(x, baglam));
		adim("pdfKodlama", "PDF yazı tipi kodlaması düzeltildi (Ġ đ Ģ → İ i ş)", (x) => pdfKodlama(x, baglam), "orta");
		adim("htmlVarliklar", "HTML varlıkları (&amp; &#305; …) çözüldü", htmlVarliklar);
		adim("bagliHarf", "Bağlı harfler (ﬁ ﬂ) ayrıldı", bagliHarf);
		adim("gorunmez", "Görünmez karakterler / kırılmaz boşluklar temizlendi", gorunmez);
		if (BASLIK_ALANLARI.has(baglam.alan)) {
			adim("dergiparkOneki", "Sayfa başlığı öneki (“Dergi » Makale »”) atıldı", dergiparkOneki);
			if (baglam.alan != "shortTitle") {   // kısa başlık çoğunlukla "“Alıntı”: alt başlık"ın alıntı kısmıdır
				adim("saranTirnak", "Başlığın tamamını saran tırnak işaretleri kaldırıldı", saranTirnak, "orta");
				adim("basTirnak", "Başlığın başındaki kapanmamış tırnak kaldırıldı", basTirnak, "orta");
			}
			adim("dilEtiketi", "Başlık sonundaki dil etiketi ([tr], (en) …) atıldı; özgün başlıkla karşılaştırın", dilEtiketi, "orta");
			adim("notParantez", "Başlığa yazılmış not (“künye yok” …) atıldı", notParantez, "orta");
		}
		adim("bosluk", "Fazla boşluk / satır sonu temizlendi", (x) => bosluk(x, baglam));
		if (baglam.alan != "abstractNote") {
			adim("ikiNokta", "İki nokta / noktalı virgülden sonra eksik boşluk eklendi", ikiNokta);
		}
		if (BASLIK_ALANLARI.has(baglam.alan)) {
			adim("sondakiNokta", "Başlık sonundaki nokta kaldırıldı", sondakiNokta, "orta");
		}
		return { metin: s, degisiklikler };
	}

	return { uygula, yerelI, ikiNokta, basTirnak, pdfKodlama, saranTirnak, dilEtiketi, notParantez, notlar, mojibake, eskiKodSayfasi, htmlVarliklar, bagliHarf, gorunmez, nfc, bosluk, dergiparkOneki, sondakiNokta, BASLIK_ALANLARI };
});
