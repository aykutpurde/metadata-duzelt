#!/usr/bin/env node
/* Kuru çalıştırma: dokum.py'nin ürettiği items.json'u motor.analiz'den geçirir; hiçbir şey yazmaz.
 *
 *   node testler/araclar/kuru.js <items.json> [ayarlar-json]
 *   node testler/araclar/kuru.js /tmp/x/items.json '{"stil":"cumle"}'
 *
 * Çıktı: kural sayımı, Her Kelime Büyük dönüşümünde kelime bazlı değişim sıklığı (yanlış kuralları yakalamak için),
 * büyük → küçük giden kelimeler (bağlaç dışı bir şey küçülüyorsa şüpheli), rastgele örnekler.
 * Ayrıntılı döküm <items.json>'un yanına kuru-sonuc.json olarak yazılır.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const motor = require(path.join(__dirname, "..", "..", "zotero-eklenti", "kurallar", "motor.js"));

const girdi = process.argv[2];
if (!girdi) {
	console.error("kullanım: node testler/araclar/kuru.js <items.json> [ayarlar-json]");
	process.exit(2);
}
const ayarlar = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const items = JSON.parse(fs.readFileSync(girdi, "utf8"));

let kuralSay = {}, kelimeDegisim = {}, ornekler = { "harf.kucukBaslik": [], "harf.tamamiBuyuk": [], "harf.titleCase": [] };
let n = 0, oneriliKayit = 0, toplamOneri = 0, uyariSay = 0;
for (let it of items) {
	let kayit = {
		itemType: it.type,
		fields: it.fields,
		creators: (it.creators || []).map((c) => ({ firstName: c.first || "", lastName: c.last || "", fieldMode: c.mode, creatorType: c.type })),
	};
	let r = motor.analiz(kayit, ayarlar);
	n++;
	uyariSay += r.uyarilar.length;
	if (r.oneriler.length) {
		oneriliKayit++;
	}
	toplamOneri += r.oneriler.length;
	for (let o of r.oneriler) {
		for (let k of o.kurallar) {
			kuralSay[k.kural] = (kuralSay[k.kural] || 0) + 1;
			if (ornekler[k.kural] && o.alan == "title") {
				ornekler[k.kural].push([it.key, o.eski, o.yeni]);
			}
			if (k.kural == "harf.kucukBaslik" && o.alan == "title") {
				let a = o.eski.split(/\s+/), b = o.yeni.split(/\s+/);
				if (a.length == b.length) {
					for (let i = 0; i < a.length; i++) {
						if (a[i] != b[i]) {
							let key = `${a[i]} → ${b[i]}`;
							kelimeDegisim[key] = (kelimeDegisim[key] || 0) + 1;
						}
					}
				}
			}
		}
	}
}
console.log(`kayıt ${n}, önerili ${oneriliKayit}, öneri ${toplamOneri}, uyarı ${uyariSay}`);
console.log(Object.entries(kuralSay).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join("\n"));
let top = Object.entries(kelimeDegisim).sort((x, y) => y[1] - x[1]);
console.log("\nEn sık kelime değişimleri (harf.kucukBaslik):");
console.log(top.slice(0, 60).map(([k, v]) => `${v}\t${k}`).join("\n"));
console.log("\nBüyük → küçük (ilk harf) değişimleri:");
console.log(top.filter(([k]) => {
	let [a, b] = k.split(" → ");
	return a[0] !== a[0].toLocaleLowerCase("tr") && b[0] === b[0].toLocaleLowerCase("tr");
}).map(([k, v]) => `${v}\t${k}`).join("\n"));

function rastgele(arr, k) {
	let a = arr.slice(), out = [], seed = 42;
	while (out.length < k && a.length) {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		out.push(a.splice(seed % a.length, 1)[0]);
	}
	return out;
}
for (let k of Object.keys(ornekler)) {
	if (!ornekler[k].length) {
		continue;
	}
	console.log(`\n--- ${k} rastgele örnekler (${ornekler[k].length})`);
	for (let [key, e, y] of rastgele(ornekler[k], 20)) {
		console.log(`${key}\n  ${e}\n  ${y}`);
	}
}
let cikti = path.join(path.dirname(girdi), "kuru-sonuc.json");
fs.writeFileSync(cikti, JSON.stringify({ ayarlar, kuralSay, kelimeDegisim: top, ornekler }, null, 1));
console.log(`\nayrıntı: ${cikti}`);
