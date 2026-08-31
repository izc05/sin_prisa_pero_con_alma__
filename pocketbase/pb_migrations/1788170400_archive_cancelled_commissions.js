migrate((app) => {
  const commissions = app.findCollectionByNameOrId("sinprisa_commissions")
  if (!commissions.fields.getByName("conversation_archived_at")) {
    commissions.fields.add(new TextField({ name: "conversation_archived_at", required: false, max: 40 }))
    app.save(commissions)
  }
  for (const commission of app.findAllRecords("sinprisa_commissions")) {
    if (commission.getString("status") !== "cancelled" || commission.getString("conversation_archived_at")) continue
    commission.set("conversation_archived_at", commission.getString("updated") || new Date().toISOString())
    app.save(commission)
  }
}, (app) => {
  const commissions = app.findCollectionByNameOrId("sinprisa_commissions")
  if (commissions.fields.getByName("conversation_archived_at")) {
    commissions.fields.removeByName("conversation_archived_at")
    app.save(commissions)
  }
})
