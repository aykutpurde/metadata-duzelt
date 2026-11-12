/* Metadata Düzelt — PDF metni ve kütüphaneden başlık / yazar / künye tamamlama (saf; PDF okuma metadataduzelt.js'de).
 *
 * kaynakAnaliz(kayit, pdf, sonuc, ayarlar) → { oneriler, uyarilar }: motor.analiz sonucuna PDF'ten çıkan önerileri katar
 *   ayarlar.kunyeler: kunyeIndeks(kütüphanedeki kayıtlar); ayarlar.kelimeSozluk: dil.kelimeSozlukKur(…)
 * pdfBaslik(pdf, baslik)   → { metin, konum } | null: PDF'in başında kayıttaki başlığa benzeyen gerçek başlık
 *                            ("İdari Yargıtada Dava Açma Süresi" → "İDARİ YARGIDA DAVA AÇMA SÜRESİ (2577 Sayılı …)")
 * pdfYazar(yazar, pdf)     → { firstName, lastName } | null: adı ya da soyadı bozuk yazarın PDF'teki adı
 *                            ("Yahya" + "Z_20200504231640" → PDF'te "Prof.Dr.Yahya K.ZABUNOĞLU" → "Yahya K." + "Zabunoğlu")
 * kunyeBul(metin, kunyeler, key) → kütüphanedeki kitap/dergi künyesi: kapakta/üst bilgide adı (OCR hatalarıyla) geçen
 * kunyeIndeks(kayitlar)    → [{ key, itemType, baslik, kap, alanlar }]: kitap düzeyindeki alanlar (bölüm/makale alanları değil)
 * bozukAd(s)               → dosya adı / zaman damgası artığı mı ("Z_20200504231640", "scan_0012")
 * gerekli(kayit)           → PDF'e bakmaya değer mi (künye boş ya da yazar adı bozuk)
 *
 * Bu öneriler kaynak metinden geldiği için hep "orta" güvenlidir ve otomatik uygulanmaz.
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory(require("./dil.js"), require("./harf.js"), require("./motor.js"));
	}
	else {
		let K = root.MetadataDuzeltKurallar;
		K.kunye = factory(K.dil, K.harf, K.motor);
	}
})(this, function (dil, harf, motor) {
	"use strict";

	const PDF_BASI = 4000;

	/** Karşılaştırma biçimi: küçük, aksansız, ı → i. */
	function katla(s) {
		return String(s || "").toLocaleLowerCase("tr").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
	}

	/** Harf ve rakam kelimeleri (katlanmış). */
	function kelimeler(s) {
		return katla(s).match(/[\p{L}\p{N}]+/gu) || [];
	}

	function mesafe(a, b) {
		if (Math.abs(a.length - b.length) > 2) {
			return 3;
		}
		let onceki = Array.from({ length: b.length + 1 }, (x, j) => j);
		for (let i = 1; i <= a.length; i++) {
			let simdi = [i];
			for (let j = 1; j <= b.length; j++) {
				simdi[j] = Math.min(onceki[j] + 1, simdi[j - 1] + 1, onceki[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
			}
			onceki = simdi;
		}
		return onceki[b.length];
	}

	/** OCR hatasına dayanıklı kelime eşleşmesi: "idore" ~ "idare", "isori" ~ "idari"; rakamlar tam eşleşmeli. */
	function yakin(a, b) {
		if (a == b) {
			return true;
		}
		if (/\d/.test(a) || /\d/.test(b) || Math.min(a.length, b.length) < 4) {
			return false;
		}
		return mesafe(a, b) <= (Math.min(a.length, b.length) >= 5 ? 2 : 1);
	}

	/** Dosya adı / zaman damgası artığı: alt çizgi ya da 4+ rakam ("Z_20200504231640"). */
	function bozukAd(s) {
		return /_|\d{4,}/.test(String(s || ""));
	}

	const DUR = /(?:^|[\s.(])(?:Prof|Doç|Doc|Dr|Arş|Ars|Yrd|Öğr|Ogr|Av)\b|\*|@/u;

	/** Kelimenin kütüphanedeki sıklığı (tam küçük yazımıyla); sözlük yoksa null. */
	function siklik(w, sozluk) {
		if (!sozluk) {
			return null;
		}
		let k = dil.kucult(w, "tr");
		let m = sozluk.get(dil.katla(k));
		return m ? m.get(k) || 0 : 0;
	}

	/** PDF kelimesi kayıttaki kelimenin yerine geçebilir mi: harf düzeni/aksan farkı her zaman; harf farkı ("Yargıtada" →
	 *  "Yargıda", "Orantılılk" → "Orantılılık") ancak kayıttaki yazım kütüphanede neredeyse hiç geçmiyor, PDF'teki sık
	 *  geçiyorsa. Böylece PDF'in OCR hatası ("Denetimi" → "Denetim;") kayda taşınmaz. */
	function degisebilir(eski, yeni, sozluk) {
		if (anahtar(eski) == anahtar(yeni)) {
			return true;
		}
		if (/['’]/.test(eski + yeni) || anahtar(eski).startsWith(anahtar(yeni))) {
			return false;     // ek düşmüş: "Türkiye'de" / PDF'te "Türkiye", "Satımın" / PDF'te "Satım"
		}
		let fe = siklik(eski, sozluk), fy = siklik(yeni, sozluk);
		return fe !== null && fe <= 2 && fy >= 3 && fe * 10 <= fy;
	}

	/** Alt başlık uzantısı gerçek mi: en az iki 3+ harfli kelime; sayfa aralığı "(131-147)", "(1)", "(X)", yazar/unvan
	 *  (Prof., Dr., *, ": Metin MERİÇ"), kapanmamış tırnak ya da yarım kalmış sonu (": S", "1966-") olan alınmaz. */
	function uzantiGecerli(e) {
		let kelimeler = e.match(/\p{L}{3,}/gu) || [];
		let tirnak = (e.match(/[“”"«»]/g) || []).length;
		// TAMAMI BÜYÜK 5+ harfli, kısaltma olmayan kelime yazar adıdır (": Metin MERİÇ")
		let ad = kelimeler.some((w) => w.length >= 5 && w === dil.buyult(w, "tr") && !harf.KISALTMALAR.has(w));
		return kelimeler.length >= 2 && !ad && !DUR.test(e) && !/^::/.test(e) && tirnak % 2 == 0 && !/[-–:,]\s*\)?$/.test(e);
	}

	const KELIME = /[\p{L}\p{N}]+(?:['’]\p{L}+)?/gu;
	const kesmesiz = (w) => katla(w).replace(/['’]/g, "");
	const anahtar = kesmesiz;

	/** PDF kelimesini kayıttaki kelimenin harf düzenine uydurur ("YARGIDA" → "Yargıda", "yargıda", "YARGIDA"). */
	function duzenUydur(yeni, eski) {
		if (eski === dil.buyult(eski, "tr") && /\p{L}{2}/u.test(eski)) {
			return dil.buyult(yeni, "tr");
		}
		let k = dil.kucult(yeni, "tr");
		return /^\p{Lu}/u.test(eski) ? dil.buyult(k[0], "tr") + k.slice(1) : k;
	}

	/** PDF'in başında kayıttaki başlığın kendisini bulur: başlığın her kelimesi sırayla (OCR'a dayanıklı; arada en çok bir
	 *  fazladan kelime) eşleşmeli. Sonuç kayıttaki başlıktır: yalnızca PDF'te harfi/kesmesi/şapkası farklı olan kelimeler
	 *  PDF'teki yazımla değişir (harf farkı degisebilir()'den geçmeli) ve hemen ardından gelen parantez içi ya da iki
	 *  noktalı alt başlık eklenir ("… SÜRESİ (2577 Sayılı İYUK'nun … İnceleme)"). Araya giren sayfa numarası, dipnot ve
	 *  alttaki çeviri başlık böylece alınmaz. → { metin, konum } | null */
	function pdfBaslik(pdf, baslik, sozluk = null) {
		let T = [...String(baslik || "").matchAll(KELIME)];
		if (!pdf || T.length < 3) {
			return null;
		}
		let bas = pdf.slice(0, PDF_BASI);
		let P = [...bas.matchAll(KELIME)];
		let Tk = T.map((m) => kesmesiz(m[0]));
		for (let s = 0; s < P.length; s++) {
			if (!yakin(Tk[0], kesmesiz(P[s][0]))) {
				continue;
			}
			let j = s, esler = [];
			for (let t of Tk) {
				let bul = [j, j + 1].find((x) => P[x] && yakin(t, kesmesiz(P[x][0])));
				if (bul === undefined) {
					esler = null;
					break;
				}
				esler.push(P[bul]);
				j = bul + 1;
			}
			if (!esler || !esler.every((m, x) => degisebilir(T[x][0], m[0], sozluk))) {
				continue;
			}
			// kayıttaki başlık; farklı yazılan kelimeler PDF'ten
			let metin = "", son = 0;
			T.forEach((m, x) => {
				// harf düzeni, şapka/aksan ve kesme farkı üslup sayılır, kayıttaki yazım kalır; yalnızca harf farkı PDF'ten
				let p = esler[x][0];
				metin += baslik.slice(son, m.index) + (anahtar(m[0]) != anahtar(p) ? duzenUydur(p, m[0]) : m[0]);
				son = m.index + m[0].length;
			});
			metin += baslik.slice(son);
			let bitis = esler[esler.length - 1].index + esler[esler.length - 1][0].length;
			let geri = bas.slice(bitis);
			let ek = /[)(:]/.test(baslik) ? null
				: geri.match(/^[ \t]*\([^()\n]*(?:\n[^()\n]*){0,2}\)/) || geri.match(/^[ \t]*:[ \t]*(?:\n[ \t]*)?[^\n]+/);
			if (ek) {
				let e = ek[0].replace(/(\p{Ll})-\s*\n\s*(\p{Ll})/gu, "$1$2").replace(/\s+/g, " ").trim();
				if (e.startsWith(":")) {
					e = e.replace(/[\s\d|*]+$/u, "");     // alt başlığın sonundaki sayfa no / dipnot işareti
				}
				if (uzantiGecerli(e) && (e.match(/\p{L}+/gu) || []).every((w) => bilinir(w, sozluk))) {
					metin = metin.replace(/[\s.]+$/, "") + (e.startsWith(":") ? e : " " + e);
				}
			}
			return { metin: metin.replace(/\s+/g, " ").trim(), konum: esler[0].index };
		}
		return null;
	}

	/** Adı ya da soyadı bozuk yazarın (biri sağlam olmalı) PDF'teki tam adı: sağlam kısım PDF'te aranır, ardından gelen
	 *  baş harfler ve büyük harfle başlayan soyadı alınır. Soyadı TAMAMI BÜYÜK ise Türkçe yerelle düzeltilir. */
	function pdfYazar(y, pdf) {
		if (!pdf || !y || y.fieldMode == 1 || !(bozukAd(y.lastName) || bozukAd(y.firstName))) {
			return null;
		}
		let ad = bozukAd(y.firstName) ? "" : String(y.firstName || "").trim();
		if (!/^\p{L}{2,}/u.test(ad)) {
			return null;
		}
		let bas = pdf.slice(0, PDF_BASI);
		let katli = Array.from(bas).map((c) => katla(c)[0] || c).join("");
		let aranan = katla(ad);
		let i = -1;
		while ((i = katli.indexOf(aranan, i + 1)) >= 0) {
			let once = katli[i - 1] || " ";
			if (/\p{L}/u.test(once) || /\p{L}/u.test(katli[i + aranan.length] || " ")) {
				continue;
			}
			let m = bas.slice(i + aranan.length).match(/^\s*((?:\p{Lu}\.\s*)*)(\p{Lu}[\p{L}]{2,}(?:-\p{Lu}[\p{L}]{2,})?)/u);
			if (!m || /^(?:Prof|Doç|Doc|Dr|Arş|Yrd|Öğr)$/iu.test(m[2])) {
				continue;
			}
			let basHarfler = (m[1].match(/\p{Lu}/gu) || []).map((h) => h + ".").join(" ");
			let soyad = m[2] === dil.buyult(m[2], "tr")
				? m[2].split("-").map((p) => dil.buyult(p[0], "tr") + dil.kucult(p.slice(1), "tr")).join("-")
				: m[2];
			return { firstName: basHarfler ? `${ad} ${basHarfler}` : ad, lastName: soyad, fieldMode: 0 };
		}
		return null;
	}

	const KITAP_ALANLARI = ["place", "publisher", "date", "volume", "numberOfVolumes", "series", "edition", "ISBN"];
	const DERGI_ALANLARI = ["ISSN", "journalAbbreviation"];
	const KAP_ALANI = { bookSection: "bookTitle", conferencePaper: "proceedingsTitle", journalArticle: "publicationTitle" };

	/** Kütüphanedeki kayıtlardan künye listesi. Yalnızca kitap/dergi düzeyindeki alanlar alınır: aynı kitaptaki başka bir
	 *  bölümün sayfası ya da aynı dergideki başka bir makalenin cilt/sayısı başka esere ait olduğundan kopyalanmaz. */
	function kunyeIndeks(kayitlar) {
		let liste = [];
		for (let r of kayitlar || []) {
			let kapAlani = KAP_ALANI[r.itemType];
			let f = r.fields || {};
			if (!kapAlani || !f[kapAlani]) {
				continue;
			}
			let alanlar = {};
			for (let a of r.itemType == "journalArticle" ? DERGI_ALANLARI : KITAP_ALANLARI) {
				if (f[a]) {
					alanlar[a] = a == "date" ? String(f[a]).replace(/^\d{4}-\d{2}-\d{2} /, "") : f[a];
				}
			}
			liste.push({ key: r.key, itemType: r.itemType, baslik: f.title || "", kap: f[kapAlani], alanlar });
		}
		return liste;
	}

	/** K kelimeleri M içinde sırayla ve bitişik geçiyor mu: aralarına yalnızca kısa kelime / rakam ("ve", "of", "1-4")
	 *  girebilir. "Büyük İstanbul Tarihi"nin kelimeleri metne dağılmış olarak geçmesi, "Journal of Social Science"ın
	 *  "Journal of Current Social Science" içinde geçmesi yetmez. */
	function siraliGecer(K, M) {
		let kisa = (w) => w.length < 4 && !/^\d{3,}$/.test(w);
		for (let i = 0; i < M.length; i++) {
			if (!yakin(K[0], M[i])) {
				continue;
			}
			let j = i + 1, tamam = true;
			for (let t = 1; t < K.length && tamam; t++) {
				while (j < M.length && kisa(M[j]) && !yakin(K[t], M[j])) {
					j++;
				}
				tamam = j < M.length && yakin(K[t], M[j]);
				j++;
			}
			if (tamam) {
				return true;
			}
		}
		return false;
	}

	/** Metinde (PDF kapağı / üst bilgisi) adı geçen kütüphane künyesi. Künye adının 4+ harfli kelimeleri ve yılları
	 *  (OCR'a dayanıklı) metinde sırayla ve bir arada geçmeli; en az 3 ayırt edici kelime gerekir ("Danıştay Dergisi" tek başına yetmez).
	 *  Birden çok uyan varsa en çok kelimesi eşleşen, eşitse en çok alanı dolu olan seçilir. */
	function kunyeBul(metin, kunyeler, key) {
		let M = kelimeler(metin);
		if (!M.length) {
			return null;
		}
		let enIyi = null;
		for (let k of kunyeler || []) {
			if (k.key == key) {
				continue;
			}
			let K = kelimeler(k.kap).filter((w) => /^\d{3,}$/.test(w) || (/^\p{L}+$/u.test(w) && w.length >= 4));
			if (K.length < 3 || !siraliGecer(K, M)) {
				continue;
			}
			let puan = K.length * 100 + Object.keys(k.alanlar).length;
			if (!enIyi || puan > enIyi.puan) {
				enIyi = { kunye: k, puan };
			}
		}
		return enIyi && enIyi.kunye;
	}

	function bilinir(w, sozluk) {
		// kısa kelime, rakam ve kısaltma (İYUK, AİHM) sözlükte aranmaz
		return !sozluk || w.length < 4 || /\d/.test(w) || (w.length <= 6 && w === dil.buyult(w, "tr")) || siklik(w, sozluk) > 0;
	}

	const TUR_AD = { journalArticle: "Dergi makalesi", bookSection: "Kitap bölümü", conferencePaper: "Bildiri" };

	/** motor.analiz sonucuna PDF ve kütüphaneden çıkan önerileri katar; PDF başlığı motorun başlık önerisinin yerini alır. */
	function kaynakAnaliz(kayit, pdf, sonuc, ayarlar = {}) {
		let fields = kayit.fields || {};
		let oneriler = [...sonuc.oneriler];
		let uyarilar = [...sonuc.uyarilar];
		if (!pdf) {
			return { dil: sonuc.dil, oneriler, uyarilar };
		}
		let kaynakKural = (kural, aciklama) => [{ kural, aciklama, guven: "orta" }];

		// 1. başlık
		let pb = fields.title ? pdfBaslik(pdf, fields.title, ayarlar.kelimeSozluk) : null;
		if (pb) {
			let temiz = motor.analiz({ itemType: kayit.itemType, fields: { title: pb.metin, language: fields.language || sonuc.dil || "" } }, ayarlar);
			let yeni = (temiz.oneriler.find((o) => o.alan == "title") || {}).yeni || pb.metin;
			let eskiK = kelimeler(fields.title);
			if (yeni != fields.title && (kelimeler(yeni).join(" ") != eskiK.join(" ") || (yeni.match(/['’]/g) || []).length != (fields.title.match(/['’]/g) || []).length)
					&& yeni != (sonuc.oneriler.find((o) => o.alan == "title") || {}).yeni) {
				oneriler = oneriler.filter((o) => o.alan != "title" && o.alan != "shortTitle");
				oneriler.push(motor.oneriYap("title", fields.title, yeni, kaynakKural("kaynak.pdfBaslik", "Başlık PDF'in ilk sayfasındaki başlıkla değiştirildi; PDF'le karşılaştırın")));
				let kisa = harf.kisaBaslik(yeni);
				if (kisa && kisa != (fields.shortTitle || "") && (!fields.shortTitle || harf.kisaBaslikKesik(fields.shortTitle, yeni) || kelimeler(fields.shortTitle).join(" ") == kelimeler(harf.kisaBaslik(fields.title)).join(" "))
						&& (kayit.alanlar || ["shortTitle"]).includes("shortTitle")) {
					oneriler.push(motor.oneriYap("shortTitle", fields.shortTitle || "", kisa, kaynakKural("harf.kisaBaslikBos", "Kısa başlık PDF'teki başlıktan üretildi")));
				}
			}
		}

		// 2. bozuk yazar adı
		(kayit.creators || []).forEach((c, i) => {
			let y = pdfYazar(c, pdf);
			if (!y) {
				return;
			}
			let yeniYazar = { ...c, ...y };
			oneriler = oneriler.filter((o) => !(o.alan == "creators" && o.indeks == i));
			oneriler.push(motor.oneriYap("creators", motor.yazarMetni(c), motor.yazarMetni(yeniYazar),
				kaynakKural("kaynak.pdfYazar", `Bozuk yazar adı (“${bozukAd(c.lastName) ? c.lastName : c.firstName}”) PDF'teki adla düzeltildi`),
				{ indeks: i, eskiYazar: { firstName: c.firstName || "", lastName: c.lastName || "" }, yeniYazar }));
			uyarilar = uyarilar.filter((u) => !(u.alan == "creators" && u.indeks == i));
		});

		// 3. boş künye: PDF'in kapağında / başlıktan önceki kısmında kütüphanedeki bir kitap ya da dergi
		let kapAlani = KAP_ALANI[kayit.itemType];
		if (kapAlani && !fields[kapAlani] && !fields.date) {
			let bolge = pdf.slice(0, pb && pb.konum > 20 ? pb.konum : 1000);
			let k = kunyeBul(bolge, ayarlar.kunyeler, kayit.key);
			if (k) {
				let tur = kayit.itemType == "journalArticle" && k.itemType != "journalArticle" ? k.itemType : kayit.itemType;
				let nereden = `kütüphanedeki aynı ${k.itemType == "journalArticle" ? "dergiden" : "kitaptan"} (${k.key}: “${k.baslik}”), PDF'in kapağında adı geçiyor`;
				if (tur != kayit.itemType) {
					oneriler.push(motor.oneriYap("itemType", kayit.itemType, tur,
						kaynakKural("kaynak.kayitTuru", `Kayıt türü ${TUR_AD[kayit.itemType] || kayit.itemType} → ${TUR_AD[tur] || tur}: ${nereden}`)));
				}
				let ekle = (alan, deger) => {
					if (deger && !fields[alan] && !(alan == "journalAbbreviation" && deger == k.kap) && !oneriler.some((o) => o.alan == alan)) {
						oneriler.push(motor.oneriYap(alan, "", deger, kaynakKural("kaynak.kutuphaneKunye", `Künye ${nereden}`)));
					}
				};
				ekle(KAP_ALANI[tur], k.kap);
				for (let [a, v] of Object.entries(k.alanlar)) {
					ekle(a, v);
				}
			}
			else {
				uyarilar.push({ alan: kapAlani, mesaj: "Künye boş (yayın adı ve tarih yok); PDF'te kütüphanedeki bir kitap/dergiyle eşleşen künye bulunamadı" });
			}
		}
		return { dil: sonuc.dil, oneriler, uyarilar };
	}

	/** PDF'e bakmaya değer mi: künye boş (yayın adı ve tarih yok) ya da yazar adında dosya adı artığı var. */
	function gerekli(kayit) {
		let f = kayit.fields || {};
		let kap = KAP_ALANI[kayit.itemType];
		return Boolean((kap && !f[kap] && !f.date) || (kayit.creators || []).some((c) => bozukAd(c.lastName) || bozukAd(c.firstName)));
	}

	return { kaynakAnaliz, gerekli, pdfBaslik, pdfYazar, kunyeBul, kunyeIndeks, bozukAd, yakin, KAP_ALANI };
});
