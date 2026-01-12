'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'

interface Resultado {
  codigo_resultado: number
  codigo_muestra: number
  codigo_examen: number
  valor_numerico: number | null
  valor_texto: string | null
  unidad_medida: string | null
  nivel: string | null
  observaciones_tecnicas: string | null
  estado: string
  fecha_resultado: string
  url_pdf: string | null
  muestra: {
    id_muestra: string
    codigo_paciente: number
    paciente: {
      nombres: string
      apellidos: string
      email: string
      cedula: string
    }
  }
  examen: {
    codigo_examen: number
    nombre: string
    codigo_interno: string
  }
  valor_referencia_min: number | null
  valor_referencia_max: number | null
  valores_referencia_texto: string | null
}

interface Message {
  type: 'success' | 'error'
  text: string
}

export default function ResultadosAdminPage() {
  const { accessToken } = useAuthStore()
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedResultado, setSelectedResultado] = useState<Resultado | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadResultadoId, setUploadResultadoId] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [isEditingPdf, setIsEditingPdf] = useState(false)

  useEffect(() => {
    loadResultados()
  }, [])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const loadResultados = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resultados/admin/all`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.ok) {
        const result = await response.json()
        const resultados = result.data || result
        setResultados(resultados)
      }
    } catch (error) {
      console.error('Error loading resultados:', error)
      setMessage({ type: 'error', text: 'Error al cargar resultados' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async (codigo_resultado: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resultados/admin/${codigo_resultado}/descargar`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `resultado-${codigo_resultado}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        setMessage({ type: 'error', text: 'Error al descargar PDF' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleOpenUploadModal = (codigo_resultado: number, isEditing: boolean = false) => {
    setUploadResultadoId(codigo_resultado)
    setSelectedFile(null)
    setIsEditingPdf(isEditing)
    setShowUploadModal(true)
  }

  const handleCloseUploadModal = () => {
    setShowUploadModal(false)
    setUploadResultadoId(null)
    setSelectedFile(null)
    setIsEditingPdf(false)
  }

  const handlePreviewPDF = async (codigo_resultado: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resultados/admin/${codigo_resultado}/descargar`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        setPdfPreviewUrl(url)
        setShowPdfPreview(true)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar vista previa del PDF' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleClosePdfPreview = () => {
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl)
    }
    setPdfPreviewUrl(null)
    setShowPdfPreview(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validar que sea PDF
      if (file.type !== 'application/pdf') {
        setMessage({ type: 'error', text: '❌ Solo se permiten archivos PDF' })
        e.target.value = ''
        return
      }

      // Validar tamaño (10MB máximo)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        setMessage({ type: 'error', text: '❌ El archivo no debe superar los 10MB' })
        e.target.value = ''
        return
      }

      setSelectedFile(file)
    }
  }

  const handleUploadPDF = async () => {
    if (!selectedFile || !uploadResultadoId) {
      setMessage({ type: 'error', text: '❌ Debe seleccionar un archivo PDF' })
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/resultados/${uploadResultadoId}/upload-pdf`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        }
      )

      if (response.ok) {
        const successMessage = isEditingPdf
          ? '✅ PDF reemplazado correctamente'
          : '✅ PDF subido y resultado validado correctamente'
        setMessage({ type: 'success', text: successMessage })
        handleCloseUploadModal()
        loadResultados()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al subir PDF' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleViewDetails = (resultado: Resultado) => {
    setSelectedResultado(resultado)
    setShowDetailModal(true)
  }

  const filteredResultados = resultados.filter((resultado) => {
    const matchSearch =
      searchTerm === '' ||
      resultado.muestra?.paciente?.nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resultado.muestra?.paciente?.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resultado.examen?.nombre.toLowerCase().includes(searchTerm.toLowerCase())

    return matchSearch
  })

  const getNivelBadge = (nivel: string | null) => {
    switch (nivel) {
      case 'NORMAL':
        return 'bg-lab-success-100 text-lab-success-800'
      case 'BAJO':
        return 'bg-lab-info-100 text-lab-info-800'
      case 'ALTO':
        return 'bg-lab-warning-100 text-lab-warning-800'
      case 'CRITICO':
        return 'bg-lab-danger-100 text-lab-danger-800'
      default:
        return 'bg-lab-neutral-100 text-lab-neutral-600'
    }
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'VALIDADO':
        return 'bg-lab-success-100 text-lab-success-800'
      case 'LISTO':
        return 'bg-lab-primary-100 text-lab-primary-800'
      case 'ENTREGADO':
        return 'bg-lab-neutral-100 text-lab-neutral-800'
      case 'EN_PROCESO':
        return 'bg-lab-warning-100 text-lab-warning-800'
      default:
        return 'bg-lab-info-100 text-lab-info-600'
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
    <div className="space-y-6">
      {/* Messages */}
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

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-lab-neutral-900">Gestión de Resultados</h1>
        <p className="text-lab-neutral-600 mt-2">
          Aquí aparecen los pacientes con citas y toma de muestra completadas. Sube los PDFs de resultados procesados externamente.
        </p>
        <div className="mt-3 bg-lab-info-50 border border-lab-info-200 rounded-lg p-3">
          <p className="text-sm text-lab-info-800">
            <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Sube PDFs de resultados ya procesados, descarga los existentes o visualízalos directamente en el navegador.
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Buscar por paciente o examen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>


      {/* Detail Modal */}
      {showDetailModal && selectedResultado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-lab-neutral-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-lab-neutral-900">Detalles del Resultado</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-lab-neutral-400 hover:text-lab-neutral-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Paciente Info */}
              <div>
                <h3 className="text-lg font-semibold text-lab-neutral-900 mb-3">Información del Paciente</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-lab-neutral-500">Nombre:</span>
                    <p className="font-medium">{selectedResultado.muestra?.paciente?.nombres} {selectedResultado.muestra?.paciente?.apellidos}</p>
                  </div>
                  <div>
                    <span className="text-lab-neutral-500">Cédula:</span>
                    <p className="font-medium font-mono">{selectedResultado.muestra?.paciente?.cedula}</p>
                  </div>
                  <div>
                    <span className="text-lab-neutral-500">Email:</span>
                    <p className="font-medium">{selectedResultado.muestra?.paciente?.email}</p>
                  </div>
                  <div>
                    <span className="text-lab-neutral-500">ID Muestra:</span>
                    <p className="font-medium font-mono">{selectedResultado.muestra?.id_muestra}</p>
                  </div>
                </div>
              </div>

              {/* Exam Info */}
              <div>
                <h3 className="text-lg font-semibold text-lab-neutral-900 mb-3">Información del Examen</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-lab-neutral-500">Examen:</span>
                    <p className="font-medium">{selectedResultado.examen?.nombre}</p>
                  </div>
                  <div>
                    <span className="text-lab-neutral-500">Código Interno:</span>
                    <p className="font-medium font-mono">{selectedResultado.examen?.codigo_interno}</p>
                  </div>
                  <div>
                    <span className="text-lab-neutral-500">Fecha:</span>
                    <p className="font-medium">{formatDate(new Date(selectedResultado.fecha_resultado))}</p>
                  </div>
                  <div>
                    <span className="text-lab-neutral-500">Estado:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEstadoBadge(selectedResultado.estado)}`}>
                      {selectedResultado.estado}
                    </span>
                  </div>
                </div>
              </div>

              {/* Result Values */}
              <div>
                <h3 className="text-lg font-semibold text-lab-neutral-900 mb-3">Valores del Resultado</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedResultado.valor_numerico && (
                    <div>
                      <span className="text-lab-neutral-500">Valor Numérico:</span>
                      <p className="text-2xl font-bold text-lab-primary-600">
                        {selectedResultado.valor_numerico} {selectedResultado.unidad_medida}
                      </p>
                    </div>
                  )}
                  {selectedResultado.valor_texto && (
                    <div>
                      <span className="text-lab-neutral-500">Valor:</span>
                      <p className="text-lg font-semibold">{selectedResultado.valor_texto}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-lab-neutral-500">Nivel:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getNivelBadge(selectedResultado.nivel)}`}>
                      {selectedResultado.nivel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reference Values */}
              {(selectedResultado.valor_referencia_min || selectedResultado.valor_referencia_max || selectedResultado.valores_referencia_texto) && (
                <div>
                  <h3 className="text-lg font-semibold text-lab-neutral-900 mb-3">Valores de Referencia</h3>
                  <div className="bg-lab-neutral-50 rounded-lg p-4 space-y-2 text-sm">
                    {selectedResultado.valor_referencia_min && selectedResultado.valor_referencia_max && (
                      <p>
                        <span className="text-lab-neutral-600">Rango: </span>
                        <span className="font-medium">
                          {selectedResultado.valor_referencia_min} - {selectedResultado.valor_referencia_max} {selectedResultado.unidad_medida}
                        </span>
                      </p>
                    )}
                    {selectedResultado.valores_referencia_texto && (
                      <p>
                        <span className="text-lab-neutral-600">Referencia: </span>
                        <span className="font-medium">{selectedResultado.valores_referencia_texto}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Technical Observations */}
              {selectedResultado.observaciones_tecnicas && (
                <div>
                  <h3 className="text-lg font-semibold text-lab-neutral-900 mb-3">Observaciones Técnicas</h3>
                  <p className="text-sm text-lab-neutral-700 bg-lab-warning-50 border border-lab-warning-200 rounded-lg p-4">
                    {selectedResultado.observaciones_tecnicas}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-lab-neutral-200 flex justify-end">
              <Button onClick={() => setShowDetailModal(false)} variant="outline">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resultados Table */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados ({filteredResultados.length})</CardTitle>
          <CardDescription>Lista de resultados de laboratorio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-lab-neutral-200">
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Fecha</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Paciente</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Examen</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Valor</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Nivel</th>
                  <th className="text-left p-4 font-semibold text-lab-neutral-900">Estado</th>
                  <th className="text-right p-4 font-semibold text-lab-neutral-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredResultados.map((resultado) => (
                  <tr
                    key={resultado.codigo_resultado}
                    className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50"
                  >
                    <td className="p-4 text-sm text-lab-neutral-700">
                      {formatDate(new Date(resultado.fecha_resultado))}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-lab-neutral-900">
                        {resultado.muestra?.paciente?.nombres} {resultado.muestra?.paciente?.apellidos}
                      </div>
                      <div className="text-sm text-lab-neutral-600">{resultado.muestra?.paciente?.email}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-lab-neutral-900">{resultado.examen?.nombre}</div>
                      <div className="text-sm text-lab-neutral-600">{resultado.examen?.codigo_interno}</div>
                    </td>
                    <td className="p-4 font-semibold text-lab-neutral-900">
                      {resultado.valor_numerico ? `${resultado.valor_numerico} ${resultado.unidad_medida || ''}` : resultado.valor_texto}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded ${getNivelBadge(resultado.nivel)}`}>
                        {resultado.nivel}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded ${getEstadoBadge(resultado.estado)}`}>
                        {resultado.estado}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Sin PDF: Mostrar botón de subir */}
                        {!resultado.url_pdf && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenUploadModal(resultado.codigo_resultado)}
                            className="text-lab-primary-600 hover:text-lab-primary-700 hover:bg-lab-primary-50"
                            title="Subir PDF de resultado"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Subir
                          </Button>
                        )}

                        {/* Con PDF: Mostrar botones de vista previa, descarga y editar */}
                        {resultado.url_pdf && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePreviewPDF(resultado.codigo_resultado)}
                              className="text-lab-info-600 hover:text-lab-info-700 hover:bg-lab-info-50"
                              title="Vista previa del PDF"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Ver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadPDF(resultado.codigo_resultado)}
                              className="text-lab-success-600 hover:text-lab-success-700 hover:bg-lab-success-50"
                              title="Descargar PDF"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                              </svg>
                              Descargar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenUploadModal(resultado.codigo_resultado, true)}
                              className="text-lab-warning-600 hover:text-lab-warning-700 hover:bg-lab-warning-50"
                              title="Reemplazar PDF"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Editar
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredResultados.length === 0 && (
              <div className="text-center py-12 text-lab-neutral-500">
                No se encontraron resultados
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload PDF Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-lab-neutral-200">
              <h2 className="text-2xl font-bold text-lab-neutral-900">
                {isEditingPdf ? 'Reemplazar PDF de Resultado' : 'Subir PDF de Resultado'}
              </h2>
              <p className="text-sm text-lab-neutral-600 mt-2">
                {isEditingPdf
                  ? 'Selecciona un nuevo archivo PDF para reemplazar el actual. El PDF anterior será eliminado.'
                  : 'Sube un archivo PDF procesado externamente. Esto validará automáticamente el resultado.'}
              </p>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="pdf-file" className="block text-sm font-medium text-lab-neutral-700 mb-2">
                    Seleccionar archivo PDF *
                  </label>
                  <input
                    type="file"
                    id="pdf-file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-lab-neutral-600
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-lab-primary-50 file:text-lab-primary-700
                      hover:file:bg-lab-primary-100
                      cursor-pointer"
                  />
                  <p className="text-xs text-lab-neutral-500 mt-1">
                    Tamaño máximo: 10MB. Solo archivos PDF
                  </p>
                </div>

                {selectedFile && (
                  <div className="bg-lab-success-50 border border-lab-success-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-lab-success-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-lab-success-800">{selectedFile.name}</p>
                        <p className="text-xs text-lab-success-600">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-lab-neutral-200">
                <Button type="button" onClick={handleCloseUploadModal} variant="outline">
                  Cancelar
                </Button>
                <Button
                  onClick={handleUploadPDF}
                  disabled={!selectedFile}
                  className="bg-lab-primary-600 hover:bg-lab-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {isEditingPdf ? 'Reemplazar PDF' : 'Subir y Validar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="p-4 border-b border-lab-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-lab-neutral-900">Vista Previa del Resultado</h2>
              <button
                onClick={handleClosePdfPreview}
                className="text-lab-neutral-400 hover:text-lab-neutral-600 transition-colors"
                title="Cerrar"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                title="Vista previa del PDF"
              />
            </div>
            <div className="p-4 border-t border-lab-neutral-200 flex justify-end">
              <Button onClick={handleClosePdfPreview} variant="outline">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
