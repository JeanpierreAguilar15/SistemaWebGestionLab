'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validateEmail, validatePhoneEcuador, validateTimeRange } from '@/lib/utils'
import { systemConfigService, SystemConfig } from '@/lib/services/system-config.service'

interface LabConfig {
  nombre: string
  email: string
  telefono: string
  direccion: string
  horaInicio: string
  horaFin: string
  duracionSlot: number
  capacidadDefecto: number
}

interface SecurityConfig {
  maxIntentos: number
  minutosBloqueo: number
}

interface BlockedUser {
  codigo_usuario: number
  cedula: string
  email: string
  nombres: string
  apellidos: string
  intentos_fallidos: number
  fecha_bloqueo: string
}

interface SystemStats {
  totalUsuarios: number
  totalCitas: number
  totalExamenes: number
  totalResultados: number
}

export default function ConfigurationPage() {
  const { accessToken } = useAuthStore()
  const [config, setConfig] = useState<LabConfig>({
    nombre: 'Laboratorio Clínico Franz',
    email: 'contacto@labfranz.com',
    telefono: '+593 2 234 5678',
    direccion: 'Av. Principal 123, Quito, Ecuador',
    horaInicio: '08:00',
    horaFin: '18:00',
    duracionSlot: 30,
    capacidadDefecto: 5,
  })

  const [stats, setStats] = useState<SystemStats>({
    totalUsuarios: 0,
    totalCitas: 0,
    totalExamenes: 0,
    totalResultados: 0,
  })

  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [tempConfig, setTempConfig] = useState<LabConfig>(config)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStats, setLoadingStats] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([])

  // Security config state
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>({ maxIntentos: 5, minutosBloqueo: 5 })
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [maxIntentosInput, setMaxIntentosInput] = useState('5')
  const [minutosBloqueoInput, setMinutosBloqueoInput] = useState('5')
  const [savingSecurity, setSavingSecurity] = useState(false)

  useEffect(() => {
    loadConfigurations()
    loadSystemStats()
    loadSecurityConfig()
  }, [])

  const loadSecurityConfig = async () => {
    try {
      const [securityRes, blockedRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/config/security`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/blocked`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ])

      if (securityRes.ok) {
        const data = await securityRes.json()
        setSecurityConfig({ maxIntentos: data.maxIntentos, minutosBloqueo: data.minutosBloqueo })
        setMaxIntentosInput(data.maxIntentos.toString())
        setMinutosBloqueoInput(data.minutosBloqueo.toString())
      }

      if (blockedRes.ok) {
        const data = await blockedRes.json()
        setBlockedUsers(data)
      }
    } catch (error) {
      console.error('Error loading security config:', error)
    }
  }

  const initSecurityConfigs = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/config/security/init`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      await loadSecurityConfig()
      setMessage({ type: 'success', text: 'Configuración de seguridad inicializada' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al inicializar configuración' })
    }
  }

  const saveSecurityConfig = async (clave: string, valor: string) => {
    setSavingSecurity(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/config/${clave}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ valor }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Configuración de seguridad actualizada' })
        await loadSecurityConfig()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al guardar' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar configuración' })
    } finally {
      setSavingSecurity(false)
    }
  }

  const unlockUser = async (codigoUsuario: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/${codigoUsuario}/unlock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Cuenta desbloqueada exitosamente' })
        await loadSecurityConfig()
      } else {
        setMessage({ type: 'error', text: 'Error al desbloquear cuenta' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al desbloquear cuenta' })
    }
  }

  const loadConfigurations = async () => {
    try {
      const configs = await systemConfigService.getAll()
      setSystemConfigs(configs)

      // Map backend configs to local state if they exist
      const newConfig = { ...config }
      configs.forEach(c => {
        if (c.clave === 'LAB_NOMBRE') newConfig.nombre = c.valor
        if (c.clave === 'LAB_EMAIL') newConfig.email = c.valor
        if (c.clave === 'LAB_TELEFONO') newConfig.telefono = c.valor
        if (c.clave === 'LAB_DIRECCION') newConfig.direccion = c.valor
        if (c.clave === 'AGENDA_HORA_INICIO') newConfig.horaInicio = c.valor
        if (c.clave === 'AGENDA_HORA_FIN') newConfig.horaFin = c.valor
        if (c.clave === 'AGENDA_DURACION_SLOT') newConfig.duracionSlot = Number(c.valor)
        if (c.clave === 'AGENDA_CAPACIDAD_DEFECTO') newConfig.capacidadDefecto = Number(c.valor)
      })
      setConfig(newConfig)
      setTempConfig(newConfig)
    } catch (error) {
      console.error('Error loading configurations:', error)
    }
  }

  const loadSystemStats = async () => {
    try {
      setLoadingStats(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/dashboard/stats`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.ok) {
        const data = await response.json()
        setStats({
          totalUsuarios: data.users.total,
          totalCitas: data.appointments.total,
          totalExamenes: data.exams.total,
          totalResultados: data.results.pending + data.appointments.completed,
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const updateConfigValue = async (key: string, value: string, group: string, type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' = 'STRING', isPublic: boolean = false) => {
    const existing = systemConfigs.find(c => c.clave === key)
    if (existing) {
      await systemConfigService.update(existing.codigo_config, { valor: value })
    } else {
      await systemConfigService.create({
        clave: key,
        valor: value,
        grupo: group,
        tipo_dato: type,
        es_publico: isPublic
      })
    }
  }

  const handleSaveSection = async (section: string) => {
    setIsLoading(true)
    try {
      if (section === 'general') {
        if (tempConfig.nombre.trim().length < 3) throw new Error('El nombre debe tener al menos 3 caracteres')
        if (!validateEmail(tempConfig.email)) throw new Error('Email inválido')
        if (!validatePhoneEcuador(tempConfig.telefono)) throw new Error('Teléfono inválido')
        if (tempConfig.direccion.trim().length < 10) throw new Error('Dirección muy corta')

        await Promise.all([
          updateConfigValue('LAB_NOMBRE', tempConfig.nombre, 'GENERAL', 'STRING', true),
          updateConfigValue('LAB_EMAIL', tempConfig.email, 'GENERAL', 'STRING', true),
          updateConfigValue('LAB_TELEFONO', tempConfig.telefono, 'GENERAL', 'STRING', true),
          updateConfigValue('LAB_DIRECCION', tempConfig.direccion, 'GENERAL', 'STRING', true),
        ])
      }

      if (section === 'appointments') {
        if (!validateTimeRange(tempConfig.horaInicio, tempConfig.horaFin)) throw new Error('Rango de horas inválido')
        if (![15, 30, 45, 60].includes(tempConfig.duracionSlot)) throw new Error('Duración de slot inválida')
        if (tempConfig.capacidadDefecto < 1 || tempConfig.capacidadDefecto > 20) throw new Error('Capacidad inválida')

        await Promise.all([
          updateConfigValue('AGENDA_HORA_INICIO', tempConfig.horaInicio, 'AGENDA', 'STRING', true),
          updateConfigValue('AGENDA_HORA_FIN', tempConfig.horaFin, 'AGENDA', 'STRING', true),
          updateConfigValue('AGENDA_DURACION_SLOT', tempConfig.duracionSlot.toString(), 'AGENDA', 'NUMBER', true),
          updateConfigValue('AGENDA_CAPACIDAD_DEFECTO', tempConfig.capacidadDefecto.toString(), 'AGENDA', 'NUMBER', true),
        ])
      }

      setConfig(tempConfig)
      setEditingSection(null)
      setMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
      await loadConfigurations() // Reload to get updated IDs if created

      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al guardar la configuración' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setTempConfig(config)
    setEditingSection(null)
  }

  const handleEdit = (section: string) => {
    setEditingSection(section)
    setTempConfig(config)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-lab-neutral-900">Configuración del Sistema</h1>
        <p className="text-lab-neutral-600 mt-1">Ajustes y configuración general del laboratorio</p>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success'
            ? 'bg-lab-success-50 text-lab-success-800 border border-lab-success-200'
            : 'bg-lab-danger-50 text-lab-danger-800 border border-lab-danger-200'
          }`}>
          {message.text}
        </div>
      )}

      {/* Configuration Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-lab-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-lab-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-lab-neutral-900">Configuración General</h2>
                <p className="text-sm text-lab-neutral-600">Datos básicos del laboratorio</p>
              </div>
            </div>
          </div>

          {editingSection === 'general' ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre del Laboratorio</Label>
                <Input
                  id="nombre"
                  value={tempConfig.nombre}
                  onChange={(e) => setTempConfig({ ...tempConfig, nombre: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email">Email de Contacto</Label>
                <Input
                  id="email"
                  type="email"
                  value={tempConfig.email}
                  onChange={(e) => setTempConfig({ ...tempConfig, email: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={tempConfig.telefono}
                  onChange={(e) => setTempConfig({ ...tempConfig, telefono: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={tempConfig.direccion}
                  onChange={(e) => setTempConfig({ ...tempConfig, direccion: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleSaveSection('general')} disabled={isLoading} className="flex-1">
                  {isLoading ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button onClick={handleCancelEdit} variant="outline" className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="py-2">
                <p className="text-xs text-lab-neutral-500">Nombre del Laboratorio</p>
                <p className="text-sm font-medium text-lab-neutral-900">{config.nombre}</p>
              </div>
              <div className="py-2">
                <p className="text-xs text-lab-neutral-500">Email de Contacto</p>
                <p className="text-sm font-medium text-lab-neutral-900">{config.email}</p>
              </div>
              <div className="py-2">
                <p className="text-xs text-lab-neutral-500">Teléfono</p>
                <p className="text-sm font-medium text-lab-neutral-900">{config.telefono}</p>
              </div>
              <div className="py-2">
                <p className="text-xs text-lab-neutral-500">Dirección</p>
                <p className="text-sm font-medium text-lab-neutral-900">{config.direccion}</p>
              </div>
              <Button onClick={() => handleEdit('general')} variant="outline" size="sm" className="w-full mt-2">
                Editar Información
              </Button>
            </div>
          )}
        </div>



        {/* Email Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-lab-secondary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-lab-neutral-900">Notificaciones</h2>
              <p className="text-sm text-lab-neutral-600">Email y mensajes automáticos</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-lab-neutral-50 rounded-lg">
              <span className="text-sm text-lab-neutral-700">Recordatorios de Citas</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-lab-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lab-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-lab-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lab-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-lab-neutral-50 rounded-lg">
              <span className="text-sm text-lab-neutral-700">Notificaciones de Resultados</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-lab-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lab-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-lab-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lab-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-lab-neutral-50 rounded-lg">
              <span className="text-sm text-lab-neutral-700">Confirmaciones de Pago</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-lab-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lab-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-lab-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lab-primary-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-lab-warning-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-lab-neutral-900">Seguridad de Login</h2>
              <p className="text-sm text-lab-neutral-600">Bloqueo temporal de cuentas</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="maxIntentos">Máximo intentos fallidos</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="maxIntentos"
                  type="number"
                  min="1"
                  max="20"
                  value={maxIntentosInput}
                  onChange={(e) => setMaxIntentosInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => saveSecurityConfig('LOGIN_MAX_INTENTOS', maxIntentosInput)}
                  disabled={savingSecurity}
                  size="sm"
                >
                  Guardar
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="minutosBloqueo">Minutos de bloqueo</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="minutosBloqueo"
                  type="number"
                  min="1"
                  max="60"
                  value={minutosBloqueoInput}
                  onChange={(e) => setMinutosBloqueoInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => saveSecurityConfig('LOGIN_MINUTOS_BLOQUEO', minutosBloqueoInput)}
                  disabled={savingSecurity}
                  size="sm"
                >
                  Guardar
                </Button>
              </div>
            </div>
            <div className="bg-lab-info-50 border border-lab-info-200 rounded-lg p-3 mt-2">
              <p className="text-xs text-lab-info-800">
                Después de <strong>{securityConfig.maxIntentos}</strong> intentos fallidos,
                la cuenta se bloqueará por <strong>{securityConfig.minutosBloqueo}</strong> minutos.
              </p>
            </div>
            {blockedUsers.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-lab-neutral-700 mb-2">
                  Cuentas bloqueadas ({blockedUsers.length})
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {blockedUsers.map((user) => (
                    <div key={user.codigo_usuario} className="flex items-center justify-between p-2 bg-lab-error-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-lab-neutral-900">{user.nombres} {user.apellidos}</p>
                        <p className="text-xs text-lab-neutral-600">{user.email}</p>
                      </div>
                      <Button
                        onClick={() => unlockUser(user.codigo_usuario)}
                        variant="outline"
                        size="sm"
                      >
                        Desbloquear
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-lab-success-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-lab-neutral-900">Configuración de Pagos</h2>
              <p className="text-sm text-lab-neutral-600">Métodos de pago aceptados</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-lab-neutral-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-lab-neutral-700">Efectivo</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-lab-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lab-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-lab-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lab-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-lab-neutral-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-lab-neutral-700">Tarjeta de Crédito/Débito</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-lab-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lab-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-lab-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lab-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-lab-neutral-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-lab-neutral-700">Transferencia Bancaria</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-lab-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lab-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-lab-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lab-primary-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-lab-neutral-900 mb-4">Estadísticas del Sistema</h2>
        {loadingStats ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-lab-primary-50 rounded-lg">
              <p className="text-3xl font-bold text-lab-primary-600">{stats.totalUsuarios}</p>
              <p className="text-sm text-lab-neutral-600 mt-1">Usuarios Registrados</p>
            </div>
            <div className="text-center p-4 bg-lab-info-50 rounded-lg">
              <p className="text-3xl font-bold text-lab-info-600">{stats.totalCitas}</p>
              <p className="text-sm text-lab-neutral-600 mt-1">Citas Totales</p>
            </div>
            <div className="text-center p-4 bg-lab-success-50 rounded-lg">
              <p className="text-3xl font-bold text-lab-success-600">{stats.totalExamenes}</p>
              <p className="text-sm text-lab-neutral-600 mt-1">Exámenes en Catálogo</p>
            </div>
            <div className="text-center p-4 bg-lab-secondary-50 rounded-lg">
              <p className="text-3xl font-bold text-lab-secondary-600">{stats.totalResultados}</p>
              <p className="text-sm text-lab-neutral-600 mt-1">Resultados Procesados</p>
            </div>
          </div>
        )}
      </div>

      {/* System Information */}
      <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-lab-neutral-900 mb-4">Información del Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-lab-neutral-500">Versión</p>
            <p className="text-lg font-semibold text-lab-neutral-900">1.0.0</p>
          </div>
          <div>
            <p className="text-sm text-lab-neutral-500">Última Actualización</p>
            <p className="text-lg font-semibold text-lab-neutral-900">2025-11-19</p>
          </div>
          <div>
            <p className="text-sm text-lab-neutral-500">Estado del Sistema</p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="w-3 h-3 bg-lab-success-500 rounded-full"></span>
              <p className="text-lg font-semibold text-lab-success-600">Operativo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
