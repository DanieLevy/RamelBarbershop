'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useDevAuthStore } from '@/store/useDevAuthStore'
import { DevNavbar } from '@/components/dev/DevNavbar'
import { Loader2, LogOut, Terminal } from 'lucide-react'

export default function DevLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isDevLoggedIn, isInitialized, devEmail, devLogout, checkDevSession } = useDevAuthStore()

  // Check session on mount
  useEffect(() => {
    checkDevSession()
  }, [checkDevSession])

  // Redirect to login if not authenticated (except on login page)
  useEffect(() => {
    if (isInitialized && !isDevLoggedIn && pathname !== '/dev/login') {
      router.replace('/dev/login')
    }
  }, [isInitialized, isDevLoggedIn, pathname, router])

  // Handle logout
  const handleLogout = () => {
    devLogout()
    router.replace('/dev/login')
  }

  // Show loading while checking session
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={32} className="text-emerald-500 animate-spin" />
      </div>
    )
  }

  // Don't show layout for login page
  if (pathname === '/dev/login') {
    return <>{children}</>
  }

  // Redirect if not logged in
  if (!isDevLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={32} className="text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-800 safe-area-top">
        <div className="flex items-center justify-between h-14 px-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Terminal size={16} className="text-emerald-500" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Dev Console</h1>
              <p className="text-[10px] text-zinc-500">{devEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center justify-center"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14 pb-20 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <DevNavbar />
    </div>
  )
}
