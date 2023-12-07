
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { auth } from "../firebase/setup";
import { useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

export function OTPCodeCmp() {
    const [phone, setPhone] = useState('');
    const [user, setUser] = useState(null);
    const [otp, setOtp] = useState('');
    const [error, setError] = useState(null);
    
    // const sendOtp = async () => {
    //     const phoneNumber = `+972${phone}`;
    //     console.log('phoneNumber', phoneNumber);
    //     // phone number to string
    //     phone.toString();

    //     try {
    //         const recaptcha = new RecaptchaVerifier(auth, "recaptcha", {
    //             size: "invisible",
    //             callback: (response) => {
    //                 console.log('response', response);
    //                 // onSignInSubmit();
    //             },
    //         });

    //         const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptcha);
    //         console.log('confirmation', confirmation);
    //         setUser(confirmation);
    //     } catch (err) {
    //         console.error('Error sending OTP:', err);

    //         // Handle specific error types if needed
    //         if (err instanceof AuthError) {
    //             // Handle authentication errors
    //             setError(err.message);
    //         } else {
    //             // Handle other types of errors
    //             setError("An unexpected error occurred.");
    //         }
    //     }
    // };

    auth.settings.appVerificationDisabledForTesting = true;
    
    const generateRecaptcha = () => {
        try {
            if (!auth) {
                throw new Error('Auth object is not initialized');
            }
    
            window.recaptchaVerifier = new RecaptchaVerifier('recaptcha', {
                'size': 'invisible',
                'callback': (response) => {
                    console.log('response', response);
                    // onSignInSubmit();
                },
            }, auth);
        } catch (error) {
            console.error('Error initializing RecaptchaVerifier:', error);
        }
    };
    


    const sendOtp = (e) => {
        e.preventDefault();
        if (!phone) return;
        const phoneNumber = `+972${phone}`;
        console.log('phoneNumber', phoneNumber);
        generateRecaptcha();
        let appVerifier = window.recaptchaVerifier;
        signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((confirmationResult) => {
            // SMS sent. Prompt user to type the code from the message, then sign the
            // user in with confirmationResult.confirm(code).
            console.log('confirmationResult', confirmationResult);
            // ...
            window.confirmationResult = confirmationResult;
        }
        ).catch((error) => {
            // Error; SMS not sent
            // ...
            console.log('error', error);
        });

    };

    const verifyOtp = async () => {
        try {
            console.log('otp', otp);
            const data = await user.confirm(otp);
            console.log('data', data);
        } catch (err) {
            console.log('err', err);
            setError("Failed to verify OTP. Please try again.");
        }
    };

    return (
        <div className="otp-code-cmp">
            <h1>OTP Code</h1>
            <p className="helpertext">Empty</p>
            <button>Send OTP</button>
            <div className="otp-code-cmp-content">
                {/* <PhoneInput
                    country={'il'}
                    value={phone}
                    onChange={phone => setPhone("+" + phone)}
                /> */}
                <input
                    type='tel'
                    value={phone}
                    onChange={(ev) => setPhone(ev.target.value)}
                />
                <button onClick={sendOtp}>Send OTP</button>
                <div id="recaptcha"></div>
                <br />
                <input
                    type="text"
                    value={otp}
                    onChange={(ev) => setOtp(ev.target.value)}
                />
                <br />
                <button onClick={verifyOtp}>Verify</button>

                {error && <p style={{ color: 'red' }}>{error}</p>}
            </div>
        </div>
    );
}
