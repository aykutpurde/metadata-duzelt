/* Metadata Düzelt — Zotero eklentisi.
 *
 * Kayıtlardaki metadata hatalarını (bozuk karakter, büyük/küçük harf, yazar adı, dil alanı) kurallar/
 * altındaki saf fonksiyonlarla bulur, önizleme penceresinde satır satır onaylatır, onaylananları
 * tek bir veritabanı işlemiyle yazar. Her değişikliğin eski değeri ~/Zotero/metadataduzelt.json
 * dosyasına kaydedilir; "Son düzeltmeyi geri al" oradan okur.
 */

MetadataDuzelt = {
	id: null,
	rootURI: null,
	menuIDs: [],
	columnKey: null,
	observerID: null,
	K: null,                 // kural modülleri: { dil, karakter, tire, harf, yazar, motor, dogrula }
	cache: new Map(),        // itemID -> { mod: dateModified, n: öneri sayısı } (sütun için)
	istisnalar: [],
	adSozluk: null,          // yazar.sozlukKur: kütüphanedeki ad/soyad sıklığı
	kelimeSozluk: null,      // dil.kelimeSozlukKur: kütüphanedeki başlık/özet kelimeleri (eksik Türkçe harf kuralı)
	kelimeSozlukZaman: 0,
	busy: false,

	PREF_AUTO: "extensions.metadataduzelt.otomatik",
	PREF_STIL: "extensions.metadataduzelt.baslikStili",
	PREF_TC: "extensions.metadataduzelt.titleCaseDonustur",
	PREF_ONLINE: "extensions.metadataduzelt.cevrimiciDogrula",

	// ------------------------------------------------------------ kurulum

	init({ id, rootURI }) {
		this.id = id;
		this.rootURI = rootURI;
		let scope = {};
		for (let f of ["dil", "karakter", "tire", "harf", "yazar", "motor", "dogrula"]) {
			Services.scriptloader.loadSubScript(rootURI + "kurallar/" + f + ".js", scope);
		}
		this.K = scope.MetadataDuzeltKurallar;
		let home = Services.dirsvc.get("Home", Ci.nsIFile).path;
		this.logFile = Zotero.isWin
			? PathUtils.join(Services.env.get("LOCALAPPDATA") || home, "MetadataDuzelt", "zotero.log")
			: PathUtils.join(home, "Library", "Logs", "MetadataDuzelt", "zotero.log");
		this.registryFile = PathUtils.join(Zotero.DataDirectory.dir, "metadataduzelt.json");
		this.exceptionsFile = PathUtils.join(Zotero.DataDirectory.dir, "metadataduzelt-istisnalar.txt");
		this.registerMenus();
		this.registerColumn();
		this.loadExceptions();
		this.loadNameStats();
		this.observerID = Zotero.Notifier.registerObserver(
			{ notify: (...args) => this.onNotify(...args) }, ["item"], "metadataduzelt");
	},

	shutdown() {
		for (let id of this.menuIDs) {
			Zotero.MenuManager.unregisterMenu(id);
		}
		this.menuIDs = [];
		if (this.columnKey) {
			Zotero.ItemTreeManager.unregisterColumn(this.columnKey);
		}
		if (this.observerID) {
			Zotero.Notifier.unregisterObserver(this.observerID);
		}
		this.cache.clear();
	},

	registerMenus() {
		let icon = this.rootURI + "icon.svg";
		let itemMenu = Zotero.MenuManager.registerMenu({
			menuID: "metadataduzelt-item",
			pluginID: this.id,
			target: "main/library/item",
			menus: [{
				menuType: "menuitem",
				l10nID: "metadataduzelt-fix",
				icon,
				onShowing: (event, context) => context.setVisible(this.regularItemsOf(context.items).length > 0),
				onCommand: (event, context) => this.fixSelection(context.items),
			}],
		});
		let toolsMenu = Zotero.MenuManager.registerMenu({
			menuID: "metadataduzelt-tools",
			pluginID: this.id,
			target: "main/menubar/tools",
			menus: [{
				menuType: "submenu",
				l10nID: "metadataduzelt-menu",
				icon,
				menus: [
					{ menuType: "menuitem", l10nID: "metadataduzelt-scan", onCommand: () => this.scanLibrary() },
					{ menuType: "menuitem", l10nID: "metadataduzelt-undo", onCommand: () => this.undo() },
					{ menuType: "separator" },
					{
						menuType: "menuitem",
						l10nID: "metadataduzelt-auto",
						onShowing: (event, context) => context.setL10nArgs(JSON.stringify({ sel: this.autoOn() ? "✓ " : "" })),
						onCommand: () => Zotero.Prefs.set(this.PREF_AUTO, !this.autoOn(), true),
					},
					{ menuType: "separator" },
					...[["baslik", "metadataduzelt-style-tdk"], ["cumle", "metadataduzelt-style-sentence"], ["dokunma", "metadataduzelt-style-off"]].map(([stil, l10nID]) => ({
						menuType: "menuitem",
						l10nID,
						onShowing: (event, context) => context.setL10nArgs(JSON.stringify({ sel: this.style() == stil ? "✓ " : "" })),
						onCommand: () => { Zotero.Prefs.set(this.PREF_STIL, stil, true); this.cache.clear(); this.refreshColumns(); },
					})),
					{ menuType: "separator" },
					{ menuType: "menuitem", l10nID: "metadataduzelt-exceptions", onCommand: () => this.openExceptions() },
					{ menuType: "menuitem", l10nID: "metadataduzelt-log", onCommand: () => this.openLog() },
				],
			}],
		});
		this.menuIDs = [itemMenu, toolsMenu].filter(Boolean);
	},

	registerColumn() {
		this.columnKey = Zotero.ItemTreeManager.registerColumn({
			dataKey: "metadataduzelt-durum",
			label: "Metadata",
			pluginID: this.id,
			enabledTreeIDs: ["main"],
			flex: 0,
			width: "90",
			zoteroPersist: ["width", "hidden", "sortDirection"],
			dataProvider: (item) => this.columnText(item),
		});
	},

	columnText(item) {
		if (!item.isRegularItem()) {
			return "";
		}
		let c = this.cache.get(item.id);
		if (!c || c.mod != item.dateModified) {
			let n = 0;
			try {
				n = this.analyze(item).oneriler.length;
			}
			catch (e) {
				Zotero.logError(e);
			}
			c = { mod: item.dateModified, n };
			this.cache.set(item.id, c);
		}
		return c.n ? `⚠ ${c.n}` : "✓";
	},

	refreshColumns() {
		try {
			Zotero.ItemTreeManager.refreshColumns();
		}
		catch (e) {}
	},

	autoOn() {
		return Zotero.Prefs.get(this.PREF_AUTO, true) === true;
	},

	onlineOn() {
		return Zotero.Prefs.get(this.PREF_ONLINE, true) !== false;
	},

	titleCaseOn() {
		return Zotero.Prefs.get(this.PREF_TC, true) !== false;
	},

	/** Başlık düzeni (Türkçe ve İngilizce): "baslik" (TDK / Title Case, varsayılan) | "cumle" | "dokunma" */
	style() {
		let s = Zotero.Prefs.get(this.PREF_STIL, true);
		return ["baslik", "cumle", "dokunma"].includes(s) ? s : "baslik";
	},

	// ------------------------------------------------------------ çözümleme

	settings() {
		return {
			stil: this.style(),
			titleCaseDonustur: this.titleCaseOn(),
			istisnalar: this.istisnalar,
			adSozluk: this.adSozluk,
			kelimeSozluk: this.kelimeSozluk,
		};
	},

	/** Kütüphanedeki kişi yazarlardan ad/soyad sıklığı: iki soyadlı yazar kuralı için ("Cansu Koç" + "Başar"). */
	async loadNameStats() {
		try {
			let kisiler = [];
			await Zotero.DB.queryAsync("SELECT firstName, lastName FROM creators WHERE fieldMode = 0", [], {
				onRow: (row) => kisiler.push({ firstName: row.getResultByIndex(0) || "", lastName: row.getResultByIndex(1) || "" }),
			});
			this.adSozluk = this.K.yazar.sozlukKur(kisiler);
			this.cache.clear();
		}
		catch (e) {
			Zotero.logError(e);
		}
	},

	/** Kütüphanedeki başlık ve özetlerden kelime sözlüğü: "Kavrami" → "Kavramı" gibi kaybolmuş Türkçe harfleri
	 *  kütüphanenin kendi doğru yazımından bulmak için. Sorgu tüm kütüphaneyi okuduğundan (~1 sn) açılışta değil, ilk düzeltme/taramada kurulur ve en çok 10 dakikada bir yenilenir. */
	async loadWordStats() {
		if (this.kelimeSozluk && Date.now() - this.kelimeSozlukZaman < 10 * 60 * 1000) {
			return;
		}
		try {
			let metinler = [];
			await Zotero.DB.queryAsync(`SELECT v.value FROM itemData d JOIN itemDataValues v USING (valueID) JOIN fields f USING (fieldID)
				WHERE f.fieldName IN ('title', 'shortTitle', 'publicationTitle', 'bookTitle', 'proceedingsTitle', 'caseName', 'nameOfAct', 'subject', 'abstractNote')`, [], {
				onRow: (row) => metinler.push(String(row.getResultByIndex(0) || "")),
			});
			this.kelimeSozluk = this.K.dil.kelimeSozlukKur(metinler);
			this.kelimeSozlukZaman = Date.now();
			this.cache.clear();
		}
		catch (e) {
			Zotero.logError(e);
		}
	},

	/** Zotero öğesini kural motorunun anladığı düz nesneye çevirir. */
	record(item) {
		let fields = {};
		let alanlar = [];
		for (let fieldID of Zotero.ItemFields.getItemTypeFields(item.itemTypeID)) {
			let name = Zotero.ItemFields.getName(fieldID);
			alanlar.push(name);
			let v = item.getField(name, true, true);
			if (v) {
				fields[name] = String(v);
			}
		}
		let creators = item.getCreators().map((c) => ({
			firstName: c.firstName || "",
			lastName: c.lastName || "",
			fieldMode: c.fieldMode || 0,
			creatorType: Zotero.CreatorTypes.getName(c.creatorTypeID),
		}));
		return { itemType: Zotero.ItemTypes.getName(item.itemTypeID), fields, alanlar, creators };
	},

	analyze(item) {
		return this.K.motor.analiz(this.record(item), this.settings());
	},

	/** Önizleme satırları: her öneri bir satır; kayıt başlığı ve kimliği eklenir. */
	rows(items, { onlyAuto = false } = {}) {
		let rows = [];
		let uyarilar = [];
		for (let item of items) {
			let r = this.analyze(item);
			let title = item.getDisplayTitle() || item.key;
			for (let o of r.oneriler) {
				if (onlyAuto && !o.otomatik) {
					continue;
				}
				rows.push({ itemID: item.id, libraryID: item.libraryID, key: item.key, baslik: title, ...o });
			}
			for (let u of r.uyarilar) {
				uyarilar.push({ itemID: item.id, key: item.key, baslik: title, ...u });
			}
		}
		return { rows, uyarilar };
	},

	regularItemsOf(items) {
		let out = new Map();
		for (let item of items || []) {
			let it = item.isRegularItem() ? item : (item.parentItem || null);
			if (it && it.isRegularItem() && !it.deleted) {
				out.set(it.id, it);
			}
		}
		return [...out.values()];
	},

	// ------------------------------------------------------------ komutlar

	async fixSelection(items) {
		let targets = this.regularItemsOf(items);
		if (!targets.length) {
			this.notify("Seçimde düzenli kayıt yok.");
			return;
		}
		await this.loadExceptions();
		await this.loadNameStats();
		await this.loadWordStats();
		let { rows, uyarilar } = this.rows(targets);
		if (!rows.length) {
			this.notify(targets.length == 1
				? "Bu kayıtta düzeltilecek bir şey bulunamadı ✓"
				: `${targets.length} kayıtta düzeltilecek bir şey bulunamadı ✓`
				+ (uyarilar.length ? `\n(${uyarilar.length} uyarı: elle bakılmalı)` : ""));
			if (uyarilar.length) {
				this.openPreview(rows, uyarilar, targets.length == 1 ? (targets[0].getDisplayTitle() || targets[0].key) : `${targets.length} kayıt`);
			}
			return;
		}
		this.openPreview(rows, uyarilar, targets.length == 1 ? rows[0].baslik : `${targets.length} kayıt`);
	},

	async scanLibrary() {
		let win = Zotero.getMainWindow();
		let libraryID = win?.ZoteroPane?.getSelectedLibraryID() || Zotero.Libraries.userLibraryID;
		let library = Zotero.Libraries.get(libraryID);
		if (this.busy) {
			this.notify("Bir tarama zaten sürüyor.");
			return;
		}
		this.busy = true;
		let pw = new Zotero.ProgressWindow({ closeOnClick: false });
		pw.changeHeadline(`Metadata Düzelt — “${library.name}” taranıyor`);
		pw.show();
		let line = new pw.ItemProgress("document", "Kayıtlar listeleniyor…");
		try {
			await this.loadExceptions();
			await this.loadNameStats();
			await this.loadWordStats();
			let all = await Zotero.Items.getAll(libraryID, false, false);
			let items = all.filter((it) => it.isRegularItem() && !it.deleted);
			let rows = [], uyarilar = [], itemCount = 0;
			let kurallar = new Map();
			for (let [i, item] of items.entries()) {
				if (i % 100 == 0) {
					line.setText(`${i}/${items.length} kayıt incelendi`);
					line.setProgress(Math.round(100 * i / items.length));
					await Zotero.Promise.delay(0);
				}
				let r = this.rows([item]);
				if (r.rows.length) {
					itemCount++;
				}
				rows.push(...r.rows);
				uyarilar.push(...r.uyarilar);
				for (let o of r.rows) {
					for (let k of o.kurallar) {
						kurallar.set(k.kural, (kurallar.get(k.kural) || 0) + 1);
					}
				}
				this.cache.set(item.id, { mod: item.dateModified, n: r.rows.length });
			}
			this.refreshColumns();
			line.setProgress(100);
			line.setText(`${items.length} kayıt tarandı`);
			pw.startCloseTimer(1500);

			if (!rows.length) {
				this.notify(`“${library.name}” kütüphanesinde düzeltilecek bir şey bulunamadı ✓`
					+ (uyarilar.length ? `\n(${uyarilar.length} uyarı: elle bakılmalı)` : ""));
				return;
			}
			let ozet = [...kurallar.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
				.map(([k, n]) => `  ${n} × ${this.ruleLabel(k)}`).join("\n");
			let ps = Services.prompt;
			let flags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING + ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING + ps.BUTTON_POS_0_DEFAULT;
			let choice = ps.confirmEx(win, "Metadata Düzelt — tarama sonucu",
				`“${library.name}” kütüphanesinde ${itemCount} kayıtta ${rows.length} düzeltme önerisi var`
				+ (uyarilar.length ? `, ${uyarilar.length} uyarı (elle bakılmalı)` : "") + ".\n\nEn sık kurallar:\n" + ozet
				+ "\n\nÖnizlemede her satırı tek tek seçebilirsiniz; hiçbir şey onaysız yazılmaz. "
				+ "Öğe listesindeki “Metadata” sütunu da kayıt başına öneri sayısını gösterir.",
				flags, "Önizlemeyi aç", "Kapat", "Zotero'da göster", null, {});
			if (choice == 0) {
				this.openPreview(rows, uyarilar, `${library.name} — ${itemCount} kayıt`);
			}
			else if (choice == 2) {
				let ids = [...new Set(rows.map((r) => r.itemID))];
				await win.ZoteroPane.selectItems(ids, { inLibraryRoot: true });
			}
		}
		catch (e) {
			Zotero.logError(e);
			line.setError();
			line.setText("Tarama başarısız: " + (e.message || e));
			pw.startCloseTimer(8000);
		}
		finally {
			this.busy = false;
		}
	},

	ruleLabel(kural) {
		return {
			"karakter.nfc": "birleşik karakter / i̇ artığı", "karakter.mojibake": "bozuk kodlama", "karakter.eskiKodSayfasi": "eski kod sayfası (ý þ ð)",
			"karakter.htmlVarliklar": "HTML varlığı", "karakter.pdfKodlama": "PDF yazı tipi kodlaması (Ġ đ Ģ)", "karakter.bagliHarf": "bağlı harf (ﬁ ﬂ)", "karakter.gorunmez": "görünmez karakter / NBSP",
			"karakter.bosluk": "fazla boşluk", "karakter.dergiparkOneki": "DergiPark sayfa öneki", "karakter.sondakiNokta": "başlık sonu noktası",
			"tire.kopukKelime": "kopuk kelime", "harf.tamamiBuyuk": "tamamı büyük başlık", "harf.kucukBaslik": "küçük harfli başlık (TDK: Her Kelime Büyük)",
			"harf.titleCase": "Her Kelimesi Büyük başlık", "harf.buyukKosu": "başlıkta TAMAMI BÜYÜK kelimeler",
			"harf.ingilizceParantez": "parantez içi İngilizce açılım / kısaltma", "harf.ingilizceKucuk": "İngilizce başlıkta büyük of/the/in",
			"harf.kisaBaslikBos": "kısa başlık boş", "harf.ingilizceBaslik": "İngilizce başlık Title Case değil", "harf.latince": "Latince ifadede yanlış ı (Suı Generıs)", "harf.kisaBaslikKesik": "kısa başlık kelime ortasında kesik",
			"karakter.dilEtiketi": "başlıkta dil etiketi ([tr])", "karakter.notParantez": "başlıkta not (künye yok …)", "karakter.saranTirnak": "başlığı saran tırnak", "karakter.sahteI": "yabancı kelimede yanlış ı (Internatıonal)",
			"dil.ikiDilliBaslik": "iki dilli başlık (yalnızca eser dili bırakıldı)", "yazar.ikiSoyad": "ad alanına düşmüş ikinci soyadı", "yazar.supheli": "bozuk görünen yazar adı",
			"harf.adBuyuk": "tamamı büyük dergi/kurum adı", "dil.bos": "dil alanı boş", "dil.normalize": "dil kodu biçimi", "dil.yanlis": "dil alanı yanlış",
			"dil.bozuk": "dil alanı bozuk", "yazar.temizle": "yazar adında boşluk/karakter", "yazar.unvan": "yazar unvanı", "yazar.virgul": "yazar “Soyad, Ad”",
			"yazar.soyadBos": "yazar soyadı boş", "yazar.tekAlan": "tek alana yazılmış yazar", "yazar.buyukHarf": "TAMAMI BÜYÜK yazar",
			"yazar.kurumBuyuk": "TAMAMI BÜYÜK kurum", "yazar.diakritik": "diakritiksiz Türkçe ad",
			"yazar.kucukHarf": "küçük harfle başlayan ad",
			"karakter.yerelI": "yanlış yerelle küçültülmüş (Kavrami → Kavramı)", "harf.eksikHarf": "eksik Türkçe harf (kütüphanedeki yazımdan)",
			"karakter.ikiNokta": "iki noktadan sonra boşluk yok", "karakter.basTirnak": "başta kapanmamış tırnak", "tire.izafet": "kopmuş izafet eki (Kanun - i Esasi)",
		}[kural] || kural;
	},

	// ------------------------------------------------------------ önizleme ve yazma

	openPreview(rows, uyarilar, baslik) {
		let win = Zotero.getMainWindow();
		let hedefler = [
			...rows.map((satir, i) => ({ tur: "satir", i, satir })),
			...uyarilar.map((u, i) => ({ tur: "uyari", i, satir: this.warningTarget(u) })),
		].filter((h) => h.satir && this.K.dogrula.dogrulanabilir(h.satir));
		let args = {
			baslik,
			satirlar: rows,
			uyarilar,
			etiket: (k) => this.ruleLabel(k),
			// elle: önizlemede elle düzenlenen değerler ({ indeks: { yeni, yeniYazar? } }); öneri yerine bunlar yazılır
			onUygula: (secilen, elle = {}) => this.apply(secilen.map((i) => ({ ...rows[i], ...(elle[i] || {}) })), baslik),
			kisaBaslik: (b) => this.K.harf.kisaBaslik(b),
			dogrulanacak: hedefler.length,
			onDogrula: (geri) => this.verifyTargets(hedefler, geri),
			onGoster: (itemID) => win.ZoteroPane.selectItem(itemID),
		};
		win.openDialog("chrome://metadataduzelt/content/onizleme.xhtml", "metadataduzelt-onizleme",
			"chrome,dialog=no,centerscreen,resizable,width=1100,height=700", args);
	},

	// ------------------------------------------------------------ kaynakla doğrulama

	/** Kaydın özgün kaynakları: bağlı PDF'in tam metni (Zotero dizini), CrossRef (DOI), DergiPark makale sayfası. */
	async sources(item) {
		let k = { basliklar: [], yazarlar: [], pdf: null };
		for (let id of item.getAttachments()) {
			let a = Zotero.Items.get(id);
			if (!a || !a.isPDFAttachment()) {
				continue;
			}
			try {
				let t = await a.attachmentText;
				if (t && t.trim()) {
					k.pdf = t.slice(0, 12000);
					break;
				}
			}
			catch (e) {
				Zotero.debug("Metadata Düzelt: PDF metni okunamadı: " + e);
			}
		}
		if (!this.onlineOn()) {
			return k;
		}
		let fields = this.record(item).fields;
		let doi = this.K.dogrula.doiBul(fields);
		if (doi) {
			try {
				let x = await Zotero.HTTP.request("GET", "https://api.crossref.org/works/" + encodeURIComponent(doi),
					{ responseType: "json", timeout: 15000 });
				let r = this.K.dogrula.crossrefOku((x.response || {}).message || {});
				r.basliklar.forEach((metin) => k.basliklar.push({ kaynak: "CrossRef", metin }));
				r.yazarlar.forEach((tam) => k.yazarlar.push({ kaynak: "CrossRef", tam }));
				k.adSoyad = r.adSoyad;
			}
			catch (e) {
				Zotero.debug("Metadata Düzelt: CrossRef sorgusu başarısız (" + doi + "): " + e);
			}
		}
		if (/^https?:\/\/(?:www\.)?dergipark\.org\.tr\/.+\/article\//.test(fields.url || "")) {
			try {
				let x = await Zotero.HTTP.request("GET", fields.url, { responseType: "text", timeout: 15000 });
				let r = this.K.dogrula.metaOku(x.response || "");
				r.basliklar.forEach((metin) => k.basliklar.push({ kaynak: "DergiPark", metin }));
				r.yazarlar.forEach((tam) => k.yazarlar.push({ kaynak: "DergiPark", tam }));
			}
			catch (e) {
				Zotero.debug("Metadata Düzelt: DergiPark sayfası okunamadı: " + e);
			}
		}
		return k;
	},

	/** Yazar uyarısını doğrulanacak satır biçimine çevirir (kayıttaki güncel ad). */
	warningTarget(u) {
		if (u.alan != "creators" || u.indeks == null) {
			return null;
		}
		let c = Zotero.Items.get(u.itemID)?.getCreators()[u.indeks];
		return c ? { itemID: u.itemID, alan: "creators", guven: "orta", yeniYazar: { firstName: c.firstName || "", lastName: c.lastName || "" } } : null;
	},

	/** Hedefleri ({tur, i, satir}) kaynakla karşılaştırır; her sonuç geldikçe geri(tur, i, sonuc) çağrılır. */
	async verifyTargets(hedefler, geri) {
		let kaynaklar = new Map();
		for (let h of hedefler) {
			let sonuc;
			try {
				if (!kaynaklar.has(h.satir.itemID)) {
					let item = Zotero.Items.get(h.satir.itemID);
					kaynaklar.set(h.satir.itemID, item ? await this.sources(item) : {});
				}
				sonuc = this.K.dogrula.degerlendir(h.satir, kaynaklar.get(h.satir.itemID));
				if (sonuc?.yeniOneri && h.tur == "satir") {
					h.satir.yeni = sonuc.yeniOneri;   // önizlemede "uygula" bu nesneyi yazar
					if (sonuc.yeniYazarOneri) {
						h.satir.yeniYazar = { ...h.satir.yeniYazar, ...sonuc.yeniYazarOneri };
					}
				}
			}
			catch (e) {
				Zotero.logError(e);
				sonuc = { durum: "bulunamadi", mesaj: "Doğrulama hatası: " + (e.message || e) };
			}
			if (sonuc) {
				geri(h.tur, h.i, sonuc);
			}
		}
	},

	/** Seçilen önerileri yazar; eski değerleri kayıt dosyasına ekler. */
	async apply(rows, baslik, { sessiz = false } = {}) {
		if (!rows.length) {
			return;
		}
		let byItem = new Map();
		for (let r of rows) {
			if (!byItem.has(r.itemID)) {
				byItem.set(r.itemID, []);
			}
			byItem.get(r.itemID).push(r);
		}
		let batch = { tarih: new Date().toISOString(), baslik, kayitlar: [] };
		let written = 0, skipped = 0, failed = 0;
		await Zotero.DB.executeTransaction(async () => {
			for (let [itemID, list] of byItem) {
				let item = Zotero.Items.get(itemID);
				if (!item || item.deleted || !Zotero.Libraries.get(item.libraryID).editable) {
					skipped += list.length;
					continue;
				}
				let rec = { libraryID: item.libraryID, key: item.key, baslik: list[0].baslik, alanlar: {}, yazarlar: null };
				let creators = null;
				try {
					for (let r of list) {
						if (r.alan == "creators") {
							if (!creators) {
								creators = item.getCreators();
								rec.yazarlar = { eski: JSON.parse(JSON.stringify(creators)), yeni: null };
							}
							let c = creators[r.indeks];
							if (!c || (c.firstName || "") != r.eskiYazar.firstName || (c.lastName || "") != r.eskiYazar.lastName) {
								skipped++;  // kayıt bu arada değişmiş
								continue;
							}
							creators[r.indeks] = { ...c, firstName: r.yeniYazar.firstName, lastName: r.yeniYazar.lastName, fieldMode: r.yeniYazar.fieldMode };
							written++;
						}
						else {
							let cur = String(item.getField(r.alan, true, true) || "");
							if (cur != r.eski) {
								skipped++;
								continue;
							}
							rec.alanlar[r.alan] = { eski: r.eski, yeni: r.yeni };
							item.setField(r.alan, r.yeni);
							written++;
						}
					}
					if (creators) {
						rec.yazarlar.yeni = JSON.parse(JSON.stringify(creators));
						item.setCreators(creators);
					}
					if (Object.keys(rec.alanlar).length || creators) {
						await item.save();
						batch.kayitlar.push(rec);
					}
				}
				catch (e) {
					Zotero.logError(e);
					failed += list.length;
				}
			}
		});
		if (batch.kayitlar.length) {
			let reg = await this.loadRegistry();
			reg.gecmis = reg.gecmis || [];
			reg.gecmis.push(batch);
			if (reg.gecmis.length > 200) {
				reg.gecmis = reg.gecmis.slice(-200);
			}
			await this.saveRegistry(reg);
			for (let rec of batch.kayitlar) {
				for (let [alan, v] of Object.entries(rec.alanlar)) {
					await this.log(`${rec.key} ${alan}: “${v.eski}” → “${v.yeni}”`);
				}
				if (rec.yazarlar) {
					await this.log(`${rec.key} creators: ${this.creatorsText(rec.yazarlar.eski)} → ${this.creatorsText(rec.yazarlar.yeni)}`);
				}
			}
		}
		for (let id of byItem.keys()) {
			this.cache.delete(id);
		}
		this.refreshColumns();
		if (!sessiz) {
			this.notify(`${written} değişiklik ${batch.kayitlar.length} kayda yazıldı`
				+ (skipped ? `, ${skipped} atlandı (kayıt bu arada değişmiş ya da salt okunur)` : "")
				+ (failed ? `, ${failed} hata` : "")
				+ "\nGeri almak için: Araçlar › Metadata Düzelt › Son düzeltmeyi geri al");
		}
		return { written, skipped, failed };
	},

	creatorsText(list) {
		return (list || []).map((c) => c.fieldMode == 1 ? c.lastName : `${c.lastName}, ${c.firstName}`).join("; ");
	},

	async undo() {
		let reg = await this.loadRegistry();
		let batch = (reg.gecmis || []).pop();
		if (!batch) {
			this.notify("Geri alınacak düzeltme yok.");
			return;
		}
		let win = Zotero.getMainWindow();
		let n = batch.kayitlar.reduce((s, r) => s + Object.keys(r.alanlar).length + (r.yazarlar ? 1 : 0), 0);
		let ok = Services.prompt.confirm(win, "Metadata Düzelt — geri al",
			`“${batch.baslik}” (${new Date(batch.tarih).toLocaleString("tr-TR")}): ${batch.kayitlar.length} kayıtta ${n} değişiklik geri alınacak. `
			+ "Düzeltmeden sonra elle değiştirilmiş alanlara dokunulmaz.\n\nDevam edilsin mi?");
		if (!ok) {
			return;
		}
		let restored = 0, skipped = 0;
		await Zotero.DB.executeTransaction(async () => {
			for (let rec of batch.kayitlar) {
				let item = Zotero.Items.getByLibraryAndKey(rec.libraryID, rec.key);
				if (!item || !Zotero.Libraries.get(rec.libraryID).editable) {
					skipped++;
					continue;
				}
				let changed = false;
				for (let [alan, v] of Object.entries(rec.alanlar)) {
					if (String(item.getField(alan, true, true) || "") == v.yeni) {
						item.setField(alan, v.eski);
						changed = true;
						restored++;
					}
					else {
						skipped++;
					}
				}
				if (rec.yazarlar) {
					let cur = JSON.stringify(item.getCreators().map((c) => [c.firstName || "", c.lastName || "", c.fieldMode || 0]));
					let yeni = JSON.stringify(rec.yazarlar.yeni.map((c) => [c.firstName || "", c.lastName || "", c.fieldMode || 0]));
					if (cur == yeni) {
						item.setCreators(rec.yazarlar.eski);
						changed = true;
						restored++;
					}
					else {
						skipped++;
					}
				}
				if (changed) {
					await item.save();
					this.cache.delete(item.id);
				}
			}
		});
		await this.saveRegistry(reg);
		await this.log(`GERİ ALINDI: “${batch.baslik}” — ${restored} değişiklik, ${skipped} atlandı`);
		this.refreshColumns();
		this.notify(`${restored} değişiklik geri alındı` + (skipped ? `, ${skipped} atlandı (sonradan değişmiş)` : ""));
	},

	// ------------------------------------------------------------ otomatik mod

	onNotify(event, type, ids) {
		if (type != "item" || event != "add" || !this.autoOn()) {
			return;
		}
		for (let id of ids) {
			let item = Zotero.Items.get(id);
			if (item && item.isRegularItem()) {
				this.autoFix(item).catch((e) => Zotero.logError(e));
			}
		}
	},

	async autoFix(item) {
		await Zotero.Promise.delay(2500);  // çevirmen alanları yazsın
		if (!Zotero.Items.get(item.id) || item.deleted) {
			return;
		}
		let { rows } = this.rows([item], { onlyAuto: true });
		if (!rows.length) {
			return;
		}
		let r = await this.apply(rows, "otomatik: " + (item.getDisplayTitle() || item.key), { sessiz: true });
		if (r && r.written) {
			this.notify(`${item.getDisplayTitle()}\n${r.written} güvenli düzeltme uygulandı (geri alınabilir)`, "Metadata otomatik düzeltildi");
		}
	},

	// ------------------------------------------------------------ dosyalar

	async loadRegistry() {
		try {
			return await IOUtils.readJSON(this.registryFile);
		}
		catch (e) {
			return {};
		}
	},

	async saveRegistry(reg) {
		await IOUtils.writeJSON(this.registryFile, reg, { tmpPath: this.registryFile + ".tmp" });
	},

	async loadExceptions() {
		try {
			if (await IOUtils.exists(this.exceptionsFile)) {
				let text = await IOUtils.readUTF8(this.exceptionsFile);
				this.istisnalar = text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		return this.istisnalar;
	},

	async openExceptions() {
		if (!(await IOUtils.exists(this.exceptionsFile))) {
			await IOUtils.writeUTF8(this.exceptionsFile,
				"# Metadata Düzelt — istisna listesi\n"
				+ "# Her satıra bir kelime ya da ifade. Başlık cümle düzenine çevrilirken bu yazım aynen korunur\n"
				+ "# (özel adlar, kısaltmalar, kurum adları). # ile başlayan satırlar yok sayılır.\n"
				+ "# Örnek:\n# Çamlıca\n# Akbelen Ormanı\n# İkizköy\n");
		}
		Zotero.launchFile(this.exceptionsFile);
	},

	async log(line) {
		try {
			await IOUtils.makeDirectory(PathUtils.parent(this.logFile), { ignoreExisting: true });
			let stamp = new Date().toLocaleString("tr-TR");
			await IOUtils.writeUTF8(this.logFile, `${stamp}  ${line}\n`, { mode: "appendOrCreate" });
		}
		catch (e) {
			Zotero.logError(e);
		}
	},

	async openLog() {
		if (!(await IOUtils.exists(this.logFile))) {
			this.notify("Henüz kayıt yok.");
			return;
		}
		Zotero.launchFile(this.logFile);
	},

	notify(text, headline = "Metadata Düzelt") {
		let pw = new Zotero.ProgressWindow();
		pw.changeHeadline(headline);
		pw.addDescription(text);
		pw.show();
		pw.startCloseTimer(7000);
	},
};
