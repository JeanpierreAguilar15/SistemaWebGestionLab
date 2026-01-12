'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getGreeting, formatDate } from '@/lib/utils'

interface DashboardStats {
  citasProximas: number
  resultadosListos: number
  resultadosEnProceso: number
  cotizacionesPendientes: number
}

interface ProximaCita {
  codigo_cita: number
  fecha: string
  hora: string
  servicio: string
  sede: string
  estado: string
}

interface ResultadoReciente {
  codigo_resultado: number
  examen: string
  fecha: string
  estado: string
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const { accessToken } = useAuthStore()
  const [greeting, setGreeting] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    citasProximas: 0,
    resultadosListos: 0,
    resultadosEnProceso: 0,
    cotizacionesPendientes: 0,
  })
  const [proximasCitas, setProximasCitas] = useState<ProximaCita[]>([])
  const [resultadosRecientes, setResultadosRecientes] = useState<ResultadoReciente[]>([])

  useEffect(() => {
    setGreeting(getGreeting())
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agenda/dashboard/patient`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setProximasCitas(data.proximasCitas || [])
        setResultadosRecientes(data.resultadosRecientes || [])
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const statsCards = [
    {
      title: 'Citas Próximas',
      value: stats.citasProximas.toString(),
      description: 'Próximas 30 días',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'blue',
      href: '/portal/citas',
    },
    {
      title: 'Resultados Listos',
      value: stats.resultadosListos.toString(),
      description: 'Disponibles para descargar',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'green',
      href: '/portal/resultados',
    },
    {
      title: 'En Proceso',
      value: stats.resultadosEnProceso.toString(),
      description: 'Resultados pendientes',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'orange',
      href: '/portal/resultados',
    },
    {
      title: 'Cotizaciones',
      value: stats.cotizacionesPendientes.toString(),
      description: 'Pendiente de pago',
      icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
      color: 'purple',
      href: '/portal/cotizaciones',
    },
  ]

  const quickActions = [
    {
      title: 'Agendar Cita',
      description: 'Programa una nueva cita para tus exámenes',
      icon: 'M12 4v16m8-8H4',
      href: '/portal/citas',
      color: 'bg-lab-primary-600',
    },
    {
      title: 'Ver Resultados',
      description: 'Consulta y descarga tus resultados',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      href: '/portal/resultados',
      color: 'bg-lab-success-600',
    },
    {
      title: 'Solicitar Cotización',
      description: 'Solicita una cotización para exámenes',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      href: '/portal/cotizaciones',
      color: 'bg-lab-warning-600',
    },
    {
      title: 'Mi Perfil',
      description: 'Actualiza tu información personal',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      href: '/portal/perfil',
      color: 'bg-lab-neutral-600',
    },
  ]

  const formatCitaDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return {
      dia: date.getDate().toString().padStart(2, '0'),
      mes: date.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
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
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-lab-primary-600 to-lab-primary-700 rounded-2xl p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">
          {greeting}, {user?.nombres}!
        </h1>
        <p className="text-lab-primary-100 text-lg">
          Bienvenido a tu portal del paciente. Aquí puedes gestionar tus citas, ver resultados y más.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const colorClasses = {
            blue: 'bg-lab-primary-50 text-lab-primary-700',
            green: 'bg-lab-success-50 text-lab-success-700',
            orange: 'bg-lab-warning-50 text-lab-warning-700',
            purple: 'bg-purple-50 text-purple-700',
          }

          return (
            <Link key={index} href={stat.href}>
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-lab-neutral-200 h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold text-lab-neutral-900 mb-1">{stat.value}</h3>
                  <p className="text-sm font-medium text-lab-neutral-700 mb-1">{stat.title}</p>
                  <p className="text-xs text-lab-neutral-500">{stat.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-lab-neutral-900 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link key={index} href={action.href}>
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-lab-neutral-200 h-full group">
                <CardContent className="p-6">
                  <div className={`${action.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lab-neutral-900 mb-1">{action.title}</h3>
                  <p className="text-sm text-lab-neutral-600">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <Card className="border-lab-neutral-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Próximas Citas</CardTitle>
                <CardDescription>Tus citas agendadas</CardDescription>
              </div>
              <Link href="/portal/citas">
                <Button variant="ghost" size="sm">
                  Ver todas
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proximasCitas.length === 0 ? (
                <div className="text-center py-8 text-lab-neutral-500">
                  <svg className="mx-auto h-12 w-12 text-lab-neutral-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>No tienes citas próximas</p>
                </div>
              ) : (
                proximasCitas.map((cita, index) => {
                  const { dia, mes } = formatCitaDate(cita.fecha)
                  const isConfirmed = cita.estado === 'CONFIRMADA'
                  return (
                    <div key={cita.codigo_cita} className={`flex items-start space-x-4 p-4 rounded-lg ${isConfirmed ? 'bg-lab-primary-50 border border-lab-primary-100' : 'bg-lab-neutral-50 border border-lab-neutral-200'}`}>
                      <div className={`${isConfirmed ? 'bg-lab-primary-600' : 'bg-lab-neutral-400'} text-white rounded-lg p-2 flex flex-col items-center justify-center min-w-[60px]`}>
                        <span className="text-2xl font-bold">{dia}</span>
                        <span className="text-xs">{mes}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lab-neutral-900">{cita.servicio}</h4>
                        <p className="text-sm text-lab-neutral-600 mt-1">{cita.hora} - {cita.sede}</p>
                        <div className="flex items-center mt-2">
                          <span className={isConfirmed ? 'lab-badge-info' : 'lab-badge-warning'}>
                            {cita.estado === 'CONFIRMADA' ? 'Confirmada' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              <Link href="/portal/citas">
                <Button variant="outline" className="w-full">
                  Agendar Nueva Cita
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Results */}
        <Card className="border-lab-neutral-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Resultados Recientes</CardTitle>
                <CardDescription>Tus últimos resultados de laboratorio</CardDescription>
              </div>
              <Link href="/portal/resultados">
                <Button variant="ghost" size="sm">
                  Ver todos
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {resultadosRecientes.length === 0 ? (
                <div className="text-center py-8 text-lab-neutral-500">
                  <svg className="mx-auto h-12 w-12 text-lab-neutral-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No tienes resultados aún</p>
                </div>
              ) : (
                resultadosRecientes.map((resultado) => {
                  const isCompleted = resultado.estado === 'COMPLETADO'
                  return (
                    <div key={resultado.codigo_resultado} className={`flex items-center justify-between p-4 rounded-lg ${isCompleted ? 'bg-lab-success-50 border border-lab-success-200' : 'bg-lab-warning-50 border border-lab-warning-200'}`}>
                      <div className="flex items-center space-x-3">
                        <div className={`${isCompleted ? 'bg-lab-success-600' : 'bg-lab-warning-600'} text-white rounded-lg p-2`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {isCompleted ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-lab-neutral-900">{resultado.examen}</h4>
                          <p className="text-sm text-lab-neutral-600">
                            {isCompleted ? formatDate(new Date(resultado.fecha)) : 'En proceso'}
                          </p>
                        </div>
                      </div>
                      {isCompleted ? (
                        <Button size="sm" variant="outline">
                          Descargar
                        </Button>
                      ) : (
                        <span className="lab-badge-warning">Procesando</span>
                      )}
                    </div>
                  )
                })
              )}

              <Link href="/portal/resultados">
                <Button variant="outline" className="w-full">
                  Ver Todos los Resultados
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-lab-primary-50 to-lab-success-50 border-lab-primary-200">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="bg-lab-primary-600 text-white rounded-full p-3 flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lab-neutral-900 mb-2">
                Información Importante
              </h3>
              <p className="text-sm text-lab-neutral-700 mb-3">
                Recuerda que para algunos exámenes es necesario preparación previa como ayuno.
                Consulta las instrucciones específicas al agendar tu cita.
              </p>
              <Button variant="link" className="p-0 h-auto text-lab-primary-700 hover:text-lab-primary-800">
                Ver guía de preparación
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
