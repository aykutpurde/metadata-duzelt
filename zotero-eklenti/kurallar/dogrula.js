/* Metadata Düzelt — önerileri özgün kaynakla karşılaştırma (saf fonksiyonlar; ağ/PDF okuma metadataduzelt.js'de).
 *
 * degerlendir(satir, kaynak) → { durum, mesaj, kaynakMetni? } | null
 *   satir:  motorun önerisi ({ alan, eski, yeni, yeniYazar, … })
 *   kaynak: { basliklar: [{ kaynak, metin }], yazarlar: [{ kaynak, tam }], pdf: string|null }
 *   durum:  "dogrulandi" (yeni değer kaynakta var) | "farkli" (kaynaktaki değer başka) |
 *           "bilgi" (kaynakta bulunan kesit gösterilir) | "bulunamadi" | "kaynakYok"
 *
 * Şapka (â î û) kaynaktaki yazıma uydurulur: kaynakta "Zekâ" ise öneri "Zekâ", "Zeka" ise "Zeka" olur
 * (sonuc.yeniOneri). Kaynak: başlık kayıtları (CrossRef, DergiPark); yoksa PDF'in başı.
 *
 * Karşılaştırma büyük/küçük harf, aksan, ı/i, boşluk ve noktalamadan bağımsızdır: PDF'te başlık çoğunlukla
 * TAMAMI BÜYÜK, satırlara bölünmüş ve tirelenmiş durur. Bu yüzden harf düzeni değil, metnin kendisi doğrulanır.
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory(require("./karakter.js"));
	}
	else {
		root.MetadataDuzeltKurallar = root.MetadataDuzeltKurallar || {};
		root.MetadataDuzeltKurallar.dogrula = factory(root.MetadataDuzeltKurallar.karakter);
	}
})(this, function (karakter) {
	"use strict";

	const BASLIK_ALANLARI = new Set(["title", "shortTitle", "bookTitle"]);
	const PDF_BOYU = 8000;   // ilk sayfa(lar): başlık ve yazarlar burada

	/** Tek karakteri karşılaştırma biçimine indirir (uzunluk korunur): "İ" → "i", "ş" → "s", "Â" → "a". */
	function katKarakter(c) {
		let k = c.toLocaleLowerCase("tr").normalize("NFKD")[0] || c;
		return k == "ı" ? "i" : k;
	}

	/** Karşılaştırma anahtarı: yalnızca harf ve rakam, küçük, aksansız. */
	function kat(s) {
		return Array.from(String(s || "")).map(katKarakter).join("").replace(/[^\p{L}\p{N}]/gu, "");
	}

	/** Ad karşılaştırması: nokta ve tire korunur ("N-erdal" ile "N. Erdal" aynı ad sayılmaz). */
	function katAd(s) {
		return Array.from(String(s || "")).map(katKarakter).join("").replace(/[^\p{L}\p{N}.-]+/gu, " ").replace(/\.(?=\S)/g, ". ").trim();
	}

	/** metin içinde aranan'ın geçtiği yerin çevresinden kesit; aksan/harf düzeninden bağımsız arar. */
	function kesit(metin, aranan, pay = 60) {
		if (!metin || !aranan) {
			return null;
		}
		let katli = Array.from(metin).map(katKarakter).join("");
		let i = katli.indexOf(Array.from(aranan).map(katKarakter).join(""));
		if (i < 0) {
			return null;
		}
		let bas = Math.max(0, i - pay), son = Math.min(metin.length, i + aranan.length + pay);
		let parca = metin.slice(bas, son);
		// kelime ortasından başlayıp bitmesin
		if (bas) {
			parca = parca.replace(/^\S*\s+/, "");
		}
		if (son < metin.length) {
			parca = parca.replace(/\s+\S*$/, "");
		}
		return (bas ? "…" : "") + parca.replace(/\s+/g, " ").trim() + (son < metin.length ? "…" : "");
	}

	function etiketSil(s) {
		return karakter.htmlVarliklar(String(s || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
	}

	/** HTML sayfasındaki citation_title / DC.title ve citation_author meta etiketleri. */
	function metaOku(html) {
		let basliklar = [], yazarlar = [];
		let re = /<meta\s+[^>]*>/gi;
		let m;
		while ((m = re.exec(html || ""))) {
			let tag = m[0];
			let ad = (tag.match(/\bname\s*=\s*["']([^"']+)["']/i) || [])[1];
			let deger = (tag.match(/\bcontent\s*=\s*"([^"]*)"/i) || tag.match(/\bcontent\s*=\s*'([^']*)'/i) || [])[1];
			if (!ad || !deger) {
				continue;
			}
			ad = ad.toLowerCase();
			if (ad == "citation_title" || ad == "dc.title" || ad == "dc.title.alternative") {
				basliklar.push(etiketSil(deger));
			}
			else if (ad == "citation_author" || ad == "dc.creator") {
				yazarlar.push(etiketSil(deger));
			}
		}
		let tekil = (a) => [...new Map(a.filter(Boolean).map((x) => [kat(x), x])).values()];
		return { basliklar: tekil(basliklar), yazarlar: tekil(yazarlar) };
	}

	/** CrossRef /works yanıtının message nesnesinden başlık ve yazarlar. */
	function crossrefOku(m) {
		let basliklar = [...(m.title || []), ...(m["original-title"] || [])].map(etiketSil).filter(Boolean);
		let yazarlar = (m.author || []).map((a) => etiketSil([a.given, a.family].filter(Boolean).join(" ") || a.name)).filter(Boolean);
		let adSoyad = (m.author || []).filter((a) => a.family).map((a) => ({ ad: etiketSil(a.given || ""), soyad: etiketSil(a.family) }));
		return { basliklar, yazarlar, adSoyad };
	}

	/** Extra / URL / DOI alanından DOI. */
	function doiBul(fields) {
		let adaylar = [fields.DOI, (fields.extra || "").match(/^DOI:\s*(\S+)/im)?.[1], fields.url];
		for (let a of adaylar) {
			let m = String(a || "").match(/10\.\d{4,9}\/[^\s"<>]+/);
			if (m) {
				return m[0].replace(/[.,;)]+$/, "");
			}
		}
		return null;
	}

	const SAPKA = { "â": "a", "î": "i", "û": "u", "Â": "A", "Î": "I", "Û": "U" };
	const SAPKA_EKLE = { "a": "â", "i": "î", "u": "û", "A": "Â", "I": "Î", "İ": "Î", "U": "Û", "ı": "î" };

	function sapkasiz(w) {
		return w.toLocaleLowerCase("tr").replace(/[âîû]/g, (c) => SAPKA[c]).replace(/ı/g, "i");
	}

	/** Metindeki kelimelerin şapkasını kaynaktaki yazıma uydurur; değişmezse null.
	 *  Yalnızca â/î/û ↔ a/i/u farkı düzeltilir, harf büyüklüğü öneride olduğu gibi kalır. */
	function sapkaUyumla(metin, kaynaklar) {
		let bicim = new Map();
		for (let k of kaynaklar) {
			for (let w of String(k || "").match(/\p{L}{3,}/gu) || []) {
				let anahtar = sapkasiz(w);
				if (!bicim.has(anahtar)) {
					bicim.set(anahtar, w.toLocaleLowerCase("tr"));
				}
			}
		}
		let y = metin.replace(/\p{L}{3,}/gu, (w) => {
			let src = bicim.get(sapkasiz(w));
			if (!src || src.length != w.length) {
				return w;
			}
			return Array.from(w).map((c, i) => {
				let s = src[i];
				if (/[âîû]/.test(s) && !/[âîûÂÎÛ]/.test(c)) {
					return SAPKA_EKLE[c] || c;
				}
				if (!/[âîû]/.test(s) && SAPKA[c]) {
					let duz = SAPKA[c];
					return c === c.toLowerCase() ? (s == "ı" ? "ı" : duz) : (s == "i" ? "İ" : duz);
				}
				return c;
			}).join("");
		});
		return y != metin ? y : null;
	}

	function baslikDegerlendir(satir, k) {
		let y = kat(satir.yeni);
		if (!y) {
			return null;
		}
		// başlık kaydı varsa yalnızca o (PDF metin çıkarımı şapkayı düşürebilir); yoksa PDF'in başı
		let sapkaKaynak = k.basliklar.length ? k.basliklar.map((b) => b.metin) : [k.pdf ? k.pdf.slice(0, 3000) : ""];
		let yeniOneri = sapkaUyumla(satir.yeni, sapkaKaynak);
		let sonuc = baslikKarsilastir(satir, k, y);
		if (yeniOneri && sonuc) {
			sonuc.yeniOneri = yeniOneri;
			sonuc.mesaj += " · şapkalı harfler kaynaktaki yazıma uyduruldu";
		}
		return sonuc;
	}

	const TIRNAK_BAS = /^\s*["'“‘«„”’]/;

	function baslikKarsilastir(satir, k, y) {
		// tırnak silindi ama kaynakta da başlık tırnak içinde: başlığın kendisi bir alıntı
		if (TIRNAK_BAS.test(satir.eski || "") && !TIRNAK_BAS.test(satir.yeni)) {
			let b = k.basliklar.find((x) => TIRNAK_BAS.test(x.metin));
			if (b) {
				return { durum: "farkli", mesaj: `Kaynakta da başlık tırnak içinde (${b.kaynak}): “${b.metin}”`, kaynakMetni: b.metin };
			}
		}
		let uyan = new Set();
		for (let b of k.basliklar) {
			let bk = kat(b.metin);
			if (bk == y || (y.length >= 15 && bk.includes(y))) {
				uyan.add(b.kaynak);
			}
		}
		if (k.pdf && y.length >= 10 && kat(k.pdf.slice(0, PDF_BOYU)).includes(y)) {
			uyan.add("PDF");
		}
		if (uyan.size) {
			return { durum: "dogrulandi", mesaj: `${[...uyan].join(", ")} ile aynı` };
		}
		if (k.basliklar.length) {
			let b = k.basliklar.find((x) => kat(x.metin) != kat(satir.eski)) || k.basliklar[0];
			return { durum: "farkli", mesaj: `Kaynaktaki başlık (${b.kaynak}): “${b.metin}”`, kaynakMetni: b.metin };
		}
		if (k.pdf) {
			return { durum: "bulunamadi", mesaj: "PDF'in ilk sayfalarında bu başlık bulunamadı" };
		}
		return { durum: "kaynakYok", mesaj: "Karşılaştırılacak kaynak yok (PDF, DOI ya da DergiPark bağlantısı)" };
	}

	/** Yazar adını her kaynakla ayrı karşılaştırır; kaynaklardan biri bile başka bir ad gösteriyorsa "farkli".
	 *  (DergiPark'ın kendi kaydı da bozuk olabilir: "N-erdal Fanid" — PDF'te "Nematollah AGHABALAEI FANID".) */
	function basHarfli(w) {
		let low = w.toLocaleLowerCase("tr");
		return low.replace(/(^|[-'’])(\p{L})/gu, (m, a, c) => a + c.toLocaleUpperCase("tr"));
	}

	/** Yazarın adını kaynaktan alır: harfler (Basar → Başar) ve ad/soyad ayrımı. Kaynakta kişinin bütün
	 *  kelimeleri aynı sırayla geçmeli. Ayrım: CrossRef given/family; yoksa sondaki BÜYÜK harfli kelimeler
	 *  soyadıdır ("Cansu KOÇ BAŞAR"); yoksa kayıttaki ayrım korunur. Değişiklik yoksa null. */
	function adiKaynaktanAl(yy, k) {
		let ad = (yy.firstName || "").trim().split(/\s+/).filter(Boolean);
		let soy = (yy.lastName || "").trim().split(/\s+/).filter(Boolean);
		let hedef = [...ad, ...soy].map(kat);
		if (hedef.length < 2 || hedef.some((x) => !x)) {
			return null;
		}
		let bul = (metin) => {
			let t = String(metin || "").split(/[\s,;]+/).map((w) => w.replace(/^[^\p{L}]+|[^\p{L}.'’-]+$/gu, "")).filter(Boolean);
			for (let i = 0; i + hedef.length <= t.length; i++) {
				if (hedef.every((h, j) => kat(t[i + j]) == h)) {
					return t.slice(i, i + hedef.length);
				}
			}
			return null;
		};
		let bicimle = (w) => (/\p{Ll}/u.test(w) ? w : basHarfli(w));
		let isaretli = (w) => (String(w).match(/[çğıöşüâîûÇĞİÖŞÜÂÎÛ]/g) || []).length;
		// her kelimede Türkçe harfi daha eksiksiz olan biçim: kaynak "Koc" derse kayıttaki "Koç" korunur
		let birlestir = (o) => o.map((w, i) => {
			let bizim = [...ad, ...soy][i];
			return isaretli(bizim) > isaretli(w) ? bizim : bicimle(w);
		});
		let yeni = null;
		for (let a of k.adSoyad || []) {
			let o = bul(a.ad + " " + a.soyad);
			if (o) {
				let n = a.ad.trim().split(/\s+/).filter(Boolean).length;
				let w = birlestir(o);
				yeni = { firstName: w.slice(0, n).join(" "), lastName: w.slice(n).join(" ") };
				break;
			}
		}
		// kaynaklardan: Türkçe harfi en eksiksiz olan; sondaki BÜYÜK harfli kelimeler soyadı ayrımını verir
		let adaylar = [...k.yazarlar.map((x) => x.tam), k.pdf ? k.pdf.slice(0, PDF_BOYU) : ""].map(bul).filter(Boolean);
		let buyuk = (w) => /\p{Lu}{2,}/u.test(w) && !/\p{Ll}/u.test(w);
		let n = yeni ? yeni.firstName.split(/\s+/).filter(Boolean).length : ad.length;
		for (let o of adaylar) {
			let kuyruk = 0;
			while (kuyruk < o.length - 1 && buyuk(o[o.length - 1 - kuyruk])) {
				kuyruk++;
			}
			if (kuyruk && !buyuk(o[0]) && !(k.adSoyad || []).length) {
				n = o.length - kuyruk;
				break;
			}
		}
		let enIyi = adaylar.sort((x, y) => isaretli(y.join(" ")) - isaretli(x.join(" ")))[0];
		if (enIyi && (!yeni || isaretli(enIyi.join(" ")) > isaretli(yeni.firstName + " " + yeni.lastName))) {
			let w = birlestir(enIyi);
			yeni = { firstName: w.slice(0, n).join(" "), lastName: w.slice(n).join(" ") };
		}
		if (!yeni || !yeni.lastName || (yeni.firstName == (yy.firstName || "") && yeni.lastName == (yy.lastName || ""))) {
			return null;
		}
		return yeni;
	}

	function yazarDegerlendir(satir, k) {
		let sonuc = yazarKarsilastir(satir, k);
		let oneri = sonuc && adiKaynaktanAl(satir.yeniYazar || {}, k);
		if (oneri) {
			sonuc.yeniYazarOneri = oneri;
			sonuc.yeniOneri = `[${oneri.lastName}] [${oneri.firstName}]`;
			sonuc.mesaj += " · ad kaynaktaki yazıma uyduruldu";
		}
		return sonuc;
	}

	function yazarKarsilastir(satir, k) {
		let yy = satir.yeniYazar || {};
		let soy = yy.lastName || "", ad = yy.firstName || "";
		if (!soy) {
			return null;
		}
		let s = kat(soy), a = katAd(ad);
		let adVar = (metin) => !a || (" " + katAd(metin) + " ").includes(" " + a + " ");
		let notlar = [], farkli = 0, ilkFarkli = null;
		let gorulen = new Set();
		for (let x of k.yazarlar) {
			if (!kat(x.tam).includes(s) || gorulen.has(x.kaynak)) {
				continue;
			}
			gorulen.add(x.kaynak);
			notlar.push(`${x.kaynak}: ${x.tam}`);
			if (!adVar(x.tam)) {
				farkli++;
				ilkFarkli = ilkFarkli || x.tam;
			}
		}
		let parca = k.pdf ? kesit(k.pdf.slice(0, PDF_BOYU), soy, 40) : null;
		if (parca) {
			notlar.push(`PDF: “${parca}”`);
			if (!adVar(parca)) {
				farkli++;
			}
		}
		if (notlar.length) {
			return farkli
				? { durum: "farkli", mesaj: "Kaynakta başka biçim — " + notlar.join(" · "), kaynakMetni: ilkFarkli || undefined }
				: { durum: "dogrulandi", mesaj: notlar.join(" · ") };
		}
		if (k.pdf || k.basliklar.length) {
			return { durum: "bulunamadi", mesaj: `“${soy}” kaynakta bulunamadı` };
		}
		return { durum: "kaynakYok", mesaj: "Karşılaştırılacak kaynak yok (PDF, DOI ya da DergiPark bağlantısı)" };
	}

	function degerlendir(satir, kaynak) {
		let k = { basliklar: [], yazarlar: [], adSoyad: [], pdf: null, ...kaynak };
		if (BASLIK_ALANLARI.has(satir.alan)) {
			return baslikDegerlendir(satir, k);
		}
		if (satir.alan == "creators") {
			return yazarDegerlendir(satir, k);
		}
		return null;
	}

	/** Doğrulamaya değer satır: başlık önerileri ve göz atılması gereken yazar önerileri. */
	function dogrulanabilir(satir) {
		return BASLIK_ALANLARI.has(satir.alan) || (satir.alan == "creators" && satir.guven == "orta");
	}

	return { degerlendir, dogrulanabilir, sapkaUyumla, adiKaynaktanAl, kat, kesit, metaOku, crossrefOku, doiBul };
});
