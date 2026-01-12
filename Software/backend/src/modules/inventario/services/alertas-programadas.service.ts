import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@prisma/prisma.service';
import { WhatsAppService } from '../../comunicaciones/whatsapp.service';

@Injectable()
export class AlertasProgramadasService implements OnModuleInit {
  private readonly logger = new Logger(AlertasProgramadasService.name);

  constructor(
    private prisma: PrismaService,
    private whatsAppService: WhatsAppService,
  ) {}

  async onModuleInit() {
    this.logger.log('Servicio de alertas programadas iniciado');
    // Verificar configuración de WhatsApp
    const config = this.whatsAppService.getConfig();
    if (config.configured) {
      this.logger.log(`WhatsApp configurado. Notificaciones irán a: ${config.defaultRecipient}`);
    } else {
      this.logger.warn('WhatsApp NO configurado. Configure TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN');
    }
  }

  /**
   * Verifica stock bajo y critico todos los dias a las 8:00 AM
   * Solo se envia UNA notificacion al dia con todos los items que necesitan atencion
   */
  @Cron('0 8 * * *') // 8:00 AM todos los dias
  async verificarStockDiario() {
    this.logger.log('Ejecutando verificacion diaria de stock...');
    await this.enviarAlertasStockBajo();
  }

  /**
   * Verifica vencimientos todos los lunes a las 9:00 AM
   */
  @Cron('0 9 * * 1') // 9:00 AM cada lunes
  async verificarVencimientosSemanal() {
    this.logger.log('Ejecutando verificacion semanal de vencimientos...');
    await this.enviarAlertasVencimiento();
  }

  /**
   * Verifica items sin movimientos todos los lunes a las 10:00 AM
   */
  @Cron('0 10 * * 1') // 10:00 AM cada lunes
  async verificarItemsSinMovimientos() {
    this.logger.log('Ejecutando verificacion semanal de items sin movimientos...');
    await this.enviarAlertasSinMovimientos();
  }

  // NOTA: Se elimino el cron de cada 4 horas para evitar multiples notificaciones
  // Ahora todas las alertas de stock (bajo y critico) se envian solo 1 vez al dia a las 8:00 AM

  /**
   * Envía alertas de stock bajo (stock_actual <= stock_minimo)
   */
  async enviarAlertasStockBajo(): Promise<{ success: boolean; enviados: number }> {
    try {
      // Obtener items con stock bajo
      const itemsStockBajo = await this.prisma.item.findMany({
        where: {
          activo: true,
          stock_actual: {
            lte: this.prisma.item.fields?.stock_minimo as any,
          },
        },
        select: {
          nombre: true,
          stock_actual: true,
          stock_minimo: true,
        },
      });

      // Filtrar en memoria ya que Prisma no permite comparar campos directamente
      const itemsConStockBajo = await this.prisma.$queryRaw<Array<{
        nombre: string;
        stock_actual: number;
        stock_minimo: number;
      }>>`
        SELECT nombre, stock_actual, stock_minimo
        FROM inventario.item
        WHERE activo = true AND stock_actual <= stock_minimo
        ORDER BY stock_actual ASC
      `;

      if (itemsConStockBajo.length === 0) {
        this.logger.log('No hay items con stock bajo');
        return { success: true, enviados: 0 };
      }

      this.logger.log(`Encontrados ${itemsConStockBajo.length} items con stock bajo`);

      // Enviar alerta por WhatsApp
      const resultado = await this.whatsAppService.enviarAlertaStockBajo(itemsConStockBajo);

      if (resultado.success) {
        this.logger.log('Alerta de stock bajo enviada exitosamente');
      } else {
        this.logger.error(`Error enviando alerta: ${'error' in resultado ? resultado.error : 'desconocido'}`);
      }

      return { success: resultado.success, enviados: resultado.success ? 1 : 0 };
    } catch (error) {
      this.logger.error(`Error en verificación de stock bajo: ${error.message}`);
      return { success: false, enviados: 0 };
    }
  }

  /**
   * Envía alertas de stock crítico (agotado o muy bajo)
   */
  async enviarAlertasStockCritico(): Promise<{ success: boolean; enviados: number }> {
    try {
      // Solo items agotados o con menos del 20% del mínimo
      const itemsCriticos = await this.prisma.$queryRaw<Array<{
        nombre: string;
        stock_actual: number;
        stock_minimo: number;
      }>>`
        SELECT nombre, stock_actual, stock_minimo
        FROM inventario.item
        WHERE activo = true
          AND (stock_actual = 0 OR stock_actual < stock_minimo * 0.2)
        ORDER BY stock_actual ASC
      `;

      if (itemsCriticos.length === 0) {
        return { success: true, enviados: 0 };
      }

      this.logger.warn(`¡ALERTA CRÍTICA! ${itemsCriticos.length} items en estado crítico`);

      const resultado = await this.whatsAppService.enviarAlertaStockBajo(itemsCriticos);
      return { success: resultado.success, enviados: resultado.success ? 1 : 0 };
    } catch (error) {
      this.logger.error(`Error en verificación crítica: ${error.message}`);
      return { success: false, enviados: 0 };
    }
  }

  /**
   * Envía alertas de productos próximos a vencer
   */
  async enviarAlertasVencimiento(): Promise<{ success: boolean; enviados: number }> {
    try {
      const hoy = new Date();
      const en30Dias = new Date();
      en30Dias.setDate(en30Dias.getDate() + 30);

      // Obtener lotes próximos a vencer en los próximos 30 días
      const lotesProximosVencer = await this.prisma.lote.findMany({
        where: {
          fecha_vencimiento: {
            lte: en30Dias,
            gte: hoy,
          },
          cantidad_actual: {
            gt: 0,
          },
        },
        include: {
          item: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: {
          fecha_vencimiento: 'asc',
        },
      });

      // Incluir lotes ya vencidos con stock
      const lotesVencidos = await this.prisma.lote.findMany({
        where: {
          fecha_vencimiento: {
            lt: hoy,
          },
          cantidad_actual: {
            gt: 0,
          },
        },
        include: {
          item: {
            select: {
              nombre: true,
            },
          },
        },
      });

      const todosLotes = [...lotesVencidos, ...lotesProximosVencer];

      if (todosLotes.length === 0) {
        this.logger.log('No hay lotes próximos a vencer');
        return { success: true, enviados: 0 };
      }

      // Formatear datos para el servicio de WhatsApp
      const lotesFormateados = todosLotes.map(lote => ({
        item_nombre: lote.item.nombre,
        numero_lote: lote.numero_lote,
        fecha_vencimiento: lote.fecha_vencimiento,
        dias_restantes: Math.ceil(
          (new Date(lote.fecha_vencimiento).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));

      this.logger.log(`Encontrados ${lotesFormateados.length} lotes próximos a vencer o vencidos`);

      const resultado = await this.whatsAppService.enviarAlertaVencimiento(lotesFormateados);
      return { success: resultado.success, enviados: resultado.success ? 1 : 0 };
    } catch (error) {
      this.logger.error(`Error en verificación de vencimientos: ${error.message}`);
      return { success: false, enviados: 0 };
    }
  }

  /**
   * Envía alertas de ítems sin movimientos en los últimos n días
   */
  async enviarAlertasSinMovimientos(dias: number = 30): Promise<{ success: boolean; enviados: number }> {
    try {
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - dias);

      // Obtener ítems sin movimientos recientes usando raw query
      const itemsSinMovimiento = await this.prisma.$queryRaw<Array<{
        codigo_item: number;
        nombre: string;
        stock_actual: number;
        ultimo_movimiento: Date | null;
        dias_sin_movimiento: number | null;
      }>>`
        SELECT
          i.codigo_item,
          i.nombre,
          i.stock_actual,
          MAX(m.fecha_movimiento) as ultimo_movimiento,
          CASE
            WHEN MAX(m.fecha_movimiento) IS NULL THEN NULL
            ELSE EXTRACT(DAY FROM NOW() - MAX(m.fecha_movimiento))
          END as dias_sin_movimiento
        FROM inventario.item i
        LEFT JOIN inventario.movimiento m ON i.codigo_item = m.codigo_item
        WHERE i.activo = true
        GROUP BY i.codigo_item, i.nombre, i.stock_actual
        HAVING MAX(m.fecha_movimiento) IS NULL
           OR MAX(m.fecha_movimiento) < ${fechaLimite}
        ORDER BY MAX(m.fecha_movimiento) ASC NULLS FIRST
      `;

      if (itemsSinMovimiento.length === 0) {
        this.logger.log('No hay ítems sin movimientos recientes');
        return { success: true, enviados: 0 };
      }

      this.logger.log(`Encontrados ${itemsSinMovimiento.length} ítems sin movimientos en ${dias} días`);

      // Formatear mensaje
      const mensaje = this.formatearMensajeSinMovimientos(itemsSinMovimiento, dias);

      // Enviar por WhatsApp
      const resultado = await this.whatsAppService.sendMessage({
        to: '',
        message: mensaje,
        tipo: 'ALERTA_STOCK',
      });

      return { success: resultado.success, enviados: resultado.success ? 1 : 0 };
    } catch (error) {
      this.logger.error(`Error verificando ítems sin movimientos: ${error.message}`);
      return { success: false, enviados: 0 };
    }
  }

  /**
   * Formatea el mensaje de alertas de ítems sin movimientos
   */
  private formatearMensajeSinMovimientos(
    items: Array<{ nombre: string; stock_actual: number; dias_sin_movimiento: number | null }>,
    dias: number
  ): string {
    let mensaje = `*ALERTA: ITEMS SIN MOVIMIENTOS*\n`;
    mensaje += `Periodo analizado: ${dias} dias\n`;
    mensaje += `Total items: ${items.length}\n\n`;

    const itemsConMov = items.filter(i => i.dias_sin_movimiento !== null);
    const itemsSinMov = items.filter(i => i.dias_sin_movimiento === null);

    if (itemsSinMov.length > 0) {
      mensaje += `*Nunca han tenido movimientos:*\n`;
      itemsSinMov.slice(0, 5).forEach(item => {
        mensaje += `  - ${item.nombre} (Stock: ${item.stock_actual})\n`;
      });
      if (itemsSinMov.length > 5) {
        mensaje += `  ... y ${itemsSinMov.length - 5} mas\n`;
      }
      mensaje += `\n`;
    }

    if (itemsConMov.length > 0) {
      mensaje += `*Sin movimientos recientes:*\n`;
      itemsConMov.slice(0, 5).forEach(item => {
        mensaje += `  - ${item.nombre} (${item.dias_sin_movimiento} dias)\n`;
      });
      if (itemsConMov.length > 5) {
        mensaje += `  ... y ${itemsConMov.length - 5} mas\n`;
      }
    }

    mensaje += `\nRevise estos items para evaluar rotacion o ajuste de inventario.`;

    return mensaje;
  }

  /**
   * Fuerza el envío de alertas (para testing o llamada manual)
   */
  async forzarEnvioAlertas(): Promise<{
    stock_bajo: { success: boolean; enviados: number };
    vencimientos: { success: boolean; enviados: number };
    sin_movimientos: { success: boolean; enviados: number };
  }> {
    this.logger.log('Forzando envío de todas las alertas...');

    const [stockBajo, vencimientos, sinMovimientos] = await Promise.all([
      this.enviarAlertasStockBajo(),
      this.enviarAlertasVencimiento(),
      this.enviarAlertasSinMovimientos(),
    ]);

    return {
      stock_bajo: stockBajo,
      vencimientos,
      sin_movimientos: sinMovimientos,
    };
  }
}
