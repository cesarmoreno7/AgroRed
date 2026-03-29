# language: es
Caracteristica: Registro de rescate alimentario
  Como operador del ecosistema AGRORED
  Quiero registrar un rescate de excedentes alimentarios
  Para redistribuir alimentos recuperados a organizaciones del municipio

  Escenario: Registrar un rescate programado asociado a un productor
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe un productor con excedente disponible
    Cuando registro un rescate para la organizacion "Banco de Alimentos Municipal"
    Entonces el sistema responde con codigo 201
    Y el rescate queda en estado "scheduled"