/* Metadata Düzelt — Zotero eklentisi: yaşam döngüsü kancaları. Asıl iş metadataduzelt.js içinde. */

var MetadataDuzelt;
var chromeHandle;

async function startup({ id, version, rootURI }, reason) {
	await Zotero.initializationPromise;
	// chrome://metadataduzelt/content/… adresi: önizleme penceresi buradan açılır
	let aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(Ci.amIAddonManagerStartup);
	let manifestURI = Services.io.newURI(rootURI + "manifest.json");
	chromeHandle = aomStartup.registerChrome(manifestURI, [["content", "metadataduzelt", "content/"]]);
	Services.scriptloader.loadSubScript(rootURI + "metadataduzelt.js");
	MetadataDuzelt.init({ id, version, rootURI });
	for (let win of Zotero.getMainWindows()) {
		onMainWindowLoad({ window: win });
	}
}

function onMainWindowLoad({ window }) {
	window.MozXULElement.insertFTLIfNeeded("metadataduzelt.ftl");
}

function onMainWindowUnload({ window }) {
	window.document.querySelector('link[href="metadataduzelt.ftl"]')?.remove();
}

function shutdown() {
	MetadataDuzelt?.shutdown();
	for (let win of Zotero.getMainWindows()) {
		onMainWindowUnload({ window: win });
	}
	MetadataDuzelt = undefined;
	chromeHandle?.destruct();
	chromeHandle = undefined;
}

function install() {}

function uninstall() {}
