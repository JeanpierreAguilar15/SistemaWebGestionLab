'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

interface SupplierStats {
  total_ordenes: number
  ordenes_completadas: number
  ordenes_pendientes: number
  monto_total_compras: number
  ultima_compra: string | null
  tiene_ordenes: boolean
}

interface Supplier {
  codigo_proveedor: number
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  activo: boolean
  fecha_creacion: string
  estadisticas?: SupplierStats
}

interface Message {
  type: 'success' | 'error'
  text: string
}

// Validador de RUC ecuatoriano
function validateRucEcuador(ruc: string): boolean {
  if (!ruc || ruc.length !== 13) return false

  const codigoProvincia = parseInt(ruc.substring(0, 2))
  if (codigoProvincia < 1 || codigoProvincia > 24) return false

  const tercerDigito = parseInt(ruc.charAt(2))
  if (tercerDigito < 0 || tercerDigito > 9) return false

  // Los últimos 3 dígitos deben ser 001 para sociedades o 000 para personas naturales
  const ultimos3 = ruc.substring(10, 13)
  if (ultimos3 !== '001' && ultimos3 !== '000') return false

  return true
}

// Formatear moneda
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// Formatear fecha
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Sin compras'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function SuppliersManagement() {
  const { accessToken } = useAuthStore()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [rucError, setRucError] = useState<string>('')

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  const [formData, setFormData] = useState({
    ruc: '',
    razon_social: '',
    nombre_comercial: '',
    telefono: '',
    email: '',
    direccion: '',
    activo: true,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && accessToken) {
      loadSuppliers()
    }
  }, [accessToken, mounted])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  // Filtrar proveedores
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      // Filtro por estado
      if (filterStatus === 'active' && !supplier.activo) return false
      if (filterStatus === 'inactive' && supplier.activo) return false

      // Filtro por búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const matchRuc = supplier.ruc.toLowerCase().includes(search)
        const matchRazon = supplier.razon_social.toLowerCase().includes(search)
        const matchComercial = supplier.nombre_comercial?.toLowerCase().includes(search) || false
        if (!matchRuc && !matchRazon && !matchComercial) return false
      }

      return true
    })
  }, [suppliers, searchTerm, filterStatus])

  // Estadísticas generales
  const stats = useMemo(() => {
    const activos = suppliers.filter((s) => s.activo).length
    const inactivos = suppliers.filter((s) => !s.activo).length
    const conOrdenes = suppliers.filter((s) => s.estadisticas?.tiene_ordenes).length
    return { activos, inactivos, conOrdenes, total: suppliers.length }
  }, [suppliers])

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/suppliers?includeInactive=true`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSuppliers(data)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar proveedores' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenForm = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setFormData({
        ruc: supplier.ruc,
        razon_social: supplier.razon_social,
        nombre_comercial: supplier.nombre_comercial || '',
        telefono: supplier.telefono || '',
        email: supplier.email || '',
        direccion: supplier.direccion || '',
        activo: supplier.activo,
      })
    } else {
      setEditingSupplier(null)
      setFormData({
        ruc: '',
        razon_social: '',
        nombre_comercial: '',
        telefono: '',
        email: '',
        direccion: '',
        activo: true,
      })
    }
    setRucError('')
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingSupplier(null)
    setRucError('')
    setFormData({
      ruc: '',
      razon_social: '',
      nombre_comercial: '',
      telefono: '',
      email: '',
      direccion: '',
      activo: true,
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))

    // Validar RUC en tiempo real
    if (name === 'ruc') {
      if (value.length === 13) {
        if (!validateRucEcuador(value)) {
          setRucError('RUC ecuatoriano inválido')
        } else {
          setRucError('')
        }
      } else if (value.length > 0) {
        setRucError('El RUC debe tener 13 dígitos')
      } else {
        setRucError('')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validar RUC antes de enviar
    if (!validateRucEcuador(formData.ruc)) {
      setRucError('RUC ecuatoriano inválido')
      return
    }

    try {
      const url = editingSupplier
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin/suppliers/${editingSupplier.codigo_proveedor}`
        : `${process.env.NEXT_PUBLIC_API_URL}/admin/suppliers`

      // Si estamos editando y el proveedor tiene órdenes, no enviar el RUC
      const payload: any = {
        razon_social: formData.razon_social,
        activo: formData.activo,
      }

      // Solo incluir RUC si es nuevo o si cambió (el backend validará si puede cambiar)
      if (!editingSupplier || formData.ruc !== editingSupplier.ruc) {
        payload.ruc = formData.ruc
      }

      if (formData.nombre_comercial) payload.nombre_comercial = formData.nombre_comercial
      if (formData.telefono) payload.telefono = formData.telefono
      if (formData.email) payload.email = formData.email
      if (formData.direccion) payload.direccion = formData.direccion

      const response = await fetch(url, {
        method: editingSupplier ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: editingSupplier ? 'Proveedor actualizado correctamente' : 'Proveedor creado correctamente',
        })
        handleCloseForm()
        loadSuppliers()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al guardar proveedor' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleToggleActive = async (codigo_proveedor: number, activar: boolean) => {
    const mensaje = activar ? '¿Deseas reactivar este proveedor?' : '¿Deseas desactivar este proveedor?'
    if (!confirm(mensaje)) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/suppliers/${codigo_proveedor}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ activo: activar }),
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: activar ? 'Proveedor activado correctamente' : 'Proveedor desactivado correctamente',
        })
        loadSuppliers()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al cambiar estado del proveedor' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  // Verificar si el RUC puede editarse
  const canEditRuc = !editingSupplier?.estadisticas?.tiene_ordenes

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
          <h1 className="text-3xl font-bold text-lab-neutral-900">Gestion de Proveedores</h1>
          <p className="text-lab-neutral-600 mt-1">Administra los proveedores del laboratorio</p>
        </div>
        <Button onClick={() => handleOpenForm()} className="bg-lab-primary-600 hover:bg-lab-primary-700">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Proveedor
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-lab-neutral-200 p-4">
          <div className="text-sm font-medium text-lab-neutral-500">Total Proveedores</div>
          <div className="text-2xl font-bold text-lab-neutral-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-lab-neutral-200 p-4">
          <div className="text-sm font-medium text-lab-success-600">Activos</div>
          <div className="text-2xl font-bold text-lab-success-700">{stats.activos}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-lab-neutral-200 p-4">
          <div className="text-sm font-medium text-red-500">Inactivos</div>
          <div className="text-2xl font-bold text-red-600">{stats.inactivos}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-lab-neutral-200 p-4">
          <div className="text-sm font-medium text-lab-primary-600">Con Ordenes</div>
          <div className="text-2xl font-bold text-lab-primary-700">{stats.conOrdenes}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-lab-neutral-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">Buscar</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                id="search"
                placeholder="Buscar por RUC, razon social o nombre comercial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-lab-neutral-300 rounded-md leading-5 bg-white placeholder-lab-neutral-500 focus:outline-none focus:placeholder-lab-neutral-400 focus:ring-1 focus:ring-lab-primary-500 focus:border-lab-primary-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-lab-neutral-600">Estado:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="block w-40 pl-3 pr-10 py-2 text-base border border-lab-neutral-300 focus:outline-none focus:ring-lab-primary-500 focus:border-lab-primary-500 sm:text-sm rounded-md"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-lab-neutral-500">
          Mostrando {filteredSuppliers.length} de {suppliers.length} proveedores
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
            <div className="p-6 border-b border-lab-neutral-200">
              <h2 className="text-2xl font-bold text-lab-neutral-900">
                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              {editingSupplier?.estadisticas && (
                <div className="mt-2 flex gap-4 text-sm text-lab-neutral-600">
                  <span>Ordenes: {editingSupplier.estadisticas.total_ordenes}</span>
                  <span>|</span>
                  <span>Total compras: {formatCurrency(editingSupplier.estadisticas.monto_total_compras)}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ruc" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                      RUC * (13 digitos)
                    </label>
                    <input
                      type="text"
                      id="ruc"
                      name="ruc"
                      value={formData.ruc}
                      onChange={handleInputChange}
                      required
                      maxLength={13}
                      pattern="^\d{13}$"
                      disabled={!canEditRuc && editingSupplier !== null}
                      className={`block w-full rounded-md border px-3 py-2 focus:ring-lab-primary-500 ${
                        rucError
                          ? 'border-lab-danger-500 focus:border-lab-danger-500'
                          : 'border-lab-neutral-300 focus:border-lab-primary-500'
                      } ${!canEditRuc && editingSupplier ? 'bg-lab-neutral-100 cursor-not-allowed' : ''}`}
                    />
                    {rucError && <p className="mt-1 text-sm text-lab-danger-600">{rucError}</p>}
                    {!canEditRuc && editingSupplier && (
                      <p className="mt-1 text-xs text-amber-600">
                        El RUC no puede modificarse porque el proveedor tiene ordenes de compra
                      </p>
                    )}
                    <p className="mt-1 text-xs text-lab-neutral-500">
                      Formato: 13 digitos (ej: 1790123456001)
                    </p>
                  </div>

                  <div>
                    <label htmlFor="razon_social" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                      Razon Social *
                    </label>
                    <input
                      type="text"
                      id="razon_social"
                      name="razon_social"
                      value={formData.razon_social}
                      onChange={handleInputChange}
                      required
                      className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="nombre_comercial" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Nombre Comercial
                  </label>
                  <input
                    type="text"
                    id="nombre_comercial"
                    name="nombre_comercial"
                    value={formData.nombre_comercial}
                    onChange={handleInputChange}
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="telefono" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                      Telefono
                    </label>
                    <input
                      type="tel"
                      id="telefono"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleInputChange}
                      className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="direccion" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Direccion
                  </label>
                  <textarea
                    id="direccion"
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleInputChange}
                    rows={2}
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                  />
                </div>

                {/* Solo mostrar checkbox de activo en modo edicion */}
                {editingSupplier && (
                  <div className="flex items-center p-3 bg-lab-neutral-50 rounded-lg border border-lab-neutral-200">
                    <input
                      type="checkbox"
                      id="activo"
                      name="activo"
                      checked={formData.activo}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-lab-primary-600 focus:ring-lab-primary-500 border-lab-neutral-300 rounded"
                    />
                    <label htmlFor="activo" className="ml-2 block text-sm text-lab-neutral-700">
                      Proveedor activo
                    </label>
                    <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      formData.activo
                        ? 'bg-lab-success-100 text-lab-success-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      Estado: {formData.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-lab-neutral-200">
                <Button type="button" onClick={handleCloseForm} variant="outline">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-lab-primary-600 hover:bg-lab-primary-700"
                  disabled={!!rucError}
                >
                  {editingSupplier ? 'Actualizar' : 'Crear'} Proveedor
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-lab-neutral-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-lab-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Proveedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Ordenes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Total Compras
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Ultima Compra
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-lab-neutral-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-lab-neutral-200">
              {filteredSuppliers.map((supplier) => (
                <tr
                  key={supplier.codigo_proveedor}
                  className={`hover:bg-lab-neutral-50 ${!supplier.activo ? 'bg-lab-neutral-50 opacity-70' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className={`text-sm font-medium ${!supplier.activo ? 'text-lab-neutral-500' : 'text-lab-neutral-900'}`}>
                      {supplier.razon_social}
                    </div>
                    <div className="text-xs text-lab-neutral-500 font-mono">
                      RUC: {supplier.ruc}
                    </div>
                    {supplier.nombre_comercial && (
                      <div className="text-xs text-lab-neutral-400">
                        {supplier.nombre_comercial}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-sm ${!supplier.activo ? 'text-lab-neutral-400' : 'text-lab-neutral-600'}`}>
                      {supplier.telefono && <div>{supplier.telefono}</div>}
                      {supplier.email && <div className="text-xs">{supplier.email}</div>}
                      {!supplier.telefono && !supplier.email && <span className="text-lab-neutral-400">-</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm font-medium text-lab-neutral-900">
                      {supplier.estadisticas?.total_ordenes || 0}
                    </div>
                    {supplier.estadisticas && supplier.estadisticas.ordenes_pendientes > 0 && (
                      <div className="text-xs text-amber-600">
                        {supplier.estadisticas.ordenes_pendientes} pendiente(s)
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-medium text-lab-neutral-900">
                      {formatCurrency(supplier.estadisticas?.monto_total_compras || 0)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm text-lab-neutral-600">
                      {formatDate(supplier.estadisticas?.ultima_compra || null)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        supplier.activo
                          ? 'bg-lab-success-100 text-lab-success-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {supplier.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenForm(supplier)}
                    >
                      Editar
                    </Button>
                    {supplier.activo ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(supplier.codigo_proveedor, false)}
                        className="text-lab-danger-600 hover:text-lab-danger-700 hover:bg-lab-danger-50"
                      >
                        Desactivar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(supplier.codigo_proveedor, true)}
                        className="text-lab-success-600 hover:text-lab-success-700 hover:bg-lab-success-50"
                      >
                        Activar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-lab-neutral-900">
              {searchTerm || filterStatus !== 'all' ? 'No se encontraron proveedores' : 'No hay proveedores'}
            </h3>
            <p className="mt-1 text-sm text-lab-neutral-500">
              {searchTerm || filterStatus !== 'all'
                ? 'Intenta con otros filtros de busqueda'
                : 'Comienza registrando un nuevo proveedor.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
