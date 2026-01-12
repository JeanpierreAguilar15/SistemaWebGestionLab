'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

interface Location {
  codigo_sede: number
  nombre: string
  direccion: string
  telefono: string | null
  email: string | null
  activo: boolean
}

interface LocationFormData {
  nombre: string
  direccion: string
  telefono: string
  email: string
  activo: boolean
}

export default function LocationsManagement() {
  const { accessToken } = useAuthStore()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [formData, setFormData] = useState<LocationFormData>({
    nombre: '',
    direccion: '',
    telefono: '',
    email: '',
    activo: true,
  })

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const loadLocations = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/locations`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setLocations(data)
      }
    } catch (error) {
      console.error('Error loading locations:', error)
      setMessage({ type: 'error', text: 'Error al cargar las sedes' })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (location?: Location) => {
    if (location) {
      setEditingLocation(location)
      setFormData({
        nombre: location.nombre,
        direccion: location.direccion,
        telefono: location.telefono || '',
        email: location.email || '',
        activo: location.activo,
      })
    } else {
      setEditingLocation(null)
      setFormData({
        nombre: '',
        direccion: '',
        telefono: '',
        email: '',
        activo: true,
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingLocation(null)
    setFormData({
      nombre: '',
      direccion: '',
      telefono: '',
      email: '',
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
      setMessage({ type: 'error', text: 'El nombre de la sede es requerido' })
      return
    }

    if (formData.nombre.length < 2 || formData.nombre.length > 200) {
      setMessage({ type: 'error', text: 'El nombre debe tener entre 2 y 200 caracteres' })
      return
    }

    if (!formData.direccion.trim()) {
      setMessage({ type: 'error', text: 'La dirección es requerida' })
      return
    }

    if (formData.direccion.length > 500) {
      setMessage({ type: 'error', text: 'La dirección no puede exceder 500 caracteres' })
      return
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setMessage({ type: 'error', text: 'El email debe ser válido' })
      return
    }

    const locationData = {
      nombre: formData.nombre.trim(),
      direccion: formData.direccion.trim(),
      telefono: formData.telefono.trim() || null,
      email: formData.email.trim() || null,
      activo: formData.activo,
    }

    try {
      if (editingLocation) {
        // Actualizar sede existente
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/admin/locations/${editingLocation.codigo_sede}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(locationData),
          }
        )

        if (response.ok) {
          setMessage({ type: 'success', text: '✅ Sede actualizada correctamente' })
          loadLocations()
          handleCloseModal()
        } else {
          const error = await response.json()
          setMessage({
            type: 'error',
            text: error.message || 'Error al actualizar la sede',
          })
        }
      } else {
        // Crear nueva sede
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/locations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(locationData),
        })

        if (response.ok) {
          setMessage({ type: 'success', text: '✅ Sede creada correctamente' })
          loadLocations()
          handleCloseModal()
        } else {
          const error = await response.json()
          setMessage({
            type: 'error',
            text: error.message || 'Error al crear la sede',
          })
        }
      }
    } catch (error) {
      console.error('Error submitting location:', error)
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleDelete = async (locationId: number, locationName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la sede "${locationName}"?`)) {
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/locations/${locationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        setMessage({ type: 'success', text: '✅ Sede eliminada correctamente' })
        loadLocations()
      } else {
        const error = await response.json()
        setMessage({
          type: 'error',
          text: error.message || 'Error al eliminar la sede',
        })
      }
    } catch (error) {
      console.error('Error deleting location:', error)
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
          <h1 className="text-3xl font-bold text-lab-neutral-900">Gestión de Sedes</h1>
          <p className="text-lab-neutral-600 mt-1">Administra las ubicaciones del laboratorio</p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-lab-primary-600 hover:bg-lab-primary-700"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nueva Sede
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-lab-info-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-info-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-lab-neutral-600">Total Sedes</p>
              <p className="text-2xl font-bold text-lab-neutral-900">{locations.length}</p>
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
              <p className="text-sm font-medium text-lab-neutral-600">Sedes Activas</p>
              <p className="text-2xl font-bold text-lab-neutral-900">{locations.filter(l => l.activo).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {locations.map((location) => (
          <div
            key={location.codigo_sede}
            className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-lab-info-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-lab-info-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-lab-neutral-900">{location.nombre}</h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        location.activo
                          ? 'bg-lab-success-100 text-lab-success-800'
                          : 'bg-lab-neutral-100 text-lab-neutral-800'
                      }`}
                    >
                      {location.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-lab-neutral-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-lab-neutral-600">{location.direccion}</p>
              </div>

              {location.telefono && (
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <p className="text-sm text-lab-neutral-600">{location.telefono}</p>
                </div>
              )}

              {location.email && (
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-lab-neutral-600">{location.email}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 mt-4 border-t border-lab-neutral-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(location)}
                title="Editar sede"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(location.codigo_sede, location.nombre)}
                className="text-lab-danger-600 hover:text-lab-danger-700 hover:bg-lab-danger-50"
                title="Eliminar sede"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {locations.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-lab-neutral-900">No hay sedes registradas</h3>
          <p className="mt-1 text-sm text-lab-neutral-500">Comienza creando una nueva sede.</p>
        </div>
      )}

      {/* Modal for Create/Edit Location */}
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
                      {editingLocation ? 'Editar Sede' : 'Nueva Sede'}
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
                        Nombre de la Sede <span className="text-lab-danger-600">*</span>
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
                        placeholder="Ej: Sede Centro, Sede Norte, etc."
                      />
                    </div>

                    {/* Dirección */}
                    <div>
                      <label htmlFor="direccion" className="block text-sm font-medium text-lab-neutral-700">
                        Dirección <span className="text-lab-danger-600">*</span>
                      </label>
                      <textarea
                        id="direccion"
                        name="direccion"
                        value={formData.direccion}
                        onChange={handleInputChange}
                        required
                        rows={3}
                        maxLength={500}
                        className="mt-1 block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:outline-none focus:ring-1 focus:ring-lab-primary-500"
                        placeholder="Dirección completa de la sede"
                      />
                    </div>

                    {/* Teléfono */}
                    <div>
                      <label htmlFor="telefono" className="block text-sm font-medium text-lab-neutral-700">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        id="telefono"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleInputChange}
                        maxLength={15}
                        className="mt-1 block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:outline-none focus:ring-1 focus:ring-lab-primary-500"
                        placeholder="Ej: 099-123-4567"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-lab-neutral-700">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        maxLength={100}
                        className="mt-1 block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:outline-none focus:ring-1 focus:ring-lab-primary-500"
                        placeholder="Ej: sede@laboratorio.com"
                      />
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
                        Sede activa y operativa
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-lab-neutral-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto sm:ml-3 bg-lab-primary-600 hover:bg-lab-primary-700"
                  >
                    {editingLocation ? 'Actualizar' : 'Crear'} Sede
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
