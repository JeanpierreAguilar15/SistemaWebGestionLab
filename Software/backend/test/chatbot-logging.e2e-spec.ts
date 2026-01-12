import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Chatbot Logging (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let testSessionId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ transform: true }));
        await app.init();

        prisma = app.get<PrismaService>(PrismaService);
        testSessionId = `test-session-${Date.now()}`;
    });

    afterAll(async () => {
        // Limpiar datos de prueba
        await prisma.mensajeChatbot.deleteMany({
            where: {
                conversacion: {
                    session_id: testSessionId,
                },
            },
        });
        await prisma.conversacionChatbot.deleteMany({
            where: {
                session_id: testSessionId,
            },
        });
        await app.close();
    });

    describe('POST /api/chatbot/log', () => {
        it('should log a user message and create conversation', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/chatbot/log')
                .send({
                    sessionId: testSessionId,
                    message: 'Hola, necesito información sobre precios',
                    sender: 'USER',
                })
                .expect(201);

            expect(response.body).toEqual({ success: true });

            // Verificar en BD
            const conversacion = await prisma.conversacionChatbot.findUnique({
                where: { session_id: testSessionId },
                include: { mensajes: true },
            });

            expect(conversacion).toBeDefined();
            expect(conversacion.mensajes).toHaveLength(1);
            expect(conversacion.mensajes[0].remitente).toBe('USER');
            expect(conversacion.mensajes[0].contenido).toContain('precios');
        });

        it('should log a bot response to existing conversation', async () => {
            await request(app.getHttpServer())
                .post('/api/chatbot/log')
                .send({
                    sessionId: testSessionId,
                    message: 'El examen de hemograma cuesta S/. 25.00',
                    sender: 'BOT',
                    intent: 'consultar_precio',
                    confidence: 0.95,
                })
                .expect(201);

            // Verificar que se agregó a la conversación existente
            const conversacion = await prisma.conversacionChatbot.findUnique({
                where: { session_id: testSessionId },
                include: { mensajes: { orderBy: { timestamp: 'asc' } } },
            });

            expect(conversacion.mensajes).toHaveLength(2);
            expect(conversacion.mensajes[1].remitente).toBe('BOT');
            expect(conversacion.mensajes[1].intent).toBe('consultar_precio');
            expect(Number(conversacion.mensajes[1].confianza)).toBe(0.95);
        });

        it('should validate required fields', async () => {
            await request(app.getHttpServer())
                .post('/api/chatbot/log')
                .send({
                    sessionId: testSessionId,
                    // missing message
                    sender: 'USER',
                })
                .expect(400);
        });

        it('should validate sender enum', async () => {
            await request(app.getHttpServer())
                .post('/api/chatbot/log')
                .send({
                    sessionId: testSessionId,
                    message: 'Test',
                    sender: 'INVALID',
                })
                .expect(400);
        });
    });

    describe('GET /api/admin/chatbot/analytics', () => {
        it('should return analytics without auth (will fail with 401)', async () => {
            await request(app.getHttpServer())
                .get('/api/admin/chatbot/analytics')
                .expect(401);
        });

        // Nota: Para probar con auth, necesitarías generar un token JWT válido
        // con rol ADMINISTRADOR aquí
    });

    describe('Integration: Full conversation flow', () => {
        it('should handle multiple messages in sequence', async () => {
            const sessionId = `test-flow-${Date.now()}`;
            const messages = [
                { message: '¿Dónde están ubicados?', sender: 'USER' },
                { message: 'Tenemos 3 sedes en Lima', sender: 'BOT', intent: 'consultar_sedes' },
                { message: '¿Cuál es su horario?', sender: 'USER' },
                { message: 'Atendemos de lunes a sábado de 7am a 7pm', sender: 'BOT' },
            ];

            for (const msg of messages) {
                await request(app.getHttpServer())
                    .post('/api/chatbot/log')
                    .send({ sessionId, ...msg })
                    .expect(201);
            }

            const conversacion = await prisma.conversacionChatbot.findUnique({
                where: { session_id: sessionId },
                include: { mensajes: { orderBy: { timestamp: 'asc' } } },
            });

            expect(conversacion.mensajes).toHaveLength(4);
            expect(conversacion.mensajes[0].remitente).toBe('USER');
            expect(conversacion.mensajes[1].remitente).toBe('BOT');
            expect(conversacion.fecha_inicio).toBeDefined();
            expect(conversacion.fecha_ultimo_msg.getTime()).toBeGreaterThan(
                conversacion.fecha_inicio.getTime(),
            );

            // Cleanup
            await prisma.mensajeChatbot.deleteMany({
                where: { codigo_conversacion: conversacion.codigo_conversacion },
            });
            await prisma.conversacionChatbot.delete({
                where: { codigo_conversacion: conversacion.codigo_conversacion },
            });
        });
    });
});
