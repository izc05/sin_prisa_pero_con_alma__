routerAdd("POST", "/api/sinprisa/commissions", (e) => {
  const expectedSecret = String($os.getenv("SINPRISA_ORDER_INTAKE_SECRET") || "")
  const providedSecret = String(e.request.header.get("X-Sinprisa-Intake-Secret") || "")
  if (!expectedSecret || !$security.equal($security.sha256(providedSecret), $security.sha256(expectedSecret))) {
    throw new ForbiddenError("Acceso denegado")
  }
  const account = e.auth
  const body = e.requestInfo().body || {}
  const piece = String(body.piece || "").trim()
  const occasion = String(body.occasion || "").trim()
  const details = String(body.details || "").trim()
  const productReference = String(body.product_reference || "").trim()
  const productName = String(body.product_name || "").trim()
  const quantity = Number(body.quantity || 1)
  const files = e.findUploadedFiles("images") || []
  if (piece.length < 2 || piece.length > 120 || occasion.length > 200 || details.length < 10 || details.length > 4000 || productName.length > 200 || (productReference && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productReference))) {
    throw new BadRequestError("Datos del encargo no válidos")
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || files.length > 4) {
    throw new BadRequestError("Cantidad o imágenes no válidas")
  }

  let responseData
  e.app.runInTransaction((txApp) => {
    let customer
    const email = account.getString("email").trim().toLowerCase()
    const name = account.getString("name").trim()
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

    const commission = new Record(txApp.findCollectionByNameOrId("sinprisa_commissions"))
    commission.set("account", account.id)
    commission.set("customer", customer.id)
    commission.set("idea", piece)
    const productContext = productReference ? "\n\nPieza de referencia: " + (productName || productReference) + " [" + productReference + "]" : ""
    commission.set("details", details + productContext + (occasion ? "\n\nOcasión o fecha: " + occasion : ""))
    commission.set("quantity", quantity)
    commission.set("status", "new")
    if (files.length) commission.set("reference_images", files)
    txApp.save(commission)

    const message = new Record(txApp.findCollectionByNameOrId("sinprisa_messages"))
    message.set("name", name)
    message.set("email", email)
    message.set("subject", "Nuevo encargo " + commission.id)
    message.set("body", piece + " · " + details + productContext)
    message.set("status", "new")
    txApp.save(message)
    responseData = { reference: "ENC-" + commission.id.toUpperCase(), images: files.length }
  })
  return e.json(201, responseData)
}, $apis.requireAuth("sinprisa_customer_accounts"), $apis.bodyLimit(18 * 1024 * 1024), $apis.skipSuccessActivityLog())

routerAdd("GET", "/api/sinprisa/my-commissions", (e) => {
  const commissions = []
  const accountId = String(e.auth.id || "")
  const messagesByCommission = {}
  try {
    for (const message of e.app.findAllRecords("sinprisa_commission_messages")) {
      if (!message || message.getString("account") !== accountId) continue
      const commissionId = message.getString("commission")
      if (!messagesByCommission[commissionId]) messagesByCommission[commissionId] = []
      messagesByCommission[commissionId].push({
        author: message.getString("author"),
        body: message.getString("body"),
        sentAt: message.getString("sent_at"),
      })
    }
  } catch (_) {}
  for (const record of e.app.findAllRecords("sinprisa_commissions")) {
    if (!record || record.getString("account") !== accountId) continue
    commissions.push({
      id: record.id,
      reference: "ENC-" + record.id.toUpperCase(),
      piece: record.getString("idea"),
      details: record.getString("details"),
      quantity: record.getInt("quantity"),
      status: record.getString("status"),
      createdAt: record.getString("event_date") || record.getString("created"),
      reply: record.getString("customer_reply"),
      messages: messagesByCommission[record.id] || [],
    })
  }
  for (const commission of commissions) {
    if (commission.reply) commission.messages.push({ author: "atelier", body: commission.reply, sentAt: "" })
    commission.messages.sort((left, right) => String(left.sentAt).localeCompare(String(right.sentAt)))
  }
  commissions.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  return e.json(200, { commissions: commissions })
}, $apis.requireAuth("sinprisa_customer_accounts"), $apis.skipSuccessActivityLog())

routerAdd("GET", "/api/sinprisa/my-orders", (e) => {
  const email = String(e.auth.getString("email") || "").trim().toLowerCase()
  let customer
  try { customer = e.app.findFirstRecordByData("sinprisa_customers", "email", email) } catch (_) { return e.json(200, { orders: [] }) }
  const itemsByOrder = {}
  for (const item of e.app.findAllRecords("sinprisa_order_items")) {
    if (!item) continue
    const orderId = item.getString("order")
    if (!itemsByOrder[orderId]) itemsByOrder[orderId] = []
    itemsByOrder[orderId].push({ name: item.getString("product_name_snapshot"), quantity: item.getInt("quantity"), unitPrice: item.getFloat("unit_price") })
  }
  const labels = { pending: "Solicitud recibida", confirmed: "Pendiente de Bizum", preparing: "En preparación", ready: "En preparación", shipped: "Enviado", completed: "Completado", cancelled: "Cancelado" }
  const orders = e.app.findAllRecords("sinprisa_orders").filter(record => record && record.getString("customer") === customer.id).map(record => ({
    id: record.id, number: record.getString("number"), status: labels[record.getString("status")] || record.getString("status"), total: record.getFloat("total"), createdAt: record.getString("created"), items: itemsByOrder[record.id] || []
  })).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  return e.json(200, { orders: orders })
}, $apis.requireAuth("sinprisa_customer_accounts"), $apis.skipSuccessActivityLog())

routerAdd("POST", "/api/sinprisa/commission-messages", (e) => {
  const accountId = String(e.auth.id || "")
  const body = e.requestInfo().body || {}
  const commissionId = String(body.commission || "").trim()
  const messageBody = String(body.message || "").trim()
  if (!/^[a-z0-9]{15}$/.test(commissionId) || !messageBody || messageBody.length > 4000) throw new BadRequestError("Mensaje no válido")
  let commission
  try { commission = e.app.findRecordById("sinprisa_commissions", commissionId) } catch (_) { throw new NotFoundError("Encargo no encontrado") }
  if (commission.getString("account") !== accountId) throw new NotFoundError("Encargo no encontrado")
  const message = new Record(e.app.findCollectionByNameOrId("sinprisa_commission_messages"))
  message.set("commission", commissionId)
  message.set("account", accountId)
  message.set("author", "customer")
  message.set("body", messageBody)
  message.set("sent_at", new Date().toISOString())
  e.app.save(message)
  return e.json(201, { message: { author: "customer", body: messageBody, sentAt: message.getString("sent_at") } })
}, $apis.requireAuth("sinprisa_customer_accounts"), $apis.skipSuccessActivityLog())

routerAdd("DELETE", "/api/sinprisa/commission-messages", (e) => {
  const accountId = String(e.auth.id || "")
  const body = e.requestInfo().body || {}
  const commissionId = String(body.commission || "").trim()
  if (!/^[a-z0-9]{15}$/.test(commissionId)) throw new BadRequestError("Conversación no válida")
  let commission
  try { commission = e.app.findRecordById("sinprisa_commissions", commissionId) } catch (_) { throw new NotFoundError("Encargo no encontrado") }
  if (commission.getString("account") !== accountId) throw new NotFoundError("Encargo no encontrado")
  e.app.runInTransaction((txApp) => {
    for (const message of txApp.findAllRecords("sinprisa_commission_messages")) {
      if (message && message.getString("commission") === commissionId && message.getString("account") === accountId) txApp.delete(message)
    }
    if (commission.getString("customer_reply")) {
      commission.set("customer_reply", "")
      txApp.save(commission)
    }
  })
  return e.json(200, { cleared: true })
}, $apis.requireAuth("sinprisa_customer_accounts"), $apis.skipSuccessActivityLog())

routerAdd("PATCH", "/api/sinprisa/my-profile", (e) => {
  const body = e.requestInfo().body || {}
  const limits = { name: 120, phone: 32, address_line1: 160, address_line2: 160, postal_code: 16, city: 120, province: 120, country: 80 }
  const profile = {}
  for (const [field, max] of Object.entries(limits)) {
    const value = String(body[field] || "").trim().replace(/\s+/g, " ")
    if (value.length > max) throw new BadRequestError("El campo " + field + " es demasiado largo")
    profile[field] = value
  }
  if (profile.name.length < 2) throw new BadRequestError("Escribe tu nombre")
  const account = e.auth
  for (const [field, value] of Object.entries(profile)) account.set(field, value)
  e.app.save(account)
  try {
    const customer = e.app.findFirstRecordByData("sinprisa_customers", "email", account.getString("email").trim().toLowerCase())
    customer.set("name", profile.name)
    e.app.save(customer)
  } catch (_) {}
  return e.json(200, { user: { id: account.id, email: account.getString("email"), ...profile } })
}, $apis.requireAuth("sinprisa_customer_accounts"), $apis.skipSuccessActivityLog())
