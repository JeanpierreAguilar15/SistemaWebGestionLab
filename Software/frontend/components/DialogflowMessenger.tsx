'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { useAuthStore } from '@/lib/store'

// Enviar mensaje al backend para logging
const logToBackend = async (data: {
    sessionId: string;
    message: string;
    sender: 'USER' | 'BOT';
    userId?: number;
    intent?: string;
    confidence?: number;
}) => {
    try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/chatbot/log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
    } catch (error) {
        // Silenciosamente fallar para no afectar UX
        console.error('Error logging to backend:', error);
    }
};

/**
 * Componente del Chatbot de Dialogflow
 * Widget oficial de Google que se comunica directamente con Dialogflow
 * e intercepta eventos para guardar en la BD
 */
export default function DialogflowMessenger() {
    const { isAuthenticated, user } = useAuthStore()
    const [sessionId, setSessionId] = useState<string>('')

    useEffect(() => {
        if (isAuthenticated && user) {
            // 1. Primero limpiamos la sesión actual para desmontar el componente
            setSessionId('');

            // 2. Usamos un timeout para asegurar que el componente se desmontó y limpiar el storage
            const timer = setTimeout(() => {
                // Limpiar almacenamiento local y de sesión de Dialogflow
                const clearStorage = (storage: Storage) => {
                    Object.keys(storage).forEach(key => {
                        if (key.startsWith('df-messenger')) {
                            storage.removeItem(key);
                        }
                    });
                };

                clearStorage(localStorage);
                clearStorage(sessionStorage);

                // 3. Generar nueva sesión
                let currentSessionId = localStorage.getItem(`chatbot-session-${user.codigo_usuario}`);
                if (!currentSessionId) {
                    currentSessionId = `session-${user.codigo_usuario}-${Date.now()}`;
                    localStorage.setItem(`chatbot-session-${user.codigo_usuario}`, currentSessionId);
                }

                setSessionId(currentSessionId);
            }, 100);

            return () => clearTimeout(timer);
        } else {
            setSessionId('');
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (!sessionId || !isAuthenticated) return;

        // Interceptar mensajes del usuario
        const handleUserMessage = (event: any) => {
            const userMessage = event.detail?.query?.text || event.detail?.text;
            if (userMessage) {
                logToBackend({
                    sessionId,
                    message: userMessage,
                    sender: 'USER',
                    userId: user?.codigo_usuario,
                });
            }
        };

        // Interceptar respuestas del bot
        const handleBotResponse = (event: any) => {
            const responses = event.detail?.responses || [];
            responses.forEach((response: any) => {
                const botMessage = response.text?.text?.[0] || response.payload?.richContent?.[0]?.[0]?.text;
                const intent = response.queryResult?.intent?.displayName;
                const confidence = response.queryResult?.intentDetectionConfidence;

                if (botMessage) {
                    logToBackend({
                        sessionId,
                        message: botMessage,
                        sender: 'BOT',
                        userId: user?.codigo_usuario,
                        intent,
                        confidence,
                    });
                }
            });
        };

        // Esperar a que el widget cargue
        const initializeListeners = () => {
            const dfMessenger = document.querySelector('df-messenger');
            if (dfMessenger) {
                // Eventos de Dialogflow Messenger
                dfMessenger.addEventListener('df-request-sent' as any, handleUserMessage);
                dfMessenger.addEventListener('df-response-received' as any, handleBotResponse);
                console.log('Dialogflow logging interceptor initialized for session:', sessionId);
            } else {
                // Reintentar si el widget aún no está listo
                setTimeout(initializeListeners, 500);
            }
        };

        // Iniciar después de que cargue el script
        const timer = setTimeout(initializeListeners, 1000);

        return () => {
            clearTimeout(timer);
            const dfMessenger = document.querySelector('df-messenger');
            if (dfMessenger) {
                dfMessenger.removeEventListener('df-request-sent' as any, handleUserMessage);
                dfMessenger.removeEventListener('df-response-received' as any, handleBotResponse);
            }
        };
    }, [sessionId, isAuthenticated, user]);

    // Si no está autenticado, no mostrar el chatbot
    if (!isAuthenticated || !sessionId) {
        return null;
    }

    return (
        <>
            {/* Estilos del tema por defecto de Dialogflow */}
            <link
                rel="stylesheet"
                href="https://www.gstatic.com/dialogflow-console/fast/df-messenger/prod/v1/themes/df-messenger-default.css"
            />

            {/* Script del widget de Dialogflow */}
            <Script
                src="https://www.gstatic.com/dialogflow-console/fast/df-messenger/prod/v1/df-messenger.js"
                strategy="lazyOnload"
            />

            <df-messenger
                key={sessionId}
                project-id="agentevirtuallaboratorio"
                agent-id="b77010e1-9eb0-48dc-b7d2-84631ca2c0e6"
                language-code="es-419"
                session-id={sessionId}
                max-query-length="-1"
            >
                <df-messenger-chat-bubble chat-title="Agente Virtual">
                </df-messenger-chat-bubble>
            </df-messenger>

            {/* Estilos personalizados para tu marca */}
            <style jsx global>{`
        df-messenger {
          z-index: 999;
          position: fixed;
          --df-messenger-font-color: #000;
          --df-messenger-font-family: 'Inter', 'Google Sans', sans-serif;
          --df-messenger-chat-background: #f3f6fc;
          --df-messenger-message-user-background: #d3e3fd;
          --df-messenger-message-bot-background: #fff;
          --df-messenger-bot-message: #1976d2;
          --df-messenger-user-message: #1565c0;
          bottom: 24px;
          right: 24px;
        }
      `}</style>
        </>
    )
}
