import { Test, TestingModule } from '@nestjs/testing';
import { CatalogoAdminEventsListener } from './admin-events.listener';
import { AdminEventPayload } from '../../admin/admin-events.service';

describe('CatalogoAdminEventsListener', () => {
  let listener: CatalogoAdminEventsListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogoAdminEventsListener],
    }).compile();

    listener = module.get<CatalogoAdminEventsListener>(CatalogoAdminEventsListener);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('Cache Invalidation Handlers', () => {
    it('should handle exam change event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'exam',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.handleExamChange(payload)).resolves.not.toThrow();
    });

    it('should handle exam update event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'exam',
        entityId: 1,
        action: 'updated',
        userId: 2,
        data: { changedFields: ['nombre'] },
        timestamp: new Date(),
      };

      await expect(listener.handleExamChange(payload)).resolves.not.toThrow();
    });

    it('should handle exam delete event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'exam',
        entityId: 1,
        action: 'deleted',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.handleExamChange(payload)).resolves.not.toThrow();
    });

    it('should handle price change event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'price',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: { examId: 5, precio: 50.0 },
        timestamp: new Date(),
      };

      await expect(listener.handlePriceChange(payload)).resolves.not.toThrow();
    });

    it('should handle category change event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'category',
        entityId: 1,
        action: 'updated',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.handleCategoryChange(payload)).resolves.not.toThrow();
    });

    it('should handle package change event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'package',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.handlePackageChange(payload)).resolves.not.toThrow();
    });

    it('should handle location change event', async () => {
      const payload: AdminEventPayload = {
        entityType: 'location',
        entityId: 1,
        action: 'updated',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.handleLocationChange(payload)).resolves.not.toThrow();
    });
  });

  describe('Catalog Update Notification', () => {
    it('should notify catalog update for exam entity', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.exam.created',
        entityType: 'exam',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.notifyCatalogUpdate(payload)).resolves.not.toThrow();
    });

    it('should notify catalog update for price entity', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.price.updated',
        entityType: 'price',
        entityId: 1,
        action: 'updated',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.notifyCatalogUpdate(payload)).resolves.not.toThrow();
    });

    it('should notify catalog update for category entity', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.category.deleted',
        entityType: 'category',
        entityId: 1,
        action: 'deleted',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.notifyCatalogUpdate(payload)).resolves.not.toThrow();
    });

    it('should notify catalog update for package entity', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.package.created',
        entityType: 'package',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.notifyCatalogUpdate(payload)).resolves.not.toThrow();
    });

    it('should notify catalog update for location entity', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.location.updated',
        entityType: 'location',
        entityId: 1,
        action: 'updated',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.notifyCatalogUpdate(payload)).resolves.not.toThrow();
    });

    it('should notify catalog update for service entity', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.service.created',
        entityType: 'service',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      await expect(listener.notifyCatalogUpdate(payload)).resolves.not.toThrow();
    });

    it('should not process non-catalog entities', async () => {
      const payload: AdminEventPayload & { eventType: string } = {
        eventType: 'admin.user.created',
        entityType: 'user',
        entityId: 1,
        action: 'created',
        userId: 2,
        data: {},
        timestamp: new Date(),
      };

      // Should still resolve without throwing
      await expect(listener.notifyCatalogUpdate(payload)).resolves.not.toThrow();
    });
  });
});
