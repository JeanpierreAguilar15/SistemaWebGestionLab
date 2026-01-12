import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

import { AdminEventsService } from './admin-events.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private eventsService: AdminEventsService,
  ) { }

  // ==================== USUARIOS ====================
  // Logic moved to UsersService


  // ==================== ROLES ====================

  async getAllRoles() {
    return this.prisma.rol.findMany({
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
      orderBy: { nivel_acceso: 'desc' },
    });
  }

  async getRoleById(codigo_rol: number) {
    const role = await this.prisma.rol.findUnique({
      where: { codigo_rol },
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    return role;
  }

  async createRole(data: Prisma.RolCreateInput, adminId: number) {
    const role = await this.prisma.rol.create({
      data,
    });

    // Emitir evento de creación de rol
    this.eventsService.emitRoleCreated(
      role.codigo_rol,
      adminId,
      { nombre: role.nombre, nivel_acceso: role.nivel_acceso },
    );

    return role;
  }

  async updateRole(codigo_rol: number, data: Prisma.RolUpdateInput, adminId: number) {
    const role = await this.prisma.rol.findUnique({
      where: { codigo_rol },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    const updatedRole = await this.prisma.rol.update({
      where: { codigo_rol },
      data,
    });

    // Emitir evento de actualización de rol
    this.eventsService.emitRoleUpdated(
      codigo_rol,
      adminId,
      { changedFields: Object.keys(data) },
    );

    return updatedRole;
  }

  async deleteRole(codigo_rol: number, adminId: number) {
    const role = await this.prisma.rol.findUnique({
      where: { codigo_rol },
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (role._count.usuarios > 0) {
      throw new BadRequestException('No se puede eliminar un rol con usuarios asignados');
    }

    const deletedRole = await this.prisma.rol.delete({
      where: { codigo_rol },
    });

    // Emitir evento de eliminación de rol
    this.eventsService.emitRoleDeleted(codigo_rol, adminId);

    return deletedRole;
  }

  // ==================== SERVICIOS ====================

  async getAllServices() {
    return this.prisma.servicio.findMany({
      include: {
        _count: {
          select: { slots: true, horarios: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async getServiceById(codigo_servicio: number) {
    const service = await this.prisma.servicio.findUnique({
      where: { codigo_servicio },
      include: {
        horarios: {
          include: {
            sede: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    return service;
  }

  async createService(data: Prisma.ServicioCreateInput, adminId: number) {
    const service = await this.prisma.servicio.create({
      data,
    });

    // Emitir evento de creación de servicio
    this.eventsService.emitServiceCreated(
      service.codigo_servicio,
      adminId,
      { nombre: service.nombre, activo: service.activo },
    );

    return service;
  }

  async updateService(codigo_servicio: number, data: Prisma.ServicioUpdateInput, adminId: number) {
    const service = await this.prisma.servicio.findUnique({
      where: { codigo_servicio },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const updatedService = await this.prisma.servicio.update({
      where: { codigo_servicio },
      data,
    });

    // Emitir evento de actualización de servicio
    this.eventsService.emitServiceUpdated(
      codigo_servicio,
      adminId,
      { changedFields: Object.keys(data) },
    );

    return updatedService;
  }

  async deleteService(codigo_servicio: number, adminId: number) {
    const service = await this.prisma.servicio.findUnique({
      where: { codigo_servicio },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    // Desactivar en lugar de eliminar
    const result = await this.prisma.servicio.update({
      where: { codigo_servicio },
      data: { activo: false },
    });

    // Emitir evento de eliminación de servicio (soft delete)
    this.eventsService.emitServiceDeleted(codigo_servicio, adminId);

    return result;
  }

  // ==================== SEDES ====================

  async getAllLocations() {
    return this.prisma.sede.findMany({
      include: {
        _count: {
          select: { slots: true, horarios: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async getLocationById(codigo_sede: number) {
    const location = await this.prisma.sede.findUnique({
      where: { codigo_sede },
      include: {
        horarios: {
          include: {
            servicio: true,
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException('Sede no encontrada');
    }

    return location;
  }

  async createLocation(data: Prisma.SedeCreateInput, adminId: number) {
    const location = await this.prisma.sede.create({
      data,
    });

    // Emitir evento de creación de sede
    this.eventsService.emitLocationCreated(
      location.codigo_sede,
      adminId,
      { nombre: location.nombre, direccion: location.direccion, activo: location.activo },
    );

    return location;
  }

  async updateLocation(codigo_sede: number, data: Prisma.SedeUpdateInput, adminId: number) {
    const location = await this.prisma.sede.findUnique({
      where: { codigo_sede },
    });

    if (!location) {
      throw new NotFoundException('Sede no encontrada');
    }

    const updatedLocation = await this.prisma.sede.update({
      where: { codigo_sede },
      data,
    });

    // Emitir evento de actualización de sede
    this.eventsService.emitLocationUpdated(
      codigo_sede,
      adminId,
      { changedFields: Object.keys(data) },
    );

    return updatedLocation;
  }

  async deleteLocation(codigo_sede: number, adminId: number) {
    const location = await this.prisma.sede.findUnique({
      where: { codigo_sede },
    });

    if (!location) {
      throw new NotFoundException('Sede no encontrada');
    }

    // Desactivar en lugar de eliminar
    const result = await this.prisma.sede.update({
      where: { codigo_sede },
      data: { activo: false },
    });

    // Emitir evento de eliminación de sede (soft delete)
    this.eventsService.emitLocationDeleted(codigo_sede, adminId);

    return result;
  }

  // ==================== EXAMENES ====================

  async getAllExams(page: number = 1, limit: number = 50, filters?: any) {
    const skip = (page - 1) * limit;

    const where: Prisma.ExamenWhereInput = {};

    if (filters?.search) {
      where.OR = [
        { nombre: { contains: filters.search, mode: 'insensitive' } },
        { codigo_interno: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.codigo_categoria) {
      where.codigo_categoria = parseInt(filters.codigo_categoria);
    }

    if (filters?.activo !== undefined) {
      where.activo = filters.activo === 'true';
    }

    const [exams, total] = await Promise.all([
      this.prisma.examen.findMany({
        where,
        include: {
          categoria: true,
          precios: {
            where: { activo: true },
            orderBy: { fecha_inicio: 'desc' },
            take: 1,
          },
        },
        orderBy: { nombre: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.examen.count({ where }),
    ]);

    return {
      data: exams,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getExamById(codigo_examen: number) {
    const exam = await this.prisma.examen.findUnique({
      where: { codigo_examen },
      include: {
        categoria: true,
        precios: {
          orderBy: { fecha_inicio: 'desc' },
        },
        examenes_en_paquetes: {
          include: {
            paquete: true,
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException('Examen no encontrado');
    }

    return exam;
  }

  async createExam(data: any, adminId: number) {
    // Verificar que el codigo_interno no exista
    const existingExam = await this.prisma.examen.findUnique({
      where: { codigo_interno: data.codigo_interno },
    });

    if (existingExam) {
      throw new BadRequestException('El código interno ya existe');
    }

    const exam = await this.prisma.examen.create({
      data,
      include: {
        categoria: true,
      },
    });

    // Emitir evento de creación de examen
    this.eventsService.emitExamCreated(
      exam.codigo_examen,
      adminId,
      { nombre: exam.nombre, codigo_interno: exam.codigo_interno, activo: exam.activo },
    );

    return exam;
  }

  async updateExam(codigo_examen: number, data: any, adminId: number) {
    const exam = await this.prisma.examen.findUnique({
      where: { codigo_examen },
    });

    if (!exam) {
      throw new NotFoundException('Examen no encontrado');
    }

    // Si se está actualizando el codigo_interno, validar que no exista
    if (data.codigo_interno && data.codigo_interno !== exam.codigo_interno) {
      const existingExam = await this.prisma.examen.findUnique({
        where: { codigo_interno: data.codigo_interno },
      });

      if (existingExam) {
        throw new BadRequestException('El código interno ya existe');
      }
    }

    const updatedExam = await this.prisma.examen.update({
      where: { codigo_examen },
      data,
      include: {
        categoria: true,
      },
    });

    // Emitir evento de actualización de examen
    this.eventsService.emitExamUpdated(
      codigo_examen,
      adminId,
      { changedFields: Object.keys(data) },
    );

    return updatedExam;
  }

  async deleteExam(codigo_examen: number, adminId: number) {
    const exam = await this.prisma.examen.findUnique({
      where: { codigo_examen },
    });

    if (!exam) {
      throw new NotFoundException('Examen no encontrado');
    }

    // Desactivar en lugar de eliminar
    const result = await this.prisma.examen.update({
      where: { codigo_examen },
      data: { activo: false },
    });

    // Emitir evento de eliminación de examen
    this.eventsService.emitExamDeleted(codigo_examen, adminId);

    return result;
  }

  // ==================== PRECIOS ====================

  async getAllPrices(page: number = 1, limit: number = 50, filters?: any) {
    const skip = (page - 1) * limit;

    const where: Prisma.PrecioWhereInput = {};

    if (filters?.codigo_examen) {
      where.codigo_examen = parseInt(filters.codigo_examen);
    }

    if (filters?.activo !== undefined) {
      where.activo = filters.activo === 'true';
    }

    const [prices, total] = await Promise.all([
      this.prisma.precio.findMany({
        where,
        include: {
          examen: {
            select: {
              codigo_examen: true,
              nombre: true,
              codigo_interno: true,
            },
          },
        },
        orderBy: { fecha_inicio: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.precio.count({ where }),
    ]);

    return {
      data: prices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPriceById(codigo_precio: number) {
    const price = await this.prisma.precio.findUnique({
      where: { codigo_precio },
      include: {
        examen: true,
      },
    });

    if (!price) {
      throw new NotFoundException('Precio no encontrado');
    }

    return price;
  }

  async createPrice(data: any, adminId: number) {
    const price = await this.prisma.precio.create({
      data: {
        precio: data.precio,
        fecha_inicio: data.fecha_inicio || new Date(),
        fecha_fin: data.fecha_fin,
        activo: data.activo !== undefined ? data.activo : true,
        examen: {
          connect: { codigo_examen: data.codigo_examen },
        },
      },
      include: {
        examen: true,
      },
    });

    // Emitir evento de creación de precio
    this.eventsService.emitPriceCreated(
      price.codigo_precio,
      data.codigo_examen,
      adminId,
      { precio: price.precio, fecha_inicio: price.fecha_inicio },
    );

    return price;
  }

  async updatePrice(codigo_precio: number, data: any, adminId: number) {
    const price = await this.prisma.precio.findUnique({
      where: { codigo_precio },
    });

    if (!price) {
      throw new NotFoundException('Precio no encontrado');
    }

    const updateData: any = {};
    if (data.precio !== undefined) updateData.precio = data.precio;
    if (data.fecha_inicio !== undefined) updateData.fecha_inicio = data.fecha_inicio;
    if (data.fecha_fin !== undefined) updateData.fecha_fin = data.fecha_fin;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const updatedPrice = await this.prisma.precio.update({
      where: { codigo_precio },
      data: updateData,
      include: {
        examen: true,
      },
    });

    // Emitir evento de actualización de precio
    this.eventsService.emitPriceUpdated(
      codigo_precio,
      price.codigo_examen,
      adminId,
      { changedFields: Object.keys(updateData) },
    );

    return updatedPrice;
  }

  async deletePrice(codigo_precio: number, adminId: number) {
    const price = await this.prisma.precio.findUnique({
      where: { codigo_precio },
    });

    if (!price) {
      throw new NotFoundException('Precio no encontrado');
    }

    // Desactivar en lugar de eliminar (soft delete)
    const result = await this.prisma.precio.update({
      where: { codigo_precio },
      data: { activo: false },
    });

    // Emitir evento de eliminación de precio
    this.eventsService.emitPriceDeleted(codigo_precio, price.codigo_examen, adminId);

    return result;
  }

  // ==================== CATEGORIAS ====================

  async getAllExamCategories() {
    return this.prisma.categoriaExamen.findMany({
      include: {
        _count: {
          select: { examenes: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async createExamCategory(data: Prisma.CategoriaExamenCreateInput, adminId: number) {
    const category = await this.prisma.categoriaExamen.create({
      data,
    });

    // Emitir evento de creación de categoría
    this.eventsService.emitCategoryCreated(
      category.codigo_categoria,
      adminId,
      { nombre: category.nombre, descripcion: category.descripcion },
    );

    return category;
  }

  async updateExamCategory(codigo_categoria: number, data: Prisma.CategoriaExamenUpdateInput, adminId: number) {
    const category = await this.prisma.categoriaExamen.findUnique({
      where: { codigo_categoria },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    const updatedCategory = await this.prisma.categoriaExamen.update({
      where: { codigo_categoria },
      data,
    });

    // Emitir evento de actualización de categoría
    this.eventsService.emitCategoryUpdated(
      codigo_categoria,
      adminId,
      { changedFields: Object.keys(data) },
    );

    return updatedCategory;
  }

  async deleteExamCategory(codigo_categoria: number, adminId: number) {
    const category = await this.prisma.categoriaExamen.findUnique({
      where: { codigo_categoria },
      include: {
        _count: {
          select: { examenes: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (category._count.examenes > 0) {
      throw new BadRequestException('No se puede eliminar una categoría con exámenes asignados');
    }

    const deletedCategory = await this.prisma.categoriaExamen.delete({
      where: { codigo_categoria },
    });

    // Emitir evento de eliminación de categoría
    this.eventsService.emitCategoryDeleted(codigo_categoria, adminId);

    return deletedCategory;
  }

  // ==================== PAQUETES ====================

  async getAllPackages() {
    return this.prisma.paquete.findMany({
      include: {
        examenes: {
          include: {
            examen: true,
          },
        },
        _count: {
          select: { examenes: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async getPackageById(codigo_paquete: number) {
    const package_ = await this.prisma.paquete.findUnique({
      where: { codigo_paquete },
      include: {
        examenes: {
          include: {
            examen: {
              include: {
                categoria: true,
              },
            },
          },
        },
      },
    });

    if (!package_) {
      throw new NotFoundException('Paquete no encontrado');
    }

    return package_;
  }

  async createPackage(data: any, adminId: number) {
    const { examenes, ...packageData } = data;

    const package_ = await this.prisma.paquete.create({
      data: {
        ...packageData,
        examenes: examenes
          ? {
            create: examenes.map((examen_id: number) => ({
              codigo_examen: examen_id,
            })),
          }
          : undefined,
      },
      include: {
        examenes: {
          include: {
            examen: true,
          },
        },
      },
    });

    // Emitir evento de creación de paquete
    this.eventsService.emitPackageCreated(
      package_.codigo_paquete,
      adminId,
      { nombre: package_.nombre, precio_paquete: package_.precio_paquete, examenesCount: examenes?.length || 0 },
    );

    return package_;
  }

  async updatePackage(codigo_paquete: number, data: any, adminId: number) {
    const package_ = await this.prisma.paquete.findUnique({
      where: { codigo_paquete },
    });

    if (!package_) {
      throw new NotFoundException('Paquete no encontrado');
    }

    const { examenes, ...packageData } = data;

    // Si se proporcionan exámenes, actualizar la relación
    if (examenes !== undefined) {
      // Eliminar exámenes existentes y crear nuevos
      await this.prisma.paqueteExamen.deleteMany({
        where: { codigo_paquete },
      });

      await this.prisma.paqueteExamen.createMany({
        data: examenes.map((examen_id: number) => ({
          codigo_paquete,
          codigo_examen: examen_id,
        })),
      });
    }

    const updatedPackage = await this.prisma.paquete.update({
      where: { codigo_paquete },
      data: packageData,
      include: {
        examenes: {
          include: {
            examen: true,
          },
        },
      },
    });

    // Emitir evento de actualización de paquete
    this.eventsService.emitPackageUpdated(
      codigo_paquete,
      adminId,
      { changedFields: Object.keys(data), examenesUpdated: examenes !== undefined },
    );

    return updatedPackage;
  }

  async deletePackage(codigo_paquete: number, adminId: number) {
    const package_ = await this.prisma.paquete.findUnique({
      where: { codigo_paquete },
    });

    if (!package_) {
      throw new NotFoundException('Paquete no encontrado');
    }

    // Desactivar en lugar de eliminar
    const result = await this.prisma.paquete.update({
      where: { codigo_paquete },
      data: { activo: false },
    });

    // Emitir evento de eliminación de paquete (soft delete)
    this.eventsService.emitPackageDeleted(codigo_paquete, adminId);

    return result;
  }

  // ==================== INVENTARIO ====================
  // Logic moved to InventarioService


  // ==================== AUDITORIA ====================

  async getActivityLogs(page: number = 1, limit: number = 50, filters?: any) {
    const skip = (page - 1) * limit;

    const where: Prisma.LogActividadWhereInput = {};

    if (filters?.codigo_usuario) {
      where.codigo_usuario = parseInt(filters.codigo_usuario);
    }

    if (filters?.accion) {
      where.accion = { contains: filters.accion, mode: 'insensitive' };
    }

    if (filters?.entidad) {
      where.entidad = filters.entidad;
    }

    if (filters?.fecha_inicio && filters?.fecha_fin) {
      where.fecha_accion = {
        gte: new Date(filters.fecha_inicio),
        lte: new Date(filters.fecha_fin),
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.logActividad.findMany({
        where,
        include: {
          usuario: {
            select: {
              nombres: true,
              apellidos: true,
              email: true,
            },
          },
        },
        orderBy: { fecha_accion: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.logActividad.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getErrorLogs(page: number = 1, limit: number = 50, filters?: any) {
    const skip = (page - 1) * limit;

    const where: Prisma.LogErrorWhereInput = {};

    if (filters?.nivel) {
      where.nivel = filters.nivel;
    }

    if (filters?.fecha_inicio && filters?.fecha_fin) {
      where.fecha_error = {
        gte: new Date(filters.fecha_inicio),
        lte: new Date(filters.fecha_fin),
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.logError.findMany({
        where,
        include: {
          usuario: {
            select: {
              nombres: true,
              apellidos: true,
              email: true,
            },
          },
        },
        orderBy: { fecha_error: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.logError.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Generar PDF de auditoría con filtros
   */
  async generateAuditPdf(filters?: any): Promise<Buffer> {
    try {
      // Importación dinámica de PDFKit
      const PDFKit = await import('pdfkit');
      const PDFDocument = (PDFKit.default as any) || PDFKit;

      // Construir filtros para query
      const where: Prisma.LogActividadWhereInput = {};

      if (filters?.search) {
        where.OR = [
          { accion: { contains: filters.search, mode: 'insensitive' } },
          { entidad: { contains: filters.search, mode: 'insensitive' } },
          { descripcion: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters?.entidad) {
        where.entidad = filters.entidad;
      }

      if (filters?.fecha_desde || filters?.fecha_hasta) {
        where.fecha_accion = {};

        if (filters.fecha_desde) {
          where.fecha_accion.gte = new Date(filters.fecha_desde);
        }

        if (filters.fecha_hasta) {
          const fechaHasta = new Date(filters.fecha_hasta);
          fechaHasta.setHours(23, 59, 59, 999);
          where.fecha_accion.lte = fechaHasta;
        }
      }

      // Obtener logs con límite
      const limit = filters?.limit ? parseInt(filters.limit) : 50;
      const logs = await this.prisma.logActividad.findMany({
        where,
        include: {
          usuario: {
            select: {
              nombres: true,
              apellidos: true,
              email: true,
            },
          },
        },
        orderBy: { fecha_accion: 'desc' },
        take: limit,
      });

      // Crear PDF en memoria
      return new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({
            size: 'LETTER',
            margins: {
              top: 50,
              bottom: 50,
              left: 50,
              right: 50,
            },
            info: {
              Title: 'Reporte de Auditoría',
              Author: 'Laboratorio Clínico Franz',
              Subject: 'Registro de Actividades del Sistema',
              Creator: 'Sistema de Gestión Laboratorio Franz',
            },
          });

          const chunks: Buffer[] = [];

          doc.on('data', (chunk) => chunks.push(chunk));
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', reject);

          // Header
          doc
            .fontSize(20)
            .fillColor('#2563EB')
            .font('Helvetica-Bold')
            .text('LABORATORIO CLÍNICO FRANZ', { align: 'center' });

          doc
            .fontSize(10)
            .fillColor('#666666')
            .font('Helvetica')
            .text('Sistema de Auditoría', { align: 'center' })
            .moveDown(0.5);

          // Línea separadora
          doc
            .strokeColor('#2563EB')
            .lineWidth(2)
            .moveTo(50, doc.y)
            .lineTo(562, doc.y)
            .stroke()
            .moveDown(1);

          // Título del documento
          doc
            .fontSize(16)
            .fillColor('#000000')
            .font('Helvetica-Bold')
            .text('REPORTE DE AUDITORÍA', { align: 'center' })
            .moveDown(1);

          // Información del reporte
          const now = new Date();
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#333333')
            .text(`Fecha de generación: ${this.formatDate(now)}`, { align: 'left' })
            .text(`Hora: ${this.formatTime(now)}`, { align: 'left' });

          // Filtros aplicados
          if (filters?.fecha_desde || filters?.fecha_hasta || filters?.entidad) {
            doc.moveDown(0.5).font('Helvetica-Bold').text('Filtros aplicados:', { align: 'left' });
            doc.font('Helvetica');

            if (filters.fecha_desde) {
              doc.text(`  • Desde: ${filters.fecha_desde}`, { align: 'left' });
            }
            if (filters.fecha_hasta) {
              doc.text(`  • Hasta: ${filters.fecha_hasta}`, { align: 'left' });
            }
            if (filters.entidad) {
              doc.text(`  • Entidad: ${filters.entidad}`, { align: 'left' });
            }
          }

          doc.moveDown(0.5).text(`Total de registros: ${logs.length}`, { align: 'left' }).moveDown(1);

          // Tabla de logs
          const tableTop = doc.y;
          const colWidths = {
            fecha: 90,
            usuario: 120,
            accion: 120,
            entidad: 80,
            ip: 80,
          };

          // Headers de tabla
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#FFFFFF');

          // Fondo de headers
          doc
            .rect(50, doc.y, 512, 20)
            .fill('#2563EB');

          let currentY = doc.y + 5;
          doc
            .fillColor('#FFFFFF')
            .text('Fecha/Hora', 55, currentY, { width: colWidths.fecha })
            .text('Usuario', 145, currentY, { width: colWidths.usuario })
            .text('Acción', 265, currentY, { width: colWidths.accion })
            .text('Entidad', 385, currentY, { width: colWidths.entidad })
            .text('IP', 465, currentY, { width: colWidths.ip });

          doc.moveDown(1.5);

          // Contenido de tabla
          doc.fontSize(8).font('Helvetica').fillColor('#333333');

          for (const log of logs) {
            // Verificar si necesitamos nueva página
            if (doc.y > 700) {
              doc.addPage();
              currentY = 50;
              doc.y = currentY;
            } else {
              currentY = doc.y;
            }

            const fecha = new Date(log.fecha_accion);
            const fechaStr = `${this.formatDate(fecha)}\n${this.formatTime(fecha)}`;
            const usuarioStr = log.usuario
              ? `${log.usuario.nombres} ${log.usuario.apellidos}\n${log.usuario.email}`
              : 'Sistema';
            const accionStr = log.accion || '-';
            const entidadStr = log.entidad || '-';
            const ipStr = log.ip_address || '-';

            // Calcular altura de la fila
            const rowHeight = Math.max(
              this.calculateTextHeight(doc, fechaStr, colWidths.fecha),
              this.calculateTextHeight(doc, usuarioStr, colWidths.usuario),
              this.calculateTextHeight(doc, accionStr, colWidths.accion),
              this.calculateTextHeight(doc, entidadStr, colWidths.entidad),
              this.calculateTextHeight(doc, ipStr, colWidths.ip)
            ) + 10;

            // Fondo alternado
            if (logs.indexOf(log) % 2 === 0) {
              doc.rect(50, currentY, 512, rowHeight).fill('#F3F4F6');
            }

            doc.fillColor('#333333');
            doc.text(fechaStr, 55, currentY + 5, { width: colWidths.fecha });
            doc.text(usuarioStr, 145, currentY + 5, { width: colWidths.usuario });
            doc.text(accionStr, 265, currentY + 5, { width: colWidths.accion });
            doc.text(entidadStr, 385, currentY + 5, { width: colWidths.entidad });
            doc.text(ipStr, 465, currentY + 5, { width: colWidths.ip });

            doc.y = currentY + rowHeight;
          }

          // Footer
          doc.moveDown(2);
          doc
            .fontSize(8)
            .fillColor('#999999')
            .text(
              '─────────────────────────────────────────────────────────────────────────',
              { align: 'center' }
            )
            .text('Documento generado automáticamente por el Sistema de Gestión Laboratorio Franz', {
              align: 'center',
            })
            .text(`Página generada el ${this.formatDate(now)} a las ${this.formatTime(now)}`, {
              align: 'center',
            });

          doc.end();
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      throw new Error(`Error al generar PDF de auditoría: ${error.message}`);
    }
  }

  /**
   * Formatear fecha en español
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  /**
   * Formatear hora
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Calcular altura de texto para tabla
   */
  private calculateTextHeight(doc: any, text: string, width: number): number {
    const fontSize = doc._fontSize || 8;
    const lineHeight = fontSize * 1.2;
    const lines = text.split('\n').length;
    return lines * lineHeight;
  }

  // ==================== ESTADÍSTICAS ====================

  async getDashboardStats() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        totalUsers,
        activeUsers,
        totalExams,
        totalAppointments,
        todayAppointments,
        completedAppointments,
        pendingResults,
        lowStockItems,
        monthlyRevenue,
        totalRevenue,
        totalQuotations,
        approvedQuotations,
        pendingQuotations,
        recentExams,
      ] = await Promise.all([
        // Usuarios
        this.prisma.usuario.count(),
        this.prisma.usuario.count({ where: { activo: true } }),

        // Exámenes
        this.prisma.examen.count({ where: { activo: true } }),

        // Citas
        this.prisma.cita.count(),
        this.prisma.cita.count({
          where: {
            slot: {
              fecha: {
                gte: today,
                lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
              },
            },
          },
        }),
        this.prisma.cita.count({
          where: { estado: 'COMPLETADA' },
        }),

        // Resultados pendientes
        this.prisma.resultado.count({
          where: { estado: 'EN_PROCESO' },
        }),

        // Inventario bajo stock (usando raw query porque necesitamos comparar columnas)
        this.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::int as count
          FROM inventario.item
          WHERE activo = true AND stock_actual <= stock_minimo
        `.then(result => Number(result[0]?.count || 0)).catch(() => 0),

        // Ingresos
        this.prisma.pago.aggregate({
          where: {
            estado: 'COMPLETADO',
            fecha_pago: { gte: startOfMonth },
          },
          _sum: { monto_total: true },
        }).then(r => Number(r._sum.monto_total || 0)),

        this.prisma.pago.aggregate({
          where: { estado: 'COMPLETADO' },
          _sum: { monto_total: true },
        }).then(r => Number(r._sum.monto_total || 0)),

        // Cotizaciones
        this.prisma.cotizacion.count(),
        this.prisma.cotizacion.count({ where: { estado: 'APROBADA' } }),
        this.prisma.cotizacion.count({ where: { estado: 'PENDIENTE' } }),

        // Últimos exámenes
        this.prisma.examen.findMany({
          where: { activo: true },
          select: {
            codigo_examen: true,
            nombre: true,
            codigo_interno: true,
            fecha_creacion: true,
          },
          orderBy: { fecha_creacion: 'desc' },
          take: 5,
        }),
      ]);

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
        },
        exams: {
          total: totalExams,
        },
        appointments: {
          total: totalAppointments,
          today: todayAppointments,
          completed: completedAppointments,
          completionRate: totalAppointments > 0
            ? Math.round((completedAppointments / totalAppointments) * 100)
            : 0,
        },
        results: {
          pending: pendingResults,
        },
        inventory: {
          lowStock: lowStockItems,
        },
        revenue: {
          monthly: monthlyRevenue,
          total: totalRevenue,
        },
        quotations: {
          total: totalQuotations,
          approved: approvedQuotations,
          pending: pendingQuotations,
          conversionRate: totalQuotations > 0
            ? Math.round((approvedQuotations / totalQuotations) * 100)
            : 0,
        },
        recentExams: recentExams.map(exam => ({
          code: exam.codigo_interno,
          name: exam.nombre,
          date: exam.fecha_creacion,
        })),
      };
    } catch (error) {
      this.logger.error('Error getting dashboard stats:', error);
      // Retornar estructura vacía en caso de error
      return {
        users: { total: 0, active: 0 },
        exams: { total: 0 },
        appointments: { total: 0, today: 0, completed: 0, completionRate: 0 },
        results: { pending: 0 },
        inventory: { lowStock: 0 },
        revenue: { monthly: 0, total: 0 },
        quotations: { total: 0, approved: 0, pending: 0, conversionRate: 0 },
        recentExams: [],
      };
    }
  }

  // ==================== ÓRDENES DE COMPRA ====================
  // Logic moved to InventarioService

  // ==================== CONFIGURACIÓN DEL SISTEMA ====================

  /**
   * Obtiene todas las configuraciones del sistema agrupadas
   */
  async getSystemConfig(grupo?: string) {
    const where: any = {};
    if (grupo) {
      where.grupo = grupo;
    }

    const configs = await this.prisma.configuracionSistema.findMany({
      where,
      orderBy: [{ grupo: 'asc' }, { clave: 'asc' }],
    });

    // Agrupar por grupo
    const grouped = configs.reduce((acc, config) => {
      if (!acc[config.grupo]) {
        acc[config.grupo] = [];
      }
      acc[config.grupo].push({
        codigo: config.codigo_config,
        clave: config.clave,
        valor: config.valor,
        descripcion: config.descripcion,
        tipo_dato: config.tipo_dato,
        es_publico: config.es_publico,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return grouped;
  }

  /**
   * Obtiene la configuración de seguridad de login
   */
  async getSecurityConfig() {
    const configs = await this.prisma.configuracionSistema.findMany({
      where: { grupo: 'SEGURIDAD' },
    });

    // Valores por defecto
    let maxIntentos = 5;
    let minutosBloqueo = 5;

    configs.forEach(config => {
      if (config.clave === 'LOGIN_MAX_INTENTOS') {
        maxIntentos = parseInt(config.valor) || 5;
      }
      if (config.clave === 'LOGIN_MINUTOS_BLOQUEO') {
        minutosBloqueo = parseInt(config.valor) || 5;
      }
    });

    return {
      maxIntentos,
      minutosBloqueo,
      configs: configs.map(c => ({
        codigo: c.codigo_config,
        clave: c.clave,
        valor: c.valor,
        descripcion: c.descripcion,
      })),
    };
  }

  /**
   * Actualiza una configuración del sistema
   */
  async updateSystemConfig(clave: string, valor: string, adminId: number) {
    const config = await this.prisma.configuracionSistema.findUnique({
      where: { clave },
    });

    if (!config) {
      throw new NotFoundException(`Configuración '${clave}' no encontrada`);
    }

    // Validar valor según tipo de dato
    if (config.tipo_dato === 'INTEGER') {
      const numValue = parseInt(valor);
      if (isNaN(numValue) || numValue < 1) {
        throw new BadRequestException('El valor debe ser un número entero positivo');
      }
    }

    const updated = await this.prisma.configuracionSistema.update({
      where: { clave },
      data: { valor },
    });

    this.logger.log(`Config '${clave}' actualizada a '${valor}' por admin ${adminId}`);

    return {
      codigo: updated.codigo_config,
      clave: updated.clave,
      valor: updated.valor,
      descripcion: updated.descripcion,
    };
  }

  /**
   * Inicializa las configuraciones de seguridad si no existen
   */
  async ensureSecurityConfigs() {
    const defaultConfigs = [
      {
        clave: 'LOGIN_MAX_INTENTOS',
        valor: '5',
        descripcion: 'Número máximo de intentos de login fallidos antes de bloquear la cuenta temporalmente',
        grupo: 'SEGURIDAD',
        tipo_dato: 'INTEGER',
      },
      {
        clave: 'LOGIN_MINUTOS_BLOQUEO',
        valor: '5',
        descripcion: 'Minutos de bloqueo temporal después de exceder los intentos máximos',
        grupo: 'SEGURIDAD',
        tipo_dato: 'INTEGER',
      },
    ];

    for (const config of defaultConfigs) {
      await this.prisma.configuracionSistema.upsert({
        where: { clave: config.clave },
        update: {},
        create: config,
      });
    }

    return { message: 'Configuraciones de seguridad inicializadas' };
  }

  /**
   * Desbloquea una cuenta de usuario manualmente
   */
  async unlockUserAccount(codigoUsuario: number, adminId: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { codigo_usuario: codigoUsuario },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.prisma.usuario.update({
      where: { codigo_usuario: codigoUsuario },
      data: {
        cuenta_bloqueada: false,
        intentos_fallidos: 0,
        fecha_bloqueo: null,
      },
    });

    this.logger.log(`Cuenta ${codigoUsuario} desbloqueada por admin ${adminId}`);

    return { message: 'Cuenta desbloqueada exitosamente' };
  }

  /**
   * Obtiene usuarios con cuentas bloqueadas
   */
  async getBlockedUsers() {
    return this.prisma.usuario.findMany({
      where: { cuenta_bloqueada: true },
      select: {
        codigo_usuario: true,
        cedula: true,
        email: true,
        nombres: true,
        apellidos: true,
        intentos_fallidos: true,
        fecha_bloqueo: true,
      },
      orderBy: { fecha_bloqueo: 'desc' },
    });
  }
}
