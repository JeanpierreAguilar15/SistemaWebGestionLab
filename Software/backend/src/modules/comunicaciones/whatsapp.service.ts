import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@prisma/prisma.service';

export interface WhatsAppMessage {
  to: string;
  message: string;
  tipo?: 'ALERTA_STOCK' | 'ALERTA_VENCIMIENTO' | 'GENERAL';
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly twilioAccountSid: string;
  private readonly twilioAuthToken: string;
  private readonly twilioWhatsAppNumber: string;
  private readonly defaultRecipient: string;
  private readonly apiUrl: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.twilioAccountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
    this.twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
    this.twilioWhatsAppNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+14155238886';
    this.defaultRecipient = this.configService.get<string>('WHATSAPP_DEFAULT_RECIPIENT') || 'whatsapp:+593998673322';
    this.apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;

    if (!this.twilioAccountSid || !this.twilioAuthToken) {
      this.logger.warn('Twilio no está configurado. Las notificaciones WhatsApp no funcionarán.');
      this.logger.warn('Configure TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env');
    }
  }

  /**
   * Verifica si el servicio está configurado
   */
  isConfigured(): boolean {
    return !!(this.twilioAccountSid && this.twilioAuthToken);
  }

  /**
   * Envía un mensaje de WhatsApp
   */
  async sendMessage(data: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      this.logger.warn('Intento de enviar WhatsApp sin configurar Twilio');
      return { success: false, error: 'Twilio no está configurado' };
    }

    try {
      // Formatear número de destino
      let toNumber = data.to || this.defaultRecipient;
      if (!toNumber.startsWith('whatsapp:')) {
        // Agregar código de país Ecuador si no tiene
        if (!toNumber.startsWith('+')) {
          toNumber = '+593' + toNumber.replace(/^0/, '');
        }
        toNumber = `whatsapp:${toNumber}`;
      }

      const body = new URLSearchParams({
        From: this.twilioWhatsAppNumber,
        To: toNumber,
        Body: data.message,
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64'),
        },
        body: body.toString(),
      });

      const result = await response.json();

      if (response.ok) {
        this.logger.log(`WhatsApp enviado a ${toNumber}: ${result.sid}`);

        // Registrar en BD
        await this.registrarNotificacion(toNumber, data.message, data.tipo, true, result.sid);

        return { success: true, messageId: result.sid };
      } else {
        this.logger.error(`Error enviando WhatsApp: ${result.message}`);
        await this.registrarNotificacion(toNumber, data.message, data.tipo, false, null, result.message);
        return { success: false, error: result.message };
      }
    } catch (error) {
      this.logger.error(`Error enviando WhatsApp: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envía alerta de stock bajo
   */
  async enviarAlertaStockBajo(items: Array<{ nombre: string; stock_actual: number; stock_minimo: number }>) {
    if (items.length === 0) return { success: true, message: 'No hay alertas' };

    const mensaje = this.formatearMensajeStockBajo(items);
    return this.sendMessage({
      to: this.defaultRecipient,
      message: mensaje,
      tipo: 'ALERTA_STOCK',
    });
  }

  /**
   * Envía alerta de productos próximos a vencer
   */
  async enviarAlertaVencimiento(lotes: Array<{ item_nombre: string; numero_lote: string; fecha_vencimiento: Date; dias_restantes: number }>) {
    if (lotes.length === 0) return { success: true, message: 'No hay alertas' };

    const mensaje = this.formatearMensajeVencimiento(lotes);
    return this.sendMessage({
      to: this.defaultRecipient,
      message: mensaje,
      tipo: 'ALERTA_VENCIMIENTO',
    });
  }

  /**
   * Formatea mensaje de stock bajo
   */
  private formatearMensajeStockBajo(items: Array<{ nombre: string; stock_actual: number; stock_minimo: number }>): string {
    let mensaje = '*ALERTA DE STOCK BAJO*\n';
    mensaje += '------------------------\n';
    mensaje += `Fecha: ${new Date().toLocaleDateString('es-EC')}\n\n`;

    for (const item of items.slice(0, 10)) { // Maximo 10 items para no exceder limite
      const estado = item.stock_actual === 0 ? '[AGOTADO]' : '[BAJO]';
      mensaje += `${estado} *${item.nombre}*\n`;
      mensaje += `   Stock: ${item.stock_actual} / Min: ${item.stock_minimo}\n\n`;
    }

    if (items.length > 10) {
      mensaje += `\n... y ${items.length - 10} items mas\n`;
    }

    mensaje += '------------------------\n';
    mensaje += 'Sistema de Inventario - Laboratorio';

    return mensaje;
  }

  /**
   * Formatea mensaje de vencimiento
   */
  private formatearMensajeVencimiento(lotes: Array<{ item_nombre: string; numero_lote: string; fecha_vencimiento: Date; dias_restantes: number }>): string {
    let mensaje = '*ALERTA DE VENCIMIENTO*\n';
    mensaje += '------------------------\n';
    mensaje += `Fecha: ${new Date().toLocaleDateString('es-EC')}\n\n`;

    for (const lote of lotes.slice(0, 10)) {
      const estado = lote.dias_restantes <= 0 ? '[VENCIDO]' : lote.dias_restantes <= 7 ? '[CRITICO]' : '[PROXIMO]';
      mensaje += `${estado} *${lote.item_nombre}*\n`;
      mensaje += `   Lote: ${lote.numero_lote}\n`;
      mensaje += `   Vence: ${new Date(lote.fecha_vencimiento).toLocaleDateString('es-EC')}`;
      mensaje += lote.dias_restantes > 0 ? ` (${lote.dias_restantes} dias)\n\n` : ' (VENCIDO)\n\n';
    }

    if (lotes.length > 10) {
      mensaje += `\n... y ${lotes.length - 10} lotes mas\n`;
    }

    mensaje += '------------------------\n';
    mensaje += 'Sistema de Inventario - Laboratorio';

    return mensaje;
  }

  /**
   * Registra la notificación en la base de datos
   */
  private async registrarNotificacion(
    destinatario: string,
    mensaje: string,
    tipo: string,
    exitoso: boolean,
    messageId?: string,
    error?: string,
  ) {
    try {
      // Usar LogActividad para registrar la notificación
      await this.prisma.logActividad.create({
        data: {
          codigo_usuario: null,
          accion: 'NOTIFICACION_WHATSAPP',
          entidad: tipo || 'WHATSAPP',
          descripcion: `WhatsApp ${exitoso ? 'enviado' : 'fallido'} a ${destinatario}: ${mensaje.substring(0, 100)}...`,
          ip_address: messageId || null,
          user_agent: error || null,
          fecha_accion: new Date(),
        },
      });
    } catch (e) {
      this.logger.warn(`Error registrando notificación: ${e.message}`);
    }
  }

  /**
   * Obtiene configuración actual
   */
  getConfig() {
    return {
      configured: this.isConfigured(),
      defaultRecipient: this.defaultRecipient,
      whatsappNumber: this.twilioWhatsAppNumber,
    };
  }
}
