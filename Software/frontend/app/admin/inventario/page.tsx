'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validateStockRanges, validatePriceRelation, formatDateTime, formatDate, formatCurrency } from '@/lib/utils'

// Interfaces for Items
interface ItemInventario {
  codigo_item: number
  codigo_interno: string
  nombre: string
  descripcion: string | null
  codigo_categoria: number | null
  stock_actual: number
  stock_minimo: number
  stock_maximo: number | null
  costo_unitario: string | null
  precio_venta: string | null
  unidad_medida: string
  activo: boolean
  // Campos para control de reactivos
  es_reactivo?: boolean
  vida_util_dias_abierto?: number | null
  capacidad_pruebas?: number | null
  categoria?: {
    nombre: string
  } | null
}

// Interfaces for Movements
interface Movimiento {
  codigo_movimiento: number
  codigo_item: number
  codigo_lote: number | null
  tipo_movimiento: string
  cantidad: number
  motivo: string | null
  stock_anterior: number
  stock_nuevo: number
  fecha_movimiento: string
  realizado_por: number | null
  item: {
    codigo_interno: string
    nombre: string
    unidad_medida: string
  }
  usuario: {
    nombres: string
    apellidos: string
  } | null
  lote: {
    numero_lote: string
  } | null
}

// Interfaces for Alerts
interface Alerta {
  codigo_item: number
  codigo_interno: string
  nombre: string
  stock_actual: number
  stock_minimo: number
  stock_maximo: number | null
  unidad_medida: string
  tipo_alerta: string
  mensaje: string
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  codigo_lote?: number
  numero_lote?: string
  fecha_vencimiento?: string
  dias_hasta_vencimiento?: number
}

interface Estadisticas {
  total: number
  criticas: number
  altas: number
  medias: number
  bajas: number
  por_tipo: {
    stock_critico: number
    stock_bajo: number
    vencidos: number
    proximos_vencer: number
  }
}

interface Message {
  type: 'success' | 'error'
  text: string
}

const TIPO_MOVIMIENTO_OPTIONS = [
  { value: 'ENTRADA', label: 'Entrada', color: 'bg-lab-success-100 text-lab-success-800', icon: '↑' },
  { value: 'SALIDA', label: 'Salida', color: 'bg-lab-danger-100 text-lab-danger-800', icon: '↓' },
  { value: 'AJUSTE_POSITIVO', label: 'Ajuste +', color: 'bg-lab-primary-100 text-lab-primary-800', icon: '+' },
  { value: 'AJUSTE_NEGATIVO', label: 'Ajuste -', color: 'bg-lab-warning-100 text-lab-warning-800', icon: '-' },
  { value: 'TRANSFERENCIA', label: 'Transferencia', color: 'bg-lab-neutral-100 text-lab-neutral-800', icon: '↔' },
]

const TIPO_ALERTA_CONFIG = {
  STOCK_CRITICO: { label: 'Sin Stock', color: 'bg-lab-danger-100 text-lab-danger-800' },
  STOCK_BAJO: { label: 'Stock Bajo', color: 'bg-lab-warning-100 text-lab-warning-800' },
  VENCIDO: { label: 'Vencido', color: 'bg-lab-danger-100 text-lab-danger-800' },
  PROXIMO_VENCER: { label: 'Por Vencer', color: 'bg-lab-warning-100 text-lab-warning-800' },
}

const PRIORIDAD_CONFIG = {
  CRITICA: { label: 'Crítica', color: 'bg-lab-danger-600 text-white' },
  ALTA: { label: 'Alta', color: 'bg-lab-warning-600 text-white' },
  MEDIA: { label: 'Media', color: 'bg-lab-primary-500 text-white' },
  BAJA: { label: 'Baja', color: 'bg-lab-neutral-400 text-white' },
}

type Tab = 'items' | 'movimientos' | 'alertas' | 'lotes' | 'kardex' | 'categorias'

// Interface for Categories
interface Categoria {
  codigo_categoria: number
  nombre: string
  descripcion: string | null
  activo: boolean
  _count?: {
    items: number
  }
}

// Interface for Lots
interface Lote {
  codigo_lote: number
  codigo_item: number
  numero_lote: string
  fecha_fabricacion: string | null
  fecha_vencimiento: string | null
  cantidad_inicial: number
  cantidad_actual: number
  costo_unitario: string | null
  proveedor: string | null
  activo: boolean
  fecha_registro: string
  item?: {
    codigo_interno: string
    nombre: string
    unidad_medida: string
  }
}

// Interface for Kardex
interface KardexEntry {
  codigo_movimiento: number
  fecha_movimiento: string
  tipo_movimiento: string
  cantidad: number
  stock_anterior: number
  stock_nuevo: number
  motivo: string | null
  lote?: {
    numero_lote: string
  } | null
  usuario?: {
    nombres: string
    apellidos: string
  } | null
}

interface KardexResponse {
  item: {
    codigo_item: number
    codigo_interno: string
    nombre: string
    stock_actual: number
    unidad_medida: string
    categoria?: { nombre: string } | null
  }
  stock_actual: number
  movimientos: KardexEntry[]
  totales: {
    entradas: number
    salidas: number
    ajustes_positivos: number
    ajustes_negativos: number
  }
  resumen: {
    total_movimientos: number
    balance: number
  }
}

// Interface for Global Kardex
interface KardexGlobalItem {
  codigo_item: number
  codigo_interno: string
  nombre: string
  categoria: string
  unidad_medida: string
  stock_actual: number
  stock_minimo: number
  costo_unitario: string | null
  valor_inventario: number
  total_entradas: number
  total_salidas: number
  total_movimientos: number
  ultimo_movimiento: {
    fecha_movimiento: string
    tipo_movimiento: string
    cantidad: number
  } | null
  estado_stock: 'NORMAL' | 'BAJO' | 'CRITICO' | 'AGOTADO'
}

interface KardexGlobalResponse {
  resumen: {
    total_items: number
    items_criticos: number
    items_bajos: number
    items_agotados: number
    valor_total_inventario: number
    total_entradas: number
    total_salidas: number
  }
  items: KardexGlobalItem[]
}

export default function InventarioPage() {
  const { accessToken } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('items')
  const [mounted, setMounted] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  // Items state
  const [items, setItems] = useState<ItemInventario[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemInventario | null>(null)
  const [itemFormData, setItemFormData] = useState({
    codigo_interno: '',
    nombre: '',
    descripcion: '',
    codigo_categoria: '',
    unidad_medida: '',
    stock_actual: '0',
    stock_minimo: '0',
    stock_maximo: '',
    costo_unitario: '',
    precio_venta: '',
    activo: true,
    // Campos para reactivos
    es_reactivo: false,
    vida_util_dias_abierto: '',
    capacidad_pruebas: '',
  })
  const [codigoSugerido, setCodigoSugerido] = useState<string | null>(null)
  const [cargandoSugerencia, setCargandoSugerencia] = useState(false)
  const sugerenciaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Movements state
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [movimientosLoading, setMovimientosLoading] = useState(false)
  const [showMovForm, setShowMovForm] = useState(false)
  const [filterMovItem, setFilterMovItem] = useState('')
  const [filterMovTipo, setFilterMovTipo] = useState('')
  const [filterMovFechaDesde, setFilterMovFechaDesde] = useState('')
  const [filterMovFechaHasta, setFilterMovFechaHasta] = useState('')
  const [movFormData, setMovFormData] = useState({
    codigo_item: '',
    tipo_movimiento: '',
    cantidad: '',
    motivo: '',
  })

  // Alerts state
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null)
  const [alertasLoading, setAlertasLoading] = useState(false)
  const [filterAlertTipo, setFilterAlertTipo] = useState('')
  const [filterAlertPrioridad, setFilterAlertPrioridad] = useState('')

  // Lotes state
  const [lotes, setLotes] = useState<Lote[]>([])
  const [lotesLoading, setLotesLoading] = useState(false)
  const [showLoteForm, setShowLoteForm] = useState(false)
  const [editingLote, setEditingLote] = useState<Lote | null>(null)
  const [filterLoteItem, setFilterLoteItem] = useState('')
  const [filterLoteVencimiento, setFilterLoteVencimiento] = useState<'todos' | 'vigentes' | 'por_vencer' | 'vencidos'>('todos')
  const [loteFormData, setLoteFormData] = useState({
    codigo_item: '',
    numero_lote: '',
    fecha_fabricacion: '',
    fecha_vencimiento: '',
    cantidad_inicial: '',
    costo_unitario: '',
    codigo_proveedor: '',
  })

  // Kardex state
  const [kardexData, setKardexData] = useState<KardexResponse | null>(null)
  const [kardexLoading, setKardexLoading] = useState(false)
  const [selectedItemKardex, setSelectedItemKardex] = useState('')
  const [kardexFechaDesde, setKardexFechaDesde] = useState('')
  const [kardexFechaHasta, setKardexFechaHasta] = useState('')

  // Global Kardex state
  const [kardexGlobal, setKardexGlobal] = useState<KardexGlobalResponse | null>(null)
  const [kardexGlobalLoading, setKardexGlobalLoading] = useState(false)
  const [kardexViewMode, setKardexViewMode] = useState<'global' | 'individual'>('global')

  // Proveedores for lote form
  const [proveedores, setProveedores] = useState<{ codigo_proveedor: number; razon_social: string }[]>([])

  // Categorias state
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriasLoading, setCategoriasLoading] = useState(false)
  const [showCategoriaForm, setShowCategoriaForm] = useState(false)
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null)
  const [categoriaFormData, setCategoriaFormData] = useState({
    nombre: '',
    descripcion: '',
  })

  // Quick Kardex Modal state
  const [showQuickKardex, setShowQuickKardex] = useState(false)
  const [quickKardexItem, setQuickKardexItem] = useState<ItemInventario | null>(null)
  const [quickKardexData, setQuickKardexData] = useState<KardexResponse | null>(null)
  const [quickKardexLoading, setQuickKardexLoading] = useState(false)

  // Historial de cambios state
  const [showHistorialModal, setShowHistorialModal] = useState(false)
  const [historialItem, setHistorialItem] = useState<ItemInventario | null>(null)
  const [historialData, setHistorialData] = useState<any[]>([])
  const [historialLoading, setHistorialLoading] = useState(false)
  const [historialPage, setHistorialPage] = useState(1)
  const [historialTotal, setHistorialTotal] = useState(0)

  // OCR Factura state
  const [showOcrModal, setShowOcrModal] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<any>(null)
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null)
  const [ocrSelectedItems, setOcrSelectedItems] = useState<Array<{
    descripcion: string
    cantidad: number
    numero_lote: string
    fecha_vencimiento: string
    codigo_item: string
    precio_unitario: number
    selected: boolean
    matchConfidence?: number
    matchedName?: string
  }>>([])
  const [ocrSelectedProveedor, setOcrSelectedProveedor] = useState<string>('')
  const [ocrImageZoom, setOcrImageZoom] = useState(false)

  // Generar Pedido de Reposición state
  const [showGenerarPedidoModal, setShowGenerarPedidoModal] = useState(false)
  const [generarPedidoItems, setGenerarPedidoItems] = useState<Array<{
    codigo_item: number
    codigo_interno: string
    nombre: string
    unidad_medida: string
    stock_actual: number
    stock_minimo: number
    costo_unitario: number
    estado_stock: string
    cantidad_pedir: number
    selected: boolean
  }>>([])
  const [generarPedidoProveedor, setGenerarPedidoProveedor] = useState<string>('')
  const [generarPedidoLoading, setGenerarPedidoLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && accessToken) {
      loadItems()
    }
  }, [accessToken, mounted])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  // Load items when switching to items tab or movements tab (needed for dropdown)
  useEffect(() => {
    if (activeTab === 'items' || activeTab === 'movimientos') {
      loadItems()
      loadCategorias() // Load categories for the item form dropdown
    }
  }, [activeTab])

  // Load categories when switching to categories tab
  useEffect(() => {
    if (activeTab === 'categorias') {
      loadCategorias()
    }
  }, [activeTab])

  // Load movements when switching to movements tab
  useEffect(() => {
    if (activeTab === 'movimientos') {
      loadMovimientos()
    }
  }, [activeTab])

  // Load alerts when switching to alerts tab
  useEffect(() => {
    if (activeTab === 'alertas') {
      loadAlertas()
      loadEstadisticas()
    }
  }, [activeTab])

  // Load lotes when switching to lotes tab
  useEffect(() => {
    if (activeTab === 'lotes') {
      loadLotes()
      loadItems()
      loadProveedores()
    }
  }, [activeTab])

  // Load items and kardex global when switching to kardex tab
  useEffect(() => {
    if (activeTab === 'kardex') {
      loadItems()
      loadKardexGlobal()
      loadProveedores() // Necesario para el modal "Generar Pedido"
    }
  }, [activeTab])

  // ==================== ITEMS FUNCTIONS ====================
  const loadItems = async () => {
    try {
      setItemsLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/items`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        const items = result.data || result
        setItems(items)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar items de inventario' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setItemsLoading(false)
    }
  }

  const handleOpenItemForm = (item?: ItemInventario) => {
    if (item) {
      setEditingItem(item)
      setItemFormData({
        codigo_interno: item.codigo_interno,
        nombre: item.nombre,
        descripcion: item.descripcion || '',
        codigo_categoria: item.codigo_categoria?.toString() || '',
        unidad_medida: item.unidad_medida,
        stock_actual: item.stock_actual.toString(),
        stock_minimo: item.stock_minimo.toString(),
        stock_maximo: item.stock_maximo?.toString() || '',
        costo_unitario: item.costo_unitario || '',
        precio_venta: item.precio_venta || '',
        activo: item.activo,
        es_reactivo: item.es_reactivo || false,
        vida_util_dias_abierto: item.vida_util_dias_abierto?.toString() || '',
        capacidad_pruebas: item.capacidad_pruebas?.toString() || '',
      })
    } else {
      setEditingItem(null)
      setItemFormData({
        codigo_interno: '',
        nombre: '',
        descripcion: '',
        codigo_categoria: '',
        unidad_medida: '',
        stock_actual: '0',
        stock_minimo: '0',
        stock_maximo: '',
        costo_unitario: '',
        precio_venta: '',
        activo: true,
        es_reactivo: false,
        vida_util_dias_abierto: '',
        capacidad_pruebas: '',
      })
    }
    setShowItemForm(true)
  }

  const handleCloseItemForm = () => {
    setShowItemForm(false)
    setEditingItem(null)
    setItemFormData({
      codigo_interno: '',
      nombre: '',
      descripcion: '',
      codigo_categoria: '',
      unidad_medida: '',
      stock_actual: '0',
      stock_minimo: '0',
      stock_maximo: '',
      costo_unitario: '',
      precio_venta: '',
      activo: true,
      es_reactivo: false,
      vida_util_dias_abierto: '',
      capacidad_pruebas: '',
    })
    setCodigoSugerido(null)
    if (sugerenciaTimeoutRef.current) {
      clearTimeout(sugerenciaTimeoutRef.current)
    }
  }

  // Función para obtener sugerencia de código interno desde el backend
  const fetchCodigoSugerido = useCallback(async (nombre: string, categoria?: string) => {
    if (!nombre || nombre.trim().length < 2) {
      setCodigoSugerido(null)
      return
    }

    setCargandoSugerencia(true)
    try {
      const params = new URLSearchParams({ nombre: nombre.trim() })
      if (categoria) {
        params.append('categoria', categoria)
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/items/sugerir-codigo?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
      if (response.ok) {
        const data = await response.json()
        setCodigoSugerido(data.codigo_sugerido)
      }
    } catch (error) {
      console.error('Error obteniendo sugerencia de código:', error)
    } finally {
      setCargandoSugerencia(false)
    }
  }, [accessToken])

  const handleItemInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setItemFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))

    // Si cambia el nombre o la categoría, obtener sugerencia de código (con debounce)
    if (name === 'nombre' || name === 'codigo_categoria') {
      if (sugerenciaTimeoutRef.current) {
        clearTimeout(sugerenciaTimeoutRef.current)
      }

      sugerenciaTimeoutRef.current = setTimeout(() => {
        const nombreValue = name === 'nombre' ? value : itemFormData.nombre
        const categoriaValue = name === 'codigo_categoria' ? value : itemFormData.codigo_categoria
        fetchCodigoSugerido(nombreValue, categoriaValue)
      }, 500) // 500ms debounce
    }
  }

  // Función para aplicar el código sugerido
  const aplicarCodigoSugerido = () => {
    if (codigoSugerido) {
      setItemFormData(prev => ({
        ...prev,
        codigo_interno: codigoSugerido,
      }))
    }
  }

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const stockActual = parseInt(itemFormData.stock_actual)
    const stockMinimo = parseInt(itemFormData.stock_minimo)
    const stockMaximo = itemFormData.stock_maximo ? parseInt(itemFormData.stock_maximo) : undefined
    const costoUnitario = itemFormData.costo_unitario ? parseFloat(itemFormData.costo_unitario) : undefined
    const precioVenta = itemFormData.precio_venta ? parseFloat(itemFormData.precio_venta) : undefined

    const stockValidation = validateStockRanges(stockActual, stockMinimo, stockMaximo)
    if (!stockValidation.valid) {
      setMessage({
        type: 'error',
        text: `Error de validación: ${stockValidation.errors.join(', ')}`
      })
      return
    }

    if (costoUnitario !== undefined && precioVenta !== undefined) {
      if (!validatePriceRelation(precioVenta, costoUnitario)) {
        setMessage({
          type: 'error',
          text: `El precio de venta (${formatCurrency(precioVenta)}) debe ser mayor o igual al costo unitario (${formatCurrency(costoUnitario)})`
        })
        return
      }
    }

    if (!itemFormData.codigo_interno.trim()) {
      setMessage({ type: 'error', text: 'El código interno es requerido' })
      return
    }

    try {
      const url = editingItem
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/items/${editingItem.codigo_item}`
        : `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/items`

      const payload: any = {
        codigo_interno: itemFormData.codigo_interno.trim(),
        nombre: itemFormData.nombre.trim(),
        descripcion: itemFormData.descripcion?.trim() || null,
        unidad_medida: itemFormData.unidad_medida,
        stock_actual: stockActual,
        stock_minimo: stockMinimo,
        activo: itemFormData.activo,
      }

      if (itemFormData.codigo_categoria) {
        payload.codigo_categoria = parseInt(itemFormData.codigo_categoria)
      }

      if (stockMaximo !== undefined) {
        payload.stock_maximo = stockMaximo
      }

      if (costoUnitario !== undefined) {
        payload.costo_unitario = costoUnitario
      }

      if (precioVenta !== undefined) {
        payload.precio_venta = precioVenta
      }

      // Campos de reactivo
      payload.es_reactivo = itemFormData.es_reactivo
      if (itemFormData.es_reactivo) {
        if (itemFormData.vida_util_dias_abierto) {
          payload.vida_util_dias_abierto = parseInt(itemFormData.vida_util_dias_abierto)
        }
        if (itemFormData.capacidad_pruebas) {
          payload.capacidad_pruebas = parseInt(itemFormData.capacidad_pruebas)
        }
      } else {
        // Si no es reactivo, limpiar estos campos
        payload.vida_util_dias_abierto = null
        payload.capacidad_pruebas = null
      }

      const response = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: editingItem ? 'Item actualizado correctamente' : 'Item creado correctamente',
        })
        handleCloseItemForm()
        loadItems()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al guardar item' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleDeleteItem = async (codigo_item: number) => {
    if (!confirm('¿Estás seguro de que deseas desactivar este item?')) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/items/${codigo_item}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok || response.status === 204) {
        setMessage({ type: 'success', text: 'Item desactivado correctamente' })
        loadItems()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al desactivar item' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const filteredItems = items.filter((item) => {
    const matchSearch =
      searchTerm === '' ||
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo_interno.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())

    // Solo mostrar items activos
    return matchSearch && item.activo
  })

  const getStockStatus = (item: ItemInventario) => {
    if (item.stock_actual === 0) {
      return { label: 'Sin Stock', color: 'bg-lab-danger-100 text-lab-danger-800' }
    }
    if (item.stock_actual <= item.stock_minimo) {
      return { label: 'Bajo', color: 'bg-lab-warning-100 text-lab-warning-800' }
    }
    if (item.stock_maximo && item.stock_actual >= item.stock_maximo) {
      return { label: 'Exceso', color: 'bg-lab-info-100 text-lab-info-800' }
    }
    return { label: 'Óptimo', color: 'bg-lab-success-100 text-lab-success-800' }
  }

  // ==================== MOVEMENTS FUNCTIONS ====================
  const loadMovimientos = async () => {
    try {
      setMovimientosLoading(true)

      const params = new URLSearchParams()
      if (filterMovItem) params.append('codigo_item', filterMovItem)
      if (filterMovTipo) params.append('tipo_movimiento', filterMovTipo)
      if (filterMovFechaDesde) params.append('fecha_desde', filterMovFechaDesde)
      if (filterMovFechaHasta) params.append('fecha_hasta', filterMovFechaHasta)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/movements?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const result = await response.json()
        const movimientos = result.data || result
        setMovimientos(movimientos)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar movimientos' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setMovimientosLoading(false)
    }
  }

  const handleMovSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!movFormData.codigo_item) {
      setMessage({ type: 'error', text: 'Debe seleccionar un item' })
      return
    }

    if (!movFormData.tipo_movimiento) {
      setMessage({ type: 'error', text: 'Debe seleccionar el tipo de movimiento' })
      return
    }

    const cantidad = parseInt(movFormData.cantidad)
    if (isNaN(cantidad) || cantidad <= 0) {
      setMessage({ type: 'error', text: 'La cantidad debe ser un número positivo' })
      return
    }

    try {
      const payload = {
        codigo_item: parseInt(movFormData.codigo_item),
        tipo_movimiento: movFormData.tipo_movimiento,
        cantidad,
        motivo: movFormData.motivo.trim() || null,
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/movements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Movimiento registrado correctamente' })
        handleCloseMovForm()
        loadMovimientos()
        loadItems()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al registrar movimiento' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const handleCloseMovForm = () => {
    setShowMovForm(false)
    setMovFormData({
      codigo_item: '',
      tipo_movimiento: '',
      cantidad: '',
      motivo: '',
    })
  }

  const getTipoMovimientoStyle = (tipo: string) => {
    const option = TIPO_MOVIMIENTO_OPTIONS.find(opt => opt.value === tipo)
    return option || TIPO_MOVIMIENTO_OPTIONS[0]
  }

  const handleApplyMovFilters = () => {
    loadMovimientos()
  }

  const handleClearMovFilters = () => {
    setFilterMovItem('')
    setFilterMovTipo('')
    setFilterMovFechaDesde('')
    setFilterMovFechaHasta('')
    setTimeout(() => loadMovimientos(), 100)
  }

  // ==================== ALERTS FUNCTIONS ====================
  const loadAlertas = async () => {
    try {
      setAlertasLoading(true)

      const params = new URLSearchParams()
      if (filterAlertTipo) params.append('tipo', filterAlertTipo)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/alertas?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setAlertas(data)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar alertas' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setAlertasLoading(false)
    }
  }

  const loadEstadisticas = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/alertas/estadisticas`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setEstadisticas(data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleApplyAlertFilters = () => {
    loadAlertas()
  }

  const handleClearAlertFilters = () => {
    setFilterAlertTipo('')
    setFilterAlertPrioridad('')
    setTimeout(() => loadAlertas(), 100)
  }

  const filteredAlertas = alertas.filter((alerta) => {
    if (filterAlertPrioridad && alerta.prioridad !== filterAlertPrioridad) return false
    return true
  })

  // ==================== CATEGORIAS FUNCTIONS ====================
  const loadCategorias = async () => {
    try {
      setCategoriasLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/categories`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCategorias(data)
      } else {
        console.error('Error al cargar categorías')
      }
    } catch (error) {
      console.error('Error de conexión:', error)
    } finally {
      setCategoriasLoading(false)
    }
  }

  const handleOpenCategoriaForm = (categoria?: Categoria) => {
    if (categoria) {
      setEditingCategoria(categoria)
      setCategoriaFormData({
        nombre: categoria.nombre,
        descripcion: categoria.descripcion || '',
      })
    } else {
      setEditingCategoria(null)
      setCategoriaFormData({
        nombre: '',
        descripcion: '',
      })
    }
    setShowCategoriaForm(true)
  }

  const handleCloseCategoriaForm = () => {
    setShowCategoriaForm(false)
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
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/categories/${editingCategoria.codigo_categoria}`
        : `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/categories`

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
        handleCloseCategoriaForm()
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
    if (!confirm('¿Está seguro de eliminar esta categoría? Si tiene items asociados, será desactivada.')) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/categories/${codigo_categoria}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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

  // ==================== QUICK KARDEX MODAL ====================
  const openQuickKardex = async (item: ItemInventario) => {
    setQuickKardexItem(item)
    setShowQuickKardex(true)
    setQuickKardexLoading(true)
    setQuickKardexData(null)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/items/${item.codigo_item}/kardex`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setQuickKardexData(data)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar kardex del item' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setQuickKardexLoading(false)
    }
  }

  const closeQuickKardex = () => {
    setShowQuickKardex(false)
    setQuickKardexItem(null)
    setQuickKardexData(null)
  }

  // ==================== HISTORIAL FUNCTIONS ====================
  const openHistorialModal = async (item: ItemInventario) => {
    setHistorialItem(item)
    setShowHistorialModal(true)
    setHistorialPage(1)
    await loadHistorial(item.codigo_item, 1)
  }

  const loadHistorial = async (codigoItem: number, page: number) => {
    setHistorialLoading(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/items/${codigoItem}/historial?page=${page}&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const result = await response.json()
        setHistorialData(result.data || [])
        setHistorialTotal(result.pagination?.total || 0)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar historial del item' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setHistorialLoading(false)
    }
  }

  const closeHistorialModal = () => {
    setShowHistorialModal(false)
    setHistorialItem(null)
    setHistorialData([])
    setHistorialPage(1)
    setHistorialTotal(0)
  }

  // ==================== LOTES FUNCTIONS ====================
  const loadLotes = async () => {
    try {
      setLotesLoading(true)
      const params = new URLSearchParams()
      if (filterLoteItem) params.append('codigo_item', filterLoteItem)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/lotes?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const result = await response.json()
        // La API retorna { data: [...], pagination: {...} }
        setLotes(result.data || [])
      } else {
        setMessage({ type: 'error', text: 'Error al cargar lotes' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setLotesLoading(false)
    }
  }

  const loadProveedores = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/suppliers`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setProveedores(data.filter((p: any) => p.activo))
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
    }
  }

  const handleOpenLoteForm = (lote?: Lote) => {
    if (lote) {
      setEditingLote(lote)
      // Buscar el codigo_proveedor basado en el nombre guardado
      const matchingProveedor = proveedores.find(p => p.razon_social === lote.proveedor)
      setLoteFormData({
        codigo_item: lote.codigo_item.toString(),
        numero_lote: lote.numero_lote,
        fecha_fabricacion: lote.fecha_fabricacion?.split('T')[0] || '',
        fecha_vencimiento: lote.fecha_vencimiento?.split('T')[0] || '',
        cantidad_inicial: lote.cantidad_inicial.toString(),
        costo_unitario: lote.costo_unitario || '',
        codigo_proveedor: matchingProveedor?.codigo_proveedor.toString() || '',
      })
    } else {
      setEditingLote(null)
      setLoteFormData({
        codigo_item: '',
        numero_lote: '',
        fecha_fabricacion: '',
        fecha_vencimiento: '',
        cantidad_inicial: '',
        costo_unitario: '',
        codigo_proveedor: '',
      })
    }
    setShowLoteForm(true)
  }

  const handleCloseLoteForm = () => {
    setShowLoteForm(false)
    setEditingLote(null)
    setLoteFormData({
      codigo_item: '',
      numero_lote: '',
      fecha_fabricacion: '',
      fecha_vencimiento: '',
      cantidad_inicial: '',
      costo_unitario: '',
      codigo_proveedor: '',
    })
  }

  const handleLoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!loteFormData.codigo_item || !loteFormData.numero_lote || !loteFormData.cantidad_inicial) {
      setMessage({ type: 'error', text: 'Complete los campos requeridos' })
      return
    }

    try {
      const url = editingLote
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/lotes/${editingLote.codigo_lote}`
        : `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/lotes`

      const payload: any = {
        codigo_item: parseInt(loteFormData.codigo_item),
        numero_lote: loteFormData.numero_lote.trim(),
        cantidad_inicial: parseInt(loteFormData.cantidad_inicial),
      }

      if (loteFormData.fecha_fabricacion) {
        payload.fecha_fabricacion = new Date(loteFormData.fecha_fabricacion).toISOString()
      }
      if (loteFormData.fecha_vencimiento) {
        payload.fecha_vencimiento = new Date(loteFormData.fecha_vencimiento).toISOString()
      }
      if (loteFormData.costo_unitario) {
        payload.costo_unitario = parseFloat(loteFormData.costo_unitario)
      }
      if (loteFormData.codigo_proveedor) {
        payload.codigo_proveedor = parseInt(loteFormData.codigo_proveedor)
      }

      const response = await fetch(url, {
        method: editingLote ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: editingLote ? 'Lote actualizado correctamente' : 'Lote registrado correctamente',
        })
        handleCloseLoteForm()
        loadLotes()
        loadItems() // Refresh items since stock may have changed
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al guardar lote' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    }
  }

  const getLoteStatus = (lote: Lote) => {
    if (!lote.fecha_vencimiento) {
      return { label: 'Sin vencimiento', color: 'bg-lab-neutral-100 text-lab-neutral-800' }
    }

    const today = new Date()
    const vencimiento = new Date(lote.fecha_vencimiento)
    const diffDays = Math.ceil((vencimiento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { label: 'Vencido', color: 'bg-lab-danger-100 text-lab-danger-800', days: diffDays }
    }
    if (diffDays <= 30) {
      return { label: 'Por vencer', color: 'bg-lab-warning-100 text-lab-warning-800', days: diffDays }
    }
    return { label: 'Vigente', color: 'bg-lab-success-100 text-lab-success-800', days: diffDays }
  }

  const filteredLotes = lotes.filter((lote) => {
    if (filterLoteItem && lote.codigo_item.toString() !== filterLoteItem) return false

    if (filterLoteVencimiento !== 'todos' && lote.fecha_vencimiento) {
      const status = getLoteStatus(lote)
      if (filterLoteVencimiento === 'vencidos' && status.label !== 'Vencido') return false
      if (filterLoteVencimiento === 'por_vencer' && status.label !== 'Por vencer') return false
      if (filterLoteVencimiento === 'vigentes' && status.label !== 'Vigente') return false
    }

    return true
  })

  // ==================== KARDEX FUNCTIONS ====================
  const loadKardex = async () => {
    if (!selectedItemKardex) {
      setMessage({ type: 'error', text: 'Seleccione un item para ver su kardex' })
      return
    }

    try {
      setKardexLoading(true)
      const params = new URLSearchParams()
      if (kardexFechaDesde) params.append('fecha_desde', kardexFechaDesde)
      if (kardexFechaHasta) params.append('fecha_hasta', kardexFechaHasta)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/items/${selectedItemKardex}/kardex?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setKardexData(data)
      } else {
        setMessage({ type: 'error', text: 'Error al cargar kardex' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setKardexLoading(false)
    }
  }

  const handleClearKardex = () => {
    setSelectedItemKardex('')
    setKardexFechaDesde('')
    setKardexFechaHasta('')
    setKardexData(null)
  }

  // Cargar Kardex Global
  const loadKardexGlobal = async () => {
    try {
      setKardexGlobalLoading(true)
      const params = new URLSearchParams()
      if (kardexFechaDesde) params.append('fecha_desde', kardexFechaDesde)
      if (kardexFechaHasta) params.append('fecha_hasta', kardexFechaHasta)

      const url = `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/kardex-global?${params.toString()}`
      console.log('Llamando a Kardex Global:', url)

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      console.log('Kardex Global response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Kardex Global data recibida:', data)
        setKardexGlobal(data)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Kardex Global error:', response.status, errorData)
        setMessage({ type: 'error', text: errorData.message || `Error al cargar kardex global (${response.status})` })
      }
    } catch (error) {
      console.error('Error en loadKardexGlobal:', error)
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setKardexGlobalLoading(false)
    }
  }

  // Exportar Kardex Global a PDF
  const exportKardexGlobalPdf = async () => {
    try {
      setMessage({ type: 'info', text: 'Generando PDF...' })
      const params = new URLSearchParams()
      if (kardexFechaDesde) params.append('fecha_desde', kardexFechaDesde)
      if (kardexFechaHasta) params.append('fecha_hasta', kardexFechaHasta)

      const url = `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/kardex-global/pdf?${params.toString()}`

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `kardex-global-${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(downloadUrl)
        setMessage({ type: 'success', text: 'PDF descargado exitosamente' })
      } else {
        const errorData = await response.json().catch(() => ({}))
        setMessage({ type: 'error', text: errorData.message || 'Error al generar PDF' })
      }
    } catch (error) {
      console.error('Error exportando PDF:', error)
      setMessage({ type: 'error', text: 'Error de conexión al exportar PDF' })
    }
  }

  // Cambiar a vista de item individual desde el resumen global
  const handleViewItemKardex = (codigoItem: number) => {
    setSelectedItemKardex(codigoItem.toString())
    setKardexViewMode('individual')
    // Cargar kardex del item
    setTimeout(() => loadKardex(), 100)
  }

  // Volver al resumen global
  const handleBackToGlobal = () => {
    setKardexViewMode('global')
    setKardexData(null)
    setSelectedItemKardex('')
  }

  // ==================== GENERAR PEDIDO DE REPOSICIÓN ====================
  const openGenerarPedidoModal = () => {
    if (!kardexGlobal) {
      setMessage({ type: 'error', text: 'No hay datos de Kardex Global disponibles' })
      return
    }

    // Filtrar items con stock bajo, crítico o agotado
    const itemsBajoStock = kardexGlobal.items
      .filter(item => ['BAJO', 'CRITICO', 'AGOTADO'].includes(item.estado_stock))
      .map(item => ({
        codigo_item: item.codigo_item,
        codigo_interno: item.codigo_interno,
        nombre: item.nombre,
        unidad_medida: item.unidad_medida,
        stock_actual: item.stock_actual,
        stock_minimo: item.stock_minimo,
        costo_unitario: item.costo_unitario,
        estado_stock: item.estado_stock,
        cantidad_pedir: Math.max(item.stock_minimo - item.stock_actual + 10, 1), // Sugiere cantidad
        selected: true, // Pre-seleccionado
      }))

    if (itemsBajoStock.length === 0) {
      setMessage({ type: 'info', text: 'No hay items con stock bajo, crítico o agotado' })
      return
    }

    setGenerarPedidoItems(itemsBajoStock)
    setGenerarPedidoProveedor('') // Resetear proveedor
    setShowGenerarPedidoModal(true)
  }

  // Descargar PDF de Pedido de Reposición (para imprimir y llenar a mano)
  const downloadPedidoReposicionPdf = async () => {
    try {
      setMessage({ type: 'info', text: 'Generando PDF de pedido...' })

      const url = `${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/pedido-reposicion/pdf`

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `pedido-reposicion-${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(downloadUrl)
        setMessage({ type: 'success', text: 'PDF de pedido descargado' })
      } else {
        const errorData = await response.json().catch(() => ({}))
        setMessage({ type: 'error', text: errorData.message || 'Error al generar PDF de pedido' })
      }
    } catch (error) {
      console.error('Error descargando PDF de pedido:', error)
      setMessage({ type: 'error', text: 'Error de conexión al descargar PDF' })
    }
  }

  const handleGenerarPedidoItemChange = (codigoItem: number, field: string, value: any) => {
    setGenerarPedidoItems(prev =>
      prev.map(item =>
        item.codigo_item === codigoItem
          ? { ...item, [field]: value }
          : item
      )
    )
  }

  const handleToggleAllPedidoItems = (selected: boolean) => {
    setGenerarPedidoItems(prev =>
      prev.map(item => ({ ...item, selected }))
    )
  }

  const handleGenerarOrdenes = async () => {
    const itemsSeleccionados = generarPedidoItems.filter(item => item.selected)

    if (itemsSeleccionados.length === 0) {
      setMessage({ type: 'error', text: 'Debe seleccionar al menos un item' })
      return
    }

    if (!generarPedidoProveedor) {
      setMessage({ type: 'error', text: 'Debe seleccionar un proveedor para la orden' })
      return
    }

    setGenerarPedidoLoading(true)

    try {
      // Crear UNA sola orden con todos los items seleccionados
      const ordenData = {
        codigo_proveedor: parseInt(generarPedidoProveedor),
        observaciones: `Pedido de reposición generado automáticamente - ${new Date().toLocaleDateString('es-EC')} - ${itemsSeleccionados.length} items`,
        detalles: itemsSeleccionados.map(item => ({
          codigo_item: item.codigo_item,
          cantidad: item.cantidad_pedir,
          precio_unitario: item.costo_unitario,
        })),
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(ordenData),
      })

      if (response.ok) {
        const result = await response.json()
        setMessage({
          type: 'success',
          text: `Orden de compra ${result.numero_orden} creada con ${itemsSeleccionados.length} items. Vaya a Órdenes de Compra para emitirla.`,
        })
        setShowGenerarPedidoModal(false)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al crear orden de compra' })
      }
    } catch (error) {
      console.error('Error generando orden:', error)
      setMessage({ type: 'error', text: 'Error de conexión al generar orden' })
    } finally {
      setGenerarPedidoLoading(false)
    }
  }

  // ==================== OCR FACTURA FUNCTIONS ====================

  /**
   * Función para encontrar el mejor item coincidente del inventario
   * basado en la descripción del OCR
   */
  const findBestMatchingItem = (descripcion: string, inventoryItems: typeof items): {
    codigo_item: number
    nombre: string
    confidence: number
  } | null => {
    if (!descripcion || inventoryItems.length === 0) return null

    const normalizedDesc = descripcion.toLowerCase().trim()
    let bestMatch: { codigo_item: number; nombre: string; confidence: number } | null = null
    let highestScore = 0

    for (const item of inventoryItems) {
      const normalizedName = item.nombre.toLowerCase().trim()
      const normalizedCode = item.codigo_interno.toLowerCase()

      let score = 0

      // Match exacto = 100%
      if (normalizedName === normalizedDesc) {
        score = 100
      }
      // Nombre contiene descripción o viceversa
      else if (normalizedName.includes(normalizedDesc) || normalizedDesc.includes(normalizedName)) {
        score = 80
      }
      // Código interno coincide
      else if (normalizedCode === normalizedDesc || normalizedDesc.includes(normalizedCode)) {
        score = 90
      }
      // Palabras clave coinciden
      else {
        const descWords = normalizedDesc.split(/\s+/).filter(w => w.length > 2)
        const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 2)

        let matchedWords = 0
        for (const descWord of descWords) {
          for (const nameWord of nameWords) {
            if (nameWord.includes(descWord) || descWord.includes(nameWord)) {
              matchedWords++
              break
            }
          }
        }

        if (descWords.length > 0) {
          score = Math.round((matchedWords / descWords.length) * 70)
        }
      }

      if (score > highestScore && score >= 50) { // Mínimo 50% de confianza
        highestScore = score
        bestMatch = {
          codigo_item: item.codigo_item,
          nombre: item.nombre,
          confidence: score,
        }
      }
    }

    return bestMatch
  }

  const openOcrModal = () => {
    setShowOcrModal(true)
    setOcrResult(null)
    setOcrPreviewUrl(null)
    setOcrSelectedItems([])
    setOcrSelectedProveedor('')
    // Cargar proveedores si no están cargados
    if (proveedores.length === 0) {
      loadProveedores()
    }
  }

  const closeOcrModal = () => {
    setShowOcrModal(false)
    setOcrResult(null)
    setOcrPreviewUrl(null)
    setOcrSelectedItems([])
  }

  const handleOcrFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Mostrar preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setOcrPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Procesar con OCR
    setOcrLoading(true)
    setOcrResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory/ocr/process-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setOcrResult(data)

        // Preparar items para selección con auto-matching
        if (data.success && data.items?.length > 0) {
          setOcrSelectedItems(data.items.map((item: any) => {
            // Intentar auto-match con inventario existente
            const matchedItem = findBestMatchingItem(item.descripcion || '', items)

            return {
              descripcion: item.descripcion || '',
              cantidad: item.cantidad || 1,
              numero_lote: item.numero_lote || `LOT-${Date.now()}`,
              fecha_vencimiento: item.fecha_vencimiento || '',
              codigo_item: matchedItem?.codigo_item?.toString() || '',
              precio_unitario: item.precio_unitario || 0,
              selected: true,
              matchConfidence: matchedItem?.confidence || 0, // Guardar nivel de confianza
              matchedName: matchedItem?.nombre || '', // Guardar nombre del match
            }
          }))
        }
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al procesar imagen' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setOcrLoading(false)
    }
  }

  const handleOcrItemChange = (index: number, field: string, value: any) => {
    setOcrSelectedItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleCreateOrdenFromOcr = async () => {
    const itemsToCreate = ocrSelectedItems.filter(item => item.selected && item.codigo_item)

    if (itemsToCreate.length === 0) {
      setMessage({ type: 'error', text: 'Seleccione al menos un item y asigne un producto del inventario' })
      return
    }

    if (!ocrSelectedProveedor) {
      setMessage({ type: 'error', text: 'Debe seleccionar un proveedor para la orden de compra' })
      return
    }

    setOcrLoading(true)

    try {
      // Crear orden de compra con los items del OCR
      const ordenData = {
        codigo_proveedor: parseInt(ocrSelectedProveedor),
        observaciones: `Orden creada desde escaneo de factura${ocrResult?.factura?.numero ? ` - Factura: ${ocrResult.factura.numero}` : ''}${ocrResult?.factura?.fecha ? ` - Fecha: ${ocrResult.factura.fecha}` : ''}`,
        detalles: itemsToCreate.map(item => ({
          codigo_item: parseInt(item.codigo_item),
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario || 0,
          // Guardar info de lote en observaciones para cuando se reciba
          observaciones_item: `Lote: ${item.numero_lote}${item.fecha_vencimiento ? `, Venc: ${item.fecha_vencimiento}` : ''}`,
        })),
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/purchase-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(ordenData),
      })

      if (response.ok) {
        const result = await response.json()
        setMessage({
          type: 'success',
          text: `Orden de compra ${result.numero_orden} creada exitosamente. Vaya a Órdenes de Compra para emitirla y recibirla.`,
        })
        closeOcrModal()
        // Recargar datos
        loadItems()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al crear orden de compra' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setOcrLoading(false)
    }
  }

  // ==================== RENDER ====================
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Messages - Fixed position toast */}
      {message && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in-right">
          <div
            className={`p-4 rounded-lg shadow-lg flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-white border-l-4 border-green-500'
                : 'bg-white border-l-4 border-red-500'
            }`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              {message.type === 'success' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {message.type === 'success' ? 'Operación exitosa' : 'Error'}
              </p>
              <p className="text-sm text-gray-600 mt-1">{message.text}</p>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-lab-neutral-900">Gestión de Inventario</h1>
          <p className="text-lab-neutral-600 mt-2">
            Administra el stock, movimientos y alertas del laboratorio
          </p>
        </div>
        {activeTab === 'items' && (
          <Button onClick={() => handleOpenItemForm()} className="bg-lab-primary-600 hover:bg-lab-primary-700">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Item
          </Button>
        )}
        {activeTab === 'movimientos' && (
          <Button onClick={() => setShowMovForm(true)} className="bg-lab-primary-600 hover:bg-lab-primary-700">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Registrar Movimiento
          </Button>
        )}
        {activeTab === 'alertas' && (
          <Button onClick={loadAlertas} className="bg-lab-primary-600 hover:bg-lab-primary-700">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </Button>
        )}
        {activeTab === 'lotes' && (
          <div className="flex space-x-2">
            <Button onClick={openOcrModal} variant="outline" className="border-lab-primary-600 text-lab-primary-600 hover:bg-lab-primary-50">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Escanear Factura (OCR)
            </Button>
            <Button onClick={() => handleOpenLoteForm()} className="bg-lab-primary-600 hover:bg-lab-primary-700">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo Lote
            </Button>
          </div>
        )}
        {activeTab === 'categorias' && (
          <Button onClick={() => handleOpenCategoriaForm()} className="bg-lab-primary-600 hover:bg-lab-primary-700">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Categoría
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-lab-neutral-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('items')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'items'
                ? 'border-lab-primary-600 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            Items de Inventario
          </button>
          <button
            onClick={() => setActiveTab('movimientos')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'movimientos'
                ? 'border-lab-primary-600 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            Movimientos de Stock
          </button>
          <button
            onClick={() => setActiveTab('alertas')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'alertas'
                ? 'border-lab-primary-600 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            Alertas de Stock
          </button>
          <button
            onClick={() => setActiveTab('lotes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'lotes'
                ? 'border-lab-primary-600 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            Gestión de Lotes
          </button>
          <button
            onClick={() => setActiveTab('kardex')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'kardex'
                ? 'border-lab-primary-600 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            Kardex
          </button>
          <button
            onClick={() => setActiveTab('categorias')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'categorias'
                ? 'border-lab-primary-600 text-lab-primary-600'
                : 'border-transparent text-lab-neutral-500 hover:text-lab-neutral-700 hover:border-lab-neutral-300'
            }`}
          >
            Categorías
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'items' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Total Items</div>
                <div className="text-2xl font-bold text-lab-neutral-900 mt-2">{items.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Stock Bajo</div>
                <div className="text-2xl font-bold text-lab-warning-600 mt-2">
                  {items.filter((item) => item.stock_actual <= item.stock_minimo && item.stock_actual > 0).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Sin Stock</div>
                <div className="text-2xl font-bold text-lab-danger-600 mt-2">
                  {items.filter((item) => item.stock_actual === 0).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-lab-neutral-600">Stock Óptimo</div>
                <div className="text-2xl font-bold text-lab-success-600 mt-2">
                  {
                    items.filter(
                      (item) => item.stock_actual > item.stock_minimo &&
                      (!item.stock_maximo || item.stock_actual < item.stock_maximo)
                    ).length
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <Input
                placeholder="Buscar por nombre, código interno o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Items de Inventario ({filteredItems.length})</CardTitle>
              <CardDescription>Control de stock de reactivos e insumos</CardDescription>
            </CardHeader>
            <CardContent>
              {itemsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-lab-neutral-200">
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Código</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Nombre</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Stock Actual</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Mín/Máx</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Categoría</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Unidad</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Estado</th>
                        <th className="text-right p-4 font-semibold text-lab-neutral-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => {
                        const stockStatus = getStockStatus(item)
                        return (
                          <tr key={item.codigo_item} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                            <td className="p-4 text-sm font-mono text-lab-neutral-700">{item.codigo_interno}</td>
                            <td className="p-4">
                              <div className="font-medium text-lab-neutral-900">{item.nombre}</div>
                              {item.descripcion && (
                                <div className="text-sm text-lab-neutral-600 truncate max-w-xs">{item.descripcion}</div>
                              )}
                            </td>
                            <td className="p-4 font-semibold text-lab-neutral-900">{item.stock_actual}</td>
                            <td className="p-4 text-sm text-lab-neutral-600">
                              {item.stock_minimo} / {item.stock_maximo || '-'}
                            </td>
                            <td className="p-4 text-sm text-lab-neutral-600">
                              {item.categoria?.nombre || <span className="text-lab-neutral-400">Sin categoría</span>}
                            </td>
                            <td className="p-4 text-sm text-lab-neutral-600">{item.unidad_medida}</td>
                            <td className="p-4">
                              <span className={`text-xs px-2 py-1 rounded ${stockStatus.color}`}>
                                {stockStatus.label}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openQuickKardex(item)}
                                className="text-lab-primary-600 hover:text-lab-primary-700"
                                title="Ver Kardex"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openHistorialModal(item)}
                                className="text-lab-neutral-600 hover:text-lab-neutral-700"
                                title="Ver Historial de Cambios"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenItemForm(item)}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteItem(item.codigo_item)}
                                className="text-lab-danger-600 hover:text-lab-danger-700 hover:bg-lab-danger-50"
                              >
                                Desactivar
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {filteredItems.length === 0 && (
                    <div className="text-center py-12 text-lab-neutral-500">
                      No se encontraron items de inventario
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Item Form Modal */}
          {showItemForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full my-8">
                <div className="p-6 border-b border-lab-neutral-200">
                  <h2 className="text-2xl font-bold text-lab-neutral-900">
                    {editingItem ? 'Editar Item de Inventario' : 'Nuevo Item de Inventario'}
                  </h2>
                </div>

                <form onSubmit={handleItemSubmit} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Nombre del Item *
                      </label>
                      <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        value={itemFormData.nombre}
                        onChange={handleItemInputChange}
                        required
                        placeholder="Ej: Reactivo Hemoglobina"
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="codigo_interno" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Código Interno *
                      </label>
                      <input
                        type="text"
                        id="codigo_interno"
                        name="codigo_interno"
                        value={itemFormData.codigo_interno}
                        onChange={handleItemInputChange}
                        required
                        placeholder={codigoSugerido || 'Ej: RH-0001'}
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                      />
                      {/* Sugerencia de código automático */}
                      {!editingItem && (
                        <div className="mt-1 min-h-[24px]">
                          {cargandoSugerencia ? (
                            <span className="text-xs text-lab-neutral-500">Generando sugerencia...</span>
                          ) : codigoSugerido && codigoSugerido !== itemFormData.codigo_interno ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-lab-neutral-600">Sugerencia:</span>
                              <span className="text-sm font-bold text-lab-primary-600">{codigoSugerido}</span>
                              <button
                                type="button"
                                onClick={aplicarCodigoSugerido}
                                className="text-xs text-lab-primary-600 hover:text-lab-primary-700 underline"
                              >
                                Usar
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="descripcion" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Descripción
                      </label>
                      <textarea
                        id="descripcion"
                        name="descripcion"
                        value={itemFormData.descripcion}
                        onChange={handleItemInputChange}
                        rows={2}
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="codigo_categoria" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Categoría
                      </label>
                      <select
                        id="codigo_categoria"
                        name="codigo_categoria"
                        value={itemFormData.codigo_categoria}
                        onChange={handleItemInputChange}
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                      >
                        <option value="">Sin categoría</option>
                        {categorias.filter(c => c.activo).map((cat) => (
                          <option key={cat.codigo_categoria} value={cat.codigo_categoria}>
                            {cat.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="unidad_medida" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Unidad de Medida *
                      </label>
                      <select
                        id="unidad_medida"
                        name="unidad_medida"
                        value={itemFormData.unidad_medida}
                        onChange={handleItemInputChange}
                        required
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Unidad">Unidad</option>
                        <option value="ml">Mililitros (ml)</option>
                        <option value="L">Litros (L)</option>
                        <option value="mg">Miligramos (mg)</option>
                        <option value="g">Gramos (g)</option>
                        <option value="kg">Kilogramos (kg)</option>
                        <option value="Caja">Caja</option>
                        <option value="Paquete">Paquete</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="stock_actual" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Stock Actual *
                      </label>
                      <input
                        type="number"
                        id="stock_actual"
                        name="stock_actual"
                        value={itemFormData.stock_actual}
                        onChange={handleItemInputChange}
                        min="0"
                        required
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="stock_minimo" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Stock Mínimo *
                      </label>
                      <input
                        type="number"
                        id="stock_minimo"
                        name="stock_minimo"
                        value={itemFormData.stock_minimo}
                        onChange={handleItemInputChange}
                        min="0"
                        required
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="stock_maximo" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Stock Máximo
                      </label>
                      <input
                        type="number"
                        id="stock_maximo"
                        name="stock_maximo"
                        value={itemFormData.stock_maximo}
                        onChange={handleItemInputChange}
                        min="0"
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="costo_unitario" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Costo Unitario (USD)
                      </label>
                      <input
                        type="number"
                        id="costo_unitario"
                        name="costo_unitario"
                        value={itemFormData.costo_unitario}
                        onChange={handleItemInputChange}
                        step="0.01"
                        min="0"
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="precio_venta" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Precio de Venta (USD)
                      </label>
                      <input
                        type="number"
                        id="precio_venta"
                        name="precio_venta"
                        value={itemFormData.precio_venta}
                        onChange={handleItemInputChange}
                        step="0.01"
                        min="0"
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                      />
                    </div>

                    {/* Seccion de Reactivo */}
                    <div className="col-span-2 border-t border-lab-neutral-200 pt-4 mt-2">
                      <h3 className="text-sm font-semibold text-lab-neutral-800 mb-3">Control de Reactivos</h3>
                      <p className="text-xs text-lab-neutral-500 mb-3">
                        Configure si este item es un reactivo que tiene vida util limitada una vez abierto
                      </p>

                      <div className="flex items-center mb-4">
                        <input
                          type="checkbox"
                          id="es_reactivo"
                          name="es_reactivo"
                          checked={itemFormData.es_reactivo}
                          onChange={handleItemInputChange}
                          className="h-4 w-4 text-lab-primary-600 focus:ring-lab-primary-500 border-lab-neutral-300 rounded"
                        />
                        <label htmlFor="es_reactivo" className="ml-2 block text-sm text-lab-neutral-700">
                          Es un reactivo con vida util limitada
                        </label>
                      </div>

                      {itemFormData.es_reactivo && (
                        <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-lab-primary-200 bg-lab-primary-50 p-3 rounded-r-lg">
                          <div>
                            <label htmlFor="vida_util_dias_abierto" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                              Vida util despues de abierto (dias) *
                            </label>
                            <input
                              type="number"
                              id="vida_util_dias_abierto"
                              name="vida_util_dias_abierto"
                              value={itemFormData.vida_util_dias_abierto}
                              onChange={handleItemInputChange}
                              min="1"
                              placeholder="Ej: 2"
                              className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                            />
                            <p className="text-xs text-lab-neutral-500 mt-1">
                              Cuantos dias dura el frasco una vez abierto
                            </p>
                          </div>
                          <div>
                            <label htmlFor="capacidad_pruebas" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                              Capacidad de pruebas por frasco *
                            </label>
                            <input
                              type="number"
                              id="capacidad_pruebas"
                              name="capacidad_pruebas"
                              value={itemFormData.capacidad_pruebas}
                              onChange={handleItemInputChange}
                              min="1"
                              placeholder="Ej: 100"
                              className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 focus:border-lab-primary-500 focus:ring-lab-primary-500"
                            />
                            <p className="text-xs text-lab-neutral-500 mt-1">
                              Cuantas pruebas se pueden hacer con un frasco
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="activo"
                        name="activo"
                        checked={itemFormData.activo}
                        onChange={handleItemInputChange}
                        className="h-4 w-4 text-lab-primary-600 focus:ring-lab-primary-500 border-lab-neutral-300 rounded"
                      />
                      <label htmlFor="activo" className="ml-2 block text-sm text-lab-neutral-700">
                        Item activo
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-lab-neutral-200">
                    <Button type="button" onClick={handleCloseItemForm} variant="outline">
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-lab-primary-600 hover:bg-lab-primary-700">
                      {editingItem ? 'Actualizar' : 'Crear'} Item
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'movimientos' && (
        <>
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Item
                  </label>
                  <select
                    value={filterMovItem}
                    onChange={(e) => setFilterMovItem(e.target.value)}
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                  >
                    <option value="">Todos los items</option>
                    {items.map((item) => (
                      <option key={item.codigo_item} value={item.codigo_item}>
                        {item.codigo_interno} - {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={filterMovTipo}
                    onChange={(e) => setFilterMovTipo(e.target.value)}
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                  >
                    <option value="">Todos los tipos</option>
                    {TIPO_MOVIMIENTO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Desde
                  </label>
                  <Input
                    type="date"
                    value={filterMovFechaDesde}
                    onChange={(e) => setFilterMovFechaDesde(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Hasta
                  </label>
                  <Input
                    type="date"
                    value={filterMovFechaHasta}
                    onChange={(e) => setFilterMovFechaHasta(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-4">
                <Button onClick={handleApplyMovFilters} className="bg-lab-primary-600 hover:bg-lab-primary-700">
                  Aplicar Filtros
                </Button>
                <Button onClick={handleClearMovFilters} variant="outline">
                  Limpiar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Movimientos Table */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Movimientos ({movimientos.length})</CardTitle>
              <CardDescription>Registro completo de operaciones de stock</CardDescription>
            </CardHeader>
            <CardContent>
              {movimientosLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-lab-neutral-200">
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Fecha</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Item</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Tipo</th>
                        <th className="text-center p-4 font-semibold text-lab-neutral-900">Cantidad</th>
                        <th className="text-center p-4 font-semibold text-lab-neutral-900">Stock Ant.</th>
                        <th className="text-center p-4 font-semibold text-lab-neutral-900">Stock Nuevo</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Motivo</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Realizado Por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((mov) => {
                        const tipoStyle = getTipoMovimientoStyle(mov.tipo_movimiento)
                        return (
                          <tr key={mov.codigo_movimiento} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                            <td className="p-4 text-sm text-lab-neutral-600">
                              {formatDateTime(mov.fecha_movimiento)}
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-lab-neutral-900">{mov.item.nombre}</div>
                              <div className="text-xs text-lab-neutral-600">{mov.item.codigo_interno}</div>
                            </td>
                            <td className="p-4">
                              <span className={`text-xs px-2 py-1 rounded ${tipoStyle.color} font-medium`}>
                                {tipoStyle.label}
                              </span>
                            </td>
                            <td className="p-4 text-center font-semibold text-lab-neutral-900">
                              {mov.cantidad} {mov.item.unidad_medida}
                            </td>
                            <td className="p-4 text-center text-lab-neutral-600">
                              {mov.stock_anterior}
                            </td>
                            <td className="p-4 text-center font-semibold text-lab-neutral-900">
                              {mov.stock_nuevo}
                            </td>
                            <td className="p-4 text-sm text-lab-neutral-600">
                              {mov.motivo || '-'}
                            </td>
                            <td className="p-4 text-sm text-lab-neutral-600">
                              {mov.usuario ? `${mov.usuario.nombres} ${mov.usuario.apellidos}` : 'Sistema'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {movimientos.length === 0 && (
                    <div className="text-center py-12 text-lab-neutral-500">
                      No se encontraron movimientos
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Movement Form Modal */}
          {showMovForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
                <div className="p-6 border-b border-lab-neutral-200">
                  <h2 className="text-2xl font-bold text-lab-neutral-900">
                    Registrar Movimiento de Stock
                  </h2>
                </div>

                <form onSubmit={handleMovSubmit} className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="mov_codigo_item" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Item *
                      </label>
                      <select
                        id="mov_codigo_item"
                        value={movFormData.codigo_item}
                        onChange={(e) => setMovFormData({ ...movFormData, codigo_item: e.target.value })}
                        required
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      >
                        <option value="">Seleccionar item...</option>
                        {items.map((item) => (
                          <option key={item.codigo_item} value={item.codigo_item}>
                            {item.codigo_interno} - {item.nombre} (Stock: {item.stock_actual} {item.unidad_medida})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="mov_tipo_movimiento" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Tipo de Movimiento *
                      </label>
                      <select
                        id="mov_tipo_movimiento"
                        value={movFormData.tipo_movimiento}
                        onChange={(e) => setMovFormData({ ...movFormData, tipo_movimiento: e.target.value })}
                        required
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      >
                        <option value="">Seleccionar tipo...</option>
                        {TIPO_MOVIMIENTO_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="mov_cantidad" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Cantidad *
                      </label>
                      <input
                        type="number"
                        id="mov_cantidad"
                        value={movFormData.cantidad}
                        onChange={(e) => setMovFormData({ ...movFormData, cantidad: e.target.value })}
                        min="1"
                        required
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label htmlFor="mov_motivo" className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Motivo / Observaciones
                      </label>
                      <textarea
                        id="mov_motivo"
                        value={movFormData.motivo}
                        onChange={(e) => setMovFormData({ ...movFormData, motivo: e.target.value })}
                        rows={3}
                        placeholder="Ej: Compra factura #123, Uso en examen, Merma por vencimiento..."
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-lab-neutral-200">
                    <Button type="button" onClick={handleCloseMovForm} variant="outline">
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-lab-primary-600 hover:bg-lab-primary-700">
                      Registrar Movimiento
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'alertas' && (
        <>
          {/* Estadísticas */}
          {estadisticas && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-lab-neutral-600">Total Alertas</div>
                    <div className="text-3xl font-bold text-lab-neutral-900 mt-2">{estadisticas.total}</div>
                  </CardContent>
                </Card>
                <Card className="border-lab-danger-200 bg-lab-danger-50">
                  <CardContent className="pt-6">
                    <div className="text-sm text-lab-danger-700 font-medium">Críticas</div>
                    <div className="text-3xl font-bold text-lab-danger-800 mt-2">{estadisticas.criticas}</div>
                  </CardContent>
                </Card>
                <Card className="border-lab-warning-200 bg-lab-warning-50">
                  <CardContent className="pt-6">
                    <div className="text-sm text-lab-warning-700 font-medium">Altas</div>
                    <div className="text-3xl font-bold text-lab-warning-800 mt-2">{estadisticas.altas}</div>
                  </CardContent>
                </Card>
                <Card className="border-lab-primary-200 bg-lab-primary-50">
                  <CardContent className="pt-6">
                    <div className="text-sm text-lab-primary-700 font-medium">Medias</div>
                    <div className="text-3xl font-bold text-lab-primary-800 mt-2">{estadisticas.medias}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-lab-neutral-600">Bajas</div>
                    <div className="text-3xl font-bold text-lab-neutral-700 mt-2">{estadisticas.bajas}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-lab-neutral-600">Sin Stock</div>
                    <div className="text-2xl font-bold text-lab-danger-600 mt-2">
                      {estadisticas.por_tipo.stock_critico}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-lab-neutral-600">Stock Bajo</div>
                    <div className="text-2xl font-bold text-lab-warning-600 mt-2">
                      {estadisticas.por_tipo.stock_bajo}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-lab-neutral-600">Vencidos</div>
                    <div className="text-2xl font-bold text-lab-danger-600 mt-2">
                      {estadisticas.por_tipo.vencidos}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-lab-neutral-600">Por Vencer</div>
                    <div className="text-2xl font-bold text-lab-warning-600 mt-2">
                      {estadisticas.por_tipo.proximos_vencer}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Tipo de Alerta
                  </label>
                  <select
                    value={filterAlertTipo}
                    onChange={(e) => setFilterAlertTipo(e.target.value)}
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                  >
                    <option value="">Todos los tipos</option>
                    <option value="STOCK_CRITICO">Sin Stock</option>
                    <option value="STOCK_BAJO">Stock Bajo</option>
                    <option value="VENCIDO">Vencido</option>
                    <option value="PROXIMO_VENCER">Por Vencer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={filterAlertPrioridad}
                    onChange={(e) => setFilterAlertPrioridad(e.target.value)}
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                  >
                    <option value="">Todas las prioridades</option>
                    <option value="CRITICA">Crítica</option>
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Media</option>
                    <option value="BAJA">Baja</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <div className="flex space-x-3">
                    <Button onClick={handleApplyAlertFilters} className="bg-lab-primary-600 hover:bg-lab-primary-700">
                      Aplicar
                    </Button>
                    <Button onClick={handleClearAlertFilters} variant="outline">
                      Limpiar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alertas Table */}
          <Card>
            <CardHeader>
              <CardTitle>Alertas Activas ({filteredAlertas.length})</CardTitle>
              <CardDescription>Productos que requieren atención inmediata</CardDescription>
            </CardHeader>
            <CardContent>
              {alertasLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-lab-neutral-200">
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Prioridad</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Tipo</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Producto</th>
                        <th className="text-center p-4 font-semibold text-lab-neutral-900">Stock</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Mensaje</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Lote</th>
                        <th className="text-center p-4 font-semibold text-lab-neutral-900">Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlertas.map((alerta, index) => {
                        const prioridadStyle = PRIORIDAD_CONFIG[alerta.prioridad]
                        const tipoStyle = TIPO_ALERTA_CONFIG[alerta.tipo_alerta]

                        return (
                          <tr key={index} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                            <td className="p-4">
                              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${prioridadStyle.color}`}>
                                {prioridadStyle.label}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`text-xs px-2 py-1 rounded ${tipoStyle.color}`}>
                                {tipoStyle.label}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-lab-neutral-900">{alerta.nombre}</div>
                              <div className="text-xs text-lab-neutral-600">{alerta.codigo_interno}</div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="font-semibold text-lab-neutral-900">
                                {alerta.stock_actual} {alerta.unidad_medida}
                              </div>
                              <div className="text-xs text-lab-neutral-600">
                                Min: {alerta.stock_minimo}
                              </div>
                            </td>
                            <td className="p-4 text-sm text-lab-neutral-700">
                              {alerta.mensaje}
                            </td>
                            <td className="p-4 text-sm text-lab-neutral-600">
                              {alerta.numero_lote || '-'}
                            </td>
                            <td className="p-4 text-center text-sm">
                              {alerta.fecha_vencimiento ? (
                                <div>
                                  <div className="text-lab-neutral-900">
                                    {formatDate(alerta.fecha_vencimiento)}
                                  </div>
                                  {alerta.dias_hasta_vencimiento !== undefined && (
                                    <div className={`text-xs ${
                                      alerta.dias_hasta_vencimiento < 0
                                        ? 'text-lab-danger-600 font-semibold'
                                        : alerta.dias_hasta_vencimiento <= 7
                                        ? 'text-lab-warning-600 font-semibold'
                                        : 'text-lab-neutral-600'
                                    }`}>
                                      {alerta.dias_hasta_vencimiento < 0
                                        ? `Vencido hace ${Math.abs(alerta.dias_hasta_vencimiento)} días`
                                        : `${alerta.dias_hasta_vencimiento} días`
                                      }
                                    </div>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {filteredAlertas.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-xl font-semibold text-lab-success-600 mb-2">
                        No hay alertas activas
                      </div>
                      <div className="text-lab-neutral-600">
                        Todo el inventario está en niveles óptimos
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ==================== LOTES TAB ==================== */}
      {activeTab === 'lotes' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-lab-primary-100">
                    <svg className="w-6 h-6 text-lab-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-lab-neutral-600">Total Lotes</div>
                    <div className="text-2xl font-bold text-lab-neutral-900">{lotes.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-lab-success-100">
                    <svg className="w-6 h-6 text-lab-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-lab-neutral-600">Vigentes</div>
                    <div className="text-2xl font-bold text-lab-success-600">
                      {lotes.filter(l => getLoteStatus(l).label === 'Vigente').length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-lab-warning-100">
                    <svg className="w-6 h-6 text-lab-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-lab-neutral-600">Por Vencer</div>
                    <div className="text-2xl font-bold text-lab-warning-600">
                      {lotes.filter(l => getLoteStatus(l).label === 'Por vencer').length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-lab-danger-100">
                    <svg className="w-6 h-6 text-lab-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-lab-neutral-600">Vencidos</div>
                    <div className="text-2xl font-bold text-lab-danger-600">
                      {lotes.filter(l => getLoteStatus(l).label === 'Vencido').length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Item
                  </label>
                  <select
                    value={filterLoteItem}
                    onChange={(e) => setFilterLoteItem(e.target.value)}
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                  >
                    <option value="">Todos los items</option>
                    {items.map((item) => (
                      <option key={item.codigo_item} value={item.codigo_item}>
                        {item.codigo_interno} - {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                    Estado de Vencimiento
                  </label>
                  <select
                    value={filterLoteVencimiento}
                    onChange={(e) => setFilterLoteVencimiento(e.target.value as any)}
                    className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                  >
                    <option value="todos">Todos</option>
                    <option value="vigentes">Vigentes</option>
                    <option value="por_vencer">Por Vencer (30 días)</option>
                    <option value="vencidos">Vencidos</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button onClick={loadLotes} className="bg-lab-primary-600 hover:bg-lab-primary-700">
                    Actualizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lotes Table */}
          <Card>
            <CardHeader>
              <CardTitle>Lotes Registrados ({filteredLotes.length})</CardTitle>
              <CardDescription>Control de lotes con fecha de vencimiento y trazabilidad</CardDescription>
            </CardHeader>
            <CardContent>
              {lotesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-lab-neutral-200">
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Lote</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Item</th>
                        <th className="text-center p-4 font-semibold text-lab-neutral-900">Cantidad</th>
                        <th className="text-center p-4 font-semibold text-lab-neutral-900">Vencimiento</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Estado</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Proveedor</th>
                        <th className="text-right p-4 font-semibold text-lab-neutral-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLotes.map((lote) => {
                        const status = getLoteStatus(lote)
                        return (
                          <tr key={lote.codigo_lote} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                            <td className="p-4">
                              <div className="font-mono font-semibold text-lab-neutral-900">{lote.numero_lote}</div>
                              <div className="text-xs text-lab-neutral-600">
                                Reg: {formatDate(lote.fecha_registro)}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-lab-neutral-900">{lote.item?.nombre || '-'}</div>
                              <div className="text-xs text-lab-neutral-600">{lote.item?.codigo_interno}</div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="font-semibold text-lab-neutral-900">
                                {lote.cantidad_actual} / {lote.cantidad_inicial}
                              </div>
                              <div className="text-xs text-lab-neutral-600">{lote.item?.unidad_medida}</div>
                            </td>
                            <td className="p-4 text-center">
                              {lote.fecha_vencimiento ? (
                                <div>
                                  <div className="text-sm text-lab-neutral-900">{formatDate(lote.fecha_vencimiento)}</div>
                                  {'days' in status && (
                                    <div className={`text-xs ${status.days && status.days < 0 ? 'text-lab-danger-600' : 'text-lab-neutral-600'}`}>
                                      {status.days && status.days < 0
                                        ? `Hace ${Math.abs(status.days)} días`
                                        : `En ${status.days} días`}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-lab-neutral-500">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`text-xs px-2 py-1 rounded ${status.color}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className="p-4 text-sm text-lab-neutral-600">
                              {lote.proveedor || '-'}
                            </td>
                            <td className="p-4 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenLoteForm(lote)}
                              >
                                Editar
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {filteredLotes.length === 0 && (
                    <div className="text-center py-12 text-lab-neutral-500">
                      No se encontraron lotes con los filtros seleccionados
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lote Form Modal */}
          {showLoteForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
                <div className="p-6 border-b border-lab-neutral-200">
                  <h2 className="text-2xl font-bold text-lab-neutral-900">
                    {editingLote ? 'Editar Lote' : 'Registrar Nuevo Lote'}
                  </h2>
                  <p className="text-sm text-lab-neutral-600 mt-1">
                    Registre un nuevo lote de productos del proveedor
                  </p>
                </div>

                <form onSubmit={handleLoteSubmit} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Item *
                      </label>
                      <select
                        value={loteFormData.codigo_item}
                        onChange={(e) => setLoteFormData({ ...loteFormData, codigo_item: e.target.value })}
                        required
                        disabled={!!editingLote}
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2 disabled:bg-lab-neutral-100"
                      >
                        <option value="">Seleccionar item...</option>
                        {items.map((item) => (
                          <option key={item.codigo_item} value={item.codigo_item}>
                            {item.codigo_interno} - {item.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Número de Lote *
                      </label>
                      <input
                        type="text"
                        value={loteFormData.numero_lote}
                        onChange={(e) => setLoteFormData({ ...loteFormData, numero_lote: e.target.value })}
                        required
                        placeholder="Ej: LOT-2024-001"
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Cantidad Inicial *
                      </label>
                      <input
                        type="number"
                        value={loteFormData.cantidad_inicial}
                        onChange={(e) => setLoteFormData({ ...loteFormData, cantidad_inicial: e.target.value })}
                        required
                        min="1"
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Costo Unitario (USD)
                      </label>
                      <input
                        type="number"
                        value={loteFormData.costo_unitario}
                        onChange={(e) => setLoteFormData({ ...loteFormData, costo_unitario: e.target.value })}
                        step="0.01"
                        min="0"
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Fecha de Fabricación
                      </label>
                      <input
                        type="date"
                        value={loteFormData.fecha_fabricacion}
                        onChange={(e) => setLoteFormData({ ...loteFormData, fecha_fabricacion: e.target.value })}
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Fecha de Vencimiento
                      </label>
                      <input
                        type="date"
                        value={loteFormData.fecha_vencimiento}
                        onChange={(e) => setLoteFormData({ ...loteFormData, fecha_vencimiento: e.target.value })}
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Proveedor
                      </label>
                      <select
                        value={loteFormData.codigo_proveedor}
                        onChange={(e) => setLoteFormData({ ...loteFormData, codigo_proveedor: e.target.value })}
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      >
                        <option value="">Seleccionar proveedor...</option>
                        {proveedores.map((prov) => (
                          <option key={prov.codigo_proveedor} value={prov.codigo_proveedor}>
                            {prov.razon_social}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-lab-neutral-200">
                    <Button type="button" onClick={handleCloseLoteForm} variant="outline">
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-lab-primary-600 hover:bg-lab-primary-700">
                      {editingLote ? 'Actualizar' : 'Registrar'} Lote
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== KARDEX TAB ==================== */}
      {activeTab === 'kardex' && (
        <>
          {/* View Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex space-x-2">
              <Button
                variant={kardexViewMode === 'global' ? 'default' : 'outline'}
                onClick={() => { setKardexViewMode('global'); loadKardexGlobal(); }}
                className={kardexViewMode === 'global' ? 'bg-lab-primary-600' : ''}
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Resumen Global
              </Button>
              <Button
                variant={kardexViewMode === 'individual' ? 'default' : 'outline'}
                onClick={() => setKardexViewMode('individual')}
                className={kardexViewMode === 'individual' ? 'bg-lab-primary-600' : ''}
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Por Item
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <div>
                <input
                  type="date"
                  value={kardexFechaDesde}
                  onChange={(e) => setKardexFechaDesde(e.target.value)}
                  className="rounded-md border border-lab-neutral-300 px-3 py-1.5 text-sm"
                  placeholder="Desde"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={kardexFechaHasta}
                  onChange={(e) => setKardexFechaHasta(e.target.value)}
                  className="rounded-md border border-lab-neutral-300 px-3 py-1.5 text-sm"
                  placeholder="Hasta"
                />
              </div>
              <Button onClick={kardexViewMode === 'global' ? loadKardexGlobal : loadKardex} size="sm">
                Actualizar
              </Button>
            </div>
          </div>

          {/* GLOBAL VIEW */}
          {kardexViewMode === 'global' && (
            <>
              {kardexGlobalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
                </div>
              ) : kardexGlobal ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                      <CardContent className="pt-4 pb-3">
                        <div className="text-2xl font-bold text-blue-700">{kardexGlobal.resumen.total_items}</div>
                        <div className="text-xs text-blue-600">Items Activos</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100">
                      <CardContent className="pt-4 pb-3">
                        <div className="text-2xl font-bold text-green-700">+{kardexGlobal.resumen.total_entradas}</div>
                        <div className="text-xs text-green-600">Total Entradas</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-50 to-red-100">
                      <CardContent className="pt-4 pb-3">
                        <div className="text-2xl font-bold text-red-700">-{kardexGlobal.resumen.total_salidas}</div>
                        <div className="text-xs text-red-600">Total Salidas</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
                      <CardContent className="pt-4 pb-3">
                        <div className="text-2xl font-bold text-yellow-700">{kardexGlobal.resumen.items_bajos}</div>
                        <div className="text-xs text-yellow-600">Stock Bajo</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                      <CardContent className="pt-4 pb-3">
                        <div className="text-2xl font-bold text-orange-700">{kardexGlobal.resumen.items_criticos}</div>
                        <div className="text-xs text-orange-600">Críticos</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-100 to-red-200">
                      <CardContent className="pt-4 pb-3">
                        <div className="text-2xl font-bold text-red-800">{kardexGlobal.resumen.items_agotados}</div>
                        <div className="text-xs text-red-700">Agotados</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                      <CardContent className="pt-4 pb-3">
                        <div className="text-lg font-bold text-purple-700">
                          {formatCurrency(kardexGlobal.resumen.valor_total_inventario)}
                        </div>
                        <div className="text-xs text-purple-600">Valor Total</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Global Kardex Table */}
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div>
                        <CardTitle>Kardex Global de Inventario</CardTitle>
                        <CardDescription>Resumen de todos los items con sus movimientos y estado de stock</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={openGenerarPedidoModal}
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Generar Pedido
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-lab-neutral-200 bg-lab-neutral-50">
                              <th className="text-left p-3 font-semibold text-lab-neutral-900">Código</th>
                              <th className="text-left p-3 font-semibold text-lab-neutral-900">Item</th>
                              <th className="text-left p-3 font-semibold text-lab-neutral-900">Categoría</th>
                              <th className="text-center p-3 font-semibold text-lab-neutral-900">Stock</th>
                              <th className="text-center p-3 font-semibold text-lab-neutral-900">Entradas</th>
                              <th className="text-center p-3 font-semibold text-lab-neutral-900">Salidas</th>
                              <th className="text-right p-3 font-semibold text-lab-neutral-900">Valor</th>
                              <th className="text-center p-3 font-semibold text-lab-neutral-900">Estado</th>
                              <th className="text-left p-3 font-semibold text-lab-neutral-900">Último Mov.</th>
                              <th className="text-center p-3 font-semibold text-lab-neutral-900">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {kardexGlobal.items.map((item) => (
                              <tr key={item.codigo_item} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                                <td className="p-3 font-mono text-sm">{item.codigo_interno}</td>
                                <td className="p-3 font-medium">{item.nombre}</td>
                                <td className="p-3 text-sm text-lab-neutral-600">{item.categoria}</td>
                                <td className="p-3 text-center">
                                  <span className="font-semibold">{item.stock_actual}</span>
                                  <span className="text-xs text-lab-neutral-500 ml-1">{item.unidad_medida}</span>
                                </td>
                                <td className="p-3 text-center text-green-600 font-medium">+{item.total_entradas}</td>
                                <td className="p-3 text-center text-red-600 font-medium">-{item.total_salidas}</td>
                                <td className="p-3 text-right font-mono text-sm">
                                  {formatCurrency(item.valor_inventario)}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    item.estado_stock === 'NORMAL' ? 'bg-green-100 text-green-700' :
                                    item.estado_stock === 'BAJO' ? 'bg-yellow-100 text-yellow-700' :
                                    item.estado_stock === 'CRITICO' ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {item.estado_stock}
                                  </span>
                                </td>
                                <td className="p-3 text-sm text-lab-neutral-600">
                                  {item.ultimo_movimiento ? (
                                    <span title={item.ultimo_movimiento.tipo_movimiento}>
                                      {new Date(item.ultimo_movimiento.fecha_movimiento).toLocaleDateString('es-EC')}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td className="p-3 text-center">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewItemKardex(item.codigo_item)}
                                    className="text-xs"
                                  >
                                    Ver Detalle
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-lab-neutral-500">
                      <p>Cargando datos del kardex...</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* INDIVIDUAL VIEW */}
          {kardexViewMode === 'individual' && (
            <>
              {/* Back Button and Item Selector */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={handleBackToGlobal} size="sm">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Volver al Resumen
                    </Button>
                    <div className="flex-1">
                      <select
                        value={selectedItemKardex}
                        onChange={(e) => setSelectedItemKardex(e.target.value)}
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      >
                        <option value="">Seleccionar item...</option>
                        {items.map((item) => (
                          <option key={item.codigo_item} value={item.codigo_item}>
                            {item.codigo_interno} - {item.nombre} (Stock: {item.stock_actual})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button onClick={loadKardex} className="bg-lab-primary-600 hover:bg-lab-primary-700">
                      Consultar
                    </Button>
                  </div>
                </CardContent>
              </Card>

          {/* Kardex Results */}
          {kardexLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
            </div>
          ) : kardexData ? (
            <>
              {/* Item Info & Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Información del Item</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-lab-neutral-600">Código:</span>
                        <span className="font-mono font-semibold">{kardexData.item.codigo_interno}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-lab-neutral-600">Nombre:</span>
                        <span className="font-semibold">{kardexData.item.nombre}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-lab-neutral-600">Stock Actual:</span>
                        <span className="font-semibold text-lg text-lab-primary-600">
                          {kardexData.item.stock_actual} {kardexData.item.unidad_medida}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Resumen de Movimientos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-lab-success-600">{kardexData.totales?.entradas || 0}</div>
                        <div className="text-sm text-lab-neutral-600">Entradas</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-lab-danger-600">{kardexData.totales?.salidas || 0}</div>
                        <div className="text-sm text-lab-neutral-600">Salidas</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-lab-warning-600">
                          {(kardexData.totales?.ajustes_positivos || 0) + (kardexData.totales?.ajustes_negativos || 0)}
                        </div>
                        <div className="text-sm text-lab-neutral-600">Ajustes</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-lab-primary-600">{kardexData.resumen?.total_movimientos || 0}</div>
                        <div className="text-sm text-lab-neutral-600">Total</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Kardex Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Historial de Movimientos ({kardexData.movimientos.length})</CardTitle>
                  <CardDescription>Registro cronológico de todas las operaciones</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-lab-neutral-200">
                          <th className="text-left p-4 font-semibold text-lab-neutral-900">Fecha</th>
                          <th className="text-left p-4 font-semibold text-lab-neutral-900">Tipo</th>
                          <th className="text-center p-4 font-semibold text-lab-neutral-900">Cantidad</th>
                          <th className="text-center p-4 font-semibold text-lab-neutral-900">Stock Ant.</th>
                          <th className="text-center p-4 font-semibold text-lab-neutral-900">Stock Nuevo</th>
                          <th className="text-left p-4 font-semibold text-lab-neutral-900">Lote</th>
                          <th className="text-left p-4 font-semibold text-lab-neutral-900">Motivo</th>
                          <th className="text-left p-4 font-semibold text-lab-neutral-900">Usuario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kardexData.movimientos.map((mov) => {
                          const tipoStyle = getTipoMovimientoStyle(mov.tipo_movimiento)
                          return (
                            <tr key={mov.codigo_movimiento} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                              <td className="p-4 text-sm text-lab-neutral-600">
                                {formatDateTime(mov.fecha_movimiento)}
                              </td>
                              <td className="p-4">
                                <span className={`text-xs px-2 py-1 rounded ${tipoStyle.color} font-medium`}>
                                  {tipoStyle.icon} {tipoStyle.label}
                                </span>
                              </td>
                              <td className="p-4 text-center font-semibold">
                                <span className={
                                  mov.tipo_movimiento === 'ENTRADA' || mov.tipo_movimiento === 'AJUSTE_POSITIVO'
                                    ? 'text-lab-success-600'
                                    : 'text-lab-danger-600'
                                }>
                                  {mov.tipo_movimiento === 'ENTRADA' || mov.tipo_movimiento === 'AJUSTE_POSITIVO' ? '+' : '-'}
                                  {mov.cantidad}
                                </span>
                              </td>
                              <td className="p-4 text-center text-lab-neutral-600">{mov.stock_anterior}</td>
                              <td className="p-4 text-center font-semibold text-lab-neutral-900">{mov.stock_nuevo}</td>
                              <td className="p-4 text-sm text-lab-neutral-600 font-mono">
                                {mov.lote?.numero_lote || '-'}
                              </td>
                              <td className="p-4 text-sm text-lab-neutral-700 max-w-xs truncate">
                                {mov.motivo || '-'}
                              </td>
                              <td className="p-4 text-sm text-lab-neutral-600">
                                {mov.usuario ? `${mov.usuario.nombres} ${mov.usuario.apellidos}` : 'Sistema'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {kardexData.movimientos.length === 0 && (
                      <div className="text-center py-12 text-lab-neutral-500">
                        No hay movimientos registrados para este item
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-lab-neutral-500">
                  <svg className="mx-auto h-12 w-12 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <p className="mt-2">Seleccione un item y haga clic en "Consultar" para ver el historial</p>
                </div>
              </CardContent>
            </Card>
          )}
            </>
          )}
        </>
      )}

      {/* ==================== CATEGORIAS TAB ==================== */}
      {activeTab === 'categorias' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Categorías de Items ({categorias.length})</CardTitle>
              <CardDescription>Organiza los items del inventario por categoría</CardDescription>
            </CardHeader>
            <CardContent>
              {categoriasLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-lab-neutral-200">
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">ID</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Nombre</th>
                        <th className="text-left p-4 font-semibold text-lab-neutral-900">Descripción</th>
                        <th className="text-center p-4 font-semibold text-lab-neutral-900">Items</th>
                        <th className="text-center p-4 font-semibold text-lab-neutral-900">Estado</th>
                        <th className="text-right p-4 font-semibold text-lab-neutral-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorias.map((cat) => (
                        <tr key={cat.codigo_categoria} className="border-b border-lab-neutral-100 hover:bg-lab-neutral-50">
                          <td className="p-4 text-sm font-mono text-lab-neutral-600">{cat.codigo_categoria}</td>
                          <td className="p-4 font-medium text-lab-neutral-900">{cat.nombre}</td>
                          <td className="p-4 text-sm text-lab-neutral-600 max-w-xs truncate">
                            {cat.descripcion || <span className="text-lab-neutral-400">-</span>}
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-sm font-semibold text-lab-primary-600">
                              {cat._count?.items || 0}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`text-xs px-2 py-1 rounded ${
                              cat.activo
                                ? 'bg-lab-success-100 text-lab-success-800'
                                : 'bg-lab-neutral-100 text-lab-neutral-600'
                            }`}>
                              {cat.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenCategoriaForm(cat)}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteCategoria(cat.codigo_categoria)}
                              className="text-lab-danger-600 hover:text-lab-danger-700 hover:bg-lab-danger-50"
                            >
                              Eliminar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {categorias.length === 0 && (
                    <div className="text-center py-12 text-lab-neutral-500">
                      No hay categorías registradas. Cree la primera categoría para organizar su inventario.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Categoria Form Modal */}
          {showCategoriaForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="p-6 border-b border-lab-neutral-200">
                  <h2 className="text-2xl font-bold text-lab-neutral-900">
                    {editingCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
                  </h2>
                </div>

                <form onSubmit={handleCategoriaSubmit} className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={categoriaFormData.nombre}
                        onChange={(e) => setCategoriaFormData({ ...categoriaFormData, nombre: e.target.value })}
                        required
                        placeholder="Ej: Reactivos, Materiales, Equipos..."
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-lab-neutral-700 mb-1">
                        Descripción
                      </label>
                      <textarea
                        value={categoriaFormData.descripcion}
                        onChange={(e) => setCategoriaFormData({ ...categoriaFormData, descripcion: e.target.value })}
                        rows={3}
                        placeholder="Descripción opcional de la categoría..."
                        className="block w-full rounded-md border border-lab-neutral-300 px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-lab-neutral-200">
                    <Button type="button" onClick={handleCloseCategoriaForm} variant="outline">
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-lab-primary-600 hover:bg-lab-primary-700">
                      {editingCategoria ? 'Actualizar' : 'Crear'} Categoría
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== QUICK KARDEX MODAL ==================== */}
      {showQuickKardex && quickKardexItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-lab-neutral-200 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-lab-neutral-900">Kardex del Item</h2>
                <p className="text-sm text-lab-neutral-600 mt-1">
                  <span className="font-mono">{quickKardexItem.codigo_interno}</span> - {quickKardexItem.nombre}
                </p>
              </div>
              <Button variant="outline" onClick={closeQuickKardex}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {quickKardexLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
                </div>
              ) : quickKardexData ? (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-lab-neutral-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-lab-primary-600">{quickKardexData.stock_actual}</div>
                      <div className="text-sm text-lab-neutral-600">Stock Actual</div>
                    </div>
                    <div className="bg-lab-success-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-lab-success-600">{quickKardexData.totales?.entradas || 0}</div>
                      <div className="text-sm text-lab-neutral-600">Entradas</div>
                    </div>
                    <div className="bg-lab-danger-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-lab-danger-600">{quickKardexData.totales?.salidas || 0}</div>
                      <div className="text-sm text-lab-neutral-600">Salidas</div>
                    </div>
                    <div className="bg-lab-warning-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-lab-warning-600">
                        {(quickKardexData.totales?.ajustes_positivos || 0) + (quickKardexData.totales?.ajustes_negativos || 0)}
                      </div>
                      <div className="text-sm text-lab-neutral-600">Ajustes</div>
                    </div>
                  </div>

                  {/* Movements Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-lab-neutral-200">
                          <th className="text-left p-3 font-semibold text-lab-neutral-900">Fecha</th>
                          <th className="text-left p-3 font-semibold text-lab-neutral-900">Tipo</th>
                          <th className="text-center p-3 font-semibold text-lab-neutral-900">Cant.</th>
                          <th className="text-center p-3 font-semibold text-lab-neutral-900">Stock</th>
                          <th className="text-left p-3 font-semibold text-lab-neutral-900">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickKardexData.movimientos.slice(0, 15).map((mov) => {
                          const tipoStyle = getTipoMovimientoStyle(mov.tipo_movimiento)
                          return (
                            <tr key={mov.codigo_movimiento} className="border-b border-lab-neutral-100">
                              <td className="p-3 text-lab-neutral-600">{formatDateTime(mov.fecha_movimiento)}</td>
                              <td className="p-3">
                                <span className={`text-xs px-2 py-1 rounded ${tipoStyle.color}`}>
                                  {tipoStyle.label}
                                </span>
                              </td>
                              <td className="p-3 text-center font-semibold">
                                <span className={
                                  mov.tipo_movimiento === 'ENTRADA' || mov.tipo_movimiento === 'AJUSTE_POSITIVO'
                                    ? 'text-lab-success-600'
                                    : 'text-lab-danger-600'
                                }>
                                  {mov.tipo_movimiento === 'ENTRADA' || mov.tipo_movimiento === 'AJUSTE_POSITIVO' ? '+' : '-'}
                                  {mov.cantidad}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className="text-lab-neutral-500">{mov.stock_anterior}</span>
                                <span className="mx-1">→</span>
                                <span className="font-semibold">{mov.stock_nuevo}</span>
                              </td>
                              <td className="p-3 text-lab-neutral-600 truncate max-w-xs">{mov.motivo || '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {quickKardexData.movimientos.length === 0 && (
                      <div className="text-center py-8 text-lab-neutral-500">
                        No hay movimientos registrados para este item
                      </div>
                    )}

                    {quickKardexData.movimientos.length > 15 && (
                      <div className="text-center py-4 text-sm text-lab-neutral-500">
                        Mostrando los últimos 15 movimientos.
                        <button
                          onClick={() => { closeQuickKardex(); setActiveTab('kardex'); setSelectedItemKardex(quickKardexItem.codigo_item.toString()); }}
                          className="ml-2 text-lab-primary-600 hover:underline"
                        >
                          Ver historial completo →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-lab-neutral-500">
                  Error al cargar el kardex
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== OCR FACTURA MODAL ==================== */}
      {showOcrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-lab-neutral-200 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-lab-neutral-900">Escanear Factura de Proveedor</h2>
                <p className="text-sm text-lab-neutral-600 mt-1">
                  Suba una imagen de factura para extraer los productos y crear una orden de compra
                </p>
              </div>
              <Button variant="outline" onClick={closeOcrModal}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* File Upload Area */}
              {!ocrResult && (
                <div className="mb-6">
                  <label className="block">
                    <div className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      ocrLoading ? 'border-lab-primary-300 bg-lab-primary-50' : 'border-lab-neutral-300 hover:border-lab-primary-500 hover:bg-lab-neutral-50'
                    }`}>
                      {ocrLoading ? (
                        <div className="flex flex-col items-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600 mb-4"></div>
                          <p className="text-lab-primary-600 font-medium">Procesando imagen con IA...</p>
                          <p className="text-sm text-lab-neutral-500 mt-1">Esto puede tomar unos segundos</p>
                        </div>
                      ) : (
                        <>
                          <svg className="mx-auto h-16 w-16 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="mt-4 text-lg font-medium text-lab-neutral-700">
                            Haga clic para subir una imagen de factura
                          </p>
                          <p className="mt-2 text-sm text-lab-neutral-500">
                            Formatos: JPG, PNG, PDF (máx. 10MB)
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                      onChange={handleOcrFileSelect}
                      disabled={ocrLoading}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Preview and Results */}
              {ocrResult && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Image Preview */}
                  <div>
                    <h3 className="font-semibold text-lab-neutral-900 mb-3">Imagen de Factura</h3>
                    {ocrPreviewUrl && (
                      <div
                        className="border rounded-lg overflow-hidden bg-lab-neutral-50 relative group cursor-pointer"
                        onClick={() => setOcrImageZoom(true)}
                      >
                        <img src={ocrPreviewUrl} alt="Factura" className="w-full h-auto max-h-80 object-contain" />
                        {/* Overlay con icono de zoom */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-3 shadow-lg">
                            <svg className="w-6 h-6 text-lab-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-xs text-center text-lab-neutral-500 py-1 bg-lab-neutral-100">
                          Click para ampliar
                        </p>
                      </div>
                    )}

                    {/* Proveedor Info */}
                    {ocrResult.proveedor && (
                      <div className="mt-4 p-4 bg-lab-neutral-50 rounded-lg">
                        <h4 className="font-medium text-lab-neutral-900 mb-2">Datos del Proveedor (detectados)</h4>
                        <div className="text-sm text-lab-neutral-600 space-y-1">
                          {ocrResult.proveedor.razon_social && <p><strong>Proveedor:</strong> {ocrResult.proveedor.razon_social}</p>}
                          {ocrResult.proveedor.ruc && <p><strong>RUC:</strong> {ocrResult.proveedor.ruc}</p>}
                          {ocrResult.factura?.numero && <p><strong>Factura N°:</strong> {ocrResult.factura.numero}</p>}
                          {ocrResult.factura?.fecha && <p><strong>Fecha:</strong> {ocrResult.factura.fecha}</p>}
                          {ocrResult.factura?.total && <p><strong>Total:</strong> {formatCurrency(ocrResult.factura.total)}</p>}
                        </div>
                      </div>
                    )}

                    {/* Button to upload another */}
                    <div className="mt-4">
                      <label className="cursor-pointer">
                        <span className="text-sm text-lab-primary-600 hover:underline">
                          Subir otra imagen
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                          onChange={handleOcrFileSelect}
                          disabled={ocrLoading}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Extracted Items */}
                  <div>
                    <h3 className="font-semibold text-lab-neutral-900 mb-3">
                      Items Detectados ({ocrSelectedItems.length})
                    </h3>

                    {ocrSelectedItems.length === 0 ? (
                      <div className="text-center py-8 text-lab-neutral-500 border rounded-lg">
                        No se detectaron items en la factura
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {ocrSelectedItems.map((item, index) => (
                          <div key={index} className={`border rounded-lg p-4 ${item.selected ? 'border-lab-primary-300 bg-lab-primary-50' : 'border-lab-neutral-200'}`}>
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={(e) => handleOcrItemChange(index, 'selected', e.target.checked)}
                                className="mt-1 h-5 w-5"
                              />
                              <div className="flex-1 space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-lab-neutral-900">{item.descripcion}</p>
                                    {/* Indicador de match automático */}
                                    {(item.matchConfidence ?? 0) >= 50 ? (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        item.matchConfidence! >= 80 ? 'bg-green-100 text-green-800' :
                                        item.matchConfidence! >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-orange-100 text-orange-800'
                                      }`}>
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          {item.matchConfidence! >= 80 ? (
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          ) : (
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                          )}
                                        </svg>
                                        {item.matchConfidence}% match
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Sin coincidencia
                                      </span>
                                    )}
                                  </div>
                                  {item.selected && item.cantidad > 0 && (
                                    <span className="text-sm font-semibold text-lab-primary-700 whitespace-nowrap">
                                      Subtotal: {formatCurrency(item.cantidad * (item.precio_unitario || 0))}
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                  <div>
                                    <label className="text-lab-neutral-600">Cantidad: *</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.cantidad}
                                      onChange={(e) => handleOcrItemChange(index, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                                      className={`w-full border rounded px-2 py-1 mt-1 ${item.selected && item.cantidad < 1 ? 'border-red-500' : ''}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-lab-neutral-600">Precio Unit.:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={item.precio_unitario || 0}
                                      onChange={(e) => handleOcrItemChange(index, 'precio_unitario', Math.max(0, parseFloat(e.target.value) || 0))}
                                      className="w-full border rounded px-2 py-1 mt-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-lab-neutral-600">N° Lote:</label>
                                    <input
                                      type="text"
                                      value={item.numero_lote}
                                      onChange={(e) => handleOcrItemChange(index, 'numero_lote', e.target.value)}
                                      className="w-full border rounded px-2 py-1 mt-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-lab-neutral-600">Vencimiento:</label>
                                    <input
                                      type="date"
                                      value={item.fecha_vencimiento}
                                      onChange={(e) => handleOcrItemChange(index, 'fecha_vencimiento', e.target.value)}
                                      className="w-full border rounded px-2 py-1 mt-1"
                                    />
                                  </div>
                                  <div className="col-span-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <label className="text-lab-neutral-600">Asignar a Item: *</label>
                                      {(item.matchConfidence ?? 0) >= 80 && item.codigo_item ? (
                                        <span className="text-xs text-green-600 flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                          Auto-asignado
                                        </span>
                                      ) : !item.codigo_item && (
                                        <span className="text-xs text-amber-600 flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                          </svg>
                                          Seleccione manualmente
                                        </span>
                                      )}
                                    </div>
                                    <select
                                      value={item.codigo_item}
                                      onChange={(e) => handleOcrItemChange(index, 'codigo_item', e.target.value)}
                                      className={`w-full border rounded px-2 py-1 mt-1 ${
                                        item.selected && !item.codigo_item ? 'border-amber-500 bg-amber-50' :
                                        (item.matchConfidence ?? 0) >= 80 && item.codigo_item ? 'border-green-500 bg-green-50' :
                                        item.codigo_item ? 'border-blue-500 bg-blue-50' : ''
                                      }`}
                                    >
                                      <option value="">-- Seleccionar item del inventario --</option>
                                      {items.map((inv) => (
                                        <option key={inv.codigo_item} value={inv.codigo_item}>
                                          {inv.codigo_interno} - {inv.nombre}
                                        </option>
                                      ))}
                                    </select>
                                    {item.selected && !item.codigo_item && (
                                      <p className="text-xs text-amber-600 mt-1">
                                        ⚠️ Seleccione el item del inventario que corresponde a "{item.descripcion}"
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {ocrResult && ocrSelectedItems.length > 0 && (
              <div className="p-6 border-t border-lab-neutral-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Selector de Proveedor */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-lab-neutral-700 whitespace-nowrap">
                      Proveedor para la orden:
                    </label>
                    <select
                      value={ocrSelectedProveedor}
                      onChange={(e) => setOcrSelectedProveedor(e.target.value)}
                      className="flex-1 min-w-[200px] rounded-md border-lab-neutral-300 text-sm"
                    >
                      <option value="">Seleccionar proveedor...</option>
                      {proveedores.filter(p => p.activo !== false).map((prov) => (
                        <option key={prov.codigo_proveedor} value={prov.codigo_proveedor}>
                          {prov.razon_social}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Info y Botones */}
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-lab-neutral-600">
                      {ocrSelectedItems.filter(i => i.selected && i.codigo_item).length} items listos
                    </div>
                    {/* Total calculado desde items seleccionados */}
                    <div className="text-sm font-semibold text-lab-primary-700 bg-lab-primary-50 px-3 py-1 rounded-lg">
                      Total: {formatCurrency(
                        ocrSelectedItems
                          .filter(i => i.selected && i.codigo_item)
                          .reduce((sum, item) => sum + (item.cantidad * (item.precio_unitario || 0)), 0)
                      )}
                    </div>
                    <div className="flex space-x-3">
                      <Button variant="outline" onClick={closeOcrModal}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCreateOrdenFromOcr}
                        disabled={ocrLoading || !ocrSelectedProveedor || ocrSelectedItems.filter(i => i.selected && i.codigo_item).length === 0}
                        className="bg-lab-primary-600 hover:bg-lab-primary-700"
                      >
                        {ocrLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                            Procesando...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Crear Orden de Compra
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-lab-neutral-500">
                  Se creará una orden en estado BORRADOR. Luego deberá emitirla y recibirla desde Órdenes de Compra.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== ZOOM IMAGE MODAL ==================== */}
      {ocrImageZoom && ocrPreviewUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setOcrImageZoom(false)}
        >
          <div className="relative max-w-full max-h-full">
            <button
              onClick={() => setOcrImageZoom(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={ocrPreviewUrl}
              alt="Factura ampliada"
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-center text-white text-sm mt-4">
              Click fuera de la imagen o en la X para cerrar
            </p>
          </div>
        </div>
      )}

      {/* ==================== HISTORIAL DE CAMBIOS MODAL ==================== */}
      {showHistorialModal && historialItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-lab-neutral-200 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-lab-neutral-900">Historial de Cambios</h2>
                <p className="text-sm text-lab-neutral-600 mt-1">
                  <span className="font-mono">{historialItem.codigo_interno}</span> - {historialItem.nombre}
                </p>
              </div>
              <Button variant="outline" onClick={closeHistorialModal}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {historialLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lab-primary-600"></div>
                </div>
              ) : historialData.length > 0 ? (
                <div className="space-y-4">
                  {historialData.map((entry: any, index: number) => (
                    <div key={index} className="p-4 bg-lab-neutral-50 rounded-lg border border-lab-neutral-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            entry.accion === 'CREATE' ? 'bg-green-100 text-green-700' :
                            entry.accion === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                            entry.accion === 'DELETE' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {entry.accion === 'CREATE' && (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            )}
                            {entry.accion === 'UPDATE' && (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            )}
                            {entry.accion === 'DELETE' && (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-lab-neutral-900">
                              {entry.accion === 'CREATE' ? 'Creación' :
                               entry.accion === 'UPDATE' ? 'Actualización' :
                               entry.accion === 'DELETE' ? 'Eliminación' : entry.accion}
                            </p>
                            <p className="text-sm text-lab-neutral-600">
                              {entry.usuario?.nombres} {entry.usuario?.apellidos}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm text-lab-neutral-500">
                          {new Date(entry.fecha_actividad).toLocaleString('es-EC')}
                        </div>
                      </div>

                      {/* Show changes if it's an update */}
                      {entry.accion === 'UPDATE' && entry.datos_anteriores && entry.datos_nuevos && (
                        <div className="mt-4 pt-4 border-t border-lab-neutral-200">
                          <p className="text-sm font-medium text-lab-neutral-700 mb-2">Campos modificados:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            {Object.keys(entry.datos_nuevos).filter(key =>
                              JSON.stringify(entry.datos_anteriores?.[key]) !== JSON.stringify(entry.datos_nuevos[key])
                            ).map(key => (
                              <div key={key} className="bg-white p-2 rounded border">
                                <span className="font-medium text-lab-neutral-700">{key}:</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-red-600 line-through text-xs">
                                    {JSON.stringify(entry.datos_anteriores?.[key]) || 'null'}
                                  </span>
                                  <svg className="w-4 h-4 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                  <span className="text-green-600 text-xs">
                                    {JSON.stringify(entry.datos_nuevos[key])}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {entry.descripcion && (
                        <p className="mt-3 text-sm text-lab-neutral-600">{entry.descripcion}</p>
                      )}
                    </div>
                  ))}

                  {/* Pagination */}
                  {historialTotal > 20 && (
                    <div className="flex justify-center items-center gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={historialPage === 1}
                        onClick={() => {
                          const newPage = historialPage - 1
                          setHistorialPage(newPage)
                          loadHistorial(historialItem.codigo_item, newPage)
                        }}
                      >
                        Anterior
                      </Button>
                      <span className="text-sm text-lab-neutral-600">
                        Página {historialPage} de {Math.ceil(historialTotal / 20)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={historialPage >= Math.ceil(historialTotal / 20)}
                        onClick={() => {
                          const newPage = historialPage + 1
                          setHistorialPage(newPage)
                          loadHistorial(historialItem.codigo_item, newPage)
                        }}
                      >
                        Siguiente
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-lab-neutral-500">
                  <svg className="mx-auto h-12 w-12 text-lab-neutral-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>No hay historial de cambios para este item</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-lab-neutral-200 flex justify-end">
              <Button variant="outline" onClick={closeHistorialModal}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== GENERAR PEDIDO DE REPOSICIÓN MODAL ==================== */}
      {showGenerarPedidoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-lab-neutral-200 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-lab-neutral-900">Generar Pedido de Reposición</h2>
                <p className="text-sm text-lab-neutral-600 mt-1">
                  Seleccione los items para generar una orden de compra
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowGenerarPedidoModal(false)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-700">
                    {generarPedidoItems.filter(i => i.estado_stock === 'AGOTADO').length}
                  </div>
                  <div className="text-sm text-red-600">Agotados</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-700">
                    {generarPedidoItems.filter(i => i.estado_stock === 'CRITICO').length}
                  </div>
                  <div className="text-sm text-orange-600">Críticos</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">
                    {generarPedidoItems.filter(i => i.estado_stock === 'BAJO').length}
                  </div>
                  <div className="text-sm text-yellow-600">Stock Bajo</div>
                </div>
              </div>

              {/* Proveedor Selector */}
              <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <label className="block text-sm font-semibold text-orange-900 mb-2">
                  Proveedor para la orden de compra *
                </label>
                <select
                  value={generarPedidoProveedor}
                  onChange={(e) => setGenerarPedidoProveedor(e.target.value)}
                  className="w-full md:w-1/2 rounded-md border-orange-300 text-sm focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.filter(p => p.activo !== false).map((prov) => (
                    <option key={prov.codigo_proveedor} value={prov.codigo_proveedor}>
                      {prov.razon_social}
                    </option>
                  ))}
                </select>
                {!generarPedidoProveedor && (
                  <p className="mt-1 text-xs text-orange-600">Debe seleccionar un proveedor para crear la orden</p>
                )}
              </div>

              {/* Select All */}
              <div className="flex items-center gap-4 mb-4 p-3 bg-lab-neutral-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generarPedidoItems.every(i => i.selected)}
                    onChange={(e) => handleToggleAllPedidoItems(e.target.checked)}
                    className="w-4 h-4 rounded border-lab-neutral-300 text-lab-primary-600 focus:ring-lab-primary-500"
                  />
                  <span className="text-sm font-medium">Seleccionar todos</span>
                </label>
                <span className="text-sm text-lab-neutral-600">
                  {generarPedidoItems.filter(i => i.selected).length} de {generarPedidoItems.length} seleccionados
                </span>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="bg-lab-neutral-50 border-b">
                      <th className="p-3 text-left w-10"></th>
                      <th className="p-3 text-left text-sm font-semibold">Item</th>
                      <th className="p-3 text-center text-sm font-semibold">Stock Actual</th>
                      <th className="p-3 text-center text-sm font-semibold">Mínimo</th>
                      <th className="p-3 text-center text-sm font-semibold">Estado</th>
                      <th className="p-3 text-center text-sm font-semibold">Cantidad a Pedir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generarPedidoItems.map((item) => (
                      <tr key={item.codigo_item} className={`border-b ${!item.selected ? 'opacity-50' : ''}`}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => handleGenerarPedidoItemChange(item.codigo_item, 'selected', e.target.checked)}
                            className="w-4 h-4 rounded border-lab-neutral-300 text-lab-primary-600 focus:ring-lab-primary-500"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{item.nombre}</div>
                          <div className="text-xs text-lab-neutral-500">{item.codigo_interno} - {item.unidad_medida}</div>
                        </td>
                        <td className="p-3 text-center font-semibold">{item.stock_actual}</td>
                        <td className="p-3 text-center text-lab-neutral-600">{item.stock_minimo}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.estado_stock === 'AGOTADO' ? 'bg-red-100 text-red-800' :
                            item.estado_stock === 'CRITICO' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {item.estado_stock === 'AGOTADO' ? 'Agotado' :
                             item.estado_stock === 'CRITICO' ? 'Crítico' : 'Bajo'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <Input
                            type="number"
                            min="1"
                            value={item.cantidad_pedir}
                            onChange={(e) => handleGenerarPedidoItemChange(item.codigo_item, 'cantidad_pedir', parseInt(e.target.value) || 1)}
                            className="w-20 text-center mx-auto"
                            disabled={!item.selected}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {proveedores.length === 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Nota:</strong> No hay proveedores registrados. Debe crear proveedores en el módulo de Proveedores antes de poder generar órdenes de compra.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-lab-neutral-200 flex justify-between items-center">
              <div className="text-sm text-lab-neutral-600">
                Se creará <strong>1 orden</strong> con{' '}
                <strong>{generarPedidoItems.filter(i => i.selected).length}</strong> items
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowGenerarPedidoModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleGenerarOrdenes}
                  disabled={generarPedidoLoading || !generarPedidoProveedor || generarPedidoItems.filter(i => i.selected).length === 0}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {generarPedidoLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Generando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Generar Orden de Compra
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
