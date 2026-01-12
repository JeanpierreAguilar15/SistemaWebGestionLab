import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ConversacionEstado,
  HandoffInfoDto,
  MensajeInfoDto,
  SolicitarHandoffDto,
} from '../dto/dialogflow.dto';

/**
 * Información de conversación activa (en memoria para rendimiento)
 */
interface ConversacionActiva {
  conversacion_id: number;
  session_id: string;
  usuario_id?: number;
  usuario_nombre: string;
  estado: ConversacionEstado;
  operador_id?: number;
  operador_nombre?: string;
  fecha_inicio: Date;
  ultima_actividad: Date;
}

@Injectable()
export class LiveChatService {
  private readonly logger = new Logger(LiveChatService.name);

  // Cache de conversaciones activas: session_id -> ConversacionActiva
  private conversacionesActivas = new Map<string, ConversacionActiva>();

  constructor(private readonly prisma: PrismaService) {}

  // =====================================================
  // HANDOFF - Solicitud de transferencia a humano
  // =====================================================

  /**
   * Solicita transferencia a operador humano
   */
  async solicitarHandoff(dto: SolicitarHandoffDto): Promise<HandoffInfoDto> {
    this.logger.log(`Handoff solicitado: session=${dto.session_id}`);

    // Buscar usuario si tiene cédula
    let usuarioId: number | null = null;
    let usuarioNombre = dto.nombre_usuario || 'Usuario Anónimo';

    if (dto.cedula) {
      const usuario = await this.prisma.usuario.findFirst({
        where: { cedula: dto.cedula, activo: true },
      });
      if (usuario) {
        usuarioId = usuario.codigo_usuario;
        usuarioNombre = `${usuario.nombres} ${usuario.apellidos}`;
      }
    }

    // Buscar conversación existente o crear nueva
    let conversacion = await this.prisma.conversacion.findFirst({
      where: {
        tipo: 'CHAT',
        estado: { in: ['ACTIVA', 'ESPERANDO_OPERADOR'] },
        ...(usuarioId ? { codigo_usuario: usuarioId } : {}),
      },
      orderBy: { fecha_inicio: 'desc' },
    });

    if (!conversacion) {
      // Crear nueva conversación
      conversacion = await this.prisma.conversacion.create({
        data: {
          codigo_usuario: usuarioId,
          tipo: 'CHAT',
          estado: ConversacionEstado.ESPERANDO_OPERADOR,
          transferida_a_humano: true,
          fecha_transferencia: new Date(),
        },
      });

      // Mensaje de sistema
      await this.prisma.mensaje.create({
        data: {
          codigo_conversacion: conversacion.codigo_conversacion,
          remitente: 'SISTEMA',
          contenido: dto.motivo || 'Usuario solicitó hablar con un operador',
          tipo_contenido: 'SISTEMA',
        },
      });
    } else {
      // Actualizar conversación existente
      await this.prisma.conversacion.update({
        where: { codigo_conversacion: conversacion.codigo_conversacion },
        data: {
          estado: ConversacionEstado.ESPERANDO_OPERADOR,
          transferida_a_humano: true,
          fecha_transferencia: new Date(),
        },
      });
    }

    // Guardar en cache
    this.conversacionesActivas.set(dto.session_id, {
      conversacion_id: conversacion.codigo_conversacion,
      session_id: dto.session_id,
      usuario_id: usuarioId || undefined,
      usuario_nombre: usuarioNombre,
      estado: ConversacionEstado.ESPERANDO_OPERADOR,
      fecha_inicio: conversacion.fecha_inicio,
      ultima_actividad: new Date(),
    });

    // Calcular posición en cola
    const posicion = await this.obtenerPosicionCola(conversacion.codigo_conversacion);

    return {
      conversacion_id: conversacion.codigo_conversacion,
      posicion_cola: posicion,
      estado: ConversacionEstado.ESPERANDO_OPERADOR,
      mensaje: `Tu solicitud fue registrada. Posición en cola: ${posicion}. Un operador te atenderá pronto.`,
    };
  }

  /**
   * Operador toma una conversación
   */
  async asignarOperador(
    conversacionId: number,
    operadorId: number,
  ): Promise<ConversacionActiva | null> {
    this.logger.log(`Operador ${operadorId} toma conversación ${conversacionId}`);

    const conversacion = await this.prisma.conversacion.update({
      where: { codigo_conversacion: conversacionId },
      data: {
        estado: ConversacionEstado.ATENDIDA,
        atendido_por: operadorId,
      },
      include: {
        usuario: { select: { nombres: true, apellidos: true } },
        operador: { select: { nombres: true, apellidos: true } },
      },
    });

    // Mensaje de sistema
    await this.prisma.mensaje.create({
      data: {
        codigo_conversacion: conversacionId,
        remitente: 'SISTEMA',
        contenido: `${conversacion.operador?.nombres || 'Un operador'} se unió a la conversación`,
        tipo_contenido: 'SISTEMA',
      },
    });

    // Actualizar cache
    for (const [sessionId, conv] of this.conversacionesActivas) {
      if (conv.conversacion_id === conversacionId) {
        conv.estado = ConversacionEstado.ATENDIDA;
        conv.operador_id = operadorId;
        conv.operador_nombre = conversacion.operador
          ? `${conversacion.operador.nombres} ${conversacion.operador.apellidos}`
          : 'Operador';
        this.conversacionesActivas.set(sessionId, conv);
        return conv;
      }
    }

    return null;
  }

  // =====================================================
  // MENSAJES
  // =====================================================

  /**
   * Guarda un mensaje en la conversación
   */
  async guardarMensaje(data: {
    conversacion_id: number;
    remitente_id?: number;
    tipo_remitente: 'USER' | 'OPERATOR' | 'BOT' | 'SYSTEM';
    contenido: string;
  }): Promise<MensajeInfoDto> {
    const mensaje = await this.prisma.mensaje.create({
      data: {
        codigo_conversacion: data.conversacion_id,
        remitente: data.tipo_remitente,
        codigo_remitente: data.remitente_id,
        contenido: data.contenido,
        tipo_contenido: 'TEXTO',
      },
      include: {
        usuario: { select: { nombres: true, apellidos: true } },
      },
    });

    // Actualizar última actividad
    await this.prisma.conversacion.update({
      where: { codigo_conversacion: data.conversacion_id },
      data: { fecha_fin: null },
    });

    return {
      id: mensaje.codigo_mensaje,
      contenido: mensaje.contenido,
      remitente: mensaje.remitente,
      nombre_remitente: mensaje.usuario
        ? `${mensaje.usuario.nombres} ${mensaje.usuario.apellidos}`
        : data.tipo_remitente === 'BOT'
          ? 'Asistente'
          : data.tipo_remitente === 'OPERATOR'
            ? 'Operador'
            : 'Usuario',
      timestamp: mensaje.fecha_envio,
    };
  }

  /**
   * Obtiene historial de mensajes
   */
  async obtenerMensajes(conversacionId: number, limite = 50): Promise<MensajeInfoDto[]> {
    const mensajes = await this.prisma.mensaje.findMany({
      where: { codigo_conversacion: conversacionId },
      include: {
        usuario: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { fecha_envio: 'asc' },
      take: limite,
    });

    return mensajes.map((m) => ({
      id: m.codigo_mensaje,
      contenido: m.contenido,
      remitente: m.remitente,
      nombre_remitente: m.usuario
        ? `${m.usuario.nombres} ${m.usuario.apellidos}`
        : m.remitente === 'BOT'
          ? 'Asistente'
          : m.remitente === 'OPERATOR'
            ? 'Operador'
            : m.remitente === 'SYSTEM'
              ? 'Sistema'
              : 'Usuario',
      timestamp: m.fecha_envio,
    }));
  }

  // =====================================================
  // GESTIÓN DE CONVERSACIONES
  // =====================================================

  /**
   * Cierra una conversación
   */
  async cerrarConversacion(conversacionId: number): Promise<void> {
    await this.prisma.conversacion.update({
      where: { codigo_conversacion: conversacionId },
      data: {
        estado: ConversacionEstado.CERRADA,
        fecha_fin: new Date(),
      },
    });

    await this.prisma.mensaje.create({
      data: {
        codigo_conversacion: conversacionId,
        remitente: 'SISTEMA',
        contenido: 'La conversación ha sido cerrada. ¡Gracias por contactarnos!',
        tipo_contenido: 'SISTEMA',
      },
    });

    // Remover del cache
    for (const [sessionId, conv] of this.conversacionesActivas) {
      if (conv.conversacion_id === conversacionId) {
        this.conversacionesActivas.delete(sessionId);
        break;
      }
    }

    this.logger.log(`Conversación ${conversacionId} cerrada`);
  }

  /**
   * Obtiene conversaciones pendientes (para operadores)
   */
  async obtenerConversacionesPendientes(): Promise<any[]> {
    const conversaciones = await this.prisma.conversacion.findMany({
      where: {
        tipo: 'CHAT',
        estado: ConversacionEstado.ESPERANDO_OPERADOR,
      },
      include: {
        usuario: { select: { nombres: true, apellidos: true, email: true } },
        mensajes: {
          orderBy: { fecha_envio: 'desc' },
          take: 1,
        },
      },
      orderBy: { fecha_transferencia: 'asc' },
    });

    return conversaciones.map((c, i) => ({
      id: c.codigo_conversacion,
      usuario_id: c.codigo_usuario,
      usuario_nombre: c.usuario
        ? `${c.usuario.nombres} ${c.usuario.apellidos}`
        : 'Usuario Anónimo',
      usuario_email: c.usuario?.email,
      estado: c.estado,
      esperando_desde: c.fecha_transferencia,
      posicion_cola: i + 1,
      ultimo_mensaje: c.mensajes[0]?.contenido || 'Sin mensajes',
    }));
  }

  /**
   * Obtiene conversaciones activas de un operador
   */
  async obtenerConversacionesOperador(operadorId: number): Promise<any[]> {
    const conversaciones = await this.prisma.conversacion.findMany({
      where: {
        tipo: 'CHAT',
        estado: ConversacionEstado.ATENDIDA,
        atendido_por: operadorId,
      },
      include: {
        usuario: { select: { nombres: true, apellidos: true } },
        mensajes: {
          orderBy: { fecha_envio: 'desc' },
          take: 1,
        },
      },
      orderBy: { fecha_inicio: 'desc' },
    });

    return conversaciones.map((c) => ({
      id: c.codigo_conversacion,
      usuario_id: c.codigo_usuario,
      usuario_nombre: c.usuario
        ? `${c.usuario.nombres} ${c.usuario.apellidos}`
        : 'Usuario Anónimo',
      estado: c.estado,
      fecha_inicio: c.fecha_inicio,
      ultimo_mensaje: c.mensajes[0]?.contenido || 'Sin mensajes',
      ultimo_mensaje_fecha: c.mensajes[0]?.fecha_envio,
    }));
  }

  /**
   * Estadísticas del chat en vivo
   */
  async obtenerEstadisticas(): Promise<{
    pendientes: number;
    activas: number;
    cerradas_hoy: number;
  }> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [pendientes, activas, cerradasHoy] = await Promise.all([
      this.prisma.conversacion.count({
        where: { tipo: 'CHAT', estado: ConversacionEstado.ESPERANDO_OPERADOR },
      }),
      this.prisma.conversacion.count({
        where: { tipo: 'CHAT', estado: ConversacionEstado.ATENDIDA },
      }),
      this.prisma.conversacion.count({
        where: {
          tipo: 'CHAT',
          estado: ConversacionEstado.CERRADA,
          fecha_fin: { gte: hoy },
        },
      }),
    ]);

    return { pendientes, activas, cerradas_hoy: cerradasHoy };
  }

  // =====================================================
  // HELPERS
  // =====================================================

  /**
   * Obtiene posición en cola de espera
   */
  private async obtenerPosicionCola(conversacionId: number): Promise<number> {
    const anteriores = await this.prisma.conversacion.count({
      where: {
        tipo: 'CHAT',
        estado: ConversacionEstado.ESPERANDO_OPERADOR,
        codigo_conversacion: { lt: conversacionId },
      },
    });
    return anteriores + 1;
  }

  /**
   * Obtiene conversación por session_id (desde cache)
   */
  obtenerPorSession(sessionId: string): ConversacionActiva | undefined {
    return this.conversacionesActivas.get(sessionId);
  }

  /**
   * Verifica si una sesión está en handoff
   */
  estaEnHandoff(sessionId: string): boolean {
    const conv = this.conversacionesActivas.get(sessionId);
    return conv?.estado === ConversacionEstado.ESPERANDO_OPERADOR ||
           conv?.estado === ConversacionEstado.ATENDIDA;
  }

  /**
   * Limpia conversación del cache (cuando usuario cancela)
   */
  limpiarSession(sessionId: string): void {
    this.conversacionesActivas.delete(sessionId);
  }
}
