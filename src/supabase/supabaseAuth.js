import { supabase } from './supabaseClient';
import { auth } from '../firebase/setup';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

// Function to send OTP via Firebase
export const sendPhoneOtp = async (phoneNumber) => {
  try {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': (response) => {
        // reCAPTCHA solved, allow sending OTP
      }
    });

    const confirmation = await signInWithPhoneNumber(
      auth, 
      phoneNumber, 
      window.recaptchaVerifier
    );
    
    return { success: true, confirmation };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return { success: false, error: error.message };
  }
};

// Function to verify OTP code
export const verifyOtp = async (confirmation, code) => {
  try {
    const result = await confirmation.confirm(code);
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { success: false, error: error.message };
  }
};

// Function to link a Firebase-authenticated phone number with Supabase user
export const linkPhoneToBarberReservation = async (user, phoneNumber) => {
  try {
    if (!user || !phoneNumber) {
      return { success: false, error: 'Missing user or phone number' };
    }
    
    // Here you would normally update a Supabase auth user profile
    // But in this case we're just using Firebase for OTP verification
    // We could store the phone verification status in the reservations
    
    return { success: true };
  } catch (error) {
    console.error('Error linking phone to user:', error);
    return { success: false, error: error.message };
  }
};

// Get services list from Supabase
export const getServices = async () => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*');
    
    if (error) throw error;
    
    // Format services to match the app structure
    return data.map(service => ({
      _id: service.id,
      name: service.name,
      description: service.description,
      duration: service.duration,
      price: service.price
    }));
  } catch (error) {
    console.error('Error getting services:', error);
    throw error;
  }
}; 