function requireCatalogSecret(e) {
  const expected = String($os.getenv("SINPRISA_ORDER_INTAKE_SECRET") || "")
  const provided = String(e.request.header.get("X-Sinprisa-Intake-Secret") || "")
  if (!expected || !$security.equal($security.sha256(provided), $security.sha256(expected))) {
    throw new ForbiddenError("Acceso denegado")
  }
}

function publicImagePath(imageId) {
  return "/api/catalog-image?id=" + encodeURIComponent(imageId)
}

routerAdd("GET", "/api/sinprisa/catalog", (e) => {
  requireCatalogSecret(e)

  const collectionRecords = e.app.findAllRecords("sinprisa_collections")
  const collectionsById = {}
  const collections = []
  for (const record of collectionRecords) {
    if (!record || record.getString("status") !== "published") continue
    const item = {
      id: record.getString("slug"),
      name: record.getString("name"),
      position: record.getInt("sort_order"),
    }
    collectionsById[record.id] = item
    collections.push(item)
  }

  const imagesByProduct = {}
  for (const image of e.app.findAllRecords("sinprisa_product_images")) {
    if (!image) continue
    const productId = image.getString("product")
    if (!imagesByProduct[productId]) imagesByProduct[productId] = []
    imagesByProduct[productId].push({
      id: image.id,
      src: publicImagePath(image.id),
      alt: image.getString("alt_text"),
      position: image.getInt("sort_order"),
      primary: image.getBool("is_cover"),
    })
  }

  const products = []
  for (const record of e.app.findAllRecords("sinprisa_products")) {
    if (!record || record.getString("status") !== "published" || record.getString("stock_mode") === "sold_out") continue
    const collection = collectionsById[record.getString("collection")]
    const images = imagesByProduct[record.id] || []
    images.sort((left, right) => Number(right.primary) - Number(left.primary) || left.position - right.position)
    if (!collection || !images.length) continue
    const priceMode = record.getString("price_mode")
    products.push({
      id: record.getString("slug"),
      name: record.getString("name"),
      category: collection.id,
      description: record.getString("description") || record.getString("short_description"),
      price: priceMode === "quote" ? null : Number(record.get("price")),
      priceMode: priceMode,
      stockMode: record.getString("stock_mode"),
      featured: record.getBool("featured"),
      position: record.getInt("sort_order"),
      images: images,
      image: images[0].src,
      imageAlt: images[0].alt,
    })
  }

  collections.sort((left, right) => left.position - right.position)
  products.sort((left, right) => Number(right.featured) - Number(left.featured) || left.position - right.position)
  e.response.header().set("Cache-Control", "no-store")
  return e.json(200, { collections: collections, products: products })
}, $apis.skipSuccessActivityLog())

routerAdd("GET", "/api/sinprisa/catalog-image/{id}", (e) => {
  requireCatalogSecret(e)
  const id = String(e.request.pathValue("id") || "")
  if (!/^[a-z0-9]{15}$/.test(id)) throw new NotFoundError("Imagen no encontrada")

  let image
  let product
  try {
    image = e.app.findRecordById("sinprisa_product_images", id)
    product = e.app.findRecordById("sinprisa_products", image.getString("product"))
  } catch (_) {
    throw new NotFoundError("Imagen no encontrada")
  }
  if (product.getString("status") !== "published" || product.getString("stock_mode") === "sold_out") {
    throw new NotFoundError("Imagen no encontrada")
  }

  const filename = image.getString("original")
  const extension = filename.toLowerCase().split(".").pop()
  const contentType = ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" })[extension]
  if (!filename || !contentType) throw new NotFoundError("Imagen no encontrada")

  let filesystem
  let reader
  try {
    filesystem = e.app.newFilesystem()
    reader = filesystem.getReader(image.baseFilesPath() + "/" + filename)
    e.response.header().set("Cache-Control", "private, no-store")
    return e.stream(200, contentType, reader)
  } finally {
    if (reader) reader.close()
    if (filesystem) filesystem.close()
  }
}, $apis.skipSuccessActivityLog())
