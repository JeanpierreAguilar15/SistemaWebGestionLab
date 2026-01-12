import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCotizacionDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CotizacionesService {
  private readonly logger = new Logger(CotizacionesService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Obtener todos los exámenes agrupados por categoría
   * Para mostrar el checklist dinámico al paciente
   */
  async getExamenesParaCotizacion() {
    const categorias = await this.prisma.categoriaExamen.findMany({
      where: { activo: true },
      include: {
        examenes: {
          where: { activo: true },
          include: {
            precios: {
              where: {
                activo: true,
                AND: [
                  {
                    fecha_inicio: {
                      lte: new Date(),
                    },
                  },
                  {
                    OR: [
                      { fecha_fin: null },
                      {
                        fecha_fin: {
                          gte: new Date(),
                        },
                      },
                    ],
                  },
                ],
              },
              orderBy: {
                fecha_inicio: 'desc',
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    // Transformar para incluir precio actual y requisitos
    return categorias.map((categoria) => ({
      codigo_categoria: categoria.codigo_categoria,
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      examenes: categoria.examenes.map((examen) => ({
        codigo_examen: examen.codigo_examen,
        codigo_interno: examen.codigo_interno,
        nombre: examen.nombre,
        descripcion: examen.descripcion,
        precio_actual: examen.precios[0]?.precio || 0,
        // Requisitos para el examen
        requiere_ayuno: examen.requiere_ayuno,
        horas_ayuno: examen.horas_ayuno,
        instrucciones_preparacion: examen.instrucciones_preparacion,
        tiempo_entrega_horas: examen.tiempo_entrega_horas,
        tipo_muestra: examen.tipo_muestra,
      })),
    }));
  }

  /**
   * Crear cotización con cálculo automático de precios
   */
  async createCotizacion(
    data: CreateCotizacionDto,
    codigo_paciente: number,
  ) {
    // Verificar que todos los exámenes existan y obtener precios actuales
    const examenesConPrecios = await Promise.all(
      data.examenes.map(async (item) => {
        const examen = await this.prisma.examen.findUnique({
          where: { codigo_examen: item.codigo_examen },
          include: {
            precios: {
              where: {
                activo: true,
                AND: [
                  {
                    fecha_inicio: {
                      lte: new Date(),
                    },
                  },
                  {
                    OR: [
                      { fecha_fin: null },
                      {
                        fecha_fin: {
                          gte: new Date(),
                        },
                      },
                    ],
                  },
                ],
              },
              orderBy: {
                fecha_inicio: 'desc',
              },
              take: 1,
            },
          },
        });

        if (!examen) {
          throw new NotFoundException(
            `Examen con código ${item.codigo_examen} no encontrado`,
          );
        }

        if (!examen.activo) {
          throw new BadRequestException(
            `El examen ${examen.nombre} no está disponible`,
          );
        }

        const precioActual = examen.precios[0];
        if (!precioActual) {
          throw new BadRequestException(
            `El examen ${examen.nombre} no tiene precio configurado`,
          );
        }

        return {
          codigo_examen: item.codigo_examen,
          cantidad: item.cantidad,
          precio_unitario: precioActual.precio,
          nombre_examen: examen.nombre,
        };
      }),
    );

    // Calcular subtotal
    const subtotal = examenesConPrecios.reduce((sum, item) => {
      const lineTotal = Number(item.precio_unitario) * item.cantidad;
      return sum + lineTotal;
    }, 0);

    // Aplicar descuento
    const descuento = data.descuento || 0;
    const total = subtotal - descuento;

    if (total < 0) {
      throw new BadRequestException(
        'El descuento no puede ser mayor al subtotal',
      );
    }

    // Generar número de cotización único
    const numero_cotizacion = await this.generarNumeroCotizacion();

    // Fecha de expiración (30 días)
    const fecha_expiracion = new Date();
    fecha_expiracion.setDate(fecha_expiracion.getDate() + 30);

    // Crear cotización con detalles en transacción
    const cotizacion = await this.prisma.$transaction(async (tx) => {
      const nuevaCotizacion = await tx.cotizacion.create({
        data: {
          codigo_paciente,
          numero_cotizacion,
          fecha_expiracion,
          subtotal: new Decimal(subtotal.toFixed(2)),
          descuento: new Decimal(descuento.toFixed(2)),
          total: new Decimal(total.toFixed(2)),
          estado: 'PENDIENTE',
          observaciones: data.observaciones,
          detalles: {
            create: examenesConPrecios.map((item) => ({
              codigo_examen: item.codigo_examen,
              cantidad: item.cantidad,
              precio_unitario: item.precio_unitario,
              total_linea: new Decimal(
                (Number(item.precio_unitario) * item.cantidad).toFixed(2),
              ),
            })),
          },
        },
        include: {
          detalles: {
            include: {
              examen: {
                select: {
                  codigo_examen: true,
                  codigo_interno: true,
                  nombre: true,
                  requiere_ayuno: true,
                  horas_ayuno: true,
                  instrucciones_preparacion: true,
                  tiempo_entrega_horas: true,
                  tipo_muestra: true,
                },
              },
            },
          },
          paciente: {
            select: {
              codigo_usuario: true,
              nombres: true,
              apellidos: true,
              email: true,
              cedula: true,
            },
          },
        },
      });

      return nuevaCotizacion;
    });

    this.logger.log(
      `Cotización creada: ${numero_cotizacion} | Paciente: ${codigo_paciente} | Total: $${total}`,
    );

    return cotizacion;
  }

  /**
   * Obtener cotizaciones del paciente autenticado
   */
  async getMyCotizaciones(codigo_paciente: number) {
    const cotizaciones = await this.prisma.cotizacion.findMany({
      where: {
        codigo_paciente,
      },
      include: {
        detalles: {
          include: {
            examen: {
              select: {
                codigo_examen: true,
                nombre: true,
                codigo_interno: true,
              },
            },
          },
        },
        cita: {
          select: {
            codigo_cita: true,
            estado: true,
            fecha_creacion: true,
          }
        }
      },
      orderBy: {
        fecha_cotizacion: 'desc',
      },
    });

    return cotizaciones;
  }

  /**
   * Obtener una cotización específica (con verificación de propiedad)
   */
  async getCotizacion(codigo_cotizacion: number, codigo_paciente: number) {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { codigo_cotizacion },
      include: {
        detalles: {
          include: {
            examen: {
              select: {
                codigo_examen: true,
                codigo_interno: true,
                nombre: true,
                descripcion: true,
                requiere_ayuno: true,
                horas_ayuno: true,
                instrucciones_preparacion: true,
                tiempo_entrega_horas: true,
                tipo_muestra: true,
              },
            },
          },
        },
        paciente: {
          select: {
            codigo_usuario: true,
            nombres: true,
            apellidos: true,
            email: true,
            cedula: true,
            telefono: true,
          },
        },
      },
    });

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    // Verificar que pertenece al paciente
    if (cotizacion.codigo_paciente !== codigo_paciente) {
      throw new NotFoundException('Cotización no encontrada');
    }

    return cotizacion;
  }

  /**
   * Obtener todas las cotizaciones (Admin)
   */
  async getAllCotizaciones(filters?: {
    codigo_paciente?: number;
    estado?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  }) {
    const where: any = {};

    if (filters?.codigo_paciente) {
      where.codigo_paciente = filters.codigo_paciente;
    }

    if (filters?.estado) {
      where.estado = filters.estado;
    }

    if (filters?.fecha_desde || filters?.fecha_hasta) {
      where.fecha_cotizacion = {};

      if (filters.fecha_desde) {
        where.fecha_cotizacion.gte = new Date(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        where.fecha_cotizacion.lte = new Date(filters.fecha_hasta);
      }
    }

    const cotizaciones = await this.prisma.cotizacion.findMany({
      where,
      include: {
        paciente: {
          select: {
            codigo_usuario: true,
            nombres: true,
            apellidos: true,
            cedula: true,
            email: true,
          },
        },
        detalles: {
          include: {
            examen: {
              select: {
                codigo_examen: true,
                nombre: true,
                codigo_interno: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha_cotizacion: 'desc',
      },
    });

    return cotizaciones;
  }

  /**
   * Actualizar estado de cotización (Admin)
   */
  async updateCotizacion(
    codigo_cotizacion: number,
    estado: string,
    observaciones?: string,
  ) {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { codigo_cotizacion },
    });

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    const updated = await this.prisma.cotizacion.update({
      where: { codigo_cotizacion },
      data: {
        estado,
        observaciones: observaciones || cotizacion.observaciones,
      },
      include: {
        paciente: {
          select: {
            nombres: true,
            apellidos: true,
            email: true,
          },
        },
        detalles: {
          include: {
            examen: true,
          },
        },
      },
    });

    this.logger.log(
      `Cotización actualizada: ${cotizacion.numero_cotizacion} | Nuevo estado: ${estado}`,
    );

    return updated;
  }

  /**
   * Obtener estadísticas de cotizaciones (Admin)
   */
  async getEstadisticas(filters?: {
    fecha_desde?: string;
    fecha_hasta?: string;
  }) {
    const where: any = {};

    if (filters?.fecha_desde || filters?.fecha_hasta) {
      where.fecha_cotizacion = {};

      if (filters.fecha_desde) {
        where.fecha_cotizacion.gte = new Date(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        where.fecha_cotizacion.lte = new Date(filters.fecha_hasta);
      }
    }

    const [total, pendientes, aceptadas, rechazadas, pagadas, expiradas] =
      await Promise.all([
        this.prisma.cotizacion.count({ where }),
        this.prisma.cotizacion.count({
          where: { ...where, estado: 'PENDIENTE' },
        }),
        this.prisma.cotizacion.count({
          where: { ...where, estado: 'ACEPTADA' },
        }),
        this.prisma.cotizacion.count({
          where: { ...where, estado: 'RECHAZADA' },
        }),
        this.prisma.cotizacion.count({ where: { ...where, estado: 'PAGADA' } }),
        this.prisma.cotizacion.count({
          where: { ...where, estado: 'EXPIRADA' },
        }),
      ]);

    // Calcular total de ventas de cotizaciones pagadas
    const totalVentas = await this.prisma.cotizacion.aggregate({
      where: { ...where, estado: 'PAGADA' },
      _sum: {
        total: true,
      },
    });

    return {
      total,
      pendientes,
      aceptadas,
      rechazadas,
      pagadas,
      expiradas,
      total_ventas: totalVentas._sum.total || 0,
    };
  }

  /**
   * Seleccionar método de pago para cotización (Paciente)
   * @param codigo_cotizacion ID de la cotización
   * @param metodo_pago ONLINE | VENTANILLA
   * @param codigo_paciente ID del paciente (para verificar propiedad)
   */
  async seleccionarMetodoPago(
    codigo_cotizacion: number,
    metodo_pago: 'ONLINE' | 'VENTANILLA',
    codigo_paciente: number,
  ) {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { codigo_cotizacion },
    });

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    // Verificar propiedad
    if (cotizacion.codigo_paciente !== codigo_paciente) {
      throw new NotFoundException('Cotización no encontrada');
    }

    // Verificar estado válido para selección de pago
    if (!['PENDIENTE', 'ACEPTADA'].includes(cotizacion.estado)) {
      throw new BadRequestException(
        `No se puede seleccionar método de pago para una cotización en estado ${cotizacion.estado}`,
      );
    }

    // Verificar que no esté expirada
    if (new Date() > cotizacion.fecha_expiracion) {
      // Actualizar a expirada si no lo está
      await this.prisma.cotizacion.update({
        where: { codigo_cotizacion },
        data: { estado: 'EXPIRADA' },
      });
      throw new BadRequestException('La cotización ha expirado');
    }

    // Determinar nuevo estado según método de pago
    const nuevoEstado = metodo_pago === 'VENTANILLA'
      ? 'PENDIENTE_PAGO_VENTANILLA'
      : 'PAGO_EN_PROCESO';

    const cotizacionActualizada = await this.prisma.cotizacion.update({
      where: { codigo_cotizacion },
      data: {
        metodo_pago_seleccionado: metodo_pago,
        fecha_seleccion_pago: new Date(),
        estado: nuevoEstado,
      },
      include: {
        detalles: {
          include: {
            examen: {
              select: {
                codigo_examen: true,
                nombre: true,
                codigo_interno: true,
              },
            },
          },
        },
        paciente: {
          select: {
            codigo_usuario: true,
            nombres: true,
            apellidos: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `Cotización ${cotizacion.numero_cotizacion} | Método de pago seleccionado: ${metodo_pago} | Nuevo estado: ${nuevoEstado}`,
    );

    return cotizacionActualizada;
  }

  /**
   * Confirmar pago en ventanilla (Admin/Laboratorista)
   * @param codigo_cotizacion ID de la cotización
   * @param admin_id ID del admin que confirma
   * @param observaciones Observaciones opcionales
   */
  async confirmarPagoVentanilla(
    codigo_cotizacion: number,
    admin_id: number,
    observaciones?: string,
  ) {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { codigo_cotizacion },
      include: {
        paciente: {
          select: {
            nombres: true,
            apellidos: true,
            email: true,
          },
        },
        detalles: {
          include: {
            examen: true,
          },
        },
      },
    });

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    // Verificar que esté en estado correcto
    if (cotizacion.estado !== 'PENDIENTE_PAGO_VENTANILLA') {
      throw new BadRequestException(
        `Solo se puede confirmar pago de cotizaciones en estado PENDIENTE_PAGO_VENTANILLA. Estado actual: ${cotizacion.estado}`,
      );
    }

    // Actualizar cotización y crear pago en transacción
    const resultado = await this.prisma.$transaction(async (tx) => {
      // Generar número de pago
      const numeroPago = await this.generarNumeroPago(tx);

      // Crear registro de pago
      const pago = await tx.pago.create({
        data: {
          codigo_cotizacion,
          codigo_paciente: cotizacion.codigo_paciente,
          numero_pago: numeroPago,
          monto_total: cotizacion.total,
          metodo_pago: 'EFECTIVO', // Por defecto en ventanilla es efectivo
          estado: 'COMPLETADO',
          observaciones: observaciones || 'Pago confirmado en ventanilla',
        },
      });

      // Actualizar cotización
      const cotizacionActualizada = await tx.cotizacion.update({
        where: { codigo_cotizacion },
        data: {
          estado: 'PAGADA',
          pago_confirmado_por: admin_id,
          fecha_confirmacion_pago: new Date(),
          observaciones: observaciones
            ? `${cotizacion.observaciones || ''} | Pago ventanilla: ${observaciones}`.trim()
            : cotizacion.observaciones,
        },
        include: {
          paciente: {
            select: {
              codigo_usuario: true,
              nombres: true,
              apellidos: true,
              email: true,
            },
          },
          detalles: {
            include: {
              examen: true,
            },
          },
          cita: true,
        },
      });

      return { cotizacion: cotizacionActualizada, pago };
    });

    this.logger.log(
      `Pago ventanilla confirmado | Cotización: ${cotizacion.numero_cotizacion} | Admin: ${admin_id} | Monto: $${cotizacion.total}`,
    );

    return resultado;
  }

  /**
   * Obtener cotizaciones pendientes de pago en ventanilla (Admin)
   */
  async getCotizacionesPendientesVentanilla() {
    return this.prisma.cotizacion.findMany({
      where: {
        estado: 'PENDIENTE_PAGO_VENTANILLA',
      },
      include: {
        paciente: {
          select: {
            codigo_usuario: true,
            nombres: true,
            apellidos: true,
            cedula: true,
            email: true,
            telefono: true,
          },
        },
        detalles: {
          include: {
            examen: {
              select: {
                codigo_examen: true,
                nombre: true,
                codigo_interno: true,
              },
            },
          },
        },
        cita: {
          include: {
            slot: {
              include: {
                sede: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha_seleccion_pago: 'asc', // Más antiguos primero
      },
    });
  }

  /**
   * Verificar si una cotización permite agendar cita
   * @returns true si puede agendar, false si no
   */
  async puedeAgendarCita(codigo_cotizacion: number): Promise<{
    puede: boolean;
    motivo?: string;
    cotizacion?: any;
  }> {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { codigo_cotizacion },
      include: { cita: true },
    });

    if (!cotizacion) {
      return { puede: false, motivo: 'Cotización no encontrada' };
    }

    // Ya tiene cita
    if (cotizacion.cita) {
      return { puede: false, motivo: 'La cotización ya tiene una cita agendada' };
    }

    // Verificar expiración
    if (new Date() > cotizacion.fecha_expiracion) {
      return { puede: false, motivo: 'La cotización ha expirado' };
    }

    // Estados que permiten agendar cita
    const estadosPermitidos = ['PAGADA', 'PENDIENTE_PAGO_VENTANILLA'];

    if (!estadosPermitidos.includes(cotizacion.estado)) {
      return {
        puede: false,
        motivo: `No se puede agendar cita con cotización en estado ${cotizacion.estado}. Debe seleccionar un método de pago primero.`,
      };
    }

    return { puede: true, cotizacion };
  }

  /**
   * Verificar si se pueden procesar resultados de una cotización
   * Solo si el pago está confirmado (PAGADA)
   */
  async puedeProcesarResultados(codigo_cotizacion: number): Promise<{
    puede: boolean;
    motivo?: string;
  }> {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { codigo_cotizacion },
    });

    if (!cotizacion) {
      return { puede: false, motivo: 'Cotización no encontrada' };
    }

    if (cotizacion.estado !== 'PAGADA') {
      return {
        puede: false,
        motivo: `No se pueden procesar resultados sin pago confirmado. Estado actual: ${cotizacion.estado}`,
      };
    }

    return { puede: true };
  }

  /**
   * Generar número de pago único (usado internamente)
   */
  private async generarNumeroPago(tx?: any): Promise<string> {
    const prisma = tx || this.prisma;
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');

    const count = await prisma.pago.count({
      where: {
        numero_pago: {
          startsWith: `PAG-${year}${month}`,
        },
      },
    });

    const secuencial = String(count + 1).padStart(4, '0');
    return `PAG-${year}${month}-${secuencial}`;
  }

  /**
   * Generar número de cotización único
   */
  private async generarNumeroCotizacion(): Promise<string> {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');

    // Contar cotizaciones del mes actual
    const count = await this.prisma.cotizacion.count({
      where: {
        numero_cotizacion: {
          startsWith: `COT-${year}${month}`,
        },
      },
    });

    const secuencial = String(count + 1).padStart(4, '0');
    return `COT-${year}${month}-${secuencial}`;
  }
}
