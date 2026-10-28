// =====================================================
// Firebase settings for Neutrix (accounts + online saving).
// Copy these values from: Firebase console → Project settings → Your apps → Web app → "SDK setup and configuration" → Config.
//
// These values are NOT secret: Firebase web config is meant to be public.
// The data is protected by the Firestore security rules (each user can only read and write their own data).
// =====================================================
window.NEUTRIX_FIREBASE_CONFIG = {
    apiKey: "PASTE_API_KEY",
    authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
    projectId: "PASTE_PROJECT_ID",
    storageBucket: "PASTE_PROJECT_ID.appspot.com",
    messagingSenderId: "PASTE_SENDER_ID",
    appId: "PASTE_APP_ID"
};
