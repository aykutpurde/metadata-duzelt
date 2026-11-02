/* Metadata Düzelt — tire kuralları (saf fonksiyonlar).
 *
 * uygula(metin, baglam) → { metin, degisiklikler }
 *
 * PDF'ten gelen satır sonu tireleri: "hu- kuk" → "hukuk". Yalnızca Türkçe metinde; sağ taraf
 * bağlaçsa ("ön- ve son-", "Dosier- und") ya da büyük harfle başlıyorsa dokunulmaz.
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory(require("./dil.js"));
	}
	else {
		root.MetadataDuzeltKurallar = root.MetadataDuzeltKurallar || {};
		root.MetadataDuzeltKurallar.tire = factory(root.MetadataDuzeltKurallar.dil);
	}
})(this, function (dil) {
	"use strict";

	const BAGLAC = new Set("ve veya ya yahut ile de da und oder or and et ou e y o i a".split(" "));

	function kopukKelime(metin, baglam) {
		let d = baglam.dil || dil.tespit(metin).dil;
		if (d != "tr" || metin.indexOf("- ") < 0) {
			return metin;
		}
		let tokens = metin.split(/(\s+)/);
		let onceki = null;  // bir önceki kelime (küçük harfli)
		for (let i = 0; i < tokens.length; i++) {
			let tok = tokens[i];
			if (!tok || /^\s+$/.test(tok)) {
				continue;
			}
			let sonraki = tokens[i + 2];
			if (/^\p{Ll}{2,}-$/u.test(tok) && sonraki && /^\p{Ll}{2,}[^\p{L}]*$/u.test(sonraki)
					&& !BAGLAC.has(sonraki.replace(/[^\p{L}]/gu, "")) && !BAGLAC.has(onceki)) {
				// "hu- kuk" → "hukuk"; "ön- ve son- denetim" (askıda tire) korunur
				tokens[i] = tok.slice(0, -1) + sonraki;
				tokens[i + 1] = "";
				tokens[i + 2] = "";
				onceki = null;
				i += 2;
				continue;
			}
			onceki = tok.replace(/[^\p{L}]/gu, "").toLocaleLowerCase("tr");
		}
		return tokens.join("");
	}

	/** Boşlukla kopmuş Osmanlıca izafet eki: "Kanun - i Esasi" / "Kanun -i Esasi" / "Şura- yı Devlet" → "Kanun-i Esasi".
	 *  Ek tek başına bir kelime olamayacağı için (i, ı, u, ü, yi, yı, yu, yü) ara tire sayılmaz; harf kuralı eki küçük tutar. */
	function izafet(metin) {
		return metin.replace(/(\p{L})(?:\s+[-–]\s*|\s*[-–]\s+)([yY]?[ıiuüIİUÜ])(?=\s+\p{L})/gu, "$1-$2");
	}

	/** Kelime arası " - " yerine uzun tire (–) kullanılır (başlık – alt başlık). */
	function araTire(metin) {
		return metin.replace(/(\p{L}|\d|[)\]”’"]) - (?=\p{L}|\d|[(\[“‘"])/gu, "$1 – ");
	}

	function uygula(metin, baglam = {}) {
		let degisiklikler = [];
		if (typeof metin != "string" || !metin) {
			return { metin, degisiklikler };
		}
		let s = metin;
		let y = izafet(s);
		if (y != s) {
			degisiklikler.push({ kural: "tire.izafet", aciklama: "Boşlukla kopmuş izafet eki birleştirildi (Kanun - i Esasi → Kanun-i Esasi)", guven: "orta" });
			s = y;
		}
		y = kopukKelime(s, baglam);
		if (y != s) {
			degisiklikler.push({ kural: "tire.kopukKelime", aciklama: "Satır sonu tiresiyle kopmuş kelime birleştirildi", guven: "orta" });
			s = y;
		}
		return { metin: s, degisiklikler };
	}

	return { uygula, izafet, kopukKelime, araTire };
});
