migrate((app) => {
  const accounts = app.findCollectionByNameOrId("sinprisa_customer_accounts")
  const fields = [
    ["phone", 32],
    ["address_line1", 160],
    ["address_line2", 160],
    ["postal_code", 16],
    ["city", 120],
    ["province", 120],
    ["country", 80],
  ]
  for (const [name, max] of fields) {
    if (!accounts.fields.getByName(name)) accounts.fields.add(new TextField({ name, required: false, max }))
  }
  app.save(accounts)
}, (app) => {
  const accounts = app.findCollectionByNameOrId("sinprisa_customer_accounts")
  for (const name of ["country", "province", "city", "postal_code", "address_line2", "address_line1", "phone"]) {
    if (accounts.fields.getByName(name)) accounts.fields.removeByName(name)
  }
  app.save(accounts)
})
