import {
  Timestamp,
  createBabyRecord,
  deleteBabyRecord,
  getBabySubcollection,
  getCollectionPage,
  hardDeleteBabyRecord,
  newDocumentId,
  restoreBabyRecord,
  updateBabyRecord
} from "../firestore-service.js";
import { getState } from "../app-state.js";
import { confirmDialog, closeModal, openModal } from "../modal.js";
import { exportCsv, isWithinRange } from "../export-utils.js";
import { formatDate, formatDateTime, parseLocalInput, toDateInput, toDateTimeLocalInput } from "../date-utils.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { clearElement, createElement, renderEmptyState, renderErrorState, renderLoading, statusBadge } from "../ui.js";
import { trimText, validateFormFields } from "../validators.js";
import { createIcon, setButtonContent } from "../icons.js";
import { deleteStoredImage, uploadBabyImage, validateImageFile } from "../storage-service.js";

function canWrite() {
  return getState().currentRole !== "viewer";
}

function isAdmin() {
  return getState().currentRole === "admin";
}

function displayValue(field, value, record) {
  if (typeof field.display === "function") return field.display(value, record);
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "date") return formatDate(value);
  if (field.type === "datetime-local") return formatDateTime(value);
  if (field.type === "checkbox") return value ? "Có" : "Không";
  if (field.type === "select" && field.options) return field.options.find((item) => item.value === value)?.label || value;
  if (field.type === "array") return Array.isArray(value) ? value.join(", ") : String(value);
  if (field.type === "image") return "Đã đính kèm ảnh";
  if (field.suffix) return `${value} ${field.suffix}`;
  return String(value);
}

function fieldToInputValue(field, value) {
  if (value === null || value === undefined) return "";
  if (field.type === "date") return toDateInput(value);
  if (field.type === "datetime-local") return toDateTimeLocalInput(value);
  if (field.type === "array") return Array.isArray(value) ? value.join(", ") : String(value);
  return value;
}

function inputToFieldValue(field, input) {
  if (field.type === "checkbox") return input.checked;
  if (field.type === "image") return null;
  const raw = input.value;
  if (field.type === "number") return raw === "" ? null : Number(raw);
  if (field.type === "select" && raw === "") return null;
  if (field.type === "date" || field.type === "datetime-local") {
    if (!raw) return null;
    const date = parseLocalInput(raw);
    return date ? Timestamp.fromDate(date) : null;
  }
  if (field.type === "array") return raw.split(",").map((item) => trimText(item, 100)).filter(Boolean).slice(0, 30);
  return trimText(raw, field.maxLength || 2000);
}

function createFormField(field, currentValue) {
  const wrapper = createElement("div", { className: `form-field${field.full ? " full" : ""}` });
  if (field.type === "checkbox") wrapper.classList.add("checkbox-field");
  const label = createElement("label", { text: `${field.label}${field.required ? " *" : ""}`, attrs: { for: `field-${field.name}` } });
  let input;
  let preview = null;
  if (field.type === "textarea" || field.type === "array") {
    input = createElement("textarea", { attrs: { id: `field-${field.name}`, name: field.name, maxlength: String(field.maxLength || 2000), placeholder: field.placeholder || "" } });
  } else if (field.type === "select") {
    input = createElement("select", { attrs: { id: `field-${field.name}`, name: field.name } });
    if (!field.required) input.append(createElement("option", { text: "-- Chọn --", attrs: { value: "" } }));
    (field.options || []).forEach((option) => input.append(createElement("option", { text: option.label, attrs: { value: option.value } })));
  } else if (field.type === "checkbox") {
    input = createElement("input", { attrs: { id: `field-${field.name}`, name: field.name, type: "checkbox" } });
  } else if (field.type === "image") {
    input = createElement("input", { attrs: { id: `field-${field.name}`, name: field.name, type: "file", accept: "image/jpeg,image/png,image/webp,image/gif" } });
    preview = createElement("img", { className: "image-upload-preview", attrs: { alt: `Xem trước ${field.label}` } });
    if (currentValue) preview.src = currentValue;
    else preview.classList.add("hidden");
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      const error = validateImageFile(file);
      if (error) return;
      preview.src = URL.createObjectURL(file);
      preview.classList.remove("hidden");
    });
  } else {
    const type = field.type === "url" || field.type === "email" ? field.type : field.type || "text";
    input = createElement("input", { attrs: { id: `field-${field.name}`, name: field.name, type, placeholder: field.placeholder || "" } });
    if (field.step !== undefined) input.step = String(field.step);
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.maxLength) input.maxLength = field.maxLength;
  }
  if (field.type === "checkbox") input.checked = Boolean(currentValue ?? field.defaultValue);
  else if (field.type !== "image") input.value = fieldToInputValue(field, currentValue ?? field.defaultValue ?? "");
  if (field.required) input.required = true;
  if (field.disabled) input.disabled = true;
  const error = createElement("div", { className: "form-error", attrs: { id: `error-${field.name}` } });
  if (field.type === "checkbox") wrapper.append(input, label, error);
  else wrapper.append(label, input);
  if (preview) wrapper.append(preview);
  if (field.help) wrapper.append(createElement("div", { className: "form-help", text: field.help }));
  if (field.type !== "checkbox") wrapper.append(error);
  return { wrapper, input, error, preview };
}

function makeForm(config, record, onSaved) {
  const form = createElement("form", { className: "form-grid", attrs: { novalidate: "" } });
  const controls = new Map();
  config.fields.forEach((field) => {
    const control = createFormField(field, record?.[field.name]);
    controls.set(field.name, control);
    form.append(control.wrapper);
  });
  const progress = createElement("div", { className: "form-help full hidden", attrs: { role: "status" } });
  form.append(progress);
  const actions = createElement("div", { className: "form-actions full" });
  const cancel = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(cancel, "close", "Hủy");
  const submit = createElement("button", { className: "button button-primary", attrs: { type: "submit" } });
  setButtonContent(submit, record ? "save" : "add", record ? "Lưu thay đổi" : "Thêm bản ghi");
  cancel.addEventListener("click", closeModal);
  actions.append(cancel, submit);
  form.append(actions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rawValues = {};
    config.fields.forEach((field) => {
      const input = controls.get(field.name).input;
      rawValues[field.name] = field.type === "checkbox" ? input.checked : field.type === "image" ? (input.files?.[0] || record?.[field.name] || "") : input.value;
    });
    const validationFields = config.fields.filter((field) => field.type !== "image");
    const errors = validateFormFields(validationFields, rawValues);
    config.fields.filter((field) => field.type === "image").forEach((field) => {
      const file = controls.get(field.name).input.files?.[0];
      const imageError = file ? validateImageFile(file) : "";
      if (imageError) errors[field.name] = imageError;
      if (field.required && !file && !record?.[field.name]) errors[field.name] = "Trường này là bắt buộc.";
    });
    controls.forEach(({ error }, name) => { error.textContent = errors[name] || ""; });
    if (Object.keys(errors).length) {
      controls.get(Object.keys(errors)[0])?.input.focus();
      return;
    }
    const payload = {};
    config.fields.forEach((field) => {
      if (field.type !== "image") payload[field.name] = inputToFieldValue(field, controls.get(field.name).input);
    });
    if (typeof config.beforeSave === "function") {
      const adjusted = await config.beforeSave(payload, record);
      if (adjusted === false) return;
      if (adjusted && typeof adjusted === "object") Object.assign(payload, adjusted);
    }
    const { selectedBabyId } = getState();
    const path = getBabySubcollection(selectedBabyId, config.collection);
    const recordId = record?.id || newDocumentId(path);
    submit.disabled = true;
    cancel.disabled = true;
    const uploadedPaths = [];
    const replacedPaths = [];
    try {
      for (const field of config.fields.filter((item) => item.type === "image")) {
        const file = controls.get(field.name).input.files?.[0];
        if (!file) continue;
        progress.classList.remove("hidden");
        const uploaded = await uploadBabyImage({
          babyId: selectedBabyId,
          file,
          folder: `${config.collection}/${recordId}`,
          onProgress: (percent) => { progress.textContent = `Đang tải ảnh: ${percent}%`; }
        });
        payload[field.name] = uploaded.url;
        if (field.storagePathField) {
          payload[field.storagePathField] = uploaded.storagePath;
          uploadedPaths.push(uploaded.storagePath);
          if (record?.[field.storagePathField] && record[field.storagePathField] !== uploaded.storagePath) replacedPaths.push(record[field.storagePathField]);
        }
      }
      if (record) await updateBabyRecord(selectedBabyId, config.collection, record.id, payload);
      else await createBabyRecord(selectedBabyId, config.collection, payload, { id: recordId });
      for (const oldPath of replacedPaths) {
        try { await deleteStoredImage(oldPath); } catch (cleanupError) { console.error("Không thể xóa ảnh cũ", cleanupError); }
      }
      showToast(record ? "Đã cập nhật bản ghi." : "Đã thêm bản ghi.", "success");
      closeModal();
      onSaved?.();
    } catch (error) {
      console.error(error);
      for (const path of uploadedPaths) {
        try { await deleteStoredImage(path); } catch (cleanupError) { console.error("Không thể dọn ảnh upload thất bại", cleanupError); }
      }
      showToast(friendlyErrorMessage(error, "Không thể lưu bản ghi."), "error");
    } finally {
      submit.disabled = false;
      cancel.disabled = false;
    }
  });
  return form;
}

function openRecordForm(config, record = null, onSaved = null) {
  const form = makeForm(config, record, onSaved);
  openModal({ title: record ? `Sửa ${config.singular.toLowerCase()}` : `Thêm ${config.singular.toLowerCase()}`, content: form });
}

function renderRecordCard(config, record, handlers, trashMode) {
  const card = createElement("article", { className: `card record-card${trashMode ? " record-card-deleted" : ""}` });
  const header = createElement("div", { className: "record-card-header" });
  const titleWrapper = createElement("div");
  const title = createElement("div", { className: "record-card-title" });
  if (config.icon) title.append(createIcon(config.icon, { size: 19 }));
  title.append(document.createTextNode(typeof config.recordTitle === "function" ? config.recordTitle(record) : record[config.recordTitle] || config.singular));
  titleWrapper.append(title);
  if (config.recordSubtitle) titleWrapper.append(createElement("div", { className: "muted small", text: config.recordSubtitle(record) }));
  if (trashMode && record.deletedAt) titleWrapper.append(createElement("div", { className: "muted small", text: `Đã xóa: ${formatDateTime(record.deletedAt)}` }));
  header.append(titleWrapper);
  if (config.statusField && record[config.statusField] !== undefined && record[config.statusField] !== null) {
    const status = config.statusMap?.[record[config.statusField]] || { label: record[config.statusField], tone: "default" };
    header.append(statusBadge(status.label, status.tone));
  }
  card.append(header);

  const imageField = config.fields.find((field) => field.type === "image" && record[field.name]);
  if (imageField) card.append(createElement("img", { className: "record-image", attrs: { src: record[imageField.name], alt: imageField.label, loading: "lazy" } }));

  const fields = createElement("div", { className: "record-fields" });
  config.fields.filter((field) => field.showInCard !== false && !field.hideInCard && field.type !== "image").forEach((field) => {
    if (field.name === config.recordTitle) return;
    const value = record[field.name];
    if ((value === null || value === undefined || value === "") && field.hideWhenEmpty) return;
    const item = createElement("div", { className: "record-field" });
    item.append(createElement("span", { text: field.label }), createElement("span", { text: displayValue(field, value, record) }));
    fields.append(item);
  });
  card.append(fields);

  const actions = createElement("div", { className: "record-actions" });
  if (trashMode) {
    const restore = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
    setButtonContent(restore, "restore_from_trash", "Khôi phục");
    restore.disabled = !canWrite();
    restore.addEventListener("click", () => handlers.onRestore(record));
    actions.append(restore);
    if (isAdmin()) {
      const purge = createElement("button", { className: "button button-ghost text-danger", attrs: { type: "button" } });
      setButtonContent(purge, "delete_forever", "Xóa vĩnh viễn");
      purge.addEventListener("click", () => handlers.onPurge(record));
      actions.append(purge);
    }
  } else {
    const edit = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
    setButtonContent(edit, "edit", "Sửa");
    const remove = createElement("button", { className: "button button-ghost text-danger", attrs: { type: "button" } });
    setButtonContent(remove, "delete", "Đưa vào thùng rác");
    edit.disabled = !canWrite();
    remove.disabled = !canWrite();
    edit.addEventListener("click", () => openRecordForm(config, record, handlers.onRefresh));
    remove.addEventListener("click", () => handlers.onDelete(record));
    actions.append(edit, remove);
    if (typeof config.customCardActions === "function") config.customCardActions(record, actions);
  }
  card.append(actions);
  return card;
}

function recordMatches(config, record, search, startDate, endDate, extraFilter = "") {
  if (search) {
    const haystack = (config.searchFields || config.fields.map((field) => field.name))
      .flatMap((name) => Array.isArray(record[name]) ? record[name] : [record[name]])
      .filter((value) => value !== null && value !== undefined)
      .join(" ").toLowerCase();
    if (!haystack.includes(search.toLowerCase())) return false;
  }
  if ((startDate || endDate) && config.dateField && !isWithinRange(record[config.dateField], startDate, endDate)) return false;
  if (extraFilter && config.filterField && String(record[config.filterField]) !== extraFilter) return false;
  return typeof config.clientFilter === "function" ? config.clientFilter(record) : true;
}

function buildServerWhere(config, startDate, endDate, extraValue) {
  const clauses = [];
  if (config.dateField && startDate) clauses.push({ field: config.dateField, operator: ">=", value: Timestamp.fromDate(new Date(`${startDate}T00:00:00`)) });
  if (config.dateField && endDate) clauses.push({ field: config.dateField, operator: "<=", value: Timestamp.fromDate(new Date(`${endDate}T23:59:59.999`)) });
  if (config.filterField && extraValue) clauses.push({ field: config.filterField, operator: "==", value: extraValue });
  return clauses;
}

export async function renderRecordModule(container, config) {
  const { selectedBabyId, selectedBaby } = getState();
  clearElement(container);
  if (!selectedBabyId) {
    renderEmptyState(container, { icon: "child_care", title: "Chưa có hồ sơ em bé", message: "Hãy tạo hồ sơ em bé trước khi thêm dữ liệu theo dõi.", actionLabel: "Mở Hồ sơ bé", onAction: () => { window.location.hash = "#/babies"; } });
    return () => {};
  }

  const header = createElement("div", { className: "view-header" });
  const intro = createElement("div");
  intro.append(createElement("h2", { text: config.title }), createElement("p", { className: "muted", text: config.description || `Theo dõi ${config.title.toLowerCase()} của ${selectedBaby.nickname || selectedBaby.name}.` }));
  const actions = createElement("div", { className: "view-actions" });
  const trashButton = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(trashButton, "delete_sweep", "Thùng rác");
  const exportButton = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(exportButton, "download", "Xuất trang CSV");
  const addButton = createElement("button", { className: "button button-primary", attrs: { type: "button" } });
  setButtonContent(addButton, "add", `Thêm ${config.singular.toLowerCase()}`);
  addButton.disabled = !canWrite();
  actions.append(trashButton, exportButton, addButton);
  header.append(intro, actions);
  container.append(header);
  if (config.medicalNote) container.append(createElement("p", { className: "medical-note mb-2", text: config.medicalNote }));
  if (typeof config.renderTop === "function") {
    const top = createElement("div");
    config.renderTop(top, { openForm: () => openRecordForm(config) });
    container.append(top);
  }

  const filter = createElement("div", { className: "filter-bar" });
  const search = createElement("input", { attrs: { type: "search", placeholder: config.searchPlaceholder || "Tìm trong trang hiện tại...", "aria-label": "Tìm kiếm" } });
  const start = createElement("input", { attrs: { type: "date", "aria-label": "Từ ngày" } });
  const end = createElement("input", { attrs: { type: "date", "aria-label": "Đến ngày" } });
  filter.append(search, start, end);
  let extraFilter = null;
  if (config.filterField && config.filterOptions) {
    extraFilter = createElement("select", { attrs: { "aria-label": config.filterLabel || "Bộ lọc" } });
    extraFilter.append(createElement("option", { text: config.filterAllLabel || "Tất cả", attrs: { value: "" } }));
    config.filterOptions.forEach((option) => extraFilter.append(createElement("option", { text: option.label, attrs: { value: option.value } })));
    filter.append(extraFilter);
  }
  if (!config.dateField) { start.classList.add("hidden"); end.classList.add("hidden"); }
  container.append(filter, createElement("p", { className: "muted small mb-1", text: "Ngày và trạng thái được lọc trên Firestore; ô tìm kiếm lọc trong trang đang hiển thị." }));

  const list = createElement("div", { className: "record-list" });
  const pagination = createElement("div", { className: "pagination-bar" });
  const previous = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(previous, "chevron_left", "Trang trước");
  const pageLabel = createElement("span", { className: "muted small" });
  const next = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(next, "chevron_right", "Trang sau", { iconAfter: true });
  pagination.append(previous, pageLabel, next);
  container.append(list, pagination);

  let pages = [];
  let pageIndex = 0;
  let trashMode = false;
  let disposed = false;

  function currentRecords() {
    return pages[pageIndex]?.items || [];
  }

  function draw() {
    if (disposed) return;
    const records = currentRecords().filter((record) => recordMatches(config, record, search.value.trim(), start.value, end.value, extraFilter?.value || ""));
    clearElement(list);
    if (!records.length) {
      renderEmptyState(list, {
        icon: trashMode ? "delete_sweep" : config.emptyIcon || "description",
        title: trashMode ? "Thùng rác đang trống" : search.value ? "Không tìm thấy trong trang này" : `Chưa có ${config.title.toLowerCase()}`,
        message: trashMode ? "Các bản ghi đã xóa mềm sẽ xuất hiện tại đây." : "Hãy thêm bản ghi đầu tiên hoặc thay đổi bộ lọc.",
        actionLabel: !trashMode && canWrite() ? `Thêm ${config.singular.toLowerCase()}` : "",
        onAction: !trashMode && canWrite() ? () => openRecordForm(config, null, refresh) : null
      });
    } else {
      const handlers = {
        onRefresh: refresh,
        async onDelete(target) {
          const confirmed = await confirmDialog({ title: `Đưa ${config.singular.toLowerCase()} vào thùng rác?`, message: "Bản ghi sẽ được ẩn khỏi danh sách chính và có thể khôi phục sau.", confirmLabel: "Đưa vào thùng rác", danger: true });
          if (!confirmed) return;
          try { await deleteBabyRecord(selectedBabyId, config.collection, target.id); showToast("Đã chuyển bản ghi vào thùng rác.", "success"); await refresh(); }
          catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể xóa bản ghi."), "error"); }
        },
        async onRestore(target) {
          try { await restoreBabyRecord(selectedBabyId, config.collection, target.id); showToast("Đã khôi phục bản ghi.", "success"); await refresh(); }
          catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể khôi phục bản ghi."), "error"); }
        },
        async onPurge(target) {
          const confirmed = await confirmDialog({ title: "Xóa vĩnh viễn?", message: "Thao tác này không thể hoàn tác.", confirmLabel: "Xóa vĩnh viễn", danger: true, requireText: "XÓA" });
          if (!confirmed) return;
          try {
            await hardDeleteBabyRecord(selectedBabyId, config.collection, target.id);
            for (const field of config.fields.filter((item) => item.type === "image" && item.storagePathField)) {
              const storagePath = target[field.storagePathField];
              if (storagePath) { try { await deleteStoredImage(storagePath); } catch (cleanupError) { console.error("Không thể xóa file Storage", cleanupError); } }
            }
            showToast("Đã xóa vĩnh viễn bản ghi.", "success");
            await refresh();
          }
          catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể xóa vĩnh viễn."), "error"); }
        }
      };
      records.forEach((record) => list.append(renderRecordCard(config, record, handlers, trashMode)));
    }
    const page = pages[pageIndex] || {};
    pageLabel.textContent = `Trang ${pageIndex + 1} · ${currentRecords().length} bản ghi`;
    previous.disabled = pageIndex === 0;
    next.disabled = !page.hasMore && pageIndex >= pages.length - 1;
    Promise.resolve(config.afterRecordsRender?.(records, { container, list, trashMode })).catch((error) => console.error("Lỗi afterRecordsRender", error));
  }

  async function loadPage(index, cursor = null) {
    renderLoading(list);
    try {
      const orderByField = trashMode ? "deletedAt" : config.orderByField || config.dateField || "createdAt";
      const page = await getCollectionPage(getBabySubcollection(selectedBabyId, config.collection), {
        deletedMode: trashMode ? "trash" : "active",
        orderByField,
        orderDirection: trashMode ? "desc" : config.orderDirection || "desc",
        pageSize: config.pageSize || 20,
        startAfterDocument: cursor,
        where: trashMode ? [] : buildServerWhere(config, start.value, end.value, extraFilter?.value || "")
      });
      pages[index] = page;
      pages = pages.slice(0, index + 1);
      pageIndex = index;
      draw();
    } catch (error) {
      console.error(error);
      renderErrorState(list, friendlyErrorMessage(error, "Không thể tải dữ liệu."), refresh);
    }
  }

  async function refresh() {
    pages = [];
    pageIndex = 0;
    await loadPage(0, null);
  }

  search.addEventListener("input", draw);
  [start, end, extraFilter].filter(Boolean).forEach((input) => input.addEventListener("change", refresh));
  addButton.addEventListener("click", () => openRecordForm(config, null, refresh));
  trashButton.addEventListener("click", async () => {
    trashMode = !trashMode;
    setButtonContent(trashButton, trashMode ? "arrow_back" : "delete_sweep", trashMode ? "Quay lại dữ liệu" : "Thùng rác");
    addButton.classList.toggle("hidden", trashMode);
    exportButton.classList.toggle("hidden", trashMode);
    await refresh();
  });
  exportButton.addEventListener("click", () => {
    const records = currentRecords().filter((record) => recordMatches(config, record, search.value.trim(), start.value, end.value, extraFilter?.value || ""));
    exportCsv(records, config.csvColumns || config.fields.filter((field) => field.type !== "image").map((field) => ({ key: field.name, label: field.label })), `baby-tracker-${config.collection}`);
  });
  previous.addEventListener("click", () => { if (pageIndex > 0) { pageIndex -= 1; draw(); } });
  next.addEventListener("click", async () => {
    if (pageIndex + 1 < pages.length) { pageIndex += 1; draw(); return; }
    const current = pages[pageIndex];
    if (current?.hasMore && current.lastDocument) await loadPage(pageIndex + 1, current.lastDocument);
  });

  await refresh();
  return () => {
    disposed = true;
    config.cleanup?.();
  };
}
