import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'תקנון האתר | רם אל ברברשופ',
  description: 'תנאי השימוש ותקנון האתר של רם אל ברברשופ - תנאים והתחייבויות',
}

export default function TermsPage() {
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
              <FileText size={20} className="text-accent-gold" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-medium text-foreground-light">
              תקנון האתר
            </h1>
          </div>
          <p className="text-foreground-muted text-sm">
            עודכן לאחרונה: פברואר 2026
          </p>
        </div>

        {/* Content */}
        <div className="glass-card p-6 sm:p-8 space-y-8 text-foreground-light leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">1. כללי</h2>
            <p className="text-foreground-muted">
              ברוכים הבאים לאתר של רם אל ברברשופ. השימוש באתר זה, לרבות גלישה, הרשמה, 
              קביעת תורים ושימוש בכל שירות אחר המוצע באתר, כפוף לתנאי תקנון זה. 
              הגלישה והשימוש באתר מהווים הסכמה מלאה לתנאים אלה.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">2. הגדרות</h2>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-2">
              <li><strong className="text-foreground-light">&quot;האתר&quot;</strong> - אתר האינטרנט והאפליקציה של רם אל ברברשופ</li>
              <li><strong className="text-foreground-light">&quot;המספרה&quot; / &quot;אנחנו&quot;</strong> - רם אל ברברשופ, יעקב טהון 13, ירושלים, ישראל</li>
              <li><strong className="text-foreground-light">&quot;משתמש&quot;</strong> - כל אדם הגולש או משתמש באתר</li>
              <li><strong className="text-foreground-light">&quot;שירותים&quot;</strong> - שירותי קביעת תורים, צפייה במידע ושירותים נלווים</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">3. פרטי בעל האתר</h2>
            <div className="p-4 bg-white/5 rounded-xl text-foreground-muted">
              <p><strong className="text-foreground-light">שם העסק:</strong> רם אל ברברשופ</p>
              <p><strong className="text-foreground-light">סוג העסק:</strong> מספרה לגברים</p>
              <p><strong className="text-foreground-light">כתובת:</strong> יעקב טהון 13, ירושלים, ישראל</p>
              <p><strong className="text-foreground-light">טלפון:</strong> 052-384-0981</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">4. קבלת התנאים</h2>
            <p className="text-foreground-muted">
              הגלישה באתר ו/או השימוש בשירותיו מהווים הסכמה מלאה ובלתי מותנית לתנאי תקנון זה
              ול<Link href="/privacy-policy" className="text-accent-gold hover:underline">מדיניות הפרטיות</Link> שלנו. 
              אם אינך מסכים לתנאים אלה, עליך להימנע משימוש באתר.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">5. שימוש מותר</h2>
            <p className="text-foreground-muted mb-3">
              השימוש באתר מותר לצרכים אישיים וחוקיים בלבד:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-2">
              <li>צפייה במידע על שירותי המספרה</li>
              <li>קביעת תורים וניהול הזמנות</li>
              <li>יצירת קשר עם המספרה</li>
              <li>צפייה במוצרים ושירותים</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">6. שימוש אסור</h2>
            <p className="text-foreground-muted mb-3">
              חל איסור מוחלט על:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-2">
              <li>שימוש באתר למטרות בלתי חוקיות</li>
              <li>העתקה, שכפול או הפצה של תכנים מהאתר ללא אישור</li>
              <li>ניסיון לפגוע באבטחת האתר או במערכותיו</li>
              <li>הזנת מידע כוזב או מטעה</li>
              <li>קביעת תורים פיקטיביים או ללא כוונה להגיע</li>
              <li>שימוש בכלים אוטומטיים (בוטים) לגישה לאתר</li>
              <li>התחזות לאדם אחר</li>
            </ul>
          </section>

          {/* Section 7 - Enhanced Booking & Cancellation Policy */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">7. קביעת תורים וביטולים</h2>
            <div className="text-foreground-muted space-y-4">
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="font-medium text-foreground-light mb-2">קביעת תורים:</p>
                <ul className="list-disc list-inside mr-4 space-y-1 text-sm">
                  <li>קביעת תור באתר מהווה התחייבות להגעה במועד שנקבע</li>
                  <li>תזכורות יישלחו לטלפון הנייד שהוזן</li>
                  <li>ניתן לקבוע עד 3 תורים פעילים בו-זמנית</li>
                  <li>תורים ניתנים לקביעה עד 21 יום מראש</li>
                </ul>
              </div>
              
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <p className="font-medium text-foreground-light mb-2">מדיניות ביטולים:</p>
                <ul className="list-disc list-inside mr-4 space-y-1 text-sm">
                  <li>ביטול תור יש לבצע באמצעות האתר או בהתקשרות טלפונית</li>
                  <li><strong>הספר רשאי לקבוע זמן מינימלי לביטול</strong> - לדוגמה, עד 3 שעות לפני התור</li>
                  <li>לאחר זמן זה, ניתן לבקש מהספר לבטל באופן ידני</li>
                  <li>אי-הגעה ללא ביטול מראש עלולה לגרור הגבלות על קביעת תורים עתידיים</li>
                </ul>
              </div>
              
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="font-medium text-foreground-light mb-2">שינויים מצד המספרה:</p>
                <p className="text-sm">
                  המספרה שומרת לעצמה את הזכות לשנות או לבטל תורים בנסיבות חריגות, 
                  תוך מתן הודעה מוקדמת ככל האפשר באמצעות הודעת Push או SMS.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">8. התראות והתחייבות לעדכון</h2>
            <div className="text-foreground-muted space-y-3">
              <p>
                האתר מציע שירות התראות Push לתזכורות תורים. על ידי הפעלת ההתראות, הנך מסכים/ה לקבל:
              </p>
              <ul className="list-disc list-inside mr-4 space-y-1">
                <li>תזכורות לפני תורים מתוזמנים</li>
                <li>הודעות על שינויים או ביטולים בתורים</li>
                <li>עדכונים חשובים מהמספרה</li>
              </ul>
              <p className="text-sm">
                ניתן לכבות התראות בכל עת דרך הגדרות הטלפון או דרך האתר.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">9. קניין רוחני</h2>
            <p className="text-foreground-muted">
              כל הזכויות באתר ובתכניו, לרבות עיצוב, טקסטים, תמונות, לוגו, קוד תוכנה וכל חומר אחר, 
              שמורות למספרה. אין להעתיק, לשכפל, להפיץ או לעשות שימוש מסחרי כלשהו בתכנים ללא אישור מראש ובכתב.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">10. הגבלת אחריות</h2>
            <div className="text-foreground-muted space-y-3">
              <p>
                האתר והשירותים מסופקים &quot;כמות שהם&quot; (AS IS). המספרה אינה מתחייבת לזמינות רציפה של האתר 
                ואינה אחראית לתקלות טכניות, שגיאות או הפסקות שירות.
              </p>
              <p>
                המספרה לא תהיה אחראית לנזקים ישירים או עקיפים הנובעים משימוש באתר, 
                לרבות אובדן נתונים, הפסד רווחים או נזקים אחרים.
              </p>
              <p>
                המשתמש אחראי לוודא את דיוק הפרטים שהזין ולשמור על פרטי הגישה שלו.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">11. קישורים לאתרים חיצוניים</h2>
            <p className="text-foreground-muted">
              האתר עשוי לכלול קישורים לאתרים חיצוניים (רשתות חברתיות, מפות וכו&apos;). 
              המספרה אינה אחראית לתוכן, למדיניות הפרטיות או לכל היבט אחר של אתרים אלה.
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">12. פרטיות ואבטחת מידע</h2>
            <p className="text-foreground-muted">
              איסוף ועיבוד מידע אישי באתר כפוף ל
              <Link href="/privacy-policy" className="text-accent-gold hover:underline mx-1">
                מדיניות הפרטיות
              </Link>
              שלנו, המהווה חלק בלתי נפרד מתקנון זה. אנו פועלים בהתאם לחוק הגנת הפרטיות, התשמ&quot;א-1981 
              ותיקון 13 שנכנס לתוקף באוגוסט 2025.
            </p>
          </section>

          {/* Section 13 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">13. נגישות</h2>
            <p className="text-foreground-muted">
              אנו מחויבים להנגשת האתר לאנשים עם מוגבלויות בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות. 
              לפרטים נוספים, ראו את{' '}
              <Link href="/accessibility" className="text-accent-gold hover:underline">
                הצהרת הנגישות
              </Link>
              {' '}שלנו.
            </p>
          </section>

          {/* Section 14 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">14. שינוי התקנון</h2>
            <p className="text-foreground-muted">
              המספרה שומרת לעצמה את הזכות לשנות, לעדכן או לתקן תקנון זה בכל עת. 
              שינויים מהותיים יפורסמו באתר ויעודכן תאריך העדכון בראש המסמך. 
              המשך השימוש באתר לאחר שינוי התקנון מהווה הסכמה לשינויים.
            </p>
          </section>

          {/* Section 15 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">15. הדין החל וסמכות שיפוט</h2>
            <p className="text-foreground-muted">
              תקנון זה כפוף לדיני מדינת ישראל בלבד. 
              סמכות השיפוט הבלעדית בכל סכסוך הנובע מתקנון זה או מהשימוש באתר 
              תהיה נתונה לבתי המשפט המוסמכים בירושלים.
            </p>
          </section>

          {/* Section 16 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">16. יצירת קשר</h2>
            <p className="text-foreground-muted mb-3">
              לשאלות בנוגע לתקנון זה או לשירותי האתר:
            </p>
            <div className="p-4 bg-white/5 rounded-xl">
              <p className="text-foreground-light font-medium">רם אל ברברשופ</p>
              <p className="text-foreground-muted mt-1">יעקב טהון 13, ירושלים, ישראל</p>
              <p className="text-foreground-muted">טלפון: 052-384-0981</p>
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
