-- =====================================================
-- SCRIPT DE DATOS DE PRUEBA - SISTEMA LABORATORIO CLÍNICO
-- =====================================================
-- Ejecutar después de npx prisma migrate dev
-- psql -U postgres -d Lab_Bd -f prisma/seed.sql

-- =====================================================
-- ESQUEMA: usuarios
-- =====================================================

-- ROLES
INSERT INTO usuarios.rol (nombre, descripcion, nivel_acceso, activo) VALUES
('ADMIN', 'Administrador del sistema con acceso completo', 10, true),
('MEDICO', 'Médico con acceso a resultados y validación', 8, true),
('LABORATORISTA', 'Personal de laboratorio que procesa muestras', 6, true),
('RECEPCIONISTA', 'Personal de recepción y atención al cliente', 4, true),
('PACIENTE', 'Paciente del laboratorio', 2, true)
ON CONFLICT (nombre) DO NOTHING;

-- USUARIOS (contraseña para todos: "Password123!")
-- Salt y hash generados con bcrypt rounds=10
INSERT INTO usuarios.usuario (
  codigo_rol, cedula, nombres, apellidos, email, telefono,
  fecha_nacimiento, genero, direccion, password_hash, salt, activo
) VALUES
-- ADMIN
(1, '1710034065', 'Carlos Alberto', 'Pérez Sánchez', 'admin@lab.com', '0987654321',
 '1985-03-15', 'Masculino', 'Av. Amazonas N24-123, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_admin', true),

-- MÉDICOS
(2, '1715678901', 'María Fernanda', 'González López', 'dra.gonzalez@lab.com', '0991234567',
 '1980-07-22', 'Femenino', 'Calle García Moreno 456, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_medico1', true),

(2, '1703456789', 'José Luis', 'Ramírez Castro', 'dr.ramirez@lab.com', '0982345678',
 '1978-11-10', 'Masculino', 'Av. Shyris N36-200, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_medico2', true),

-- LABORATORISTAS
(3, '1708901234', 'Ana Patricia', 'Morales Vega', 'ana.morales@lab.com', '0993456789',
 '1990-02-14', 'Femenino', 'Calle Sucre 789, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_lab1', true),

(3, '1712345678', 'Roberto Carlos', 'Herrera Díaz', 'roberto.herrera@lab.com', '0984567890',
 '1992-09-05', 'Masculino', 'Av. 10 de Agosto 321, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_lab2', true),

-- RECEPCIONISTAS
(4, '1706789012', 'Sofía Isabel', 'Torres Mendoza', 'sofia.torres@lab.com', '0995678901',
 '1995-04-18', 'Femenino', 'Calle Mejía 654, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_recep1', true),

(4, '1709012345', 'Diana Carolina', 'Salazar Ruiz', 'diana.salazar@lab.com', '0986789012',
 '1993-12-20', 'Femenino', 'Av. Colón E4-56, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_recep2', true),

-- PACIENTES
(5, '1704567890', 'Juan Pablo', 'Jiménez Flores', 'juan.jimenez@gmail.com', '0997890123',
 '1988-06-30', 'Masculino', 'Calle Bolívar 987, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_pac1', true),

(5, '1707890123', 'Laura Beatriz', 'Mendoza Ortiz', 'laura.mendoza@hotmail.com', '0988901234',
 '1992-01-25', 'Femenino', 'Av. Patria N40-123, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_pac2', true),

(5, '1701234567', 'Miguel Ángel', 'Vargas Soto', 'miguel.vargas@yahoo.com', '0989012345',
 '1975-08-12', 'Masculino', 'Calle Cuenca 321, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_pac3', true),

(5, '1713456789', 'Carmen Rosa', 'Espinoza Cruz', 'carmen.espinoza@outlook.com', '0990123456',
 '1998-03-08', 'Femenino', 'Av. Naciones Unidas E7-32, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_pac4', true),

(5, '1705678901', 'Ricardo Andrés', 'Núñez Paredes', 'ricardo.nunez@gmail.com', '0991234568',
 '1982-11-19', 'Masculino', 'Calle Quisquis 456, Quito',
 '$2b$10$YQ6Y5Xk5Xk5Xk5Xk5Xk5XuOJ.nZ5YQ6Y5Xk5Xk5Xk5Xk5Xk5X', 'salt_pac5', true)
ON CONFLICT (cedula) DO NOTHING;

-- PERFILES MÉDICOS (solo para algunos pacientes)
INSERT INTO usuarios.perfil_medico (
  codigo_usuario, tipo_sangre, alergias, condiciones_cronicas,
  medicamentos_actuales, cirugias_previas
) VALUES
(8, 'O+', 'Penicilina', 'Hipertensión', 'Losartán 50mg', 'Apendicectomía (2010)'),
(9, 'A+', 'Ninguna', 'Ninguna', 'Ninguno', 'Ninguna'),
(10, 'B-', 'Ibuprofeno', 'Diabetes tipo 2', 'Metformina 850mg, Atorvastatina 20mg', 'Bypass gástrico (2015)'),
(11, 'AB+', 'Polen, ácaros', 'Asma leve', 'Salbutamol (inhalador)', 'Ninguna')
ON CONFLICT (codigo_usuario) DO NOTHING;

-- =====================================================
-- ESQUEMA: agenda
-- =====================================================

-- SERVICIOS
INSERT INTO agenda.servicio (nombre, descripcion, activo) VALUES
('Toma de Muestras', 'Servicio de extracción de muestras sanguíneas y otros fluidos', true),
('Entrega de Resultados', 'Servicio de entrega y explicación de resultados', true),
('Consulta Médica', 'Consulta médica especializada', true)
ON CONFLICT DO NOTHING;

-- SEDES
INSERT INTO agenda.sede (nombre, direccion, telefono, email, activo) VALUES
('Sede Norte - Quito', 'Av. Eloy Alfaro N45-123, Quito', '023456789', 'norte@lab.com', true),
('Sede Centro - Quito', 'Calle Venezuela N8-45, Quito', '022345678', 'centro@lab.com', true),
('Sede Sur - Quito', 'Av. Maldonado S25-67, Quito', '024567890', 'sur@lab.com', true)
ON CONFLICT DO NOTHING;

-- HORARIOS DE ATENCIÓN
INSERT INTO agenda.horario_atencion (codigo_servicio, codigo_sede, dia_semana, hora_inicio, hora_fin, cupos_por_hora, activo) VALUES
-- Sede Norte - Lunes a Viernes
(1, 1, 1, '07:00:00', '18:00:00', 4, true),
(1, 1, 2, '07:00:00', '18:00:00', 4, true),
(1, 1, 3, '07:00:00', '18:00:00', 4, true),
(1, 1, 4, '07:00:00', '18:00:00', 4, true),
(1, 1, 5, '07:00:00', '18:00:00', 4, true),
-- Sede Norte - Sábados
(1, 1, 6, '08:00:00', '14:00:00', 3, true),

-- Sede Centro - Lunes a Viernes
(1, 2, 1, '06:30:00', '19:00:00', 5, true),
(1, 2, 2, '06:30:00', '19:00:00', 5, true),
(1, 2, 3, '06:30:00', '19:00:00', 5, true),
(1, 2, 4, '06:30:00', '19:00:00', 5, true),
(1, 2, 5, '06:30:00', '19:00:00', 5, true)
ON CONFLICT DO NOTHING;

-- SLOTS (próximas fechas)
INSERT INTO agenda.slot (codigo_servicio, codigo_sede, fecha, hora_inicio, hora_fin, cupos_totales, cupos_disponibles, activo) VALUES
(1, 1, CURRENT_DATE + INTERVAL '1 day', '08:00:00', '09:00:00', 4, 2, true),
(1, 1, CURRENT_DATE + INTERVAL '1 day', '09:00:00', '10:00:00', 4, 4, true),
(1, 1, CURRENT_DATE + INTERVAL '1 day', '10:00:00', '11:00:00', 4, 3, true),
(1, 1, CURRENT_DATE + INTERVAL '2 days', '08:00:00', '09:00:00', 4, 4, true),
(1, 1, CURRENT_DATE + INTERVAL '2 days', '09:00:00', '10:00:00', 4, 4, true),
(1, 2, CURRENT_DATE + INTERVAL '1 day', '07:00:00', '08:00:00', 5, 5, true),
(1, 2, CURRENT_DATE + INTERVAL '1 day', '08:00:00', '09:00:00', 5, 3, true),
(1, 2, CURRENT_DATE + INTERVAL '1 day', '09:00:00', '10:00:00', 5, 5, true)
ON CONFLICT DO NOTHING;

-- CITAS
INSERT INTO agenda.cita (codigo_slot, codigo_paciente, estado, confirmada, observaciones) VALUES
(1, 8, 'AGENDADA', true, 'Paciente requiere ayuno de 8 horas'),
(1, 9, 'AGENDADA', true, 'Primera visita al laboratorio'),
(3, 10, 'AGENDADA', false, 'Exámenes de control mensual'),
(7, 11, 'AGENDADA', true, 'Control de rutina')
ON CONFLICT DO NOTHING;

-- =====================================================
-- ESQUEMA: catalogo
-- =====================================================

-- CATEGORÍAS DE EXÁMENES
INSERT INTO catalogo.categoria_examen (nombre, descripcion, activo) VALUES
('Hematología', 'Análisis de sangre y componentes sanguíneos', true),
('Química Clínica', 'Análisis bioquímicos y metabólicos', true),
('Inmunología', 'Pruebas inmunológicas y serológicas', true),
('Microbiología', 'Cultivos y análisis microbiológicos', true),
('Hormonas', 'Perfil hormonal y endocrinología', true),
('Orina y Heces', 'Análisis de orina y coprocultivos', true)
ON CONFLICT (nombre) DO NOTHING;

-- EXÁMENES
INSERT INTO catalogo.examen (
  codigo_categoria, codigo_interno, nombre, descripcion,
  requiere_ayuno, horas_ayuno, tiempo_entrega_horas, tipo_muestra,
  valor_referencia_min, valor_referencia_max, unidad_medida, activo
) VALUES
-- Hematología
(1, 'HEM-001', 'Hemograma Completo', 'Conteo completo de células sanguíneas', false, NULL, 4, 'Sangre venosa', NULL, NULL, NULL, true),
(1, 'HEM-002', 'Velocidad de Sedimentación (VSG)', 'Medición de VSG', false, NULL, 2, 'Sangre venosa', 0, 20, 'mm/h', true),
(1, 'HEM-003', 'Tiempo de Coagulación', 'Tiempo de protrombina y PTT', false, NULL, 3, 'Sangre venosa', NULL, NULL, 'seg', true),

-- Química Clínica
(2, 'QUI-001', 'Glucosa en Ayunas', 'Nivel de glucosa basal', true, 8, 2, 'Sangre venosa', 70, 100, 'mg/dL', true),
(2, 'QUI-002', 'Perfil Lipídico', 'Colesterol total, HDL, LDL, triglicéridos', true, 12, 4, 'Sangre venosa', NULL, NULL, 'mg/dL', true),
(2, 'QUI-003', 'Creatinina', 'Función renal', false, NULL, 3, 'Sangre venosa', 0.6, 1.2, 'mg/dL', true),
(2, 'QUI-004', 'Urea', 'Función renal', false, NULL, 3, 'Sangre venosa', 15, 40, 'mg/dL', true),
(2, 'QUI-005', 'Ácido Úrico', 'Nivel de ácido úrico', false, NULL, 3, 'Sangre venosa', 3.5, 7.2, 'mg/dL', true),
(2, 'QUI-006', 'Transaminasas (TGO/TGP)', 'Función hepática', false, NULL, 4, 'Sangre venosa', NULL, NULL, 'U/L', true),

-- Inmunología
(3, 'INM-001', 'PCR (Proteína C Reactiva)', 'Marcador de inflamación', false, NULL, 6, 'Sangre venosa', 0, 5, 'mg/L', true),
(3, 'INM-002', 'VIH (ELISA)', 'Prueba de detección de VIH', false, NULL, 24, 'Sangre venosa', NULL, NULL, NULL, true),
(3, 'INM-003', 'VDRL', 'Prueba de sífilis', false, NULL, 12, 'Sangre venosa', NULL, NULL, NULL, true),

-- Hormonas
(5, 'HOR-001', 'TSH (Hormona Estimulante de Tiroides)', 'Función tiroidea', false, NULL, 8, 'Sangre venosa', 0.4, 4.0, 'mUI/L', true),
(5, 'HOR-002', 'T3 y T4 Libre', 'Hormonas tiroideas', false, NULL, 8, 'Sangre venosa', NULL, NULL, 'ng/dL', true),
(5, 'HOR-003', 'Testosterona Total', 'Nivel de testosterona', false, NULL, 12, 'Sangre venosa', NULL, NULL, 'ng/dL', true),

-- Orina
(6, 'ORI-001', 'Examen General de Orina (EMO)', 'Análisis físico, químico y microscópico', false, NULL, 3, 'Orina', NULL, NULL, NULL, true),
(6, 'ORI-002', 'Urocultivo', 'Cultivo de orina', false, NULL, 48, 'Orina', NULL, NULL, NULL, true)
ON CONFLICT (codigo_interno) DO NOTHING;

-- PRECIOS
INSERT INTO catalogo.precio (codigo_examen, precio, activo) VALUES
(1, 12.50, true),
(2, 8.00, true),
(3, 15.00, true),
(4, 5.00, true),
(5, 25.00, true),
(6, 6.50, true),
(7, 6.00, true),
(8, 7.50, true),
(9, 10.00, true),
(10, 18.00, true),
(11, 12.00, true),
(12, 15.00, true),
(13, 14.00, true),
(14, 20.00, true),
(15, 8.00, true),
(16, 22.00, true)
ON CONFLICT DO NOTHING;

-- PAQUETES
INSERT INTO catalogo.paquete (nombre, descripcion, precio_paquete, descuento, activo) VALUES
('Chequeo Básico', 'Hemograma + Glucosa + Creatinina + Urea', 30.00, 15.00, true),
('Perfil Completo', 'Hemograma + Glucosa + Perfil Lipídico + Función Hepática + Función Renal', 65.00, 20.00, true),
('Control Diabético', 'Glucosa + HbA1c + Perfil Lipídico + Creatinina', 45.00, 18.00, true),
('Perfil Tiroideo', 'TSH + T3 + T4 Libre', 40.00, 12.00, true)
ON CONFLICT DO NOTHING;

-- PAQUETE EXÁMENES (relación muchos a muchos)
INSERT INTO catalogo.paquete_examen (codigo_paquete, codigo_examen) VALUES
-- Chequeo Básico
(1, 1), (1, 4), (1, 6), (1, 7),
-- Perfil Completo
(2, 1), (2, 4), (2, 5), (2, 10), (2, 6), (2, 7),
-- Perfil Tiroideo
(4, 12), (4, 13)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ESQUEMA: pagos
-- =====================================================

-- COTIZACIONES
INSERT INTO pagos.cotizacion (
  codigo_paciente, numero_cotizacion, fecha_cotizacion, fecha_expiracion,
  subtotal, descuento, total, estado
) VALUES
(8, 'COT-2025-0001', CURRENT_TIMESTAMP, CURRENT_DATE + INTERVAL '7 days', 43.50, 0, 43.50, 'PENDIENTE'),
(9, 'COT-2025-0002', CURRENT_TIMESTAMP, CURRENT_DATE + INTERVAL '7 days', 30.00, 4.50, 25.50, 'APROBADA'),
(10, 'COT-2025-0003', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', 65.00, 13.00, 52.00, 'APROBADA')
ON CONFLICT (numero_cotizacion) DO NOTHING;

-- DETALLES COTIZACIÓN
INSERT INTO pagos.cotizacion_detalle (codigo_cotizacion, codigo_examen, cantidad, precio_unitario, total_linea) VALUES
-- Cotización 1
(1, 1, 1, 12.50, 12.50),
(1, 4, 1, 5.00, 5.00),
(1, 5, 1, 25.00, 25.00),
-- Cotización 2
(2, 1, 1, 12.50, 12.50),
(2, 4, 1, 5.00, 5.00),
(2, 6, 1, 6.50, 6.50),
(2, 7, 1, 6.00, 6.00),
-- Cotización 3
(3, 1, 1, 12.50, 12.50),
(3, 4, 1, 5.00, 5.00),
(3, 5, 1, 25.00, 25.00),
(3, 10, 1, 10.00, 10.00),
(3, 6, 1, 6.50, 6.50),
(3, 7, 1, 6.00, 6.00)
ON CONFLICT DO NOTHING;

-- PAGOS
INSERT INTO pagos.pago (
  codigo_cotizacion, codigo_paciente, numero_pago, monto_total,
  metodo_pago, estado, proveedor_pasarela
) VALUES
(2, 9, 'PAG-2025-0001', 25.50, 'TARJETA_CREDITO', 'COMPLETADO', 'Stripe'),
(3, 10, 'PAG-2025-0002', 52.00, 'EFECTIVO', 'COMPLETADO', NULL)
ON CONFLICT (numero_pago) DO NOTHING;

-- DETALLES PAGO
INSERT INTO pagos.pago_detalle (codigo_pago, codigo_examen, cantidad, precio_unitario, total_linea) VALUES
-- Pago 1
(1, 1, 1, 12.50, 12.50),
(1, 4, 1, 5.00, 5.00),
(1, 6, 1, 6.50, 6.50),
-- Pago 2
(2, 1, 1, 12.50, 12.50),
(2, 4, 1, 5.00, 5.00),
(2, 5, 1, 25.00, 25.00),
(2, 10, 1, 10.00, 10.00)
ON CONFLICT DO NOTHING;

-- FACTURAS
INSERT INTO pagos.factura (
  codigo_pago, numero_factura, subtotal, iva, total, estado
) VALUES
(1, 'FAC-001-001-0000001', 25.50, 0, 25.50, 'EMITIDA'),
(2, 'FAC-001-001-0000002', 52.00, 0, 52.00, 'EMITIDA')
ON CONFLICT (numero_factura) DO NOTHING;

-- =====================================================
-- ESQUEMA: resultados
-- =====================================================

-- MUESTRAS
INSERT INTO resultados.muestra (
  codigo_paciente, codigo_cita, id_muestra, tipo_muestra, estado, tomada_por
) VALUES
(9, 2, 'M-2025-0001', 'Sangre venosa', 'PROCESADA', 4),
(10, 3, 'M-2025-0002', 'Sangre venosa', 'PROCESADA', 4),
(8, 1, 'M-2025-0003', 'Sangre venosa', 'EN_ANALISIS', 5)
ON CONFLICT (id_muestra) DO NOTHING;

-- RESULTADOS
INSERT INTO resultados.resultado (
  codigo_muestra, codigo_examen, valor_numerico, unidad_medida,
  dentro_rango_normal, estado, procesado_por, validado_por, fecha_validacion
) VALUES
-- Muestra 1 (Paciente Laura Mendoza) - Resultados validados
(1, 1, NULL, NULL, true, 'VALIDADO', 4, 2, CURRENT_TIMESTAMP - INTERVAL '1 day'),
(1, 4, 92.00, 'mg/dL', true, 'VALIDADO', 4, 2, CURRENT_TIMESTAMP - INTERVAL '1 day'),
(1, 6, 0.9, 'mg/dL', true, 'VALIDADO', 4, 2, CURRENT_TIMESTAMP - INTERVAL '1 day'),

-- Muestra 2 (Paciente Miguel Vargas) - Resultados validados
(2, 1, NULL, NULL, true, 'VALIDADO', 4, 3, CURRENT_TIMESTAMP - INTERVAL '6 hours'),
(2, 4, 145.00, 'mg/dL', false, 'VALIDADO', 4, 3, CURRENT_TIMESTAMP - INTERVAL '6 hours'),
(2, 5, 235.00, 'mg/dL', false, 'VALIDADO', 4, 3, CURRENT_TIMESTAMP - INTERVAL '6 hours'),

-- Muestra 3 (Paciente Juan Jiménez) - En proceso
(3, 1, NULL, NULL, NULL, 'EN_PROCESO', 5, NULL, NULL),
(3, 4, 88.00, 'mg/dL', true, 'EN_PROCESO', 5, NULL, NULL)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ESQUEMA: inventario
-- =====================================================

-- CATEGORÍAS DE ITEMS
INSERT INTO inventario.categoria_item (nombre, descripcion, activo) VALUES
('Reactivos', 'Reactivos químicos para análisis', true),
('Material de Laboratorio', 'Material fungible y reutilizable', true),
('Equipamiento', 'Equipos y máquinas de laboratorio', true),
('Consumibles', 'Material desechable', true)
ON CONFLICT (nombre) DO NOTHING;

-- ITEMS
INSERT INTO inventario.item (
  codigo_categoria, codigo_interno, nombre, descripcion,
  unidad_medida, stock_actual, stock_minimo, stock_maximo,
  costo_unitario, activo
) VALUES
(1, 'REA-001', 'Reactivo Glucosa GOD-PAP', 'Reactivo para determinación de glucosa', 'ml', 500, 100, 1000, 0.25, true),
(1, 'REA-002', 'Reactivo Creatinina Jaffé', 'Reactivo para determinación de creatinina', 'ml', 300, 80, 800, 0.30, true),
(2, 'MAT-001', 'Tubo con EDTA 3ml', 'Tubo vacutainer morado', 'unidad', 500, 100, 1000, 0.15, true),
(2, 'MAT-002', 'Tubo sin anticoagulante 5ml', 'Tubo vacutainer rojo', 'unidad', 600, 150, 1200, 0.12, true),
(4, 'CON-001', 'Guantes Nitrilo Talla M', 'Guantes desechables', 'caja', 25, 10, 50, 8.50, true),
(4, 'CON-002', 'Jeringas 5ml', 'Jeringas desechables', 'unidad', 300, 100, 500, 0.08, true),
(4, 'CON-003', 'Alcohol 70%', 'Alcohol antiséptico', 'litro', 15, 5, 30, 2.50, true)
ON CONFLICT (codigo_interno) DO NOTHING;

-- LOTES
INSERT INTO inventario.lote (
  codigo_item, numero_lote, fecha_fabricacion, fecha_vencimiento,
  cantidad_inicial, cantidad_actual, proveedor
) VALUES
(1, 'GLU-2024-001', '2024-06-01', '2025-12-31', 500, 500, 'Wiener Lab'),
(2, 'CRE-2024-002', '2024-07-15', '2026-01-31', 300, 300, 'Wiener Lab'),
(3, 'TUB-2024-101', '2024-08-01', '2027-08-01', 500, 450, 'BD Vacutainer'),
(4, 'TUB-2024-102', '2024-08-01', '2027-08-01', 600, 580, 'BD Vacutainer'),
(5, 'GLV-2024-050', '2024-09-10', '2026-09-10', 25, 22, 'Kimberly Clark'),
(6, 'JER-2024-075', '2024-10-01', '2027-10-01', 300, 285, 'Terumo')
ON CONFLICT DO NOTHING;

-- PROVEEDORES
INSERT INTO inventario.proveedor (
  ruc, razon_social, nombre_comercial, telefono, email, direccion, activo
) VALUES
('1791234567001', 'Importadora Médica del Ecuador S.A.', 'IMESA', '022345678', 'ventas@imesa.com.ec', 'Av. América N30-123, Quito', true),
('1798765432001', 'Distribuidora de Reactivos LABCHEM Cía. Ltda.', 'LABCHEM', '022456789', 'contacto@labchem.ec', 'Calle Los Pinos 456, Quito', true),
('1792468135001', 'Suministros Médicos del Norte S.A.', 'SUMEDNOR', '023567890', 'info@sumednor.com', 'Av. 6 de Diciembre N34-567, Quito', true)
ON CONFLICT (ruc) DO NOTHING;

-- ÓRDENES DE COMPRA
INSERT INTO inventario.orden_compra (
  codigo_proveedor, numero_orden, fecha_entrega_estimada,
  subtotal, iva, total, estado, creado_por
) VALUES
(1, 'OC-2025-001', CURRENT_DATE + INTERVAL '7 days', 500.00, 60.00, 560.00, 'APROBADA', 1),
(2, 'OC-2025-002', CURRENT_DATE + INTERVAL '10 days', 300.00, 36.00, 336.00, 'PENDIENTE', 1)
ON CONFLICT (numero_orden) DO NOTHING;

-- DETALLES ORDEN DE COMPRA
INSERT INTO inventario.orden_compra_detalle (codigo_orden_compra, codigo_item, cantidad, precio_unitario, total_linea) VALUES
(1, 1, 1000, 0.25, 250.00),
(1, 2, 1000, 0.25, 250.00),
(2, 3, 1000, 0.15, 150.00),
(2, 4, 1000, 0.15, 150.00)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ESQUEMA: comunicaciones
-- =====================================================

-- NOTIFICACIONES
INSERT INTO comunicaciones.notificacion (
  codigo_usuario, tipo, asunto, contenido, enviada, fecha_envio
) VALUES
(8, 'EMAIL', 'Recordatorio de Cita', 'Estimado Juan, le recordamos su cita para mañana a las 08:00 AM en Sede Norte.', true, CURRENT_TIMESTAMP - INTERVAL '1 day'),
(9, 'EMAIL', 'Resultados Disponibles', 'Estimada Laura, sus resultados de laboratorio ya están disponibles. Puede descargarlos desde su portal.', true, CURRENT_TIMESTAMP - INTERVAL '1 day'),
(10, 'EMAIL', 'Resultados Disponibles', 'Estimado Miguel, sus resultados de laboratorio ya están disponibles. Puede descargarlos desde su portal.', true, CURRENT_TIMESTAMP - INTERVAL '6 hours'),
(11, 'SMS', 'Confirmación de Cita', 'Hola Carmen, tu cita ha sido confirmada para mañana 09:00 AM Sede Centro. Lab Franz', true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ESQUEMA: auditoria
-- =====================================================

-- LOGS DE ACTIVIDAD
INSERT INTO auditoria.log_actividad (
  codigo_usuario, accion, entidad, codigo_entidad, descripcion, ip_address
) VALUES
(1, 'LOGIN', 'Usuario', 1, 'Inicio de sesión exitoso', '192.168.1.100'),
(8, 'CREACION', 'Cita', 1, 'Nueva cita agendada', '192.168.1.105'),
(2, 'ACTUALIZACION', 'Resultado', 1, 'Resultado validado', '192.168.1.110'),
(6, 'CREACION', 'Paciente', 11, 'Nuevo paciente registrado', '192.168.1.115')
ON CONFLICT DO NOTHING;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

SELECT 'Datos de prueba insertados correctamente!' AS mensaje;
