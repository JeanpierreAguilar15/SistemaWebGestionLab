-- ======================================================
-- DATOS DE PRUEBA PARA CONTROL DE REACTIVOS
-- Ejecutar despues de la migracion de campos de reactivos
-- ======================================================

-- Estructura:
-- ITEM = Reactivo (ej: Reactivo Glucosa)
--   - es_reactivo = true
--   - vida_util_dias_abierto = dias que dura un frasco abierto
--   - capacidad_pruebas = pruebas por frasco
--
-- LOTE = Kit comprado (contiene N frascos)
--   - cantidad_inicial = frascos totales en el kit
--   - cantidad_actual = frascos disponibles
--   - estado_lote = CERRADO, ABIERTO, AGOTADO, DESCARTADO

-- ======================================================
-- 1. CREAR CATEGORIA DE REACTIVOS SI NO EXISTE
-- ======================================================
INSERT INTO inventario.categoria_item (nombre, descripcion)
SELECT 'Reactivos', 'Reactivos de laboratorio con vida util limitada despues de abiertos'
WHERE NOT EXISTS (
    SELECT 1 FROM inventario.categoria_item WHERE nombre = 'Reactivos'
);

-- ======================================================
-- 2. CREAR ITEMS DE REACTIVOS DE PRUEBA
-- ======================================================

-- Reactivo de Glucosa
-- Kit con 50 frascos, cada frasco hace 10 pruebas, vida util 3 dias
INSERT INTO inventario.item (
    codigo_interno, nombre, descripcion, unidad_medida,
    stock_actual, stock_minimo, costo_unitario,
    es_reactivo, vida_util_dias_abierto, capacidad_pruebas,
    codigo_categoria, activo
)
SELECT
    'REACT-GLU-001',
    'Reactivo Glucosa Liquida',
    'Reactivo para determinacion de glucosa en suero/plasma. Kit de 50 frascos, 10 pruebas por frasco.',
    'Frasco',
    50,  -- 50 frascos en stock
    10,  -- minimo 10 frascos
    4.50, -- costo por frasco
    true,  -- ES REACTIVO
    3,     -- 3 dias de vida util despues de abierto el frasco
    10,    -- capacidad de 10 pruebas por frasco
    (SELECT codigo_categoria FROM inventario.categoria_item WHERE nombre = 'Reactivos' LIMIT 1),
    true
WHERE NOT EXISTS (
    SELECT 1 FROM inventario.item WHERE codigo_interno = 'REACT-GLU-001'
);

-- Reactivo de Colesterol
-- Kit con 30 frascos, cada frasco hace 15 pruebas, vida util 2 dias
INSERT INTO inventario.item (
    codigo_interno, nombre, descripcion, unidad_medida,
    stock_actual, stock_minimo, costo_unitario,
    es_reactivo, vida_util_dias_abierto, capacidad_pruebas,
    codigo_categoria, activo
)
SELECT
    'REACT-COL-001',
    'Reactivo Colesterol Total',
    'Reactivo enzimatico para determinacion de colesterol total. Kit de 30 frascos, 15 pruebas por frasco.',
    'Frasco',
    30,  -- 30 frascos en stock
    8,   -- minimo 8 frascos
    5.50,
    true,  -- ES REACTIVO
    2,     -- 2 dias de vida util despues de abierto
    15,    -- capacidad de 15 pruebas por frasco
    (SELECT codigo_categoria FROM inventario.categoria_item WHERE nombre = 'Reactivos' LIMIT 1),
    true
WHERE NOT EXISTS (
    SELECT 1 FROM inventario.item WHERE codigo_interno = 'REACT-COL-001'
);

-- Reactivo de Trigliceridos
-- Kit con 40 frascos, cada frasco hace 12 pruebas, vida util 3 dias
INSERT INTO inventario.item (
    codigo_interno, nombre, descripcion, unidad_medida,
    stock_actual, stock_minimo, costo_unitario,
    es_reactivo, vida_util_dias_abierto, capacidad_pruebas,
    codigo_categoria, activo
)
SELECT
    'REACT-TRI-001',
    'Reactivo Trigliceridos',
    'Reactivo para determinacion de trigliceridos. Kit de 40 frascos, 12 pruebas por frasco.',
    'Frasco',
    40,  -- 40 frascos en stock
    10,  -- minimo 10
    5.00,
    true,  -- ES REACTIVO
    3,     -- 3 dias de vida util despues de abierto
    12,    -- capacidad de 12 pruebas por frasco
    (SELECT codigo_categoria FROM inventario.categoria_item WHERE nombre = 'Reactivos' LIMIT 1),
    true
WHERE NOT EXISTS (
    SELECT 1 FROM inventario.item WHERE codigo_interno = 'REACT-TRI-001'
);

-- Reactivo de Hemoglobina Glicosilada
-- Kit con 25 frascos, cada frasco hace 5 pruebas, vida util 7 dias
INSERT INTO inventario.item (
    codigo_interno, nombre, descripcion, unidad_medida,
    stock_actual, stock_minimo, costo_unitario,
    es_reactivo, vida_util_dias_abierto, capacidad_pruebas,
    codigo_categoria, activo
)
SELECT
    'REACT-HBA1C-001',
    'Reactivo HbA1c',
    'Reactivo para hemoglobina glicosilada. Kit de 25 frascos, 5 pruebas por frasco.',
    'Frasco',
    25,  -- 25 frascos en stock
    5,   -- minimo 5
    12.00,
    true,  -- ES REACTIVO
    7,     -- 7 dias de vida util despues de abierto
    5,     -- capacidad de 5 pruebas por frasco
    (SELECT codigo_categoria FROM inventario.categoria_item WHERE nombre = 'Reactivos' LIMIT 1),
    true
WHERE NOT EXISTS (
    SELECT 1 FROM inventario.item WHERE codigo_interno = 'REACT-HBA1C-001'
);

-- Reactivo de Creatinina
-- Kit con 60 frascos, cada frasco hace 8 pruebas, vida util 5 dias
INSERT INTO inventario.item (
    codigo_interno, nombre, descripcion, unidad_medida,
    stock_actual, stock_minimo, costo_unitario,
    es_reactivo, vida_util_dias_abierto, capacidad_pruebas,
    codigo_categoria, activo
)
SELECT
    'REACT-CREA-001',
    'Reactivo Creatinina Jaffe',
    'Reactivo para creatinina metodo Jaffe. Kit de 60 frascos, 8 pruebas por frasco.',
    'Frasco',
    60,  -- 60 frascos en stock
    15,  -- minimo 15
    4.00,
    true,  -- ES REACTIVO
    5,     -- 5 dias de vida util despues de abierto
    8,     -- capacidad de 8 pruebas por frasco
    (SELECT codigo_categoria FROM inventario.categoria_item WHERE nombre = 'Reactivos' LIMIT 1),
    true
WHERE NOT EXISTS (
    SELECT 1 FROM inventario.item WHERE codigo_interno = 'REACT-CREA-001'
);

-- ======================================================
-- 3. CREAR LOTES (KITS) PARA LOS REACTIVOS
-- Cada lote representa un kit comprado con N frascos
-- ======================================================

-- Lotes para Glucosa (50 frascos por kit)
INSERT INTO inventario.lote (
    codigo_item, numero_lote, fecha_vencimiento,
    cantidad_inicial, cantidad_actual, proveedor,
    estado_lote, pruebas_realizadas
)
SELECT
    codigo_item,
    'GLU-2025-001',
    '2025-06-30'::date,
    50,  -- 50 frascos en el kit
    50,  -- todos disponibles
    'Wiener Lab',
    'CERRADO',
    0
FROM inventario.item WHERE codigo_interno = 'REACT-GLU-001'
AND NOT EXISTS (
    SELECT 1 FROM inventario.lote WHERE numero_lote = 'GLU-2025-001'
);

-- Lotes para Colesterol (30 frascos por kit)
INSERT INTO inventario.lote (
    codigo_item, numero_lote, fecha_vencimiento,
    cantidad_inicial, cantidad_actual, proveedor,
    estado_lote, pruebas_realizadas
)
SELECT
    codigo_item,
    'COL-2025-001',
    '2025-05-20'::date,
    30,  -- 30 frascos
    30,
    'Roche Diagnostics',
    'CERRADO',
    0
FROM inventario.item WHERE codigo_interno = 'REACT-COL-001'
AND NOT EXISTS (
    SELECT 1 FROM inventario.lote WHERE numero_lote = 'COL-2025-001'
);

-- Lotes para Trigliceridos (40 frascos por kit)
INSERT INTO inventario.lote (
    codigo_item, numero_lote, fecha_vencimiento,
    cantidad_inicial, cantidad_actual, proveedor,
    estado_lote, pruebas_realizadas
)
SELECT
    codigo_item,
    'TRI-2025-001',
    '2025-07-10'::date,
    40,
    40,
    'Human Diagnostics',
    'CERRADO',
    0
FROM inventario.item WHERE codigo_interno = 'REACT-TRI-001'
AND NOT EXISTS (
    SELECT 1 FROM inventario.lote WHERE numero_lote = 'TRI-2025-001'
);

-- Lotes para HbA1c (25 frascos por kit)
INSERT INTO inventario.lote (
    codigo_item, numero_lote, fecha_vencimiento,
    cantidad_inicial, cantidad_actual, proveedor,
    estado_lote, pruebas_realizadas
)
SELECT
    codigo_item,
    'HBA1C-2025-001',
    '2025-09-30'::date,
    25,
    25,
    'Bio-Rad',
    'CERRADO',
    0
FROM inventario.item WHERE codigo_interno = 'REACT-HBA1C-001'
AND NOT EXISTS (
    SELECT 1 FROM inventario.lote WHERE numero_lote = 'HBA1C-2025-001'
);

-- Lotes para Creatinina (60 frascos por kit)
INSERT INTO inventario.lote (
    codigo_item, numero_lote, fecha_vencimiento,
    cantidad_inicial, cantidad_actual, proveedor,
    estado_lote, pruebas_realizadas
)
SELECT
    codigo_item,
    'CREA-2025-001',
    '2025-08-15'::date,
    60,
    60,
    'Wiener Lab',
    'CERRADO',
    0
FROM inventario.item WHERE codigo_interno = 'REACT-CREA-001'
AND NOT EXISTS (
    SELECT 1 FROM inventario.lote WHERE numero_lote = 'CREA-2025-001'
);

-- ======================================================
-- 4. VERIFICAR DATOS CREADOS
-- ======================================================

-- Ver items de reactivos creados
SELECT
    codigo_item,
    codigo_interno,
    nombre,
    stock_actual as frascos_stock,
    es_reactivo,
    vida_util_dias_abierto as vida_dias,
    capacidad_pruebas as pruebas_por_frasco
FROM inventario.item
WHERE es_reactivo = true
ORDER BY nombre;

-- Ver lotes de reactivos creados
SELECT
    l.codigo_lote,
    l.numero_lote,
    i.nombre as reactivo,
    l.cantidad_inicial as frascos_kit,
    l.cantidad_actual as frascos_disponibles,
    l.estado_lote,
    l.fecha_vencimiento,
    i.capacidad_pruebas as pruebas_por_frasco,
    (l.cantidad_actual * i.capacidad_pruebas) as pruebas_totales_disponibles
FROM inventario.lote l
JOIN inventario.item i ON l.codigo_item = i.codigo_item
WHERE i.es_reactivo = true
ORDER BY l.codigo_lote;

-- ======================================================
-- INSTRUCCIONES DE USO:
-- ======================================================
-- 1. Ejecutar este script en la base de datos
-- 2. Ir a /admin/inventario/reactivos
-- 3. Flujo de prueba:
--
--    a) ABRIR FRASCO:
--       - Click en "Abrir Frasco" en un lote cerrado
--       - Inicia contador de vida util (ej: 3 dias)
--       - Solo 1 frasco abierto por reactivo a la vez
--
--    b) REGISTRAR PRUEBAS:
--       - Click en icono de tubo de ensayo
--       - Ingresar cantidad de pruebas realizadas
--       - Si llega a capacidad maxima, se descuenta 1 frasco del stock
--
--    c) DESCARTAR FRASCO:
--       - Click en icono de basura
--       - Seleccionar motivo (vencido, danado, etc)
--       - Se descuenta 1 frasco del stock
--       - Muestra pruebas desperdiciadas
--
-- API Endpoints:
--    GET  /api/v1/admin/inventory/reactivos/lotes-abiertos
--    POST /api/v1/admin/inventory/reactivos/abrir-lote
--         Body: { "codigo_lote": 1 }
--    POST /api/v1/admin/inventory/reactivos/registrar-pruebas
--         Body: { "codigo_lote": 1, "cantidad_pruebas": 5 }
--    POST /api/v1/admin/inventory/reactivos/descartar-lote
--         Body: { "codigo_lote": 1, "motivo": "VENCIDO_APERTURA" }
-- ======================================================
