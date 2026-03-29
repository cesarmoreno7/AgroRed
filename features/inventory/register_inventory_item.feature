# language: es
Caracteristica: Registro de inventario operativo
  Como operador logistico del ecosistema AGRORED
  Quiero registrar un lote de inventario con trazabilidad
  Para controlar stock disponible y reservas operativas del municipio

  Escenario: Registrar inventario proveniente de un rescate alimentario
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe un rescate programado para el productor
    Cuando registro un lote operativo en bodega municipal
    Entonces el sistema responde con codigo 201
    Y el inventario queda en estado "available"