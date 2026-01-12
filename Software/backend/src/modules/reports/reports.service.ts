import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== REPORTE DE VENTAS/INGRESOS ====================

  async getVentasReport(fecha_desde?: string, fecha_hasta?: string) {
    const whereClause: Prisma.PagoWhereInput = {
      estado: { in: ['CONFIRMADO', 'PAGADO'] },
    };

    if (fecha_desde) {
      whereClause.fecha_pago = { ...whereClause.fecha_pago as any, gte: new Date(fecha_desde) };
    }
    if (fecha_hasta) {
      whereClause.fecha_pago = { ...whereClause.fecha_pago as any, lte: new Date(fecha_hasta + 'T23:59:59') };
    }

    // Pagos totales
    const pagos = await this.prisma.pago.findMany({
      where: whereClause,
      include: {
        paciente: { select: { nombres: true, apellidos: true } },
        detalles: { include: { examen: { select: { nombre: true } } } },
      },
      orderBy: { fecha_pago: 'desc' },
    });

    // Totales por método de pago
    const porMetodo = await this.prisma.pago.groupBy({
      by: ['metodo_pago'],
      where: whereClause,
      _sum: { monto_total: true },
      _count: { codigo_pago: true },
    });

    // Totales por día (últimos 30 días)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const porDia = await this.prisma.$queryRaw<Array<{ fecha: Date; total: number; cantidad: number }>>`
      SELECT
        DATE(fecha_pago) as fecha,
        SUM(monto_total) as total,
        COUNT(*) as cantidad
      FROM pagos.pago
      WHERE estado IN ('CONFIRMADO', 'PAGADO')
        AND fecha_pago >= ${hace30Dias}
      GROUP BY DATE(fecha_pago)
      ORDER BY fecha DESC
    `;

    const totalGeneral = pagos.reduce((sum, p) => sum + Number(p.monto_total), 0);

    return {
      resumen: {
        total_ingresos: totalGeneral,
        cantidad_pagos: pagos.length,
        promedio_pago: pagos.length > 0 ? totalGeneral / pagos.length : 0,
      },
      por_metodo: porMetodo.map(m => ({
        metodo: m.metodo_pago,
        total: Number(m._sum.monto_total || 0),
        cantidad: m._count.codigo_pago,
      })),
      por_dia: porDia.map(d => ({
        fecha: d.fecha,
        total: Number(d.total),
        cantidad: Number(d.cantidad),
      })),
      ultimos_pagos: pagos.slice(0, 20),
    };
  }

  // ==================== REPORTE DE EXAMENES POPULARES ====================

  async getExamenesPopularesReport(fecha_desde?: string, fecha_hasta?: string) {
    const whereClause: Prisma.PagoDetalleWhereInput = {};

    if (fecha_desde || fecha_hasta) {
      whereClause.pago = {
        estado: { in: ['CONFIRMADO', 'PAGADO'] },
        fecha_pago: {
          ...(fecha_desde && { gte: new Date(fecha_desde) }),
          ...(fecha_hasta && { lte: new Date(fecha_hasta + 'T23:59:59') }),
        },
      };
    } else {
      whereClause.pago = { estado: { in: ['CONFIRMADO', 'PAGADO'] } };
    }

    // Agrupar por examen
    const examenesSolicitados = await this.prisma.pagoDetalle.groupBy({
      by: ['codigo_examen'],
      where: whereClause,
      _sum: { cantidad: true, total_linea: true },
      _count: { codigo_detalle: true },
    });

    // Obtener nombres de exámenes
    const examenes = await this.prisma.examen.findMany({
      where: { codigo_examen: { in: examenesSolicitados.map(e => e.codigo_examen) } },
      select: { codigo_examen: true, nombre: true, codigo_interno: true },
    });

    const examenesMap = new Map(examenes.map(e => [e.codigo_examen, e]));

    const ranking = examenesSolicitados
      .map(e => ({
        codigo_examen: e.codigo_examen,
        nombre: examenesMap.get(e.codigo_examen)?.nombre || 'Desconocido',
        codigo_interno: examenesMap.get(e.codigo_examen)?.codigo_interno || '',
        cantidad_solicitada: e._sum.cantidad || 0,
        ingresos_generados: Number(e._sum.total_linea || 0),
        veces_incluido: e._count.codigo_detalle,
      }))
      .sort((a, b) => b.cantidad_solicitada - a.cantidad_solicitada);

    return {
      total_examenes_diferentes: ranking.length,
      total_examenes_realizados: ranking.reduce((sum, e) => sum + e.cantidad_solicitada, 0),
      ingresos_totales: ranking.reduce((sum, e) => sum + e.ingresos_generados, 0),
      ranking_top_10: ranking.slice(0, 10),
      ranking_completo: ranking,
    };
  }

  // ==================== REPORTE DE CITAS ====================

  async getCitasReport(fecha_desde?: string, fecha_hasta?: string) {
    const whereClause: Prisma.CitaWhereInput = {};

    if (fecha_desde || fecha_hasta) {
      whereClause.slot = {
        fecha: {
          ...(fecha_desde && { gte: new Date(fecha_desde) }),
          ...(fecha_hasta && { lte: new Date(fecha_hasta) }),
        },
      };
    }

    // Por estado
    const porEstado = await this.prisma.cita.groupBy({
      by: ['estado'],
      where: whereClause,
      _count: { codigo_cita: true },
    });

    // Por servicio
    const porServicio = await this.prisma.$queryRaw<Array<{ nombre: string; cantidad: number }>>`
      SELECT s.nombre, COUNT(*) as cantidad
      FROM agenda.cita c
      JOIN agenda.slot sl ON c.codigo_slot = sl.codigo_slot
      JOIN agenda.servicio s ON sl.codigo_servicio = s.codigo_servicio
      ${fecha_desde ? Prisma.sql`WHERE sl.fecha >= ${new Date(fecha_desde)}` : Prisma.empty}
      ${fecha_hasta ? Prisma.sql`AND sl.fecha <= ${new Date(fecha_hasta)}` : Prisma.empty}
      GROUP BY s.nombre
      ORDER BY cantidad DESC
    `;

    // Por sede
    const porSede = await this.prisma.$queryRaw<Array<{ nombre: string; cantidad: number }>>`
      SELECT se.nombre, COUNT(*) as cantidad
      FROM agenda.cita c
      JOIN agenda.slot sl ON c.codigo_slot = sl.codigo_slot
      JOIN agenda.sede se ON sl.codigo_sede = se.codigo_sede
      ${fecha_desde ? Prisma.sql`WHERE sl.fecha >= ${new Date(fecha_desde)}` : Prisma.empty}
      ${fecha_hasta ? Prisma.sql`AND sl.fecha <= ${new Date(fecha_hasta)}` : Prisma.empty}
      GROUP BY se.nombre
      ORDER BY cantidad DESC
    `;

    const totalCitas = porEstado.reduce((sum, e) => sum + e._count.codigo_cita, 0);
    const citasCompletadas = porEstado.find(e => e.estado === 'COMPLETADA')?._count.codigo_cita || 0;
    const citasCanceladas = porEstado.find(e => e.estado === 'CANCELADA')?._count.codigo_cita || 0;

    return {
      resumen: {
        total_citas: totalCitas,
        completadas: citasCompletadas,
        canceladas: citasCanceladas,
        tasa_cumplimiento: totalCitas > 0 ? ((citasCompletadas / totalCitas) * 100).toFixed(1) + '%' : '0%',
        tasa_cancelacion: totalCitas > 0 ? ((citasCanceladas / totalCitas) * 100).toFixed(1) + '%' : '0%',
      },
      por_estado: porEstado.map(e => ({ estado: e.estado, cantidad: e._count.codigo_cita })),
      por_servicio: porServicio.map(s => ({ servicio: s.nombre, cantidad: Number(s.cantidad) })),
      por_sede: porSede.map(s => ({ sede: s.nombre, cantidad: Number(s.cantidad) })),
    };
  }

  // ==================== REPORTE DE COTIZACIONES (CONVERSION) ====================

  async getCotizacionesReport(fecha_desde?: string, fecha_hasta?: string) {
    const whereClause: Prisma.CotizacionWhereInput = {};

    if (fecha_desde) {
      whereClause.fecha_cotizacion = { ...whereClause.fecha_cotizacion as any, gte: new Date(fecha_desde) };
    }
    if (fecha_hasta) {
      whereClause.fecha_cotizacion = { ...whereClause.fecha_cotizacion as any, lte: new Date(fecha_hasta + 'T23:59:59') };
    }

    // Por estado
    const porEstado = await this.prisma.cotizacion.groupBy({
      by: ['estado'],
      where: whereClause,
      _count: { codigo_cotizacion: true },
      _sum: { total: true },
    });

    const totalCotizaciones = porEstado.reduce((sum, e) => sum + e._count.codigo_cotizacion, 0);
    const pagadas = porEstado.find(e => e.estado === 'PAGADA');
    const pendientes = porEstado.find(e => e.estado === 'PENDIENTE');
    const expiradas = porEstado.find(e => e.estado === 'EXPIRADA');

    const valorTotalCotizado = porEstado.reduce((sum, e) => sum + Number(e._sum.total || 0), 0);
    const valorPagado = Number(pagadas?._sum.total || 0);

    return {
      resumen: {
        total_cotizaciones: totalCotizaciones,
        cotizaciones_pagadas: pagadas?._count.codigo_cotizacion || 0,
        cotizaciones_pendientes: pendientes?._count.codigo_cotizacion || 0,
        cotizaciones_expiradas: expiradas?._count.codigo_cotizacion || 0,
        tasa_conversion: totalCotizaciones > 0
          ? (((pagadas?._count.codigo_cotizacion || 0) / totalCotizaciones) * 100).toFixed(1) + '%'
          : '0%',
        valor_total_cotizado: valorTotalCotizado,
        valor_convertido: valorPagado,
        valor_perdido: valorTotalCotizado - valorPagado,
      },
      por_estado: porEstado.map(e => ({
        estado: e.estado,
        cantidad: e._count.codigo_cotizacion,
        valor_total: Number(e._sum.total || 0),
      })),
    };
  }

  // ==================== REPORTE KARDEX INVENTARIO ====================

  async getKardexCompleto(fecha_desde?: string, fecha_hasta?: string) {
    const whereClause: Prisma.MovimientoWhereInput = {};

    if (fecha_desde) {
      whereClause.fecha_movimiento = { ...whereClause.fecha_movimiento as any, gte: new Date(fecha_desde) };
    }
    if (fecha_hasta) {
      whereClause.fecha_movimiento = { ...whereClause.fecha_movimiento as any, lte: new Date(fecha_hasta + 'T23:59:59') };
    }

    // Items con stock bajo
    const itemsStockBajo = await this.prisma.item.findMany({
      where: {
        activo: true,
        stock_actual: { lte: this.prisma.item.fields.stock_minimo },
      },
      select: {
        codigo_item: true,
        codigo_interno: true,
        nombre: true,
        stock_actual: true,
        stock_minimo: true,
        unidad_medida: true,
      },
    });

    // Resumen de movimientos
    const movimientos = await this.prisma.movimiento.findMany({
      where: whereClause,
      include: {
        item: { select: { nombre: true, codigo_interno: true } },
        usuario: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { fecha_movimiento: 'desc' },
      take: 100,
    });

    // Totales por tipo
    const porTipo = await this.prisma.movimiento.groupBy({
      by: ['tipo_movimiento'],
      where: whereClause,
      _sum: { cantidad: true },
      _count: { codigo_movimiento: true },
    });

    // Items más movidos
    const itemsMasMovidos = await this.prisma.movimiento.groupBy({
      by: ['codigo_item'],
      where: whereClause,
      _count: { codigo_movimiento: true },
      _sum: { cantidad: true },
    });

    const itemsInfo = await this.prisma.item.findMany({
      where: { codigo_item: { in: itemsMasMovidos.map(i => i.codigo_item) } },
      select: { codigo_item: true, nombre: true, codigo_interno: true },
    });

    const itemsMap = new Map(itemsInfo.map(i => [i.codigo_item, i]));

    return {
      alertas: {
        items_stock_bajo: itemsStockBajo.length,
        items_criticos: itemsStockBajo,
      },
      resumen_movimientos: {
        por_tipo: porTipo.map(t => ({
          tipo: t.tipo_movimiento,
          cantidad_movimientos: t._count.codigo_movimiento,
          unidades_totales: t._sum.cantidad || 0,
        })),
        items_mas_movidos: itemsMasMovidos
          .map(i => ({
            codigo_item: i.codigo_item,
            nombre: itemsMap.get(i.codigo_item)?.nombre || '',
            codigo_interno: itemsMap.get(i.codigo_item)?.codigo_interno || '',
            cantidad_movimientos: i._count.codigo_movimiento,
            unidades_movidas: i._sum.cantidad || 0,
          }))
          .sort((a, b) => b.cantidad_movimientos - a.cantidad_movimientos)
          .slice(0, 10),
      },
      ultimos_movimientos: movimientos.slice(0, 50),
    };
  }

  // ==================== REPORTE DE PACIENTES ====================

  async getPacientesReport(fecha_desde?: string, fecha_hasta?: string) {
    const rolPaciente = await this.prisma.rol.findFirst({
      where: { nombre: { contains: 'Paciente', mode: 'insensitive' } },
    });

    if (!rolPaciente) {
      return { error: 'Rol de paciente no encontrado' };
    }

    const whereClause: Prisma.UsuarioWhereInput = {
      codigo_rol: rolPaciente.codigo_rol,
    };

    if (fecha_desde) {
      whereClause.fecha_creacion = { ...whereClause.fecha_creacion as any, gte: new Date(fecha_desde) };
    }
    if (fecha_hasta) {
      whereClause.fecha_creacion = { ...whereClause.fecha_creacion as any, lte: new Date(fecha_hasta + 'T23:59:59') };
    }

    // Total pacientes
    const totalPacientes = await this.prisma.usuario.count({
      where: { codigo_rol: rolPaciente.codigo_rol },
    });

    // Nuevos en período
    const nuevosPacientes = await this.prisma.usuario.count({ where: whereClause });

    // Pacientes activos (con citas en últimos 90 días)
    const hace90Dias = new Date();
    hace90Dias.setDate(hace90Dias.getDate() - 90);

    const pacientesActivos = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT c.codigo_paciente) as count
      FROM agenda.cita c
      JOIN agenda.slot s ON c.codigo_slot = s.codigo_slot
      WHERE s.fecha >= ${hace90Dias}
    `;

    // Por género
    const porGenero = await this.prisma.usuario.groupBy({
      by: ['genero'],
      where: { codigo_rol: rolPaciente.codigo_rol },
      _count: { codigo_usuario: true },
    });

    return {
      resumen: {
        total_pacientes: totalPacientes,
        nuevos_en_periodo: nuevosPacientes,
        pacientes_activos_90_dias: Number(pacientesActivos[0]?.count || 0),
      },
      por_genero: porGenero.map(g => ({
        genero: g.genero || 'No especificado',
        cantidad: g._count.codigo_usuario,
      })),
    };
  }

  // ==================== DASHBOARD GENERAL ====================

  async getDashboardGeneral() {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

    // Ingresos este mes
    const ingresosEsteMes = await this.prisma.pago.aggregate({
      where: {
        estado: { in: ['CONFIRMADO', 'PAGADO'] },
        fecha_pago: { gte: inicioMes },
      },
      _sum: { monto_total: true },
      _count: { codigo_pago: true },
    });

    // Ingresos mes anterior
    const ingresosMesAnterior = await this.prisma.pago.aggregate({
      where: {
        estado: { in: ['CONFIRMADO', 'PAGADO'] },
        fecha_pago: { gte: inicioMesAnterior, lte: finMesAnterior },
      },
      _sum: { monto_total: true },
    });

    // Citas hoy
    const citasHoy = await this.prisma.cita.count({
      where: {
        slot: {
          fecha: {
            gte: new Date(hoy.toISOString().split('T')[0]),
            lt: new Date(new Date(hoy).setDate(hoy.getDate() + 1)),
          },
        },
      },
    });

    // Items con stock bajo
    const itemsStockBajo = await this.prisma.item.count({
      where: {
        activo: true,
        stock_actual: { lte: this.prisma.item.fields.stock_minimo },
      },
    });

    // Cotizaciones pendientes
    const cotizacionesPendientes = await this.prisma.cotizacion.count({
      where: { estado: 'PENDIENTE' },
    });

    const ingresoActual = Number(ingresosEsteMes._sum.monto_total || 0);
    const ingresoAnterior = Number(ingresosMesAnterior._sum.monto_total || 0);
    const variacion = ingresoAnterior > 0
      ? (((ingresoActual - ingresoAnterior) / ingresoAnterior) * 100).toFixed(1)
      : '0';

    return {
      ingresos_mes_actual: ingresoActual,
      ingresos_mes_anterior: ingresoAnterior,
      variacion_ingresos: `${Number(variacion) >= 0 ? '+' : ''}${variacion}%`,
      pagos_este_mes: ingresosEsteMes._count.codigo_pago,
      citas_hoy: citasHoy,
      items_stock_bajo: itemsStockBajo,
      cotizaciones_pendientes: cotizacionesPendientes,
    };
  }

  // ==================== REPORTE DE RESULTADOS ====================

  async getResultadosReport(fecha_desde?: string, fecha_hasta?: string) {
    const whereClause: Prisma.ResultadoWhereInput = {};

    if (fecha_desde) {
      whereClause.fecha_resultado = { ...whereClause.fecha_resultado as any, gte: new Date(fecha_desde) };
    }
    if (fecha_hasta) {
      whereClause.fecha_resultado = { ...whereClause.fecha_resultado as any, lte: new Date(fecha_hasta + 'T23:59:59') };
    }

    // Conteo por estado
    const porEstado = await this.prisma.resultado.groupBy({
      by: ['estado'],
      where: whereClause,
      _count: { codigo_resultado: true },
    });

    // Total de resultados
    const totalResultados = porEstado.reduce((sum, e) => sum + e._count.codigo_resultado, 0);

    // Resultados validados
    const validados = porEstado.find(e => e.estado === 'VALIDADO')?._count.codigo_resultado || 0;
    const enProceso = porEstado.find(e => e.estado === 'EN_PROCESO')?._count.codigo_resultado || 0;
    const pendientes = porEstado.find(e => e.estado === 'PENDIENTE')?._count.codigo_resultado || 0;

    // Descargas de resultados
    const whereDescarga: Prisma.DescargaResultadoWhereInput = {};
    if (fecha_desde) {
      whereDescarga.fecha_descarga = { ...whereDescarga.fecha_descarga as any, gte: new Date(fecha_desde) };
    }
    if (fecha_hasta) {
      whereDescarga.fecha_descarga = { ...whereDescarga.fecha_descarga as any, lte: new Date(fecha_hasta + 'T23:59:59') };
    }

    const totalDescargas = await this.prisma.descargaResultado.count({ where: whereDescarga });

    // Descargas por día (últimos 30 días)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const descargasPorDia = await this.prisma.$queryRaw<Array<{ fecha: Date; cantidad: number }>>`
      SELECT DATE(fecha_descarga) as fecha, COUNT(*) as cantidad
      FROM resultados.descarga_resultado
      WHERE fecha_descarga >= ${hace30Dias}
      GROUP BY DATE(fecha_descarga)
      ORDER BY fecha DESC
    `;

    // Top exámenes con más resultados
    const topExamenes = await this.prisma.resultado.groupBy({
      by: ['codigo_examen'],
      where: whereClause,
      _count: { codigo_resultado: true },
      orderBy: { _count: { codigo_resultado: 'desc' } },
      take: 10,
    });

    // Obtener nombres de exámenes
    const examenIds = topExamenes.map(e => e.codigo_examen);
    const examenes = await this.prisma.examen.findMany({
      where: { codigo_examen: { in: examenIds } },
      select: { codigo_examen: true, nombre: true, codigo_interno: true },
    });

    const examenesMap = new Map(examenes.map(e => [e.codigo_examen, e]));

    // Resultados fuera de rango
    const fueraDeRango = await this.prisma.resultado.count({
      where: {
        ...whereClause,
        dentro_rango_normal: false,
      },
    });

    // Tiempo promedio de procesamiento (desde muestra hasta validación)
    const tiemposProcesamiento = await this.prisma.$queryRaw<[{ promedio_horas: number }]>`
      SELECT AVG(EXTRACT(EPOCH FROM (r.fecha_validacion - m.fecha_toma)) / 3600) as promedio_horas
      FROM resultados.resultado r
      JOIN resultados.muestra m ON r.codigo_muestra = m.codigo_muestra
      WHERE r.estado = 'VALIDADO'
        AND r.fecha_validacion IS NOT NULL
        ${fecha_desde ? Prisma.sql`AND r.fecha_resultado >= ${new Date(fecha_desde)}` : Prisma.empty}
        ${fecha_hasta ? Prisma.sql`AND r.fecha_resultado <= ${new Date(fecha_hasta + 'T23:59:59')}` : Prisma.empty}
    `;

    // Resultados por bioquímico (validador)
    const porBioquimico = await this.prisma.resultado.groupBy({
      by: ['validado_por'],
      where: {
        ...whereClause,
        validado_por: { not: null },
      },
      _count: { codigo_resultado: true },
    });

    const validadorIds = porBioquimico.map(b => b.validado_por!).filter(Boolean);
    const validadores = await this.prisma.usuario.findMany({
      where: { codigo_usuario: { in: validadorIds } },
      select: { codigo_usuario: true, nombres: true, apellidos: true },
    });
    const validadoresMap = new Map(validadores.map(v => [v.codigo_usuario, v]));

    return {
      resumen: {
        total_resultados: totalResultados,
        validados,
        en_proceso: enProceso,
        pendientes,
        fuera_de_rango: fueraDeRango,
        total_descargas_pdf: totalDescargas,
        tiempo_promedio_horas: Number(tiemposProcesamiento[0]?.promedio_horas || 0).toFixed(1),
      },
      por_estado: porEstado.map(e => ({
        estado: e.estado,
        cantidad: e._count.codigo_resultado,
        porcentaje: totalResultados > 0
          ? ((e._count.codigo_resultado / totalResultados) * 100).toFixed(1) + '%'
          : '0%',
      })),
      top_examenes: topExamenes.map(e => {
        const examen = examenesMap.get(e.codigo_examen);
        return {
          codigo_examen: e.codigo_examen,
          nombre: examen?.nombre || 'Desconocido',
          codigo_interno: examen?.codigo_interno || '',
          cantidad: e._count.codigo_resultado,
        };
      }),
      descargas_por_dia: descargasPorDia.map(d => ({
        fecha: d.fecha,
        cantidad: Number(d.cantidad),
      })),
      por_bioquimico: porBioquimico.map(b => {
        const validador = validadoresMap.get(b.validado_por!);
        return {
          codigo_usuario: b.validado_por,
          nombre: validador ? `${validador.nombres} ${validador.apellidos}` : 'Sistema',
          cantidad_validados: b._count.codigo_resultado,
        };
      }).sort((a, b) => b.cantidad_validados - a.cantidad_validados),
    };
  }
}
