'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'

interface LogActividad {
  codigo_log: number
  codigo_usuario: number | null
  accion: string
  entidad: string | null
  codigo_entidad: number | null
  descripcion: string | null
  ip_address: string | null
  fecha_accion: string
  usuario: {
    nombres: string
    apellidos: string
    email: string
  } | null
}

export default function AuditoriaPage() {
  const { accessToken } = useAuthStore()
  const [logs, setLogs] = useState<LogActividad[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [entidadFilter, setEntidadFilter] = useState('TODAS')
  const [limit, setLimit] = useState(50)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    loadLogs()
  }, [limit])

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams()
      params.append('limit', limit.toString())

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/audit/activity-logs?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.ok) {
        const result = await response.json()
        // Backend returns paginated data: { data: [], pagination: {} }
        const logs = result.data || result
        setLogs(logs)
      }
    } catch (error) {
      console.error('Error loading logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      searchTerm === '' ||
      log.accion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entidad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.usuario?.nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.usuario?.apellidos.toLowerCase().includes(searchTerm.toLowerCase())

    const matchEntidad = entidadFilter === 'TODAS' || log.entidad === entidadFilter

    const logDate = new Date(log.fecha_accion)
    const matchFechaDesde = !fechaDesde || logDate >= new Date(fechaDesde)
    const matchFechaHasta = !fechaHasta || logDate <= new Date(fechaHasta + 'T23:59:59')

    return matchSearch && matchEntidad && matchFechaDesde && matchFechaHasta
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentLogs = filteredLogs.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, entidadFilter, fechaDesde, fechaHasta])

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true)
    try {
      const params = new URLSearchParams()
      if (fechaDesde) params.append('fecha_desde', fechaDesde)
      if (fechaHasta) params.append('fecha_hasta', fechaHasta)
      if (entidadFilter !== 'TODAS') params.append('entidad', entidadFilter)
      if (searchTerm) params.append('search', searchTerm)
      params.append('limit', limit.toString())

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/audit/activity-logs/pdf?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte-auditoria-${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('Error al generar el PDF')
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error de conexión al servidor')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const entidades = Array.from(new Set(logs.map((log) => log.entidad).filter(Boolean)))

  const getAccionBadge = (accion: string) => {
    if (accion.includes('create') || accion.includes('created')) {
      return 'bg-lab-success-100 text-lab-success-800'
    }
    if (accion.includes('update') || accion.includes('updated')) {
      return 'bg-lab-info-100 text-lab-info-800'
    }
    if (accion.includes('delete') || accion.includes('deleted')) {
      return 'bg-lab-danger-100 text-lab-danger-800'
    }
    if (accion.includes('login')) {
      return 'bg-lab-primary-100 text-lab-primary-800'
    }
    return 'bg-lab-neutral-100 text-lab-neutral-800'
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
        <h1 className="text-3xl font-bold text-lab-neutral-900">Auditoría del Sistema</h1>
        <p className="text-lab-neutral-600 mt-2">
          Registro completo de todas las actividades realizadas en el sistema
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <Input
                placeholder="Acción, entidad, usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Filtrar por Entidad</Label>
              <select
                value={entidadFilter}
                onChange={(e) => setEntidadFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
              >
                <option value="TODAS">Todas</option>
                {entidades.map((entidad) => (
                  <option key={entidad} value={entidad!}>
                    {entidad}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Registros a Mostrar</Label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>

            <div className="space-y-2 flex items-end">
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="w-full h-10 px-4 bg-lab-danger-600 hover:bg-lab-danger-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {generatingPdf ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>Generar PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Total de Logs</div>
            <div className="text-2xl font-bold text-lab-neutral-900 mt-2">{logs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Creaciones</div>
            <div className="text-2xl font-bold text-lab-success-600 mt-2">
              {logs.filter((log) => log.accion.includes('create') || log.accion.includes('created')).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Actualizaciones</div>
            <div className="text-2xl font-bold text-lab-info-600 mt-2">
              {logs.filter((log) => log.accion.includes('update') || log.accion.includes('updated')).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Eliminaciones</div>
            <div className="text-2xl font-bold text-lab-danger-600 mt-2">
              {logs.filter((log) => log.accion.includes('delete') || log.accion.includes('deleted')).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registro de Actividades ({filteredLogs.length})</CardTitle>
          <CardDescription>Trazabilidad completa del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-lab-neutral-200">
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Fecha</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Usuario</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Acción</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Entidad</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">ID</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">IP</th>
                </tr>
              </thead>
              <tbody>
                {currentLogs.map((log) => (
                  <tr key={log.codigo_log} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                    <td className="p-4 text-sm text-lab-neutral-700">
                      <div>{formatDate(new Date(log.fecha_accion))}</div>
                      <div className="text-xs text-lab-neutral-500">
                        {new Date(log.fecha_accion).toLocaleTimeString('es-ES')}
                      </div>
                    </td>
                    <td className="p-4">
                      {log.usuario ? (
                        <div>
                          <div className="font-medium text-lab-neutral-900 text-sm">
                            {log.usuario.nombres} {log.usuario.apellidos}
                          </div>
                          <div className="text-xs text-lab-neutral-600">{log.usuario.email}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-lab-neutral-500">Sistema</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded ${getAccionBadge(log.accion)}`}>
                        {log.accion}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-lab-neutral-700">{log.entidad || '-'}</td>
                    <td className="p-4 text-sm font-mono text-lab-neutral-600">{log.codigo_entidad || '-'}</td>
                    <td className="p-4 text-sm text-lab-neutral-600">{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-lab-neutral-500">No se encontraron registros</div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-lab-neutral-200">
              <div className="text-sm text-lab-neutral-600">
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredLogs.length)} de {filteredLogs.length} registros
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm rounded-md border border-lab-neutral-300 hover:bg-lab-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Primera
                </button>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm rounded-md border border-lab-neutral-300 hover:bg-lab-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="px-3 py-1 text-sm text-lab-neutral-700">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm rounded-md border border-lab-neutral-300 hover:bg-lab-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm rounded-md border border-lab-neutral-300 hover:bg-lab-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
