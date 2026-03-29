-- ============================================================
-- DATOS: Comedores y relaciones (encoding fix)
-- ============================================================

-- Comedores: Medellin
INSERT INTO comedor (nombre, tipo, direccion, capacidad_diaria, beneficiarios_actuales, horario_atencion, responsable, telefono, municipio_id, comuna_id, zona_id, estado, geom)
VALUES
  ('Comedor Comunitario Barrio Centro', 'comunitario', 'Cra 45 # 52-10, Barrio Centro, Medellin', 150, 120,
   'Lunes a Viernes 11:00-14:00', 'Martha Echavarria', '3041112233', 1, 1, 1, 'activo',
   ST_SetSRID(ST_MakePoint(-75.5680, 6.2510), 4326)),

  ('Comedor Escolar IE San Jose', 'escolar', 'Calle 50 # 40-30, Medellin', 200, 180,
   'Lunes a Viernes 10:00-12:00', 'Rector: Juan Alvarez', '3042223344', 1, 1, 2, 'activo',
   ST_SetSRID(ST_MakePoint(-75.5730, 6.2450), 4326)),

  ('Comedor Comunitario La Esperanza', 'comunitario', 'Cra 65 # 48-20, Medellin', 100, 85,
   'Lunes a Sabado 12:00-14:00', 'Gloria Munoz', '3043334455', 1, 2, 3, 'activo',
   ST_SetSRID(ST_MakePoint(-75.5800, 6.2370), 4326)),

  ('Comedor Escolar IE Simon Bolivar', 'escolar', 'Calle 70 # 55-15, Medellin', 300, 270,
   'Lunes a Viernes 9:30-11:30', 'Rectora: Patricia Mejia', '3044445566', 1, 3, 5, 'activo',
   ST_SetSRID(ST_MakePoint(-75.5470, 6.2630), 4326)),

-- Cali
  ('Comedor Comunitario Aguablanca', 'comunitario', 'Cra 28 # 72-50, Distrito Aguablanca, Cali', 200, 175,
   'Lunes a Viernes 11:30-13:30', 'Sandra Mosquera', '3145556677', 4, 9, NULL, 'activo',
   ST_SetSRID(ST_MakePoint(-76.5100, 3.4300), 4326)),

  ('Comedor Escolar IE Jorge Isaacs', 'escolar', 'Calle 15 # 25-40, Cali', 250, 220,
   'Lunes a Viernes 10:00-12:00', 'Rector: Alvaro Diaz', '3146667788', 4, 10, NULL, 'activo',
   ST_SetSRID(ST_MakePoint(-76.5300, 3.4400), 4326)),

-- Bogota
  ('Comedor Comunitario Kennedy', 'comunitario', 'Cra 80 # 40-20, Kennedy, Bogota', 300, 260,
   'Lunes a Viernes 11:00-14:00', 'Esperanza Garzon', '3197778899', 7, 12, NULL, 'activo',
   ST_SetSRID(ST_MakePoint(-74.1500, 4.6280), 4326)),

  ('Comedor Escolar IE Usme Alto', 'escolar', 'Calle 90 Sur # 14-50, Usme, Bogota', 180, 150,
   'Lunes a Viernes 9:00-11:00', 'Rector: Fernando Torres', '3198889900', 7, 13, NULL, 'activo',
   ST_SetSRID(ST_MakePoint(-74.1100, 4.4750), 4326)),

-- Bucaramanga
  ('Comedor Comunitario Norte Bucaramanga', 'comunitario', 'Cra 20 # 55-12, Bucaramanga', 120, 95,
   'Lunes a Viernes 12:00-14:00', 'Ricardo Parra', '3171112233', 10, 15, NULL, 'activo',
   ST_SetSRID(ST_MakePoint(-73.1198, 7.1254), 4326));

-- Ofertas geolocalizadas
DO $$
DECLARE
  v_prod1 UUID;
  v_prod2 UUID;
  v_prod3 UUID;
  v_tenant UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  SELECT id INTO v_prod1 FROM producers WHERE organization_name = 'Finca El Naranjo' LIMIT 1;
  SELECT id INTO v_prod2 FROM producers WHERE organization_name = 'Cooperativa AgroVerde' LIMIT 1;
  SELECT id INTO v_prod3 FROM producers WHERE organization_name = 'Finca Valle Fertil' LIMIT 1;

  IF v_prod3 IS NULL THEN
    SELECT id INTO v_prod3 FROM producers WHERE organization_name LIKE 'Finca Valle%' LIMIT 1;
  END IF;

  INSERT INTO offers (tenant_id, producer_id, title, product_name, category, unit, quantity_available, price_amount, currency, available_from, available_until, municipality_name, status, punto_entrega, geom)
  VALUES
    (v_tenant, v_prod1, 'Naranjas frescas de finca', 'Naranja Valencia', 'frutas', 'kg', 500, 2500, 'COP',
     NOW(), NOW() + INTERVAL '30 days', 'Medellin', 'published', 'Entrega en finca o plaza minorista',
     ST_SetSRID(ST_MakePoint(-75.5636, 6.2518), 4326)),

    (v_tenant, v_prod1, 'Tomates organicos', 'Tomate Chonto', 'hortalizas', 'kg', 200, 3800, 'COP',
     NOW(), NOW() + INTERVAL '15 days', 'Medellin', 'published', 'Entrega en finca',
     ST_SetSRID(ST_MakePoint(-75.5636, 6.2518), 4326)),

    (v_tenant, v_prod2, 'Leche fresca diaria', 'Leche entera', 'lacteos', 'litro', 100, 2800, 'COP',
     NOW(), NOW() + INTERVAL '7 days', 'Medellin', 'published', 'Entrega a domicilio en zona periurbana',
     ST_SetSRID(ST_MakePoint(-75.5810, 6.2350), 4326)),

    (v_tenant, v_prod2, 'Huevos de gallina feliz', 'Huevos campesinos', 'huevos', 'unidad_30', 50, 15000, 'COP',
     NOW(), NOW() + INTERVAL '10 days', 'Medellin', 'published', 'Recogida en cooperativa',
     ST_SetSRID(ST_MakePoint(-75.5810, 6.2350), 4326));

  IF v_prod3 IS NOT NULL THEN
    INSERT INTO offers (tenant_id, producer_id, title, product_name, category, unit, quantity_available, price_amount, currency, available_from, available_until, municipality_name, status, punto_entrega, geom)
    VALUES
      (v_tenant, v_prod3, 'Platano harton del Valle', 'Platano Harton', 'frutas', 'racimo', 300, 5000, 'COP',
       NOW(), NOW() + INTERVAL '20 days', 'Cali', 'published', 'Plaza de mercado Santa Elena',
       ST_SetSRID(ST_MakePoint(-76.5280, 3.4500), 4326));
  END IF;
END $$;

-- Relaciones comedor-productor
DO $$
DECLARE
  v_com1 INT;
  v_com2 INT;
  v_com3 INT;
  v_prod1 UUID;
  v_prod2 UUID;
  v_prod3 UUID;
  v_prod5 UUID;
BEGIN
  SELECT id INTO v_com1 FROM comedor WHERE nombre = 'Comedor Comunitario Barrio Centro' LIMIT 1;
  SELECT id INTO v_com2 FROM comedor WHERE nombre = 'Comedor Escolar IE San Jose' LIMIT 1;
  SELECT id INTO v_com3 FROM comedor WHERE nombre = 'Comedor Comunitario La Esperanza' LIMIT 1;

  SELECT id INTO v_prod1 FROM producers WHERE organization_name = 'Finca El Naranjo' LIMIT 1;
  SELECT id INTO v_prod2 FROM producers WHERE organization_name = 'Finca La Esperanza' LIMIT 1;
  SELECT id INTO v_prod3 FROM producers WHERE organization_name = 'Cooperativa AgroVerde' LIMIT 1;
  SELECT id INTO v_prod5 FROM producers WHERE organization_name = 'Huerta Dona Rosa' LIMIT 1;
  IF v_prod5 IS NULL THEN
    SELECT id INTO v_prod5 FROM producers WHERE organization_name LIKE 'Huerta Do%' LIMIT 1;
  END IF;

  IF v_com1 IS NOT NULL AND v_prod1 IS NOT NULL THEN
    INSERT INTO comedor_productor (comedor_id, producer_id, producto, frecuencia)
    VALUES
      (v_com1, v_prod1, 'Naranjas y tomates', 'semanal'),
      (v_com1, v_prod3, 'Leche y huevos', 'diaria');
    IF v_prod5 IS NOT NULL THEN
      INSERT INTO comedor_productor (comedor_id, producer_id, producto, frecuencia)
      VALUES (v_com1, v_prod5, 'Hortalizas y aromaticas', 'semanal');
    END IF;
  END IF;

  IF v_com2 IS NOT NULL THEN
    INSERT INTO comedor_productor (comedor_id, producer_id, producto, frecuencia)
    VALUES
      (v_com2, v_prod2, 'Hortalizas variadas', 'semanal'),
      (v_com2, v_prod3, 'Leche y huevos', 'diaria');
  END IF;

  IF v_com3 IS NOT NULL THEN
    INSERT INTO comedor_productor (comedor_id, producer_id, producto, frecuencia)
    VALUES
      (v_com3, v_prod3, 'Leche, huevos y frutas', 'diaria'),
      (v_com3, v_prod1, 'Frutas de temporada', 'quincenal');
  END IF;
END $$;
