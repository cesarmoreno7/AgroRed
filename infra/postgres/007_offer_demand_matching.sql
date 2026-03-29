-- 007: Soporte de notificaciones vinculadas a ofertas (matching oferta-demanda)
-- Permite que el sistema automatizado notifique a comedores y PAE cuando una oferta coincide con sus demandas

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS offer_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_public_notifications_offer_id ON public.notifications(offer_id);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS chk_notifications_reference_present;
ALTER TABLE public.notifications ADD CONSTRAINT chk_notifications_reference_present
  CHECK (incident_id IS NOT NULL OR logistics_order_id IS NOT NULL OR offer_id IS NOT NULL);
