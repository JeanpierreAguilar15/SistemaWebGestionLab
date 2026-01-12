import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Extrae la hora de un campo TIME de PostgreSQL
 * PostgreSQL TIME se almacena sin zona horaria, pero Prisma lo convierte a Date
 * Usamos toTimeString para obtener la hora local tal como se almacenó
 */
function extractHourFromTime(time: Date): number {
    // toTimeString devuelve formato "HH:MM:SS GMT±XXXX"
    const timeStr = time.toTimeString();
    const hour = parseInt(timeStr.substring(0, 2));
    return isNaN(hour) ? time.getHours() : hour;
}

function extractMinuteFromTime(time: Date): number {
    const timeStr = time.toTimeString();
    const minute = parseInt(timeStr.substring(3, 5));
    return isNaN(minute) ? time.getMinutes() : minute;
}

function extractTimeString(time: Date): string {
    const timeStr = time.toTimeString();
    // Formato "HH:MM:SS GMT±XXXX" -> extraemos "HH:MM"
    return timeStr.substring(0, 5);
}

/**
 * Examen seleccionado para cotización
 */
interface ExamenSeleccionado {
    codigo: number;
    nombre: string;
    precio: number;
}

/**
 * Estado de la conversación de agendamiento
 */
interface AgendaConversationState {
    step: 'INICIAL' | 'SELECCIONAR_SERVICIO' | 'SELECCIONAR_CATEGORIA' | 'SELECCIONAR_EXAMENES' | 'SELECCIONAR_FECHA' | 'SELECCIONAR_TURNO' | 'SELECCIONAR_HORA_RANGO' | 'SELECCIONAR_SLOT' | 'CONFIRMAR' | 'COMPLETADO';
    servicioId?: number;
    servicioNombre?: string;
    requiereExamenes?: boolean;
    categoriaId?: number;
    examenesSeleccionados?: ExamenSeleccionado[];
    fecha?: string;
    turnosDisponibles?: ('MANANA' | 'TARDE')[];
    turno?: 'MANANA' | 'TARDE';
    horaRango?: string; // ej: "13:00-14:00"
    slotId?: number;
    slotHora?: string;
    sedeNombre?: string;
}

/**
 * ChatbotAgendaService - HU-26: Gestión de Turnos vía Chatbot
 *
 * Permite a los pacientes:
 * - Consultar disponibilidad de citas
 * - Agendar una cita paso a paso
 * - Ver sus citas pendientes
 * - Cancelar citas
 */
@Injectable()
export class ChatbotAgendaService {
    private readonly logger = new Logger(ChatbotAgendaService.name);

    // Estado de conversaciones de agendamiento (sessionId -> state)
    private conversationStates = new Map<string, AgendaConversationState>();

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Inicia el flujo de agendamiento de citas
     */
    async iniciarAgendamiento(sessionId: string): Promise<{
        mensaje: string;
        opciones?: { id: number; nombre: string }[];
        accion: string;
    }> {
        // Obtener servicios disponibles
        const servicios = await this.prisma.servicio.findMany({
            where: { activo: true },
            select: {
                codigo_servicio: true,
                nombre: true,
                descripcion: true,
            },
            orderBy: { nombre: 'asc' },
        });

        if (servicios.length === 0) {
            return {
                mensaje: 'Lo sentimos, actualmente no tenemos servicios disponibles para agendar. Por favor, contacta directamente a nuestras sedes.',
                accion: 'NO_SERVICIOS',
            };
        }

        // Guardar estado de conversación
        this.conversationStates.set(sessionId, {
            step: 'SELECCIONAR_SERVICIO',
        });

        const listaServicios = servicios.map((s, idx) =>
            `${idx + 1}. ${s.nombre}${s.descripcion ? ` - ${s.descripcion}` : ''}`
        ).join('\n');

        return {
            mensaje: `Vamos a agendar tu cita.\n\nPor favor, selecciona el servicio que necesitas:\n\n${listaServicios}\n\nEscribe el numero del servicio o su nombre.`,
            opciones: servicios.map(s => ({ id: s.codigo_servicio, nombre: s.nombre })),
            accion: 'SELECCIONAR_SERVICIO',
        };
    }

    /**
     * Procesa la selección del servicio
     */
    async seleccionarServicio(sessionId: string, input: string): Promise<{
        mensaje: string;
        opciones?: any[];
        accion: string;
    }> {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'SELECCIONAR_SERVICIO') {
            return this.iniciarAgendamiento(sessionId);
        }

        // Buscar servicio por número o nombre
        const servicios = await this.prisma.servicio.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' },
        });

        let servicioSeleccionado: typeof servicios[0] | undefined;

        // Intentar por número
        const numero = parseInt(input);
        if (!isNaN(numero) && numero > 0 && numero <= servicios.length) {
            servicioSeleccionado = servicios[numero - 1];
        } else {
            // Intentar por nombre
            servicioSeleccionado = servicios.find(s =>
                s.nombre.toLowerCase().includes(input.toLowerCase())
            );
        }

        if (!servicioSeleccionado) {
            return {
                mensaje: `No encontre ese servicio. Por favor, selecciona un numero del 1 al ${servicios.length} o escribe el nombre del servicio.`,
                accion: 'SELECCIONAR_SERVICIO_RETRY',
            };
        }

        // Verificar si es Toma de Muestras (requiere selección de exámenes)
        const esTomaMuestras = servicioSeleccionado.nombre.toLowerCase().includes('toma de muestra') ||
                              servicioSeleccionado.nombre.toLowerCase().includes('laboratorio');

        if (esTomaMuestras) {
            // Guardar estado y pedir exámenes
            state.step = 'SELECCIONAR_CATEGORIA';
            state.servicioId = servicioSeleccionado.codigo_servicio;
            state.servicioNombre = servicioSeleccionado.nombre;
            state.requiereExamenes = true;
            state.examenesSeleccionados = [];
            this.conversationStates.set(sessionId, state);

            return this.mostrarCategoriasExamenes(sessionId);
        }

        // Buscar fechas disponibles (próximos 14 días)
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const en14Dias = new Date(hoy);
        en14Dias.setDate(en14Dias.getDate() + 14);

        const slotsDisponibles = await this.prisma.slot.groupBy({
            by: ['fecha'],
            where: {
                codigo_servicio: servicioSeleccionado.codigo_servicio,
                activo: true,
                cupos_disponibles: { gt: 0 },
                fecha: {
                    gte: hoy,
                    lte: en14Dias,
                },
            },
            _count: {
                codigo_slot: true,
            },
            orderBy: {
                fecha: 'asc',
            },
        });

        if (slotsDisponibles.length === 0) {
            state.step = 'INICIAL';
            this.conversationStates.set(sessionId, state);
            return {
                mensaje: `Lo sentimos, no hay disponibilidad para ${servicioSeleccionado.nombre} en los proximos 14 dias.\n\nTe recomendamos:\n- Llamar a nuestras sedes para consultar disponibilidad\n- Intentar con otro servicio\n\nDeseas agendar otro servicio?`,
                accion: 'NO_DISPONIBILIDAD',
            };
        }

        // Actualizar estado
        state.step = 'SELECCIONAR_FECHA';
        state.servicioId = servicioSeleccionado.codigo_servicio;
        state.servicioNombre = servicioSeleccionado.nombre;
        this.conversationStates.set(sessionId, state);

        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
        const listaFechas = slotsDisponibles.slice(0, 7).map((slot, idx) => {
            const fecha = new Date(slot.fecha);
            const diaSemana = diasSemana[fecha.getDay()];
            const fechaStr = fecha.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
            return `${idx + 1}. ${diaSemana} ${fechaStr}`;
        }).join('\n');

        return {
            mensaje: `Has seleccionado: ${servicioSeleccionado.nombre}\n\nFechas disponibles:\n\n${listaFechas}\n\nEscribe el numero de la fecha.`,
            opciones: slotsDisponibles.slice(0, 7).map(s => ({
                fecha: new Date(s.fecha).toISOString().split('T')[0],
                disponibles: s._count.codigo_slot,
            })),
            accion: 'SELECCIONAR_FECHA',
        };
    }

    /**
     * Procesa la selección de fecha
     */
    async seleccionarFecha(sessionId: string, input: string): Promise<{
        mensaje: string;
        opciones?: any[];
        accion: string;
    }> {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'SELECCIONAR_FECHA') {
            return { mensaje: 'Por favor, inicia el proceso de agendamiento escribiendo "agendar cita".', accion: 'REINICIAR' };
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const en14Dias = new Date(hoy);
        en14Dias.setDate(en14Dias.getDate() + 14);

        // Obtener fechas disponibles
        const fechasDisponibles = await this.prisma.slot.groupBy({
            by: ['fecha'],
            where: {
                codigo_servicio: state.servicioId,
                activo: true,
                cupos_disponibles: { gt: 0 },
                fecha: { gte: hoy, lte: en14Dias },
            },
            orderBy: { fecha: 'asc' },
        });

        let fechaSeleccionada: Date | undefined;

        // Intentar por número
        const numero = parseInt(input);
        if (!isNaN(numero) && numero > 0 && numero <= fechasDisponibles.length) {
            fechaSeleccionada = new Date(fechasDisponibles[numero - 1].fecha);
        } else {
            // Intentar por día de la semana
            const diasPatrones = [
                { patron: /dom(ingo)?/i, dia: 0 },
                { patron: /lun(es)?/i, dia: 1 },
                { patron: /mar(tes)?/i, dia: 2 },
                { patron: /mi[eé]r?(coles)?/i, dia: 3 },
                { patron: /jue(ves)?/i, dia: 4 },
                { patron: /vie(rnes)?/i, dia: 5 },
                { patron: /s[aá]b(ado)?/i, dia: 6 },
            ];

            for (const { patron, dia } of diasPatrones) {
                if (patron.test(input)) {
                    fechaSeleccionada = fechasDisponibles.find(f =>
                        new Date(f.fecha).getDay() === dia
                    )?.fecha as Date | undefined;
                    break;
                }
            }
        }

        if (!fechaSeleccionada) {
            return {
                mensaje: `No entendí la fecha. Por favor, escribe el número (1-${fechasDisponibles.length}) o el día de la semana.`,
                accion: 'SELECCIONAR_FECHA_RETRY',
            };
        }

        // Buscar slots disponibles para esa fecha
        const slots = await this.prisma.slot.findMany({
            where: {
                codigo_servicio: state.servicioId,
                fecha: fechaSeleccionada,
                activo: true,
                cupos_disponibles: { gt: 0 },
            },
            include: {
                sede: true,
            },
            orderBy: { hora_inicio: 'asc' },
        });

        if (slots.length === 0) {
            return {
                mensaje: 'Lo sentimos, ya no hay horarios disponibles para esta fecha. Por favor, selecciona otra fecha.',
                accion: 'SELECCIONAR_FECHA_RETRY',
            };
        }

        // Contar horarios de mañana y tarde
        let slotsManana = 0;
        let slotsTarde = 0;
        for (const slot of slots) {
            const hora = extractHourFromTime(new Date(slot.hora_inicio));
            if (hora < 12) {
                slotsManana++;
            } else {
                slotsTarde++;
            }
        }

        // Construir lista de turnos disponibles en orden
        const turnosDisponibles: ('MANANA' | 'TARDE')[] = [];
        if (slotsManana > 0) turnosDisponibles.push('MANANA');
        if (slotsTarde > 0) turnosDisponibles.push('TARDE');

        // Actualizar estado
        state.step = 'SELECCIONAR_TURNO';
        state.fecha = fechaSeleccionada.toISOString().split('T')[0];
        state.turnosDisponibles = turnosDisponibles;
        this.conversationStates.set(sessionId, state);

        const fechaFormateada = new Date(fechaSeleccionada).toLocaleDateString('es-EC', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });

        // Construir opciones de turno dinámicamente
        const opcionesTurno = turnosDisponibles.map((turno, idx) => {
            if (turno === 'MANANA') {
                return `${idx + 1}. Turno Manana (7:00 - 12:00)`;
            } else {
                return `${idx + 1}. Turno Tarde (12:00 - 18:00)`;
            }
        }).join('\n');

        return {
            mensaje: `Fecha seleccionada: ${fechaFormateada}\n\nSelecciona el turno de tu preferencia:\n\n${opcionesTurno}\n\nEscribe "manana" o "tarde" (o el numero).`,
            opciones: turnosDisponibles.map(t => ({
                turno: t,
                disponible: true,
            })),
            accion: 'SELECCIONAR_TURNO',
        };
    }

    /**
     * Procesa la selección de turno (mañana/tarde)
     */
    async seleccionarTurno(sessionId: string, input: string): Promise<{
        mensaje: string;
        opciones?: any[];
        accion: string;
    }> {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'SELECCIONAR_TURNO') {
            return { mensaje: 'Por favor, inicia el proceso de agendamiento escribiendo "agendar cita".', accion: 'REINICIAR' };
        }

        const turnosDisponibles = state.turnosDisponibles || ['MANANA', 'TARDE'];

        // Detectar turno seleccionado
        let turnoSeleccionado: 'MANANA' | 'TARDE' | null = null;
        const inputLower = input.toLowerCase().trim();

        // Primero intentar por nombre directo
        if (/ma[nñ]ana/i.test(inputLower)) {
            if (turnosDisponibles.includes('MANANA')) {
                turnoSeleccionado = 'MANANA';
            }
        } else if (/tarde/i.test(inputLower)) {
            if (turnosDisponibles.includes('TARDE')) {
                turnoSeleccionado = 'TARDE';
            }
        } else {
            // Intentar por número (índice en la lista de turnos disponibles)
            const numero = parseInt(inputLower);
            if (!isNaN(numero) && numero >= 1 && numero <= turnosDisponibles.length) {
                turnoSeleccionado = turnosDisponibles[numero - 1];
            }
        }

        if (!turnoSeleccionado) {
            const opcionesTexto = turnosDisponibles.length === 1
                ? `Escribe "1" o "${turnosDisponibles[0] === 'MANANA' ? 'manana' : 'tarde'}".`
                : 'Escribe "manana" o "tarde" (o 1/2).';
            return {
                mensaje: `No entendi tu seleccion. ${opcionesTexto}`,
                accion: 'SELECCIONAR_TURNO_RETRY',
            };
        }

        // Obtener slots del turno seleccionado
        const slots = await this.prisma.slot.findMany({
            where: {
                codigo_servicio: state.servicioId,
                fecha: new Date(state.fecha!),
                activo: true,
                cupos_disponibles: { gt: 0 },
            },
            include: { sede: true },
            orderBy: { hora_inicio: 'asc' },
        });

        // Filtrar por turno
        const slotsFiltrados = slots.filter(slot => {
            const hora = extractHourFromTime(new Date(slot.hora_inicio));
            if (turnoSeleccionado === 'MANANA') {
                return hora < 12;
            } else {
                return hora >= 12;
            }
        });

        if (slotsFiltrados.length === 0) {
            return {
                mensaje: `No hay horarios disponibles en el turno ${turnoSeleccionado === 'MANANA' ? 'manana' : 'tarde'}. Intenta con el otro turno.`,
                accion: 'SELECCIONAR_TURNO_RETRY',
            };
        }

        // Agrupar slots por rango de hora (ej: 13:00-14:00, 14:00-15:00)
        const rangosPorHora = new Map<string, number>();
        for (const slot of slotsFiltrados) {
            const horaDate = new Date(slot.hora_inicio);
            const horaInicio = extractHourFromTime(horaDate);
            const rangoKey = `${horaInicio.toString().padStart(2, '0')}:00-${(horaInicio + 1).toString().padStart(2, '0')}:00`;
            rangosPorHora.set(rangoKey, (rangosPorHora.get(rangoKey) || 0) + 1);
        }

        const rangosArray = Array.from(rangosPorHora.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        // Si hay pocos slots (8 o menos), mostrarlos directamente
        if (slotsFiltrados.length <= 8) {
            state.step = 'SELECCIONAR_SLOT';
            state.turno = turnoSeleccionado;
            this.conversationStates.set(sessionId, state);

            const listaHorarios = slotsFiltrados.map((slot, idx) => {
                const horaDate = new Date(slot.hora_inicio);
                const horas = extractHourFromTime(horaDate).toString().padStart(2, '0');
                const minutos = extractMinuteFromTime(horaDate).toString().padStart(2, '0');
                const horaInicio = `${horas}:${minutos}`;
                return `${idx + 1}. ${horaInicio} - ${slot.sede?.nombre || 'Sede Principal'}`;
            }).join('\n');

            const turnoNombre = turnoSeleccionado === 'MANANA' ? 'Manana' : 'Tarde';

            return {
                mensaje: `Turno ${turnoNombre} seleccionado.\n\nHorarios disponibles:\n\n${listaHorarios}\n\nEscribe el numero del horario que prefieras.`,
                opciones: slotsFiltrados.map(s => {
                    const horaDate = new Date(s.hora_inicio);
                    const horas = extractHourFromTime(horaDate).toString().padStart(2, '0');
                    const minutos = extractMinuteFromTime(horaDate).toString().padStart(2, '0');
                    return {
                        id: s.codigo_slot,
                        hora: `${horas}:${minutos}`,
                        sede: s.sede?.nombre || 'Sede Principal',
                    };
                }),
                accion: 'SELECCIONAR_SLOT',
            };
        }

        // Si hay muchos slots, mostrar rangos de hora primero
        state.step = 'SELECCIONAR_HORA_RANGO';
        state.turno = turnoSeleccionado;
        this.conversationStates.set(sessionId, state);

        const listaRangos = rangosArray.map(([rango, cantidad], idx) => {
            return `${idx + 1}. ${rango} (${cantidad} horarios)`;
        }).join('\n');

        const turnoNombre = turnoSeleccionado === 'MANANA' ? 'Manana' : 'Tarde';

        return {
            mensaje: `Turno ${turnoNombre} seleccionado.\n\nTenemos ${slotsFiltrados.length} horarios disponibles. Selecciona un rango de hora:\n\n${listaRangos}\n\nEscribe el numero del rango.`,
            opciones: rangosArray.map(([rango, cantidad]) => ({
                rango,
                cantidad,
            })),
            accion: 'SELECCIONAR_HORA_RANGO',
        };
    }

    /**
     * Procesa la selección de rango de hora
     */
    async seleccionarHoraRango(sessionId: string, input: string): Promise<{
        mensaje: string;
        opciones?: any[];
        accion: string;
    }> {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'SELECCIONAR_HORA_RANGO') {
            return { mensaje: 'Por favor, inicia el proceso de agendamiento escribiendo "agendar cita".', accion: 'REINICIAR' };
        }

        // Obtener slots del turno seleccionado
        const slots = await this.prisma.slot.findMany({
            where: {
                codigo_servicio: state.servicioId,
                fecha: new Date(state.fecha!),
                activo: true,
                cupos_disponibles: { gt: 0 },
            },
            include: { sede: true },
            orderBy: { hora_inicio: 'asc' },
        });

        // Filtrar por turno
        const slotsFiltrados = slots.filter(slot => {
            const hora = extractHourFromTime(new Date(slot.hora_inicio));
            if (state.turno === 'MANANA') {
                return hora < 12;
            } else {
                return hora >= 12;
            }
        });

        // Obtener rangos disponibles
        const rangosPorHora = new Map<string, typeof slotsFiltrados>();
        for (const slot of slotsFiltrados) {
            const horaDate = new Date(slot.hora_inicio);
            const horaInicio = extractHourFromTime(horaDate);
            const rangoKey = `${horaInicio.toString().padStart(2, '0')}:00-${(horaInicio + 1).toString().padStart(2, '0')}:00`;
            if (!rangosPorHora.has(rangoKey)) {
                rangosPorHora.set(rangoKey, []);
            }
            rangosPorHora.get(rangoKey)!.push(slot);
        }

        const rangosArray = Array.from(rangosPorHora.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        // Determinar rango seleccionado
        let rangoSeleccionado: [string, typeof slotsFiltrados] | undefined;
        const numero = parseInt(input.trim());

        if (!isNaN(numero) && numero >= 1 && numero <= rangosArray.length) {
            rangoSeleccionado = rangosArray[numero - 1];
        } else {
            // Intentar por nombre del rango (ej: "13:00-14:00")
            rangoSeleccionado = rangosArray.find(([rango]) =>
                input.includes(rango) || rango.includes(input.trim())
            );
        }

        if (!rangoSeleccionado) {
            return {
                mensaje: `No entendi tu seleccion. Por favor, escribe un numero del 1 al ${rangosArray.length}.`,
                accion: 'SELECCIONAR_HORA_RANGO_RETRY',
            };
        }

        const [rangoKey, slotsDelRango] = rangoSeleccionado;

        // Guardar rango y pasar a selección de slot
        state.step = 'SELECCIONAR_SLOT';
        state.horaRango = rangoKey;
        this.conversationStates.set(sessionId, state);

        const listaHorarios = slotsDelRango.map((slot, idx) => {
            const horaDate = new Date(slot.hora_inicio);
            const horas = extractHourFromTime(horaDate).toString().padStart(2, '0');
            const minutos = extractMinuteFromTime(horaDate).toString().padStart(2, '0');
            const horaInicio = `${horas}:${minutos}`;
            return `${idx + 1}. ${horaInicio} - ${slot.sede?.nombre || 'Sede Principal'}`;
        }).join('\n');

        return {
            mensaje: `Rango ${rangoKey} seleccionado.\n\nHorarios disponibles:\n\n${listaHorarios}\n\nEscribe el numero del horario que prefieras.`,
            opciones: slotsDelRango.map(s => {
                const horaDate = new Date(s.hora_inicio);
                const horas = extractHourFromTime(horaDate).toString().padStart(2, '0');
                const minutos = extractMinuteFromTime(horaDate).toString().padStart(2, '0');
                return {
                    id: s.codigo_slot,
                    hora: `${horas}:${minutos}`,
                    sede: s.sede?.nombre || 'Sede Principal',
                };
            }),
            accion: 'SELECCIONAR_SLOT',
        };
    }

    /**
     * Muestra las categorías de exámenes disponibles
     */
    async mostrarCategoriasExamenes(sessionId: string): Promise<{
        mensaje: string;
        opciones?: any[];
        accion: string;
    }> {
        const categorias = await this.prisma.categoriaExamen.findMany({
            where: { activo: true },
            select: {
                codigo_categoria: true,
                nombre: true,
                _count: {
                    select: { examenes: { where: { activo: true } } }
                }
            },
            orderBy: { nombre: 'asc' },
        });

        const categoriasConExamenes = categorias.filter(c => c._count.examenes > 0);

        if (categoriasConExamenes.length === 0) {
            return {
                mensaje: 'No hay categorias de examenes disponibles.',
                accion: 'ERROR',
            };
        }

        const state = this.conversationStates.get(sessionId);
        const examenesYaSeleccionados = state?.examenesSeleccionados || [];
        let mensajeExamenes = '';

        if (examenesYaSeleccionados.length > 0) {
            const total = examenesYaSeleccionados.reduce((sum, e) => sum + Number(e.precio), 0);
            mensajeExamenes = `\nExamenes seleccionados (${examenesYaSeleccionados.length}):\n${examenesYaSeleccionados.map(e => `  - ${e.nombre}: $${e.precio}`).join('\n')}\n  Total: $${total}\n`;
        }

        const listaCategorias = categoriasConExamenes
            .map((c, idx) => `${idx + 1}. ${c.nombre} (${c._count.examenes} examenes)`)
            .join('\n');

        const opcionContinuar = examenesYaSeleccionados.length > 0
            ? '\n\nEscribe "continuar" para pasar a seleccionar fecha y hora.'
            : '';

        return {
            mensaje: `Para tu cita de Toma de Muestras, selecciona los examenes que necesitas.${mensajeExamenes}\n\nCategorias disponibles:\n\n${listaCategorias}${opcionContinuar}\n\nEscribe el numero de la categoria para ver los examenes.`,
            opciones: categoriasConExamenes.map(c => ({ id: c.codigo_categoria, nombre: c.nombre })),
            accion: 'SELECCIONAR_CATEGORIA',
        };
    }

    /**
     * Procesa la selección de categoría y muestra exámenes
     */
    async seleccionarCategoriaExamen(sessionId: string, input: string): Promise<{
        mensaje: string;
        opciones?: any[];
        accion: string;
    }> {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'SELECCIONAR_CATEGORIA') {
            return { mensaje: 'Por favor, inicia el proceso de agendamiento escribiendo "agendar cita".', accion: 'REINICIAR' };
        }

        // Verificar si quiere continuar
        if (/^(continuar|siguiente|listo|ok)$/i.test(input.trim())) {
            if (!state.examenesSeleccionados || state.examenesSeleccionados.length === 0) {
                return {
                    mensaje: 'Debes seleccionar al menos un examen para continuar. Escribe el numero de una categoria.',
                    accion: 'SELECCIONAR_CATEGORIA_RETRY',
                };
            }
            // Pasar a selección de fecha
            return this.continuarAFechas(sessionId);
        }

        const categorias = await this.prisma.categoriaExamen.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' },
        });

        const categoriasConExamenes = categorias.filter(async c => {
            const count = await this.prisma.examen.count({ where: { codigo_categoria: c.codigo_categoria, activo: true } });
            return count > 0;
        });

        let categoriaSeleccionada: typeof categorias[0] | undefined;

        const numero = parseInt(input);
        if (!isNaN(numero) && numero > 0 && numero <= categorias.length) {
            categoriaSeleccionada = categorias[numero - 1];
        } else {
            categoriaSeleccionada = categorias.find(c =>
                c.nombre.toLowerCase().includes(input.toLowerCase())
            );
        }

        if (!categoriaSeleccionada) {
            return {
                mensaje: 'No encontre esa categoria. Escribe el numero o nombre de la categoria.',
                accion: 'SELECCIONAR_CATEGORIA_RETRY',
            };
        }

        // Guardar categoría seleccionada y mostrar exámenes
        state.categoriaId = categoriaSeleccionada.codigo_categoria;
        state.step = 'SELECCIONAR_EXAMENES';
        this.conversationStates.set(sessionId, state);

        return this.mostrarExamenesCategoria(sessionId, categoriaSeleccionada.codigo_categoria);
    }

    /**
     * Muestra los exámenes de una categoría
     */
    async mostrarExamenesCategoria(sessionId: string, categoriaId: number): Promise<{
        mensaje: string;
        opciones?: any[];
        accion: string;
    }> {
        const categoria = await this.prisma.categoriaExamen.findUnique({
            where: { codigo_categoria: categoriaId },
        });

        const examenes = await this.prisma.examen.findMany({
            where: {
                codigo_categoria: categoriaId,
                activo: true,
            },
            select: {
                codigo_examen: true,
                nombre: true,
                precios: {
                    where: { activo: true },
                    orderBy: { fecha_inicio: 'desc' },
                    take: 1,
                    select: { precio: true }
                }
            },
            orderBy: { nombre: 'asc' },
        });

        const state = this.conversationStates.get(sessionId);
        const examenesYaSeleccionados = state?.examenesSeleccionados || [];
        const codigosSeleccionados = examenesYaSeleccionados.map(e => e.codigo);

        const listaExamenes = examenes.map((e, idx) => {
            const precio = e.precios[0]?.precio || 0;
            const yaSeleccionado = codigosSeleccionados.includes(e.codigo_examen);
            const marca = yaSeleccionado ? ' [X]' : '';
            return `${idx + 1}. ${e.nombre}: $${precio}${marca}`;
        }).join('\n');

        let mensajeSeleccionados = '';
        if (examenesYaSeleccionados.length > 0) {
            const total = examenesYaSeleccionados.reduce((sum, e) => sum + Number(e.precio), 0);
            mensajeSeleccionados = `\n\nSeleccionados: ${examenesYaSeleccionados.length} examenes - Total: $${total}`;
        }

        return {
            mensaje: `Examenes de ${categoria?.nombre}:\n\n${listaExamenes}${mensajeSeleccionados}\n\nEscribe el numero para agregar/quitar un examen.\nEscribe "volver" para ver otras categorias.\nEscribe "continuar" cuando termines de seleccionar.`,
            opciones: examenes.map(e => ({
                id: e.codigo_examen,
                nombre: e.nombre,
                precio: e.precios[0]?.precio || 0
            })),
            accion: 'SELECCIONAR_EXAMENES',
        };
    }

    /**
     * Procesa la selección de exámenes
     */
    async seleccionarExamenes(sessionId: string, input: string): Promise<{
        mensaje: string;
        opciones?: any[];
        accion: string;
    }> {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'SELECCIONAR_EXAMENES') {
            return { mensaje: 'Por favor, inicia el proceso de agendamiento escribiendo "agendar cita".', accion: 'REINICIAR' };
        }

        // Verificar si quiere volver a categorías
        if (/^(volver|atras|categorias?)$/i.test(input.trim())) {
            state.step = 'SELECCIONAR_CATEGORIA';
            this.conversationStates.set(sessionId, state);
            return this.mostrarCategoriasExamenes(sessionId);
        }

        // Verificar si quiere continuar
        if (/^(continuar|siguiente|listo|ok)$/i.test(input.trim())) {
            if (!state.examenesSeleccionados || state.examenesSeleccionados.length === 0) {
                return {
                    mensaje: 'Debes seleccionar al menos un examen. Escribe el numero del examen que deseas.',
                    accion: 'SELECCIONAR_EXAMENES_RETRY',
                };
            }
            return this.continuarAFechas(sessionId);
        }

        // Seleccionar/deseleccionar examen
        const examenes = await this.prisma.examen.findMany({
            where: {
                codigo_categoria: state.categoriaId,
                activo: true,
            },
            select: {
                codigo_examen: true,
                nombre: true,
                precios: {
                    where: { activo: true },
                    orderBy: { fecha_inicio: 'desc' },
                    take: 1,
                    select: { precio: true }
                }
            },
            orderBy: { nombre: 'asc' },
        });

        const numero = parseInt(input);
        if (isNaN(numero) || numero < 1 || numero > examenes.length) {
            return {
                mensaje: `Escribe un numero del 1 al ${examenes.length}, "volver" para otras categorias, o "continuar" para finalizar seleccion.`,
                accion: 'SELECCIONAR_EXAMENES_RETRY',
            };
        }

        const examenSeleccionado = examenes[numero - 1];
        const precio = Number(examenSeleccionado.precios[0]?.precio || 0);

        if (!state.examenesSeleccionados) {
            state.examenesSeleccionados = [];
        }

        // Toggle: si ya está, quitar; si no, agregar
        const idx = state.examenesSeleccionados.findIndex(e => e.codigo === examenSeleccionado.codigo_examen);
        let accionRealizada: string;

        if (idx >= 0) {
            state.examenesSeleccionados.splice(idx, 1);
            accionRealizada = `Quitado: ${examenSeleccionado.nombre}`;
        } else {
            state.examenesSeleccionados.push({
                codigo: examenSeleccionado.codigo_examen,
                nombre: examenSeleccionado.nombre,
                precio: precio,
            });
            accionRealizada = `Agregado: ${examenSeleccionado.nombre} - $${precio}`;
        }

        this.conversationStates.set(sessionId, state);

        // Mostrar lista actualizada
        const resultado = await this.mostrarExamenesCategoria(sessionId, state.categoriaId!);
        resultado.mensaje = `${accionRealizada}\n\n${resultado.mensaje}`;
        return resultado;
    }

    /**
     * Continúa el flujo a selección de fechas después de elegir exámenes
     */
    async continuarAFechas(sessionId: string): Promise<{
        mensaje: string;
        opciones?: any[];
        accion: string;
    }> {
        const state = this.conversationStates.get(sessionId);
        if (!state) {
            return { mensaje: 'Por favor, inicia el proceso de agendamiento escribiendo "agendar cita".', accion: 'REINICIAR' };
        }

        // Buscar fechas disponibles
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const en14Dias = new Date(hoy);
        en14Dias.setDate(en14Dias.getDate() + 14);

        const slotsDisponibles = await this.prisma.slot.groupBy({
            by: ['fecha'],
            where: {
                codigo_servicio: state.servicioId,
                activo: true,
                cupos_disponibles: { gt: 0 },
                fecha: { gte: hoy, lte: en14Dias },
            },
            _count: { codigo_slot: true },
            orderBy: { fecha: 'asc' },
        });

        if (slotsDisponibles.length === 0) {
            return {
                mensaje: 'Lo sentimos, no hay disponibilidad en los proximos 14 dias. Por favor, contacta a nuestras sedes.',
                accion: 'NO_DISPONIBILIDAD',
            };
        }

        state.step = 'SELECCIONAR_FECHA';
        this.conversationStates.set(sessionId, state);

        const total = state.examenesSeleccionados?.reduce((sum, e) => sum + Number(e.precio), 0) || 0;
        const resumenExamenes = state.examenesSeleccionados?.map(e => `  - ${e.nombre}`).join('\n') || '';

        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
        const listaFechas = slotsDisponibles.slice(0, 7).map((slot, idx) => {
            const fecha = new Date(slot.fecha);
            const diaSemana = diasSemana[fecha.getDay()];
            const fechaStr = fecha.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
            return `${idx + 1}. ${diaSemana} ${fechaStr}`;
        }).join('\n');

        return {
            mensaje: `Examenes seleccionados:\n${resumenExamenes}\nTotal: $${total}\n\nFechas disponibles:\n\n${listaFechas}\n\nEscribe el numero de la fecha.`,
            opciones: slotsDisponibles.slice(0, 7).map(s => ({
                fecha: new Date(s.fecha).toISOString().split('T')[0],
            })),
            accion: 'SELECCIONAR_FECHA',
        };
    }

    /**
     * Procesa la selección del slot
     */
    async seleccionarSlot(sessionId: string, input: string, userId?: number): Promise<{
        mensaje: string;
        accion: string;
        requiresAuth?: boolean;
        citaResumen?: {
            servicio: string;
            fecha: string;
            hora: string;
            sede: string;
            slotId: number;
        };
    }> {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'SELECCIONAR_SLOT') {
            return { mensaje: 'Por favor, inicia el proceso de agendamiento escribiendo "agendar cita".', accion: 'REINICIAR' };
        }

        // Obtener slots disponibles
        const allSlots = await this.prisma.slot.findMany({
            where: {
                codigo_servicio: state.servicioId,
                fecha: new Date(state.fecha!),
                activo: true,
                cupos_disponibles: { gt: 0 },
            },
            include: { sede: true },
            orderBy: { hora_inicio: 'asc' },
        });

        // Filtrar por turno si está seleccionado
        let slots = state.turno ? allSlots.filter(slot => {
            const hora = extractHourFromTime(new Date(slot.hora_inicio));
            if (state.turno === 'MANANA') {
                return hora < 12;
            } else {
                return hora >= 12;
            }
        }) : allSlots;

        // Filtrar por rango de hora si está seleccionado (ej: "13:00-14:00")
        if (state.horaRango) {
            const horaRangoInicio = parseInt(state.horaRango.split(':')[0]);
            slots = slots.filter(slot => {
                const hora = extractHourFromTime(new Date(slot.hora_inicio));
                return hora === horaRangoInicio;
            });
        }

        const numero = parseInt(input);
        if (isNaN(numero) || numero < 1 || numero > slots.length) {
            return {
                mensaje: `Por favor, selecciona un numero valido del 1 al ${slots.length}.`,
                accion: 'SELECCIONAR_SLOT_RETRY',
            };
        }

        const slotSeleccionado = slots[numero - 1];
        // Extraer hora sin conversion de timezone (la BD guarda hora local)
        const horaDate = new Date(slotSeleccionado.hora_inicio);
        const horasStr = extractHourFromTime(horaDate).toString().padStart(2, '0');
        const minutosStr = extractMinuteFromTime(horaDate).toString().padStart(2, '0');
        const horaFormateada = `${horasStr}:${minutosStr}`;

        // Actualizar estado
        state.step = 'CONFIRMAR';
        state.slotId = slotSeleccionado.codigo_slot;
        state.slotHora = horaFormateada;
        state.sedeNombre = slotSeleccionado.sede?.nombre || 'Sede Principal';
        this.conversationStates.set(sessionId, state);

        const fechaFormateada = new Date(state.fecha!).toLocaleDateString('es', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });

        // Verificar si el usuario está autenticado
        if (!userId) {
            return {
                mensaje: `Resumen de tu cita:\n\nServicio: ${state.servicioNombre}\nFecha: ${fechaFormateada}\nHora: ${horaFormateada}\nSede: ${state.sedeNombre}\n\nPara confirmar tu cita, necesitas iniciar sesion.\n\nPor favor, inicia sesion en tu cuenta y vuelve a este chat para confirmar.`,
                accion: 'REQUIERE_AUTENTICACION',
                requiresAuth: true,
                citaResumen: {
                    servicio: state.servicioNombre!,
                    fecha: fechaFormateada,
                    hora: horaFormateada,
                    sede: state.sedeNombre!,
                    slotId: slotSeleccionado.codigo_slot,
                },
            };
        }

        return {
            mensaje: `Resumen de tu cita:\n\nServicio: ${state.servicioNombre}\nFecha: ${fechaFormateada}\nHora: ${horaFormateada}\nSede: ${state.sedeNombre}\n\nDeseas confirmar esta cita?\nResponde "Si" para confirmar o "No" para cancelar.`,
            accion: 'CONFIRMAR',
            citaResumen: {
                servicio: state.servicioNombre!,
                fecha: fechaFormateada,
                hora: horaFormateada,
                sede: state.sedeNombre!,
                slotId: slotSeleccionado.codigo_slot,
            },
        };
    }

    /**
     * Confirma y crea la cita
     */
    async confirmarCita(sessionId: string, confirmar: boolean, userId: number): Promise<{
        mensaje: string;
        accion: string;
        cita?: any;
    }> {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'CONFIRMAR' || !state.slotId) {
            return {
                mensaje: 'Por favor, inicia el proceso de agendamiento escribiendo "agendar cita".',
                accion: 'REINICIAR'
            };
        }

        if (!confirmar) {
            this.conversationStates.delete(sessionId);
            return {
                mensaje: 'Tu cita no ha sido agendada. ¿Hay algo más en lo que pueda ayudarte?',
                accion: 'CANCELADO',
            };
        }

        try {
            // Verificar que el slot sigue disponible
            const slot = await this.prisma.slot.findUnique({
                where: { codigo_slot: state.slotId },
                include: { servicio: true, sede: true },
            });

            if (!slot || !slot.activo || slot.cupos_disponibles <= 0) {
                this.conversationStates.delete(sessionId);
                return {
                    mensaje: 'Lo sentimos, este horario ya no esta disponible. Alguien lo reservo mientras decidias.\n\nDeseas buscar otro horario? Escribe "agendar cita" para comenzar de nuevo.',
                    accion: 'SLOT_NO_DISPONIBLE',
                };
            }

            // Verificar si el paciente ya tiene cita en ese slot
            const citaExistente = await this.prisma.cita.findFirst({
                where: {
                    codigo_slot: state.slotId,
                    codigo_paciente: userId,
                    estado: { not: 'CANCELADA' },
                },
            });

            if (citaExistente) {
                this.conversationStates.delete(sessionId);
                return {
                    mensaje: 'Ya tienes una cita agendada en este horario. ¿Deseas ver tus citas? Escribe "mis citas".',
                    accion: 'CITA_DUPLICADA',
                };
            }

            // Crear cita y cotización en transacción
            const resultado = await this.prisma.$transaction(async (prisma) => {
                // Decrementar cupos
                await prisma.slot.update({
                    where: { codigo_slot: state.slotId },
                    data: { cupos_disponibles: { decrement: 1 } },
                });

                // Crear cita
                const cita = await prisma.cita.create({
                    data: {
                        codigo_paciente: userId,
                        codigo_slot: state.slotId!,
                        estado: 'AGENDADA',
                        observaciones: state.requiereExamenes
                            ? `Cita de Toma de Muestras agendada vía chatbot - ${state.examenesSeleccionados?.length || 0} exámenes`
                            : 'Cita agendada vía chatbot',
                    },
                    include: {
                        slot: {
                            include: {
                                servicio: true,
                                sede: true,
                            },
                        },
                    },
                });

                // Si hay exámenes seleccionados, crear cotización y vincular a cita
                let cotizacion = null;
                if (state.requiereExamenes && state.examenesSeleccionados && state.examenesSeleccionados.length > 0) {
                    const total = state.examenesSeleccionados.reduce((sum, e) => sum + Number(e.precio), 0);

                    // Generar número de cotización único
                    const numeroCotizacion = `COT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

                    // Fecha de expiración: 7 días desde hoy
                    const fechaExpiracion = new Date();
                    fechaExpiracion.setDate(fechaExpiracion.getDate() + 7);

                    cotizacion = await prisma.cotizacion.create({
                        data: {
                            paciente: { connect: { codigo_usuario: userId } },
                            numero_cotizacion: numeroCotizacion,
                            fecha_expiracion: fechaExpiracion,
                            estado: 'PENDIENTE',
                            subtotal: total,
                            descuento: 0,
                            total: total,
                            observaciones: 'Cotización generada vía chatbot',
                            detalles: {
                                create: state.examenesSeleccionados.map(e => ({
                                    examen: { connect: { codigo_examen: e.codigo } },
                                    cantidad: 1,
                                    precio_unitario: e.precio,
                                    total_linea: e.precio,
                                })),
                            },
                        },
                    });

                    // Vincular cotización a la cita
                    await prisma.cita.update({
                        where: { codigo_cita: cita.codigo_cita },
                        data: { codigo_cotizacion: cotizacion.codigo_cotizacion },
                    });
                }

                return { cita, cotizacion };
            });

            const { cita, cotizacion } = resultado;

            // Limpiar estado
            this.conversationStates.delete(sessionId);

            this.logger.log(`Cita ${cita.codigo_cita} creada vía chatbot para usuario ${userId}${cotizacion ? ` con cotización #${cotizacion.codigo_cotizacion}` : ''}`);

            const fechaFormateada = new Date(slot.fecha).toLocaleDateString('es', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });

            // Construir mensaje de confirmación
            let mensajeConfirmacion = `Tu cita ha sido agendada exitosamente.\n\nCodigo de cita: #${cita.codigo_cita}\nServicio: ${slot.servicio.nombre}\nFecha: ${fechaFormateada}\nHora: ${state.slotHora}\nSede: ${slot.sede?.nombre || 'Sede Principal'}`;

            if (cotizacion && state.examenesSeleccionados) {
                const total = state.examenesSeleccionados.reduce((sum, e) => sum + Number(e.precio), 0);
                mensajeConfirmacion += `\n\nExamenes solicitados (${state.examenesSeleccionados.length}):\n${state.examenesSeleccionados.map(e => `  - ${e.nombre}: $${e.precio}`).join('\n')}\nTotal a pagar: $${total}\nCotizacion: #${cotizacion.codigo_cotizacion}`;
            }

            mensajeConfirmacion += '\n\nRecibiras un correo de confirmacion.\nRecuerda llegar 15 minutos antes de tu cita.\n\nHay algo mas en lo que pueda ayudarte?';

            return {
                mensaje: mensajeConfirmacion,
                accion: 'CITA_CREADA',
                cita,
            };
        } catch (error) {
            this.logger.error('Error al crear cita via chatbot', error);
            this.conversationStates.delete(sessionId);
            return {
                mensaje: 'Ocurrió un error al agendar tu cita. Por favor, intenta de nuevo o contacta a nuestras sedes directamente.',
                accion: 'ERROR',
            };
        }
    }

    /**
     * Obtiene las citas del paciente
     */
    async consultarMisCitas(userId: number): Promise<{
        mensaje: string;
        citas: any[];
        accion: string;
    }> {
        if (!userId) {
            return {
                mensaje: '⚠️ Para ver tus citas, necesitas iniciar sesión en tu cuenta.',
                citas: [],
                accion: 'REQUIERE_AUTENTICACION',
            };
        }

        const citas = await this.prisma.cita.findMany({
            where: {
                codigo_paciente: userId,
                estado: { in: ['AGENDADA', 'PENDIENTE', 'CONFIRMADA'] },
            },
            include: {
                slot: {
                    include: {
                        servicio: true,
                        sede: true,
                    },
                },
            },
            orderBy: {
                slot: { fecha: 'asc' },
            },
            take: 5,
        });

        if (citas.length === 0) {
            return {
                mensaje: 'No tienes citas pendientes. ¿Deseas agendar una? Escribe "agendar cita".',
                citas: [],
                accion: 'SIN_CITAS',
            };
        }

        const listaCitas = citas.map((cita) => {
            const fecha = new Date(cita.slot.fecha).toLocaleDateString('es-EC', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit'
            });
            // Extraer hora directamente sin conversion de timezone (la BD guarda hora local)
            const horaDate = new Date(cita.slot.hora_inicio);
            const horas = extractHourFromTime(horaDate).toString().padStart(2, '0');
            const minutos = extractMinuteFromTime(horaDate).toString().padStart(2, '0');
            const hora = `${horas}:${minutos}`;
            const cancelable = (cita.estado === 'AGENDADA' || cita.estado === 'PENDIENTE') ? ' [Cancelable]' : '';
            return `Cita #${cita.codigo_cita} - ${cita.slot.servicio.nombre}\nFecha: ${fecha}, Hora: ${hora}\nSede: ${cita.slot.sede?.nombre || 'Sede'} | Estado: ${cita.estado}${cancelable}`;
        }).join('\n\n');

        // Solo mostrar opcion de cancelar si hay citas que se pueden cancelar (AGENDADA o PENDIENTE)
        const citasCancelables = citas.filter(c => c.estado === 'AGENDADA' || c.estado === 'PENDIENTE');
        let mensajeCancelar = '';
        if (citasCancelables.length > 0) {
            const codigosCancelables = citasCancelables.map(c => `#${c.codigo_cita}`).join(', ');
            mensajeCancelar = `\n\nPuedes cancelar: ${codigosCancelables}\nEscribe: "cancelar cita" seguido del numero (ej: "cancelar cita ${citasCancelables[0].codigo_cita}")`;
        } else {
            mensajeCancelar = '\n\nNota: Las citas confirmadas no pueden ser canceladas desde el chat.';
        }

        return {
            mensaje: `Tus proximas citas:\n\n${listaCitas}${mensajeCancelar}`,
            citas,
            accion: 'LISTAR_CITAS',
        };
    }

    /**
     * Cancela una cita del paciente
     */
    async cancelarCita(userId: number, codigoCita: number, motivo?: string): Promise<{
        mensaje: string;
        accion: string;
    }> {
        if (!userId) {
            return {
                mensaje: '⚠️ Para cancelar una cita, necesitas iniciar sesión en tu cuenta.',
                accion: 'REQUIERE_AUTENTICACION',
            };
        }

        const cita = await this.prisma.cita.findFirst({
            where: {
                codigo_cita: codigoCita,
                codigo_paciente: userId,
            },
            include: {
                slot: {
                    include: { servicio: true },
                },
            },
        });

        if (!cita) {
            return {
                mensaje: 'No encontré esa cita. Por favor, verifica el número de cita.',
                accion: 'CITA_NO_ENCONTRADA',
            };
        }

        if (cita.estado === 'CANCELADA') {
            return {
                mensaje: 'Esta cita ya fue cancelada anteriormente.',
                accion: 'YA_CANCELADA',
            };
        }

        if (cita.estado === 'CONFIRMADA') {
            return {
                mensaje: 'Las citas confirmadas no pueden ser canceladas desde el chat. Por favor, comunicate directamente con el laboratorio.',
                accion: 'CITA_CONFIRMADA',
            };
        }

        if (cita.estado === 'COMPLETADA') {
            return {
                mensaje: 'No es posible cancelar una cita que ya fue completada.',
                accion: 'CITA_COMPLETADA',
            };
        }

        // Cancelar en transacción
        await this.prisma.$transaction(async (prisma) => {
            // Incrementar cupos
            await prisma.slot.update({
                where: { codigo_slot: cita.codigo_slot },
                data: { cupos_disponibles: { increment: 1 } },
            });

            // Actualizar cita
            await prisma.cita.update({
                where: { codigo_cita: codigoCita },
                data: {
                    estado: 'CANCELADA',
                    motivo_cancelacion: motivo || 'Cancelado vía chatbot',
                },
            });
        });

        this.logger.log(`Cita ${codigoCita} cancelada vía chatbot por usuario ${userId}`);

        return {
            mensaje: `Tu cita #${codigoCita} (${cita.slot.servicio.nombre}) ha sido cancelada exitosamente.\n\nDeseas agendar una nueva cita? Escribe "agendar cita".`,
            accion: 'CITA_CANCELADA',
        };
    }

    /**
     * Consulta disponibilidad general
     */
    async consultarDisponibilidad(servicioNombre?: string): Promise<{
        mensaje: string;
        accion: string;
    }> {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const en7Dias = new Date(hoy);
        en7Dias.setDate(en7Dias.getDate() + 7);

        let where: any = {
            activo: true,
            cupos_disponibles: { gt: 0 },
            fecha: { gte: hoy, lte: en7Dias },
        };

        if (servicioNombre) {
            const servicio = await this.prisma.servicio.findFirst({
                where: {
                    nombre: { contains: servicioNombre, mode: 'insensitive' },
                    activo: true,
                },
            });

            if (servicio) {
                where.codigo_servicio = servicio.codigo_servicio;
            }
        }

        const disponibilidad = await this.prisma.slot.groupBy({
            by: ['codigo_servicio', 'fecha'],
            where,
            _count: { codigo_slot: true },
            orderBy: { fecha: 'asc' },
        });

        if (disponibilidad.length === 0) {
            return {
                mensaje: 'No hay disponibilidad en los próximos 7 días. Por favor, contacta a nuestras sedes.',
                accion: 'SIN_DISPONIBILIDAD',
            };
        }

        // Obtener nombres de servicios
        const servicioIds = [...new Set(disponibilidad.map(d => d.codigo_servicio))];
        const servicios = await this.prisma.servicio.findMany({
            where: { codigo_servicio: { in: servicioIds } },
        });
        const servicioMap = new Map(servicios.map(s => [s.codigo_servicio, s.nombre]));

        // Agrupar por servicio
        const disponibilidadPorServicio = disponibilidad.reduce((acc, d) => {
            const nombreServicio = servicioMap.get(d.codigo_servicio) || 'Servicio';
            if (!acc[nombreServicio]) acc[nombreServicio] = [];
            acc[nombreServicio].push({
                fecha: new Date(d.fecha).toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: '2-digit' }),
                horarios: d._count.codigo_slot,
            });
            return acc;
        }, {} as Record<string, { fecha: string; horarios: number }[]>);

        let mensaje = 'Disponibilidad para los proximos 7 dias:\n\n';
        for (const [servicio, fechas] of Object.entries(disponibilidadPorServicio)) {
            mensaje += `${servicio}:\n`;
            fechas.slice(0, 3).forEach(f => {
                mensaje += `  ${f.fecha} - ${f.horarios} horarios disponibles\n`;
            });
            mensaje += '\n';
        }

        mensaje += 'Deseas agendar una cita? Escribe "agendar cita".';

        return {
            mensaje,
            accion: 'MOSTRAR_DISPONIBILIDAD',
        };
    }

    /**
     * Procesa el input del usuario en el flujo de agendamiento
     */
    async procesarInputAgendamiento(sessionId: string, input: string, userId?: number): Promise<{
        mensaje: string;
        accion: string;
        requiresAuth?: boolean;
        citaResumen?: any;
        cita?: any;
    }> {
        const state = this.conversationStates.get(sessionId);

        if (!state) {
            return this.iniciarAgendamiento(sessionId);
        }

        switch (state.step) {
            case 'SELECCIONAR_SERVICIO':
                return this.seleccionarServicio(sessionId, input);

            case 'SELECCIONAR_CATEGORIA':
                return this.seleccionarCategoriaExamen(sessionId, input);

            case 'SELECCIONAR_EXAMENES':
                return this.seleccionarExamenes(sessionId, input);

            case 'SELECCIONAR_FECHA':
                return this.seleccionarFecha(sessionId, input);

            case 'SELECCIONAR_TURNO':
                return this.seleccionarTurno(sessionId, input);

            case 'SELECCIONAR_HORA_RANGO':
                return this.seleccionarHoraRango(sessionId, input);

            case 'SELECCIONAR_SLOT':
                return this.seleccionarSlot(sessionId, input, userId);

            case 'CONFIRMAR':
                const esConfirmacion = /^(s[ií]|yes|ok|confirmar|confirmo|dale|claro)$/i.test(input.trim());
                const esNegacion = /^(no|nop|cancelar|cancelo)$/i.test(input.trim());

                if (!userId && esConfirmacion) {
                    return {
                        mensaje: '⚠️ Para confirmar tu cita, necesitas iniciar sesión primero.\n\nUna vez que inicies sesión, vuelve a este chat y escribe "confirmar" para completar tu cita.',
                        accion: 'REQUIERE_AUTENTICACION',
                        requiresAuth: true,
                    };
                }

                if (esConfirmacion || esNegacion) {
                    return this.confirmarCita(sessionId, esConfirmacion, userId!);
                }

                return {
                    mensaje: 'Por favor, responde "Sí" para confirmar tu cita o "No" para cancelar.',
                    accion: 'CONFIRMAR_RETRY',
                };

            default:
                return this.iniciarAgendamiento(sessionId);
        }
    }

    /**
     * Obtiene el estado actual de la conversación
     */
    getConversationState(sessionId: string): AgendaConversationState | undefined {
        return this.conversationStates.get(sessionId);
    }

    /**
     * Limpia el estado de conversación
     */
    clearConversationState(sessionId: string): void {
        this.conversationStates.delete(sessionId);
    }
}
