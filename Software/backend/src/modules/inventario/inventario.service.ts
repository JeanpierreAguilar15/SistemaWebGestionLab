import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateMovimientoDto,
  FilterMovimientosDto,
  ValidateRucEcuador,
} from './dto';
import { ReactivosService } from './services/reactivos.service';

@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ReactivosService))
    private reactivosService: ReactivosService,
  ) { }

  // ==================== INVENTARIO ====================

  async getAllInventoryItems(page: number = 1, limit: number = 50, filters?: any) {
    const skip = (page - 1) * limit;
    const where: Prisma.ItemWhereInput = {};

    // Filtro por búsqueda de texto (nombre, código interno, descripción)
    if (filters?.search) {
      where.OR = [
        { nombre: { contains: filters.search, mode: 'insensitive' } },
        { codigo_interno: { contains: filters.search, mode: 'insensitive' } },
        { descripcion: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Filtro por categoría
    if (filters?.codigo_categoria) {
      where.codigo_categoria = parseInt(filters.codigo_categoria, 10);
    }

    // Filtro por estado activo/inactivo
    if (filters?.activo !== undefined) {
      where.activo = filters.activo === 'true';
    }

    // Filtro por stock bajo se aplica después en memoria
    // (Prisma no soporta comparar campos entre sí directamente)

    // Filtro por rango de stock
    if (filters?.stock_min !== undefined) {
      where.stock_actual = {
        ...(where.stock_actual as object || {}),
        gte: parseFloat(filters.stock_min),
      };
    }
    if (filters?.stock_max !== undefined) {
      where.stock_actual = {
        ...(where.stock_actual as object || {}),
        lte: parseFloat(filters.stock_max),
      };
    }

    // Filtro por rango de costo unitario
    if (filters?.costo_min !== undefined) {
      where.costo_unitario = {
        ...(where.costo_unitario as object || {}),
        gte: parseFloat(filters.costo_min),
      };
    }
    if (filters?.costo_max !== undefined) {
      where.costo_unitario = {
        ...(where.costo_unitario as object || {}),
        lte: parseFloat(filters.costo_max),
      };
    }

    // Filtro por unidad de medida
    if (filters?.unidad_medida) {
      where.unidad_medida = { contains: filters.unidad_medida, mode: 'insensitive' };
    }

    // Determinar ordenamiento
    let orderBy: any = { nombre: 'asc' };
    if (filters?.sort_by) {
      const sortOrder = filters.sort_order === 'desc' ? 'desc' : 'asc';
      switch (filters.sort_by) {
        case 'nombre':
          orderBy = { nombre: sortOrder };
          break;
        case 'codigo_interno':
          orderBy = { codigo_interno: sortOrder };
          break;
        case 'stock_actual':
          orderBy = { stock_actual: sortOrder };
          break;
        case 'costo_unitario':
          orderBy = { costo_unitario: sortOrder };
          break;
        case 'fecha_creacion':
          orderBy = { fecha_creacion: sortOrder };
          break;
        case 'categoria':
          orderBy = { categoria: { nombre: sortOrder } };
          break;
        default:
          orderBy = { nombre: 'asc' };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { categoria: true },
      }),
      this.prisma.item.count({ where }),
    ]);

    // Si se filtró por stock_bajo, filtrar en memoria (Prisma no soporta comparar campos directamente)
    let itemsFiltrados = items;
    if (filters?.stock_bajo === 'true') {
      itemsFiltrados = items.filter(item =>
        item.stock_actual <= (item.stock_minimo || 0)
      );
    }

    return {
      data: itemsFiltrados,
      pagination: {
        total: filters?.stock_bajo === 'true' ? itemsFiltrados.length : total,
        page,
        limit,
        totalPages: Math.ceil((filters?.stock_bajo === 'true' ? itemsFiltrados.length : total) / limit),
      },
      filters_applied: {
        search: filters?.search || null,
        codigo_categoria: filters?.codigo_categoria || null,
        activo: filters?.activo || null,
        stock_bajo: filters?.stock_bajo || null,
        stock_min: filters?.stock_min || null,
        stock_max: filters?.stock_max || null,
        costo_min: filters?.costo_min || null,
        costo_max: filters?.costo_max || null,
        unidad_medida: filters?.unidad_medida || null,
        sort_by: filters?.sort_by || 'nombre',
        sort_order: filters?.sort_order || 'asc',
      },
    };
  }

  async getInventoryItemById(codigo_item: number) {
    const item = await this.prisma.item.findUnique({
      where: { codigo_item },
      include: { categoria: true },
    });

    if (!item) {
      throw new NotFoundException('Ítem de inventario no encontrado');
    }

    return item;
  }

  async createInventoryItem(data: CreateInventoryItemDto, adminId: number) {
    // 1. Validar duplicados por nombre + unidad_medida + categoria
    const duplicado = await this.prisma.item.findFirst({
      where: {
        nombre: { equals: data.nombre, mode: 'insensitive' },
        unidad_medida: { equals: data.unidad_medida, mode: 'insensitive' },
        codigo_categoria: data.codigo_categoria || null,
      },
    });

    if (duplicado) {
      throw new BadRequestException(
        `Ya existe un ítem con el mismo nombre, unidad de medida y categoría: ${duplicado.codigo_interno}`
      );
    }

    // 2. Auto-generar código interno si no se proporciona
    let codigoInterno = data.codigo_interno;
    if (!codigoInterno) {
      codigoInterno = await this.generarCodigoInterno(data.nombre, data.codigo_categoria);
    } else {
      // Verificar que el código proporcionado no exista
      const existingCode = await this.prisma.item.findUnique({
        where: { codigo_interno: codigoInterno },
      });
      if (existingCode) {
        throw new BadRequestException(`El código interno ${codigoInterno} ya está en uso`);
      }
    }

    // 3. Crear el ítem
    const item = await this.prisma.item.create({
      data: {
        ...data,
        codigo_interno: codigoInterno,
        stock_actual: data.stock_actual || 0,
        activo: true,
      },
      include: { categoria: true },
    });

    // 4. Registrar en auditoría
    await this.registrarAuditoria(
      adminId,
      'CREAR_ITEM',
      'Item',
      item.codigo_item,
      null,
      item,
      `Creación de ítem: ${item.nombre} (${item.codigo_interno})`
    );

    this.logger.log(`Ítem creado: ${item.codigo_interno} - ${item.nombre} por usuario ${adminId}`);
    return item;
  }

  /**
   * Genera un código interno automático basado en el nombre del item
   * Formato: XX-0001 (iniciales del nombre + secuencial)
   * Ejemplo: "Reactivo Hemoglobina" -> "RH-0001"
   */
  private async generarCodigoInterno(nombreItem: string, codigoCategoria?: number): Promise<string> {
    // Extraer iniciales del nombre del item
    let prefijo = this.extraerIniciales(nombreItem);

    // Si no se pudo extraer, usar prefijo de categoría o default
    if (!prefijo || prefijo.length < 2) {
      if (codigoCategoria) {
        const categoria = await this.prisma.categoriaItem.findUnique({
          where: { codigo_categoria: codigoCategoria },
        });
        if (categoria) {
          prefijo = categoria.nombre
            .substring(0, 3)
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        }
      }
      if (!prefijo || prefijo.length < 2) {
        prefijo = 'ITM';
      }
    }

    // Buscar el último código con este prefijo
    const ultimoItem = await this.prisma.item.findFirst({
      where: {
        codigo_interno: { startsWith: prefijo },
      },
      orderBy: { codigo_interno: 'desc' },
    });

    let secuencial = 1;
    if (ultimoItem) {
      const match = ultimoItem.codigo_interno.match(/-(\d+)$/);
      if (match) {
        secuencial = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefijo}-${secuencial.toString().padStart(4, '0')}`;
  }

  /**
   * Extrae las iniciales de un nombre compuesto
   * "Reactivo Hemoglobina" -> "RH"
   * "Tubos EDTA 5ml" -> "TE"
   * "Glucosa en Sangre" -> "GS" (ignora preposiciones)
   */
  private extraerIniciales(nombre: string): string {
    if (!nombre) return '';

    // Palabras a ignorar (preposiciones, artículos, conectores)
    const ignorar = ['de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'para', 'por', 'y', 'a', 'ml', 'mg', 'gr', 'lt'];

    // Limpiar y normalizar el nombre
    const palabras = nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^a-zA-Z0-9\s]/g, '') // Quitar caracteres especiales
      .split(/\s+/)
      .filter(p => p.length > 0 && !ignorar.includes(p.toLowerCase()));

    if (palabras.length === 0) return '';

    // Si solo hay una palabra, tomar las primeras 2-3 letras
    if (palabras.length === 1) {
      return palabras[0].substring(0, 3).toUpperCase();
    }

    // Tomar la primera letra de cada palabra (máximo 3)
    const iniciales = palabras
      .slice(0, 3)
      .map(p => p.charAt(0).toUpperCase())
      .join('');

    return iniciales;
  }

  /**
   * Método público para sugerir código interno desde el frontend
   */
  async sugerirCodigoInterno(nombre: string, codigoCategoria?: number) {
    if (!nombre || nombre.trim().length < 2) {
      return { codigo_sugerido: null };
    }
    const codigo = await this.generarCodigoInterno(nombre, codigoCategoria);
    return { codigo_sugerido: codigo };
  }

  /**
   * Registra una acción en el log de auditoría
   */
  private async registrarAuditoria(
    usuarioId: number,
    accion: string,
    entidad: string,
    entidadId?: number,
    valorAnterior?: any,
    valorNuevo?: any,
    descripcion?: string
  ) {
    try {
      await this.prisma.logActividad.create({
        data: {
          codigo_usuario: usuarioId,
          accion,
          entidad,
          codigo_entidad: entidadId || null,
          descripcion: descripcion || `${accion} en ${entidad}`,
          datos_anteriores: valorAnterior ? JSON.parse(JSON.stringify(valorAnterior)) : null,
          datos_nuevos: valorNuevo ? JSON.parse(JSON.stringify(valorNuevo)) : null,
          fecha_accion: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Error al registrar auditoría: ${error.message}`);
    }
  }

  async updateInventoryItem(codigo_item: number, data: UpdateInventoryItemDto, adminId: number) {
    const itemAnterior = await this.prisma.item.findUnique({
      where: { codigo_item },
      include: { categoria: true },
    });

    if (!itemAnterior) {
      throw new NotFoundException('Ítem no encontrado');
    }

    // Validar código interno único si se cambia
    if (data.codigo_interno && data.codigo_interno !== itemAnterior.codigo_interno) {
      const existing = await this.prisma.item.findUnique({
        where: { codigo_interno: data.codigo_interno },
      });

      if (existing) {
        throw new BadRequestException(`El código interno ${data.codigo_interno} ya está en uso`);
      }
    }

    // Validar duplicados si cambia nombre, unidad o categoría
    if (data.nombre || data.unidad_medida || data.codigo_categoria !== undefined) {
      const duplicado = await this.prisma.item.findFirst({
        where: {
          codigo_item: { not: codigo_item },
          nombre: { equals: data.nombre || itemAnterior.nombre, mode: 'insensitive' },
          unidad_medida: { equals: data.unidad_medida || itemAnterior.unidad_medida, mode: 'insensitive' },
          codigo_categoria: data.codigo_categoria !== undefined ? data.codigo_categoria : itemAnterior.codigo_categoria,
        },
      });

      if (duplicado) {
        throw new BadRequestException(
          `Ya existe un ítem con el mismo nombre, unidad de medida y categoría: ${duplicado.codigo_interno}`
        );
      }
    }

    // Actualizar el ítem
    const itemActualizado = await this.prisma.item.update({
      where: { codigo_item },
      data,
      include: { categoria: true },
    });

    // Registrar cambios en auditoría
    const cambios = this.detectarCambios(itemAnterior, itemActualizado);
    if (cambios.length > 0) {
      await this.registrarAuditoria(
        adminId,
        'ACTUALIZAR_ITEM',
        'Item',
        codigo_item,
        itemAnterior,
        itemActualizado,
        `Actualización de ítem ${itemAnterior.codigo_interno}: ${cambios.join(', ')}`
      );
    }

    this.logger.log(`Ítem actualizado: ${itemActualizado.codigo_interno} por usuario ${adminId}`);
    return itemActualizado;
  }

  /**
   * Detecta los campos que cambiaron entre dos objetos
   */
  private detectarCambios(anterior: any, nuevo: any): string[] {
    const cambios: string[] = [];
    const camposRelevantes = ['nombre', 'descripcion', 'unidad_medida', 'stock_minimo', 'stock_maximo', 'costo_unitario', 'precio_venta', 'activo', 'codigo_categoria'];

    for (const campo of camposRelevantes) {
      if (anterior[campo] !== nuevo[campo]) {
        cambios.push(`${campo}: "${anterior[campo]}" → "${nuevo[campo]}"`);
      }
    }

    return cambios;
  }

  async deleteInventoryItem(codigo_item: number, adminId: number) {
    // Verificar item existe
    const item = await this.prisma.item.findUnique({
      where: { codigo_item },
    });

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    // Verificar dependencias en paralelo
    const [movimientos, ordenesActivas, insumosActivos, lotesConStock] = await Promise.all([
      // 1. Movimientos registrados
      this.prisma.movimiento.count({
        where: { codigo_item },
      }),
      // 2. Órdenes de compra activas (no canceladas) que incluyen este item
      this.prisma.ordenCompraDetalle.count({
        where: {
          codigo_item,
          orden_compra: {
            estado: { in: ['BORRADOR', 'EMITIDA'] },
          },
        },
      }),
      // 3. Insumos de exámenes activos que usan este item
      this.prisma.examenInsumo.count({
        where: {
          codigo_item,
          activo: true,
        },
      }),
      // 4. Lotes con stock disponible
      this.prisma.lote.count({
        where: {
          codigo_item,
          cantidad_actual: { gt: 0 },
        },
      }),
    ]);

    // Si tiene órdenes activas, NO permitir eliminar
    if (ordenesActivas > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el item tiene ${ordenesActivas} ${ordenesActivas === 1 ? 'orden' : 'órdenes'} de compra activa(s). Cancele las órdenes primero.`
      );
    }

    // Si tiene insumos activos en exámenes, advertir
    if (insumosActivos > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el item está configurado como insumo en ${insumosActivos} ${insumosActivos === 1 ? 'examen' : 'exámenes'}. Desactive primero los insumos.`
      );
    }

    // Si tiene movimientos, lotes con stock, siempre soft delete
    if (movimientos > 0 || lotesConStock > 0) {
      const result = await this.prisma.item.update({
        where: { codigo_item },
        data: { activo: false },
      });

      // Registrar auditoría
      await this.registrarAuditoria(
        adminId,
        'DELETE',
        'Item',
        codigo_item,
        item,
        { activo: false },
        `Item desactivado (soft delete): ${item.nombre}`,
      );

      return result;
    }

    // Sin dependencias, hard delete
    const result = await this.prisma.item.delete({
      where: { codigo_item },
    });

    // Registrar auditoría
    await this.registrarAuditoria(
      adminId,
      'DELETE',
      'Item',
      codigo_item,
      item,
      null,
      `Item eliminado permanentemente: ${item.nombre}`,
    );

    return result;
  }

  async getKardexReport() {
    return this.prisma.item.findMany({
      where: { activo: true },
      select: {
        codigo_interno: true,
        nombre: true,
        stock_actual: true,
        unidad_medida: true,
        costo_unitario: true,
      },
    });
  }

  /**
   * Kardex Global - Resumen de todos los items con sus movimientos
   * OPTIMIZADO: Usa consultas batch en lugar de N+1
   * - Total de entradas y salidas por item
   * - Stock actual y valor
   * - Último movimiento
   * - Estado del stock (normal, bajo, crítico)
   */
  async getKardexGlobal(filters?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    categoria?: number;
  }) {
    try {
      this.logger.log('Iniciando getKardexGlobal con filtros:', JSON.stringify(filters));

      // 1. Obtener todos los items activos con su categoría (1 query)
      const items = await this.prisma.item.findMany({
        where: {
          activo: true,
          ...(filters?.categoria && { codigo_categoria: filters.categoria }),
        },
        include: {
          categoria: { select: { nombre: true } },
        },
        orderBy: { nombre: 'asc' },
      });

      this.logger.log(`Items encontrados: ${items.length}`);

      if (items.length === 0) {
        return {
          resumen: {
            total_items: 0,
            items_criticos: 0,
            items_bajos: 0,
            items_agotados: 0,
            valor_total_inventario: 0,
            total_entradas: 0,
            total_salidas: 0,
          },
          items: [],
        };
      }

      const itemIds = items.map(i => i.codigo_item);

      // Construir filtro de fechas para movimientos
      const whereMovimiento: any = {
        codigo_item: { in: itemIds },
      };
      if (filters?.fecha_desde) {
        whereMovimiento.fecha_movimiento = {
          ...whereMovimiento.fecha_movimiento,
          gte: new Date(filters.fecha_desde),
        };
      }
      if (filters?.fecha_hasta) {
        whereMovimiento.fecha_movimiento = {
          ...whereMovimiento.fecha_movimiento,
          lte: new Date(filters.fecha_hasta),
        };
      }

      // 2. Obtener TODOS los totales de movimientos en UNA sola query
      const allTotales = await this.prisma.movimiento.groupBy({
        by: ['codigo_item', 'tipo_movimiento'],
        where: whereMovimiento,
        _sum: { cantidad: true },
        _count: true,
      });

      this.logger.log(`Totales de movimientos obtenidos: ${allTotales.length}`);

      // 3. Obtener último movimiento por item usando una sola query
      const ultimosMovimientos = await this.prisma.movimiento.findMany({
        where: whereMovimiento,
        orderBy: { fecha_movimiento: 'desc' },
        select: {
          codigo_item: true,
          fecha_movimiento: true,
          tipo_movimiento: true,
          cantidad: true,
        },
      });

      // Agrupar por item y tomar solo el primero (más reciente) de cada uno
      const ultimoMovMap = new Map<number, typeof ultimosMovimientos[0]>();
      for (const mov of ultimosMovimientos) {
        if (!ultimoMovMap.has(mov.codigo_item)) {
          ultimoMovMap.set(mov.codigo_item, mov);
        }
      }

      this.logger.log(`Últimos movimientos mapeados: ${ultimoMovMap.size}`);

      // Crear mapa de totales para acceso O(1)
      const totalesMap = new Map<number, { entradas: number; salidas: number; total: number }>();
      for (const t of allTotales) {
        const current = totalesMap.get(t.codigo_item) || { entradas: 0, salidas: 0, total: 0 };

        if (['ENTRADA', 'AJUSTE_POSITIVO', 'COMPRA'].includes(t.tipo_movimiento)) {
          current.entradas += t._sum.cantidad || 0;
        } else if (['SALIDA', 'AJUSTE_NEGATIVO', 'USO_EXAMEN', 'VENCIMIENTO'].includes(t.tipo_movimiento)) {
          current.salidas += t._sum.cantidad || 0;
        }
        current.total += t._count;

        totalesMap.set(t.codigo_item, current);
      }

      // 4. Construir resultado final
      const kardexItems = items.map(item => {
        const totales = totalesMap.get(item.codigo_item) || { entradas: 0, salidas: 0, total: 0 };
        const ultimoMov = ultimoMovMap.get(item.codigo_item);

        // Convertir Decimal a number de forma segura
        const costoUnitario = item.costo_unitario ? Number(item.costo_unitario) : 0;

        // Determinar estado del stock
        let estadoStock: 'NORMAL' | 'BAJO' | 'CRITICO' | 'AGOTADO' = 'NORMAL';
        if (item.stock_actual <= 0) {
          estadoStock = 'AGOTADO';
        } else if (item.stock_actual <= item.stock_minimo) {
          estadoStock = 'CRITICO';
        } else if (item.stock_actual <= item.stock_minimo * 1.5) {
          estadoStock = 'BAJO';
        }

        return {
          codigo_item: item.codigo_item,
          codigo_interno: item.codigo_interno,
          nombre: item.nombre,
          categoria: item.categoria?.nombre || 'Sin categoría',
          unidad_medida: item.unidad_medida,
          stock_actual: item.stock_actual,
          stock_minimo: item.stock_minimo,
          costo_unitario: costoUnitario,
          valor_inventario: item.stock_actual * costoUnitario,
          total_entradas: totales.entradas,
          total_salidas: totales.salidas,
          total_movimientos: totales.total,
          ultimo_movimiento: ultimoMov ? {
            fecha_movimiento: ultimoMov.fecha_movimiento,
            tipo_movimiento: ultimoMov.tipo_movimiento,
            cantidad: ultimoMov.cantidad,
          } : null,
          estado_stock: estadoStock,
        };
      });

      // Calcular totales generales
      const totalesGenerales = {
        total_items: kardexItems.length,
        items_criticos: kardexItems.filter(i => i.estado_stock === 'CRITICO').length,
        items_bajos: kardexItems.filter(i => i.estado_stock === 'BAJO').length,
        items_agotados: kardexItems.filter(i => i.estado_stock === 'AGOTADO').length,
        valor_total_inventario: kardexItems.reduce((sum, i) => sum + i.valor_inventario, 0),
        total_entradas: kardexItems.reduce((sum, i) => sum + i.total_entradas, 0),
        total_salidas: kardexItems.reduce((sum, i) => sum + i.total_salidas, 0),
      };

      this.logger.log('getKardexGlobal completado exitosamente');

      return {
        resumen: totalesGenerales,
        items: kardexItems,
      };
    } catch (error) {
      this.logger.error('Error en getKardexGlobal:', error);
      this.logger.error('Stack:', error.stack);
      throw new BadRequestException(`Error al obtener kardex global: ${error.message}`);
    }
  }

  async toggleInventoryItemStatus(codigo_item: number, adminId: number) {
    const item = await this.prisma.item.findUnique({
      where: { codigo_item },
    });

    if (!item) {
      throw new NotFoundException('Ítem no encontrado');
    }

    return this.prisma.item.update({
      where: { codigo_item },
      data: { activo: !item.activo },
    });
  }

  // ==================== MOVIMIENTOS DE STOCK ====================

  async createMovimiento(data: CreateMovimientoDto, adminId: number) {
    const item = await this.prisma.item.findUnique({
      where: { codigo_item: data.codigo_item },
    });

    if (!item) {
      throw new NotFoundException('Ítem no encontrado');
    }

    // Calcular nuevo stock
    let nuevoStock = item.stock_actual;
    if (data.tipo_movimiento === 'ENTRADA' || data.tipo_movimiento === 'AJUSTE_POSITIVO') {
      nuevoStock += data.cantidad;
    } else if (data.tipo_movimiento === 'SALIDA' || data.tipo_movimiento === 'AJUSTE_NEGATIVO') {
      if (item.stock_actual < data.cantidad) {
        throw new BadRequestException('Stock insuficiente');
      }
      nuevoStock -= data.cantidad;
    }

    // Transacción para asegurar consistencia
    return this.prisma.$transaction(async (prisma) => {
      const movimiento = await prisma.movimiento.create({
        data: {
          codigo_item: data.codigo_item,
          tipo_movimiento: data.tipo_movimiento,
          cantidad: data.cantidad,
          motivo: data.motivo,
          fecha_movimiento: new Date(),
          realizado_por: adminId,
          stock_anterior: item.stock_actual,
          stock_nuevo: nuevoStock,
        },
      });

      await prisma.item.update({
        where: { codigo_item: data.codigo_item },
        data: {
          stock_actual: nuevoStock,
          // costo_unitario no se actualiza aquí porque no viene en el DTO
        },
      });

      return movimiento;
    });
  }

  async getAllMovimientos(page: number = 1, limit: number = 50, filters?: any) {
    const skip = (page - 1) * limit;
    const where: Prisma.MovimientoWhereInput = {};

    if (filters?.codigo_item) {
      where.codigo_item = parseInt(filters.codigo_item);
    }

    if (filters?.tipo_movimiento) {
      where.tipo_movimiento = filters.tipo_movimiento;
    }

    if (filters?.fecha_desde && filters?.fecha_hasta) {
      where.fecha_movimiento = {
        gte: new Date(filters.fecha_desde),
        lte: new Date(filters.fecha_hasta),
      };
    }

    const [movimientos, total] = await Promise.all([
      this.prisma.movimiento.findMany({
        where,
        include: {
          item: { select: { nombre: true, codigo_interno: true } },
          usuario: { select: { nombres: true, apellidos: true } },
        },
        orderBy: { fecha_movimiento: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.movimiento.count({ where }),
    ]);

    return {
      data: movimientos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getKardexByItem(itemId: number, fecha_desde?: string, fecha_hasta?: string) {
    const where: Prisma.MovimientoWhereInput = {
      codigo_item: itemId,
    };

    if (fecha_desde && fecha_hasta) {
      where.fecha_movimiento = {
        gte: new Date(fecha_desde),
        lte: new Date(fecha_hasta),
      };
    }

    const movimientos = await this.prisma.movimiento.findMany({
      where,
      orderBy: { fecha_movimiento: 'asc' },
      include: {
        usuario: { select: { nombres: true, apellidos: true } },
      },
    });

    const item = await this.prisma.item.findUnique({
      where: { codigo_item: itemId },
    });

    return {
      item,
      movimientos,
    };
  }

  // ==================== ALERTAS DE STOCK ====================

  /**
   * Obtiene alertas de stock con estructura completa
   * Incluye alertas por stock bajo, stock crítico y lotes próximos a vencer
   */
  async getAlertasStock(filters: any) {
    const alertas: any[] = [];

    // Obtener items con stock bajo o crítico
    const items = await this.prisma.item.findMany({
      where: { activo: true },
      include: { categoria: true },
    });

    // Alertas de stock
    for (const item of items) {
      // Stock crítico (sin stock)
      if (item.stock_actual === 0) {
        if (!filters.tipo || filters.tipo === 'STOCK_CRITICO') {
          alertas.push({
            codigo_item: item.codigo_item,
            codigo_interno: item.codigo_interno,
            nombre: item.nombre,
            stock_actual: item.stock_actual,
            stock_minimo: item.stock_minimo,
            stock_maximo: item.stock_maximo,
            unidad_medida: item.unidad_medida,
            tipo_alerta: 'STOCK_CRITICO',
            mensaje: `Sin stock disponible`,
            prioridad: 'CRITICA' as const,
          });
        }
      }
      // Stock bajo (por debajo del mínimo)
      else if (item.stock_actual <= item.stock_minimo) {
        if (!filters.tipo || filters.tipo === 'STOCK_BAJO' || filters.tipo === 'BAJO_STOCK') {
          alertas.push({
            codigo_item: item.codigo_item,
            codigo_interno: item.codigo_interno,
            nombre: item.nombre,
            stock_actual: item.stock_actual,
            stock_minimo: item.stock_minimo,
            stock_maximo: item.stock_maximo,
            unidad_medida: item.unidad_medida,
            tipo_alerta: 'STOCK_BAJO',
            mensaje: `Stock actual (${item.stock_actual}) por debajo del mínimo (${item.stock_minimo})`,
            prioridad: 'ALTA' as const,
          });
        }
      }
    }

    // Obtener lotes próximos a vencer o vencidos
    const hoy = new Date();
    const en30Dias = new Date();
    en30Dias.setDate(en30Dias.getDate() + 30);

    const lotesConVencimiento = await this.prisma.lote.findMany({
      where: {
        fecha_vencimiento: { not: null },
        cantidad_actual: { gt: 0 },
      },
      include: {
        item: true,
      },
    });

    for (const lote of lotesConVencimiento) {
      if (!lote.fecha_vencimiento) continue;

      const fechaVenc = new Date(lote.fecha_vencimiento);
      const diasHastaVenc = Math.floor((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

      // Vencido
      if (fechaVenc < hoy) {
        if (!filters.tipo || filters.tipo === 'VENCIDO') {
          alertas.push({
            codigo_item: lote.item.codigo_item,
            codigo_interno: lote.item.codigo_interno,
            nombre: lote.item.nombre,
            stock_actual: lote.cantidad_actual,
            stock_minimo: lote.item.stock_minimo,
            stock_maximo: lote.item.stock_maximo,
            unidad_medida: lote.item.unidad_medida,
            tipo_alerta: 'VENCIDO',
            mensaje: `Lote ${lote.numero_lote} vencido`,
            prioridad: 'CRITICA' as const,
            codigo_lote: lote.codigo_lote,
            numero_lote: lote.numero_lote,
            fecha_vencimiento: lote.fecha_vencimiento,
            dias_hasta_vencimiento: diasHastaVenc,
          });
        }
      }
      // Próximo a vencer (30 días o menos)
      else if (fechaVenc <= en30Dias) {
        if (!filters.tipo || filters.tipo === 'PROXIMO_VENCER') {
          alertas.push({
            codigo_item: lote.item.codigo_item,
            codigo_interno: lote.item.codigo_interno,
            nombre: lote.item.nombre,
            stock_actual: lote.cantidad_actual,
            stock_minimo: lote.item.stock_minimo,
            stock_maximo: lote.item.stock_maximo,
            unidad_medida: lote.item.unidad_medida,
            tipo_alerta: 'PROXIMO_VENCER',
            mensaje: `Lote ${lote.numero_lote} vence en ${diasHastaVenc} días`,
            prioridad: diasHastaVenc <= 7 ? 'ALTA' as const : 'MEDIA' as const,
            codigo_lote: lote.codigo_lote,
            numero_lote: lote.numero_lote,
            fecha_vencimiento: lote.fecha_vencimiento,
            dias_hasta_vencimiento: diasHastaVenc,
          });
        }
      }
    }

    // Ordenar por prioridad
    const prioridadOrden = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };
    alertas.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);

    return alertas;
  }

  /**
   * Obtiene estadísticas de alertas compatible con el frontend
   */
  async getEstadisticasAlertas() {
    const alertas = await this.getAlertasStock({});

    let criticas = 0;
    let altas = 0;
    let medias = 0;
    let bajas = 0;

    const por_tipo = {
      stock_critico: 0,
      stock_bajo: 0,
      vencidos: 0,
      proximos_vencer: 0,
    };

    for (const alerta of alertas) {
      // Contar por prioridad
      switch (alerta.prioridad) {
        case 'CRITICA': criticas++; break;
        case 'ALTA': altas++; break;
        case 'MEDIA': medias++; break;
        case 'BAJA': bajas++; break;
      }

      // Contar por tipo
      switch (alerta.tipo_alerta) {
        case 'STOCK_CRITICO': por_tipo.stock_critico++; break;
        case 'STOCK_BAJO': por_tipo.stock_bajo++; break;
        case 'VENCIDO': por_tipo.vencidos++; break;
        case 'PROXIMO_VENCER': por_tipo.proximos_vencer++; break;
      }
    }

    return {
      total: alertas.length,
      criticas,
      altas,
      medias,
      bajas,
      por_tipo,
    };
  }

  // ==================== PROVEEDORES ====================

  async getAllSuppliers(includeInactive: boolean = false) {
    // Obtener proveedores con estadísticas de órdenes
    const proveedores = await this.prisma.proveedor.findMany({
      where: includeInactive ? {} : { activo: true },
      orderBy: [
        { activo: 'desc' }, // Activos primero
        { razon_social: 'asc' },
      ],
      include: {
        ordenes_compra: {
          select: {
            codigo_orden_compra: true,
            estado: true,
            total: true,
            fecha_orden: true,
            fecha_entrega_real: true,
          },
        },
      },
    });

    // Calcular estadísticas para cada proveedor
    return proveedores.map((proveedor) => {
      const ordenes = proveedor.ordenes_compra || [];
      const ordenesCompletadas = ordenes.filter(
        (o) => o.estado === 'RECIBIDA_COMPLETA' || o.estado === 'RECIBIDA_PARCIAL',
      );
      const ordenesPendientes = ordenes.filter(
        (o) => o.estado === 'BORRADOR' || o.estado === 'EMITIDA',
      );

      // Última orden recibida
      const ultimaOrdenRecibida = ordenesCompletadas
        .filter((o) => o.fecha_entrega_real)
        .sort((a, b) => new Date(b.fecha_entrega_real!).getTime() - new Date(a.fecha_entrega_real!).getTime())[0];

      // Monto total de órdenes completadas
      const montoTotal = ordenesCompletadas.reduce(
        (sum, o) => sum + (o.total ? parseFloat(o.total.toString()) : 0),
        0,
      );

      // Eliminar ordenes_compra del objeto retornado y agregar estadísticas
      const { ordenes_compra, ...proveedorSinOrdenes } = proveedor;

      return {
        ...proveedorSinOrdenes,
        estadisticas: {
          total_ordenes: ordenes.length,
          ordenes_completadas: ordenesCompletadas.length,
          ordenes_pendientes: ordenesPendientes.length,
          monto_total_compras: montoTotal,
          ultima_compra: ultimaOrdenRecibida?.fecha_entrega_real || null,
          tiene_ordenes: ordenes.length > 0,
        },
      };
    });
  }

  async getSupplierById(codigo_proveedor: number) {
    const supplier = await this.prisma.proveedor.findUnique({
      where: { codigo_proveedor },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return supplier;
  }

  async createSupplier(data: CreateSupplierDto, adminId: number) {
    // 1. Validar formato de RUC ecuatoriano
    if (!ValidateRucEcuador(data.ruc)) {
      throw new BadRequestException(
        'RUC inválido. Debe ser un RUC ecuatoriano válido de 13 dígitos',
      );
    }

    // 2. Validar RUC único
    const existing = await this.prisma.proveedor.findUnique({
      where: { ruc: data.ruc },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe un proveedor con el RUC ${data.ruc}: ${existing.razon_social}`,
      );
    }

    // 3. Crear proveedor
    const proveedor = await this.prisma.proveedor.create({
      data: {
        ...data,
        activo: true,
      },
    });

    // 4. Registrar en auditoría
    await this.registrarAuditoria(
      adminId,
      'CREAR',
      'PROVEEDOR',
      proveedor.codigo_proveedor,
      null,
      null,
      `Proveedor creado: ${proveedor.razon_social} (RUC: ${proveedor.ruc})`,
    );

    return proveedor;
  }

  async updateSupplier(codigo_proveedor: number, data: UpdateSupplierDto, adminId: number) {
    // 1. Verificar que existe el proveedor
    const supplier = await this.prisma.proveedor.findUnique({
      where: { codigo_proveedor },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    // 2. Si se está cambiando el RUC, validar formato, unicidad y que no tenga órdenes
    if (data.ruc && data.ruc !== supplier.ruc) {
      // Verificar que no tenga órdenes de compra (integridad de datos)
      const ordenesExistentes = await this.prisma.ordenCompra.count({
        where: { codigo_proveedor },
      });

      if (ordenesExistentes > 0) {
        throw new BadRequestException(
          `No se puede modificar el RUC del proveedor porque tiene ${ordenesExistentes} orden(es) de compra asociada(s). ` +
          `El RUC es un identificador fiscal que debe mantenerse consistente con el historial de compras.`,
        );
      }

      // Validar formato
      if (!ValidateRucEcuador(data.ruc)) {
        throw new BadRequestException(
          'RUC inválido. Debe ser un RUC ecuatoriano válido de 13 dígitos',
        );
      }

      // Validar que no exista otro proveedor con ese RUC
      const existingWithRuc = await this.prisma.proveedor.findFirst({
        where: {
          ruc: data.ruc,
          codigo_proveedor: { not: codigo_proveedor },
        },
      });

      if (existingWithRuc) {
        throw new BadRequestException(
          `Ya existe otro proveedor con el RUC ${data.ruc}: ${existingWithRuc.razon_social}`,
        );
      }
    }

    // 3. Si se está desactivando, verificar órdenes pendientes
    if (data.activo === false && supplier.activo === true) {
      const ordenesPendientes = await this.prisma.ordenCompra.count({
        where: {
          codigo_proveedor,
          estado: {
            in: ['BORRADOR', 'EMITIDA', 'RECIBIDA_PARCIAL'],
          },
        },
      });

      if (ordenesPendientes > 0) {
        throw new BadRequestException(
          `No se puede desactivar el proveedor. Tiene ${ordenesPendientes} orden(es) de compra pendiente(s). ` +
          `Debe completar o cancelar las ordenes antes de desactivar el proveedor.`,
        );
      }
    }

    // 4. Detectar cambios para auditoría
    const cambios = this.detectarCambiosProveedor(supplier, data);

    // 5. Actualizar proveedor
    const proveedorActualizado = await this.prisma.proveedor.update({
      where: { codigo_proveedor },
      data,
    });

    // 6. Registrar en auditoría si hubo cambios
    if (cambios.length > 0) {
      await this.registrarAuditoria(
        adminId,
        'EDITAR',
        'PROVEEDOR',
        codigo_proveedor,
        null,
        null,
        `Proveedor actualizado: ${proveedorActualizado.razon_social}. Cambios: ${cambios.join('; ')}`,
      );
    }

    return proveedorActualizado;
  }

  /**
   * Detecta cambios entre el estado anterior y nuevo del proveedor
   */
  private detectarCambiosProveedor(anterior: any, nuevo: any): string[] {
    const cambios: string[] = [];
    const camposRelevantes = ['ruc', 'razon_social', 'nombre_comercial', 'telefono', 'email', 'direccion', 'activo'];

    for (const campo of camposRelevantes) {
      if (nuevo[campo] !== undefined && anterior[campo] !== nuevo[campo]) {
        cambios.push(`${campo}: "${anterior[campo] ?? 'N/A'}" → "${nuevo[campo]}"`);
      }
    }

    return cambios;
  }

  async deleteSupplier(codigo_proveedor: number, adminId: number) {
    // 1. Verificar que existe
    const supplier = await this.prisma.proveedor.findUnique({
      where: { codigo_proveedor },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    // 2. Verificar órdenes de compra pendientes
    const ordenesPendientes = await this.prisma.ordenCompra.count({
      where: {
        codigo_proveedor,
        estado: {
          in: ['BORRADOR', 'EMITIDA', 'RECIBIDA_PARCIAL'],
        },
      },
    });

    if (ordenesPendientes > 0) {
      throw new BadRequestException(
        `No se puede desactivar el proveedor. Tiene ${ordenesPendientes} orden(es) de compra pendiente(s). ` +
        `Debe completar o cancelar las ordenes antes de desactivar el proveedor.`,
      );
    }

    // 3. Desactivar (soft delete)
    const proveedorDesactivado = await this.prisma.proveedor.update({
      where: { codigo_proveedor },
      data: { activo: false },
    });

    // 4. Registrar en auditoría
    await this.registrarAuditoria(
      adminId,
      'ELIMINAR',
      'PROVEEDOR',
      codigo_proveedor,
      null,
      null,
      `Proveedor desactivado: ${supplier.razon_social} (RUC: ${supplier.ruc})`,
    );

    return proveedorDesactivado;
  }

  // ==================== CATEGORÍAS DE ITEMS ====================

  async getAllCategories() {
    return this.prisma.categoriaItem.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  async getCategoryById(codigo_categoria: number) {
    const category = await this.prisma.categoriaItem.findUnique({
      where: { codigo_categoria },
      include: {
        items: {
          where: { activo: true },
          select: {
            codigo_item: true,
            codigo_interno: true,
            nombre: true,
            stock_actual: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category;
  }

  async createCategory(data: { nombre: string; descripcion?: string }, adminId: number) {
    const existing = await this.prisma.categoriaItem.findUnique({
      where: { nombre: data.nombre },
    });

    if (existing) {
      throw new BadRequestException('Ya existe una categoría con este nombre');
    }

    return this.prisma.categoriaItem.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        activo: true,
      },
    });
  }

  async updateCategory(codigo_categoria: number, data: { nombre?: string; descripcion?: string }, adminId: number) {
    const category = await this.prisma.categoriaItem.findUnique({
      where: { codigo_categoria },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (data.nombre && data.nombre !== category.nombre) {
      const existing = await this.prisma.categoriaItem.findUnique({
        where: { nombre: data.nombre },
      });

      if (existing) {
        throw new BadRequestException('Ya existe una categoría con este nombre');
      }
    }

    return this.prisma.categoriaItem.update({
      where: { codigo_categoria },
      data,
    });
  }

  async deleteCategory(codigo_categoria: number, adminId: number) {
    const category = await this.prisma.categoriaItem.findUnique({
      where: { codigo_categoria },
      include: { _count: { select: { items: true } } },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (category._count.items > 0) {
      // Soft delete si tiene items
      return this.prisma.categoriaItem.update({
        where: { codigo_categoria },
        data: { activo: false },
      });
    }

    return this.prisma.categoriaItem.delete({
      where: { codigo_categoria },
    });
  }

  // ==================== LOTES ====================

  async getAllLotes(page: number = 1, limit: number = 50, filters?: any) {
    const skip = (page - 1) * limit;
    const where: Prisma.LoteWhereInput = {};

    if (filters?.codigo_item) {
      where.codigo_item = parseInt(filters.codigo_item);
    }

    if (filters?.activo === 'true') {
      where.cantidad_actual = { gt: 0 };
    }

    if (filters?.vencidos === 'true') {
      where.fecha_vencimiento = { lt: new Date() };
    }

    if (filters?.proximos_vencer === 'true') {
      const en30Dias = new Date();
      en30Dias.setDate(en30Dias.getDate() + 30);
      where.fecha_vencimiento = {
        gte: new Date(),
        lte: en30Dias,
      };
    }

    const [lotes, total] = await Promise.all([
      this.prisma.lote.findMany({
        where,
        include: {
          item: {
            select: {
              codigo_interno: true,
              nombre: true,
              unidad_medida: true,
            },
          },
        },
        orderBy: { fecha_vencimiento: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.lote.count({ where }),
    ]);

    return {
      data: lotes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLoteById(codigo_lote: number) {
    const lote = await this.prisma.lote.findUnique({
      where: { codigo_lote },
      include: {
        item: true,
        movimientos: {
          orderBy: { fecha_movimiento: 'desc' },
          take: 10,
          include: {
            usuario: { select: { nombres: true, apellidos: true } },
          },
        },
      },
    });

    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    return lote;
  }

  async createLote(data: {
    codigo_item: number;
    numero_lote: string;
    fecha_fabricacion?: Date;
    fecha_vencimiento?: Date;
    cantidad_inicial: number;
    proveedor?: string;
    codigo_proveedor?: number;
  }, adminId: number) {
    const item = await this.prisma.item.findUnique({
      where: { codigo_item: data.codigo_item },
    });

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    // Resolver nombre del proveedor si se pasa codigo_proveedor
    let proveedorNombre = data.proveedor || null;
    if (data.codigo_proveedor) {
      const proveedor = await this.prisma.proveedor.findUnique({
        where: { codigo_proveedor: data.codigo_proveedor },
      });
      if (proveedor) {
        proveedorNombre = proveedor.razon_social;
      }
    }

    // Crear lote y actualizar stock en transacción
    return this.prisma.$transaction(async (prisma) => {
      const lote = await prisma.lote.create({
        data: {
          codigo_item: data.codigo_item,
          numero_lote: data.numero_lote,
          fecha_fabricacion: data.fecha_fabricacion || null,
          fecha_vencimiento: data.fecha_vencimiento || null,
          cantidad_inicial: data.cantidad_inicial,
          cantidad_actual: data.cantidad_inicial,
          proveedor: proveedorNombre,
        },
        include: { item: true },
      });

      // Registrar movimiento de entrada
      await prisma.movimiento.create({
        data: {
          codigo_item: data.codigo_item,
          codigo_lote: lote.codigo_lote,
          tipo_movimiento: 'ENTRADA',
          cantidad: data.cantidad_inicial,
          motivo: `Ingreso de lote ${data.numero_lote}`,
          stock_anterior: item.stock_actual,
          stock_nuevo: item.stock_actual + data.cantidad_inicial,
          realizado_por: adminId,
        },
      });

      // Actualizar stock del item
      await prisma.item.update({
        where: { codigo_item: data.codigo_item },
        data: { stock_actual: { increment: data.cantidad_inicial } },
      });

      return lote;
    });
  }

  async updateLote(codigo_lote: number, data: {
    numero_lote?: string;
    fecha_fabricacion?: Date;
    fecha_vencimiento?: Date;
    proveedor?: string;
    codigo_proveedor?: number;
  }, adminId: number) {
    const lote = await this.prisma.lote.findUnique({
      where: { codigo_lote },
    });

    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    // Resolver nombre del proveedor si se pasa codigo_proveedor
    let proveedorNombre = data.proveedor;
    if (data.codigo_proveedor) {
      const proveedor = await this.prisma.proveedor.findUnique({
        where: { codigo_proveedor: data.codigo_proveedor },
      });
      if (proveedor) {
        proveedorNombre = proveedor.razon_social;
      }
    }

    return this.prisma.lote.update({
      where: { codigo_lote },
      data: {
        numero_lote: data.numero_lote,
        fecha_fabricacion: data.fecha_fabricacion,
        fecha_vencimiento: data.fecha_vencimiento,
        proveedor: proveedorNombre,
      },
    });
  }

  async getLotesByItem(codigo_item: number) {
    return this.prisma.lote.findMany({
      where: {
        codigo_item,
        cantidad_actual: { gt: 0 },
      },
      orderBy: { fecha_vencimiento: 'asc' },
    });
  }

  // ==================== EXAMEN-INSUMO (KARDEX) ====================

  async createExamenInsumo(data: any, adminId: number) {
    const examen = await this.prisma.examen.findUnique({
      where: { codigo_examen: data.codigo_examen },
    });

    if (!examen) {
      throw new NotFoundException('Examen no encontrado');
    }

    const item = await this.prisma.item.findUnique({
      where: { codigo_item: data.codigo_item },
    });

    if (!item) {
      throw new NotFoundException('Ítem de inventario no encontrado');
    }

    const existingRelation = await this.prisma.examenInsumo.findFirst({
      where: {
        codigo_examen: data.codigo_examen,
        codigo_item: data.codigo_item,
      },
    });

    if (existingRelation) {
      throw new BadRequestException('Este insumo ya está asignado al examen');
    }

    return this.prisma.examenInsumo.create({
      data: {
        codigo_examen: data.codigo_examen,
        codigo_item: data.codigo_item,
        cantidad_requerida: data.cantidad_requerida,
        activo: data.activo !== undefined ? data.activo : true,
      },
      include: {
        examen: { select: { codigo_examen: true, nombre: true } },
        item: { select: { codigo_item: true, nombre: true, unidad_medida: true } },
      },
    });
  }

  async getExamenInsumos(codigo_examen: number) {
    return this.prisma.examenInsumo.findMany({
      where: { codigo_examen },
      include: {
        item: true,
      },
    });
  }

  async updateExamenInsumo(id: number, data: any, adminId: number) {
    return this.prisma.examenInsumo.update({
      where: { codigo_examen_insumo: id },
      data,
    });
  }

  async deleteExamenInsumo(id: number, adminId: number) {
    return this.prisma.examenInsumo.delete({
      where: { codigo_examen_insumo: id },
    });
  }

  async getKardexByExamen(codigo_examen: number) {
    const examen = await this.prisma.examen.findUnique({
      where: { codigo_examen },
    });

    if (!examen) {
      throw new NotFoundException('Examen no encontrado');
    }

    const insumos = await this.getExamenInsumos(codigo_examen);

    return {
      examen,
      insumos,
    };
  }

  /**
   * Verifica si hay stock suficiente para realizar un examen
   * @returns objeto con disponibilidad y detalles de insumos faltantes
   */
  async verificarStockExamen(codigo_examen: number): Promise<{
    disponible: boolean;
    insumosFaltantes: { item: string; requerido: number; disponible: number }[];
  }> {
    const insumos = await this.prisma.examenInsumo.findMany({
      where: { codigo_examen, activo: true },
      include: { item: true },
    });

    const insumosFaltantes: { item: string; requerido: number; disponible: number }[] = [];

    for (const insumo of insumos) {
      const cantidadRequerida = Number(insumo.cantidad_requerida);
      if (insumo.item.stock_actual < cantidadRequerida) {
        insumosFaltantes.push({
          item: insumo.item.nombre,
          requerido: cantidadRequerida,
          disponible: insumo.item.stock_actual,
        });
      }
    }

    return {
      disponible: insumosFaltantes.length === 0,
      insumosFaltantes,
    };
  }

  /**
   * Verifica stock para múltiples exámenes (ej: cotización con varios exámenes)
   */
  async verificarStockExamenes(codigos_examenes: number[]): Promise<{
    disponible: boolean;
    detalles: { codigo_examen: number; disponible: boolean; faltantes: any[] }[];
  }> {
    const detalles: { codigo_examen: number; disponible: boolean; faltantes: any[] }[] = [];

    for (const codigo_examen of codigos_examenes) {
      const resultado = await this.verificarStockExamen(codigo_examen);
      detalles.push({
        codigo_examen,
        disponible: resultado.disponible,
        faltantes: resultado.insumosFaltantes,
      });
    }

    return {
      disponible: detalles.every(d => d.disponible),
      detalles,
    };
  }

  /**
   * Descuenta los insumos del inventario al completar un examen
   * Registra movimientos en el Kardex con trazabilidad
   *
   * IMPORTANTE: Maneja dos tipos de items diferente:
   * - Items normales: Descuento directo de stock y lotes (FIFO)
   * - Reactivos: Uso automatico con control de frascos abiertos
   */
  async descontarInsumosExamen(
    codigo_examen: number,
    codigo_cita: number,
    userId: number,
  ): Promise<{
    success: boolean;
    movimientos: any[];
    mensaje: string;
    alertas_reactivos?: string[];
  }> {
    // Obtener insumos requeridos para el examen
    const insumos = await this.prisma.examenInsumo.findMany({
      where: { codigo_examen, activo: true },
      include: {
        item: true,
        examen: { select: { nombre: true } },
      },
    });

    if (insumos.length === 0) {
      return {
        success: true,
        movimientos: [],
        mensaje: 'Este examen no tiene insumos configurados',
      };
    }

    // Separar insumos en reactivos y no reactivos
    const insumosReactivos = insumos.filter(i => i.item.es_reactivo);
    const insumosNormales = insumos.filter(i => !i.item.es_reactivo);

    // Verificar stock de insumos normales antes de descontar
    if (insumosNormales.length > 0) {
      for (const insumo of insumosNormales) {
        const cantidadRequerida = Number(insumo.cantidad_requerida);
        if (insumo.item.stock_actual < cantidadRequerida) {
          throw new BadRequestException(
            `Stock insuficiente de "${insumo.item.nombre}". ` +
            `Requiere: ${cantidadRequerida}, Disponible: ${insumo.item.stock_actual}`
          );
        }
      }
    }

    const movimientos: any[] = [];
    const alertasReactivos: string[] = [];

    // 1. PROCESAR REACTIVOS (fuera de transaccion para manejar apertura automatica)
    for (const insumo of insumosReactivos) {
      const cantidadPruebas = Number(insumo.cantidad_requerida);
      const referencia = `Examen: ${insumo.examen.nombre} - Cita #${codigo_cita}`;

      try {
        const resultadoReactivo = await this.reactivosService.procesarUsoReactivoAutomatico(
          insumo.item.codigo_item,
          cantidadPruebas,
          referencia,
          userId,
        );

        movimientos.push({
          item: insumo.item.nombre,
          tipo: 'REACTIVO',
          cantidad_pruebas: cantidadPruebas,
          lote_usado: resultadoReactivo.lote_usado,
          frasco_abierto_automaticamente: resultadoReactivo.frasco_abierto_automaticamente,
          mensaje: resultadoReactivo.mensaje,
        });

        // Agregar alertas si las hay
        if (resultadoReactivo.alertas) {
          alertasReactivos.push(...resultadoReactivo.alertas);
        }

        this.logger.log(
          `Reactivo procesado: ${insumo.item.nombre}, ${cantidadPruebas} prueba(s). ${referencia}`
        );
      } catch (error) {
        this.logger.error(
          `Error procesando reactivo ${insumo.item.nombre}: ${error.message}`
        );
        throw new BadRequestException(
          `Error al procesar reactivo "${insumo.item.nombre}": ${error.message}`
        );
      }
    }

    // 2. PROCESAR INSUMOS NORMALES (en transaccion)
    if (insumosNormales.length > 0) {
      await this.prisma.$transaction(async (prisma) => {
        for (const insumo of insumosNormales) {
          const cantidadRequerida = Number(insumo.cantidad_requerida);
          const item = insumo.item;

          // Crear movimiento de salida
          const movimiento = await prisma.movimiento.create({
            data: {
              codigo_item: item.codigo_item,
              tipo_movimiento: 'SALIDA',
              cantidad: cantidadRequerida,
              motivo: `Uso en examen: ${insumo.examen.nombre} - Cita #${codigo_cita}`,
              stock_anterior: item.stock_actual,
              stock_nuevo: item.stock_actual - cantidadRequerida,
              realizado_por: userId,
            },
          });

          // Actualizar stock del item
          await prisma.item.update({
            where: { codigo_item: item.codigo_item },
            data: { stock_actual: { decrement: cantidadRequerida } },
          });

          // Descontar de lotes (FIFO - primero los mas proximos a vencer)
          let cantidadPendiente = cantidadRequerida;
          const lotes = await prisma.lote.findMany({
            where: {
              codigo_item: item.codigo_item,
              cantidad_actual: { gt: 0 },
            },
            orderBy: { fecha_vencimiento: 'asc' },
          });

          for (const lote of lotes) {
            if (cantidadPendiente <= 0) break;

            const cantidadADescontar = Math.min(cantidadPendiente, lote.cantidad_actual);
            await prisma.lote.update({
              where: { codigo_lote: lote.codigo_lote },
              data: { cantidad_actual: { decrement: cantidadADescontar } },
            });

            cantidadPendiente -= cantidadADescontar;
          }

          movimientos.push({
            codigo_movimiento: movimiento.codigo_movimiento,
            item: item.nombre,
            tipo: 'INSUMO',
            cantidad: cantidadRequerida,
            stock_anterior: item.stock_actual,
            stock_nuevo: item.stock_actual - cantidadRequerida,
          });
        }
      });
    }

    this.logger.log(
      `Insumos descontados para examen ${codigo_examen}, cita ${codigo_cita}. ` +
      `${insumosReactivos.length} reactivos, ${insumosNormales.length} insumos normales.`
    );

    return {
      success: true,
      movimientos,
      mensaje: `Se procesaron ${movimientos.length} insumos (${insumosReactivos.length} reactivos, ${insumosNormales.length} normales)`,
      alertas_reactivos: alertasReactivos.length > 0 ? alertasReactivos : undefined,
    };
  }

  /**
   * Descuenta insumos para múltiples exámenes (cotización completa)
   */
  async descontarInsumosMultiplesExamenes(
    codigos_examenes: number[],
    codigo_cita: number,
    userId: number,
  ): Promise<{
    success: boolean;
    resultados: any[];
    totalMovimientos: number;
  }> {
    const resultados: any[] = [];
    let totalMovimientos = 0;

    for (const codigo_examen of codigos_examenes) {
      try {
        const resultado = await this.descontarInsumosExamen(
          codigo_examen,
          codigo_cita,
          userId,
        );
        resultados.push({
          codigo_examen,
          ...resultado,
        });
        totalMovimientos += resultado.movimientos.length;
      } catch (error) {
        resultados.push({
          codigo_examen,
          success: false,
          mensaje: error.message,
        });
      }
    }

    return {
      success: resultados.every(r => r.success),
      resultados,
      totalMovimientos,
    };
  }

  /**
   * Obtiene el kardex completo de un item (historial de movimientos)
   */
  async getKardexCompletoItem(codigo_item: number, filters?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    tipo_movimiento?: string;
  }) {
    const item = await this.prisma.item.findUnique({
      where: { codigo_item },
      include: { categoria: true },
    });

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    const where: any = { codigo_item };

    if (filters?.fecha_desde) {
      where.fecha_movimiento = { ...where.fecha_movimiento, gte: new Date(filters.fecha_desde) };
    }
    if (filters?.fecha_hasta) {
      where.fecha_movimiento = { ...where.fecha_movimiento, lte: new Date(filters.fecha_hasta) };
    }
    if (filters?.tipo_movimiento) {
      where.tipo_movimiento = filters.tipo_movimiento;
    }

    const movimientos = await this.prisma.movimiento.findMany({
      where,
      include: {
        lote: { select: { numero_lote: true, fecha_vencimiento: true } },
        usuario: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { fecha_movimiento: 'desc' },
    });

    // Calcular totales
    const totales = {
      entradas: 0,
      salidas: 0,
      ajustes_positivos: 0,
      ajustes_negativos: 0,
    };

    for (const mov of movimientos) {
      switch (mov.tipo_movimiento) {
        case 'ENTRADA': totales.entradas += mov.cantidad; break;
        case 'SALIDA': totales.salidas += mov.cantidad; break;
        case 'AJUSTE_POSITIVO': totales.ajustes_positivos += mov.cantidad; break;
        case 'AJUSTE_NEGATIVO': totales.ajustes_negativos += mov.cantidad; break;
      }
    }

    return {
      item,
      stock_actual: item.stock_actual,
      movimientos,
      totales,
      resumen: {
        total_movimientos: movimientos.length,
        balance: totales.entradas + totales.ajustes_positivos - totales.salidas - totales.ajustes_negativos,
      },
    };
  }

  // ==================== ÓRDENES DE COMPRA ====================

  async createOrdenCompra(data: any, adminId: number) {
    // Validar que el proveedor existe y está activo
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { codigo_proveedor: data.codigo_proveedor },
    });

    if (!proveedor) {
      throw new BadRequestException('El proveedor seleccionado no existe');
    }

    if (!proveedor.activo) {
      throw new BadRequestException('El proveedor seleccionado está desactivado. Por favor seleccione un proveedor activo.');
    }

    // Validar detalles
    const detalles = data.detalles || [];
    if (detalles.length === 0) {
      throw new BadRequestException('La orden debe tener al menos un item');
    }

    // Validar que todos los items existen
    const codigosItems = detalles.map((d) => d.codigo_item);
    const itemsExistentes = await this.prisma.item.findMany({
      where: { codigo_item: { in: codigosItems } },
      select: { codigo_item: true, nombre: true, activo: true },
    });

    const itemsMap = new Map(itemsExistentes.map((i) => [i.codigo_item, i]));

    for (const detalle of detalles) {
      const item = itemsMap.get(detalle.codigo_item);
      if (!item) {
        throw new BadRequestException(`El item con código ${detalle.codigo_item} no existe`);
      }
      if (!item.activo) {
        throw new BadRequestException(`El item "${item.nombre}" está desactivado y no puede incluirse en la orden`);
      }
      if (detalle.cantidad <= 0) {
        throw new BadRequestException(`La cantidad para el item "${item.nombre}" debe ser mayor a 0`);
      }
      if (detalle.precio_unitario < 0) {
        throw new BadRequestException(`El precio para el item "${item.nombre}" no puede ser negativo`);
      }
    }

    // Calcular totales
    const subtotal = detalles.reduce(
      (sum, d) => sum + d.cantidad * d.precio_unitario,
      0,
    );
    const iva = 0; // Se puede calcular si aplica
    const total = subtotal + iva;

    return this.prisma.ordenCompra.create({
      data: {
        codigo_proveedor: data.codigo_proveedor,
        numero_orden: `OC-${Date.now()}`,
        creado_por: adminId,
        fecha_orden: new Date(),
        fecha_entrega_estimada: data.fecha_entrega_esperada
          ? new Date(data.fecha_entrega_esperada)
          : null,
        estado: 'BORRADOR',
        subtotal,
        iva,
        total,
        observaciones: data.observaciones || null,
        detalles: {
          create: detalles.map((d) => ({
            codigo_item: d.codigo_item,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            total_linea: d.cantidad * d.precio_unitario,
          })),
        },
      },
      include: {
        proveedor: true,
        detalles: { include: { item: true } },
      },
    });
  }

  async getAllOrdenesCompra(page: number, limit: number, filters: any) {
    const skip = (page - 1) * limit;

    // Construir filtros
    const where: any = {};
    if (filters?.estado && filters.estado !== 'all') {
      where.estado = filters.estado;
    }

    const [ordenes, total] = await Promise.all([
      this.prisma.ordenCompra.findMany({
        where,
        skip,
        take: limit,
        include: { proveedor: true, creador: true, detalles: true },
        orderBy: { fecha_orden: 'desc' },
      }),
      this.prisma.ordenCompra.count({ where }),
    ]);

    // Mapear campos para compatibilidad con frontend
    const data = ordenes.map((orden) => ({
      codigo_orden: orden.codigo_orden_compra, // Mapear al nombre esperado
      numero_orden: orden.numero_orden,
      codigo_proveedor: orden.codigo_proveedor,
      fecha_orden: orden.fecha_orden,
      fecha_entrega_esperada: orden.fecha_entrega_estimada,
      estado: orden.estado,
      subtotal: orden.subtotal,
      impuestos: orden.iva,
      total: orden.total,
      observaciones: orden.observaciones,
      proveedor: orden.proveedor,
      detalles: orden.detalles,
    }));

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrdenCompraById(id: number) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { codigo_orden_compra: id },
      include: { proveedor: true, detalles: { include: { item: true } } },
    });

    if (!orden) return null;

    // Mapear campos para compatibilidad con frontend
    return {
      codigo_orden: orden.codigo_orden_compra,
      numero_orden: orden.numero_orden,
      codigo_proveedor: orden.codigo_proveedor,
      fecha_orden: orden.fecha_orden,
      fecha_entrega_esperada: orden.fecha_entrega_estimada,
      estado: orden.estado,
      subtotal: orden.subtotal,
      impuestos: orden.iva,
      total: orden.total,
      observaciones: orden.observaciones,
      proveedor: orden.proveedor,
      detalles: orden.detalles?.map((d) => ({
        codigo_detalle: d.codigo_detalle,
        codigo_item: d.codigo_item,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal: d.total_linea,
        item: d.item,
      })),
    };
  }

  async updateOrdenCompra(id: number, data: any, adminId: number) {
    // Verificar que la orden existe y está en BORRADOR
    const ordenActual = await this.prisma.ordenCompra.findUnique({
      where: { codigo_orden_compra: id },
      include: { detalles: true },
    });

    if (!ordenActual) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    if (ordenActual.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se pueden editar órdenes en estado BORRADOR');
    }

    // Si se envían nuevos detalles, recalcular totales
    const detalles = data.detalles || [];
    let updateData: any = {
      codigo_proveedor: data.codigo_proveedor,
      fecha_entrega_estimada: data.fecha_entrega_estimada ? new Date(data.fecha_entrega_estimada) : null,
      observaciones: data.observaciones || null,
    };

    // Si hay detalles nuevos, eliminar los anteriores y crear los nuevos
    if (detalles.length > 0) {
      const subtotal = detalles.reduce(
        (sum: number, d: any) => sum + d.cantidad * d.precio_unitario,
        0,
      );
      const iva = 0;
      const total = subtotal + iva;

      // Primero eliminar detalles existentes
      await this.prisma.ordenCompraDetalle.deleteMany({
        where: { codigo_orden_compra: id },
      });

      // Actualizar orden con nuevos detalles
      return this.prisma.ordenCompra.update({
        where: { codigo_orden_compra: id },
        data: {
          ...updateData,
          subtotal,
          iva,
          total,
          detalles: {
            create: detalles.map((d: any) => ({
              codigo_item: d.codigo_item,
              cantidad: d.cantidad,
              precio_unitario: d.precio_unitario,
              total_linea: d.cantidad * d.precio_unitario,
            })),
          },
        },
        include: {
          proveedor: true,
          detalles: { include: { item: true } },
        },
      });
    }

    // Si no hay detalles, solo actualizar datos básicos
    return this.prisma.ordenCompra.update({
      where: { codigo_orden_compra: id },
      data: updateData,
      include: {
        proveedor: true,
        detalles: { include: { item: true } },
      },
    });
  }

  async deleteOrdenCompra(id: number, adminId: number) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { codigo_orden_compra: id },
    });

    if (!orden) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    // No permitir eliminar órdenes ya recibidas (tienen lotes creados)
    if (orden.estado === 'RECIBIDA') {
      throw new BadRequestException(
        'No se puede eliminar una orden ya recibida. Los lotes y movimientos ya fueron registrados.'
      );
    }

    // Soft delete: cambiar a CANCELADA en lugar de eliminar
    const result = await this.prisma.ordenCompra.update({
      where: { codigo_orden_compra: id },
      data: { estado: 'CANCELADA' },
    });

    // Registrar auditoría
    await this.registrarAuditoria(
      adminId,
      'DELETE',
      'OrdenCompra',
      id,
      orden,
      { estado: 'CANCELADA' },
      `Orden ${orden.numero_orden} cancelada/eliminada`,
    );

    return result;
  }

  async emitirOrdenCompra(id: number, adminId: number) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { codigo_orden_compra: id },
    });

    if (!orden) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    // Validar transición de estado: solo BORRADOR puede pasar a EMITIDA
    if (orden.estado !== 'BORRADOR') {
      throw new BadRequestException(
        `No se puede emitir: la orden está en estado "${orden.estado}". Solo órdenes en BORRADOR pueden ser emitidas.`
      );
    }

    const result = await this.prisma.ordenCompra.update({
      where: { codigo_orden_compra: id },
      data: { estado: 'EMITIDA' },
    });

    // Registrar auditoría
    await this.registrarAuditoria(
      adminId,
      'UPDATE',
      'OrdenCompra',
      id,
      { estado: 'BORRADOR' },
      { estado: 'EMITIDA' },
      `Orden ${orden.numero_orden} emitida`,
    );

    return result;
  }

  async recibirOrdenCompra(
    id: number,
    data: {
      items_recibidos?: Array<{
        codigo_item: number;
        cantidad_recibida: number;
        numero_lote?: string;
        fecha_vencimiento?: string;
      }>;
      observaciones_recepcion?: string;
    },
    adminId: number,
  ) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { codigo_orden_compra: id },
      include: {
        detalles: {
          include: { item: true },
        },
        proveedor: true,
      },
    });

    if (!orden) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    // Validar transición de estado: solo EMITIDA puede pasar a RECIBIDA
    if (orden.estado !== 'EMITIDA') {
      throw new BadRequestException(
        `No se puede recibir: la orden está en estado "${orden.estado}". Solo órdenes EMITIDA pueden ser recibidas.`
      );
    }

    // Usar transacción para crear lotes y actualizar stock
    return this.prisma.$transaction(async (prisma) => {
      const lotesCreados: any[] = [];

      for (const detalle of orden.detalles) {
        // Buscar si hay datos específicos de recepción para este item
        const datosRecepcion = data.items_recibidos?.find(
          (i) => i.codigo_item === detalle.codigo_item,
        );

        const cantidadRecibida = datosRecepcion?.cantidad_recibida || detalle.cantidad;
        const numeroLote = datosRecepcion?.numero_lote || `OC-${orden.numero_orden}-${detalle.codigo_item}`;
        const fechaVencimiento = datosRecepcion?.fecha_vencimiento
          ? new Date(datosRecepcion.fecha_vencimiento)
          : null;

        // 1. Crear lote
        const lote = await prisma.lote.create({
          data: {
            codigo_item: detalle.codigo_item,
            numero_lote: numeroLote,
            cantidad_inicial: cantidadRecibida,
            cantidad_actual: cantidadRecibida,
            fecha_vencimiento: fechaVencimiento,
            proveedor: orden.proveedor?.razon_social || null,
          },
        });

        lotesCreados.push(lote);

        // 2. Obtener stock actual del item
        const item = await prisma.item.findUnique({
          where: { codigo_item: detalle.codigo_item },
        });

        const stockAnterior = item?.stock_actual || 0;
        const stockNuevo = stockAnterior + cantidadRecibida;

        // 3. Crear movimiento de COMPRA
        await prisma.movimiento.create({
          data: {
            codigo_item: detalle.codigo_item,
            codigo_lote: lote.codigo_lote,
            tipo_movimiento: 'COMPRA',
            cantidad: cantidadRecibida,
            motivo: `Recepción orden de compra ${orden.numero_orden}`,
            referencia: `OC-${orden.numero_orden}`,
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo,
            realizado_por: adminId,
          },
        });

        // 4. Actualizar stock del item
        await prisma.item.update({
          where: { codigo_item: detalle.codigo_item },
          data: { stock_actual: { increment: cantidadRecibida } },
        });
      }

      // 5. Actualizar estado de la orden
      const ordenActualizada = await prisma.ordenCompra.update({
        where: { codigo_orden_compra: id },
        data: {
          estado: 'RECIBIDA',
          fecha_entrega_real: new Date(),
          observaciones: data.observaciones_recepcion
            ? `${orden.observaciones || ''}\n[Recepción]: ${data.observaciones_recepcion}`
            : orden.observaciones,
        },
        include: {
          detalles: { include: { item: true } },
          proveedor: true,
        },
      });

      // Registrar auditoría
      await this.registrarAuditoria(
        adminId,
        'UPDATE',
        'OrdenCompra',
        id,
        { estado: 'EMITIDA' },
        { estado: 'RECIBIDA', lotes_creados: lotesCreados.length },
        `Orden ${orden.numero_orden} recibida - ${lotesCreados.length} lotes creados`,
      );

      return {
        orden: ordenActualizada,
        lotes_creados: lotesCreados,
        mensaje: `Orden recibida exitosamente. Se crearon ${lotesCreados.length} lotes y se actualizó el stock.`,
      };
    });
  }

  async cancelarOrdenCompra(id: number, adminId: number) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { codigo_orden_compra: id },
    });

    if (!orden) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    // No permitir cancelar órdenes ya recibidas
    if (orden.estado === 'RECIBIDA') {
      throw new BadRequestException(
        'No se puede cancelar una orden ya recibida. Los lotes y movimientos ya fueron registrados.'
      );
    }

    // Ya está cancelada
    if (orden.estado === 'CANCELADA') {
      throw new BadRequestException('La orden ya está cancelada.');
    }

    const result = await this.prisma.ordenCompra.update({
      where: { codigo_orden_compra: id },
      data: { estado: 'CANCELADA' },
    });

    // Registrar auditoría
    await this.registrarAuditoria(
      adminId,
      'UPDATE',
      'OrdenCompra',
      id,
      { estado: orden.estado },
      { estado: 'CANCELADA' },
      `Orden ${orden.numero_orden} cancelada`,
    );

    return result;
  }

  // ==================== WORKFLOW AUTOMATIZADO DE FACTURA ====================

  /**
   * Procesa los datos extraídos del OCR de factura y crea automáticamente:
   * 1. Proveedor (si no existe)
   * 2. Items (si no existen)
   * 3. Lotes con las cantidades
   */
  async procesarFacturaAutomatico(
    ocrData: {
      proveedor?: {
        ruc?: string;
        razon_social?: string;
        direccion?: string;
        telefono?: string;
      };
      factura?: {
        numero?: string;
        fecha?: string;
        total?: number;
      };
      items: Array<{
        descripcion: string;
        cantidad: number;
        unidad?: string;
        precio_unitario?: number;
        numero_lote?: string;
        fecha_vencimiento?: string;
      }>;
    },
    adminId: number,
  ) {
    const resultados = {
      proveedor: null as any,
      proveedor_creado: false,
      items_procesados: [] as any[],
      items_no_encontrados: [] as string[],
      lotes_creados: [] as any[],
      errores: [] as string[],
    };

    try {
      // 1. Buscar o crear proveedor
      if (ocrData.proveedor?.ruc) {
        let proveedor = await this.prisma.proveedor.findUnique({
          where: { ruc: ocrData.proveedor.ruc },
        });

        if (!proveedor && ocrData.proveedor.razon_social) {
          // Crear proveedor nuevo
          try {
            proveedor = await this.prisma.proveedor.create({
              data: {
                ruc: ocrData.proveedor.ruc,
                razon_social: ocrData.proveedor.razon_social,
                nombre_comercial: ocrData.proveedor.razon_social,
                direccion: ocrData.proveedor.direccion || null,
                telefono: ocrData.proveedor.telefono || null,
                activo: true,
              },
            });
            resultados.proveedor_creado = true;

            // Registrar auditoría
            await this.registrarAuditoria(
              adminId,
              'CREAR',
              'PROVEEDOR',
              proveedor.codigo_proveedor,
              null,
              null,
              `Proveedor creado automáticamente desde factura: ${proveedor.razon_social}`,
            );
          } catch (e) {
            resultados.errores.push(`Error creando proveedor: ${e.message}`);
          }
        }
        resultados.proveedor = proveedor;
      }

      // 2. Procesar cada item de la factura
      for (const itemFactura of ocrData.items) {
        if (!itemFactura.descripcion || !itemFactura.cantidad) {
          resultados.errores.push(`Item sin descripción o cantidad: ${JSON.stringify(itemFactura)}`);
          continue;
        }

        // Buscar item en inventario (búsqueda flexible)
        const itemEncontrado = await this.buscarItemPorDescripcion(itemFactura.descripcion);

        if (itemEncontrado) {
          // Crear lote
          const numeroLote = itemFactura.numero_lote || this.generarNumeroLote(ocrData.factura?.numero);

          try {
            const lote = await this.createLote(
              {
                codigo_item: itemEncontrado.codigo_item,
                numero_lote: numeroLote,
                cantidad_inicial: itemFactura.cantidad,
                fecha_vencimiento: itemFactura.fecha_vencimiento
                  ? new Date(itemFactura.fecha_vencimiento)
                  : undefined,
                proveedor: resultados.proveedor?.codigo_proveedor?.toString(),
              },
              adminId,
            );

            resultados.lotes_creados.push({
              item: itemEncontrado.nombre,
              codigo_item: itemEncontrado.codigo_item,
              lote: lote,
              cantidad: itemFactura.cantidad,
            });

            resultados.items_procesados.push({
              descripcion_factura: itemFactura.descripcion,
              item_encontrado: itemEncontrado.nombre,
              codigo_item: itemEncontrado.codigo_item,
              cantidad: itemFactura.cantidad,
              lote: numeroLote,
            });
          } catch (e) {
            resultados.errores.push(`Error creando lote para ${itemEncontrado.nombre}: ${e.message}`);
          }
        } else {
          // Item no encontrado - agregar a lista para crear manualmente
          resultados.items_no_encontrados.push(itemFactura.descripcion);
        }
      }

      // 3. Registrar en auditoría el procesamiento de factura
      await this.registrarAuditoria(
        adminId,
        'PROCESAR_FACTURA',
        'INVENTARIO',
        null,
        null,
        null,
        `Factura ${ocrData.factura?.numero || 'S/N'} procesada: ${resultados.lotes_creados.length} lotes creados, ${resultados.items_no_encontrados.length} items no encontrados`,
      );

      return {
        success: true,
        resumen: {
          proveedor: resultados.proveedor?.razon_social || 'No identificado',
          proveedor_nuevo: resultados.proveedor_creado,
          factura_numero: ocrData.factura?.numero || 'N/A',
          total_items_factura: ocrData.items.length,
          items_procesados: resultados.items_procesados.length,
          items_no_encontrados: resultados.items_no_encontrados.length,
          lotes_creados: resultados.lotes_creados.length,
        },
        detalles: {
          items_procesados: resultados.items_procesados,
          items_no_encontrados: resultados.items_no_encontrados,
          lotes: resultados.lotes_creados,
        },
        errores: resultados.errores,
      };

    } catch (error) {
      this.logger.error(`Error en procesamiento automático de factura: ${error.message}`);
      return {
        success: false,
        error: error.message,
        resultados_parciales: resultados,
      };
    }
  }

  /**
   * Busca un item por descripción usando búsqueda flexible
   */
  private async buscarItemPorDescripcion(descripcion: string) {
    const descripcionNormalizada = this.normalizarTexto(descripcion);

    // 1. Búsqueda exacta (insensitive)
    let item = await this.prisma.item.findFirst({
      where: {
        nombre: { equals: descripcion, mode: 'insensitive' },
        activo: true,
      },
    });

    if (item) return item;

    // 2. Búsqueda por contains
    item = await this.prisma.item.findFirst({
      where: {
        nombre: { contains: descripcion, mode: 'insensitive' },
        activo: true,
      },
    });

    if (item) return item;

    // 3. Búsqueda palabra por palabra
    const palabras = descripcionNormalizada.split(' ').filter(p => p.length > 2);

    for (const palabra of palabras) {
      item = await this.prisma.item.findFirst({
        where: {
          nombre: { contains: palabra, mode: 'insensitive' },
          activo: true,
        },
      });
      if (item) return item;
    }

    // 4. Búsqueda en descripción del item
    item = await this.prisma.item.findFirst({
      where: {
        descripcion: { contains: descripcion, mode: 'insensitive' },
        activo: true,
      },
    });

    return item;
  }

  /**
   * Normaliza texto para búsqueda (quita acentos, lowercase)
   */
  private normalizarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Genera un número de lote basado en la factura
   */
  private generarNumeroLote(numeroFactura?: string): string {
    const fecha = new Date();
    const timestamp = fecha.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `LOT-${numeroFactura || 'AUTO'}-${timestamp}-${random}`;
  }

  // ==================== HISTÓRICO DE CAMBIOS (HU-30) ====================

  /**
   * Obtiene el historial de cambios de un ítem específico
   * Incluye auditoría de LogActividad y AuditoriaTabla
   */
  async getHistorialCambiosItem(
    codigoItem: number,
    page: number = 1,
    limit: number = 20,
    fechaDesde?: string,
    fechaHasta?: string
  ) {
    // Verificar que el ítem existe
    const item = await this.prisma.item.findUnique({
      where: { codigo_item: codigoItem },
      include: { categoria: true },
    });

    if (!item) {
      throw new NotFoundException('Ítem no encontrado');
    }

    const skip = (page - 1) * limit;

    // Construir filtro de fechas
    const fechaWhere: any = {};
    if (fechaDesde) {
      fechaWhere.gte = new Date(fechaDesde);
    }
    if (fechaHasta) {
      const fechaFin = new Date(fechaHasta);
      fechaFin.setHours(23, 59, 59, 999);
      fechaWhere.lte = fechaFin;
    }

    // Obtener logs de LogActividad relacionados con este ítem
    const [logsActividad, totalActividad] = await Promise.all([
      this.prisma.logActividad.findMany({
        where: {
          entidad: 'Item',
          descripcion: { contains: item.codigo_interno },
          ...(Object.keys(fechaWhere).length > 0 ? { fecha_accion: fechaWhere } : {}),
        },
        include: {
          usuario: {
            select: {
              codigo_usuario: true,
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
      this.prisma.logActividad.count({
        where: {
          entidad: 'Item',
          descripcion: { contains: item.codigo_interno },
          ...(Object.keys(fechaWhere).length > 0 ? { fecha_accion: fechaWhere } : {}),
        },
      }),
    ]);

    // Obtener logs de AuditoriaTabla relacionados con este ítem
    const [logsAuditoria, totalAuditoria] = await Promise.all([
      this.prisma.auditoriaTabla.findMany({
        where: {
          tabla: 'item',
          codigo_registro: codigoItem,
          ...(Object.keys(fechaWhere).length > 0 ? { fecha_operacion: fechaWhere } : {}),
        },
        orderBy: { fecha_operacion: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditoriaTabla.count({
        where: {
          tabla: 'item',
          codigo_registro: codigoItem,
          ...(Object.keys(fechaWhere).length > 0 ? { fecha_operacion: fechaWhere } : {}),
        },
      }),
    ]);

    // Combinar y formatear los registros
    const historial = [
      ...logsActividad.map(log => ({
        tipo: 'actividad',
        fecha: log.fecha_accion,
        accion: log.accion,
        descripcion: log.descripcion,
        usuario: log.usuario ? `${log.usuario.nombres} ${log.usuario.apellidos}` : 'Sistema',
        email_usuario: log.usuario?.email,
        ip_address: log.ip_address,
        datos_anteriores: null,
        datos_nuevos: null,
      })),
      ...logsAuditoria.map(log => ({
        tipo: 'auditoria',
        fecha: log.fecha_operacion,
        accion: log.operacion,
        descripcion: `${log.operacion} en tabla ${log.tabla}`,
        usuario: null,
        email_usuario: null,
        ip_address: log.ip_address,
        datos_anteriores: log.datos_anteriores,
        datos_nuevos: log.datos_nuevos,
      })),
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const total = totalActividad + totalAuditoria;

    return {
      item: {
        codigo_item: item.codigo_item,
        codigo_interno: item.codigo_interno,
        nombre: item.nombre,
        categoria: item.categoria?.nombre,
      },
      historial: historial.slice(0, limit),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== ALERTAS SIN MOVIMIENTOS (HU-33) ====================

  /**
   * Obtiene ítems sin movimientos en los últimos n días
   */
  async getItemsSinMovimientos(dias: number = 30) {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);

    // Obtener todos los ítems activos
    const items = await this.prisma.item.findMany({
      where: { activo: true },
      include: {
        categoria: true,
        movimientos: {
          where: {
            fecha_movimiento: { gte: fechaLimite },
          },
          orderBy: { fecha_movimiento: 'desc' },
          take: 1,
        },
      },
    });

    // Filtrar ítems sin movimientos recientes
    const itemsSinMovimiento = items.filter(item => item.movimientos.length === 0);

    // Para cada ítem sin movimiento reciente, obtener el último movimiento
    const resultado = await Promise.all(
      itemsSinMovimiento.map(async item => {
        const ultimoMovimiento = await this.prisma.movimiento.findFirst({
          where: { codigo_item: item.codigo_item },
          orderBy: { fecha_movimiento: 'desc' },
        });

        const diasSinMovimiento = ultimoMovimiento
          ? Math.floor(
              (new Date().getTime() - new Date(ultimoMovimiento.fecha_movimiento).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;

        return {
          codigo_item: item.codigo_item,
          codigo_interno: item.codigo_interno,
          nombre: item.nombre,
          categoria: item.categoria?.nombre || 'Sin categoría',
          stock_actual: item.stock_actual,
          unidad_medida: item.unidad_medida,
          ultimo_movimiento: ultimoMovimiento?.fecha_movimiento || null,
          dias_sin_movimiento: diasSinMovimiento,
          tipo_alerta: 'SIN_MOVIMIENTO',
          mensaje: ultimoMovimiento
            ? `Sin movimientos desde hace ${diasSinMovimiento} días`
            : 'Nunca ha tenido movimientos',
          prioridad: diasSinMovimiento === null || diasSinMovimiento > 60 ? 'ALTA' : 'MEDIA',
        };
      })
    );

    return {
      total: resultado.length,
      dias_umbral: dias,
      items: resultado.sort((a, b) => (b.dias_sin_movimiento || 999) - (a.dias_sin_movimiento || 999)),
    };
  }

  // ==================== REPORTES DE INVENTARIO (HU-34) ====================

  /**
   * Reporte de consumo por servicio/examen
   * Usa ExamenInsumo para vincular ítems con exámenes realizados
   */
  async getReporteConsumoPorServicio(
    fechaDesde?: string,
    fechaHasta?: string,
    codigoCategoria?: number
  ) {
    // Determinar rango de fechas
    const fechaInicio = fechaDesde ? new Date(fechaDesde) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const fechaFin = fechaHasta ? new Date(fechaHasta) : new Date();
    fechaFin.setHours(23, 59, 59, 999);

    // Obtener resultados en el período (exámenes realizados)
    const resultados = await this.prisma.resultado.findMany({
      where: {
        fecha_resultado: {
          gte: fechaInicio,
          lte: fechaFin,
        },
        estado: { in: ['COMPLETADO', 'VALIDADO', 'ENTREGADO'] },
      },
      include: {
        examen: {
          include: {
            insumos: {
              include: {
                item: {
                  include: { categoria: true },
                },
              },
              where: codigoCategoria ? { item: { codigo_categoria: codigoCategoria } } : {},
            },
          },
        },
      },
    });

    // Calcular consumo por ítem
    const consumoPorItem: Record<number, {
      codigo_item: number;
      codigo_interno: string;
      nombre: string;
      categoria: string;
      unidad_medida: string;
      cantidad_consumida: number;
      costo_unitario: number;
      costo_total: number;
      examenes_relacionados: Set<string>;
    }> = {};

    for (const resultado of resultados) {
      for (const insumo of resultado.examen.insumos) {
        const item = insumo.item;
        if (!consumoPorItem[item.codigo_item]) {
          consumoPorItem[item.codigo_item] = {
            codigo_item: item.codigo_item,
            codigo_interno: item.codigo_interno,
            nombre: item.nombre,
            categoria: item.categoria?.nombre || 'Sin categoría',
            unidad_medida: item.unidad_medida,
            cantidad_consumida: 0,
            costo_unitario: Number(item.costo_unitario) || 0,
            costo_total: 0,
            examenes_relacionados: new Set(),
          };
        }
        consumoPorItem[item.codigo_item].cantidad_consumida += Number(insumo.cantidad_requerida);
        consumoPorItem[item.codigo_item].costo_total +=
          Number(insumo.cantidad_requerida) * (Number(item.costo_unitario) || 0);
        consumoPorItem[item.codigo_item].examenes_relacionados.add(resultado.examen.nombre);
      }
    }

    // Convertir a array y ordenar por costo total
    const items = Object.values(consumoPorItem)
      .map(item => ({
        ...item,
        examenes_relacionados: Array.from(item.examenes_relacionados),
      }))
      .sort((a, b) => b.costo_total - a.costo_total);

    // Calcular totales
    const totalConsumo = items.reduce((sum, item) => sum + item.cantidad_consumida, 0);
    const costoTotal = items.reduce((sum, item) => sum + item.costo_total, 0);

    return {
      periodo: {
        desde: fechaInicio.toISOString().split('T')[0],
        hasta: fechaFin.toISOString().split('T')[0],
      },
      resumen: {
        total_examenes_realizados: resultados.length,
        total_items_consumidos: items.length,
        cantidad_total_consumida: totalConsumo,
        costo_total: costoTotal,
      },
      items,
    };
  }

  /**
   * Reporte de compras por proveedor
   */
  async getReporteComprasPorProveedor(
    fechaDesde?: string,
    fechaHasta?: string,
    codigoProveedor?: number
  ) {
    const fechaInicio = fechaDesde ? new Date(fechaDesde) : new Date(new Date().setMonth(new Date().getMonth() - 3));
    const fechaFin = fechaHasta ? new Date(fechaHasta) : new Date();
    fechaFin.setHours(23, 59, 59, 999);

    const whereOrdenes: any = {
      fecha_orden: {
        gte: fechaInicio,
        lte: fechaFin,
      },
      estado: { in: ['EMITIDA', 'RECIBIDA'] },
    };

    if (codigoProveedor) {
      whereOrdenes.codigo_proveedor = codigoProveedor;
    }

    // Obtener órdenes de compra
    const ordenes = await this.prisma.ordenCompra.findMany({
      where: whereOrdenes,
      include: {
        proveedor: true,
        detalles: {
          include: {
            item: {
              include: { categoria: true },
            },
          },
        },
      },
      orderBy: { fecha_orden: 'desc' },
    });

    // Agrupar por proveedor
    const comprasPorProveedor: Record<number, {
      codigo_proveedor: number;
      ruc: string;
      razon_social: string;
      total_ordenes: number;
      ordenes_recibidas: number;
      ordenes_pendientes: number;
      monto_total: number;
      items_comprados: Record<number, {
        codigo_item: number;
        nombre: string;
        categoria: string;
        cantidad_total: number;
        monto_total: number;
      }>;
    }> = {};

    for (const orden of ordenes) {
      const prov = orden.proveedor;
      if (!comprasPorProveedor[prov.codigo_proveedor]) {
        comprasPorProveedor[prov.codigo_proveedor] = {
          codigo_proveedor: prov.codigo_proveedor,
          ruc: prov.ruc,
          razon_social: prov.razon_social,
          total_ordenes: 0,
          ordenes_recibidas: 0,
          ordenes_pendientes: 0,
          monto_total: 0,
          items_comprados: {},
        };
      }

      comprasPorProveedor[prov.codigo_proveedor].total_ordenes++;
      comprasPorProveedor[prov.codigo_proveedor].monto_total += Number(orden.total);

      if (orden.estado === 'RECIBIDA') {
        comprasPorProveedor[prov.codigo_proveedor].ordenes_recibidas++;
      } else {
        comprasPorProveedor[prov.codigo_proveedor].ordenes_pendientes++;
      }

      // Agregar items
      for (const detalle of orden.detalles) {
        const itemId = detalle.codigo_item;
        if (!comprasPorProveedor[prov.codigo_proveedor].items_comprados[itemId]) {
          comprasPorProveedor[prov.codigo_proveedor].items_comprados[itemId] = {
            codigo_item: itemId,
            nombre: detalle.item.nombre,
            categoria: detalle.item.categoria?.nombre || 'Sin categoría',
            cantidad_total: 0,
            monto_total: 0,
          };
        }
        comprasPorProveedor[prov.codigo_proveedor].items_comprados[itemId].cantidad_total += detalle.cantidad;
        comprasPorProveedor[prov.codigo_proveedor].items_comprados[itemId].monto_total += Number(detalle.total_linea);
      }
    }

    // Convertir a array
    const proveedores = Object.values(comprasPorProveedor).map(prov => ({
      ...prov,
      items_comprados: Object.values(prov.items_comprados).sort((a, b) => b.monto_total - a.monto_total),
    })).sort((a, b) => b.monto_total - a.monto_total);

    // Calcular totales generales
    const totalOrdenes = proveedores.reduce((sum, p) => sum + p.total_ordenes, 0);
    const montoTotal = proveedores.reduce((sum, p) => sum + p.monto_total, 0);

    return {
      periodo: {
        desde: fechaInicio.toISOString().split('T')[0],
        hasta: fechaFin.toISOString().split('T')[0],
      },
      resumen: {
        total_proveedores: proveedores.length,
        total_ordenes: totalOrdenes,
        monto_total: montoTotal,
      },
      proveedores,
    };
  }

  /**
   * Reporte de compras por categoría
   */
  async getReporteComprasPorCategoria(fechaDesde?: string, fechaHasta?: string) {
    const fechaInicio = fechaDesde ? new Date(fechaDesde) : new Date(new Date().setMonth(new Date().getMonth() - 3));
    const fechaFin = fechaHasta ? new Date(fechaHasta) : new Date();
    fechaFin.setHours(23, 59, 59, 999);

    // Obtener órdenes con detalles
    const ordenes = await this.prisma.ordenCompra.findMany({
      where: {
        fecha_orden: { gte: fechaInicio, lte: fechaFin },
        estado: { in: ['EMITIDA', 'RECIBIDA'] },
      },
      include: {
        detalles: {
          include: {
            item: {
              include: { categoria: true },
            },
          },
        },
      },
    });

    // Agrupar por categoría
    const comprasPorCategoria: Record<number | string, {
      codigo_categoria: number | null;
      nombre: string;
      total_items: number;
      cantidad_total: number;
      monto_total: number;
    }> = {};

    for (const orden of ordenes) {
      for (const detalle of orden.detalles) {
        const catId = detalle.item.codigo_categoria || 'sin_categoria';
        const catNombre = detalle.item.categoria?.nombre || 'Sin categoría';

        if (!comprasPorCategoria[catId]) {
          comprasPorCategoria[catId] = {
            codigo_categoria: detalle.item.codigo_categoria,
            nombre: catNombre,
            total_items: 0,
            cantidad_total: 0,
            monto_total: 0,
          };
        }

        comprasPorCategoria[catId].total_items++;
        comprasPorCategoria[catId].cantidad_total += detalle.cantidad;
        comprasPorCategoria[catId].monto_total += Number(detalle.total_linea);
      }
    }

    const categorias = Object.values(comprasPorCategoria).sort((a, b) => b.monto_total - a.monto_total);
    const montoTotal = categorias.reduce((sum, c) => sum + c.monto_total, 0);

    return {
      periodo: {
        desde: fechaInicio.toISOString().split('T')[0],
        hasta: fechaFin.toISOString().split('T')[0],
      },
      resumen: {
        total_categorias: categorias.length,
        monto_total: montoTotal,
      },
      categorias,
    };
  }

  /**
   * Reporte Kardex completo para exportación
   */
  async getReporteKardexCompleto(fechaDesde?: string, fechaHasta?: string, codigoCategoria?: number) {
    const fechaInicio = fechaDesde ? new Date(fechaDesde) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const fechaFin = fechaHasta ? new Date(fechaHasta) : new Date();
    fechaFin.setHours(23, 59, 59, 999);

    const whereItems: any = { activo: true };
    if (codigoCategoria) {
      whereItems.codigo_categoria = codigoCategoria;
    }

    const items = await this.prisma.item.findMany({
      where: whereItems,
      include: {
        categoria: true,
        movimientos: {
          where: {
            fecha_movimiento: { gte: fechaInicio, lte: fechaFin },
          },
          include: {
            usuario: { select: { nombres: true, apellidos: true } },
            lote: { select: { numero_lote: true } },
          },
          orderBy: { fecha_movimiento: 'asc' },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    const kardexItems = items.map(item => {
      let saldoInicial = item.stock_actual;
      // Calcular saldo inicial restando movimientos del período
      for (const mov of item.movimientos) {
        if (mov.tipo_movimiento === 'ENTRADA' || mov.tipo_movimiento === 'AJUSTE_POSITIVO') {
          saldoInicial -= mov.cantidad;
        } else {
          saldoInicial += mov.cantidad;
        }
      }

      const entradas = item.movimientos
        .filter(m => m.tipo_movimiento === 'ENTRADA' || m.tipo_movimiento === 'AJUSTE_POSITIVO')
        .reduce((sum, m) => sum + m.cantidad, 0);

      const salidas = item.movimientos
        .filter(m => m.tipo_movimiento === 'SALIDA' || m.tipo_movimiento === 'AJUSTE_NEGATIVO')
        .reduce((sum, m) => sum + m.cantidad, 0);

      return {
        codigo_item: item.codigo_item,
        codigo_interno: item.codigo_interno,
        nombre: item.nombre,
        categoria: item.categoria?.nombre || 'Sin categoría',
        unidad_medida: item.unidad_medida,
        costo_unitario: Number(item.costo_unitario) || 0,
        saldo_inicial: saldoInicial,
        total_entradas: entradas,
        total_salidas: salidas,
        saldo_final: item.stock_actual,
        valor_inventario: item.stock_actual * (Number(item.costo_unitario) || 0),
        movimientos: item.movimientos.map(m => ({
          fecha: m.fecha_movimiento,
          tipo: m.tipo_movimiento,
          cantidad: m.cantidad,
          motivo: m.motivo,
          lote: m.lote?.numero_lote,
          usuario: m.usuario ? `${m.usuario.nombres} ${m.usuario.apellidos}` : 'Sistema',
          stock_anterior: m.stock_anterior,
          stock_nuevo: m.stock_nuevo,
        })),
      };
    });

    const totalValorInventario = kardexItems.reduce((sum, item) => sum + item.valor_inventario, 0);
    const totalEntradas = kardexItems.reduce((sum, item) => sum + item.total_entradas, 0);
    const totalSalidas = kardexItems.reduce((sum, item) => sum + item.total_salidas, 0);

    return {
      periodo: {
        desde: fechaInicio.toISOString().split('T')[0],
        hasta: fechaFin.toISOString().split('T')[0],
      },
      resumen: {
        total_items: kardexItems.length,
        valor_total_inventario: totalValorInventario,
        total_entradas: totalEntradas,
        total_salidas: totalSalidas,
      },
      items: kardexItems,
    };
  }

  // ==================== CONSUMO AUTOMÁTICO POR EXAMEN ====================

  /**
   * Consume automáticamente los insumos configurados para un examen
   * Se llama cuando un resultado de laboratorio es validado/completado
   */
  async consumirInsumosExamen(
    codigoExamen: number,
    codigoResultado: number,
    usuarioId: number,
  ): Promise<{ exito: boolean; consumos: any[]; errores: string[] }> {
    const consumos: any[] = [];
    const errores: string[] = [];

    try {
      // 1. Obtener los insumos configurados para este examen
      const insumos = await this.prisma.examenInsumo.findMany({
        where: {
          codigo_examen: codigoExamen,
          activo: true,
        },
        include: {
          item: true,
          examen: {
            select: { nombre: true, codigo_interno: true },
          },
        },
      });

      if (insumos.length === 0) {
        this.logger.log(`Examen ${codigoExamen} no tiene insumos configurados`);
        return { exito: true, consumos: [], errores: [] };
      }

      // 2. Procesar cada insumo
      for (const insumo of insumos) {
        const cantidadRequerida = Number(insumo.cantidad_requerida);
        const item = insumo.item;

        // Verificar stock disponible
        if (item.stock_actual < cantidadRequerida) {
          errores.push(
            `Stock insuficiente de "${item.nombre}": disponible ${item.stock_actual}, requerido ${cantidadRequerida}`,
          );
          continue;
        }

        // Crear movimiento de SALIDA
        const stockAnterior = Number(item.stock_actual);
        const stockNuevo = stockAnterior - cantidadRequerida;

        const movimiento = await this.prisma.movimiento.create({
          data: {
            codigo_item: item.codigo_item,
            tipo_movimiento: 'SALIDA',
            cantidad: cantidadRequerida,
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo,
            motivo: `Consumo automático - Examen: ${insumo.examen.nombre} (Resultado #${codigoResultado})`,
            referencia: `RES-${codigoResultado}`,
            realizado_por: usuarioId,
          },
        });

        // Actualizar stock del item
        await this.prisma.item.update({
          where: { codigo_item: item.codigo_item },
          data: { stock_actual: stockNuevo },
        });

        consumos.push({
          item: item.nombre,
          codigo_item: item.codigo_item,
          cantidad: cantidadRequerida,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          movimiento_id: movimiento.codigo_movimiento,
        });

        // Verificar si necesita generar alerta de stock bajo
        if (stockNuevo <= Number(item.stock_minimo)) {
          await this.crearAlertaStockBajo(item, stockNuevo);
        }

        this.logger.log(
          `Consumo automático: ${item.codigo_interno} - ${cantidadRequerida} unid. para examen ${codigoExamen}`,
        );
      }

      // 3. Registrar en auditoría
      await this.registrarAuditoria(
        usuarioId,
        'CONSUMO_AUTOMATICO',
        'Resultado',
        codigoResultado,
        null,
        { examen: codigoExamen, consumos },
        `Consumo automático de ${consumos.length} insumos para resultado #${codigoResultado}`,
      );

      return {
        exito: errores.length === 0,
        consumos,
        errores,
      };
    } catch (error) {
      this.logger.error(`Error en consumo automático: ${error.message}`);
      return {
        exito: false,
        consumos,
        errores: [...errores, error.message],
      };
    }
  }

  /**
   * Crea una alerta de stock bajo si no existe una activa
   */
  private async crearAlertaStockBajo(item: any, stockActual: number) {
    // Verificar si ya hay una alerta activa para este item
    const alertaExistente = await this.prisma.alertaInventario.findFirst({
      where: {
        codigo_item: item.codigo_item,
        tipo_alerta: { in: ['STOCK_BAJO', 'STOCK_CRITICO'] },
        resuelta: false,
      },
    });

    if (alertaExistente) return; // Ya existe alerta activa

    const tipoAlerta = stockActual === 0 ? 'STOCK_CRITICO' : 'STOCK_BAJO';
    const prioridad = stockActual === 0 ? 'CRITICA' : 'ALTA';

    await this.prisma.alertaInventario.create({
      data: {
        codigo_item: item.codigo_item,
        tipo_alerta: tipoAlerta,
        mensaje: `${tipoAlerta === 'STOCK_CRITICO' ? 'SIN STOCK' : 'Stock bajo'}: ${item.nombre} (${item.codigo_interno}) - Actual: ${stockActual}, Mínimo: ${item.stock_minimo}`,
        prioridad,
        stock_actual: stockActual,
        stock_minimo: item.stock_minimo,
      },
    });

    this.logger.warn(`Alerta ${tipoAlerta} creada para ${item.codigo_interno}`);
  }

  // ==================== GENERAR ORDEN DE COMPRA AUTOMÁTICA ====================

  /**
   * Genera una orden de compra borrador con los items que tienen stock bajo
   */
  async generarOrdenCompraDesdeAlertas(
    codigoProveedor: number,
    usuarioId: number,
  ): Promise<any> {
    // 1. Obtener items con alertas activas de stock bajo
    const alertas = await this.prisma.alertaInventario.findMany({
      where: {
        tipo_alerta: { in: ['STOCK_BAJO', 'STOCK_CRITICO'] },
        resuelta: false,
      },
      include: {
        item: true,
      },
    });

    if (alertas.length === 0) {
      throw new BadRequestException('No hay items con alertas de stock bajo activas');
    }

    // 2. Calcular cantidades a pedir (hasta stock máximo o mínimo + 50%)
    const detalles = alertas.map((alerta) => {
      const item = alerta.item;
      const stockActual = Number(item.stock_actual);
      const stockMinimo = Number(item.stock_minimo);
      const stockMaximo = item.stock_maximo ? Number(item.stock_maximo) : stockMinimo * 2;

      // Cantidad a pedir: diferencia entre máximo y actual
      const cantidadPedir = Math.max(stockMaximo - stockActual, stockMinimo);
      const precioUnitario = Number(item.costo_unitario) || 0;

      return {
        codigo_item: item.codigo_item,
        cantidad: Math.ceil(cantidadPedir),
        precio_unitario: precioUnitario,
      };
    });

    // 3. Crear la orden de compra
    const orden = await this.createOrdenCompra(
      {
        codigo_proveedor: codigoProveedor,
        observaciones: `Orden generada automáticamente desde alertas de stock bajo - ${alertas.length} items`,
        detalles,
      },
      usuarioId,
    );

    this.logger.log(
      `Orden de compra ${orden.numero_orden} generada automáticamente con ${detalles.length} items`,
    );

    return orden;
  }

  /**
   * Obtiene los items con stock bajo para mostrar al usuario antes de generar OC
   */
  async getItemsParaOrdenAutomatica(): Promise<any[]> {
    const alertas = await this.prisma.alertaInventario.findMany({
      where: {
        tipo_alerta: { in: ['STOCK_BAJO', 'STOCK_CRITICO'] },
        resuelta: false,
      },
      include: {
        item: {
          include: {
            categoria: true,
          },
        },
      },
      orderBy: {
        prioridad: 'desc',
      },
    });

    return alertas.map((alerta) => {
      const item = alerta.item;
      const stockActual = Number(item.stock_actual);
      const stockMinimo = Number(item.stock_minimo);
      const stockMaximo = item.stock_maximo ? Number(item.stock_maximo) : stockMinimo * 2;
      const cantidadSugerida = Math.ceil(Math.max(stockMaximo - stockActual, stockMinimo));

      return {
        codigo_item: item.codigo_item,
        codigo_interno: item.codigo_interno,
        nombre: item.nombre,
        categoria: item.categoria?.nombre || 'Sin categoría',
        unidad_medida: item.unidad_medida,
        stock_actual: stockActual,
        stock_minimo: stockMinimo,
        stock_maximo: stockMaximo,
        cantidad_sugerida: cantidadSugerida,
        costo_unitario: Number(item.costo_unitario) || 0,
        prioridad: alerta.prioridad,
        tipo_alerta: alerta.tipo_alerta,
      };
    });
  }

  // ==================== GESTIÓN DE INSUMOS POR EXAMEN ====================

  /**
   * Obtiene los insumos configurados para un examen específico
   */
  async getInsumosExamen(codigoExamen: number) {
    const insumos = await this.prisma.examenInsumo.findMany({
      where: { codigo_examen: codigoExamen },
      include: {
        item: {
          include: { categoria: true },
        },
      },
      orderBy: { item: { nombre: 'asc' } },
    });

    return insumos.map((i) => ({
      codigo_examen_insumo: i.codigo_examen_insumo,
      codigo_examen: i.codigo_examen,
      codigo_item: i.codigo_item,
      cantidad_requerida: Number(i.cantidad_requerida),
      activo: i.activo,
      item: {
        codigo_item: i.item.codigo_item,
        codigo_interno: i.item.codigo_interno,
        nombre: i.item.nombre,
        unidad_medida: i.item.unidad_medida,
        categoria: i.item.categoria?.nombre || 'Sin categoría',
        stock_actual: Number(i.item.stock_actual),
      },
    }));
  }

  /**
   * Agrega un insumo a un examen
   */
  async agregarInsumoExamen(
    codigoExamen: number,
    codigoItem: number,
    cantidadRequerida: number,
    adminId: number,
  ) {
    // Verificar que el examen existe
    const examen = await this.prisma.examen.findUnique({
      where: { codigo_examen: codigoExamen },
    });
    if (!examen) {
      throw new NotFoundException('Examen no encontrado');
    }

    // Verificar que el item existe
    const item = await this.prisma.item.findUnique({
      where: { codigo_item: codigoItem },
    });
    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    // Verificar si ya existe la relación
    const existente = await this.prisma.examenInsumo.findFirst({
      where: { codigo_examen: codigoExamen, codigo_item: codigoItem },
    });

    if (existente) {
      // Actualizar cantidad si ya existe
      return this.prisma.examenInsumo.update({
        where: { codigo_examen_insumo: existente.codigo_examen_insumo },
        data: { cantidad_requerida: cantidadRequerida, activo: true },
        include: { item: true },
      });
    }

    // Crear nueva relación
    const insumo = await this.prisma.examenInsumo.create({
      data: {
        codigo_examen: codigoExamen,
        codigo_item: codigoItem,
        cantidad_requerida: cantidadRequerida,
        activo: true,
      },
      include: { item: true },
    });

    this.logger.log(
      `Insumo ${item.codigo_interno} agregado al examen ${examen.codigo_interno} por usuario ${adminId}`,
    );

    return insumo;
  }

  /**
   * Quita un insumo de un examen (soft delete)
   */
  async quitarInsumoExamen(codigoExamen: number, codigoItem: number) {
    const insumo = await this.prisma.examenInsumo.findFirst({
      where: { codigo_examen: codigoExamen, codigo_item: codigoItem },
    });

    if (!insumo) {
      throw new NotFoundException('Relación examen-insumo no encontrada');
    }

    return this.prisma.examenInsumo.update({
      where: { codigo_examen_insumo: insumo.codigo_examen_insumo },
      data: { activo: false },
    });
  }

  /**
   * Actualiza la cantidad requerida de un insumo para un examen
   */
  async actualizarInsumoExamen(codigoExamen: number, codigoItem: number, cantidadRequerida: number) {
    const insumo = await this.prisma.examenInsumo.findFirst({
      where: { codigo_examen: codigoExamen, codigo_item: codigoItem, activo: true },
    });

    if (!insumo) {
      throw new NotFoundException('Relación examen-insumo no encontrada');
    }

    return this.prisma.examenInsumo.update({
      where: { codigo_examen_insumo: insumo.codigo_examen_insumo },
      data: { cantidad_requerida: cantidadRequerida },
    });
  }

  /**
   * Obtiene todos los exámenes con sus insumos configurados
   */
  async getExamenesConInsumos() {
    const examenes = await this.prisma.examen.findMany({
      where: { activo: true },
      include: {
        insumos: {
          where: { activo: true },
          include: {
            item: {
              select: {
                codigo_item: true,
                codigo_interno: true,
                nombre: true,
                unidad_medida: true,
              },
            },
          },
        },
        categoria: true,
      },
      orderBy: { nombre: 'asc' },
    });

    return examenes.map((e) => ({
      codigo_examen: e.codigo_examen,
      codigo_interno: e.codigo_interno,
      nombre: e.nombre,
      categoria: e.categoria?.nombre || 'Sin categoría',
      total_insumos: e.insumos.length,
      insumos: e.insumos.map((i) => ({
        codigo_item: i.codigo_item,
        codigo_interno: i.item.codigo_interno,
        nombre: i.item.nombre,
        cantidad_requerida: Number(i.cantidad_requerida),
        unidad_medida: i.item.unidad_medida,
      })),
    }));
  }

  // ==================== VALIDACIONES DE INTEGRIDAD ====================

  /**
   * Verifica si un proveedor puede ser eliminado
   * No se puede eliminar si tiene órdenes de compra asociadas
   */
  async puedeEliminarProveedor(codigoProveedor: number): Promise<{ puede: boolean; motivo?: string }> {
    const ordenesActivas = await this.prisma.ordenCompra.count({
      where: {
        codigo_proveedor: codigoProveedor,
        estado: { in: ['BORRADOR', 'EMITIDA'] },
      },
    });

    if (ordenesActivas > 0) {
      return {
        puede: false,
        motivo: `El proveedor tiene ${ordenesActivas} orden(es) de compra pendientes`,
      };
    }

    return { puede: true };
  }

  /**
   * Verifica si un item puede ser eliminado
   * No se puede eliminar si:
   * - Tiene stock > 0
   * - Tiene movimientos recientes
   * - Está configurado como insumo de algún examen
   */
  async puedeEliminarItem(codigoItem: number): Promise<{ puede: boolean; motivos: string[] }> {
    const motivos: string[] = [];

    const item = await this.prisma.item.findUnique({
      where: { codigo_item: codigoItem },
    });

    if (!item) {
      return { puede: false, motivos: ['Item no encontrado'] };
    }

    // Verificar stock
    if (Number(item.stock_actual) > 0) {
      motivos.push(`El item tiene ${item.stock_actual} unidades en stock`);
    }

    // Verificar órdenes de compra pendientes
    const ordenesPendientes = await this.prisma.ordenCompraDetalle.count({
      where: {
        codigo_item: codigoItem,
        orden_compra: {
          estado: { in: ['BORRADOR', 'EMITIDA'] },
        },
      },
    });

    if (ordenesPendientes > 0) {
      motivos.push(`El item está en ${ordenesPendientes} orden(es) de compra pendientes`);
    }

    // Verificar si es insumo de algún examen
    const insumosActivos = await this.prisma.examenInsumo.count({
      where: {
        codigo_item: codigoItem,
        activo: true,
      },
    });

    if (insumosActivos > 0) {
      motivos.push(`El item está configurado como insumo de ${insumosActivos} examen(es)`);
    }

    return {
      puede: motivos.length === 0,
      motivos,
    };
  }

  /**
   * Desactiva un item en lugar de eliminarlo (soft delete)
   */
  async desactivarItem(codigoItem: number, adminId: number) {
    const verificacion = await this.puedeEliminarItem(codigoItem);

    // Siempre permitir desactivar, pero advertir
    const item = await this.prisma.item.update({
      where: { codigo_item: codigoItem },
      data: { activo: false },
    });

    await this.registrarAuditoria(
      adminId,
      'DESACTIVAR_ITEM',
      'Item',
      codigoItem,
      { activo: true },
      { activo: false },
      `Item ${item.codigo_interno} desactivado${verificacion.motivos.length > 0 ? '. Advertencias: ' + verificacion.motivos.join(', ') : ''}`,
    );

    return {
      item,
      advertencias: verificacion.motivos,
    };
  }

  /**
   * Desactiva un proveedor en lugar de eliminarlo (soft delete)
   */
  async desactivarProveedor(codigoProveedor: number, adminId: number) {
    const verificacion = await this.puedeEliminarProveedor(codigoProveedor);

    if (!verificacion.puede) {
      throw new BadRequestException(verificacion.motivo);
    }

    const proveedor = await this.prisma.proveedor.update({
      where: { codigo_proveedor: codigoProveedor },
      data: { activo: false },
    });

    await this.registrarAuditoria(
      adminId,
      'DESACTIVAR_PROVEEDOR',
      'Proveedor',
      codigoProveedor,
      { activo: true },
      { activo: false },
      `Proveedor ${proveedor.razon_social} desactivado`,
    );

    return proveedor;
  }
}
