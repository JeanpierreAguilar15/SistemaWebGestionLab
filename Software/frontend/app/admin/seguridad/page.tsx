'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSession } from '@/contexts/SessionContext'
import { useSecurity } from '@/contexts/SecurityProvider'
import { isDataEncrypted, logStorageStatus } from '@/lib/secure-storage'
import { Shield, Lock, Clock, Eye, CheckCircle, XCircle } from 'lucide-react'

interface LoginStats {
  total_intentos: number
  intentos_exitosos: number
  intentos_fallidos: number
  tasa_exito: string
  top_ips_fallidas: Array<{ ip_address: string; intentos: number }>
}

interface Alerta {
  codigo_alerta: number
  tipo: string
  nivel: 'WARNING' | 'CRITICAL'
  mensaje: string
  ip_address: string | null
  codigo_usuario: number | null
  resuelta: boolean
  fecha_alerta: string
}

interface DashboardData {
  resumen: {
    periodo: string
    total_intentos_login: number
    intentos_exitosos: number
    intentos_fallidos: number
    tasa_exito: string
    alertas_activas: number
    alertas_criticas: number
  }
  top_ips_sospechosas: Array<{ ip_address: string; intentos: number }>
  alertas_recientes: Alerta[]
  estado_sistema: {
    estado: 'NORMAL' | 'ALERTA' | 'CRITICO'
    mensaje: string
    recomendaciones: string[]
  }
}

interface AuditHistorial {
  codigo_auditoria: number
  nombre_tabla: string
  operacion: string
  registro_id: number
  datos_anteriores: any
  datos_nuevos: any
  fecha_operacion: string
  usuario_bd: string
}

type TabType = 'dashboard' | 'alertas' | 'historial' | 'configuracion'

export default function SeguridadPage() {
  const { accessToken } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [loading, setLoading] = useState(true)

  // Hooks de seguridad
  const { sessionTimeout, setSessionTimeout } = useSession()
  const { securityEnabled, setSecurityEnabled, inspectionAttempts, devToolsDetected } = useSecurity()
  const [newTimeout, setNewTimeout] = useState(sessionTimeout.toString())
  const [storageEncrypted, setStorageEncrypted] = useState(false)

  // Verificar cifrado al montar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { encrypted } = isDataEncrypted('auth-storage')
      setStorageEncrypted(encrypted)
    }
  }, [])

  // Dashboard data
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

  // Alertas
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [resolvingAlert, setResolvingAlert] = useState<number | null>(null)

  // Historial
  const [historial, setHistorial] = useState<AuditHistorial[]>([])
  const [tablaFilter, setTablaFilter] = useState('usuarios.usuario')
  const [registroFilter, setRegistroFilter] = useState('')

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard()
    } else if (activeTab === 'alertas') {
      loadAlertas()
    } else if (activeTab === 'historial') {
      loadHistorial()
    }
  }, [activeTab])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/seguridad/dashboard`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (response.ok) {
        const data = await response.json()
        setDashboardData(data)
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAlertas = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/seguridad/alertas`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (response.ok) {
        const data = await response.json()
        setAlertas(data.alertas || [])
      }
    } catch (error) {
      console.error('Error loading alertas:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadHistorial = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (registroFilter) params.append('registro', registroFilter)
      params.append('limit', '50')

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/seguridad/auditoria/${encodeURIComponent(tablaFilter)}?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (response.ok) {
        const data = await response.json()
        setHistorial(data.historial || [])
      }
    } catch (error) {
      console.error('Error loading historial:', error)
    } finally {
      setLoading(false)
    }
  }

  const resolverAlerta = async (alertaId: number) => {
    setResolvingAlert(alertaId)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/seguridad/alertas/${alertaId}/resolver`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      if (response.ok) {
        setAlertas(alertas.filter(a => a.codigo_alerta !== alertaId))
      } else {
        alert('Error al resolver la alerta')
      }
    } catch (error) {
      console.error('Error resolving alert:', error)
      alert('Error de conexion')
    } finally {
      setResolvingAlert(null)
    }
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'NORMAL':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'ALERTA':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'CRITICO':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getNivelBadge = (nivel: string) => {
    return nivel === 'CRITICAL'
      ? 'bg-red-100 text-red-800'
      : 'bg-yellow-100 text-yellow-800'
  }

  const tablasDisponibles = [
    { value: 'usuarios.usuario', label: 'Usuarios' },
    { value: 'catalogo.examen', label: 'Examenes' },
    { value: 'catalogo.precio', label: 'Precios' },
    { value: 'citas.cita', label: 'Citas' },
    { value: 'resultados.muestra', label: 'Muestras' },
  ]

  if (loading && !dashboardData && alertas.length === 0 && historial.length === 0) {
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
        <h1 className="text-3xl font-bold text-lab-neutral-900">Seguridad del Sistema</h1>
        <p className="text-lab-neutral-600 mt-2">
          Monitoreo de seguridad, alertas y auditoria de cambios
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-lab-neutral-200">
        <nav className="flex space-x-8">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { id: 'alertas', label: 'Alertas', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
            { id: 'historial', label: 'Historial Cambios', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { id: 'configuracion', label: 'Configuracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
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

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboardData && (
        <div className="space-y-6">
          {/* Estado del Sistema */}
          <Card className={`border-2 ${getEstadoBadge(dashboardData.estado_sistema.estado)}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full ${
                      dashboardData.estado_sistema.estado === 'NORMAL' ? 'bg-green-500' :
                      dashboardData.estado_sistema.estado === 'ALERTA' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <h2 className="text-xl font-bold">
                      Estado: {dashboardData.estado_sistema.estado}
                    </h2>
                  </div>
                  <p className="mt-2 text-lab-neutral-700">{dashboardData.estado_sistema.mensaje}</p>
                </div>
                <div className="text-right text-sm text-lab-neutral-600">
                  {dashboardData.resumen.periodo}
                </div>
              </div>
              {dashboardData.estado_sistema.recomendaciones.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="font-medium text-sm mb-2">Recomendaciones:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {dashboardData.estado_sistema.recomendaciones.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Total Intentos Login</div>
                <div className="text-3xl font-bold text-lab-neutral-900 mt-2">
                  {dashboardData.resumen.total_intentos_login}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Exitosos</div>
                <div className="text-3xl font-bold text-green-600 mt-2">
                  {dashboardData.resumen.intentos_exitosos}
                </div>
                <div className="text-sm text-lab-neutral-500">
                  Tasa: {dashboardData.resumen.tasa_exito}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Fallidos</div>
                <div className="text-3xl font-bold text-red-600 mt-2">
                  {dashboardData.resumen.intentos_fallidos}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Alertas Activas</div>
                <div className="text-3xl font-bold text-yellow-600 mt-2">
                  {dashboardData.resumen.alertas_activas}
                </div>
                <div className="text-sm text-red-600">
                  {dashboardData.resumen.alertas_criticas} criticas
                </div>
              </CardContent>
            </Card>
          </div>

          {/* IPs Sospechosas y Alertas Recientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top IPs con Fallos</CardTitle>
                <CardDescription>IPs con mas intentos fallidos</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData.top_ips_sospechosas.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.top_ips_sospechosas.map((ip, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-lab-neutral-50 rounded-lg">
                        <span className="font-mono text-sm">{ip.ip_address || 'N/A'}</span>
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">
                          {ip.intentos} intentos
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-lab-neutral-500 text-center py-4">No hay IPs sospechosas</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas Recientes</CardTitle>
                <CardDescription>Ultimas 5 alertas del sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData.alertas_recientes.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.alertas_recientes.map((alerta) => (
                      <div key={alerta.codigo_alerta} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getNivelBadge(alerta.nivel)}`}>
                            {alerta.nivel}
                          </span>
                          <span className="text-xs text-lab-neutral-500">
                            {new Date(alerta.fecha_alerta).toLocaleString('es-ES')}
                          </span>
                        </div>
                        <p className="mt-2 text-sm">{alerta.mensaje}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-lab-neutral-500 text-center py-4">No hay alertas recientes</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Alertas Tab */}
      {activeTab === 'alertas' && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Seguridad Activas</CardTitle>
            <CardDescription>Gestiona y resuelve las alertas del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas.length > 0 ? (
              <div className="space-y-4">
                {alertas.map((alerta) => (
                  <div
                    key={alerta.codigo_alerta}
                    className={`p-4 border-l-4 rounded-lg ${
                      alerta.nivel === 'CRITICAL'
                        ? 'border-l-red-500 bg-red-50'
                        : 'border-l-yellow-500 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getNivelBadge(alerta.nivel)}`}>
                            {alerta.nivel}
                          </span>
                          <span className="text-sm font-medium text-lab-neutral-700">{alerta.tipo}</span>
                        </div>
                        <p className="mt-2 text-sm text-lab-neutral-800">{alerta.mensaje}</p>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-lab-neutral-500">
                          {alerta.ip_address && <span>IP: {alerta.ip_address}</span>}
                          <span>{new Date(alerta.fecha_alerta).toLocaleString('es-ES')}</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => resolverAlerta(alerta.codigo_alerta)}
                        disabled={resolvingAlert === alerta.codigo_alerta}
                        className="ml-4"
                        variant="outline"
                      >
                        {resolvingAlert === alerta.codigo_alerta ? 'Resolviendo...' : 'Resolver'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-lab-neutral-900">Sin alertas activas</h3>
                <p className="mt-1 text-sm text-lab-neutral-500">El sistema opera con normalidad</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historial Tab */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tabla</Label>
                  <select
                    value={tablaFilter}
                    onChange={(e) => setTablaFilter(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
                  >
                    {tablasDisponibles.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>ID Registro (opcional)</Label>
                  <Input
                    type="number"
                    placeholder="Ej: 123"
                    value={registroFilter}
                    onChange={(e) => setRegistroFilter(e.target.value)}
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <Button onClick={loadHistorial} className="w-full">
                    Buscar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial de Cambios</CardTitle>
              <CardDescription>Registro de todas las modificaciones (old_value vs new_value)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
                </div>
              ) : historial.length > 0 ? (
                <div className="space-y-4">
                  {historial.map((item) => (
                    <div key={item.codigo_auditoria} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.operacion === 'INSERT' ? 'bg-green-100 text-green-800' :
                            item.operacion === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {item.operacion}
                          </span>
                          <span className="text-sm text-lab-neutral-600">
                            Registro #{item.registro_id}
                          </span>
                        </div>
                        <span className="text-xs text-lab-neutral-500">
                          {new Date(item.fecha_operacion).toLocaleString('es-ES')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {item.datos_anteriores && (
                          <div className="bg-red-50 p-3 rounded">
                            <p className="text-xs font-medium text-red-700 mb-2">Datos Anteriores:</p>
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(item.datos_anteriores, null, 2)}
                            </pre>
                          </div>
                        )}
                        {item.datos_nuevos && (
                          <div className="bg-green-50 p-3 rounded">
                            <p className="text-xs font-medium text-green-700 mb-2">Datos Nuevos:</p>
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(item.datos_nuevos, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-lab-neutral-500">
                  No se encontraron registros para esta tabla
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Configuracion Tab */}
      {activeTab === 'configuracion' && (
        <div className="space-y-6">
          {/* Estado de Controles de Seguridad */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Estado de Controles de Seguridad
              </CardTitle>
              <CardDescription>
                Controles implementados segun ISO/IEC 27002:2022 y NIST SP 800-53
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Cifrado de Storage */}
                <div className={`p-4 rounded-lg border-2 ${storageEncrypted ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className={`h-5 w-5 ${storageEncrypted ? 'text-green-600' : 'text-red-600'}`} />
                    <span className="font-medium">Cifrado de Storage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {storageEncrypted ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">
                      {storageEncrypted ? 'AES-256-GCM Activo' : 'No cifrado'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ISO 8.24 / NIST SC-28
                  </p>
                </div>

                {/* Sesion Temporizada */}
                <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Sesion Temporizada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{sessionTimeout} min de inactividad</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ISO 8.1 / NIST AC-12
                  </p>
                </div>

                {/* Proteccion Anti-Debugging */}
                <div className={`p-4 rounded-lg border-2 ${securityEnabled ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className={`h-5 w-5 ${securityEnabled ? 'text-green-600' : 'text-yellow-600'}`} />
                    <span className="font-medium">Anti-Debugging</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {securityEnabled ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm">
                      {securityEnabled ? 'Protecciones activas' : 'Deshabilitado'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ISO 8.28 / NIST SA-15
                  </p>
                </div>
              </div>

              {/* Estadisticas de intentos */}
              {inspectionAttempts > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Intentos de inspeccion detectados:</strong> {inspectionAttempts}
                  </p>
                </div>
              )}

              {devToolsDetected && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>DevTools detectado actualmente</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuracion de Sesion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Configuracion de Sesion Temporizada
              </CardTitle>
              <CardDescription>
                Define el tiempo de inactividad antes de cerrar la sesion automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeout">Tiempo de inactividad (minutos)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="timeout"
                      type="number"
                      min="1"
                      max="60"
                      value={newTimeout}
                      onChange={(e) => setNewTimeout(e.target.value)}
                      className="w-32"
                    />
                    <Button
                      onClick={() => {
                        const mins = parseInt(newTimeout)
                        if (mins >= 1 && mins <= 60) {
                          setSessionTimeout(mins)
                          alert(`Tiempo de sesion configurado: ${mins} minutos`)
                        }
                      }}
                    >
                      Guardar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Valores recomendados: 5-15 minutos para entornos de alta seguridad
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Configuracion actual</Label>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p><strong>Timeout:</strong> {sessionTimeout} minutos</p>
                    <p><strong>Advertencia:</strong> 1 minuto antes de expirar</p>
                    <p><strong>Eventos monitoreados:</strong> click, scroll, teclas, touch</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Protecciones Anti-Debugging */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Protecciones Anti-Debugging
              </CardTitle>
              <CardDescription>
                Controles contra ingenieria inversa y analisis de codigo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Habilitar protecciones</Label>
                  <p className="text-xs text-muted-foreground">
                    Bloquea F12, clic derecho, Ctrl+Shift+I, etc.
                  </p>
                </div>
                <Switch
                  checked={securityEnabled}
                  onCheckedChange={setSecurityEnabled}
                />
              </div>

              <div className="border-t pt-4">
                <p className="font-medium mb-2">Protecciones incluidas:</p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" /> Bloqueo de clic derecho (contextmenu)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" /> Bloqueo de F12 (DevTools)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" /> Bloqueo de Ctrl+Shift+I/J/C
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" /> Bloqueo de Ctrl+U (ver fuente)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" /> Deteccion de DevTools por viewport
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" /> Registro de intentos de inspeccion
                  </li>
                </ul>
              </div>

              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    logStorageStatus()
                    alert('Revisa la consola del navegador (F12) para ver el estado del cifrado')
                  }}
                >
                  Ver estado de cifrado en consola
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instrucciones para demostracion */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-800">Como demostrar los controles</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-700 space-y-2">
              <p><strong>1. Cifrado de Storage (SC-28):</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Abre DevTools {'>'} Application {'>'} Local Storage</li>
                <li>Busca la clave "auth-storage"</li>
                <li>Veras que los datos empiezan con "ENC:" seguido de texto cifrado en Base64</li>
                <li>El cifrado usa AES-256-GCM con PBKDF2</li>
              </ul>
              <p className="mt-3"><strong>2. Sesion Temporizada (AC-12):</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Deja de interactuar con la aplicacion</li>
                <li>1 minuto antes de expirar aparecera un modal de advertencia</li>
                <li>Si no respondes, la sesion se cierra automaticamente</li>
              </ul>
              <p className="mt-3"><strong>3. Anti-Debugging (SA-15):</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Intenta presionar F12 - se bloqueara</li>
                <li>Intenta clic derecho - se bloqueara</li>
                <li>Intenta Ctrl+Shift+I - se bloqueara</li>
                <li>Aparecera un modal de advertencia y se registrara el intento</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
