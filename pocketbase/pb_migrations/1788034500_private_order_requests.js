migrate((app) => {
  const orders = app.findCollectionByNameOrId("sinprisa_orders")
  orders.fields.add(new TextField({
    name: "request_key",
    required: true,
    max: 64,
    hidden: true,
    help: "Clave idempotente privada de la solicitud pública.",
  }))
  orders.addIndex("idx_sinprisa_orders_request_key", true, "request_key", "")
  app.save(orders)

  const collectionSeeds = [
    { name: "Bebé", slug: "bebe", description: "Piezas bordadas para bebés.", sortOrder: 0 },
    { name: "Regalo", slug: "regalo", description: "Detalles hechos a mano para regalar.", sortOrder: 1 },
    { name: "Hogar", slug: "hogar", description: "Bordados para acompañar espacios y recuerdos.", sortOrder: 2 },
    { name: "Encargo", slug: "encargo", description: "Piezas diseñadas a medida.", sortOrder: 3 },
  ]
  const collectionIds = {}
  for (const seed of collectionSeeds) {
    let record
    try {
      record = app.findFirstRecordByData("sinprisa_collections", "slug", seed.slug)
    } catch (_) {
      record = new Record(app.findCollectionByNameOrId("sinprisa_collections"))
      record.set("name", seed.name)
      record.set("slug", seed.slug)
      record.set("description", seed.description)
      record.set("status", "published")
      record.set("sort_order", seed.sortOrder)
      app.save(record)
    }
    collectionIds[seed.slug] = record.id
  }

  const productSeeds = [
    { name: "Babero Danna", slug: "babero-danna", collection: "bebe", description: "Lino lavado, volante y bordado de ocas y flores.", price: 28, sortOrder: 0, featured: true },
    { name: "Bolsa Jardín", slug: "bolsa-jardin", collection: "regalo", description: "Bolsa de lino bordada puntada a puntada.", price: 22, sortOrder: 1, featured: false },
    { name: "Bastidor Botánico", slug: "bastidor-botanico", collection: "hogar", description: "Pequeño paisaje floral para guardar un recuerdo.", price: 35, sortOrder: 2, featured: false },
  ]
  for (const seed of productSeeds) {
    try {
      app.findFirstRecordByData("sinprisa_products", "slug", seed.slug)
      continue
    } catch (_) {
      const record = new Record(app.findCollectionByNameOrId("sinprisa_products"))
      record.set("name", seed.name)
      record.set("slug", seed.slug)
      record.set("collection", collectionIds[seed.collection])
      record.set("short_description", seed.description)
      record.set("description", seed.description)
      record.set("price", seed.price)
      record.set("price_mode", "fixed")
      record.set("status", "published")
      record.set("stock_mode", "available")
      record.set("featured", seed.featured)
      record.set("sort_order", seed.sortOrder)
      record.set("published_at", new Date().toISOString())
      app.save(record)
    }
  }
}, (app) => {
  const orders = app.findCollectionByNameOrId("sinprisa_orders")
  orders.removeIndex("idx_sinprisa_orders_request_key")
  orders.fields.removeByName("request_key")
  app.save(orders)
})
