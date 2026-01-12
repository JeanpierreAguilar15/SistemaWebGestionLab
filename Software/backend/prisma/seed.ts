import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper function to create time from HH:MM:SS string
function createTime(timeString: string): Date {
  const [hours, minutes, seconds] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, seconds || 0, 0);
  return date;
}

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create roles
  console.log('Creating roles...');
  const roles = await Promise.all([
    prisma.rol.upsert({
      where: { nombre: 'ADMIN' },
      update: {},
      create: {
        nombre: 'ADMIN',
        descripcion: 'Administrador del sistema con acceso total',
        nivel_acceso: 10,
        activo: true,
      },
    }),
    prisma.rol.upsert({
      where: { nombre: 'PERSONAL_LAB' },
      update: {},
      create: {
        nombre: 'PERSONAL_LAB',
        descripcion: 'Personal del laboratorio (técnicos, bioquímicos)',
        nivel_acceso: 7,
        activo: true,
      },
    }),
    prisma.rol.upsert({
      where: { nombre: 'MEDICO' },
      update: {},
      create: {
        nombre: 'MEDICO',
        descripcion: 'Médico con acceso a resultados de pacientes',
        nivel_acceso: 5,
        activo: true,
      },
    }),
    prisma.rol.upsert({
      where: { nombre: 'RECEPCION' },
      update: {},
      create: {
        nombre: 'RECEPCION',
        descripcion: 'Personal de recepción',
        nivel_acceso: 3,
        activo: true,
      },
    }),
    prisma.rol.upsert({
      where: { nombre: 'PACIENTE' },
      update: {},
      create: {
        nombre: 'PACIENTE',
        descripcion: 'Paciente del laboratorio',
        nivel_acceso: 1,
        activo: true,
      },
    }),
  ]);

  console.log(`✅ Created ${roles.length} roles`);

  // 2. Create admin user
  console.log('Creating admin user...');
  const adminCedula = process.env.ADMIN_CEDULA || '1710034065';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lab.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const adminRole = roles.find((r) => r.nombre === 'ADMIN');

  const existingAdmin = await prisma.usuario.findFirst({
    where: {
      OR: [{ cedula: adminCedula }, { email: adminEmail }],
    },
  });

  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(adminPassword, salt);

    const admin = await prisma.usuario.create({
      data: {
        codigo_rol: adminRole.codigo_rol,
        cedula: adminCedula,
        nombres: 'Administrador',
        apellidos: 'Sistema',
        email: adminEmail,
        password_hash,
        salt,
        email_verificado: true,
        activo: true,
      },
    });

    console.log(`✅ Created admin user: ${admin.email}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
  }

  // 2.1. Create test users (different roles)
  console.log('Creating test users...');
  const pacienteRole = roles.find((r) => r.nombre === 'PACIENTE');
  const recepcionRole = roles.find((r) => r.nombre === 'RECEPCION');
  const personalLabRole = roles.find((r) => r.nombre === 'PERSONAL_LAB');

  // Helper function to create users
  async function createUserIfNotExists(userData: any) {
    const existing = await prisma.usuario.findFirst({
      where: {
        OR: [{ cedula: userData.cedula }, { email: userData.email }],
      },
    });

    if (!existing) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(userData.password, salt);
      const { password, ...userDataWithoutPassword } = userData;

      return await prisma.usuario.create({
        data: {
          ...userDataWithoutPassword,
          password_hash,
          salt,
        },
      });
    }
    return existing;
  }

  // Create pacientes de prueba
  const pacientes = [
    {
      codigo_rol: pacienteRole.codigo_rol,
      cedula: '1721456789',
      nombres: 'María José',
      apellidos: 'González Pérez',
      email: 'maria.gonzalez@example.com',
      telefono: '0987654321',
      fecha_nacimiento: new Date('1990-05-15'),
      genero: 'Femenino',
      direccion: 'Av. 6 de Diciembre N34-123, Quito',
      password: 'Paciente123!',
      email_verificado: true,
      activo: true,
    },
    {
      codigo_rol: pacienteRole.codigo_rol,
      cedula: '1712345678',
      nombres: 'Juan Carlos',
      apellidos: 'Morales Sánchez',
      email: 'juan.morales@example.com',
      telefono: '0998765432',
      fecha_nacimiento: new Date('1985-08-22'),
      genero: 'Masculino',
      direccion: 'Av. América N45-678, Quito',
      password: 'Paciente123!',
      email_verificado: true,
      activo: true,
    },
    {
      codigo_rol: pacienteRole.codigo_rol,
      cedula: '1723456789',
      nombres: 'Ana Patricia',
      apellidos: 'Rodríguez López',
      email: 'ana.rodriguez@example.com',
      telefono: '0976543210',
      fecha_nacimiento: new Date('1995-12-10'),
      genero: 'Femenino',
      direccion: 'Calle Los Pinos 123, Quito',
      password: 'Paciente123!',
      email_verificado: true,
      activo: true,
    },
  ];

  let testPaciente; // Store reference to first paciente for test data
  for (let i = 0; i < pacientes.length; i++) {
    const pacienteData = pacientes[i];
    const paciente = await createUserIfNotExists(pacienteData);

    // Store first paciente for test data
    if (i === 0) {
      testPaciente = paciente;
    }

    // Create perfil médico for each paciente
    const existingPerfil = await prisma.perfilMedico.findUnique({
      where: { codigo_usuario: paciente.codigo_usuario },
    });

    if (!existingPerfil) {
      await prisma.perfilMedico.create({
        data: {
          codigo_usuario: paciente.codigo_usuario,
          tipo_sangre: paciente.nombres === 'María José' ? 'O+' : paciente.nombres === 'Juan Carlos' ? 'A+' : 'B+',
          alergias: paciente.nombres === 'María José' ? 'Penicilina, Polen' : null,
          condiciones_cronicas: paciente.nombres === 'Juan Carlos' ? 'Hipertensión' : null,
          medicamentos_actuales: paciente.nombres === 'Juan Carlos' ? 'Losartán 50mg' : null,
        },
      });
    }

    console.log(`✅ Created paciente: ${paciente.email}`);
  }

  // Create recepcionista
  const recepcionista = await createUserIfNotExists({
    codigo_rol: recepcionRole.codigo_rol,
    cedula: '1734567890',
    nombres: 'Laura',
    apellidos: 'Martínez Vega',
    email: 'recepcion@lab.com',
    telefono: '0987123456',
    fecha_nacimiento: new Date('1992-03-18'),
    genero: 'Femenino',
    direccion: 'Av. Shyris N35-456, Quito',
    password: 'Recepcion123!',
    email_verificado: true,
    activo: true,
  });
  console.log(`✅ Created recepcionista: ${recepcionista.email}`);

  // Create personal de laboratorio
  const personalLab = await createUserIfNotExists({
    codigo_rol: personalLabRole.codigo_rol,
    cedula: '1745678901',
    nombres: 'Carlos Alberto',
    apellidos: 'Ramírez Torres',
    email: 'laboratorio@lab.com',
    telefono: '0976543219',
    fecha_nacimiento: new Date('1988-07-25'),
    genero: 'Masculino',
    direccion: 'Av. República N23-789, Quito',
    password: 'Personal123!',
    email_verificado: true,
    activo: true,
  });
  console.log(`✅ Created personal de laboratorio: ${personalLab.email}`);

  // Create médico de prueba
  const medicoRole = roles.find((r) => r.nombre === 'MEDICO');
  const medico = await createUserIfNotExists({
    codigo_rol: medicoRole.codigo_rol,
    cedula: '1756789012',
    nombres: 'Dr. Juan Carlos',
    apellidos: 'Méndez Silva',
    email: 'medico@lab.com',
    telefono: '0965432108',
    fecha_nacimiento: new Date('1980-11-10'),
    genero: 'Masculino',
    direccion: 'Av. 10 de Agosto N45-678, Quito',
    password: 'Medico123!',
    email_verificado: true,
    activo: true,
  });
  console.log(`✅ Created médico: ${medico.email}`);

  // 3. Create sede (location)
  console.log('Creating sede...');
  const sede = await prisma.sede.upsert({
    where: { codigo_sede: 1 },
    update: {},
    create: {
      nombre: 'Laboratorio Franz - Sede Principal',
      direccion: 'Av. Principal #123, Quito, Ecuador',
      telefono: '0234567890',
      email: 'info@laboratorifranz.com',
      activo: true,
    },
  });
  console.log(`✅ Created sede: ${sede.nombre}`);

  // 4. Create servicios
  console.log('Creating servicios...');
  const servicios = await Promise.all([
    prisma.servicio.upsert({
      where: { codigo_servicio: 1 },
      update: {},
      create: {
        nombre: 'Toma de Muestras',
        descripcion: 'Servicio de toma de muestras de sangre, orina, etc.',
        activo: true,
      },
    }),
    prisma.servicio.upsert({
      where: { codigo_servicio: 2 },
      update: {},
      create: {
        nombre: 'Entrega de Resultados',
        descripcion: 'Servicio de entrega de resultados',
        activo: true,
      },
    }),
  ]);
  console.log(`✅ Created ${servicios.length} servicios`);

  // 5. Create categorias de examenes
  console.log('Creating categorías de exámenes...');
  const categorias = await Promise.all([
    prisma.categoriaExamen.upsert({
      where: { nombre: 'Hematología' },
      update: {},
      create: {
        nombre: 'Hematología',
        descripcion: 'Exámenes relacionados con la sangre',
        activo: true,
      },
    }),
    prisma.categoriaExamen.upsert({
      where: { nombre: 'Bioquímica' },
      update: {},
      create: {
        nombre: 'Bioquímica',
        descripcion: 'Exámenes bioquímicos',
        activo: true,
      },
    }),
    prisma.categoriaExamen.upsert({
      where: { nombre: 'Urianálisis' },
      update: {},
      create: {
        nombre: 'Urianálisis',
        descripcion: 'Exámenes de orina',
        activo: true,
      },
    }),
    prisma.categoriaExamen.upsert({
      where: { nombre: 'Inmunología' },
      update: {},
      create: {
        nombre: 'Inmunología',
        descripcion: 'Pruebas inmunológicas',
        activo: true,
      },
    }),
  ]);
  console.log(`✅ Created ${categorias.length} categorías`);

  // 6. Create examenes
  console.log('Creating exámenes...');
  const hematologia = categorias.find((c) => c.nombre === 'Hematología');
  const bioquimica = categorias.find((c) => c.nombre === 'Bioquímica');
  const urianalisis = categorias.find((c) => c.nombre === 'Urianálisis');

  const examenes = [
    {
      codigo_interno: 'HCTO-001',
      nombre: 'Hemograma Completo',
      codigo_categoria: hematologia.codigo_categoria,
      descripcion: 'Análisis completo de células sanguíneas',
      requiere_ayuno: false,
      tiempo_entrega_horas: 24,
      tipo_muestra: 'Sangre',
      precio: 15.0,
    },
    {
      codigo_interno: 'BIOQ-001',
      nombre: 'Glucosa en Ayunas',
      codigo_categoria: bioquimica.codigo_categoria,
      descripcion: 'Medición de glucosa en sangre',
      requiere_ayuno: true,
      horas_ayuno: 8,
      instrucciones_preparacion: 'Ayuno de 8-12 horas. Solo puede tomar agua.',
      tiempo_entrega_horas: 4,
      tipo_muestra: 'Sangre',
      valor_referencia_min: 70,
      valor_referencia_max: 100,
      unidad_medida: 'mg/dL',
      precio: 5.0,
    },
    {
      codigo_interno: 'BIOQ-002',
      nombre: 'Perfil Lipídico',
      codigo_categoria: bioquimica.codigo_categoria,
      descripcion: 'Colesterol total, HDL, LDL, Triglicéridos',
      requiere_ayuno: true,
      horas_ayuno: 12,
      instrucciones_preparacion: 'Ayuno de 12 horas. Solo puede tomar agua.',
      tiempo_entrega_horas: 24,
      tipo_muestra: 'Sangre',
      precio: 25.0,
    },
    {
      codigo_interno: 'URIN-001',
      nombre: 'Examen General de Orina',
      codigo_categoria: urianalisis.codigo_categoria,
      descripcion: 'Análisis físico, químico y microscópico de orina',
      requiere_ayuno: false,
      instrucciones_preparacion: 'Primera orina de la mañana preferiblemente',
      tiempo_entrega_horas: 4,
      tipo_muestra: 'Orina',
      precio: 8.0,
    },
    {
      codigo_interno: 'BIOQ-003',
      nombre: 'Creatinina',
      codigo_categoria: bioquimica.codigo_categoria,
      descripcion: 'Evaluación de función renal',
      requiere_ayuno: false,
      tiempo_entrega_horas: 24,
      tipo_muestra: 'Sangre',
      valor_referencia_min: 0.6,
      valor_referencia_max: 1.2,
      unidad_medida: 'mg/dL',
      precio: 8.0,
    },
  ];

  for (const examen of examenes) {
    const { precio, ...examenData } = examen;
    const examenCreado = await prisma.examen.upsert({
      where: { codigo_interno: examen.codigo_interno },
      update: {},
      create: examenData,
    });

    // Create precio for examen
    await prisma.precio.upsert({
      where: { codigo_precio: examenCreado.codigo_examen },
      update: {},
      create: {
        codigo_examen: examenCreado.codigo_examen,
        precio,
        activo: true,
      },
    });
  }
  console.log(`✅ Created ${examenes.length} exámenes with prices`);

  // 7. Create categorias de inventario
  console.log('Creating categorías de inventario...');
  await Promise.all([
    prisma.categoriaItem.upsert({
      where: { nombre: 'Reactivos' },
      update: {},
      create: {
        nombre: 'Reactivos',
        descripcion: 'Reactivos químicos para análisis',
        activo: true,
      },
    }),
    prisma.categoriaItem.upsert({
      where: { nombre: 'Insumos' },
      update: {},
      create: {
        nombre: 'Insumos',
        descripcion: 'Insumos consumibles (tubos, agujas, etc.)',
        activo: true,
      },
    }),
    prisma.categoriaItem.upsert({
      where: { nombre: 'Equipamiento' },
      update: {},
      create: {
        nombre: 'Equipamiento',
        descripcion: 'Equipos de laboratorio',
        activo: true,
      },
    }),
  ]);

  // 8. Create paquetes de exámenes
  console.log('Creating paquetes de exámenes...');
  const examenesCreados = await prisma.examen.findMany({
    orderBy: { codigo_examen: 'asc' },
    take: 5,
  });

  const paquetes = [
    {
      nombre: 'Paquete Básico de Salud',
      descripcion: 'Incluye hemograma completo y glucosa en ayunas',
      precio_paquete: 18.0, // Descuento del 10% sobre precio individual
      descuento: 10.0,
      examenes: [examenesCreados[0].codigo_examen, examenesCreados[1].codigo_examen], // Hemograma + Glucosa
    },
    {
      nombre: 'Paquete Chequeo Completo',
      descripcion: 'Hemograma, glucosa, perfil lipídico y creatinina',
      precio_paquete: 48.0, // Descuento del 15% sobre precio individual
      descuento: 15.0,
      examenes: [
        examenesCreados[0].codigo_examen,
        examenesCreados[1].codigo_examen,
        examenesCreados[2].codigo_examen,
        examenesCreados[4].codigo_examen,
      ], // Hemograma + Glucosa + Perfil Lipídico + Creatinina
    },
    {
      nombre: 'Paquete Pre-Operatorio',
      descripcion: 'Exámenes requeridos antes de cirugía',
      precio_paquete: 45.0, // Descuento del 12% sobre precio individual
      descuento: 12.0,
      examenes: [
        examenesCreados[0].codigo_examen,
        examenesCreados[1].codigo_examen,
        examenesCreados[3].codigo_examen,
        examenesCreados[4].codigo_examen,
      ], // Hemograma + Glucosa + Orina + Creatinina
    },
  ];

  for (const paqueteData of paquetes) {
    const { examenes: examenesIds, ...paqueteInfo } = paqueteData;
    const paquete = await prisma.paquete.upsert({
      where: { codigo_paquete: paquetes.indexOf(paqueteData) + 1 },
      update: {},
      create: paqueteInfo,
    });

    // Relacionar exámenes con el paquete
    for (const codigo_examen of examenesIds) {
      await prisma.paqueteExamen.upsert({
        where: {
          codigo_paquete_examen: paquete.codigo_paquete * 100 + codigo_examen,
        },
        update: {},
        create: {
          codigo_paquete: paquete.codigo_paquete,
          codigo_examen: codigo_examen,
        },
      });
    }
  }
  console.log(`✅ Created ${paquetes.length} paquetes de exámenes`);

  // 9. Create proveedores
  console.log('Creating proveedores...');
  const proveedores = [
    {
      ruc: '1790123456001',
      razon_social: 'BioLab Ecuador S.A.',
      nombre_comercial: 'BioLab',
      telefono: '0223456789',
      email: 'ventas@biolab.com.ec',
      direccion: 'Av. De la República N45-123, Quito',
      activo: true,
    },
    {
      ruc: '1790234567001',
      razon_social: 'MedSupply Distribuciones Cia. Ltda.',
      nombre_comercial: 'MedSupply',
      telefono: '0223456790',
      email: 'contacto@medsupply.com.ec',
      direccion: 'Av. 10 de Agosto N34-567, Quito',
      activo: true,
    },
    {
      ruc: '1790345678001',
      razon_social: 'Reactivos y Equipos del Ecuador',
      nombre_comercial: 'Reactivos Ecuador',
      telefono: '0223456791',
      email: 'info@reactivosecuador.com',
      direccion: 'Av. Amazonas N23-890, Quito',
      activo: true,
    },
  ];

  for (const proveedorData of proveedores) {
    await prisma.proveedor.upsert({
      where: { ruc: proveedorData.ruc },
      update: {},
      create: proveedorData,
    });
  }
  console.log(`✅ Created ${proveedores.length} proveedores`);

  // 10. Create items de inventario
  console.log('Creating items de inventario...');
  const categoriaReactivos = await prisma.categoriaItem.findUnique({
    where: { nombre: 'Reactivos' },
  });
  const categoriaInsumos = await prisma.categoriaItem.findUnique({
    where: { nombre: 'Insumos' },
  });

  const items = [
    {
      codigo_interno: 'REAC-001',
      nombre: 'Reactivo para Glucosa (500ml)',
      descripcion: 'Reactivo enzimático para determinación de glucosa',
      unidad_medida: 'Frasco',
      stock_actual: 15,
      stock_minimo: 5,
      stock_maximo: 30,
      costo_unitario: 45.0,
      precio_venta: 60.0,
      codigo_categoria: categoriaReactivos.codigo_categoria,
      activo: true,
    },
    {
      codigo_interno: 'REAC-002',
      nombre: 'Kit Hemograma Automatizado',
      descripcion: 'Kit de 100 determinaciones para hemograma',
      unidad_medida: 'Kit',
      stock_actual: 8,
      stock_minimo: 3,
      stock_maximo: 15,
      costo_unitario: 120.0,
      precio_venta: 150.0,
      codigo_categoria: categoriaReactivos.codigo_categoria,
      activo: true,
    },
    {
      codigo_interno: 'INSU-001',
      nombre: 'Tubos Vacutainer EDTA (100 unidades)',
      descripcion: 'Tubos con anticoagulante EDTA para hematología',
      unidad_medida: 'Caja',
      stock_actual: 25,
      stock_minimo: 10,
      stock_maximo: 50,
      costo_unitario: 15.0,
      precio_venta: 20.0,
      codigo_categoria: categoriaInsumos.codigo_categoria,
      activo: true,
    },
    {
      codigo_interno: 'INSU-002',
      nombre: 'Agujas Vacutainer 21G (100 unidades)',
      descripcion: 'Agujas estériles para extracción de sangre',
      unidad_medida: 'Caja',
      stock_actual: 30,
      stock_minimo: 15,
      stock_maximo: 60,
      costo_unitario: 8.0,
      precio_venta: 12.0,
      codigo_categoria: categoriaInsumos.codigo_categoria,
      activo: true,
    },
    {
      codigo_interno: 'INSU-003',
      nombre: 'Recipientes para Orina (50 unidades)',
      descripcion: 'Recipientes estériles para recolección de orina',
      unidad_medida: 'Caja',
      stock_actual: 20,
      stock_minimo: 8,
      stock_maximo: 40,
      costo_unitario: 5.0,
      precio_venta: 8.0,
      codigo_categoria: categoriaInsumos.codigo_categoria,
      activo: true,
    },
  ];

  for (const itemData of items) {
    await prisma.item.upsert({
      where: { codigo_interno: itemData.codigo_interno },
      update: {},
      create: itemData,
    });
  }
  console.log(`✅ Created ${items.length} items de inventario`);

  // 11. Create horarios (schedules for services)
  console.log('Creating horarios...');
  const horarios = [];
  const diasSemana = [1, 2, 3, 4, 5]; // Lunes a Viernes
  for (const dia of diasSemana) {
    const horario = await prisma.horarioAtencion.upsert({
      where: { codigo_horario: dia },
      update: {},
      create: {
        codigo_servicio: servicios[0].codigo_servicio, // Toma de Muestras
        codigo_sede: sede.codigo_sede,
        dia_semana: dia,
        hora_inicio: createTime('08:00:00'),
        hora_fin: createTime('16:00:00'),
        activo: true,
      },
    });
    horarios.push(horario);
  }
  console.log(`✅ Created ${horarios.length} horarios`);

  // 12. Create slots for appointments (próximos 7 días)
  console.log('Creating slots for appointments...');
  const slots = [];
  const hoy = new Date();
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);
    const diaSemana = fecha.getDay();

    // Skip weekends
    if (diaSemana === 0 || diaSemana === 6) continue;

    // Create slots for morning and afternoon
    const horariosSlots = [
      { hora_inicio: createTime('08:00:00'), hora_fin: createTime('09:00:00') },
      { hora_inicio: createTime('09:00:00'), hora_fin: createTime('10:00:00') },
      { hora_inicio: createTime('10:00:00'), hora_fin: createTime('11:00:00') },
      { hora_inicio: createTime('14:00:00'), hora_fin: createTime('15:00:00') },
      { hora_inicio: createTime('15:00:00'), hora_fin: createTime('16:00:00') },
    ];

    for (const horario of horariosSlots) {
      const slot = await prisma.slot.create({
        data: {
          codigo_servicio: servicios[0].codigo_servicio,
          codigo_sede: sede.codigo_sede,
          fecha: fecha,
          hora_inicio: horario.hora_inicio,
          hora_fin: horario.hora_fin,
          cupos_totales: 4,
          cupos_disponibles: 4,
          activo: true,
        },
      });
      slots.push(slot);
    }
  }
  console.log(`✅ Created ${slots.length} slots`);

  // 13. Create citas (appointments) for testing
  console.log('Creating citas...');
  const citas = [];
  // Reservar algunos slots con el paciente de prueba
  for (let i = 0; i < Math.min(3, slots.length); i++) {
    const cita = await prisma.cita.create({
      data: {
        codigo_paciente: testPaciente.codigo_usuario,
        codigo_slot: slots[i].codigo_slot,
        estado: i === 0 ? 'CONFIRMADA' : i === 1 ? 'PENDIENTE' : 'COMPLETADA',
        observaciones: `Cita de prueba ${i + 1}`,
      },
    });
    citas.push(cita);

    // Update slot cupos_disponibles
    await prisma.slot.update({
      where: { codigo_slot: slots[i].codigo_slot },
      data: { cupos_disponibles: slots[i].cupos_disponibles - 1 },
    });
  }
  console.log(`✅ Created ${citas.length} citas`);

  // 14. Create cotizaciones (quotes) for testing
  console.log('Creating cotizaciones...');
  const cotizaciones = [];

  // Cotización 1: Pendiente
  const cotizacion1 = await prisma.cotizacion.create({
    data: {
      codigo_paciente: testPaciente.codigo_usuario,
      numero_cotizacion: `COT-${Date.now()}-001`,
      fecha_expiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      subtotal: 30.0,
      descuento: 0.0,
      total: 30.0,
      estado: 'PENDIENTE',
      detalles: {
        create: [
          {
            codigo_examen: examenesCreados[0].codigo_examen,
            cantidad: 1,
            precio_unitario: 15.0,
            total_linea: 15.0,
          },
          {
            codigo_examen: examenesCreados[1].codigo_examen,
            cantidad: 1,
            precio_unitario: 15.0,
            total_linea: 15.0,
          },
        ],
      },
    },
  });
  cotizaciones.push(cotizacion1);

  // Cotización 2: Aprobada
  const cotizacion2 = await prisma.cotizacion.create({
    data: {
      codigo_paciente: testPaciente.codigo_usuario,
      numero_cotizacion: `COT-${Date.now()}-002`,
      fecha_expiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      subtotal: 20.0,
      descuento: 2.0,
      total: 18.0,
      estado: 'APROBADA',
      detalles: {
        create: [
          {
            codigo_examen: examenesCreados[2].codigo_examen,
            cantidad: 1,
            precio_unitario: 20.0,
            total_linea: 20.0,
          },
        ],
      },
    },
  });
  cotizaciones.push(cotizacion2);
  console.log(`✅ Created ${cotizaciones.length} cotizaciones`);

  // 15. Create muestras (samples) for testing
  console.log('Creating muestras...');
  const muestras = [];

  // Muestra 1: Para la primera cita completada
  const muestra1 = await prisma.muestra.create({
    data: {
      codigo_paciente: testPaciente.codigo_usuario,
      codigo_cita: citas[2]?.codigo_cita, // Cita completada
      id_muestra: `M-${Date.now()}-001`,
      tipo_muestra: 'Sangre',
      estado: 'PROCESADA',
      observaciones: 'Muestra de sangre para hemograma completo',
      tomada_por: personalLab.codigo_usuario,
    },
  });
  muestras.push(muestra1);

  // Muestra 2: Para otra cita
  const muestra2 = await prisma.muestra.create({
    data: {
      codigo_paciente: testPaciente.codigo_usuario,
      codigo_cita: citas[1]?.codigo_cita,
      id_muestra: `M-${Date.now()}-002`,
      tipo_muestra: 'Sangre',
      estado: 'PROCESADA',
      observaciones: 'Muestra de sangre para glucosa',
      tomada_por: personalLab.codigo_usuario,
    },
  });
  muestras.push(muestra2);

  // Muestra 3: Muestra reciente en proceso
  const muestra3 = await prisma.muestra.create({
    data: {
      codigo_paciente: testPaciente.codigo_usuario,
      codigo_cita: citas[0]?.codigo_cita,
      id_muestra: `M-${Date.now()}-003`,
      tipo_muestra: 'Sangre',
      estado: 'RECOLECTADA',
      observaciones: 'Muestra recién tomada',
      tomada_por: personalLab.codigo_usuario,
    },
  });
  muestras.push(muestra3);
  console.log(`✅ Created ${muestras.length} muestras`);

  // 16. Create resultados (results) for testing
  console.log('Creating resultados...');
  const resultados = [];

  // Resultado 1: Normal - Hemoglobina
  const resultado1 = await prisma.resultado.create({
    data: {
      codigo_muestra: muestra1.codigo_muestra,
      codigo_examen: examenesCreados[0].codigo_examen,
      fecha_resultado: new Date(),
      valor_texto: '14.5 g/dL',
      valor_numerico: 14.5,
      unidad_medida: 'g/dL',
      dentro_rango_normal: true,
      nivel: 'NORMAL',
      observaciones_tecnicas: 'Hemoglobina dentro de valores normales',
      estado: 'VALIDADO',
      validado_por: medico.codigo_usuario,
      fecha_validacion: new Date(),
      procesado_por: personalLab.codigo_usuario,
    },
  });
  resultados.push(resultado1);

  // Resultado 2: Alto - Glucosa
  const resultado2 = await prisma.resultado.create({
    data: {
      codigo_muestra: muestra2.codigo_muestra,
      codigo_examen: examenesCreados[1].codigo_examen,
      fecha_resultado: new Date(),
      valor_texto: '120 mg/dL',
      valor_numerico: 120.0,
      unidad_medida: 'mg/dL',
      dentro_rango_normal: false,
      nivel: 'ALTO',
      observaciones_tecnicas: 'Glucosa elevada - Requiere seguimiento',
      estado: 'VALIDADO',
      validado_por: medico.codigo_usuario,
      fecha_validacion: new Date(),
      procesado_por: personalLab.codigo_usuario,
    },
  });
  resultados.push(resultado2);

  // Resultado 3: En proceso
  const resultado3 = await prisma.resultado.create({
    data: {
      codigo_muestra: muestra3.codigo_muestra,
      codigo_examen: examenesCreados[2].codigo_examen,
      fecha_resultado: new Date(),
      valor_texto: 'Pendiente',
      nivel: 'NORMAL',
      estado: 'EN_PROCESO',
      procesado_por: personalLab.codigo_usuario,
    },
  });
  resultados.push(resultado3);
  console.log(`✅ Created ${resultados.length} resultados`);

  // 17. Create lotes de inventario
  console.log('Creating lotes de inventario...');
  const itemsCreados = await prisma.item.findMany();
  const proveedoresCreados = await prisma.proveedor.findMany();

  const lotes = [];
  for (const item of itemsCreados) {
    // Crear 2 lotes por item
    const lote1 = await prisma.lote.create({
      data: {
        codigo_item: item.codigo_item,
        numero_lote: `LOT-${item.codigo_interno}-001`,
        fecha_fabricacion: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Hace 60 días
        fecha_vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // En 1 año
        cantidad_inicial: Math.floor(item.stock_actual * 0.6),
        cantidad_actual: Math.floor(item.stock_actual * 0.6),
        proveedor: proveedoresCreados[0]?.razon_social || 'Proveedor General',
      },
    });
    lotes.push(lote1);

    const lote2 = await prisma.lote.create({
      data: {
        codigo_item: item.codigo_item,
        numero_lote: `LOT-${item.codigo_interno}-002`,
        fecha_fabricacion: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Hace 30 días
        fecha_vencimiento: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // En 6 meses
        cantidad_inicial: Math.ceil(item.stock_actual * 0.4),
        cantidad_actual: Math.ceil(item.stock_actual * 0.4),
        proveedor: proveedoresCreados[1]?.razon_social || 'Proveedor Secundario',
      },
    });
    lotes.push(lote2);
  }
  console.log(`✅ Created ${lotes.length} lotes`);

  // 18. Create movimientos de inventario
  console.log('Creating movimientos de inventario...');
  const movimientos = [];
  for (const lote of lotes) {
    // Movimiento de entrada inicial
    const movEntrada = await prisma.movimiento.create({
      data: {
        codigo_item: lote.codigo_item,
        codigo_lote: lote.codigo_lote,
        tipo_movimiento: 'ENTRADA',
        cantidad: lote.cantidad_inicial,
        motivo: `Ingreso de lote ${lote.numero_lote}`,
        stock_anterior: 0,
        stock_nuevo: lote.cantidad_inicial,
        realizado_por: personalLab.codigo_usuario,
      },
    });
    movimientos.push(movEntrada);
  }
  console.log(`✅ Created ${movimientos.length} movimientos`);

  // 19. Create ExamenInsumo (relación examen-item)
  console.log('Creating ExamenInsumo (insumos por examen)...');
  const examenInsumos = [];

  // Hemograma necesita tubos EDTA y kit hemograma
  const tuboEDTA = itemsCreados.find(i => i.codigo_interno === 'INSU-001');
  const kitHemograma = itemsCreados.find(i => i.codigo_interno === 'REAC-002');
  const agujasVacutainer = itemsCreados.find(i => i.codigo_interno === 'INSU-002');
  const reactivoGlucosa = itemsCreados.find(i => i.codigo_interno === 'REAC-001');
  const recipientesOrina = itemsCreados.find(i => i.codigo_interno === 'INSU-003');

  const examenHemograma = examenesCreados.find(e => e.codigo_interno === 'HCTO-001');
  const examenGlucosa = examenesCreados.find(e => e.codigo_interno === 'BIOQ-001');
  const examenOrina = examenesCreados.find(e => e.codigo_interno === 'URIN-001');

  if (examenHemograma && tuboEDTA) {
    const ei1 = await prisma.examenInsumo.create({
      data: {
        codigo_examen: examenHemograma.codigo_examen,
        codigo_item: tuboEDTA.codigo_item,
        cantidad_requerida: 1,
        activo: true,
      },
    });
    examenInsumos.push(ei1);
  }

  if (examenHemograma && kitHemograma) {
    const ei2 = await prisma.examenInsumo.create({
      data: {
        codigo_examen: examenHemograma.codigo_examen,
        codigo_item: kitHemograma.codigo_item,
        cantidad_requerida: 0.01, // 1% del kit por examen
        activo: true,
      },
    });
    examenInsumos.push(ei2);
  }

  if (examenGlucosa && reactivoGlucosa) {
    const ei3 = await prisma.examenInsumo.create({
      data: {
        codigo_examen: examenGlucosa.codigo_examen,
        codigo_item: reactivoGlucosa.codigo_item,
        cantidad_requerida: 0.02, // 2% del frasco por examen
        activo: true,
      },
    });
    examenInsumos.push(ei3);
  }

  if (examenOrina && recipientesOrina) {
    const ei4 = await prisma.examenInsumo.create({
      data: {
        codigo_examen: examenOrina.codigo_examen,
        codigo_item: recipientesOrina.codigo_item,
        cantidad_requerida: 0.02, // 1 recipiente = 2% de la caja
        activo: true,
      },
    });
    examenInsumos.push(ei4);
  }

  // Todos los exámenes de sangre necesitan agujas
  for (const examen of examenesCreados.filter(e => e.tipo_muestra === 'Sangre')) {
    if (agujasVacutainer) {
      const existeRelacion = await prisma.examenInsumo.findFirst({
        where: {
          codigo_examen: examen.codigo_examen,
          codigo_item: agujasVacutainer.codigo_item,
        },
      });
      if (!existeRelacion) {
        const ei = await prisma.examenInsumo.create({
          data: {
            codigo_examen: examen.codigo_examen,
            codigo_item: agujasVacutainer.codigo_item,
            cantidad_requerida: 0.01, // 1% de la caja por examen
            activo: true,
          },
        });
        examenInsumos.push(ei);
      }
    }
  }
  console.log(`✅ Created ${examenInsumos.length} relaciones examen-insumo`);

  // 20. Create Orden de Compra
  console.log('Creating órdenes de compra...');
  const ordenCompra = await prisma.ordenCompra.create({
    data: {
      codigo_proveedor: proveedoresCreados[0].codigo_proveedor,
      numero_orden: `OC-${Date.now()}-001`,
      fecha_entrega_estimada: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // En 7 días
      subtotal: 200.0,
      iva: 24.0,
      total: 224.0,
      estado: 'BORRADOR',
      observaciones: 'Orden de compra de prueba',
      creado_por: personalLab.codigo_usuario,
      detalles: {
        create: [
          {
            codigo_item: itemsCreados[0].codigo_item,
            cantidad: 10,
            precio_unitario: itemsCreados[0].costo_unitario || 20.0,
            total_linea: 200.0,
          },
        ],
      },
    },
  });
  console.log(`✅ Created orden de compra: ${ordenCompra.numero_orden}`);

  // 21. Create Pagos
  console.log('Creating pagos...');
  const pago = await prisma.pago.create({
    data: {
      codigo_cotizacion: cotizacion2.codigo_cotizacion,
      codigo_paciente: testPaciente.codigo_usuario,
      numero_pago: `PAG-${Date.now()}-001`,
      monto_total: 18.0,
      metodo_pago: 'EFECTIVO',
      estado: 'COMPLETADO',
      observaciones: 'Pago en efectivo',
      detalles: {
        create: [
          {
            codigo_examen: examenesCreados[2].codigo_examen,
            cantidad: 1,
            precio_unitario: 20.0,
            total_linea: 18.0,
          },
        ],
      },
    },
  });
  console.log(`✅ Created pago: ${pago.numero_pago}`);

  // 22. Create Factura
  console.log('Creating factura...');
  const factura = await prisma.factura.create({
    data: {
      codigo_pago: pago.codigo_pago,
      numero_factura: `FAC-001-001-${Date.now()}`,
      subtotal: 16.07,
      iva: 1.93,
      total: 18.0,
      estado: 'EMITIDA',
    },
  });
  console.log(`✅ Created factura: ${factura.numero_factura}`);

  // 23. Create Configuración del Sistema
  console.log('Creating configuración del sistema...');
  const configs = [
    { clave: 'NOMBRE_LABORATORIO', valor: 'Laboratorio Franz', grupo: 'GENERAL', descripcion: 'Nombre del laboratorio' },
    { clave: 'DIRECCION', valor: 'Av. Principal #123, Quito, Ecuador', grupo: 'GENERAL', descripcion: 'Dirección del laboratorio' },
    { clave: 'TELEFONO', valor: '0234567890', grupo: 'GENERAL', descripcion: 'Teléfono principal' },
    { clave: 'EMAIL', valor: 'info@laboratorifranz.com', grupo: 'GENERAL', descripcion: 'Email de contacto' },
    { clave: 'RUC', valor: '1791234567001', grupo: 'FACTURACION', descripcion: 'RUC del laboratorio' },
    { clave: 'IVA_PORCENTAJE', valor: '12', grupo: 'FACTURACION', descripcion: 'Porcentaje de IVA', tipo_dato: 'NUMBER' },
    { clave: 'DIAS_VIGENCIA_COTIZACION', valor: '30', grupo: 'COTIZACIONES', descripcion: 'Días de vigencia de cotizaciones', tipo_dato: 'NUMBER' },
    { clave: 'HORA_APERTURA', valor: '08:00', grupo: 'HORARIOS', descripcion: 'Hora de apertura' },
    { clave: 'HORA_CIERRE', valor: '18:00', grupo: 'HORARIOS', descripcion: 'Hora de cierre' },
    { clave: 'MONEDA', valor: 'USD', grupo: 'GENERAL', descripcion: 'Moneda del sistema' },
  ];

  for (const config of configs) {
    await prisma.configuracionSistema.upsert({
      where: { clave: config.clave },
      update: {},
      create: {
        ...config,
        tipo_dato: config.tipo_dato || 'STRING',
        es_publico: true,
      },
    });
  }
  console.log(`✅ Created ${configs.length} configuraciones`);

  // 24. Create Feriados 2024-2025
  console.log('Creating feriados...');
  const feriados = [
    { fecha: new Date('2024-01-01'), descripcion: 'Año Nuevo' },
    { fecha: new Date('2024-02-12'), descripcion: 'Carnaval' },
    { fecha: new Date('2024-02-13'), descripcion: 'Carnaval' },
    { fecha: new Date('2024-03-29'), descripcion: 'Viernes Santo' },
    { fecha: new Date('2024-05-01'), descripcion: 'Día del Trabajo' },
    { fecha: new Date('2024-05-24'), descripcion: 'Batalla de Pichincha' },
    { fecha: new Date('2024-08-10'), descripcion: 'Primer Grito de Independencia' },
    { fecha: new Date('2024-10-09'), descripcion: 'Independencia de Guayaquil' },
    { fecha: new Date('2024-11-02'), descripcion: 'Día de los Difuntos' },
    { fecha: new Date('2024-11-03'), descripcion: 'Independencia de Cuenca' },
    { fecha: new Date('2024-12-25'), descripcion: 'Navidad' },
    { fecha: new Date('2025-01-01'), descripcion: 'Año Nuevo' },
    { fecha: new Date('2025-03-03'), descripcion: 'Carnaval' },
    { fecha: new Date('2025-03-04'), descripcion: 'Carnaval' },
    { fecha: new Date('2025-04-18'), descripcion: 'Viernes Santo' },
    { fecha: new Date('2025-05-01'), descripcion: 'Día del Trabajo' },
    { fecha: new Date('2025-05-24'), descripcion: 'Batalla de Pichincha' },
    { fecha: new Date('2025-08-10'), descripcion: 'Primer Grito de Independencia' },
    { fecha: new Date('2025-10-09'), descripcion: 'Independencia de Guayaquil' },
    { fecha: new Date('2025-11-02'), descripcion: 'Día de los Difuntos' },
    { fecha: new Date('2025-11-03'), descripcion: 'Independencia de Cuenca' },
    { fecha: new Date('2025-12-25'), descripcion: 'Navidad' },
  ];

  for (const feriado of feriados) {
    await prisma.feriado.upsert({
      where: { fecha: feriado.fecha },
      update: {},
      create: {
        fecha: feriado.fecha,
        descripcion: feriado.descripcion,
        activo: true,
      },
    });
  }
  console.log(`✅ Created ${feriados.length} feriados`);

  // 25. Create Configuración Chatbot
  console.log('Creating configuración chatbot...');
  await prisma.configuracionChatbot.upsert({
    where: { codigo_configuracion: 1 },
    update: {},
    create: {
      activo: true,
      umbral_confianza: 0.7,
      mensaje_bienvenida: '¡Hola! Soy el asistente virtual del Laboratorio Franz. ¿En qué puedo ayudarte hoy?',
      mensaje_fallo: 'Lo siento, no entendí tu consulta. ¿Podrías reformularla o escribir "ayuda" para ver las opciones disponibles?',
      permitir_acceso_resultados: false,
    },
  });
  console.log(`✅ Created configuración chatbot`);

  // 26. Create más exámenes para catálogo completo
  console.log('Creating más exámenes...');
  const inmunologia = categorias.find((c) => c.nombre === 'Inmunología');

  const examenesAdicionales = [
    { codigo_interno: 'BIOQ-004', nombre: 'Urea', codigo_categoria: bioquimica.codigo_categoria, descripcion: 'Evaluación de función renal', requiere_ayuno: false, tiempo_entrega_horas: 24, tipo_muestra: 'Sangre', valor_referencia_min: 15, valor_referencia_max: 45, unidad_medida: 'mg/dL', precio: 6.0 },
    { codigo_interno: 'BIOQ-005', nombre: 'Ácido Úrico', codigo_categoria: bioquimica.codigo_categoria, descripcion: 'Medición de ácido úrico', requiere_ayuno: true, horas_ayuno: 8, tiempo_entrega_horas: 24, tipo_muestra: 'Sangre', valor_referencia_min: 2.5, valor_referencia_max: 7.0, unidad_medida: 'mg/dL', precio: 7.0 },
    { codigo_interno: 'BIOQ-006', nombre: 'Transaminasas (TGO/TGP)', codigo_categoria: bioquimica.codigo_categoria, descripcion: 'Enzimas hepáticas', requiere_ayuno: true, horas_ayuno: 8, tiempo_entrega_horas: 24, tipo_muestra: 'Sangre', precio: 12.0 },
    { codigo_interno: 'BIOQ-007', nombre: 'Bilirrubinas', codigo_categoria: bioquimica.codigo_categoria, descripcion: 'Total, directa e indirecta', requiere_ayuno: true, horas_ayuno: 8, tiempo_entrega_horas: 24, tipo_muestra: 'Sangre', precio: 10.0 },
    { codigo_interno: 'HCTO-002', nombre: 'Grupo Sanguíneo y Factor Rh', codigo_categoria: hematologia.codigo_categoria, descripcion: 'Tipificación sanguínea', requiere_ayuno: false, tiempo_entrega_horas: 4, tipo_muestra: 'Sangre', precio: 8.0 },
    { codigo_interno: 'HCTO-003', nombre: 'VSG (Velocidad de Sedimentación)', codigo_categoria: hematologia.codigo_categoria, descripcion: 'Marcador de inflamación', requiere_ayuno: false, tiempo_entrega_horas: 4, tipo_muestra: 'Sangre', valor_referencia_max: 20, unidad_medida: 'mm/h', precio: 5.0 },
    { codigo_interno: 'HCTO-004', nombre: 'Tiempo de Protrombina (PT)', codigo_categoria: hematologia.codigo_categoria, descripcion: 'Evaluación de coagulación', requiere_ayuno: false, tiempo_entrega_horas: 4, tipo_muestra: 'Sangre', precio: 10.0 },
    { codigo_interno: 'INMU-001', nombre: 'PCR (Proteína C Reactiva)', codigo_categoria: inmunologia.codigo_categoria, descripcion: 'Marcador de inflamación', requiere_ayuno: false, tiempo_entrega_horas: 24, tipo_muestra: 'Sangre', valor_referencia_max: 6, unidad_medida: 'mg/L', precio: 12.0 },
    { codigo_interno: 'INMU-002', nombre: 'TSH (Hormona Estimulante Tiroides)', codigo_categoria: inmunologia.codigo_categoria, descripcion: 'Función tiroidea', requiere_ayuno: false, tiempo_entrega_horas: 24, tipo_muestra: 'Sangre', valor_referencia_min: 0.4, valor_referencia_max: 4.0, unidad_medida: 'mUI/L', precio: 15.0 },
    { codigo_interno: 'INMU-003', nombre: 'T3 y T4 Libres', codigo_categoria: inmunologia.codigo_categoria, descripcion: 'Hormonas tiroideas', requiere_ayuno: false, tiempo_entrega_horas: 24, tipo_muestra: 'Sangre', precio: 25.0 },
    { codigo_interno: 'INMU-004', nombre: 'HbA1c (Hemoglobina Glicosilada)', codigo_categoria: inmunologia.codigo_categoria, descripcion: 'Control de diabetes', requiere_ayuno: false, tiempo_entrega_horas: 24, tipo_muestra: 'Sangre', valor_referencia_max: 5.7, unidad_medida: '%', precio: 18.0 },
    { codigo_interno: 'URIN-002', nombre: 'Urocultivo', codigo_categoria: urianalisis.codigo_categoria, descripcion: 'Cultivo de orina para bacterias', requiere_ayuno: false, instrucciones_preparacion: 'Recolectar primera orina de la mañana en recipiente estéril', tiempo_entrega_horas: 72, tipo_muestra: 'Orina', precio: 15.0 },
  ];

  for (const examen of examenesAdicionales) {
    const { precio, ...examenData } = examen;
    const examenCreado = await prisma.examen.upsert({
      where: { codigo_interno: examen.codigo_interno },
      update: {},
      create: examenData,
    });

    await prisma.precio.create({
      data: {
        codigo_examen: examenCreado.codigo_examen,
        precio,
        activo: true,
      },
    });
  }
  console.log(`✅ Created ${examenesAdicionales.length} exámenes adicionales`);

  // 27. Más items de inventario
  console.log('Creating más items de inventario...');
  const itemsAdicionales = [
    { codigo_interno: 'REAC-003', nombre: 'Reactivo Perfil Lipídico', descripcion: 'Kit de reactivos para colesterol total, HDL, LDL, TG', unidad_medida: 'Kit', stock_actual: 5, stock_minimo: 2, stock_maximo: 10, costo_unitario: 180.0, codigo_categoria: categoriaReactivos.codigo_categoria },
    { codigo_interno: 'REAC-004', nombre: 'Reactivo Creatinina', descripcion: 'Reactivo para determinación de creatinina', unidad_medida: 'Frasco', stock_actual: 10, stock_minimo: 3, stock_maximo: 20, costo_unitario: 35.0, codigo_categoria: categoriaReactivos.codigo_categoria },
    { codigo_interno: 'REAC-005', nombre: 'Tiras Reactivas Orina (100 unidades)', descripcion: 'Tiras para urianálisis', unidad_medida: 'Caja', stock_actual: 12, stock_minimo: 5, stock_maximo: 25, costo_unitario: 25.0, codigo_categoria: categoriaReactivos.codigo_categoria },
    { codigo_interno: 'INSU-004', nombre: 'Guantes de Látex M (100 unidades)', descripcion: 'Guantes desechables talla M', unidad_medida: 'Caja', stock_actual: 50, stock_minimo: 20, stock_maximo: 100, costo_unitario: 8.0, codigo_categoria: categoriaInsumos.codigo_categoria },
    { codigo_interno: 'INSU-005', nombre: 'Algodón (500g)', descripcion: 'Algodón hidrófilo', unidad_medida: 'Paquete', stock_actual: 30, stock_minimo: 10, stock_maximo: 50, costo_unitario: 3.5, codigo_categoria: categoriaInsumos.codigo_categoria },
    { codigo_interno: 'INSU-006', nombre: 'Alcohol Antiséptico (1L)', descripcion: 'Alcohol al 70%', unidad_medida: 'Litro', stock_actual: 20, stock_minimo: 8, stock_maximo: 40, costo_unitario: 4.0, codigo_categoria: categoriaInsumos.codigo_categoria },
    { codigo_interno: 'INSU-007', nombre: 'Tubos Vacutainer Tapa Roja (100 unidades)', descripcion: 'Tubos sin anticoagulante para química sanguínea', unidad_medida: 'Caja', stock_actual: 20, stock_minimo: 8, stock_maximo: 40, costo_unitario: 12.0, codigo_categoria: categoriaInsumos.codigo_categoria },
    { codigo_interno: 'INSU-008', nombre: 'Curitas Redondas (100 unidades)', descripcion: 'Curitas para post extracción', unidad_medida: 'Caja', stock_actual: 25, stock_minimo: 10, stock_maximo: 50, costo_unitario: 2.5, codigo_categoria: categoriaInsumos.codigo_categoria },
  ];

  for (const itemData of itemsAdicionales) {
    await prisma.item.upsert({
      where: { codigo_interno: itemData.codigo_interno },
      update: {},
      create: { ...itemData, activo: true },
    });
  }
  console.log(`✅ Created ${itemsAdicionales.length} items adicionales`);

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
