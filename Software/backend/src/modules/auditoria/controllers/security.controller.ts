import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SecurityLoggingService } from '../services/security-logging.service';

/**
 * SecurityController
 *
 * Endpoints para gestión de logs de seguridad y auditoría.
 * Solo accesible por administradores.
 *
 * Funcionalidades:
 * - Ver estadísticas de intentos de login
 * - Consultar alertas de seguridad
 * - Ver historial de cambios (auditoría de tablas)
 * - Resolver alertas
 */
@ApiTags('Seguridad y Auditoría')
@Controller('seguridad')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SecurityController {
  constructor(private readonly securityService: SecurityLoggingService) {}

  /**
   * Obtiene estadísticas de intentos de login
   * Útil para detectar patrones de ataque
   */
  @Get('login-stats')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Estadísticas de intentos de login',
    description: 'Obtiene estadísticas de intentos de login exitosos/fallidos. Permite filtrar por IP y período de tiempo.',
  })
  @ApiQuery({ name: 'ip', required: false, description: 'Filtrar por IP específica' })
  @ApiQuery({ name: 'hours', required: false, description: 'Período en horas (default: 24)' })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  async getLoginStats(
    @Query('ip') ip?: string,
    @Query('hours') hours?: string,
  ) {
    const hoursNum = hours ? parseInt(hours, 10) : 24;
    return this.securityService.getLoginAttemptStats(ip, hoursNum);
  }

  /**
   * Obtiene alertas de seguridad activas
   */
  @Get('alertas')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Alertas de seguridad activas',
    description: 'Lista todas las alertas de seguridad que no han sido resueltas, ordenadas por criticidad.',
  })
  @ApiResponse({ status: 200, description: 'Lista de alertas activas' })
  async getActiveAlerts() {
    const alertas = await this.securityService.getActiveAlerts();
    return {
      total: alertas.length,
      criticas: alertas.filter(a => a.nivel === 'CRITICAL').length,
      warnings: alertas.filter(a => a.nivel === 'WARNING').length,
      alertas,
    };
  }

  /**
   * Marca una alerta como resuelta
   */
  @Post('alertas/:id/resolver')
  @Roles('Administrador')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolver alerta de seguridad',
    description: 'Marca una alerta como resuelta y registra quién la resolvió.',
  })
  @ApiResponse({ status: 200, description: 'Alerta resuelta exitosamente' })
  @ApiResponse({ status: 404, description: 'Alerta no encontrada' })
  async resolveAlert(
    @Param('id', ParseIntPipe) alertId: number,
    @CurrentUser() user: any,
  ) {
    await this.securityService.resolveAlert(alertId, user.codigo_usuario);
    return {
      message: 'Alerta resuelta exitosamente',
      alertaId: alertId,
      resueltaPor: user.codigo_usuario,
    };
  }

  /**
   * Obtiene historial de cambios de una tabla específica
   * Implementa la funcionalidad de "tablas espejo" (old_value vs new_value)
   */
  @Get('auditoria/:tabla')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Historial de cambios de una tabla',
    description: 'Consulta el historial de cambios (INSERT/UPDATE/DELETE) de una tabla específica. Muestra datos_anteriores vs datos_nuevos.',
  })
  @ApiQuery({ name: 'registro', required: false, description: 'Filtrar por ID de registro específico' })
  @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados (default: 50)' })
  @ApiResponse({ status: 200, description: 'Historial de cambios' })
  async getAuditHistory(
    @Param('tabla') tabla: string,
    @Query('registro') registro?: string,
    @Query('limit') limit?: string,
  ) {
    const registroNum = registro ? parseInt(registro, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    // Construir nombre completo de tabla si no incluye esquema
    const tablaCompleta = tabla.includes('.') ? tabla : `usuarios.${tabla}`;

    const historial = await this.securityService.getAuditHistory(
      tablaCompleta,
      registroNum,
      limitNum,
    );

    return {
      tabla: tablaCompleta,
      registros: historial.length,
      historial,
    };
  }

  /**
   * Dashboard de seguridad - Resumen general
   */
  @Get('dashboard')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Dashboard de seguridad',
    description: 'Obtiene un resumen completo del estado de seguridad del sistema.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard de seguridad' })
  async getSecurityDashboard() {
    const [loginStats, alertas] = await Promise.all([
      this.securityService.getLoginAttemptStats(undefined, 24),
      this.securityService.getActiveAlerts(),
    ]);

    return {
      resumen: {
        periodo: 'Últimas 24 horas',
        total_intentos_login: loginStats.total_intentos,
        intentos_exitosos: loginStats.intentos_exitosos,
        intentos_fallidos: loginStats.intentos_fallidos,
        tasa_exito: loginStats.tasa_exito,
        alertas_activas: alertas.length,
        alertas_criticas: alertas.filter(a => a.nivel === 'CRITICAL').length,
      },
      top_ips_sospechosas: loginStats.top_ips_fallidas,
      alertas_recientes: alertas.slice(0, 5),
      estado_sistema: this.evaluarEstadoSistema(loginStats, alertas),
    };
  }

  /**
   * Evalúa el estado general de seguridad del sistema
   */
  private evaluarEstadoSistema(loginStats: any, alertas: any[]): {
    estado: 'NORMAL' | 'ALERTA' | 'CRITICO';
    mensaje: string;
    recomendaciones: string[];
  } {
    const alertasCriticas = alertas.filter(a => a.nivel === 'CRITICAL').length;
    const alertasWarning = alertas.filter(a => a.nivel === 'WARNING').length;
    const tasaFallosAlta = (loginStats.intentos_fallidos / loginStats.total_intentos) > 0.3;

    const recomendaciones: string[] = [];

    if (alertasCriticas > 0) {
      recomendaciones.push('Revisar y resolver alertas críticas inmediatamente');
      return {
        estado: 'CRITICO',
        mensaje: `${alertasCriticas} alerta(s) crítica(s) requieren atención inmediata`,
        recomendaciones,
      };
    }

    if (alertasWarning > 3 || tasaFallosAlta) {
      if (tasaFallosAlta) {
        recomendaciones.push('Alta tasa de intentos de login fallidos - considerar revisar IPs sospechosas');
      }
      if (alertasWarning > 3) {
        recomendaciones.push('Múltiples alertas de advertencia pendientes');
      }
      return {
        estado: 'ALERTA',
        mensaje: 'Se detectaron anomalías que requieren revisión',
        recomendaciones,
      };
    }

    return {
      estado: 'NORMAL',
      mensaje: 'El sistema opera con normalidad',
      recomendaciones: ['Continuar monitoreo regular'],
    };
  }
}
