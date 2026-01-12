-- Verificar si existe la tabla examen_insumo
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'inventario'
   AND table_name = 'examen_insumo'
);

-- Si no existe, crearla manualmente
CREATE TABLE IF NOT EXISTS inventario.examen_insumo (
  codigo_examen_insumo SERIAL PRIMARY KEY,
  codigo_examen INT NOT NULL,
  codigo_item INT NOT NULL,
  cantidad_requerida DECIMAL(10,2) NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT examen_insumo_codigo_examen_fkey 
    FOREIGN KEY (codigo_examen) REFERENCES catalogo.examen(codigo_examen),
  CONSTRAINT examen_insumo_codigo_item_fkey 
    FOREIGN KEY (codigo_item) REFERENCES inventario.item(codigo_item)
);

-- Mensaje de confirmación
SELECT 'Tabla examen_insumo verificada/creada' AS resultado;
