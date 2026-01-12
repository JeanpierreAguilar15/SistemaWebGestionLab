'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [shake, setShake] = useState(false)
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (shake) {
      const timer = setTimeout(() => setShake(false), 400)
      return () => clearTimeout(timer)
    }
  }, [shake])

  // Countdown timer for blocked account
  useEffect(() => {
    if (blockTimeRemaining > 0) {
      const timer = setInterval(() => {
        setBlockTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsBlocked(false)
            setError('')
            setFailedAttempts(0)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [blockTimeRemaining])

  // Parse error message to detect account blocking
  const parseBlockMessage = useCallback((message: string) => {
    // Check for Spanish or English block messages
    const blockPatterns = [
      /bloqueada.*?(\d+)\s*minuto/i,
      /bloqueado.*?(\d+)\s*minuto/i,
      /blocked.*?(\d+)\s*minute/i,
      /intente.*?(\d+)\s*minuto/i,
      /try.*?(\d+)\s*minute/i,
    ]

    for (const pattern of blockPatterns) {
      const match = message.match(pattern)
      if (match) {
        return parseInt(match[1], 10) * 60 // Convert minutes to seconds
      }
    }

    // Check for seconds-based messages
    const secondsPattern = /(\d+)\s*segundo/i
    const secondsMatch = message.match(secondsPattern)
    if (secondsMatch) {
      return parseInt(secondsMatch[1], 10)
    }

    return 0
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Don't allow submission if blocked
    if (isBlocked) return

    setError('')
    setLoading(true)

    try {
      const data = await authApi.login(identifier, password)
      setAuth(data.user, data.access_token, data.refresh_token)
      setSuccess(true)
      setFailedAttempts(0)

      await new Promise(resolve => setTimeout(resolve, 600))

      if (data.user.rol === 'ADMIN' || data.user.rol === 'Administrador') {
        router.push('/admin')
      } else {
        router.push('/portal')
      }
    } catch (err) {
      setShake(true)
      setFailedAttempts((prev) => prev + 1)

      if (err instanceof ApiError) {
        const errorMessage = err.message
        setError(errorMessage)

        // Check if account is blocked
        const blockSeconds = parseBlockMessage(errorMessage)
        if (blockSeconds > 0) {
          setIsBlocked(true)
          setBlockTimeRemaining(blockSeconds)
        }
      } else {
        setError('Error al iniciar sesión. Por favor intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Format remaining time as MM:SS
  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-lab-primary-50 via-white to-lab-success-50 p-4">
      <div
        className={`w-full max-w-md space-y-6 transition-opacity duration-500 ${
          mounted ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Logo y Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className={`bg-lab-primary-600 text-white rounded-2xl p-4 shadow-lg transition-colors duration-300 ${
              success ? 'bg-green-500' : ''
            }`}>
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-lab-neutral-900">Laboratorio Franz</h1>
          <p className="text-lab-neutral-600">Bienvenido de vuelta</p>
        </div>

        {/* Login Card */}
        <Card className={`border-lab-neutral-200 shadow-xl transition-all duration-300 ${
          shake ? 'animate-shake' : ''
        } ${success ? 'border-green-300' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {success ? (
                <>
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-600">¡Bienvenido!</span>
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </CardTitle>
            <CardDescription>
              {success ? 'Redirigiendo al sistema...' : 'Ingresa tu cédula o correo electrónico'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Mensaje de cuenta bloqueada con temporizador */}
              {isBlocked && (
                <div className="p-4 rounded-lg bg-red-50 border-2 border-red-300 animate-pulse-border">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <svg className="w-12 h-12 text-red-200" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="rgb(239 68 68)"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray="283"
                          strokeDashoffset={283 - (blockTimeRemaining / 300) * 283}
                          transform="rotate(-90 50 50)"
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-red-800">Cuenta bloqueada temporalmente</p>
                      <p className="text-sm text-red-600 mt-1">
                        Demasiados intentos fallidos. Intente de nuevo en:
                      </p>
                      <p className="text-2xl font-bold text-red-700 mt-1 font-mono">
                        {formatTimeRemaining(blockTimeRemaining)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mensaje de error normal (no bloqueado) */}
              <div className={`overflow-hidden transition-all duration-200 ${
                error && !isBlocked ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="p-3 rounded-lg bg-lab-danger-50 border border-lab-danger-200 text-lab-danger-700 text-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                  {failedAttempts >= 3 && failedAttempts < 5 && (
                    <p className="mt-2 text-xs text-red-500 font-medium">
                      Advertencia: {5 - failedAttempts} intentos restantes antes del bloqueo
                    </p>
                  )}
                </div>
              </div>

              {/* Mensaje de éxito */}
              <div className={`overflow-hidden transition-all duration-200 ${
                success ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Inicio de sesión exitoso. Cargando...</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="identifier">Cédula o Correo Electrónico</Label>
                <div className="relative">
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="1234567890 o correo@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    disabled={loading || success}
                    className={`pl-10 transition-colors duration-200 ${
                      error ? 'border-lab-danger-300' : ''
                    } ${success ? 'border-green-300 bg-green-50/30' : ''}`}
                  />
                  <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-lab-primary-600 hover:text-lab-primary-700 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading || success}
                    className={`pl-10 pr-10 transition-colors duration-200 ${
                      error ? 'border-lab-danger-300' : ''
                    } ${success ? 'border-green-300 bg-green-50/30' : ''}`}
                  />
                  <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-lab-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading || success}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lab-neutral-400 hover:text-lab-neutral-600 transition-colors disabled:opacity-50"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className={`w-full h-11 text-base font-medium transition-colors duration-200 ${
                  success ? 'bg-green-500 hover:bg-green-600' : ''
                } ${isBlocked ? 'bg-gray-400 cursor-not-allowed' : ''}`}
                disabled={loading || success || isBlocked}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verificando...</span>
                  </div>
                ) : success ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Acceso concedido</span>
                  </div>
                ) : isBlocked ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Cuenta bloqueada</span>
                  </div>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>

              <div className={`text-center text-sm text-lab-neutral-600 transition-opacity duration-200 ${
                success ? 'opacity-50' : ''
              }`}>
                ¿No tienes una cuenta?{' '}
                <Link
                  href="/auth/register"
                  className="text-lab-primary-600 hover:text-lab-primary-700 font-medium hover:underline"
                >
                  Regístrate aquí
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-lab-neutral-500">
          © 2025 Laboratorio Clínico Franz. Todos los derechos reservados.
        </p>
      </div>

      {/* Animación sutil de shake */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  )
}
