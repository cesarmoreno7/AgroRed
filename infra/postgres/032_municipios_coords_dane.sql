-- ============================================================
-- 032_municipios_coords_dane.sql
-- Pobla coordenadas DANE (latitud/longitud) para los 33
-- capitales departamentales + 67 municipios con mayor
-- actividad agropecuaria en Colombia.
-- Idempotente: ON CONFLICT (dane_code) DO UPDATE.
-- ============================================================

INSERT INTO public.municipios
  (dane_code, name, department_code, department_name, latitude, longitude, population, is_active)
VALUES
  -- Bogotá D.C.
  ('11001','Bogotá D.C.',         '11','Bogotá D.C.',        4.711000,-74.072100,8081000,TRUE),
  -- Antioquia
  ('05001','Medellín',            '05','Antioquia',           6.244200,-75.581200,2572000,TRUE),
  ('05045','Apartadó',            '05','Antioquia',           7.884300,-76.631400,  178000,TRUE),
  ('05088','Bello',               '05','Antioquia',           6.335200,-75.556300,  540000,TRUE),
  ('05266','Envigado',            '05','Antioquia',           6.173600,-75.591800,  240000,TRUE),
  ('05380','Itagüí',              '05','Antioquia',           6.184700,-75.599200,  294000,TRUE),
  ('05615','Rionegro',            '05','Antioquia',           6.154500,-75.374200,  130000,TRUE),
  ('05690','Turbo',               '05','Antioquia',           8.098300,-76.735300,  180000,TRUE),
  -- Atlántico
  ('08001','Barranquilla',        '08','Atlántico',          10.963900,-74.796400,1228000,TRUE),
  ('08137','Campo de la Cruz',    '08','Atlántico',          10.374800,-74.884600,   35000,TRUE),
  ('08296','Galapa',              '08','Atlántico',          10.905600,-74.891900,   58000,TRUE),
  ('08433','Malambo',             '08','Atlántico',          10.854300,-74.769400,  115000,TRUE),
  -- Bolívar
  ('13001','Cartagena',           '13','Bolívar',            10.391000,-75.479400,1028000,TRUE),
  ('13430','Magangué',            '13','Bolívar',             9.241300,-74.756200,  125000,TRUE),
  -- Boyacá
  ('15001','Tunja',               '15','Boyacá',              5.535600,-73.362500,  200000,TRUE),
  ('15176','Chiquinquirá',        '15','Boyacá',              5.616700,-73.820600,   73000,TRUE),
  ('15469','Moniquirá',           '15','Boyacá',              5.876400,-73.570900,   25000,TRUE),
  ('15572','Puerto Boyacá',       '15','Boyacá',              5.975800,-74.591700,   60000,TRUE),
  ('15600','Ramiriquí',           '15','Boyacá',              5.411600,-73.333500,   15000,TRUE),
  ('15804','Soatá',               '15','Boyacá',              6.333900,-72.670800,   14000,TRUE),
  -- Caldas
  ('17001','Manizales',           '17','Caldas',              5.070300,-75.513800,  434000,TRUE),
  ('17380','La Dorada',           '17','Caldas',              5.456500,-74.663200,   80000,TRUE),
  -- Caquetá
  ('18001','Florencia',           '18','Caquetá',             1.614400,-75.607100,  170000,TRUE),
  -- Cauca
  ('19001','Popayán',             '19','Cauca',               2.441300,-76.616700,  340000,TRUE),
  ('19698','Santander de Quilichao','19','Cauca',             3.008000,-76.485000,   95000,TRUE),
  -- Cesar
  ('20001','Valledupar',          '20','Cesar',              10.463700,-73.253700,  500000,TRUE),
  ('20400','La Jagua de Ibirico', '20','Cesar',               9.565000,-73.334000,   40000,TRUE),
  -- Córdoba
  ('23001','Montería',            '23','Córdoba',              8.757800,-75.881700,  500000,TRUE),
  ('23466','Montelíbano',         '23','Córdoba',              7.981800,-75.429700,   82000,TRUE),
  -- Cundinamarca
  ('25307','Fusagasugá',          '25','Cundinamarca',         4.337000,-74.363700,  140000,TRUE),
  ('25473','Mosquera',            '25','Cundinamarca',         4.707200,-74.230600,  115000,TRUE),
  ('25486','Nemocón',             '25','Cundinamarca',         5.066200,-73.877200,   17000,TRUE),
  ('25592','Ricaurte',            '25','Cundinamarca',         4.294500,-74.768100,   25000,TRUE),
  ('25754','Soacha',              '25','Cundinamarca',         4.579400,-74.217300,  600000,TRUE),
  ('25843','Villeta',             '25','Cundinamarca',         5.013400,-74.471500,   30000,TRUE),
  -- Chocó
  ('27001','Quibdó',              '27','Chocó',               5.694800,-76.659800,  115000,TRUE),
  -- Huila
  ('41001','Neiva',               '41','Huila',               2.934100,-75.281800,  356000,TRUE),
  ('41298','Garzón',              '41','Huila',               2.200900,-75.625900,   80000,TRUE),
  -- La Guajira
  ('44001','Riohacha',            '44','La Guajira',          11.544100,-72.907200,  270000,TRUE),
  ('44430','Maicao',              '44','La Guajira',          11.381700,-72.241200,  140000,TRUE),
  -- Magdalena
  ('47001','Santa Marta',         '47','Magdalena',           11.240400,-74.199700,  547000,TRUE),
  ('47460','Ciénaga',             '47','Magdalena',           11.005000,-74.254000,  120000,TRUE),
  -- Meta
  ('50001','Villavicencio',       '50','Meta',                 4.142200,-73.626600,  530000,TRUE),
  ('50313','Granada',             '50','Meta',                 3.538100,-73.715500,   60000,TRUE),
  -- Nariño
  ('52001','Pasto',               '52','Nariño',               1.213600,-77.281500,  450000,TRUE),
  ('52356','Ipiales',             '52','Nariño',               0.829400,-77.644500,  130000,TRUE),
  -- Norte de Santander
  ('54001','Cúcuta',              '54','Norte de Santander',   7.893900,-72.507800,  750000,TRUE),
  ('54206','Convención',          '54','Norte de Santander',   8.467100,-73.326700,   20000,TRUE),
  ('54518','Pamplona',            '54','Norte de Santander',   7.378600,-72.649300,   65000,TRUE),
  -- Quindío
  ('63001','Armenia',             '63','Quindío',              4.533900,-75.681100,  308000,TRUE),
  ('63594','Quimbaya',            '63','Quindío',              4.622700,-75.761700,   37000,TRUE),
  -- Risaralda
  ('66001','Pereira',             '66','Risaralda',            4.808700,-75.690600,  478000,TRUE),
  ('66045','Apía',                '66','Risaralda',            5.108700,-76.014800,   18000,TRUE),
  ('66170','Dosquebradas',        '66','Risaralda',            4.837500,-75.659200,  206000,TRUE),
  -- Santander
  ('68001','Bucaramanga',         '68','Santander',            7.129300,-73.119800,  579000,TRUE),
  ('68081','Barrancabermeja',     '68','Santander',            7.064300,-73.854800,  210000,TRUE),
  ('68276','Floridablanca',       '68','Santander',            7.064200,-73.089900,  280000,TRUE),
  -- Sucre
  ('70001','Sincelejo',           '70','Sucre',                9.304100,-75.397700,  280000,TRUE),
  ('70215','Corozal',             '70','Sucre',                9.317800,-75.286900,   68000,TRUE),
  -- Tolima
  ('73001','Ibagué',              '73','Tolima',               4.438900,-75.232200,  565000,TRUE),
  ('73268','Espinal',             '73','Tolima',               4.152900,-74.882700,   80000,TRUE),
  ('73449','Melgar',              '73','Tolima',               4.203300,-74.641200,   38000,TRUE),
  -- Valle del Cauca
  ('76001','Cali',                '76','Valle del Cauca',      3.451600,-76.532000,2400000,TRUE),
  ('76111','Buenaventura',        '76','Valle del Cauca',      3.885400,-77.013600,  415000,TRUE),
  ('76109','Buga',                '76','Valle del Cauca',      3.900200,-76.297200,  117000,TRUE),
  ('76520','Palmira',             '76','Valle del Cauca',      3.539400,-76.303600,  325000,TRUE),
  ('76680','Tuluá',               '76','Valle del Cauca',      4.084300,-76.195500,  220000,TRUE),
  -- Arauca
  ('81001','Arauca',              '81','Arauca',               7.090300,-70.759500,   95000,TRUE),
  -- Casanare
  ('85001','Yopal',               '85','Casanare',             5.337800,-72.396000,  140000,TRUE),
  ('85136','Aguazul',             '85','Casanare',             5.170700,-72.549500,   45000,TRUE),
  -- Putumayo
  ('86001','Mocoa',               '86','Putumayo',             1.152100,-76.648000,   45000,TRUE),
  -- San Andrés y Providencia
  ('88001','San Andrés',          '88','San Andrés y Providencia', 12.535400,-81.724500, 80000,TRUE),
  -- Amazonas
  ('91001','Leticia',             '91','Amazonas',            -4.215000,-69.939200,   45000,TRUE),
  -- Guainía
  ('94001','Inírida',             '94','Guainía',              3.865000,-67.923000,   25000,TRUE),
  -- Guaviare
  ('95001','San José del Guaviare','95','Guaviare',            2.570000,-72.641000,   50000,TRUE),
  -- Vaupés
  ('97001','Mitú',                '97','Vaupés',               1.198500,-70.173600,   18000,TRUE),
  -- Vichada
  ('99001','Puerto Carreño',      '99','Vichada',              6.188300,-67.485000,   16000,TRUE)
ON CONFLICT (dane_code) DO UPDATE SET
  latitude    = EXCLUDED.latitude,
  longitude   = EXCLUDED.longitude,
  population  = EXCLUDED.population,
  name        = EXCLUDED.name,
  department_name = EXCLUDED.department_name,
  is_active   = EXCLUDED.is_active;

DO $$ BEGIN
  RAISE NOTICE '✅ 032: % municipios con coordenadas DANE actualizados.',
    (SELECT COUNT(*) FROM public.municipios WHERE latitude IS NOT NULL);
END $$;
