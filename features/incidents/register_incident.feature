# language: es
Caracteristica: Registro de incidencias territoriales
  Como operador territorial del ecosistema AGRORED
  Quiero registrar una incidencia operativa o georreferenciada
  Para reaccionar a novedades que afectan las entregas y el abastecimiento

  Escenario: Registrar una novedad de ruta asociada a una entrega programada
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe una operacion logistica programada
    Cuando registro una incidencia de retraso en ruta
    Entonces el sistema responde con codigo 201
    Y la incidencia queda en estado "open"