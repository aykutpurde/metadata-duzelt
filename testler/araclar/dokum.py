"""Zotero veritabanının salt-okunur KOPYASINDAN düz kayıt dökümü (items.json) üretir.

Kullanım:
  cp ~/Zotero/zotero.sqlite ~/Zotero/zotero.sqlite-wal <geçici-klasör>/   # Zotero açıkken WAL dosyası da kopyalanmalı
  sqlite3 <geçici-klasör>/zotero.sqlite "pragma journal_mode=delete;"
  python3 -I testler/araclar/dokum.py <geçici-klasör>/zotero.sqlite <geçici-klasör>/items.json

Asla ~/Zotero/zotero.sqlite üzerinde çalıştırma; her zaman kopyada.
Çıktı biçimi: [{key, type, lib, fields: {alan: değer}, creators: [{first, last, mode, type}]}]
"""
import json
import sqlite3
import sys

db = sqlite3.connect("file:" + sys.argv[1] + "?mode=ro", uri=True)
db.row_factory = sqlite3.Row
items = {}
for r in db.execute("""
    select i.itemID, i.key, t.typeName, l.libraryID
    from items i join itemTypes t using(itemTypeID) join libraries l using(libraryID)
    where t.typeName not in ('annotation', 'attachment', 'note')
      and i.itemID not in (select itemID from deletedItems)"""):
    items[r["itemID"]] = {"key": r["key"], "type": r["typeName"], "lib": r["libraryID"], "fields": {}, "creators": []}
for r in db.execute("""
    select d.itemID, f.fieldName, v.value
    from itemData d join fields f using(fieldID) join itemDataValues v using(valueID)"""):
    if r["itemID"] in items:
        items[r["itemID"]]["fields"][r["fieldName"]] = r["value"]
for r in db.execute("""
    select ic.itemID, c.firstName, c.lastName, c.fieldMode, ct.creatorType
    from itemCreators ic join creators c using(creatorID) join creatorTypes ct using(creatorTypeID)
    order by ic.itemID, ic.orderIndex"""):
    if r["itemID"] in items:
        items[r["itemID"]]["creators"].append({"first": r["firstName"], "last": r["lastName"], "mode": r["fieldMode"], "type": r["creatorType"]})
with open(sys.argv[2], "w", encoding="utf-8") as f:
    json.dump(list(items.values()), f, ensure_ascii=False, indent=0)
print(len(items), "kayıt")
