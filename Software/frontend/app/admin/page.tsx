'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'

interface DashboardStats {
  users: {
    total: number
    active: number
  }
  exams: {
    total: number
  }
  appointments: {
    total: number
    today: number
    completed: number
    completionRate: number
  }
  results: {
    pending: number
  }
  inventory: {
    lowStock: number
  }
  revenue: {
    monthly: number
    total: number
  }
  quotations: {
    total: number
    approved: number
    pending: number
    conversionRate: number
  }
  recentExams: Array<{
    code: string
    name: string
    date: Date
  }>
}

interface LoteAbierto {
  codigo_lote: number
  numero_lote: string
  item_nombre: string
  codigo_item: number
  fecha_apertura: string
  fecha_vencimiento_abierto: string
  dias_restantes: number
  horas_restantes: number
  pruebas_realizadas: number
  capacidad_pruebas: number
  pruebas_restantes: number
  porcentaje_uso: number
  frascos_restantes: number
  frascos_totales: number
  estado: string
}

export default function AdminDashboard() {
  const { accessToken } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [lotesAbiertos, setLotesAbiertos] = useState<LoteAbierto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
    loadLotesAbiertos()
  }, [])

  const loadStats = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/dashboard/stats`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadLotesAbiertos = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/reactivos/lotes-abiertos`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setLotesAbiertos(data || [])
      }
    } catch (error) {
      console.error('Error loading lotes abiertos:', error)
    }
  }

  // Filtrar alertas de reactivos
  const lotesVencidos = lotesAbiertos.filter(l => l.estado === 'VENCIDO')
  const lotesCriticos = lotesAbiertos.filter(l => l.estado === 'CRITICO')
  const lotesActivos = lotesAbiertos.filter(l => l.estado === 'ACTIVO')

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
        <h1 className="text-3xl font-bold text-lab-neutral-900">Panel de Administración</h1>
        <p className="text-lab-neutral-600 mt-1">Resumen general del sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Ingresos del Mes */}
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-lab-neutral-600">Ingresos del Mes</p>
              <p className="text-3xl font-bold text-lab-success-600 mt-2">
                ${(stats?.revenue.monthly || 0).toFixed(2)}
              </p>
              <p className="text-sm text-lab-neutral-500 mt-1">Total histórico: ${(stats?.revenue.total || 0).toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-lab-success-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Cotizaciones */}
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-lab-neutral-600">Cotizaciones</p>
              <p className="text-3xl font-bold text-lab-neutral-900 mt-2">{stats?.quotations.total || 0}</p>
              <p className="text-sm text-lab-success-600 mt-1">
                {stats?.quotations.conversionRate || 0}% convertidas
              </p>
            </div>
            <div className="w-12 h-12 bg-lab-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Citas */}
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-lab-neutral-600">Citas</p>
              <p className="text-3xl font-bold text-lab-neutral-900 mt-2">{stats?.appointments.total || 0}</p>
              <p className="text-sm text-lab-info-600 mt-1">
                {stats?.appointments.completionRate || 0}% completadas • {stats?.appointments.today || 0} hoy
              </p>
            </div>
            <div className="w-12 h-12 bg-lab-info-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-info-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Resultados Pendientes */}
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-lab-neutral-600">Resultados Pendientes</p>
              <p className="text-3xl font-bold text-lab-warning-600 mt-2">{stats?.results.pending || 0}</p>
              <p className="text-sm text-lab-neutral-500 mt-1">Requieren procesamiento</p>
            </div>
            <div className="w-12 h-12 bg-lab-warning-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Resultados Pendientes Alert */}
      {stats && stats.results.pending > 0 && (
        <div className="bg-lab-warning-50 border border-lab-warning-200 rounded-xl p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-lab-warning-600 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-lab-warning-900">
                Hay {stats.results.pending} resultados pendientes de procesamiento
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Business Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimos Exámenes */}
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200">
          <div className="px-6 py-4 border-b border-lab-neutral-200">
            <h2 className="text-lg font-semibold text-lab-neutral-900">Últimos Exámenes Agregados</h2>
            <p className="text-sm text-lab-neutral-600 mt-1">5 exámenes más recientes del catálogo</p>
          </div>
          <div className="p-6">
            {stats?.recentExams && stats.recentExams.length > 0 ? (
              <div className="space-y-3">
                {stats.recentExams.map((exam, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-lab-neutral-50 rounded-lg hover:bg-lab-neutral-100 transition-colors">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-10 h-10 bg-lab-primary-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-lab-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-lab-neutral-900 truncate">{exam.name}</p>
                        <p className="text-xs text-lab-neutral-600 font-mono">{exam.code}</p>
                      </div>
                    </div>
                    <div className="text-xs text-lab-neutral-500 ml-2">
                      {new Date(exam.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-lab-neutral-500">
                <p>No hay exámenes disponibles</p>
              </div>
            )}
          </div>
        </div>

        {/* Métricas Adicionales */}
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200">
          <div className="px-6 py-4 border-b border-lab-neutral-200">
            <h2 className="text-lg font-semibold text-lab-neutral-900">Resumen Operativo</h2>
            <p className="text-sm text-lab-neutral-600 mt-1">Métricas clave del sistema</p>
          </div>
          <div className="p-6 space-y-4">
            {/* Usuarios */}
            <div className="flex items-center justify-between p-4 bg-lab-neutral-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-lab-primary-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-lab-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-lab-neutral-900">Usuarios del Sistema</p>
                  <p className="text-xs text-lab-neutral-600">{stats?.users.active || 0} activos de {stats?.users.total || 0} totales</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-lab-neutral-900">{stats?.users.total || 0}</div>
            </div>

            {/* Catálogo */}
            <div className="flex items-center justify-between p-4 bg-lab-neutral-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-lab-secondary-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-lab-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-lab-neutral-900">Exámenes en Catálogo</p>
                  <p className="text-xs text-lab-neutral-600">Servicios activos</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-lab-neutral-900">{stats?.exams.total || 0}</div>
            </div>

            {/* Inventario */}
            <div className="flex items-center justify-between p-4 bg-lab-warning-50 rounded-lg border border-lab-warning-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-lab-warning-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-lab-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-lab-warning-900">Items con Stock Bajo</p>
                  <p className="text-xs text-lab-warning-700">Requiere reabastecimiento</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-lab-warning-600">{stats?.inventory.lowStock || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Widget de Alertas de Reactivos */}
      {lotesAbiertos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200">
          <div className="px-6 py-4 border-b border-lab-neutral-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-lab-neutral-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-lab-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                Control de Reactivos
              </h2>
              <p className="text-sm text-lab-neutral-600 mt-1">Frascos abiertos y alertas</p>
            </div>
            <Link href="/admin/inventario/reactivos" className="text-sm text-lab-primary-600 hover:text-lab-primary-700 font-medium">
              Ver todos →
            </Link>
          </div>

          {/* Resumen de alertas */}
          <div className="grid grid-cols-3 gap-4 p-4 border-b border-lab-neutral-100">
            <div className={`p-3 rounded-lg text-center ${lotesVencidos.length > 0 ? 'bg-red-100' : 'bg-lab-neutral-50'}`}>
              <div className={`text-2xl font-bold ${lotesVencidos.length > 0 ? 'text-red-600' : 'text-lab-neutral-400'}`}>
                {lotesVencidos.length}
              </div>
              <div className="text-xs text-lab-neutral-600">Vencidos</div>
            </div>
            <div className={`p-3 rounded-lg text-center ${lotesCriticos.length > 0 ? 'bg-amber-100' : 'bg-lab-neutral-50'}`}>
              <div className={`text-2xl font-bold ${lotesCriticos.length > 0 ? 'text-amber-600' : 'text-lab-neutral-400'}`}>
                {lotesCriticos.length}
              </div>
              <div className="text-xs text-lab-neutral-600">Por vencer (&lt;24h)</div>
            </div>
            <div className="p-3 rounded-lg text-center bg-green-50">
              <div className="text-2xl font-bold text-green-600">{lotesActivos.length}</div>
              <div className="text-xs text-lab-neutral-600">Activos</div>
            </div>
          </div>

          {/* Lista de alertas */}
          <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
            {lotesVencidos.length > 0 && lotesVencidos.slice(0, 3).map((lote) => (
              <div key={lote.codigo_lote} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-800">{lote.item_nombre}</p>
                    <p className="text-xs text-red-600">Lote: {lote.numero_lote} - VENCIDO</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-red-600 font-medium">Descartar urgente</p>
                  <p className="text-xs text-red-500">
                    {lote.pruebas_realizadas}/{lote.capacidad_pruebas} pruebas usadas
                  </p>
                </div>
              </div>
            ))}

            {lotesCriticos.length > 0 && lotesCriticos.slice(0, 3).map((lote) => (
              <div key={lote.codigo_lote} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-800">{lote.item_nombre}</p>
                    <p className="text-xs text-amber-600">Lote: {lote.numero_lote}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-600 font-medium">Vence en {lote.horas_restantes}h</p>
                  <p className="text-xs text-amber-500">
                    {lote.pruebas_restantes} pruebas restantes
                  </p>
                </div>
              </div>
            ))}

            {lotesActivos.length > 0 && lotesActivos.slice(0, 2).map((lote) => (
              <div key={lote.codigo_lote} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800">{lote.item_nombre}</p>
                    <p className="text-xs text-green-600">Lote: {lote.numero_lote}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-green-600 font-medium">{lote.dias_restantes} dias restantes</p>
                  <p className="text-xs text-green-500">
                    {lote.porcentaje_uso}% usado ({lote.pruebas_realizadas}/{lote.capacidad_pruebas})
                  </p>
                </div>
              </div>
            ))}

            {lotesAbiertos.length === 0 && (
              <div className="text-center py-4 text-lab-neutral-500">
                <p className="text-sm">No hay frascos de reactivos abiertos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <a
          href="/admin/usuarios"
          className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6 hover:border-lab-primary-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-lab-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-lab-neutral-900">Gestionar Usuarios</h3>
              <p className="text-xs text-lab-neutral-600 mt-1">Crear, editar y administrar usuarios</p>
            </div>
          </div>
        </a>

        <a
          href="/admin/examenes"
          className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6 hover:border-lab-secondary-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-lab-secondary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-lab-neutral-900">Gestionar Exámenes</h3>
              <p className="text-xs text-lab-neutral-600 mt-1">Agregar y configurar exámenes</p>
            </div>
          </div>
        </a>

        <a
          href="/admin/auditoria"
          className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6 hover:border-lab-info-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-lab-info-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-info-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-lab-neutral-900">Ver Auditoría</h3>
              <p className="text-xs text-lab-neutral-600 mt-1">Revisar logs y actividad del sistema</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  )
}
