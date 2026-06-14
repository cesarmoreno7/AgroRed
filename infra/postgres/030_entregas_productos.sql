-- ============================================================
-- 030_entregas_productos.sql
-- Módulo de registro de entregas de productos del productor
-- a la entidad compradora (institución).
-- ============================================================

-- ── Tabla cabecera ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.entregas_productos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_entrega    VARCHAR(25)  NOT NULL UNIQUE,          -- ENT-YYYY-NNNN
  productor_id      UUID         NOT NULL REFERENCES public.producers(id),
  institucion_id    UUID         NOT NULL REFERENCES public.institutions(id),
  fecha_entrega     DATE         NOT NULL DEFAULT CURRENT_DATE,
  hora_entrega      TIME,
  lugar_entrega     VARCHAR(200),
  recibido_por      VARCHAR(150),
  documento_soporte VARCHAR(200),
  observaciones     TEXT,
  estado            VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','recibido','parcial','rechazado')),
  creado_por        UUID         REFERENCES public.users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_entregas_productor  ON public.entregas_productos(productor_id);
CREATE INDEX IF NOT EXISTS idx_entregas_institucion ON public.entregas_productos(institucion_id);
CREATE INDEX IF NOT EXISTS idx_entregas_fecha       ON public.entregas_productos(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_entregas_estado      ON public.entregas_productos(estado);

-- ── Tabla detalle ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.entregas_detalle (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id          UUID         NOT NULL REFERENCES public.entregas_productos(id) ON DELETE CASCADE,
  producto_id         UUID         NOT NULL REFERENCES public.product_catalog(id),
  cantidad_entregada  NUMERIC(12,3) NOT NULL CHECK (cantidad_entregada > 0),
  unidad_medida       VARCHAR(30)  NOT NULL DEFAULT 'kg',
  precio_unitario     NUMERIC(14,2),
  lote                VARCHAR(50),
  fecha_vencimiento   DATE,
  observacion         TEXT
);

CREATE INDEX IF NOT EXISTS idx_detalle_entrega ON public.entregas_detalle(entrega_id);
CREATE INDEX IF NOT EXISTS idx_detalle_producto ON public.entregas_detalle(producto_id);

-- ── Trigger para actualizar updated_at ────────────────────
CREATE OR REPLACE FUNCTION public.fn_entregas_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entregas_update ON public.entregas_productos;
CREATE TRIGGER trg_entregas_update
  BEFORE UPDATE ON public.entregas_productos
  FOR EACH ROW EXECUTE FUNCTION public.fn_entregas_update_timestamp();
