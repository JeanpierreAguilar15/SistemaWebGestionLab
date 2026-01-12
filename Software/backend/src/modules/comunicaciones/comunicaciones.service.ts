import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ComunicacionesService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(ComunicacionesService.name);

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });
      this.logger.log('SMTP Transporter initialized');
    } else {
      this.logger.warn(
        'SMTP credentials not found. Email sending will be disabled or logged only.',
      );
    }
  }

  async sendWelcomeEmail(user: { email: string; nombres: string }) {
    if (!this.transporter) {
      this.logger.warn(`[MOCK EMAIL] Welcome email to ${user.email}`);
      return;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0070f3;">Laboratorio Clínico Franz</h1>
        </div>
        <h2 style="color: #333;">¡Bienvenido, ${user.nombres}!</h2>
        <p style="color: #555; line-height: 1.6;">
          Gracias por registrarte en nuestro portal de pacientes. Ahora podrás agendar citas, ver tus resultados y gestionar tus cotizaciones en línea.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.configService.get('FRONTEND_URL')}/login" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Iniciar Sesión
          </a>
        </div>
        <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
          Si no creaste esta cuenta, por favor ignora este correo.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: '"Laboratorio Franz" <' + this.configService.get('SMTP_USER') + '>',
        to: user.email,
        subject: 'Bienvenido a Laboratorio Franz',
        html,
      });
      this.logger.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Error sending welcome email to ${user.email}`, error);
    }
  }

  /**
   * Enviar email de recuperación de contraseña con código corto de 6 dígitos
   * Plantilla profesional con diseño moderno
   */
  async sendPasswordRecoveryEmail(
    user: { email: string; nombres: string },
    code: string,
    expiresInMinutes: number = 15,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/auth/reset-password?code=${code}&email=${encodeURIComponent(user.email)}`;

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f7fa; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                      🔬 Laboratorio Clínico Franz
                    </h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">
                      Tu salud, nuestra prioridad
                    </p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 24px; text-align: center;">
                      🔐 Recuperación de Contraseña
                    </h2>

                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                      Hola <strong>${user.nombres}</strong>,
                    </p>

                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                      Recibimos una solicitud para restablecer la contraseña de tu cuenta.
                      Usa el siguiente código de verificación:
                    </p>

                    <!-- Código de verificación -->
                    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px dashed #0ea5e9; border-radius: 12px; padding: 25px; text-align: center; margin: 0 0 30px;">
                      <p style="color: #64748b; font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">
                        Tu código de verificación
                      </p>
                      <p style="color: #0369a1; font-size: 42px; font-weight: 800; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                        ${code}
                      </p>
                      <p style="color: #94a3b8; font-size: 13px; margin: 15px 0 0;">
                        ⏱️ Válido por ${expiresInMinutes} minutos
                      </p>
                    </div>

                    <!-- Botón alternativo -->
                    <p style="color: #475569; font-size: 14px; text-align: center; margin: 0 0 20px;">
                      O haz clic en el botón para restablecer directamente:
                    </p>

                    <div style="text-align: center; margin: 0 0 30px;">
                      <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                        Restablecer Contraseña →
                      </a>
                    </div>

                    <!-- Alerta de seguridad -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 15px 20px; margin: 0 0 25px;">
                      <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                        <strong>⚠️ Importante:</strong> Si no solicitaste este cambio, ignora este correo.
                        Tu contraseña permanecerá sin cambios.
                      </p>
                    </div>

                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">
                      Por tu seguridad, este código expirará en <strong>${expiresInMinutes} minutos</strong>
                      y solo puede usarse una vez.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="text-align: center;">
                          <p style="color: #64748b; font-size: 13px; margin: 0 0 10px;">
                            📍 Av. Principal 123, Quito - Ecuador
                          </p>
                          <p style="color: #64748b; font-size: 13px; margin: 0 0 10px;">
                            📞 (02) 1234-5678 | ✉️ info@labfranz.com
                          </p>
                          <p style="color: #94a3b8; font-size: 12px; margin: 15px 0 0;">
                            © ${new Date().getFullYear()} Laboratorio Clínico Franz. Todos los derechos reservados.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (!this.transporter) {
      this.logger.warn(`[MOCK EMAIL] Recovery code ${code} to ${user.email}`);
      this.logger.debug(`Reset link: ${resetLink}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: '"Laboratorio Franz" <' + this.configService.get('SMTP_USER') + '>',
        to: user.email,
        subject: `🔐 Código de Verificación: ${code} - Laboratorio Franz`,
        html,
      });
      this.logger.log(`Recovery email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Error sending recovery email to ${user.email}`, error);
    }
  }

  /**
   * Generar código de verificación de 6 dígitos
   */
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Enviar email de confirmación de cita
   */
  async sendAppointmentConfirmationEmail(
    user: { email: string; nombres: string },
    appointment: {
      fecha: string;
      hora: string;
      servicio: string;
      sede: string;
    },
  ) {
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f7fa; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                      ✅ Cita Confirmada
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                      Hola <strong>${user.nombres}</strong>,
                    </p>

                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                      Tu cita ha sido confirmada exitosamente. Aquí están los detalles:
                    </p>

                    <!-- Detalles de la cita -->
                    <div style="background-color: #f0fdf4; border-radius: 12px; padding: 25px; margin: 0 0 30px;">
                      <table width="100%" cellpadding="8" cellspacing="0">
                        <tr>
                          <td style="color: #64748b; font-size: 14px; width: 40%;">📅 Fecha:</td>
                          <td style="color: #1e293b; font-size: 16px; font-weight: 600;">${appointment.fecha}</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b; font-size: 14px;">🕐 Hora:</td>
                          <td style="color: #1e293b; font-size: 16px; font-weight: 600;">${appointment.hora}</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b; font-size: 14px;">🔬 Servicio:</td>
                          <td style="color: #1e293b; font-size: 16px; font-weight: 600;">${appointment.servicio}</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b; font-size: 14px;">📍 Sede:</td>
                          <td style="color: #1e293b; font-size: 16px; font-weight: 600;">${appointment.sede}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">
                      Recuerda llegar 10 minutos antes de tu cita y traer tu documento de identidad.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="color: #64748b; font-size: 13px; margin: 0;">
                      📞 (02) 1234-5678 | ✉️ info@labfranz.com
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (!this.transporter) {
      this.logger.warn(`[MOCK EMAIL] Appointment confirmation to ${user.email}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: '"Laboratorio Franz" <' + this.configService.get('SMTP_USER') + '>',
        to: user.email,
        subject: `✅ Cita Confirmada - ${appointment.fecha} ${appointment.hora} - Laboratorio Franz`,
        html,
      });
      this.logger.log(`Appointment confirmation email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Error sending appointment confirmation to ${user.email}`, error);
    }
  }
}
