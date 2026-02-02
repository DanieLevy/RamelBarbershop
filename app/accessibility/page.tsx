import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle, Accessibility, Phone, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'הצהרת נגישות | רם אל ברברשופ',
  description: 'הצהרת הנגישות של אתר רם אל ברברשופ - מחויבות לנגישות לכלל המשתמשים בהתאם לתקן SI 5568',
}

export default function AccessibilityPage() {
  const accessibilityFeatures = [
    'טקסט חלופי (alt text) לכל התמונות והאייקונים באתר',
    'ניווט מלא באמצעות מקלדת בלבד',
    'תאימות מלאה לקוראי מסך (NVDA, JAWS, VoiceOver)',
    'שימוש בכותרות והיררכיה סמנטית נכונה',
    'ניגודיות צבעים העומדת בתקן WCAG 2.1 AA',
    'אזורי לחיצה גדולים ונגישים (מינימום 44x44 פיקסלים)',
    'הודעות שגיאה ברורות ומובנות עם הנחיות לתיקון',
    'תמיכה בהגדלת טקסט עד 200% ללא אובדן פונקציונליות',
    'תיוג נכון של טפסים ושדות קלט עם labels מפורשים',
    'תמיכה ב-Skip Links למעבר מהיר לתוכן הראשי',
    'התאמה מלאה למכשירים ניידים (Responsive Design)',
    'תמיכה בכיוון קריאה מימין לשמאל (RTL)',
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
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent-gold/10 flex items-center justify-center">
              <Accessibility size={20} className="text-accent-gold" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-medium text-foreground-light">
              הצהרת נגישות
            </h1>
          </div>
          <p className="text-foreground-muted text-sm">
            עודכן לאחרונה: פברואר 2026 | תקן ישראלי SI 5568 ו-WCAG 2.1 AA
          </p>
        </div>

        {/* Content */}
        <div className="glass-card p-6 sm:p-8 space-y-8 text-foreground-light leading-relaxed">
          {/* Introduction */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">מחויבות לנגישות</h2>
            <p className="text-foreground-muted">
              רם אל ברברשופ מחויבת להנגשת האתר והשירותים הדיגיטליים לכלל המשתמשים, 
              לרבות אנשים עם מוגבלויות. אנו פועלים בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, 
              התשנ&quot;ח-1998, ותקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), 
              התשע&quot;ג-2013.
            </p>
          </section>

          {/* Standard Compliance */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">רמת נגישות ותקנים</h2>
            <div className="p-4 bg-accent-gold/10 border border-accent-gold/20 rounded-xl mb-4">
              <p className="text-foreground-light font-medium mb-2">האתר עומד בתקנים הבאים:</p>
              <ul className="text-foreground-muted space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-400 shrink-0" />
                  <span><strong>תקן ישראלי SI 5568</strong> - תקן הנגישות הישראלי</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-400 shrink-0" />
                  <span><strong>WCAG 2.1 Level AA</strong> - הנחיות הנגישות הבינלאומיות</span>
                </li>
              </ul>
            </div>
            <p className="text-foreground-muted text-sm">
              האתר נבדק באופן שוטף לעמידה בתקנים אלה ומעודכן בהתאם לשינויים בדרישות.
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
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">Tab</kbd> - מעבר לאלמנט הבא</p>
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">Shift + Tab</kbd> - מעבר לאלמנט הקודם</p>
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">Enter</kbd> - הפעלת כפתורים וקישורים</p>
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">Space</kbd> - בחירה בתיבות סימון</p>
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">חצים</kbd> - ניווט בתפריטים ולוח שנה</p>
              <p><kbd className="px-2 py-1 bg-white/10 rounded text-sm">Esc</kbd> - סגירת חלונות קופצים ותפריטים</p>
            </div>
          </section>

          {/* Browser Compatibility */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">תאימות דפדפנים</h2>
            <p className="text-foreground-muted mb-2">
              האתר נבדק ותואם לדפדפנים הנפוצים בגרסאותיהם העדכניות:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-1">
              <li>Google Chrome (מומלץ)</li>
              <li>Mozilla Firefox</li>
              <li>Apple Safari</li>
              <li>Microsoft Edge</li>
            </ul>
          </section>

          {/* Screen Readers */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">תאימות לקוראי מסך</h2>
            <p className="text-foreground-muted mb-2">
              האתר תוכנן לתמיכה בטכנולוגיות מסייעות וקוראי מסך נפוצים:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-foreground-light font-medium">NVDA</p>
                <p className="text-foreground-muted text-xs">Windows</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-foreground-light font-medium">JAWS</p>
                <p className="text-foreground-muted text-xs">Windows</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-foreground-light font-medium">VoiceOver</p>
                <p className="text-foreground-muted text-xs">iOS / macOS</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-foreground-light font-medium">TalkBack</p>
                <p className="text-foreground-muted text-xs">Android</p>
              </div>
            </div>
          </section>

          {/* PWA Accessibility */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">נגישות באפליקציה (PWA)</h2>
            <p className="text-foreground-muted">
              האתר זמין גם כאפליקציה (PWA) הניתנת להתקנה על מכשירים ניידים. 
              האפליקציה שומרת על כל תכונות הנגישות של האתר, כולל תמיכה בקוראי מסך ובמחוות נגישות 
              של מערכות ההפעלה iOS ו-Android.
            </p>
          </section>

          {/* Continuous Improvement */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">שיפור מתמיד</h2>
            <p className="text-foreground-muted">
              אנו פועלים באופן שוטף לשיפור נגישות האתר ועדכון התכנים בהתאם לתקנים העדכניים ביותר. 
              האתר עובר בדיקות נגישות תקופתיות, ואנו מתייחסים לכל משוב שמתקבל מהמשתמשים.
            </p>
          </section>

          {/* Known Limitations */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">מגבלות ידועות</h2>
            <p className="text-foreground-muted mb-3">
              למרות מאמצינו הרבים, ייתכן שחלקים מסוימים באתר עדיין אינם נגישים במלואם:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-2">
              <li>תכנים המוטמעים מרשתות חברתיות (Instagram, WhatsApp) - נגישותם תלויה בצד שלישי</li>
              <li>מפות Google - אנו מספקים חלופה טקסטואלית עם כתובת מלאה</li>
            </ul>
            <p className="text-foreground-muted mt-3 text-sm">
              אנו עובדים על תיקון מגבלות אלה. אם נתקלת בבעיה, אנא צור/צרי קשר ונשמח לסייע.
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
              <p className="text-foreground-light font-medium mb-3">רכז נגישות - רם אל ברברשופ</p>
              <div className="space-y-2">
                <a 
                  href="tel:052-384-0981" 
                  className="flex items-center gap-2 text-accent-gold hover:underline"
                >
                  <Phone size={16} />
                  <span>052-384-0981</span>
                </a>
                <a 
                  href="mailto:accessibility@ramel-barbershop.com" 
                  className="flex items-center gap-2 text-accent-gold hover:underline"
                >
                  <Mail size={16} />
                  <span>accessibility@ramel-barbershop.com</span>
                </a>
              </div>
              <p className="text-foreground-muted text-sm mt-3">
                כתובת: יעקב טהון 13, ירושלים, ישראל
              </p>
            </div>
          </section>

          {/* Legal Framework */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">מסגרת חוקית</h2>
            <p className="text-foreground-muted mb-3">
              הצהרה זו נכתבה בהתאם לחקיקה הישראלית בנושא נגישות:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-1 text-sm">
              <li>חוק שוויון זכויות לאנשים עם מוגבלות, התשנ&quot;ח-1998</li>
              <li>תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע&quot;ג-2013</li>
              <li>תקן ישראלי 5568 - נגישות תכנים באינטרנט</li>
            </ul>
          </section>

          {/* Audit Information */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">בדיקות נגישות</h2>
            <div className="p-4 bg-white/5 rounded-xl text-foreground-muted">
              <p><strong className="text-foreground-light">בדיקה אחרונה:</strong> פברואר 2026</p>
              <p><strong className="text-foreground-light">שיטת בדיקה:</strong> בדיקה ידנית + כלים אוטומטיים (axe, Lighthouse)</p>
              <p><strong className="text-foreground-light">תקן:</strong> WCAG 2.1 Level AA / SI 5568</p>
            </div>
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
