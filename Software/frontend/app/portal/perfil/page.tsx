'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UserProfile {
  codigo_usuario: number
  cedula: string
  nombres: string
  apellidos: string
  email: string
  telefono: string
  direccion: string
  fecha_nacimiento: string
  genero: 'M' | 'F' | 'O'
  contacto_emergencia_nombre: string
  contacto_emergencia_telefono: string
}

interface Consentimiento {
  tipo: 'USO_DATOS' | 'NOTIFICACIONES' | 'NOTIFICACIONES_WHATSAPP' | 'COMPARTIR_INFO'
  label: string
  descripcion: string
  aceptado: boolean
}

export default function PerfilPage() {
  const user = useAuthStore((state) => state.user)
  const accessToken = useAuthStore((state) => state.accessToken)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  const [profileData, setProfileData] = useState<UserProfile>({
    codigo_usuario: user?.codigo_usuario || 0,
    cedula: user?.cedula || '',
    nombres: user?.nombres || '',
    apellidos: user?.apellidos || '',
    email: user?.email || '',
    telefono: '',
    direccion: '',
    fecha_nacimiento: '',
    genero: 'O',
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: '',
  })

  const [consentimientos, setConsentimientos] = useState<Consentimiento[]>([
    {
      tipo: 'USO_DATOS',
      label: 'Uso de Datos Personales',
      descripcion: 'Autorizo el uso de mis datos personales para fines del laboratorio',
      aceptado: false,
    },
    {
      tipo: 'NOTIFICACIONES',
      label: 'Recibir Notificaciones por Email',
      descripcion: 'Acepto recibir notificaciones por email sobre mis citas y resultados',
      aceptado: false,
    },
    {
      tipo: 'NOTIFICACIONES_WHATSAPP',
      label: 'Recibir Notificaciones por WhatsApp',
      descripcion: 'Acepto recibir notificaciones por WhatsApp cuando mis resultados estén listos',
      aceptado: false,
    },
    {
      tipo: 'COMPARTIR_INFO',
      label: 'Compartir Información',
      descripcion: 'Autorizo compartir mi información con profesionales de la salud',
      aceptado: false,
    },
  ])

  const [changePassword, setChangePassword] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Cargar datos del perfil
  useEffect(() => {
    loadProfile()
    loadConsentimientos()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/perfil`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setProfileData({
          ...data,
          fecha_nacimiento: data.fecha_nacimiento ? data.fecha_nacimiento.split('T')[0] : '',
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadConsentimientos = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/consentimientos`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setConsentimientos((prev) =>
          prev.map((consent) => ({
            ...consent,
            aceptado: data.find((d: any) => d.tipo_consentimiento === consent.tipo)?.aceptado || false,
          }))
        )
      }
    } catch (error) {
      console.error('Error loading consentimientos:', error)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(profileData),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Perfil actualizado correctamente' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al actualizar el perfil' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveConsentimientos = async () => {
    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/consentimientos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(consentimientos),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Consentimientos actualizados correctamente' })
      } else {
        setMessage({ type: 'error', text: 'Error al actualizar los consentimientos' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (changePassword.newPassword !== changePassword.confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' })
      return
    }

    if (changePassword.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 8 caracteres' })
      return
    }

    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/cambiar-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: changePassword.currentPassword,
          newPassword: changePassword.newPassword,
        }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Contraseña cambiada correctamente' })
        setChangePassword({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || 'Error al cambiar la contraseña' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al servidor' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-lab-neutral-900">Mi Perfil</h1>
        <p className="text-lab-neutral-600 mt-2">Gestiona tu información personal y preferencias</p>
      </div>

      {/* Mensaje de respuesta */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-lab-success-50 text-lab-success-800 border border-lab-success-200'
              : 'bg-lab-danger-50 text-lab-danger-800 border border-lab-danger-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Información Personal */}
      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
          <CardDescription>Actualiza tus datos personales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cedula">Cédula *</Label>
              <Input
                id="cedula"
                value={profileData.cedula}
                disabled
                className="bg-lab-neutral-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombres">Nombres *</Label>
              <Input
                id="nombres"
                value={profileData.nombres}
                onChange={(e) => setProfileData({ ...profileData, nombres: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos *</Label>
              <Input
                id="apellidos"
                value={profileData.apellidos}
                onChange={(e) => setProfileData({ ...profileData, apellidos: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={profileData.telefono}
                onChange={(e) => setProfileData({ ...profileData, telefono: e.target.value })}
                placeholder="0987654321"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
              <Input
                id="fecha_nacimiento"
                type="date"
                value={profileData.fecha_nacimiento}
                onChange={(e) => setProfileData({ ...profileData, fecha_nacimiento: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="genero">Género</Label>
              <select
                id="genero"
                value={profileData.genero}
                onChange={(e) => setProfileData({ ...profileData, genero: e.target.value as 'M' | 'F' | 'O' })}
                className="w-full h-10 px-3 rounded-md border border-lab-neutral-300 focus:outline-none focus:ring-2 focus:ring-lab-primary-500"
              >
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={profileData.direccion}
                onChange={(e) => setProfileData({ ...profileData, direccion: e.target.value })}
                placeholder="Calle Principal #123, Ciudad"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-lab-neutral-200">
            <h3 className="text-lg font-semibold text-lab-neutral-900 mb-4">Contacto de Emergencia</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="contacto_nombre">Nombre Completo</Label>
                <Input
                  id="contacto_nombre"
                  value={profileData.contacto_emergencia_nombre}
                  onChange={(e) =>
                    setProfileData({ ...profileData, contacto_emergencia_nombre: e.target.value })
                  }
                  placeholder="Juan Pérez"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contacto_telefono">Teléfono</Label>
                <Input
                  id="contacto_telefono"
                  value={profileData.contacto_emergencia_telefono}
                  onChange={(e) =>
                    setProfileData({ ...profileData, contacto_emergencia_telefono: e.target.value })
                  }
                  placeholder="0987654321"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={saving} className="min-w-[150px]">
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Consentimientos */}
      <Card>
        <CardHeader>
          <CardTitle>Consentimientos y Permisos</CardTitle>
          <CardDescription>Gestiona tus preferencias de privacidad</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {consentimientos.map((consent) => (
            <div key={consent.tipo} className="flex items-start space-x-3 p-4 rounded-lg border border-lab-neutral-200">
              <input
                type="checkbox"
                id={consent.tipo}
                checked={consent.aceptado}
                onChange={(e) =>
                  setConsentimientos((prev) =>
                    prev.map((c) =>
                      c.tipo === consent.tipo ? { ...c, aceptado: e.target.checked } : c
                    )
                  )
                }
                className="mt-1 h-4 w-4 rounded border-lab-neutral-300 text-lab-primary-600 focus:ring-lab-primary-500"
              />
              <div className="flex-1">
                <label htmlFor={consent.tipo} className="font-medium text-lab-neutral-900 cursor-pointer">
                  {consent.label}
                </label>
                <p className="text-sm text-lab-neutral-600 mt-1">{consent.descripcion}</p>
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveConsentimientos} disabled={saving} className="min-w-[150px]">
              {saving ? 'Guardando...' : 'Actualizar Consentimientos'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cambiar Contraseña */}
      <Card>
        <CardHeader>
          <CardTitle>Cambiar Contraseña</CardTitle>
          <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="current_password">Contraseña Actual *</Label>
              <Input
                id="current_password"
                type="password"
                value={changePassword.currentPassword}
                onChange={(e) => setChangePassword({ ...changePassword, currentPassword: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password">Nueva Contraseña *</Label>
              <Input
                id="new_password"
                type="password"
                value={changePassword.newPassword}
                onChange={(e) => setChangePassword({ ...changePassword, newPassword: e.target.value })}
              />
              <p className="text-xs text-lab-neutral-500">Mínimo 8 caracteres</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirmar Nueva Contraseña *</Label>
              <Input
                id="confirm_password"
                type="password"
                value={changePassword.confirmPassword}
                onChange={(e) => setChangePassword({ ...changePassword, confirmPassword: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={saving || !changePassword.currentPassword || !changePassword.newPassword}
              className="min-w-[150px]"
            >
              {saving ? 'Cambiando...' : 'Cambiar Contraseña'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
