import { getState, setState } from "./app-state.js";
import { showToast } from "./toast.js";
import { renderErrorState, renderLoading } from "./ui.js";

export const routes = {
  dashboard: { title: "Dashboard", kicker: "TỔNG QUAN", icon: "⌂", loader: () => import("./modules/dashboard.js") },
  babies: { title: "Hồ sơ bé", kicker: "HỒ SƠ", icon: "◉", loader: () => import("./modules/babies.js") },
  growth: { title: "Tăng trưởng", kicker: "PHÁT TRIỂN", icon: "↗", loader: () => import("./modules/growth.js") },
  vaccinations: { title: "Tiêm phòng", kicker: "SỨC KHỎE", icon: "✚", loader: () => import("./modules/vaccinations.js") },
  "medical-visits": { title: "Khám bệnh", kicker: "SỨC KHỎE", icon: "♙", loader: () => import("./modules/medical-visits.js") },
  feeding: { title: "Ăn uống", kicker: "SINH HOẠT", icon: "◒", loader: () => import("./modules/feeding.js") },
  sleep: { title: "Giấc ngủ", kicker: "SINH HOẠT", icon: "☾", loader: () => import("./modules/sleep.js") },
  diapers: { title: "Thay tã", kicker: "SINH HOẠT", icon: "◇", loader: () => import("./modules/diapers.js") },
  symptoms: { title: "Triệu chứng", kicker: "SỨC KHỎE", icon: "!", loader: () => import("./modules/symptoms.js") },
  medications: { title: "Thuốc & vitamin", kicker: "SỨC KHỎE", icon: "✦", loader: () => import("./modules/medications.js") },
  allergies: { title: "Dị ứng", kicker: "SỨC KHỎE", icon: "⚑", loader: () => import("./modules/allergies.js") },
  milestones: { title: "Mốc phát triển", kicker: "PHÁT TRIỂN", icon: "★", loader: () => import("./modules/milestones.js") },
  teething: { title: "Mọc răng", kicker: "PHÁT TRIỂN", icon: "♢", loader: () => import("./modules/teething.js") },
  reminders: { title: "Nhắc việc", kicker: "LỊCH", icon: "◷", loader: () => import("./modules/reminders.js") },
  reports: { title: "Báo cáo & xuất dữ liệu", kicker: "BÁO CÁO", icon: "▤", loader: () => import("./modules/reports.js") },
  users: { title: "Người dùng", kicker: "QUẢN TRỊ", icon: "♧", adminOnly: true, loader: () => import("./modules/allowed-users.js") },
  settings: { title: "Cài đặt", kicker: "ỨNG DỤNG", icon: "⚙", loader: () => import("./modules/settings.js") }
};

let cleanupCurrentView = null;
let hashListener = null;
let renderToken = 0;

function routeFromHash() {
  const route = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return routes[route] ? route : "dashboard";
}

export async function renderCurrentRoute(forceRoute = null) {
  const container = document.getElementById("view-container");
  if (!container) return;
  let routeName = forceRoute || routeFromHash();
  const state = getState();
  if (routes[routeName].adminOnly && state.currentRole !== "admin") {
    routeName = "dashboard";
    window.history.replaceState(null, "", "#/dashboard");
    showToast("Chỉ admin được phép mở trang quản lý người dùng.", "warning");
  }
  cleanupCurrentView?.();
  cleanupCurrentView = null;
  setState({ currentView: routeName });
  document.getElementById("current-view-title").textContent = routes[routeName].title;
  document.getElementById("current-view-kicker").textContent = routes[routeName].kicker;
  document.querySelectorAll("[data-route]").forEach((button) => button.classList.toggle("active", button.dataset.route === routeName));
  renderLoading(container);
  const token = ++renderToken;
  try {
    const module = await routes[routeName].loader();
    if (token !== renderToken) return;
    const cleanup = await module.render(container);
    cleanupCurrentView = typeof cleanup === "function" ? cleanup : null;
    document.getElementById("main-content")?.focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    if (token !== renderToken) return;
    renderErrorState(container, "Không thể mở màn hình này. Xem console để biết chi tiết.", () => renderCurrentRoute(routeName));
  }
}

export function navigate(routeName) {
  if (!routes[routeName]) routeName = "dashboard";
  const target = `#/${routeName}`;
  if (window.location.hash === target) renderCurrentRoute(routeName);
  else window.location.hash = target;
}

export function initializeRouter() {
  if (hashListener) return;
  hashListener = () => renderCurrentRoute();
  window.addEventListener("hashchange", hashListener);
  if (!window.location.hash) window.history.replaceState(null, "", "#/dashboard");
  renderCurrentRoute();
}

export function destroyRouter() {
  cleanupCurrentView?.();
  cleanupCurrentView = null;
  if (hashListener) window.removeEventListener("hashchange", hashListener);
  hashListener = null;
  renderToken += 1;
}
