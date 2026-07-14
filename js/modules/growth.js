import { renderRecordModule } from "./module-factory.js";
import { formatDate } from "../date-utils.js";
import { createElement, clearElement } from "../ui.js";
import { showToast } from "../toast.js";
import { getState } from "../app-state.js";
import { assessGrowthRecord, buildWhoReferenceSeries } from "../who-growth.js";

const charts = new Map();
let chartCanvases = {};
let whoSummary = null;
let lastChartSignature = "";
let renderRun = 0;

function destroyCharts() {
  charts.forEach((chart) => chart.destroy());
  charts.clear();
  lastChartSignature = "";
}

function recordTime(record) {
  return record.measuredAt?.toMillis?.() || record.measuredAt?.toDate?.()?.getTime?.() || 0;
}

function chartSignature(records, baby) {
  return `${baby?.id || ""}|${records.map((record) => [record.id, recordTime(record), record.weightKg ?? null, record.heightCm ?? null, record.headCircumferenceCm ?? null].join(":")).join("|")}`;
}

function formatPercentile(value) {
  if (!Number.isFinite(value)) return "—";
  if (value < 0.1) return "< 0,1";
  if (value > 99.9) return "> 99,9";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

async function renderWhoSummary(records) {
  if (!whoSummary) return;
  clearElement(whoSummary);
  const baby = getState().selectedBaby;
  const latest = [...records].sort((a, b) => recordTime(b) - recordTime(a))[0];
  if (!latest) {
    whoSummary.append(createElement("p", { className: "muted", text: "Thêm bản ghi tăng trưởng để xem tham chiếu WHO." }));
    return;
  }
  try {
    const assessment = await assessGrowthRecord({ baby, record: latest });
    if (!assessment.available) {
      whoSummary.append(createElement("p", { className: "muted", text: assessment.reason }));
      return;
    }
    const labels = {
      weightKg: ["Cân nặng theo tuổi", "kg"],
      heightCm: ["Chiều dài/chiều cao theo tuổi", "cm"],
      headCircumferenceCm: ["Vòng đầu theo tuổi", "cm"]
    };
    const grid = createElement("div", { className: "grid who-summary-grid" });
    Object.entries(assessment.results).forEach(([field, result]) => {
      const [label, unit] = labels[field];
      const card = createElement("article", { className: "who-stat" });
      card.append(
        createElement("span", { className: "muted small", text: label }),
        createElement("strong", { text: `${result.value.toLocaleString("vi-VN")} ${unit}` }),
        createElement("span", { text: `Z-score: ${result.zScore.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}` }),
        createElement("span", { text: result.outsidePercentileRange ? "Percentile: không hiển thị ngoài ±3 SD" : `Percentile tham chiếu: ${formatPercentile(result.percentile)}` }),
        createElement("span", { className: "muted small", text: `Trung vị WHO cùng ngày tuổi: ${result.median.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${unit}` })
      );
      grid.append(card);
    });
    whoSummary.append(grid, createElement("p", { className: "muted small mt-1", text: `Tuổi tại lần đo: ${assessment.ageDays} ngày. Nguồn: ${assessment.source}, ${assessment.standardVersion}. Công thức LMS có hiệu chỉnh phần đuôi ngoài ±3 SD.` }));
  } catch (error) {
    console.error(error);
    whoSummary.append(createElement("p", { className: "text-danger", text: "Không thể tính tham chiếu WHO. Kiểm tra file dataset trong assets/data." }));
  }
}

const config = {
  title: "Theo dõi tăng trưởng",
  icon: "monitoring",
  singular: "Bản ghi tăng trưởng",
  collection: "growthRecords",
  dateField: "measuredAt",
  orderByField: "measuredAt",
  pageSize: 20,
  emptyIcon: "monitoring",
  description: "Ghi cân nặng, chiều dài/chiều cao và vòng đầu; có tham chiếu WHO 0–5 tuổi.",
  medicalNote: "Z-score và percentile WHO chỉ là tham chiếu thống kê, không phải chẩn đoán. Kết quả dùng tuổi theo ngày, giới tính trong hồ sơ và số đo người dùng nhập; trẻ sinh non hoặc cách đo khác nhau cần được nhân viên y tế diễn giải.",
  recordTitle: (record) => `Đo ngày ${formatDate(record.measuredAt)}`,
  fields: [
    { name: "measuredAt", label: "Thời điểm đo", type: "datetime-local", required: true },
    { name: "weightKg", label: "Cân nặng", type: "number", min: 0.01, max: 100, step: 0.01, suffix: "kg", hideWhenEmpty: true },
    { name: "heightCm", label: "Chiều dài/chiều cao", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "cm", hideWhenEmpty: true },
    { name: "headCircumferenceCm", label: "Vòng đầu", type: "number", min: 0.1, max: 100, step: 0.1, suffix: "cm", hideWhenEmpty: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
  ],
  beforeSave(payload) {
    if (![payload.weightKg, payload.heightCm, payload.headCircumferenceCm].some((value) => Number.isFinite(value) && value > 0)) {
      showToast("Hãy nhập ít nhất một chỉ số tăng trưởng.", "warning");
      return false;
    }
    return payload;
  },
  renderTop(container) {
    destroyCharts();
    const whoCard = createElement("section", { className: "card mb-2" });
    whoCard.append(createElement("h3", { text: "Tham chiếu WHO gần nhất" }));
    whoSummary = createElement("div", { className: "mt-1" });
    whoCard.append(whoSummary, createElement("p", { className: "medical-note mt-1", text: "Ứng dụng không gắn nhãn thiếu cân, thấp còi hoặc bất thường. Hãy trao đổi với bác sĩ khi cần diễn giải kết quả." }));
    container.append(whoCard);

    const card = createElement("section", { className: "card mb-2" });
    card.append(createElement("h3", { text: "Biểu đồ tăng trưởng với đường tham chiếu WHO" }));
    const grid = createElement("div", { className: "grid growth-chart-grid mt-2" });
    chartCanvases = {};
    [["weightKg", "Cân nặng (kg)"], ["heightCm", "Chiều dài/chiều cao (cm)"], ["headCircumferenceCm", "Vòng đầu (cm)"]].forEach(([key, label]) => {
      const panel = createElement("section", { className: "chart-panel" });
      panel.append(createElement("h3", { text: label }));
      const viewport = createElement("div", { className: "chart-container" });
      const canvas = createElement("canvas", { attrs: { "aria-label": label, role: "img" } });
      viewport.append(canvas); panel.append(viewport); chartCanvases[key] = { canvas, label }; grid.append(panel);
    });
    card.append(grid); container.append(card);
  },
  async afterRecordsRender(records, context) {
    if (context.trashMode) return;
    const run = ++renderRun;
    await renderWhoSummary(records);
    if (!window.Chart || run !== renderRun) return;
    const baby = getState().selectedBaby;
    const sorted = [...records].sort((a, b) => recordTime(a) - recordTime(b));
    const signature = chartSignature(sorted, baby);
    if (signature === lastChartSignature) return;
    lastChartSignature = signature;

    for (const [key, meta] of Object.entries(chartCanvases)) {
      const points = sorted.filter((record) => Number.isFinite(record[key]));
      const references = await buildWhoReferenceSeries({ baby, records: points, field: key });
      if (run !== renderRun) return;
      const labels = points.map((record) => formatDate(record.measuredAt));
      const values = points.map((record) => record[key]);
      const median = references.map((item) => item?.median ?? null);
      const minus2 = references.map((item) => item?.minus2 ?? null);
      const plus2 = references.map((item) => item?.plus2 ?? null);
      let chart = charts.get(key);
      if (chart && chart.canvas !== meta.canvas) { chart.destroy(); charts.delete(key); chart = null; }
      const datasets = [
        { label: meta.label, data: values, tension: 0.25, pointRadius: 3, pointHoverRadius: 5, borderWidth: 3 },
        { label: "WHO trung vị", data: median, pointRadius: 0, borderDash: [6, 4], borderWidth: 1.5 },
        { label: "WHO -2 SD", data: minus2, pointRadius: 0, borderDash: [3, 3], borderWidth: 1 },
        { label: "WHO +2 SD", data: plus2, pointRadius: 0, borderDash: [3, 3], borderWidth: 1 }
      ];
      if (!chart) {
        chart = new window.Chart(meta.canvas, {
          type: "line",
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            resizeDelay: 120,
            normalized: true,
            plugins: { legend: { display: true, position: "bottom" } },
            interaction: { mode: "nearest", intersect: false },
            scales: { y: { beginAtZero: false } }
          }
        });
        charts.set(key, chart);
      } else {
        chart.data.labels = labels;
        chart.data.datasets = datasets;
        chart.update("none");
      }
    }
  },
  cleanup() {
    renderRun += 1;
    destroyCharts();
    chartCanvases = {};
    whoSummary = null;
  }
};

export function render(container) {
  return renderRecordModule(container, config);
}
