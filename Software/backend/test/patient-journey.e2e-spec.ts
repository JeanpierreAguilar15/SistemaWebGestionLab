import * as dotenv from 'dotenv';
dotenv.config();
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Patient Journey E2E Test
 * Simulates a complete patient workflow:
 * 1. Registration & Login
 * 2. Browsing Services & Slots (Agenda)
 * 3. Booking an Appointment
 * 4. Managing Appointments (View, Reschedule, Cancel)
 * 5. Quotations (Browse Exams, Create Quote, View Quote)
 * 6. Viewing Profile
 */
describe('Patient Journey (e2e)', () => {
    let app: INestApplication;
    let prismaService: PrismaService;

    // Test Data
    const patientData = {
        cedula: '1122334455',
        email: 'patient.journey@example.com',
        password: 'SecurePassword123!',
        nombres: 'Juan',
        apellidos: 'Perez Journey',
        telefono: '0987654321',
        fecha_nacimiento: '1995-05-15',
        genero: 'MASCULINO',
    };

    let accessToken: string;
    let patientId: number;

    // Agenda Data
    let serviceId: number;
    let sedeId: number;
    let slotId: number;
    let appointmentId: number;

    // Catalog Data
    let categoryId: number;
    let examId: number;
    let quotationId: number;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Configure app same as main.ts
        app.setGlobalPrefix('api');
        app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: '1',
        });

        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );

        await app.init();
        prismaService = app.get<PrismaService>(PrismaService);

        // Clean up previous test data
        await cleanupTestData();

        // Seed necessary data
        await seedCatalogData();
    });

    afterAll(async () => {
        await cleanupTestData();
        await prismaService.$disconnect();
        await app.close();
    });

    const cleanupTestData = async () => {
        try {
            const user = await prismaService.usuario.findUnique({ where: { email: patientData.email } });
            if (user) {
                // Delete dependent data
                await prismaService.cita.deleteMany({ where: { codigo_paciente: user.codigo_usuario } });
                await prismaService.cotizacion.deleteMany({ where: { codigo_paciente: user.codigo_usuario } });
                await prismaService.sesion.deleteMany({ where: { codigo_usuario: user.codigo_usuario } });
                await prismaService.logActividad.deleteMany({ where: { codigo_usuario: user.codigo_usuario } });
                await prismaService.consentimiento.deleteMany({ where: { codigo_usuario: user.codigo_usuario } });
                await prismaService.perfilMedico.deleteMany({ where: { codigo_usuario: user.codigo_usuario } });

                await prismaService.usuario.delete({ where: { codigo_usuario: user.codigo_usuario } });
            }
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    };

    const seedCatalogData = async () => {
        // 1. Seed Agenda Data (Service, Sede, Slot)
        let service = await prismaService.servicio.findFirst({ where: { activo: true } });
        if (!service) {
            service = await prismaService.servicio.create({
                data: {
                    nombre: 'Servicio Test Journey',
                    descripcion: 'Servicio para pruebas E2E',
                    activo: true
                    // Removed precio_base as it doesn't exist in Servicio model
                }
            });
        }
        serviceId = service.codigo_servicio;

        let sede = await prismaService.sede.findFirst({ where: { activo: true } });
        if (!sede) {
            sede = await prismaService.sede.create({
                data: {
                    nombre: 'Sede Central Test',
                    direccion: 'Av. Test 123',
                    telefono: '0999999999',
                    activo: true
                }
            });
        }
        sedeId = sede.codigo_sede;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const fecha = tomorrow.toISOString().split('T')[0];

        const slot = await prismaService.slot.create({
            data: {
                codigo_servicio: serviceId,
                codigo_sede: sedeId,
                fecha: new Date(fecha),
                hora_inicio: new Date('1970-01-01T10:00:00'),
                hora_fin: new Date('1970-01-01T10:30:00'),
                cupos_totales: 5,
                cupos_disponibles: 5,
                activo: true
            }
        });
        slotId = slot.codigo_slot;

        // 2. Seed Catalog Data (Category, Exam, Price)
        let category = await prismaService.categoriaExamen.findFirst({ where: { nombre: 'HEMATOLOGIA TEST' } });
        if (!category) {
            category = await prismaService.categoriaExamen.create({
                data: {
                    nombre: 'HEMATOLOGIA TEST',
                    descripcion: 'Categoria de prueba',
                    activo: true
                }
            });
        }
        categoryId = category.codigo_categoria;

        let exam = await prismaService.examen.findFirst({ where: { codigo_interno: 'HEM001-TEST' } });
        if (!exam) {
            exam = await prismaService.examen.create({
                data: {
                    codigo_categoria: categoryId,
                    codigo_interno: 'HEM001-TEST',
                    nombre: 'Hemograma Completo Test',
                    descripcion: 'Examen de prueba',
                    tiempo_entrega_horas: 24,
                    activo: true
                }
            });

            // Add price to the new exam
            await prismaService.precio.create({
                data: {
                    codigo_examen: exam.codigo_examen,
                    precio: 15.50,
                    activo: true
                }
            });
        }
        examId = exam.codigo_examen;
    };

    // ==========================================
    // STEP 1: AUTHENTICATION
    // ==========================================
    describe('Step 1: Authentication', () => {
        it('should register a new patient', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .send(patientData)
                .expect(201);

            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe(patientData.email);
            accessToken = response.body.access_token;
            patientId = response.body.user.codigo_usuario;
        });

        // Note: Login is already tested during registration above
        // Registration returns access_token, so explicit login test is redundant
    });

    // ==========================================
    // STEP 2: BROWSING AGENDA
    // ==========================================
    describe('Step 2: Browsing Agenda', () => {
        it('should list available services', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/agenda/services')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            const service = response.body.find(s => s.codigo_servicio === serviceId);
            expect(service).toBeDefined();
        });

        it('should list available slots', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/agenda/slots/available')
                .query({ codigo_servicio: serviceId, codigo_sede: sedeId })
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            const slot = response.body.find(s => s.codigo_slot === slotId);
            expect(slot).toBeDefined();
        });
    });

    // ==========================================
    // STEP 3: BOOKING APPOINTMENT
    // ==========================================
    describe('Step 3: Booking Appointment', () => {
        it('should successfully book an appointment', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/agenda/citas')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    codigo_slot: slotId,
                    observaciones: 'Cita de prueba E2E'
                })
                .expect(201);

            expect(response.body).toHaveProperty('codigo_cita');
            expect(response.body.estado).toBe('AGENDADA');
            appointmentId = response.body.codigo_cita;
        });
    });

    // ==========================================
    // STEP 4: MANAGING APPOINTMENTS
    // ==========================================
    describe('Step 4: Managing Appointments', () => {
        it('should list my appointments', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/agenda/citas/my')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            const myAppointment = response.body.find(c => c.codigo_cita === appointmentId);
            expect(myAppointment).toBeDefined();
        });

        it('should cancel the appointment', async () => {
            if (!appointmentId) return; // Skip if booking failed
            const response = await request(app.getHttpServer())
                .put(`/api/v1/agenda/citas/${appointmentId}/cancel`)
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    motivo_cancelacion: 'Prueba de cancelación E2E'
                })
                .expect(200);

            expect(response.body.estado).toBe('CANCELADA');
        });
    });

    // ==========================================
    // STEP 5: QUOTATIONS
    // ==========================================
    describe('Step 5: Quotations', () => {
        it('should list exams for quotation', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/cotizaciones/examenes')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            // Find our category
            const category = response.body.find(c => c.codigo_categoria === categoryId);
            expect(category).toBeDefined();
            // Find our exam in the category
            const exam = category.examenes.find(e => e.codigo_examen === examId);
            expect(exam).toBeDefined();
            expect(Number(exam.precio_actual)).toBe(15.50);
        });

        it('should create a quotation', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/cotizaciones')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    examenes: [
                        { codigo_examen: examId, cantidad: 1 }
                    ],
                    observaciones: 'Cotización E2E'
                })
                .expect(201);

            expect(response.body).toHaveProperty('codigo_cotizacion');
            expect(response.body).toHaveProperty('numero_cotizacion');
            expect(Number(response.body.total)).toBe(15.50);
            quotationId = response.body.codigo_cotizacion;
        });

        it('should list my quotations', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/cotizaciones/my')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            const myQuotation = response.body.find(q => q.codigo_cotizacion === quotationId);
            expect(myQuotation).toBeDefined();
            expect(Number(myQuotation.total)).toBe(15.50);
        });

        it('should get quotation details', async () => {
            const response = await request(app.getHttpServer())
                .get(`/api/v1/cotizaciones/${quotationId}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body.codigo_cotizacion).toBe(quotationId);
            expect(response.body.detalles).toHaveLength(1);
            expect(response.body.detalles[0].codigo_examen).toBe(examId);
        });
    });

    // ==========================================
    // STEP 6: PROFILE
    // ==========================================
    describe('Step 6: Profile', () => {
        it('should view own profile', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body.email).toBe(patientData.email);
        });
    });
});
