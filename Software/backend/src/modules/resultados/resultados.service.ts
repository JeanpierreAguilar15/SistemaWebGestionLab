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
import { PdfGeneratorService } from './pdf-generator.service';
import { WhatsAppService } from '../comunicaciones/whatsapp.service';
import { CreateResultadoDto, UpdateResultadoDto, CreateMuestraDto } from './dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ResultadosService {
  private readonly logger = new Logger(ResultadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  // ==================== MUESTRAS ====================

  /**
   * Crear nueva muestra (Admin/Técnico)
   */
  async createMuestra(data: CreateMuestraDto, tomada_por: number) {
    // Verificar que el ID de muestra sea único
    const existe = await this.prisma.muestra.findUnique({
      where: { id_muestra: data.id_muestra },
    });

    if (existe) {
      throw new BadRequestException(
        `Ya existe una muestra con ID ${data.id_muestra}`,
      );
    }

    // Verificar que el paciente existe
    const paciente = await this.prisma.usuario.findUnique({
      where: { codigo_usuario: data.codigo_paciente },
    });

    if (!paciente) {
      throw new NotFoundException('Paciente no encontrado');
    }

    const muestra = await this.prisma.muestra.create({
      data: {
        codigo_paciente: data.codigo_paciente,
        codigo_cita: data.codigo_cita,
        id_muestra: data.id_muestra,
        tipo_muestra: data.tipo_muestra,
        fecha_toma: data.fecha_toma ? new Date(data.fecha_toma) : new Date(),
        observaciones: data.observaciones,
        tomada_por,
        estado: 'RECOLECTADA',
      },
      include: {
        paciente: {
          select: {
            codigo_usuario: true,
            nombres: true,
            apellidos: true,
            cedula: true,
          },
        },
      },
    });

    this.logger.log(
      `Muestra creada: ${muestra.id_muestra} | Paciente: ${data.codigo_paciente} | Tomada por: ${tomada_por}`,
    );

    return muestra;
  }

  /**
   * Obtener muestras con filtros (Admin/Técnico)
   */
  async getMuestras(filters?: {
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
      where.fecha_toma = {};

      if (filters.fecha_desde) {
        where.fecha_toma.gte = new Date(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        where.fecha_toma.lte = new Date(filters.fecha_hasta);
      }
    }

    const muestras = await this.prisma.muestra.findMany({
      where,
      include: {
        paciente: {
          select: {
            codigo_usuario: true,
            nombres: true,
            apellidos: true,
            cedula: true,
          },
        },
        resultados: {
          include: {
            examen: {
              select: {
                codigo_examen: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha_toma: 'desc',
      },
    });

    return muestras;
  }

  // ==================== RESULTADOS ====================

  /**
   * Crear resultado para una muestra (Admin/Técnico)
   */
  async createResultado(data: CreateResultadoDto, procesado_por: number) {
    // Verificar que la muestra existe
    const muestra = await this.prisma.muestra.findUnique({
      where: { codigo_muestra: data.codigo_muestra },
      include: {
        paciente: true,
      },
    });

    if (!muestra) {
      throw new NotFoundException('Muestra no encontrada');
    }

    // Verificar que el examen existe
    const examen = await this.prisma.examen.findUnique({
      where: { codigo_examen: data.codigo_examen },
    });

    if (!examen) {
      throw new NotFoundException('Examen no encontrado');
    }

    // Calcular si está dentro del rango normal
    let dentro_rango_normal: boolean | null = null;
    let nivel: string | null = null;

    if (
      data.valor_numerico !== undefined &&
      data.valor_referencia_min !== undefined &&
      data.valor_referencia_max !== undefined
    ) {
      const valor = Number(data.valor_numerico);
      const min = Number(data.valor_referencia_min);
      const max = Number(data.valor_referencia_max);

      dentro_rango_normal = valor >= min && valor <= max;

      if (valor < min) {
        nivel = 'BAJO';
      } else if (valor > max) {
        nivel = 'ALTO';
      } else {
        nivel = 'NORMAL';
      }

      // Si está muy fuera del rango, marcar como crítico
      if (valor < min * 0.5 || valor > max * 1.5) {
        nivel = 'CRITICO';
      }
    }

    const resultado = await this.prisma.resultado.create({
      data: {
        codigo_muestra: data.codigo_muestra,
        codigo_examen: data.codigo_examen,
        valor_numerico: data.valor_numerico,
        valor_texto: data.valor_texto,
        unidad_medida: data.unidad_medida,
        valor_referencia_min: data.valor_referencia_min,
        valor_referencia_max: data.valor_referencia_max,
        valores_referencia_texto: data.valores_referencia_texto,
        observaciones_tecnicas: data.observaciones_tecnicas,
        dentro_rango_normal,
        nivel,
        procesado_por,
        estado: 'EN_PROCESO',
      },
      include: {
        muestra: {
          include: {
            paciente: {
              select: {
                codigo_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
          },
        },
        examen: true,
      },
    });

    this.logger.log(
      `Resultado creado: ${resultado.codigo_resultado} | Muestra: ${data.codigo_muestra} | Procesado por: ${procesado_por}`,
    );

    return resultado;
  }

  /**
   * Validar resultado y generar PDF (Admin/Técnico)
   * IMPORTANTE: Requiere que el pago esté confirmado (PAGADA)
   */
  async validarResultado(codigo_resultado: number, validado_por: number) {
    const resultado = await this.prisma.resultado.findUnique({
      where: { codigo_resultado },
      include: {
        muestra: {
          include: {
            paciente: true,
            cita: {
              include: {
                cotizacion: true,
              },
            },
          },
        },
        examen: true,
      },
    });

    if (!resultado) {
      throw new NotFoundException('Resultado no encontrado');
    }

    // VALIDACIÓN DE PAGO CONFIRMADO
    // Los resultados solo se pueden validar si el pago está confirmado
    if (resultado.muestra.cita?.cotizacion) {
      const cotizacion = resultado.muestra.cita.cotizacion;

      if (cotizacion.estado !== 'PAGADA') {
        throw new BadRequestException(
          `No se puede validar el resultado sin pago confirmado. ` +
          `Estado de cotización: ${cotizacion.estado}. ` +
          (cotizacion.estado === 'PENDIENTE_PAGO_VENTANILLA'
            ? 'El paciente debe pagar en ventanilla antes de entregar resultados.'
            : 'El paciente debe completar el pago primero.'),
        );
      }

      this.logger.log(
        `Pago verificado para resultado ${codigo_resultado} | Cotización: ${cotizacion.numero_cotizacion} | Estado: PAGADA`,
      );
    }

    // Generar código de verificación único
    const codigo_verificacion = this.generarCodigoVerificacion();

    // Generar PDF
    let url_pdf: string | null = null;
    try {
      const pdfPath = await this.pdfGenerator.generateResultadoPdf({
        resultado,
        paciente: resultado.muestra.paciente,
        examen: resultado.examen,
        codigo_verificacion,
      });

      // Convertir path absoluto a URL relativa
      url_pdf = `/uploads/resultados/${pdfPath.split('/').pop()}`;
    } catch (error) {
      this.logger.error(
        `Error generando PDF para resultado ${codigo_resultado}: ${error.message}`,
      );
      // Continuar sin PDF si falla
    }

    // Actualizar resultado
    const resultadoValidado = await this.prisma.resultado.update({
      where: { codigo_resultado },
      data: {
        estado: 'LISTO',
        validado_por,
        fecha_validacion: new Date(),
        codigo_verificacion,
        url_pdf,
      },
      include: {
        muestra: {
          include: {
            paciente: {
              select: {
                codigo_usuario: true,
                nombres: true,
                apellidos: true,
                email: true,
              },
            },
          },
        },
        examen: {
          select: {
            nombre: true,
          },
        },
      },
    });

    this.logger.log(
      `Resultado validado: ${codigo_resultado} | Validado por: ${validado_por}`,
    );

    // NOTA: El consumo de insumos se realiza al completar la cita (toma de muestra)
    // en agenda.service.ts -> descontarInsumosMultiplesExamenes()
    // No duplicar el descuento aquí

    // Notificar al paciente vía WebSocket
    this.eventsGateway.notifyResultUpdate({
      resultId: codigo_resultado,
      patientId: resultado.muestra.codigo_paciente,
      examName: resultado.examen.nombre,
      status: 'ready',
    });

    // Notificar a admins
    this.eventsGateway.notifyAdminEvent({
      eventType: 'resultados.resultado.validado',
      entityType: 'resultado',
      entityId: codigo_resultado,
      action: 'validated',
      userId: validado_por,
      data: {
        paciente: `${resultado.muestra.paciente.nombres} ${resultado.muestra.paciente.apellidos}`,
        examen: resultado.examen.nombre,
      },
    });

    // === NOTIFICACIÓN WHATSAPP AL PACIENTE ===
    try {
      await this.enviarNotificacionWhatsApp(
        resultado.muestra.codigo_paciente,
        resultado.muestra.paciente.telefono,
        resultado.muestra.paciente.nombres,
        resultado.examen.nombre,
        codigo_verificacion,
      );
    } catch (error) {
      // No fallar la validación por errores de WhatsApp
      this.logger.warn(
        `Error enviando WhatsApp para resultado ${codigo_resultado}: ${error.message}`,
      );
    }

    return resultadoValidado;
  }

  /**
   * Subir PDF de resultado manualmente (para resultados procesados externamente)
   */
  async uploadPdfManually(
    codigo_resultado: number,
    filename: string,
    validado_por: number,
  ) {
    // Verificar que el resultado existe
    const resultado = await this.prisma.resultado.findUnique({
      where: { codigo_resultado },
      include: {
        muestra: {
          include: {
            paciente: {
              select: {
                codigo_usuario: true,
                nombres: true,
                apellidos: true,
                email: true,
              },
            },
          },
        },
        examen: true,
      },
    });

    if (!resultado) {
      throw new NotFoundException('Resultado no encontrado');
    }

    // Generar código de verificación si no existe
    let codigo_verificacion = resultado.codigo_verificacion;
    if (!codigo_verificacion) {
      codigo_verificacion = this.generarCodigoVerificacion();
    }

    // Construir URL relativa del PDF
    const url_pdf = `/uploads/resultados/${filename}`;

    // Actualizar resultado con el PDF subido y marcarlo como validado
    const resultadoActualizado = await this.prisma.resultado.update({
      where: { codigo_resultado },
      data: {
        estado: 'LISTO',
        validado_por,
        fecha_validacion: new Date(),
        codigo_verificacion,
        url_pdf,
      },
      include: {
        muestra: {
          include: {
            paciente: {
              select: {
                codigo_usuario: true,
                nombres: true,
                apellidos: true,
                email: true,
              },
            },
          },
        },
        examen: true,
      },
    });

    this.logger.log(
      `PDF subido manualmente para resultado ${codigo_resultado} por usuario ${validado_por}`,
    );

    // TODO: Implementar notificación WebSocket cuando se complete el EventsGateway
    // this.eventsGateway.notifyUser(resultado.muestra.codigo_paciente, {
    //   eventType: 'resultados.resultado.listo',
    //   title: 'Resultado disponible',
    //   message: `Tu resultado de ${resultado.examen.nombre} ya está disponible para descargar`,
    //   data: {
    //     codigo_resultado,
    //     codigo_verificacion,
    //   },
    //   status: 'ready',
    // });

    // Notificar a admins
    this.eventsGateway.notifyAdminEvent({
      eventType: 'resultados.resultado.uploaded',
      entityType: 'resultado',
      entityId: codigo_resultado,
      action: 'pdf_uploaded',
      userId: validado_por,
      data: {
        paciente: `${resultado.muestra.paciente.nombres} ${resultado.muestra.paciente.apellidos}`,
        examen: resultado.examen.nombre,
        filename,
      },
    });

    return resultadoActualizado;
  }

  /**
   * Obtener resultados del paciente autenticado
   */
  async getMyResultados(codigo_paciente: number) {
    const resultados = await this.prisma.resultado.findMany({
      where: {
        muestra: {
          codigo_paciente,
        },
        estado: {
          in: ['LISTO', 'VALIDADO', 'ENTREGADO'],
        },
      },
      include: {
        examen: {
          select: {
            codigo_examen: true,
            nombre: true,
            codigo_interno: true,
          },
        },
        muestra: {
          select: {
            codigo_muestra: true,
            id_muestra: true,
            fecha_toma: true,
            tipo_muestra: true,
          },
        },
      },
      orderBy: {
        fecha_resultado: 'desc',
      },
    });

    return resultados;
  }

  /**
   * Descargar PDF de resultado (Paciente)
   */
  async downloadResultado(codigo_resultado: number, codigo_paciente: number) {
    const resultado = await this.prisma.resultado.findUnique({
      where: { codigo_resultado },
      include: {
        muestra: true,
      },
    });

    if (!resultado) {
      throw new NotFoundException('Resultado no encontrado');
    }

    // Verificar que el resultado pertenece al paciente
    if (resultado.muestra.codigo_paciente !== codigo_paciente) {
      throw new NotFoundException('Resultado no encontrado');
    }

    // Verificar que el resultado está listo
    if (!['LISTO', 'VALIDADO', 'ENTREGADO'].includes(resultado.estado)) {
      throw new BadRequestException('El resultado aún no está disponible');
    }

    if (!resultado.url_pdf) {
      throw new NotFoundException('PDF no disponible');
    }

    // Registrar descarga
    await this.prisma.descargaResultado.create({
      data: {
        codigo_resultado,
        codigo_usuario: codigo_paciente,
        fecha_descarga: new Date(),
      },
    });

    // Actualizar estado a ENTREGADO automáticamente al descargar
    // Solo si no está ya entregado (LISTO o VALIDADO → ENTREGADO)
    if (resultado.estado !== 'ENTREGADO') {
      await this.prisma.resultado.update({
        where: { codigo_resultado },
        data: { estado: 'ENTREGADO' },
      });

      this.logger.log(
        `Estado actualizado a ENTREGADO automáticamente | Resultado: ${codigo_resultado}`,
      );
    }

    this.logger.log(
      `Resultado descargado: ${codigo_resultado} | Paciente: ${codigo_paciente}`,
    );

    return resultado.url_pdf;
  }

  /**
   * Obtener todos los resultados (Admin)
   */
  async getAllResultados(filters?: {
    codigo_resultado?: number;
    codigo_paciente?: number;
    codigo_examen?: number;
    estado?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  }) {
    const where: any = {};

    if (filters?.codigo_resultado) {
      where.codigo_resultado = filters.codigo_resultado;
    }

    if (filters?.estado) {
      where.estado = filters.estado;
    }

    if (filters?.codigo_examen) {
      where.codigo_examen = filters.codigo_examen;
    }

    if (filters?.codigo_paciente) {
      where.muestra = {
        codigo_paciente: filters.codigo_paciente,
      };
    }

    if (filters?.fecha_desde || filters?.fecha_hasta) {
      where.fecha_resultado = {};

      if (filters.fecha_desde) {
        where.fecha_resultado.gte = new Date(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        where.fecha_resultado.lte = new Date(filters.fecha_hasta);
      }
    }

    const resultados = await this.prisma.resultado.findMany({
      where,
      include: {
        examen: {
          select: {
            codigo_examen: true,
            nombre: true,
            codigo_interno: true,
          },
        },
        muestra: {
          select: {
            codigo_muestra: true,
            id_muestra: true,
            tipo_muestra: true,
            paciente: {
              select: {
                codigo_usuario: true,
                nombres: true,
                apellidos: true,
                cedula: true,
              },
            },
          },
        },
        procesador: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        validador: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: {
        fecha_resultado: 'desc',
      },
    });

    return resultados;
  }

  /**
   * Actualizar estado de resultado (Admin)
   */
  async updateResultado(
    codigo_resultado: number,
    data: UpdateResultadoDto,
    adminId: number,
  ) {
    const resultado = await this.prisma.resultado.findUnique({
      where: { codigo_resultado },
      include: {
        muestra: {
          include: {
            paciente: true,
          },
        },
        examen: true,
      },
    });

    if (!resultado) {
      throw new NotFoundException('Resultado no encontrado');
    }

    const updated = await this.prisma.resultado.update({
      where: { codigo_resultado },
      data: {
        estado: data.estado,
        observaciones_tecnicas: data.observaciones_tecnicas,
      },
      include: {
        muestra: {
          include: {
            paciente: {
              select: {
                codigo_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
          },
        },
        examen: true,
      },
    });

    this.logger.log(
      `Resultado actualizado: ${codigo_resultado} | Admin: ${adminId}`,
    );

    // Si se marca como LISTO, notificar al paciente
    if (data.estado === 'LISTO') {
      this.eventsGateway.notifyResultUpdate({
        resultId: codigo_resultado,
        patientId: resultado.muestra.codigo_paciente,
        examName: resultado.examen.nombre,
        status: 'ready',
      });
    }

    return updated;
  }

  /**
   * Obtener estadísticas de resultados (Admin)
   */
  async getEstadisticas(filters?: {
    fecha_desde?: string;
    fecha_hasta?: string;
  }) {
    const where: any = {};

    if (filters?.fecha_desde || filters?.fecha_hasta) {
      where.fecha_resultado = {};

      if (filters.fecha_desde) {
        where.fecha_resultado.gte = new Date(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        where.fecha_resultado.lte = new Date(filters.fecha_hasta);
      }
    }

    const [
      total,
      enProceso,
      listos,
      validados,
      entregados,
      fuera_rango,
      criticos,
    ] = await Promise.all([
      this.prisma.resultado.count({ where }),
      this.prisma.resultado.count({ where: { ...where, estado: 'EN_PROCESO' } }),
      this.prisma.resultado.count({ where: { ...where, estado: 'LISTO' } }),
      this.prisma.resultado.count({ where: { ...where, estado: 'VALIDADO' } }),
      this.prisma.resultado.count({ where: { ...where, estado: 'ENTREGADO' } }),
      this.prisma.resultado.count({
        where: { ...where, dentro_rango_normal: false },
      }),
      this.prisma.resultado.count({ where: { ...where, nivel: 'CRITICO' } }),
    ]);

    return {
      total,
      en_proceso: enProceso,
      listos,
      validados,
      entregados,
      fuera_rango_normal: fuera_rango,
      criticos,
    };
  }

  /**
   * Generar código de verificación único
   */
  private generarCodigoVerificacion(): string {
    const uuid = randomUUID();
    return `VER-${uuid.substring(0, 8).toUpperCase()}`;
  }

  /**
   * Enviar notificación WhatsApp al paciente cuando su resultado está listo
   * Verifica el consentimiento del usuario antes de enviar
   */
  private async enviarNotificacionWhatsApp(
    codigo_paciente: number,
    telefono: string | null,
    nombre_paciente: string,
    nombre_examen: string,
    codigo_verificacion: string,
  ): Promise<void> {
    // Verificar que el servicio de WhatsApp esté configurado
    if (!this.whatsappService.isConfigured()) {
      this.logger.debug('WhatsApp no configurado, omitiendo notificación');
      return;
    }

    // Verificar que el paciente tenga teléfono registrado
    if (!telefono) {
      this.logger.debug(
        `Paciente ${codigo_paciente} no tiene teléfono registrado, omitiendo notificación WhatsApp`,
      );
      return;
    }

    // Verificar consentimiento del usuario para notificaciones WhatsApp
    const consentimiento = await this.prisma.consentimiento.findFirst({
      where: {
        codigo_usuario: codigo_paciente,
        tipo_consentimiento: 'NOTIFICACIONES_WHATSAPP',
      },
      orderBy: {
        fecha_consentimiento: 'desc',
      },
    });

    // Si no hay consentimiento o está rechazado, no enviar
    if (!consentimiento || !consentimiento.aceptado) {
      this.logger.debug(
        `Paciente ${codigo_paciente} no tiene consentimiento para WhatsApp, omitiendo notificación`,
      );
      return;
    }

    // Formatear mensaje
    const mensaje = this.formatearMensajeResultadoListo(
      nombre_paciente,
      nombre_examen,
      codigo_verificacion,
    );

    // Enviar mensaje
    const result = await this.whatsappService.sendMessage({
      to: telefono,
      message: mensaje,
      tipo: 'GENERAL',
    });

    if (result.success) {
      this.logger.log(
        `Notificación WhatsApp enviada a paciente ${codigo_paciente} para resultado de ${nombre_examen}`,
      );
    } else {
      this.logger.warn(
        `Error enviando WhatsApp a paciente ${codigo_paciente}: ${result.error}`,
      );
    }
  }

  /**
   * Formatear mensaje de resultado listo para WhatsApp
   */
  private formatearMensajeResultadoListo(
    nombre_paciente: string,
    nombre_examen: string,
    codigo_verificacion: string,
  ): string {
    let mensaje = `🏥 *LABORATORIO CLÍNICO FRANZ*\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    mensaje += `¡Hola ${nombre_paciente}! 👋\n\n`;
    mensaje += `✅ Tu resultado de *${nombre_examen}* ya está disponible.\n\n`;
    mensaje += `📋 Código de verificación:\n`;
    mensaje += `*${codigo_verificacion}*\n\n`;
    mensaje += `📱 Puedes descargarlo desde:\n`;
    mensaje += `Portal del Paciente > Mis Resultados\n\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `_Este mensaje es automático. Por favor no responder._`;

    return mensaje;
  }
}
