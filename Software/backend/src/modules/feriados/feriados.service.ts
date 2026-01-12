import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeriadosService {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: { fecha: string; descripcion: string; activo?: boolean }) {
        const fecha = new Date(data.fecha);

        const existing = await this.prisma.feriado.findUnique({
            where: { fecha },
        });

        if (existing) {
            throw new BadRequestException('Ya existe un feriado para esta fecha');
        }

        return this.prisma.feriado.create({
            data: {
                fecha,
                descripcion: data.descripcion,
                activo: data.activo ?? true,
            },
        });
    }

    async findAll() {
        return this.prisma.feriado.findMany({
            orderBy: { fecha: 'asc' },
        });
    }

    async findOne(id: number) {
        const feriado = await this.prisma.feriado.findUnique({
            where: { codigo_feriado: id },
        });

        if (!feriado) {
            throw new NotFoundException(`Feriado con ID ${id} no encontrado`);
        }

        return feriado;
    }

    async update(id: number, data: { fecha?: string; descripcion?: string; activo?: boolean }) {
        const feriado = await this.findOne(id);

        const updateData: any = { ...data };
        if (data.fecha) {
            updateData.fecha = new Date(data.fecha);
            // Check if new date conflicts with another feriado
            if (updateData.fecha.getTime() !== feriado.fecha.getTime()) {
                const existing = await this.prisma.feriado.findUnique({
                    where: { fecha: updateData.fecha },
                });
                if (existing) {
                    throw new BadRequestException('Ya existe un feriado para esta fecha');
                }
            }
        }

        return this.prisma.feriado.update({
            where: { codigo_feriado: id },
            data: updateData,
        });
    }

    async remove(id: number) {
        await this.findOne(id);
        return this.prisma.feriado.delete({
            where: { codigo_feriado: id },
        });
    }

    async isFeriado(date: Date): Promise<boolean> {
        // Ensure we compare only dates, ignoring time
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        // Since we store dates as DateTime @db.Date in Prisma (which usually maps to midnight UTC or local depending on setup),
        // we should query carefully. 
        // If we stored as DateTime, we need to match the exact stored value or range.
        // However, since I defined it as @unique, it's likely exact match.
        // Let's try to find one with the exact same date part.

        // A robust way is to check range for that day
        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        const count = await this.prisma.feriado.count({
            where: {
                activo: true,
                fecha: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
        });

        return count > 0;
    }
}
