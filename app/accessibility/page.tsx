import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'הצהרת נגישות | רמאל ברברשופ',
  description: 'הצהרת הנגישות של אתר רמאל ברברשופ - מחויבות לנגישות לכלל המשתמשים',
}

export default function AccessibilityPage() {
  const currentDate = new Date().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const accessibilityFeatures = [
    'טקסט חלופי (alt text) לכל התמונות באתר',
    'ניווט מלא באמצעות מקלדת',
    'תאימות לקוראי מסך',
    'שימוש בכותרות והיררכיה נכונה',
    'ניגודיות צבעים מספקת',
    'אזורי לחיצה גדולים ונגישים',
    'הודעות שגיאה ברורות ומובנות',
    'תמיכה בהגדלת טקסט',
    'תיוג נכון של טפסים ושדות קלט',
  ]

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background-dark pt-20 pb-32 outline-none">
      <div className="container-mobile py-8">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-foreground-muted hover:text-accent-gold transition-colors mb-6"
        >
          <ArrowRight size={16} />
          <span>חזרה לדף הבית</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-medium text-foreground-light mb-2">
            הצהרת נגישות
          </h1>
          <p className="text-foreground-muted text-sm">
            עודכן לאחרונה: {currentDate}
          </p>
        </div>

        {/* Content */}
        <div className="glass-card p-6 sm:p-8 space-y-8 text-foreground-light leading-relaxed">
          {/* Introduction */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">מחויבות לנגישות</h2>
            <p className="text-foreground-muted">
              רמאל ברברשופ מחויבת להנגשת האתר והשירותים הדיגיטליים לכלל המשתמשים, 
              לרבות אנשים עם מוגבלויות. אנו פועלים בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות 
              (התאמות נגישות לשירות), התשע&quot;ג-2013, ושואפים לעמוד בתקן הנגישות הישראלי 
              SI 5568 ברמה AA.
            </p>
          </section>

          {/* Features */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-4">תכונות נגישות באתר</h2>
            <p className="text-foreground-muted mb-4">
              האתר כולל את התכונות הבאות לשיפור הנגישות:
            </p>
            <ul className="space-y-3">
              {accessibilityFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-green-400 mt-0.5 shrink-0" />
                  <span className="text-foreground-muted">{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Keyboard Navigation */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">ניווט במקלדת</h2>
            <p className="text-foreground-muted mb-3">
              ניתן לנווט באתר באמצעות המקלדת בלבד:
            </p>
            <div className="p-4 bg-white/5 rounded-xl space-y-2 text-foreground-muted">
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">Tab</kbd> - מעבר בין אלמנטים</p>
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">Shift + Tab</kbd> - מעבר לאלמנט הקודם</p>
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">Enter</kbd> - הפעלת כפתורים וקישורים</p>
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">חצים</kbd> - ניווט בתפריטים ולוח שנה</p>
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">Esc</kbd> - סגירת חלונות קופצים</p>
            </div>
          </section>

          {/* Browser Compatibility */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">תאימות דפדפנים</h2>
            <p className="text-foreground-muted">
              האתר נבדק ותואם לדפדפנים הנפוצים בגרסאותיהם העדכניות:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 mt-2 space-y-1">
              <li>Google Chrome</li>
              <li>Mozilla Firefox</li>
              <li>Apple Safari</li>
              <li>Microsoft Edge</li>
            </ul>
          </section>

          {/* Screen Readers */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">תאימות לקוראי מסך</h2>
            <p className="text-foreground-muted">
              האתר תוכנן לתמיכה בטכנולוגיות מסייעות וקוראי מסך נפוצים, כגון:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 mt-2 space-y-1">
              <li>NVDA</li>
              <li>JAWS</li>
              <li>VoiceOver (iOS/macOS)</li>
              <li>TalkBack (Android)</li>
            </ul>
          </section>

          {/* Continuous Improvement */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">שיפור מתמיד</h2>
            <p className="text-foreground-muted">
              אנו פועלים באופן שוטף לשיפור נגישות האתר ועדכון התכנים בהתאם לתקנים העדכניים ביותר. 
              ייתכן שחלקים מסוימים באתר עדיין אינם נגישים במלואם - אנו עובדים על תיקונם.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">נתקלת בבעיית נגישות?</h2>
            <p className="text-foreground-muted mb-4">
              אם נתקלת בקושי בשימוש באתר או במידע לא נגיש, נשמח לשמוע ממך ולסייע. 
              אנא פנה אלינו ונעשה כל מאמץ לספק לך את המידע או השירות בדרך נגישה.
            </p>
            <div className="p-4 bg-white/5 rounded-xl">
              <p className="text-foreground-light font-medium">רכז נגישות</p>
              <p className="text-foreground-muted mt-2">רמאל ברברשופ</p>
              <p className="text-foreground-muted">בית הכרם 30, ירושלים</p>
              <p className="text-foreground-muted">טלפון: 052-384-0981</p>
            </div>
          </section>

          {/* Legal Framework */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">מסגרת חוקית</h2>
            <p className="text-foreground-muted">
              הצהרה זו נכתבה בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ&quot;ח-1998, 
              ותקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע&quot;ג-2013.
            </p>
          </section>
        </div>

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-accent-gold hover:text-accent-gold/80 transition-colors"
          >
            <ArrowRight size={16} />
            <span>חזרה לדף הבית</span>
          </Link>
        </div>
      </div>
    </main>
  )
}
