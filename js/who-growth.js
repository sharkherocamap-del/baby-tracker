import { toDate } from "./date-utils.js";

const DATA_URL = "./assets/data/who-growth-standards-v1.json";
let datasetPromise = null;

export function loadWhoGrowthDataset() {
  if (!datasetPromise) {
    datasetPromise = fetch(DATA_URL, { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error(`Không tải được WHO dataset (${response.status}).`);
      return response.json();
    });
  }
  return datasetPromise;
}

export function ageInCompletedDays(birthDate, measuredAt) {
  const birth = typeof birthDate === "string" ? new Date(`${birthDate}T00:00:00`) : toDate(birthDate);
  const measured = toDate(measuredAt);
  if (!birth || !measured || Number.isNaN(birth.getTime()) || Number.isNaN(measured.getTime())) return null;
  const start = Date.UTC(birth.getFullYear(), birth.getMonth(), birth.getDate());
  const end = Date.UTC(measured.getFullYear(), measured.getMonth(), measured.getDate());
  return Math.floor((end - start) / 86400000);
}

export function lmsValueAtZ(zScore, l, m, s) {
  if (![zScore, l, m, s].every(Number.isFinite) || m <= 0 || s <= 0) return null;
  if (Math.abs(l) < 1e-12) return m * Math.exp(s * zScore);
  const base = 1 + l * s * zScore;
  return base > 0 ? m * Math.pow(base, 1 / l) : null;
}

/**
 * WHO restricted LMS: trong ±3 SD dùng Box-Cox LMS; ngoài ±3 SD dùng khoảng cách
 * cố định giữa 2 và 3 SD để tránh ngoại suy phần đuôi quá mức.
 */
export function lmsZScore(value, l, m, s) {
  const numeric = Number(value);
  if (![numeric, l, m, s].every(Number.isFinite) || numeric <= 0 || m <= 0 || s <= 0) return null;
  const raw = Math.abs(l) < 1e-12
    ? Math.log(numeric / m) / s
    : (Math.pow(numeric / m, l) - 1) / (l * s);
  if (raw > 3) {
    const plus2 = lmsValueAtZ(2, l, m, s);
    const plus3 = lmsValueAtZ(3, l, m, s);
    return plus2 !== null && plus3 !== null && plus3 > plus2 ? 3 + (numeric - plus3) / (plus3 - plus2) : raw;
  }
  if (raw < -3) {
    const minus2 = lmsValueAtZ(-2, l, m, s);
    const minus3 = lmsValueAtZ(-3, l, m, s);
    return minus2 !== null && minus3 !== null && minus2 > minus3 ? -3 + (numeric - minus3) / (minus2 - minus3) : raw;
  }
  return raw;
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return sign * y;
}

export function zScoreToPercentile(zScore) {
  if (!Number.isFinite(zScore)) return null;
  const percentile = 50 * (1 + erf(zScore / Math.SQRT2));
  return Math.max(0.01, Math.min(99.99, percentile));
}

function metricKey(field) {
  return { weightKg: "weight", heightCm: "height", headCircumferenceCm: "head" }[field] || null;
}

export async function assessGrowthRecord({ baby, record }) {
  if (!baby || !record || !["female", "male"].includes(baby.gender)) {
    return { available: false, reason: "WHO cần giới tính nam hoặc nữ trong hồ sơ bé." };
  }
  const ageDays = ageInCompletedDays(baby.birthDate, record.measuredAt);
  if (!Number.isInteger(ageDays) || ageDays < 0 || ageDays > 1856) {
    return { available: false, reason: "WHO Child Growth Standards trong ứng dụng áp dụng từ 0 đến 1.856 ngày (xấp xỉ 5 tuổi)." };
  }
  const dataset = await loadWhoGrowthDataset();
  const results = {};
  for (const field of ["weightKg", "heightCm", "headCircumferenceCm"]) {
    const value = Number(record[field]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const metric = metricKey(field);
    const row = dataset.metrics?.[metric]?.[baby.gender]?.[ageDays];
    if (!row || row[0] !== ageDays) continue;
    const [, l, m, s] = row;
    const zScore = lmsZScore(value, l, m, s);
    results[field] = {
      value,
      zScore,
      percentile: Math.abs(zScore) <= 3 ? zScoreToPercentile(zScore) : null,
      outsidePercentileRange: Math.abs(zScore) > 3,
      median: m,
      ageDays
    };
  }
  return {
    available: Object.keys(results).length > 0,
    ageDays,
    results,
    source: dataset.source,
    standardVersion: dataset.standardVersion
  };
}

export async function buildWhoReferenceSeries({ baby, records, field }) {
  if (!baby || !["female", "male"].includes(baby.gender)) return [];
  const dataset = await loadWhoGrowthDataset();
  const metric = metricKey(field);
  const rows = dataset.metrics?.[metric]?.[baby.gender];
  if (!rows) return [];
  return records.map((record) => {
    const ageDays = ageInCompletedDays(baby.birthDate, record.measuredAt);
    const row = Number.isInteger(ageDays) && ageDays >= 0 && ageDays < rows.length ? rows[ageDays] : null;
    if (!row) return null;
    const [, l, m, s] = row;
    const valueAtZ = (z) => lmsValueAtZ(z, l, m, s);
    return {
      ageDays,
      median: valueAtZ(0),
      minus2: valueAtZ(-2),
      plus2: valueAtZ(2)
    };
  });
}
