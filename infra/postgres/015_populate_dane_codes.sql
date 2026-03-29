-- =========================================================
-- 015_populate_dane_codes.sql
-- AGRORED — Poblar códigos DANE/territoriales
--
-- Códigos oficiales DANE para joins con shapefiles IGAC
-- Fuente: Divipola — DANE Colombia
-- =========================================================

BEGIN;

-- =========================================================
-- 1. DEPARTAMENTOS — Códigos DANE
-- =========================================================

UPDATE departamento SET codigo_dane = '05' WHERE nombre = 'Antioquia';
UPDATE departamento SET codigo_dane = '76' WHERE nombre = 'Valle del Cauca';
UPDATE departamento SET codigo_dane = '25' WHERE nombre = 'Cundinamarca';
UPDATE departamento SET codigo_dane = '68' WHERE nombre = 'Santander';
UPDATE departamento SET codigo_dane = '15' WHERE nombre = 'Boyacá';
UPDATE departamento SET codigo_dane = '52' WHERE nombre = 'Nariño';

-- =========================================================
-- 2. MUNICIPIOS — Códigos DANE (Divipola)
-- =========================================================

-- Antioquia
UPDATE municipio SET codigo_dane = '05001' WHERE nombre = 'Medellín';
UPDATE municipio SET codigo_dane = '05266' WHERE nombre = 'Envigado';
UPDATE municipio SET codigo_dane = '05360' WHERE nombre = 'Itagüí';
UPDATE municipio SET codigo_dane = '05088' WHERE nombre = 'Bello';
UPDATE municipio SET codigo_dane = '05615' WHERE nombre = 'Rionegro';
UPDATE municipio SET codigo_dane = '05042' WHERE nombre = 'Santa Fe de Antioquia';

-- Valle del Cauca
UPDATE municipio SET codigo_dane = '76001' WHERE nombre = 'Cali';
UPDATE municipio SET codigo_dane = '76520' WHERE nombre = 'Palmira';
UPDATE municipio SET codigo_dane = '76109' WHERE nombre = 'Buenaventura';

-- Cundinamarca / Bogotá
UPDATE municipio SET codigo_dane = '11001' WHERE nombre = 'Bogotá';
UPDATE municipio SET codigo_dane = '25754' WHERE nombre = 'Soacha';
UPDATE municipio SET codigo_dane = '25899' WHERE nombre = 'Zipaquirá';

-- Santander
UPDATE municipio SET codigo_dane = '68001' WHERE nombre = 'Bucaramanga';
UPDATE municipio SET codigo_dane = '68081' WHERE nombre = 'Barrancabermeja';

-- Boyacá
UPDATE municipio SET codigo_dane = '15001' WHERE nombre = 'Tunja';
UPDATE municipio SET codigo_dane = '15238' WHERE nombre = 'Duitama';

-- Nariño
UPDATE municipio SET codigo_dane = '52001' WHERE nombre = 'Pasto';
UPDATE municipio SET codigo_dane = '52835' WHERE nombre = 'Tumaco';

-- =========================================================
-- 3. COMUNAS — Códigos compuestos (DANE_MUNICIPIO + NUMERO)
--    Formato: {codigo_dane_mpio}-C{numero} o {codigo_dane_mpio}-CR{numero}
-- =========================================================

-- Medellín (05001)
UPDATE comuna SET codigo = '05001-C01'  WHERE municipio_id = 1 AND numero = 1  AND tipo = 'comuna';
UPDATE comuna SET codigo = '05001-C03'  WHERE municipio_id = 1 AND numero = 3  AND tipo = 'comuna';
UPDATE comuna SET codigo = '05001-C10'  WHERE municipio_id = 1 AND numero = 10 AND tipo = 'comuna';
UPDATE comuna SET codigo = '05001-C11'  WHERE municipio_id = 1 AND numero = 11 AND tipo = 'comuna';
UPDATE comuna SET codigo = '05001-C14'  WHERE municipio_id = 1 AND numero = 14 AND tipo = 'comuna';
UPDATE comuna SET codigo = '05001-C16'  WHERE municipio_id = 1 AND numero = 16 AND tipo = 'comuna';
UPDATE comuna SET codigo = '05001-CR80' WHERE municipio_id = 1 AND numero = 80 AND tipo = 'corregimiento_rural';
UPDATE comuna SET codigo = '05001-CR90' WHERE municipio_id = 1 AND numero = 90 AND tipo = 'corregimiento_rural';

-- Cali (76001)
UPDATE comuna SET codigo = '76001-C03'  WHERE municipio_id = (SELECT id FROM municipio WHERE codigo_dane = '76001') AND numero = 3  AND tipo = 'comuna';
UPDATE comuna SET codigo = '76001-C20'  WHERE municipio_id = (SELECT id FROM municipio WHERE codigo_dane = '76001') AND numero = 20 AND tipo = 'comuna';
UPDATE comuna SET codigo = '76001-CR00' WHERE municipio_id = (SELECT id FROM municipio WHERE codigo_dane = '76001') AND nombre = 'Pance';

-- Bogotá (11001)
UPDATE comuna SET codigo = '11001-C02'  WHERE municipio_id = (SELECT id FROM municipio WHERE codigo_dane = '11001') AND numero = 2  AND tipo = 'comuna';
UPDATE comuna SET codigo = '11001-C01'  WHERE municipio_id = (SELECT id FROM municipio WHERE codigo_dane = '11001') AND numero = 1  AND tipo = 'comuna';
UPDATE comuna SET codigo = '11001-CR20' WHERE municipio_id = (SELECT id FROM municipio WHERE codigo_dane = '11001') AND nombre = 'Sumapaz';

-- Bucaramanga (68001)
UPDATE comuna SET codigo = '68001-C12'  WHERE municipio_id = (SELECT id FROM municipio WHERE codigo_dane = '68001') AND numero = 12;

-- Pasto (52001)
UPDATE comuna SET codigo = '52001-C01'  WHERE municipio_id = (SELECT id FROM municipio WHERE codigo_dane = '52001') AND numero = 1  AND tipo = 'comuna';
UPDATE comuna SET codigo = '52001-CR00' WHERE municipio_id = (SELECT id FROM municipio WHERE codigo_dane = '52001') AND nombre = 'Catambuco';

-- =========================================================
-- 4. ZONAS — Códigos territoriales
--    Formato: {codigo_dane_mpio}-{B|V|CG}{secuencial}
--    B = barrio, V = vereda, CG = corregimiento
-- =========================================================

-- Medellín
UPDATE zona SET codigo_zona = '05001-B001' WHERE id = 1;  -- Barrio Centro
UPDATE zona SET codigo_zona = '05001-B002' WHERE id = 2;  -- El Poblado
UPDATE zona SET codigo_zona = '05001-B003' WHERE id = 3;  -- Laureles
UPDATE zona SET codigo_zona = '05001-CG01' WHERE id = 4;  -- San Antonio de Prado (corregimiento)
UPDATE zona SET codigo_zona = '05001-V001' WHERE id = 5;  -- Santa Elena (vereda)

-- Envigado
UPDATE zona SET codigo_zona = '05266-B001' WHERE id = 7;  -- El Trianón
UPDATE zona SET codigo_zona = '05266-B002' WHERE id = 6;  -- Zuñiga

-- Cali
UPDATE zona SET codigo_zona = '76001-B001' WHERE id = 8;  -- San Fernando
UPDATE zona SET codigo_zona = '76001-B002' WHERE id = 9;  -- Siloé
UPDATE zona SET codigo_zona = '76001-CG01' WHERE id = 10; -- Pance

-- Bogotá
UPDATE zona SET codigo_zona = '11001-B001' WHERE id = 11; -- Chapinero
UPDATE zona SET codigo_zona = '11001-B002' WHERE id = 12; -- Usaquén
UPDATE zona SET codigo_zona = '11001-CG01' WHERE id = 13; -- Sumapaz

-- Bucaramanga
UPDATE zona SET codigo_zona = '68001-B001' WHERE id = 14; -- Cabecera del Llano

-- Pasto
UPDATE zona SET codigo_zona = '52001-B001' WHERE id = 15; -- Centro Histórico
UPDATE zona SET codigo_zona = '52001-CG01' WHERE id = 16; -- Catambuco

-- =========================================================
-- 5. MANZANAS — Códigos catastrales
--    Formato: {codigo_zona}-MZ{secuencial}
-- =========================================================

UPDATE manzana SET codigo_catastral = '05001-B001-MZ01' WHERE id = 1;  -- MDE-CEN-MZ01
UPDATE manzana SET codigo_catastral = '05001-B001-MZ02' WHERE id = 2;  -- MDE-CEN-MZ02
UPDATE manzana SET codigo_catastral = '05001-B002-MZ01' WHERE id = 3;  -- MDE-POB-MZ01
UPDATE manzana SET codigo_catastral = '05001-B002-MZ02' WHERE id = 4;  -- MDE-POB-MZ02

-- =========================================================
-- 6. PREDIOS — Códigos catastrales
--    Formato: {codigo_manzana_o_zona}-P{secuencial}
-- =========================================================

-- Predios en zonas con manzana (via zona_id)
UPDATE predio SET codigo_catastral = '05001-B003-P001'  WHERE codigo = 'MDE-LAU-001';   -- Laureles
UPDATE predio SET codigo_catastral = '05001-B003-P002'  WHERE codigo = 'MDE-LAU-002';
UPDATE predio SET codigo_catastral = '05001-V001-P001'  WHERE codigo = 'MDE-STE-001';   -- Santa Elena
UPDATE predio SET codigo_catastral = '05001-V001-P002'  WHERE codigo = 'MDE-STE-002';
UPDATE predio SET codigo_catastral = '05266-B002-P001'  WHERE codigo = 'ENV-ZUN-001';   -- Envigado-Zuñiga
UPDATE predio SET codigo_catastral = '05266-B002-P002'  WHERE codigo = 'ENV-ZUN-002';
UPDATE predio SET codigo_catastral = '76001-B001-P001'  WHERE codigo = 'CAL-SFE-001';   -- Cali-San Fernando
UPDATE predio SET codigo_catastral = '76001-B001-P002'  WHERE codigo = 'CAL-SFE-002';
UPDATE predio SET codigo_catastral = '76001-CG01-P001'  WHERE codigo = 'CAL-PAN-001';   -- Cali-Pance
UPDATE predio SET codigo_catastral = '76001-CG01-P002'  WHERE codigo = 'CAL-PAN-002';
UPDATE predio SET codigo_catastral = '11001-B001-P001'  WHERE codigo = 'BOG-CHA-001';   -- Bogotá-Chapinero
UPDATE predio SET codigo_catastral = '11001-B001-P002'  WHERE codigo = 'BOG-CHA-002';
UPDATE predio SET codigo_catastral = '11001-B002-P001'  WHERE codigo = 'BOG-USA-001';   -- Bogotá-Usaquén
UPDATE predio SET codigo_catastral = '68001-B001-P001'  WHERE codigo = 'BGA-CAB-001';   -- Bucaramanga-Cabecera
UPDATE predio SET codigo_catastral = '52001-B001-P001'  WHERE codigo = 'PAS-CHI-001';   -- Pasto-Centro
UPDATE predio SET codigo_catastral = '52001-CG01-P001'  WHERE codigo = 'PAS-CAT-001';   -- Pasto-Catambuco
UPDATE predio SET codigo_catastral = '52001-CG01-P002'  WHERE codigo = 'PAS-CAT-002';

-- Predios originales en Barrio Centro, Medellín
UPDATE predio SET codigo_catastral = '05001-B001-P000'  WHERE codigo = 'PREDIO001' AND zona_id = 1;
UPDATE predio SET codigo_catastral = '05001-B001-P002'  WHERE codigo = 'MDE-CEN-002' AND zona_id = 1;
UPDATE predio SET codigo_catastral = '05001-B001-P003'  WHERE codigo = 'MDE-CEN-003' AND zona_id = 1;

-- =========================================================
-- 7. VERIFICACIÓN
-- =========================================================

DO $$
DECLARE
    v_dept_ok INT;
    v_mpio_ok INT;
    v_zona_ok INT;
    v_comuna_ok INT;
    v_manzana_ok INT;
BEGIN
    SELECT COUNT(*) INTO v_dept_ok FROM departamento WHERE codigo_dane IS NOT NULL;
    SELECT COUNT(*) INTO v_mpio_ok FROM municipio WHERE codigo_dane IS NOT NULL;
    SELECT COUNT(*) INTO v_zona_ok FROM zona WHERE codigo_zona IS NOT NULL;
    SELECT COUNT(*) INTO v_comuna_ok FROM comuna WHERE codigo IS NOT NULL;
    SELECT COUNT(*) INTO v_manzana_ok FROM manzana WHERE codigo_catastral IS NOT NULL;

    RAISE NOTICE '=== VERIFICACIÓN CÓDIGOS DANE ===';
    RAISE NOTICE 'Departamentos con código: % / %', v_dept_ok, (SELECT COUNT(*) FROM departamento);
    RAISE NOTICE 'Municipios con código:    % / %', v_mpio_ok, (SELECT COUNT(*) FROM municipio);
    RAISE NOTICE 'Zonas con código:         % / %', v_zona_ok, (SELECT COUNT(*) FROM zona);
    RAISE NOTICE 'Comunas con código:       % / %', v_comuna_ok, (SELECT COUNT(*) FROM comuna);
    RAISE NOTICE 'Manzanas con código:      % / %', v_manzana_ok, (SELECT COUNT(*) FROM manzana);
    RAISE NOTICE '=================================';
END $$;

COMMIT;

-- =========================================================
-- FIN: 015_populate_dane_codes.sql
-- =========================================================
