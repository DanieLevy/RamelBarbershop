import React, { useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { login, logout, signup } from "../store/actions/user.actions.js"
import { LoginSignup } from './LoginSignup'
import "react-multi-carousel/lib/styles.css"
import { IoIosMenu } from "react-icons/io"
import { FaCircleUser } from "react-icons/fa6"
import { useState } from "react"
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function AppHeader() {
  const navigate = useNavigate()

  const [isMenuOpen, setIsMenuOpen] = useState(window.scrollY === 0 ? false : true)

  useEffect(() => {
    // handle scroll so when user on top of page, menu is open, else it's closed 
    // also, when user scroll to top, menu is open immediately
    const handleScroll = () => {
      if (window.scrollY === 0) setIsMenuOpen(false)
      else setIsMenuOpen(true)
    }
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  function scrollToClass(className) {
    // if user not in home page (/) - navigate to home page, then scroll to class
    if (window.location.pathname !== '/') {
      navigate('/')
      setTimeout(() => {
        const el = document.querySelector(`.${className}`)
        el.scrollIntoView({ behavior: 'smooth' })
      }, 1000)
      return
    }
    // if user in home page (/) - scroll to class

    // if className === index-header - scroll to top of page (0)
    if (className === 'index-header') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // else - scroll to class
    const el = document.querySelector(`.${className}`)
    el.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <React.Fragment>
      <section className={`header-container`}>
        <header className={`main-header flex main-layout ${isMenuOpen ? 'close' : ''}`}>
        {/* <button className="menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <IoIosMenu />
        </button> */}
          <div className="nav-container">
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
              <img src='https://upcdn.io/W142hJk/raw/demo/4m1ZVkLs6V.jpeg' alt="" />
            </div>
            <div className="location flex">
              <p onClick={() => { scrollToClass('index-location') }}>מיקום</p>
            </div>
            <div className="reservation flex">
              <p onClick={() => { scrollToClass('index-body') }}> קבע תור</p>
              <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 16 16" version="1.1" data-view-component="true"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"></path></svg>
            </div>
          </div>
        </header>
      </section>
    </React.Fragment>

  );
}

{/* <Link to='/' className='logo flex'>
רם-אל ברברשופ
</Link> */}