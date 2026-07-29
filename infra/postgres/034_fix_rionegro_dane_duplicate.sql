-- ============================================================
-- 034_fix_rionegro_dane_duplicate.sql
-- Bug #13 (QA Oriente Antioqueño): Rionegro quedó sembrado con DOS
-- códigos DANE distintos en public.municipios:
--   - 029_departamentos_municipios.sql -> ('05576', 'Rionegro', ...)
--   - 032_municipios_coords_dane.sql   -> ('05615', 'Rionegro', ...)
--
-- Verificado contra DIVIPOLA/DANE (datos.gov.co, dataset gdxc-w37w):
-- el código real de Rionegro, Antioquia es 05615. El código 05576
-- corresponde a otro municipio (Pueblorrico), no a Rionegro — fue un
-- error de captura en 029, no una ambigüedad real del DANE.
--
-- Esta migración:
--   1. Repunta corregimientos/veredas de 027 que quedaron bajo el
--      código erróneo '05576' (El Carmen, La Fe, El Astillero,
--      La Quiebra — todos reales de Rionegro) hacia '05615'.
--   2. Elimina la fila duplicada/errónea de municipios ('05576' con
--      name='Rionegro'), dejando '05615' como único registro canónico.
--   3. Es idempotente: no falla si ya fue aplicada o si el dato
--      nunca llegó a sembrarse con el código erróneo.
-- ============================================================

BEGIN;

-- 1. Repuntar corregimientos mal codificados bajo '05576' hacia '05615'.
UPDATE public.corregimientos
SET municipality_code = '05615',
    dane_code = '05615' || right(dane_code, 3)
WHERE municipality_code = '05576'
  AND municipality_name = 'Rionegro';

-- 2. Repuntar veredas mal codificadas bajo '05576' hacia '05615'.
UPDATE public.veredas
SET municipality_code = '05615'
WHERE municipality_code = '05576'
  AND municipality_name = 'Rionegro';

-- 3. Eliminar la fila duplicada/errónea de Rionegro en municipios,
--    solo si el registro correcto ('05615') ya existe (no perder el
--    único registro si por alguna razón 032 nunca se aplicó).
DELETE FROM public.municipios
WHERE dane_code = '05576'
  AND name = 'Rionegro'
  AND EXISTS (
    SELECT 1 FROM public.municipios WHERE dane_code = '05615' AND name = 'Rionegro'
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.municipios WHERE dane_code = '05576' AND name = 'Rionegro'
  ) THEN
    RAISE NOTICE '034: fila 05576/Rionegro aun presente (no se encontro 05615/Rionegro para reemplazarla) - revisar manualmente.';
  ELSE
    RAISE NOTICE '034: Rionegro consolidado en un unico codigo DANE (05615).';
  END IF;
END $$;

COMMIT;
