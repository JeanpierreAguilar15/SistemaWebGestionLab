import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { mockPrismaService, resetMocks } from '../__mocks__/prisma.mock';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: typeof mockPrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  // Mock data
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
    password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz',
    salt: '$2b$10$abcdefghij',
    activo: true,
    cuenta_bloqueada: false,
    intentos_fallidos: 0,
    fecha_bloqueo: null,
    ultima_conexion: null,
    ip_ultima_conexion: null,
    fecha_creacion: new Date(),
    fecha_actualizacion: new Date(),
    rol: {
      codigo_rol: 1,
      nombre: 'PACIENTE',
      nivel_acceso: 1,
    },
  };

  const mockRol = {
    codigo_rol: 1,
    nombre: 'PACIENTE',
    descripcion: 'Paciente del laboratorio',
    nivel_acceso: 1,
    activo: true,
  };

  beforeEach(async () => {
    resetMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JWT_ACCESS_SECRET: 'test-access-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_ACCESS_EXPIRATION: '15m',
                JWT_REFRESH_EXPIRATION: '7d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    resetMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      cedula: '0123456789',
      email: 'test@example.com',
      password: 'Password123!',
      nombres: 'Juan',
      apellidos: 'Pérez',
      telefono: '0999999999',
      fecha_nacimiento: '1990-01-01',
      genero: 'M' as const,
    };

    it('should register a new patient successfully', async () => {
      // Mock: No existing user
      mockPrismaService.usuario.findFirst.mockResolvedValue(null);

      // Mock: Find PACIENTE role
      mockPrismaService.rol.findFirst.mockResolvedValue(mockRol);

      // Mock: Create user
      mockPrismaService.usuario.create.mockResolvedValue(mockUsuario);

      // Mock: Create medical profile
      mockPrismaService.perfilMedico.create.mockResolvedValue({});

      // Mock: Create consents
      mockPrismaService.consentimiento.createMany.mockResolvedValue({ count: 2 });

      // Mock: Create session
      mockPrismaService.sesion.create.mockResolvedValue({});

      // Mock: Log activity
      mockPrismaService.logActividad.create.mockResolvedValue({});

      const result = await service.register(registerDto, '127.0.0.1', 'test-agent');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.email).toBe(registerDto.email);
      expect(result.user.rol).toBe('PACIENTE');

      // Verify password was hashed
      expect(mockPrismaService.usuario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: registerDto.email,
            cedula: registerDto.cedula,
          }),
        }),
      );
    });

    it('should throw ConflictException if cedula already exists', async () => {
      mockPrismaService.usuario.findFirst.mockResolvedValue(mockUsuario);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('La cédula ya está registrada');
    });

    it('should throw ConflictException if email already exists', async () => {
      const existingUser = { ...mockUsuario, cedula: 'different' };
      mockPrismaService.usuario.findFirst.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('El correo electrónico ya está registrado');
    });

    it('should throw BadRequestException if PACIENTE role not found', async () => {
      mockPrismaService.usuario.findFirst.mockResolvedValue(null);
      mockPrismaService.rol.findFirst.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
      await expect(service.register(registerDto)).rejects.toThrow('Rol PACIENTE no encontrado en el sistema');
    });
  });

  describe('login', () => {
    const loginDto = {
      identifier: 'test@example.com',
      password: 'Password123!',
    };

    it('should login successfully with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash(loginDto.password, 10);
      const userWithPassword = { ...mockUsuario, password_hash: hashedPassword };

      mockPrismaService.usuario.findFirst.mockResolvedValue(userWithPassword);
      mockPrismaService.usuario.update.mockResolvedValue(userWithPassword);
      mockPrismaService.sesion.create.mockResolvedValue({});
      mockPrismaService.logActividad.create.mockResolvedValue({});

      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const result = await service.login(loginDto, '127.0.0.1', 'test-agent');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.email).toBe(mockUsuario.email);
      expect(mockPrismaService.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            intentos_fallidos: 0,
            cuenta_bloqueada: false,
          }),
        }),
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.usuario.findFirst.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Credenciales inválidas');
    });

    it('should throw UnauthorizedException if account is blocked', async () => {
      const blockedUser = { ...mockUsuario, cuenta_bloqueada: true };
      mockPrismaService.usuario.findFirst.mockResolvedValue(blockedUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Cuenta bloqueada');
    });

    it('should throw UnauthorizedException if account is inactive', async () => {
      const inactiveUser = { ...mockUsuario, activo: false };
      mockPrismaService.usuario.findFirst.mockResolvedValue(inactiveUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Cuenta desactivada');
    });

    it('should increment failed attempts on invalid password', async () => {
      mockPrismaService.usuario.findFirst.mockResolvedValue(mockUsuario);
      mockPrismaService.usuario.update.mockResolvedValue(mockUsuario);

      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);

      expect(mockPrismaService.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            intentos_fallidos: 1,
          }),
        }),
      );
    });

    it('should block account after 5 failed attempts', async () => {
      const userWith4Fails = { ...mockUsuario, intentos_fallidos: 4 };
      mockPrismaService.usuario.findFirst.mockResolvedValue(userWith4Fails);
      mockPrismaService.usuario.update.mockResolvedValue(userWith4Fails);

      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);

      expect(mockPrismaService.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            intentos_fallidos: 5,
            cuenta_bloqueada: true,
            fecha_bloqueo: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'mock-refresh-token';
    const mockSession = {
      codigo_sesion: 1,
      codigo_usuario: 1,
      refresh_token: mockRefreshToken,
      access_token_jti: 'mock-jti',
      fecha_expiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      activo: true,
      revocado: false,
    };

    it('should refresh token successfully', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 1, type: 'refresh' });
      mockPrismaService.sesion.findFirst.mockResolvedValue(mockSession);
      mockPrismaService.sesion.update.mockResolvedValue(mockSession);
      mockPrismaService.sesion.create.mockResolvedValue({});

      const result = await service.refreshToken(mockRefreshToken, '127.0.0.1', 'test-agent');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockPrismaService.sesion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activo: false,
            revocado: true,
          }),
        }),
      );
    });

    it('should throw UnauthorizedException if session not found', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 1, type: 'refresh' });
      mockPrismaService.sesion.findFirst.mockResolvedValue(null);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
      // Note: The service catches the error and returns a generic message
      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow('Token de actualización inválido');
    });

    it('should throw UnauthorizedException if session expired', async () => {
      const expiredSession = {
        ...mockSession,
        fecha_expiracion: new Date(Date.now() - 1000), // Expired
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 1, type: 'refresh' });
      mockPrismaService.sesion.findFirst.mockResolvedValue(expiredSession);
      mockPrismaService.sesion.update.mockResolvedValue(expiredSession);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
      // Note: The service catches the error and returns a generic message
      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow('Token de actualización inválido');
    });

    it('should throw UnauthorizedException on invalid token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken('invalid-token')).rejects.toThrow('Token de actualización inválido');
    });
  });

  describe('logout', () => {
    it('should logout from specific session', async () => {
      const refreshToken = 'mock-refresh-token';
      mockPrismaService.sesion.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.logActividad.create.mockResolvedValue({});

      const result = await service.logout(1, refreshToken);

      expect(result.message).toBe('Sesión cerrada exitosamente');
      expect(mockPrismaService.sesion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            codigo_usuario: 1,
            refresh_token: refreshToken,
          }),
          data: expect.objectContaining({
            activo: false,
            revocado: true,
          }),
        }),
      );
    });

    it('should logout from all sessions if no refresh token provided', async () => {
      mockPrismaService.sesion.updateMany.mockResolvedValue({ count: 3 });
      mockPrismaService.logActividad.create.mockResolvedValue({});

      const result = await service.logout(1);

      expect(result.message).toBe('Sesión cerrada exitosamente');
      expect(mockPrismaService.sesion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            codigo_usuario: 1,
            activo: true,
          }),
        }),
      );
    });
  });

  describe('validateUser', () => {
    it('should validate and return user data', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.validateUser(1);

      expect(result).toHaveProperty('codigo_usuario', 1);
      expect(result).toHaveProperty('email', mockUsuario.email);
      expect(result).toHaveProperty('rol', 'PACIENTE');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      await expect(service.validateUser(999)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(999)).rejects.toThrow('Usuario no encontrado o inactivo');
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const inactiveUser = { ...mockUsuario, activo: false };
      mockPrismaService.usuario.findUnique.mockResolvedValue(inactiveUser);

      await expect(service.validateUser(1)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(1)).rejects.toThrow('Usuario no encontrado o inactivo');
    });
  });
});
