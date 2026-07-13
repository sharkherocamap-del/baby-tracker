import { clearElement, createElement } from "./ui.js";

let activeModal = null;
let previousFocus = null;

export function closeModal() {
  if (!activeModal) return;
  activeModal.remove();
  activeModal = null;
  document.body.style.overflow = "";
  previousFocus?.focus?.();
}

export function openModal({ title, content, size = "medium", closeOnBackdrop = true }) {
  closeModal();
  previousFocus = document.activeElement;
  const root = document.getElementById("modal-root");
  clearElement(root);
  const backdrop = createElement("div", { className: "modal-backdrop", attrs: { role: "presentation" } });
  const panel = createElement("section", { className: `modal-panel modal-${size}`, attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-title" } });
  const header = createElement("header", { className: "modal-header" });
  const heading = createElement("h2", { text: title, attrs: { id: "modal-title" } });
  const closeButton = createElement("button", { className: "modal-close", text: "×", attrs: { type: "button", "aria-label": "Đóng" } });
  closeButton.addEventListener("click", closeModal);
  header.append(heading, closeButton);
  const body = createElement("div", { className: "modal-body" });
  if (content instanceof Node) body.append(content); else body.textContent = String(content ?? "");
  panel.append(header, body);
  backdrop.append(panel);
  root.append(backdrop);
  activeModal = backdrop;
  document.body.style.overflow = "hidden";

  if (closeOnBackdrop) backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) closeModal(); });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((item) => !item.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  requestAnimationFrame(() => panel.querySelector("input, select, textarea, button")?.focus());
  return { backdrop, panel, body };
}

export function confirmDialog({ title = "Xác nhận", message, confirmLabel = "Xác nhận", danger = false, requireText = "" }) {
  return new Promise((resolve) => {
    const content = createElement("div", { className: "form-grid" });
    content.append(createElement("p", { text: message }));
    let input = null;
    if (requireText) {
      const field = createElement("div", { className: "form-field full" });
      field.append(createElement("label", { text: `Nhập “${requireText}” để tiếp tục` }));
      input = createElement("input", { attrs: { type: "text", autocomplete: "off" } });
      field.append(input);
      content.append(field);
    }
    const actions = createElement("div", { className: "form-actions full" });
    const cancel = createElement("button", { className: "button button-ghost", text: "Hủy", attrs: { type: "button" } });
    const confirm = createElement("button", { className: `button ${danger ? "button-danger" : "button-primary"}`, text: confirmLabel, attrs: { type: "button" } });
    if (requireText) confirm.disabled = true;
    input?.addEventListener("input", () => { confirm.disabled = input.value.trim() !== requireText; });
    cancel.addEventListener("click", () => { closeModal(); resolve(false); });
    confirm.addEventListener("click", () => { closeModal(); resolve(true); });
    actions.append(cancel, confirm);
    content.append(actions);
    openModal({ title, content, closeOnBackdrop: false });
  });
}
