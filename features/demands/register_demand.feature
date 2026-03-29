# language: es
Caracteristica: Registro de demanda institucional
  Como operador de un programa alimentario
  Quiero registrar una demanda institucional del municipio
  Para solicitar abastecimiento alimentario oportuno

  Escenario: Registrar una demanda activa para un programa comunitario
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe un usuario responsable del programa
    Cuando registro una demanda con producto "Platano harton"
    Entonces el sistema responde con codigo 201
    Y la demanda queda en estado "open"
