-- ==========================================
-- 011: Dynamic Alert Thresholds per Tenant
-- ==========================================
-- Allows each tenant to customize alert
-- trigger thresholds for both institutional
-- and incident alert rules.
-- ==========================================

CREATE TABLE IF NOT EXISTS alert_thresholds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  rule_key    VARCHAR(80) NOT NULL,
  value       NUMERIC NOT NULL,
  description TEXT,
  updated_by  VARCHAR(200),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, rule_key)
);

-- Default threshold seed (applied per-tenant on first access)
-- Institutional rules
COMMENT ON TABLE alert_thresholds IS
  'Per-tenant configurable alert thresholds. rule_key follows pattern: category.metric';

-- Incident service
-- rule_keys:
--   incident.zone_min_count       → min incidents in zone to alert (default 3)
--   incident.zone_high_count      → min for high severity (default 5)
--   incident.zone_window_hours    → time window for zone counting (default 48)
--   incident.unattended_hours     → hours before unattended alert (default 24)
--   incident.unattended_high_count→ min for high severity unattended (default 5)
--
-- Institutional service
--   institutional.irat_high       → IRAT score for high alert (default 60)
--   institutional.irat_critical   → IRAT score for critical (default 80)
--   institutional.supply_shortage → supply/demand ratio % (default 50)
--   institutional.low_coverage    → program coverage % (default 30)

DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON alert_thresholds TO ' || CURRENT_USER; END $$;
