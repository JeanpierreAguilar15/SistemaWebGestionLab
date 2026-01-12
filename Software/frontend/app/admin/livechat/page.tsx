'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
    MessageCircle,
    Users,
    Clock,
    CheckCircle,
    Send,
    X,
    Phone,
    User,
    AlertCircle,
    RefreshCw,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

interface PendingConversation {
    id: number;
    userId?: number;
    userName: string;
    userEmail?: string;
    status: string;
    waitingSince: string;
    queuePosition: number;
    lastMessage: string;
    ipAddress?: string;
}

interface ActiveConversation {
    id: number;
    userId?: number;
    userName: string;
    userEmail?: string;
    status: string;
    startTime: string;
    lastMessage: string;
    lastMessageTime?: string;
}

interface Message {
    id: number;
    content: string;
    senderType: string;
    senderName: string;
    timestamp: string;
    read: boolean;
}

interface Stats {
    pending: number;
    active: number;
    closedToday: number;
    avgWaitTime: number;
}

export default function LiveChatPage() {
    const { token, user, isAuthenticated } = useAuthStore();
    const router = useRouter();

    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const [pendingConversations, setPendingConversations] = useState<PendingConversation[]>([]);
    const [myConversations, setMyConversations] = useState<ActiveConversation[]>([]);
    const [stats, setStats] = useState<Stats>({ pending: 0, active: 0, closedToday: 0, avgWaitTime: 0 });

    const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Verificar autenticación
    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, router]);

    // Conectar WebSocket
    useEffect(() => {
        if (!token || !user) return;

        const newSocket = io(`${WS_URL}/chatbot`, {
            transports: ['websocket'],
        });

        newSocket.on('connect', () => {
            console.log('Connected to chat server');
            setIsConnected(true);

            // Registrar como operador
            newSocket.emit('operator_register', {
                operatorId: user.codigo_usuario,
                operatorName: `${user.nombres} ${user.apellidos}`,
            });
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from chat server');
            setIsConnected(false);
        });

        // Eventos de operador
        newSocket.on('operator_registered', (data: any) => {
            console.log('Registered as operator:', data);
            // Solicitar conversaciones pendientes
            newSocket.emit('get_pending_conversations');
        });

        newSocket.on('pending_conversations', (data: any) => {
            setPendingConversations(data.pending || []);
            setMyConversations(data.myConversations || []);
            setStats(data.stats || { pending: 0, active: 0, closedToday: 0, avgWaitTime: 0 });
            setLoading(false);
        });

        newSocket.on('new_handoff_request', (data: any) => {
            // Nueva solicitud de chat
            setPendingConversations(prev => [...prev, {
                id: data.conversationId,
                userName: data.userName,
                status: 'ESPERANDO_OPERADOR',
                waitingSince: data.timestamp,
                queuePosition: prev.length + 1,
                lastMessage: data.reason || 'Usuario solicitó hablar con operador',
            }]);
            setStats(prev => ({ ...prev, pending: prev.pending + 1 }));
        });

        newSocket.on('conversation_assigned', (data: any) => {
            // Conversación asignada a este operador
            setMessages(data.messages || []);
            setSelectedConversation(data.conversationId);
            // Mover de pendientes a mis conversaciones
            setPendingConversations(prev => prev.filter(c => c.id !== data.conversationId));
            setMyConversations(prev => [...prev, {
                id: data.conversationId,
                userName: data.conversation?.userName || 'Usuario',
                status: 'ATENDIDA',
                startTime: new Date().toISOString(),
                lastMessage: '',
            }]);
        });

        newSocket.on('conversation_taken', (data: any) => {
            // Otro operador tomó la conversación
            setPendingConversations(prev => prev.filter(c => c.id !== data.conversationId));
        });

        newSocket.on('new_message', (data: any) => {
            // Nuevo mensaje en conversación
            if (data.conversationId === selectedConversation) {
                setMessages(prev => [...prev, {
                    id: data.id,
                    content: data.content,
                    senderType: data.senderType,
                    senderName: data.senderName,
                    timestamp: data.timestamp,
                    read: false,
                }]);
            }
            // Actualizar última mensaje en lista
            setMyConversations(prev => prev.map(c =>
                c.id === data.conversationId
                    ? { ...c, lastMessage: data.content, lastMessageTime: data.timestamp }
                    : c
            ));
        });

        newSocket.on('user_disconnected', (data: any) => {
            if (data.conversationId === selectedConversation) {
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    content: 'El usuario se ha desconectado',
                    senderType: 'SISTEMA',
                    senderName: 'Sistema',
                    timestamp: new Date().toISOString(),
                    read: true,
                }]);
            }
        });

        newSocket.on('conversation_closed', (data: any) => {
            if (data.conversationId === selectedConversation) {
                setSelectedConversation(null);
                setMessages([]);
            }
            setMyConversations(prev => prev.filter(c => c.id !== data.conversationId));
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [token, user]);

    // Scroll al último mensaje
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const takeConversation = (conversationId: number) => {
        if (socket) {
            socket.emit('operator_take_conversation', { conversationId });
        }
    };

    const sendMessage = () => {
        if (!inputMessage.trim() || !socket || !selectedConversation) return;

        socket.emit('operator_message', {
            conversationId: selectedConversation,
            content: inputMessage,
        });

        setInputMessage('');
    };

    const closeConversation = () => {
        if (!socket || !selectedConversation) return;

        socket.emit('operator_close_conversation', {
            conversationId: selectedConversation,
        });
    };

    const refreshConversations = () => {
        if (socket) {
            setLoading(true);
            socket.emit('get_pending_conversations');
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    };

    const getTimeSince = (dateString: string) => {
        const start = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now.getTime() - start.getTime()) / 60000);
        if (diff < 1) return 'Ahora';
        if (diff < 60) return `${diff} min`;
        return `${Math.floor(diff / 60)}h ${diff % 60}m`;
    };

    if (!isAuthenticated || !user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <MessageCircle className="text-blue-600" size={28} />
                            <div>
                                <h1 className="text-xl font-bold text-gray-800">Centro de Chat en Vivo</h1>
                                <p className="text-sm text-gray-500">
                                    {isConnected ? (
                                        <span className="flex items-center gap-1 text-green-600">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                            Conectado
                                        </span>
                                    ) : (
                                        <span className="text-red-500">Desconectado</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={refreshConversations}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            Actualizar
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-100 p-2 rounded-lg">
                                <Clock className="text-yellow-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
                                <p className="text-sm text-gray-500">En espera</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <MessageCircle className="text-blue-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-800">{stats.active}</p>
                                <p className="text-sm text-gray-500">Activas</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-lg">
                                <CheckCircle className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-800">{stats.closedToday}</p>
                                <p className="text-sm text-gray-500">Cerradas hoy</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 p-2 rounded-lg">
                                <Users className="text-purple-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-800">{myConversations.length}</p>
                                <p className="text-sm text-gray-500">Mis chats</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    {/* Panel izquierdo: Lista de conversaciones */}
                    <div className="col-span-4 space-y-4">
                        {/* Conversaciones pendientes */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b bg-yellow-50">
                                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <AlertCircle className="text-yellow-600" size={18} />
                                    En espera ({pendingConversations.length})
                                </h2>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {pendingConversations.length === 0 ? (
                                    <p className="p-4 text-sm text-gray-500 text-center">
                                        No hay conversaciones en espera
                                    </p>
                                ) : (
                                    pendingConversations.map((conv) => (
                                        <div
                                            key={conv.id}
                                            className="p-4 border-b hover:bg-gray-50 cursor-pointer"
                                            onClick={() => takeConversation(conv.id)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-gray-800">{conv.userName}</span>
                                                <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                                                    #{conv.queuePosition}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 truncate">{conv.lastMessage}</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-gray-400">
                                                    Esperando: {getTimeSince(conv.waitingSince)}
                                                </span>
                                                <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                                    Tomar chat
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Mis conversaciones activas */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b bg-blue-50">
                                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <MessageCircle className="text-blue-600" size={18} />
                                    Mis conversaciones ({myConversations.length})
                                </h2>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {myConversations.length === 0 ? (
                                    <p className="p-4 text-sm text-gray-500 text-center">
                                        No tienes conversaciones activas
                                    </p>
                                ) : (
                                    myConversations.map((conv) => (
                                        <div
                                            key={conv.id}
                                            className={`p-4 border-b cursor-pointer transition ${
                                                selectedConversation === conv.id
                                                    ? 'bg-blue-50 border-l-4 border-l-blue-600'
                                                    : 'hover:bg-gray-50'
                                            }`}
                                            onClick={() => {
                                                setSelectedConversation(conv.id);
                                                // Cargar mensajes via REST
                                                fetch(`${API_URL}/livechat/conversation/${conv.id}/messages`, {
                                                    headers: { Authorization: `Bearer ${token}` },
                                                })
                                                    .then(res => res.json())
                                                    .then(data => setMessages(data))
                                                    .catch(console.error);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-100 p-2 rounded-full">
                                                    <User className="text-blue-600" size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-800">{conv.userName}</p>
                                                    <p className="text-sm text-gray-500 truncate">{conv.lastMessage || 'Sin mensajes'}</p>
                                                </div>
                                                {conv.lastMessageTime && (
                                                    <span className="text-xs text-gray-400">
                                                        {formatTime(conv.lastMessageTime)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Panel derecho: Chat activo */}
                    <div className="col-span-8">
                        <div className="bg-white rounded-xl shadow-sm h-[600px] flex flex-col">
                            {selectedConversation ? (
                                <>
                                    {/* Header del chat */}
                                    <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded-full">
                                                <User className="text-blue-600" size={20} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800">
                                                    {myConversations.find(c => c.id === selectedConversation)?.userName || 'Usuario'}
                                                </p>
                                                <p className="text-sm text-green-600">En línea</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={closeConversation}
                                            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                        >
                                            <X size={18} />
                                            Cerrar chat
                                        </button>
                                    </div>

                                    {/* Mensajes */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                                        {messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex ${
                                                    msg.senderType === 'OPERATOR' ? 'justify-end' :
                                                    msg.senderType === 'SISTEMA' ? 'justify-center' : 'justify-start'
                                                }`}
                                            >
                                                {msg.senderType === 'SISTEMA' ? (
                                                    <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                                                        {msg.content}
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`max-w-[70%] p-3 rounded-2xl ${
                                                            msg.senderType === 'OPERATOR'
                                                                ? 'bg-blue-600 text-white rounded-br-md'
                                                                : 'bg-white text-gray-800 shadow-sm border rounded-bl-md'
                                                        }`}
                                                    >
                                                        <p className="text-sm">{msg.content}</p>
                                                        <span className={`text-[10px] mt-1 block ${
                                                            msg.senderType === 'OPERATOR' ? 'text-blue-200' : 'text-gray-400'
                                                        }`}>
                                                            {formatTime(msg.timestamp)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input */}
                                    <div className="p-4 border-t bg-white">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={inputMessage}
                                                onChange={(e) => setInputMessage(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                                placeholder="Escribe tu mensaje..."
                                                className="flex-1 border rounded-full px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            />
                                            <button
                                                onClick={sendMessage}
                                                disabled={!inputMessage.trim()}
                                                className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                            >
                                                <Send size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        <MessageCircle size={48} className="mx-auto mb-4 opacity-30" />
                                        <p>Selecciona una conversación para comenzar</p>
                                        <p className="text-sm mt-2">
                                            O toma una conversación de la cola de espera
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
