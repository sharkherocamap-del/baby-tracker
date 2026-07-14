import { renderRecordModule } from "./module-factory.js";
import { formatDate, formatDateTime, parseDisplayDateTime, toDate } from "../date-utils.js";
import { exportCsv, parseCsv } from "../export-utils.js";
import { getState } from "../app-state.js";
import { Timestamp, getBabySubcollection, getCollection, runWriteBatch } from "../firestore-service.js";
import { closeModal, openModal } from "../modal.js";
import { createElement } from "../ui.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { isValidUrl, trimText } from "../validators.js";
import { setButtonContent } from "../icons.js";

const MAX_IMPORT_ROWS = 400;
const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024;

const statusOptions = [
  { value: "scheduled", label: "Đã lên lịch" },
  { value: "upcoming", label: "Sắp đến hạn" },
  { value: "completed", label: "Đã tiêm" },
  { value: "overdue", label: "Quá hạn" },
  { value: "cancelled", label: "Đã hủy" }
];

const statusLabels = Object.fromEntries(statusOptions.map((item) => [item.value, item.label]));
const statusAliases = new Map([
  ["scheduled", "scheduled"], ["đã lên lịch", "scheduled"],
  ["upcoming", "upcoming"], ["sắp đến hạn", "upcoming"],
  ["completed", "completed"], ["đã tiêm", "completed"],
  ["overdue", "overdue"], ["quá hạn", "overdue"],
  ["cancelled", "cancelled"], ["canceled", "cancelled"], ["đã hủy", "cancelled"], ["đã huỷ", "cancelled"]
]);

const vaccinationFields = [
  { name: "vaccineName", label: "Tên vaccine", type: "text", required: true, maxLength: 160 },
  { name: "diseasePrevention", label: "Phòng bệnh", type: "text", maxLength: 250, hideWhenEmpty: true },
  { name: "doseNumber", label: "Mũi số", type: "number", min: 1, max: 30, step: 1, required: true, defaultValue: 1 },
  { name: "scheduledDate", label: "Ngày dự kiến", type: "datetime-local", required: true },
  { name: "administeredDate", label: "Ngày tiêm thực tế", type: "datetime-local", hideWhenEmpty: true },
  { name: "status", label: "Trạng thái", type: "select", required: true, options: statusOptions, defaultValue: "scheduled" },
  { name: "clinic", label: "Cơ sở tiêm", type: "text", maxLength: 250, hideWhenEmpty: true },
  { name: "provider", label: "Người thực hiện", type: "text", maxLength: 160, hideWhenEmpty: true },
  { name: "batchNumber", label: "Số lô", type: "text", maxLength: 100, hideWhenEmpty: true },
  { name: "reactions", label: "Phản ứng sau tiêm", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true },
  { name: "documentUrl", label: "URL chứng nhận", type: "url", maxLength: 1000, full: true, hideWhenEmpty: true },
  { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
];

const vaccinationCsvColumns = vaccinationFields.map((field) => field.name === "status"
  ? { key: field.name, label: field.label, value: (record) => statusLabels[record.status] || record.status || "" }
  : { key: field.name, label: field.label });

const headerAliases = {
  vaccineName: ["Tên vaccine", "vaccineName"],
  diseasePrevention: ["Phòng bệnh", "diseasePrevention"],
  doseNumber: ["Mũi số", "doseNumber"],
  scheduledDate: ["Ngày dự kiến", "scheduledDate"],
  administeredDate: ["Ngày tiêm thực tế", "administeredDate"],
  status: ["Trạng thái", "status"],
  clinic: ["Cơ sở tiêm", "clinic"],
  provider: ["Người thực hiện", "provider"],
  batchNumber: ["Số lô", "batchNumber"],
  reactions: ["Phản ứng sau tiêm", "reactions"],
  documentUrl: ["URL chứng nhận", "documentUrl"],
  notes: ["Ghi chú", "notes"]
};

function normalizeCell(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

function normalizeLookup(value) {
  return normalizeCell(value).toLocaleLowerCase("vi-VN").replace(/\s+/g, " ");
}

function columnIndexes(headers) {
  const normalizedHeaders = headers.map(normalizeLookup);
  return Object.fromEntries(Object.entries(headerAliases).map(([field, aliases]) => [
    field,
    normalizedHeaders.findIndex((header) => aliases.some((alias) => normalizeLookup(alias) === header))
  ]));
}

function rowValue(cells, indexes, field) {
  const index = indexes[field];
  return index >= 0 ? normalizeCell(cells[index]) : "";
}

function validateLength(value, maximum, label, errors) {
  if (value.length > maximum) errors.push(`${label} vượt quá ${maximum} ký tự.`);
  return trimText(value, maximum);
}

function duplicateKey(record) {
  const date = toDate(record.scheduledDate);
  const minute = date ? date.toISOString().slice(0, 16) : "invalid";
  return `${normalizeLookup(record.vaccineName)}|${Number(record.doseNumber) || 0}|${minute}`;
}

function parseVaccinationCsv(text) {
  const csvRows = parseCsv(text);
  if (csvRows.length < 2) throw new Error("CSV_EMPTY");
  const indexes = columnIndexes(csvRows[0]);
  const missing = ["vaccineName", "doseNumber", "scheduledDate", "status"].filter((field) => indexes[field] < 0);
  if (missing.length) {
    const error = new Error("CSV_MISSING_COLUMNS");
    error.missingColumns = missing.map((field) => vaccinationFields.find((item) => item.name === field)?.label || field);
    throw error;
  }

  const dataRows = csvRows.slice(1).filter((cells) => cells.some((cell) => normalizeCell(cell) !== ""));
  if (!dataRows.length) throw new Error("CSV_EMPTY");
  if (dataRows.length > MAX_IMPORT_ROWS) throw new Error("CSV_TOO_MANY_ROWS");

  const seenInFile = new Set();
  return dataRows.map((cells, index) => {
    const errors = [];
    const vaccineNameRaw = rowValue(cells, indexes, "vaccineName");
    const vaccineName = validateLength(vaccineNameRaw, 160, "Tên vaccine", errors);
    if (!vaccineName) errors.push("Tên vaccine là bắt buộc.");

    const doseRaw = rowValue(cells, indexes, "doseNumber").replace(",", ".");
    const doseNumber = Number(doseRaw);
    if (!Number.isInteger(doseNumber) || doseNumber < 1 || doseNumber > 30) errors.push("Mũi số phải là số nguyên từ 1 đến 30.");

    const scheduledRaw = rowValue(cells, indexes, "scheduledDate");
    const scheduledDateValue = parseDisplayDateTime(scheduledRaw);
    if (!scheduledDateValue) errors.push("Ngày dự kiến không hợp lệ. Dùng định dạng dd/mm/yyyy HH:mm.");

    const administeredRaw = rowValue(cells, indexes, "administeredDate");
    const administeredDateValue = administeredRaw ? parseDisplayDateTime(administeredRaw) : null;
    if (administeredRaw && !administeredDateValue) errors.push("Ngày tiêm thực tế không hợp lệ.");

    const statusRaw = normalizeLookup(rowValue(cells, indexes, "status"));
    const status = statusAliases.get(statusRaw);
    if (!status) errors.push("Trạng thái không hợp lệ.");

    const documentUrlRaw = rowValue(cells, indexes, "documentUrl");
    if (documentUrlRaw && !isValidUrl(documentUrlRaw)) errors.push("URL chứng nhận phải bắt đầu bằng http:// hoặc https://.");

    const payload = {
      vaccineName,
      diseasePrevention: validateLength(rowValue(cells, indexes, "diseasePrevention"), 250, "Phòng bệnh", errors),
      doseNumber: Number.isInteger(doseNumber) ? doseNumber : 0,
      scheduledDate: scheduledDateValue ? Timestamp.fromDate(scheduledDateValue) : null,
      administeredDate: administeredDateValue ? Timestamp.fromDate(administeredDateValue) : null,
      status: status || "scheduled",
      clinic: validateLength(rowValue(cells, indexes, "clinic"), 250, "Cơ sở tiêm", errors),
      provider: validateLength(rowValue(cells, indexes, "provider"), 160, "Người thực hiện", errors),
      batchNumber: validateLength(rowValue(cells, indexes, "batchNumber"), 100, "Số lô", errors),
      reactions: validateLength(rowValue(cells, indexes, "reactions"), 1000, "Phản ứng sau tiêm", errors),
      documentUrl: validateLength(documentUrlRaw, 1000, "URL chứng nhận", errors),
      notes: validateLength(rowValue(cells, indexes, "notes"), 1000, "Ghi chú", errors)
    };

    const key = duplicateKey(payload);
    const duplicateInFile = seenInFile.has(key);
    if (!duplicateInFile && scheduledDateValue && vaccineName && Number.isInteger(doseNumber)) seenInFile.add(key);

    return {
      rowNumber: index + 2,
      payload,
      errors,
      duplicateInFile,
      duplicateExisting: false
    };
  });
}

function importStatusText(row) {
  if (row.errors.length) return row.errors.join(" ");
  if (row.duplicateInFile) return "Trùng với một dòng khác trong file.";
  if (row.duplicateExisting) return "Đã tồn tại trong dữ liệu hiện tại.";
  return "Sẵn sàng nhập";
}

function canImportRow(row) {
  return !row.errors.length && !row.duplicateInFile && !row.duplicateExisting;
}

function createPreviewTable(rows) {
  const wrapper = createElement("div", { className: "table-scroll csv-preview-table" });
  const table = createElement("table");
  const head = createElement("thead");
  const headRow = createElement("tr");
  ["Dòng", "Tên vaccine", "Mũi", "Ngày dự kiến", "Trạng thái", "Kết quả"].forEach((label) => headRow.append(createElement("th", { text: label })));
  head.append(headRow);
  const body = createElement("tbody");
  rows.slice(0, 50).forEach((row) => {
    const tr = createElement("tr");
    if (!canImportRow(row)) tr.classList.add("row-warning");
    tr.append(
      createElement("td", { text: String(row.rowNumber) }),
      createElement("td", { text: row.payload.vaccineName || "—" }),
      createElement("td", { text: row.payload.doseNumber ? String(row.payload.doseNumber) : "—" }),
      createElement("td", { text: row.payload.scheduledDate ? formatDateTime(row.payload.scheduledDate) : "—" }),
      createElement("td", { text: statusLabels[row.payload.status] || "—" }),
      createElement("td", { text: importStatusText(row) })
    );
    body.append(tr);
  });
  table.append(head, body);
  wrapper.append(table);
  if (rows.length > 50) wrapper.append(createElement("p", { className: "muted small mt-1", text: `Chỉ hiển thị 50/${rows.length} dòng trong phần xem trước.` }));
  return wrapper;
}

function openImportPreview(rows, fileName) {
  const validRows = rows.filter(canImportRow);
  const invalidCount = rows.filter((row) => row.errors.length).length;
  const duplicateCount = rows.filter((row) => row.duplicateInFile || row.duplicateExisting).length;
  const content = createElement("div", { className: "csv-import-preview" });
  content.append(
    createElement("p", { text: `File: ${fileName}` }),
    createElement("div", { className: "csv-import-summary" })
  );
  const summary = content.querySelector(".csv-import-summary");
  [
    ["Tổng số dòng", rows.length],
    ["Có thể nhập", validRows.length],
    ["Không hợp lệ", invalidCount],
    ["Bị bỏ qua do trùng", duplicateCount]
  ].forEach(([label, value]) => {
    const item = createElement("div", { className: "csv-summary-item" });
    item.append(createElement("strong", { text: String(value) }), createElement("span", { text: label }));
    summary.append(item);
  });
  content.append(createPreviewTable(rows));

  const actions = createElement("div", { className: "form-actions" });
  const cancel = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(cancel, "close", "Hủy");
  const submit = createElement("button", { className: "button button-primary", attrs: { type: "button" } });
  setButtonContent(submit, "upload_file", `Nhập ${validRows.length} mũi tiêm`);
  submit.disabled = validRows.length === 0;
  cancel.addEventListener("click", closeModal);
  submit.addEventListener("click", async () => {
    const { selectedBabyId } = getState();
    if (!selectedBabyId) return;
    submit.disabled = true;
    cancel.disabled = true;
    setButtonContent(submit, "progress_activity", "Đang nhập...");
    try {
      const path = getBabySubcollection(selectedBabyId, "vaccinations");
      await runWriteBatch(validRows.map((row) => ({ type: "create", path, data: row.payload })));
      closeModal();
      showToast(`Đã nhập ${validRows.length} mũi tiêm từ CSV.`, "success");
    } catch (error) {
      console.error(error);
      showToast(friendlyErrorMessage(error, "Không thể nhập dữ liệu CSV."), "error");
      submit.disabled = false;
      cancel.disabled = false;
      setButtonContent(submit, "upload_file", `Nhập ${validRows.length} mũi tiêm`);
    }
  });
  actions.append(cancel, submit);
  content.append(actions);
  openModal({ title: "Xem trước dữ liệu tiêm phòng", content, size: "large", closeOnBackdrop: false });
}

async function handleCsvFile(file, triggerButton) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showToast("Hãy chọn file có phần mở rộng .csv.", "warning");
    return;
  }
  if (file.size > MAX_CSV_SIZE_BYTES) {
    showToast("File CSV không được lớn hơn 2 MB.", "warning");
    return;
  }

  const originalLabel = "Nhập CSV";
  triggerButton.disabled = true;
  setButtonContent(triggerButton, "progress_activity", "Đang đọc CSV...");
  try {
    const rows = parseVaccinationCsv(await file.text());
    const { selectedBabyId } = getState();
    const existingResult = await getAllPagesResult(getBabySubcollection(selectedBabyId, "vaccinations"), {
      deletedMode: "active",
      orderByField: "scheduledDate",
      orderDirection: "desc",
      pageSize: 100,
      maxRecords: 10000
    });
    if (existingResult.truncated) throw new Error("Danh sách vaccine vượt 10.000 bản ghi; không thể kiểm tra trùng an toàn trên trình duyệt.");
    const existingKeys = new Set(existingResult.items.map(duplicateKey));
    rows.forEach((row) => { row.duplicateExisting = existingKeys.has(duplicateKey(row.payload)); });
    openImportPreview(rows, file.name);
  } catch (error) {
    console.error(error);
    if (error.message === "CSV_EMPTY") showToast("CSV không có dòng dữ liệu để nhập.", "warning");
    else if (error.message === "CSV_TOO_MANY_ROWS") showToast(`Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} dòng.`, "warning");
    else if (error.message === "CSV_MISSING_COLUMNS") showToast(`CSV thiếu cột bắt buộc: ${error.missingColumns.join(", ")}.`, "warning");
    else if (error.message === "CSV_UNCLOSED_QUOTE") showToast("CSV có dấu nháy kép chưa được đóng đúng cách.", "warning");
    else showToast(friendlyErrorMessage(error, "Không thể đọc file CSV."), "error");
  } finally {
    triggerButton.disabled = false;
    setButtonContent(triggerButton, "upload_file", originalLabel);
  }
}

function renderCsvImport(container) {
  const card = createElement("section", { className: "card csv-import-card mb-2" });
  const text = createElement("div");
  text.append(
    createElement("h3", { text: "Nhập lịch tiêm từ CSV" }),
    createElement("p", { className: "muted small", text: "Dùng đúng các cột giống file Xuất CSV. Hệ thống sẽ xem trước, kiểm tra lỗi và bỏ qua bản ghi trùng trước khi ghi Firestore." })
  );
  const actions = createElement("div", { className: "flex flex-wrap gap-1" });
  const fileInput = createElement("input", { className: "hidden", attrs: { type: "file", accept: ".csv,text/csv", "aria-label": "Chọn file CSV tiêm phòng" } });
  const importButton = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
  setButtonContent(importButton, "upload_file", "Nhập CSV");
  const templateButton = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(templateButton, "download", "Tải CSV mẫu");
  importButton.addEventListener("click", () => fileInput.click());
  templateButton.addEventListener("click", () => exportCsv([], vaccinationCsvColumns, "baby-tracker-vaccinations-template"));
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    await handleCsvFile(file, importButton);
  });
  actions.append(importButton, templateButton, fileInput);
  card.append(text, actions);
  container.append(card);
}

const config = {
  title: "Tiêm phòng",
  icon: "vaccines",
  singular: "Mũi tiêm",
  collection: "vaccinations",
  dateField: "scheduledDate",
  orderByField: "scheduledDate",
  searchFields: ["vaccineName", "diseasePrevention", "clinic", "provider"],
  searchPlaceholder: "Tìm vaccine, bệnh phòng ngừa, cơ sở...",
  filterField: "status",
  filterLabel: "Lọc trạng thái vaccine",
  filterAllLabel: "Tất cả trạng thái",
  filterOptions: statusOptions,
  medicalNote: "Lịch tiêm do người dùng nhập để ghi nhớ; không phải chỉ định y khoa bắt buộc.",
  recordTitle: "vaccineName",
  recordSubtitle: (record) => `Dự kiến: ${formatDate(record.scheduledDate)}${record.administeredDate ? ` · Đã tiêm: ${formatDate(record.administeredDate)}` : ""}`,
  statusField: "status",
  statusMap: {
    scheduled: { label: "Đã lên lịch", tone: "default" },
    upcoming: { label: "Sắp đến hạn", tone: "warning" },
    completed: { label: "Đã tiêm", tone: "success" },
    overdue: { label: "Quá hạn", tone: "danger" },
    cancelled: { label: "Đã hủy", tone: "default" }
  },
  fields: vaccinationFields,
  csvColumns: vaccinationCsvColumns,
  renderTop: renderCsvImport
};

export function render(container) {
  return renderRecordModule(container, config);
}
