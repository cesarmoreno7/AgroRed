-- ============================================================
-- CARGA INTEGRAL DE DATOS DE PRUEBA - AgroRed
-- Fecha: 2026-04-11
-- Propósito: Prueba integral de todos los procesos end-to-end
-- ============================================================
-- Orden de inserción respetando foreign keys:
--   1. tenants
--   2. users
--   3. producers
--   4. offers
--   5. demands
--   6. rescues
--   7. inventory_items
--   8. recursos
--   9. logistics_orders
--  10. incidents
--  11. incident_actions
--  12. incident_alerts
--  13. notifications
--  14. automation_runs
--  15. allocation_scenarios
--  16. food_programs
--  17. beneficiaries
--  18. program_deliveries
--  19. coordination_tasks
--  20. institutional_alerts
--  21. alert_thresholds
--  22. auctions
--  23. auction_bids
--  24. auction_audit_log
--  25. route_plans
--  26. route_stops
--  27. vrp_solutions
--  28. vrp_vehicle_routes
--  29. tracking_historial
--  30. tracking_actual
--  31. delivery_events
--  32. geofence_zones
--  33. geofence_events
--  34. spoilage_records
--  35. audit_log
--  36. irat_zonas
--  37. incidencias_sociales
--  38. beneficiarios_zona
--  39. productos_proximos_vencer
-- ============================================================

SET client_encoding TO 'UTF8';

BEGIN;

-- ============================================================
-- 1. TENANTS (3 municipios piloto)
-- ============================================================
INSERT INTO public.tenants (id, code, name, type, status, metadata) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'medellin',   'Municipio de Medellín',  'municipio', 'active', '{"poblacion": 2500000, "departamento": "Antioquia"}'),
  ('a0000000-0000-0000-0000-000000000002', 'envigado',   'Municipio de Envigado',  'municipio', 'active', '{"poblacion": 230000, "departamento": "Antioquia"}'),
  ('a0000000-0000-0000-0000-000000000003', 'cali',       'Municipio de Cali',      'municipio', 'active', '{"poblacion": 2200000, "departamento": "Valle del Cauca"}')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. USERS (roles variados por tenant)
-- ============================================================
INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, metadata) VALUES
  -- Medellín
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin@medellin.gov.co',       'Carlos Restrepo',   'admin',              'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'ana.productor@agrored.co',    'Ana María García',  'producer',           'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'pedro.productor@agrored.co',  'Pedro Gómez',       'producer',           'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'maria.comedor@medellin.gov.co','María López',       'institutional',      'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'juan.logistica@agrored.co',   'Juan Hernández',    'logistics_operator', 'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'luisa.analista@medellin.gov.co','Luisa Martínez',   'analyst',            'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  -- Envigado
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'admin@envigado.gov.co',       'Sandra Ríos',       'admin',              'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'camilo.campo@agrored.co',     'Camilo Betancur',   'producer',           'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 'diana.pae@envigado.gov.co',   'Diana Cardona',     'institutional',      'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  -- Cali
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', 'admin@cali.gov.co',           'Roberto Caicedo',   'admin',              'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000003', 'nelly.campo@agrored.co',      'Nelly Orozco',      'producer',           'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}'),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', 'jorge.comedor@cali.gov.co',   'Jorge Mina',        'institutional',      'active', '$2b$10$CrRB/6IAh.LnwTGUuybs1uT1EsvA1wS.T2Y7pExSn8AV8LB2djnJC', '{}')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 3. PRODUCERS (productores rurales y cooperativas)
-- ============================================================
INSERT INTO public.producers (id, tenant_id, user_id, producer_type, organization_name, contact_name, contact_phone, municipality_name, zone_type, product_categories, latitude, longitude, status) VALUES
  -- Medellín
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'smallholder',  'Finca La Esperanza',       'Ana María García',  '+573001234567', 'Medellín',  'rural',      '{"hortalizas","frutas","tubérculos"}',       6.217000, -75.567000, 'verified'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'cooperative',  'Cooperativa AgroVerde',     'Pedro Gómez',       '+573009876543', 'Medellín',  'peri_urban', '{"hortalizas","legumbres","aromáticas"}',    6.253000, -75.587000, 'verified'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', NULL,                                   'aggregator',   'Central Mayorista Antioquia','Luis Torres',      '+573004567890', 'Medellín',  'urban',      '{"frutas","verduras","granos","lácteos"}',   6.245000, -75.563000, 'verified'),
  -- Envigado
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000008', 'smallholder',  'Finca El Retiro',          'Camilo Betancur',   '+573002345678', 'Envigado',  'rural',      '{"frutas","café","panela"}',                 6.170000, -75.582000, 'verified'),
  -- Cali
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000011', 'cooperative',  'Cooperativa Pacífico Verde','Nelly Orozco',     '+573006789012', 'Cali',      'rural',      '{"plátano","yuca","frutas tropicales"}',     3.435000, -76.535000, 'verified'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', NULL,                                   'smallholder',  'Finca Pance Orgánica',     'Esteban Muñoz',     '+573007890123', 'Cali',      'rural',      '{"hortalizas","frutas","hierbas"}',          3.340000, -76.565000, 'pending_verification')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. OFFERS (ofertas activas de productos)
-- ============================================================
INSERT INTO public.offers (id, tenant_id, producer_id, title, product_name, category, unit, quantity_available, price_amount, currency, available_from, available_until, municipality_name, latitude, longitude, notes, status) VALUES
  -- Medellín - múltiples ofertas
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Tomate chonto fresco',        'Tomate chonto',     'hortalizas',  'kg',  500.00,  2800.00, 'COP', '2026-04-11 06:00:00+00', '2026-04-18 18:00:00+00', 'Medellín',  6.217000, -75.567000, 'Cosecha de temporada, orgánico',          'published'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Aguacate Hass premium',       'Aguacate Hass',     'frutas',      'kg',  300.00,  8500.00, 'COP', '2026-04-11 06:00:00+00', '2026-04-25 18:00:00+00', 'Medellín',  6.217000, -75.567000, 'Calibre exportación, maduración controlada','published'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Cilantro fresco en manojo',   'Cilantro',          'aromáticas',  'manojo', 200.00, 1200.00, 'COP', '2026-04-11 06:00:00+00', '2026-04-14 18:00:00+00', 'Medellín',  6.253000, -75.587000, 'Alta rotación, cosecha diaria',          'published'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Frijol cargamanto rojo',      'Frijol cargamanto', 'legumbres',   'kg',  800.00,  5200.00, 'COP', '2026-04-11 06:00:00+00', '2026-04-30 18:00:00+00', 'Medellín',  6.253000, -75.587000, 'Cosecha seca, excelente calidad',        'published'),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Papa criolla seleccionada',   'Papa criolla',      'tubérculos',  'kg', 1200.00,  3200.00, 'COP', '2026-04-11 06:00:00+00', '2026-04-20 18:00:00+00', 'Medellín',  6.245000, -75.563000, 'Selección grado A, lavada',              'reserved'),
  -- Envigado
  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'Café especial de altura',     'Café pergamino',    'café',        'kg',  150.00, 18000.00, 'COP', '2026-04-11 06:00:00+00', '2026-05-11 18:00:00+00', 'Envigado',  6.170000, -75.582000, 'Proceso honey, 84+ puntos SCA',          'published'),
  ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'Panela orgánica en bloque',   'Panela orgánica',   'panela',      'kg',  400.00,  4500.00, 'COP', '2026-04-11 06:00:00+00', '2026-04-30 18:00:00+00', 'Envigado',  6.170000, -75.582000, 'Sin químicos, trapiche artesanal',       'published'),
  -- Cali
  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'Plátano hartón verde',        'Plátano hartón',    'frutas tropicales','kg', 2000.00, 1800.00, 'COP', '2026-04-11 06:00:00+00', '2026-04-18 18:00:00+00', 'Cali', 3.435000, -76.535000, 'Cosecha del Pacífico, verde para madurar','published'),
  ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'Yuca fresca del Valle',       'Yuca',              'tubérculos',  'kg', 1500.00,  2200.00, 'COP', '2026-04-11 06:00:00+00', '2026-04-16 18:00:00+00', 'Cali', 3.435000, -76.535000, 'Variedad ICA, pelada y empacada',        'published'),
  ('d0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006', 'Lechuga crespa orgánica',     'Lechuga crespa',    'hortalizas',  'unidad', 300.00, 2500.00, 'COP', '2026-04-11 06:00:00+00', '2026-04-14 18:00:00+00', 'Cali', 3.340000, -76.565000, 'Cultivo hidropónico, sin pesticidas',    'fulfilled')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. DEMANDS (demandas institucionales)
-- ============================================================
INSERT INTO public.demands (id, tenant_id, responsible_user_id, demand_channel, organization_name, product_name, category, unit, quantity_required, needed_by, beneficiary_count, municipality_name, latitude, longitude, status) VALUES
  -- Medellín
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'comedor_comunitario', 'Comedor Comunitario Centro',     'Tomate chonto',     'hortalizas', 'kg', 150.00,  '2026-04-15 12:00:00+00', 120, 'Medellín', 6.244000, -75.565000, 'open'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'pae_escolar',        'PAE Institución Educativa San José','Frijol cargamanto','legumbres', 'kg', 200.00,  '2026-04-16 10:00:00+00', 350, 'Medellín', 6.250000, -75.570000, 'open'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'ayuda_humanitaria',  'Cruz Roja Medellín',            'Papa criolla',      'tubérculos', 'kg', 500.00,  '2026-04-13 08:00:00+00', 800, 'Medellín', 6.248000, -75.560000, 'partially_matched'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 'comedor_comunitario', 'Comedor El Poblado',            'Aguacate Hass',     'frutas',     'kg',  80.00,  '2026-04-17 12:00:00+00', 90,  'Medellín', 6.205000, -75.567000, 'open'),
  -- Envigado
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000009', 'pae_escolar',        'PAE Colegio La Salle Envigado', 'Panela orgánica',   'panela',     'kg', 100.00,  '2026-04-18 10:00:00+00', 200, 'Envigado', 6.172000, -75.575000, 'open'),
  -- Cali
  ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000012', 'comedor_comunitario', 'Comedor Siloé',                 'Plátano hartón',    'frutas tropicales','kg', 400.00, '2026-04-14 12:00:00+00', 250, 'Cali', 3.420000, -76.555000, 'open'),
  ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000012', 'ayuda_humanitaria',  'Banco Alimentos Cali',          'Yuca',              'tubérculos', 'kg', 800.00,  '2026-04-15 08:00:00+00', 1500,'Cali', 3.440000, -76.530000, 'fulfilled')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. RESCUES (rescate de alimentos)
-- ============================================================
INSERT INTO public.rescues (id, tenant_id, producer_id, offer_id, rescue_channel, destination_organization_name, product_name, category, unit, quantity_rescued, scheduled_at, beneficiary_count, municipality_name, latitude, longitude, status) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'donation',              'Comedor Comunitario Centro',     'Tomate chonto',  'hortalizas',       'kg',  80.00, '2026-04-12 08:00:00+00', 120, 'Medellín', 6.244000, -75.565000, 'scheduled'),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', 'institutional_request', 'Cruz Roja Medellín',            'Papa criolla',   'tubérculos',       'kg', 300.00, '2026-04-12 10:00:00+00', 500, 'Medellín', 6.248000, -75.560000, 'in_transit'),
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', NULL,                                    'donation',              'PAE San José',                  'Cilantro',       'aromáticas',       'manojo', 50.00, '2026-04-11 14:00:00+00', 200, 'Medellín', 6.250000, -75.570000, 'delivered'),
  ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000008', 'supplier_overstock',    'Comedor Siloé',                 'Plátano hartón', 'frutas tropicales','kg', 500.00, '2026-04-13 07:00:00+00', 250, 'Cali',     3.420000, -76.555000, 'scheduled'),
  ('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000007', 'donation',              'PAE La Salle Envigado',         'Panela orgánica','panela',           'kg',  60.00, '2026-04-14 09:00:00+00', 200, 'Envigado', 6.172000, -75.575000, 'scheduled')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. INVENTORY_ITEMS (inventario en bodega/punto)
-- ============================================================
INSERT INTO public.inventory_items (id, tenant_id, producer_id, offer_id, rescue_id, source_type, storage_location_name, product_name, category, unit, quantity_on_hand, quantity_reserved, municipality_name, latitude, longitude, status) VALUES
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', NULL,                                    'offer',   'Bodega Central Medellín',    'Tomate chonto',     'hortalizas',       'kg',  420.00, 150.00, 'Medellín', 6.245000, -75.563000, 'available'),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', NULL,                                    'offer',   'Bodega Central Medellín',    'Papa criolla',      'tubérculos',       'kg',  900.00, 500.00, 'Medellín', 6.245000, -75.563000, 'reserved'),
  ('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', NULL,                                    'f0000000-0000-0000-0000-000000000003', 'rescue',  'Bodega Central Medellín',    'Cilantro',          'aromáticas',       'manojo', 150.00, 0.00, 'Medellín', 6.245000, -75.563000, 'available'),
  ('10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', NULL,                                    'offer',   'Bodega Laureles',           'Frijol cargamanto', 'legumbres',        'kg',  600.00, 200.00, 'Medellín', 6.255000, -75.587000, 'available'),
  ('10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000006', NULL,                                    'offer',   'Punto acopio Envigado',     'Café pergamino',    'café',             'kg',  130.00,  20.00, 'Envigado', 6.170000, -75.582000, 'available'),
  ('10000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000008', NULL,                                    'offer',   'Bodega Galería Alameda',    'Plátano hartón',    'frutas tropicales','kg', 1500.00, 400.00, 'Cali',     3.435000, -76.535000, 'available'),
  ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000009', NULL,                                    'offer',   'Bodega Galería Alameda',    'Yuca',              'tubérculos',       'kg', 1200.00, 800.00, 'Cali',     3.435000, -76.535000, 'reserved')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. RECURSOS (flota logística)
-- ============================================================
INSERT INTO public.recursos (id, tenant_id, user_id, nombre, tipo, placa, telefono, estado, latitude, longitude, capacidad_kg, capacidad_volumen_m3, es_refrigerado, zona_operativa) VALUES
  ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 'Camión Refrigerado MDE-01', 'vehiculo',     'ABC123', '+573005001001', 'disponible',   6.250000, -75.570000, 3000.00, 12.00, TRUE,  'Medellín Centro'),
  ('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 'Moto Cargo MDE-01',        'moto',         'DEF456', '+573005002002', 'en_ruta',      6.244000, -75.565000,  200.00,  0.50, FALSE, 'Medellín Centro'),
  ('20000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', NULL,                                   'Bicicleta Cargo MDE-01',   'bicicleta',    NULL,     '+573005003003', 'disponible',   6.253000, -75.587000,   80.00,  0.30, FALSE, 'Medellín Laureles'),
  ('20000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', NULL,                                   'Camión Envigado-01',       'vehiculo',     'GHI789', '+573005004004', 'disponible',   6.170000, -75.582000, 2000.00,  8.00, FALSE, 'Envigado'),
  ('20000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', NULL,                                   'Camión Refrigerado CAL-01','vehiculo',     'JKL012', '+573005005005', 'en_ruta',      3.435000, -76.535000, 4000.00, 15.00, TRUE,  'Cali Norte'),
  ('20000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', NULL,                                   'Domiciliario CAL-01',      'domiciliario', NULL,     '+573005006006', 'disponible',   3.440000, -76.530000,   50.00,  0.20, FALSE, 'Cali Centro')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. LOGISTICS_ORDERS (órdenes de transporte)
-- ============================================================
INSERT INTO public.logistics_orders (id, tenant_id, inventory_item_id, demand_id, route_mode, origin_location_name, destination_organization_name, destination_address, scheduled_pickup_at, scheduled_delivery_at, quantity_assigned, municipality_name, origin_latitude, origin_longitude, destination_latitude, destination_longitude, recurso_id, status) VALUES
  ('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'motorcycle', 'Bodega Central Medellin',  'Comedor Comunitario Centro',       'Cra 50 #45-10, Medellin',       '2026-04-12 07:00:00+00', '2026-04-12 09:00:00+00', 150.00, 'Medellin', 6.245000, -75.563000, 6.244000, -75.565000, '20000000-0000-0000-0000-000000000002', 'in_transit'),
  ('30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'vehicle',    'Bodega Central Medellin',  'Cruz Roja Medellin',               'Calle 52 #40-20, Medellin',     '2026-04-12 08:00:00+00', '2026-04-12 11:00:00+00', 500.00, 'Medellin', 6.245000, -75.563000, 6.248000, -75.560000, '20000000-0000-0000-0000-000000000001', 'scheduled'),
  ('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'bicycle',    'Bodega Laureles',          'PAE Institucion Educativa San Jose','Cra 80 #35-50, Medellin',       '2026-04-13 06:00:00+00', '2026-04-13 08:00:00+00', 200.00, 'Medellin', 6.255000, -75.587000, 6.250000, -75.570000, '20000000-0000-0000-0000-000000000003', 'scheduled'),
  ('30000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005', 'vehicle',    'Punto acopio Envigado',    'PAE Colegio La Salle Envigado',    'Calle 38 Sur #42-15, Envigado', '2026-04-14 07:00:00+00', '2026-04-14 09:00:00+00', 100.00, 'Envigado', 6.170000, -75.582000, 6.172000, -75.575000, '20000000-0000-0000-0000-000000000004', 'scheduled'),
  ('30000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000006', 'vehicle',    'Bodega Galeria Alameda',   'Comedor Siloe',                    'Cra 3 Oeste #1-45, Cali',       '2026-04-13 06:00:00+00', '2026-04-13 10:00:00+00', 400.00, 'Cali',     3.435000, -76.535000, 3.420000, -76.555000, '20000000-0000-0000-0000-000000000005', 'in_transit'),
  ('30000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000007', 'vehicle',    'Bodega Galeria Alameda',   'Banco Alimentos Cali',             'Av 3N #25-50, Cali',            '2026-04-12 06:00:00+00', '2026-04-12 10:00:00+00', 800.00, 'Cali',     3.435000, -76.535000, 3.440000, -76.530000, '20000000-0000-0000-0000-000000000005', 'delivered')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 10. INCIDENTS (incidencias operativas y sociales)
-- ============================================================
INSERT INTO public.incidents (id, tenant_id, logistics_order_id, incident_type, severity, title, description, location_description, latitude, longitude, occurred_at, municipality_name, reported_by, reporter_role, affected_population, affected_community, evidence_urls, assigned_to, priority_score, status, sla_target_minutes) VALUES
  ('40000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'delay',          'medium',   'Retraso en entrega comedor Centro',   'Moto parada por lluvias fuertes en el trayecto',                  'Cra 50, sector Centro',         6.244000, -75.565000, '2026-04-12 08:30:00+00', 'Medellín', 'Juan Hernández',  'logistics_operator', 120, 'Centro',           '{}', 'Juan Hernández', 45.00, 'open',        120),
  ('40000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', NULL,                                   'spoilage',       'high',     'Riesgo deterioro tomate en bodega',   'Lote de tomate con signos de maduración acelerada, 48h máximo',   'Bodega Central Medellín',       6.245000, -75.563000, '2026-04-11 14:00:00+00', 'Medellín', 'Ana María García','producer',           0,   NULL,               '{}', 'Luisa Martínez',  72.00, 'in_progress', 60),
  ('40000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', NULL,                                   'social_unrest',  'critical', 'Bloqueo vial afecta distribución',    'Protesta social bloquea ruta principal hacia comedores del norte','Autopista Norte, km 5',         6.290000, -75.560000, '2026-04-11 10:00:00+00', 'Medellín', 'Carlos Restrepo', 'admin',              2000,'Norte Medellín',   '{}', 'Carlos Restrepo', 95.00, 'open',        30),
  ('40000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', NULL,                                   'supply_gap',     'high',     'Desabastecimiento frutas zona norte', 'No hay ofertas activas de frutas para comedores zona norte',      'Zona norte Medellín',           6.280000, -75.555000, '2026-04-11 09:00:00+00', 'Medellín', 'Luisa Martínez',  'analyst',            500, 'Norte Medellín',   '{}', 'María López',     68.00, 'open',        120),
  ('40000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000005', 'temperature',    'high',     'Cadena de frío rota camión Cali',     'Sensor de temperatura marca 12°C en carga de plátano (máx 8°C)', 'Ruta Galería-Siloé',            3.430000, -76.545000, '2026-04-13 08:00:00+00', 'Cali',     'Jorge Mina',      'institutional',      250, 'Siloé',            '{}', 'Roberto Caicedo', 80.00, 'open',        45),
  ('40000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', NULL,                                   'accident',       'low',      'Incidente menor vehículo Envigado',   'Golpe menor en parqueadero sin afectación de carga',             'Parqueadero punto acopio',      6.170000, -75.582000, '2026-04-11 16:00:00+00', 'Envigado', 'Sandra Ríos',     'admin',              0,   NULL,               '{}', 'Sandra Ríos',     15.00, 'resolved',    240)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 11. INCIDENT_ACTIONS (acciones sobre incidencias)
-- ============================================================
INSERT INTO public.incident_actions (id, incident_id, action_type, performed_by, description, metadata) VALUES
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'assign',    'Carlos Restrepo', 'Asignado a operador logístico Juan Hernández para seguimiento', '{}'),
  ('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'intervene', 'Luisa Martínez',  'Se priorizó despacho inmediato del lote en riesgo a comedores cercanos', '{"lote": "TOM-2026-04-01", "cantidad_kg": 80}'),
  ('41000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'escalate',  'Carlos Restrepo', 'Escalado a alcaldía por impacto en 2000+ beneficiarios', '{"nivel_escalamiento": "secretaria_gobierno"}'),
  ('41000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', 'activate_logistics', 'Carlos Restrepo', 'Activada ruta alternativa por vía Las Palmas', '{"ruta_alternativa": "Las Palmas - San Diego"}'),
  ('41000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', 'note',      'Jorge Mina',      'Contactado conductor para verificar estado de la carga', '{}'),
  ('41000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000006', 'close',     'Sandra Ríos',     'Incidente menor resuelto, sin afectación de mercancía', '{"costo_reparacion": 150000}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 12. INCIDENT_ALERTS (alertas agregadas de incidencias)
-- ============================================================
INSERT INTO public.incident_alerts (id, tenant_id, alert_type, severity, title, description, zone_name, incident_count, is_acknowledged) VALUES
  ('42000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'multiple_incidents_zone', 'high',     'Múltiples incidencias zona norte Medellín',  'Se detectaron 3+ incidencias en zona norte en las últimas 24h',  'Norte Medellín',  3, FALSE),
  ('42000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'critical_risk',          'critical', 'Riesgo crítico: bloqueo vial activo',        'Bloqueo vial afecta ruta principal de distribución alimentaria', 'Centro Medellín', 1, FALSE),
  ('42000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'unattended_timeout',     'medium',   'Incidencia sin atender >2h en Cali',         'Cadena de frío rota sin resolución después de 2 horas',         'Siloé',           1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 13. NOTIFICATIONS (notificaciones multicanal)
-- ============================================================
INSERT INTO public.notifications (id, tenant_id, incident_id, logistics_order_id, offer_id, notification_channel, recipient_label, title, message, scheduled_for, status) VALUES
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', NULL,                                    'push',     'Juan Hernández',      'Retraso reportado',                 'Su entrega al Comedor Centro tiene retraso. Actualice estado.',                        '2026-04-12 08:35:00+00', 'sent'),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', NULL,                                   NULL,                                    'email',    'ana.productor@agrored.co','Alerta deterioro producto',       'Su lote de Tomate chonto muestra signos de maduración acelerada. Se recomienda despacho inmediato.', '2026-04-11 14:05:00+00', 'sent'),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', NULL,                                   NULL,                                    'sms',      'Todos operadores zona norte', 'ALERTA: Bloqueo vial activo', 'Bloqueo en Autopista Norte km 5. Active rutas alternativas. Contacte central logística.', '2026-04-11 10:05:00+00', 'sent'),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', NULL,                                   NULL,                                   'd0000000-0000-0000-0000-000000000001', 'whatsapp', 'María López',         'Nueva oferta coincide con demanda', 'Oferta de Tomate chonto (500kg) coincide con su demanda de 150kg para Comedor Centro.',  '2026-04-11 06:30:00+00', 'sent'),
  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', NULL,                                   '30000000-0000-0000-0000-000000000002', NULL,                                    'push',     'Cruz Roja Medellín',  'Entrega programada',                'Su pedido de 500kg Papa criolla será entregado mañana entre 8-11am.',                   '2026-04-11 18:00:00+00', 'pending'),
  ('50000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', NULL,                                    'sms',      'Roberto Caicedo',     'Cadena frío comprometida',          'Alerta temperatura en camión CAL-01. Sensor marca 12°C (máx 8°C). Acción inmediata.', '2026-04-13 08:05:00+00', 'sent'),
  ('50000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', NULL,                                   '30000000-0000-0000-0000-000000000004', NULL,                                    'email',    'diana.pae@envigado.gov.co', 'Entrega PAE confirmada',       'Entrega de 100kg Panela orgánica programada para 14/04 7-9am en Colegio La Salle.',    '2026-04-13 12:00:00+00', 'pending')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 14. AUTOMATION_RUNS (decisiones automatizadas)
-- ============================================================
INSERT INTO public.automation_runs (id, tenant_id, incident_id, logistics_order_id, trigger_source, model_version, classification, status, actions, metrics_snapshot) VALUES
  ('60000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', NULL,                                   'incident',  'heuristic-v1', 'at_risk',  'executed',  '[{"type":"reroute_to_nearest_demand","target":"Comedor Centro","quantity_kg":80}]', '{"spoilage_probability":0.65,"hours_remaining":48,"demand_match_score":0.92}'),
  ('60000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', NULL,                                   'incident',  'heuristic-v1', 'critical', 'proposed',  '[{"type":"activate_alternative_route","route":"Las Palmas"},{"type":"alert_emergency_services"}]', '{"affected_beneficiaries":2000,"blocked_routes":1,"alternative_routes":2}'),
  ('60000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', NULL,                                   '30000000-0000-0000-0000-000000000001', 'logistics', 'heuristic-v1', 'at_risk',  'generated', '[{"type":"reassign_vehicle","from":"moto","to":"bicycle","reason":"weather_delay"}]', '{"delay_minutes":30,"distance_km":1.2,"load_kg":150}'),
  ('60000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 'incident',  'heuristic-v1', 'critical', 'executed',  '[{"type":"activate_cold_chain_protocol","action":"redirect_to_nearest_cold_storage"}]', '{"temperature_c":12,"max_temperature_c":8,"product":"platano","risk":"high"}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 15. ALLOCATION_SCENARIOS (simulaciones de distribución)
-- ============================================================
INSERT INTO public.allocation_scenarios (id, tenant_id, scenario_name, description, budget_total, parameters, results, status, created_by) VALUES
  ('61000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Distribución Q2 Medellín',   'Optimización de presupuesto trimestral para comedores y PAE',           250000000.00, '{"comedores":12,"pae":8,"prioridad":"zona_norte","restriccion_cadena_frio":true}', '{"costo_logistica":45000000,"cobertura_pct":87.5,"beneficiarios_alcanzados":4200,"rutas_optimas":15}', 'completed', 'b0000000-0000-0000-0000-000000000006'),
  ('61000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Emergencia Siloé Abril 2026','Escenario de respuesta rápida ante cadena de frío comprometida en Cali', 50000000.00,  '{"zona":"Siloé","tipo":"emergencia","vehiculos_refrigerados":2}', '{"tiempo_respuesta_min":45,"productos_rescatados_kg":400,"beneficiarios":250}', 'completed', 'b0000000-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 16. FOOD_PROGRAMS (programas alimentarios institucionales)
-- ============================================================
INSERT INTO public.food_programs (id, tenant_id, name, program_type, description, target_population, current_coverage, budget_allocated, budget_executed, responsible_name, responsible_email, municipality_name, status, starts_at, ends_at) VALUES
  ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Comedores Comunitarios Medellín 2026',  'comedor_comunitario',   'Red de 12 comedores comunitarios en zonas vulnerables',                  5000,  3800,  500000000.00,  180000000.00, 'María López',     'maria.comedor@medellin.gov.co',  'Medellín', 'active', '2026-01-01', '2026-12-31'),
  ('70000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'PAE Medellín Semestre 1',               'programa_escolar',      'Programa de Alimentación Escolar para 8 instituciones educativas',       8000,  7200,  800000000.00,  350000000.00, 'María López',     'maria.comedor@medellin.gov.co',  'Medellín', 'active', '2026-02-01', '2026-06-30'),
  ('70000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Ayuda Humanitaria Zona Norte',          'ayuda_humanitaria',     'Distribución de emergencia para población desplazada zona norte',        2000,  1200,  150000000.00,   85000000.00, 'Carlos Restrepo', 'admin@medellin.gov.co',          'Medellín', 'active', '2026-03-01', '2026-06-30'),
  ('70000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'PAE Envigado 2026',                     'programa_escolar',      'Programa alimentación escolar municipio de Envigado',                    3000,  2500,  350000000.00,  120000000.00, 'Diana Cardona',   'diana.pae@envigado.gov.co',      'Envigado', 'active', '2026-02-01', '2026-11-30'),
  ('70000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'Comedores Cali - Ladera',               'comedor_comunitario',   'Red de comedores en ladera occidental (Siloé, Terrón Colorado)',         4000,  2800,  400000000.00,  200000000.00, 'Jorge Mina',      'jorge.comedor@cali.gov.co',      'Cali',     'active', '2026-01-01', '2026-12-31'),
  ('70000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'Subsidio Alimentario Cali Norte',       'subsidio_alimentario',  'Bonos alimentarios para familias estrato 1 y 2 de la zona norte',        6000,  4500,  600000000.00,  280000000.00, 'Roberto Caicedo', 'admin@cali.gov.co',              'Cali',     'active', '2026-01-15', '2026-12-31')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 17. BENEFICIARIES (beneficiarios de programas)
-- ============================================================
INSERT INTO public.beneficiaries (id, tenant_id, program_id, full_name, document_id, document_type, age, gender, socioeconomic_level, risk_classification, nutritional_status, municipality_name, zone_name, address, latitude, longitude, contact_phone, is_active) VALUES
  -- Medellín comedores
  ('71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Gladys Pérez Monsalve',    '43567890',  'CC', 62, 'femenino',  1, 'alto',    'normal',               'Medellín', 'Centro',     'Cra 50 #44-30',       6.244500, -75.564500, '+573101234567', TRUE),
  ('71000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Santiago Ruiz Arbeláez',    '1035678901','TI', 12, 'masculino', 2, 'medio',   'desnutricion_cronica', 'Medellín', 'Centro',     'Calle 45 #49-15',     6.244200, -75.565200, '+573109876543', TRUE),
  ('71000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'María Elena Zapata',       '21890123',  'CC', 78, 'femenino',  1, 'critico', 'desnutricion_aguda',   'Medellín', 'Centro',     'Cra 51 #43-20',       6.243800, -75.564800, '+573112345678', TRUE),
  -- Medellín PAE
  ('71000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'Valentina Gómez Ospina',   '1098765432','TI',  9, 'femenino',  2, 'medio',   'normal',               'Medellín', 'Laureles',   'Cra 80 #35-12',       6.255000, -75.587000, '+573114567890', TRUE),
  ('71000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'Mateo Hernández Correa',   '1098765433','TI', 11, 'masculino', 2, 'bajo',    'sobrepeso',            'Medellín', 'Laureles',   'Calle 33 #82-05',     6.254000, -75.586000, '+573115678901', TRUE),
  -- Medellín ayuda humanitaria
  ('71000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 'Rosa Amelia Velandia',     '52345678',  'CC', 35, 'femenino',  1, 'critico', 'desnutricion_aguda',   'Medellín', 'Norte',      'Sector Moravia',      6.280000, -75.555000, '+573116789012', TRUE),
  ('71000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 'Luis Fernando Cárdenas',   '79012345',  'CC', 45, 'masculino', 1, 'alto',    'normal',               'Medellín', 'Norte',      'Sector Moravia',      6.281000, -75.554000, '+573117890123', TRUE),
  -- Envigado PAE
  ('71000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000004', 'Sofía Betancur Ríos',      '1099876543','TI', 10, 'femenino',  3, 'bajo',    'normal',               'Envigado', 'Zuñiga',     'Cra 42 #38S-20',      6.170000, -75.582000, '+573118901234', TRUE),
  ('71000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000004', 'Daniel Cardona Mejía',     '1099876544','TI',  8, 'masculino', 3, 'bajo',    'normal',               'Envigado', 'El Trianón', 'Calle 37 Sur #40-12', 6.168000, -75.575000, '+573119012345', TRUE),
  -- Cali comedores
  ('71000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000005', 'Carmen Lucía Mina',        '31234567',  'CC', 55, 'femenino',  1, 'alto',    'normal',               'Cali',     'Siloé',      'Cra 3 Oeste #1-20',   3.420000, -76.555000, '+573120123456', TRUE),
  ('71000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000005', 'Jesús Antonio Carabalí',   '14567890',  'CC', 70, 'masculino', 1, 'critico', 'desnutricion_cronica', 'Cali',     'Siloé',      'Cra 3 Oeste #2-15',   3.421000, -76.554000, '+573121234567', TRUE),
  ('71000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000006', 'Andrea Orozco Paz',        '66789012',  'CC', 28, 'femenino',  2, 'medio',   'normal',               'Cali',     'San Fernando','Cra 35 #5-45',       3.435000, -76.535000, '+573122345678', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 18. PROGRAM_DELIVERIES (entregas de programas)
-- ============================================================
INSERT INTO public.program_deliveries (id, program_id, beneficiary_id, tenant_id, product_name, category, quantity, unit, delivered_by, delivery_date, municipality_name, evidence_url, notes, status) VALUES
  ('72000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Tomate chonto',     'hortalizas', 5.00,   'kg',     'Juan Hernández', '2026-04-10', 'Medellín', NULL, 'Entrega semanal comedor Centro',     'completed'),
  ('72000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Frijol cargamanto', 'legumbres',  3.00,   'kg',     'Juan Hernández', '2026-04-10', 'Medellín', NULL, 'Entrega semanal comedor Centro',     'completed'),
  ('72000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Papa criolla',      'tubérculos', 4.00,   'kg',     'Juan Hernández', '2026-04-10', 'Medellín', NULL, 'Entrega especial adulto mayor',      'completed'),
  ('72000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Cilantro',          'aromáticas', 1.00,   'manojo', 'María López',    '2026-04-09', 'Medellín', NULL, 'Almuerzo escolar semanal',           'completed'),
  ('72000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Papa criolla',      'tubérculos', 10.00,  'kg',     'Carlos Restrepo','2026-04-08', 'Medellín', NULL, 'Kit humanitario familia 4 personas', 'completed'),
  ('72000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'Panela orgánica',   'panela',     2.00,   'kg',     'Diana Cardona',  '2026-04-09', 'Envigado', NULL, 'Refrigerio escolar PAE',             'completed'),
  ('72000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', 'Plátano hartón',    'frutas tropicales', 8.00, 'kg', 'Jorge Mina',    '2026-04-10', 'Cali',     NULL, 'Almuerzo comedor Siloé',             'completed'),
  ('72000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000003', 'Yuca',              'tubérculos', 6.00,   'kg',     'Jorge Mina',    '2026-04-10', 'Cali',     NULL, 'Almuerzo comedor Siloé',             'completed'),
  -- Entregas programadas (futuras)
  ('72000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Aguacate Hass',     'frutas',     3.00,   'kg',     'Juan Hernández', '2026-04-17', 'Medellín', NULL, 'Entrega semanal comedor Centro',     'scheduled'),
  ('72000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', 'Bono alimentario',  'subsidio',   50000.00,'COP',   'Roberto Caicedo','2026-04-15', 'Cali',     NULL, 'Bono mensual estrato 1',             'scheduled')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 19. COORDINATION_TASKS (coordinación interinstitucional)
-- ============================================================
INSERT INTO public.coordination_tasks (id, tenant_id, actor_type, actor_name, task_description, assigned_to, status, priority, due_date) VALUES
  ('73000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'supermercado',         'Éxito Medellín',              'Coordinar donación de productos próximos a vencer para comedores zona Centro',  'María López',     'in_progress', 'high',   '2026-04-15'),
  ('73000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'banco_alimentos',      'Banco Alimentos Medellín',    'Articular logística de almacenamiento temporal para lote de papa criolla',       'Juan Hernández',  'pending',     'medium', '2026-04-14'),
  ('73000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'operador_logistico',   'TransCarga Antioquia',        'Activar flota refrigerada adicional para ruta Norte alternativa',                'Juan Hernández',  'pending',     'high',   '2026-04-12'),
  ('73000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'entidad_salud',        'Secretaría de Salud Medellín','Reportar estado nutricional 3 beneficiarios críticos zona Centro',               'Luisa Martínez',  'pending',     'high',   '2026-04-13'),
  ('73000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'supermercado',         'La 14 Cali',                  'Coordinar excedentes de frutas para comedores ladera occidental',               'Jorge Mina',      'in_progress', 'medium', '2026-04-16'),
  ('73000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'alcaldia',             'Alcaldía Envigado',           'Gestionar permiso de tránsito para camión en zona escolar horario AM',          'Sandra Ríos',     'completed',   'low',    '2026-04-10')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 20. INSTITUTIONAL_ALERTS (alertas del tablero institucional)
-- ============================================================
INSERT INTO public.institutional_alerts (id, tenant_id, alert_type, severity, title, description, indicator_name, indicator_value, threshold_value, zone_name, is_acknowledged) VALUES
  ('74000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'desabastecimiento',   'critical', 'Desabastecimiento frutas zona norte',    'No hay ofertas activas de frutas para cubrir demanda de 3 comedores',         'oferta_frutas_kg',           0.00,    200.00,  'Norte Medellín', FALSE),
  ('74000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'producto_por_perder',  'high',     'Tomate en riesgo de pérdida',           '80kg de tomate chonto con 48h máximo de vida útil sin destino asignado',      'tomate_horas_restantes',     48.00,    72.00,  'Centro Medellín', FALSE),
  ('74000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'baja_cobertura',       'medium',   'Cobertura ayuda humanitaria al 60%',    'Programa Ayuda Humanitaria Zona Norte solo cubre 1200 de 2000 beneficiarios', 'cobertura_pct',              60.00,    80.00,  'Norte Medellín', FALSE),
  ('74000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'irat_alto',            'high',     'IRAT elevado zona Siloé',               'Índice de riesgo alimentario territorial supera umbral por cadena de frío',   'irat_total',                 72.00,    60.00,  'Siloé',           FALSE),
  ('74000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'exceso_sin_destino',   'medium',   'Excedente yuca sin demanda inmediata',  '700kg de yuca en bodega sin demanda activa, deterioro estimado en 5 días',    'yuca_excedente_kg',         700.00,   500.00,  'Cali Centro',    FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 21. ALERT_THRESHOLDS (umbrales configurables)
-- ============================================================
INSERT INTO public.alert_thresholds (id, tenant_id, rule_key, value, description, updated_by) VALUES
  ('75000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'incident.zone_min_count',          3.00,  'Mínimo de incidencias en zona para generar alerta agregada',     'b0000000-0000-0000-0000-000000000001'),
  ('75000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'institutional.irat_high',         60.00,  'Umbral IRAT para generar alerta de riesgo alto',                'b0000000-0000-0000-0000-000000000001'),
  ('75000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'incident.sla_critical_minutes',   30.00,  'SLA en minutos para incidencias críticas',                      'b0000000-0000-0000-0000-000000000001'),
  ('75000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'incident.sla_high_minutes',       60.00,  'SLA en minutos para incidencias altas',                         'b0000000-0000-0000-0000-000000000001'),
  ('75000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'incident.zone_min_count',          2.00,  'Mínimo incidencias en zona (Envigado, más conservador)',        'b0000000-0000-0000-0000-000000000007'),
  ('75000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'institutional.irat_high',         55.00,  'Umbral IRAT para Cali (más estricto por vulnerabilidad)',       'b0000000-0000-0000-0000-000000000010'),
  ('75000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'incident.sla_critical_minutes',   25.00,  'SLA crítico para Cali (reducido por emergencia activa)',        'b0000000-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 22. AUCTIONS (subastas de excedentes agrícolas)
-- ============================================================
INSERT INTO public.auctions (id, tenant_id, producer_id, product_name, category, unit, quantity_kg, photo_url, harvest_date, shelf_life_hours, auction_type, base_price, reserve_price, currency, duration_minutes, starts_at, ends_at, current_price, visibility_phase, visibility_radius_km, latitude, longitude, municipality_name, extension_count, max_extensions, status) VALUES
  ('80000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Aguacate Hass excedente',   'frutas',      'kg',  200.00, NULL, '2026-04-10', 96,  'ascending', 7000.00,  8000.00,  'COP', 720, '2026-04-11 08:00:00+00', '2026-04-11 20:00:00+00', 8200.00, 'phase_2', 30, 6.2170000, -75.5670000, 'Medellín', 1, 3, 'active'),
  ('80000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Frijol cargamanto lote B',  'legumbres',   'kg',  400.00, NULL, '2026-04-09', 720, 'ascending', 4500.00,  5000.00,  'COP', 1440,'2026-04-12 06:00:00+00', '2026-04-13 06:00:00+00', 4500.00, 'phase_1', 15, 6.2530000, -75.5870000, 'Medellín', 0, 3, 'draft'),
  ('80000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'Plátano hartón excedente',  'frutas tropicales','kg', 800.00, NULL, '2026-04-10', 48, 'dutch',  2500.00,  1200.00,  'COP', 360, '2026-04-11 10:00:00+00', '2026-04-11 16:00:00+00', 2100.00, 'phase_3', 50, 3.4350000, -76.5350000, 'Cali',     0, 2, 'active'),
  ('80000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'Café especial lote premium','café',        'kg',   50.00, NULL, '2026-04-08', 2160,'ascending',15000.00, 17000.00, 'COP', 1440,'2026-04-10 06:00:00+00', '2026-04-11 06:00:00+00', 19500.00,'phase_3', 100, 6.1700000, -75.5820000, 'Envigado', 2, 3, 'closed_with_winner')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 23. AUCTION_BIDS (pujas en subastas)
-- ============================================================
INSERT INTO public.auction_bids (id, auction_id, bidder_id, bidder_type, amount, max_proxy_amount, is_proxy, social_score, distance_km, latitude, longitude, status) VALUES
  -- Subasta Aguacate (ascending, activa)
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'institutional', 7500.00,  8500.00, TRUE,  85.00,  2.5, 6.2440000, -75.5650000, 'outbid'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000012', 'institutional', 8200.00,  9000.00, TRUE,  78.00, 45.0, 3.4200000, -76.5550000, 'active'),
  ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000009', 'institutional', 7800.00,  NULL,    FALSE, 90.00,  8.0, 6.1720000, -75.5750000, 'outbid'),
  -- Subasta Plátano (dutch, activa)
  ('81000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000012', 'institutional', 2100.00,  NULL,    FALSE, 78.00,  3.0, 3.4200000, -76.5550000, 'active'),
  -- Subasta Café (cerrada con ganador)
  ('81000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'institutional', 18000.00, NULL,    FALSE, 85.00,  5.0, 6.2440000, -75.5650000, 'outbid'),
  ('81000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000010', 'admin',         19500.00, NULL,    FALSE, 70.00, 50.0, 3.4350000, -76.5350000, 'winner')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 24. AUCTION_AUDIT_LOG
-- ============================================================
INSERT INTO public.auction_audit_log (id, auction_id, event_type, actor_id, payload) VALUES
  ('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'auction_created',   'b0000000-0000-0000-0000-000000000002', '{"product":"Aguacate Hass","quantity_kg":200}'),
  ('82000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'auction_activated', 'b0000000-0000-0000-0000-000000000002', '{"base_price":7000}'),
  ('82000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'bid_placed',        'b0000000-0000-0000-0000-000000000004', '{"amount":7500,"bidder_type":"institutional"}'),
  ('82000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000001', 'bid_placed',        'b0000000-0000-0000-0000-000000000009', '{"amount":7800,"bidder_type":"institutional"}'),
  ('82000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000001', 'bid_placed',        'b0000000-0000-0000-0000-000000000012', '{"amount":8200,"bidder_type":"institutional"}'),
  ('82000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000001', 'auction_extended',  '00000000-0000-0000-0000-000000000000', '{"extension":1,"new_ends_at":"2026-04-11T20:30:00Z"}'),
  ('82000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000004', 'auction_closed',    '00000000-0000-0000-0000-000000000000', '{"winner":"b0000000-0000-0000-0000-000000000010","final_price":19500}')
ON CONFLICT (id) DO NOTHING;

-- Actualizar ganador en subasta cerrada
UPDATE public.auctions
SET winner_id = 'b0000000-0000-0000-0000-000000000010', winner_price = 19500.00
WHERE id = '80000000-0000-0000-0000-000000000004' AND winner_id IS NULL;

-- ============================================================
-- 25. ROUTE_PLANS (planeación de rutas optimizadas)
-- ============================================================
INSERT INTO public.route_plans (id, tenant_id, plan_name, plan_type, recurso_id, total_stops, total_distance_km, estimated_duration_min, total_load_kg, max_capacity_kg, window_start, window_end, status, optimization_score) VALUES
  ('90000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ruta Recolección Centro AM', 'recoleccion', '20000000-0000-0000-0000-000000000001', 4, 12.50,  90, 950.00,  3000.00, '2026-04-12 06:00:00+00', '2026-04-12 09:00:00+00', 'optimized', 87.50),
  ('90000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Ruta Entrega Comedores PM',  'entrega',     '20000000-0000-0000-0000-000000000002', 3, 8.30,   60, 350.00,  200.00,  '2026-04-12 14:00:00+00', '2026-04-12 16:00:00+00', 'in_progress', 75.00),
  ('90000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Ruta Mixta Cali Sur',        'mixta',       '20000000-0000-0000-0000-000000000005', 5, 22.80, 150, 1200.00, 4000.00, '2026-04-13 05:00:00+00', '2026-04-13 10:00:00+00', 'draft',       92.30)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 26. ROUTE_STOPS (paradas de cada ruta)
-- ============================================================
INSERT INTO public.route_stops (id, route_plan_id, stop_order, stop_type, location_name, address, latitude, longitude, logistics_order_id, estimated_arrival, estimated_departure, status) VALUES
  -- Ruta Centro AM (recolección)
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 1, 'pickup',   'Finca La Esperanza',       'Vereda Santa Elena, km 3',      6.2170000, -75.5670000, NULL,                                    '2026-04-12 06:30:00+00', '2026-04-12 07:00:00+00', 'completed'),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 2, 'pickup',   'Cooperativa AgroVerde',    'Cra 80 Laureles',               6.2530000, -75.5870000, NULL,                                    '2026-04-12 07:15:00+00', '2026-04-12 07:45:00+00', 'completed'),
  ('91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000001', 3, 'delivery', 'Bodega Central Medellín',  'Cra 52 #45-20',                 6.2450000, -75.5630000, NULL,                                    '2026-04-12 08:00:00+00', '2026-04-12 08:30:00+00', 'arrived'),
  ('91000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', 4, 'checkpoint','Control calidad central', 'Bodega Central, zona inspección',6.2450000, -75.5630000, NULL,                                    '2026-04-12 08:30:00+00', '2026-04-12 09:00:00+00', 'pending'),
  -- Ruta Entrega Comedores PM
  ('91000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000002', 1, 'pickup',   'Bodega Central Medellín',  'Cra 52 #45-20',                 6.2450000, -75.5630000, '30000000-0000-0000-0000-000000000001', '2026-04-12 14:00:00+00', '2026-04-12 14:30:00+00', 'completed'),
  ('91000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000002', 2, 'delivery', 'Comedor Comunitario Centro','Cra 50 #45-10',                 6.2440000, -75.5650000, '30000000-0000-0000-0000-000000000001', '2026-04-12 14:45:00+00', '2026-04-12 15:15:00+00', 'arrived'),
  ('91000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000002', 3, 'delivery', 'Comedor El Poblado',       'Cra 43A #10-20',                6.2050000, -75.5670000, NULL,                                    '2026-04-12 15:30:00+00', '2026-04-12 16:00:00+00', 'pending'),
  -- Ruta Cali Sur (mixta)
  ('91000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000003', 1, 'pickup',   'Bodega Galería Alameda',   'Av 6N #25-50, Cali',            3.4350000, -76.5350000, '30000000-0000-0000-0000-000000000005', '2026-04-13 05:30:00+00', '2026-04-13 06:00:00+00', 'pending'),
  ('91000000-0000-0000-0000-000000000009', '90000000-0000-0000-0000-000000000003', 2, 'pickup',   'Cooperativa Pacífico Verde','Km 5 vía Pance',               3.4350000, -76.5350000, NULL,                                    '2026-04-13 06:30:00+00', '2026-04-13 07:00:00+00', 'pending'),
  ('91000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000003', 3, 'delivery', 'Comedor Siloé',            'Cra 3 Oeste #1-45',             3.4200000, -76.5550000, '30000000-0000-0000-0000-000000000005', '2026-04-13 07:30:00+00', '2026-04-13 08:00:00+00', 'pending'),
  ('91000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000003', 4, 'delivery', 'Banco Alimentos Cali',     'Av 3N #25-50',                  3.4400000, -76.5300000, '30000000-0000-0000-0000-000000000006', '2026-04-13 08:30:00+00', '2026-04-13 09:00:00+00', 'pending'),
  ('91000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000003', 5, 'checkpoint','Punto control refrigeración','Terminal Sur',                3.4100000, -76.5400000, NULL,                                    '2026-04-13 09:15:00+00', '2026-04-13 09:30:00+00', 'pending')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 27. VRP_SOLUTIONS (soluciones de ruteo vehicular)
-- ============================================================
INSERT INTO public.vrp_solutions (id, tenant_id, scenario_name, depot_lat, depot_lng, strategy, status, total_vehicles_used, total_distance_km, total_duration_min, total_load_kg, unserved_stops, routing_engine) VALUES
  ('92000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'VRP Medellín AM 12-Abr',   6.245000, -75.563000, 'clarke_wright', 'completed', 2, 25.80, 150, 1300.00, 0, 'haversine'),
  ('92000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'VRP Cali Sur 13-Abr',      3.435000, -76.535000, 'clarke_wright', 'completed', 1, 22.80, 150, 1200.00, 0, 'haversine')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 28. VRP_VEHICLE_ROUTES
-- ============================================================
INSERT INTO public.vrp_vehicle_routes (id, vrp_solution_id, vehicle_index, recurso_id, vehicle_label, capacity_kg, assigned_load_kg, distance_km, duration_min, stop_count, stop_order) VALUES
  ('93000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 0, '20000000-0000-0000-0000-000000000001', 'Camión Refrigerado MDE-01', 3000.00, 950.00,  12.50, 90,  4, '[{"stop_id":"91000000-0000-0000-0000-000000000001","type":"pickup"},{"stop_id":"91000000-0000-0000-0000-000000000002","type":"pickup"},{"stop_id":"91000000-0000-0000-0000-000000000003","type":"delivery"},{"stop_id":"91000000-0000-0000-0000-000000000004","type":"checkpoint"}]'),
  ('93000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', 1, '20000000-0000-0000-0000-000000000002', 'Moto Cargo MDE-01',         200.00,  150.00,  8.30,  60,  3, '[{"stop_id":"91000000-0000-0000-0000-000000000005","type":"pickup"},{"stop_id":"91000000-0000-0000-0000-000000000006","type":"delivery"},{"stop_id":"91000000-0000-0000-0000-000000000007","type":"delivery"}]'),
  ('93000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000002', 0, '20000000-0000-0000-0000-000000000005', 'Camión Refrigerado CAL-01', 4000.00, 1200.00, 22.80, 150, 5, '[{"stop_id":"91000000-0000-0000-0000-000000000008","type":"pickup"},{"stop_id":"91000000-0000-0000-0000-000000000009","type":"pickup"},{"stop_id":"91000000-0000-0000-0000-000000000010","type":"delivery"},{"stop_id":"91000000-0000-0000-0000-000000000011","type":"delivery"},{"stop_id":"91000000-0000-0000-0000-000000000012","type":"checkpoint"}]')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 29. TRACKING_HISTORIAL (historial GPS de recursos)
-- ============================================================
INSERT INTO public.tracking_historial (recurso_id, orden_id, latitude, longitude, velocidad, precision_gps, bearing, evento, registrado_at) VALUES
  -- Moto MDE-02: recorrido entrega comedor Centro
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 6.245000, -75.563000, 0.0,  5.0, 0,   'inicio_ruta',      '2026-04-12 07:00:00+00'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 6.245200, -75.563500, 25.0, 3.0, 270, 'posicion',         '2026-04-12 07:05:00+00'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 6.244800, -75.564200, 20.0, 4.0, 260, 'posicion',         '2026-04-12 07:10:00+00'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 6.244500, -75.564800, 15.0, 3.5, 255, 'llegada_destino',  '2026-04-12 07:15:00+00'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 6.244500, -75.564800, 0.0,  3.0, 0,   'pausa',            '2026-04-12 07:16:00+00'),
  -- Camión CAL-01: recorrido entrega Cali
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 3.435000, -76.535000, 0.0,  5.0, 0,   'inicio_ruta',      '2026-04-13 06:00:00+00'),
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 3.432000, -76.538000, 35.0, 4.0, 220, 'en_transito',      '2026-04-13 06:10:00+00'),
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 3.428000, -76.542000, 30.0, 3.0, 225, 'posicion',         '2026-04-13 06:20:00+00'),
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 3.425000, -76.548000, 28.0, 4.5, 230, 'posicion',         '2026-04-13 06:30:00+00'),
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 3.420000, -76.555000, 0.0,  3.0, 0,   'llegada_destino',  '2026-04-13 07:00:00+00');

-- ============================================================
-- 30. TRACKING_ACTUAL (posición actual de recursos)
-- ============================================================
INSERT INTO public.tracking_actual (recurso_id, latitude, longitude, velocidad, bearing, evento, orden_id, actualizado_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 6.250000, -75.570000, 0.0,   0,   'posicion',        NULL,                                    '2026-04-11 18:00:00+00'),
  ('20000000-0000-0000-0000-000000000002', 6.244500, -75.564800, 0.0,   0,   'pausa',           '30000000-0000-0000-0000-000000000001', '2026-04-12 07:16:00+00'),
  ('20000000-0000-0000-0000-000000000003', 6.253000, -75.587000, 0.0,   0,   'posicion',        NULL,                                    '2026-04-11 17:00:00+00'),
  ('20000000-0000-0000-0000-000000000005', 3.420000, -76.555000, 0.0,   0,   'llegada_destino', '30000000-0000-0000-0000-000000000005', '2026-04-13 07:00:00+00'),
  ('20000000-0000-0000-0000-000000000006', 3.440000, -76.530000, 0.0,   0,   'posicion',        NULL,                                    '2026-04-11 16:00:00+00')
ON CONFLICT (recurso_id) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  velocidad = EXCLUDED.velocidad,
  bearing = EXCLUDED.bearing,
  evento = EXCLUDED.evento,
  orden_id = EXCLUDED.orden_id,
  actualizado_at = EXCLUDED.actualizado_at;

-- ============================================================
-- 31. DELIVERY_EVENTS (eventos de entrega)
-- ============================================================
INSERT INTO public.delivery_events (orden_id, recurso_id, evento, latitude, longitude, notas, evidencia_url, registrado_at) VALUES
  -- Orden 1 (Moto MDE → Comedor Centro)
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'asignado',         6.245000, -75.563000, 'Asignado a moto DEF456',                    NULL, '2026-04-12 06:50:00+00'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'aceptado',         6.245000, -75.563000, 'Conductor confirma disponibilidad',          NULL, '2026-04-12 06:55:00+00'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'inicio_ruta',      6.245000, -75.563000, 'Salida de bodega central',                  NULL, '2026-04-12 07:00:00+00'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'llegada_destino',  6.244500, -75.564800, 'Llegada a Comedor Centro',                  NULL, '2026-04-12 07:15:00+00'),
  -- Orden 5 (Camión CAL → Comedor Siloé)
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'asignado',         3.435000, -76.535000, 'Asignado a camión refrigerado JKL012',      NULL, '2026-04-13 05:00:00+00'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'aceptado',         3.435000, -76.535000, 'Conductor confirma',                        NULL, '2026-04-13 05:30:00+00'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'inicio_ruta',      3.435000, -76.535000, 'Salida bodega Galería Alameda',             NULL, '2026-04-13 06:00:00+00'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'en_transito',      3.430000, -76.545000, 'En ruta, alerta temperatura detectada',     NULL, '2026-04-13 06:30:00+00'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'llegada_destino',  3.420000, -76.555000, 'Llegada a Comedor Siloé',                   NULL, '2026-04-13 07:00:00+00'),
  -- Orden 6 (entregada)
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000005', 'asignado',         3.435000, -76.535000, 'Asignado a camión JKL012',                  NULL, '2026-04-12 05:00:00+00'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000005', 'inicio_ruta',      3.435000, -76.535000, 'Salida bodega',                             NULL, '2026-04-12 06:00:00+00'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000005', 'entregado',        3.440000, -76.530000, 'Entregado completo a Banco Alimentos Cali', NULL, '2026-04-12 09:30:00+00');

-- ============================================================
-- 32. GEOFENCE_ZONES (zonas de control geográfico)
-- ============================================================
INSERT INTO public.geofence_zones (id, tenant_id, zone_name, zone_type, center_lat, center_lng, radius_m, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Bodega Central Medellín',  'warehouse',  6.245000, -75.563000, 200,  TRUE),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Comedor Centro Medellín',  'delivery',   6.244000, -75.565000, 150,  TRUE),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Zona bloqueo Norte MDE',   'restricted', 6.290000, -75.560000, 500,  TRUE),
  ('a1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'PAE San José perimetro',   'delivery',   6.250000, -75.570000, 100,  TRUE),
  ('a1000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'Bodega Galería Alameda',   'warehouse',  3.435000, -76.535000, 250,  TRUE),
  ('a1000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'Comedor Siloé perimetro',  'delivery',   3.420000, -76.555000, 200,  TRUE),
  ('a1000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'Zona crítica ladera oeste','critical',   3.415000, -76.560000, 1000, TRUE),
  ('a1000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'Punto acopio Envigado',    'warehouse',  6.170000, -75.582000, 180,  TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 33. GEOFENCE_EVENTS (eventos de geocerca)
-- ============================================================
INSERT INTO public.geofence_events (zone_id, recurso_id, event_type, latitude, longitude) VALUES
  -- Moto sale de bodega central
  ('a1000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'exit',  6.245200, -75.563500),
  -- Moto llega a comedor Centro
  ('a1000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'enter', 6.244500, -75.564800),
  ('a1000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'dwell', 6.244500, -75.564800),
  -- Camión Cali sale de bodega
  ('a1000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'exit',  3.434800, -76.535200),
  -- Camión entra en zona crítica ladera
  ('a1000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000005', 'enter', 3.418000, -76.550000),
  -- Camión llega a comedor Siloé
  ('a1000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000005', 'enter', 3.420000, -76.555000),
  ('a1000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000005', 'dwell', 3.420000, -76.555000);

-- ============================================================
-- 34. SPOILAGE_RECORDS (registros de desperdicio)
-- ============================================================
INSERT INTO public.spoilage_records (id, tenant_id, program_id, logistics_order_id, product_name, category, quantity_kg, spoilage_kg, spoilage_reason, stage, temperature_c, detected_at, detected_by, location_name, latitude, longitude, notes) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', NULL,                                    'Tomate chonto',  'perecedero', 500.00, 15.00,  'expired',       'storage',      22.0, '2026-04-10 14:00:00+00', 'Ana María García',  'Bodega Central Medellín', 6.245000, -75.563000, 'Lote anterior con 3 días de retraso en despacho'),
  ('a2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', NULL,                                   '30000000-0000-0000-0000-000000000001', 'Cilantro',       'perecedero', 50.00,   5.00,  'temperature',   'transport',    28.0, '2026-04-12 07:30:00+00', 'Juan Hernández',    'En tránsito moto MDE',    6.244500, -75.564800, 'Exposición al sol durante retraso por lluvias'),
  ('a2000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 'Plátano hartón', 'perecedero', 400.00, 40.00,  'temperature',   'transport',    12.0, '2026-04-13 08:00:00+00', 'Jorge Mina',        'Camión CAL-01 ruta Siloé',3.430000, -76.545000, 'Cadena de frío rota, 40kg en deterioro avanzado'),
  ('a2000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', NULL,                                   NULL,                                    'Lechuga',        'perecedero', 30.00,  30.00,  'overproduction','harvest',      18.0, '2026-04-09 12:00:00+00', 'Pedro Gómez',       'Finca AgroVerde',         6.253000, -75.587000, 'Sobreproducción sin demanda, pérdida total'),
  ('a2000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', NULL,                                   NULL,                                    'Yuca',           'perecedero', 1500.00, 80.00, 'damaged',       'distribution', 25.0, '2026-04-11 11:00:00+00', 'Nelly Orozco',      'Bodega Galería Alameda',  3.435000, -76.535000, 'Daño por manipulación en descargue')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 35. AUDIT_LOG (trazabilidad completa)
-- ============================================================
INSERT INTO public.audit_log (id, tenant_id, service_name, entity_name, entity_id, action_name, actor_id, payload) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'user-service',      'users',            'b0000000-0000-0000-0000-000000000001', 'create',  'system',                                '{"email":"admin@medellin.gov.co","role":"admin"}'),
  ('a3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'producer-service',   'producers',        'c0000000-0000-0000-0000-000000000001', 'create',  'b0000000-0000-0000-0000-000000000002', '{"organization_name":"Finca La Esperanza"}'),
  ('a3000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'offer-service',      'offers',           'd0000000-0000-0000-0000-000000000001', 'create',  'b0000000-0000-0000-0000-000000000002', '{"product_name":"Tomate chonto","quantity_kg":500}'),
  ('a3000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'demand-service',     'demands',          'e0000000-0000-0000-0000-000000000001', 'create',  'b0000000-0000-0000-0000-000000000004', '{"organization_name":"Comedor Comunitario Centro"}'),
  ('a3000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'rescue-service',     'rescues',          'f0000000-0000-0000-0000-000000000001', 'create',  'b0000000-0000-0000-0000-000000000002', '{"destination":"Comedor Centro","quantity_kg":80}'),
  ('a3000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'inventory-service',  'inventory_items',  '10000000-0000-0000-0000-000000000001', 'create',  'system',                                '{"product":"Tomate chonto","quantity":420}'),
  ('a3000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'logistics-service',  'logistics_orders', '30000000-0000-0000-0000-000000000001', 'create',  'b0000000-0000-0000-0000-000000000005', '{"destination":"Comedor Centro","quantity":150}'),
  ('a3000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'logistics-service',  'logistics_orders', '30000000-0000-0000-0000-000000000001', 'update',  'b0000000-0000-0000-0000-000000000005', '{"status":"in_transit","recurso_id":"20000000-0000-0000-0000-000000000002"}'),
  ('a3000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'incident-service',   'incidents',        '40000000-0000-0000-0000-000000000001', 'create',  'b0000000-0000-0000-0000-000000000005', '{"type":"delay","severity":"medium"}'),
  ('a3000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'automation-service', 'automation_runs',  '60000000-0000-0000-0000-000000000001', 'execute', 'system',                                '{"classification":"at_risk","action":"reroute_to_nearest_demand"}'),
  ('a3000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'auction-service',    'auctions',         '80000000-0000-0000-0000-000000000001', 'create',  'b0000000-0000-0000-0000-000000000002', '{"product":"Aguacate Hass","auction_type":"ascending"}'),
  ('a3000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', 'logistics-service',  'logistics_orders', '30000000-0000-0000-0000-000000000006', 'update',  'system',                                '{"status":"delivered","delivered_at":"2026-04-12T09:30:00Z"}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 36. IRAT_ZONAS (índice de riesgo alimentario territorial)
-- ============================================================
INSERT INTO public.irat_zonas (tipo_zona, referencia_id, codigo_zona, disponibilidad, acceso, logistica, estabilidad, incidencias, irat_total, clasificacion, fecha_corte) VALUES
  ('MUNICIPIO', 1, 'MDE',    72.0, 68.5, 75.0, 60.0, 45.0, 64.1, 'MEDIO',    '2026-04-11'),
  ('MUNICIPIO', 2, 'ENV',    85.0, 82.0, 80.0, 78.0, 90.0, 83.0, 'BAJO',     '2026-04-11'),
  ('MUNICIPIO', 7, 'CAL',    60.0, 55.0, 50.0, 45.0, 35.0, 49.0, 'ALTO',     '2026-04-11'),
  ('COMUNA',    1, 'MDE-C01', 65.0, 60.0, 70.0, 55.0, 40.0, 58.0, 'MEDIO',   '2026-04-11'),
  ('COMUNA',    2, 'MDE-C02', 80.0, 78.0, 82.0, 75.0, 85.0, 80.0, 'BAJO',    '2026-04-11'),
  ('ZONA',      1, 'MDE-CEN', 55.0, 50.0, 65.0, 48.0, 35.0, 50.6, 'ALTO',    '2026-04-11'),
  ('ZONA',      2, 'MDE-POB', 90.0, 88.0, 85.0, 82.0, 92.0, 87.4, 'BAJO',    '2026-04-11'),
  ('ZONA',      8, 'CAL-SIL', 30.0, 25.0, 35.0, 20.0, 15.0, 25.0, 'CRITICO', '2026-04-11'),
  ('ZONA',      9, 'CAL-PAN', 75.0, 70.0, 60.0, 65.0, 80.0, 70.0, 'MEDIO',   '2026-04-11')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 37. INCIDENCIAS_SOCIALES (incidencias territoriales)
-- ============================================================
INSERT INTO public.incidencias_sociales (tipo_incidencia, descripcion, tipo_zona, referencia_id, codigo_zona, latitud, longitud, nivel_riesgo, prioridad, estado, fecha_reporte, responsable, fuente_reporte, usuario_registro) VALUES
  ('INSEGURIDAD_ALIMENTARIA', 'Familias de estrato 1 sin acceso a alimentos frescos por 5+ días',        'ZONA', 1, 'MDE-CEN', 6.244000, -75.565000, 'CRITICO', 'CRITICA', 'EN_GESTION',  '2026-04-10 08:00:00+00', 'María López',     'community_leader', 'admin@medellin.gov.co'),
  ('DESABASTECIMIENTO',       'Comedor comunitario Centro sin suministro de frutas hace 3 días',          'ZONA', 1, 'MDE-CEN', 6.244000, -75.565000, 'ALTO',    'ALTA',    'PRIORIZADA',  '2026-04-09 10:00:00+00', 'María López',     'institution',      'admin@medellin.gov.co'),
  ('BLOQUEO_VIAL',            'Protesta social bloquea acceso a zona norte, afecta distribución',         'ZONA', 1, 'MDE-NOR', 6.290000, -75.560000, 'CRITICO', 'CRITICA', 'REPORTADA',   '2026-04-11 10:00:00+00', 'Carlos Restrepo', 'citizen',          'admin@medellin.gov.co'),
  ('DESNUTRICION_INFANTIL',   '15 niños con desnutrición aguda detectados en jornada de salud Siloé',     'ZONA', 8, 'CAL-SIL', 3.420000, -76.555000, 'CRITICO', 'CRITICA', 'EN_ANALISIS',  '2026-04-08 14:00:00+00', 'Jorge Mina',      'health_service',   'admin@cali.gov.co'),
  ('PERDIDA_PRODUCTO',        'Pérdida de 40kg plátano por cadena de frío en transporte',                 'ZONA', 8, 'CAL-SIL', 3.430000, -76.545000, 'ALTO',    'ALTA',    'INTERVENIDA', '2026-04-13 08:00:00+00', 'Roberto Caicedo', 'logistics',        'admin@cali.gov.co'),
  ('CONTAMINACION_AGUA',      'Reporte de agua no potable en sector que abastece comedor escolar',         'ZONA', 6, 'ENV-ZUN', 6.170000, -75.582000, 'MEDIO',   'MEDIA',   'EN_ANALISIS',  '2026-04-07 09:00:00+00', 'Sandra Ríos',     'citizen',          'admin@envigado.gov.co')
;

-- ============================================================
-- 38. BENEFICIARIOS_ZONA (cobertura por zona)
-- ============================================================
INSERT INTO public.beneficiarios_zona (tipo_zona, referencia_id, codigo_zona, programa, beneficiarios_total, ninos, adultos_mayores, mujeres_gestantes, poblacion_discapacidad, fecha_corte) VALUES
  ('ZONA', 1, 'MDE-CEN', 'comedor_comunitario', 350,  80,  120, 15, 10, '2026-04-11'),
  ('ZONA', 1, 'MDE-CEN', 'ayuda_humanitaria',   200,  50,   30, 20,  5, '2026-04-11'),
  ('ZONA', 2, 'MDE-POB', 'comedor_comunitario',  90,  20,   35,  5,  3, '2026-04-11'),
  ('ZONA', 3, 'MDE-LAU', 'programa_escolar',    350, 350,    0,  0,  8, '2026-04-11'),
  ('ZONA', 8, 'CAL-SIL', 'comedor_comunitario', 250,  60,   80, 25, 12, '2026-04-11'),
  ('ZONA', 8, 'CAL-SIL', 'ayuda_humanitaria',   500, 150,   50, 40, 20, '2026-04-11'),
  ('ZONA', 6, 'ENV-ZUN', 'programa_escolar',    200, 200,    0,  0,  5, '2026-04-11'),
  ('MUNICIPIO', 1, 'MDE', 'todos',             3800, 900,  800, 120, 80, '2026-04-11'),
  ('MUNICIPIO', 7, 'CAL', 'todos',             2800, 650,  500, 100, 55, '2026-04-11'),
  ('MUNICIPIO', 2, 'ENV', 'todos',             2500, 600,  400,  60, 30, '2026-04-11')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 39. PRODUCTOS_PROXIMOS_VENCER (supermercados aliados)
-- ============================================================
-- Primero asegurar que hay supermercados
INSERT INTO public.supermercados (nit, nombre, direccion, telefono, email, responsable, municipio_id, latitud, longitud, estado)
SELECT '800123456-1', 'Exito Colombia Medellin',    'Cra 48 #45-30, Medellin',    '+57460012345', 'donaciones@exito.com.co',   'Carlos Palma',   id, 6.2460, -75.5640, 'ACTIVO' FROM municipio WHERE nombre ILIKE '%medell%'
ON CONFLICT DO NOTHING;

INSERT INTO public.supermercados (nit, nombre, direccion, telefono, email, responsable, municipio_id, latitud, longitud, estado)
SELECT '800234567-2', 'La 14 Cali',                 'Av 6N #25-50, Cali',         '+57260023456', 'responsabilidad@la14.com',  'Martha Gomez',   id, 3.4370, -76.5320, 'ACTIVO' FROM municipio WHERE nombre ILIKE '%cali%'
ON CONFLICT DO NOTHING;

INSERT INTO public.supermercados (nit, nombre, direccion, telefono, email, responsable, municipio_id, latitud, longitud, estado)
SELECT '800345678-3', 'D1 Envigado Centro',         'Calle 37 Sur #41-10, Envigado','+57460034567', 'd1envigado@d1.com.co',    'Pedro Salazar',  id, 6.1710, -75.5770, 'ACTIVO' FROM municipio WHERE nombre ILIKE '%envigado%'
ON CONFLICT DO NOTHING;

-- Productos próximos a vencer
INSERT INTO public.productos_proximos_vencer (supermercado_id, nombre_producto, categoria_producto, cantidad, fecha_vencimiento, unidad_medida, peso_estimado_kg, prioridad_rescate, estado_rescate)
SELECT s.id, p.nombre_producto, p.categoria, p.cantidad, p.fecha_vencimiento, p.unidad, p.peso, p.prioridad, p.estado
FROM public.supermercados s
CROSS JOIN (VALUES
  ('Yogurt natural x 1L',     'lacteos',     120, '2026-04-13'::DATE, 'unidades', 120.00, 'ALTA',    'REPORTADO'),
  ('Leche entera x 900ml',    'lacteos',     80,  '2026-04-14'::DATE, 'unidades', 72.00,  'MEDIA',   'REPORTADO'),
  ('Pan tajado integral',     'panaderia',   50,  '2026-04-12'::DATE, 'unidades', 25.00,  'CRITICA', 'EN_EVALUACION'),
  ('Queso campesino 500g',    'lacteos',     35,  '2026-04-15'::DATE, 'unidades', 17.50,  'MEDIA',   'REPORTADO'),
  ('Jugo naranja natural 1L', 'bebidas',     60,  '2026-04-13'::DATE, 'unidades', 60.00,  'ALTA',    'RESCATADO')
) AS p(nombre_producto, categoria, cantidad, fecha_vencimiento, unidad, peso, prioridad, estado)
WHERE s.nombre = 'Exito Colombia Medellin';

INSERT INTO public.productos_proximos_vencer (supermercado_id, nombre_producto, categoria_producto, cantidad, fecha_vencimiento, unidad_medida, peso_estimado_kg, prioridad_rescate, estado_rescate)
SELECT s.id, p.nombre_producto, p.categoria, p.cantidad, p.fecha_vencimiento, p.unidad, p.peso, p.prioridad, p.estado
FROM public.supermercados s
CROSS JOIN (VALUES
  ('Platano maduro empacado',  'frutas',     200, '2026-04-12'::DATE, 'unidades', 100.00, 'CRITICA', 'RESCATADO'),
  ('Mango Tommy empacado',    'frutas',     90,  '2026-04-14'::DATE, 'unidades', 45.00,  'ALTA',    'EN_EVALUACION'),
  ('Pollo entero refrigerado','carnes',     40,  '2026-04-13'::DATE, 'unidades', 60.00,  'ALTA',    'REPORTADO'),
  ('Arroz integral x 500g',   'granos',     150, '2026-04-30'::DATE, 'unidades', 75.00,  'BAJA',    'REPORTADO')
) AS p(nombre_producto, categoria, cantidad, fecha_vencimiento, unidad, peso, prioridad, estado)
WHERE s.nombre = 'La 14 Cali';

INSERT INTO public.productos_proximos_vencer (supermercado_id, nombre_producto, categoria_producto, cantidad, fecha_vencimiento, unidad_medida, peso_estimado_kg, prioridad_rescate, estado_rescate)
SELECT s.id, p.nombre_producto, p.categoria, p.cantidad, p.fecha_vencimiento, p.unidad, p.peso, p.prioridad, p.estado
FROM public.supermercados s
CROSS JOIN (VALUES
  ('Huevos AA x 30',         'huevos',     45,  '2026-04-18'::DATE, 'unidades', 54.00,  'MEDIA',   'REPORTADO'),
  ('Salchicha premium 500g', 'embutidos',  25,  '2026-04-14'::DATE, 'unidades', 12.50,  'ALTA',    'EN_EVALUACION')
) AS p(nombre_producto, categoria, cantidad, fecha_vencimiento, unidad, peso, prioridad, estado)
WHERE s.nombre = 'D1 Envigado Centro';

-- ============================================================
-- FIN DE CARGA INTEGRAL
-- ============================================================

COMMIT;

-- ============================================================
-- VERIFICACIÓN: Conteos por tabla
-- ============================================================
SELECT 'tenants' AS tabla, COUNT(*) AS registros FROM public.tenants
UNION ALL SELECT 'users', COUNT(*) FROM public.users
UNION ALL SELECT 'producers', COUNT(*) FROM public.producers
UNION ALL SELECT 'offers', COUNT(*) FROM public.offers
UNION ALL SELECT 'demands', COUNT(*) FROM public.demands
UNION ALL SELECT 'rescues', COUNT(*) FROM public.rescues
UNION ALL SELECT 'inventory_items', COUNT(*) FROM public.inventory_items
UNION ALL SELECT 'recursos', COUNT(*) FROM public.recursos
UNION ALL SELECT 'logistics_orders', COUNT(*) FROM public.logistics_orders
UNION ALL SELECT 'incidents', COUNT(*) FROM public.incidents
UNION ALL SELECT 'incident_actions', COUNT(*) FROM public.incident_actions
UNION ALL SELECT 'incident_alerts', COUNT(*) FROM public.incident_alerts
UNION ALL SELECT 'notifications', COUNT(*) FROM public.notifications
UNION ALL SELECT 'automation_runs', COUNT(*) FROM public.automation_runs
UNION ALL SELECT 'allocation_scenarios', COUNT(*) FROM public.allocation_scenarios
UNION ALL SELECT 'food_programs', COUNT(*) FROM public.food_programs
UNION ALL SELECT 'beneficiaries', COUNT(*) FROM public.beneficiaries
UNION ALL SELECT 'program_deliveries', COUNT(*) FROM public.program_deliveries
UNION ALL SELECT 'coordination_tasks', COUNT(*) FROM public.coordination_tasks
UNION ALL SELECT 'institutional_alerts', COUNT(*) FROM public.institutional_alerts
UNION ALL SELECT 'alert_thresholds', COUNT(*) FROM public.alert_thresholds
UNION ALL SELECT 'auctions', COUNT(*) FROM public.auctions
UNION ALL SELECT 'auction_bids', COUNT(*) FROM public.auction_bids
UNION ALL SELECT 'auction_audit_log', COUNT(*) FROM public.auction_audit_log
UNION ALL SELECT 'route_plans', COUNT(*) FROM public.route_plans
UNION ALL SELECT 'route_stops', COUNT(*) FROM public.route_stops
UNION ALL SELECT 'vrp_solutions', COUNT(*) FROM public.vrp_solutions
UNION ALL SELECT 'vrp_vehicle_routes', COUNT(*) FROM public.vrp_vehicle_routes
UNION ALL SELECT 'tracking_historial', COUNT(*) FROM public.tracking_historial
UNION ALL SELECT 'tracking_actual', COUNT(*) FROM public.tracking_actual
UNION ALL SELECT 'delivery_events', COUNT(*) FROM public.delivery_events
UNION ALL SELECT 'geofence_zones', COUNT(*) FROM public.geofence_zones
UNION ALL SELECT 'geofence_events', COUNT(*) FROM public.geofence_events
UNION ALL SELECT 'spoilage_records', COUNT(*) FROM public.spoilage_records
UNION ALL SELECT 'audit_log', COUNT(*) FROM public.audit_log
UNION ALL SELECT 'irat_zonas', COUNT(*) FROM public.irat_zonas
UNION ALL SELECT 'incidencias_sociales', COUNT(*) FROM public.incidencias_sociales
UNION ALL SELECT 'beneficiarios_zona', COUNT(*) FROM public.beneficiarios_zona
UNION ALL SELECT 'supermercados', COUNT(*) FROM public.supermercados
UNION ALL SELECT 'productos_proximos_vencer', COUNT(*) FROM public.productos_proximos_vencer
ORDER BY tabla;
