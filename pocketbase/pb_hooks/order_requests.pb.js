// Recepción privada de solicitudes desde Cloudflare Pages. Esta ruta solo debe
// publicarse detrás de Cloudflare Access y exige además un secreto de origen.
routerAdd("POST", "/api/sinprisa/order-requests", (e) => {
  const expectedSecret = String($os.getenv("SINPRISA_ORDER_INTAKE_SECRET") || "")
  const providedSecret = String(e.request.header.get("X-Sinprisa-Intake-Secret") || "")
  if (!expectedSecret || !$security.equal($security.sha256(providedSecret), $security.sha256(expectedSecret))) {
    throw new ForbiddenError("Acceso denegado")
  }

  const requestKey = String(e.request.header.get("Idempotency-Key") || "").trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
    throw new BadRequestError("Solicitud no válida")
  }

  const body = e.requestInfo().body || {}
  const customerData = body.customer || {}
  const name = String(customerData.name || "").trim().replace(/\s+/g, " ")
  const email = String(customerData.email || "").trim().toLowerCase()
  const items = Array.isArray(body.items) ? body.items : []
  if (name.length < 2 || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestError("Datos de contacto no válidos")
  }
  if (items.length < 1 || items.length > 20) throw new BadRequestError("Cesta no válida")

  let responseData = null
  e.app.runInTransaction((txApp) => {
    try {
      const existing = txApp.findFirstRecordByData("sinprisa_orders", "request_key", requestKey)
      responseData = {
        orderNumber: existing.getString("number"),
        total: existing.getFloat("total"),
      }
      return
    } catch (_) {
      // La ausencia de registro es el caso normal para una solicitud nueva.
    }

    const normalizedItems = []
    let subtotal = 0
    for (const item of items) {
      const productId = String(item && item.productId || "").trim()
      const quantity = Number(item && item.quantity)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        throw new BadRequestError("Cesta no válida")
      }

      let product
      try {
        product = txApp.findFirstRecordByData("sinprisa_products", "slug", productId)
      } catch (_) {
        throw new BadRequestError("Producto no disponible")
      }
      if (product.getString("status") !== "published" || product.getString("stock_mode") === "sold_out" || product.getString("price_mode") === "quote") {
        throw new BadRequestError("Producto no disponible")
      }
      const stockLimit = product.getInt("stock_limit")
      if (stockLimit > 0) {
        let reserved = 0
        for (const line of txApp.findAllRecords("sinprisa_order_items")) {
          if (!line || line.getString("product") !== product.id) continue
          try {
            const previousOrder = txApp.findRecordById("sinprisa_orders", line.getString("order"))
            if (previousOrder.getString("status") !== "cancelled") reserved += line.getInt("quantity")
          } catch (_) {}
        }
        if (reserved + quantity > stockLimit) throw new BadRequestError("Producto no disponible")
      }
      const unitPrice = Number(product.get("price"))
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new BadRequestError("Precio no disponible")
      subtotal += Math.round(unitPrice * 100) * quantity
      normalizedItems.push({ product, quantity, unitPrice })
    }
    subtotal = subtotal / 100

    let customer
    try {
      customer = txApp.findFirstRecordByData("sinprisa_customers", "email", email)
      if (customer.getString("name") !== name) {
        customer.set("name", name)
        txApp.save(customer)
      }
    } catch (_) {
      customer = new Record(txApp.findCollectionByNameOrId("sinprisa_customers"))
      customer.set("name", name)
      customer.set("email", email)
      txApp.save(customer)
    }

    const order = new Record(txApp.findCollectionByNameOrId("sinprisa_orders"))
    order.set("number", "SOL-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + $security.randomString(6).toUpperCase())
    order.set("request_key", requestKey)
    order.set("customer", customer.id)
    order.set("status", "pending")
    order.set("payment_status", "pending")
    order.set("subtotal", subtotal)
    order.set("shipping", 0)
    order.set("total", subtotal)
    txApp.save(order)

    const itemCollection = txApp.findCollectionByNameOrId("sinprisa_order_items")
    for (const item of normalizedItems) {
      const line = new Record(itemCollection)
      line.set("order", order.id)
      line.set("product", item.product.id)
      line.set("product_name_snapshot", item.product.getString("name"))
      line.set("quantity", item.quantity)
      line.set("unit_price", item.unitPrice)
      line.set("customization", "")
      txApp.save(line)
      const stockLimit = item.product.getInt("stock_limit")
      if (stockLimit > 0) {
        let reserved = 0
        for (const savedLine of txApp.findAllRecords("sinprisa_order_items")) {
          if (savedLine && savedLine.getString("product") === item.product.id) reserved += savedLine.getInt("quantity")
        }
        if (reserved >= stockLimit) {
          item.product.set("stock_mode", "sold_out")
          txApp.save(item.product)
        }
      }
    }

    responseData = { orderNumber: order.getString("number"), total: subtotal }
  })

  return e.json(201, responseData)
}, $apis.bodyLimit(16 * 1024), $apis.skipSuccessActivityLog())
