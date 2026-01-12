'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PagoCanceladoPage() {
  const router = useRouter()

  return (
    <div className="max-w-lg mx-auto py-8">
      <Card>
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-lab-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-lab-warning-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl text-lab-warning-700">
            Pago Cancelado
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-lab-neutral-600">
            Has cancelado el proceso de pago. Tu cotización sigue activa y puedes intentar pagar nuevamente cuando lo desees.
          </p>

          <div className="bg-lab-neutral-50 rounded-lg p-4">
            <h3 className="font-semibold text-lab-neutral-900 mb-2">
              Opciones disponibles
            </h3>
            <ul className="text-sm text-lab-neutral-600 space-y-2 text-left">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-lab-primary-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Intentar pagar nuevamente con tarjeta</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-lab-primary-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Elegir pagar en ventanilla al llegar al laboratorio</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-lab-primary-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Generar una nueva cotización</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => router.push('/portal/cotizaciones')}
            >
              Volver a Mis Cotizaciones
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/portal')}
            >
              Ir al Inicio
            </Button>
          </div>

          <p className="text-xs text-lab-neutral-500">
            Tu cotización permanecerá activa por 30 días desde su creación.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
