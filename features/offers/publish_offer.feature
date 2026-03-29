# language: es
Caracteristica: Publicacion de oferta alimentaria
  Como productor rural registrado
  Quiero publicar una oferta disponible para mi municipio
  Para visibilizar productos y cantidades disponibles en el territorio

  Escenario: Publicar una oferta activa para un productor existente
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe un productor asociado al municipio
    Cuando publico una oferta con producto "Tomate chonto"
    Entonces el sistema responde con codigo 201
    Y la oferta queda en estado "published"
