'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Lock, Mail, Eye, EyeOff, ChevronRight, AlertTriangle } from 'lucide-react'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import Image from 'next/image'

export default function BarberLoginPage() {
  const router = useRouter()
  const { login, isLoggedIn, isLoading, checkSession, isInitialized } = useBarberAuthStore()
  const { 
    isLoggedIn: isCustomerLoggedIn, 
    customer, 
    logout: customerLogout,
    isInitialized: isCustomerInitialized,
    checkSession: checkCustomerSession 
  } = useAuthStore()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkSession()
    checkCustomerSession()
  }, [checkSession, checkCustomerSession])

  useEffect(() => {
    if (isInitialized && isLoggedIn) {
      router.replace('/barber/dashboard')
    }
  }, [isInitialized, isLoggedIn, router])
  
  // Check if both auth stores are initialized
  const isFullyInitialized = isInitialized && isCustomerInitialized

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || !password) {
      setError('נא למלא את כל השדות')
      return
    }
    
    setLoading(true)
    setError(null)
    
    const result = await login(email, password)
    
    if (result.success) {
      router.push('/barber/dashboard')
    } else {
      setError(result.error || 'שגיאה בהתחברות')
    }
    
    setLoading(false)
  }

  if (!isFullyInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <ScissorsLoader size="lg" text="טוען..." />
      </div>
    )
  }

  if (isLoggedIn) {
    return null
  }

  // Show blocked state if customer is logged in
  if (isCustomerLoggedIn && customer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-dark px-4 py-8 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.02]">
          <div 
            className="w-full h-full"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>
        
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-background-card/80 backdrop-blur-lg border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle size={40} strokeWidth={1.5} className="text-amber-400" />
              </div>
              <h1 className="text-xl font-medium text-foreground-light text-center">
                לא ניתן להתחבר
              </h1>
              <p className="text-foreground-light text-center">
                אתה מחובר כלקוח
              </p>
              <p className="text-foreground-muted text-sm text-center">
                {customer.fullname}
              </p>
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 my-4">
              <p className="text-amber-400 text-sm text-center">
                לא ניתן להתחבר לשני סוגי חשבונות בו-זמנית.
                <br />
                יש להתנתק מחשבון הלקוח כדי להתחבר כספר.
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  customerLogout()
                }}
                className="w-full py-3.5 rounded-xl font-medium transition-all flex items-center justify-center bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
              >
                התנתק מחשבון הלקוח
              </button>
              
              <Link
                href="/"
                className="w-full py-3.5 rounded-xl font-medium transition-all flex items-center justify-center border border-white/20 text-foreground-light hover:bg-white/5"
              >
                חזרה לאתר
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-dark px-4 py-8 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-accent-gold/20 blur-xl scale-150" />
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-accent-gold/30 shadow-gold">
              <Image
                src="/icon.png"
                alt="Ramel Barbershop"
                width={112}
                height={112}
                className="w-full h-full object-cover"
                priority
              />
            </div>
          </div>
        </div>
        
        {/* Card */}
        <div className="bg-background-card/80 backdrop-blur-lg border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <h1 className="text-xl sm:text-2xl font-medium text-foreground-light text-center mb-2">
            כניסה לספרים
          </h1>
          <p className="text-foreground-muted text-sm text-center mb-8">
            התחבר לניהול התורים והשירותים שלך
          </p>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-foreground-light text-sm">
                אימייל
              </label>
              <div className="relative">
                <Mail size={16} strokeWidth={1.5} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                <input
                  id="email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                  placeholder="your@email.com"
                  className={cn(
                    'w-full p-3.5 pr-10 rounded-xl bg-background-dark border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-left text-sm sm:text-base',
                    error ? 'border-red-400' : 'border-white/10'
                  )}
                />
              </div>
            </div>
            
            {/* Password */}
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-foreground-light text-sm">
                סיסמה
              </label>
              <div className="relative">
                <Lock size={16} strokeWidth={1.5} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                  placeholder="••••••••"
                  className={cn(
                    'w-full p-3.5 pr-10 pl-10 rounded-xl bg-background-dark border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-left text-sm sm:text-base',
                    error ? 'border-red-400' : 'border-white/10'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-foreground-muted hover:text-foreground-light transition-colors"
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading || isLoading}
              className={cn(
                'w-full py-3.5 rounded-xl font-medium transition-all text-base sm:text-lg mt-2 flex items-center justify-center',
                loading || isLoading
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90 hover:scale-[1.02] active:scale-[0.98]'
              )}
            >
              {loading || isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin mr-2" />
                  מתחבר...
                </>
              ) : (
                'התחבר'
              )}
            </button>
          </form>
        </div>
        
        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-foreground-muted hover:text-foreground-light text-sm transition-colors py-2"
          >
            <ChevronRight size={12} strokeWidth={1.5} />
            <span>חזרה לאתר</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
