import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'תקנון האתר | רמאל ברברשופ',
  description: 'תנאי השימוש ותקנון האתר של רמאל ברברשופ',
}

export default function TermsPage() {
  const currentDate = new Date().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

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
            תקנון האתר
          </h1>
          <p className="text-foreground-muted text-sm">
            עודכן לאחרונה: {currentDate}
          </p>
        </div>

        {/* Content */}
        <div className="glass-card p-6 sm:p-8 space-y-8 text-foreground-light leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">1. כללי</h2>
            <p className="text-foreground-muted">
              ברוכים הבאים לאתר של רמאל ברברשופ. השימוש באתר זה, לרבות גלישה, הרשמה, 
              קביעת תורים ושימוש בכל שירות אחר המוצע באתר, כפוף לתנאי תקנון זה. 
              הגלישה והשימוש באתר מהווים הסכמה מלאה לתנאים אלה.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">2. הגדרות</h2>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-2">
              <li><strong className="text-foreground-light">&quot;האתר&quot;</strong> - אתר האינטרנט של רמאל ברברשופ</li>
              <li><strong className="text-foreground-light">&quot;המספרה&quot; / &quot;אנחנו&quot;</strong> - רמאל ברברשופ, בית הכרם 30, ירושלים</li>
              <li><strong className="text-foreground-light">&quot;משתמש&quot;</strong> - כל אדם הגולש או משתמש באתר</li>
              <li><strong className="text-foreground-light">&quot;שירותים&quot;</strong> - שירותי קביעת תורים, צפייה במידע ושירותים נלווים</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">3. פרטי בעל האתר</h2>
            <div className="p-4 bg-white/5 rounded-xl text-foreground-muted">
              <p><strong className="text-foreground-light">שם העסק:</strong> רמאל ברברשופ</p>
              <p><strong className="text-foreground-light">כתובת:</strong> בית הכרם 30, ירושלים</p>
              <p><strong className="text-foreground-light">טלפון:</strong> 052-384-0981</p>
              <p className="text-xs mt-2 text-foreground-muted/70">
                [מספר ע.מ./ח.פ. יתעדכן בהמשך]
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">4. קבלת התנאים</h2>
            <p className="text-foreground-muted">
              הגלישה באתר ו/או השימוש בשירותיו מהווים הסכמה מלאה ובלתי מותנית לתנאי תקנון זה. 
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

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">7. קביעת תורים וביטולים</h2>
            <div className="text-foreground-muted space-y-3">
              <p>
                <strong className="text-foreground-light">קביעת תורים:</strong> 
                קביעת תור באתר מהווה התחייבות להגעה במועד שנקבע. 
                תזכורות יישלחו לטלפון הנייד שהוזן.
              </p>
              <p>
                <strong className="text-foreground-light">ביטולים:</strong> 
                ביטול תור יש לבצע באמצעות האתר או בהתקשרות טלפונית לפחות שעתיים לפני מועד התור. 
                אי-הגעה ללא ביטול מראש עלולה לגרור הגבלות על קביעת תורים עתידיים.
              </p>
              <p>
                <strong className="text-foreground-light">שינויים:</strong> 
                המספרה שומרת לעצמה את הזכות לשנות או לבטל תורים בנסיבות חריגות, תוך מתן הודעה מוקדמת ככל האפשר.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">8. קניין רוחני</h2>
            <p className="text-foreground-muted">
              כל הזכויות באתר ובתכניו, לרבות עיצוב, טקסטים, תמונות, לוגו, קוד תוכנה וכל חומר אחר, 
              שמורות למספרה. אין להעתיק, לשכפל, להפיץ או לעשות שימוש מסחרי כלשהו בתכנים ללא אישור מראש ובכתב.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">9. הגבלת אחריות</h2>
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
                המשתמש אחראי לוודא את דיוק הפרטים שהזין ולשמור על סיסמאותיו ופרטי הגישה שלו.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">10. קישורים לאתרים חיצוניים</h2>
            <p className="text-foreground-muted">
              האתר עשוי לכלול קישורים לאתרים חיצוניים (רשתות חברתיות, מפות וכו&apos;). 
              המספרה אינה אחראית לתוכן, למדיניות הפרטיות או לכל היבט אחר של אתרים אלה.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">11. פרטיות</h2>
            <p className="text-foreground-muted">
              איסוף ועיבוד מידע אישי באתר כפוף ל
              <Link href="/privacy-policy" className="text-accent-gold hover:underline mx-1">
                מדיניות הפרטיות
              </Link>
              שלנו, המהווה חלק בלתי נפרד מתקנון זה.
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">12. שינוי התקנון</h2>
            <p className="text-foreground-muted">
              המספרה שומרת לעצמה את הזכות לשנות, לעדכן או לתקן תקנון זה בכל עת וללא הודעה מוקדמת. 
              שינויים ייכנסו לתוקף מיד עם פרסומם באתר. 
              המשך השימוש באתר לאחר שינוי התקנון מהווה הסכמה לשינויים.
            </p>
          </section>

          {/* Section 13 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">13. הדין החל וסמכות שיפוט</h2>
            <p className="text-foreground-muted">
              תקנון זה כפוף לדיני מדינת ישראל בלבד. 
              סמכות השיפוט הבלעדית בכל סכסוך הנובע מתקנון זה או מהשימוש באתר 
              תהיה נתונה לבתי המשפט המוסמכים בירושלים.
            </p>
          </section>

          {/* Section 14 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">14. יצירת קשר</h2>
            <p className="text-foreground-muted">
              לשאלות בנוגע לתקנון זה או לשירותי האתר, ניתן לפנות אלינו:
            </p>
            <div className="mt-3 p-4 bg-white/5 rounded-xl">
              <p className="text-foreground-light font-medium">רמאל ברברשופ</p>
              <p className="text-foreground-muted mt-1">בית הכרם 30, ירושלים</p>
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
