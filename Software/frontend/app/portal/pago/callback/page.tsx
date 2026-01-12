'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PagoCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accessToken = useAuthStore((state) => state.accessToken)

  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    cotizacion?: any
  } | null>(null)

  useEffect(() => {
    confirmarPago()
  }, [])

  const confirmarPago = async () => {
    try {
      // PayPhone retorna estos parámetros en la URL
      const id = searchParams.get('id')
      const clientTransactionId = searchParams.get('clientTransactionId')

      if (!id || !clientTransactionId) {
        setResult({
          success: false,
          message: 'Parámetros de pago no encontrados. Por favor contacte al laboratorio.',
        })
        setLoading(false)
        return
      }

      // Llamar al backend para confirmar el pago
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/cotizaciones/payphone/confirmar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // No enviamos token porque es un callback público
          },
          body: JSON.stringify({ id, clientTransactionId }),
        }
      )

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setResult({
          success: false,
          message: data.message || 'Error al procesar el pago',
        })
      }
    } catch (error) {
      console.error('Error confirming payment:', error)
      setResult({
        success: false,
        message: 'Error de conexión. Por favor contacte al laboratorio.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-lab-primary-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-lab-neutral-800">
            Verificando pago...
          </h2>
          <p className="text-lab-neutral-600 mt-2">
            Por favor espere mientras confirmamos su transacción
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <Card>
        <CardHeader className="text-center">
          {result?.success ? (
            <>
              <div className="w-16 h-16 bg-lab-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-lab-success-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <CardTitle className="text-2xl text-lab-success-700">
                Pago Exitoso
              </CardTitle>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-lab-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-lab-danger-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <CardTitle className="text-2xl text-lab-danger-700">
                Pago No Completado
              </CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-lab-neutral-600">{result?.message}</p>

          {result?.success && result?.cotizacion && (
            <div className="bg-lab-neutral-50 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-lab-neutral-900 mb-2">
                Detalles de la transacción
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-lab-neutral-600">Cotización:</span>
                  <span className="font-medium">
                    {result.cotizacion.numero_cotizacion}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lab-neutral-600">Total pagado:</span>
                  <span className="font-medium text-lab-success-600">
                    ${Number(result.cotizacion.total || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lab-neutral-600">Estado:</span>
                  <span className="font-medium text-lab-success-600">
                    PAGADA
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {result?.success ? (
              <>
                <Button
                  className="w-full"
                  onClick={() => router.push('/portal/citas')}
                >
                  Agendar Cita
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/portal/cotizaciones')}
                >
                  Ver Mis Cotizaciones
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="w-full"
                  onClick={() => router.push('/portal/cotizaciones')}
                >
                  Volver a Cotizaciones
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/portal')}
                >
                  Ir al Inicio
                </Button>
              </>
            )}
          </div>

          <p className="text-xs text-lab-neutral-500">
            Si tiene alguna duda sobre su pago, por favor contacte al laboratorio.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
