import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: any;

  const mockUsuario = {
    codigo_usuario: 1,
    codigo_rol: 1,
    cedula: '0123456789',
    email: 'test@example.com',
    nombres: 'Juan',
    apellidos: 'Pérez',
    telefono: '0999999999',
    fecha_nacimiento: new Date('1990-01-01'),
    genero: 'M',
    activo: true,
    rol: {
      codigo_rol: 1,
      nombre: 'PACIENTE',
      nivel_acceso: 1,
    },
    perfil_medico: {
      codigo_perfil: 1,
      codigo_usuario: 1,
      tipo_sangre: 'O+',
    },
  };

  const mockPrismaService = {
    usuario: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should find a user by codigo_usuario', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.findOne(1);

      expect(result).toEqual(mockUsuario);
      expect(prismaService.usuario.findUnique).toHaveBeenCalledWith({
        where: { codigo_usuario: 1 },
        include: { rol: true, perfil_medico: true },
      });
    });

    it('should return null if user not found', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      const result = await service.findOne(999);

      expect(result).toBeNull();
    });
  });

  describe('findByCedula', () => {
    it('should find a user by cedula', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.findByCedula('0123456789');

      expect(result).toEqual(mockUsuario);
      expect(prismaService.usuario.findUnique).toHaveBeenCalledWith({
        where: { cedula: '0123456789' },
        include: { rol: true },
      });
    });

    it('should return null if user not found', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      const result = await service.findByCedula('9999999999');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUsuario);
      expect(prismaService.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { rol: true },
      });
    });

    it('should return null if user not found', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should handle email case sensitivity', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.findByEmail('TEST@EXAMPLE.COM');

      expect(prismaService.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'TEST@EXAMPLE.COM' },
        include: { rol: true },
      });
    });
  });
});
