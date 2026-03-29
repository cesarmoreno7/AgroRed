Feature: Publicar subasta de excedente agrícola
  Como productor rural registrado en AGRORED
  Quiero publicar una subasta de mi excedente agrícola
  Para liquidar mi cosecha perecedera rápidamente

  Background:
    Given el municipio "MUNICIPIO_PILOTO" existe como tenant activo
    And un productor registrado con coordenadas GPS válidas

  Scenario: Publicar subasta ascendente (Tipo A) exitosamente
    When publico una subasta con los siguientes datos:
      | campo           | valor              |
      | productName     | Tomate chonto      |
      | category        | hortaliza          |
      | unit            | kg                 |
      | quantityKg      | 500                |
      | harvestDate     | hace 2 horas       |
      | auctionType     | ascending          |
      | basePrice       | 450000             |
      | reservePrice    | 300000             |
      | durationMinutes | 480                |
    Then la respuesta tiene código 201
    And la subasta tiene estado "active"
    And la vida útil calculada es 48 horas para tomate
    And la fase de visibilidad inicial es "phase_1" con radio 50 km

  Scenario: Publicar subasta holandesa (Tipo B) en modo urgencia
    When publico una subasta con los siguientes datos:
      | campo              | valor       |
      | productName        | Lechuga     |
      | auctionType        | dutch       |
      | durationMinutes    | 180         |
      | dutchStepPercent   | 5           |
      | dutchStepMinutes   | 10          |
    Then la respuesta tiene código 201
    And la subasta tiene estado "active"
    And la fase de visibilidad es "urgent" con radio 150 km

  Scenario: Rechazar subasta con duración fuera de rango
    When publico una subasta con durationMinutes 60
    Then la respuesta tiene código 400
    And el código de error es "INVALID_AUCTION_PAYLOAD"

  Scenario: Rechazar subasta con precio base negativo
    When publico una subasta con basePrice -100
    Then la respuesta tiene código 400
