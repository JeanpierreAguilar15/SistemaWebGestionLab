import { Test, TestingModule } from '@nestjs/testing';
import { PagosService } from './pagos.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('PagosService', () => {
  let service: PagosService;
  let prisma: PrismaService;

  const mockPrismaService = {
    cotizacion: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pago: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PagosService>(PagosService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPago', () => {
    const createPagoDto = {
      codigo_cotizacion: 1,
      monto_total: 85.5,
      metodo_pago: 'TRANSFERENCIA',
      proveedor_pasarela: 'Banco Pichincha',
      id_transaccion_externa: 'TRX-123456',
      observaciones: 'Pago realizado',
    };

    const mockCotizacion = {
      codigo_cotizacion: 1,
      codigo_paciente: 1,
      total: new Decimal(85.5),
      fecha_expiracion: new Date(Date.now() + 86400000), // Mañana
    };

    it('should create pago successfully and update cotizacion to PAGADA', async () => {
      const expectedPago = {
        codigo_pago: 1,
        numero_pago: 'PAG-202511-0001',
        ...createPagoDto,
        monto_total: new Decimal(85.5),
        estado: 'COMPLETADO',
        paciente: {
          nombres: 'Juan',
          apellidos: 'Pérez',
        },
        cotizacion: {
          numero_cotizacion: 'COT-202511-0001',
          total: new Decimal(85.5),
        },
      };

      mockPrismaService.cotizacion.findUnique.mockResolvedValue(
        mockCotizacion,
      );
      mockPrismaService.pago.count.mockResolvedValue(0);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          pago: {
            create: jest.fn().mockResolvedValue(expectedPago),
          },
          cotizacion: {
            update: jest.fn().mockResolvedValue({
              ...mockCotizacion,
              estado: 'PAGADA',
            }),
          },
        };
        return await callback(tx);
      });

      const result = await service.createPago(createPagoDto as any, 1);

      expect(result).toBeDefined();
      expect(result.numero_pago).toMatch(/^PAG-/);
    });

    it('should throw NotFoundException if cotizacion does not exist', async () => {
      mockPrismaService.cotizacion.findUnique.mockResolvedValue(null);

      await expect(
        service.createPago(createPagoDto as any, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if cotizacion does not belong to patient', async () => {
      mockPrismaService.cotizacion.findUnique.mockResolvedValue({
        ...mockCotizacion,
        codigo_paciente: 999,
      });

      await expect(
        service.createPago(createPagoDto as any, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if cotizacion is expired', async () => {
      mockPrismaService.cotizacion.findUnique.mockResolvedValue({
        ...mockCotizacion,
        fecha_expiracion: new Date(Date.now() - 86400000), // Ayer
      });

      await expect(
        service.createPago(createPagoDto as any, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if amount does not match cotizacion total', async () => {
      const dtoWithWrongAmount = {
        ...createPagoDto,
        monto_total: 100.0,
      };

      mockPrismaService.cotizacion.findUnique.mockResolvedValue(
        mockCotizacion,
      );

      await expect(
        service.createPago(dtoWithWrongAmount as any, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create pago without cotizacion', async () => {
      const dtoWithoutCotizacion = {
        monto_total: 50.0,
        metodo_pago: 'EFECTIVO',
      };

      const expectedPago = {
        codigo_pago: 1,
        numero_pago: 'PAG-202511-0001',
        ...dtoWithoutCotizacion,
        monto_total: new Decimal(50.0),
        estado: 'COMPLETADO',
        paciente: {
          nombres: 'Juan',
        },
      };

      mockPrismaService.pago.count.mockResolvedValue(0);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          pago: {
            create: jest.fn().mockResolvedValue(expectedPago),
          },
        };
        return await callback(tx);
      });

      const result = await service.createPago(
        dtoWithoutCotizacion as any,
        1,
      );

      expect(result).toBeDefined();
      expect(Number(result.monto_total)).toBe(50.0);
    });
  });

  describe('getPago', () => {
    const mockPago = {
      codigo_pago: 1,
      codigo_paciente: 1,
      numero_pago: 'PAG-202511-0001',
      monto_total: new Decimal(85.5),
      paciente: {
        nombres: 'Juan',
      },
    };

    it('should return pago for owner', async () => {
      mockPrismaService.pago.findUnique.mockResolvedValue(mockPago);

      const result = await service.getPago(1, 1);

      expect(result).toEqual(mockPago);
    });

    it('should throw NotFoundException if pago does not exist', async () => {
      mockPrismaService.pago.findUnique.mockResolvedValue(null);

      await expect(service.getPago(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if pago does not belong to patient', async () => {
      mockPrismaService.pago.findUnique.mockResolvedValue({
        ...mockPago,
        codigo_paciente: 999,
      });

      await expect(service.getPago(1, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyPagos', () => {
    it('should return patient pagos', async () => {
      const mockPagos = [
        {
          codigo_pago: 1,
          codigo_paciente: 1,
          numero_pago: 'PAG-202511-0001',
          monto_total: new Decimal(85.5),
        },
      ];

      mockPrismaService.pago.findMany.mockResolvedValue(mockPagos);

      const result = await service.getMyPagos(1);

      expect(result).toEqual(mockPagos);
      expect(mockPrismaService.pago.findMany).toHaveBeenCalledWith({
        where: { codigo_paciente: 1 },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });
  });

  describe('getAllPagos', () => {
    it('should return all pagos with filters', async () => {
      const mockPagos = [
        {
          codigo_pago: 1,
          metodo_pago: 'TRANSFERENCIA',
          estado: 'COMPLETADO',
          paciente: {
            nombres: 'Juan',
          },
        },
      ];

      mockPrismaService.pago.findMany.mockResolvedValue(mockPagos);

      const result = await service.getAllPagos({
        metodo_pago: 'TRANSFERENCIA',
        estado: 'COMPLETADO',
      });

      expect(result).toEqual(mockPagos);
      expect(mockPrismaService.pago.findMany).toHaveBeenCalledWith({
        where: {
          metodo_pago: 'TRANSFERENCIA',
          estado: 'COMPLETADO',
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });
  });

  describe('updatePago', () => {
    const mockPago = {
      codigo_pago: 1,
      numero_pago: 'PAG-202511-0001',
      estado: 'PENDIENTE',
      observaciones: 'Original',
    };

    it('should update pago status', async () => {
      const updatedPago = {
        ...mockPago,
        estado: 'COMPLETADO',
        observaciones: 'Verificado',
      };

      mockPrismaService.pago.findUnique.mockResolvedValue(mockPago);
      mockPrismaService.pago.update.mockResolvedValue(updatedPago);

      const result = await service.updatePago(1, 'COMPLETADO', 'Verificado');

      expect(result.estado).toBe('COMPLETADO');
      expect(result.observaciones).toBe('Verificado');
    });

    it('should throw NotFoundException if pago does not exist', async () => {
      mockPrismaService.pago.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePago(1, 'COMPLETADO'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEstadisticas', () => {
    it('should return payment statistics', async () => {
      mockPrismaService.pago.count
        .mockResolvedValueOnce(200) // total
        .mockResolvedValueOnce(180) // completados
        .mockResolvedValueOnce(15)  // pendientes
        .mockResolvedValueOnce(5);  // rechazados

      mockPrismaService.pago.aggregate.mockResolvedValue({
        _sum: {
          monto_total: new Decimal(15750.25),
        },
      });

      mockPrismaService.pago.groupBy.mockResolvedValue([
        {
          metodo_pago: 'TRANSFERENCIA',
          _count: { metodo_pago: 100 },
          _sum: { monto_total: new Decimal(8500) },
        },
        {
          metodo_pago: 'TARJETA_CREDITO',
          _count: { metodo_pago: 60 },
          _sum: { monto_total: new Decimal(5250.25) },
        },
        {
          metodo_pago: 'EFECTIVO',
          _count: { metodo_pago: 20 },
          _sum: { monto_total: new Decimal(2000) },
        },
      ]);

      const result = await service.getEstadisticas();

      expect(result.total).toBe(200);
      expect(result.completados).toBe(180);
      expect(result.pendientes).toBe(15);
      expect(result.rechazados).toBe(5);
      expect(result.total_ingresos).toEqual(new Decimal(15750.25));
      expect(result.pagos_por_metodo).toHaveLength(3);
    });
  });
});
