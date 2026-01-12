'use client'

interface AdminMobileHeaderProps {
    setSidebarOpen: (open: boolean) => void
}

export function AdminMobileHeader({ setSidebarOpen }: AdminMobileHeaderProps) {
    return (
        <div className="sticky top-0 z-10 md:hidden bg-white border-b border-lab-neutral-200 px-4 py-3 flex items-center justify-between">
            <button onClick={() => setSidebarOpen(true)} className="text-lab-neutral-600 hover:text-lab-neutral-900">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            <div className="text-lg font-bold text-lab-neutral-900">Admin Panel</div>
            <div className="w-6"></div>
        </div>
    )
}
