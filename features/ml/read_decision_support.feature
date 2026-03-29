Feature: consulta de apoyo a decision territorial
  Como equipo coordinador del municipio piloto
  Quiero consultar un resumen heuristico del estado operativo
  Para priorizar acciones sobre abastecimiento, logistica e incidencias

  Scenario: obtener apoyo a decision y recomendaciones del municipio piloto
    Given existe el tenant "MUNICIPIO_PILOTO"
    And existen ofertas, demandas, inventario, logistica, incidencias y notificaciones persistidas
    When consulto GET /api/v1/ml/decision-support?tenantId=MUNICIPIO_PILOTO
    Then recibo un reporte con clasificacion, puntajes e insumos operativos
    When consulto GET /api/v1/ml/recommendations?tenantId=MUNICIPIO_PILOTO
    Then recibo recomendaciones heuristicas priorizadas para el territorio