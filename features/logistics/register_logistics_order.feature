# language: es
Caracteristica: Registro logistico de entregas
  Como operador logistico del ecosistema AGRORED
  Quiero programar una entrega con inventario trazable
  Para cumplir la demanda institucional del municipio

  Escenario: Registrar una entrega programada para un comedor comunitario
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe un lote de inventario disponible
    Cuando registro una operacion logistica para la demanda institucional
    Entonces el sistema responde con codigo 201
    Y la entrega queda en estado "scheduled"