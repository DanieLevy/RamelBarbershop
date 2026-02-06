'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { Button } from '@heroui/react'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [termsConsent, setTermsConsent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Validate phone
    const phoneClean = phone.replace(/\D/g, '')
    if (!phoneClean || phoneClean.length !== 10 || !phoneClean.startsWith('05')) {
      setError('נא להזין מספר טלפון ישראלי תקין')
      return
    }
    
    if (mode === 'signup' && !name.trim()) {
      setError('נא להזין שם מלא')
      return
    }
    
    if (mode === 'signup' && !termsConsent) {
      setError('יש לאשר את התקנון ומדיניות הפרטיות')
      return
    }
    
    setLoading(true)
    
    // For now, just redirect to home
    // Full auth implementation would go here
    setTimeout(() => {
      setLoading(false)
      router.push('/')
    }, 1000)
  }

  return (
    <>
      <AppHeader />
      
      <main id="main-content" tabIndex={-1} className="pt-24 min-h-screen bg-background-dark flex items-center justify-center px-4 outline-none">
        <div className="w-full max-w-md">
          {/* Mode Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
            <Button
              variant={mode === 'login' ? 'primary' : 'secondary'}
              onPress={() => setMode('login')}
              className="flex-1 rounded-none"
            >
              התחברות
            </Button>
            <Button
              variant={mode === 'signup' ? 'primary' : 'secondary'}
              onPress={() => setMode('signup')}
              className="flex-1 rounded-none"
            >
              הרשמה
            </Button>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <h2 className="text-xl text-center text-foreground-light font-medium mb-2">
              {mode === 'login' ? 'התחבר לחשבון' : 'צור חשבון חדש'}
            </h2>
            
            {mode === 'signup' && (
              <div className="flex flex-col gap-2">
                <label htmlFor="name" className="text-foreground-light text-sm">
                  שם מלא
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="הזן את שמך המלא"
                  className="w-full p-3 rounded-xl bg-background-card border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all"
                />
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-foreground-light text-sm">
                מספר טלפון
              </label>
              <input
                id="phone"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                className="w-full p-3 rounded-xl bg-background-card border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-left"
              />
            </div>
            
            {/* Terms Consent Checkbox - Only for signup */}
            {mode === 'signup' && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={termsConsent}
                  onClick={() => {
                    setTermsConsent(!termsConsent)
                    setError(null)
                  }}
                  className={cn(
                    'w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                    termsConsent
                      ? 'bg-accent-gold border-accent-gold'
                      : 'border-white/30 bg-transparent group-hover:border-white/50'
                  )}
                >
                  {termsConsent && <Check size={14} className="text-background-dark" strokeWidth={3} />}
                </button>
                <span className="text-foreground-muted text-sm leading-relaxed">
                  אני מסכים/ה ל
                  <Link 
                    href="/terms" 
                    target="_blank"
                    className="text-accent-gold hover:underline mx-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    תקנון האתר
                  </Link>
                  ול
                  <Link 
                    href="/privacy-policy" 
                    target="_blank"
                    className="text-accent-gold hover:underline mx-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    מדיניות הפרטיות
                  </Link>
                </span>
              </label>
            )}
            
            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
            
            <Button
              type="submit"
              variant="primary"
              isDisabled={loading}
              className="w-full mt-2"
            >
              {loading ? 'מעבד...' : mode === 'login' ? 'התחבר' : 'הירשם'}
            </Button>
          </form>
          
          {/* Back to Home */}
          <Button
            variant="ghost"
            onPress={() => router.push('/')}
            className="w-full text-sm mt-6"
          >
            חזור לדף הבית
          </Button>
        </div>
      </main>
    </>
  )
}

