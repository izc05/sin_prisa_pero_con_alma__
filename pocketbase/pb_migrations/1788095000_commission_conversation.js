migrate((app) => {
  try {
    app.findCollectionByNameOrId("sinprisa_commission_messages")
    return
  } catch (_) {}
  const accounts = app.findCollectionByNameOrId("sinprisa_customer_accounts")
  const commissions = app.findCollectionByNameOrId("sinprisa_commissions")
  const messages = new Collection({
    type: "base",
    name: "sinprisa_commission_messages",
    fields: [
      new RelationField({ name: "commission", required: true, maxSelect: 1, collectionId: commissions.id, cascadeDelete: true }),
      new RelationField({ name: "account", required: true, maxSelect: 1, collectionId: accounts.id, cascadeDelete: true }),
      new TextField({ name: "author", required: true, max: 16 }),
      new TextField({ name: "body", required: true, max: 4000 }),
      new TextField({ name: "sent_at", required: true, max: 40 }),
    ],
  })
  app.save(messages)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("sinprisa_commission_messages")) } catch (_) {}
})
