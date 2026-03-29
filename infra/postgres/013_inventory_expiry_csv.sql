-- ============================================================
-- Migration 013: Add expiry tracking + CSV bulk import support
-- ============================================================

-- 1. Add expiry date to inventory items
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

-- 2. Index for near-expiry queries (items with expiry, not deleted, still available)
CREATE INDEX IF NOT EXISTS idx_inventory_items_expires_at
  ON public.inventory_items (expires_at)
  WHERE expires_at IS NOT NULL
    AND deleted_at IS NULL
    AND status IN ('available', 'reserved');

-- 3. Bulk import tracking table
CREATE TABLE IF NOT EXISTS public.inventory_imports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id),
  filename         VARCHAR(255) NOT NULL,
  total_rows       INTEGER NOT NULL DEFAULT 0,
  success_count    INTEGER NOT NULL DEFAULT 0,
  error_count      INTEGER NOT NULL DEFAULT 0,
  errors           JSONB DEFAULT '[]',
  status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','completed','failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_imports_tenant
  ON public.inventory_imports (tenant_id, created_at DESC);

-- 4. Grants
GRANT SELECT, INSERT, UPDATE ON public.inventory_imports TO "777";
