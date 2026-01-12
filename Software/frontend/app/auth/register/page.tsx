'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi, ApiError } from '@/lib/api'
import { validateCedulaEcuador, checkPasswordStrength, type PasswordStrengthResult } from '@/lib/utils'

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    cedula: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrengthResult | null>(null)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!validateCedulaEcuador(formData.cedula)) {
      newErrors.cedula = 'Cédula ecuatoriana inválida'
    }

    if (formData.nombres.length < 2) {
      newErrors.nombres = 'Los nombres deben tener al menos 2 caracteres'
    }

    if (formData.apellidos.length < 2) {
      newErrors.apellidos = 'Los apellidos deben tener al menos 2 caracteres'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Correo electrónico inválido'
    }

    if (formData.telefono && !/^(09\d{8}|0[2-7]\d{7})$/.test(formData.telefono)) {
      newErrors.telefono = 'Teléfono debe ser formato ecuatoriano (09XXXXXXXX o 02XXXXXXX)'
    }

    if (formData.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres'
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(formData.password)) {
      newErrors.password = 'La contraseña debe incluir mayúsculas, minúsculas y números'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const { confirmPassword, ...registerData } = formData
      await authApi.register(registerData)
      router.push('/auth/login?registered=true')
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message)
      } else {
        setApiError('Error al registrarse. Por favor intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Check password strength in real-time
    if (field === 'password') {
      setPasswordStrength(checkPasswordStrength(value))
    }

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-lab-primary-50 via-white to-lab-success-50 p-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* Logo y Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block">
            <div className="flex justify-center mb-4">
              <div className="bg-lab-primary-600 text-white rounded-2xl p-4">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-lab-neutral-900">Crea tu Cuenta</h1>
          <p className="text-lab-neutral-600">Registra tus datos para acceder al portal del paciente</p>
        </div>

        {/* Register Card */}
        <Card className="border-lab-neutral-200 shadow-xl">
          <CardHeader>
            <CardTitle>Registro de Paciente</CardTitle>
            <CardDescription>
              Completa todos los campos para crear tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {apiError && (
                <div className="p-3 rounded-lg bg-lab-danger-50 border border-lab-danger-200 text-lab-danger-700 text-sm">
                  {apiError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cedula">Cédula *</Label>
                  <Input
                    id="cedula"
                    type="text"
                    placeholder="1234567890"
                    maxLength={10}
                    value={formData.cedula}
                    onChange={(e) => handleChange('cedula', e.target.value)}
                    required
                    disabled={loading}
                  />
                  {errors.cedula && (
                    <p className="text-sm text-lab-danger-600">{errors.cedula}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    required
                    disabled={loading}
                  />
                  {errors.email && (
                    <p className="text-sm text-lab-danger-600">{errors.email}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombres">Nombres *</Label>
                  <Input
                    id="nombres"
                    type="text"
                    placeholder="Juan Carlos"
                    value={formData.nombres}
                    onChange={(e) => handleChange('nombres', e.target.value)}
                    required
                    disabled={loading}
                  />
                  {errors.nombres && (
                    <p className="text-sm text-lab-danger-600">{errors.nombres}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apellidos">Apellidos *</Label>
                  <Input
                    id="apellidos"
                    type="text"
                    placeholder="Pérez García"
                    value={formData.apellidos}
                    onChange={(e) => handleChange('apellidos', e.target.value)}
                    required
                    disabled={loading}
                  />
                  {errors.apellidos && (
                    <p className="text-sm text-lab-danger-600">{errors.apellidos}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono (opcional)</Label>
                <Input
                  id="telefono"
                  type="tel"
                  placeholder="0987654321"
                  maxLength={10}
                  value={formData.telefono}
                  onChange={(e) => handleChange('telefono', e.target.value)}
                  disabled={loading}
                />
                {errors.telefono && (
                  <p className="text-sm text-lab-danger-600">{errors.telefono}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    required
                    disabled={loading}
                  />
                  {errors.password && (
                    <p className="text-sm text-lab-danger-600">{errors.password}</p>
                  )}

                  {/* Password Strength Meter */}
                  {formData.password && passwordStrength && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-lab-neutral-600">Fortaleza:</span>
                        <span className={`font-semibold ${passwordStrength.color}`}>
                          {passwordStrength.label}
                        </span>
                      </div>

                      {/* Strength Bar */}
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => {
                          let bgColor = 'bg-lab-neutral-200'
                          if (passwordStrength.score >= level * 2) {
                            if (passwordStrength.strength === 'weak') bgColor = 'bg-lab-danger-500'
                            else if (passwordStrength.strength === 'moderate') bgColor = 'bg-lab-warning-500'
                            else if (passwordStrength.strength === 'strong') bgColor = 'bg-lab-success-500'
                            else if (passwordStrength.strength === 'very-strong') bgColor = 'bg-lab-success-600'
                          }
                          return (
                            <div
                              key={level}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${bgColor}`}
                            />
                          )
                        })}
                      </div>

                      {/* Feedback */}
                      {passwordStrength.feedback.length > 0 && (
                        <div className="space-y-1">
                          {passwordStrength.feedback.map((tip, idx) => (
                            <p key={idx} className="text-xs text-lab-neutral-500 flex items-start">
                              <span className="mr-1">•</span>
                              <span>{tip}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!formData.password && (
                    <p className="text-xs text-lab-neutral-500">
                      Mínimo 8 caracteres, incluye mayúsculas, minúsculas y números
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    required
                    disabled={loading}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-lab-danger-600">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                </Button>
              </div>

              <div className="text-center text-sm text-lab-neutral-600">
                ¿Ya tienes una cuenta?{' '}
                <Link
                  href="/auth/login"
                  className="text-lab-primary-600 hover:text-lab-primary-700 font-medium hover:underline"
                >
                  Inicia sesión aquí
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
    </div>
  )
}
