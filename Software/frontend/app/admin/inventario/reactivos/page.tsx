'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Clock,
  AlertTriangle,
  Play,
  TestTube,
  Trash2,
  RefreshCw,
  Package,
  Timer,
  Info,
  AlertCircle,
} from 'lucide-react';

interface LoteAbierto {
  codigo_lote: number;
  numero_lote: string;
  item_nombre: string;
  codigo_item: number;
  fecha_apertura: string;
  fecha_vencimiento_abierto: string;
  dias_restantes: number;
  horas_restantes: number;
  pruebas_realizadas: number;
  capacidad_pruebas: number;
  pruebas_restantes: number;
  porcentaje_uso: number;
  frascos_restantes: number;
  frascos_totales: number;
  estado: string;
}

interface LoteCerrado {
  codigo_lote: number;
  numero_lote: string;
  item: {
    codigo_item: number;
    nombre: string;
    es_reactivo: boolean;
    vida_util_dias_abierto: number;
    capacidad_pruebas: number;
  };
  fecha_vencimiento: string;
  cantidad_actual: number;
  cantidad_inicial: number;
  estado_lote: string;
}

export default function ReactivosPage() {
  const { accessToken: token } = useAuthStore();
  const [lotesAbiertos, setLotesAbiertos] = useState<LoteAbierto[]>([]);
  const [lotesCerrados, setLotesCerrados] = useState<LoteCerrado[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogAbrirLote, setDialogAbrirLote] = useState(false);
  const [dialogRegistrarPruebas, setDialogRegistrarPruebas] = useState(false);
  const [dialogDescartar, setDialogDescartar] = useState(false);
  const [loteSeleccionado, setLoteSeleccionado] = useState<LoteCerrado | LoteAbierto | null>(null);
  const [cantidadPruebas, setCantidadPruebas] = useState('');
  const [motivoDescarte, setMotivoDescarte] = useState('');
  const [observacion, setObservacion] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  const showMessage = (type: 'success' | 'error' | 'warning', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Obtener lotes abiertos
      const resAbiertos = await fetch(`${API_URL}/admin/inventory/reactivos/lotes-abiertos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resAbiertos.ok) {
        const data = await resAbiertos.json();
        setLotesAbiertos(data);
      }

      // Obtener lotes cerrados (reactivos disponibles para abrir)
      const resLotes = await fetch(`${API_URL}/admin/inventory/lotes?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resLotes.ok) {
        const data = await resLotes.json();
        // Filtrar solo lotes cerrados de items que son reactivos con frascos disponibles
        const cerrados = data.items?.filter(
          (l: LoteCerrado) =>
            l.estado_lote === 'CERRADO' &&
            l.item?.es_reactivo &&
            l.cantidad_actual > 0
        ) || [];
        setLotesCerrados(cerrados);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showMessage('error', 'Error al cargar datos de reactivos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleAbrirLote = async () => {
    if (!loteSeleccionado) return;

    try {
      const res = await fetch(`${API_URL}/admin/inventory/reactivos/abrir-lote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ codigo_lote: loteSeleccionado.codigo_lote }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showMessage('success', data.mensaje || 'Presentacion abierta exitosamente');
        setDialogAbrirLote(false);
        setLoteSeleccionado(null);
        fetchData();
      } else {
        showMessage('error', data.message || 'Error al abrir presentacion');
      }
    } catch (error) {
      showMessage('error', 'Error de conexion');
    }
  };

  const handleRegistrarPruebas = async () => {
    if (!loteSeleccionado || !cantidadPruebas) return;

    try {
      const res = await fetch(`${API_URL}/admin/inventory/reactivos/registrar-pruebas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          codigo_lote: loteSeleccionado.codigo_lote,
          cantidad_pruebas: parseInt(cantidadPruebas),
          observacion: observacion || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.frasco_agotado) {
          showMessage('warning', data.mensaje);
        } else {
          showMessage('success', data.mensaje);
        }
        setDialogRegistrarPruebas(false);
        setLoteSeleccionado(null);
        setCantidadPruebas('');
        setObservacion('');
        fetchData();
      } else {
        showMessage('error', data.message || 'Error al registrar pruebas');
      }
    } catch (error) {
      showMessage('error', 'Error de conexion');
    }
  };

  const handleDescartarLote = async () => {
    if (!loteSeleccionado || !motivoDescarte) return;

    try {
      const res = await fetch(`${API_URL}/admin/inventory/reactivos/descartar-lote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          codigo_lote: loteSeleccionado.codigo_lote,
          motivo: motivoDescarte,
          observacion: observacion || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showMessage('warning', data.mensaje);
        setDialogDescartar(false);
        setLoteSeleccionado(null);
        setMotivoDescarte('');
        setObservacion('');
        fetchData();
      } else {
        showMessage('error', data.message || 'Error al descartar presentacion');
      }
    } catch (error) {
      showMessage('error', 'Error de conexion');
    }
  };

  const getEstadoBadge = (estado: string, horasRestantes: number) => {
    if (estado === 'VENCIDO' || horasRestantes <= 0) {
      return <Badge variant="destructive">VENCIDO</Badge>;
    }
    if (estado === 'CRITICO' || horasRestantes <= 24) {
      return <Badge variant="destructive">CRITICO - {horasRestantes}h</Badge>;
    }
    return <Badge variant="default" className="bg-green-600">ACTIVO</Badge>;
  };

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const lotesVencidos = lotesAbiertos.filter(l => l.horas_restantes <= 0);
  const lotesCriticos = lotesAbiertos.filter(l => l.horas_restantes > 0 && l.horas_restantes <= 24);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="h-6 w-6" />
            Control de Reactivos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Panel de monitoreo de presentaciones activas. Para gestionar lotes, ir a{' '}
            <a href="/admin/inventario" className="text-blue-600 hover:underline">Inventario</a>
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
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

      {/* Alertas inline */}
      {(lotesVencidos.length > 0 || lotesCriticos.length > 0) && (
        <div className="flex gap-4">
          {lotesVencidos.length > 0 && (
            <div className="flex-1 bg-red-50 border border-red-300 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-700 font-medium">{lotesVencidos.length} vencido(s) - descartar</span>
            </div>
          )}
          {lotesCriticos.length > 0 && (
            <div className="flex-1 bg-orange-50 border border-orange-300 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span className="text-orange-700 font-medium">{lotesCriticos.length} por vencer (&lt;24h)</span>
            </div>
          )}
        </div>
      )}

      {/* Stats compactos */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{lotesAbiertos.length}</div>
          <div className="text-xs text-muted-foreground">Abiertos</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{lotesCriticos.length}</div>
          <div className="text-xs text-muted-foreground">Criticos</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{lotesVencidos.length}</div>
          <div className="text-xs text-muted-foreground">Vencidos</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{lotesCerrados.length}</div>
          <div className="text-xs text-muted-foreground">Disponibles</div>
        </div>
      </div>

      {/* Presentaciones Activas */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Timer className="h-5 w-5" />
            Presentaciones Activas en Uso
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Cargando...</div>
          ) : lotesAbiertos.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              Sin presentaciones activas
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reactivo</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Tiempo Restante</TableHead>
                  <TableHead>Pruebas Usadas</TableHead>
                  <TableHead>Unidades en Lote</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotesAbiertos.map((lote) => (
                  <TableRow key={lote.codigo_lote} className={lote.horas_restantes <= 0 ? 'bg-red-50' : lote.horas_restantes <= 24 ? 'bg-orange-50' : ''}>
                    <TableCell className="font-medium">{lote.item_nombre}</TableCell>
                    <TableCell>{lote.numero_lote}</TableCell>
                    <TableCell className="text-sm">{formatFecha(lote.fecha_apertura)}</TableCell>
                    <TableCell>
                      {lote.horas_restantes > 48 ? (
                        <span className="text-green-600 font-medium">{lote.dias_restantes} dias</span>
                      ) : lote.horas_restantes > 24 ? (
                        <span className="text-yellow-600 font-medium">{lote.horas_restantes}h</span>
                      ) : lote.horas_restantes > 0 ? (
                        <span className="text-orange-600 font-bold">{lote.horas_restantes}h</span>
                      ) : (
                        <span className="text-red-600 font-bold">VENCIDO</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lote.pruebas_realizadas}/{lote.capacidad_pruebas}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${lote.porcentaje_uso}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{lote.frascos_restantes}/{lote.frascos_totales}</span>
                    </TableCell>
                    <TableCell>{getEstadoBadge(lote.estado, lote.horas_restantes)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          title="Registrar pruebas"
                          onClick={() => {
                            setLoteSeleccionado(lote);
                            setDialogRegistrarPruebas(true);
                          }}
                          disabled={lote.horas_restantes <= 0}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          title="Descartar presentacion"
                          onClick={() => {
                            setLoteSeleccionado(lote);
                            setDialogDescartar(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resumen de Lotes en Reserva */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Lotes en Reserva
            </CardTitle>
            <a href="/admin/inventario" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Ir a Inventario →
            </a>
          </div>
          <CardDescription>
            Lotes cerrados disponibles para abrir cuando se agote la presentacion actual
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Cargando...</div>
          ) : lotesCerrados.length === 0 ? (
            <div className="text-center py-6 bg-amber-50 border border-amber-200 rounded-lg">
              <Package className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-amber-700 font-medium">Sin lotes en reserva</p>
              <p className="text-sm text-amber-600 mt-1">
                No hay lotes cerrados de reactivos disponibles.
              </p>
              <a href="/admin/inventario" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                Ir a Inventario →
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Agrupar por reactivo */}
              {Array.from(new Set(lotesCerrados.map(l => l.item?.codigo_item))).map(codigoItem => {
                const lotesDelItem = lotesCerrados.filter(l => l.item?.codigo_item === codigoItem);
                const primerLote = lotesDelItem[0];
                const totalUnidades = lotesDelItem.reduce((sum, l) => sum + l.cantidad_actual, 0);
                const tieneAbierto = lotesAbiertos.some(la => la.codigo_item === codigoItem);

                return (
                  <div key={codigoItem} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <FlaskConical className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">{primerLote?.item?.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {lotesDelItem.length} lote{lotesDelItem.length !== 1 ? 's' : ''} • {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''} disponible{totalUnidades !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tieneAbierto ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          Tiene activo
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLoteSeleccionado(primerLote);
                            setDialogAbrirLote(true);
                          }}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Abrir
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Abrir Presentacion */}
      <Dialog open={dialogAbrirLote} onOpenChange={setDialogAbrirLote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Presentacion de Reactivo</DialogTitle>
            <DialogDescription>
              Al abrir la presentacion, comenzara el contador de vida util. Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {loteSeleccionado && 'item' in loteSeleccionado && (
            <div className="py-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Reactivo:</span>
                  <p className="font-medium">{(loteSeleccionado as LoteCerrado).item?.nombre}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Lote:</span>
                  <p className="font-medium">{loteSeleccionado.numero_lote}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Vida util:</span>
                  <p className="font-medium">
                    {(loteSeleccionado as LoteCerrado).item?.vida_util_dias_abierto
                      ? `${(loteSeleccionado as LoteCerrado).item.vida_util_dias_abierto} dias`
                      : 'Sin limite'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Capacidad:</span>
                  <p className="font-medium">
                    {(loteSeleccionado as LoteCerrado).item?.capacidad_pruebas || 'N/A'} pruebas
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Unidades disponibles:</span>
                  <p className="font-medium">{(loteSeleccionado as LoteCerrado).cantidad_actual}</p>
                </div>
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Al abrir, la presentacion tendra {(loteSeleccionado as LoteCerrado).item?.vida_util_dias_abierto || 'ilimitados'} dias de vida util.
                  Despues debera descartarla aunque no haya usado todas las pruebas.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbrirLote(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAbrirLote}>
              Confirmar Apertura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Registrar Pruebas */}
      <Dialog open={dialogRegistrarPruebas} onOpenChange={setDialogRegistrarPruebas}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pruebas Realizadas</DialogTitle>
            <DialogDescription>
              Ingrese la cantidad de pruebas que se realizaron con esta presentacion
            </DialogDescription>
          </DialogHeader>
          {loteSeleccionado && 'pruebas_restantes' in loteSeleccionado && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2 text-sm bg-muted p-3 rounded-lg">
                <div>
                  <span className="text-muted-foreground">Reactivo:</span>
                  <p className="font-medium">{(loteSeleccionado as LoteAbierto).item_nombre}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Pruebas usadas:</span>
                  <p className="font-medium">
                    {(loteSeleccionado as LoteAbierto).pruebas_realizadas}/
                    {(loteSeleccionado as LoteAbierto).capacidad_pruebas}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Restantes:</span>
                  <p className="font-medium text-green-600">
                    {(loteSeleccionado as LoteAbierto).pruebas_restantes} pruebas
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tiempo restante:</span>
                  <p className="font-medium">
                    {(loteSeleccionado as LoteAbierto).horas_restantes}h
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cantidad">Cantidad de Pruebas a Registrar</Label>
                <Input
                  id="cantidad"
                  type="number"
                  min="1"
                  max={(loteSeleccionado as LoteAbierto).pruebas_restantes}
                  value={cantidadPruebas}
                  onChange={(e) => setCantidadPruebas(e.target.value)}
                  placeholder={`Max: ${(loteSeleccionado as LoteAbierto).pruebas_restantes}`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obs">Observacion (opcional)</Label>
                <Input
                  id="obs"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Ej: Pruebas de glucosa dia 20/12"
                />
              </div>
              {parseInt(cantidadPruebas) >= (loteSeleccionado as LoteAbierto).pruebas_restantes && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Al registrar estas pruebas, la presentacion quedara agotada y se restara 1 del stock.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRegistrarPruebas(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrarPruebas} disabled={!cantidadPruebas || parseInt(cantidadPruebas) <= 0}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Descartar Presentacion */}
      <Dialog open={dialogDescartar} onOpenChange={setDialogDescartar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar Presentacion</DialogTitle>
            <DialogDescription>
              Esta accion descartara la presentacion actual y restara 1 del stock
            </DialogDescription>
          </DialogHeader>
          {loteSeleccionado && 'pruebas_restantes' in loteSeleccionado && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2 text-sm bg-muted p-3 rounded-lg">
                <div>
                  <span className="text-muted-foreground">Reactivo:</span>
                  <p className="font-medium">{(loteSeleccionado as LoteAbierto).item_nombre}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Lote:</span>
                  <p className="font-medium">{loteSeleccionado.numero_lote}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Pruebas usadas:</span>
                  <p className="font-medium">
                    {(loteSeleccionado as LoteAbierto).pruebas_realizadas}/
                    {(loteSeleccionado as LoteAbierto).capacidad_pruebas}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Se desperdiciaran:</span>
                  <p className="font-medium text-red-600">
                    {(loteSeleccionado as LoteAbierto).pruebas_restantes} pruebas
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo del Descarte</Label>
                <Select value={motivoDescarte} onValueChange={setMotivoDescarte}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VENCIDO_APERTURA">Vencido por tiempo de apertura</SelectItem>
                    <SelectItem value="VENCIDO_LOTE">Vencido por fecha de lote</SelectItem>
                    <SelectItem value="DANADO">Danado/Contaminado</SelectItem>
                    <SelectItem value="MANUAL">Descarte manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="obs-descarte">Observacion (opcional)</Label>
                <Input
                  id="obs-descarte"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Detalles adicionales..."
                />
              </div>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Se restara 1 unidad del stock. Unidades restantes en lote: {(loteSeleccionado as LoteAbierto).frascos_restantes - 1}
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDescartar(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDescartarLote} disabled={!motivoDescarte}>
              Descartar Presentacion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
