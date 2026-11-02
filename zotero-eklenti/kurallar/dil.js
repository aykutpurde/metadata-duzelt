/* Metadata Düzelt — dil kuralları (saf fonksiyonlar, Zotero'ya bağımlı değil).
 *
 * tespit(metin)      → { dil: "tr"|"en"|"de"|null, guven: "yuksek"|"orta"|null, puan, sahteI? }
 *                      sahteI: metin yabancı dilde ama Türkçe yerelle büyütülüp küçültülmüş ("Internatıonal")
 * parcalar(metin)    → [{ ayirac, metin, son?, dil, sahteI }]: farklı dildeki başlık parçaları
 *                      ("Türkçe – English", "TÜRKÇE BAŞLIK English title", "Türkçe başlık (English title)");
 *                      aynı dildeki parçalar birleşik kalır. Metin geri kurulurken: ayirac + metin + (son || "")
 * acilimMi(k, ic)    → "SIGMA (Support for … Management)": k, parantezdeki açılımın kısaltması mı
 * sahteIDuzelt(m)    → yabancı dildeki parçalarda ı → i, İ → I
 * normalize(kod)     → Zotero language alanı için düzgün kod ("tr-TR" → "tr", "eng" → "en") ya da null
 * kucult/buyult      → Türkçe yerelli küçük/büyük harf (I→ı, İ→i)
 * kelimeSozlukKur(metinler) / eksikHarfKelime(w, sozluk) → kütüphanedeki yazımdan kaybolmuş Türkçe harfi bulma
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
		en: ("the of and in to a for on with by from an at as is are its their this that law rights right court legal international human european climate change environmental case study analysis towards between under against new global policy protection justice"
			+ " public administration administrative assessment approach perspective evaluation comparative development system role impact effect turkish management reform local government governance crisis institution institutions regulation framework theory problem issues challenges within through how what why toward using based during into about beyond social political economic constitutional criminal determining awareness workplace employees culture sample"
			+ " current developments refugee refugees migration").split(" "),
		de: ("der die das und des von im für zur zum mit ein eine recht rechts auf als bei dem den nach über durch aus oder nicht sind wird werden zwischen gegen unter"
			+ " einer eines einem überblick aktuellen entwicklung entwicklungen türkischen deutschen internationalen europäischen verfassung rechtsprechung verwaltung staat schutz schutzrecht ausländerrecht").split(" "),
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

	function tespitHam(metin) {
		let say = (re) => (metin.match(re) || []).length;
		let trG = say(TR_GUCLU), trZ = say(TR_ZAYIF), deG = say(DE_GUCLU);
		let puan = { tr: trG * 3 + trZ * 0.5, en: 0, de: deG * 3 + trZ * 0.3, fr: 0 };
		// Türkçe kelimeler Türkçe yerelle, ötekiler genel kuralla küçültülür ("In" → "in", "ın" değil)
		let ham = metin.split(/[^\p{L}]+/u).filter(Boolean);
		for (let w of ham) {
			let trW = w.toLocaleLowerCase("tr"), enW = w.toLowerCase();
			for (let k of Object.keys(SIK_SET)) {
				if (SIK_SET[k].has(k == "tr" ? trW : enW)) {
					puan[k] += 2;
				}
			}
		}
		// Türkçeye özgü ekler: -ında, -inde, -ları, -leri, -sının, -nın, -lık, -lik
		for (let w of kelimeler(metin)) {
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

	/** Türkçeye özgü başka harf (ğ ş ç) taşımayan kelimelerde ı → i, İ → I. "Kılıçdaroğlu" gibi Türkçe adlar korunur. */
	function sahteIDuzeltKelime(metin) {
		return metin.replace(/\p{L}+/gu, (w) => (/[ğşçĞŞÇ]/.test(w) ? w : w.replace(/ı/g, "i").replace(/İ/g, "I")));
	}

	/** Metnin dilini kabaca tahmin eder. Sık kelimeler ve dile özgü harfler puanlanır.
	 *  "Internatıonal", "Eın Überblıck" gibi Türkçe yerelle bozulmuş yabancı metin, ı'lar düzeltilerek yeniden denenir. */
	function tespit(metin) {
		if (!metin || !metin.trim()) {
			return { dil: null, guven: null, puan: {} };
		}
		let r = tespitHam(metin);
		if (/[ıİ]/.test(metin) && !turkceKaniti(metin)) {
			let r2 = tespitHam(sahteIDuzeltKelime(metin));
			if (r2.dil && r2.dil != "tr" && r2.guven == "yuksek" && r.dil != r2.dil) {
				return { ...r2, sahteI: true };
			}
			if (r.dil && r.dil != "tr" && /ı/.test(metin) && r2.dil == r.dil) {
				r.sahteI = true;
			}
		}
		return r;
	}

	function buyukKelime(w) {
		let L = w.match(/\p{L}/gu) || [];
		return L.length > 0 && L.every((c) => c === c.toLocaleUpperCase("tr") && c !== c.toLocaleLowerCase("tr"));
	}

	/** "TÜRKÇE BAŞLIK BURADA English title here": tamamı büyük (3+ kelime) kısımdan sonra normal yazımlı (3+ kelime) kısım başlıyorsa iki parça. */
	function buyukSinir(p) {
		let t = p.split(/(\s+)/);
		let kelime = [];
		t.forEach((x, i) => {
			if (/\p{L}/u.test(x)) {
				kelime.push(i);
			}
		});
		let kosu = 0;
		for (let j = 0; j < kelime.length; j++) {
			let w = t[kelime[j]];
			if (buyukKelime(w)) {
				kosu++;
				continue;
			}
			if (kosu && /^(?:ve|ile|veya|ya|ki|da|de|mi|mı|mu|mü|and|or|of|the|in|on|for|to)$/.test(w)) {
				continue;    // "DISCIPLINARY CRIMES and PUNISHMENTS": küçük bağlaç koşuyu bölmez
			}
			if (kosu >= 3 && kelime.length - j >= 3 && /^[^\p{L}]*\p{Lu}\p{Ll}/u.test(w)) {
				let bas = kelime[j];
				return [{ ayirac: "", metin: t.slice(0, bas - 1).join("") }, { ayirac: t[bas - 1], metin: t.slice(bas).join("") }];
			}
			kosu = 0;
		}
		return [{ ayirac: "", metin: p }];
	}

	const BAGLAC_EN = new Set("a an the and or of in on at to for by with from as".split(" "));

	/** "SIGMA (Support for Improvement in Governance and Management)", "TAIEX (Technical Assistance and Information Exchange)":
	 *  kelime, açılımdaki kelimelerin (bağlaçlar hariç) baş harfleriyle başlıyor mu. Sonda bir harf fazlası olabilir (SIGM-A).
	 *  Türkçe yerelle bozulmuş yazım ("Sıgma") da tanınır. */
	function acilimMi(kelime, ic) {
		let norm = (x) => sahteIDuzeltKelime(x).toUpperCase();
		let bas = ic.split(/\s+/).filter((w) => /\p{L}/u.test(w) && !BAGLAC_EN.has(w.replace(/[^\p{L}]/gu, "").toLowerCase()))
			.map((w) => w.match(/\p{L}/u)[0]).join("");
		let k = norm(kelime || "");
		bas = norm(bas);
		return bas.length >= 3 && k.length <= bas.length + 1 && k.startsWith(bas);
	}

	/** "\"Yetki Genişliği\" İlkesi Üzerine Bir İnceleme (A Research About the Principle of Deconcentration)":
	 *  başlığın sonundaki uzun (4+ kelime) parantez ayrı parça olur; dili farklıysa çeviri sayılır. Kapanış parantezi
	 *  "son" alanında tutulur. Kısa parantezler ("(IOI)", "(İİK m. 134)") ve kısaltma açılımları bölünmez. */
	function sondakiParantez(p) {
		let m = p.match(/^(.*\S)(\s*\()([^()]+)\)(\s*)$/su);
		if (!m || (m[3].match(/\p{L}+/gu) || []).length < 4 || acilimMi((m[1].match(/\p{L}+$/u) || [""])[0], m[3])) {
			return [{ ayirac: "", metin: p }];
		}
		return [{ ayirac: "", metin: m[1] }, { ayirac: m[2], metin: m[3], son: ")" + m[4] }];
	}

	const AYIRAC = /( \/ | \| |\s*=\s*| [-–—] )/;
	const KESIN_AYIRAC = /[\/|=]/;

	/** Başlığı dil parçalarına ayırır. " / ", " | ", " = " her zaman ayırır; " - " ve büyük→normal yazım geçişi
	 *  yalnızca iki yanın dili farklıysa. Dili belirsiz parça öncekine katılır. */
	function parcalar(metin) {
		let ham = metin.split(AYIRAC);
		let liste = [];
		for (let i = 0; i < ham.length; i += 2) {
			let ay = i ? ham[i - 1] : "";
			// "…Hükmünün DeğerlendirilmesiFrom the Perspective…": iki dil boşluksuz yapışmış
			let alt = ham[i].replace(/(\p{Ll}{2})(\p{Lu}\p{Ll}{2,})/gu, "$1\u0000$2").split("\u0000")
				.flatMap((y) => buyukSinir(y))
				.flatMap((q) => sondakiParantez(q.metin).map((r, j) => (j ? r : { ...r, ayirac: q.ayirac })));
			alt[0].ayirac = ay;
			alt.forEach((q, j) => liste.push({ ayirac: q.ayirac, metin: q.metin, son: q.son, kesin: !j && KESIN_AYIRAC.test(ay) }));
		}
		for (let p of liste) {
			let t = tespit(p.metin);
			p.dil = t.guven == "yuksek" ? t.dil : null;
			p.sahteI = !!t.sahteI;
		}
		let out = [];
		for (let p of liste) {
			let o = out[out.length - 1];
			if (o && !p.kesin && (!p.dil || !o.dil || p.dil == o.dil)) {
				o.metin += (o.son || "") + p.ayirac + p.metin;
				o.son = p.son;
				o.dil = o.dil || p.dil;
				o.sahteI = o.sahteI || p.sahteI;
				continue;
			}
			out.push({ ayirac: p.ayirac, metin: p.metin, son: p.son, dil: p.dil, sahteI: p.sahteI });
		}
		return out;
	}

	/** Parçada Türkçe kanıtı var mı: ğ/ş, sık Türkçe kelime ya da Türkçe ek ("Uluslararası Davraz Kongresi: Social…"). */
	function turkceKaniti(metin) {
		return /[ğşĞŞ]/.test(metin) || kelimeler(metin).some((w) => SIK_SET.tr.has(w)
			|| (w.length > 5 && /(ında|inde|unda|ünde|ları|leri|sının|sinin|nın|nin|lığı|liği|lık|ması|mesi)$/.test(w)));
	}

	/** Yabancı dildeki (ya da Türkçe yerelle bozulmuş) parçalarda ı → i. Türkçe kanıtı taşıyan parçaya dokunulmaz. */
	function sahteIDuzelt(metin) {
		let ps = parcalar(metin);
		let duzelt = (p) => p.sahteI && p.dil != "tr";
		if (!ps.some(duzelt)) {
			return metin;
		}
		return ps.map((p) => p.ayirac + (duzelt(p) ? sahteIDuzeltKelime(p.metin) : p.metin) + (p.son || "")).join("");
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
		if (/^[a-z]{2,3}(?:\s*[,;\/]\s*[a-z]{2,3})+$/i.test(k)) {
			return normalize(k.split(/\s*[,;\/]\s*/)[0]);   // "tr,en": ilk dil esas
		}
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

	// Türkçe harf → ASCII karşılığı (diakritiği kaybolmuş yazımı bulmak için)
	const KATLA = { "ı": "i", "ş": "s", "ç": "c", "ğ": "g", "ö": "o", "ü": "u", "â": "a", "î": "i", "û": "u" };
	const katla = (w) => w.replace(/[ışçğöüâîû]/g, (c) => KATLA[c]);
	const SOZLUK_KELIME = /^\p{L}{4,}$/u;

	/** Kütüphanedeki metinlerden kelime sıklığı: ASCII karşılığı → Map(küçük yazım → sayı).
	 *  "I" içeren kelimeler sayılmaz: İngilizce "International" Türkçe yerelle "ınternational" olur, sözlüğü kirletir. */
	function kelimeSozlukKur(metinler) {
		let sozluk = new Map();
		for (let m of metinler || []) {
			// metin bir kerede küçültülür (Türkçe yerel uzunluğu korur: İ → i, I → ı); "I" denetimi özgün metinde aynı konumda
			let ozgun = String(m || "").normalize("NFC").replace(/i\u0307/g, "i");
			let kucuk = kucult(ozgun, "tr");
			if (kucuk.length != ozgun.length) {
				continue;
			}
			for (let x of kucuk.matchAll(/\p{L}{4,}/gu)) {
				let k = x[0];
				if (ozgun.slice(x.index, x.index + k.length).includes("I")) {
					continue;
				}
				let a = katla(k);
				let m2 = sozluk.get(a);
				if (!m2) {
					sozluk.set(a, m2 = new Map());
				}
				m2.set(k, (m2.get(k) || 0) + 1);
			}
		}
		return sozluk;
	}

	// İki yazımı da geçerli ve sık kökler (ASCII karşılığıyla): basın/başın, ayni (aynî hak)/aynı
	const IKI_YAZIMLI = /^(?:basin|ayni)/;

	function eksikHarfKelime(w, sozluk, izinli = null) {
		if (!sozluk || !SOZLUK_KELIME.test(w)) {
			return null;
		}
		let k = kucult(w, "tr");
		if (IKI_YAZIMLI.test(katla(k))) {
			return null;
		}
		let adaylar = sozluk.get(katla(k));
		if (!adaylar) {
			return null;
		}
		let kendi = adaylar.get(k) || 0;
		let en = null, enN = 0;
		for (let [y, n] of adaylar) {
			if (y == k || n < 3 || n < 25 * kendi || n <= enN) {
				continue;
			}
			let h = [...k], g = [...y];
			if (h.length == g.length && h.every((c, j) => c == g[j] || (KATLA[g[j]] == c && !KATLA[c] && !"âîû".includes(g[j]) && (!izinli || izinli.has(g[j]))))) {
				en = g;
				enN = n;
			}
		}
		if (!en) {
			return null;
		}
		return [...w].map((c, j) => (c != kucult(c, "tr") ? buyult(en[j], "tr") : en[j])).join("");
	}

	return { tespit, normalize, kucult, buyult, katla, kelimeSozlukKur, eksikHarfKelime, kelimeler, parcalar, sahteIDuzelt, sahteIDuzeltKelime, acilimMi, SIK };
});
