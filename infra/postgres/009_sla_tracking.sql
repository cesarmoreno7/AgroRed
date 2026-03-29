-- ============================================================
-- 009: SLA tracking for incidents + logistics analytics view fix
-- ============================================================

-- SLA fields on incidents
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS sla_target_minutes INT,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_time_minutes INT;

-- Default SLA targets based on severity
UPDATE public.incidents SET sla_target_minutes = CASE
  WHEN severity = 'critical' THEN 60
  WHEN severity = 'high' THEN 240
  WHEN severity = 'medium' THEN 1440
  WHEN severity = 'low' THEN 4320
  ELSE NULL
END WHERE sla_target_minutes IS NULL;

-- Index for SLA monitoring queries
CREATE INDEX IF NOT EXISTS idx_incidents_sla
  ON public.incidents (tenant_id, severity, sla_target_minutes)
  WHERE deleted_at IS NULL AND status IN ('reportada','open');

-- View: incidents with SLA status
CREATE OR REPLACE VIEW public.v_incidents_sla AS
SELECT
  i.id,
  i.tenant_id,
  i.municipality_name,
  i.incident_type,
  i.severity,
  i.status,
  i.sla_target_minutes,
  i.first_response_at,
  i.response_time_minutes,
  i.created_at,
  CASE
    WHEN i.first_response_at IS NOT NULL THEN 'responded'
    WHEN i.sla_target_minutes IS NULL THEN 'no_sla'
    WHEN EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 60 > i.sla_target_minutes THEN 'breached'
    ELSE 'on_track'
  END AS sla_status,
  ROUND(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 60)::int AS elapsed_minutes
FROM public.incidents i
WHERE i.deleted_at IS NULL;

GRANT SELECT ON public.v_incidents_sla TO PUBLIC;
