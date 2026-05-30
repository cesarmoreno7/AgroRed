-- 005_add_foreign_keys.sql
-- Adds referential integrity constraints to all entity tables.
-- Uses NOT VALID to skip validation of pre-existing rows (safe for dev DB
-- with legacy data). New inserts/updates are still enforced immediately.
-- Each block is idempotent: duplicate_object errors are silently ignored.

DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT fk_users_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.producers ADD CONSTRAINT fk_producers_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.producers ADD CONSTRAINT fk_producers_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.offers ADD CONSTRAINT fk_offers_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.offers ADD CONSTRAINT fk_offers_producer
    FOREIGN KEY (producer_id) REFERENCES public.producers(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rescues ADD CONSTRAINT fk_rescues_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rescues ADD CONSTRAINT fk_rescues_producer
    FOREIGN KEY (producer_id) REFERENCES public.producers(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rescues ADD CONSTRAINT fk_rescues_offer
    FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.demands ADD CONSTRAINT fk_demands_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.demands ADD CONSTRAINT fk_demands_responsible_user
    FOREIGN KEY (responsible_user_id) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory_items ADD CONSTRAINT fk_inventory_items_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory_items ADD CONSTRAINT fk_inventory_items_producer
    FOREIGN KEY (producer_id) REFERENCES public.producers(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory_items ADD CONSTRAINT fk_inventory_items_offer
    FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory_items ADD CONSTRAINT fk_inventory_items_rescue
    FOREIGN KEY (rescue_id) REFERENCES public.rescues(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.logistics_orders ADD CONSTRAINT fk_logistics_orders_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.logistics_orders ADD CONSTRAINT fk_logistics_orders_inventory_item
    FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.logistics_orders ADD CONSTRAINT fk_logistics_orders_demand
    FOREIGN KEY (demand_id) REFERENCES public.demands(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.incidents ADD CONSTRAINT fk_incidents_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.incidents ADD CONSTRAINT fk_incidents_logistics_order
    FOREIGN KEY (logistics_order_id) REFERENCES public.logistics_orders(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT fk_notifications_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT fk_notifications_incident
    FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT fk_notifications_logistics_order
    FOREIGN KEY (logistics_order_id) REFERENCES public.logistics_orders(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.automation_runs ADD CONSTRAINT fk_automation_runs_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.automation_runs ADD CONSTRAINT fk_automation_runs_incident
    FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.automation_runs ADD CONSTRAINT fk_automation_runs_logistics_order
    FOREIGN KEY (logistics_order_id) REFERENCES public.logistics_orders(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
