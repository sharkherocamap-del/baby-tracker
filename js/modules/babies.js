import { getState, setSelectedBaby, subscribe } from "../app-state.js";
import { createDocument, deleteDocument, getBabySubcollection, getCollection, updateDocument } from "../firestore-service.js";
import { calculateAge, formatDate } from "../date-utils.js";
import { confirmDialog, closeModal, openModal } from "../modal.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { clearElement, createElement, renderEmptyState, safeImage, statusBadge } from "../ui.js";
import { isPositiveNumber, isValidUrl, trimText } from "../validators.js";
import { setButtonContent } from "../icons.js";

const subcollections = ["growthRecords", "vaccinations", "medicalVisits", "feedingRecords", "sleepRecords", "diaperRecords", "symptomRecords", "medications", "medicationLogs", "allergies", "milestones", "teethingRecords", "reminders"];

const fields = [
  { name: "name", label: "Họ tên", type: "text", required: true, maxLength: 160 },
  { name: "nickname", label: "Tên gọi ở nhà", type: "text", maxLength: 100 },
  { name: "gender", label: "Giới tính", type: "select", options: [{ value: "female", label: "Nữ" }, { value: "male", label: "Nam" }, { value: "other", label: "Khác / không ghi" }] },
  { name: "birthDate", label: "Ngày sinh", type: "date", required: true },
  { name: "birthTime", label: "Giờ sinh", type: "time" },
  { name: "birthWeight", label: "Cân nặng lúc sinh (kg)", type: "number", min: 0.01, step: 0.01 },
  { name: "birthHeight", label: "Chiều cao lúc sinh (cm)", type: "number", min: 0.1, step: 0.1 },
  { name: "birthHeadCircumference", label: "Vòng đầu lúc sinh (cm)", type: "number", min: 0.1, step: 0.1 },
  { name: "gestationalWeeks", label: "Tuần thai", type: "number", min: 20, max: 45, step: 1 },
  { name: "bloodType", label: "Nhóm máu", type: "text", maxLength: 10 },
  { name: "hospital", label: "Nơi sinh", type: "text", maxLength: 250 },
  { name: "avatarUrl", label: "URL ảnh đại diện", type: "url", maxLength: 1000, full: true },
  { name: "allergiesSummary", label: "Tóm tắt dị ứng", type: "textarea", maxLength: 1000, full: true },
  { name: "emergencyContact", label: "Liên hệ khẩn cấp", type: "text", maxLength: 300, full: true },
  { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1500, full: true }
];

function createBabyForm(record = null) {
  const form = createElement("form", { className: "form-grid", attrs: { novalidate: "" } });
  const controls = new Map();
  fields.forEach((field) => {
    const wrapper = createElement("div", { className: `form-field${field.full ? " full" : ""}` });
    const label = createElement("label", { text: `${field.label}${field.required ? " *" : ""}`, attrs: { for: `baby-${field.name}` } });
    let input;
    if (field.type === "textarea") input = createElement("textarea", { attrs: { id: `baby-${field.name}`, maxlength: String(field.maxLength || 1500) } });
    else if (field.type === "select") {
      input = createElement("select", { attrs: { id: `baby-${field.name}` } });
      input.append(createElement("option", { text: "-- Chọn --", attrs: { value: "" } }));
      field.options.forEach((option) => input.append(createElement("option", { text: option.label, attrs: { value: option.value } })));
    } else {
      input = createElement("input", { attrs: { id: `baby-${field.name}`, type: field.type || "text" } });
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
      if (field.maxLength) input.maxLength = field.maxLength;
    }
    input.value = record?.[field.name] ?? "";
    if (field.required) input.required = true;
    const error = createElement("div", { className: "form-error" });
    wrapper.append(label, input, error);
    controls.set(field.name, { input, error, field });
    form.append(wrapper);
  });
  const actions = createElement("div", { className: "form-actions full" });
  const cancel = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(cancel, "close", "Hủy");
  const submit = createElement("button", { className: "button button-primary", attrs: { type: "submit" } });
  setButtonContent(submit, record ? "save" : "person_add", record ? "Lưu thay đổi" : "Tạo hồ sơ");
  cancel.addEventListener("click", closeModal);
  actions.append(cancel, submit); form.append(actions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    let hasError = false;
    const payload = {};
    controls.forEach(({ input, error, field }, name) => {
      error.textContent = "";
      const raw = input.value.trim();
      if (field.required && !raw) { error.textContent = "Trường này là bắt buộc."; hasError = true; }
      if (field.type === "date" && raw && new Date(`${raw}T00:00:00`) > new Date()) { error.textContent = "Ngày sinh không được ở tương lai."; hasError = true; }
      if (field.type === "number" && raw && !isPositiveNumber(raw)) { error.textContent = "Giá trị phải lớn hơn 0."; hasError = true; }
      if (field.type === "url" && raw && !isValidUrl(raw)) { error.textContent = "URL không hợp lệ."; hasError = true; }
      payload[name] = field.type === "number" ? (raw ? Number(raw) : null) : trimText(raw, field.maxLength || 1500);
    });
    if (hasError) return;
    submit.disabled = true; cancel.disabled = true;
    try {
      if (record) await updateDocument("babies", record.id, payload);
      else {
        const created = await createDocument("babies", payload);
        setSelectedBaby(created.id);
      }
      showToast(record ? "Đã cập nhật hồ sơ em bé." : "Đã tạo hồ sơ em bé.", "success");
      closeModal();
    } catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể lưu hồ sơ."), "error"); }
    finally { submit.disabled = false; cancel.disabled = false; }
  });
  return form;
}

async function removeBaby(baby) {
  const found = [];
  try {
    for (const name of subcollections) {
      const records = await getCollection(getBabySubcollection(baby.id, name), { limit: 1 });
      if (records.length) found.push(name);
    }
  } catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể kiểm tra dữ liệu con."), "error"); return; }
  if (found.length) {
    showToast(`Không thể xóa. Hãy xóa dữ liệu trong: ${found.join(", ")}.`, "warning", 9000);
    return;
  }
  const first = await confirmDialog({ title: "Xóa hồ sơ em bé?", message: "Firestore không tự xóa subcollection khi xóa document cha. Kiểm tra hiện tại cho thấy các nhóm dữ liệu con đang trống.", confirmLabel: "Tiếp tục", danger: true });
  if (!first) return;
  const second = await confirmDialog({ title: "Xác nhận lần cuối", message: `Bạn sắp xóa hồ sơ “${baby.name}”. Thao tác này không thể hoàn tác.`, confirmLabel: "Xóa hồ sơ", danger: true, requireText: "XÓA" });
  if (!second) return;
  try { await deleteDocument("babies", baby.id); showToast("Đã xóa hồ sơ em bé.", "success"); }
  catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể xóa hồ sơ."), "error"); }
}

function renderCards(container) {
  const state = getState();
  clearElement(container);
  const header = createElement("div", { className: "view-header" });
  const intro = createElement("div"); intro.append(createElement("h2", { text: "Hồ sơ em bé" }), createElement("p", { className: "muted", text: "Quản lý một hoặc nhiều em bé trong workspace gia đình." }));
  const add = createElement("button", { className: "button button-primary", attrs: { type: "button" } });
  setButtonContent(add, "person_add", "Thêm em bé");
  add.addEventListener("click", () => openModal({ title: "Thêm hồ sơ em bé", content: createBabyForm() }));
  header.append(intro, add); container.append(header);
  const list = createElement("div", { className: "grid dashboard-grid" }); container.append(list);
  if (!state.babies.length) { renderEmptyState(list, { icon: "child_care", title: "Chưa có hồ sơ em bé", message: "Tạo hồ sơ đầu tiên để bắt đầu theo dõi.", actionLabel: "Thêm em bé", onAction: () => openModal({ title: "Thêm hồ sơ em bé", content: createBabyForm() }) }); return; }
  state.babies.forEach((baby) => {
    const card = createElement("article", { className: "card record-card" });
    const top = createElement("div", { className: "flex items-center gap-1" });
    const img = createElement("img", { attrs: { alt: `Ảnh ${baby.name}`, width: "72", height: "72" } });
    img.style.borderRadius = "18px"; img.style.objectFit = "cover"; safeImage(img, baby.avatarUrl);
    const identity = createElement("div"); identity.append(createElement("h3", { text: baby.name }), createElement("p", { className: "muted small", text: baby.nickname ? `${baby.nickname} · ${calculateAge(baby.birthDate)}` : calculateAge(baby.birthDate) }));
    if (baby.id === state.selectedBabyId) identity.append(statusBadge("Đang theo dõi", "success"));
    top.append(img, identity); card.append(top);
    const details = createElement("div", { className: "record-fields" });
    [["Ngày sinh", baby.birthDate ? formatDate(baby.birthDate) : "—"], ["Nhóm máu", baby.bloodType || "—"], ["Nơi sinh", baby.hospital || "—"], ["Dị ứng", baby.allergiesSummary || "Chưa ghi nhận"]].forEach(([label, value]) => {
      const item = createElement("div", { className: "record-field" }); item.append(createElement("span", { text: label }), createElement("span", { text: String(value) })); details.append(item);
    });
    card.append(details);
    const actions = createElement("div", { className: "record-actions" });
    const select = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
    setButtonContent(select, "check_circle", "Chọn");
    const edit = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
    setButtonContent(edit, "edit", "Sửa");
    const remove = createElement("button", { className: "button button-ghost text-danger", attrs: { type: "button" } });
    setButtonContent(remove, "delete", "Xóa");
    select.disabled = baby.id === state.selectedBabyId;
    select.addEventListener("click", () => { setSelectedBaby(baby.id); const selector = document.getElementById("baby-selector"); if (selector) selector.value = baby.id; showToast(`Đã chọn ${baby.nickname || baby.name}.`, "success"); });
    edit.addEventListener("click", () => openModal({ title: "Sửa hồ sơ em bé", content: createBabyForm(baby) }));
    remove.addEventListener("click", () => removeBaby(baby));
    actions.append(select, edit, remove); card.append(actions); list.append(card);
  });
}

export function render(container) {
  renderCards(container);
  const unsubscribe = subscribe(() => renderCards(container));
  return unsubscribe;
}
