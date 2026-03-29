Feature: Pujar en subasta ascendente
  Como comprador u operador institucional
  Quiero pujar en una subasta activa
  Para adquirir excedentes agrícolas perecederos

  Background:
    Given una subasta activa tipo "ascending" con precio base 400000

  Scenario: Registrar puja exitosa
    When el comprador "operador_1" puja 420000
    Then la respuesta tiene código 201
    And la puja tiene estado "active"
    And el precio actual de la subasta se actualiza a 420000

  Scenario: Activar Anti-Sniping por puja en último minuto
    Given la subasta tiene menos de 1 minuto restante
    When el comprador "operador_1" puja 450000
    Then la respuesta tiene código 201
    And el campo "antiSnipingTriggered" es true
    And el tiempo de cierre se extiende 3 minutos

  Scenario: Proxy Bidding automático
    Given el comprador "comedor_1" configuró Proxy Bid con máximo 600000
    When un nuevo comprador puja 500000
    Then el sistema genera una puja automática del proxy bidder
    And el campo "proxyBidsTriggered" es mayor que 0

  Scenario: Rechazar puja menor que la actual
    Given la puja más alta actual es 420000
    When el comprador "operador_2" puja 400000
    Then la respuesta tiene código 400
    And el código de error es "BID_TOO_LOW"

  Scenario: Rechazar puja del productor en su propia subasta
    When el productor dueño de la subasta puja 500000
    Then la respuesta tiene código 403
    And el código de error es "PRODUCER_CANNOT_BID"
