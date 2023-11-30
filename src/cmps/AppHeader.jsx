import React, { useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { loadUser, loadUsers, login, logout, signup } from "../store/actions/user.actions.js"
import { LoginSignup } from './LoginSignup'
import "react-multi-carousel/lib/styles.css"
import { IoIosMenu } from "react-icons/io"
import { FaCircleUser } from "react-icons/fa6"
import { useState } from "react"
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// react router location hook
import { useLocation } from 'react-router-dom'
import { userService } from "../services/user.service.js"


export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(window.scrollY === 0 ? false : true);
  const [isHomePage, setIsHomePage] = useState(location.pathname === '/' ? true : false);
  const [isBarberPage, setIsBarberPage] = useState(location.pathname.includes('/barber') ? true : false);
  const users = useSelector(state => state.userModule.users)
  const [barber, setBarber] = useState(null);

  useEffect(() => {
    if (!users || !users.length) {
      loadUsers();
      return;
    }
    const barberId = location.pathname.split('/')[2];
    const barberUser = users.find(user => user._id === barberId);
    if (!barberUser) {
      console.log('barber not found');
      // navigate('/');
      return;
    }
    setBarber(barberUser);

  }, [location, users]);



  useEffect(() => {
    const handleScroll = () => {
      setIsMenuOpen(window.scrollY === 0 ? false : true);
    };

    const handleLocation = () => {
      setIsHomePage(location.pathname === '/');
      setIsBarberPage(location.pathname.includes('/barber'));
    };

    window.addEventListener('scroll', handleScroll);
    handleLocation(); // Set initial state based on the current location
    window.addEventListener('popstate', handleLocation); // Set state when navigation occurs

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('popstate', handleLocation);
    };

  }, [location]);

  function scrollToClass(className) {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.querySelector(`.${className}`);
        el.scrollIntoView({ behavior: 'smooth' });
      }, 1000);
      return;
    }

    if (className === 'index-header') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const el = document.querySelector(`.${className}`);
    el.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <React.Fragment>
      <section className={`header-container`}>
        <header className={`main-header flex main-layout ${isMenuOpen ? 'close' : ''} ${isHomePage ? 'home-page' : ''} ${isBarberPage ? 'barber-page' : ''}`}>
          {isHomePage && <div className="nav-container">
            {/* show list of links to pages/scrolldown */}
            <div className="about flex">
              <p onClick={() => { scrollToClass('index-header') }}>אודות</p>
            </div>
            <div className="contact flex">
              <p onClick={() => { scrollToClass('index-contact') }}>צור קשר</p>
            </div>
            <div className={`logo flex ${isMenuOpen ? 'close' : ''}`}
              onClick={() => { navigate('/') }}
            >
              <img src='https://iili.io/JxtxOgf.md.jpg" alt="JxtxOgf.md.jpg' alt="" />
            </div>
            <div className="location flex">
              <p onClick={() => { scrollToClass('index-location') }}>מיקום</p>
            </div>
            <div className="reservation flex">
              <p onClick={() => { scrollToClass('index-body') }}> קבע תור</p>
              <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 16 16" version="1.1" data-view-component="true"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"></path></svg>
            </div>
          </div>
          }
          {isBarberPage && <div className="nav-container barber">
            <div className="back-btn flex" onClick={() => { navigate('/') }}>
              <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 16 16" version="1.1" data-view-component="true"><path fillRule="evenodd" d="M1.22 8a.75.75 0 0 1 0-1.06L6.47 2.7a.75.75 0 1 1 1.06 1.06L3.81 7h10.44a.75.75 0 0 1 0 1.5H3.81l3.72 3.72a.75.75 0 1 1-1.06 1.06L1.22 8Z"></path></svg>
              <p>חזור</p>
            </div>
            <div className="title flex">
              <p>הזמנת תור</p>
            </div>
            <div className={`logo flex ${barber ? 'barber' : ''}`}
              onClick={() => { console.log('TODO: navigate to barber page') }}
            >

              {barber ? <img src={barber.imgUrl} alt="" /> : <img src='https://upcdn.io/W142hJk/raw/demo/4m1ZVkLs6V.jpeg' alt="" />}
            </div>
          </div>
          }
        </header>
      </section>
    </React.Fragment>

  );
}

{/* <Link to='/' className='logo flex'>
רם-אל ברברשופ
</Link> */}