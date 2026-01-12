'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { feriadosService, Feriado } from '@/lib/services/feriados.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function FeriadosPage() {
    const { accessToken } = useAuthStore();
    const [feriados, setFeriados] = useState<Feriado[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        fecha: '',
        descripcion: '',
    });

    useEffect(() => {
        loadFeriados();
    }, [accessToken]);

    const loadFeriados = async () => {
        try {
            setLoading(true);
            const data = await feriadosService.getAll(accessToken || undefined);
            setFeriados(data);
        } catch (err: any) {
            setError('Error al cargar feriados');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!accessToken) return;

        try {
            await feriadosService.create(formData, accessToken);
            setShowModal(false);
            setFormData({ fecha: '', descripcion: '' });
            loadFeriados();
        } catch (err: any) {
            alert('Error al crear feriado: ' + (err.message || 'Error desconocido'));
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar este feriado?')) return;
        if (!accessToken) return;

        try {
            await feriadosService.delete(id, accessToken);
            loadFeriados();
        } catch (err: any) {
            alert('Error al eliminar feriado');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Gestión de Feriados</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    + Nuevo Feriado
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg mb-6">
                    {error}
                </div>
            )}

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900/50 text-slate-400 uppercase text-sm">
                        <tr>
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4">Descripción</th>
                            <th className="px-6 py-4">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    Cargando feriados...
                                </td>
                            </tr>
                        ) : feriados.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    No hay feriados registrados
                                </td>
                            </tr>
                        ) : (
                            feriados.map((feriado) => (
                                <tr key={feriado.codigo_feriado} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">
                                        {format(new Date(feriado.fecha), 'dd/MM/yyyy', { locale: es })}
                                    </td>
                                    <td className="px-6 py-4">{feriado.descripcion}</td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-2 py-1 rounded-full text-xs font-medium ${feriado.activo
                                                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                }`}
                                        >
                                            {feriado.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(feriado.codigo_feriado)}
                                            className="text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Nuevo Feriado</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Fecha
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.fecha}
                                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Descripción
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    placeholder="Ej: Navidad"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
