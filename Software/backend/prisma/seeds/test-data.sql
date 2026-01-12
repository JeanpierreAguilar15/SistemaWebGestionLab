-- =====================================================
-- DATOS DE PRUEBA - Configuración Kardex
-- Ejecutar DESPUÉS de seed.sql
-- =====================================================

-- =====================================================
-- INVENTARIO: Items adicionales para Kardex
-- =====================================================

INSERT INTO inventario.item (
  codigo_categoria, codigo_interno, nombre, descripcion,
  unidad_medida, stock_actual, stock_minimo, stock_maximo,
  costo_unitario, activo
) VALUES
-- Reactivos (categoria 1)
(1, 'REA-003', 'Reactivo Colesterol Total', 'Reactivo para determinación de colesterol', 'ml', 250, 50, 500, 0.35, true),
(1, 'REA-004', 'Reactivo Triglicéridos', 'Reactivo para determinación de triglicéridos', 'ml', 200, 50, 500, 0.32, true),
(1, 'REA-005', 'Reactivo HDL Colesterol', 'Reactivo para determinación de HDL', 'ml', 180, 40, 400, 0.40, true),
-- Material de Laboratorio (categoria 2)
(2, 'MAT-003', 'Tubo con Gel Separador 5ml', 'Tubo vacutainer amarillo', 'unidad', 400, 100, 800, 0.18, true),
-- Consumibles (categoria 4)
(4, 'CON-004', 'Contenedor Orina Estéril', 'Frasco recolector de orina', 'unidad', 200, 50, 400, 0.25, true),
(4, 'CON-005', 'Tiras Reactivas Orina', 'Tiras para urianálisis 10 parámetros', 'unidad', 500, 100, 1000, 0.15, true)
ON CONFLICT (codigo_interno) DO NOTHING;

-- =====================================================
-- CONFIGURACIÓN KARDEX: Relación Exámenes-Insumos  
-- =====================================================
-- Nota: Los códigos de item son los del seed.sql + los nuevos insertados arriba

-- Hemograma Completo (codigo_examen = 1)
INSERT INTO inventario.examen_insumo (codigo_examen, codigo_item, cantidad_requerida, activo) 
VALUES 
(1, 3, 1, true),  -- Tubo EDTA
(1, 5, 1, true)   -- Guantes
ON CONFLICT DO NOTHING;

-- Glucosa en Ayunas (codigo_examen = 4)
INSERT INTO inventario.examen_insumo (codigo_examen, codigo_item, cantidad_requerida, activo)
VALUES
(4, 4, 1, true),  -- Tubo sin anticoagulante
(4, 1, 5, true),  -- Reactivo Glucosa
(4, 5, 1, true),  -- Guantes
(4, 6, 1, true)   -- Jeringas
ON CONFLICT DO NOTHING;

-- Perfil Lipídico (codigo_examen = 5)
INSERT INTO inventario.examen_insumo (codigo_examen, codigo_item, cantidad_requerida, activo)
VALUES
(5, 11, 1, true),  -- Tubo con gel (nuevo)
(5, 8, 5, true),   -- Reactivo Colesterol (nuevo)
(5, 9, 5, true),   -- Reactivo Triglicéridos (nuevo)
(5, 10, 3, true),  -- Reactivo HDL (nuevo)
(5, 5, 1, true),   -- Guantes
(5, 6, 1, true)    -- Jeringas
ON CONFLICT DO NOTHING;

-- Examen General de Orina (codigo_examen = 15)
INSERT INTO inventario.examen_insumo (codigo_examen, codigo_item, cantidad_requerida, activo)
VALUES
(15, 12, 1, true),  -- Contenedor Orina (nuevo)
(15, 13, 1, true),  -- Tiras Reactivas (nuevo)
(15, 5, 1, true)    -- Guantes
ON CONFLICT DO NOTHING;

-- Resumen
SELECT 'Test data insertado correctamente!' AS mensaje;
