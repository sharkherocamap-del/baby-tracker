const DISPLAY_TIME_ZONE = "Asia/Ho_Chi_Minh";
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "—";
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "—";
}

function partsInDisplayZone(value) {
  const date = toDate(value);
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  });
  return Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function toDateInput(value) {
  const parts = partsInDisplayZone(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

export function toDateTimeLocalInput(value) {
  const parts = partsInDisplayZone(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` : "";
}

export function parseLocalInput(value) {
  if (!value) return null;
  const normalized = value.length === 10 ? `${value}T00:00:00+07:00` : `${value}:00+07:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfLocalDay(date = new Date()) {
  const datePart = toDateInput(date);
  return parseLocalInput(datePart);
}

export function endOfLocalDay(date = new Date()) {
  const datePart = toDateInput(date);
  return new Date(`${datePart}T23:59:59.999+07:00`);
}

export function formatDuration(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (!hours) return `${rest} phút`;
  return `${hours} giờ${rest ? ` ${rest} phút` : ""}`;
}

export function durationMinutes(start, end) {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate || endDate < startDate) return 0;
  return Math.round((endDate - startDate) / 60000);
}

export function calculateAge(birthDate, atDate = new Date()) {
  const birth = toDate(birthDate);
  const at = toDate(atDate);
  if (!birth || !at || at < birth) return "—";
  let years = at.getFullYear() - birth.getFullYear();
  let months = at.getMonth() - birth.getMonth();
  let days = at.getDate() - birth.getDate();
  if (days < 0) {
    const previousMonthDays = new Date(at.getFullYear(), at.getMonth(), 0).getDate();
    days += previousMonthDays;
    months -= 1;
  }
  if (months < 0) { months += 12; years -= 1; }
  const parts = [];
  if (years) parts.push(`${years} năm`);
  if (months || years) parts.push(`${months} tháng`);
  parts.push(`${days} ngày`);
  return parts.join(" ");
}

export function todayFileStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
