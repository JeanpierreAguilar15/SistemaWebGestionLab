import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Pruebas de integración (E2E) para el módulo de autenticación
 *
 * IMPORTANTE: Estas pruebas usan una base de datos de test separada
 * para no afectar los datos de producción
 */
describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  // Mock data para las pruebas
  const testUser = {
    cedula: '0123456789',
    email: 'test-e2e@example.com',
    password: 'Password123!',
    nombres: 'Test',
    apellidos: 'User E2E',
    telefono: '0999999999',
    fecha_nacimiento: '1990-01-01',
    genero: 'M',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main app
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
    await prismaService.$disconnect();
    await app.close();
  });

  /**
   * Helper function to clean up test data
   */
  const cleanupTestData = async () => {
    try {
      // Delete in correct order to avoid foreign key constraints
      await prismaService.logActividad.deleteMany({
        where: {
          usuario: {
            email: {
              contains: 'test-e2e',
            },
          },
        },
      });

      await prismaService.sesion.deleteMany({
        where: {
          usuario: {
            email: {
              contains: 'test-e2e',
            },
          },
        },
      });

      await prismaService.consentimiento.deleteMany({
        where: {
          usuario: {
            email: {
              contains: 'test-e2e',
            },
          },
        },
      });

      await prismaService.perfilMedico.deleteMany({
        where: {
          usuario: {
            email: {
              contains: 'test-e2e',
            },
          },
        },
      });

      await prismaService.usuario.deleteMany({
        where: {
          email: {
            contains: 'test-e2e',
          },
        },
      });
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  };

  describe('/api/v1/auth/register (POST)', () => {
    beforeEach(async () => {
      await cleanupTestData();
    });

    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.rol).toBe('PACIENTE');
    });

    it('should fail with invalid email format', async () => {
      const invalidUser = { ...testUser, email: 'invalid-email' };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.message).toContain('email');
    });

    it('should fail with weak password', async () => {
      const weakPasswordUser = { ...testUser, password: '123' };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should fail with duplicate cedula', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      // Second registration with same cedula
      const duplicateUser = { ...testUser, email: 'different@example.com' };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(duplicateUser)
        .expect(409);

      expect(response.body.message).toContain('cédula');
    });

    it('should fail with duplicate email', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      // Second registration with same email
      const duplicateUser = { ...testUser, cedula: '9876543210' };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(duplicateUser)
        .expect(409);

      expect(response.body.message).toContain('correo');
    });
  });

  describe('/api/v1/auth/login (POST)', () => {
    beforeEach(async () => {
      await cleanupTestData();
      // Register a test user
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser);
    });

    it('should login with email successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          identifier: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should login with cedula successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          identifier: testUser.cedula,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.user.cedula).toBe(testUser.cedula);
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          identifier: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toContain('inválidas');
    });

    it('should fail with non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          identifier: 'nonexistent@example.com',
          password: 'Password123!',
        })
        .expect(401);

      expect(response.body.message).toContain('inválidas');
    });

    it('should block account after 5 failed attempts', async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            identifier: testUser.email,
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      // 6th attempt should indicate account is blocked
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          identifier: testUser.email,
          password: testUser.password, // Even with correct password
        })
        .expect(401);

      expect(response.body.message).toContain('bloqueada');
    });
  });

  describe('/api/v1/auth/refresh (POST)', () => {
    let refreshToken: string;

    beforeEach(async () => {
      await cleanupTestData();
      // Register and login to get refresh token
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser);

      refreshToken = registerResponse.body.refresh_token;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.refresh_token).not.toBe(refreshToken); // New token
    });

    it('should fail with invalid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should fail with already used refresh token', async () => {
      // Use refresh token once
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      // Try to use same token again
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('/api/v1/auth/logout (POST)', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      await cleanupTestData();
      // Register to get tokens
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser);

      accessToken = registerResponse.body.access_token;
      refreshToken = registerResponse.body.refresh_token;
    });

    it('should logout successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refresh_token: refreshToken })
        .expect(200);

      expect(response.body.message).toBeDefined();
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refresh_token: refreshToken })
        .expect(401);
    });

    it('should invalidate refresh token after logout', async () => {
      // Logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refresh_token: refreshToken })
        .expect(200);

      // Try to use refresh token after logout
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('/api/v1/auth/profile (GET)', () => {
    let accessToken: string;

    beforeEach(async () => {
      await cleanupTestData();
      // Register to get access token
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser);

      accessToken = registerResponse.body.access_token;
    });

    it('should get user profile successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('codigo_usuario');
      expect(response.body).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('rol');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .expect(401);
    });

    it('should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
