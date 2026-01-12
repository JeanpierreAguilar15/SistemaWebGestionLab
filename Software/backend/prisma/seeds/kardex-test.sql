-- =====================================================
-- DATOS DE PRUEBA - Solo Configuración Kardex
-- =====================================================

-- Primero, verificar que los items existen
SELECT COUNT(*) FROM inventario.item;

-- Insertar configuración Kardex directamente
-- Hemograma (codigo_examen = 1) - Requiere Tubo EDTA + Guantes
INSERT INTO inventario.examen_insumo (codigo_examen, codigo_item, cantidad_requerida, activo) 
VALUES 
(1, 3, 1, true),
(1, 5, 1, true);

-- Glucosa (codigo_examen = 4) - Requiere Tubo + Reactivo + Guantes + Jeringa  
INSERT INTO inventario.examen_insumo (codigo_examen, codigo_item, cantidad_requerida, activo)
VALUES
(4, 4, 1, true),
(4, 1, 5, true),
(4, 5, 1, true),
(4, 6, 1, true);

SELECT 'Kardex configurado correctamente!' AS resultado;
