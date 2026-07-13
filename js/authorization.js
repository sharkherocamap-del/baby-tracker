import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getFirebaseServices } from "./firebase-service.js";
import { normalizeEmail } from "./validators.js";

export async function checkAllowedUser(user) {
  if (!user?.email) return { allowed: false, reason: "Tài khoản Google không cung cấp email." };
  const email = normalizeEmail(user.email);
  const { db } = getFirebaseServices();
  const snapshot = await getDoc(doc(db, "allowedUsers", email));
  if (!snapshot.exists()) return { allowed: false, reason: "Tài khoản chưa được cấp quyền sử dụng ứng dụng." };
  const data = snapshot.data();
  if (data.active !== true) return { allowed: false, reason: "Tài khoản đã bị khóa trong danh sách người dùng." };
  if (!new Set(["admin", "member"]).has(data.role)) return { allowed: false, reason: "Vai trò tài khoản không hợp lệ." };
  return { allowed: true, email, profile: { id: snapshot.id, ...data } };
}

export function isAdmin() {
  const role = document.documentElement.dataset.role;
  return role === "admin";
}
