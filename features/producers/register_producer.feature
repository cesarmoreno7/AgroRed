# language: es
Caracteristica: Registro de productores rurales
  Como administracion municipal
  Quiero registrar productores y asociaciones campesinas
  Para visibilizar la oferta alimentaria local

  Escenario: Registrar una asociacion productora para un municipio
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe un usuario responsable de tipo "producer"
    Cuando registro un productor con organizacion "Asociacion Campesina del Norte"
    Entonces el sistema responde con codigo 201
    Y el productor queda en estado "pending_verification"
