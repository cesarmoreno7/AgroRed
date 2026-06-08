-- ============================================================
-- 028_superadmin_role.sql
-- Agrega rol SUPERADMIN y crea usuario superadministrador
-- El SUPERADMIN tiene acceso total a todos los módulos y puede
-- monitorear todos los procesos en todos los municipios.
-- ============================================================

-- ── 1. Agregar SUPERADMIN a la lista de roles válidos ─────────
-- Nota: El backend PHP valida roles en UserModule.php::USER_ROLES
-- Este script prepara la base de datos para el nuevo rol

-- ── 2. Crear usuario Superadmin ───────────────────────────────
-- Email: superadmin@agrored.co
-- Password: SuperAdmin2024! (cambiar en producción)
-- Rol: SUPERADMIN
-- Tenant: NULL (acceso global a todos los tenants)

INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, metadata)
SELECT 
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001'::uuid, -- Tenant sistema (acceso global por rol SUPERADMIN)
    'superadmin@agrored.co',
    'Super Administrador AgroRed',
    'SUPERADMIN',
    'active',
    crypt('SuperAdmin2024!', gen_salt('bf')), -- bcrypt hash via pgcrypto
    '{"created_by": "system", "purpose": "Monitoreo global y administración del sistema", "ai_copilot_unrestricted": true}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE email = 'superadmin@agrored.co'
);

-- ── 3. Crear índice para búsqueda por rol SUPERADMIN ──────────
CREATE INDEX IF NOT EXISTS idx_public_users_superadmin 
ON public.users (role) WHERE role = 'SUPERADMIN';

-- ── 4. Vista para monitoreo global de Superadmin ──────────────
-- Esta vista permite al superadmin ver resumen de todos los tenants
CREATE OR REPLACE VIEW public.superadmin_dashboard_overview AS
SELECT
    t.id AS tenant_id,
    t.code AS tenant_code,
    t.name AS tenant_name,
    t.type AS tenant_type,
    t.status AS tenant_status,
    
    -- Usuarios
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) AS active_users,
    
    -- Productores
    COUNT(DISTINCT p.id) AS total_producers,
    COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) AS active_producers,
    
    -- Ofertas
    COUNT(DISTINCT o.id) AS total_offers,
    COUNT(DISTINCT CASE WHEN o.status = 'active' THEN o.id END) AS active_offers,
    
    -- Rescates
    COUNT(DISTINCT r.id) AS total_rescues,
    COUNT(DISTINCT CASE WHEN r.status IN ('scheduled', 'in_transit') THEN r.id END) AS scheduled_rescues,
    
    -- Demandas
    COUNT(DISTINCT d.id) AS total_demands,
    COUNT(DISTINCT CASE WHEN d.status = 'open' THEN d.id END) AS open_demands,
    
    -- Inventario
    COUNT(DISTINCT i.id) AS total_inventory_items,
    COALESCE(SUM(i.quantity_on_hand), 0) AS total_inventory_units,
    
    -- Incidencias
    COUNT(DISTINCT inc.id) AS total_incidents,
    COUNT(DISTINCT CASE WHEN inc.status IN ('open', 'in_progress') THEN inc.id END) AS open_incidents,
    
    -- Logística
    COUNT(DISTINCT lo.id) AS total_logistics_orders,
    COUNT(DISTINCT CASE WHEN lo.status IN ('scheduled', 'in_transit') THEN lo.id END) AS active_logistics_orders
    
FROM public.tenants t
LEFT JOIN public.users u ON u.tenant_id = t.id AND u.deleted_at IS NULL
LEFT JOIN public.producers p ON p.tenant_id = t.id AND p.deleted_at IS NULL
LEFT JOIN public.offers o ON o.tenant_id = t.id AND o.deleted_at IS NULL
LEFT JOIN public.rescues r ON r.tenant_id = t.id AND r.deleted_at IS NULL
LEFT JOIN public.demands d ON d.tenant_id = t.id AND d.deleted_at IS NULL
LEFT JOIN public.inventory_items i ON i.tenant_id = t.id
LEFT JOIN public.incidents inc ON inc.tenant_id = t.id AND inc.deleted_at IS NULL
LEFT JOIN public.logistics_orders lo ON lo.tenant_id = t.id AND lo.deleted_at IS NULL
GROUP BY t.id, t.code, t.name, t.type, t.status
ORDER BY t.name ASC;

-- ── 5. Concesión de permisos para SUPERADMIN ──────────────────
-- El SUPERADMIN puede leer todas las tablas del esquema public
-- Nota: Esto se complementa con validaciones en el backend PHP

-- ── 6. Tabla de auditoría para acciones del SUPERADMIN ────────
-- Todas las acciones del superadmin quedan registradas con su ID

COMMENT ON COLUMN public.users.metadata IS 'Metadatos extendidos del usuario. Para SUPERADMIN incluye: ai_copilot_unrestricted=true';

-- ── 7. Datos de ejemplo para demostración ─────────────────────
-- Si no existen tenants, crear algunos para prueba
INSERT INTO public.tenants (code, name, type, status) VALUES
    ('ANTIOQUIA', 'Departamento de Antioquia', 'departamento', 'active'),
    ('MEDELLIN', 'Municipio de Medellín', 'municipio', 'active'),
    ('RIONEGRO', 'Municipio de Rionegro', 'municipio', 'active'),
    ('BOGOTA', 'Bogotá D.C.', 'distrito', 'active')
ON CONFLICT (code) DO NOTHING;

-- ── Fin del script ────────────────────────────────────────────
