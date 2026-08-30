migrate((app) => {
  try { app.findCollectionByNameOrId("sinprisa_content_blocks"); return } catch (_) {}
  const blocks = new Collection({
    type: "base",
    name: "sinprisa_content_blocks",
    listRule: '@request.auth.role = "owner" || @request.auth.role = "editor"',
    viewRule: '@request.auth.role = "owner" || @request.auth.role = "editor"',
    createRule: '@request.auth.role = "owner" || @request.auth.role = "editor"',
    updateRule: '@request.auth.role = "owner" || @request.auth.role = "editor"',
    deleteRule: '@request.auth.role = "owner" || @request.auth.role = "editor"',
    fields: [
      new TextField({ name: "key", required: true, max: 80 }),
      new TextField({ name: "title", required: true, max: 180 }),
      new TextField({ name: "body", required: true, max: 4000 }),
      new BoolField({ name: "enabled" })
    ]
  })
  blocks.addIndex("idx_sinprisa_content_blocks_key", true, "key", "")
  app.save(blocks)
  for (const block of [
    { key: "home_notice", title: "Hecho despacio, pensado para durar", body: "Cada pieza se borda a mano en Jaén. Si buscas algo único, cuéntanos tu idea." },
    { key: "brand_intro", title: "Una historia en cada puntada", body: "Creamos piezas textiles con calma, intención y mucho cariño." },
    { key: "journal_intro", title: "Desde el cuaderno de taller", body: "Procesos, materiales e historias que acompañan cada bordado." }
  ]) {
    const record = new Record(blocks); record.set(block); record.set("enabled", true); app.save(record)
  }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("sinprisa_content_blocks")) } catch (_) {}
})
