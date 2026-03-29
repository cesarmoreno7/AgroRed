Feature: ejecutar corridas de automatizacion operativa
  Como coordinador territorial del municipio piloto
  Quiero generar una corrida automatizada a partir del estado operativo actual
  Para dejar acciones priorizadas y trazables sobre abastecimiento, incidencias y logistica

  Scenario: ejecutar una corrida de respuesta a incidencia
    Given existe el tenant "MUNICIPIO_PILOTO"
    And existe una incidencia abierta y una operacion logistica vinculada
    When consulto POST /api/v1/automation/execute con trigger "incident_response"
    Then recibo una corrida persistida con clasificacion, snapshot metrico y acciones priorizadas