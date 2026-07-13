import { getState } from "../app-state.js";
import { routes } from "../router.js";
import { createDemoData } from "../demo-data.js";
import { clearElement, createElement } from "../ui.js";
import { createIcon, setButtonContent } from "../icons.js";

const featureRoutes = ["growth","vaccinations","medical-visits","feeding","sleep","diapers","symptoms","medications","allergies","milestones","teething","reminders","reports"];

export function render(container) {
  clearElement(container);
  const header = createElement("div", { className: "view-header" });
  const intro = createElement("div"); intro.append(createElement("h2", { text: "Cài đặt & danh mục" }), createElement("p", { className: "muted", text: "Mở nhanh các chức năng và tùy chỉnh giao diện." }));
  header.append(intro); container.append(header);

  const themeCard = createElement("section", { className: "card mb-2" });
  const themeTitle = createElement("h3"); themeTitle.append(createIcon("palette", { size: 21 }), document.createTextNode(" Giao diện"));
  themeCard.append(themeTitle);
  const themeActions = createElement("div", { className: "flex flex-wrap gap-1 mt-1" });
  [["light","light_mode","Sáng"],["dark","dark_mode","Tối"],["system","devices","Theo hệ thống"]].forEach(([value,icon,label]) => {
    const button = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
    setButtonContent(button, icon, label);
    button.addEventListener("click", () => {
      if (value === "system") {
        localStorage.removeItem("babyTracker.theme");
        document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        localStorage.setItem("babyTracker.theme", value);
        document.documentElement.dataset.theme = value;
      }
      const themeIcon = document.querySelector("#theme-toggle .material-symbols-rounded");
      if (themeIcon) themeIcon.textContent = document.documentElement.dataset.theme === "dark" ? "light_mode" : "dark_mode";
    });
    themeActions.append(button);
  });
  themeCard.append(themeActions); container.append(themeCard);

  const featureCard = createElement("section", { className: "card mb-2" });
  const featureTitle = createElement("h3"); featureTitle.append(createIcon("apps", { size: 21 }), document.createTextNode(" Tất cả chức năng"));
  featureCard.append(featureTitle);
  const grid = createElement("div", { className: "quick-actions mt-2" });
  featureRoutes.forEach((name) => {
    const route = routes[name];
    const button = createElement("button", { className: "quick-action", attrs: { type: "button" } });
    button.append(createIcon(route.icon, { size: 27, className: "quick-action-icon", filled: true }), createElement("strong", { text: route.title }));
    button.addEventListener("click", () => { window.location.hash = `#/${name}`; });
    grid.append(button);
  });
  featureCard.append(grid); container.append(featureCard);

  if (getState().currentRole === "admin") {
    const adminCard = createElement("section", { className: "card mb-2" });
    const adminTitle = createElement("h3"); adminTitle.append(createIcon("admin_panel_settings", { size: 21 }), document.createTextNode(" Công cụ admin"));
    adminCard.append(adminTitle, createElement("p", { className: "muted small mt-1", text: "Nút demo sẽ tạo các hồ sơ còn thiếu. Hồ sơ đầy đủ có dữ liệu ở tất cả module và có dấu nhận diện để không tạo trùng." }));
    const buttons = createElement("div", { className: "flex flex-wrap gap-1 mt-1" });
    const demo = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
    setButtonContent(demo, "database", "Tạo/hoàn thiện dữ liệu demo");
    const users = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
    setButtonContent(users, "group", "Quản lý người dùng");
    demo.addEventListener("click", async () => { demo.disabled = true; await createDemoData(); demo.disabled = false; });
    users.addEventListener("click", () => { window.location.hash = "#/users"; });
    buttons.append(demo, users); adminCard.append(buttons); container.append(adminCard);
  }

  const about = createElement("section", { className: "card" });
  const aboutTitle = createElement("h3"); aboutTitle.append(createIcon("info", { size: 21 }), document.createTextNode(" Thông tin kỹ thuật"));
  about.append(aboutTitle);
  const list = createElement("div", { className: "record-fields mt-1" });
  [["Firebase Web SDK","12.16.0"],["Chart.js","4.5.1"],["Icon","Material Symbols Rounded"],["Múi giờ hiển thị","Asia/Ho_Chi_Minh"],["Hosting","GitHub Pages / static"]].forEach(([label,value]) => { const item=createElement("div",{className:"record-field"}); item.append(createElement("span",{text:label}),createElement("span",{text:value})); list.append(item); });
  about.append(list, createElement("p", { className: "medical-note mt-2", text: "Thông tin trong ứng dụng chỉ dùng để ghi chép và tham khảo, không thay thế việc thăm khám hoặc tư vấn của bác sĩ." }));
  container.append(about);
  return () => {};
}
