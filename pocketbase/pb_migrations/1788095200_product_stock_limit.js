migrate((app) => {
  const products = app.findCollectionByNameOrId("sinprisa_products")
  try { products.fields.getByName("stock_limit"); return } catch (_) {}
  products.fields.add(new NumberField({ name: "stock_limit", min: 0, max: 9999, onlyInt: true, help: "0 significa sin límite. Al alcanzarlo, la pieza se agota." }))
  app.save(products)
}, (app) => {
  const products = app.findCollectionByNameOrId("sinprisa_products")
  try { products.fields.removeByName("stock_limit"); app.save(products) } catch (_) {}
})
