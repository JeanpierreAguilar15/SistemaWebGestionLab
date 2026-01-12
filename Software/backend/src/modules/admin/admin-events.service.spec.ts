import { Test, TestingModule } from '@nestjs/testing';
import { AdminEventsService, AdminEventType } from './admin-events.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('AdminEventsService', () => {
  let service: AdminEventsService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEventsService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminEventsService>(AdminEventsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('User Events', () => {
    it('should emit user created event with correct payload', () => {
      const userId = 1;
      const adminId = 2;
      const data = { rol: 'Paciente', email: 'test@test.com' };

      service.emitUserCreated(userId, adminId, data);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AdminEventType.USER_CREATED,
        expect.objectContaining({
          entityType: 'user',
          entityId: userId,
          action: 'created',
          userId: adminId,
          data,
          timestamp: expect.any(Date),
        }),
      );

      // Should also emit wildcard event
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'admin.*',
        expect.objectContaining({
          eventType: AdminEventType.USER_CREATED,
        }),
      );
    });

    it('should emit user updated event', () => {
      const userId = 1;
      const adminId = 2;
      const data = { changedFields: ['nombres'] };

      service.emitUserUpdated(userId, adminId, data);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AdminEventType.USER_UPDATED,
        expect.objectContaining({
          entityType: 'user',
          entityId: userId,
          action: 'updated',
          userId: adminId,
        }),
      );
    });

    it('should emit user deleted event', () => {
      const userId = 1;
      const adminId = 2;

      service.emitUserDeleted(userId, adminId);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AdminEventType.USER_DELETED,
        expect.objectContaining({
          entityType: 'user',
          entityId: userId,
          action: 'deleted',
          userId: adminId,
        }),
      );
    });
  });

  describe('Role Events', () => {
    it('should emit role created event', () => {
      const roleId = 1;
      const adminId = 2;
      const data = { nombre: 'Admin', nivel_acceso: 1 };

      service.emitRoleCreated(roleId, adminId, data);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AdminEventType.ROLE_CREATED,
        expect.objectContaining({
          entityType: 'role',
          entityId: roleId,
          userId: adminId,
        }),
      );
    });
  });

  describe('Exam Events', () => {
    it('should emit exam created event', () => {
      const examId = 1;
      const adminId = 2;
      const data = { nombre: 'Hemograma', codigo_interno: 'HEM001' };

      service.emitExamCreated(examId, adminId, data);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AdminEventType.EXAM_CREATED,
        expect.objectContaining({
          entityType: 'exam',
          entityId: examId,
          userId: adminId,
          data,
        }),
      );
    });

    it('should emit exam updated event', () => {
      service.emitExamUpdated(1, 2, { changedFields: ['nombre'] });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AdminEventType.EXAM_UPDATED,
        expect.any(Object),
      );
    });

    it('should emit exam deleted event', () => {
      service.emitExamDeleted(1, 2);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AdminEventType.EXAM_DELETED,
        expect.any(Object),
      );
    });
  });

  describe('Price Events', () => {
    it('should emit price created event with exam ID', () => {
      const priceId = 1;
      const examId = 5;
      const adminId = 2;
      const data = { precio: 50.0 };

      service.emitPriceCreated(priceId, examId, adminId, data);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AdminEventType.PRICE_CREATED,
        expect.objectContaining({
          entityType: 'price',
          entityId: priceId,
          userId: adminId,
          data: expect.objectContaining({ examId }),
        }),
      );
    });
  });

  describe('Category Events', () => {
    it('should emit category created event', () => {
      service.emitCategoryCreated(1, 2, { nombre: 'Hematología' });
      expect(eventEmitter.emit).toHaveBeenCalledWith(AdminEventType.CATEGORY_CREATED, expect.any(Object));
    });

    it('should emit category updated event', () => {
      service.emitCategoryUpdated(1, 2, { changedFields: ['descripcion'] });
      expect(eventEmitter.emit).toHaveBeenCalledWith(AdminEventType.CATEGORY_UPDATED, expect.any(Object));
    });

    it('should emit category deleted event', () => {
      service.emitCategoryDeleted(1, 2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(AdminEventType.CATEGORY_DELETED, expect.any(Object));
    });
  });

  describe('Package Events', () => {
    it('should emit package created event', () => {
      service.emitPackageCreated(1, 2, { nombre: 'Paquete Básico' });
      expect(eventEmitter.emit).toHaveBeenCalledWith(AdminEventType.PACKAGE_CREATED, expect.any(Object));
    });
  });

  describe('Inventory Events', () => {
    it('should emit inventory item created event', () => {
      service.emitInventoryItemCreated(1, 2, { nombre: 'Reactivo' });
      expect(eventEmitter.emit).toHaveBeenCalledWith(AdminEventType.INVENTORY_ITEM_CREATED, expect.any(Object));
    });
  });

  describe('Supplier Events', () => {
    it('should emit supplier created event', () => {
      service.emitSupplierCreated(1, 2, { razon_social: 'Proveedor SA' });
      expect(eventEmitter.emit).toHaveBeenCalledWith(AdminEventType.SUPPLIER_CREATED, expect.any(Object));
    });
  });

  describe('Generic Event Emission', () => {
    it('should emit both specific and wildcard events', () => {
      service.emitUserCreated(1, 2, {});

      // Specific event
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AdminEventType.USER_CREATED,
        expect.any(Object),
      );

      // Wildcard event
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'admin.*',
        expect.any(Object),
      );

      // Should be called exactly 2 times (specific + wildcard)
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    });

    it('should include timestamp in all events', () => {
      const beforeTime = new Date();
      service.emitUserCreated(1, 2, {});
      const afterTime = new Date();

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AdminEventType.USER_CREATED,
        expect.objectContaining({
          timestamp: expect.any(Date),
        }),
      );

      const emittedPayload = (eventEmitter.emit as jest.Mock).mock.calls[0][1];
      expect(emittedPayload.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(emittedPayload.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });
});
