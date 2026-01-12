'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminMobileHeader } from '@/components/admin/AdminMobileHeader'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    // Verificar que el usuario sea administrador
    if (user?.rol !== 'ADMIN') {
      router.push('/portal')
      return
    }
  }, [isAuthenticated, user, router])

  if (!isAuthenticated || !user || user?.rol !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lab-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-lab-neutral-50">
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <AdminMobileHeader setSidebarOpen={setSidebarOpen} />

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6 px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
