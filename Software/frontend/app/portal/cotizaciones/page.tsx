'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'

interface Examen {
  codigo_examen: number
  codigo_interno: string
  nombre: string
  descripcion: string
  categoria: string
  precio_actual: number
  requiere_ayuno: boolean
  requiere_preparacion_especial: boolean
  instrucciones_preparacion?: string
}

interface ExamenSeleccionado extends Examen {
  cantidad: number
  subtotal: number
}

interface DetalleCotizacion {
  codigo_detalle_cotizacion: number
  cantidad: number
  precio_unitario: number
  total_linea: number
  examen: {
    codigo_examen: number
    nombre: string
    codigo_interno: string
  }
}

interface Cotizacion {
  codigo_cotizacion: number
  numero_cotizacion: string
  fecha_cotizacion: string
  subtotal: number
  descuento: number
  total: number
  estado: string
  metodo_pago_seleccionado?: string
  detalles: DetalleCotizacion[]
  cita?: any
}

interface Slot {
  codigo_slot: number
  hora_inicio: string
  hora_fin: string
  cupos_disponibles: number
  servicio?: { nombre: string }
  sede?: { nombre: string }
}

// Helper para formatear hora desde ISO date string
const formatSlotTime = (isoString: string): string => {
  if (!isoString) return ''
  try {
    // Si viene como ISO string completo (ej: "1970-01-01T08:00:00.000Z")
    if (isoString.includes('T')) {
      const date = new Date(isoString)
      return date.toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC' // Usar UTC porque la fecha base es 1970-01-01
      })
    }
    // Si ya viene como hora simple (ej: "08:00:00")
    return isoString.substring(0, 5)
  } catch {
    return isoString
  }
}

// Helper para obtener hora como número (para agrupar)
const getHourNumber = (isoString: string): number => {
  const timeStr = formatSlotTime(isoString)
  return parseInt(timeStr.split(':')[0], 10)
}

export default function CotizacionesPage() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const router = useRouter()

  // Estados generales
  const [loading, setLoading] = useState(false)
  const [examenes, setExamenes] = useState<Examen[]>([])
  const [examenesSeleccionados, setExamenesSeleccionados] = useState<Map<number, ExamenSeleccionado>>(new Map())
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('TODAS')
  const [selectedCotizacion, setSelectedCotizacion] = useState<Cotizacion | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Estados para agendar cita
  const [showAgendarCitaModal, setShowAgendarCitaModal] = useState(false)
  const [fechaCita, setFechaCita] = useState('')
  const [observacionesCita, setObservacionesCita] = useState('')
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  // Estados para selección de método de pago
  const [showMetodoPagoModal, setShowMetodoPagoModal] = useState(false)
  const [cotizacionParaPago, setCotizacionParaPago] = useState<Cotizacion | null>(null)
  const [procesandoPago, setProcesandoPago] = useState(false)

  useEffect(() => {
    loadExamenes()
    loadCotizaciones()
  }, [])

  // Cargar slots cuando cambia la fecha
  useEffect(() => {
    if (fechaCita && showAgendarCitaModal) {
      loadSlots()
    }
  }, [fechaCita, showAgendarCitaModal])

  const loadExamenes = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/examenes/catalogo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setExamenes(data)
      }
    } catch (error) {
      console.error('Error loading examenes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCotizaciones = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cotizaciones/mis-cotizaciones`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCotizaciones(data)
      }
    } catch (error) {
      console.error('Error loading cotizaciones:', error)
    }
  }

  const loadSlots = async () => {
    try {
      setLoadingSlots(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/slots/available?fecha=${fechaCita}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (response.ok) {
        const data = await response.json()
        setAvailableSlots(data)
      }
    } catch (error) {
      console.error('Error loading slots:', error)
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleToggleExamen = (examen: Examen) => {
    const newMap = new Map(examenesSeleccionados)

    if (newMap.has(examen.codigo_examen)) {
      // Deseleccionar
      newMap.delete(examen.codigo_examen)
    } else {
      // Seleccionar con cantidad 1
      newMap.set(examen.codigo_examen, {
        ...examen,
        cantidad: 1,
        subtotal: Number(examen.precio_actual) || 0,
      })
    }

    setExamenesSeleccionados(newMap)
  }

  const handleAgendarCita = (cotizacion: Cotizacion) => {
    setSelectedCotizacion(cotizacion)
    setShowAgendarCitaModal(true)
    setFechaCita('')
    setAvailableSlots([])
    setSelectedSlot(null)
  }

  const handleConfirmarCita = async () => {
    if (!selectedSlot || !selectedCotizacion) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/citas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          codigo_slot: selectedSlot,
          codigo_cotizacion: selectedCotizacion.codigo_cotizacion,
          observaciones: observacionesCita,
        }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Cita agendada correctamente' })
        setShowAgendarCitaModal(false)
        loadCotizaciones() // Recargar para actualizar estado
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al agendar cita' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
  }

  const handleGenerarCotizacion = async () => {
    if (examenesSeleccionados.size === 0) return

    try {
      const examenes = Array.from(examenesSeleccionados.values()).map((item) => ({
        codigo_examen: item.codigo_examen,
        cantidad: 1,
      }))

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cotizaciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ examenes }),
      })

      if (response.ok) {
        const nuevaCotizacion = await response.json()
        setMessage({ type: 'success', text: 'Cotización generada exitosamente. Seleccione el método de pago.' })
        setExamenesSeleccionados(new Map())
        loadCotizaciones()
        // Mostrar modal de selección de pago
        setCotizacionParaPago(nuevaCotizacion)
        setShowMetodoPagoModal(true)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al generar cotización' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
  }

  // Abrir modal de selección de pago para cotización existente
  const handleSeleccionarPago = (cotizacion: Cotizacion) => {
    setCotizacionParaPago(cotizacion)
    setShowMetodoPagoModal(true)
  }

  // Procesar selección de método de pago
  const handleConfirmarMetodoPago = async (metodo: 'ONLINE' | 'VENTANILLA') => {
    if (!cotizacionParaPago) return

    try {
      setProcesandoPago(true)

      if (metodo === 'ONLINE') {
        // Iniciar pago con PayPhone
        const pagoResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/cotizaciones/${cotizacionParaPago.codigo_cotizacion}/payphone/iniciar`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        if (pagoResponse.ok) {
          const { paymentUrl } = await pagoResponse.json()
          setShowMetodoPagoModal(false)
          setCotizacionParaPago(null)
          // Redirigir a PayPhone
          window.location.href = paymentUrl
        } else {
          const error = await pagoResponse.json()
          setMessage({ type: 'error', text: error.message || 'Error al iniciar pago' })
        }
      } else {
        // Pago en ventanilla
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/cotizaciones/${cotizacionParaPago.codigo_cotizacion}/seleccionar-pago`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ metodo_pago: metodo }),
          }
        )

        if (response.ok) {
          const cotizacionActualizada = await response.json()
          setShowMetodoPagoModal(false)
          setCotizacionParaPago(null)
          loadCotizaciones()

          setMessage({
            type: 'success',
            text: 'Has elegido pagar en ventanilla. Ahora puedes agendar tu cita y pagar cuando llegues al laboratorio.',
          })
          // Abrir modal para agendar cita
          setSelectedCotizacion(cotizacionActualizada)
          setShowAgendarCitaModal(true)
        } else {
          const error = await response.json()
          setMessage({ type: 'error', text: error.message || 'Error al seleccionar método de pago' })
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setProcesandoPago(false)
    }
  }

  const handleDescargarPDF = async (cotizacion: Cotizacion) => {
    try {
      setMessage({ type: 'success', text: 'Generando PDF...' })

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/cotizaciones/${cotizacion.codigo_cotizacion}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Error al generar PDF')
      }

      // Obtener el blob del PDF
      const blob = await response.blob()

      // Crear URL temporal y descargar
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cotizacion-${cotizacion.numero_cotizacion}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setMessage({ type: 'success', text: 'PDF descargado correctamente' })
    } catch (error) {
      console.error('Error downloading PDF:', error)
      setMessage({ type: 'error', text: 'Error al descargar el PDF' })
    }
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE':
        return 'bg-lab-warning-100 text-lab-warning-800'
      case 'ACEPTADA':
        return 'bg-lab-info-100 text-lab-info-800'
      case 'PAGO_EN_PROCESO':
        return 'bg-lab-info-100 text-lab-info-800'
      case 'PENDIENTE_PAGO_VENTANILLA':
        return 'bg-amber-100 text-amber-800'
      case 'PAGADA':
        return 'bg-lab-success-100 text-lab-success-800'
      case 'RECHAZADA':
        return 'bg-lab-danger-100 text-lab-danger-800'
      case 'EXPIRADA':
        return 'bg-lab-neutral-100 text-lab-neutral-800'
      default:
        return 'bg-lab-neutral-100 text-lab-neutral-600'
    }
  }

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE':
        return 'Pendiente de Pago'
      case 'ACEPTADA':
        return 'Aceptada'
      case 'PAGO_EN_PROCESO':
        return 'Pago en Proceso'
      case 'PENDIENTE_PAGO_VENTANILLA':
        return 'Pagar en Ventanilla'
      case 'PAGADA':
        return 'Pagada'
      case 'RECHAZADA':
        return 'Rechazada'
      case 'EXPIRADA':
        return 'Expirada'
      default:
        return estado
    }
  }

  // Determinar qué acciones están disponibles para una cotización
  const getAccionesDisponibles = (cotizacion: Cotizacion) => {
    const acciones = {
      puedeSeleccionarPago: false,
      puedeAgendarCita: false,
      tieneCita: !!cotizacion.cita,
    }

    // Solo puede seleccionar pago si está en PENDIENTE o ACEPTADA
    if (['PENDIENTE', 'ACEPTADA'].includes(cotizacion.estado)) {
      acciones.puedeSeleccionarPago = true
    }

    // Solo puede agendar cita si tiene método de pago seleccionado y no tiene cita
    if (['PAGADA', 'PENDIENTE_PAGO_VENTANILLA'].includes(cotizacion.estado) && !cotizacion.cita) {
      acciones.puedeAgendarCita = true
    }

    return acciones
  }

  const examenesFiltrados = useMemo(() => {
    return examenes.filter((examen) => {
      const matchesSearch =
        examen.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        examen.codigo_interno.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategoria =
        categoriaFilter === 'TODAS' || examen.categoria === categoriaFilter

      return matchesSearch && matchesCategoria
    })
  }, [examenes, searchTerm, categoriaFilter])

  const categorias = useMemo(() => {
    const cats = new Set(examenes.map((e) => e.categoria))
    return Array.from(cats).sort()
  }, [examenes])

  const totales = useMemo(() => {
    let subtotal = 0
    let descuento = 0

    examenesSeleccionados.forEach((item) => {
      subtotal += item.subtotal
    })

    return {
      subtotal,
      descuento,
      total: subtotal - descuento,
    }
  }, [examenesSeleccionados])

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-lab-neutral-900">Cotizaciones</h1>
        <p className="text-lab-neutral-600 mt-2">Solicita cotizaciones para tus exámenes de laboratorio</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel de Selección de Exámenes */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Selecciona tus Exámenes</CardTitle>
              <CardDescription>Marca los exámenes que necesitas</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="search">Buscar Examen</Label>
                  <Input
                    id="search"
                    placeholder="Nombre o código del examen"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <select
                    id="categoria"
                    value={categoriaFilter}
                    onChange={(e) => setCategoriaFilter(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-lab-neutral-300 focus:outline-none focus:ring-2 focus:ring-lab-primary-500"
                  >
                    <option value="TODAS">Todas las Categorías</option>
                    {categorias.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lista de Exámenes */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {examenesFiltrados.map((examen) => {
                    const isSelected = examenesSeleccionados.has(examen.codigo_examen)

                    return (
                      <div
                        key={examen.codigo_examen}
                        onClick={() => handleToggleExamen(examen)}
                        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${isSelected
                          ? 'border-lab-primary-500 bg-lab-primary-50'
                          : 'border-lab-neutral-200 hover:border-lab-primary-300'
                          }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`mt-1 h-5 w-5 rounded border flex items-center justify-center ${isSelected ? 'bg-lab-primary-600 border-lab-primary-600' : 'border-lab-neutral-300'
                            }`}>
                            {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <h3 className="font-medium text-lab-neutral-900">{examen.nombre}</h3>
                              <span className="font-bold text-lab-neutral-900">${(Number(examen.precio_actual) || 0).toFixed(2)}</span>
                            </div>
                            <p className="text-sm text-lab-neutral-600 mt-1">
                              {examen.codigo_interno} • {examen.categoria}
                            </p>
                            {examen.descripcion && (
                              <p className="text-sm text-lab-neutral-500 mt-1">{examen.descripcion}</p>
                            )}
                            {(examen.requiere_ayuno || examen.requiere_preparacion_especial) && (
                              <div className="flex items-center space-x-2 mt-2">
                                {examen.requiere_ayuno && (
                                  <span className="text-xs px-2 py-1 bg-lab-warning-100 text-lab-warning-800 rounded">
                                    Requiere Ayuno
                                  </span>
                                )}
                                {examen.requiere_preparacion_especial && (
                                  <span className="text-xs px-2 py-1 bg-lab-info-100 text-lab-info-800 rounded">
                                    Preparación Especial
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {examenesFiltrados.length === 0 && (
                    <div className="text-center py-8 text-lab-neutral-500">
                      No se encontraron exámenes
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resumen de Cotización */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
                <CardDescription>
                  {examenesSeleccionados.size} examen{examenesSeleccionados.size !== 1 && 'es'} seleccionado{examenesSeleccionados.size !== 1 && 's'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Lista de seleccionados */}
                {examenesSeleccionados.size > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto border-b border-lab-neutral-200 pb-4">
                    {Array.from(examenesSeleccionados.values()).map((examen) => (
                      <div key={examen.codigo_examen} className="flex justify-between items-center text-sm">
                        <div className="flex-1">
                          <p className="font-medium text-lab-neutral-900">{examen.nombre}</p>
                        </div>
                        <p className="font-semibold">${(Number(examen.subtotal) || 0).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totales */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-lab-neutral-600">Subtotal:</span>
                    <span className="font-semibold">${totales.subtotal.toFixed(2)}</span>
                  </div>
                  {totales.descuento > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-lab-neutral-600">Descuento:</span>
                      <span className="font-semibold text-lab-success-600">-${totales.descuento.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-lab-neutral-200">
                    <span>Total:</span>
                    <span className="text-lab-primary-600">${totales.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Botones */}
                <div className="space-y-2 pt-4">
                  <Button
                    onClick={handleGenerarCotizacion}
                    disabled={examenesSeleccionados.size === 0}
                    className="w-full"
                  >
                    Generar Cotización
                  </Button>
                  {examenesSeleccionados.size > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setExamenesSeleccionados(new Map())}
                      className="w-full"
                    >
                      Limpiar Selección
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Historial de Cotizaciones (Full Width Bottom) */}
      <Card>
        <CardHeader>
          <CardTitle>Mis Cotizaciones</CardTitle>
          <CardDescription>Historial de cotizaciones generadas</CardDescription>
        </CardHeader>
        <CardContent>
          {cotizaciones.length === 0 ? (
            <div className="text-center py-8 text-lab-neutral-500">
              No tienes cotizaciones generadas
            </div>
          ) : (
            <div className="space-y-3">
              {cotizaciones.map((cotizacion) => {
                const acciones = getAccionesDisponibles(cotizacion)
                return (
                  <div
                    key={cotizacion.codigo_cotizacion}
                    className="flex items-center justify-between p-4 rounded-lg border border-lab-neutral-200 hover:bg-lab-neutral-50 transition-colors"
                  >
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div>
                        <h4 className="font-semibold text-lab-neutral-900">{cotizacion.numero_cotizacion}</h4>
                        <p className="text-sm text-lab-neutral-600">
                          {formatDate(new Date(cotizacion.fecha_cotizacion))}
                        </p>
                      </div>

                      <div>
                        <span className={`text-xs px-2 py-1 rounded ${getEstadoBadge(cotizacion.estado)}`}>
                          {getEstadoLabel(cotizacion.estado)}
                        </span>
                        {cotizacion.metodo_pago_seleccionado && (
                          <span className="ml-2 text-xs text-lab-neutral-500">
                            ({cotizacion.metodo_pago_seleccionado === 'VENTANILLA' ? 'Ventanilla' : 'Online'})
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-lab-neutral-700">
                        <strong>{cotizacion.detalles?.length || 0}</strong> examen{(cotizacion.detalles?.length || 0) !== 1 && 'es'}
                      </div>

                      <div className="font-bold text-lab-neutral-900">
                        ${Number(cotizacion.total).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => handleDescargarPDF(cotizacion)} title="Descargar PDF">
                        <svg className="w-5 h-5 text-lab-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </Button>

                      {/* Botón para seleccionar método de pago */}
                      {acciones.puedeSeleccionarPago && (
                        <Button size="sm" onClick={() => handleSeleccionarPago(cotizacion)}>
                          Seleccionar Pago
                        </Button>
                      )}

                      {/* Botón para agendar cita (solo si ya seleccionó método de pago) */}
                      {acciones.puedeAgendarCita && (
                        <Button size="sm" variant="outline" onClick={() => handleAgendarCita(cotizacion)}>
                          Agendar Cita
                        </Button>
                      )}

                      {/* Indicador de cita agendada */}
                      {acciones.tieneCita && (
                        <span className="text-xs font-medium text-lab-success-700 bg-lab-success-100 px-2 py-1 rounded">
                          Cita Agendada
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Agendar Cita */}
      {showAgendarCitaModal && selectedCotizacion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-lab-neutral-200">
              <h2 className="text-xl font-bold text-lab-neutral-900">
                Agendar Cita para {selectedCotizacion.numero_cotizacion}
              </h2>
              {selectedCotizacion.estado === 'PENDIENTE_PAGO_VENTANILLA' && (
                <p className="text-sm text-amber-600 mt-2">
                  Recuerda que deberás pagar en ventanilla cuando llegues al laboratorio.
                </p>
              )}
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                <Label>Fecha de la Cita</Label>
                <Input
                  type="date"
                  value={fechaCita}
                  onChange={(e) => {
                    setFechaCita(e.target.value)
                    setSelectedSlot(null) // Reset slot al cambiar fecha
                  }}
                  min={new Date().toISOString().split('T')[0]}
                />
                {fechaCita && (
                  <p className="text-xs text-lab-neutral-500">
                    {new Date(fechaCita + 'T12:00:00').toLocaleDateString('es-EC', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                )}
              </div>

              {fechaCita && (
                <div className="space-y-3">
                  <Label>Horarios Disponibles</Label>
                  {loadingSlots ? (
                    <div className="text-center py-6">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600 mx-auto"></div>
                      <p className="text-sm text-lab-neutral-500 mt-2">Cargando horarios...</p>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-6 bg-lab-neutral-50 rounded-lg">
                      <svg className="w-12 h-12 text-lab-neutral-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-lab-neutral-500">No hay horarios disponibles</p>
                      <p className="text-xs text-lab-neutral-400 mt-1">Intenta seleccionar otra fecha</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Mañana (antes de 12:00) */}
                      {availableSlots.some(s => getHourNumber(s.hora_inicio) < 12) && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span className="text-sm font-medium text-lab-neutral-700">Mañana</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {availableSlots
                              .filter(s => getHourNumber(s.hora_inicio) < 12)
                              .map((slot) => (
                                <button
                                  key={slot.codigo_slot}
                                  onClick={() => setSelectedSlot(slot.codigo_slot)}
                                  className={`py-2 px-3 text-sm font-medium rounded-lg border-2 transition-all ${
                                    selectedSlot === slot.codigo_slot
                                      ? 'bg-lab-primary-600 text-white border-lab-primary-600 shadow-md'
                                      : 'bg-white text-lab-neutral-700 border-lab-neutral-200 hover:border-lab-primary-400 hover:bg-lab-primary-50'
                                  }`}
                                >
                                  {formatSlotTime(slot.hora_inicio)}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Tarde (12:00 o después) */}
                      {availableSlots.some(s => getHourNumber(s.hora_inicio) >= 12) && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                            <span className="text-sm font-medium text-lab-neutral-700">Tarde</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {availableSlots
                              .filter(s => getHourNumber(s.hora_inicio) >= 12)
                              .map((slot) => (
                                <button
                                  key={slot.codigo_slot}
                                  onClick={() => setSelectedSlot(slot.codigo_slot)}
                                  className={`py-2 px-3 text-sm font-medium rounded-lg border-2 transition-all ${
                                    selectedSlot === slot.codigo_slot
                                      ? 'bg-lab-primary-600 text-white border-lab-primary-600 shadow-md'
                                      : 'bg-white text-lab-neutral-700 border-lab-neutral-200 hover:border-lab-primary-400 hover:bg-lab-primary-50'
                                  }`}
                                >
                                  {formatSlotTime(slot.hora_inicio)}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-lab-neutral-500 text-center">
                        {availableSlots.length} horario{availableSlots.length !== 1 ? 's' : ''} disponible{availableSlots.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Observaciones (Opcional)</Label>
                <textarea
                  value={observacionesCita}
                  onChange={(e) => setObservacionesCita(e.target.value)}
                  placeholder="Alguna indicación especial que debamos conocer..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-lab-neutral-300 focus:outline-none focus:ring-2 focus:ring-lab-primary-500 resize-none"
                />
              </div>

              {/* Resumen de selección */}
              {selectedSlot && (
                <div className="bg-lab-primary-50 border border-lab-primary-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-lab-primary-900">Horario seleccionado:</p>
                  <p className="text-lg font-bold text-lab-primary-700">
                    {formatSlotTime(availableSlots.find(s => s.codigo_slot === selectedSlot)?.hora_inicio || '')}
                    {' - '}
                    {new Date(fechaCita + 'T12:00:00').toLocaleDateString('es-EC', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-lab-neutral-200 flex justify-end gap-3 bg-lab-neutral-50">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAgendarCitaModal(false)
                  setFechaCita('')
                  setSelectedSlot(null)
                  setObservacionesCita('')
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarCita}
                disabled={!selectedSlot || !fechaCita}
              >
                Confirmar Cita
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Selección de Método de Pago */}
      {showMetodoPagoModal && cotizacionParaPago && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-lab-neutral-200">
              <h2 className="text-xl font-bold text-lab-neutral-900">
                Seleccionar Método de Pago
              </h2>
              <p className="text-sm text-lab-neutral-600 mt-1">
                Cotización: {cotizacionParaPago.numero_cotizacion}
              </p>
            </div>

            <div className="p-6">
              {/* Resumen de la cotización */}
              <div className="bg-lab-neutral-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lab-neutral-600">Total a pagar:</span>
                  <span className="text-2xl font-bold text-lab-primary-600">
                    ${Number(cotizacionParaPago.total).toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-lab-neutral-500 mt-2">
                  {cotizacionParaPago.detalles?.length || 0} examen(es) incluido(s)
                </p>
              </div>

              {/* Opciones de pago */}
              <div className="space-y-4">
                {/* Opción Online */}
                <button
                  onClick={() => handleConfirmarMetodoPago('ONLINE')}
                  disabled={procesandoPago}
                  className="w-full p-4 border-2 border-lab-neutral-200 rounded-lg hover:border-lab-primary-500 transition-colors text-left group disabled:opacity-50"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lab-neutral-900">Pagar en Línea</h3>
                      <p className="text-sm text-lab-neutral-600 mt-1">
                        Paga con tarjeta de crédito o débito de forma segura. Podrás agendar tu cita inmediatamente después del pago.
                      </p>
                      <span className="inline-flex items-center text-xs text-blue-600 mt-2">
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Pago seguro con PayPhone
                      </span>
                    </div>
                    <svg className="w-5 h-5 text-lab-neutral-400 group-hover:text-lab-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Opción Ventanilla */}
                <button
                  onClick={() => handleConfirmarMetodoPago('VENTANILLA')}
                  disabled={procesandoPago}
                  className="w-full p-4 border-2 border-lab-neutral-200 rounded-lg hover:border-lab-primary-500 transition-colors text-left group disabled:opacity-50"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                      <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lab-neutral-900">Pagar en Ventanilla</h3>
                      <p className="text-sm text-lab-neutral-600 mt-1">
                        Agenda tu cita ahora y paga cuando llegues al laboratorio. Acepta efectivo, tarjeta o transferencia.
                      </p>
                      <span className="inline-flex items-center text-xs text-amber-600 mt-2">
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Paga al llegar al laboratorio
                      </span>
                    </div>
                    <svg className="w-5 h-5 text-lab-neutral-400 group-hover:text-lab-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-lab-neutral-200">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowMetodoPagoModal(false)
                  setCotizacionParaPago(null)
                }}
                disabled={procesandoPago}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
