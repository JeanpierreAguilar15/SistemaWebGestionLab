'use client';

/**
 * SessionContext - Control de Sesion Temporizada por Inactividad
 *
 * Implementa ISO/IEC 27002:2022 Control 8.1 (Dispositivos de usuario final)
 * y NIST SP 800-53 AC-12 (Session Termination)
 *
 * Caracteristicas:
 * - Cierre automatico de sesion tras inactividad
 * - Modal de advertencia antes de cerrar
 * - Tiempo configurable por administrador
 * - Sliding expiration (reinicio con actividad)
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock } from 'lucide-react';

// Configuracion por defecto (en minutos)
// NOTA: Para pruebas usar 0.5 (30 seg), en produccion usar 15 minutos
const DEFAULT_SESSION_TIMEOUT = 10000; // 30 segundos para pruebas (cambiar a 15 en produccion)
const WARNING_BEFORE_TIMEOUT = 0.99; // Mostrar advertencia 15 segundos antes

interface SessionContextType {
  sessionTimeout: number;
  setSessionTimeout: (minutes: number) => void;
  remainingTime: number;
  isWarningOpen: boolean;
  resetTimer: () => void;
  extendSession: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider');
  }
  return context;
}

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, clearAuth, user } = useAuthStore();

  // Obtener timeout de configuracion o usar default
  const getTimeoutDuration = useCallback(() => {
    if (typeof window === 'undefined') return DEFAULT_SESSION_TIMEOUT * 60 * 1000;
    const savedTimeout = localStorage.getItem('sessionTimeout');
    return savedTimeout ? parseFloat(savedTimeout) * 60 * 1000 : DEFAULT_SESSION_TIMEOUT * 60 * 1000;
  }, []);

  const [sessionTimeout, setSessionTimeoutState] = useState(DEFAULT_SESSION_TIMEOUT);
  const [remainingTime, setRemainingTime] = useState(getTimeoutDuration() / 1000);
  const [isWarningOpen, setIsWarningOpen] = useState(false);

  const mainTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isWarningOpenRef = useRef<boolean>(false);

  // Rutas publicas que no requieren monitoreo de sesion
  const publicRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password'];

  // Verificar si es ruta publica (exacta para '/' o startsWith para otras)
  const isPublicRoute = pathname === '/' || publicRoutes.some(route => pathname?.startsWith(route));

  // Funcion para cerrar sesion
  const logout = useCallback(() => {
    console.log('[SessionManager] Sesion cerrada por inactividad');

    // Limpiar timers primero
    if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Resetear estado
    isWarningOpenRef.current = false;
    setIsWarningOpen(false);

    // Limpiar auth y redirigir
    clearAuth();
    router.push('/auth/login?expired=true');
  }, [clearAuth, router]);

  // Funcion para reiniciar el temporizador
  const resetTimer = useCallback(() => {
    if (!isAuthenticated || isPublicRoute) return;
    if (isWarningOpenRef.current) return; // No reiniciar si el modal esta abierto (usar ref)

    const timeout = getTimeoutDuration();
    const warningTime = WARNING_BEFORE_TIMEOUT * 60 * 1000;

    // Limpiar timers existentes
    if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Actualizar tiempo restante
    setRemainingTime(timeout / 1000);
    lastActivityRef.current = Date.now();

    // Timer para mostrar advertencia
    warningTimerRef.current = setTimeout(() => {
      console.log('[SessionManager] Mostrando advertencia de sesion');
      isWarningOpenRef.current = true;
      setIsWarningOpen(true);

      // Iniciar countdown
      let countdown = warningTime / 1000;
      setRemainingTime(countdown);

      countdownRef.current = setInterval(() => {
        countdown -= 1;
        setRemainingTime(countdown);
        if (countdown <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      }, 1000);
    }, timeout - warningTime);

    // Timer principal para cerrar sesion
    mainTimerRef.current = setTimeout(() => {
      console.log('[SessionManager] Ejecutando logout automatico');
      logout();
    }, timeout);

    console.log(`[SessionManager] Timer reiniciado: ${timeout / 1000 / 60} minutos`);
  }, [isAuthenticated, isPublicRoute, getTimeoutDuration, logout]);

  // Funcion para extender la sesion (desde el modal de advertencia)
  const extendSession = useCallback(() => {
    console.log('[SessionManager] Sesion extendida por el usuario');
    isWarningOpenRef.current = false;
    setIsWarningOpen(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    // Usar setTimeout para asegurar que el ref se actualice antes de resetTimer
    setTimeout(() => resetTimer(), 0);
  }, [resetTimer]);

  // Configurar timeout
  const setSessionTimeout = useCallback((minutes: number) => {
    setSessionTimeoutState(minutes);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sessionTimeout', minutes.toString());
      console.log(`[SessionManager] Timeout configurado: ${minutes} minutos`);
    }
    resetTimer();
  }, [resetTimer]);

  // Configurar event listeners (solo una vez al montar)
  useEffect(() => {
    if (!isAuthenticated || isPublicRoute) return;

    // Eventos de actividad del usuario
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const activityHandler = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 1000 && !isWarningOpenRef.current) {
        lastActivityRef.current = now;
        // Solo reiniciar si NO estamos en warning
        if (!isWarningOpenRef.current) {
          resetTimer();
        }
      }
    };

    events.forEach(event => {
      document.addEventListener(event, activityHandler, { passive: true });
    });

    console.log('[SessionManager] Monitor de inactividad activado');

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, activityHandler);
      });
      // Solo limpiar timers si NO estamos en warning (desmontaje real)
      if (!isWarningOpenRef.current) {
        if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    };
  }, [isAuthenticated, isPublicRoute, resetTimer]);

  // Iniciar timer cuando cambie autenticacion
  useEffect(() => {
    if (isAuthenticated && !isPublicRoute && !isWarningOpenRef.current) {
      resetTimer();
    }
  }, [isAuthenticated, isPublicRoute, resetTimer]);

  // Cargar configuracion inicial
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sessionTimeout');
      if (saved) {
        setSessionTimeoutState(parseFloat(saved));
      }
    }
  }, []);

  return (
    <SessionContext.Provider
      value={{
        sessionTimeout,
        setSessionTimeout,
        remainingTime,
        isWarningOpen,
        resetTimer,
        extendSession,
      }}
    >
      {/* Overlay de blur cuando el modal está abierto */}
      {isWarningOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-md bg-black/50 transition-all duration-300"
          style={{ backdropFilter: 'blur(8px)' }}
        />
      )}

      {children}

      {/* Modal de advertencia de sesion */}
      <Dialog open={isWarningOpen} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Sesion a punto de expirar
            </DialogTitle>
            <DialogDescription>
              Tu sesion se cerrara automaticamente por inactividad para proteger tus datos.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-center justify-center gap-3 py-4 bg-amber-50 rounded-lg border border-amber-200">
              <Clock className="h-6 w-6 text-amber-600 animate-pulse" />
              <span className="text-lg font-medium text-amber-700">La sesion expira en breve</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Haz clic en "Seguir conectado" para continuar trabajando
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={logout}>
              Cerrar sesion
            </Button>
            <Button onClick={extendSession}>
              Seguir conectado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SessionContext.Provider>
  );
}

/**
 * Hook para verificar si hay token activo (para proteccion de rutas)
 */
export function useSessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    const publicRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password'];
    const isPublicRoute = pathname === '/' || publicRoutes.some(route => pathname?.startsWith(route));

    if (!isAuthenticated && !isPublicRoute) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, pathname, router]);

  return isAuthenticated;
}
