-- ============================================================
-- 033_ley2046_compliance.sql
-- Cumplimiento Ley 2046 de 2020: al menos el 30% del valor de
-- compras de alimentos con recursos publicos debe ser directo a
-- pequenos productores u organizaciones campesinas del territorio.
-- ============================================================

-- ── Clasificacion de productor requerida para calcular el numerador ──
-- Los productores registrados en AgroRed son, por perfil de la plataforma,
-- pequenos productores rurales; se marca TRUE por defecto y queda editable
-- para las excepciones reales (asociaciones/proveedores de mayor escala).
ALTER TABLE public.producers
  ADD COLUMN IF NOT EXISTS is_small_producer BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.producers.is_small_producer IS
  'Clasificacion para Ley 2046/2020: TRUE si cuenta como "pequeno productor u '
  'organizacion campesina del territorio" para efectos del 30% de compra local '
  'obligatoria de entidades publicas.';

-- ── Fix real: las alertas institucionales nunca enviaban correo ──
-- notifyTenantAdmins() inserta en notifications sin incident_id/logistics_order_id/
-- offer_id, lo que siempre violaba chk_notifications_reference_present (el INSERT
-- fallaba y quedaba silenciado por un catch vacio). Se agrega una referencia valida
-- para alertas institucionales (incluyendo las nuevas de Ley 2046) y se amplia el
-- CHECK para aceptarla.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS institutional_alert_id UUID NULL
    REFERENCES public.institutional_alerts(id);

CREATE INDEX IF NOT EXISTS idx_public_notifications_institutional_alert_id
  ON public.notifications (institutional_alert_id);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS chk_notifications_reference_present;
ALTER TABLE public.notifications ADD CONSTRAINT chk_notifications_reference_present
  CHECK (
    incident_id IS NOT NULL
    OR logistics_order_id IS NOT NULL
    OR offer_id IS NOT NULL
    OR institutional_alert_id IS NOT NULL
  );
