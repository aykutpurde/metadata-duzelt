/* Metadata Düzelt — dil kuralları (saf fonksiyonlar, Zotero'ya bağımlı değil).
 *
 * tespit(metin)      → { dil: "tr"|"en"|"de"|null, guven: "yuksek"|"orta"|null, puan }
 * normalize(kod)     → Zotero language alanı için düzgün kod ("tr-TR" → "tr", "eng" → "en") ya da null
 * kucult/buyult      → Türkçe yerelli küçük/büyük harf (I→ı, İ→i)
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory();
	}
	else {
		root.MetadataDuzeltKurallar = root.MetadataDuzeltKurallar || {};
		root.MetadataDuzeltKurallar.dil = factory();
	}
})(this, function () {
	"use strict";

	const TR_GUCLU = /[ğşıİĞŞ]/g;          // yalnızca Türkçede (ve birkaç dilde) bulunan harfler
	const TR_ZAYIF = /[çöüÇÖÜâîû]/g;       // Türkçede sık, ama Almanca/Fransızcada da var
	const DE_GUCLU = /[äßÄ]/g;

	const SIK = {
		tr: "ve ile bir bu şu için olarak üzerine hakkında ilişkin açısından bağlamında arasında sonra önce gibi kadar daha çok olan olup mi mı mu mü de da ki ya veya ancak ise göre karşı ilgili hukuk hukuku hukukunda hukukundaki hukuksal hukuki kanun kanunu kanunun mahkeme mahkemesi mahkemesinin karar kararı kararları kararlarının değerlendirme değerlendirilmesi değerlendirmesi sorunu sorunlar kavramı ışığında çerçevesinde türk türkiye idare idari anayasa anayasal ceza dergisi üniversitesi yargı yargısal hak hakkı hakları yeni genel özel temel uluslararası kamu devlet devletin yönetimi yönetim sistemi üzerindeki ilkesi ilkeleri çevre çevresel inceleme analizi yaklaşım yaklaşımı örneği bakımından yoluyla aracılığıyla hükmünde sayılı tarihli".split(" "),
		en: "the of and in to a for on with by from an at as is are its their this that law rights right court legal international human european climate change environmental case study analysis towards between under against new global policy protection justice".split(" "),
		de: "der die das und des von im für zur zum mit ein eine recht rechts auf als bei dem den nach über durch aus oder nicht sind wird werden zwischen gegen unter".split(" "),
		fr: "le la les des du de et dans pour sur une un par au aux droit droits est sont contre entre".split(" "),
	};
	const SIK_SET = {};
	for (let k of Object.keys(SIK)) {
		SIK_SET[k] = new Set(SIK[k]);
	}

	function kucult(s, dil) {
		return s.toLocaleLowerCase(dil == "tr" ? "tr" : "en-US");
	}

	function buyult(s, dil) {
		return s.toLocaleUpperCase(dil == "tr" ? "tr" : "en-US");
	}

	function kelimeler(metin) {
		return metin.toLocaleLowerCase("tr").split(/[^\p{L}]+/u).filter(Boolean);
	}

	/** Metnin dilini kabaca tahmin eder. Sık kelimeler ve dile özgü harfler puanlanır. */
	function tespit(metin) {
		if (!metin || !metin.trim()) {
			return { dil: null, guven: null, puan: {} };
		}
		let say = (re) => (metin.match(re) || []).length;
		let trG = say(TR_GUCLU), trZ = say(TR_ZAYIF), deG = say(DE_GUCLU);
		let puan = { tr: trG * 3 + trZ * 0.5, en: 0, de: deG * 3 + trZ * 0.3, fr: 0 };
		let ws = kelimeler(metin);
		for (let w of ws) {
			for (let k of Object.keys(SIK_SET)) {
				if (SIK_SET[k].has(w)) {
					puan[k] += 2;
				}
			}
		}
		// Türkçeye özgü ekler: -ında, -inde, -ları, -leri, -sının, -nın, -lık, -lik
		for (let w of ws) {
			if (w.length > 5 && /(ında|inde|unda|ünde|ları|leri|sının|sinin|nın|nin|lığı|liği|lık|lik|ması|mesi)$/.test(w)) {
				puan.tr += 1;
			}
		}
		let sirali = Object.entries(puan).sort((a, b) => b[1] - a[1]);
		let [dil, en] = sirali[0];
		let ikinci = sirali[1][1];
		if (en < 2) {
			return { dil: null, guven: null, puan };
		}
		let guven = (en >= 5 && en >= ikinci * 2) || (dil == "tr" && trG >= 2) ? "yuksek" : "orta";
		if (dil == "tr" && trG == 0 && trZ == 0 && en < 6) {
			guven = "orta";
		}
		return { dil, guven, puan };
	}

	const ES = {
		tr: /^(tr|tur|tr[-_][a-z]+|turkish|türkçe|turkce)$/i,
		en: /^(en|eng|english|en[-_]?us|en[-_]?gb|en[-_]?au|en[-_]?ca|en[-_]?europe|en[-_]?[a-z]+)$/i,
		de: /^(de|deu|ger|german|deutsch|de[-_][a-z]+)$/i,
		fr: /^(fr|fra|fre|french|français|fr[-_][a-z]+)$/i,
	};
	const BOLGE_KORU = /^(en-US|en-GB|en-AU|en-CA|de-DE|de-AT|de-CH|fr-FR|fr-CA|pt-BR|zh-CN|zh-TW)$/;

	/** Dil alanındaki değeri standart koda çevirir; tanınmıyorsa null. Değişiklik gerekmiyorsa aynı değeri döndürür. */
	function normalize(kod) {
		if (!kod) {
			return null;
		}
		let k = kod.trim();
		if (BOLGE_KORU.test(k)) {
			return k;
		}
		for (let d of Object.keys(ES)) {
			if (ES[d].test(k)) {
				if (d == "en" && /^en[-_]?(us|gb|au|ca)$/i.test(k)) {
					return "en-" + k.slice(-2).toUpperCase();
				}
				return d;
			}
		}
		if (/^[a-z]{2}(-[A-Z]{2})?$/.test(k)) {
			return k;  // başka bir dilin düzgün kodu
		}
		return null;   // 'scheme="ISO639-1"' gibi çöp
	}

	return { tespit, normalize, kucult, buyult, kelimeler, SIK };
});
