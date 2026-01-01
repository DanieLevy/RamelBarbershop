import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'מדיניות פרטיות | רמאל ברברשופ',
  description: 'מדיניות הפרטיות של רמאל ברברשופ - מידע על איסוף ושמירת נתונים אישיים',
}

export default function PrivacyPolicyPage() {
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
            מדיניות פרטיות
          </h1>
          <p className="text-foreground-muted text-sm">
            עודכן לאחרונה: {currentDate}
          </p>
        </div>

        {/* Content */}
        <div className="glass-card p-6 sm:p-8 space-y-8 text-foreground-light leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">1. מבוא</h2>
            <p className="text-foreground-muted">
              ברוכים הבאים לאתר של רמאל ברברשופ (&quot;המספרה&quot;, &quot;אנחנו&quot;, &quot;שלנו&quot;). 
              פרטיותך חשובה לנו. מסמך זה מפרט כיצד אנו אוספים, משתמשים ושומרים על מידע אישי 
              במסגרת האתר והשירותים שלנו.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">2. סוגי מידע הנאסף</h2>
            <div className="text-foreground-muted space-y-3">
              <div>
                <strong className="text-foreground-light">א. מידע שהמשתמש מסר מרצונו:</strong>
                <ul className="list-disc list-inside mt-1 mr-4 space-y-1">
                  <li>שם מלא</li>
                  <li>מספר טלפון</li>
                  <li>כתובת דוא&quot;ל (אופציונלי)</li>
                  <li>פרטי תורים והזמנות</li>
                </ul>
              </div>
              <div>
                <strong className="text-foreground-light">ב. מידע טכני:</strong>
                <ul className="list-disc list-inside mt-1 mr-4 space-y-1">
                  <li>כתובת IP</li>
                  <li>סוג דפדפן ומערכת הפעלה</li>
                  <li>נתוני שימוש סטטיסטיים</li>
                  <li>מזהה מכשיר להתראות (בהסכמה)</li>
                </ul>
              </div>
              <div>
                <strong className="text-foreground-light">ג. קובצי Cookie:</strong>
                <p className="mt-1">
                  האתר משתמש בקובצי Cookie חיוניים בלבד לצורך תפעול תקין של האתר ושמירת העדפות המשתמש.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">3. מטרות עיבוד המידע</h2>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-2">
              <li>ניהול מערכת הזמנות וטיפול בלקוחות</li>
              <li>שליחת תזכורות והתראות בנוגע לתורים</li>
              <li>שיפור חוויית משתמש ותפעול האתר</li>
              <li>יצירת קשר עם לקוחות בנוגע להזמנותיהם</li>
              <li>עמידה בחובות חוקיות</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">4. בסיס משפטי לעיבוד מידע</h2>
            <p className="text-foreground-muted">
              עיבוד מידע אישי נעשה על בסיס:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 mt-2 space-y-2">
              <li><strong className="text-foreground-light">הסכמת המשתמש</strong> - בעת הזנת פרטים אישיים ואישור מדיניות הפרטיות</li>
              <li><strong className="text-foreground-light">קיום הסכם</strong> - לצורך מתן שירותי קביעת תורים</li>
              <li><strong className="text-foreground-light">אינטרס לגיטימי</strong> - לצורך תפעול האתר ושיפור השירות</li>
              <li><strong className="text-foreground-light">חובות חוקיות</strong> - עמידה בדרישות החוק הישראלי</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">5. גילוי לצדדים שלישיים</h2>
            <p className="text-foreground-muted">
              אנו עשויים לשתף מידע עם ספקי שירות הכרחיים בלבד:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 mt-2 space-y-2">
              <li>ספקי אחסון ענן מאובטחים</li>
              <li>שירותי שליחת הודעות SMS והתראות</li>
              <li>שירותי אימות טלפוני</li>
            </ul>
            <p className="text-foreground-muted mt-3">
              <strong className="text-foreground-light">אנו לא מוכרים או משכירים מידע אישי לגורמים חיצוניים לצרכי שיווק.</strong>
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">6. קובצי Cookie</h2>
            <p className="text-foreground-muted">
              האתר משתמש בקובצי Cookie חיוניים בלבד לצורך:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 mt-2 space-y-2">
              <li>שמירת מצב התחברות המשתמש</li>
              <li>תפעול תקין של מערכת ההזמנות</li>
              <li>שמירת העדפות משתמש</li>
            </ul>
            <p className="text-foreground-muted mt-3">
              אין באתר קובצי Cookie לצרכי פרסום או מעקב של צדדים שלישיים.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">7. תקופת שמירת מידע</h2>
            <p className="text-foreground-muted">
              אנו שומרים מידע אישי רק לתקופה הדרושה למטרות שלשמן נאסף:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 mt-2 space-y-2">
              <li>פרטי לקוחות - כל עוד הלקוח פעיל או עד לבקשת מחיקה</li>
              <li>היסטוריית תורים - עד 3 שנים לצרכי ניהול עסקי</li>
              <li>נתונים טכניים - עד 12 חודשים</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">8. אבטחת מידע</h2>
            <p className="text-foreground-muted">
              אנו מיישמים אמצעי אבטחה מתקדמים להגנה על המידע האישי:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 mt-2 space-y-2">
              <li>הצפנת תקשורת באמצעות HTTPS</li>
              <li>אחסון מאובטח בשרתים מוגנים</li>
              <li>הרשאות גישה מוגבלות</li>
              <li>גיבויים שוטפים</li>
              <li>אימות דו-שלבי לגישה למערכת הניהול</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">9. זכויות המשתמש</h2>
            <p className="text-foreground-muted mb-3">
              בהתאם לחוק הגנת הפרטיות, התשמ&quot;א-1981, עומדות לך הזכויות הבאות:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-2">
              <li><strong className="text-foreground-light">זכות לעיון</strong> - לקבל מידע על הנתונים השמורים אודותיך</li>
              <li><strong className="text-foreground-light">זכות לתיקון</strong> - לתקן מידע לא מדויק או לא שלם</li>
              <li><strong className="text-foreground-light">זכות למחיקה</strong> - לבקש מחיקת המידע האישי</li>
              <li><strong className="text-foreground-light">זכות להתנגדות</strong> - להתנגד לעיבוד מידע מסוים</li>
              <li><strong className="text-foreground-light">זכות לניידות</strong> - לקבל העתק של המידע בפורמט נגיש</li>
            </ul>
            <p className="text-foreground-muted mt-3">
              למימוש זכויותיך, אנא פנה אלינו באמצעות פרטי הקשר המופיעים בסעיף 10.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">10. פרטי יצירת קשר</h2>
            <p className="text-foreground-muted">
              לשאלות בנוגע למדיניות הפרטיות או למימוש זכויותיך, ניתן לפנות אלינו:
            </p>
            <div className="mt-3 p-4 bg-white/5 rounded-xl">
              <p className="text-foreground-light font-medium">רמאל ברברשופ</p>
              <p className="text-foreground-muted mt-1">בית הכרם 30, ירושלים</p>
              <p className="text-foreground-muted">טלפון: 052-384-0981</p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">11. שינויים במדיניות</h2>
            <p className="text-foreground-muted">
              אנו שומרים לעצמנו את הזכות לעדכן מדיניות פרטיות זו מעת לעת. 
              שינויים מהותיים יפורסמו באתר ויעודכנו בתאריך העדכון בראש המסמך.
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">12. סמכות משפטית</h2>
            <p className="text-foreground-muted">
              מדיניות פרטיות זו כפופה לחוקי מדינת ישראל. 
              סמכות השיפוט הבלעדית בכל סכסוך הנובע ממדיניות זו תהיה לבתי המשפט המוסמכים בישראל.
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
