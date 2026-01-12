import { Test, TestingModule } from '@nestjs/testing';
import { ResultadosService } from './resultados.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { PdfGeneratorService } from './pdf-generator.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ResultadosService', () => {
  let service: ResultadosService;
  let prisma: PrismaService;
  let eventsGateway: EventsGateway;
  let pdfGenerator: PdfGeneratorService;

  const mockPrismaService = {
    muestra: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    usuario: {
      findUnique: jest.fn(),
    },
    examen: {
      findUnique: jest.fn(),
    },
    resultado: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    descargaResultado: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEventsGateway = {
    notifyResultUpdate: jest.fn(),
    notifyAdminEvent: jest.fn(),
  };

  const mockPdfGeneratorService = {
    generateResultadoPdf: jest.fn(),
    getOutputDir: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultadosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
        {
          provide: PdfGeneratorService,
          useValue: mockPdfGeneratorService,
        },
      ],
    }).compile();

    service = module.get<ResultadosService>(ResultadosService);
    prisma = module.get<PrismaService>(PrismaService);
    eventsGateway = module.get<EventsGateway>(EventsGateway);
    pdfGenerator = module.get<PdfGeneratorService>(PdfGeneratorService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMuestra', () => {
    const createMuestraDto = {
      codigo_paciente: 1,
      codigo_cita: 1,
      id_muestra: 'MUE-001',
      tipo_muestra: 'Sangre',
      fecha_toma: '2025-11-17T10:00:00Z',
      observaciones: 'Muestra en ayunas',
    };

    const mockPaciente = {
      codigo_usuario: 1,
      nombres: 'Juan',
      apellidos: 'Pérez',
      cedula: '1234567890',
    };

    it('should create a muestra successfully', async () => {
      const expectedMuestra = {
        codigo_muestra: 1,
        ...createMuestraDto,
        tomada_por: 2,
        estado: 'RECOLECTADA',
        paciente: mockPaciente,
      };

      mockPrismaService.muestra.findUnique.mockResolvedValue(null);
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockPaciente);
      mockPrismaService.muestra.create.mockResolvedValue(expectedMuestra);

      const result = await service.createMuestra(createMuestraDto, 2);

      expect(result).toEqual(expectedMuestra);
      expect(mockPrismaService.muestra.findUnique).toHaveBeenCalledWith({
        where: { id_muestra: 'MUE-001' },
      });
      expect(mockPrismaService.usuario.findUnique).toHaveBeenCalledWith({
        where: { codigo_usuario: 1 },
      });
    });

    it('should throw BadRequestException if muestra ID is duplicated', async () => {
      mockPrismaService.muestra.findUnique.mockResolvedValue({
        id_muestra: 'MUE-001',
      });

      await expect(
        service.createMuestra(createMuestraDto, 2),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if patient does not exist', async () => {
      mockPrismaService.muestra.findUnique.mockResolvedValue(null);
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.createMuestra(createMuestraDto, 2),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createResultado', () => {
    const createResultadoDto = {
      codigo_muestra: 1,
      codigo_examen: 1,
      valor_numerico: 95,
      unidad_medida: 'mg/dL',
      valor_referencia_min: 70,
      valor_referencia_max: 100,
      observaciones_tecnicas: 'Normal',
    };

    const mockMuestra = {
      codigo_muestra: 1,
      codigo_paciente: 1,
      paciente: {
        codigo_usuario: 1,
        nombres: 'Juan',
        apellidos: 'Pérez',
      },
    };

    const mockExamen = {
      codigo_examen: 1,
      nombre: 'Glucosa',
    };

    it('should create resultado with NORMAL level', async () => {
      const expectedResultado = {
        codigo_resultado: 1,
        ...createResultadoDto,
        dentro_rango_normal: true,
        nivel: 'NORMAL',
        estado: 'EN_PROCESO',
        procesado_por: 2,
        muestra: mockMuestra,
        examen: mockExamen,
      };

      mockPrismaService.muestra.findUnique.mockResolvedValue(mockMuestra);
      mockPrismaService.examen.findUnique.mockResolvedValue(mockExamen);
      mockPrismaService.resultado.create.mockResolvedValue(expectedResultado);

      const result = await service.createResultado(createResultadoDto, 2);

      expect(result).toEqual(expectedResultado);
      expect(result.nivel).toBe('NORMAL');
      expect(result.dentro_rango_normal).toBe(true);
    });

    it('should create resultado with BAJO level', async () => {
      const lowValueDto = {
        ...createResultadoDto,
        valor_numerico: 50,
      };

      const expectedResultado = {
        codigo_resultado: 1,
        ...lowValueDto,
        dentro_rango_normal: false,
        nivel: 'BAJO',
        estado: 'EN_PROCESO',
        procesado_por: 2,
        muestra: mockMuestra,
        examen: mockExamen,
      };

      mockPrismaService.muestra.findUnique.mockResolvedValue(mockMuestra);
      mockPrismaService.examen.findUnique.mockResolvedValue(mockExamen);
      mockPrismaService.resultado.create.mockResolvedValue(expectedResultado);

      const result = await service.createResultado(lowValueDto, 2);

      expect(result.nivel).toBe('BAJO');
      expect(result.dentro_rango_normal).toBe(false);
    });

    it('should create resultado with ALTO level', async () => {
      const highValueDto = {
        ...createResultadoDto,
        valor_numerico: 150,
      };

      const expectedResultado = {
        codigo_resultado: 1,
        ...highValueDto,
        dentro_rango_normal: false,
        nivel: 'ALTO',
        estado: 'EN_PROCESO',
        procesado_por: 2,
        muestra: mockMuestra,
        examen: mockExamen,
      };

      mockPrismaService.muestra.findUnique.mockResolvedValue(mockMuestra);
      mockPrismaService.examen.findUnique.mockResolvedValue(mockExamen);
      mockPrismaService.resultado.create.mockResolvedValue(expectedResultado);

      const result = await service.createResultado(highValueDto, 2);

      expect(result.nivel).toBe('ALTO');
      expect(result.dentro_rango_normal).toBe(false);
    });

    it('should create resultado with CRITICO level for very high values', async () => {
      const criticalValueDto = {
        ...createResultadoDto,
        valor_numerico: 200,
      };

      const expectedResultado = {
        codigo_resultado: 1,
        ...criticalValueDto,
        dentro_rango_normal: false,
        nivel: 'CRITICO',
        estado: 'EN_PROCESO',
        procesado_por: 2,
        muestra: mockMuestra,
        examen: mockExamen,
      };

      mockPrismaService.muestra.findUnique.mockResolvedValue(mockMuestra);
      mockPrismaService.examen.findUnique.mockResolvedValue(mockExamen);
      mockPrismaService.resultado.create.mockResolvedValue(expectedResultado);

      const result = await service.createResultado(criticalValueDto, 2);

      expect(result.nivel).toBe('CRITICO');
    });

    it('should throw NotFoundException if muestra does not exist', async () => {
      mockPrismaService.muestra.findUnique.mockResolvedValue(null);

      await expect(
        service.createResultado(createResultadoDto, 2),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if examen does not exist', async () => {
      mockPrismaService.muestra.findUnique.mockResolvedValue(mockMuestra);
      mockPrismaService.examen.findUnique.mockResolvedValue(null);

      await expect(
        service.createResultado(createResultadoDto, 2),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validarResultado', () => {
    const mockResultado = {
      codigo_resultado: 1,
      estado: 'EN_PROCESO',
      muestra: {
        codigo_paciente: 1,
        paciente: {
          nombres: 'Juan',
          apellidos: 'Pérez',
          email: 'juan@example.com',
        },
      },
      examen: {
        nombre: 'Glucosa',
      },
    };

    it('should validate resultado and generate PDF', async () => {
      const pdfPath = '/uploads/resultados/resultado-123.pdf';
      const validatedResultado = {
        ...mockResultado,
        estado: 'LISTO',
        validado_por: 2,
        fecha_validacion: new Date(),
        codigo_verificacion: 'VER-12345678',
        url_pdf: '/uploads/resultados/resultado-123.pdf',
      };

      mockPrismaService.resultado.findUnique.mockResolvedValue(mockResultado);
      mockPdfGeneratorService.generateResultadoPdf.mockResolvedValue(pdfPath);
      mockPrismaService.resultado.update.mockResolvedValue(validatedResultado);

      const result = await service.validarResultado(1, 2);

      expect(result.estado).toBe('LISTO');
      expect(result.codigo_verificacion).toMatch(/^VER-/);
      expect(result.url_pdf).toContain('/uploads/resultados/');
      expect(mockPdfGeneratorService.generateResultadoPdf).toHaveBeenCalled();
      expect(mockEventsGateway.notifyResultUpdate).toHaveBeenCalledWith({
        resultId: 1,
        patientId: 1,
        examName: 'Glucosa',
        status: 'ready',
      });
      expect(mockEventsGateway.notifyAdminEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException if resultado does not exist', async () => {
      mockPrismaService.resultado.findUnique.mockResolvedValue(null);

      await expect(service.validarResultado(1, 2)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('downloadResultado', () => {
    const mockResultado = {
      codigo_resultado: 1,
      estado: 'LISTO',
      url_pdf: '/uploads/resultados/resultado-1.pdf',
      muestra: {
        codigo_paciente: 1,
      },
    };

    it('should download resultado and update status', async () => {
      mockPrismaService.resultado.findUnique.mockResolvedValue(mockResultado);
      mockPrismaService.descargaResultado.create.mockResolvedValue({});
      mockPrismaService.resultado.update.mockResolvedValue({
        ...mockResultado,
        estado: 'ENTREGADO',
      });

      const result = await service.downloadResultado(1, 1);

      expect(result).toBe('/uploads/resultados/resultado-1.pdf');
      expect(mockPrismaService.descargaResultado.create).toHaveBeenCalledWith({
        data: {
          codigo_resultado: 1,
          codigo_usuario: 1,
          fecha_descarga: expect.any(Date),
        },
      });
      expect(mockPrismaService.resultado.update).toHaveBeenCalledWith({
        where: { codigo_resultado: 1 },
        data: { estado: 'ENTREGADO' },
      });
    });

    it('should throw NotFoundException if resultado does not exist', async () => {
      mockPrismaService.resultado.findUnique.mockResolvedValue(null);

      await expect(service.downloadResultado(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if resultado does not belong to patient', async () => {
      mockPrismaService.resultado.findUnique.mockResolvedValue({
        ...mockResultado,
        muestra: { codigo_paciente: 999 },
      });

      await expect(service.downloadResultado(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if resultado is not ready', async () => {
      mockPrismaService.resultado.findUnique.mockResolvedValue({
        ...mockResultado,
        estado: 'EN_PROCESO',
      });

      await expect(service.downloadResultado(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if PDF is not available', async () => {
      mockPrismaService.resultado.findUnique.mockResolvedValue({
        ...mockResultado,
        url_pdf: null,
      });

      await expect(service.downloadResultado(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyResultados', () => {
    it('should return patient results', async () => {
      const mockResultados = [
        {
          codigo_resultado: 1,
          estado: 'LISTO',
          muestra: {
            codigo_muestra: 1,
            codigo_paciente: 1,
          },
          examen: {
            nombre: 'Glucosa',
          },
        },
      ];

      mockPrismaService.resultado.findMany.mockResolvedValue(mockResultados);

      const result = await service.getMyResultados(1);

      expect(result).toEqual(mockResultados);
      expect(mockPrismaService.resultado.findMany).toHaveBeenCalledWith({
        where: {
          muestra: { codigo_paciente: 1 },
          estado: { in: ['LISTO', 'VALIDADO', 'ENTREGADO'] },
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });
  });

  describe('getEstadisticas', () => {
    it('should return statistics', async () => {
      mockPrismaService.resultado.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20)  // en proceso
        .mockResolvedValueOnce(40)  // listos
        .mockResolvedValueOnce(25)  // validados
        .mockResolvedValueOnce(15)  // entregados
        .mockResolvedValueOnce(30)  // fuera de rango
        .mockResolvedValueOnce(5);  // críticos

      const result = await service.getEstadisticas();

      expect(result).toEqual({
        total: 100,
        en_proceso: 20,
        listos: 40,
        validados: 25,
        entregados: 15,
        fuera_rango_normal: 30,
        criticos: 5,
      });
    });
  });

  describe('getMuestras', () => {
    it('should return muestras with filters', async () => {
      const mockMuestras = [
        {
          codigo_muestra: 1,
          codigo_paciente: 1,
          estado: 'RECOLECTADA',
          paciente: {
            nombres: 'Juan',
            apellidos: 'Pérez',
          },
        },
      ];

      mockPrismaService.muestra.findMany.mockResolvedValue(mockMuestras);

      const result = await service.getMuestras({
        codigo_paciente: 1,
        estado: 'RECOLECTADA',
      });

      expect(result).toEqual(mockMuestras);
      expect(mockPrismaService.muestra.findMany).toHaveBeenCalledWith({
        where: {
          codigo_paciente: 1,
          estado: 'RECOLECTADA',
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });
  });

  describe('updateResultado', () => {
    const mockResultado = {
      codigo_resultado: 1,
      estado: 'EN_PROCESO',
      muestra: {
        codigo_paciente: 1,
        paciente: {
          nombres: 'Juan',
          apellidos: 'Pérez',
        },
      },
      examen: {
        nombre: 'Glucosa',
      },
    };

    it('should update resultado and notify if estado is LISTO', async () => {
      const updateDto = {
        estado: 'LISTO',
        observaciones_tecnicas: 'Resultado validado',
      };

      const updatedResultado = {
        ...mockResultado,
        ...updateDto,
      };

      mockPrismaService.resultado.findUnique.mockResolvedValue(mockResultado);
      mockPrismaService.resultado.update.mockResolvedValue(updatedResultado);

      const result = await service.updateResultado(1, updateDto, 2);

      expect(result).toEqual(updatedResultado);
      expect(mockEventsGateway.notifyResultUpdate).toHaveBeenCalledWith({
        resultId: 1,
        patientId: 1,
        examName: 'Glucosa',
        status: 'ready',
      });
    });

    it('should throw NotFoundException if resultado does not exist', async () => {
      mockPrismaService.resultado.findUnique.mockResolvedValue(null);

      await expect(
        service.updateResultado(1, { estado: 'LISTO' }, 2),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
