migrate((app) => {
  try { app.findCollectionByNameOrId("sinprisa_commission_events"); return } catch (_) {}
  const accounts = app.findCollectionByNameOrId("sinprisa_customer_accounts")
  const commissions = app.findCollectionByNameOrId("sinprisa_commissions")
  const events = new Collection({
    type: "base",
    name: "sinprisa_commission_events",
    listRule: '@request.auth.role = "owner" || @request.auth.role = "editor"',
    viewRule: '@request.auth.role = "owner" || @request.auth.role = "editor"',
    createRule: '@request.auth.role = "owner" || @request.auth.role = "editor"',
    updateRule: null,
    deleteRule: '@request.auth.role = "owner" || @request.auth.role = "editor"',
    fields: [
      new RelationField({ name: "commission", required: true, maxSelect: 1, collectionId: commissions.id, cascadeDelete: true }),
      new RelationField({ name: "account", required: true, maxSelect: 1, collectionId: accounts.id, cascadeDelete: true }),
      new TextField({ name: "status", required: true, max: 32 }),
      new TextField({ name: "created_at", required: true, max: 40 })
    ]
  })
  app.save(events)
}, (app) => { try { app.delete(app.findCollectionByNameOrId("sinprisa_commission_events")) } catch (_) {} })
