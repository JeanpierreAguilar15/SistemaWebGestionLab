'use client';

import React, { useState, useEffect } from 'react';
import {
    Save, Bot, AlertTriangle, CheckCircle, RefreshCw,
    BarChart2, MessageSquare, Clock, TrendingUp, Search,
    Eye, ChevronLeft, ChevronRight, User
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';

interface ChatbotConfig {
    codigo_configuracion: number;
    activo: boolean;
    nombre_agente: string;
    mensaje_bienvenida: string;
    disclaimer_legal: string;
    umbral_confianza: number;
    permitir_acceso_resultados: boolean;
    mensaje_fallo: string;
    contacto_soporte: string;
}

interface ChatbotAnalytics {
    totalConversaciones: number;
    conversacionesActivas: number;
    totalMensajes: number;
    promedioMensajesPorConversacion: string;
    intentsPopulares: { intent: string; count: number }[];
    confianzaPromedio: number | null;
}

interface Conversacion {
    codigo_conversacion: number;
    session_id: string;
    codigo_paciente: number | null;
    fecha_inicio: string;
    fecha_ultimo_msg: string | null;
    activa: boolean;
    paciente: {
        codigo_usuario: number;
        nombres: string;
        apellidos: string;
        email: string;
    } | null;
    _count: {
        mensajes: number;
    };
}

interface Mensaje {
    codigo_mensaje: number;
    codigo_conversacion: number;
    remitente: string;
    contenido: string;
    intent: string | null;
    confianza: number | null;
    timestamp: string;
}

type TabType = 'config' | 'analytics' | 'conversations';

export default function ChatbotConfigPage() {
    const [activeTab, setActiveTab] = useState<TabType>('config');
    const [config, setConfig] = useState<ChatbotConfig | null>(null);
    const [analytics, setAnalytics] = useState<ChatbotAnalytics | null>(null);
    const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
    const [conversationMessages, setConversationMessages] = useState<Mensaje[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Paginación
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Filtros
    const [filterActiva, setFilterActiva] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        fetchConfig();
        fetchAnalytics();
    }, []);

    useEffect(() => {
        if (activeTab === 'conversations') {
            fetchConversations();
        }
    }, [activeTab, page, filterActiva]);

    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('token') || '';
            const data = await api.get<ChatbotConfig>('/chatbot/config', { token });
            setConfig(data);
        } catch (error) {
            console.error(error);
            const msg = error instanceof ApiError ? error.message : 'No se pudo cargar la configuración.';
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        try {
            const token = localStorage.getItem('token') || '';
            const data = await api.get<ChatbotAnalytics>('/chatbot/admin/analytics', { token });
            setAnalytics(data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        }
    };

    const fetchConversations = async () => {
        try {
            const token = localStorage.getItem('token') || '';
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
            });
            if (filterActiva !== undefined) {
                params.append('activa', filterActiva.toString());
            }

            const data = await api.get<{
                conversaciones: Conversacion[];
                total: number;
                totalPages: number;
            }>(`/chatbot/admin/conversations?${params}`, { token });

            setConversaciones(data.conversaciones);
            setTotal(data.total);
            setTotalPages(data.totalPages);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        }
    };

    const fetchConversationMessages = async (conversacionId: number) => {
        try {
            const token = localStorage.getItem('token') || '';
            const data = await api.get<{
                mensajes: Mensaje[];
            }>(`/chatbot/admin/conversations/${conversacionId}/messages`, { token });

            setConversationMessages(data.mensajes || []);
            setSelectedConversation(conversacionId);
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        setMessage(null);

        try {
            const token = localStorage.getItem('token') || '';
            await api.put('/chatbot/config', config, { token });
            setMessage({ type: 'success', text: 'Configuración guardada exitosamente.' });
        } catch (error) {
            const msg = error instanceof ApiError ? error.message : 'Error al guardar los cambios.';
            setMessage({ type: 'error', text: msg });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                        <Bot size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Asistente Virtual</h1>
                        <p className="text-gray-500">Configuración, auditoría y analytics del chatbot</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('config')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'config'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Configuración
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'analytics'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <BarChart2 size={18} />
                    Analytics
                </button>
                <button
                    onClick={() => setActiveTab('conversations')}
                    className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'conversations'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <MessageSquare size={18} />
                    Conversaciones
                </button>
            </div>

            {message && (
                <div
                    className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}
                >
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                    {message.text}
                </div>
            )}

            {/* Config Tab */}
            {activeTab === 'config' && config && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                            Guardar Cambios
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Estado del Servicio */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${config.activo ? 'bg-green-500' : 'bg-red-500'}`} />
                                Estado del Servicio
                            </h2>
                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900">Activar Asistente Virtual</p>
                                    <p className="text-sm text-gray-500">
                                        Si se desactiva, el widget desaparecerá del portal de pacientes.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.activo}
                                        onChange={(e) => setConfig({ ...config, activo: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>

                        {/* Identidad */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold mb-4">Identidad</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Agente</label>
                                    <input
                                        type="text"
                                        value={config.nombre_agente || ''}
                                        onChange={(e) => setConfig({ ...config, nombre_agente: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de Bienvenida</label>
                                    <textarea
                                        rows={3}
                                        value={config.mensaje_bienvenida || ''}
                                        onChange={(e) => setConfig({ ...config, mensaje_bienvenida: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seguridad e IA */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold mb-4">Seguridad e IA</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Umbral de Confianza ({config.umbral_confianza})
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={config.umbral_confianza}
                                        onChange={(e) => setConfig({ ...config, umbral_confianza: parseFloat(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Nivel mínimo de certeza para responder automáticamente.
                                    </p>
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-sm font-medium text-gray-700">Acceso a Resultados Reales</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.permitir_acceso_resultados}
                                            onChange={(e) => setConfig({ ...config, permitir_acceso_resultados: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Textos Legales */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
                            <h2 className="text-lg font-semibold mb-4">Textos Legales y Soporte</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Disclaimer Legal</label>
                                    <textarea
                                        rows={3}
                                        value={config.disclaimer_legal || ''}
                                        onChange={(e) => setConfig({ ...config, disclaimer_legal: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de Fallo / Error</label>
                                    <textarea
                                        rows={3}
                                        value={config.mensaje_fallo || ''}
                                        onChange={(e) => setConfig({ ...config, mensaje_fallo: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contacto de Soporte</label>
                                    <input
                                        type="text"
                                        value={config.contacto_soporte || ''}
                                        onChange={(e) => setConfig({ ...config, contacto_soporte: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 p-3 rounded-full">
                                    <MessageSquare className="text-blue-600" size={24} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {analytics?.totalConversaciones || 0}
                                    </p>
                                    <p className="text-sm text-gray-500">Total Conversaciones</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-3 rounded-full">
                                    <Clock className="text-green-600" size={24} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {analytics?.conversacionesActivas || 0}
                                    </p>
                                    <p className="text-sm text-gray-500">Activas Ahora</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="bg-purple-100 p-3 rounded-full">
                                    <TrendingUp className="text-purple-600" size={24} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {analytics?.totalMensajes || 0}
                                    </p>
                                    <p className="text-sm text-gray-500">Total Mensajes</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="bg-yellow-100 p-3 rounded-full">
                                    <BarChart2 className="text-yellow-600" size={24} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {analytics?.confianzaPromedio ? `${(analytics.confianzaPromedio * 100).toFixed(0)}%` : 'N/A'}
                                    </p>
                                    <p className="text-sm text-gray-500">Confianza Promedio</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Intents Populares */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold mb-4">Intents Más Utilizados</h3>
                        {analytics?.intentsPopulares && analytics.intentsPopulares.length > 0 ? (
                            <div className="space-y-3">
                                {analytics.intentsPopulares.map((intent, idx) => (
                                    <div key={idx} className="flex items-center gap-4">
                                        <span className="text-sm font-medium text-gray-700 w-40 truncate">
                                            {intent.intent || 'Sin intent'}
                                        </span>
                                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                            <div
                                                className="bg-blue-500 h-full rounded-full transition-all"
                                                style={{
                                                    width: `${(intent.count / (analytics.intentsPopulares[0]?.count || 1)) * 100}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-sm text-gray-500 w-12 text-right">{intent.count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">No hay datos de intents disponibles.</p>
                        )}
                    </div>

                    {/* Promedio por Conversación */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold mb-2">Promedio de Mensajes por Conversación</h3>
                        <p className="text-4xl font-bold text-blue-600">
                            {analytics?.promedioMensajesPorConversacion || '0'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">mensajes en promedio</p>
                    </div>
                </div>
            )}

            {/* Conversations Tab */}
            {activeTab === 'conversations' && (
                <div className="space-y-6">
                    {/* Filtros */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Search size={18} className="text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">Filtros:</span>
                        </div>
                        <select
                            value={filterActiva === undefined ? '' : filterActiva.toString()}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFilterActiva(val === '' ? undefined : val === 'true');
                                setPage(1);
                            }}
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="">Todas</option>
                            <option value="true">Activas</option>
                            <option value="false">Cerradas</option>
                        </select>
                        <span className="text-sm text-gray-500 ml-auto">
                            {total} conversaciones encontradas
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Lista de Conversaciones */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                            <div className="p-4 border-b border-gray-100">
                                <h3 className="font-semibold text-gray-800">Lista de Conversaciones</h3>
                            </div>
                            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                                {conversaciones.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        No hay conversaciones registradas.
                                    </div>
                                ) : (
                                    conversaciones.map((conv) => (
                                        <div
                                            key={conv.codigo_conversacion}
                                            onClick={() => fetchConversationMessages(conv.codigo_conversacion)}
                                            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedConversation === conv.codigo_conversacion ? 'bg-blue-50' : ''
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${conv.paciente ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                                                        }`}>
                                                        <User size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-sm">
                                                            {conv.paciente
                                                                ? `${conv.paciente.nombres} ${conv.paciente.apellidos}`
                                                                : 'Usuario Anónimo'}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {new Date(conv.fecha_inicio).toLocaleDateString('es', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conv.activa
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {conv.activa ? 'Activa' : 'Cerrada'}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {conv._count.mensajes} msgs
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Paginación */}
                            {totalPages > 1 && (
                                <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                                    <button
                                        onClick={() => setPage(Math.max(1, page - 1))}
                                        disabled={page === 1}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                                    >
                                        <ChevronLeft size={16} />
                                        Anterior
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        Página {page} de {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                                        disabled={page === totalPages}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                                    >
                                        Siguiente
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Detalle de Conversación */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-800">
                                    {selectedConversation ? `Conversación #${selectedConversation}` : 'Selecciona una conversación'}
                                </h3>
                                {selectedConversation && (
                                    <Eye size={18} className="text-gray-400" />
                                )}
                            </div>
                            <div className="p-4 max-h-[500px] overflow-y-auto space-y-3">
                                {!selectedConversation ? (
                                    <div className="text-center text-gray-500 py-12">
                                        <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
                                        <p>Selecciona una conversación para ver los mensajes</p>
                                    </div>
                                ) : conversationMessages.length === 0 ? (
                                    <div className="text-center text-gray-500 py-12">
                                        <p>No hay mensajes en esta conversación</p>
                                    </div>
                                ) : (
                                    conversationMessages.map((msg) => (
                                        <div
                                            key={msg.codigo_mensaje}
                                            className={`flex ${msg.remitente === 'USER' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.remitente === 'USER'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-100 text-gray-800'
                                                    }`}
                                            >
                                                <p className="whitespace-pre-wrap">{msg.contenido}</p>
                                                <div className={`flex items-center gap-2 mt-1 text-xs ${msg.remitente === 'USER' ? 'text-blue-200' : 'text-gray-500'
                                                    }`}>
                                                    <span>
                                                        {new Date(msg.timestamp).toLocaleTimeString('es', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                    {msg.intent && (
                                                        <>
                                                            <span>|</span>
                                                            <span>Intent: {msg.intent}</span>
                                                        </>
                                                    )}
                                                    {msg.confianza !== null && (
                                                        <>
                                                            <span>|</span>
                                                            <span>{(msg.confianza * 100).toFixed(0)}%</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
