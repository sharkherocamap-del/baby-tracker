import { Timestamp } from "../firestore-service.js";
import { createBabyRecord, deleteBabyRecord, getBabySubcollection, subscribeToCollection, updateBabyRecord } from "../firestore-service.js";
import { getState } from "../app-state.js";
import { confirmDialog, closeModal, openModal } from "../modal.js";
import { exportCsv, isWithinRange } from "../export-utils.js";
import { formatDate, formatDateTime, parseLocalInput, toDate, toDateInput, toDateTimeLocalInput } from "../date-utils.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { clearElement, createElement, renderEmptyState, renderErrorState, renderLoading, statusBadge } from "../ui.js";
import { trimText, validateFormFields } from "../validators.js";
import { createIcon, setButtonContent } from "../icons.js";

function displayValue(field, value, record) {
  if (typeof field.display === "function") return field.display(value, record);
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "date") return formatDate(value);
  if (field.type === "datetime-local") return formatDateTime(value);
  if (field.type === "checkbox") return value ? "Có" : "Không";
  if (field.type === "select" && field.options) return field.options.find((item) => item.value === value)?.label || value;
  if (field.type === "array") return Array.isArray(value) ? value.join(", ") : String(value);
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
  if (field.type === "textarea" || field.type === "array") {
    input = createElement("textarea", { attrs: { id: `field-${field.name}`, name: field.name, maxlength: String(field.maxLength || 2000), placeholder: field.placeholder || "" } });
  } else if (field.type === "select") {
    input = createElement("select", { attrs: { id: `field-${field.name}`, name: field.name } });
    if (!field.required) input.append(createElement("option", { text: "-- Chọn --", attrs: { value: "" } }));
    (field.options || []).forEach((option) => input.append(createElement("option", { text: option.label, attrs: { value: option.value } })));
  } else if (field.type === "checkbox") {
    input = createElement("input", { attrs: { id: `field-${field.name}`, name: field.name, type: "checkbox" } });
  } else {
    const type = field.type === "url" || field.type === "email" ? field.type : field.type || "text";
    input = createElement("input", { attrs: { id: `field-${field.name}`, name: field.name, type, placeholder: field.placeholder || "" } });
    if (field.step !== undefined) input.step = String(field.step);
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.maxLength) input.maxLength = field.maxLength;
  }
  if (field.type === "checkbox") input.checked = Boolean(currentValue ?? field.defaultValue);
  else input.value = fieldToInputValue(field, currentValue ?? field.defaultValue ?? "");
  if (field.required) input.required = true;
  if (field.disabled) input.disabled = true;
  const error = createElement("div", { className: "form-error", attrs: { id: `error-${field.name}` } });
  if (field.type === "checkbox") wrapper.append(input, label, error);
  else wrapper.append(label, input);
  if (field.help) wrapper.append(createElement("div", { className: "form-help", text: field.help }));
  if (field.type !== "checkbox") wrapper.append(error);
  return { wrapper, input, error };
}

function makeForm(config, record, onSaved) {
  const form = createElement("form", { className: "form-grid", attrs: { novalidate: "" } });
  const controls = new Map();
  config.fields.forEach((field) => {
    const control = createFormField(field, record?.[field.name]);
    controls.set(field.name, control);
    form.append(control.wrapper);
  });
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
      rawValues[field.name] = field.type === "checkbox" ? input.checked : input.value;
    });
    const errors = validateFormFields(config.fields, rawValues);
    controls.forEach(({ error }, name) => { error.textContent = errors[name] || ""; });
    if (Object.keys(errors).length) {
      controls.get(Object.keys(errors)[0])?.input.focus();
      return;
    }
    const payload = {};
    config.fields.forEach((field) => { payload[field.name] = inputToFieldValue(field, controls.get(field.name).input); });
    if (typeof config.beforeSave === "function") {
      const adjusted = await config.beforeSave(payload, record);
      if (adjusted === false) return;
      if (adjusted && typeof adjusted === "object") Object.assign(payload, adjusted);
    }
    const { selectedBabyId } = getState();
    submit.disabled = true;
    cancel.disabled = true;
    try {
      if (record) await updateBabyRecord(selectedBabyId, config.collection, record.id, payload);
      else await createBabyRecord(selectedBabyId, config.collection, payload);
      showToast(record ? "Đã cập nhật bản ghi." : "Đã thêm bản ghi.", "success");
      closeModal();
      onSaved?.();
    } catch (error) {
      console.error(error);
      showToast(friendlyErrorMessage(error, "Không thể lưu bản ghi."), "error");
    } finally {
      submit.disabled = false;
      cancel.disabled = false;
    }
  });
  return form;
}

function openRecordForm(config, record = null) {
  const form = makeForm(config, record);
  openModal({ title: record ? `Sửa ${config.singular.toLowerCase()}` : `Thêm ${config.singular.toLowerCase()}`, content: form });
}

function renderRecordCard(config, record, onDelete) {
  const card = createElement("article", { className: "card record-card" });
  const header = createElement("div", { className: "record-card-header" });
  const titleWrapper = createElement("div");
  const title = createElement("div", { className: "record-card-title" });
  if (config.icon) title.append(createIcon(config.icon, { size: 19 }));
  title.append(document.createTextNode(typeof config.recordTitle === "function" ? config.recordTitle(record) : record[config.recordTitle] || config.singular));
  titleWrapper.append(title);
  if (config.recordSubtitle) titleWrapper.append(createElement("div", { className: "muted small", text: config.recordSubtitle(record) }));
  header.append(titleWrapper);
  if (config.statusField && record[config.statusField] !== undefined && record[config.statusField] !== null) {
    const status = config.statusMap?.[record[config.statusField]] || { label: record[config.statusField], tone: "default" };
    header.append(statusBadge(status.label, status.tone));
  }
  card.append(header);

  const fields = createElement("div", { className: "record-fields" });
  config.fields.filter((field) => field.showInCard !== false && !field.hideInCard).forEach((field) => {
    if (field.name === config.recordTitle) return;
    const value = record[field.name];
    if ((value === null || value === undefined || value === "") && field.hideWhenEmpty) return;
    const item = createElement("div", { className: "record-field" });
    item.append(createElement("span", { text: field.label }), createElement("span", { text: displayValue(field, value, record) }));
    fields.append(item);
  });
  card.append(fields);

  const actions = createElement("div", { className: "record-actions" });
  const edit = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
  setButtonContent(edit, "edit", "Sửa");
  const remove = createElement("button", { className: "button button-ghost text-danger", attrs: { type: "button" } });
  setButtonContent(remove, "delete", "Xóa");
  edit.addEventListener("click", () => openRecordForm(config, record));
  remove.addEventListener("click", () => onDelete(record));
  actions.append(edit, remove);
  if (typeof config.customCardActions === "function") config.customCardActions(record, actions);
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
  const exportButton = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(exportButton, "download", "Xuất CSV");
  const addButton = createElement("button", { className: "button button-primary", attrs: { type: "button" } });
  setButtonContent(addButton, "add", `Thêm ${config.singular.toLowerCase()}`);
  actions.append(exportButton, addButton);
  header.append(intro, actions);
  container.append(header);
  if (config.medicalNote) container.append(createElement("p", { className: "medical-note mb-2", text: config.medicalNote }));
  if (typeof config.renderTop === "function") {
    const top = createElement("div");
    config.renderTop(top, { openForm: () => openRecordForm(config) });
    container.append(top);
  }

  const filter = createElement("div", { className: "filter-bar" });
  const search = createElement("input", { attrs: { type: "search", placeholder: config.searchPlaceholder || "Tìm kiếm...", "aria-label": "Tìm kiếm" } });
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
  container.append(filter);
  const list = createElement("div", { className: "record-list" });
  container.append(list);
  renderLoading(list);

  let allRecords = [];
  let disposed = false;
  const renderList = () => {
    if (disposed) return;
    const records = allRecords.filter((record) => recordMatches(config, record, search.value.trim(), start.value, end.value, extraFilter?.value || ""));
    clearElement(list);
    if (!records.length) {
      renderEmptyState(list, { icon: config.emptyIcon || "description", title: search.value || start.value || end.value ? "Không tìm thấy kết quả" : `Chưa có ${config.title.toLowerCase()}`, message: "Hãy thêm bản ghi đầu tiên hoặc thay đổi bộ lọc.", actionLabel: `Thêm ${config.singular.toLowerCase()}`, onAction: () => openRecordForm(config) });
    } else {
      records.forEach((record) => list.append(renderRecordCard(config, record, async (target) => {
        const confirmed = await confirmDialog({ title: `Xóa ${config.singular.toLowerCase()}?`, message: "Bản ghi sẽ bị xóa khỏi Firestore và không thể hoàn tác.", confirmLabel: "Xóa", danger: true });
        if (!confirmed) return;
        try {
          await deleteBabyRecord(selectedBabyId, config.collection, target.id);
          showToast("Đã xóa bản ghi.", "success");
        } catch (error) {
          console.error(error);
          showToast(friendlyErrorMessage(error, "Không thể xóa bản ghi."), "error");
        }
      })));
    }
    config.afterRecordsRender?.(records, { container, list });
  };

  [search, start, end, extraFilter].filter(Boolean).forEach((input) => input.addEventListener("input", renderList));
  addButton.addEventListener("click", () => openRecordForm(config));
  exportButton.addEventListener("click", () => {
    const records = allRecords.filter((record) => recordMatches(config, record, search.value.trim(), start.value, end.value, extraFilter?.value || ""));
    exportCsv(records, config.csvColumns || config.fields.map((field) => ({ key: field.name, label: field.label })), `baby-tracker-${config.collection}`);
  });

  const unsubscribe = subscribeToCollection(getBabySubcollection(selectedBabyId, config.collection), { orderByField: config.orderByField || config.dateField || "createdAt", orderDirection: config.orderDirection || "desc", limit: config.limit || 200 }, (records) => {
    allRecords = records;
    renderList();
  }, (error) => renderErrorState(list, friendlyErrorMessage(error, "Không thể tải dữ liệu."), () => window.location.reload()));

  return () => {
    disposed = true;
    unsubscribe?.();
    config.cleanup?.();
  };
}
