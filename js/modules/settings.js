import { getState } from "../app-state.js";
import { routes } from "../router.js";
import { createDemoData } from "../demo-data.js";
import { clearElement, createElement } from "../ui.js";

const featureRoutes = ["growth","vaccinations","medical-visits","feeding","sleep","diapers","symptoms","medications","allergies","milestones","teething","reminders","reports"];

export function render(container) {
  clearElement(container);
  const header = createElement("div", { className: "view-header" });
  const intro = createElement("div"); intro.append(createElement("h2", { text: "Cài đặt & danh mục" }), createElement("p", { className: "muted", text: "Mở nhanh các chức năng và tùy chỉnh giao diện." }));
  header.append(intro); container.append(header);

  const themeCard = createElement("section", { className: "card mb-2" });
  themeCard.append(createElement("h3", { text: "Giao diện" }));
  const themeActions = createElement("div", { className: "flex flex-wrap gap-1 mt-1" });
  [["light","Sáng"],["dark","Tối"],["system","Theo hệ thống"]].forEach(([value,label]) => {
    const button = createElement("button", { className: "button button-ghost", text: label, attrs: { type: "button" } });
    button.addEventListener("click", () => {
      if (value === "system") {
        localStorage.removeItem("babyTracker.theme");
        document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        localStorage.setItem("babyTracker.theme", value);
        document.documentElement.dataset.theme = value;
      }
    });
    themeActions.append(button);
  });
  themeCard.append(themeActions); container.append(themeCard);

  const featureCard = createElement("section", { className: "card mb-2" });
  featureCard.append(createElement("h3", { text: "Tất cả chức năng" }));
  const grid = createElement("div", { className: "quick-actions mt-2" });
  featureRoutes.forEach((name) => {
    const route = routes[name];
    const button = createElement("button", { className: "quick-action", attrs: { type: "button" } });
    button.append(createElement("span", { text: route.icon, attrs: { "aria-hidden": "true" } }), createElement("strong", { text: route.title }));
    button.addEventListener("click", () => { window.location.hash = `#/${name}`; });
    grid.append(button);
  });
  featureCard.append(grid); container.append(featureCard);

  if (getState().currentRole === "admin") {
    const adminCard = createElement("section", { className: "card mb-2" });
    adminCard.append(createElement("h3", { text: "Công cụ admin" }), createElement("p", { className: "muted small mt-1", text: "Dữ liệu demo không được tạo tự động và có dấu nhận diện để tránh tạo trùng." }));
    const buttons = createElement("div", { className: "flex flex-wrap gap-1 mt-1" });
    const demo = createElement("button", { className: "button button-secondary", text: "Tạo dữ liệu demo", attrs: { type: "button" } });
    const users = createElement("button", { className: "button button-ghost", text: "Quản lý người dùng", attrs: { type: "button" } });
    demo.addEventListener("click", async () => { demo.disabled = true; await createDemoData(); demo.disabled = false; });
    users.addEventListener("click", () => { window.location.hash = "#/users"; });
    buttons.append(demo, users); adminCard.append(buttons); container.append(adminCard);
  }

  const about = createElement("section", { className: "card" });
  about.append(createElement("h3", { text: "Thông tin kỹ thuật" }));
  const list = createElement("div", { className: "record-fields mt-1" });
  [["Firebase Web SDK","12.16.0"],["Chart.js","4.5.1"],["Múi giờ hiển thị","Asia/Ho_Chi_Minh"],["Hosting","GitHub Pages / static"]].forEach(([label,value]) => { const item=createElement("div",{className:"record-field"}); item.append(createElement("span",{text:label}),createElement("span",{text:value})); list.append(item); });
  about.append(list, createElement("p", { className: "medical-note mt-2", text: "Thông tin trong ứng dụng chỉ dùng để ghi chép và tham khảo, không thay thế việc thăm khám hoặc tư vấn của bác sĩ." }));
  container.append(about);
  return () => {};
}
