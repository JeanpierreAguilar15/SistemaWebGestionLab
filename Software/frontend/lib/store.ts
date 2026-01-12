import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { secureStorage } from './secure-storage'

interface User {
  codigo_usuario: number
  cedula: string
  nombres: string
  apellidos: string
  email: string
  rol: string
  nivel_acceso: number
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  updateAccessToken: (accessToken: string) => void
  clearAuth: () => void
}

/**
 * Storage cifrado para Zustand
 * Implementa ISO/IEC 27002:2022 Control 8.24 (Uso de criptografia)
 * y NIST SP 800-53 SC-28 (Protection of Information at Rest)
 */
const encryptedStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return secureStorage.getItem(name)
  },
  setItem: async (name: string, value: string): Promise<void> => {
    return secureStorage.setItem(name, value)
  },
  removeItem: (name: string): void => {
    secureStorage.removeItem(name)
  },
}

// TEMPORAL: Cambiar a true para ver datos SIN cifrar (para documentacion)
const USE_ENCRYPTION = true

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      updateAccessToken: (accessToken) => set({ accessToken }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      storage: USE_ENCRYPTION ? createJSONStorage(() => encryptedStorage) : createJSONStorage(() => localStorage),
    }
  )
)
