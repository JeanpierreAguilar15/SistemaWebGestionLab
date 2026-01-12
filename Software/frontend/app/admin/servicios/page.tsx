'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

interface Service {
  codigo_servicio: number
  nombre: string
  descripcion: string | null
  activo: boolean
  fecha_creacion: string
}

interface ServiceFormData {
  nombre: string
  descripcion: string
  activo: boolean
}

export default function ServicesManagement() {
  const { accessToken } = useAuthStore()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [formData, setFormData] = useState<ServiceFormData>({
    nombre: '',
    descripcion: '',
    activo: true,
  })

  useEffect(() => {
    loadServices()
  }, [])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const loadServices = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/services`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setServices(data)
      }
    } catch (error) {
      console.error('Error loading services:', error)
      setMessage({ type: 'error', text: 'Error al cargar los servicios' })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (service?: Service) => {
    if (service) {
      setEditingService(service)
      setFormData({
        nombre: service.nombre,
        descripcion: service.descripcion || '',
        activo: service.activo,
      })
    } else {
      setEditingService(null)
      setFormData({
        nombre: '',
        descripcion: '',
        activo: true,
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingService(null)
    setFormData({
      nombre: '',
      descripcion: '',
      activo: true,
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    if (!formData.nombre.trim()) {
      setMessage({ type: 'error', text: 'El nombre del servicio es requerido' })
      return
    }

    if (formData.nombre.length < 2 || formData.nombre.length > 200) {
      setMessage({ type: 'error', text: 'El nombre debe tener entre 2 y 200 caracteres' })
      return
    }

    if (formData.descripcion.length > 1000) {
      setMessage({ type: 'error', text: 'La descripción no puede exceder 1000 caracteres' })
      return
    }

    const serviceData = {
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion.trim() || null,
      activo: formData.activo,
    }

    try {
      if (editingService) {
        // Actualizar servicio existente
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/admin/services/${editingService.codigo_servicio}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(serviceData),
          }
        )

        if (response.ok) {
          setMessage({ type: 'success', text: '✅ Servicio actualizado correctamente' })
          loadServices()
          handleCloseModal()
        } else {
          const error = await response.json()
          setMessage({
            type: 'error',
            text: error.message || 'Error al actualizar el servicio',
          })
        }
      } else {
        // Crear nuevo servicio
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/services`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(serviceData),
        })

        if (response.ok) {
          setMessage({ type: 'success', text: '✅ Servicio creado correctamente' })
          loadServices()
          handleCloseModal()
        } else {
          const error = await response.json()
          setMessage({
            type: 'error',
            text: error.message || 'Error al crear el servicio',
          })
        }
      }
    } catch (error) {
      console.error('Error submitting service:', error)
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleDelete = async (serviceId: number, serviceName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el servicio "${serviceName}"?`)) {
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/services/${serviceId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        setMessage({ type: 'success', text: '✅ Servicio eliminado correctamente' })
        loadServices()
      } else {
        const error = await response.json()
        setMessage({
          type: 'error',
          text: error.message || 'Error al eliminar el servicio',
        })
      }
    } catch (error) {
      console.error('Error deleting service:', error)
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
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
      {/* Message Toast */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            message.type === 'success'
              ? 'bg-lab-success-50 border border-lab-success-200 text-lab-success-800'
              : 'bg-lab-danger-50 border border-lab-danger-200 text-lab-danger-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <p className="font-medium">{message.text}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-lab-neutral-900">Gestión de Servicios</h1>
          <p className="text-lab-neutral-600 mt-1">Administra los servicios disponibles para citas</p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-lab-primary-600 hover:bg-lab-primary-700"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Servicio
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-lab-secondary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-lab-neutral-600">Total Servicios</p>
              <p className="text-2xl font-bold text-lab-neutral-900">{services.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-lab-success-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-lab-neutral-600">Servicios Activos</p>
              <p className="text-2xl font-bold text-lab-neutral-900">{services.filter(s => s.activo).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => (
          <div
            key={service.codigo_servicio}
            className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-lab-secondary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-lab-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  service.activo
                    ? 'bg-lab-success-100 text-lab-success-800'
                    : 'bg-lab-neutral-100 text-lab-neutral-800'
                }`}
              >
                {service.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <h3 className="text-lg font-semibold text-lab-neutral-900 mb-2">
              {service.nombre}
            </h3>

            <p className="text-sm text-lab-neutral-600 mb-4 line-clamp-2">
              {service.descripcion || 'Sin descripción'}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-lab-neutral-200">
              <span className="text-xs text-lab-neutral-500">
                Creado: {new Date(service.fecha_creacion).toLocaleDateString('es-ES')}
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenModal(service)}
                  title="Editar servicio"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(service.codigo_servicio, service.nombre)}
                  className="text-lab-danger-600 hover:text-lab-danger-700 hover:bg-lab-danger-50"
                  title="Eliminar servicio"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {services.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-lab-neutral-900">No hay servicios</h3>
          <p className="mt-1 text-sm text-lab-neutral-500">Comienza creando un nuevo servicio.</p>
        </div>
      )}

      {/* Modal for Create/Edit Service */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={handleCloseModal}
            ></div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-lab-neutral-900">
                      {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
                    </h3>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="text-lab-neutral-400 hover:text-lab-neutral-600"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Nombre */}
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-medium text-lab-neutral-700">
                        Nombre del Servicio <span className="text-lab-danger-600">*</span>
                      </label>
                      <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleInputChange}
                        required
                        minLength={2}
                        maxLength={200}
                        className="mt-1 block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:outline-none focus:ring-1 focus:ring-lab-primary-500"
                        placeholder="Ej: Consulta General, Toma de Muestras, etc."
                      />
                    </div>

                    {/* Descripción */}
                    <div>
                      <label htmlFor="descripcion" className="block text-sm font-medium text-lab-neutral-700">
                        Descripción
                      </label>
                      <textarea
                        id="descripcion"
                        name="descripcion"
                        value={formData.descripcion}
                        onChange={handleInputChange}
                        rows={4}
                        maxLength={1000}
                        className="mt-1 block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:outline-none focus:ring-1 focus:ring-lab-primary-500"
                        placeholder="Descripción del servicio ofrecido"
                      />
                      <p className="mt-1 text-xs text-lab-neutral-500">
                        {formData.descripcion.length} / 1000 caracteres
                      </p>
                    </div>

                    {/* Estado */}
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
                        Servicio activo y disponible para agendar citas
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-lab-neutral-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto sm:ml-3 bg-lab-primary-600 hover:bg-lab-primary-700"
                  >
                    {editingService ? 'Actualizar' : 'Crear'} Servicio
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseModal}
                    className="mt-3 w-full sm:mt-0 sm:w-auto"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
