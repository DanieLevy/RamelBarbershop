import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Shield, Mail, Phone } from 'lucide-react'

export const metadata: Metadata = {
  title: 'מדיניות פרטיות | רם אל ברברשופ',
  description: 'מדיניות הפרטיות של רם אל ברברשופ - מידע על איסוף ושמירת נתונים אישיים בהתאם לתיקון 13 לחוק הגנת הפרטיות',
}

export default function PrivacyPolicyPage() {
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
              <Shield size={20} className="text-accent-gold" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-medium text-foreground-light">
              מדיניות פרטיות
            </h1>
          </div>
          <p className="text-foreground-muted text-sm">
            עודכן לאחרונה: פברואר 2026 | בהתאם לתיקון 13 לחוק הגנת הפרטיות, התשמ&quot;א-1981
          </p>
        </div>

        {/* Content */}
        <div className="glass-card p-6 sm:p-8 space-y-8 text-foreground-light leading-relaxed">
          {/* Legal Notice Banner */}
          <div className="p-4 bg-accent-gold/10 border border-accent-gold/20 rounded-xl">
            <p className="text-sm text-foreground-muted">
              <strong className="text-foreground-light">הודעה חשובה:</strong> מדיניות פרטיות זו עודכנה בהתאם לתיקון 13 
              לחוק הגנת הפרטיות שנכנס לתוקף ב-14 באוגוסט 2025. אנו מחויבים להגנה על פרטיותך 
              ולשקיפות מלאה בנוגע לאיסוף ועיבוד המידע האישי שלך.
            </p>
          </div>

          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">1. מבוא וזהות בעל המאגר</h2>
            <p className="text-foreground-muted mb-3">
              ברוכים הבאים לאתר של רם אל ברברשופ (&quot;המספרה&quot;, &quot;אנחנו&quot;, &quot;שלנו&quot;). 
              פרטיותך חשובה לנו. מסמך זה מפרט כיצד אנו אוספים, משתמשים ושומרים על מידע אישי 
              במסגרת האתר והשירותים שלנו.
            </p>
            <div className="p-4 bg-white/5 rounded-xl text-foreground-muted">
              <p><strong className="text-foreground-light">בעל המאגר:</strong> רם אל ברברשופ</p>
              <p><strong className="text-foreground-light">כתובת:</strong> יעקב טהון 13, ירושלים, ישראל</p>
              <p><strong className="text-foreground-light">טלפון:</strong> 052-384-0981</p>
              <p><strong className="text-foreground-light">דוא&quot;ל לפניות פרטיות:</strong> privacy@ramel-barbershop.com</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">2. סוגי מידע הנאסף</h2>
            <div className="text-foreground-muted space-y-4">
              <div>
                <strong className="text-foreground-light">א. מידע שהמשתמש מסר מרצונו:</strong>
                <ul className="list-disc list-inside mt-2 mr-4 space-y-1">
                  <li>שם מלא - לצורך זיהוי והתאמת השירות</li>
                  <li>מספר טלפון - לאימות, שליחת תזכורות ויצירת קשר</li>
                  <li>כתובת דוא&quot;ל (אופציונלי) - ליצירת קשר</li>
                  <li>פרטי תורים והזמנות - לניהול השירות</li>
                  <li>הערות וביטולים - לשיפור השירות</li>
                </ul>
              </div>
              <div>
                <strong className="text-foreground-light">ב. מידע טכני הנאסף אוטומטית:</strong>
                <ul className="list-disc list-inside mt-2 mr-4 space-y-1">
                  <li>כתובת IP - לאבטחה וניתוח סטטיסטי</li>
                  <li>סוג דפדפן ומערכת הפעלה - להתאמת חוויית המשתמש</li>
                  <li>נתוני שימוש סטטיסטיים - לשיפור האתר</li>
                  <li>מזהה מכשיר להתראות Push (בהסכמה בלבד)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 - Cookies */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">3. קובצי Cookie (עוגיות)</h2>
            <p className="text-foreground-muted mb-3">
              האתר משתמש בקובצי Cookie לתפעולו התקין. להלן פירוט סוגי העוגיות:
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">עוגיות חיוניות (ללא צורך בהסכמה)</p>
                <p className="text-foreground-muted text-sm mt-1">
                  נדרשות לתפעול בסיסי של האתר: שמירת מצב התחברות, ניהול סל הזמנות, אבטחה.
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">עוגיות פונקציונליות</p>
                <p className="text-foreground-muted text-sm mt-1">
                  שומרות העדפות משתמש כגון שפה מועדפת והגדרות תצוגה.
                </p>
              </div>
            </div>
            <p className="text-foreground-muted mt-3 text-sm">
              <strong className="text-foreground-light">חשוב:</strong> אנו <strong>לא</strong> משתמשים בעוגיות פרסום, 
              עוגיות מעקב של צדדים שלישיים, Google Analytics, או Meta Pixel.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">4. מטרות עיבוד המידע</h2>
            <p className="text-foreground-muted mb-2">אנו אוספים ומעבדים מידע למטרות הבאות בלבד:</p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-2">
              <li><strong className="text-foreground-light">ניהול הזמנות</strong> - קביעת תורים, שינויים וביטולים</li>
              <li><strong className="text-foreground-light">תקשורת שירות</strong> - שליחת תזכורות והתראות בנוגע לתורים</li>
              <li><strong className="text-foreground-light">אימות זהות</strong> - שליחת קודי אימות SMS</li>
              <li><strong className="text-foreground-light">שיפור השירות</strong> - ניתוח דפוסי שימוש (ללא זיהוי אישי)</li>
              <li><strong className="text-foreground-light">חובות חוקיות</strong> - עמידה בדרישות החוק הישראלי</li>
            </ul>
            <p className="text-foreground-muted mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
              ✓ אנו <strong>לא</strong> משתמשים במידע למטרות שיווק או פרסום ללא הסכמה מפורשת נפרדת.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">5. בסיס משפטי לעיבוד מידע</h2>
            <p className="text-foreground-muted mb-2">
              בהתאם לתיקון 13 לחוק הגנת הפרטיות, עיבוד המידע מתבסס על:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-2">
              <li><strong className="text-foreground-light">הסכמת המשתמש</strong> - בעת הזנת פרטים אישיים ואישור תנאי השימוש</li>
              <li><strong className="text-foreground-light">קיום הסכם</strong> - לצורך מתן שירותי קביעת תורים שהתבקשו</li>
              <li><strong className="text-foreground-light">אינטרס לגיטימי</strong> - אבטחת האתר ומניעת הונאות</li>
              <li><strong className="text-foreground-light">חובות חוקיות</strong> - עמידה בדרישות רגולטוריות</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">6. שיתוף מידע עם צדדים שלישיים</h2>
            <p className="text-foreground-muted mb-3">
              אנו משתפים מידע עם ספקי שירות חיוניים בלבד, המחויבים לשמירת סודיות:
            </p>
            <div className="space-y-2">
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">Supabase (אחסון מידע)</p>
                <p className="text-foreground-muted text-sm">אחסון מאובטח של נתוני משתמשים והזמנות בשרתים באירופה</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">Firebase (אימות)</p>
                <p className="text-foreground-muted text-sm">שירותי אימות טלפוני (SMS OTP)</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">Web Push</p>
                <p className="text-foreground-muted text-sm">שליחת התראות Push למכשירים שאישרו</p>
              </div>
            </div>
            <p className="text-foreground-muted mt-4 font-medium">
              אנו לא מוכרים, משכירים או משתפים מידע אישי לגורמים חיצוניים לצרכי שיווק או פרסום.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">7. אבטחת מידע</h2>
            <p className="text-foreground-muted mb-3">
              אנו מיישמים אמצעי אבטחה מתקדמים להגנה על המידע האישי:
            </p>
            <ul className="text-foreground-muted list-disc list-inside mr-4 space-y-2">
              <li>הצפנת תקשורת מלאה באמצעות HTTPS/TLS</li>
              <li>אחסון מאובטח בשרתי ענן מוגנים עם הצפנה במנוחה</li>
              <li>Row Level Security (RLS) לבידוד נתונים בין משתמשים</li>
              <li>הרשאות גישה מינימליות (Principle of Least Privilege)</li>
              <li>גיבויים שוטפים ומוצפנים</li>
              <li>אימות דו-שלבי לגישה למערכת הניהול</li>
              <li>ניטור ורישום אירועי אבטחה</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">8. תקופת שמירת מידע</h2>
            <p className="text-foreground-muted mb-3">
              אנו שומרים מידע אישי רק לתקופה הדרושה:
            </p>
            <div className="space-y-2">
              <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-foreground-muted">פרטי לקוחות פעילים</span>
                <span className="text-foreground-light">כל עוד החשבון פעיל</span>
              </div>
              <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-foreground-muted">היסטוריית תורים</span>
                <span className="text-foreground-light">עד 3 שנים</span>
              </div>
              <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-foreground-muted">יומני אבטחה</span>
                <span className="text-foreground-light">עד 12 חודשים</span>
              </div>
              <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-foreground-muted">נתוני התראות Push</span>
                <span className="text-foreground-light">30 ימים</span>
              </div>
            </div>
            <p className="text-foreground-muted mt-3 text-sm">
              לאחר תום התקופה, המידע נמחק באופן אוטומטי או מאונימיזציה.
            </p>
          </section>

          {/* Section 9 - User Rights (Enhanced for Amendment 13) */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">9. זכויות המשתמש (תיקון 13)</h2>
            <p className="text-foreground-muted mb-4">
              בהתאם לתיקון 13 לחוק הגנת הפרטיות, התשמ&quot;א-1981, עומדות לך הזכויות הבאות:
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">זכות לעיון</p>
                <p className="text-foreground-muted text-sm">לקבל מידע מלא על הנתונים השמורים אודותיך</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">זכות לתיקון</p>
                <p className="text-foreground-muted text-sm">לתקן מידע לא מדויק או לא שלם</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">זכות למחיקה</p>
                <p className="text-foreground-muted text-sm">לבקש מחיקת המידע האישי (&quot;הזכות להישכח&quot;)</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">זכות להתנגדות</p>
                <p className="text-foreground-muted text-sm">להתנגד לעיבוד מידע לצרכים מסוימים</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">זכות לניידות</p>
                <p className="text-foreground-muted text-sm">לקבל העתק של המידע בפורמט נגיש וקריא</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-foreground-light font-medium">זכות לביטול הסכמה</p>
                <p className="text-foreground-muted text-sm">לבטל הסכמה שניתנה בעבר לעיבוד מידע</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-accent-gold/10 border border-accent-gold/20 rounded-xl">
              <p className="text-foreground-light font-medium mb-2">כיצד לממש את זכויותיך?</p>
              <p className="text-foreground-muted text-sm">
                שלח/י בקשה באחת הדרכים הבאות. נטפל בבקשתך תוך 30 ימים:
              </p>
              <div className="flex flex-col gap-2 mt-3">
                <a href="mailto:privacy@ramel-barbershop.com" className="flex items-center gap-2 text-accent-gold hover:underline">
                  <Mail size={16} />
                  <span>privacy@ramel-barbershop.com</span>
                </a>
                <a href="tel:052-384-0981" className="flex items-center gap-2 text-accent-gold hover:underline">
                  <Phone size={16} />
                  <span>052-384-0981</span>
                </a>
              </div>
            </div>
          </section>

          {/* Section 10 - Complaint to Authority */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">10. הגשת תלונה לרשות להגנת הפרטיות</h2>
            <p className="text-foreground-muted">
              אם לדעתך הופרו זכויותיך על פי חוק הגנת הפרטיות, הנך רשאי/ת להגיש תלונה לרשות להגנת הפרטיות:
            </p>
            <div className="mt-3 p-4 bg-white/5 rounded-xl text-foreground-muted">
              <p><strong className="text-foreground-light">הרשות להגנת הפרטיות</strong></p>
              <p>משרד המשפטים</p>
              <p>רח&apos; ירמיהו 39, ירושלים</p>
              <p>אתר: <a href="https://www.gov.il/he/departments/the_privacy_protection_authority" target="_blank" rel="noopener noreferrer" className="text-accent-gold hover:underline">הרשות להגנת הפרטיות</a></p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">11. שינויים במדיניות</h2>
            <p className="text-foreground-muted">
              אנו שומרים לעצמנו את הזכות לעדכן מדיניות פרטיות זו מעת לעת בהתאם לשינויי חקיקה או שינויים בשירותים. 
              שינויים מהותיים יפורסמו באתר ויעודכנו בתאריך העדכון בראש המסמך. 
              המשך השימוש באתר לאחר עדכון המדיניות מהווה הסכמה לתנאים המעודכנים.
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">12. סמכות משפטית</h2>
            <p className="text-foreground-muted">
              מדיניות פרטיות זו כפופה לחוקי מדינת ישראל, לרבות חוק הגנת הפרטיות, התשמ&quot;א-1981 
              ותיקוניו. סמכות השיפוט הבלעדית בכל סכסוך הנובע ממדיניות זו תהיה לבתי המשפט המוסמכים בירושלים.
            </p>
          </section>

          {/* Section 13 - Contact */}
          <section>
            <h2 className="text-lg font-medium text-accent-gold mb-3">13. פרטי יצירת קשר</h2>
            <p className="text-foreground-muted mb-3">
              לשאלות בנוגע למדיניות הפרטיות או למימוש זכויותיך:
            </p>
            <div className="p-4 bg-white/5 rounded-xl">
              <p className="text-foreground-light font-medium">רם אל ברברשופ</p>
              <p className="text-foreground-muted mt-1">יעקב טהון 13, ירושלים, ישראל</p>
              <p className="text-foreground-muted">טלפון: 052-384-0981</p>
              <p className="text-foreground-muted">דוא&quot;ל: privacy@ramel-barbershop.com</p>
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
