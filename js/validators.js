const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PROTOCOLS = new Set(["http:", "https:"]);

export function trimText(value, maxLength = 2000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(trimText(value, 320).toLowerCase());
}

export function normalizeEmail(value) {
  return trimText(value, 320).toLowerCase();
}

export function isValidUrl(value) {
  if (!value) return true;
  try { return URL_PROTOCOLS.has(new URL(value).protocol); } catch { return false; }
}

export function isPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

export function isNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

export function validateTemperature(value) {
  if (value === "" || value === null || value === undefined) return true;
  const number = Number(value);
  return Number.isFinite(number) && number >= 30 && number <= 45;
}

export function validateRole(value) {
  return value === "admin" || value === "member";
}

export function validateField(field, rawValue, allValues = {}) {
  const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
  if (field.required && (value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0))) {
    return "Trường này là bắt buộc.";
  }
  if (value === "" || value === null || value === undefined) return "";
  if (field.maxLength && String(value).length > field.maxLength) return `Tối đa ${field.maxLength} ký tự.`;
  if (field.type === "email" && !isValidEmail(value)) return "Email không hợp lệ.";
  if (field.type === "url" && !isValidUrl(value)) return "URL phải bắt đầu bằng http:// hoặc https://.";
  if (field.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) return "Giá trị số không hợp lệ.";
    if (field.min !== undefined && number < field.min) return `Giá trị phải từ ${field.min} trở lên.`;
    if (field.max !== undefined && number > field.max) return `Giá trị không được lớn hơn ${field.max}.`;
  }
  if (field.name === "temperatureCelsius" && !validateTemperature(value)) return "Nhiệt độ nhập liệu hợp lý là từ 30 đến 45°C.";
  if (field.type === "date") {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Ngày không hợp lệ.";
    if (field.notFuture && date > new Date()) return "Ngày không được ở tương lai.";
  }
  if (field.type === "datetime-local") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Ngày giờ không hợp lệ.";
  }
  if (field.afterField && value && allValues[field.afterField]) {
    const current = new Date(value);
    const other = new Date(allValues[field.afterField]);
    if (current < other) return `Thời điểm phải sau hoặc bằng ${field.afterLabel || field.afterField}.`;
  }
  if (typeof field.validate === "function") return field.validate(value, allValues) || "";
  return "";
}

export function validateFormFields(fields, values) {
  const errors = {};
  fields.forEach((field) => {
    const error = validateField(field, values[field.name], values);
    if (error) errors[field.name] = error;
  });
  return errors;
}
