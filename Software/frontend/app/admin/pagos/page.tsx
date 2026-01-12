'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'

interface Pago {
  codigo_pago: number
  codigo_cotizacion: number
  codigo_paciente: number
  monto: number
  metodo_pago: string
  referencia_pago: string | null
  estado: string
  observaciones: string | null
  fecha_pago: string
  fecha_creacion: string
  paciente?: {
    nombres: string
    apellidos: string
    email: string
  }
  cotizacion?: {
    numero_cotizacion: string
    total: number
  }
}

interface Estadisticas {
  total_pagos: number
  monto_total: number
  pagos_pendientes: number
  pagos_confirmados: number
  pagos_rechazados: number
  por_metodo: Array<{ metodo: string; cantidad: number; monto: number }>
}

type TabType = 'lista' | 'estadisticas'

export default function PagosAdminPage() {
  const { accessToken } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabType>('lista')
  const [loading, setLoading] = useState(true)

  // Lista
  const [pagos, setPagos] = useState<Pago[]>([])
  const [filters, setFilters] = useState({
    estado: '',
    metodo_pago: '',
    fecha_desde: '',
    fecha_hasta: '',
  })

  // Estadisticas
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null)

  // Modal
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [updating, setUpdating] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  useEffect(() => {
    if (activeTab === 'lista') {
      loadPagos()
    } else {
      loadEstadisticas()
    }
  }, [activeTab])

  const loadPagos = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.estado) params.append('estado', filters.estado)
      if (filters.metodo_pago) params.append('metodo_pago', filters.metodo_pago)
      if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde)
      if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/pagos/admin/all?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (response.ok) {
        const data = await response.json()
        setPagos(Array.isArray(data) ? data : data.data || [])
      }
    } catch (error) {
      console.error('Error loading pagos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEstadisticas = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde)
      if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/pagos/admin/estadisticas?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (response.ok) {
        const data = await response.json()
        setEstadisticas(data)
      }
    } catch (error) {
      console.error('Error loading estadisticas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePago = async () => {
    if (!selectedPago || !nuevoEstado) return

    setUpdating(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/pagos/admin/${selectedPago.codigo_pago}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ estado: nuevoEstado, observaciones }),
        }
      )

      if (response.ok) {
        setPagos(pagos.map(p =>
          p.codigo_pago === selectedPago.codigo_pago
            ? { ...p, estado: nuevoEstado, observaciones }
            : p
        ))
        setSelectedPago(null)
        setNuevoEstado('')
        setObservaciones('')
      } else {
        alert('Error al actualizar el pago')
      }
    } catch (error) {
      console.error('Error updating pago:', error)
      alert('Error de conexion')
    } finally {
      setUpdating(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado.toUpperCase()) {
      case 'PENDIENTE':
        return 'bg-yellow-100 text-yellow-800'
      case 'CONFIRMADO':
      case 'PAGADO':
        return 'bg-green-100 text-green-800'
      case 'RECHAZADO':
      case 'CANCELADO':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  // Pagination
  const totalPages = Math.ceil(pagos.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentPagos = pagos.slice(startIndex, startIndex + itemsPerPage)

  if (loading && pagos.length === 0 && !estadisticas) {
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
        <h1 className="text-3xl font-bold text-lab-neutral-900">Gestion de Pagos</h1>
        <p className="text-lab-neutral-600 mt-2">
          Administra y supervisa todos los pagos del sistema
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-lab-neutral-200">
        <nav className="flex space-x-8">
          {[
            { id: 'lista', label: 'Lista de Pagos', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
            { id: 'estadisticas', label: 'Estadisticas', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-lab-primary-600 text-lab-primary-600'
                  : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Lista Tab */}
      {activeTab === 'lista' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <select
                    value={filters.estado}
                    onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
                  >
                    <option value="">Todos</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="CONFIRMADO">Confirmado</option>
                    <option value="RECHAZADO">Rechazado</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Metodo de Pago</Label>
                  <select
                    value={filters.metodo_pago}
                    onChange={(e) => setFilters({ ...filters, metodo_pago: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
                  >
                    <option value="">Todos</option>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha Desde</Label>
                  <Input
                    type="date"
                    value={filters.fecha_desde}
                    onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Hasta</Label>
                  <Input
                    type="date"
                    value={filters.fecha_hasta}
                    onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })}
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <Button onClick={loadPagos} className="w-full">
                    Buscar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Total Pagos</div>
                <div className="text-2xl font-bold text-lab-neutral-900 mt-1">{pagos.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Monto Total</div>
                <div className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(pagos.reduce((sum, p) => sum + (p.monto || 0), 0))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Pendientes</div>
                <div className="text-2xl font-bold text-yellow-600 mt-1">
                  {pagos.filter(p => p.estado === 'PENDIENTE').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Confirmados</div>
                <div className="text-2xl font-bold text-green-600 mt-1">
                  {pagos.filter(p => p.estado === 'CONFIRMADO' || p.estado === 'PAGADO').length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Listado de Pagos</CardTitle>
              <CardDescription>Click en un pago para gestionar su estado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-lab-neutral-200">
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">ID</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Paciente</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Cotizacion</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Monto</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Metodo</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Estado</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Fecha</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPagos.map((pago) => (
                      <tr key={pago.codigo_pago} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                        <td className="p-4 text-sm font-mono">{pago.codigo_pago}</td>
                        <td className="p-4">
                          {pago.paciente ? (
                            <div>
                              <div className="font-medium text-sm">
                                {pago.paciente.nombres} {pago.paciente.apellidos}
                              </div>
                              <div className="text-xs text-lab-neutral-500">{pago.paciente.email}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-lab-neutral-500">ID: {pago.codigo_paciente}</span>
                          )}
                        </td>
                        <td className="p-4 text-sm font-mono">
                          {pago.cotizacion?.numero_cotizacion || `#${pago.codigo_cotizacion}`}
                        </td>
                        <td className="p-4 text-sm font-bold text-green-600">
                          {formatCurrency(pago.monto)}
                        </td>
                        <td className="p-4 text-sm">{pago.metodo_pago}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getEstadoBadge(pago.estado)}`}>
                            {pago.estado}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-lab-neutral-600">
                          {formatDate(new Date(pago.fecha_pago || pago.fecha_creacion))}
                        </td>
                        <td className="p-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPago(pago)
                              setNuevoEstado(pago.estado)
                              setObservaciones(pago.observaciones || '')
                            }}
                          >
                            Gestionar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {pagos.length === 0 && (
                  <div className="text-center py-12 text-lab-neutral-500">
                    No se encontraron pagos
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <div className="text-sm text-lab-neutral-600">
                    Mostrando {startIndex + 1} - {Math.min(startIndex + itemsPerPage, pagos.length)} de {pagos.length}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <span className="px-3 py-1 text-sm">
                      Pagina {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Estadisticas Tab */}
      {activeTab === 'estadisticas' && estadisticas && (
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Fecha Desde</Label>
                  <Input
                    type="date"
                    value={filters.fecha_desde}
                    onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Hasta</Label>
                  <Input
                    type="date"
                    value={filters.fecha_hasta}
                    onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })}
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <Button onClick={loadEstadisticas} className="w-full">
                    Actualizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Total Pagos</div>
                <div className="text-3xl font-bold text-lab-neutral-900 mt-2">
                  {estadisticas.total_pagos}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Monto Total</div>
                <div className="text-3xl font-bold text-green-600 mt-2">
                  {formatCurrency(estadisticas.monto_total || 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Pendientes</div>
                <div className="text-3xl font-bold text-yellow-600 mt-2">
                  {estadisticas.pagos_pendientes}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Confirmados</div>
                <div className="text-3xl font-bold text-green-600 mt-2">
                  {estadisticas.pagos_confirmados}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Por Metodo */}
          <Card>
            <CardHeader>
              <CardTitle>Pagos por Metodo</CardTitle>
              <CardDescription>Distribucion de pagos segun metodo de pago</CardDescription>
            </CardHeader>
            <CardContent>
              {estadisticas.por_metodo && estadisticas.por_metodo.length > 0 ? (
                <div className="space-y-4">
                  {estadisticas.por_metodo.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-lab-neutral-50 rounded-lg">
                      <div>
                        <div className="font-medium">{item.metodo}</div>
                        <div className="text-sm text-lab-neutral-500">{item.cantidad} pagos</div>
                      </div>
                      <div className="text-xl font-bold text-green-600">
                        {formatCurrency(item.monto)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-lab-neutral-500">No hay datos disponibles</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal para gestionar pago */}
      {selectedPago && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold mb-4">Gestionar Pago #{selectedPago.codigo_pago}</h3>

            <div className="space-y-4">
              <div className="p-4 bg-lab-neutral-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-lab-neutral-600">Monto:</div>
                  <div className="font-bold text-green-600">{formatCurrency(selectedPago.monto)}</div>
                  <div className="text-lab-neutral-600">Metodo:</div>
                  <div>{selectedPago.metodo_pago}</div>
                  <div className="text-lab-neutral-600">Referencia:</div>
                  <div>{selectedPago.referencia_pago || '-'}</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nuevo Estado</Label>
                <select
                  value={nuevoEstado}
                  onChange={(e) => setNuevoEstado(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
                >
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="CONFIRMADO">Confirmado</option>
                  <option value="RECHAZADO">Rechazado</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Observaciones</Label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full h-24 px-3 py-2 rounded-md border border-lab-neutral-300"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setSelectedPago(null)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdatePago} disabled={updating}>
                {updating ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
