# language: es
Caracteristica: Matching automatico oferta-demanda con notificacion y busqueda regional
  Como sistema automatizado de AGRORED
  Quiero analizar las demandas abiertas cuando un productor publica una oferta
  Para sugerir abastecimiento a comedores comunitarios y programas PAE
  Y si no hay necesidades en el municipio local, buscar en otros municipios

  Escenario: Oferta publicada coincide con demanda local de un comedor comunitario
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe un productor asociado al municipio
    Y existe una demanda abierta en "MUNICIPIO_PILOTO" del canal "community_kitchen" para "Tomate chonto" categoria "Hortalizas"
    Cuando publico una oferta con producto "Tomate chonto" categoria "Hortalizas" cantidad 200 unidad "kg"
    Entonces el sistema responde con codigo 201
    Y la respuesta incluye seccion "matching" con searchScope "local"
    Y la respuesta incluye al menos 1 coincidencia
    Y se genera una notificacion de sugerencia para el comedor comunitario

  Escenario: Oferta publicada coincide con demanda local del programa PAE
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe un productor asociado al municipio
    Y existe una demanda abierta en "MUNICIPIO_PILOTO" del canal "school_program" para "Platano harton" categoria "Frutas"
    Cuando publico una oferta con producto "Platano harton" categoria "Frutas" cantidad 80 unidad "racimo"
    Entonces el sistema responde con codigo 201
    Y la respuesta incluye seccion "matching" con searchScope "local"
    Y la respuesta incluye al menos 1 coincidencia
    Y se genera una notificacion de sugerencia para el programa PAE

  Escenario: No hay demandas locales pero si en otro municipio — busqueda regional
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe un productor asociado al municipio
    Y no existen demandas abiertas en "MUNICIPIO_PILOTO" para la categoria "Hortalizas"
    Pero existe una demanda abierta en "MUNICIPIO_VECINO" del canal "community_kitchen" para "Tomate chonto" categoria "Hortalizas"
    Cuando publico una oferta con producto "Tomate chonto" categoria "Hortalizas" cantidad 200 unidad "kg"
    Entonces el sistema responde con codigo 201
    Y la respuesta incluye seccion "matching" con searchScope "regional"
    Y la respuesta incluye al menos 1 coincidencia de "MUNICIPIO_VECINO"
    Y la notificacion indica que la oferta proviene de otro municipio

  Escenario: Oferta sin demandas compatibles ni local ni regionalmente
    Dado que existe el municipio "MUNICIPIO_PILOTO"
    Y existe un productor asociado al municipio
    Y no existen demandas abiertas para la categoria "Especias" en ningun municipio
    Cuando publico una oferta con producto "Azafran" categoria "Especias" cantidad 5 unidad "g"
    Entonces el sistema responde con codigo 201
    Y la seccion "matching" indica searchScope "regional" y 0 coincidencias
    Y no se generan notificaciones
