import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, enableNetwork, disableNetwork } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { firebaseConfig, validateFirebaseConfig } from "./firebase-config.js";

let services = null;

/** Khởi tạo Firebase một lần duy nhất. */
export function initializeFirebase() {
  if (services) return services;
  const validation = validateFirebaseConfig();
  if (!validation.valid) {
    const error = new Error(`Firebase config chưa hợp lệ: ${validation.missingKeys.join(", ")}`);
    error.code = "app/invalid-config";
    throw error;
  }
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  services = { app, auth, db, storage };
  return services;
}

export function getFirebaseServices() {
  if (!services) return initializeFirebase();
  return services;
}

export async function reconnectFirestore() {
  const { db } = getFirebaseServices();
  await disableNetwork(db);
  await enableNetwork(db);
}
