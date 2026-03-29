# language: es
Caracteristica: Registro de notificaciones operativas
  Como operador del ecosistema AGRORED
  Quiero registrar una alerta operativa persistida
  Para notificar a los actores sobre incidentes y entregas relevantes

  Escenario: Registrar una notificacion vinculada a una incidencia de ruta
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe una incidencia abierta asociada a la entrega
    Cuando registro una notificacion por canal "whatsapp"
    Entonces el sistema responde con codigo 201
    Y la notificacion queda en estado "pending"