-- ============================================================
-- 025_seed_fleet_resources.sql
-- Inserta 10 recursos logísticos con posiciones GPS reales
-- en ciudades colombianas para visualización en el mapa.
-- Idempotente: usa ON CONFLICT DO UPDATE.
-- ============================================================

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Tomar el primer tenant disponible
  SELECT id INTO v_tenant_id FROM public.tenants ORDER BY created_at LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No hay tenants en la BD. Abortando seed de flota.';
    RETURN;
  END IF;

  RAISE NOTICE 'Insertando recursos para tenant: %', v_tenant_id;

  -- ── Recursos ──────────────────────────────────────────────────
  INSERT INTO public.recursos (id, tenant_id, nombre, tipo, placa, telefono, estado, latitude, longitude)
  VALUES
    ('a1000001-0000-0000-0000-000000000001', v_tenant_id, 'Camión Furgón Bogotá',        'vehiculo',    'BTA-001', '3001110001', 'en_ruta',    4.6097, -74.0817),
    ('a1000002-0000-0000-0000-000000000002', v_tenant_id, 'Moto Express Medellín',        'moto',        'MED-002', '3002220002', 'en_ruta',    6.2442, -75.5812),
    ('a1000003-0000-0000-0000-000000000003', v_tenant_id, 'Van Refrigerada Cali',         'vehiculo',    'CAL-003', '3003330003', 'en_ruta',    3.4516, -76.5320),
    ('a1000004-0000-0000-0000-000000000004', v_tenant_id, 'Domiciliario Barranquilla',    'domiciliario','BAQ-004', '3004440004', 'en_ruta',   10.9639, -74.7964),
    ('a1000005-0000-0000-0000-000000000005', v_tenant_id, 'Camioneta 4x4 Bucaramanga',    'vehiculo',    'BUC-005', '3005550005', 'en_ruta',    7.1293, -73.1198),
    ('a1000006-0000-0000-0000-000000000006', v_tenant_id, 'Bicicleta Eléctrica Cartagena','bicicleta',   'CTG-006', '3006660006', 'en_ruta',   10.3910, -75.4794),
    ('a1000007-0000-0000-0000-000000000007', v_tenant_id, 'Camión Pesado Manizales',      'vehiculo',    'MAN-007', '3007770007', 'disponible',  5.0703, -75.5138),
    ('a1000008-0000-0000-0000-000000000008', v_tenant_id, 'Moto Delivery Pereira',        'moto',        'PER-008', '3008880008', 'en_ruta',    4.8087, -75.6906),
    ('a1000009-0000-0000-0000-000000000009', v_tenant_id, 'Furgón Frigorífico Cúcuta',    'vehiculo',    'CUC-009', '3009990009', 'en_ruta',    7.8939, -72.5078),
    ('a1000010-0000-0000-0000-000000000010', v_tenant_id, 'Bicicleta Armenia',            'bicicleta',   'ARM-010', '3001010010', 'en_ruta',    4.5339, -75.6811)
  ON CONFLICT (id) DO UPDATE SET
    nombre    = EXCLUDED.nombre,
    tipo      = EXCLUDED.tipo,
    placa     = EXCLUDED.placa,
    telefono  = EXCLUDED.telefono,
    estado    = EXCLUDED.estado,
    latitude  = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    deleted_at = NULL,
    updated_at = NOW();

  -- ── Posiciones actuales (tracking_actual) ─────────────────────
  INSERT INTO public.tracking_actual (recurso_id, latitude, longitude, velocidad, bearing, evento, actualizado_at)
  VALUES
    ('a1000001-0000-0000-0000-000000000001',  4.6097, -74.0817, 48.0, 90.0,  'en_transito', NOW()),
    ('a1000002-0000-0000-0000-000000000002',  6.2442, -75.5812, 35.0, 180.0, 'posicion',    NOW()),
    ('a1000003-0000-0000-0000-000000000003',  3.4516, -76.5320, 42.0, 270.0, 'en_transito', NOW()),
    ('a1000004-0000-0000-0000-000000000004', 10.9639, -74.7964,  8.0, 45.0,  'posicion',    NOW()),
    ('a1000005-0000-0000-0000-000000000005',  7.1293, -73.1198, 55.0, 315.0, 'en_transito', NOW()),
    ('a1000006-0000-0000-0000-000000000006', 10.3910, -75.4794, 18.0, 0.0,   'posicion',    NOW()),
    ('a1000007-0000-0000-0000-000000000007',  5.0703, -75.5138,  0.0, 0.0,   'posicion',    NOW()),
    ('a1000008-0000-0000-0000-000000000008',  4.8087, -75.6906, 30.0, 135.0, 'posicion',    NOW()),
    ('a1000009-0000-0000-0000-000000000009',  7.8939, -72.5078, 60.0, 225.0, 'en_transito', NOW()),
    ('a1000010-0000-0000-0000-000000000010',  4.5339, -75.6811, 22.0, 90.0,  'posicion',    NOW())
  ON CONFLICT (recurso_id) DO UPDATE SET
    latitude     = EXCLUDED.latitude,
    longitude    = EXCLUDED.longitude,
    velocidad    = EXCLUDED.velocidad,
    bearing      = EXCLUDED.bearing,
    evento       = EXCLUDED.evento,
    actualizado_at = NOW();

  RAISE NOTICE '✅ 10 recursos y posiciones insertados/actualizados correctamente.';
END $$;
