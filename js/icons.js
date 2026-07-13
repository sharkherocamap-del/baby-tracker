/**
 * Tạo icon Material Symbols nhất quán cho toàn ứng dụng.
 * Icon chỉ mang tính trang trí; nút vẫn phải có nhãn chữ hoặc aria-label.
 */
export function createIcon(name, { size = 20, className = "", label = "", filled = false } = {}) {
  const icon = document.createElement("span");
  icon.className = `material-symbols-rounded app-icon${className ? ` ${className}` : ""}`;
  icon.textContent = name;
  icon.style.setProperty("--icon-size", `${size}px`);
  icon.style.setProperty("--icon-fill", filled ? "1" : "0");
  if (label) icon.setAttribute("aria-label", label);
  else icon.setAttribute("aria-hidden", "true");
  return icon;
}

export function setButtonContent(button, iconName, label, options = {}) {
  button.replaceChildren();
  button.append(createIcon(iconName, options), document.createTextNode(label));
  return button;
}

export function createIconLabel(iconName, label, options = {}) {
  const wrapper = document.createElement("span");
  wrapper.className = `icon-label${options.className ? ` ${options.className}` : ""}`;
  wrapper.append(createIcon(iconName, options), document.createTextNode(label));
  return wrapper;
}

export function createIllustration(iconName, { size = 44 } = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "state-illustration";
  if (/^[a-z0-9_]+$/i.test(String(iconName))) wrapper.append(createIcon(iconName, { size, filled: false }));
  else wrapper.textContent = String(iconName || "info");
  wrapper.setAttribute("aria-hidden", "true");
  return wrapper;
}
