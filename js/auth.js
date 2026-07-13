import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirebaseServices } from "./firebase-service.js";

let persistenceReady = null;

export function initializeAuthPersistence() {
  if (!persistenceReady) {
    const { auth } = getFirebaseServices();
    persistenceReady = setPersistence(auth, browserLocalPersistence);
  }
  return persistenceReady;
}

export function observeAuthState(callback) {
  const { auth } = getFirebaseServices();
  return onAuthStateChanged(auth, callback, (error) => {
    console.error(error);
    callback(null, error);
  });
}

/** Phải được gọi trực tiếp từ sự kiện click để trình duyệt không chặn popup. */
export function signInWithGooglePopup() {
  const { auth } = getFirebaseServices();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

export function signOutCurrentUser() {
  const { auth } = getFirebaseServices();
  return signOut(auth);
}
