import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SystemConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createConfigDto: CreateConfigDto, userId: number) {
    const existingConfig = await this.prisma.configuracionSistema.findUnique({
      where: { clave: createConfigDto.clave },
    });

    if (existingConfig) {
      throw new BadRequestException(`La configuración con clave '${createConfigDto.clave}' ya existe.`);
    }

    const config = await this.prisma.configuracionSistema.create({
      data: createConfigDto,
    });

    this.eventEmitter.emit('admin.config.created', {
      entityType: 'system_config',
      entityId: config.codigo_config,
      action: 'created',
      userId,
      data: config,
    });

    return config;
  }

  async findAll(isPublicOnly: boolean = false) {
    const where = isPublicOnly ? { es_publico: true } : {};
    return this.prisma.configuracionSistema.findMany({
      where,
      orderBy: { grupo: 'asc' },
    });
  }

  async findOne(id: number) {
    const config = await this.prisma.configuracionSistema.findUnique({
      where: { codigo_config: id },
    });

    if (!config) {
      throw new NotFoundException(`Configuración con ID ${id} no encontrada.`);
    }

    return config;
  }

  async findByKey(key: string) {
    const config = await this.prisma.configuracionSistema.findUnique({
      where: { clave: key },
    });

    if (!config) {
      throw new NotFoundException(`Configuración con clave '${key}' no encontrada.`);
    }

    return config;
  }

  async update(id: number, updateConfigDto: UpdateConfigDto, userId: number) {
    await this.findOne(id); // Verify existence

    const config = await this.prisma.configuracionSistema.update({
      where: { codigo_config: id },
      data: updateConfigDto,
    });

    this.eventEmitter.emit('admin.config.updated', {
      entityType: 'system_config',
      entityId: config.codigo_config,
      action: 'updated',
      userId,
      data: { ...config, changes: updateConfigDto },
    });

    return config;
  }

  async remove(id: number, userId: number) {
    await this.findOne(id); // Verify existence

    const config = await this.prisma.configuracionSistema.delete({
      where: { codigo_config: id },
    });

    this.eventEmitter.emit('admin.config.deleted', {
      entityType: 'system_config',
      entityId: config.codigo_config,
      action: 'deleted',
      userId,
      data: config,
    });

    return config;
  }

  async getPublicConfig() {
    const configs = await this.prisma.configuracionSistema.findMany({
      where: { es_publico: true },
    });

    // Transform array to object for easier consumption by frontend
    return configs.reduce((acc, curr) => {
      acc[curr.clave] = this.parseValue(curr.valor, curr.tipo_dato);
      return acc;
    }, {});
  }

  private parseValue(value: string, type: string) {
    switch (type) {
      case 'NUMBER':
        return Number(value);
      case 'BOOLEAN':
        return value === 'true';
      case 'JSON':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }
}