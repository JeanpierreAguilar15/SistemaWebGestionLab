import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { WhatsAppService } from '../../comunicaciones/whatsapp.service';

export interface AbrirLoteDto {
  codigo_lote: number;
}

export interface RegistrarPruebasDto {
  codigo_lote: number;
  cantidad_pruebas: number;
  observacion?: string;
}

export interface DescartarLoteDto {
  codigo_lote: number;
  motivo: 'VENCIDO_APERTURA' | 'VENCIDO_LOTE' | 'AGOTADO' | 'DANADO' | 'MANUAL';
  observacion?: string;
}

export interface LoteAbierto {
  codigo_lote: number;
  numero_lote: string;
  item_nombre: string;
  codigo_item: number;
  fecha_apertura: Date;
  fecha_vencimiento_abierto: Date;
  dias_restantes: number;
  horas_restantes: number;
  pruebas_realizadas: number;
  capacidad_pruebas: number;
  pruebas_restantes: number;
  porcentaje_uso: number;
  frascos_restantes: number;
  frascos_totales: number;
  estado: string;
}

@Injectable()
export class ReactivosService {
  private readonly logger = new Logger(ReactivosService.name);

  constructor(
    private prisma: PrismaService,
    private whatsAppService: WhatsAppService,
  ) {}

  /**
   * Abre un frasco de un lote de reactivo - inicia el contador de vida util
   *
   * Validaciones:
   * - Lote debe existir
   * - Lote debe estar CERRADO (no abierto, agotado o descartado)
   * - Item debe ser reactivo
   * - Lote no debe estar vencido
   * - No debe haber otro lote ABIERTO del mismo item
   * - Lote debe tener frascos disponibles (cantidad_actual > 0)
   */
  async abrirLote(dto: AbrirLoteDto, usuarioId?: number): Promise<any> {
    const lote = await this.prisma.lote.findUnique({
      where: { codigo_lote: dto.codigo_lote },
      include: { item: true },
    });

    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    // Validar estado del lote
    if (lote.estado_lote === 'ABIERTO') {
      throw new BadRequestException('El lote ya tiene un frasco abierto. Debe descartarlo o agotarlo primero.');
    }

    if (lote.estado_lote === 'DESCARTADO') {
      throw new BadRequestException('El lote fue descartado y no puede abrirse.');
    }

    if (lote.estado_lote === 'AGOTADO') {
      throw new BadRequestException('El lote esta agotado. Ya no tiene frascos disponibles.');
    }

    // Validar frascos disponibles
    if (lote.cantidad_actual <= 0) {
      throw new BadRequestException('El lote no tiene frascos disponibles.');
    }

    // Validar que el item sea reactivo
    if (!lote.item.es_reactivo) {
      throw new BadRequestException('Este item no esta configurado como reactivo. Configure es_reactivo=true en el item.');
    }

    // Validar que el lote no este vencido
    if (lote.fecha_vencimiento && new Date() > lote.fecha_vencimiento) {
      throw new BadRequestException(`El lote esta vencido desde ${lote.fecha_vencimiento.toLocaleDateString('es-EC')}. No puede abrirse.`);
    }

    // Validar que no haya otro lote ABIERTO del mismo item
    const loteAbiertoMismoItem = await this.prisma.lote.findFirst({
      where: {
        codigo_item: lote.codigo_item,
        estado_lote: 'ABIERTO',
        codigo_lote: { not: dto.codigo_lote },
      },
      include: { item: true },
    });

    if (loteAbiertoMismoItem) {
      throw new BadRequestException(
        `Ya existe un lote abierto de "${lote.item.nombre}" (Lote: ${loteAbiertoMismoItem.numero_lote}). ` +
        `Debe descartar o agotar ese lote antes de abrir otro.`
      );
    }

    const ahora = new Date();
    let fechaVencimientoAbierto: Date | null = null;

    // Calcular fecha de vencimiento por apertura del frasco
    if (lote.item.vida_util_dias_abierto) {
      fechaVencimientoAbierto = new Date(ahora);
      fechaVencimientoAbierto.setDate(fechaVencimientoAbierto.getDate() + lote.item.vida_util_dias_abierto);

      // Si el vencimiento por apertura es despues del vencimiento del lote, usar el del lote
      if (lote.fecha_vencimiento && fechaVencimientoAbierto > lote.fecha_vencimiento) {
        fechaVencimientoAbierto = lote.fecha_vencimiento;
      }
    }

    const loteActualizado = await this.prisma.lote.update({
      where: { codigo_lote: dto.codigo_lote },
      data: {
        estado_lote: 'ABIERTO',
        fecha_apertura: ahora,
        fecha_vencimiento_abierto: fechaVencimientoAbierto,
        pruebas_realizadas: 0, // Reset contador de pruebas para el nuevo frasco
      },
      include: { item: true },
    });

    // Registrar movimiento de apertura
    await this.prisma.movimiento.create({
      data: {
        codigo_item: lote.codigo_item,
        codigo_lote: dto.codigo_lote,
        tipo_movimiento: 'APERTURA_REACTIVO',
        cantidad: 0,
        motivo: `Apertura de frasco. Lote: ${lote.numero_lote}. Frascos restantes: ${lote.cantidad_actual}. Vence: ${fechaVencimientoAbierto?.toLocaleDateString('es-EC') || 'N/A'}`,
        stock_anterior: lote.item.stock_actual,
        stock_nuevo: lote.item.stock_actual,
        realizado_por: usuarioId,
      },
    });

    this.logger.log(
      `Frasco abierto del lote ${lote.numero_lote}. ` +
      `Frascos disponibles: ${lote.cantidad_actual}. ` +
      `Vida util: ${lote.item.vida_util_dias_abierto || 'ilimitada'} dias`
    );

    return {
      success: true,
      lote: loteActualizado,
      mensaje: `Frasco abierto exitosamente. ${lote.item.vida_util_dias_abierto ? `Tiene ${lote.item.vida_util_dias_abierto} dias de vida util.` : 'Sin limite de tiempo.'}`,
      fecha_vencimiento_abierto: fechaVencimientoAbierto,
      frascos_restantes: lote.cantidad_actual,
      capacidad_pruebas: lote.item.capacidad_pruebas || 0,
    };
  }

  /**
   * Registra pruebas realizadas con el frasco abierto
   *
   * Validaciones:
   * - Lote debe estar ABIERTO
   * - Frasco no debe estar vencido por apertura
   * - Cantidad de pruebas debe ser positiva
   * - No debe exceder capacidad restante del frasco
   *
   * Si el frasco se agota (pruebas = capacidad):
   * - Resta 1 de cantidad_actual (1 frasco usado)
   * - Resta 1 del stock_actual del item
   * - Si quedan mas frascos, vuelve a CERRADO
   * - Si no quedan frascos, pasa a AGOTADO
   */
  async registrarPruebas(dto: RegistrarPruebasDto, usuarioId?: number): Promise<any> {
    if (dto.cantidad_pruebas <= 0) {
      throw new BadRequestException('La cantidad de pruebas debe ser mayor a 0');
    }

    const lote = await this.prisma.lote.findUnique({
      where: { codigo_lote: dto.codigo_lote },
      include: { item: true },
    });

    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    if (lote.estado_lote !== 'ABIERTO') {
      throw new BadRequestException(`El lote no tiene un frasco abierto (estado: ${lote.estado_lote}). Debe abrir un frasco primero.`);
    }

    // Verificar si el frasco ya vencio por apertura
    if (lote.fecha_vencimiento_abierto && new Date() > lote.fecha_vencimiento_abierto) {
      throw new BadRequestException(
        `El frasco abierto ya vencio el ${lote.fecha_vencimiento_abierto.toLocaleDateString('es-EC')}. ` +
        `Debe descartarlo antes de continuar.`
      );
    }

    const capacidadPorFrasco = lote.item.capacidad_pruebas || 999999;
    const pruebasActuales = lote.pruebas_realizadas;
    const nuevasPruebas = pruebasActuales + dto.cantidad_pruebas;

    if (nuevasPruebas > capacidadPorFrasco) {
      const restantes = capacidadPorFrasco - pruebasActuales;
      throw new BadRequestException(
        `Excede la capacidad del frasco. Pruebas restantes en este frasco: ${restantes}. ` +
        `Solicitadas: ${dto.cantidad_pruebas}`
      );
    }

    let nuevoEstado = 'ABIERTO';
    let nuevaCantidadActual = lote.cantidad_actual;
    let nuevoStockItem = lote.item.stock_actual;
    let frascoAgotado = false;

    // Si el frasco se agota
    if (nuevasPruebas >= capacidadPorFrasco) {
      frascoAgotado = true;
      nuevaCantidadActual -= 1; // Restar 1 frasco del lote
      nuevoStockItem -= 1; // Restar 1 del stock del item

      if (nuevaCantidadActual <= 0) {
        nuevoEstado = 'AGOTADO'; // Lote completamente agotado
      } else {
        nuevoEstado = 'CERRADO'; // Aun quedan frascos, listo para abrir otro
      }
    }

    // Actualizar lote
    const loteActualizado = await this.prisma.lote.update({
      where: { codigo_lote: dto.codigo_lote },
      data: {
        pruebas_realizadas: frascoAgotado ? 0 : nuevasPruebas, // Reset si se agoto el frasco
        estado_lote: nuevoEstado,
        cantidad_actual: nuevaCantidadActual,
        motivo_descarte: nuevoEstado === 'AGOTADO' ? 'AGOTADO' : null,
        fecha_descarte: nuevoEstado === 'AGOTADO' ? new Date() : null,
        // Limpiar fecha apertura si el frasco se agoto
        fecha_apertura: frascoAgotado ? null : lote.fecha_apertura,
        fecha_vencimiento_abierto: frascoAgotado ? null : lote.fecha_vencimiento_abierto,
      },
      include: { item: true },
    });

    // Actualizar stock del item si el frasco se agoto
    if (frascoAgotado) {
      await this.prisma.item.update({
        where: { codigo_item: lote.codigo_item },
        data: { stock_actual: nuevoStockItem },
      });
    }

    // Registrar movimiento
    await this.prisma.movimiento.create({
      data: {
        codigo_item: lote.codigo_item,
        codigo_lote: dto.codigo_lote,
        tipo_movimiento: frascoAgotado ? 'CONSUMO_FRASCO' : 'USO_REACTIVO',
        cantidad: frascoAgotado ? 1 : 0,
        motivo: frascoAgotado
          ? `Frasco agotado (${nuevasPruebas}/${capacidadPorFrasco} pruebas). ${dto.observacion || ''}. Frascos restantes: ${nuevaCantidadActual}`
          : `${dto.cantidad_pruebas} prueba(s) registrada(s). Total: ${nuevasPruebas}/${capacidadPorFrasco}. ${dto.observacion || ''}`,
        stock_anterior: lote.item.stock_actual,
        stock_nuevo: nuevoStockItem,
        realizado_por: usuarioId,
      },
    });

    const respuesta: any = {
      success: true,
      lote: loteActualizado,
      pruebas_registradas: dto.cantidad_pruebas,
      estado: nuevoEstado,
    };

    if (frascoAgotado) {
      respuesta.mensaje = nuevaCantidadActual > 0
        ? `Frasco agotado. Quedan ${nuevaCantidadActual} frascos en el lote. Puede abrir otro frasco.`
        : `Lote completamente agotado. No quedan mas frascos disponibles.`;
      respuesta.frasco_agotado = true;
      respuesta.frascos_restantes = nuevaCantidadActual;
    } else {
      respuesta.pruebas_realizadas = nuevasPruebas;
      respuesta.pruebas_restantes = capacidadPorFrasco - nuevasPruebas;
      respuesta.mensaje = `${dto.cantidad_pruebas} prueba(s) registrada(s). Restantes: ${capacidadPorFrasco - nuevasPruebas}`;
    }

    return respuesta;
  }

  /**
   * Descarta el frasco abierto actual (por vencimiento, dano, etc)
   *
   * Acciones:
   * - Resta 1 de cantidad_actual del lote (1 frasco)
   * - Resta 1 del stock_actual del item
   * - Reset pruebas_realizadas
   * - Si quedan frascos: estado = CERRADO
   * - Si no quedan: estado = AGOTADO
   */
  async descartarLote(dto: DescartarLoteDto, usuarioId?: number): Promise<any> {
    const lote = await this.prisma.lote.findUnique({
      where: { codigo_lote: dto.codigo_lote },
      include: { item: true },
    });

    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    if (lote.estado_lote === 'DESCARTADO') {
      throw new BadRequestException('El lote ya fue descartado completamente.');
    }

    if (lote.estado_lote === 'AGOTADO') {
      throw new BadRequestException('El lote ya esta agotado. No hay frascos para descartar.');
    }

    if (lote.estado_lote !== 'ABIERTO') {
      throw new BadRequestException('No hay un frasco abierto para descartar. El lote esta cerrado.');
    }

    const capacidadFrasco = lote.item.capacidad_pruebas || 0;
    const pruebasRealizadas = lote.pruebas_realizadas;
    const pruebasDesperdiciadas = capacidadFrasco - pruebasRealizadas;

    // Restar 1 frasco
    const nuevaCantidadActual = lote.cantidad_actual - 1;
    const nuevoStockItem = lote.item.stock_actual - 1;

    let nuevoEstado: string;
    if (nuevaCantidadActual <= 0) {
      nuevoEstado = 'AGOTADO';
    } else {
      nuevoEstado = 'CERRADO'; // Listo para abrir otro frasco
    }

    const loteActualizado = await this.prisma.lote.update({
      where: { codigo_lote: dto.codigo_lote },
      data: {
        estado_lote: nuevoEstado,
        motivo_descarte: dto.motivo,
        fecha_descarte: new Date(),
        cantidad_actual: nuevaCantidadActual,
        pruebas_realizadas: 0, // Reset para el proximo frasco
        fecha_apertura: null, // Limpiar fecha apertura
        fecha_vencimiento_abierto: null, // Limpiar vencimiento de apertura
      },
      include: { item: true },
    });

    // Actualizar stock del item
    await this.prisma.item.update({
      where: { codigo_item: lote.codigo_item },
      data: { stock_actual: nuevoStockItem },
    });

    // Registrar movimiento de descarte
    await this.prisma.movimiento.create({
      data: {
        codigo_item: lote.codigo_item,
        codigo_lote: dto.codigo_lote,
        tipo_movimiento: 'DESCARTE_FRASCO',
        cantidad: 1,
        motivo: `Descarte de frasco. Motivo: ${dto.motivo}. Usado: ${pruebasRealizadas}/${capacidadFrasco} pruebas. Desperdicio: ${pruebasDesperdiciadas}. ${dto.observacion || ''}`,
        stock_anterior: lote.item.stock_actual,
        stock_nuevo: nuevoStockItem,
        realizado_por: usuarioId,
      },
    });

    this.logger.warn(
      `Frasco descartado del lote ${lote.numero_lote}. ` +
      `Motivo: ${dto.motivo}. ` +
      `Usado: ${pruebasRealizadas}/${capacidadFrasco}. ` +
      `Desperdicio: ${pruebasDesperdiciadas}. ` +
      `Frascos restantes: ${nuevaCantidadActual}`
    );

    return {
      success: true,
      lote: loteActualizado,
      pruebas_usadas: pruebasRealizadas,
      pruebas_desperdiciadas: pruebasDesperdiciadas,
      frascos_restantes: nuevaCantidadActual,
      estado: nuevoEstado,
      mensaje: nuevaCantidadActual > 0
        ? `Frasco descartado. ${pruebasDesperdiciadas} pruebas desperdiciadas. Quedan ${nuevaCantidadActual} frascos en el lote.`
        : `Frasco descartado. ${pruebasDesperdiciadas} pruebas desperdiciadas. Lote completamente agotado.`,
    };
  }

  /**
   * Obtiene todos los lotes con frasco abierto y su estado
   */
  async getLotesAbiertos(): Promise<LoteAbierto[]> {
    const lotes = await this.prisma.lote.findMany({
      where: {
        estado_lote: 'ABIERTO',
      },
      include: {
        item: true,
      },
      orderBy: {
        fecha_vencimiento_abierto: 'asc',
      },
    });

    const ahora = new Date();

    return lotes.map(lote => {
      const fechaVenc = lote.fecha_vencimiento_abierto || lote.fecha_vencimiento;
      const diasRestantes = fechaVenc
        ? Math.ceil((fechaVenc.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      const horasRestantes = fechaVenc
        ? Math.ceil((fechaVenc.getTime() - ahora.getTime()) / (1000 * 60 * 60))
        : 999;

      const capacidad = lote.item.capacidad_pruebas || 0;
      const pruebasRestantes = capacidad - lote.pruebas_realizadas;
      const porcentajeUso = capacidad > 0 ? Math.round((lote.pruebas_realizadas / capacidad) * 100) : 0;

      let estado = 'ACTIVO';
      if (horasRestantes <= 0) {
        estado = 'VENCIDO';
      } else if (horasRestantes <= 24) {
        estado = 'CRITICO';
      }

      return {
        codigo_lote: lote.codigo_lote,
        numero_lote: lote.numero_lote,
        item_nombre: lote.item.nombre,
        codigo_item: lote.codigo_item,
        fecha_apertura: lote.fecha_apertura!,
        fecha_vencimiento_abierto: fechaVenc!,
        dias_restantes: diasRestantes,
        horas_restantes: horasRestantes,
        pruebas_realizadas: lote.pruebas_realizadas,
        capacidad_pruebas: capacidad,
        pruebas_restantes: pruebasRestantes,
        porcentaje_uso: porcentajeUso,
        frascos_restantes: lote.cantidad_actual,
        frascos_totales: lote.cantidad_inicial,
        estado,
      };
    });
  }

  /**
   * Obtiene lotes con frasco abierto proximos a vencer
   */
  async getLotesProximosVencerApertura(horas: number = 24): Promise<any[]> {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + horas * 60 * 60 * 1000);

    const lotes = await this.prisma.lote.findMany({
      where: {
        estado_lote: 'ABIERTO',
        fecha_vencimiento_abierto: {
          lte: limite,
          gte: ahora,
        },
      },
      include: {
        item: true,
      },
      orderBy: {
        fecha_vencimiento_abierto: 'asc',
      },
    });

    return lotes.map(lote => {
      const capacidad = lote.item.capacidad_pruebas || 0;
      const horasRestantes = Math.ceil(
        (lote.fecha_vencimiento_abierto!.getTime() - ahora.getTime()) / (1000 * 60 * 60)
      );

      return {
        ...lote,
        horas_restantes: horasRestantes,
        pruebas_realizadas: lote.pruebas_realizadas,
        capacidad_pruebas: capacidad,
        pruebas_sin_usar: capacidad - lote.pruebas_realizadas,
        frascos_restantes: lote.cantidad_actual,
      };
    });
  }

  /**
   * Verifica y notifica lotes con frasco abierto proximos a vencer
   * Formato: "Vence en X dias - usado N/M pruebas"
   */
  async verificarYNotificarVencimientos(): Promise<void> {
    const lotesProximos = await this.getLotesProximosVencerApertura(24);

    if (lotesProximos.length === 0) {
      this.logger.log('No hay frascos abiertos proximos a vencer');
      return;
    }

    let mensaje = 'ALERTA: FRASCOS ABIERTOS POR VENCER\n';
    mensaje += '------------------------\n';
    mensaje += `Fecha: ${new Date().toLocaleDateString('es-EC')}\n\n`;

    for (const lote of lotesProximos.slice(0, 10)) {
      const horasTexto = lote.horas_restantes <= 24
        ? `${lote.horas_restantes}h`
        : `${Math.ceil(lote.horas_restantes / 24)} dias`;

      mensaje += `VENCE EN ${horasTexto}: ${lote.item.nombre}\n`;
      mensaje += `  Lote: ${lote.numero_lote}\n`;
      mensaje += `  Usado: ${lote.pruebas_realizadas}/${lote.capacidad_pruebas} pruebas\n`;
      mensaje += `  Desperdicio potencial: ${lote.pruebas_sin_usar} pruebas\n`;
      mensaje += `  Frascos restantes en lote: ${lote.frascos_restantes}\n\n`;
    }

    mensaje += '------------------------\n';
    mensaje += 'Use estos reactivos antes de que venzan';

    await this.whatsAppService.sendMessage({
      to: '',
      message: mensaje,
      tipo: 'ALERTA_VENCIMIENTO',
    });

    this.logger.warn(`Notificacion enviada: ${lotesProximos.length} frascos por vencer`);
  }

  /**
   * Obtiene lotes de un item especifico que estan cerrados (disponibles para abrir)
   */
  async getLotesCerradosItem(codigoItem: number): Promise<any[]> {
    const lotes = await this.prisma.lote.findMany({
      where: {
        codigo_item: codigoItem,
        estado_lote: 'CERRADO',
        cantidad_actual: { gt: 0 },
      },
      include: { item: true },
      orderBy: { fecha_vencimiento: 'asc' }, // FIFO sugerido pero no forzado
    });

    return lotes.map(lote => ({
      codigo_lote: lote.codigo_lote,
      numero_lote: lote.numero_lote,
      fecha_vencimiento: lote.fecha_vencimiento,
      frascos_disponibles: lote.cantidad_actual,
      capacidad_por_frasco: lote.item.capacidad_pruebas || 0,
      vida_util_dias: lote.item.vida_util_dias_abierto,
    }));
  }

  /**
   * PROCESO AUTOMATICO DE USO DE REACTIVO
   *
   * Se llama cuando se procesa un examen que usa un reactivo.
   * Maneja todo el ciclo de vida del frasco automaticamente:
   *
   * 1. Busca frasco abierto del item
   * 2. Si esta vencido -> lo descarta automaticamente y busca otro
   * 3. Si no hay abierto -> abre uno automaticamente (FIFO)
   * 4. Registra las pruebas
   * 5. Si el frasco se agota -> marca y abre otro si hay
   *
   * @param codigoItem - El item reactivo a usar
   * @param cantidadPruebas - Cuantas pruebas se van a realizar (normalmente 1)
   * @param referencia - Texto para trazabilidad (ej: "Examen Glucosa - Cita #123")
   * @param usuarioId - Quien realiza la operacion
   * @returns Resultado del proceso con detalles
   */
  async procesarUsoReactivoAutomatico(
    codigoItem: number,
    cantidadPruebas: number,
    referencia: string,
    usuarioId: number,
  ): Promise<{
    success: boolean;
    mensaje: string;
    lote_usado?: any;
    frasco_abierto_automaticamente?: boolean;
    frasco_descartado_por_vencimiento?: boolean;
    frasco_agotado?: boolean;
    alertas?: string[];
  }> {
    const alertas: string[] = [];

    // Verificar que el item existe y es reactivo
    const item = await this.prisma.item.findUnique({
      where: { codigo_item: codigoItem },
    });

    if (!item) {
      throw new NotFoundException(`Item ${codigoItem} no encontrado`);
    }

    if (!item.es_reactivo) {
      // No es reactivo, no aplica este proceso
      return {
        success: true,
        mensaje: 'Item no es reactivo, no requiere control de frascos',
      };
    }

    // Buscar frasco abierto de este item
    let loteAbierto = await this.prisma.lote.findFirst({
      where: {
        codigo_item: codigoItem,
        estado_lote: 'ABIERTO',
      },
      include: { item: true },
    });

    let frascoAbiertoAutomaticamente = false;
    let frascoDescartadoPorVencimiento = false;

    // Si hay frasco abierto, verificar si esta vencido
    if (loteAbierto) {
      const ahora = new Date();
      const vencido = loteAbierto.fecha_vencimiento_abierto && ahora > loteAbierto.fecha_vencimiento_abierto;

      if (vencido) {
        // Descartar automaticamente el frasco vencido
        this.logger.warn(
          `Descarte automatico de frasco vencido: ${loteAbierto.numero_lote} del item ${item.nombre}`
        );

        await this.descartarLote(
          {
            codigo_lote: loteAbierto.codigo_lote,
            motivo: 'VENCIDO_APERTURA',
            observacion: `Descarte automatico al procesar ${referencia}`,
          },
          usuarioId,
        );

        alertas.push(`Frasco vencido descartado automaticamente (Lote: ${loteAbierto.numero_lote})`);
        frascoDescartadoPorVencimiento = true;
        loteAbierto = null; // Ahora necesitamos abrir otro
      }
    }

    // Si no hay frasco abierto, abrir uno automaticamente (FIFO)
    if (!loteAbierto) {
      // Buscar lote cerrado disponible (el mas proximo a vencer)
      const loteCerrado = await this.prisma.lote.findFirst({
        where: {
          codigo_item: codigoItem,
          estado_lote: 'CERRADO',
          cantidad_actual: { gt: 0 },
          // No vencido
          OR: [
            { fecha_vencimiento: null },
            { fecha_vencimiento: { gt: new Date() } },
          ],
        },
        orderBy: { fecha_vencimiento: 'asc' },
        include: { item: true },
      });

      if (!loteCerrado) {
        throw new BadRequestException(
          `No hay frascos disponibles de "${item.nombre}" para abrir. ` +
          `Stock insuficiente para completar el examen.`
        );
      }

      // Abrir el lote automaticamente
      this.logger.log(
        `Apertura automatica de frasco: Lote ${loteCerrado.numero_lote} del item ${item.nombre}`
      );

      const resultadoApertura = await this.abrirLote(
        { codigo_lote: loteCerrado.codigo_lote },
        usuarioId,
      );

      frascoAbiertoAutomaticamente = true;
      alertas.push(`Frasco abierto automaticamente (Lote: ${loteCerrado.numero_lote})`);

      // Recargar el lote abierto
      loteAbierto = await this.prisma.lote.findFirst({
        where: {
          codigo_item: codigoItem,
          estado_lote: 'ABIERTO',
        },
        include: { item: true },
      });
    }

    if (!loteAbierto) {
      throw new BadRequestException(
        `Error inesperado: No se pudo obtener frasco abierto de "${item.nombre}"`
      );
    }

    // Registrar las pruebas
    const resultadoPruebas = await this.registrarPruebas(
      {
        codigo_lote: loteAbierto.codigo_lote,
        cantidad_pruebas: cantidadPruebas,
        observacion: referencia,
      },
      usuarioId,
    );

    // Verificar alertas de stock bajo
    const stockActual = item.stock_actual - (resultadoPruebas.frasco_agotado ? 1 : 0);
    if (stockActual <= item.stock_minimo) {
      alertas.push(`ALERTA: Stock bajo de "${item.nombre}". Actual: ${stockActual}, Minimo: ${item.stock_minimo}`);
    }

    // Si el frasco se agoto y no quedan mas, alertar
    if (resultadoPruebas.frasco_agotado && resultadoPruebas.frascos_restantes <= 0) {
      alertas.push(`CRITICO: Ultimo frasco de "${item.nombre}" agotado. Reabastecer urgente.`);
    }

    return {
      success: true,
      mensaje: resultadoPruebas.mensaje,
      lote_usado: {
        codigo_lote: loteAbierto.codigo_lote,
        numero_lote: loteAbierto.numero_lote,
        pruebas_registradas: cantidadPruebas,
      },
      frasco_abierto_automaticamente: frascoAbiertoAutomaticamente,
      frasco_descartado_por_vencimiento: frascoDescartadoPorVencimiento,
      frasco_agotado: resultadoPruebas.frasco_agotado || false,
      alertas: alertas.length > 0 ? alertas : undefined,
    };
  }
}
