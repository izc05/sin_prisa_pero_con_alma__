migrate((app) => {
  const seeds = [
    { name: "Bautizos y comuniones", slug: "bautizos-comuniones", description: "Detalles personalizados para celebraciones especiales.", sortOrder: 4 },
    { name: "Bodas", slug: "bodas", description: "Bordados y recuerdos personalizados para bodas.", sortOrder: 5 },
    { name: "Navidad", slug: "navidad", description: "Piezas bordadas para regalar y decorar en Navidad.", sortOrder: 6 },
    { name: "Complementos", slug: "complementos", description: "Bolsas, neceseres y otros complementos textiles.", sortOrder: 7 },
  ]

  const collection = app.findCollectionByNameOrId("sinprisa_collections")
  for (const seed of seeds) {
    try {
      app.findFirstRecordByData("sinprisa_collections", "slug", seed.slug)
      continue
    } catch (_) {}

    const record = new Record(collection)
    record.set("name", seed.name)
    record.set("slug", seed.slug)
    record.set("description", seed.description)
    record.set("status", "published")
    record.set("sort_order", seed.sortOrder)
    app.save(record)
  }
}, (app) => {
  for (const slug of ["bautizos-comuniones", "bodas", "navidad", "complementos"]) {
    try {
      const record = app.findFirstRecordByData("sinprisa_collections", "slug", slug)
      try {
        app.findFirstRecordByData("sinprisa_products", "collection", record.id)
        continue
      } catch (_) {}
      app.delete(record)
    } catch (_) {}
  }
})
