# language: es
Caracteristica: Consulta de resumen analitico operativo
  Como analista territorial del ecosistema AGRORED
  Quiero consultar un resumen consolidado de la operacion
  Para observar el estado del abastecimiento y la respuesta territorial

  Escenario: Consultar el resumen del municipio piloto
    Dado que existe informacion operativa consolidada en el municipio "MUNICIPIO_PILOTO"
    Cuando consulto el resumen analitico del municipio
    Entonces el sistema responde con codigo 200
    Y retorna totales, indicadores operativos y panorama territorial