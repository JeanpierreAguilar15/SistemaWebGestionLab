'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, X, Send, Bot, Clock, MapPin, DollarSign, FlaskConical, RefreshCw, User, Phone, CalendarPlus, Calendar, LogIn, Paperclip, FileText, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

interface Message {
    id: string;
    content: string;
    sender: 'user' | 'bot' | 'operator' | 'system';
    timestamp: Date;
    intent?: string;
}

interface QuickAction {
    icon: React.ReactNode;
    label: string;
    message: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

type ChatMode = 'BOT' | 'WAITING' | 'HUMAN';

/**
 * PublicChatWidget - Widget de chat accesible para todos los usuarios
 * Cumple con HU-23: Acceso al agente virtual desde la página principal
 * Cumple con HU-24: Handoff a operador humano
 */
export default function PublicChatWidget() {
    const { user, isAuthenticated } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const [showQuickActions, setShowQuickActions] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // WebSocket y modo de chat (HU-24)
    const [socket, setSocket] = useState<Socket | null>(null);
    const [chatMode, setChatMode] = useState<ChatMode>('BOT');
    const [queuePosition, setQueuePosition] = useState<number | null>(null);
    const [operatorName, setOperatorName] = useState<string>('');

    // Estado para mostrar prompt de login
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    // Estado para mostrar información de contacto
    const [showContactInfo, setShowContactInfo] = useState(false);

    // Estado para subir archivos PDF
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Información del laboratorio
    const LAB_PHONE = '(+591) 3-3456789';
    const LAB_WHATSAPP = '+591 70012345';

    // Quick actions para FAQ y Citas (HU-26)
    const quickActions: QuickAction[] = [
        { icon: <CalendarPlus size={16} />, label: 'Agendar Cita', message: 'Quiero agendar una cita' },
        { icon: <Calendar size={16} />, label: 'Mis Citas', message: 'Ver mis citas' },
        { icon: <DollarSign size={16} />, label: 'Precios', message: '¿Cuáles son los precios de los exámenes?' },
        { icon: <FileText size={16} />, label: 'Interpretar Resultados', message: '__UPLOAD_PDF__' },
    ];

    // Initialize session ID
    useEffect(() => {
        let storedSession = localStorage.getItem('chatbot-public-session');
        if (!storedSession) {
            storedSession = `anon-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            localStorage.setItem('chatbot-public-session', storedSession);
        }
        if (isAuthenticated && user) {
            storedSession = `user-${user.codigo_usuario}-${Date.now()}`;
        }
        setSessionId(storedSession);
    }, [isAuthenticated, user]);

    // Limpiar chat al cerrar sesión
    useEffect(() => {
        if (!isAuthenticated) {
            // Usuario cerró sesión - limpiar todo el estado del chat
            setMessages([]);
            setShowQuickActions(true);
            setChatMode('BOT');
            setOperatorName('');
            setQueuePosition(null);
            setShowLoginPrompt(false);
            setShowContactInfo(false);
            setIsOpen(false);
            // Generar nueva sesión anónima
            const newSession = `anon-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            localStorage.setItem('chatbot-public-session', newSession);
            setSessionId(newSession);
        }
    }, [isAuthenticated]);

    // Initialize WebSocket connection when chat is opened
    useEffect(() => {
        if (!isOpen || !sessionId) return;

        const newSocket = io(`${WS_URL}/chatbot`, {
            transports: ['websocket'],
        });

        newSocket.on('connect', () => {
            console.log('Connected to chat server');
            // Register with session ID
            newSocket.emit('register', {
                sessionId,
                userId: user?.codigo_usuario,
                userName: user ? `${user.nombres} ${user.apellidos}` : 'Usuario',
            });
        });

        newSocket.on('registered', (data: any) => {
            console.log('Registered with session:', data.sessionId);
        });

        // Handoff events
        newSocket.on('handoff_queued', (data: any) => {
            setChatMode('WAITING');
            setQueuePosition(data.position);
            addMessage({
                id: Date.now().toString(),
                content: data.message,
                sender: 'system',
                timestamp: new Date(),
            });
        });

        newSocket.on('operator_joined', (data: any) => {
            setChatMode('HUMAN');
            setOperatorName(data.operatorName);
            addMessage({
                id: Date.now().toString(),
                content: data.message,
                sender: 'system',
                timestamp: new Date(),
            });
        });

        newSocket.on('new_message', (data: any) => {
            // Message from operator
            addMessage({
                id: data.id?.toString() || Date.now().toString(),
                content: data.content,
                sender: data.senderType === 'OPERATOR' ? 'operator' : 'user',
                timestamp: new Date(data.timestamp),
            });
        });

        newSocket.on('conversation_closed', (data: any) => {
            setChatMode('BOT');
            setOperatorName('');
            addMessage({
                id: Date.now().toString(),
                content: data.message,
                sender: 'system',
                timestamp: new Date(),
            });
        });

        newSocket.on('handoff_cancelled', (data: any) => {
            setChatMode('BOT');
            addMessage({
                id: Date.now().toString(),
                content: data.message,
                sender: 'system',
                timestamp: new Date(),
            });
        });

        newSocket.on('user_disconnected', (data: any) => {
            addMessage({
                id: Date.now().toString(),
                content: data.message,
                sender: 'system',
                timestamp: new Date(),
            });
        });

        // Bot response (when in BOT mode using WebSocket)
        newSocket.on('response', (data: any) => {
            setIsTyping(false);
            addMessage({
                id: Date.now().toString(),
                content: data.text,
                sender: 'bot',
                timestamp: new Date(),
                intent: data.intent,
            });
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [isOpen, sessionId, user]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const addMessage = (msg: Message) => {
        setMessages((prev) => [...prev, msg]);
        if (msg.sender === 'user') {
            setShowQuickActions(false);
        }
    };

    const sendMessage = async (content: string) => {
        if (!content.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            content,
            sender: 'user',
            timestamp: new Date(),
        };

        addMessage(userMsg);
        setInputValue('');

        // If in HUMAN mode, send via WebSocket
        if (chatMode === 'HUMAN' && socket) {
            socket.emit('message', { content, sessionId });
            return;
        }

        // BOT mode: use REST API for reliability
        setIsTyping(true);

        try {
            // Incluir userId si está autenticado (HU-26)
            const requestBody: any = {
                sessionId,
                content,
            };
            if (isAuthenticated && user) {
                requestBody.userId = user.codigo_usuario;
            }

            const response = await fetch(`${API_URL}/chatbot/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            setIsTyping(false);
            addMessage({
                id: (Date.now() + 1).toString(),
                content: data.text || 'Lo siento, no pude procesar tu mensaje.',
                sender: 'bot',
                timestamp: new Date(),
                intent: data.intent,
            });

            // Manejar requerimiento de autenticación (HU-26)
            if (data.requiresAuth && !isAuthenticated) {
                setShowLoginPrompt(true);
            } else {
                setShowLoginPrompt(false);
            }

        } catch (error) {
            console.error('Error sending message:', error);
            setIsTyping(false);
            addMessage({
                id: (Date.now() + 1).toString(),
                content: 'Lo siento, hubo un error de conexión. Por favor intenta de nuevo.',
                sender: 'bot',
                timestamp: new Date(),
            });
        }
    };

    const handleSend = () => {
        sendMessage(inputValue);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleQuickAction = (action: QuickAction) => {
        if (action.message === '__UPLOAD_PDF__') {
            // Trigger file input
            fileInputRef.current?.click();
            return;
        }
        sendMessage(action.message);
    };

    // Función para manejar la subida de archivos PDF
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tipo de archivo
        if (file.type !== 'application/pdf') {
            addMessage({
                id: Date.now().toString(),
                content: '❌ Por favor, sube un archivo PDF con tus resultados de laboratorio.',
                sender: 'bot',
                timestamp: new Date(),
            });
            return;
        }

        // Validar tamaño (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            addMessage({
                id: Date.now().toString(),
                content: '❌ El archivo es muy grande. El tamaño máximo es 10MB.',
                sender: 'bot',
                timestamp: new Date(),
            });
            return;
        }

        setShowQuickActions(false);
        setIsUploadingFile(true);

        // Mostrar mensaje de usuario
        addMessage({
            id: Date.now().toString(),
            content: `📄 Subiendo: ${file.name}`,
            sender: 'user',
            timestamp: new Date(),
        });

        try {
            // Convertir a base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remover el prefijo data:application/pdf;base64,
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Mostrar mensaje de procesando
            addMessage({
                id: (Date.now() + 1).toString(),
                content: '🔍 Analizando tus resultados con inteligencia artificial...',
                sender: 'bot',
                timestamp: new Date(),
            });

            // Enviar al backend
            const response = await fetch(`${API_URL}/chatbot/interpret-results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file: base64,
                    mimeType: 'application/pdf',
                    sessionId,
                }),
            });

            const data = await response.json();

            if (data.success) {
                addMessage({
                    id: (Date.now() + 2).toString(),
                    content: data.chatMessage,
                    sender: 'bot',
                    timestamp: new Date(),
                });
            } else {
                addMessage({
                    id: (Date.now() + 2).toString(),
                    content: `❌ ${data.error || 'No pude analizar el documento. Asegúrate de que sea un PDF legible con resultados de laboratorio.'}`,
                    sender: 'bot',
                    timestamp: new Date(),
                });
            }

        } catch (error) {
            console.error('Error uploading file:', error);
            addMessage({
                id: (Date.now() + 2).toString(),
                content: '❌ Hubo un error al procesar el archivo. Por favor intenta de nuevo.',
                sender: 'bot',
                timestamp: new Date(),
            });
        } finally {
            setIsUploadingFile(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const requestHumanAgent = () => {
        // Mostrar información de contacto del laboratorio
        setShowContactInfo(true);
        addMessage({
            id: Date.now().toString(),
            content: `📞 Para comunicarte con nosotros:\n\n• Teléfono: ${LAB_PHONE}\n• WhatsApp: ${LAB_WHATSAPP}\n\nHorario de atención:\nLunes a Viernes: 7:00 - 19:00\nSábados: 7:00 - 13:00`,
            sender: 'bot',
            timestamp: new Date(),
        });
    };

    const requestLiveChat = () => {
        if (!socket) return;

        socket.emit('request_handoff', {
            sessionId,
            reason: 'Usuario solicitó hablar con un operador',
        });
    };

    const cancelHandoff = () => {
        if (!socket) return;
        socket.emit('cancel_handoff');
        setChatMode('BOT');
        setQueuePosition(null);
    };

    const resetConversation = () => {
        setMessages([]);
        setShowQuickActions(true);
        setChatMode('BOT');
        setOperatorName('');
        setQueuePosition(null);
        setShowLoginPrompt(false);
        const newSession = `anon-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        localStorage.setItem('chatbot-public-session', newSession);
        setSessionId(newSession);
    };

    const handleLoginClick = () => {
        // Redirigir a login con URL de retorno
        window.location.href = '/login?redirect=/';
    };

    const getHeaderInfo = () => {
        switch (chatMode) {
            case 'WAITING':
                return {
                    title: 'En espera...',
                    subtitle: queuePosition ? `Posición en cola: ${queuePosition}` : 'Conectando con un operador',
                    icon: <Clock size={24} />,
                    bgClass: 'from-yellow-500 to-yellow-600',
                };
            case 'HUMAN':
                return {
                    title: operatorName || 'Operador',
                    subtitle: 'Chat en vivo',
                    icon: <User size={24} />,
                    bgClass: 'from-green-500 to-green-600',
                };
            default:
                return {
                    title: 'AgenteVLab',
                    subtitle: isAuthenticated ? `Hola, ${user?.nombres}` : 'Asistente Virtual',
                    icon: <Bot size={24} />,
                    bgClass: 'from-blue-600 to-blue-700',
                };
        }
    };

    const headerInfo = getHeaderInfo();

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {isOpen && (
                <div
                    className="mb-4 w-[350px] sm:w-[400px] h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-200"
                >
                        {/* Header */}
                        <div className={`bg-gradient-to-r ${headerInfo.bgClass} p-4 flex items-center justify-between text-white`}>
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-full">
                                    {headerInfo.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold">{headerInfo.title}</h3>
                                    <p className="text-xs opacity-80">{headerInfo.subtitle}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {chatMode === 'WAITING' && (
                                    <button
                                        onClick={cancelHandoff}
                                        className="hover:bg-white/20 p-1.5 rounded-full transition-colors text-xs"
                                        title="Cancelar"
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    onClick={resetConversation}
                                    className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
                                    title="Nueva conversación"
                                >
                                    <RefreshCw size={18} />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
                            {/* Quick Actions - Sticky en la parte superior */}
                            {chatMode === 'BOT' && (
                                <div className="sticky top-0 z-10 bg-gray-50 p-3 border-b border-gray-200">
                                    {/* Botón destacado para subir resultados - solo al inicio */}
                                    {messages.length === 0 && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full flex items-center justify-center gap-3 p-3 mb-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all"
                                        >
                                            <FileText size={20} />
                                            <div className="text-left">
                                                <p className="font-semibold text-sm">Interpretar mis Resultados</p>
                                                <p className="text-xs opacity-80">Sube tu PDF y te lo explico</p>
                                            </div>
                                        </button>
                                    )}

                                    {/* Acciones rápidas - siempre visibles */}
                                    <div className="grid grid-cols-3 gap-1">
                                        {quickActions.filter(a => a.message !== '__UPLOAD_PDF__').map((action, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleQuickAction(action)}
                                                className="flex items-center justify-center gap-1 p-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-xs text-gray-700 hover:text-blue-600"
                                            >
                                                <span className="text-blue-500">{action.icon}</span>
                                                <span>{action.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Contenido de mensajes */}
                            <div className="flex-1 p-4 space-y-4">
                                {messages.length === 0 && (
                                    <div className="text-center text-gray-500 mt-4">
                                        <Bot size={48} className="mx-auto mb-3 text-blue-400" />
                                        <p className="text-sm font-medium mb-1">Hola! Soy el asistente virtual</p>
                                        <p className="text-xs text-gray-400 mb-4">
                                            Puedo ayudarte con información sobre nuestros servicios
                                        </p>
                                    </div>
                                )}

                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${
                                        msg.sender === 'user' ? 'justify-end' :
                                        msg.sender === 'system' ? 'justify-center' : 'justify-start'
                                    }`}
                                >
                                    {msg.sender === 'system' ? (
                                        <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-full max-w-[80%] text-center">
                                            {msg.content}
                                        </div>
                                    ) : (
                                        <div
                                            className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                                                msg.sender === 'user'
                                                    ? 'bg-blue-600 text-white rounded-br-md'
                                                    : msg.sender === 'operator'
                                                    ? 'bg-green-600 text-white rounded-bl-md'
                                                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                                            }`}
                                        >
                                            {msg.sender === 'operator' && (
                                                <p className="text-xs opacity-80 mb-1">{operatorName}</p>
                                            )}
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                            <span className={`text-[10px] mt-1 block ${
                                                msg.sender === 'user' ? 'text-blue-200' :
                                                msg.sender === 'operator' ? 'text-green-200' : 'text-gray-400'
                                            }`}>
                                                {msg.timestamp.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white p-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100 flex items-center gap-1">
                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-gray-100">
                            {/* Hidden file input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="application/pdf"
                                className="hidden"
                            />

                            {/* Login Prompt (HU-26) */}
                            {showLoginPrompt && !isAuthenticated && (
                                <button
                                    onClick={handleLoginClick}
                                    className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm transition-colors font-medium shadow-sm"
                                >
                                    <LogIn size={16} />
                                    Iniciar sesión para continuar
                                </button>
                            )}

                            {/* Talk to Human Button (only in BOT mode) */}
                            {chatMode === 'BOT' && messages.length > 0 && !showLoginPrompt && !showContactInfo && (
                                <button
                                    onClick={requestHumanAgent}
                                    className="w-full mb-3 flex items-center justify-center gap-2 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm transition-colors"
                                >
                                    <Phone size={16} />
                                    Contactar
                                </button>
                            )}

                            {/* Live Chat Option after showing contact info */}
                            {chatMode === 'BOT' && showContactInfo && (
                                <button
                                    onClick={requestLiveChat}
                                    className="w-full mb-3 flex items-center justify-center gap-2 py-2 px-4 bg-green-100 hover:bg-green-200 text-green-700 rounded-full text-sm transition-colors"
                                >
                                    <User size={16} />
                                    Solicitar chat en vivo
                                </button>
                            )}

                            <div className="flex items-center gap-2">
                                {/* Botón de adjuntar archivo - más visible */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingFile || isTyping || chatMode === 'WAITING'}
                                    className="flex items-center gap-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200"
                                    title="Subir PDF de resultados"
                                >
                                    {isUploadingFile ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <>
                                            <FileText size={18} />
                                            <span className="text-xs font-medium hidden sm:inline">PDF</span>
                                        </>
                                    )}
                                </button>
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder={
                                        isUploadingFile ? 'Analizando PDF...' :
                                        chatMode === 'WAITING' ? 'Esperando operador...' :
                                        chatMode === 'HUMAN' ? 'Escribe al operador...' :
                                        'Escribe tu consulta...'
                                    }
                                    className="flex-1 bg-gray-100 border-0 rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                                    disabled={isTyping || isUploadingFile || chatMode === 'WAITING'}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputValue.trim() || isTyping || isUploadingFile || chatMode === 'WAITING'}
                                    className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                            <div className="text-center mt-2">
                                <p className="text-[10px] text-gray-400">
                                    Laboratorio Clínico Franz - {chatMode === 'HUMAN' ? 'Chat en Vivo' : 'Asistente Virtual con IA'}
                                </p>
                            </div>
                        </div>
                </div>
            )}

            {/* Chat Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`${
                    isOpen ? 'bg-gray-600' :
                    chatMode === 'HUMAN' ? 'bg-green-600' :
                    chatMode === 'WAITING' ? 'bg-yellow-500' : 'bg-blue-600'
                } text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center relative`}
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
                {chatMode === 'WAITING' && !isOpen && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-pulse" />
                )}
            </button>
        </div>
    );
}
