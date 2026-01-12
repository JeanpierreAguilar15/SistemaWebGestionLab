import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Gateway WebSocket para comunicación en tiempo real
 * Permite notificaciones bidireccionales entre admin y pacientes
 *
 * Flujos principales:
 * 1. Admin actualiza datos → Pacientes reciben notificación
 * 2. Paciente actualiza datos → Admin recibe notificación
 * 3. Eventos del sistema → Todos los usuarios relevantes son notificados
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedClients = new Map<string, { userId: number; role: string; socketId: string }>();

  constructor(private jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('🔌 WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // Extraer token del handshake
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`❌ Client ${client.id} rejected: No token provided`);
        client.disconnect();
        return;
      }

      // Verificar token JWT
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.codigo_usuario;
      const role = payload.rol;

      // Registrar cliente conectado
      this.connectedClients.set(client.id, {
        userId,
        role,
        socketId: client.id,
      });

      // Unir a room por rol (admin o paciente)
      client.join(`role:${role}`);

      // Unir a room personal
      client.join(`user:${userId}`);

      this.logger.log(
        `✅ Client connected: ${client.id} | User: ${userId} | Role: ${role} | Total: ${this.connectedClients.size}`,
      );

      // Notificar al cliente que está conectado
      client.emit('connected', {
        message: 'Connected to events server',
        userId,
        role,
      });

    } catch (error) {
      this.logger.error(`❌ Connection error for ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);
    this.connectedClients.delete(client.id);

    this.logger.log(
      `🔌 Client disconnected: ${client.id} | User: ${clientInfo?.userId || 'unknown'} | Total: ${this.connectedClients.size}`,
    );
  }

  /**
   * Notificar cambios en el catálogo a todos los usuarios
   * Se dispara cuando admin actualiza exámenes, precios, categorías, paquetes
   */
  notifyCatalogUpdate(data: {
    type: string;
    action: string;
    entityId: number;
    entityName?: string;
  }) {
    this.logger.debug(`📢 Broadcasting catalog update: ${data.type} ${data.action}`);

    // Notificar a todos los clientes (admin y pacientes)
    this.server.emit('catalog:update', {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Notificar cambios específicos de usuario
   * Se dispara cuando admin actualiza datos de un paciente específico
   */
  notifyUserUpdate(userId: number, data: {
    type: string;
    action: string;
    changes?: any;
  }) {
    this.logger.debug(`👤 Notifying user ${userId}: ${data.type} ${data.action}`);

    // Enviar solo al usuario específico
    this.server.to(`user:${userId}`).emit('user:update', {
      ...data,
      timestamp: new Date(),
    });

    // También notificar a admins
    this.server.to('role:Administrador').emit('user:update', {
      userId,
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Notificar eventos administrativos importantes
   * Se dispara desde los listeners de auditoría
   */
  notifyAdminEvent(data: {
    eventType: string;
    entityType: string;
    entityId: number;
    action: string;
    userId: number;
    data?: any;
  }) {
    this.logger.debug(`🔔 Admin event: ${data.eventType}`);

    // Solo enviar a admins
    this.server.to('role:Administrador').emit('admin:event', {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Notificar alertas de seguridad en tiempo real
   * Se dispara desde SecurityLoggingService cuando detecta:
   * - Ataques de fuerza bruta
   * - Cuentas bloqueadas
   * - Accesos sospechosos
   */
  notifySecurityAlert(data: {
    alertId: number;
    type: string;
    level: string;
    description: string;
    ipAddress?: string;
    timestamp: Date;
  }) {
    this.logger.warn(`🚨 Security Alert [${data.level}]: ${data.type}`);

    // Solo enviar a administradores
    this.server.to('role:Administrador').emit('security:alert', {
      ...data,
      timestamp: new Date(),
    });

    // Si es crítico, también hacer broadcast a todos los admins conectados
    if (data.level === 'CRITICAL') {
      this.server.to('role:Administrador').emit('system:message', {
        type: 'error',
        message: `🚨 ALERTA CRÍTICA DE SEGURIDAD: ${data.description}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Notificar actualizaciones de citas
   * Bidireccional: Admin crea/modifica → Paciente notificado
   *                Paciente agenda → Admin notificado
   */
  notifyAppointmentUpdate(data: {
    appointmentId: number;
    patientId: number;
    action: 'created' | 'updated' | 'cancelled' | 'confirmed';
    appointment?: any;
  }) {
    this.logger.debug(`📅 Appointment ${data.action}: ${data.appointmentId}`);

    // Notificar al paciente
    this.server.to(`user:${data.patientId}`).emit('appointment:update', {
      ...data,
      timestamp: new Date(),
    });

    // Notificar a admins
    this.server.to('role:Administrador').emit('appointment:update', {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Notificar actualizaciones de resultados
   * Admin publica resultado → Paciente notificado
   */
  notifyResultUpdate(data: {
    resultId: number;
    patientId: number;
    examName: string;
    status: 'pending' | 'ready' | 'delivered';
  }) {
    this.logger.debug(`📊 Result ${data.status}: ${data.resultId} for user ${data.patientId}`);

    // Notificar al paciente
    this.server.to(`user:${data.patientId}`).emit('result:update', {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast mensaje general del sistema
   */
  broadcastSystemMessage(data: {
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    targetRole?: string;
  }) {
    this.logger.log(`📣 System broadcast: ${data.type} - ${data.message}`);

    if (data.targetRole) {
      this.server.to(`role:${data.targetRole}`).emit('system:message', {
        ...data,
        timestamp: new Date(),
      });
    } else {
      this.server.emit('system:message', {
        ...data,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Obtener estadísticas de conexiones activas
   */
  getConnectionStats() {
    const stats = {
      total: this.connectedClients.size,
      byRole: {} as Record<string, number>,
      clients: Array.from(this.connectedClients.values()),
    };

    this.connectedClients.forEach((client) => {
      stats.byRole[client.role] = (stats.byRole[client.role] || 0) + 1;
    });

    return stats;
  }

  /**
   * Mensaje de prueba para verificar conectividad
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): { event: string; data: any } {
    const clientInfo = this.connectedClients.get(client.id);
    this.logger.debug(`🏓 Ping from ${client.id} (User: ${clientInfo?.userId})`);

    return {
      event: 'pong',
      data: {
        timestamp: new Date(),
        userId: clientInfo?.userId,
      },
    };
  }

  /**
   * Suscribirse a eventos específicos de una entidad
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { entity: string; entityId?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = data.entityId
      ? `${data.entity}:${data.entityId}`
      : `${data.entity}:all`;

    client.join(room);

    this.logger.debug(`📌 Client ${client.id} subscribed to ${room}`);

    return {
      event: 'subscribed',
      data: { room },
    };
  }

  /**
   * Desuscribirse de eventos
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { entity: string; entityId?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = data.entityId
      ? `${data.entity}:${data.entityId}`
      : `${data.entity}:all`;

    client.leave(room);

    this.logger.debug(`📍 Client ${client.id} unsubscribed from ${room}`);

    return {
      event: 'unsubscribed',
      data: { room },
    };
  }
}
