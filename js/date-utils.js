const DISPLAY_TIME_ZONE = "Asia/Ho_Chi_Minh";
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
  const parts = partsInDisplayZone(value);
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : "—";
}

export function formatDateTime(value) {
  const parts = partsInDisplayZone(value);
  return parts ? `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}` : "—";
}

function partsInDisplayZone(value) {
  const date = toDate(value);
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23"
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


function createDisplayZoneDate(year, month, day, hour = 0, minute = 0) {
  const values = [year, month, day, hour, minute].map(Number);
  if (!values.every(Number.isInteger)) return null;
  const [safeYear, safeMonth, safeDay, safeHour, safeMinute] = values;
  if (safeYear < 1900 || safeYear > 2200 || safeMonth < 1 || safeMonth > 12 || safeDay < 1 || safeDay > 31 || safeHour < 0 || safeHour > 23 || safeMinute < 0 || safeMinute > 59) return null;
  const iso = `${String(safeYear).padStart(4, "0")}-${String(safeMonth).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}T${String(safeHour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}:00+07:00`;
  const date = new Date(iso);
  const parts = partsInDisplayZone(date);
  if (!parts
    || Number(parts.year) !== safeYear
    || Number(parts.month) !== safeMonth
    || Number(parts.day) !== safeDay
    || Number(parts.hour) !== safeHour
    || Number(parts.minute) !== safeMinute) return null;
  return date;
}

/**
 * Parses values exported by Baby Tracker CSV.
 * Accepts dd/mm/yyyy HH:mm, the legacy HH:mm dd/mm/yyyy output, and ISO-style values.
 */
export function parseDisplayDateTime(value) {
  const text = String(value ?? "").replace(/^\uFEFF/, "").trim();
  if (!text || text === "—") return null;

  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2}))?$/);
  if (match) return createDisplayZoneDate(match[3], match[2], match[1], match[4] || 0, match[5] || 0);

  match = text.match(/^(\d{1,2}):(\d{2})[ T]+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return createDisplayZoneDate(match[5], match[4], match[3], match[1], match[2]);

  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (match) return createDisplayZoneDate(match[1], match[2], match[3], match[4] || 0, match[5] || 0);

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
