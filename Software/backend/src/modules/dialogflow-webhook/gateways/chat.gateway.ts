import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { DialogflowService } from '../services/dialogflow.service';
import { LiveChatService } from '../services/livechat.service';
import { ConversacionEstado } from '../dto/dialogflow.dto';

/**
 * Cliente conectado al chat
 */
interface ClienteConectado {
  socket_id: string;
  session_id: string;
  usuario_id?: number;
  usuario_nombre: string;
  es_operador: boolean;
  conversacion_id?: number;
  modo: 'BOT' | 'HANDOFF';
}

/**
 * ChatGateway - WebSocket para chat en tiempo real
 *
 * Modos de operación:
 * - BOT: Mensajes procesados por DialogflowService
 * - HANDOFF: Mensajes van al operador humano
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Clientes conectados: socket_id -> ClienteConectado
  private clientes = new Map<string, ClienteConectado>();

  // Operadores conectados: socket_id -> operador_id
  private operadores = new Map<string, number>();

  constructor(
    private readonly dialogflowService: DialogflowService,
    private readonly liveChatService: LiveChatService,
  ) {}

  // =====================================================
  // CONEXIÓN / DESCONEXIÓN
  // =====================================================

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);

    this.clientes.set(client.id, {
      socket_id: client.id,
      session_id: client.id,
      usuario_nombre: 'Usuario',
      es_operador: false,
      modo: 'BOT',
    });
  }

  handleDisconnect(client: Socket) {
    const info = this.clientes.get(client.id);
    this.clientes.delete(client.id);
    this.operadores.delete(client.id);

    this.logger.log(`Cliente desconectado: ${client.id} (${info?.es_operador ? 'Operador' : 'Usuario'})`);

    // Si estaba en conversación con operador, notificar
    if (info?.conversacion_id && !info.es_operador) {
      this.server.to(`conv:${info.conversacion_id}`).emit('usuario_desconectado', {
        conversacion_id: info.conversacion_id,
        mensaje: 'El usuario se ha desconectado',
      });
    }
  }

  // =====================================================
  // REGISTRO DE CLIENTES
  // =====================================================

  /**
   * Usuario se registra con su session_id
   */
  @SubscribeMessage('registrar')
  handleRegistrar(
    @MessageBody() data: { session_id: string; usuario_id?: number; nombre?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const info = this.clientes.get(client.id);
    if (info) {
      info.session_id = data.session_id;
      info.usuario_id = data.usuario_id;
      info.usuario_nombre = data.nombre || 'Usuario';
      this.clientes.set(client.id, info);
    }

    client.join(`session:${data.session_id}`);
    this.logger.log(`Usuario registrado: ${data.session_id}`);

    client.emit('registrado', { session_id: data.session_id, modo: 'BOT' });
  }

  /**
   * Operador se registra
   */
  @SubscribeMessage('registrar_operador')
  handleRegistrarOperador(
    @MessageBody() data: { operador_id: number; nombre: string },
    @ConnectedSocket() client: Socket,
  ) {
    const info = this.clientes.get(client.id);
    if (info) {
      info.es_operador = true;
      info.usuario_id = data.operador_id;
      info.usuario_nombre = data.nombre;
      this.clientes.set(client.id, info);
    }

    this.operadores.set(client.id, data.operador_id);
    client.join('operadores');

    this.logger.log(`Operador registrado: ${data.operador_id} (${data.nombre})`);

    client.emit('operador_registrado', { operador_id: data.operador_id });
  }

  // =====================================================
  // MENSAJES - FLUJO PRINCIPAL
  // =====================================================

  /**
   * Usuario envía mensaje (va al bot o al operador según modo)
   */
  @SubscribeMessage('mensaje')
  async handleMensaje(
    @MessageBody() data: { contenido: string; session_id?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const info = this.clientes.get(client.id);
    const sessionId = data.session_id || info?.session_id || client.id;

    // Si está en modo HANDOFF, enviar al operador
    if (info?.modo === 'HANDOFF' && info.conversacion_id) {
      await this.enviarAlOperador(info.conversacion_id, {
        contenido: data.contenido,
        remitente_id: info.usuario_id,
        nombre: info.usuario_nombre,
      });
      return;
    }

    // Modo BOT: procesar mensaje
    // Por ahora, respuesta simple - luego conectar con Dialogflow CX real
    const respuesta = await this.procesarMensajeBot(sessionId, data.contenido, info?.usuario_id);

    client.emit('respuesta', {
      ...respuesta,
      session_id: sessionId,
      timestamp: new Date(),
    });

    // Si la respuesta sugiere handoff
    if (respuesta.accion === 'SUGERIR_HANDOFF') {
      client.emit('sugerir_handoff', {
        mensaje: '¿Deseas hablar con un operador humano?',
      });
    }
  }

  /**
   * Procesa mensaje en modo BOT
   */
  private async procesarMensajeBot(
    sessionId: string,
    contenido: string,
    usuarioId?: number,
  ): Promise<any> {
    const texto = contenido.toLowerCase();

    // Detectar intención de handoff
    if (
      texto.includes('operador') ||
      texto.includes('humano') ||
      texto.includes('persona') ||
      texto.includes('agente') ||
      texto.includes('ayuda real')
    ) {
      return {
        mensaje: '¿Deseas que te conecte con un operador humano? Escribe "sí" para confirmar.',
        accion: 'SUGERIR_HANDOFF',
        intent: 'solicitar_operador',
      };
    }

    // Detectar confirmación de handoff
    if (texto === 'sí' || texto === 'si' || texto === 'confirmar') {
      return {
        mensaje: 'Por favor, usa el botón "Solicitar Operador" o escribe /operador',
        accion: 'CONFIRMAR_HANDOFF',
        intent: 'confirmar_handoff',
      };
    }

    // Detectar consulta de precios
    if (texto.includes('precio') || texto.includes('costo') || texto.includes('cuánto')) {
      const match = texto.match(/(?:precio|costo).*?(?:de|del)?\s*(\w+)/i);
      if (match && match[1]) {
        const resultado = await this.dialogflowService.consultarPrecio(match[1]);
        return {
          mensaje: resultado.mensaje,
          data: resultado.data,
          intent: 'consultar_precio',
        };
      }
      const lista = await this.dialogflowService.listarExamenes();
      return {
        mensaje: lista.mensaje,
        data: lista.data,
        intent: 'listar_examenes',
      };
    }

    // Detectar consulta de disponibilidad
    if (texto.includes('disponibilidad') || texto.includes('horario') || texto.includes('cita')) {
      const fechaMatch = texto.match(/(\d{4}-\d{2}-\d{2})/);
      if (fechaMatch) {
        const resultado = await this.dialogflowService.consultarDisponibilidad(fechaMatch[1]);
        return {
          mensaje: resultado.mensaje,
          data: resultado.data,
          intent: 'consultar_disponibilidad',
        };
      }
      return {
        mensaje: 'Para consultar disponibilidad, indica la fecha. Ejemplo: "disponibilidad para 2025-01-15"',
        intent: 'solicitar_fecha',
      };
    }

    // Respuesta por defecto
    return {
      mensaje: `Puedo ayudarte con:
• Consultar precios de exámenes
• Ver disponibilidad de citas
• Agendar una cita
• Hablar con un operador

¿Qué necesitas?`,
      intent: 'menu_principal',
    };
  }

  // =====================================================
  // HANDOFF - Transferencia a operador
  // =====================================================

  /**
   * Usuario solicita handoff
   */
  @SubscribeMessage('solicitar_handoff')
  async handleSolicitarHandoff(
    @MessageBody() data: { motivo?: string; session_id?: string; cedula?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const info = this.clientes.get(client.id);
    const sessionId = data.session_id || info?.session_id || client.id;

    this.logger.log(`Handoff solicitado: ${sessionId}`);

    try {
      const resultado = await this.liveChatService.solicitarHandoff({
        session_id: sessionId,
        cedula: data.cedula,
        nombre_usuario: info?.usuario_nombre,
        motivo: data.motivo,
      });

      // Actualizar cliente a modo HANDOFF
      if (info) {
        info.modo = 'HANDOFF';
        info.conversacion_id = resultado.conversacion_id;
        this.clientes.set(client.id, info);
      }

      // Unir a room de conversación
      client.join(`conv:${resultado.conversacion_id}`);

      // Notificar al usuario
      client.emit('handoff_iniciado', {
        conversacion_id: resultado.conversacion_id,
        posicion_cola: resultado.posicion_cola,
        mensaje: resultado.mensaje,
      });

      // Notificar a operadores
      this.server.to('operadores').emit('nueva_solicitud', {
        conversacion_id: resultado.conversacion_id,
        usuario_nombre: info?.usuario_nombre || 'Usuario Anónimo',
        motivo: data.motivo,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Error en handoff', error);
      client.emit('error', { mensaje: 'No se pudo procesar la solicitud' });
    }
  }

  /**
   * Usuario cancela handoff
   */
  @SubscribeMessage('cancelar_handoff')
  handleCancelarHandoff(@ConnectedSocket() client: Socket) {
    const info = this.clientes.get(client.id);

    if (info) {
      info.modo = 'BOT';
      info.conversacion_id = undefined;
      this.clientes.set(client.id, info);
      this.liveChatService.limpiarSession(info.session_id);
    }

    client.emit('handoff_cancelado', {
      mensaje: 'Has vuelto al asistente virtual.',
    });
  }

  // =====================================================
  // OPERADORES
  // =====================================================

  /**
   * Operador toma una conversación
   */
  @SubscribeMessage('tomar_conversacion')
  async handleTomarConversacion(
    @MessageBody() data: { conversacion_id: number },
    @ConnectedSocket() client: Socket,
  ) {
    const operadorId = this.operadores.get(client.id);
    if (!operadorId) {
      client.emit('error', { mensaje: 'No estás registrado como operador' });
      return;
    }

    try {
      const conv = await this.liveChatService.asignarOperador(data.conversacion_id, operadorId);
      const mensajes = await this.liveChatService.obtenerMensajes(data.conversacion_id);

      // Unir operador a room de conversación
      client.join(`conv:${data.conversacion_id}`);

      // Notificar al operador
      client.emit('conversacion_asignada', {
        conversacion_id: data.conversacion_id,
        usuario_nombre: conv?.usuario_nombre,
        mensajes,
      });

      // Notificar al usuario
      this.server.to(`conv:${data.conversacion_id}`).emit('operador_conectado', {
        operador_nombre: conv?.operador_nombre || 'Operador',
        mensaje: 'Un operador se ha unido a la conversación.',
      });

      // Notificar a otros operadores que ya fue tomada
      this.server.to('operadores').emit('conversacion_tomada', {
        conversacion_id: data.conversacion_id,
        operador_id: operadorId,
      });
    } catch (error) {
      this.logger.error('Error tomando conversación', error);
      client.emit('error', { mensaje: 'No se pudo tomar la conversación' });
    }
  }

  /**
   * Operador envía mensaje
   */
  @SubscribeMessage('mensaje_operador')
  async handleMensajeOperador(
    @MessageBody() data: { conversacion_id: number; contenido: string },
    @ConnectedSocket() client: Socket,
  ) {
    const operadorId = this.operadores.get(client.id);
    if (!operadorId) {
      client.emit('error', { mensaje: 'No estás registrado como operador' });
      return;
    }

    try {
      const mensaje = await this.liveChatService.guardarMensaje({
        conversacion_id: data.conversacion_id,
        remitente_id: operadorId,
        tipo_remitente: 'OPERATOR',
        contenido: data.contenido,
      });

      // Enviar a todos en la conversación
      this.server.to(`conv:${data.conversacion_id}`).emit('nuevo_mensaje', {
        ...mensaje,
        conversacion_id: data.conversacion_id,
      });
    } catch (error) {
      this.logger.error('Error enviando mensaje', error);
      client.emit('error', { mensaje: 'No se pudo enviar el mensaje' });
    }
  }

  /**
   * Operador cierra conversación
   */
  @SubscribeMessage('cerrar_conversacion')
  async handleCerrarConversacion(
    @MessageBody() data: { conversacion_id: number },
    @ConnectedSocket() client: Socket,
  ) {
    const operadorId = this.operadores.get(client.id);
    if (!operadorId) {
      client.emit('error', { mensaje: 'No estás registrado como operador' });
      return;
    }

    try {
      await this.liveChatService.cerrarConversacion(data.conversacion_id);

      // Notificar a todos
      this.server.to(`conv:${data.conversacion_id}`).emit('conversacion_cerrada', {
        conversacion_id: data.conversacion_id,
        mensaje: 'La conversación ha sido cerrada. ¡Gracias por contactarnos!',
      });

      // Actualizar clientes que estaban en esta conversación
      for (const [socketId, info] of this.clientes) {
        if (info.conversacion_id === data.conversacion_id && !info.es_operador) {
          info.modo = 'BOT';
          info.conversacion_id = undefined;
          this.clientes.set(socketId, info);
        }
      }
    } catch (error) {
      this.logger.error('Error cerrando conversación', error);
      client.emit('error', { mensaje: 'No se pudo cerrar la conversación' });
    }
  }

  /**
   * Operador solicita lista de pendientes
   */
  @SubscribeMessage('obtener_pendientes')
  async handleObtenerPendientes(@ConnectedSocket() client: Socket) {
    const operadorId = this.operadores.get(client.id);
    if (!operadorId) {
      client.emit('error', { mensaje: 'No estás registrado como operador' });
      return;
    }

    const pendientes = await this.liveChatService.obtenerConversacionesPendientes();
    const misConversaciones = await this.liveChatService.obtenerConversacionesOperador(operadorId);
    const stats = await this.liveChatService.obtenerEstadisticas();

    client.emit('lista_conversaciones', {
      pendientes,
      mis_conversaciones: misConversaciones,
      estadisticas: stats,
    });
  }

  // =====================================================
  // HELPERS
  // =====================================================

  /**
   * Envía mensaje de usuario al operador
   */
  private async enviarAlOperador(
    conversacionId: number,
    data: { contenido: string; remitente_id?: number; nombre: string },
  ) {
    try {
      const mensaje = await this.liveChatService.guardarMensaje({
        conversacion_id: conversacionId,
        remitente_id: data.remitente_id,
        tipo_remitente: 'USER',
        contenido: data.contenido,
      });

      this.server.to(`conv:${conversacionId}`).emit('nuevo_mensaje', {
        ...mensaje,
        conversacion_id: conversacionId,
      });
    } catch (error) {
      this.logger.error('Error enviando mensaje al operador', error);
    }
  }

  /**
   * Estadísticas de conexiones
   */
  getEstadisticasConexiones() {
    const usuarios = Array.from(this.clientes.values()).filter((c) => !c.es_operador);
    const operadoresConectados = Array.from(this.clientes.values()).filter((c) => c.es_operador);

    return {
      total_clientes: this.clientes.size,
      usuarios: usuarios.length,
      operadores: operadoresConectados.length,
      usuarios_en_handoff: usuarios.filter((u) => u.modo === 'HANDOFF').length,
    };
  }
}
