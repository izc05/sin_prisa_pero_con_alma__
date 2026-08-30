migrate((app) => {
  let accounts
  try {
    accounts = app.findCollectionByNameOrId("sinprisa_customer_accounts")
  } catch (_) {
    accounts = new Collection({
      type: "auth",
      name: "sinprisa_customer_accounts",
      listRule: "id = @request.auth.id",
      viewRule: "id = @request.auth.id",
      createRule: "",
      updateRule: "id = @request.auth.id",
      deleteRule: "id = @request.auth.id",
      fields: [
        { name: "name", type: "text", required: true, min: 2, max: 120 },
      ],
      passwordAuth: { enabled: true },
    })
    app.save(accounts)
  }

  const commissions = app.findCollectionByNameOrId("sinprisa_commissions")
  if (!commissions.fields.getByName("account")) {
    commissions.fields.add(new RelationField({
      name: "account",
      required: true,
      maxSelect: 1,
      collectionId: accounts.id,
      cascadeDelete: false,
    }))
  }
  if (!commissions.fields.getByName("reference_images")) {
    commissions.fields.add(new FileField({
      name: "reference_images",
      required: false,
      maxSelect: 4,
      maxSize: 4 * 1024 * 1024,
      mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      protected: true,
    }))
  }
  commissions.addIndex("idx_sinprisa_commissions_account", false, "account", "")
  app.save(commissions)
}, (app) => {
  const commissions = app.findCollectionByNameOrId("sinprisa_commissions")
  commissions.removeIndex("idx_sinprisa_commissions_account")
  commissions.fields.removeByName("reference_images")
  commissions.fields.removeByName("account")
  app.save(commissions)
  try { app.delete(app.findCollectionByNameOrId("sinprisa_customer_accounts")) } catch (_) {}
})

