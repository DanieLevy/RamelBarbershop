import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { loadUsers } from "../store/actions/user.actions"
import { useNavigate } from "react-router"

export function BarberIndex() {
    const users = useSelector((storeState) => storeState.userModule.users)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const navigate = useNavigate()

    // useEffect(() => {
    //     loadUsers()
    // }, [])

    // useEffect(() => {
    //     window.addEventListener('resize', () => {
    //         setIsMobile(window.innerWidth < 768)
    //     })
    //     return () => {
    //         window.removeEventListener('resize', () => {
    //             setIsMobile(window.innerWidth < 768)
    //         })
    //     }

    // }, [window.innerWidth])


    const barbers = users.filter(user => user.isBarber)
    console.log(barbers);
    if (!barbers) return <div>Loading...</div>

    return (
        <div className="barber-index main-layout">
            <div className="index-header">
                <div className="index-header-content">
                    <div className="index-about">
                        <div className="index-about-content">
                            רמאל ברברשופ הוא מקום ייחודי במינו, עם תפיסה חדשנית ומקורית של עולם הספא והטיפוח הגברי.
                            ברברשופ מציעים לכם חוויה ייחודית של טיפוח וספא לגברים בלבד,
                            באווירה נעימה ומרגיעה, עם צוות מקצועי ומנוסה שידאג לכם לחוויה מושלמת ומרגיעה.
                            זו לא חוויה של פעם בחיים, לגבר קלאסי כמוך – זו דרך חיים.
                            בנוסף תוכלו לרכוש מוצרי פרורסו, ראוזל ודפר דן אצלנו במספרה:
                        </div>
                        <div className="index-about-imgs">
                            <img src="https://iili.io/JouEOas.th.jpg" alt="JouEOas.th.jpg" border="0" />

                        </div>
                    </div>
                </div>
            </div>
            <div className="index-body">
                <div className="index-body-content">
                    <div className="content-style">
                        <h1>הצוות שלנו</h1>
                    </div>
                </div>
                {/* BARBERS */}
                <div className="barbers-list">
                    {barbers.map(barber => <div className="barber-card" key={barber._id}>
                        <div className="barber-card">
                            <div className="card">
                                <p className="card-title">{barber.fullname}</p>
                                <div className="card-img">
                                    <img src={barber.imgUrl} alt="" />
                                </div>
                                <div className="card-btn">
                                    <button
                                        onClick={() => navigate(`/barber/${barber._id}`)}
                                    >קבע תור</button>
                                </div>
                            </div>
                        </div>
                    </div>)}
                </div>
                {/* LOCATION */}
                <div className="index-location">
                    <div className="index-location-content">
                        <div className="content-style">
                            <h1>המיקום</h1>
                        </div>
                        <div className="location-map">
                            <div className="location-map-content">
                                <div className="location-map-content-text">
                                    <p>בית הכרם 30, כיכר דניה, ירושלים</p>
                                </div>
                                <button
                                    onClick={() => window.open('https://waze.com/ul?ll=31.7805713%2C35.1886834&navigate=yes&zoom=17', '_blank')}
                                >
                                    לניווט בWaze
                                </button>
                            </div>

                            <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d13566.520697368585!2d35.1886834!3d31.7805713!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1502d74338829eb5%3A0x9a52d98b2c4f2c86!2sRAMEL%20BARBER%20SHOP!5e0!3m2!1siw!2sil!4v1700732215681!5m2!1siw!2sil"
                             width={isMobile ? "100%" : "600"} height={isMobile ? "300" : "450"} allowFullScreen="" loading="lazy"
                             ></iframe>
                        </div>
                    </div>
                </div>

                {/* CONTACT */}
                <div className="index-contact">
                    <div className="index-contact-content">
                        <div className="content-style">
                            <h1>צור קשר</h1>
                        </div>
                        {/* LINK TO WHATSAPP, INSTAGRAM, FACEBOOK, MAIL, PHONECALL */}
                        <div className="contact-links">
                            <div className="contact-link whatsapp"
                                onClick={() => window.open('https://wa.me/972523840981', '_blank')}
                            >
                            <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>WhatsApp</title><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                               <p>Whatsapp</p>
                                </div>
                            <div className="contact-link instagram"
                                onClick={() => window.open('https://www.instagram.com/ram__el_barber_shop/', '_blank')}
                            >
                            <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Instagram</title><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>
                                <p>Instagram</p>
                                </div>
                            <div className="contact-link facebook"
                                onClick={() => window.open('https://www.facebook.com/ramel.leusani', '_blank')}  
                            >
                            <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Facebook</title><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>
                                <p>Facebook</p>
                                </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    )
}