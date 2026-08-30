migrate((app) => {
  const messages = app.findCollectionByNameOrId("sinprisa_commission_messages")
  const staffRule = '@request.auth.role = "owner" || @request.auth.role = "editor"'
  messages.listRule = staffRule
  messages.viewRule = staffRule
  messages.createRule = staffRule
  messages.updateRule = staffRule
  messages.deleteRule = staffRule
  app.save(messages)
}, (app) => {
  const messages = app.findCollectionByNameOrId("sinprisa_commission_messages")
  messages.listRule = null
  messages.viewRule = null
  messages.createRule = null
  messages.updateRule = null
  messages.deleteRule = null
  app.save(messages)
})
