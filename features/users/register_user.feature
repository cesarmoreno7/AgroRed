# language: es
Caracteristica: Registro de usuarios del ecosistema
  Como administracion municipal
  Quiero registrar actores del sistema alimentario
  Para operar AGRORED con roles controlados

  Escenario: Registrar un productor rural como usuario del sistema
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Cuando registro un usuario con correo "productor@agrored.local" y rol "producer"
    Entonces el sistema responde con codigo 201
    Y el usuario queda disponible para los demas modulos del ecosistema
