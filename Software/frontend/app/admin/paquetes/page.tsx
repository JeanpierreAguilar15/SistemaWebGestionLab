'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

interface Package {
  codigo_paquete: number
  nombre: string
  descripcion: string | null
  precio_paquete: string
  descuento: string
  activo: boolean
  fecha_creacion: string
  examenes?: Array<{
    codigo_paquete_examen: number
    codigo_examen: number
    examen: {
      codigo_examen: number
      nombre: string
      precio: string
    }
  }>
  _count?: {
    examenes: number
  }
}

interface Exam {
  codigo_examen: number
  nombre: string
  codigo_categoria: number
  categoria: {
    nombre: string
  }
  precios?: Array<{ codigo_precio: number; precio: number; activo: boolean }>
}

interface Message {
  type: 'success' | 'error'
  text: string
}

export default function PackagesManagement() {
  const { accessToken } = useAuthStore()
  const [packages, setPackages] = useState<Package[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingPackage, setEditingPackage] = useState<Package | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    descuento: '0',
    activo: true,
    examenes: [] as number[],
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && accessToken) {
      loadPackages()
      loadExams()
    }
  }, [accessToken, mounted])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const loadPackages = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/packages`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPackages(data)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar paquetes' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setLoading(false)
    }
  }

  const loadExams = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/exams`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setExams(data.data || data)
      }
    } catch (error) {
      console.error('Error loading exams:', error)
    }
  }

  const handleOpenForm = (pkg?: Package) => {
    if (pkg) {
      setEditingPackage(pkg)
      setFormData({
        nombre: pkg.nombre,
        descripcion: pkg.descripcion || '',
        descuento: String(pkg.descuento || '0'),
        activo: pkg.activo,
        examenes: pkg.examenes?.map(e => e.codigo_examen) || [],
      })
    } else {
      setEditingPackage(null)
      setFormData({
        nombre: '',
        descripcion: '',
        descuento: '0',
        activo: true,
        examenes: [],
      })
    }
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingPackage(null)
    setFormData({
      nombre: '',
      descripcion: '',
      descuento: '0',
      activo: true,
      examenes: [],
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleExamToggle = (examId: number) => {
    setFormData(prev => ({
      ...prev,
      examenes: prev.examenes.includes(examId)
        ? prev.examenes.filter(id => id !== examId)
        : [...prev.examenes, examId],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingPackage
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin/packages/${editingPackage.codigo_paquete}`
        : `${process.env.NEXT_PUBLIC_API_URL}/admin/packages`

      const response = await fetch(url, {
        method: editingPackage ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          nombre: formData.nombre,
          descripcion: formData.descripcion || null,
          precio_paquete: calculateFinalPrice(),
          descuento: parseFloat(formData.descuento) || 0,
          activo: formData.activo,
          examenes: formData.examenes,
        }),
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: editingPackage ? '✅ Paquete actualizado correctamente' : '✅ Paquete creado correctamente',
        })
        handleCloseForm()
        loadPackages()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al guardar paquete' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleDelete = async (codigo_paquete: number) => {
    if (!confirm('¿Estás seguro de que deseas desactivar este paquete?')) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/packages/${codigo_paquete}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok || response.status === 204) {
        setMessage({ type: 'success', text: '✅ Paquete desactivado correctamente' })
        loadPackages()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al desactivar paquete' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const calculateTotalPrice = () => {
    if (formData.examenes.length === 0) return 0
    const total = formData.examenes.reduce((sum, examId) => {
      const exam = exams.find(e => e.codigo_examen === examId)
      const precio = exam?.precios?.[0]?.precio || 0
      return sum + Number(precio)
    }, 0)
    return total
  }

  const calculateFinalPrice = () => {
    const total = calculateTotalPrice()
    const descuento = parseFloat(formData.descuento) || 0
    const finalPrice = total - (total * descuento / 100)
    return finalPrice
  }

  const calculateSavings = () => {
    const total = calculateTotalPrice()
    const finalPrice = calculateFinalPrice()
    return total - finalPrice
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600"></div>
      </div>
    )
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-lab-neutral-900">Gestión de Paquetes</h1>
          <p className="text-lab-neutral-600 mt-1">Administra los paquetes de exámenes</p>
        </div>
        <Button onClick={() => handleOpenForm()} className="bg-lab-primary-600 hover:bg-lab-primary-700">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Paquete
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full my-8">
            <div className="p-6 border-b border-lab-neutral-200">
              <h2 className="text-2xl font-bold text-lab-neutral-900">
                {editingPackage ? 'Editar Paquete' : 'Nuevo Paquete'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="nombre" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                      Nombre del Paquete *
                    </label>
                    <input
                      type="text"
                      id="nombre"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleInputChange}
                      required
                      className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="descripcion" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                      Descripción
                    </label>
                    <textarea
                      id="descripcion"
                      name="descripcion"
                      value={formData.descripcion}
                      onChange={handleInputChange}
                      rows={3}
                      className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                    />
                  </div>


                  <div>
                    <label htmlFor="descuento" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                      Descuento (%)
                    </label>
                    <input
                      type="number"
                      id="descuento"
                      name="descuento"
                      value={formData.descuento}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      max="100"
                      className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="activo"
                      name="activo"
                      checked={formData.activo}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-lab-primary-600 focus:ring-lab-primary-500 border-lab-neutral-300 rounded"
                    />
                    <label htmlFor="activo" className="ml-2 block text-sm text-lab-neutral-700">
                      Paquete activo
                    </label>
                  </div>

                  {/* Price Summary */}
                  {formData.examenes.length > 0 && (
                    <div className="bg-lab-neutral-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-lab-neutral-600">Suma de exámenes:</span>
                        <span className="font-semibold">${calculateTotalPrice().toFixed(2)}</span>
                      </div>
                      {parseFloat(formData.descuento) > 0 && (
                        <div className="flex justify-between text-sm text-lab-success-600">
                          <span>Descuento ({formData.descuento}%):</span>
                          <span className="font-semibold">-${calculateSavings().toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg pt-2 border-t border-lab-neutral-200">
                        <span className="text-lab-primary-700 font-bold">Precio Final:</span>
                        <span className="font-bold text-lab-primary-700">${calculateFinalPrice().toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Exams Selection */}
                <div>
                  <label className="block text-sm font-medium text-lab-neutral-700 mb-2">
                    Exámenes Incluidos * ({formData.examenes.length} seleccionados)
                  </label>
                  <div className="border border-lab-neutral-300 rounded-md max-h-96 overflow-y-auto">
                    {exams.length === 0 ? (
                      <div className="p-4 text-center text-lab-neutral-500">
                        No hay exámenes disponibles
                      </div>
                    ) : (
                      <div className="divide-y divide-lab-neutral-200">
                        {exams.map((exam) => (
                          <div
                            key={exam.codigo_examen}
                            className="p-3 hover:bg-lab-neutral-50 cursor-pointer"
                            onClick={() => handleExamToggle(exam.codigo_examen)}
                          >
                            <div className="flex items-start">
                              <input
                                type="checkbox"
                                checked={formData.examenes.includes(exam.codigo_examen)}
                                onChange={() => handleExamToggle(exam.codigo_examen)}
                                className="h-4 w-4 mt-0.5 text-lab-primary-600 focus:ring-lab-primary-500 border-lab-neutral-300 rounded"
                              />
                              <div className="ml-3 flex-1">
                                <div className="text-sm font-medium text-lab-neutral-900">{exam.nombre}</div>
                                <div className="text-xs text-lab-neutral-500">{exam.categoria.nombre}</div>
                              </div>
                              <div className="text-sm font-semibold text-lab-primary-600">${Number(exam.precios?.[0]?.precio || 0).toFixed(2)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.examenes.length === 0 && (
                    <p className="mt-2 text-sm text-lab-danger-600">Debe seleccionar al menos un examen</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-lab-neutral-200">
                <Button type="button" onClick={handleCloseForm} variant="outline">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-lab-primary-600 hover:bg-lab-primary-700"
                  disabled={formData.examenes.length === 0}
                >
                  {editingPackage ? 'Actualizar' : 'Crear'} Paquete
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <div
            key={pkg.codigo_paquete}
            className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-lab-success-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-lab-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  pkg.activo
                    ? 'bg-lab-success-100 text-lab-success-800'
                    : 'bg-lab-neutral-100 text-lab-neutral-800'
                }`}
              >
                {pkg.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <h3 className="text-lg font-semibold text-lab-neutral-900 mb-2">
              {pkg.nombre}
            </h3>

            <p className="text-sm text-lab-neutral-600 mb-4 line-clamp-2">
              {pkg.descripcion || 'Sin descripción'}
            </p>

            <div className="flex items-center justify-between py-3 border-t border-b border-lab-neutral-200 my-4">
              <div>
                <p className="text-xs text-lab-neutral-500">Precio</p>
                <p className="text-2xl font-bold text-lab-primary-600">
                  ${Number(pkg.precio_paquete).toFixed(2)}
                </p>
              </div>
              {Number(pkg.descuento) > 0 && (
                <div className="text-right">
                  <p className="text-xs text-lab-neutral-500">Descuento</p>
                  <p className="text-lg font-semibold text-lab-success-600">
                    {Number(pkg.descuento).toFixed(0)}%
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm text-lab-neutral-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{pkg._count?.examenes || 0} exámenes</span>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={() => handleOpenForm(pkg)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Editar
                </Button>
                <Button
                  onClick={() => handleDelete(pkg.codigo_paquete)}
                  variant="outline"
                  size="sm"
                  className="text-lab-danger-600 hover:text-lab-danger-700 hover:bg-lab-danger-50"
                >
                  Desactivar
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {packages.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-lab-neutral-900">No hay paquetes</h3>
          <p className="mt-1 text-sm text-lab-neutral-500">Comienza creando un nuevo paquete de exámenes.</p>
        </div>
      )}
    </div>
  )
}
