'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDevAuthStore } from '@/store/useDevAuthStore'
import { Loader2, Terminal, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DevLoginPage() {
  const router = useRouter()
  const { isDevLoggedIn, isInitialized, devLogin, checkDevSession } = useDevAuthStore()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Check existing session on mount
  useEffect(() => {
    checkDevSession()
  }, [checkDevSession])

  // Redirect if already logged in
  useEffect(() => {
    if (isInitialized && isDevLoggedIn) {
      router.replace('/dev')
    }
  }, [isInitialized, isDevLoggedIn, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address')
      return
    }
    
    // Validate password
    if (!password) {
      setError('Please enter your password')
      return
    }
    
    setLoading(true)
    setError(null)
    
    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const result = devLogin(email, password)
    
    if (result.success) {
      router.push('/dev')
    } else {
      // More specific error messages
      if (result.error?.includes('not found') || result.error?.includes('user')) {
        setError('Email not registered for developer access')
      } else if (result.error?.includes('password') || result.error?.includes('invalid')) {
        setError('Incorrect password')
      } else {
        setError(result.error || 'Login failed. Please check your credentials.')
      }
    }
    
    setLoading(false)
  }

  // Show loading while checking session
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={32} className="text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <Terminal size={32} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Developer Console</h1>
        <p className="text-zinc-500 text-sm">Read-only access to system data</p>
      </div>

      {/* Login Form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
      >
        {/* Security Notice */}
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Shield size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-200 text-xs">
            This console provides read-only access to all system data. Authorized personnel only.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Email Input */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-zinc-400 text-sm">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="developer@example.com"
            autoComplete="email"
            className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
          />
        </div>

        {/* Password Input */}
        <div className="space-y-2">
          <label htmlFor="password" className="text-zinc-400 text-sm">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
            loading
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98]'
          )}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <span>Access Console</span>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-zinc-600 text-xs">
        Ramel Barbershop Developer Tools v1.0
      </p>
    </div>
  )
}
