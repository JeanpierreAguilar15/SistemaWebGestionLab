'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { useAuthStore } from '@/lib/store';
import {
  FlaskConical,
  Package,
  Plus,
  Trash2,
  Search,
  Filter,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  Link2,
  Unlink,
  Settings,
  Pencil,
} from 'lucide-react';

interface Insumo {
  codigo_item: number;
  codigo_interno: string;
  nombre: string;
  unidad_medida: string;
  categoria: string;
  stock_actual: number;
  es_reactivo?: boolean;
  vida_util_dias_abierto?: number;
  capacidad_pruebas?: number;
}

interface ExamenInsumo {
  codigo_examen_insumo: number;
  codigo_examen: number;
  codigo_item: number;
  cantidad_requerida: number;
  activo: boolean;
  item: Insumo;
}

interface ExamenConInsumos {
  codigo_examen: number;
  codigo_interno: string;
  nombre: string;
  categoria: string;
  total_insumos: number;
  insumos: Array<{
    codigo_item: number;
    codigo_interno: string;
    nombre: string;
    unidad_medida: string;
    cantidad_requerida: number;
  }>;
}

interface ItemDisponible {
  codigo_item: number;
  codigo_interno: string;
  nombre: string;
  unidad_medida: string;
  categoria?: { nombre: string };
  stock_actual: number;
  es_reactivo: boolean;
  vida_util_dias_abierto: number | null;
  capacidad_pruebas: number | null;
}

export default function ExamenesInsumosPage() {
  const { accessToken: token } = useAuthStore();
  const [examenes, setExamenes] = useState<ExamenConInsumos[]>([]);
  const [itemsDisponibles, setItemsDisponibles] = useState<ItemDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchExamen, setSearchExamen] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('__all__');
  const [filterConfigured, setFilterConfigured] = useState<'todos' | 'configurados' | 'sin_configurar'>('todos');

  // Dialog states
  const [dialogAgregar, setDialogAgregar] = useState(false);
  const [dialogEditar, setDialogEditar] = useState(false);
  const [examenSeleccionado, setExamenSeleccionado] = useState<ExamenConInsumos | null>(null);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<string>('');
  const [insumoEditando, setInsumoEditando] = useState<{
    codigo_examen: number;
    codigo_item: number;
    nombre: string;
    unidad_medida: string;
    cantidad_actual: number;
  } | null>(null);
  const [cantidadRequerida, setCantidadRequerida] = useState('1');
  const [searchItem, setSearchItem] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  const showMessage = (type: 'success' | 'error' | 'warning', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchData = async () => {
    if (!token) {
      console.log('Token no disponible aun');
      return;
    }

    setLoading(true);
    try {
      // Obtener examenes con insumos
      const resExamenes = await fetch(`${API_URL}/admin/inventory/examenes-con-insumos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resExamenes.ok) {
        const data = await resExamenes.json();
        console.log('Examenes cargados:', data);
        setExamenes(data || []);
      } else {
        console.error('Error al cargar examenes:', resExamenes.status, resExamenes.statusText);
        if (resExamenes.status !== 401) {
          showMessage('error', `Error al cargar examenes: ${resExamenes.status}`);
        }
      }

      // Obtener items disponibles (para agregar como insumos)
      const resItems = await fetch(`${API_URL}/admin/inventory/items?limit=500&activo=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resItems.ok) {
        const data = await resItems.json();
        setItemsDisponibles(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showMessage('error', 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Filtrar examenes
  const examenesFiltrados = useMemo(() => {
    return examenes.filter((e) => {
      // Filtro por busqueda
      const matchSearch =
        !searchExamen ||
        e.nombre.toLowerCase().includes(searchExamen.toLowerCase()) ||
        e.codigo_interno.toLowerCase().includes(searchExamen.toLowerCase());

      // Filtro por categoria
      const matchCategoria = filterCategoria === '__all__' || e.categoria === filterCategoria;

      // Filtro por configuracion
      let matchConfigured = true;
      if (filterConfigured === 'configurados') {
        matchConfigured = e.total_insumos > 0;
      } else if (filterConfigured === 'sin_configurar') {
        matchConfigured = e.total_insumos === 0;
      }

      return matchSearch && matchCategoria && matchConfigured;
    });
  }, [examenes, searchExamen, filterCategoria, filterConfigured]);

  // Obtener categorias unicas
  const categorias = useMemo(() => {
    return [...new Set(examenes.map((e) => e.categoria))].filter(Boolean).sort();
  }, [examenes]);

  // Filtrar items para el selector (excluir los ya agregados)
  const itemsFiltrados = useMemo(() => {
    if (!examenSeleccionado) return [];

    const insumosActuales = examenSeleccionado.insumos.map((i) => i.codigo_item);
    return itemsDisponibles.filter((item) => {
      const noEstaAgregado = !insumosActuales.includes(item.codigo_item);
      const matchSearch =
        !searchItem ||
        item.nombre.toLowerCase().includes(searchItem.toLowerCase()) ||
        item.codigo_interno.toLowerCase().includes(searchItem.toLowerCase());
      return noEstaAgregado && matchSearch;
    });
  }, [itemsDisponibles, examenSeleccionado, searchItem]);

  const handleAgregarInsumo = async () => {
    if (!examenSeleccionado || !insumoSeleccionado || !cantidadRequerida) {
      showMessage('error', 'Seleccione un insumo y cantidad');
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/admin/inventory/examenes/${examenSeleccionado.codigo_examen}/insumos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            codigo_item: parseInt(insumoSeleccionado),
            cantidad_requerida: parseFloat(cantidadRequerida),
          }),
        }
      );

      if (res.ok) {
        showMessage('success', 'Insumo agregado al examen');
        setDialogAgregar(false);
        setInsumoSeleccionado('');
        setCantidadRequerida('1');
        setSearchItem('');
        fetchData();
      } else {
        const data = await res.json();
        showMessage('error', data.message || 'Error al agregar insumo');
      }
    } catch (error) {
      showMessage('error', 'Error de conexion');
    }
  };

  const handleQuitarInsumo = async (codigoExamen: number, codigoItem: number, nombreInsumo: string) => {
    if (!confirm(`¿Quitar "${nombreInsumo}" de este examen?`)) return;

    try {
      const res = await fetch(
        `${API_URL}/admin/inventory/examenes/${codigoExamen}/insumos/${codigoItem}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        showMessage('success', 'Insumo removido del examen');
        fetchData();
      } else {
        const data = await res.json();
        showMessage('error', data.message || 'Error al quitar insumo');
      }
    } catch (error) {
      showMessage('error', 'Error de conexion');
    }
  };

  const handleEditarInsumo = async () => {
    if (!insumoEditando || !cantidadRequerida) {
      showMessage('error', 'Especifique la cantidad');
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/admin/inventory/examenes/${insumoEditando.codigo_examen}/insumos/${insumoEditando.codigo_item}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            cantidad_requerida: parseFloat(cantidadRequerida),
          }),
        }
      );

      if (res.ok) {
        showMessage('success', 'Cantidad actualizada correctamente');
        setDialogEditar(false);
        setInsumoEditando(null);
        setCantidadRequerida('1');
        fetchData();
      } else {
        const data = await res.json();
        showMessage('error', data.message || 'Error al actualizar');
      }
    } catch (error) {
      showMessage('error', 'Error de conexion');
    }
  };

  const getItemInfo = (codigoItem: number) => {
    return itemsDisponibles.find((i) => i.codigo_item === codigoItem);
  };

  // Estadisticas
  const stats = useMemo(() => {
    const total = examenes.length;
    const configurados = examenes.filter((e) => e.total_insumos > 0).length;
    const sinConfigurar = total - configurados;
    const totalVinculos = examenes.reduce((sum, e) => sum + e.total_insumos, 0);
    return { total, configurados, sinConfigurar, totalVinculos };
  }, [examenes]);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Link2 className="h-6 w-6" />
          Configuracion Examen-Insumos
        </h1>
      </div>

      {/* Toast message */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
          message.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' :
          message.type === 'error' ? 'bg-red-100 border border-red-400 text-red-700' :
          'bg-yellow-100 border border-yellow-400 text-yellow-700'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' && <span>✓</span>}
            {message.type === 'error' && <span>✕</span>}
            {message.type === 'warning' && <span>⚠</span>}
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-2 font-bold">×</button>
          </div>
        </div>
      )}

      {/* Stats compactos */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Examenes</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.configurados}</div>
          <div className="text-xs text-muted-foreground">Configurados</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.sinConfigurar}</div>
          <div className="text-xs text-muted-foreground">Pendientes</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.totalVinculos}</div>
          <div className="text-xs text-muted-foreground">Vinculos</div>
        </div>
      </div>

      {/* Filtros inline */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar examen..."
              value={searchExamen}
              onChange={(e) => setSearchExamen(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterConfigured}
          onValueChange={(v) => setFilterConfigured(v as typeof filterConfigured)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="configurados">Configurados</SelectItem>
            <SelectItem value="sin_configurar">Sin configurar</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchExamen('');
            setFilterCategoria('__all__');
            setFilterConfigured('todos');
          }}
        >
          Limpiar
        </Button>
      </div>

      {/* Lista de Examenes */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5" />
            Examenes ({examenesFiltrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Cargando...</div>
          ) : examenesFiltrados.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              Sin examenes
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Examen</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Insumos Configurados</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examenesFiltrados.map((examen) => (
                  <TableRow key={examen.codigo_examen}>
                    <TableCell className="font-mono text-sm">{examen.codigo_interno}</TableCell>
                    <TableCell className="font-medium">{examen.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{examen.categoria}</Badge>
                    </TableCell>
                    <TableCell>
                      {examen.total_insumos > 0 ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Configurado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Sin configurar
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {examen.total_insumos > 0 ? (
                        <div className="space-y-1">
                          {examen.insumos.map((ins) => {
                            const itemInfo = getItemInfo(ins.codigo_item);
                            return (
                              <div
                                key={ins.codigo_item}
                                className="flex items-center gap-2 text-sm"
                              >
                                <span className="font-medium">{ins.cantidad_requerida}</span>
                                <span className="text-muted-foreground">{ins.unidad_medida}</span>
                                <span>{ins.nombre}</span>
                                {itemInfo?.es_reactivo && (
                                  <Badge variant="outline" className="text-xs">
                                    Reactivo
                                  </Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700"
                                  title="Editar cantidad"
                                  onClick={() => {
                                    setInsumoEditando({
                                      codigo_examen: examen.codigo_examen,
                                      codigo_item: ins.codigo_item,
                                      nombre: ins.nombre,
                                      unidad_medida: ins.unidad_medida,
                                      cantidad_actual: ins.cantidad_requerida,
                                    });
                                    setCantidadRequerida(ins.cantidad_requerida.toString());
                                    setDialogEditar(true);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  title="Desvincular insumo"
                                  onClick={() =>
                                    handleQuitarInsumo(examen.codigo_examen, ins.codigo_item, ins.nombre)
                                  }
                                >
                                  <Unlink className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => {
                          setExamenSeleccionado(examen);
                          setDialogAgregar(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar Insumo
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Agregar Insumo */}
      <Dialog open={dialogAgregar} onOpenChange={setDialogAgregar}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar Insumo al Examen</DialogTitle>
            <DialogDescription>
              {examenSeleccionado && (
                <>
                  Examen: <strong>{examenSeleccionado.nombre}</strong> ({examenSeleccionado.codigo_interno})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Buscar item */}
            <div className="space-y-2">
              <Label>Buscar Insumo/Reactivo</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o codigo..."
                  value={searchItem}
                  onChange={(e) => setSearchItem(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Selector de item */}
            <div className="space-y-2">
              <Label>Seleccionar Insumo</Label>
              <Select value={insumoSeleccionado} onValueChange={setInsumoSeleccionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un insumo..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {itemsFiltrados.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No hay items disponibles
                    </div>
                  ) : (
                    itemsFiltrados.map((item) => (
                      <SelectItem key={item.codigo_item} value={item.codigo_item.toString()}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{item.codigo_interno}</span>
                          <span>{item.nombre}</span>
                          {item.es_reactivo && (
                            <Badge variant="outline" className="text-xs">
                              Reactivo
                            </Badge>
                          )}
                          <span className="text-muted-foreground text-xs">
                            ({item.unidad_medida})
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Info del item seleccionado */}
            {insumoSeleccionado && (
              <div className="bg-muted p-3 rounded-lg text-sm space-y-3">
                {(() => {
                  const item = itemsDisponibles.find(
                    (i) => i.codigo_item.toString() === insumoSeleccionado
                  );
                  if (!item) return null;

                  const cantidadNum = parseFloat(cantidadRequerida) || 0;
                  const examenesDisponibles = cantidadNum > 0
                    ? Math.floor(item.stock_actual / cantidadNum)
                    : 0;

                  return (
                    <>
                      <div className="font-medium text-base">{item.nombre}</div>

                      {/* Info básica */}
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <div>
                          Stock actual: <span className="text-foreground font-medium">{item.stock_actual} {item.unidad_medida}</span>
                        </div>
                        <div>
                          Unidad de medida: <span className="text-foreground font-medium">{item.unidad_medida}</span>
                        </div>
                      </div>

                      {/* Info para Reactivos */}
                      {item.es_reactivo && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 text-blue-800 font-medium">
                            <FlaskConical className="h-4 w-4" />
                            Reactivo con control de presentaciones
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-blue-700">
                            <div>
                              Vida util al abrir: <strong>{item.vida_util_dias_abierto || 'Sin limite'} dias</strong>
                            </div>
                            <div>
                              Capacidad: <strong>{item.capacidad_pruebas || 'N/A'} pruebas/presentacion</strong>
                            </div>
                          </div>
                          <p className="text-xs text-blue-600">
                            Para reactivos, ingrese <strong>1</strong> si cada examen consume 1 prueba de la presentacion abierta.
                            El sistema registra automaticamente las pruebas usadas.
                          </p>
                        </div>
                      )}

                      {/* Info para Insumos Normales */}
                      {!item.es_reactivo && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 text-green-800 font-medium">
                            <Package className="h-4 w-4" />
                            Insumo con descuento directo de stock
                          </div>
                          <p className="text-xs text-green-600">
                            Ingrese cuantos <strong>{item.unidad_medida}</strong> se consumen por cada examen.
                            El stock se descontara automaticamente al completar la cita.
                          </p>
                        </div>
                      )}

                      {/* Calculadora de rendimiento */}
                      {cantidadNum > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-amber-800 font-medium">
                            <Info className="h-4 w-4" />
                            Rendimiento estimado
                          </div>
                          <p className="text-sm text-amber-700 mt-1">
                            Con el stock actual ({item.stock_actual} {item.unidad_medida}) y consumiendo{' '}
                            <strong>{cantidadRequerida} {item.unidad_medida}</strong> por examen,
                            puedes realizar aproximadamente <strong className="text-lg">{examenesDisponibles}</strong> examenes.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Cantidad */}
            <div className="space-y-2">
              {(() => {
                const itemSelec = itemsDisponibles.find(
                  (i) => i.codigo_item.toString() === insumoSeleccionado
                );
                const unidad = itemSelec?.unidad_medida || 'unidad(es)';
                return (
                  <>
                    <Label htmlFor="cantidad">
                      Cantidad Requerida por Examen ({unidad})
                    </Label>
                    <Input
                      id="cantidad"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={cantidadRequerida}
                      onChange={(e) => setCantidadRequerida(e.target.value)}
                      placeholder="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      {itemSelec ? (
                        <>
                          Cuantos <strong>{unidad}</strong> de {itemSelec.nombre} se consumen por cada examen realizado
                        </>
                      ) : (
                        'Seleccione un insumo para ver la unidad de medida'
                      )}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogAgregar(false);
                setInsumoSeleccionado('');
                setCantidadRequerida('1');
                setSearchItem('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAgregarInsumo}
              disabled={!insumoSeleccionado || !cantidadRequerida || parseFloat(cantidadRequerida) <= 0}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar Insumo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Cantidad */}
      <Dialog open={dialogEditar} onOpenChange={setDialogEditar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Cantidad
            </DialogTitle>
            <DialogDescription>
              {insumoEditando && (
                <>
                  Insumo: <strong>{insumoEditando.nombre}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {insumoEditando && (
              <>
                <div className="bg-muted p-3 rounded-lg text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Cantidad actual:</span>{' '}
                      <strong>{insumoEditando.cantidad_actual} {insumoEditando.unidad_medida}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unidad:</span>{' '}
                      <strong>{insumoEditando.unidad_medida}</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cantidad-editar">
                    Nueva Cantidad ({insumoEditando.unidad_medida})
                  </Label>
                  <Input
                    id="cantidad-editar"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={cantidadRequerida}
                    onChange={(e) => setCantidadRequerida(e.target.value)}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cuantos {insumoEditando.unidad_medida} de {insumoEditando.nombre} se consumen por cada examen
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogEditar(false);
                setInsumoEditando(null);
                setCantidadRequerida('1');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditarInsumo}
              disabled={!cantidadRequerida || parseFloat(cantidadRequerida) <= 0}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
