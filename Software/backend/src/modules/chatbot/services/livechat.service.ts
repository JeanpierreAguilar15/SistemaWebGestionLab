import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

/**
 * Estados de conversación para handoff
 */
export enum ConversationStatus {
    ACTIVA = 'ACTIVA',
    ESPERANDO_OPERADOR = 'ESPERANDO_OPERADOR',
    ATENDIDA = 'ATENDIDA',
    CERRADA = 'CERRADA',
}

/**
 * Interface para conversación activa en memoria
 */
interface ActiveConversation {
    conversationId: number;
    sessionId: string;
    userId?: number;
    userName?: string;
    status: ConversationStatus;
    operatorId?: number;
    operatorName?: string;
    startTime: Date;
    lastActivity: Date;
    unreadCount: number;
}

/**
 * LiveChatService
 *
 * Maneja la lógica de handoff (transferencia) de conversaciones
 * del chatbot a operadores humanos.
 *
 * Cumple con HU-24: Comunicación en tiempo real + Handoff
 */
@Injectable()
export class LiveChatService {
    private readonly logger = new Logger(LiveChatService.name);

    // Cache de conversaciones activas para rendimiento
    private activeConversations = new Map<string, ActiveConversation>();

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Solicita transferencia a operador humano
     * Crea o actualiza una conversación en estado ESPERANDO_OPERADOR
     */
    async requestHandoff(data: {
        sessionId: string;
        userId?: number;
        userName?: string;
        reason?: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<{ conversationId: number; position: number }> {
        this.logger.log(`Handoff requested for session: ${data.sessionId}`);

        // Buscar conversación existente o crear una nueva
        let conversation = await this.prisma.conversacion.findFirst({
            where: {
                tipo: 'CHAT',
                estado: { in: ['ACTIVA', 'ESPERANDO_OPERADOR'] },
                // Buscar por usuario si está autenticado
                ...(data.userId ? { codigo_usuario: data.userId } : {}),
            },
            orderBy: { fecha_inicio: 'desc' },
        });

        if (!conversation) {
            // Crear nueva conversación
            conversation = await this.prisma.conversacion.create({
                data: {
                    codigo_usuario: data.userId || null,
                    tipo: 'CHAT',
                    estado: ConversationStatus.ESPERANDO_OPERADOR,
                    transferida_a_humano: true,
                    fecha_transferencia: new Date(),
                    ip_address: data.ipAddress,
                    user_agent: data.userAgent,
                },
            });

            // Agregar mensaje de solicitud
            await this.prisma.mensaje.create({
                data: {
                    codigo_conversacion: conversation.codigo_conversacion,
                    remitente: 'SISTEMA',
                    contenido: data.reason || 'Usuario solicitó hablar con un operador',
                    tipo_contenido: 'SISTEMA',
                },
            });
        } else {
            // Actualizar conversación existente
            await this.prisma.conversacion.update({
                where: { codigo_conversacion: conversation.codigo_conversacion },
                data: {
                    estado: ConversationStatus.ESPERANDO_OPERADOR,
                    transferida_a_humano: true,
                    fecha_transferencia: new Date(),
                },
            });
        }

        // Guardar en cache
        this.activeConversations.set(data.sessionId, {
            conversationId: conversation.codigo_conversacion,
            sessionId: data.sessionId,
            userId: data.userId,
            userName: data.userName || 'Usuario Anónimo',
            status: ConversationStatus.ESPERANDO_OPERADOR,
            startTime: conversation.fecha_inicio,
            lastActivity: new Date(),
            unreadCount: 1,
        });

        // Calcular posición en cola
        const position = await this.getQueuePosition(conversation.codigo_conversacion);

        return {
            conversationId: conversation.codigo_conversacion,
            position,
        };
    }

    /**
     * Operador toma una conversación
     */
    async assignOperator(conversationId: number, operatorId: number): Promise<ActiveConversation | null> {
        this.logger.log(`Operator ${operatorId} taking conversation ${conversationId}`);

        const conversation = await this.prisma.conversacion.update({
            where: { codigo_conversacion: conversationId },
            data: {
                estado: ConversationStatus.ATENDIDA,
                atendido_por: operatorId,
            },
            include: {
                usuario: { select: { nombres: true, apellidos: true } },
                operador: { select: { nombres: true, apellidos: true } },
            },
        });

        // Mensaje de sistema
        await this.prisma.mensaje.create({
            data: {
                codigo_conversacion: conversationId,
                remitente: 'SISTEMA',
                contenido: `${conversation.operador?.nombres || 'Un operador'} se ha unido a la conversación`,
                tipo_contenido: 'SISTEMA',
            },
        });

        // Actualizar cache
        const sessionEntry = Array.from(this.activeConversations.entries())
            .find(([_, v]) => v.conversationId === conversationId);

        if (sessionEntry) {
            const [sessionId, conv] = sessionEntry;
            conv.status = ConversationStatus.ATENDIDA;
            conv.operatorId = operatorId;
            conv.operatorName = `${conversation.operador?.nombres} ${conversation.operador?.apellidos}`;
            this.activeConversations.set(sessionId, conv);
            return conv;
        }

        return null;
    }

    /**
     * Envía un mensaje en una conversación
     */
    async sendMessage(data: {
        conversationId: number;
        senderId: number;
        senderType: 'USER' | 'OPERATOR';
        content: string;
    }): Promise<any> {
        const message = await this.prisma.mensaje.create({
            data: {
                codigo_conversacion: data.conversationId,
                remitente: data.senderType,
                codigo_remitente: data.senderId,
                contenido: data.content,
                tipo_contenido: 'TEXTO',
            },
            include: {
                usuario: { select: { nombres: true, apellidos: true } },
            },
        });

        // Actualizar última actividad de la conversación
        await this.prisma.conversacion.update({
            where: { codigo_conversacion: data.conversationId },
            data: { fecha_fin: null }, // Conversación sigue activa
        });

        return {
            id: message.codigo_mensaje,
            content: message.contenido,
            senderType: message.remitente,
            senderName: message.usuario
                ? `${message.usuario.nombres} ${message.usuario.apellidos}`
                : (data.senderType === 'USER' ? 'Usuario' : 'Operador'),
            timestamp: message.fecha_envio,
        };
    }

    /**
     * Cierra una conversación
     */
    async closeConversation(conversationId: number, closedBy: number): Promise<void> {
        await this.prisma.conversacion.update({
            where: { codigo_conversacion: conversationId },
            data: {
                estado: ConversationStatus.CERRADA,
                fecha_fin: new Date(),
            },
        });

        // Mensaje de cierre
        await this.prisma.mensaje.create({
            data: {
                codigo_conversacion: conversationId,
                remitente: 'SISTEMA',
                contenido: 'La conversación ha sido cerrada',
                tipo_contenido: 'SISTEMA',
            },
        });

        // Remover del cache
        const sessionEntry = Array.from(this.activeConversations.entries())
            .find(([_, v]) => v.conversationId === conversationId);

        if (sessionEntry) {
            this.activeConversations.delete(sessionEntry[0]);
        }

        this.logger.log(`Conversation ${conversationId} closed by ${closedBy}`);
    }

    /**
     * Obtiene conversaciones pendientes (esperando operador)
     */
    async getPendingConversations(): Promise<any[]> {
        const conversations = await this.prisma.conversacion.findMany({
            where: {
                tipo: 'CHAT',
                estado: ConversationStatus.ESPERANDO_OPERADOR,
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

        return conversations.map((conv, index) => ({
            id: conv.codigo_conversacion,
            userId: conv.codigo_usuario,
            userName: conv.usuario
                ? `${conv.usuario.nombres} ${conv.usuario.apellidos}`
                : 'Usuario Anónimo',
            userEmail: conv.usuario?.email,
            status: conv.estado,
            waitingSince: conv.fecha_transferencia,
            queuePosition: index + 1,
            lastMessage: conv.mensajes[0]?.contenido || 'Sin mensajes',
            ipAddress: conv.ip_address,
        }));
    }

    /**
     * Obtiene conversaciones activas de un operador
     */
    async getOperatorConversations(operatorId: number): Promise<any[]> {
        const conversations = await this.prisma.conversacion.findMany({
            where: {
                tipo: 'CHAT',
                estado: ConversationStatus.ATENDIDA,
                atendido_por: operatorId,
            },
            include: {
                usuario: { select: { nombres: true, apellidos: true, email: true } },
                mensajes: {
                    orderBy: { fecha_envio: 'desc' },
                    take: 1,
                },
            },
            orderBy: { fecha_inicio: 'desc' },
        });

        return conversations.map(conv => ({
            id: conv.codigo_conversacion,
            userId: conv.codigo_usuario,
            userName: conv.usuario
                ? `${conv.usuario.nombres} ${conv.usuario.apellidos}`
                : 'Usuario Anónimo',
            userEmail: conv.usuario?.email,
            status: conv.estado,
            startTime: conv.fecha_inicio,
            lastMessage: conv.mensajes[0]?.contenido || 'Sin mensajes',
            lastMessageTime: conv.mensajes[0]?.fecha_envio,
        }));
    }

    /**
     * Obtiene historial de mensajes de una conversación
     */
    async getConversationMessages(conversationId: number, limit: number = 50): Promise<any[]> {
        const messages = await this.prisma.mensaje.findMany({
            where: { codigo_conversacion: conversationId },
            include: {
                usuario: { select: { nombres: true, apellidos: true } },
            },
            orderBy: { fecha_envio: 'asc' },
            take: limit,
        });

        return messages.map(msg => ({
            id: msg.codigo_mensaje,
            content: msg.contenido,
            senderType: msg.remitente,
            senderName: msg.usuario
                ? `${msg.usuario.nombres} ${msg.usuario.apellidos}`
                : (msg.remitente === 'USER' ? 'Usuario' : msg.remitente === 'OPERATOR' ? 'Operador' : 'Sistema'),
            timestamp: msg.fecha_envio,
            read: msg.leido,
        }));
    }

    /**
     * Marca mensajes como leídos
     */
    async markMessagesAsRead(conversationId: number, readBy: 'USER' | 'OPERATOR'): Promise<void> {
        const senderToMark = readBy === 'USER' ? 'OPERATOR' : 'USER';

        await this.prisma.mensaje.updateMany({
            where: {
                codigo_conversacion: conversationId,
                remitente: senderToMark,
                leido: false,
            },
            data: { leido: true },
        });
    }

    /**
     * Obtiene estadísticas del chat en vivo
     */
    async getLiveChatStats(): Promise<{
        pending: number;
        active: number;
        closedToday: number;
        avgWaitTime: number;
    }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [pending, active, closedToday] = await Promise.all([
            this.prisma.conversacion.count({
                where: { tipo: 'CHAT', estado: ConversationStatus.ESPERANDO_OPERADOR },
            }),
            this.prisma.conversacion.count({
                where: { tipo: 'CHAT', estado: ConversationStatus.ATENDIDA },
            }),
            this.prisma.conversacion.count({
                where: {
                    tipo: 'CHAT',
                    estado: ConversationStatus.CERRADA,
                    fecha_fin: { gte: today },
                },
            }),
        ]);

        // Calcular tiempo de espera promedio (simplificado)
        const avgWaitTime = 5; // TODO: Calcular real

        return { pending, active, closedToday, avgWaitTime };
    }

    /**
     * Obtiene posición en cola de espera
     */
    private async getQueuePosition(conversationId: number): Promise<number> {
        const pendingBefore = await this.prisma.conversacion.count({
            where: {
                tipo: 'CHAT',
                estado: ConversationStatus.ESPERANDO_OPERADOR,
                codigo_conversacion: { lt: conversationId },
            },
        });
        return pendingBefore + 1;
    }

    /**
     * Obtiene conversación por sessionId
     */
    async getConversationBySession(sessionId: string): Promise<ActiveConversation | null> {
        return this.activeConversations.get(sessionId) || null;
    }
}
