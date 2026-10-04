// ===== إعداد Firebase =====

const firebaseConfig = {
  apiKey: "AIzaSyAYIhL3haWFGFg4hd_YcJkZ4v0d3VjT03c",
  authDomain: "accounting-sync-f7192.firebaseapp.com",
  projectId: "accounting-sync-f7192",
  storageBucket: "accounting-sync-f7192.firebasestorage.app",
  messagingSenderId: "461356768780",
  appId: "1:461356768780:web:5f1b80fc2dc1719e38d829",
  measurementId: "G-2ZJDG4JSEZ"
};

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let firebaseReady = false;

function initFirebase() {
  if (firebaseReady) return true;
  if (typeof firebase === 'undefined') {
    console.warn('⚠️ Firebase SDK غير محمّل');
    return false;
  }
  try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth();
    firebaseDB = firebase.firestore();
    firebaseReady = true;
    console.log('✅ Firebase جاهز');
    return true;
  } catch (e) {
    console.error('❌ خطأ Firebase:', e);
    return false;
  }
}
