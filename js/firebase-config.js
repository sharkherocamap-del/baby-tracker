// THAY FIREBASE CONFIG CỦA BẠN TẠI ĐÂY
export const firebaseConfig = {
  apiKey: "AIzaSyCyRWEAWYqCKZuwsjhUD3f1xGXZ5lu9Vic",
  authDomain: "baby-tracker-family-86f7f.firebaseapp.com",
  projectId: "baby-tracker-family-86f7f",
  storageBucket: "baby-tracker-family-86f7f.firebasestorage.app",
  messagingSenderId: "486365865268",
  appId: "1:486365865268:web:ac364dbbe6252fd50a3161"
};

export const FIREBASE_SDK_VERSION = "12.16.0";

/** Kiểm tra cấu hình trước khi tải Firebase để tránh lỗi khó hiểu. */
export function validateFirebaseConfig(config = firebaseConfig) {
  const requiredKeys = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"];
  const missingKeys = requiredKeys.filter((key) => {
    const value = config[key];
    return typeof value !== "string" || value.trim() === "" || value.includes("YOUR_");
  });
  return { valid: missingKeys.length === 0, missingKeys };
}
