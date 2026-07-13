import { getState, subscribe } from "./app-state.js";
import { navigate, routes } from "./router.js";
import { clearElement, createElement } from "./ui.js";

const sidebarOrder = ["dashboard", "babies", "growth", "vaccinations", "medical-visits", "feeding", "sleep", "diapers", "symptoms", "medications", "allergies", "milestones", "teething", "reminders", "reports", "users", "settings"];
const bottomOrder = ["dashboard", "babies", "feeding", "reminders", "settings"];
let unsubscribeState = null;

function buildButton(routeName, compact = false) {
  const route = routes[routeName];
  const button = createElement("button", { attrs: { type: "button", "data-route": routeName, "aria-label": route.title } });
  const icon = createElement("span", { className: "nav-icon", text: route.icon, attrs: { "aria-hidden": "true" } });
  const label = createElement("span", { text: compact && routeName === "settings" ? "Thêm" : route.title });
  button.append(icon, label);
  button.addEventListener("click", () => navigate(routeName));
  return button;
}

function renderNavigation(state = getState()) {
  const sidebar = document.getElementById("sidebar-navigation");
  const bottom = document.getElementById("bottom-navigation");
  clearElement(sidebar);
  clearElement(bottom);
  sidebarOrder.filter((name) => !routes[name].adminOnly || state.currentRole === "admin").forEach((name) => sidebar.append(buildButton(name)));
  bottomOrder.forEach((name) => bottom.append(buildButton(name, true)));
  document.querySelectorAll("[data-route]").forEach((button) => button.classList.toggle("active", button.dataset.route === state.currentView));
}

export function initializeNavigation() {
  renderNavigation();
  unsubscribeState?.();
  unsubscribeState = subscribe((state) => renderNavigation(state));
}

export function destroyNavigation() {
  unsubscribeState?.();
  unsubscribeState = null;
}
