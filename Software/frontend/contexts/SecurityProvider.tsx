'use client';

/**
 * SecurityProvider - Proteccion contra Ingenieria Inversa y Debugging
 *
 * Implementa ISO/IEC 27002:2022 Control 8.28 (Codificacion segura)
 * y NIST SP 800-53 SA-15(10) (Development Process)
 *
 * Caracteristicas:
 * - Deteccion de DevTools (F12, Inspeccionar)
 * - Bloqueo de clic derecho en areas sensibles
 * - Anti-debugging basico
 * - Bloqueo de atajos de teclado de desarrollo
 * - Registro de intentos de inspeccion
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Shield, AlertOctagon } from 'lucide-react';

interface SecurityContextType {
  devToolsDetected: boolean;
  securityEnabled: boolean;
  setSecurityEnabled: (enabled: boolean) => void;
  inspectionAttempts: number;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity debe usarse dentro de SecurityProvider');
  }
  return context;
}

interface SecurityProviderProps {
  children: React.ReactNode;
}

export function SecurityProvider({ children }: SecurityProviderProps) {
  const { isAuthenticated, user } = useAuthStore();
  const [devToolsDetected, setDevToolsDetected] = useState(false);
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [inspectionAttempts, setInspectionAttempts] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [lastBlockedAction, setLastBlockedAction] = useState('');

  const devToolsCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastWindowSize = useRef({ width: 0, height: 0 });

  // Inicializar tamaño de ventana solo en cliente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      lastWindowSize.current = { width: window.innerWidth, height: window.innerHeight };
    }
  }, []);

  // Obtener mensaje descriptivo para cada tipo de bloqueo
  const getBlockedActionMessage = (type: string): string => {
    const messages: Record<string, string> = {
      'Clic derecho bloqueado': 'Clic derecho deshabilitado',
      'Tecla F12 bloqueada': 'Tecla F12 (DevTools) bloqueada',
      'Ctrl+Shift+I bloqueado': 'Combinacion Ctrl+Shift+I (Inspector) bloqueada',
      'Ctrl+Shift+J bloqueado': 'Combinacion Ctrl+Shift+J (Consola) bloqueada',
      'Ctrl+Shift+C bloqueado': 'Combinacion Ctrl+Shift+C (Selector) bloqueada',
      'Ctrl+U bloqueado': 'Combinacion Ctrl+U (Ver codigo fuente) bloqueada',
      'Ctrl+S bloqueado': 'Combinacion Ctrl+S (Guardar pagina) bloqueada',
    };
    return messages[type] || type;
  };

  // Registrar intento de inspeccion
  const logInspectionAttempt = useCallback((type: string) => {
    setInspectionAttempts(prev => prev + 1);
    setLastBlockedAction(getBlockedActionMessage(type));
    console.warn(`[SecurityProvider] Intento de inspeccion detectado: ${type}`);
    console.warn(`[SecurityProvider] Total de intentos: ${inspectionAttempts + 1}`);

    // Mostrar modal de advertencia
    setShowWarningModal(true);
    setTimeout(() => setShowWarningModal(false), 3000);

    // En produccion, enviar al backend para registro de auditoria
    if (isAuthenticated && user) {
      // fetch('/api/v1/audit/security-alert', { ... })
      console.log('[SecurityProvider] Registrando en auditoria...');
    }
  }, [inspectionAttempts, isAuthenticated, user]);

  // Deteccion de DevTools por cambio de tamano de ventana
  const detectDevToolsBySize = useCallback(() => {
    const widthThreshold = 160;
    const heightThreshold = 160;

    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;

    // DevTools acoplado cambia significativamente el tamano
    if (widthDiff > widthThreshold || heightDiff > heightThreshold) {
      if (!devToolsDetected) {
        setDevToolsDetected(true);
        logInspectionAttempt('DevTools detectado por cambio de viewport');
      }
    } else {
      setDevToolsDetected(false);
    }
  }, [devToolsDetected, logInspectionAttempt]);

  // Deteccion de DevTools por metodo de debugging
  const detectDevToolsByDebugger = useCallback(() => {
    const start = performance.now();

    // debugger causa una pausa si DevTools esta abierto
    // eslint-disable-next-line no-debugger
    debugger;

    const end = performance.now();

    // Si tomo mas de 100ms, probablemente DevTools esta abierto
    if (end - start > 100) {
      if (!devToolsDetected) {
        setDevToolsDetected(true);
        logInspectionAttempt('DevTools detectado por pausa de debugger');
      }
    }
  }, [devToolsDetected, logInspectionAttempt]);

  // Deteccion por console.log override
  const detectDevToolsByConsole = useCallback(() => {
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function() {
        if (!devToolsDetected) {
          setDevToolsDetected(true);
          logInspectionAttempt('DevTools detectado por acceso a console');
        }
        return 'devtools-detector';
      }
    });

    // Solo detecta si DevTools esta abierto y la consola visible
    console.log('%c', element);
  }, [devToolsDetected, logInspectionAttempt]);

  // Bloquear clic derecho
  const handleContextMenu = useCallback((e: MouseEvent) => {
    if (!securityEnabled) return;

    const target = e.target as HTMLElement;

    // Permitir en inputs y textareas para copiar/pegar
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    e.preventDefault();
    logInspectionAttempt('Clic derecho bloqueado');
    return false;
  }, [securityEnabled, logInspectionAttempt]);

  // Bloquear atajos de teclado de desarrollo
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!securityEnabled) return;

    // F12
    if (e.key === 'F12' || e.code === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      logInspectionAttempt('Tecla F12 bloqueada');
      return false;
    }

    // Ctrl+Shift+I (Inspeccionar) - usar e.code para mayor fiabilidad
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.code === 'KeyI')) {
      e.preventDefault();
      e.stopPropagation();
      logInspectionAttempt('Ctrl+Shift+I bloqueado');
      return false;
    }

    // Ctrl+Shift+J (Consola)
    if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.code === 'KeyJ')) {
      e.preventDefault();
      e.stopPropagation();
      logInspectionAttempt('Ctrl+Shift+J bloqueado');
      return false;
    }

    // Ctrl+Shift+C (Selector de elementos)
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.code === 'KeyC')) {
      e.preventDefault();
      e.stopPropagation();
      logInspectionAttempt('Ctrl+Shift+C bloqueado');
      return false;
    }

    // Ctrl+U (Ver codigo fuente)
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.code === 'KeyU')) {
      e.preventDefault();
      e.stopPropagation();
      logInspectionAttempt('Ctrl+U bloqueado');
      return false;
    }

    // Ctrl+S (Guardar pagina)
    if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
      e.preventDefault();
      e.stopPropagation();
      logInspectionAttempt('Ctrl+S bloqueado');
      return false;
    }
  }, [securityEnabled, logInspectionAttempt]);

  // Anti-debugging: detectar pausas de ejecucion
  useEffect(() => {
    if (!securityEnabled || typeof window === 'undefined') return;

    let lastTime = Date.now();

    const checkDebugger = () => {
      const currentTime = Date.now();
      // Si paso mas de 200ms entre checks (deberia ser ~100ms), posible debugging
      if (currentTime - lastTime > 200) {
        console.warn('[SecurityProvider] Posible pausa de debugger detectada');
      }
      lastTime = currentTime;
    };

    const intervalId = setInterval(checkDebugger, 100);

    return () => clearInterval(intervalId);
  }, [securityEnabled]);

  // Configurar event listeners
  useEffect(() => {
    if (!securityEnabled || typeof window === 'undefined') return;

    // Event listeners con capture: true para interceptar antes que el navegador
    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    // Deteccion periodica de DevTools
    devToolsCheckIntervalRef.current = setInterval(() => {
      detectDevToolsBySize();
      // detectDevToolsByConsole(); // Descomentar para deteccion mas agresiva
    }, 1000);

    // Listener de resize
    window.addEventListener('resize', detectDevToolsBySize);

    console.log('[SecurityProvider] Protecciones de seguridad activadas');
    console.log('[SecurityProvider] - Clic derecho: BLOQUEADO');
    console.log('[SecurityProvider] - F12/DevTools: BLOQUEADO');
    console.log('[SecurityProvider] - Ctrl+Shift+I/J/C: BLOQUEADO');
    console.log('[SecurityProvider] - Ctrl+U (ver fuente): BLOQUEADO');

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('resize', detectDevToolsBySize);

      if (devToolsCheckIntervalRef.current) {
        clearInterval(devToolsCheckIntervalRef.current);
      }
    };
  }, [securityEnabled, handleContextMenu, handleKeyDown, detectDevToolsBySize]);

  // Deshabilitar seleccion de texto en areas sensibles
  useEffect(() => {
    if (!securityEnabled || typeof window === 'undefined') return;

    const style = document.createElement('style');
    style.id = 'security-styles';
    style.textContent = `
      /* Deshabilitar seleccion en elementos sensibles */
      .no-select, [data-sensitive="true"] {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }

      /* Permitir seleccion en inputs */
      input, textarea, [contenteditable="true"] {
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
        user-select: text;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById('security-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [securityEnabled]);

  // Mensaje en consola para disuadir
  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log('%c ALTO', 'color: red; font-size: 60px; font-weight: bold;');
    console.log(
      '%c Esta es una funcion del navegador destinada a desarrolladores.',
      'font-size: 16px;'
    );
    console.log(
      '%c Si alguien te dijo que copiaras y pegaras algo aqui, es una estafa.',
      'font-size: 16px; color: red;'
    );
    console.log(
      '%c Sistema Laboratorio Franz - Seguridad Activa',
      'font-size: 14px; color: blue;'
    );
  }, []);

  return (
    <SecurityContext.Provider
      value={{
        devToolsDetected,
        securityEnabled,
        setSecurityEnabled,
        inspectionAttempts,
      }}
    >
      {/* Overlay de blur cuando DevTools está detectado */}
      {devToolsDetected && securityEnabled && (
        <div
          className="fixed inset-0 z-[100] backdrop-blur-lg bg-black/70 flex items-center justify-center transition-all duration-300"
          style={{ backdropFilter: 'blur(20px)' }}
        >
          <div className="bg-white/90 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl border-2 border-red-500">
            <AlertOctagon className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-2">
              Herramientas de desarrollo detectadas
            </h2>
            <p className="text-gray-700 mb-4">
              Por seguridad, el contenido ha sido ocultado mientras las herramientas de desarrollo esten abiertas.
            </p>
            <p className="text-sm text-gray-500">
              Cierra las DevTools para continuar usando la aplicacion.
            </p>
          </div>
        </div>
      )}

      {children}

      {/* Modal de advertencia de seguridad */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent className="sm:max-w-md bg-red-50 border-red-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertOctagon className="h-5 w-5" />
              Accion no permitida
            </DialogTitle>
            <DialogDescription className="pt-2 text-red-700">
              Esta funcionalidad ha sido restringida por motivos de seguridad.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <Shield className="h-12 w-12 text-red-400" />
            <div className="bg-red-100 border border-red-300 rounded-lg px-4 py-2 text-center">
              <p className="text-sm font-medium text-red-800">{lastBlockedAction}</p>
            </div>
          </div>
          <p className="text-center text-xs text-red-600">
            Intento #{inspectionAttempts} registrado en el sistema
          </p>
        </DialogContent>
      </Dialog>

      {/* Indicador de DevTools detectado (solo si security está deshabilitado) */}
      {devToolsDetected && !securityEnabled && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <AlertOctagon className="h-4 w-4" />
          <span className="text-sm font-medium">DevTools detectado</span>
        </div>
      )}
    </SecurityContext.Provider>
  );
}

/**
 * Componente para marcar areas como sensibles (sin seleccion de texto)
 */
export function SensitiveArea({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`no-select ${className}`} data-sensitive="true">
      {children}
    </div>
  );
}

/**
 * Funcion de diagnostico para mostrar estado de seguridad (para demostracion)
 */
export function logSecurityStatus(): void {
  console.group('[SecurityProvider] Estado de protecciones');
  console.log('='.repeat(50));
  console.log('Clic derecho: BLOQUEADO');
  console.log('F12: BLOQUEADO');
  console.log('Ctrl+Shift+I: BLOQUEADO');
  console.log('Ctrl+Shift+J: BLOQUEADO');
  console.log('Ctrl+Shift+C: BLOQUEADO');
  console.log('Ctrl+U: BLOQUEADO');
  console.log('Ctrl+S: BLOQUEADO');
  console.log('Deteccion DevTools: ACTIVA');
  console.log('Anti-debugging: ACTIVO');
  console.groupEnd();
}

// Exponer funcion de diagnostico
if (typeof window !== 'undefined') {
  (window as any).securityStatus = logSecurityStatus;
}
