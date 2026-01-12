import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DialogflowResponse,
  ExamenInfoDto,
  RangoReferenciaDto,
  DisponibilidadDto,
  HorarioDisponibleDto,
  CitaInfoDto,
  AgendarCitaDto,
} from '../dto/dialogflow.dto';

@Injectable()
export class DialogflowService {
  private readonly logger = new Logger(DialogflowService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normaliza texto para búsqueda flexible
   * - Quita acentos
   * - Convierte a minúsculas
   * - Quita espacios extra
   */
  private normalizarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quita acentos
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Búsqueda flexible de exámenes usando SQL raw
   * Busca en nombre, descripción y código interno
   */
  private async buscarExamenFlexible(termino: string) {
    const terminoNormalizado = this.normalizarTexto(termino);
    const palabras = terminoNormalizado.split(' ').filter(p => p.length > 2);

    this.logger.log(`Buscando examen: "${termino}" -> palabras: [${palabras.join(', ')}]`);

    // Primero intentar búsqueda exacta con contains
    let examen = await this.prisma.examen.findFirst({
      where: {
        activo: true,
        OR: [
          { nombre: { contains: termino, mode: 'insensitive' } },
          { codigo_interno: { contains: termino, mode: 'insensitive' } },
          { descripcion: { contains: termino, mode: 'insensitive' } },
        ],
      },
      include: {
        categoria: true,
        precios: {
          where: { activo: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        },
      },
    });

    if (examen) {
      this.logger.log(`Encontrado por búsqueda directa: ${examen.nombre}`);
      return examen;
    }

    // Si no encuentra, buscar por cada palabra individual
    for (const palabra of palabras) {
      examen = await this.prisma.examen.findFirst({
        where: {
          activo: true,
          OR: [
            { nombre: { contains: palabra, mode: 'insensitive' } },
            { codigo_interno: { contains: palabra, mode: 'insensitive' } },
            { descripcion: { contains: palabra, mode: 'insensitive' } },
          ],
        },
        include: {
          categoria: true,
          precios: {
            where: { activo: true },
            orderBy: { fecha_inicio: 'desc' },
            take: 1,
          },
        },
      });

      if (examen) {
        this.logger.log(`Encontrado por palabra "${palabra}": ${examen.nombre}`);
        return examen;
      }
    }

    // Búsqueda con SQL raw para más flexibilidad (unaccent si está disponible)
    try {
      const resultados = await this.prisma.$queryRaw<any[]>`
        SELECT e.*, c.nombre as categoria_nombre
        FROM catalogo.examen e
        LEFT JOIN catalogo.categoria_examen c ON e.codigo_categoria = c.codigo_categoria
        WHERE e.activo = true
        AND (
          LOWER(e.nombre) LIKE ${`%${terminoNormalizado}%`}
          OR LOWER(e.codigo_interno) LIKE ${`%${terminoNormalizado}%`}
          OR LOWER(COALESCE(e.descripcion, '')) LIKE ${`%${terminoNormalizado}%`}
        )
        LIMIT 1
      `;

      if (resultados.length > 0) {
        const r = resultados[0];
        this.logger.log(`Encontrado por SQL raw: ${r.nombre}`);
        // Obtener precios por separado
        const precios = await this.prisma.precio.findMany({
          where: { codigo_examen: r.codigo_examen, activo: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        });
        return {
          ...r,
          categoria: r.categoria_nombre ? { nombre: r.categoria_nombre } : null,
          precios,
        };
      }
    } catch (error) {
      this.logger.warn('Error en búsqueda SQL raw, usando fallback', error.message);
    }

    this.logger.log(`No se encontró examen para: "${termino}"`);
    return null;
  }

  /**
   * Busca exámenes similares para sugerencias
   */
  private async buscarExamenesSimilares(termino: string, limite: number = 3) {
    const terminoNormalizado = this.normalizarTexto(termino);
    const palabras = terminoNormalizado.split(' ').filter(p => p.length > 2);

    const condiciones: any[] = [];

    // Agregar condiciones por cada palabra
    for (const palabra of palabras) {
      condiciones.push({ nombre: { contains: palabra, mode: 'insensitive' as const } });
    }

    // Si no hay palabras válidas, usar el término completo
    if (condiciones.length === 0) {
      condiciones.push({ nombre: { contains: termino, mode: 'insensitive' as const } });
    }

    return this.prisma.examen.findMany({
      where: {
        activo: true,
        OR: condiciones,
      },
      select: { nombre: true },
      take: limite,
    });
  }

  // =====================================================
  // EXÁMENES
  // =====================================================

  /**
   * Lista todos los exámenes disponibles con precios
   */
  async listarExamenes(): Promise<DialogflowResponse<ExamenInfoDto[]>> {
    this.logger.log('Listando exámenes disponibles');

    try {
      const examenes = await this.prisma.examen.findMany({
        where: { activo: true },
        include: {
          categoria: true,
          precios: {
            where: { activo: true },
            orderBy: { fecha_inicio: 'desc' },
            take: 1,
          },
        },
        orderBy: { nombre: 'asc' },
        take: 50,
      });

      const data: ExamenInfoDto[] = examenes.map((e) => ({
        codigo: e.codigo_examen,
        nombre: e.nombre,
        categoria: e.categoria?.nombre,
        precio: e.precios[0] ? Number(e.precios[0].precio) : 0,
        moneda: 'USD',
        requiere_ayuno: e.requiere_ayuno,
        horas_ayuno: e.horas_ayuno || undefined,
        tiempo_entrega_horas: e.tiempo_entrega_horas,
      }));

      const ejemplos = data
        .filter((e) => e.precio > 0)
        .slice(0, 3)
        .map((e) => `${e.nombre}: $${e.precio}`)
        .join(', ');

      return {
        success: true,
        data,
        mensaje: `Tenemos ${data.length} exámenes disponibles. Algunos ejemplos: ${ejemplos}. ¿Cuál te interesa?`,
      };
    } catch (error) {
      this.logger.error('Error listando exámenes', error);
      return {
        success: false,
        mensaje: 'Error al consultar los exámenes disponibles.',
        error_code: 'ERROR_INTERNO',
      };
    }
  }

  /**
   * Consulta el precio de un examen por nombre (búsqueda flexible)
   */
  async consultarPrecio(nombre: string): Promise<DialogflowResponse<ExamenInfoDto>> {
    this.logger.log(`Consultando precio: ${nombre}`);

    try {
      // Usar búsqueda flexible
      const examen = await this.buscarExamenFlexible(nombre);

      if (!examen) {
        // Buscar sugerencias
        const similares = await this.buscarExamenesSimilares(nombre);
        const sugerencias = similares.map(e => e.nombre).join(', ');

        return {
          success: false,
          mensaje: sugerencias
            ? `No encontré "${nombre}". ¿Quizás buscas: ${sugerencias}?`
            : `No encontré el examen "${nombre}". ¿Podrías verificar el nombre?`,
          error_code: 'EXAMEN_NO_ENCONTRADO',
        };
      }

      const precio = examen.precios?.[0] ? Number(examen.precios[0].precio) : 0;
      let preparacion = '';
      if (examen.requiere_ayuno) {
        preparacion = ` Requiere ayuno de ${examen.horas_ayuno || 8} horas.`;
      }

      return {
        success: true,
        data: {
          codigo: examen.codigo_examen,
          nombre: examen.nombre,
          categoria: examen.categoria?.nombre,
          precio,
          moneda: 'USD',
          requiere_ayuno: examen.requiere_ayuno,
          horas_ayuno: examen.horas_ayuno || undefined,
          tiempo_entrega_horas: examen.tiempo_entrega_horas,
        },
        mensaje: precio > 0
          ? `El ${examen.nombre} cuesta $${precio.toFixed(2)} USD.${preparacion}`
          : `El ${examen.nombre} no tiene precio registrado. Contacta a nuestras sedes.`,
      };
    } catch (error) {
      this.logger.error('Error consultando precio', error);
      return {
        success: false,
        mensaje: 'Error al consultar el precio.',
        error_code: 'ERROR_INTERNO',
      };
    }
  }

  /**
   * Consulta valores de referencia de un examen (búsqueda flexible)
   */
  async consultarRango(nombre: string): Promise<DialogflowResponse<RangoReferenciaDto>> {
    this.logger.log(`Consultando rango: ${nombre}`);

    try {
      // Usar búsqueda flexible
      const examen = await this.buscarExamenFlexible(nombre);

      if (!examen) {
        // Buscar sugerencias
        const similares = await this.buscarExamenesSimilares(nombre);
        const sugerencias = similares.map(e => e.nombre).join(', ');

        return {
          success: false,
          mensaje: sugerencias
            ? `No encontré "${nombre}". ¿Quizás buscas: ${sugerencias}?`
            : `No encontré el examen "${nombre}".`,
          error_code: 'EXAMEN_NO_ENCONTRADO',
        };
      }

      const min = examen.valor_referencia_min ? Number(examen.valor_referencia_min) : undefined;
      const max = examen.valor_referencia_max ? Number(examen.valor_referencia_max) : undefined;
      const unidad = examen.unidad_medida || '';

      let mensaje = `Valores de referencia para ${examen.nombre}: `;
      if (min !== undefined && max !== undefined) {
        mensaje += `${min} - ${max} ${unidad}`;
      } else if (examen.valores_referencia_texto) {
        mensaje += examen.valores_referencia_texto;
      } else {
        mensaje = `${examen.nombre} no tiene rangos definidos. Consulta con un profesional.`;
      }

      return {
        success: true,
        data: {
          nombre: examen.nombre,
          valor_min: min,
          valor_max: max,
          unidad_medida: examen.unidad_medida || undefined,
          valores_texto: examen.valores_referencia_texto || undefined,
        },
        mensaje,
      };
    } catch (error) {
      this.logger.error('Error consultando rango', error);
      return {
        success: false,
        mensaje: 'Error al consultar valores de referencia.',
        error_code: 'ERROR_INTERNO',
      };
    }
  }

  // =====================================================
  // CITAS Y DISPONIBILIDAD
  // =====================================================

  /**
   * Consulta disponibilidad para una fecha
   */
  async consultarDisponibilidad(
    fecha: string,
    codigoServicio?: number,
  ): Promise<DialogflowResponse<DisponibilidadDto>> {
    this.logger.log(`Consultando disponibilidad: ${fecha}`);

    try {
      const fechaConsulta = new Date(fecha);
      if (isNaN(fechaConsulta.getTime())) {
        return {
          success: false,
          mensaje: 'Fecha inválida. Usa formato YYYY-MM-DD.',
          error_code: 'FECHA_INVALIDA',
        };
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (fechaConsulta < hoy) {
        return {
          success: false,
          mensaje: 'No puedes consultar fechas pasadas.',
          error_code: 'FECHA_PASADA',
        };
      }

      // Verificar feriado
      const feriado = await this.prisma.feriado.findFirst({
        where: { fecha: fechaConsulta, activo: true },
      });

      if (feriado) {
        return {
          success: true,
          data: { fecha, total_horarios: 0, horarios: [] },
          mensaje: `El ${fecha} es ${feriado.descripcion}. No hay atención.`,
        };
      }

      // Buscar slots
      const where: any = {
        fecha: fechaConsulta,
        activo: true,
        cupos_disponibles: { gt: 0 },
      };
      if (codigoServicio) {
        where.codigo_servicio = codigoServicio;
      }

      const slots = await this.prisma.slot.findMany({
        where,
        include: { sede: true, servicio: true },
        orderBy: { hora_inicio: 'asc' },
      });

      if (slots.length === 0) {
        return {
          success: true,
          data: { fecha, total_horarios: 0, horarios: [] },
          mensaje: `No hay horarios disponibles para el ${fecha}.`,
        };
      }

      const horarios: HorarioDisponibleDto[] = slots.map((s) => ({
        slot_id: s.codigo_slot,
        hora: new Date(s.hora_inicio).toLocaleTimeString('es', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        cupos: s.cupos_disponibles,
        sede: s.sede?.nombre || 'Sede Principal',
        servicio: s.servicio?.nombre || 'Servicio General',
      }));

      const fechaFormateada = fechaConsulta.toLocaleDateString('es', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      return {
        success: true,
        data: { fecha, total_horarios: horarios.length, horarios },
        mensaje: `Para el ${fechaFormateada} hay ${horarios.length} horarios. El primero es a las ${horarios[0].hora}.`,
      };
    } catch (error) {
      this.logger.error('Error consultando disponibilidad', error);
      return {
        success: false,
        mensaje: 'Error al consultar disponibilidad.',
        error_code: 'ERROR_INTERNO',
      };
    }
  }

  /**
   * Agenda una cita
   */
  async agendarCita(dto: AgendarCitaDto): Promise<DialogflowResponse<CitaInfoDto>> {
    this.logger.log(`Agendando cita: ${dto.cedula_paciente} - ${dto.fecha}`);

    try {
      // Buscar paciente
      const paciente = await this.prisma.usuario.findFirst({
        where: { cedula: dto.cedula_paciente, activo: true },
      });

      if (!paciente) {
        return {
          success: false,
          mensaje: `No encontré paciente con cédula ${dto.cedula_paciente}. Regístrate primero.`,
          error_code: 'PACIENTE_NO_ENCONTRADO',
        };
      }

      // Buscar slot disponible
      const fechaCita = new Date(dto.fecha);
      const [horas, minutos] = dto.hora.split(':').map(Number);

      const slots = await this.prisma.slot.findMany({
        where: {
          fecha: fechaCita,
          activo: true,
          cupos_disponibles: { gt: 0 },
          ...(dto.codigo_servicio && { codigo_servicio: dto.codigo_servicio }),
          ...(dto.codigo_sede && { codigo_sede: dto.codigo_sede }),
        },
        include: { sede: true, servicio: true },
        orderBy: { hora_inicio: 'asc' },
      });

      // Buscar slot por hora exacta o el más cercano
      let slot = slots.find((s) => {
        const h = new Date(s.hora_inicio);
        return h.getHours() === horas && h.getMinutes() === minutos;
      });
      if (!slot && slots.length > 0) {
        slot = slots[0];
      }

      if (!slot) {
        return {
          success: false,
          mensaje: `No hay horarios para ${dto.fecha} a las ${dto.hora}.`,
          error_code: 'SLOT_NO_DISPONIBLE',
        };
      }

      // Verificar duplicado
      const existente = await this.prisma.cita.findFirst({
        where: {
          codigo_paciente: paciente.codigo_usuario,
          codigo_slot: slot.codigo_slot,
          estado: { notIn: ['CANCELADA'] },
        },
      });

      if (existente) {
        return {
          success: false,
          mensaje: 'Ya tienes una cita en este horario.',
          error_code: 'CITA_DUPLICADA',
        };
      }

      // Crear cita
      const cita = await this.prisma.$transaction(async (tx) => {
        await tx.slot.update({
          where: { codigo_slot: slot!.codigo_slot },
          data: { cupos_disponibles: { decrement: 1 } },
        });

        return tx.cita.create({
          data: {
            codigo_paciente: paciente.codigo_usuario,
            codigo_slot: slot!.codigo_slot,
            estado: 'AGENDADA',
            observaciones: dto.observaciones || 'Cita agendada vía Dialogflow',
          },
        });
      });

      const horaF = new Date(slot.hora_inicio).toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const fechaF = fechaCita.toLocaleDateString('es', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      return {
        success: true,
        data: {
          codigo_cita: cita.codigo_cita,
          fecha: dto.fecha,
          hora: horaF,
          servicio: slot.servicio?.nombre || 'Servicio',
          sede: slot.sede?.nombre || 'Sede',
          estado: 'AGENDADA',
        },
        mensaje: `¡Cita agendada! Código #${cita.codigo_cita}. Te esperamos el ${fechaF} a las ${horaF}. Llega 15 min antes.`,
      };
    } catch (error) {
      this.logger.error('Error agendando cita', error);
      return {
        success: false,
        mensaje: 'Error al agendar la cita.',
        error_code: 'ERROR_INTERNO',
      };
    }
  }

  /**
   * Consulta citas de un paciente
   */
  async consultarCitas(cedula: string): Promise<DialogflowResponse<CitaInfoDto[]>> {
    this.logger.log(`Consultando citas: ${cedula}`);

    try {
      const paciente = await this.prisma.usuario.findFirst({
        where: { cedula, activo: true },
      });

      if (!paciente) {
        return {
          success: false,
          mensaje: `No encontré paciente con cédula ${cedula}.`,
          error_code: 'PACIENTE_NO_ENCONTRADO',
        };
      }

      const citas = await this.prisma.cita.findMany({
        where: {
          codigo_paciente: paciente.codigo_usuario,
          estado: { in: ['AGENDADA', 'CONFIRMADA', 'EN_PROCESO'] },
        },
        include: {
          slot: { include: { servicio: true, sede: true } },
        },
        orderBy: { slot: { fecha: 'asc' } },
        take: 10,
      });

      if (citas.length === 0) {
        return {
          success: true,
          data: [],
          mensaje: 'No tienes citas pendientes. ¿Deseas agendar una?',
        };
      }

      const data: CitaInfoDto[] = citas.map((c) => ({
        codigo_cita: c.codigo_cita,
        fecha: new Date(c.slot.fecha).toISOString().split('T')[0],
        hora: new Date(c.slot.hora_inicio).toLocaleTimeString('es', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        servicio: c.slot.servicio?.nombre || 'Servicio',
        sede: c.slot.sede?.nombre || 'Sede',
        estado: c.estado,
      }));

      const proxima = data[0];
      return {
        success: true,
        data,
        mensaje: `Tienes ${data.length} cita(s). La próxima es el ${proxima.fecha} a las ${proxima.hora} para ${proxima.servicio}.`,
      };
    } catch (error) {
      this.logger.error('Error consultando citas', error);
      return {
        success: false,
        mensaje: 'Error al consultar citas.',
        error_code: 'ERROR_INTERNO',
      };
    }
  }
}
