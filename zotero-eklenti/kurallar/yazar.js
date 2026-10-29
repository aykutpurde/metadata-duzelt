/* Metadata Düzelt — yazar adı kuralları (saf fonksiyonlar).
 *
 * uygula(yazarlar, baglam) → { yazarlar, degisiklikler: [{ indeks, kural, aciklama, guven }], uyarilar }
 * yazar: { firstName, lastName, fieldMode (0: ad+soyad, 1: tek alan/kurum), creatorType }
 *
 * Kurallar: boşluk/NFC temizliği, unvan silme (Prof. Dr., Arş. Gör., Av.), "Soyad, Ad" ayırma,
 * tek alana yazılmış kişi adını ikiye bölme, TAMAMI BÜYÜK adı baş harfe çevirme (Türkçe yerel),
 * diakritiksiz Türkçe ad/soyadı sözlükle düzeltme (Yilmaz → Yılmaz).
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory(require("./dil.js"), require("./karakter.js"));
	}
	else {
		root.MetadataDuzeltKurallar = root.MetadataDuzeltKurallar || {};
		root.MetadataDuzeltKurallar.yazar = factory(root.MetadataDuzeltKurallar.dil, root.MetadataDuzeltKurallar.karakter);
	}
})(this, function (dil, karakter) {
	"use strict";

	// Unvan belirteci ya nokta ya da boşlukla bitmeli ("Dr A", "Prof. Dr. Ahmet"); "Fraser", "Peel" gibi adlar dokunulmaz kalır
	const UNVAN = /^(?:(?:prof|doç|doc|dr|arş|ars|gör|gor|yrd|öğr|ogr|üyesi|uyesi|av|avukat|hâkim|hakim|savcı|savci|assoc|asst|assistant|associate|professor|mr|mrs|ms|phd|ph\.d|md|llm|ll\.m|jd|j\.d|dipl|habil|emeritus|rev|sayın|sayin)(?:\.\s*|\s+))+/iu;
	const UNVAN_SON = /(?:(?:,\s*|\s+)(?:phd|ph\.d\.?|md|llm|ll\.m\.?|jd|j\.d\.?|esq\.?|dr\.?|\(dr\.?\)|\(prof\.?\)|\(ed\.?\)|\(eds\.?\)|\(hrsg\.?\)|\(çev\.?\)|\(der\.?\)|\(haz\.?\)))+\s*$/iu;
	const PARCACIK = new Set("von van der den de del della di da du la le des do dos das y e af zu zum zur ter ten op 't bin ibn binti al el ul".split(" "));
	const KURUM = /(üniversite|universit|bakanl|ministry|kurul|kurum|mahkeme|court|derne|vakf|vakıf|foundation|merkez|center|centre|enstit|institut|komisyon|commission|komite|committee|birli|union|dergi|journal|yayın|yayin|press|publish|daire|başkanl|baskanl|müdürl|mudurl|belediye|municipal|baro|bar assoc|ajans|agency|banka|bank|konsey|council|office|ofis|organi[sz]ation|örgüt|orgut|ministry|group|grup|association|society|board|nations|parliament|parlamento|meclis|assembly|department|service|hizmet|project|proje|program|fund|fon|chamber|oda|authority|otorite|school|okul|college|academy|akademi|network|ağı|partners|inc\b|ltd|gmbh|llc|a\.ş|aş\b|şti|t\.c\.|cumhuriyet|devlet|government|hükümet|hukumet|et al|editors?|eds?\.|law|hukuk|rights|hakları|studies|çalışmalar|türkiye|turkey|avrupa|europe|birleşmiş|united|international|uluslararası|milli|millî|national|federal|genel|general|komisyonu|sekreter|secretar|lab|team|ekip|working|çalışma|forum|platform|initiative|girişim|observatory|watch|wikipedia|anonim|anonymous|oecd|unesco|who|ilo|imf)/iu;
	const TURK_HARF = /[çğıöşüÇĞİÖŞÜ]/;
	// Kesin kurum sözcükleri (kişi adlarında geçmez); yalnızca uyarı için
	const KURUM_KESIN = /(?:^|\s)(?:üniversitesi|university|bakanlığı|ministry|belediyesi|municipality|bankası|bank|odası|derneği|vakfı|foundation|kurumu|kurulu|merkezi|enstitüsü|institute|council|commission|department|office|başkanlığı|müdürlüğü|genel\s+müdürlüğü|mahkemesi|court|dergisi|journal|yayınları|press|a\.ş\.?|ltd\.?|gmbh|plc|inc\.?)(?:\s|$)/iu;

	// Diakritiksiz yazılmış sık Türkçe ad/soyadları (ASCII küçük harf → kanonik)
	const DIAKRITIK = new Map(Object.entries({
		yilmaz: "Yılmaz", yildiz: "Yıldız", yildirim: "Yıldırım", kilic: "Kılıç", kilinc: "Kılınç", celik: "Çelik", cetin: "Çetin", cakir: "Çakır", cakmak: "Çakmak",
		ciftci: "Çiftçi", coban: "Çoban", colak: "Çolak", gunes: "Güneş", gunduz: "Gündüz", guler: "Güler", gunay: "Günay", gumus: "Gümüş", ucar: "Uçar",
		yucel: "Yücel", simsek: "Şimşek", sahin: "Şahin", sener: "Şener", senturk: "Şentürk", senol: "Şenol", erdogan: "Erdoğan", dogan: "Doğan", dogru: "Doğru",
		koc: "Koç", kocak: "Koçak", taskin: "Taşkın", aydin: "Aydın", aydogan: "Aydoğan", akgul: "Akgül", akyuz: "Akyüz", ates: "Ateş",
		gokce: "Gökçe", goksel: "Göksel", gurbuz: "Gürbüz", inan: "İnan", inci: "İnci", isler: "İşler", karagoz: "Karagöz", kucuk: "Küçük",
		kurtulus: "Kurtuluş", oguz: "Oğuz", oktem: "Öktem", onder: "Önder", ozturk: "Öztürk", ozdemir: "Özdemir", ozkan: "Özkan", ozcan: "Özcan", ozer: "Özer", ozel: "Özel",
		ozgen: "Özgen", ozbek: "Özbek", ozay: "Özay", ozsoy: "Özsoy", ozgur: "Özgür", ozgen: "Özgen", sagir: "Sağır", soylemez: "Söylemez", turk: "Türk",
		turkoglu: "Türkoğlu", ulku: "Ülkü", unal: "Ünal", unlu: "Ünlü", ustun: "Üstün", yagci: "Yağcı", yasar: "Yaşar", yigit: "Yiğit", yuksel: "Yüksel", buyuk: "Büyük",
		gozler: "Gözler", gunday: "Günday", ozbudun: "Özbudun", tanor: "Tanör", kaboglu: "Kaboğlu", ayse: "Ayşe", omer: "Ömer", gokhan: "Gökhan", cagri: "Çağrı",
		ilker: "İlker", seyda: "Şeyda", sule: "Şule", serife: "Şerife", suleyman: "Süleyman", huseyin: "Hüseyin", ibrahim: "İbrahim", ismail: "İsmail", irem: "İrem",
		ilknur: "İlknur", gulsum: "Gülsüm", ozlem: "Özlem", oznur: "Öznur", cigdem: "Çiğdem", sukru: "Şükrü", isik: "Işık", yesim: "Yeşim", asli: "Aslı", busra: "Büşra",
		kubra: "Kübra", ugur: "Uğur", tugba: "Tuğba", tugce: "Tuğçe", seckin: "Seçkin", gurkan: "Gürkan", sukran: "Şükran", fusun: "Füsun", ozge: "Özge", ilhan: "İlhan",
		ismet: "İsmet", ilyas: "İlyas", gokay: "Gökay", gokalp: "Gökalp", cagatay: "Çağatay", cagla: "Çağla", sebnem: "Şebnem", sule: "Şule", cigdem: "Çiğdem",
		yagmur: "Yağmur", dogukan: "Doğukan", gunes: "Güneş", ulas: "Ulaş", bariş: "Barış", baris: "Barış", gurcan: "Gürcan", gursel: "Gürsel", nilufer: "Nilüfer",
	}));

	function temizle(s) {
		return karakter.bosluk(karakter.gorunmez(karakter.nfc(s || "")), { alan: "creator" });
	}

	function unvanSil(s) {
		let y = s.replace(UNVAN, "").replace(UNVAN_SON, "").trim();
		return y ? y : s;
	}

	function tamamiBuyuk(s) {
		let L = s.match(/\p{L}/gu) || [];
		if (L.length < 2 || !L.every((c) => c === c.toLocaleUpperCase("tr") && c !== c.toLocaleLowerCase("tr"))) {
			return false;
		}
		// "J.B.", "SC", "A.Ş." gibi baş harf/kısaltmalar değil: en az bir 3+ harfli kelime olmalı
		return /\p{L}{3,}/u.test(s.replace(/\./g, " "));
	}

	function basHarf(s, d) {
		return s.split(/(\s+|-)/).map((w, i) => {
			if (!w || /^\s+$|^-$/.test(w)) {
				return w;
			}
			let low = w.toLocaleLowerCase(d);
			if (PARCACIK.has(low)) {
				return low;
			}
			if (/^(?:\p{L}\.?){1,2}$/u.test(w) || /^(?:\p{Lu}\.)+\p{Lu}?\.?$/u.test(w)) {
				return w.toLocaleUpperCase(d);   // baş harf: A., M, J.B., H.Ş.
			}
			let j = low.search(/\p{L}/u);
			return j < 0 ? w : low.slice(0, j) + low[j].toLocaleUpperCase(d) + low.slice(j + 1);
		}).join("");
	}

	function diakritik(s) {
		return s.split(/(\s+|-)/).map((w) => {
			let k = w.toLowerCase();
			if (DIAKRITIK.has(k)) {
				return DIAKRITIK.get(k);
			}
			return w.replace(/oglu$/i, "oğlu");
		}).join("");
	}

	function kisiGibi(ad) {
		let ws = ad.split(/\s+/);
		return ws.length >= 2 && ws.length <= 3 && !KURUM.test(ad) && !/\d|[&\/@()]/.test(ad)
			&& ws.every((w) => /^\p{Lu}[\p{L}'’.-]*$/u.test(w));
	}

	function uygula(yazarlar, baglam = {}) {
		let degisiklikler = [];
		let uyarilar = [];
		let sonuc = (yazarlar || []).map((y, i) => {
			let c = { firstName: y.firstName || "", lastName: y.lastName || "", fieldMode: y.fieldMode || 0, creatorType: y.creatorType };
			let kurallar = [];
			let ekle = (kural, aciklama, guven) => kurallar.push({ kural: "yazar." + kural, aciklama, guven });
			let onceki = JSON.stringify(c);

			let f = temizle(c.firstName), l = temizle(c.lastName);
			if (f != c.firstName || l != c.lastName) {
				ekle("temizle", "Boşluk / görünmez karakter / i̇ artığı temizlendi", "yuksek");
				c.firstName = f;
				c.lastName = l;
			}

			if (c.fieldMode == 0) {
				f = unvanSil(c.firstName);
				l = unvanSil(c.lastName);
				if (f != c.firstName || l != c.lastName) {
					ekle("unvan", "Unvan (Prof. Dr., Arş. Gör., Av. …) silindi", "yuksek");
					c.firstName = f;
					c.lastName = l;
				}
				if (!c.firstName && /^[^,]+,\s*[^,]+$/.test(c.lastName)) {
					let [soy, ad] = c.lastName.split(/\s*,\s*/);
					ekle("virgul", "“Soyad, Ad” biçimi ad ve soyada ayrıldı", "orta");
					c.lastName = soy.trim();
					c.firstName = ad.trim();
				}
				else if (!c.lastName && /\s/.test(c.firstName.trim()) && kisiGibi(c.firstName.trim())) {
					let ws = c.firstName.trim().split(/\s+/);
					ekle("soyadBos", "Soyadı boş; adın son kelimesi soyadı yapıldı", "orta");
					c.lastName = ws.pop();
					c.firstName = ws.join(" ");
				}
			}
			else {
				let t = unvanSil(c.lastName);
				if (/^[^,]+,\s*[^,]+$/.test(t) && kisiGibi(t.replace(",", ""))) {
					let [soy, ad] = t.split(/\s*,\s*/);
					ekle("virgul", "Tek alandaki “Soyad, Ad” iki alana ayrıldı", "orta");
					c.fieldMode = 0;
					c.lastName = soy.trim();
					c.firstName = ad.trim();
				}
				else if (baglam.dil == "tr" && kisiGibi(t) && !tamamiBuyuk(t) && TURK_HARF.test(t)) {
					uyarilar.push({ indeks: i, mesaj: `Tek alana yazılmış kişi adı olabilir: “${t}” (ad/soyadı elle ayırın)` });
				}
			}

			// iki alana bölünmüş kurum adı ("ÜSKÜDAR" + "ÜNİVERSİTESİ"): değiştirilmez, uyarı verilir
			if (c.fieldMode == 0 && KURUM_KESIN.test(dil.kucult((c.firstName + " " + c.lastName).trim(), "tr"))) {
				uyarilar.push({ indeks: i, mesaj: `Kurum adı iki alana bölünmüş olabilir: “${c.firstName} / ${c.lastName}” (tek alan yapın)` });
			}

			let d = TURK_HARF.test(c.firstName + c.lastName) || baglam.dil == "tr" ? "tr" : "en-US";
			if (c.fieldMode == 0) {
				let fb = tamamiBuyuk(c.firstName), lb = tamamiBuyuk(c.lastName);
				if (!c.firstName && /^\p{Lu}{2,6}$/u.test(c.lastName)) {
					lb = false;   // TESEV, OECD: kısaltma
				}
				if (fb || lb) {
					ekle("buyukHarf", "TAMAMI BÜYÜK ad baş harfe çevrildi", "yuksek");
					if (fb) {
						c.firstName = basHarf(c.firstName, d);
					}
					if (lb) {
						c.lastName = basHarf(c.lastName, d);
					}
				}
			}
			else if (tamamiBuyuk(c.lastName) && /\s/.test(c.lastName.trim()) && (c.lastName.match(/\p{L}{4,}/gu) || []).length >= 2) {
				ekle("kurumBuyuk", "TAMAMI BÜYÜK kurum adı Her Kelime Büyük yapıldı", "orta");
				c.lastName = basHarf(c.lastName, d);
			}

			if (baglam.dil == "tr" && c.fieldMode == 0) {
				f = diakritik(c.firstName);
				l = diakritik(c.lastName);
				if (f != c.firstName || l != c.lastName) {
					ekle("diakritik", "Diakritiksiz Türkçe ad/soyadı düzeltildi (Yilmaz → Yılmaz)", "orta");
					c.firstName = f;
					c.lastName = l;
				}
			}

			if (c.fieldMode == 0 && c.lastName && /^\p{Ll}/u.test(c.lastName) && !PARCACIK.has(c.lastName.split(/\s+/)[0].toLocaleLowerCase("tr"))) {
				uyarilar.push({ indeks: i, mesaj: `Soyadı küçük harfle başlıyor: “${c.lastName}” (gerçek bir ad olmayabilir)` });
			}
			if (c.fieldMode == 0 && !c.lastName && !c.firstName) {
				uyarilar.push({ indeks: i, mesaj: "Boş yazar" });
			}

			if (JSON.stringify(c) != onceki) {
				degisiklikler.push({
					indeks: i,
					eski: { firstName: y.firstName || "", lastName: y.lastName || "", fieldMode: y.fieldMode || 0 },
					yeni: { firstName: c.firstName, lastName: c.lastName, fieldMode: c.fieldMode },
					kurallar,
					guven: kurallar.some((k) => k.guven == "orta") ? "orta" : "yuksek",
				});
			}
			return c;
		});
		return { yazarlar: sonuc, degisiklikler, uyarilar };
	}

	return { uygula, unvanSil, basHarf, diakritik, kisiGibi, tamamiBuyuk, DIAKRITIK, PARCACIK };
});
