// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration

const firebaseConfig = {
    apiKey: "AIzaSyCgkZxNC8ZpESpsddUE7NX4ZOszGGAX1EM",
    authDomain: "ramel-barbershop.firebaseapp.com",
    projectId: "ramel-barbershop",
    storageBucket: "ramel-barbershop.appspot.com",
    messagingSenderId: "74350287277",
    appId: "1:74350287277:web:fded765e7c5971ea9da924",
    measurementId: "G-FP6VKDYGGC"
};

const app = initializeApp(firebaseConfig);
// Turn off phone auth app verification.
// auth.useDeviceLanguage();
// Initialize Firebase
const analytics = getAnalytics(app);
export const auth = getAuth(app);