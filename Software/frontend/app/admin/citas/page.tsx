'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, validateTimeRange } from '@/lib/utils'
import { systemConfigService } from '@/lib/services/system-config.service'

// Helper para formatear hora desde ISO date string
const formatTime = (isoString: string): string => {
  if (!isoString) return ''
  try {
    if (isoString.includes('T')) {
      const date = new Date(isoString)
      return date.toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC'
      })
    }
    return isoString.substring(0, 5)
  } catch {
    return isoString
  }
}

interface Cita {
  codigo_cita: number
  codigo_paciente: number
  codigo_slot: number
  estado: string
  observaciones: string | null
  fecha_creacion: string
  paciente: {
    nombres: string
    apellidos: string
    email: string
    telefono: string | null
  }
  slot: {
    fecha: string
    hora_inicio: string
    hora_fin: string
    servicio: {
      nombre: string
    }
  }
}

export default function CitasAdminPage() {
  const { accessToken } = useAuthStore()
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('TODAS')
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Config Modal State
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [generatingSlots, setGeneratingSlots] = useState(false)
  const [tempConfig, setTempConfig] = useState({
    horaInicio: '08:00',
    horaFin: '17:00',
    duracionSlot: 15,
    capacidadDefecto: 5,
    horaHuecoInicio: '',
    horaHuecoFin: '',
    fechaInicioGeneracion: new Date().toISOString().split('T')[0],
    fechaFinGeneracion: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
  })
  const [deletingSlots, setDeletingSlots] = useState(false)

  // ... (existing code)

  const handleDeleteSlots = async () => {
    if (!confirm('¿Estás seguro de eliminar los slots vacíos en este rango de fechas? Esta acción no se puede deshacer.')) return

    setDeletingSlots(true)
    try {
      const params = new URLSearchParams({
        startDate: tempConfig.fechaInicioGeneracion,
        endDate: tempConfig.fechaFinGeneracion
      })

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/admin/slots?${params}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setMessage({ type: 'success', text: result.message || `Slots eliminados exitosamente` })
        setShowConfigModal(false)
        loadCitas()
      } else {
        throw new Error('Error al eliminar slots')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al eliminar slots' })
    } finally {
      setDeletingSlots(false)
    }
  }

  // ... (existing code)

  const [systemConfigs, setSystemConfigs] = useState<any[]>([])

  useEffect(() => {
    if (accessToken) {
      loadCitas()
      loadConfigurations()
    }
  }, [filtro, accessToken])

  const loadCitas = async () => {
    try {
      const params = new URLSearchParams()
      if (filtro !== 'TODAS') params.append('estado', filtro)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/admin/citas?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.ok) {
        const result = await response.json()
        const citas = result.data || result
        setCitas(citas)
      }
    } catch (error) {
      console.error('Error loading citas:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadConfigurations = async () => {
    try {
      if (!accessToken) return
      const configs = await systemConfigService.getAll(accessToken)
      setSystemConfigs(configs)

      const newConfig = { ...tempConfig }
      configs.forEach(c => {
        if (c.clave === 'AGENDA_HORA_INICIO') newConfig.horaInicio = c.valor
        if (c.clave === 'AGENDA_HORA_FIN') newConfig.horaFin = c.valor
        if (c.clave === 'AGENDA_DURACION_SLOT') newConfig.duracionSlot = Number(c.valor)
        if (c.clave === 'AGENDA_CAPACIDAD_DEFECTO') newConfig.capacidadDefecto = Number(c.valor)
        if (c.clave === 'AGENDA_HUECO_INICIO') newConfig.horaHuecoInicio = c.valor
        if (c.clave === 'AGENDA_HUECO_FIN') newConfig.horaHuecoFin = c.valor
      })
      setTempConfig(newConfig)
    } catch (error) {
      console.error('Error loading configurations:', error)
    }
  }

  const updateConfigValue = async (key: string, value: string, group: string, type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' = 'STRING', isPublic: boolean = false) => {
    if (!accessToken) return
    const existing = systemConfigs.find(c => c.clave === key)
    if (existing) {
      await systemConfigService.update(existing.codigo_config, { valor: value }, accessToken)
    } else {
      await systemConfigService.create({
        clave: key,
        valor: value,
        grupo: group,
        tipo_dato: type,
        es_publico: isPublic
      }, accessToken)
    }
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      if (!validateTimeRange(tempConfig.horaInicio, tempConfig.horaFin)) throw new Error('Rango de horas inválido')
      if (tempConfig.duracionSlot < 5) throw new Error('Duración de slot inválida')
      if (tempConfig.capacidadDefecto < 1) throw new Error('Capacidad inválida')

      await Promise.all([
        updateConfigValue('AGENDA_HORA_INICIO', tempConfig.horaInicio, 'AGENDA', 'STRING', true),
        updateConfigValue('AGENDA_HORA_FIN', tempConfig.horaFin, 'AGENDA', 'STRING', true),
        updateConfigValue('AGENDA_DURACION_SLOT', tempConfig.duracionSlot.toString(), 'AGENDA', 'NUMBER', true),
        updateConfigValue('AGENDA_CAPACIDAD_DEFECTO', tempConfig.capacidadDefecto.toString(), 'AGENDA', 'NUMBER', true),
        updateConfigValue('AGENDA_HUECO_INICIO', tempConfig.horaHuecoInicio, 'AGENDA', 'STRING', true),
        updateConfigValue('AGENDA_HUECO_FIN', tempConfig.horaHuecoFin, 'AGENDA', 'STRING', true),
      ])

      setMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
      await loadConfigurations()
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al guardar la configuración' })
    } finally {
      setSavingConfig(false)
    }
  }

  const handleGenerateSlots = async () => {
    setGeneratingSlots(true)
    try {
      await handleSaveConfig()

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/admin/generate-slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          startDate: tempConfig.fechaInicioGeneracion,
          endDate: tempConfig.fechaFinGeneracion
        })
      })

      if (response.ok) {
        const result = await response.json()
        setMessage({ type: 'success', text: `Se generaron ${result.count} slots exitosamente` })
        setShowConfigModal(false)
        loadCitas()
      } else {
        throw new Error('Error al generar slots')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al generar slots' })
    } finally {
      setGeneratingSlots(false)
    }
  }

  const handleConfirm = async (codigo_cita: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/admin/citas/${codigo_cita}/confirm`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Cita confirmada correctamente' })
        loadCitas()
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al confirmar cita' })
    }
  }

  const handleUpdateEstado = async (codigo_cita: number, nuevoEstado: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/admin/citas/${codigo_cita}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: `Cita marcada como ${nuevoEstado}` })
        loadCitas()
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al actualizar cita' })
    }
  }

  const filteredCitas = citas.filter((cita) => {
    const matchSearch =
      searchTerm === '' ||
      cita.paciente.nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cita.paciente.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cita.paciente.email.toLowerCase().includes(searchTerm.toLowerCase())

    return matchSearch
  })

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE':
        return 'bg-lab-warning-100 text-lab-warning-800'
      case 'CONFIRMADA':
        return 'bg-lab-info-100 text-lab-info-800'
      case 'COMPLETADA':
        return 'bg-lab-success-100 text-lab-success-800'
      case 'CANCELADA':
        return 'bg-lab-danger-100 text-lab-danger-800'
      case 'NO_ASISTIO':
        return 'bg-lab-neutral-100 text-lab-neutral-800'
      default:
        return 'bg-lab-neutral-100 text-lab-neutral-600'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-lab-neutral-900">Gestión de Citas</h1>
        <p className="text-lab-neutral-600 mt-2">Administra todas las citas programadas del sistema</p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${message.type === 'success'
            ? 'bg-lab-success-50 text-lab-success-800 border border-lab-success-200'
            : 'bg-lab-danger-50 text-lab-danger-800 border border-lab-danger-200'
            }`}
        >
          {message.text}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Buscar Paciente</Label>
              <Input
                placeholder="Nombre, apellido o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Filtrar por Estado</Label>
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
              >
                <option value="TODAS">Todas</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="CONFIRMADA">Confirmadas</option>
                <option value="COMPLETADA">Completadas</option>
                <option value="CANCELADA">Canceladas</option>
                <option value="NO_ASISTIO">No Asistió</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Citas Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Citas ({filteredCitas.length})</CardTitle>
            <CardDescription>Lista de citas programadas</CardDescription>
          </div>
          <Button onClick={() => setShowConfigModal(true)} variant="outline">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configurar Horarios
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-lab-neutral-200">
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Paciente</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Fecha y Hora</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Servicio</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Estado</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Contacto</th>
                  <th className="text-right p-4 font-semibold text-lab-neutral-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCitas.map((cita) => (
                  <tr key={cita.codigo_cita} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                    <td className="p-4">
                      <div className="font-medium text-lab-neutral-900">
                        {cita.paciente.nombres} {cita.paciente.apellidos}
                      </div>
                      <div className="text-sm text-lab-neutral-600">{cita.paciente.email}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-lab-neutral-900">{formatDate(new Date(cita.slot.fecha))}</div>
                      <div className="text-sm text-lab-neutral-600">
                        {formatTime(cita.slot.hora_inicio)} - {formatTime(cita.slot.hora_fin)}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-lab-neutral-700">{cita.slot.servicio.nombre}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded ${getEstadoBadge(cita.estado)}`}>
                        {cita.estado}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-lab-neutral-600">{cita.paciente.telefono || 'N/A'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end space-x-2">
                        {cita.estado === 'PENDIENTE' && (
                          <Button size="sm" onClick={() => handleConfirm(cita.codigo_cita)}>
                            Confirmar
                          </Button>
                        )}
                        {cita.estado === 'CONFIRMADA' && (
                          <>
                            <Button size="sm" onClick={() => handleUpdateEstado(cita.codigo_cita, 'COMPLETADA')}>
                              Completar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateEstado(cita.codigo_cita, 'NO_ASISTIO')}
                            >
                              No Asistió
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredCitas.length === 0 && (
              <div className="text-center py-12 text-lab-neutral-500">No se encontraron citas</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-lab-neutral-900">Configuración de Horarios</h2>
              <button onClick={() => setShowConfigModal(false)} className="text-lab-neutral-400 hover:text-lab-neutral-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="horaInicio">Hora de Inicio</Label>
                  <Input
                    id="horaInicio"
                    type="time"
                    value={tempConfig.horaInicio}
                    onChange={(e) => setTempConfig({ ...tempConfig, horaInicio: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="horaFin">Hora de Fin</Label>
                  <Input
                    id="horaFin"
                    type="time"
                    value={tempConfig.horaFin}
                    onChange={(e) => setTempConfig({ ...tempConfig, horaFin: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="duracionSlot">Duración de Slot (minutos)</Label>
                <Input
                  id="duracionSlot"
                  type="number"
                  min="10"
                  step="5"
                  value={tempConfig.duracionSlot}
                  onChange={(e) => setTempConfig({ ...tempConfig, duracionSlot: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="capacidadDefecto">Capacidad por Defecto</Label>
                <Input
                  id="capacidadDefecto"
                  type="number"
                  min="1"
                  value={tempConfig.capacidadDefecto}
                  onChange={(e) => setTempConfig({ ...tempConfig, capacidadDefecto: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="horaHuecoInicio">Inicio Receso</Label>
                  <Input
                    id="horaHuecoInicio"
                    type="time"
                    value={tempConfig.horaHuecoInicio}
                    onChange={(e) => setTempConfig({ ...tempConfig, horaHuecoInicio: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="horaHuecoFin">Fin Receso</Label>
                  <Input
                    id="horaHuecoFin"
                    type="time"
                    value={tempConfig.horaHuecoFin}
                    onChange={(e) => setTempConfig({ ...tempConfig, horaHuecoFin: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Generación de Disponibilidad</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fechaInicioGeneracion">Fecha Inicio</Label>
                    <Input
                      id="fechaInicioGeneracion"
                      type="date"
                      value={tempConfig.fechaInicioGeneracion}
                      onChange={(e) => setTempConfig({ ...tempConfig, fechaInicioGeneracion: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fechaFinGeneracion">Fecha Fin</Label>
                    <Input
                      id="fechaFinGeneracion"
                      type="date"
                      value={tempConfig.fechaFinGeneracion}
                      onChange={(e) => setTempConfig({ ...tempConfig, fechaFinGeneracion: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button onClick={handleSaveConfig} disabled={savingConfig} className="flex-1">
                  {savingConfig ? 'Guardando...' : 'Guardar Configuración'}
                </Button>
                <Button onClick={handleGenerateSlots} disabled={generatingSlots} variant="secondary" className="flex-1">
                  {generatingSlots ? 'Generando...' : 'Generar Disponibilidad'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
