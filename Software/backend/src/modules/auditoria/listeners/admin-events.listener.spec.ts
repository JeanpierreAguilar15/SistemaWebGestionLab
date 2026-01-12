import { Test, TestingModule } from '@nestjs/testing';
import { AdminEventsListener } from './admin-events.listener';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminEventPayload } from '../../admin/admin-events.service';

describe('AdminEventsListener', () => {
  let listener: AdminEventsListener;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEventsListener,
        {
          provide: PrismaService,
          useValue: {
            logActividad: {
              create: jest.fn(),
            },
            logError: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    listener = module.get<AdminEventsListener>(AdminEventsListener);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handleAdminEvent', () => {
    it('should log admin event to LogActividad', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.user.created',
        entityType: 'user',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: { rol: 'Paciente', email: 'test@test.com' },
        timestamp: new Date(),
      };

      jest.spyOn(prisma.logActividad, 'create').mockResolvedValue({} as any);

      await listener.handleAdminEvent(payload);

      expect(prisma.logActividad.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          codigo_usuario: payload.userId,
          accion: expect.any(String),
          entidad: payload.entityType,
          id_entidad: payload.entityId.toString(),
          detalles: expect.any(String),
          fecha_accion: payload.timestamp,
        }),
      });
    });

    it('should log error to LogError if logging fails', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.user.created',
        entityType: 'user',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      const error = new Error('Database error');
      jest.spyOn(prisma.logActividad, 'create').mockRejectedValue(error);
      jest.spyOn(prisma.logError, 'create').mockResolvedValue({} as any);

      await listener.handleAdminEvent(payload);

      expect(prisma.logError.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          mensaje: expect.stringContaining('Failed to log admin event'),
          endpoint: `admin.${payload.entityType}.${payload.action}`,
          metodo_http: 'EVENT',
          codigo_usuario: payload.userId,
        }),
      });
    });

    it('should generate correct action description for created', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.user.created',
        entityType: 'user',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      jest.spyOn(prisma.logActividad, 'create').mockResolvedValue({} as any);

      await listener.handleAdminEvent(payload);

      expect(prisma.logActividad.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'Creó User',
        }),
      });
    });

    it('should generate correct action description for updated', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.exam.updated',
        entityType: 'exam',
        entityId: 1,
        action: 'updated',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      jest.spyOn(prisma.logActividad, 'create').mockResolvedValue({} as any);

      await listener.handleAdminEvent(payload);

      expect(prisma.logActividad.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'Actualizó Exam',
        }),
      });
    });

    it('should generate correct action description for deleted', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.role.deleted',
        entityType: 'role',
        entityId: 1,
        action: 'deleted',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      jest.spyOn(prisma.logActividad, 'create').mockResolvedValue({} as any);

      await listener.handleAdminEvent(payload);

      expect(prisma.logActividad.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'Eliminó Role',
        }),
      });
    });
  });

  describe('Critical Events Handlers', () => {
    it('should handle user deleted event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'user',
        entityId: 1,
        action: 'deleted',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      // Should not throw
      await expect(listener.handleUserDeleted(payload)).resolves.not.toThrow();
    });

    it('should handle role deleted event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'role',
        entityId: 1,
        action: 'deleted',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.handleRoleDeleted(payload)).resolves.not.toThrow();
    });

    it('should handle exam created event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'exam',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.handleExamCreated(payload)).resolves.not.toThrow();
    });

    it('should handle price updated event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'price',
        entityId: 1,
        action: 'updated',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.handlePriceUpdated(payload)).resolves.not.toThrow();
    });

    it('should handle inventory deleted event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'inventory',
        entityId: 1,
        action: 'deleted',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.handleInventoryDeleted(payload)).resolves.not.toThrow();
    });
  });
});
