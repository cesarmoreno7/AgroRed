-- ============================================================
-- 035_demo_access_expiry.sql
-- Vencimiento de acceso por usuario (accesos de consulta/demo con
-- vigencia limitada — Ley 2046 / kit comercial: "30 dias calendario").
--
-- Antes de esto la tabla users no tenia forma de expirar un acceso:
-- habia que borrarlo o cambiarle la clave a mano. Ahora LoginUser
-- rechaza (ACCESS_EXPIRED) cuando expires_at ya paso; expires_at NULL
-- = sin vencimiento (comportamiento actual de todos los usuarios).
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.users.expires_at IS
  'Fecha/hora de vencimiento del acceso. NULL = sin vencimiento. '
  'Si NOW() >= expires_at, el login se rechaza con ACCESS_EXPIRED. '
  'Usado por los accesos de demostracion (demo.*@agrored.co), vigencia 30 dias.';

-- Solo indexa las filas con vencimiento (la inmensa mayoria son NULL).
CREATE INDEX IF NOT EXISTS idx_public_users_expires_at
  ON public.users (expires_at)
  WHERE expires_at IS NOT NULL;
