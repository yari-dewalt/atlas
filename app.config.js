import 'dotenv/config';

export default {
  expo: {
    name: "Atlas",
    slug: "atlas",
    scheme: "atlas",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },
    ios: {
      bundleIdentifier: "com.atlasfitness.atlas",
      supportsTablet: false,
      orientation: "portrait",
      infoPlist: {
        UIBackgroundModes: ["audio", "remote-notification", "fetch"],
        "ITSAppUsesNonExemptEncryption": false,
        NSCameraUsageDescription: "This app uses the camera to take photos and videos for your fitness posts and progress tracking.",
        NSPhotoLibraryUsageDescription: "This app needs access to your photo library to select and share photos and videos for your fitness posts.",
        NSMicrophoneUsageDescription: "This app uses the microphone to record audio for videos in your fitness posts."
      }
    },
    android: {
      package: "com.atlasfitness.atlas",
      versionCode: 4,
      icon: "./assets/android-icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon.png",
        backgroundColor: "#000000",
        translucent: true,
      },
      permissions: [
        "VIBRATE", 
        "WAKE_LOCK",
        "CAMERA",
        "RECORD_AUDIO",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ],
      orientation: "portrait"
    },
    notification: {
      icon: "./assets/icon.png",
      color: "#ffffff",
      sounds: ["./assets/sounds/timercomplete.mp3"]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      eas: {
        projectId: "7c929c51-fee3-4a00-afa9-7c90f95cd9e7"
      }
    },
    plugins: [
      "expo-router",
      [
        "expo-screen-orientation",
        {
          initialOrientation: "PORTRAIT_UP"
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#ffffff",
          sounds: ["./assets/sounds/timercomplete.mp3"]
        }
      ],
      [
        "expo-task-manager"
      ],
      [
        "expo-background-fetch"
      ]
    ]
  },
};
