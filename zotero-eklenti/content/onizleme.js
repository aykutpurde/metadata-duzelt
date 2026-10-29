/* Metadata Düzelt — önizleme penceresi. window.arguments[0]:
 *   { baslik, satirlar: [{ itemID, key, baslik, alan, eski, yeni, aciklama, guven, kurallar }], uyarilar,
 *     etiket(kural) → metin, onUygula(seciliIndeksler), onGoster(itemID) }
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

	document.title = "Metadata Düzelt — " + (args.baslik || "önizleme");
	$("baslik").textContent = `${args.baslik || ""} · ${satirlar.length} öneri`;

	if (args.uyarilar && args.uyarilar.length) {
		let u = $("uyarilar");
		u.hidden = false;
		u.textContent = "Uyarılar (değişiklik önerilmiyor, elle bakılmalı):\n";
		for (let w of args.uyarilar.slice(0, 50)) {
			let div = document.createElement("div");
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
		yeni.textContent = kisalt(s.yeni);
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
	$("uygula").addEventListener("click", () => {
		let liste = [...secili].sort((a, b) => a - b);
		$("uygula").disabled = true;
		try {
			args.onUygula && args.onUygula(liste);
		}
		finally {
			window.close();
		}
	});
	ozet();
})();
