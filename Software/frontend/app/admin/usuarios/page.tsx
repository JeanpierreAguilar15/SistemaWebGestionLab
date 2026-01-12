'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validateCedulaEcuador, validateEmail, validatePhoneEcuador, validateDateNotFuture } from '@/lib/utils'

interface Role {
  codigo_rol: number
  nombre: string
}

interface User {
  codigo_usuario: number
  nombres: string
  apellidos: string
  email: string
  cedula: string
  telefono: string | null
  fecha_nacimiento: string | null
  genero: string | null
  direccion: string | null
  activo: boolean
  rol: {
    codigo_rol: number
    nombre: string
  }
  fecha_creacion: string
}

export default function UsersManagement() {
  const { accessToken } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Form state
  const [formData, setFormData] = useState({
    cedula: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    fecha_nacimiento: '',
    genero: '',
    direccion: '',
    codigo_rol: '',
    password: '',
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: '',
  })

  useEffect(() => {
    loadUsers()
    loadRoles()
  }, [pagination.page, searchTerm, filterRole, filterActive])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(filterRole && { codigo_rol: filterRole }),
        ...(filterActive && { activo: filterActive }),
      })

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        setUsers(result.data)
        setPagination(prev => ({ ...prev, ...result.pagination }))
      }
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
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
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones críticas antes de enviar

    // 1. Validar cédula ecuatoriana
    if (!validateCedulaEcuador(formData.cedula)) {
      setMessage({ type: 'error', text: '❌ La cédula ingresada no es válida. Verifique que sea una cédula ecuatoriana correcta.' })
      return
    }

    // 2. Validar email
    if (!validateEmail(formData.email)) {
      setMessage({ type: 'error', text: '❌ El email ingresado no es válido.' })
      return
    }

    // 3. Validar teléfono (si está presente)
    if (formData.telefono && !validatePhoneEcuador(formData.telefono)) {
      setMessage({
        type: 'error',
        text: '❌ El teléfono debe ser un número ecuatoriano válido (Ej: 0999999999 o +593999999999)'
      })
      return
    }

    // 4. Validar fecha de nacimiento no sea futura
    if (formData.fecha_nacimiento && !validateDateNotFuture(formData.fecha_nacimiento)) {
      setMessage({ type: 'error', text: '❌ La fecha de nacimiento no puede ser una fecha futura.' })
      return
    }

    // 5. Validar que nombres y apellidos tengan al menos 2 caracteres
    if (formData.nombres.trim().length < 2) {
      setMessage({ type: 'error', text: '❌ Los nombres deben tener al menos 2 caracteres.' })
      return
    }

    if (formData.apellidos.trim().length < 2) {
      setMessage({ type: 'error', text: '❌ Los apellidos deben tener al menos 2 caracteres.' })
      return
    }

    // 6. Validar contacto de emergencia (si nombre presente, teléfono requerido)
    if (formData.contacto_emergencia_nombre && !formData.contacto_emergencia_telefono) {
      setMessage({
        type: 'error',
        text: '❌ Si ingresa un contacto de emergencia, debe proporcionar el teléfono.'
      })
      return
    }

    // 7. Validar teléfono de emergencia (si está presente)
    if (formData.contacto_emergencia_telefono && !validatePhoneEcuador(formData.contacto_emergencia_telefono)) {
      setMessage({
        type: 'error',
        text: '❌ El teléfono de emergencia debe ser un número ecuatoriano válido.'
      })
      return
    }

    const userData = {
      cedula: formData.cedula.trim(),
      nombres: formData.nombres.trim(),
      apellidos: formData.apellidos.trim(),
      email: formData.email.trim().toLowerCase(),
      telefono: formData.telefono ? formData.telefono.trim() : null,
      fecha_nacimiento: formData.fecha_nacimiento || null,
      genero: formData.genero || null,
      direccion: formData.direccion ? formData.direccion.trim() : null,
      codigo_rol: parseInt(formData.codigo_rol),
      ...(formData.contacto_emergencia_nombre && {
        contacto_emergencia_nombre: formData.contacto_emergencia_nombre.trim(),
      }),
      ...(formData.contacto_emergencia_telefono && {
        contacto_emergencia_telefono: formData.contacto_emergencia_telefono.trim(),
      }),
      ...(!editingUser && { password: formData.password }), // Solo en crear
    }

    try {
      if (editingUser) {
        // Update
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/admin/users/${editingUser.codigo_usuario}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(userData),
          }
        )

        if (response.ok) {
          setMessage({ type: 'success', text: 'Usuario actualizado correctamente' })
          loadUsers()
          handleCloseModal()
        } else {
          const error = await response.json()
          setMessage({ type: 'error', text: error.message || 'Error al actualizar usuario' })
        }
      } else {
        // Create
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(userData),
        })

        if (response.ok) {
          setMessage({ type: 'success', text: '✅ Usuario creado correctamente' })
          loadUsers()
          handleCloseModal()
        } else {
          const error = await response.json()
          setMessage({ type: 'error', text: error.message || 'Error al crear usuario' })
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      cedula: user.cedula,
      nombres: user.nombres,
      apellidos: user.apellidos,
      email: user.email,
      telefono: user.telefono || '',
      fecha_nacimiento: user.fecha_nacimiento ? user.fecha_nacimiento.split('T')[0] : '',
      genero: user.genero || '',
      direccion: user.direccion || '',
      codigo_rol: user.rol.codigo_rol.toString(),
      password: '',
      contacto_emergencia_nombre: '',
      contacto_emergencia_telefono: '',
    })
    setShowModal(true)
  }

  const toggleUserStatus = async (codigo_usuario: number) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/users/${codigo_usuario}/toggle-status`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        loadUsers()
      }
    } catch (error) {
      console.error('Error toggling user status:', error)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingUser(null)
    setFormData({
      cedula: '',
      nombres: '',
      apellidos: '',
      email: '',
      telefono: '',
      fecha_nacimiento: '',
      genero: '',
      direccion: '',
      codigo_rol: '',
      password: '',
      contacto_emergencia_nombre: '',
      contacto_emergencia_telefono: '',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-lab-neutral-900">Gestión de Usuarios</h1>
          <p className="text-lab-neutral-600 mt-1">Administra los usuarios del sistema</p>
        </div>
        <Button
          className="bg-lab-primary-600 hover:bg-lab-primary-700"
          onClick={() => setShowModal(true)}
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Usuario
        </Button>
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

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-lab-neutral-700 mb-2">Buscar</label>
            <input
              type="text"
              placeholder="Nombre, email o cédula..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full px-4 py-2 border border-lab-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lab-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-lab-neutral-700 mb-2">Rol</label>
            <select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full px-4 py-2 border border-lab-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lab-primary-500"
            >
              <option value="">Todos</option>
              {roles.map(role => (
                <option key={role.codigo_rol} value={role.codigo_rol}>
                  {role.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-lab-neutral-700 mb-2">Estado</label>
            <select
              value={filterActive}
              onChange={(e) => {
                setFilterActive(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full px-4 py-2 border border-lab-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lab-primary-500"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-lab-neutral-50 border-b border-lab-neutral-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-700 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-700 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-700 uppercase tracking-wider">
                      Cédula
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-700 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-700 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-700 uppercase tracking-wider">
                      Fecha Creación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-700 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-lab-neutral-200">
                  {users.length > 0 ? (
                    users.map((user) => (
                      <tr key={user.codigo_usuario} className="hover:bg-lab-neutral-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-lab-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-lab-primary-700">
                                {user.nombres[0]}
                                {user.apellidos[0]}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-lab-neutral-900">
                                {user.nombres} {user.apellidos}
                              </div>
                              {user.telefono && (
                                <div className="text-sm text-lab-neutral-500">{user.telefono}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-lab-neutral-900">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-lab-neutral-900">{user.cedula}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-lab-primary-100 text-lab-primary-800">
                            {user.rol.nombre}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.activo
                                ? 'bg-lab-success-100 text-lab-success-800'
                                : 'bg-lab-danger-100 text-lab-danger-800'
                            }`}
                          >
                            {user.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-lab-neutral-500">
                          {new Date(user.fecha_creacion).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(user)}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleUserStatus(user.codigo_usuario)}
                              className={
                                user.activo
                                  ? 'text-lab-danger-600 hover:text-lab-danger-700 hover:bg-lab-danger-50'
                                  : 'text-lab-success-600 hover:text-lab-success-700 hover:bg-lab-success-50'
                              }
                            >
                              {user.activo ? 'Desactivar' : 'Activar'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-lab-neutral-500">
                        No se encontraron usuarios
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-lab-neutral-200 flex items-center justify-between">
                <div className="text-sm text-lab-neutral-700">
                  Mostrando {(pagination.page - 1) * pagination.limit + 1} a{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} resultados
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-lab-neutral-700">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full my-8">
            <div className="p-6 border-b border-lab-neutral-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-lab-neutral-900">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
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
                  <Label htmlFor="cedula">Cédula *</Label>
                  <Input
                    id="cedula"
                    value={formData.cedula}
                    onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                    placeholder="1710034065"
                    maxLength={10}
                    required
                    disabled={!!editingUser}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codigo_rol">Rol *</Label>
                  <select
                    id="codigo_rol"
                    value={formData.codigo_rol}
                    onChange={(e) => setFormData({ ...formData, codigo_rol: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {roles.map((role) => (
                      <option key={role.codigo_rol} value={role.codigo_rol}>
                        {role.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombres">Nombres *</Label>
                  <Input
                    id="nombres"
                    value={formData.nombres}
                    onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                    placeholder="Juan Carlos"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apellidos">Apellidos *</Label>
                  <Input
                    id="apellidos"
                    value={formData.apellidos}
                    onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                    placeholder="Pérez González"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>

              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres, mayúscula, número y símbolo"
                    required={!editingUser}
                  />
                  <p className="text-xs text-lab-neutral-500">
                    Debe contener al menos una mayúscula, una minúscula, un número y un carácter especial
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="0999999999"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="genero">Género</Label>
                  <select
                    id="genero"
                    value={formData.genero}
                    onChange={(e) => setFormData({ ...formData, genero: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-lab-neutral-300"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  value={formData.fecha_nacimiento}
                  onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <textarea
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border border-lab-neutral-300"
                  placeholder="Calle principal y secundaria, Quito"
                />
              </div>

              <div className="border-t border-lab-neutral-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-lab-neutral-900 mb-3">Contacto de Emergencia (Opcional)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contacto_emergencia_nombre">Nombre</Label>
                    <Input
                      id="contacto_emergencia_nombre"
                      value={formData.contacto_emergencia_nombre}
                      onChange={(e) => setFormData({ ...formData, contacto_emergencia_nombre: e.target.value })}
                      placeholder="María Pérez"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contacto_emergencia_telefono">Teléfono</Label>
                    <Input
                      id="contacto_emergencia_telefono"
                      value={formData.contacto_emergencia_telefono}
                      onChange={(e) => setFormData({ ...formData, contacto_emergencia_telefono: e.target.value })}
                      placeholder="0999999999"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-lab-neutral-200">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit">{editingUser ? 'Actualizar' : 'Crear'} Usuario</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
