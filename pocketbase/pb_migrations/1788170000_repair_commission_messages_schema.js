migrate((app) => {
  const messages = app.findCollectionByNameOrId("sinprisa_commission_messages")
  const accounts = app.findCollectionByNameOrId("sinprisa_customer_accounts")
  const commissions = app.findCollectionByNameOrId("sinprisa_commissions")

  if (!messages.fields.getByName("commission")) {
    messages.fields.add(new RelationField({ name: "commission", required: true, maxSelect: 1, collectionId: commissions.id, cascadeDelete: true }))
  }
  if (!messages.fields.getByName("account")) {
    messages.fields.add(new RelationField({ name: "account", required: true, maxSelect: 1, collectionId: accounts.id, cascadeDelete: true }))
  }
  if (!messages.fields.getByName("author")) {
    messages.fields.add(new TextField({ name: "author", required: true, max: 16 }))
  }
  if (!messages.fields.getByName("body")) {
    messages.fields.add(new TextField({ name: "body", required: true, max: 4000 }))
  }
  if (!messages.fields.getByName("sent_at")) {
    messages.fields.add(new TextField({ name: "sent_at", required: true, max: 40 }))
  }
  app.save(messages)
}, (app) => {
  const messages = app.findCollectionByNameOrId("sinprisa_commission_messages")
  for (const field of ["sent_at", "body", "author", "account", "commission"]) {
    try { messages.fields.removeByName(field) } catch (_) {}
  }
  app.save(messages)
})
