import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function validateCedulaEcuador(cedula: string): boolean {
  if (cedula.length !== 10) return false

  const digits = cedula.split('').map(Number)
  const province = parseInt(cedula.substring(0, 2))

  if (province < 1 || province > 24) return false

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let sum = 0

  for (let i = 0; i < 9; i++) {
    let value = digits[i] * coefficients[i]
    if (value >= 10) value -= 9
    sum += value
  }

  const checkDigit = sum % 10 === 0 ? 0 : 10 - (sum % 10)

  return checkDigit === digits[9]
}

export function getInitials(nombres: string, apellidos: string): string {
  const firstInitial = nombres.charAt(0).toUpperCase()
  const lastInitial = apellidos.charAt(0).toUpperCase()
  return `${firstInitial}${lastInitial}`
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export type PasswordStrength = 'weak' | 'moderate' | 'strong' | 'very-strong'

export interface PasswordStrengthResult {
  strength: PasswordStrength
  score: number
  feedback: string[]
  color: string
  label: string
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      strength: 'weak',
      score: 0,
      feedback: ['Ingresa una contraseña'],
      color: 'text-lab-neutral-400',
      label: 'Sin contraseña'
    }
  }

  let score = 0
  const feedback: string[] = []

  // Longitud
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1
  if (password.length < 8) feedback.push('Usa al menos 8 caracteres')

  // Minúsculas
  if (/[a-z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Agrega letras minúsculas')
  }

  // Mayúsculas
  if (/[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Agrega letras mayúsculas')
  }

  // Números
  if (/\d/.test(password)) {
    score += 1
  } else {
    feedback.push('Agrega números')
  }

  // Caracteres especiales
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 2
  } else {
    feedback.push('Agrega caracteres especiales (!@#$%)')
  }

  // Evaluar fortaleza
  let strength: PasswordStrength
  let color: string
  let label: string

  if (score <= 2) {
    strength = 'weak'
    color = 'text-lab-danger-600'
    label = 'Débil'
  } else if (score <= 4) {
    strength = 'moderate'
    color = 'text-lab-warning-600'
    label = 'Moderada'
  } else if (score <= 6) {
    strength = 'strong'
    color = 'text-lab-success-600'
    label = 'Fuerte'
  } else {
    strength = 'very-strong'
    color = 'text-lab-success-700'
    label = 'Muy fuerte'
  }

  return { strength, score, feedback, color, label }
}

/**
 * Valida RUC ecuatoriano (13 dígitos)
 */
export function validateRucEcuador(ruc: string): boolean {
  if (ruc.length !== 13) return false

  // Debe terminar en 001 para personas naturales o 000 para sociedades
  const suffix = ruc.substring(10, 13)
  if (suffix !== '001' && suffix !== '000') return false

  // Los primeros 10 dígitos deben pasar validación de cédula o RUC jurídico
  const baseTen = ruc.substring(0, 10)

  // Si termina en 001, validar como cédula
  if (suffix === '001') {
    return validateCedulaEcuador(baseTen)
  }

  // Si termina en 000, validar como RUC jurídico (tercer dígito debe ser 6, 7, 8, 9)
  const thirdDigit = parseInt(baseTen.charAt(2))
  if (thirdDigit < 6 || thirdDigit > 9) return false

  return true
}

/**
 * Valida formato de email (más robusto que HTML5)
 */
export function validateEmail(email: string): boolean {
  if (!email) return false

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  return emailRegex.test(email)
}

/**
 * Valida teléfono ecuatoriano (móvil o fijo)
 * Formatos aceptados:
 * - 0999999999 (10 dígitos)
 * - +593999999999 (con código país)
 * - +593 999999999 (con espacio)
 */
export function validatePhoneEcuador(phone: string): boolean {
  if (!phone) return false

  // Remover espacios y guiones
  const cleanPhone = phone.replace(/[\s-]/g, '')

  // Formato: 0999999999 (móvil) o 0299999999 (fijo)
  if (/^0[2-9]\d{8}$/.test(cleanPhone)) return true

  // Formato: +593999999999
  if (/^\+593[2-9]\d{8}$/.test(cleanPhone)) return true

  return false
}

/**
 * Valida que un número sea positivo
 */
export function validatePositiveNumber(value: number | string): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return !isNaN(num) && num >= 0
}

/**
 * Valida que un número esté dentro de un rango
 */
export function validateRange(value: number | string, min: number, max: number): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return !isNaN(num) && num >= min && num <= max
}

/**
 * Valida que una fecha no sea futura (para fecha de nacimiento)
 */
export function validateDateNotFuture(date: string | Date): boolean {
  if (!date) return false

  const inputDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return inputDate <= today
}

/**
 * Valida que una fecha no sea pasada (para agenda)
 */
export function validateDateNotPast(date: string | Date): boolean {
  if (!date) return false

  const inputDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return inputDate >= today
}

/**
 * Valida que hora inicio sea menor que hora fin
 */
export function validateTimeRange(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false

  // Convertir a minutos desde medianoche
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  return startMinutes < endMinutes
}

/**
 * Valida relaciones de stock (min < max, actual <= max)
 */
export interface StockValidationResult {
  valid: boolean
  errors: string[]
}

export function validateStockRanges(
  stockActual: number,
  stockMinimo?: number,
  stockMaximo?: number
): StockValidationResult {
  const errors: string[] = []

  // Stock actual debe ser positivo
  if (stockActual < 0) {
    errors.push('El stock actual no puede ser negativo')
  }

  // Si hay stock mínimo y máximo, validar que min < max
  if (stockMinimo !== undefined && stockMaximo !== undefined) {
    if (stockMinimo >= stockMaximo) {
      errors.push('El stock mínimo debe ser menor que el stock máximo')
    }
  }

  // Si hay stock máximo, validar que actual <= max
  if (stockMaximo !== undefined && stockActual > stockMaximo) {
    errors.push(`El stock actual (${stockActual}) no puede exceder el stock máximo (${stockMaximo})`)
  }

  // Si hay stock mínimo, validar que actual >= min (advertencia, no error crítico)
  if (stockMinimo !== undefined && stockActual < stockMinimo) {
    errors.push(`Advertencia: El stock actual (${stockActual}) está por debajo del stock mínimo (${stockMinimo})`)
  }

  return {
    valid: errors.length === 0 || (errors.length === 1 && errors[0].startsWith('Advertencia')),
    errors
  }
}

/**
 * Valida que precio de venta >= costo unitario
 */
export function validatePriceRelation(precioVenta: number, costoUnitario: number): boolean {
  if (precioVenta < 0 || costoUnitario < 0) return false

  return precioVenta >= costoUnitario
}

/**
 * Valida que valor mínimo de referencia < valor máximo
 */
export function validateReferenceRange(min?: number, max?: number): boolean {
  // Si ambos están presentes, validar relación
  if (min !== undefined && max !== undefined) {
    return min < max
  }

  // Si solo uno está presente, es válido
  return true
}
