import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePagoDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registrar un pago
   */
  async createPago(data: CreatePagoDto, codigo_paciente: number) {
    // Si hay cotización, verificar que existe y pertenece al paciente
    if (data.codigo_cotizacion) {
      const cotizacion = await this.prisma.cotizacion.findUnique({
        where: { codigo_cotizacion: data.codigo_cotizacion },
      });

      if (!cotizacion) {
        throw new NotFoundException('Cotización no encontrada');
      }

      if (cotizacion.codigo_paciente !== codigo_paciente) {
        throw new BadRequestException(
          'La cotización no pertenece al paciente',
        );
      }

      // Verificar que la cotización no esté expirada
      if (new Date(cotizacion.fecha_expiracion) < new Date()) {
        throw new BadRequestException('La cotización ha expirado');
      }

      // Verificar que el monto coincida con el total de la cotización
      const totalCotizacion = Number(cotizacion.total);
      if (Math.abs(data.monto_total - totalCotizacion) > 0.01) {
        throw new BadRequestException(
          `El monto del pago ($${data.monto_total}) no coincide con el total de la cotización ($${totalCotizacion})`,
        );
      }
    }

    // Generar número de pago único
    const numero_pago = await this.generarNumeroPago();

    // Crear pago en transacción
    const pago = await this.prisma.$transaction(async (tx) => {
      // Crear el pago
      const nuevoPago = await tx.pago.create({
        data: {
          codigo_cotizacion: data.codigo_cotizacion,
          codigo_paciente,
          numero_pago,
          monto_total: new Decimal(data.monto_total.toFixed(2)),
          metodo_pago: data.metodo_pago,
          estado: 'COMPLETADO', // Por defecto completado, puede cambiar según integración
          proveedor_pasarela: data.proveedor_pasarela,
          id_transaccion_externa: data.id_transaccion_externa,
          url_comprobante: data.url_comprobante,
          observaciones: data.observaciones,
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
          cotizacion: {
            select: {
              numero_cotizacion: true,
              total: true,
            },
          },
        },
      });

      // Si hay cotización, actualizar su estado a PAGADA
      if (data.codigo_cotizacion) {
        await tx.cotizacion.update({
          where: { codigo_cotizacion: data.codigo_cotizacion },
          data: { estado: 'PAGADA' },
        });
      }

      return nuevoPago;
    });

    this.logger.log(
      `Pago registrado: ${numero_pago} | Paciente: ${codigo_paciente} | Monto: $${data.monto_total}`,
    );

    return pago;
  }

  /**
   * Obtener pagos del paciente autenticado
   */
  async getMyPagos(codigo_paciente: number) {
    const pagos = await this.prisma.pago.findMany({
      where: {
        codigo_paciente,
      },
      include: {
        cotizacion: {
          select: {
            numero_cotizacion: true,
            total: true,
            detalles: {
              include: {
                examen: {
                  select: {
                    nombre: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        fecha_pago: 'desc',
      },
    });

    return pagos;
  }

  /**
   * Obtener un pago específico (con verificación de propiedad)
   */
  async getPago(codigo_pago: number, codigo_paciente: number) {
    const pago = await this.prisma.pago.findUnique({
      where: { codigo_pago },
      include: {
        paciente: {
          select: {
            codigo_usuario: true,
            nombres: true,
            apellidos: true,
            email: true,
            cedula: true,
          },
        },
        cotizacion: {
          include: {
            detalles: {
              include: {
                examen: true,
              },
            },
          },
        },
      },
    });

    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }

    // Verificar que pertenece al paciente
    if (pago.codigo_paciente !== codigo_paciente) {
      throw new NotFoundException('Pago no encontrado');
    }

    return pago;
  }

  /**
   * Obtener todos los pagos (Admin)
   */
  async getAllPagos(filters?: {
    codigo_paciente?: number;
    codigo_cotizacion?: number;
    metodo_pago?: string;
    estado?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  }) {
    const where: any = {};

    if (filters?.codigo_paciente) {
      where.codigo_paciente = filters.codigo_paciente;
    }

    if (filters?.codigo_cotizacion) {
      where.codigo_cotizacion = filters.codigo_cotizacion;
    }

    if (filters?.metodo_pago) {
      where.metodo_pago = filters.metodo_pago;
    }

    if (filters?.estado) {
      where.estado = filters.estado;
    }

    if (filters?.fecha_desde || filters?.fecha_hasta) {
      where.fecha_pago = {};

      if (filters.fecha_desde) {
        where.fecha_pago.gte = new Date(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        where.fecha_pago.lte = new Date(filters.fecha_hasta);
      }
    }

    const pagos = await this.prisma.pago.findMany({
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
        cotizacion: {
          select: {
            numero_cotizacion: true,
            total: true,
          },
        },
      },
      orderBy: {
        fecha_pago: 'desc',
      },
    });

    return pagos;
  }

  /**
   * Actualizar estado de pago (Admin)
   */
  async updatePago(
    codigo_pago: number,
    estado: string,
    observaciones?: string,
  ) {
    const pago = await this.prisma.pago.findUnique({
      where: { codigo_pago },
    });

    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }

    const updated = await this.prisma.pago.update({
      where: { codigo_pago },
      data: {
        estado,
        observaciones: observaciones || pago.observaciones,
      },
      include: {
        paciente: {
          select: {
            nombres: true,
            apellidos: true,
            email: true,
          },
        },
        cotizacion: true,
      },
    });

    this.logger.log(
      `Pago actualizado: ${pago.numero_pago} | Nuevo estado: ${estado}`,
    );

    return updated;
  }

  /**
   * Obtener estadísticas de pagos (Admin)
   */
  async getEstadisticas(filters?: {
    fecha_desde?: string;
    fecha_hasta?: string;
  }) {
    const where: any = {};

    if (filters?.fecha_desde || filters?.fecha_hasta) {
      where.fecha_pago = {};

      if (filters.fecha_desde) {
        where.fecha_pago.gte = new Date(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        where.fecha_pago.lte = new Date(filters.fecha_hasta);
      }
    }

    const [total, completados, pendientes, rechazados] = await Promise.all([
      this.prisma.pago.count({ where }),
      this.prisma.pago.count({ where: { ...where, estado: 'COMPLETADO' } }),
      this.prisma.pago.count({ where: { ...where, estado: 'PENDIENTE' } }),
      this.prisma.pago.count({ where: { ...where, estado: 'RECHAZADO' } }),
    ]);

    // Calcular total de ingresos (solo pagos completados)
    const totalIngresos = await this.prisma.pago.aggregate({
      where: { ...where, estado: 'COMPLETADO' },
      _sum: {
        monto_total: true,
      },
    });

    // Pagos por método
    const pagosPorMetodo = await this.prisma.pago.groupBy({
      by: ['metodo_pago'],
      where: { ...where, estado: 'COMPLETADO' },
      _count: {
        metodo_pago: true,
      },
      _sum: {
        monto_total: true,
      },
    });

    return {
      total,
      completados,
      pendientes,
      rechazados,
      total_ingresos: totalIngresos._sum.monto_total || 0,
      pagos_por_metodo: pagosPorMetodo,
    };
  }

  /**
   * Generar número de pago único
   */
  private async generarNumeroPago(): Promise<string> {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');

    // Contar pagos del mes actual
    const count = await this.prisma.pago.count({
      where: {
        numero_pago: {
          startsWith: `PAG-${year}${month}`,
        },
      },
    });

    const secuencial = String(count + 1).padStart(4, '0');
    return `PAG-${year}${month}-${secuencial}`;
  }
}
