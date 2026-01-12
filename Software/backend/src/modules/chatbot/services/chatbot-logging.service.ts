import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { LogChatMessageDto } from '../dto/log-chat-message.dto';

@Injectable()
export class ChatbotLoggingService {
    private readonly logger = new Logger(ChatbotLoggingService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Guarda un mensaje del chatbot en la BD
     */
    async logMessage(data: LogChatMessageDto): Promise<void> {
        try {
            // Buscar o crear conversación
            let conversacion = await this.prisma.conversacionChatbot.findUnique({
                where: { session_id: data.sessionId },
            });

            if (!conversacion) {
                conversacion = await this.prisma.conversacionChatbot.create({
                    data: {
                        session_id: data.sessionId,
                        codigo_paciente: data.userId,
                        fecha_inicio: new Date(),
                    },
                });
                this.logger.log(`Nueva conversación creada: ${conversacion.codigo_conversacion}`);
            } else {
                // Actualizar fecha último mensaje
                await this.prisma.conversacionChatbot.update({
                    where: { codigo_conversacion: conversacion.codigo_conversacion },
                    data: { fecha_ultimo_msg: new Date() },
                });
            }

            // Guardar mensaje
            await this.prisma.mensajeChatbot.create({
                data: {
                    codigo_conversacion: conversacion.codigo_conversacion,
                    remitente: data.sender,
                    contenido: data.message,
                    intent: data.intent,
                    confianza: data.confidence,
                    timestamp: new Date(),
                },
            });
        } catch (error) {
            this.logger.error('Error logging chat message:', error);
            // No lanzar error para no afectar UX
        }
    }

    /**
     * Obtiene el historial completo de una conversación
     */
    async getConversationHistory(sessionId: string) {
        return this.prisma.conversacionChatbot.findUnique({
            where: { session_id: sessionId },
            include: {
                mensajes: {
                    orderBy: { timestamp: 'asc' },
                },
                paciente: {
                    select: {
                        codigo_usuario: true,
                        nombres: true,
                        apellidos: true,
                        email: true,
                    },
                },
            },
        });
    }

    /**
     * Lista todas las conversaciones con filtros y paginación
     */
    async getAllConversations(filters?: {
        codigoPaciente?: number;
        activa?: boolean;
        fechaDesde?: Date;
        fechaHasta?: Date;
        page?: number;
        limit?: number;
    }) {
        const where: any = {};

        if (filters?.codigoPaciente) {
            where.codigo_paciente = filters.codigoPaciente;
        }

        if (filters?.activa !== undefined) {
            where.activa = filters.activa;
        }

        if (filters?.fechaDesde || filters?.fechaHasta) {
            where.fecha_inicio = {};
            if (filters.fechaDesde) {
                where.fecha_inicio.gte = filters.fechaDesde;
            }
            if (filters.fechaHasta) {
                where.fecha_inicio.lte = filters.fechaHasta;
            }
        }

        const page = filters?.page || 1;
        const limit = filters?.limit || 20;
        const skip = (page - 1) * limit;

        const [conversaciones, total] = await Promise.all([
            this.prisma.conversacionChatbot.findMany({
                where,
                include: {
                    paciente: {
                        select: {
                            codigo_usuario: true,
                            nombres: true,
                            apellidos: true,
                            email: true,
                        },
                    },
                    _count: {
                        select: { mensajes: true },
                    },
                },
                orderBy: { fecha_inicio: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.conversacionChatbot.count({ where }),
        ]);

        return {
            conversaciones,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Obtiene los mensajes de una conversación específica
     */
    async getConversationMessages(conversacionId: number) {
        const conversacion = await this.prisma.conversacionChatbot.findUnique({
            where: { codigo_conversacion: conversacionId },
            include: {
                mensajes: {
                    orderBy: { timestamp: 'asc' },
                },
                paciente: {
                    select: {
                        codigo_usuario: true,
                        nombres: true,
                        apellidos: true,
                        email: true,
                    },
                },
            },
        });

        return conversacion;
    }

    /**
     * Obtiene estadísticas y analytics del chatbot
     */
    async getChatbotAnalytics() {
        const totalConversaciones = await this.prisma.conversacionChatbot.count();
        const conversacionesActivas = await this.prisma.conversacionChatbot.count({
            where: { activa: true },
        });
        const totalMensajes = await this.prisma.mensajeChatbot.count();

        // Intents más usados
        const intentsData = await this.prisma.mensajeChatbot.groupBy({
            by: ['intent'],
            _count: { intent: true },
            where: { intent: { not: null } },
            orderBy: { _count: { intent: 'desc' } },
            take: 10,
        });

        // Confianza promedio
        const avgConfidence = await this.prisma.mensajeChatbot.aggregate({
            _avg: { confianza: true },
            where: { confianza: { not: null } },
        });

        return {
            totalConversaciones,
            conversacionesActivas,
            totalMensajes,
            promedioMensajesPorConversacion:
                totalConversaciones > 0
                    ? (totalMensajes / totalConversaciones).toFixed(2)
                    : '0',
            intentsPopulares: intentsData.map((i) => ({
                intent: i.intent,
                count: i._count.intent,
            })),
            confianzaPromedio: avgConfidence._avg.confianza
                ? Number(avgConfidence._avg.confianza.toFixed(2))
                : null,
        };
    }

    /**
     * Cierra una conversación (marca como no activa)
     */
    async closeConversation(sessionId: string) {
        return this.prisma.conversacionChatbot.update({
            where: { session_id: sessionId },
            data: { activa: false },
        });
    }
}
