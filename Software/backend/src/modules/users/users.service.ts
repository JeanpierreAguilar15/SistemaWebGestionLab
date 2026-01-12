import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ValidateCedulaEcuatoriana } from '../../common/utils/validation.utils';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async findAll(page: number = 1, limit: number = 20, filters?: any) {
    const skip = (page - 1) * limit;

    const where: Prisma.UsuarioWhereInput = {};

    if (filters?.search) {
      where.OR = [
        { nombres: { contains: filters.search, mode: 'insensitive' } },
        { apellidos: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { cedula: { contains: filters.search } },
      ];
    }

    if (filters?.codigo_rol) {
      where.codigo_rol = parseInt(filters.codigo_rol);
    }

    if (filters?.activo !== undefined) {
      where.activo = filters.activo === 'true';
    }

    const [users, total] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        include: {
          rol: true,
        },
        orderBy: { fecha_creacion: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.usuario.count({ where }),
    ]);

    // Remover información sensible
    const sanitizedUsers = users.map(({ password_hash, salt, ...user }) => user);

    return {
      data: sanitizedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(codigo_usuario: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { codigo_usuario },
      include: {
        rol: true,
        perfil_medico: true,
        sesiones: {
          where: { activo: true },
          orderBy: { fecha_creacion: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const { password_hash, salt, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  async findByCedula(cedula: string) {
    return this.prisma.usuario.findUnique({
      where: { cedula },
      include: { rol: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.usuario.findUnique({
      where: { email },
      include: { rol: true },
    });
  }

  async create(data: any, adminId?: number) {
    // Validar formato de cédula ecuatoriana
    if (!ValidateCedulaEcuatoriana(data.cedula)) {
      throw new BadRequestException('La cédula ecuatoriana no es válida');
    }

    // Validar que el email y cedula no existan
    const existingUser = await this.prisma.usuario.findFirst({
      where: {
        OR: [
          { email: data.email },
          { cedula: data.cedula },
        ],
      },
    });

    if (existingUser) {
      throw new BadRequestException('El email o cédula ya están registrados');
    }

    // Generar salt y hash de password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(data.password, salt);

    const { password, ...userData } = data;

    const user = await this.prisma.usuario.create({
      data: {
        ...userData,
        password_hash,
        salt,
      },
      include: {
        rol: true,
      },
    });

    // Emitir evento de creación de usuario
    this.emitUserEvent('created', user.codigo_usuario, adminId, {
      rol: user.rol.nombre,
      email: user.email,
      nombres: user.nombres,
    });

    const { password_hash: _, salt: __, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  async update(codigo_usuario: number, data: any, adminId?: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { codigo_usuario },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validar formato de cédula si se está actualizando
    if (data.cedula && !ValidateCedulaEcuatoriana(data.cedula)) {
      throw new BadRequestException('La cédula ecuatoriana no es válida');
    }

    // Si se está actualizando email o cedula, validar que no existan
    if (data.email || data.cedula) {
      const existingUser = await this.prisma.usuario.findFirst({
        where: {
          AND: [
            { codigo_usuario: { not: codigo_usuario } },
            {
              OR: [
                ...(data.email ? [{ email: data.email }] : []),
                ...(data.cedula ? [{ cedula: data.cedula }] : []),
              ],
            },
          ],
        },
      });

      if (existingUser) {
        throw new BadRequestException('El email o cédula ya están registrados');
      }
    }

    const updatedUser = await this.prisma.usuario.update({
      where: { codigo_usuario },
      data,
      include: {
        rol: true,
      },
    });

    // Emitir evento de actualización de usuario
    this.emitUserEvent('updated', codigo_usuario, adminId, {
      changedFields: Object.keys(data),
    });

    const { password_hash, salt, ...sanitizedUser } = updatedUser;
    return sanitizedUser;
  }

  async delete(codigo_usuario: number, adminId?: number) {
    // Verificar que el usuario existe y obtener sus relaciones activas
    const user = await this.prisma.usuario.findUnique({
      where: { codigo_usuario },
      include: {
        citas_como_paciente: {
          where: {
            estado: {
              in: ['PENDIENTE', 'CONFIRMADA', 'EN_PROCESO'],
            },
          },
        },
        cotizaciones: {
          where: {
            estado: {
              in: ['PENDIENTE', 'APROBADA'],
            },
          },
        },
        _count: {
          select: {
            citas_como_paciente: true,
            cotizaciones: true,
            resultados_procesados: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar si tiene citas activas
    if (user.citas_como_paciente.length > 0) {
      throw new BadRequestException(
        `No se puede desactivar el usuario porque tiene ${user.citas_como_paciente.length} cita(s) activa(s). ` +
        'Por favor, cancele o complete las citas primero.'
      );
    }

    // Verificar si tiene cotizaciones pendientes
    if (user.cotizaciones.length > 0) {
      throw new BadRequestException(
        `No se puede desactivar el usuario porque tiene ${user.cotizaciones.length} cotización(es) pendiente(s). ` +
        'Por favor, complete o cancele las cotizaciones primero.'
      );
    }

    // Generar advertencias
    const warnings = [];
    if (user._count.citas_como_paciente > 0) {
      warnings.push(`${user._count.citas_como_paciente} cita(s) en historial`);
    }
    if (user._count.cotizaciones > 0) {
      warnings.push(`${user._count.cotizaciones} cotización(es) en historial`);
    }
    if (user._count.resultados_procesados > 0) {
      warnings.push(`${user._count.resultados_procesados} resultado(s) procesado(s)`);
    }

    // Desactivar usuario (soft delete)
    const updatedUser = await this.prisma.usuario.update({
      where: { codigo_usuario },
      data: { activo: false },
    });

    // Emitir evento de eliminación
    this.emitUserEvent('deleted', codigo_usuario, adminId);

    const { password_hash, salt, ...sanitizedUser } = updatedUser;

    return {
      ...sanitizedUser,
      ...(warnings.length > 0 && {
        warnings,
        message: `Usuario desactivado. Mantiene historial: ${warnings.join(', ')}`
      }),
    };
  }

  async toggleStatus(codigo_usuario: number, adminId?: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { codigo_usuario },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updatedUser = await this.prisma.usuario.update({
      where: { codigo_usuario },
      data: { activo: !user.activo },
    });

    // Emitir evento de cambio de estado
    this.emitUserEvent('status_changed', codigo_usuario, adminId, {
      activo: updatedUser.activo,
    });

    const { password_hash, salt, ...sanitizedUser } = updatedUser;
    return sanitizedUser;
  }

  async resetPassword(codigo_usuario: number, newPassword: string, adminId?: number) {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await this.prisma.usuario.update({
      where: { codigo_usuario },
      data: {
        password_hash,
        salt,
        intentos_fallidos: 0,
        cuenta_bloqueada: false,
        fecha_bloqueo: null,
      },
    });

    // Emitir evento de reset de password
    this.emitUserEvent('updated', codigo_usuario, adminId, {
      action: 'password_reset',
      cuenta_desbloqueada: true,
    });

    return { message: 'Contraseña restablecida exitosamente' };
  }

  private emitUserEvent(action: string, userId: number, adminId: number = 0, data?: any) {
    const eventType = `admin.user.${action}`;
    const payload = {
      entityType: 'user',
      entityId: userId,
      action,
      userId: adminId,
      data,
      timestamp: new Date(),
    };

    this.eventEmitter.emit(eventType, payload);
    this.eventEmitter.emit('admin.*', { eventType, ...payload });
  }
}
