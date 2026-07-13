import { getState } from "../app-state.js";
import { createDocument, deleteDocument, documentExists, serverTimestamp, subscribeToCollection, updateDocument } from "../firestore-service.js";
import { formatDateTime } from "../date-utils.js";
import { confirmDialog, closeModal, openModal } from "../modal.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { clearElement, createElement, renderEmptyState, renderErrorState, renderLoading, statusBadge } from "../ui.js";
import { isValidEmail, normalizeEmail, trimText, validateRole } from "../validators.js";

function userForm(record = null) {
  const state = getState();
  const selfEmail = normalizeEmail(state.currentUser.email);
  const isSelf = record?.id === selfEmail;
  const form = createElement("form", { className: "form-grid", attrs: { novalidate: "" } });
  const emailField = createElement("div", { className: "form-field full" });
  const emailLabel = createElement("label", { text: "Email *", attrs: { for: "allowed-email" } });
  const email = createElement("input", { attrs: { id: "allowed-email", type: "email", autocomplete: "off" } });
  email.value = record?.id || ""; email.disabled = Boolean(record);
  const emailError = createElement("div", { className: "form-error" });
  emailField.append(emailLabel, email, emailError);

  const nameField = createElement("div", { className: "form-field" });
  const nameLabel = createElement("label", { text: "Tên hiển thị *", attrs: { for: "allowed-name" } });
  const name = createElement("input", { attrs: { id: "allowed-name", type: "text", maxlength: "160" } });
  name.value = record?.displayName || "";
  const nameError = createElement("div", { className: "form-error" }); nameField.append(nameLabel, name, nameError);

  const roleField = createElement("div", { className: "form-field" });
  const roleLabel = createElement("label", { text: "Vai trò *", attrs: { for: "allowed-role" } });
  const role = createElement("select", { attrs: { id: "allowed-role" } });
  [["member","Member"],["admin","Admin"]].forEach(([value,label]) => role.append(createElement("option", { text: label, attrs: { value } })));
  role.value = record?.role || "member"; role.disabled = isSelf;
  const roleError = createElement("div", { className: "form-error" }); roleField.append(roleLabel, role, roleError);

  const activeField = createElement("div", { className: "form-field checkbox-field full" });
  const active = createElement("input", { attrs: { id: "allowed-active", type: "checkbox" } }); active.checked = record ? record.active === true : true; active.disabled = isSelf;
  const activeLabel = createElement("label", { text: "Tài khoản đang hoạt động", attrs: { for: "allowed-active" } });
  activeField.append(active, activeLabel);
  if (isSelf) activeField.append(createElement("div", { className: "form-help", text: "Bạn không thể tự khóa hoặc tự hạ vai trò của mình." }));

  form.append(emailField, nameField, roleField, activeField);
  const actions = createElement("div", { className: "form-actions full" });
  const cancel = createElement("button", { className: "button button-ghost", text: "Hủy", attrs: { type: "button" } });
  const submit = createElement("button", { className: "button button-primary", text: record ? "Lưu" : "Thêm người dùng", attrs: { type: "submit" } });
  cancel.addEventListener("click", closeModal); actions.append(cancel, submit); form.append(actions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const normalized = normalizeEmail(email.value);
    emailError.textContent = isValidEmail(normalized) ? "" : "Email không hợp lệ.";
    nameError.textContent = name.value.trim() ? "" : "Tên hiển thị là bắt buộc.";
    roleError.textContent = validateRole(role.value) ? "" : "Vai trò không hợp lệ.";
    if (emailError.textContent || nameError.textContent || roleError.textContent) return;
    submit.disabled = true; cancel.disabled = true;
    try {
      if (!record) {
        if (await documentExists("allowedUsers", normalized)) { emailError.textContent = "Email này đã tồn tại."; return; }
        await createDocument("allowedUsers", {
          email: normalized, displayName: trimText(name.value, 160), role: role.value, active: active.checked,
          createdByEmail: selfEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        }, { id: normalized, withMetadata: false });
      } else {
        const payload = { displayName: trimText(name.value, 160), updatedAt: serverTimestamp() };
        if (!isSelf) { payload.role = role.value; payload.active = active.checked; }
        await updateDocument("allowedUsers", record.id, payload, { withMetadata: false });
      }
      showToast(record ? "Đã cập nhật người dùng." : "Đã thêm người dùng.", "success"); closeModal();
    } catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể lưu người dùng."), "error"); }
    finally { submit.disabled = false; cancel.disabled = false; }
  });
  return form;
}

export function render(container) {
  clearElement(container);
  if (getState().currentRole !== "admin") {
    renderErrorState(container, "Chỉ admin được quản lý allowedUsers.");
    return () => {};
  }
  const header = createElement("div", { className: "view-header" });
  const intro = createElement("div"); intro.append(createElement("h2", { text: "Người dùng được phép" }), createElement("p", { className: "muted", text: "Document ID phải là email viết thường. Không có public signup." }));
  const add = createElement("button", { className: "button button-primary", text: "+ Thêm người dùng", attrs: { type: "button" } });
  add.addEventListener("click", () => openModal({ title: "Thêm người dùng", content: userForm() }));
  header.append(intro, add); container.append(header);
  container.append(createElement("p", { className: "medical-note mb-2", text: "Admin đầu tiên phải được tạo thủ công trong Firebase Console. Frontend chỉ hỗ trợ quản lý sau khi admin đó đăng nhập thành công." }));
  const filter = createElement("div", { className: "filter-bar" });
  const search = createElement("input", { attrs: { type: "search", placeholder: "Tìm email hoặc tên...", "aria-label": "Tìm người dùng" } }); filter.append(search); container.append(filter);
  const list = createElement("div", { className: "record-list" }); container.append(list); renderLoading(list);
  let records = [];
  const selfEmail = normalizeEmail(getState().currentUser.email);

  const draw = () => {
    const term = search.value.trim().toLowerCase();
    const filtered = records.filter((item) => `${item.email} ${item.displayName}`.toLowerCase().includes(term));
    clearElement(list);
    if (!filtered.length) { renderEmptyState(list, { icon: "👥", title: "Không có người dùng phù hợp", message: "Thêm người dùng mới hoặc thay đổi từ khóa." }); return; }
    filtered.forEach((item) => {
      const card = createElement("article", { className: "card record-card" });
      const top = createElement("div", { className: "record-card-header" });
      const title = createElement("div"); title.append(createElement("div", { className: "record-card-title", text: item.displayName || item.email }), createElement("div", { className: "muted small break-word", text: item.email }));
      const badges = createElement("div", { className: "flex gap-1 flex-wrap" });
      badges.append(statusBadge(item.role === "admin" ? "Admin" : "Member"), statusBadge(item.active ? "Đang hoạt động" : "Đã khóa", item.active ? "success" : "danger"));
      top.append(title, badges); card.append(top);
      const fields = createElement("div", { className: "record-fields" });
      [["Ngày tạo", formatDateTime(item.createdAt)], ["Người tạo", item.createdByEmail || "—"], ["Cập nhật", formatDateTime(item.updatedAt)]].forEach(([label,value]) => { const field=createElement("div",{className:"record-field"}); field.append(createElement("span",{text:label}),createElement("span",{text:value})); fields.append(field); });
      card.append(fields);
      const actions = createElement("div", { className: "record-actions" });
      const edit = createElement("button", { className: "button button-secondary", text: "Sửa", attrs: { type: "button" } });
      const remove = createElement("button", { className: "button button-ghost text-danger", text: "Xóa", attrs: { type: "button" } });
      remove.disabled = item.id === selfEmail; remove.title = remove.disabled ? "Không thể tự xóa tài khoản admin đang đăng nhập" : "";
      edit.addEventListener("click", () => openModal({ title: "Sửa người dùng", content: userForm(item) }));
      remove.addEventListener("click", async () => {
        const confirmed = await confirmDialog({ title: "Xóa người dùng?", message: `${item.email} sẽ không thể đăng nhập ứng dụng.`, confirmLabel: "Xóa", danger: true });
        if (!confirmed) return;
        try { await deleteDocument("allowedUsers", item.id); showToast("Đã xóa người dùng.", "success"); }
        catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể xóa người dùng."), "error"); }
      });
      actions.append(edit, remove); card.append(actions); list.append(card);
    });
  };
  search.addEventListener("input", draw);
  const unsubscribe = subscribeToCollection("allowedUsers", { orderByField: "email", orderDirection: "asc", limit: 200 }, (items) => { records = items; draw(); }, (error) => renderErrorState(list, friendlyErrorMessage(error, "Không thể tải danh sách người dùng.")));
  return unsubscribe;
}
