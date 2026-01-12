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
import { ChatbotService } from '../services/chatbot.service';
import { LiveChatService, ConversationStatus } from '../services/livechat.service';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { EventsGateway } from '../../events/events.gateway';

/**
 * Tipos de cliente conectado
 */
interface ConnectedClient {
    socketId: string;
    sessionId: string;
    userId?: number;
    userName?: string;
    isOperator: boolean;
    conversationId?: number;
    mode: 'BOT' | 'HUMAN';
}

/**
 * ChatGateway - Gateway WebSocket para chat en tiempo real
 *
 * Soporta dos modos:
 * 1. BOT: Mensajes procesados por ChatbotService (Dialogflow/local)
 * 2. HUMAN: Mensajes enviados a operador humano (handoff)
 *
 * Cumple con HU-24: Comunicación en tiempo real + Handoff
 */
@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'chatbot',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    // Clientes conectados
    private connectedClients = new Map<string, ConnectedClient>();

    // Operadores conectados (socketId -> operatorId)
    private connectedOperators = new Map<string, number>();

    constructor(
        private readonly chatbotService: ChatbotService,
        private readonly liveChatService: LiveChatService,
        @Inject(forwardRef(() => EventsGateway))
        private readonly eventsGateway: EventsGateway,
    ) {}

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);

        // Registrar cliente básico
        this.connectedClients.set(client.id, {
            socketId: client.id,
            sessionId: client.id,
            isOperator: false,
            mode: 'BOT',
        });
    }

    handleDisconnect(client: Socket) {
        const clientInfo = this.connectedClients.get(client.id);
        this.connectedClients.delete(client.id);
        this.connectedOperators.delete(client.id);

        this.logger.log(`Client disconnected: ${client.id} (${clientInfo?.isOperator ? 'Operator' : 'User'})`);

        // Si era un usuario en conversación con operador, notificar
        if (clientInfo?.conversationId && !clientInfo.isOperator) {
            this.notifyOperatorsUserDisconnected(clientInfo.conversationId);
        }
    }

    /**
     * Usuario se registra con su sessionId
     */
    @SubscribeMessage('register')
    handleRegister(
        @MessageBody() data: { sessionId: string; userId?: number; userName?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const clientInfo = this.connectedClients.get(client.id);
        if (clientInfo) {
            clientInfo.sessionId = data.sessionId;
            clientInfo.userId = data.userId;
            clientInfo.userName = data.userName || 'Usuario';
            this.connectedClients.set(client.id, clientInfo);
        }

        // Unir a room de sesión
        client.join(`session:${data.sessionId}`);

        this.logger.log(`Client ${client.id} registered with session: ${data.sessionId}`);

        client.emit('registered', { sessionId: data.sessionId });
    }

    /**
     * Operador se registra
     */
    @SubscribeMessage('operator_register')
    handleOperatorRegister(
        @MessageBody() data: { operatorId: number; operatorName: string },
        @ConnectedSocket() client: Socket,
    ) {
        const clientInfo = this.connectedClients.get(client.id);
        if (clientInfo) {
            clientInfo.isOperator = true;
            clientInfo.userId = data.operatorId;
            clientInfo.userName = data.operatorName;
            this.connectedClients.set(client.id, clientInfo);
        }

        this.connectedOperators.set(client.id, data.operatorId);

        // Unir a room de operadores
        client.join('operators');

        this.logger.log(`Operator ${data.operatorId} (${data.operatorName}) connected`);

        client.emit('operator_registered', {
            operatorId: data.operatorId,
            operatorName: data.operatorName,
        });
    }

    /**
     * Mensaje de usuario (puede ir al bot o al operador)
     */
    @SubscribeMessage('message')
    async handleMessage(
        @MessageBody() data: { content: string; sessionId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const clientInfo = this.connectedClients.get(client.id);
        const sessionId = data.sessionId || clientInfo?.sessionId || client.id;

        // Verificar si está en modo humano
        if (clientInfo?.mode === 'HUMAN' && clientInfo.conversationId) {
            // Enviar mensaje al operador
            await this.sendToOperator(clientInfo.conversationId, {
                content: data.content,
                senderId: clientInfo.userId,
                senderName: clientInfo.userName || 'Usuario',
                timestamp: new Date(),
            });
            return;
        }

        // Modo BOT: procesar con chatbot
        const response = await this.chatbotService.processMessage(
            sessionId,
            data.content,
            clientInfo?.userId,
        );

        // Enviar respuesta al cliente
        client.emit('response', {
            ...response,
            sessionId,
            timestamp: new Date(),
        });
    }

    /**
     * Usuario solicita hablar con humano (handoff)
     */
    @SubscribeMessage('request_handoff')
    async handleRequestHandoff(
        @MessageBody() data: { reason?: string; sessionId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const clientInfo = this.connectedClients.get(client.id);
        const sessionId = data.sessionId || clientInfo?.sessionId || client.id;

        this.logger.log(`Handoff requested by session: ${sessionId}`);

        try {
            // Crear solicitud de handoff
            const result = await this.liveChatService.requestHandoff({
                sessionId,
                userId: clientInfo?.userId,
                userName: clientInfo?.userName,
                reason: data.reason,
            });

            // Actualizar estado del cliente
            if (clientInfo) {
                clientInfo.mode = 'HUMAN';
                clientInfo.conversationId = result.conversationId;
                this.connectedClients.set(client.id, clientInfo);
            }

            // Unir a room de conversación
            client.join(`conversation:${result.conversationId}`);

            // Notificar al usuario
            client.emit('handoff_queued', {
                conversationId: result.conversationId,
                position: result.position,
                message: `Tu solicitud ha sido registrada. Posición en cola: ${result.position}. Un operador te atenderá pronto.`,
            });

            // Notificar a operadores
            this.notifyNewHandoffRequest({
                conversationId: result.conversationId,
                sessionId,
                userName: clientInfo?.userName || 'Usuario Anónimo',
                reason: data.reason,
            });

        } catch (error) {
            this.logger.error(`Handoff request failed: ${error.message}`);
            client.emit('handoff_error', {
                message: 'No se pudo procesar tu solicitud. Por favor intenta de nuevo.',
            });
        }
    }

    /**
     * Usuario cancela solicitud de handoff
     */
    @SubscribeMessage('cancel_handoff')
    async handleCancelHandoff(@ConnectedSocket() client: Socket) {
        const clientInfo = this.connectedClients.get(client.id);

        if (clientInfo) {
            clientInfo.mode = 'BOT';
            clientInfo.conversationId = undefined;
            this.connectedClients.set(client.id, clientInfo);
        }

        client.emit('handoff_cancelled', {
            message: 'Has vuelto al modo de asistente virtual.',
        });
    }

    /**
     * Operador toma una conversación
     */
    @SubscribeMessage('operator_take_conversation')
    async handleOperatorTakeConversation(
        @MessageBody() data: { conversationId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const operatorId = this.connectedOperators.get(client.id);
        if (!operatorId) {
            client.emit('error', { message: 'No estás registrado como operador' });
            return;
        }

        try {
            const conversation = await this.liveChatService.assignOperator(
                data.conversationId,
                operatorId,
            );

            // Unir operador a room de conversación
            client.join(`conversation:${data.conversationId}`);

            // Obtener historial
            const messages = await this.liveChatService.getConversationMessages(data.conversationId);

            // Notificar al operador
            client.emit('conversation_assigned', {
                conversationId: data.conversationId,
                conversation,
                messages,
            });

            // Notificar al usuario
            this.server.to(`conversation:${data.conversationId}`).emit('operator_joined', {
                operatorName: conversation?.operatorName || 'Operador',
                message: 'Un operador se ha unido a la conversación.',
            });

            // Notificar a otros operadores que ya fue tomada
            this.server.to('operators').emit('conversation_taken', {
                conversationId: data.conversationId,
                operatorId,
            });

        } catch (error) {
            this.logger.error(`Failed to assign conversation: ${error.message}`);
            client.emit('error', { message: 'No se pudo tomar la conversación' });
        }
    }

    /**
     * Operador envía mensaje
     */
    @SubscribeMessage('operator_message')
    async handleOperatorMessage(
        @MessageBody() data: { conversationId: number; content: string },
        @ConnectedSocket() client: Socket,
    ) {
        const operatorId = this.connectedOperators.get(client.id);
        if (!operatorId) {
            client.emit('error', { message: 'No estás registrado como operador' });
            return;
        }

        try {
            const message = await this.liveChatService.sendMessage({
                conversationId: data.conversationId,
                senderId: operatorId,
                senderType: 'OPERATOR',
                content: data.content,
            });

            // Enviar a todos en la conversación (usuario y otros operadores)
            this.server.to(`conversation:${data.conversationId}`).emit('new_message', {
                ...message,
                conversationId: data.conversationId,
            });

        } catch (error) {
            this.logger.error(`Failed to send operator message: ${error.message}`);
            client.emit('error', { message: 'No se pudo enviar el mensaje' });
        }
    }

    /**
     * Operador cierra conversación
     */
    @SubscribeMessage('operator_close_conversation')
    async handleOperatorCloseConversation(
        @MessageBody() data: { conversationId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const operatorId = this.connectedOperators.get(client.id);
        if (!operatorId) {
            client.emit('error', { message: 'No estás registrado como operador' });
            return;
        }

        try {
            await this.liveChatService.closeConversation(data.conversationId, operatorId);

            // Notificar a todos en la conversación
            this.server.to(`conversation:${data.conversationId}`).emit('conversation_closed', {
                conversationId: data.conversationId,
                message: 'La conversación ha sido cerrada. Gracias por contactarnos.',
            });

            // Actualizar clientes conectados
            this.connectedClients.forEach((clientInfo, socketId) => {
                if (clientInfo.conversationId === data.conversationId) {
                    clientInfo.mode = 'BOT';
                    clientInfo.conversationId = undefined;
                    this.connectedClients.set(socketId, clientInfo);
                }
            });

        } catch (error) {
            this.logger.error(`Failed to close conversation: ${error.message}`);
            client.emit('error', { message: 'No se pudo cerrar la conversación' });
        }
    }

    /**
     * Operador solicita lista de conversaciones pendientes
     */
    @SubscribeMessage('get_pending_conversations')
    async handleGetPendingConversations(@ConnectedSocket() client: Socket) {
        const operatorId = this.connectedOperators.get(client.id);
        if (!operatorId) {
            client.emit('error', { message: 'No estás registrado como operador' });
            return;
        }

        const pending = await this.liveChatService.getPendingConversations();
        const myConversations = await this.liveChatService.getOperatorConversations(operatorId);
        const stats = await this.liveChatService.getLiveChatStats();

        client.emit('pending_conversations', {
            pending,
            myConversations,
            stats,
        });
    }

    /**
     * Usuario envía mensaje en conversación con operador
     */
    private async sendToOperator(conversationId: number, data: {
        content: string;
        senderId?: number;
        senderName: string;
        timestamp: Date;
    }) {
        try {
            const message = await this.liveChatService.sendMessage({
                conversationId,
                senderId: data.senderId || 0,
                senderType: 'USER',
                content: data.content,
            });

            // Enviar a todos en la conversación
            this.server.to(`conversation:${conversationId}`).emit('new_message', {
                ...message,
                conversationId,
            });

        } catch (error) {
            this.logger.error(`Failed to send user message: ${error.message}`);
        }
    }

    /**
     * Notifica a operadores sobre nueva solicitud de handoff
     */
    private notifyNewHandoffRequest(data: {
        conversationId: number;
        sessionId: string;
        userName: string;
        reason?: string;
    }) {
        this.server.to('operators').emit('new_handoff_request', {
            ...data,
            timestamp: new Date(),
        });

        // También notificar vía EventsGateway a admins
        try {
            this.eventsGateway.broadcastSystemMessage({
                type: 'info',
                message: `Nueva solicitud de chat: ${data.userName}`,
                targetRole: 'ADMIN',
            });
        } catch (error) {
            // EventsGateway puede no estar disponible
        }
    }

    /**
     * Notifica a operadores que un usuario se desconectó
     */
    private notifyOperatorsUserDisconnected(conversationId: number) {
        this.server.to(`conversation:${conversationId}`).emit('user_disconnected', {
            conversationId,
            message: 'El usuario se ha desconectado',
            timestamp: new Date(),
        });
    }

    /**
     * Obtener estadísticas de conexiones
     */
    getConnectionStats() {
        const users = Array.from(this.connectedClients.values()).filter(c => !c.isOperator);
        const operators = Array.from(this.connectedClients.values()).filter(c => c.isOperator);

        return {
            totalClients: this.connectedClients.size,
            users: users.length,
            operators: operators.length,
            usersInHandoff: users.filter(u => u.mode === 'HUMAN').length,
        };
    }
}
