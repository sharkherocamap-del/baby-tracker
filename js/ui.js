import { createIllustration, setButtonContent } from "./icons.js";

export function clearElement(element) {
  while (element?.firstChild) element.removeChild(element.firstChild);
}

export function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

export function renderLoading(container) {
  clearElement(container);
  const template = document.getElementById("loading-template");
  if (template) container.append(template.content.cloneNode(true));
}

export function renderEmptyState(container, { icon = "inventory_2", title = "Chưa có dữ liệu", message = "Hãy thêm bản ghi đầu tiên.", actionLabel = "", actionIcon = "add", onAction = null } = {}) {
  clearElement(container);
  const wrapper = createElement("div", { className: "empty-state" });
  wrapper.append(
    createIllustration(icon),
    createElement("h2", { text: title }),
    createElement("p", { text: message })
  );
  if (actionLabel && onAction) {
    const button = createElement("button", { className: "button button-primary", attrs: { type: "button" } });
    setButtonContent(button, actionIcon, actionLabel);
    button.addEventListener("click", onAction);
    wrapper.append(button);
  }
  container.append(wrapper);
}

export function renderErrorState(container, message, retry) {
  clearElement(container);
  const wrapper = createElement("div", { className: "error-state" });
  wrapper.append(
    createIllustration("error"),
    createElement("h2", { text: "Không thể tải dữ liệu" }),
    createElement("p", { text: message })
  );
  if (retry) {
    const button = createElement("button", { className: "button button-primary", attrs: { type: "button" } });
    setButtonContent(button, "refresh", "Thử lại");
    button.addEventListener("click", retry);
    wrapper.append(button);
  }
  container.append(wrapper);
}

export function statusBadge(text, tone = "default") {
  return createElement("span", { className: `badge${tone === "default" ? "" : ` badge-${tone}`}`, text });
}

export function safeImage(img, url, fallback = "./assets/images/baby-placeholder.svg") {
  img.src = url || fallback;
  img.addEventListener("error", () => { img.src = fallback; }, { once: true });
}

export function refreshIcons() {}
