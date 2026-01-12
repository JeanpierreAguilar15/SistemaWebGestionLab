import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogoService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene el catálogo completo de exámenes con sus precios actuales
   */
  async getCatalogo() {
    const examenes = await this.prisma.examen.findMany({
      where: {
        activo: true,
      },
      include: {
        categoria: {
          select: {
            nombre: true,
          },
        },
        precios: {
          where: {
            activo: true,
          },
          orderBy: {
            fecha_inicio: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    return examenes.map((examen) => ({
      codigo_examen: examen.codigo_examen,
      codigo_interno: examen.codigo_interno,
      nombre: examen.nombre,
      descripcion: examen.descripcion,
      categoria: examen.categoria.nombre,
      precio_actual: examen.precios[0]?.precio || 0,
      requiere_ayuno: examen.requiere_ayuno,
      requiere_preparacion_especial: !!examen.instrucciones_preparacion,
      instrucciones_preparacion: examen.instrucciones_preparacion,
      horas_ayuno: examen.horas_ayuno,
      tipo_muestra: examen.tipo_muestra,
      tiempo_entrega_horas: examen.tiempo_entrega_horas,
      valor_referencia_min: examen.valor_referencia_min,
      valor_referencia_max: examen.valor_referencia_max,
      unidad_medida: examen.unidad_medida,
    }));
  }

  /**
   * Obtiene las categorías de exámenes activas
   */
  async getCategorias() {
    const categorias = await this.prisma.categoriaExamen.findMany({
      where: {
        activo: true,
      },
      orderBy: {
        nombre: 'asc',
      },
      select: {
        codigo_categoria: true,
        nombre: true,
        descripcion: true,
      },
    });

    return categorias;
  }

  /**
   * Obtiene un examen específico por su código
   */
  async getExamenById(codigo_examen: number) {
    const examen = await this.prisma.examen.findUnique({
      where: {
        codigo_examen,
      },
      include: {
        categoria: {
          select: {
            nombre: true,
          },
        },
        precios: {
          where: {
            activo: true,
          },
          orderBy: {
            fecha_inicio: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!examen) {
      return null;
    }

    return {
      codigo_examen: examen.codigo_examen,
      codigo_interno: examen.codigo_interno,
      nombre: examen.nombre,
      descripcion: examen.descripcion,
      categoria: examen.categoria.nombre,
      precio_actual: examen.precios[0]?.precio || 0,
      requiere_ayuno: examen.requiere_ayuno,
      requiere_preparacion_especial: !!examen.instrucciones_preparacion,
      instrucciones_preparacion: examen.instrucciones_preparacion,
      horas_ayuno: examen.horas_ayuno,
      tipo_muestra: examen.tipo_muestra,
      tiempo_entrega_horas: examen.tiempo_entrega_horas,
      valor_referencia_min: examen.valor_referencia_min,
      valor_referencia_max: examen.valor_referencia_max,
      unidad_medida: examen.unidad_medida,
    };
  }
}
