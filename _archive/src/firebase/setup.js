// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// import { getAuth } from "firebase/auth";

// // Your web app's Firebase configuration

// const firebaseConfig = {
//     apiKey: "AIzaSyCgkZxNC8ZpESpsddUE7NX4ZOszGGAX1EM",
//     authDomain: "ramel-barbershop.firebaseapp.com",
//     projectId: "ramel-barbershop",
//     storageBucket: "ramel-barbershop.appspot.com",
//     messagingSenderId: "74350287277",
//     appId: "1:74350287277:web:fded765e7c5971ea9da924",
//     measurementId: "G-FP6VKDYGGC"
// };

// const app = initializeApp(firebaseConfig);
// // Turn off phone auth app verification.
// // auth.useDeviceLanguage();
// // Initialize Firebase
// const analytics = getAnalytics(app);
// export const auth = getAuth(app);

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBmqCmk3k1LEo8k770hE98XtirpxAPzIOc",
    authDomain: "ramelbarbershop.firebaseapp.com",
    projectId: "ramelbarbershop",
    storageBucket: "ramelbarbershop.appspot.com",
    messagingSenderId: "1048377341116",
    appId: "1:1048377341116:web:480fae813f3bd2ca650cb9",
    measurementId: "G-85VPXJLX1C"
  };  

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);