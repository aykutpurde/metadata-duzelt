/* Metadata Düzelt — büyük/küçük harf kuralları (saf fonksiyonlar).
 *
 * uygula(metin, baglam) → { metin, degisiklikler }
 * baglam: { alan, dil: "tr"|"en"|…, stil: "baslik"|"cumle"|"dokunma", titleCaseDonustur: bool, istisnalar: Map|Array }
 *
 * baslikDuzeni(metin, baglam): TDK başlık kuralı — her kelime büyük harfle başlar; "ve, ile, ya, veya, yahut,
 *   ki, da, de" bağlaçları ve "mı/mi/mu/mü" soru eki küçük kalır (ilk kelime ve iki nokta/tire sonrası hep büyük).
 *   Türkçe eser başlıklarının varsayılanı; dergi/kurum adları için de kullanılır. İngilizcede Title Case:
 *   a, an, the, and, of, in, for… küçük (Latince "In Dubio", Roma rakamı "V" hariç).
 * cumleDuzeni(metin, baglam): yalnızca ilk harf, iki nokta/soru/ünlem sonrası, kısaltmalar, özel adlar
 *   ve kesme işaretli kelimeler (Türkiye'de, AİHM'nin) büyük kalır. Türkçe yerel: I→ı, İ→i.
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory(require("./dil.js"));
	}
	else {
		root.MetadataDuzeltKurallar = root.MetadataDuzeltKurallar || {};
		root.MetadataDuzeltKurallar.harf = factory(root.MetadataDuzeltKurallar.dil);
	}
})(this, function (dil) {
	"use strict";

	// Büyük kalacak kısaltmalar (büyük harfli biçim). Kullanıcı istisna listesiyle genişletilebilir.
	const KISALTMALAR = new Set(`AİHM AİHS AYM TBMM TCK CMK HMK İYUK TMK TBK TTK İİK KVKK YÖK BM AB ABD AGİT NATO ÇED BİM İDDK DİDDK VDDK HSK HSYK
RTÜK BDDK SPK EPDK BTK KHK OHAL TRT TÜİK TÜBİTAK TDK TSK MİT MEB SGK KDV ÖTV KKTC AKP CHP MHP HDP İHEB UNESCO UNICEF WHO WTO IMF ILO
EU UK US USA UN AI GDPR ECHR ECtHR CJEU ICJ ICC NGO NGOs COVID COVID-19 ChatGPT GPT LLM IoT API AR-GE STK TMMOB DSİ TOKİ PTT İŞKUR MASAK
SEGBİS UYAP BİMER CİMER TİHEK KİK KİT BOTAŞ TPAO TEDAŞ EÜAŞ ETKB MAPEG MTA MİGEM MGM KGM DHMİ TCDD ÇŞB TKDK GSM TV DNA CO2 IT ICT
OECD AGİT AİHK BMMYK UNHCR NATO ILO WIPO WWF IUCN IPCC UNFCCC COP COP26 COP27 COP28 EEA EFTA CEDAW ICCPR ICESCR UNCLOS PACE
TCMB BİST KOSGEB OSB KOBİ İSO İTO ATO TOBB TÜSİAD MÜSİAD DİSK TÜRK-İŞ HAK-İŞ KESK TTB TBB TÜRMOB AYİM ASYM YSK RG TC T.C. E. K.
D. HGK CGK İBK GmbH AG SA SpA Ltd LLC Inc PhD LLM LL.M. UYAP e-Devlet e-İmza AB-ABD ABAD AİHMK CEDAW ICSID UNCITRAL WTO GATT
NAFTA ASEAN BRICS G20 G7 OPEC IAEA IEA HUMK CMUK MK BK VUK DMK AATUHK ÇK PVSK FSEK SMK TKHK MÖHUK KMK İSG GVK KVK DSÖ`.split(/\s+/).filter(Boolean));

	// Özel adlar: kanonik biçim. Uzun ifadeler önce eşleştirilir.
	const OZEL_ADLAR_TR = `Avrupa İnsan Hakları Mahkemesi|Avrupa İnsan Hakları Sözleşmesi|Avrupa İnsan Hakları Komisyonu|Avrupa Birliği Adalet Divanı|Avrupa Birliği Temel Haklar Şartı|Avrupa Birliği|Avrupa Konseyi|Avrupa Parlamentosu|Avrupa Komisyonu|Avrupa Yeşil Mutabakatı|Avrupa Sosyal Şartı|Birleşmiş Milletler|Anayasa Mahkemesi|Türkiye Büyük Millet Meclisi|Danıştay İdari Dava Daireleri Kurulu|Danıştay Vergi Dava Daireleri Kurulu|Bölge İdare Mahkemesi|Bölge Adliye Mahkemesi|Yargıtay Hukuk Genel Kurulu|Yargıtay Ceza Genel Kurulu|Uyuşmazlık Mahkemesi|Kamu Denetçiliği Kurumu|Kişisel Verileri Koruma Kurulu|Kişisel Verileri Koruma Kurumu|Kişisel Verilerin Korunması Kanunu|Türk Ceza Kanunu|Türk Medeni Kanunu|Türk Medenî Kanunu|Türk Borçlar Kanunu|Türk Ticaret Kanunu|İdari Yargılama Usulü Kanunu|Ceza Muhakemesi Kanunu|Hukuk Muhakemeleri Kanunu|İcra ve İflas Kanunu|İş Kanunu|Çevre Kanunu|Maden Kanunu|İmar Kanunu|Kamu İhale Kanunu|Kamulaştırma Kanunu|Bilgi Edinme Hakkı Kanunu|Devlet Memurları Kanunu|Belediye Kanunu|Büyükşehir Belediyesi Kanunu|Kabahatler Kanunu|Vergi Usul Kanunu|Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu|Kanun Hükmünde Kararname|Cumhurbaşkanlığı Kararnamesi|sayılı Kanun|sayılı Cumhurbaşkanlığı Kararnamesi|sayılı Kanun Hükmünde Kararname|sayılı Yönetmelik|Cumhurbaşkanlığı|Cumhurbaşkanı|Osmanlı Devleti|Osmanlı İmparatorluğu|Osmanlı|Türkiye Cumhuriyeti|Türkiye|Türk|Türkçe|Avrupa|Amerika Birleşik Devletleri|Amerika|Amerikan|Almanya|Alman|Fransa|Fransız|İngiltere|İngiliz|Birleşik Krallık|İtalya|İtalyan|İspanya|Hollanda|İsviçre|Avusturya|Rusya|Rus|Çin|Japonya|Yunanistan|Kıbrıs|Suriye|Irak|İran|Azerbaycan|Ukrayna|Polonya|Belçika|İsveç|Norveç|Danimarka|Finlandiya|Kanada|Avustralya|Hindistan|Brezilya|Pakistan|Afrika|Asya|Ortadoğu|Orta Doğu|Balkanlar|Kafkasya|Akdeniz|Karadeniz|Ege|Marmara|Anadolu|Trakya|Ankara|İstanbul|İzmir|Bursa|Antalya|Diyarbakır|Konya|Adana|Muğla|Çanakkale|Edirne|Trabzon|Samsun|Erzurum|Van|Paris|Londra|Strazburg|Lüksemburg|Brüksel|Berlin|Viyana|Roma|Washington|Lahey|Cenevre|Anayasa|Danıştay|Yargıtay|Sayıştay|Meclis|İslam|İslami|Hristiyan|Hıristiyan|Yahudi|Musevi|Kur'an|Kur’an|Bizans|Selçuklu|Atatürk|Tanzimat|Meşrutiyet|Cumhuriyet|Paris Anlaşması|Paris İklim Anlaşması|Kyoto Protokolü|Stockholm|Rio|Aarhus Sözleşmesi|Lizbon Antlaşması|Maastricht|Roma Statüsü|Cenevre Sözleşmesi|Covid-19|Kovid-19|Dünya Bankası|Dünya Sağlık Örgütü|Dünya Ticaret Örgütü|Uluslararası Adalet Divanı|Uluslararası Ceza Mahkemesi|Uluslararası Çalışma Örgütü|Uluslararası Para Fonu|Venedik Komisyonu|Federal Anayasa Mahkemesi|Alman Federal Anayasa Mahkemesi|Fransız Danıştayı|Conseil d'État|Conseil d’État|Conseil d'Etat|Conseil d’Etat|Conseil Constitutionnel|Bundesverfassungsgericht|Yüksek Seçim Kurulu|Hâkimler ve Savcılar Kurulu|Hakimler ve Savcılar Kurulu|Radyo ve Televizyon Üst Kurulu|Rekabet Kurumu|Rekabet Kurulu|Sermaye Piyasası Kurulu|Bankacılık Düzenleme ve Denetleme Kurumu|Enerji Piyasası Düzenleme Kurumu|Bilgi Teknolojileri ve İletişim Kurumu|Kamu İhale Kurumu|Kamu Gözetimi Kurumu|Milli Eğitim Bakanlığı|Millî Eğitim Bakanlığı|Sağlık Bakanlığı|Adalet Bakanlığı|İçişleri Bakanlığı|Dışişleri Bakanlığı|Çevre, Şehircilik ve İklim Değişikliği Bakanlığı|Çevre ve Şehircilik Bakanlığı|Enerji ve Tabii Kaynaklar Bakanlığı|Tarım ve Orman Bakanlığı|Hazine ve Maliye Bakanlığı|Maden ve Petrol İşleri Genel Müdürlüğü|Devlet Su İşleri|Orman Genel Müdürlüğü|Karayolları Genel Müdürlüğü|Türkiye İstatistik Kurumu|Türkiye Barolar Birliği|Türkiye Odalar ve Borsalar Birliği|Ankara Barosu|İstanbul Barosu|Ankara Üniversitesi|İstanbul Üniversitesi|Galatasaray Üniversitesi|Marmara Üniversitesi|Hacettepe Üniversitesi|Gazi Üniversitesi|Dokuz Eylül Üniversitesi|Selçuk Üniversitesi|Akdeniz Üniversitesi|Bilkent Üniversitesi|Koç Üniversitesi|Yıldırım Beyazıt|Hacı Bayram Veli|Rawls|Kant|Hegel|Kelsen|Schmitt|Dworkin|Hart|Habermas|Marx|Weber|Duguit|Hauriou|Montesquieu|Rousseau|Locke|Hobbes|Aristoteles|Aristo|Platon|Sokrates|Foucault|Luhmann|Fuller|Radbruch|Jellinek|Laband|Otto Mayer|Carl Schmitt|Hans Kelsen|John Rawls|Jürgen Habermas|Ronald Dworkin|Léon Duguit|Maurice Hauriou|Karl Renner|Karl Marx|Max Weber|Niklas Luhmann|Gustav Radbruch|Onar|Duran|Günday|Gözler|Özbudun|Tanör|Kaboğlu|Sancar|Google|Microsoft|OpenAI|Meta|Facebook|Twitter|Amazon|Apple|Tesla|Urgenda|Marmara Denizi|Kaz Dağları|İkizköy|Akbelen|Kirazlı|Cerattepe|Bergama|Fırat|Dicle|Kızılırmak|Sakarya`.split("|");

	const OZEL_ADLAR_EN = `European Union|European Court of Human Rights|European Convention on Human Rights|European Commission|European Parliament|Council of Europe|Court of Justice of the European Union|United Nations|United States|United Kingdom|Turkey|Türkiye|Turkish|Europe|European|America|American|Germany|German|France|French|England|English|Britain|British|Italy|Italian|Spain|Spanish|Netherlands|Dutch|Switzerland|Swiss|Austria|Austrian|Russia|Russian|China|Chinese|Japan|Japanese|India|Indian|Pakistan|Pakistani|Brazil|Brazilian|Colombia|Australia|Australian|Canada|Canadian|Africa|African|Asia|Asian|Latin America|Middle East|Ottoman|Roman|Greek|Islamic|Islam|Christian|Jewish|Muslim|Paris Agreement|Kyoto Protocol|Aarhus Convention|Stockholm|Rio|Geneva|Strasbourg|Luxembourg|Brussels|London|Paris|Berlin|Washington|New York|Supreme Court|Constitutional Court|Conseil d'État|Conseil d’État|Conseil d'Etat|Conseil d’Etat|World Health Organization|World Bank|World Trade Organization|International Court of Justice|International Criminal Court|International Labour Organization|Rawls|Kant|Hegel|Kelsen|Dworkin|Habermas|Hart|Fuller|Schmitt|Montesquieu|Rousseau|Locke|Hobbes|Aristotle|Plato|Socrates|Foucault|Luhmann|Weber|Marx|John Rawls|Hans Kelsen|Carl Schmitt|Ronald Dworkin|Jürgen Habermas|ChatGPT|Google|Microsoft|OpenAI|Facebook|Twitter|Amazon|Apple|Tesla|Urgenda|COVID-19|Covid-19|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|June|July|August|September|October|November|December|Anthropocene|Internet`.split("|");

	// Her Kelime Büyük düzeninde küçük kalanlar: TDK listesi (bağlaçlar + soru eki) ve karar künyesi kısaltmaları (v. vs. c.)
	const KUCUK_TR = new Set(("ve ile ya veya yahut veyahut ki da de mi mı mu mü"
		+ " v vs c m md f s bkz vd vb krş"                      // atıf kısaltmaları: v. (versus), m. (madde), f. (fıkra), s. (sayfa)
		+ " and of the or to for nor with from by").split(" "));   // Türkçe başlık içindeki İngilizce karar/eser adları (Türkçede karşılığı olmayanlar)
	const KUCUK_EN = new Set("a an the and or but nor of in on at to for by with from as v vs via per".split(" "));
	// Karışık yazımlı kısaltmalar (e-Devlet, ChatGPT, GmbH…) küçük harfli anahtarla: "E-DEVLET" → "e-Devlet"
	const KISALTMA_KUCUK = new Map([...KISALTMALAR].filter((k) => k !== k.toUpperCase()).map((k) => [dil.kucult(k, "tr"), k]));
	// Title Case sezgisi: bu kelimelerden biri büyük yazılmışsa başlık Title Case'dir
	const ISLEV_TR = new Set("ve ile veya ya bir bu şu için olarak üzerine hakkında ilişkin açısından bağlamında arasında sonra önce gibi kadar daha çok mi mı mu mü ki ancak ise göre karşı ilgili ışığında çerçevesinde bakımından yoluyla aracılığıyla hükmünde sayılı tarihli dair yönelik doğru üzerinden olan olup olarak açısından yönünden içinde dışında arasındaki üzerindeki hakkındaki ilişkindeki".split(" "));

	const IZAFET = /^[yY]?[ıiuüIİUÜ]$/u;

	/** İngilizce Title Case başlıkta büyük yazılmış küçük kelimeler: "Challenges Of Invoking … Before The Court" → "of", "the".
	 *  Yalnızca bu kelimelerin ilk harfi küçülür; ilk kelime ve iki nokta/soru/tire sonrası büyük kalır. */
	const LATINCE = /^(?:dubio|situ|re|rem|vitro|vivo|personam|abstracto|concreto|loco|camera|toto|absentia|extremis|limine|facto|jure|se)$/i;

	function ingilizceKucukKelimeler(metin) {
		let capNext = true;
		let tokens = metin.split(/(\s+)/);
		return tokens.map((tok, i) => {
			if (!tok || /^\s+$/.test(tok)) {
				return tok;
			}
			let { on, core, son } = parcala(tok);
			if (!core) {
				if (/[:?!.–—]/.test(tok)) {
					capNext = true;
				}
				return tok;
			}
			if (on.startsWith("(") && son.endsWith(")")) {
				return tok;     // "(23) The LLM…": parantez içi numara sonraki kelimeyi etkilemez
			}
			let zorunlu = capNext || /[("“‘]$/.test(on);
			capNext = sonrakiBuyuk(core, son);
			let sonraki = parcala(tokens[i + 2] || "").core;
			if (!zorunlu && /^\p{Lu}\p{Ll}*$/u.test(core) && KUCUK_EN.has(core.toLowerCase())
					&& core != "V" && !LATINCE.test(sonraki)) {   // "Values V": Roma rakamı; "In Dubio", "Per Se": Latince
				return on + core.toLowerCase() + son;
			}
			return tok;
		}).join("");
	}

	function harfler(s) {
		return s.match(/\p{L}/gu) || [];
	}

	function buyukMu(c, d) {
		return c === dil.buyult(c, d) && c !== dil.kucult(c, d);
	}

	/** Harflerinin %85'i büyük ve en az iki uzun (4+) kelime: "TÜRK İDARE HUKUKUNDA KAMU YARARI". Karar künyeleri ("D13D, E. 2018/1891") geçmez. */
	function tamamiBuyuk(s, d = "tr") {
		let L = harfler(s);
		if (L.length < 4) {
			return false;
		}
		let uzun = s.match(/\p{L}{4,}/gu) || [];
		if (uzun.length < 2) {
			return false;
		}
		return L.filter((c) => buyukMu(c, d)).length / L.length >= 0.85;
	}

	/** "Türkiye Madencilik Sektörü İçin Bir Politika Çerçevesi": kelimelerin %80'i büyük başlıyor ve bir işlev kelimesi büyük yazılmış. */
	function titleCaseGibi(s) {
		let ws = s.split(/\s+/).filter((w) => /\p{L}/u.test(w));
		if (ws.length < 3 || tamamiBuyuk(s)) {
			return false;
		}
		let ilk = (w) => (w.match(/\p{L}/u) || [""])[0];
		let caps = ws.filter((w) => ilk(w) && buyukMu(ilk(w), "tr"));
		if (caps.length / ws.length < 0.8) {
			return false;
		}
		let islevBuyuk = ws.some((w) => ISLEV_TR.has(dil.kucult(w.replace(/[^\p{L}]/gu, ""), "tr")) && buyukMu(ilk(w), "tr"));
		return islevBuyuk || (ws.length >= 5 && caps.length / ws.length >= 0.9);
	}

	/** Başlığın içindeki TAMAMI BÜYÜK kelime koşuları ("KAMU MALİ KRİZİ VE YEREL YÖNETİMLER -Yerel Yönetimlerin…").
	 *  Koşu, kısaltma listesinde olmayan en az iki uzun (4+) kelime içermeli; "AİHM ve AB", "TBMM KHK" koşu sayılmaz.
	 *  Dönüş: tokens (metin.split(/(\s+)/)) dizisiyle aynı boyda boolean dizi. */
	function buyukKosular(tokens, d) {
		let isaret = tokens.map(() => false);
		let kosu = [];
		let kapat = () => {
			let uzun = kosu.filter((i) => {
				let core = parcala(tokens[i]).core;
				return harfler(core).length >= 4 && !KISALTMALAR.has(dil.buyult(core, d)) && !KISALTMALAR.has(core);
			});
			if (uzun.length >= 2) {
				kosu.forEach((i) => { isaret[i] = true; });
			}
			kosu = [];
		};
		tokens.forEach((tok, i) => {
			if (!tok || /^\s+$/.test(tok)) {
				return;
			}
			let L = harfler(parcala(tok).core);
			if (!L.length) {
				return;      // yalnızca noktalama: koşuyu bölmez
			}
			if (L.every((c) => buyukMu(c, d))) {
				kosu.push(i);
			}
			else if (kosu.length && (KUCUK_TR.has(parcala(tok).core) || KUCUK_EN.has(parcala(tok).core))) {
				// "İÇTİHADÎ mi OLMALI?", "KRİZİ ve YEREL": küçük bağlaç/soru eki koşuyu bölmez
			}
			else {
				kapat();
			}
		});
		kapat();
		return isaret;
	}

	function buyukKosuVar(metin, d = "tr") {
		return buyukKosular(metin.split(/(\s+)/), d).some(Boolean);
	}

	function romen(core, son) {
		let u = core.toUpperCase();
		if (!/^(?=[IVXLCDM])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(u)) {
			return false;
		}
		return u.length >= 2 || (son || "").startsWith(".");
	}

	const NOKTALI_KISALTMA = /^(?:vs|vb|vd|bkz|krş|m|md|f|s|c|no|nr|vol|cilt|sayı|pp|bd|st|ltd|inc|co|jr|sr|dr|prof|doç|av)$/iu;

	/** Bu kelimeden sonraki kelime zorunlu büyük mü? Cümle sonu, iki nokta, soru/ünlem, uzun tire: evet.
	 *  Nokta: evet, ama "3." / "II." sıra sayıları, tek harf ("E.") ve "vs." gibi kısaltmalardan sonra hayır. */
	function sonrakiBuyuk(core, son) {
		if (/[:?!]["”’)]?$|[–—]$/.test(son)) {
			return true;
		}
		if (!/\.["”’)]?$/.test(son)) {
			return false;
		}
		return !(/^\p{N}+$/u.test(core) || romen(core, son) || harfler(core).length < 2 || NOKTALI_KISALTMA.test(core));
	}

	function istisnaHaritasi(istisnalar) {
		if (istisnalar instanceof Map) {
			return istisnalar;
		}
		let m = new Map();
		for (let s of istisnalar || []) {
			let t = String(s).trim();
			if (t && !t.startsWith("#")) {
				m.set(dil.kucult(t, "tr"), t);
			}
		}
		return m;
	}

	/** Tek bir kelime çekirdeğini (noktalamasız) cümle düzenine çevirir. */
	function kelime(core, o) {
		let d = o.d;
		let ap = core.match(/^(.+?)(['’])(\p{L}{1,10})$/u);
		if (ap && d == "tr") {
			if (!o.allCaps && buyukMu(ap[3][0], d)) {
				return core;              // d’Etat, O’Brien, l’Homme: Türkçe ek değil
			}
			// Türkiye'de, AİHM'nin, Renner'in: kesmeden önceki parça özel ad sayılır
			return kelime(ap[1], { ...o, cap: true }) + ap[2] + dil.kucult(ap[3], d);
		}
		let up = dil.buyult(core, d);
		if (KISALTMALAR.has(up) || KISALTMALAR.has(core)) {
			return KISALTMALAR.has(core) ? core : up;
		}
		if (KISALTMA_KUCUK.has(dil.kucult(core, "tr"))) {
			return KISALTMA_KUCUK.get(dil.kucult(core, "tr"));   // e-Devlet, ChatGPT, GmbH
		}
		if (/^[\p{L}\p{N}.]+[-\/][\p{L}\p{N}.\/-]+$/u.test(core) && !/^\d+$/.test(core)) {
			let parcalar = core.split(/([-\/])/);
			// cümle düzeninde yalnızca ilk parça (Sosyo-ekonomik); Her Kelime Büyük'te her parça (Sosyo-Ekonomik)
			// izafet eki (Islah-ı, Kanun-ı Esasi, Şûrâ-yı Devlet) hiç büyümez
			return parcalar.map((p, i) => (i % 2 ? p : kelime(p, { ...o, cap: o.cap && (i == 0 || (o.herParca && !IZAFET.test(p))) }))).join("");
		}
		if (/^(\p{Lu}\.)+\p{Lu}?$/u.test(up) && core.length <= 8) {
			return up;   // T.C., A.Ş., U.S.
		}
		if (/^(?:m|md|mad)$/iu.test(core) && (o.son || "").startsWith(".")) {
			return dil.kucult(core, d);   // madde kısaltması "m." Roma rakamı (M = 1000) değil
		}
		if (romen(core, o.son)) {
			return up;
		}
		let L = harfler(core);
		if (!o.allCaps) {
			if (/\d/.test(core)) {
				return core;              // COVID-19, 5G, 2023
			}
			if (L.length >= 2 && core === up) {
				return core;              // zaten büyük: kısaltma
			}
			if (L.slice(1).some((c) => buyukMu(c, d))) {
				return core;              // iç büyük harf: McDonald, ChatGPT, eDevlet
			}
		}
		else if ((/\d/.test(core) && L.length) || (o.parantez && L.length <= 6 && core === up)) {
			return core;                  // COVID-19 gibi karışık; tamamı büyük başlıkta "(IOI)" gibi parantez içi kısaltma
		}
		let w = dil.kucult(core, d);
		if (o.cap && L.length) {
			let i = w.search(/\p{L}/u);
			w = w.slice(0, i) + dil.buyult(w[i], d) + w.slice(i + 1);
		}
		return w;
	}

	/** Özel adları kanonik biçimiyle geri yazar (dil sözlüğü + kullanıcı istisnaları).
	 *  yalnizBuyuk: küçük harfle başlayan sözlük girdilerini ("sayılı Kanun") atla — Her Kelime Büyük düzeninde. */
	function ozelAdlar(metin, d, istisna, yalnizBuyuk = false) {
		let sozluk = d == "tr" ? OZEL_ADLAR_TR : OZEL_ADLAR_EN;
		if (yalnizBuyuk) {
			sozluk = sozluk.filter((ad) => ad === dil.buyult(ad[0], d) + ad.slice(1));
		}
		let liste = [...sozluk, ...istisna.values()];
		liste.sort((a, b) => b.length - a.length);
		let out = metin;
		for (let ad of liste) {
			let plow = dil.kucult(ad, d);
			if (plow.length != ad.length) {
				continue;
			}
			let low = dil.kucult(out, d);
			if (low.length != out.length) {
				return out;
			}
			let i = -1;
			while ((i = low.indexOf(plow, i + 1)) >= 0) {
				let once = i == 0 ? "" : low[i - 1];
				let sonra = low[i + plow.length] || "";
				if ((once && /[\p{L}\p{N}]/u.test(once)) || (sonra && /[\p{L}\p{N}]/u.test(sonra))) {
					continue;
				}
				if (out.slice(i, i + plow.length) != ad) {
					out = out.slice(0, i) + ad + out.slice(i + plow.length);
					low = dil.kucult(out, d);
				}
			}
		}
		return out;
	}

	function parcala(tok) {
		let m = tok.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su);
		return m ? { on: m[1], core: m[2], son: m[3] } : { on: "", core: tok, son: "" };
	}

	/** "HUMK m. 87", "AATUHK md. 3": ardından madde kısaltması gelen kısa, tamamı büyük kelime kanun kısaltmasıdır. */
	function kanunKisaltmasi(core, tokens, i, d) {
		let { core: c, son } = parcala(tokens[i + 2] || "");
		return /^(?:m|md|mad)$/iu.test(c) && son.startsWith(".") && harfler(core).length >= 2 && harfler(core).length <= 6
			&& /^\p{L}+$/u.test(core) && core === dil.buyult(core, d);
	}

	function cumleDuzeni(metin, baglam = {}) {
		let d = baglam.dil == "tr" ? "tr" : "en";
		let allCaps = tamamiBuyuk(metin, d);
		let istisna = istisnaHaritasi(baglam.istisnalar);
		let capNext = true;
		let tokens = metin.split(/(\s+)/);
		let kosu = allCaps ? null : buyukKosular(tokens, d);
		let out = tokens.map((tok, i) => {
			if (!tok || /^\s+$/.test(tok)) {
				return tok;
			}
			let { on, core, son } = parcala(tok);
			if (!core) {
				if (/[:?!.–—]/.test(tok)) {
					capNext = true;
				}
				return tok;
			}
			let cap = capNext;
			capNext = sonrakiBuyuk(core, son);
			if (istisna.has(dil.kucult(core, d))) {
				return on + istisna.get(dil.kucult(core, d)) + son;
			}
			if (kanunKisaltmasi(core, tokens, i, d)) {
				return tok;
			}
			return on + kelime(core, { d, cap, allCaps: allCaps || kosu[i], son, parantez: on.endsWith("(") && son.startsWith(")") }) + son;
		}).join("");
		return ozelAdlar(out, d, istisna);
	}

	/** Her Kelime Büyük (TDK başlık kuralı): bağlaçlar/soru eki küçük; kısaltmalar, iç büyük harfler (ChatGPT) korunur.
	 *  Tamamı büyük girdi önce küçültülür; karışık girdide yalnızca küçük başlayan kelimeler büyütülür. */
	function baslikDuzeni(metin, baglam = {}) {
		let d = baglam.dil == "tr" ? "tr" : "en";
		let kucuk = d == "tr" ? KUCUK_TR : KUCUK_EN;
		let allCaps = tamamiBuyuk(metin, d);
		let istisna = istisnaHaritasi(baglam.istisnalar);
		let capNext = true;
		let tokens = metin.split(/(\s+)/);
		let kosu = allCaps ? null : buyukKosular(tokens, d);
		let out = tokens.map((tok, i) => {
			if (!tok || /^\s+$/.test(tok)) {
				return tok;
			}
			let { on, core, son } = parcala(tok);
			if (!core) {
				if (/[:?!.–—]/.test(tok)) {
					capNext = true;
				}
				return tok;
			}
			if (on.startsWith("(") && son.endsWith(")") && /^\p{N}+$/u.test(core)) {
				return tok;     // "(23) The LLM…": parantez içi numara sonraki kelimeyi etkilemez
			}
			let zorunlu = capNext || (d == "en" && /[("“‘]$/.test(on));
			capNext = sonrakiBuyuk(core, son);
			let low = dil.kucult(core, d);
			let latince = d == "en" && LATINCE.test(parcala(tokens[i + 2] || "").core);   // "In Dubio", "Per Se"
			let r;
			if (istisna.has(low)) {
				r = istisna.get(low);
			}
			else if (kanunKisaltmasi(core, tokens, i, d)) {
				r = core;
			}
			else if (!zorunlu && kucuk.has(low) && !latince && !(core == "V" && !(son.startsWith(".") && tokens[i + 2]))) {
				// "Values V", "Kesitler V": Roma rakamı; "Mıaılhe V. Fransa": versus
				r = low;
			}
			else {
				r = kelime(core, { d, cap: true, allCaps: allCaps || kosu[i], son, herParca: true, parantez: on.endsWith("(") && son.startsWith(")") });
			}
			return on + r + son;
		}).join("");
		return ozelAdlar(out, d, istisna, true);
	}

	/** "Türkçe başlık / English title" biçimindeki çok dilli başlıkta fn yalnızca Türkçe (ya da belirsiz) parçalara uygulanır. */
	function parcalarla(s, fn) {
		let ps = dil.parcalar(s);
		if (ps.length < 2) {
			return fn(s);
		}
		return ps.map((p) => p.ayirac + (p.dil && p.dil != "tr" ? p.metin : fn(p.metin)) + (p.son || "")).join("");
	}

	// Türkçe metinde geçen Latince kalıplar: tamamı büyük "SUI GENERIS" Türkçe yerelle "Suı Generıs" olmasın
	const LATINCE_IFADELER = `sui generis|de facto|de jure|de iure|ultra vires|prima facie|ex officio|ex post facto|ex ante|ex post|ex tunc|ex nunc|ad hoc
|erga omnes|jus cogens|ius cogens|res judicata|res iudicata|pacta sunt servanda|rebus sic stantibus|habeas corpus|habeas data|in dubio pro reo
|in dubio pro natura|in dubio pro libertate|ratio legis|ratio decidendi|obiter dictum|amicus curiae|lex specialis|lex posterior|lex superior
|lex mercatoria|non bis in idem|ne bis in idem|nulla poena sine lege|nullum crimen sine lege|mutatis mutandis|a priori|a posteriori|status quo
|inter alia|ipso facto|ipso iure|ipso jure|bona fide|mala fide|locus standi|actio popularis|numerus clausus|in rem|in personam|in abstracto
|in concreto|in limine|in situ|contra legem|praeter legem|secundum legem|ultima ratio|audi alteram partem|nemo judex in causa sua|res publica
|res communis|terra nullius|persona non grata|modus vivendi|modus operandi|opinio juris|opinio iuris|stare decisis|certiorari|amparo
|forum non conveniens|lis pendens|ad valorem|pro bono|curriculum vitae|per se|vice versa|et al|ibid|idem|passim|op cit|sine qua non
|conditio sine qua non|condicio sine qua non|ab initio|de lege lata|de lege ferenda|lex lata|lex ferenda|summum ius summa iniuria`
		.split("|").map((x) => x.trim().split(" "));

	/** Latince kalıplardaki ı/İ → i/I ("Suı Generıs" → "Sui Generis"); harf büyüklüğü korunur. */
	function latinceIfadeler(metin) {
		if (!/[ıİ]/.test(metin)) {
			return metin;
		}
		let tokens = metin.split(/(\s+)/);
		let kelimeler = [];   // [token indeksi, düz anahtar]
		tokens.forEach((t, i) => {
			let core = parcala(t).core;
			if (core) {
				kelimeler.push([i, dil.kucult(core, "tr").replace(/ı/g, "i")]);
			}
		});
		for (let j = 0; j < kelimeler.length; j++) {
			for (let ifade of LATINCE_IFADELER) {
				if (ifade.every((w, n) => kelimeler[j + n] && kelimeler[j + n][1] == w)) {
					ifade.forEach((w, n) => {
						let ti = kelimeler[j + n][0];
						tokens[ti] = tokens[ti].replace(/ı/g, "i").replace(/İ/g, "I");
					});
				}
			}
		}
		return tokens.join("");
	}

	/** Türkçe başlığın içindeki İngilizce parantez: "Sıgma (support For Improvement In Governance And Management)".
	 *  Parantez İngilizce yazıma getirilir (ı → i; in, and, for küçük); önündeki kelime açılımın kısaltmasıysa
	 *  büyük yazılır (Türkçe yerelle küçültülmüş "SIGMA" → "Sıgma" → "SIGMA"). */
	function ingilizceParantez(metin) {
		return metin.replace(/(\p{L}+)?(\s*\()([^()]+)(\))/gu, (tum, onceki, ac, ic, kapa) => {
			let yeni = dil.sahteIDuzeltKelime(ic);       // cümle düzeninde Türkçe yerelle küçültülmüş: "ımprovement ın"
			let t = dil.tespit(yeni);
			if (t.dil != "en" || t.guven != "yuksek") {
				return tum;
			}
			if (onceki && dil.acilimMi(onceki, yeni)) {
				// açılım bir kurum/program adıdır: cümle düzeninde de kelimeleri büyük başlar (bağlaçlar küçük)
				yeni = ingilizceKucukKelimeler(yeni.replace(/(^|\s)(\p{Ll})/gu, (m, b, c) => b + c.toUpperCase()));
				return dil.sahteIDuzeltKelime(onceki).toUpperCase() + ac + yeni + kapa;
			}
			return (onceki || "") + ac + ingilizceKucukKelimeler(yeni) + kapa;
		});
	}

	// Türkçe başlıkta kelime sonunda olağan ünsüz ikilileri (Türkçe ve sık yabancı kelimeler; kütüphane ölçümünden).
	// Bunların dışında biten kelime çoğunlukla OCR/yazım hatasıdır: ARTTIRILAMAMASF, Orantılılk, Teklifl, Fransanm.
	const OLAGAN_SON = new Set(`ns nt zm ng st rm rn rk nç rt pt ts ty ch ry nd my rg ld ht tt sh ss rs rd nn ds ms cy lp th nz yn cs ll nk yb yt
lt ls ly gh dy gy sm dt ck ks mp fs ps ws gs hy ky ct ph tz pp mt xt rv ft yd nc rç rz rp lç rb rf sk sp rl yl ym yr ys yk yz yş yç kt rh lf lm rş ff gg dd bb`.split(/\s+/));
	const SESLI = /[aeıioöuüâîûéèáàóíy]/;

	/** Türkçe başlıkta yazım hatası olabilecek kelimeler: Türkçede olağan olmayan ünsüz ikilisiyle bitenler.
	 *  Kısaltmalar (tamamı büyük, ≤ 6 harf), iç büyük harfli adlar (ChatGPT), rakamlı ve noktalı kelimeler sayılmaz. */
	function yazimSupheli(metin) {
		let liste = [];
		for (let w of metin.split(/[^\p{L}’'.\d]+/u)) {
			w = w.split(/[’']/)[0];
			if (w.length < 5 || /[\d.]/.test(w)) {
				continue;
			}
			let tamBuyuk = w === dil.buyult(w, "tr");
			if ((tamBuyuk && w.length <= 6) || (!tamBuyuk && /\p{Lu}/u.test(w.slice(1))) || KISALTMALAR.has(w)) {
				continue;
			}
			let son = dil.kucult(w, "tr").slice(-2);
			if (!SESLI.test(son[0]) && !SESLI.test(son[1]) && !OLAGAN_SON.has(son)) {
				liste.push(w);
			}
		}
		return liste;
	}

	const KISA_KELIME = 4;
	const SONDA_KALMAZ = new Set([...KUCUK_TR, ...KUCUK_EN, "bir"]);

	/** Kısa başlık: iki noktadan (ya da ?, !, " – ") önceki ana başlık; 4 kelimeyi aşıyorsa ilk 4 kelime.
	 *  Kelime ortasından bölmez; sonda bağlaç (ve, ile, of, the, bir…), virgül ya da açık kalmış tırnak/parantez bırakmaz. */
	function kisaBaslik(baslik) {
		let ana = baslik.trim().split(/(?<=[?!])\s+|\s*:\s+|\s+[-–—]\s+/)[0] || baslik.trim();
		let ws = ana.split(/\s+/);
		if (ws.length <= KISA_KELIME) {
			return ana;
		}
		ws = ws.slice(0, KISA_KELIME);
		while (ws.length > 1 && SONDA_KALMAZ.has(dil.kucult(ws[ws.length - 1].replace(/[^\p{L}]/gu, ""), "tr"))) {
			ws.pop();
		}
		let k = ws.join(" ").replace(/[,;.]+$/, "");
		// "Avrupa Birliği SIGMA (Support…": açık kalan parantez/tırnaktan önce kes; en baştaysa yalnızca işareti sil
		for (let [ac, kapa] of [["(", ")"], ["[", "]"], ["“", "”"], ["«", "»"], ['"', '"']]) {
			let say = (c) => k.split(c).length - 1;
			let acik = ac == kapa ? say(ac) % 2 == 1 : say(ac) > say(kapa);
			if (acik) {
				let i = k.lastIndexOf(ac);
				k = i > 0 ? k.slice(0, i).trim().replace(/[,;.]+$/, "") : k.slice(1);
			}
		}
		return k;
	}

	/** Kısa başlık başlığın başından kelime ortasında mı kesilmiş: "Yeni Bir Dönemin Başlang", "Yeni Bir Dönemin…". */
	function kisaBaslikKesik(kisa, baslik) {
		let ucNokta = /(?:\.{3}|…)\s*$/.test(kisa);
		let k = dil.kucult(kisa.replace(/(?:\.{3}|…)\s*$/, "").trim(), "tr");
		let b = dil.kucult(baslik, "tr");
		return !!k && b.startsWith(k) && b.length > k.length && (ucNokta || /[\p{L}\p{N}]/u.test(b[k.length]));
	}

	const BASLIK_ALANLARI = new Set(["title", "shortTitle", "bookTitle", "proceedingsTitle", "encyclopediaTitle", "dictionaryTitle"]);
	const AD_ALANLARI = new Set(["publicationTitle", "series", "seriesTitle", "publisher", "university", "institution", "websiteTitle", "blogTitle", "forumTitle", "place", "court", "reporter", "conferenceName", "meetingName", "programTitle", "network", "label", "studio", "company", "distributor"]);

	function uygula(metin, baglam = {}) {
		let degisiklikler = [];
		if (typeof metin != "string" || !metin || baglam.stil == "dokunma") {
			return { metin, degisiklikler };
		}
		let d = baglam.dil;
		let s = metin;
		let stil = baglam.stil || "baslik";
		if (BASLIK_ALANLARI.has(baglam.alan)) {
			if (d == "tr" && stil == "baslik") {
				// TDK: eser başlıklarında her kelime büyük başlar
				let y = parcalarla(s, (p) => baslikDuzeni(p, baglam));
				if (y != s) {
					degisiklikler.push(tamamiBuyuk(s, d)
						? { kural: "harf.tamamiBuyuk", aciklama: "Tamamı büyük başlık Her Kelime Büyük düzenine çevrildi", guven: "orta" }
						: buyukKosuVar(s, d)
							? { kural: "harf.buyukKosu", aciklama: "Başlıktaki TAMAMI BÜYÜK kelimeler Her Kelime Büyük düzenine çevrildi", guven: "orta" }
							: { kural: "harf.kucukBaslik", aciklama: "Başlık Her Kelime Büyük düzenine çevrildi (TDK; bağlaçlar küçük)", guven: "orta" });
					s = y;
				}
			}
			else if (d == "en" && stil == "baslik") {
				// İngilizce Title Case: her kelime büyük, of/the/in/and küçük
				let y = baslikDuzeni(s, baglam);
				if (y != s) {
					degisiklikler.push(tamamiBuyuk(s, d)
						? { kural: "harf.tamamiBuyuk", aciklama: "Tamamı büyük başlık Title Case düzenine çevrildi", guven: "orta" }
						: y == ingilizceKucukKelimeler(s)
							? { kural: "harf.ingilizceKucuk", aciklama: "İngilizce başlıkta of/the/in gibi küçük kelimeler küçültüldü", guven: "orta" }
							: { kural: "harf.ingilizceBaslik", aciklama: "İngilizce başlık Title Case düzenine çevrildi (of, the, in, and küçük)", guven: "orta" });
					s = y;
				}
			}
			else if (d == "tr" || d == "en") {
				if (d == "en" && !tamamiBuyuk(s, d) && ingilizceKucukKelimeler(s) != s) {
					s = ingilizceKucukKelimeler(s);
					degisiklikler.push({ kural: "harf.ingilizceKucuk", aciklama: "İngilizce başlıkta of/the/in gibi küçük kelimeler küçültüldü", guven: "orta" });
				}
				if (tamamiBuyuk(s, d)) {
					let y = d == "tr" ? parcalarla(s, (p) => cumleDuzeni(p, baglam)) : cumleDuzeni(s, baglam);
					if (y != s) {
						degisiklikler.push({ kural: "harf.tamamiBuyuk", aciklama: "Tamamı büyük başlık cümle düzenine çevrildi", guven: "orta" });
						s = y;
					}
				}
				else if (buyukKosuVar(s, d)) {
					let y = d == "tr" ? parcalarla(s, (p) => cumleDuzeni(p, baglam)) : cumleDuzeni(s, baglam);
					if (y != s) {
						degisiklikler.push({ kural: "harf.buyukKosu", aciklama: "Başlıktaki TAMAMI BÜYÜK kelimeler cümle düzenine çevrildi", guven: "orta" });
						s = y;
					}
				}
				else if (d == "tr" && baglam.titleCaseDonustur !== false && titleCaseGibi(s)) {
					let y = parcalarla(s, (p) => cumleDuzeni(p, baglam));
					if (y != s) {
						degisiklikler.push({ kural: "harf.titleCase", aciklama: "Her Kelimesi Büyük başlık cümle düzenine çevrildi", guven: "orta" });
						s = y;
					}
				}
			}
			if (d == "tr") {
				let y = latinceIfadeler(s);
				if (y != s) {
					degisiklikler.push({ kural: "harf.latince", aciklama: "Latince ifadede Türkçe yerelden kalan ı → i (Suı Generıs → Sui Generis)", guven: "orta" });
					s = y;
				}
				y = ingilizceParantez(s);
				if (y != s) {
					degisiklikler.push({ kural: "harf.ingilizceParantez", aciklama: "Parantez içindeki İngilizce açılım İngilizce yazıma getirildi; kısaltması büyük yazıldı", guven: "orta" });
					s = y;
				}
			}
		}
		else if (AD_ALANLARI.has(baglam.alan) && tamamiBuyuk(s, d == "tr" ? "tr" : "en")) {
			let y = baslikDuzeni(s, baglam);
			if (y != s) {
				degisiklikler.push({ kural: "harf.adBuyuk", aciklama: "Tamamı büyük ad Her Kelime Büyük düzenine çevrildi", guven: "orta" });
				s = y;
			}
		}
		return { metin: s, degisiklikler };
	}

	return { uygula, ingilizceKucukKelimeler, ingilizceParantez, latinceIfadeler, yazimSupheli, kisaBaslik, kisaBaslikKesik, cumleDuzeni, baslikDuzeni, tamamiBuyuk, titleCaseGibi, buyukKosuVar, ozelAdlar, KISALTMALAR, OZEL_ADLAR_TR, OZEL_ADLAR_EN, BASLIK_ALANLARI, AD_ALANLARI };
});
