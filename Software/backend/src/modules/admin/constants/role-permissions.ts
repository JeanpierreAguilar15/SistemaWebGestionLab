/**
 * Sistema de permisos basado en niveles de acceso
 * Nivel 1 = Mínimo acceso
 * Nivel 10 = Máximo acceso (Administrador total)
 */

export interface RolePermissions {
  nivel: number;
  nombre_sugerido: string;
  descripcion: string;
  permisos: string[];
}

export const ROLE_PERMISSIONS: Record<number, RolePermissions> = {
  1: {
    nivel: 1,
    nombre_sugerido: 'Paciente',
    descripcion: 'Usuario con acceso mínimo, solo puede ver sus propios resultados y citas',
    permisos: [
      'Ver resultados propios',
      'Agendar citas',
      'Ver citas propias',
      'Solicitar cotizaciones',
      'Ver cotizaciones propias',
      'Actualizar perfil propio',
    ],
  },
  2: {
    nivel: 2,
    nombre_sugerido: 'Paciente VIP',
    descripcion: 'Paciente con acceso preferencial',
    permisos: [
      'Todos los permisos de nivel 1',
      'Prioridad en agendamiento',
      'Descargar resultados en PDF',
      'Historial completo de exámenes',
    ],
  },
  3: {
    nivel: 3,
    nombre_sugerido: 'Recepcionista',
    descripcion: 'Personal de recepción y atención al cliente',
    permisos: [
      'Gestionar citas de pacientes',
      'Registrar llegada de pacientes',
      'Ver información de pacientes',
      'Generar cotizaciones',
      'Procesar pagos',
      'Imprimir comprobantes',
    ],
  },
  4: {
    nivel: 4,
    nombre_sugerido: 'Recepcionista Senior',
    descripcion: 'Recepcionista con permisos adicionales',
    permisos: [
      'Todos los permisos de nivel 3',
      'Cancelar citas',
      'Modificar citas',
      'Registrar nuevos pacientes',
      'Actualizar datos de pacientes',
    ],
  },
  5: {
    nivel: 5,
    nombre_sugerido: 'Técnico de Laboratorio',
    descripcion: 'Personal técnico que procesa muestras',
    permisos: [
      'Registrar muestras',
      'Procesar muestras',
      'Ingresar resultados preliminares',
      'Ver protocolos de exámenes',
      'Gestionar inventario de reactivos',
      'Ver órdenes de trabajo',
    ],
  },
  6: {
    nivel: 6,
    nombre_sugerido: 'Bioanalista',
    descripcion: 'Profesional que valida y verifica resultados',
    permisos: [
      'Todos los permisos de nivel 5',
      'Validar resultados',
      'Firmar resultados',
      'Solicitar repetición de análisis',
      'Generar informes técnicos',
    ],
  },
  7: {
    nivel: 7,
    nombre_sugerido: 'Médico',
    descripcion: 'Médico con acceso a resultados y evaluación',
    permisos: [
      'Ver resultados de pacientes',
      'Solicitar exámenes',
      'Ver historial médico completo',
      'Generar órdenes médicas',
      'Interpretar resultados',
      'Contactar pacientes',
    ],
  },
  8: {
    nivel: 8,
    nombre_sugerido: 'Coordinador / Supervisor',
    descripcion: 'Supervisor de área con permisos de gestión',
    permisos: [
      'Todos los permisos de niveles inferiores',
      'Gestionar horarios del personal',
      'Ver reportes de productividad',
      'Aprobar/rechazar solicitudes',
      'Gestionar inventario completo',
      'Configurar servicios y sedes',
    ],
  },
  9: {
    nivel: 9,
    nombre_sugerido: 'Gerente',
    descripcion: 'Gerencia con acceso a gestión administrativa',
    permisos: [
      'Todos los permisos de nivel 8',
      'Gestionar usuarios (crear, editar)',
      'Ver reportes financieros',
      'Configurar precios y paquetes',
      'Gestionar proveedores',
      'Acceder a logs de auditoría',
      'Exportar datos',
    ],
  },
  10: {
    nivel: 10,
    nombre_sugerido: 'Administrador',
    descripcion: 'Acceso total al sistema - Super administrador',
    permisos: [
      'Acceso total al sistema',
      'Gestionar roles y permisos',
      'Eliminar registros',
      'Configuración del sistema',
      'Gestión de seguridad',
      'Backup y restauración',
      'Ver y modificar cualquier dato',
      'Acceso a configuración avanzada',
    ],
  },
};

/**
 * Obtiene los permisos para un nivel específico
 */
export function getPermissionsForLevel(nivel: number): RolePermissions | null {
  return ROLE_PERMISSIONS[nivel] || null;
}

/**
 * Obtiene todos los niveles disponibles
 */
export function getAllRoleLevels(): RolePermissions[] {
  return Object.values(ROLE_PERMISSIONS);
}

/**
 * Valida si un nivel de acceso es válido
 */
export function isValidAccessLevel(nivel: number): boolean {
  return nivel >= 1 && nivel <= 10;
}

/**
 * Obtiene una descripción resumida de los permisos
 */
export function getPermissionsSummary(nivel: number): string {
  const permissions = getPermissionsForLevel(nivel);
  if (!permissions) return 'Nivel inválido';

  return `${permissions.nombre_sugerido} (${permissions.permisos.length} permisos)`;
}
