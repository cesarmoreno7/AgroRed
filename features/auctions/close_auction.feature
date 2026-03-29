Feature: Cerrar subasta y determinar ganador
  Como sistema automatizado de AGRORED
  Quiero cerrar subastas expiradas y aplicar Smart Match
  Para determinar al ganador de forma justa

  Background:
    Given una subasta activa que ha expirado

  Scenario: Cerrar subasta con ganador único
    Given hay 3 pujas y la más alta es de "operador_1" por 550000
    When el scheduler cierra la subasta
    Then la subasta tiene estado "closed_with_winner"
    And el ganador es "operador_1" con precio 550000

  Scenario: Resolver empate con Smart Match
    Given hay 2 pujas del mismo monto 500000
    And "comprador_pae" tiene puntaje social 100 y está a 30 km
    And "comprador_comercio" tiene puntaje social 10 y está a 100 km
    When el scheduler cierra la subasta
    Then el ganador es "comprador_pae" gracias al Smart Match
    And el puntaje de cercanía y social favorecen al PAE

  Scenario: Cerrar subasta sin pujas
    Given no hay pujas registradas
    When el scheduler cierra la subasta
    Then la subasta tiene estado "closed_no_winner"
    And se notifica al gestor territorial del municipio

  Scenario: Cerrar subasta con puja debajo del precio de reserva
    Given la puja más alta es 200000 pero el precio de reserva es 300000
    When el scheduler cierra la subasta
    Then la subasta tiene estado "closed_no_winner"
