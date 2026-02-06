'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Lock, Mail, Eye, EyeOff, ChevronRight, AlertTriangle, UserX, KeyRound, WifiOff, Info } from 'lucide-react'
import { Button } from '@heroui/react'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import Image from 'next/image'
import type { LoginErrorCode } from '@/lib/auth/barber-auth'

// Error display configuration for different error types
const ERROR_CONFIG: Record<LoginErrorCode, { 
  icon: typeof AlertTriangle
  color: string
  bgColor: string
  borderColor: string
}> = {
  USER_NOT_FOUND: { icon: UserX, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  WRONG_PASSWORD: { icon: KeyRound, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
  NO_PASSWORD_SET: { icon: Info, color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  NOT_A_BARBER: { icon: Info, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  DATABASE_ERROR: { icon: AlertTriangle, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
  NETWORK_ERROR: { icon: WifiOff, color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  INVALID_INPUT: { icon: AlertTriangle, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
}

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
  const [errorCode, setErrorCode] = useState<LoginErrorCode | null>(null)
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
    
    // Clear previous errors
    setError(null)
    setErrorCode(null)
    
    // Client-side validation with specific messages
    if (!email.trim()) {
      setError('נא להזין כתובת אימייל')
      setErrorCode('INVALID_INPUT')
      return
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('כתובת האימייל אינה תקינה')
      setErrorCode('INVALID_INPUT')
      return
    }
    
    if (!password) {
      setError('נא להזין סיסמה')
      setErrorCode('INVALID_INPUT')
      return
    }
    
    if (password.length < 4) {
      setError('הסיסמה קצרה מדי')
      setErrorCode('INVALID_INPUT')
      return
    }
    
    setLoading(true)
    
    const result = await login(email, password)
    
    if (result.success) {
      router.push('/barber/dashboard')
    } else {
      setError(result.error || 'שגיאה בהתחברות')
      setErrorCode(result.errorCode || null)
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
              <Button
                variant="danger"
                onPress={() => {
                  customerLogout()
                }}
                className="w-full"
              >
                התנתק מחשבון הלקוח
              </Button>
              
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
                    'w-full p-3.5 pr-10 pl-12 rounded-xl bg-background-dark border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-left text-sm sm:text-base',
                    error ? 'border-red-400' : 'border-white/10'
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  isIconOnly
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 min-w-[40px] w-10 h-10 text-foreground-muted hover:text-foreground-light"
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                </Button>
              </div>
            </div>
            
            {error && (
              <div className={cn(
                'rounded-xl p-3 border',
                errorCode && ERROR_CONFIG[errorCode] 
                  ? `${ERROR_CONFIG[errorCode].bgColor} ${ERROR_CONFIG[errorCode].borderColor}`
                  : 'bg-red-500/10 border-red-500/30'
              )}>
                <div className="flex items-start gap-2">
                  {errorCode && ERROR_CONFIG[errorCode] && (
                    <div className={cn('mt-0.5', ERROR_CONFIG[errorCode].color)}>
                      {(() => {
                        const IconComponent = ERROR_CONFIG[errorCode].icon
                        return <IconComponent size={16} strokeWidth={2} />
                      })()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className={cn(
                      'text-sm',
                      errorCode && ERROR_CONFIG[errorCode] 
                        ? ERROR_CONFIG[errorCode].color 
                        : 'text-red-400'
                    )}>
                      {error}
                    </p>
                    {/* Additional help text for specific errors */}
                    {errorCode === 'USER_NOT_FOUND' && (
                      <p className="text-foreground-muted text-xs mt-1">
                        ודא שהאימייל שהזנת נכון, או פנה למנהל להוספת חשבון.
                      </p>
                    )}
                    {errorCode === 'WRONG_PASSWORD' && (
                      <p className="text-foreground-muted text-xs mt-1">
                        שכחת את הסיסמה? פנה למנהל לאיפוס.
                      </p>
                    )}
                    {errorCode === 'NETWORK_ERROR' && (
                      <p className="text-foreground-muted text-xs mt-1">
                        בדוק את חיבור האינטרנט ונסה שוב.
                      </p>
                    )}
                    {errorCode === 'NOT_A_BARBER' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => router.push('/')}
                        className="mt-2 text-xs text-accent-gold"
                      >
                        עבור להתחברות כלקוח ←
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <Button
              type="submit"
              variant="primary"
              isDisabled={loading || isLoading}
              className="w-full mt-2"
              size="lg"
            >
              {loading || isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin mr-2" />
                  מתחבר...
                </>
              ) : (
                'התחבר'
              )}
            </Button>
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
