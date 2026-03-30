// Google OAuth Configuration
// You need to get these values from Google Cloud Console:
// 1. Go to https://console.cloud.google.com/
// 2. Create a new project or select existing one
// 3. Enable Google+ API and Google Sign-In API
// 4. Go to Credentials section
// 5. Create OAuth 2.0 Client IDs for both Web and Android/iOS

export const GOOGLE_CONFIG = {
  webClientId: '972975181815-je9h8bvgeorr1kkos3ukopf2bhqol166.apps.googleusercontent.com',
  iosClientId: '972975181815-1v7uutkc2hp2v2672riic8ndi792p1jo.apps.googleusercontent.com',
  androidClientId: '972975181815-2qv2oag713ntps02op7fq5amaun3bbnt.apps.googleusercontent.com',
};

// Instructions:
// 1. Replace the placeholder values above with your actual Google OAuth client IDs
// 2. Make sure to add the Web Client ID to your Supabase Auth settings:
//    - Go to Supabase Dashboard > Authentication > Settings
//    - Add Google as a provider
//    - Add your Web Client ID and Client Secret
// 3. For React Native, you also need to configure the Android and iOS apps:
//    - Android: Add the SHA-1 fingerprint to Google Console
//    - iOS: Add the bundle ID to Google Console
