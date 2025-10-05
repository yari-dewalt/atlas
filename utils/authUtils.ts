import { supabase } from '../lib/supabase';

/**
 * Checks if the current user needs email verification
 * @returns boolean indicating if verification is needed
 */
export async function userNeedsEmailVerification(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? !user.email_confirmed_at : false;
}

/**
 * Sends an OTP verification email to a user
 * @param email - The email address to send the OTP to
 * @returns Promise with error if any
 */
export async function sendVerificationOtp(email: string) {
  return await supabase.auth.signInWithOtp({
    email: email,
    options: {
      shouldCreateUser: false,
    }
  });
}

/**
 * Verifies an OTP code
 * @param email - The email address
 * @param token - The OTP token
 * @returns Promise with verification result
 */
export async function verifyEmailOtp(email: string, token: string) {
  return await supabase.auth.verifyOtp({
    email: email,
    token: token,
    type: 'email'
  });
}
