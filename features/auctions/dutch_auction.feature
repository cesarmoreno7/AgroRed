Feature: Subasta Holandesa Acelerada (Tipo B)
  Como sistema de urgencia para excedentes con vida útil crítica
  Quiero ejecutar subastas con precio descendente
  Para liquidar lotes de forma inmediata

  Background:
    Given una subasta activa tipo "dutch" con precio base 800000
    And descenso de 5% cada 10 minutos
    And precio de reserva 400000

  Scenario: Aceptar precio actual en subasta holandesa
    Given han pasado 20 minutos (2 pasos de descenso)
    And el precio actual es aproximadamente 722000
    When el comprador "comedor_1" acepta el precio 722000
    Then la subasta se cierra con estado "closed_with_winner"
    And el ganador es "comedor_1"

  Scenario: Nadie acepta antes del precio mínimo
    Given el precio ha descendido hasta el precio de reserva 400000
    And ningún comprador ha aceptado
    When el scheduler detecta que se alcanzó el precio de reserva
    Then la subasta se cierra con estado "closed_no_winner"
    And se notifica al gestor territorial

  Scenario: Rechazar aceptación del productor en su propia subasta
    When el productor dueño intenta aceptar el precio
    Then la respuesta tiene código 403
