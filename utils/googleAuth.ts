import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { GOOGLE_CONFIG } from '../config/googleConfig';

export const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  const { GoogleSignin } = require('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: GOOGLE_CONFIG.webClientId,
    iosClientId: GOOGLE_CONFIG.iosClientId,
  });
}

export async function signInWithGoogle() {
  if (isExpoGo) {
    throw new Error('Google Sign-In requires a development build and is not available in Expo Go.');
  }

  const { GoogleSignin } = require('@react-native-google-signin/google-signin');
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken;

  if (!idToken) {
    throw new Error('No ID token received from Google');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) throw error;

  return { data, googleUserInfo: userInfo.data };
}

export async function signOutGoogle() {
  if (!isExpoGo) {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('Google Sign-Out error:', error);
    }
  }
  await supabase.auth.signOut();
}
