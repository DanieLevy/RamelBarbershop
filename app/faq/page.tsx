'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, HelpCircle, Calendar, Smartphone, User, MapPin, CreditCard, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getExternalLinkProps } from '@/lib/utils/external-link'

// Metadata would need to be exported from a separate file for client components
// export const metadata: Metadata = {
//   title: 'שאלות נפוצות | רם אל ברברשופ',
//   description: 'תשובות לשאלות נפוצות על קביעת תורים, ביטולים, התקנת האפליקציה ועוד',
// }

interface FAQItem {
  question: string
  answer: string | React.ReactNode
}

interface FAQCategory {
  title: string
  icon: React.ReactNode
  items: FAQItem[]
}

const faqCategories: FAQCategory[] = [
  {
    title: 'קביעת תורים',
    icon: <Calendar size={20} />,
    items: [
      {
        question: 'איך קובעים תור?',
        answer: (
          <div className="space-y-2">
            <p>קביעת תור היא פשוטה וקלה:</p>
            <ol className="list-decimal list-inside space-y-1 mr-2">
              <li>בחרו את הספר שלכם מדף הבית</li>
              <li>בחרו את השירות הרצוי (תספורת, זקן וכו&apos;)</li>
              <li>בחרו תאריך פנוי מהלוח שנה</li>
              <li>בחרו שעה מתוך השעות הפנויות</li>
              <li>הזינו את מספר הטלפון שלכם לאימות</li>
              <li>קבלו קוד SMS ואשרו את התור</li>
            </ol>
            <p className="text-foreground-muted/80 text-sm mt-2">התור יישמר במערכת ותקבלו תזכורת לפני הגעה.</p>
          </div>
        ),
      },
      {
        question: 'כמה זמן מראש אפשר לקבוע תור?',
        answer: 'ניתן לקבוע תור עד 21 יום מראש. תאריכים מעבר לכך יופיעו באפור בלוח השנה ולא יהיו לחיצים.',
      },
      {
        question: 'למה אני לא רואה שעות פנויות?',
        answer: (
          <div className="space-y-2">
            <p>יש כמה סיבות אפשריות:</p>
            <ul className="list-disc list-inside space-y-1 mr-2">
              <li><strong>כל השעות תפוסות</strong> - נסו תאריך אחר</li>
              <li><strong>הספר בחופשה</strong> - יופיע סימון כתום בלוח השנה</li>
              <li><strong>המספרה סגורה</strong> - בדקו את ימי הפעילות</li>
              <li><strong>היום עבר</strong> - אי אפשר לקבוע תור לשעה שכבר עברה</li>
            </ul>
          </div>
        ),
      },
      {
        question: 'האם אפשר לקבוע כמה תורים?',
        answer: 'כן, אבל יש הגבלה של עד 3 תורים פעילים בו-זמנית. זה מאפשר לכולם לקבל הזדמנות לקבוע. אחרי שתור עובר או מבוטל, תוכלו לקבוע חדש.',
      },
      {
        question: 'מה קורה אם איחרתי לתור?',
        answer: 'אם איחרתם לתור, צרו קשר ישיר עם המספרה בטלפון 052-384-0981. לפעמים נוכל להתאים, ולפעמים תצטרכו לקבוע תור חדש. מומלץ להגיע מספר דקות לפני הזמן.',
      },
    ],
  },
  {
    title: 'ביטול ושינוי תורים',
    icon: <MessageCircle size={20} />,
    items: [
      {
        question: 'איך מבטלים תור?',
        answer: (
          <div className="space-y-2">
            <p>לביטול תור:</p>
            <ol className="list-decimal list-inside space-y-1 mr-2">
              <li>היכנסו לאזור &quot;התורים שלי&quot; (למטה במסך)</li>
              <li>מצאו את התור הרלוונטי</li>
              <li>לחצו על כפתור הביטול (X)</li>
              <li>אשרו את הביטול</li>
            </ol>
            <p className="text-foreground-muted/80 text-sm mt-2">הביטול מיידי ותקבלו אישור.</p>
          </div>
        ),
      },
      {
        question: 'האם אפשר לשנות תאריך או שעה?',
        answer: 'כרגע אין אפשרות לשנות תור קיים. אם אתם צריכים שעה אחרת, בטלו את התור הנוכחי וקבעו חדש. אל דאגה - השעה החדשה תישמר מיד.',
      },
      {
        question: 'האם יש קנס על ביטול?',
        answer: 'אין קנס על ביטול. עם זאת, אנא בטלו מוקדם ככל האפשר כדי לאפשר ללקוחות אחרים לתפוס את השעה.',
      },
      {
        question: 'ביטלתי תור אבל הוא עדיין מופיע',
        answer: 'רעננו את הדף (משכו למטה או לחצו רענן). אם התור עדיין מופיע אחרי רענון, צרו קשר בטלפון 052-384-0981.',
      },
    ],
  },
  {
    title: 'התקנה והתראות',
    icon: <Smartphone size={20} />,
    items: [
      {
        question: 'איך מתקינים את האפליקציה?',
        answer: (
          <div className="space-y-2">
            <p><strong>באייפון (iOS):</strong></p>
            <ol className="list-decimal list-inside space-y-1 mr-2 mb-3">
              <li>פתחו את האתר בדפדפן Safari</li>
              <li>לחצו על כפתור השיתוף (ריבוע עם חץ למעלה)</li>
              <li>גללו ובחרו &quot;הוסף למסך הבית&quot;</li>
              <li>לחצו &quot;הוסף&quot;</li>
            </ol>
            <p><strong>באנדרואיד:</strong></p>
            <ol className="list-decimal list-inside space-y-1 mr-2">
              <li>פתחו את האתר בדפדפן Chrome</li>
              <li>תופיע הודעה &quot;התקן אפליקציה&quot; - לחצו עליה</li>
              <li>או: לחצו על שלוש נקודות → &quot;התקן אפליקציה&quot;</li>
            </ol>
          </div>
        ),
      },
      {
        question: 'למה אני לא מקבל/ת תזכורות?',
        answer: (
          <div className="space-y-2">
            <p>כמה דברים לבדוק:</p>
            <ul className="list-disc list-inside space-y-1 mr-2">
              <li>וודאו שאישרתם התראות כשנשאלתם</li>
              <li>בדקו שההתראות מופעלות בהגדרות הטלפון</li>
              <li>באייפון - צריך להתקין את האפליקציה למסך הבית</li>
              <li>היכנסו לפרופיל → הגדרות התראות ובדקו שהכל מופעל</li>
            </ul>
          </div>
        ),
      },
      {
        question: 'איך מפעילים התראות באייפון?',
        answer: (
          <div className="space-y-2">
            <p>באייפון, התראות עובדות רק אחרי התקנת האפליקציה:</p>
            <ol className="list-decimal list-inside space-y-1 mr-2">
              <li>התקינו את האפליקציה (ראו שאלה קודמת)</li>
              <li>פתחו את האפליקציה מהמסך הראשי</li>
              <li>אשרו התראות כשתתבקשו</li>
              <li>היכנסו להגדרות הטלפון → התראות → רם אל ברברשופ</li>
              <li>וודאו שהכל מופעל</li>
            </ol>
          </div>
        ),
      },
      {
        question: 'כמה זמן לפני התור מקבלים תזכורת?',
        answer: 'תזכורות נשלחות 3 שעות לפני התור. ניתן לראות את הגדרות התזכורת בפרופיל שלכם.',
      },
    ],
  },
  {
    title: 'חשבון והתחברות',
    icon: <User size={20} />,
    items: [
      {
        question: 'איך נכנסים לחשבון?',
        answer: (
          <div className="space-y-2">
            <p>ההתחברות מבוססת על מספר הטלפון שלכם:</p>
            <ol className="list-decimal list-inside space-y-1 mr-2">
              <li>לחצו על &quot;התחברות&quot; למטה במסך</li>
              <li>הזינו את מספר הטלפון שלכם</li>
              <li>קבלו קוד בSMS והזינו אותו</li>
              <li>זהו! אתם מחוברים</li>
            </ol>
            <p className="text-foreground-muted/80 text-sm mt-2">אין צורך לזכור סיסמא - כל התחברות דרך SMS.</p>
          </div>
        ),
      },
      {
        question: 'לא מקבל/ת קוד SMS',
        answer: (
          <div className="space-y-2">
            <p>נסו את הדברים הבאים:</p>
            <ul className="list-disc list-inside space-y-1 mr-2">
              <li>בדקו שהזנתם את המספר הנכון (עם קידומת ישראלית)</li>
              <li>המתינו עד דקה - לפעמים יש עיכוב קל</li>
              <li>בדקו שיש קליטה במכשיר</li>
              <li>נסו לבקש קוד חדש</li>
              <li>אם הבעיה נמשכת, נסו שוב מאוחר יותר או צרו קשר</li>
            </ul>
          </div>
        ),
      },
      {
        question: 'שיניתי מספר טלפון, מה עושים?',
        answer: 'פשוט התחברו עם המספר החדש. אם יש לכם תורים על המספר הישן, צרו קשר איתנו בטלפון 052-384-0981 ונעזור להעביר את הנתונים.',
      },
      {
        question: 'איך מתנתקים?',
        answer: 'היכנסו לפרופיל (בלחיצה על האייקון למטה) → גללו למטה → לחצו &quot;התנתק&quot;. שימו לב שאחרי התנתקות תצטרכו להתחבר שוב כדי לראות את התורים שלכם.',
      },
      {
        question: 'האם המידע שלי נשמר?',
        answer: 'כן, כל התורים והמידע שלכם נשמרים בצורה מאובטחת. אנחנו לא משתפים את המידע שלכם עם אף אחד. לפרטים נוספים ראו את מדיניות הפרטיות.',
      },
    ],
  },
  {
    title: 'מיקום ושעות פעילות',
    icon: <MapPin size={20} />,
    items: [
      {
        question: 'איפה אתם נמצאים?',
        answer: (
          <div className="space-y-2">
            <p><strong>הכתובת:</strong> יעקב טהון 13, ירושלים, ישראל</p>
            <p className="text-foreground-muted/80 text-sm">ניתן ללחוץ על הניווט בדף הבית לפתיחת Waze או Google Maps.</p>
          </div>
        ),
      },
      {
        question: 'מה שעות הפעילות?',
        answer: 'שעות הפעילות מופיעות בדף הבית למטה. באופן כללי אנחנו פתוחים בימים א\'-ו\'. שימו לב שכל ספר יכול להיות בשעות קצת שונות - בדקו בעמוד הספר הספציפי.',
      },
      {
        question: 'האם יש חניה?',
        answer: 'יש חניה ברחוב ובסביבה. בשעות העומס מומלץ להגיע מוקדם יותר למציאת חניה.',
      },
      {
        question: 'איך יוצרים קשר?',
        answer: (
          <div className="space-y-2">
            <p>מספר הטלפון שלנו: <strong>052-384-0981</strong></p>
            <p>אפשר גם לשלוח הודעת וואטסאפ או לעקוב אחרינו באינסטגרם.</p>
            <p className="text-foreground-muted/80 text-sm">כל הקישורים מופיעים בתחתית דף הבית.</p>
          </div>
        ),
      },
    ],
  },
  {
    title: 'תשלום ומחירים',
    icon: <CreditCard size={20} />,
    items: [
      {
        question: 'איך משלמים?',
        answer: 'התשלום מתבצע במספרה עצמה, בסיום הטיפול. ניתן לשלם במזומן, אשראי, או ביט/פייבוקס.',
      },
      {
        question: 'מה המחירים?',
        answer: 'המחירים מופיעים ליד כל שירות בעמוד הספר. המחירים כוללים מע"מ. אם יש מבצעים או הנחות, הם יופיעו באתר.',
      },
      {
        question: 'האם צריך לשלם מראש?',
        answer: 'לא, אין צורך לשלם מראש. קביעת התור בחינם והתשלום רק בסוף הטיפול במספרה.',
      },
    ],
  },
  {
    title: 'פתרון בעיות',
    icon: <HelpCircle size={20} />,
    items: [
      {
        question: 'האתר לא נטען / עובד לאט',
        answer: (
          <div className="space-y-2">
            <p>נסו את הדברים הבאים:</p>
            <ul className="list-disc list-inside space-y-1 mr-2">
              <li>רעננו את הדף (משכו למטה או לחצו רענן)</li>
              <li>סגרו את האפליקציה/דפדפן ופתחו מחדש</li>
              <li>בדקו את חיבור האינטרנט שלכם</li>
              <li>נקו את הזיכרון המטמון (cache) של הדפדפן</li>
              <li>נסו דפדפן אחר</li>
            </ul>
          </div>
        ),
      },
      {
        question: 'רואה מסך לבן / שגיאה',
        answer: 'סגרו את האפליקציה לגמרי ופתחו מחדש. אם הבעיה נמשכת, נסו למחוק את האפליקציה ולהתקין מחדש. אם גם זה לא עוזר, צרו קשר.',
      },
      {
        question: 'קבעתי תור אבל הוא לא מופיע',
        answer: (
          <div className="space-y-2">
            <p>כמה דברים לבדוק:</p>
            <ul className="list-disc list-inside space-y-1 mr-2">
              <li>וודאו שהשלמתם את תהליך הקביעה עד הסוף</li>
              <li>בדקו שאתם מחוברים עם אותו מספר טלפון</li>
              <li>רעננו את הדף</li>
              <li>התור מופיע ב&quot;התורים שלי&quot; בתפריט למטה</li>
            </ul>
            <p className="text-foreground-muted/80 text-sm mt-2">אם עדיין לא רואים, צרו קשר ונבדוק במערכת.</p>
          </div>
        ),
      },
      {
        question: 'אני חסום/ה ולא יכול/ה לקבוע תור',
        answer: 'אם יש הודעה שהחשבון חסום, צרו קשר ישירות עם המספרה בטלפון 052-384-0981 לבירור הנושא.',
      },
    ],
  },
]

function FAQAccordion({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 text-right hover:text-accent-gold transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-foreground-light font-medium pr-1">{item.question}</span>
        <ChevronDown 
          size={18} 
          className={cn(
            'text-foreground-muted shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )} 
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isOpen ? 'max-h-[500px] opacity-100 pb-4' : 'max-h-0 opacity-0'
        )}
      >
        <div className="text-foreground-muted text-sm leading-relaxed pr-1">
          {item.answer}
        </div>
      </div>
    </div>
  )
}

function FAQCategorySection({ category }: { category: FAQCategory }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="glass-card p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-accent-gold/10 flex items-center justify-center text-accent-gold">
          {category.icon}
        </div>
        <h2 className="text-lg font-medium text-foreground-light">{category.title}</h2>
      </div>
      <div className="divide-y divide-white/5">
        {category.items.map((item, index) => (
          <FAQAccordion
            key={index}
            item={item}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
          />
        ))}
      </div>
    </section>
  )
}

export default function FAQPage() {
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
            שאלות נפוצות
          </h1>
          <p className="text-foreground-muted">
            תשובות לשאלות הכי נפוצות על קביעת תורים, האפליקציה ועוד
          </p>
        </div>

        {/* Quick Help */}
        <div className="glass-card p-4 mb-6 bg-accent-gold/5 border-accent-gold/20">
          <p className="text-foreground-light text-sm">
            <strong>לא מצאתם תשובה?</strong> צרו קשר בטלפון{' '}
            <a href="tel:052-384-0981" className="text-accent-gold hover:underline">052-384-0981</a>{' '}
            ונשמח לעזור!
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-4">
          {faqCategories.map((category, index) => (
            <FAQCategorySection key={index} category={category} />
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-8 glass-card p-6 text-center">
          <h3 className="text-lg font-medium text-foreground-light mb-2">עדיין צריכים עזרה?</h3>
          <p className="text-foreground-muted text-sm mb-4">אנחנו כאן בשבילכם!</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="tel:052-384-0981"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-accent-gold text-background-dark font-medium rounded-xl hover:bg-accent-gold/90 transition-colors"
            >
              <span>התקשרו אלינו</span>
            </a>
            <a
              {...getExternalLinkProps("https://wa.me/972523840981")}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white/5 text-foreground-light font-medium rounded-xl hover:bg-white/10 transition-colors border border-white/10"
            >
              <span>שלחו וואטסאפ</span>
            </a>
          </div>
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
