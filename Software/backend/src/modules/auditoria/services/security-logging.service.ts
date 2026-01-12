import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';

/**
 * Motivos de fallo de login
 */
export enum LoginFailReason {
  CREDENCIALES_INVALIDAS = 'CREDENCIALES_INVALIDAS',
  CUENTA_BLOQUEADA = 'CUENTA_BLOQUEADA',
  CUENTA_INACTIVA = 'CUENTA_INACTIVA',
  USUARIO_NO_EXISTE = 'USUARIO_NO_EXISTE',
}

/**
 * Tipos de alertas de seguridad
 */
export enum SecurityAlertType {
  FUERZA_BRUTA = 'FUERZA_BRUTA',
  MULTIPLES_IPS = 'MULTIPLES_IPS',
  CUENTA_BLOQUEADA = 'CUENTA_BLOQUEADA',
  ACCESO_SOSPECHOSO = 'ACCESO_SOSPECHOSO',
}

/**
 * Niveles de alerta
 */
export enum AlertLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

/**
 * Interface para el registro de intento de login
 */
export interface LoginAttemptData {
  identificador: string;
  ipAddress: string;
  userAgent?: string;
  exitoso: boolean;
  motivoFallo?: LoginFailReason;
  codigoUsuario?: number;
}

/**
 * SecurityLoggingService
 *
 * Servicio especializado en:
 * 1. Registrar intentos de login (exitosos y fallidos)
 * 2. Detectar ataques de fuerza bruta
 * 3. Generar alertas de seguridad
 * 4. Notificar en tiempo real a administradores
 *
 * Cumple con los requerimientos de:
 * - Gestión de Logs: Registrar conexiones fallidas
 * - Alerta temprana de ataques de fuerza bruta
 */
@Injectable()
export class SecurityLoggingService {
  private readonly logger = new Logger(SecurityLoggingService.name);

  // Configuración de umbrales para detección de fuerza bruta
  private readonly BRUTE_FORCE_THRESHOLD = 5; // Intentos antes de warning
  private readonly BRUTE_FORCE_CRITICAL = 10; // Intentos antes de critical
  private readonly TIME_WINDOW_MINUTES = 15;  // Ventana de tiempo

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Registra un intento de login (exitoso o fallido)
   * También verifica si es un posible ataque de fuerza bruta
   */
  async logLoginAttempt(data: LoginAttemptData): Promise<void> {
    try {
      // 1. Registrar el intento en la base de datos
      await this.prisma.logIntentoLogin.create({
        data: {
          identificador: data.identificador,
          ip_address: data.ipAddress,
          user_agent: data.userAgent || null,
          exitoso: data.exitoso,
          motivo_fallo: data.motivoFallo || null,
          codigo_usuario: data.codigoUsuario || null,
        },
      });

      this.logger.log(
        `Login attempt logged: ${data.identificador} from ${data.ipAddress} - ${data.exitoso ? 'SUCCESS' : 'FAILED'}`,
      );

      // 2. Si es un intento fallido, verificar fuerza bruta
      if (!data.exitoso) {
        await this.checkBruteForceAttack(data.ipAddress, data.identificador, data.userAgent);
      }

      // 3. Si es exitoso después de varios intentos fallidos, registrar info
      if (data.exitoso) {
        await this.checkSuspiciousSuccessfulLogin(data);
      }
    } catch (error) {
      this.logger.error(`Error logging login attempt: ${error.message}`, error.stack);
    }
  }

  /**
   * Detecta posibles ataques de fuerza bruta
   * Basado en múltiples intentos fallidos desde la misma IP
   */
  private async checkBruteForceAttack(
    ipAddress: string,
    identificador: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const timeWindow = new Date();
      timeWindow.setMinutes(timeWindow.getMinutes() - this.TIME_WINDOW_MINUTES);

      // Contar intentos fallidos recientes desde esta IP
      const failedAttempts = await this.prisma.logIntentoLogin.count({
        where: {
          ip_address: ipAddress,
          exitoso: false,
          fecha_intento: {
            gte: timeWindow,
          },
        },
      });

      // Verificar si ya existe una alerta activa para esta IP
      const existingAlert = await this.prisma.alertaSeguridad.findFirst({
        where: {
          ip_address: ipAddress,
          tipo_alerta: SecurityAlertType.FUERZA_BRUTA,
          resuelta: false,
          fecha_alerta: {
            gte: timeWindow,
          },
        },
      });

      // Generar alerta si supera el umbral y no existe una reciente
      if (failedAttempts >= this.BRUTE_FORCE_CRITICAL && !existingAlert) {
        await this.createSecurityAlert({
          tipo: SecurityAlertType.FUERZA_BRUTA,
          nivel: AlertLevel.CRITICAL,
          descripcion: `ALERTA CRÍTICA: ${failedAttempts} intentos de login fallidos desde IP ${ipAddress} en los últimos ${this.TIME_WINDOW_MINUTES} minutos. Posible ataque de fuerza bruta en curso.`,
          ipAddress,
          datosAdicionales: {
            intentos_fallidos: failedAttempts,
            ultimo_identificador: identificador,
            user_agent: userAgent,
            ventana_tiempo_minutos: this.TIME_WINDOW_MINUTES,
          },
        });
      } else if (failedAttempts >= this.BRUTE_FORCE_THRESHOLD && !existingAlert) {
        await this.createSecurityAlert({
          tipo: SecurityAlertType.FUERZA_BRUTA,
          nivel: AlertLevel.WARNING,
          descripcion: `Posible ataque de fuerza bruta: ${failedAttempts} intentos fallidos desde IP ${ipAddress} en los últimos ${this.TIME_WINDOW_MINUTES} minutos.`,
          ipAddress,
          datosAdicionales: {
            intentos_fallidos: failedAttempts,
            ultimo_identificador: identificador,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error checking brute force: ${error.message}`);
    }
  }

  /**
   * Detecta login exitoso sospechoso (después de muchos intentos fallidos)
   */
  private async checkSuspiciousSuccessfulLogin(data: LoginAttemptData): Promise<void> {
    try {
      const timeWindow = new Date();
      timeWindow.setMinutes(timeWindow.getMinutes() - this.TIME_WINDOW_MINUTES);

      // Contar intentos fallidos previos
      const previousFailedAttempts = await this.prisma.logIntentoLogin.count({
        where: {
          ip_address: data.ipAddress,
          exitoso: false,
          fecha_intento: {
            gte: timeWindow,
          },
        },
      });

      if (previousFailedAttempts >= 3) {
        await this.createSecurityAlert({
          tipo: SecurityAlertType.ACCESO_SOSPECHOSO,
          nivel: AlertLevel.INFO,
          descripcion: `Login exitoso después de ${previousFailedAttempts} intentos fallidos desde IP ${data.ipAddress}. Usuario: ${data.identificador}`,
          ipAddress: data.ipAddress,
          codigoUsuario: data.codigoUsuario,
          datosAdicionales: {
            intentos_fallidos_previos: previousFailedAttempts,
            identificador: data.identificador,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error checking suspicious login: ${error.message}`);
    }
  }

  /**
   * Crea una alerta de seguridad y notifica a los administradores
   */
  async createSecurityAlert(params: {
    tipo: SecurityAlertType;
    nivel: AlertLevel;
    descripcion: string;
    ipAddress?: string;
    codigoUsuario?: number;
    datosAdicionales?: any;
  }): Promise<void> {
    try {
      const alerta = await this.prisma.alertaSeguridad.create({
        data: {
          tipo_alerta: params.tipo,
          nivel: params.nivel,
          descripcion: params.descripcion,
          ip_address: params.ipAddress || null,
          codigo_usuario: params.codigoUsuario || null,
          datos_adicionales: params.datosAdicionales || null,
        },
      });

      this.logger.warn(
        `🚨 Security Alert [${params.nivel}]: ${params.tipo} - ${params.descripcion}`,
      );

      // Notificar en tiempo real vía WebSocket a administradores
      this.eventsGateway.notifySecurityAlert({
        alertId: alerta.codigo_alerta,
        type: params.tipo,
        level: params.nivel,
        description: params.descripcion,
        ipAddress: params.ipAddress,
        timestamp: alerta.fecha_alerta,
      });
    } catch (error) {
      this.logger.error(`Error creating security alert: ${error.message}`);
    }
  }

  /**
   * Registra cuando una cuenta es bloqueada por exceso de intentos
   */
  async logAccountBlocked(
    codigoUsuario: number,
    identificador: string,
    ipAddress: string,
  ): Promise<void> {
    await this.createSecurityAlert({
      tipo: SecurityAlertType.CUENTA_BLOQUEADA,
      nivel: AlertLevel.WARNING,
      descripcion: `Cuenta bloqueada por exceso de intentos fallidos. Usuario: ${identificador}, IP: ${ipAddress}`,
      ipAddress,
      codigoUsuario,
      datosAdicionales: {
        identificador,
        razon: 'Exceso de intentos de login fallidos',
      },
    });
  }

  /**
   * Obtiene estadísticas de intentos de login por IP
   */
  async getLoginAttemptStats(ipAddress?: string, hours: number = 24): Promise<any> {
    const timeWindow = new Date();
    timeWindow.setHours(timeWindow.getHours() - hours);

    const whereClause: any = {
      fecha_intento: {
        gte: timeWindow,
      },
    };

    if (ipAddress) {
      whereClause.ip_address = ipAddress;
    }

    const [total, exitosos, fallidos] = await Promise.all([
      this.prisma.logIntentoLogin.count({ where: whereClause }),
      this.prisma.logIntentoLogin.count({ where: { ...whereClause, exitoso: true } }),
      this.prisma.logIntentoLogin.count({ where: { ...whereClause, exitoso: false } }),
    ]);

    // Obtener las IPs con más intentos fallidos
    const topFailedIPs = await this.prisma.logIntentoLogin.groupBy({
      by: ['ip_address'],
      where: {
        ...whereClause,
        exitoso: false,
      },
      _count: {
        ip_address: true,
      },
      orderBy: {
        _count: {
          ip_address: 'desc',
        },
      },
      take: 10,
    });

    return {
      periodo_horas: hours,
      total_intentos: total,
      intentos_exitosos: exitosos,
      intentos_fallidos: fallidos,
      tasa_exito: total > 0 ? ((exitosos / total) * 100).toFixed(2) + '%' : '0%',
      top_ips_fallidas: topFailedIPs.map((ip) => ({
        ip: ip.ip_address,
        intentos_fallidos: ip._count.ip_address,
      })),
    };
  }

  /**
   * Obtiene alertas de seguridad activas
   */
  async getActiveAlerts(): Promise<any[]> {
    return this.prisma.alertaSeguridad.findMany({
      where: {
        resuelta: false,
      },
      orderBy: [
        {
          nivel: 'desc', // CRITICAL primero
        },
        {
          fecha_alerta: 'desc',
        },
      ],
    });
  }

  /**
   * Marca una alerta como resuelta
   */
  async resolveAlert(codigoAlerta: number, resueltaPor: number): Promise<void> {
    await this.prisma.alertaSeguridad.update({
      where: {
        codigo_alerta: codigoAlerta,
      },
      data: {
        resuelta: true,
        fecha_resolucion: new Date(),
        resuelta_por: resueltaPor,
      },
    });

    this.logger.log(`Alert ${codigoAlerta} resolved by user ${resueltaPor}`);
  }

  /**
   * Obtiene el historial de cambios de una tabla específica
   * (Consulta a la tabla de auditoría - tablas espejo)
   */
  async getAuditHistory(
    tabla: string,
    codigoRegistro?: number,
    limit: number = 50,
  ): Promise<any[]> {
    const whereClause: any = { tabla };
    if (codigoRegistro) {
      whereClause.codigo_registro = codigoRegistro;
    }

    return this.prisma.auditoriaTabla.findMany({
      where: whereClause,
      orderBy: {
        fecha_operacion: 'desc',
      },
      take: limit,
    });
  }
}
