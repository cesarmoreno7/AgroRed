-- ============================================================
-- DATOS DE EJEMPLO: Productores geolocalizados y Comedores
-- ============================================================

-- 1. PRODUCTORES con geolocalización (actualizar existentes o insertar nuevos)
-- Medellín y zona rural de Antioquia
INSERT INTO producers (tenant_id, producer_type, organization_name, contact_name, contact_phone, municipality_name, zone_type, product_categories, status, geom, municipio_id, comuna_id, zona_id)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'individual', 'Finca El Naranjo', 'Carlos Herrera', '3101234567', 'Medellín', 'rural', ARRAY['frutas','hortalizas'], 'active',
   ST_SetSRID(ST_MakePoint(-75.5636, 6.2518), 4326), 1, 1, 1),

  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'individual', 'Finca La Esperanza', 'María López', '3109876543', 'Medellín', 'rural', ARRAY['hortalizas','granos'], 'active',
   ST_SetSRID(ST_MakePoint(-75.5742, 6.2430), 4326), 1, 1, 2),

  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'cooperative', 'Cooperativa AgroVerde', 'Pedro Gómez', '3205551234', 'Medellín', 'periurbana', ARRAY['frutas','lacteos','huevos'], 'active',
   ST_SetSRID(ST_MakePoint(-75.5810, 6.2350), 4326), 1, 2, 3),

  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'association', 'Asociación Campesina del Oriente', 'Ana Restrepo', '3118887766', 'Medellín', 'rural', ARRAY['cafe','panela','frutas'], 'active',
   ST_SetSRID(ST_MakePoint(-75.5450, 6.2650), 4326), 1, 3, 5),

  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'individual', 'Huerta Doña Rosa', 'Rosa Martínez', '3156667788', 'Medellín', 'urbana', ARRAY['hortalizas','aromáticas'], 'active',
   ST_SetSRID(ST_MakePoint(-75.5695, 6.2480), 4326), 1, 1, 1),

-- Cali
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'individual', 'Finca Valle Fértil', 'Jorge Valencia', '3161112233', 'Cali', 'rural', ARRAY['frutas','hortalizas','plátano'], 'active',
   ST_SetSRID(ST_MakePoint(-76.5225, 3.4516), 4326), 4, 9, NULL),

  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'cooperative', 'CoopAgro Pacífico', 'Luisa Caicedo', '3177778899', 'Cali', 'periurbana', ARRAY['frutas','verduras','raíces'], 'active',
   ST_SetSRID(ST_MakePoint(-76.5320, 3.4380), 4326), 4, 10, NULL),

-- Bogotá
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'individual', 'Granja Sabana Verde', 'Andrés Rodríguez', '3189990011', 'Bogotá', 'rural', ARRAY['hortalizas','papa','zanahoria'], 'active',
   ST_SetSRID(ST_MakePoint(-74.0721, 4.7110), 4326), 7, 12, NULL),

  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'association', 'Asocampo Usme', 'Claudia Pineda', '3192223344', 'Bogotá', 'periurbana', ARRAY['papa','arveja','habas','fresa'], 'active',
   ST_SetSRID(ST_MakePoint(-74.1050, 4.4800), 4326), 7, 13, NULL);

-- 2. COMEDORES COMUNITARIOS Y ESCOLARES
-- Medellín
INSERT INTO comedor (nombre, tipo, direccion, capacidad_diaria, beneficiarios_actuales, horario_atencion, responsable, telefono, municipio_id, comuna_id, zona_id, estado, geom)
VALUES
  ('Comedor Comunitario Barrio Centro', 'comunitario', 'Cra 45 # 52-10, Barrio Centro, Medellín', 150, 120,
   'Lunes a Viernes 11:00-14:00', 'Martha Echavarría', '3041112233', 1, 1, 1, 'activo',
   ST_SetSRID(ST_MakePoint(-75.5680, 6.2510), 4326)),

  ('Comedor Escolar IE San José', 'escolar', 'Calle 50 # 40-30, Medellín', 200, 180,
   'Lunes a Viernes 10:00-12:00', 'Rector: Juan Álvarez', '3042223344', 1, 1, 2, 'activo',
   ST_SetSRID(ST_MakePoint(-75.5730, 6.2450), 4326)),

  ('Comedor Comunitario La Esperanza', 'comunitario', 'Cra 65 # 48-20, Medellín', 100, 85,
   'Lunes a Sábado 12:00-14:00', 'Gloria Muñoz', '3043334455', 1, 2, 3, 'activo',
   ST_SetSRID(ST_MakePoint(-75.5800, 6.2370), 4326)),

  ('Comedor Escolar IE Simón Bolívar', 'escolar', 'Calle 70 # 55-15, Medellín', 300, 270,
   'Lunes a Viernes 9:30-11:30', 'Rectora: Patricia Mejía', '3044445566', 1, 3, 5, 'activo',
   ST_SetSRID(ST_MakePoint(-75.5470, 6.2630), 4326)),

-- Cali
  ('Comedor Comunitario Aguablanca', 'comunitario', 'Cra 28 # 72-50, Distrito Aguablanca, Cali', 200, 175,
   'Lunes a Viernes 11:30-13:30', 'Sandra Mosquera', '3145556677', 4, 9, NULL, 'activo',
   ST_SetSRID(ST_MakePoint(-76.5100, 3.4300), 4326)),

  ('Comedor Escolar IE Jorge Isaacs', 'escolar', 'Calle 15 # 25-40, Cali', 250, 220,
   'Lunes a Viernes 10:00-12:00', 'Rector: Álvaro Díaz', '3146667788', 4, 10, NULL, 'activo',
   ST_SetSRID(ST_MakePoint(-76.5300, 3.4400), 4326)),

-- Bogotá
  ('Comedor Comunitario Kennedy', 'comunitario', 'Cra 80 # 40-20, Kennedy, Bogotá', 300, 260,
   'Lunes a Viernes 11:00-14:00', 'Esperanza Garzón', '3197778899', 7, 12, NULL, 'activo',
   ST_SetSRID(ST_MakePoint(-74.1500, 4.6280), 4326)),

  ('Comedor Escolar IE Usme Alto', 'escolar', 'Calle 90 Sur # 14-50, Usme, Bogotá', 180, 150,
   'Lunes a Viernes 9:00-11:00', 'Rector: Fernando Torres', '3198889900', 7, 13, NULL, 'activo',
   ST_SetSRID(ST_MakePoint(-74.1100, 4.4750), 4326)),

-- Bucaramanga
  ('Comedor Comunitario Norte Bucaramanga', 'comunitario', 'Cra 20 # 55-12, Bucaramanga', 120, 95,
   'Lunes a Viernes 12:00-14:00', 'Ricardo Parra', '3171112233', 10, 15, NULL, 'activo',
   ST_SetSRID(ST_MakePoint(-73.1198, 7.1254), 4326));

-- 3. OFERTAS con geolocalización (de los productores recién insertados)
-- Obtenemos IDs de productores para crear ofertas
DO $$
DECLARE
  v_prod1 UUID;
  v_prod2 UUID;
  v_prod3 UUID;
  v_tenant UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  SELECT id INTO v_prod1 FROM producers WHERE organization_name = 'Finca El Naranjo' LIMIT 1;
  SELECT id INTO v_prod2 FROM producers WHERE organization_name = 'Cooperativa AgroVerde' LIMIT 1;
  SELECT id INTO v_prod3 FROM producers WHERE organization_name = 'Finca Valle Fértil' LIMIT 1;

  INSERT INTO offers (tenant_id, producer_id, title, product_name, category, unit, quantity_available, price_amount, currency, available_from, available_until, municipality_name, status, punto_entrega, geom)
  VALUES
    (v_tenant, v_prod1, 'Naranjas frescas de finca', 'Naranja Valencia', 'frutas', 'kg', 500, 2500, 'COP',
     NOW(), NOW() + INTERVAL '30 days', 'Medellín', 'published', 'Entrega en finca o plaza minorista',
     ST_SetSRID(ST_MakePoint(-75.5636, 6.2518), 4326)),

    (v_tenant, v_prod1, 'Tomates orgánicos', 'Tomate Chonto', 'hortalizas', 'kg', 200, 3800, 'COP',
     NOW(), NOW() + INTERVAL '15 days', 'Medellín', 'published', 'Entrega en finca',
     ST_SetSRID(ST_MakePoint(-75.5636, 6.2518), 4326)),

    (v_tenant, v_prod2, 'Leche fresca diaria', 'Leche entera', 'lacteos', 'litro', 100, 2800, 'COP',
     NOW(), NOW() + INTERVAL '7 days', 'Medellín', 'published', 'Entrega a domicilio en zona periurbana',
     ST_SetSRID(ST_MakePoint(-75.5810, 6.2350), 4326)),

    (v_tenant, v_prod2, 'Huevos de gallina feliz', 'Huevos campesinos', 'huevos', 'unidad_30', 50, 15000, 'COP',
     NOW(), NOW() + INTERVAL '10 days', 'Medellín', 'published', 'Recogida en cooperativa',
     ST_SetSRID(ST_MakePoint(-75.5810, 6.2350), 4326)),

    (v_tenant, v_prod3, 'Plátano hartón del Valle', 'Plátano Hartón', 'frutas', 'racimo', 300, 5000, 'COP',
     NOW(), NOW() + INTERVAL '20 days', 'Cali', 'published', 'Plaza de mercado Santa Elena',
     ST_SetSRID(ST_MakePoint(-76.5280, 3.4500), 4326));
END $$;

-- 4. RELACIONES COMEDOR-PRODUCTOR (abastecimiento)
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
  SELECT id INTO v_com2 FROM comedor WHERE nombre = 'Comedor Escolar IE San José' LIMIT 1;
  SELECT id INTO v_com3 FROM comedor WHERE nombre = 'Comedor Comunitario La Esperanza' LIMIT 1;

  SELECT id INTO v_prod1 FROM producers WHERE organization_name = 'Finca El Naranjo' LIMIT 1;
  SELECT id INTO v_prod2 FROM producers WHERE organization_name = 'Finca La Esperanza' LIMIT 1;
  SELECT id INTO v_prod3 FROM producers WHERE organization_name = 'Cooperativa AgroVerde' LIMIT 1;
  SELECT id INTO v_prod5 FROM producers WHERE organization_name = 'Huerta Doña Rosa' LIMIT 1;

  INSERT INTO comedor_productor (comedor_id, producer_id, producto, frecuencia)
  VALUES
    (v_com1, v_prod1, 'Naranjas y tomates', 'semanal'),
    (v_com1, v_prod3, 'Leche y huevos', 'diaria'),
    (v_com1, v_prod5, 'Hortalizas y aromáticas', 'semanal'),
    (v_com2, v_prod2, 'Hortalizas variadas', 'semanal'),
    (v_com2, v_prod3, 'Leche y huevos', 'diaria'),
    (v_com3, v_prod3, 'Leche, huevos y frutas', 'diaria'),
    (v_com3, v_prod1, 'Frutas de temporada', 'quincenal');
END $$;
