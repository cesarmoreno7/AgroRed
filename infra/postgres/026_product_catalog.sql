-- ============================================================
-- 026_product_catalog.sql
-- Tabla maestra de catálogo de productos alimentarios.
-- Independiente de ofertas/rescates; usada como referencia
-- en formularios de toda la aplicación.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES public.tenants(id),          -- NULL = global (compartido)
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN (
                'tuberculo','hortaliza','fruta','cereal',
                'leguminosa','lacteo','cacao','platano','yuca','otro')),
  unit        TEXT NOT NULL DEFAULT 'kg',
  description TEXT,
  in_season   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_catalog_name_tenant UNIQUE (name, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_category ON public.product_catalog(category);
CREATE INDEX IF NOT EXISTS idx_product_catalog_tenant   ON public.product_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_catalog_active   ON public.product_catalog(is_active) WHERE is_active = TRUE;

-- ── Seed global: productos comunes en Colombia ─────────────────
INSERT INTO public.product_catalog (name, category, unit, description, in_season, is_active)
VALUES
  ('Papa criolla',      'tuberculo',  'kg',    'Solanum phureja',                   TRUE,  TRUE),
  ('Papa pastusa',      'tuberculo',  'kg',    'Solanum tuberosum',                 TRUE,  TRUE),
  ('Yuca blanca',       'yuca',       'kg',    'Manihot esculenta',                 TRUE,  TRUE),
  ('Yuca amarilla',     'yuca',       'kg',    'Variedad amarilla',                 FALSE, TRUE),
  ('Batata',            'tuberculo',  'kg',    'Ipomoea batatas',                   FALSE, TRUE),
  ('Remolacha',         'tuberculo',  'kg',    'Beta vulgaris',                     FALSE, TRUE),
  ('Zanahoria',         'hortaliza',  'kg',    'Daucus carota',                     TRUE,  TRUE),
  ('Lechuga batavia',   'hortaliza',  'kg',    'Lactuca sativa',                    TRUE,  TRUE),
  ('Lechuga romana',    'hortaliza',  'kg',    'Lactuca sativa var. longifolia',    FALSE, TRUE),
  ('Tomate chonto',     'hortaliza',  'kg',    'Solanum lycopersicum',              TRUE,  TRUE),
  ('Tomate cherry',     'hortaliza',  'kg',    'Solanum lycopersicum var. cerasiforme', FALSE, TRUE),
  ('Espinaca',          'hortaliza',  'kg',    'Spinacia oleracea',                 FALSE, TRUE),
  ('Acelga',            'hortaliza',  'kg',    'Beta vulgaris var. cicla',          FALSE, TRUE),
  ('Repollo',           'hortaliza',  'kg',    'Brassica oleracea',                 FALSE, TRUE),
  ('Pepino cohombro',   'hortaliza',  'kg',    'Cucumis sativus',                   FALSE, TRUE),
  ('Pimentón rojo',     'hortaliza',  'kg',    'Capsicum annuum',                   FALSE, TRUE),
  ('Cebolla cabezona',  'hortaliza',  'kg',    'Allium cepa',                       FALSE, TRUE),
  ('Cebolla larga',     'hortaliza',  'kg',    'Allium fistulosum',                 FALSE, TRUE),
  ('Habichuela',        'leguminosa', 'kg',    'Phaseolus vulgaris var. vulgaris',  FALSE, TRUE),
  ('Mango tommy',       'fruta',      'kg',    'Mangifera indica',                  TRUE,  TRUE),
  ('Mango criollo',     'fruta',      'kg',    'Mangifera indica var.',             TRUE,  TRUE),
  ('Aguacate hass',     'fruta',      'kg',    'Persea americana',                  TRUE,  TRUE),
  ('Aguacate papelillo','fruta',      'kg',    'Persea americana var.',             FALSE, TRUE),
  ('Naranja Valencia',  'fruta',      'kg',    'Citrus sinensis',                   FALSE, TRUE),
  ('Mandarina Arrayana','fruta',      'kg',    'Citrus reticulata',                 FALSE, TRUE),
  ('Banano criollo',    'fruta',      'kg',    'Musa sapientum',                    TRUE,  TRUE),
  ('Maracuyá',          'fruta',      'kg',    'Passiflora edulis',                 FALSE, TRUE),
  ('Guayaba común',     'fruta',      'kg',    'Psidium guajava',                   FALSE, TRUE),
  ('Melón cantalupo',   'fruta',      'kg',    'Cucumis melo',                      FALSE, TRUE),
  ('Papaya hawaiana',   'fruta',      'kg',    'Carica papaya',                     FALSE, TRUE),
  ('Lulo',              'fruta',      'kg',    'Solanum quitoense',                 FALSE, TRUE),
  ('Tomate de árbol',   'fruta',      'kg',    'Solanum betaceum',                  FALSE, TRUE),
  ('Curuba',            'fruta',      'kg',    'Passiflora mollissima',             FALSE, TRUE),
  ('Uchuva',            'fruta',      'kg',    'Physalis peruviana',                FALSE, TRUE),
  ('Maíz amarillo',     'cereal',     'kg',    'Zea mays',                          FALSE, TRUE),
  ('Maíz blanco',       'cereal',     'kg',    'Zea mays var. albidum',             FALSE, TRUE),
  ('Arroz blanco',      'cereal',     'kg',    'Oryza sativa',                      FALSE, TRUE),
  ('Avena',             'cereal',     'kg',    'Avena sativa',                      FALSE, TRUE),
  ('Trigo',             'cereal',     'kg',    'Triticum aestivum',                 FALSE, TRUE),
  ('Frijol cargamanto', 'leguminosa', 'kg',    'Phaseolus vulgaris',                FALSE, TRUE),
  ('Frijol bolo rojo',  'leguminosa', 'kg',    'Phaseolus vulgaris var.',           FALSE, TRUE),
  ('Arveja verde',      'leguminosa', 'kg',    'Pisum sativum',                     FALSE, TRUE),
  ('Lenteja',           'leguminosa', 'kg',    'Lens culinaris',                    FALSE, TRUE),
  ('Garbanzo',          'leguminosa', 'kg',    'Cicer arietinum',                   FALSE, TRUE),
  ('Soya',              'leguminosa', 'kg',    'Glycine max',                       FALSE, TRUE),
  ('Leche entera',      'lacteo',     'litro', 'Leche pasteurizada',                FALSE, TRUE),
  ('Queso campesino',   'lacteo',     'kg',    'Queso blanco fresco',               FALSE, TRUE),
  ('Yogur natural',     'lacteo',     'litro', 'Yogur sin azúcar',                  FALSE, TRUE),
  ('Mantequilla',       'lacteo',     'kg',    'Mantequilla sin sal',               FALSE, TRUE),
  ('Cacao fino',        'cacao',      'kg',    'Theobroma cacao fino aroma',        FALSE, TRUE),
  ('Cacao corriente',   'cacao',      'kg',    'Theobroma cacao',                   FALSE, TRUE),
  ('Plátano hartón',    'platano',    'kg',    'Musa paradisiaca',                  TRUE,  TRUE),
  ('Plátano dominico',  'platano',    'kg',    'Musa paradisiaca var. dominico',    FALSE, TRUE),
  ('Plátano barraganete','platano',   'kg',    'Musa paradisiaca var. barraganete', FALSE, TRUE),
  ('Panela',            'otro',       'kg',    'Azúcar de caña sin refinar',        FALSE, TRUE),
  ('Miel de abejas',    'otro',       'litro', 'Miel pura de abejas',               FALSE, TRUE),
  ('Huevos AA',         'otro',       'und',   'Huevos de gallina tamaño AA',       FALSE, TRUE),
  ('Aceite de palma',   'otro',       'litro', 'Aceite vegetal de palma',           FALSE, TRUE),
  ('Sal común',         'otro',       'kg',    'Cloruro de sodio',                  FALSE, TRUE)
ON CONFLICT (name, tenant_id) DO NOTHING;
