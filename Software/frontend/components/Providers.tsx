'use client';

/**
 * Providers - Componente que agrupa todos los providers de la aplicacion
 *
 * Incluye:
 * - SessionProvider: Control de sesion temporizada (AC-12)
 * - SecurityProvider: Proteccion anti-debugging (SA-15)
 */

import { SessionProvider } from '@/contexts/SessionContext';
import { SecurityProvider } from '@/contexts/SecurityProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SecurityProvider>
      <SessionProvider>
        {children}
      </SessionProvider>
    </SecurityProvider>
  );
}

export default Providers;
