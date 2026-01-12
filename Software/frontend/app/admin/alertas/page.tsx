'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface Alerta {
  codigo_item: number
  codigo_interno: string
  nombre: string
  stock_actual: number
  stock_minimo: number
  stock_maximo: number | null
  unidad_medida: string
  tipo_alerta: string
  mensaje: string
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  codigo_lote?: number
  numero_lote?: string
  fecha_vencimiento?: string
  dias_hasta_vencimiento?: number
}

interface ItemSinMovimiento {
  codigo_item: number
  codigo_interno: string
  nombre: string
  categoria: string
  stock_actual: number
  unidad_medida: string
  ultimo_movimiento: string | null
  dias_sin_movimiento: number | null
  tipo_alerta: string
  mensaje: string
  prioridad: string
}

interface Estadisticas {
  total: number
  criticas: number
  altas: number
  medias: number
  bajas: number
  por_tipo: {
    stock_critico: number
    stock_bajo: number
    vencidos: number
    proximos_vencer: number
  }
}

interface Message {
  type: 'success' | 'error'
  text: string
}

interface WhatsAppConfig {
  configured: boolean
  accountSid?: string
  hasAuthToken?: boolean
  fromNumber?: string
  defaultRecipient?: string
}

const TIPO_ALERTA_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  STOCK_CRITICO: { label: 'Sin Stock', color: 'bg-lab-danger-100 text-lab-danger-800', icon: '⛔' },
  STOCK_BAJO: { label: 'Stock Bajo', color: 'bg-lab-warning-100 text-lab-warning-800', icon: '⚠️' },
  VENCIDO: { label: 'Vencido', color: 'bg-lab-danger-100 text-lab-danger-800', icon: '🚫' },
  PROXIMO_VENCER: { label: 'Por Vencer', color: 'bg-lab-warning-100 text-lab-warning-800', icon: '⏰' },
}

const PRIORIDAD_CONFIG = {
  CRITICA: { label: 'Crítica', color: 'bg-lab-danger-600 text-white', badge: '🔴' },
  ALTA: { label: 'Alta', color: 'bg-lab-warning-600 text-white', badge: '🟠' },
  MEDIA: { label: 'Media', color: 'bg-lab-primary-500 text-white', badge: '🟡' },
  BAJA: { label: 'Baja', color: 'bg-lab-neutral-400 text-white', badge: '⚪' },
}

export default function AlertasStockPage() {
  const { accessToken } = useAuthStore()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [itemsSinMovimiento, setItemsSinMovimiento] = useState<ItemSinMovimiento[]>([])
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const [activeTab, setActiveTab] = useState<'alertas' | 'sin_movimiento' | 'whatsapp'>('alertas')
  const [diasSinMovimiento, setDiasSinMovimiento] = useState(30)

  // Filtros
  const [filterTipo, setFilterTipo] = useState('')
  const [filterPrioridad, setFilterPrioridad] = useState('')

  // WhatsApp
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig | null>(null)
  const [whatsappLoading, setWhatsappLoading] = useState(false)
  const [testMessage, setTestMessage] = useState('Prueba del sistema de alertas - Laboratorio Franz')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && accessToken) {
      loadAlertas()
      loadEstadisticas()
      loadItemsSinMovimiento()
      loadWhatsAppConfig()
    }
  }, [accessToken, mounted])

  const loadWhatsAppConfig = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/whatsapp/config`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      if (response.ok) {
        const data = await response.json()
        setWhatsappConfig(data)
      }
    } catch (error) {
      console.error('Error loading WhatsApp config:', error)
    }
  }

  const sendTestMessage = async () => {
    setWhatsappLoading(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/whatsapp/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ message: testMessage }),
        }
      )
      const data = await response.json()
      if (response.ok && data.success) {
        setMessage({ type: 'success', text: '✅ Mensaje de prueba enviado correctamente a WhatsApp' })
      } else {
        setMessage({ type: 'error', text: data.message || 'Error al enviar mensaje de prueba' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al enviar mensaje' })
    } finally {
      setWhatsappLoading(false)
    }
  }

  const sendStockAlerts = async () => {
    setWhatsappLoading(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/alertas/stock-bajo`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: `✅ Alertas de stock enviadas: ${data.enviados || 0} items` })
      } else {
        setMessage({ type: 'error', text: data.message || 'Error al enviar alertas de stock' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setWhatsappLoading(false)
    }
  }

  const sendVencimientoAlerts = async () => {
    setWhatsappLoading(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/alertas/vencimientos`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: `✅ Alertas de vencimiento enviadas: ${data.enviados || 0} lotes` })
      } else {
        setMessage({ type: 'error', text: data.message || 'Error al enviar alertas de vencimiento' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setWhatsappLoading(false)
    }
  }

  const sendAllAlerts = async () => {
    setWhatsappLoading(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/alertas/enviar-ahora`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: '✅ Todas las alertas han sido enviadas por WhatsApp' })
      } else {
        setMessage({ type: 'error', text: data.message || 'Error al enviar alertas' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setWhatsappLoading(false)
    }
  }

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const loadAlertas = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (filterTipo) params.append('tipo', filterTipo)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/alertas?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setAlertas(data)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar alertas' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setLoading(false)
    }
  }

  const loadEstadisticas = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/alertas/estadisticas`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setEstadisticas(data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadItemsSinMovimiento = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/alertas/sin-movimientos?dias=${diasSinMovimiento}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setItemsSinMovimiento(data.items || [])
      }
    } catch (error) {
      console.error('Error loading items sin movimiento:', error)
    }
  }

  const handleApplyFilters = () => {
    loadAlertas()
  }

  const handleClearFilters = () => {
    setFilterTipo('')
    setFilterPrioridad('')
    setTimeout(() => loadAlertas(), 100)
  }

  const filteredAlertas = alertas.filter((alerta) => {
    if (filterPrioridad && alerta.prioridad !== filterPrioridad) return false
    return true
  })

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-lab-success-50 text-lab-success-800 border border-lab-success-200'
              : 'bg-lab-danger-50 text-lab-danger-800 border border-lab-danger-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-lab-neutral-900">Alertas de Inventario</h1>
          <p className="text-lab-neutral-600 mt-2">
            Monitoreo de stock bajo, productos vencidos, próximos a vencer e ítems sin rotación
          </p>
        </div>
        <Button onClick={() => { loadAlertas(); loadItemsSinMovimiento(); }} className="bg-lab-primary-600 hover:bg-lab-primary-700">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-lab-neutral-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('alertas')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'alertas'
                ? 'border-lab-primary-600 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            Alertas de Stock y Vencimiento
          </button>
          <button
            onClick={() => setActiveTab('sin_movimiento')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'sin_movimiento'
                ? 'border-lab-primary-600 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            Sin Movimientos
            {itemsSinMovimiento.length > 0 && (
              <span className="ml-2 bg-lab-warning-100 text-lab-warning-800 text-xs px-2 py-0.5 rounded-full">
                {itemsSinMovimiento.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'whatsapp'
                ? 'border-lab-primary-600 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            WhatsApp
            {whatsappConfig?.configured && (
              <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                Activo
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab: Alertas de Stock y Vencimiento */}
      {activeTab === 'alertas' && (
        <>
      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-lab-neutral-600">Total Alertas</div>
              <div className="text-3xl font-bold text-lab-neutral-900 mt-2">{estadisticas.total}</div>
            </CardContent>
          </Card>
          <Card className="border-lab-danger-200 bg-lab-danger-50">
            <CardContent className="pt-6">
              <div className="text-sm text-lab-danger-700 font-medium">🔴 Críticas</div>
              <div className="text-3xl font-bold text-lab-danger-800 mt-2">{estadisticas.criticas}</div>
            </CardContent>
          </Card>
          <Card className="border-lab-warning-200 bg-lab-warning-50">
            <CardContent className="pt-6">
              <div className="text-sm text-lab-warning-700 font-medium">🟠 Altas</div>
              <div className="text-3xl font-bold text-lab-warning-800 mt-2">{estadisticas.altas}</div>
            </CardContent>
          </Card>
          <Card className="border-lab-primary-200 bg-lab-primary-50">
            <CardContent className="pt-6">
              <div className="text-sm text-lab-primary-700 font-medium">🟡 Medias</div>
              <div className="text-3xl font-bold text-lab-primary-800 mt-2">{estadisticas.medias}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-lab-neutral-600">⚪ Bajas</div>
              <div className="text-3xl font-bold text-lab-neutral-700 mt-2">{estadisticas.bajas}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tipos de Alerta */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-lab-neutral-600">⛔ Sin Stock</div>
              <div className="text-2xl font-bold text-lab-danger-600 mt-2">
                {estadisticas.por_tipo.stock_critico}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-lab-neutral-600">⚠️ Stock Bajo</div>
              <div className="text-2xl font-bold text-lab-warning-600 mt-2">
                {estadisticas.por_tipo.stock_bajo}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-lab-neutral-600">🚫 Vencidos</div>
              <div className="text-2xl font-bold text-lab-danger-600 mt-2">
                {estadisticas.por_tipo.vencidos}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-lab-neutral-600">⏰ Por Vencer</div>
              <div className="text-2xl font-bold text-lab-warning-600 mt-2">
                {estadisticas.por_tipo.proximos_vencer}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                Tipo de Alerta
              </label>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
              >
                <option value="">Todos los tipos</option>
                <option value="STOCK_CRITICO">⛔ Sin Stock</option>
                <option value="STOCK_BAJO">⚠️ Stock Bajo</option>
                <option value="VENCIDO">🚫 Vencido</option>
                <option value="PROXIMO_VENCER">⏰ Por Vencer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                Prioridad
              </label>
              <select
                value={filterPrioridad}
                onChange={(e) => setFilterPrioridad(e.target.value)}
                className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
              >
                <option value="">Todas las prioridades</option>
                <option value="CRITICA">🔴 Crítica</option>
                <option value="ALTA">🟠 Alta</option>
                <option value="MEDIA">🟡 Media</option>
                <option value="BAJA">⚪ Baja</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="flex space-x-3">
                <Button onClick={handleApplyFilters} className="bg-lab-primary-600 hover:bg-lab-primary-700">
                  Aplicar
                </Button>
                <Button onClick={handleClearFilters} variant="outline">
                  Limpiar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas Activas ({filteredAlertas.length})</CardTitle>
          <CardDescription>Productos que requieren atención inmediata</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-lab-neutral-200">
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Prioridad</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Tipo</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Producto</th>
                    <th className="text-center p-4 font-semibold text-lab-neutral-900">Stock</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Mensaje</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Lote</th>
                    <th className="text-center p-4 font-semibold text-lab-neutral-900">Vencimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlertas.map((alerta, index) => {
                    const prioridadStyle = PRIORIDAD_CONFIG[alerta.prioridad]
                    const tipoStyle = TIPO_ALERTA_CONFIG[alerta.tipo_alerta]

                    return (
                      <tr key={index} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                        <td className="p-4">
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${prioridadStyle.color}`}>
                            {prioridadStyle.badge} {prioridadStyle.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded ${tipoStyle.color}`}>
                            {tipoStyle.icon} {tipoStyle.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-lab-neutral-900">{alerta.nombre}</div>
                          <div className="text-xs text-lab-neutral-600">{alerta.codigo_interno}</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-semibold text-lab-neutral-900">
                            {alerta.stock_actual} {alerta.unidad_medida}
                          </div>
                          <div className="text-xs text-lab-neutral-600">
                            Min: {alerta.stock_minimo}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-lab-neutral-700">
                          {alerta.mensaje}
                        </td>
                        <td className="p-4 text-sm text-lab-neutral-600">
                          {alerta.numero_lote || '-'}
                        </td>
                        <td className="p-4 text-center text-sm">
                          {alerta.fecha_vencimiento ? (
                            <div>
                              <div className="text-lab-neutral-900">
                                {formatDate(alerta.fecha_vencimiento)}
                              </div>
                              {alerta.dias_hasta_vencimiento !== undefined && (
                                <div className={`text-xs ${
                                  alerta.dias_hasta_vencimiento < 0
                                    ? 'text-lab-danger-600 font-semibold'
                                    : alerta.dias_hasta_vencimiento <= 7
                                    ? 'text-lab-warning-600 font-semibold'
                                    : 'text-lab-neutral-600'
                                }`}>
                                  {alerta.dias_hasta_vencimiento < 0
                                    ? `Vencido hace ${Math.abs(alerta.dias_hasta_vencimiento)} días`
                                    : `${alerta.dias_hasta_vencimiento} días`
                                  }
                                </div>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {filteredAlertas.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎉</div>
                  <div className="text-xl font-semibold text-lab-success-600 mb-2">
                    ¡No hay alertas activas!
                  </div>
                  <div className="text-lab-neutral-600">
                    Todo el inventario está en niveles óptimos
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {/* Tab: Ítems Sin Movimientos */}
      {activeTab === 'sin_movimiento' && (
        <>
          {/* Filtro de días */}
          <Card>
            <CardHeader>
              <CardTitle>Configuración</CardTitle>
              <CardDescription>
                Ítems que no han tenido movimientos (entrada/salida) en el período especificado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Días sin movimiento
                  </label>
                  <select
                    value={diasSinMovimiento}
                    onChange={(e) => setDiasSinMovimiento(parseInt(e.target.value))}
                    className="block w-48 rounded-md border border-lab-neutral-300 px-3 py-2"
                  >
                    <option value={15}>15 días</option>
                    <option value={30}>30 días</option>
                    <option value={60}>60 días</option>
                    <option value={90}>90 días</option>
                    <option value={180}>180 días</option>
                  </select>
                </div>
                <Button onClick={loadItemsSinMovimiento} className="bg-lab-primary-600 hover:bg-lab-primary-700">
                  Buscar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de ítems sin movimiento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                Ítems Sin Movimientos
                <span className="ml-2 text-sm font-normal text-lab-neutral-600">
                  ({itemsSinMovimiento.length} encontrados)
                </span>
              </CardTitle>
              <CardDescription>
                Productos que pueden requerir revisión de rotación o ajuste de inventario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-lab-neutral-200">
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Prioridad</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Producto</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Categoría</th>
                      <th className="text-center p-4 font-semibold text-lab-neutral-900">Stock</th>
                      <th className="text-center p-4 font-semibold text-lab-neutral-900">Último Mov.</th>
                      <th className="text-center p-4 font-semibold text-lab-neutral-900">Días Sin Mov.</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsSinMovimiento.map((item, index) => (
                      <tr key={index} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                        <td className="p-4">
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                            item.prioridad === 'ALTA'
                              ? 'bg-lab-warning-600 text-white'
                              : 'bg-lab-primary-500 text-white'
                          }`}>
                            {item.prioridad === 'ALTA' ? '🟠' : '🟡'} {item.prioridad}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-lab-neutral-900">{item.nombre}</div>
                          <div className="text-xs text-lab-neutral-600">{item.codigo_interno}</div>
                        </td>
                        <td className="p-4 text-sm text-lab-neutral-700">
                          {item.categoria}
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-semibold text-lab-neutral-900">
                            {item.stock_actual} {item.unidad_medida}
                          </div>
                        </td>
                        <td className="p-4 text-center text-sm text-lab-neutral-600">
                          {item.ultimo_movimiento ? formatDate(item.ultimo_movimiento) : 'Nunca'}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`font-semibold ${
                            item.dias_sin_movimiento === null
                              ? 'text-lab-danger-600'
                              : item.dias_sin_movimiento > 60
                              ? 'text-lab-warning-600'
                              : 'text-lab-neutral-900'
                          }`}>
                            {item.dias_sin_movimiento !== null ? `${item.dias_sin_movimiento} días` : '∞'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-lab-neutral-700">
                          {item.mensaje}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {itemsSinMovimiento.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">✅</div>
                    <div className="text-xl font-semibold text-lab-success-600 mb-2">
                      ¡Buena rotación de inventario!
                    </div>
                    <div className="text-lab-neutral-600">
                      Todos los ítems han tenido movimientos en los últimos {diasSinMovimiento} días
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab: WhatsApp Notificaciones */}
      {activeTab === 'whatsapp' && (
        <>
          {/* Estado de Configuración */}
          <Card className={whatsappConfig?.configured ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Estado de WhatsApp
                {whatsappConfig?.configured ? (
                  <span className="text-sm font-normal bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    Configurado
                  </span>
                ) : (
                  <span className="text-sm font-normal bg-red-100 text-red-800 px-2 py-1 rounded-full">
                    No Configurado
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {whatsappConfig?.configured
                  ? 'El sistema está listo para enviar notificaciones por WhatsApp'
                  : 'Configure las credenciales de Twilio en el archivo .env del backend'
                }
              </CardDescription>
            </CardHeader>
            {whatsappConfig?.configured && (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-lab-neutral-600">Número de envío:</span>
                    <span className="ml-2 font-mono">{whatsappConfig.fromNumber}</span>
                  </div>
                  <div>
                    <span className="text-lab-neutral-600">Destinatario:</span>
                    <span className="ml-2 font-mono">{whatsappConfig.defaultRecipient}</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Enviar Mensaje de Prueba */}
          <Card>
            <CardHeader>
              <CardTitle>Enviar Mensaje de Prueba</CardTitle>
              <CardDescription>
                Envía un mensaje personalizado para verificar que la configuración funciona
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Escribe tu mensaje de prueba..."
                  className="flex-1 rounded-md border border-lab-neutral-300 px-4 py-2"
                />
                <Button
                  onClick={sendTestMessage}
                  disabled={whatsappLoading || !whatsappConfig?.configured}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {whatsappLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Enviar Prueba
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Enviar Alertas */}
          <Card>
            <CardHeader>
              <CardTitle>Enviar Alertas Ahora</CardTitle>
              <CardDescription>
                Forzar el envío de alertas de inventario por WhatsApp (normalmente se envían automáticamente según horario programado)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Stock Bajo */}
                <div className="border rounded-lg p-4 bg-lab-warning-50 border-lab-warning-200">
                  <div className="text-lg font-semibold text-lab-warning-800 mb-2">Stock Bajo</div>
                  <p className="text-sm text-lab-warning-700 mb-4">
                    Envía alerta de items con stock bajo o sin stock
                  </p>
                  <Button
                    onClick={sendStockAlerts}
                    disabled={whatsappLoading || !whatsappConfig?.configured}
                    className="w-full bg-lab-warning-600 hover:bg-lab-warning-700"
                  >
                    {whatsappLoading ? 'Enviando...' : 'Enviar Alertas Stock'}
                  </Button>
                </div>

                {/* Vencimientos */}
                <div className="border rounded-lg p-4 bg-lab-danger-50 border-lab-danger-200">
                  <div className="text-lg font-semibold text-lab-danger-800 mb-2">Vencimientos</div>
                  <p className="text-sm text-lab-danger-700 mb-4">
                    Envía alerta de lotes vencidos o próximos a vencer
                  </p>
                  <Button
                    onClick={sendVencimientoAlerts}
                    disabled={whatsappLoading || !whatsappConfig?.configured}
                    className="w-full bg-lab-danger-600 hover:bg-lab-danger-700"
                  >
                    {whatsappLoading ? 'Enviando...' : 'Enviar Alertas Vencimiento'}
                  </Button>
                </div>

                {/* Todas */}
                <div className="border rounded-lg p-4 bg-lab-primary-50 border-lab-primary-200">
                  <div className="text-lg font-semibold text-lab-primary-800 mb-2">Todas las Alertas</div>
                  <p className="text-sm text-lab-primary-700 mb-4">
                    Envía todas las alertas pendientes en un solo mensaje
                  </p>
                  <Button
                    onClick={sendAllAlerts}
                    disabled={whatsappLoading || !whatsappConfig?.configured}
                    className="w-full bg-lab-primary-600 hover:bg-lab-primary-700"
                  >
                    {whatsappLoading ? 'Enviando...' : 'Enviar Todas'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información de Horarios */}
          <Card>
            <CardHeader>
              <CardTitle>Horarios Automaticos</CardTitle>
              <CardDescription>
                Las alertas se envian automaticamente segun el siguiente horario (1 vez al dia maximo)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-lab-neutral-50 rounded-lg">
                  <div className="font-semibold text-lab-neutral-900">Diariamente - 8:00 AM</div>
                  <p className="text-sm text-lab-neutral-600 mt-1">Alertas de stock bajo y critico (1 mensaje/dia)</p>
                </div>
                <div className="p-4 bg-lab-neutral-50 rounded-lg">
                  <div className="font-semibold text-lab-neutral-900">Lunes - 9:00 AM</div>
                  <p className="text-sm text-lab-neutral-600 mt-1">Alertas de vencimientos</p>
                </div>
                <div className="p-4 bg-lab-neutral-50 rounded-lg">
                  <div className="font-semibold text-lab-neutral-900">Lunes - 10:00 AM</div>
                  <p className="text-sm text-lab-neutral-600 mt-1">Items sin movimientos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
