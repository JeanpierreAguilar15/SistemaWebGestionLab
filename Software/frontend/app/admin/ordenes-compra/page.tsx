'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Proveedor {
  codigo_proveedor: number
  razon_social: string
  nombre_comercial: string | null
}

interface Item {
  codigo_item: number
  codigo_interno: string
  nombre: string
  unidad_medida: string
  costo_unitario: number
}

interface DetalleOrden {
  codigo_detalle?: number
  codigo_item: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  item?: Item
}

interface OrdenCompra {
  codigo_orden: number
  numero_orden: string
  codigo_proveedor: number
  fecha_orden: string
  fecha_entrega_esperada: string | null
  estado: 'BORRADOR' | 'EMITIDA' | 'RECIBIDA' | 'CANCELADA'
  subtotal: number
  impuestos: number
  total: number
  observaciones: string | null
  proveedor?: Proveedor
  detalles?: DetalleOrden[]
}

interface PaginationInfo {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface OrderStats {
  total: number
  borradores: number
  emitidas: number
  recibidasMes: number
  montoPendiente: number
}

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-800',
  EMITIDA: 'bg-blue-100 text-blue-800',
  RECIBIDA: 'bg-green-100 text-green-800',
  CANCELADA: 'bg-red-100 text-red-800',
}

const estadoLabels: Record<string, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Emitida',
  RECIBIDA: 'Recibida',
  CANCELADA: 'Cancelada',
}

export default function OrdenesCompraPage() {
  const { accessToken } = useAuthStore()
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedOrden, setSelectedOrden] = useState<OrdenCompra | null>(null)
  const [editingOrden, setEditingOrden] = useState<OrdenCompra | null>(null)
  const [filterEstado, setFilterEstado] = useState<string>('all')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    borradores: 0,
    emitidas: 0,
    recibidasMes: 0,
    montoPendiente: 0,
  })

  // Form state
  const [formData, setFormData] = useState({
    codigo_proveedor: '',
    fecha_entrega_esperada: '',
    observaciones: '',
    detalles: [] as { codigo_item: string; cantidad: string; precio_unitario: string }[],
  })

  useEffect(() => {
    loadOrdenes()
    loadProveedores()
    loadItems()
    loadStats()
  }, [currentPage, filterEstado])

  const loadOrdenes = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      })

      if (filterEstado !== 'all') {
        params.append('estado', filterEstado)
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (response.ok) {
        const result = await response.json()
        setOrdenes(result.data || [])
        setPagination(result.pagination || null)
      }
    } catch (error) {
      console.error('Error loading ordenes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProveedores = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/suppliers`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (response.ok) {
        const data = await response.json()
        setProveedores(data)
      }
    } catch (error) {
      console.error('Error loading proveedores:', error)
    }
  }

  const loadItems = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/items?limit=500`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (response.ok) {
        const result = await response.json()
        setItems(result.data || result || [])
      }
    } catch (error) {
      console.error('Error loading items:', error)
    }
  }

  const loadStats = async () => {
    try {
      // Cargar todas las órdenes para calcular estadísticas
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders?limit=1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (response.ok) {
        const result = await response.json()
        const allOrders: OrdenCompra[] = result.data || []

        // Calcular estadísticas
        const borradores = allOrders.filter((o) => o.estado === 'BORRADOR')
        const emitidas = allOrders.filter((o) => o.estado === 'EMITIDA')

        // Órdenes recibidas este mes
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const recibidasMes = allOrders.filter((o) => {
          if (o.estado !== 'RECIBIDA') return false
          const fechaOrden = new Date(o.fecha_orden)
          return fechaOrden >= firstDayOfMonth
        })

        // Monto pendiente de recibir (órdenes emitidas)
        const montoPendiente = emitidas.reduce((sum, o) => sum + Number(o.total), 0)

        setStats({
          total: allOrders.length,
          borradores: borradores.length,
          emitidas: emitidas.length,
          recibidasMes: recibidasMes.length,
          montoPendiente,
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.codigo_proveedor) {
      setMessage({ type: 'error', text: 'Debe seleccionar un proveedor' })
      return
    }

    if (formData.detalles.length === 0) {
      setMessage({ type: 'error', text: 'Debe agregar al menos un item a la orden' })
      return
    }

    // Validar detalles
    for (const detalle of formData.detalles) {
      if (!detalle.codigo_item || !detalle.cantidad || !detalle.precio_unitario) {
        setMessage({ type: 'error', text: 'Todos los items deben tener cantidad y precio' })
        return
      }
    }

    const ordenData = {
      codigo_proveedor: parseInt(formData.codigo_proveedor),
      fecha_entrega_esperada: formData.fecha_entrega_esperada || null,
      observaciones: formData.observaciones || null,
      detalles: formData.detalles.map((d) => ({
        codigo_item: parseInt(d.codigo_item),
        cantidad: parseInt(d.cantidad),
        precio_unitario: parseFloat(d.precio_unitario),
      })),
    }

    try {
      const url = editingOrden
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders/${editingOrden.codigo_orden}`
        : `${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders`

      const response = await fetch(url, {
        method: editingOrden ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(ordenData),
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: editingOrden ? 'Orden de compra actualizada correctamente' : 'Orden de compra creada correctamente',
        })
        loadOrdenes()
        handleCloseModal()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al guardar orden' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleEmit = async (codigo_orden: number) => {
    if (!confirm('¿Está seguro de emitir esta orden de compra? Una vez emitida no podrá modificarse. Se descargará el PDF para imprimir.')) return

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders/${codigo_orden}/emit`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )

      if (response.ok) {
        setMessage({ type: 'success', text: 'Orden emitida correctamente. Descargando PDF...' })
        loadOrdenes()
        loadStats()
        // Descargar PDF automáticamente después de emitir
        await handleExportPdf(codigo_orden)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al emitir orden' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
  }

  const handleReceive = async (codigo_orden: number) => {
    if (!confirm('¿Confirma la recepción de esta orden? Esto actualizará el inventario.')) return

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders/${codigo_orden}/receive`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}),
        }
      )

      if (response.ok) {
        setMessage({ type: 'success', text: 'Orden recibida - Inventario actualizado' })
        loadOrdenes()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al recibir orden' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
  }

  const handleCancel = async (codigo_orden: number) => {
    if (!confirm('¿Está seguro de cancelar esta orden de compra?')) return

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders/${codigo_orden}/cancel`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )

      if (response.ok) {
        setMessage({ type: 'success', text: 'Orden cancelada' })
        loadOrdenes()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al cancelar orden' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
  }

  const handleViewDetails = async (orden: OrdenCompra) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders/${orden.codigo_orden}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (response.ok) {
        const data = await response.json()
        setSelectedOrden(data)
        setShowDetailsModal(true)
      }
    } catch (error) {
      console.error('Error loading order details:', error)
    }
  }

  const handleAddItem = () => {
    setFormData({
      ...formData,
      detalles: [...formData.detalles, { codigo_item: '', cantidad: '1', precio_unitario: '' }],
    })
  }

  const handleRemoveItem = (index: number) => {
    const newDetalles = formData.detalles.filter((_, i) => i !== index)
    setFormData({ ...formData, detalles: newDetalles })
  }

  const handleItemChange = (index: number, field: string, value: string) => {
    const newDetalles = [...formData.detalles]
    newDetalles[index] = { ...newDetalles[index], [field]: value }

    // Auto-fill precio if item is selected
    if (field === 'codigo_item' && value) {
      const item = items.find((i) => i.codigo_item === parseInt(value))
      if (item) {
        newDetalles[index].precio_unitario = item.costo_unitario?.toString() || ''
      }
    }

    setFormData({ ...formData, detalles: newDetalles })
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingOrden(null)
    setFormData({
      codigo_proveedor: '',
      fecha_entrega_esperada: '',
      observaciones: '',
      detalles: [],
    })
  }

  const handleEdit = async (orden: OrdenCompra) => {
    // Cargar detalles completos de la orden
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders/${orden.codigo_orden}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (response.ok) {
        const data = await response.json()
        setEditingOrden(data)
        setFormData({
          codigo_proveedor: data.codigo_proveedor?.toString() || '',
          fecha_entrega_esperada: data.fecha_entrega_esperada
            ? new Date(data.fecha_entrega_esperada).toISOString().split('T')[0]
            : '',
          observaciones: data.observaciones || '',
          detalles: (data.detalles || []).map((d: any) => ({
            codigo_item: d.codigo_item?.toString() || '',
            cantidad: d.cantidad?.toString() || '1',
            precio_unitario: d.precio_unitario?.toString() || '',
          })),
        })
        setShowModal(true)
      }
    } catch (error) {
      console.error('Error loading order for edit:', error)
      setMessage({ type: 'error', text: 'Error al cargar orden para edición' })
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-EC')
  }

  const calcularTotal = () => {
    return formData.detalles.reduce((total, d) => {
      const cantidad = parseInt(d.cantidad) || 0
      const precio = parseFloat(d.precio_unitario) || 0
      return total + cantidad * precio
    }, 0)
  }

  const handleExportPdf = async (codigoOrden: number) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders/${codigoOrden}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `OC-${codigoOrden}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        setMessage({ type: 'success', text: 'PDF descargado correctamente' })
      } else {
        setMessage({ type: 'error', text: 'Error al generar PDF' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al generar PDF' })
    }
  }

  if (loading && ordenes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-lab-neutral-900">Órdenes de Compra</h1>
          <p className="text-lab-neutral-600 mt-2">
            Gestiona las órdenes de compra de inventario y reactivos.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Orden
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-lab-success-50 text-lab-success-800 border border-lab-success-200'
              : 'bg-lab-danger-50 text-lab-danger-800 border border-lab-danger-200'
          }`}
        >
          {message.text}
          <button onClick={() => setMessage(null)} className="float-right">&times;</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-lab-primary-50 to-white border-lab-primary-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-lab-primary-600">Total Órdenes</p>
                <p className="text-3xl font-bold text-lab-primary-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-lab-primary-100 rounded-full">
                <svg className="w-6 h-6 text-lab-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">En Borrador</p>
                <p className="text-3xl font-bold text-gray-900">{stats.borradores}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-full">
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Emitidas</p>
                <p className="text-3xl font-bold text-blue-900">{stats.emitidas}</p>
                <p className="text-xs text-blue-500">Pendientes de recibir</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Recibidas (Mes)</p>
                <p className="text-3xl font-bold text-green-900">{stats.recibidasMes}</p>
                <p className="text-xs text-green-500">{new Date().toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">Monto Pendiente</p>
                <p className="text-2xl font-bold text-amber-900">{formatCurrency(stats.montoPendiente)}</p>
                <p className="text-xs text-amber-500">En órdenes emitidas</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <select
            value={filterEstado}
            onChange={(e) => {
              setFilterEstado(e.target.value)
              setCurrentPage(1)
            }}
            className="h-10 px-3 rounded-md border border-lab-neutral-300"
          >
            <option value="all">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="EMITIDA">Emitida</option>
            <option value="RECIBIDA">Recibida</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Órdenes {pagination && `(${pagination.total} total)`}</CardTitle>
          <CardDescription>Lista de órdenes de compra</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-lab-neutral-200">
                  <th className="text-left p-4 font-semibold">N° Orden</th>
                  <th className="text-left p-4 font-semibold">Proveedor</th>
                  <th className="text-left p-4 font-semibold">Fecha</th>
                  <th className="text-left p-4 font-semibold">Entrega Est.</th>
                  <th className="text-right p-4 font-semibold">Total</th>
                  <th className="text-left p-4 font-semibold">Estado</th>
                  <th className="text-right p-4 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((orden) => (
                  <tr key={orden.codigo_orden} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                    <td className="p-4 font-mono text-sm">{orden.numero_orden}</td>
                    <td className="p-4">
                      {orden.proveedor?.nombre_comercial || orden.proveedor?.razon_social || 'N/A'}
                    </td>
                    <td className="p-4 text-sm">{formatDate(orden.fecha_orden)}</td>
                    <td className="p-4 text-sm">{formatDate(orden.fecha_entrega_esperada)}</td>
                    <td className="p-4 text-right font-bold">{formatCurrency(Number(orden.total))}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${estadoColors[orden.estado]}`}>
                        {estadoLabels[orden.estado]}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => handleViewDetails(orden)}>
                        Ver
                      </Button>
                      {orden.estado === 'BORRADOR' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(orden)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEmit(orden.codigo_orden)}>
                            Emitir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => handleCancel(orden.codigo_orden)}
                          >
                            Cancelar
                          </Button>
                        </>
                      )}
                      {orden.estado === 'EMITIDA' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            onClick={() => handleReceive(orden.codigo_orden)}
                          >
                            Recibir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => handleCancel(orden.codigo_orden)}
                          >
                            Cancelar
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {ordenes.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-lab-neutral-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lab-neutral-500 text-lg mb-2">No se encontraron órdenes</p>
                <p className="text-lab-neutral-400 text-sm mb-4">
                  {filterEstado !== 'all'
                    ? `No hay órdenes con estado "${estadoLabels[filterEstado as keyof typeof estadoLabels] || filterEstado}"`
                    : 'Crea tu primera orden de compra para comenzar'}
                </p>
                {filterEstado === 'all' && (
                  <Button onClick={() => setShowModal(true)}>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Crear Primera Orden
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm">Página {currentPage} de {pagination.totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === pagination.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-3xl w-full my-8">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">{editingOrden ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}</h2>
                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor *</Label>
                  <select
                    value={formData.codigo_proveedor}
                    onChange={(e) => setFormData({ ...formData, codigo_proveedor: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {proveedores.map((p) => (
                      <option key={p.codigo_proveedor} value={p.codigo_proveedor}>
                        {p.nombre_comercial || p.razon_social}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha Entrega Esperada</Label>
                  <Input
                    type="date"
                    value={formData.fecha_entrega_esperada}
                    onChange={(e) => setFormData({ ...formData, fecha_entrega_esperada: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observaciones</Label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border"
                />
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Items de la Orden *</Label>
                  <Button type="button" size="sm" onClick={handleAddItem}>
                    + Agregar Item
                  </Button>
                </div>

                {formData.detalles.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No hay items. Haga clic en "Agregar Item" para comenzar.
                  </p>
                )}

                {formData.detalles.map((detalle, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <select
                        value={detalle.codigo_item}
                        onChange={(e) => handleItemChange(index, 'codigo_item', e.target.value)}
                        className="w-full h-9 px-2 text-sm rounded border"
                        required
                      >
                        <option value="">Seleccionar item...</option>
                        {items.map((item) => (
                          <option key={item.codigo_item} value={item.codigo_item}>
                            {item.codigo_interno} - {item.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Cant."
                        value={detalle.cantidad}
                        onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                        className="h-9 text-sm"
                        required
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Precio"
                        value={detalle.precio_unitario}
                        onChange={(e) => handleItemChange(index, 'precio_unitario', e.target.value)}
                        className="h-9 text-sm"
                        required
                      />
                    </div>
                    <div className="w-24 text-right font-semibold text-sm pt-2">
                      {formatCurrency(
                        (parseInt(detalle.cantidad) || 0) * (parseFloat(detalle.precio_unitario) || 0)
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-600 h-9"
                      onClick={() => handleRemoveItem(index)}
                    >
                      X
                    </Button>
                  </div>
                ))}

                {formData.detalles.length > 0 && (
                  <div className="text-right pt-2 border-t">
                    <span className="font-bold text-lg">Total: {formatCurrency(calcularTotal())}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit">{editingOrden ? 'Guardar Cambios' : 'Crear Orden'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedOrden && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Orden {selectedOrden.numero_orden}</h2>
                <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Proveedor:</span>
                  <p className="font-medium">
                    {selectedOrden.proveedor?.nombre_comercial || selectedOrden.proveedor?.razon_social}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Estado:</span>
                  <p>
                    <span className={`px-2 py-1 rounded-full text-xs ${estadoColors[selectedOrden.estado]}`}>
                      {estadoLabels[selectedOrden.estado]}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Fecha Orden:</span>
                  <p className="font-medium">{formatDate(selectedOrden.fecha_orden)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Entrega Esperada:</span>
                  <p className="font-medium">{formatDate(selectedOrden.fecha_entrega_esperada)}</p>
                </div>
              </div>

              {selectedOrden.observaciones && (
                <div>
                  <span className="text-gray-500 text-sm">Observaciones:</span>
                  <p className="text-sm">{selectedOrden.observaciones}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Items</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Item</th>
                      <th className="text-right p-2">Cant.</th>
                      <th className="text-right p-2">Precio</th>
                      <th className="text-right p-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrden.detalles?.map((d, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{d.item?.nombre || `Item #${d.codigo_item}`}</td>
                        <td className="p-2 text-right">{d.cantidad}</td>
                        <td className="p-2 text-right">{formatCurrency(Number(d.precio_unitario))}</td>
                        <td className="p-2 text-right">{formatCurrency(Number(d.subtotal))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td colSpan={3} className="p-2 text-right">Total:</td>
                      <td className="p-2 text-right">{formatCurrency(Number(selectedOrden.total))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
