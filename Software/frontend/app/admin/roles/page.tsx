'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

interface Role {
  codigo_rol: number
  nombre: string
  descripcion: string | null
  nivel_acceso: number
  activo: boolean
  fecha_creacion: string
}

interface RoleFormData {
  nombre: string
  descripcion: string
  nivel_acceso: string
  activo: boolean
}

interface RolePermissions {
  nivel: number
  nombre_sugerido: string
  descripcion: string
  permisos: string[]
}

export default function RolesManagement() {
  const { accessToken } = useAuthStore()
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<RolePermissions[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [selectedPermissions, setSelectedPermissions] = useState<RolePermissions | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [formData, setFormData] = useState<RoleFormData>({
    nombre: '',
    descripcion: '',
    nivel_acceso: '1',
    activo: true,
  })

  useEffect(() => {
    loadRoles()
    loadPermissions()
  }, [])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const loadRoles = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/roles`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setRoles(data)
      }
    } catch (error) {
      console.error('Error loading roles:', error)
      setMessage({ type: 'error', text: 'Error al cargar los roles' })
    } finally {
      setLoading(false)
    }
  }

  const loadPermissions = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/roles/permissions`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPermissions(data)
      }
    } catch (error) {
      console.error('Error loading permissions:', error)
    }
  }

  const getPermissionsForLevel = (nivel: number): RolePermissions | undefined => {
    return permissions.find(p => p.nivel === nivel)
  }

  const handleOpenModal = (role?: Role) => {
    if (role) {
      setEditingRole(role)
      setFormData({
        nombre: role.nombre,
        descripcion: role.descripcion || '',
        nivel_acceso: role.nivel_acceso.toString(),
        activo: role.activo,
      })
    } else {
      setEditingRole(null)
      setFormData({
        nombre: '',
        descripcion: '',
        nivel_acceso: '1',
        activo: true,
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingRole(null)
    setFormData({
      nombre: '',
      descripcion: '',
      nivel_acceso: '1',
      activo: true,
    })
  }

  const handleShowPermissions = (nivel: number) => {
    const perms = getPermissionsForLevel(nivel)
    if (perms) {
      setSelectedPermissions(perms)
      setShowPermissionsModal(true)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
      setMessage({ type: 'error', text: 'El nombre del rol es requerido' })
      return
    }

    if (formData.nombre.length < 2 || formData.nombre.length > 50) {
      setMessage({ type: 'error', text: 'El nombre debe tener entre 2 y 50 caracteres' })
      return
    }

    const nivel = parseInt(formData.nivel_acceso)
    if (isNaN(nivel) || nivel < 1 || nivel > 10) {
      setMessage({ type: 'error', text: 'El nivel de acceso debe estar entre 1 y 10' })
      return
    }

    const roleData = {
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion.trim() || null,
      nivel_acceso: nivel,
      activo: formData.activo,
    }

    try {
      if (editingRole) {
        // Actualizar rol existente
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/admin/roles/${editingRole.codigo_rol}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(roleData),
          }
        )

        if (response.ok) {
          setMessage({ type: 'success', text: '✅ Rol actualizado correctamente' })
          loadRoles()
          handleCloseModal()
        } else {
          const error = await response.json()
          setMessage({
            type: 'error',
            text: error.message || 'Error al actualizar el rol',
          })
        }
      } else {
        // Crear nuevo rol
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/roles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(roleData),
        })

        if (response.ok) {
          setMessage({ type: 'success', text: '✅ Rol creado correctamente' })
          loadRoles()
          handleCloseModal()
        } else {
          const error = await response.json()
          setMessage({
            type: 'error',
            text: error.message || 'Error al crear el rol',
          })
        }
      }
    } catch (error) {
      console.error('Error submitting role:', error)
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleDelete = async (roleId: number, roleName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el rol "${roleName}"?\n\nNOTA: No se puede eliminar un rol que tenga usuarios asignados.`)) {
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        setMessage({ type: 'success', text: '✅ Rol eliminado correctamente' })
        loadRoles()
      } else {
        const error = await response.json()
        setMessage({
          type: 'error',
          text: error.message || 'Error al eliminar el rol',
        })
      }
    } catch (error) {
      console.error('Error deleting role:', error)
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
          <h1 className="text-3xl font-bold text-lab-neutral-900">Gestión de Roles</h1>
          <p className="text-lab-neutral-600 mt-1">Administra los roles y permisos del sistema</p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-lab-primary-600 hover:bg-lab-primary-700"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Rol
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-lab-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-lab-neutral-600">Total Roles</p>
              <p className="text-2xl font-bold text-lab-neutral-900">{roles.length}</p>
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
              <p className="text-sm font-medium text-lab-neutral-600">Roles Activos</p>
              <p className="text-2xl font-bold text-lab-neutral-900">{roles.filter(r => r.activo).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-lab-info-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-lab-info-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-lab-neutral-600">Nivel Máximo</p>
              <p className="text-2xl font-bold text-lab-neutral-900">{Math.max(...roles.map(r => r.nivel_acceso), 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200">
        <div className="px-6 py-4 border-b border-lab-neutral-200">
          <h2 className="text-lg font-semibold text-lab-neutral-900">Roles Registrados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-lab-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Nivel de Acceso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Fecha Creación
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-lab-neutral-200">
              {roles.map((role) => {
                const rolePerms = getPermissionsForLevel(role.nivel_acceso)
                return (
                  <tr key={role.codigo_rol} className="hover:bg-lab-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-lab-primary-100 flex items-center justify-center">
                          <span className="text-lab-primary-700 font-semibold text-sm">
                            {role.nombre.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-lab-neutral-900">{role.nombre}</div>
                          {rolePerms && (
                            <div className="text-xs text-lab-neutral-500">
                              Sugerido: {rolePerms.nombre_sugerido}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-lab-neutral-600">
                        {role.descripcion || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-lab-info-100 text-lab-info-800">
                          Nivel {role.nivel_acceso}
                        </span>
                        {rolePerms && (
                          <button
                            onClick={() => handleShowPermissions(role.nivel_acceso)}
                            className="text-lab-info-600 hover:text-lab-info-800"
                            title="Ver permisos"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          role.activo
                            ? 'bg-lab-success-100 text-lab-success-800'
                            : 'bg-lab-neutral-100 text-lab-neutral-800'
                        }`}
                      >
                        {role.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-lab-neutral-600">
                      {new Date(role.fecha_creacion).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenModal(role)}
                          title="Editar rol"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(role.codigo_rol, role.nombre)}
                          className="text-lab-danger-600 hover:text-lab-danger-700 hover:bg-lab-danger-50"
                          title="Eliminar rol"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Create/Edit Role */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={handleCloseModal}
            ></div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-lab-neutral-900">
                      {editingRole ? 'Editar Rol' : 'Nuevo Rol'}
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
                    {/* Nivel de Acceso - Primero para que el usuario vea las sugerencias */}
                    <div>
                      <label htmlFor="nivel_acceso" className="block text-sm font-medium text-lab-neutral-700 mb-2">
                        Nivel de Acceso <span className="text-lab-danger-600">*</span>
                      </label>
                      <select
                        id="nivel_acceso"
                        name="nivel_acceso"
                        value={formData.nivel_acceso}
                        onChange={handleInputChange}
                        required
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:outline-none focus:ring-1 focus:ring-lab-primary-500"
                      >
                        {permissions.map((perm) => (
                          <option key={perm.nivel} value={perm.nivel}>
                            Nivel {perm.nivel} - {perm.nombre_sugerido} ({perm.permisos.length} permisos)
                          </option>
                        ))}
                      </select>
                      {parseInt(formData.nivel_acceso) && getPermissionsForLevel(parseInt(formData.nivel_acceso)) && (
                        <div className="mt-2 p-3 bg-lab-info-50 border border-lab-info-200 rounded-md">
                          <p className="text-xs font-medium text-lab-info-800 mb-1">
                            {getPermissionsForLevel(parseInt(formData.nivel_acceso))?.nombre_sugerido}
                          </p>
                          <p className="text-xs text-lab-info-700">
                            {getPermissionsForLevel(parseInt(formData.nivel_acceso))?.descripcion}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Nombre */}
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-medium text-lab-neutral-700">
                        Nombre del Rol <span className="text-lab-danger-600">*</span>
                      </label>
                      <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleInputChange}
                        required
                        minLength={2}
                        maxLength={50}
                        className="mt-1 block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:outline-none focus:ring-1 focus:ring-lab-primary-500"
                        placeholder={getPermissionsForLevel(parseInt(formData.nivel_acceso))?.nombre_sugerido || 'Ej: Administrador, Recepcionista, etc.'}
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
                        rows={3}
                        maxLength={500}
                        className="mt-1 block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:outline-none focus:ring-1 focus:ring-lab-primary-500"
                        placeholder="Descripción del rol y sus responsabilidades"
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
                        Rol activo
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-lab-neutral-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto sm:ml-3 bg-lab-primary-600 hover:bg-lab-primary-700"
                  >
                    {editingRole ? 'Actualizar' : 'Crear'} Rol
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

      {/* Modal for Permissions Details */}
      {showPermissionsModal && selectedPermissions && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowPermissionsModal(false)}
            ></div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-lab-neutral-900">
                    Permisos - Nivel {selectedPermissions.nivel}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPermissionsModal(false)}
                    className="text-lab-neutral-400 hover:text-lab-neutral-600"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-lab-info-50 border border-lab-info-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-lab-info-900 mb-1">
                      {selectedPermissions.nombre_sugerido}
                    </h4>
                    <p className="text-sm text-lab-info-700">
                      {selectedPermissions.descripcion}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-lab-neutral-700 mb-3">
                      Permisos incluidos ({selectedPermissions.permisos.length}):
                    </h4>
                    <ul className="space-y-2">
                      {selectedPermissions.permisos.map((permiso, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <svg className="w-5 h-5 text-lab-success-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-lab-neutral-700">{permiso}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-lab-neutral-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <Button
                  type="button"
                  onClick={() => setShowPermissionsModal(false)}
                  className="w-full sm:w-auto bg-lab-primary-600 hover:bg-lab-primary-700"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
