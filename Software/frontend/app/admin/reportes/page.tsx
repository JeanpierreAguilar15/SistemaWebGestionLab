'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ReportType = 'dashboard' | 'ventas' | 'examenes' | 'citas' | 'cotizaciones' | 'kardex' | 'pacientes' | 'resultados' | 'consumo_servicio' | 'compras_proveedor'

interface DashboardData {
  ingresos_mes_actual: number
  ingresos_mes_anterior: number
  variacion_ingresos: string
  pagos_este_mes: number
  citas_hoy: number
  items_stock_bajo: number
  cotizaciones_pendientes: number
}

export default function ReportesPage() {
  const { accessToken } = useAuthStore()
  const [activeReport, setActiveReport] = useState<ReportType>('dashboard')
  const [loading, setLoading] = useState(true)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [reportData, setReportData] = useState<any>(null)

  useEffect(() => {
    loadReport()
  }, [activeReport])

  const loadReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fechaDesde) params.append('fecha_desde', fechaDesde)
      if (fechaHasta) params.append('fecha_hasta', fechaHasta)

      // Map inventory reports to their specific endpoints
      let endpoint = `${process.env.NEXT_PUBLIC_API_URL}/reports/${activeReport}`
      if (activeReport === 'consumo_servicio') {
        endpoint = `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/reportes/consumo-servicio`
      } else if (activeReport === 'compras_proveedor') {
        endpoint = `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/reportes/compras-proveedor`
      }

      const response = await fetch(
        `${endpoint}?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (response.ok) {
        const data = await response.json()
        setReportData(data)
      }
    } catch (error) {
      console.error('Error loading report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPdf = async (reportType: string) => {
    try {
      const params = new URLSearchParams()
      if (fechaDesde) params.append('fecha_desde', fechaDesde)
      if (fechaHasta) params.append('fecha_hasta', fechaHasta)

      let endpoint = ''
      let filename = ''
      if (reportType === 'consumo_servicio') {
        endpoint = `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/reportes/consumo-servicio/pdf`
        filename = 'reporte-consumo-servicio.pdf'
      } else if (reportType === 'compras_proveedor') {
        endpoint = `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/reportes/compras-proveedor/pdf`
        filename = 'reporte-compras-proveedor.pdf'
      } else if (reportType === 'kardex') {
        endpoint = `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/reportes/kardex-completo/pdf`
        filename = 'reporte-kardex.pdf'
      }

      if (!endpoint) return

      const response = await fetch(
        `${endpoint}?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0)
  }

  const reports = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
    { id: 'ventas', label: 'Ventas', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'resultados', label: 'Resultados', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'examenes', label: 'Examenes', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'citas', label: 'Citas', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'cotizaciones', label: 'Cotizaciones', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
    { id: 'kardex', label: 'Kardex', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
    { id: 'pacientes', label: 'Pacientes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'consumo_servicio', label: 'Consumo x Servicio', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'compras_proveedor', label: 'Compras x Proveedor', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  ]

  const renderDashboard = (data: DashboardData) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
        <CardContent className="pt-6">
          <div className="text-sm opacity-80">Ingresos Este Mes</div>
          <div className="text-3xl font-bold mt-2">{formatCurrency(data.ingresos_mes_actual)}</div>
          <div className={`text-sm mt-2 ${data.variacion_ingresos.startsWith('+') ? 'text-green-200' : 'text-red-200'}`}>
            {data.variacion_ingresos} vs mes anterior
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <CardContent className="pt-6">
          <div className="text-sm opacity-80">Pagos Este Mes</div>
          <div className="text-3xl font-bold mt-2">{data.pagos_este_mes}</div>
          <div className="text-sm mt-2 opacity-80">transacciones</div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
        <CardContent className="pt-6">
          <div className="text-sm opacity-80">Citas Hoy</div>
          <div className="text-3xl font-bold mt-2">{data.citas_hoy}</div>
          <div className="text-sm mt-2 opacity-80">programadas</div>
        </CardContent>
      </Card>

      <Card className={`bg-gradient-to-br ${data.items_stock_bajo > 0 ? 'from-red-500 to-red-600' : 'from-gray-500 to-gray-600'} text-white`}>
        <CardContent className="pt-6">
          <div className="text-sm opacity-80">Items Stock Bajo</div>
          <div className="text-3xl font-bold mt-2">{data.items_stock_bajo}</div>
          <div className="text-sm mt-2 opacity-80">requieren atencion</div>
        </CardContent>
      </Card>
    </div>
  )

  const renderVentas = (data: any) => (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Total Ingresos</div>
            <div className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(data.resumen?.total_ingresos)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Cantidad Pagos</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{data.resumen?.cantidad_pagos || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Promedio por Pago</div>
            <div className="text-3xl font-bold text-purple-600 mt-2">{formatCurrency(data.resumen?.promedio_pago)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Por Metodo */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos por Metodo de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.por_metodo?.map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 bg-lab-neutral-50 rounded-lg">
                <div>
                  <div className="font-medium">{m.metodo}</div>
                  <div className="text-sm text-lab-neutral-500">{m.cantidad} pagos</div>
                </div>
                <div className="text-xl font-bold text-green-600">{formatCurrency(m.total)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Por Dia */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos Ultimos 30 Dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-right p-2">Pagos</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.por_dia?.slice(0, 15).map((d: any, i: number) => (
                  <tr key={i} className="border-b border-lab-neutral-100">
                    <td className="p-2">{new Date(d.fecha).toLocaleDateString('es-ES')}</td>
                    <td className="text-right p-2">{d.cantidad}</td>
                    <td className="text-right p-2 font-medium text-green-600">{formatCurrency(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderExamenes = (data: any) => (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Examenes Diferentes</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{data.total_examenes_diferentes || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Total Realizados</div>
            <div className="text-3xl font-bold text-purple-600 mt-2">{data.total_examenes_realizados || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Ingresos Generados</div>
            <div className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(data.ingresos_totales)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Examenes Mas Solicitados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.ranking_top_10?.map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 bg-lab-neutral-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                    i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-lab-neutral-400'
                  }`}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-medium">{e.nombre}</div>
                    <div className="text-xs text-lab-neutral-500">{e.codigo_interno}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-600">{e.cantidad_solicitada} veces</div>
                  <div className="text-sm text-green-600">{formatCurrency(e.ingresos_generados)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderCitas = (data: any) => (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Total Citas</div>
            <div className="text-2xl font-bold text-lab-neutral-900 mt-2">{data.resumen?.total_citas || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Completadas</div>
            <div className="text-2xl font-bold text-green-600 mt-2">{data.resumen?.completadas || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Canceladas</div>
            <div className="text-2xl font-bold text-red-600 mt-2">{data.resumen?.canceladas || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Tasa Cumplimiento</div>
            <div className="text-2xl font-bold text-blue-600 mt-2">{data.resumen?.tasa_cumplimiento || '0%'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Tasa Cancelacion</div>
            <div className="text-2xl font-bold text-yellow-600 mt-2">{data.resumen?.tasa_cancelacion || '0%'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Por Servicio */}
        <Card>
          <CardHeader>
            <CardTitle>Por Servicio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.por_servicio?.map((s: any, i: number) => (
                <div key={i} className="flex justify-between p-3 bg-lab-neutral-50 rounded">
                  <span>{s.servicio}</span>
                  <span className="font-bold">{s.cantidad}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Por Sede */}
        <Card>
          <CardHeader>
            <CardTitle>Por Sede</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.por_sede?.map((s: any, i: number) => (
                <div key={i} className="flex justify-between p-3 bg-lab-neutral-50 rounded">
                  <span>{s.sede}</span>
                  <span className="font-bold">{s.cantidad}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderCotizaciones = (data: any) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Total Cotizaciones</div>
            <div className="text-2xl font-bold text-lab-neutral-900 mt-2">{data.resumen?.total_cotizaciones || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Pagadas</div>
            <div className="text-2xl font-bold text-green-600 mt-2">{data.resumen?.cotizaciones_pagadas || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Pendientes</div>
            <div className="text-2xl font-bold text-yellow-600 mt-2">{data.resumen?.cotizaciones_pendientes || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="text-sm opacity-80">Tasa Conversion</div>
            <div className="text-3xl font-bold mt-2">{data.resumen?.tasa_conversion || '0%'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Valor Total Cotizado</div>
            <div className="text-2xl font-bold text-blue-600 mt-2">{formatCurrency(data.resumen?.valor_total_cotizado)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Valor Convertido</div>
            <div className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(data.resumen?.valor_convertido)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Valor No Convertido</div>
            <div className="text-2xl font-bold text-red-600 mt-2">{formatCurrency(data.resumen?.valor_perdido)}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderKardex = (data: any) => (
    <div className="space-y-6">
      {/* Header with PDF export */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-lab-neutral-900">Reporte Kardex de Inventario</h2>
          <p className="text-sm text-lab-neutral-600 mt-1">Resumen de movimientos y estado del inventario</p>
        </div>
        <Button onClick={() => handleExportPdf('kardex')} variant="outline">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar PDF
        </Button>
      </div>

      {/* Alertas */}
      {data.alertas?.items_stock_bajo > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Items con Stock Critico ({data.alertas.items_stock_bajo})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.alertas.items_criticos?.map((item: any) => (
                <div key={item.codigo_item} className="p-3 bg-white rounded border border-red-200">
                  <div className="font-medium text-sm">{item.nombre}</div>
                  <div className="text-xs text-lab-neutral-500">{item.codigo_interno}</div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span>Stock: <span className="font-bold text-red-600">{item.stock_actual}</span></span>
                    <span>Min: {item.stock_minimo}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen Movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Movimientos por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.resumen_movimientos?.por_tipo?.map((t: any, i: number) => (
              <div key={i} className={`p-4 rounded-lg ${
                t.tipo === 'ENTRADA' ? 'bg-green-50 border border-green-200' :
                t.tipo === 'SALIDA' ? 'bg-red-50 border border-red-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
                <div className="font-medium">{t.tipo}</div>
                <div className="text-2xl font-bold mt-1">{t.cantidad_movimientos}</div>
                <div className="text-sm text-lab-neutral-500">{t.unidades_totales} unidades</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Items mas movidos */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Items Mas Movidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.resumen_movimientos?.items_mas_movidos?.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-lab-neutral-50 rounded-lg">
                <div>
                  <div className="font-medium">{item.nombre}</div>
                  <div className="text-xs text-lab-neutral-500">{item.codigo_interno}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{item.cantidad_movimientos} mov.</div>
                  <div className="text-sm text-lab-neutral-500">{item.unidades_movidas} uds.</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderPacientes = (data: any) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Total Pacientes</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{data.resumen?.total_pacientes || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Nuevos en Periodo</div>
            <div className="text-3xl font-bold text-green-600 mt-2">{data.resumen?.nuevos_en_periodo || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Activos (90 dias)</div>
            <div className="text-3xl font-bold text-purple-600 mt-2">{data.resumen?.pacientes_activos_90_dias || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribucion por Genero</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.por_genero?.map((g: any, i: number) => (
              <div key={i} className="p-4 bg-lab-neutral-50 rounded-lg text-center">
                <div className="text-2xl font-bold">{g.cantidad}</div>
                <div className="text-sm text-lab-neutral-600">{g.genero}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderResultados = (data: any) => (
    <div className="space-y-6">
      {/* Resumen Principal */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{data.resumen?.total_resultados || 0}</div>
            <div className="text-xs opacity-80">Total Resultados</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{data.resumen?.validados || 0}</div>
            <div className="text-xs opacity-80">Validados</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{data.resumen?.en_proceso || 0}</div>
            <div className="text-xs opacity-80">En Proceso</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{data.resumen?.pendientes || 0}</div>
            <div className="text-xs opacity-80">Pendientes</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{data.resumen?.fuera_de_rango || 0}</div>
            <div className="text-xs opacity-80">Fuera de Rango</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{data.resumen?.total_descargas_pdf || 0}</div>
            <div className="text-xs opacity-80">Descargas PDF</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{data.resumen?.tiempo_promedio_horas || 0}h</div>
            <div className="text-xs opacity-80">Tiempo Promedio</div>
          </CardContent>
        </Card>
      </div>

      {/* Estados y Top Exámenes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.por_estado?.map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-lab-neutral-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      e.estado === 'VALIDADO' ? 'bg-green-500' :
                      e.estado === 'EN_PROCESO' ? 'bg-yellow-500' :
                      e.estado === 'PENDIENTE' ? 'bg-orange-500' : 'bg-gray-500'
                    }`}></div>
                    <span className="font-medium">{e.estado}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg">{e.cantidad}</span>
                    <span className="text-sm text-lab-neutral-500 ml-2">({e.porcentaje})</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Exámenes Procesados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.top_examenes?.map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-lab-neutral-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-lab-neutral-400'
                    }`}>{i + 1}</span>
                    <div>
                      <div className="font-medium text-sm">{e.nombre}</div>
                      <div className="text-xs text-lab-neutral-500">{e.codigo_interno}</div>
                    </div>
                  </div>
                  <span className="font-bold text-blue-600">{e.cantidad}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Descargas y Bioquímicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Descargas PDF - Últimos 30 Días</CardTitle>
            <CardDescription>Número de descargas de resultados por día</CardDescription>
          </CardHeader>
          <CardContent>
            {data.descargas_por_dia?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Fecha</th>
                      <th className="text-right p-2">Descargas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.descargas_por_dia?.slice(0, 10).map((d: any, i: number) => (
                      <tr key={i} className="border-b border-lab-neutral-100">
                        <td className="p-2">{new Date(d.fecha).toLocaleDateString('es-ES')}</td>
                        <td className="text-right p-2 font-medium text-purple-600">{d.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-lab-neutral-500">No hay descargas en este período</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productividad por Bioquímico</CardTitle>
            <CardDescription>Resultados validados por cada profesional</CardDescription>
          </CardHeader>
          <CardContent>
            {data.por_bioquimico?.length > 0 ? (
              <div className="space-y-3">
                {data.por_bioquimico?.map((b: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-lab-neutral-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-lab-primary-100 text-lab-primary-700 flex items-center justify-center font-bold">
                        {b.nombre.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </div>
                      <span className="font-medium">{b.nombre}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-lg text-green-600">{b.cantidad_validados}</span>
                      <span className="text-xs text-lab-neutral-500 block">validados</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-lab-neutral-500">No hay datos de validación</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderConsumoServicio = (data: any) => (
    <div className="space-y-6">
      {/* Header with PDF export */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-lab-neutral-900">Consumo de Inventario por Servicio/Examen</h2>
          <p className="text-sm text-lab-neutral-600 mt-1">Análisis de uso de reactivos e insumos por servicio</p>
        </div>
        <Button onClick={() => handleExportPdf('consumo_servicio')} variant="outline">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar PDF
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Total Salidas</div>
            <div className="text-2xl font-bold text-blue-600 mt-2">{data.resumen?.total_salidas || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Unidades Consumidas</div>
            <div className="text-2xl font-bold text-purple-600 mt-2">{data.resumen?.unidades_totales || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Valor Total</div>
            <div className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(data.resumen?.valor_total || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Items Diferentes</div>
            <div className="text-2xl font-bold text-lab-neutral-700 mt-2">{data.resumen?.items_diferentes || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Consumo por Servicio */}
      <Card>
        <CardHeader>
          <CardTitle>Consumo por Servicio/Examen</CardTitle>
          <CardDescription>Detalle del consumo de inventario agrupado por servicio</CardDescription>
        </CardHeader>
        <CardContent>
          {data.por_servicio?.length > 0 ? (
            <div className="space-y-3">
              {data.por_servicio.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 bg-lab-neutral-50 rounded-lg">
                  <div>
                    <div className="font-medium text-lab-neutral-900">{s.servicio || 'Sin especificar'}</div>
                    <div className="text-sm text-lab-neutral-500">{s.movimientos} movimientos</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">{s.unidades} unidades</div>
                    <div className="text-sm text-green-600">{formatCurrency(s.valor || 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-lab-neutral-500">No hay datos de consumo en el período seleccionado</div>
          )}
        </CardContent>
      </Card>

      {/* Items más consumidos */}
      <Card>
        <CardHeader>
          <CardTitle>Top Items Más Consumidos</CardTitle>
        </CardHeader>
        <CardContent>
          {data.items_mas_consumidos?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Item</th>
                    <th className="text-right p-2">Cantidad</th>
                    <th className="text-right p-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items_mas_consumidos.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-lab-neutral-100">
                      <td className="p-2">
                        <div className="font-medium">{item.nombre}</div>
                        <div className="text-xs text-lab-neutral-500">{item.codigo_interno}</div>
                      </td>
                      <td className="text-right p-2">{item.cantidad}</td>
                      <td className="text-right p-2 text-green-600">{formatCurrency(item.valor || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-lab-neutral-500">No hay datos disponibles</div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderComprasProveedor = (data: any) => (
    <div className="space-y-6">
      {/* Header with PDF export */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-lab-neutral-900">Reporte de Compras por Proveedor</h2>
          <p className="text-sm text-lab-neutral-600 mt-1">Análisis de órdenes de compra y gastos por proveedor</p>
        </div>
        <Button onClick={() => handleExportPdf('compras_proveedor')} variant="outline">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar PDF
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Total Órdenes</div>
            <div className="text-2xl font-bold text-blue-600 mt-2">{data.resumen?.total_ordenes || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Órdenes Recibidas</div>
            <div className="text-2xl font-bold text-green-600 mt-2">{data.resumen?.ordenes_recibidas || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-lab-neutral-600">Órdenes Pendientes</div>
            <div className="text-2xl font-bold text-yellow-600 mt-2">{data.resumen?.ordenes_pendientes || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="pt-6">
            <div className="text-sm opacity-80">Monto Total</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(data.resumen?.monto_total || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Compras por Proveedor */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose por Proveedor</CardTitle>
          <CardDescription>Órdenes de compra agrupadas por proveedor</CardDescription>
        </CardHeader>
        <CardContent>
          {data.por_proveedor?.length > 0 ? (
            <div className="space-y-3">
              {data.por_proveedor.map((p: any, i: number) => (
                <div key={i} className="p-4 bg-lab-neutral-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-lab-neutral-900">{p.proveedor}</div>
                      <div className="text-xs text-lab-neutral-500">RUC: {p.ruc || 'N/A'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600 text-lg">{formatCurrency(p.monto_total || 0)}</div>
                      <div className="text-xs text-lab-neutral-500">{p.ordenes} órdenes</div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-lab-neutral-600">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Recibidas: {p.recibidas || 0}</span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">Emitidas: {p.emitidas || 0}</span>
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Pendientes: {p.pendientes || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-lab-neutral-500">No hay compras en el período seleccionado</div>
          )}
        </CardContent>
      </Card>

      {/* Últimas órdenes */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Órdenes de Compra</CardTitle>
        </CardHeader>
        <CardContent>
          {data.ultimas_ordenes?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">N° Orden</th>
                    <th className="text-left p-2">Proveedor</th>
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ultimas_ordenes.map((orden: any, i: number) => (
                    <tr key={i} className="border-b border-lab-neutral-100">
                      <td className="p-2 font-mono text-xs">{orden.numero_orden}</td>
                      <td className="p-2">{orden.proveedor}</td>
                      <td className="p-2">{new Date(orden.fecha).toLocaleDateString('es-BO')}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          orden.estado === 'RECIBIDA' ? 'bg-green-100 text-green-700' :
                          orden.estado === 'EMITIDA' ? 'bg-blue-100 text-blue-700' :
                          orden.estado === 'BORRADOR' ? 'bg-gray-100 text-gray-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {orden.estado}
                        </span>
                      </td>
                      <td className="text-right p-2 font-medium">{formatCurrency(orden.total || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-lab-neutral-500">No hay órdenes disponibles</div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderReport = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600"></div>
        </div>
      )
    }

    if (!reportData) {
      return <div className="text-center py-12 text-lab-neutral-500">No hay datos disponibles</div>
    }

    switch (activeReport) {
      case 'dashboard':
        return renderDashboard(reportData)
      case 'ventas':
        return renderVentas(reportData)
      case 'resultados':
        return renderResultados(reportData)
      case 'examenes':
        return renderExamenes(reportData)
      case 'citas':
        return renderCitas(reportData)
      case 'cotizaciones':
        return renderCotizaciones(reportData)
      case 'kardex':
        return renderKardex(reportData)
      case 'pacientes':
        return renderPacientes(reportData)
      case 'consumo_servicio':
        return renderConsumoServicio(reportData)
      case 'compras_proveedor':
        return renderComprasProveedor(reportData)
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-lab-neutral-900">Centro de Reportes</h1>
        <p className="text-lab-neutral-600 mt-2">
          Analisis y estadisticas del laboratorio
        </p>
      </div>

      {/* Report Selector */}
      <div className="flex flex-wrap gap-2">
        {reports.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id as ReportType)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeReport === report.id
                ? 'bg-lab-primary-600 text-white'
                : 'bg-lab-neutral-100 text-lab-neutral-700 hover:bg-lab-neutral-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={report.icon} />
            </svg>
            <span>{report.label}</span>
          </button>
        ))}
      </div>

      {/* Filters (except dashboard) */}
      {activeReport !== 'dashboard' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Fecha Desde</Label>
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Hasta</Label>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-44"
                />
              </div>
              <Button onClick={loadReport}>
                Actualizar Reporte
              </Button>
              <Button variant="outline" onClick={() => { setFechaDesde(''); setFechaHasta(''); }}>
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Content */}
      {renderReport()}
    </div>
  )
}
