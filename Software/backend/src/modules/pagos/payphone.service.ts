import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Interfaz para la respuesta de preparación de PayPhone
 */
interface PayPhonePrepareResponse {
  paymentId: number;
  payWithCard: string;
  payWithPayPhone: string;
  region: string;
}

/**
 * Interfaz para la respuesta de confirmación de PayPhone
 */
interface PayPhoneConfirmResponse {
  transactionStatus: string;
  transactionId: number;
  clientTransactionId: string;
  phoneNumber: string;
  email: string;
  document: string;
  amount: number;
  cardType: string;
  cardBrand: string;
  cardBrandCode: string;
  authorizationCode: string;
  currency: string;
  reference: string;
  statusCode: number;
  message: string;
  messageCode: number;
}

/**
 * Estados de transacción de PayPhone
 */
export enum PayPhoneTransactionStatus {
  APPROVED = 'Approved',
  PENDING = 'Pending',
  DECLINED = 'Declined',
  CANCELLED = 'Cancelled',
  ERROR = 'Error',
}

@Injectable()
export class PayPhoneService {
  private readonly logger = new Logger(PayPhoneService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly storeId: string;
  private readonly responseUrl: string;
  private readonly cancellationUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Configuración de PayPhone
    this.baseUrl = 'https://pay.payphonetodoesposible.com/api';
    this.token = this.configService.get<string>('PAYPHONE_TOKEN') || '';
    this.storeId = this.configService.get<string>('PAYPHONE_STORE_ID') || '';

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.responseUrl = `${frontendUrl}/portal/pago/callback`;
    this.cancellationUrl = `${frontendUrl}/portal/pago/cancelado`;
  }

  /**
   * Verificar si PayPhone está configurado correctamente
   */
  isConfigured(): boolean {
    return !!(this.token && this.storeId);
  }

  /**
   * Iniciar proceso de pago con PayPhone
   * @param codigo_cotizacion ID de la cotización
   * @param codigo_paciente ID del paciente
   */
  async iniciarPago(
    codigo_cotizacion: number,
    codigo_paciente: number,
  ): Promise<{ paymentUrl: string; paymentId: number }> {
    // Verificar configuración
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'PayPhone no está configurado. Contacte al administrador.',
      );
    }

    // Obtener cotización
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { codigo_cotizacion },
      include: {
        paciente: {
          select: {
            codigo_usuario: true,
            nombres: true,
            apellidos: true,
            email: true,
            telefono: true,
            cedula: true,
          },
        },
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
    });

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    // Verificar propiedad
    if (cotizacion.codigo_paciente !== codigo_paciente) {
      throw new NotFoundException('Cotización no encontrada');
    }

    // Verificar estado válido para pago
    if (!['PENDIENTE', 'ACEPTADA', 'PAGO_EN_PROCESO'].includes(cotizacion.estado)) {
      throw new BadRequestException(
        `No se puede procesar pago para cotización en estado ${cotizacion.estado}`,
      );
    }

    // Verificar expiración
    if (new Date() > cotizacion.fecha_expiracion) {
      await this.prisma.cotizacion.update({
        where: { codigo_cotizacion },
        data: { estado: 'EXPIRADA' },
      });
      throw new BadRequestException('La cotización ha expirado');
    }

    // Calcular montos
    // PayPhone requiere montos en centavos (multiplicar por 100)
    const total = Number(cotizacion.total);
    const amountInCents = Math.round(total * 100);

    // Por defecto, asumimos IVA 0% para servicios de salud en Ecuador
    // Si se necesita cobrar IVA, ajustar aquí
    const amountWithoutTax = amountInCents;
    const amountWithTax = 0;
    const tax = 0;

    // Generar ID de transacción único
    const clientTransactionId = `COT-${codigo_cotizacion}-${Date.now()}`;

    // Preparar descripción de exámenes
    const examenes = cotizacion.detalles
      .map((d) => d.examen.nombre)
      .join(', ')
      .substring(0, 200);

    // Preparar datos para PayPhone
    const prepareData = {
      amount: amountInCents,
      amountWithoutTax,
      amountWithTax,
      tax,
      service: 0, // Sin cargo por servicio adicional
      tip: 0,
      clientTransactionId,
      storeId: this.storeId,
      currency: 'USD',
      reference: `Laboratorio Franz - ${cotizacion.numero_cotizacion}`,
      phoneNumber: cotizacion.paciente.telefono?.replace(/\D/g, '') || '',
      email: cotizacion.paciente.email || '',
      documentId: cotizacion.paciente.cedula || '',
      responseUrl: this.responseUrl,
      cancellationUrl: this.cancellationUrl,
      // Información adicional opcional
      order: [
        {
          itemQty: cotizacion.detalles.length,
          unitPrice: amountInCents,
          description: `Exámenes de laboratorio: ${examenes}`,
        },
      ],
    };

    this.logger.log(`Iniciando pago PayPhone para cotización ${cotizacion.numero_cotizacion}`);
    this.logger.debug(`PayPhone Prepare Data: ${JSON.stringify(prepareData)}`);

    try {
      // Llamar a PayPhone API - Prepare
      const response = await fetch(`${this.baseUrl}/button/Prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(prepareData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`PayPhone Prepare Error: ${response.status} - ${errorText}`);
        throw new BadRequestException(
          `Error al iniciar pago: ${response.status}`,
        );
      }

      const result: PayPhonePrepareResponse = await response.json();

      this.logger.log(`PayPhone Prepare Success: paymentId=${result.paymentId}`);

      // Guardar transacción pendiente
      await this.prisma.$transaction(async (tx) => {
        // Actualizar cotización
        await tx.cotizacion.update({
          where: { codigo_cotizacion },
          data: {
            estado: 'PAGO_EN_PROCESO',
            metodo_pago_seleccionado: 'ONLINE',
            fecha_seleccion_pago: new Date(),
          },
        });

        // Crear registro de pago pendiente
        await tx.pago.create({
          data: {
            codigo_cotizacion,
            codigo_paciente,
            numero_pago: `PPH-${result.paymentId}`,
            monto_total: new Decimal(total.toFixed(2)),
            metodo_pago: 'TARJETA_CREDITO',
            estado: 'PENDIENTE',
            proveedor_pasarela: 'PAYPHONE',
            id_transaccion_externa: clientTransactionId,
            observaciones: `PayPhone Payment ID: ${result.paymentId}`,
          },
        });
      });

      // Retornar URL de pago
      // PayPhone devuelve dos URLs: payWithCard (pago directo con tarjeta) y payWithPayPhone (usando app)
      // Usamos payWithCard para web
      return {
        paymentUrl: result.payWithCard,
        paymentId: result.paymentId,
      };
    } catch (error) {
      this.logger.error(`Error en PayPhone Prepare: ${error.message}`);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Error al conectar con la pasarela de pago. Por favor intente nuevamente.',
      );
    }
  }

  /**
   * Confirmar pago con PayPhone (llamado después del callback)
   * @param id Payment ID retornado por PayPhone
   * @param clientTransactionId ID de transacción del cliente
   */
  async confirmarPago(
    id: string,
    clientTransactionId: string,
  ): Promise<{
    success: boolean;
    message: string;
    cotizacion?: any;
  }> {
    if (!this.isConfigured()) {
      throw new BadRequestException('PayPhone no está configurado');
    }

    this.logger.log(`Confirmando pago PayPhone: id=${id}, clientTransactionId=${clientTransactionId}`);

    try {
      // Llamar a PayPhone API - Confirm
      const response = await fetch(`${this.baseUrl}/button/V2/Confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          id: parseInt(id),
          clientTransactionId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`PayPhone Confirm Error: ${response.status} - ${errorText}`);
        throw new BadRequestException(`Error al confirmar pago: ${response.status}`);
      }

      const result: PayPhoneConfirmResponse = await response.json();

      this.logger.log(`PayPhone Confirm Response: status=${result.transactionStatus}, authCode=${result.authorizationCode}`);

      // Extraer código de cotización del clientTransactionId
      // Formato: COT-{codigo_cotizacion}-{timestamp}
      const match = clientTransactionId.match(/^COT-(\d+)-/);
      if (!match) {
        throw new BadRequestException('ID de transacción inválido');
      }
      const codigo_cotizacion = parseInt(match[1]);

      // Buscar pago pendiente
      const pagoPendiente = await this.prisma.pago.findFirst({
        where: {
          codigo_cotizacion,
          proveedor_pasarela: 'PAYPHONE',
          estado: 'PENDIENTE',
        },
      });

      if (!pagoPendiente) {
        this.logger.warn(`No se encontró pago pendiente para cotización ${codigo_cotizacion}`);
      }

      // Procesar según estado de la transacción
      if (result.transactionStatus === PayPhoneTransactionStatus.APPROVED) {
        // Pago exitoso
        const cotizacionActualizada = await this.prisma.$transaction(async (tx) => {
          // Actualizar pago
          if (pagoPendiente) {
            await tx.pago.update({
              where: { codigo_pago: pagoPendiente.codigo_pago },
              data: {
                estado: 'COMPLETADO',
                id_transaccion_externa: result.transactionId?.toString() || clientTransactionId,
                observaciones: `Aprobado | Auth: ${result.authorizationCode} | Card: ${result.cardBrand} ${result.cardType}`,
              },
            });
          }

          // Actualizar cotización
          const cotizacion = await tx.cotizacion.update({
            where: { codigo_cotizacion },
            data: {
              estado: 'PAGADA',
              fecha_confirmacion_pago: new Date(),
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
                  examen: {
                    select: {
                      nombre: true,
                    },
                  },
                },
              },
            },
          });

          return cotizacion;
        });

        this.logger.log(`Pago PayPhone completado para cotización ${codigo_cotizacion}`);

        return {
          success: true,
          message: 'Pago procesado exitosamente',
          cotizacion: cotizacionActualizada,
        };
      } else {
        // Pago fallido o cancelado
        const mensajeError = this.getMensajeError(result.transactionStatus, result.message);

        // Actualizar estados
        await this.prisma.$transaction(async (tx) => {
          if (pagoPendiente) {
            await tx.pago.update({
              where: { codigo_pago: pagoPendiente.codigo_pago },
              data: {
                estado: 'RECHAZADO',
                observaciones: `${result.transactionStatus}: ${result.message || 'Sin mensaje'}`,
              },
            });
          }

          // Regresar cotización a estado pendiente para que pueda reintentar
          await tx.cotizacion.update({
            where: { codigo_cotizacion },
            data: {
              estado: 'PENDIENTE',
              metodo_pago_seleccionado: null,
              fecha_seleccion_pago: null,
            },
          });
        });

        this.logger.warn(`Pago PayPhone fallido para cotización ${codigo_cotizacion}: ${result.transactionStatus}`);

        return {
          success: false,
          message: mensajeError,
        };
      }
    } catch (error) {
      this.logger.error(`Error en PayPhone Confirm: ${error.message}`);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Error al verificar el estado del pago. Por favor contacte al laboratorio.',
      );
    }
  }

  /**
   * Cancelar/revertir un pago (si es necesario)
   * @param paymentId ID del pago en PayPhone
   */
  async cancelarPago(paymentId: string): Promise<void> {
    // PayPhone no tiene un endpoint de cancelación directa
    // Los pagos se cancelan automáticamente si no se completan
    this.logger.log(`Solicitud de cancelación para pago ${paymentId}`);
  }

  /**
   * Obtener mensaje de error amigable
   */
  private getMensajeError(status: string, message?: string): string {
    switch (status) {
      case PayPhoneTransactionStatus.DECLINED:
        return 'El pago fue rechazado por el banco. Por favor verifique los datos de su tarjeta o intente con otra.';
      case PayPhoneTransactionStatus.CANCELLED:
        return 'El pago fue cancelado. Puede intentar nuevamente cuando lo desee.';
      case PayPhoneTransactionStatus.ERROR:
        return `Error en el procesamiento del pago: ${message || 'Error desconocido'}`;
      case PayPhoneTransactionStatus.PENDING:
        return 'El pago está pendiente de confirmación. Por favor espere unos minutos.';
      default:
        return `Estado del pago: ${status}. ${message || ''}`;
    }
  }

  /**
   * Verificar estado de un pago (para consultas manuales)
   */
  async verificarEstadoPago(clientTransactionId: string): Promise<any> {
    // Buscar en nuestra base de datos
    const pago = await this.prisma.pago.findFirst({
      where: {
        id_transaccion_externa: clientTransactionId,
        proveedor_pasarela: 'PAYPHONE',
      },
      include: {
        cotizacion: {
          select: {
            numero_cotizacion: true,
            estado: true,
            total: true,
          },
        },
      },
    });

    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }

    return {
      estado: pago.estado,
      numero_pago: pago.numero_pago,
      monto: pago.monto_total,
      cotizacion: pago.cotizacion,
      fecha_pago: pago.fecha_pago,
    };
  }
}
