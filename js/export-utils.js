import { todayFileStamp, toDate, formatDateTime } from "./date-utils.js";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function exportCsv(records, columns, filenamePrefix) {
  const headers = columns.map((column) => csvEscape(column.label)).join(",");
  const rows = records.map((record) => columns.map((column) => {
    let value = typeof column.value === "function" ? column.value(record) : record[column.key];
    if (value && typeof value.toDate === "function") value = formatDateTime(value);
    if (Array.isArray(value)) value = value.join("; ");
    return csvEscape(value);
  }).join(","));
  const csv = `\uFEFF${[headers, ...rows].join("\r\n")}`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filenamePrefix}-${todayFileStamp()}.csv`);
}

export function exportJson(data, filenamePrefix = "baby-tracker-backup") {
  const json = JSON.stringify(data, (_key, value) => {
    if (value && typeof value.toDate === "function") return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value;
  }, 2);
  downloadBlob(new Blob([json], { type: "application/json;charset=utf-8" }), `${filenamePrefix}-${todayFileStamp()}.json`);
}

export function isWithinRange(value, startDate, endDate) {
  const date = toDate(value);
  if (!date) return false;
  if (startDate && date < new Date(`${startDate}T00:00:00`)) return false;
  if (endDate && date > new Date(`${endDate}T23:59:59.999`)) return false;
  return true;
}
