migrate((app) => {
  const commissions = app.findCollectionByNameOrId("sinprisa_commissions")
  if (!commissions.fields.getByName("customer_reply")) {
    commissions.fields.add(new TextField({
      name: "customer_reply",
      max: 4000,
      help: "Respuesta visible para la clienta en su ficha privada.",
    }))
    app.save(commissions)
  }
}, (app) => {
  const commissions = app.findCollectionByNameOrId("sinprisa_commissions")
  if (commissions.fields.getByName("customer_reply")) {
    commissions.fields.removeByName("customer_reply")
    app.save(commissions)
  }
})
