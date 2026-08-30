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
