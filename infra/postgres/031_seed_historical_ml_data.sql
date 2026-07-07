-- ============================================================
-- 031_seed_historical_ml_data.sql
-- Carga 14 meses de datos históricos sintéticos (Jun 2025 –
-- Jul 2026) para entrenamiento de modelos ML.
-- Cubre: ofertas, rescates y entregas con detalle de productos.
-- Idempotente: ON CONFLICT DO NOTHING en todos los inserts.
-- ============================================================

DO $$
DECLARE
  v_tenant_id   UUID;
  v_prod_id     UUID;
  v_inst_id     UUID;
  v_product_id  UUID;
  v_month       DATE;
  v_offer_id    UUID;
  v_rescue_id   UUID;
  v_entrega_id  UUID;
  v_qty         NUMERIC;
  v_price       NUMERIC;
  v_counter     INTEGER := 0;
  v_ent_num     VARCHAR(25);
  i             INTEGER;
BEGIN
  -- ── Tenant ──────────────────────────────────────────────
  SELECT id INTO v_tenant_id FROM public.tenants ORDER BY created_at LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE '⚠ No hay tenants — abortando seed ML.';
    RETURN;
  END IF;

  -- ── Productor (tomar o crear) ────────────────────────────
  SELECT id INTO v_prod_id
    FROM public.producers
   WHERE tenant_id = v_tenant_id AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;

  IF v_prod_id IS NULL THEN
    v_prod_id := gen_random_uuid();
    INSERT INTO public.producers
      (id, tenant_id, producer_type, organization_name, contact_name,
       contact_phone, municipality_name, status)
    VALUES
      (v_prod_id, v_tenant_id, 'individual', 'Productor Histórico ML',
       'Contacto ML', '3001234500', 'Bogotá', 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ── Institución (tomar o crear) ──────────────────────────
  SELECT id INTO v_inst_id
    FROM public.institutions
   WHERE tenant_id = v_tenant_id AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;

  IF v_inst_id IS NULL THEN
    v_inst_id := gen_random_uuid();
    INSERT INTO public.institutions
      (id, tenant_id, institution_type, name, contact_name,
       contact_phone, municipality_name, beneficiary_count, status)
    VALUES
      (v_inst_id, v_tenant_id, 'educational', 'Institución Histórica ML',
       'Rector ML', '3009876500', 'Bogotá', 800, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ── Producto del catálogo (tomar o crear) ────────────────
  SELECT id INTO v_product_id
    FROM public.product_catalog
   WHERE is_active = TRUE
   ORDER BY created_at LIMIT 1;

  IF v_product_id IS NULL THEN
    v_product_id := gen_random_uuid();
    INSERT INTO public.product_catalog
      (id, tenant_id, name, category, unit, is_active)
    VALUES
      (v_product_id, v_tenant_id, 'Papa Criolla ML', 'tuberculo', 'kg', TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  -- ── Generar datos mes a mes ──────────────────────────────
  FOR v_month IN
    SELECT generate_series(
      '2025-06-01'::DATE,
      '2026-07-01'::DATE,
      '1 month'::INTERVAL
    )::DATE
  LOOP
    -- ── Ofertas: 3–8 por mes ────────────────────────────────
    FOR i IN 1 .. (3 + (EXTRACT(MONTH FROM v_month)::INT % 6)) LOOP
      v_offer_id := gen_random_uuid();
      v_qty      := ROUND((200 + random() * 800)::NUMERIC, 2);
      v_price    := ROUND((800 + random() * 1200)::NUMERIC, 2);

      INSERT INTO public.offers
        (id, tenant_id, producer_id, title, product_name, category, unit,
         quantity_available, price_amount, currency, available_from,
         municipality_name, status, created_at)
      VALUES
        (v_offer_id, v_tenant_id, v_prod_id,
         'Oferta ML ' || TO_CHAR(v_month, 'YYYY-MM') || '-' || i,
         'Papa Criolla', 'tuberculo', 'kg',
         v_qty, v_price, 'COP',
         v_month + ((random() * 24)::INT || ' days')::INTERVAL,
         'Bogotá',
         CASE WHEN random() > 0.2 THEN 'fulfilled' ELSE 'published' END,
         v_month + ((random() * 24)::INT || ' days')::INTERVAL)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;

    -- ── Rescates: 2–5 por mes ───────────────────────────────
    FOR i IN 1 .. (2 + (EXTRACT(MONTH FROM v_month)::INT % 4)) LOOP
      v_rescue_id := gen_random_uuid();
      v_qty       := ROUND((50 + random() * 300)::NUMERIC, 2);

      INSERT INTO public.rescues
        (id, tenant_id, producer_id, rescue_channel,
         destination_organization_name, product_name, category, unit,
         quantity_rescued, scheduled_at, beneficiary_count,
         municipality_name, status, created_at)
      VALUES
        (v_rescue_id, v_tenant_id, v_prod_id,
         'redistribucion', 'Institución Educativa Central',
         'Papa Criolla', 'tuberculo', 'kg',
         v_qty,
         v_month + ((random() * 24)::INT || ' days')::INTERVAL,
         (100 + (random() * 400)::INT),
         'Bogotá',
         CASE WHEN random() > 0.15 THEN 'completed' ELSE 'scheduled' END,
         v_month + ((random() * 24)::INT || ' days')::INTERVAL)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;

    -- ── Entregas: 2–4 por mes ───────────────────────────────
    FOR i IN 1 .. (2 + (EXTRACT(MONTH FROM v_month)::INT % 3)) LOOP
      v_entrega_id := gen_random_uuid();
      v_qty        := ROUND((100 + random() * 400)::NUMERIC, 3);
      v_price      := ROUND((900 + random() * 1100)::NUMERIC, 2);
      v_counter    := v_counter + 1;
      v_ent_num    := 'ENT-' || TO_CHAR(v_month, 'YYYY') || '-' ||
                      LPAD(v_counter::TEXT, 4, '0');

      INSERT INTO public.entregas_productos
        (id, numero_entrega, productor_id, institucion_id,
         fecha_entrega, lugar_entrega, recibido_por,
         estado, created_at)
      VALUES
        (v_entrega_id, v_ent_num, v_prod_id, v_inst_id,
         v_month + ((random() * 24)::INT || ' days')::INTERVAL,
         'Bodega Central Bogotá',
         'Coordinador Logístico',
         CASE WHEN random() > 0.1 THEN 'recibido' ELSE 'pendiente' END,
         v_month + ((random() * 24)::INT || ' days')::INTERVAL)
      ON CONFLICT (numero_entrega) DO NOTHING
      RETURNING id INTO v_entrega_id;

      -- Si numero_entrega ya existía, la fila se saltó y v_entrega_id quedó en
      -- NULL: recuperar el id real para no violar la FK del detalle.
      IF v_entrega_id IS NULL THEN
        SELECT id INTO v_entrega_id
        FROM public.entregas_productos
        WHERE numero_entrega = v_ent_num;
      END IF;

      -- Línea de detalle
      INSERT INTO public.entregas_detalle
        (id, entrega_id, producto_id,
         cantidad_entregada, unidad_medida, precio_unitario)
      VALUES
        (gen_random_uuid(), v_entrega_id, v_product_id,
         v_qty, 'kg', v_price)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;

  END LOOP;

  RAISE NOTICE '✅ Seed ML completado: 14 meses de ofertas, rescates y entregas (Jun 2025 → Jul 2026). Entregas generadas: %', v_counter;
END $$;
