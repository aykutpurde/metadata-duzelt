/* Metadata Düzelt — önizleme penceresi. window.arguments[0]:
 *   { baslik, satirlar: [{ itemID, key, baslik, alan, eski, yeni, aciklama, guven, kurallar }], uyarilar,
 *     etiket(kural) → metin, onUygula(seciliIndeksler, elleDuzeltmeler), onGoster(itemID), kisaBaslik(baslik) → metin }
 *   "Yeni" hücresine tıklanınca öneri elle düzenlenebilir; elleDuzeltmeler: { indeks: { yeni, yeniYazar? } }.
 */
(function () {
	"use strict";
	const args = window.arguments && window.arguments[0];
	if (!args) {
		return;
	}
	const ALAN = {
		title: "Başlık", shortTitle: "Kısa başlık", bookTitle: "Kitap adı", publicationTitle: "Yayın adı", abstractNote: "Özet",
		language: "Dil", publisher: "Yayıncı", university: "Üniversite", institution: "Kurum", series: "Seri", seriesTitle: "Seri adı",
		place: "Yer", creators: "Yazar", journalAbbreviation: "Dergi kısaltması", proceedingsTitle: "Bildiri kitabı", court: "Mahkeme",
		websiteTitle: "Site adı", blogTitle: "Blog adı", conferenceName: "Konferans", reporter: "Reporter", forumTitle: "Forum",
	};
	const $ = (id) => document.getElementById(id);
	const satirlar = args.satirlar || [];
	const secili = new Set(satirlar.map((s, i) => i));
	const elle = {};     // indeks → { yeni, yeniYazar? }: kullanıcının elle yazdığı değer
	const kisaOto = new Set();   // başlık düzenlenince yeniden üretilen kısa başlık satırları (kullanıcı dokunmadıkça güncellenir)

	document.title = "Metadata Düzelt — " + (args.baslik || "önizleme");
	$("baslik").textContent = `${args.baslik || ""} · ${satirlar.length} öneri`;

	if (args.uyarilar && args.uyarilar.length) {
		let u = $("uyarilar");
		u.hidden = false;
		u.textContent = "Uyarılar (değişiklik önerilmiyor, elle bakılmalı):\n";
		for (let [i, w] of args.uyarilar.slice(0, 50).entries()) {
			let div = document.createElement("div");
			div.dataset.u = i;
			div.textContent = `• ${w.baslik}: ${w.mesaj}`;
			u.appendChild(div);
		}
	}

	function kisalt(s, n = 400) {
		s = String(s == null ? "" : s);
		return s.length > n ? s.slice(0, n - 1) + "…" : s;
	}

	const govde = $("govde");
	let sonItem = null;
	satirlar.forEach((s, i) => {
		if (s.itemID !== sonItem) {
			sonItem = s.itemID;
			let tr = document.createElement("tr");
			tr.className = "kayit";
			let td = document.createElement("td");
			td.colSpan = 5;
			td.textContent = kisalt(s.baslik, 160);
			let link = document.createElement("span");
			link.className = "link";
			link.textContent = "Zotero'da göster";
			link.addEventListener("click", () => args.onGoster && args.onGoster(s.itemID));
			td.appendChild(link);
			tr.appendChild(td);
			govde.appendChild(tr);
		}
		let tr = document.createElement("tr");
		tr.className = "satir secili";
		tr.dataset.i = i;
		let cb = document.createElement("input");
		cb.type = "checkbox";
		cb.checked = true;
		cb.addEventListener("change", () => { cb.checked ? secili.add(i) : secili.delete(i); tr.classList.toggle("secili", cb.checked); ozet(); });
		let tdc = document.createElement("td");
		tdc.appendChild(cb);
		tr.appendChild(tdc);
		let alan = document.createElement("td");
		alan.className = "alan";
		alan.textContent = (ALAN[s.alan] || s.alan) + (s.alan == "creators" ? ` ${s.indeks + 1}` : "");
		tr.appendChild(alan);
		let eski = document.createElement("td");
		eski.className = "eski";
		eski.textContent = kisalt(s.eski);
		tr.appendChild(eski);
		let yeni = document.createElement("td");
		yeni.className = "yeni";
		yeni.title = "Düzenlemek için tıklayın";
		yeni.textContent = kisalt(s.yeni);
		yeni.addEventListener("click", (ev) => {
			ev.stopPropagation();
			if (!yeni.querySelector(".duzenle")) {
				duzenleAc(i, tr, yeni);
			}
		});
		tr.appendChild(yeni);
		let ac = document.createElement("td");
		ac.className = "aciklama";
		ac.textContent = (s.kurallar || []).map((k) => (args.etiket ? args.etiket(k.kural) : k.kural)).join(", ");
		let g = document.createElement("span");
		g.className = "guven " + s.guven;
		g.textContent = s.guven == "yuksek" ? "yüksek güven" : "göz atın";
		ac.appendChild(g);
		tr.appendChild(ac);
		tr.addEventListener("click", (ev) => {
			if (ev.target !== cb && ev.target.tagName != "INPUT") {
				cb.checked = !cb.checked;
				cb.dispatchEvent(new Event("change"));
			}
		});
		govde.appendChild(tr);
	});

	function yazarMetni(y) {
		return y.fieldMode == 1 ? `[${y.lastName}]` : `[${y.lastName}] [${y.firstName}]`;
	}

	function sec(tr, i, evet) {
		let cb = tr.querySelector("input[type=checkbox]");
		if (cb.checked != evet) {
			cb.checked = evet;
			cb.dispatchEvent(new Event("change"));
		}
	}

	/** Satırın "Yeni" hücresini düzenleme kutusuna çevirir. Enter (özette Cmd/Ctrl+Enter) kaydeder, Esc vazgeçer.
	 *  Yazar satırında soyadı ve ad ayrı kutulardır. Kaydedilen değer öneri yerine yazılır; eskisiyle aynıysa satır seçilmez. */
	function duzenleAc(i, tr, td) {
		let s = satirlar[i];
		let kutu = document.createElement("div");
		kutu.className = "duzenle";
		let girdiler = [];
		if (s.alan == "creators") {
			let y = s.yeniYazar || {};
			let alanlar = y.fieldMode == 1 ? [["lastName", "Ad (tek alan)"]] : [["lastName", "Soyadı"], ["firstName", "Adı"]];
			for (let [ad, yer] of alanlar) {
				let inp = document.createElement("input");
				inp.type = "text";
				inp.placeholder = yer;
				inp.value = y[ad] || "";
				inp.dataset.ad = ad;
				girdiler.push(inp);
				kutu.appendChild(inp);
			}
		}
		else {
			let ta = document.createElement("textarea");
			ta.value = s.yeni;
			ta.rows = Math.min(8, Math.max(2, Math.ceil(s.yeni.length / 70)));
			girdiler.push(ta);
			kutu.appendChild(ta);
		}
		let kaydet = document.createElement("button");
		kaydet.textContent = "Kaydet";
		let vazgec = document.createElement("button");
		vazgec.textContent = "Vazgeç";
		let dugmeler = document.createElement("div");
		dugmeler.append(kaydet, vazgec);
		kutu.appendChild(dugmeler);
		td.textContent = "";
		td.appendChild(kutu);
		girdiler[0].focus();
		girdiler[0].select();

		let kapat = () => {
			td.textContent = kisalt(s.yeni);
			if (elle[i]) {
				let r = document.createElement("span");
				r.className = "guven elle";
				r.textContent = "elle düzenlendi";
				td.appendChild(r);
			}
		};
		let kaydetFn = () => {
			if (s.alan == "creators") {
				let y = { ...s.yeniYazar };
				girdiler.forEach((inp) => { y[inp.dataset.ad] = inp.value.trim(); });
				if (!y.lastName) {
					girdiler[0].focus();
					return;
				}
				s.yeniYazar = y;
				s.yeni = yazarMetni(y);
				elle[i] = { yeni: s.yeni, yeniYazar: y };
			}
			else {
				let v = s.alan == "abstractNote" ? girdiler[0].value.trim() : girdiler[0].value.replace(/\s+/g, " ").trim();
				if (!v) {
					girdiler[0].focus();
					return;
				}
				s.yeni = v;
				elle[i] = { yeni: v };
				kisaOto.delete(i);
				if (s.alan == "title") {
					kisaBaslikGuncelle(s.itemID, v);
				}
			}
			kapat();
			sec(tr, i, s.yeni != s.eski);
		};
		kaydet.addEventListener("click", (ev) => { ev.stopPropagation(); kaydetFn(); });
		vazgec.addEventListener("click", (ev) => { ev.stopPropagation(); kapat(); });
		kutu.addEventListener("click", (ev) => ev.stopPropagation());
		kutu.addEventListener("keydown", (ev) => {
			if (ev.key == "Escape") {
				ev.preventDefault();
				ev.stopPropagation();
				kapat();
			}
			else if (ev.key == "Enter" && (s.alan != "abstractNote" || ev.metaKey || ev.ctrlKey)) {
				ev.preventDefault();
				kaydetFn();
			}
		});
	}

	/** Başlık elle değişince aynı kaydın (elle düzenlenmemiş) kısa başlık önerisi yeni başlıktan yeniden üretilir. */
	function kisaBaslikGuncelle(itemID, baslik) {
		if (!args.kisaBaslik) {
			return;
		}
		satirlar.forEach((k, j) => {
			if (k.itemID === itemID && k.alan == "shortTitle" && (!elle[j] || kisaOto.has(j))) {
				k.yeni = args.kisaBaslik(baslik);
				elle[j] = { yeni: k.yeni };
				kisaOto.add(j);
				let td = govde.querySelector(`tr.satir[data-i="${j}"] td.yeni`);
				if (td) {
					td.textContent = kisalt(k.yeni);
				}
			}
		});
	}

	function ozet() {
		$("ozet").textContent = `${secili.size} / ${satirlar.length} seçili`;
		$("uygula").textContent = `Seçilenleri uygula (${secili.size})`;
		$("uygula").disabled = secili.size == 0;
	}

	function hepsi(fn) {
		for (let tr of govde.querySelectorAll("tr.satir")) {
			let i = Number(tr.dataset.i);
			let cb = tr.querySelector("input");
			cb.checked = fn(satirlar[i]);
			cb.checked ? secili.add(i) : secili.delete(i);
			tr.classList.toggle("secili", cb.checked);
		}
		ozet();
	}
	$("tumu").addEventListener("click", () => hepsi(() => true));
	$("hicbiri").addEventListener("click", () => hepsi(() => false));
	$("yuksek").addEventListener("click", () => hepsi((s) => s.guven == "yuksek"));
	$("vazgec").addEventListener("click", () => window.close());

	const ISARET = { dogrulandi: "✓", farkli: "≠", bilgi: "ⓘ", bulunamadi: "?", kaynakYok: "–" };
	const toplam = args.dogrulanacak || 0;
	if (!args.onDogrula || !toplam) {
		$("dogrula").hidden = true;
	}
	$("dogrula").textContent = `Kaynakla doğrula (${toplam})`;
	function sonucYaz(kap, sonuc) {
		kap.querySelector(".dogrulama")?.remove();
		let div = document.createElement("div");
		div.className = "dogrulama " + sonuc.durum;
		div.textContent = `${ISARET[sonuc.durum] || ""} ${sonuc.mesaj}`;
		kap.appendChild(div);
	}
	$("dogrula").addEventListener("click", async () => {
		$("dogrula").disabled = true;
		let n = 0, celiski = 0;
		$("dogrulaDurum").textContent = `0 / ${toplam}…`;
		try {
			await args.onDogrula((tur, i, sonuc) => {
				n++;
				if (sonuc.durum == "farkli") {
					celiski++;
				}
				if (tur == "uyari") {
					let div = $("uyarilar").querySelector(`div[data-u="${i}"]`);
					if (div) {
						sonucYaz(div, sonuc);
					}
				}
				let tr = tur == "satir" && govde.querySelector(`tr.satir[data-i="${i}"]`);
				if (tr) {
					sonucYaz(tr.querySelector("td.aciklama"), sonuc);
					if (sonuc.yeniOneri && !elle[i]) {   // elle düzenlenmiş değerin üstüne yazılmaz
						tr.querySelector("td.yeni").textContent = kisalt(sonuc.yeniOneri);
					}
					let cb = tr.querySelector("input");
					if (sonuc.durum == "farkli" && cb.checked) {
						cb.checked = false;
						cb.dispatchEvent(new Event("change"));
					}
				}
				$("dogrulaDurum").textContent = `${n} / ${toplam}…`;
			});
			$("dogrulaDurum").textContent = `${n} öğe kaynakla karşılaştırıldı` + (celiski ? `; ${celiski} öğe kaynakla çelişiyor (önerinin seçimi kaldırıldı)` : "");
		}
		catch (e) {
			$("dogrulaDurum").textContent = "Doğrulama yarıda kaldı: " + (e.message || e);
			$("dogrula").disabled = false;
		}
	});
	$("uygula").addEventListener("click", () => {
		let liste = [...secili].sort((a, b) => a - b);
		$("uygula").disabled = true;
		try {
			args.onUygula && args.onUygula(liste, elle);
		}
		finally {
			window.close();
		}
	});
	ozet();
})();
