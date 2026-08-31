migrate((app) => {
  let blocks
  try { blocks = app.findCollectionByNameOrId("sinprisa_content_blocks") } catch (_) { return }

  for (const block of [
    { key: "home_notice", title: "Hecho despacio, pensado para durar", body: "Cada pieza se borda a mano en Jaén. Si buscas algo único, cuéntanos tu idea." },
    { key: "brand_intro", title: "Una historia en cada puntada", body: "Creamos piezas textiles con calma, intención y mucho cariño." },
    { key: "journal_intro", title: "Desde el cuaderno de taller", body: "Procesos, materiales e historias que acompañan cada bordado." }
  ]) {
    try { app.findFirstRecordByData("sinprisa_content_blocks", "key", block.key); continue } catch (_) {}
    const record = new Record(blocks)
    record.set(block)
    record.set("enabled", true)
    app.save(record)
  }
}, () => {})
