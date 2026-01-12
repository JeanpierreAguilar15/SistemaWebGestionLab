'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/utils'

interface ItemInventario {
  codigo_item: number
  codigo_interno: string
  nombre: string
  stock_actual: number
  unidad_medida: string
}

interface Movimiento {
  codigo_movimiento: number
  codigo_item: number
  codigo_lote: number | null
  tipo_movimiento: string
  cantidad: number
  motivo: string | null
  stock_anterior: number
  stock_nuevo: number
  fecha_movimiento: string
  realizado_por: number | null
  item: {
    codigo_interno: string
    nombre: string
    unidad_medida: string
  }
  usuario: {
    nombres: string
    apellidos: string
  } | null
  lote: {
    numero_lote: string
  } | null
}

interface Message {
  type: 'success' | 'error'
  text: string
}

const TIPO_MOVIMIENTO_OPTIONS = [
  { value: 'ENTRADA', label: 'Entrada', color: 'bg-lab-success-100 text-lab-success-800', icon: '↑' },
  { value: 'SALIDA', label: 'Salida', color: 'bg-lab-danger-100 text-lab-danger-800', icon: '↓' },
  { value: 'AJUSTE_POSITIVO', label: 'Ajuste +', color: 'bg-lab-primary-100 text-lab-primary-800', icon: '+' },
  { value: 'AJUSTE_NEGATIVO', label: 'Ajuste -', color: 'bg-lab-warning-100 text-lab-warning-800', icon: '-' },
  { value: 'TRANSFERENCIA', label: 'Transferencia', color: 'bg-lab-neutral-100 text-lab-neutral-800', icon: '↔' },
]

export default function MovimientosStockPage() {
  const { accessToken } = useAuthStore()
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [items, setItems] = useState<ItemInventario[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  // Filtros
  const [filterItem, setFilterItem] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterFechaDesde, setFilterFechaDesde] = useState('')
  const [filterFechaHasta, setFilterFechaHasta] = useState('')

  // Modal de nuevo movimiento
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    codigo_item: '',
    tipo_movimiento: '',
    cantidad: '',
    motivo: '',
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && accessToken) {
      loadMovimientos()
      loadItems()
    }
  }, [accessToken, mounted])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const loadMovimientos = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (filterItem) params.append('codigo_item', filterItem)
      if (filterTipo) params.append('tipo_movimiento', filterTipo)
      if (filterFechaDesde) params.append('fecha_desde', filterFechaDesde)
      if (filterFechaHasta) params.append('fecha_hasta', filterFechaHasta)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/movements?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const result = await response.json()
        const movimientos = result.data || result
        setMovimientos(movimientos)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar movimientos' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setLoading(false)
    }
  }

  const loadItems = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/items`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        const items = result.data || result
        setItems(items.filter((item: ItemInventario) => item.stock_actual))
      }
    } catch (error) {
      console.error('Error al cargar items:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    if (!formData.codigo_item) {
      setMessage({ type: 'error', text: '❌ Debe seleccionar un item' })
      return
    }

    if (!formData.tipo_movimiento) {
      setMessage({ type: 'error', text: '❌ Debe seleccionar el tipo de movimiento' })
      return
    }

    const cantidad = parseInt(formData.cantidad)
    if (isNaN(cantidad) || cantidad <= 0) {
      setMessage({ type: 'error', text: '❌ La cantidad debe ser un número positivo' })
      return
    }

    try {
      const payload = {
        codigo_item: parseInt(formData.codigo_item),
        tipo_movimiento: formData.tipo_movimiento,
        cantidad,
        motivo: formData.motivo.trim() || null,
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/movements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: '✅ Movimiento registrado correctamente' })
        handleCloseForm()
        loadMovimientos()
        loadItems() // Reload items to update stock_actual
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al registrar movimiento' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setFormData({
      codigo_item: '',
      tipo_movimiento: '',
      cantidad: '',
      motivo: '',
    })
  }

  const getTipoMovimientoStyle = (tipo: string) => {
    const option = TIPO_MOVIMIENTO_OPTIONS.find(opt => opt.value === tipo)
    return option || TIPO_MOVIMIENTO_OPTIONS[0]
  }

  const handleApplyFilters = () => {
    loadMovimientos()
  }

  const handleClearFilters = () => {
    setFilterItem('')
    setFilterTipo('')
    setFilterFechaDesde('')
    setFilterFechaHasta('')
    setTimeout(() => loadMovimientos(), 100)
  }

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
          <h1 className="text-3xl font-bold text-lab-neutral-900">Movimientos de Stock</h1>
          <p className="text-lab-neutral-600 mt-2">
            Registro y seguimiento de entradas, salidas y ajustes de inventario
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-lab-primary-600 hover:bg-lab-primary-700">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Registrar Movimiento
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                Item
              </label>
              <select
                value={filterItem}
                onChange={(e) => setFilterItem(e.target.value)}
                className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
              >
                <option value="">Todos los items</option>
                {items.map((item) => (
                  <option key={item.codigo_item} value={item.codigo_item}>
                    {item.codigo_interno} - {item.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                Tipo
              </label>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
              >
                <option value="">Todos los tipos</option>
                {TIPO_MOVIMIENTO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                Desde
              </label>
              <Input
                type="date"
                value={filterFechaDesde}
                onChange={(e) => setFilterFechaDesde(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                Hasta
              </label>
              <Input
                type="date"
                value={filterFechaHasta}
                onChange={(e) => setFilterFechaHasta(e.target.value)}
              />
            </div>
          </div>

          <div className="flex space-x-3 mt-4">
            <Button onClick={handleApplyFilters} className="bg-lab-primary-600 hover:bg-lab-primary-700">
              Aplicar Filtros
            </Button>
            <Button onClick={handleClearFilters} variant="outline">
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Movimientos Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Movimientos ({movimientos.length})</CardTitle>
          <CardDescription>Registro completo de operaciones de stock</CardDescription>
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
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Fecha</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Item</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Tipo</th>
                    <th className="text-center p-4 font-semibold text-lab-neutral-900">Cantidad</th>
                    <th className="text-center p-4 font-semibold text-lab-neutral-900">Stock Ant.</th>
                    <th className="text-center p-4 font-semibold text-lab-neutral-900">Stock Nuevo</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Motivo</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Realizado Por</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov) => {
                    const tipoStyle = getTipoMovimientoStyle(mov.tipo_movimiento)
                    return (
                      <tr key={mov.codigo_movimiento} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                        <td className="p-4 text-sm text-lab-neutral-600">
                          {formatDateTime(mov.fecha_movimiento)}
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-lab-neutral-900">{mov.item.nombre}</div>
                          <div className="text-xs text-lab-neutral-600">{mov.item.codigo_interno}</div>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded ${tipoStyle.color} font-medium`}>
                            {tipoStyle.icon} {tipoStyle.label}
                          </span>
                        </td>
                        <td className="p-4 text-center font-semibold text-lab-neutral-900">
                          {mov.cantidad} {mov.item.unidad_medida}
                        </td>
                        <td className="p-4 text-center text-lab-neutral-600">
                          {mov.stock_anterior}
                        </td>
                        <td className="p-4 text-center font-semibold text-lab-neutral-900">
                          {mov.stock_nuevo}
                        </td>
                        <td className="p-4 text-sm text-lab-neutral-600">
                          {mov.motivo || '-'}
                        </td>
                        <td className="p-4 text-sm text-lab-neutral-600">
                          {mov.usuario ? `${mov.usuario.nombres} ${mov.usuario.apellidos}` : 'Sistema'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {movimientos.length === 0 && (
                <div className="text-center py-12 text-lab-neutral-500">
                  No se encontraron movimientos
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-lab-neutral-200">
              <h2 className="text-2xl font-bold text-lab-neutral-900">
                Registrar Movimiento de Stock
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="codigo_item" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Item *
                  </label>
                  <select
                    id="codigo_item"
                    value={formData.codigo_item}
                    onChange={(e) => setFormData({ ...formData, codigo_item: e.target.value })}
                    required
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                  >
                    <option value="">Seleccionar item...</option>
                    {items.map((item) => (
                      <option key={item.codigo_item} value={item.codigo_item}>
                        {item.codigo_interno} - {item.nombre} (Stock: {item.stock_actual} {item.unidad_medida})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="tipo_movimiento" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Tipo de Movimiento *
                  </label>
                  <select
                    id="tipo_movimiento"
                    value={formData.tipo_movimiento}
                    onChange={(e) => setFormData({ ...formData, tipo_movimiento: e.target.value })}
                    required
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                  >
                    <option value="">Seleccionar tipo...</option>
                    {TIPO_MOVIMIENTO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cantidad" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    id="cantidad"
                    value={formData.cantidad}
                    onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                    min="1"
                    required
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label htmlFor="motivo" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Motivo / Observaciones
                  </label>
                  <textarea
                    id="motivo"
                    value={formData.motivo}
                    onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                    rows={3}
                    placeholder="Ej: Compra factura #123, Uso en examen, Merma por vencimiento..."
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-lab-neutral-200">
                <Button type="button" onClick={handleCloseForm} variant="outline">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-lab-primary-600 hover:bg-lab-primary-700">
                  Registrar Movimiento
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
