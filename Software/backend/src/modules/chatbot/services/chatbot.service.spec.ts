import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from './chatbot.service';
import { PrismaService } from '@prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SessionsClient } from '@google-cloud/dialogflow';

// Mock Dialogflow
jest.mock('@google-cloud/dialogflow', () => ({
    SessionsClient: jest.fn().mockImplementation(() => ({
        projectAgentSessionPath: jest.fn().mockReturnValue('mock-session-path'),
        detectIntent: jest.fn().mockResolvedValue([
            {
                queryResult: {
                    intent: { displayName: 'test_intent' },
                    intentDetectionConfidence: 0.9,
                    fulfillmentText: 'Respuesta de prueba',
                },
            },
        ]),
    })),
}));

describe('ChatbotService', () => {
    let service: ChatbotService;
    let prismaService: PrismaService;
    let configService: ConfigService;

    const mockConfig = {
        codigo_configuracion: 1,
        activo: true,
        nombre_agente: 'TestBot',
        mensaje_bienvenida: 'Hola',
        disclaimer_legal: 'Disclaimer',
        umbral_confianza: 0.7,
        permitir_acceso_resultados: false,
        mensaje_fallo: 'Fallo',
        contacto_soporte: 'Soporte',
    };

    const mockPrismaService = {
        configuracionChatbot: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        examen: {
            findFirst: jest.fn(),
        },
    };

    const mockConfigService = {
        get: jest.fn((key: string) => {
            if (key === 'DIALOGFLOW_PROJECT_ID') return 'test-project';
            if (key === 'GOOGLE_APPLICATION_CREDENTIALS') return 'test-creds.json';
            return null;
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatbotService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<ChatbotService>(ChatbotService);
        prismaService = module.get<PrismaService>(PrismaService);
        configService = module.get<ConfigService>(ConfigService);

        // Reset mocks
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('onModuleInit', () => {
        it('should initialize Dialogflow and ensure default config', async () => {
            mockPrismaService.configuracionChatbot.findFirst.mockResolvedValue(null);
            mockPrismaService.configuracionChatbot.create.mockResolvedValue(mockConfig);

            await service.onModuleInit();

            expect(configService.get).toHaveBeenCalledWith('DIALOGFLOW_PROJECT_ID');
            expect(mockPrismaService.configuracionChatbot.create).toHaveBeenCalled();
        });

        it('should not create config if it already exists', async () => {
            mockPrismaService.configuracionChatbot.findFirst.mockResolvedValue(mockConfig);

            await service.onModuleInit();

            expect(mockPrismaService.configuracionChatbot.create).not.toHaveBeenCalled();
        });
    });

    describe('processMessage', () => {
        it('should return system message if chatbot is inactive', async () => {
            mockPrismaService.configuracionChatbot.findFirst.mockResolvedValue({
                ...mockConfig,
                activo: false,
            });

            const result = await service.processMessage('session-1', 'Hola');

            expect(result.source).toBe('system');
            expect(result.text).toContain('desactivado');
        });

        it('should process message via Dialogflow if active', async () => {
            mockPrismaService.configuracionChatbot.findFirst.mockResolvedValue(mockConfig);
            // Ensure Dialogflow client is initialized
            await service.onModuleInit();

            const result = await service.processMessage('session-1', 'Hola');

            expect(result.source).toBe('dialogflow');
            expect(result.text).toBe('Respuesta de prueba');
            // Type guard for intent property (only present in dialogflow/local responses)
            if ('intent' in result) {
                expect(result.intent).toBe('test_intent');
            } else {
                fail('Expected result to have intent property');
            }
        });

        it('should return fallback message if confidence is low', async () => {
            mockPrismaService.configuracionChatbot.findFirst.mockResolvedValue({
                ...mockConfig,
                umbral_confianza: 0.95, // High threshold
            });
            await service.onModuleInit();

            const result = await service.processMessage('session-1', 'Hola');

            expect(result.source).toBe('fallback');
            expect(result.text).toBe(mockConfig.mensaje_fallo);
        });
        describe('interpretarResultado', () => {
            it('should return error if exam not found', async () => {
                mockPrismaService.examen.findFirst.mockResolvedValue(null);

                const result = await service.interpretarResultado('Inexistente', 100);

                expect(result.mensaje).toContain('no encontré información');
            });

            it('should return error if exam has no ranges', async () => {
                mockPrismaService.examen.findFirst.mockResolvedValue({
                    nombre: 'Sin Rango',
                    valor_referencia_min: null,
                    valor_referencia_max: null,
                });

                const result = await service.interpretarResultado('Sin Rango', 100);

                expect(result.mensaje).toContain('no tiene rangos numéricos');
            });

            it('should interpret LOW value correctly', async () => {
                mockPrismaService.examen.findFirst.mockResolvedValue({
                    nombre: 'Glucosa',
                    valor_referencia_min: 70,
                    valor_referencia_max: 100,
                    unidad_medida: 'mg/dL',
                });

                const result = await service.interpretarResultado('Glucosa', 50);

                expect(result.mensaje).toContain('BAJO');
                expect(result.mensaje).toContain('⚠️');
            });

            it('should interpret HIGH value correctly', async () => {
                mockPrismaService.examen.findFirst.mockResolvedValue({
                    nombre: 'Glucosa',
                    valor_referencia_min: 70,
                    valor_referencia_max: 100,
                    unidad_medida: 'mg/dL',
                });

                const result = await service.interpretarResultado('Glucosa', 150);

                expect(result.mensaje).toContain('ALTO');
                expect(result.mensaje).toContain('⚠️');
            });

            it('should interpret NORMAL value correctly', async () => {
                mockPrismaService.examen.findFirst.mockResolvedValue({
                    nombre: 'Glucosa',
                    valor_referencia_min: 70,
                    valor_referencia_max: 100,
                    unidad_medida: 'mg/dL',
                });

                const result = await service.interpretarResultado('Glucosa', 90);

                expect(result.mensaje).toContain('NORMAL');
                expect(result.mensaje).not.toContain('⚠️');
            });
        });
    });
});
