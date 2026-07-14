// THAY FIREBASE CONFIG CỦA BẠN TẠI ĐÂY
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const FIREBASE_SDK_VERSION = "12.16.0";

/** Kiểm tra cấu hình trước khi tải Firebase để tránh lỗi khó hiểu. */
export function validateFirebaseConfig(config = firebaseConfig) {
  const requiredKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
  const missingKeys = requiredKeys.filter((key) => {
    const value = config[key];
    return typeof value !== "string" || value.trim() === "" || value.includes("YOUR_");
  });
  return { valid: missingKeys.length === 0, missingKeys };
}
