'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      
      <main className="pt-24 min-h-screen bg-background-dark flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Mode Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
            <button
              onClick={() => setMode('login')}
              className={cn(
                'flex-1 py-3 text-center transition-all',
                mode === 'login'
                  ? 'bg-accent-gold text-background-dark'
                  : 'bg-background-card text-foreground-light hover:bg-background-card/80'
              )}
            >
              התחברות
            </button>
            <button
              onClick={() => setMode('signup')}
              className={cn(
                'flex-1 py-3 text-center transition-all',
                mode === 'signup'
                  ? 'bg-accent-gold text-background-dark'
                  : 'bg-background-card text-foreground-light hover:bg-background-card/80'
              )}
            >
              הרשמה
            </button>
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
            
            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full py-3 px-4 rounded-xl font-medium transition-all mt-2',
                loading
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {loading ? 'מעבד...' : mode === 'login' ? 'התחבר' : 'הירשם'}
            </button>
          </form>
          
          {/* Back to Home */}
          <button
            onClick={() => router.push('/')}
            className="w-full text-center text-foreground-muted hover:text-foreground-light transition-colors text-sm mt-6"
          >
            חזור לדף הבית
          </button>
        </div>
      </main>
    </>
  )
}

