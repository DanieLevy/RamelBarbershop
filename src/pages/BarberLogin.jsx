import React from "react"
import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import { login, logout, signup } from "../store/actions/user.actions.js"
import { LoginSignup } from '../cmps/LoginSignup.jsx'
import "react-multi-carousel/lib/styles.css"
import { IoIosMenu } from "react-icons/io"
import { FaCircleUser } from "react-icons/fa6"
import { useState } from "react"
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function BarberLogin() {
    const user = useSelector((storeState) => storeState.userModule.user)
    const [userModal, setUserModal] = useState(false)
    const [loginModal, setLoginModal] = useState(false)
    const [signupModal, setSignupModal] = useState(false)
    const users = useSelector((storeState) => storeState.userModule.users)

    async function onLogin(credentials) {
        try {
            const user = await login(credentials)
            toast.success(`Welcome back ${user.fullname}`)

            closeModal()
        } catch (err) {
            toast.error('Cannot login')
            console.log(`Cannot login`, err);
        }
    }

    async function onSignup(credentials) {
        try {
            const user = await signup(credentials)
            toast.success(`Welcome ${user.fullname}`)
            closeModal()
        } catch (err) {
            toast.error('Cannot signup')
            console.log(`Cannot signup`, err);
        }
    }

    async function onLogout() {
        try {
            await logout()
            toast.info(`Goodbye`)
        } catch (err) {
            toast.error('Cannot logout')
            console.log(`Cannot logout`, err);
        }
    }

    function closeModal() {
        setLoginModal(false)
        setUserModal(false)
    }

    return (
        <section className="login-signup-container">
            <div
                className="user-nav flex"
                onClick={(ev) => {
                    ev.stopPropagation()
                    setUserModal(!userModal)
                }}
            >
                <IoIosMenu />
                {user && user.imgUrl ? <img src={user.imgUrl} alt="" /> : <FaCircleUser className='user-icon' />}
            </div>

            {userModal && (
                <section className="user-modal">
                    <div className="back-drop" onClick={() => closeModal()}></div>
                    <ul className="user-modal-nav">
                        {!user ? (
                            <>
                                <li
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        setUserModal(false);
                                        setLoginModal(true)
                                        setSignupModal(false);
                                    }}
                                >
                                    Login
                                </li>
                                <li
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        setUserModal(false);
                                        setLoginModal(true)
                                        setSignupModal(true);
                                    }}
                                >
                                    Signup
                                </li>
                            </>
                        ) : (
                            <>
                                <li onClick={() => {
                                    onLogout()
                                    setUserModal(false)
                                }}>Logout</li>
                            </>
                        )}
                    </ul>
                </section>
            )}
            {loginModal && (
                <LoginSignup
                    login={onLogin}
                    signup={onSignup}
                    onToggleLogin={setLoginModal}
                    closeModal={closeModal}
                    isSignup={signupModal}
                    setSignupModal={setSignupModal}
                />
            )}
        </section>
    )

}
