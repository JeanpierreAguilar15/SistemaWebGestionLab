import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { InventarioService } from '../inventario/inventario.service';
import { ComunicacionesService } from '../comunicaciones/comunicaciones.service';
import {
  CreateSlotDto,
  CreateCitaDto,
  UpdateCitaDto,
  QuerySlotsDto,
} from './dto';

@Injectable()
export class AgendaService {
  private readonly logger = new Logger(AgendaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
    private readonly inventarioService: InventarioService,
    private readonly comunicacionesService: ComunicacionesService,
  ) { }

  // ==================== SLOTS ====================

  /**
   * Obtener todos los servicios disponibles
   */
  async getAllServices() {
    return this.prisma.servicio.findMany({
      where: { activo: true },
      select: {
        codigo_servicio: true,
        nombre: true,
        descripcion: true,
      },
    });
  }

  /**
   * Crear un nuevo slot de disponibilidad (Admin)
   */
  async generateDailySlots(startDateStr: string, endDateStr: string, adminId: number) {
    // Obtener configuración
    const configs = await this.prisma.configuracionSistema.findMany({
      where: {
        clave: {
          in: [
            'AGENDA_HORA_INICIO',
            'AGENDA_HORA_FIN',
            'AGENDA_DURACION_SLOT',
            'AGENDA_CAPACIDAD_DEFECTO',
            'AGENDA_HUECO_INICIO',
            'AGENDA_HUECO_FIN',
          ],
        },
      },
    });

    const getConfig = (key: string, defaultValue: any) => {
      const config = configs.find((c) => c.clave === key);
      return config ? config.valor : defaultValue;
    };

    const horaInicioStr = getConfig('AGENDA_HORA_INICIO', '08:00');
    const horaFinStr = getConfig('AGENDA_HORA_FIN', '17:00');
    const duracionMin = parseInt(getConfig('AGENDA_DURACION_SLOT', '15'));
    const capacidad = parseInt(getConfig('AGENDA_CAPACIDAD_DEFECTO', '5'));
    const huecoInicioStr = getConfig('AGENDA_HUECO_INICIO', '');
    const huecoFinStr = getConfig('AGENDA_HUECO_FIN', '');

    // Obtener servicios y sede principal (asumimos sede 1 por ahora)
    const servicios = await this.prisma.servicio.findMany({ where: { activo: true } });
    const sede = await this.prisma.sede.findFirst({ where: { activo: true } });

    if (!sede || servicios.length === 0) {
      throw new BadRequestException('No hay sedes o servicios activos para generar slots');
    }

    const slotsToCreate = [];
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    // Ensure dates are set to midnight to avoid time issues
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(0, 0, 0, 0);

    // Fetch holidays in range
    const feriados = await this.prisma.feriado.findMany({
      where: {
        activo: true,
        fecha: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const feriadoTimestamps = new Set(feriados.map(f => {
      const d = new Date(f.fecha);
      d.setUTCHours(0, 0, 0, 0);
      return d.getTime();
    }));

    // Adjust to local date iteration
    const currentIterDate = new Date(startDate);

    while (currentIterDate <= endDate) {
      // Create a copy for the slot date to ensure it's independent
      const currentDate = new Date(currentIterDate);

      // Saltar fines de semana (0 = Domingo, 6 = Sábado)
      const dayOfWeek = currentDate.getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        currentIterDate.setDate(currentIterDate.getDate() + 1);
        continue;
      }

      // Saltar feriados
      if (feriadoTimestamps.has(currentDate.getTime())) {
        currentIterDate.setDate(currentIterDate.getDate() + 1);
        continue;
      }

      const startTime = new Date(`1970-01-01T${horaInicioStr}:00`);
      const endTime = new Date(`1970-01-01T${horaFinStr}:00`);
      const durationMs = duracionMin * 60 * 1000;

      let currentTime = startTime.getTime();
      const endTimeMs = endTime.getTime();

      // Configurar hueco si existe
      let huecoStartMs = -1;
      let huecoEndMs = -1;
      if (huecoInicioStr && huecoFinStr) {
        huecoStartMs = new Date(`1970-01-01T${huecoInicioStr}:00`).getTime();
        huecoEndMs = new Date(`1970-01-01T${huecoFinStr}:00`).getTime();
      }

      while (currentTime + durationMs <= endTimeMs) {
        const slotStart = currentTime;
        const slotEnd = currentTime + durationMs;

        // Verificar si el slot cae en el hueco
        let isGap = false;
        if (huecoStartMs !== -1 && huecoEndMs !== -1) {
          // Si el slot empieza dentro del hueco O termina dentro del hueco
          // O si el hueco está completamente dentro del slot (raro pero posible)
          if (
            (slotStart >= huecoStartMs && slotStart < huecoEndMs) ||
            (slotEnd > huecoStartMs && slotEnd <= huecoEndMs)
          ) {
            isGap = true;
          }
        }

        if (!isGap) {
          const start = new Date(slotStart);
          const end = new Date(slotEnd);
          const startStr = start.toTimeString().substring(0, 5);
          const endStr = end.toTimeString().substring(0, 5);

          // Crear slot para cada servicio
          for (const servicio of servicios) {
            slotsToCreate.push({
              codigo_servicio: servicio.codigo_servicio,
              codigo_sede: sede.codigo_sede,
              fecha: new Date(currentDate),
              hora_inicio: new Date(`1970-01-01T${startStr}:00`),
              hora_fin: new Date(`1970-01-01T${endStr}:00`),
              cupos_totales: capacidad,
              cupos_disponibles: capacidad,
              activo: true,
            });
          }
        }

        currentTime += durationMs;
      }

      // Move to next day
      currentIterDate.setDate(currentIterDate.getDate() + 1);
    }

    if (slotsToCreate.length === 0) {
      return { count: 0, message: 'No se generaron slots (posiblemente fin de semana, feriado o configuración inválida)' };
    }

    // Insertar en lotes para evitar límites de query
    // Usamos createMany si es posible, pero Prisma con SQLite/Postgres a veces tiene limites
    // createMany es soportado en Postgres
    const result = await this.prisma.slot.createMany({
      data: slotsToCreate,
      skipDuplicates: true, // Evitar duplicados si ya existen
    });

    this.logger.log(`Generados ${result.count} slots automáticamente por Admin ${adminId}`);

    return { count: result.count };
  }

  async createSlot(data: CreateSlotDto, adminId: number) {
    // Validar que el servicio existe
    const servicio = await this.prisma.servicio.findUnique({
      where: { codigo_servicio: data.codigo_servicio },
    });

    if (!servicio) {
      throw new NotFoundException(
        `Servicio con código ${data.codigo_servicio} no encontrado`,
      );
    }

    // Validar que la sede existe
    const sede = await this.prisma.sede.findUnique({
      where: { codigo_sede: data.codigo_sede },
    });

    if (!sede) {
      throw new NotFoundException(
        `Sede con código ${data.codigo_sede} no encontrada`,
      );
    }

    // Validar que la fecha sea futura
    const fecha = new Date(data.fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fecha < hoy) {
      throw new BadRequestException('No se pueden crear slots en fechas pasadas');
    }

    // Validar que hora_fin > hora_inicio
    if (data.hora_fin <= data.hora_inicio) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la hora de inicio',
      );
    }

    // Generar slots de 10 minutos
    const slotsToCreate = [];
    const startTime = new Date(`1970-01-01T${data.hora_inicio}:00`);
    const endTime = new Date(`1970-01-01T${data.hora_fin}:00`);
    const durationMs = 10 * 60 * 1000; // 10 minutos en milisegundos

    let currentTime = startTime.getTime();
    const endTimeMs = endTime.getTime();

    while (currentTime + durationMs <= endTimeMs) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(currentTime + durationMs);

      // Formatear horas para guardar
      const horaInicioStr = slotStart.toTimeString().substring(0, 5);
      const horaFinStr = slotEnd.toTimeString().substring(0, 5);

      slotsToCreate.push({
        codigo_servicio: data.codigo_servicio,
        codigo_sede: data.codigo_sede,
        fecha: new Date(data.fecha),
        hora_inicio: new Date(`1970-01-01T${horaInicioStr}:00`),
        hora_fin: new Date(`1970-01-01T${horaFinStr}:00`),
        cupos_totales: 1, // 1 cupo por slot de 10 min
        cupos_disponibles: 1,
        activo: data.activo !== undefined ? data.activo : true,
      });

      currentTime += durationMs;
    }

    if (slotsToCreate.length === 0) {
      throw new BadRequestException('El rango de tiempo es muy corto para generar slots de 10 minutos');
    }

    // Crear todos los slots en una transacción
    const createdSlots = await this.prisma.$transaction(
      slotsToCreate.map((slotData) => this.prisma.slot.create({ data: slotData }))
    );

    this.logger.log(
      `Generados ${createdSlots.length} slots de 10 min para ${data.fecha} ${data.hora_inicio}-${data.hora_fin} | Admin: ${adminId}`,
    );

    // Notificar (usamos el primer slot como referencia)
    this.eventsGateway.notifyCatalogUpdate({
      type: 'slot',
      action: 'created_batch',
      entityId: createdSlots[0].codigo_slot,
      entityName: `${servicio.nombre} - ${sede.nombre} (${createdSlots.length} slots)`,
    });

    return createdSlots;
  }

  /**
   * Obtener slots disponibles (Público)
   */
  async getAvailableSlots(filters: QuerySlotsDto) {
    const where: any = {
      activo: true,
      cupos_disponibles: { gt: 0 },
      fecha: {
        gte: new Date(), // Solo futuros
      },
    };

    if (filters.fecha) {
      const searchDate = new Date(filters.fecha);
      const nextDate = new Date(searchDate);
      nextDate.setDate(nextDate.getDate() + 1);

      where.fecha = {
        gte: searchDate,
        lt: nextDate,
      };
    }

    if (filters.codigo_servicio) {
      where.codigo_servicio = filters.codigo_servicio;
    }

    if (filters.codigo_sede) {
      where.codigo_sede = filters.codigo_sede;
    }

    return this.prisma.slot.findMany({
      where,
      include: {
        servicio: true,
        sede: true,
      },
      orderBy: {
        hora_inicio: 'asc',
      },
    });
  }

  /**
   * Obtener un slot por ID
   */
  async getSlotById(codigo_slot: number) {
    const slot = await this.prisma.slot.findUnique({
      where: { codigo_slot },
      include: {
        servicio: true,
        sede: true,
        citas: {
          include: {
            paciente: {
              select: {
                codigo_usuario: true,
                nombres: true,
                apellidos: true,
                email: true,
                telefono: true,
              },
            },
          },
        },
      },
    });

    if (!slot) {
      throw new NotFoundException(`Slot con código ${codigo_slot} no encontrado`);
    }

    return slot;
  }

  /**
   * Actualizar un slot (Admin)
   */
  async updateSlot(codigo_slot: number, data: Partial<CreateSlotDto>, adminId: number) {
    const slot = await this.prisma.slot.findUnique({
      where: { codigo_slot },
      include: { citas: true },
    });

    if (!slot) {
      throw new NotFoundException(`Slot con código ${codigo_slot} no encontrado`);
    }

    // Si hay citas, no se puede cambiar fecha/hora
    if (slot.citas.length > 0) {
      if (data.fecha || data.hora_inicio || data.hora_fin) {
        throw new BadRequestException(
          'No se puede modificar fecha/hora de un slot con citas agendadas',
        );
      }
    }

    // Si se reduce cupos, verificar que no sea menor a citas actuales
    if (data.cupos_totales !== undefined) {
      if (data.cupos_totales < slot.citas.length) {
        throw new BadRequestException(
          `No se puede reducir cupos a ${data.cupos_totales} porque ya hay ${slot.citas.length} citas`,
        );
      }
    }

    // Calcular nuevos cupos disponibles
    const nuevosCuposTotales =
      data.cupos_totales !== undefined ? data.cupos_totales : slot.cupos_totales;
    const nuevosCuposDisponibles = nuevosCuposTotales - slot.citas.length;

    const updatedSlot = await this.prisma.slot.update({
      where: { codigo_slot },
      data: {
        ...data,
        cupos_disponibles: nuevosCuposDisponibles,
      },
    });

    this.logger.log(`Slot ${codigo_slot} actualizado por Admin ${adminId}`);

    return updatedSlot;
  }

  /**
   * Eliminar un slot (Admin)
   */
  async deleteSlot(codigo_slot: number, adminId: number) {
    const slot = await this.prisma.slot.findUnique({
      where: { codigo_slot },
      include: { citas: true },
    });

    if (!slot) {
      throw new NotFoundException(`Slot con código ${codigo_slot} no encontrado`);
    }

    // Si tiene citas, solo desactivar
    if (slot.citas.length > 0) {
      const deactivatedSlot = await this.prisma.slot.update({
        where: { codigo_slot },
        data: { activo: false },
      });
      this.logger.log(
        `Slot ${codigo_slot} desactivado (tenía citas) por Admin ${adminId}`,
      );
      return { message: 'Slot desactivado porque tiene citas asociadas', slot: deactivatedSlot };
    }

    // Si no tiene citas, eliminar físicamente
    await this.prisma.slot.delete({
      where: { codigo_slot },
    });

    this.logger.log(`Slot ${codigo_slot} eliminado por Admin ${adminId}`);
    return { message: 'Slot eliminado exitosamente' };
  }

  /**
   * Eliminar slots por rango de fechas (Admin)
   * Solo elimina slots que no tengan citas agendadas.
   */
  async deleteSlotsByRange(startDateStr: string, endDateStr: string, adminId: number) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    // Ensure dates are set to midnight to cover the full range correctly
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    const result = await this.prisma.slot.deleteMany({
      where: {
        fecha: {
          gte: startDate,
          lte: endDate,
        },
        citas: {
          none: {}, // Solo eliminar si no tiene citas
        },
      },
    });

    this.logger.log(
      `Eliminados ${result.count} slots vacíos entre ${startDateStr} y ${endDateStr} por Admin ${adminId}`,
    );

    return { count: result.count, message: `Se eliminaron ${result.count} slots vacíos.` };
  }

  // ==================== CITAS ====================

  /**
   * Crear una nueva cita (Paciente)
   * IMPORTANTE: Requiere cotización con método de pago seleccionado
   */
  async createCita(data: CreateCitaDto, codigo_paciente: number) {
    // Verificar slot
    const slot = await this.prisma.slot.findUnique({
      where: { codigo_slot: data.codigo_slot },
      include: { servicio: true, sede: true },
    });

    if (!slot) {
      throw new NotFoundException(`Slot con código ${data.codigo_slot} no encontrado`);
    }

    if (!slot.activo) {
      throw new BadRequestException('El slot seleccionado no está disponible');
    }

    if (slot.cupos_disponibles <= 0) {
      throw new BadRequestException('No hay cupos disponibles en este horario');
    }

    // Verificar si el paciente ya tiene cita en ese slot
    const existingCita = await this.prisma.cita.findFirst({
      where: {
        codigo_slot: data.codigo_slot,
        codigo_paciente,
        estado: { not: 'CANCELADA' },
      },
    });

    if (existingCita) {
      throw new BadRequestException('Ya tienes una cita agendada en este horario');
    }

    // VALIDACIÓN DE COTIZACIÓN Y PAGO (OBLIGATORIO)
    if (!data.codigo_cotizacion) {
      throw new BadRequestException(
        'Se requiere una cotización para agendar una cita. Por favor, cree una cotización primero y seleccione un método de pago.',
      );
    }

    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { codigo_cotizacion: data.codigo_cotizacion },
    });

    if (!cotizacion) {
      throw new NotFoundException(`Cotización ${data.codigo_cotizacion} no encontrada`);
    }

    if (cotizacion.codigo_paciente !== codigo_paciente) {
      throw new BadRequestException('La cotización no pertenece al paciente');
    }

    // Verificar si ya tiene cita
    const citaExistente = await this.prisma.cita.findUnique({
      where: { codigo_cotizacion: data.codigo_cotizacion }
    });

    if (citaExistente) {
      throw new BadRequestException('Esta cotización ya tiene una cita asociada');
    }

    // Verificar que la cotización no esté expirada
    if (new Date() > cotizacion.fecha_expiracion) {
      throw new BadRequestException('La cotización ha expirado. Por favor, cree una nueva cotización.');
    }

    // VALIDACIÓN DE ESTADO DE PAGO
    // Solo se puede agendar si:
    // - PAGADA: Pago online completado o pago ventanilla confirmado
    // - PENDIENTE_PAGO_VENTANILLA: Paciente eligió pagar presencialmente (compromiso de pago)
    const estadosPermitidos = ['PAGADA', 'PENDIENTE_PAGO_VENTANILLA'];

    if (!estadosPermitidos.includes(cotizacion.estado)) {
      throw new BadRequestException(
        `No se puede agendar cita con cotización en estado "${cotizacion.estado}". ` +
        'Debe seleccionar un método de pago (online o ventanilla) antes de agendar.',
      );
    }

    this.logger.log(
      `Cita autorizada | Cotización: ${cotizacion.numero_cotizacion} | Estado: ${cotizacion.estado}`,
    );

    // Crear cita en transacción para asegurar consistencia de cupos
    const cita = await this.prisma.$transaction(async (prisma) => {
      // Decrementar cupos
      await prisma.slot.update({
        where: { codigo_slot: data.codigo_slot },
        data: {
          cupos_disponibles: { decrement: 1 },
        },
      });

      // Crear cita
      return prisma.cita.create({
        data: {
          codigo_paciente,
          codigo_slot: data.codigo_slot,
          estado: 'PENDIENTE',
          observaciones: data.observaciones,
          codigo_cotizacion: data.codigo_cotizacion,
        },
        include: {
          slot: {
            include: {
              servicio: true,
              sede: true,
            },
          },
          paciente: {
            select: {
              nombres: true,
              apellidos: true,
              email: true,
            },
          },
        },
      });
    });

    this.logger.log(
      `Cita creada: ID ${cita.codigo_cita} | Paciente: ${codigo_paciente} | Slot: ${data.codigo_slot}`,
    );

    // Notificar
    this.eventsGateway.notifyAppointmentUpdate({
      appointmentId: cita.codigo_cita,
      patientId: codigo_paciente,
      action: 'created',
      appointment: cita
    });

    return cita;
  }

  /**
   * Obtener mis citas (Paciente)
   */
  async getMyCitas(codigo_paciente: number) {
    return this.prisma.cita.findMany({
      where: { codigo_paciente },
      include: {
        slot: {
          include: {
            servicio: true,
            sede: true,
          },
        },
      },
      orderBy: {
        slot: {
          fecha: 'desc',
        },
      },
    });
  }

  /**
   * Obtener cita por ID
   */
  async getCitaById(codigo_cita: number, codigo_paciente?: number) {
    const where: any = { codigo_cita };
    if (codigo_paciente) {
      where.codigo_paciente = codigo_paciente;
    }

    const cita = await this.prisma.cita.findFirst({
      where,
      include: {
        slot: {
          include: {
            servicio: true,
            sede: true,
          },
        },
        paciente: {
          select: {
            codigo_usuario: true,
            nombres: true,
            apellidos: true,
            email: true,
            telefono: true,
          },
        },
      },
    });

    if (!cita) {
      throw new NotFoundException(`Cita no encontrada`);
    }

    return cita;
  }

  /**
   * Cancelar cita (Paciente)
   */
  async cancelarCita(
    codigo_cita: number,
    motivo: string,
    codigo_paciente: number,
  ) {
    const cita = await this.prisma.cita.findFirst({
      where: { codigo_cita, codigo_paciente },
      include: { slot: true },
    });

    if (!cita) {
      throw new NotFoundException(`Cita no encontrada`);
    }

    if (cita.estado === 'CANCELADA' || cita.estado === 'COMPLETADA') {
      throw new BadRequestException(`No se puede cancelar una cita en estado ${cita.estado}`);
    }

    // Actualizar en transacción
    const updatedCita = await this.prisma.$transaction(async (prisma) => {
      // Incrementar cupos
      await prisma.slot.update({
        where: { codigo_slot: cita.codigo_slot },
        data: {
          cupos_disponibles: { increment: 1 },
        },
      });

      // Actualizar cita
      return prisma.cita.update({
        where: { codigo_cita },
        data: {
          estado: 'CANCELADA',
          observaciones: cita.observaciones
            ? `${cita.observaciones} | Cancelada: ${motivo}`
            : `Cancelada: ${motivo}`,
        },
      });
    });

    this.logger.log(`Cita ${codigo_cita} cancelada por paciente ${codigo_paciente}`);

    return updatedCita;
  }

  /**
   * Actualizar cita (Admin/Reagendar)
   */
  async updateCita(
    codigo_cita: number,
    data: UpdateCitaDto,
    userId: number,
    isAdmin: boolean = false,
  ) {
    const cita = await this.prisma.cita.findUnique({
      where: { codigo_cita },
      include: { slot: true },
    });

    if (!cita) {
      throw new NotFoundException(`Cita no encontrada`);
    }

    // Si no es admin, verificar propiedad
    if (!isAdmin && cita.codigo_paciente !== userId) {
      throw new NotFoundException(`Cita no encontrada`);
    }

    // Si se cambia de slot (reagendar)
    if (data.codigo_slot && data.codigo_slot !== cita.codigo_slot) {
      // Verificar nuevo slot
      const newSlot = await this.prisma.slot.findUnique({
        where: { codigo_slot: data.codigo_slot },
      });

      if (!newSlot) {
        throw new NotFoundException(`Nuevo slot no encontrado`);
      }

      if (!newSlot.activo || newSlot.cupos_disponibles <= 0) {
        throw new BadRequestException(`El nuevo slot no está disponible`);
      }

      // Transacción para mover cupos
      return this.prisma.$transaction(async (prisma) => {
        // Liberar cupo anterior
        await prisma.slot.update({
          where: { codigo_slot: cita.codigo_slot },
          data: { cupos_disponibles: { increment: 1 } },
        });

        // Ocupar nuevo cupo
        await prisma.slot.update({
          where: { codigo_slot: data.codigo_slot },
          data: { cupos_disponibles: { decrement: 1 } },
        });

        // Actualizar cita
        return prisma.cita.update({
          where: { codigo_cita },
          data: {
            codigo_slot: data.codigo_slot,
            estado: data.estado || cita.estado,
            observaciones: data.observaciones || cita.observaciones,
          },
        });
      });
    }

    // FLUJO FLEXIBLE: No se requiere pago confirmado para tomar muestras
    // La validación de pago se hace solo al validar/entregar resultados
    // Esto permite: Paciente llega -> Paga en ventanilla -> Se toma muestra -> Espera -> Recibe resultados
    // El pago puede confirmarse en cualquier momento antes de validar resultados

    // Actualización simple
    const updatedCita = await this.prisma.cita.update({
      where: { codigo_cita },
      data: {
        estado: data.estado || cita.estado,
        observaciones: data.observaciones || cita.observaciones,
      },
    });

    // Si se completó la cita y tiene cotización, generar muestra, resultados pendientes y descontar inventario
    if (data.estado === 'COMPLETADA' && cita.estado !== 'COMPLETADA' && (updatedCita as any).codigo_cotizacion) {
      const cotizacion = await this.prisma.cotizacion.findUnique({
        where: { codigo_cotizacion: (updatedCita as any).codigo_cotizacion },
        include: { detalles: true }
      });

      if (cotizacion) {
        // Crear Muestra
        const muestra = await this.prisma.muestra.create({
          data: {
            codigo_cita: codigo_cita,
            codigo_paciente: updatedCita.codigo_paciente,
            id_muestra: `M-${new Date().getFullYear()}-${codigo_cita}`, // ID temporal
            tipo_muestra: 'SANGRE', // Default, debería venir del examen
            fecha_toma: new Date(),
            estado: 'PENDIENTE'
          }
        });

        // Crear Resultados Pendientes
        const codigosExamenes: number[] = [];
        for (const detalle of cotizacion.detalles) {
          await this.prisma.resultado.create({
            data: {
              codigo_muestra: muestra.codigo_muestra,
              codigo_examen: detalle.codigo_examen,
              valor_texto: '',
              estado: 'PENDIENTE',
              fecha_resultado: new Date(),
            }
          });
          codigosExamenes.push(detalle.codigo_examen);
        }

        this.logger.log(`Generados resultados pendientes para cita ${codigo_cita}`);

        // KARDEX: Descontar insumos del inventario para todos los exámenes
        if (codigosExamenes.length > 0) {
          try {
            const resultadoInventario = await this.inventarioService.descontarInsumosMultiplesExamenes(
              codigosExamenes,
              codigo_cita,
              userId,
            );

            if (resultadoInventario.success) {
              this.logger.log(
                `Kardex: Descontados ${resultadoInventario.totalMovimientos} insumos para cita ${codigo_cita}`,
              );
            } else {
              this.logger.warn(
                `Kardex: Algunos insumos no pudieron descontarse para cita ${codigo_cita}`,
              );
            }
          } catch (error) {
            // Log error pero no falla la operación completa (los exámenes pueden no tener insumos configurados)
            this.logger.warn(`Kardex: Error al descontar insumos - ${error.message}`);
          }
        }
      }
    }

    return updatedCita;
  }

  /**
   * Obtener todas las citas (Admin)
   */
  async getAllCitas(filters: any) {
    const where: any = {};

    if (filters.codigo_paciente) where.codigo_paciente = filters.codigo_paciente;
    if (filters.estado) where.estado = filters.estado;

    if (filters.codigo_servicio || filters.codigo_sede || filters.fecha_desde || filters.fecha_hasta) {
      where.slot = {};

      if (filters.codigo_servicio) where.slot.codigo_servicio = filters.codigo_servicio;
      if (filters.codigo_sede) where.slot.codigo_sede = filters.codigo_sede;

      if (filters.fecha_desde) {
        where.slot.fecha = { ...where.slot.fecha, gte: new Date(filters.fecha_desde) };
      }
      if (filters.fecha_hasta) {
        where.slot.fecha = { ...where.slot.fecha, lte: new Date(filters.fecha_hasta) };
      }
    }

    return this.prisma.cita.findMany({
      where,
      include: {
        paciente: {
          select: {
            nombres: true,
            apellidos: true,
            email: true,
            telefono: true,
          },
        },
        slot: {
          include: {
            servicio: true,
            sede: true,
          },
        },
      },
      orderBy: {
        slot: {
          fecha: 'desc',
        },
      },
    });
  }

  /**
   * Confirmar cita (Admin)
   */
  async confirmarCita(codigo_cita: number, adminId: number) {
    const cita = await this.prisma.cita.findUnique({
      where: { codigo_cita },
    });

    if (!cita) {
      throw new NotFoundException(`Cita no encontrada`);
    }

    const updatedCita = await this.prisma.cita.update({
      where: { codigo_cita },
      data: { estado: 'CONFIRMADA' },
    });

    this.logger.log(`Cita ${codigo_cita} confirmada por Admin ${adminId}`);
    return updatedCita;
  }

  /**
   * Confirmar asistencia a cita (Paciente)
   * El paciente confirma que asistirá a su cita
   */
  async confirmarCitaPaciente(codigo_cita: number, codigo_paciente: number) {
    const cita = await this.prisma.cita.findFirst({
      where: {
        codigo_cita,
        codigo_paciente, // Solo puede confirmar sus propias citas
      },
      include: {
        slot: {
          include: {
            servicio: true,
            sede: true,
          },
        },
      },
    });

    if (!cita) {
      throw new NotFoundException(`Cita no encontrada`);
    }

    // Solo se puede confirmar citas en estado PENDIENTE o AGENDADA
    if (cita.estado !== 'PENDIENTE' && cita.estado !== 'AGENDADA') {
      throw new BadRequestException(
        `No se puede confirmar una cita en estado ${cita.estado}. Solo citas pendientes o agendadas pueden ser confirmadas.`,
      );
    }

    // Verificar que la cita sea futura
    const ahora = new Date();
    if (cita.slot.fecha < ahora) {
      throw new BadRequestException('No se puede confirmar una cita pasada');
    }

    const updatedCita = await this.prisma.cita.update({
      where: { codigo_cita },
      data: { estado: 'CONFIRMADA' },
      include: {
        slot: {
          include: {
            servicio: true,
            sede: true,
          },
        },
        paciente: {
          select: {
            nombres: true,
            apellidos: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`Cita ${codigo_cita} confirmada por Paciente ${codigo_paciente}`);

    // Notificar via WebSocket
    this.eventsGateway.notifyAppointmentUpdate({
      appointmentId: codigo_cita,
      patientId: codigo_paciente,
      action: 'confirmed',
      appointment: updatedCita,
    });

    // Enviar email de confirmación
    try {
      const fechaFormateada = updatedCita.slot.fecha.toLocaleDateString('es-EC', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const horaFormateada = updatedCita.slot.hora_inicio.toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      await this.comunicacionesService.sendAppointmentConfirmationEmail(
        {
          email: updatedCita.paciente.email,
          nombres: updatedCita.paciente.nombres,
        },
        {
          fecha: fechaFormateada,
          hora: horaFormateada,
          servicio: updatedCita.slot.servicio.nombre,
          sede: updatedCita.slot.sede.nombre,
        },
      );
    } catch (emailError) {
      this.logger.warn(`No se pudo enviar email de confirmación: ${emailError.message}`);
    }

    return {
      message: 'Cita confirmada exitosamente',
      cita: updatedCita,
    };
  }

  /**
   * Obtener estadísticas (Admin)
   */
  async getEstadisticas(filters: any) {
    // Implementación básica de estadísticas
    const totalCitas = await this.prisma.cita.count();
    const citasPorEstado = await this.prisma.cita.groupBy({
      by: ['estado'],
      _count: {
        codigo_cita: true,
      },
    });

    return {
      total: totalCitas,
      porEstado: citasPorEstado.map(item => ({
        estado: item.estado,
        cantidad: item._count.codigo_cita
      }))
    };
  }

  /**
   * Obtener estadísticas del dashboard del paciente
   * Datos dinámicos para el portal del paciente
   */
  async getPatientDashboardStats(codigoPaciente: number) {
    const ahora = new Date();
    const en30Dias = new Date();
    en30Dias.setDate(en30Dias.getDate() + 30);

    // Ejecutar todas las queries en paralelo
    const [
      citasProximas,
      resultadosListos,
      resultadosEnProceso,
      cotizacionesPendientes,
      proximasCitas,
      resultadosRecientes,
    ] = await Promise.all([
      // Citas próximas (30 días)
      this.prisma.cita.count({
        where: {
          codigo_paciente: codigoPaciente,
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
          slot: {
            fecha: { gte: ahora, lte: en30Dias },
          },
        },
      }),

      // Resultados listos para descargar
      this.prisma.resultado.count({
        where: {
          muestra: { codigo_paciente: codigoPaciente },
          estado: 'COMPLETADO',
        },
      }),

      // Resultados en proceso
      this.prisma.resultado.count({
        where: {
          muestra: { codigo_paciente: codigoPaciente },
          estado: { in: ['PENDIENTE', 'EN_PROCESO'] },
        },
      }),

      // Cotizaciones pendientes de pago
      this.prisma.cotizacion.count({
        where: {
          codigo_paciente: codigoPaciente,
          estado: 'APROBADA', // Aprobada pero no pagada
        },
      }),

      // Detalle de próximas citas (máximo 3)
      this.prisma.cita.findMany({
        where: {
          codigo_paciente: codigoPaciente,
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
          slot: { fecha: { gte: ahora } },
        },
        include: {
          slot: {
            include: {
              servicio: true,
              sede: true,
            },
          },
        },
        orderBy: { slot: { fecha: 'asc' } },
        take: 3,
      }),

      // Resultados recientes (máximo 3)
      this.prisma.resultado.findMany({
        where: {
          muestra: { codigo_paciente: codigoPaciente },
        },
        include: {
          examen: true,
          muestra: true,
        },
        orderBy: { fecha_resultado: 'desc' },
        take: 3,
      }),
    ]);

    return {
      stats: {
        citasProximas,
        resultadosListos,
        resultadosEnProceso,
        cotizacionesPendientes,
      },
      proximasCitas: proximasCitas.map((cita) => ({
        codigo_cita: cita.codigo_cita,
        fecha: cita.slot.fecha,
        hora: cita.slot.hora_inicio,
        servicio: cita.slot.servicio.nombre,
        sede: cita.slot.sede.nombre,
        estado: cita.estado,
      })),
      resultadosRecientes: resultadosRecientes.map((resultado) => ({
        codigo_resultado: resultado.codigo_resultado,
        examen: resultado.examen.nombre,
        fecha: resultado.fecha_resultado,
        estado: resultado.estado,
      })),
    };
  }
}
