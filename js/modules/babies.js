import { getState, setSelectedBaby } from "../app-state.js";
import {
  createDocument,
  getBabiesPath,
  getBabySubcollection,
  getCollectionPage,
  getAllPagesResult,
  deleteDocument,
  newDocumentId,
  restoreDocument,
  runWriteBatch,
  softDeleteDocument,
  updateDocument
} from "../firestore-service.js";
import { calculateAge, formatDate, formatDateTime } from "../date-utils.js";
import { confirmDialog, closeModal, openModal } from "../modal.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { clearElement, createElement, renderEmptyState, renderLoading, safeImage, statusBadge } from "../ui.js";
import { isPositiveNumber, isValidUrl, trimText } from "../validators.js";
import { setButtonContent } from "../icons.js";
import { deleteStoredImage, uploadBabyImage, validateImageFile } from "../storage-service.js";

const subcollections = ["growthRecords", "vaccinations", "medicalVisits", "feedingRecords", "sleepRecords", "diaperRecords", "symptomRecords", "medications", "medicationLogs", "allergies", "milestones", "teethingRecords", "reminders"];

const fields = [
  { name: "name", label: "Họ tên", type: "text", required: true, maxLength: 160 },
  { name: "nickname", label: "Tên gọi ở nhà", type: "text", maxLength: 100 },
  { name: "gender", label: "Giới tính", type: "select", options: [{ value: "female", label: "Nữ" }, { value: "male", label: "Nam" }, { value: "other", label: "Khác / không ghi" }] },
  { name: "birthDate", label: "Ngày sinh", type: "date", required: true },
  { name: "birthTime", label: "Giờ sinh", type: "time" },
  { name: "birthWeight", label: "Cân nặng lúc sinh (kg)", type: "number", min: 0.01, step: 0.01 },
  { name: "birthHeight", label: "Chiều dài/chiều cao lúc sinh (cm)", type: "number", min: 0.1, step: 0.1 },
  { name: "birthHeadCircumference", label: "Vòng đầu lúc sinh (cm)", type: "number", min: 0.1, step: 0.1 },
  { name: "gestationalWeeks", label: "Tuần thai", type: "number", min: 20, max: 45, step: 1 },
  { name: "bloodType", label: "Nhóm máu", type: "text", maxLength: 10 },
  { name: "hospital", label: "Nơi sinh", type: "text", maxLength: 250 },
  { name: "avatarUrl", label: "URL ảnh đại diện (tùy chọn)", type: "url", maxLength: 1000, full: true },
  { name: "allergiesSummary", label: "Tóm tắt dị ứng", type: "textarea", maxLength: 1000, full: true },
  { name: "emergencyContact", label: "Liên hệ khẩn cấp", type: "text", maxLength: 300, full: true },
  { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1500, full: true }
];

function canWrite() { return getState().currentRole !== "viewer"; }
function isAdmin() { return getState().currentRole === "admin"; }

function createBabyForm(record = null, onSaved = null) {
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

  const imageWrapper = createElement("div", { className: "form-field full" });
  const imageLabel = createElement("label", { text: "Tải ảnh đại diện lên Firebase Storage", attrs: { for: "baby-avatar-file" } });
  const imageInput = createElement("input", { attrs: { id: "baby-avatar-file", type: "file", accept: "image/jpeg,image/png,image/webp,image/gif" } });
  const imageError = createElement("div", { className: "form-error" });
  const preview = createElement("img", { className: "image-upload-preview", attrs: { alt: "Xem trước ảnh đại diện" } });
  if (record?.avatarUrl) preview.src = record.avatarUrl; else preview.classList.add("hidden");
  imageInput.addEventListener("change", () => {
    imageError.textContent = "";
    const file = imageInput.files?.[0];
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { imageError.textContent = error; return; }
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
  });
  imageWrapper.append(imageLabel, imageInput, preview, imageError, createElement("div", { className: "form-help", text: "JPG, PNG, WebP hoặc GIF, tối đa 5 MB. Ảnh upload sẽ ưu tiên hơn URL." }));
  form.append(imageWrapper);

  const progress = createElement("div", { className: "form-help full hidden", attrs: { role: "status" } });
  form.append(progress);
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
    const file = imageInput.files?.[0];
    const fileError = file ? validateImageFile(file) : "";
    if (fileError) { imageError.textContent = fileError; hasError = true; }
    if (hasError) return;
    submit.disabled = true; cancel.disabled = true;
    const babiesPath = getBabiesPath();
    const babyId = record?.id || newDocumentId(babiesPath);
    let uploadedPath = null;
    try {
      if (file) {
        progress.classList.remove("hidden");
        const uploaded = await uploadBabyImage({ babyId, file, folder: "avatar", onProgress: (percent) => { progress.textContent = `Đang tải ảnh: ${percent}%`; } });
        payload.avatarUrl = uploaded.url;
        payload.avatarStoragePath = uploaded.storagePath;
        uploadedPath = uploaded.storagePath;
      } else if (record?.avatarStoragePath) payload.avatarStoragePath = record.avatarStoragePath;
      if (record) await updateDocument(babiesPath, record.id, payload);
      else {
        const created = await createDocument(babiesPath, payload, { id: babyId });
        setSelectedBaby(created.id);
      }
      if (record?.avatarStoragePath && uploadedPath && record.avatarStoragePath !== uploadedPath) {
        try { await deleteStoredImage(record.avatarStoragePath); } catch (cleanupError) { console.error("Không thể xóa ảnh đại diện cũ", cleanupError); }
      }
      showToast(record ? "Đã cập nhật hồ sơ em bé." : "Đã tạo hồ sơ em bé.", "success");
      closeModal();
      onSaved?.();
    } catch (error) {
      console.error(error);
      if (uploadedPath) { try { await deleteStoredImage(uploadedPath); } catch (cleanupError) { console.error("Không thể dọn ảnh upload thất bại", cleanupError); } }
      showToast(friendlyErrorMessage(error, "Không thể lưu hồ sơ."), "error");
    }
    finally { submit.disabled = false; cancel.disabled = false; }
  });
  return form;
}

async function purgeBaby(baby) {
  const confirmed = await confirmDialog({ title: "Xóa vĩnh viễn toàn bộ hồ sơ?", message: "Tất cả dữ liệu con và ảnh đại diện sẽ bị xóa. Thao tác này không thể hoàn tác.", confirmLabel: "Xóa vĩnh viễn", danger: true, requireText: "XÓA" });
  if (!confirmed) return;
  try {
    const operations = [];
    const storagePaths = new Set(baby.avatarStoragePath ? [baby.avatarStoragePath] : []);
    for (const name of subcollections) {
      const pageResult = await getAllPagesResult(getBabySubcollection(baby.id, name), { deletedMode: undefined, orderByField: "createdAt", orderDirection: "asc", maxRecords: 10000 });
      if (pageResult.truncated) throw new Error(`Subcollection ${name} có hơn 10.000 bản ghi. Hãy xóa theo từng nhóm trước khi purge hồ sơ.`);
      pageResult.items.forEach((record) => {
        operations.push({ type: "delete", path: getBabySubcollection(baby.id, name), id: record.id });
        if (record.mediaStoragePath) storagePaths.add(record.mediaStoragePath);
      });
    }
    await runWriteBatch(operations);
    for (const storagePath of storagePaths) {
      try { await deleteStoredImage(storagePath); } catch (error) { console.error("Không thể xóa file Storage", storagePath, error); }
    }
    await deleteDocument(getBabiesPath(), baby.id);
    showToast("Đã xóa vĩnh viễn hồ sơ và dữ liệu con.", "success");
  } catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể xóa vĩnh viễn hồ sơ."), "error"); }
}

function renderCards(container) {
  clearElement(container);
  const state = getState();
  const header = createElement("div", { className: "view-header" });
  const intro = createElement("div");
  intro.append(
    createElement("h2", { text: "Hồ sơ em bé" }),
    createElement("p", { className: "muted", text: `Quản lý em bé trong workspace “${state.currentWorkspace?.name || "Gia đình"}”.` })
  );
  const actions = createElement("div", { className: "view-actions" });
  const trash = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(trash, "delete_sweep", "Thùng rác");
  const add = createElement("button", { className: "button button-primary", attrs: { type: "button" } });
  setButtonContent(add, "person_add", "Thêm em bé");
  add.disabled = !canWrite();
  actions.append(trash, add);
  header.append(intro, actions);
  container.append(header);

  const list = createElement("div", { className: "grid dashboard-grid" });
  const pagination = createElement("div", { className: "pagination-bar" });
  const previous = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(previous, "chevron_left", "Trang trước");
  const pageLabel = createElement("span", { className: "muted small" });
  const next = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(next, "chevron_right", "Trang sau");
  pagination.append(previous, pageLabel, next);
  container.append(list, pagination);

  let trashMode = false;
  let pages = [];
  let pageIndex = 0;

  function draw() {
    const page = pages[pageIndex] || { items: [], hasMore: false };
    clearElement(list);
    if (!page.items.length) {
      renderEmptyState(list, {
        icon: trashMode ? "delete_sweep" : "child_care",
        title: trashMode ? "Thùng rác hồ sơ đang trống" : "Chưa có hồ sơ em bé",
        message: trashMode ? "Hồ sơ xóa mềm sẽ xuất hiện ở đây." : "Tạo hồ sơ đầu tiên để bắt đầu theo dõi.",
        actionLabel: !trashMode && canWrite() ? "Thêm em bé" : "",
        onAction: !trashMode && canWrite() ? () => openModal({ title: "Thêm hồ sơ em bé", content: createBabyForm(null, refresh) }) : null
      });
    } else {
      page.items.forEach((baby) => {
        const currentState = getState();
        const card = createElement("article", { className: `card record-card${trashMode ? " record-card-deleted" : ""}` });
        const top = createElement("div", { className: "flex items-center gap-1" });
        const img = createElement("img", { attrs: { alt: `Ảnh ${baby.name}`, width: "72", height: "72" } });
        img.style.borderRadius = "18px";
        img.style.objectFit = "cover";
        safeImage(img, baby.avatarUrl);
        const identity = createElement("div");
        identity.append(
          createElement("h3", { text: baby.name }),
          createElement("p", { className: "muted small", text: baby.nickname ? `${baby.nickname} · ${calculateAge(baby.birthDate)}` : calculateAge(baby.birthDate) })
        );
        if (!trashMode && baby.id === currentState.selectedBabyId) identity.append(statusBadge("Đang theo dõi", "success"));
        if (trashMode && baby.deletedAt) identity.append(createElement("p", { className: "muted small", text: `Đã xóa ${formatDateTime(baby.deletedAt)}` }));
        top.append(img, identity);
        card.append(top);

        const details = createElement("div", { className: "record-fields" });
        [["Ngày sinh", baby.birthDate ? formatDate(baby.birthDate) : "—"], ["Nhóm máu", baby.bloodType || "—"], ["Nơi sinh", baby.hospital || "—"], ["Dị ứng", baby.allergiesSummary || "Chưa ghi nhận"]].forEach(([label, value]) => {
          const item = createElement("div", { className: "record-field" });
          item.append(createElement("span", { text: label }), createElement("span", { text: String(value) }));
          details.append(item);
        });
        card.append(details);

        const cardActions = createElement("div", { className: "record-actions" });
        if (trashMode) {
          const restore = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
          setButtonContent(restore, "restore_from_trash", "Khôi phục");
          restore.disabled = !canWrite();
          restore.addEventListener("click", async () => {
            try {
              await restoreDocument(getBabiesPath(), baby.id);
              showToast("Đã khôi phục hồ sơ em bé.", "success");
              await refresh();
            } catch (error) {
              console.error(error);
              showToast(friendlyErrorMessage(error), "error");
            }
          });
          cardActions.append(restore);
          if (isAdmin()) {
            const purge = createElement("button", { className: "button button-ghost text-danger", attrs: { type: "button" } });
            setButtonContent(purge, "delete_forever", "Xóa vĩnh viễn");
            purge.addEventListener("click", async () => { await purgeBaby(baby); await refresh(); });
            cardActions.append(purge);
          }
        } else {
          const select = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
          setButtonContent(select, "check_circle", "Chọn");
          select.disabled = baby.id === currentState.selectedBabyId;
          const edit = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
          setButtonContent(edit, "edit", "Sửa");
          edit.disabled = !canWrite();
          const remove = createElement("button", { className: "button button-ghost text-danger", attrs: { type: "button" } });
          setButtonContent(remove, "delete", "Đưa vào thùng rác");
          remove.disabled = !canWrite();
          select.addEventListener("click", () => {
            setSelectedBaby(baby.id);
            const selector = document.getElementById("baby-selector");
            if (selector) selector.value = baby.id;
            showToast(`Đã chọn ${baby.nickname || baby.name}.`, "success");
            draw();
          });
          edit.addEventListener("click", () => openModal({ title: "Sửa hồ sơ em bé", content: createBabyForm(baby, refresh) }));
          remove.addEventListener("click", async () => {
            const ok = await confirmDialog({
              title: "Đưa hồ sơ vào thùng rác?",
              message: "Dữ liệu con được giữ nguyên và sẽ xuất hiện lại khi khôi phục hồ sơ.",
              confirmLabel: "Đưa vào thùng rác",
              danger: true
            });
            if (!ok) return;
            try {
              await softDeleteDocument(getBabiesPath(), baby.id);
              showToast("Đã đưa hồ sơ vào thùng rác.", "success");
              await refresh();
            } catch (error) {
              console.error(error);
              showToast(friendlyErrorMessage(error), "error");
            }
          });
          cardActions.append(select, edit, remove);
        }
        card.append(cardActions);
        list.append(card);
      });
    }
    pageLabel.textContent = `Trang ${pageIndex + 1} · ${page.items.length} hồ sơ`;
    previous.disabled = pageIndex === 0;
    next.disabled = !page.hasMore && pageIndex >= pages.length - 1;
  }

  async function loadPage(index, cursor = null) {
    renderLoading(list);
    try {
      const page = await getCollectionPage(getBabiesPath(), {
        deletedMode: trashMode ? "trash" : "active",
        orderByField: trashMode ? "deletedAt" : "name",
        orderDirection: trashMode ? "desc" : "asc",
        pageSize: 12,
        startAfterDocument: cursor
      });
      pages[index] = page;
      pages = pages.slice(0, index + 1);
      pageIndex = index;
      draw();
    } catch (error) {
      console.error(error);
      clearElement(list);
      renderEmptyState(list, { icon: "error", title: "Không thể tải hồ sơ", message: friendlyErrorMessage(error) });
    }
  }

  async function refresh() {
    pages = [];
    pageIndex = 0;
    await loadPage(0);
  }

  add.addEventListener("click", () => openModal({ title: "Thêm hồ sơ em bé", content: createBabyForm(null, refresh) }));
  trash.addEventListener("click", async () => {
    trashMode = !trashMode;
    setButtonContent(trash, trashMode ? "arrow_back" : "delete_sweep", trashMode ? "Quay lại hồ sơ" : "Thùng rác");
    add.classList.toggle("hidden", trashMode);
    await refresh();
  });
  previous.addEventListener("click", () => { if (pageIndex > 0) { pageIndex -= 1; draw(); } });
  next.addEventListener("click", async () => {
    if (pageIndex + 1 < pages.length) { pageIndex += 1; draw(); return; }
    const page = pages[pageIndex];
    if (page?.hasMore && page.lastDocument) await loadPage(pageIndex + 1, page.lastDocument);
  });
  refresh();
}

export function render(container) {
  renderCards(container);
  return () => {};
}
