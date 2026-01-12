'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validatePositiveNumber, validateRange, validateReferenceRange } from '@/lib/utils'

interface Categoria {
  codigo_categoria: number
  nombre: string
  descripcion: string | null
  activo?: boolean
}

interface Examen {
  codigo_examen: number
  codigo_interno: string
  nombre: string
  descripcion: string | null
  codigo_categoria: number
  requiere_ayuno: boolean
  horas_ayuno: number | null
  instrucciones_preparacion: string | null
  tiempo_entrega_horas: number
  tipo_muestra: string | null
  valor_referencia_min: number | null
  valor_referencia_max: number | null
  unidad_medida: string | null
  activo: boolean
  categoria?: { nombre: string }
  precios?: Array<{ codigo_precio: number; precio: number; activo: boolean }>
}

type Tab = 'examenes' | 'categorias'

export default function ExamenesPage() {
  const { accessToken } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('examenes')
  const [examenes, setExamenes] = useState<Examen[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingExamen, setEditingExamen] = useState<Examen | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Categoria modal state
  const [showCategoriaModal, setShowCategoriaModal] = useState(false)
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null)
  const [categoriaFormData, setCategoriaFormData] = useState({
    nombre: '',
    descripcion: '',
  })

  // Form state
  const [formData, setFormData] = useState({
    codigo_interno: '',
    nombre: '',
    descripcion: '',
    codigo_categoria: '',
    requiere_ayuno: false,
    horas_ayuno: '',
    instrucciones_preparacion: '',
    tiempo_entrega_horas: '24',
    tipo_muestra: 'Sangre',
    valor_referencia_min: '',
    valor_referencia_max: '',
    unidad_medida: '',
    precio: '',
  })

  useEffect(() => {
    loadExamenes()
    loadCategorias()
  }, [])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const loadExamenes = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/exams`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (response.ok) {
        const result = await response.json()
        const examenes = result.data || result
        setExamenes(examenes)
      }
    } catch (error) {
      console.error('Error loading examenes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategorias = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/exam-categories`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (response.ok) {
        const data = await response.json()
        setCategorias(data)
      }
    } catch (error) {
      console.error('Error loading categorias:', error)
    }
  }

  // ==================== EXAMENES HANDLERS ====================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.precio) {
      const precio = parseFloat(formData.precio)
      if (!validatePositiveNumber(precio)) {
        setMessage({ type: 'error', text: '❌ El precio debe ser un número positivo.' })
        return
      }
      if (precio === 0) {
        setMessage({ type: 'error', text: '❌ El precio debe ser mayor a 0.' })
        return
      }
    }

    if (formData.requiere_ayuno && formData.horas_ayuno) {
      const horasAyuno = parseInt(formData.horas_ayuno)
      if (!validateRange(horasAyuno, 0, 24)) {
        setMessage({ type: 'error', text: '❌ Las horas de ayuno deben estar entre 0 y 24 horas.' })
        return
      }
    }

    const tiempoEntrega = parseInt(formData.tiempo_entrega_horas)
    if (!validateRange(tiempoEntrega, 1, 720)) {
      setMessage({ type: 'error', text: '❌ El tiempo de entrega debe estar entre 1 y 720 horas (30 días).' })
      return
    }

    const valorRefMin = formData.valor_referencia_min ? parseFloat(formData.valor_referencia_min) : undefined
    const valorRefMax = formData.valor_referencia_max ? parseFloat(formData.valor_referencia_max) : undefined

    if (!validateReferenceRange(valorRefMin, valorRefMax)) {
      setMessage({
        type: 'error',
        text: `❌ El valor de referencia mínimo (${valorRefMin}) debe ser menor que el máximo (${valorRefMax}).`
      })
      return
    }

    if ((valorRefMin !== undefined || valorRefMax !== undefined) && !formData.unidad_medida) {
      setMessage({
        type: 'error',
        text: '❌ Si ingresa valores de referencia, debe especificar la unidad de medida.'
      })
      return
    }

    const examenData = {
      codigo_interno: formData.codigo_interno.trim(),
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion ? formData.descripcion.trim() : null,
      codigo_categoria: parseInt(formData.codigo_categoria),
      requiere_ayuno: formData.requiere_ayuno,
      horas_ayuno: formData.requiere_ayuno && formData.horas_ayuno ? parseInt(formData.horas_ayuno) : null,
      instrucciones_preparacion: formData.instrucciones_preparacion ? formData.instrucciones_preparacion.trim() : null,
      tiempo_entrega_horas: tiempoEntrega,
      tipo_muestra: formData.tipo_muestra,
      valor_referencia_min: valorRefMin !== undefined ? valorRefMin : null,
      valor_referencia_max: valorRefMax !== undefined ? valorRefMax : null,
      unidad_medida: formData.unidad_medida ? formData.unidad_medida.trim() : null,
      activo: true,
    }

    try {
      if (editingExamen) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/admin/exams/${editingExamen.codigo_examen}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(examenData),
          }
        )

        if (response.ok) {
          // Actualizar o crear precio si se especificó
          if (formData.precio) {
            const precioActual = editingExamen.precios?.[0]
            if (precioActual?.codigo_precio) {
              // Actualizar precio existente
              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/prices/${precioActual.codigo_precio}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  precio: parseFloat(formData.precio),
                  activo: true,
                }),
              })
            } else {
              // Crear nuevo precio si no existe
              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/prices`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  codigo_examen: editingExamen.codigo_examen,
                  precio: parseFloat(formData.precio),
                  activo: true,
                }),
              })
            }
          }
          setMessage({ type: 'success', text: 'Examen actualizado correctamente' })
          loadExamenes()
          handleCloseModal()
        } else {
          const error = await response.json()
          setMessage({ type: 'error', text: error.message || 'Error al actualizar examen' })
        }
      } else {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/exams`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(examenData),
        })

        if (response.ok) {
          const newExamen = await response.json()

          if (formData.precio) {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/prices`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                codigo_examen: newExamen.codigo_examen,
                precio: parseFloat(formData.precio),
                activo: true,
              }),
            })
          }

          setMessage({ type: 'success', text: '✅ Examen creado! Los pacientes ya pueden verlo en Cotizaciones' })
          loadExamenes()
          handleCloseModal()
        } else {
          const error = await response.json()
          setMessage({ type: 'error', text: error.message || 'Error al crear examen' })
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleEdit = (examen: Examen) => {
    setEditingExamen(examen)
    setFormData({
      codigo_interno: examen.codigo_interno,
      nombre: examen.nombre,
      descripcion: examen.descripcion || '',
      codigo_categoria: examen.codigo_categoria.toString(),
      requiere_ayuno: examen.requiere_ayuno,
      horas_ayuno: examen.horas_ayuno?.toString() || '',
      instrucciones_preparacion: examen.instrucciones_preparacion || '',
      tiempo_entrega_horas: examen.tiempo_entrega_horas.toString(),
      tipo_muestra: examen.tipo_muestra || 'Sangre',
      valor_referencia_min: examen.valor_referencia_min?.toString() || '',
      valor_referencia_max: examen.valor_referencia_max?.toString() || '',
      unidad_medida: examen.unidad_medida || '',
      precio: examen.precios?.[0]?.precio.toString() || '',
    })
    setShowModal(true)
  }

  const handleToggleActive = async (codigo_examen: number, isActive: boolean) => {
    const action = isActive ? 'desactivar' : 'activar'
    if (!confirm(`¿Estás seguro de que deseas ${action} este examen?`)) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/exams/${codigo_examen}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.ok) {
        setExamenes((prevExamenes) =>
          prevExamenes.map((examen) =>
            examen.codigo_examen === codigo_examen
              ? { ...examen, activo: !isActive }
              : examen
          )
        )
        setMessage({ type: 'success', text: `Examen ${isActive ? 'desactivado' : 'activado'} correctamente` })
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error al ${action} examen` })
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingExamen(null)
    setFormData({
      codigo_interno: '',
      nombre: '',
      descripcion: '',
      codigo_categoria: '',
      requiere_ayuno: false,
      horas_ayuno: '',
      instrucciones_preparacion: '',
      tiempo_entrega_horas: '24',
      tipo_muestra: 'Sangre',
      valor_referencia_min: '',
      valor_referencia_max: '',
      unidad_medida: '',
      precio: '',
    })
  }

  // ==================== CATEGORIAS HANDLERS ====================

  const handleOpenCategoriaModal = (categoria?: Categoria) => {
    if (categoria) {
      setEditingCategoria(categoria)
      setCategoriaFormData({
        nombre: categoria.nombre,
        descripcion: categoria.descripcion || '',
      })
    } else {
      setEditingCategoria(null)
      setCategoriaFormData({ nombre: '', descripcion: '' })
    }
    setShowCategoriaModal(true)
  }

  const handleCloseCategoriaModal = () => {
    setShowCategoriaModal(false)
    setEditingCategoria(null)
    setCategoriaFormData({ nombre: '', descripcion: '' })
  }

  const handleCategoriaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!categoriaFormData.nombre.trim()) {
      setMessage({ type: 'error', text: 'El nombre de la categoría es requerido' })
      return
    }

    try {
      const url = editingCategoria
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin/exam-categories/${editingCategoria.codigo_categoria}`
        : `${process.env.NEXT_PUBLIC_API_URL}/admin/exam-categories`

      const response = await fetch(url, {
        method: editingCategoria ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          nombre: categoriaFormData.nombre.trim(),
          descripcion: categoriaFormData.descripcion.trim() || null,
        }),
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: editingCategoria ? 'Categoría actualizada correctamente' : 'Categoría creada correctamente',
        })
        handleCloseCategoriaModal()
        loadCategorias()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al guardar categoría' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleDeleteCategoria = async (codigo_categoria: number) => {
    if (!confirm('¿Está seguro de eliminar esta categoría?')) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/exam-categories/${codigo_categoria}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Categoría eliminada correctamente' })
        loadCategorias()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al eliminar categoría' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const filteredExamenes = examenes.filter(
    (examen) =>
      examen.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      examen.codigo_interno.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-lab-neutral-900">Gestión de Exámenes</h1>
          <p className="text-lab-neutral-600 mt-2">
            Administra el catálogo de exámenes y sus categorías.
          </p>
        </div>
        {activeTab === 'examenes' && (
          <Button onClick={() => setShowModal(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Examen
          </Button>
        )}
        {activeTab === 'categorias' && (
          <Button onClick={() => handleOpenCategoriaModal()}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Categoría
          </Button>
        )}
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
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-lab-neutral-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('examenes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'examenes'
                ? 'border-lab-primary-500 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            Exámenes ({examenes.length})
          </button>
          <button
            onClick={() => setActiveTab('categorias')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'categorias'
                ? 'border-lab-primary-500 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            Categorías ({categorias.length})
          </button>
        </nav>
      </div>

      {/* Tab Content: Examenes */}
      {activeTab === 'examenes' && (
        <>
          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </CardContent>
          </Card>

          {/* Examenes Table */}
          <Card>
            <CardHeader>
              <CardTitle>Exámenes ({filteredExamenes.length})</CardTitle>
              <CardDescription>Lista de todos los exámenes disponibles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-lab-neutral-200">
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Código</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Nombre</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Categoría</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Precio</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Ayuno</th>
                      <th className="text-left p-4 font-semibold text-lab-neutral-900">Estado</th>
                      <th className="text-right p-4 font-semibold text-lab-neutral-900">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExamenes.map((examen) => (
                      <tr key={examen.codigo_examen} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                        <td className="p-4 text-sm font-mono text-lab-neutral-700">{examen.codigo_interno}</td>
                        <td className="p-4">
                          <div className="font-medium text-lab-neutral-900">{examen.nombre}</div>
                          {examen.descripcion && (
                            <div className="text-sm text-lab-neutral-600 truncate max-w-xs">{examen.descripcion}</div>
                          )}
                        </td>
                        <td className="p-4 text-sm text-lab-neutral-700">{examen.categoria?.nombre || '-'}</td>
                        <td className="p-4 text-sm font-semibold text-lab-neutral-900">
                          ${examen.precios?.[0]?.precio ? Number(examen.precios[0].precio).toFixed(2) : '0.00'}
                        </td>
                        <td className="p-4">
                          {examen.requiere_ayuno ? (
                            <span className="text-xs px-2 py-1 bg-lab-warning-100 text-lab-warning-800 rounded">
                              {examen.horas_ayuno}h
                            </span>
                          ) : (
                            <span className="text-xs text-lab-neutral-500">No</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              examen.activo
                                ? 'bg-lab-success-100 text-lab-success-800'
                                : 'bg-lab-neutral-100 text-lab-neutral-600'
                            }`}
                          >
                            {examen.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(examen)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={
                              examen.activo
                                ? 'text-lab-danger-600 hover:text-lab-danger-700'
                                : 'text-lab-success-600 hover:text-lab-success-700'
                            }
                            onClick={() => handleToggleActive(examen.codigo_examen, examen.activo)}
                          >
                            {examen.activo ? 'Desactivar' : 'Activar'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredExamenes.length === 0 && (
                  <div className="text-center py-12 text-lab-neutral-500">
                    No se encontraron exámenes
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab Content: Categorias */}
      {activeTab === 'categorias' && (
        <Card>
          <CardHeader>
            <CardTitle>Categorías de Exámenes ({categorias.length})</CardTitle>
            <CardDescription>Organiza los exámenes por categoría</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-lab-neutral-200">
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">ID</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Nombre</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Descripción</th>
                    <th className="text-left p-4 font-semibold text-lab-neutral-900">Exámenes</th>
                    <th className="text-right p-4 font-semibold text-lab-neutral-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((cat) => {
                    const examenesEnCategoria = examenes.filter(e => e.codigo_categoria === cat.codigo_categoria).length
                    return (
                      <tr key={cat.codigo_categoria} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                        <td className="p-4 text-sm font-mono text-lab-neutral-600">{cat.codigo_categoria}</td>
                        <td className="p-4 font-medium text-lab-neutral-900">{cat.nombre}</td>
                        <td className="p-4 text-sm text-lab-neutral-600">{cat.descripcion || '-'}</td>
                        <td className="p-4">
                          <span className="text-xs px-2 py-1 bg-lab-info-100 text-lab-info-800 rounded">
                            {examenesEnCategoria} exámenes
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenCategoriaModal(cat)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-lab-danger-600 hover:text-lab-danger-700"
                            onClick={() => handleDeleteCategoria(cat.codigo_categoria)}
                            disabled={examenesEnCategoria > 0}
                            title={examenesEnCategoria > 0 ? 'No se puede eliminar una categoría con exámenes' : ''}
                          >
                            Eliminar
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {categorias.length === 0 && (
                <div className="text-center py-12 text-lab-neutral-500">
                  No hay categorías. Crea la primera para organizar tus exámenes.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Examen */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full my-8">
            <div className="p-6 border-b border-lab-neutral-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-lab-neutral-900">
                  {editingExamen ? 'Editar Examen' : 'Nuevo Examen'}
                </h2>
                <button onClick={handleCloseModal} className="text-lab-neutral-400 hover:text-lab-neutral-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo_interno">Código Interno *</Label>
                  <Input
                    id="codigo_interno"
                    value={formData.codigo_interno}
                    onChange={(e) => setFormData({ ...formData, codigo_interno: e.target.value })}
                    placeholder="BIOQ-001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codigo_categoria">Categoría *</Label>
                  <select
                    id="codigo_categoria"
                    value={formData.codigo_categoria}
                    onChange={(e) => setFormData({ ...formData, codigo_categoria: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((cat) => (
                      <option key={cat.codigo_categoria} value={cat.codigo_categoria}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Examen *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Glucosa en Ayunas"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <textarea
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border border-lab-neutral-300"
                  placeholder="Medición de glucosa en sangre"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio ($) *</Label>
                  <Input
                    id="precio"
                    type="number"
                    step="0.01"
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                    placeholder="15.00"
                    required={!editingExamen}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo_muestra">Tipo de Muestra</Label>
                  <select
                    id="tipo_muestra"
                    value={formData.tipo_muestra}
                    onChange={(e) => setFormData({ ...formData, tipo_muestra: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
                  >
                    <option value="Sangre">Sangre</option>
                    <option value="Orina">Orina</option>
                    <option value="Heces">Heces</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tiempo_entrega_horas">Entrega (horas)</Label>
                  <Input
                    id="tiempo_entrega_horas"
                    type="number"
                    value={formData.tiempo_entrega_horas}
                    onChange={(e) => setFormData({ ...formData, tiempo_entrega_horas: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="requiere_ayuno"
                  checked={formData.requiere_ayuno}
                  onChange={(e) => setFormData({ ...formData, requiere_ayuno: e.target.checked })}
                  className="h-4 w-4 rounded border-lab-neutral-300"
                />
                <Label htmlFor="requiere_ayuno" className="cursor-pointer">
                  Requiere Ayuno
                </Label>
              </div>

              {formData.requiere_ayuno && (
                <div className="space-y-2">
                  <Label htmlFor="horas_ayuno">Horas de Ayuno</Label>
                  <Input
                    id="horas_ayuno"
                    type="number"
                    value={formData.horas_ayuno}
                    onChange={(e) => setFormData({ ...formData, horas_ayuno: e.target.value })}
                    placeholder="8"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="instrucciones_preparacion">Instrucciones de Preparación</Label>
                <textarea
                  id="instrucciones_preparacion"
                  value={formData.instrucciones_preparacion}
                  onChange={(e) => setFormData({ ...formData, instrucciones_preparacion: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border border-lab-neutral-300"
                  placeholder="Primera orina de la mañana"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor_referencia_min">Valor Mín.</Label>
                  <Input
                    id="valor_referencia_min"
                    type="number"
                    step="0.01"
                    value={formData.valor_referencia_min}
                    onChange={(e) => setFormData({ ...formData, valor_referencia_min: e.target.value })}
                    placeholder="70"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor_referencia_max">Valor Máx.</Label>
                  <Input
                    id="valor_referencia_max"
                    type="number"
                    step="0.01"
                    value={formData.valor_referencia_max}
                    onChange={(e) => setFormData({ ...formData, valor_referencia_max: e.target.value })}
                    placeholder="100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unidad_medida">Unidad de Medida</Label>
                  <select
                    id="unidad_medida"
                    value={formData.unidad_medida}
                    onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-lab-neutral-300 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                  >
                    <option value="">Seleccionar...</option>
                    <optgroup label="Concentración">
                      <option value="mg/dL">mg/dL (miligramos por decilitro)</option>
                      <option value="g/dL">g/dL (gramos por decilitro)</option>
                      <option value="g/L">g/L (gramos por litro)</option>
                      <option value="mmol/L">mmol/L (milimoles por litro)</option>
                      <option value="μmol/L">μmol/L (micromoles por litro)</option>
                      <option value="mEq/L">mEq/L (miliequivalentes por litro)</option>
                    </optgroup>
                    <optgroup label="Enzimas/Hormonas">
                      <option value="UI/L">UI/L (unidades internacionales por litro)</option>
                      <option value="U/L">U/L (unidades por litro)</option>
                      <option value="mUI/mL">mUI/mL (miliunidades por mililitro)</option>
                      <option value="μUI/mL">μUI/mL (microunidades por mililitro)</option>
                      <option value="ng/mL">ng/mL (nanogramos por mililitro)</option>
                      <option value="pg/mL">pg/mL (picogramos por mililitro)</option>
                      <option value="ng/dL">ng/dL (nanogramos por decilitro)</option>
                    </optgroup>
                    <optgroup label="Hematología">
                      <option value="células/μL">células/μL</option>
                      <option value="x10³/μL">x10³/μL (miles por microlitro)</option>
                      <option value="x10⁶/μL">x10⁶/μL (millones por microlitro)</option>
                      <option value="mm³">mm³ (milímetros cúbicos)</option>
                      <option value="fL">fL (femtolitros)</option>
                      <option value="pg">pg (picogramos)</option>
                    </optgroup>
                    <optgroup label="Otros">
                      <option value="%">% (porcentaje)</option>
                      <option value="segundos">segundos</option>
                      <option value="mm/h">mm/h (milímetros por hora)</option>
                      <option value="pH">pH</option>
                      <option value="Positivo/Negativo">Positivo/Negativo</option>
                      <option value="Reactivo/No Reactivo">Reactivo/No Reactivo</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-lab-neutral-200">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit">{editingExamen ? 'Actualizar' : 'Crear'} Examen</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Categoria */}
      {showCategoriaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-lab-neutral-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-lab-neutral-900">
                  {editingCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
                </h2>
                <button onClick={handleCloseCategoriaModal} className="text-lab-neutral-400 hover:text-lab-neutral-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCategoriaSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cat_nombre">Nombre *</Label>
                <Input
                  id="cat_nombre"
                  value={categoriaFormData.nombre}
                  onChange={(e) => setCategoriaFormData({ ...categoriaFormData, nombre: e.target.value })}
                  placeholder="Hematología"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cat_descripcion">Descripción</Label>
                <textarea
                  id="cat_descripcion"
                  value={categoriaFormData.descripcion}
                  onChange={(e) => setCategoriaFormData({ ...categoriaFormData, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-lab-neutral-300"
                  placeholder="Exámenes relacionados con la sangre..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-lab-neutral-200">
                <Button type="button" variant="outline" onClick={handleCloseCategoriaModal}>
                  Cancelar
                </Button>
                <Button type="submit">{editingCategoria ? 'Actualizar' : 'Crear'} Categoría</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
