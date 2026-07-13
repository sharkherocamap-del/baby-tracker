import { createIcon } from "./icons.js";

const DEFAULT_DURATION = 4200;

export function showToast(message, type = "info", duration = DEFAULT_DURATION) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const text = document.createElement("span");
  text.textContent = message;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-button";
  close.setAttribute("aria-label", "Đóng thông báo");
  close.append(createIcon("close", { size: 20 }));
  close.addEventListener("click", () => toast.remove());

  toast.append(text, close);
  region.append(toast);
  window.setTimeout(() => toast.remove(), duration);
}

export function friendlyErrorMessage(error, fallback = "Đã xảy ra lỗi. Vui lòng thử lại.") {
  const code = error?.code || "";
  const messages = {
    "auth/popup-blocked": "Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup cho website này.",
    "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập.",
    "auth/network-request-failed": "Không thể kết nối mạng. Hãy kiểm tra Internet và thử lại.",
    "auth/unauthorized-domain": "Tên miền này chưa được thêm vào Authorized Domains của Firebase Authentication.",
    "auth/operation-not-allowed": "Google Sign-In chưa được bật trong Firebase Authentication.",
    "auth/user-disabled": "Tài khoản đăng nhập này đã bị vô hiệu hóa trong Firebase Authentication.",
    "permission-denied": "Bạn không có quyền thực hiện thao tác này hoặc Firestore Rules chưa được cấu hình đúng.",
    "firestore/permission-denied": "Bạn không có quyền thực hiện thao tác này hoặc Firestore Rules chưa được cấu hình đúng.",
    "unavailable": "Dịch vụ tạm thời không khả dụng. Hãy kiểm tra kết nối mạng.",
    "firestore/unavailable": "Dịch vụ tạm thời không khả dụng. Hãy kiểm tra kết nối mạng.",
    "app/invalid-config": "Firebase chưa được cấu hình đúng."
  };
  return messages[code] || fallback;
}
