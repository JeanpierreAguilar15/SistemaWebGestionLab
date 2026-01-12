-- =====================================================
-- CONFIGURACIÓN KARDEX - Relación Exámenes-Insumos
-- =====================================================
-- Ejecutar: psql -U postgres -d laboratorio_franz_db -f prisma/seeds/kardex-config.sql

-- Nota: Los IDs de exámenes e items dependen del seed.ts
-- Necesitamos verificar los IDs reales primero

-- Ver los exámenes disponibles
SELECT codigo_examen, codigo_interno, nombre FROM catalogo.examen ORDER BY codigo_examen;

-- Ver los items de inventario disponibles
SELECT codigo_item, codigo_interno, nombre FROM inventario.item ORDER BY codigo_item;

-- Configurar Kardex (ajustar IDs según los resultados de arriba)
-- Ejemplo: Si Hemograma es codigo_examen=1 y Tubo EDTA es codigo_item=1

-- DESCOMENTAR Y AJUSTAR ESTOS INSERTS SEGÚN LOS IDs REALES:

-- INSERT INTO inventario.examen_insumo (codigo_examen, codigo_item, cantidad_requerida, activo) 
-- VALUES 
-- -- Hemograma: Tubo EDTA + Guantes
-- (1, 1, 1, true),  -- 1 Tubo EDTA
-- (1, 3, 1, true),  -- 1 Guantes
-- 
-- -- Glucosa: Tubo + Reactivo + Guantes
-- (2, 2, 1, true),  -- 1 Tubo sin anticoagulante
-- (2, 1, 5, true),  -- 5ml Reactivo (si existe)
-- (2, 3, 1, true)   -- 1 Guantes
-- ON CONFLICT DO NOTHING;

SELECT 'Revisa los IDs y descomenta los INSERT para configurar Kardex' AS mensaje;
