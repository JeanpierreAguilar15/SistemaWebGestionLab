import { Test, TestingModule } from '@nestjs/testing';
import { CotizacionesService } from './cotizaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('CotizacionesService', () => {
  let service: CotizacionesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    categoriaExamen: {
      findMany: jest.fn(),
    },
    examen: {
      findUnique: jest.fn(),
    },
    cotizacion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CotizacionesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CotizacionesService>(CotizacionesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getExamenesParaCotizacion', () => {
    it('should return exams grouped by category with prices', async () => {
      const mockCategorias = [
        {
          codigo_categoria: 1,
          nombre: 'HEMATOLOGÍA',
          descripcion: 'Exámenes de sangre',
          activo: true,
          examenes: [
            {
              codigo_examen: 1,
              codigo_interno: 'HEM-001',
              nombre: 'Hemograma',
              descripcion: 'Conteo sanguíneo completo',
              requiere_ayuno: true,
              horas_ayuno: 8,
              instrucciones_preparacion: 'Ayuno de 8 horas',
              tiempo_entrega_horas: 24,
              tipo_muestra: 'Sangre',
              precios: [
                {
                  precio: new Decimal(15.5),
                },
              ],
            },
          ],
        },
      ];

      mockPrismaService.categoriaExamen.findMany.mockResolvedValue(
        mockCategorias,
      );

      const result = await service.getExamenesParaCotizacion();

      expect(result).toHaveLength(1);
      expect(result[0].nombre).toBe('HEMATOLOGÍA');
      expect(result[0].examenes[0].precio_actual).toBe(15.5);
      expect(result[0].examenes[0].requiere_ayuno).toBe(true);
    });
  });

  describe('createCotizacion', () => {
    const createCotizacionDto = {
      examenes: [
        { codigo_examen: 1, cantidad: 1 },
        { codigo_examen: 2, cantidad: 1 },
      ],
      descuento: 0,
      observaciones: 'Exámenes de rutina',
    };

    const mockExamen1 = {
      codigo_examen: 1,
      nombre: 'Hemograma',
      activo: true,
      precios: [
        {
          precio: new Decimal(15.5),
        },
      ],
    };

    const mockExamen2 = {
      codigo_examen: 2,
      nombre: 'Glucosa',
      activo: true,
      precios: [
        {
          precio: new Decimal(12.0),
        },
      ],
    };

    it('should create cotizacion with automatic price calculation', async () => {
      mockPrismaService.examen.findUnique
        .mockResolvedValueOnce(mockExamen1)
        .mockResolvedValueOnce(mockExamen2);

      mockPrismaService.cotizacion.count.mockResolvedValue(0);

      const expectedCotizacion = {
        codigo_cotizacion: 1,
        numero_cotizacion: 'COT-202511-0001',
        subtotal: new Decimal(27.5),
        descuento: new Decimal(0),
        total: new Decimal(27.5),
        estado: 'PENDIENTE',
        detalles: [
          {
            codigo_examen: 1,
            cantidad: 1,
            precio_unitario: new Decimal(15.5),
            total_linea: new Decimal(15.5),
            examen: mockExamen1,
          },
          {
            codigo_examen: 2,
            cantidad: 1,
            precio_unitario: new Decimal(12.0),
            total_linea: new Decimal(12.0),
            examen: mockExamen2,
          },
        ],
        paciente: {
          codigo_usuario: 1,
          nombres: 'Juan',
          apellidos: 'Pérez',
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          cotizacion: {
            create: jest.fn().mockResolvedValue(expectedCotizacion),
          },
        };
        return await callback(tx);
      });

      const result = await service.createCotizacion(createCotizacionDto, 1);

      expect(result).toBeDefined();
      expect(Number(result.subtotal)).toBe(27.5);
      expect(Number(result.total)).toBe(27.5);
      expect(result.detalles).toHaveLength(2);
    });

    it('should apply discount correctly', async () => {
      const dtoWithDiscount = {
        ...createCotizacionDto,
        descuento: 5,
      };

      mockPrismaService.examen.findUnique
        .mockResolvedValueOnce(mockExamen1)
        .mockResolvedValueOnce(mockExamen2);

      mockPrismaService.cotizacion.count.mockResolvedValue(0);

      const expectedCotizacion = {
        codigo_cotizacion: 1,
        numero_cotizacion: 'COT-202511-0001',
        subtotal: new Decimal(27.5),
        descuento: new Decimal(5),
        total: new Decimal(22.5),
        estado: 'PENDIENTE',
        detalles: [],
        paciente: {},
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          cotizacion: {
            create: jest.fn().mockResolvedValue(expectedCotizacion),
          },
        };
        return await callback(tx);
      });

      const result = await service.createCotizacion(dtoWithDiscount, 1);

      expect(Number(result.descuento)).toBe(5);
      expect(Number(result.total)).toBe(22.5);
    });

    it('should throw NotFoundException if exam does not exist', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue(null);

      await expect(
        service.createCotizacion(createCotizacionDto, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if exam is inactive', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        ...mockExamen1,
        activo: false,
      });

      await expect(
        service.createCotizacion(createCotizacionDto, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if exam has no price', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        ...mockExamen1,
        precios: [],
      });

      await expect(
        service.createCotizacion(createCotizacionDto, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if discount exceeds subtotal', async () => {
      const dtoWithExcessiveDiscount = {
        ...createCotizacionDto,
        descuento: 100,
      };

      mockPrismaService.examen.findUnique
        .mockResolvedValueOnce(mockExamen1)
        .mockResolvedValueOnce(mockExamen2);

      await expect(
        service.createCotizacion(dtoWithExcessiveDiscount, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCotizacion', () => {
    const mockCotizacion = {
      codigo_cotizacion: 1,
      codigo_paciente: 1,
      numero_cotizacion: 'COT-202511-0001',
      total: new Decimal(27.5),
      detalles: [],
      paciente: {
        nombres: 'Juan',
        apellidos: 'Pérez',
      },
    };

    it('should return cotizacion for owner', async () => {
      mockPrismaService.cotizacion.findUnique.mockResolvedValue(
        mockCotizacion,
      );

      const result = await service.getCotizacion(1, 1);

      expect(result).toEqual(mockCotizacion);
    });

    it('should throw NotFoundException if cotizacion does not exist', async () => {
      mockPrismaService.cotizacion.findUnique.mockResolvedValue(null);

      await expect(service.getCotizacion(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if cotizacion does not belong to patient', async () => {
      mockPrismaService.cotizacion.findUnique.mockResolvedValue({
        ...mockCotizacion,
        codigo_paciente: 999,
      });

      await expect(service.getCotizacion(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyCotizaciones', () => {
    it('should return patient cotizaciones', async () => {
      const mockCotizaciones = [
        {
          codigo_cotizacion: 1,
          codigo_paciente: 1,
          numero_cotizacion: 'COT-202511-0001',
          total: new Decimal(27.5),
          detalles: [],
        },
      ];

      mockPrismaService.cotizacion.findMany.mockResolvedValue(
        mockCotizaciones,
      );

      const result = await service.getMyCotizaciones(1);

      expect(result).toEqual(mockCotizaciones);
      expect(mockPrismaService.cotizacion.findMany).toHaveBeenCalledWith({
        where: { codigo_paciente: 1 },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });
  });

  describe('getAllCotizaciones', () => {
    it('should return all cotizaciones with filters', async () => {
      const mockCotizaciones = [
        {
          codigo_cotizacion: 1,
          estado: 'PENDIENTE',
          paciente: {
            nombres: 'Juan',
          },
        },
      ];

      mockPrismaService.cotizacion.findMany.mockResolvedValue(
        mockCotizaciones,
      );

      const result = await service.getAllCotizaciones({
        estado: 'PENDIENTE',
      });

      expect(result).toEqual(mockCotizaciones);
      expect(mockPrismaService.cotizacion.findMany).toHaveBeenCalledWith({
        where: { estado: 'PENDIENTE' },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });
  });

  describe('updateCotizacion', () => {
    const mockCotizacion = {
      codigo_cotizacion: 1,
      estado: 'PENDIENTE',
      observaciones: 'Original',
    };

    it('should update cotizacion status', async () => {
      const updatedCotizacion = {
        ...mockCotizacion,
        estado: 'ACEPTADA',
        observaciones: 'Actualizado',
      };

      mockPrismaService.cotizacion.findUnique.mockResolvedValue(
        mockCotizacion,
      );
      mockPrismaService.cotizacion.update.mockResolvedValue(
        updatedCotizacion,
      );

      const result = await service.updateCotizacion(
        1,
        'ACEPTADA',
        'Actualizado',
      );

      expect(result.estado).toBe('ACEPTADA');
      expect(result.observaciones).toBe('Actualizado');
    });

    it('should throw NotFoundException if cotizacion does not exist', async () => {
      mockPrismaService.cotizacion.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCotizacion(1, 'ACEPTADA'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEstadisticas', () => {
    it('should return cotizacion statistics', async () => {
      mockPrismaService.cotizacion.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(30)  // pendientes
        .mockResolvedValueOnce(40)  // aceptadas
        .mockResolvedValueOnce(10)  // rechazadas
        .mockResolvedValueOnce(15)  // pagadas
        .mockResolvedValueOnce(5);  // expiradas

      mockPrismaService.cotizacion.aggregate.mockResolvedValue({
        _sum: {
          total: new Decimal(5000),
        },
      });

      const result = await service.getEstadisticas();

      expect(result).toEqual({
        total: 100,
        pendientes: 30,
        aceptadas: 40,
        rechazadas: 10,
        pagadas: 15,
        expiradas: 5,
        total_ventas: new Decimal(5000),
      });
    });
  });
});
