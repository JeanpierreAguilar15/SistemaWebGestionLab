'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'

interface Cita {
  codigo_cita: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  servicio: string
  sede: string
  estado: string
  confirmada: boolean
  observaciones?: string
}

interface Servicio {
  codigo_servicio: number
  nombre: string
  duracion_estimada_minutos: number
  requiere_preparacion: boolean
  instrucciones_preparacion?: string
}

interface Slot {
  codigo_slot: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  cupos_disponibles: number
}

export default function CitasPage() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const searchParams = useSearchParams()
  const cotizacionParam = searchParams.get('cotizacion')

  const [loading, setLoading] = useState(false)
  const [citas, setCitas] = useState<Cita[]>([])
  const [showAgendarModal, setShowAgendarModal] = useState(false)
  const [showCancelarModal, setShowCancelarModal] = useState(false)
  const [showReprogramarModal, setShowReprogramarModal] = useState(false)
  const [selectedCita, setSelectedCita] = useState<Cita | null>(null)

  // Para agendar nueva cita
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedServicio, setSelectedServicio] = useState('')
  const [selectedFecha, setSelectedFecha] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [observaciones, setObservaciones] = useState('')

  // Para reprogramar
  const [reprogramarFecha, setReprogramarFecha] = useState('')
  const [reprogramarSlot, setReprogramarSlot] = useState('')
  const [slotsReprogramar, setSlotsReprogramar] = useState<Slot[]>([])

  // Para cancelar
  const [motivoCancelacion, setMotivoCancelacion] = useState('')

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (accessToken) {
      loadCitas()
      loadServicios()
    }
  }, [accessToken])

  useEffect(() => {
    if (cotizacionParam) {
      setShowAgendarModal(true)
      setObservaciones(`Cotización: ${cotizacionParam}`)
    }
  }, [cotizacionParam])

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    try {
      if (isoString.includes('T')) {
        const date = new Date(isoString);
        return date.toLocaleTimeString('es-EC', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'UTC' // Usar UTC porque la fecha base es 1970-01-01
        });
      }
      return isoString.substring(0, 5);
    } catch (e) {
      return isoString;
    }
  }

  const loadCitas = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/citas/my`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Map backend response to Cita interface
        const mappedCitas = data.map((item: any) => ({
          codigo_cita: item.codigo_cita,
          fecha: item.slot.fecha,
          hora_inicio: formatTime(item.slot.hora_inicio),
          hora_fin: formatTime(item.slot.hora_fin),
          servicio: item.slot.servicio.nombre,
          sede: item.slot.sede.nombre,
          estado: item.estado,
          confirmada: item.estado === 'CONFIRMADA', // Assuming 'CONFIRMADA' is a state or derived
          observaciones: item.observaciones
        }))
        setCitas(mappedCitas)
      }
    } catch (error) {
      console.error('Error loading citas:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadServicios = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/services`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setServicios(data)
      }
    } catch (error) {
      console.error('Error loading servicios:', error)
    }
  }

  const loadSlots = async (servicioId: string, fecha: string) => {
    if (!servicioId || !fecha) return

    try {
      const fechaDesde = `${fecha}T00:00:00`
      const fechaHasta = `${fecha}T23:59:59`

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/agenda/slots/available?codigo_servicio=${servicioId}&fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSlots(data)
      }
    } catch (error) {
      console.error('Error loading slots:', error)
    }
  }

  useEffect(() => {
    if (selectedServicio && selectedFecha) {
      loadSlots(selectedServicio, selectedFecha)
    }
  }, [selectedServicio, selectedFecha])

  useEffect(() => {
    if (showReprogramarModal && selectedCita && reprogramarFecha) {
      loadSlotsReprogramar(reprogramarFecha)
    }
  }, [reprogramarFecha, showReprogramarModal])

  const loadSlotsReprogramar = async (fecha: string) => {
    if (!selectedCita) return

    try {
      // Necesitamos el codigo_servicio de la cita actual
      // Buscamos el servicio por nombre en la lista de servicios cargados (si es posible)
      // O asumimos que el backend nos da el ID, pero en la interfaz Cita solo tenemos el nombre del servicio.
      // Idealmente la Cita debería tener codigo_servicio.
      // Por ahora, intentaremos encontrar el servicio en la lista 'servicios' que coincida con el nombre
      const servicio = servicios.find(s => s.nombre === selectedCita.servicio);
      const codigoServicio = servicio ? servicio.codigo_servicio : '';

      const fechaDesde = `${fecha}T00:00:00`
      const fechaHasta = `${fecha}T23:59:59`

      let url = `${process.env.NEXT_PUBLIC_API_URL}/agenda/slots/available?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`
      if (codigoServicio) {
        url += `&codigo_servicio=${codigoServicio}`
      }

      const response = await fetch(
        url,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSlotsReprogramar(data)
      }
    } catch (error) {
      console.error('Error loading slots:', error)
    }
  }

  const handleAgendarCita = async () => {
    if (!selectedSlot) {
      setMessage({ type: 'error', text: 'Debes seleccionar un horario' })
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/citas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          codigo_slot: parseInt(selectedSlot),
          observaciones,
          codigo_cotizacion: cotizacionParam ? parseInt(cotizacionParam) : undefined,
        }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Cita agendada correctamente' })
        setShowAgendarModal(false)
        resetAgendarForm()
        loadCitas()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al agendar la cita' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleCancelarCita = async () => {
    if (!selectedCita || !motivoCancelacion) {
      setMessage({ type: 'error', text: 'Debes ingresar el motivo de cancelación' })
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/citas/${selectedCita.codigo_cita}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          motivo_cancelacion: motivoCancelacion,
        }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Cita cancelada correctamente' })
        setShowCancelarModal(false)
        setMotivoCancelacion('')
        setSelectedCita(null)
        loadCitas()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al cancelar la cita' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleReprogramarCita = async () => {
    if (!selectedCita || !reprogramarSlot) {
      setMessage({ type: 'error', text: 'Debes seleccionar un nuevo horario' })
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/citas/${selectedCita.codigo_cita}/reschedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          codigo_slot: parseInt(reprogramarSlot),
        }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Cita reprogramada correctamente' })
        setShowReprogramarModal(false)
        setReprogramarFecha('')
        setReprogramarSlot('')
        setSlotsReprogramar([])
        setSelectedCita(null)
        loadCitas()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al reprogramar la cita' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleConfirmarCita = async (codigo_cita: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/citas/${codigo_cita}/confirmar`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Cita confirmada correctamente' })
        loadCitas()
      } else {
        setMessage({ type: 'error', text: 'Error al confirmar la cita' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const resetAgendarForm = () => {
    setSelectedServicio('')
    setSelectedFecha('')
    setSelectedSlot('')
    setObservaciones('')
    setSlots([])
  }

  const getEstadoBadge = (estado: string, confirmada: boolean) => {
    if (estado === 'CANCELADA') return 'lab-badge-danger'
    if (estado === 'COMPLETADA') return 'lab-badge-success'
    if (confirmada) return 'lab-badge-info'
    return 'lab-badge-warning'
  }

  const getEstadoText = (estado: string, confirmada: boolean) => {
    if (estado === 'CANCELADA') return 'Cancelada'
    if (estado === 'COMPLETADA') return 'Completada'
    if (confirmada) return 'Confirmada'
    return 'Pendiente'
  }

  const citasFuturas = citas.filter((c) => new Date(c.fecha) >= new Date() && c.estado !== 'CANCELADA')
  const citasPasadas = citas.filter((c) => new Date(c.fecha) < new Date() || c.estado === 'CANCELADA')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-lab-neutral-900">Mis Citas</h1>
        <p className="text-lab-neutral-600 mt-2">
          Consulta y gestiona tus citas de laboratorio. Para agendar una nueva cita, primero genera una cotización.
        </p>
      </div>

      {/* Mensaje */}
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

      {/* Citas Próximas */}
      <Card>
        <CardHeader>
          <CardTitle>Próximas Citas</CardTitle>
          <CardDescription>Tus citas programadas</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
            </div>
          ) : citasFuturas.length === 0 ? (
            <div className="text-center py-8 text-lab-neutral-500">
              No tienes citas programadas
            </div>
          ) : (
            <div className="space-y-4">
              {citasFuturas.map((cita) => (
                <div
                  key={cita.codigo_cita}
                  className="flex items-start space-x-4 p-4 rounded-lg border border-lab-neutral-200 hover:border-lab-primary-300 transition-colors"
                >
                  <div className="bg-lab-primary-600 text-white rounded-lg p-3 flex flex-col items-center justify-center min-w-[70px]">
                    <span className="text-2xl font-bold">{new Date(cita.fecha).getDate()}</span>
                    <span className="text-xs uppercase">
                      {new Date(cita.fecha).toLocaleDateString('es-EC', { month: 'short' })}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-lab-neutral-900 mb-1">{cita.servicio}</h4>
                        <p className="text-sm text-lab-neutral-600">
                          {cita.hora_inicio} - {cita.hora_fin} • {cita.sede}
                        </p>
                        {cita.observaciones && (
                          <p className="text-sm text-lab-neutral-500 mt-2">{cita.observaciones}</p>
                        )}
                      </div>
                      <span className={getEstadoBadge(cita.estado, cita.confirmada)}>
                        {getEstadoText(cita.estado, cita.confirmada)}
                      </span>
                    </div>
                    <div className="flex space-x-2 mt-3">
                      {!cita.confirmada && (cita.estado === 'PENDIENTE' || cita.estado === 'AGENDADA') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfirmarCita(cita.codigo_cita)}
                        >
                          Confirmar
                        </Button>
                      )}
                      {(cita.estado === 'PENDIENTE' || cita.estado === 'AGENDADA') && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCita(cita)
                              setShowReprogramarModal(true)
                            }}
                          >
                            Reprogramar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-lab-danger-600 hover:bg-lab-danger-50"
                            onClick={() => {
                              setSelectedCita(cita)
                              setShowCancelarModal(true)
                            }}
                          >
                            Cancelar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de Citas */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Citas</CardTitle>
          <CardDescription>Citas pasadas y canceladas</CardDescription>
        </CardHeader>
        <CardContent>
          {citasPasadas.length === 0 ? (
            <div className="text-center py-8 text-lab-neutral-500">
              No tienes citas en el historial
            </div>
          ) : (
            <div className="space-y-3">
              {citasPasadas.slice(0, 5).map((cita) => (
                <div
                  key={cita.codigo_cita}
                  className="flex items-center justify-between p-3 rounded-lg bg-lab-neutral-50"
                >
                  <div>
                    <h4 className="font-medium text-lab-neutral-900">{cita.servicio}</h4>
                    <p className="text-sm text-lab-neutral-600">
                      {formatDate(new Date(cita.fecha))} • {cita.hora_inicio}
                    </p>
                  </div>
                  <span className={getEstadoBadge(cita.estado, cita.confirmada)}>
                    {getEstadoText(cita.estado, cita.confirmada)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Agendar Cita */}
      {showAgendarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-lab-neutral-900">Agendar Nueva Cita</h2>
                <button
                  onClick={() => {
                    setShowAgendarModal(false)
                    resetAgendarForm()
                  }}
                  className="text-lab-neutral-400 hover:text-lab-neutral-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="servicio">Servicio *</Label>
                  <select
                    id="servicio"
                    value={selectedServicio}
                    onChange={(e) => setSelectedServicio(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-lab-neutral-300 focus:outline-none focus:ring-2 focus:ring-lab-primary-500"
                  >
                    <option value="">Selecciona un servicio</option>
                    {servicios.map((servicio) => (
                      <option key={servicio.codigo_servicio} value={servicio.codigo_servicio}>
                        {servicio.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedServicio && (
                  <>
                    {servicios.find((s) => s.codigo_servicio === parseInt(selectedServicio))?.requiere_preparacion && (
                      <div className="p-4 bg-lab-warning-50 border border-lab-warning-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-lab-warning-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <h4 className="font-semibold text-lab-warning-900">Requiere Preparación</h4>
                            <p className="text-sm text-lab-warning-800 mt-1">
                              {servicios.find((s) => s.codigo_servicio === parseInt(selectedServicio))?.instrucciones_preparacion}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="fecha">Fecha *</Label>
                      <Input
                        id="fecha"
                        type="date"
                        value={selectedFecha}
                        onChange={(e) => setSelectedFecha(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </>
                )}

                {selectedFecha && slots.length > 0 && (
                  <div className="space-y-4">
                    <Label>Horario Disponible *</Label>

                    {/* Mañana */}
                    {slots.some(s => parseInt(formatTime(s.hora_inicio).split(':')[0]) < 12) && (
                      <div>
                        <h4 className="text-sm font-medium text-lab-neutral-500 mb-2">Mañana</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {slots.filter(s => parseInt(formatTime(s.hora_inicio).split(':')[0]) < 12).map((slot) => (
                            <button
                              key={slot.codigo_slot}
                              onClick={() => setSelectedSlot(slot.codigo_slot.toString())}
                              className={`p-2 rounded-lg border text-sm font-medium transition-colors ${selectedSlot === slot.codigo_slot.toString()
                                ? 'border-lab-primary-500 bg-lab-primary-50 text-lab-primary-700'
                                : 'border-lab-neutral-200 hover:border-lab-primary-300 hover:bg-lab-neutral-50'
                                }`}
                            >
                              {formatTime(slot.hora_inicio)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tarde */}
                    {slots.some(s => parseInt(formatTime(s.hora_inicio).split(':')[0]) >= 12) && (
                      <div>
                        <h4 className="text-sm font-medium text-lab-neutral-500 mb-2">Tarde</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {slots.filter(s => parseInt(formatTime(s.hora_inicio).split(':')[0]) >= 12).map((slot) => (
                            <button
                              key={slot.codigo_slot}
                              onClick={() => setSelectedSlot(slot.codigo_slot.toString())}
                              className={`p-2 rounded-lg border text-sm font-medium transition-colors ${selectedSlot === slot.codigo_slot.toString()
                                ? 'border-lab-primary-500 bg-lab-primary-50 text-lab-primary-700'
                                : 'border-lab-neutral-200 hover:border-lab-primary-300 hover:bg-lab-neutral-50'
                                }`}
                            >
                              {formatTime(slot.hora_inicio)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedFecha && slots.length === 0 && (
                  <div className="text-center py-4 text-lab-neutral-500">
                    No hay horarios disponibles para esta fecha
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <textarea
                    id="observaciones"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md border border-lab-neutral-300 focus:outline-none focus:ring-2 focus:ring-lab-primary-500"
                    placeholder="Información adicional (opcional)"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAgendarModal(false)
                      resetAgendarForm()
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleAgendarCita} disabled={!selectedSlot}>
                    Agendar Cita
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar Cita */}
      {showCancelarModal && selectedCita && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-lab-neutral-900">Cancelar Cita</h2>
                <button
                  onClick={() => {
                    setShowCancelarModal(false)
                    setMotivoCancelacion('')
                    setSelectedCita(null)
                  }}
                  className="text-lab-neutral-400 hover:text-lab-neutral-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-lab-neutral-50 rounded-lg">
                  <h4 className="font-semibold text-lab-neutral-900">{selectedCita.servicio}</h4>
                  <p className="text-sm text-lab-neutral-600 mt-1">
                    {formatDate(new Date(selectedCita.fecha))} • {selectedCita.hora_inicio}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="motivo">Motivo de Cancelación *</Label>
                  <textarea
                    id="motivo"
                    value={motivoCancelacion}
                    onChange={(e) => setMotivoCancelacion(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md border border-lab-neutral-300 focus:outline-none focus:ring-2 focus:ring-lab-primary-500"
                    placeholder="Por favor, indícanos el motivo"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCancelarModal(false)
                      setMotivoCancelacion('')
                      setSelectedCita(null)
                    }}
                  >
                    Volver
                  </Button>
                  <Button
                    onClick={handleCancelarCita}
                    disabled={!motivoCancelacion}
                    className="bg-lab-danger-600 hover:bg-lab-danger-700"
                  >
                    Cancelar Cita
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reprogramar Cita */}
      {showReprogramarModal && selectedCita && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-lab-neutral-900">Reprogramar Cita</h2>
                <button
                  onClick={() => {
                    setShowReprogramarModal(false)
                    setReprogramarFecha('')
                    setReprogramarSlot('')
                    setSlotsReprogramar([])
                    setSelectedCita(null)
                  }}
                  className="text-lab-neutral-400 hover:text-lab-neutral-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-lab-neutral-50 rounded-lg">
                  <h4 className="font-semibold text-lab-neutral-900">{selectedCita.servicio}</h4>
                  <p className="text-sm text-lab-neutral-600 mt-1">
                    Cita actual: {formatDate(new Date(selectedCita.fecha))} • {selectedCita.hora_inicio} - {selectedCita.hora_fin}
                  </p>
                  <p className="text-sm text-lab-neutral-500 mt-1">{selectedCita.sede}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nueva_fecha">Nueva Fecha *</Label>
                  <Input
                    id="nueva_fecha"
                    type="date"
                    value={reprogramarFecha}
                    onChange={(e) => setReprogramarFecha(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {reprogramarFecha && slotsReprogramar.length > 0 && (
                  <div className="space-y-2">
                    <Label>Nuevo Horario *</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {slotsReprogramar.map((slot) => (
                        <button
                          key={slot.codigo_slot}
                          onClick={() => setReprogramarSlot(slot.codigo_slot.toString())}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${reprogramarSlot === slot.codigo_slot.toString()
                            ? 'border-lab-primary-500 bg-lab-primary-50 text-lab-primary-700'
                            : 'border-lab-neutral-200 hover:border-lab-primary-300'
                            }`}
                        >
                          {formatTime(slot.hora_inicio)}
                          <span className="block text-xs text-lab-neutral-500 mt-1">
                            {slot.cupos_disponibles} cupos
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {reprogramarFecha && slotsReprogramar.length === 0 && (
                  <div className="text-center py-4 text-lab-neutral-500">
                    No hay horarios disponibles para esta fecha
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowReprogramarModal(false)
                      setReprogramarFecha('')
                      setReprogramarSlot('')
                      setSlotsReprogramar([])
                      setSelectedCita(null)
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleReprogramarCita} disabled={!reprogramarSlot}>
                    Confirmar Reprogramación
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
