DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'postgis') THEN
    CREATE EXTENSION IF NOT EXISTS postgis;
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'municipio',
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NULL REFERENCES public.tenants(id),
  service_name VARCHAR(120) NOT NULL,
  entity_name VARCHAR(120) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  action_name VARCHAR(80) NOT NULL,
  actor_id VARCHAR(120) NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tenants IS 'Base de multitenancy por municipio/departamento para AGRORED.';
COMMENT ON TABLE public.audit_log IS 'Registro transversal de auditoria para eventos criticos del ecosistema.';

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_public_users_tenant_id ON public.users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_users_role ON public.users (role);

CREATE TABLE IF NOT EXISTS public.producers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NULL,
  producer_type VARCHAR(30) NOT NULL,
  organization_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(30) NOT NULL,
  municipality_name VARCHAR(150) NOT NULL,
  zone_type VARCHAR(20) NOT NULL DEFAULT 'rural',
  product_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(30) NOT NULL DEFAULT 'pending_verification',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_public_producers_tenant_id ON public.producers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_producers_user_id ON public.producers (user_id);
CREATE INDEX IF NOT EXISTS idx_public_producers_status ON public.producers (status);
CREATE INDEX IF NOT EXISTS idx_public_producers_type ON public.producers (producer_type);

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  producer_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity_available NUMERIC(12,2) NOT NULL,
  price_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'COP',
  available_from TIMESTAMPTZ NOT NULL,
  available_until TIMESTAMPTZ NULL,
  municipality_name VARCHAR(150) NOT NULL,
  notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'published',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_offer_quantity_positive CHECK (quantity_available > 0),
  CONSTRAINT chk_offer_price_nonnegative CHECK (price_amount >= 0),
  CONSTRAINT chk_offer_availability_window CHECK (available_until IS NULL OR available_until >= available_from)
);

CREATE INDEX IF NOT EXISTS idx_public_offers_tenant_id ON public.offers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_offers_producer_id ON public.offers (producer_id);
CREATE INDEX IF NOT EXISTS idx_public_offers_status ON public.offers (status);
CREATE INDEX IF NOT EXISTS idx_public_offers_available_from ON public.offers (available_from);

CREATE TABLE IF NOT EXISTS public.rescues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  producer_id UUID NOT NULL,
  offer_id UUID NULL,
  rescue_channel VARCHAR(40) NOT NULL,
  destination_organization_name VARCHAR(255) NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity_rescued NUMERIC(12,2) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  beneficiary_count INTEGER NOT NULL,
  municipality_name VARCHAR(150) NOT NULL,
  notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_rescue_quantity_positive CHECK (quantity_rescued > 0),
  CONSTRAINT chk_rescue_beneficiary_count_positive CHECK (beneficiary_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_public_rescues_tenant_id ON public.rescues (tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_rescues_producer_id ON public.rescues (producer_id);
CREATE INDEX IF NOT EXISTS idx_public_rescues_offer_id ON public.rescues (offer_id);
CREATE INDEX IF NOT EXISTS idx_public_rescues_status ON public.rescues (status);
CREATE INDEX IF NOT EXISTS idx_public_rescues_scheduled_at ON public.rescues (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_public_rescues_channel ON public.rescues (rescue_channel);
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  producer_id UUID NOT NULL,
  offer_id UUID NULL,
  rescue_id UUID NULL,
  source_type VARCHAR(40) NOT NULL,
  storage_location_name VARCHAR(255) NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity_on_hand NUMERIC(12,2) NOT NULL,
  quantity_reserved NUMERIC(12,2) NOT NULL DEFAULT 0,
  municipality_name VARCHAR(150) NOT NULL,
  notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'available',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_inventory_quantity_positive CHECK (quantity_on_hand > 0),
  CONSTRAINT chk_inventory_reserved_nonnegative CHECK (quantity_reserved >= 0),
  CONSTRAINT chk_inventory_reserved_within_stock CHECK (quantity_reserved <= quantity_on_hand)
);

CREATE INDEX IF NOT EXISTS idx_public_inventory_items_tenant_id ON public.inventory_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_inventory_items_producer_id ON public.inventory_items (producer_id);
CREATE INDEX IF NOT EXISTS idx_public_inventory_items_offer_id ON public.inventory_items (offer_id);
CREATE INDEX IF NOT EXISTS idx_public_inventory_items_rescue_id ON public.inventory_items (rescue_id);
CREATE INDEX IF NOT EXISTS idx_public_inventory_items_status ON public.inventory_items (status);
CREATE INDEX IF NOT EXISTS idx_public_inventory_items_source_type ON public.inventory_items (source_type);
CREATE TABLE IF NOT EXISTS public.logistics_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  inventory_item_id UUID NOT NULL,
  demand_id UUID NULL,
  route_mode VARCHAR(40) NOT NULL,
  origin_location_name VARCHAR(255) NOT NULL,
  destination_organization_name VARCHAR(255) NOT NULL,
  destination_address VARCHAR(255) NOT NULL,
  scheduled_pickup_at TIMESTAMPTZ NOT NULL,
  scheduled_delivery_at TIMESTAMPTZ NOT NULL,
  quantity_assigned NUMERIC(12,2) NOT NULL,
  municipality_name VARCHAR(150) NOT NULL,
  notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_logistics_quantity_positive CHECK (quantity_assigned > 0),
  CONSTRAINT chk_logistics_schedule_window CHECK (scheduled_delivery_at >= scheduled_pickup_at)
);

CREATE INDEX IF NOT EXISTS idx_public_logistics_orders_tenant_id ON public.logistics_orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_logistics_orders_inventory_item_id ON public.logistics_orders (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_public_logistics_orders_demand_id ON public.logistics_orders (demand_id);
CREATE INDEX IF NOT EXISTS idx_public_logistics_orders_status ON public.logistics_orders (status);
CREATE INDEX IF NOT EXISTS idx_public_logistics_orders_scheduled_delivery_at ON public.logistics_orders (scheduled_delivery_at);
CREATE INDEX IF NOT EXISTS idx_public_logistics_orders_route_mode ON public.logistics_orders (route_mode);
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  logistics_order_id UUID NULL,
  incident_type VARCHAR(40) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location_description VARCHAR(255) NOT NULL,
  latitude NUMERIC(9,6) NULL,
  longitude NUMERIC(9,6) NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  municipality_name VARCHAR(150) NOT NULL,
  notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_incident_coordinates_pair CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
  CONSTRAINT chk_incident_latitude_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT chk_incident_longitude_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

CREATE INDEX IF NOT EXISTS idx_public_incidents_tenant_id ON public.incidents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_incidents_logistics_order_id ON public.incidents (logistics_order_id);
CREATE INDEX IF NOT EXISTS idx_public_incidents_type ON public.incidents (incident_type);
CREATE INDEX IF NOT EXISTS idx_public_incidents_severity ON public.incidents (severity);
CREATE INDEX IF NOT EXISTS idx_public_incidents_status ON public.incidents (status);
CREATE INDEX IF NOT EXISTS idx_public_incidents_occurred_at ON public.incidents (occurred_at);
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  incident_id UUID NULL,
  logistics_order_id UUID NULL,
  notification_channel VARCHAR(30) NOT NULL,
  recipient_label VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_notifications_reference_present CHECK (incident_id IS NOT NULL OR logistics_order_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_public_notifications_tenant_id ON public.notifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_notifications_incident_id ON public.notifications (incident_id);
CREATE INDEX IF NOT EXISTS idx_public_notifications_logistics_order_id ON public.notifications (logistics_order_id);
CREATE INDEX IF NOT EXISTS idx_public_notifications_channel ON public.notifications (notification_channel);
CREATE INDEX IF NOT EXISTS idx_public_notifications_status ON public.notifications (status);
CREATE INDEX IF NOT EXISTS idx_public_notifications_scheduled_for ON public.notifications (scheduled_for);
CREATE TABLE IF NOT EXISTS public.demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  responsible_user_id UUID NULL,
  demand_channel VARCHAR(40) NOT NULL,
  organization_name VARCHAR(255) NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity_required NUMERIC(12,2) NOT NULL,
  needed_by TIMESTAMPTZ NOT NULL,
  beneficiary_count INTEGER NOT NULL,
  municipality_name VARCHAR(150) NOT NULL,
  notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_demand_quantity_positive CHECK (quantity_required > 0),
  CONSTRAINT chk_demand_beneficiary_count_positive CHECK (beneficiary_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_public_demands_tenant_id ON public.demands (tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_demands_responsible_user_id ON public.demands (responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_public_demands_status ON public.demands (status);
CREATE INDEX IF NOT EXISTS idx_public_demands_needed_by ON public.demands (needed_by);
CREATE INDEX IF NOT EXISTS idx_public_demands_channel ON public.demands (demand_channel);
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  incident_id UUID NULL,
  logistics_order_id UUID NULL,
  trigger_source VARCHAR(40) NOT NULL,
  model_version VARCHAR(40) NOT NULL DEFAULT 'heuristic-v1',
  classification VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'generated',
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_public_automation_runs_tenant_id ON public.automation_runs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_automation_runs_incident_id ON public.automation_runs (incident_id);
CREATE INDEX IF NOT EXISTS idx_public_automation_runs_logistics_order_id ON public.automation_runs (logistics_order_id);
CREATE INDEX IF NOT EXISTS idx_public_automation_runs_status ON public.automation_runs (status);
CREATE INDEX IF NOT EXISTS idx_public_automation_runs_trigger_source ON public.automation_runs (trigger_source);

COMMENT ON TABLE public.users IS 'Usuarios y actores autenticados del ecosistema AGRORED.';
COMMENT ON TABLE public.producers IS 'Registro de productores rurales y asociaciones vinculadas al municipio.';
COMMENT ON TABLE public.offers IS 'Publicaciones de oferta alimentaria vinculadas a productores por municipio.';
COMMENT ON TABLE public.rescues IS 'Operaciones de rescate y redistribucion de excedentes alimentarios.';
COMMENT ON TABLE public.inventory_items IS 'Stock operativo trazable a ofertas y rescates del municipio.';
COMMENT ON TABLE public.logistics_orders IS 'Operaciones logisticas de recogida, entrega y seguimiento territorial.';
COMMENT ON TABLE public.incidents IS 'Incidencias territoriales y operativas vinculadas al abastecimiento y la entrega.';
COMMENT ON TABLE public.notifications IS 'Alertas operativas y transaccionales persistidas para el ecosistema.';
COMMENT ON TABLE public.demands IS 'Demandas institucionales y comunitarias de abastecimiento alimentario.';
COMMENT ON TABLE public.automation_runs IS 'Corridas de automatizacion operativa y orquestacion local persistidas por municipio.';

INSERT INTO public.tenants (id, code, name, type, status, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MUNICIPIO_PILOTO',
  'Municipio Piloto AGRORED',
  'municipio',
  'active',
  '{"scope":"bootstrap"}'::jsonb
)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
